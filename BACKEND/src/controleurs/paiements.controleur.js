const { construire_numero_recu } = require('../services/recu.service');

function lister_paiements(base_de_donnees, reponse) {
  const lignes = base_de_donnees.prepare(`
    SELECT p.id, p.numero_recu, p.libelle, p.montant, p.devise, p.paye_le,
           e.nom_complet AS nom_eleve
    FROM paiements p
    INNER JOIN eleves e ON e.id = p.eleve_id
    ORDER BY p.id DESC
  `).all();

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({ donnees: lignes }));
}

function creer_paiement(base_de_donnees, corps, reponse) {
  const eleve_id = Number(corps.eleve_id);
  const libelle = String(corps.libelle || '').trim();
  const montant = Number(corps.montant);
  const devise = String(corps.devise || 'USD').toUpperCase();
  const paye_le = String(corps.paye_le || new Date().toISOString());

  if (!eleve_id || !libelle || !Number.isFinite(montant) || montant <= 0) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({
      erreur: 'eleve_id, libelle et montant positif sont obligatoires'
    }));
  }

  if (!['USD', 'CDF'].includes(devise)) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'devise invalide' }));
  }

  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve) {
    reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'eleve introuvable' }));
  }

  const insertion = base_de_donnees.prepare(`
    INSERT INTO paiements (numero_recu, eleve_id, libelle, montant, devise, paye_le)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const numero_temporaire = `TMP-${Date.now()}`;
  const resultat = insertion.run(numero_temporaire, eleve_id, libelle, montant, devise, paye_le);
  const numero_recu = construire_numero_recu(resultat.lastInsertRowid);

  base_de_donnees
    .prepare('UPDATE paiements SET numero_recu = ? WHERE id = ?')
    .run(numero_recu, resultat.lastInsertRowid);

  reponse.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({
    donnees: {
      id: resultat.lastInsertRowid,
      numero_recu,
      eleve_id,
      libelle,
      montant,
      devise,
      paye_le
    }
  }));
}

function rechercher_paiement(base_de_donnees, numero_recu, reponse) {
  const paiement = base_de_donnees.prepare(`
    SELECT p.id, p.numero_recu, p.eleve_id, p.libelle, p.montant, p.devise, p.paye_le,
           e.nom_complet AS nom_eleve
    FROM paiements p
    INNER JOIN eleves e ON e.id = p.eleve_id
    WHERE p.numero_recu = ?
  `).get(numero_recu);

  if (!paiement) {
    reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'Paiement introuvable' }));
  }

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({ donnees: paiement }));
}

function modifier_paiement(base_de_donnees, id, corps, reponse) {
  const eleve_id = corps.eleve_id ? Number(corps.eleve_id) : null;
  const libelle = String(corps.libelle || '').trim();
  const montant = Number(corps.montant);
  const devise = String(corps.devise || 'USD').toUpperCase();
  const paye_le = String(corps.paye_le || new Date().toISOString()).slice(0, 10);

  if (!eleve_id || !libelle || !Number.isFinite(montant) || montant <= 0) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'eleve_id, libelle et montant positif sont obligatoires' }));
  }

  if (!['USD', 'CDF'].includes(devise)) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'devise invalide' }));
  }

  const paiement = base_de_donnees.prepare('SELECT id FROM paiements WHERE id = ?').get(id);
  if (!paiement) {
    reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'Paiement introuvable' }));
  }

  const eleve = base_de_donnees.prepare('SELECT id FROM eleves WHERE id = ?').get(eleve_id);
  if (!eleve) {
    reponse.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'Élève introuvable' }));
  }

  base_de_donnees.prepare(`
    UPDATE paiements
    SET eleve_id = ?, libelle = ?, montant = ?, devise = ?, paye_le = ?
    WHERE id = ?
  `).run(eleve_id, libelle, montant, devise, paye_le, id);

  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({ donnees: { id, eleve_id, libelle, montant, devise, paye_le } }));
}

function supprimer_paiement(base_de_donnees, id, reponse) {
  const paiement = base_de_donnees.prepare('SELECT id FROM paiements WHERE id = ?').get(id);
  if (!paiement) {
    reponse.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    return reponse.end(JSON.stringify({ erreur: 'Paiement introuvable' }));
  }

  base_de_donnees.prepare('DELETE FROM paiements WHERE id = ?').run(id);
  reponse.writeHead(204, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end();
}

module.exports = {
  lister_paiements,
  creer_paiement,
  rechercher_paiement,
  modifier_paiement,
  supprimer_paiement
};
