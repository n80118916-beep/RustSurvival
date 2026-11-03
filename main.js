import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 150);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 600);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(40, 60, 20);
scene.add(sun);

const SIZE = 130, SEG = 90, HALF = SIZE/2;
const islandGeo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
islandGeo.rotateX(-Math.PI/2);

function noise(x, z){
  return Math.sin(x*0.15)*Math.cos(z*0.13)*0.5 +
         Math.sin(x*0.31+1.3)*Math.cos(z*0.27+0.7)*0.3 +
         Math.sin(x*0.63+2.1)*Math.cos(z*0.59+1.9)*0.2;
}
function heightAt(x, z){
  const d = Math.hypot(x, z) / HALF;
  let h = noise(x, z) * 6 + 2.5;
  h -= Math.max(0, d - 0.62) * 30;
  return h;
}
function groundY(x, z){ return Math.max(heightAt(x, z), 0.25); }

const posAttr = islandGeo.attributes.position;
const colors = [];
for(let i=0; i<posAttr.count; i++){
  const x = posAttr.getX(i), z = posAttr.getZ(i);
  const h = heightAt(x, z);
  posAttr.setY(i, h);
  let c;
  if(h < 0.3) c = new THREE.Color(0x2a6fa8);
  else if(h < 1.2) c = new THREE.Color(0xd9c48a);
  else if(h < 5)   c = new THREE.Color(0x4a8c3a);
  else             c = new THREE.Color(0x808080);
  colors.push(c.r, c.g, c.b);
}
islandGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
islandGeo.computeVertexNormals();
scene.add(new THREE.Mesh(islandGeo, new THREE.MeshLambertMaterial({vertexColors:true})));

const water = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshLambertMaterial({color:0x1e5fa0, transparent:true, opacity:0.8})
);
water.rotation.x = -Math.PI/2;
water.position.y = 0.25;
scene.add(water);

const player = { pos: new THREE.Vector3(), yaw: 0, pitch: -0.1 };
player.pos.set(0, groundY(0, 0) + 1.7, 0);

const items = [];

function spawnRock(x, z){
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.45, 0),
    new THREE.MeshLambertMaterial({color:0x777777, flatShading:true})
  );
  const y = groundY(x, z);
  mesh.position.set(x, y + 0.7, z);
  mesh.userData = { type: 'Rock', baseY: y + 0.7 };
  scene.add(mesh); items.push(mesh);
}

function spawnTorch(x, z){
  const group = new THREE.Group();
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 1, 6),
    new THREE.MeshLambertMaterial({color:0x5a3a1a})
  );
  stick.position.y = 0.5;
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.45, 6),
    new THREE.MeshBasicMaterial({color:0xff8800})
  );
  flame.position.y = 1.25;
  group.add(stick, flame);
  const y = groundY(x, z);
  group.position.set(x, y, z);
  group.userData = { type: 'Torch', baseY: y };
  scene.add(group); items.push(group);
}

for(let i=0; i<15; i++){
  const a = Math.random() * Math.PI * 2;
  const r = 5 + Math.random() * 28;
  spawnRock(Math.cos(a) * r, Math.sin(a) * r);
}
for(let i=0; i<8; i++){
  const a = Math.random() * Math.PI * 2;
  const r = 8 + Math.random() * 24;
  spawnTorch(Math.cos(a) * r, Math.sin(a) * r);
}

const hotbarEl = document.getElementById('hotbar');
const slots = [];
let activeSlot = 0;
for(let i=0; i<6; i++){
  const d = document.createElement('div');
  d.className = 'slot' + (i === 0 ? ' active' : '');
  const tap = e => { e.preventDefault(); selectSlot(i); };
  d.addEventListener('touchstart', tap, {passive:false});
  d.addEventListener('mousedown', tap);
  hotbarEl.appendChild(d);
  slots.push({ el: d, item: null });
}
function selectSlot(i){
  activeSlot = i;
  slots.forEach((s, idx) => s.el.classList.toggle('active', idx === i));
}
function addItem(name){
  for(let i=0; i<6; i++){
    if(!slots[i].item){
      slots[i].item = name;
      slots[i].el.textContent = name === 'Rock' ? '🪨' : '🔥';
      return true;
    }
  }
  return false;
}

const joyEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
let joyId = null, joyStart = {x:0, y:0}, joyVec = {x:0, y:0};
const JR = 55;

joyEl.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joyId = t.identifier;
  const r = joyEl.getBoundingClientRect();
  joyStart = { x: r.left + r.width/2, y: r.top + r.height/2 };
}, {passive:false});

joyEl.addEventListener('touchmove', e => {
  for(const t of e.changedTouches){
    if(t.identifier !== joyId) continue;
    let dx = t.clientX - joyStart.x, dy = t.clientY - joyStart.y;
    const len = Math.hypot(dx, dy);
    if(len > JR){ dx = dx/len*JR; dy = dy/len*JR; }
    stickEl.style.transform = `translate(${dx}px,${dy}px)`;
    joyVec.x = dx/JR; joyVec.y = dy/JR;
  }
  e.preventDefault();
}, {passive:false});

function endJoy(e){
  for(const t of e.changedTouches){
    if(t.identifier === joyId){
      joyId = null; joyVec = {x:0, y:0};
      stickEl.style.transform = '';
    }
  }
}
joyEl.addEventListener('touchend', endJoy);
joyEl.addEventListener('touchcancel', endJoy);

const canvas = renderer.domElement;
let lookId = null, lookLast = {x:0, y:0};

canvas.addEventListener('touchstart', e => {
  for(const t of e.changedTouches){
    if(lookId === null){ lookId = t.identifier; lookLast = {x:t.clientX, y:t.clientY}; }
  }
  e.preventDefault();
}, {passive:false});

canvas.addEventListener('touchmove', e => {
  for(const t of e.changedTouches){
    if(t.identifier === lookId){
      player.yaw   -= (t.clientX - lookLast.x) * 0.005;
      player.pitch -= (t.clientY - lookLast.y) * 0.005;
      player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch));
      lookLast = {x:t.clientX, y:t.clientY};
    }
  }
  e.preventDefault();
}, {passive:false});

function endLook(e){
  for(const t of e.changedTouches){ if(t.identifier === lookId) lookId = null; }
}
canvas.addEventListener('touchend', endLook);
canvas.addEventListener('touchcancel', endLook);

let mouseDown = false;
canvas.addEventListener('mousedown', () => mouseDown = true);
canvas.addEventListener('mouseup',   () => mouseDown = false);
canvas.addEventListener('mousemove', e => {
  if(!mouseDown) return;
  player.yaw   -= e.movementX * 0.003;
  player.pitch -= e.movementY * 0.003;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch));
});

const clock = new THREE.Clock();
const SPEED = 6, EYE = 1.7;

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right   = new THREE.Vector3( Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const move = new THREE.Vector3();
  move.addScaledVector(forward, -joyVec.y);
  move.addScaledVector(right,    joyVec.x);
  if(move.length() > 1) move.normalize();

  player.pos.x += move.x * SPEED * dt;
  player.pos.z += move.z * SPEED * dt;

  const lim = HALF - 3;
  player.pos.x = Math.max(-lim, Math.min(lim, player.pos.x));
  player.pos.z = Math.max(-lim, Math.min(lim, player.pos.z));
  player.pos.y = groundY(player.pos.x, player.pos.z) + EYE;

  camera.position.copy(player.pos);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  for(let i = items.length - 1; i >= 0; i--){
    const it = items[i];
    it.rotation.y += dt * 2;
    it.position.y = it.userData.baseY + 0.3 + Math.sin(performance.now()*0.002 + i) * 0.15;
    if(it.position.distanceTo(player.pos) < 2.8){
      if(addItem(it.userData.type)){
        scene.remove(it);
        items.splice(i, 1);
      }
    }
  }
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
