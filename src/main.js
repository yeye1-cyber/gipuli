import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#world");
const introEl = document.querySelector("#intro");
const enterWorldBtn = document.querySelector("#enter-world");
const promptEl = document.querySelector("#prompt");
const storyEl = document.querySelector("#story");
const storyTitleEl = document.querySelector("#story-title");
const storyTextEl = document.querySelector("#story-text");
const memoryCountEl = document.querySelector("#memory-count");
const memoryTotalEl = document.querySelector("#memory-total");
const memoryListEl = document.querySelector("#memory-list");
const completeEl = document.querySelector("#complete");
const musicToggle = document.querySelector("#music-toggle");
const bgMusic = document.querySelector("#bg-music");
document.querySelector("#close-story").addEventListener("click", () => storyEl.classList.add("hidden"));
bgMusic.volume = 0;
musicToggle.addEventListener("click", () => toggleMusic());
enterWorldBtn.addEventListener("click", () => enterMemoryTavern());

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#102b4f");
scene.fog = new THREE.FogExp2("#7b967c", 0.016);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 320);
camera.position.set(10.5, 7.2, 15.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 4;
controls.maxDistance = 24;
controls.target.set(0, 2.2, 0);
controls.enabled = false;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const keys = new Set();
const interactables = [];
const gears = [];
const steamPuffs = [];
const jumpTrails = [];
const phantomGroups = [];
let hovered = null;
let slowTime = 1;
let slowTimer = 0;
let audioReady = false;
let barrelTone = null;
let musicEnabled = false;
let musicFade = null;
let coreLit = false;
let restorationLevel = 0;
let viewMode = "explore";
let character = null;
let characterVelocityY = 0;
let characterGrounded = true;
let nearestInteractable = null;
let navTarget = null;
let groundMesh = null;
let cameraSmooth = 0.08;
let cameraYaw = Math.PI;
let cameraTargetYaw = Math.PI;
let cameraAnchorY = 0.02;
let isPointerDown = false;
let dragStarted = false;
let lastPointerX = 0;
let lastPointerY = 0;
const worldMeshes = [];
const obstacleBoxes = [];
const downRaycaster = new THREE.Raycaster();
const characterRadius = 0.18;
const maxWalkableY = 1.15;

const stories = {
  barrel: {
    title: "会唱歌的旧酒桶",
    text: "这是一个会唱歌的酒桶。很久以前，它记得每一位旅人的笑声。",
  },
  clock: {
    title: "停在傍晚的钟",
    text: "它曾经停止过时间。不是为了逃避离别，而是想多留住一盏灯。",
  },
  gear: {
    title: "屋檐下的温柔齿轮",
    text: "这些齿轮转得很慢，像在替酒馆保存还没有说出口的话。",
  },
  core: {
    title: "酒馆中央的炉心",
    text: "它等待的不是道具，而是情绪。每一次倾听，都会让酒馆重新暖一点。",
  },
};

const memories = [
  { id: "barrel-song", name: "酒桶里的笑声", title: "会唱歌的酒桶", text: "这是一个会唱歌的酒桶。靠近它时，旧木纹里还藏着很轻的合唱。", pos: [-4.4, 1.1, 3.0], color: "#ffd27f", phantom: "crowd" },
  { id: "clock-time", name: "停下来的时间", title: "停在傍晚的钟", text: "它曾经停止过时间。钟声落下时，所有离别都慢了一拍。", pos: [4.6, 2.1, 1.2], color: "#ffe2a4", phantom: "warmth" },
  { id: "lamp-waiting", name: "路灯下的等待", title: "等待很多年的灯", text: "有人曾在这里等待很多年。灯没有问原因，只是一直亮着。", pos: [-2.8, 1.55, 4.6], color: "#fff0bd", phantom: "figure" },
  { id: "bridge-return", name: "木桥上的脚步", title: "回来的脚步声", text: "每一块木板都记得脚步。有人离开，也有人在黄昏里回来。", pos: [-0.8, 0.85, 5.4], color: "#f4c98b", phantom: "footsteps" },
  { id: "sign-name", name: "门牌上的名字", title: "门牌没有忘记", text: "门牌被风吹旧了，却仍记得那些曾经被喊出的名字。", pos: [0.2, 1.65, 3.6], color: "#ffc27a", phantom: "letters" },
  { id: "chimney-breath", name: "烟囱的呼吸", title: "烟囱还在呼吸", text: "它把炉火的温度送向天空，像把悲伤慢慢说完。", pos: [2.0, 3.15, -0.8], color: "#ffb48a", phantom: "steam" },
  { id: "window-light", name: "窗里的灯", title: "窗里还有灯", text: "窗户映出模糊的人影。那不是鬼魂，是被保存下来的思念。", pos: [2.9, 1.9, 2.6], color: "#ffd58f", phantom: "figure" },
  { id: "table-supper", name: "桌上的晚餐", title: "无人收拾的桌子", text: "桌面上没有食物，却还留着一起吃晚餐时的安静。", pos: [3.7, 1.05, 3.1], color: "#d9c18f", phantom: "crowd" },
  { id: "stool-rest", name: "凳子上的疲惫", title: "给旅人坐下的凳子", text: "它承接过太多疲惫。每一次坐下，世界都会暂时轻一点。", pos: [4.7, 1.05, 2.1], color: "#c9d8a5", phantom: "warmth" },
  { id: "door-home", name: "门后的归处", title: "门后的归处", text: "门后并不一定是房间。有时候，它只是让人相信自己仍有地方可去。", pos: [-1.6, 1.3, 1.6], color: "#ffe8a8", phantom: "letters" },
];
const collected = new Set();
memoryTotalEl.textContent = memories.length;

memories.forEach((memory) => {
  const chip = document.createElement("div");
  chip.className = "memory-chip";
  chip.id = `chip-${memory.id}`;
  chip.textContent = `未倾听 · ${memory.name}`;
  memoryListEl.appendChild(chip);
});

function makeMat(color, emissive = "#000000", intensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: intensity,
    roughness: 0.58,
    metalness: 0.08,
  });
}

