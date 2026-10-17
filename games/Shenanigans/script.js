'use strict';
/* Vessel Training Grounds – 2.5D canvas fighter (x = left/right, z = depth, y = height) */
const $=id=>document.getElementById(id),cv=$('c'),ctx=cv.getContext('2d');
const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.random()*a.length|0];
const VH=540,GY=VH*.66,HZ=VH*.42,AR={x0:70,x1:1530,z0:-125,z1:125},GRAV=2300,WORLD=1600;
let VW,Z,cam=0,shake=0,fz=0,flash=0,flashC='#f00',banner=0,shr=0,shc=0,tick=0;
function rs(){cv.width=innerWidth;cv.height=innerHeight;Z=innerHeight/VH;VW=innerWidth/Z}
addEventListener('resize',rs);rs();
const sp=(x,z,y=0)=>({x:x-cam,y:GY+z*.6-y});

/* ---------- entities ---------- */
const ent=(x,o)=>Object.assign({x,z:0,y:0,vx:0,vz:0,vy:0,face:1,stun:0,down:0,rot:0,spin:0,sw:0,fl:0,bs:0,air:0,lau:0,j:0,hp:100,max:100},o);
const P=ent(300,{combo:0,ct:0,busy:0,block:0,counter:0,awk:0,meter:0,dash:0,wind:0,bf:0,tok:0,cd:[0,0,0,0]});
const D=ent(900,{hp:1000,max:1000,face:-1});
const CDM=[8,10,9,7],NAMES=['Cursed Strikes','Crushing Blow','Divergent Fist','Manji Kick'];
const Q=[],PT=[],POP=[],FX=[];
const later=(t,f)=>Q.push({t,f});
const act=(t,f)=>{const k=P.tok;later(t,()=>{if(k===P.tok)f()})};   // player actions cancel when P is hit
const props=[[520,-70,'p'],[760,80,'p'],[1180,-80,'p'],[1380,70,'p'],[1000,-105,'w'],[420,100,'w']]
  .map(([x,z,k])=>({x,z,k,w:k=='p'?40:120,h:k=='p'?140:80,on:1,t:0}));

/* ---------- effects ---------- */
const CE=['#e01010','#a00000','#150005','#ff3030'],BFC=['#000','#f00','#fff','#ff2020','#300'];
function burst(x,z,y,n,o){for(let i=0;i<n;i++)PT.push({x,z,y,vx:rnd(-1,1)*o.s,vy:rnd(0,1.1)*o.s,vz:rnd(-.5,.5)*o.s*.5,l:o.l||.5,m:o.l||.5,c:pick(o.c),s:rnd(3,o.sz||7),g:o.g?1700:300})}
const pop=(e,txt,c='#fff',big)=>POP.push({x:e.x+rnd(-14,14),z:e.z,y:e.y+110,t:.9,txt,c,big});
const ring=(x,z,r,c='#f22')=>FX.push({k:'r',x,z,max:r,c,t:.45});
function breakNear(x,z,r){props.forEach(p=>{if(p.on&&Math.hypot(p.x-x,(p.z-z)*1.6)<r){p.on=0;p.t=7;burst(p.x,p.z,p.h/2,30,{s:380,l:.9,c:['#bbb','#888','#666','#ddd'],g:1,sz:10});shake=Math.max(shake,8)}})}

