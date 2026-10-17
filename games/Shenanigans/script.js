'use strict';
/* Vessel Training Grounds – 3D (Three.js r128). Units ≈ metres. The player always faces the camera yaw. */
const $=id=>document.getElementById(id),rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.random()*a.length|0];
const G=32,AR=22,V3=THREE.Vector3,SKY=0xbcd6ef;
const R=new THREE.WebGLRenderer({antialias:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.domElement.id='c';document.body.prepend(R.domElement);
const S=new THREE.Scene();S.background=new THREE.Color(SKY);S.fog=new THREE.Fog(SKY,45,120);
const cam=new THREE.PerspectiveCamera(65,1,.1,200);
function rs(){R.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}
addEventListener('resize',rs);rs();
S.add(new THREE.AmbientLight(0xffffff,.75));const sun=new THREE.DirectionalLight(0xffffff,.6);sun.position.set(20,40,10);S.add(sun);
const mat=c=>new THREE.MeshLambertMaterial({color:c});
const add=(w,h,l,c,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),mat(c));m.position.set(x,y,z);S.add(m);return m};

/* ---------- world ---------- */
const gr=new THREE.Mesh(new THREE.PlaneGeometry(160,160),mat(0x2b2b31));gr.rotation.x=-Math.PI/2;S.add(gr);
for(let k=0;k<9;k++)add(.8,.03,9,0xe8e8ec,-6+k*1.5,.02,0);
[-AR,AR].forEach(v=>{add(AR*2,.03,.3,0xe8e8ec,0,.02,v);add(.3,.03,AR*2,0xe8e8ec,v,.02,0)});
const BC=[0xcfe8c4,0xd8c8f2,0xefe2c6,0xc6dcef];
for(let i=0;i<24;i++){const a=i/24*Math.PI*2,h=8+(i*7%10);add(9,h,9,BC[i%4],Math.cos(a)*42,h/2,Math.sin(a)*42)}
[[-14,-14],[14,-14],[-14,14],[14,14]].forEach(([x,z])=>{add(.5,3,.5,0x6b4a2a,x,1.5,z);add(2.6,2.6,2.6,0x2f7d32,x,4.2,z)});
const props=[[-9,-8,1],[8,6,1],[-5,10,1],[12,-10,1],[10,-2,0],[-12,2,0]].map(([x,z,p])=>{const h=p?3.2:1.8;return{m:add(p?.9:2.6,h,p?.9:.5,0xb8b8c4,x,h/2,z),x,z,on:1,t:0}});
const SH=new THREE.Group();   // Malevolent Shrine
[[-5,-5],[5,-5],[-5,5],[5,5]].forEach(([x,z])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(1,9,1),mat(0x6a0000));m.position.set(x,4.5,z);SH.add(m)});
[[14,.9,14,9.4,0x1a0000],[9,1,9,10.4,0x8a0000],[3,3,3,12,0xddd0c0]].forEach(([w,h,l,y,c])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,l),mat(c));m.position.y=y;SH.add(m)});
SH.visible=false;S.add(SH);

/* ---------- characters ---------- */
function mkChar(c){
  const root=new THREE.Group(),pv=new THREE.Group(),ms=[];pv.position.y=1.2;root.add(pv);
  const box=(w,h,l,col,x,y,z,ty=0)=>{const m=mat(col),g=new THREE.BoxGeometry(w,h,l);g.translate(0,ty,0);ms.push(m);const me=new THREE.Mesh(g,m);me.position.set(x,y,z);pv.add(me);return me};
  const legs=[box(.4,1,.4,c.pants,-.22,-.2,0,-.5),box(.4,1,.4,c.pants,.22,-.2,0,-.5)];
  const torso=box(.9,1.1,.5,c.shirt,0,.35,0);box(.6,.6,.6,0xf1c9a0,0,1.2,0);box(.7,.22,.7,c.hair,0,1.58,0);box(.28,.9,.28,0xf1c9a0,-.62,.8,0,-.45);
  const arm=box(.28,.9,.28,0xf1c9a0,.62,.8,0,-.45);
  const sh=new THREE.Mesh(new THREE.CircleGeometry(.7,16),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.35}));sh.rotation.x=-Math.PI/2;S.add(sh);
  const bub=new THREE.Mesh(new THREE.SphereGeometry(1.4,14,10),new THREE.MeshBasicMaterial({color:0x66ccff,transparent:true,opacity:.25}));bub.position.set(0,1.3,0);bub.visible=false;root.add(bub);
  S.add(root);return{root,pv,legs,arm,ms,sh,bub,shirt:torso.material,sc:c.shirt};
}
const ent=(x,o)=>Object.assign({x,z:0,y:0,vx:0,vy:0,vz:0,yaw:0,stun:0,down:0,rot:0,spin:0,sw:0,fl:0,bs:0,air:0,lau:0,j:0,hold:0,slam:0,hp:100,max:100},o);
const P=ent(0,{z:8,combo:0,ct:0,busy:0,block:0,counter:0,awk:0,meter:0,dash:0,rushM:0,slide:0,wind:0,bf:0,tok:0,cd:[0,0,0,0,0,0,0,0]});
const D=ent(0,{z:-6,hp:1000,max:1000});
P.m=mkChar({shirt:0x8fbbe8,pants:0x2a2a3a,hair:0xe98aa0});D.m=mkChar({shirt:0x8a8a94,pants:0x55555f,hair:0x5b3a29});