function addLights() {
  const hemi = new THREE.HemisphereLight("#f8c48a", "#5f4c86", 1.8);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#ffb46e", 3.2);
  sun.position.set(-8, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 42;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  scene.add(sun);

  [
    [-4.6, 2.2, 3.4, "#ffc16d", 3.6],
    [4.2, 2.7, 1.8, "#ff936e", 2.8],
    [0, 3.5, -3.5, "#9be5d3", 1.4],
  ].forEach(([x, y, z, color, power]) => {
    const light = new THREE.PointLight(color, power, 11, 1.7);
    light.position.set(x, y, z);
    scene.add(light);
  });
}

function createSkyAndForest() {
  const skyGeo = new THREE.SphereGeometry(160, 48, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color("#0d244a") },
      horizon: { value: new THREE.Color("#38698c") },
      glow: { value: new THREE.Color("#f5a96b") },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = normalize(world.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 glow;
      void main() {
        float h = clamp(vWorld.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(horizon, top, smoothstep(0.18, 0.9, h));
        float sun = pow(max(dot(normalize(vWorld), normalize(vec3(-0.55, 0.22, -0.35))), 0.0), 18.0);
        col += glow * sun * 0.75;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const trunkMat = makeMat("#4d3529");
  const leafMats = [makeMat("#426f52"), makeMat("#557f5f"), makeMat("#728464")];
  for (let i = 0; i < 120; i += 1) {
    const angle = (i / 120) * Math.PI * 2;
    const radius = 38 + Math.random() * 42;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (z > 22 && Math.abs(x) < 10) continue;

    const group = new THREE.Group();
    group.position.set(x, -0.15, z);
    group.rotation.y = Math.random() * Math.PI;
      const scale = 0.9 + Math.random() * 2.1;
    group.scale.setScalar(scale);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.8, 6), trunkMat);
    trunk.position.y = 0.75;
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.78, 2.6, 7), leafMats[i % leafMats.length]);
    leaves.position.y = 2.2;
    group.add(trunk, leaves);
    scene.add(group);
  }
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(42, 96),
    new THREE.MeshPhysicalMaterial({
      color: "#54674b",
      roughness: 0.36,
      metalness: 0.05,
      clearcoat: 0.65,
      clearcoatRoughness: 0.42,
      reflectivity: 0.42,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);
  groundMesh = ground;

  const rings = new THREE.Mesh(
    new THREE.RingGeometry(5.4, 18, 96),
    new THREE.MeshBasicMaterial({ color: "#aebd91", transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
  );
  rings.rotation.x = -Math.PI / 2;
  rings.position.y = -0.065;
  scene.add(rings);
}

function createParticles() {
  const count = 720;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const colorA = new THREE.Color("#ffd389");
  const colorB = new THREE.Color("#96dccd");
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 34;
    positions[i * 3 + 1] = 0.65 + Math.random() * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 34;
    const c = colorA.clone().lerp(colorB, Math.random() * 0.45);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.07,
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(geo, mat);
  particles.name = "floating-particles";
  scene.add(particles);
  return particles;
}

function createSteam() {
  const mat = new THREE.SpriteMaterial({
    color: "#ffe6c7",
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const vents = [
    [-2.7, 2.1, -1.8],
    [2.6, 2.4, -2.3],
    [0.7, 3.1, 1.2],
  ];
  vents.forEach((vent) => {
    for (let i = 0; i < 12; i += 1) {
      const puff = new THREE.Sprite(mat.clone());
      puff.position.set(vent[0] + Math.random() * 0.5, vent[1] + Math.random() * 1.2, vent[2] + Math.random() * 0.5);
      puff.scale.setScalar(0.55 + Math.random() * 0.75);
      puff.userData.base = new THREE.Vector3(...vent);
      puff.userData.offset = Math.random() * 100;
      steamPuffs.push(puff);
      scene.add(puff);
    }
  });
}

function createGear(radius, pos, color, speed) {
  const group = new THREE.Group();
  group.position.set(...pos);
  group.userData.speed = speed;
  const mat = makeMat(color, "#412000", 0.25);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.08, 10, 36), mat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, 0.16, 18), mat);
  hub.rotation.x = Math.PI / 2;
  group.add(ring, hub);
  for (let i = 0; i < 12; i += 1) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.14), mat);
    const a = (i / 12) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    tooth.rotation.z = a;
    group.add(tooth);
  }
  group.rotation.y = Math.PI * 0.12;
  gears.push(group);
  scene.add(group);
  return group;
}

