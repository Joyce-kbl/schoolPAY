function lister_classes(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT id, nom, montant_frais
    FROM classes
    ORDER BY nom ASC
  `).all();

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({ donnees: lignes }));
}

function creer_classe(base_de_donnees, corps, reponse) {
  const nom = String(corps.nom || '').trim();
  const montant_frais = Number(corps.montant_frais);

  if (!nom || !Number.isFinite(montant_frais) || montant_frais <= 0) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'nom et montant_frais positif sont obligatoires' }));
  }

  try {
    const insertion = base_de_donnees.prepare(
      'INSERT INTO classes (nom, montant_frais) VALUES (?, ?)'
    );
    const resultat = insertion.run(nom, montant_frais);

    reponse.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end(JSON.stringify({
      donnees: {
        id: resultat.lastInsertRowid,
        nom,
        montant_frais
      }
    }));
  } catch (erreur) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end(JSON.stringify({ erreur: 'Impossible de créer la classe', message: erreur.message }));
  }
}

function modifier_classe(base_de_donnees, id, corps, reponse) {
  const nom = String(corps.nom || '').trim();
  const montant_frais = Number(corps.montant_frais);

  if (!nom || !Number.isFinite(montant_frais) || montant_frais <= 0) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'nom et montant_frais positif sont obligatoires' }));
  }

  const classe = base_de_donnees.prepare('SELECT id FROM classes WHERE id = ?').get(id);
  if (!classe) {
    reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'Classe introuvable' }));
  }

  try {
    base_de_donnees.prepare(
      'UPDATE classes SET nom = ?, montant_frais = ? WHERE id = ?'
    ).run(nom, montant_frais, id);

    reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end(JSON.stringify({ donnees: { id, nom, montant_frais } }));
  } catch (erreur) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end(JSON.stringify({ erreur: 'Impossible de modifier la classe', message: erreur.message }));
  }
}

function supprimer_classe(base_de_donnees, id, reponse) {
  const classe = base_de_donnees.prepare('SELECT id FROM classes WHERE id = ?').get(id);
  if (!classe) {
    reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'Classe introuvable' }));
  }

  try {
    base_de_donnees.prepare('DELETE FROM classes WHERE id = ?').run(id);
    reponse.writeHead(204, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end();
  } catch (erreur) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end(JSON.stringify({ erreur: 'Impossible de supprimer la classe', message: erreur.message }));
  }
}

module.exports = {
  lister_classes,
  creer_classe,
  modifier_classe,
  supprimer_classe
};
