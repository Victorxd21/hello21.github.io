const PIECE_BASE='https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/';
function pieceSrc(c,t){return PIECE_BASE+c+t.toUpperCase()+'.svg'}
const DIFF_LABELS={1:'Easy',2:'Medium',3:'Hard',4:'Master'};

const OPENINGS={
  'e4':"King's Pawn",'e4 e5':'Open Game','e4 e5 Nf3':"King's Knight",'e4 e5 Nf3 Nc6':"King's Knight",
  'e4 e5 Nf3 Nc6 Bb5':'Ruy Lopez','e4 e5 Nf3 Nc6 Bc4':'Italian Game','e4 e5 Nf3 Nc6 Bc4 Bc5':'Giuoco Piano',
  'e4 e5 Nf3 Nc6 d4':'Scotch Game','e4 e5 Nf3 Nf6':"Petrov's Defense",'e4 e5 f4':"King's Gambit",
  'e4 c5':'Sicilian Defense','e4 c5 Nf3':'Sicilian Defense','e4 c5 Nf3 d6':'Sicilian Defense',
  'e4 c5 Nf3 Nc6':'Sicilian Defense','e4 c5 Nf3 e6':'Sicilian · French','e4 c6':'Caro-Kann',
  'e4 e6':'French Defense','e4 e6 d4 d5':'French Defense','e4 d5':'Scandinavian',
  'e4 Nf6':"Alekhine's Defense",'e4 d6':'Pirc Defense','e4 g6':'Modern Defense',
  'd4':"Queen's Pawn",'d4 d5':'Closed Game','d4 d5 c4':"Queen's Gambit",'d4 d5 c4 e6':'QGD',
  'd4 d5 c4 c6':'Slav Defense','d4 Nf6':'Indian Defense','d4 Nf6 c4':'Indian Defense',
  'd4 Nf6 c4 e6':"Nimzo/Queen's Indian",'d4 Nf6 c4 g6':"King's Indian",'d4 Nf6 c4 g6 Nc3 Bg7':"King's Indian",
  'd4 Nf6 c4 e6 Nc3 Bb4':'Nimzo-Indian','d4 f5':'Dutch Defense','c4':'English Opening',
  'c4 e5':'English · Reversed Sicilian','c4 c5':'English Symmetrical','Nf3':'Réti Opening',
  'Nf3 d5':'Réti Opening','g3':'Benko Opening','f4':"Bird's Opening",'b3':"Larsen's Opening",
  'e4 c5 Nf3 d6 d4':'Open Sicilian','e4 c5 Nf3 d6 d4 cxd4 Nxd4':'Open Sicilian',
  'e4 e5 Nf3 Nc6 Bb5 a6':'Ruy Lopez · Morphy','e4 e5 Nf3 Nc6 Bb5 Nf6':'Berlin Defense'
};

const PUZZLES=[
  {fen:'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',sol:['Qxf7#'],title:'Mate in 1',hint:"Scholar's mate pattern"},
  {fen:'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',sol:['Qh4#'],title:'Mate in 1',hint:"Fool's mate"},
  {fen:'6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',sol:['Rd8#'],title:'Mate in 1',hint:'Back rank'},
  {fen:'6k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1',sol:['Qf8#'],title:'Mate in 1',hint:'Queen on the 8th'},
  {fen:'6k1/6pp/8/8/8/8/6PP/R5K1 w - - 0 1',sol:['Ra8#'],title:'Mate in 1',hint:'Rook on the 8th'},
  {fen:'7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',sol:['Qf8#'],title:'Mate in 1',hint:'King and queen'},
  {fen:'2r3k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1',sol:['Rc8+','Rxc8','Rxc8#'],title:'Mate in 2',hint:'Back rank deflection'},
  {fen:'5rk1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1',sol:['Qb8','Rxb8','Rxb8#'],title:'Mate in 2',hint:'Queen sac for back rank'},
  {fen:'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',sol:['Bxf7+'],title:'Sacrifice',hint:'King hunt start'},
  {fen:'2k5/2p5/8/8/8/8/2P5/2K1Q3 w - - 0 1',sol:['Qa5'],title:'Mate setup',hint:'Restrict the king'},
  {fen:'r3k2r/ppp2ppp/2n5/3p4/3P4/2N5/PPP2PPP/R3K2R w KQkq - 0 1',sol:['O-O-O'],title:'Castle',hint:'Long castle'},
  {fen:'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4',sol:['Kxf7'],title:'After sac',hint:'King must take'}
];