function addInteractable(mesh, type, story, prompt) {
  mesh.userData.interactive = true;
  mesh.userData.type = type;
  mesh.userData.story = story;
  mesh.userData.prompt = prompt;
  mesh.traverse((child) => {
    if (child.isMesh || child.isSprite) {
      child.userData.owner = mesh;
    }
  });
  interactables.push(mesh);
  return mesh;
}

function createHotspots() {
  const barrel = new THREE.Group();
  barrel.position.set(-5.3, 0.85, 2.4);
  const barrelMat = makeMat("#8b553a", "#351805", 0.1);
  const metalMat = makeMat("#d99f62", "#3d250c", 0.25);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.25, 32), barrelMat);
  body.rotation.z = Math.PI / 2;
  const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 8, 32), metalMat);
  const band2 = band1.clone();
  band1.position.x = -0.45;
  band2.position.x = 0.45;
  band1.rotation.y = Math.PI / 2;
  band2.rotation.y = Math.PI / 2;
  barrel.add(body, band1, band2);
  scene.add(barrel);
  addInteractable(barrel, "barrel", stories.barrel, "点击酒桶，倾听旧木纹里的笑声");

  const clockGroup = new THREE.Group();
  clockGroup.position.set(4.8, 2.4, -1.9);
  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.08, 40), makeMat("#f0d19b", "#57350b", 0.25));
  clockFace.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 8, 40), metalMat);
  const handA = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.05), makeMat("#3d2925"));
  const handB = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), makeMat("#3d2925"));
  handA.position.z = 0.08;
  handA.position.y = 0.18;
  handB.position.z = 0.09;
  handB.rotation.z = Math.PI * 0.35;
  clockGroup.add(clockFace, rim, handA, handB);
  scene.add(clockGroup);
  addInteractable(clockGroup, "clock", stories.clock, "点击钟表，听见停止过的时间");

  const gearA = createGear(0.74, [2.8, 3.05, 2.85], "#c88e53", 0.32);
  const gearB = createGear(0.52, [3.9, 2.75, 2.8], "#8fc5b2", -0.46);
  addInteractable(gearA, "gear", stories.gear, "齿轮保存着屋檐下的梦");
  addInteractable(gearB, "gear", stories.gear, "齿轮保存着屋檐下的梦");

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.58, 2),
    new THREE.MeshStandardMaterial({
      color: "#5f3c4c",
      emissive: "#2b1623",
      emissiveIntensity: 0.45,
      roughness: 0.38,
      metalness: 0.18,
    }),
  );
  core.position.set(0, 1.25, 0.2);
  core.userData.core = true;
  core.userData.baseScale = 1;
  scene.add(core);
  addInteractable(core, "core", stories.core, "倾听建筑记忆，点亮酒馆炉心");

  const coreLight = new THREE.PointLight("#ffb85d", 0, 9, 1.8);
  coreLight.position.copy(core.position);
  scene.add(coreLight);
  core.userData.light = coreLight;

  memories.forEach((memory) => {
    const group = new THREE.Group();
    group.position.set(...memory.pos);
    const color = new THREE.Color(memory.color);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 24, 16),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.88,
        transparent: true,
        opacity: 0.72,
        roughness: 0.24,
        metalness: 0.02,
      }),
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 24, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    group.add(orb, halo);
    group.userData.memory = memory;
    group.userData.floatOffset = Math.random() * 100;
    group.userData.baseY = memory.pos[1];
    scene.add(group);
    addInteractable(group, "memory", { title: memory.title, text: memory.text }, "点击光球，倾听残留的情绪");
  });
}

