function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

function lister_eleves(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT e.id, e.nom_complet, e.sexe, e.matricule, e.classe_id, c.nom AS nom_classe
    FROM eleves e
    LEFT JOIN classes c ON c.id = e.classe_id
    ORDER BY e.id DESC
  `).all();

  envoyer_json(reponse, 200, { donnees: lignes });
}

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

  const paiements = base_de_donnees.prepare(`
    SELECT id, numero_recu, categorie_frais_id, libelle, montant, devise, paye_le
    FROM paiements
    WHERE eleve_id = ?
    ORDER BY paye_le DESC
  `).all(id);
  
  const attendus = base_de_donnees.prepare(`
    SELECT f.categorie_frais_id, c.libelle, f.montant, f.devise
    FROM frais_attendus_classe f
    INNER JOIN categories_frais c ON c.id = f.categorie_frais_id
    WHERE f.classe_id = ?
  `).all(eleve.classe_id || 0);

  const soldes = attendus.map(a => {
    const paye = paiements
        .filter(p => p.categorie_frais_id === a.categorie_frais_id || p.libelle.toLowerCase() === a.libelle.toLowerCase())
        .reduce((sum, p) => sum + Number(p.montant), 0);
    return {
        categorie: a.libelle,
        attendu: Number(a.montant),
        paye: paye,
        reste: Math.max(0, Number(a.montant) - paye),
        devise: a.devise
    };
  });

  const total_paye = paiements.reduce((somme, paiement) => somme + Number(paiement.montant || 0), 0);
  const frais_total = attendus.reduce((somme, a) => somme + Number(a.montant || 0), 0);

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

function creer_eleve(base_de_donnees, corps, reponse) {
  const nom_complet = String(corps.nom_complet || '').trim();
  const sexe = String(corps.sexe || '').trim() || null;
  const classe_id = corps.classe_id ? Number(corps.classe_id) : null;
  let matricule = String(corps.matricule || '').trim() || null;

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

function modifier_eleve(base_de_donnees, id, corps, reponse) {
  const eleve = base_de_donnees.prepare('SELECT * FROM eleves WHERE id = ?').get(id);
  if (!eleve) {
    return envoyer_json(reponse, 404, { erreur: 'Eleve introuvable' });
  }

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

function supprimer_eleve(base_de_donnees, id, reponse) {
  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(id);
  if (!eleve) {
    return envoyer_json(reponse, 404, { erreur: 'Eleve introuvable' });
  }

  try {
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
