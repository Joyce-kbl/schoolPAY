// Paramètres de l'interface frontend.
// API_BASE_URL reste vide ici car le frontend est servi depuis le même serveur que le backend.
const API_BASE_URL = '';

/**
 * Formate un montant en devise USD pour l'affichage.
 * @param {number|string} valeur
 * @returns {string}
 */
function formatMonnaie(valeur) {
  const symbole = '$';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valeur) + ' ' + symbole;
}

/**
 * Affiche une notification simple à l'utilisateur et logge l'événement.
 * @param {string} message
 * @param {boolean} [succes=true]
 */
function notifier(message, succes = true) {
  if (window.alert) {
    window.alert(message);
  }
  console[succes ? 'log' : 'error'](message);
}

/**
 * Wrapper de fetch pour appeler l'API backend en JSON.
 * Uniformise l'entête et remonte une erreur lisible en cas d'échec.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function apiFetch(url, options = {}) {
  const reponse = await fetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!reponse.ok) {
    const data = await reponse.json().catch(() => null);
    const erreur = data?.erreur || reponse.statusText || 'Erreur API';
    throw new Error(erreur);
  }
  return reponse.json();
}

/**
 * Charge les dernières transactions affichées sur la page d'accueil.
 * Affiche jusqu'à 6 lignes et un message si aucune transaction n'existe.
 */