function createSkyChild() {
  const group = new THREE.Group();
  group.position.set(0, 0.02, 7.2);
  group.rotation.y = Math.PI;

  const warmWhite = new THREE.MeshStandardMaterial({
    color: "#fff3d4",
    emissive: "#ffd58a",
    emissiveIntensity: 0.22,
    roughness: 0.55,
    metalness: 0.02,
  });
  const beige = new THREE.MeshStandardMaterial({
    color: "#d9bf8b",
    emissive: "#9f7032",
    emissiveIntensity: 0.14,
    roughness: 0.68,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: "#f3d27b",
    emissive: "#f6b34d",
    emissiveIntensity: 0.24,
    roughness: 0.45,
    metalness: 0.05,
  });
  const glow = new THREE.MeshBasicMaterial({
    color: "#ffe6ac",
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.92, 28), warmWhite);
  body.position.y = 0.62;
  body.castShadow = true;
  bodyRoot.add(body);

  const bodyGlow = new THREE.Mesh(new THREE.ConeGeometry(0.44, 1.08, 28), glow);
  bodyGlow.position.copy(body.position);
  bodyRoot.add(bodyGlow);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 20), warmWhite);
  head.position.y = 1.2;
  head.castShadow = true;
  bodyRoot.add(head);

  const headGlow = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 20), glow.clone());
  headGlow.position.copy(head.position);
  bodyRoot.add(headGlow);

  const cape = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.98, 4), beige);
  cape.position.set(0, 0.55, -0.08);
  cape.rotation.set(-0.16, Math.PI * 0.25, 0);
  cape.scale.set(1.15, 1, 0.48);
  cape.castShadow = true;
  bodyRoot.add(cape);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 8, 32), gold);
  scarf.position.y = 0.98;
  scarf.rotation.x = Math.PI / 2;
  bodyRoot.add(scarf);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.82, 48),
    new THREE.MeshBasicMaterial({
      color: "#ffe3a1",
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.035;
  group.add(halo);

  const footLight = new THREE.PointLight("#ffd98c", 0.9, 3.2, 1.8);
  footLight.position.set(0, 0.24, 0);
  group.add(footLight);

  group.userData.bodyRoot = bodyRoot;
  group.userData.halo = halo;
  group.userData.baseY = 0.02;
  group.userData.nativeHeight = 1.48;
  group.scale.setScalar(0.42);
  scene.add(group);
  character = group;
}

function fitCharacterToModel(modelHeight) {
  if (!character || !modelHeight) return;
  const targetHeight = modelHeight / 10;
  const scale = targetHeight / character.userData.nativeHeight;
  character.scale.setScalar(scale);
}

function spawnJumpTrail() {
  if (!character) return;
  const material = new THREE.SpriteMaterial({
    color: "#ffe5ad",
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 14; i += 1) {
    const sprite = new THREE.Sprite(material.clone());
    sprite.position.copy(character.position);
    sprite.position.x += (Math.random() - 0.5) * 0.55;
    sprite.position.y += 0.18 + Math.random() * 0.42;
    sprite.position.z += (Math.random() - 0.5) * 0.55;
    sprite.scale.setScalar(0.12 + Math.random() * 0.14);
    sprite.userData.life = 0.75 + Math.random() * 0.35;
    sprite.userData.maxLife = sprite.userData.life;
    sprite.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.25 - Math.random() * 0.55, (Math.random() - 0.5) * 0.6);
    jumpTrails.push(sprite);
    scene.add(sprite);
  }
}

function setHover(target) {
  if (hovered === target) return;
  if (hovered) {
    playHoverTick();
    hovered.traverse((child) => {
      if (child.material?.emissive && child.userData.oldEmissive) {
        child.material.emissive.copy(child.userData.oldEmissive);
        child.material.emissiveIntensity = child.userData.oldIntensity;
      }
      if (child.material?.opacity && child.userData.oldOpacity !== undefined) {
        child.material.opacity = child.userData.oldOpacity;
      }
    });
  }
  hovered = target;
  if (hovered) {
    hovered.traverse((child) => {
      if (child.material?.emissive) {
        child.userData.oldEmissive = child.material.emissive.clone();
        child.userData.oldIntensity = child.material.emissiveIntensity;
        child.material.emissive.set("#ffe6a3");
        child.material.emissiveIntensity = Math.max(1.6, child.material.emissiveIntensity + 1.1);
      }
      if (child.material?.transparent && child.material.opacity < 0.45) {
        child.userData.oldOpacity = child.material.opacity;
        child.material.opacity = 0.35;
      }
    });
    promptEl.textContent = hovered.userData.prompt || "点击物件，倾听残留的情绪";
    document.body.style.cursor = "pointer";
  } else {
    promptEl.textContent = "靠近酒馆，倾听建筑残留的情绪";
    document.body.style.cursor = "default";
  }
}

function showStory(story) {
  storyTitleEl.textContent = story.title;
  storyTextEl.textContent = story.text;
  storyEl.classList.remove("hidden");
}

function enterMemoryTavern() {
  if (introEl.classList.contains("exiting")) return;
  introEl.classList.add("exiting");
  document.querySelector(".hud").classList.remove("hidden");
  document.querySelector(".controls").classList.remove("hidden");
  document.querySelector(".credit").classList.remove("hidden");
  promptEl.classList.remove("hidden");
  promptEl.textContent = "这间酒馆本身，就是最后的记忆容器";
  startMusic();
  camera.position.set(3.5, 3.3, 11.5);
  controls.target.set(0, 1.4, 3.6);
  setTimeout(() => {
    if (character) {
      character.position.set(0, floorHeightAt(0, 7.2, 0.02), 7.2);
      cameraAnchorY = character.position.y;
    }
  }, 900);
}

function collectMemory(group) {
  const memory = group.userData.memory;
  if (!memory || collected.has(memory.id)) return;
  collected.add(memory.id);
  group.visible = false;
  const chip = document.querySelector(`#chip-${memory.id}`);
  chip.classList.add("collected");
  chip.textContent = `已倾听 · ${memory.name}`;
  memoryCountEl.textContent = collected.size;
  showStory({ title: memory.title, text: memory.text });
  playMemoryEcho(memory);
  updateRestoration();
  playBellPair(880 + collected.size * 28);
  if (collected.size === memories.length) lightCore();
}

function updateRestoration() {
  restorationLevel = collected.size / memories.length;
  renderer.toneMappingExposure = 1.05 + restorationLevel * 0.28;
  scene.fog.density = THREE.MathUtils.lerp(0.018, 0.009, restorationLevel);
  scene.background.lerpColors(new THREE.Color("#102b4f"), new THREE.Color("#254b75"), restorationLevel);
}

function playMemoryEcho(memory) {
  const group = new THREE.Group();
  group.position.set(...memory.pos);
  group.userData.life = 4.2;
  group.userData.maxLife = 4.2;
  const color = new THREE.Color(memory.color);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const light = new THREE.PointLight(memory.color, 1.8, 4.5, 1.7);
  light.position.y = 0.8;
  group.add(light);

  if (["crowd", "figure"].includes(memory.phantom)) {
    const count = memory.phantom === "crowd" ? 5 : 2;
    for (let i = 0; i < count; i += 1) {
      const person = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 5, 10), mat.clone());
      person.position.set((i - (count - 1) / 2) * 0.34, 0.55, Math.sin(i) * 0.2);
      group.add(person);
    }
  } else if (memory.phantom === "steam") {
    for (let i = 0; i < 8; i += 1) {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
      puff.position.set((Math.random() - 0.5) * 0.7, i * 0.18, (Math.random() - 0.5) * 0.7);
      puff.scale.setScalar(0.3 + Math.random() * 0.35);
      group.add(puff);
    }
  } else {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 36), mat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);
  }
  phantomGroups.push(group);
  scene.add(group);
}