/* ---------- state, effects ---------- */
let yaw=0,pitch=.25,shake=0,fz=0,tick=0,domT=0,shc=0,F={x:0,z:-1};
const Q=[],PR=[],FXs=[],K={},joy={x:0,y:0};
const later=(t,f)=>Q.push({t,f}),act=(t,f)=>{const k=P.tok;later(t,()=>{if(k===P.tok)f()})};
const CE=['#e01010','#a00000','#150005','#ff3030'],BFC=['#000','#f00','#fff','#ff2020','#300'],FIRE=['#ff7a00','#ffd000','#ff3000'];
const N=900,pp=new Float32Array(N*3).fill(-99),pc=new Float32Array(N*3),vel=new Float32Array(N*3),pl=new Float32Array(N),pg=new Float32Array(N);let pi=0;
const pgeo=new THREE.BufferGeometry();pgeo.setAttribute('position',new THREE.BufferAttribute(pp,3));pgeo.setAttribute('color',new THREE.BufferAttribute(pc,3));
const pts=new THREE.Points(pgeo,new THREE.PointsMaterial({size:.32,vertexColors:true,depthWrite:false}));pts.frustumCulled=false;S.add(pts);
const tc=new THREE.Color();
function burst(x,y,z,n,s,l,cols,g){for(let i=0;i<n;i++){const k=pi++%N;pp.set([x,y,z],k*3);vel.set([rnd(-1,1)*s,rnd(0,1.1)*s,rnd(-1,1)*s],k*3);pl[k]=l*rnd(.6,1);pg[k]=g?30:4;tc.set(pick(cols));pc.set([tc.r,tc.g,tc.b],k*3)}}
const RG=new THREE.TorusGeometry(1,.07,6,40),SG=new THREE.SphereGeometry(1,16,12),SLG=new THREE.BoxGeometry(3,.12,.07);
function fx(geo,col,pos,T,s0,s1,rot){const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col,transparent:true,depthWrite:false}));m.rotation.order='YXZ';m.position.copy(pos);if(rot)m.rotation.set(...rot);S.add(m);FXs.push({m,t:T,T,s0,s1})}
const ring=(x,z,r,c='#ff2222')=>fx(RG,c,new V3(x,.15,z),.45,.5,r,[Math.PI/2,0,0]);
const slashAt=(x,y,z,ya,roll)=>fx(SLG,'#ff2020',new V3(x,y,z),.18,1,1,[0,ya,roll]);
function pop(e,txt,c='#fff',big){const v=new V3(e.x+rnd(-.4,.4),e.y+3.2,e.z).project(cam);if(v.z>1)return;const d=document.createElement('div');d.className='pop'+(big?' big':'');d.textContent=txt;d.style.color=c;d.style.left=(v.x+1)*50+'%';d.style.top=(1-v.y)*50+'%';document.body.append(d);setTimeout(()=>d.remove(),900)}
function flashS(c,a){const f=$('fl');f.style.transition='none';f.style.background=c;f.style.opacity=a;void f.offsetWidth;f.style.transition='opacity .6s';f.style.opacity=0}
function banner(t){const b=$('bn');b.textContent=t;b.style.animation='none';void b.offsetWidth;b.style.animation='bn 2.6s forwards'}
function breakNear(x,z,r){props.forEach(p=>{if(p.on&&Math.hypot(p.x-x,p.z-z)<r){p.on=0;p.t=7;p.m.visible=false;Snd.play('prop_break');burst(p.x,1.2,p.z,34,9,1,['#bbb','#888','#666','#ddd'],1);shake=Math.max(shake,8)}})}

