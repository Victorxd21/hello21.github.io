const multiplayer = (() => {
  let channel, lobbyCode, playerId=crypto.randomUUID(), name, isHost=false, players=new Map(), started=false;
  const makeCode=()=>Math.random().toString(36).slice(2,7).toUpperCase();
  function setup(code){ lobbyCode=code; channel=supabaseClient.channel('jetpack-lobby-'+code,{config:{presence:{key:playerId}}}); channel.on('presence',{event:'sync'},sync).on('broadcast',{event:'start'},()=>{if(!started) UI.startGame(false)}).on('broadcast',{event:'death'},({payload})=>Game.remoteDeath(payload.score)).on('broadcast',{event:'score'},({payload})=>Game.remoteScore(payload.score)); return channel.subscribe(async status=>{if(status==='SUBSCRIBED'){await channel.track({name,host:isHost});sync();}}); }
  function sync(){if(!channel)return; const state=channel.presenceState(); players=new Map(Object.entries(state).flatMap(([id,vals])=>vals.map(v=>[id,{...v,id}]))); UI.renderPlayers([...players.values()]); if(isHost&&players.size>=2)document.getElementById('startGameBtn').disabled=false;}
  async function create(player){name=player;isHost=true;await setup(makeCode());}
  async function join(player,code){name=player;isHost=false;await setup(code.toUpperCase());}
  async function start(){started=true;await channel.send({type:'broadcast',event:'start',payload:{}});UI.startGame(true);}
  function sendDeath(score){channel?.send({type:'broadcast',event:'death',payload:{score}});}
  function sendScore(score){channel?.send({type:'broadcast',event:'score',payload:{score}});}
  async function leave(){if(channel){await channel.untrack();await supabaseClient.removeChannel(channel);channel=null;}players.clear();started=false;}
  return {create,join,start,sendDeath,sendScore,leave,get lobbyCode(){return lobbyCode},get isHost(){return isHost},get playerId(){return playerId},get name(){return name}};
})();
