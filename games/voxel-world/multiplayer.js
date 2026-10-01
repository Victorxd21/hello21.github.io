const Multiplayer = (() => {
  let channel, worldCode, playerId = crypto.randomUUID(), playerName, isHost = false;
  const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

  async function setup(code) {
    worldCode = code;
    channel = supabaseClient.channel('voxel-world-' + code, { config: { presence: { key: playerId } } });

    channel
      .on('presence', { event: 'sync' }, syncPlayers)
      .on('broadcast', { event: 'move' }, ({ payload }) => updateRemotePlayer(payload))
      .on('broadcast', { event: 'blockChange' }, ({ payload }) => handleRemoteBlockChange(payload));

    return channel.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ name: playerName, x: 0, y: 0 });
      }
    });
  }

  function syncPlayers() {
    if (!channel) return;
    const state = channel.presenceState();
    const allPlayers = new Map(
      Object.entries(state).flatMap(([id, vals]) =>
        vals.map(v => [id, { ...v, id }])
      )
    );
    VoxelEngine.players = allPlayers;
    document.getElementById('playerCount').textContent = allPlayers.size;
  }

  function updateRemotePlayer(payload) {
    const player = VoxelEngine.players.get(payload.id);
    if (player) {
      player.x = payload.x;
      player.y = payload.y;
    }
  }

  function handleRemoteBlockChange(payload) {
    VoxelEngine.getBlock(payload.x, payload.y);
    if (payload.blockType === WorldGenerator.BLOCKS.AIR) {
      VoxelEngine.breakBlock(payload.x, payload.y);
    } else {
      VoxelEngine.placeBlock(payload.x, payload.y, payload.blockType);
    }
  }

  async function createWorld(name) {
    playerName = name;
    isHost = true;
    await setup(makeCode());
  }

  async function joinWorld(name, code) {
    playerName = name;
    isHost = false;
    await setup(code.toUpperCase());
  }

  async function broadcastPlayerPosition(x, y) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'move',
        payload: { id: playerId, name: playerName, x, y }
      });
    }
  }

  async function broadcastBlockChange(x, y, blockType) {
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'blockChange',
        payload: { x, y, blockType, id: playerId }
      });
    }
  }

  async function leave() {
    if (channel) {
      await channel.untrack();
      await supabaseClient.removeChannel(channel);
      channel = null;
    }
  }

  return {
    createWorld,
    joinWorld,
    broadcastPlayerPosition,
    broadcastBlockChange,
    leave,
    get worldCode() { return worldCode; },
    get playerId() { return playerId; },
    get isHost() { return isHost; }
  };
})();