/* ---------- combat core ---------- */
function hit(t,f,o){
  let d=o.dmg*(f===P&&P.awk>0?1.3:1),dx=t.x-f.x,dz=t.z-f.z,l=Math.hypot(dx,dz),kx=o.kx||0,stun=o.stun||0,ky=o.ky||0;
  if(l<.01){dx=F.x;dz=F.z;l=1}dx/=l;dz/=l;
  if(t===P){
    if(P.counter>0){kick(f);return}                                  // Manji Kick counter
    if(P.block>0&&!o.bf){d*=.15;kx*=.2;stun=0;ky=0;pop(t,'BLOCK','#6cf')}
    if(stun){P.busy=0;P.dash=0;P.wind=0;P.slide=0;P.tok++}
  }
  Snd.play(o.bf?'black_flash':t===P?(stun?'player_hurt':'block'):d>=9?'hit_heavy':'hit');t.hp-=d;t.fl=.12;t.stun=Math.max(t.stun,stun);t.vx=dx*kx;t.vz=dz*kx;
  if(ky){t.vy=ky;t.y=Math.max(t.y,.3);t.lau=1;t.air=1;t.spin=rnd(5,9)*(Math.random()<.5?-1:1)}
  pop(t,Math.round(d)+(o.bf?' BLACK FLASH!':''),o.bf?'#ff3030':'#fff',o.bf||d>=9);
  burst(t.x,t.y+1.5,t.z,o.bf?40:12,o.bf?11:6,o.bf?.8:.45,o.bf?BFC:CE);
  shake=Math.max(shake,o.sh||0);fz=Math.max(fz,o.fz||0);
  if(o.bf)flashS('#fff',.35);
  if(f===P&&!P.awk)P.meter=Math.min(100,P.meter+d*.55);
  if(t.hp<=0){t.hp=t.max;Snd.play('ko');pop(t,'RESET','#6f6',1)}
}
const near=(r,c=.4)=>{const dx=D.x-P.x,dz=D.z-P.z,d=Math.hypot(dx,dz);return d<r&&(d<1.2||(dx*F.x+dz*F.z)/d>c)&&Math.abs(D.y-P.y)<2.8};
const off=()=>P.awk>0?4:0;
const CDM=[8,10,9,7,5,11,12,24],NM=[['Cursed Strikes','Crushing Blow','Divergent Fist','Manji Kick'],['Dismantle','Sever Rush','Fuga','Domain Expansion']];
const can=i=>P.cd[off()+i]<=0&&P.busy<=0&&P.stun<=0&&!P.block&&!P.down;
const start=i=>{P.cd[off()+i]=CDM[off()+i];P.combo=0;Snd.play((P.awk>0?'ult':'move')+(i+1))};
function shock(x,z,r,dmg){
  Snd.play('shockwave');ring(x,z,r);burst(x,.3,z,28,10,.6,CE);shake=Math.max(shake,12);breakNear(x,z,r);
  if(dmg&&Math.hypot(D.x-x,D.z-z)<r&&D.y<1.5)hit(D,P,{dmg,kx:8,ky:8,stun:.8,sh:12,fz:.08});
}
/* M1: 4-hit combo with hitstun, 4th hit launches */
function m1(){
  if(P.busy>0||P.stun>0||P.block||P.down)return;
  P.combo=(P.ct>0?P.combo:0)+1;if(P.combo>4)P.combo=1;P.ct=.9;
  const last=P.combo==4;Snd.play('m1_'+P.combo);P.busy=last?.42:.26;P.sw=.2;P.vx=F.x*(last?6:3.5);P.vz=F.z*(last?6:3.5);
  act(.09,()=>{if(near(2.7))hit(D,P,{dmg:last?9:4,kx:last?10:2,ky:last?7.5:0,stun:.45,sh:last?6:2,fz:last?.08:.03})});
}
/* ---- normal moveset ---- */
function cs(){if(!can(0))return;start(0);P.busy=.35;P.vx=P.vz=0;P.dash=.3;P.rushM=0}
function flurry(){
  P.busy=1;P.dash=0;D.stun=1;D.vx=D.vz=D.vy=0;
  for(let i=0;i<6;i++)act(.12+i*.09,()=>{P.sw=.12;hit(D,P,{dmg:2.5,stun:.5,sh:1.5,fz:.015})});
  act(.8,()=>{Snd.play('cs_kick');P.sw=.35;hit(D,P,{dmg:9,kx:14,ky:11,stun:.8,sh:10,fz:.1})});
}
function cb(){
  if(!can(1))return;start(1);
  if(near(2.8)&&D.y<1){
    Snd.play('cb_grab');P.busy=1.3;D.stun=1.4;D.vx=D.vz=0;
    const slam=()=>{Snd.play('cb_slam');D.x=P.x+F.x*1.2;D.z=P.z+F.z*1.2;D.y=2;D.vy=-30;ring(D.x,D.z,3);hit(D,P,{dmg:7,stun:1.4,sh:9,fz:.07});breakNear(D.x,D.z,3)};
    act(.3,slam);act(.7,slam);act(1.05,()=>{Snd.play('cb_launch');P.sw=.3;hit(D,P,{dmg:9,kx:3,ky:23,stun:1.2,sh:9,fz:.1})});
  }else{P.busy=.8;P.sw=.4;act(.35,()=>shock(P.x+F.x*2.6,P.z+F.z*2.6,5.5,12))}
}
function df(){
  if(P.wind>0){P.bf=1;Snd.play('bf_charge');return}
  if(!can(2))return;start(2);P.busy=1;P.wind=.5;P.bf=0;P.vx=P.vz=0;
  act(.5,()=>{
    P.wind=0;const bf=P.bf;P.sw=.35;P.vx=F.x*6;P.vz=F.z*6;
    if(!near(2.9))return;
    hit(D,P,{dmg:bf?30:12,kx:bf?18:10,ky:bf?7:2.5,stun:.9,sh:bf?18:8,fz:bf?.16:.07,bf});
    if(bf){ring(D.x,D.z,5,'#000');ring(D.x,D.z,3.5,'#f00');breakNear(D.x,D.z,5)}
    act(.4,()=>{Snd.play('df_explosion');ring(D.x,D.z,bf?4.5:3,'#f44');burst(D.x,D.y+1.2,D.z,bf?50:20,bf?13:8,.6,bf?BFC:CE);
      hit(D,P,{dmg:bf?18:10,kx:5,stun:.6,sh:bf?12:6,fz:.06});if(bf)breakNear(D.x,D.z,3.5)});
  });
}
function mj(){if(!can(3))return;start(3);P.counter=.9;P.busy=.9;P.sw=.15}
function kick(f){Snd.play('manji_counter');P.counter=0;P.busy=.5;P.sw=.3;ring(P.x,P.z,3.5,'#9cf');pop(P,'COUNTER!','#9cf',1);later(.08,()=>hit(f,P,{dmg:14,kx:13,ky:18,stun:1.1,sh:10,fz:.1}))}
/* ---- King of Curses moveset (active while awakened) ---- */
function slashProj(da,roll){
  const a=yaw+da,v=new V3(-Math.sin(a),0,-Math.cos(a)),m=new THREE.Mesh(SLG,new THREE.MeshBasicMaterial({color:'#ff2020'}));
  m.rotation.order='YXZ';m.rotation.set(0,a,roll);m.position.set(P.x+v.x*1.3,P.y+1.6+rnd(-.3,.3),P.z+v.z*1.3);S.add(m);PR.push({m,v:v.multiplyScalar(40),l:.55});
}
function dis(){   // Dismantle: volleys of slashes
  if(!can(0))return;start(0);P.busy=.75;P.sw=.3;
  for(let i=0;i<3;i++)act(.1+i*.18,()=>{Snd.play('dismantle_slash');P.sw=.15;for(let k=-1;k<=1;k++)slashProj(k*.17+rnd(-.04,.04),rnd(0,Math.PI))});
}
function rush(){if(!can(1))return;start(1);P.busy=.4;P.vx=P.vz=0;P.dash=.3;P.rushM=1}
function grab(){  // grab, slide, punch, rocket up, kick down
  Snd.play('rush_grab');P.dash=0;P.busy=2.6;D.hold=1;D.stun=3;P.slide=.45;
  act(.45,()=>{P.sw=.35;hit(D,P,{dmg:8,stun:3,sh:6,fz:.08})});
  act(.6,()=>{Snd.play('rush_launch');P.vy=24;P.y=.5;P.air=1;burst(P.x,.3,P.z,30,8,.6,CE)});
  act(1.45,()=>{Snd.play('rush_kick');P.sw=.4;D.hold=0;D.slam=1;hit(D,P,{dmg:16,ky:-42,stun:1.5,sh:12,fz:.1})});
}
function arrow(){
  const m=new THREE.Mesh(new THREE.ConeGeometry(.2,1.6,8),new THREE.MeshBasicMaterial({color:0xff7a00}));
  m.rotation.order='YXZ';m.rotation.set(-Math.PI/2,yaw,0);m.position.set(P.x+F.x*1.5,P.y+1.9,P.z+F.z*1.5);S.add(m);
  PR.push({m,v:new V3(F.x*55,0,F.z*55),l:1.4,a:1});
}
function fuga(){if(!can(2))return;start(2);P.busy=1.1;P.wind=.7;P.sw=.5;act(.7,()=>{Snd.play('fuga_fire');P.wind=0;P.sw=.3;arrow()})}
function explode(x,y,z){
  Snd.play('fuga_explode');fx(SG,'#ff8a00',new V3(x,y,z),.5,1,7);ring(x,z,8,'#ffcc00');burst(x,y,z,80,16,.9,FIRE);
  shake=16;fz=.12;flashS('#ff7a00',.5);breakNear(x,z,8);
  if(Math.hypot(D.x-x,D.z-z)<7)hit(D,P,{dmg:35,kx:12,ky:14,stun:1.2,sh:16});
}
function dom(){   // Domain Expansion: Malevolent Shrine
  if(!can(3))return;start(3);P.busy=1.2;P.sw=.4;domT=5;shc=0;banner('DOMAIN EXPANSION: MALEVOLENT SHRINE');flashS('#400',.8);shake=10;
  SH.position.set(D.x,0,D.z);SH.scale.y=.01;SH.visible=true;S.background=new THREE.Color(0x180000);S.fog.color.set(0x180000);
}
const SK=[[cs,cb,df,mj],[dis,rush,fuga,dom]],skill=i=>SK[P.awk>0?1:0][i]();
function awaken(){
  if(P.meter<100||P.awk>0||P.stun>0)return;
  Snd.play('awaken');P.meter=0;P.awk=30;P.busy=.6;P.cd.fill(0);banner('KING OF CURSES');flashS('#a00',.6);shake=14;ring(P.x,P.z,8,'#f00');P.m.shirt.color.set(0x6a1a1a);
}
function jump(){
  if(P.stun>0||P.busy>0||P.down||P.j>=2)return;
  Snd.play(P.j?'double_jump':'jump');P.vy=P.j?11:12.5;P.j++;P.y=Math.max(P.y,.1);P.air=1;burst(P.x,.2,P.z,P.j>1?10:4,4,.3,['#aaa','#ddd']);
}
function dswing(){   // T: dummy attacks you (test Block / Manji Kick)
  if(D.bs>0||D.stun>0)return;Snd.play('dummy_swing');D.sw=.35;D.bs=.8;pop(D,'!','#ff0',1);
  later(.4,()=>{if(D.stun<=0&&Math.hypot(P.x-D.x,P.z-D.z)<3.4&&P.y<2)hit(P,D,{dmg:10,kx:7,stun:.45,sh:4,fz:.04})});
}

