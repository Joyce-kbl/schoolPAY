const { enregistrer_log_par_nom } = require('./logs.controleur');

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
 * Récupère et liste toutes les classes enregistrées.
 * Route: GET /api/classes
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function lister_classes(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT id, nom, montant_frais
    FROM classes
    ORDER BY nom ASC
  `).all();

  envoyer_json(reponse, 200, { donnees: lignes });
}

/**
 * Crée une nouvelle classe et initialise ses frais attendus.
 * Route: POST /api/classes
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {Object} corps - Payload { nom, montant_frais }
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function creer_classe(base_de_donnees, corps, reponse) {
  const nom = String(corps.nom || '').trim();
  const montant_frais = Number(corps.montant_frais);

  if (!nom || !Number.isFinite(montant_frais) || montant_frais <= 0) {
    return envoyer_json(reponse, 400, { erreur: 'nom et montant_frais positif sont obligatoires' });
  }

  try {
    const insertion = base_de_donnees.prepare(
      'INSERT INTO classes (nom, montant_frais) VALUES (?, ?)'
    );
    const resultat = insertion.run(nom, montant_frais);
    const id = resultat.lastInsertRowid;

    // Lier automatiquement le montant_frais classique à la nouvelle table de frais attendus
    // en lui associant la catégorie comptable "FRAIS SCOLAIRES".
    const cat_scolaire = base_de_donnees.prepare("SELECT id FROM categories_frais WHERE libelle = 'FRAIS SCOLAIRES'").get();
    if (cat_scolaire) {
      base_de_donnees.prepare(
        'INSERT INTO frais_attendus_classe (classe_id, categorie_frais_id, montant) VALUES (?, ?, ?)'
      ).run(id, cat_scolaire.id, montant_frais);
    }

    // Log de la création de la classe (le caissier connecté est passé via corps.caissier)
    enregistrer_log_par_nom(base_de_donnees, corps.caissier, 'ajout_classe', String(id));

    envoyer_json(reponse, 201, {
      donnees: {
        id,
        nom,
        montant_frais
      }
    });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de creer la classe', message: erreur.message });
  }
}

/**
 * Modifie les informations d'une classe existante (nom et/ou montant).
 * Route: PUT/PATCH /api/classes/:id
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number|string} id - L'ID de la classe
 * @param {Object} corps - Payload { nom?, montant_frais? }
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function modifier_classe(base_de_donnees, id, corps, reponse) {
  const classe = base_de_donnees.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  if (!classe) {
    return envoyer_json(reponse, 404, { erreur: 'Classe introuvable' });
  }

  const nom = String(corps.nom || classe.nom || '').trim();
  const montant_frais = Object.prototype.hasOwnProperty.call(corps, 'montant_frais')
    ? Number(corps.montant_frais)
    : Number(classe.montant_frais);

  if (!nom || !Number.isFinite(montant_frais) || montant_frais <= 0) {
    return envoyer_json(reponse, 400, { erreur: 'nom et montant_frais positif sont obligatoires' });
  }

  try {
    base_de_donnees.prepare(
      'UPDATE classes SET nom = ?, montant_frais = ? WHERE id = ?'
    ).run(nom, montant_frais, id);

    // Synchronisation de l'ancienne logique vers la nouvelle table des frais.
    // L'UPSERT (ON CONFLICT) met à jour la ligne si elle existe déjà.
    const cat_scolaire = base_de_donnees.prepare("SELECT id FROM categories_frais WHERE libelle = 'FRAIS SCOLAIRES'").get();
    if (cat_scolaire) {
      base_de_donnees.prepare(`
        INSERT INTO frais_attendus_classe (classe_id, categorie_frais_id, montant) 
        VALUES (?, ?, ?)
        ON CONFLICT(classe_id, categorie_frais_id) DO UPDATE SET montant = excluded.montant
      `).run(id, cat_scolaire.id, montant_frais);
    }

    envoyer_json(reponse, 200, { donnees: { id, nom, montant_frais } });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de modifier la classe', message: erreur.message });
  }
}

/**
 * Supprime une classe.
 * Attention: Lève une erreur de contrainte SQLite s'il y a déjà des élèves assignés à cette classe.
 * Route: DELETE /api/classes/:id
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number|string} id - L'ID de la classe
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function supprimer_classe(base_de_donnees, id, reponse) {
  const classe = base_de_donnees.prepare('SELECT id FROM classes WHERE id = ?').get(id);
  if (!classe) {
    return envoyer_json(reponse, 404, { erreur: 'Classe introuvable' });
  }

  try {
    base_de_donnees.prepare('DELETE FROM classes WHERE id = ?').run(id);
    reponse.writeHead(204, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end();
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de supprimer la classe', message: erreur.message });
  }
}

module.exports = {
  lister_classes,
  creer_classe,
  modifier_classe,
  supprimer_classe
};
