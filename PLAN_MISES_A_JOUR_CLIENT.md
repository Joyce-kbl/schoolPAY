# Plan d’implémentation des nouvelles demandes client – SchoolPAY

## Contexte

Le fichier de demande client met l’accent sur 4 axes majeurs :

1. Améliorer le journal de caisse avec une synthèse journalière et un suivi du solde par élève.
2. Étendre la facture pour accepter plusieurs opérations dans une seule validation.
3. Ajouter la gestion des catégories de frais avec leurs codes et libellés.
4. Automatiser la génération de matricule unique pour les élèves avec deux stratégies intuitives.

---

## Objectifs fonctionnels

### 1) Journal de caisse

Ajouter au journal une vue plus exploitable avec :
- une synthèse des recettes du jour regroupées par type de paiement ;
- un résumé par catégorie de frais ;
- un affichage du solde de chaque élève à la fin de l’année ou du trimestre ;
- un filtrage par période, date ou catégorie.

### 2) Facture / reçu

Étendre le flux actuel pour permettre :
- la validation de plusieurs opérations dans une seule facture ;
- le choix de la devise entre USD et CDF ;
- La possibilité de modifier le taux dans les paramètre (Taux actuel : 1$= 22500 CDF)
- un affichage plus clair du total et du détail des opérations.

### 3) Base de données

Ajouter la gestion des catégories de frais avec les codes suivants :

| Code | Catégorie |
|---|---|
| 78000 | FRAIS SCOLAIRES |
| 78101 | INSCRIPTION |
| 78102 | FOURNITURE SCOL |
| 78104 | TABLIERS |
| 78105 | UNIFORMES |
| 78106 | MACARON |
| 78107 | PARASCOLAIRES |
| 78109 | AUTRES RECETTES |
| 78200 | ACTIVITES DIVERSES |
| 78500 | RECETTES EXTRAORDINAIRES |

### 4) Paramètres / élèves

Après l’enregistrement d’un élève, générer automatiquement un matricule unique avec une logique claire. Deux approches sont proposées :
- Stratégie A : matricule basé sur l’année et un numéro séquentiel ;
- Stratégie B : matricule basé sur l’année, la classe et un numéro séquentiel.

---

## Impact technique

### Backend affecté
- [BACKEND/app.js](BACKEND/app.js)
- [BACKEND/src/base_de_donnees/base_de_donnees.js](BACKEND/src/base_de_donnees/base_de_donnees.js)
- [BACKEND/src/controleurs/eleves.controleur.js](BACKEND/src/controleurs/eleves.controleur.js)
- [BACKEND/src/controleurs/paiements.controleur.js](BACKEND/src/controleurs/paiements.controleur.js)
- [BACKEND/src/controleurs/journal.controleur.js](BACKEND/src/controleurs/journal.controleur.js)

### Frontend affecté
- [FRONTEND/js/app.js](FRONTEND/js/app.js)
- [FRONTEND/html/journal de caisse.html](FRONTEND/html/journal%20de%20caisse.html)
- [FRONTEND/html/facture.html](FRONTEND/html/facture.html)
- [FRONTEND/html/paiement.html](FRONTEND/html/paiement.html)
- [FRONTEND/html/modifier.html](FRONTEND/html/modifier.html)
- [FRONTEND/html/fiche_eleve.html](FRONTEND/html/fiche_eleve.html)

---

## Plan de réalisation

### Phase 1 – Modèle de données

Objectif : préparer la structure pour stocker les nouvelles informations sans casser l’existant.

Tâches :
- créer une table de catégories de frais avec les codes et libellés demandés ;
- ajouter un lien entre un paiement et une catégorie ;
- prévoir un modèle pour les opérations regroupées dans une facture ;
- ajouter une logique de calcul du solde par élève basé sur les paiements et le montant de frais attendu ;
- garantir la compatibilité avec la base SQLite existante.

Livrables :
- schéma mis à jour ;
- données de catégories initialement chargées ;
- mécanisme de calcul du solde disponible côté API.