async function chargerTransactionsRecentes() {
  try {
    const donnees = await apiFetch('/api/paiements');
    const tableau = document.getElementById('liste-transactions');
    if (!tableau) return;
    tableau.innerHTML = '';

    const lignes = (donnees.donnees || []).slice(0, 6);
    if (lignes.length === 0) {
      tableau.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #64748b;">Aucune transaction enregistrée.</td></tr>';
      return;
    }

    for (const paiement of lignes) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${paiement.nom_eleve || '—'}</td>
        <td>${paiement.libelle}</td>
        <td style="text-align: right; font-weight:700;">${formatMonnaie(paiement.montant)}</td>
        <td style="white-space:nowrap;">
          <button type="button" class="btn-reimprimer-recu" data-numero="${paiement.numero_recu || ''}">Réimprimer le reçu</button>
        </td>
      `;
      tableau.appendChild(tr);
    }

    tableau.querySelectorAll('.btn-reimprimer-recu').forEach((bouton) => {
      bouton.addEventListener('click', () => {
        const numeroRecu = bouton.dataset.numero;
        if (!numeroRecu) {
          return notifier('Numéro de reçu introuvable.', false);
        }
        reimprimerRecu(numeroRecu);
      });
    });
  } catch (erreur) {
    notifier(`Impossible de charger les transactions : ${erreur.message}`, false);
  }
}

//Fonction pour réimprimer un reçu
function reimprimerRecu(numeroRecu) {
  const url = `recu.html?numero=${encodeURIComponent(numeroRecu)}&source=reimpression&auto_print=1`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Charge et affiche le journal de caisse sur la page correspondante.
 * Calcule aussi le total des recettes et met à jour les KPI de la page.
 */
async function chargerJournal() {
  try {
    const donnees = await apiFetch('/api/journal');
    const corps = document.getElementById('body-releve-ventes');
    const montantJour = document.getElementById('montant-jour');
    const montantSuspens = document.getElementById('montant-suspens');
    const totalRecettes = document.getElementById('total-recettes');
    if (!corps || !montantJour || !montantSuspens || !totalRecettes) return;

    corps.innerHTML = '';
    let total = 0;
    const paiements = donnees.donnees || [];
    for (const paiement of paiements) {
      total += Number(paiement.montant || 0);
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f1f5f9';
      tr.innerHTML = `
        <td style="padding: 10px 0;">${paiement.numero_recu}</td>
        <td style="padding: 10px 0;">${paiement.nom_eleve || '—'}</td>
        <td style="padding: 10px 0;">${paiement.libelle}</td>
        <td style="padding: 10px 0; text-align: right; font-weight:700;">${formatMonnaie(paiement.montant)}</td>
      `;
      corps.appendChild(tr);
    }

    montantJour.textContent = formatMonnaie(total);
    totalRecettes.textContent = formatMonnaie(total);
    montantSuspens.textContent = formatMonnaie(0);
  } catch (erreur) {
    notifier(`Impossible de charger le journal : ${erreur.message}`, false);
  }
}

/**
 * Charge les données de classes et d'élèves dans les formulaires.
 * Utilisée par les pages paiement.html et modifier.html.
 */
async function chargerClassesEtEleves() {
  try {
    const classesData = await apiFetch('/api/classes');
    const elevesData = await apiFetch('/api/eleves');

    const selectClasses = document.getElementById('classe-select');
    const selectEleves = document.getElementById('eleve-select');
    const selectElevesAdmin = document.getElementById('nouvel-eleve-classe');

    if (selectClasses) {
      selectClasses.innerHTML = '<option value="">Sélectionner la classe...</option>';
      for (const classe of classesData.donnees || []) {
        const option = document.createElement('option');
        option.value = classe.id;
        option.textContent = `${classe.nom} (${formatMonnaie(classe.montant_frais)})`;
        selectClasses.appendChild(option);
      }
    }

    if (selectEleves) {
      selectEleves.innerHTML = '<option value="">Rechercher un élève...</option>';
      for (const eleve of elevesData.donnees || []) {
        const option = document.createElement('option');
        option.value = eleve.id;
        option.textContent = `${eleve.nom_complet} (${eleve.matricule || '—'})`;
        selectEleves.appendChild(option);
      }
    }

    if (selectElevesAdmin) {
      selectElevesAdmin.innerHTML = '<option value="">Sélectionner une classe...</option>';
      for (const classe of classesData.donnees || []) {
        const option = document.createElement('option');
        option.value = classe.id;
        option.textContent = classe.nom;
        selectElevesAdmin.appendChild(option);
      }
    }
  } catch (erreur) {
    notifier(`Impossible de charger les classes ou élèves : ${erreur.message}`, false);
  }
}

/**
 * Valide un paiement depuis le formulaire de paiement.
 * Vérifie les champs obligatoires puis envoie la requête au backend.
 */
async function validerPaiement() {
  const eleve_id = Number(document.getElementById('eleve-select')?.value || 0);
  const libelle = document.getElementById('frais-select')?.value || '';
  const montant = Number(document.getElementById('montant-input')?.value || 0);
  const paye_le = document.getElementById('date-input')?.value || new Date().toISOString().slice(0, 10);

  if (!eleve_id || !libelle || !(montant > 0)) {
    return notifier('Veuillez sélectionner un élève, un type de frais et un montant valide.', false);
  }

  try {
    const session = window.SchoolPayAuth?.obtenirSession();
    const caissier = session?.nom_utilisateur || '';
    await apiFetch('/api/paiements', {
      method: 'POST',
      body: JSON.stringify({ eleve_id, libelle, montant, devise: 'USD', paye_le, caissier })
    });
    notifier('Le paiement a été enregistré avec succès.');
    window.location.href = 'journal de caisse.html';
  } catch (erreur) {
    notifier(`Impossible d'enregistrer le paiement : ${erreur.message}`, false);
  }
}

/**
 * Envoie les informations du formulaire pour créer un nouvel élève.
 * Récupère ensuite la liste actualisée des classes et des élèves.
 */
/**
 * Crée un nouvel élève en appelant l'API /api/eleves.
 * Valide les champs obligatoires avant envoi.
 */
async function ajouterEleve() {
  const nom_complet = document.getElementById('nouvel-eleve-nom')?.value.trim();
  const sexe = document.getElementById('nouvel-eleve-sexe')?.value;
  const classe_id = Number(document.getElementById('nouvel-eleve-classe')?.value || 0);
  if (!nom_complet || !sexe || !classe_id) {
    return notifier('Veuillez remplir le nom, le sexe et la classe.', false);
  }

  try {
    const session = window.SchoolPayAuth?.obtenirSession();
    const caissier = session?.nom_utilisateur || '';
    const reponse = await apiFetch('/api/eleves', {
      method: 'POST',
      body: JSON.stringify({ nom_complet, sexe, classe_id, caissier })
    });
    notifier(`Élève ajouté avec succès. Matricule : ${reponse.donnees.matricule}`);
    // Le formulaire est vidé juste après l'enregistrement pour un rendu plus
    // professionnel et éviter tout double-ajout accidentel du même élève.
    document.getElementById('nouvel-eleve-nom').value = '';
    document.getElementById('nouvel-eleve-sexe').value = '';
    document.getElementById('nouvel-eleve-classe').value = '';
    await chargerClassesEtEleves();
  } catch (erreur) {
    notifier(`Impossible d'ajouter l'élève : ${erreur.message}`, false);
  }
}

