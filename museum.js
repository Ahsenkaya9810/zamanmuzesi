import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ---------- plan coordinates: 90-dpi plan pixels -> metres ---------- */
const S = 0.075, X = p => (p - 66) * S, Z = p => (p - 232) * S;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const H = 12.5, RIDGE = 16;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const rr = (a, b) => a + (b - a) * rnd();

const canvas = document.getElementById('scene');
const mobile = matchMedia('(max-width:700px)').matches;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { document.documentElement.classList.add('nogl'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .94;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
const HORIZON = new THREE.Color(0xeed8bc), ZENITH = new THREE.Color(0x8fa6b2);
scene.fog = new THREE.Fog(0xe9d6bd, 140, 1100);
const sunDir = V(-0.62, 0.42, 0.66).normalize();

/* ---------- sky ---------- */
function skyMesh() {
  return new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: sunDir }, hz: { value: HORIZON }, zn: { value: ZENITH } },
    vertexShader: 'varying vec3 d;void main(){d=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
    fragmentShader: `varying vec3 d;uniform vec3 sun,hz,zn;void main(){float h=max(d.y,0.);vec3 c=mix(hz,zn,pow(h,.55));
      float s=max(dot(d,sun),0.);c+=vec3(1.,.72,.45)*pow(s,10.)*.45+vec3(1.,.85,.6)*pow(s,500.)*2.;
      c=mix(c,hz*.92,smoothstep(0.,-.08,d.y));gl_FragColor=vec4(c,1.);}`
  }));
}
const sky = skyMesh(); sky.renderOrder = -1; scene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene(); envScene.add(skyMesh());
const envGround = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: 0x7a6a58 }));
envGround.rotation.x = -Math.PI / 2; envGround.position.y = -40; envScene.add(envGround);
scene.environment = pmrem.fromScene(envScene, 0.02).texture;

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xfff0dc, 0x86735f, 0.7));
const sun = new THREE.DirectionalLight(0xffd7a8, 3.1);
sun.position.copy(V(50, 0, 17).addScaledVector(sunDir, 120)); sun.target.position.set(50, 0, 17);
sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -78, right: 78, top: 55, bottom: -55, near: 10, far: 300 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
for (const [x, z] of [[9, 13], [28.7, 7], [53, 8], [28, 26], [73, 26], [86, 10]]) {
  const p = new THREE.PointLight(0xffc68a, 30, 22, 1.6); p.position.set(x, 3.6, z); scene.add(p);
}

/* ---------- procedural textures ---------- */
function tex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function speckle(g, w, h, n, cols, a = .08, s = 2) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = a * rnd() + a / 2; g.fillRect(rnd() * w, rnd() * h, s * rnd() + 1, s * rnd() + 1); } g.globalAlpha = 1; }
const stoneTex = tex(512, 512, (g, w, h) => {
  g.fillStyle = '#d8c3a0'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) { let x = -rnd() * 80; while (x < w) { const bw = rr(70, 130); const l = rr(-14, 10);
    g.fillStyle = `hsl(${rr(30, 38)},${rr(30, 42)}%,${74 + l}%)`; g.fillRect(x + 2, y + 2, bw - 3, 29); x += bw; } }
  speckle(g, w, h, 9000, ['#6b5640', '#fff6e6', '#9c8061'], .12, 2);
}, [0.25, 0.25]);
const brickTex = tex(256, 256, (g, w, h) => {
  g.fillStyle = '#c9b7a0'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 24 - 24; x < w; x += 48) { g.fillStyle = `hsl(${rr(8, 18)},${rr(38, 52)}%,${rr(36, 46)}%)`; g.fillRect(x + 1, y + 1, 46, 14); }
  speckle(g, w, h, 3000, ['#2a1510', '#e8c3a0'], .15, 2);
}, [0.5, 0.5]);
const floorTex = tex(512, 512, (g, w, h) => {
  g.fillStyle = '#cfc5b5'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { const r = rr(40, 160); const gr = g.createRadialGradient(rnd() * w, rnd() * h, 0, rnd() * w, rnd() * h, r); gr.addColorStop(0, 'rgba(120,100,80,.06)'); gr.addColorStop(1, 'rgba(120,100,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  g.strokeStyle = 'rgba(90,75,60,.18)'; g.lineWidth = 1.5; for (let i = 0; i <= w; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  speckle(g, w, h, 6000, ['#857462', '#f5ede0'], .1, 1.5);
});
const terrazzoTex = tex(512, 512, (g, w, h) => { g.fillStyle = '#e6ddcf'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, ['#7b2632', '#9e8f7c', '#3c3530', '#c7a27a', '#ffffff'], .5, 4); });
const woodTex = tex(512, 512, (g, w, h) => {
  for (let y = 0; y < h; y += 32) { g.fillStyle = `hsl(${rr(22, 30)},${rr(35, 45)}%,${rr(30, 42)}%)`; g.fillRect(0, y, w, 31); g.fillStyle = 'rgba(30,15,5,.6)'; g.fillRect(0, y + 31, w, 1); }
  speckle(g, w, h, 4000, ['#2b1608', '#c59a6c'], .15, 3);
});
const grassTex = tex(512, 512, (g, w, h) => { g.fillStyle = '#6f7a48'; g.fillRect(0, 0, w, h); speckle(g, w, h, 30000, ['#4e5a2f', '#8f965e', '#a38b5e', '#3e4a26'], .35, 3); }, [40, 40]);
const paveTex = tex(512, 512, (g, w, h) => {
  g.fillStyle = '#b6a68e'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 64) for (let x = (y / 64 % 2) * 32; x < w; x += 64) { g.fillStyle = `hsl(35,${rr(14, 22)}%,${rr(60, 70)}%)`; g.fillRect(x + 2, y + 2, 60, 60); }
  speckle(g, w, h, 8000, ['#5c4c3a', '#efe2cc'], .12, 2);
}, [30, 15]);
const earthTex = tex(256, 256, (g, w, h) => { g.fillStyle = '#a7835b'; g.fillRect(0, 0, w, h); speckle(g, w, h, 9000, ['#7d5b3a', '#c9a77a', '#6a7a45'], .3, 3); });
const waterNormal = (() => {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); const img = g.createImageData(n, n);
  const hgt = (x, y) => { const u = x / n * Math.PI * 2, v = y / n * Math.PI * 2; return Math.sin(u * 3 + v * 2) * .5 + Math.sin(u * 7 - v * 5) * .25 + Math.sin(u * 13 + v * 11) * .12 + Math.sin(-u * 4 + v * 9) * .2; };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1); const v = V(-dx * 3, -dy * 3, 1).normalize(); const i = (y * n + x) * 4; img.data[i] = (v.x * .5 + .5) * 255; img.data[i + 1] = (v.y * .5 + .5) * 255; img.data[i + 2] = (v.z * .5 + .5) * 255; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(90, 90); return t;
})();