/* ---------- combat core ---------- */
function hit(t,f,o){
  let d=o.dmg*(f===P&&P.awk>0?1.5:1),dir=Math.sign(t.x-f.x)||f.face,kx=o.kx||0,stun=o.stun||0,ky=o.ky||0;
  if(t===P){
    if(P.counter>0){kick(f);return}                                   // Manji Kick counter
    if(P.block>0&&!o.bf){d*=.15;kx*=.2;stun=0;ky=0;pop(t,'BLOCK','#6cf')}
    if(stun){P.busy=0;P.dash=0;P.wind=0;P.tok++}
  }
  t.hp-=d;t.fl=.12;t.stun=Math.max(t.stun,stun);t.vx=dir*kx;t.vz=0;
  if(ky){t.vy=ky;t.y=Math.max(t.y,1);t.lau=1;t.air=1;t.spin=dir*rnd(6,10)}
  pop(t,Math.round(d)+(o.bf?' BLACK FLASH!':''),o.bf?'#ff3030':'#fff',o.bf||d>=9);
  burst(t.x,t.z,t.y+55,o.bf?36:10,{s:o.bf?520:260,l:o.bf?.8:.4,c:o.bf?BFC:CE});
  shake=Math.max(shake,o.sh||0);fz=Math.max(fz,o.fz||0);
  if(f===P&&!P.awk)P.meter=Math.min(100,P.meter+d*.55);
  if(t.hp<=0){t.hp=t.max;pop(t,'RESET','#6f6',1)}
}
const faceD=()=>{if(Math.abs(D.x-P.x)<450)P.face=D.x>=P.x?1:-1};
const near=(r,zr=45)=>{const dx=(D.x-P.x)*P.face;return dx>-25&&dx<r&&Math.abs(D.z-P.z)<zr&&Math.abs(D.y-P.y)<110};
const can=i=>P.cd[i]<=0&&P.busy<=0&&P.stun<=0&&!P.block&&!P.down;
const start=i=>{P.cd[i]=CDM[i]*(P.awk>0?.5:1);P.combo=0;faceD()};
function shock(x,z,r,dmg){
  ring(x,z,r);burst(x,z,0,26,{s:420,l:.6,c:CE});shake=Math.max(shake,12);breakNear(x,z,r);
  if(Math.hypot(D.x-x,(D.z-z)*1.6)<r&&D.y<60)hit(D,P,{dmg,kx:420,ky:420,stun:.8,sh:12,fz:.08});
}