/**
 * Charge la liste des caissiers actifs et affiche le panneau d'administration.
 * Ajoute les boutons de suppression en front pour retirer un caissier existant.
 */
/**
 * Charge les caissiers actifs et affiche la liste de gestion dans modifier.html.
 * Ajoute aussi un bouton de suppression pour chaque caissier.
 */
async function chargerCaissiers() {
  const conteneur = document.getElementById('liste-caissiers');
  if (!conteneur) return;
  try {
    const donnees = await apiFetch('/api/caissiers');
    const lignes = (donnees.donnees || []).filter(c => c.actif);
    if (lignes.length === 0) {
      conteneur.innerHTML = '<p style="color:#94a3b8;">Aucun caissier enregistré.</p>';
      return;
    }
    conteneur.innerHTML = lignes.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9;">
        <span><strong>${c.nom_complet}</strong> <span style="color:#94a3b8;">(${c.nom_utilisateur})</span></span>
        <button data-id="${c.id}" class="btn-suppr-caissier" style="background:#fef2f2;color:#b91c1c;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;">Retirer</button>
      </div>
    `).join('');
    conteneur.querySelectorAll('.btn-suppr-caissier').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Retirer ce caissier ? Il ne pourra plus se connecter.')) return;
        // La suppression réelle n'a lieu qu'après validation de l'identité
        // administrateur (José) dans la modale de confirmation.
        ouvrirModaleAdmin('supprimer-caissier', btn.dataset.id);
      });
    });
  } catch (erreur) {
    conteneur.innerHTML = '<p style="color:#b91c1c;">Impossible de charger les caissiers.</p>';
  }
}

/**
 * Enregistre un nouveau caissier dans le système via l'API.
 * Nettoie ensuite le formulaire et recharge la liste des caissiers.
 */
/**
 * Enregistre un nouveau caissier via l'API et actualise la liste.
 */
async function ajouterCaissier() {
  const nom_utilisateur = document.getElementById('nouveau-caissier-utilisateur')?.value.trim();
  const nom_complet = document.getElementById('nouveau-caissier-nom')?.value.trim();
  const mot_de_passe = document.getElementById('nouveau-caissier-mdp')?.value;
  if (!nom_utilisateur || !nom_complet || !mot_de_passe) {
    return notifier('Veuillez renseigner l\'identifiant, le nom complet et le mot de passe.', false);
  }
  try {
    const session = window.SchoolPayAuth?.obtenirSession();
    const caissier = session?.nom_utilisateur || '';
    await apiFetch('/api/caissiers', {
      method: 'POST',
      body: JSON.stringify({ nom_utilisateur, nom_complet, mot_de_passe, caissier })
    });
    notifier('Caissier créé avec succès.');
    // NOTE : on ne vide volontairement pas le formulaire après la création.
    // Cela permet de garder une trace visible de ce qui vient d'être saisi
    // et évite d'avoir à tout retaper en cas d'erreur de frappe à corriger.
    await chargerCaissiers();
  } catch (erreur) {
    notifier(`Impossible de créer le caissier : ${erreur.message}`, false);
  }
}

/**
 * Identifiants administrateur exigés avant toute création de caissier.
 * Cette vérification supplémentaire évite qu'un caissier ordinaire ne puisse
 * créer librement de nouveaux comptes d'accès à l'application.
 */
const ADMIN_UTILISATEUR = 'José';
const ADMIN_MOT_DE_PASSE = 'cicm@';

// Action en attente de confirmation administrateur : soit la création d'un
// caissier ('creer-caissier'), soit le retrait d'un caissier existant
// ('supprimer-caissier', avec son identifiant). La modale est ainsi partagée
// entre les deux opérations sensibles au lieu d'être dupliquée.
let actionAdminEnAttente = null;
let idCaissierASupprimer = null;

/**
 * Ouvre la modale de confirmation administrateur avant une action sensible
 * (création ou suppression d'un caissier).
 * @param {string} action - 'creer-caissier' ou 'supprimer-caissier'
 * @param {string|number} [idCible] - id du caissier concerné (pour la suppression)
 */
function ouvrirModaleAdmin(action = 'creer-caissier', idCible = null) {
  const modale = document.getElementById('modal-admin');
  if (!modale) return;
  actionAdminEnAttente = action;
  idCaissierASupprimer = idCible;
  document.getElementById('admin-utilisateur').value = '';
  document.getElementById('admin-mdp').value = '';
  modale.style.display = 'flex';
  document.getElementById('admin-utilisateur').focus();
}

/**
 * Ferme la modale de confirmation administrateur sans rien faire d'autre.
 */
function fermerModaleAdmin() {
  const modale = document.getElementById('modal-admin');
  if (modale) modale.style.display = 'none';
  actionAdminEnAttente = null;
  idCaissierASupprimer = null;
}

/**
 * Vérifie les identifiants administrateur saisis dans la modale.
 * Si valides, ferme la modale et exécute l'action en attente
 * (création ou suppression du caissier).
 */
async function confirmerModaleAdmin() {
  const utilisateur = document.getElementById('admin-utilisateur')?.value.trim();
  const motDePasse = document.getElementById('admin-mdp')?.value;

  if (utilisateur !== ADMIN_UTILISATEUR || motDePasse !== ADMIN_MOT_DE_PASSE) {
    notifier('Identifiant ou mot de passe administrateur incorrect.', false);
    return;
  }

  const action = actionAdminEnAttente;
  const idCible = idCaissierASupprimer;
  fermerModaleAdmin();

  if (action === 'supprimer-caissier') {
    try {
      await apiFetch(`/api/caissiers/${idCible}`, { method: 'DELETE' });
      await enregistrerLog('suppression_caissier', idCible);
      await chargerCaissiers();
    } catch (erreur) {
      notifier(`Impossible de retirer ce caissier : ${erreur.message}`, false);
    }
  } else {
    ajouterCaissier();
  }
}

/**
 * Ouvre la modale de confirmation de mot de passe pour l'exportation de la base de données.
 */
function ouvrirModaleExportDb() {
  const modale = document.getElementById('modal-export-db');
  if (!modale) return;
  const inputMdp = document.getElementById('export-db-mdp');
  if (inputMdp) inputMdp.value = '';
  modale.style.display = 'flex';
  if (inputMdp) inputMdp.focus();
}

/**
 * Ferme la modale d'exportation de la base de données.
 */
function fermerModaleExportDb() {
  const modale = document.getElementById('modal-export-db');
  if (modale) modale.style.display = 'none';
  const inputMdp = document.getElementById('export-db-mdp');
  if (inputMdp) inputMdp.value = '';
}

/**
 * Confirme le mot de passe utilisateur et télécharge le fichier schoolpay.sqlite.
 */
async function confirmerExportDb() {
  const inputMdp = document.getElementById('export-db-mdp');
  const mot_de_passe = inputMdp?.value;

  if (!mot_de_passe) {
    return notifier('Veuillez entrer votre mot de passe.', false);
  }

  const session = window.SchoolPayAuth?.obtenirSession();
  const nom_utilisateur = session?.nom_utilisateur;

  if (!nom_utilisateur) {
    return notifier('Session introuvable. Veuillez vous reconnecter.', false);
  }

  try {
    const reponse = await fetch('/api/exporter-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom_utilisateur, mot_de_passe })
    });

    if (!reponse.ok) {
      const data = await reponse.json().catch(() => null);
      const message = data?.erreur || 'Mot de passe incorrect ou erreur d\'exportation';
      return notifier(message, false);
    }

    const blob = await reponse.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schoolpay.sqlite';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    fermerModaleExportDb();
    notifier('Base de données exportée avec succès.');
  } catch (erreur) {
    notifier(`Erreur lors de l'exportation : ${erreur.message}`, false);
  }
}