function lightCore() {
  coreLit = true;
  completeEl.classList.remove("hidden");
  const core = interactables.find((item) => item.userData.type === "core");
  if (!core) return;
  core.material.color.set("#ffd16f");
  core.material.emissive.set("#ff9f43");
  core.material.emissiveIntensity = 2.8;
  core.userData.light.intensity = 5.6;
  setTimeout(() => completeEl.classList.add("hidden"), 4300);
}

function triggerClock() {
  slowTime = 0.28;
  slowTimer = 4.5;
  document.body.classList.add("slow-time");
  promptEl.textContent = "时间变慢了，黄昏正在深呼吸";
  playBellPair(659.25);
}

function initAudio() {
  if (audioReady) return;
  const ctx = new AudioContext();
  barrelTone = {
    ctx,
    osc: null,
    gain: ctx.createGain(),
    lastHover: 0,
  };
  barrelTone.gain.gain.value = 0;
  barrelTone.gain.connect(ctx.destination);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 108;
  osc.connect(barrelTone.gain);
  osc.start();
  barrelTone.osc = osc;
  audioReady = true;
}

function playChime(freq, duration) {
  initAudio();
  const { ctx } = barrelTone;
  const osc = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "sine";
  overtone.type = "square";
  osc.frequency.value = freq;
  overtone.frequency.value = freq * 2.01;
  filter.type = "bandpass";
  filter.frequency.value = Math.min(freq * 1.9, 4200);
  filter.Q.value = 6.5;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(filter);
  overtone.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  overtone.start();
  osc.stop(ctx.currentTime + duration + 0.04);
  overtone.stop(ctx.currentTime + duration + 0.04);
}

function playBellPair(baseFreq = 988) {
  playChime(baseFreq, 0.13);
  window.setTimeout(() => playChime(baseFreq * 1.5, 0.16), 82);
}

function playSoftClick() {
  playChime(1320, 0.065);
}

function fadeMusic(targetVolume, duration = 850) {
  window.clearInterval(musicFade);
  const start = Number.isFinite(bgMusic.volume) ? bgMusic.volume : 0;
  const startTime = performance.now();
  musicFade = window.setInterval(() => {
    const t = Math.min((performance.now() - startTime) / duration, 1);
    const eased = 1 - (1 - t) * (1 - t);
    bgMusic.volume = Math.min(1, Math.max(0, start + (targetVolume - start) * eased));
    if (t >= 1) {
      bgMusic.volume = targetVolume;
      window.clearInterval(musicFade);
      musicFade = null;
      if (targetVolume === 0) bgMusic.pause();
    }
  }, 30);
}

async function toggleMusic() {
  initAudio();
  if (musicEnabled) {
    musicEnabled = false;
    musicToggle.textContent = "开启音乐";
    musicToggle.classList.remove("playing");
    fadeMusic(0, 700);
    playSoftClick();
    return;
  }

  await startMusic();
}

async function startMusic() {
  initAudio();
  if (musicEnabled) return;
  try {
    musicEnabled = true;
    bgMusic.loop = true;
    bgMusic.volume = 0;
    await bgMusic.play();
    musicToggle.textContent = "关闭音乐";
    musicToggle.classList.add("playing");
    fadeMusic(0.35, 1200);
    playBellPair(987.77);
  } catch {
    musicEnabled = false;
    musicToggle.textContent = "开启音乐";
    musicToggle.classList.remove("playing");
    promptEl.textContent = "音乐暂时无法播放，请确认 music.mp3 在 gipuli 文件夹中";
  }
}
function playHoverTick() {
  if (!audioReady || !barrelTone) return;
  const now = barrelTone.ctx.currentTime;
  if (now - barrelTone.lastHover < 0.16) return;
  barrelTone.lastHover = now;
  playSoftClick();
}

