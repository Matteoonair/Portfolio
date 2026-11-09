/* ─────────────────────────────────────────────────────────────
   VDN « Le Tunnel » — scène 3D temps réel (three.js r160)
   On marche dans le tunnel des joueurs au défilement, entre deux murs
   en béton banché, sous des néons. Des caissons lumineux montrent les
   projets. Au bout : on débouche dans la salle, les lumières s'allument,
   le cube vidéo diffuse le showreel, les panneaux LED défilent, confettis.
   ───────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { EffectComposer } from './vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/three/examples/jsm/postprocessing/ShaderPass.js';
import { Reflector } from './vendor/three/examples/jsm/objects/Reflector.js';

await Promise.race([Promise.all([document.fonts.load('900 100px "Big Shoulders Display"'), document.fonts.load('italic 400 40px "Instrument Serif"')]), new Promise(r => setTimeout(r, 2500))]).catch(() => {});
const stage = document.getElementById('stage');
const sect = document.getElementById('tunnel');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EN = window.LANG === 'en';
const SMALL = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
const LILAS = new THREE.Color('#BBA5FF');
const LUM = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--lum').trim() || '#FFD9A0');

/* ── rendu ── */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !SMALL, powerPreference: 'high-performance' });
} catch (e) { document.documentElement.classList.add('nogl'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, SMALL ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.prepend(renderer.domElement);
renderer.domElement.className = 'gl';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050507');
scene.fog = new THREE.FogExp2('#08070c', 0.028);
const camera = new THREE.PerspectiveCamera(SMALL ? 72 : 62, innerWidth / innerHeight, 0.05, 160);
camera.position.set(0, 1.65, 2.5);

const tl = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function tex(src, rx = 1, ry = 1, srgb = true) {
  const t = tl.load(src);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { c, g }; return t;
}
const glow = (r, g, b) => new THREE.Color(r, g, b); // couleurs > 1 = elles « bavent » dans le bloom

/* ── dimensions ── */
const W = 5, H = 3.4, L = 48;            // tunnel : 5 m de large, 3,4 m de haut, 48 m de long
const Z0 = 0, Z1 = -L;                    // entrée → sortie
const COURT_Z = -64;                      // centre du terrain

/* ════════════ LE TUNNEL ════════════ */
const T = new THREE.Group(); scene.add(T);

// murs : béton banché (panneau de 2,4 × 1,2 m)
const betonMat = new THREE.MeshStandardMaterial({
  map: tex('media/tunnel/beton.jpg', L / 2.4, H / 1.2), normalMap: tex('media/tunnel/beton-n.jpg', L / 2.4, H / 1.2, false),
  normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, metalness: 0, color: '#c9c6cf'
});
for (const s of [-1, 1]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(L, H), betonMat);
  m.position.set(s * W / 2, H / 2, -L / 2); m.rotation.y = -s * Math.PI / 2; T.add(m);
  // soubassement peint (1,15 m) et bande lilas
  const dado = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.15), new THREE.MeshStandardMaterial({ color: '#1b1a21', roughness: 0.45, metalness: 0.05 }));
  dado.position.set(s * (W / 2 - 0.005), 0.575, -L / 2); dado.rotation.y = -s * Math.PI / 2; T.add(dado);
  const band = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.07), new THREE.MeshStandardMaterial({ color: LILAS, emissive: LILAS, emissiveIntensity: 0.45, roughness: 0.4 }));
  band.position.set(s * (W / 2 - 0.007), 1.185, -L / 2); band.rotation.y = -s * Math.PI / 2; T.add(band);
  // bande LED au ras du plafond
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, L), new THREE.MeshBasicMaterial({ color: glow(0.5, 0.42, 0.82), toneMapped: false }));
  led.position.set(s * (W / 2 - 0.05), H - 0.08, -L / 2); T.add(led);
  // plinthe lumineuse
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, L), new THREE.MeshBasicMaterial({ color: glow(0.6, 0.5, 1.0), toneMapped: false }));
  base.position.set(s * (W / 2 - 0.02), 0.06, -L / 2); T.add(base);
}

// plafond, tuyaux, chemin de câbles
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshStandardMaterial({ map: tex('media/tunnel/beton.jpg', 2, L / 2.4), color: '#55535c', roughness: 0.95 }));
ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -L / 2); T.add(ceil);
const pipeMat = new THREE.MeshStandardMaterial({ color: '#4a4952', roughness: 0.35, metalness: 0.85 });
for (const [x, r] of [[1.55, 0.07], [1.8, 0.05], [-1.7, 0.09]]) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 12, 1, true), pipeMat);
  p.rotation.x = Math.PI / 2; p.position.set(x, H - 0.22, -L / 2); T.add(p);
}
const tray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, L), new THREE.MeshStandardMaterial({ color: '#2f2e35', roughness: 0.6, metalness: 0.6 }));
tray.position.set(-1.15, H - 0.12, -L / 2); T.add(tray);

