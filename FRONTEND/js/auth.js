/**
 * Module de gestion de session frontend pour SchoolPAY.
 *
 * Ce module stocke la session du caissier en localStorage, protège
 * l'accès aux pages de l'application et expose des helpers session.
 */
(function () {
  const CLE_SESSION = 'schoolpay_session';

  /**
   * Lit la session stockée dans le navigateur.
   * @returns {Object|null}
   */
  function obtenirSession() {
    try {
      const brut = localStorage.getItem(CLE_SESSION);
      return brut ? JSON.parse(brut) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Enregistre une session dans localStorage.
   * @param {Object} donnees
   */
  function definirSession(donnees) {
    localStorage.setItem(CLE_SESSION, JSON.stringify(donnees));
  }

  /**
   * Détruit la session locale et redirige vers la page de connexion.
   */
  async function deconnecter() {
    const session = obtenirSession();
    if (session && session.nom_utilisateur) {
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nom_utilisateur: session.nom_utilisateur,
            action: 'deconnexion',
            reference_action: '-'
          })
        });
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem(CLE_SESSION);
    window.location.href = 'login.html';
  }

  /**
   * Retourne le nom du fichier de page actuel dans l'URL.
   * @returns {string}
   */
  function cheminPage() {
    return decodeURIComponent(window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  // Protection d'accès : si l'utilisateur n'est pas connecté et n'est pas
  // sur la page de login, on le renvoie automatiquement vers login.html.
  const page = cheminPage();
  if (page !== 'login.html') {
    const session = obtenirSession();
    if (!session || !session.nom_complet) {
      const retour = encodeURIComponent(page);
      window.location.replace(`login.html?next=${retour}`);
    }
  }

  window.SchoolPayAuth = { obtenirSession, definirSession, deconnecter };
})();
