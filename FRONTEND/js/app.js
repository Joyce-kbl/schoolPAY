// Paramètres de l'interface frontend.
// API_BASE_URL reste vide ici car le frontend est servi depuis le même serveur que le backend.
const API_BASE_URL = '';

let recuASupprimerId = null;
let recuASupprimerNumero = null;
let recuASupprimerMontant = null;

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
/*function notifier(message, succes = true) {
  if (window.alert) {
    window.alert(message);
  }
  console[succes ? 'log' : 'error'](message);
}*/
/**function notifier(message, succes = true) {
    console[succes ? 'log' : 'error'](message);
}**/
function notifier(message, succes = true) {
  const notif = document.getElementById('notification');

  notif.textContent = message;
  notif.className = succes
    ? 'notification success'
    : 'notification error';

  notif.style.display = 'block';

  setTimeout(() => {
    notif.style.display = 'none';
  }, 3000);

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
  // Gestion propre des statuts sans contenu (204) ou des réponses vides
  if (reponse.status === 204) return null;
  return reponse.json().catch(() => null);
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

    const lignes = (donnees.donnees || []).slice(0, 20);
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
        <td style="white-space:nowrap; display:flex; gap: 20px; justify-content: center;">
          <button type="button" class="btn-reimprimer-recu" data-numero="${paiement.numero_recu || ''}">Réimprimer le reçu</button>
          <button type="button" class="btn-supprimer-recu" data-id="${paiement.id}" data-numero="${paiement.numero_recu || ''}" data-montant="${paiement.montant || 0}" style="background:#fef2f2; color:#b91c1c; border:none; border-radius:8px; padding:8px 10px; font-size:11px; font-weight:700; cursor:pointer; margin-left: 5px;">Supprimer</button>
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

    tableau.querySelectorAll('.btn-supprimer-recu').forEach((bouton) => {
      bouton.addEventListener('click', () => {
        const id = bouton.dataset.id;
        const numeroRecu = bouton.dataset.numero;
        const montant = bouton.dataset.montant;
        ouvrirModaleSuppression(id, numeroRecu, montant);
      });
    });
  } catch (erreur) {
    notifier(`Impossible de charger les transactions : ${erreur.message}`, false);
  }
}

