const DatabaseSync = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dossier_donnees = path.join(__dirname, '..', 'BACKEND', 'donnees');
const chemin_base = path.join(dossier_donnees, 'schoolpay.sqlite');

const base_de_donnees = DatabaseSync(chemin_base);
base_de_donnees.exec('PRAGMA foreign_keys = ON;');

console.log('--- TEST DES LOGS ---');

// Récupération de l'ID du caissier de test "sala joyce"
const caissier = base_de_donnees.prepare("SELECT id FROM caissiers WHERE nom_utilisateur = 'sala joyce'").get();
if (!caissier) {
  console.error("Erreur: Le caissier de test 'sala joyce' n'existe pas.");
  process.exit(1);
}
const caissier_id = caissier.id;

// Nettoyage des anciens logs de test s'il y en a
base_de_donnees.prepare("DELETE FROM logs WHERE action IN ('connexion', 'deconnexion', 'paiement', 'impression_recu', 'impression_rapport', 'impression_releve', 'ajout_classe', 'ajout_eleve', 'ajout_caissier', 'suppression_caissier', 'export_base')").run();

// Insertion de logs de test pour chaque action possible
const insertLog = base_de_donnees.prepare(`
  INSERT INTO logs (caissier_id, action, reference_action)
  VALUES (?, ?, ?)
`);

const actions_tests = [
  ['connexion', '-'],
  ['deconnexion', '-'],
  ['paiement', '101'],
  ['impression_recu', 'R-0027'],
  ['impression_rapport', 'situation_trimestre1'],
  ['impression_releve', '2'],
  ['ajout_classe', '4'],
  ['ajout_eleve', '15'],
  ['ajout_caissier', '3'],
  ['suppression_caissier', '3'],
  ['export_base', '-']
];

console.log("Insertion des logs d'audit de test...");
for (const [action, ref] of actions_tests) {
  insertLog.run(caissier_id, action, ref);
}

// Lecture et affichage des logs insérés
console.log("\nLecture des logs enregistrés :");
const logs = base_de_donnees.prepare(`
  SELECT l.id, l.horodatage, l.action, l.reference_action, c.nom_complet
  FROM logs l
  INNER JOIN caissiers c ON c.id = l.caissier_id
  ORDER BY l.id ASC
`).all();

console.table(logs);

console.log('\nValidation de la contrainte CHECK sur l\'action :');
try {
  // Test d'une action non autorisée par le CHECK constraint
  insertLog.run(caissier_id, 'action_non_valide', '-');
  console.error('ERREUR : Contrainte CHECK non respectée ! L\'action invalide a été insérée.');
} catch (e) {
  console.log('SUCCÈS : L\'action non autorisée a bien été rejetée (Constraint Check OK) : ', e.message);
}

base_de_donnees.close();
console.log('--- TEST TERMINÉ ---');
