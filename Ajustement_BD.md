# 📋 Review des Ajustements — Base de Données & Encodage
**Session du 30 Août 2026 — SchoolPay**

---

## 🗺️ Résumé Exécutif

Cette session a couvert deux objectifs distincts :

1. **Migration de la base de données** : L'application Electron utilise désormais strictement `schoolpay_nathmn14.db` comme base de données principale (en développement et dans l'exécutable packagé `.exe`).
2. **Correction d'encodage** : 10 noms d'élèves présentant le caractère de remplacement Unicode `\uFFFD` (hexadécimal `EF BF BD`) ont été restaurés avec leurs accents corrects dans `schoolpay_nathmn14.db`.

---

## PARTIE 1 — Scripts d'Audit & de Correction

### 📜 Script 1 : `scan_corrupted_only.js` — Identification des Enregistrements Corrompus

Ce script a servi à identifier avec précision les 10 élèves touchés par l'anomalie d'encodage.

```javascript
const { DatabaseSync } = require('node:sqlite');
const dbPath = 'C:\\Users\\Jean-Charles\\Documents\\Programmation\\schoolPAY\\BACKEND\\donnees\\schoolpay_nathmn14.db';
const db = new DatabaseSync(dbPath);

const eleves = db.prepare(`
  SELECT e.id, e.nom_complet, e.matricule, e.classe_id, c.nom as nom_classe
  FROM eleves e
  LEFT JOIN classes c ON c.id = e.classe_id
  ORDER BY e.id ASC
`).all();

const corrompus = [];

for (const el of eleves) {
  const nom = el.nom_complet || '';
  const buf = Buffer.from(nom, 'utf8');
  
  // Détecte le caractère de remplacement Unicode EF BF BD (\uFFFD)
  const hasUfffd = nom.includes('\uFFFD') || buf.includes(Buffer.from([0xef, 0xbf, 0xbd]));

  if (hasUfffd) {
    corrompus.push({
      id: el.id,
      classe: el.nom_classe,
      matricule: el.matricule,
      nom_actuel: el.nom_complet,
      hex: buf.toString('hex')
    });
  }
}

console.log(`\n=== NOMBRE TOTAL D'ÉLÈVES TOUCHÉS : ${corrompus.length} ===\n`);
console.log(JSON.stringify(corrompus, null, 2));
```

**Résultat d'exécution :** 10 élèves touchés identifiés.

---

### 📜 Script 2 : `scan_all_tables.js` — Vérification des Autres Tables

Ce script a vérifié que la corruption ne concernait **que** la table `eleves`.

```javascript
const { DatabaseSync } = require('node:sqlite');
const dbPath = 'C:\\Users\\Jean-Charles\\Documents\\Programmation\\schoolPAY\\BACKEND\\donnees\\schoolpay_nathmn14.db';
const db = new DatabaseSync(dbPath);

const tables = ['classes', 'categories_frais', 'caissiers', 'factures', 'paiements', 'parametres'];

for (const table of tables) {
  try {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    let count = 0;
    rows.forEach(r => {
      for (const [key, val] of Object.entries(r)) {
        if (typeof val === 'string') {
          const buf = Buffer.from(val, 'utf8');
          if (val.includes('\uFFFD') || buf.includes(Buffer.from([0xef, 0xbf, 0xbd]))) {
            console.log(`Table ${table} [ID: ${r.id}] Col ${key}: "${val}"`);
            count++;
          }
        }
      }
    });
    if (count === 0) console.log(`Table ${table}: 0 corruption détectée.`);
  } catch (e) {
    console.log(`Table ${table}: ${e.message}`);
  }
}
```

**Résultat :** Toutes les autres tables sont **100% saines**.

---

### 📜 Script 3 : `apply_corrections.js` — Correction Sécurisée en Base

Ce script a effectué une sauvegarde, appliqué les corrections dans une transaction atomique, puis validé le résultat.

```javascript
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const dbPath = 'C:\\Users\\Jean-Charles\\Documents\\Programmation\\schoolPAY\\BACKEND\\donnees\\schoolpay_nathmn14.db';
const backupPath = 'C:\\Users\\Jean-Charles\\Documents\\Programmation\\schoolPAY\\BACKEND\\donnees\\schoolpay_nathmn14.backup_pre_fix.db';

// 1. Sauvegarde de sécurité
fs.copyFileSync(dbPath, backupPath);

// 2. Application des corrections
const db = new DatabaseSync(dbPath);
const corrections = [
  { id: 114, nom: 'MUZANGU YESHAN GAÏUS' },
  { id: 165, nom: 'SALUMU NEHEMA LOÏC' },
  { id: 225, nom: 'KAKINA MASUMBU AARON LOÏS' },
  { id: 258, nom: 'BOTENDI ETUMBASE ASAËL' },
  { id: 259, nom: 'EMELEMEKIA MOKONZIANDRO ANAÏS' },
  { id: 263, nom: 'MABINGO BAHATI ABIGAÏLLE' },
  { id: 285, nom: 'DELILA BAHATI DAÏMA' },
  { id: 290, nom: 'MAKANDA LUSAKUMUNU VICTOR ISRAËL' },
  { id: 295, nom: 'NSALANGA JULIENNE ANAÏS' },
  { id: 300, nom: 'NZIGIRI BYAMUNGU MAÏSSA' }
];

