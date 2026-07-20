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
 * Récupère et liste tous les élèves avec le nom de leur classe.
 * Route: GET /api/eleves
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function lister_eleves(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT e.id, e.nom_complet, e.sexe, e.matricule, e.classe_id, c.nom AS nom_classe
    FROM eleves e
    LEFT JOIN classes c ON c.id = e.classe_id
    ORDER BY e.id DESC
  `).all();

  envoyer_json(reponse, 200, { donnees: lignes });
}

/**
 * Recherche des élèves par nom complet ou matricule (auto-complétion).
 * Route: GET /api/eleves?q=terme
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {string} terme_recherche - Le terme recherché
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function rechercher_eleves(base_de_donnees, terme_recherche, reponse) {
  const terme = `%${String(terme_recherche || '').trim()}%`;
  const lignes = base_de_donnees.prepare(`
    SELECT e.id, e.nom_complet, e.sexe, e.matricule, e.classe_id, c.nom AS nom_classe
    FROM eleves e
    LEFT JOIN classes c ON c.id = e.classe_id
    WHERE e.nom_complet LIKE ? OR e.matricule LIKE ?
    ORDER BY e.nom_complet ASC
    LIMIT 20
  `).all(terme, terme);

  envoyer_json(reponse, 200, { donnees: lignes });
}

/**
 * Renvoie une "fiche" complète pour un élève (profil, paiements, soldes).
 * Calcule dynamiquement le solde en fonction des frais attendus pour sa classe.
 * Route: GET /api/eleves/:id/fiche
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number|string} id - L'ID de l'élève
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function obtenir_fiche_eleve(base_de_donnees, id, reponse) {
  const eleve = base_de_donnees.prepare(`
    SELECT e.id, e.nom_complet, e.sexe, e.matricule, e.classe_id, c.nom AS nom_classe, c.montant_frais
    FROM eleves e
    LEFT JOIN classes c ON c.id = e.classe_id
    WHERE e.id = ?
  `).get(id);

  if (!eleve) {
    return envoyer_json(reponse, 404, { erreur: 'Eleve introuvable' });
  }

  // Historique de paiements de cet élève
  const paiements = base_de_donnees.prepare(`
    SELECT id, numero_recu, categorie_frais_id, libelle, montant, devise, paye_le, caissier
    FROM paiements
    WHERE eleve_id = ?
    ORDER BY paye_le DESC
  `).all(id);
  
  // Frais que l'élève est censé payer selon la classe où il est inscrit
  const attendus = base_de_donnees.prepare(`
    SELECT f.categorie_frais_id, c.libelle, f.montant, f.devise
    FROM frais_attendus_classe f
    INNER JOIN categories_frais c ON c.id = f.categorie_frais_id
    WHERE f.classe_id = ?
  `).all(eleve.classe_id || 0);

  // Calcule le solde restant pour chaque catégorie de frais (Frais Scolaires, Inscription, etc.)
  const soldes = attendus.map(a => {
    const paye = paiements
        .filter(p => p.categorie_frais_id === a.categorie_frais_id || p.libelle.toLowerCase() === a.libelle.toLowerCase())
        .reduce((sum, p) => sum + Number(p.montant), 0);
    return {
        categorie: a.libelle,
        attendu: Number(a.montant),
        paye: paye,
        reste: Math.max(0, Number(a.montant) - paye), // Ne pas avoir de solde négatif
        devise: a.devise
    };
  });

  // Le total affiche en haut de la fiche (barre de progression) ne doit prendre en
  // compte QUE les frais scolaires (code 78000). Les frais annexes (uniformes,
  // fournitures, etc.) restent visibles dans le tableau des soldes et l'historique,
  // mais ne sont pas comptabilises dans ce total global.
  const solde_scolaire = soldes.find(s => s.categorie.toUpperCase() === 'FRAIS SCOLAIRES');
  const frais_total = solde_scolaire ? solde_scolaire.attendu : 0;
  const total_paye = solde_scolaire ? solde_scolaire.paye : 0;

  envoyer_json(reponse, 200, {
    donnees: {
      eleve,
      paiements,
      soldes,
      total_paye,
      frais_total,
      reste: Math.max(0, frais_total - total_paye)
    }
  });
}

/**
 * Crée un nouvel élève et auto-génère un matricule si aucun n'est fourni.
 * Route: POST /api/eleves
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {Object} corps - Payload { nom_complet, sexe, classe_id, matricule }
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function creer_eleve(base_de_donnees, corps, reponse) {
  const nom_complet = String(corps.nom_complet || '').trim();
  const sexe = String(corps.sexe || '').trim() || null;
  const classe_id = corps.classe_id ? Number(corps.classe_id) : null;
  let matricule = String(corps.matricule || '').trim() || null;

  // Auto-génération du matricule de type YYYY-SP-XXX
  if (!matricule) {
    const annee = new Date().getFullYear();
    const dernier_eleve = base_de_donnees.prepare(`
      SELECT matricule FROM eleves
      WHERE matricule LIKE ?
      ORDER BY id DESC LIMIT 1
    `).get(`${annee}-SP-%`);

    let prochain_numero = 1;
    if (dernier_eleve && dernier_eleve.matricule) {
      const parties = dernier_eleve.matricule.split('-');
      if (parties.length === 3) {
        prochain_numero = parseInt(parties[2], 10) + 1;
      }
    }
    matricule = `${annee}-SP-${String(prochain_numero).padStart(3, '0')}`;
  }

  if (!nom_complet) {
    return envoyer_json(reponse, 400, { erreur: 'nom_complet est obligatoire' });
  }

  if (classe_id) {
    const classe = base_de_donnees.prepare('SELECT id FROM classes WHERE id = ?').get(classe_id);
    if (!classe) return envoyer_json(reponse, 400, { erreur: 'Classe invalide' });
  }

  try {
    const requete = base_de_donnees.prepare(`
      INSERT INTO eleves (nom_complet, sexe, classe_id, matricule)
      VALUES (?, ?, ?, ?)
    `);
    const resultat = requete.run(nom_complet, sexe, classe_id, matricule);

    envoyer_json(reponse, 201, {
      donnees: {
        id: resultat.lastInsertRowid,
        nom_complet,
        sexe,
        classe_id,
        matricule
      }
    });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de creer l eleve', message: erreur.message });
  }
}

/**
 * Modifie les informations d'un élève.
 * Route: PUT/PATCH /api/eleves/:id
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number|string} id - L'ID de l'élève
 * @param {Object} corps - Payload de modification
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function modifier_eleve(base_de_donnees, id, corps, reponse) {
  const eleve = base_de_donnees.prepare('SELECT * FROM eleves WHERE id = ?').get(id);
  if (!eleve) {
    return envoyer_json(reponse, 404, { erreur: 'Eleve introuvable' });
  }

  // Fusion des anciennes données et des nouvelles
  const nom_complet = String(corps.nom_complet || eleve.nom_complet || '').trim();
  const sexe = Object.prototype.hasOwnProperty.call(corps, 'sexe')
    ? (String(corps.sexe || '').trim() || null)
    : eleve.sexe;
  const classe_id = Object.prototype.hasOwnProperty.call(corps, 'classe_id')
    ? (corps.classe_id ? Number(corps.classe_id) : null)
    : eleve.classe_id;
  const matricule = Object.prototype.hasOwnProperty.call(corps, 'matricule')
    ? (String(corps.matricule || '').trim() || null)
    : eleve.matricule;

  if (!nom_complet) {
    return envoyer_json(reponse, 400, { erreur: 'nom_complet est obligatoire' });
  }

  if (classe_id) {
    const classe = base_de_donnees.prepare('SELECT id FROM classes WHERE id = ?').get(classe_id);
    if (!classe) return envoyer_json(reponse, 400, { erreur: 'Classe invalide' });
  }

  try {
    base_de_donnees.prepare(`
      UPDATE eleves
      SET nom_complet = ?, sexe = ?, classe_id = ?, matricule = ?
      WHERE id = ?
    `).run(nom_complet, sexe, classe_id, matricule, id);

    envoyer_json(reponse, 200, {
      donnees: {
        id,
        nom_complet,
        sexe,
        classe_id,
        matricule
      }
    });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de modifier l eleve', message: erreur.message });
  }
}

/**
 * Supprime un élève et ses paiements associés en cascade manuelle.
 * Route: DELETE /api/eleves/:id
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number|string} id - L'ID de l'élève
 * @param {http.ServerResponse} reponse - La réponse HTTP
 */
function supprimer_eleve(base_de_donnees, id, reponse) {
  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(id);
  if (!eleve) {
    return envoyer_json(reponse, 404, { erreur: 'Eleve introuvable' });
  }

  try {
    // Suppression des paiements liés d'abord pour respecter l'intégrité référentielle
    base_de_donnees.prepare('DELETE FROM paiements WHERE eleve_id = ?').run(id);
    base_de_donnees.prepare('DELETE FROM eleves WHERE id = ?').run(id);
    reponse.writeHead(204, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end();
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de supprimer l eleve', message: erreur.message });
  }
}

module.exports = {
  lister_eleves,
  rechercher_eleves,
  obtenir_fiche_eleve,
  creer_eleve,
  modifier_eleve,
  supprimer_eleve
};
