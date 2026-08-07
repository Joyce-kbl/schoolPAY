(function () {
  const sessionActuelle = window.SchoolPayAuth?.obtenirSession();
  const nomCaissier = document.getElementById('nom-caissier-connecte');
  if (nomCaissier && sessionActuelle) {
    nomCaissier.textContent = sessionActuelle.nom_complet;
  }

  const btnDeconnexion = document.getElementById('btn-deconnexion');
  if (btnDeconnexion) {
    btnDeconnexion.addEventListener('click', function (e) {
      e.preventDefault();
      window.SchoolPayAuth?.deconnecter();
    });
  }

  let rechercheTimer = null;
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchResults = document.getElementById('search-results');

  function viderRecherche() {
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    masquerResultats();
  }

  function masquerResultats() {
    if (searchResults) {
      searchResults.style.display = 'none';
      searchResults.innerHTML = '';
    }
  }

  async function lancerRecherche(terme) {
    if (!searchResults) return;
    searchResults.style.display = 'block';
    searchResults.innerHTML = '<div class="search-empty">Recherche en cours...</div>';
    try {
      const res = await fetch(`/api/eleves?q=${encodeURIComponent(terme)}`);
      const data = await res.json();
      const eleves = data.donnees || [];
      if (eleves.length === 0) {
        searchResults.innerHTML = `<div class="search-empty">Aucun élève trouvé pour "${terme}"</div>`;
        return;
      }
      searchResults.innerHTML = '';
      eleves.forEach((eleve) => {
        const initiales = eleve.nom_complet.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div class="result-avatar">${initiales}</div>
          <div>
            <div class="result-name">${eleve.nom_complet}</div>
            <div class="result-meta">${eleve.nom_classe || 'Classe inconnue'} · ${eleve.matricule || '—'}</div>
          </div>`;
        item.addEventListener('click', () => {
          window.location.href = `fiche_eleve.html?id=${eleve.id}`;
        });
        searchResults.appendChild(item);
      });
    } catch (err) {
      searchResults.innerHTML = '<div class="search-empty">Erreur de connexion</div>';
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      const val = this.value.trim();
      if (searchClear) searchClear.style.display = val ? 'block' : 'none';
      clearTimeout(rechercheTimer);
      if (val.length < 2) {
        masquerResultats();
        return;
      }
      rechercheTimer = setTimeout(() => lancerRecherche(val), 300);
    });

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') viderRecherche();
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-box') && !e.target.closest('#search-results')) {
      masquerResultats();
    }
  });

  const clearBtn = document.getElementById('search-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', viderRecherche);
  }
})();