function updateBarrelAudio() {
  if (!audioReady || !barrelTone) return;
  const barrel = interactables.find((item) => item.userData.type === "barrel");
  const listenerPosition = character ? character.position : camera.position;
  const distance = listenerPosition.distanceTo(barrel.position);
  const target = THREE.MathUtils.clamp(1 - (distance - 3.2) / 5.2, 0, 1);
  const now = barrelTone.ctx.currentTime;
  barrelTone.gain.gain.cancelScheduledValues(now);
  barrelTone.gain.gain.linearRampToValueAtTime(target * 0.055, now + 0.18);
}

function buildNavigationFromModel(model) {
  worldMeshes.length = 0;
  obstacleBoxes.length = 0;
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const box = new THREE.Box3().setFromObject(child);
    const size = box.getSize(new THREE.Vector3());
    if (size.x < 0.08 || size.z < 0.08) return;
    worldMeshes.push(child);

    const isBroadFloor = size.y < 0.42 && Math.max(size.x, size.z) > 0.75;
    const isThinTrim = size.y < 0.22;
    const isRoof = box.min.y > 2.6 && size.y < 1.2;
    if (!isBroadFloor && !isThinTrim && !isRoof && size.y > 0.34) {
      obstacleBoxes.push(box.expandByScalar(0.035));
    }
  });
}

function floorHeightAt(x, z, currentY = 4) {
  downRaycaster.set(new THREE.Vector3(x, currentY + 8, z), new THREE.Vector3(0, -1, 0));
  const hits = downRaycaster.intersectObjects(worldMeshes, true);
  const usableHit = hits.find((hit) => hit.face?.normal?.y > 0.45 && hit.point.y <= maxWalkableY && hit.point.y <= currentY + 0.55);
  return usableHit ? Math.max(0.02, usableHit.point.y + 0.03) : 0.02;
}

function collidesAt(position) {
  const bodyMinY = position.y + 0.06;
  const bodyMaxY = position.y + Math.max(0.72, character?.scale.y ?? 1);
  return obstacleBoxes.some((box) => {
    if (box.max.y < bodyMinY || box.min.y > bodyMaxY) return false;
    const cx = THREE.MathUtils.clamp(position.x, box.min.x, box.max.x);
    const cz = THREE.MathUtils.clamp(position.z, box.min.z, box.max.z);
    const dx = position.x - cx;
    const dz = position.z - cz;
    return dx * dx + dz * dz < characterRadius * characterRadius;
  });
}

function tryMoveCharacter(step, snapToFloor = true) {
  if (!character || step.lengthSq() <= 0) return false;
  const desired = character.position.clone().add(step);
  desired.x = THREE.MathUtils.clamp(desired.x, -16, 16);
  desired.z = THREE.MathUtils.clamp(desired.z, -16, 16);
  if (snapToFloor) desired.y = floorHeightAt(desired.x, desired.z, character.position.y);
  if (!collidesAt(desired)) {
    character.position.copy(desired);
    return true;
  }

  const slideX = character.position.clone().add(new THREE.Vector3(step.x, 0, 0));
  slideX.x = THREE.MathUtils.clamp(slideX.x, -16, 16);
  if (snapToFloor) slideX.y = floorHeightAt(slideX.x, slideX.z, character.position.y);
  if (!collidesAt(slideX)) {
    character.position.copy(slideX);
    return true;
  }

  const slideZ = character.position.clone().add(new THREE.Vector3(0, 0, step.z));
  slideZ.z = THREE.MathUtils.clamp(slideZ.z, -16, 16);
  if (snapToFloor) slideZ.y = floorHeightAt(slideZ.x, slideZ.z, character.position.y);
  if (!collidesAt(slideZ)) {
    character.position.copy(slideZ);
    return true;
  }
  navTarget = null;
  return false;
}

function setNavTargetFromPointer() {
  raycaster.setFromCamera(pointer, camera);
  const navSurfaces = groundMesh ? [...worldMeshes, groundMesh] : worldMeshes;
  const hits = raycaster.intersectObjects(navSurfaces, true);
  const hit = hits.find((item) => {
    if (item.object.userData?.owner || item.object.userData?.interactive) return false;
    return item.face?.normal?.y > 0.25 || item.point.y < 0.18;
  });
  if (!hit) return;
  navTarget = new THREE.Vector3(hit.point.x, floorHeightAt(hit.point.x, hit.point.z, character?.position.y ?? 0), hit.point.z);
  promptEl.textContent = "正在前往你点击的位置";
}