// sol : résine brillante (reflets) + tapis caoutchouc au centre
const solMat = new THREE.MeshStandardMaterial({
  map: tex('media/tunnel/sol.jpg', W / 4, L / 4), roughnessMap: tex('media/tunnel/sol-r.jpg', W / 4, L / 4, false),
  normalMap: tex('media/tunnel/sol-n.jpg', W / 4, L / 4, false), roughness: 0.55, metalness: 0.1,
  transparent: !SMALL, opacity: SMALL ? 1 : 0.8
});
if (!SMALL) {
  const mirror = new Reflector(new THREE.PlaneGeometry(W, L + 8), {
    textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5), color: '#8a8794'
  });
  mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, 0, -L / 2 - 2); T.add(mirror);
}
const sol = new THREE.Mesh(new THREE.PlaneGeometry(W, L), solMat);
sol.rotation.x = -Math.PI / 2; sol.position.set(0, 0.002, -L / 2); T.add(sol);

const runnerTex = canvasTex(256, 4096, (g, w, h) => {
  g.fillStyle = '#121116'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 6) { g.fillStyle = y % 12 ? '#17161c' : '#0d0c11'; g.fillRect(0, y, w, 3); }
  g.fillStyle = '#BBA5FF'; g.fillRect(10, 0, 6, h); g.fillRect(w - 16, 0, 6, h);
  g.save(); g.translate(w / 2, h - 300); g.rotate(-Math.PI / 2);
  g.fillStyle = '#BBA5FF'; g.font = '900 150px "Big Shoulders Display", "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VDN®', 0, 0); g.restore();
  g.save(); g.translate(w / 2, 900); g.rotate(-Math.PI / 2);
  g.fillStyle = 'rgba(187,165,255,.85)'; g.font = '900 64px "Big Shoulders Display", "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(EN ? 'TO THE COURT →' : 'ACCÈS TERRAIN →', 0, 0); g.restore();
});
const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, L - 2), new THREE.MeshStandardMaterial({ map: runnerTex, roughness: 0.96 }));
runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.006, -L / 2 + 0.5); T.add(runner);

// néons du plafond : un tube toutes les 4 m + lumière ponctuelle toutes les 8 m
const tubeMat = new THREE.MeshBasicMaterial({ color: glow(2.4, 2.25, 2.9), toneMapped: false });
const housingMat = new THREE.MeshStandardMaterial({ color: '#202026', roughness: 0.5, metalness: 0.7 });
const tubes = [];
for (let z = -2; z > Z1; z -= 4) {
  const hsg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 1.7), housingMat); hsg.position.set(0, H - 0.03, z); T.add(hsg);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 1.6), tubeMat.clone()); tb.position.set(0, H - 0.07, z); T.add(tb); tubes.push(tb);
}
const ceilLights = [];
for (let z = -4; z > Z1 + 2; z -= 8) {
  const l = new THREE.PointLight('#F6F2FF', 7.5, 0, 2); l.position.set(0, H - 0.25, z); T.add(l); ceilLights.push(l);
}
scene.add(new THREE.HemisphereLight('#5d5a68', '#0c0b10', 0.3));

// panneaux peints, signalétique
function sign(text, opts = {}) {
  const { w = 2, h = 0.5, size = 160, color = '#F4F1EC', bg = null, font = 'Big Shoulders Display', weight = 900, align = 'left', italic = false } = opts;
  const cw = 2048, ch = Math.round(cw * h / w);
  const t = canvasTex(cw, ch, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); }
    g.fillStyle = color; g.font = `${italic ? 'italic ' : ''}${weight} ${size}px "${font}", "Arial Narrow", sans-serif`;
    g.textBaseline = 'middle'; g.textAlign = align;
    const lines = text.split('\n'); const lh = size * 1.02;
    lines.forEach((ln, i) => g.fillText(ln, align === 'center' ? cw / 2 : 40, ch / 2 + (i - (lines.length - 1) / 2) * lh));
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: !bg, roughness: 0.85 }));
}
function onWall(mesh, side, z, y) { mesh.position.set(side * (W / 2 - 0.012), y, z); mesh.rotation.y = -side * Math.PI / 2; T.add(mesh); return mesh; }
onWall(sign('VDN®', { w: 4.2, h: 1.6, size: 760, color: '#BBA5FF' }), -1, -6.5, 2.2);
onWall(sign(EN ? 'LOCKER ROOMS  →' : 'VESTIAIRES  →', { w: 2.4, h: 0.4, size: 260 }), 1, -3.2, 2.35);
onWall(sign(EN ? 'PLAYERS ONLY · FLASH ALLOWED' : 'PLAYERS ONLY · FLASH AUTORISÉ', { w: 3.2, h: 0.3, size: 150, color: '#cfc9da' }), 1, -40, 2.2);
onWall(sign('LEVALLOIS · MARCEL-CERDAN', { w: 3.6, h: 0.32, size: 150, color: '#bdb7c8' }), -1, -44, 2.25);

