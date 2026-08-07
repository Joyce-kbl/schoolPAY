(function () {
  function nombreEnLettres(n) {
    const entiers = ['zero', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    const entier = Math.floor(n);
    const centimes = Math.round((n - entier) * 100);

    function convertir(nb) {
      if (nb < 20) return entiers[nb];
      if (nb < 100) {
        const d = Math.floor(nb / 10);
        const u = nb % 10;
        if (d === 7 || d === 9) return dizaines[d] + (u === 1 ? '-et-' : '-') + entiers[10 + u];
        return dizaines[d] + (u > 0 ? (u === 1 && d !== 8 ? '-et-un' : '-' + entiers[u]) : (d === 8 ? 's' : ''));
      }
      return String(nb);
    }

    let texte = convertir(entier) + ' dollar(s)';
    if (centimes > 0) texte += ' et ' + convertir(centimes) + ' centime(s)';
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const parties = String(dateStr).slice(0, 10).split('-');
    if (parties.length !== 3) return dateStr;
    return `${parties[2]}/${parties[1]}/${parties[0]}`;
  }

  function setTexte(id, valeur) {
    const element = document.getElementById(id);
    if (element) element.textContent = valeur;
  }

  async function chargerRecu() {
    const params = new URLSearchParams(window.location.search);
    const numero = params.get('numero');
    const etat = document.getElementById('etat');

    if (!numero) {
      if (etat) etat.textContent = 'Numéro de reçu manquant.';
      return;
    }

    try {
      const reponse = await fetch(`/api/recu?numero=${encodeURIComponent(numero)}`);
      const json = await reponse.json();
      const data = json.donnees;

      if (!reponse.ok || !data) {
        throw new Error(json.erreur || 'Reçu introuvable');
      }

      setTexte('numero-recu', `N° ${data.numero_recu || numero}`);
      setTexte('montant', `${Number(data.montant || 0).toFixed(2)} $`);
      setTexte('montant-lettres', nombreEnLettres(Number(data.montant || 0)));
      setTexte('nom-eleve', data.nom_eleve || '—');
      setTexte('matricule', data.matricule || '—');
      setTexte('classe', data.nom_classe || '—');
      setTexte('libelle', data.libelle || '—');
      setTexte('date', formatDate(data.paye_le));
      setTexte('caissier', data.caissier || '—');
      setTexte('sig-caissier', data.caissier || 'Signature');
      setTexte('sig-deposant', data.nom_eleve || 'Signature');

      if (params.get('auto_print') === '1') {
        setTimeout(() => window.print(), 500);
      }
    } catch (erreur) {
      if (etat) etat.textContent = erreur.message;
    }
  }

  const btnImprimer = document.getElementById('btn-imprimer');
  if (btnImprimer) {
    btnImprimer.addEventListener('click', () => window.print());
  }

  chargerRecu();
})();
