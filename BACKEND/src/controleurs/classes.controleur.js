function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

function lister_classes(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT id, nom, montant_frais
    FROM classes
    ORDER BY nom ASC
  `).all();

  envoyer_json(reponse, 200, { donnees: lignes });
}

function creer_classe(base_de_donnees, corps, reponse) {
  const nom = String(corps.nom || '').trim();
  const montant_frais = Number(corps.montant_frais);

  if (!nom || !Number.isFinite(montant_frais) || montant_frais <= 0) {
    return envoyer_json(reponse, 400, { erreur: 'nom et montant_frais positif sont obligatoires' });
  }

  try {
    const insertion = base_de_donnees.prepare(
      'INSERT INTO classes (nom, montant_frais) VALUES (?, ?)'
    );
    const resultat = insertion.run(nom, montant_frais);

    envoyer_json(reponse, 201, {
      donnees: {
        id: resultat.lastInsertRowid,
        nom,
        montant_frais
      }
    });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de creer la classe', message: erreur.message });
  }
}

function modifier_classe(base_de_donnees, id, corps, reponse) {
  const classe = base_de_donnees.prepare('SELECT * FROM classes WHERE id = ?').get(id);
  if (!classe) {
    return envoyer_json(reponse, 404, { erreur: 'Classe introuvable' });
  }

  const nom = String(corps.nom || classe.nom || '').trim();
  const montant_frais = Object.prototype.hasOwnProperty.call(corps, 'montant_frais')
    ? Number(corps.montant_frais)
    : Number(classe.montant_frais);

  if (!nom || !Number.isFinite(montant_frais) || montant_frais <= 0) {
    return envoyer_json(reponse, 400, { erreur: 'nom et montant_frais positif sont obligatoires' });
  }

  try {
    base_de_donnees.prepare(
      'UPDATE classes SET nom = ?, montant_frais = ? WHERE id = ?'
    ).run(nom, montant_frais, id);

    envoyer_json(reponse, 200, { donnees: { id, nom, montant_frais } });
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de modifier la classe', message: erreur.message });
  }
}

function supprimer_classe(base_de_donnees, id, reponse) {
  const classe = base_de_donnees.prepare('SELECT id FROM classes WHERE id = ?').get(id);
  if (!classe) {
    return envoyer_json(reponse, 404, { erreur: 'Classe introuvable' });
  }

  try {
    base_de_donnees.prepare('DELETE FROM classes WHERE id = ?').run(id);
    reponse.writeHead(204, { 'Content-Type': 'application/json; charset=utf-8' });
    reponse.end();
  } catch (erreur) {
    envoyer_json(reponse, 400, { erreur: 'Impossible de supprimer la classe', message: erreur.message });
  }
}

module.exports = {
  lister_classes,
  creer_classe,
  modifier_classe,
  supprimer_classe
};
