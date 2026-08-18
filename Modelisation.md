# Modélisation du projet SchoolPAY

## 1. Contexte et objectif

SchoolPAY est une application de gestion des paiements scolaires. Dans cette première version, l’application sera utilisée par une seule personne : le caissier.

Le rôle du caissier est central. Il consulte les élèves, enregistre les paiements, imprime les reçus, suit le journal de caisse et édite les rapports journaliers. Il n’y a donc pas de gestion de plusieurs profils utilisateurs ni de séparation de rôles dans cette version de départ.

L’objectif de cette modélisation est de préparer la conception fonctionnelle et technique avant de passer au développement réel.

## 2. Narration du besoin

Chaque jour, le caissier ouvre l’application SchoolPAY pour traiter les opérations de caisse de l’école. Il recherche d’abord l’élève concerné, vérifie sa classe et son historique de paiement, puis enregistre le montant payé selon le type de frais demandé.

Après validation, l’application doit générer un reçu imprimable et mettre à jour le journal de caisse. Le caissier peut aussi consulter le solde d’un élève, modifier un reçu en cas d’erreur, ajuster le taux de change et produire un rapport journalier de caisse pour le suivi administratif.

Le système doit rester simple, rapide et fiable, car il est utilisé dans un contexte opérationnel où le caissier doit enchaîner les paiements sans friction.

## 3. Périmètre fonctionnel

### Inclus

- Recherche d’un élève.
- Consultation de la fiche d’un élève.
- Enregistrement d’un paiement.
- Génération d’un reçu.
- Consultation du journal de caisse.
- Impression du journal et du reçu.
- Edition d’un rapport journalier.
- Mise à jour du taux de change.
- Ajout d’une classe.
- Ajout d’un élève.
- Correction ou modification d’un reçu.

### Exclu pour cette version

- Gestion de plusieurs comptes utilisateurs.
- Connexion multi-rôles.
- Paiement en ligne.
- Notifications automatiques.
- Accès parent ou élève.
- Comptabilité complète.
- Synchronisation cloud avancée.

## 4. Narration métier

Le caissier arrive à son poste et ouvre SchoolPAY. Il peut rechercher un élève par nom, consulter sa fiche et vérifier les montants déjà payés. Lorsqu’un parent se présente pour régler une partie ou la totalité d’une dette scolaire, le caissier crée un paiement en précisant la classe, l’élève, le type de frais, le montant, la devise et la date.

Une fois le paiement validé, le système enregistre l’opération, met à jour le journal de caisse, et prépare un reçu. Si besoin, le caissier imprime le reçu immédiatement. En fin de journée, il consulte le journal de caisse, vérifie les totaux, puis imprime le rapport journalier pour archivage ou transmission à la hiérarchie.

Si un montant a été saisi par erreur, le caissier peut rechercher le reçu correspondant et le corriger selon les règles définies. Il peut aussi ajuster certaines données de configuration comme le taux de change ou l’ajout d’une nouvelle classe.

## 5. Cas d’utilisation

### Acteur unique

- Caissier

### Cas d’utilisation principaux

#### UC1 - Rechercher un élève

Le caissier saisit le nom ou une partie du nom d’un élève. Le système retourne les résultats correspondants et permet d’ouvrir la fiche de l’élève.

#### UC2 - Consulter la fiche d’un élève

Le caissier visualise les informations de l’élève, son historique de paiement, le total payé et le reste à payer.

#### UC3 - Enregistrer un paiement

Le caissier sélectionne un élève, choisit la classe et le type de frais, saisit le montant et la devise, puis valide le paiement.

#### UC4 - Générer un reçu

Après validation du paiement, le système crée automatiquement un reçu avec un numéro unique.

#### UC5 - Imprimer un reçu

Le caissier imprime le reçu pour le remettre au parent ou pour archivage.

#### UC6 - Consulter le journal de caisse

Le caissier affiche la liste des paiements enregistrés sur une journée ou sur une période donnée.

