/* Pro-clean LCK — interactions */
(() => {
  const root = document.documentElement;
  root.classList.add('js');

  // Les animations sont toujours actives
  const reduce = false;

  /* ---------- Header + barre de progression ---------- */
  const header = document.querySelector('.site-header');
  const bar = document.querySelector('.scroll-progress span');
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 30);
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Menu mobile accessible ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('menu');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.classList.toggle('open', open);
    if (open) menu.querySelector('a').focus();
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); toggle.focus(); }
  });

  /* ---------- Lien actif selon la section ---------- */
  const links = [...menu.querySelectorAll('a[href^="#"]:not(.btn)')];
  const secObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((l) => {
        const on = l.getAttribute('href') === '#' + en.target.id;
        l.classList.toggle('active', on);
        on ? l.setAttribute('aria-current', 'location') : l.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((l) => { const s = document.querySelector(l.getAttribute('href')); if (s) secObs.observe(s); });

  /* ---------- Apparition au défilement ---------- */
  document.querySelectorAll('.hero .reveal').forEach((el, i) => el.style.setProperty('--i', i));
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealObs.unobserve(en.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => revealObs.observe(el));

  /* Ligne entre les étapes */
  const steps = document.querySelector('.steps');
  new IntersectionObserver(([en], o) => {
    if (en.isIntersecting) { steps.style.setProperty('--line', 1); o.disconnect(); }
  }, { threshold: 0.4 }).observe(steps);

  /* ---------- Compteurs ---------- */
  const countObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target; const end = +el.dataset.count;
      countObs.unobserve(el);
      if (reduce) { el.textContent = end; return; }
      const t0 = performance.now(); const dur = 1600;
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => countObs.observe(el));

  /* ---------- Bulles de savon dans le hero ---------- */
  const bubbles = document.querySelector('.bubbles');
  let bubbleTimer = null;
  function spawnBubble() {
    if (reduce || document.hidden) return;
    const b = document.createElement('span');
    const size = 14 + Math.random() * 56;
    b.className = 'bubble';
    b.style.width = b.style.height = size + 'px';
    b.style.left = Math.random() * 100 + '%';
    b.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
    b.style.animationDuration = 8 + Math.random() * 8 + 's';
    b.addEventListener('animationend', () => b.remove());
    bubbles.appendChild(b);
  }
  function startBubbles() {
    if (bubbleTimer || reduce) return;
    for (let i = 0; i < 6; i++) setTimeout(spawnBubble, i * 300);
    bubbleTimer = setInterval(() => { if (reduce) { clearInterval(bubbleTimer); bubbleTimer = null; } else spawnBubble(); }, 700);
  }
  startBubbles();

  /* ---------- Cartes 3D + halo (souris uniquement) ---------- */
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
    document.querySelectorAll('.tilt').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', x * 100 + '%');
        card.style.setProperty('--my', y * 100 + '%');
        if (!reduce) card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 10}deg) translateY(-6px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });

    document.querySelectorAll('.magnetic').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        if (reduce) return;
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.15}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });

    /* Parallaxe légère du visuel hero */
    const visual = document.querySelector('.hero-visual');
    document.querySelector('.hero').addEventListener('pointermove', (e) => {
      if (reduce) return;
      const x = e.clientX / innerWidth - 0.5; const y = e.clientY / innerHeight - 0.5;
      visual.style.transform = `translate(${x * -20}px, ${y * -20}px)`;
    });
  }

  /* ---------- Avant / après ---------- */
  const ba = document.getElementById('ba');
  const range = document.getElementById('ba-range');
  const setBA = (v) => {
    ba.style.setProperty('--pos', v + '%');
    range.setAttribute('aria-valuetext', `${100 - v} % nettoyé`);
  };
  range.addEventListener('input', () => setBA(range.value));
  // glisser directement sur l'image (souris / tactile)
  let dragging = false;
  const fromPointer = (e) => {
    const r = ba.getBoundingClientRect();
    const v = Math.round(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * 100);
    range.value = v; setBA(v);
  };
  ba.addEventListener('pointerdown', (e) => { dragging = true; ba.setPointerCapture(e.pointerId); fromPointer(e); });
  ba.addEventListener('pointermove', (e) => dragging && fromPointer(e));
  ba.addEventListener('pointerup', () => { dragging = false; });
  ba.style.touchAction = 'pan-y';
  // petite démo automatique à l'apparition
  new IntersectionObserver(([en], o) => {
    if (!en.isIntersecting || reduce) return;
    o.disconnect();
    let t0 = null;
    const demo = (t) => {
      if (dragging) return;
      t0 ??= t; const p = (t - t0) / 2200;
      if (p >= 1) { range.value = 50; setBA(50); return; }
      const v = Math.round(50 + Math.sin(p * Math.PI * 2) * 35);
      range.value = v; setBA(v);
      requestAnimationFrame(demo);
    };
    requestAnimationFrame(demo);
  }, { threshold: 0.6 }).observe(ba);

  /* ---------- Formulaire de demande (enregistré dans le compte) ---------- */
  const form = document.getElementById('quote-form');
  const F = form.elements;
  const status = form.querySelector('.form-status');
  const showErr = (input, id, msg) => {
    const err = document.getElementById(id);
    err.textContent = msg;
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };
  // Pré-remplir avec le profil du client connecté
  F.date.min = new Date().toISOString().slice(0, 10);
  // Formulaire verrouillé tant qu'on n'est pas connecté
  const gate = document.getElementById('form-gate');
  const body = document.getElementById('form-body');
  gate.querySelectorAll('[data-gate]').forEach((b) => b.addEventListener('click', () => PC.openAuth(b.dataset.gate)));
  PC.onChange((user, profile) => {
    gate.hidden = Boolean(user);
    body.hidden = !user;
    body.querySelectorAll('input, select, textarea, button').forEach((x) => { x.disabled = !user; });
    if (!profile) return;
    if (!F.name.value) F.name.value = profile.full_name || '';
    if (!F.phone.value) F.phone.value = profile.phone || '';
    if (!F.area.value) F.area.value = profile.area || '';
  });

  const done = document.getElementById('form-done');
  const submitBtn = form.querySelector('[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    done.hidden = true;
    const name = F.name.value.trim();
    const phone = F.phone.value.trim();
    const services = [...form.querySelectorAll('input[name="service"]:checked')].map((c) => c.value);

    const okName = showErr(F.name, 'e-name', name.length < 2 ? 'Veuillez indiquer votre nom.' : '');
    const okPhone = showErr(F.phone, 'e-phone', phone.replace(/\D/g, '').length < 8 ? 'Veuillez entrer un numéro de téléphone valide.' : '');
    const okServ = showErr(null, 'e-service', services.length ? '' : 'Choisissez au moins un service.');

    if (!(okName && okPhone && okServ)) {
      status.textContent = '';
      const first = !okName ? F.name : !okPhone ? F.phone : form.querySelector('input[name="service"]');
      first.focus();
      return;
    }

    // Compte obligatoire : on ouvre la connexion, la demande est envoyée juste après
    const logged = await PC.requireAuth('Connectez-vous ou créez un compte gratuit pour envoyer votre demande. Vous pourrez ensuite la suivre, la modifier ou l’annuler.');
    if (!logged) { status.textContent = 'Connectez-vous pour envoyer votre demande.'; return; }

    const row = {
      name, phone, services,
      area: F.area.value.trim() || null,
      freq: F.freq.value,
      preferred_date: F.date.value || null,
      message: F.msg.value.trim() || null,
    };
    submitBtn.disabled = true;
    status.textContent = 'Envoi en cours…';
    const { data, error } = await PC.sb.from('requests').insert(row).select('id').single();
    submitBtn.disabled = false;
    if (error) { status.textContent = 'Oups, l’envoi a échoué. Réessayez ou écrivez-nous sur WhatsApp.'; return; }

    const lines = [
      `Bonjour Pro-clean LCK, je viens d'envoyer la demande n°${data.id} sur le site.`,
      `• Nom : ${name}`,
      `• Service(s) : ${services.join(', ')}`,
      row.area && `• Quartier : ${row.area}`,
      row.preferred_date && `• Date souhaitée : ${new Date(row.preferred_date).toLocaleDateString('fr-FR')}`,
    ].filter(Boolean).join('\n');
    document.getElementById('wa-notify').href = 'https://wa.me/237674488060?text=' + encodeURIComponent(lines);

    form.querySelectorAll('input[name="service"]').forEach((c) => { c.checked = false; });
    F.msg.value = ''; F.date.value = '';
    status.textContent = `Merci ! Votre demande n°${data.id} est enregistrée. Nous vous recontactons très vite.`;
    done.hidden = false;
    PC.toast('Demande envoyée !');
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
