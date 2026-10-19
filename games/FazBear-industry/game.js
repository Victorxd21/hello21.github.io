'use strict';
const $=i=>document.getElementById(i),T=THREE,rnd=Math.random,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const TD='ontouchstart'in window||navigator.maxTouchPoints>0;if(TD)document.body.classList.add('t');
/* ---------- renderer ---------- */
const ren=new T.WebGLRenderer({canvas:$('c')});ren.setPixelRatio(Math.min(devicePixelRatio,1.5));ren.shadowMap.enabled=!TD;ren.shadowMap.type=T.PCFSoftShadowMap;
const sc=new T.Scene(),cam=new T.PerspectiveCamera(72,1,.1,260);sc.add(cam);cam.rotation.order='YXZ';
sc.background=new T.Color(0x04060a);sc.fog=new T.FogExp2(0x080b10,.05);
const amb=new T.AmbientLight(0x2a3650,.5);sc.add(amb);
const fl=new T.SpotLight(0xfff1c8,3.6,70,.42,.7,1.1);fl.target.position.set(0,0,-1);fl.userData.on=true;fl.castShadow=!TD;fl.shadow.mapSize.set(1024,1024);fl.shadow.camera.near=.4;fl.shadow.camera.far=60;fl.shadow.bias=-.0004;cam.add(fl,fl.target);
const bg=document.createElement('canvas');bg.width=4;bg.height=64;{const g=bg.getContext('2d'),q=g.createLinearGradient(0,0,0,64);q.addColorStop(0,'rgba(255,245,200,.5)');q.addColorStop(1,'rgba(255,245,200,0)');g.fillStyle=q;g.fillRect(0,0,4,64)}
const bgeo=new T.ConeGeometry(5.2,16,28,1,true);bgeo.translate(0,-8,0);bgeo.rotateX(Math.PI/2);
const beam=new T.Mesh(bgeo,new T.MeshBasicMaterial({map:new T.CanvasTexture(bg),transparent:true,opacity:.22,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));beam.position.set(.2,-.14,-.35);cam.add(beam);
const lensM=new T.MeshBasicMaterial({color:0xfff2b0}),torch=new T.Group();{const b=new T.Mesh(new T.CylinderGeometry(.045,.05,.3,12),new T.MeshBasicMaterial({color:0x2a2a2a})),n=new T.Mesh(new T.CylinderGeometry(.07,.05,.07,12),new T.MeshBasicMaterial({color:0x555555})),l=new T.Mesh(new T.CircleGeometry(.062,12),lensM);b.rotation.x=n.rotation.x=Math.PI/2;n.position.z=-.17;l.position.z=-.206;l.rotation.y=Math.PI;torch.add(b,n,l);torch.position.set(.26,-.26,-.5);cam.add(torch)}
const rs=()=>{ren.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()};addEventListener('resize',rs);rs();
/* ---------- level ---------- */
const MC={},mat=c=>MC[c]||(MC[c]=new T.MeshStandardMaterial({color:c,roughness:.8,metalness:.25})),W=[];
function box(x,z,w,d,h,c,o={}){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat(c));m.position.set(x,(o.y||0)+h/2,z);m.castShadow=m.receiveShadow=true;sc.add(m);if(!o.ns)W.push(m.c={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,h});return m}
const wl=(a,b,c,d,col=0x3b3e3c,h=5)=>box((a+c)/2,(b+d)/2,Math.max(Math.abs(c-a),1.2),Math.max(Math.abs(d-b),1.2),h,col);
const gr=new T.Mesh(new T.PlaneGeometry(240,240),new T.MeshStandardMaterial({color:0x252a22,roughness:.35,metalness:.3}));gr.receiveShadow=true;gr.rotation.x=-Math.PI/2;sc.add(gr);
wl(-100,-100,100,-100);wl(-100,100,100,100);wl(-100,-100,-100,100);wl(100,-100,100,100);
const FC=0x4a4640;// factory shell (door gaps: south x-15..-5 = keycard door, east z-25..-15 = side exit)
wl(-50,-60,30,-60,FC,8);wl(-50,-60,-50,20,FC,8);wl(30,-60,30,-25,FC,8);wl(30,-15,30,20,FC,8);wl(-50,20,-15,20,FC,8);wl(-5,20,30,20,FC,8);
const door1=box(-10,20,10,1.2,5,0x6b5b2a),door2=box(30,-20,1.2,10,5,0x6b5b2a),door3=box(-52,40,1.2,4,5,0x2a4a6b);
box(-10,-20,80,80,.5,0x151515,{y:8,ns:1});
[[-30,-10,6,6],[-15,-32,10,4],[5,-22,4,14],[12,-42,8,6],[-35,-30,4,10],[-5,0,8,3]].forEach(([x,z,w,d])=>box(x,z,w,d,3,0x5a4a2a));
wl(-50,-46,-40,-46,FC,8);wl(-36,-60,-36,-54,FC,8);// maintenance room
wl(-86,-86,-74,-86);wl(-86,-86,-86,-74);wl(-74,-86,-74,-74);wl(-86,-74,-80,-74);wl(-76,-74,-74,-74);// generator shack
wl(-68,32,-52,32);wl(-68,48,-52,48);wl(-68,32,-68,48);wl(-52,32,-52,38);wl(-52,42,-52,48);// dispatch
wl(-27,66,-13,66);wl(-27,54,-27,66);wl(-13,54,-13,66);wl(-27,54,-22,54);wl(-18,54,-13,54);// guard station
box(65,-25,14,14,4,0x6b4a22);box(88,-10,3,25,1,0x333);box(6,72,4,2,1.5,0x2a3548);box(30,97,10,1,5,0x7a2020,{ns:1});
[[-12,-84,4,4],[12,-86,5,4],[0,-97,6,3],[35,-35,5,3],[85,-25,5,3],[50,30,5,3],[0,35,5,3],[-70,-30,5,3],[-30,-70,5,3],[80,40,5,3],[20,50,5,3]].forEach(([x,z,w,d])=>box(x,z,w,d,3,0x4a3a28));
const endo=box(50,-8,2,.7,.4,0x888888,{ns:1});[[45,-38],[85,-5],[-5,-90],[10,30]].forEach(([x,z])=>box(x,z,2,.7,.4,0x555555,{ns:1}));
const mq=[[-24,58],[-16,58],[-24,64],[-16,64],[-20,61]].map(([x,z])=>{const g=new T.Group();g.hx=x;g.position.set(x,0,z);const b=new T.Mesh(new T.BoxGeometry(.6,1.5,.4),mat(0x999590)),h=new T.Mesh(new T.SphereGeometry(.25,8,6),mat(0xbbb7b0));b.position.y=.9;h.position.y=1.9;g.add(b,h);sc.add(g);return g});
/* ---------- detail pass: ground, props, signs, animated machinery ---------- */
const cvs=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);return c},tex=c=>new T.CanvasTexture(c);
const slab=(x,z,w,d,c)=>{const m=new T.Mesh(new T.PlaneGeometry(w,d),new T.MeshStandardMaterial({color:c,roughness:.5,metalness:.2}));m.rotation.x=-Math.PI/2;m.position.set(x,.02,z);m.receiveShadow=true;sc.add(m)};
slab(0,76,76,48,0x16181b);slab(-80,-80,30,30,0x20231f);slab(65,-8,60,80,0x26292b);slab(0,-86,50,26,0x24231f);slab(-60,40,28,24,0x1f2326);slab(-20,60,26,22,0x1f2326);
for(let x=-30;x<=30;x+=6)box(x,80,.25,7,.03,0x8a8a8a,{ns:1});
const pm=new T.MeshStandardMaterial({color:0x05080c,roughness:.03,metalness:.95});for(let i=0;i<18;i++){const m=new T.Mesh(new T.CircleGeometry(1+rnd()*2.2,18),pm);m.rotation.x=-Math.PI/2;m.position.set((rnd()-.5)*180,.035,(rnd()-.5)*180);sc.add(m)}
for(let i=-100;i<=100;i+=10)[[i,-100],[i,100],[-100,i],[100,i]].forEach(([x,z])=>box(x,z,.3,.3,5.6,0x555555,{ns:1}));
const lampM=new T.MeshBasicMaterial({color:0x1a1a1a});[[65,-10],[0,-80],[-30,56],[-62,10]].forEach(([x,z])=>{box(x,z,.3,.3,6,0x2a2a2a);const h=new T.Mesh(new T.BoxGeometry(1.4,.25,.6),lampM);h.position.set(x,6.1,z);sc.add(h)});
const pipe=(x0,x1,y,z)=>{const m=new T.Mesh(new T.CylinderGeometry(.25,.25,x1-x0,8),mat(0x4a3a2a));m.rotation.z=Math.PI/2;m.position.set((x0+x1)/2,y,z);sc.add(m)};pipe(-48,-16,6,21.1);pipe(-4,28,5,21.1);pipe(-48,28,7,-60.9);
const sign=(t,x,y,z,ry,col='#d9b43c')=>{const m=new T.Mesh(new T.PlaneGeometry(2.4,1.2),new T.MeshBasicMaterial({map:tex(cvs(256,128,(g,w,h)=>{g.fillStyle='#16130a';g.fillRect(0,0,w,h);g.fillStyle=col;g.fillRect(0,0,w,12);g.fillRect(0,h-12,w,12);g.font='bold 30px Impact,Arial';g.textAlign='center';g.fillText(t,w/2,h/2+10)}))}));m.position.set(x,y,z);m.rotation.y=ry;sc.add(m)};
sign('RESTRICTED',-30,3,20.8,0);sign('AUTHORIZED ONLY',0,3,20.8,0);sign('DANGER GRINDER',65,2.5,-17.9,0,'#c33');sign('GENERATOR',-80,3,-73.3,0);sign('HIGH VOLTAGE',-73.3,3,-80,Math.PI/2,'#c33');sign('DISPATCH',-51.3,3,40,Math.PI/2);sign('SECURITY',-20,3,66.7,0);
const drum=(x,z,c)=>{const m=new T.Mesh(new T.CylinderGeometry(.5,.5,1.1,12),mat(c));m.position.set(x,.55,z);m.castShadow=m.receiveShadow=true;sc.add(m);W.push({x0:x-.5,x1:x+.5,z0:z-.5,z1:z+.5})};
[[-72,-70,0x7a2a1a],[-73.6,-70.4,0x2a4a7a],[40,-8,0x7a6a1a],[41.2,-7,0x7a2a1a],[90,-45,0x2a4a7a],[-5,-98,0x7a2a1a],[8,-80,0x7a6a1a],[-45,38,0x2a4a7a],[22,64,0x7a2a1a],[-40,-8,0x7a6a1a]].forEach(a=>drum(...a));
const grind=new T.Group();grind.position.set(65,4.3,-25);grind.add(new T.Mesh(new T.CylinderGeometry(5,5,.6,24),mat(0x3a3a3a)));for(let i=0;i<12;i++){const t=new T.Mesh(new T.BoxGeometry(1.2,.5,.5),mat(0x9a9a9a)),a=i/12*6.283;t.position.set(Math.cos(a)*4.6,.4,Math.sin(a)*4.6);t.rotation.y=-a;grind.add(t)}sc.add(grind);
const bt=tex(cvs(32,64,(g,w,h)=>{g.fillStyle='#1b1b1b';g.fillRect(0,0,w,h);g.fillStyle='#5a5a2a';for(let y=0;y<h;y+=16)g.fillRect(0,y,w,6)}));bt.wrapS=bt.wrapT=T.RepeatWrapping;bt.repeat.set(1,12);
{const m=new T.Mesh(new T.BoxGeometry(2.4,.3,24),new T.MeshStandardMaterial({map:bt,roughness:.9}));m.position.set(88,1.15,-10);sc.add(m)}
const arms=[[-20,-50],[0,-52],[-5,-8]].map(([x,z],i)=>{const b=new T.Group();b.position.set(x,0,z);const base=new T.Mesh(new T.CylinderGeometry(.9,1.1,.8,12),mat(0x7a6a1a)),a1=new T.Group(),a2=new T.Group(),u=new T.Mesh(new T.BoxGeometry(.5,3,.5),mat(0xa08a20)),f=new T.Mesh(new T.BoxGeometry(.4,2.6,.4),mat(0x8a7418)),c2=new T.Mesh(new T.BoxGeometry(.9,.25,.3),mat(0x333333));
base.position.y=.4;a1.position.y=.9;u.position.y=1.5;a2.position.y=3;f.position.y=1.3;c2.position.y=2.7;a2.add(f,c2);a1.add(u,a2);b.add(base,a1);sc.add(b);W.push({x0:x-1,x1:x+1,z0:z-1,z1:z+1});return{a1,a2}});
const spA=new Float32Array(120),spV=Array.from({length:40},()=>[0,0,0]),spk=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(spA,3)),new T.PointsMaterial({color:0xffcc66,size:.14,transparent:true,opacity:.95}));spk.frustumCulled=false;sc.add(spk);
const soft=tex(cvs(32,32,g=>{const q=g.createRadialGradient(16,16,0,16,16,16);q.addColorStop(0,'rgba(255,255,255,.6)');q.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=q;g.fillRect(0,0,32,32)}));
const SRC=[[-40,.3,22.5],[20,.3,22.5],[10,.3,-8]],stP=new Float32Array(225),stT=Array.from({length:75},()=>[rnd(),rnd()]),stm=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(stP,3)),new T.PointsMaterial({map:soft,size:1.9,transparent:true,opacity:.4,depthWrite:false,color:0xcfd8dc}));stm.frustumCulled=false;sc.add(stm);
const crtC=cvs(128,96,()=>{}),crt=crtC.getContext('2d'),crtT=tex(crtC),crtM=new T.MeshBasicMaterial({map:crtT});
const mon=(x,y,z,ry)=>{const g=new T.Group();g.position.set(x,y,z);g.rotation.y=ry;g.add(new T.Mesh(new T.BoxGeometry(1,.8,.8),mat(0x3a3a34)));const s=new T.Mesh(new T.PlaneGeometry(.8,.6),crtM);s.position.set(0,.02,.41);g.add(s);sc.add(g)};
box(-60,33.4,3,1,1,0x4a3a28,{ns:1});box(-20,64.6,3,1,1,0x4a3a28,{ns:1});mon(-60,1.4,33.1,0);mon(-20,1.4,65,Math.PI);mon(17,5.6,-55.6,0);mon(20,5.6,-55.6,0);mon(23,5.6,-55.6,0);
const beacon=new T.Mesh(new T.CylinderGeometry(.3,.3,.5,8),new T.MeshBasicMaterial({color:0xff2200}));beacon.position.set(30,5.4,96);sc.add(beacon);
let crtT0=0;const pw=()=>S.st>=2&&S.st<6||S.st>=13;
function crtDraw(){crt.fillStyle='#021208';crt.fillRect(0,0,128,96);crt.fillStyle='#3f6';crt.font='9px monospace';const L=S.st>=7?['LOCKDOWN ACTIVE','BYPASS: '+(S.st>=9?'OK':'OFFLINE'),'PROTO-01: ??','ZONE 4 SEALED']:['FACILITY STATUS','POWER: '+(pw()?'ON':'OFF'),'DECOMMISSION Q.','UNIT COUNT: 14'];L.forEach((t,i)=>crt.fillText(t,6,16+i*14));for(let i=0;i<60;i++){crt.fillStyle='rgba(80,255,120,'+rnd()*.25+')';crt.fillRect(rnd()*128,rnd()*96,rnd()*20,1)}crt.fillStyle='rgba(80,255,120,.12)';crt.fillRect(0,(clk*40)%96,128,6);crtT.needsUpdate=true}
function detail(dt){const on=pw(),fa=S.st>=11&&S.st<14;lampM.color.setHex(on?0xfff0b0:0x1a1a1a);grind.rotation.y+=dt*(on?2.5:0);bt.offset.y-=dt*(on||fa?.5:0);
arms.forEach((a,i)=>{const k=fa?1:.12;a.a1.rotation.z=Math.sin(clk*.9+i)*.5*k;a.a2.rotation.z=Math.sin(clk*1.3+i*2)*.9*k});
const wd=fa&&Math.sin(clk*3.1)>.2;for(let i=0;i<40;i++){const v=spV[i];if(!wd||spA[i*3+1]<0){spA[i*3]=-30;spA[i*3+1]=wd?1.4:-5;spA[i*3+2]=-40;v[0]=(rnd()-.5)*5;v[1]=rnd()*4;v[2]=(rnd()-.5)*5}else{v[1]-=12*dt;spA[i*3]+=v[0]*dt;spA[i*3+1]+=v[1]*dt;spA[i*3+2]+=v[2]*dt}}spk.geometry.attributes.position.needsUpdate=true;
for(let i=0;i<75;i++){const t=stT[i];t[0]+=dt*(.5+t[1]*.5);if(t[0]>1)t[0]=0;const o=SRC[i%3];stP[i*3]=o[0]+Math.sin(clk+i)*.4*t[0];stP[i*3+1]=o[1]+t[0]*3.2;stP[i*3+2]=o[2]}stm.geometry.attributes.position.needsUpdate=true;
red[0].intensity=S.st>=7?1.4+1.4*Math.sin(clk*6):0;beacon.visible=S.st>=7;beacon.rotation.y+=dt*6;if((crtT0-=dt)<=0){crtT0=.12;crtDraw()}}
/* ---------- second floor control room: raised platform + stairs ---------- */
const gY=(x,z)=>x>=22&&x<=26&&z<=-40&&z>=-48?4*(-40-z)/8:(x>=14&&x<=29&&z>=-59&&z<=-48?4:0);
box(21.5,-53.5,15,11,.4,0x3a3d40,{y:3.6,ns:1});wl(14,-48,22,-48,0x3a3d40,4);wl(26,-48,29,-48,0x3a3d40,4);wl(14,-59,14,-48,0x3a3d40,4);wl(29,-59,29,-48,0x3a3d40,4);
wl(22,-48,22,-40,0x777777,1.2);wl(26,-48,26,-40,0x777777,1.2);for(let i=0;i<8;i++)box(24,-40.5-i,4,1,(i+1)*.5,0x555a5e,{ns:1});
box(20,-57,6,2,1.2,0x2a2f33,{y:4});box(14.4,-53.5,.1,10,1,0x88aacc,{y:4.4,ns:1});
/* ---------- ventilation network (crawl space, low ceiling) ---------- */
const inV=(x,z)=>x>-93&&x<-53&&z>-40&&z<-19,VC=0x3a3f44;
wl(-93,-19,-53,-19,VC,1.5);wl(-93,-40,-53,-40,VC,1.5);wl(-93,-40,-93,-19,VC,1.5);wl(-53,-40,-53,-19,VC,1.5);
wl(-89,-23.2,-53,-23.2,VC,1.5);wl(-93,-27.4,-57,-27.4,VC,1.5);wl(-89,-31.6,-53,-31.6,VC,1.5);wl(-93,-35.8,-57,-35.8,VC,1.5);
const VP=[[-56,-21.1],[-90,-21.1],[-90,-25.3],[-56,-25.3],[-56,-29.5],[-90,-29.5],[-90,-33.7],[-56,-33.7],[-56,-37.9],[-90,-37.9]];
box(-73,-29.5,42,23,.3,0x222426,{y:1.5,ns:1});slab(-73,-29.5,40,22,0x2a2a2e);
{const vm=new T.MeshBasicMaterial({color:0xff7a1a});VP.forEach((q,i)=>{const l=new T.Mesh(new T.BoxGeometry(1.6,.05,.2),vm);l.position.set(q[0]+(i%2?3:-3),1.4,q[1]);sc.add(l)});const g=new T.Mesh(new T.BoxGeometry(.2,2.4,2.4),new T.MeshBasicMaterial({color:0x223344}));g.position.set(-49.7,1.2,-30);sc.add(g)}
const d4=[box(-38,-46,4.4,1.2,5,0x4a4a4a),box(-36,-50,1.2,8.6,5,0x4a4a4a)];
const PL=(c,i,d,x,y,z)=>{const l=new T.PointLight(c,i,d);l.position.set(x,y,z);sc.add(l);return l};
const flood=[[65,6,-10],[0,6,-80],[-30,6,56],[-62,6,10]].map(p=>PL(0xffe0a0,0,45,...p));
const red=[[30,5,88],[20,5,-30]].map(p=>PL(0xff2010,0,30,...p));
const fac=[[-30,6,-10],[10,6,-35],[-35,6,-40]].map(p=>PL(0xcfe8ff,0,32,...p));
/* rain: world-space streaks that wrap around the player (not glued to the camera), none indoors */
const N=2600,RR=30,rd=new Float32Array(N*3),rp=new Float32Array(N*6);for(let i=0;i<N;i++){rd[i*3]=(rnd()-.5)*2*RR;rd[i*3+1]=rnd()*22;rd[i*3+2]=(rnd()-.5)*2*RR}
const rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(rp,3));
const rain=new T.LineSegments(rg,new T.LineBasicMaterial({color:0x9fb6cc,transparent:true,opacity:.34}));rain.frustumCulled=false;sc.add(rain);
const wrap=(v,c)=>((v-c+RR)%(2*RR)+2*RR)%(2*RR)-RR+c,IN=[[-50,30,-60,20],[-86,-74,-86,-74],[-68,-52,32,48],[-27,-13,54,66],[-93,-53,-40,-19]];
function rainUpdate(dt){for(let i=0;i<N;i++){const k=i*3;let y=rd[k+1]-40*dt,x=rd[k]-5*dt,z=rd[k+2];if(y<0){y+=22;x+=(rnd()-.5)*3;z+=(rnd()-.5)*3}x=wrap(x,P.x);z=wrap(z,P.z);rd[k]=x;rd[k+1]=y;rd[k+2]=z;
const ind=IN.some(r=>x>r[0]&&x<r[1]&&z>r[2]&&z<r[3]),q=i*6,yy=ind?-90:y;rp[q]=x;rp[q+1]=yy;rp[q+2]=z;rp[q+3]=x+.14;rp[q+4]=yy+.9;rp[q+5]=z}rg.attributes.position.needsUpdate=true}
/* hands */
const hands=[-1,1].map(s=>{const h=new T.Mesh(new T.BoxGeometry(.12,.1,.3),new T.MeshBasicMaterial({color:0x2a2418}));h.position.set(.25*s,-.32,-.55);cam.add(h);return h});
/* PROTO-01 model */
const E=new T.Group(),mm=mat(0x8d9094),dk=mat(0x2b2d30),HD=new T.Group(),ARM=new T.Group();
const part=(g,w,h,d,x,y,z,m=mm)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o)};
part(E,.9,1.2,.5,0,1.8,0);const LG=[-.25,.25].map(x=>{const g=new T.Group();g.position.set(x,1.2,0);part(g,.25,1.2,.25,0,-.6,0,dk);part(g,.1,.7,.1,.17*Math.sign(x),-.5,.1,mat(0xc0c0c0));part(g,.34,.2,.46,0,-1.15,.08);E.add(g);return g});
for(let i=0;i<4;i++)part(E,1,.06,.55,0,1.4+i*.28,0,dk);part(E,.08,1.5,.08,0,1.8,-.3,dk);part(E,.07,.8,.07,-.45,2.0,.2,mat(0xc0c0c0));part(E,.07,.8,.07,.45,2.0,.2,mat(0xc0c0c0));part(E,.5,.1,.5,0,1.15,0,dk);part(E,.15,1.1,.15,-.65,1.9,0);part(E,.5,.3,.4,0,2.5,0,dk);
HD.position.set(0,2.85,0);part(HD,.5,.55,.45,0,0,0);E.add(HD);
const em=new T.MeshBasicMaterial({color:0xffffff,fog:false});[-.12,.12].forEach(x=>{const s=new T.Mesh(new T.SphereGeometry(.055,8,6),em);s.position.set(x,.05,.24);HD.add(s)});
const EL=new T.PointLight(0xffffff,.9,12);EL.position.set(0,.05,.4);HD.add(EL);
ARM.position.set(.65,2.35,0);part(ARM,.15,1.2,.15,0,-.6,0);const disc=new T.Mesh(new T.CylinderGeometry(.32,.32,.05,16),mat(0xb0b0b0));disc.position.set(0,-1.25,0);disc.rotation.z=Math.PI/2;ARM.add(disc);E.add(ARM);E.visible=false;E.rotation.order='YXZ';sc.add(E);
/* ---------- state ---------- */
const S0=()=>({st:0,cord:0,vl:[0,0,0],il:[0,0,0],tl:[0,0,0],pl:[0,0,0],fb:[0,0,0],dOpen:0,sp:0,card:0,cog:0,inst:0,tab:0});
let ventAlert=0,alarmT=0,ck=20,tabView=0,S=S0(),cp=null,mode='menu',clk=0,shake=0,hk=0,hd=.45,pc=0,pl=0,lit=0,tt=20,pt=0,mqT=0,sT=0,tabOpen=false,tobj=0;
const P={gy:0,x:0,z:66,yaw:0,pitch:0,vx:0,vz:0,stam:100,cr:0,h:1.7,ph:0,bob:0,nz:0};
const e={ws:0,x:0,z:0,st:'dormant',t:0,wi:0,last:[0,0],fl:0,after:0,stk:0,lost:0,det:0,dp:[0,0],ang:0,sc:0,first:0};
const WO=[[45,-32],[40,25],[10,50],[-30,42],[-62,-5],[-40,-75],[16,-78],[75,45]],WI=[[-35,-5],[0,-12],[20,-35],[-28,-38],[8,10],[-12,-25]];
const WP=()=>S.st>=11&&S.st<14?WI:WO,dist=(x,z)=>Math.hypot(P.x-x,P.z-z);
const OB=['','Restore power — generator shack','Find the grinder control panel','Recover the missing tools — storage yard','Hang the tools on the shadow board','Investigate the crash — storage yard','RUN — reach the main gate!','Collect 3 security fobs — scrap yard','Unlock the dispatch office & fix the circuit','Retrieve the keycard — security station','Swipe the keycard at the factory door','Find the vent shaft (factory west wall) and crawl to the maintenance room','Install the cog at the control console','ESCAPE — side exit!'];
const TG=[0,[-80,-80],[65,-14],[0,-88],[65,-3],[0,-80],[30,90],[65,-30],[-58,40],[-20,60],[-10,20],[-47,-30],[20,-54],[34,-20]];
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
if(dc){const pi=dc.i|0;dc.i+=dt*45;if((dc.i|0)!=pi&&(dc.i|0)%3==0&&AC&&dc.i<dc.t.length)tone(180+rnd()*60,.04,'square',.04,dv);$('txt').textContent=dc.t.slice(0,dc.i|0);if(dc.i>=dc.t.length){dc.h-=dt;if(dc.h<=0)dc=null}}
if(!dc&&!dq.length){$('who').textContent='';$('txt').textContent=''}}
const toast=t=>{const o=$('toast');o.textContent=t;o.style.opacity=1;clearTimeout(toast.t);toast.t=setTimeout(()=>o.style.opacity=0,2200)};
/* ---------- audio (procedural) ---------- */
let AC,mg,NB,rgn,hg,sv,pn,svo,sx,ab,dv,rvg,gdr,alm,alg;
function initA(){if(AC){AC.resume&&AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(_){return}
const G=()=>AC.createGain();mg=G();mg.connect(AC.destination);ab=G();ab.connect(mg);sx=G();sx.connect(mg);dv=G();dv.connect(mg);
NB=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=rnd()*2-1;
const L=AC.sampleRate*2,ib=AC.createBuffer(2,L,AC.sampleRate);for(let c=0;c<2;c++){const q=ib.getChannelData(c);for(let i=0;i<L;i++)q[i]=(rnd()*2-1)*Math.pow(1-i/L,3)}
const cvr=AC.createConvolver();cvr.buffer=ib;rvg=G();rvg.gain.value=.05;sx.connect(rvg);rvg.connect(cvr);cvr.connect(mg);
const ns=AC.createBufferSource();ns.buffer=NB;ns.loop=true;const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=2800;rgn=G();ns.connect(bp);bp.connect(rgn);rgn.connect(ab);ns.start();
const h=AC.createOscillator();h.frequency.value=50;hg=G();h.connect(hg);hg.connect(ab);h.start();
svo=AC.createOscillator();svo.type='sawtooth';sv=G();sv.gain.value=0;pn=AC.createStereoPanner();svo.connect(sv);sv.connect(pn);pn.connect(sx);svo.start();
const go_=AC.createOscillator();go_.type='sawtooth';go_.frequency.value=42;const lp2=AC.createBiquadFilter();lp2.type='lowpass';lp2.frequency.value=160;gdr=G();gdr.gain.value=0;go_.connect(lp2);lp2.connect(gdr);gdr.connect(ab);go_.start();
alm=AC.createOscillator();alm.type='square';alg=G();alg.gain.value=0;alm.connect(alg);alg.connect(sx);alm.start();setVols()}
function setVols(){if(!AC)return;mg.gain.value=+$('vol').value;ab.gain.value=+$('volA').value;sx.gain.value=+$('volS').value;dv.gain.value=+$('volD').value}
function burst(f,d,g,ty,bus=sx){if(!AC)return;const s=AC.createBufferSource(),fi=AC.createBiquadFilter(),ga=AC.createGain(),n=AC.currentTime;s.buffer=NB;fi.type=ty;fi.frequency.value=f;ga.gain.setValueAtTime(g,n);ga.gain.exponentialRampToValueAtTime(.001,n+d);s.connect(fi);fi.connect(ga);ga.connect(bus);s.start();s.stop(n+d)}
function tone(f,d,ty,g,bus=sx){if(!AC)return;const o=AC.createOscillator(),ga=AC.createGain(),n=AC.currentTime;o.type=ty;o.frequency.value=f;ga.gain.setValueAtTime(g,n);ga.gain.exponentialRampToValueAtTime(.001,n+d);o.connect(ga);ga.connect(bus);o.start();o.stop(n+d)}
function snd(t,v=1){if(t=='step'){if(inV(P.x,P.z)){burst(1400,.12,.15,'bandpass');return}const f=P.x>-50&&P.x<30&&P.z>-60&&P.z<20;burst(f?900:rnd()<.3?1800:350,f?.09:.07,.25*v,f?'bandpass':'lowpass');if(f)tone(220,.05,'square',.03*v)}else if(t=='click')tone(900,.04,'square',.12);
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
it(-47,-30,'Enter ventilation shaft',()=>S.st==11&&!S.cog&&!inV(P.x,P.z),()=>{P.x=-56;P.z=-21.1;P.yaw=Math.PI/2;P.pitch=0;P.vx=P.vz=0;TG[11]=[-90,-37.9];ventAlert=0;toast('Crawl quietly. Hold Shift to scramble — it is LOUD.');snd('metal')},0x66ccff);
it(-90,-37.9,'Climb out into the maintenance room',()=>S.st==11&&!S.cog&&inV(P.x,P.z),()=>{P.x=-44;P.z=-52;P.yaw=0;P.vx=P.vz=0;TG[11]=[-44,-54];if(e.st=='vent'){e.x=-47;e.z=-30;setSt('investigate',8);e.last=[-45,-40]}mkSave();snd('metal')},0x66ccff);
it(20,-54,()=>S.inst?'Activate gate override':'Install control cog',()=>S.st==12,()=>{if(!S.inst){S.inst=1;hand(.8);snd('metal');toast('Cog installed. Console online.')}else{go(13);say(D.final);snd('beep',1200);lit=1}},0xff4444,5.1);
/* ---------- progression / saves ---------- */
const CPS=[1,3,5,7,9,11,13];
function sync(){const s=S.st,fo=s>=2&&s<6;flood.forEach(l=>l.intensity=fo?2:0);red.forEach(l=>l.intensity=s>=7?2:0);sc.fog.density=fo?.03:.05;
const op=(d,v)=>{d.visible=!v;d.c.off=!!v};op(door1,s>=11);op(door2,s>=13);op(door3,S.dOpen);d4.forEach(d=>op(d,S.cog||s>=12));endo.visible=s<5}
function go(n){S.st=n;sync();if([6,7,11,13].includes(n))placeE();if(CPS.includes(n))mkSave();$('obj').textContent=OB[n]}
function mkSave(){cp={S:JSON.parse(JSON.stringify(S)),x:P.x,z:P.z,yaw:P.yaw};try{localStorage.setItem('fb_cp',JSON.stringify(cp))}catch(_){}toast('Checkpoint saved')}
const getSave=()=>{try{return JSON.parse(localStorage.getItem('fb_cp'))}catch(_){return null}};
function loadCP(c){S=JSON.parse(JSON.stringify(c.S));P.x=c.x;P.z=c.z;P.yaw=c.yaw;P.pitch=0;P.vx=P.vz=0;tabOpen=false;P.gy=gY(P.x,P.z);TG[11]=P.x<-36&&P.x>-50&&P.z<-46&&P.z>-60?[-44,-54]:[-47,-30];K.ShiftLeft=K.KeyC=0;syncBtns();mkx.clearRect(0,0,MW,MW);[[1,0,75],[2,-80,-80],[3,65,-15],[4,0,-86],[8,-60,40],[9,-20,60],[11,-10,-20]].forEach(([q,x,z])=>S.st>=q&&revealAt(x,z,90));sync();placeE();clrSay();$('obj').textContent=OB[S.st]}
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
case'vent':{let pi=0,bd=1e9;VP.forEach((q,i)=>{const dd=Math.hypot(q[0]-P.x,q[1]-P.z);if(dd<bd){bd=dd;pi=i}});if(!inV(P.x,P.z)){e.x=-47;e.z=-30;setSt('return');break}
let tx=P.x,tz=P.z;if(e.vi<pi){tx=VP[e.vi+1][0];tz=VP[e.vi+1][1]}else if(e.vi>pi){tx=VP[e.vi-1][0];tz=VP[e.vi-1][1]}
const vx=tx-e.x,vz=tz-e.z,vl=Math.hypot(vx,vz)||1;e.x+=vx/vl*2.7*dt;e.z+=vz/vl*2.7*dt;e.ang=Math.atan2(vz,vx);if(vl<.6&&e.vi!=pi)e.vi+=e.vi<pi?1:-1;break}
case'return':{const w=WP();if(go2(w[e.wi%w.length],3,dt))setSt('patrol');if(see)setSt('detect',.6);break}}
const mvd=Math.hypot(e.x-ox,e.z-oz);e.ws+=mvd;e.sc+=mvd;if(e.sc>2.2){e.sc=0;burst(110,.25,cl(1-d/40,0,1)*.9,'lowpass')}}
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
if(TD&&K.ShiftLeft&&P.stam<=4){K.ShiftLeft=0;syncBtns()}const iv=inV(P.x,P.z),scr=iv&&(K.ShiftLeft||K.ShiftRight)&&l>.1;P.cr=iv||K.ControlLeft||K.KeyC?1:0;const run=!iv&&(K.ShiftLeft||K.ShiftRight)&&P.stam>4&&l>.1&&!P.cr,sp=iv?(scr?3.2:2):P.cr?1.8:run?6.4:4;
P.stam=cl(P.stam+(run?-20:12)*dt,0,100);const k=Math.min(1,dt*8);P.vx+=(dx*sp-P.vx)*k;P.vz+=(dz*sp-P.vz)*k;
const nx=P.x+P.vx*dt,nz=P.z+P.vz*dt;if(!hit(nx,P.z,.5))P.x=nx;if(!hit(P.x,nz,.5))P.z=nz;
P.run=run;const v=Math.hypot(P.vx,P.vz);P.nz=scr&&v>.4?.6:run?1:v>.4?(P.cr?.12:.45):0;P.h+=((iv?.75:P.cr?1:1.7)-P.h)*Math.min(1,dt*8);P.gy+=(gY(P.x,P.z)-P.gy)*Math.min(1,dt*14);
P.bob+=v*dt;if(P.bob>(run?1.6:2.3)){P.bob=0;snd('step',run?1.2:.7)}}
function nearest(){let b=null,bd=1e9;const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);for(const o of I){if(!o.ok())continue;const dx=o.x-P.x,dz=o.z-P.z,d=Math.hypot(dx,dz);if(d<o.r&&d<bd&&(d<1.5||(dx*fx+dz*fz)/d>.35)){b=o;bd=d}}return b}
const lb=o=>typeof o.lab=='function'?o.lab():o.lab;
function use(){const o=nearest();if(o){hand();o.act()}}
function items(dt){const o=nearest();$('prompt').textContent=o?(TD?'Tap E: ':'[E] ')+lb(o):'';for(const q of I){q.m.visible=q.ok();q.m.rotation.y+=dt}
tobj-=dt;if(tobj<=0){tobj=.5;const g=TG[S.st];if(g)$('obj').textContent=OB[S.st]+' ['+Math.round(dist(g[0],g[1]))+'m]'}}
function trig(dt){const s=S.st;if(s==11&&!S.cog&&inV(P.x,P.z)&&e.st!='vent'){let pi=0,bd=1e9;VP.forEach((q,i)=>{const dd=Math.hypot(q[0]-P.x,q[1]-P.z);if(dd<bd){bd=dd;pi=i}});ventAlert=P.nz>.4&&pi>=3?ventAlert+dt:Math.max(0,ventAlert-dt*.5);if(ventAlert>1.5){ventAlert=0;e.x=VP[0][0];e.z=VP[0][1];e.vi=0;setSt('vent');toast('Something is crawling in the vents…')}}
if(s==5&&dist(0,-80)<8){go(6);say(D.dark)}if(s==6&&dist(30,90)<6){go(7);say(D.lock);snd('buzz');alarmT=6}if(s==13&&dist(34,-20)<3)win();
if(s==9||s==10){mqT-=dt;if(mqT<0){mqT=2+rnd()*3;const m=mq[rnd()*mq.length|0],dx=m.position.x-P.x,dz=m.position.z-P.z,d=Math.hypot(dx,dz)||1;if((dx*-Math.sin(P.yaw)+dz*-Math.cos(P.yaw))/d<.2){m.rotation.y=rnd()*6.28;m.position.x=m.hx+(rnd()-.5)*1.2}}}}
function amb2(dt){if(!AC)return;const inF=P.x>-50&&P.x<30&&P.z>-60&&P.z<20;rgn.gain.value=inF?.04:.12;hg.gain.value=(S.st>=2&&S.st<6||S.st>=13)?.07:.015;gdr.gain.value=pw()?cl(1-Math.hypot(P.x-65,P.z+25)/45,0,1)*.35:0;rvg.gain.value=inF?.45:.05;if(alarmT>0){alarmT-=dt;alm.frequency.value=520+300*Math.sin(clk*4);alg.gain.value=.08}else alg.gain.value=0;if((ck-=dt)<=0){ck=18+rnd()*25;tone(160+rnd()*60,1.4,'sawtooth',.05);burst(220,.5,.4,'lowpass')}
const ex=e.x-P.x,ez=e.z-P.z,d=Math.hypot(ex,ez)||1,on=e.st!='dormant'&&E.visible;sv.gain.value=on?cl(1-d/45,0,1)*.2:0;pn.pan.value=cl((ex*Math.cos(P.yaw)-ez*Math.sin(P.yaw))/d,-1,1);
svo.frequency.value=70+(e.st=='hunt'?60:0)+Math.sin(clk*5)*10;if(e.st=='hunt'&&(pt-=dt)<=0){pt=.55;tone(55,.25,'sine',.5)}
if((tt-=dt)<=0){tt=15+rnd()*25;snd('thunder');lit=1}}
/* ---------- tablet: detailed blueprint map + CCTV feeds ---------- */
const MW=600,MS=MW/210,mx=$('map').getContext('2d'),mk=cvs(MW,MW,()=>{}),ml=cvs(MW,MW,()=>{}),mb=cvs(MW,MW,()=>{});
const mlx=ml.getContext('2d'),mkx=mk.getContext('2d'),mbx=mb.getContext('2d'),mp=(x,z)=>[(x+105)*MS,(z+105)*MS];
const ZN=[[-40,50,55,100,'#1c3a2c','FRONT LOT'],[-90,-70,-90,-70,'#12403f','POWER / GENERATOR'],[45,95,-45,25,'#27402a','SCRAP CONTAINMENT YARD'],[-22,25,-100,-72,'#3a3320','STORAGE YARD'],[-50,30,-60,20,'#3a2250','MAIN FACTORY FLOOR'],[-68,-52,32,48,'#1d3252','DISPATCH OFFICE'],[-27,-13,54,66,'#1d3252','GUARD STATION'],[-50,-36,-60,-46,'#5a2020','MAINTENANCE'],[58,72,-32,-18,'#5a3a15','GRINDER'],[14,29,-59,-48,'#2a2a60','2F CONTROL RM'],[-93,-53,-40,-19,'#0f3a4a','VENTILATION']];
const CAMS=[['CAM 01 — PARKING LOT',[14,5,88],[0,0,64]],['CAM 02 — SCRAP YARD',[45,6,10],[75,0,-5]],['CAM 03 — GRINDER AREA',[52,7,-40],[65,1,-22]],['CAM 04 — STORAGE YARD',[-22,6,-74],[0,0,-90]],['CAM 05 — FACTORY FLOOR',[-45,7,15],[-10,0,-25]]];
const cc=new T.PerspectiveCamera(60,4/3,.1,200),ir=new T.PointLight(0xaaffcc,0,70);sc.add(ir);
const badge=(g,x,z,t,c)=>{const[a,b]=mp(x,z);g.fillStyle='#000b';g.beginPath();g.arc(a,b,8,0,7);g.fill();g.strokeStyle=c;g.lineWidth=2;g.stroke();g.fillStyle=c;g.font='bold 11px monospace';g.textAlign='center';g.fillText(t,a,b+4);g.textAlign='left'};
function layer(g){g.clearRect(0,0,MW,MW);
ZN.forEach(([x0,x1,z0,z1,c])=>{const[a,b]=mp(x0,z0),[a2,b2]=mp(x1,z1);g.fillStyle=c;g.fillRect(a,b,a2-a,b2-b);g.strokeStyle='#8fd0ff66';g.lineWidth=1;g.strokeRect(a,b,a2-a,b2-b)});
g.strokeStyle='#4a7a9a26';g.lineWidth=1;for(let i=-100;i<=100;i+=10){let[a,b]=mp(i,-100),[c,d]=mp(i,100);g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.stroke();[a,b]=mp(-100,i);[c,d]=mp(100,i);g.beginPath();g.moveTo(a,b);g.lineTo(c,d);g.stroke()}
g.setLineDash([7,5]);g.strokeStyle='#d9b43caa';g.lineWidth=2;g.beginPath();[[0,66],[-10,48],[-40,30],[-62,0],[-72,-40],[-80,-72]].forEach(([x,z],i)=>{const[a,b]=mp(x,z);i?g.lineTo(a,b):g.moveTo(a,b)});g.stroke();g.setLineDash([]);
for(const w of W){if(w.off)continue;const[a,b]=mp(w.x0,w.z0),ww=(w.x1-w.x0)*MS,hh=(w.z1-w.z0)*MS,wall=w.h>=5;g.fillStyle=wall?'#b7cfc2':'#6b7d70';g.fillRect(a,b,ww,hh);g.strokeStyle='#0009';g.lineWidth=1;g.strokeRect(a,b,ww,hh);if(!wall&&ww>6&&hh>6){g.strokeStyle='#ffffff30';g.beginPath();g.moveTo(a,b);g.lineTo(a+ww,b+hh);g.moveTo(a+ww,b);g.lineTo(a,b+hh);g.stroke()}}
[door1,door2,door3].forEach(d=>{if(d.visible){const[a,b]=mp(d.c.x0,d.c.z0);g.fillStyle='#f90';g.fillRect(a-2,b-2,(d.c.x1-d.c.x0)*MS+4,(d.c.z1-d.c.z0)*MS+4)}});
g.font='bold 10px monospace';g.textAlign='center';ZN.forEach(([x0,x1,z0,z1,c,n])=>{const[a,b]=mp((x0+x1)/2,(z0+z1)/2);g.lineWidth=3;g.strokeStyle='#000';g.strokeText(n,a,b);g.fillStyle='#e8d070';g.fillText(n,a,b)});g.textAlign='left';
[['G',-80,-80,'#fd3'],['K',-20,62,'#3cf'],['X',34,-20,'#4f6'],['C',-44,-54,'#f93'],['T',65,-3,'#fa6'],['V',-47,-30,'#6ef']].forEach(([t,x,z,c])=>badge(g,x,z,t,c));
CAMS.forEach((c,i)=>badge(g,c[1][0],c[1][2],''+(i+1),'#6ef'))}
let mbKey='';function revealAt(x,z,r=70){const[a,b]=mp(x,z),q=mkx.createRadialGradient(a,b,r*.4,a,b,r);q.addColorStop(0,'#fff');q.addColorStop(.75,'#fff');q.addColorStop(1,'#fff0');mkx.fillStyle=q;mkx.fillRect(a-r,b-r,r*2,r*2)}
const explore=()=>revealAt(P.x,P.z);
const ic=$('ic'),ix=ic.getContext('2d');let itT=0;
function drawIntro(dt){itT+=dt;const t=itT;if(ic.width!=(innerWidth/2|0)){ic.width=innerWidth/2|0;ic.height=innerHeight/2|0}const w=ic.width,h=ic.height,k=dq.length+(dc?1:0),idx=D.intro.length-k;let g;
ix.fillStyle='#050608';ix.fillRect(0,0,w,h);
if(idx<9){ix.save();ix.translate(-Math.min(t*3,50),0);
g=ix.createLinearGradient(0,0,0,h*.6);g.addColorStop(0,'#0f1e2c');g.addColorStop(1,'#243a4e');ix.fillStyle=g;ix.fillRect(w*.08,h*.12,w*.3,h*.42);
ix.strokeStyle='rgba(180,210,240,.45)';ix.lineWidth=1;for(let i=0;i<46;i++){const x=w*.08+((i*37)%(w*.3)),y=h*.12+((i*53+t*210)%(h*.42));ix.beginPath();ix.moveTo(x,y);ix.lineTo(x-1,y+9);ix.stroke()}
ix.strokeStyle='#08090b';ix.lineWidth=6;ix.strokeRect(w*.08,h*.12,w*.3,h*.42);ix.beginPath();ix.moveTo(w*.23,h*.12);ix.lineTo(w*.23,h*.54);ix.moveTo(w*.08,h*.33);ix.lineTo(w*.38,h*.33);ix.stroke();
ix.fillStyle='#14110e';ix.fillRect(0,h*.72,w*1.2,h*.3);ix.fillStyle='#2a1f14';ix.fillRect(w*.45,h*.62,w*.5,h*.1);
const fk=.8+.2*Math.sin(t*23)*(Math.sin(t*3)>.8?1:.3);g=ix.createRadialGradient(w*.62,h*.5,4,w*.62,h*.55,h*.7);g.addColorStop(0,'rgba(255,200,110,'+.5*fk+')');g.addColorStop(1,'rgba(255,200,110,0)');ix.fillStyle=g;ix.fillRect(0,0,w*1.2,h);
ix.fillStyle='#d8d2bc';[[.5,.58],[.56,.585],[.62,.575]].forEach(([a,b],i)=>{ix.save();ix.translate(w*a,h*b);ix.rotate(i*.2-.1);ix.fillRect(0,0,w*.05,h*.05);ix.fillStyle='#a33';ix.fillRect(2,2,w*.03,2);ix.fillStyle='#d8d2bc';ix.restore()});
ix.fillStyle='#0c0c0e';ix.fillRect(w*.9,h*.2,w*.07,h*.4);ix.beginPath();ix.arc(w*.935,h*.2,w*.04,0,7);ix.fill();
ix.fillStyle='#1a120a';ix.fillRect(w*.3,h*.88,w*.07,h*.05);ix.fillRect(w*.38,h*.88,w*.07,h*.05);ix.fillStyle='#5a2a1a';ix.fillRect(w*.7,h*.76,w*.12,h*.08);
const on=idx>=6;ix.fillStyle=on?'rgba(120,180,255,'+(.6+.4*Math.sin(t*9))+')':'#111';ix.fillRect(w*.78,h*.595,w*.03,h*.045);
if(on){g=ix.createRadialGradient(w*.795,h*.6,2,w*.795,h*.6,h*.2);g.addColorStop(0,'rgba(120,180,255,.35)');g.addColorStop(1,'rgba(120,180,255,0)');ix.fillStyle=g;ix.fillRect(0,0,w*1.2,h)}
ix.restore()}
else{g=ix.createLinearGradient(0,0,0,h);g.addColorStop(0,'#0a1018');g.addColorStop(.5,'#141c24');g.addColorStop(1,'#05070a');ix.fillStyle=g;ix.fillRect(0,0,w,h);
const hz=h*.45;ix.fillStyle='#1b1e22';ix.beginPath();ix.moveTo(w*.46,hz);ix.lineTo(w*.54,hz);ix.lineTo(w*.95,h*.8);ix.lineTo(w*.05,h*.8);ix.fill();
ix.strokeStyle='#cbb35a';ix.lineWidth=2;for(let i=0;i<8;i++){const p=((i/8+t*.35)%1),y=hz+(h*.8-hz)*p*p,len=4+30*p*p;ix.beginPath();ix.moveTo(w*.5,y);ix.lineTo(w*.5,y+len);ix.stroke()}
if(idx>=12){g=ix.createLinearGradient(0,hz-h*.12,0,hz+4);g.addColorStop(0,'#0b0d10');g.addColorStop(1,'#1a2229');ix.fillStyle=g;ix.fillRect(w*.58,hz-h*.12,w*.3,h*.12);ix.fillRect(w*.62,hz-h*.2,w*.03,h*.1);g=ix.createLinearGradient(0,hz-h*.2,0,hz+10);g.addColorStop(0,'rgba(120,140,150,0)');g.addColorStop(1,'rgba(120,140,150,.45)');ix.fillStyle=g;ix.fillRect(w*.5,hz-h*.25,w*.5,h*.3)}
g=ix.createRadialGradient(w*.5,h*.8,10,w*.5,hz,h*.5);g.addColorStop(0,'rgba(255,240,200,.22)');g.addColorStop(1,'rgba(255,240,200,0)');ix.fillStyle=g;ix.fillRect(0,0,w,h);
ix.strokeStyle='rgba(190,215,240,.5)';ix.lineWidth=1;for(let i=0;i<90;i++){const x=(i*61)%w,y=((i*43)+t*260)%h;ix.beginPath();ix.moveTo(x,y);ix.lineTo(x-2,y+10);ix.stroke()}
const a=Math.sin(t*2.2)*.9;ix.strokeStyle='#050505';ix.lineWidth=5;ix.beginPath();ix.moveTo(w*.62,h*.9);ix.lineTo(w*.62+Math.sin(a)*h*.55,h*.9-Math.cos(a)*h*.55);ix.stroke();
ix.fillStyle='#07080a';ix.fillRect(0,h*.86,w,h*.14);ix.beginPath();ix.moveTo(0,h*.86);ix.quadraticCurveTo(w*.5,h*.8,w,h*.86);ix.lineTo(w,h);ix.lineTo(0,h);ix.fill();
ix.fillStyle='#0c2a1a';ix.fillRect(w*.42,h*.89,w*.16,h*.07);if(idx>=11){ix.fillStyle=Math.sin(t*5)>0?'#3f6':'#143';ix.font='10px monospace';ix.textAlign='center';ix.fillText(idx>=12?'NO SIGNAL':'GPS',w*.5,h*.935);ix.textAlign='left'}
if(idx>=14){ix.fillStyle='rgba(0,0,0,'+Math.min(.85,(idx-13)*.6)+')';ix.fillRect(0,0,w,h)}}}
function drawMap(){const k=S.st+'|'+S.dOpen;if(k!=mbKey){mbKey=k;layer(mbx)}
mx.fillStyle='#04121a';mx.fillRect(0,0,MW,MW);mx.globalAlpha=.1;mx.drawImage(mb,0,0);mx.globalAlpha=1;
mlx.globalCompositeOperation='source-over';mlx.clearRect(0,0,MW,MW);mlx.drawImage(mb,0,0);mlx.globalCompositeOperation='destination-in';mlx.drawImage(mk,0,0);mx.drawImage(ml,0,0);
const g=TG[S.st];if(g){const[a,b]=mp(g[0],g[1]),pr=9+4*Math.sin(clk*5);mx.strokeStyle='#fd3';mx.lineWidth=2;mx.beginPath();mx.arc(a,b,pr,0,7);mx.stroke();mx.fillStyle='#fd3';mx.font='18px monospace';mx.fillText('★',a-7,b+6)}
const[a,b]=mp(P.x,P.z);mx.save();mx.translate(a,b);mx.rotate(-P.yaw);const q=mx.createLinearGradient(0,0,0,-60);q.addColorStop(0,'#5f88');q.addColorStop(1,'#5f80');mx.fillStyle=q;mx.beginPath();mx.moveTo(0,0);mx.lineTo(-24,-60);mx.lineTo(24,-60);mx.fill();mx.fillStyle='#3f6';mx.beginPath();mx.moveTo(0,-9);mx.lineTo(7,7);mx.lineTo(-7,7);mx.fill();mx.restore();
mx.fillStyle='#000a';mx.fillRect(0,0,MW,24);mx.fillRect(0,MW-38,MW,38);mx.fillStyle='#8fd';mx.font='bold 13px monospace';mx.fillText('INDUSTRIAL TABLET — BLUEPRINT   [N ↑]',10,16);
mx.font='11px monospace';[['#3a2250','Building'],['#27402a','Outdoor'],['#5a2020','Restricted'],['#f90','Door'],['#fd3','G Generator'],['#3cf','K Keycard'],['#6ef','1-5 Camera'],['#fd3','★ Objective']].forEach(([c,t],i)=>{const x=10+(i%4)*148,y=MW-28+(i>3?14:0);mx.fillStyle=c;mx.fillRect(x,y-8,9,9);mx.fillStyle='#cde';mx.fillText(t,x+14,y)});
mx.fillStyle='#7a9';mx.fillText('Unexplored areas are hidden until visited.',MW-270,16)}
function setView(n){tabView=n;$('map').classList.toggle('hide',n>0);$('feed').classList.toggle('hide',n==0);$('tab').classList.toggle('cam',n>0);document.querySelectorAll('#tbar button[data-v]').forEach(b=>b.classList.toggle('on',+b.dataset.v==n));$('fl').textContent=n?CAMS[n-1][0]+'   ● REC':''}
document.querySelectorAll('#tbar button[data-v]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();setView(+b.dataset.v)});$('tX').onclick=()=>{tabOpen=false};setView(0);
function render(){if(!(tabOpen&&mode=='play'&&tabView>0)){ren.render(sc,cam);return}
ren.setScissorTest(false);ren.setViewport(0,0,innerWidth,innerHeight);ren.clear();const r=$('feed').getBoundingClientRect(),c=CAMS[tabView-1];
cc.position.set(...c[1]);cc.lookAt(c[2][0]+Math.sin(clk*.4)*4,c[2][1],c[2][2]);cc.aspect=r.width/r.height;cc.updateProjectionMatrix();cc.updateMatrixWorld();
const v=new T.Vector3(e.x,2,e.z).project(cc),seen=E.visible&&Math.abs(v.x)<1&&Math.abs(v.y)<1&&v.z<1&&Math.hypot(e.x-c[1][0],e.z-c[1][2])<45;$('feed').classList.toggle('nz',seen);if(seen)$('fl').textContent=c[0]+'   ⚠ MOVEMENT';
ir.position.copy(cc.position);ir.intensity=2.4;const ai=amb.intensity,fd=sc.fog.density;amb.intensity=1.2;sc.fog.density*=.5;cam.visible=false;
const y=innerHeight-r.bottom;ren.setScissorTest(true);ren.setViewport(r.left,y,r.width,r.height);ren.setScissor(r.left,y,r.width,r.height);ren.render(sc,cc);
ren.setScissorTest(false);ren.setViewport(0,0,innerWidth,innerHeight);cam.visible=true;amb.intensity=ai;sc.fog.density=fd;ir.intensity=0}
/* ---------- world animation ---------- */
function world(dt){clk+=dt;rainUpdate(dt);
lit=Math.max(0,lit-dt*1.5);amb.intensity=.5+lit*3;if(hk>0)hk-=dt;const q=hk>0?Math.sin(Math.max(0,hk)/hd*Math.PI):0;
hands.forEach((h,i)=>h.position.set((i?.25:-.25)+(rnd()-.5)*q*.02,-.32+q*.1,-.55-q*.3));
pc=Math.max(0,pc-dt);pl=Math.max(0,pl-dt);fl.intensity=tabOpen||!fl.userData.on?0:pl>0?(Math.sin(clk*70)>0?7:.1):3.6;beam.visible=fl.intensity>.5;beam.material.opacity=pl>0?.4:.22;lensM.color.setHex(fl.intensity>.5?0xfff2b0:0x333333);torch.position.y=-.26+Math.sin(P.ph*.5)*.01;
shake=Math.max(0,shake-dt);P.ph+=Math.hypot(P.vx,P.vz)*dt*2.4;
cam.position.set(P.x+(rnd()-.5)*shake*.1,P.gy+P.h+Math.sin(P.ph)*.035+(rnd()-.5)*shake*.1,P.z);cam.rotation.set(P.pitch,P.yaw,0);
if(E.visible){E.position.set(e.x,gY(e.x,e.z)+(e.st=='hunt'?Math.abs(Math.sin(clk*6))*.12:0),e.z);E.rotation.y=Math.PI/2-e.ang;E.rotation.x=e.st=='vent'?1.25:0;
HD.rotation.z=e.st=='observe'?Math.sin(clk*1.4)*.4:e.st=='hunt'?(rnd()-.5)*.6:0;HD.rotation.y=e.st=='observe'?Math.sin(clk*.9)*.7:0;EL.intensity=e.fl>0?(rnd()>.5?1.5:0):.9;{const w=Math.sin(e.ws*2.2)*.7;LG[0].rotation.x=w;LG[1].rotation.x=-w}
if(mode!='dying')ARM.rotation.x=e.st=='hunt'?-.5-Math.abs(Math.sin(clk*6))*.5:0}
fac.forEach((l,i)=>l.intensity=S.st>=11?(rnd()>.04?1.8:.15)*(i%2?1:.9):0);
const vis=tabOpen&&mode=='play';$('tab').classList.toggle('hide',!vis);if(vis&&tabView==0)drawMap();if(mode=='play'){explore();cam.fov+=((P.run?78:72)-cam.fov)*Math.min(1,dt*6);cam.updateProjectionMatrix()}detail(dt)}
/* ---------- modes / menus ---------- */
const show=(i,on)=>$(i).classList.toggle('hide',!on),setMode=m=>{mode=m;document.body.classList.toggle('g',m=='intro'||m=='play'||m=='dying');document.body.classList.toggle('p',m=='play')};
const lock=()=>{if(!TD&&$('c').requestPointerLock)$('c').requestPointerLock()};
function toMenu(){document.body.classList.remove('i');setMode('menu');['pause','dead','win','tab','bSkip','set','cred'].forEach(i=>show(i,0));show('menu',1);$('bCont').disabled=!getSave();$('fade').style.cssText='';document.exitPointerLock&&document.exitPointerLock()}
function newGame(){if(getSave()&&!confirm('Erase previous progress and start a new game?'))return;initA();S=S0();cp=null;TG[11]=[-47,-30];P.gy=0;try{localStorage.removeItem('fb_cp')}catch(_){}
P.x=0;P.z=66;P.yaw=P.pitch=0;sync();placeE();clrSay();show('menu',0);mkQuit();$('fade').style.cssText='';document.body.classList.add('i');itT=0;mkx.clearRect(0,0,MW,MW);mbKey='';
let seen=0;try{seen=localStorage.getItem('fb_seen')}catch(_){}show('bSkip',!!seen);setMode('intro');say(D.intro);lock()}
const mkQuit=()=>{};
function begin(){show('bSkip',0);try{localStorage.setItem('fb_seen',1)}catch(_){}document.body.classList.remove('i');$('fade').style.cssText='transition:none;opacity:1';setTimeout(()=>$('fade').style.cssText='',80);setMode('play');go(1);say(D.start);lock()}
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
const press=c=>{if(mode!='play')return;if(c=='KeyE')use();else if(c=='KeyF'&&!tabOpen)fl.userData.on=!fl.userData.on;else if(c=='KeyG')pulse();else if(c=='Tab'&&S.tab){tabOpen=!tabOpen;setView(tabView)}else if(tabOpen&&/^Digit[0-5]$/.test(c))setView(+c[5])};
addEventListener('keydown',ev=>{if(ev.code=='Tab'||ev.code.startsWith('Arrow'))ev.preventDefault();if(ev.code=='Escape')pause();if(!K[ev.code])press(ev.code);K[ev.code]=1});
addEventListener('keyup',ev=>K[ev.code]=0);
const look=(dx,dy,s)=>{if(mode=='play'||mode=='intro'){P.yaw-=dx*s;P.pitch=cl(P.pitch-dy*s,-1.4,1.4)}};
document.addEventListener('mousemove',ev=>{if(document.pointerLockElement)look(ev.movementX,ev.movementY,.0022)});
const TOG={ShiftLeft:1,KeyC:1};
document.querySelectorAll('#btns button').forEach(b=>{const c=b.dataset.k;b.addEventListener('pointerdown',ev=>{ev.preventDefault();initA();if(TOG[c]){K[c]=K[c]?0:1;b.classList.toggle('on',!!K[c])}else{b.classList.add('on');if(!K[c])press(c);K[c]=1}});
['pointerup','pointercancel','pointerleave'].forEach(t=>b.addEventListener(t,()=>{if(!TOG[c]){K[c]=0;b.classList.remove('on')}}))});
const syncBtns=()=>document.querySelectorAll('#btns button').forEach(b=>{if(TOG[b.dataset.k])b.classList.toggle('on',!!K[b.dataset.k])});
$('bSet').onclick=$('bSet2').onclick=()=>show('set',1);$('bSetB').onclick=()=>show('set',0);$('bCred').onclick=()=>show('cred',1);$('bCredB').onclick=()=>show('cred',0);
['vol','volA','volS','volD'].forEach(i=>$(i).oninput=setVols);$('subSz').oninput=()=>$('sub').style.fontSize=$('subSz').value+'px';
$('qual').onchange=()=>{const hi=$('qual').value=='hi';ren.shadowMap.enabled=hi;fl.castShadow=hi;ren.setPixelRatio(hi?Math.min(devicePixelRatio,1.5):1);Object.values(MC).forEach(m=>m.needsUpdate=true)};
let jt=null,lt=null,lp;
addEventListener('touchstart',ev=>{for(const t of ev.changedTouches){if(t.target.closest&&t.target.closest('#joy'))jt=t.identifier;else if(t.target.id=='c'&&lt==null){lt=t.identifier;lp=[t.clientX,t.clientY]}}});
addEventListener('touchmove',ev=>{for(const t of ev.changedTouches){if(t.identifier==jt){const r=$('joy').getBoundingClientRect();let x=(t.clientX-r.left-r.width/2)/50,y=(t.clientY-r.top-r.height/2)/50;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}J.x=x;J.y=y;$('knob').style.transform=`translate(${x*40}px,${y*40}px)`}
else if(t.identifier==lt){look(t.clientX-lp[0],t.clientY-lp[1],.005);lp=[t.clientX,t.clientY]}}if(mode=='play')ev.preventDefault()},{passive:false});
addEventListener('touchend',ev=>{for(const t of ev.changedTouches){if(t.identifier==jt){jt=null;J.x=J.y=0;$('knob').style.transform=''}if(t.identifier==lt)lt=null}});
/* ---------- main loop ---------- */
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
if(mode=='play'){pUpdate(dt);eAI(dt);trig(dt);items(dt);amb2(dt);dlg(dt)}else if(mode=='dying')scare(dt);else if(mode=='intro'){dlg(dt);drawIntro(dt);if(!dc&&!dq.length)begin()}
world(dt);render()}
sync();toMenu();requestAnimationFrame(loop);
