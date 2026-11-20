import * as THREE from "/web/vendor/three.module.min.js";
import anime from "/web/vendor/anime.es.js";
import { GameSimulationJS, DT, distXZ } from "/web/sim.js";
import { CozyAudioEngine } from "/web/audio.js";

// --- 1. Anime Cel-Shading Gradient Map & Outline Helper ---
function createToonGradientMap() {
  const data = new Uint8Array([45, 115, 195, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const toonGradient = createToonGradientMap();

function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient,
    ...opts,
  });
}

function addAnimeOutline(mesh, scale = 1.06, color = 0x110722) {
  const outlineMat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
  });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.setScalar(scale);
  mesh.add(outline);
  return outline;
}

// --- 2. Load Contract & Initialize State ---
async function loadContract() {
  try {
    const res = await fetch("/game.contract.json");
    if (res.ok) return await res.json();
  } catch (_) {}
  return {
    tuning: {
      player_speed: 6.0,
      carry_capacity: 5,
      lantern_cost: 3,
      lantern_count_night1: 5,
      pickup_radius: 1.5,
      interact_radius: 2.5,
      pulse_cost: 1,
      pulse_radius: 6.0,
      night1_duration_s: 300,
      flames: 3,
      invuln_s: 1.5,
      hit_drop_ratio: 0.5,
      pulse_stun_s: 3.0,
      pulse_push_m: 4.0,
      pulse_cooldown_s: 1.5,
      safe_radius: 4.0,
      shade_speed: 3.2,
      shade_hit_radius: 1.0,
      fall_enabled: false,
      score: { per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 2, per_flame_left: 100 },
    },
  };
}

// --- 3. Build 3D Anime World (Đảo Bến) ---
class AnimeIslandApp {
  constructor(contract) {
    this.contract = contract;
    this.tuning = contract.tuning;
    this.audio = new CozyAudioEngine();

    this.sim = new GameSimulationJS(this.tuning, 2026);
    this.started = false;
    this.botEnabled = false;
    this.camYawDeg = 0;
    this.camPitch = 0.48;
    this.camDist = 13.5;

    this.keys = {};
    this.pendingJump = false;
    this.pendingInteract = false;
    this.pendingPulse = false;

    this.scoreProxy = { val: 0 };
    this.lanternMeshes = new Map();
    this.moteMeshes = new Map();
    this.shadeMeshes = new Map();
    this.pulseWaves = [];
    this.trailParticles = [];

    this._initScene();
    this._buildEnvironment();
    this._buildPlayerMay();
    this._syncEntities(0);
    this._bindEvents();
    this._playIntroAnime();

    const params = new URLSearchParams(window.location.search);
    if (params.get("bot") === "1") {
      this.toggleBot(true);
    }
    if (params.get("autostart") === "1") {
      this.startGame();
    }

    this.lastTime = performance.now();
    this.accumulator = 0;
    requestAnimationFrame((t) => this._loop(t));
  }

