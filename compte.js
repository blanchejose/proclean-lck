/* Pro-clean LCK — Mon espace : mes demandes, mes avis, mon profil */
(() => {
  const $ = (id) => document.getElementById(id);
  const { sb, toast, STATUS, fmtDate } = PC;
  let requests = [];
  let reviews = [];

  const goTab = PC.setupTabs(document.querySelector('.app-tabs'), (id) => {
    history.replaceState(null, '', '#' + id.slice(2));
  });

  document.querySelectorAll('[data-auth]').forEach((b) => b.addEventListener('click', () => PC.openAuth(b.dataset.auth)));

  PC.onChange(async (user, profile) => {
    $('locked').hidden = Boolean(user);
    $('app').hidden = !user;
    $('hello').textContent = user ? `Bonjour ${PC.firstName() || ''} !` : 'Mon espace';
    if (!user) return;
    fillProfile(profile);
    await Promise.all([loadRequests(), loadReviews()]);
    const hash = location.hash.slice(1);
    if (['demandes', 'avis', 'profil'].includes(hash)) goTab('t-' + hash);
    if (sessionStorage.getItem('pc-recovery')) {
      sessionStorage.removeItem('pc-recovery');
      goTab('t-profil'); $('pw-new').focus();
      toast('Choisissez votre nouveau mot de passe.');
    }
  });

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function btn(label, cls, onClick, aria) {
    const b = el('button', 'btn btn-sm ' + cls, label);
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('click', onClick);
    return b;
  }

  /* ================= DEMANDES ================= */
  async function loadRequests() {
    const { data, error } = await sb.from('requests').select('*').order('created_at', { ascending: false });
    if (error) { toast('Impossible de charger vos demandes.', 'err'); return; }
    requests = data;
    renderRequests();
  }

  function renderRequests() {
    const ul = $('req-list');
    ul.replaceChildren();
    $('c-demandes').textContent = requests.length ? `(${requests.length})` : '';
    $('req-empty').hidden = requests.length > 0;
    requests.forEach((r, k) => {
      const st = STATUS[r.status];
      const li = el('li', 'item-card');
      li.style.setProperty('--k', k);

      const head = el('div', 'item-head');
      head.append(el('h3', null, `Demande n°${r.id}`), el('span', 'badge ' + st.cls, st.label));

      const dl = el('dl', 'item-info');
      const row = (k2, v) => { if (!v) return; dl.append(el('dt', null, k2), el('dd', null, v)); };
      row('Services', r.services.join(', '));
      row('Fréquence', r.freq);
      row('Date souhaitée', r.preferred_date && fmtDate(r.preferred_date));
      row('Quartier', r.area);
      row('Précisions', r.message);
      row('Envoyée le', fmtDate(r.created_at, true));
      if (r.admin_note) row('Message de Pro-clean LCK', r.admin_note);

      const acts = el('div', 'item-actions');
      if (r.status === 'en_attente') acts.append(btn('Modifier', 'btn-ghost', () => editRequest(r), `Modifier la demande n°${r.id}`));
      if (r.status === 'en_attente' || r.status === 'confirmee') acts.append(btn('Annuler la demande', 'btn-warn', () => cancelRequest(r), `Annuler la demande n°${r.id}`));
      if (r.status === 'annulee' || r.status === 'terminee') acts.append(btn('Supprimer', 'btn-danger', () => deleteRequest(r), `Supprimer la demande n°${r.id}`));
      if (r.status === 'confirmee') acts.append(el('p', 'hint', 'Demande confirmée : pour la modifier, écrivez-nous sur WhatsApp.'));

      li.append(head, dl, acts);
      ul.appendChild(li);
    });
  }

  const reqDialog = $('req-dialog');
  const reqForm = $('req-form');
  let editingReq = null;
  function editRequest(r) {
    editingReq = r;
    const F = reqForm.elements;
    F.name.value = r.name; F.phone.value = r.phone; F.area.value = r.area || '';
    F.freq.value = r.freq; F.date.value = r.preferred_date || ''; F.msg.value = r.message || '';
    F.date.min = new Date().toISOString().slice(0, 10);
    reqForm.querySelectorAll('input[name=service]').forEach((c) => { c.checked = r.services.includes(c.value); });
    $('rq-err').textContent = '';
    $('rq-title').textContent = `Modifier la demande n°${r.id}`;
    reqDialog.showModal();
    setTimeout(() => F.name.focus(), 50);
  }
  reqForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const F = reqForm.elements;
    const services = [...reqForm.querySelectorAll('input[name=service]:checked')].map((c) => c.value);
    const err = $('rq-err');
    if (F.name.value.trim().length < 2) { err.textContent = 'Indiquez votre nom.'; F.name.focus(); return; }
    if (F.phone.value.replace(/\D/g, '').length < 8) { err.textContent = 'Indiquez un téléphone valide.'; F.phone.focus(); return; }
    if (!services.length) { err.textContent = 'Choisissez au moins un service.'; reqForm.querySelector('input[name=service]').focus(); return; }
    const { error } = await sb.from('requests').update({
      name: F.name.value.trim(), phone: F.phone.value.trim(), services,
      area: F.area.value.trim() || null, freq: F.freq.value,
      preferred_date: F.date.value || null, message: F.msg.value.trim() || null,
    }).eq('id', editingReq.id);
    if (error) { err.textContent = error.message.includes('ne peut plus') ? error.message : 'L’enregistrement a échoué.'; return; }
    reqDialog.close();
    toast(`Demande n°${editingReq.id} modifiée.`);
    loadRequests();
  });

  async function cancelRequest(r) {
    if (!confirm(`Annuler la demande n°${r.id} ?`)) return;
    const { error } = await sb.from('requests').update({ status: 'annulee' }).eq('id', r.id);
    if (error) { toast('L’annulation a échoué.', 'err'); return; }
    toast(`Demande n°${r.id} annulée.`);
    loadRequests();
  }
  async function deleteRequest(r) {
    if (!confirm(`Supprimer définitivement la demande n°${r.id} de votre historique ?`)) return;
    const { error } = await sb.from('requests').delete().eq('id', r.id);
    if (error) { toast('La suppression a échoué.', 'err'); return; }
    toast(`Demande n°${r.id} supprimée.`);
    loadRequests();
  }

  /* ================= AVIS ================= */
  async function loadReviews() {
    const { data, error } = await sb.from('reviews').select('*').eq('user_id', PC.user.id).order('created_at', { ascending: false });
    if (error) { toast('Impossible de charger vos avis.', 'err'); return; }
    reviews = data;
    renderReviews();
  }
  function renderReviews() {
    const ul = $('rev-list');
    ul.replaceChildren();
    $('c-avis').textContent = reviews.length ? `(${reviews.length})` : '';
    $('rev-empty').hidden = reviews.length > 0;
    reviews.forEach((r, k) => {
      const li = el('li', 'item-card');
      li.style.setProperty('--k', k);
      const head = el('div', 'item-head');
      const st = el('p', 'rv-stars', '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating));
      st.setAttribute('aria-label', `Note : ${r.rating} sur 5`);
      st.setAttribute('role', 'img');
      head.append(el('h3', null, r.service), r.visible ? el('span', 'badge st-ok', 'Publié') : el('span', 'badge st-cancel', 'Masqué'));
      li.append(head, st, el('p', 'rv-text', r.comment), el('p', 'hint', `${r.name}${r.area ? ' · ' + r.area : ''} · ${fmtDate(r.created_at)}${r.updated_at ? ' · modifié' : ''}`));
      const acts = el('div', 'item-actions');
      acts.append(
        btn('Modifier', 'btn-ghost', () => editReview(r), 'Modifier cet avis'),
        btn('Supprimer', 'btn-danger', () => deleteReview(r), 'Supprimer cet avis'),
      );
      li.append(acts);
      ul.appendChild(li);
    });
  }
  const revDialog = $('rev-dialog');
  const revForm = $('rev-form');
  let editingRev = null;
  function editReview(r) {
    editingRev = r;
    const F = revForm.elements;
    revForm.querySelector('#e' + r.rating).checked = true;
    F.name.value = r.name; F.area.value = r.area || ''; F.service.value = r.service; F.comment.value = r.comment;
    $('ev-err').textContent = '';
    revDialog.showModal();
    setTimeout(() => revForm.querySelector('#e' + r.rating).focus(), 50);
  }
  revForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const F = revForm.elements;
    const rating = +(revForm.querySelector('input[name=rating]:checked') || {}).value;
    const err = $('ev-err');
    if (F.name.value.trim().length < 2) { err.textContent = 'Indiquez votre prénom.'; return; }
    if (F.comment.value.trim().length < 10) { err.textContent = 'Écrivez au moins 10 caractères.'; return; }
    const { error } = await sb.from('reviews').update({
      rating, name: F.name.value.trim(), area: F.area.value.trim() || null, service: F.service.value, comment: F.comment.value.trim(),
    }).eq('id', editingRev.id);
    if (error) { err.textContent = 'L’enregistrement a échoué.'; return; }
    revDialog.close();
    toast('Avis modifié.');
    loadReviews();
  });
  async function deleteReview(r) {
    if (!confirm('Supprimer définitivement cet avis ?')) return;
    const { error } = await sb.from('reviews').delete().eq('id', r.id);
    if (error) { toast('La suppression a échoué.', 'err'); return; }
    toast('Avis supprimé.');
    loadReviews();
  }

  /* ================= PROFIL ================= */
  function fillProfile(p) {
    const F = $('profile-form').elements;
    F.full_name.value = (p && p.full_name) || '';
    F.phone.value = (p && p.phone) || '';
    F.area.value = (p && p.area) || '';
    $('pf-email').value = PC.user.email;
  }
  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const F = e.currentTarget.elements;
    const err = $('pf-err');
    if (F.full_name.value.trim().length < 2) { err.textContent = 'Indiquez votre nom.'; F.full_name.focus(); return; }
    if (F.phone.value.replace(/\D/g, '').length < 8) { err.textContent = 'Indiquez un téléphone valide.'; F.phone.focus(); return; }
    err.textContent = '';
    const { error } = await sb.from('profiles').update({
      full_name: F.full_name.value.trim(), phone: F.phone.value.trim(), area: F.area.value.trim() || null,
    }).eq('id', PC.user.id);
    if (error) { err.textContent = 'L’enregistrement a échoué.'; return; }
    await PC.refreshProfile();
    toast('Profil mis à jour.');
  });

  $('pass-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('pw-new').value;
    const err = $('pw-err');
    if (pw.length < 6) { err.textContent = 'Au moins 6 caractères.'; $('pw-new').focus(); return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { err.textContent = /different/i.test(error.message) ? 'Choisissez un mot de passe différent de l’actuel.' : 'La mise à jour a échoué.'; return; }
    err.textContent = ''; e.currentTarget.reset();
    toast('Mot de passe modifié.');
  });

  $('logout').addEventListener('click', async () => { await PC.signOut(); location.href = 'index.html'; });

  $('delete-account').addEventListener('click', async () => {
    const answer = prompt('Cette action est définitive : votre compte, vos demandes et vos avis seront effacés.\n\nPour confirmer, écrivez SUPPRIMER :');
    if (answer === null) return;
    if (answer.trim().toUpperCase() !== 'SUPPRIMER') { toast('Suppression annulée : le mot n’était pas « SUPPRIMER ».', 'err'); return; }
    const { error } = await sb.rpc('delete_my_account');
    if (error) { toast('La suppression du compte a échoué.', 'err'); return; }
    await sb.auth.signOut();
    alert('Votre compte a été supprimé. Merci d’avoir fait confiance à Pro-clean LCK.');
    location.href = 'index.html';
  });
})();
