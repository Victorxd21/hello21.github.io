'use strict';
const $=i=>document.getElementById(i),T=THREE,rnd=Math.random,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const TD='ontouchstart'in window||navigator.maxTouchPoints>0;if(TD)document.body.classList.add('t');
/* ---------- renderer ---------- */
const ren=new T.WebGLRenderer({canvas:$('c')});ren.setPixelRatio(Math.min(devicePixelRatio,1.5));
const sc=new T.Scene(),cam=new T.PerspectiveCamera(72,1,.1,260);sc.add(cam);cam.rotation.order='YXZ';
sc.background=new T.Color(0x04060a);sc.fog=new T.FogExp2(0x080b10,.05);
const amb=new T.AmbientLight(0x2a3650,.5);sc.add(amb);
const fl=new T.SpotLight(0xffe6a0,2.6,55,.5,.55,1.4);fl.target.position.set(0,0,-1);fl.userData.on=true;cam.add(fl,fl.target);
const rs=()=>{ren.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()};addEventListener('resize',rs);rs();
/* ---------- level ---------- */
const MC={},mat=c=>MC[c]||(MC[c]=new T.MeshLambertMaterial({color:c})),W=[];
function box(x,z,w,d,h,c,o={}){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));m.position.set(x,(o.y||0)+h/2,z);sc.add(m);if(!o.ns)W.push(m.c={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2});return m}
const wl=(a,b,c,d,col=0x3b3e3c,h=5)=>box((a+c)/2,(b+d)/2,Math.max(Math.abs(c-a),1.2),Math.max(Math.abs(d-b),1.2),h,col);
const gr=new T.Mesh(new T.PlaneGeometry(240,240),mat(0x1d211c));gr.rotation.x=-Math.PI/2;sc.add(gr);
wl(-100,-100,100,-100);wl(-100,100,100,100);wl(-100,-100,-100,100);wl(100,-100,100,100);
const FC=0x4a4640;// factory shell (door gaps: south x-15..-5 = keycard door, east z-25..-15 = side exit)
wl(-50,-60,30,-60,FC,8);wl(-50,-60,-50,20,FC,8);wl(30,-60,30,-25,FC,8);wl(30,-15,30,20,FC,8);wl(-50,20,-15,20,FC,8);wl(-5,20,30,20,FC,8);
const door1=box(-10,20,10,1.2,5,0x6b5b2a),door2=box(30,-20,1.2,10,5,0x6b5b2a),door3=box(-52,40,1.2,4,5,0x2a4a6b);
box(-10,-20,80,80,.5,0x151515,{y:8,ns:1});
[[-30,-10,6,6],[-15,-32,10,4],[5,-22,4,14],[12,-42,8,6],[-35,-30,4,10],[-5,0,8,3],[20,-57,6,2]].forEach(([x,z,w,d])=>box(x,z,w,d,3,0x5a4a2a));
wl(-50,-46,-40,-46,FC,8);wl(-36,-60,-36,-54,FC,8);// maintenance room
wl(-86,-86,-74,-86);wl(-86,-86,-86,-74);wl(-74,-86,-74,-74);wl(-86,-74,-80,-74);wl(-76,-74,-74,-74);// generator shack
wl(-68,32,-52,32);wl(-68,48,-52,48);wl(-68,32,-68,48);wl(-52,32,-52,38);wl(-52,42,-52,48);// dispatch
wl(-27,66,-13,66);wl(-27,54,-27,66);wl(-13,54,-13,66);wl(-27,54,-22,54);wl(-18,54,-13,54);// guard station
box(65,-25,14,14,4,0x6b4a22);box(88,-10,3,25,1,0x333);box(6,72,4,2,1.5,0x2a3548);box(30,97,10,1,5,0x7a2020,{ns:1});
[[-12,-84,4,4],[12,-86,5,4],[0,-97,6,3],[35,-35,5,3],[85,-25,5,3],[50,30,5,3],[0,35,5,3],[-70,-30,5,3],[-30,-70,5,3],[80,40,5,3],[20,50,5,3]].forEach(([x,z,w,d])=>box(x,z,w,d,3,0x4a3a28));
const endo=box(50,-8,2,.7,.4,0x888888,{ns:1});[[45,-38],[85,-5],[-5,-90],[10,30]].forEach(([x,z])=>box(x,z,2,.7,.4,0x555555,{ns:1}));
const mq=[[-24,58],[-16,58],[-24,64],[-16,64],[-20,61]].map(([x,z])=>{const g=new T.Group();g.hx=x;g.position.set(x,0,z);const b=new T.Mesh(new T.BoxGeometry(.6,1.5,.4),mat(0x999590)),h=new T.Mesh(new T.SphereGeometry(.25,8,6),mat(0xbbb7b0));b.position.y=.9;h.position.y=1.9;g.add(b,h);sc.add(g);return g});
const PL=(c,i,d,x,y,z)=>{const l=new T.PointLight(c,i,d);l.position.set(x,y,z);sc.add(l);return l};
const flood=[[65,6,-10],[0,6,-80],[-30,6,50],[0,6,62],[50,6,-45],[-62,6,10]].map(p=>PL(0xffe0a0,0,45,...p));
const red=[[30,5,88],[-10,5,16],[20,5,-30]].map(p=>PL(0xff2010,0,30,...p));
const fac=[[-30,6,-10],[0,6,-30],[20,6,-45],[-35,6,-40]].map(p=>PL(0xcfe8ff,0,32,...p));
/* rain */
const N=1500,rp=new Float32Array(N*3);for(let i=0;i<N;i++){rp[i*3]=(rnd()-.5)*50;rp[i*3+1]=rnd()*20;rp[i*3+2]=(rnd()-.5)*50}
const rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(rp,3));
const rain=new T.Points(rg,new T.PointsMaterial({color:0x8899aa,size:.12,transparent:true,opacity:.6}));rain.frustumCulled=false;sc.add(rain);
/* hands */
const hands=[-1,1].map(s=>{const h=new T.Mesh(new T.BoxGeometry(.12,.1,.3),new T.MeshBasicMaterial({color:0x2a2418}));h.position.set(.25*s,-.32,-.55);cam.add(h);return h});
/* PROTO-01 model */
const E=new T.Group(),mm=mat(0x8d9094),dk=mat(0x2b2d30),HD=new T.Group(),ARM=new T.Group();
const part=(g,w,h,d,x,y,z,m=mm)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o)};
part(E,.9,1.2,.5,0,1.8,0);part(E,.25,1.2,.25,-.25,.6,0,dk);part(E,.25,1.2,.25,.25,.6,0,dk);part(E,.15,1.1,.15,-.65,1.9,0);part(E,.5,.3,.4,0,2.5,0,dk);
HD.position.set(0,2.85,0);part(HD,.5,.55,.45,0,0,0);E.add(HD);
const em=new T.MeshBasicMaterial({color:0xffffff,fog:false});[-.12,.12].forEach(x=>{const s=new T.Mesh(new T.SphereGeometry(.055,8,6),em);s.position.set(x,.05,.24);HD.add(s)});
const EL=new T.PointLight(0xffffff,.9,12);EL.position.set(0,.05,.4);HD.add(EL);
ARM.position.set(.65,2.35,0);part(ARM,.15,1.2,.15,0,-.6,0);const disc=new T.Mesh(new T.CylinderGeometry(.32,.32,.05,16),mat(0xb0b0b0));disc.position.set(0,-1.25,0);disc.rotation.z=Math.PI/2;ARM.add(disc);E.add(ARM);E.visible=false;sc.add(E);
/* ---------- state ---------- */
const S0=()=>({st:0,cord:0,vl:[0,0,0],il:[0,0,0],tl:[0,0,0],pl:[0,0,0],fb:[0,0,0],dOpen:0,sp:0,card:0,cog:0,inst:0,tab:0});
let S=S0(),cp=null,mode='menu',clk=0,shake=0,hk=0,hd=.45,pc=0,pl=0,lit=0,tt=20,pt=0,mqT=0,sT=0,tabOpen=false,tobj=0;
const P={x:0,z:66,yaw:0,pitch:0,vx:0,vz:0,stam:100,cr:0,h:1.7,ph:0,bob:0,nz:0};
const e={x:0,z:0,st:'dormant',t:0,wi:0,last:[0,0],fl:0,after:0,stk:0,lost:0,det:0,dp:[0,0],ang:0,sc:0,first:0};
const WO=[[45,-32],[40,25],[10,50],[-30,42],[-62,-5],[-40,-75],[16,-78],[75,45]],WI=[[-35,-5],[0,-12],[20,-35],[-28,-38],[8,10],[-12,-25]];
const WP=()=>S.st>=11&&S.st<14?WI:WO,dist=(x,z)=>Math.hypot(P.x-x,P.z-z);
const OB=['','Restore power — generator shack','Find the grinder control panel','Recover the missing tools — storage yard','Hang the tools on the shadow board','Investigate the crash — storage yard','RUN — reach the main gate!','Collect 3 security fobs — scrap yard','Unlock the dispatch office & fix the circuit','Retrieve the keycard — security station','Swipe the keycard at the factory door','Find the control cog — maintenance room','Install the cog at the control console','ESCAPE — side exit!'];
const TG=[0,[-80,-80],[65,-14],[0,-88],[65,-3],[0,-80],[30,90],[65,-30],[-58,40],[-20,60],[-10,20],[-44,-54],[20,-54],[34,-20]];
/* ---------- dialogue (data driven) ---------- */
const X='ETHAN',D={
intro:[['','[Rain against a window. A refrigerator hums. A phone vibrates.]'],[X,'I used to think working hard meant something.'],[X,'I spent years fixing machines that weren’t safe to operate. Management knew it. We all knew it.'],[X,'Then the factory closed, and suddenly none of that mattered.'],[X,'I’ve been taking whatever work I can find ever since.'],[X,'The rent doesn’t care if you’ve had a bad month.'],['','[Message: overnight shift confirmed — Fazbear Entertainment decommissioning facility.]'],[X,'One shift. That’s all this is supposed to be.'],[X,'Get paid. Go home. Start over.'],['','[The drive. Rain on the windshield. Static on the radio.]'],[X,'Fazbear Entertainment. Never thought I’d end up working for them.'],[X,'I heard they shut down half their old facilities years ago. Guess somebody still has to clean up the mess.'],[X,'Of course. No signal.'],[X,'Well, Ethan… one shift.'],['','[A distant metallic impact echoes from inside the facility.]']],
start:[[X,'Nobody at the entrance?'],[X,'That gate’s ajar. Not exactly reassuring. Find the generator shack, back of the lot.']],
chart:[['SIGN','FUEL PRESSURE — VALVE A: 2 · VALVE B: 0 · VALVE C: 3']],
power:[[X,'All right. That’s something.'],[X,'Found a rugged tablet on the shelf. Tab opens the blueprint map. Now let’s get this shift over with.']],
tools:[[X,'Seriously? Who takes the tools and doesn’t put them back?'],['SYSTEM','Interlocks armed. Missing: spanner, wrench, mallet. Last seen: storage yard.']],
report:[['REPORT','…prototype PROTO-01 never listed as destroyed. Transfer cancelled. Do not log.'],[X,'A defective prototype that’s on no list. Great.']],
gone:[[X,'…No.'],[X,'I know that thing was here. The belt’s out of line.'],['','[Metal creaks behind the machinery.]'],[X,'Okay. Finish the job. Get out.'],['','[A massive crash echoes from the storage yard.]']],
dark:[['','[All power dies. Two white lights in the dark.]'],[X,'Who’s there?'],[X,'No. No, no, no… What the hell is that thing?']],
lock:[['SECURITY','Unauthorized movement detected. Facility lockdown initiated.'],[X,'You have got to be kidding me! Fobs, office, keycard. Move.']],
note:[['NOTE','BYPASS ORDER: BLUE, RED, GREEN.']],
memo:[['MEMO','DO NOT ENTER PROTOTYPE STORAGE. Incident 0-17 is sealed by order of management.']],
card:[[X,'Incident report… the decommission order came after a security incident.'],[X,'They knew. They knew something was wrong with this thing, and they left it here.'],[X,'Of course they did.']],
fact:[['SYSTEM','Keycard accepted.'],[X,'Control room. Find the cog it needs.']],
rec:[['ENGINEER','If anyone finds this, the decommissioning report is wrong. PROTO-01 was never supposed to be on the central network.'],['ENGINEER','It started treating anything that interfered with its task as defective. If you’re hearing this… don’t try to reason with it.']],
final:[['SECURITY','Emergency bypass accepted. Exterior access restored.'],[X,'Come on… come on!']]};
const dq=[];let dc=null;const say=a=>{if(a)dq.push(...a)},clrSay=()=>{dq.length=0;dc=null};
function dlg(dt){if(!dc&&dq.length){const l=dq.shift();dc={t:l[1],i:0,h:1.3+l[1].length*.03};$('who').textContent=l[0]?l[0]+':':''}
if(dc){dc.i+=dt*45;$('txt').textContent=dc.t.slice(0,dc.i|0);if(dc.i>=dc.t.length){dc.h-=dt;if(dc.h<=0)dc=null}}
if(!dc&&!dq.length){$('who').textContent='';$('txt').textContent=''}}
const toast=t=>{const o=$('toast');o.textContent=t;o.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>o.style.opacity=0,2200)};
/* ---------- audio (procedural) ---------- */
let AC,mg,NB,rgn,hg,sv,pn,svo;
function initA(){if(AC){AC.resume&&AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(_){return}
mg=AC.createGain();mg.gain.value=+$('vol').value;mg.connect(AC.destination);$('vol').oninput=()=>mg.gain.value=+$('vol').value;
NB=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=rnd()*2-1;
const ns=AC.createBufferSource();ns.buffer=NB;ns.loop=true;const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=2800;rgn=AC.createGain();ns.connect(bp);bp.connect(rgn);rgn.connect(mg);ns.start();
const h=AC.createOscillator();h.frequency.value=50;hg=AC.createGain();h.connect(hg);hg.connect(mg);h.start();
svo=AC.createOscillator();svo.type='sawtooth';sv=AC.createGain();sv.gain.value=0;pn=AC.createStereoPanner();svo.connect(sv);sv.connect(pn);pn.connect(mg);svo.start()}
function burst(f,d,g,ty){if(!AC)return;const s=AC.createBufferSource(),fi=AC.createBiquadFilter(),ga=AC.createGain(),n=AC.currentTime;s.buffer=NB;fi.type=ty;fi.frequency.value=f;ga.gain.setValueAtTime(g,n);ga.gain.exponentialRampToValueAtTime(.001,n+d);s.connect(fi);fi.connect(ga);ga.connect(mg);s.start();s.stop(n+d)}
function tone(f,d,ty,g){if(!AC)return;const o=AC.createOscillator(),ga=AC.createGain(),n=AC.currentTime;o.type=ty;o.frequency.value=f;ga.gain.setValueAtTime(g,n);ga.gain.exponentialRampToValueAtTime(.001,n+d);o.connect(ga);ga.connect(mg);o.start();o.stop(n+d)}
function snd(t,v=1){if(t=='step')burst(P.x>-50&&P.x<30&&P.z>-60&&P.z<20?700:300,.07,.25*v,'lowpass');else if(t=='click')tone(900,.04,'square',.12);
else if(t=='metal'){tone(150,.5,'sawtooth',.2);burst(1200,.3,.15,'bandpass')}else if(t=='buzz')tone(110,.4,'sawtooth',.25);else if(t=='beep')tone(v,.15,'sine',.2);
else if(t=='thunder')burst(120,2.5,.7,'lowpass');else if(t=='scare'){burst(900,1.6,1,'bandpass');tone(70,1.6,'sawtooth',.6);tone(1700,1.2,'square',.3)}}
/* ---------- collision / LOS ---------- */
const hit=(x,z,r)=>{for(const w of W)if(!w.off&&x>w.x0-r&&x<w.x1+r&&z>w.z0-r&&z<w.z1+r)return 1;return 0};
function los(a,b,c,d){const n=Math.ceil(Math.hypot(c-a,d-b)/1.5);for(let i=1;i<n;i++){const x=a+(c-a)*i/n,z=b+(d-b)*i/n;for(const w of W)if(!w.off&&x>w.x0&&x<w.x1&&z>w.z0&&z<w.z1)return 0}return 1}
/* ---------- interactables / puzzles ---------- */
const I=[],hand=(d=.45)=>{hk=hd=d};
function it(x,z,lab,ok,act,col=0xffcc33,y=1.1,r=3.2){const m=new T.Mesh(new T.BoxGeometry(.4,.4,.4),new T.MeshBasicMaterial({color:col}));m.position.set(x,y,z);sc.add(m);I.push({x,z,lab,ok,act,m,r})}
const VT=[2,0,3],TN=['spanner','wrench','mallet'];
it(-82,-80,()=>`Pull starter cord (${S.cord}/3)`,()=>S.st==1&&S.cord<3,()=>{S.cord++;hand(.5+S.cord*.2);snd('metal');shake=.3+S.cord*.2;toast(S.cord<3?'The cord resists… pull again.':'The engine coughs. Set the fuel valves.')});
[-82,-80,-78].forEach((x,i)=>it(x,-83,()=>`Valve ${'ABC'[i]} — gauge ${S.vl[i]}/3`,()=>S.st==1&&S.cord>=3,()=>{S.vl[i]=(S.vl[i]+1)%4;snd('click');
if(S.vl.every((v,j)=>v==VT[j]))power();else{toast(S.vl[i]==VT[i]?`Valve ${'ABC'[i]}: steady`:`Valve ${'ABC'[i]}: pressure ${S.vl[i]>VT[i]?'high':'low'}`);if(S.vl[i]!=VT[i]){shake=.3;navigator.vibrate&&navigator.vibrate(40);snd('buzz')}}},0x44ccff));
it(-80,-77,'Read pressure chart',()=>S.st==1,()=>say(D.chart),0xffffff);
function power(){S.tab=1;go(2);snd('metal');say(D.power)}
[55,65,75].forEach((x,i)=>it(x,-14,`Turn safety key ${i+1}`,()=>S.st==2&&!S.il[i],()=>{S.il[i]=1;hand(.8);snd('click');if(S.il.every(v=>v)){say(D.tools);go(3)}else toast(`Interlock ${S.il.filter(v=>v).length}/3`)},0xff5533));
[[-12,-89],[0,-93],[12,-89]].forEach(([x,z],i)=>it(x,z,`Take ${TN[i]}`,()=>S.st==3&&!S.tl[i],()=>{S.tl[i]=1;snd('click');toast(`${TN[i]} recovered (${S.tl.filter(v=>v).length}/3)`);if(S.tl.every(v=>v))go(4)}));
it(0,-82,'Read maintenance report',()=>S.st>=3,()=>say(D.report),0xffffff);
[62,65,68].forEach((x,i)=>it(x,-3,`Hang ${TN[i]} on its silhouette`,()=>S.st==4&&!S.pl[i],()=>{S.pl[i]=1;snd('click');hand();if(S.pl.every(v=>v)){go(5);say(D.gone)}}));
[[48,-44],[82,-42],[80,14]].forEach(([x,z],i)=>it(x,z,'Take security fob',()=>S.st==7&&!S.fb[i],()=>{S.fb[i]=1;snd('beep',600+i*250);toast(`Fob ${S.fb.filter(v=>v).length}/3`);if(S.fb.every(v=>v))go(8)},0x66ff66));
it(-50,40,'Unlock dispatch office (3 fobs)',()=>S.st==8&&!S.dOpen,()=>{S.dOpen=1;sync();snd('metal')});
const CS=[2,0,1];['Red','Green','Blue'].forEach((n,i)=>it(-66,34+i*6,n+' contact',()=>S.st==8&&S.dOpen,()=>{if(i==CS[S.sp]){S.sp++;snd('beep',500+S.sp*200);if(S.sp==3){toast('Emergency bypass restored');go(9)}}else{S.sp=0;snd('buzz');toast('Short circuit — sequence reset')}},[0xff3030,0x30ff50,0x3080ff][i]));
it(-60,34,'Read bypass note',()=>S.st>=8,()=>say(D.note),0xffffff);it(-58,44,'Read employee memo',()=>S.st>=8,()=>say(D.memo),0xffffff);
it(-20,62,'Take factory keycard',()=>S.st==9&&!S.card,()=>{S.card=1;say(D.card);go(10)},0x33ccff);
it(-10,21,'Swipe keycard',()=>S.st==10,()=>{go(11);snd('beep',900);say(D.fact)},0x33ccff,1.1,4);
it(-44,-54,'Take control cog',()=>S.st==11&&!S.cog,()=>{S.cog=1;snd('metal');go(12)},0xffaa00);
it(-40,-50,'Play voice recording',()=>S.st>=11,()=>say(D.rec),0xffffff);
it(20,-54,()=>S.inst?'Activate gate override':'Install control cog',()=>S.st==12,()=>{if(!S.inst){S.inst=1;hand(.8);snd('metal');toast('Cog installed. Console online.')}else{go(13);say(D.final);snd('beep',1200);lit=1}},0xff4444);
/* ---------- progression / saves ---------- */
const CPS=[1,3,5,7,9,11,13];
function sync(){const s=S.st,fo=s>=2&&s<6;flood.forEach(l=>l.intensity=fo?1.3:0);red.forEach(l=>l.intensity=s>=7?1.2:0);sc.fog.density=fo?.03:.05;
const op=(d,v)=>{d.visible=!v;d.c.off=!!v};op(door1,s>=11);op(door2,s>=13);op(door3,S.dOpen);endo.visible=s<5}
function go(n){S.st=n;sync();if([6,7,11,13].includes(n))placeE();if(CPS.includes(n))mkSave();$('obj').textContent=OB[n]}
function mkSave(){cp={S:JSON.parse(JSON.stringify(S)),x:P.x,z:P.z,yaw:P.yaw};try{localStorage.setItem('fb_cp',JSON.stringify(cp))}catch(_){}toast('Checkpoint saved')}
const getSave=()=>{try{return JSON.parse(localStorage.getItem('fb_cp'))}catch(_){return null}};
function loadCP(c){S=JSON.parse(JSON.stringify(c.S));P.x=c.x;P.z=c.z;P.yaw=c.yaw;P.pitch=0;P.vx=P.vz=0;tabOpen=false;sync();placeE();clrSay();$('obj').textContent=OB[S.st]}
function placeE(){const s=S.st;e.fl=0;e.det=0;if(s<6){e.st='dormant';E.visible=false;return}E.visible=true;
if(s==6){e.x=10;e.z=-92;e.first=1;setSt('observe',3.5)}else if(s>=11&&s<13){e.x=-10;e.z=-30;setSt('patrol')}else if(s==13){e.x=-20;e.z=-28;setSt('hunt')}else{e.x=55;e.z=-60;setSt('patrol')}}
/* ---------- PROTO-01 AI ---------- */
function setSt(s,t=0){if(s=='hunt'&&e.st!='hunt')clrSay();if(s=='detect')tone(1200,.3,'sawtooth',.1);e.st=s;e.t=t}
function mv(o,tx,tz,sp,dt){const a0=Math.atan2(tz-o.z,tx-o.x);for(const da of[0,.7,-.7,1.4,-1.4]){const a=a0+da,nx=o.x+Math.cos(a)*sp*dt,nz=o.z+Math.sin(a)*sp*dt;if(!hit(nx,nz,.8)){o.x=nx;o.z=nz;o.ang=a;return da?.5:1}}return 0}
function go2(p,sp,dt){if(e.det>0){e.det-=dt;p=e.dp}if(Math.hypot(p[0]-e.x,p[1]-e.z)<1.6)return 1;const r=mv(e,p[0],p[1],sp,dt);e.stk=r<1?e.stk+dt:Math.max(0,e.stk-dt);
if(e.stk>2){e.stk=0;e.det=3;e.dp=WP()[rnd()*WP().length|0]}return 0}
function eAI(dt){if(e.st=='dormant')return;const F=S.st==6||S.st==13,dx=P.x-e.x,dz=P.z-e.z,d=Math.hypot(dx,dz)||1,ox=e.x,oz=e.z;
if(e.fl>0){e.fl-=dt;e.ang+=dt*8;if(e.fl<=0&&e.after){setSt('observe',2);e.after=0}return}
const rng=(P.cr?16:30)+(fl.userData.on&&!tabOpen?8:0),fd=Math.cos(e.ang)*dx+Math.sin(e.ang)*dz,see=d<rng&&fd/d>-.2&&los(e.x,e.z,P.x,P.z);
if(d<1.3)return caught();
if((e.st=='patrol'||e.st=='observe'||e.st=='return')&&P.nz*24>d&&!F){e.last=[P.x,P.z];setSt('investigate',8)}
switch(e.st){
case'patrol':{const w=WP();if(go2(w[e.wi%w.length],2.4,dt)){e.wi=(e.wi+1+(rnd()*3|0))%w.length;setSt('observe',2.5+rnd()*2)}if(see)setSt('detect',.7);break}
case'observe':e.t-=dt;if(see)setSt('detect',.6);else if(e.t<=0){if(e.first){e.first=0;setSt('hunt')}else setSt('patrol')}break;
case'detect':e.t-=dt;e.ang=Math.atan2(dz,dx);if(e.t<=0){if(see)setSt('hunt');else{e.last=[P.x,P.z];setSt('investigate',8)}}break;
case'hunt':{const sp=S.st==6?(d<9?4.6:3.6):S.st==13?4.4:5;if(see||F){e.lost=0;e.last=[P.x,P.z]}else e.lost+=dt;go2(F||see?[P.x,P.z]:e.last,sp,dt);if(!F&&e.lost>3)setSt('search',5);break}
case'investigate':if(see)setSt('detect',.5);else if(go2(e.last,3.4,dt)||(e.t-=dt)<=0)setSt('search',4);break;
case'search':e.t-=dt;if(see)setSt('detect',.5);else{const a=clk*.8;go2([e.last[0]+Math.cos(a)*4,e.last[1]+Math.sin(a)*4],2.2,dt);if(e.t<=0)setSt('return')}break;
case'return':{const w=WP();if(go2(w[e.wi%w.length],3,dt))setSt('patrol');if(see)setSt('detect',.6);break}}
e.sc+=Math.hypot(e.x-ox,e.z-oz);if(e.sc>2.2){e.sc=0;burst(110,.25,cl(1-d/40,0,1)*.9,'lowpass')}}
function pulse(){if(pc>0||tabOpen||!fl.userData.on)return;pc=4;pl=.7;snd('click');if(e.st=='dormant')return;
const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),dx=e.x-P.x,dz=e.z-P.z,d=Math.hypot(dx,dz);
if(d<30&&(dx*fx+dz*fz)/d>.7&&los(P.x,P.z,e.x,e.z)){e.fl=2.8;e.last=[P.x,P.z];if(e.st=='hunt'&&S.st!=6&&S.st!=13)e.after=1;snd('metal')}}
function caught(){if(mode!='play')return;setMode('dying');sT=0;clrSay();snd('scare');tabOpen=false}
function scare(dt){sT+=dt;const dx=e.x-P.x,dz=e.z-P.z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d,dd=Math.max(1.1,d-dt*3);
e.x=P.x+ux*dd;e.z=P.z+uz*dd;e.ang=Math.atan2(-uz,-ux);let da=Math.atan2(-ux,-uz)-P.yaw;da=Math.atan2(Math.sin(da),Math.cos(da));
P.yaw+=da*Math.min(1,dt*10);P.pitch+=(.65-P.pitch)*Math.min(1,dt*6);ARM.rotation.x=-Math.min(1,sT)*2.1;disc.rotation.x+=dt*40;shake=1;
cam.fov=Math.max(40,72-sT*22);cam.updateProjectionMatrix();
if(sT>1.5)$('fade').style.cssText='transition:none;opacity:1';
if(sT>2.1){setMode('dead');show('dead',1);document.exitPointerLock&&document.exitPointerLock()}}
/* ---------- player ---------- */
function pUpdate(dt){const f=(K.KeyW||K.ArrowUp?1:0)-(K.KeyS||K.ArrowDown?1:0)-J.y,s=(K.KeyD||K.ArrowRight?1:0)-(K.KeyA||K.ArrowLeft?1:0)+J.x;
let dx=Math.cos(P.yaw)*s-Math.sin(P.yaw)*f,dz=-Math.sin(P.yaw)*s-Math.cos(P.yaw)*f;const l=Math.hypot(dx,dz);if(l>1){dx/=l;dz/=l}
P.cr=K.ControlLeft||K.KeyC?1:0;const run=(K.ShiftLeft||K.ShiftRight)&&P.stam>4&&l>.1&&!P.cr,sp=P.cr?1.8:run?6.4:4;
P.stam=cl(P.stam+(run?-20:12)*dt,0,100);const k=Math.min(1,dt*8);P.vx+=(dx*sp-P.vx)*k;P.vz+=(dz*sp-P.vz)*k;
const nx=P.x+P.vx*dt,nz=P.z+P.vz*dt;if(!hit(nx,P.z,.5))P.x=nx;if(!hit(P.x,nz,.5))P.z=nz;
const v=Math.hypot(P.vx,P.vz);P.nz=run?1:v>.4?(P.cr?.12:.45):0;P.h+=((P.cr?1:1.7)-P.h)*Math.min(1,dt*8);
P.bob+=v*dt;if(P.bob>(run?1.6:2.3)){P.bob=0;snd('step',run?1.2:.7)}}
function nearest(){let b=null,bd=1e9;const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);for(const o of I){if(!o.ok())continue;const dx=o.x-P.x,dz=o.z-P.z,d=Math.hypot(dx,dz);if(d<o.r&&d<bd&&(d<1.5||(dx*fx+dz*fz)/d>.35)){b=o;bd=d}}return b}
const lb=o=>typeof o.lab=='function'?o.lab():o.lab;
function use(){const o=nearest();if(o){hand();o.act()}}
function items(dt){const o=nearest();$('prompt').textContent=o?(TD?'Tap E: ':'[E] ')+lb(o):'';for(const q of I){q.m.visible=q.ok();q.m.rotation.y+=dt}
tobj-=dt;if(tobj<=0){tobj=.5;const g=TG[S.st];if(g)$('obj').textContent=OB[S.st]+' ['+Math.round(dist(g[0],g[1]))+'m]'}}
function trig(dt){const s=S.st;if(s==5&&dist(0,-80)<8){go(6);say(D.dark)}if(s==6&&dist(30,90)<6){go(7);say(D.lock);snd('buzz')}if(s==13&&dist(34,-20)<3)win();
if(s==9||s==10){mqT-=dt;if(mqT<0){mqT=2+rnd()*3;const m=mq[rnd()*mq.length|0],dx=m.position.x-P.x,dz=m.position.z-P.z,d=Math.hypot(dx,dz)||1;if((dx*-Math.sin(P.yaw)+dz*-Math.cos(P.yaw))/d<.2){m.rotation.y=rnd()*6.28;m.position.x=m.hx+(rnd()-.5)*1.2}}}}
function amb2(dt){if(!AC)return;const inF=P.x>-50&&P.x<30&&P.z>-60&&P.z<20;rgn.gain.value=inF?.04:.12;hg.gain.value=(S.st>=2&&S.st<6||S.st>=13)?.07:.015;
const ex=e.x-P.x,ez=e.z-P.z,d=Math.hypot(ex,ez)||1,on=e.st!='dormant'&&E.visible;sv.gain.value=on?cl(1-d/45,0,1)*.2:0;pn.pan.value=cl((ex*Math.cos(P.yaw)-ez*Math.sin(P.yaw))/d,-1,1);
svo.frequency.value=70+(e.st=='hunt'?60:0)+Math.sin(clk*5)*10;if(e.st=='hunt'&&(pt-=dt)<=0){pt=.55;tone(55,.25,'sine',.5)}
if((tt-=dt)<=0){tt=15+rnd()*25;snd('thunder');lit=1}}
/* ---------- tablet map (built from real colliders; unexplored hidden) ---------- */
const mx=$('map').getContext('2d'),ml=document.createElement('canvas'),mk=document.createElement('canvas');ml.width=ml.height=mk.width=mk.height=400;
const mlx=ml.getContext('2d'),mkx=mk.getContext('2d');mkx.fillStyle='#fff';const mp=(x,z)=>[(x+105)*1.9,(z+105)*1.9];
const AR=[['FRONT LOT',-12,85],['GEN ⚡',-86,-70],['SCRAP YARD',60,0],['GRINDER',58,-25],['STORAGE',-10,-78],['DISPATCH',-66,29],['GUARD',-26,52],['FACTORY',-30,-20],['MAINT.',-49,-50],['CONTROL',10,-52],['EXIT ▶',30,-20]];
function explore(){const[a,b]=mp(P.x,P.z);mkx.beginPath();mkx.arc(a,b,60,0,7);mkx.fill()}
function drawMap(){mlx.globalCompositeOperation='source-over';mlx.clearRect(0,0,400,400);mlx.fillStyle='#7f9a86';for(const w of W){if(w.off)continue;const[a,b]=mp(w.x0,w.z0);mlx.fillRect(a,b,(w.x1-w.x0)*1.9,(w.z1-w.z0)*1.9)}
mlx.fillStyle='#e90';[door1,door2,door3].forEach(d=>{if(d.visible){const[a,b]=mp(d.c.x0,d.c.z0);mlx.fillRect(a,b,(d.c.x1-d.c.x0)*1.9,(d.c.z1-d.c.z0)*1.9)}});
mlx.fillStyle='#e8d070';mlx.font='11px monospace';AR.forEach(([n,x,z])=>{const[a,b]=mp(x,z);mlx.fillText(n,a,b)});
mlx.globalCompositeOperation='destination-in';mlx.drawImage(mk,0,0);mx.fillStyle='#021';mx.fillRect(0,0,400,400);mx.drawImage(ml,0,0);
const g=TG[S.st];if(g){const[a,b]=mp(g[0],g[1]);mx.fillStyle='#fd3';mx.font='18px monospace';mx.fillText('★',a-7,b+6)}
const[a,b]=mp(P.x,P.z);mx.save();mx.translate(a,b);mx.rotate(-P.yaw);mx.fillStyle='#3f6';mx.beginPath();mx.moveTo(0,-8);mx.lineTo(6,6);mx.lineTo(-6,6);mx.fill();mx.restore();
mx.fillStyle='#8c9';mx.font='11px monospace';mx.fillText('BLUEPRINT — unexplored areas hidden',8,392)}
/* ---------- world animation ---------- */
function world(dt){clk+=dt;const p=rg.attributes.position.array;for(let i=0;i<N;i++){const j=i*3+1;p[j]-=32*dt;if(p[j]<0)p[j]+=20}rg.attributes.position.needsUpdate=true;rain.position.set(P.x,0,P.z);
lit=Math.max(0,lit-dt*1.5);amb.intensity=.5+lit*3;if(hk>0)hk-=dt;const q=hk>0?Math.sin(Math.max(0,hk)/hd*Math.PI):0;
hands.forEach((h,i)=>h.position.set((i?.25:-.25)+(rnd()-.5)*q*.02,-.32+q*.1,-.55-q*.3));
pc=Math.max(0,pc-dt);pl=Math.max(0,pl-dt);fl.intensity=tabOpen||!fl.userData.on?0:pl>0?(Math.sin(clk*70)>0?5:.1):2.6;
shake=Math.max(0,shake-dt);P.ph+=Math.hypot(P.vx,P.vz)*dt*2.4;
cam.position.set(P.x+(rnd()-.5)*shake*.1,P.h+Math.sin(P.ph)*.035+(rnd()-.5)*shake*.1,P.z);cam.rotation.set(P.pitch,P.yaw,0);
if(E.visible){E.position.set(e.x,e.st=='hunt'?Math.abs(Math.sin(clk*6))*.12:0,e.z);E.rotation.y=Math.PI/2-e.ang;
HD.rotation.z=e.st=='observe'?Math.sin(clk*1.4)*.4:e.st=='hunt'?(rnd()-.5)*.6:0;HD.rotation.y=e.st=='observe'?Math.sin(clk*.9)*.7:0;EL.intensity=e.fl>0?(rnd()>.5?1.5:0):.9;
if(mode!='dying')ARM.rotation.x=e.st=='hunt'?-.5-Math.abs(Math.sin(clk*6))*.5:0}
fac.forEach((l,i)=>l.intensity=S.st>=11?(rnd()>.04?1.1:.1)*(i%2?1:.9):0);
const vis=tabOpen&&mode=='play';$('tab').classList.toggle('hide',!vis);if(vis)drawMap();if(mode=='play')explore()}
/* ---------- modes / menus ---------- */
const show=(i,on)=>$(i).classList.toggle('hide',!on),setMode=m=>{mode=m;document.body.classList.toggle('g',m=='intro'||m=='play'||m=='dying')};
const lock=()=>{if(!TD&&$('c').requestPointerLock)$('c').requestPointerLock()};
function toMenu(){setMode('menu');['pause','dead','win','tab','bSkip'].forEach(i=>show(i,0));show('menu',1);$('bCont').disabled=!getSave();$('fade').style.cssText='';document.exitPointerLock&&document.exitPointerLock()}
function newGame(){if(getSave()&&!confirm('Erase previous progress and start a new game?'))return;initA();S=S0();cp=null;try{localStorage.removeItem('fb_cp')}catch(_){}
P.x=0;P.z=66;P.yaw=P.pitch=0;sync();placeE();clrSay();show('menu',0);mkQuit();$('fade').style.cssText='transition:none;opacity:1';mlx.clearRect(0,0,400,400);mkx.clearRect(0,0,400,400);
let seen=0;try{seen=localStorage.getItem('fb_seen')}catch(_){}show('bSkip',!!seen);setMode('intro');say(D.intro);lock()}
const mkQuit=()=>{};
function begin(){show('bSkip',0);try{localStorage.setItem('fb_seen',1)}catch(_){}$('fade').style.cssText='';setMode('play');go(1);say(D.start);lock()}
function contGame(){const c=getSave();if(!c)return;initA();cp=c;loadCP(c);show('menu',0);$('fade').style.cssText='';setMode('play');lock()}
function restart(){const c=cp||getSave();if(!c)return toMenu();initA();loadCP(c);cam.fov=72;cam.updateProjectionMatrix();ARM.rotation.x=0;show('dead',0);$('fade').style.cssText='';setMode('play');lock()}
function pause(){if(mode!='play')return;setMode('pause');show('pause',1)}
function win(){if(mode!='play')return;setMode('win');$('fade').style.opacity=1;document.exitPointerLock&&document.exitPointerLock();setTimeout(()=>show('win',1),1500)}
$('bNew').onclick=newGame;$('bCont').onclick=contGame;$('bRst').onclick=restart;$('bM1').onclick=$('bM2').onclick=$('bM3').onclick=toMenu;
$('bRes').onclick=()=>{show('pause',0);setMode('play');lock()};$('bSkip').onclick=()=>{clrSay()};$('bP').onclick=pause;
$('c').onclick=()=>{initA();if(mode=='play'&&!document.pointerLockElement)lock()};
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode=='play'&&!TD)pause()});
/* ---------- input ---------- */
const K={},J={x:0,y:0};
const press=c=>{if(mode!='play')return;if(c=='KeyE')use();else if(c=='KeyF'&&!tabOpen)fl.userData.on=!fl.userData.on;else if(c=='KeyG')pulse();else if(c=='Tab'&&S.tab)tabOpen=!tabOpen};
addEventListener('keydown',ev=>{if(ev.code=='Tab'||ev.code.startsWith('Arrow'))ev.preventDefault();if(ev.code=='Escape')pause();if(!K[ev.code])press(ev.code);K[ev.code]=1});
addEventListener('keyup',ev=>K[ev.code]=0);
const look=(dx,dy,s)=>{if(mode=='play'||mode=='intro'){P.yaw-=dx*s;P.pitch=cl(P.pitch-dy*s,-1.4,1.4)}};
document.addEventListener('mousemove',ev=>{if(document.pointerLockElement)look(ev.movementX,ev.movementY,.0022)});
document.querySelectorAll('#btns button').forEach(b=>{const c=b.dataset.k;b.addEventListener('touchstart',ev=>{ev.preventDefault();initA();if(!K[c])press(c);K[c]=1},{passive:false});['touchend','touchcancel'].forEach(t=>b.addEventListener(t,ev=>{ev.preventDefault();K[c]=0}))});
let jt=null,lt=null,lp;
addEventListener('touchstart',ev=>{for(const t of ev.changedTouches){if(t.target.closest&&t.target.closest('#joy'))jt=t.identifier;else if(t.target.id=='c'&&lt==null){lt=t.identifier;lp=[t.clientX,t.clientY]}}});
addEventListener('touchmove',ev=>{for(const t of ev.changedTouches){if(t.identifier==jt){const r=$('joy').getBoundingClientRect();let x=(t.clientX-r.left-r.width/2)/50,y=(t.clientY-r.top-r.height/2)/50;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}J.x=x;J.y=y;$('knob').style.transform=`translate(${x*40}px,${y*40}px)`}
else if(t.identifier==lt){look(t.clientX-lp[0],t.clientY-lp[1],.005);lp=[t.clientX,t.clientY]}}if(mode=='play')ev.preventDefault()},{passive:false});
addEventListener('touchend',ev=>{for(const t of ev.changedTouches){if(t.identifier==jt){jt=null;J.x=J.y=0;$('knob').style.transform=''}if(t.identifier==lt)lt=null}});
/* ---------- main loop ---------- */
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
if(mode=='play'){pUpdate(dt);eAI(dt);trig(dt);items(dt);amb2(dt);dlg(dt)}else if(mode=='dying')scare(dt);else if(mode=='intro'){dlg(dt);if(!dc&&!dq.length)begin()}
world(dt);ren.render(sc,cam)}
sync();toMenu();requestAnimationFrame(loop);