/**
 * Envoie une requête de log au backend.
 * @param {string} action - Le type d'action à journaliser
 * @param {string} [reference_action='-'] - Référence contextuelle
 */
async function enregistrerLog(action, reference_action = '-') {
  const session = window.SchoolPayAuth?.obtenirSession();
  const nom_utilisateur = session?.nom_utilisateur;
  if (!nom_utilisateur) return;
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom_utilisateur, action, reference_action })
    });
  } catch (e) {
    console.error('Erreur lors de la journalisation :', e);
  }
}

/**
 * Affiche un message indiquant que la fonction Cloud n'est pas active.
 * Cette fonction sert de stub pour futures évolutions.
 */
function exporterCloud() {
  notifier('Fonction Cloud non disponible dans cette version.');
}

/**
 * Initialise la page courante en fonction de l'URL.
 * Se charge d'attacher les listeners et de charger les données nécessaires.
 */
function initialiserPage() {
  const chemin = decodeURIComponent(window.location.pathname.toLowerCase());
  if (chemin.endsWith('/index.html') || chemin === '/' || chemin.endsWith('/')) {
    chargerTransactionsRecentes();
  }
  if (chemin.endsWith('paiement.html')) {
    chargerClassesEtEleves();
    document.getElementById('btn-valider-paiement')?.addEventListener('click', validerPaiement);
    const dateInput = document.getElementById('date-input');
    if (dateInput) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
  }
  if (chemin.endsWith('journal de caisse.html')) {
    chargerJournal();
    window.exporterCloud = exporterCloud;
  }
  if (chemin.endsWith('modifier.html')) {
    chargerClassesEtEleves();
    chargerCaissiers();
    document.getElementById('btn-ajouter-eleve')?.addEventListener('click', ajouterEleve);
    // Le clic ouvre d'abord la modale de confirmation administrateur (sécurité) ;
    // la création réelle du caissier n'a lieu qu'après validation du mot de passe.
    document.getElementById('btn-ajouter-caissier')?.addEventListener('click', () => ouvrirModaleAdmin('creer-caissier'));
    document.getElementById('btn-modal-confirmer')?.addEventListener('click', confirmerModaleAdmin);
    document.getElementById('btn-modal-annuler')?.addEventListener('click', fermerModaleAdmin);

    // Exportation de la base de données avec confirmation par mot de passe
    document.getElementById('btn-exporter-db')?.addEventListener('click', ouvrirModaleExportDb);
    document.getElementById('btn-export-db-confirmer')?.addEventListener('click', confirmerExportDb);
    document.getElementById('btn-export-db-annuler')?.addEventListener('click', fermerModaleExportDb);
    document.getElementById('export-db-mdp')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmerExportDb();
      }
    });
  }

  // Intercepter les événements d'impression pour enregistrer les logs
  if (chemin.endsWith('facture.html')) {
    // Si on est sur la facture, log impression_recu
    const params = new URLSearchParams(window.location.search);
    const numero_recu = params.get('numero') || '-';
    window.addEventListener('beforeprint', () => {
      enregistrerLog('impression_recu', numero_recu);
    });
  } else if (chemin.endsWith('fiche_eleve.html')) {
    // Si on est sur la fiche élève, log impression_releve
    const params = new URLSearchParams(window.location.search);
    const id_eleve = params.get('id') || '-';
    window.addEventListener('beforeprint', () => {
      enregistrerLog('impression_releve', id_eleve);
    });
  } else if (chemin.endsWith('rapport.html')) {
    // Si on est sur un rapport
    window.addEventListener('beforeprint', () => {
      enregistrerLog('impression_rapport', 'journalier');
    });
  } else if (chemin.endsWith('situation_generale.html')) {
    // Si on est sur la situation générale
    window.addEventListener('beforeprint', () => {
      const periode = document.getElementById('filtre-periode')?.value || 'annuel';
      enregistrerLog('impression_rapport', `situation_${periode}`);
    });
  }
}

window.addEventListener('DOMContentLoaded', initialiserPage);