//Fonction pour réimprimer un reçu
function reimprimerRecu(numeroRecu) {
  const numeroFacture = encodeURIComponent(numeroRecu).slice(0, 6)
  const url = `facture.html?numero=${numeroFacture}&source=reimpression`;
  //const url = `recu.html?numero=${encodeURIComponent(numeroRecu)}&source=reimpression`;
  //  const url = `recu.html?numero=${encodeURIComponent(numeroRecu)}&source=reimpression&auto_print=1`;
  //window.open(url, '_blank', 'noopener,noreferrer');
  window.location.href = url
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
  const ancien_nouveau = document.getElementById('nouvel-eleve-statut')?.value || 'N';
  const classe_id = Number(document.getElementById('nouvel-eleve-classe')?.value || 0);
  if (!nom_complet || !sexe || !classe_id) {
    return notifier('Veuillez remplir le nom, le sexe et la classe.', false);
  }

  try {
    const session = window.SchoolPayAuth?.obtenirSession();
    const caissier = session?.nom_utilisateur || '';
    const reponse = await apiFetch('/api/eleves', {
      method: 'POST',
      body: JSON.stringify({ nom_complet, sexe, ancien_nouveau, classe_id, caissier })
    });
    notifier(`Élève ajouté avec succès. Matricule : ${reponse.donnees.matricule}`);
    // Le formulaire est vidé juste après l'enregistrement pour un rendu plus
    // professionnel et éviter tout double-ajout accidentel du même élève.
    document.getElementById('nouvel-eleve-nom').value = '';
    document.getElementById('nouvel-eleve-sexe').value = '';
    document.getElementById('nouvel-eleve-statut').value = 'N';
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

    const sessionActuelle = window.SchoolPayAuth?.obtenirSession();
    const estSeulCaissier = (lignes.length === 1);

    conteneur.innerHTML = lignes.map(c => {
      const estConnecte = Boolean(sessionActuelle && (c.nom_utilisateur === sessionActuelle.nom_utilisateur || c.id === sessionActuelle.id));
      
      let boutonAction = '';
      if (estConnecte) {
        boutonAction = `<span style="font-size:11px; font-weight:700; color:#059669; background:#ecfdf5; padding:4px 8px; border-radius:6px;">Connecté (Vous)</span>`;
      } else if (estSeulCaissier) {
        boutonAction = `<button type="button" disabled title="Impossible de retirer le seul caissier actif du système" style="background:#f1f5f9;color:#94a3b8;border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:not-allowed;">Retirer</button>`;
      } else {
        boutonAction = `<button type="button" data-id="${c.id}" data-nom="${c.nom_complet}" data-utilisateur="${c.nom_utilisateur}" class="btn-suppr-caissier" style="background:#fef2f2;color:#b91c1c;border:none;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;">Retirer</button>`;
      }

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span><strong>${c.nom_complet}</strong> <span style="color:#94a3b8;">(@${c.nom_utilisateur})</span></span>
          <div>${boutonAction}</div>
        </div>
      `;
    }).join('');

    conteneur.querySelectorAll('.btn-suppr-caissier').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const nom = btn.dataset.nom;
        const utilisateur = btn.dataset.utilisateur;
        ouvrirModaleAdmin('supprimer-caissier', id, { nom, utilisateur });
      });
    });
  } catch (erreur) {
    conteneur.innerHTML = '<p style="color:#b91c1c;">Impossible de charger les caissiers.</p>';
  }
}

/**
 * Valide les champs du formulaire de création de caissier avant d'ouvrir la modale admin.
 * @returns {{ valide: boolean, erreur?: string, nom_utilisateur?: string, nom_complet?: string, mot_de_passe?: string }}
 */
function validerSaisieNouveauCaissier() {
  const nom_utilisateur = document.getElementById('nouveau-caissier-utilisateur')?.value.trim().toLowerCase();
  const nom_complet = document.getElementById('nouveau-caissier-nom')?.value.trim();
  const mot_de_passe = document.getElementById('nouveau-caissier-mdp')?.value;

  if (!nom_utilisateur || !nom_complet || !mot_de_passe) {
    return { valide: false, erreur: 'Veuillez renseigner l\'identifiant, le nom complet et le mot de passe.' };
  }
  if (!/^[a-z0-9._-]+$/i.test(nom_utilisateur)) {
    return { valide: false, erreur: 'L\'identifiant ne peut contenir que des lettres, chiffres, points, tirets ou underscores (sans espaces).' };
  }
  if (mot_de_passe.length < 4) {
    return { valide: false, erreur: 'Le mot de passe doit comporter au moins 4 caractères.' };
  }
  return { valide: true, nom_utilisateur, nom_complet, mot_de_passe };
}

/**
 * Enregistre un nouveau caissier via l'API et actualise la liste.
 */
async function ajouterCaissier() {
  const validation = validerSaisieNouveauCaissier();
  if (!validation.valide) {
    return notifier(validation.erreur, false);
  }

  const { nom_utilisateur, nom_complet, mot_de_passe } = validation;

  try {
    const session = window.SchoolPayAuth?.obtenirSession();
    const caissier = session?.nom_utilisateur || '';
    const resultat = await apiFetch('/api/caissiers', {
      method: 'POST',
      body: JSON.stringify({ nom_utilisateur, nom_complet, mot_de_passe, caissier })
    });

    const msg = resultat?.donnees?.message || 'Caissier enregistré avec succès.';
    notifier(msg, true);

    // Réinitialisation sécurisée des champs de saisie pour ne pas laisser de mot de passe dans le DOM
    const inputUtilisateur = document.getElementById('nouveau-caissier-utilisateur');
    const inputNom = document.getElementById('nouveau-caissier-nom');
    const inputMdp = document.getElementById('nouveau-caissier-mdp');
    if (inputUtilisateur) inputUtilisateur.value = '';
    if (inputNom) inputNom.value = '';
    if (inputMdp) inputMdp.value = '';

    await chargerCaissiers();
  } catch (erreur) {
    notifier(`Impossible d'enregistrer le caissier : ${erreur.message}`, false);
  }
}

/**
 * Vérifie les identifiants administrateur / économe auprès du backend de manière asynchrone et sécurisée.
 * @param {string} nom_utilisateur - Nom d'utilisateur de l'administrateur
 * @param {string} mot_de_passe - Mot de passe en clair à faire vérifier par le backend
 * @returns {Promise<{valide: boolean, erreur?: string}>} Résultat de validation sans exposition de données sensibles
 */
async function verifierAdminBackend(nom_utilisateur, mot_de_passe) {
  try {
    const res = await fetch('/api/auth/verifier-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom_utilisateur, mot_de_passe })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.valide) {
      return { valide: false, erreur: data.erreur || 'Identifiant ou mot de passe Économe incorrect.' };
    }
    return { valide: true };
  } catch (err) {
    return { valide: false, erreur: 'Erreur de communication avec le serveur : ' + err.message };
  }
}

let actionAdminEnAttente = null;
let idCaissierASupprimer = null;
let metadataActionAdmin = null;

/**
 * Ouvre la modale de confirmation administrateur avec un contexte personnalisé.
 * @param {string} action - 'creer-caissier' ou 'supprimer-caissier'
 * @param {string|number} [idCible] - id du caissier concerné (pour la suppression)
 * @param {Object} [metadata] - Métadonnées (nom, identifiant) du caissier concerné
 */
function ouvrirModaleAdmin(action = 'creer-caissier', idCible = null, metadata = null) {
  const modale = document.getElementById('modal-admin');
  if (!modale) return;
  actionAdminEnAttente = action;
  idCaissierASupprimer = idCible;
  metadataActionAdmin = metadata;

  const titreEl = document.getElementById('admin-modal-titre');
  const descEl = document.getElementById('admin-modal-description');
  const inputUtilisateur = document.getElementById('admin-utilisateur');
  const inputMdp = document.getElementById('admin-mdp');

  if (action === 'supprimer-caissier') {
    if (titreEl) titreEl.textContent = '🔒 Confirmation — Retirer un caissier';
    if (descEl) {
      const nom = metadata?.nom || 'ce caissier';
      const user = metadata?.utilisateur ? `(@${metadata.utilisateur})` : '';
      descEl.innerHTML = `Êtes-vous sûr de vouloir retirer le caissier <strong>${nom}</strong> ${user} ? Il ne pourra plus se connecter. Confirmez votre identité Econome :`;
    }
  } else if (action === 'exporter-db') {
    if (titreEl) titreEl.textContent = '🔒 Confirmation — Exporter la base de données';
    if (descEl) {
      descEl.innerHTML = `L'exportation de la base de données est une opération sensible réservée à l'Économe. Veuillez confirmer vos identifiants administrateur :`;
    }
  } else {
    if (titreEl) titreEl.textContent = '🔒 Confirmation — Créer un caissier';
    if (descEl) {
      const nom = metadata?.nom || 'ce caissier';
      const user = metadata?.utilisateur ? `(@${metadata.utilisateur})` : '';
      descEl.innerHTML = `Veuillez confirmer vos identifiants Econome pour autoriser l'enregistrement du compte <strong>${nom}</strong> ${user} :`;
    }
  }

  if (inputUtilisateur) inputUtilisateur.value = '';
  if (inputMdp) inputMdp.value = '';
  modale.style.display = 'flex';
  if (inputUtilisateur) inputUtilisateur.focus();
}

/**
 * Ferme la modale de confirmation administrateur et réinitialise l'état.
 */
function fermerModaleAdmin() {
  const modale = document.getElementById('modal-admin');
  if (modale) modale.style.display = 'none';
  actionAdminEnAttente = null;
  idCaissierASupprimer = null;
  metadataActionAdmin = null;
  const inputUtilisateur = document.getElementById('admin-utilisateur');
  const inputMdp = document.getElementById('admin-mdp');
  if (inputUtilisateur) inputUtilisateur.value = '';
  if (inputMdp) inputMdp.value = '';
}

/**
 * Vérifie les identifiants administrateur saisis dans la modale via l'API backend sécurisée.
 * Si valides, ferme la modale et exécute l'action en attente.
 */
async function confirmerModaleAdmin() {
  const utilisateur = document.getElementById('admin-utilisateur')?.value.trim();
  const motDePasse = document.getElementById('admin-mdp')?.value;

  if (!utilisateur || !motDePasse) {
    notifier('Identifiant et mot de passe Econome requis.', false);
    return;
  }

  const btnConfirmer = document.getElementById('btn-modal-confirmer');
  if (btnConfirmer) {
    btnConfirmer.disabled = true;
    btnConfirmer.textContent = 'Vérification...';
  }

  try {
    const verification = await verifierAdminBackend(utilisateur, motDePasse);
    if (!verification.valide) {
      notifier(verification.erreur || 'Identifiant ou mot de passe Econome incorrect.', false);
      const inputMdp = document.getElementById('admin-mdp');
      if (inputMdp) inputMdp.value = '';
      return;
    }

    const action = actionAdminEnAttente;
    const idCible = idCaissierASupprimer;
    const metadata = metadataActionAdmin;
    fermerModaleAdmin();

    if (action === 'supprimer-caissier') {
      try {
        const res = await apiFetch(`/api/caissiers/${idCible}`, { method: 'DELETE' });
        const refLog = metadata?.nom
          ? `${metadata.nom} (@${metadata.utilisateur || '-'}) [ID:${idCible}]`
          : String(idCible);
        await enregistrerLog('suppression_caissier', refLog);
        const msg = res?.message || 'Caissier retiré avec succès.';
        notifier(msg, true);
        await chargerCaissiers();
      } catch (erreur) {
        notifier(`Impossible de retirer ce caissier : ${erreur.message}`, false);
      }
    } else if (action === 'exporter-db') {
      try {
        const reponse = await fetch('/api/exporter-base', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nom_utilisateur: utilisateur, mot_de_passe: motDePasse })
        });

        if (!reponse.ok) {
          const data = await reponse.json().catch(() => null);
          const message = data?.erreur || 'Erreur lors de l\'exportation de la base de données.';
          return notifier(message, false);
        }

        const blob = await reponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'schoolpay_nathmn14.db';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        notifier('Base de données exportée avec succès.', true);
      } catch (erreur) {
        notifier(`Erreur lors de l'exportation : ${erreur.message}`, false);
      }
    } else {
      ajouterCaissier();
    }
  } finally {
    if (btnConfirmer) {
      btnConfirmer.disabled = false;
      btnConfirmer.textContent = 'Confirmer';
    }
  }
}