let audioCtx=null, muted=false;
function ensureAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)()}
function beep(freq,dur,type,vol){
  if(muted)return;
  try{
    ensureAudio();
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type||'sine'; o.frequency.value=freq;
    g.gain.value=vol||0.08;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime+dur);
  }catch(e){}
}
function sndMove(){beep(420,.06,'triangle',.06)}
function sndCapture(){beep(280,.08,'square',.07);setTimeout(()=>beep(180,.1,'square',.05),40)}
function sndCheck(){beep(600,.1,'sine',.08);setTimeout(()=>beep(800,.12,'sine',.07),90)}
function sndWin(){beep(523,.12,'sine',.09);setTimeout(()=>beep(659,.12,'sine',.09),130);setTimeout(()=>beep(784,.2,'sine',.09),260)}
function sndLose(){beep(300,.15,'sawtooth',.07);setTimeout(()=>beep(200,.25,'sawtooth',.06),150)}
function sndBrilliant(){beep(880,.08,'sine',.08);setTimeout(()=>beep(1100,.15,'sine',.08),80)}

const STATS_KEY='chess_hello21_stats';
function loadStats(){try{return JSON.parse(localStorage.getItem(STATS_KEY))||{w:0,d:0,l:0,p:0}}catch(e){return{w:0,d:0,l:0,p:0}}}
function saveStats(s){localStorage.setItem(STATS_KEY,JSON.stringify(s))}
function updateStatsUI(){const s=loadStats();document.getElementById('statW').textContent=s.w;document.getElementById('statD').textContent=s.d;document.getElementById('statL').textContent=s.l;document.getElementById('statP').textContent=s.p}
function recordResult(result){const s=loadStats();if(result==='w')s.w++;else if(result==='d')s.d++;else if(result==='l')s.l++;else if(result==='p')s.p++;saveStats(s);updateStatsUI()}

let game=new Chess(), selected=null, possibleMoves=[], lastMove=null;
let playerColor='w', mode='normal', aiDepth=2, flipped=false;
let gameOver=false, thinking=false, animating=false;
let timeWhite=600000, timeBlack=600000, increment=5000, clockInterval=null, lastTick=null;
let puzzleIndex=0, puzzleSol=[], puzzleStep=0, puzzleMode=false;

const boardEl=document.getElementById('board');
const statusEl=document.getElementById('status');
const movesEl=document.getElementById('moves');
const modeBadge=document.getElementById('modeBadge');
const promoOverlay=document.getElementById('promoOverlay');
const promoChoices=document.getElementById('promoChoices');
const openingEl=document.getElementById('openingName');
const arrowLayer=document.getElementById('arrowLayer');
const qualityEl=document.getElementById('moveQuality');

