const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const dossier_donnees = path.join(__dirname, '..', '..', 'donnees');
const chemin_base_de_donnees = path.join(dossier_donnees, 'schoolpay.sqlite');

/**
 * Hache un mot de passe en utilisant l'algorithme scrypt.
 * @param {string} mot_de_passe - Le mot de passe en clair saisi par l'utilisateur
 * @param {string} [sel] - Le sel cryptographique (généré aléatoirement si non fourni)
 * @returns {Object} Objet contenant le sel et le hash généré
 */
function hacher_mot_de_passe(mot_de_passe, sel = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(mot_de_passe), sel, 64).toString('hex');
  return { sel, hash };
}

/**
 * Vérifie un mot de passe par rapport à son hash stocké en base de données.
 * @param {string} mot_de_passe - Le mot de passe en clair à vérifier
 * @param {string} sel - Le sel stocké en base
 * @param {string} hash - Le hash stocké en base
 * @returns {boolean} True si le mot de passe correspond, false sinon
 */
function verifier_mot_de_passe(mot_de_passe, sel, hash) {
  const { hash: hash_calcule } = hacher_mot_de_passe(mot_de_passe, sel);
  const bufferA = Buffer.from(hash_calcule, 'hex');
  const bufferB = Buffer.from(hash, 'hex');
  if (bufferA.length !== bufferB.length) return false;
  // Utilisation de timingSafeEqual pour se prémunir contre les attaques temporelles
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * Vérifie l'existence du dossier de base de données.
 * Si le dossier n'existe pas, il est créé récursivement.
 */
function verifier_fichier_base_de_donnees() {
  if (!fs.existsSync(dossier_donnees)) {
    fs.mkdirSync(dossier_donnees, { recursive: true });
  }
}

/**
 * Vérifie si une colonne spécifique existe déjà dans une table SQLite.
 * Utile pour exécuter des migrations de schéma sans erreur.
 * @param {DatabaseSync} base_de_donnees - Instance de la base de données SQLite
 * @param {string} table - Le nom de la table
 * @param {string} colonne - Le nom de la colonne à vérifier
 * @returns {boolean} True si la colonne existe
 */
function colonne_existe(base_de_donnees, table, colonne) {
  return base_de_donnees
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((description_colonne) => description_colonne.name === colonne);
}

/**
 * Peuple la table `categories_frais` avec des catégories de base si elles n'existent pas.
 * @param {DatabaseSync} base_de_donnees - Instance de la base de données
 */
function inserer_categories_frais(base_de_donnees) {
// ... existing categories array ...
  const categories = [
    ['78000', 'FRAIS SCOLAIRES'],
    ['78101', 'INSCRIPTION'],
    ['78102', 'FOURNITURE SCOL'],
    ['78104', 'TABLIERS'],
    ['78105', 'UNIFORMES'],
    ['78106', 'MACARON'],
    ['78107', 'PARASCOLAIRES'],
    ['78109', 'AUTRES RECETTES'],
    ['78200', 'ACTIVITES DIVERSES'],
    ['78500', 'RECETTES EXTRAORDINAIRES'],
    ['26000', 'SUSPENS FRAIS SCOLAIRE'],
    ['26001', 'SUSPENS CONFIRMATION'],
    ['26002', 'SUSPENS ACT INSCRIPTION'],
    ['26003', 'SUSPENS TABLIER'],
    ['26004', 'SUSPENS MACARON'],
    ['26005', 'SUSPENS FOURNITURES SCOL.'],
    ['26006', 'SUSPENS FRAIS ETAT'],
    ['26007', 'SUSPENS UNIFORME'],
    ['26008', 'SUSPENS ACTE D INSCRIPTION4'],
    ['26009', 'SUSPENS CONFECTION UNIFORME'],
    ['26010', 'SUSPENS CONFECTION TABLIER'],
    ['26011', 'SUSPENS DEPENSES EXERCICE AVENIR']
  ];

  const inserer_categorie = base_de_donnees.prepare(`
    INSERT OR IGNORE INTO categories_frais (code, libelle)
    VALUES (?, ?)
  `);

  for (const [code, libelle] of categories) {
    inserer_categorie.run(code, libelle);
  }
}

/**
 * Assigne les anciens paiements (libellés libres) à leur catégorie comptable correspondante.
 * S'exécute uniquement si le paiement n'a pas encore de catégorie associée.
 * @param {DatabaseSync} base_de_donnees - Instance de la base de données
 */
function synchroniser_categories_paiements(base_de_donnees) {
  const correspondances = [
    ['INSCRIPTION', '%inscription%'],
    ['FRAIS SCOLAIRES', '%minerval%'],
    ['FRAIS SCOLAIRES', '%frais%'],
    ['AUTRES RECETTES', '%cantine%']
  ];

  for (const [libelle_categorie, motif] of correspondances) {
    const categorie = base_de_donnees
      .prepare('SELECT id FROM categories_frais WHERE libelle = ?')
      .get(libelle_categorie);
    if (!categorie) continue;

    base_de_donnees.prepare(`
      UPDATE paiements
      SET categorie_frais_id = ?
      WHERE categorie_frais_id IS NULL AND lower(libelle) LIKE lower(?)
    `).run(categorie.id, motif);
  }
}

/**
 * Crée, initialise et connecte la base de données SQLite.
 * Définit la structure (tables) si elle n'existe pas et gère les migrations
 * mineures (ajout de colonnes manquantes). Injecte aussi des données par défaut.
 * @returns {DatabaseSync} L'instance de connexion à la base de données.
 */
function creer_base_de_donnees() {
  verifier_fichier_base_de_donnees();
  const base_de_donnees = new DatabaseSync(chemin_base_de_donnees);

  // Exécution du schéma principal
  base_de_donnees.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL UNIQUE,
      montant_frais REAL NOT NULL DEFAULT 0,
      cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories_frais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      libelle TEXT NOT NULL UNIQUE,
      cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS eleves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom_complet TEXT NOT NULL,
      sexe TEXT,
      classe_id INTEGER,
      matricule TEXT UNIQUE,
      cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classe_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS paiements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_recu TEXT NOT NULL UNIQUE,
      eleve_id INTEGER NOT NULL,
      libelle TEXT NOT NULL,
      montant REAL NOT NULL,
      devise TEXT NOT NULL CHECK (devise IN ('USD', 'CDF')),
      paye_le TEXT NOT NULL,
      cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (eleve_id) REFERENCES eleves(id)
    );

    CREATE TABLE IF NOT EXISTS factures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_facture TEXT NOT NULL UNIQUE,
      eleve_id INTEGER NOT NULL,
      total REAL NOT NULL,
      devise TEXT NOT NULL CHECK (devise IN ('USD', 'CDF')),
      paye_le TEXT NOT NULL,
      cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (eleve_id) REFERENCES eleves(id)
    );

    CREATE TABLE IF NOT EXISTS frais_attendus_classe (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classe_id INTEGER NOT NULL,
      categorie_frais_id INTEGER NOT NULL,
      montant REAL NOT NULL,
      devise TEXT NOT NULL DEFAULT 'USD',
      FOREIGN KEY (classe_id) REFERENCES classes(id),
      FOREIGN KEY (categorie_frais_id) REFERENCES categories_frais(id),
      UNIQUE(classe_id, categorie_frais_id)
    );

    CREATE TABLE IF NOT EXISTS caissiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom_utilisateur TEXT NOT NULL UNIQUE,
      nom_complet TEXT NOT NULL,
      mot_de_passe_hash TEXT NOT NULL,
      mot_de_passe_sel TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parametres (
      cle TEXT PRIMARY KEY,
      valeur TEXT NOT NULL
    );
  `);

  // ==== MIGRATIONS DYNAMIQUES ====
  // Permet d'ajouter des colonnes sur une ancienne version de la base
  if (!colonne_existe(base_de_donnees, 'paiements', 'categorie_frais_id')) {
    base_de_donnees.exec('ALTER TABLE paiements ADD COLUMN categorie_frais_id INTEGER');
  }
  if (!colonne_existe(base_de_donnees, 'paiements', 'facture_id')) {
    base_de_donnees.exec('ALTER TABLE paiements ADD COLUMN facture_id INTEGER REFERENCES factures(id)');
  }
  if (!colonne_existe(base_de_donnees, 'paiements', 'caissier')) {
    base_de_donnees.exec('ALTER TABLE paiements ADD COLUMN caissier TEXT');
  }
  if (!colonne_existe(base_de_donnees, 'factures', 'caissier')) {
    base_de_donnees.exec('ALTER TABLE factures ADD COLUMN caissier TEXT');
  }
  if (!colonne_existe(base_de_donnees, 'factures', 'deposant')) {
    base_de_donnees.exec('ALTER TABLE factures ADD COLUMN deposant TEXT');
  }
  if (!colonne_existe(base_de_donnees, 'paiements', 'deposant')) {
    base_de_donnees.exec('ALTER TABLE paiements ADD COLUMN deposant TEXT');
  }

  // Insertion de la nomenclature comptable standard
  inserer_categories_frais(base_de_donnees);
  // Compatibilité avec les anciennes opérations
  synchroniser_categories_paiements(base_de_donnees);

  const parametres_defaut = [
    ['nom_ecole', 'ÉCOLE MATERNELLE FATIMA'],
    ['adresse_ecole', 'Kinshasa, République Démocratique du Congo']
  ];
  const inserer_parametre = base_de_donnees.prepare(
    'INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?, ?)'
  );
  for (const [cle, valeur] of parametres_defaut) {
    inserer_parametre.run(cle, valeur);
  }

  const caissiers_count = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM caissiers').get().total;
  if (caissiers_count === 0) {
    const { sel, hash } = hacher_mot_de_passe('Joycekbl');
    base_de_donnees.prepare(`
      INSERT INTO caissiers (nom_utilisateur, nom_complet, mot_de_passe_hash, mot_de_passe_sel)
      VALUES (?, ?, ?, ?)
    `).run('sala joyce', 'Joyce Sala', hash, sel);
  }

  const classes_count = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM classes').get().total;
  if (classes_count === 0) {
    const inserer_classe = base_de_donnees.prepare(
      'INSERT INTO classes (nom, montant_frais) VALUES (?, ?)'
    );
    inserer_classe.run('1ere A', 500);
    inserer_classe.run('1ere B', 500);
    inserer_classe.run('2e A', 520);
  } else {
    const inserer_classe = base_de_donnees.prepare(
      'INSERT OR IGNORE INTO classes (nom, montant_frais) VALUES (?, ?)'
    );
    inserer_classe.run('1ere A', 500);
    inserer_classe.run('1ere B', 500);
    inserer_classe.run('2e A', 520);
    inserer_classe.run('2e B', 520);
    inserer_classe.run('3e A', 560);
    inserer_classe.run('3e B', 520);
  }

  // Garantir que chaque classe avec un montant_frais possede une ligne de frais attendus
  // (FRAIS SCOLAIRES), meme si la classe a ete ajoutee apres la premiere initialisation.
  const categorie_scolaire_sync = base_de_donnees.prepare("SELECT id FROM categories_frais WHERE libelle = 'FRAIS SCOLAIRES'").get();
  if (categorie_scolaire_sync) {
    base_de_donnees.exec(`
      INSERT OR IGNORE INTO frais_attendus_classe (classe_id, categorie_frais_id, montant)
      SELECT id, ${categorie_scolaire_sync.id}, montant_frais FROM classes WHERE montant_frais > 0
    `);
  }

  const eleves_count = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM eleves').get().total;
  if (eleves_count === 0) {
    const classe_l3 = base_de_donnees.prepare('SELECT id FROM classes WHERE nom = ?').get('L3 Informatique');
    const classe_l2 = base_de_donnees.prepare('SELECT id FROM classes WHERE nom = ?').get('L2 Informatique');
    const classe_l1 = base_de_donnees.prepare('SELECT id FROM classes WHERE nom = ?').get('L1 Informatique');
    const classe_m1 = base_de_donnees.prepare('SELECT id FROM classes WHERE nom = ?').get('M1 Gestion');
    const classe_m2 = base_de_donnees.prepare('SELECT id FROM classes WHERE nom = ?').get('M2 Gestion');

    const inserer_eleve = base_de_donnees.prepare(
      'INSERT OR IGNORE INTO eleves (nom_complet, sexe, classe_id, matricule) VALUES (?, ?, ?, ?)'
    );
    inserer_eleve.run('Joyce Sala', 'F', classe_l3?.id || null, '2026-SP-001');
    inserer_eleve.run('Doudou K.', 'M', classe_l2?.id || null, '2026-SP-002');
    inserer_eleve.run('Amina T.', 'F', classe_l1?.id || null, '2026-SP-003');
    inserer_eleve.run('Samuel N.', 'M', classe_m1?.id || null, '2026-SP-004');
    inserer_eleve.run('Mariam K.', 'F', classe_m1?.id || null, '2026-SP-005');
    inserer_eleve.run('Jean P.', 'M', classe_m2?.id || null, '2026-SP-006');
  } else if (eleves_count < 8) {
    const classe_m1 = base_de_donnees.prepare('SELECT id FROM classes WHERE nom = ?').get('M1 Gestion');
    const classe_m2 = base_de_donnees.prepare('SELECT id FROM classes WHERE nom = ?').get('M2 Gestion');
    const inserer_eleve = base_de_donnees.prepare(
      'INSERT OR IGNORE INTO eleves (nom_complet, sexe, classe_id, matricule) VALUES (?, ?, ?, ?)'
    );
    inserer_eleve.run('Samuel N.', 'M', classe_m1?.id || null, '2026-SP-004');
    inserer_eleve.run('Mariam K.', 'F', classe_m1?.id || null, '2026-SP-005');
    inserer_eleve.run('Jean P.', 'M', classe_m2?.id || null, '2026-SP-006');
  }

  const paiements_count = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM paiements').get().total;
  if (paiements_count === 0) {
    const eleve_joyce = base_de_donnees.prepare('SELECT id FROM eleves WHERE matricule = ?').get('2026-SP-001');
    const eleve_doudou = base_de_donnees.prepare('SELECT id FROM eleves WHERE matricule = ?').get('2026-SP-002');
    const eleve_samuel = base_de_donnees.prepare('SELECT id FROM eleves WHERE matricule = ?').get('2026-SP-004');

    const inserer_paiement = base_de_donnees.prepare(
      'INSERT INTO paiements (numero_recu, eleve_id, libelle, montant, devise, paye_le) VALUES (?, ?, ?, ?, ?, ?)'
    );
    inserer_paiement.run('R-0001', eleve_joyce.id, 'Minerval', 50, 'USD', '2026-07-01');
    inserer_paiement.run('R-0002', eleve_joyce.id, 'Cantine', 30, 'USD', '2026-07-02');
    inserer_paiement.run('R-0003', eleve_doudou.id, 'Inscription', 20, 'USD', '2026-07-02');
    inserer_paiement.run('R-0004', eleve_samuel?.id || null, 'Minerval', 45, 'USD', '2026-07-03');
    inserer_paiement.run('R-0005', eleve_samuel?.id || null, 'Cantine', 25, 'USD', '2026-07-04');
  } else if (paiements_count < 8) {
    const eleve_joyce = base_de_donnees.prepare('SELECT id FROM eleves WHERE matricule = ?').get('2026-SP-001');
    const eleve_doudou = base_de_donnees.prepare('SELECT id FROM eleves WHERE matricule = ?').get('2026-SP-002');
    const eleve_samuel = base_de_donnees.prepare('SELECT id FROM eleves WHERE matricule = ?').get('2026-SP-004');
    const inserer_paiement = base_de_donnees.prepare(
      'INSERT OR IGNORE INTO paiements (numero_recu, eleve_id, libelle, montant, devise, paye_le) VALUES (?, ?, ?, ?, ?, ?)'
    );
    inserer_paiement.run('R-0004', eleve_samuel?.id || null, 'Minerval', 45, 'USD', '2026-07-03');
    inserer_paiement.run('R-0005', eleve_samuel?.id || null, 'Cantine', 25, 'USD', '2026-07-04');
    inserer_paiement.run('R-0006', eleve_doudou?.id || null, 'Inscription', 35, 'USD', '2026-07-05');
  }

  return base_de_donnees;
}

module.exports = {
  chemin_base_de_donnees,
  creer_base_de_donnees
};
