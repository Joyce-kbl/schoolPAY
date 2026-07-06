const API_BASE_URL = '';

function formatMonnaie(valeur, devise = 'USD') {
  const symbole = devise === 'CDF' ? 'CDF' : '$';
  return `${Number(valeur).toFixed(2).replace('.', ',')} ${symbole}`;
}

function notifier(message, succes = true) {
  if (window.alert) {
    window.alert(message);
  }
  console[succes ? 'log' : 'error'](message);
}

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

async function chargerTransactionsRecentes() {
  try {
    const donnees = await apiFetch('/api/paiements');
    const tableau = document.getElementById('liste-transactions');
    if (!tableau) return;
    tableau.innerHTML = '';
    const lignes = (donnees.donnees || []).slice(0, 6);
    if (lignes.length === 0) {
      tableau.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #64748b;">Aucune transaction enregistrée.</td></tr>';
      return;
    }
    for (const paiement of lignes) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${paiement.nom_eleve || '—'}</td>
        <td>${paiement.libelle}</td>
        <td style="text-align: right; font-weight:700;">${formatMonnaie(paiement.montant, paiement.devise)}</td>
      `;
      tableau.appendChild(tr);
    }
  } catch (erreur) {
    notifier(`Impossible de charger les transactions : ${erreur.message}`, false);
  }
}

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
        <td style="padding: 10px 0; text-align: right; font-weight:700;">${formatMonnaie(paiement.montant, paiement.devise)}</td>
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

async function validerPaiement() {
  const eleve_id = Number(document.getElementById('eleve-select')?.value || 0);
  const libelle = document.getElementById('frais-select')?.value || '';
  const montant = Number(document.getElementById('montant-input')?.value || 0);
  const devise = document.getElementById('devise-select')?.value || 'USD';
  const paye_le = document.getElementById('date-input')?.value || new Date().toISOString().slice(0, 10);

  if (!eleve_id || !libelle || !(montant > 0)) {
    return notifier('Veuillez sélectionner un élève, un type de frais et un montant valide.', false);
  }

  try {
    await apiFetch('/api/paiements', {
      method: 'POST',
      body: JSON.stringify({ eleve_id, libelle, montant, devise, paye_le })
    });
    notifier('Le paiement a été enregistré avec succès.');
    window.location.href = 'journal de caisse.html';
  } catch (erreur) {
    notifier(`Impossible d'enregistrer le paiement : ${erreur.message}`, false);
  }
}

async function ajouterClasse() {
  const nom = document.getElementById('nouvelle-classe-nom')?.value.trim();
  const montant_frais = Number(document.getElementById('nouvelle-classe-montant')?.value || 0);
  if (!nom || montant_frais <= 0) {
    return notifier('Veuillez renseigner le nom de la classe et un montant valide.', false);
  }
  try {
    await apiFetch('/api/classes', {
      method: 'POST',
      body: JSON.stringify({ nom, montant_frais })
    });
    notifier('Classe ajoutée avec succès.');
    await chargerClassesEtEleves();
  } catch (erreur) {
    notifier(`Impossible d'ajouter la classe : ${erreur.message}`, false);
  }
}

async function ajouterEleve() {
  const nom_complet = document.getElementById('nouvel-eleve-nom')?.value.trim();
  const sexe = document.getElementById('nouvel-eleve-sexe')?.value;
  const classe_id = Number(document.getElementById('nouvel-eleve-classe')?.value || 0);
  if (!nom_complet || !sexe || !classe_id) {
    return notifier('Veuillez remplir le nom, le sexe et la classe.', false);
  }
  
  try {
    const reponse = await apiFetch('/api/eleves', {
      method: 'POST',
      body: JSON.stringify({ nom_complet, sexe, classe_id })
    });
    notifier(`Élève ajouté avec succès. Matricule : ${reponse.donnees.matricule}`);
    await chargerClassesEtEleves();
  } catch (erreur) {
    notifier(`Impossible d'ajouter l'élève : ${erreur.message}`, false);
  }
}

function exporterCloud() {
  notifier('Fonction Cloud non disponible dans cette version.');
}

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
    document.getElementById('btn-ajouter-classe')?.addEventListener('click', ajouterClasse);
    document.getElementById('btn-ajouter-eleve')?.addEventListener('click', ajouterEleve);
  }
}

window.addEventListener('DOMContentLoaded', initialiserPage);
