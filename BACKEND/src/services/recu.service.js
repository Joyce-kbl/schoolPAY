function completer_nombre(valeur, taille = 4) {
  return String(valeur).padStart(taille, '0');
}

function construire_numero_recu(id) {
  return `R-${completer_nombre(id)}`;
}

module.exports = {
  construire_numero_recu
};
