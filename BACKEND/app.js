const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  creer_base_de_donnees,
  chemin_base_de_donnees
} = require('./src/base_de_donnees/base_de_donnees');
const controleur_sante = require('./src/controleurs/sante.controleur');
const {
  lister_eleves,
  rechercher_eleves,
  obtenir_fiche_eleve,
  creer_eleve,
  modifier_eleve,
  supprimer_eleve
} = require('./src/controleurs/eleves.controleur');
const {
  lister_paiements,
  creer_paiement,
  rechercher_paiement,
  modifier_paiement,
  supprimer_paiement
} = require('./src/controleurs/paiements.controleur');
const { obtenir_journal, obtenir_journal_synthese } = require('./src/controleurs/journal.controleur');
const {
  lister_classes,
  creer_classe,
  modifier_classe,
  supprimer_classe
} = require('./src/controleurs/classes.controleur');
const {
  lister_categories_frais,
  creer_categorie_frais
} = require('./src/controleurs/categories_frais.controleur');
const {
  creer_facture,
  obtenir_facture
} = require('./src/controleurs/factures.controleur');
const {
  connecter_caissier,
  lister_caissiers,
  creer_caissier,
  supprimer_caissier
} = require('./src/controleurs/auth.controleur');
const {
  lister_parametres,
  mettre_a_jour_parametres
} = require('./src/controleurs/parametres.controleur');
const { obtenir_situation_generale } = require('./src/controleurs/rapports.controleur');

const base_de_donnees = creer_base_de_donnees();
const port = Number(process.env.PORT || 4000);
const racines_frontend = [
  path.join(__dirname, '..', 'FRONTEND', 'html'),
  path.join(__dirname, '..', 'FRONTEND')
];
const types_mime = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  txt: 'text/plain'
};

/**
 * Envoie une réponse JSON formatée au client.
 * @param {http.ServerResponse} reponse - L'objet de réponse HTTP
 * @param {number} code_statut - Le code de statut HTTP (ex: 200, 404, 500)
 * @param {Object} contenu - Les données à sérialiser en JSON
 */
function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

/**
 * Gère le routage et le service des fichiers statiques (HTML, CSS, JS, etc.)
 * Cherche dans les différents dossiers définis dans `racines_frontend`.
 * @param {string} uri - Le chemin demandé par le client
 * @param {http.ServerResponse} reponse - L'objet de réponse HTTP
 */
function servir_fichier(uri, reponse) {
  let chemin_requete = uri === '/' ? '/index.html' : decodeURIComponent(uri);
  if (chemin_requete.endsWith('/')) chemin_requete += 'index.html';
  chemin_requete = chemin_requete.replace(/^\/+/, '');

  for (const racine of racines_frontend) {
    const chemin_fichier = path.join(racine, chemin_requete);
    if (!chemin_fichier.startsWith(racine)) continue;
    if (fs.existsSync(chemin_fichier) && fs.statSync(chemin_fichier).isFile()) {
      const extension = path.extname(chemin_fichier).slice(1).toLowerCase();
      const type = types_mime[extension] || 'application/octet-stream';
      reponse.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      fs.createReadStream(chemin_fichier).pipe(reponse);
      return;
    }
  }

  envoyer_json(reponse, 404, { erreur: 'Fichier introuvable' });
}

/**
 * Lit et parse le corps d'une requête HTTP entrante.
 * Utile pour récupérer les données envoyées en méthode POST/PUT (ex: JSON payload).
 * @param {http.IncomingMessage} requete - L'objet de requête HTTP
 * @returns {Promise<Object>} Promesse résolue avec l'objet JSON parsé
 */
function lire_corps_requete(requete) {
  return new Promise((resolve, reject) => {
    let contenu_brut = '';

    requete.on('data', (fragment) => {
      contenu_brut += fragment;
      if (contenu_brut.length > 1e6) {
        reject(new Error('Corps de requete trop volumineux'));
        requete.destroy();
      }
    });

    requete.on('end', () => {
      if (!contenu_brut) return resolve({});
      try {
        resolve(JSON.parse(contenu_brut));
      } catch (erreur) {
        reject(erreur);
      }
    });

    requete.on('error', reject);
  });
}

