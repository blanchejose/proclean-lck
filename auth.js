/* Pro-clean LCK — comptes clients (partagé par toutes les pages)
   Expose window.PC : { sb, user, profile, onChange, requireAuth, openAuth, signOut, toast, esc } */
(() => {
  const cfg = window.PROCLEAN_CONFIG || {};
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  let user = null;
  let profile = null;
  let ready = false;
  const listeners = [];
  let pending = null; // promesse de requireAuth en attente

  /* ---------- Notifications (toast) ---------- */
  const toastBox = document.createElement('div');
  toastBox.className = 'toasts';
  toastBox.setAttribute('role', 'status');
  toastBox.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastBox);
  function toast(msg, type = 'ok') {
    const t = document.createElement('p');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    toastBox.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 4200);
  }

  /* ---------- Fenêtre connexion / inscription ---------- */
  const dlg = document.createElement('dialog');
  dlg.className = 'review-dialog auth-dialog';
  dlg.setAttribute('aria-labelledby', 'auth-title');
  dlg.innerHTML = `
    <div class="auth-wrap">
      <div class="rd-head">
        <h2 id="auth-title">Mon compte</h2>
        <button type="button" class="rd-close" data-close aria-label="Fermer la fenêtre">×</button>
      </div>
      <p class="auth-reason" id="auth-reason" hidden></p>
      <div class="auth-tabs" role="tablist" aria-label="Connexion ou inscription">
        <button type="button" role="tab" id="tab-login" aria-controls="pane-login" aria-selected="true">Se connecter</button>
        <button type="button" role="tab" id="tab-signup" aria-controls="pane-signup" aria-selected="false" tabindex="-1">Créer un compte</button>
      </div>

      <form id="pane-login" role="tabpanel" aria-labelledby="tab-login" novalidate>
        <div class="field"><label for="li-email">E-mail</label><input id="li-email" type="email" autocomplete="email" required /></div>
        <div class="field"><label for="li-pass">Mot de passe</label><input id="li-pass" type="password" autocomplete="current-password" required minlength="6" /></div>
        <p class="error" data-err aria-live="polite"></p>
        <button type="submit" class="btn btn-green btn-lg btn-block">Se connecter</button>
        <button type="button" class="link-btn" id="forgot">Mot de passe oublié ?</button>
      </form>

      <form id="pane-signup" role="tabpanel" aria-labelledby="tab-signup" novalidate hidden>
        <div class="field"><label for="su-name">Nom complet</label><input id="su-name" type="text" autocomplete="name" required maxlength="60" /></div>
        <div class="field"><label for="su-phone">Téléphone (WhatsApp)</label><input id="su-phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30" placeholder="6XX XXX XXX" /></div>
        <div class="field"><label for="su-email">E-mail</label><input id="su-email" type="email" autocomplete="email" required /></div>
        <div class="field"><label for="su-pass">Mot de passe <small>(6 caractères minimum)</small></label><input id="su-pass" type="password" autocomplete="new-password" required minlength="6" /></div>
        <p class="error" data-err aria-live="polite"></p>
        <button type="submit" class="btn btn-green btn-lg btn-block">Créer mon compte</button>
      </form>
    </div>`;
  document.body.appendChild(dlg);

  const $d = (s) => dlg.querySelector(s);
  const tabs = [$d('#tab-login'), $d('#tab-signup')];
  function showTab(which) {
    tabs.forEach((t) => {
      const on = t.id === 'tab-' + which;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $d('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(t.id.slice(4)));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + 1) % 2]; next.focus(); showTab(next.id.slice(4));
    });
  });
  dlg.addEventListener('close', () => { if (pending) { pending(Boolean(user)); pending = null; } });

  const FR = {
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
    'User already registered': 'Un compte existe déjà avec cet e-mail. Connectez-vous.',
    'Password should be at least 6 characters.': 'Le mot de passe doit contenir au moins 6 caractères.',
    'Unable to validate email address: invalid format': 'Adresse e-mail invalide.',
  };
  const fr = (m) => FR[m] || (/rate limit/i.test(m) ? 'Trop de tentatives, réessayez dans quelques minutes.' : m);

  function busy(form, on, label) {
    const b = form.querySelector('[type=submit]');
    b.disabled = on;
    if (on) { b.dataset.label = b.textContent; b.textContent = label; } else if (b.dataset.label) b.textContent = b.dataset.label;
  }

  $d('#pane-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; const err = f.querySelector('[data-err]');
    const email = $d('#li-email').value.trim(); const password = $d('#li-pass').value;
    if (!email || password.length < 6) { err.textContent = 'Entrez votre e-mail et votre mot de passe.'; return; }
    busy(f, true, 'Connexion…');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    busy(f, false);
    if (error) { err.textContent = fr(error.message); return; }
    err.textContent = ''; f.reset();
    await waitProfile();
    dlg.close();
    toast('Bienvenue ' + (firstName() || '') + ' !');
  });

  $d('#pane-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget; const err = f.querySelector('[data-err]');
    const full_name = $d('#su-name').value.trim(); const phone = $d('#su-phone').value.trim();
    const email = $d('#su-email').value.trim(); const password = $d('#su-pass').value;
    if (full_name.length < 2) { err.textContent = 'Indiquez votre nom.'; $d('#su-name').focus(); return; }
    if (phone.replace(/\D/g, '').length < 8) { err.textContent = 'Indiquez un numéro de téléphone valide.'; $d('#su-phone').focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Indiquez une adresse e-mail valide.'; $d('#su-email').focus(); return; }
    if (password.length < 6) { err.textContent = 'Le mot de passe doit contenir au moins 6 caractères.'; $d('#su-pass').focus(); return; }
    busy(f, true, 'Création du compte…');
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name, phone } } });
    busy(f, false);
    if (error) { err.textContent = fr(error.message); return; }
    if (!data.session) { err.textContent = 'Compte créé ! Vérifiez vos e-mails pour l’activer, puis connectez-vous.'; showTab('login'); return; }
    err.textContent = ''; f.reset();
    await waitProfile();
    dlg.close();
    toast('Compte créé, bienvenue ' + (firstName() || '') + ' !');
  });

  $d('#forgot').addEventListener('click', async () => {
    const email = $d('#li-email').value.trim();
    const err = $d('#pane-login [data-err]');
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Écrivez d’abord votre e-mail ci-dessus.'; $d('#li-email').focus(); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL('compte.html#profil', location.href).href });
    err.textContent = error ? fr(error.message) : 'Si un compte existe, un e-mail de réinitialisation vient d’être envoyé.';
  });

  function openAuth(mode = 'login', reason = '') {
    showTab(mode);
    const r = $d('#auth-reason');
    r.hidden = !reason; r.textContent = reason;
    dlg.querySelectorAll('[data-err]').forEach((e) => { e.textContent = ''; });
    if (!dlg.open) dlg.showModal();
    setTimeout(() => $d(mode === 'login' ? '#li-email' : '#su-name').focus(), 50);
  }

  /* Renvoie true si connecté (ouvre la fenêtre sinon et attend) */
  function requireAuth(reason) {
    if (user) return Promise.resolve(true);
    return new Promise((res) => { pending = res; openAuth('login', reason); });
  }

  /* ---------- Session ---------- */
  async function loadProfile() {
    if (!user) { profile = null; return; }
    const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    profile = data;
  }
  let profileReady = Promise.resolve();
  const waitProfile = () => profileReady;

  sb.auth.onAuthStateChange((event, session) => {
    const newUser = session ? session.user : null;
    const changed = (newUser && newUser.id) !== (user && user.id) || !ready;
    user = newUser;
    if (event === 'PASSWORD_RECOVERY') sessionStorage.setItem('pc-recovery', '1');
    if (!changed && event !== 'USER_UPDATED') return;
    // pas d'appel Supabase directement dans ce callback (recommandation Supabase)
    profileReady = new Promise((res) => setTimeout(async () => { await loadProfile(); ready = true; emit(); res(); }, 0));
  });

  function emit() { renderHeader(); listeners.forEach((f) => f(user, profile)); }
  function onChange(f) { listeners.push(f); if (ready) f(user, profile); }
  async function refreshProfile() { await loadProfile(); emit(); }

  async function signOut() {
    await sb.auth.signOut();
    toast('Vous êtes déconnecté(e).');
  }

  const firstName = () => ((profile && profile.full_name) || '').split(' ')[0];

  /* ---------- Bouton du menu ---------- */
  function renderHeader() {
    document.querySelectorAll('.nav-auth').forEach((slot) => {
      slot.replaceChildren();
      if (!user) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn btn-sm btn-ghost';
        b.textContent = 'Se connecter';
        b.addEventListener('click', () => openAuth('login'));
        slot.appendChild(b);
        return;
      }
      const a = document.createElement('a');
      a.href = 'compte.html'; a.className = 'btn btn-sm btn-ghost account-link';
      a.innerHTML = '<span class="acc-dot" aria-hidden="true"></span>';
      a.append('Mon espace');
      a.querySelector('.acc-dot').textContent = (firstName() || '?').charAt(0).toUpperCase();
      slot.appendChild(a);
      if (profile && profile.is_admin) {
        const ad = document.createElement('a');
        ad.href = 'admin.html'; ad.className = 'btn btn-sm btn-green'; ad.textContent = 'Admin';
        slot.appendChild(ad);
      }
    });
  }

  /* ---------- Outils partagés (pages Mon espace / Admin) ---------- */
  const STATUS = {
    en_attente: { label: 'En attente', cls: 'st-wait' },
    confirmee: { label: 'Confirmée', cls: 'st-ok' },
    terminee: { label: 'Terminée', cls: 'st-done' },
    annulee: { label: 'Annulée', cls: 'st-cancel' },
  };

  // Onglets accessibles (flèches gauche/droite, aria-selected)
  function setupTabs(tablist, onShow) {
    const tabsEls = [...tablist.querySelectorAll('[role=tab]')];
    const show = (tab, focus) => {
      tabsEls.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
      if (onShow) onShow(tab.id);
    };
    tabsEls.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); show(tabsEls[(i + d + tabsEls.length) % tabsEls.length], true); }
      });
    });
    return (id) => { const t = document.getElementById(id); if (t) show(t); };
  }

  const fmtDate = (d, withTime) => new Date(d).toLocaleDateString('fr-FR', withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', year: 'numeric' });

  // Fermer les fenêtres <dialog> avec le bouton × ou un clic sur le fond
  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-close]');
    if (close) { const d = close.closest('dialog'); if (d) d.close(); }
    else if (e.target.tagName === 'DIALOG') e.target.close();
  });

  const esc = (s) =>String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.PC = {
    sb, toast, esc, STATUS, setupTabs, fmtDate, openAuth, requireAuth, onChange, signOut, refreshProfile, waitProfile, firstName,
    get user() { return user; }, get profile() { return profile; }, get ready() { return ready; },
  };
})();
