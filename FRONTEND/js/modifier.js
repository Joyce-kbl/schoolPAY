(function () {
  async function chargerClassesEtEleves() {
    try {
      const classesData = await window.SchoolPayApp?.apiFetch('/api/classes');
      const elevesData = await window.SchoolPayApp?.apiFetch('/api/eleves');

      const selectClasses = document.getElementById('classe-select');
      const selectEleves = document.getElementById('eleve-select');
      const selectElevesAdmin = document.getElementById('nouvel-eleve-classe');

      if (selectClasses) {
        selectClasses.innerHTML = '<option value="">Sélectionner la classe...</option>';
        for (const classe of classesData.donnees || []) {
          const option = document.createElement('option');
          option.value = classe.id;
          option.textContent = `${classe.nom} (${window.SchoolPayApp?.formatMonnaie(classe.montant_frais) || classe.montant_frais})`;
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
      window.alert(`Impossible de charger les classes ou élèves : ${erreur.message}`);
    }
  }

  async function ajouterEleve() {
    const nom_complet = document.getElementById('nouvel-eleve-nom')?.value.trim();
    const sexe = document.getElementById('nouvel-eleve-sexe')?.value;
    const classe_id = Number(document.getElementById('nouvel-eleve-classe')?.value || 0);
    if (!nom_complet || !sexe || !classe_id) {
      return window.alert('Veuillez remplir le nom, le sexe et la classe.');
    }

    try {
      const session = window.SchoolPayAuth?.obtenirSession();
      const caissier = session?.nom_utilisateur || '';
      const reponse = await window.SchoolPayApp?.apiFetch('/api/eleves', {
        method: 'POST',
        body: JSON.stringify({ nom_complet, sexe, classe_id, caissier })
      });
      window.alert(`Élève ajouté avec succès. Matricule : ${reponse.donnees.matricule}`);
      document.getElementById('nouvel-eleve-nom').value = '';
      document.getElementById('nouvel-eleve-sexe').value = '';
      document.getElementById('nouvel-eleve-classe').value = '';
      await chargerClassesEtEleves();
    } catch (erreur) {
      window.alert(`Impossible d'ajouter l'élève : ${erreur.message}`);
    }
  }

  async function chargerCaissiers() {
    const conteneur = document.getElementById('liste-caissiers');
    if (!conteneur) return;
    try {
      const donnees = await window.SchoolPayApp?.apiFetch('/api/caissiers');
      const lignes = (donnees.donnees || []).filter((c) => c.actif);
      if (lignes.length === 0) {
        conteneur.innerHTML = '<p style="color:#94a3b8;">Aucun caissier enregistré.</p>';
        return;
      }
      conteneur.innerHTML = lignes.map((c) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9;">
          <span><strong>${c.nom_complet}</strong> <span style="color:#94a3b8;">(${c.nom_utilisateur})</span></span>
          <button data-id="${c.id}" class="btn-suppr-caissier" style="background:#fef2f2;color:#b91c1c;border:none;border-radius:8px;padding:6px 10px;cursor:pointer;">Retirer</button>
        </div>
      `).join('');
      conteneur.querySelectorAll('.btn-suppr-caissier').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!window.confirm('Retirer ce caissier ? Il ne pourra plus se connecter.')) return;
          ouvrirModaleAdmin('supprimer-caissier', btn.dataset.id);
        });
      });
    } catch (erreur) {
      conteneur.innerHTML = '<p style="color:#b91c1c;">Impossible de charger les caissiers.</p>';
    }
  }

  const ADMIN_UTILISATEUR = 'José';
  const ADMIN_MOT_DE_PASSE = 'cicm@';
  let actionAdminEnAttente = null;
  let idCaissierASupprimer = null;

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

  function fermerModaleAdmin() {
    const modale = document.getElementById('modal-admin');
    if (modale) modale.style.display = 'none';
    actionAdminEnAttente = null;
    idCaissierASupprimer = null;
  }

  async function ajouterCaissier() {
    const nom_utilisateur = document.getElementById('nouveau-caissier-utilisateur')?.value.trim();
    const nom_complet = document.getElementById('nouveau-caissier-nom')?.value.trim();
    const mot_de_passe = document.getElementById('nouveau-caissier-mdp')?.value;
    if (!nom_utilisateur || !nom_complet || !mot_de_passe) {
      return window.alert('Veuillez renseigner l\'identifiant, le nom complet et le mot de passe.');
    }
    try {
      const session = window.SchoolPayAuth?.obtenirSession();
      const caissier = session?.nom_utilisateur || '';
      await window.SchoolPayApp?.apiFetch('/api/caissiers', {
        method: 'POST',
        body: JSON.stringify({ nom_utilisateur, nom_complet, mot_de_passe, caissier })
      });
      window.alert('Caissier créé avec succès.');
      await chargerCaissiers();
    } catch (erreur) {
      window.alert(`Impossible de créer le caissier : ${erreur.message}`);
    }
  }

  async function confirmerModaleAdmin() {
    const utilisateur = document.getElementById('admin-utilisateur')?.value.trim();
    const motDePasse = document.getElementById('admin-mdp')?.value;

    if (utilisateur !== ADMIN_UTILISATEUR || motDePasse !== ADMIN_MOT_DE_PASSE) {
      window.alert('Identifiant ou mot de passe administrateur incorrect.');
      return;
    }

    const action = actionAdminEnAttente;
    const idCible = idCaissierASupprimer;
    fermerModaleAdmin();

    if (action === 'supprimer-caissier') {
      try {
        await window.SchoolPayApp?.apiFetch(`/api/caissiers/${idCible}`, { method: 'DELETE' });
        await window.enregistrerLog?.('suppression_caissier', idCible);
        await chargerCaissiers();
      } catch (erreur) {
        window.alert(`Impossible de retirer ce caissier : ${erreur.message}`);
      }
    } else {
      ajouterCaissier();
    }
  }

  function ouvrirModaleExportDb() {
    const modale = document.getElementById('modal-export-db');
    if (!modale) return;
    const inputMdp = document.getElementById('export-db-mdp');
    if (inputMdp) inputMdp.value = '';
    modale.style.display = 'flex';
    if (inputMdp) inputMdp.focus();
  }

  function fermerModaleExportDb() {
    const modale = document.getElementById('modal-export-db');
    if (modale) modale.style.display = 'none';
    const inputMdp = document.getElementById('export-db-mdp');
    if (inputMdp) inputMdp.value = '';
  }

  async function confirmerExportDb() {
    const inputMdp = document.getElementById('export-db-mdp');
    const mot_de_passe = inputMdp?.value;
    if (!mot_de_passe) {
      return window.alert('Veuillez entrer votre mot de passe.');
    }

    const session = window.SchoolPayAuth?.obtenirSession();
    const nom_utilisateur = session?.nom_utilisateur;
    if (!nom_utilisateur) {
      return window.alert('Session introuvable. Veuillez vous reconnecter.');
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
        return window.alert(message);
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
      window.alert('Base de données exportée avec succès.');
    } catch (erreur) {
      window.alert(`Erreur lors de l'exportation : ${erreur.message}`);
    }
  }

  document.getElementById('btn-ajouter-eleve')?.addEventListener('click', ajouterEleve);
  document.getElementById('btn-ajouter-caissier')?.addEventListener('click', () => ouvrirModaleAdmin('creer-caissier'));
  document.getElementById('btn-modal-confirmer')?.addEventListener('click', confirmerModaleAdmin);
  document.getElementById('btn-modal-annuler')?.addEventListener('click', fermerModaleAdmin);
  document.getElementById('btn-exporter-db')?.addEventListener('click', ouvrirModaleExportDb);
  document.getElementById('btn-export-db-confirmer')?.addEventListener('click', confirmerExportDb);
  document.getElementById('btn-export-db-annuler')?.addEventListener('click', fermerModaleExportDb);
  document.getElementById('export-db-mdp')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmerExportDb();
    }
  });

  chargerClassesEtEleves();
  chargerCaissiers();
})();
