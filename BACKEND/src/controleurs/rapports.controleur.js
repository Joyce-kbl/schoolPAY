function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

// Annee scolaire congolaise : 1er septembre -> 30 juin.
// T1 : sept -> dec | T2 : jan -> mars | T3 : avril -> juin | Annuel : sept -> juin
function calculer_periode(periode, annee_reference) {
  const annee = Number(annee_reference) || new Date().getFullYear();
  switch (periode) {
    case 'trimestre1':
      return { debut: `${annee}-09-01`, fin: `${annee}-12-31` };
    case 'trimestre2':
      return { debut: `${annee + 1}-01-01`, fin: `${annee + 1}-03-31` };
    case 'trimestre3':
      return { debut: `${annee + 1}-04-01`, fin: `${annee + 1}-06-30` };
    case 'annuel':
      return { debut: `${annee}-09-01`, fin: `${annee + 1}-06-30` };
    default:
      return { debut: null, fin: null };
  }
}

function obtenir_situation_generale(base_de_donnees, reponse, params) {
  const classe_id = params.get('classe_id');
  const periode = params.get('periode') || 'annuel';
  const annee_reference = params.get('annee');
  const date_debut_param = params.get('date_debut');
  const date_fin_param = params.get('date_fin');

  const { debut, fin } = (date_debut_param || date_fin_param)
    ? { debut: date_debut_param || null, fin: date_fin_param || null }
    : calculer_periode(periode, annee_reference);

  const categorie_scolaire = base_de_donnees
    .prepare("SELECT id FROM categories_frais WHERE libelle = 'FRAIS SCOLAIRES'")
    .get();

  let clauseClasse = '';
  const valeursClasses = [];
  if (classe_id && classe_id !== 'all') {
    clauseClasse = 'WHERE c.id = ?';
    valeursClasses.push(Number(classe_id));
  }

  const classes = base_de_donnees.prepare(`
    SELECT c.id, c.nom, c.montant_frais
    FROM classes c
    ${clauseClasse}
    ORDER BY c.nom ASC
  `).all(...valeursClasses);

  const requete_eleves = base_de_donnees.prepare(`
    SELECT id, nom_complet, matricule
    FROM eleves
    WHERE classe_id = ?
    ORDER BY nom_complet ASC
  `);

  let conditionsPaiements = ['p.eleve_id = ?'];
  if (categorie_scolaire) {
    conditionsPaiements.push('p.categorie_frais_id = ?');
  }
  if (debut) conditionsPaiements.push('p.paye_le >= ?');
  if (fin) conditionsPaiements.push('p.paye_le <= ?');

  const requete_paye = base_de_donnees.prepare(`
    SELECT COALESCE(SUM(p.montant), 0) AS total
    FROM paiements p
    WHERE ${conditionsPaiements.join(' AND ')}
  `);

  const resultat = [];
  let grand_total_attendu = 0;
  let grand_total_paye = 0;

  for (const classe of classes) {
    const attendu_categorie = categorie_scolaire
      ? base_de_donnees.prepare(`
          SELECT montant FROM frais_attendus_classe
          WHERE classe_id = ? AND categorie_frais_id = ?
        `).get(classe.id, categorie_scolaire.id)
      : null;
    const attendu_par_eleve = Number(attendu_categorie?.montant ?? classe.montant_frais ?? 0);

    const eleves = requete_eleves.all(classe.id).map((eleve) => {
      const valeurs = [eleve.id];
      if (categorie_scolaire) valeurs.push(categorie_scolaire.id);
      if (debut) valeurs.push(debut);
      if (fin) valeurs.push(fin);
      const paye = Number(requete_paye.get(...valeurs).total || 0);
      const reste = Math.max(0, attendu_par_eleve - paye);
      grand_total_attendu += attendu_par_eleve;
      grand_total_paye += paye;
      return {
        id: eleve.id,
        nom_complet: eleve.nom_complet,
        matricule: eleve.matricule,
        attendu: attendu_par_eleve,
        paye,
        reste
      };
    });

    const sous_total = {
      attendu: eleves.reduce((s, e) => s + e.attendu, 0),
      paye: eleves.reduce((s, e) => s + e.paye, 0),
      reste: eleves.reduce((s, e) => s + e.reste, 0)
    };

    resultat.push({
      classe: { id: classe.id, nom: classe.nom },
      eleves,
      sous_total
    });
  }

  envoyer_json(reponse, 200, {
    donnees: {
      periode: { cle: periode, debut, fin },
      classes: resultat,
      grand_total: {
        attendu: grand_total_attendu,
        paye: grand_total_paye,
        reste: Math.max(0, grand_total_attendu - grand_total_paye)
      }
    }
  });
}

module.exports = { obtenir_situation_generale };