// porte du vestiaire
{
  const door = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.25, 0.08), new THREE.MeshStandardMaterial({ color: '#3a3942', metalness: 0.7, roughness: 0.35 }));
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.15, 0.05), new THREE.MeshStandardMaterial({ color: '#25242c', roughness: 0.55, metalness: 0.2 }));
  leaf.position.z = 0.02; frame.position.y = 1.125; leaf.position.y = 1.08;
  const plate = sign('VESTIAIRE\nVDN®', { w: 0.42, h: 0.22, size: 210, color: '#141218', bg: '#BBA5FF', align: 'center' });
  plate.position.set(0, 1.62, 0.05);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.05), pipeMat); handle.position.set(0.38, 1.05, 0.06);
  door.add(frame, leaf, plate, handle);
  door.position.set(W / 2 - 0.04, 0, -9); door.rotation.y = -Math.PI / 2; T.add(door);
}

// caissons lumineux : les projets accrochés aux murs
const PROJ = [
  { img: 'media/li-ft-ecran.jpg', n: '01', t: "LA MINUTE DE L'EMPLOI", by: EN ? 'worn by France Travail × Metropolitans' : 'porté par France Travail × Metropolitans', side: -1, z: -13, id: 'ft' },
  { img: 'media/octobre-rose-porte-1.jpg', n: '02', t: 'OCTOBRE ROSE', by: EN ? 'worn by the players, 23.10' : 'porté par les joueurs, le 23.10', side: 1, z: -20, id: 'octrose' },
  { img: 'media/ftf-affiche-collecte.jpg', n: '03', t: 'FILE TES FRINGUES !', by: EN ? "worn by Cop'1 · 50+ kg collected" : "porté par Cop'1 · +50 kg collectés", side: -1, z: -27, id: 'ftf' },
  { img: 'media/snowflake.jpg', n: '04', t: 'SNOWFLAKE WORLD TOUR', by: 'aftermovie · YO Agency', side: 1, z: -34, id: 'snow' },
];
const clickables = [];
for (const p of PROJ) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.55, 0.14), new THREE.MeshStandardMaterial({ color: '#16151b', metalness: 0.75, roughness: 0.3 }));
  const imgT = tl.load(p.img, (t) => { // recadrage « cover » 2,1 × 1,35
    const a = t.image.width / t.image.height, A = 2.1 / 1.35;
    if (a > A) { t.repeat.set(A / a, 1); t.offset.set((1 - A / a) / 2, 0); } else { t.repeat.set(1, a / A); t.offset.set(0, (1 - a / A) / 2); }
  });
  imgT.colorSpace = THREE.SRGBColorSpace; imgT.anisotropy = maxAniso;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.35), new THREE.MeshBasicMaterial({ map: imgT, color: new THREE.Color(0.98, 0.96, 1.0), toneMapped: false }));
  face.position.z = 0.072;
  const cap = sign(`N°${p.n}  ${p.t}`, { w: 2.3, h: 0.16, size: 120, color: '#F4F1EC' });
  cap.position.set(0, -0.98, 0.02);
  const by = sign(p.by + (EN ? '  ·  click to open' : '  ·  clique pour ouvrir'), { w: 2.3, h: 0.12, size: 80, color: '#BBA5FF', font: 'Instrument Serif', weight: 400, italic: true });
  by.position.set(0, -1.13, 0.02);
  g.add(box, face, cap, by);
  g.position.set(p.side * (W / 2 - 0.08), 1.95, p.z); g.rotation.y = -p.side * Math.PI / 2;
  T.add(g);
  if (!SMALL) { const l = new THREE.PointLight('#f2ecff', 2.2, 4.5, 2); l.position.set(p.side * (W / 2 - 0.9), 1.9, p.z); T.add(l); }
  face.userData = p; clickables.push(face);
}

