const { construire_numero_recu } = require('../services/recu.service');
const { enregistrer_log_par_nom } = require('./logs.controleur');
const { ANNEE_SCOLAIRE_PAR_DEFAUT } = require('../base_de_donnees/base_de_donnees');
const { obtenir_attendu_frais } = require('../services/frais.service');

function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

/**
 * Vérifie qu'un paiement d'une catégorie définie dans les frais attendus ne
 * dépasse pas ce qui reste dû pour l'élève (et refuse tout nouvel ajout si la
 * catégorie est déjà entièrement payée). Si la catégorie n'a pas de montant
 * défini (ex: catégories "suspens" à 0 ou absentes du barème), la saisie
 * reste libre.
 * @param {number} [paiement_id_a_exclure] - ID du paiement en cours de
 *   modification (exclu du total déjà payé), sinon null.
 * @returns {string|null} un message d'erreur si le plafond est dépassé, sinon null
 */
function verifier_plafond_frais(base_de_donnees, eleve_id, categorie_frais_id, montant, paiement_id_a_exclure = null) {
  if (!categorie_frais_id) return null;
  const eleve = base_de_donnees.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve || !eleve.classe_id) return null;

  // Pour l'inscription, le montant attendu dépend du statut ancien/nouveau ;
  // pour les autres catégories, il provient du barème de la classe.
  const attendu_montant = obtenir_attendu_frais(base_de_donnees, eleve_id, categorie_frais_id);
  if (attendu_montant === null || attendu_montant <= 0) return null;
  const attendu = { montant: attendu_montant };

  const params = [eleve_id, categorie_frais_id];
  let sql = 'SELECT COALESCE(SUM(p.montant), 0) AS total FROM paiements p WHERE p.eleve_id = ? AND p.categorie_frais_id = ?';
  if (paiement_id_a_exclure) {
    sql += ' AND p.id != ?';
    params.push(paiement_id_a_exclure);
  }
  const deja_paye = base_de_donnees.prepare(sql).get(...params).total;

  const reste = Number(attendu.montant) - Number(deja_paye);
  if (Number(montant) > reste) {
    const categorie = base_de_donnees.prepare('SELECT libelle FROM categories_frais WHERE id = ?').get(categorie_frais_id);
    return `Le montant saisi dépasse le reste dû pour ${categorie ? categorie.libelle : 'cette categorie'} (${Math.max(0, reste).toFixed(2)} $). Veuillez saisir un montant inferieur ou egal.`;
  }
  return null;
}

function lister_paiements(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT p.id, p.numero_recu, p.libelle, p.montant, p.devise, p.paye_le, p.caissier,
           e.nom_complet AS nom_eleve
    FROM paiements p
    INNER JOIN eleves e ON e.id = p.eleve_id
    ORDER BY p.id DESC
  `).all();

  envoyer_json(reponse, 200, { donnees: lignes });
}

function creer_paiement(base_de_donnees, corps, reponse) {
  const eleve_id = Number(corps.eleve_id);
  const categorie_frais_id = corps.categorie_frais_id ? Number(corps.categorie_frais_id) : null;
  let libelle = String(corps.libelle || '').trim();
  const montant = Number(corps.montant);
  const devise = 'USD';
  const paye_le = String(corps.paye_le || new Date().toISOString()).slice(0, 10);
  const caissier = String(corps.caissier || '').trim() || null;
  const annee_scolaire = ANNEE_SCOLAIRE_PAR_DEFAUT;

  if (categorie_frais_id) {
    const categorie = base_de_donnees.prepare('SELECT libelle FROM categories_frais WHERE id = ?').get(categorie_frais_id);
    if (!categorie) return envoyer_json(reponse, 400, { erreur: 'Categorie de frais invalide' });
    libelle = categorie.libelle;
  }

  if (!eleve_id || !libelle || !Number.isFinite(montant) || montant <= 0) {
    return envoyer_json(reponse, 400, {
      erreur: 'eleve_id, libelle et montant positif sont obligatoires'
    });
  }



  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve) {
    return envoyer_json(reponse, 404, { erreur: 'eleve introuvable' });
  }

  const erreur_plafond = verifier_plafond_frais(base_de_donnees, eleve_id, categorie_frais_id, montant);
  if (erreur_plafond) {
    return envoyer_json(reponse, 400, { erreur: erreur_plafond });
  }

  const insertion = base_de_donnees.prepare(`
    INSERT INTO paiements (numero_recu, eleve_id, categorie_frais_id, libelle, montant, devise, paye_le, caissier, annee_scolaire)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const numero_temporaire = `TMP-${Date.now()}`;
  const resultat = insertion.run(numero_temporaire, eleve_id, categorie_frais_id, libelle, montant, devise, paye_le, caissier, annee_scolaire);
  const numero_recu = construire_numero_recu(resultat.lastInsertRowid);

  base_de_donnees
    .prepare('UPDATE paiements SET numero_recu = ? WHERE id = ?')
    .run(numero_recu, resultat.lastInsertRowid);

  // Log du paiement (le caissier est passé par le frontend via corps.caissier)
  enregistrer_log_par_nom(base_de_donnees, caissier, 'paiement', String(resultat.lastInsertRowid));

  envoyer_json(reponse, 201, {
    donnees: {
      id: resultat.lastInsertRowid,
      numero_recu,
      eleve_id,
      categorie_frais_id,
      libelle,
      montant,
      devise,
      paye_le,
      caissier,
      annee_scolaire
    }
  });
}

