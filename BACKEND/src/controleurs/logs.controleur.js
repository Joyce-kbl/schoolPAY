/**
 * Contrôleur de journalisation (audit trail) pour SchoolPAY.
 * Enregistre chaque action importante effectuée dans l'application.
 */

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
 * Résout l'identifiant d'un caissier à partir de son nom d'utilisateur.
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {string} nom_utilisateur - Nom d'utilisateur du caissier
 * @returns {number|null} L'ID du caissier ou null si introuvable
 */
function resoudre_caissier_id(base_de_donnees, nom_utilisateur) {
  if (nom_utilisateur) {
    const caissier = base_de_donnees.prepare(
      'SELECT id FROM caissiers WHERE lower(nom_utilisateur) = ?'
    ).get(String(nom_utilisateur).trim().toLowerCase());
    if (caissier) return caissier.id;
  }
  const premier = base_de_donnees.prepare('SELECT id FROM caissiers WHERE actif = 1 LIMIT 1').get();
  return premier ? premier.id : null;
}

/**
 * Enregistre une entrée dans la table de logs.
 * Appelé directement par les contrôleurs backend après chaque action.
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number} caissier_id - L'ID du caissier ayant effectué l'action
 * @param {string} action - Le type d'action (ex: 'connexion', 'paiement')
 * @param {string|number} [reference_action='-'] - Référence contextuelle de l'action
 */
function enregistrer_log(base_de_donnees, caissier_id, action, reference_action = '-') {
  if (!caissier_id || !action) return;
  try {
    base_de_donnees.prepare(`
      INSERT INTO logs (caissier_id, action, reference_action)
      VALUES (?, ?, ?)
    `).run(caissier_id, action, String(reference_action));
  } catch (erreur) {
    // Le log ne doit jamais bloquer l'opération principale
    console.error('[LOGS] Erreur d\'enregistrement :', erreur.message);
  }
}

/**
 * Enregistre un log en résolvant le caissier_id à partir du nom d'utilisateur.
 * Utile quand seul le nom_utilisateur est disponible (ex: requêtes frontend).
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {string} nom_utilisateur - Nom d'utilisateur du caissier
 * @param {string} action - Le type d'action
 * @param {string|number} [reference_action='-'] - Référence contextuelle
 */
function enregistrer_log_par_nom(base_de_donnees, nom_utilisateur, action, reference_action = '-') {
  const caissier_id = resoudre_caissier_id(base_de_donnees, nom_utilisateur);
  if (caissier_id) {
    enregistrer_log(base_de_donnees, caissier_id, action, reference_action);
  }
}

/**
 * Liste les logs avec filtrage optionnel.
 * Route: GET /api/logs?caissier_id=X&action=Y&date_debut=Z&date_fin=W&limite=N
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {http.ServerResponse} reponse - La réponse HTTP
 * @param {URLSearchParams} params - Paramètres de requête pour le filtrage
 */
function lister_logs(base_de_donnees, reponse, params) {
  let sql = `
    SELECT l.id, l.caissier_id, l.horodatage, l.action, l.reference_action,
           c.nom_complet AS nom_caissier, c.nom_utilisateur
    FROM logs l
    INNER JOIN caissiers c ON c.id = l.caissier_id
  `;
  const conditions = [];
  const valeurs = [];

  const caissier_id = params.get('caissier_id');
  if (caissier_id) {
    conditions.push('l.caissier_id = ?');
    valeurs.push(Number(caissier_id));
  }

  const action = params.get('action');
  if (action) {
    conditions.push('l.action = ?');
    valeurs.push(action);
  }

  const date_debut = params.get('date_debut');
  if (date_debut) {
    conditions.push('l.horodatage >= ?');
    valeurs.push(date_debut);
  }

  const date_fin = params.get('date_fin');
  if (date_fin) {
    conditions.push('l.horodatage <= ?');
    valeurs.push(date_fin + ' 23:59:59');
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY l.id DESC';

  const limite = Number(params.get('limite')) || 200;
  sql += ` LIMIT ${limite}`;

  const lignes = base_de_donnees.prepare(sql).all(...valeurs);
  envoyer_json(reponse, 200, { donnees: lignes });
}

/**
 * Endpoint POST /api/logs pour les actions côté frontend (impressions, déconnexion).
 * Le frontend envoie { nom_utilisateur, action, reference_action }.
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {Object} corps - Body de la requête
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function creer_log_depuis_frontend(base_de_donnees, corps, reponse) {
  const nom_utilisateur = String(corps.nom_utilisateur || '').trim();
  const action = String(corps.action || '').trim();
  const reference_action = String(corps.reference_action || '-').trim();

  if (!nom_utilisateur || !action) {
    return envoyer_json(reponse, 400, { erreur: 'nom_utilisateur et action sont requis' });
  }

  const caissier_id = resoudre_caissier_id(base_de_donnees, nom_utilisateur);
  if (!caissier_id) {
    return envoyer_json(reponse, 404, { erreur: 'Caissier introuvable' });
  }

  enregistrer_log(base_de_donnees, caissier_id, action, reference_action);
  envoyer_json(reponse, 201, { donnees: { ok: true } });
}

module.exports = {
  enregistrer_log,
  enregistrer_log_par_nom,
  lister_logs,
  creer_log_depuis_frontend
};
