const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  creer_base_de_donnees,
  chemin_base_de_donnees
} = require('./src/base_de_donnees/base_de_donnees');
const controleur_sante = require('./src/controleurs/sante.controleur');
const { lister_eleves, creer_eleve, modifier_eleve, supprimer_eleve } = require('./src/controleurs/eleves.controleur');
const { lister_paiements, creer_paiement, rechercher_paiement, modifier_paiement, supprimer_paiement } = require('./src/controleurs/paiements.controleur');
const obtenir_journal = require('./src/controleurs/journal.controleur');
const { lister_classes, creer_classe, modifier_classe, supprimer_classe } = require('./src/controleurs/classes.controleur');

const base_de_donnees = creer_base_de_donnees();
const port = Number(process.env.PORT || 4000);
const frontend_roots = [
  path.join(__dirname, '..', 'FRONTEND', 'html'),
  path.join(__dirname, '..', 'FRONTEND')
];
const mime_types = {
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

function servir_fichier(uri, reponse) {
  let chemin_requete = uri === '/' ? '/index.html' : decodeURIComponent(uri);
  if (chemin_requete.endsWith('/')) chemin_requete += 'index.html';
  chemin_requete = chemin_requete.replace(/^\/+/, '');

  for (const racine of frontend_roots) {
    const chemin_fichier = path.join(racine, chemin_requete);
    if (!chemin_fichier.startsWith(racine)) continue;
    if (fs.existsSync(chemin_fichier) && fs.statSync(chemin_fichier).isFile()) {
      const extension = path.extname(chemin_fichier).slice(1).toLowerCase();
      const type = mime_types[extension] || 'application/octet-stream';
      reponse.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      fs.createReadStream(chemin_fichier).pipe(reponse);
      return;
    }
  }

  envoyer_json(reponse, 404, { erreur: 'Fichier introuvable' });
}

function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
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

function creer_serveur() {
  return http.createServer(async (requete, reponse) => {
    const url = new URL(requete.url, `http://${requete.headers.host}`);

    try {
      if (requete.method === 'GET' && url.pathname === '/api/sante') {
        return controleur_sante(requete, reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/eleves') {
        const q = url.searchParams.get('q');
        if (q) {
          const terme = `%${q}%`;
          const lignes = base_de_donnees.prepare(`
            SELECT e.id, e.nom_complet, e.sexe, e.matricule, e.classe_id, c.nom AS nom_classe
            FROM eleves e
            LEFT JOIN classes c ON c.id = e.classe_id
            WHERE e.nom_complet LIKE ? OR e.matricule LIKE ?
            ORDER BY e.nom_complet ASC LIMIT 20
          `).all(terme, terme);
          reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          return reponse.end(JSON.stringify({ donnees: lignes }));
        }
        return lister_eleves(base_de_donnees, reponse);
      }

      if (requete.method === 'GET' && url.pathname.startsWith('/api/eleves/') && url.pathname.endsWith('/fiche')) {
        const id = Number(url.pathname.split('/')[3]);
        const eleve = base_de_donnees.prepare(`
          SELECT e.id, e.nom_complet, e.sexe, e.matricule, c.nom AS nom_classe, c.montant_frais
          FROM eleves e LEFT JOIN classes c ON c.id = e.classe_id WHERE e.id = ?
        `).get(id);
        if (!eleve) { reponse.writeHead(404); return reponse.end(JSON.stringify({ erreur: 'Élève introuvable' })); }
        const paiements = base_de_donnees.prepare(`
          SELECT id, numero_recu, libelle, montant, devise, paye_le FROM paiements WHERE eleve_id = ? ORDER BY paye_le DESC
        `).all(id);
        const totalPaye = paiements.reduce((s, p) => s + Number(p.montant), 0);
        const fraisTotal = eleve.montant_frais || 0;
        reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return reponse.end(JSON.stringify({ donnees: { eleve, paiements, totalPaye, fraisTotal, reste: Math.max(0, fraisTotal - totalPaye) } }));
      }

      if (requete.method === 'POST' && url.pathname === '/api/eleves') {
        const corps = await lire_corps_requete(requete);
        return creer_eleve(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'PUT' && url.pathname.startsWith('/api/eleves/')) {
        const id = Number(url.pathname.split('/').pop());
        const corps = await lire_corps_requete(requete);
        return modifier_eleve(base_de_donnees, id, corps, reponse);
      }

      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/eleves/')) {
        const id = Number(url.pathname.split('/').pop());
        return supprimer_eleve(base_de_donnees, id, reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/paiements') {
        return lister_paiements(base_de_donnees, reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/paiements') {
        const corps = await lire_corps_requete(requete);
        return creer_paiement(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'GET' && url.pathname.startsWith('/api/paiements/')) {
        const numero = url.pathname.split('/').pop();
        return rechercher_paiement(base_de_donnees, numero, reponse);
      }

      if (requete.method === 'PUT' && url.pathname.startsWith('/api/paiements/')) {
        const id = Number(url.pathname.split('/').pop());
        const corps = await lire_corps_requete(requete);
        return modifier_paiement(base_de_donnees, id, corps, reponse);
      }

      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/paiements/')) {
        const id = Number(url.pathname.split('/').pop());
        return supprimer_paiement(base_de_donnees, id, reponse);
      }

      if (requete.method === 'GET' && url.pathname === '/api/journal') {
        return obtenir_journal(base_de_donnees, reponse);
      }

      // Rechercher un reçu par numéro (ex: /api/recu?numero=R-0001)
      if (requete.method === 'GET' && url.pathname === '/api/recu') {
        const numero = url.searchParams.get('numero') || '';
        if (!numero) return envoyer_json(reponse, 400, { erreur: 'numero est requis' });
        const paiement = base_de_donnees.prepare(`
          SELECT p.id, p.numero_recu, p.libelle, p.montant, p.devise, p.paye_le, e.nom_complet AS nom_eleve, e.matricule
          FROM paiements p
          INNER JOIN eleves e ON e.id = p.eleve_id
          WHERE p.numero_recu = ?
        `).get(numero);
        if (!paiement) return envoyer_json(reponse, 404, { erreur: 'Reçu introuvable' });
        return envoyer_json(reponse, 200, { donnees: paiement });
      }

      // Modifier un paiement
      if ((requete.method === 'PUT' || requete.method === 'PATCH') && url.pathname.startsWith('/api/paiements/')) {
        const id = Number(url.pathname.split('/').pop());
        const corps = await lire_corps_requete(requete);
        const p = base_de_donnees.prepare('SELECT * FROM paiements WHERE id = ?').get(id);
        if (!p) return envoyer_json(reponse, 404, { erreur: 'Paiement introuvable' });
        const { libelle = p.libelle, montant = p.montant, devise = p.devise, paye_le = p.paye_le } = corps;
        base_de_donnees.prepare('UPDATE paiements SET libelle = ?, montant = ?, devise = ?, paye_le = ? WHERE id = ?')
          .run(libelle, montant, devise, paye_le, id);
        const updated = base_de_donnees.prepare('SELECT * FROM paiements WHERE id = ?').get(id);
        return envoyer_json(reponse, 200, { donnees: updated });
      }

      // Supprimer un paiement
      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/paiements/')) {
        const id = Number(url.pathname.split('/').pop());
        const p = base_de_donnees.prepare('SELECT * FROM paiements WHERE id = ?').get(id);
        if (!p) return envoyer_json(reponse, 404, { erreur: 'Paiement introuvable' });
        base_de_donnees.prepare('DELETE FROM paiements WHERE id = ?').run(id);
        return envoyer_json(reponse, 200, { ok: true });
      }

      // Modifier une classe
      if ((requete.method === 'PUT' || requete.method === 'PATCH') && url.pathname.startsWith('/api/classes/')) {
        const id = Number(url.pathname.split('/').pop());
        const corps = await lire_corps_requete(requete);
        const c = base_de_donnees.prepare('SELECT * FROM classes WHERE id = ?').get(id);
        if (!c) return envoyer_json(reponse, 404, { erreur: 'Classe introuvable' });
        const nom = corps.nom || c.nom;
        const montant_frais = (typeof corps.montant_frais !== 'undefined') ? Number(corps.montant_frais) : c.montant_frais;
        try {
          base_de_donnees.prepare('UPDATE classes SET nom = ?, montant_frais = ? WHERE id = ?').run(nom, montant_frais, id);
          const updated = base_de_donnees.prepare('SELECT * FROM classes WHERE id = ?').get(id);
          return envoyer_json(reponse, 200, { donnees: updated });
        } catch (err) {
          return envoyer_json(reponse, 400, { erreur: 'Impossible de mettre à jour la classe', message: err.message });
        }
      }

      // Supprimer une classe
      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/classes/')) {
        const id = Number(url.pathname.split('/').pop());
        try {
          base_de_donnees.prepare('DELETE FROM classes WHERE id = ?').run(id);
          return envoyer_json(reponse, 200, { ok: true });
        } catch (err) {
          return envoyer_json(reponse, 400, { erreur: 'Impossible de supprimer la classe', message: err.message });
        }
      }

      // Modifier un élève
      if ((requete.method === 'PUT' || requete.method === 'PATCH') && url.pathname.startsWith('/api/eleves/')) {
        const id = Number(url.pathname.split('/').pop());
        const corps = await lire_corps_requete(requete);
        const e = base_de_donnees.prepare('SELECT * FROM eleves WHERE id = ?').get(id);
        if (!e) return envoyer_json(reponse, 404, { erreur: 'Élève introuvable' });
        const nom_complet = corps.nom_complet || e.nom_complet;
        const sexe = (typeof corps.sexe !== 'undefined') ? corps.sexe : e.sexe;
        const classe_id = (typeof corps.classe_id !== 'undefined') ? (corps.classe_id ? Number(corps.classe_id) : null) : e.classe_id;
        const matricule = corps.matricule || e.matricule;
        try {
          base_de_donnees.prepare('UPDATE eleves SET nom_complet = ?, sexe = ?, classe_id = ?, matricule = ? WHERE id = ?')
            .run(nom_complet, sexe, classe_id, matricule, id);
          const updated = base_de_donnees.prepare('SELECT * FROM eleves WHERE id = ?').get(id);
          return envoyer_json(reponse, 200, { donnees: updated });
        } catch (err) {
          return envoyer_json(reponse, 400, { erreur: 'Impossible de mettre à jour l\'élève', message: err.message });
        }
      }

      // Supprimer un élève (supprime aussi ses paiements)
      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/eleves/')) {
        const id = Number(url.pathname.split('/').pop());
        const e = base_de_donnees.prepare('SELECT * FROM eleves WHERE id = ?').get(id);
        if (!e) return envoyer_json(reponse, 404, { erreur: 'Élève introuvable' });
        // supprimer paiements associés
        base_de_donnees.prepare('DELETE FROM paiements WHERE eleve_id = ?').run(id);
        base_de_donnees.prepare('DELETE FROM eleves WHERE id = ?').run(id);
        return envoyer_json(reponse, 200, { ok: true });
      }

      // Mettre à jour le taux de change (stocké en fichier)
      if ((requete.method === 'POST' || requete.method === 'PUT') && url.pathname === '/api/taux') {
        try {
          const corps = await lire_corps_requete(requete);
          const taux = Number(corps.taux);
          if (!Number.isFinite(taux) || taux <= 0) return envoyer_json(reponse, 400, { erreur: 'taux invalide' });
          const tauxPath = path.join(__dirname, 'donnees', 'taux.json');
          fs.writeFileSync(tauxPath, JSON.stringify({ taux }), 'utf8');
          return envoyer_json(reponse, 200, { ok: true, taux });
        } catch (err) {
          return envoyer_json(reponse, 500, { erreur: 'Impossible de sauvegarder le taux', message: err.message });
        }
      }

      if (requete.method === 'GET' && url.pathname === '/api/classes') {
        return lister_classes(base_de_donnees, reponse);
      }

      if (requete.method === 'POST' && url.pathname === '/api/classes') {
        const corps = await lire_corps_requete(requete);
        return creer_classe(base_de_donnees, corps, reponse);
      }

      if (requete.method === 'PUT' && url.pathname.startsWith('/api/classes/')) {
        const id = Number(url.pathname.split('/').pop());
        const corps = await lire_corps_requete(requete);
        return modifier_classe(base_de_donnees, id, corps, reponse);
      }

      if (requete.method === 'DELETE' && url.pathname.startsWith('/api/classes/')) {
        const id = Number(url.pathname.split('/').pop());
        return supprimer_classe(base_de_donnees, id, reponse);
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
      console.warn(`Port ${port_a_tenter} occupé, tentative sur le port ${port_suivant}...`);
      setTimeout(() => demarrer_serveur(port_suivant, tentatives_restantes - 1), 100);
      return;
    }

    if (erreur.code === 'EADDRINUSE') {
      console.error(`Erreur : le port ${port_a_tenter} est déjà utilisé.`);
      console.error('Vérifiez si une autre instance est en cours d exécution ou définissez PORT dans les variables d environnement.');
      process.exit(1);
    }

    console.error('Erreur serveur non gérée :', erreur);
    process.exit(1);
  });

  serveur.listen(port_a_tenter, () => {
    console.log(`Backend SchoolPAY demarre sur http://localhost:${port_a_tenter}`);
    console.log(`Base SQLite: ${chemin_base_de_donnees}`);
  });
}

demarrer_serveur(port);
