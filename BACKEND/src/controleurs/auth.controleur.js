const crypto = require('crypto');
const { enregistrer_log, enregistrer_log_par_nom } = require('./logs.controleur');

/**
 * Fonction utilitaire interne pour envoyer du JSON
 * @param {http.ServerResponse} reponse - La réponse HTTP
 * @param {number} code_statut - Code d'état HTTP
 * @param {Object} contenu - Corps de la réponse
 */
function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

/**
 * Hache le mot de passe pour la création ou l'authentification.
 * @param {string} mot_de_passe - Mot de passe en clair
 * @param {string} [sel] - Sel cryptographique optionnel
 * @returns {Object} Objet avec le sel et le hash
 */
function hacher_mot_de_passe(mot_de_passe, sel = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(mot_de_passe), sel, 64).toString('hex');
  return { sel, hash };
}

/**
 * Compare un mot de passe en clair avec son hash stocké (sécurisé contre les attaques temporelles).
 * @param {string} mot_de_passe - Le mot de passe soumis
 * @param {string} sel - Le sel stocké
 * @param {string} hash - Le hash stocké
 * @returns {boolean} True si valide
 */
function verifier_mot_de_passe(mot_de_passe, sel, hash) {
  const { hash: hash_calcule } = hacher_mot_de_passe(mot_de_passe, sel);
  const bufferA = Buffer.from(hash_calcule, 'hex');
  const bufferB = Buffer.from(hash, 'hex');
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Connecte un caissier en vérifiant ses identifiants.
 * Route: POST /api/connexion
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {Object} corps - Corps de la requête { nom_utilisateur, mot_de_passe }
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function connecter_caissier(base_de_donnees, corps, reponse) {
  const nom_utilisateur = String(corps.nom_utilisateur || '').trim().toLowerCase();
  const mot_de_passe = String(corps.mot_de_passe || '');

  if (!nom_utilisateur || !mot_de_passe) {
    return envoyer_json(reponse, 400, { erreur: 'Identifiant et mot de passe sont obligatoires' });
  }

  // Recherche de l'utilisateur par nom d'utilisateur (insensible à la casse)
  const caissier = base_de_donnees.prepare(`
    SELECT id, nom_utilisateur, nom_complet, mot_de_passe_hash, mot_de_passe_sel, actif
    FROM caissiers
    WHERE lower(nom_utilisateur) = ?
  `).get(nom_utilisateur);

  // Vérification de l'existence, du statut actif, et du mot de passe
  if (!caissier || !caissier.actif || !verifier_mot_de_passe(mot_de_passe, caissier.mot_de_passe_sel, caissier.mot_de_passe_hash)) {
    return envoyer_json(reponse, 401, { erreur: 'Identifiant ou mot de passe incorrect' });
  }

  // Succès: on renvoie un token/session basique (ici juste les infos pour le front)
  enregistrer_log(base_de_donnees, caissier.id, 'connexion', '-');

  envoyer_json(reponse, 200, {
    donnees: {
      id: caissier.id,
      nom_utilisateur: caissier.nom_utilisateur,
      nom_complet: caissier.nom_complet
    }
  });
}

/**
 * Liste tous les caissiers enregistrés dans le système.
 * Route: GET /api/caissiers
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function lister_caissiers(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT id, nom_utilisateur, nom_complet, actif, cree_le
    FROM caissiers
    ORDER BY nom_complet ASC
  `).all();

  envoyer_json(reponse, 200, { donnees: lignes });
}

/**
 * Crée un nouveau profil caissier.
 * Route: POST /api/caissiers
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {Object} corps - Payload contenant nom_utilisateur, nom_complet, mot_de_passe
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function creer_caissier(base_de_donnees, corps, reponse) {
  const nom_utilisateur = String(corps.nom_utilisateur || '').trim().toLowerCase();
  const nom_complet = String(corps.nom_complet || '').trim();
  const mot_de_passe = String(corps.mot_de_passe || '');

  // Validation basique
  if (!nom_utilisateur || !nom_complet || mot_de_passe.length < 4) {
    return envoyer_json(reponse, 400, {
      erreur: 'nom_utilisateur, nom_complet et un mot_de_passe (4 caracteres minimum) sont obligatoires'
    });
  }

  try {
    // Génère le sel et le hash pour stocker de façon sécurisée
    const { sel, hash } = hacher_mot_de_passe(mot_de_passe);
    const resultat = base_de_donnees.prepare(`
      INSERT INTO caissiers (nom_utilisateur, nom_complet, mot_de_passe_hash, mot_de_passe_sel)
      VALUES (?, ?, ?, ?)
    `).run(nom_utilisateur, nom_complet, hash, sel);

    // Log de la création du caissier (l'utilisateur connecté est passé via corps.caissier)
    enregistrer_log_par_nom(base_de_donnees, corps.caissier, 'ajout_caissier', String(resultat.lastInsertRowid));

    envoyer_json(reponse, 201, {
      donnees: { id: resultat.lastInsertRowid, nom_utilisateur, nom_complet, actif: 1 }
    });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de creer le caissier (identifiant deja utilise ?)', message: erreur.message });
  }
}

/**
 * Supprime (désactive logiquement) un caissier.
 * Route: DELETE /api/caissiers/:id
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number|string} id - L'ID du caissier
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function supprimer_caissier(base_de_donnees, id, reponse) {
  const caissier = base_de_donnees.prepare('SELECT id FROM caissiers WHERE id = ?').get(id);
  if (!caissier) {
    return envoyer_json(reponse, 404, { erreur: 'Caissier introuvable' });
  }
  // Suppression logique : on met actif à 0 pour conserver la traçabilité des paiements de ce caissier
  base_de_donnees.prepare('UPDATE caissiers SET actif = 0 WHERE id = ?').run(id);

  // Log de la suppression (le caissier_id de l'auteur est résolu via le query param)
  // Note: le frontend enverra le log via POST /api/logs car DELETE n'a pas de body

  reponse.writeHead(204, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end();
}

/**
 * Exporte la base de données après vérification du mot de passe de l'utilisateur connecté.
 * Route: POST /api/exporter-base
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {Object} corps - Body { nom_utilisateur, mot_de_passe }
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function exporter_base_de_donnees(base_de_donnees, corps, reponse) {
  const fs = require('fs');
  const { chemin_base_de_donnees } = require('../base_de_donnees/base_de_donnees');

  const nom_utilisateur = String(corps.nom_utilisateur || '').trim().toLowerCase();
  const mot_de_passe = String(corps.mot_de_passe || '');

  if (!nom_utilisateur || !mot_de_passe) {
    return envoyer_json(reponse, 400, { erreur: 'Identifiant et mot de passe requis' });
  }

  const caissier = base_de_donnees.prepare(`
    SELECT id, nom_utilisateur, nom_complet, mot_de_passe_hash, mot_de_passe_sel, actif
    FROM caissiers
    WHERE lower(nom_utilisateur) = ?
  `).get(nom_utilisateur);

  if (!caissier || !caissier.actif || !verifier_mot_de_passe(mot_de_passe, caissier.mot_de_passe_sel, caissier.mot_de_passe_hash)) {
    return envoyer_json(reponse, 401, { erreur: 'Mot de passe incorrect' });
  }

  if (!fs.existsSync(chemin_base_de_donnees)) {
    return envoyer_json(reponse, 404, { erreur: 'Fichier de base de données introuvable' });
  }

  const fichier_taille = fs.statSync(chemin_base_de_donnees).size;
  reponse.writeHead(200, {
    'Content-Type': 'application/x-sqlite3',
    'Content-Length': fichier_taille,
    'Content-Disposition': 'attachment; filename="schoolpay.sqlite"'
  });

  // Log de l'exportation de la base de données
  enregistrer_log_par_nom(base_de_donnees, nom_utilisateur, 'export_base', '-');

  const stream = fs.createReadStream(chemin_base_de_donnees);
  stream.pipe(reponse);
}

module.exports = {
  connecter_caissier,
  lister_caissiers,
  creer_caissier,
  supprimer_caissier,
  exporter_base_de_donnees
};