/* M1: 4-hit combo with hitstun, 4th hit launches */
function m1(){
  if(P.busy>0||P.stun>0||P.block||P.down)return;
  faceD();P.combo=(P.ct>0?P.combo:0)+1;if(P.combo>4)P.combo=1;P.ct=.9;
  const last=P.combo==4;P.busy=last?.42:.26;P.sw=.2;P.vx=P.face*(last?320:190);
  act(.09,()=>{if(near(90))hit(D,P,{dmg:last?9:4,kx:last?520:90,ky:last?380:0,stun:.45,sh:last?6:2,fz:last?.08:.03})});
}
/* 1: Cursed Strikes – dash, flurry on connect, kick launcher */
function cs(){if(!can(0))return;start(0);P.busy=.35;P.vx=0;P.dash=.3}
function flurry(){
  P.busy=1;P.dash=0;D.stun=1;D.vx=D.vz=0;D.vy=0;
  for(let i=0;i<6;i++)act(.12+i*.09,()=>{P.sw=.12;hit(D,P,{dmg:2.5,kx:0,stun:.5,sh:1.5,fz:.015})});
  act(.8,()=>{P.sw=.35;hit(D,P,{dmg:9,kx:700,ky:560,stun:.8,sh:10,fz:.1})});
}
/* 2: Crushing Blow – close grab + double slam + launch, or ground shockwave from range */
function cb(){
  if(!can(1))return;start(1);
  if(near(130,60)&&D.y<30){
    P.busy=1.3;D.stun=1.4;D.vx=D.vz=0;D.z=P.z;
    const slam=()=>{D.x=P.x+P.face*55;D.y=70;D.vy=-1800;ring(D.x,D.z,120);burst(D.x,D.z,0,14,{s:300,l:.4,c:CE});hit(D,P,{dmg:7,kx:0,stun:1.4,sh:9,fz:.07});breakNear(D.x,D.z,130)};
    act(.3,slam);act(.7,slam);
    act(1.05,()=>{P.sw=.3;hit(D,P,{dmg:9,kx:150,ky:1150,stun:1.2,sh:9,fz:.1})});
  }else{P.busy=.8;P.sw=.4;act(.35,()=>shock(P.x+P.face*120,P.z,270,12))}
}
/* 3: Divergent Fist – delayed double impact; re-press during windup = Black Flash */
function df(){
  if(P.wind>0){P.bf=1;return}
  if(!can(2))return;start(2);P.busy=1;P.wind=.5;P.bf=0;P.vx=0;
  act(.5,()=>{
    P.wind=0;const bf=P.bf;P.sw=.35;P.vx=P.face*300;
    if(!near(115))return;
    hit(D,P,{dmg:bf?30:12,kx:bf?900:500,ky:bf?350:120,stun:.9,sh:bf?18:8,fz:bf?.16:.07,bf});
    if(bf){flash=.35;flashC='#fff';ring(D.x,D.z,230,'#000');ring(D.x,D.z,160,'#f00');breakNear(D.x,D.z,230)}
    act(.4,()=>{
      ring(D.x,D.z,bf?200:130,'#f44');burst(D.x,D.z,D.y+50,bf?40:18,{s:bf?560:340,l:.6,c:bf?BFC:CE});
      hit(D,P,{dmg:bf?18:10,kx:250,stun:.6,sh:bf?12:6,fz:.06});if(bf)breakNear(D.x,D.z,150)});
  });
}
/* 4: Manji Kick – counter stance, upward roundhouse repels attacker */
function mj(){if(!can(3))return;start(3);P.counter=.9;P.busy=.9;P.sw=.15}
function kick(f){
  P.counter=0;P.busy=.5;P.sw=.3;P.face=f.x>=P.x?1:-1;ring(P.x,P.z,160,'#9cf');pop(P,'COUNTER!','#9cf',1);
  later(.08,()=>{hit(f,P,{dmg:14,kx:650,ky:900,stun:1.1,sh:10,fz:.1})});
}
/* G: King of Curses + Malevolent Shrine slashes */
function awaken(){
  if(P.meter<100||P.awk>0||P.stun>0)return;
  P.meter=0;P.awk=15;P.busy=.6;banner=2.2;flash=.6;flashC='#a00';shake=14;shr=1.6;shc=0;ring(P.x,P.z,300,'#f00');faceD();
}
function jump(){
  if(P.stun>0||P.busy>0||P.down||P.j>=2)return;
  P.vy=P.j?760:880;P.j++;P.y=Math.max(P.y,1);P.air=1;burst(P.x,P.z,0,P.j>1?8:3,{s:120,l:.3,c:['#aaa','#ddd']});
}
/* Dummy swing (T): lets you test Block and Manji Kick */
function dswing(){
  if(D.bs>0||D.stun>0)return;
  D.face=P.x>=D.x?1:-1;D.sw=.35;D.bs=.8;pop(D,'!','#ff0',1);
  later(.4,()=>{const dx=(P.x-D.x)*D.face;
    if(D.stun<=0&&dx>-30&&dx<130&&Math.abs(P.z-D.z)<50&&P.y<100)hit(P,D,{dmg:10,kx:380,stun:.45,sh:4,fz:.04})});
}

