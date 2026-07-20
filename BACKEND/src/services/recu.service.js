/**
 * Remplit une valeur avec des zéros à gauche pour atteindre une taille cible.
 * @param {number|string} valeur - La valeur à formater
 * @param {number} taille - La longueur totale souhaitée (par défaut 4)
 * @returns {string} La chaîne formatée (ex: 0001)
 */
function completer_nombre(valeur, taille = 4) {
  return String(valeur).padStart(taille, '0');
}

/**
 * Construit un numéro de reçu formaté à partir d'un ID numérique.
 * Utilisé pour générer un identifiant lisible par les humains.
 * @param {number} id - L'identifiant du paiement en base de données
 * @returns {string} Le numéro de reçu généré (ex: R-0001)
 */
function construire_numero_recu(id) {
  return `R-${completer_nombre(id)}`;
}

module.exports = {
  construire_numero_recu
};
