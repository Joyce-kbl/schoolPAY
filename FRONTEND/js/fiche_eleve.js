(function () {
  function formatMonnaie(val) {
    const s = '$';
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' ' + s;
  }

  function formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR');
  }

  async function chargerParametresEcole() {
    try {
      const res = await fetch('/api/parametres');
      const json = await res.json();
      if (json.donnees?.nom_ecole) document.getElementById('ph-ecole').textContent = json.donnees.nom_ecole;
      if (json.donnees?.adresse_ecole) document.getElementById('ph-adresse').textContent = json.donnees.adresse_ecole;
    } catch (e) {
      // on garde les valeurs par défaut
    }
    document.getElementById('ph-date-impression').textContent = new Date().toLocaleDateString('fr-FR');
  }

  async function chargerFiche() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const container = document.getElementById('main-container');

    if (!id) {
      container.innerHTML = '<div class="empty-state">❌ Aucun élève sélectionné.<br><a href="index.html">← Retour</a></div>';
      return;
    }

    try {
      const res = await fetch(`/api/eleves/${id}/fiche`);
      if (!res.ok) throw new Error('Élève introuvable');
      const data = (await res.json()).donnees;

      const { eleve, paiements, soldes, total_paye, frais_total, reste } = data;
      const pct = frais_total > 0 ? Math.min(100, (total_paye / frais_total) * 100) : 0;
      const initiales = eleve.nom_complet.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
      const sexeLabel = eleve.sexe === 'M' ? '👦 Masculin' : eleve.sexe === 'F' ? '👧 Féminin' : '—';

      let progressClass = 'danger';
      if (pct >= 80) progressClass = '';
      else if (pct >= 40) progressClass = 'warning';

      const historiqueHTML = paiements.length === 0
        ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">Aucun paiement enregistré</td></tr>'
        : paiements.map((p) => `
            <tr>
              <td style="color:#64748b;font-size:12px;">${formatDate(p.paye_le)}</td>
              <td><span class="badge-libelle">${p.libelle}</span></td>
              <td style="color:#64748b;font-size:12px;">${p.caissier || '—'}</td>
              <td style="text-align:right;font-weight:700;color:#1e293b;">${formatMonnaie(p.montant)}</td>
            </tr>
          `).join('');

      const soldesHTML = (!soldes || soldes.length === 0)
        ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">Aucun frais attendu défini pour cette classe</td></tr>'
        : soldes.map((s) => {
            const isPayed = s.reste <= 0;
            const statusColor = isPayed ? 'var(--success)' : 'var(--danger)';
            return `
              <tr>
                <td style="font-weight:600; color:#1e293b;">${s.categorie}</td>
                <td>${formatMonnaie(s.attendu)}</td>
                <td style="color:var(--success);">${formatMonnaie(s.paye)}</td>
                <td style="text-align:right;font-weight:700;color:${statusColor};">${formatMonnaie(s.reste)}</td>
              </tr>`;
          }).join('');

      container.innerHTML = `
        <div class="profile-card">
          <div class="profile-avatar">${initiales}</div>
          <div class="profile-name">${eleve.nom_complet}</div>
          <div class="profile-meta">
            <span>${eleve.matricule || '—'}</span>
            <span class="profile-badge">${eleve.nom_classe || 'Classe inconnue'}</span>
            <span>${sexeLabel}</span>
          </div>
        </div>

        <div class="table-card" style="margin-bottom: 20px;">
          <div class="table-title">💰 Soldes à payer</div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Catégorie</th><th>Attendu</th><th>Payé</th><th style="text-align:right;">Reste</th></tr></thead>
              <tbody>${soldesHTML}</tbody>
            </table>
          </div>
        </div>

        <div class="progress-card">
          <div class="progress-label">
            <span>Frais scolaires (${formatMonnaie(total_paye)} / ${formatMonnaie(frais_total)})</span>
            <span style="color:${pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)'};">${pct.toFixed(0)}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${progressClass}" style="width: ${pct}%;"></div>
          </div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 8px;">Les frais annexes ne sont pas comptés ici ; voir le tableau des soldes et l'historique ci-dessous.</div>
        </div>

        <div class="table-card">
          <div class="table-title">📄 Historique des paiements <span style="background:#fef2f2;color:#8b0000;border-radius:20px;padding:2px 10px;font-size:11px;">${paiements.length}</span></div>
          <div class="table-scroll">
            <table>
              <thead><tr><th>Date</th><th>Libellé</th><th>Caissier(e)</th><th style="text-align:right;">Montant</th></tr></thead>
              <tbody>${historiqueHTML}</tbody>
            </table>
          </div>
        </div>

        <div class="no-print" style="display:flex; gap: 10px; margin-top: 16px;">
          <button onclick="window.print()" style="flex:1; background:#1e293b; color:white; padding:15px; border-radius:14px; border:none; font-weight:bold; cursor:pointer; font-size:14px;">🖨️ Imprimer le relevé</button>
        </div>
        <a href="paiement.html?eleve_id=${eleve.id}" class="btn-pay-more no-print">➕ Effectuer un paiement</a>
      `;
    } catch (err) {
      container.innerHTML = `<div class="empty-state">❌ ${err.message}<br><br><a href="index.html" style="color:#8b0000;font-weight:700;">← Retour à l'accueil</a></div>`;
    }
  }

  chargerFiche();
  chargerParametresEcole();

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.print();
    }
  });

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || '-';
  window.addEventListener('beforeprint', function () {
    if (window.enregistrerLog) {
      window.enregistrerLog('impression_releve', id);
    }
  });
})();