function moveCharacter(delta, elapsed) {
  if (!character) return;
  const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw)).normalize();
  const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)).normalize();
  const input = new THREE.Vector3();
  if (keys.has("KeyW") || keys.has("ArrowUp")) input.add(forward);
  if (keys.has("KeyS") || keys.has("ArrowDown")) input.sub(forward);
  if (keys.has("KeyA") || keys.has("ArrowLeft")) input.sub(right);
  if (keys.has("KeyD") || keys.has("ArrowRight")) input.add(right);

  const manualInput = input.lengthSq() > 0.001;
  if (manualInput) navTarget = null;
  if (!manualInput && navTarget) {
    input.copy(navTarget).sub(character.position);
    input.y = 0;
    if (input.length() < 0.28) {
      navTarget = null;
      input.set(0, 0, 0);
    }
  }

  const moving = input.lengthSq() > 0.001;
  if (moving) {
    input.normalize();
    const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 5.2 : 3.0;
    tryMoveCharacter(input.clone().multiplyScalar(speed * delta), characterGrounded);
    const targetAngle = Math.atan2(input.x, input.z);
    character.rotation.y = THREE.MathUtils.lerp(character.rotation.y, targetAngle, 1 - Math.pow(0.001, delta));
  }

  characterVelocityY -= 12.5 * delta;
  characterVelocityY = Math.max(characterVelocityY, -8.0);
  character.position.y += characterVelocityY * delta;
  const floorY = floorHeightAt(character.position.x, character.position.z, character.position.y);
  if (character.position.y <= floorY) {
    character.position.y = floorY;
    characterVelocityY = 0;
    characterGrounded = true;
    cameraAnchorY = THREE.MathUtils.lerp(cameraAnchorY, floorY, 0.18);
  }
  if (character.position.y > maxWalkableY + 1.2) {
    character.position.set(0, floorHeightAt(0, 7.2, 0.02), 7.2);
    characterVelocityY = 0;
    characterGrounded = true;
    navTarget = null;
    cameraAnchorY = character.position.y;
    promptEl.textContent = "已回到安全地面";
  }

  const idleFloat = Math.sin(elapsed * 2.1) * 0.045;
  const bodyRoot = character.userData.bodyRoot;
  bodyRoot.position.y = idleFloat;
  bodyRoot.rotation.x = THREE.MathUtils.lerp(bodyRoot.rotation.x, moving ? -0.18 : 0, 0.08);
  bodyRoot.rotation.z = Math.sin(elapsed * (moving ? 7.5 : 2.2)) * (moving ? 0.075 : 0.025);
  character.userData.halo.scale.setScalar(1 + Math.sin(elapsed * 2.6) * 0.05);
}

function updateExploreCamera(delta) {
  if (!character || viewMode !== "explore") return;
  cameraYaw = THREE.MathUtils.lerp(cameraYaw, cameraTargetYaw, 0.12);
  const stableBase = new THREE.Vector3(character.position.x, cameraAnchorY, character.position.z);
  const offset = new THREE.Vector3(0, 2.45, -5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
  const desired = stableBase.clone().add(offset);
  camera.position.lerp(desired, cameraSmooth);
  const target = stableBase.clone().add(new THREE.Vector3(0, 1.05, 0));
  controls.target.lerp(target, cameraSmooth);
  camera.lookAt(controls.target);
}

function updateNearbyInteraction() {
  if (!character) return;
  nearestInteractable = null;
  let nearestDistance = Infinity;
  interactables.forEach((item) => {
    if (!item.visible || item.userData.type === "core") return;
    const distance = character.position.distanceTo(item.position);
    if (distance < nearestDistance && distance < 2.0) {
      nearestDistance = distance;
      nearestInteractable = item;
    }
  });

  if (nearestInteractable && !hovered) {
    if (nearestInteractable.userData.type === "memory") {
      promptEl.textContent = `按 E 倾听：${nearestInteractable.userData.memory.name}`;
    } else {
      promptEl.textContent = "按 E 倾听这个物件的故事";
    }
  }
}

function interactWithNearest() {
  if (!nearestInteractable) return;
  initAudio();
  if (nearestInteractable.userData.type === "memory") {
    collectMemory(nearestInteractable);
    return;
  }
  if (nearestInteractable.userData.type === "clock") triggerClock();
  showStory(nearestInteractable.userData.story);
}

function toggleViewMode() {
  viewMode = viewMode === "explore" ? "global" : "explore";
  controls.enabled = viewMode === "global";
  if (viewMode === "global") {
    camera.position.set(10.5, 7.2, 15.5);
    controls.target.set(0, 2.2, 0);
    promptEl.textContent = "全局欣赏视角：拖拽环顾，按 V 回到人物探索";
  } else {
    promptEl.textContent = "浜虹墿鎺㈢储瑙嗚锛歐ASD 绉诲姩锛孍 浜掑姩";
  }
}

function updateJumpTrails(delta) {
  for (let i = jumpTrails.length - 1; i >= 0; i -= 1) {
    const sprite = jumpTrails[i];
    sprite.userData.life -= delta;
    sprite.position.addScaledVector(sprite.userData.velocity, delta);
    const alpha = Math.max(sprite.userData.life / sprite.userData.maxLife, 0);
    sprite.material.opacity = alpha * 0.55;
    sprite.scale.multiplyScalar(1 + delta * 0.9);
    if (sprite.userData.life <= 0) {
      scene.remove(sprite);
      sprite.material.dispose();
      jumpTrails.splice(i, 1);
    }
  }
}

function updateMemoryEchoes(delta) {
  for (let i = phantomGroups.length - 1; i >= 0; i -= 1) {
    const group = phantomGroups[i];
    group.userData.life -= delta;
    const alpha = Math.max(group.userData.life / group.userData.maxLife, 0);
    group.children.forEach((child) => {
      if (child.material?.opacity !== undefined) child.material.opacity = alpha * 0.28;
      if (child.isLight) child.intensity = alpha * 1.8;
      child.position.y += delta * 0.03;
    });
    if (group.userData.life <= 0) {
      scene.remove(group);
      phantomGroups.splice(i, 1);
    }
  }
}

function loadModel() {
  const loader = new GLTFLoader();
  loader.load(
    "/assets/scene.gltf",
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 9.6 / Math.max(size.x, size.z);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -box.min.y * scale - 0.95, -center.z * scale);
      fitCharacterToModel(size.y * scale);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material = child.material.clone();
            child.material.roughness = Math.min(0.82, child.material.roughness ?? 0.65);
            child.material.envMapIntensity = 0.45;
          }
        }
      });
      scene.add(model);
      buildNavigationFromModel(model);
      if (character) {
        character.position.y = floorHeightAt(character.position.x, character.position.z, character.position.y);
        character.userData.baseY = character.position.y;
        cameraAnchorY = character.position.y;
      }
    },
    undefined,
    () => {
      promptEl.textContent = "模型载入失败，请确认 assets 里的 scene.gltf 与 scene.bin 保持在一起";
    },
  );
}

