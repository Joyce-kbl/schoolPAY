(function () {
  function formatMonnaie(v) {
    return `${Number(v || 0).toFixed(2).replace('.', ',')} $`;
  }

  async function chargerClasses() {
    try {
      const res = await fetch('/api/classes');
      const data = await res.json();
      const select = document.getElementById('filtre-classe');
      (data.donnees || []).forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nom;
        select.appendChild(opt);
      });
    } catch (e) {
      // silencieux
    }
  }

  async function chargerParametresEcole() {
    try {
      const res = await fetch('/api/parametres');
      const json = await res.json();
      if (json.donnees?.nom_ecole) document.getElementById('ph-ecole').textContent = json.donnees.nom_ecole;
      if (json.donnees?.adresse_ecole) document.getElementById('ph-adresse').textContent = json.donnees.adresse_ecole;
    } catch (e) {
      // silencieux
    }
  }

  const libellesPeriode = {
    annuel: 'Année scolaire complète',
    trimestre1: '1er trimestre',
    trimestre2: '2e trimestre',
    trimestre3: '3e trimestre'
  };

  async function chargerSituation() {
    const classe_id = document.getElementById('filtre-classe').value;
    const periode = document.getElementById('filtre-periode').value;
    const annee = document.getElementById('filtre-annee').value;
    const conteneur = document.getElementById('resultats');
    conteneur.innerHTML = '<div class="loading">Chargement...</div>';

    const params = new URLSearchParams({ classe_id, periode });
    if (annee) params.append('annee', annee);

    try {
      const res = await fetch(`/api/rapports/situation?${params.toString()}`);
      const json = await res.json();
      const d = json.donnees;

      document.getElementById('ph-periode').textContent = libellesPeriode[periode] || periode;
      document.getElementById('ph-date-impression').textContent = new Date().toLocaleDateString('fr-FR');

      if (!d.classes || d.classes.length === 0) {
        conteneur.innerHTML = '<div class="empty-state">Aucune donnée pour ces filtres.</div>';
        return;
      }

      let html = '<div class="table-scroll"><table><thead><tr><th>Élève</th><th>Matricule</th><th style="text-align:right;">Attendu</th><th style="text-align:right;">Payé</th><th style="text-align:right;">Reste</th></tr></thead><tbody>';

      d.classes.forEach((c) => {
        html += `<tr><td colspan="5" class="classe-heading">${c.classe.nom} (${c.eleves.length} élève${c.eleves.length > 1 ? 's' : ''})</td></tr>`;
        if (c.eleves.length === 0) {
          html += '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px;">Aucun élève dans cette classe</td></tr>';
        } else {
          c.eleves.forEach((e) => {
            const couleurReste = e.reste > 0 ? 'var(--danger)' : 'var(--success)';
            html += `<tr class="ligne-eleve" data-eleve-id="${e.id}">
              <td>${e.nom_complet}</td>
              <td style="color:#64748b;">${e.matricule || '—'}</td>
              <td style="text-align:right;">${formatMonnaie(e.attendu)}</td>
              <td style="text-align:right;color:var(--success);">${formatMonnaie(e.paye)}</td>
              <td style="text-align:right;font-weight:700;color:${couleurReste};">${formatMonnaie(e.reste)}</td>
            </tr>`;
          });
        }
        html += `<tr class="sous-total-row">
          <td colspan="2">Sous-total ${c.classe.nom}</td>
          <td style="text-align:right;">${formatMonnaie(c.sous_total.attendu)}</td>
          <td style="text-align:right;">${formatMonnaie(c.sous_total.paye)}</td>
          <td style="text-align:right;">${formatMonnaie(c.sous_total.reste)}</td>
        </tr>`;
      });

      html += '</tbody></table></div>';
      html += `<div class="grand-total-box">
        <span>TOTAL GÉNÉRAL</span>
        <span>Attendu ${formatMonnaie(d.grand_total.attendu)} · Payé ${formatMonnaie(d.grand_total.paye)} · Reste ${formatMonnaie(d.grand_total.reste)}</span>
      </div>`;

      conteneur.innerHTML = html;

      conteneur.querySelectorAll('.ligne-eleve').forEach((ligne) => {
        ligne.addEventListener('click', () => {
          window.location.href = `fiche_eleve.html?id=${ligne.dataset.eleveId}`;
        });
      });
    } catch (e) {
      conteneur.innerHTML = '<div class="empty-state">Erreur lors du chargement du rapport.</div>';
    }
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.print();
    }
  });

  chargerParametresEcole();
  chargerClasses();

  window.addEventListener('beforeprint', function () {
    if (window.enregistrerLog) {
      const periode = document.getElementById('filtre-periode')?.value || 'annuel';
      window.enregistrerLog('impression_rapport', 'situation_' + periode);
    }
  });

  window.chargerSituation = chargerSituation;
})();