/* ---------- physics & update ---------- */
function phys(e,dt){
  e.vy-=G*dt;e.y+=e.vy*dt;e.x+=e.vx*dt;e.z+=e.vz*dt;
  if(e.y<=0){
    e.y=0;e.vy=0;
    if(e.air){if(e===P)Snd.play('land');e.air=0;e.j=0;
      if(e.lau){e.lau=0;e.down=.9;e.rot=(e.spin>0?1:-1)*1.57;e.vx*=.4;e.vz*=.4;shake=Math.max(shake,5);burst(e.x,.2,e.z,12,4,.4,['#999','#ccc']);
        if(e.slam){e.slam=0;shock(e.x,e.z,7,0);shake=18}}}
    const f=Math.pow(.004,dt);e.vx*=f;e.vz*=f;
  }else e.air=1;
  if(e.lau)e.rot+=e.spin*dt;else if(e.down<=0)e.rot+=(0-e.rot)*Math.min(1,12*dt);
  if(Math.abs(e.x)>AR){e.x=Math.sign(e.x)*AR;e.vx*=-.4}if(Math.abs(e.z)>AR){e.z=Math.sign(e.z)*AR;e.vz*=-.4}
  for(const k of ['stun','down','fl','sw','bs'])e[k]=Math.max(0,e[k]-dt);
}
function update(dt){
  tick+=dt;F.x=-Math.sin(yaw);F.z=-Math.cos(yaw);P.yaw=yaw;
  for(let i=Q.length-1;i>=0;i--){Q[i].t-=dt;if(Q[i].t<=0)Q.splice(i,1)[0].f()}
  for(let i=0;i<8;i++)P.cd[i]=Math.max(0,P.cd[i]-dt);
  const wasA=P.awk>0;for(const k of ['busy','ct','counter','awk','wind'])P[k]=Math.max(0,P[k]-dt);
  if(wasA&&P.awk<=0){P.m.shirt.color.set(P.m.sc);banner('Awakening ended');Snd.play('awaken_end')}
  let ix=(K.d||K.arrowright?1:0)-(K.a||K.arrowleft?1:0)+joy.x,iz=(K.s||K.arrowdown?1:0)-(K.w||K.arrowup?1:0)+joy.y;
  const m=Math.hypot(ix,iz);if(m>1){ix/=m;iz/=m}
  P.block=K.f&&P.busy<=0&&P.stun<=0&&!P.down?1:0;
  if(P.block){P.vx=P.vz=0}
  else if(P.stun<=0&&P.busy<=0&&!P.down){const s=P.awk?8.5:7;P.vx=(ix*Math.cos(yaw)+iz*Math.sin(yaw))*s;P.vz=(-ix*Math.sin(yaw)+iz*Math.cos(yaw))*s}
  if(P.dash>0){P.dash-=dt;P.x+=F.x*28*dt;P.z+=F.z*28*dt;burst(P.x,1.2,P.z,1,2,.3,CE);if(near(1.9))P.rushM?grab():flurry()}
  if(P.slide>0){P.slide-=dt;P.x+=F.x*14*dt;P.z+=F.z*14*dt;burst(P.x+F.x,.1,P.z+F.z,3,4,.3,['#ff9','#fa0','#999'])}
  if(P.wind>0)burst(P.x+F.x,P.y+1.8,P.z+F.z,2,2,.3,P.awk?FIRE:(P.bf?BFC:CE));
  if(!D.down&&!D.lau)D.yaw=Math.atan2(-(P.x-D.x),-(P.z-D.z));
  phys(P,dt);phys(D,dt);
  if(D.hold){D.x=P.x+F.x*1.2;D.z=P.z+F.z*1.2;D.y=P.y+(P.y>.5?1.3:0);D.vx=D.vz=D.vy=0;D.rot=0}
  if(domT>0){
    domT-=dt;SH.scale.y=Math.min(1,(5-domT)*2.5);shc-=dt;
    if(shc<=0){shc=.05;if(Math.random()<.4)Snd.play('domain_slash');slashAt(D.x+rnd(-1.8,1.8),D.y+rnd(.3,2.8),D.z+rnd(-1.8,1.8),rnd(0,3),rnd(0,3));
      if(Math.hypot(D.x-P.x,D.z-P.z)<30)hit(D,P,{dmg:2.2,stun:.3,sh:1.2})}
    if(domT<=0){Snd.play('domain_end');hit(D,P,{dmg:25,kx:0,ky:14,stun:1.2,sh:16,fz:.15});flashS('#f00',.5);SH.visible=false;S.background=new THREE.Color(SKY);S.fog.color.set(SKY)}
  }
  for(let i=PR.length-1;i>=0;i--){   // projectiles: slashes & Fuga arrow
    const p=PR[i],q=p.m.position;q.addScaledVector(p.v,dt);p.l-=dt;
    const hd=Math.hypot(D.x-q.x,D.z-q.z)<(p.a?1.6:1.8)&&Math.abs(q.y-(D.y+1.3))<(p.a?2:1.8);
    let dead=p.l<=0;
    if(p.a){burst(q.x,q.y,q.z,2,2,.3,FIRE);if(hd||props.some(r=>r.on&&Math.hypot(r.x-q.x,r.z-q.z)<1.2)){explode(q.x,q.y,q.z);dead=true}else if(p.l<=0)explode(q.x,q.y,q.z)}
    else{if(hd&&!p.h){p.h=1;hit(D,P,{dmg:4,kx:2,stun:.45,sh:2,fz:.02})}breakNear(q.x,q.z,1.2)}
    if(dead){S.remove(p.m);PR.splice(i,1)}
  }
  for(let i=FXs.length-1;i>=0;i--){const f=FXs[i];f.t-=dt;const k=1-f.t/f.T,s=f.s0+(f.s1-f.s0)*k;if(f.m.geometry!==SLG)f.m.scale.set(s,s,s);f.m.material.opacity=1-k;if(f.t<=0){S.remove(f.m);f.m.material.dispose();FXs.splice(i,1)}}
  for(let k=0;k<N;k++)if(pl[k]>0){pl[k]-=dt;const b=k*3;vel[b+1]-=pg[k]*dt;pp[b]+=vel[b]*dt;pp[b+1]+=vel[b+1]*dt;pp[b+2]+=vel[b+2]*dt;if(pp[b+1]<0){pp[b+1]=0;vel[b+1]*=-.3}if(pl[k]<=0)pp[b+1]=-99}
  pgeo.attributes.position.needsUpdate=pgeo.attributes.color.needsUpdate=true;
  props.forEach(p=>{if(!p.on&&(p.t-=dt)<=0){p.on=1;p.m.visible=true}});
  if(P.awk>0&&Math.random()<.7)burst(P.x+rnd(-.5,.5),rnd(.2,2.4),P.z+rnd(-.5,.5),1,2,.5,CE);
  if(P.hp<=0){P.hp=P.max;pop(P,'RESPAWN','#6f6',1)}
  audioTick(dt);
}

