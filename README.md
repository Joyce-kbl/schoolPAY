# SchoolPAY

## Objectif du projet

SchoolPAY est une application de gestion des paiements scolaires. Elle aide le caissier d'une ecole a enregistrer les paiements des eleves, generer des recus, consulter le journal de caisse et preparer les rapports journaliers.

Le projet est organise en deux parties :

- `BACKEND` : API, logique serveur, base SQLite et routes metier.
- `FRONTEND` : pages HTML, styles CSS et scripts JavaScript cote navigateur.

## Fonctionnalites principales

Fonctionnalites deja disponibles :

- verification de sante du backend ;
- gestion des classes ;
- gestion des eleves ;
- recherche d'eleves par nom ou matricule ;
- consultation d'une fiche eleve ;
- creation de paiements ;
- generation automatique de numero de recu ;
- recherche d'un recu ;
- consultation du journal de caisse ;
- mise a jour du taux de change ;
- stockage des donnees dans SQLite ;
- service des pages frontend depuis le backend.

Fonctionnalites prevues :

- categories de frais avec codes comptables ;
- synthese du journal par categorie et par periode ;
- generation automatique des matricules cote backend ;
- facture contenant plusieurs operations ;
- recus et rapports dynamiques ;
- tests automatises mieux structures.

## Technologies utilisees

- HTML5
- CSS3
- JavaScript
- Node.js
- SQLite avec `node:sqlite`
- API HTTP native Node.js

Une version recente de Node.js est recommandee. Le projet a ete teste avec Node.js 22.

## Installation

Ouvrir un terminal dans le dossier du projet :

```powershell
```

Aller dans le backend :

```powershell
cd BACKEND
```

Verifier Node.js :

```powershell
node -v
```

Le projet ne necessite pas encore d'installation de dependances externes.

## Lancer l'application

Depuis `BACKEND`, lancer :

```powershell
npm start
```

Le serveur demarre par defaut sur :

```text
http://localhost:4000
```

Si le port `4000` est occupe, le serveur tente automatiquement `4001`, puis les ports suivants selon les tentatives prevues.

La base SQLite est creee automatiquement ici :

```text
BACKEND/donnees/schoolpay.sqlite
```

## Utilisation

Ouvrir l'application dans le navigateur :

```text
http://localhost:4000
```

Pages principales :

- `/index.html` : guichet et transactions recentes ;
- `/paiement.html` : formulaire de paiement ;
- `/journal de caisse.html` : journal de caisse ;
- `/modifier.html` : parametrage, classes et eleves ;
- `/fiche_eleve.html` : fiche eleve ;
- `/facture.html` : modele de recu ;
- `/rapport.html` : modele de rapport.

## Routes API disponibles

```text
GET    /api/sante

GET    /api/classes
POST   /api/classes
PATCH  /api/classes/:id
PUT    /api/classes/:id
DELETE /api/classes/:id

GET    /api/eleves
GET    /api/eleves?q=terme
GET    /api/eleves/:id/fiche
POST   /api/eleves
PATCH  /api/eleves/:id
PUT    /api/eleves/:id
DELETE /api/eleves/:id

GET    /api/paiements
POST   /api/paiements
GET    /api/paiements/:numero_recu
PATCH  /api/paiements/:id
PUT    /api/paiements/:id
DELETE /api/paiements/:id

GET    /api/journal
GET    /api/recu?numero=R-0001
POST   /api/taux
PUT    /api/taux
```

## Tests

Depuis `BACKEND`, lancer :

```powershell
npm run test:e2e
```

Ce script execute :

- `tmp-test-admin.js` ;
- `tmp-ui-e2e.js`.

Remarque : ces scripts sont encore temporaires. Ils devront etre renommes et deplaces dans un dossier `BACKEND/tests`.

## Structure du projet

```text
School Pay/
├─ README.md
├─ Evolution_Travail.md
├─ Mod#U00e9lisation.md
├─ PLAN_MISES_A_JOUR_CLIENT.md
├─ UPDATE SchoolPAY.txt
├─ BACKEND/
│  ├─ app.js
│  ├─ package.json
│  ├─ tmp-test-admin.js
│  ├─ tmp-ui-e2e.js
│  ├─ donnees/
│  │  ├─ schoolpay.sqlite
│  │  └─ taux.json
│  └─ src/
│     ├─ base_de_donnees/
│     │  └─ base_de_donnees.js
│     ├─ controleurs/
│     │  ├─ classes.controleur.js
│     │  ├─ eleves.controleur.js
│     │  ├─ journal.controleur.js
│     │  ├─ paiements.controleur.js
│     │  └─ sante.controleur.js
│     └─ services/
│        └─ recu.service.js
└─ FRONTEND/
   ├─ css/
   │  └─ app.css
   ├─ js/
   │  └─ app.js
   └─ html/
      ├─ index.html
      ├─ paiement.html
      ├─ journal de caisse.html
      ├─ modifier.html
      ├─ fiche_eleve.html
      ├─ facture.html
      └─ rapport.html
```

## Etat actuel

Le backend est operationnel et a ete nettoye techniquement le 2026-07-06. Le frontend consomme deja une partie de l'API pour les classes, eleves, paiements et le journal.

La prochaine etape recommandee est d'implementer les demandes client suivantes :

1. categories de frais ;
2. matricule automatique cote backend ;
3. synthese du journal ;
4. factures multi-operations.