### Phase 2 – Backend

Objectif : exposer des endpoints simples pour alimenter les nouvelles vues UI.

Endpoints à ajouter ou étendre :
- GET /api/categories-frais
- POST /api/categories-frais
- GET /api/journal/synthese
- GET /api/eleves/:id/solde
- POST /api/factures
- GET /api/factures/:id
- POST /api/eleves avec génération automatique du matricule

Logique métier à implémenter :
- regroupement des paiements par type/catégorie ;
- calcul du total du jour ;
- calcul du solde restant par élève selon une période ;
- gestion multiple des opérations dans une facture ;
- support de la devise CDF dans l’affichage et le calcul.

### Phase 3 – Frontend

Objectif : rendre ces nouvelles fonctionnalités visibles dans l’interface.

Écrans concernés :
- journal de caisse : ajouter la synthèse, le regroupement par type de paiement et le filtre par date/période ;
- facture : permettre plusieurs opérations dans une seule facture, avec sélection de la devise ;
- paiement : proposer la catégorie de frais au moment de l’enregistrement ;
- paramètres : afficher la génération automatique du matricule et proposer le mode de génération choisi.

### Phase 4 – Validation

Tâches de vérification :
- vérifier les nouveaux endpoints avec des appels API ;
- vérifier le journal avec des données réelles ;
- vérifier qu’un élève reçoit un matricule unique ;
- vérifier qu’une facture peut contenir plusieurs opérations.

---

## Recommandation de conception pour les matricules

### Stratégie A – simple et lisible
Exemple :
- 2026-SP-001
- 2026-SP-002

Avantages :
- facile à lire ;
- simple à générer ;
- adapté à une petite école.

### Stratégie B – plus structurée
Exemple :
- 2026-L3-001
- 2026-L2-002

Avantages :
- donne immédiatement une information sur la classe ;
- plus utile pour les rapports.

Recommandation : implémenter la stratégie A par défaut, puis prévoir un paramètre pour basculer vers la stratégie B.

---

## Priorités proposées

- P1 : modèle de données + catégories de frais + génération de matricule
- P2 : endpoints de synthèse et solde par élève
- P3 : interface du journal de caisse et de la facture
- P4 : validations et tests de bout en bout

---

## Critères d’acceptation

La demande client sera considérée comme satisfaite si :
- le journal affiche une synthèse claire des recettes du jour ;
- le solde d’un élève est visible et calculé correctement ;
- une facture peut regrouper plusieurs opérations ;
- les catégories de frais sont disponibles et utilisables ;
- les matricules sont uniques et générés automatiquement.

---

## Mise a jour technique du 2026-07-06

Avant de commencer les nouvelles demandes client, le backend a ete nettoye.

Travail realise :

- suppression des routes dupliquees dans `BACKEND/app.js` ;
- centralisation de la recherche eleve et de la fiche eleve dans le controleur `eleves.controleur.js` ;
- support des mises a jour partielles avec `PATCH` pour les classes, eleves et paiements ;
- stabilisation de la suppression d'un eleve avec ses paiements associes ;
- validation avec `npm run test:e2e`.

Etat apres nettoyage et implementation du 2026-07-06 18:40 :

- le backend est pret pour les ajouts fonctionnels ;
- les categories de frais sont implémentées et exposées via l'API ;
- la generation automatique de matricule est intégrée au backend (Stratégie A) ;
- le frontend nécessite une mise à jour pour consommer les catégories (menu déroulant) ;
- les factures multi-operations ne sont pas encore implementees ;
- le journal ne possede pas encore de vraie synthese par categorie.

Prochaine phase recommandee :

~~1. remplacer le champ libre `libelle` par une selection de categorie dans le frontend (paiement.html) ;~~ (Fait)
~~2. intégrer l'affichage du matricule généré dans le frontend ;~~ (Fait)
~~3. implémenter la facture multi-opérations ;~~ (Fait)
~~4. ajouter la synthèse par catégorie dans le journal de caisse.~~ (Fait)