/* ---------- physics & update ---------- */
function phys(e,dt){
  e.vy-=GRAV*dt;e.y+=e.vy*dt;e.x+=e.vx*dt;e.z+=e.vz*dt;
  if(e.y<=0){
    e.y=0;e.vy=0;
    if(e.air){e.air=0;e.j=0;
      if(e.lau){e.lau=0;e.down=.9;e.rot=(e.spin>0?1:-1)*1.57;e.vx*=.4;shake=Math.max(shake,5);burst(e.x,e.z,0,10,{s:200,l:.35,c:['#999','#ccc']})}}
    const f=Math.pow(.004,dt);e.vx*=f;e.vz*=f;
  }else e.air=1;
  if(e.lau)e.rot+=e.spin*dt;else if(e.down<=0)e.rot+=(0-e.rot)*Math.min(1,12*dt);
  if(e.x<AR.x0){e.x=AR.x0;e.vx=Math.abs(e.vx)*.4}if(e.x>AR.x1){e.x=AR.x1;e.vx=-Math.abs(e.vx)*.4}
  e.z=Math.max(AR.z0,Math.min(AR.z1,e.z));
  for(const k of ['stun','down','fl','sw','bs'])e[k]=Math.max(0,e[k]-dt);
}
const K={},joy={x:0,y:0};
function update(dt){
  tick+=dt;
  for(let i=Q.length-1;i>=0;i--){Q[i].t-=dt;if(Q[i].t<=0)Q.splice(i,1)[0].f()}
  for(let i=0;i<4;i++)P.cd[i]=Math.max(0,P.cd[i]-dt);
  for(const k of ['busy','ct','counter','awk','wind'])P[k]=Math.max(0,P[k]-dt);
  let ix=(K.d||K.arrowright?1:0)-(K.a||K.arrowleft?1:0)+joy.x,iz=(K.s||K.arrowdown?1:0)-(K.w||K.arrowup?1:0)+joy.y;
  const m=Math.hypot(ix,iz);if(m>1){ix/=m;iz/=m}
  P.block=K.f&&P.busy<=0&&P.stun<=0&&!P.down?1:0;
  if(P.block){P.vx=P.vz=0}
  else if(P.stun<=0&&P.busy<=0&&!P.down){P.vx=ix*340*(P.awk?1.2:1);P.vz=iz*250;if(ix)P.face=ix>0?1:-1}
  if(P.dash>0){P.dash-=dt;P.x+=P.face*1500*dt;burst(P.x,P.z,40,1,{s:90,l:.3,c:CE});if(near(80)){flurry()}}
  if(shr>0){shr-=dt;shc-=dt;if(shc<=0){shc=.06;
    if(Math.hypot(D.x-P.x,D.z-P.z)<700){FX.push({k:'s',x:D.x+rnd(-30,30),z:D.z,y:rnd(20,100),a:rnd(-.9,.9),t:.2});hit(D,P,{dmg:2,kx:0,stun:.3,sh:1.5})}}}
  phys(P,dt);phys(D,dt);
  props.forEach(p=>{if(!p.on&&(p.t-=dt)<=0)p.on=1});
  cam+=(Math.max(0,Math.min(WORLD-VW,P.x-VW/2))-cam)*Math.min(1,8*dt);
  for(let i=PT.length-1;i>=0;i--){const p=PT[i];p.vy-=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<0){p.y=0;p.vy*=-.3}if((p.l-=dt)<=0)PT.splice(i,1)}
  for(let i=POP.length-1;i>=0;i--){POP[i].y+=60*dt;if((POP[i].t-=dt)<=0)POP.splice(i,1)}
  for(let i=FX.length-1;i>=0;i--)if((FX[i].t-=dt)<=0)FX.splice(i,1);
  if(P.hp<=0){P.hp=P.max;pop(P,'RESPAWN','#6f6',1)}
  if(P.awk>0&&Math.random()<.6)burst(P.x+rnd(-14,14),P.z,rnd(0,90),1,{s:90,l:.5,c:CE});
  banner=Math.max(0,banner-dt);flash=Math.max(0,flash-dt*1.6);
}

