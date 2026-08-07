(function () {
  let tousLesPaiements = [];
  let ongletActifJournal = 'synthese';
  let dernieresSyntheseDonnees = [];

  function afficherOngletJournal(onglet) {
    ongletActifJournal = onglet;
    document.querySelectorAll('.tab-btn').forEach(function (bouton) {
      bouton.classList.toggle('active', bouton.dataset.tab === onglet);
    });
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'panel-' + onglet);
    });
  }

  function initialiserOngletsJournal() {
    document.querySelectorAll('.tab-btn').forEach(function (bouton) {
      bouton.addEventListener('click', function () { afficherOngletJournal(bouton.dataset.tab); });
    });
    afficherOngletJournal(ongletActifJournal);
  }

  function formatMonnaie(val) {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' $';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('fr-FR');
  }

  async function chargerFiltresCategories() {
    try {
      const res = await fetch('/api/categories-frais');
      const data = await res.json();
      const select = document.getElementById('filtre-categorie');
      (data.donnees || []).forEach(function (c) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.libelle;
        select.appendChild(opt);
      });
    } catch (e) {
      // silencieux
    }
  }

  async function chargerJournal() {
    const debut = document.getElementById('filtre-date-debut').value;
    const fin = document.getElementById('filtre-date-fin').value;
    const cat = document.getElementById('filtre-categorie').value;

    const zoneMasquee = document.getElementById('zone-masquee');
    const zoneDonnees = document.getElementById('zone-donnees');
    const journalTabs = document.getElementById('journal-tabs');

    if (!debut || !fin) {
      zoneDonnees.style.display = 'none';
      zoneMasquee.style.display = 'block';
      if (journalTabs) journalTabs.style.display = 'none';
      return;
    }

    if (debut > fin) {
      document.getElementById('filtre-date-fin').value = debut;
      fin = debut;
    }

    const params = new URLSearchParams();
    params.append('date_debut', debut);
    params.append('date_fin', fin);
    if (cat) params.append('categorie_id', cat);

    const queryString = '?' + params.toString();

    try {
      const res = await fetch('/api/journal' + queryString);
      const resSynthese = await fetch('/api/journal/synthese' + queryString);
      const data = await res.json();
      const dataSynthese = await resSynthese.json();

      tousLesPaiements = data.donnees || [];
      afficherPaiements(tousLesPaiements);
      afficherSynthese(dataSynthese.donnees || []);

      zoneMasquee.style.display = 'none';
      zoneDonnees.style.display = 'block';
      if (journalTabs) {
        journalTabs.style.display = 'flex';
        afficherOngletJournal(ongletActifJournal);
      }
    } catch (e) {
      document.getElementById('body-releve-ventes').innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">Erreur de chargement</td></tr>';
      zoneMasquee.style.display = 'none';
      zoneDonnees.style.display = 'block';
      if (journalTabs) {
        journalTabs.style.display = 'flex';
        afficherOngletJournal(ongletActifJournal);
      }
    }
  }

  function construireLignesSynthese(synthese) {
    const map = {};
    synthese.forEach(function (s) {
      const cat = s.categorie || 'Autre';
      if (!map[cat]) map[cat] = { total: 0 };
      map[cat].total += Number(s.total || 0);
    });

    return Object.keys(map).map(function (cat) {
      return '<tr><td>' + cat + '</td><td style="text-align:right;font-weight:700;color:#8b0000;">' + formatMonnaie(map[cat].total) + '</td></tr>';
    }).join('');
  }

  function afficherSynthese(synthese) {
    dernieresSyntheseDonnees = synthese;
    const corps = document.getElementById('body-synthese');

    if (synthese.length === 0) {
      corps.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:20px">Aucune donnée</td></tr>';
      return;
    }

    corps.innerHTML = construireLignesSynthese(synthese);
  }

  function afficherPaiements(paiements) {
    const corps = document.getElementById('body-releve-ventes');
    corps.innerHTML = '';
    let totalUsd = 0;

    if (paiements.length === 0) {
      corps.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">Aucune transaction</td></tr>';
    } else {
      paiements.forEach(function (p) {
        totalUsd += Number(p.montant || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = '<td style="font-size:11px;color:#8b0000;font-weight:700;">' + p.numero_recu + '</td>' +
          '<td>' + (p.nom_eleve || '—') + '</td>' +
          '<td>' + p.libelle + '</td>' +
          '<td style="font-size:11px;color:#64748b;">' + (p.caissier || '—') + '</td>' +
          '<td style="text-align:right;font-weight:700;">' + formatMonnaie(p.montant) + '</td>';
        corps.appendChild(tr);
      });
    }

    document.getElementById('montant-jour').textContent = formatMonnaie(totalUsd);
    document.getElementById('nb-transactions').textContent = paiements.length;
    document.getElementById('total-recettes').textContent = formatMonnaie(totalUsd);
  }

  function imprimerRapport(mode) {
    const debut = document.getElementById('filtre-date-debut').value;
    const fin = document.getElementById('filtre-date-fin').value;

    if (!debut || !fin) {
      alert('Veuillez d\'abord sélectionner une date de début et une date de fin, puis appliquer les filtres.');
      return;
    }

    const dateAffichee = 'Du ' + formatDate(debut) + ' au ' + formatDate(fin);
    document.getElementById('rpt-date').textContent = dateAffichee;
    document.getElementById('rpt-print-date').textContent = new Date().toLocaleDateString('fr-FR');

    const titres = {
      synthese: 'Rapport de Caisse — Synthèse',
      details: 'Rapport de Caisse — Détails',
      complet: 'Rapport Journalier de Caisse'
    };
    document.getElementById('rpt-titre-rapport').textContent = titres[mode] || titres.complet;

    const sectionSynthese = document.getElementById('rpt-section-synthese');
    if (mode === 'details') {
      sectionSynthese.classList.add('print-hide');
    } else {
      sectionSynthese.classList.remove('print-hide');
      document.getElementById('rpt-synthese-body').innerHTML = construireLignesSynthese(dernieresSyntheseDonnees);
    }

    const sectionDetails = document.getElementById('rpt-section-details');
    if (mode === 'synthese') {
      sectionDetails.classList.add('print-hide');
    } else {
      sectionDetails.classList.remove('print-hide');
      const rptBody = document.getElementById('rpt-body');
      rptBody.innerHTML = '';
      let totalUsd = 0;
      tousLesPaiements.forEach(function (p) {
        totalUsd += Number(p.montant || 0);
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + p.numero_recu + '</td>' +
          '<td>' + (p.nom_eleve || '—') + '</td>' +
          '<td>' + p.libelle + '</td>' +
          '<td>' + (p.caissier || '—') + '</td>' +
          '<td style="text-align:right;">' + formatMonnaie(p.montant) + '</td>';
        rptBody.appendChild(tr);
      });
      document.getElementById('rpt-total-usd').textContent = formatMonnaie(totalUsd);
    }

    const totalBloc = document.getElementById('rpt-total-bloc');
    if (mode === 'synthese') {
      totalBloc.classList.add('print-hide');
    } else {
      totalBloc.classList.remove('print-hide');
    }

    document.querySelector('.screen-only').style.display = 'none';
    document.getElementById('print-report').style.display = 'block';
    window.print();
    setTimeout(function () {
      document.querySelector('.screen-only').style.display = '';
      document.getElementById('print-report').style.display = 'none';
      sectionSynthese.classList.remove('print-hide');
      sectionDetails.classList.remove('print-hide');
      totalBloc.classList.remove('print-hide');
    }, 500);
  }

  async function chargerParametresEcole() {
    try {
      const res = await fetch('/api/parametres');
      const json = await res.json();
      if (json.donnees && json.donnees.nom_ecole) document.getElementById('rpt-ecole').textContent = json.donnees.nom_ecole;
      if (json.donnees && json.donnees.adresse_ecole) document.getElementById('rpt-adresse').textContent = json.donnees.adresse_ecole;
    } catch (e) {
      // silencieux
    }
  }

  initialiserOngletsJournal();
  window.chargerJournal = chargerJournal;
  window.imprimerRapport = imprimerRapport;

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      imprimerRapport('complet');
    }
  });

  const filtreDebut = document.getElementById('filtre-date-debut');
  const filtreFin = document.getElementById('filtre-date-fin');

  filtreDebut.addEventListener('change', function () {
    if (filtreDebut.value && filtreFin.value && filtreDebut.value > filtreFin.value) {
      filtreFin.value = filtreDebut.value;
    }
    filtreFin.min = filtreDebut.value || '';
  });

  filtreFin.addEventListener('change', function () {
    if (filtreDebut.value && filtreFin.value && filtreFin.value < filtreDebut.value) {
      filtreDebut.value = filtreFin.value;
    }
    filtreDebut.max = filtreFin.value || '';
  });

  chargerParametresEcole();
  chargerFiltresCategories();
  chargerJournal();
})();
