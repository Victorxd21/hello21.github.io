// ===== UI STATE MACHINE =====
const UI = {
  role: null,
  selectedChar: null,
  selectedPerk: null,
  screens: {},

  init() {
    this.screens = {
      menu: document.getElementById('menu'),
      role: document.getElementById('role-select'),
      char: document.getElementById('char-select'),
      perk: document.getElementById('perk-select'),
      controls: document.getElementById('controls-screen'),
      game: document.getElementById('game-screen'),
      end: document.getElementById('end-screen')
    };

    document.getElementById('btn-play').onclick = () => this.show('role');
    document.getElementById('btn-how').onclick = () => this.show('controls');
    document.getElementById('btn-controls-back').onclick = () => this.show('menu');
    document.getElementById('btn-role-back').onclick = () => this.show('menu');
    document.getElementById('btn-char-back').onclick = () => this.show('role');
    document.getElementById('btn-perk-back').onclick = () => this.show('char');
    document.getElementById('btn-menu').onclick = () => this.show('menu');
    document.getElementById('btn-replay').onclick = () => this.show('role');

    document.querySelectorAll('.role-card').forEach(card => {
      card.onclick = () => {
        document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.role = card.dataset.role;
        setTimeout(() => this.openCharSelect(), 200);
      };
    });

    document.getElementById('btn-char-next').onclick = () => {
      if (!this.selectedChar) return;
      this.openPerkSelect();
    };

    document.getElementById('btn-start-match').onclick = () => {
      if (!this.selectedPerk && this.role === 'survivor') return;
      if (this.role === 'killer') this.selectedPerk = null;
      Game.startMatch(this.role, this.selectedChar, this.selectedPerk);
      this.show('game');
    };
  },

  show(name) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    if (this.screens[name]) this.screens[name].classList.add('active');
  },

  openCharSelect() {
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';
    this.selectedChar = null;
    document.getElementById('btn-char-next').disabled = true;
    const title = document.getElementById('char-select-title');
    title.textContent = this.role === 'killer' ? 'SELECT KILLER' : 'SELECT SURVIVOR';
    const pool = this.role === 'killer' ? KILLERS : SURVIVORS;
    for (const id in pool) {
      const kit = pool[id];
      const card = document.createElement('div');
      card.className = 'char-card';
      card.innerHTML = `<h4>${kit.name}</h4><div class="abilities">${kit.ability1.name}<br>${kit.ability2.name}</div>`;
      card.onclick = () => {
        grid.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedChar = id;
        document.getElementById('btn-char-next').disabled = false;
      };
      grid.appendChild(card);
    }
    this.show('char');
  },

  openPerkSelect() {
    if (this.role === 'killer') {
      this.selectedPerk = null;
      Game.startMatch(this.role, this.selectedChar, null);
      this.show('game');
      return;
    }
    const grid = document.getElementById('perk-grid');
    grid.innerHTML = '';
    this.selectedPerk = null;
    document.getElementById('btn-start-match').disabled = true;
    for (const id in PERKS) {
      const p = PERKS[id];
      const card = document.createElement('div');
      card.className = 'perk-card';
      card.innerHTML = `<h4>${p.name}</h4><p>${p.desc}</p>`;
      card.onclick = () => {
        grid.querySelectorAll('.perk-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedPerk = id;
        document.getElementById('btn-start-match').disabled = false;
      };
      grid.appendChild(card);
    }
    this.show('perk');
  },

  updateHUD(player, game) {
    if (!player) return;
    document.getElementById('hp-fill').style.width = (player.hp / player.maxHp * 100) + '%';
    document.getElementById('stam-fill').style.width = (player.stamina / player.maxStamina * 100) + '%';
    document.getElementById('stam-fill').parentElement.classList.toggle('exhausted', player.exhausted);
    const maliceGroup = document.getElementById('malice-group');
    if (player.team === 'killer') {
      maliceGroup.classList.remove('hidden');
      document.getElementById('malice-fill').style.width = (player.malice / player.maxMalice * 100) + '%';
    } else maliceGroup.classList.add('hidden');
    const a1 = player.kit.ability1, a2 = player.kit.ability2;
    document.getElementById('ability1-name').textContent = a1.name;
    document.getElementById('ability2-name').textContent = a2.name;
    document.getElementById('cd1').style.height = player.cd1 > 0 ? (player.cd1 / a1.cd * 100) + '%' : '0%';
    document.getElementById('cd2').style.height = player.cd2 > 0 ? (player.cd2 / a2.cd * 100) + '%' : '0%';
    document.getElementById('btn-ability1').disabled = player.cd1 > 0;
    document.getElementById('btn-ability2').disabled = player.cd2 > 0;
    document.getElementById('gen-count').textContent = `${game.map.repairedCount()}/5 GENS`;
    document.getElementById('survivor-count').textContent = `${game.aliveSurvivors()} ALIVE`;
  },

  showQTE(active) { document.getElementById('qte').classList.toggle('hidden', !active); },
  showGenProgress(show, pct, text) {
    const el = document.getElementById('gen-progress');
    el.classList.toggle('hidden', !show);
    if (show) {
      document.getElementById('gen-fill').style.width = pct + '%';
      document.getElementById('gen-text').textContent = text || 'REPAIRING...';
    }
  },
  status(msg, duration = 2) {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    clearTimeout(this._statusT);
    this._statusT = setTimeout(() => { el.textContent = ''; }, duration * 1000);
  },
  showEnd(title, statsHtml) {
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-stats').innerHTML = statsHtml;
    this.show('end');
  },
  setSpectator(on) {
    document.getElementById('spectator-banner').classList.toggle('hidden', !on);
  }
};