addLights();
createSkyAndForest();
createGround();
const particles = createParticles();
createSteam();
createHotspots();
createSkyChild();
loadModel();

window.addEventListener("pointermove", (event) => {
  updatePointerFromEvent(event);
  if (isPointerDown && viewMode === "explore") {
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragStarted = true;
    cameraTargetYaw -= dx * 0.0022;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }
});

function updatePointerFromEvent(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".controls, .story, .hud")) return;
  updatePointerFromEvent(event);
  isPointerDown = true;
  dragStarted = false;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  initAudio();
});

window.addEventListener("pointerup", (event) => {
  updatePointerFromEvent(event);
  if (event.target.closest(".controls, .story, .hud")) {
    isPointerDown = false;
    return;
  }
  isPointerDown = false;
  if (dragStarted) return;
  if (!hovered) {
    setNavTargetFromPointer();
    return;
  }
  const type = hovered.userData.type;
  if (type === "memory") {
    collectMemory(hovered);
    return;
  }
  if (type === "clock") triggerClock();
  showStory(hovered.userData.story);
});

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    if (characterGrounded) {
      initAudio();
      characterVelocityY = 3.25;
      characterGrounded = false;
      spawnJumpTrail();
      playBellPair(1046.5);
    }
  }
  if (event.code === "KeyV" && !event.repeat) {
    toggleViewMode();
  }
  if (event.code === "KeyE" && !event.repeat) {
    interactWithNearest();
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  const rawDelta = Math.min(clock.getDelta(), 0.04);
  if (slowTimer > 0) {
    slowTimer -= rawDelta;
    if (slowTimer <= 0) {
      slowTime = 1;
      document.body.classList.remove("slow-time");
    }
  }
  const delta = rawDelta * slowTime;
  const elapsed = clock.elapsedTime;

  moveCharacter(rawDelta, elapsed);
  updateExploreCamera(rawDelta);
  if (viewMode === "global") controls.update();

  particles.rotation.y += delta * 0.012;
  const positions = particles.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i) + delta * (0.08 + (i % 7) * 0.006);
    positions.setY(i, y > 8.8 ? 0.55 : y);
  }
  positions.needsUpdate = true;

  steamPuffs.forEach((puff, index) => {
    const t = (elapsed * 0.28 + puff.userData.offset) % 1;
    const lift = t * 3.2;
    puff.position.set(
      puff.userData.base.x + Math.sin(elapsed * 0.7 + index) * 0.18,
      puff.userData.base.y + lift,
      puff.userData.base.z + Math.cos(elapsed * 0.54 + index) * 0.16,
    );
    puff.material.opacity = (1 - t) * 0.24;
    puff.scale.setScalar(0.45 + t * 1.35);
  });

  gears.forEach((gear) => {
    gear.rotation.z += delta * gear.userData.speed;
  });
  updateJumpTrails(rawDelta);
  updateMemoryEchoes(rawDelta);

  interactables.forEach((item) => {
    if (item.userData.type === "memory" && item.visible) {
      item.position.y = item.userData.baseY + Math.sin(elapsed * 0.75 + item.userData.floatOffset) * 0.08;
      item.rotation.y += delta * 0.42;
      item.rotation.x += delta * 0.18;
    }
    if (item.userData.type === "core") {
      item.rotation.y += delta * 0.55;
      item.rotation.x += delta * 0.18;
      if (coreLit) item.scale.setScalar(1 + Math.sin(elapsed * 2.2) * 0.05);
    }
  });

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactables, true);
  const owner = hits.length ? hits[0].object.userData.owner || hits[0].object : null;
  setHover(owner?.visible === false ? null : owner);
  updateNearbyInteraction();

  updateBarrelAudio();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();