#### UC7 - Imprimer le journal de caisse

Le caissier imprime le journal de caisse pour le suivi administratif.

#### UC8 - Produire un rapport journalier

Le système prépare un rapport récapitulatif des recettes de la journée.

#### UC9 - Modifier un reçu

Le caissier recherche un reçu existant afin d’y apporter une correction autorisée.

#### UC10 - Gérer les paramètres de base

Le caissier ajoute une classe, ajoute un élève ou met à jour le taux de change.

### Cas d’utilisation simplifiés

#### Cas d’utilisation 1 : Enregistrer un paiement

1. Le caissier ouvre le formulaire de paiement.
2. Il sélectionne la classe.
3. Il choisit l’élève.
4. Il choisit le type de frais.
5. Il saisit le montant.
6. Il choisit la devise.
7. Il renseigne la date.
8. Il valide l’opération.
9. Le système enregistre le paiement.
10. Le système génère le reçu.
11. Le journal de caisse est mis à jour.

#### Cas d’utilisation 2 : Consulter une fiche élève

1. Le caissier saisit le nom de l’élève.
2. Le système affiche les correspondances.
3. Le caissier ouvre la fiche de l’élève.
4. Le système affiche les montants payés et le reste à payer.
5. Le caissier consulte l’historique.

## 6. Diagramme de cas d’utilisation en texte

```text
                +----------------+
                |   Caissier     |
                +----------------+
                        |
        +---------------+-------------------------------+
        |               |               |               |
        v               v               v               v
 Rechercher élève   Enregistrer     Consulter       Produire rapport
                    un paiement      journal
        |               |               |               |
        v               v               v               v
 Consulter fiche   Générer reçu    Imprimer journal  Imprimer reçu

        +--------------------+
        | Gérer paramètres    |
        | (classe, élève,     |
        | taux de change)     |
        +--------------------+
```

## 7. Modélisation des classes

### 7.1 Classe `Caissier`

Responsabilité : représenter l’utilisateur unique de l’application.

Attributs possibles :

- `idCaissier`
- `nomComplet`
- `matricule`

Méthodes possibles :

- `rechercherEleve()`
- `enregistrerPaiement()`
- `imprimerRecu()`
- `consulterJournal()`
- `genererRapport()`

### 7.2 Classe `Eleve`

Responsabilité : stocker les informations d’un élève.

Attributs possibles :

- `idEleve`
- `nomComplet`
- `sexe`
- `classe`
- `matricule`
- `soldeTotal`
- `montantPaye`
- `resteAPayer`

Méthodes possibles :

- `calculerReste()`
- `afficherFiche()`

### 7.3 Classe `ClasseScolaire`

Responsabilité : représenter une classe ou une filière.

Attributs possibles :

- `idClasse`
- `nomClasse`
- `niveau`
- `montantFrais`

Méthodes possibles :

- `ajouterEleve()`
- `modifierMontantFrais()`

### 7.4 Classe `Paiement`

Responsabilité : représenter une opération de paiement.

Attributs possibles :

- `idPaiement`
- `datePaiement`
- `montant`
- `devise`
- `typeFrais`
- `eleve`
- `caissier`
- `numeroRecu`

Méthodes possibles :

- `valider()`
- `annuler()`
- `genererRecu()`

### 7.5 Classe `Recu`

Responsabilité : produire le document de preuve du paiement.

Attributs possibles :

- `numeroRecu`
- `dateEmission`
- `paiement`
- `montantEnLettres`

Méthodes possibles :

- `imprimer()`
- `exporterPDF()`

### 7.6 Classe `JournalDeCaisse`

Responsabilité : centraliser les paiements de la journée ou d’une période.

Attributs possibles :

- `dateJournal`
- `listePaiements`
- `totalRecettes`
- `totalSuspens`

Méthodes possibles :

- `ajouterPaiement()`
- `calculerTotal()`
- `filtrerParDate()`
- `imprimerJournal()`

### 7.7 Classe `TauxChange`

