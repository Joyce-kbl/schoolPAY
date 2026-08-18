function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

function lister_parametres(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare('SELECT cle, valeur FROM parametres').all();
  const donnees = {};
  for (const ligne of lignes) donnees[ligne.cle] = ligne.valeur;
  envoyer_json(reponse, 200, { donnees });
}

function mettre_a_jour_parametres(base_de_donnees, corps, reponse) {
  const cles_autorisees = ['nom_ecole', 'adresse_ecole'];
  const mise_a_jour = base_de_donnees.prepare(`
    INSERT INTO parametres (cle, valeur) VALUES (?, ?)
    ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur
  `);

  const changements = {};
  for (const cle of cles_autorisees) {
    if (Object.prototype.hasOwnProperty.call(corps, cle)) {
      const valeur = String(corps[cle]).trim();

      if (valeur) {
        mise_a_jour.run(cle, valeur);
        changements[cle] = valeur;
      }
    }
  }

  envoyer_json(reponse, 200, { ok: true, donnees: changements });
}

module.exports = {
  lister_parametres,
  mettre_a_jour_parametres
};
