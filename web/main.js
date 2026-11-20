import * as THREE from "/web/vendor/three.module.min.js";
import anime from "/web/vendor/anime.es.js";
import { GameSimulationJS, DT, distXZ, round1 } from "/web/sim.js";
import { CozyAudioEngine } from "/web/audio.js";

// --- Standardized Color Palette (TICKET-02 Part 3 & TICKET-03 Part 6 Colorblind Support) ---
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
  CRYSTAL_CYAN: 0x7df9ff,
  CRYSTAL_VIOLET: 0xb86bff,
  SHADE_BODY: 0x120a1a,
  SHADE_RIM: 0x7a3cff,
  SHADE_RIM_CB: 0x00b3ff,
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
      '"Cháu <b>Mây</b> ơi, gió đêm nay làm đèn hao dầu liên tục (1 dầu/giây) và lũ Bóng Mực đang tìm cách hút cạn những ngọn đèn yếu (<b>dầu &lt; 30</b>)! Hãy dùng <b>Quang Tiễn</b> ở góc nhìn thứ nhất (hoặc bấm <b>[V]</b> để xem chuyển động chạy bộ & <b>Lướt Gió [Shift]</b>), châm thêm dầu cho đèn và <b>giữ ít nhất 3/5 đèn sáng tới bình minh</b> nhé!"',
  },
  2: {
    title: "ĐÊM 2 — ĐẢO CAU",
    quote:
      '"Phía trước là <b>Đảo Cau</b> gồm hai hòn đảo nối bằng cầu tre và hai <b>Bục Nhảy</b> cổ ngữ. Đèn đã từng sáng nếu bị tắt chỉ cần <b>5 đom đóm</b> để thắp lại, và mỗi lần thắp đèn sức chứa của cháu sẽ tăng thêm +2 (tối đa 20)! Hãy giữ ít nhất <b>4/6 đèn sáng tới bình minh</b>!"',
  },
  3: {
    title: "ĐÊM 3 — ĐẢO CHUÔNG",
    quote:
      '"Đêm cuối tại <b>Đảo Chuông</b> 3 tầng! Hãy leo theo hai con dốc đá (30° và 150°) lên tầng 1, nhặt các <b>Băng Đạn Ánh Sáng</b> dọc đường và dẫm lên Bục Nhảy để bay lên đỉnh <b>Tháp Chuông</b> tầng 2. Hãy giữ ít nhất <b>5/7 đèn sáng khi bình minh lên</b>!"',
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

// Build a detailed 3D Light Rifle Mesh (Quang Tiễn) with Detachable Magazine & Muzzle Flash
function createLightRifleMesh() {
  const gun = new THREE.Group();

  const recGeo = new THREE.BoxGeometry(0.11, 0.16, 0.62);
  const recMesh = new THREE.Mesh(recGeo, toonMat(0x1b1e2b));
  addAnimeOutline(recMesh, 1.06, PALETTE.GOLD_BORDER);
  gun.add(recMesh);

  const railGeo = new THREE.BoxGeometry(0.07, 0.035, 0.56);
  const railMesh = new THREE.Mesh(railGeo, new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER }));
  railMesh.position.set(0, 0.095, 0.02);
  gun.add(railMesh);

  const sightGeo = new THREE.BoxGeometry(0.08, 0.09, 0.12);
  const sightMesh = new THREE.Mesh(sightGeo, toonMat(0x282d40));
  sightMesh.position.set(0, 0.14, -0.05);
  gun.add(sightMesh);

  const reticleGeo = new THREE.SphereGeometry(0.018, 6, 6);
  const reticleMesh = new THREE.Mesh(reticleGeo, new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
  reticleMesh.position.set(0, 0.15, -0.05);
  gun.add(reticleMesh);

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

  const guardGeo = new THREE.BoxGeometry(0.095, 0.11, 0.34);
  const guardMesh = new THREE.Mesh(guardGeo, toonMat(PALETTE.MAY_SCARF));
  guardMesh.position.set(0, 0.01, 0.42);
  addAnimeOutline(guardMesh, 1.05, PALETTE.GOLD_BORDER);
  gun.add(guardMesh);

  const stockGeo = new THREE.BoxGeometry(0.09, 0.17, 0.32);
  const stockMesh = new THREE.Mesh(stockGeo, toonMat(0x171924));
  stockMesh.position.set(0, -0.03, -0.44);
  gun.add(stockMesh);

  const gripGeo = new THREE.BoxGeometry(0.075, 0.22, 0.1);
  const gripMesh = new THREE.Mesh(gripGeo, toonMat(0x222636));
  gripMesh.position.set(0, -0.16, -0.14);
  gripMesh.rotation.x = -0.28;
  gun.add(gripMesh);

  const magGroup = new THREE.Group();
  const magUpper = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.12), toonMat(0x1e2233));
  addAnimeOutline(magUpper, 1.07, PALETTE.CRYSTAL_CYAN);
  const magGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.082, 0.18, 0.035),
    new THREE.MeshBasicMaterial({ color: PALETTE.GOLD_BORDER })
  );
  magGlow.position.z = 0.045;
  magGroup.add(magUpper, magGlow);
  magGroup.position.set(0, -0.2, 0.12);
  magGroup.rotation.x = 0.22;
  gun.add(magGroup);

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

const SETTINGS_KEY = "dao_den_long_settings_v13";
const LOCAL_LB_KEY = "dao_den_long_leaderboard_v13";

const DEFAULT_KEYBINDS = {
  move_up: "KeyW",
  move_down: "KeyS",
  move_left: "KeyA",
  move_right: "KeyD",
  jump: "Space",
  dash: "ShiftLeft",
  interact: "KeyE",
  pulse: "KeyR",
  pause: "KeyP",
};

const ACTION_LABELS = {
  move_up: "Tiến lên",
  move_down: "Lùi xuống",
  move_left: "Sang trái",
  move_right: "Sang phải",
  jump: "Nhảy",
  dash: "Lướt Gió",
  interact: "Tương tác / Đèn",
  pulse: "Tỏa Sáng",
  pause: "Tạm dừng",
};

function loadSavedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        volume: Math.max(0, Math.min(100, Number(parsed.volume ?? 75))),
        mouseSens: Math.max(20, Math.min(200, Number(parsed.mouseSens ?? 100))),
        colorblind: Boolean(parsed.colorblind ?? false),
        reducedMotion: Boolean(parsed.reducedMotion ?? false),
        largeText: Boolean(parsed.largeText ?? false),
        keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds || {}) },
      };
    }
  } catch (_) {}
  return {
    volume: 75,
    mouseSens: 100,
    colorblind: false,
    reducedMotion: false,
    largeText: false,
    keybinds: { ...DEFAULT_KEYBINDS },
  };
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
    contract_version: "1.3",
    tuning: {
      player_speed: 6.0,
      dash_speed: 14.0,
      dash_duration_s: 0.2,
      dash_cooldown_s: 1.5,
      carry_capacity: 10,
      capacity_max: 20,
      lantern_cost: 10,
      relight_cost: 5,
      fuel_max: 100,
      fuel_decay_per_s: 1.0,
      fuel_per_mote: 10,
      low_fuel_threshold: 30,
      drain_per_s: 5,
      win_ratio: 0.6,
      pickup_radius: 1.0,
      interact_radius: 2.0,
      pulse_cost: 3,
      pulse_radius: 5.0,
      night1_duration_s: 240,
      night2_duration_s: 270,
      night3_duration_s: 300,
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
      score: { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_second_left: 0, per_flame_left: 50 },
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
    this.benchMode = params.get("bench") === "1";
    this.benchSeed = Number(params.get("seed")) || 42;
    this.currentNight = this.benchMode ? 1 : Number(params.get("night")) || 1;
    if (![1, 2, 3].includes(this.currentNight)) this.currentNight = 1;
    this.firstPerson = this.benchMode || params.get("tps") === "1" ? false : true;
    if (params.get("cb") === "1") this.settings.colorblind = true;

    this.wonNightScores = { 1: 0, 2: 0, 3: 0 };
    this.campaignSeed = this.benchMode ? this.benchSeed : 2026 + this.currentNight;
    this.sim = new GameSimulationJS(this.tuning, this.campaignSeed, this.currentNight);
    if (this.benchMode) {
      this.sim.setupBenchmarkScene();
    }

    this.started = false;
    this.botEnabled = false;
    this.listeningKeyAction = null;
    this.captionTimer = null;
    this.lastSpawnedShadeId = null;
    this.shadeSpawnAlertTicks = 0;
    this.camYawDeg = 0;
    this.fpsPitch = -0.05;
    this.camPitch = 0.44;
    this.camDist = 11.5;
    this.lastCountdownSec = -1;
    this.walkCyclePhase = 0;

    this.rifleClipMax = 25;
    this.rifleClip = 25;
    this.rifleReserve = 75;
    this.rifleMagsPicked = 3;
    this.isReloading = false;
    this.lastShotTime = 0;
    this.floorMagazines = [];

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
    this._buildPlayerCharacter();
    this._buildFPSRifleViewmodel();
    this._rebuildNightWorld(this.currentNight);
    this._syncEntities(0, 0.016);
    this._bindEvents();
    this._applySettingsToUI();
    this._updateCameraModeUI();
    this._playIntroAnime();

    if (params.get("bot") === "1") this.toggleBot(true);
    if (this.benchMode || params.get("autostart") === "1") {
      this.started = true;
      document.getElementById("intro-modal").classList.add("hidden");
    }

    this.lastTime = performance.now();
    this.accumulator = 0;
    this.fpsFrames = 0;
    this.fpsLastCheck = performance.now();
    this.currentFps = 60;
    requestAnimationFrame((t) => this._loop(t));
  }

  // Equivalent of Unity's Cursor.lockState = CursorLockMode.Locked via Pointer Lock API
  _lockCursor() {
    try {
      const canvas = this.renderer?.domElement;
      if (canvas && canvas.requestPointerLock && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    } catch (_) {}
  }

  _unlockCursor() {
    try {
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch (_) {}
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

  _buildFPSRifleViewmodel() {
    this.fpsWeaponPivot = new THREE.Group();
    this.fpsRifle = createLightRifleMesh();
    this.fpsRifle.gun.rotation.y = Math.PI;
    this.fpsWeaponPivot.add(this.fpsRifle.gun);

    const armGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.42, 10);
    const armMesh = new THREE.Mesh(armGeo, toonMat(0x231b3d));
    armMesh.rotation.x = Math.PI / 2.4;
    armMesh.position.set(0.03, -0.16, 0.25);
    addAnimeOutline(armMesh, 1.06, PALETTE.GOLD_BORDER);
    this.fpsWeaponPivot.add(armMesh);

    this.fpsBasePos = { x: 0.34, y: -0.27, z: -0.56 };
    this.fpsRecoilOffset = { z: 0, pitch: 0, roll: 0 };
    this.fpsWeaponPivot.position.set(this.fpsBasePos.x, this.fpsBasePos.y, this.fpsBasePos.z);
    this.camera.add(this.fpsWeaponPivot);
  }

  _buildPlayerCharacter() {
    // Articulated 3D Anime Character Rig with full joints for Run Cycle & Wind Dash
    this.mayGroup = new THREE.Group();
    this.charRig = new THREE.Group();
    this.mayGroup.add(this.charRig);

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

    this.leftCoatTail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.06), toonMat(PALETTE.MAY_ROBE));
    this.leftCoatTail.position.set(-0.16, -0.22, -0.18);
    addAnimeOutline(this.leftCoatTail, 1.06, PALETTE.MAY_SCARF);
    this.torsoPivot.add(this.leftCoatTail);

    this.rightCoatTail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.06), toonMat(PALETTE.MAY_ROBE));
    this.rightCoatTail.position.set(0.16, -0.22, -0.18);
    addAnimeOutline(this.rightCoatTail, 1.06, PALETTE.MAY_SCARF);
    this.torsoPivot.add(this.rightCoatTail);

    const scarfMesh = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), toonMat(PALETTE.MAY_SCARF));
    scarfMesh.rotation.x = Math.PI / 2;
    scarfMesh.position.y = 0.48;
    this.torsoPivot.add(scarfMesh);

    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 0.68;
    this.torsoPivot.add(this.headPivot);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), toonMat(0xffe4d0));
    addAnimeOutline(headMesh, 1.07);
    this.headPivot.add(headMesh);

    const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b9d });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.09, 0.0, 0.23);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.09, 0.0, 0.23);
    this.headPivot.add(eyeL, eyeR);

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

    const crownMesh = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.28, 16), toonMat(PALETTE.SAND));
    crownMesh.position.set(0, 0.3, -0.02);
    addAnimeOutline(crownMesh, 1.05, PALETTE.GOLD_BORDER);
    this.headPivot.add(crownMesh);

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

    this.tpsRifle = createLightRifleMesh();
    this.tpsRifle.gun.scale.setScalar(0.85);
    this.tpsRifle.gun.position.set(0.0, -0.35, 0.28);
    this.rightArmPivot.add(this.tpsRifle.gun);
    this.torsoPivot.add(this.rightArmPivot);

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

    const windRingGeo = new THREE.TorusGeometry(0.95, 0.045, 8, 28);
    this.dashWindRingMat = new THREE.MeshBasicMaterial({
      color: PALETTE.CRYSTAL_CYAN,
      transparent: true,
      opacity: 0.0,
    });
    this.dashWindRing = new THREE.Mesh(windRingGeo, this.dashWindRingMat);
    this.dashWindRing.rotation.x = Math.PI / 2;
    this.dashWindRing.position.y = 0.9;
    this.mayGroup.add(this.dashWindRing);

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
      this.walkCyclePhase += dt * speedXZ * 2.4;
      const swing = Math.sin(this.walkCyclePhase);
      const counterSwing = Math.cos(this.walkCyclePhase);

      this.torsoPivot.rotation.x = 0.16;
      this.torsoPivot.position.y = 0.88 + Math.abs(swing) * 0.08;
      this.leftLegPivot.rotation.x = swing * 0.82;
      this.rightLegPivot.rotation.x = -swing * 0.82;
      this.leftArmPivot.rotation.x = -swing * 0.65;
      this.rightArmPivot.rotation.x = -0.65 + counterSwing * 0.15;

      this.leftCoatTail.rotation.x = 0.28 + Math.abs(swing) * 0.25;
      this.rightCoatTail.rotation.x = 0.28 + Math.abs(counterSwing) * 0.25;
      this.leftHairTail.rotation.x = Math.PI * 0.8 + Math.abs(swing) * 0.22;
      this.rightHairTail.rotation.x = Math.PI * 0.8 + Math.abs(counterSwing) * 0.22;
      this.dashWindRingMat.opacity = 0.0;
    } else {
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
      this.fpsWeaponPivot.rotation.set(this.fpsRecoilOffset.pitch, 0, dashRoll + this.fpsRecoilOffset.roll);
    }
  }

  _triggerWindDashAnim() {
    anime.remove("#wind-dash-fx");
    anime({
      targets: "#wind-dash-fx",
      opacity: [0.95, 0],
      duration: 380,
      easing: "easeOutQuad",
    });

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

    const p = this.sim.player;
    const ghostGeo = new THREE.ConeGeometry(0.45, 1.45, 10);
    const ghostMat = new THREE.MeshBasicMaterial({
      color: PALETTE.CRYSTAL_CYAN,
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

  // --- Light Rifle Shooting, Reloading & Floor Ammo Magazines ---

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

      const padRing = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 24),
        new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide })
      );
      padRing.rotation.x = -Math.PI / 2;
      padRing.position.y = 0.05;
      group.add(padRing);

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
        this.rifleReserve += 25;
        this.rifleMagsPicked += 1;
        this.audio.playAmmoPickup();
        this._updateRifleHUD();
      }
    }
  }

  _shootRifle() {
    if (!this.started || this.sim.state !== "playing" || this.isReloading) return;
    const now = performance.now();
    if (now - this.lastShotTime < 105) return;

    if (this.rifleClip <= 0) {
      this._reloadRifle();
      return;
    }

    this.lastShotTime = now;
    this.rifleClip -= 1;
    this.audio.playRifleShot();
    this._updateRifleHUD();

    this.fpsRifle.flashMat.opacity = 1.0;
    anime.remove(this.fpsRifle.flashMat);
    anime({
      targets: this.fpsRifle.flashMat,
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

    const p = this.sim.player;
    const yawRad = (this.camYawDeg * Math.PI) / 180.0;
    const dirX = Math.sin(yawRad);
    const dirZ = Math.cos(yawRad);
    const startPos = new THREE.Vector3(p.pos[0] + dirX * 0.6, p.pos[1] + 1.35, p.pos[2] + dirZ * 0.6);
    const endPos = new THREE.Vector3(p.pos[0] + dirX * 32.0, p.pos[1] + 1.35, p.pos[2] + dirZ * 32.0);

    let hitTarget = null;
    let hitIsDrifter = false;
    let bestDist = 32.0;

    for (const s of this.sim.shades) {
      if (s._respawnTicks > 0) continue;
      const toX = s.pos[0] - p.pos[0];
      const toZ = s.pos[2] - p.pos[2];
      const proj = toX * dirX + toZ * dirZ;
      if (proj > 0 && proj < bestDist) {
        const perp = Math.abs(toX * dirZ - toZ * dirX);
        if (perp <= 1.35 && Math.abs(s.pos[1] - p.pos[1]) <= 3.2) {
          bestDist = proj;
          hitTarget = s;
          hitIsDrifter = false;
        }
      }
    }

    for (const d of this.sim.drifters) {
      if (d.state === "removed" || d._respawnTicks > 0) continue;
      const toX = d.pos[0] - p.pos[0];
      const toZ = d.pos[2] - p.pos[2];
      const proj = toX * dirX + toZ * dirZ;
      if (proj > 0 && proj < bestDist) {
        const perp = Math.abs(toX * dirZ - toZ * dirX);
        if (perp <= 1.55 && Math.abs(d.pos[1] - p.pos[1]) <= 4.5) {
          bestDist = proj;
          hitTarget = d;
          hitIsDrifter = true;
        }
      }
    }

    if (hitTarget) {
      const t = hitTarget;
      if (typeof t._combatHp !== "number") t._combatHp = 3;
      t._combatHp = Math.max(0, t._combatHp - 1);

      const hitY = hitIsDrifter ? t.pos[1] + 1.25 : t.pos[1] + 0.8;
      endPos.set(t.pos[0], hitY, t.pos[2]);

      if (!hitIsDrifter) {
        const s = t;
        s.state = "stunned";
        s.state_ticks_left = Math.max(s.state_ticks_left || 0, 75);
        s.drain_ticks = 0;
        s.pos[0] += dirX * 1.35;
        s.pos[2] += dirZ * 1.35;
        this.sim._enforceSafeZonesForShade(s);

        if (s._combatHp <= 0) {
          this._spawnShatterExplosion(s.pos[0], s.pos[1] + 0.85, s.pos[2], false);
          s._respawnTicks = 600; // Disappear for 10 seconds (600 ticks at 60Hz)
          s.drain_ticks = 0;
          const sEntry = this.shadeMeshes.get(s.id);
          if (sEntry) {
            sEntry.group.visible = false;
          }
          this._showA11yCaption(`💥 Bóng Mực ${s.id} vỡ tan! Biến mất 10 giây!`, 2400);
        }
      } else {
        const d = t;
        d.pos[0] += dirX * 1.4;
        d.pos[2] += dirZ * 1.4;
        if (d._combatHp <= 0) {
          this._spawnShatterExplosion(d.pos[0], d.pos[1] + 1.25, d.pos[2], true);
          const dropAmt = d.stolen || d.carrying || 0;
          if (dropAmt > 0 && typeof this.sim._spawnDroppedMotes === "function") {
            this.sim._spawnDroppedMotes(d.pos, dropAmt, false);
            d.stolen = 0;
            d.carrying = 0;
          }
          d._respawnTicks = 600; // Disappear for 10 seconds (600 ticks at 60Hz)
          const dEntry = this.drifterMeshes.get(d.id);
          if (dEntry) {
            dEntry.group.visible = false;
          }
          this._showA11yCaption(`💥 Ngọn Gió Lạc ${d.id} vỡ tan! Biến mất 10 giây!`, 2400);
        }
      }

      anime.remove("#fps-hitmarker");
      anime({
        targets: "#fps-hitmarker",
        opacity: [1, 0],
        scale: [1.35, 1.0],
        duration: 180,
        easing: "easeOutQuad",
      });
    }

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

    if (this.rifleClip === 0 && this.rifleReserve > 0) {
      this._reloadRifle();
    }
  }

  _spawnShatterExplosion(wx, wy, wz, isDrifter = false) {
    if (this.audio && typeof this.audio.playShatter === "function") {
      this.audio.playShatter();
    }
    const shardCount = isDrifter ? 18 : 16;
    const primaryHex = isDrifter
      ? PALETTE.CRYSTAL_CYAN
      : this.settings.colorblind
        ? PALETTE.SHADE_RIM_CB
        : PALETTE.SHADE_RIM;
    const secondaryHex = isDrifter ? PALETTE.GOLD_BORDER : PALETTE.SHADE_BODY;

    // Expanding shockwave ring
    const ringGeo = new THREE.TorusGeometry(0.35, 0.06, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: primaryHex,
      transparent: true,
      opacity: 0.95,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(wx, wy, wz);
    ringMesh.rotation.x = Math.PI / 2;
    this.scene.add(ringMesh);
    anime({
      targets: ringMesh.scale,
      x: [0.5, 4.2],
      y: [0.5, 4.2],
      z: [0.5, 4.2],
      duration: 460,
      easing: "easeOutCubic",
    });
    anime({
      targets: ringMat,
      opacity: [0.95, 0],
      duration: 460,
      easing: "linear",
      complete: () => {
        this.scene.remove(ringMesh);
        ringGeo.dispose();
        ringMat.dispose();
      },
    });

    // 3D Crystal / Ink Shatter Shards
    for (let i = 0; i < shardCount; i++) {
      const shardGeo = new THREE.OctahedronGeometry(0.14 + Math.random() * 0.12, 0);
      const shardMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? primaryHex : secondaryHex,
        transparent: true,
        opacity: 1.0,
      });
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.set(wx, wy, wz);
      this.scene.add(shard);

      const angle = (2 * Math.PI * i) / shardCount + (Math.random() - 0.5) * 0.35;
      const dist = 1.4 + Math.random() * 1.9;
      const targetX = wx + Math.cos(angle) * dist;
      const targetZ = wz + Math.sin(angle) * dist;
      const targetY = wy + (Math.random() - 0.25) * 1.8;

      anime({
        targets: shard.position,
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 540,
        easing: "easeOutCubic",
      });
      anime({
        targets: shard.rotation,
        x: Math.random() * Math.PI * 4,
        y: Math.random() * Math.PI * 4,
        z: Math.random() * Math.PI * 4,
        duration: 540,
        easing: "linear",
      });
      anime({
        targets: shard.scale,
        x: [1.1, 0.01],
        y: [1.1, 0.01],
        z: [1.1, 0.01],
        duration: 540,
        easing: "easeInQuad",
        complete: () => {
          this.scene.remove(shard);
          shardGeo.dispose();
          shardMat.dispose();
        },
      });
    }
  }

  _reloadRifle() {
    if (this.isReloading || this.rifleClip >= this.rifleClipMax || this.rifleReserve <= 0) return;
    this.isReloading = true;
    this.audio.playReload();
    this._updateRifleHUD();

    const mag = this.fpsRifle.magGroup;
    const gun = this.fpsRifle.gun;

    // Eject discarded 3D magazine mesh that falls & tumbles
    const droppedMagGeo = new THREE.BoxGeometry(0.05, 0.22, 0.09);
    const droppedMagMat = new THREE.MeshBasicMaterial({
      color: PALETTE.CRYSTAL_CYAN,
      transparent: true,
      opacity: 0.9,
    });
    const droppedMag = new THREE.Mesh(droppedMagGeo, droppedMagMat);
    const p = this.sim.player;
    droppedMag.position.set(p.pos[0], p.pos[1] + 1.15, p.pos[2]);
    this.scene.add(droppedMag);
    anime({
      targets: droppedMag.position,
      y: p.pos[1] + 0.08,
      duration: 420,
      easing: "easeInQuad",
    });
    anime({
      targets: droppedMag.rotation,
      x: Math.PI * 1.5,
      z: Math.PI * 0.8,
      duration: 420,
      easing: "linear",
    });
    anime({
      targets: droppedMagMat,
      opacity: [0.9, 0],
      duration: 460,
      easing: "linear",
      complete: () => {
        this.scene.remove(droppedMag);
        droppedMagGeo.dispose();
        droppedMagMat.dispose();
      },
    });

    // Animate 3rd-person character arm during reload
    if (this.rightArmPivot) {
      anime({
        targets: this.rightArmPivot.rotation,
        x: [-0.55, -1.15, -0.55],
        z: [0, -0.35, 0],
        duration: 680,
        easing: "easeInOutQuad",
      });
    }

    // 3-Stage FPS Rifle Tilt + Magazine Detach + Fresh Glowing Magazine Slap-In
    anime({
      targets: gun.rotation,
      z: [0, 0.38, 0.38, -0.1, 0],
      x: [0, 0.22, 0.22, -0.08, 0],
      duration: 700,
      easing: "easeInOutQuad",
    });

    anime
      .timeline({
        complete: () => {
          const needed = this.rifleClipMax - this.rifleClip;
          const take = Math.min(needed, this.rifleReserve);
          this.rifleClip += take;
          this.rifleReserve -= take;
          this.isReloading = false;
          this._updateRifleHUD();
        },
      })
      .add({
        targets: mag.position,
        y: [-0.2, -0.62],
        z: [-0.05, -0.16],
        duration: 240,
        easing: "easeInQuad",
      })
      .add({
        targets: mag.position,
        y: [-0.62, -0.2],
        z: [-0.16, -0.05],
        duration: 300,
        delay: 140,
        easing: "easeOutBack",
      });
  }

  _updateRifleHUD() {
    document.getElementById("rifle-clip").textContent = this.rifleClip;
    document.getElementById("rifle-reserve").textContent = this.rifleReserve;
    document.getElementById("rifle-mags-picked").textContent = this.rifleMagsPicked;
    const badge = document.getElementById("rifle-state-badge");
    if (this.isReloading) {
      badge.textContent = "ĐANG THAY BĂNG ĐẠN...";
      badge.style.color = "#FFB347";
    } else if (this.rifleClip === 0 && this.rifleReserve === 0) {
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
      const extrude1 = new THREE.ExtrudeGeometry(shape1, { depth: 0.48, bevelEnabled: false, curveSegments: 36 });
      const tier1Mesh = new THREE.Mesh(extrude1, toonMat(PALETTE.GRASS));
      tier1Mesh.rotation.x = Math.PI / 2;
      tier1Mesh.position.y = 3.0;
      this.islandRoot.add(tier1Mesh);

      for (const deg of [25, 65, 115, 155]) {
        const rad = (deg * Math.PI) / 180.0;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, 2.6, 10), toonMat(PALETTE.WOOD));
        col.position.set(18.0 * Math.cos(rad), 1.3, 18.0 * Math.sin(rad));
        addAnimeOutline(col, 1.05);
        this.islandRoot.add(col);
      }

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

    if (!this.benchMode) {
      this.islandRoot.add(this._buildOngDangNPC());
      this._spawnFloorMagazinesForNight(night);
    }

    // Build HUD fuel chips for lanterns L1..Ln
    const fuelRow = document.getElementById("lantern-fuel-row");
    fuelRow.innerHTML = "";
    for (const l of this.sim.lanterns) {
      const chip = document.createElement("div");
      chip.className = "lf-chip";
      chip.id = `lf-chip-${l.id}`;
      chip.innerHTML = `<span>${l.id}</span><div class="lf-bar-bg"><div class="lf-bar-fill" id="lf-fill-${l.id}"></div></div>`;
      fuelRow.appendChild(chip);
    }

    const names = {
      1: "ĐÊM 1 · ĐẢO BẾN · MÂY",
      2: "ĐÊM 2 · ĐẢO CAU · MÂY",
      3: "ĐÊM 3 · ĐẢO CHUÔNG · MÂY",
    };
    document.getElementById("hud-night-label").textContent = names[night] || "ĐẢO ĐÈN LỒNG";
    [1, 2, 3].forEach((n) => {
      const btn = document.getElementById(`btn-night-${n}`);
      if (btn) btn.classList.toggle("active", n === night);
    });
  }

  _createLanternMesh(lData) {
    // TICKET-03 Part 1 & Part 6:
    // - 3D Fuel Bar above lantern
    // - Unlit lanterns squashed 20% vertically (core.scale.y = 0.8) and have torn paper marks
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

    // Torn Paper Scar Stripes (visible when unlit for non-color distinction!)
    const tearGroup = new THREE.Group();
    const tear1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.08, 0.85),
      new THREE.MeshBasicMaterial({ color: 0x120a1a })
    );
    tear1.rotation.z = 0.42;
    const tear2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.07, 0.85),
      new THREE.MeshBasicMaterial({ color: 0x120a1a })
    );
    tear2.rotation.z = -0.35;
    tear2.position.y = -0.2;
    tearGroup.add(tear1, tear2);
    tearGroup.position.y = 3.2;
    group.add(tearGroup);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.18, 0.72, 6), toonMat(PALETTE.WOOD));
    roof.position.y = 4.1;
    addAnimeOutline(roof, 1.06);
    group.add(roof);

    // 3D Floating Fuel Bar above Lantern Roof
    const fuelBarGroup = new THREE.Group();
    fuelBarGroup.position.y = 4.85;
    const bgBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.44, 0.18, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x0e1430 })
    );
    const fuelFillMat = new THREE.MeshBasicMaterial({ color: PALETTE.LANTERN_LIT });
    const fuelFill = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.12, 0.08), fuelFillMat);
    fuelBarGroup.add(bgBar, fuelFill);
    fuelBarGroup.visible = false;
    group.add(fuelBarGroup);

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
    return { group, core, coreMat, roof, tearGroup, fuelBarGroup, fuelFill, fuelFillMat, ringMat, ringMesh, light };
  }

  _createMoteMesh(mData) {
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: mData.kind === "dropped" ? PALETTE.LANTERN_LIT : PALETTE.CRYSTAL_CYAN })
    );
    addAnimeOutline(crystal, 1.18, PALETTE.CRYSTAL_VIOLET);

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
    const rimHex = this.settings.colorblind ? PALETTE.SHADE_RIM_CB : PALETTE.SHADE_RIM;
    const group = new THREE.Group();
    const bodyMat = toonMat(PALETTE.SHADE_BODY);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 14), bodyMat);
    body.position.y = 0.72;
    body.scale.set(1, 1.18, 1);
    const outline = addAnimeOutline(body, 1.1, rimHex);
    group.add(body);

    const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: rimHex });
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

    // 3D Floating HP Bar above Shade
    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.y = 1.95;
    const hpBg = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.12, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x0e1430 })
    );
    const hpFillMat = new THREE.MeshBasicMaterial({ color: rimHex });
    const hpFill = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.06), hpFillMat);
    hpBarGroup.add(hpBg, hpFill);
    group.add(hpBarGroup);

    group.position.set(sData.pos[0], sData.pos[1], sData.pos[2]);
    this.scene.add(group);
    return { group, body, bodyMat, eyeMat, outlineMat: outline.material, stunRing, hpBarGroup, hpFill, hpFillMat };
  }

  _createDrifterMesh(dData) {
    const group = new THREE.Group();
    const silkGeo = new THREE.TorusKnotGeometry(0.45, 0.11, 32, 8, 2, 3);
    const silkMat = toonMat(PALETTE.DRIFTER, { transparent: true, opacity: 0.9 });
    const silk = new THREE.Mesh(silkGeo, silkMat);
    silk.position.y = 1.25;
    addAnimeOutline(silk, 1.07, PALETTE.GOLD_BORDER);
    group.add(silk);

    // 3D Floating HP Bar above Drifter (Gió Lạc)
    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.y = 2.15;
    const hpBg = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.12, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x0e1430 })
    );
    const hpFillMat = new THREE.MeshBasicMaterial({ color: PALETTE.CRYSTAL_CYAN });
    const hpFill = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.06), hpFillMat);
    hpBarGroup.add(hpBg, hpFill);
    group.add(hpBarGroup);

    group.position.set(dData.pos[0], dData.pos[1], dData.pos[2]);
    this.scene.add(group);
    return { group, silk, silkMat, hpBarGroup, hpFill, hpFillMat };
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

    this._animateCharacterRunAndDash(dt, elapsedSec);

    if (this.sim.charm_ticks > 0) {
      this.activeCharmMesh.visible = true;
      this.activeCharmMesh.position.set(Math.cos(elapsedSec * 6) * 0.85, 1.25, Math.sin(elapsedSec * 6) * 0.85);
      this.activeCharmMesh.rotation.y = elapsedSec * 4;
    } else {
      this.activeCharmMesh.visible = false;
    }

    const carryRatio = p.carried / Math.max(1, p.capacity);
    this.mayLight.intensity = 1.8 + carryRatio * 3.0;

    // 1 Hz slow blink wave for low-fuel lanterns (fuel < 30)
    const blink1Hz = 0.5 + 0.5 * Math.sin(elapsedSec * 2 * Math.PI);

    let litCount = 0;
    for (const l of this.sim.lanterns) {
      let entry = this.lanternMeshes.get(l.id);
      if (!entry) {
        entry = this._createLanternMesh(l);
        this.lanternMeshes.set(l.id, entry);
      }
      entry.group.position.set(l.pos[0], l.pos[1], l.pos[2]);

      const fuelVal = l.lit ? round1(l.fuel_ticks / 60.0) : 0;
      const isLowFuel = l.lit && l.fuel_ticks < 1800;

      if (l.lit) {
        litCount++;
        // Full height (not squashed), no tear marks
        entry.core.scale.set(1, 1, 1);
        entry.roof.position.y = 4.1;
        entry.tearGroup.visible = false;

        entry.fuelBarGroup.visible = true;
        entry.fuelBarGroup.lookAt(this.camera.position);
        const ratio = Math.max(0.02, fuelVal / 100.0);
        entry.fuelFill.scale.x = ratio;
        entry.fuelFill.position.x = -0.69 * (1 - ratio);

        if (isLowFuel) {
          // 1 Hz slow blink & lose safe zone
          const warnHex = this.settings.colorblind ? 0xffffff : PALETTE.UI_DANGER;
          entry.fuelFillMat.color.setHex(warnHex);
          entry.coreMat.color.setHex(PALETTE.LANTERN_LIT);
          entry.coreMat.emissive.setHex(warnHex);
          entry.coreMat.emissiveIntensity = 0.35 + 1.4 * blink1Hz;
          entry.ringMat.color.setHex(warnHex);
          entry.ringMat.opacity = 0.12 * blink1Hz;
          entry.light.visible = true;
          entry.light.intensity = 1.2 + 3.0 * blink1Hz;
        } else {
          entry.fuelFillMat.color.setHex(PALETTE.LANTERN_LIT);
          entry.coreMat.color.setHex(PALETTE.LANTERN_CORE);
          entry.coreMat.emissive.setHex(PALETTE.LANTERN_LIT);
          entry.coreMat.emissiveIntensity = 1.6;
          entry.ringMat.color.setHex(PALETTE.LANTERN_LIT);
          entry.ringMat.opacity = 0.6;
          entry.light.visible = true;
          entry.light.intensity = 4.5;
        }
      } else {
        // TICKET-03 Part 6: Unlit lantern is squashed 20% vertically & shows torn paper marks!
        entry.core.scale.set(1.06, 0.8, 1.06);
        entry.roof.position.y = 3.88;
        entry.tearGroup.visible = true;
        entry.fuelBarGroup.visible = false;

        entry.coreMat.color.setHex(PALETTE.LANTERN_OFF);
        entry.coreMat.emissive.setHex(PALETTE.LANTERN_OFF);
        entry.coreMat.emissiveIntensity = 0.15;
        entry.ringMat.color.setHex(PALETTE.LANTERN_OFF);
        entry.ringMat.opacity = 0.18;
        entry.light.intensity = 0;
        entry.light.visible = false;
      }

      // Update HUD Fuel Chip
      const chip = document.getElementById(`lf-chip-${l.id}`);
      const fill = document.getElementById(`lf-fill-${l.id}`);
      if (chip && fill) {
        fill.style.width = `${fuelVal}%`;
        chip.classList.toggle("low-fuel", isLowFuel);
      }
    }

    const totalL = Math.max(1, this.sim.lanterns.length);
    const progress = litCount / totalL;
    this.ambientLight.intensity = 0.15 + 0.55 * progress;
    this.scene.fog.density = 0.02 - progress * 0.011;

    // Sync Motes
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

    // Sync Shades (with Colorblind #00B3FF support & drain visual)
    const rimHex = this.settings.colorblind ? PALETTE.SHADE_RIM_CB : PALETTE.SHADE_RIM;
    const activeShadeIds = new Set();
    for (const s of this.sim.shades) {
      activeShadeIds.add(s.id);
      let entry = this.shadeMeshes.get(s.id);
      if (!entry) {
        entry = this._createShadeMesh(s);
        this.shadeMeshes.set(s.id, entry);
      }
      if (s._respawnTicks > 0) {
        entry.group.visible = false;
        continue;
      }
      entry.group.visible = true;
      entry.group.position.set(s.pos[0], s.pos[1], s.pos[2]);
      entry.eyeMat.color.setHex(rimHex);
      entry.outlineMat.color.setHex(rimHex);
      if (entry.hpBarGroup) {
        entry.hpBarGroup.lookAt(this.camera.position);
        const hpRatio = Math.max(0.05, (typeof s._combatHp === "number" ? s._combatHp : 3) / 3.0);
        entry.hpFill.scale.x = hpRatio;
        entry.hpFill.position.x = -0.46 * (1 - hpRatio);
        entry.hpFillMat.color.setHex(rimHex);
      }
      if (s.state === "stunned") {
        entry.stunRing.visible = true;
        entry.stunRing.rotation.y = elapsedSec * 5;
        entry.bodyMat.color.setHex(PALETTE.SHADE_STUN);
      } else if (s.state === "drain") {
        entry.stunRing.visible = false;
        entry.bodyMat.color.setHex(0x4a154b);
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
      if (d._respawnTicks > 0) {
        entry.group.visible = false;
        continue;
      }
      entry.group.visible = true;
      entry.group.position.set(d.pos[0], d.pos[1], d.pos[2]);
      entry.silk.rotation.y = elapsedSec * 3.5;
      if (entry.hpBarGroup) {
        entry.hpBarGroup.lookAt(this.camera.position);
        const hpRatio = Math.max(0.05, (typeof d._combatHp === "number" ? d._combatHp : 3) / 3.0);
        entry.hpFill.scale.x = hpRatio;
        entry.hpFill.position.x = -0.46 * (1 - hpRatio);
      }
    }
    for (const [id, entry] of this.drifterMeshes.entries()) {
      if (!activeDrifterIds.has(id)) {
        this.scene.remove(entry.group);
        this.drifterMeshes.delete(id);
      }
    }

    for (const c of this.sim.charms) {
      let entry = this.charmMeshes.get(c.id);
      if (!entry) {
        entry = this._createCharmMesh(c);
        this.charmMeshes.set(c.id, entry);
      }
      entry.group.visible = c.available;
      entry.card.rotation.y = elapsedSec * 2.5;
    }

    if (!this.benchMode) {
      this._updateFloorMagazines(dt, elapsedSec);
    }

    const yawRad = (this.camYawDeg * Math.PI) / 180.0;
    if (this.benchMode) {
      // TICKET-04 Section 1: Camera orbits around (0,0,0), radius 30m, Y=15m, starting at 0 deg (30,15,0),
      // counter-clockwise when viewed from above, 15s per revolution.
      const theta = (2.0 * Math.PI * elapsedSec) / 15.0;
      this.camera.position.set(30.0 * Math.cos(theta), 15.0, -30.0 * Math.sin(theta));
      this.camera.lookAt(0, 0, 0);
      if (this.fpsRifle && this.fpsRifle.gun) this.fpsRifle.gun.visible = false;
    } else if (this.firstPerson) {
      const speedXZ = Math.hypot(p.vel[0], p.vel[2]);
      const headBob = !this.settings.reducedMotion && speedXZ > 0.25 ? Math.sin(this.walkCyclePhase) * 0.055 : 0;
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
    const cap = p.capacity;

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
    const isDanger = rem <= 30 && this.sim.state === "playing";
    const warnPrefix = isDanger && this.settings.colorblind ? "⚠ " : "";
    timerEl.textContent = `${warnPrefix}${mm}:${ss}`;
    timerEl.classList.toggle("danger", isDanger);
    if (rem <= 10 && rem > 0 && rem !== this.lastCountdownSec && this.sim.state === "playing") {
      this.lastCountdownSec = rem;
      this.audio.playCountdownTick();
      this._showA11yCaption(`⏰ Phụ đề: Còn ${rem} giây cuối cùng tới bình minh!`);
    }

    const lowFuelLanterns = this.sim.lanterns.filter((l) => l.lit && l.fuel_ticks < 1800);
    if (lowFuelLanterns.length > 0 && !this.captionTimer && this.sim.state === "playing") {
      const ids = lowFuelLanterns.map((l) => l.id).join(", ");
      const captionEl = document.getElementById("a11y-caption-box");
      if (captionEl) {
        captionEl.textContent = `🏮 Phụ đề: Đèn ${ids} có dầu < 30 (Mất vùng an toàn)!`;
        captionEl.classList.remove("hidden");
      }
    } else if (lowFuelLanterns.length === 0 && !this.captionTimer) {
      const captionEl = document.getElementById("a11y-caption-box");
      if (captionEl) captionEl.classList.add("hidden");
    }

    this._updateShadeEdgeArrow();

    document.getElementById("lanterns-text").textContent = `${litCount}/${this.sim.lanterns.length}`;
    document.getElementById("score-display").textContent = this.sim.score;
    const totalCampaign =
      (this.currentNight === 1 ? this.sim.score : this.wonNightScores[1]) +
      (this.currentNight === 2 ? this.sim.score : this.wonNightScores[2]) +
      (this.currentNight === 3 ? this.sim.score : this.wonNightScores[3]);
    document.getElementById("total-score-display").textContent = totalCampaign;

    // Dynamic Capacity Firefly Bar (10 + 2 * successful_lights, up to 20)
    document.getElementById("carried-text").textContent = `${p.carried}/${cap}`;
    const pillsContainer = document.getElementById("motes-pills");
    while (pillsContainer.children.length < cap) {
      const div = document.createElement("div");
      div.className = "mote-slot";
      pillsContainer.appendChild(div);
    }
    while (pillsContainer.children.length > cap) {
      pillsContainer.removeChild(pillsContainer.lastChild);
    }
    Array.from(pillsContainer.children).forEach((el, idx) => {
      el.classList.toggle("filled", idx < p.carried);
    });

    const interactR = Number(this.tuning.interact_radius || 2.0);
    const nearLantern = this.sim.lanterns
      .filter(
        (l) =>
          (!l.lit || (l.lit && l.fuel_ticks < 6000)) &&
          distXZ(p.pos, l.pos) <= interactR + 0.25 &&
          Math.abs(p.pos[1] - l.pos[1]) <= 2.0
      )
      .sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos))[0];

    const promptEl = document.getElementById("context-prompt");
    if (nearLantern) {
      if (!nearLantern.lit) {
        const req = nearLantern.ever_lit ? 5 : 10;
        promptEl.textContent = `E — Nạp ánh sáng (${nearLantern.deposited}/${req})`;
      } else {
        const fuelVal = round1(nearLantern.fuel_ticks / 60.0);
        promptEl.textContent = `E — Châm dầu đèn ${nearLantern.id} (Dầu: ${fuelVal}/100)`;
      }
      promptEl.classList.add("visible");
    } else if (!this.benchMode && distXZ(p.pos, [-2.5, 0, 2.2]) <= 3.5 && Math.abs(p.pos[1]) <= 2.0) {
      promptEl.textContent = "🏮 Ông Đăng (NPC Lão Giữ Đèn): Hãy giữ ≥60% đèn sáng tới bình minh!";
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
    const needy = this.sim.lanterns.filter((l) => !l.lit || l.fuel_ticks < 1800);
    if (needy.length === 0) {
      arrowEl.classList.add("hidden");
      return;
    }
    const p = this.sim.player;
    needy.sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos));
    const target = needy[0];
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

  _showA11yCaption(text, durationMs = 2600) {
    const captionEl = document.getElementById("a11y-caption-box");
    if (!captionEl) return;
    captionEl.textContent = text;
    captionEl.classList.remove("hidden");
    if (this.captionTimer) clearTimeout(this.captionTimer);
    this.captionTimer = setTimeout(() => {
      this.captionTimer = null;
      captionEl.classList.add("hidden");
    }, durationMs);
  }

  _updateShadeEdgeArrow() {
    const edgeEl = document.getElementById("shade-edge-arrow");
    if (!edgeEl) return;
    if (this.benchMode || this.sim.shades.length === 0) {
      edgeEl.classList.add("hidden");
      return;
    }
    const p = this.sim.player;
    let targetShade = null;
    if (this.lastSpawnedShadeId && this.shadeSpawnAlertTicks > 0) {
      this.shadeSpawnAlertTicks--;
      targetShade = this.sim.shades.find((s) => s.id === this.lastSpawnedShadeId && !(s._respawnTicks > 0));
    }
    if (!targetShade) {
      const dangerous = this.sim.shades
        .filter((s) => !(s._respawnTicks > 0) && (s.state === "chase" || s.state === "drain" || distXZ(p.pos, s.pos) <= 15.0))
        .sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos));
      targetShade = dangerous[0] || null;
    }
    if (!targetShade) {
      edgeEl.classList.add("hidden");
      return;
    }

    const worldPos = new THREE.Vector3(targetShade.pos[0], targetShade.pos[1] + 1.0, targetShade.pos[2]);
    const ndc = worldPos.clone().project(this.camera);
    const isBehind = ndc.z > 1.0;
    const nx = isBehind ? -ndc.x : ndc.x;
    const ny = isBehind ? -ndc.y : ndc.y;
    const angle = Math.atan2(nx, ny);
    const margin = 44;
    const halfW = window.innerWidth / 2 - margin;
    const halfH = window.innerHeight / 2 - margin;
    const radius = Math.min(halfW, halfH);
    const sx = window.innerWidth / 2 + Math.sin(angle) * radius;
    const sy = window.innerHeight / 2 - Math.cos(angle) * radius;
    edgeEl.classList.remove("hidden");
    edgeEl.style.left = `${sx}px`;
    edgeEl.style.top = `${sy}px`;
    edgeEl.style.transform = `rotate(${(angle * 180) / Math.PI}deg)`;
  }

  _handleSimEvents(events) {
    for (const ev of events) {
      if (ev.name === "mote_picked") {
        this.audio.playMotePickup(ev.data.carried);
      } else if (ev.name === "charm_picked") {
        this.audio.playCharmPickup();
        this._showAnimeBanner("BÙA GIÓ KHAI MỞ!", "TỐC ĐỘ 7.2 M/S · LƯỚT GIÓ KHÔNG HỒI CHIÊU");
      } else if (ev.name === "deposit" || ev.name === "refuel") {
        this.audio.playDeposit();
      } else if (ev.name === "lantern_lit") {
        this.audio.playLanternLit();
        const tag = ev.data.relight ? "THẮP LẠI THÀNH CÔNG (+40Đ)" : "KHAI SÁNG LẦN ĐẦU (+100Đ)";
        this._showAnimeBanner(`ĐÈN LỒNG ${ev.data.lantern_id} BỪNG SÁNG!`, `${tag} · SỨC CHỨA: ${this.sim.player.capacity}`);
      } else if (ev.name === "lantern_out") {
        this.audio.playHit();
        const prefix = this.settings.colorblind ? "⚠ " : "";
        this._showAnimeBanner(`${prefix}ĐÈN LỒNG ${ev.data.lantern_id} ĐÃ CẠN DẦU!`, "CHỈ CẦN 5 ĐOM ĐÓM ĐỂ THẮP LẠI");
      } else if (ev.name === "pulse") {
        this.audio.playPulse();
        if (!this.settings.reducedMotion) {
          anime({
            targets: "#screen-pulse-ring",
            scale: [0.2, 4.2],
            opacity: [0.9, 0],
            duration: 550,
            easing: "easeOutExpo",
          });
        }
      } else if (ev.name === "dash") {
        this.audio.playDash();
        if (!this.settings.reducedMotion) {
          this._triggerWindDashAnim();
        }
      } else if (ev.name === "jump") {
        this.audio.playJump(Boolean(ev.data && ev.data.pad));
      } else if (ev.name === "shade_spawned") {
        this.audio.playShadeSpawned();
        this.lastSpawnedShadeId = ev.data.id;
        this.shadeSpawnAlertTicks = 240;
        this._showA11yCaption(`⚠️ Phụ đề: Bóng Mực ${ev.data.id} xuất hiện! (Xem mũi tên mép màn hình)`);
      } else if (ev.name === "wind_warning") {
        this.audio.playWindWarning();
        this._showA11yCaption(`🍃 Phụ đề: Gió mạnh sắp thổi (${Math.round(ev.data.dir_deg)}°)!`);
      } else if (ev.name === "drifter_steal") {
        this.audio.playHit();
        this._showAnimeBanner("GIÓ LẠC CƯỚP ĐOM ĐÓM!", "BẮN QUANG TIỄN HOẶC TỎA SÁNG [R] ĐỂ ĐÁNH RƠI LẠI!");
      } else if (ev.name === "drifter_drop") {
        this.audio.playCharmPickup();
      } else if (ev.name === "player_hit") {
        this.audio.playHit();
      } else if (ev.name === "paused") {
        this._unlockCursor();
        document.getElementById("pause-modal").classList.remove("hidden");
      } else if (ev.name === "resumed") {
        this._lockCursor();
        document.getElementById("pause-modal").classList.add("hidden");
      } else if (ev.name === "game_over") {
        this._unlockCursor();
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

    // Show Leaderboard Save Form after winning Night 3 (Bình Minh) OR losing on any Night
    const saveBox = document.getElementById("save-score-box");
    const saveMsg = document.getElementById("save-score-msg");
    if (saveBox) {
      if ((won && this.currentNight === 3) || !won) {
        saveBox.classList.remove("hidden");
        if (saveMsg) saveMsg.textContent = "";
      } else {
        saveBox.classList.add("hidden");
      }
    }

    const nextBtn = document.getElementById("btn-next-night");
    if (won && this.currentNight < 3) {
      document.getElementById("go-subtitle").textContent = `BÌNH MINH ĐÊM ${this.currentNight} (${reason})`;
      document.getElementById("go-title").textContent = "GIỮ ĐẢO SÁNG THÀNH CÔNG!";
      document.getElementById("go-desc").textContent =
        `"Giỏi lắm cháu Mây! Đảo đã giữ được ánh sáng tới tận bình minh. Hãy chuẩn bị bước sang Đêm ${this.currentNight + 1} nhé!"`;
      nextBtn.classList.remove("hidden");
      nextBtn.textContent = `➡ Sang Đêm ${this.currentNight + 1}`;
    } else if (won && this.currentNight === 3) {
      document.getElementById("go-subtitle").textContent = "BÌNH MINH TRÊN QUẦN ĐẢO ĐÈN LỒNG";
      document.getElementById("go-title").textContent = "🌅 BÌNH MINH RỰC RỠ!";
      document.getElementById("go-desc").textContent =
        `"Cả ba hòn đảo Đảo Bến, Đảo Cau và Đảo Chuông đã vượt qua đêm dài! Sương đen tan biến hoàn toàn trước ánh bình minh!"`;
      nextBtn.classList.add("hidden");
    } else {
      document.getElementById("go-subtitle").textContent = `THẤT BẠI · ĐÊM ${this.currentNight}`;
      document.getElementById("go-title").textContent =
        reason === "dawn" ? "KHÔNG ĐỦ ĐÈN SÁNG LÚC BÌNH MINH..." : "NGỌN LỬA ĐÃ TẮT...";
      document.getElementById("go-desc").textContent =
        `"Đừng nản lòng cháu Mây! Hãy châm dầu đều cho các Đèn Lồng và thử lại Đêm ${this.currentNight} một lần nữa!"`;
      nextBtn.classList.add("hidden");
    }
  }

  async _openLeaderboardModal() {
    this._unlockCursor();
    const modal = document.getElementById("leaderboard-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    let entries = [];
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        entries = Array.isArray(data.entries) ? data.entries : [];
        localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(entries));
      }
    } catch (_) {
      try {
        entries = JSON.parse(localStorage.getItem(LOCAL_LB_KEY) || "[]");
      } catch (_) {}
    }
    this._renderLeaderboardTable(entries);
  }

  _renderLeaderboardTable(entries) {
    const tbody = document.getElementById("leaderboard-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!entries || entries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">Chưa có kỷ lục nào được lưu.</td></tr>`;
      return;
    }
    entries.slice(0, 10).forEach((item, idx) => {
      const tr = document.createElement("tr");
      const timeStr = String(item.achieved_at || "").replace("T", " ").slice(0, 19);
      tr.innerHTML = `
        <td><b>#${idx + 1}</b></td>
        <td style="color:var(--lantern-core);font-weight:800;">${item.name}</td>
        <td style="color:var(--gold-border);font-weight:900;">${item.score}</td>
        <td>${item.nights_won}/3</td>
        <td>${item.seed}</td>
        <td style="font-size:14px;opacity:0.85;">${timeStr}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async _saveScoreToLeaderboard() {
    const inputEl = document.getElementById("input-player-name");
    const msgEl = document.getElementById("save-score-msg");
    if (!inputEl || !msgEl) return;
    const name = inputEl.value.trim();
    const nameRegex = /^[A-Za-z0-9_\u00C0-\u1EF9]{3,12}$/;
    if (!nameRegex.test(name)) {
      msgEl.style.color = "var(--ui-danger)";
      msgEl.textContent = "⚠️ Tên không hợp lệ! Cần 3–12 ký tự chữ, số hoặc dấu gạch dưới '_'.";
      return;
    }

    const totalScore = this.wonNightScores[1] + this.wonNightScores[2] + this.wonNightScores[3];
    const nightsWon = [1, 2, 3].filter((n) => this.wonNightScores[n] > 0).length;
    const payload = {
      name,
      score: totalScore,
      nights_won: nightsWon,
      seed: this.campaignSeed || 2026 + this.currentNight,
      achieved_at: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(data.entries || []));
        msgEl.style.color = "#00ffcc";
        msgEl.textContent = `✓ Đã lưu kỷ lục của [${name}] (${totalScore} điểm) vào Top 10!`;
        this._renderLeaderboardTable(data.entries || []);
        return;
      }
      msgEl.style.color = "var(--ui-danger)";
      msgEl.textContent = data.error || "Không thể lưu điểm.";
    } catch (_) {
      let localEntries = [];
      try {
        localEntries = JSON.parse(localStorage.getItem(LOCAL_LB_KEY) || "[]");
      } catch (_) {}
      localEntries.push(payload);
      localEntries.sort((a, b) => b.score - a.score || String(a.achieved_at).localeCompare(String(b.achieved_at)));
      localEntries = localEntries.slice(0, 10);
      localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(localEntries));
      msgEl.style.color = "#00ffcc";
      msgEl.textContent = `✓ Đã lưu kỷ lục cục bộ của [${name}] (${totalScore} điểm)!`;
    }
  }

  selectNight(night, showIntro = true) {
    this.currentNight = Number(night) || 1;
    this.sim = new GameSimulationJS(this.tuning, 2026 + this.currentNight, this.currentNight);
    this.rifleClip = 25;
    this.rifleReserve = 75;
    this._updateRifleHUD();
    this._rebuildNightWorld(this.currentNight);
    this._syncEntities(0, 0.016);
    document.getElementById("gameover-modal").classList.add("hidden");
    document.getElementById("pause-modal").classList.add("hidden");
    if (showIntro) {
      this._unlockCursor();
      this.started = false;
      document.getElementById("intro-modal").classList.remove("hidden");
      this._playIntroAnime();
    } else {
      this.started = true;
      document.getElementById("intro-modal").classList.add("hidden");
      this._lockCursor();
    }
  }

  startGame() {
    this.started = true;
    this.audio.startBGM();
    document.getElementById("intro-modal").classList.add("hidden");
    this._lockCursor();
  }

  toggleBot(force = null) {
    this.botEnabled = force !== null ? force : !this.botEnabled;
    const btn = document.getElementById("btn-bot");
    btn.textContent = this.botEnabled ? "🤖 Tự Chơi: BẬT" : "🤖 Tự Chơi: TẮT";
    btn.classList.toggle("active", this.botEnabled);
  }

  _computeBotInput() {
    const p = this.sim.player;
    const closeShade = this.sim.shades.find(
      (s) => s.state !== "stunned" && (distXZ(p.pos, s.pos) <= 4.0 || (s.state === "drain" && distXZ(p.pos, s.pos) <= 4.8))
    );
    const stolenDrifter = this.sim.drifters.find(
      (d) => d.state !== "removed" && distXZ(p.pos, d.pos) <= 4.5 && (d.state === "chase" || d.stolen > 0)
    );
    const wantPulse = Boolean(
      (closeShade || stolenDrifter) && p.carried >= 3 && this.sim.pulse_cd_ticks === 0 && !this.sim.input_state.pulse
    );

    const needyLanterns = this.sim.lanterns.filter((l) => !l.lit || l.fuel_ticks < 3600);
    const nearLantern = needyLanterns.find((l) => distXZ(p.pos, l.pos) <= 1.85 && Math.abs(p.pos[1] - l.pos[1]) <= 1.8);
    const wantInteract = Boolean(nearLantern && p.carried > 0 && !this.sim.input_state.interact);

    let targetPos = [0, 0, 0];
    if (needyLanterns.length > 0) {
      needyLanterns.sort((a, b) => a.fuel_ticks - b.fuel_ticks || distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos));
      const nextL = needyLanterns[0];
      const need = !nextL.lit ? (nextL.ever_lit ? 5 : 10) - nextL.deposited : Math.ceil((6000 - nextL.fuel_ticks) / 600);
      if (p.carried >= Math.min(need, 5) || p.carried >= p.capacity || this.sim.motes.length === 0) {
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

    if (this.sim.shades.some((s) => s.state !== "stunned" && distXZ(p.pos, s.pos) <= 14.0)) {
      this._shootRifle();
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
    document.getElementById("input-colorblind").checked = Boolean(this.settings.colorblind);
    document.body.classList.toggle("colorblind-mode", Boolean(this.settings.colorblind));

    const rmEl = document.getElementById("input-reduced-motion");
    if (rmEl) rmEl.checked = Boolean(this.settings.reducedMotion);

    const ltEl = document.getElementById("input-large-text");
    if (ltEl) ltEl.checked = Boolean(this.settings.largeText);
    document.body.classList.toggle("large-text-mode", Boolean(this.settings.largeText));

    const cbBtn = document.getElementById("btn-colorblind");
    if (cbBtn) {
      cbBtn.textContent = this.settings.colorblind ? "👁 Mù Màu: BẬT" : "👁 Mù Màu: TẮT";
      cbBtn.classList.toggle("active", Boolean(this.settings.colorblind));
    }

    const kb = this.settings.keybinds || DEFAULT_KEYBINDS;
    document.querySelectorAll(".kb-btn[data-action]").forEach((btn) => {
      const act = btn.getAttribute("data-action");
      btn.textContent = kb[act] || DEFAULT_KEYBINDS[act];
      btn.classList.toggle("listening", this.listeningKeyAction === act);
    });

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

      // Key Remapping Listener with Duplicate Key Detection
      if (this.listeningKeyAction) {
        e.preventDefault();
        const errEl = document.getElementById("keybind-error-msg");
        if (code === "Escape") {
          this.listeningKeyAction = null;
          if (errEl) errEl.textContent = "";
          this._applySettingsToUI();
          return;
        }
        const kb = this.settings.keybinds || { ...DEFAULT_KEYBINDS };
        const duplicateAction = Object.keys(kb).find(
          (act) => act !== this.listeningKeyAction && kb[act] === code
        );
        if (duplicateAction) {
          if (errEl) {
            errEl.style.color = "var(--ui-danger)";
            errEl.textContent = `⚠️ Trùng phím! Phím [${code}] đã được gán cho [${ACTION_LABELS[duplicateAction]}]`;
          }
          return;
        }
        kb[this.listeningKeyAction] = code;
        this.settings.keybinds = kb;
        const doneLabel = ACTION_LABELS[this.listeningKeyAction];
        this.listeningKeyAction = null;
        saveSettings(this.settings);
        this._applySettingsToUI();
        if (errEl) {
          errEl.style.color = "#00ffcc";
          errEl.textContent = `✓ Đã gán phím [${code}] cho hành động [${doneLabel}]`;
        }
        return;
      }

      this.keys[code] = true;
      const kb = this.settings.keybinds || DEFAULT_KEYBINDS;
      if (code === kb.jump) this.pendingJump = true;
      if (code === kb.interact || code === "KeyF") this.pendingInteract = true;
      if (code === kb.pulse) this.pendingPulse = true;
      if (code === kb.dash || code === "ShiftRight") this.pendingDash = true;
      if (code === "Escape" || code === kb.pause) this.pendingPause = true;
      if (code === "KeyV") this.toggleCameraMode();
      if (code === "KeyG") this._reloadRifle();
      if (code === "KeyB") this._shootRifle();
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    // Pointer Lock (Cursor.lockState = CursorLockMode.Locked) + Fallback Drag Look
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const canvas = this.renderer.domElement;

    canvas.addEventListener("mousedown", (e) => {
      if (this.started && this.sim.state === "playing" && !this.benchMode) {
        this._lockCursor();
        if (e.button === 0) {
          this._shootRifle();
        }
      }
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
    });
    window.addEventListener("mousemove", (e) => {
      const isLocked = document.pointerLockElement === canvas;
      if (isLocked || dragging) {
        const dx = isLocked ? e.movementX : e.clientX - lastX;
        const dy = isLocked ? e.movementY : e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        const sens = (this.settings.mouseSens / 100) * 0.35;
        this.camYawDeg = (this.camYawDeg - dx * sens) % 360;
        this.fpsPitch = Math.max(-0.55, Math.min(0.55, this.fpsPitch - dy * 0.0035 * (this.settings.mouseSens / 100)));
      }
    });

    document.getElementById("btn-cam-mode").addEventListener("click", () => this.toggleCameraMode());
    document.getElementById("btn-colorblind").addEventListener("click", () => {
      this.settings.colorblind = !this.settings.colorblind;
      this._applySettingsToUI();
      saveSettings(this.settings);
    });
    document.getElementById("btn-start-game").addEventListener("click", () => this.startGame());
    document.getElementById("btn-play-again").addEventListener("click", () => this.selectNight(this.currentNight, false));
    document.getElementById("btn-next-night").addEventListener("click", () => {
      if (this.currentNight < 3) this.selectNight(this.currentNight + 1, true);
    });

    const lbBtn = document.getElementById("btn-open-leaderboard");
    if (lbBtn) lbBtn.addEventListener("click", () => this._openLeaderboardModal());
    const goLbBtn = document.getElementById("btn-go-leaderboard");
    if (goLbBtn) goLbBtn.addEventListener("click", () => this._openLeaderboardModal());
    const closeLbBtn = document.getElementById("btn-close-leaderboard");
    if (closeLbBtn) {
      closeLbBtn.addEventListener("click", () => {
        document.getElementById("leaderboard-modal").classList.add("hidden");
      });
    }
    const saveScoreBtn = document.getElementById("btn-save-score");
    if (saveScoreBtn) saveScoreBtn.addEventListener("click", () => this._saveScoreToLeaderboard());

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

    const openSettings = () => {
      this._unlockCursor();
      this.listeningKeyAction = null;
      const errEl = document.getElementById("keybind-error-msg");
      if (errEl) errEl.textContent = "";
      this._applySettingsToUI();
      document.getElementById("settings-modal").classList.remove("hidden");
    };
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
    document.getElementById("input-colorblind").addEventListener("change", (e) => {
      this.settings.colorblind = Boolean(e.target.checked);
      this._applySettingsToUI();
      saveSettings(this.settings);
    });
    const rmInput = document.getElementById("input-reduced-motion");
    if (rmInput) {
      rmInput.addEventListener("change", (e) => {
        this.settings.reducedMotion = Boolean(e.target.checked);
        this._applySettingsToUI();
        saveSettings(this.settings);
      });
    }
    const ltInput = document.getElementById("input-large-text");
    if (ltInput) {
      ltInput.addEventListener("change", (e) => {
        this.settings.largeText = Boolean(e.target.checked);
        this._applySettingsToUI();
        saveSettings(this.settings);
      });
    }

    document.querySelectorAll(".kb-btn[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const act = e.currentTarget.getAttribute("data-action");
        this.listeningKeyAction = act;
        const errEl = document.getElementById("keybind-error-msg");
        if (errEl) {
          errEl.style.color = "var(--gold-border)";
          errEl.textContent = `⌨ Đang chờ phím mới cho [${ACTION_LABELS[act]}]... (Nhấn Esc để hủy)`;
        }
        this._applySettingsToUI();
        e.currentTarget.textContent = "Nhấn phím...";
      });
    });

    const resetKeysBtn = document.getElementById("btn-reset-keys");
    if (resetKeysBtn) {
      resetKeysBtn.addEventListener("click", () => {
        this.settings.keybinds = { ...DEFAULT_KEYBINDS };
        this.listeningKeyAction = null;
        saveSettings(this.settings);
        this._applySettingsToUI();
        const errEl = document.getElementById("keybind-error-msg");
        if (errEl) {
          errEl.style.color = "#00ffcc";
          errEl.textContent = "✓ Đã khôi phục toàn bộ phím điều khiển về mặc định!";
        }
      });
    }

    document.getElementById("btn-close-settings").addEventListener("click", () => {
      this.listeningKeyAction = null;
      saveSettings(this.settings);
      document.getElementById("settings-modal").classList.add("hidden");
    });
  }

  _readManualInput() {
    if (this.keys["KeyQ"]) this.camYawDeg = (this.camYawDeg + 2.2) % 360;
    if (this.keys["KeyC"]) this.camYawDeg = (this.camYawDeg - 2.2) % 360;

    const kb = this.settings.keybinds || DEFAULT_KEYBINDS;
    let mx = 0;
    let mz = 0;
    if (this.keys[kb.move_up] || this.keys["ArrowUp"]) mz += 1;
    if (this.keys[kb.move_down] || this.keys["ArrowDown"]) mz -= 1;
    if (this.keys[kb.move_left] || this.keys["ArrowLeft"]) mx += 1;
    if (this.keys[kb.move_right] || this.keys["ArrowRight"]) mx -= 1;

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

    if (this.benchMode) {
      this.accumulator += dt;
      while (this.accumulator >= DT) {
        this.accumulator -= DT;
        this.sim.stepBenchmark();
      }
    } else if (this.started && (this.sim.state === "playing" || this.sim.state === "paused")) {
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
