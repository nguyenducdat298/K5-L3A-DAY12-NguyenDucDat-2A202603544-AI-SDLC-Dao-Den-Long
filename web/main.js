import * as THREE from "/web/vendor/three.module.min.js";
import anime from "/web/vendor/anime.es.js";
import { GameSimulationJS, DT, distXZ } from "/web/sim.js";
import { CozyAudioEngine } from "/web/audio.js";

// --- Standardized Color Palette (TICKET-02 Part 3) + HSR Memoria & Valorant Vandal Accents ---
const PALETTE = {
  NIGHT_SKY: 0x0e1430,
  MIST: 0x1b2350,
  GRASS: 0x2f5d50,
  SAND: 0xc9b48a,
  WOOD: 0x6b4a2f,
  CLOUD_SEA: 0x12384a,
  LANTERN_LIT: 0xffb347,
  LANTERN_CORE: 0xffe9b0,
  LANTERN_OFF: 0x5b5f6e,
  MOTE_CORE: 0xfff6c2,
  MOTE_HALO: 0xffe58a,
  MEMORIA_CYAN: 0x7df9ff,
  MEMORIA_VIOLET: 0xb86bff,
  SHADE_BODY: 0x120a1a,
  SHADE_RIM: 0x7a3cff,
  SHADE_STUN: 0x3a3450,
  MAY_ROBE: 0xe8e2d0,
  MAY_SCARF: 0xc8102e,
  GOLD_BORDER: 0xf2c14e,
  DRIFTER: 0x8fa3b8,
  UI_DANGER: 0xff5a5f,
  UI_TEXT: 0xf5f1e6,
};

const NIGHT_STORIES = {
  1: {
    title: "ĐÊM 1 — ĐẢO BẾN",
    quote:
      '"Chào <b>Evernight</b>! Đêm nay sương đen đã phủ kín cả ba hòn đảo. Hãy cầm chắc khẩu <b>Vandal</b> ở góc nhìn thứ nhất (hoặc bấm <b>[V]</b> để xem animation chạy bộ & <b>Lướt Genshin [Shift]</b>), nhặt thêm <b>Băng Đạn</b> trên sàn đấu và thu thập đủ 10 viên <b>Memoria</b> cho mỗi Đèn Lồng Lớn nhé!"',
  },
  2: {
    title: "ĐÊM 2 — ĐẢO CAU",
    quote:
      '"Phía trước là <b>Đảo Cau</b> gồm hai hòn đảo nối bằng cầu tre và hai <b>Bục Nhảy</b> cổ ngữ. Hãy dùng súng <b>Vandal</b> bắn hạ hoặc dùng <b>Tỏa Sáng [R]</b> để đánh rơi <b>Memoria</b> từ <b>Gió Lạc</b>, và nhặt <b>Bùa Gió</b> giữa cầu để kích hoạt Lướt Genshin liên hoàn không hồi chiêu!"',
  },
  3: {
    title: "ĐÊM 3 — ĐẢO CHUÔNG",
    quote:
      '"Đêm cuối tại <b>Đảo Chuông</b> 3 tầng! Hãy leo theo hai con dốc đá (30° và 150°) lên tầng 1, nhặt các <b>Băng Đạn Vandal</b> dọc đường và dẫm lên Bục Nhảy để bay lên đỉnh <b>Tháp Chuông</b> tầng 2 trước khi <b>Gió Mạnh</b> thổi qua!"',
  },
};

function createToonGradientMap() {
  const data = new Uint8Array([50, 125, 200, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function createMistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0.0, "rgba(65, 85, 165, 0.55)");
  grad.addColorStop(0.5, "rgba(27, 35, 80, 0.35)");
  grad.addColorStop(1.0, "rgba(14, 20, 48, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const toonGradient = createToonGradientMap();
const mistTexture = createMistTexture();

function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient, ...opts });
}

function addAnimeOutline(mesh, scale = 1.06, color = 0x0e1430) {
  const outlineMat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.setScalar(scale);
  mesh.add(outline);
  return outline;
}

// Build a detailed 3D Valorant Vandal Rifle Mesh (Reaver / Prime Gold-Crimson Skin)
function createVandalRifleMesh() {
  const gun = new THREE.Group();

  // Main Receiver
  const recGeo = new THREE.BoxGeometry(0.11, 0.16, 0.62);
  const recMesh = new THREE.Mesh(recGeo, toonMat(0x1b1e2b));
  addAnimeOutline(recMesh, 1.06, PALETTE.GOLD_BORDER);
  gun.add(recMesh);

  // Gold & Crimson Trim Strip along top rail
  const railGeo = new THREE.BoxGeometry(0.07, 0.035, 0.56);
  const railMesh = new THREE.Mesh(railGeo, new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER }));
  railMesh.position.set(0, 0.095, 0.02);
  gun.add(railMesh);

  // Holographic Sight
  const sightGeo = new THREE.BoxGeometry(0.08, 0.09, 0.12);
  const sightMesh = new THREE.Mesh(sightGeo, toonMat(0x282d40));
  sightMesh.position.set(0, 0.14, -0.05);
  gun.add(sightMesh);

  const reticleGeo = new THREE.SphereGeometry(0.018, 6, 6);
  const reticleMesh = new THREE.Mesh(reticleGeo, new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
  reticleMesh.position.set(0, 0.15, -0.05);
  gun.add(reticleMesh);

  // Long Rifled Barrel & Muzzle Brake
  const barrelGeo = new THREE.CylinderGeometry(0.026, 0.028, 0.48, 10);
  const barrelMesh = new THREE.Mesh(barrelGeo, toonMat(0x353b4f));
  barrelMesh.rotation.x = Math.PI / 2;
  barrelMesh.position.set(0, 0.03, 0.52);
  gun.add(barrelMesh);

  const muzzleGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.1, 8);
  const muzzleMesh = new THREE.Mesh(muzzleGeo, toonMat(PALETTE.MAY_SCARF));
  muzzleMesh.rotation.x = Math.PI / 2;
  muzzleMesh.position.set(0, 0.03, 0.78);
  gun.add(muzzleMesh);

  // Handguard
  const guardGeo = new THREE.BoxGeometry(0.095, 0.11, 0.34);
  const guardMesh = new THREE.Mesh(guardGeo, toonMat(PALETTE.MAY_SCARF));
  guardMesh.position.set(0, 0.01, 0.42);
  addAnimeOutline(guardMesh, 1.05, PALETTE.GOLD_BORDER);
  gun.add(guardMesh);

  // Tactical Stock
  const stockGeo = new THREE.BoxGeometry(0.09, 0.17, 0.32);
  const stockMesh = new THREE.Mesh(stockGeo, toonMat(0x171924));
  stockMesh.position.set(0, -0.03, -0.44);
  gun.add(stockMesh);

  // Pistol Grip
  const gripGeo = new THREE.BoxGeometry(0.075, 0.22, 0.1);
  const gripMesh = new THREE.Mesh(gripGeo, toonMat(0x222636));
  gripMesh.position.set(0, -0.16, -0.14);
  gripMesh.rotation.x = -0.28;
  gun.add(gripMesh);

  // Detachable Curved Vandal Banana Magazine
  const magGroup = new THREE.Group();
  const magUpper = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.12), toonMat(0x1e2233));
  addAnimeOutline(magUpper, 1.07, PALETTE.MEMORIA_CYAN);
  const magGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.082, 0.18, 0.035),
    new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER })
  );
  magGlow.position.z = 0.045;
  magGroup.add(magUpper, magGlow);
  magGroup.position.set(0, -0.2, 0.12);
  magGroup.rotation.x = 0.22;
  gun.add(magGroup);

  // Muzzle Flash Star
  const flashGeo = new THREE.OctahedronGeometry(0.14, 0);
  const flashMat = new THREE.MeshBasicMaterial({
    color: PALETTE.MOTE_CORE,
    transparent: true,
    opacity: 0,
  });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.position.set(0, 0.03, 0.88);
  flashMesh.scale.set(1.2, 1.2, 2.2);
  gun.add(flashMesh);

  return { gun, magGroup, flashMesh, flashMat };
}

const SETTINGS_KEY = "dao_den_long_settings_v11";

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        volume: Math.max(0, Math.min(100, Number(parsed.volume ?? 75))),
        mouseSens: Math.max(20, Math.min(200, Number(parsed.mouseSens ?? 100))),
      };
    }
  } catch (_) {}
  return { volume: 75, mouseSens: 100 };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {}
}

async function loadContract() {
  try {
    const res = await fetch("/game.contract.json");
    if (res.ok) return await res.json();
  } catch (_) {}
  return {
    contract_version: "1.1",
    tuning: {
      player_speed: 6.0,
      dash_speed: 14.0,
      dash_duration_s: 0.2,
      dash_cooldown_s: 1.5,
      carry_capacity: 10,
      lantern_cost: 10,
      pickup_radius: 1.0,
      interact_radius: 2.0,
      pulse_cost: 3,
      pulse_radius: 5.0,
      night1_duration_s: 300,
      night2_duration_s: 330,
      night3_duration_s: 360,
      flames: 3,
      invuln_s: 1.5,
      hit_drop_ratio: 0.5,
      pulse_stun_s: 2.0,
      pulse_push_m: 4.0,
      pulse_cooldown_s: 3.0,
      safe_radius: 6.0,
      shade_speed: 4.0,
      shade_hit_radius: 1.0,
      fall_enabled: true,
      score: { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 },
    },
  };
}

