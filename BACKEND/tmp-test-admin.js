(async () => {
  try {
    const ports = [4000, 4001];
    let base = null;
    for (const p of ports) {
      try {
        const r = await fetch(`http://localhost:${p}/api/sante`);
        if (r.ok) { base = `http://localhost:${p}`; break; }
      } catch (e) {}
    }
    if (!base) throw new Error('Aucun backend trouvé sur les ports 4000/4001');
    console.log('BASE', base);

    const results = [];

    // 1) Create a temporary class
    let r = await fetch(base + '/api/classes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom: 'tmp-class-' + Date.now(), montant_frais: 99 })
    });
    async function parseResp(res) {
      try { return await res.json(); } catch (e) { return { _raw: await res.text() }; }
    }
    const createdClass = await parseResp(r);
    results.push({ step: 'create_class', status: r.status, body: createdClass });
    const classId = createdClass.donnees?.id;

    // 2) Update the class (partial update to avoid UNIQUE conflict)
    r = await fetch(base + `/api/classes/${classId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ montant_frais: 111 })
    });
    results.push({ step: 'update_class', status: r.status, body: await parseResp(r) });

    // 3) Create a temporary student in that class
    r = await fetch(base + '/api/eleves', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom_complet: 'Tmp Student Test', sexe: 'M', classe_id: classId, matricule: 'TMP-' + Date.now() })
    });
    const createdStudent = await parseResp(r);
    results.push({ step: 'create_student', status: r.status, body: createdStudent });
    const studentId = createdStudent.donnees?.id;

    // 4) Update the student (partial -> PATCH to preserve other fields)
    r = await fetch(base + `/api/eleves/${studentId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom_complet: 'Tmp Student Edited' })
    });
    results.push({ step: 'update_student', status: r.status, body: await parseResp(r) });

    // 5) Create a payment for the student
    r = await fetch(base + '/api/paiements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eleve_id: studentId, libelle: 'Test Payment', montant: 12.5, devise: 'USD', paye_le: '2026-07-02' })
    });
    const createdPayment = await parseResp(r);
    results.push({ step: 'create_payment', status: r.status, body: createdPayment });
    const paymentId = createdPayment.donnees?.id;
    const numero = createdPayment.donnees?.numero_recu;

    // 6) Fetch receipt by numero
    r = await fetch(base + `/api/recu?numero=${encodeURIComponent(numero)}`);
    results.push({ step: 'get_recu', status: r.status, body: await parseResp(r) });

    // 7) Update payment (partial -> PATCH to avoid controller strict validation)
    r = await fetch(base + `/api/paiements/${paymentId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libelle: 'Test Payment Edited', montant: 15 })
    });
    results.push({ step: 'update_payment', status: r.status, body: await parseResp(r) });

    // 8) Delete payment
    r = await fetch(base + `/api/paiements/${paymentId}`, { method: 'DELETE' });
    results.push({ step: 'delete_payment', status: r.status, body: await parseResp(r) });

    // 9) Delete student
    r = await fetch(base + `/api/eleves/${studentId}`, { method: 'DELETE' });
    results.push({ step: 'delete_student', status: r.status, body: await parseResp(r) });

    // 10) Delete class
    r = await fetch(base + `/api/classes/${classId}`, { method: 'DELETE' });
    results.push({ step: 'delete_class', status: r.status, body: await parseResp(r) });

    // 11) Set exchange rate
    r = await fetch(base + '/api/taux', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taux: 3000 })
    });
    results.push({ step: 'set_taux', status: r.status, body: await parseResp(r) });

    console.log('\n=== TEST RESULTS ===');
    for (const it of results) {
      console.log(it.step, 'status=', it.status);
      try { console.log(JSON.stringify(it.body)); } catch (e) { console.log(it.body); }
    }
    process.exit(0);
  } catch (err) {
    console.error('ERROR TEST', err);
    process.exit(2);
  }
})();