/* ---------- rendering ---------- */
function drawProp(p){
  const s=sp(p.x,p.z),g=ctx.createLinearGradient(s.x-p.w/2,0,s.x+p.w/2,0);
  g.addColorStop(0,'#8e8e9c');g.addColorStop(.5,'#d6d6de');g.addColorStop(1,'#74748a');
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(s.x,s.y,p.w*.6,8,0,0,7);ctx.fill();
  ctx.fillStyle=g;ctx.fillRect(s.x-p.w/2,s.y-p.h,p.w,p.h);
  ctx.fillStyle='#62627a';ctx.fillRect(s.x-p.w/2-4,s.y-p.h-6,p.w+8,8);
}
function drawChar(e){
  const s=sp(e.x,e.z,e.y),g=sp(e.x,e.z),pl=e===P,c=a=>e.fl>0?'#fff':a;
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(g.x,g.y,Math.max(8,26-e.y*.03),8,0,0,7);ctx.fill();
  ctx.save();ctx.translate(s.x,s.y-38);ctx.rotate(e.rot);ctx.scale(e.face,1);ctx.translate(0,38);
  if(pl&&P.awk>0){ctx.shadowColor='#f00';ctx.shadowBlur=22}
  ctx.fillStyle=c(pl?'#2a2a3a':'#55555f');ctx.fillRect(-12,-34,10,34);ctx.fillRect(2,-34,10,34);
  ctx.fillStyle=c(pl?'#8fbbe8':'#8a8a94');ctx.fillRect(-14,-70,28,38);
  if(pl){ctx.fillStyle=c('#f4f4f4');ctx.fillRect(-6,-68,12,30)}
  ctx.fillStyle=c('#f1c9a0');ctx.fillRect(-10,-94,20,22);ctx.fillRect(-19,-68,8,28);
  ctx.fillRect(11,-66,e.sw>0?16+e.sw*140:8,e.sw>0?9:28);
  ctx.fillStyle=c(pl?'#e98aa0':'#5b3a29');ctx.fillRect(-11,-99,22,9);
  ctx.fillStyle='#111';ctx.fillRect(3,-86,3,3);
  if(pl){
    if(P.wind>0){ctx.strokeStyle=P.bf?'#f00':'#f66';ctx.lineWidth=3;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(24,-60);ctx.lineTo(24+rnd(10,45),-60+rnd(-32,32));ctx.stroke()}}
    if(P.block){ctx.strokeStyle='#6cf';ctx.lineWidth=4;ctx.beginPath();ctx.arc(14,-50,40,-1.2,1.2);ctx.stroke()}
    if(P.counter>0){ctx.strokeStyle='#c9f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-45,50+Math.sin(tick*20)*4,0,7);ctx.stroke()}
  }
  ctx.restore();
  if(!pl){ // dummy nameplate + health bar
    const x=s.x,y=s.y-128;ctx.textAlign='center';ctx.fillStyle='#e22';ctx.fillRect(x-6,y-34,12,12);
    ctx.font='700 14px sans-serif';ctx.fillStyle='#fff';ctx.strokeStyle='#000';ctx.lineWidth=3;ctx.strokeText('Dummy',x,y-4);ctx.fillText('Dummy',x,y-4);
    ctx.fillStyle='#000';ctx.fillRect(x-46,y,92,9);ctx.fillStyle='#3c4';ctx.fillRect(x-44,y+2,88*Math.max(0,D.hp/D.max),5);
  }
}
function draw(){
  ctx.setTransform(Z,0,0,Z,0,0);
  if(shake)ctx.translate(rnd(-shake,shake),rnd(-shake,shake));
  ctx.fillStyle='#bcd6ef';ctx.fillRect(-30,-30,VW+60,VH+60);
  const bc=['#cfe8c4','#d8c8f2','#efe2c6','#c6dcef'];
  for(let i=0;i<16;i++){const bx=((i*210-cam*.35)%3360+3360)%3360-220,h=110+(i*53%80);
    ctx.fillStyle=bc[i%4];ctx.fillRect(bx,HZ-h,190,h);ctx.fillStyle='rgba(80,90,120,.25)';
    for(let w=0;w<3;w++)ctx.fillRect(bx+20+w*55,HZ-h+20,28,34)}
  const RY=GY+AR.z0*.6-14;
  ctx.fillStyle='#a9a9b0';ctx.fillRect(-30,HZ,VW+60,RY-HZ);
  ctx.fillStyle='#2b2b31';ctx.fillRect(-30,RY,VW+60,VH-RY+30);
  ctx.fillStyle='#e8e8ec';ctx.fillRect(-30,RY,VW+60,4);
  for(let k=0;k<9;k++)ctx.fillRect(800+k*30-cam,GY+AR.z0*.6,16,(AR.z1-AR.z0)*.6);
  ctx.fillStyle='#111';ctx.fillRect(-700-cam,0,740,VH);ctx.fillRect(WORLD-40-cam,0,740,VH);
  FX.forEach(f=>{if(f.k!='r')return;const s=sp(f.x,f.z),r=f.max*(1-f.t/.45);
    ctx.strokeStyle=f.c;ctx.globalAlpha=f.t/.45;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(s.x,s.y,r,r*.5,0,0,7);ctx.stroke();ctx.globalAlpha=1});
  [P,D,...props.filter(p=>p.on)].sort((a,b)=>a.z-b.z).forEach(o=>o.k?drawProp(o):drawChar(o));
  FX.forEach(f=>{if(f.k!='s')return;const s=sp(f.x,f.z,f.y),dx=Math.cos(f.a)*45,dy=Math.sin(f.a)*45;
    ctx.strokeStyle='#f22';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(s.x-dx,s.y-dy);ctx.lineTo(s.x+dx,s.y+dy);ctx.stroke();
    ctx.strokeStyle='#000';ctx.lineWidth=1.5;ctx.stroke()});
  PT.forEach(p=>{const s=sp(p.x,p.z,p.y);ctx.globalAlpha=Math.max(0,p.l/p.m);ctx.fillStyle=p.c;ctx.fillRect(s.x,s.y,p.s,p.s)});
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000';
  POP.forEach(p=>{const s=sp(p.x,p.z,p.y);ctx.globalAlpha=Math.min(1,p.t*2);ctx.font=(p.big?'700 24px':'700 17px')+' "Comic Sans MS",sans-serif';
    ctx.strokeText(p.txt,s.x,s.y);ctx.fillStyle=p.c;ctx.fillText(p.txt,s.x,s.y)});
  ctx.globalAlpha=1;
  if(P.awk>0||shr>0){const g=ctx.createRadialGradient(VW/2,VH/2,VH*.35,VW/2,VH/2,VH*.95);g.addColorStop(0,'rgba(120,0,0,0)');g.addColorStop(1,shr>0?'rgba(120,0,10,.6)':'rgba(120,0,0,.3)');ctx.fillStyle=g;ctx.fillRect(-30,-30,VW+60,VH+60)}
  if(flash>0){ctx.globalAlpha=Math.min(1,flash);ctx.fillStyle=flashC;ctx.fillRect(-30,-30,VW+60,VH+60);ctx.globalAlpha=1}
  if(banner>0){ctx.globalAlpha=Math.min(1,banner);ctx.font='700 44px "Comic Sans MS",sans-serif';ctx.strokeStyle='#000';ctx.lineWidth=6;
    ctx.strokeText('KING OF CURSES',VW/2,110);ctx.fillStyle='#f33';ctx.fillText('KING OF CURSES',VW/2,110);
    ctx.font='700 20px sans-serif';ctx.fillStyle='#fff';ctx.fillText('Malevolent Shrine',VW/2,140);ctx.globalAlpha=1}
}

