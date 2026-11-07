/* Pro-clean LCK — espace admin : toutes les demandes, tous les avis, les clients */
(() => {
  const $ = (id) => document.getElementById(id);
  const { sb, toast, STATUS, fmtDate } = PC;
  let requests = [];
  let reviews = [];
  let clients = [];

  PC.setupTabs(document.querySelector('.app-tabs'));
  document.querySelectorAll('[data-auth]').forEach((b) => b.addEventListener('click', () => PC.openAuth('login')));

  PC.onChange(async (user, profile) => {
    const isAdmin = Boolean(user && profile && profile.is_admin);
    $('locked').hidden = isAdmin;
    $('app').hidden = !isAdmin;
    $('locked-msg').textContent = user
      ? 'Ce compte n’a pas les droits administrateur.'
      : 'Connectez-vous avec le compte administrateur.';
    document.querySelector('#locked [data-auth]').hidden = Boolean(user);
    if (isAdmin) await loadAll();
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
  const waLink = (phone, text) => {
    let d = String(phone || '').replace(/\D/g, '');
    if (d.length === 9) d = '237' + d; // numéro camerounais sans indicatif
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  };

  async function loadAll() {
    const [rq, rv, cl] = await Promise.all([
      sb.from('requests').select('*').order('created_at', { ascending: false }),
      sb.from('reviews').select('*').order('created_at', { ascending: false }),
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);
    if (rq.error || rv.error || cl.error) { toast('Chargement incomplet des données.', 'err'); }
    requests = rq.data || []; reviews = rv.data || []; clients = cl.data || [];
    renderKpis(); renderRequests(); renderReviews(); renderClients();
  }

  function renderKpis() {
    const c = (s) => requests.filter((r) => r.status === s).length;
    $('k-wait').textContent = c('en_attente');
    $('k-ok').textContent = c('confirmee');
    $('k-done').textContent = c('terminee');
    const vis = reviews.filter((r) => r.visible);
    $('k-rev').textContent = vis.length ? (vis.reduce((s, r) => s + r.rating, 0) / vis.length).toFixed(1).replace('.', ',') + ' ★' : '–';
    $('k-cli').textContent = clients.filter((p) => !p.is_admin).length;
  }

  /* ---------- Demandes ---------- */
  $('f-status').addEventListener('change', renderRequests);
  $('f-search').addEventListener('input', renderRequests);

  function renderRequests() {
    const st = $('f-status').value;
    const q = $('f-search').value.trim().toLowerCase();
    const items = requests.filter((r) => (st === 'all' || r.status === st)
      && (!q || [r.name, r.area, r.phone, r.services.join(' '), String(r.id)].join(' ').toLowerCase().includes(q)));
    const ul = $('req-list');
    ul.replaceChildren();
    $('req-empty').hidden = items.length > 0;
    items.forEach((r, k) => {
      const li = el('li', 'item-card');
      li.style.setProperty('--k', Math.min(k, 8));
      const head = el('div', 'item-head');
      head.append(el('h3', null, `n°${r.id} · ${r.name}`), el('span', 'badge ' + STATUS[r.status].cls, STATUS[r.status].label));

      const dl = el('dl', 'item-info');
      const row = (a, b) => { if (b) dl.append(el('dt', null, a), el('dd', null, b)); };
      row('Téléphone', r.phone);
      row('Services', r.services.join(', '));
      row('Fréquence', r.freq);
      row('Date souhaitée', r.preferred_date && fmtDate(r.preferred_date));
      row('Quartier', r.area);
      row('Précisions', r.message);
      row('Reçue le', fmtDate(r.created_at, true));
      if (r.updated_at) row('Mise à jour', fmtDate(r.updated_at, true));

      // Statut + note pour le client
      const ctrl = el('div', 'admin-ctrl');
      const sid = 'st-' + r.id; const nid = 'nt-' + r.id;
      const lab = el('label', null, 'Statut'); lab.htmlFor = sid;
      const sel = el('select'); sel.id = sid;
      Object.entries(STATUS).forEach(([v, o]) => { const op = el('option', null, o.label); op.value = v; op.selected = v === r.status; sel.append(op); });
      const nlab = el('label', null, 'Message visible par le client'); nlab.htmlFor = nid;
      const note = el('input'); note.id = nid; note.type = 'text'; note.maxLength = 500; note.value = r.admin_note || '';
      note.placeholder = 'Ex. Passage prévu samedi 9h';
      const save = btn('Enregistrer', 'btn-green', async () => {
        const { error } = await sb.from('requests').update({ status: sel.value, admin_note: note.value.trim() || null }).eq('id', r.id);
        if (error) { toast('Mise à jour impossible.', 'err'); return; }
        toast(`Demande n°${r.id} : ${STATUS[sel.value].label}.`);
        loadAll();
      }, `Enregistrer le statut de la demande n°${r.id}`);
      const g1 = el('div', 'field'); g1.append(lab, sel);
      const g2 = el('div', 'field grow'); g2.append(nlab, note);
      ctrl.append(g1, g2, save);

      const acts = el('div', 'item-actions');
      const wa = el('a', 'btn btn-sm btn-ghost', 'Répondre sur WhatsApp');
      wa.href = waLink(r.phone, `Bonjour ${r.name}, ici Pro-clean LCK au sujet de votre demande n°${r.id}.`);
      wa.target = '_blank'; wa.rel = 'noopener';
      acts.append(wa, btn('Supprimer', 'btn-danger', async () => {
        if (!confirm(`Supprimer définitivement la demande n°${r.id} ?`)) return;
        const { error } = await sb.from('requests').delete().eq('id', r.id);
        if (error) { toast('Suppression impossible.', 'err'); return; }
        toast(`Demande n°${r.id} supprimée.`); loadAll();
      }, `Supprimer la demande n°${r.id}`));

      li.append(head, dl, ctrl, acts);
      ul.appendChild(li);
    });
  }

  /* ---------- Avis ---------- */
  function renderReviews() {
    const ul = $('rev-list');
    ul.replaceChildren();
    $('rev-empty').hidden = reviews.length > 0;
    reviews.forEach((r, k) => {
      const li = el('li', 'item-card' + (r.visible ? '' : ' is-hidden'));
      li.style.setProperty('--k', Math.min(k, 8));
      const head = el('div', 'item-head');
      head.append(el('h3', null, `${r.name} · ${r.service}`), r.visible ? el('span', 'badge st-ok', 'Publié') : el('span', 'badge st-cancel', 'Masqué'));
      const st = el('p', 'rv-stars', '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating));
      st.setAttribute('role', 'img'); st.setAttribute('aria-label', `Note : ${r.rating} sur 5`);
      const acts = el('div', 'item-actions');
      acts.append(
        btn(r.visible ? 'Masquer' : 'Réafficher', 'btn-ghost', async () => {
          const { error } = await sb.from('reviews').update({ visible: !r.visible }).eq('id', r.id);
          if (error) { toast('Action impossible.', 'err'); return; }
          toast(r.visible ? 'Avis masqué du site.' : 'Avis de nouveau visible.'); loadAll();
        }, `${r.visible ? 'Masquer' : 'Réafficher'} l’avis de ${r.name}`),
        btn('Supprimer', 'btn-danger', async () => {
          if (!confirm(`Supprimer définitivement l’avis de ${r.name} ?`)) return;
          const { error } = await sb.from('reviews').delete().eq('id', r.id);
          if (error) { toast('Suppression impossible.', 'err'); return; }
          toast('Avis supprimé.'); loadAll();
        }, `Supprimer l’avis de ${r.name}`),
      );
      li.append(head, st, el('p', 'rv-text', r.comment), el('p', 'hint', `${r.area ? r.area + ' · ' : ''}${fmtDate(r.created_at, true)}${r.updated_at ? ' · modifié' : ''}`), acts);
      ul.appendChild(li);
    });
  }

  /* ---------- Clients ---------- */
  function renderClients() {
    const tb = $('cli-body');
    tb.replaceChildren();
    clients.forEach((p) => {
      const tr = el('tr');
      const n = requests.filter((r) => r.user_id === p.id).length;
      const name = el('td'); name.append(p.full_name || '—'); if (p.is_admin) name.append(' ', el('span', 'badge st-ok', 'Admin'));
      const tel = el('td');
      if (p.phone) { const a = el('a', null, p.phone); a.href = waLink(p.phone, `Bonjour ${p.full_name || ''}, ici Pro-clean LCK.`); a.target = '_blank'; a.rel = 'noopener'; tel.append(a); } else tel.textContent = '—';
      const mail = el('td');
      if (p.email) { const a = el('a', null, p.email); a.href = 'mailto:' + p.email; mail.append(a); } else mail.textContent = '—';
      tr.append(name, tel, mail, el('td', null, p.area || '—'), el('td', null, fmtDate(p.created_at)), el('td', null, String(n)));
      tb.append(tr);
    });
  }
})();
