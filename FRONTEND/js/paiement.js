(function () {
  let tousLesEleves = [];
  let toutesLesCategories = [];
  let resteScolaireEleveActuel = null;

  async function actualiserResteEleveActuel(eleve_id) {
    resteScolaireEleveActuel = null;
    if (!eleve_id) return;
    try {
      const res = await fetch(`/api/eleves/${eleve_id}/fiche`);
      const data = await res.json();
      if (res.ok && data.donnees) {
        const soldeScolaire = data.donnees.soldes.find((s) => s.categorie.toUpperCase().includes('FRAIS SCOLAIRES'));
        resteScolaireEleveActuel = soldeScolaire ? Number(soldeScolaire.reste) : Number(data.donnees.reste);
      }
    } catch (e) {
      console.error('Impossible de vérifier le reste des frais scolaires', e);
    }
  }

  function estLigneFraisScolaires(ligne) {
    const catId = ligne.querySelector('.cat-id');
    const libelle = (catId?.dataset.libelle || ligne.querySelector('.cat-input')?.value || '').toUpperCase();
    return libelle.includes('FRAIS SCOLAIRES');
  }

  function creerLigneOperation() {
    const div = document.createElement('div');
    div.className = 'row-2 operation-row';
    div.style.marginBottom = '10px';

    div.innerHTML = `
      <div class="form-group" style="margin-bottom: 0;">
        <input type="text" class="form-control cat-input" list="categories-datalist"
               placeholder="Code ou type de frais (ex: 78000)" autocomplete="off">
        <input type="hidden" class="cat-id">
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <input type="number" class="form-control montant-input" placeholder="0.00" min="0">
      </div>
      <button type="button" class="btn-supprimer-ligne" style="padding: 10px; background: #fef2f2; color: #b91c1c; border: none; border-radius: 12px; cursor: pointer;">X</button>`;

    const catInput = div.querySelector('.cat-input');
    const catId = div.querySelector('.cat-id');

    catInput.addEventListener('input', () => {
      const val = catInput.value.trim().toLowerCase();
      const trouve = toutesLesCategories.find((c) => `${c.code} — ${c.libelle}`.toLowerCase() === val || c.code.toLowerCase() === val || c.libelle.toLowerCase() === val);
      catId.value = trouve ? trouve.id : '';
      catId.dataset.libelle = trouve ? trouve.libelle : '';

      if (trouve && trouve.libelle.toUpperCase().includes('FRAIS SCOLAIRES') && resteScolaireEleveActuel !== null && resteScolaireEleveActuel <= 0) {
        alert('Les frais scolaires de cet élève sont déjà payés intégralement. Impossible de saisir un nouveau paiement pour cette catégorie.');
        catInput.value = '';
        catId.value = '';
        catId.dataset.libelle = '';
      }
    });

    const montantInput = div.querySelector('.montant-input');
    montantInput.addEventListener('input', () => {
      if (!estLigneFraisScolaires(div) || resteScolaireEleveActuel === null) return;
      const montant = Number(montantInput.value);
      if (montant > resteScolaireEleveActuel) {
        alert(`Le montant restant à payer pour les frais scolaires est ${resteScolaireEleveActuel.toFixed(2)} $. Veuillez saisir un montant inférieur ou égal.`);
        montantInput.value = resteScolaireEleveActuel > 0 ? resteScolaireEleveActuel : '';
      }
    });

    div.querySelector('.btn-supprimer-ligne').addEventListener('click', () => {
      if (document.querySelectorAll('.operation-row').length > 1) {
        div.remove();
      }
    });

    document.getElementById('operations-container').appendChild(div);
  }

  function remplirDatalistCategories() {
    const datalist = document.getElementById('categories-datalist');
    datalist.innerHTML = '';
    toutesLesCategories.forEach((c) => {
      const option = document.createElement('option');
      option.value = `${c.code} — ${c.libelle}`;
      datalist.appendChild(option);
    });
  }

  async function chargerDonnees() {
    const [classesRes, elevesRes, categoriesRes] = await Promise.all([
      fetch('/api/classes'),
      fetch('/api/eleves'),
      fetch('/api/categories-frais')
    ]);
    const classesData = await classesRes.json();
    const elevesData = await elevesRes.json();
    const categoriesData = await categoriesRes.json();

    tousLesEleves = elevesData.donnees || [];
    toutesLesCategories = categoriesData.donnees || [];

    const selectClasses = document.getElementById('classe-select');
    (classesData.donnees || []).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nom;
      selectClasses.appendChild(opt);
    });

    creerLigneOperation();
    remplirDatalistCategories();
  }

  function initRechercheEleve() {
    const searchInput = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const clear = document.getElementById('search-clear');
    let timer = null;

    function hide() {
      results.style.display = 'none';
      results.innerHTML = '';
    }

    searchInput.addEventListener('input', () => {
      const val = searchInput.value.trim();
      clear.style.display = val ? 'block' : 'none';
      clearTimeout(timer);
      if (val.length < 2) {
        hide();
        return;
      }
      timer = setTimeout(async () => {
        results.style.display = 'block';
        results.innerHTML = '<div class="search-empty">Recherche en cours...</div>';
        try {
          const res = await fetch(`/api/eleves?q=${encodeURIComponent(val)}`);
          const data = await res.json();
          const eleves = data.donnees || [];
          if (eleves.length === 0) {
            results.innerHTML = '<div class="search-empty">Aucun élève trouvé</div>';
            return;
          }
          results.innerHTML = '';
          eleves.forEach((eleve) => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `<div class="result-avatar">${(eleve.nom_complet || '—').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}</div><div><div class="result-name">${eleve.nom_complet}</div><div class="result-meta">${eleve.nom_classe || 'Classe inconnue'} · ${eleve.matricule || '—'}</div></div>`;
            item.addEventListener('click', () => {
              document.getElementById('search-input').value = eleve.nom_complet;
              document.getElementById('eleve-id-input').value = eleve.id;
              actualiserResteEleveActuel(eleve.id);
              hide();
            });
            results.appendChild(item);
          });
        } catch (e) {
          results.innerHTML = '<div class="search-empty">Erreur de connexion</div>';
        }
      }, 250);
    });

    clear.addEventListener('click', () => {
      searchInput.value = '';
      clear.style.display = 'none';
      hide();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box') && !e.target.closest('#search-results')) {
        hide();
      }
    });
  }

  function initPaiementSubmit() {
    const button = document.getElementById('btn-valider-paiement');
    if (!button) return;

    button.addEventListener('click', async () => {
      const eleve_id = Number(document.getElementById('eleve-id-input')?.value || 0);
      const deposant = document.getElementById('deposant-input')?.value || '';
      const dateInput = document.getElementById('date-input')?.value || new Date().toISOString().slice(0, 10);
      const operations = Array.from(document.querySelectorAll('.operation-row')).map((row) => ({
        categorie_id: row.querySelector('.cat-id')?.value || '',
        montant: Number(row.querySelector('.montant-input')?.value || 0)
      })).filter((op) => op.categorie_id && op.montant > 0);

      if (!eleve_id || operations.length === 0) {
        alert('Veuillez sélectionner un élève et saisir au moins une opération valide.');
        return;
      }

      button.disabled = true;
      button.textContent = 'Enregistrement...';

      try {
        const session = window.SchoolPayAuth?.obtenirSession();
        const caissier = session?.nom_utilisateur || '';
        const res = await fetch('/api/paiements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eleve_id, deposant, paye_le: dateInput, caissier, operations })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.erreur || 'Échec de l’enregistrement du paiement');
        document.getElementById('success-details').textContent = `Le paiement a été enregistré avec succès (référence ${data.donnees?.numero_recu || '—'}).`;
        document.getElementById('success-overlay').style.display = 'flex';
        document.getElementById('btn-voir-facture').href = `recu.html?numero=${encodeURIComponent(data.donnees?.numero_recu || '')}`;
      } catch (err) {
        alert(err.message);
      } finally {
        button.disabled = false;
        button.textContent = '✅ VALIDER LE PAIEMENT';
      }
    });
  }

  document.getElementById('btn-ajouter-ligne')?.addEventListener('click', creerLigneOperation);
  document.getElementById('date-input').value = new Date().toISOString().slice(0, 10);

  initRechercheEleve();
  initPaiementSubmit();
  chargerDonnees();
})();
