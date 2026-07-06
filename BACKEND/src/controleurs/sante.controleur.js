function controleur_sante(_requete, reponse) {
  reponse.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  reponse.end(JSON.stringify({
    ok: true,
    service: 'SchoolPAY BACKEND',
    horodatage: new Date().toISOString()
  }));
}

module.exports = controleur_sante;
