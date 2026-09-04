# SchoolPAY

## Objectif du projet

SchoolPAY est une application de gestion des paiements scolaires. Elle aide le caissier d'une ecole a enregistrer les paiements des eleves, generer des recus, consulter le journal de caisse et preparer les rapports journaliers.

Le projet est organise en deux parties :

- `BACKEND` : API, logique serveur, base SQLite et routes metier.
- `FRONTEND` : pages HTML, styles CSS et scripts JavaScript cote navigateur.

## Fonctionnalites principales

Fonctionnalites deja disponibles :

- authentification des caissiers avec mots de passe sécurisés ;
- verification de sante du backend ;
- gestion des classes et des eleves ;
- recherche d'eleves par nom ou matricule (génération automatique des matricules) ;
- consultation d'une fiche eleve avec reste à payer détaillé par catégorie ;
- rapport complet de la situation générale des élèves ;
- creation de paiements avec factures multi-operations (plusieurs frais sur un reçu) ;
- categories de frais avec codes comptables (recherche dynamique) ;
- generation automatique de numero de recu ;
- consultation du journal de caisse avec filtres avancés et synthèse par catégorie ;
- paramétrage de l'école (nom, adresse, taux de change) ;
- impression optimisée des reçus et rapports avec logo ;
- stockage des donnees dans SQLite ;
- service des pages frontend depuis le backend.

Fonctionnalites prevues :

- tests automatises e2e (partiellement implémentés).

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

- `/login.html` : connexion du caissier ;
- `/index.html` : guichet et transactions recentes ;
- `/paiement.html` : formulaire de paiement ;
- `/journal de caisse.html` : journal de caisse et synthèse ;
- `/situation_generale.html` : vue d'ensemble du paiement par classe ;
- `/modifier.html` : parametrage, caissiers, classes et eleves ;
- `/fiche_eleve.html` : fiche détaillée d'un eleve ;
- `/facture.html` : modele de recu imprimable.

## Routes API disponibles

```text
GET    /api/sante

POST   /api/connexion
GET    /api/caissiers
POST   /api/caissiers
DELETE /api/caissiers/:id

GET    /api/parametres
POST   /api/parametres
PUT    /api/parametres

GET    /api/categories-frais
POST   /api/categories-frais

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

POST   /api/factures
GET    /api/factures/:numero_facture

GET    /api/journal
GET    /api/journal/synthese
GET    /api/rapports/situation
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

Le backend est pleinement operationnel et sécurisé. Le frontend consomme l'entièreté de l'API avec des mécanismes d'authentification (`auth.js`).

Toutes les demandes initiales du client ont été validées et intégrées (catégories de frais, matricule auto, synthèse du journal, factures multi-opérations). Des rapports complets et personnalisés sont générables et imprimables.
