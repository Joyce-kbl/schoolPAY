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

function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

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

function obtenir_id_depuis_url(url) {
  return Number(url.pathname.split('/').pop());
}

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

async function mettre_a_jour_taux(requete, reponse) {
  const corps = await lire_corps_requete(requete);
  const taux = Number(corps.taux);
  if (!Number.isFinite(taux) || taux <= 0) {
    return envoyer_json(reponse, 400, { erreur: 'taux invalide' });
  }

  const chemin_taux = path.join(__dirname, 'donnees', 'taux.json');
  fs.writeFileSync(chemin_taux, JSON.stringify({ taux }, null, 2), 'utf8');
  envoyer_json(reponse, 200, { ok: true, taux });
}

function creer_serveur() {
  return http.createServer(async (requete, reponse) => {
    const url = new URL(requete.url, `http://${requete.headers.host}`);

    try {
      if (requete.method === 'GET' && url.pathname === '/api/sante') {
        return controleur_sante(requete, reponse);
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

      if ((requete.method === 'POST' || requete.method === 'PUT') && url.pathname === '/api/taux') {
        return mettre_a_jour_taux(requete, reponse);
      }

      if (requete.method === 'GET' && !url.pathname.startsWith('/api')) {
        return servir_fichier(url.pathname, reponse);
      }

      envoyer_json(reponse, 404, { erreur: 'Route introuvable' });
    } catch (erreur) {
      envoyer_json(reponse, 500, {
        erreur: 'Erreur interne du serveur',
        message: erreur.message
      });
    }
  });
}

function demarrer_serveur(port_a_tenter, tentatives_restantes = 3) {
  const serveur = creer_serveur();

  serveur.on('error', (erreur) => {
    if (erreur.code === 'EADDRINUSE' && tentatives_restantes > 0) {
      const port_suivant = port_a_tenter + 1;
      console.warn(`Port ${port_a_tenter} occupe, tentative sur le port ${port_suivant}...`);
      setTimeout(() => demarrer_serveur(port_suivant, tentatives_restantes - 1), 100);
      return;
    }

    if (erreur.code === 'EADDRINUSE') {
      console.error(`Erreur : le port ${port_a_tenter} est deja utilise.`);
      console.error('Verifiez si une autre instance est en cours d execution ou definissez PORT.');
      process.exit(1);
    }

    console.error('Erreur serveur non geree :', erreur);
    process.exit(1);
  });

  serveur.listen(port_a_tenter, () => {
    console.log(`Backend SchoolPAY demarre sur http://localhost:${port_a_tenter}`);
    console.log(`Base SQLite: ${chemin_base_de_donnees}`);
  });
}

demarrer_serveur(port);
