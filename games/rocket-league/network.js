// Free multiplayer using PeerJS (WebRTC) – works on GitHub Pages, no account needed

const Network = {
  peer: null,
  connections: {},      // peerId -> DataConnection
  username: "Player",
  roomName: null,
  isHost: false,
  mode: "solo",
  players: {},          // id -> { name, team, peerId }
  myId: null,
  onPlayerJoin: null,
  onPlayerLeave: null,
  onMessage: null,

  init(username) {
    this.username = username || "Player";
    console.log("[Network] Ready – PeerJS multiplayer");
  },

  startSolo(onJoined) {
    this.mode = "solo";
    this.isHost = true;
    this.roomName = "SOLO";
    this.myId = "local";
    this.players = { local: { name: this.username, team: "blue" } };
    if (onJoined) onJoined();
  },

  createRoom(onJoined, onError) {
    this.mode = "multi";
    this.isHost = true;
    const code = "RL" + Math.random().toString(36).substring(2, 7).toUpperCase();
    this.roomName = code;

    this.peer = new Peer(code, {
      debug: 1
    });

    this.peer.on("open", (id) => {
      this.myId = id;
      this.players[id] = { name: this.username, team: "blue", peerId: id };
      console.log("[Network] Room created:", id);
      if (onJoined) onJoined(id);
    });

    this.peer.on("connection", (conn) => {
      this._setupConnection(conn, false);
    });

    this.peer.on("error", (err) => {
      console.error("[Network] Peer error", err);
      if (onError) onError(err);
    });
  },

  joinRoom(code, onJoined, onError) {
    this.mode = "multi";
    this.isHost = false;
    this.roomName = code.toUpperCase();

    this.peer = new Peer({
      debug: 1
    });

    this.peer.on("open", (id) => {
      this.myId = id;
      const conn = this.peer.connect(this.roomName, { reliable: true });
      this._setupConnection(conn, true, onJoined);
    });

    this.peer.on("error", (err) => {
      console.error("[Network] Join error", err);
      if (onError) onError(err);
    });
  },

  _setupConnection(conn, isJoining, onJoined) {
    conn.on("open", () => {
      this.connections[conn.peer] = conn;

      // Tell the other side who we are
      conn.send({
        type: "hello",
        name: this.username,
        id: this.myId
      });

      if (isJoining && onJoined) {
        this.players[this.myId] = { name: this.username, team: "orange", peerId: this.myId };
        onJoined(this.roomName);
      }
    });

    conn.on("data", (data) => {
      this._handleData(data, conn.peer);
    });

    conn.on("close", () => {
      delete this.connections[conn.peer];
      if (this.players[conn.peer]) {
        delete this.players[conn.peer];
        if (this.onPlayerLeave) this.onPlayerLeave(conn.peer);
      }
    });
  },

  _handleData(data, fromPeer) {
    if (!data || !data.type) return;

    if (data.type === "hello") {
      const team = Object.keys(this.players).length % 2 === 0 ? "blue" : "orange";
      this.players[fromPeer] = {
        name: data.name || "Player",
        team: team,
        peerId: fromPeer
      };
      if (this.onPlayerJoin) this.onPlayerJoin(fromPeer, this.players[fromPeer]);

      // Host replies with current player list + score
      if (this.isHost) {
        this.sendTo(fromPeer, {
          type: "welcome",
          players: this.players,
          blue: window._rlBlue || 0,
          orange: window._rlOrange || 0
        });
      }
    }

    if (data.type === "welcome") {
      this.players = data.players || this.players;
      if (this.onMessage) this.onMessage(data);
    }

    if (data.type === "pos" || data.type === "ball" || data.type === "score") {
      if (this.onMessage) this.onMessage(data, fromPeer);
    }
  },

  broadcast(data) {
    if (this.mode !== "multi") return;
    for (const id in this.connections) {
      try {
        this.connections[id].send(data);
      } catch (e) {}
    }
  },

  sendTo(peerId, data) {
    const conn = this.connections[peerId];
    if (conn && conn.open) {
      try { conn.send(data); } catch (e) {}
    }
  },

  sendPosition(data) {
    this.broadcast({ type: "pos", ...data, id: this.myId });
  },

  sendBall(data) {
    if (!this.isHost) return;
    this.broadcast({ type: "ball", ...data });
  },

  sendScore(blue, orange) {
    window._rlBlue = blue;
    window._rlOrange = orange;
    this.broadcast({ type: "score", blue, orange });
  },

  // Leaderboard (local for now)
  saveScore(username, goals) {
    const key = "rl_leaderboard_v2";
    let lb = {};
    try { lb = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
    if (!lb[username]) lb[username] = { goals: 0, matches: 0, wins: 0 };
    lb[username].goals += goals || 0;
    lb[username].matches += 1;
    localStorage.setItem(key, JSON.stringify(lb));
  },

  getLeaderboard() {
    try {
      const lb = JSON.parse(localStorage.getItem("rl_leaderboard_v2") || "{}");
      return Object.entries(lb)
        .map(([name, d]) => ({ name, goals: d.goals || 0, matches: d.matches || 0, wins: d.wins || 0 }))
        .sort((a, b) => b.goals - a.goals);
    } catch (e) {
      return [];
    }
  }
};