function rechercher_paiement(base_de_donnees, numero_recu, reponse) {
  const paiement = base_de_donnees.prepare(`
    SELECT p.id, p.numero_recu, p.eleve_id, p.libelle, p.montant, p.devise, p.paye_le, p.caissier,
           e.nom_complet AS nom_eleve
    FROM paiements p
    INNER JOIN eleves e ON e.id = p.eleve_id
    WHERE p.numero_recu = ?
  `).get(numero_recu);

  if (!paiement) {
    return envoyer_json(reponse, 404, { erreur: 'Paiement introuvable' });
  }

  envoyer_json(reponse, 200, { donnees: paiement });
}

function modifier_paiement(base_de_donnees, id, corps, reponse) {
  const paiement = base_de_donnees.prepare('SELECT * FROM paiements WHERE id = ?').get(id);
  if (!paiement) {
    return envoyer_json(reponse, 404, { erreur: 'Paiement introuvable' });
  }

  const eleve_id = Object.prototype.hasOwnProperty.call(corps, 'eleve_id')
    ? Number(corps.eleve_id)
    : paiement.eleve_id;
  const categorie_frais_id = Object.prototype.hasOwnProperty.call(corps, 'categorie_frais_id')
    ? Number(corps.categorie_frais_id)
    : paiement.categorie_frais_id;
  let libelle = String(corps.libelle || paiement.libelle || '').trim();
  const montant = Object.prototype.hasOwnProperty.call(corps, 'montant')
    ? Number(corps.montant)
    : Number(paiement.montant);
  const devise = 'USD';
  const paye_le = String(corps.paye_le || paiement.paye_le || new Date().toISOString()).slice(0, 10);

  if (categorie_frais_id) {
    const categorie = base_de_donnees.prepare('SELECT libelle FROM categories_frais WHERE id = ?').get(categorie_frais_id);
    if (!categorie) return envoyer_json(reponse, 400, { erreur: 'Categorie de frais invalide' });
    libelle = categorie.libelle;
  }

  if (!eleve_id || !libelle || !Number.isFinite(montant) || montant <= 0) {
    return envoyer_json(reponse, 400, {
      erreur: 'eleve_id, libelle et montant positif sont obligatoires'
    });
  }



  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve) {
    return envoyer_json(reponse, 400, { erreur: 'Eleve introuvable' });
  }

  const erreur_plafond = verifier_plafond_frais(base_de_donnees, eleve_id, categorie_frais_id, montant, id);
  if (erreur_plafond) {
    return envoyer_json(reponse, 400, { erreur: erreur_plafond });
  }

  base_de_donnees.prepare(`
    UPDATE paiements
    SET eleve_id = ?, categorie_frais_id = ?, libelle = ?, montant = ?, devise = ?, paye_le = ?
    WHERE id = ?
  `).run(eleve_id, categorie_frais_id, libelle, montant, devise, paye_le, id);

  envoyer_json(reponse, 200, {
    donnees: {
      id,
      eleve_id,
      categorie_frais_id,
      libelle,
      montant,
      devise,
      paye_le
    }
  });
}

function supprimer_paiement(base_de_donnees, id, reponse) {
  // On récupère le facture_id AVANT la suppression : une fois la ligne
  // effacée, il serait impossible de retrouver à quelle facture elle appartenait.
  const paiement = base_de_donnees
    .prepare('SELECT id, facture_id FROM paiements WHERE id = ?')
    .get(id);

  if (!paiement) {
    return envoyer_json(reponse, 404, { erreur: 'Paiement introuvable' });
  }

  const { facture_id } = paiement;

  base_de_donnees.prepare('DELETE FROM paiements WHERE id = ?').run(id);

  // Si le paiement appartenait à une facture, recalculer son total
  // à partir des paiements restants pour maintenir la cohérence.
  if (facture_id) {
    base_de_donnees.prepare(`
      UPDATE factures
      SET total = (
        SELECT COALESCE(SUM(montant), 0)
        FROM paiements
        WHERE facture_id = ?
      )
      WHERE id = ?
    `).run(facture_id, facture_id);
  }

  reponse.writeHead(204, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end();
}

module.exports = {
  lister_paiements,
  creer_paiement,
  rechercher_paiement,
  modifier_paiement,
  supprimer_paiement
};