Responsabilité : conserver le taux de conversion entre USD et CDF.

Attributs possibles :

- `valeurUSD`
- `dateMiseAJour`

Méthodes possibles :

- `mettreAJour()`
- `convertir()`

## 8. Relations entre les classes

- Un `Caissier` enregistre plusieurs `Paiement`.
- Un `Paiement` concerne un seul `Eleve`.
- Un `Eleve` appartient à une seule `ClasseScolaire`.
- Un `Paiement` génère un seul `Recu`.
- Un `JournalDeCaisse` contient plusieurs `Paiement`.
- Un `TauxChange` peut être utilisé lors de l’enregistrement d’un paiement en devise locale.

## 9. Diagramme de classes en texte

```text
Caissier 1 ----- * Paiement
Paiement 1 ----- 1 Recu
Paiement * ----- 1 Eleve
Eleve * ----- 1 ClasseScolaire
JournalDeCaisse 1 ----- * Paiement
TauxChange 1 ----- * Paiement
```

## 10. Modélisation de l’activité

### Activité principale : enregistrer un paiement

```text
Début
  |
  v
Ouvrir l’application
  |
  v
Rechercher l’élève
  |
  v
Élève trouvé ?
  |------ Non ------> Afficher message d’erreur -> Fin
  |
 Oui
  |
  v
Afficher la fiche de l’élève
  |
  v
Saisir le type de frais
  |
  v
Saisir le montant et la devise
  |
  v
Valider le paiement
  |
  v
Enregistrer le paiement
  |
  v
Générer le reçu
  |
  v
Mettre à jour le journal de caisse
  |
  v
Imprimer le reçu ?
  |------ Oui -----> Imprimer
  |
  v
Fin
```

### Autre activité : consulter le journal de caisse

```text
Début
  |
  v
Ouvrir le journal de caisse
  |
  v
Choisir une date ou une période
  |
  v
Afficher les transactions
  |
  v
Calculer le total
  |
  v
Imprimer le journal ?
  |------ Oui -----> Impression
  |
  v
Fin
```

## 11. Hypothèses de conception

- Une seule personne utilise l’application, donc aucune gestion de session complexe n’est nécessaire dans cette phase.
- Le caissier est l’unique acteur métier.
- Les données doivent être simples à saisir et rapides à consulter.
- Les reçus et journaux doivent être imprimables immédiatement.
- Le projet doit rester évolutif afin de pouvoir accueillir une base de données plus tard.

## 12. Résumé de la modélisation

Cette modélisation montre que SchoolPAY est avant tout une application de caisse scolaire centrée sur un utilisateur unique : le caissier. Le cœur du système repose sur la recherche d’élèves, l’enregistrement des paiements, la génération des reçus et le suivi du journal de caisse.

Avant d’aller vers la réalisation technique, il faudra maintenant transformer cette modélisation en architecture applicative, définir les entités de données précises, puis implémenter les écrans et les traitements métier.

---

## Note de mise a jour - 2026-07-06

La modelisation initiale reste valable pour le coeur fonctionnel de SchoolPAY : un seul acteur principal, le caissier, qui gere les eleves, les paiements, les recus et le journal de caisse.

Depuis cette modelisation, le projet a evolue techniquement :

- le backend est maintenant operationnel avec SQLite ;
- les classes, eleves, paiements, recus, journal et taux ont des routes API ;
- le frontend consomme deja une partie de l'API ;
- le backend a ete nettoye pour supprimer les routes dupliquees ;
- les mises a jour partielles avec `PATCH` sont supportees.

Points a ajouter dans une future version de la modelisation :

- categorie de frais ;
- facture contenant plusieurs operations ;
- matricule automatique genere cote backend ;
- synthese du journal par categorie ou periode ;
- historique de modification des paiements.

Point technique a corriger :

- le nom actuel du fichier est `Mod#U00e9lisation.md`; il devrait etre renomme proprement en `Modelisation.md` ou `Modélisation.md` apres verification de l'encodage.