db.exec('BEGIN TRANSACTION');
const updateStmt = db.prepare('UPDATE eleves SET nom_complet = ? WHERE id = ?');
for (const c of corrections) updateStmt.run(c.nom, c.id);
db.exec('COMMIT');

// 3. Contrôle final
const encoreCorrompus = db.prepare('SELECT id, nom_complet FROM eleves').all()
  .filter(e => Buffer.from(e.nom_complet || '', 'utf8').includes(Buffer.from([0xef, 0xbf, 0xbd])));

console.log(`Corruptions restantes : ${encoreCorrompus.length}`);
// → 0 ✅
```

---

## PARTIE 2 — Tableau de Correction des Noms d'Élèves (Base de données)

**Fichier modifié :** `BACKEND/donnees/schoolpay_nathmn14.db` — Table `eleves`
**Sauvegarde créée :** `BACKEND/donnees/schoolpay_nathmn14.backup_pre_fix.db`

**SQL appliqué :**

```sql
BEGIN TRANSACTION;

UPDATE eleves SET nom_complet = 'MUZANGU YESHAN GAÏUS'              WHERE id = 114;
UPDATE eleves SET nom_complet = 'SALUMU NEHEMA LOÏC'                WHERE id = 165;
UPDATE eleves SET nom_complet = 'KAKINA MASUMBU AARON LOÏS'         WHERE id = 225;
UPDATE eleves SET nom_complet = 'BOTENDI ETUMBASE ASAËL'            WHERE id = 258;
UPDATE eleves SET nom_complet = 'EMELEMEKIA MOKONZIANDRO ANAÏS'     WHERE id = 259;
UPDATE eleves SET nom_complet = 'MABINGO BAHATI ABIGAÏLLE'          WHERE id = 263;
UPDATE eleves SET nom_complet = 'DELILA BAHATI DAÏMA'               WHERE id = 285;
UPDATE eleves SET nom_complet = 'MAKANDA LUSAKUMUNU VICTOR ISRAËL'  WHERE id = 290;
UPDATE eleves SET nom_complet = 'NSALANGA JULIENNE ANAÏS'           WHERE id = 295;
UPDATE eleves SET nom_complet = 'NZIGIRI BYAMUNGU MAÏSSA'           WHERE id = 300;

COMMIT;
```

| ID  | Classe             | Matricule    | AVANT (Corrompu)                   | APRES (Corrigé)                    | Lettre |
|:---:|:-------------------|:-------------|:-----------------------------------|:-----------------------------------|:------:|
| 114 | 3eme maternelle C  | 2026-SP-114  | MUZANGU YESHAN GA[?]US             | MUZANGU YESHAN GAÏUS               | Ï      |
| 165 | 2eme maternelle A  | 2026-SP-165  | SALUMU NEHEMA LO[?]C               | SALUMU NEHEMA LOÏC                 | Ï      |
| 225 | 2eme maternelle C  | 2026-SP-225  | KAKINA MASUMBU AARON LO[?]S        | KAKINA MASUMBU AARON LOÏS          | Ï      |
| 258 | 1ere maternelle A  | 2026-SP-258  | BOTENDI ETUMBASE ASA[?]L           | BOTENDI ETUMBASE ASAËL             | Ë      |
| 259 | 1ere maternelle A  | 2026-SP-259  | EMELEMEKIA MOKONZIANDRO ANA[?]S    | EMELEMEKIA MOKONZIANDRO ANAÏS      | Ï      |
| 263 | 1ere maternelle A  | 2026-SP-263  | MABINGO BAHATI ABIGA[?]LLE         | MABINGO BAHATI ABIGAÏLLE           | Ï      |
| 285 | 1ere maternelle B  | 2026-SP-285  | DELILA BAHATI DA[?]MA              | DELILA BAHATI DAÏMA                | Ï      |
| 290 | 1ere maternelle B  | 2026-SP-290  | MAKANDA LUSAKUMUNU VICTOR ISRA[?]L | MAKANDA LUSAKUMUNU VICTOR ISRAËL   | Ë      |
| 295 | 1ere maternelle B  | 2026-SP-295  | NSALANGA JULIENNE ANA[?]S          | NSALANGA JULIENNE ANAÏS            | Ï      |
| 300 | 1ere maternelle B  | 2026-SP-300  | NZIGIRI BYAMUNGU MA[?]SSA          | NZIGIRI BYAMUNGU MAÏSSA            | Ï      |

*([?] représente le caractère de remplacement Unicode U+FFFD, hex : EF BF BD)*

---

## PARTIE 3 — Modifications des Fichiers Source

### 📄 Fichier 1 : `BACKEND/src/base_de_donnees/base_de_donnees.js`

**Lignes modifiées :** L7, L8, L13–L15  
**Objectif :** Définir `schoolpay_nathmn14.db` comme base principale (priorité 1).

```diff
  const dossier_donnees = process.env.SCHOOLPAY_DB_DIR || path.join(__dirname, '..', '..', 'donnees');