// encadrement de sortie et panneau « TERRAIN »
{
  const wallMat = new THREE.MeshStandardMaterial({ color: '#141318', roughness: 0.8 });
  const left = new THREE.Mesh(new THREE.BoxGeometry(30, 7, 0.6), wallMat); left.position.set(-15 - W / 2, 3.5, Z1 - 0.3);
  const right = left.clone(); right.position.x = 15 + W / 2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, 7 - H, 0.6), wallMat); top.position.set(0, H + (7 - H) / 2, Z1 - 0.3);
  T.add(left, right, top);
  const exit = sign(EN ? 'COURT' : 'TERRAIN', { w: 1.6, h: 0.36, size: 330, color: '#141218', bg: '#BBA5FF', align: 'center' });
  exit.material = new THREE.MeshBasicMaterial({ map: exit.material.map, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false });
  exit.position.set(0, H - 0.3, Z1 + 0.6); T.add(exit);
}

/* ════════════ LA SALLE ════════════ */
const A = new THREE.Group(); scene.add(A);
// parquet + tracé du terrain (28 × 15 m)
const courtTex = canvasTex(4096, 2560, (g, w, h) => {
  const sx = w / 34, sy = h / 22; // le canvas couvre 34 × 22 m autour du terrain
  for (let y = 0; y < h; y += 26) {           // lames de parquet
    let x = -Math.random() * 400;
    while (x < w) { const len = 300 + Math.random() * 500; const l = 128 + Math.random() * 30;
      g.fillStyle = `rgb(${l + 70},${l + 28},${l - 30})`; g.fillRect(x, y, len - 2, 24); x += len; }
  }
  g.globalAlpha = .18; for (let i = 0; i < 9000; i++) { g.fillStyle = Math.random() < .5 ? '#5a3a1a' : '#fff1d6'; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 1); } g.globalAlpha = 1;
  const X = (m) => (m + 17) * sx, Y = (m) => (m + 11) * sy;
  g.fillStyle = 'rgba(30,26,40,.92)'; g.fillRect(X(-17), Y(-11), w, Y(-7.5) - Y(-11)); g.fillRect(X(-17), Y(7.5), w, h);
  g.fillRect(X(-17), Y(-11), X(-14) - X(-17), h); g.fillRect(X(14), Y(-11), w, h);
  g.fillStyle = 'rgba(123,92,224,.55)'; // raquettes lilas
  g.fillRect(X(-14), Y(-2.45), 5.8 * sx, 4.9 * sy); g.fillRect(X(14 - 5.8), Y(-2.45), 5.8 * sx, 4.9 * sy);
  g.strokeStyle = '#F4F1EC'; g.lineWidth = 0.05 * sx;
  g.strokeRect(X(-14), Y(-7.5), 28 * sx, 15 * sy);
  g.beginPath(); g.moveTo(X(0), Y(-7.5)); g.lineTo(X(0), Y(7.5)); g.stroke();
  g.beginPath(); g.ellipse(X(0), Y(0), 1.8 * sx, 1.8 * sy, 0, 0, 7); g.stroke();
  g.strokeRect(X(-14), Y(-2.45), 5.8 * sx, 4.9 * sy); g.strokeRect(X(14 - 5.8), Y(-2.45), 5.8 * sx, 4.9 * sy);
  for (const s of [-1, 1]) {
    const bx = s * (14 - 1.575);
    const th = Math.asin(6.6 / 6.75), ex = bx - s * 6.75 * Math.cos(th);
    g.beginPath(); g.ellipse(X(bx), Y(0), 6.75 * sx, 6.75 * sy, 0, s < 0 ? -th : Math.PI - th, s < 0 ? th : Math.PI + th); g.stroke();
    g.beginPath(); g.moveTo(X(s * 14), Y(-6.6)); g.lineTo(X(ex), Y(-6.6)); g.moveTo(X(s * 14), Y(6.6)); g.lineTo(X(ex), Y(6.6)); g.stroke();
    g.beginPath(); g.ellipse(X(bx), Y(0), 0.23 * sx, 0.23 * sy, 0, 0, 7); g.stroke();
  }
  g.save(); g.translate(X(0), Y(0)); g.fillStyle = 'rgba(187,165,255,.9)'; g.font = `900 ${2.1 * sy}px "Big Shoulders Display", "Arial Narrow", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VDN®', 0, 0); g.restore();
});
const court = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), new THREE.MeshStandardMaterial({ map: courtTex, roughness: 0.32, metalness: 0.05 }));
court.rotation.x = -Math.PI / 2; court.position.set(0, 0.001, COURT_Z); A.add(court);

// gradins en escalier tout autour + lumières de téléphones dans la foule
const standMat = new THREE.MeshStandardMaterial({ color: '#17161d', roughness: 0.85 });
const crowdPos = [];
function stand(cx, cz, len, dirX, dirZ, rows) {
  for (let i = 0; i < rows; i++) {
    const depth = 0.85, rise = 0.48;
    const geo = dirX ? new THREE.BoxGeometry(depth, rise * (i + 1), len) : new THREE.BoxGeometry(len, rise * (i + 1), depth);
    const m = new THREE.Mesh(geo, standMat);
    m.position.set(cx + dirX * i * depth, rise * (i + 1) / 2 + 1.0, cz + dirZ * i * depth); A.add(m);
    for (let k = 0; k < len * 2.2; k++) {
      const u = (Math.random() - .5) * len;
      crowdPos.push(dirX ? cx + dirX * i * depth : cx + u, rise * (i + 1) + 1.0 + 0.55 + Math.random() * 0.2, dirX ? cz + u : cz + dirZ * i * depth);
    }
  }
}
stand(0, COURT_Z - 12, 36, 0, -1, 16);      // en face
stand(-18, COURT_Z, 22, -1, 0, 16);         // à gauche
stand(18, COURT_Z, 22, 1, 0, 16);           // à droite
// tribune au-dessus du tunnel (derrière nous)
for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(36, 0.48 * (i + 1), 0.85), standMat); m.position.set(0, 7 + 0.24 * (i + 1), Z1 + 0.6 + i * 0.85); A.add(m); }
// murets du bord terrain
const apronMat = new THREE.MeshStandardMaterial({ color: '#0f0e13', roughness: 0.7 });
for (const [x, z, w, d] of [[0, COURT_Z - 11.6, 36, 0.4], [-17.6, COURT_Z, 0.4, 22], [17.6, COURT_Z, 0.4, 22]]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), apronMat); m.position.set(x, 0.5, z); A.add(m);
}

// panneaux LED qui défilent
const ledText = EN ? '   VDN® SOCIAL STUDIO   ✦   BRANDING   ✦   CONTENT   ✦   VIDEO   ✦   AVAILABLE FOR FREELANCE   ✦   REPLY WITHIN 48 H   ✦' : '   VDN® SOCIAL STUDIO   ✦   IDENTITÉS   ✦   CONTENUS   ✦   VIDÉOS   ✦   DISPO EN FREELANCE   ✦   RÉPONSE SOUS 48 H   ✦';
const ledTex = canvasTex(4096, 128, (g, w, h) => {
  g.fillStyle = '#07060a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#BBA5FF'; g.font = '900 92px "Big Shoulders Display", "Arial Narrow", sans-serif'; g.textBaseline = 'middle';
  let x = 0; while (x < w) { g.fillText(ledText, x, h / 2 + 4); x += g.measureText(ledText).width; }
  g.globalAlpha = .35; g.fillStyle = '#000'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1); g.globalAlpha = 1; // lignes de LED
});
ledTex.wrapS = THREE.RepeatWrapping;
const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, color: new THREE.Color(0, 0, 0), toneMapped: false });
for (const [x, z, len, ry] of [[0, COURT_Z - 11.39, 36, 0], [-17.39, COURT_Z, 22, Math.PI / 2], [17.39, COURT_Z, 22, -Math.PI / 2]]) {
  const t = ledTex.clone(); t.needsUpdate = true; t.repeat.set(len / 12, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.75), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0, 0, 0), toneMapped: false }));
  m.position.set(x, 0.62, z); m.rotation.y = ry; A.add(m); m.userData.led = true;
}

// cube vidéo au-dessus du terrain : le showreel
const video = document.createElement('video');
video.src = 'media/showreel.mp4?v=3'; video.muted = true; video.loop = true; video.playsInline = true; video.crossOrigin = 'anonymous'; video.preload = 'none';
const screenTex = canvasTex(1024, 640, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); });
function drawScreen(t) {
  const { g, c } = screenTex.userData; const w = c.width, h = c.height;
  g.fillStyle = '#07060a'; g.fillRect(0, 0, w, h);
  if (video.readyState >= 2) { const vh = h, vw = vh * video.videoWidth / video.videoHeight; g.drawImage(video, (w - vw) / 2, 0, vw, vh); }
  g.fillStyle = '#BBA5FF'; g.font = '900 120px "Big Shoulders Display", "Arial Narrow", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('VDN®', 130, h / 2 - 40); g.fillText('2026', w - 130, h / 2 - 40);
  g.font = 'italic 400 44px "Instrument Serif", serif'; g.fillStyle = '#F4F1EC';
  g.fillText('showreel', 130, h / 2 + 50); g.fillText(EN ? 'live' : 'en direct', w - 130, h / 2 + 50);
  g.globalAlpha = .18; g.fillStyle = '#000'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1); g.globalAlpha = 1;
  screenTex.needsUpdate = true;
}
const cube = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.4, 7.2), new THREE.MeshStandardMaterial({ color: '#0d0c11', metalness: 0.6, roughness: 0.4 }));
  cube.add(body);
  const scrMat = new THREE.MeshBasicMaterial({ map: screenTex, color: new THREE.Color(0, 0, 0), toneMapped: false });
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.0), scrMat); const a = i * Math.PI / 2; s.position.set(Math.sin(a) * 3.62, 0, Math.cos(a) * 3.62); s.rotation.y = a; cube.add(s); }
  const ringT = ledTex.clone(); ringT.needsUpdate = true; ringT.repeat.set(2.4, 1);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 0.7, 48, 1, true), new THREE.MeshBasicMaterial({ map: ringT, color: new THREE.Color(0, 0, 0), toneMapped: false, side: THREE.DoubleSide }));
  ring.position.y = -2.7; ring.userData.led = true; cube.add(ring);
  for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 12), pipeMat); c.position.set(x, 8.2, z); cube.add(c); }
  cube.position.set(0, 8.0, COURT_Z); A.add(cube);
}

// paniers de basket de chaque côté
for (const s of [-1, 1]) {
  const hoop = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f2f0f5', roughness: 0.4 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, 1.8), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 0.85, transparent: true, opacity: 0.35 }));
  glass.position.set(s * 12.8, 3.4, 0);
  const frameB = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.05, 1.8), new THREE.MeshBasicMaterial({ color: '#f4f1ec', wireframe: true }));
  frameB.position.copy(glass.position);
  const sq = new THREE.Mesh(new THREE.PlaneGeometry(0.59, 0.45), new THREE.MeshBasicMaterial({ color: '#f4f1ec', wireframe: true })); sq.position.set(s * 12.78, 3.3, 0); sq.rotation.y = -s * Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.012, 8, 32), new THREE.MeshStandardMaterial({ color: '#ff6a2b', metalness: 0.6, roughness: 0.35 }));
  rim.rotation.x = Math.PI / 2; rim.position.set(s * 12.425, 3.05, 0);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.15, 0.42, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.55 }));
  net.position.set(s * 12.425, 2.83, 0);
  const pad = new THREE.MeshStandardMaterial({ color: '#BBA5FF', roughness: 0.7 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.6), pad); base.position.set(s * 15.6, 0.55, 0);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.3), white); post.position.set(s * 15.6, 2.4, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 0.18), white); arm.position.set(s * 14.2, 3.55, 0); arm.rotation.z = s * 0.12;
  hoop.add(glass, frameB, sq, rim, net, base, post, arm); hoop.position.z = COURT_Z; A.add(hoop);
}

// projecteurs de la salle (s'allument quand on sort)
const spots = [];
const coneMat = (col) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { col: { value: col }, k: { value: 0 } },
  vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 col; uniform float k; varying float vY; void main(){ float a = smoothstep(-9.,9.,vY); gl_FragColor = vec4(col, a*a*0.06*k); }'
});
for (const [x, z, col, ph] of [[-9, COURT_Z - 4, '#C9B8FF', 0], [9, COURT_Z - 4, '#FFE0B0', 1.7], [-6, COURT_Z + 5, '#FFFFFF', 3.1], [7, COURT_Z + 5, '#BBA5FF', 4.4]]) {
  const s = new THREE.SpotLight(col, 0, 40, 0.32, 0.6, 1.6); s.position.set(x, 18, z);
  const tgt = new THREE.Object3D(); tgt.position.set(x * 0.4, 0, z); A.add(tgt); s.target = tgt; A.add(s);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(5.4, 18, 32, 1, true), coneMat(new THREE.Color(col)));
  cone.position.copy(s.position); A.add(cone);
  spots.push({ s, tgt, cone, ph, x, z });
}
const arenaFill = new THREE.PointLight(LUM, 0, 0, 2); arenaFill.position.set(0, 12, COURT_Z); A.add(arenaFill);
// la lumière au bout du tunnel (avant l'allumage) : couleur de l'heure
const exitGlow = new THREE.PointLight(LUM, 160, 0, 2); exitGlow.position.set(0, 3, Z1 - 5); scene.add(exitGlow);

/* ── particules : poussière dans le tunnel, foule, confettis ── */
function dotsMaterial(size, color, twinkle) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, size: { value: size * renderer.getPixelRatio() }, col: { value: new THREE.Color(color) }, k: { value: 1 } },
    vertexShader: `uniform float t; uniform float size; attribute float ph; varying float vA;
      void main(){ vec3 p = position; ${twinkle ? '' : 'p.y += sin(t*.3+ph)*.25; p.x += cos(t*.21+ph*1.7)*.18;'}
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        vA = ${twinkle ? 'step(.82, fract(sin(ph*91.7+floor(t*2.+ph))*4375.5))*.9 + .12' : '.55+.45*sin(t*.8+ph)'};
        gl_PointSize = size * (8. / -mv.z); }`,
    fragmentShader: `uniform vec3 col; uniform float k; varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); gl_FragColor = vec4(col, a*vA*k); }`
  });
}
function points(arr, mat) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  const ph = new Float32Array(arr.length / 3).map(() => Math.random() * 100); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  return new THREE.Points(g, mat);
}
const dustArr = []; for (let i = 0; i < (SMALL ? 500 : 1500); i++) dustArr.push((Math.random() - .5) * W, Math.random() * H, -Math.random() * (L + 6));
const dust = points(dustArr, dotsMaterial(1.1, '#E8DFFF', false)); scene.add(dust);
const crowd = points(crowdPos, dotsMaterial(7, '#FFFFFF', true)); crowd.material.uniforms.k.value = 0.25; A.add(crowd);

const CONF = SMALL ? 180 : 420;
const confGeo = new THREE.PlaneGeometry(0.07, 0.12);
const confMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
const confetti = new THREE.InstancedMesh(confGeo, confMat, CONF); confetti.visible = false; A.add(confetti);
const confData = []; const palette = [new THREE.Color(1.6, 1.35, 2.4), new THREE.Color(2, 2, 2), new THREE.Color(2, 1.6, 1.0), new THREE.Color(.73, .65, 1)];
for (let i = 0; i < CONF; i++) { confetti.setColorAt(i, palette[i % 4]); confData.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }); }
function fireConfetti() {
  confetti.visible = true;
  confData.forEach(d => { d.p.set((Math.random() - .5) * 16, 13 + Math.random() * 4, COURT_Z + 8 + (Math.random() - .5) * 10); d.v.set((Math.random() - .5) * .6, -1.2 - Math.random() * 1.2, (Math.random() - .5) * .6); d.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); d.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); });
}

/* ── post-traitement : bloom + grain + vignette ── */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), SMALL ? 0.5 : 0.55, 0.5, 0.86);
composer.addPass(bloom);
const grain = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, t: { value: 0 }, flash: { value: 0 }, lum: { value: LUM } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float t; uniform float flash; uniform vec3 lum; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      float v = smoothstep(1.05, .35, length(vUv-.5)*1.25); c.rgb *= mix(.55, 1., v);
      c.rgb += (h(vUv*vec2(1920.,1080.)+t)-.5)*.045;
      c.rgb = mix(c.rgb, lum*1.2+.15, flash);
      gl_FragColor = c; }`
});
composer.addPass(grain);
composer.addPass(new OutputPass());