/**
/**
 * Ouvre la modale de confirmation administrateur pour la suppression de reçu.
 */
function ouvrirModaleSuppression(id, numero, montant) {
  const modale = document.getElementById('modal-suppression-recu');
  if (!modale) return;
  recuASupprimerId = id;
  recuASupprimerNumero = numero;
  recuASupprimerMontant = montant;
  const inputUtilisateur = document.getElementById('admin-suppr-utilisateur');
  const inputMdp = document.getElementById('admin-suppr-mdp');
  if (inputUtilisateur) inputUtilisateur.value = '';
  if (inputMdp) inputMdp.value = '';
  modale.style.display = 'flex';
  if (inputUtilisateur) inputUtilisateur.focus();
}

/**
 * Ferme la modale de confirmation administrateur pour la suppression de reçu.
 */
function fermerModaleSuppression() {
  const modale = document.getElementById('modal-suppression-recu');
  if (modale) modale.style.display = 'none';
  recuASupprimerId = null;
  recuASupprimerNumero = null;
  recuASupprimerMontant = null;
  const inputUtilisateur = document.getElementById('admin-suppr-utilisateur');
  const inputMdp = document.getElementById('admin-suppr-mdp');
  if (inputUtilisateur) inputUtilisateur.value = '';
  if (inputMdp) inputMdp.value = '';
}