/* ---------- HUD ---------- */
const SL=NAMES.map((n,i)=>{const d=document.createElement('div');d.className='slot';
  d.innerHTML=`<b>${i+1}</b>${n}${i==2?'<br><small>USE TWICE</small>':''}<i></i><em></em>`;$('slots').append(d);return[d.querySelector('i'),d.querySelector('em')]});
function hud(){
  $('hf').style.width=P.hp/P.max*100+'%';
  $('mf').style.width=(P.awk>0?P.awk/15*100:P.meter)+'%';
  $('mt').textContent=P.awk>0?'ACTIVE':P.meter>=100?'Press G to activate':Math.floor(P.meter)+'%';
  for(let i=0;i<4;i++){SL[i][0].style.height=P.cd[i]/(CDM[i]*(P.awk>0?.5:1))*100+'%';SL[i][1].textContent=P.cd[i]>0?P.cd[i].toFixed(1):''}
}

/* ---------- desktop input ---------- */
addEventListener('keydown',e=>{
  const k=e.key==' '?'space':e.key.toLowerCase();
  if(['space','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if(e.repeat)return;K[k]=1;
  if(k=='space')jump();else if(k=='g')awaken();else if(k=='t')dswing();
  else if('1234'.includes(k)&&k.length==1)[cs,cb,df,mj][+k-1]();
});
addEventListener('keyup',e=>{K[e.key==' '?'space':e.key.toLowerCase()]=0});
cv.addEventListener('mousedown',e=>{if(e.button==0)m1()});
addEventListener('blur',()=>{for(const k in K)K[k]=0});

/* ---------- customizable touch controls ---------- */
if(matchMedia('(pointer:coarse)').matches||/touch/.test(location.search))document.body.classList.add('touch');
const KEY='vessel_layout';let LY={},edit=false,drag=null;
try{LY=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(LY))}catch(e){}};
const DEF={js:[.13,.72],m1:[.9,.58],jp:[.9,.8],bk:[.78,.7],b1:[.6,.58],b2:[.68,.58],b3:[.6,.8],b4:[.68,.8],g:[.5,.8],dm:[.2,.16]};
const place=(el,id,x,y)=>{el.style.left=x*100+'%';el.style.top=y*100+'%';LY[id]=[x,y]};
const home=(el,id)=>{const p=LY[id]||DEF[id];el.style.left=p[0]*100+'%';el.style.top=p[1]*100+'%'};
function bind(el,id,dn,up,mv){
  home(el,id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(edit){drag=el;return}dn&&dn(e)});
  el.addEventListener('pointermove',e=>{if(edit){if(drag===el)place(el,id,e.clientX/innerWidth,e.clientY/innerHeight)}else if(mv&&el.hasPointerCapture(e.pointerId))mv(e)});
  const u=e=>{if(edit){if(drag===el){drag=null;save()}}else up&&up(e)};
  el.addEventListener('pointerup',u);el.addEventListener('pointercancel',u);
}
const kn=$('kn'),js=$('js');
const jm=e=>{const r=js.getBoundingClientRect(),R=r.width/2;let dx=e.clientX-r.left-R,dy=e.clientY-r.top-R;const m=Math.hypot(dx,dy);
  if(m>R){dx*=R/m;dy*=R/m}joy.x=m/R<.15?0:dx/R;joy.y=m/R<.15?0:dy/R;kn.style.transform=`translate(${dx}px,${dy}px)`};
