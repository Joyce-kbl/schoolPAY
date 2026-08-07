const crypto = require('crypto');
const path = require('path');
const DatabaseSync = require('better-sqlite3');

const dbPath = path.resolve('BACKEND/donnees/schoolpay.sqlite');
const db = new DatabaseSync(dbPath);
const user = 'admin';
const pass = 'admin';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(pass, salt, 64).toString('hex');

const existing = db.prepare('SELECT id FROM caissiers WHERE lower(nom_utilisateur)=?').get(user.toLowerCase());
if (existing) {
  db.prepare('UPDATE caissiers SET nom_complet=?, mot_de_passe_hash=?, mot_de_passe_sel=?, actif=1 WHERE id=?').run('Administrateur', hash, salt, existing.id);
  console.log('updated', existing.id);
} else {
  const res = db.prepare('INSERT INTO caissiers (nom_utilisateur, nom_complet, mot_de_passe_hash, mot_de_passe_sel, actif) VALUES (?, ?, ?, ?, 1)').run(user, 'Administrateur', hash, salt);
  console.log('inserted', res.lastInsertRowid);
}
db.close();
