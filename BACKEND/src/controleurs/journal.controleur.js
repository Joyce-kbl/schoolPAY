function obtenir_journal(base_de_donnees, reponse) {
  const journal = base_de_donnees.prepare(`
    SELECT p.numero_recu, e.nom_complet AS nom_eleve, p.libelle, p.montant, p.devise, p.paye_le
    FROM paiements p
    INNER JOIN eleves e ON e.id = p.eleve_id
    ORDER BY p.paye_le DESC, p.id DESC
  `).all();

  const total = journal.reduce((somme, ligne) => somme + Number(ligne.montant || 0), 0);

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({
    donnees: journal,
    total
  }));
}

module.exports = obtenir_journal;
