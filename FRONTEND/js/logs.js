/**
 * Module de journalisation côté frontend pour SchoolPAY.
 * À inclure sur toutes les pages qui déclenchent des actions loggables.
 * Nécessite que auth.js soit chargé avant ce script.
 */
(function () {
  /**
   * Envoie une entrée de log au backend via POST /api/logs.
   * @param {string} action - Le type d'action (ex: 'impression_recu', 'paiement')
   * @param {string} [reference_action='-'] - Référence contextuelle (id, numéro reçu…)
   */
  async function enregistrerLog(action, reference_action) {
    if (reference_action === undefined || reference_action === null) {
      reference_action = '-';
    }
    const session = window.SchoolPayAuth?.obtenirSession();
    const nom_utilisateur = session?.nom_utilisateur;
    if (!nom_utilisateur) return;
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom_utilisateur, action, reference_action: String(reference_action) })
      });
    } catch (e) {
      console.error('[LOGS] Erreur de journalisation :', e);
    }
  }

  // Exposer globalement
  window.enregistrerLog = enregistrerLog;
})();