- const NOM_FICHIER_BASE_PAR_DEFAUT = 'schoolpay.sqlite';
- const NOM_FICHIER_BASE_ALTERNATIF = 'schoolpay_nathmn14.db';
+ const NOM_FICHIER_BASE_PAR_DEFAUT = 'schoolpay_nathmn14.db';
+ const NOM_FICHIER_BASE_ALTERNATIF = 'schoolpay.sqlite';
  const ANNEE_SCOLAIRE_PAR_DEFAUT = '2026-2027';

  /**
   * Choisit le fichier de base de données à utiliser.
-  * Préfère la base native de l'application (schoolpay.sqlite) si elle existe,
-  * sinon bascule automatiquement sur un fichier alternatif déjà présent dans
-  * le dossier (ex: schoolpay_nathmn14.db, récupéré d'un autre poste).
+  * Utilise en priorité la base schoolpay_nathmn14.db,
+  * ou bascule sur schoolpay.sqlite en solution de repli si nécessaire.
   * @returns {string} Le chemin absolu du fichier SQLite à ouvrir.
   */
```

---

### 📄 Fichier 2 : `electron/main.js`

**Ligne modifiée :** L300  
**Objectif :** Copier la DB source sous le bon nom dans le répertoire userData au premier lancement de l'exécutable.

```diff
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

-   const dbCible = path.join(dbDir, 'schoolpay.sqlite');
+   const dbCible = path.join(dbDir, 'schoolpay_nathmn14.db');
    const dbSource = path.join(racine(), 'BACKEND', 'donnees', 'schoolpay_nathmn14.db');
    if (!fs.existsSync(dbCible) && fs.existsSync(dbSource)) {
      fs.copyFileSync(dbSource, dbCible);
```

---

### 📄 Fichier 3 : `BACKEND/src/controleurs/auth.controleur.js`

**Ligne modifiée :** L241  
**Objectif :** L'exportation admin télécharge le fichier sous le nom correct.

```diff
  reponse.writeHead(200, {
    'Content-Type': 'application/x-sqlite3',
    'Content-Length': fichier_taille,
-   'Content-Disposition': 'attachment; filename="schoolpay.sqlite"'
+   'Content-Disposition': 'attachment; filename="schoolpay_nathmn14.db"'
  });
```

---

### 📄 Fichier 4 : `FRONTEND/js/app.js`

**Ligne modifiée :** L561  
**Objectif :** Le bouton "Exporter la base" propose le téléchargement sous le bon nom.

```diff
    const a = document.createElement('a');
    a.href = url;
-   a.download = 'schoolpay.sqlite';
+   a.download = 'schoolpay_nathmn14.db';
    document.body.appendChild(a);
```

---

## PARTIE 4 — Architecture de la Base de Données dans l'Exécutable

```
SchoolPay.exe (electron-builder)
│
└── resources/
    └── BACKEND/
        └── donnees/
            └── schoolpay_nathmn14.db   ← embarquée (via extraResources dans package.json)

%APPDATA%\SchoolPAY\donnees\            ← données persistantes utilisateur
    └── schoolpay_nathmn14.db           ← copie effectuée au 1er lancement
```

**Flux de démarrage :**
1. Electron démarre → `main.js` → `app.whenReady()`
2. Vérifie si `%APPDATA%/SchoolPAY/donnees/schoolpay_nathmn14.db` existe
3. **Si non (1er lancement)** : copie depuis `resources/BACKEND/donnees/schoolpay_nathmn14.db`
4. Définit `process.env.SCHOOLPAY_DB_DIR` vers `%APPDATA%/SchoolPAY/donnees/`
5. `base_de_donnees.js` se connecte à `schoolpay_nathmn14.db` (priorité 1)

---

## PARTIE 5 — Synthèse des Fichiers Touchés

| Fichier | Type de modification | Lignes |
|:--------|:---------------------|:------:|
| `BACKEND/donnees/schoolpay_nathmn14.db` | 10 noms d'élèves corrigés (UPDATE SQL) | Table `eleves` |
| `BACKEND/donnees/schoolpay_nathmn14.backup_pre_fix.db` | **Créé** — sauvegarde avant correction | — |
| `BACKEND/src/base_de_donnees/base_de_donnees.js` | Priorité DB inversée | L7–L8, L13–L15 |
| `electron/main.js` | Nom de la DB cible dans `userData` | L300 |
| `BACKEND/src/controleurs/auth.controleur.js` | Nom du fichier d'export API | L241 |
| `FRONTEND/js/app.js` | Nom du téléchargement frontend | L561 |

---

*Document généré le 30 Août 2026 — SchoolPay v1.0.0*
