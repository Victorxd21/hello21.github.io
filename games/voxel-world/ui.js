const UI = (() => {
  const $ = id => document.getElementById(id);

  let selectedHotbarSlot = 0;
  let hotbar = [null, null, null, null, null, null, null, null, null];
  let inventory = [];

  const AVAILABLE_BLOCKS = [
    { name: 'Stone', type: WorldGenerator.BLOCKS.STONE },
    { name: 'Dirt', type: WorldGenerator.BLOCKS.DIRT },
    { name: 'Grass', type: WorldGenerator.BLOCKS.GRASS },
    { name: 'Sand', type: WorldGenerator.BLOCKS.SAND },
    { name: 'Wood', type: WorldGenerator.BLOCKS.WOOD },
    { name: 'Cobblestone', type: WorldGenerator.BLOCKS.COBBLESTONE }
  ];

  function renderHotbar() {
    const container = $('hotbarContainer');
    container.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (i === selectedHotbarSlot ? ' selected' : '') + (hotbar[i] ? ' has-item' : '');
      if (hotbar[i]) {
        slot.style.backgroundColor = WorldGenerator.BLOCK_COLORS[hotbar[i]];
        slot.textContent = (i + 1);
      } else {
        slot.textContent = (i + 1);
      }
      slot.onclick = () => selectHotbarSlot(i);
      container.appendChild(slot);
    }
  }

  function selectHotbarSlot(index) {
    selectedHotbarSlot = index;
    renderHotbar();
  }

  function renderInventory() {
    const grid = $('inventoryGrid');
    grid.innerHTML = '';
    AVAILABLE_BLOCKS.forEach(block => {
      const item = document.createElement('div');
      item.className = 'block-item';
      item.style.backgroundColor = WorldGenerator.BLOCK_COLORS[block.type];
      item.textContent = block.name;
      item.onclick = () => addToHotbar(block.type);
      grid.appendChild(item);
    });
  }

  function addToHotbar(blockType) {
    hotbar[selectedHotbarSlot] = blockType;
    renderHotbar();
  }

  function getSelectedBlock() {
    return hotbar[selectedHotbarSlot];
  }

  function startGame(isCreating) {
    $('lobbyScreen').classList.remove('active');
    $('gameHUD').classList.remove('hidden');
    
    if (isCreating) {
      $('codeDisplay').textContent = Multiplayer.worldCode;
    }
    
    $('playerNameHUD').textContent = document.getElementById('playerName').value;
    renderHotbar();
    renderInventory();
  }

  function toggleInventory() {
    const modal = $('inventoryModal');
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) {
      renderInventory();
    }
  }

  $('createWorldBtn').onclick = async () => {
    const name = $('playerName').value.trim();
    if (name) {
      await Multiplayer.createWorld(name);
      startGame(true);
    }
  };

  $('joinWorldBtn').onclick = () => {
    $('joinSection').classList.remove('hidden');
  };

  $('backBtn').onclick = () => {
    $('joinSection').classList.add('hidden');
  };

  $('confirmJoinBtn').onclick = async () => {
    const name = $('playerName').value.trim();
    const code = $('worldCode').value.trim();
    if (name && code) {
      await Multiplayer.joinWorld(name, code);
      startGame(false);
    }
  };

  $('closeInventoryBtn').onclick = () => toggleInventory();

  // Hotbar selection with number keys
  window.addEventListener('keydown', e => {
    if (e.key >= '1' && e.key <= '9') {
      selectHotbarSlot(parseInt(e.key) - 1);
    }
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      toggleInventory();
    }
  });

  return {
    startGame,
    toggleInventory,
    getSelectedBlock,
    selectHotbarSlot,
    renderHotbar
  };
})();
