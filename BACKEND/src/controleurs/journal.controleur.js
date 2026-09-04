function obtenir_journal(base_de_donnees, reponse, params) {
  let conditions = [];
  let valeurs = [];
  
  if (params && params.get('date_debut')) {
    conditions.push('p.paye_le >= ?');
    valeurs.push(params.get('date_debut'));
  }
  if (params && params.get('date_fin')) {
    conditions.push('p.paye_le <= ?');
    valeurs.push(params.get('date_fin'));
  }
  
  const categoriesParam = params && (params.get('categories') || params.get('categorie_id'));
  if (categoriesParam) {
    const ids = String(categoriesParam).split(',').map(n => Number(n.trim())).filter(n => !isNaN(n) && n > 0);
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      conditions.push(`p.categorie_frais_id IN (${placeholders})`);
      valeurs.push(...ids);
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const journal = base_de_donnees.prepare(`
    SELECT p.numero_recu, e.nom_complet AS nom_eleve, p.libelle, p.montant, p.devise, p.paye_le, p.caissier, p.deposant
    FROM paiements p
    INNER JOIN eleves e ON e.id = p.eleve_id
    ${whereClause}
    ORDER BY p.paye_le DESC, p.id DESC
  `).all(...valeurs);

  const total = journal.reduce((somme, ligne) => somme + Number(ligne.montant || 0), 0);

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({
    donnees: journal,
    total
  }));
}

function obtenir_journal_synthese(base_de_donnees, reponse, params) {
  let conditions = [];
  let valeurs = [];
  
  if (params && params.get('date_debut')) {
    conditions.push('p.paye_le >= ?');
    valeurs.push(params.get('date_debut'));
  }
  if (params && params.get('date_fin')) {
    conditions.push('p.paye_le <= ?');
    valeurs.push(params.get('date_fin'));
  }

  const categoriesParam = params && (params.get('categories') || params.get('categorie_id'));
  if (categoriesParam) {
    const ids = String(categoriesParam).split(',').map(n => Number(n.trim())).filter(n => !isNaN(n) && n > 0);
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      conditions.push(`p.categorie_frais_id IN (${placeholders})`);
      valeurs.push(...ids);
    }
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const synthese = base_de_donnees.prepare(`
    SELECT c.libelle as categorie, p.devise, SUM(p.montant) as total
    FROM paiements p
    LEFT JOIN categories_frais c ON p.categorie_frais_id = c.id
    ${whereClause}
    GROUP BY p.categorie_frais_id, p.devise
    ORDER BY c.libelle ASC
  `).all(...valeurs);

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({
    donnees: synthese
  }));
}

module.exports = { obtenir_journal, obtenir_journal_synthese };