class AnimeThreeIslandsApp {
  constructor(contract) {
    this.contract = contract;
    this.tuning = contract.tuning;
    this.settings = loadSavedSettings();
    this.audio = new CozyAudioEngine(this.settings.volume / 100);

    const params = new URLSearchParams(window.location.search);
    this.currentNight = Number(params.get("night")) || 1;
    if (![1, 2, 3].includes(this.currentNight)) this.currentNight = 1;

    // First-Person Mode is default per user request (can toggle with [V] or HUD button)
    this.firstPerson = params.get("tps") === "1" ? false : true;

    this.wonNightScores = { 1: 0, 2: 0, 3: 0 };
    this.sim = new GameSimulationJS(this.tuning, 2026 + this.currentNight, this.currentNight);

    this.started = false;
    this.botEnabled = false;
    this.camYawDeg = 0;
    this.fpsPitch = -0.06;
    this.camPitch = 0.44;
    this.camDist = 11.5;
    this.lastCountdownSec = -1;
    this.walkCyclePhase = 0;

    // Vandal Rifle & Floor Magazine State (Purely client-side so Headless Contract v1.1 is untouched)
    this.vandalClipMax = 25;
    this.vandalClip = 25;
    this.vandalReserve = 75;
    this.vandalMagsPicked = 3;
    this.isReloading = false;
    this.lastShotTime = 0;
    this.bulletTracers = [];
    this.floorMagazines = [];
    this.afterimages = [];

    this.keys = {};
    this.pendingJump = false;
    this.pendingInteract = false;
    this.pendingPulse = false;
    this.pendingDash = false;
    this.pendingPause = false;

    this.lanternMeshes = new Map();
    this.moteMeshes = new Map();
    this.shadeMeshes = new Map();
    this.drifterMeshes = new Map();
    this.charmMeshes = new Map();
    this.darkMistPuffs = [];
    this.cloudKoiList = [];
    this.windLeaves = [];

    this._initScene();
    this._buildSeaOfCloudsAndStars();
    this._buildPlayerEvernight();
    this._buildFPSVandalViewmodel();
    this._rebuildNightWorld(this.currentNight);
    this._syncEntities(0, 0.016);
    this._bindEvents();
    this._applySettingsToUI();
    this._updateCameraModeUI();
    this._playIntroAnime();

    if (params.get("bot") === "1") this.toggleBot(true);
    if (params.get("autostart") === "1") this.startGame();

    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fpsFrames = 0;
    this.fpsLastCheck = performance.now();
    this.currentFps = 60;
    requestAnimationFrame((t) => this._loop(t));
  }