const jr=()=>{joy.x=joy.y=0;kn.style.transform=''};
bind(js,'js',jm,jr,jm);
[['m1','M1',m1],['jp','JUMP',jump],['bk','BLOCK'],['b1','1',cs],['b2','2',cb],['b3','3',df],['b4','4',mj],['g','G',awaken],['dm','DUMMY',dswing]].forEach(([id,txt,fn])=>{
  const el=document.createElement('div');el.className='tb';el.id='t_'+id;el.textContent=txt;$('touch').append(el);
  bind(el,id,()=>{el.classList.add('on');id=='bk'?K.f=1:fn()},()=>{el.classList.remove('on');if(id=='bk')K.f=0});
});
$('cust').onclick=()=>{edit=!edit;document.body.classList.toggle('edit',edit);$('cust').textContent=edit?'Done – Save':'Customize Layout';if(!edit)save();jr();K.f=0};
$('rst').onclick=()=>{LY={};try{localStorage.removeItem(KEY)}catch(e){}document.querySelectorAll('.tb').forEach(el=>home(el,el.id=='js'?'js':el.id.slice(2)))};

/* ---------- main loop (60 FPS, dt-clamped, hit-stop on heavy impacts) ---------- */
let last=performance.now();
(function loop(now){
  let dt=Math.min(.033,(now-last)/1000);last=now;
  shake=Math.max(0,shake-70*dt);
  if(fz>0){fz-=dt;dt*=.1}
  update(dt);draw();hud();requestAnimationFrame(loop);
})(last);
