const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DatabaseSync = require('better-sqlite3');

const dossier_donnees = process.env.SCHOOLPAY_DB_DIR || path.join(__dirname, '..', '..', 'donnees');
const NOM_FICHIER_BASE_PAR_DEFAUT = 'schoolpay_nathmn14.db';
const NOM_FICHIER_BASE_ALTERNATIF = 'schoolpay.sqlite';
const ANNEE_SCOLAIRE_PAR_DEFAUT = '2026-2027';

/**
 * Choisit le fichier de base de données à utiliser.
 * Utilise en priorité la base schoolpay_nathmn14.db,
 * ou bascule sur schoolpay.sqlite en solution de repli si nécessaire.
 * @returns {string} Le chemin absolu du fichier SQLite à ouvrir.
 */
function choisir_fichier_base() {
  const candidats = [
    path.join(dossier_donnees, NOM_FICHIER_BASE_PAR_DEFAUT),
    path.join(dossier_donnees, NOM_FICHIER_BASE_ALTERNATIF)
  ];
  for (const chemin of candidats) {
    if (fs.existsSync(chemin)) return chemin;
  }
  return candidats[0];
}

const chemin_base_de_donnees = choisir_fichier_base();

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
 * Vérifie si une table portant ce nom existe déjà dans la base (y compris
 * les tables issues d'un schéma alternatif).
 * @param {DatabaseSync} base_de_donnees - Instance de la base de données
 * @param {string} nom_table - Nom de la table à rechercher
 * @returns {boolean} True si la table existe
 */
function table_existe(base_de_donnees, nom_table) {
  return !!base_de_donnees
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(nom_table);
}

/**
 * Importe une base existante structurée différemment (schéma alternatif avec
 * les tables `classe`, `eleve`, `inscription`, `categorie_frais`) vers le
 * modèle applicatif de SchoolPAY. Les identifiants sources sont conservés pour
 * préserver l'intégrité référentielle. La fonction est idempotente : elle ne
 * fait rien si le modèle applicatif contient déjà les données.
 * @param {DatabaseSync} base_de_donnees - Instance de la base de données
 */
function migrer_depuis_schema_alternatif(base_de_donnees) {
  const schemas_alternatifs = ['classe', 'eleve', 'inscription', 'categorie_frais'];
  const presentes = schemas_alternatifs.filter((nom) => table_existe(base_de_donnees, nom));
  if (presentes.length === 0) return;

  console.log(`[MIGRATION] Schema alternatif detecte (${presentes.join(', ')}). Import des donnees vers le modele applicatif...`);

  // 1) Catégories de frais : copie à l'identique en conservant les IDs.
  if (table_existe(base_de_donnees, 'categorie_frais')) {
    const nb_categories = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM categories_frais').get().total;
    if (nb_categories === 0) {
      base_de_donnees.prepare(`
        INSERT OR IGNORE INTO categories_frais (id, code, libelle)
        SELECT id, CAST(code AS TEXT), libelle FROM categorie_frais
      `).run();
    }
  }

  // 2) Classes : copie avec dé-doublonnage du nom (le nom doit rester UNIQUE
  //    dans le modèle applicatif).
  if (table_existe(base_de_donnees, 'classe')) {
    const nb_classes = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM classes').get().total;
    if (nb_classes === 0) {
      // Montants des frais scolaires issus des frais attendus (si disponibles)
      const cat_scolaire_source = base_de_donnees
        .prepare("SELECT id FROM categorie_frais WHERE UPPER(TRIM(libelle)) = 'FRAIS SCOLAIRES'")
        .get();
      let montant_par_classe = {};
      if (cat_scolaire_source && table_existe(base_de_donnees, 'frais_attendus_classe')) {
        montant_par_classe = base_de_donnees.prepare(`
          SELECT classe_id, MAX(montant) AS montant
          FROM frais_attendus_classe
          WHERE categorie_frais_id = ?
          GROUP BY classe_id
        `).all(cat_scolaire_source.id)
          .reduce((acc, ligne) => { acc[Number(ligne.classe_id)] = Number(ligne.montant || 0); return acc; }, {});
      }

      const classes_source = base_de_donnees.prepare('SELECT id, nom_classe FROM classe ORDER BY id ASC').all();
      const occurrences_nom = {};
      const inserer_classe = base_de_donnees.prepare(
        'INSERT INTO classes (id, nom, montant_frais) VALUES (?, ?, ?)'
      );
      for (const c of classes_source) {
        const nom_base = String(c.nom_classe || '').trim() || 'Classe sans nom';
        occurrences_nom[nom_base] = (occurrences_nom[nom_base] || 0) + 1;
        const nom = occurrences_nom[nom_base] === 1
          ? nom_base
          : `${nom_base} ${String.fromCharCode(64 + occurrences_nom[nom_base])}`;
        inserer_classe.run(c.id, nom, montant_par_classe[Number(c.id)] || 0);
      }
      console.log(`[MIGRATION] Classes importees : ${classes_source.length}`);
    }
  }

  // 3) Élèves : fusion nom / post_nom / prénom + rattachement à la classe
  //    issue de l'inscription (priorité à l'année scolaire en cours).
  if (table_existe(base_de_donnees, 'eleve')) {
    const nb_eleves = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM eleves').get().total;
    if (nb_eleves === 0) {
      let classe_par_eleve = {};
      let statut_par_eleve = {};
      if (table_existe(base_de_donnees, 'inscription')) {
        const inscriptions = base_de_donnees.prepare(`
          SELECT i.eleve_id, i.classe_id, i.ancien_nouveau
          FROM inscription i
          LEFT JOIN annee_scolaire a ON a.id = i.annee_scolaire_id
          ORDER BY CASE WHEN a.est_encours = 1 THEN 0 ELSE 1 END, i.id ASC
        `).all();
        for (const lig of inscriptions) {
          if (!(lig.eleve_id in classe_par_eleve)) classe_par_eleve[lig.eleve_id] = lig.classe_id;
          if (!(lig.eleve_id in statut_par_eleve)) {
            const statut = String(lig.ancien_nouveau || '').trim().toUpperCase();
            if (statut === 'ANCIEN') statut_par_eleve[lig.eleve_id] = 'A';
            else if (statut === 'NOUVEAU') statut_par_eleve[lig.eleve_id] = 'N';
            else if (statut === 'A' || statut === 'N') statut_par_eleve[lig.eleve_id] = statut;
          }
        }
      }

      const prefixe_matricule = ANNEE_SCOLAIRE_PAR_DEFAUT.split('-')[0] || String(new Date().getFullYear());
      const eleves_source = base_de_donnees.prepare(
        'SELECT id, nom, post_nom, prenom, sexe FROM eleve ORDER BY id ASC'
      ).all();
      const inserer_eleve = base_de_donnees.prepare(`
        INSERT INTO eleves (id, nom_complet, sexe, ancien_nouveau, classe_id, matricule)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const e of eleves_source) {
        const nom_complet = [e.nom, e.post_nom, e.prenom]
          .map((partie) => String(partie || '').trim())
          .filter((partie) => partie && partie !== '-')
          .join(' ');
        const matricule = `${prefixe_matricule}-SP-${String(e.id).padStart(3, '0')}`;
        inserer_eleve.run(e.id, nom_complet, e.sexe, statut_par_eleve[e.id] || 'N', classe_par_eleve[e.id] ?? null, matricule);
      }
      console.log(`[MIGRATION] Eleves importes : ${eleves_source.length}`);
    }
  }

  // 4) Nettoyage : une fois les données importées, les tables du schéma
  //    alternatif sont devenues inutiles. On les supprime et on reconstruit
  //    `frais_attendus_classe` (elle référençait ces anciennes tables) avec le
  //    modèle applicatif, contrainte UNIQUE incluse pour l'UPSERT des classes.
  const nb_eleves_app = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM eleves').get().total;
  const nb_classes_app = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM classes').get().total;
  const nb_categories_app = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM categories_frais').get().total;
  const app_peuple = nb_eleves_app > 0 && nb_classes_app > 0 && nb_categories_app > 0;

  if (app_peuple) {
    base_de_donnees.exec('PRAGMA foreign_keys = OFF');
    try {
      if (table_existe(base_de_donnees, 'frais_attendus_classe')) {
        base_de_donnees.exec('BEGIN TRANSACTION');
        try {
          base_de_donnees.exec('ALTER TABLE frais_attendus_classe RENAME TO frais_attendus_classe_ancienne');
          base_de_donnees.exec(`
            CREATE TABLE frais_attendus_classe (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              classe_id INTEGER NOT NULL,
              categorie_frais_id INTEGER NOT NULL,
              montant REAL NOT NULL,
              devise TEXT NOT NULL DEFAULT 'USD',
              cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (classe_id) REFERENCES classes(id),
              FOREIGN KEY (categorie_frais_id) REFERENCES categories_frais(id),
              UNIQUE(classe_id, categorie_frais_id)
            )
          `);
          base_de_donnees.prepare(`
            INSERT INTO frais_attendus_classe (id, classe_id, categorie_frais_id, montant, devise)
            SELECT id, classe_id, categorie_frais_id, montant,
                   CASE WHEN TRIM(devise) IN ('', '-') THEN 'USD' ELSE devise END
            FROM frais_attendus_classe_ancienne
          `).run();
          base_de_donnees.exec('DROP TABLE frais_attendus_classe_ancienne');
          base_de_donnees.exec('COMMIT');
          console.log('[MIGRATION] Table frais_attendus_classe reconstruite sur le modele applicatif.');
        } catch (erreur) {
          try { base_de_donnees.exec('ROLLBACK'); } catch (_) {}
          console.error('[MIGRATION] Echec de la reconstruction de frais_attendus_classe :', erreur.message);
        }
      }

      // Suppression des tables du schéma alternatif, devenues redondantes.
      const tables_inutilisees = [
        'paiement', 'utilisateur', 'inscription', 'annee_scolaire',
        'enseignant', 'eleve', 'classe', 'categorie_frais'
      ];
      for (const nom of tables_inutilisees) {
        if (table_existe(base_de_donnees, nom)) {
          base_de_donnees.exec(`DROP TABLE IF EXISTS ${nom}`);
          console.log(`[MIGRATION] Table inutile supprimee : ${nom}`);
        }
      }
    } finally {
      base_de_donnees.exec('PRAGMA foreign_keys = ON');
    }
  } else {
    console.warn('[MIGRATION] Donnees applicatives incompletes : aucune table supprimee (securite).');
  }

  // Le contrôleur de modification de classes repose sur un UPSERT
  // (ON CONFLICT(classe_id, categorie_frais_id)).
  try {
    base_de_donnees.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_frais_attendus_classe
      ON frais_attendus_classe(classe_id, categorie_frais_id)
    `);
  } catch (erreur) {
    console.warn('[MIGRATION] Index frais_attendus_classe non creable :', erreur.message);
  }

  console.log('[MIGRATION] Import et nettoyage termines.');
}

/**
 * Repeuple la colonne `ancien_nouveau` de la table `eleves` à partir de la
 * table `inscription` qui définit si un élève est ancien ('A') ou nouveau
 * ('N') pour l'année scolaire en cours. Deux sources possibles, dans l'ordre :
 *   1. la table `inscription` encore présente dans la base elle-même
 *      (schéma alternatif non encore nettoyé) ;
 *   2. le fichier de sauvegarde `<base>.backup.db` situé à côté de la base
 *      active (sauvegarde de l'ancienne structure, qui contient `inscription`).
 * La fonction est idempotente : en mode normal, les élèves déjà renseignés ne
 * sont pas écrasés. En mode forcé (appelé uniquement juste après la création de
 * la colonne), la valeur par défaut 'N' est remplacée par le statut connu.
 * @param {DatabaseSync} base_de_donnees - Instance de la base de données
 * @param {Object} [options] - Options de migration
 * @param {boolean} [options.forcage=false] - Force l'écrasement des statuts
 */
function migrer_statut_inscription(base_de_donnees, options = {}) {
  const { forcage = false } = options;
  if (!colonne_existe(base_de_donnees, 'eleves', 'ancien_nouveau')) return;

  // Récupère, pour chaque élève, le statut le plus récent (priorité à l'année
  // scolaire en cours) ; en mode normal les élèves déjà renseignés sont saufs.
  function appliquer_statuts(statuts, nom_source) {
    const par_id = Object.create(null);
    for (const s of statuts) {
      const statut = String(s.ancien_nouveau || '').trim().toUpperCase();
      if ((statut === 'A' || statut === 'N' || statut === 'ANCIEN' || statut === 'NOUVEAU') && !(s.eleve_id in par_id)) {
        par_id[s.eleve_id] = statut === 'ANCIEN' ? 'A' : statut === 'NOUVEAU' ? 'N' : statut;
      }
    }

    const eleves = forcage
      ? base_de_donnees.prepare('SELECT id, ancien_nouveau FROM eleves').all()
      : base_de_donnees
          .prepare("SELECT id, ancien_nouveau FROM eleves WHERE TRIM(COALESCE(ancien_nouveau, '')) = ''")
          .all();
    if (eleves.length === 0) return;

    const mise_a_jour = base_de_donnees.prepare('UPDATE eleves SET ancien_nouveau = ? WHERE id = ?');
    let total = 0;
    for (const eleve of eleves) {
      const statut = par_id[eleve.id];
      if (statut && (!forcage || String(eleve.ancien_nouveau || '') !== statut)) {
        mise_a_jour.run(statut, eleve.id);
        total++;
      }
    }
    if (total > 0) {
      console.log(`[MIGRATION] Statut ancien/nouveau importe depuis ${nom_source} pour ${total} eleve(s).`);
    }
  }

  // Source 1 : la table `inscription` encore présente dans la base courante.
  if (table_existe(base_de_donnees, 'inscription')) {
    const statuts = base_de_donnees.prepare(`
      SELECT i.eleve_id, i.ancien_nouveau
      FROM inscription i
      LEFT JOIN annee_scolaire a ON a.id = i.annee_scolaire_id
      ORDER BY CASE WHEN a.est_encours = 1 THEN 0 ELSE 1 END, i.id ASC
    `).all();
    if (statuts.length) appliquer_statuts(statuts, 'inscription');
    return;
  }

  // Source 2 : la sauvegarde `<base>.backup.db` à côté de la base active.
  const chemin_backup = chemin_base_de_donnees.replace(/\.db$/i, '') + '.backup.db';
  if (!fs.existsSync(chemin_backup)) return;

  try {
    const sauvegarde = DatabaseSync(chemin_backup, { readonly: true });
    try {
      const table_inscription = sauvegarde
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'inscription'")
        .get();
      if (!table_inscription) return;
      const statuts = sauvegarde.prepare(`
        SELECT i.eleve_id, i.ancien_nouveau
        FROM inscription i
        LEFT JOIN annee_scolaire a ON a.id = i.annee_scolaire_id
        ORDER BY CASE WHEN a.est_encours = 1 THEN 0 ELSE 1 END, i.id ASC
      `).all();
      appliquer_statuts(statuts, 'schoolpay_nathmn14.backup.db');
    } finally {
      sauvegarde.close();
    }
  } catch (erreur) {
    console.warn('[MIGRATION] Impossible de lire la sauvegarde pour le statut ancien/nouveau :', erreur.message);
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
  const base_de_donnees = DatabaseSync(chemin_base_de_donnees);

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
      ancien_nouveau TEXT NOT NULL DEFAULT 'N',
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
      annee_scolaire TEXT NOT NULL DEFAULT '2026-2027',
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
      annee_scolaire TEXT NOT NULL DEFAULT '2026-2027',
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

    CREATE TABLE IF NOT EXISTS administrateurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom_utilisateur TEXT NOT NULL UNIQUE,
      nom_complet TEXT NOT NULL,
      mot_de_passe_hash TEXT NOT NULL,
      mot_de_passe_sel TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      cree_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      mis_a_jour_le TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS parametres (
      cle TEXT PRIMARY KEY,
      valeur TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      caissier_id      INTEGER NOT NULL,
      horodatage       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      action           TEXT NOT NULL CHECK (action IN (
                         'connexion', 'deconnexion', 'paiement',
                         'reimpression_recu','impression_recu', 'impression_rapport', 'impression_releve',
                         'ajout_classe', 'ajout_eleve', 'ajout_caissier',
                         'suppression_caissier', 'export_base', 'suppression_paiement', 'suppression_eleve'
                       )),
      reference_action TEXT NOT NULL DEFAULT '-',
      FOREIGN KEY (caissier_id) REFERENCES caissiers(id)
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
  if (!colonne_existe(base_de_donnees, 'paiements', 'annee_scolaire')) {
    base_de_donnees.exec(`ALTER TABLE paiements ADD COLUMN annee_scolaire TEXT DEFAULT '${ANNEE_SCOLAIRE_PAR_DEFAUT}'`);
  }
  if (!colonne_existe(base_de_donnees, 'factures', 'annee_scolaire')) {
    base_de_donnees.exec(`ALTER TABLE factures ADD COLUMN annee_scolaire TEXT DEFAULT '${ANNEE_SCOLAIRE_PAR_DEFAUT}'`);
  }

  base_de_donnees.prepare(`
    UPDATE paiements
    SET annee_scolaire = ?
    WHERE annee_scolaire IS NULL OR TRIM(annee_scolaire) = ''
  `).run(ANNEE_SCOLAIRE_PAR_DEFAUT);
  base_de_donnees.prepare(`
    UPDATE factures
    SET annee_scolaire = ?
    WHERE annee_scolaire IS NULL OR TRIM(annee_scolaire) = ''
  `).run(ANNEE_SCOLAIRE_PAR_DEFAUT);

  // Colonne « ancien / nouveau » des élèves : ajoutée une seule fois, puis
  // alimentée en mode forcé depuis l'ancienne table `inscription` (ou depuis
  // la sauvegarde `<base>.backup.db`).
  const colonne_statut_manquante = !colonne_existe(base_de_donnees, 'eleves', 'ancien_nouveau');
  if (colonne_statut_manquante) {
    base_de_donnees.exec("ALTER TABLE eleves ADD COLUMN ancien_nouveau TEXT NOT NULL DEFAULT 'N'");
    console.log('[MIGRATION] Colonne eleves.ancien_nouveau ajoutee.');
    migrer_statut_inscription(base_de_donnees, { forcage: true });
  } else {
    migrer_statut_inscription(base_de_donnees);
  }

  // Migration de la table logs pour ajouter l'action 'suppression_paiement' et 'suppression_eleve' dans le CHECK
  const schema_logs = base_de_donnees.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='logs'").get()?.sql;
  if (schema_logs && (!schema_logs.includes('suppression_paiement') || !schema_logs.includes('suppression_eleve'))) {
    try {
      base_de_donnees.exec('PRAGMA foreign_keys = OFF');
      base_de_donnees.exec('BEGIN TRANSACTION');
      base_de_donnees.exec('ALTER TABLE logs RENAME TO logs_ancienne');
      base_de_donnees.exec(`
        CREATE TABLE logs (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          caissier_id      INTEGER NOT NULL,
          horodatage       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          action           TEXT NOT NULL CHECK (action IN (
                             'connexion', 'deconnexion', 'paiement',
                             'reimpression_recu','impression_recu', 'impression_rapport', 'impression_releve',
                             'ajout_classe', 'ajout_eleve', 'ajout_caissier',
                             'suppression_caissier', 'export_base', 'suppression_paiement', 'suppression_eleve'
                           )),
          reference_action TEXT NOT NULL DEFAULT '-',
          FOREIGN KEY (caissier_id) REFERENCES caissiers(id)
        )
      `);
      base_de_donnees.exec(`
        INSERT INTO logs (id, caissier_id, horodatage, action, reference_action)
        SELECT id, caissier_id, horodatage, action, reference_action FROM logs_ancienne
      `);
      base_de_donnees.exec('DROP TABLE logs_ancienne');
      base_de_donnees.exec('COMMIT');
      base_de_donnees.exec('PRAGMA foreign_keys = ON');
      console.log('[MIGRATION] Table logs migree avec succes pour suppression_eleve.');
    } catch (e) {
      try { base_de_donnees.exec('ROLLBACK'); } catch (_) {}
      console.error('[MIGRATION] Echec de la migration de la table logs:', e.message);
    }
  }

  // Import des données d'un éventuel schéma alternatif (fichier type
  // schoolpay_nathmn14.db) vers le modèle applicatif.
  migrer_depuis_schema_alternatif(base_de_donnees);

  // Insertion de la nomenclature comptable standard
  // (ignorée si des catégories existent déjà, ex: après l'import ci-dessus).
  const nb_categories_existantes = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM categories_frais').get().total;
  if (nb_categories_existantes === 0) {
    inserer_categories_frais(base_de_donnees);
  }
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

  const admin_count = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM administrateurs').get().total;
  if (admin_count === 0) {
    const { sel, hash } = hacher_mot_de_passe('cicm@');
    base_de_donnees.prepare(`
      INSERT INTO administrateurs (nom_utilisateur, nom_complet, mot_de_passe_hash, mot_de_passe_sel)
      VALUES (?, ?, ?, ?)
    `).run('José', 'Économe Principal', hash, sel);
    console.log('[SÉCURITÉ] Administrateur par défaut initialisé avec succès.');
  }

  const classes_count = base_de_donnees.prepare('SELECT COUNT(*) AS total FROM classes').get().total;
  if (classes_count === 0) {
    const inserer_classe = base_de_donnees.prepare(
      'INSERT INTO classes (nom, montant_frais) VALUES (?, ?)'
    );
    inserer_classe.run('1ere A', 500);
    inserer_classe.run('1ere B', 500);
    inserer_classe.run('2e A', 520);
    inserer_classe.run('2e B', 520);
    inserer_classe.run('3e A', 560);
    inserer_classe.run('3e B', 520);
    inserer_classe.run('3e C', 2000);
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

  return base_de_donnees;
}

module.exports = {
  chemin_base_de_donnees,
  creer_base_de_donnees,
  ANNEE_SCOLAIRE_PAR_DEFAUT
};