/* ---------- audio hooks: soundtrack, loops, footsteps ---------- */
let stepT=0;
function audioTick(dt){
  Snd.music(domT>0?'music_domain':P.awk>0?'music_awaken':'music_main');   // soundtrack follows the game state
  Snd.loop('rush_slide',P.slide>0);Snd.loop('domain_ambience',domT>0);
  if(Math.hypot(P.vx,P.vz)>2&&P.y<.1&&P.stun<=0&&P.busy<=0&&!P.block){stepT-=dt;if(stepT<=0){stepT=P.awk?.28:.36;Snd.play('step')}}else stepT=0;
}

/* ---------- render ---------- */
function sync(e){
  const c=e.m,w=e===P?Math.min(1,Math.hypot(e.vx,e.vz)/6)*(e.y<.1?1:0):0;
  c.root.position.set(e.x,e.y,e.z);c.root.rotation.y=e.yaw;c.pv.rotation.x=e.rot;c.arm.rotation.x=Math.min(1,e.sw/.2)*1.5;
  c.legs[0].rotation.x=Math.sin(tick*12)*.8*w;c.legs[1].rotation.x=-c.legs[0].rotation.x;
  c.ms.forEach(x=>x.emissive.setHex(e.fl>0?0xffffff:0));c.sh.position.set(e.x,.03,e.z);c.sh.scale.setScalar(1/(1+e.y*.15));
  c.bub.visible=e===P&&(P.block>0||P.counter>0);c.bub.material.color.set(P.counter>0?0xcc99ff:0x66ccff);
}
function render(){
  sync(P);sync(D);
  const t=new V3(P.x,P.y+1.9,P.z),cp=Math.cos(pitch);
  cam.position.set(t.x+Math.sin(yaw)*cp*6.5,Math.max(.4,t.y+Math.sin(pitch)*6.5),t.z+Math.cos(yaw)*cp*6.5);
  if(shake)cam.position.add(new V3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).multiplyScalar(shake*.04));
  cam.lookAt(t);R.render(S,cam);
  const v=new V3(D.x,D.y+3.7,D.z).project(cam),dn=$('dn');
  dn.style.display=v.z<1?'block':'none';dn.style.left=(v.x+1)*50+'%';dn.style.top=(1-v.y)*50+'%';$('dh').style.width=D.hp/D.max*100+'%';
}