/**
 * Confirme les identifiants administrateur et procède à la suppression sécurisée du reçu.
 */
async function confirmerSuppression() {
  const utilisateur = document.getElementById('admin-suppr-utilisateur')?.value.trim();
  const motDePasse = document.getElementById('admin-suppr-mdp')?.value;

  if (!utilisateur || !motDePasse) {
    return notifier('Identifiant et mot de passe Econome requis.', false);
  }

  const btnConfirmer = document.getElementById('btn-suppr-confirmer');
  if (btnConfirmer) {
    btnConfirmer.disabled = true;
    btnConfirmer.textContent = 'Vérification...';
  }

  try {
    const verification = await verifierAdminBackend(utilisateur, motDePasse);
    if (!verification.valide) {
      notifier(verification.erreur || 'Identifiant ou mot de passe Econome incorrect.', false);
      const inputMdp = document.getElementById('admin-suppr-mdp');
      if (inputMdp) inputMdp.value = '';
      return;
    }

    const id = recuASupprimerId;
    const numero = recuASupprimerNumero;
    const montant = recuASupprimerMontant;

    fermerModaleSuppression();

    // 1. Journalisation de l'action avec référence [numero_recu] --- [montant]
    const reference = `${numero} --- ${montant}$`;
    await enregistrerLog('suppression_paiement', reference);

    // 2. Appel de l'API DELETE du backend
    const reponse = await fetch(`/api/paiements/${id}`, {
      method: 'DELETE'
    });

    if (!reponse.ok) {
      const data = await reponse.json().catch(() => null);
      throw new Error(data?.erreur || `Code statut : ${reponse.status}`);
    }

    // 3. Notification utilisateur et rafraîchissement du tableau
    notifier(`Nous avons supprimé le reçu ${numero} avec succès !`, true);
    await chargerTransactionsRecentes();
  } catch (erreur) {
    notifier(`Erreur : nous n'avons pas pu supprimer ce reçu : ${erreur.message}`, false);
  } finally {
    if (btnConfirmer) {
      btnConfirmer.disabled = false;
      btnConfirmer.textContent = 'Confirmer';
    }
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
    document.getElementById('btn-suppr-confirmer')?.addEventListener('click', confirmerSuppression);
    document.getElementById('btn-suppr-annuler')?.addEventListener('click', fermerModaleSuppression);
    document.getElementById('admin-suppr-mdp')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmerSuppression();
      }
    });
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

    // Validation préalable des champs du caissier AVANT d'ouvrir la modale administrateur
    document.getElementById('btn-ajouter-caissier')?.addEventListener('click', () => {
      const validation = validerSaisieNouveauCaissier();
      if (!validation.valide) {
        return notifier(validation.erreur, false);
      }
      ouvrirModaleAdmin('creer-caissier', null, { nom: validation.nom_complet, utilisateur: validation.nom_utilisateur });
    });

    document.getElementById('nouveau-caissier-mdp')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const validation = validerSaisieNouveauCaissier();
        if (!validation.valide) {
          return notifier(validation.erreur, false);
        }
        ouvrirModaleAdmin('creer-caissier', null, { nom: validation.nom_complet, utilisateur: validation.nom_utilisateur });
      }
    });

    document.getElementById('btn-modal-confirmer')?.addEventListener('click', confirmerModaleAdmin);
    document.getElementById('btn-modal-annuler')?.addEventListener('click', fermerModaleAdmin);
    document.getElementById('admin-mdp')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmerModaleAdmin();
      }
    });

    // Fermeture de la modale admin au clic sur l'arrière-plan
    document.getElementById('modal-admin')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) fermerModaleAdmin();
    });

    // Exportation de la base de données réservée à l'administrateur (Économe)
    document.getElementById('btn-exporter-db')?.addEventListener('click', () => {
      ouvrirModaleAdmin('exporter-db');
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
      enregistrerLog('impression_rapport', 'situation_2026-2027');
    });
  }
}

window.addEventListener('DOMContentLoaded', initialiserPage);
