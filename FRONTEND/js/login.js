(function () {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || 'index.html';

  try {
    const session = JSON.parse(localStorage.getItem('schoolpay_session') || 'null');
    if (session && session.nom_complet) {
      window.location.replace(next);
    }
  } catch (e) {}

  const form = document.getElementById('login-form');
  const erreurDiv = document.getElementById('error-msg');
  const bouton = document.getElementById('btn-login');

  form?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const nom_utilisateur = document.getElementById('nom-utilisateur').value.trim();
    const mot_de_passe = document.getElementById('mot-de-passe').value;

    erreurDiv.style.display = 'none';
    bouton.disabled = true;
    bouton.textContent = 'Connexion...';

    try {
      const res = await fetch('/api/connexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom_utilisateur, mot_de_passe })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || 'Erreur de connexion');

      localStorage.setItem('schoolpay_session', JSON.stringify(data.donnees));
      window.location.href = next;
    } catch (err) {
      erreurDiv.textContent = err.message;
      erreurDiv.style.display = 'block';
      bouton.disabled = false;
      bouton.textContent = 'Se connecter';
    }
  });
})();