/* ---------- HUD ---------- */
const SL=NM[0].map((n,i)=>{const d=document.createElement('div');d.className='slot';d.innerHTML=`<b>${i+1}</b><span></span><i></i><em></em>`;$('slots').append(d);return{n:d.children[1],i:d.children[2],e:d.children[3]}});
let lm=-1;
function hud(){
  const m=P.awk>0?1:0;
  if(m!==lm){lm=m;SL.forEach((s,i)=>s.n.innerHTML=NM[m][i]+(!m&&i==2?'<br><small>USE TWICE</small>':''))}
  $('hf').style.width=P.hp/P.max*100+'%';$('mf').style.width=(m?P.awk/30*100:P.meter)+'%';
  $('mt').textContent=m?'ACTIVE':P.meter>=100?'Press G to activate':Math.floor(P.meter)+'%';
  SL.forEach((s,i)=>{const c=P.cd[off()+i];s.i.style.height=c/CDM[off()+i]*100+'%';s.e.textContent=c>0?c.toFixed(1):''});
}

/* ---------- input: mouse-look, keyboard, touch ---------- */
const look=(dx,dy,k)=>{yaw-=dx*k;pitch=Math.max(-.15,Math.min(1.2,pitch+dy*k))};
const cv=R.domElement,touchUI=matchMedia('(pointer:coarse)').matches||/touch/.test(location.search);
if(touchUI)document.body.classList.add('touch');
cv.addEventListener('mousedown',e=>{if(e.button!=0)return;if(!document.pointerLockElement&&!touchUI&&cv.requestPointerLock)cv.requestPointerLock();m1()});
addEventListener('mousemove',e=>{if(document.pointerLockElement||e.buttons)look(e.movementX,e.movementY,.0025)});
let lk=null;
cv.addEventListener('pointerdown',e=>{if(e.pointerType=='touch'&&!lk)lk={id:e.pointerId,x:e.clientX,y:e.clientY}});
cv.addEventListener('pointermove',e=>{if(lk&&e.pointerId==lk.id){look(e.clientX-lk.x,e.clientY-lk.y,.006);lk.x=e.clientX;lk.y=e.clientY}});
['pointerup','pointercancel'].forEach(n=>cv.addEventListener(n,e=>{if(lk&&e.pointerId==lk.id)lk=null}));
addEventListener('keydown',e=>{
  const k=e.key==' '?'space':e.key.toLowerCase();
  if(['space','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if(e.repeat)return;K[k]=1;
  if(k=='space')jump();else if(k=='g')awaken();else if(k=='t')dswing();else if(k.length==1&&'1234'.includes(k))skill(+k-1);
});
addEventListener('keyup',e=>{K[e.key==' '?'space':e.key.toLowerCase()]=0});
addEventListener('blur',()=>{for(const k in K)K[k]=0});

/* customizable touch layout (saved in localStorage) */
const KEY='vessel_layout';let LY={},edit=false,drag=null;
try{LY=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(LY))}catch(e){}};
const DEF={js:[.13,.72],m1:[.9,.58],jp:[.9,.8],bk:[.78,.7],b1:[.6,.58],b2:[.68,.58],b3:[.6,.8],b4:[.68,.8],g:[.5,.8],dm:[.2,.16]};
const place=(el,id,x,y)=>{el.style.left=x*100+'%';el.style.top=y*100+'%';LY[id]=[x,y]};
const home=(el,id)=>{const p=LY[id]||DEF[id];el.style.left=p[0]*100+'%';el.style.top=p[1]*100+'%'};
function bind(el,id,dn,up,mv){
  home(el,id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();el.setPointerCapture(e.pointerId);if(edit){drag=el;return}dn&&dn(e)});
  el.addEventListener('pointermove',e=>{if(edit){if(drag===el)place(el,id,e.clientX/innerWidth,e.clientY/innerHeight)}else if(mv&&el.hasPointerCapture(e.pointerId))mv(e)});
  const u=e=>{if(edit){if(drag===el){drag=null;save()}}else up&&up(e)};
  el.addEventListener('pointerup',u);el.addEventListener('pointercancel',u);
}
const kn=$('kn'),js=$('js');
const jm=e=>{const r=js.getBoundingClientRect(),Rr=r.width/2;let dx=e.clientX-r.left-Rr,dy=e.clientY-r.top-Rr;const m=Math.hypot(dx,dy);
  if(m>Rr){dx*=Rr/m;dy*=Rr/m}joy.x=m/Rr<.15?0:dx/Rr;joy.y=m/Rr<.15?0:dy/Rr;kn.style.transform=`translate(${dx}px,${dy}px)`};