/**
 * Extrait un identifiant (nombre) à la fin d'une URL.
 * Exemple: /api/eleves/15 -> renvoie 15
 * @param {URL} url - L'objet URL parsé
 * @returns {number} L'ID extrait
 */
function obtenir_id_depuis_url(url) {
  return Number(url.pathname.split('/').pop());
}

/**
 * Récupère les données d'un reçu spécifique pour impression.
 * Utilise une jointure pour récupérer le nom de l'élève.
 * @param {string} numero_recu - Le numéro du reçu généré (ex: R-0001)
 * @param {http.ServerResponse} reponse - L'objet de réponse HTTP
 */
function obtenir_recu(numero_recu, reponse) {
  if (!numero_recu) {
    return envoyer_json(reponse, 400, { erreur: 'numero est requis' });
  }

  const paiement = base_de_donnees.prepare(`
    SELECT p.id, p.numero_recu, p.libelle, p.montant, p.devise, p.paye_le,
           e.nom_complet AS nom_eleve, e.matricule
    FROM paiements p
    INNER JOIN eleves e ON e.id = p.eleve_id
    WHERE p.numero_recu = ?
  `).get(numero_recu);

  if (!paiement) {
    return envoyer_json(reponse, 404, { erreur: 'Recu introuvable' });
  }

  envoyer_json(reponse, 200, { donnees: paiement });
}



/**
 * Crée le serveur HTTP principal et définit le routeur API.
 * Parse chaque requête entrante et l'assigne à son contrôleur correspondant.
 * @returns {http.Server} L'instance du serveur HTTP configurée
 */
