# Diagnostic SchoolPAY Backend

## Probleme principal

Le projet ne pouvait pas demarrer car **`package.json` ne declarait aucune dependance**.

### Details

| Element | Avant correction | Apres correction |
|---|---|---|
| `package.json` dependencies | **absent** | `better-sqlite3` declare |
| `node_modules/` | **inexistant** | installe |
| `package-lock.json` | vide (0 dependance) | contient better-sqlite3 |

Le code (`src/base_de_donnees/base_de_donnees.js:4`) fait :

```js
const DatabaseSync = require('better-sqlite3');
```

Mais `better-sqlite3` n'etait **pas liste** dans `package.json` sous `dependencies`.
Sans le dossier `node_modules/`, chaque `require()` du projet echouait avec :

```
Error: Cannot find module 'better-sqlite3'
```

### Correction

```bash
npm install better-sqlite3
```

Cela a :
1. Ajoute `better-sqlite3` dans `package.json` > `dependencies`
2. Cree le dossier `node_modules/` avec le module et ses dependances natives
3. Mis a jour `package-lock.json`

Le serveur demarre ensuite normalement sur `http://localhost:4000`.

## Points de vigilance

- **Node.js >= 18** requis (compilation native de better-sqlite3 via node-gyp)
- Le serveur essaie automatiquement le port suivant (4001, 4002...) si le port 4000 est occupe
- La base de donnees SQLite est creee automatiquement dans `donnees/schoolpay.sqlite` au premier lancement
