/**
 * Règles de calcul des montants attendus ("frais scolaire" dynamiques).
 * Le frais d'INSCRIPTION est différencié selon le statut de l'élève :
 *   - ancien ('A') : 10 $ ;
 *   - nouveau ('N') : 15 $.
 */
const MONTANT_INSCRIPTION_ANCIEN = 10;
const MONTANT_INSCRIPTION_NOUVEAU = 15;
const CODE_INSCRIPTION = '78101';

/**
 * Détermine si un élève est ancien ('A') ou nouveau ('N').
 * @param {Object|undefined} eleve - Ligne de la table `eleves`
 * @returns {boolean} True si l'élève est un ancien, sinon False
 */
function est_ancien(eleve) {
  const statut = String((eleve && eleve.ancien_nouveau) || '').trim().toUpperCase();
  return statut === 'A' || statut === 'ANCIEN';
}

/**
 * Calcule le montant du frais d'inscription en fonction du statut de l'élève.
 * @param {Object|undefined} eleve - Ligne de la table `eleves`
 * @returns {number} Le montant d'inscription (10 $ ancien, 15 $ nouveau)
 */
function obtenir_montant_inscription(eleve) {
  return est_ancien(eleve) ? MONTANT_INSCRIPTION_ANCIEN : MONTANT_INSCRIPTION_NOUVEAU;
}

/**
 * Vérifie si une catégorie de frais correspond à l'INSCRIPTION (code 78101).
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number|string} categorie_frais_id - ID de la catégorie de frais
 * @returns {boolean} True s'il s'agit de l'inscription
 */
function est_categorie_inscription(base_de_donnees, categorie_frais_id) {
  if (!categorie_frais_id) return false;
  const categorie = base_de_donnees
    .prepare('SELECT code, libelle FROM categories_frais WHERE id = ?')
    .get(categorie_frais_id);
  if (!categorie) return false;
  return String(categorie.code || '').trim() === CODE_INSCRIPTION
    || String(categorie.libelle || '').trim().toUpperCase() === 'INSCRIPTION';
}

/**
 * Renvoie le montant attendu pour un élève sur une catégorie de frais donnée.
 * Pour l'INSCRIPTION le montant dépend du statut ancien/nouveau de l'élève ;
 * pour les autres catégories, il provient du barème `frais_attendus_classe`
 * de la classe de l'élève.
 * @param {DatabaseSync} base_de_donnees - Base de données
 * @param {number|string} eleve_id - ID de l'élève
 * @param {number|string} categorie_frais_id - ID de la catégorie de frais
 * @returns {number|null} Le montant attendu, ou null si non défini
 */
function obtenir_attendu_frais(base_de_donnees, eleve_id, categorie_frais_id) {
  if (!categorie_frais_id) return null;

  const eleve = base_de_donnees
    .prepare('SELECT classe_id, ancien_nouveau FROM eleves WHERE id = ?')
    .get(eleve_id);
  if (!eleve) return null;

  // Règle métier : l'inscription dépend du statut de l'élève (10/15 $),
  // indépendamment du barème de la classe.
  if (est_categorie_inscription(base_de_donnees, categorie_frais_id)) {
    return obtenir_montant_inscription(eleve);
  }

  if (!eleve.classe_id) return null;
  const attendu = base_de_donnees
    .prepare('SELECT montant FROM frais_attendus_classe WHERE classe_id = ? AND categorie_frais_id = ?')
    .get(eleve.classe_id, categorie_frais_id);
  return attendu ? Number(attendu.montant) : null;
}

module.exports = {
  MONTANT_INSCRIPTION_ANCIEN,
  MONTANT_INSCRIPTION_NOUVEAU,
  est_ancien,
  obtenir_montant_inscription,
  est_categorie_inscription,
  obtenir_attendu_frais
};