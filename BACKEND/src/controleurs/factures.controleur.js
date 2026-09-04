const { construire_numero_recu } = require('../services/recu.service');
const { enregistrer_log_par_nom } = require('./logs.controleur');
const { ANNEE_SCOLAIRE_PAR_DEFAUT } = require('../base_de_donnees/base_de_donnees');
const { obtenir_attendu_frais } = require('../services/frais.service');

/**
 * Utilitaire interne pour envoyer la réponse JSON.
 * @param {http.ServerResponse} reponse - La réponse HTTP
 * @param {number} code_statut - Le code d'état HTTP
 * @param {Object} contenu - Le contenu JSON à envoyer
 */
function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

/**
 * Vérifie qu'un ensemble d'opérations à enregistrer ne fait pas dépasser, pour
 * chacune des catégories définies dans les frais attendus, le montant restant
 * dû à l'élève (et refuse tout nouvel ajout si la catégorie est déjà soldée).
 * Cette vérification est faite côté serveur (en plus du blocage déjà présent
 * côté frontend) afin que la règle soit respectée même en cas d'appel direct à
 * l'API.
 * @returns {string|null} un message d'erreur si un plafond est dépassé, sinon null
 */
function verifier_plafonds_facture(base_de_donnees, eleve_id, operations) {
  const eleve = base_de_donnees.prepare('SELECT classe_id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve || !eleve.classe_id) return null;

  // Somme des nouveaux montants saisis par catégorie (seules celles avec un ID catégorie).
  const nouveaux = {};
  for (const op of operations) {
    if (!op.categorie_frais_id) continue;
    const catId = Number(op.categorie_frais_id);
    nouveaux[catId] = (nouveaux[catId] || 0) + Number(op.montant || 0);
  }

  for (const catId of Object.keys(nouveaux).map(Number)) {
    // Montant attendu (inscription : 10/15 $ selon le statut ; sinon barème classe).
    const attendu = obtenir_attendu_frais(base_de_donnees, eleve_id, catId);
    if (attendu === null || attendu <= 0) continue;

    const deja_paye = base_de_donnees.prepare(`
      SELECT COALESCE(SUM(montant), 0) AS total
      FROM paiements
      WHERE eleve_id = ? AND categorie_frais_id = ?
    `).get(eleve_id, catId).total;

    const reste = attendu - Number(deja_paye);
    if (nouveaux[catId] > reste) {
      const cat = base_de_donnees.prepare('SELECT libelle FROM categories_frais WHERE id = ?').get(catId);
      return `Le montant saisi dépasse le reste dû pour ${cat ? cat.libelle : 'cette categorie'} (${Math.max(0, reste).toFixed(2)} $). Veuillez saisir un montant inferieur ou egal.`;
    }
  }
  return null;
}

/**
 * Crée une facture (qui englobe un ou plusieurs paiements/opérations).
 * Utilise une transaction SQLite pour s'assurer que soit TOUT est enregistré, soit RIEN.
 * Route: POST /api/factures
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {Object} corps - Payload { eleve_id, paye_le, caissier, operations: [{categorie_frais_id, libelle, montant}] }
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function creer_facture(base_de_donnees, corps, reponse) {
  const eleve_id = Number(corps.eleve_id);
  const devise = 'USD'; // Devise figée pour toute l'application
  const paye_le = String(corps.paye_le || new Date().toISOString()).slice(0, 10);
  const caissier = String(corps.caissier || '').trim() || null;
  const deposant = String(corps.deposant || '').trim() || null;
  const annee_scolaire = ANNEE_SCOLAIRE_PAR_DEFAUT;
  const operations = corps.operations;

  // Validation de base
  if (!eleve_id || !Array.isArray(operations) || operations.length === 0) {
    return envoyer_json(reponse, 400, {
      erreur: 'eleve_id et un tableau operations non vide sont obligatoires'
    });
  }

  if (!deposant) {
    return envoyer_json(reponse, 400, {
      erreur: 'Le nom du déposant est obligatoire'
    });
  }

  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve) {
    return envoyer_json(reponse, 404, { erreur: 'eleve introuvable' });
  }

  // Calcul du total de la facture
  const total = operations.reduce((somme, op) => somme + Number(op.montant || 0), 0);
  if (total <= 0) {
    return envoyer_json(reponse, 400, { erreur: 'Le total de la facture doit etre positif' });
  }

  // Empêche d'enregistrer un paiement de frais scolaires qui dépasserait le
  // montant total attendu pour l'élève (une fois les frais scolaires soldés,
  // il n'est plus possible d'en payer davantage).
  const erreur_plafond = verifier_plafonds_facture(base_de_donnees, eleve_id, operations);
  if (erreur_plafond) {
    return envoyer_json(reponse, 400, { erreur: erreur_plafond });
  }

  try {
    // Début de la transaction comptable
    base_de_donnees.exec('BEGIN TRANSACTION');

    const inserer_facture = base_de_donnees.prepare(`
      INSERT INTO factures (numero_facture, eleve_id, total, devise, paye_le, caissier, deposant, annee_scolaire)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // On insère avec un numéro temporaire car le vrai numéro dépend de l'ID généré
    const num_tmp = `F-TMP-${Date.now()}`;
    const res_facture = inserer_facture.run(num_tmp, eleve_id, total, devise, paye_le, caissier, deposant, annee_scolaire);
    const facture_id = res_facture.lastInsertRowid;
    
    // Génération du vrai numéro de facture (ex: F-0012)
    const numero_facture = `F-${String(facture_id).padStart(4, '0')}`;
    base_de_donnees.prepare('UPDATE factures SET numero_facture = ? WHERE id = ?').run(numero_facture, facture_id);

    const inserer_paiement = base_de_donnees.prepare(`
      INSERT INTO paiements (numero_recu, eleve_id, facture_id, categorie_frais_id, libelle, montant, devise, paye_le, caissier, deposant, annee_scolaire)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Enregistrement individuel de chaque opération (ligne de la facture)
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const categorie_frais_id = op.categorie_frais_id ? Number(op.categorie_frais_id) : null;
      let libelle = String(op.libelle || '').trim();
      const montant = Number(op.montant);

      // Si une catégorie officielle est choisie, on force son libellé pour éviter les fautes de frappe
      if (categorie_frais_id) {
        const cat = base_de_donnees.prepare('SELECT libelle FROM categories_frais WHERE id = ?').get(categorie_frais_id);
        if (cat) libelle = cat.libelle;
      }
      
      // Sous-numéro de reçu (ex: F-0012-1, F-0012-2)
      const numero_recu = `${numero_facture}-${i + 1}`;
      inserer_paiement.run(numero_recu, eleve_id, facture_id, categorie_frais_id, libelle, montant, devise, paye_le, caissier, deposant, annee_scolaire);
    }

    // Validation finale de la transaction
    base_de_donnees.exec('COMMIT');

    // Log de chaque paiement créé dans la facture
    enregistrer_log_par_nom(base_de_donnees, caissier, 'paiement', numero_facture);

    envoyer_json(reponse, 201, {
      donnees: {
        id: facture_id,
        numero_facture,
        eleve_id,
        total,
        devise,
        paye_le,
        caissier,
        deposant,
        annee_scolaire,
        operations
      }
    });

  } catch (err) {
    // En cas d'erreur, on annule toutes les insertions de cette facture
    base_de_donnees.exec('ROLLBACK');
    envoyer_json(reponse, 500, { erreur: 'Erreur lors de la creation de la facture', details: err.message });
  }
}

/**
 * Récupère une facture spécifique et ses opérations.
 * Route: GET /api/factures/:numero_facture
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {string} numero_facture - Numéro de la facture (ex: F-0012)
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function obtenir_facture(base_de_donnees, numero_facture, reponse) {
  const facture = base_de_donnees.prepare(`
    SELECT f.id, f.numero_facture, f.eleve_id, f.total, f.devise, f.paye_le, f.caissier, f.deposant, f.annee_scolaire,
           e.nom_complet AS nom_eleve, e.matricule,
           cl.nom AS nom_classe
    FROM factures f
    INNER JOIN eleves e ON e.id = f.eleve_id
    LEFT JOIN classes cl ON cl.id = e.classe_id
    WHERE f.numero_facture = ?
  `).get(numero_facture);

  if (!facture) {
    return envoyer_json(reponse, 404, { erreur: 'Facture introuvable' });
  }

  // Récupère le détail des opérations de cette facture
  const operations = base_de_donnees.prepare(`
    SELECT id, numero_recu, libelle, montant
    FROM paiements
    WHERE facture_id = ?
  `).all(facture.id);

  facture.operations = operations;
  envoyer_json(reponse, 200, { donnees: facture });
}

module.exports = {
  creer_facture,
  obtenir_facture
};
