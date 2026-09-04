function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

const ANNEE_SCOLAIRE_DEFAUT = '2026-2027';

/**
 * Récupère la situation générale des élèves par classe.
 * Filtre sur la colonne annee_scolaire de la table paiements ('2026-2027' par défaut).
 * Supporte le filtrage multi-classes via le paramètre 'classes' (ex: classes=1,2,3 ou 'all').
 */
function obtenir_situation_generale(base_de_donnees, reponse, params) {
  const classesParam = params.get('classes') || params.get('classe_id');
  const annee_scolaire_cible = (params.get('annee_scolaire') || ANNEE_SCOLAIRE_DEFAUT).trim();

  // Recherche de la catégorie "FRAIS SCOLAIRES"
  const categorie_scolaire = base_de_donnees
    .prepare("SELECT id FROM categories_frais WHERE UPPER(TRIM(libelle)) = 'FRAIS SCOLAIRES'")
    .get();

  // Filtrage dynamique multi-classes
  let clauseClasse = '';
  const valeursClasses = [];

  if (classesParam && classesParam !== 'all') {
    const ids = String(classesParam)
      .split(',')
      .map(id => Number(id.trim()))
      .filter(id => !isNaN(id) && id > 0);

    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      clauseClasse = `WHERE c.id IN (${placeholders})`;
      valeursClasses.push(...ids);
    }
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

  // Conditions de calcul des paiements : filtrage sur l'élève, la catégorie et l'année scolaire
  let conditionsPaiements = ['p.eleve_id = ?'];
  if (categorie_scolaire) {
    conditionsPaiements.push('p.categorie_frais_id = ?');
  }
  conditionsPaiements.push('p.annee_scolaire = ?');

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
      valeurs.push(annee_scolaire_cible);

      const paye = Number(requete_paye.get(...valeurs)?.total || 0);
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
      annee_scolaire: annee_scolaire_cible,
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
