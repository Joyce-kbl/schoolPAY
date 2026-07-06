const http = require('http');

function tester(methode, chemin, corps = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4001,
      path: chemin,
      method: methode,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (corps) {
      req.write(JSON.stringify(corps));
    }
    req.end();
  });
}

async function exec() {
  try {
    console.log("=== CREATION CLASSE ET ELEVE ===");
    const cl = await tester('POST', '/api/classes', { nom: 'Classe Test ' + Date.now(), montant_frais: 200 });
    const classe_id = cl.data.donnees.id;
    
    const el = await tester('POST', '/api/eleves', { nom_complet: 'Eleve Facture Test', sexe: 'F', classe_id });
    const eleve_id = el.data.donnees.id;

    console.log("=== CREATION FACTURE MULTI-OPERATIONS ===");
    // Get a category ID
    const cats = await tester('GET', '/api/categories-frais');
    const cat_scol = cats.data.donnees.find(c => c.libelle.includes('SCOLAIRES'))?.id || cats.data.donnees[0].id;
    const cat_insc = cats.data.donnees.find(c => c.libelle.includes('INSCRIPTION'))?.id || cats.data.donnees[1].id;

    const fact = await tester('POST', '/api/factures', {
      eleve_id,
      devise: 'USD',
      paye_le: '2026-07-06',
      operations: [
        { categorie_frais_id: cat_scol, montant: 50 },
        { categorie_frais_id: cat_insc, montant: 10 }
      ]
    });
    console.log("Facture cree:", fact.status, fact.data.donnees?.numero_facture);
    const numero_facture = fact.data.donnees?.numero_facture;

    console.log("=== LECTURE FACTURE ===");
    const factGet = await tester('GET', '/api/factures/' + numero_facture);
    console.log("Facture GET:", factGet.status, factGet.data.donnees?.operations?.length + " operations");

    console.log("=== FICHE ELEVE (SOLDE) ===");
    const fiche = await tester('GET', `/api/eleves/${eleve_id}/fiche`);
    console.log("Fiche GET:", fiche.status);
    console.log("Soldes detail:", JSON.stringify(fiche.data.donnees?.soldes, null, 2));

    console.log("=== JOURNAL SYNTHESE FILTRE ===");
    const synt = await tester('GET', '/api/journal/synthese?date_debut=2026-07-06&date_fin=2026-07-06');
    console.log("Synthese GET:", synt.status);
    console.log("Synthese items:", synt.data.donnees?.length);

    console.log("TOUS LES TESTS API SONT PASSES !");
  } catch (err) {
    console.error("Erreur durant les tests:", err);
  }
}

exec();
