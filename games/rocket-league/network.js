// Network layer – Photon ready + local fallback
// App ID: e42a4126-88d9-4075-b4f2-6cfa9a885e05

const Network = {
  appId: window.PHOTON_APP_ID || "e42a4126-88d9-4075-b4f2-6cfa9a885e05",
  client: null,
  connected: false,
  roomName: null,
  myActor: 0,
  players: {},
  isHost: false,
  mode: "solo", // solo | multi

  // Simple event codes
  EVT: {
    POS: 1,
    BALL: 2,
    SCORE: 3,
    JOIN: 4,
    LEAVE: 5
  },

  init(username, onReady) {
    this.username = username;
    // For now we support full solo play immediately.
    // Real Photon multiplayer can be enabled once the official JS SDK files are added.
    this.connected = true;
    this.mode = "solo";
    if (onReady) onReady();
    console.log("[Network] Ready (solo mode). Photon App ID set:", this.appId);
  },

  startSolo(onJoined) {
    this.mode = "solo";
    this.isHost = true;
    this.roomName = "SOLO";
    this.players = { 1: { name: this.username, team: "blue" } };
    this.myActor = 1;
    if (onJoined) onJoined();
  },

  createRoom(code, onJoined) {
    this.mode = "multi";
    this.roomName = code || ("RL" + Math.random().toString(36).substring(2, 7).toUpperCase());
    this.isHost = true;
    this.myActor = 1;
    this.players = { 1: { name: this.username, team: "blue" } };
    console.log("[Network] Created room", this.roomName);
    // TODO: photonClient.createRoom(this.roomName, { maxPlayers: 8 });
    if (onJoined) onJoined(this.roomName);
  },

  joinRoom(code, onJoined) {
    this.mode = "multi";
    this.roomName = code;
    this.isHost = false;
    this.myActor = 2;
    this.players = {
      1: { name: "Host", team: "blue" },
      2: { name: this.username, team: "orange" }
    };
    console.log("[Network] Joined room", code);
    // TODO: photonClient.joinRoom(code);
    if (onJoined) onJoined(code);
  },

  sendPosition(data) {
    if (this.mode !== "multi") return;
    // TODO: photonClient.raiseEvent(this.EVT.POS, data, { receivers: Others });
  },

  sendBall(data) {
    if (this.mode !== "multi" || !this.isHost) return;
    // TODO: photonClient.raiseEvent(this.EVT.BALL, data, { receivers: Others });
  },

  sendScore(blue, orange) {
    if (this.mode !== "multi") return;
    // TODO: photonClient.raiseEvent(this.EVT.SCORE, { blue, orange });
  },

  // Leaderboard helpers (local for now, structure ready for global)
  saveScore(username, goals) {
    const key = "rl_leaderboard_v2";
    let lb = {};
    try { lb = JSON.parse(localStorage.getItem(key) || "{}"); } catch(e) {}
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
