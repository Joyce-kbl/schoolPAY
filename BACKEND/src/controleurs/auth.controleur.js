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

  // Validation des champs
  if (!nom_utilisateur || !nom_complet || mot_de_passe.length < 4) {
    return envoyer_json(reponse, 400, {
      erreur: 'Identifiant, nom complet et un mot de passe d\'au moins 4 caractères sont obligatoires.'
    });
  }

  // Vérification du format de l'identifiant (alphanumérique + tiret/underscore/point)
  if (!/^[a-z0-9._-]+$/i.test(nom_utilisateur)) {
    return envoyer_json(reponse, 400, {
      erreur: 'L\'identifiant ne peut contenir que des lettres, chiffres, points, tirets ou underscores sans espaces.'
    });
  }

  try {
    const { sel, hash } = hacher_mot_de_passe(mot_de_passe);

    // Vérifier si un compte avec cet identifiant existe déjà (actif ou inactif)
    const existant = base_de_donnees.prepare(`
      SELECT id, nom_utilisateur, actif
      FROM caissiers
      WHERE lower(nom_utilisateur) = ?
    `).get(nom_utilisateur);

    if (existant) {
      if (existant.actif) {
        return envoyer_json(reponse, 400, {
          erreur: 'Cet identifiant est déjà utilisé par un caissier actif.'
        });
      }

      // Réactivation du compte inactif avec mise à jour des informations
      base_de_donnees.prepare(`
        UPDATE caissiers
        SET nom_complet = ?, mot_de_passe_hash = ?, mot_de_passe_sel = ?, actif = 1
        WHERE id = ?
      `).run(nom_complet, hash, sel, existant.id);

      enregistrer_log_par_nom(base_de_donnees, corps.caissier, 'ajout_caissier', String(existant.id));

      return envoyer_json(reponse, 200, {
        donnees: { id: existant.id, nom_utilisateur, nom_complet, actif: 1, message: 'Compte réactivé avec succès.' }
      });
    }

    // Nouvelle création
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
    envoyer_json(reponse, 400, { erreur: 'Impossible d\'enregistrer le caissier.', message: erreur.message });
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
  const caissier = base_de_donnees.prepare('SELECT id, actif FROM caissiers WHERE id = ?').get(id);
  if (!caissier) {
    return envoyer_json(reponse, 404, { erreur: 'Caissier introuvable' });
  }

  if (!caissier.actif) {
    return envoyer_json(reponse, 400, { erreur: 'Ce caissier est déjà désactivé.' });
  }

  // Protection contre le lockout : vérifier qu'il reste au moins un autre caissier actif
  const totalActifs = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM caissiers WHERE actif = 1').get().total;
  if (totalActifs <= 1) {
    return envoyer_json(reponse, 400, {
      erreur: 'Impossible de retirer le seul caissier actif du système. Créez d\'abord un autre caissier.'
    });
  }

  // Suppression logique : on met actif à 0 pour conserver la traçabilité
  base_de_donnees.prepare('UPDATE caissiers SET actif = 0 WHERE id = ?').run(id);

  envoyer_json(reponse, 200, {
    succes: true,
    message: 'Caissier retiré avec succès.',
    donnees: { id: Number(id) }
  });
}

/**
 * Exporte la base de données après vérification des identifiants administrateur (Économe).
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
    return envoyer_json(reponse, 400, { erreur: 'Identifiant et mot de passe Économe requis.' });
  }

  const admins = base_de_donnees.prepare(`
    SELECT id, nom_utilisateur, nom_complet, mot_de_passe_hash, mot_de_passe_sel, actif
    FROM administrateurs
    WHERE actif = 1
  `).all();

  const admin = admins.find(a => String(a.nom_utilisateur || '').trim().toLowerCase() === nom_utilisateur);

  if (!admin || !verifier_mot_de_passe(mot_de_passe, admin.mot_de_passe_sel, admin.mot_de_passe_hash)) {
    return envoyer_json(reponse, 401, { erreur: 'Identifiant ou mot de passe Économe incorrect.' });
  }

  if (!fs.existsSync(chemin_base_de_donnees)) {
    return envoyer_json(reponse, 404, { erreur: 'Fichier de base de données introuvable.' });
  }

  const fichier_taille = fs.statSync(chemin_base_de_donnees).size;
  reponse.writeHead(200, {
    'Content-Type': 'application/x-sqlite3',
    'Content-Length': fichier_taille,
    'Content-Disposition': 'attachment; filename="schoolpay_nathmn14.db"'
  });

  // Log de l'exportation de la base de données
  enregistrer_log_par_nom(base_de_donnees, admin.nom_utilisateur, 'export_base', '-');

  const stream = fs.createReadStream(chemin_base_de_donnees);
  stream.pipe(reponse);
}

/**
 * Vérifie les identifiants administrateur/économe contre la base de données.
 * Renvoie l'objet admin si l'authentification réussit, sinon null.
 * Utilisé à la fois par verifier_admin et par les opérations sensibles (ex: modifier un élève).
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {string} nom_utilisateur - Identifiant de l'économe
 * @param {string} mot_de_passe - Mot de passe de l'économe
 * @returns {Object|null} L'administrateur authentifié ou null
 */
function verifier_identifiants_econome(base_de_donnees, nom_utilisateur, mot_de_passe) {
  const nom = String(nom_utilisateur || '').trim().toLowerCase();
  const mot_de_passe_clair = String(mot_de_passe || '');

  if (!nom || !mot_de_passe_clair) return null;

  const admins = base_de_donnees.prepare(`
    SELECT id, nom_utilisateur, nom_complet, mot_de_passe_hash, mot_de_passe_sel, actif
    FROM administrateurs
    WHERE actif = 1
  `).all();

  const admin = admins.find(a => String(a.nom_utilisateur || '').trim().toLowerCase() === nom);

  if (!admin || !verifier_mot_de_passe(mot_de_passe_clair, admin.mot_de_passe_sel, admin.mot_de_passe_hash)) {
    return null;
  }

  return admin;
}

/**
 * Vérifie les identifiants administrateur/économe contre la base de données.
 * Renvoie uniquement un statut de validation (booléen) sans jamais exposer de données sensibles.
 * Route: POST /api/auth/verifier-admin
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {Object} corps - Payload { nom_utilisateur, mot_de_passe }
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function verifier_admin(base_de_donnees, corps, reponse) {
  const nom_utilisateur = String(corps.nom_utilisateur || '').trim().toLowerCase();
  const mot_de_passe = String(corps.mot_de_passe || '');

  if (!nom_utilisateur || !mot_de_passe) {
    return envoyer_json(reponse, 400, {
      valide: false,
      erreur: 'Identifiant et mot de passe sont obligatoires.'
    });
  }

  const admin = verifier_identifiants_econome(base_de_donnees, nom_utilisateur, mot_de_passe);

  if (!admin) {
    return envoyer_json(reponse, 401, {
      valide: false,
      erreur: 'Identifiant ou mot de passe Économe incorrect.'
    });
  }

  envoyer_json(reponse, 200, {
    valide: true,
    message: 'Authentification administrateur réussie.'
  });
}

module.exports = {
  connecter_caissier,
  lister_caissiers,
  creer_caissier,
  supprimer_caissier,
  exporter_base_de_donnees,
  verifier_admin,
  verifier_identifiants_econome
};
