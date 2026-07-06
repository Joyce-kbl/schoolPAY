(async ()=>{
  try {
    const base = 'http://localhost:4000';
    function jlog(){ console.log.apply(console, arguments); }
    // create class
    let r = await fetch(base + '/api/classes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nom: 'UIClass-'+Date.now(), montant_frais: 77 }) });
    const cl = await r.json();
    jlog('class', r.status, cl);
    const classes = await (await fetch(base + '/api/classes')).json();
    const created = classes.donnees[classes.donnees.length-1];
    const classId = created.id;
    // create student
    r = await fetch(base + '/api/eleves', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ nom_complet: 'UI Student '+Date.now(), sexe:'M', classe_id: classId, matricule: 'UI-'+Date.now() }) });
    const st = await r.json(); jlog('student', r.status, st);
    const studentId = st.donnees.id;
    // create payment
    r = await fetch(base + '/api/paiements', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ eleve_id: studentId, libelle: 'Minerval', montant: 42.5, devise: 'USD', paye_le: (new Date()).toISOString().slice(0,10) }) });
    const pay = await r.json(); jlog('payment', r.status, pay);
    console.log(JSON.stringify({ createdClass: created, student: st.donnees, payment: pay.donnees }));
    process.exit(0);
  } catch (e) { console.error(e); process.exit(2); }
})();
