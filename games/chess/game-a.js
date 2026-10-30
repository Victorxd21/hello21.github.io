const PIECE_BASE='https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/';
function pieceSrc(c,t){return PIECE_BASE+c+t.toUpperCase()+'.svg'}
const DIFF_LABELS={1:'Easy',2:'Medium',3:'Hard',4:'Master'};
const DIFF_SKILL={1:0,2:7,3:14,4:20};
const DIFF_ELO={1:800,2:1400,3:2000,4:2800};
const DIFF_DEPTH={1:4,2:8,3:12,4:16};
const DIFF_MOVETIME={1:200,2:500,3:1000,4:2000};
const DIFF_RANDOM={1:0.45,2:0.2,3:0.05,4:0};
const SB_URL='https://wsoacldmclewhbdrvcya.supabase.co';
const SB_KEY='sb_publishable_TdYjM70nCOLk95u7YSs3tg_6U50xBMN';
const COSMETICS=[{id:'default',name:'Classic',cls:''},{id:'gold',name:'Gold',cls:'cos-gold'},{id:'ice',name:'Ice',cls:'cos-ice'},{id:'fire',name:'Fire',cls:'cos-fire'},{id:'royal',name:'Royal',cls:'cos-royal'},{id:'neon',name:'Neon',cls:'cos-neon'}];
const COS_KEY='chess_hello21_cosmetic';
function loadCosmetic(){try{const id=localStorage.getItem(COS_KEY)||'default';return COSMETICS.find(c=>c.id===id)||COSMETICS[0]}catch(e){return COSMETICS[0]}}
function saveCosmetic(id){localStorage.setItem(COS_KEY,id)}
let myCosmetic=loadCosmetic();
let oppCosmetic=COSMETICS[0];
let sbClient=null,channel=null,roomCode=null,isHost=false,onlineMode=false,oppConnected=false,myColorOnline='w';
function initSupabase(){try{if(window.supabase&&window.supabase.createClient){sbClient=window.supabase.createClient(SB_URL,SB_KEY)}}catch(e){console.warn('sbClient init',e)}}
function genCode(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s}
