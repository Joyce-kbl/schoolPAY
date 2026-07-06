# SchoolPAY

## Objectif du projet

SchoolPAY est une application de gestion des paiements scolaires. Elle est pensée pour aider le caissier d'une école à enregistrer les paiements des élèves, générer des reçus, consulter le journal de caisse et préparer les rapports journaliers.

Le projet est actuellement organisé en deux grandes parties :

- `BACKEND` : API, logique serveur et base de données SQLite.
- `FRONTEND` : pages HTML, styles CSS et scripts JavaScript côté navigateur.

## Fonctionnalités principales

Fonctionnalités déjà amorcées :

- Création d'un élève via l'API.
- Liste des élèves enregistrés.
- Création d'un paiement.
- Génération automatique d'un numéro de reçu.
- Liste des paiements.
- Consultation du journal de caisse.
- Stockage des données dans SQLite.
- Pages frontend pour le guichet, le paiement, le journal, les paramètres, la fiche élève, le reçu et le rapport.

Fonctionnalités prévues :

- Recherche dynamique d'un élève depuis l'interface.
- Connexion du formulaire de paiement au backend.
- Génération de reçus dynamiques.
- Rapport journalier basé sur les vraies données.
- Gestion des classes.
- Gestion du taux de change.
- Calcul du total payé et du reste à payer.

## Technologies utilisées

- HTML5
- CSS3
- JavaScript
- Node.js
- SQLite avec `node:sqlite`
- API HTTP native Node.js

Remarque : le backend utilise `node:sqlite`, disponible sur les versions récentes de Node.js. Une version Node.js 22 ou supérieure est recommandée.

## Installation

1. Ouvrir un terminal dans le dossier du projet :

```powershell
cd "\School Pay"
```

2. Aller dans le dossier backend :

```powershell
cd schoolPAY\BACKEND
```

3. Vérifier la version de Node.js :

```powershell
node -v
```

Le projet ne nécessite pas encore d'installation de dépendances externes, car il utilise les modules natifs de Node.js.

## Lancer le backend

Depuis le dossier `schoolPAY/BACKEND`, lancer :

```powershell
npm start
```

Le serveur démarre par défaut sur :

```text
http://localhost:4000
```

La base SQLite est créée automatiquement ici :

```text
schoolPAY/BACKEND/donnees/schoolpay.sqlite
```

## Tester rapidement l'API

Vérifier que le serveur fonctionne :

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:4000/api/sante"
```

Créer un élève :

```powershell
$eleve = @{
  nom_complet = "Joyce Sala"
  sexe = "F"
  matricule = "SP-001"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/eleves" -ContentType "application/json" -Body $eleve
```

Créer un paiement :

```powershell
$paiement = @{
  eleve_id = 1
  libelle = "Minerval"
  montant = 50
  devise = "USD"
  paye_le = "2026-07-02"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/paiements" -ContentType "application/json" -Body $paiement
```

Consulter le journal :

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:4000/api/journal"
```

## Utilisation du frontend

Les pages frontend se trouvent dans :

```text
schoolPAY/FRONTEND/html
```

Page principale :

```text
schoolPAY/FRONTEND/html/index.html
```

Pour l'instant, le frontend est encore une maquette HTML statique. Les pages sont rangées dans la bonne structure, mais elles ne sont pas encore complètement connectées au backend.

## Routes API disponibles

```text
GET  /api/sante
GET  /api/eleves
POST /api/eleves
GET  /api/paiements
POST /api/paiements
GET  /api/journal
```

## Structure du projet

```text
School Pay/
├─ README.md
├─ Evolution_Travail.md
├─ Modélisation.md
└─ schoolPAY/
   ├─ ARCHITECTURE.md
   ├─ PLAN BACKEND.md
   ├─ Rappor_SchoolPay.md
   ├─ BACKEND/
   │  ├─ app.js
   │  ├─ package.json
   │  ├─ donnees/
   │  │  └─ schoolpay.sqlite
   │  └─ src/
   │     ├─ base_de_donnees/
   │     │  └─ base_de_donnees.js
   │     ├─ controleurs/
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

Le backend fonctionne déjà avec SQLite et expose les premières routes utiles. Le frontend est bien organisé mais doit encore être connecté à l'API.

La prochaine étape recommandée est de brancher le formulaire `paiement.html` sur `POST /api/paiements`, puis de remplacer les données statiques du journal par les données de `GET /api/journal`.
