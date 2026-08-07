(function () {
  function nombreEnLettres(n) {
    const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

    const entier = Math.floor(n);
    const cents = Math.round((n - entier) * 100);

    function convertir(nb) {
      if (nb === 0) return 'zero';
      if (nb < 20) return unites[nb];
      if (nb < 100) {
        const d = Math.floor(nb / 10);
        const u = nb % 10;
        if (d === 7 || d === 9) return dizaines[d] + (u === 1 ? '-et-' : '-') + unites[10 + u];
        return dizaines[d] + (u > 0 ? (u === 1 && d !== 8 ? '-et-un' : '-' + unites[u]) : (d === 8 ? 's' : ''));
      }
      if (nb < 1000) return unites[Math.floor(nb / 100)] + ' cent' + (nb % 100 > 0 ? ' ' + convertir(nb % 100) : 's');
      return convertir(Math.floor(nb / 1000)) + ' mille' + (nb % 1000 > 0 ? ' ' + convertir(nb % 1000) : '');
    }

    let result = convertir(entier) + ' Dollar(s)';
    if (cents > 0) result += ' et ' + convertir(cents) + ' centime(s)';
    return result.charAt(0).toUpperCase() + result.slice(1);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = String(dateStr).split('-');
    return d + '/' + m + '/' + y;
  }

  function setSafe(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function remplirRecu(s, data) {
    const symbole = '$';
    const montantNum = Number(data.montant || 0);

    setSafe(s + '-numero', 'N° ' + (data.numero || '—'));
    setSafe(s + '-montant', montantNum.toFixed(2) + ' ' + symbole);
    setSafe(s + '-lettres', nombreEnLettres(montantNum));
    setSafe(s + '-nom', data.nom || '—');
    setSafe(s + '-classe', data.classe || '—');
    setSafe(s + '-matricule', data.matricule || '—');
    setSafe(s + '-date', formatDate(data.date));
    setSafe(s + '-deposant', data.deposant || '—');
    setSafe(s + '-caissier', data.caissier || '—');
    setSafe(s + '-sig-caissier', data.caissier || 'Signature');
    setSafe(s + '-sig-deposant', data.deposant || 'Signature');

    const opsContainer = document.getElementById(s + '-operations');
    if (opsContainer) {
      let opsHtml = '<div class="recu-operations-titre">Detail des operations</div>';
      if (data.operations && data.operations.length > 0) {
        data.operations.forEach(function (op) {
          opsHtml += '<div class="recu-op-ligne">' +
            '<span>• ' + (op.libelle || '') + '</span>' +
            '<span class="recu-op-montant">' + Number(op.montant || 0).toFixed(2) + ' ' + symbole + '</span>' +
            '</div>';
        });
        opsHtml += '<div class="recu-op-ligne" style="font-weight:800;border-top:1px solid #e2e8f0;padding-top:4px;margin-top:4px;">' +
          '<span>TOTAL</span>' +
          '<span class="recu-op-montant">' + montantNum.toFixed(2) + ' ' + symbole + '</span>' +
          '</div>';
      } else if (data.libelle) {
        opsHtml += '<div class="recu-op-ligne">' +
          '<span>• ' + data.libelle + '</span>' +
          '<span class="recu-op-montant">' + montantNum.toFixed(2) + ' ' + symbole + '</span>' +
          '</div>';
      }
      opsContainer.innerHTML = opsHtml;
    }

    const sitContainer = document.getElementById(s + '-situation');
    if (sitContainer) {
      sitContainer.innerHTML = '';
    }
  }

  function construireSituationHtml(fiche) {
    const symbole = '$';
    const attendu = Number(fiche.frais_total || 0);
    const paye = Number(fiche.total_paye || 0);
    const reste = Number(fiche.reste || 0);
    const couleurReste = reste > 0 ? '#dc2626' : '#059669';

    return '<div class="recu-situation-titre">Situation de l\'eleve</div>' +
      '<div class="recu-situation-ligne">' +
      '<span>Frais scolaires attendus</span>' +
      '<span style="font-weight:600;">' + attendu.toFixed(2) + ' ' + symbole + '</span>' +
      '</div>' +
      '<div class="recu-situation-ligne">' +
      '<span>Deja paye (total)</span>' +
      '<span style="font-weight:600;color:#059669;">' + paye.toFixed(2) + ' ' + symbole + '</span>' +
      '</div>' +
      '<div class="recu-situation-ligne recu-situation-reste" style="color:' + couleurReste + ';">' +
      '<span>Reste a payer</span>' +
      '<span>' + reste.toFixed(2) + ' ' + symbole + '</span>' +
      '</div>';
  }

  async function chargerSituationEleve(eleve_id) {
    if (!eleve_id) return;
    try {
      const res = await fetch('/api/eleves/' + eleve_id + '/fiche');
      const json = await res.json();
      if (json.donnees) {
        const html = construireSituationHtml(json.donnees);
        const s1 = document.getElementById('r1-situation');
        const s2 = document.getElementById('r2-situation');
        if (s1) s1.innerHTML = html;
        if (s2) s2.innerHTML = html;
      }
    } catch (e) {
      // silencieux
    }
  }

  async function chargerParametresEcole() {
    try {
      const res = await fetch('/api/parametres');
      const json = await res.json();
      const nomEcole = json.donnees && json.donnees.nom_ecole;
      if (nomEcole) {
        setSafe('r1-ecole', nomEcole);
        setSafe('r2-ecole', nomEcole);
      }
    } catch (e) {
      // garde le nom par defaut
    }
  }

  async function chargerFacture() {
    const data = { numero: '—', nom: '—', classe: '—', matricule: '—', montant: 0, devise: 'USD', date: '', operations: [], caissier: '', deposant: '' };
    let eleve_id = null;

    const params = new URLSearchParams(window.location.search);
    const numero = params.get('numero');

    if (numero) {
      try {
        const res = await fetch('/api/factures/' + numero);
        const json = await res.json();
        if (json.donnees) {
          const f = json.donnees;
          Object.assign(data, {
            numero: f.numero_facture,
            nom: f.nom_eleve,
            classe: f.nom_classe || '—',
            matricule: f.matricule || '—',
            montant: f.total,
            devise: f.devise,
            date: f.paye_le,
            operations: f.operations || [],
            caissier: f.caissier || '',
            deposant: f.deposant || ''
          });
          eleve_id = f.eleve_id;
        }
      } catch (e) {
        console.error(e);
      }
    }

    remplirRecu('r1', data);
    remplirRecu('r2', data);
    chargerSituationEleve(eleve_id);
  }

  chargerParametresEcole();
  chargerFacture();

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      window.print();
    }
  });
})();
