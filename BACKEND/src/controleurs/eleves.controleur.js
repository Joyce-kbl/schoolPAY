function lister_eleves(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT e.id, e.nom_complet, e.sexe, e.matricule, e.classe_id, c.nom AS nom_classe
    FROM eleves e
    LEFT JOIN classes c ON c.id = e.classe_id
    ORDER BY e.id DESC
  `).all();

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({ donnees: lignes }));
}

function creer_eleve(base_de_donnees, corps, reponse) {
  const nom_complet = String(corps.nom_complet || '').trim();
  const sexe = String(corps.sexe || '').trim() || null;
  const classe_id = corps.classe_id ? Number(corps.classe_id) : null;
  const matricule = String(corps.matricule || '').trim() || null;

  if (!nom_complet) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'nom_complet est obligatoire' }));
  }

  const requete = base_de_donnees.prepare(`
    INSERT INTO eleves (nom_complet, sexe, classe_id, matricule)
    VALUES (?, ?, ?, ?)
  `);
  const resultat = requete.run(nom_complet, sexe, classe_id, matricule);

  reponse.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({
    donnees: {
      id: resultat.lastInsertRowid,
      nom_complet,
      sexe,
      classe_id,
      matricule
    }
  }));
}

function modifier_eleve(base_de_donnees, id, corps, reponse) {
  const nom_complet = String(corps.nom_complet || '').trim();
  const sexe = String(corps.sexe || '').trim() || null;
  const classe_id = corps.classe_id ? Number(corps.classe_id) : null;
  const matricule = String(corps.matricule || '').trim() || null;

  if (!nom_complet) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'nom_complet est obligatoire' }));
  }

  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(id);
  if (!eleve) {
    reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'Élève introuvable' }));
  }

  if (classe_id) {
    const classe = base_de_donnees.prepare('SELECT id FROM classes WHERE id = ?').get(classe_id);
    if (!classe) {
      reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return reponse.end(JSON.stringify({ erreur: 'Classe invalide' }));
    }
  }

  const requete = base_de_donnees.prepare(`
    UPDATE eleves
    SET nom_complet = ?, sexe = ?, classe_id = ?, matricule = ?
    WHERE id = ?
  `);
  requete.run(nom_complet, sexe, classe_id, matricule, id);

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({
    donnees: {
      id,
      nom_complet,
      sexe,
      classe_id,
      matricule
    }
  }));
}

function supprimer_eleve(base_de_donnees, id, reponse) {
  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(id);
  if (!eleve) {
    reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'Élève introuvable' }));
  }

  try {
    base_de_donnees.prepare('DELETE FROM eleves WHERE id = ?').run(id);
    reponse.writeHead(204, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end();
  } catch (erreur) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end(JSON.stringify({ erreur: 'Impossible de supprimer l élève', message: erreur.message }));
  }
}

module.exports = {
  lister_eleves,
  creer_eleve,
  modifier_eleve,
  supprimer_eleve
};
