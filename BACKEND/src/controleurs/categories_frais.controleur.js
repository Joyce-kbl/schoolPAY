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
 * Récupère et renvoie la liste complète des catégories de frais triées par code.
 * Route: GET /api/categories-frais
 * @param {DatabaseSync} base_de_donnees - Instance de la base de données SQLite
 * @param {http.ServerResponse} reponse - L'objet de réponse HTTP
 */
function lister_categories_frais(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT id, code, libelle
    FROM categories_frais
    ORDER BY code ASC
  `).all();

  envoyer_json(reponse, 200, { donnees: lignes });
}

/**
 * Crée une nouvelle catégorie de frais.
 * Route: POST /api/categories-frais
 * @param {DatabaseSync} base_de_donnees - Instance de la base de données SQLite
 * @param {Object} corps - Payload de la requête contenant 'code' et 'libelle'
 * @param {http.ServerResponse} reponse - L'objet de réponse HTTP
 */
function creer_categorie_frais(base_de_donnees, corps, reponse) {
  const code = String(corps.code || '').trim();
  const libelle = String(corps.libelle || '').trim().toUpperCase();

  // Validation des champs requis
  if (!code || !libelle) {
    return envoyer_json(reponse, 400, { erreur: 'code et libelle sont obligatoires' });
  }

  try {
    // Insertion en base. Si le code ou libellé existe déjà, une erreur de contrainte UNIQUE sera levée
    const resultat = base_de_donnees.prepare(`
      INSERT INTO categories_frais (code, libelle)
      VALUES (?, ?)
    `).run(code, libelle);

    envoyer_json(reponse, 201, {
      donnees: {
        id: resultat.lastInsertRowid,
        code,
        libelle
      }
    });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de creer la categorie', message: erreur.message });
  }
}

module.exports = {
  lister_categories_frais,
  creer_categorie_frais
};
