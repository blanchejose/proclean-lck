/* Pro-clean LCK — quartiers de Douala, regroupés par arrondissement
   (suggestions des champs « Quartier » + accordéon de la section zone) */
(() => {
  const GROUPS = [
    { name: 'Douala 1er', hint: 'Akwa, Bonanjo, Deïdo', q: ['Akwa', 'Bali', 'Bonadibong', 'Bonamouti', 'Bonanjo', 'Bonapriso', 'Bonateki', 'Deïdo', 'Joss', 'Koumassi', 'Ngodi', 'Nkongmondo', 'Sébenjongo'] },
    { name: 'Douala 2e', hint: 'New-Bell, Nkololoun', q: ['Bonadoumbè', 'Congo', 'Kassalafam', 'Mboppi', 'New-Bell', 'Ngangue', 'Nkololoun', 'Youpwé'] },
    { name: 'Douala 3e', hint: 'Ndokoti, Logbaba, Japoma', q: ['Ange Raphaël', 'Bassa', 'Bilonguè', 'Bobongo', 'Brazzaville', 'Cité Cicam', 'Cité des Palmiers', 'Dakar', 'Japoma', 'Logbaba', 'Madagascar', 'Mbanga Bakoko', 'Ndogbati', 'Ndogbong', 'Ndoghem', 'Ndogpassi', 'Ndogsimbi', 'Ndokoti', 'Nkolmintag', 'Nyalla', 'Nylon', 'Oyack', 'PK8', 'PK10', 'PK12', 'PK14', 'PK21', 'Soboum', 'Tergal', 'Village', 'Yassa'] },
    { name: 'Douala 4e', hint: 'Bonabéri', q: ['Bojongo', 'Bonabéri', 'Bonamatoumbé', 'Bonassama', 'Bonendale', 'Djebalé', 'Grand Hangar', 'Mabanda', 'Ngwele', 'Rail', 'Sodiko'] },
    { name: 'Douala 5e', hint: 'Bonamoussadi, Kotto, Makepe', q: ['Akwa Nord', 'Beedi', 'Bépanda', 'Bonaloka', 'Bonamoussadi', 'Cité SIC', 'Denver', 'Kotto', 'Lendi', 'Logbessou', 'Logpom', 'Makepe', 'Makepe Missoké'] },
    { name: 'Douala 6e', hint: 'Île de Manoka', q: ['Manoka'] },
  ];
  const ALL = GROUPS.flatMap((g) => g.q).sort((a, b) => a.localeCompare(b, 'fr'));
  window.PC_QUARTIERS = ALL;

  // Suggestions sur tous les champs « Quartier » (on peut toujours taper un autre nom)
  const dl = document.createElement('datalist');
  dl.id = 'quartiers';
  dl.innerHTML = ALL.map((q) => `<option value="${q}"></option>`).join('');
  document.body.appendChild(dl);
  document.querySelectorAll('input[name="area"]').forEach((i) => { i.setAttribute('list', 'quartiers'); i.autocomplete = 'off'; });

  // Accordéon natif (<details>/<summary>) dans la section « zone »
  const acc = document.getElementById('q-acc');
  if (!acc) return;
  const search = document.getElementById('q-search');
  const count = document.getElementById('q-count');
  const empty = document.getElementById('q-empty');
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  acc.innerHTML = GROUPS.map((g, gi) => `
    <details class="q-group" name="quartiers"${gi === 3 ? ' open' : ''}>
      <summary>
        <span class="q-sum-txt"><strong>${g.name}</strong><small>${g.hint}</small></span>
        <span class="q-badge" data-n>${g.q.length}</span>
        <span class="q-chev" aria-hidden="true"></span>
      </summary>
      <ul class="q-list" role="list">
        ${g.q.map((q, i) => `<li style="--k:${i}"><button type="button" class="q-chip" data-q="${q}">${q}</button></li>`).join('')}
      </ul>
    </details>`).join('');
  const groups = [...acc.querySelectorAll('.q-group')];

  const filter = () => {
    const t = norm(search.value.trim());
    let total = 0;
    groups.forEach((d) => {
      let n = 0;
      d.querySelectorAll('li').forEach((li) => { const on = !t || norm(li.textContent).includes(t); li.hidden = !on; n += on; });
      d.hidden = n === 0;
      d.querySelector('[data-n]').textContent = n;
      total += n;
    });
    if (t) {
      // Recherche : on ouvre les groupes qui contiennent un résultat
      groups.filter((d) => !d.hidden).forEach((d) => { d.removeAttribute('name'); d.open = true; });
    } else {
      groups.forEach((d, i) => { d.open = i === 3; d.setAttribute('name', 'quartiers'); });
    }
    count.textContent = t ? `${total} quartier${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}` : `${ALL.length} quartiers desservis dans les 6 arrondissements`;
    empty.hidden = total > 0;
  };
  search.addEventListener('input', filter);
  filter();

  acc.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const area = document.querySelector('#quote-form input[name="area"]');
    if (area) area.value = b.dataset.q;
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    window.PC?.toast(`Quartier choisi : ${b.dataset.q}`);
  });
})();
