const { construire_numero_recu } = require('../services/recu.service');

function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

/**
 * Vérifie qu'un paiement de type FRAIS SCOLAIRES ne fait pas dépasser le
 * montant attendu pour l'élève. Renvoie un message d'erreur si le plafond
 * est dépassé, sinon null. Les autres catégories de frais ne sont pas
 * concernées par ce plafond.
 */
function verifier_plafond_frais_scolaires(base_de_donnees, eleve_id, categorie_frais_id, montant) {
  if (!categorie_frais_id) return null;
  const categorie = base_de_donnees.prepare('SELECT libelle FROM categories_frais WHERE id = ?').get(categorie_frais_id);
  if (!categorie || categorie.libelle.toUpperCase() !== 'FRAIS SCOLAIRES') return null;

  const eleve = base_de_donnees.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve || !eleve.classe_id) return null;

  const attendu_scolaire = base_de_donnees.prepare(`
    SELECT f.montant
    FROM frais_attendus_classe f
    INNER JOIN categories_frais c ON c.id = f.categorie_frais_id
    WHERE f.classe_id = ? AND UPPER(c.libelle) = 'FRAIS SCOLAIRES'
  `).get(eleve.classe_id);
  if (!attendu_scolaire) return null;

  const deja_paye = base_de_donnees.prepare(`
    SELECT COALESCE(SUM(p.montant), 0) AS total
    FROM paiements p
    INNER JOIN categories_frais c ON c.id = p.categorie_frais_id
    WHERE p.eleve_id = ? AND UPPER(c.libelle) = 'FRAIS SCOLAIRES'
  `).get(eleve_id).total;

  const reste = Number(attendu_scolaire.montant) - Number(deja_paye);
  if (Number(montant) > reste) {
    return `Les frais scolaires de cet élève sont déjà réglés ou le montant saisi dépasse le reste dû (${Math.max(0, reste).toFixed(2)} $).`;
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

  // Empêche d'enregistrer un paiement de frais scolaires qui dépasserait le
  // montant total attendu pour l'élève.
  const erreur_plafond = verifier_plafond_frais_scolaires(base_de_donnees, eleve_id, categorie_frais_id, montant);
  if (erreur_plafond) {
    return envoyer_json(reponse, 400, { erreur: erreur_plafond });
  }

  const insertion = base_de_donnees.prepare(`
    INSERT INTO paiements (numero_recu, eleve_id, categorie_frais_id, libelle, montant, devise, paye_le, caissier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const numero_temporaire = `TMP-${Date.now()}`;
  const resultat = insertion.run(numero_temporaire, eleve_id, categorie_frais_id, libelle, montant, devise, paye_le, caissier);
  const numero_recu = construire_numero_recu(resultat.lastInsertRowid);

  base_de_donnees
    .prepare('UPDATE paiements SET numero_recu = ? WHERE id = ?')
    .run(numero_recu, resultat.lastInsertRowid);

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
      caissier
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
  const paiement = base_de_donnees.prepare('SELECT id FROM paiements WHERE id = ?').get(id);
  if (!paiement) {
    return envoyer_json(reponse, 404, { erreur: 'Paiement introuvable' });
  }

  base_de_donnees.prepare('DELETE FROM paiements WHERE id = ?').run(id);
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
