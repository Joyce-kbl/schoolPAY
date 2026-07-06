function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

function lister_categories_frais(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT id, code, libelle
    FROM categories_frais
    ORDER BY code ASC
  `).all();

  envoyer_json(reponse, 200, { donnees: lignes });
}

function creer_categorie_frais(base_de_donnees, corps, reponse) {
  const code = String(corps.code || '').trim();
  const libelle = String(corps.libelle || '').trim().toUpperCase();

  if (!code || !libelle) {
    return envoyer_json(reponse, 400, { erreur: 'code et libelle sont obligatoires' });
  }

  try {
    const resultat = base_de_donnees.prepare(`
      INSERT INTO categories_frais (code, libelle)
      VALUES (?, ?)
    `).run(code, libelle);

    envoyer_json(reponse, 201, {
      donnees: {
        id: resultat.lastInsertRowid,
        code,
        libelle
      }
    });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de creer la categorie', message: erreur.message });
  }
}

module.exports = {
  lister_categories_frais,
  creer_categorie_frais
};