/* ---------- materials ---------- */
const std = (color, rough = .8, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const M = {
  stone: std(0xffffff, .92, 0, { map: stoneTex }), brick: std(0xffffff, .9, 0, { map: brickTex }),
  plaster: std(0xefe8db, .92), trim: std(0xe7d9c0, .85), dark: std(0x2d2a28, .45, .6), wood: std(0x8b5d3b, .55),
  woodL: std(0xbb8f63, .6), burg: std(0x7b2632, .72), burgD: std(0x5c1b24, .8), brass: std(0xc2a06a, .3, .9),
  white: std(0xf5f2ea, .55), fabric: std(0xcdbb9f, .95), green: std(0x4c6a38, .9), green2: std(0x6b8549, .9),
  earth: std(0xffffff, 1, 0, { map: earthTex }), sea: std(0x3a6a72, .12, .05, { normalMap: waterNormal, normalScale: new THREE.Vector2(.5, .5), envMapIntensity: 1.2 }),
  minWater: std(0x4b7f88, .1, .1), stoneD: std(0x8e7b66, .9), hull: std(0xf3efe6, .5), hullD: std(0x23262b, .6), funnel: std(0xc8a24e, .5, .3),
  black: std(0x1c1a19, .5), pillar: std(0xd9c7a4, .95), deck: std(0xffffff, .8, 0, { map: woodTex }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xbfd3d4, roughness: .04, metalness: 0, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 }),
  roofGlass: new THREE.MeshPhysicalMaterial({ color: 0xd4e2df, roughness: .08, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffd49a }),
  screen: new THREE.ShaderMaterial({ uniforms: { t: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 u;void main(){u=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 u;uniform float t;void main(){float a=sin(u.x*18.+t*1.2+sin(u.y*6.+t)*2.)*.5+.5;float b=smoothstep(.97,1.,sin(u.y*40.-t*2.)*.5+.5);
      vec3 c=mix(vec3(.25,.06,.09),vec3(.95,.72,.45),a*.7)+b*.4;c*=.75+.25*sin(u.x*3.14);gl_FragColor=vec4(c*.95,1.);}` })
};

/* ---------- instanced batches ---------- */
const build = new THREE.Group(); scene.add(build);
const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(.5, .5, 1, 28), sph: new THREE.SphereGeometry(.5, 24, 14),
  cone: new THREE.ConeGeometry(.5, 1, 24), hemi: new THREE.SphereGeometry(.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2) };
const batches = new Map();
const qY = a => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
function add(kind, mat, pos, quat, scale) { const k = kind + mat.uuid; if (!batches.has(k)) batches.set(k, { kind, mat, list: [] }); batches.get(k).list.push(new THREE.Matrix4().compose(pos, quat, scale)); }
const box = (m, x, y0, z, sx, sy, sz, ry = 0) => add('box', m, V(x, y0 + sy / 2, z), qY(ry), V(sx, sy, sz));
const cyl = (m, x, y0, z, r, h, rz = r) => add('cyl', m, V(x, y0 + h / 2, z), qY(0), V(r * 2, h, rz * 2));
const sph = (m, x, y, z, r, ry = r, rz = r) => add('sph', m, V(x, y, z), qY(0), V(r * 2, ry * 2, rz * 2));
const cone = (m, x, y0, z, r, h) => add('cone', m, V(x, y0 + h / 2, z), qY(0), V(r * 2, h, r * 2));
const dome = (m, x, y0, z, r, hy = r) => add('hemi', m, V(x, y0, z), qY(0), V(r * 2, hy * 2, r * 2));
function beam(m, a, b, t = .14) { const d = b.clone().sub(a), L = d.length(); add('box', m, a.clone().add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d.normalize()), V(L, t, t)); }
const planLines = [];
const bx = (m, x1, y1, x2, y2, y0, h) => box(m, X((x1 + x2) / 2), y0, Z((y1 + y2) / 2), Math.abs(x2 - x1) * S, h, Math.abs(y2 - y1) * S);
function wall(x1, y1, x2, y2, h = 3.4, m = M.plaster, t = .18) {
  if (y1 === y2) box(m, X((x1 + x2) / 2), 0, Z(y1), Math.abs(x2 - x1) * S, h, t); else box(m, X(x1), 0, Z((y1 + y2) / 2), t, h, Math.abs(y2 - y1) * S);
}
function glassWall(x1, y1, x2, y2, h = 3.2) {
  const horiz = y1 === y2, L = horiz ? Math.abs(x2 - x1) * S : Math.abs(y2 - y1) * S;
  box(M.glass, X((x1 + x2) / 2), 0, Z((y1 + y2) / 2), horiz ? L : .04, h, horiz ? .04 : L);
  const n = Math.max(1, Math.round(L / 1.6));
  for (let i = 0; i <= n; i++) { const f = i / n; box(M.dark, X(x1 + (x2 - x1) * f), 0, Z(y1 + (y2 - y1) * f), .06, h, .06); }
  box(M.dark, X((x1 + x2) / 2), h - .06, Z((y1 + y2) / 2), horiz ? L : .07, .07, horiz ? .07 : L);
}

/* ---------- facades with arched windows ---------- */
function facade(x1, y1, x2, y2, o = {}) {
  const a = V(X(x1), 0, Z(y1)), b = V(X(x2), 0, Z(y2)), d = b.clone().sub(a), L = d.length(); d.normalize();
  const n = V(-d.z, 0, d.x), ry = -Math.atan2(d.z, d.x), t = o.t || .6, h = H, arcade = !!o.arcade;
  const nb = Math.max(1, Math.round(L / 6.375)), bay = L / nb;
  const ops = (o.open || Array.from({ length: nb }, (_, i) => ({ u: (i + .5) * bay }))).map(p => ({
    w: arcade ? Math.min(4.4, bay * .72) : Math.min(3.1, bay * .52), sill: arcade ? .02 : 1.0, top: arcade ? 8.8 : 8.6, ...p }));
  const shape = new THREE.Shape([V(0, 0), V(L, 0), V(L, h), V(0, h)].map(v => new THREE.Vector2(v.x, v.y)));
  const panes = [], bands = [];
  const at = (u, y, off = 0) => a.clone().addScaledVector(d, u).addScaledVector(n, off).setY(y);
  for (const p of ops) {
    const r = p.w / 2, path = new THREE.Path();
    path.moveTo(p.u - r, p.sill); path.lineTo(p.u + r, p.sill); path.lineTo(p.u + r, p.top); path.absarc(p.u, p.top, r, 0, Math.PI, false); path.lineTo(p.u - r, p.sill);
    shape.holes.push(path);
    const R = r + .38, band = new THREE.Shape(); band.moveTo(p.u - R, p.top); band.absarc(p.u, p.top, R, Math.PI, 0, true); band.lineTo(p.u + r, p.top); band.absarc(p.u, p.top, r, 0, Math.PI, false); band.lineTo(p.u - R, p.top); bands.push(band);
    if (!arcade) {
      panes.push(new THREE.Shape(path.getPoints(24)));
      const c = at(p.u, 0); box(M.dark, c.x, p.sill, c.z, .07, p.top + r - p.sill, .08, ry);
      for (const f of [.34, .67, 1]) { const y = p.sill + (p.top - p.sill) * f; box(M.dark, c.x, y, c.z, p.w, .07, .08, ry); }
      const s = at(p.u, 0, 0); box(M.trim, s.x, p.sill - .18, s.z, p.w + .5, .18, t + .3, ry);
    }
  }
  const place = (geo, mat, off) => { const m = new THREE.Mesh(geo, mat); m.position.copy(a).addScaledVector(n, off); m.rotation.y = ry; m.castShadow = m.receiveShadow = mat !== M.glass; build.add(m); return m; };
  place(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 18 }), M.stone, -t / 2);
  place(new THREE.ExtrudeGeometry(bands, { depth: t + .14, bevelEnabled: false, curveSegments: 18 }), M.brick, -t / 2 - .07);
  if (panes.length) place(new THREE.ShapeGeometry(panes, 18), M.glass, 0);
  for (let i = 0; i <= nb; i++) { const c = at(i * bay, 0); box(M.trim, c.x, 0, c.z, .75, h, t + .36, ry); }
  const m = at(L / 2, 0); box(M.trim, m.x, h - .55, m.z, L + .6, .55, t + .5, ry); box(M.stoneD, m.x, 0, m.z, L + .3, .55, t + .3, ry);
  planLines.push([a.x, a.z, b.x, b.z]);
}

/* ---------- roofs: glass gables on steel trusses ---------- */
function gable(x0, z0, x1, z1, alongX, step) {
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  if (alongX) {
    const zm = (z0 + z1) / 2;
    quad([x0, H, z0], [x1, H, z0], [x1, RIDGE, zm], [x0, RIDGE, zm]); quad([x0, RIDGE, zm], [x1, RIDGE, zm], [x1, H, z1], [x0, H, z1]);
    for (let x = x0 + step; x < x1 - .5; x += step) truss(V(x, H, z0), V(x, H, z1), V(x, RIDGE, zm));
    for (const f of [0, .33, .66, 1]) for (const [za] of [[z0], [z1]]) { const z = za + (zm - za) * f, y = H + (RIDGE - H) * f; beam(M.dark, V(x0, y, z), V(x1, y, z), .12); }
    gableEnd(V(x0, H, z0), V(x0, H, z1), V(x0, RIDGE, zm)); gableEnd(V(x1, H, z0), V(x1, H, z1), V(x1, RIDGE, zm));
  } else {
    const xm = (x0 + x1) / 2;
    quad([x0, H, z0], [x0, H, z1], [xm, RIDGE, z1], [xm, RIDGE, z0]); quad([xm, RIDGE, z0], [xm, RIDGE, z1], [x1, H, z1], [x1, H, z0]);
    for (let z = z0 + step; z < z1 - .5; z += step) truss(V(x0, H, z), V(x1, H, z), V(xm, RIDGE, z));
    for (const f of [0, .33, .66, 1]) for (const xa of [x0, x1]) { const x = xa + (xm - xa) * f, y = H + (RIDGE - H) * f; beam(M.dark, V(x, y, z0), V(x, y, z1), .12); }
    gableEnd(V(x0, H, z0), V(x1, H, z0), V(xm, RIDGE, z0)); gableEnd(V(x0, H, z1), V(x1, H, z1), V(xm, RIDGE, z1));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const roof = new THREE.Mesh(g, M.roofGlass); roof.renderOrder = 2; build.add(roof);
}
function truss(a, b, top) {
  const lo = .3; const A = a.clone().setY(H - lo), B = b.clone().setY(H - lo);
  beam(M.dark, A, B, .16); beam(M.dark, a, top, .18); beam(M.dark, top, b, .18);
  for (const f of [.25, .5, .75]) { const p = A.clone().lerp(B, f); const q = f <= .5 ? a.clone().lerp(top, f * 2) : top.clone().lerp(b, (f - .5) * 2); beam(M.dark, p, q, .08); }
  for (const f of [.125, .375, .625, .875]) { const p = A.clone().lerp(B, f); const ff = f < .5 ? f + .125 : f - .125; const q = ff <= .5 ? a.clone().lerp(top, ff * 2) : top.clone().lerp(b, (ff - .5) * 2); beam(M.dark, p, q, .06); }
}
function gableEnd(a, b, top) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...top.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 4, 0, 2, 1], 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: stoneTex, roughness: .92, side: THREE.DoubleSide })); m.castShadow = true; build.add(m);
  const c = a.clone().lerp(b, .5); c.y = (H + RIDGE) / 2 - .2; const ring = new THREE.Mesh(new THREE.TorusGeometry(.75, .12, 8, 28), M.trim);
  ring.position.copy(c); ring.lookAt(c.clone().add(V(-(b.z - a.z), 0, b.x - a.x))); build.add(ring);
}

/* ---------- site: plaza, lawn, quay, sea, hills, far shore ---------- */
function plane(w, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; }
plane(3000, 1400, std(0xffffff, 1, 0, { map: grassTex }), 50, -.06, -664);
grassTex.repeat.set(300, 140);
plane(150, 62, std(0xffffff, .95, 0, { map: paveTex }), 51, -.03, 6);
const sea = plane(4000, 3000, M.sea, 50, -1.25, 1536);
box(M.stoneD, 50, -1.6, 36.4, 500, 1.6, 1.2); box(M.trim, 50, -.08, 36.4, 500, .1, 1.3);
const hillMat = std(0x55663e, 1, 0, { flatShading: true });
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), hillMat); m.scale.set(rr(70, 140), rr(18, 42), rr(40, 70)); m.position.set(-220 + i * 38 + rr(-10, 10), -6, rr(-120, -190)); scene.add(m); }
const farMat = std(0x8d977a, 1, 0, { flatShading: true });
for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), farMat); m.scale.set(rr(70, 120), rr(14, 36), 50); m.position.set(-700 + i * 85, -3, rr(760, 820)); scene.add(m); }
{ // far shore houses
  const g = new THREE.InstancedMesh(GEO.box, std(0xf1e7d6, .9), 260); const mm = new THREE.Matrix4();
  for (let i = 0; i < 260; i++) { mm.compose(V(rr(-700, 800), rr(0, 10), rr(712, 745)), qY(rr(0, 1)), V(rr(6, 14), rr(5, 12), rr(6, 10))); g.setMatrixAt(i, mm); } scene.add(g);
  const domeM = std(0xd9d0c0, .9); const dm = new THREE.Mesh(GEO.hemi, domeM); dm.scale.set(26, 20, 26); dm.position.set(-260, 14, 735); scene.add(dm);
  const base = new THREE.Mesh(GEO.box, domeM); base.scale.set(40, 14, 40); base.position.set(-260, 7, 735); scene.add(base);
  for (const [dx, dz] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) { const mn = new THREE.Mesh(GEO.cyl, domeM); mn.scale.set(2.4, 46, 2.4); mn.position.set(-260 + dx, 23, 735 + dz); scene.add(mn); const c = new THREE.Mesh(GEO.cone, domeM); c.scale.set(3, 7, 3); c.position.set(-260 + dx, 49.5, 735 + dz); scene.add(c); }
}
// factory chimney of the old Kundura works
cyl(M.brick, -9, 0, -9, 1.6, 2, 1.6); add('cyl', M.brick, V(-9, 17, -9), qY(0), V(2.6, 30, 2.6)); box(M.trim, -9, 31.5, -9, 2.9, .6, 2.9);

/* trees */
{
  const pts = [];
  const tryAdd = (x, z, s) => { if (x > -14 && x < 116 && z > -13 && z < 37) return; if (z > 35.5) return; pts.push([x, z, s]); };
  for (let i = 0; i < 520; i++) tryAdd(rr(-150, 260), rr(-150, -14), rr(.8, 1.5));
  for (let i = 0; i < 70; i++) tryAdd(rr(-60, -16), rr(-14, 34), rr(.8, 1.4));
  for (let i = 0; i < 70; i++) tryAdd(rr(118, 190), rr(-14, 34), rr(.8, 1.4));
  for (let i = 0; i < 26; i++) { const x = rr(-12, 114); tryAdd(x, rr(-24, -15), rr(.9, 1.3)); }
  const trunk = new THREE.InstancedMesh(GEO.cyl, std(0x4a3626, 1), pts.length), crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), std(0xffffff, .95, 0, { flatShading: true }), pts.length * 3);
  const mm = new THREE.Matrix4(), col = new THREE.Color(); let k = 0;
  pts.forEach(([x, z, s], i) => {
    const y = z < -110 ? 6 : 0;
    mm.compose(V(x, y + 2 * s, z), qY(0), V(.5 * s, 4 * s, .5 * s)); trunk.setMatrixAt(i, mm);
    for (let j = 0; j < 3; j++) { mm.compose(V(x + rr(-1.3, 1.3) * s, y + (4.6 + rr(0, 2.2)) * s, z + rr(-1.3, 1.3) * s), qY(rr(0, 6)), V(rr(2, 3) * s, rr(1.8, 2.6) * s, rr(2, 3) * s)); crown.setMatrixAt(k, mm);
      crown.setColorAt(k++, col.setHSL(rr(.18, .27), rr(.25, .4), rr(.22, .34))); }
  });
  trunk.castShadow = crown.castShadow = true; build.add(trunk, crown);
}

/* ---------- building shell from the plan ---------- */
// floors
function floor(x1, y1, x2, y2, map, rep) { const t = map.clone(); t.needsUpdate = true; t.repeat.set((x2 - x1) * S / rep, (y2 - y1) * S / rep);
  const m = new THREE.Mesh(new THREE.PlaneGeometry((x2 - x1) * S, (y2 - y1) * S), std(0xffffff, map === woodTex ? .5 : .32, 0, { map: t, envMapIntensity: .5 }));
  m.rotation.x = -Math.PI / 2; m.position.set(X((x1 + x2) / 2), .02, Z((y1 + y2) / 2)); m.receiveShadow = true; scene.add(m); }
floor(66, 232, 321, 461, terrazzoTex, 4); floor(321, 232, 1424, 461, floorTex, 6); floor(321, 461, 575, 690, woodTex, 5); floor(915, 461, 1169, 690, floorTex, 6);

// exterior walls (W / N / E of main bar, wings, junction arcades)
facade(66, 461, 66, 232, { open: [{ u: 4.3, w: 2.6, sill: .02, top: 3.6 }, { u: 10.2, w: 2.6, sill: .02, top: 3.6 }, { u: 14.5 }] });
facade(66, 232, 1424, 232); facade(1424, 232, 1424, 461, { open: [{ u: 4 }, { u: 12.2, w: 2.4, sill: .02, top: 3.4 }] });
facade(1424, 461, 1169, 461); facade(915, 461, 575, 461); facade(321, 461, 66, 461);
facade(321, 461, 575, 461, { arcade: true, t: .5 }); facade(915, 461, 1169, 461, { arcade: true, t: .5 });
facade(321, 690, 321, 461); facade(575, 461, 575, 690);
facade(575, 690, 321, 690, { open: [{ u: 1.6 }, { u: 6.0, w: 2.2, sill: .02, top: 3.4 }, { u: 10.9, w: 2.2, sill: .02, top: 3.4 }, { u: 15.4 }] });
facade(915, 690, 915, 461); facade(1169, 461, 1169, 690); facade(1169, 690, 915, 690);
gable(X(66), Z(232), X(1424), Z(461), true, 6.375);
gable(X(321), Z(461), X(575), Z(690), false, 5.73); gable(X(915), Z(461), X(1169), Z(690), false, 5.73);

/* ---------- KARŞILAMA / lobby (axes 1–4) ---------- */
wall(66, 311, 206, 311); wall(229, 311, 321, 311); wall(234, 232, 234, 311); wall(278, 232, 278, 311, 2.6);
for (const x of [250, 262, 294, 306]) wall(x, 240, x, 262, 2.2, M.white, .05);
// lounge sofas (organic) + bar
for (const [x, y, l, r] of [[107, 263, 3.0, .7], [151, 267, 2.1, .6]]) { add('sph', M.burg, V(X(x), .4, Z(y)), qY(.35), V(l, .8, r * 2)); add('sph', M.fabric, V(X(x), .55, Z(y)), qY(.35), V(l * .7, .5, r * 1.2)); }
bx(M.wood, 178, 247, 216, 256, 0, 1.05); bx(M.dark, 178, 247, 216, 256, 1.05, .06);
// stairs (U-shaped, two flights) & glass lift
for (let i = 0; i < 12; i++) { const f = i / 12; bx(M.white, 119 + f * 71, 351, 119 + (f + 1 / 12) * 71, 376, 0, .18 + i * .155); bx(M.white, 190 - (f + 1 / 12) * 71, 376, 190 - f * 71, 401, 0, 2.05 + i * .155); }
bx(M.white, 114, 351, 124, 401, 0, 2.05); glassWall(119, 376, 190, 376, 4.4);
bx(M.dark, 190, 355, 226, 357, 0, 8.4); bx(M.dark, 190, 399, 226, 401, 0, 8.4); glassWall(190, 357, 190, 399, 8.4); glassWall(226, 357, 226, 399, 8.4);
bx(M.brass, 196, 362, 220, 394, 2.6, 2.2);
// reception desk, pedestals
bx(M.burg, 98, 441, 136, 449, 0, 1.05); bx(M.woodL, 97, 440, 137, 450, 1.05, .07);
for (let i = 0; i < 4; i++) { bx(M.white, 165 + i * 15, 444, 172 + i * 15, 451, 0, 1.0); sph(M.brass, X(168.5 + i * 15), 1.22, Z(447.5), .2, .26, .2); }
// DİJİTAL ALAN
wall(234, 338, 321, 338, 3.6); wall(234, 338, 234, 360, 3.6); wall(234, 390, 234, 412, 3.6); wall(277, 338, 277, 350, 3.6);
{ const g = new THREE.CylinderGeometry(1.7, 1.7, 2.6, 40, 1, true, -1.1, 2.2); for (const [x, y, r] of [[252, 356, 0], [252, 356, Math.PI]]) { const m = new THREE.Mesh(g, M.screen); m.position.set(X(x), 1.45, Z(y)); m.rotation.y = r - .4; build.add(m); } }
{ const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), M.screen); m.position.set(X(300), 2.1, Z(339) + .12); build.add(m);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(4, 3.4), M.screen); f.rotation.x = -Math.PI / 2; f.position.set(X(300), .04, Z(390)); build.add(f); }
bx(M.white, 243, 385, 252, 408, 0, .9);

/* ---------- DEĞİŞEN SERGİ ALANI (axes 4–7): Göbeklitepe-like ring ---------- */
wall(321, 232, 321, 412, 3.6); wall(575, 232, 575, 412, 3.6); wall(321, 412, 417, 412, 3.6); wall(496, 412, 575, 412, 3.6);
{
  const cx = X(449), cz = Z(314);
  const prof = [[3.8, 0], [3.8, .35], [3.5, .35], [3.5, .7], [3.2, .7], [3.2, 1.05], [2.95, 1.05], [2.95, 0]].map(([r, y]) => new THREE.Vector2(r, y));
  const ring = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), std(0xd2bf9c, .95, 0, { map: stoneTex })); ring.position.set(cx, 0, cz); ring.castShadow = ring.receiveShadow = true; build.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.95, 64), M.earth); disc.rotation.x = -Math.PI / 2; disc.position.set(cx, .05, cz); disc.receiveShadow = true; build.add(disc);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, x = cx + Math.cos(a) * 2.4, z = cz + Math.sin(a) * 2.4;
    box(M.pillar, x, 0, z, .32, 1.7, .62, -a); box(M.pillar, x - Math.cos(a) * .12, 1.7, z - Math.sin(a) * .12, .62, .34, .68, -a); }
  for (const s of [-1, 1]) { box(M.pillar, cx + s * .75, 0, cz, .4, 2.5, .85, Math.PI / 2); box(M.pillar, cx + s * .75 - s * .12, 2.5, cz, .82, .46, .9, Math.PI / 2); }
  for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, r = rr(3.05, 3.7); sph(M.stoneD, cx + Math.cos(a) * r, 1.1, cz + Math.sin(a) * r, rr(.08, .16), .07, rr(.08, .16)); }
  // circulation arcs and curved panels
  for (const [x, y, rot] of [[387, 367, .5], [504, 367, -.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 24, 1, true, 0, 1.5), M.white); p.position.set(X(x), 1.2, Z(y)); p.rotation.y = rot + (rot > 0 ? 2.4 : -.8); build.add(p); }
  for (let i = 0; i <= 10; i++) { const a = Math.PI + .25 + i * .13; box(M.wood, X(341) + Math.cos(a) * 2.2 + 1.6, 0, Z(258) + Math.sin(a) * -1.6 + .2, .55, .45, .6, -a); }
}
function vitrine(x, z, w, d, h = 2.0, obj = 'vase') {
  box(M.white, x, 0, z, w, .95, d); box(M.glass, x, .95, z, w - .04, h - .95, d - .04); box(M.dark, x, h, z, w, .04, d);
  if (obj === 'vase') { cyl(M.burg, x, .95, z, Math.min(w, d) * .22, .28); sph(M.burg, x, 1.35, z, Math.min(w, d) * .28, .26); cyl(M.burg, x, 1.55, z, Math.min(w, d) * .1, .2); }
  else if (obj === 'tablet') box(M.pillar, x, .95, z, w * .6, .5, .08);
  else sph(M.brass, x, 1.2, z, .14);
}
for (let i = 0; i < 4; i++) vitrine(X(334.5), Z(275 + i * 26), .55, 1.6, 2.2, 'tablet');
for (let i = 0; i < 4; i++) vitrine(X(563.5), Z(281 + i * 25), .55, 1.6, 2.2, 'tablet');
for (const x of [357.5, 539.5]) for (let i = 0; i < 3; i++) vitrine(X(x), Z(315 + i * 15), .85, 1.0, 1.9);
for (let i = 0; i < 7; i++) vitrine(X(420 + i * 10.6), Z(244.5), .6, .5, 1.75, 'orb');
for (let i = 0; i < 7; i++) vitrine(X(516 + i * 8.6), Z(399), .55, .7, 1.75, ['vase', 'orb', 'tablet'][i % 3]);
box(M.white, X(450), 0, Z(388.5), 2.9, .9, .7); box(M.glass, X(450), .9, Z(388.5), 2.85, .7, .65);

/* ---------- KALICI SERGİ ALANI: İstanbul time-topography model on earth floor ---------- */
{
  bx(std(0xe3d6bf, .9), 639, 264, 924, 402, 0, .2); bx(M.wood, 663, 288, 900, 379, .2, .7);
  const x0 = X(668), x1 = X(895), z0 = Z(293), z1 = Z(374), W = x1 - x0, D = z1 - z0, top = .92;
  const wat = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.minWater); wat.rotation.x = -Math.PI / 2; wat.position.set((x0 + x1) / 2, top, (z0 + z1) / 2); build.add(wat);
  const P = (u, v) => new THREE.Vector2(x0 + u * W, -(z0 + v * D));
  const land = (pts, h = .14) => { const s = new THREE.Shape(pts.map(([u, v]) => P(u, v))); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: .04, bevelSize: .06, bevelSegments: 2 }), M.earth); m.rotation.x = -Math.PI / 2; m.position.y = top - .02; m.castShadow = m.receiveShadow = true; build.add(m); };
  land([[0, 0], [.58, 0], [.6, .24], [.53, .4], [.6, .55], [.57, .74], [.5, .79], [.42, .7], [.3, .86], [.12, .82], [.03, .58], [0, .5]]);
  land([[.79, 0], [1, 0], [1, 1], [.62, 1], [.64, .84], [.67, .7], [.73, .55], [.71, .36], [.76, .16]]);
  land([[.69, .8], [.72, .77], [.73, .82]], .08); land([[.75, .76], [.78, .75], [.77, .79]], .08);
  const halic = new THREE.Shape([[.53, .42], [.4, .43], [.33, .48], [.41, .47], [.53, .47]].map(([u, v]) => P(u, v)));
  const hm = new THREE.Mesh(new THREE.ShapeGeometry(halic), M.minWater); hm.rotation.x = -Math.PI / 2; hm.position.y = top + .13; build.add(hm);
  const T = top + .12, mono = std(0xf1e9da, .7);
  const mosque = (x, z, s) => { box(mono, x, T, z, 1.3 * s, .35 * s, 1.3 * s); dome(mono, x, T + .35 * s, z, .5 * s, .42 * s);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cyl(mono, x + a * .62 * s, T, z + b * .62 * s, .045 * s, 1.1 * s); cone(mono, x + a * .62 * s, T + 1.1 * s, z + b * .62 * s, .06 * s, .22 * s); } };
  mosque(47.9, 7.1, 1.15); mosque(59.5, 6.3, 1.0);
  box(mono, 48.0, T, 8.85, 2.4, .3, .8); for (let i = 0; i < 9; i++) cyl(mono, 47.0 + i * .25, T + .3, 8.55, .04, .25);
  for (const [dx, dz, w, d] of [[0, 0, 2.6, .5], [-.9, .45, .8, .9], [.9, .45, .8, .9], [0, -.4, 1.2, .35]]) box(mono, 50.6 + dx, T, 5.85 + dz, w, .32, d);
  cyl(mono, 53.7, T, 6.1, .26, 1.5); cone(M.burg, 53.7, T + 1.5, 6.1, .3, .5);
  box(mono, 53.5, T, 8.9, .5, .2, .5); add('box', mono, V(53.5, T + .7, 8.9), qY(.6), V(.14, 1.0, .14));
  box(mono, 59.0, T, 8.5, 1.1, .32, .36); box(mono, 59.0, T, 8.5, .36, .32, 1.1); cyl(mono, 59.0, T + .32, 8.5, .22, .2); dome(mono, 59.0, T + .52, 8.5, .22);
  for (let i = 0; i < 40; i++) { const u = rr(.05, .55), v = rr(.05, .7); if (Math.abs(u - .16) < .07 && Math.abs(v - .41) < .14) continue; box(mono, x0 + u * W, T, z0 + v * D, rr(.15, .35), rr(.08, .22), rr(.15, .35), rr(0, 1)); }
  for (let i = 0; i < 26; i++) { const u = rr(.76, .97), v = rr(.08, .9); box(mono, x0 + u * W, T, z0 + v * D, rr(.15, .3), rr(.08, .2), rr(.15, .3), rr(0, 1)); }
  // glass balustrade + plaques + benches
  for (const [a, b, c, d] of [[655, 282, 908, 282], [655, 385, 908, 385], [655, 282, 655, 385], [908, 282, 908, 385]]) glassWall(a, b, c, d, 1.25);
  for (const x of [700, 760, 820, 880]) bx(M.burg, x - 6, 387, x + 6, 390, .2, .9);
  for (const x of [690, 790, 890]) bx(M.woodL, x - 18, 412, x + 18, 420, 0, .45);
  for (const x of [700, 800]) bx(M.woodL, x - 18, 247, x + 18, 255, 0, .45);
}

/* ---------- east block: visible storage, conservation, offices (axes 12–17) ---------- */
wall(1003, 232, 1003, 319, 4); wall(1003, 341, 1003, 384, 4); wall(1003, 406, 1003, 461, 4);
for (const x of [1085, 1170, 1254, 1339]) wall(x, 232, x, 318, 4);
glassWall(1003, 318, 1170, 318, 4); wall(1170, 318, 1339, 318, 4);
wall(1003, 341, 1424, 341, 3.4); wall(1003, 384, 1150, 384, 3.4); wall(1175, 384, 1424, 384, 3.4);
for (const x of [1066, 1089, 1175, 1213, 1256, 1300, 1319, 1363]) wall(x, 341, x, 384, 3.4);
wall(1067, 408, 1424, 408, 3.4); for (const x of [1067, 1168, 1253, 1314, 1375]) wall(x, 408, x, 461, 3.4);
for (const y of [254, 283]) add('sph', M.white, V(X(1044), .9, Z(y)), qY(0), V(2.7, .12, 1.0)), bx(M.dark, 1036, y - 2, 1052, y + 2, 0, .85);
for (const x of [1117, 1128, 1139]) for (const y of [258, 285]) { bx(M.white, x - 3, y - 7, x + 3, y + 7, 0, .9); bx(M.burg, x - 1.5, y - 3, x + 1.5, y + 3, .9, .3); }
bx(M.wood, 1194, 253, 1228, 298, 0, 2.4); for (let i = 0; i < 5; i++) bx(M.woodL, 1195, 254 + i * 9, 1227, 254 + i * 9 + 1, 0, 2.5);
for (const x of [1278, 1305]) { bx(M.dark, x, 253, x + 11, 298, 0, .06); for (let k = 0; k < 4; k++) bx(M.dark, x, 253, x + 11, 298, .6 + k * .8, .05); for (let k = 0; k < 6; k++) bx(M.fabric, x + 1, 256 + k * 7, x + 10, 261 + k * 7, .66 + (k % 4) * .8, .45); }
// offices
bx(M.wood, 1110, 427, 1125, 440, 0, .76); bx(M.fabric, 1075, 424, 1082, 452, 0, .55);
bx(M.woodL, 1190, 425, 1230, 442, 0, .76); for (let i = 0; i < 5; i++) for (const y of [421, 446]) bx(M.burgD, 1192 + i * 8, y - 2, 1197 + i * 8, y + 2, 0, .9);
for (const x of [1280, 1340]) bx(M.woodL, x, 424, x + 14, 444, 0, .76);
bx(M.woodL, 1340, 351, 1356, 374, 0, .76); bx(M.white, 1405, 345, 1422, 380, 0, .9);

/* ---------- south-west wing: KAFE & DENİZ ULAŞIMI ---------- */
wall(321, 535, 390, 535, 3); wall(390, 461, 390, 535, 3); wall(354, 461, 354, 535, 3); wall(477, 461, 477, 511, 3.4);
bx(M.burg, 512, 484, 572, 497, 0, 1.05); bx(M.woodL, 511, 483, 573, 498, 1.05, .06); bx(M.wood, 525, 462, 573, 470, 0, 2.2);
for (let i = 0; i < 4; i++) { bx(M.brass, 520 + i * 14, 485, 523 + i * 14, 488, 1.11, .45); }
function table(x, z, r = .45) { cyl(M.dark, x, 0, z, .05, .72); cyl(M.woodL, x, .72, z, r, .04);
  for (let a = 0; a < 4; a++) { const ax = x + Math.cos(a * 1.57) * (r + .3), az = z + Math.sin(a * 1.57) * (r + .3); box(M.burgD, ax, 0, az, .42, .46, .42, a * 1.57); box(M.burgD, ax + Math.cos(a * 1.57) * .2, .46, az + Math.sin(a * 1.57) * .2, .06, .4, .42, a * 1.57); } }
for (const [x, y] of [[516, 542], [538, 542], [510, 571], [530, 571], [550, 571], [516, 588], [538, 588]]) table(X(x), Z(y));
for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI; box(M.burg, X(444) + Math.cos(a) * 2.6, 0, Z(548) + Math.sin(a) * -1.3 + .6, .6, .45, .8, -a + Math.PI / 2); }
{ const sh = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 32, 1, true, -Math.PI / 2, Math.PI), M.burgD); sh.position.set(X(444), 1.6, Z(600)); sh.rotation.y = Math.PI; build.add(sh);
  for (let i = 0; i < 7; i++) bx(M.woodL, 420 + i * 7, 607, 425 + i * 7, 611, 0, .45); }
for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const x = X(334 + i * 9.5), z = Z(593 + r * 16); box(M.fabric, x, 0, z, .55, .45, .55); box(M.fabric, x, .45, z - .25, .55, .45, .08); }
for (let i = 0; i < 5; i++) { bx(M.dark, 334 + i * 13, 643, 336 + i * 13, 653, 0, 1.0); }
bx(M.burg, 322, 648, 335, 653, 0, 1.0);
for (const x of [405, 432]) { bx(M.dark, x - 3, 645, x + 3, 688, 0, .6); for (let i = 0; i < 9; i++) sph(M.green, X(x) + rr(-.2, .2), rr(.8, 2.2), Z(648 + i * 4.6), rr(.35, .55)); }
for (const [x, w] of [[448, 30], [497, 18], [535, 30]]) { bx(M.fabric, x, 660, x + w, 668, 0, .45); bx(M.fabric, x, 666, x + w, 669, .45, .45); }
for (const x of [455, 503, 540]) bx(M.woodL, x, 673, x + 13, 680, 0, .4);
for (const [x, y] of [[476, 504], [559, 534], [557, 582], [369, 476]]) { cyl(M.dark, X(x), 0, Z(y), .3, .55); sph(M.green2, X(x), 1.2, Z(y), .55, .8); }

// pier & dock to the ferry
{
  const dy = -.15;
  for (const [a, b] of [[347, 368], [408, 428]]) { bx(M.deck, a, 690, b, 792, dy, .2); for (let y = 695; y < 792; y += 14) for (const x of [a, b]) bx(M.dark, x - .8, y, x + .8, y + 1.6, -1.6, 2.5); }
  bx(M.deck, 307, 792, 430, 822, dy, .2);
  for (let x = 309; x < 430; x += 14) { bx(M.dark, x, 820, x + 1.5, 822, -1.6, 2.45); bx(M.dark, x, 792, x + 1.5, 794, -1.6, 2.45); }
  for (const y of [821, 793]) bx(M.dark, 307, y, 430, y + .8, .95, .05);
  for (const [x, y] of [[340, 812], [400, 812]]) { bx(M.burg, x, y - 2, x + 25, y, .05, 2.6); bx(M.burgD, x - 2, y - 6, x + 27, y + 3, 2.6, .12); }
  // Bosphorus ferry (vapur)
  const fx = 14, fz = 48.6, L = 22, Wd = 6.2;
  const hull = new THREE.Shape(); hull.moveTo(-L / 2, -Wd / 2); hull.lineTo(L / 2 - 2, -Wd / 2); hull.quadraticCurveTo(L / 2 + 1, 0, L / 2 - 2, Wd / 2); hull.lineTo(-L / 2 + 2, Wd / 2); hull.quadraticCurveTo(-L / 2 - 1, 0, -L / 2 + 2, -Wd / 2);
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 2.4, bevelEnabled: false });
  const h1 = new THREE.Mesh(hg, M.hullD); h1.rotation.x = -Math.PI / 2; h1.position.set(fx, -2.0, fz); h1.scale.z = .6;
  const h2 = new THREE.Mesh(hg, M.hull); h2.rotation.x = -Math.PI / 2; h2.position.set(fx, -.56, fz); h2.scale.set(1.01, 1.01, .55);
  build.add(h1, h2); h1.castShadow = h2.castShadow = true;
  box(M.hull, fx, .76, fz, L - 6, 2.3, Wd - 1.4); box(M.glass, fx, 1.1, fz, L - 5.9, 1.2, Wd - 1.3); box(M.hullD, fx, 3.06, fz, L - 5, .15, Wd - .8);
  box(M.hull, fx + 1, 3.2, fz, 6, 1.6, 3.4); box(M.glass, fx + 1, 3.5, fz, 6.05, .8, 3.45);
  cyl(M.funnel, fx - 2.5, 3.2, fz, .65, 2.7); cyl(M.hullD, fx - 2.5, 5.9, fz, .7, .4);
}

/* ---------- south-east wing: ATÖLYE + TOPLANTI + JÜRİ SINIFI ---------- */
wall(1069, 461, 1069, 500, 3.6); wall(1069, 520, 1069, 560, 3.6); wall(1069, 585, 1069, 690, 3.6);
for (let i = 0; i < 10; i++) { const xa = X(1069 + i * 10), xb = X(1069 + (i + 1) * 10), za = Z(i % 2 ? 547 : 557), zb = Z(i % 2 ? 557 : 547);
  add('box', M.white, V((xa + xb) / 2, 1.6, (za + zb) / 2), qY(-Math.atan2(zb - za, xb - xa)), V(Math.hypot(xb - xa, zb - za), 3.2, .08)); }
for (const x of [1002, 1047]) { bx(M.white, x - .8, 470, x + .8, 570, 0, 2.8); bx(M.white, x - .8, 590, x + .8, 680, 0, 2.8); }
for (const x of [940, 982]) for (const y of [518, 578, 632]) {
  bx(M.woodL, x - 13, y - 6, x + 13, y + 6, .72, .06); bx(M.dark, x - 12, y - 5, x - 11, y + 5, 0, .72); bx(M.dark, x + 11, y - 5, x + 12, y + 5, 0, .72);
  for (const dx of [-6, 6]) for (const dy of [-11, 11]) cyl(M.burg, X(x + dx), 0, Z(y + dy), .2, .48);
  bx(M.white, x - 8, y - 3, x - 2, y + 2, .78, .12); sph(M.burgD, X(x + 5), .9, Z(y), .12, .14);
}
for (const x of [930, 956, 984, 1004]) { add('box', M.fabric, V(X(x), .25, Z(670)), qY(rr(-.5, .5)), V(.8, .5, .8)); }
bx(M.woodL, 1083, 499, 1150, 511, .74, .06); bx(M.dark, 1112, 501, 1121, 509, 0, .74);
for (let i = 0; i < 6; i++) for (const y of [495, 515]) bx(M.burgD, 1085 + i * 11, y - 2, 1091 + i * 11, y + 2, 0, .9);
for (let c = 0; c < 3; c++) for (let r = 0; r < (c === 2 ? 7 : 8); r++) { const x = X(1080 + c * 15), z = Z(590 + r * 11 + (c % 2) * 5); box(M.burg, x, 0, z, .5, .46, .5); box(M.burg, x - .22, .46, z, .07, .45, .5); }
bx(M.white, 1137, 560, 1141, 620, 0, 2.6); bx(M.white, 1156, 590, 1160, 680, 0, 2.6); bx(M.burgD, 1137.5, 570, 1140.5, 610, .9, 1.4);


/* ---------- 1. ASMA KAT: time ramp — platforms rise with the centuries (+4.00 → +7.50) ---------- */
const MZ = [
  { id: 'tarih', x1: 27.4, z1: 9.3, x2: 38.8, z2: 16.9, e: 4.5 }, { id: 'byzantion', x1: 47.4, z1: 9.0, x2: 56.8, z2: 16.9, e: 5.0 },
  { id: 'konst', x1: 65.4, z1: 8.6, x2: 79.7, z2: 16.9, e: 5.5 }, { id: 'bizans', x1: 88.3, z1: .3, x2: 95.7, z2: 16.9, e: 6.0 },
  { id: 'osmanli', x1: 69.3, z1: .3, x2: 79.6, z2: 8.4, e: 6.5 }, { id: 'cumhuriyet', x1: 49.4, z1: .3, x2: 60.7, z2: 7.5, e: 7.0 },
  { id: 'gunumuz', x1: 26.6, z1: 1.6, x2: 40.7, z2: 8.4, e: 7.5 }
];
const DIN = [[.3, .3, 19.1, 8.8], [.3, 8.8, 3.8, 13.2], [12.2, 8.8, 19.1, 13.2]];
const RAMPS = [[19.1, 11.5, 4.0, 27.4, 4.5], [38.8, 13, 4.5, 47.4, 5.0], [56.8, 13, 5.0, 65.4, 5.5], [79.7, 13, 5.5, 88.3, 6.0],
  [88.3, 4.6, 6.0, 79.6, 6.5], [69.3, 2.4, 6.5, 60.7, 7.0], [49.4, 2.4, 7.0, 40.7, 7.5]];
const RW = 2.3, gaps = [];
for (const [xa, z, , xb] of RAMPS) for (const x of [xa, xb]) gaps.push({ x, z0: z - RW / 2 - .05, z1: z + RW / 2 + .05 });
gaps.push({ x: 26.6, z0: 6.2, z1: 8.2 }, { x: 19.1, z0: 6.2, z1: 8.2 });
const ringW = [X(449), Z(314)], modelR = [43, 2.4, 64.3, 12.8];
const floorM = std(0xffffff, .55, 0, { map: woodTex }), fascia = std(0x3a3532, .5, .4);
function slab(x1, z1, x2, z2, e) {
  box(M.trim, (x1 + x2) / 2, e - .38, (z1 + z2) / 2, x2 - x1, .34, z2 - z1); box(floorM, (x1 + x2) / 2, e - .04, (z1 + z2) / 2, x2 - x1, .04, z2 - z1);
  for (const [a, b, c, d] of [[x1, z1, x2, z1], [x1, z2, x2, z2]]) box(fascia, (a + c) / 2, e - .42, b, c - a, .42, .06);
  for (const x of [x1, x2]) box(fascia, x, e - .42, (z1 + z2) / 2, .06, .42, z2 - z1);
}
function railSeg(a, b, e) {
  const d = b.clone().sub(a), L = d.length(); if (L < .2) return; const ry = -Math.atan2(d.z, d.x), m = a.clone().lerp(b, .5);
  box(M.glass, m.x, e, m.z, L, 1.0, .03, ry); box(M.dark, m.x, e + 1.0, m.z, L, .05, .07, ry);
  const n = Math.max(1, Math.round(L / 1.5)); for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); box(M.dark, p.x, e, p.z, .05, 1.0, .05); }
}
function railEdge(x1, z1, x2, z2, e) {
  if (z1 === z2) { railSeg(V(x1, 0, z1), V(x2, 0, z2), e); return; }
  const cuts = gaps.filter(g => Math.abs(g.x - x1) < .2 && g.z1 > z1 && g.z0 < z2).sort((a, b) => a.z0 - b.z0); let z = z1;
  for (const g of cuts) { railSeg(V(x1, 0, z), V(x1, 0, Math.max(z, g.z0)), e); z = g.z1; } railSeg(V(x1, 0, z), V(x1, 0, z2), e);
}
function support(x, z, e) {
  const inModel = x > modelR[0] - .3 && x < modelR[2] + .3 && z > modelR[1] - .3 && z < modelR[3] + .3, inRing = Math.hypot(x - ringW[0], z - ringW[1]) < 4.6;
  if (inModel || inRing) beam(M.dark, V(x, e, z), V(x, H - .3, z), .05); else cyl(M.dark, x, 0, z, .11, e - .38);
}
for (const p of MZ) {
  slab(p.x1, p.z1, p.x2, p.z2, p.e);
  railEdge(p.x1, p.z1, p.x2, p.z1, p.e); railEdge(p.x1, p.z2, p.x2, p.z2, p.e); railEdge(p.x1, p.z1, p.x1, p.z2, p.e); railEdge(p.x2, p.z1, p.x2, p.z2, p.e);
  const nx = Math.max(1, Math.round((p.x2 - p.x1) / 5)), nz = Math.max(1, Math.round((p.z2 - p.z1) / 5));
  for (let i = 0; i <= nx; i++) for (const z of [p.z1 + .3, p.z2 - .3]) support(p.x1 + .3 + (p.x2 - p.x1 - .6) * i / nx, z, p.e);
  for (let j = 1; j < nz; j++) for (const x of [p.x1 + .3, p.x2 - .3]) support(x, p.z1 + (p.z2 - p.z1) * j / nz, p.e);
}
for (const [a, b, c, d] of DIN) slab(a, b, c, d, 4.0);
railEdge(.3, 13.2, 3.8, 13.2, 4); railEdge(12.2, 13.2, 19.1, 13.2, 4); railEdge(19.1, 5.9, 19.1, 13.2, 4); railEdge(3.8, 8.8, 9.2, 8.8, 4);
for (const x of [3.8, 12.2, 19.1]) cyl(M.dark, x - .15, 0, 13.0, .12, 3.62);
// ramps
for (const [xa, z, ea, xb, eb] of RAMPS) {
  const A = V(xa, ea - .12, z), B = V(xb, eb - .12, z); add('box', M.trim, A.clone().lerp(B, .5), new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), B.clone().sub(A).normalize()), V(Math.abs(xb - xa), .24, RW));
  for (const s of [-1, 1]) { const off = V(0, 0, s * RW / 2); const a = A.clone().add(off).setY(ea + .5), b = B.clone().add(off).setY(eb + .5);
    add('box', M.glass, a.clone().lerp(b, .5), new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), b.clone().sub(a).normalize()), V(Math.abs(xb - xa), 1.0, .03));
    beam(M.dark, a.clone().setY(ea + 1.02), b.clone().setY(eb + 1.02), .06); }
  for (let i = 1; i < 3; i++) { const p = A.clone().lerp(B, i / 3); support(p.x, z, p.y + .12); }
}
// stair from Günümüz (+7.50) back down to the rest area (+4.00)
for (let i = 0; i < 20; i++) { const x = 26.6 - (i + .5) * .375; box(M.white, x, 7.5 - (i + 1) * .175 - .16, 7.2, .4, .16, 1.8); }
for (const z of [6.35, 8.05]) beam(M.dark, V(26.6, 7.3, z), V(19.1, 3.8, z), .12);
railSeg(V(26.6, 0, 6.3), V(19.1, 0, 6.3), 5.75); railSeg(V(26.6, 0, 8.1), V(19.1, 0, 8.1), 5.75);
// mezzanine WC block & rest area (Dinlenme Alanı 86 m²)
for (const [x1, y1, x2, y2] of [[234, 232, 234, 311], [234, 311, 321, 311], [278, 232, 278, 311], [321, 232, 321, 311]]) {
  if (y1 === y2) box(M.plaster, X((x1 + x2) / 2), 4, Z(y1), (x2 - x1) * S, 3, .16); else box(M.plaster, X(x1), 4, Z((y1 + y2) / 2), .16, 3, (y2 - y1) * S);
}
for (const [x, z] of [[4.2, 1.6], [12.2, 1.6]]) { add('sph', M.burg, V(x, 4.4, z), qY(0), V(3.6, .8, 1.3)); add('sph', M.fabric, V(x, 4.55, z + .1), qY(0), V(2.6, .5, .8));
  cyl(M.white, x - .6, 4, z + 2.4, .55, .45); for (const dx of [-2, .6]) cyl(M.burgD, x + dx, 4, z + 3.0, .35, .42); }
for (let i = 0; i < 3; i++) { box(M.white, 10.2, 4, 3 + i * 2.2, .45, 1.6, 1.2); box(M.glass, 10.2, 5.6, 3 + i * 2.2, .44, .6, 1.18); }
// exhibits per era
function mvit(x, y, z, w, d, obj) { box(M.white, x, y, z, w, .9, d); box(M.glass, x, y + .9, z, w - .04, .6, d - .04); if (obj) sph(obj, x, y + 1.1, z, Math.min(w, d) * .22); }
function mosqueAt(x, y, z, s, m) { box(m, x, y, z, 1.4 * s, .4 * s, 1.4 * s); dome(m, x, y + .4 * s, z, .55 * s, .45 * s);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { cyl(m, x + a * .66 * s, y, z + b * .66 * s, .05 * s, 1.2 * s); cone(m, x + a * .66 * s, y + 1.2 * s, z + b * .66 * s, .07 * s, .25 * s); } }
const mono2 = std(0xf1e9da, .7), P_ = id => MZ.find(p => p.id === id);
{ const p = P_('tarih'), cx = 33.5, cz = 13.2, y = p.e;
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, .8, 6), M.white); hex.position.set(cx, y + .4, cz); build.add(hex);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, .1, 6), M.earth); top.position.set(cx, y + .85, cz); build.add(top);
  for (let i = 0; i < 14; i++) sph(M.stoneD, cx + rr(-1.2, 1.2), y + .95, cz + rr(-.9, .9), rr(.12, .3), rr(.1, .35), rr(.12, .3));
  for (let i = 0; i < 6; i++) { const a = -2.4 + i * .28; box(M.white, cx + Math.cos(a) * 3.8 - 1, y, cz + Math.sin(a) * 2.6 + .4, .7, 1.1, .5, -a); }
  for (let i = 0; i < 8; i++) mvit(28.6 + i * 1.3, y, 16.3, 1.0, .5, i % 2 ? M.burg : M.stoneD); }
{ const p = P_('byzantion'), cx = 52.1, cz = 12.4, y = p.e;
  add('cyl', M.white, V(cx, y + .45, cz), qY(0), V(3.8, .9, 1.7)); box(M.wood, cx - .4, y + .9, cz, 1.6, .25, .45); beam(M.dark, V(cx - .4, y + 1.1, cz), V(cx - .4, y + 2.0, cz), .04);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const a = -.6 + i * .4; box(M.white, cx + s * (3.4 - Math.abs(Math.sin(a)) * .5), y, cz + Math.sin(a) * 2.2, .5, 1.05, .9, s * a); }
  for (let i = 0; i < 3; i++) mvit(50.6 + i * 1.5, y, 16.3, 1.1, .55, M.brass); }
{ const p = P_('konst'), cx = 72.6, cz = 12.6, y = p.e;
  add('cyl', M.white, V(cx, y + .35, cz), qY(0), V(5.4, .7, 2.2)); add('cyl', M.earth, V(cx, y + .72, cz), qY(0), V(4.4, .06, 1.2));
  box(M.white, cx, y + .7, cz, 2.6, .12, .14); add('box', mono2, V(cx - .6, y + 1.2, cz), qY(0), V(.1, .9, .1)); cyl(mono2, cx + .6, y + .7, cz, .06, .8);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const a = -.8 + i * .4; box(M.white, cx + s * (5.4 - Math.abs(Math.sin(a)) * .8), y, cz + Math.sin(a) * 3, .6, 1.1, 1.0, s * a); }
  for (const [dx, dz] of [[-5.5, -3.2], [5.5, -3.2], [-5.5, 3.6], [5.5, 3.6]]) { cyl(M.white, cx + dx, y, cz + dz, .45, .95); sph(M.brass, cx + dx, y + 1.15, cz + dz, .22); }
  for (let i = 0; i < 4; i++) mvit(68 + i * 2.6, y, 9.1, 1.8, .55, null); }
{ const p = P_('bizans'), cx = 92, cz = 8.6, y = p.e;
  box(M.white, cx, y, cz, 2.4, .85, 4.0); mosqueAt(cx, y + .85, cz, 1.25, mono2);
  for (let i = 0; i < 3; i++) mvit(89.2, y, 3 + i * 4.6, .55, 1.6, i % 2 ? M.brass : M.burg);
  for (let i = 0; i < 4; i++) box(M.white, 94.9 - Math.abs(i - 1.5) * .3, y, 7 + i * 1.1, .55, 1.05, 1.0, .2); }
{ const p = P_('osmanli'), cx = 74.4, cz = 3.9, y = p.e;
  box(M.white, cx, y, cz, 3.2, .85, 2.2); for (let i = 0; i < 14; i++) box(mono2, cx + rr(-1.3, 1.3), y + .85, cz + rr(-.8, .8), rr(.2, .5), rr(.1, .3), rr(.2, .5));
  for (const [dx, dz] of [[-.6, -.2], [.7, .3]]) dome(mono2, cx + dx, y + 1.05, cz + dz, .22);
  for (const x of [70.4, 78.5]) box(M.burg, x, y, cz, .6, 1.4, 1.6); for (let i = 0; i < 3; i++) mvit(71.8 + i * 2.6, y, 7.6, 1.4, .5, null); }
{ const p = P_('cumhuriyet'), cx = 55.4, cz = 3.4, y = p.e;
  add('cyl', M.white, V(cx, y + .4, cz), qY(0), V(4.2, .8, 2.0)); box(M.dark, cx, y + .8, cz, 3.2, .04, .2);
  for (let i = 0; i < 5; i++) box(i ? M.burg : M.dark, cx - 1.4 + i * .66, y + .84, cz, .6, .26, .26); box(M.dark, 59.9, y, cz, .5, 1.6, 1.3);
  for (let i = 0; i < 2; i++) mvit(51.5 + i * 2, y, 6.6, 1.6, .5, null); }
{ const p = P_('gunumuz'), cx = 33.6, cz = 5.0, y = p.e;
  box(M.dark, cx, y, cz, 2.8, .8, 1.6); for (let i = 0; i < 22; i++) box(mono2, cx + rr(-1.2, 1.2), y + .8, cz + rr(-.65, .65), rr(.1, .25), rr(.15, .8), rr(.1, .25));
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) cyl(M.burg, cx - 1.2 + i * .8, y, cz + s * 1.5, .17, .45);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(M.white, cx + s * 5.2, y, cz - 1.6 + i * 1.6, .55, 1.1, 1.1);
  for (let i = 0; i < 2; i++) for (const x of [30.2, 36.8]) mvit(x + i * 1.6, y, 2.1, 1.4, .5, null); }

/* ---------- indoor plants & visitors ---------- */
for (const [x, y] of [[397, 251], [345, 285], [501, 255], [550, 292], [491, 384], [363, 402], [384, 404], [930, 470], [1003, 470], [1338, 237], [1413, 450], [600, 250], [980, 250]]) {
  cyl(M.dark, X(x), 0, Z(y), .32, .5); for (let i = 0; i < 4; i++) sph(M.green, X(x) + rr(-.3, .3), rr(.9, 1.7), Z(y) + rr(-.3, .3), rr(.3, .5));
}
{
  const spots = [[20, 66, 412, 321, 461], [10, 321, 340, 575, 405], [16, 600, 245, 990, 455], [9, 395, 520, 575, 640], [6, 915, 470, 1060, 680], [5, 330, 700, 430, 820]];
  const ringC = [X(449), Z(314)], plat = [X(639), Z(264), X(924), Z(402)], ppl = [];
  for (const [n, a, b, c, d] of spots) for (let i = 0; i < n * 2 && ppl.filter(p => p.g === a).length < n; i++) {
    const x = X(rr(a, c)), z = Z(rr(b, d));
    if (Math.hypot(x - ringC[0], z - ringC[1]) < 4.5) continue;
    if (x > plat[0] - .4 && x < plat[2] + .4 && z > plat[1] - .4 && z < plat[3] + .4) continue;
    if (a === 330 && !((x > X(347) && x < X(368)) || (x > X(408) && x < X(428)) || z > Z(792))) continue;
    ppl.push({ x, z, g: a });
  }
  for (const p of MZ) for (let i = 0; i < 3; i++) ppl.push({ x: rr(p.x1 + .8, p.x2 - .8), z: rr(p.z1 + .6, p.z1 + 1.6 + i * .9), y: p.e });
  for (let i = 0; i < 3; i++) ppl.push({ x: rr(1, 9), z: rr(4, 8), y: 4 });
  const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.2, .9, 4, 10), std(0xffffff, .85), ppl.length);
  const head = new THREE.InstancedMesh(GEO.sph, std(0xc69c7c, .7), ppl.length);
  const pal = [0x7b2632, 0x2f3a4a, 0xcdb99a, 0x55534e, 0x8a6a4a, 0xe8e0d2, 0x3e4b3a]; const mm = new THREE.Matrix4(), cc = new THREE.Color();
  ppl.forEach((p, i) => { const s = rr(.9, 1.08), y0 = p.y ?? (p.g === 330 ? .05 : 0); mm.compose(V(p.x, y0 + .65 * s, p.z), qY(0), V(s, s, s * .8)); body.setMatrixAt(i, mm); body.setColorAt(i, cc.set(pal[i % pal.length]));
    mm.compose(V(p.x, y0 + 1.42 * s, p.z), qY(0), V(.26 * s, .3 * s, .26 * s)); head.setMatrixAt(i, mm); });
  body.castShadow = head.castShadow = true; build.add(body, head);
}

/* ---------- finalize instancing ---------- */
for (const { kind, mat, list } of batches.values()) {
  const im = new THREE.InstancedMesh(GEO[kind], mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m));
  const transparent = mat === M.glass; im.castShadow = !transparent; im.receiveShadow = true; if (transparent) im.renderOrder = 1; build.add(im);
}

/* ---------- the drawing itself, lying on the ground ---------- */
const planTex = new THREE.TextureLoader().load('img/plan.png', t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; });
const planMat = new THREE.MeshBasicMaterial({ map: planTex, transparent: true, depthWrite: false, opacity: 1, fog: false });
const planMesh = new THREE.Mesh(new THREE.PlaneGeometry((1460 - 20) * S, (860 - 200) * S), planMat);
planMesh.rotation.x = -Math.PI / 2; planMesh.position.set((X(20) + X(1460)) / 2, .08, (Z(200) + Z(860)) / 2); planMesh.renderOrder = 3; scene.add(planMesh);
const paper = new THREE.Mesh(new THREE.PlaneGeometry(260, 140), new THREE.MeshBasicMaterial({ color: 0xf1e8d8, transparent: true, opacity: 1, fog: false, depthWrite: false }));
paper.rotation.x = -Math.PI / 2; paper.position.set(51, .06, 20); paper.renderOrder = 2; scene.add(paper);

/* ---------- post ---------- */
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .28, .6, .88); if (!mobile) composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- camera choreography ---------- */
const CH = window.MUSEUM_CHAPTERS;
const keys = CH.map(c => ({ p: V(...c.pos), t: V(...c.tgt), hop: c.hop || 0, via: (c.via || []).map(v => V(...v)) }));
const PLAN_VIEW = { p: V(51, 118, 26), t: V(51, 0, 19.5) };
const camPos = keys[0].p.clone(), camTgt = keys[0].t.clone();
const desP = V(), desT = V();
let settleNext = 0, progress = 0, mx = 0, my = 0, smx = 0, smy = 0, intro = still ? 1 : 0, planMode = false, planBlend = 0, rise = still ? 1 : 0;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
function pose(p, outP, outT) {
  const i = Math.min(Math.floor(p), keys.length - 2), e = smooth(.12, .88, p - i), A = keys[i], B = keys[i + 1];
  const pts = [A.p, ...B.via, B.p], lens = []; let tot = 0;
  for (let j = 1; j < pts.length; j++) { const l = pts[j].distanceTo(pts[j - 1]); lens.push(l); tot += l; }
  let d = ease(e) * tot, j = 0; while (j < lens.length - 1 && d > lens[j]) { d -= lens[j]; j++; }
  outP.lerpVectors(pts[j], pts[j + 1], lens[j] ? d / lens[j] : 1);
  outT.lerpVectors(A.t, B.t, smooth(0, 1, e)); outP.y += B.hop * Math.sin(Math.PI * e); outT.y += B.hop * .5 * Math.sin(Math.PI * e);
}
addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; });
window.museum = {
  setProgress: p => { progress = Math.max(0, Math.min(keys.length - 1, p)); },
  togglePlan: on => { planMode = on ?? !planMode; return planMode; },
  skipIntro: () => { if (intro < 1) intro = Math.max(intro, .999); },
  camY: () => camPos.y,
  camPx: () => ({ x: camPos.x / S + 66, y: camPos.z / S + 232, a: Math.atan2(camTgt.z - camPos.z, camTgt.x - camPos.x) }),
  active: true,
  settle: () => { intro = 1; settleNext = 3; }
};

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 58 : 42; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock(); const right = V(), up = V(0, 1, 0), fw = V();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
  if (!window.museum.active) return;
  if (intro < 1) intro = Math.min(1, intro + dt / 4.2);
  const introRise = smooth(.18, .7, intro), introCam = ease(smooth(.38, 1, intro));
  const planTarget = planMode ? 1 : 0; planBlend += (planTarget - planBlend) * (1 - Math.exp(-dt * 3.2));
  const planWeight = Math.max(planBlend, 1 - introCam);
  rise = Math.min(introRise, 1 - smooth(0, .9, planBlend));
  build.scale.y = Math.max(.002, rise);
  build.visible = build.scale.y > .003;
  planMat.opacity = Math.max(.0, 1 - smooth(.25, .9, rise)) ;
  paper.material.opacity = Math.max(0, 1 - smooth(.0, .55, rise));
  pose(progress, desP, desT);
  desP.lerp(PLAN_VIEW.p, planWeight); desT.lerp(PLAN_VIEW.t, planWeight);
  const k = settleNext > 0 ? (settleNext--, 1) : 1 - Math.exp(-dt * (intro < 1 ? 6 : 3.4)); camPos.lerp(desP, k); camTgt.lerp(desT, k);
  smx += (mx - smx) * (1 - Math.exp(-dt * 3)); smy += (my - smy) * (1 - Math.exp(-dt * 3));
  const dist = camPos.distanceTo(camTgt), amp = still ? 0 : Math.min(3.2, Math.max(.45, dist * .06)) * (1 - planWeight * .8);
  fw.subVectors(camTgt, camPos).normalize(); right.crossVectors(fw, up).normalize();
  camera.position.copy(camPos).addScaledVector(right, smx * amp).addScaledVector(up, -smy * amp * .5 + Math.sin(time * .35) * .05 * amp);
  camera.lookAt(camTgt.clone().addScaledVector(right, smx * amp * .25));
  sky.position.copy(camera.position);
  waterNormal.offset.set(time * .004, time * .006); M.screen.uniforms.t.value = time;
  composer.render();
  window.dispatchEvent(new CustomEvent('museumframe'));
}
frame();
document.documentElement.classList.add('gl-ready');