  _initScene() {
    const container = document.getElementById("canvas-container");
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.NIGHT_SKY);
    this.scene.fog = new THREE.FogExp2(PALETTE.MIST, 0.02);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 220);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x5b72b5, PALETTE.NIGHT_SKY, 0.65);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0xd8e4ff, 1.15);
    this.moonLight.position.set(-22, 42, -18);
    this.scene.add(this.moonLight);

    this.islandRoot = new THREE.Group();
    this.scene.add(this.islandRoot);
  }

  _buildFPSVandalViewmodel() {
    // First-Person Vandal Rifle & Evernight Right Forearm attached directly to Camera
    this.fpsWeaponPivot = new THREE.Group();
    this.fpsVandal = createVandalRifleMesh();
    // Flip gun so barrel (+Z in local) points along camera -Z
    this.fpsVandal.gun.rotation.y = Math.PI;
    this.fpsWeaponPivot.add(this.fpsVandal.gun);

    // Evernight Gloved Hand & Starry Sleeve on the FPS Vandal
    const armGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.42, 10);
    const armMesh = new THREE.Mesh(armGeo, toonMat(0x231b3d));
    armMesh.rotation.x = Math.PI / 2.4;
    armMesh.position.set(0.03, -0.16, 0.25);
    addAnimeOutline(armMesh, 1.06, PALETTE.GOLD_BORDER);
    this.fpsWeaponPivot.add(armMesh);

    // Base FPS viewmodel position in lower-right corner
    this.fpsBasePos = { x: 0.34, y: -0.27, z: -0.56 };
    this.fpsRecoilOffset = { z: 0, pitch: 0, roll: 0 };
    this.fpsWeaponPivot.position.set(this.fpsBasePos.x, this.fpsBasePos.y, this.fpsBasePos.z);
    this.camera.add(this.fpsWeaponPivot);
  }

  _buildPlayerEvernight() {
    // Articulated 3D Anime Character Model: Evernight (HSR Inspired) with full skeletal joints for Run & Genshin Dash
    this.mayGroup = new THREE.Group();
    this.charRig = new THREE.Group();
    this.mayGroup.add(this.charRig);

    // 1. Torso & HSR Starry Astral Coat (#1f1938 with #E8E2D0 inner dress & #C8102E / #F2C14E trim)
    this.torsoPivot = new THREE.Group();
    this.torsoPivot.position.y = 0.88;
    this.charRig.add(this.torsoPivot);

    const upperDress = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.62, 12), toonMat(0x21193b));
    upperDress.position.y = 0.18;
    addAnimeOutline(upperDress, 1.07, PALETTE.GOLD_BORDER);
    this.torsoPivot.add(upperDress);

    const chestRibbon = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: PALETTE.MAY_SCARF }));
    chestRibbon.position.set(0, 0.3, 0.23);
    this.torsoPivot.add(chestRibbon);

    // Flowing Split Coat Tails (animate during run & dash)
    this.leftCoatTail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.06), toonMat(PALETTE.MAY_ROBE));
    this.leftCoatTail.position.set(-0.16, -0.22, -0.18);
    addAnimeOutline(this.leftCoatTail, 1.06, PALETTE.MAY_SCARF);
    this.torsoPivot.add(this.leftCoatTail);

    this.rightCoatTail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.06), toonMat(PALETTE.MAY_ROBE));
    this.rightCoatTail.position.set(0.16, -0.22, -0.18);
    addAnimeOutline(this.rightCoatTail, 1.06, PALETTE.MAY_SCARF);
    this.torsoPivot.add(this.rightCoatTail);

    // Scarf
    const scarfMesh = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), toonMat(PALETTE.MAY_SCARF));
    scarfMesh.rotation.x = Math.PI / 2;
    scarfMesh.position.y = 0.48;
    this.torsoPivot.add(scarfMesh);

    // 2. Head & Silver-Lavender HSR Anime Hair + Twin Flowing Tails
    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 0.68;
    this.torsoPivot.add(this.headPivot);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), toonMat(0xffe4d0));
    addAnimeOutline(headMesh, 1.07);
    this.headPivot.add(headMesh);

    // Glowing Star-Rail Crimson-Violet Anime Eyes
    const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b9d });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.09, 0.0, 0.23);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.09, 0.0, 0.23);
    this.headPivot.add(eyeL, eyeR);

    // Silver-Lavender Hair Dome & Twin Tails
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.285, 14, 12), toonMat(0xdad2f5));
    hairCap.position.set(0, 0.05, -0.03);
    addAnimeOutline(hairCap, 1.06, 0x2b1d4a);
    this.headPivot.add(hairCap);

    this.leftHairTail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.78, 8), toonMat(0xc5b8f0));
    this.leftHairTail.rotation.x = Math.PI * 0.88;
    this.leftHairTail.position.set(-0.22, -0.22, -0.18);
    addAnimeOutline(this.leftHairTail, 1.06);
    this.headPivot.add(this.leftHairTail);

    this.rightHairTail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.78, 8), toonMat(0xc5b8f0));
    this.rightHairTail.rotation.x = Math.PI * 0.88;
    this.rightHairTail.position.set(0.22, -0.22, -0.18);
    addAnimeOutline(this.rightHairTail, 1.06);
    this.headPivot.add(this.rightHairTail);

    // Starlight Crown / Nón Lá Halo Ornament
    const crownMesh = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.28, 16), toonMat(PALETTE.SAND));
    crownMesh.position.set(0, 0.3, -0.02);
    addAnimeOutline(crownMesh, 1.05, PALETTE.GOLD_BORDER);
    this.headPivot.add(crownMesh);

    // 3. Articulated Left & Right Arms + 3rd-Person Vandal Rifle
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.3, 0.4, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.52, 8), toonMat(PALETTE.MAY_ROBE));
    leftArmMesh.position.y = -0.22;
    addAnimeOutline(leftArmMesh, 1.07);
    this.leftArmPivot.add(leftArmMesh);
    this.torsoPivot.add(this.leftArmPivot);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.3, 0.4, 0);
    const rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.52, 8), toonMat(PALETTE.MAY_ROBE));
    rightArmMesh.position.y = -0.22;
    addAnimeOutline(rightArmMesh, 1.07);
    this.rightArmPivot.add(rightArmMesh);

    this.tpsVandal = createVandalRifleMesh();
    this.tpsVandal.gun.scale.setScalar(0.85);
    this.tpsVandal.gun.position.set(0.0, -0.35, 0.28);
    this.rightArmPivot.add(this.tpsVandal.gun);
    this.torsoPivot.add(this.rightArmPivot);

    // 4. Articulated Left & Right Legs (Thigh + High Anime Boots)
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.13, 0.72, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.7, 10), toonMat(0x1b1530));
    leftLegMesh.position.y = -0.35;
    addAnimeOutline(leftLegMesh, 1.07, PALETTE.GOLD_BORDER);
    this.leftLegPivot.add(leftLegMesh);
    this.charRig.add(this.leftLegPivot);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.13, 0.72, 0);
    const rightLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.7, 10), toonMat(0x1b1530));
    rightLegMesh.position.y = -0.35;
    addAnimeOutline(rightLegMesh, 1.07, PALETTE.GOLD_BORDER);
    this.rightLegPivot.add(rightLegMesh);
    this.charRig.add(this.rightLegPivot);

    // 5. Genshin Elemental Dash Wind Vortex Ring around Character
    const windRingGeo = new THREE.TorusGeometry(0.95, 0.045, 8, 28);
    this.dashWindRingMat = new THREE.MeshBasicMaterial({
      color: PALETTE.MEMORIA_CYAN,
      transparent: true,
      opacity: 0.0,
    });
    this.dashWindRing = new THREE.Mesh(windRingGeo, this.dashWindRingMat);
    this.dashWindRing.rotation.x = Math.PI / 2;
    this.dashWindRing.position.y = 0.9;
    this.mayGroup.add(this.dashWindRing);

    // Orbiting Wind Charm Talisman
    const charmOrbitGeo = new THREE.BoxGeometry(0.24, 0.42, 0.04);
    const charmOrbitMat = new THREE.MeshBasicMaterial({ color: PALETTE.MAY_SCARF });
    this.activeCharmMesh = new THREE.Mesh(charmOrbitGeo, charmOrbitMat);
    addAnimeOutline(this.activeCharmMesh, 1.15, PALETTE.GOLD_BORDER);
    this.activeCharmMesh.visible = false;
    this.mayGroup.add(this.activeCharmMesh);

    this.mayLight = new THREE.PointLight(PALETTE.LANTERN_LIT, 2.4, 14, 1.5);
    this.mayLight.position.set(0, 1.6, 0.55);
    this.mayGroup.add(this.mayLight);

    this.scene.add(this.mayGroup);
  }

  _animateCharacterRunAndDash(dt, elapsedSec) {
    const p = this.sim.player;
    const speedXZ = Math.hypot(p.vel[0], p.vel[2]);
    const isMoving = speedXZ > 0.25;
    const isDashing = this.sim.dash_active_ticks > 0;

    if (isDashing) {
      // Genshin Impact Elemental Sprint / Lunge Pose + Vortex Ring
      this.torsoPivot.rotation.x = 0.62;
      this.leftLegPivot.rotation.x = -0.65;
      this.rightLegPivot.rotation.x = 0.55;
      this.leftArmPivot.rotation.x = 0.85;
      this.rightArmPivot.rotation.x = -0.5;
      this.leftCoatTail.rotation.x = 0.75;
      this.rightCoatTail.rotation.x = 0.75;
      this.leftHairTail.rotation.x = Math.PI * 0.62;
      this.rightHairTail.rotation.x = Math.PI * 0.62;

      this.dashWindRingMat.opacity = 0.85;
      this.dashWindRing.rotation.z = elapsedSec * 14.0;
      this.dashWindRing.scale.setScalar(1.0 + Math.sin(elapsedSec * 25) * 0.15);
    } else if (isMoving) {
      // Dynamic Run Cycle Animation (Legs, Arms, Hair Tails, Coat Tails)
      this.walkCyclePhase += dt * speedXZ * 2.4;
      const swing = Math.sin(this.walkCyclePhase);
      const counterSwing = Math.cos(this.walkCyclePhase);

      this.torsoPivot.rotation.x = 0.16;
      this.torsoPivot.position.y = 0.88 + Math.abs(swing) * 0.08;
      this.leftLegPivot.rotation.x = swing * 0.82;
      this.rightLegPivot.rotation.x = -swing * 0.82;
      this.leftArmPivot.rotation.x = -swing * 0.65;
      // Right arm holds the Vandal rifle aimed forward with slight run bounce
      this.rightArmPivot.rotation.x = -0.65 + counterSwing * 0.15;

      this.leftCoatTail.rotation.x = 0.28 + Math.abs(swing) * 0.25;
      this.rightCoatTail.rotation.x = 0.28 + Math.abs(counterSwing) * 0.25;
      this.leftHairTail.rotation.x = Math.PI * 0.8 + Math.abs(swing) * 0.22;
      this.rightHairTail.rotation.x = Math.PI * 0.8 + Math.abs(counterSwing) * 0.22;
      this.dashWindRingMat.opacity = 0.0;
    } else {
      // Idle Breathing Pose
      const breath = Math.sin(elapsedSec * 3.0) * 0.04;
      this.torsoPivot.rotation.x = breath;
      this.torsoPivot.position.y = 0.88 + breath * 0.3;
      this.leftLegPivot.rotation.x = 0;
      this.rightLegPivot.rotation.x = 0;
      this.leftArmPivot.rotation.x = breath;
      this.rightArmPivot.rotation.x = -0.55;
      this.leftCoatTail.rotation.x = 0.08;
      this.rightCoatTail.rotation.x = 0.08;
      this.leftHairTail.rotation.x = Math.PI * 0.88;
      this.rightHairTail.rotation.x = Math.PI * 0.88;
      this.dashWindRingMat.opacity = 0.0;
    }

    // First-Person Vandal Viewmodel Bob, Dash Tilt & Recoil Recovery
    if (this.fpsWeaponPivot) {
      const bobX = isMoving ? Math.cos(this.walkCyclePhase * 0.5) * 0.018 : 0;
      const bobY = isMoving ? Math.abs(Math.sin(this.walkCyclePhase)) * 0.022 : Math.sin(elapsedSec * 2.5) * 0.005;
      const dashRoll = isDashing ? -0.42 : 0;
      const dashZ = isDashing ? -0.1 : 0;

      this.fpsWeaponPivot.position.set(
        this.fpsBasePos.x + bobX,
        this.fpsBasePos.y + bobY,
        this.fpsBasePos.z + dashZ + this.fpsRecoilOffset.z
      );
      this.fpsWeaponPivot.rotation.set(
        this.fpsRecoilOffset.pitch,
        0,
        dashRoll + this.fpsRecoilOffset.roll
      );
    }
  }

  _triggerGenshinDashAnim() {
    // 1. Screen speed-lines & cyan-gold elemental flash
    anime.remove("#genshin-dash-fx");
    anime({
      targets: "#genshin-dash-fx",
      opacity: [0.95, 0],
      duration: 380,
      easing: "easeOutQuad",
    });

    // 2. 360-degree Genshin aerial dash spin on character rig
    anime.remove(this.charRig.rotation);
    anime({
      targets: this.charRig.rotation,
      y: [0, Math.PI * 2],
      duration: 240,
      easing: "easeOutCubic",
      complete: () => {
        this.charRig.rotation.y = 0;
      },
    });

    // 3. Spawn glowing translucent afterimage clone at dash start position
    const p = this.sim.player;
    const ghostGeo = new THREE.ConeGeometry(0.45, 1.45, 10);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: PALETTE.MEMORIA_CYAN,
      transparent: true,
      opacity: 0.65,
    });
    const ghost = new THREE.Mesh(ghostGeo, ghostMat);
    ghost.position.set(p.pos[0], p.pos[1] + 0.75, p.pos[2]);
    this.scene.add(ghost);
    anime({
      targets: ghostMat,
      opacity: [0.65, 0],
      duration: 420,
      easing: "easeOutQuad",
      complete: () => {
        this.scene.remove(ghost);
        ghostGeo.dispose();
        ghostMat.dispose();
      },
    });
  }

  // --- Valorant Vandal Shooting, Reloading & Floor Ammo Magazines ---

  _spawnFloorMagazinesForNight(night) {
    for (const m of this.floorMagazines) {
      this.islandRoot.remove(m.group);
    }
    this.floorMagazines = [];

    const magCoords =
      night === 1
        ? [
            [8, 0, 8],
            [-8, 0, 8],
            [8, 0, -8],
            [-8, 0, -8],
            [18, 0, 0],
            [-18, 0, 0],
            [0, 0, 16],
            [0, 0, -16],
          ]
        : night === 2
        ? [
            [10, 0, 6],
            [-10, 0, -6],
            [30, 0, 0],
            [40, 0, 0],
            [60, 0, 8],
            [80, 0, -8],
            [70, 0, 12],
            [70, 0, -12],
          ]
        : [
            [10, 0, 10],
            [-10, 0, 10],
            [14, 0, -14],
            [-14, 0, -14],
            [15, 3, 12],
            [-15, 3, 12],
            [4, 6, 4],
            [-4, 6, -4],
          ];

    for (let i = 0; i < magCoords.length; i++) {
      const [x, y, z] = magCoords[i];
      const group = new THREE.Group();

      // Glowing floor pad
      const padRing = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide })
      );
      padRing.rotation.x = -Math.PI / 2;
      padRing.position.y = 0.05;
      group.add(padRing);

      // 3D Curved Vandal Ammo Magazine Box
      const magMesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.46, 0.26), toonMat(0x1e2436));
      addAnimeOutline(body, 1.1, 0x00ffcc);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.14, 0.28),
        new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER })
      );
      magMesh.add(body, stripe);
      magMesh.position.y = 0.55;
      magMesh.rotation.z = 0.25;
      group.add(magMesh);

      group.position.set(x, y, z);
      this.islandRoot.add(group);
      this.floorMagazines.push({
        id: `MAG_${i + 1}`,
        pos: [x, y, z],
        group,
        magMesh,
        available: true,
        respawnSec: 0,
      });
    }
  }

  _updateFloorMagazines(dt, elapsedSec) {
    const p = this.sim.player;
    for (const mag of this.floorMagazines) {
      if (!mag.available) {
        mag.respawnSec -= dt;
        if (mag.respawnSec <= 0) {
          mag.available = true;
          mag.group.visible = true;
        }
        continue;
      }
      mag.magMesh.rotation.y = elapsedSec * 2.8;
      mag.magMesh.position.y = 0.55 + Math.sin(elapsedSec * 3.5) * 0.12;

      if (distXZ(p.pos, mag.pos) <= 1.5 && Math.abs(p.pos[1] - mag.pos[1]) <= 1.6) {
        mag.available = false;
        mag.group.visible = false;
        mag.respawnSec = 10.0;
        this.vandalReserve += 25;
        this.vandalMagsPicked += 1;
        this.audio.playAmmoPickup();
        this._updateVandalHUD();
      }
    }
  }

  _shootVandal() {
    if (!this.started || this.sim.state !== "playing" || this.isReloading) return;
    const now = performance.now();
    if (now - this.lastShotTime < 105) return; // Vandal 9.5 rounds/sec fire rate

    if (this.vandalClip <= 0) {
      this._reloadVandal();
      return;
    }

    this.lastShotTime = now;
    this.vandalClip -= 1;
    this.audio.playVandalShot();
    this._updateVandalHUD();

    // 1. Anime.js Vandal Recoil Kick & Muzzle Flash
    this.fpsVandal.flashMat.opacity = 1.0;
    anime.remove(this.fpsVandal.flashMat);
    anime({
      targets: this.fpsVandal.flashMat,
      opacity: [1.0, 0.0],
      duration: 75,
      easing: "linear",
    });

    anime.remove(this.fpsRecoilOffset);
    anime({
      targets: this.fpsRecoilOffset,
      z: [0.065, 0],
      pitch: [0.08, 0],
      roll: [(Math.random() - 0.5) * 0.04, 0],
      duration: 140,
      easing: "easeOutQuad",
    });

    // 2. Compute Aim Ray & Spawn 3D Bullet Tracer + Ejected Magazine/Casing
    const p = this.sim.player;
    const yawRad = (this.camYawDeg * Math.PI) / 180.0;
    const dirX = Math.sin(yawRad);
    const dirZ = Math.cos(yawRad);
    const startPos = new THREE.Vector3(p.pos[0] + dirX * 0.6, p.pos[1] + 1.35, p.pos[2] + dirZ * 0.6);
    const endPos = new THREE.Vector3(p.pos[0] + dirX * 32.0, p.pos[1] + 1.35, p.pos[2] + dirZ * 32.0);

    // Check hit against Shades (Bóng Mực) and Drifters (Gió Lạc) along the shot ray
    let hitTarget = null;
    let bestDist = 32.0;

    for (const s of this.sim.shades) {
      const toX = s.pos[0] - p.pos[0];
      const toZ = s.pos[2] - p.pos[2];
      const proj = toX * dirX + toZ * dirZ;
      if (proj > 0 && proj < bestDist) {
        const perp = Math.abs(toX * dirZ - toZ * dirX);
        if (perp <= 1.25 && Math.abs(s.pos[1] - p.pos[1]) <= 2.2) {
          bestDist = proj;
          hitTarget = { kind: "shade", entity: s };
        }
      }
    }

    if (hitTarget) {
      const s = hitTarget.entity;
      endPos.set(s.pos[0], s.pos[1] + 0.8, s.pos[2]);
      s.state = "stunned";
      s.state_ticks_left = Math.max(s.state_ticks_left || 0, 75);
      s.pos[0] += dirX * 1.35;
      s.pos[2] += dirZ * 1.35;
      this.sim._enforceSafeZonesForShade(s);

      // Flash Valorant Red Hitmarker
      anime.remove("#fps-hitmarker");
      anime({
        targets: "#fps-hitmarker",
        opacity: [1, 0],
        scale: [1.3, 1.0],
        duration: 180,
        easing: "easeOutQuad",
      });
    }

    // 3D Glowing Bullet Tracer Line
    const pts = [startPos, endPos];
    const tracerGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const tracerMat = new THREE.LineBasicMaterial({
      color: PALETTE.GOLD_BORDER,
      transparent: true,
      opacity: 0.95,
    });
    const tracerLine = new THREE.Line(tracerGeo, tracerMat);
    this.scene.add(tracerLine);
    anime({
      targets: tracerMat,
      opacity: [0.95, 0],
      duration: 130,
      easing: "easeOutQuad",
      complete: () => {
        this.scene.remove(tracerLine);
        tracerGeo.dispose();
        tracerMat.dispose();
      },
    });

    if (this.vandalClip === 0 && this.vandalReserve > 0) {
      this._reloadVandal();
    }
  }

  _reloadVandal() {
    if (this.isReloading || this.vandalClip >= this.vandalClipMax || this.vandalReserve <= 0) return;
    this.isReloading = true;
    this.audio.playReload();
    this._updateVandalHUD();

    // Animate the 3D Vandal Magazine detaching & snapping a fresh magazine in
    const mag = this.fpsVandal.magGroup;
    anime
      .timeline({
        complete: () => {
          const needed = this.vandalClipMax - this.vandalClip;
          const take = Math.min(needed, this.vandalReserve);
          this.vandalClip += take;
          this.vandalReserve -= take;
          this.isReloading = false;
          this._updateVandalHUD();
        },
      })
      .add({
        targets: mag.position,
        y: [-0.2, -0.58],
        duration: 240,
        easing: "easeInQuad",
      })
      .add({
        targets: mag.position,
        y: [-0.58, -0.2],
        duration: 280,
        delay: 140,
        easing: "easeOutBack",
      });
  }

  _updateVandalHUD() {
    document.getElementById("vandal-clip").textContent = this.vandalClip;
    document.getElementById("vandal-reserve").textContent = this.vandalReserve;
    document.getElementById("vandal-mags-picked").textContent = this.vandalMagsPicked;
    const badge = document.getElementById("vandal-state-badge");
    if (this.isReloading) {
      badge.textContent = "ĐANG THAY BĂNG ĐẠN...";
      badge.style.color = "#FFB347";
    } else if (this.vandalClip === 0 && this.vandalReserve === 0) {
      badge.textContent = "HẾT ĐẠN — NHẶT BĂNG ĐẠN!";
      badge.style.color = "#FF5A5F";
    } else {
      badge.textContent = "SẴN SÀNG";
      badge.style.color = "#00ffcc";
    }
  }

  toggleCameraMode(forceFirstPerson = null) {
    this.firstPerson = forceFirstPerson !== null ? forceFirstPerson : !this.firstPerson;
    this._updateCameraModeUI();
  }

  _updateCameraModeUI() {
    const btn = document.getElementById("btn-cam-mode");
    if (btn) {
      btn.textContent = this.firstPerson ? "🎥 Góc Nhìn: FPS (1st) [V]" : "🎥 Góc Nhìn: TPS (3rd) [V]";
      btn.classList.toggle("active", this.firstPerson);
    }
    const ch = document.getElementById("fps-crosshair");
    if (ch) ch.classList.toggle("hidden", !this.firstPerson);
    if (this.fpsWeaponPivot) this.fpsWeaponPivot.visible = this.firstPerson;
    if (this.charRig) this.charRig.visible = !this.firstPerson;
  }

  _buildSeaOfCloudsAndStars() {
    this.cloudsGroup = new THREE.Group();
    const seaPlaneGeo = new THREE.PlaneGeometry(360, 360);
    const seaPlaneMat = new THREE.MeshBasicMaterial({
      color: PALETTE.CLOUD_SEA,
      transparent: true,
      opacity: 0.72,
    });
    const seaPlane = new THREE.Mesh(seaPlaneGeo, seaPlaneMat);
    seaPlane.rotation.x = -Math.PI / 2;
    seaPlane.position.y = -4.2;
    this.cloudsGroup.add(seaPlane);

    const cloudGeo = new THREE.SphereGeometry(5.5, 10, 8);
    const cloudMat = toonMat(PALETTE.CLOUD_SEA, { transparent: true, opacity: 0.85 });
    for (let i = 0; i < 42; i++) {
      const ang = (2 * Math.PI * i) / 42;
      const dist = 50 + (i % 4) * 12;
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set(Math.cos(ang) * dist + 15, -3.5 + (i % 3) * 0.7, Math.sin(ang) * dist);
      puff.scale.set(1.6, 0.5, 1.3);
      this.cloudsGroup.add(puff);
    }
    this.scene.add(this.cloudsGroup);

    // Cloud Koi (Cá Mây)
    this.koiGroup = new THREE.Group();
    const koiGeo = new THREE.ConeGeometry(0.45, 1.6, 8);
    const koiMat = new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER });
    for (let i = 0; i < 8; i++) {
      const koi = new THREE.Mesh(koiGeo, koiMat);
      koi.rotation.x = Math.PI / 2;
      this.koiGroup.add(koi);
      this.cloudKoiList.push({ mesh: koi, phase: i * 0.8, radius: 14 + (i % 3) * 8, cx: i < 4 ? 35 : 0 });
    }
    this.scene.add(this.koiGroup);

    // Starry Sky
    const starCount = 450;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.random() * 0.42 * Math.PI + 0.06;
      const r = 130 + Math.random() * 30;
      starPositions[i * 3] = r * Math.cos(phi) * Math.sin(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi);
      starPositions[i * 3 + 2] = r * Math.cos(phi) * Math.cos(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: PALETTE.MOTE_CORE, size: 0.9, transparent: true, opacity: 0.85 });
    this.scene.add(new THREE.Points(starGeo, starMat));

    // Volumetric Dark Mist Sprites (#1B2350)
    this.mistGroup = new THREE.Group();
    for (let i = 0; i < 20; i++) {
      const mat = new THREE.SpriteMaterial({
        map: mistTexture,
        color: PALETTE.MIST,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const angle = (2 * Math.PI * i) / 20;
      const radius = 8 + ((i * 11) % 30);
      const size = 5 + (i % 4) * 1.2;
      sprite.scale.set(size * 1.3, size * 0.6, 1);
      sprite.position.set(Math.cos(angle) * radius, 0.7 + (i % 3) * 0.4, Math.sin(angle) * radius);
      this.mistGroup.add(sprite);
      this.darkMistPuffs.push({ sprite, mat, angle, radius, baseY: 0.7 + (i % 3) * 0.4, speed: 0.03 * (i % 2 ? 1 : -1) });
    }
    this.scene.add(this.mistGroup);

    // Night 3 Wind Leaves
    this.windLeavesGroup = new THREE.Group();
    const leafGeo = new THREE.PlaneGeometry(0.28, 0.16);
    const leafMat = new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER, side: THREE.DoubleSide });
    for (let i = 0; i < 40; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set((Math.random() - 0.5) * 30, 1 + Math.random() * 6, (Math.random() - 0.5) * 30);
      this.windLeavesGroup.add(leaf);
      this.windLeaves.push(leaf);
    }
    this.windLeavesGroup.visible = false;
    this.scene.add(this.windLeavesGroup);
  }

  _buildOngDangNPC() {
    const npc = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.58, 1.35, 12), toonMat(PALETTE.WOOD));
    robe.position.y = 0.68;
    addAnimeOutline(robe, 1.06);
    npc.add(robe);

    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 8), toonMat(PALETTE.MAY_ROBE));
    beard.rotation.x = Math.PI;
    beard.position.set(0, 1.15, 0.25);
    npc.add(beard);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), toonMat(0xf5d0b5));
    head.position.y = 1.45;
    npc.add(head);

    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.42, 16), toonMat(PALETTE.SAND));
    hat.position.y = 1.78;
    addAnimeOutline(hat, 1.05);
    npc.add(hat);

    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8), toonMat(PALETTE.WOOD));
    staff.position.set(0.52, 0.95, 0.2);
    npc.add(staff);

    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: PALETTE.LANTERN_LIT }));
    lantern.position.set(0.52, 1.9, 0.35);
    npc.add(lantern);

    npc.position.set(-2.5, 0, 2.2);
    npc.rotation.y = 0.6;
    return npc;
  }

  _rebuildNightWorld(night) {
    while (this.islandRoot.children.length > 0) {
      this.islandRoot.remove(this.islandRoot.children[0]);
    }
    for (const m of this.lanternMeshes.values()) this.scene.remove(m.group);
    for (const m of this.moteMeshes.values()) this.scene.remove(m.group);
    for (const m of this.shadeMeshes.values()) this.scene.remove(m.group);
    for (const m of this.drifterMeshes.values()) this.scene.remove(m.group);
    for (const m of this.charmMeshes.values()) this.scene.remove(m.group);
    this.lanternMeshes.clear();
    this.moteMeshes.clear();
    this.shadeMeshes.clear();
    this.drifterMeshes.clear();
    this.charmMeshes.clear();

    if (night === 1) {
      const grass = new THREE.Mesh(new THREE.CylinderGeometry(38.5, 39.2, 1.4, 56), toonMat(PALETTE.GRASS));
      grass.position.y = -0.7;
      this.islandRoot.add(grass);

      const sandRim = new THREE.Mesh(new THREE.CylinderGeometry(40.0, 40.5, 1.2, 56), toonMat(PALETTE.SAND));
      sandRim.position.y = -0.75;
      this.islandRoot.add(sandRim);
    } else if (night === 2) {
      for (const cx of [0, 70]) {
        const grass = new THREE.Mesh(new THREE.CylinderGeometry(26.8, 27.4, 1.4, 48), toonMat(PALETTE.GRASS));
        grass.position.set(cx, -0.7, 0);
        this.islandRoot.add(grass);

        const sand = new THREE.Mesh(new THREE.CylinderGeometry(28.0, 28.5, 1.2, 48), toonMat(PALETTE.SAND));
        sand.position.set(cx, -0.75, 0);
        this.islandRoot.add(sand);
      }
      const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.28, 4.0), toonMat(PALETTE.WOOD));
      bridgeDeck.position.set(35.0, -0.14, 0.0);
      addAnimeOutline(bridgeDeck, 1.03);
      this.islandRoot.add(bridgeDeck);
    } else if (night === 3) {
      const tier0 = new THREE.Mesh(new THREE.CylinderGeometry(43.8, 44.5, 1.4, 60), toonMat(PALETTE.GRASS));
      tier0.position.y = -0.7;
      this.islandRoot.add(tier0);

      const sand0 = new THREE.Mesh(new THREE.CylinderGeometry(45.0, 45.5, 1.2, 60), toonMat(PALETTE.SAND));
      sand0.position.y = -0.75;
      this.islandRoot.add(sand0);

      const shape1 = new THREE.Shape();
      shape1.absarc(0, 0, 24.0, 0, Math.PI, false);
      const hole1 = new THREE.Path();
      hole1.absarc(0, 0, 12.0, 0, Math.PI, true);
      shape1.holes.push(hole1);
      const extrude1 = new THREE.ExtrudeGeometry(shape1, { depth: 3.0, bevelEnabled: false, curveSegments: 36 });
      const tier1Mesh = new THREE.Mesh(extrude1, toonMat(PALETTE.GRASS));
      tier1Mesh.rotation.x = Math.PI / 2;
      tier1Mesh.position.y = 3.0;
      this.islandRoot.add(tier1Mesh);

      const rampLen = Math.hypot(6.0, 3.0);
      const rampSlope = Math.atan2(3.0, 6.0);
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180.0;
        const rampGeo = new THREE.BoxGeometry(rampLen, 0.35, 3.0);
        const rampMesh = new THREE.Mesh(rampGeo, toonMat(PALETTE.SAND));
        const midR = 27.0;
        rampMesh.position.set(midR * Math.cos(rad), 1.5, midR * Math.sin(rad));
        rampMesh.rotation.y = -rad;
        rampMesh.rotation.z = -rampSlope;
        this.islandRoot.add(rampMesh);
      }

      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8.0, 8.0, 0.6, 36), toonMat(PALETTE.SAND));
      tier2.position.y = 5.7;
      this.islandRoot.add(tier2);

      const tower = new THREE.Group();
      const towerBody = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.0, 6.5, 12), toonMat(PALETTE.WOOD));
      towerBody.position.y = 9.25;
      addAnimeOutline(towerBody, 1.05);
      tower.add(towerBody);

      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.2, 12), toonMat(PALETTE.GOLD_BORDER));
      towerRoof.position.y = 13.4;
      addAnimeOutline(towerRoof, 1.05);
      tower.add(towerRoof);
      this.islandRoot.add(tower);
    }

    for (const pad of this.sim.mapCfg.jump_pads) {
      const padGroup = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(pad.radius, pad.radius * 1.15, 0.18, 24),
        new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER })
      );
      disc.position.y = 0.09;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(pad.radius * 0.55, pad.radius * 0.9, 24),
        new THREE.MeshBasicMaterial({ color: PALETTE.MOTE_CORE, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.2;
      padGroup.add(disc, ring);
      padGroup.position.set(pad.pos[0], pad.pos[1], pad.pos[2]);
      this.islandRoot.add(padGroup);
    }

    this.islandRoot.add(this._buildOngDangNPC());
    this._spawnFloorMagazinesForNight(night);

    const names = {
      1: "ĐÊM 1 · ĐẢO BẾN · EVERNIGHT (HSR)",
      2: "ĐÊM 2 · ĐẢO CAU · EVERNIGHT (HSR)",
      3: "ĐÊM 3 · ĐẢO CHUÔNG · EVERNIGHT (HSR)",
    };
    document.getElementById("hud-night-label").textContent = names[night] || "ĐẢO ĐÈN LỒNG";
    [1, 2, 3].forEach((n) => {
      const btn = document.getElementById(`btn-night-${n}`);
      if (btn) btn.classList.toggle("active", n === night);
    });
  }

  _createLanternMesh(lData) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.5, 8), toonMat(PALETTE.LANTERN_OFF));
    base.position.y = 0.25;
    addAnimeOutline(base, 1.05);
    group.add(base);

    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 2.2, 8), toonMat(PALETTE.WOOD));
    pillar.position.y = 1.55;
    addAnimeOutline(pillar, 1.06);
    group.add(pillar);

    const coreMat = new THREE.MeshStandardMaterial({
      color: PALETTE.LANTERN_OFF,
      emissive: PALETTE.LANTERN_OFF,
      emissiveIntensity: 0.2,
    });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 1.15, 6), coreMat);
    core.position.y = 3.2;
    addAnimeOutline(core, 1.07);
    group.add(core);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.18, 0.72, 6), toonMat(PALETTE.WOOD));
    roof.position.y = 4.1;
    addAnimeOutline(roof, 1.06);
    group.add(roof);

    const safeR = Number(this.tuning.safe_radius || 6.0);
    const ringMat = new THREE.MeshBasicMaterial({
      color: PALETTE.LANTERN_OFF,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(safeR - 0.16, safeR, 48), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.06;
    group.add(ringMesh);

    const light = new THREE.PointLight(PALETTE.LANTERN_LIT, 0, 22, 1.4);
    light.position.y = 3.4;
    light.visible = false;
    group.add(light);

    group.position.set(lData.pos[0], lData.pos[1], lData.pos[2]);
    this.scene.add(group);
    return { group, coreMat, ringMat, ringMesh, light };
  }

  _createMoteMesh(mData) {
    // Memoria (HSR Memory Crystal): Faceted Octahedron Prism + Orbiting Memory Ring
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: mData.kind === "dropped" ? PALETTE.LANTERN_LIT : PALETTE.MEMORIA_CYAN })
    );
    addAnimeOutline(crystal, 1.18, PALETTE.MEMORIA_VIOLET);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.03, 6, 18),
      new THREE.MeshBasicMaterial({ color: PALETTE.MOTE_CORE, transparent: true, opacity: 0.7 })
    );
    group.add(crystal, ring);
    group.position.set(mData.pos[0], mData.pos[1] + 0.75, mData.pos[2]);
    this.scene.add(group);
    return { group, crystal, ring, phase: Math.random() * Math.PI * 2 };
  }

  _createShadeMesh(sData) {
    const group = new THREE.Group();
    const bodyMat = toonMat(PALETTE.SHADE_BODY);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 14), bodyMat);
    body.position.y = 0.72;
    body.scale.set(1, 1.18, 1);
    addAnimeOutline(body, 1.1, PALETTE.SHADE_RIM);
    group.add(body);

    const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.SHADE_RIM });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.2, 0.82, 0.54);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.2, 0.82, 0.54);
    group.add(eyeL, eyeR);

    const stunRing = new THREE.Group();
    stunRing.position.y = 1.65;
    const starGeo = new THREE.OctahedronGeometry(0.13, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER });
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(starGeo, starMat);
      const a = (2 * Math.PI * i) / 3;
      st.position.set(Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48);
      stunRing.add(st);
    }
    stunRing.visible = false;
    group.add(stunRing);

    group.position.set(sData.pos[0], sData.pos[1], sData.pos[2]);
    this.scene.add(group);
    return { group, body, bodyMat, stunRing };
  }

  _createDrifterMesh(dData) {
    const group = new THREE.Group();
    const silkGeo = new THREE.TorusKnotGeometry(0.45, 0.11, 32, 8, 2, 3);
    const silkMat = toonMat(PALETTE.DRIFTER, { transparent: true, opacity: 0.9 });
    const silk = new THREE.Mesh(silkGeo, silkMat);
    silk.position.y = 1.25;
    addAnimeOutline(silk, 1.07, PALETTE.GOLD_BORDER);
    group.add(silk);
    group.position.set(dData.pos[0], dData.pos[1], dData.pos[2]);
    this.scene.add(group);
    return { group, silk, silkMat };
  }

  _createCharmMesh(cData) {
    const group = new THREE.Group();
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.85, 0.08),
      new THREE.MeshBasicMaterial({ color: PALETTE.MAY_SCARF })
    );
    card.position.y = 1.1;
    addAnimeOutline(card, 1.12, PALETTE.GOLD_BORDER);
    group.add(card);
    group.position.set(cData.pos[0], cData.pos[1], cData.pos[2]);
    this.scene.add(group);
    return { group, card };
  }

  _syncEntities(elapsedSec, dt = 0.016) {
    const p = this.sim.player;
    this.mayGroup.position.set(p.pos[0], p.pos[1], p.pos[2]);
    this.mayGroup.rotation.y = p.facingYaw || 0;
    this.mayGroup.visible =
      this.sim.fall_wait_ticks === 0 && (this.sim.invuln_ticks <= 0 || Math.floor(elapsedSec * 18) % 2 === 0);

    // Animate Evernight Run Cycle & Genshin Dash Pose
    this._animateCharacterRunAndDash(dt, elapsedSec);

    if (this.sim.charm_ticks > 0) {
      this.activeCharmMesh.visible = true;
      this.activeCharmMesh.position.set(Math.cos(elapsedSec * 6) * 0.85, 1.25, Math.sin(elapsedSec * 6) * 0.85);
      this.activeCharmMesh.rotation.y = elapsedSec * 4;
    } else {
      this.activeCharmMesh.visible = false;
    }

    const carryRatio = p.carried / Math.max(1, Number(this.tuning.carry_capacity || 10));
    this.mayLight.intensity = 1.8 + carryRatio * 3.0;

    // Sync Lanterns
    let litCount = 0;
    for (const l of this.sim.lanterns) {
      let entry = this.lanternMeshes.get(l.id);
      if (!entry) {
        entry = this._createLanternMesh(l);
        this.lanternMeshes.set(l.id, entry);
      }
      entry.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      if (l.lit) {
        litCount++;
        entry.coreMat.color.setHex(PALETTE.LANTERN_CORE);
        entry.coreMat.emissive.setHex(PALETTE.LANTERN_LIT);
        entry.coreMat.emissiveIntensity = 1.6;
        entry.ringMat.color.setHex(PALETTE.LANTERN_LIT);
        entry.ringMat.opacity = 0.6;
        entry.light.visible = true;
        entry.light.intensity = 4.5;
      } else {
        entry.coreMat.color.setHex(PALETTE.LANTERN_OFF);
        entry.coreMat.emissive.setHex(PALETTE.LANTERN_OFF);
        entry.coreMat.emissiveIntensity = 0.2;
        entry.ringMat.color.setHex(PALETTE.LANTERN_OFF);
        entry.ringMat.opacity = 0.22;
        entry.light.intensity = 0;
        entry.light.visible = false;
      }
    }

    const totalL = Math.max(1, this.sim.lanterns.length);
    const progress = litCount / totalL;
    this.ambientLight.intensity = 0.15 + 0.55 * progress;
    this.scene.fog.density = 0.02 - progress * 0.011;

    // Sync Memoria Crystals (Motes)
    const activeMoteIds = new Set();
    for (const m of this.sim.motes) {
      activeMoteIds.add(m.id);
      let entry = this.moteMeshes.get(m.id);
      if (!entry) {
        entry = this._createMoteMesh(m);
        this.moteMeshes.set(m.id, entry);
      }
      const hoverY = m.pos[1] + 0.75 + Math.sin(elapsedSec * 3.5 + entry.phase) * 0.22;
      entry.group.position.set(m.pos[0], hoverY, m.pos[2]);
      entry.crystal.rotation.y = elapsedSec * 2.5 + entry.phase;
      entry.ring.rotation.x = elapsedSec * 3.0;
      entry.ring.rotation.y = elapsedSec * 2.0;
    }
    for (const [id, entry] of this.moteMeshes.entries()) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(entry.group);
        this.moteMeshes.delete(id);
      }
    }

    // Sync Shades
    const activeShadeIds = new Set();
    for (const s of this.sim.shades) {
      activeShadeIds.add(s.id);
      let entry = this.shadeMeshes.get(s.id);
      if (!entry) {
        entry = this._createShadeMesh(s);
        this.shadeMeshes.set(s.id, entry);
      }
      entry.group.position.set(s.pos[0], s.pos[1], s.pos[2]);
      if (s.state === "stunned") {
        entry.stunRing.visible = true;
        entry.stunRing.rotation.y = elapsedSec * 5;
        entry.bodyMat.color.setHex(PALETTE.SHADE_STUN);
      } else {
        entry.stunRing.visible = false;
        entry.bodyMat.color.setHex(PALETTE.SHADE_BODY);
      }
    }
    for (const [id, entry] of this.shadeMeshes.entries()) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(entry.group);
        this.shadeMeshes.delete(id);
      }
    }

    // Sync Drifters
    const activeDrifterIds = new Set();
    for (const d of this.sim.drifters) {
      if (d.state === "removed") continue;
      activeDrifterIds.add(d.id);
      let entry = this.drifterMeshes.get(d.id);
      if (!entry) {
        entry = this._createDrifterMesh(d);
        this.drifterMeshes.set(d.id, entry);
      }
      entry.group.position.set(d.pos[0], d.pos[1], d.pos[2]);
      entry.silk.rotation.y = elapsedSec * 3.5;
    }
    for (const [id, entry] of this.drifterMeshes.entries()) {
      if (!activeDrifterIds.has(id)) {
        this.scene.remove(entry.group);
        this.drifterMeshes.delete(id);
      }
    }

    // Sync Wind Charms
    for (const c of this.sim.charms) {
      let entry = this.charmMeshes.get(c.id);
      if (!entry) {
        entry = this._createCharmMesh(c);
        this.charmMeshes.set(c.id, entry);
      }
      entry.group.visible = c.available;
      entry.card.rotation.y = elapsedSec * 2.5;
    }

    // Update Floor Vandal Magazines
    this._updateFloorMagazines(dt, elapsedSec);

    // Camera Positioning: First-Person (FPS) vs Third-Person (TPS)
    const yawRad = (this.camYawDeg * Math.PI) / 180.0;
    if (this.firstPerson) {
      const speedXZ = Math.hypot(p.vel[0], p.vel[2]);
      const headBob = speedXZ > 0.25 ? Math.sin(this.walkCyclePhase) * 0.055 : 0;
      const eyeY = p.pos[1] + 1.52 + headBob;
      this.camera.position.set(p.pos[0], eyeY, p.pos[2]);
      const lookDist = 20.0;
      const targetX = p.pos[0] + Math.sin(yawRad) * lookDist * Math.cos(this.fpsPitch);
      const targetZ = p.pos[2] + Math.cos(yawRad) * lookDist * Math.cos(this.fpsPitch);
      const targetY = eyeY + Math.sin(this.fpsPitch) * lookDist;
      this.camera.lookAt(targetX, targetY, targetZ);
    } else {
      const camX = p.pos[0] - Math.sin(yawRad) * this.camDist * Math.cos(this.camPitch);
      const camZ = p.pos[2] - Math.cos(yawRad) * this.camDist * Math.cos(this.camPitch);
      const camY = p.pos[1] + 2.2 + Math.sin(this.camPitch) * this.camDist;
      this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.25);
      this.camera.lookAt(p.pos[0], p.pos[1] + 1.25, p.pos[2]);
    }

    this._updateHUD(litCount);
  }

  _updateHUD(litCount) {
    const p = this.sim.player;
    const cap = Number(this.tuning.carry_capacity || 10);

    document.querySelectorAll("#flames-container .flame-pip").forEach((el, idx) => {
      el.classList.toggle("lost", idx >= p.flames);
    });
    const charmBadge = document.getElementById("charm-badge");
    if (this.sim.charm_ticks > 0) {
      charmBadge.classList.remove("hidden");
      document.getElementById("charm-timer").textContent = `${(this.sim.charm_ticks / 60).toFixed(1)}s`;
    } else {
      charmBadge.classList.add("hidden");
    }

    const rem = Math.max(0, Math.ceil(this.sim.time_left_s));
    const mm = String(Math.floor(rem / 60)).padStart(2, "0");
    const ss = String(rem % 60).padStart(2, "0");
    const timerEl = document.getElementById("timer-display");
    timerEl.textContent = `${mm}:${ss}`;
    timerEl.classList.toggle("danger", rem <= 30 && this.sim.state === "playing");
    if (rem <= 10 && rem > 0 && rem !== this.lastCountdownSec && this.sim.state === "playing") {
      this.lastCountdownSec = rem;
      this.audio.playCountdownTick();
    }

    document.getElementById("lanterns-text").textContent = `${litCount}/${this.sim.lanterns.length}`;
    document.getElementById("score-display").textContent = this.sim.score;
    const totalCampaign =
      (this.currentNight === 1 ? this.sim.score : this.wonNightScores[1]) +
      (this.currentNight === 2 ? this.sim.score : this.wonNightScores[2]) +
      (this.currentNight === 3 ? this.sim.score : this.wonNightScores[3]);
    document.getElementById("total-score-display").textContent = totalCampaign;

    document.getElementById("carried-text").textContent = `${p.carried}/${cap}`;
    document.querySelectorAll("#motes-pills .mote-slot").forEach((el, idx) => {
      el.classList.toggle("filled", idx < p.carried);
    });

    const interactR = Number(this.tuning.interact_radius || 2.0);
    const nearLantern = this.sim.lanterns
      .filter((l) => !l.lit && distXZ(p.pos, l.pos) <= interactR + 0.25 && Math.abs(p.pos[1] - l.pos[1]) <= 2.0)
      .sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos))[0];

    const promptEl = document.getElementById("context-prompt");
    if (nearLantern) {
      promptEl.textContent = `E — Nạp ánh sáng (${nearLantern.deposited}/10)`;
      promptEl.classList.add("visible");
    } else {
      promptEl.classList.remove("visible");
    }

    const dashCdS = this.sim.dash_cd_ticks / 60;
    const dashBox = document.getElementById("cd-dash-box");
    const dashText = document.getElementById("cd-dash-text");
    if (this.sim.charm_ticks > 0) {
      dashBox.classList.remove("on-cd");
      dashText.textContent = "Bùa: 0.0s";
    } else if (dashCdS > 0.02) {
      dashBox.classList.add("on-cd");
      dashText.textContent = `${dashCdS.toFixed(1)}s`;
    } else {
      dashBox.classList.remove("on-cd");
      dashText.textContent = "Sẵn sàng";
    }

    const pulseCdS = this.sim.pulse_cd_ticks / 60;
    const pulseBox = document.getElementById("cd-pulse-box");
    const pulseText = document.getElementById("cd-pulse-text");
    if (pulseCdS > 0.02) {
      pulseBox.classList.add("on-cd");
      pulseText.textContent = `${pulseCdS.toFixed(1)}s`;
    } else if (p.carried < 3) {
      pulseBox.classList.add("on-cd");
      pulseText.textContent = "Cần 3 đóm";
    } else {
      pulseBox.classList.remove("on-cd");
      pulseText.textContent = "Sẵn sàng";
    }

    const windEl = document.getElementById("wind-indicator");
    if (this.sim.wind_active) {
      windEl.classList.remove("hidden");
      windEl.textContent = `🌬️ Gió mạnh đang đẩy (${Math.round(this.sim.wind_dir_deg)}°)!`;
    } else if (this.sim.wind_warning) {
      windEl.classList.remove("hidden");
      windEl.textContent = `🍃 Cảnh báo: Gió mạnh sắp thổi sau 2 giây (${Math.round(this.sim.wind_dir_deg)}°)!`;
    } else {
      windEl.classList.add("hidden");
    }

    this._updateOffscreenLanternArrow();
  }

  _updateOffscreenLanternArrow() {
    const arrowEl = document.getElementById("offscreen-arrow");
    const unlit = this.sim.lanterns.filter((l) => !l.lit);
    if (unlit.length === 0) {
      arrowEl.classList.add("hidden");
      return;
    }
    const p = this.sim.player;
    unlit.sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos));
    const target = unlit[0];
    const worldPos = new THREE.Vector3(target.pos[0], target.pos[1] + 2.5, target.pos[2]);
    const ndc = worldPos.clone().project(this.camera);

    const isBehind = ndc.z > 1.0;
    const isOffscreen = isBehind || Math.abs(ndc.x) > 0.92 || Math.abs(ndc.y) > 0.88;
    if (!isOffscreen) {
      arrowEl.classList.add("hidden");
      return;
    }

    arrowEl.classList.remove("hidden");
    const nx = isBehind ? -ndc.x : ndc.x;
    const ny = isBehind ? -ndc.y : ndc.y;
    const angle = Math.atan2(nx, ny);
    const margin = 58;
    const halfW = window.innerWidth / 2 - margin;
    const halfH = window.innerHeight / 2 - margin;
    const sx = window.innerWidth / 2 + Math.sin(angle) * Math.min(halfW, halfH);
    const sy = window.innerHeight / 2 - Math.cos(angle) * Math.min(halfW, halfH);
    arrowEl.style.left = `${sx}px`;
    arrowEl.style.top = `${sy}px`;
    arrowEl.style.transform = `rotate(${(angle * 180) / Math.PI}deg)`;
  }

  _handleSimEvents(events) {
    for (const ev of events) {
      if (ev.name === "mote_picked") {
        this.audio.playMotePickup(ev.data.carried);
      } else if (ev.name === "charm_picked") {
        this.audio.playCharmPickup();
        this._showAnimeBanner("BÙA GIÓ KHAI MỞ!", "TỐC ĐỘ 7.2 M/S · LƯỚT GENSHIN KHÔNG HỒI CHIÊU");
      } else if (ev.name === "deposit") {
        this.audio.playDeposit();
      } else if (ev.name === "lantern_lit") {
        this.audio.playLanternLit();
        this._showAnimeBanner(`ĐÈN LỒNG ${ev.data.lantern_id} BỪNG SÁNG!`, "VÙNG AN TOÀN 6M ĐÃ KÍCH HOẠT");
      } else if (ev.name === "pulse") {
        this.audio.playPulse();
        anime({
          targets: "#screen-pulse-ring",
          scale: [0.2, 4.2],
          opacity: [0.9, 0],
          duration: 550,
          easing: "easeOutExpo",
        });
      } else if (ev.name === "dash") {
        this.audio.playDash();
        this._triggerGenshinDashAnim();
      } else if (ev.name === "jump") {
        this.audio.playJump(Boolean(ev.data && ev.data.pad));
      } else if (ev.name === "shade_spawned") {
        this.audio.playShadeSpawned();
      } else if (ev.name === "wind_warning") {
        this.audio.playWindWarning();
      } else if (ev.name === "drifter_steal") {
        this.audio.playHit();
        this._showAnimeBanner("GIÓ LẠC CƯỚP MEMORIA!", "BẮN VANDAL HOẶC TỎA SÁNG [R] ĐỂ ĐÁNH RƠI LẠI!");
      } else if (ev.name === "drifter_drop") {
        this.audio.playCharmPickup();
      } else if (ev.name === "player_hit") {
        this.audio.playHit();
      } else if (ev.name === "paused") {
        document.getElementById("pause-modal").classList.remove("hidden");
      } else if (ev.name === "resumed") {
        document.getElementById("pause-modal").classList.add("hidden");
      } else if (ev.name === "game_over") {
        const won = ev.data.result === "won";
        if (won) this.wonNightScores[this.currentNight] = this.sim.score;
        this.audio.playGameOver(won);
        this._showGameOverModal(won, ev.data.reason);
      }
    }
  }

  _showAnimeBanner(mainText, subText) {
    document.getElementById("banner-main").textContent = mainText;
    document.getElementById("banner-sub").textContent = subText;
    anime.remove("#anime-banner");
    anime
      .timeline()
      .add({ targets: "#anime-banner", opacity: [0, 1], scale: [0.82, 1], duration: 350, easing: "easeOutBack" })
      .add({ targets: "#anime-banner", opacity: 0, scale: 1.05, delay: 1300, duration: 400, easing: "easeInQuad" });
  }

  _playIntroAnime() {
    const info = NIGHT_STORIES[this.currentNight];
    document.getElementById("intro-title").textContent = info.title;
    document.getElementById("ong-dang-text").innerHTML = info.quote;
    anime({
      targets: "#intro-svg-path",
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: "easeInOutSine",
      duration: 1600,
      loop: true,
      direction: "alternate",
    });
  }

  _showGameOverModal(won, reason) {
    const modal = document.getElementById("gameover-modal");
    modal.classList.remove("hidden");
    const totalScore = this.wonNightScores[1] + this.wonNightScores[2] + this.wonNightScores[3];
    document.getElementById("go-score").textContent = this.sim.score;
    document.getElementById("go-total-score").textContent = totalScore;

    const nextBtn = document.getElementById("btn-next-night");
    if (won && this.currentNight < 3) {
      document.getElementById("go-subtitle").textContent = `HOÀN THÀNH ĐÊM ${this.currentNight}`;
      document.getElementById("go-title").textContent = "HÒN ĐẢO ĐÃ BỪNG SÁNG!";
      document.getElementById("go-desc").textContent =
        `"Giỏi lắm Evernight! Toàn bộ Đèn Lồng trên đảo đã được nạp đầy Memoria. Hãy chuẩn bị bước sang Đêm ${this.currentNight + 1} nhé!"`;
      nextBtn.classList.remove("hidden");
      nextBtn.textContent = `➡ Sang Đêm ${this.currentNight + 1}`;
    } else if (won && this.currentNight === 3) {
      document.getElementById("go-subtitle").textContent = "BÌNH MINH TRÊN QUẦN ĐẢO ĐÈN LỒNG";
      document.getElementById("go-title").textContent = "🌅 BÌNH MINH RỰC RỠ!";
      document.getElementById("go-desc").textContent =
        `"Cả ba hòn đảo Đảo Bến, Đảo Cau và Đảo Chuông đã bừng sáng! Sương đen tan biến hoàn toàn trước ánh bình minh!"`;
      nextBtn.classList.add("hidden");
    } else {
      document.getElementById("go-subtitle").textContent = `THẤT BẠI · ĐÊM ${this.currentNight}`;
      document.getElementById("go-title").textContent =
        reason === "dawn" ? "BÌNH MINH ĐÃ QUA..." : "NGỌN LỬA ĐÃ TẮT...";
      document.getElementById("go-desc").textContent =
        `"Đừng nản lòng Evernight! Hãy nạp lại băng đạn Vandal và thử lại Đêm ${this.currentNight} một lần nữa!"`;
      nextBtn.classList.add("hidden");
    }
  }

  selectNight(night, showIntro = true) {
    this.currentNight = Number(night) || 1;
    this.sim = new GameSimulationJS(this.tuning, 2026 + this.currentNight, this.currentNight);
    this.vandalClip = 25;
    this.vandalReserve = 75;
    this._updateVandalHUD();
    this._rebuildNightWorld(this.currentNight);
    this._syncEntities(0, 0.016);
    document.getElementById("gameover-modal").classList.add("hidden");
    document.getElementById("pause-modal").classList.add("hidden");
    if (showIntro) {
      this.started = false;
      document.getElementById("intro-modal").classList.remove("hidden");
      this._playIntroAnime();
    } else {
      this.started = true;
      document.getElementById("intro-modal").classList.add("hidden");
    }
  }

  startGame() {
    this.started = true;
    this.audio.startBGM();
    document.getElementById("intro-modal").classList.add("hidden");
  }

  toggleBot(force = null) {
    this.botEnabled = force !== null ? force : !this.botEnabled;
    const btn = document.getElementById("btn-bot");
    btn.textContent = this.botEnabled ? "🤖 Tự Chơi: BẬT" : "🤖 Tự Chơi: TẮT";
    btn.classList.toggle("active", this.botEnabled);
  }

  _computeBotInput() {
    const p = this.sim.player;
    const closeShade = this.sim.shades.find((s) => s.state !== "stunned" && distXZ(p.pos, s.pos) <= 4.0);
    const stolenDrifter = this.sim.drifters.find(
      (d) => d.state !== "removed" && distXZ(p.pos, d.pos) <= 4.5 && (d.state === "chase" || d.stolen > 0)
    );
    const wantPulse = Boolean(
      (closeShade || stolenDrifter) && p.carried >= 3 && this.sim.pulse_cd_ticks === 0 && !this.sim.input_state.pulse
    );

    const unlit = this.sim.lanterns.filter((l) => !l.lit);
    const nearLantern = unlit.find((l) => distXZ(p.pos, l.pos) <= 1.85 && Math.abs(p.pos[1] - l.pos[1]) <= 1.8);
    const wantInteract = Boolean(nearLantern && p.carried > 0 && !this.sim.input_state.interact);

    let targetPos = [0, 0, 0];
    if (unlit.length > 0) {
      unlit.sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos));
      const nextL = unlit[0];
      const need = 10 - nextL.deposited;
      if (p.carried >= need || p.carried >= 10 || this.sim.motes.length === 0) {
        targetPos = nextL.pos;
      } else {
        const sameTierMotes = this.sim.motes.filter((m) => Math.abs(m.pos[1] - p.pos[1]) <= 1.5);
        const pool = sameTierMotes.length > 0 ? sameTierMotes : this.sim.motes;
        const sorted = [...pool].sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos));
        targetPos = sorted[0].pos;
      }
      if (this.currentNight === 2) {
        const onIslandA = p.pos[0] < 26.5;
        const onIslandB = p.pos[0] > 43.5;
        if (onIslandA && targetPos[0] > 43.5) targetPos = [35.0, 0.0, 0.0];
        else if (onIslandB && targetPos[0] < 26.5) targetPos = [35.0, 0.0, 0.0];
      }
    }

    let vx = targetPos[0] - p.pos[0];
    let vz = targetPos[2] - p.pos[2];
    const d = Math.hypot(vx, vz);
    if (d > 0.1) {
      vx /= d;
      vz /= d;
      this.camYawDeg = (Math.atan2(vx, vz) * 180.0) / Math.PI;
    }

    // Bot automatically fires Vandal at nearby active shades
    if (this.sim.shades.some((s) => s.state !== "stunned" && distXZ(p.pos, s.pos) <= 14.0)) {
      this._shootVandal();
    }

    const theta = (this.camYawDeg * Math.PI) / 180.0;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    let mx = vx * cosT - vz * sinT;
    let mz = vx * sinT + vz * cosT;
    const mag = Math.hypot(mx, mz);
    if (mag > 1.0) {
      mx /= mag;
      mz /= mag;
    }

    const wantDash = Boolean(
      d > 7.5 && this.sim.dash_cd_ticks === 0 && this.sim.dash_active_ticks === 0 && !this.sim.input_state.dash
    );

    return {
      move: [mx, mz],
      cam_yaw_deg: this.camYawDeg,
      jump: false,
      interact: wantInteract,
      pulse: wantPulse,
      dash: wantDash,
      pause: false,
    };
  }

  _applySettingsToUI() {
    document.getElementById("input-volume").value = this.settings.volume;
    document.getElementById("val-volume").textContent = `${this.settings.volume}%`;
    document.getElementById("input-sens").value = this.settings.mouseSens;
    document.getElementById("val-sens").textContent = `${(this.settings.mouseSens / 100).toFixed(1)}x`;
    this.audio.setVolume(this.settings.volume / 100);
  }

  _bindEvents() {
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener("keydown", (e) => {
      const code = e.code;
      this.keys[code] = true;
      if (code === "Space") this.pendingJump = true;
      if (code === "KeyE" || code === "KeyF") this.pendingInteract = true;
      if (code === "KeyR") this.pendingPulse = true;
      if (code === "ShiftLeft" || code === "ShiftRight") this.pendingDash = true;
      if (code === "Escape" || code === "KeyP") this.pendingPause = true;
      if (code === "KeyV") this.toggleCameraMode();
      if (code === "KeyG") this._reloadVandal();
      if (code === "KeyB") this._shootVandal();
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    this.renderer.domElement.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this._shootVandal();
      }
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        const sens = (this.settings.mouseSens / 100) * 0.45;
        this.camYawDeg = (this.camYawDeg - dx * sens) % 360;
        this.fpsPitch = Math.max(-0.55, Math.min(0.55, this.fpsPitch - dy * 0.004));
      }
    });

    document.getElementById("btn-cam-mode").addEventListener("click", () => this.toggleCameraMode());
    document.getElementById("btn-start-game").addEventListener("click", () => this.startGame());
    document.getElementById("btn-play-again").addEventListener("click", () => this.selectNight(this.currentNight, false));
    document.getElementById("btn-next-night").addEventListener("click", () => {
      if (this.currentNight < 3) this.selectNight(this.currentNight + 1, true);
    });

    [1, 2, 3].forEach((n) => {
      document.getElementById(`btn-night-${n}`).addEventListener("click", () => this.selectNight(n, false));
    });
    document.querySelectorAll("[data-select-night]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const n = Number(e.currentTarget.getAttribute("data-select-night"));
        this.selectNight(n, true);
      });
    });

    document.getElementById("btn-bot").addEventListener("click", () => this.toggleBot());
    document.getElementById("btn-pause").addEventListener("click", () => {
      this.pendingPause = true;
    });
    document.getElementById("btn-resume").addEventListener("click", () => {
      this.pendingPause = true;
    });
    document.getElementById("btn-pause-restart").addEventListener("click", () => this.selectNight(this.currentNight, false));
    document.getElementById("btn-pause-menu").addEventListener("click", () => this.selectNight(this.currentNight, true));

    const openSettings = () => document.getElementById("settings-modal").classList.remove("hidden");
    document.getElementById("btn-open-settings").addEventListener("click", openSettings);
    document.getElementById("btn-pause-settings").addEventListener("click", openSettings);
    document.getElementById("input-volume").addEventListener("input", (e) => {
      this.settings.volume = Number(e.target.value);
      this._applySettingsToUI();
      saveSettings(this.settings);
    });
    document.getElementById("input-sens").addEventListener("input", (e) => {
      this.settings.mouseSens = Number(e.target.value);
      this._applySettingsToUI();
      saveSettings(this.settings);
    });
    document.getElementById("btn-close-settings").addEventListener("click", () => {
      saveSettings(this.settings);
      document.getElementById("settings-modal").classList.add("hidden");
    });
  }

  _readManualInput() {
    if (this.keys["KeyQ"]) this.camYawDeg = (this.camYawDeg + 2.2) % 360;
    if (this.keys["KeyC"]) this.camYawDeg = (this.camYawDeg - 2.2) % 360;

    let mx = 0;
    let mz = 0;
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) mz += 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) mz -= 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) mx += 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) mx -= 1;

    const frame = {
      move: [mx, mz],
      cam_yaw_deg: this.camYawDeg,
      jump: this.pendingJump,
      interact: this.pendingInteract,
      pulse: this.pendingPulse,
      dash: this.pendingDash,
      pause: this.pendingPause,
    };
    this.pendingJump = false;
    this.pendingInteract = false;
    this.pendingPulse = false;
    this.pendingDash = false;
    this.pendingPause = false;
    return frame;
  }

  _loop(now) {
    this.fpsFrames++;
    if (now - this.fpsLastCheck >= 1000) {
      this.currentFps = Math.round((this.fpsFrames * 1000) / (now - this.fpsLastCheck));
      this.fpsFrames = 0;
      this.fpsLastCheck = now;
    }

    const dt = Math.min(0.1, (now - this.lastTime) / 1000.0);
    this.lastTime = now;

    if (this.started && (this.sim.state === "playing" || this.sim.state === "paused")) {
      this.accumulator += dt;
      while (this.accumulator >= DT) {
        this.accumulator -= DT;
        const frame =
          this.botEnabled && this.sim.state === "playing" && !this.pendingPause
            ? this._computeBotInput()
            : this._readManualInput();
        const events = this.sim.step(frame);
        if (events.length > 0) this._handleSimEvents(events);
      }
    }

    const elapsedSec = now / 1000.0;
    this.cloudsGroup.rotation.y = elapsedSec * 0.015;
    this._syncEntities(elapsedSec, dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this._loop(t));
  }
}

loadContract().then((contract) => {
  window.gameApp = new AnimeThreeIslandsApp(contract);
});