/* ── interaction : survol et clic sur les caissons ── */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), look = new THREE.Vector2();
let hover = null;
addEventListener('pointermove', (e) => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
renderer.domElement.addEventListener('click', (e) => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera); const hit = ray.intersectObjects(clickables)[0];
  if (hit && hit.distance < 16) window.dispatchEvent(new CustomEvent('vdn:open', { detail: hit.object.userData }));
});

/* ── défilement → position de la caméra ── */
const FORCE = new URLSearchParams(location.search).has('tp') ? Number(new URLSearchParams(location.search).get('tp')) : null; // pour les captures
let P = 0, Psm = 0, lightsOn = 0, fired = false, active = true, last = performance.now();
const ease = (x) => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function progress() { const r = sect.getBoundingClientRect(); const tot = sect.offsetHeight - innerHeight; return clamp01(-r.top / tot); }
new IntersectionObserver((es) => { active = es[0].isIntersecting; }).observe(sect);

const tmp = new THREE.Vector3(), tgt = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  if (!active) return;
  const dt = Math.min(.05, (now - last) / 1000); last = now; const t = now / 1000;
  P = FORCE != null ? FORCE : progress(); Psm += (P - Psm) * (RM || FORCE != null ? 1 : Math.min(1, dt * 4.5));
  const walk = clamp01(Psm / 0.74), out = clamp01((Psm - 0.74) / 0.26);
  // marche dans le tunnel puis sortie vers le terrain
  const z = THREE.MathUtils.lerp(2.5, Z1 - 1.5, ease(walk)) + THREE.MathUtils.lerp(0, -2.5, ease(out));
  const speed = Math.abs(P - Psm) * 60;
  const bob = RM ? 0 : Math.sin(z * 2.2) * 0.025 * Math.min(1, speed);
  camera.position.set(Math.sin(z * 1.1) * 0.012 * Math.min(1, speed), 1.65 + bob + ease(out) * 0.9, z);
  look.x += ((RM ? 0 : mouse.x) - look.x) * Math.min(1, dt * 3); look.y += ((RM ? 0 : mouse.y) - look.y) * Math.min(1, dt * 3);
  tgt.set(look.x * 1.6, 1.55 + look.y * 0.7, z - 10);
  tmp.set(look.x * 3, 5.4 + look.y, COURT_Z);
  tgt.lerp(tmp, ease(out));
  camera.lookAt(tgt);

  // allumage de la salle au moment de sortir
  const want = Psm > 0.7 ? 1 : 0; lightsOn += (want - lightsOn) * (FORCE != null ? 1 : Math.min(1, dt * (want ? 1.6 : 3)));
  if (Psm > 0.76 && !fired) { fired = true; fireConfetti(); grain.uniforms.flash.value = FORCE != null ? 0 : 0.45; video.play().catch(() => {}); window.dispatchEvent(new Event('vdn:lights')); }
  if (Psm < 0.6) fired = false;
  grain.uniforms.flash.value *= Math.pow(0.004, dt);
  spots.forEach((s, i) => {
    s.s.intensity = lightsOn * 900; s.cone.material.uniforms.k.value = lightsOn;
    s.tgt.position.x = s.x * 0.4 + Math.sin(t * 0.35 + s.ph) * 5; s.tgt.position.z = s.z + Math.cos(t * 0.27 + s.ph) * 3;
    s.cone.position.copy(s.s.position); s.cone.lookAt(s.tgt.position); s.cone.rotateX(-Math.PI / 2); s.cone.translateY(-9);
  });
  arenaFill.intensity = lightsOn * 90;
  exitGlow.intensity = 160 * (1 - lightsOn * 0.6);
  crowd.material.uniforms.k.value = 0.3 + lightsOn * 1.3;
  A.traverse(o => { if (o.userData.led) { o.material.color.setScalar(0.25 + lightsOn * 1.6); o.material.map.offset.x = (o.material.map.offset.x + dt * 0.04) % 1; } });
  cube.children.forEach(c => { if (c.material && c.material.map === screenTex) c.material.color.setScalar(0.15 + lightsOn * 1.25); });
  if (lightsOn > 0.02) drawScreen(t);
  cube.rotation.y = t * 0.08;
  // confettis
  if (confetti.visible) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1); let alive = 0;
    confData.forEach((d, i) => { d.p.addScaledVector(d.v, dt); d.p.x += Math.sin(t * 2 + i) * dt * .4; d.r.x += d.w.x * dt; d.r.y += d.w.y * dt;
      if (d.p.y > 0.02) alive++; else d.p.y = 0.02;
      q.setFromEuler(d.r); m.compose(d.p, q, s); confetti.setMatrixAt(i, m); });
    confetti.instanceMatrix.needsUpdate = true;
  }
  // néons : un tube qui grésille
  tubes.forEach((tb, i) => { const f = i === 5 ? (Math.sin(t * 40) > 0.6 || Math.sin(t * 3.1) > 0.9 ? 0.25 : 1) : 1; tb.material.color.setRGB(2.4 * f, 2.25 * f, 2.9 * f); });
  dust.material.uniforms.t.value = t; crowd.material.uniforms.t.value = t; grain.uniforms.t.value = t % 10;

  // survol des caissons
  if (!SMALL && walk < 0.98) {
    ray.setFromCamera(mouse, camera); const hit = ray.intersectObjects(clickables)[0];
    const h2 = hit && hit.distance < 14 ? hit.object : null;
    if (h2 !== hover) { if (hover) hover.material.color.setRGB(0.98, 0.96, 1.0); hover = h2; if (hover) hover.material.color.setRGB(1.3, 1.26, 1.36); renderer.domElement.style.cursor = hover ? 'pointer' : ''; }
  }
  window.dispatchEvent(new CustomEvent('vdn:p', { detail: { p: Psm, metres: Math.max(0, Math.round(z - Z1)) } }));
  composer.render();
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});
document.documentElement.classList.add('gl-ok');
requestAnimationFrame(frame);