function creer_serveur() {
  return http.createServer(async (requete, reponse) => {
    // Analyse de l'URL complète pour accéder aux paramètres de requête (searchParams) et chemin (pathname)
    const url = new URL(requete.url, `http://${requete.headers.host}`);

    try {
      // ==== ROUTES DE SANTÉ ====
      if (requete.method === 'GET' && url.pathname === '/api/sante') {
        return controleur_sante(requete, reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/connexion') {
        const corps = await lire_corps_requete(requete);
        return connecter_caissier(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/caissiers') {
        return lister_caissiers(base_de_donnees, reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/caissiers') {
        const corps = await lire_corps_requete(requete);
        return creer_caissier(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/caissiers/')) {
        return supprimer_caissier(base_de_donnees, obtenir_id_depuis_url(url), reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/parametres') {
        return lister_parametres(base_de_donnees, reponse);
      }

      if ((requete.method === 'POST' || requete.method === 'PUT') && url.pathname === '/api/parametres') {
        const corps = await lire_corps_requete(requete);
        return mettre_a_jour_parametres(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/rapports/situation') {
        return obtenir_situation_generale(base_de_donnees, reponse, url.searchParams);
      }

      if (requete.method === 'GET' && url.pathname === '/api/categories-frais') {
        return lister_categories_frais(base_de_donnees, reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/categories-frais') {
        const corps = await lire_corps_requete(requete);
        return creer_categorie_frais(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/classes') {
        return lister_classes(base_de_donnees, reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/classes') {
        const corps = await lire_corps_requete(requete);
        return creer_classe(base_de_donnees, corps, reponse);
      }

      if ((requete.method === 'PUT' || requete.method === 'PATCH') && url.pathname.startsWith('/api/classes/')) {
        const corps = await lire_corps_requete(requete);
        return modifier_classe(base_de_donnees, obtenir_id_depuis_url(url), corps, reponse);
      }

      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/classes/')) {
        return supprimer_classe(base_de_donnees, obtenir_id_depuis_url(url), reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/eleves') {
        const q = url.searchParams.get('q');
        return q
          ? rechercher_eleves(base_de_donnees, q, reponse)
          : lister_eleves(base_de_donnees, reponse);
      }

      if (requete.method === 'GET' && url.pathname.startsWith('/api/eleves/') && url.pathname.endsWith('/fiche')) {
        return obtenir_fiche_eleve(base_de_donnees, Number(url.pathname.split('/')[3]), reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/eleves') {
        const corps = await lire_corps_requete(requete);
        return creer_eleve(base_de_donnees, corps, reponse);
      }

      if ((requete.method === 'PUT' || requete.method === 'PATCH') && url.pathname.startsWith('/api/eleves/')) {
        const corps = await lire_corps_requete(requete);
        return modifier_eleve(base_de_donnees, obtenir_id_depuis_url(url), corps, reponse);
      }

      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/eleves/')) {
        return supprimer_eleve(base_de_donnees, obtenir_id_depuis_url(url), reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/paiements') {
        return lister_paiements(base_de_donnees, reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/paiements') {
        const corps = await lire_corps_requete(requete);
        return creer_paiement(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'GET' && url.pathname.startsWith('/api/paiements/')) {
        const numero_recu = url.pathname.split('/').pop();
        return rechercher_paiement(base_de_donnees, numero_recu, reponse);
      }

      if ((requete.method === 'PUT' || requete.method === 'PATCH') && url.pathname.startsWith('/api/paiements/')) {
        const corps = await lire_corps_requete(requete);
        return modifier_paiement(base_de_donnees, obtenir_id_depuis_url(url), corps, reponse);
      }

      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/paiements/')) {
        return supprimer_paiement(base_de_donnees, obtenir_id_depuis_url(url), reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/journal') {
        return obtenir_journal(base_de_donnees, reponse, url.searchParams);
      }

      if (requete.method === 'GET' && url.pathname === '/api/journal/synthese') {
        return obtenir_journal_synthese(base_de_donnees, reponse, url.searchParams);
      }

      if (requete.method === 'GET' && url.pathname === '/api/recu') {
        return obtenir_recu(url.searchParams.get('numero'), reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/factures') {
        const corps = await lire_corps_requete(requete);
        return creer_facture(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'GET' && url.pathname.startsWith('/api/factures/')) {
        return obtenir_facture(base_de_donnees, url.pathname.split('/').pop(), reponse);
      }



      // ==== REDIRECTION FICHIERS STATIQUES (FRONTEND) ====
      if (requete.method === 'GET' && !url.pathname.startsWith('/api')) {
        return servir_fichier(url.pathname, reponse);
      }

      // ==== ROUTE NON TROUVÉE ====
      envoyer_json(reponse, 404, { erreur: 'Route introuvable' });
    } catch (erreur) {
      envoyer_json(reponse, 500, {
        erreur: 'Erreur interne du serveur',
        message: erreur.message
      });
    }
  });
}

/**
 * Démarre le serveur HTTP et gère les erreurs de ports occupés.
 * Essaie de démarrer sur le port par défaut, puis sur port+1 si occupé.
 * @param {number} port_a_tenter - Le port sur lequel lancer le serveur (par défaut 4000)
 * @param {number} tentatives_restantes - Le nombre d'essais restants (par défaut 3)
 */
function demarrer_serveur(port_a_tenter, tentatives_restantes = 3) {
  const serveur = creer_serveur();

  return new Promise((resolve, reject) => {
    serveur.on('error', (erreur) => {
      if (erreur.code === 'EADDRINUSE' && tentatives_restantes > 0) {
        const port_suivant = port_a_tenter + 1;
        console.warn(`Port ${port_a_tenter} occupe, tentative sur le port ${port_suivant}...`);
        demarrer_serveur(port_suivant, tentatives_restantes - 1).then(resolve, reject);
        return;
      }

      if (erreur.code === 'EADDRINUSE') {
        console.error(`Erreur : le port ${port_a_tenter} est deja utilise.`);
        console.error('Verifiez si une autre instance est en cours d execution ou definissez PORT.');
        reject(erreur);
        return;
      }

      console.error('Erreur serveur non geree :', erreur);
      reject(erreur);
    });

    serveur.listen(port_a_tenter, () => {
      console.log(`Backend SchoolPAY demarre sur http://localhost:${port_a_tenter}`);
      console.log(`Base SQLite: ${chemin_base_de_donnees}`);
      resolve({ serveur, port: port_a_tenter });
    });
  });
}

module.exports = { demarrer_serveur, creer_serveur, creer_base_de_donnees, chemin_base_de_donnees };

if (require.main === module) {
  demarrer_serveur(port);
}