const PST={
  p:[[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
  n:[[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
  b:[[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
  r:[[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
  q:[[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
  k:[[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]]
};
const VALUES={p:100,n:320,b:330,r:500,q:900,k:20000};

function evaluate(g){
  if(g.in_checkmate())return g.turn()==='w'?-99999:99999;
  if(g.in_draw())return 0;
  let score=0; const board=g.board();
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=board[r][c]; if(!p)continue;
    const val=VALUES[p.type], table=PST[p.type];
    const pst=p.color==='w'?table[r][c]:table[7-r][c];
    score+=p.color==='w'?(val+pst):-(val+pst);
  }
  score+=(g.turn()==='w'?1:-1)*g.moves().length*2;
  return score;
}
function minimax(g,depth,alpha,beta,maximizing){
  if(depth===0||g.game_over())return evaluate(g);
  const moves=g.moves({verbose:true});
  moves.sort((a,b)=>(b.captured?1:0)-(a.captured?1:0));
  if(maximizing){
    let maxEval=-Infinity;
    for(const m of moves){g.move(m);const ev=minimax(g,depth-1,alpha,beta,false);g.undo();maxEval=Math.max(maxEval,ev);alpha=Math.max(alpha,ev);if(beta<=alpha)break}
    return maxEval;
  }else{
    let minEval=Infinity;
    for(const m of moves){g.move(m);const ev=minimax(g,depth-1,alpha,beta,true);g.undo();minEval=Math.min(minEval,ev);beta=Math.min(beta,ev);if(beta<=alpha)break}
    return minEval;
  }
}
function getBestMove(depth){
  const moves=game.moves({verbose:true}); if(!moves.length)return null;
  moves.sort((a,b)=>(b.captured?1:0)-(a.captured?1:0));
  const isMax=game.turn()==='w'; let best=null, bestScore=isMax?-Infinity:Infinity;
  for(const m of moves){
    game.move(m); const score=minimax(game,depth-1,-Infinity,Infinity,!isMax); game.undo();
    if(isMax?score>bestScore:score<bestScore){bestScore=score;best=m}
  }
  return best;
}
function rateMove(playedMove, beforeFen){
  const g=new Chess(beforeFen);
  const before=evaluate(g);
  const isWhite=g.turn()==='w';
  const moves=g.moves({verbose:true});
  let bestScore=isWhite?-Infinity:Infinity;
  for(const m of moves){g.move(m); const sc=evaluate(g); g.undo();if(isWhite?sc>bestScore:sc<bestScore)bestScore=sc}
  g.move(playedMove);
  const after=evaluate(g);
  const bestDelta=isWhite?(bestScore-before):(before-bestScore);
  const playDelta=isWhite?(after-before):(before-after);
  const loss=bestDelta-playDelta;
  if(loss<=10 && playDelta>150) return 'brilliant';
  if(loss<=20) return 'great';
  if(loss<=50) return 'good';
  if(loss<=120) return 'inaccuracy';
  if(loss<=250) return 'mistake';
  return 'blunder';
}
function showQuality(label){
  qualityEl.className='move-quality show '+label;
  const names={brilliant:'!! Brilliant',great:'! Great',good:'Good',inaccuracy:'?! Inaccuracy',mistake:'? Mistake',blunder:'?? Blunder'};
  qualityEl.textContent=names[label]||label;
  if(label==='brilliant')sndBrilliant();
  setTimeout(()=>qualityEl.classList.remove('show'),2200);
}
function updateEvalBar(){
  if(puzzleMode){document.getElementById('evalFill').style.height='50%';return}
  const score=evaluate(game);
  let pct=50+Math.max(-48,Math.min(48,score/20));
  document.getElementById('evalFill').style.height=pct+'%';
  const label=Math.abs(score)>9000?'M':(Math.abs(score)/100).toFixed(1);
  const sign=score>50?'+':score<-50?'-':'';
  if(score>=0){document.getElementById('evalBot').textContent=sign+label;document.getElementById('evalTop').textContent=''}
  else{document.getElementById('evalTop').textContent='-'+label;document.getElementById('evalBot').textContent=''}
}
function updateOpening(){
  if(puzzleMode){openingEl.textContent='';return}
  const hist=game.history(); let name='';
  for(let len=Math.min(hist.length,12);len>=1;len--){
    const key=hist.slice(0,len).join(' ');
    if(OPENINGS[key]){name=OPENINGS[key];break}
  }
  openingEl.textContent=name||'';
}
function sqName(r,c){const file=flipped?7-c:c,rank=flipped?r:7-r;return String.fromCharCode(97+file)+(rank+1)}
function sqToGrid(sq){const file=sq.charCodeAt(0)-97,rank=parseInt(sq[1],10)-1;return{c:flipped?7-file:file,r:flipped?rank:7-rank}}
function sqCenter(sq){const g=sqToGrid(sq);return {x:g.c*12.5+6.25, y:g.r*12.5+6.25}}
function drawArrow(from,to){
  arrowLayer.innerHTML='';
  if(!from||!to)return;
  const a=sqCenter(from), b=sqCenter(to);
  const dx=b.x-a.x, dy=b.y-a.y;
  const len=Math.sqrt(dx*dx+dy*dy)||1;
  const ux=dx/len, uy=dy/len;
  const start={x:a.x+ux*3,y:a.y+uy*3};
  const end={x:b.x-ux*4,y:b.y-uy*4};
  const head=5, hw=2.8;
  const tip=end;
  const left={x:end.x-ux*head-uy*hw, y:end.y-uy*head+ux*hw};
  const right={x:end.x-ux*head+uy*hw, y:end.y-uy*head-ux*hw};
  const col='rgba(255,170,0,0.85)';
  arrowLayer.innerHTML='<line x1="'+start.x+'" y1="'+start.y+'" x2="'+end.x+'" y2="'+end.y+'" stroke="'+col+'" stroke-width="2.2" stroke-linecap="round"/><polygon points="'+tip.x+','+tip.y+' '+left.x+','+left.y+' '+right.x+','+right.y+'" fill="'+col+'"/>';
}
function renderBoard(){
  boardEl.innerHTML='';
  const isCheck=game.in_check(),turn=game.turn();
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const name=sqName(r,c),piece=game.get(name);
    const sq=document.createElement('div');
    sq.className='sq '+((r+c)%2===0?'light':'dark'); sq.dataset.sq=name;
    if(selected===name)sq.classList.add('selected');
    if(lastMove&&(lastMove.from===name||lastMove.to===name))sq.classList.add('last');
    if(isCheck&&piece&&piece.type==='k'&&piece.color===turn)sq.classList.add('check');
    const isPossible=possibleMoves.some(m=>m.to===name);
    if(isPossible){sq.classList.add('possible');if(piece)sq.classList.add('capture')}
    if(piece){const img=document.createElement('img');img.className='piece';img.src=pieceSrc(piece.color,piece.type);img.draggable=false;sq.appendChild(img)}
    if(c===0){const rank=document.createElement('span');rank.className='coord rank';rank.textContent=flipped?(r+1):(8-r);sq.appendChild(rank)}
    if(r===7){const file=document.createElement('span');file.className='coord file';file.textContent=String.fromCharCode(97+(flipped?7-c:c));sq.appendChild(file)}
    sq.addEventListener('click',()=>onSquareClick(name));
    boardEl.appendChild(sq);
  }
  if(lastMove) drawArrow(lastMove.from,lastMove.to); else arrowLayer.innerHTML='';
  updateCaptured();updateStatus();updateClocksUI();updateProfiles();updateEvalBar();updateOpening();
}
function animateMove(from,to,pieceColor,pieceType,callback){
  animating=true;
  const fromGrid=sqToGrid(from),toGrid=sqToGrid(to);
  renderBoard();
  const toSq=boardEl.querySelector('[data-sq="'+to+'"] img.piece');
  if(toSq)toSq.classList.add('hidden');
  const slider=document.createElement('div');slider.className='sliding-piece';
  const img=document.createElement('img');img.src=pieceSrc(pieceColor,pieceType);slider.appendChild(img);
  slider.style.left=(fromGrid.c*12.5)+'%';slider.style.top=(fromGrid.r*12.5)+'%';
  boardEl.appendChild(slider);slider.offsetHeight;
  requestAnimationFrame(()=>{slider.style.left=(toGrid.c*12.5)+'%';slider.style.top=(toGrid.r*12.5)+'%'});
  setTimeout(()=>{slider.remove();if(toSq)toSq.classList.remove('hidden');animating=false;if(callback)callback()},240);
}
function onSquareClick(sq){
  if(gameOver||thinking||animating)return;
  if(mode!=='local'&&mode!=='puzzle'&&game.turn()!==playerColor)return;
  if(puzzleMode&&game.turn()!==playerColor)return;
  if(selected){
    const move=possibleMoves.find(m=>m.to===sq);
    if(move){doMove(move);return}
    if(sq===selected){selected=null;possibleMoves=[];renderBoard();return}
  }
  const piece=game.get(sq);
  if(piece&&piece.color===game.turn()){selected=sq;possibleMoves=game.moves({square:sq,verbose:true});renderBoard()}
  else{selected=null;possibleMoves=[];renderBoard()}
}
function playMoveSounds(move){
  if(move.captured)sndCapture(); else sndMove();
  if(game.in_check())setTimeout(sndCheck,120);
}
function doMove(moveObj){
  if(moveObj.flags&&moveObj.flags.includes('p')&&!moveObj.promotion){showPromotion(moveObj);return}
  const from=moveObj.from,to=moveObj.to,piece=game.get(from);if(!piece)return;
  const beforeFen=game.fen();
  const mover=game.turn();
  const move=game.move(moveObj);if(!move)return;
  if(puzzleMode){
    const expected=puzzleSol[puzzleStep];
    if(move.san!==expected && move.lan!==expected){
      game.undo();statusEl.textContent='Not the best — try again';statusEl.classList.remove('gameover');
      selected=null;possibleMoves=[];renderBoard();return;
    }
    puzzleStep++;
    lastMove=move;selected=null;possibleMoves=[];
    playMoveSounds(move);
    animateMove(from,to,piece.color,piece.type,()=>{
      renderBoard();updateMovesList();
      if(puzzleStep>=puzzleSol.length || game.in_checkmate()){
        gameOver=true;statusEl.textContent='Puzzle solved!';statusEl.classList.add('gameover');recordResult('p');sndWin();return;
      }
      if(puzzleStep<puzzleSol.length){
        setTimeout(()=>{
          const reply=puzzleSol[puzzleStep];
          const m=game.move(reply);
          if(m){puzzleStep++;lastMove=m;playMoveSounds(m);animateMove(m.from,m.to,m.color,m.piece,()=>{renderBoard();updateMovesList()})}
        },300);
      }
    });
    return;
  }
  if(mover==='w')timeWhite+=increment; else timeBlack+=increment;
  lastMove=move;selected=null;possibleMoves=[];
  if(mode!=='local'&&mover===playerColor){try{showQuality(rateMove(move,beforeFen))}catch(e){}}
  playMoveSounds(move);
  animateMove(from,to,piece.color,piece.type,()=>{
    renderBoard();updateMovesList();
    if(game.game_over()){endGame();return}
    lastTick=Date.now();
    if(mode!=='local'&&mode!=='puzzle')setTimeout(aiMove,120);
  });
}
function showPromotion(moveObj){
  const color=game.turn(),choices=['q','r','b','n'];
  promoChoices.innerHTML='';
  choices.forEach(p=>{
    const btn=document.createElement('button'),img=document.createElement('img');
    img.src=pieceSrc(color,p);btn.appendChild(img);
    btn.onclick=()=>{promoOverlay.classList.remove('show');doMove({...moveObj,promotion:p})};
    promoChoices.appendChild(btn);
  });
  promoOverlay.classList.add('show');
}
function setThinking(on){thinking=on;updateProfiles()}
function aiMove(){
  if(game.game_over()||mode==='local'||mode==='puzzle')return;
  setThinking(true);statusEl.textContent='Stockfish is thinking…';
  setTimeout(()=>{
    const best=getBestMove(aiDepth);setThinking(false);
    if(best){
      const piece=game.get(best.from);const mover=game.turn();
      const move=game.move(best);lastMove=move;
      if(mover==='w')timeWhite+=increment;else timeBlack+=increment;
      playMoveSounds(move);
      animateMove(best.from,best.to,piece.color,piece.type,()=>{
        renderBoard();updateMovesList();lastTick=Date.now();
        if(game.game_over())endGame();
      });
    }
  },80);
}
function updateProfiles(){
  if(puzzleMode){
    document.getElementById('nameTop').textContent='Puzzle';
    document.getElementById('subTop').textContent='Tactics';
    document.getElementById('nameBottom').textContent='You';
    document.getElementById('subBottom').textContent='Solver';
    document.getElementById('avatarTop').innerHTML='<div class="think-ring"></div><span class="sf-icon">🧩</span>';
    document.getElementById('avatarBottom').innerHTML='<div class="think-ring"></div><img src="'+pieceSrc(playerColor,'k')+'" alt="">';
    document.getElementById('profileTop').classList.remove('active','thinking-active');
    document.getElementById('profileBottom').classList.toggle('active',!gameOver);
    return;
  }
  const isLocal=mode==='local',topIsWhite=flipped;
  let topName,topSub,bottomName,bottomSub,topIsAI,bottomIsAI;
  if(isLocal){
    topName=topIsWhite?'White':'Black';bottomName=topIsWhite?'Black':'White';
    topSub=bottomSub='Player';topIsAI=bottomIsAI=false;
  }else{
    const playerOnBottom=(playerColor==='w'&&!flipped)||(playerColor==='b'&&flipped);
    if(playerOnBottom){bottomName='You';bottomSub='Player';topName='Stockfish';topSub='AI · '+(DIFF_LABELS[aiDepth]||'Medium');topIsAI=true;bottomIsAI=false}
    else{topName='You';topSub='Player';bottomName='Stockfish';bottomSub='AI · '+(DIFF_LABELS[aiDepth]||'Medium');topIsAI=false;bottomIsAI=true}
  }
  document.getElementById('nameTop').textContent=topName;
  document.getElementById('subTop').textContent=topSub;
  document.getElementById('nameBottom').textContent=bottomName;
  document.getElementById('subBottom').textContent=bottomSub;
  const topColor=topIsWhite?'w':'b',bottomColor=topIsWhite?'b':'w';
  document.getElementById('avatarTop').innerHTML=topIsAI?'<div class="think-ring"></div><span class="sf-icon">🐟</span>':'<div class="think-ring"></div><img src="'+pieceSrc(topColor,'k')+'" alt="">';
  document.getElementById('avatarBottom').innerHTML=bottomIsAI?'<div class="think-ring"></div><span class="sf-icon">🐟</span>':'<div class="think-ring"></div><img src="'+pieceSrc(bottomColor,'k')+'" alt="">';
  const turn=game.turn();
  const topTurn=(topIsWhite&&turn==='w')||(!topIsWhite&&turn==='b');
  document.getElementById('profileTop').classList.toggle('active',!gameOver&&topTurn&&!thinking);
  document.getElementById('profileBottom').classList.toggle('active',!gameOver&&!topTurn&&!thinking);
  document.getElementById('profileTop').classList.toggle('thinking-active',thinking&&topIsAI);
  document.getElementById('profileBottom').classList.toggle('thinking-active',thinking&&bottomIsAI);
}
function updateCaptured(){
  if(puzzleMode){document.getElementById('capturedTop').innerHTML='';document.getElementById('capturedBottom').innerHTML='';return}
  const history=game.history({verbose:true});
  const whiteCap=[],blackCap=[];let material=0;
  history.forEach(m=>{
    if(m.captured){const val=VALUES[m.captured]||0;
      if(m.color==='w'){blackCap.push(pieceSrc('b',m.captured));material+=val}
      else{whiteCap.push(pieceSrc('w',m.captured));material-=val}}
  });
  const topIsWhite=flipped;
  const topCaps=topIsWhite?whiteCap:blackCap,bottomCaps=topIsWhite?blackCap:whiteCap;
  const topAdv=topIsWhite?(material<0?Math.abs(material)/100:0):(material>0?material/100:0);
  const bottomAdv=topIsWhite?(material>0?material/100:0):(material<0?Math.abs(material)/100:0);
  document.getElementById('capturedTop').innerHTML=topCaps.map(s=>'<img src="'+s+'" alt="">').join('')+(topAdv?'<span class="adv">+'+topAdv+'</span>':'');
  document.getElementById('capturedBottom').innerHTML=bottomCaps.map(s=>'<img src="'+s+'" alt="">').join('')+(bottomAdv?'<span class="adv">+'+bottomAdv+'</span>':'');
}
function updateStatus(){
  if(gameOver)return;
  if(game.in_checkmate()){statusEl.textContent=(game.turn()==='w'?'Black':'White')+' wins by checkmate!';statusEl.classList.add('gameover')}
  else if(game.in_draw()){statusEl.textContent='Draw';statusEl.classList.add('gameover')}
  else if(game.in_check()){statusEl.textContent=(game.turn()==='w'?'White':'Black')+' is in check';statusEl.classList.remove('gameover')}
  else if(puzzleMode){statusEl.textContent='Your move';statusEl.classList.remove('gameover')}
  else{statusEl.textContent=mode==='local'?((game.turn()==='w'?'White':'Black')+' to move'):(game.turn()===playerColor?'Your turn':'Stockfish turn');statusEl.classList.remove('gameover')}
}
function updateMovesList(){
  const history=game.history();let html='';
  for(let i=0;i<history.length;i+=2){
    html+='<span class="num">'+(Math.floor(i/2)+1)+'.</span> <span>'+history[i]+'</span>';
    if(history[i+1])html+=' <span>'+history[i+1]+'</span>';
    html+=' ';
  }
  movesEl.innerHTML=html;movesEl.scrollTop=movesEl.scrollHeight;
}
function endGame(){
  gameOver=true;stopClock();setThinking(false);updateStatus();updateProfiles();
  if(puzzleMode)return;
  if(game.in_checkmate()){
    const winner=game.turn()==='w'?'b':'w';
    if(mode==='local')sndWin();
    else if(winner===playerColor){sndWin();recordResult('w')}
    else{sndLose();recordResult('l')}
  }else if(game.in_draw()){recordResult('d')}
}
function formatTime(ms){if(ms<0)ms=0;const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function updateClocksUI(){
  if(puzzleMode){document.getElementById('timeTop').textContent='—';document.getElementById('timeBottom').textContent='—';return}
  const topIsWhite=flipped;
  const topTimeTime=topIsWhite?timeWhite:timeBlack,bottomTime=topIsWhite?timeBlack:timeWhite;
  document.getElementById('timeTop').textContent=formatTime(topTime);
  document.getElementById('timeBottom').textContent=formatTime(bottomTime);
  document.getElementById('profileTop').classList.toggle('low',topTime<30000);
  document.getElementById('profileBottom').classList.toggle('low',bottomTime<30000);
}
function startClock(){
  stopClock();
  if(puzzleMode)return;
  lastTick=Date.now();
  clockInterval=setInterval(()=>{
    if(gameOver)return;
    const now=Date.now(),delta=now-lastTick;lastTick=now;
    if(game.turn()==='w'){
      timeWhite-=delta;
      if(timeWhite<=0){timeWhite=0;gameOver=true;stopClock();statusEl.textContent='Black wins on time!';statusEl.classList.add('gameover');updateProfiles();if(mode!=='local'&&playerColor==='b'){sndWin();recordResult('w')}else if(mode!=='local'){sndLose();recordResult('l')}}
    }else{
      timeBlack-=delta;
      if(timeBlack<=0){timeBlack=0;gameOver=true;stopClock();statusEl.textContent='White wins on time!';statusEl.classList.add('gameover');updateProfiles();if(mode!=='local'&&playerColor==='w'){sndWin();recordResult('w')}else if(mode!=='local'){sndLose();recordResult('l')}}
    }
    updateClocksUI();
  },100);
}
function stopClock(){if(clockInterval)clearInterval(clockInterval);clockInterval=null}
function openModal(){document.getElementById('modal').classList.add('show')}
function closeModal(){document.getElementById('modal').classList.remove('show')}
function startPuzzle(){
  puzzleMode=true;
  puzzleIndex=Math.floor(Math.random()*PUZZLES.length);
  const p=PUZZLES[puzzleIndex];
  puzzleSol=p.sol.slice(); puzzleStep=0;
  game=new Chess(p.fen);
  playerColor=game.turn();
  flipped=playerColor==='b';
  selected=null;possibleMoves=[];lastMove=null;
  gameOver=false;thinking=false;animating=false;mode='puzzle';
  modeBadge.textContent='Puzzle'; stopClock();
  document.getElementById('puzzleBanner').style.display='block';
  document.getElementById('puzzleTitle').textContent=p.title;
  document.getElementById('puzzleHint').textContent=p.hint;
  document.getElementById('evalBar').style.opacity='0.3';
  statusEl.classList.remove('gameover'); qualityEl.classList.remove('show');
  closeModal();renderBoard();updateMovesList();updateStatsUI();
}
function startNewGame(){
  ensureAudio();
  const modeBtn=document.querySelector('.mode-btn[data-mode].selected');
  mode=modeBtn?modeBtn.dataset.mode:'normal';
  if(mode==='puzzle'){startPuzzle();return}
  puzzleMode=false;
  document.getElementById('puzzleBanner').style.display='none';
  document.getElementById('evalBar').style.opacity='1';
  const colorBtn=document.querySelector('.color-btn.selected');
  let col=colorBtn?colorBtn.dataset.color:'w';
  if(col==='random')col=Math.random()<.5?'w':'b';
  playerColor=col;
  const diffBtn=document.querySelector('.mode-btn[data-diff].selected');
  aiDepth=diffBtn?parseInt(diffBtn.dataset.diff):2;
  if(mode==='blitz'){timeWhite=timeBlack=3*60*1000;increment=2000;modeBadge.textContent='Blitz 3+2'}
  else if(mode==='bullet'){timeWhite=timeBlack=60*1000;increment=1000;modeBadge.textContent='Bullet 1+1'}
  else if(mode==='local'){timeWhite=timeBlack=10*60*1000;increment=5000;modeBadge.textContent='Local 10+5'}
  else{timeWhite=timeBlack=10*60*1000;increment=5000;modeBadge.textContent='Normal 10+5'}
  game=new Chess();selected=null;possibleMoves=[];lastMove=null;
  gameOver=false;thinking=false;animating=false;flipped=playerColor==='b';
  statusEl.classList.remove('gameover');openingEl.textContent='';qualityEl.classList.remove('show');
  closeModal();renderBoard();updateMovesList();startClock();updateStatsUI();
  if(mode!=='local'&&playerColor==='b')setTimeout(aiMove,350);
}
document.getElementById('btnNew').addEventListener('click',openModal);
document.getElementById('btnCancel').addEventListener('click',closeModal);
document.getElementById('btnStart').addEventListener('click',startNewGame);
document.getElementById('btnUndo').addEventListener('click',()=>{
  if(thinking||animating||game.history().length===0||puzzleMode)return;
  game.undo();if(mode!=='local'&&game.history().length>0)game.undo();
  lastMove=game.history({verbose:true}).slice(-1)[0]||null;
  selected=null;possibleMoves=[];gameOver=false;statusEl.classList.remove('gameover');
  renderBoard();updateMovesList();lastTick=Date.now();
});
document.getElementById('btnFlip').addEventListener('click',()=>{if(animating)return;flipped=!flipped;renderBoard()});
document.getElementById('btnHint').addEventListener('click',()=>{
  if(thinking||animating||gameOver)return;
  if(puzzleMode){if(puzzleStep<puzzleSol.length)statusEl.textContent='Hint: '+puzzleSol[puzzleStep];return}
  if(mode!=='local'&&game.turn()!==playerColor)return;
  setThinking(true);
  setTimeout(()=>{const best=getBestMove(Math.max(2,aiDepth));setThinking(false);if(best){selected=best.from;possibleMoves=[best];renderBoard();statusEl.textContent='Hint: '+best.san}},50);
});
document.getElementById('btnMute').addEventListener('click',()=>{muted=!muted;document.getElementById('btnMute').textContent=muted?'🔇':'🔊'});
document.querySelectorAll('.mode-btn[data-mode]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    const isLocal=btn.dataset.mode==='local', isPuzzle=btn.dataset.mode==='puzzle';
    document.getElementById('colorSection').style.display=(isLocal||isPuzzle)?'none':'';
    document.getElementById('diffSection').style.display=(isLocal||isPuzzle)?'none':'';
  });
});
document.querySelectorAll('.color-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.color-btn').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected')})});
document.querySelectorAll('.mode-btn[data-diff]').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.mode-btn[data-diff]').forEach(b=>b.classList.remove('selected'));btn.classList.add('selected')})});
updateStatsUI();
openModal();
