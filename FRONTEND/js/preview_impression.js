/**
 * Module universel de prévisualisation, d'impression matérielle et d'exportation PDF
 * pour l'environnement Electron de SchoolPAY.
 */
(function (window) {
  'use strict';

  // Profils par défaut de mise en page pour chaque famille de documents
  const PROFILS_DOCUMENT = {
    recu: {
      pageSize: 'A5',
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true
    },
    releve: {
      pageSize: 'A4',
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true
    },
    rapport: {
      pageSize: 'A4',
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true
    },
    situation: {
      pageSize: 'A4',
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true
    }
  };

  let modaleElement = null;
  let pdfUrlCourant = null;
  let pdfBase64Courant = null;
  let optionsCourantes = null;

  /**
   * Injecte les styles CSS nécessaires à la modale de prévisualisation.
   */
  function injecterStylesPreview() {
    if (document.getElementById('styles-schoolpay-preview')) return;

    const style = document.createElement('style');
    style.id = 'styles-schoolpay-preview';
    style.textContent = `
      .sp-preview-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      }
      .sp-preview-overlay.visible {
        opacity: 1;
        pointer-events: auto;
      }
      .sp-preview-container {
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        width: 100%;
        max-width: 960px;
        height: 90vh;
        max-height: 850px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: spPreviewPop 0.25s ease-out;
      }
      @keyframes spPreviewPop {
        from { transform: scale(0.96); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .sp-preview-header {
        background: #8b0000;
        color: #ffffff;
        padding: 14px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .sp-preview-title-box {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .sp-preview-title {
        font-size: 15px;
        font-weight: 700;
        margin: 0;
      }
      .sp-preview-badge {
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
      }
      .sp-preview-btn-close {
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: #ffffff;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      .sp-preview-btn-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .sp-preview-body {
        flex: 1;
        background: #f1f5f9;
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sp-preview-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: #f1f5f9;
      }
      .sp-preview-loader {
        position: absolute;
        inset: 0;
        background: rgba(248, 250, 252, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        z-index: 5;
        color: #475569;
        font-size: 14px;
        font-weight: 600;
      }
      .sp-preview-spinner {
        width: 42px;
        height: 42px;
        border: 4px solid #e2e8f0;
        border-top-color: #8b0000;
        border-radius: 50%;
        animation: spSpin 0.8s linear infinite;
      }
      @keyframes spSpin {
        to { transform: rotate(360deg); }
      }
      .sp-preview-footer {
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
        padding: 14px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .sp-preview-filename {
        font-size: 12px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: monospace;
      }
      .sp-preview-actions {
        display: flex;
        gap: 10px;
      }
      .sp-btn {
        padding: 10px 18px;
        border-radius: 10px;
        border: none;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
      }
      .sp-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .sp-btn-annuler {
        background: #f1f5f9;
        color: #475569;
      }
      .sp-btn-annuler:hover:not(:disabled) {
        background: #e2e8f0;
      }
      .sp-btn-save {
        background: #0284c7;
        color: #ffffff;
      }
      .sp-btn-save:hover:not(:disabled) {
        background: #0369a1;
      }
      .sp-btn-print {
        background: #8b0000;
        color: #ffffff;
      }
      .sp-btn-print:hover:not(:disabled) {
        background: #6b0000;
      }
      .sp-toast-notification {
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 12px 20px;
        border-radius: 10px;
        background: #0f172a;
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.3s ease;
      }
      .sp-toast-notification.visible {
        transform: translateY(0);
        opacity: 1;
      }
      .sp-toast-success { background: #059669; }
      .sp-toast-error { background: #dc2626; }
    `;
    document.head.appendChild(style);
  }

  /**
   * Crée la structure HTML de la modale d'aperçu.
   */
  function creerModalePreview() {
    if (modaleElement) return modaleElement;

    injecterStylesPreview();

    const overlay = document.createElement('div');
    overlay.className = 'sp-preview-overlay no-print';
    overlay.id = 'schoolpay-preview-modal';
    overlay.innerHTML = `
      <div class="sp-preview-container" onclick="event.stopPropagation()">
        <div class="sp-preview-header">
          <div class="sp-preview-title-box">
            <h3 class="sp-preview-title" id="sp-preview-titre">Aperçu avant impression</h3>
            <span class="sp-preview-badge" id="sp-preview-format">A4</span>
          </div>
          <button type="button" class="sp-preview-btn-close" id="sp-preview-close-btn" title="Fermer (Échap)">✕</button>
        </div>
        <div class="sp-preview-body">
          <div class="sp-preview-loader" id="sp-preview-loader">
            <div class="sp-preview-spinner"></div>
            <span>Génération fidèle du rendu PDF en cours...</span>
          </div>
          <iframe class="sp-preview-iframe" id="sp-preview-iframe" title="Aperçu du document"></iframe>
        </div>
        <div class="sp-preview-footer">
          <div class="sp-preview-filename" id="sp-preview-filename" title="Nom du fichier suggéré">
            📄 <span>document.pdf</span>
          </div>
          <div class="sp-preview-actions">
            <button type="button" class="sp-btn sp-btn-annuler" id="sp-btn-fermer">Fermer</button>
            <button type="button" class="sp-btn sp-btn-save" id="sp-btn-exporter-pdf">
              📥 Exporter PDF
            </button>
            <button type="button" class="sp-btn sp-btn-print" id="sp-btn-imprimer-direct">
              🖨️ Imprimer
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    modaleElement = overlay;

    // Attachement des gestionnaires d'événements
    overlay.addEventListener('click', fermerPreview);
    document.getElementById('sp-preview-close-btn').addEventListener('click', fermerPreview);
    document.getElementById('sp-btn-fermer').addEventListener('click', fermerPreview);
    document.getElementById('sp-btn-exporter-pdf').addEventListener('click', exporterPDF);
    document.getElementById('sp-btn-imprimer-direct').addEventListener('click', imprimerDirectement);

    // Raccourci Échap
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modaleElement && modaleElement.classList.contains('visible')) {
        fermerPreview();
      }
    });

    return overlay;
  }

  /**
   * Affiche un message toast temporaire.
   */
  function afficherToast(message, type = 'info') {
    const existant = document.getElementById('sp-toast-notification');
    if (existant) existant.remove();

    const toast = document.createElement('div');
    toast.id = 'sp-toast-notification';
    toast.className = `sp-toast-notification no-print ${type === 'success' ? 'sp-toast-success' : type === 'error' ? 'sp-toast-error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Convertit une chaîne Base64 en Blob PDF.
   */
  function base64EnBlobPDF(base64) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'application/pdf' });
  }

  /**
   * Formate la date courante pour un nom de fichier horodaté propre.
   */
  function horodatageFichier() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  /**
   * Ferme la modale de prévisualisation et libère la mémoire.
   */
  function fermerPreview() {
    if (!modaleElement) return;
    modaleElement.classList.remove('visible');

    const iframe = document.getElementById('sp-preview-iframe');
    if (iframe) iframe.src = 'about:blank';

    if (pdfUrlCourant) {
      URL.revokeObjectURL(pdfUrlCourant);
      pdfUrlCourant = null;
    }
    pdfBase64Courant = null;
  }

  /**
   * Ouvre la modale d'aperçu pour le document actuel.
   * @param {Object} options Configuration d'impression
   */
  async function ouvrirPreview(options = {}) {
    optionsCourantes = options;
    const {
      typeDocument = 'rapport',
      titre = 'Aperçu avant impression',
      nomFichierSuggere = null,
      pdfOptions = {},
      actionLog = null,
      referenceLog = '-'
    } = options;

    const modal = creerModalePreview();
    const loader = document.getElementById('sp-preview-loader');
    const titreEl = document.getElementById('sp-preview-titre');
    const formatEl = document.getElementById('sp-preview-format');
    const filenameEl = document.getElementById('sp-preview-filename');
    const iframe = document.getElementById('sp-preview-iframe');

    // Nom de fichier suggéré par défaut si non fourni
    const nomFinal = nomFichierSuggere || `SchoolPAY_${typeDocument}_${horodatageFichier()}.pdf`;
    titreEl.textContent = titre;
    filenameEl.innerHTML = `📄 <span>${nomFinal}</span>`;

    const profil = PROFILS_DOCUMENT[typeDocument] || PROFILS_DOCUMENT.rapport;
    const configPDF = Object.assign({}, profil, pdfOptions);
    formatEl.textContent = configPDF.pageSize || 'A4';

    loader.style.display = 'flex';
    modal.classList.add('visible');

    // Vérifier si nous sommes dans Electron avec l'API exposée
    if (!window.ElectronAPI || typeof window.ElectronAPI.genererApercuPDF !== 'function') {
      loader.style.display = 'none';
      afficherToast('Mode navigateur standard détecté (ElectronAPI non disponible).', 'info');
      if (confirm('L\'aperçu natif est réservé à l\'application de bureau. Lancer l\'impression standard du navigateur ?')) {
        fermerPreview();
        window.print();
      }
      return;
    }

    try {
      if (typeof options.onAvantGeneration === 'function') {
        options.onAvantGeneration();
      }

      // Petite pause pour laisser le DOM se stabiliser si des éléments ont été masqués/modifiés
      await new Promise((r) => setTimeout(r, 100));

      const resultat = await window.ElectronAPI.genererApercuPDF(configPDF);

      if (typeof options.onApresGeneration === 'function') {
        options.onApresGeneration();
      }

      if (!resultat || !resultat.succes || !resultat.dataBase64) {
        throw new Error(resultat?.erreur || 'Échec de la génération du PDF');
      }

      pdfBase64Courant = resultat.dataBase64;
      const blob = base64EnBlobPDF(pdfBase64Courant);

      if (pdfUrlCourant) {
        URL.revokeObjectURL(pdfUrlCourant);
      }
      pdfUrlCourant = URL.createObjectURL(blob);
      iframe.src = pdfUrlCourant;

      loader.style.display = 'none';
    } catch (erreur) {
      console.error('[PRINTER] Erreur aperçu :', erreur);
      loader.style.display = 'none';
      afficherToast(`Erreur lors de la génération de l'aperçu : ${erreur.message}`, 'error');
    }
  }

  /**
   * Déclenche la sauvegarde du PDF généré vers le disque avec boîte de dialogue sécurisée.
   */
  async function exporterPDF() {
    if (!pdfBase64Courant || !window.ElectronAPI?.sauvegarderPDF) {
      return afficherToast('Aucun document prêt à être exporté.', 'error');
    }

    const btn = document.getElementById('sp-btn-exporter-pdf');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    const nomSuggere = optionsCourantes?.nomFichierSuggere || `Document_${horodatageFichier()}.pdf`;

    try {
      const res = await window.ElectronAPI.sauvegarderPDF({
        nomFichierSuggere: nomSuggere,
        pdfBase64: pdfBase64Courant
      });

      if (res && res.succes) {
        afficherToast(`Document enregistré avec succès : ${res.nomFichier}`, 'success');
        // Enregistrer le log si spécifié
        if (optionsCourantes?.actionLog && window.enregistrerLog) {
          window.enregistrerLog(optionsCourantes.actionLog, optionsCourantes.referenceLog || '-');
        }
      } else if (res && !res.annule) {
        afficherToast(`Échec de l'enregistrement : ${res.erreur || 'Erreur inconnue'}`, 'error');
      }
    } catch (e) {
      afficherToast(`Erreur : ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '📥 Exporter PDF';
    }
  }

  /**
   * Déclenche l'impression matérielle native.
   */
  async function imprimerDirectement() {
    if (!window.ElectronAPI?.imprimerMateriel) {
      // Fallback
      window.print();
      return;
    }

    const btn = document.getElementById('sp-btn-imprimer-direct');
    btn.disabled = true;
    btn.textContent = 'Impression...';

    const typeDoc = optionsCourantes?.typeDocument || 'rapport';
    const profil = PROFILS_DOCUMENT[typeDoc] || PROFILS_DOCUMENT.rapport;
    const printOptions = Object.assign({}, profil, optionsCourantes?.printOptions || {});

    try {
      const res = await window.ElectronAPI.imprimerMateriel(printOptions);
      if (res && res.succes) {
        afficherToast('Ordre d\'impression envoyé à l\'imprimante.', 'success');
        if (optionsCourantes?.actionLog && window.enregistrerLog) {
          window.enregistrerLog(optionsCourantes.actionLog, optionsCourantes.referenceLog || '-');
        }
        fermerPreview();
      } else {
        afficherToast(`Impression non aboutie : ${res?.erreur || 'Vérifiez l\'imprimante'}`, 'error');
      }
    } catch (e) {
      afficherToast(`Erreur d'impression : ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🖨️ Imprimer';
    }
  }

  // Exposition globale de l'API SchoolPayPrinter
  window.SchoolPayPrinter = {
    ouvrirPreview,
    fermerPreview,
    horodatageFichier
  };

})(window);