  _initScene() {
    const container = document.getElementById("canvas-container");
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c061c);
    this.scene.fog = new THREE.FogExp2(0x0d061f, 0.017);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 220);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // Lighting (evolves as lanterns are lit)
    this.hemiLight = new THREE.HemisphereLight(0x49539e, 0x1a0e2e, 0.85);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0xaabfff, 1.15);
    this.moonLight.position.set(-18, 32, -16);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 2;
    this.moonLight.shadow.camera.far = 85;
    const d = 28;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.scene.add(this.moonLight);
  }

  _buildEnvironment() {
    // 1. Circular Harbor Island (Đảo Bến)
    const islandGroup = new THREE.Group();

    const topGeo = new THREE.CylinderGeometry(27.5, 28.5, 1.6, 48);
    const topMesh = new THREE.Mesh(topGeo, toonMat(0x233d4d));
    topMesh.position.y = -0.8;
    topMesh.receiveShadow = true;
    islandGroup.add(topMesh);

    const cliffGeo = new THREE.CylinderGeometry(28.2, 19.0, 7.5, 36);
    const cliffMesh = new THREE.Mesh(cliffGeo, toonMat(0x1b1630));
    cliffMesh.position.y = -5.3;
    islandGroup.add(cliffMesh);

    // Central stone compass plaza
    const plazaGeo = new THREE.CylinderGeometry(4.2, 4.5, 0.14, 32);
    const plazaMesh = new THREE.Mesh(plazaGeo, toonMat(0x3b3559));
    plazaMesh.position.y = 0.02;
    plazaMesh.receiveShadow = true;
    islandGroup.add(plazaMesh);

    const innerRingGeo = new THREE.RingGeometry(3.5, 3.85, 32);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffbe4f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.1;
    islandGroup.add(innerRing);

    // Stepping stone paths radiating to the 5 Great Lanterns
    const stoneGeo = new THREE.CylinderGeometry(0.75, 0.85, 0.12, 8);
    const stoneMat = toonMat(0x453e66);
    for (let i = 0; i < 5; i++) {
      const ang = (2 * Math.PI * i) / 5;
      for (let r = 5.5; r <= 14.0; r += 2.1) {
        const st = new THREE.Mesh(stoneGeo, stoneMat);
        st.position.set(Math.sin(ang) * r, 0.03, Math.cos(ang) * r);
        st.rotation.y = ang;
        st.receiveShadow = true;
        islandGroup.add(st);
      }
    }

    // Stylized Anime Trees & Rocks around the perimeter
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.2, 7);
    const trunkMat = toonMat(0x3d263b);
    const foliageGeo = new THREE.SphereGeometry(1.45, 10, 10);
    const foliageMat = toonMat(0x2d5363);

    for (let i = 0; i < 10; i++) {
      const ang = (2 * Math.PI * i) / 10 + 0.31;
      const rad = 22.8 + (i % 2) * 1.4;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      addAnimeOutline(trunk, 1.07);
      tree.add(trunk);

      const crown = new THREE.Mesh(foliageGeo, foliageMat);
      crown.position.y = 2.6;
      crown.scale.set(1.15, 0.88, 1.15);
      crown.castShadow = true;
      addAnimeOutline(crown, 1.05);
      tree.add(crown);

      tree.position.set(Math.sin(ang) * rad, 0, Math.cos(ang) * rad);
      islandGroup.add(tree);
    }

    this.scene.add(islandGroup);

    // 2. Sea of Clouds (Biển Mây) surrounding the island
    this.cloudsGroup = new THREE.Group();
    const cloudGeo = new THREE.SphereGeometry(4.2, 12, 10);
    const cloudMat = toonMat(0x261d47, { transparent: true, opacity: 0.85 });
    for (let i = 0; i < 36; i++) {
      const ang = (2 * Math.PI * i) / 36;
      const dist = 33 + (i % 3) * 6;
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set(Math.sin(ang) * dist, -2.5 + (i % 4) * 0.6, Math.cos(ang) * dist);
      puff.scale.set(1.4 + (i % 3) * 0.3, 0.55, 1.2);
      this.cloudsGroup.add(puff);
    }
    this.scene.add(this.cloudsGroup);

    // 3. Starry Anime Night Sky
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.random() * 0.42 * Math.PI + 0.06;
      const r = 95 + Math.random() * 30;
      starPositions[i * 3] = r * Math.cos(phi) * Math.sin(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi);
      starPositions[i * 3 + 2] = r * Math.cos(phi) * Math.cos(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xfff2c6, size: 0.85, transparent: true, opacity: 0.85 });
    this.stars = new THREE.Points(starGeo, starMat);
    this.scene.add(this.stars);
  }

  _buildPlayerMay() {
    // Mây: Young Lantern Keeper with Nón Lá & dangling miniature lantern
    this.mayGroup = new THREE.Group();

    // Body / Indigo Tunic
    const robeGeo = new THREE.ConeGeometry(0.52, 1.15, 14);
    const robeMesh = new THREE.Mesh(robeGeo, toonMat(0x354d8c));
    robeMesh.position.y = 0.62;
    robeMesh.castShadow = true;
    addAnimeOutline(robeMesh, 1.07);
    this.mayGroup.add(robeMesh);

    // Warm Golden-Crimson Scarf
    const scarfGeo = new THREE.TorusGeometry(0.3, 0.09, 8, 16);
    const scarfMesh = new THREE.Mesh(scarfGeo, toonMat(0xe85d4a));
    scarfMesh.rotation.x = Math.PI / 2;
    scarfMesh.position.y = 1.12;
    addAnimeOutline(scarfMesh, 1.08);
    this.mayGroup.add(scarfMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.32, 14, 14);
    const headMesh = new THREE.Mesh(headGeo, toonMat(0xffdfc4));
    headMesh.position.y = 1.38;
    headMesh.castShadow = true;
    addAnimeOutline(headMesh, 1.07);
    this.mayGroup.add(headMesh);

    // Anime Eyes
    const eyeGeo = new THREE.SphereGeometry(0.048, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x160a26 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.11, 1.38, 0.28);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.11, 1.38, 0.28);
    this.mayGroup.add(leftEye, rightEye);

    // Nón Lá (Vietnamese Conical Hat)
    const hatGeo = new THREE.ConeGeometry(0.78, 0.46, 20);
    const hatMesh = new THREE.Mesh(hatGeo, toonMat(0xe8c77b));
    hatMesh.position.set(0, 1.72, -0.02);
    hatMesh.rotation.x = -0.08;
    hatMesh.castShadow = true;
    addAnimeOutline(hatMesh, 1.05);
    this.mayGroup.add(hatMesh);

    // Miniature Lantern hanging from Nón Lá brim
    const miniGeo = new THREE.OctahedronGeometry(0.14, 0);
    this.miniLanternMat = new THREE.MeshBasicMaterial({ color: 0xffcc55 });
    this.miniLanternMesh = new THREE.Mesh(miniGeo, this.miniLanternMat);
    this.miniLanternMesh.position.set(0, 1.5, 0.65);
    addAnimeOutline(this.miniLanternMesh, 1.15, 0x381c00);
    this.mayGroup.add(this.miniLanternMesh);

    // Mây's Warm Lantern PointLight (scales with carried motes)
    this.mayLight = new THREE.PointLight(0xffaa3b, 2.2, 11, 1.6);
    this.mayLight.position.set(0, 1.6, 0.55);
    this.mayLight.castShadow = true;
    this.mayGroup.add(this.mayLight);

    this.scene.add(this.mayGroup);
  }

  _createLanternMesh(lData) {
    const group = new THREE.Group();

    // Stone pedestal & pillar
    const baseGeo = new THREE.CylinderGeometry(1.05, 1.25, 0.5, 8);
    const baseMesh = new THREE.Mesh(baseGeo, toonMat(0x484268));
    baseMesh.position.y = 0.25;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    addAnimeOutline(baseMesh, 1.05);
    group.add(baseMesh);

    const pillarGeo = new THREE.CylinderGeometry(0.35, 0.42, 2.3, 8);
    const pillarMesh = new THREE.Mesh(pillarGeo, toonMat(0x3a3456));
    pillarMesh.position.y = 1.6;
    pillarMesh.castShadow = true;
    addAnimeOutline(pillarMesh, 1.06);
    group.add(pillarMesh);

    // Lantern Core Chamber (glows when lit)
    const coreGeo = new THREE.CylinderGeometry(0.65, 0.55, 1.15, 6);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x261d3a,
      emissive: 0x1a102b,
      emissiveIntensity: 0.3,
      roughness: 0.3,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 3.25;
    addAnimeOutline(coreMesh, 1.07);
    group.add(coreMesh);

    // Hexagonal Pagoda Roof
    const roofGeo = new THREE.ConeGeometry(1.18, 0.72, 6);
    const roofMesh = new THREE.Mesh(roofGeo, toonMat(0x2e254a));
    roofMesh.position.y = 4.12;
    roofMesh.castShadow = true;
    addAnimeOutline(roofMesh, 1.06);
    group.add(roofMesh);

    // Sacred Safe-Zone Ground Circle (safe_radius)
    const safeR = Number(this.tuning.safe_radius);
    const ringGeo = new THREE.RingGeometry(safeR - 0.14, safeR, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x624d96,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.24,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.05;
    group.add(ringMesh);

    // 3 Small Deposit Progress Orbs floating around the lantern
    const progressOrbs = [];
    const orbGeo = new THREE.SphereGeometry(0.14, 10, 10);
    for (let i = 0; i < Number(this.tuning.lantern_cost); i++) {
      const orbMat = new THREE.MeshBasicMaterial({ color: 0x3b2f5c });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      const a = (2 * Math.PI * i) / Number(this.tuning.lantern_cost);
      orb.position.set(Math.cos(a) * 0.95, 2.55, Math.sin(a) * 0.95);
      group.add(orb);
      progressOrbs.push(orb);
    }

    // Lantern PointLight (enabled when lit)
    const light = new THREE.PointLight(0xffae38, 0, 18, 1.5);
    light.position.y = 3.4;
    group.add(light);

    group.position.set(lData.pos[0], 0, lData.pos[2]);
    this.scene.add(group);
    return { group, coreMat, ringMat, ringMesh, light, progressOrbs, wasLit: false };
  }

  _createMoteMesh(mData) {
    const group = new THREE.Group();
    const coreGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff099 });
    const core = new THREE.Mesh(coreGeo, coreMat);

    const haloGeo = new THREE.SphereGeometry(0.42, 12, 12);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xff9e2c,
      transparent: true,
      opacity: 0.35,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    group.add(core, halo);
    group.position.set(mData.pos[0], 0.7, mData.pos[2]);
    this.scene.add(group);
    return { group, phase: Math.random() * Math.PI * 2 };
  }

  _createShadeMesh(sData) {
    // Bóng Mực: Swirling dark ink spirit with glowing violet anime eyes & stun star halo
    const group = new THREE.Group();

    const bodyGeo = new THREE.SphereGeometry(0.62, 14, 14);
    const bodyMat = toonMat(0x160826);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.72;
    body.scale.set(1, 1.18, 1);
    body.castShadow = true;
    addAnimeOutline(body, 1.09, 0x7a1cff);
    group.add(body);

    // Glowing Violet Anime Eyes
    const eyeGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe254ff });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.2, 0.82, 0.54);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.2, 0.82, 0.54);
    group.add(eyeL, eyeR);

    // Orbiting Stun Stars (visible when state === "stunned")
    const stunRing = new THREE.Group();
    stunRing.position.y = 1.65;
    const starGeo = new THREE.OctahedronGeometry(0.13, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffe46b });
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(starGeo, starMat);
      const a = (2 * Math.PI * i) / 3;
      st.position.set(Math.cos(a) * 0.48, 0, Math.sin(a) * 0.48);
      stunRing.add(st);
    }
    stunRing.visible = false;
    group.add(stunRing);

    group.position.set(sData.pos[0], 0, sData.pos[2]);
    this.scene.add(group);
    return { group, body, bodyMat, eyeMat, stunRing };
  }

  _spawn3DPulseWave(pos) {
    const geo = new THREE.RingGeometry(0.4, Number(this.tuning.pulse_radius), 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd269,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos[0], 0.18, pos[2]);
    mesh.scale.setScalar(0.1);
    this.scene.add(mesh);

    anime({
      targets: mesh.scale,
      x: [0.1, 1.0],
      y: [0.1, 1.0],
      z: [0.1, 1.0],
      duration: 550,
      easing: "easeOutExpo",
    });
    anime({
      targets: mat,
      opacity: [0.85, 0],
      duration: 580,
      easing: "easeOutQuad",
      complete: () => {
        this.scene.remove(mesh);
        geo.dispose();
        mat.dispose();
      },
    });
  }

  _syncEntities(elapsedSec) {
    // 1. Update Mây position, rotation, and hat lantern brightness
    const p = this.sim.player;
    const bob = Math.hypot(this.sim.input_state.move[0], this.sim.input_state.move[1]) > 0.1
      ? Math.abs(Math.sin(elapsedSec * 12)) * 0.12
      : Math.sin(elapsedSec * 3) * 0.03;
    this.mayGroup.position.set(p.pos[0], p.pos[1] + bob, p.pos[2]);
    this.mayGroup.rotation.y = p.facingYaw;

    // Blink during invulnerability
    this.mayGroup.visible = this.sim.invuln_timer <= 0 || Math.floor(elapsedSec * 16) % 2 === 0;

    // Hat lantern scales with carried fireflies
    const carryRatio = p.carried / Math.max(1, Number(this.tuning.carry_capacity));
    this.mayLight.intensity = 1.8 + carryRatio * 3.2;
    this.mayLight.distance = 10 + carryRatio * 7;
    this.miniLanternMesh.scale.setScalar(0.9 + carryRatio * 0.55);

    // 2. Sync Great Lanterns (L1..L5)
    let litCount = 0;
    for (const l of this.sim.lanterns) {
      let entry = this.lanternMeshes.get(l.id);
      if (!entry) {
        entry = this._createLanternMesh(l);
        this.lanternMeshes.set(l.id, entry);
      }
      entry.group.position.set(l.pos[0], 0, l.pos[2]);
      entry.progressOrbs.forEach((orb, idx) => {
        orb.material.color.setHex(idx < l.deposited ? 0xffd86b : 0x3b2f5c);
      });

      if (l.lit) {
        litCount++;
        entry.coreMat.color.setHex(0xffe184);
        entry.coreMat.emissive.setHex(0xff9421);
        entry.coreMat.emissiveIntensity = 1.6 + Math.sin(elapsedSec * 4) * 0.2;
        entry.ringMat.color.setHex(0xffbe4f);
        entry.ringMat.opacity = 0.55 + Math.sin(elapsedSec * 3) * 0.15;
        entry.ringMesh.rotation.z = elapsedSec * 0.4;
        if (!entry.wasLit) {
          entry.wasLit = true;
          anime({
            targets: entry.light,
            intensity: [0, 5.5],
            duration: 900,
            easing: "easeOutElastic(1, .6)",
          });
        }
      } else {
        entry.wasLit = false;
        entry.coreMat.color.setHex(0x261d3a);
        entry.coreMat.emissive.setHex(0x1a102b);
        entry.coreMat.emissiveIntensity = 0.25;
        entry.ringMat.color.setHex(0x624d96);
        entry.ringMat.opacity = 0.2;
        entry.light.intensity = 0;
      }
    }

    // Dynamic Island Atmosphere Brightening as lanterns are lit (0/5 -> 5/5)
    const progress = litCount / Math.max(1, this.sim.lanterns.length);
    this.scene.fog.density = 0.018 - progress * 0.008;
    const skyColor = new THREE.Color(0x0c061c).lerp(new THREE.Color(0x1b2d59), progress);
    this.scene.background.copy(skyColor);
    this.scene.fog.color.copy(skyColor);
    this.hemiLight.intensity = 0.85 + progress * 0.75;

    // 3. Sync Motes (Fireflies)
    const activeMoteIds = new Set();
    for (const m of this.sim.motes) {
      activeMoteIds.add(m.id);
      let entry = this.moteMeshes.get(m.id);
      if (!entry) {
        entry = this._createMoteMesh(m);
        this.moteMeshes.set(m.id, entry);
      }
      const hoverY = 0.65 + Math.sin(elapsedSec * 3.5 + entry.phase) * 0.25;
      entry.group.position.set(m.pos[0], hoverY, m.pos[2]);
    }
    for (const [id, entry] of this.moteMeshes.entries()) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(entry.group);
        this.moteMeshes.delete(id);
      }
    }

    // 4. Sync Shades (Bóng Mực)
    const activeShadeIds = new Set();
    for (const s of this.sim.shades) {
      activeShadeIds.add(s.id);
      let entry = this.shadeMeshes.get(s.id);
      if (!entry) {
        entry = this._createShadeMesh(s);
        this.shadeMeshes.set(s.id, entry);
      }
      entry.group.position.set(s.pos[0], 0, s.pos[2]);
      const dx = p.pos[0] - s.pos[0];
      const dz = p.pos[2] - s.pos[2];
      if (Math.hypot(dx, dz) > 0.05) {
        entry.group.rotation.y = Math.atan2(dx, dz);
      }
      if (s.state === "stunned") {
        entry.stunRing.visible = true;
        entry.stunRing.rotation.y = elapsedSec * 5.0;
        entry.bodyMat.color.setHex(0x3a2459);
      } else {
        entry.stunRing.visible = false;
        entry.bodyMat.color.setHex(0x160826);
        entry.body.position.y = 0.72 + Math.sin(elapsedSec * 6) * 0.1;
      }
    }
    for (const [id, entry] of this.shadeMeshes.entries()) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(entry.group);
        this.shadeMeshes.delete(id);
      }
    }

    // 5. Third-Person Camera Orbit around Mây
    const yawRad = (this.camYawDeg * Math.PI) / 180.0;
    const camX = p.pos[0] - Math.sin(yawRad) * this.camDist * Math.cos(this.camPitch);
    const camZ = p.pos[2] - Math.cos(yawRad) * this.camDist * Math.cos(this.camPitch);
    const camY = p.pos[1] + 2.2 + Math.sin(this.camPitch) * this.camDist;
    this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.18);
    this.camera.lookAt(p.pos[0], p.pos[1] + 1.3, p.pos[2]);

    // 6. Contextual Action Prompt
    this._updateHUD(litCount);
  }

  _updateHUD(litCount) {
    const p = this.sim.player;
    const cap = Number(this.tuning.carry_capacity);

    // Flames
    const flameEls = document.querySelectorAll("#flames-container .flame-pip");
    flameEls.forEach((el, idx) => {
      el.classList.toggle("lost", idx >= p.flames);
    });

    // Motes carried
    document.getElementById("carried-text").textContent = `${p.carried}/${cap}`;
    const pillEls = document.querySelectorAll("#motes-pills .mote-pill");
    pillEls.forEach((el, idx) => {
      el.classList.toggle("filled", idx < p.carried);
    });

    // Lanterns
    document.getElementById("lanterns-text").textContent = `${litCount}/${this.sim.lanterns.length}`;
    for (const l of this.sim.lanterns) {
      const badge = document.querySelector(`.lantern-badge[data-id="${l.id}"]`);
      if (badge) badge.classList.toggle("lit", l.lit);
    }

    // Timer
    const rem = Math.max(0, Math.ceil(this.sim.time_left_s));
    const mm = String(Math.floor(rem / 60)).padStart(2, "0");
    const ss = String(rem % 60).padStart(2, "0");
    document.getElementById("timer-display").textContent = `${mm}:${ss}`;

    // Context prompt when near an unlit lantern
    const interactR = Number(this.tuning.interact_radius);
    const nearLantern = this.sim.lanterns.find(
      (l) => !l.lit && distXZ(p.pos, l.pos) <= interactR + 0.3
    );
    const promptEl = document.getElementById("context-prompt");
    if (nearLantern && p.carried > 0) {
      const need = Number(this.tuning.lantern_cost) - nearLantern.deposited;
      promptEl.textContent = `✨ Nhấn [F] hoặc [E] để nạp đom đóm vào Đèn ${nearLantern.id} (Cần thêm ${need})`;
      promptEl.style.opacity = "1";
      promptEl.style.transform = "translateY(0)";
    } else {
      promptEl.style.opacity = "0";
      promptEl.style.transform = "translateY(10px)";
    }
  }

  _handleSimEvents(events) {
    for (const ev of events) {
      if (ev.name === "mote_picked") {
        this.audio.playMotePickup(ev.data.carried);
        anime({
          targets: "#motes-pills .mote-pill.filled",
          scale: [1.45, 1.12],
          duration: 450,
          easing: "spring(1, 80, 10, 0)",
        });
      } else if (ev.name === "deposit") {
        this.audio.playDeposit();
      } else if (ev.name === "lantern_lit") {
        this.audio.playLanternLit();
        this._showAnimeBanner(
          `ĐÈN LỒNG ${ev.data.lantern_id} KHAI SÁNG!`,
          "VÙNG AN TOÀN ĐÃ MỞ RỘNG · SƯƠNG ĐEN LÙI XA"
        );
      } else if (ev.name === "pulse") {
        this.audio.playPulse();
        this._spawn3DPulseWave(this.sim.player.pos);
        anime({
          targets: "#screen-pulse-ring",
          scale: [0.2, 4.2],
          opacity: [0.9, 0],
          duration: 600,
          easing: "easeOutExpo",
        });
      } else if (ev.name === "player_hit") {
        this.audio.playHit();
        anime({
          targets: "#hud .anime-card",
          translateX: [-10, 10, -6, 6, 0],
          duration: 380,
          easing: "easeInOutSine",
        });
      } else if (ev.name === "game_over") {
        const won = ev.data.result === "won";
        this.audio.playGameOver(won);
        this._showGameOverModal(won, ev.data.reason);
      }
    }

    // Smoothly roll score display with Anime.js
    if (this.scoreProxy.val !== this.sim.score) {
      anime({
        targets: this.scoreProxy,
        val: this.sim.score,
        round: 1,
        duration: 450,
        easing: "easeOutQuad",
        update: () => {
          document.getElementById("score-display").textContent = this.scoreProxy.val;
        },
      });
    }
  }

  _showAnimeBanner(mainText, subText) {
    document.getElementById("banner-main").textContent = mainText;
    document.getElementById("banner-sub").textContent = subText;
    anime.remove("#anime-banner");
    anime
      .timeline()
      .add({
        targets: "#anime-banner",
        opacity: [0, 1],
        scale: [0.8, 1],
        duration: 380,
        easing: "easeOutBack",
      })
      .add({
        targets: "#anime-banner",
        opacity: 0,
        scale: 1.06,
        delay: 1400,
        duration: 450,
        easing: "easeInQuad",
      });
  }

  _playIntroAnime() {
    anime({
      targets: "#intro-svg-path",
      strokeDashoffset: [anime.setDashoffset, 0],
      easing: "easeInOutSine",
      duration: 1800,
      loop: true,
      direction: "alternate",
    });
    anime({
      targets: "#intro-modal .modal-box > *",
      translateY: [18, 0],
      opacity: [0, 1],
      delay: anime.stagger(90),
      duration: 650,
      easing: "easeOutExpo",
    });
  }

  _showGameOverModal(won, reason) {
    const modal = document.getElementById("gameover-modal");
    modal.classList.remove("hidden");
    document.getElementById("go-subtitle").textContent = won
      ? "CHIẾN THẮNG · ĐÊM 1 HOÀN TẤT"
      : "ĐÊM SƯƠNG ĐEN KHÉP LẠI";
    document.getElementById("go-title").textContent = won
      ? "ĐẢO BẾN BỪNG SÁNG!"
      : reason === "dawn"
      ? "BÌNH MINH ĐÃ ĐI QUA..."
      : "NGỌN LỬA ĐÃ TẮT...";
    document.getElementById("go-desc").textContent = won
      ? "Cả 5 chiếc Đèn Lồng Lớn trên Đảo Bến đã tỏa sáng rực rỡ, đẩy lùi toàn bộ Bóng Mực về lại biển sương!"
      : "Sương đen và Bóng Mực đã làm tắt ngọn đèn của Mây. Hãy hít một hơi sâu và thắp lại ánh sáng cho Đảo Bến nhé!";
    document.getElementById("go-score").textContent = this.sim.score;

    anime({
      targets: "#gameover-modal .modal-box",
      scale: [0.85, 1],
      opacity: [0, 1],
      duration: 500,
      easing: "spring(1, 80, 12, 0)",
    });
  }

  startGame() {
    this.started = true;
    document.getElementById("intro-modal").classList.add("hidden");
  }

  restartGame() {
    document.getElementById("gameover-modal").classList.add("hidden");
    this.sim = new GameSimulationJS(this.tuning, (Date.now() & 0xffff) || 2026);
    this.scoreProxy.val = 0;
    document.getElementById("score-display").textContent = "0";
    this.started = true;
    this._syncEntities(0);
  }

  toggleBot(forceState = null) {
    this.botEnabled = forceState !== null ? forceState : !this.botEnabled;
    const btn = document.getElementById("btn-bot");
    btn.textContent = this.botEnabled ? "🤖 Tự Chơi (Demo): BẬT" : "🤖 Tự Chơi (Demo): TẮT";
    btn.classList.toggle("active", this.botEnabled);
  }

  _computeBotInput() {
    const p = this.sim.player;
    const pulseCost = Number(this.tuning.pulse_cost);
    const pulseR = Number(this.tuning.pulse_radius);
    const interactR = Number(this.tuning.interact_radius);
    const lanternCost = Number(this.tuning.lantern_cost);

    // 1. If an active shade is close and we can pulse, trigger pulse!
    const closeShade = this.sim.shades.find(
      (s) => s.state !== "stunned" && distXZ(p.pos, s.pos) <= Math.min(3.5, pulseR - 0.5)
    );
    const wantPulse = Boolean(
      closeShade && p.carried >= pulseCost && this.sim.pulse_cooldown <= 0.01 && !this.sim.input_state.pulse
    );

    // 2. If near an unlit lantern and carrying motes, interact!
    const unlitLanterns = this.sim.lanterns.filter((l) => !l.lit);
    const nearLantern = unlitLanterns.find((l) => distXZ(p.pos, l.pos) <= interactR - 0.2);
    const wantInteract = Boolean(nearLantern && p.carried > 0 && !this.sim.input_state.interact);

    // 3. Choose target destination: nearest unlit lantern if carrying enough motes, else nearest mote
    let targetPos = [0, 0, 0];
    if (unlitLanterns.length > 0) {
      unlitLanterns.sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos));
      const nextLantern = unlitLanterns[0];
      const need = lanternCost - nextLantern.deposited;
      if (p.carried >= need || p.carried >= Number(this.tuning.carry_capacity) || this.sim.motes.length === 0) {
        targetPos = nextLantern.pos;
      } else {
        const sortedMotes = [...this.sim.motes].sort((a, b) => distXZ(p.pos, a.pos) - distXZ(p.pos, b.pos));
        targetPos = sortedMotes[0].pos;
      }
    }

    let vx = targetPos[0] - p.pos[0];
    let vz = targetPos[2] - p.pos[2];
    const d = Math.hypot(vx, vz);
    if (d > 0.1) {
      vx /= d;
      vz /= d;
    } else {
      vx = 0;
      vz = 0;
    }

    // Repulsion vector away from active shades
    for (const s of this.sim.shades) {
      if (s.state === "stunned") continue;
      const sd = distXZ(p.pos, s.pos);
      if (sd < 4.5 && sd > 0.01) {
        const weight = (4.5 - sd) / 4.5;
        vx += ((p.pos[0] - s.pos[0]) / sd) * weight * 1.4;
        vz += ((p.pos[2] - s.pos[2]) / sd) * weight * 1.4;
      }
    }

    // Convert world (vx, vz) back into camera-relative move [mx, mz]
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

    return {
      move: [mx, mz],
      cam_yaw_deg: this.camYawDeg,
      jump: false,
      interact: wantInteract,
      pulse: wantPulse,
    };
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
      if (code === "KeyF" || code === "KeyE") this.pendingInteract = true;
      if (code === "KeyR" || code === "ShiftLeft" || code === "ShiftRight") this.pendingPulse = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    // Mouse drag camera orbit
    let dragging = false;
    let lastX = 0;
    this.renderer.domElement.addEventListener("mousedown", (e) => {
      dragging = true;
      lastX = e.clientX;
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (dragging) {
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        this.camYawDeg = (this.camYawDeg - dx * 0.45) % 360;
      }
    });

    document.getElementById("btn-start-game").addEventListener("click", () => this.startGame());
    document.getElementById("btn-play-again").addEventListener("click", () => this.restartGame());
    document.getElementById("btn-replay").addEventListener("click", () => this.restartGame());
    document.getElementById("btn-bot").addEventListener("click", () => this.toggleBot());
    document.getElementById("btn-audio").addEventListener("click", (e) => {
      this.audio.muted = !this.audio.muted;
      e.currentTarget.textContent = this.audio.muted ? "🔇 Tắt Tiếng" : "🔊 Âm Thanh";
    });
  }

  _readManualInput() {
    if (this.keys["KeyQ"]) this.camYawDeg = (this.camYawDeg + 2.0) % 360;
    if (this.keys["KeyC"]) this.camYawDeg = (this.camYawDeg - 2.0) % 360;

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
    };
    this.pendingJump = false;
    this.pendingInteract = false;
    this.pendingPulse = false;
    return frame;
  }

  _loop(now) {
    const dt = Math.min(0.1, (now - this.lastTime) / 1000.0);
    this.lastTime = now;

    if (this.started && this.sim.state === "playing") {
      this.accumulator += dt;
      while (this.accumulator >= DT) {
        this.accumulator -= DT;
        const frame = this.botEnabled ? this._computeBotInput() : this._readManualInput();
        const events = this.sim.step(frame);
        if (events.length > 0) this._handleSimEvents(events);
      }
    }

    const elapsedSec = now / 1000.0;
    this.cloudsGroup.rotation.y = elapsedSec * 0.025;
    this._syncEntities(elapsedSec);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this._loop(t));
  }
}

loadContract().then((contract) => {
  window.gameApp = new AnimeIslandApp(contract);
});
