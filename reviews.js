/* Pro-clean LCK — avis clients (lecture pour tous, écriture avec un compte)
   Chaque client peut publier, modifier et supprimer SES avis. */
(() => {
  const PAGE = 6;
  const COLORS = ['#0b3a8c', '#1b7a32', '#1d5fd0', '#7c3aed', '#b45309', '#0f766e'];
  const WORDS = { 1: 'Décevant', 2: 'Moyen', 3: 'Bien', 4: 'Très bien', 5: 'Excellent !' };

  const $ = (id) => document.getElementById(id);
  const list = $('review-list');
  let all = [];         // avis affichés
  let mine = new Set(); // ids de mes avis
  let filter = 'all';
  let shown = PAGE;
  let editing = null;   // avis en cours de modification

  /* ---------- Données ---------- */
  async function load() {
    const { data, error } = await PC.sb.from('reviews')
      .select('id,created_at,updated_at,user_id,name,area,service,rating,comment,visible')
      .order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    const me = PC.user && PC.user.id;
    mine = new Set(data.filter((r) => me && r.user_id === me).map((r) => r.id));
    // avis visibles + mes avis masqués (avec un badge)
    all = data.filter((r) => r.visible || mine.has(r.id));
  }

  /* ---------- Affichage ---------- */
  const stars = (n) => {
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement('span');
      s.className = i <= Math.round(n) ? 'star' : 'star off';
      s.textContent = '★';
      frag.appendChild(s);
    }
    return frag;
  };
  const dateFr = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text; // textContent : aucun risque d'injection
    return e;
  }

  function renderSummary() {
    const pub = all.filter((r) => r.visible);
    const n = pub.length;
    const avg = n ? pub.reduce((s, r) => s + r.rating, 0) / n : 0;
    $('rs-avg').textContent = n ? avg.toFixed(1).replace('.', ',') : '–';
    $('rs-stars').replaceChildren(stars(avg));
    $('rs-count').textContent = n ? `${n} avis client${n > 1 ? 's' : ''} · moyenne ${avg.toFixed(1).replace('.', ',')} sur 5` : 'Pas encore d’avis';
    const bars = $('rs-bars');
    bars.replaceChildren();
    for (let s = 5; s >= 1; s--) {
      const c = pub.filter((r) => r.rating === s).length;
      const li = el('li');
      li.append(el('span', null, s + ' ★'));
      const bar = el('span', 'rs-bar'); const fill = el('span'); bar.appendChild(fill);
      li.append(bar, el('span', null, String(c)));
      li.setAttribute('aria-label', `${s} étoile${s > 1 ? 's' : ''} : ${c} avis`);
      bars.appendChild(li);
      requestAnimationFrame(() => { fill.style.width = n ? (c / n) * 100 + '%' : '0'; });
    }
  }

  function actionBtn(label, cls, aria, onClick) {
    const b = el('button', 'rv-action ' + cls, label);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', onClick);
    return b;
  }

  function renderList() {
    const items = filter === 'all' ? all : all.filter((r) => r.service === filter);
    list.replaceChildren();
    items.slice(0, shown).forEach((r, k) => {
      const isMine = mine.has(r.id);
      const li = el('li', 'review' + (isMine ? ' is-mine' : ''));
      li.style.setProperty('--k', k % PAGE);

      const top = el('div', 'rv-top');
      const av = el('span', 'rv-avatar', (r.name || '?').trim().charAt(0).toUpperCase());
      av.style.background = COLORS[(r.name || '').length % COLORS.length];
      av.setAttribute('aria-hidden', 'true');
      const who = el('div');
      const meta = [r.area, dateFr(r.created_at), r.updated_at && 'modifié'].filter(Boolean).join(' · ');
      who.append(el('p', 'rv-name', r.name), el('p', 'rv-meta', meta));
      top.append(av, who);
      if (isMine) top.append(el('span', 'rv-mine', 'Mon avis'));

      const st = el('p', 'rv-stars'); st.append(stars(r.rating));
      st.setAttribute('role', 'img'); st.setAttribute('aria-label', `Note : ${r.rating} sur 5`);

      const book = el('button', 'rv-book');
      book.type = 'button';
      book.innerHTML = 'Réserver ce service <svg aria-hidden="true"><use href="#i-arrow"/></svg>';
      book.setAttribute('aria-label', `Réserver le service ${r.service}`);
      book.addEventListener('click', () => bookService(r.service));

      li.append(top, st, el('span', 'rv-tag', r.service));
      if (!r.visible) li.append(el('p', 'rv-hidden', 'Masqué par Pro-clean LCK : visible seulement par vous.'));
      li.append(el('p', 'rv-text', r.comment));

      const foot = el('div', 'rv-foot');
      foot.append(book);
      if (isMine) {
        const acts = el('div', 'rv-actions');
        acts.append(
          actionBtn('Modifier', 'is-edit', 'Modifier mon avis', () => openForm(r)),
          actionBtn('Supprimer', 'is-del', 'Supprimer mon avis', () => removeReview(r)),
        );
        foot.append(acts);
      }
      li.append(foot);
      list.appendChild(li);
    });
    $('reviews-empty').hidden = items.length > 0;
    $('more-reviews').hidden = items.length <= shown;
  }

  function bookService(service) {
    document.querySelectorAll('#quote-form input[name="service"]').forEach((c) => { c.checked = c.value === service; });
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('f-name').focus({ preventScroll: true }), 700);
  }

  function renderAll() { renderSummary(); renderList(); }
  async function reload() {
    try { await load(); renderAll(); }
    catch { $('rs-count').textContent = 'Impossible de charger les avis pour le moment.'; }
  }

  /* ---------- Filtres ---------- */
  const setFilter = (val) => document.querySelectorAll('.filter').forEach((x) => {
    const on = x.dataset.filter === val; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('.filter').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter; shown = PAGE; setFilter(filter); renderList();
  }));
  $('more-reviews').addEventListener('click', () => { shown += PAGE; renderList(); });

  /* ---------- Fenêtre avis (création + modification) ---------- */
  const dialog = $('review-dialog');
  const form = $('review-form');
  const F = form.elements;
  const opener = $('open-review');
  let returnFocus = opener;

  function openForm(r = null) {
    editing = r;
    form.reset();
    ['re-rating', 're-name', 're-service', 're-comment'].forEach((id) => { $(id).textContent = ''; });
    $('rv-status').textContent = '';
    $('rd-title').textContent = r ? 'Modifier mon avis' : 'Votre avis compte !';
    $('rv-submit').textContent = r ? 'Enregistrer les modifications' : 'Publier mon avis';
    if (r) {
      form.querySelector(`#r${r.rating}`).checked = true;
      F.name.value = r.name; F.area.value = r.area || ''; F.service.value = r.service; F.comment.value = r.comment;
    } else if (PC.profile) {
      F.name.value = PC.firstName(); F.area.value = PC.profile.area || '';
    }
    $('star-word').textContent = r ? WORDS[r.rating] : 'Touchez une étoile';
    $('rv-count').textContent = `${F.comment.value.length} / 600`;
    returnFocus = document.activeElement;
    dialog.showModal();
    setTimeout(() => form.querySelector(`#r${r ? r.rating : 5}`).focus(), 50);
  }

  opener.addEventListener('click', async () => {
    const ok = await PC.requireAuth('Connectez-vous pour donner votre avis. Vous pourrez le modifier ou le supprimer quand vous voulez.');
    if (ok) openForm();
  });
  dialog.addEventListener('close', () => { (returnFocus && returnFocus.isConnected ? returnFocus : opener).focus(); });

  form.querySelectorAll('input[name="rating"]').forEach((r) => r.addEventListener('change', () => { $('star-word').textContent = WORDS[r.value]; }));
  F.comment.addEventListener('input', () => { $('rv-count').textContent = `${F.comment.value.length} / 600`; });

  const err = (id, input, msg) => {
    $(id).textContent = msg;
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('rv-status');
    if (F.website.value) return; // robot
    const rating = +(form.querySelector('input[name="rating"]:checked') || {}).value || 0;
    const name = F.name.value.trim();
    const service = F.service.value;
    const comment = F.comment.value.trim();
    const ok = [
      err('re-rating', null, rating ? '' : 'Choisissez une note de 1 à 5 étoiles.'),
      err('re-name', F.name, name.length >= 2 ? '' : 'Indiquez votre prénom.'),
      err('re-service', F.service, service ? '' : 'Choisissez le service reçu.'),
      err('re-comment', F.comment, comment.length >= 10 ? '' : 'Écrivez au moins quelques mots (10 caractères).'),
    ];
    if (ok.includes(false)) {
      [form.querySelector('#r5'), F.name, F.service, F.comment][ok.indexOf(false)].focus();
      return;
    }
    const btn = $('rv-submit');
    btn.disabled = true;
    const row = { name, area: F.area.value.trim() || null, service, rating, comment };
    const { error } = editing
      ? await PC.sb.from('reviews').update(row).eq('id', editing.id)
      : await PC.sb.from('reviews').insert(row);
    btn.disabled = false;
    if (error) { status.textContent = 'Oups, l’enregistrement a échoué. Réessayez.'; return; }
    const wasEdit = Boolean(editing);
    dialog.close();
    filter = 'all'; shown = PAGE; setFilter('all');
    await reload();
    PC.toast(wasEdit ? 'Votre avis est modifié.' : 'Merci ! Votre avis est publié.');
    document.getElementById('avis').scrollIntoView({ behavior: 'smooth' });
  });

  async function removeReview(r) {
    if (!confirm('Supprimer définitivement votre avis ?')) return;
    const { error } = await PC.sb.from('reviews').delete().eq('id', r.id);
    if (error) { PC.toast('La suppression a échoué.', 'err'); return; }
    await reload();
    PC.toast('Votre avis est supprimé.');
    opener.focus();
  }

  /* ---------- Démarrage + rechargement à la connexion / déconnexion ---------- */
  PC.onChange(() => reload());
})();
