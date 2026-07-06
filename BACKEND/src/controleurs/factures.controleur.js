const { construire_numero_recu } = require('../services/recu.service');

function envoyer_json(reponse, code_statut, contenu) {
  reponse.writeHead(code_statut, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify(contenu));
}

function creer_facture(base_de_donnees, corps, reponse) {
  const eleve_id = Number(corps.eleve_id);
  const devise = String(corps.devise || 'USD').toUpperCase();
  const paye_le = String(corps.paye_le || new Date().toISOString()).slice(0, 10);
  const operations = corps.operations;

  if (!eleve_id || !Array.isArray(operations) || operations.length === 0) {
    return envoyer_json(reponse, 400, {
      erreur: 'eleve_id et un tableau operations non vide sont obligatoires'
    });
  }

  if (!['USD', 'CDF'].includes(devise)) {
    return envoyer_json(reponse, 400, { erreur: 'devise invalide' });
  }

  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve) {
    return envoyer_json(reponse, 404, { erreur: 'eleve introuvable' });
  }

  const total = operations.reduce((somme, op) => somme + Number(op.montant || 0), 0);
  if (total <= 0) {
    return envoyer_json(reponse, 400, { erreur: 'Le total de la facture doit etre positif' });
  }

  try {
    base_de_donnees.exec('BEGIN TRANSACTION');

    const inserer_facture = base_de_donnees.prepare(`
      INSERT INTO factures (numero_facture, eleve_id, total, devise, paye_le)
      VALUES (?, ?, ?, ?, ?)
    `);
    const num_tmp = `F-TMP-${Date.now()}`;
    const res_facture = inserer_facture.run(num_tmp, eleve_id, total, devise, paye_le);
    const facture_id = res_facture.lastInsertRowid;
    const numero_facture = `F-${String(facture_id).padStart(4, '0')}`;
    
    base_de_donnees.prepare('UPDATE factures SET numero_facture = ? WHERE id = ?').run(numero_facture, facture_id);

    const inserer_paiement = base_de_donnees.prepare(`
      INSERT INTO paiements (numero_recu, eleve_id, facture_id, categorie_frais_id, libelle, montant, devise, paye_le)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const categorie_frais_id = op.categorie_frais_id ? Number(op.categorie_frais_id) : null;
      let libelle = String(op.libelle || '').trim();
      const montant = Number(op.montant);

      if (categorie_frais_id) {
        const cat = base_de_donnees.prepare('SELECT libelle FROM categories_frais WHERE id = ?').get(categorie_frais_id);
        if (cat) libelle = cat.libelle;
      }
      
      const numero_recu = `${numero_facture}-${i + 1}`;
      inserer_paiement.run(numero_recu, eleve_id, facture_id, categorie_frais_id, libelle, montant, devise, paye_le);
    }

    base_de_donnees.exec('COMMIT');

    envoyer_json(reponse, 201, {
      donnees: {
        id: facture_id,
        numero_facture,
        eleve_id,
        total,
        devise,
        paye_le,
        operations
      }
    });

  } catch (err) {
    base_de_donnees.exec('ROLLBACK');
    envoyer_json(reponse, 500, { erreur: 'Erreur lors de la creation de la facture', details: err.message });
  }
}

function obtenir_facture(base_de_donnees, numero_facture, reponse) {
  const facture = base_de_donnees.prepare(`
    SELECT f.id, f.numero_facture, f.eleve_id, f.total, f.devise, f.paye_le,
           e.nom_complet AS nom_eleve, e.matricule
    FROM factures f
    INNER JOIN eleves e ON e.id = f.eleve_id
    WHERE f.numero_facture = ?
  `).get(numero_facture);

  if (!facture) {
    return envoyer_json(reponse, 404, { erreur: 'Facture introuvable' });
  }

  const operations = base_de_donnees.prepare(`
    SELECT id, numero_recu, libelle, montant
    FROM paiements
    WHERE facture_id = ?
  `).all(facture.id);

  facture.operations = operations;
  envoyer_json(reponse, 200, { donnees: facture });
}

module.exports = {
  creer_facture,
  obtenir_facture
};