const jr=()=>{joy.x=joy.y=0;kn.style.transform=''};
bind(js,'js',jm,jr,jm);
[['m1','M1',m1],['jp','JUMP',jump],['bk','BLOCK'],['b1','1',()=>skill(0)],['b2','2',()=>skill(1)],['b3','3',()=>skill(2)],['b4','4',()=>skill(3)],['g','G',awaken],['dm','DUMMY',dswing]].forEach(([id,txt,fn])=>{
  const el=document.createElement('div');el.className='tb';el.id='t_'+id;el.textContent=txt;$('touch').append(el);
  bind(el,id,()=>{el.classList.add('on');id=='bk'?K.f=1:fn()},()=>{el.classList.remove('on');if(id=='bk')K.f=0});
});
$('cust').onclick=()=>{edit=!edit;document.body.classList.toggle('edit',edit);$('cust').textContent=edit?'Done – Save':'Customize Layout';if(!edit)save();jr();K.f=0};
$('rst').onclick=()=>{LY={};try{localStorage.removeItem(KEY)}catch(e){}document.querySelectorAll('.tb').forEach(el=>home(el,el.id=='js'?'js':el.id.slice(2)))};

/* ---------- main loop ---------- */
let last=performance.now();
(function loop(now){
  let dt=Math.min(.033,(now-last)/1000);last=now;
  shake=Math.max(0,shake-70*dt);
  if(fz>0){fz-=dt;dt*=.1}
  update(dt);render();hud();requestAnimationFrame(loop);
})(last);
