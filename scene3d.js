/* ==========================================================================
   VOCES DE AMARILIS — Interactive 3D WebGL Hardware Workbench (Three.js r128)
   Faithful Cel-Shaded / Technical Blueprint Model of 2_mapa_conexion_real_fritzing.png
   All 15 Physical Assemblies across 5 Zones · 100% Offline (file:// safe)
   ========================================================================== */

(function () {
  "use strict";

  const INK_COLOR = 0x18213d;
  const PARCHMENT_HEX = 0xf6eddd;

  // Zone camera presets (spherical angles + lookAt target)
  const ZONE_PRESETS = {
    all: { target: [-0.2, 0.25, 0.2], theta: 0.14, phi: 0.78, radius: 31.0 },
    z1:  { target: [-8.8, 0.4, -4.6], theta: 0.36, phi: 0.72, radius: 13.8 },
    z2:  { target: [-9.2, 0.4, 4.2],  theta: 0.32, phi: 0.75, radius: 13.8 },
    z3:  { target: [-1.4, 0.35, 0.0], theta: 0.14, phi: 0.74, radius: 16.5 },
    z4:  { target: [5.0, 0.35, 0.0],  theta: -0.14, phi: 0.74, radius: 16.5 },
    z5:  { target: [10.6, 0.55, 0.8], theta: -0.26, phi: 0.78, radius: 16.8 }
  };

  const ZONE_PRIMARY_NODE = {
    z1: "lm2596",
    z2: "pam8610",
    z3: "nano",
    z4: "esp32",
    z5: "oled"
  };

  // Exact node/assembly camera targets for bidirectional Info Card / Strip focus
  const ASSEMBLY_TARGETS = {
    adapter12v: { zone: "z1", pos: [-12.2, 0.4, -6.2], radius: 9.5 },
    jackdc:     { zone: "z1", pos: [-9.6, 0.4, -6.2],  radius: 9.0 },
    kcd1:       { zone: "z1", pos: [-7.5, 0.4, -6.2],  radius: 9.0 },
    cap1000:    { zone: "z1", pos: [-5.7, 0.5, -6.2],  radius: 8.5 },
    lm2596:     { zone: "z1", pos: [-9.0, 0.4, -3.2],  radius: 10.5 },
    pam8610:    { zone: "z2", pos: [-11.2, 0.4, 2.2],  radius: 10.5 },
    pot10k:     { zone: "z2", pos: [-7.6, 0.5, 2.2],   radius: 9.5 },
    speakers:   { zone: "z2", pos: [-9.6, 0.5, 6.2],   radius: 11.5 },
    nano:       { zone: "z3", pos: [-1.4, 0.4, -5.8],  radius: 10.5 },
    pb1:        { zone: "z3", pos: [-1.4, 0.4, -0.4],  radius: 10.5 },
    dfplayer:   { zone: "z3", pos: [-1.4, 0.4, 5.4],   radius: 10.5 },
    esp32:      { zone: "z4", pos: [5.0, 0.4, -5.8],   radius: 10.0 },
    pb2:        { zone: "z4", pos: [5.0, 0.4, -0.4],   radius: 10.5 },
    microsd:    { zone: "z4", pos: [5.0, 0.4, 5.4],    radius: 10.5 },
    oled:       { zone: "z5", pos: [11.1, 1.1, -5.0],  radius: 10.0 },
    ttp223:     { zone: "z5", pos: [11.1, 0.4, 3.3],   radius: 12.5 }
  };

  const NODE_TO_ASSEMBLY = {
    lm2596:   "lm2596",
    ttp223:   "ttp223",
    nano:     "nano",
    divider:  "pb2",
    esp32:    "esp32",
    microsd:  "microsd",
    oled:     "oled",
    dfplayer: "dfplayer",
    pam8610:  "pam8610"
  };

  // Callouts: compact overview set (activeZone === "all") + detailed zone sets
  const CALLOUT_DEFS = [
    // Overview (6 outer-perimeter cards: 3 top, 3 bottom — zero PCB occlusion)
    {
      id: "ov_z1", mode: "all", zone: "z1", node: "lm2596", assembly: "kcd1",
      icon: "⚡", title: "Z1 · KCD1 + LM2596", sub: "12V 2A → 5.00V · Clic KCD1",
      anchor: [-8.8, 0.9, -5.4], offset: [-42, -108]
    },
    {
      id: "ov_nano", mode: "all", zone: "z3", node: "nano", assembly: "nano",
      icon: "▣", title: "Z3 · Arduino Nano V3", sub: "Maestro 5V · D2..D12",
      anchor: [-1.4, 0.7, -5.8], offset: [0, -112]
    },
    {
      id: "ov_oled", mode: "all", zone: "z5", node: "oled", assembly: "oled",
      icon: "▤", title: "Z5 · OLED + 4× TTP223", sub: "I2C 800kHz · Clic T1..T4",
      anchor: [11.1, 1.4, -4.6], offset: [-26, -104]
    },
    {
      id: "ov_z2", mode: "all", zone: "z2", node: "pam8610", assembly: "pam8610",
      icon: "🔊", title: "Z2 · PAM8610 + 2×8Ω", sub: "BTL 6.24W/ch · Pot 10kΩ",
      anchor: [-9.6, 0.8, 5.2], offset: [-24, 92]
    },
    {
      id: "ov_dfp", mode: "all", zone: "z3", node: "dfplayer", assembly: "dfplayer",
      icon: "♪", title: "Z3 · DFPlayer + 2×1µF", sub: "MP3 + BUSY D12 + R1 1kΩ",
      anchor: [-1.4, 0.7, 5.4], offset: [0, 96]
    },
    {
      id: "ov_esp", mode: "all", zone: "z4", node: "esp32", assembly: "esp32",
      icon: "◈", title: "Z4 · ESP32-C3 + 100µF", sub: "Div 1k+2k · MicroSD 20MHz",
      anchor: [5.0, 0.7, 5.2], offset: [14, 96]
    },

    // Zone 1 Detail
    {
      id: "z1_adap", mode: "z1", zone: "z1", node: "lm2596", assembly: "adapter12v",
      icon: "🔌", title: "Adaptador 12V 2A + Jack", sub: "Plug 5.5×2.1mm centro (+)",
      anchor: [-11.0, 0.9, -6.3], offset: [-70, -76]
    },
    {
      id: "z1_kcd", mode: "z1", zone: "z1", node: "lm2596", assembly: "kcd1",
      icon: "⏻", title: "Switch KCD1 (Clic 3D)", sub: "Corta +12V_RAW maestro",
      anchor: [-7.5, 0.85, -6.3], offset: [20, -90]
    },
    {
      id: "z1_cap", mode: "z1", zone: "z1", node: "lm2596", assembly: "cap1000",
      icon: "🔋", title: "Cap 1000 µF 25V", sub: "Filtro bulk riel +12V_SW",
      anchor: [-5.7, 1.15, -6.3], offset: [70, -40]
    },
    {
      id: "z1_buck", mode: "z1", zone: "z1", node: "lm2596", assembly: "lm2596",
      icon: "⚙", title: "Step-Down LM2596", sub: "W103 pre-calibrado a 5.00V",
      anchor: [-9.0, 0.75, -3.2], offset: [-40, 68]
    },

    // Zone 2 Detail
    {
      id: "z2_pam", mode: "z2", zone: "z2", node: "pam8610", assembly: "pam8610",
      icon: "⚡", title: "PAM8610 BTL (15W+15W)", sub: "Vcm 6.00V · No unir OUT- GND",
      anchor: [-11.2, 0.65, 2.2], offset: [-78, -74]
    },
    {
      id: "z2_pot", mode: "z2", zone: "z2", node: "pam8610", assembly: "pot10k",
      icon: "🎛", title: "Pot Estéreo 10 kΩ", sub: "Clic para girar volumen",
      anchor: [-7.6, 1.0, 2.2], offset: [62, -68]
    },
    {
      id: "z2_spk", mode: "z2", zone: "z2", node: "pam8610", assembly: "speakers",
      icon: "🔊", title: "2× Parlantes 8 Ω BTL", sub: "6.244 W/ch · 1.392 A PASS",
      anchor: [-9.6, 0.9, 6.3], offset: [0, 68]
    },

    // Zone 3 Detail
    {
      id: "z3_nano", mode: "z3", zone: "z3", node: "nano", assembly: "nano",
      icon: "▣", title: "Arduino Nano V3", sub: "ATmega328P @ 5V · TX/RX/L",
      anchor: [-1.4, 0.65, -5.8], offset: [-64, -76]
    },
    {
      id: "z3_pb1", mode: "z3", zone: "z3", node: "dfplayer", assembly: "pb1",
      icon: "▦", title: "Protoboard #1 (170 pts)", sub: "100nF + R1 1kΩ + 2× 1µF AC",
      anchor: [-1.4, 0.65, -0.4], offset: [88, -10]
    },
    {
      id: "z3_dfp", mode: "z3", zone: "z3", node: "dfplayer", assembly: "dfplayer",
      icon: "♪", title: "DFPlayer + MicroSD #1", sub: "UART 9600 + BUSY → D12",
      anchor: [-1.4, 0.65, 5.4], offset: [-58, 66]
    },

    // Zone 4 Detail
    {
      id: "z4_esp", mode: "z4", zone: "z4", node: "esp32", assembly: "esp32",
      icon: "◈", title: "ESP32-C3 SuperMini", sub: "RISC-V 160 MHz · Antena Wi-Fi",
      anchor: [5.0, 0.65, -5.8], offset: [-66, -76]
    },
    {
      id: "z4_pb2", mode: "z4", zone: "z4", node: "divider", assembly: "pb2",
      icon: "▦", title: "PB #2: 100µF + Div 1k+2k", sub: "3× 1kΩ (3.333V) · Droop 14.2mV",
      anchor: [5.0, 0.75, -0.4], offset: [86, -8]
    },
    {
      id: "z4_sd", mode: "z4", zone: "z4", node: "microsd", assembly: "microsd",
      icon: "💾", title: "MicroSD SPI + AMS1117", sub: "SPI 20 MHz · VCC +5V · SD #2",
      anchor: [5.0, 0.65, 5.4], offset: [-58, 66]
    },

    // Zone 5 Detail
    {
      id: "z5_oled", mode: "z5", zone: "z5", node: "oled", assembly: "oled",
      icon: "▤", title: "OLED 0.96\" SSD1306", sub: "128×64 vivo · I2C 800kHz · 3V3",
      anchor: [11.1, 1.45, -5.0], offset: [-105, -26]
    },
    {
      id: "z5_ttp1", mode: "z5", zone: "z5", node: "ttp223", assembly: "ttp223",
      icon: "👆", title: "TTP223 #1 (D2) · Play", sub: "Clic en sensor 3D para pausar",
      anchor: [11.1, 0.4, -0.5], offset: [-125, -18]
    },
    {
      id: "z5_ttp2", mode: "z5", zone: "z5", node: "ttp223", assembly: "ttp223",
      icon: "⏭", title: "TTP223 #2..3 (D3/D4)", sub: "Siguiente / Anterior pista",
      anchor: [11.1, 0.4, 3.4], offset: [-130, -8]
    },
    {
      id: "z5_ttp4", mode: "z5", zone: "z5", node: "ttp223", assembly: "ttp223",
      icon: "🔇", title: "TTP223 #4 (D5) · Mute", sub: "Silencio o Vol+ (MDF ≤ 3mm)",
      anchor: [11.1, 0.4, 7.3], offset: [85, -36]
    }
  ];

  // State shared with script.js
  const state = {
    initialized: false,
    webglOk: false,
    powerOn: true,
    flowEnabled: true,
    labelsVisible: true,
    schematicOverlayOpen: false,
    activeZone: "all",
    activeNode: "nano",
    playState: "PLAYING", // PLAYING | PAUSED | STOPPED
    muted: false,
    vol: 20, // 6..30
    txFlashUntil: 0,
    ttpFlashUntil: [0, 0, 0, 0],
    lastOledRefresh: 0
  };

  let renderer, scene, camera;
  let celGradientTex, lineMatInk;
  let oledTexture = null;
  let oledMatOn = null;
  let oledMatOff = null;
  let oledScreenMesh = null;

  // Interactive / Animated mesh references
  let kcd1RockerGroup = null;
  let kcd1LedMat = null;
  let potKnobGroup = null;
  const speakerCones = [];
  let lm2596LedMat = null;
  let pamLedMat = null;
  let nanoPwrLedMat = null;
  let nanoTxLedMat = null;
  let nanoRxLedMat = null;
  let dfpBusyLedMat = null;
  let espLedMat = null;
  const ttpLedMats = [];
  const ttpLedMeshes = [];

  const interactiveMeshes = [];
  const flowParticles = [];
  const calloutCardMap = new Map();

  // Camera spherical orbit & tween target
  const camCtrl = {
    theta: ZONE_PRESETS.all.theta,
    phi: ZONE_PRESETS.all.phi,
    radius: ZONE_PRESETS.all.radius,
    lookAt: new THREE.Vector3(...ZONE_PRESETS.all.target),
    goalTheta: ZONE_PRESETS.all.theta,
    goalPhi: ZONE_PRESETS.all.phi,
    goalRadius: ZONE_PRESETS.all.radius,
    goalLookAt: new THREE.Vector3(...ZONE_PRESETS.all.target),
    dragging: false,
    panning: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    movedDist: 0,
    pinchDist: 0
  };

  // DOM References
  let stageWrap, canvasEl, calloutSvg, calloutCardsLayer, minimapReticle;

  // --------------------------------------------------------------------------
  // Procedural Texture & Cel-Shaded Material Helpers (100% Local Offline)
  // --------------------------------------------------------------------------
  function getCelGradient() {
    if (celGradientTex) return celGradientTex;
    const data = new Uint8Array([175, 175, 175, 255, 222, 222, 222, 255, 255, 255, 255, 255]);
    celGradientTex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    celGradientTex.minFilter = THREE.NearestFilter;
    celGradientTex.magFilter = THREE.NearestFilter;
    celGradientTex.needsUpdate = true;
    return celGradientTex;
  }

  function celMat(color, opts = {}) {
    if (opts.map) {
      return new THREE.MeshToonMaterial({
        color: color === undefined ? 0xffffff : color,
        map: opts.map,
        gradientMap: getCelGradient()
      });
    }
    return new THREE.MeshToonMaterial({
      color: color,
      gradientMap: getCelGradient()
    });
  }

  function addOutline(mesh, angle = 24) {
    if (!lineMatInk) {
      lineMatInk = new THREE.LineBasicMaterial({ color: INK_COLOR });
    }
    const edges = new THREE.EdgesGeometry(mesh.geometry, angle);
    const lines = new THREE.LineSegments(edges, lineMatInk);
    lines.raycast = function () {}; // Do not interfere with pointer raycasting
    mesh.add(lines);
    return mesh;
  }

  function makeBox(w, h, d, mat, outlineAngle = 24) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    if (outlineAngle > 0) addOutline(mesh, outlineAngle);
    return mesh;
  }

  function makeCyl(rt, rb, h, segs, mat, outlineAngle = 28) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, segs);
    const mesh = new THREE.Mesh(geo, mat);
    if (outlineAngle > 0) addOutline(mesh, outlineAngle);
    return mesh;
  }

  function makeShadowTex() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 18, 64, 64, 62);
    g.addColorStop(0, "rgba(62, 46, 26, 0.25)");
    g.addColorStop(0.7, "rgba(62, 46, 26, 0.12)");
    g.addColorStop(1, "rgba(62, 46, 26, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  let sharedShadowTex = null;
  function addGroundShadow(parent, w, d) {
    if (!sharedShadowTex) sharedShadowTex = makeShadowTex();
    const mat = new THREE.MeshBasicMaterial({
      map: sharedShadowTex,
      transparent: true,
      depthWrite: false
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.015;
    m.raycast = function () {};
    parent.add(m);
  }

  function makeCanvasTex(w, h, drawFn) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    drawFn(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  // Workbench parchment floor with isometric blueprint grid + 5 subtle Zone frames
  function createWorkbenchFloor() {
    const tex = makeCanvasTex(1024, 640, (ctx, w, h) => {
      ctx.fillStyle = "#f6eddd";
      ctx.fillRect(0, 0, w, h);

      // Subtle drafting grid
      ctx.strokeStyle = "#dfd2be";
      ctx.lineWidth = 1;
      const step = 32;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Zone footprint frames matching 2_mapa_conexion_real_fritzing.png
      const zones = [
        { x: 26,  y: 22,  w: 276, h: 278, col: "#d97706", label: "ZONA 1 · POTENCIA (12V -> 5.00V)" },
        { x: 26,  y: 318, w: 276, h: 298, col: "#0284c7", label: "ZONA 2 · AUDIO ESTÉREO BTL (8Ω)" },
        { x: 320, y: 22,  w: 215, h: 594, col: "#2563eb", label: "ZONA 3 · MAESTRO AVR (5V)" },
        { x: 553, y: 22,  w: 215, h: 594, col: "#7c3aed", label: "ZONA 4 · ESCLAVO RISC-V (3.3V)" },
        { x: 786, y: 22,  w: 212, h: 594, col: "#0d9488", label: "ZONA 5 · OLED + 4× TTP223" }
      ];
      zones.forEach((z) => {
        ctx.save();
        ctx.fillStyle = "rgba(255, 250, 240, 0.35)";
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.strokeStyle = z.col;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 6]);
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        ctx.restore();

        ctx.fillStyle = z.col;
        ctx.font = "bold 13px Consolas, monospace";
        ctx.fillText(z.label, z.x + 10, z.y + 18);
      });
    });

    const floorGeo = new THREE.PlaneGeometry(34, 21.25);
    const floorMat = new THREE.MeshBasicMaterial({ map: tex });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.1);
    floor.raycast = function () {};
    scene.add(floor);
  }

  function registerInteractive(mesh, assemblyId, nodeId, extra = {}) {
    mesh.userData = { assemblyId, nodeId, ...extra };
    interactiveMeshes.push(mesh);
  }

  function addPinHeaders(parent, count, startX, y, z, spacing, stepDir = "x", color = 0xd9a83e) {
    const baseMat = celMat(0x1f2533);
    const pinMat = celMat(color);
    const len = (count - 1) * spacing + 0.22;
    const strip = stepDir === "x"
      ? makeBox(len, 0.14, 0.2, baseMat, 25)
      : makeBox(0.2, 0.14, len, baseMat, 25);
    const mid = ((count - 1) * spacing) / 2;
    strip.position.set(
      stepDir === "x" ? startX + mid : startX,
      y,
      stepDir === "z" ? z + mid : z
    );
    parent.add(strip);

    for (let i = 0; i < count; i++) {
      const pin = makeBox(0.06, 0.26, 0.06, pinMat, 0);
      pin.position.set(
        stepDir === "x" ? startX + i * spacing : startX,
        y + 0.06,
        stepDir === "z" ? z + i * spacing : z
      );
      parent.add(pin);
    }
  }

  function makeBreadboard170(labelText, posX, posZ, assemblyId, nodeId) {
    const grp = new THREE.Group();
    grp.position.set(posX, 0, posZ);
    addGroundShadow(grp, 4.9, 3.3);

    const tex = makeCanvasTex(512, 340, (ctx, w, h) => {
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#c9beaa";
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      // Center trench
      ctx.fillStyle = "#dfd5c3";
      ctx.fillRect(14, h / 2 - 14, w - 28, 28);
      ctx.strokeStyle = "#b9ac96";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(14, h / 2 - 14, w - 28, 28);

      // 17 columns x 10 rows (a..e top, f..j bottom)
      const leftPad = 36;
      const colStep = (w - 64) / 16;
      const topRows = [44, 68, 92, 116, 140];
      const botRows = [200, 224, 248, 272, 296];

      ctx.fillStyle = "#4b463d";
      ctx.font = "bold 12px Consolas, monospace";
      ctx.textAlign = "center";

      for (let c = 0; c < 17; c++) {
        const cx = leftPad + c * colStep;
        if (c === 0 || c === 4 || c === 9 || c === 14 || c === 16) {
          ctx.fillStyle = "#7a7060";
          ctx.fillText(String(c + 1), cx, 24);
          ctx.fillText(String(c + 1), cx, h - 10);
        }
        [...topRows, ...botRows].forEach((ry) => {
          ctx.fillStyle = "#222735";
          ctx.fillRect(cx - 4.5, ry - 4.5, 9, 9);
          ctx.fillStyle = "#7d8799";
          ctx.fillRect(cx - 2, ry - 2, 4, 4);
        });
      }

      // Badge label in trench
      ctx.fillStyle = "#18213d";
      ctx.font = "bold 14px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText(labelText, w / 2, h / 2 + 5);
    });

    const bodyMats = [
      celMat(0xebe3d3),
      celMat(0xebe3d3),
      celMat(0xffffff, { map: tex }),
      celMat(0xdcd1be),
      celMat(0xebe3d3),
      celMat(0xebe3d3)
    ];
    const board = makeBox(4.3, 0.34, 2.8, bodyMats, 24);
    board.position.y = 0.17;
    grp.add(board);

    registerInteractive(board, assemblyId, nodeId);
    scene.add(grp);
    return grp;
  }

  function makeAxialResistor(x, y, z, rotY = 0, label = "1kΩ") {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = rotY;

    // 1kΩ = Brown (1), Black (0), Red (x100), Gold (5%)
    const resTex = makeCanvasTex(128, 64, (ctx, w, h) => {
      ctx.fillStyle = "#e3c598";
      ctx.fillRect(0, 0, w, h);
      const bands = [
        [24, 14, "#5c2e14"], // Brown
        [46, 12, "#1c1c1e"], // Black
        [68, 12, "#cc2929"], // Red
        [98, 10, "#d4a72c"]  // Gold
      ];
      bands.forEach(([bx, bw, col]) => {
        ctx.fillStyle = col;
        ctx.fillRect(bx, 0, bw, h);
      });
    });

    const body = makeCyl(0.11, 0.11, 0.56, 12, celMat(0xffffff, { map: resTex }), 0);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.22;
    grp.add(body);

    const leadMat = celMat(0xc0c6d1);
    const l1 = makeBox(0.24, 0.035, 0.035, leadMat, 0);
    l1.position.set(-0.38, 0.22, 0);
    const l2 = makeBox(0.24, 0.035, 0.035, leadMat, 0);
    l2.position.set(0.38, 0.22, 0);
    const d1 = makeBox(0.035, 0.24, 0.035, leadMat, 0);
    d1.position.set(-0.48, 0.11, 0);
    const d2 = makeBox(0.035, 0.24, 0.035, leadMat, 0);
    d2.position.set(0.48, 0.11, 0);
    grp.add(l1, l2, d1, d2);

    // Ink ring ends
    const ringGeo = new THREE.EdgesGeometry(body.geometry, 35);
    body.add(new THREE.LineSegments(ringGeo, new THREE.LineBasicMaterial({ color: INK_COLOR })));

    grp.userData.label = label;
    return grp;
  }

  function makeElectrolyticCap(x, y, z, radius, height, bodyColor, labelText) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const capTex = makeCanvasTex(256, 128, (ctx, w, h) => {
      ctx.fillStyle = bodyColor;
      ctx.fillRect(0, 0, w, h);
      // Negative polarity stripe
      ctx.fillStyle = "#d9e6f5";
      ctx.fillRect(18, 0, 34, h);
      ctx.fillStyle = "#18213d";
      ctx.font = "bold 22px Consolas, monospace";
      ctx.fillText("-", 29, 36);
      ctx.fillText("-", 29, 98);
      // Rating text
      ctx.fillStyle = "#f4f6fa";
      ctx.font = "bold 22px Consolas, monospace";
      ctx.fillText(labelText, 66, 72);
    });

    const cyl = makeCyl(radius, radius, height, 18, [
      celMat(0xffffff, { map: capTex }),
      celMat(0xd5dbe3), // silver aluminum vent top
      celMat(0x1f2533)
    ], 32);
    cyl.position.y = height / 2 + 0.08;
    grp.add(cyl);

    const leadMat = celMat(0xc0c6d1);
    const l1 = makeBox(0.04, 0.16, 0.04, leadMat, 0);
    l1.position.set(-radius * 0.42, 0.05, 0);
    const l2 = makeBox(0.04, 0.16, 0.04, leadMat, 0);
    l2.position.set(radius * 0.42, 0.05, 0);
    grp.add(l1, l2);
    return grp;
  }

  function makeCeramicCap104(x, y, z, rotY = 0) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.y = rotY;
    const tex = makeCanvasTex(64, 64, (ctx, w, h) => {
      ctx.fillStyle = "#e8a838";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#3b2307";
      ctx.font = "bold 22px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText("104", w / 2, 40);
    });
    const disc = makeBox(0.28, 0.28, 0.1, celMat(0xffffff, { map: tex }), 25);
    disc.position.y = 0.24;
    grp.add(disc);
    const leadMat = celMat(0xc0c6d1);
    const l1 = makeBox(0.035, 0.18, 0.035, leadMat, 0);
    l1.position.set(-0.08, 0.08, 0);
    const l2 = makeBox(0.035, 0.18, 0.035, leadMat, 0);
    l2.position.set(0.08, 0.08, 0);
    grp.add(l1, l2);
    return grp;
  }

  // --------------------------------------------------------------------------
  // Build All 15 Physical Assemblies in 5 Zones
  // --------------------------------------------------------------------------
  function buildAllAssemblies() {
    // ========================================================================
    // ZONA 1 — POTENCIA Y REGULACIÓN (12V -> 5.00V)
    // ========================================================================

    // 1. Adaptador 12V 2A + Plug DC Macho
    {
      const grp = new THREE.Group();
      grp.position.set(-12.2, 0, -6.3);
      addGroundShadow(grp, 2.5, 2.3);
      const adapTex = makeCanvasTex(256, 192, (ctx, w, h) => {
        ctx.fillStyle = "#222630";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#8a94a8";
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = "#f4efe4";
        ctx.font = "bold 22px Consolas, monospace";
        ctx.fillText("AC/DC ADAPTOR", 26, 48);
        ctx.fillStyle = "#f0a53a";
        ctx.font = "bold 24px Consolas, monospace";
        ctx.fillText("DC 12V · 2A", 36, 94);
        ctx.fillStyle = "#9fb3c8";
        ctx.font = "17px Consolas, monospace";
        ctx.fillText("CENTER (+)", 44, 134);
      });
      const body = makeBox(1.85, 0.95, 1.45, [
        celMat(0x232732), celMat(0x232732),
        celMat(0xffffff, { map: adapTex }),
        celMat(0x1b1e28), celMat(0x232732), celMat(0x232732)
      ], 22);
      body.position.y = 0.48;
      grp.add(body);
      // AC prongs on left
      const p1 = makeBox(0.35, 0.08, 0.22, celMat(0xd1d6df), 20);
      p1.position.set(-1.1, 0.48, -0.3);
      const p2 = makeBox(0.35, 0.08, 0.22, celMat(0xd1d6df), 20);
      p2.position.set(-1.1, 0.48, 0.3);
      grp.add(p1, p2);
      // Barrel DC Male Plug leading into Jack DC
      const plugBody = makeCyl(0.16, 0.16, 0.65, 14, celMat(0x282d38), 28);
      plugBody.rotation.z = Math.PI / 2;
      plugBody.position.set(1.65, 0.35, 0);
      const plugTip = makeCyl(0.1, 0.1, 0.32, 12, celMat(0xd5dbe4), 28);
      plugTip.rotation.z = Math.PI / 2;
      plugTip.position.set(2.08, 0.35, 0);
      grp.add(plugBody, plugTip);
      registerInteractive(body, "adapter12v", "lm2596");
      scene.add(grp);
    }

    // 2. Jack DC Hembra 2.1mm
    {
      const grp = new THREE.Group();
      grp.position.set(-9.55, 0, -6.3);
      addGroundShadow(grp, 1.35, 1.15);
      const jBox = makeBox(0.95, 0.68, 0.72, celMat(0x1f2430), 22);
      jBox.position.y = 0.34;
      const collar = makeCyl(0.24, 0.24, 0.18, 16, celMat(0xcfd6e0), 28);
      collar.rotation.z = Math.PI / 2;
      collar.position.set(-0.52, 0.35, 0);
      const lugPos = makeBox(0.22, 0.08, 0.14, celMat(0xd8a83e), 20);
      lugPos.position.set(0.56, 0.26, -0.18);
      const lugGnd = makeBox(0.22, 0.08, 0.14, celMat(0xc5cbd6), 20);
      lugGnd.position.set(0.56, 0.26, 0.18);
      grp.add(jBox, collar, lugPos, lugGnd);
      registerInteractive(jBox, "jackdc", "lm2596");
      scene.add(grp);
    }

    // 3. Interruptor Basculante KCD1 ON/OFF (Clickable in 3D!)
    {
      const grp = new THREE.Group();
      grp.position.set(-7.5, 0, -6.3);
      addGroundShadow(grp, 1.5, 1.2);
      const baseTex = makeCanvasTex(128, 96, (ctx, w, h) => {
        ctx.fillStyle = "#1b202b";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f4efe4";
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = "#f4efe4";
        ctx.font = "bold 20px Consolas, monospace";
        ctx.fillText("KCD1", 38, 28);
      });
      const housing = makeBox(1.15, 0.56, 0.85, [
        celMat(0x1b202b), celMat(0x1b202b),
        celMat(0xffffff, { map: baseTex }),
        celMat(0x151820), celMat(0x1b202b), celMat(0x1b202b)
      ], 22);
      housing.position.y = 0.28;
      grp.add(housing);

      // Pivoting rocker paddle
      kcd1RockerGroup = new THREE.Group();
      kcd1RockerGroup.position.set(0, 0.58, 0);
      const rockerTex = makeCanvasTex(128, 96, (ctx, w, h) => {
        ctx.fillStyle = "#c93428";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 34px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("I", 30, 58);
        ctx.beginPath();
        ctx.arc(96, 48, 14, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      });
      const rocker = makeBox(0.82, 0.22, 0.56, [
        celMat(0xb82c21), celMat(0xb82c21),
        celMat(0xffffff, { map: rockerTex }),
        celMat(0x9a2219), celMat(0xb82c21), celMat(0xb82c21)
      ], 22);
      rocker.position.y = 0.08;
      kcd1RockerGroup.add(rocker);
      kcd1RockerGroup.rotation.z = -0.24; // Tilted toward ON (I)
      grp.add(kcd1RockerGroup);

      kcd1LedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const ind = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), kcd1LedMat);
      ind.position.set(0.46, 0.59, 0.32);
      grp.add(ind);

      registerInteractive(housing, "kcd1", "lm2596", { action: "togglePower" });
      registerInteractive(rocker, "kcd1", "lm2596", { action: "togglePower" });
      scene.add(grp);
    }

    // 4. Capacitor Electrolítico 1000 µF 25V
    {
      const grp = makeElectrolyticCap(-5.65, 0, -6.3, 0.42, 1.15, "#19355c", "1000uF");
      addGroundShadow(grp, 1.1, 1.1);
      registerInteractive(grp.children[0], "cap1000", "lm2596");
      scene.add(grp);
    }

    // 5. Step-Down LM2596 (12V -> 5.00V)
    {
      const grp = new THREE.Group();
      grp.position.set(-9.0, 0, -3.15);
      addGroundShadow(grp, 3.6, 2.1);

      const pcbTex = makeCanvasTex(384, 224, (ctx, w, h) => {
        ctx.fillStyle = "#1d4f91";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f4efe4";
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        // Copper/tin corner pads
        const pads = [
          [26, 36, "IN+"], [26, h - 36, "IN-"],
          [w - 26, 36, "OUT+"], [w - 26, h - 36, "OUT-"]
        ];
        pads.forEach(([px, py, lbl]) => {
          ctx.fillStyle = "#e2c46b";
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#18213d";
          ctx.beginPath();
          ctx.arc(px, py, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 17px Consolas, monospace";
          ctx.fillText(lbl, px < w / 2 ? px + 20 : px - 64, py + 6);
        });
        ctx.fillStyle = "#f4efe4";
        ctx.font = "bold 22px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("LM2596S · 5.00V", w / 2, 34);
      });

      const pcb = makeBox(3.15, 0.18, 1.75, [
        celMat(0x163d73), celMat(0x163d73),
        celMat(0xffffff, { map: pcbTex }),
        celMat(0x143666), celMat(0x163d73), celMat(0x163d73)
      ], 24);
      pcb.position.y = 0.14;
      grp.add(pcb);

      // Black 330 Inductor
      const indTex = makeCanvasTex(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#222631";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#d9dee8";
        ctx.font = "bold 36px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("330", w / 2, 74);
      });
      const inductor = makeBox(0.76, 0.44, 0.76, [
        celMat(0x222631), celMat(0x222631),
        celMat(0xffffff, { map: indTex }),
        celMat(0x181c24), celMat(0x222631), celMat(0x222631)
      ], 24);
      inductor.position.set(0.32, 0.44, 0.18);
      grp.add(inductor);

      // 2x Silver SMD electrolytic caps
      const smdIn = makeCyl(0.24, 0.24, 0.36, 14, celMat(0xd5dbe4), 28);
      smdIn.position.set(-0.92, 0.4, 0.02);
      const smdOut = makeCyl(0.24, 0.24, 0.36, 14, celMat(0xd5dbe4), 28);
      smdOut.position.set(1.06, 0.4, 0.05);
      grp.add(smdIn, smdOut);

      // LM2596S IC + heatsink tab
      const ic = makeBox(0.55, 0.22, 0.55, celMat(0x1f2430), 22);
      ic.position.set(-0.35, 0.32, -0.25);
      const tab = makeBox(0.55, 0.28, 0.1, celMat(0xcfd6e0), 22);
      tab.position.set(-0.35, 0.34, -0.55);
      grp.add(ic, tab);

      // Blue W103 trimpot + brass screw
      const trimpot = makeBox(0.56, 0.34, 0.28, celMat(0x2068c7), 22);
      trimpot.position.set(0.28, 0.39, -0.55);
      const brassScrew = makeCyl(0.08, 0.08, 0.06, 10, celMat(0xe5b84b), 25);
      brassScrew.position.set(0.45, 0.58, -0.55);
      grp.add(trimpot, brassScrew);

      lm2596LedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), lm2596LedMat);
      led.position.set(1.05, 0.28, -0.55);
      grp.add(led);

      registerInteractive(pcb, "lm2596", "lm2596");
      scene.add(grp);
    }

    // ========================================================================
    // ZONA 2 — AUDIO BTL Y PARLANTES 8Ω
    // ========================================================================

    // 6. Amplificador PAM8610 (15W + 15W)
    {
      const grp = new THREE.Group();
      grp.position.set(-11.2, 0, 2.2);
      addGroundShadow(grp, 3.3, 2.8);

      const pamTex = makeCanvasTex(320, 280, (ctx, w, h) => {
        ctx.fillStyle = "#18243b";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = "#f4efe4";
        ctx.font = "bold 24px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("PAM8610", w / 2, 118);
        ctx.font = "bold 16px Consolas, monospace";
        ctx.fillStyle = "#38bdf8";
        ctx.fillText("15W+15W BTL", w / 2, 144);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "bold 14px Consolas, monospace";
        ctx.fillText("+12V  GND", 84, 34);
        ctx.fillText("IN_L GND IN_R", w - 68, 194);
        ctx.fillText("OUTL- OUTL+ OUTR+ OUTR-", w / 2, h - 18);
      });

      const pcb = makeBox(2.75, 0.18, 2.4, [
        celMat(0x131d30), celMat(0x131d30),
        celMat(0xffffff, { map: pamTex }),
        celMat(0x11192a), celMat(0x131d30), celMat(0x131d30)
      ], 24);
      pcb.position.y = 0.14;
      grp.add(pcb);

      // Barrel DC jack at top-left
      const dcj = makeBox(0.55, 0.42, 0.46, celMat(0x1e222c), 22);
      dcj.position.set(-0.9, 0.42, -0.78);
      grp.add(dcj);

      // QFN chip + 2 audio filter inductors
      const ic = makeBox(0.45, 0.12, 0.45, celMat(0x191d28), 22);
      ic.position.set(0, 0.28, -0.15);
      const l1 = makeBox(0.32, 0.22, 0.32, celMat(0x282e3d), 22);
      l1.position.set(-0.55, 0.33, 0.3);
      const l2 = makeBox(0.32, 0.22, 0.32, celMat(0x282e3d), 22);
      l2.position.set(0.55, 0.33, 0.3);
      grp.add(ic, l1, l2);

      // 4-way Green BTL terminal blocks along front edge (+Z)
      const termMat = celMat(0x198754);
      const screwMat = celMat(0xdcb448);
      [-0.78, -0.26, 0.26, 0.78].forEach((tx) => {
        const blk = makeBox(0.48, 0.38, 0.44, termMat, 22);
        blk.position.set(tx, 0.4, 0.92);
        const scr = makeCyl(0.11, 0.11, 0.06, 10, screwMat, 26);
        scr.position.set(tx, 0.61, 0.92);
        grp.add(blk, scr);
      });

      // 3-pin audio input header on right edge
      addPinHeaders(grp, 3, 1.16, 0.3, -0.25, 0.26, "z");

      pamLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), pamLedMat);
      led.position.set(-0.85, 0.27, 0.35);
      grp.add(led);

      registerInteractive(pcb, "pam8610", "pam8610");
      scene.add(grp);
    }

    // 7. Potenciómetro Estéreo 10 kΩ (Rotatable 3D Knob synced with volume!)
    {
      const grp = new THREE.Group();
      grp.position.set(-7.6, 0, 2.2);
      addGroundShadow(grp, 1.65, 1.65);

      const base = makeBox(1.15, 0.32, 1.05, celMat(0x2e7d5b), 22);
      base.position.y = 0.2;
      const hexNut = makeCyl(0.32, 0.32, 0.14, 6, celMat(0xd0d6e0), 22);
      hexNut.position.y = 0.42;
      grp.add(base, hexNut);

      // 6 pins (3 front, 3 back)
      addPinHeaders(grp, 3, -0.32, 0.18, 0.58, 0.32, "x");
      addPinHeaders(grp, 3, -0.32, 0.18, -0.58, 0.32, "x");

      // Rotatable 3D Knob
      potKnobGroup = new THREE.Group();
      potKnobGroup.position.set(0, 0.5, 0);
      const knobBody = makeCyl(0.38, 0.42, 0.48, 18, celMat(0x242a38), 28);
      knobBody.position.y = 0.24;
      const knobCap = makeCyl(0.34, 0.34, 0.04, 18, celMat(0x3a4358), 28);
      knobCap.position.y = 0.49;
      const pointer = makeBox(0.07, 0.06, 0.32, celMat(0xf8fafc), 20);
      pointer.position.set(0, 0.51, -0.14);
      potKnobGroup.add(knobBody, knobCap, pointer);
      grp.add(potKnobGroup);

      registerInteractive(base, "pot10k", "pam8610", { action: "stepVol" });
      registerInteractive(knobBody, "pot10k", "pam8610", { action: "stepVol" });
      scene.add(grp);
    }

    // 8. 2× Parlantes 8 Ω (Tilted Speaker Assemblies with Vibrating Cones)
    [-11.4, -7.6].forEach((sx, sIdx) => {
      const grp = new THREE.Group();
      grp.position.set(sx, 0, 6.2);
      addGroundShadow(grp, 2.75, 2.4);

      // Tilted enclosure/cradle facing slightly up & toward camera
      const tilted = new THREE.Group();
      tilted.position.y = 0.58;
      tilted.rotation.x = 0.34;
      grp.add(tilted);

      const frame = makeBox(2.25, 0.36, 2.25, celMat(0x283044), 22);
      tilted.add(frame);

      const basket = makeCyl(0.95, 0.55, 0.36, 24, celMat(0x3a4358), 28);
      basket.position.y = 0.12;
      tilted.add(basket);

      // Dark paper cone + vibrating central dome
      const coneGrp = new THREE.Group();
      coneGrp.position.y = 0.25;
      const cone = makeCyl(0.84, 0.32, 0.16, 24, celMat(0x2e3340), 30);
      const surround = new THREE.Mesh(
        new THREE.TorusGeometry(0.86, 0.085, 10, 28),
        celMat(0x181c26)
      );
      surround.rotation.x = Math.PI / 2;
      surround.position.y = 0.08;
      // Dark crisp rim line
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.02, 8, 28),
        new THREE.MeshBasicMaterial({ color: INK_COLOR })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.08;
      const dustCap = makeCyl(0.28, 0.32, 0.1, 18, celMat(0x4b556b), 28);
      dustCap.position.y = 0.05;
      coneGrp.add(cone, surround, dustCap);
      tilted.add(coneGrp, rim);

      // Label tag on front lip
      const lblTex = makeCanvasTex(160, 48, (ctx, w, h) => {
        ctx.fillStyle = "#f9f2e5";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#18213d";
        ctx.font = "bold 22px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText(sIdx === 0 ? "L · 8Ω 10W" : "R · 8Ω 10W", w / 2, 32);
      });
      const tag = makeBox(1.5, 0.06, 0.38, celMat(0xffffff, { map: lblTex }), 20);
      tag.position.set(0, 0.22, 0.96);
      tilted.add(tag);

      speakerCones.push(coneGrp);
      registerInteractive(frame, "speakers", "pam8610");
      registerInteractive(cone, "speakers", "pam8610");
      scene.add(grp);
    });

    // ========================================================================
    // ZONA 3 — MAESTRO AVR: ARDUINO NANO V3, PROTOBOARD #1, DFPLAYER MINI
    // ========================================================================

    // 9. Arduino Nano V3 (Blue PCB, 45° ATmega328P, Mini-USB, 2x15 headers, LEDs)
    {
      const grp = new THREE.Group();
      grp.position.set(-1.4, 0, -5.8);
      addGroundShadow(grp, 3.0, 4.8);

      const nanoTex = makeCanvasTex(256, 448, (ctx, w, h) => {
        ctx.fillStyle = "#1e468c";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f4efe4";
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("NANO V3", w / 2, 72);
        ctx.font = "bold 14px Consolas, monospace";
        ctx.fillStyle = "#b8d4ff";
        const leftPins = ["TX1","RX0","RST","GND","D2","D3","D4","D5","D6","D7","D8","D9","D10","D11","D12"];
        const rightPins = ["VIN","GND","RST","+5V","A7","A6","A5","A4","A3","A2","A1","A0","REF","3V3","D13"];
        for (let i = 0; i < 15; i++) {
          const py = 54 + i * 25;
          ctx.textAlign = "left";
          ctx.fillText(leftPins[i], 28, py);
          ctx.textAlign = "right";
          ctx.fillText(rightPins[i], w - 28, py);
        }
      });

      const pcb = makeBox(2.25, 0.16, 4.3, [
        celMat(0x16366e), celMat(0x16366e),
        celMat(0xffffff, { map: nanoTex }),
        celMat(0x132e5e), celMat(0x16366e), celMat(0x16366e)
      ], 24);
      pcb.position.y = 0.24;
      grp.add(pcb);

      // 2x15 Pin Headers
      addPinHeaders(grp, 15, -0.92, 0.14, -1.82, 0.26, "z");
      addPinHeaders(grp, 15,  0.92, 0.14, -1.82, 0.26, "z");

      // Mini-USB at back (-Z)
      const usb = makeBox(0.76, 0.36, 0.68, celMat(0xd1d7e0), 22);
      usb.position.set(0, 0.42, -1.96);
      grp.add(usb);

      // ATmega328P rotated 45 deg
      const mcu = makeBox(0.72, 0.12, 0.72, celMat(0x1b202b), 22);
      mcu.position.set(0, 0.38, -0.05);
      mcu.rotation.y = Math.PI / 4;
      grp.add(mcu);

      // 16 MHz crystal + Reset button
      const xtal = makeBox(0.36, 0.1, 0.18, celMat(0xd5dbe4), 22);
      xtal.position.set(0.42, 0.36, -0.82);
      const rstBtn = makeBox(0.32, 0.14, 0.26, celMat(0xe5e7eb), 22);
      rstBtn.position.set(0, 0.38, 0.92);
      grp.add(xtal, rstBtn);

      // Animated PWR / TX / RX LEDs
      nanoPwrLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      nanoTxLedMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      nanoRxLedMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const lPwr = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), nanoPwrLedMat);
      lPwr.position.set(0.35, 0.36, 1.35);
      const lTx = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), nanoTxLedMat);
      lTx.position.set(-0.35, 0.36, 1.35);
      const lRx = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), nanoRxLedMat);
      lRx.position.set(-0.15, 0.36, 1.35);
      grp.add(lPwr, lTx, lRx);

      registerInteractive(pcb, "nano", "nano");
      scene.add(grp);
    }

    // 10. Protoboard #1 (170 pts + Cap 100nF + R1 1kΩ + 2x Cap 1µF AC)
    {
      const pb1 = makeBreadboard170("PB #1 · 170 pts", -1.4, -0.4, "pb1", "dfplayer");
      // Cap 100nF (104) on left
      pb1.add(makeCeramicCap104(-1.45, 0.34, -0.58, 0));
      // R1 = 1kΩ axial resistor
      const r1 = makeAxialResistor(-0.35, 0.34, -0.52, 0, "R1 1kΩ");
      pb1.add(r1);
      // 2x Cap 1µF AC coupling on right
      const c1L = makeElectrolyticCap(0.95, 0.34, 0.55, 0.19, 0.52, "#1c3b70", "1uF");
      const c1R = makeElectrolyticCap(1.52, 0.34, 0.55, 0.19, 0.52, "#1c3b70", "1uF");
      pb1.add(c1L, c1R);
    }

    // 11. DFPlayer Mini + MicroSD #1 + Dynamic BUSY LED
    {
      const grp = new THREE.Group();
      grp.position.set(-1.4, 0, 5.4);
      addGroundShadow(grp, 2.7, 2.7);

      const dfpTex = makeCanvasTex(256, 256, (ctx, w, h) => {
        ctx.fillStyle = "#191e29";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = "#f4efe4";
        ctx.font = "bold 20px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("MP3-TF-16P", w / 2, h - 22);
        ctx.font = "bold 14px Consolas, monospace";
        ctx.fillStyle = "#60a5fa";
        ctx.fillText("BUSY", w - 42, 42);
      });

      const pcb = makeBox(2.15, 0.16, 2.15, [
        celMat(0x141822), celMat(0x141822),
        celMat(0xffffff, { map: dfpTex }),
        celMat(0x10141c), celMat(0x141822), celMat(0x141822)
      ], 24);
      pcb.position.y = 0.24;
      grp.add(pcb);

      // 2x8 headers
      addPinHeaders(grp, 8, -0.88, 0.14, -0.91, 0.26, "z");
      addPinHeaders(grp, 8,  0.88, 0.14, -0.91, 0.26, "z");

      // Silver MicroSD cage + Red MicroSD #1 card
      const cage = makeBox(1.18, 0.2, 1.15, celMat(0xcbd5e1), 22);
      cage.position.set(0, 0.42, -0.15);
      const sdCard = makeBox(0.92, 0.08, 0.56, celMat(0xd93829), 22);
      sdCard.position.set(0, 0.42, -0.82);
      const chip = makeBox(0.55, 0.1, 0.55, celMat(0x1d222e), 22);
      chip.position.set(0, 0.36, 0.62);
      grp.add(cage, sdCard, chip);

      dfpBusyLedMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
      const busyLed = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), dfpBusyLedMat);
      busyLed.position.set(0.42, 0.37, 0.72);
      grp.add(busyLed);

      registerInteractive(pcb, "dfplayer", "dfplayer");
      registerInteractive(cage, "dfplayer", "dfplayer");
      scene.add(grp);
    }

    // ========================================================================
    // ZONA 4 — ESCLAVO RISC-V: ESP32-C3, PROTOBOARD #2, LECTOR MICROSD SPI
    // ========================================================================

    // 12. ESP32-C3 SuperMini
    {
      const grp = new THREE.Group();
      grp.position.set(5.0, 0, -5.8);
      addGroundShadow(grp, 2.5, 3.0);

      const espTex = makeCanvasTex(224, 288, (ctx, w, h) => {
        ctx.fillStyle = "#1b212e";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = "#f4efe4";
        ctx.font = "bold 20px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("ESP32-C3", w / 2, 165);
        ctx.font = "bold 14px Consolas, monospace";
        ctx.fillStyle = "#38bdf8";
        ctx.fillText("SuperMini", w / 2, 186);
      });

      const pcb = makeBox(1.85, 0.16, 2.45, [
        celMat(0x151a25), celMat(0x151a25),
        celMat(0xffffff, { map: espTex }),
        celMat(0x121620), celMat(0x151a25), celMat(0x151a25)
      ], 24);
      pcb.position.y = 0.24;
      grp.add(pcb);

      // 2x8 headers
      addPinHeaders(grp, 8, -0.76, 0.14, -0.91, 0.26, "z");
      addPinHeaders(grp, 8,  0.76, 0.14, -0.91, 0.26, "z");

      // USB-C port at front (+Z) + Red ceramic antenna at back (-Z)
      const usbc = makeBox(0.76, 0.28, 0.56, celMat(0xd5dbe4), 22);
      usbc.position.set(0, 0.4, 1.0);
      const ant = makeBox(0.55, 0.14, 0.3, celMat(0xd93829), 22);
      ant.position.set(0, 0.37, -1.02);
      const qfn = makeBox(0.55, 0.1, 0.55, celMat(0x171b24), 22);
      qfn.position.set(0, 0.36, -0.2);
      const bootBtn = makeBox(0.24, 0.12, 0.2, celMat(0xe2e8f0), 22);
      bootBtn.position.set(-0.34, 0.37, 0.48);
      const rstBtn = makeBox(0.24, 0.12, 0.2, celMat(0xe2e8f0), 22);
      rstBtn.position.set(0.34, 0.37, 0.48);
      grp.add(usbc, ant, qfn, bootBtn, rstBtn);

      espLedMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), espLedMat);
      led.position.set(0.32, 0.36, -0.58);
      grp.add(led);

      registerInteractive(pcb, "esp32", "esp32");
      scene.add(grp);
    }

    // 13. Protoboard #2 (170 pts + Cap 100µF + Cap 100nF + Voltage Divider 3x 1kΩ)
    {
      const pb2 = makeBreadboard170("PB #2 · 170 pts", 5.0, -0.4, "pb2", "divider");
      // Cap 100µF 16V stabilizer + 100nF
      const c100u = makeElectrolyticCap(-1.45, 0.34, 0.52, 0.26, 0.72, "#19355c", "100uF");
      const c100n = makeCeramicCap104(-0.85, 0.34, 0.55, 0);
      pb2.add(c100u, c100n);

      // Divider 1k + 2k using 3x 1kΩ axial resistors (R2, R3, R4)
      const r2 = makeAxialResistor(-0.1,  0.34, -0.62, 0, "R2 1kΩ");
      const r3 = makeAxialResistor(0.75,  0.34, -0.45, 0, "R3 1kΩ");
      const r4 = makeAxialResistor(1.38,  0.34,  0.48, 0, "R4 1kΩ");
      pb2.add(r2, r3, r4);
    }

    // 14. Lector MicroSD SPI (Blue PCB + AMS1117-3.3 + MicroSD #2)
    {
      const grp = new THREE.Group();
      grp.position.set(5.0, 0, 5.4);
      addGroundShadow(grp, 2.75, 2.95);

      const sdTex = makeCanvasTex(256, 288, (ctx, w, h) => {
        ctx.fillStyle = "#1d4f91";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f4efe4";
        ctx.lineWidth = 3;
        ctx.strokeRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("MicroSD SPI", w / 2, 232);
        ctx.font = "bold 14px Consolas, monospace";
        ctx.fillStyle = "#93c5fd";
        ctx.fillText("AMS1117 · 20MHz", w / 2, 256);
      });

      const pcb = makeBox(2.2, 0.16, 2.45, [
        celMat(0x163d73), celMat(0x163d73),
        celMat(0xffffff, { map: sdTex }),
        celMat(0x133563), celMat(0x163d73), celMat(0x163d73)
      ], 24);
      pcb.position.y = 0.14;
      grp.add(pcb);

      // 6-pin header along left edge (-X)
      addPinHeaders(grp, 6, -0.92, 0.3, -0.65, 0.26, "z");

      // Silver SD Cage + Red/Dark MicroSD #2
      const cage = makeBox(1.32, 0.2, 1.35, celMat(0xcbd5e1), 22);
      cage.position.set(0.24, 0.32, -0.2);
      const sd2 = makeBox(0.95, 0.08, 0.56, celMat(0x991b1b), 22);
      sd2.position.set(0.24, 0.32, -1.0);
      const ldo = makeBox(0.45, 0.12, 0.32, celMat(0x1d222e), 22);
      ldo.position.set(-0.35, 0.26, -0.6);
      const bufIc = makeBox(0.42, 0.1, 0.48, celMat(0x1d222e), 22);
      bufIc.position.set(-0.35, 0.26, 0.2);
      grp.add(cage, sd2, ldo, bufIc);

      registerInteractive(pcb, "microsd", "microsd");
      registerInteractive(cage, "microsd", "microsd");
      scene.add(grp);
    }

    // ========================================================================
    // ZONA 5 — PANTALLA OLED 0.96" SSD1306 & 4× SENSORES TTP223
    // ========================================================================

    // 15A. Pantalla OLED 0.96" I2C (SSD1306) tilted toward viewer with live CanvasTexture!
    {
      const grp = new THREE.Group();
      grp.position.set(11.1, 0, -5.0);
      addGroundShadow(grp, 2.9, 2.2);

      // Stand base
      const standBase = makeBox(2.4, 0.18, 1.4, celMat(0x283044), 22);
      standBase.position.y = 0.09;
      grp.add(standBase);

      // Tilted PCB facing camera (+Z & slightly -X)
      const tilted = new THREE.Group();
      tilted.position.set(0, 1.08, 0.1);
      tilted.rotation.x = 0.88; // +X tilts local +Y normal directly toward +Z camera!
      tilted.rotation.y = -0.18;
      grp.add(tilted);

      const oledPcbTex = makeCanvasTex(256, 224, (ctx, w, h) => {
        ctx.fillStyle = "#1d4f91";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f4efe4";
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("VCC  GND  SCL  SDA", w / 2, 26);
      });
      const pcb = makeBox(2.5, 0.14, 2.1, [
        celMat(0x163d73), celMat(0x163d73),
        celMat(0xffffff, { map: oledPcbTex }),
        celMat(0x143563), celMat(0x163d73), celMat(0x163d73)
      ], 24);
      tilted.add(pcb);

      // 4-pin header on top edge of OLED PCB
      addPinHeaders(tilted, 4, -0.45, 0.16, -0.88, 0.3, "x");

      // Dark glass OLED bezel
      const bezel = makeBox(2.26, 0.1, 1.44, celMat(0x0b111b), 22);
      bezel.position.set(0, 0.12, 0.16);
      tilted.add(bezel);

      // Live 128x64 CanvasTexture synced from #oledCanvas
      const srcOled = document.getElementById("oledCanvas");
      if (srcOled) {
        oledTexture = new THREE.CanvasTexture(srcOled);
        oledTexture.magFilter = THREE.NearestFilter;
        oledTexture.minFilter = THREE.NearestFilter;
        oledTexture.generateMipmaps = false;
        oledMatOn = new THREE.MeshBasicMaterial({ map: oledTexture });
      } else {
        oledMatOn = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      }
      oledMatOff = new THREE.MeshBasicMaterial({ color: 0x05080d });

      oledScreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.04, 1.02), oledMatOn);
      oledScreenMesh.rotation.x = -Math.PI / 2;
      oledScreenMesh.position.set(0, 0.175, 0.16);
      tilted.add(oledScreenMesh);

      registerInteractive(pcb, "oled", "oled");
      registerInteractive(bezel, "oled", "oled");
      registerInteractive(oledScreenMesh, "oled", "oled");
      scene.add(grp);
    }

    // 15B. 4× Sensores Capacitivos TTP223 (T1..T4, clickable in 3D!)
    const ttpDefs = [
      { z: -0.5, label: "T1 PLAY/PAUSE", pin: "D2" },
      { z:  2.1, label: "T2 SIG / VOL+", pin: "D3" },
      { z:  4.7, label: "T3 ANT / VOL-", pin: "D4" },
      { z:  7.3, label: "T4 MUTE/MODO",  pin: "D5" }
    ];
    ttpDefs.forEach((td, idx) => {
      const grp = new THREE.Group();
      grp.position.set(11.1, 0, td.z);
      addGroundShadow(grp, 2.35, 2.15);

      const tTex = makeCanvasTex(224, 192, (ctx, w, h) => {
        ctx.fillStyle = "#1d4f91";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#f4efe4";
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        // Touch capacitive ring
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(w * 0.62, h * 0.5, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(147, 197, 253, 0.25)";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 17px Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText(td.label, w * 0.62, h * 0.54);
        ctx.font = "bold 14px Consolas, monospace";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("TTP223·" + td.pin, w * 0.62, 26);
      });

      const pcb = makeBox(2.0, 0.16, 1.75, [
        celMat(0x163d73), celMat(0x163d73),
        celMat(0xffffff, { map: tTex }),
        celMat(0x133563), celMat(0x163d73), celMat(0x163d73)
      ], 24);
      pcb.position.y = 0.14;
      grp.add(pcb);

      // 3-pin header (GND, VCC, SIG) on left edge (-X)
      addPinHeaders(grp, 3, -0.82, 0.26, -0.26, 0.26, "z");

      // Tiny TTP223 IC + Touch Feedback Red LED
      const ic = makeBox(0.24, 0.08, 0.24, celMat(0x1d222e), 20);
      ic.position.set(-0.4, 0.26, 0.22);
      grp.add(ic);

      const ledMat = new THREE.MeshBasicMaterial({ color: 0x5c2222 });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), ledMat);
      led.position.set(-0.42, 0.27, -0.44);
      grp.add(led);
      ttpLedMats.push(ledMat);
      ttpLedMeshes.push(led);

      registerInteractive(pcb, "ttp223", "ttp223", { action: "touchPad", padIdx: idx });
      scene.add(grp);
    });
  }

  // --------------------------------------------------------------------------
  // Build Curved 3D Wires + Animated Signal/Current Flow Spheres
  // --------------------------------------------------------------------------
  function addCurvedWire(pts, colorHex, radius = 0.032, flowCategory = null, flowCount = 1) {
    const vectors = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    const curve = new THREE.CatmullRomCurve3(vectors, false, "catmullrom", 0.35);
    const tubeGeo = new THREE.TubeGeometry(curve, 26, radius, 6, false);
    const tubeMat = celMat(colorHex);
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.raycast = function () {};
    scene.add(tubeMesh);

    // Dupont jumper boots at both endpoints
    const bootMat = celMat(0x1b202b);
    [vectors[0], vectors[vectors.length - 1]].forEach((endPt) => {
      const boot = makeBox(0.11, 0.16, 0.11, bootMat, 18);
      boot.position.copy(endPt);
      boot.raycast = function () {};
      scene.add(boot);
    });

    if (flowCategory) {
      const glowColor = new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 0.55);
      for (let i = 0; i < flowCount; i++) {
        const sp = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 2.15, 8, 8),
          new THREE.MeshBasicMaterial({ color: glowColor })
        );
        sp.raycast = function () {};
        scene.add(sp);
        flowParticles.push({
          mesh: sp,
          curve,
          category: flowCategory,
          offset: i / flowCount,
          speed: flowCategory === "spi" || flowCategory === "i2c" ? 0.45 : 0.28
        });
      }
    }
  }

  function buildAllWires() {
    const C = {
      red12:   0xd93829, // +12V_SW
      ora5:    0xf08a24, // +5.00V_REG / +5V_ESP_SD
      gnd:     0x232834, // GND
      uartDfp: 0x2563eb, // UART D10/D11 + BUSY D12
      sync:    0x4f46e5, // D6->Div->G20 & G21->D7
      spi:     0x0d9488, // SPI 20MHz GPIO4..7
      i2c:     0x7c3aed, // I2C 800kHz GPIO8..9
      crim3v3: 0xc81e4a, // 3V3 -> OLED VCC
      amber:   0xe09f1f, // T1..T4 -> D2..D5
      cyan:    0x06b6d4  // Audio DAC -> 1uF -> Pot -> PAM -> 8 Ohm
    };

    // 1. +12V_SW (Red)
    addCurvedWire([[-9.0, 0.3, -6.48], [-8.4, 0.72, -6.48], [-8.0, 0.35, -6.48]], C.red12, 0.044, "pwr", 1);
    addCurvedWire([[-7.0, 0.35, -6.45], [-6.4, 0.72, -6.45], [-5.85, 0.35, -6.3]], C.red12, 0.044, "pwr", 1);
    addCurvedWire([[-6.9, 0.32, -6.0], [-8.8, 0.78, -4.8], [-10.35, 0.3, -3.75]], C.red12, 0.044, "pwr", 1);
    addCurvedWire([[-10.4, 0.25, -3.4], [-11.5, 0.78, -0.5], [-12.0, 0.35, 1.4]], C.red12, 0.044, "pwr", 2);

    // 2. +5.00V_REG & +5V_ESP_SD (Orange)
    addCurvedWire([[-7.65, 0.3, -3.75], [-5.4, 0.85, -2.5], [-3.2, 0.42, -1.2]], C.ora5, 0.040, "pwr", 2);
    addCurvedWire([[-2.9, 0.4, -1.2], [-2.2, 0.88, -3.2], [-0.48, 0.45, -6.8]], C.ora5, 0.032, "pwr", 1);
    addCurvedWire([[-2.8, 0.4, -0.2], [-2.5, 0.85, 2.2], [-2.28, 0.45, 4.5]], C.ora5, 0.032, "pwr", 1);
    // Dupont 5V bus PB1 -> PB2 (100uF) -> ESP32 5V & MicroSD VCC
    addCurvedWire([[0.5, 0.42, -1.1], [1.9, 0.96, -1.15], [3.5, 0.42, -1.1]], C.ora5, 0.038, "pwr", 2);
    addCurvedWire([[3.6, 0.42, -1.1], [3.9, 0.92, -3.0], [4.24, 0.45, -4.9]], C.ora5, 0.032, "pwr", 1);
    addCurvedWire([[3.6, 0.42, 0.2], [3.9, 0.88, 2.4], [4.08, 0.45, 4.95]], C.ora5, 0.032, "pwr", 1);
    // +5V -> TTP223 VCC bus
    addCurvedWire([[0.5, 0.42, -0.9], [5.8, 1.15, -2.1], [10.28, 0.36, -0.5]], C.ora5, 0.028, "pwr", 2);

    // 3. GND (Charcoal/Black)
    addCurvedWire([[-9.0, 0.26, -6.1], [-7.2, 0.56, -5.8], [-5.48, 0.25, -6.1]], C.gnd, 0.042);
    addCurvedWire([[-10.35, 0.28, -2.55], [-8.0, 0.52, -2.1], [-3.2, 0.4, -0.1]], C.gnd, 0.038);
    addCurvedWire([[-7.65, 0.28, -2.55], [-5.2, 0.55, -1.4], [-3.1, 0.4, -0.4]], C.gnd, 0.038);
    addCurvedWire([[-11.8, 0.25, 1.5], [-10.0, 0.58, 0.4], [-3.2, 0.4, 0.2]], C.gnd, 0.040);
    addCurvedWire([[0.5, 0.4, 0.2], [1.9, 0.72, 0.2], [3.5, 0.4, 0.2]], C.gnd, 0.036);
    addCurvedWire([[4.24, 0.45, -5.2], [3.9, 0.72, -2.8], [3.7, 0.4, -0.2]], C.gnd, 0.030);
    addCurvedWire([[4.08, 0.45, 4.7], [3.8, 0.68, 2.2], [3.7, 0.4, 0.4]], C.gnd, 0.030);
    addCurvedWire([[10.28, 0.36, -0.76], [8.0, 0.7, -1.6], [6.5, 0.4, 0.2]], C.gnd, 0.028);

    // 4. UART D10/D11 + BUSY D12 (Blue)
    addCurvedWire([[-2.32, 0.45, -4.3], [-2.55, 0.85, -2.4], [-1.85, 0.42, -0.95]], C.uartDfp, 0.028, "uart", 1); // D11 -> R1
    addCurvedWire([[-0.9, 0.42, -0.95], [-1.2, 0.92, 2.1], [-2.28, 0.45, 4.8]], C.uartDfp, 0.028, "uart", 1);   // R1 -> DFP RX
    addCurvedWire([[-2.32, 0.45, -4.56], [-2.85, 0.95, 0.2], [-2.28, 0.45, 5.06]], C.uartDfp, 0.028, "uart", 1); // DFP TX -> D10
    addCurvedWire([[-2.32, 0.45, -4.04], [-0.2, 0.98, 0.4], [-0.52, 0.45, 4.5]], C.uartDfp, 0.028, "audio", 1);  // BUSY -> D12

    // 5. Sync Dual-MCU D6 -> Div 1k+2k -> GPIO20 & GPIO21 -> D7 (Indigo)
    addCurvedWire([[-2.32, 0.45, -5.6], [1.4, 1.25, -3.5], [4.4, 0.42, -1.05]], C.sync, 0.030, "uart", 2);  // D6 -> Div R2
    addCurvedWire([[5.45, 0.42, -0.95], [5.85, 0.95, -2.8], [5.76, 0.45, -4.7]], C.sync, 0.030, "uart", 1); // Div -> GPIO20
    addCurvedWire([[5.76, 0.45, -4.45], [1.8, 1.38, -5.2], [-2.32, 0.45, -5.34]], C.sync, 0.028, "uart", 2); // GPIO21 -> D7

    // 6. SPI 20MHz GPIO4..7 (Teal)
    const spiOffsets = [-0.55, -0.25, 0.05, 0.35];
    spiOffsets.forEach((dz, i) => {
      addCurvedWire(
        [[4.24, 0.45, -6.5 + i * 0.26], [3.15 - i * 0.14, 0.95 + i * 0.08, -0.3], [4.08, 0.45, 5.2 + dz]],
        C.spi,
        0.026,
        "spi",
        1
      );
    });

    // 7. I2C 800kHz GPIO8..9 (Purple) + 3V3 -> OLED VCC (Crimson)
    addCurvedWire([[5.76, 0.45, -6.2], [8.2, 1.32, -6.2], [11.2, 1.85, -5.65]], C.i2c, 0.028, "i2c", 1);
    addCurvedWire([[5.76, 0.45, -5.94], [8.3, 1.44, -5.9], [11.45, 1.85, -5.65]], C.i2c, 0.028, "i2c", 1);
    addCurvedWire([[5.76, 0.45, -5.15], [8.0, 1.22, -5.3], [10.65, 1.85, -5.65]], C.crim3v3, 0.030, "pwr", 1);

    // 8. Touch TTP223 T1..T4 -> Nano D2..D5 (Amber)
    const ttpZ = [-0.5, 2.1, 4.7, 7.3];
    const nanoPinsZ = [-6.65, -6.39, -6.13, -5.87];
    ttpZ.forEach((tz, i) => {
      addCurvedWire(
        [[10.28, 0.36, tz + 0.26], [4.6, 1.38 + i * 0.12, tz * 0.28 - 2.6], [-2.32, 0.45, nanoPinsZ[i]]],
        C.amber,
        0.025,
        "touch",
        1
      );
    });

    // 9. Audio DAC -> 2x 1µF -> Pot 10kΩ -> PAM8610 -> 2x Parlantes 8Ω (Cyan)
    addCurvedWire([[-2.28, 0.45, 5.55], [-0.9, 0.88, 2.9], [-0.45, 0.42, 0.2]], C.cyan, 0.030, "audio", 1);
    addCurvedWire([[-2.28, 0.45, 5.82], [-0.4, 0.96, 3.1], [0.15, 0.42, 0.2]], C.cyan, 0.030, "audio", 1);
    // 1uF -> Pot 10kΩ
    addCurvedWire([[-0.15, 0.42, 0.55], [-3.8, 0.92, 1.5], [-7.3, 0.32, 2.75]], C.cyan, 0.030, "audio", 1);
    addCurvedWire([[0.35, 0.42, 0.55], [-3.7, 1.02, 1.8], [-7.6, 0.32, 2.75]], C.cyan, 0.030, "audio", 1);
    // Pot 10kΩ -> PAM8610 IN_L / IN_R
    addCurvedWire([[-7.9, 0.32, 1.65], [-9.0, 0.72, 1.8], [-10.05, 0.35, 1.95]], C.cyan, 0.032, "audio", 1);
    addCurvedWire([[-7.6, 0.32, 1.65], [-8.9, 0.80, 2.1], [-10.05, 0.35, 2.45]], C.cyan, 0.032, "audio", 1);
    // PAM8610 BTL OUTL+/OUTL- -> Speaker L, OUTR+/OUTR- -> Speaker R
    addCurvedWire([[-11.72, 0.48, 3.35], [-12.0, 0.65, 4.4], [-11.8, 0.42, 5.2]], C.cyan, 0.036, "audio", 1);
    addCurvedWire([[-10.72, 0.48, 3.35], [-10.6, 0.65, 4.4], [-7.9, 0.42, 5.2]], C.cyan, 0.036, "audio", 1);
  }

  // --------------------------------------------------------------------------
  // Camera Controller, Tweening, Callouts Projection & Minimap Sync
  // --------------------------------------------------------------------------
  function updateCameraFromSpherical() {
    const sinPhi = Math.sin(camCtrl.phi);
    const cosPhi = Math.cos(camCtrl.phi);
    const sinTheta = Math.sin(camCtrl.theta);
    const cosTheta = Math.cos(camCtrl.theta);

    camera.position.set(
      camCtrl.lookAt.x + camCtrl.radius * sinPhi * sinTheta,
      camCtrl.lookAt.y + camCtrl.radius * cosPhi,
      camCtrl.lookAt.z + camCtrl.radius * sinPhi * cosTheta
    );
    camera.lookAt(camCtrl.lookAt);
  }

  function isFloatingInspectorVisible() {
    if (window.innerWidth <= 1120) return false;
    if (document.body.classList.contains("inspector-collapsed")) return false;
    if (stageWrap && stageWrap.classList.contains("is-fullscreen")) return false;
    const inspEl = document.getElementById("floatingInspector");
    return Boolean(inspEl && inspEl.offsetWidth > 0);
  }

  function getAdjustedTargetX(baseX, zoneId) {
    if (!isFloatingInspectorVisible()) return baseX;
    return baseX + (zoneId === "all" ? 3.3 : 1.9);
  }

  function getAdjustedRadius(baseRadius, zoneId) {
    if (zoneId === "all" && isFloatingInspectorVisible()) return 36.8;
    return baseRadius;
  }

  function applyZonePreset(zoneId) {
    const p = ZONE_PRESETS[zoneId] || ZONE_PRESETS.all;
    state.activeZone = zoneId;
    const isNarrow = stageWrap && stageWrap.clientWidth < 540;
    camCtrl.goalTheta = p.theta;
    camCtrl.goalPhi = p.phi;
    camCtrl.goalRadius = zoneId === "all" && isNarrow ? 48.0 : getAdjustedRadius(p.radius, zoneId);
    camCtrl.goalLookAt.set(getAdjustedTargetX(p.target[0], zoneId), p.target[1], p.target[2]);

    document.querySelectorAll("#zoneChips .zone-chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.zone === zoneId);
    });

    const ovCard = document.getElementById("schematicOverlayCard");
    if (ovCard) {
      ovCard.classList.toggle("left-side", zoneId === "z5");
    }

    const primaryNode = ZONE_PRIMARY_NODE[zoneId];
    if (primaryNode) {
      state.activeNode = primaryNode;
      if (window.AmarilisBridge && typeof window.AmarilisBridge.onSelectNodeFrom3D === "function") {
        window.AmarilisBridge.onSelectNodeFrom3D(primaryNode);
      }
    }
  }

  function focusAssembly(assemblyId, nodeId) {
    if (nodeId) state.activeNode = nodeId;
    const tgt = ASSEMBLY_TARGETS[assemblyId];
    if (!tgt) return;
    state.activeZone = tgt.zone;
    camCtrl.goalLookAt.set(getAdjustedTargetX(tgt.pos[0], tgt.zone), tgt.pos[1], tgt.pos[2]);
    camCtrl.goalRadius = tgt.radius;
    camCtrl.goalPhi = 0.74;
    camCtrl.goalTheta = ZONE_PRESETS[tgt.zone].theta;

    document.querySelectorAll("#zoneChips .zone-chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.zone === tgt.zone);
    });
  }

  // Project 3D anchor points -> 2D SVG leaders + collision-avoided cards
  function updateCalloutsAndMinimap() {
    if (!stageWrap || !calloutSvg || !calloutCardsLayer) return;
    const W = stageWrap.clientWidth;
    const H = stageWrap.clientHeight;
    if (W < 40 || H < 40) return;

    // Update Minimap Reticle
    if (minimapReticle) {
      const mx = Math.max(10, Math.min(120, ((camCtrl.lookAt.x + 14) / 28) * 116 + 7));
      const my = Math.max(10, Math.min(74, ((camCtrl.lookAt.z + 9) / 18) * 70 + 7));
      const deg = (camCtrl.theta * 180) / Math.PI;
      minimapReticle.setAttribute("transform", `translate(${mx.toFixed(1)}, ${my.toFixed(1)}) rotate(${deg.toFixed(1)})`);
    }

    if (!state.labelsVisible) return;

    const activeDefs = CALLOUT_DEFS.filter((d) =>
      state.activeZone === "all" ? d.mode === "all" : d.mode === state.activeZone
    );

    // Hide cards not in current mode
    calloutCardMap.forEach((el, id) => {
      if (!activeDefs.some((d) => d.id === id)) {
        el.style.display = "none";
      }
    });

    const isMobile = W <= 540;
    const items = [];
    const vec = new THREE.Vector3();

    activeDefs.forEach((d) => {
      vec.set(d.anchor[0], d.anchor[1], d.anchor[2]);
      vec.project(camera);
      const sx = (vec.x * 0.5 + 0.5) * W;
      const sy = (-vec.y * 0.5 + 0.5) * H;
      if (vec.z > 1 || sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) {
        const el = calloutCardMap.get(d.id);
        if (el) el.style.display = "none";
        return;
      }

      let cardEl = calloutCardMap.get(d.id);
      if (!cardEl) {
        cardEl = document.createElement("button");
        cardEl.type = "button";
        cardEl.className = "callout-card";
        cardEl.innerHTML = `
          <span class="callout-icon">${d.icon}</span>
          <span class="callout-text">
            <span class="callout-title">${d.title}</span>
            <span class="callout-sub">${d.sub}</span>
          </span>`;
        cardEl.addEventListener("click", (ev) => {
          ev.stopPropagation();
          selectComponent(d.assembly, d.node, true);
        });
        calloutCardsLayer.appendChild(cardEl);
        calloutCardMap.set(d.id, cardEl);
      }

      cardEl.style.display = "flex";
      cardEl.classList.toggle("compact", state.activeZone === "all" || isMobile);
      cardEl.classList.toggle("active", d.node === state.activeNode);

      const cw = cardEl.offsetWidth || 150;
      const ch = cardEl.offsetHeight || 40;
      const ox = isMobile ? d.offset[0] * 0.55 : d.offset[0];
      const oy = isMobile ? d.offset[1] * 0.55 : d.offset[1];
      let cx = sx + ox - cw / 2;
      let cy = sy + oy - ch / 2;

      items.push({ d, sx, sy, cx, cy, cw, ch, cardEl });
    });

    // Clamp to safe inner bounds (away from top HUD bar, open schematic overlay, minimap, and viewbar)
    const topHud = stageWrap.querySelector(".stage-top-hud");
    const topSafe = topHud ? topHud.offsetTop + topHud.offsetHeight + 6 : (isMobile ? 64 : 48);
    const botSafe = H - (isMobile ? 48 : 54);
    const mmRight = isMobile ? 92 : 136;
    const mmTop = H - (isMobile ? 104 : 96);

    const ovCard = document.getElementById("schematicOverlayCard");
    let ovBox = null;
    if (ovCard && !ovCard.hidden && ovCard.offsetWidth > 0) {
      ovBox = {
        left: ovCard.offsetLeft - 6,
        top: ovCard.offsetTop - 6,
        right: ovCard.offsetLeft + ovCard.offsetWidth + 8,
        bottom: ovCard.offsetTop + ovCard.offsetHeight + 8
      };
    }

    let inspBox = null;
    if (isFloatingInspectorVisible()) {
      const inspEl = document.getElementById("floatingInspector");
      const stRect = stageWrap.getBoundingClientRect();
      const inRect = inspEl.getBoundingClientRect();
      inspBox = {
        left: inRect.left - stRect.left - 10,
        top: inRect.top - stRect.top - 8,
        right: inRect.right - stRect.left + 8,
        bottom: inRect.bottom - stRect.top + 8
      };
    }

    function clampItem(it) {
      const maxX = inspBox ? Math.min(W - it.cw - 8, inspBox.left - it.cw) : W - it.cw - 8;
      it.cx = Math.max(8, Math.min(Math.max(8, maxX), it.cx));
      it.cy = Math.max(topSafe, Math.min(botSafe - it.ch, it.cy));
      // Avoid bottom-left minimap box
      if (it.cx < mmRight && it.cy + it.ch > mmTop) {
        if (mmTop - it.ch >= topSafe) it.cy = mmTop - it.ch - 4;
        else it.cx = mmRight + 6;
      }
      // Avoid open 2D schematic overlay card
      if (ovBox && it.cx < ovBox.right && it.cx + it.cw > ovBox.left && it.cy < ovBox.bottom && it.cy + it.ch > ovBox.top) {
        if (ovBox.left < W / 2) {
          if (ovBox.right + it.cw + 8 <= (inspBox ? inspBox.left : W)) it.cx = ovBox.right;
          else it.cy = Math.min(botSafe - it.ch, ovBox.bottom);
        } else {
          if (ovBox.left - it.cw >= 8) it.cx = ovBox.left - it.cw;
          else it.cy = Math.min(botSafe - it.ch, ovBox.bottom);
        }
      }
      // Avoid bottom-center viewbar (centered in stage)
      const vbHalf = isMobile ? 138 : 185;
      if (it.cx + it.cw > W / 2 - vbHalf && it.cx < W / 2 + vbHalf && it.cy + it.ch > H - 48) {
        it.cy = H - 52 - it.ch;
      }
    }

    items.forEach(clampItem);

    // Lightweight 2D collision push-apart passes
    for (let iter = 0; iter < 5; iter++) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const overlapX = Math.min(a.cx + a.cw + 6, b.cx + b.cw + 6) - Math.max(a.cx - 6, b.cx - 6);
          const overlapY = Math.min(a.cy + a.ch + 6, b.cy + b.ch + 6) - Math.max(a.cy - 6, b.cy - 6);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapY < overlapX) {
              const push = overlapY * 0.55;
              if (a.cy <= b.cy) { a.cy -= push; b.cy += push; }
              else { a.cy += push; b.cy -= push; }
            } else {
              const push = overlapX * 0.55;
              if (a.cx <= b.cx) { a.cx -= push; b.cx += push; }
              else { a.cx += push; b.cx -= push; }
            }
            clampItem(a);
            clampItem(b);
          }
        }
      }
    }

    // Draw SVG dashed leaders + hotspot dots and position cards
    let svgHtml = "";
    items.forEach((it) => {
      it.cardEl.style.transform = `translate3d(${it.cx.toFixed(1)}px, ${it.cy.toFixed(1)}px, 0)`;
      const cardMidX = it.cx + it.cw / 2;
      const cardMidY = it.cy + it.ch / 2;
      const isActive = it.d.node === state.activeNode ? "active" : "";
      svgHtml += `
        <line class="callout-leader ${isActive}" x1="${it.sx.toFixed(1)}" y1="${it.sy.toFixed(1)}" x2="${cardMidX.toFixed(1)}" y2="${cardMidY.toFixed(1)}" />
        <circle class="callout-hotspot-ring ${isActive}" cx="${it.sx.toFixed(1)}" cy="${it.sy.toFixed(1)}" r="7" />
        <circle class="callout-hotspot-core ${isActive}" cx="${it.sx.toFixed(1)}" cy="${it.sy.toFixed(1)}" r="3.6" />
      `;
    });
    calloutSvg.innerHTML = svgHtml;
  }

  // --------------------------------------------------------------------------
  // Hardware Interaction Dispatchers (Sync with script.js Simulator & Info Card)
  // --------------------------------------------------------------------------
  function selectComponent(assemblyId, nodeId, shouldFocus = true) {
    if (nodeId) {
      state.activeNode = nodeId;
      if (window.AmarilisBridge && typeof window.AmarilisBridge.onSelectNodeFrom3D === "function") {
        window.AmarilisBridge.onSelectNodeFrom3D(nodeId);
      }
    }
    if (shouldFocus && assemblyId) {
      focusAssembly(assemblyId, nodeId);
    }
  }

  function togglePower(forceVal) {
    state.powerOn = typeof forceVal === "boolean" ? forceVal : !state.powerOn;
    const pill = document.getElementById("btnPower3d");
    const txt = document.getElementById("powerPillText");
    if (pill && txt) {
      pill.classList.toggle("off", !state.powerOn);
      txt.textContent = state.powerOn ? "KCD1: ON · 12V" : "KCD1: OFF · 0V";
    }
    if (kcd1RockerGroup) {
      kcd1RockerGroup.rotation.z = state.powerOn ? -0.24 : 0.24;
    }
    if (oledScreenMesh) {
      oledScreenMesh.material = state.powerOn ? oledMatOn : oledMatOff;
    }
    if (window.AmarilisBridge && typeof window.AmarilisBridge.onPowerChangeFrom3D === "function") {
      window.AmarilisBridge.onPowerChangeFrom3D(state.powerOn);
    }
  }

  function triggerTouchPad(padIdx) {
    state.ttpFlashUntil[padIdx] = performance.now() + 340;
    if (!state.powerOn) return;
    if (window.AmarilisBridge && typeof window.AmarilisBridge.onTouchPadFrom3D === "function") {
      window.AmarilisBridge.onTouchPadFrom3D(padIdx);
    }
  }

  function stepPotVolume() {
    if (!state.powerOn) return;
    if (window.AmarilisBridge && typeof window.AmarilisBridge.onPotStepFrom3D === "function") {
      window.AmarilisBridge.onPotStepFrom3D();
    }
  }

  function syncPotKnobVisual() {
    if (!potKnobGroup) return;
    // Map vol 6..30 -> -125 deg .. +125 deg
    const norm = Math.max(0, Math.min(1, (state.vol - 6) / 24));
    potKnobGroup.rotation.y = (0.5 - norm) * 4.2;
  }

  function handleCanvasClick(clientX, clientY) {
    if (!renderer || !camera) return;
    const rect = canvasEl.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveMeshes, false);
    if (!hits.length) return;

    const ud = hits[0].object.userData;
    if (ud.action === "togglePower") {
      togglePower();
      selectComponent(ud.assemblyId, ud.nodeId, false);
    } else if (ud.action === "touchPad") {
      triggerTouchPad(ud.padIdx);
      selectComponent(ud.assemblyId, ud.nodeId, false);
    } else if (ud.action === "stepVol") {
      stepPotVolume();
      selectComponent(ud.assemblyId, ud.nodeId, false);
    } else {
      selectComponent(ud.assemblyId, ud.nodeId, true);
    }
  }

  function setupPointerAndControls() {
    // Pointer Orbit / Pan / Click
    canvasEl.addEventListener("pointerdown", (e) => {
      camCtrl.dragging = true;
      camCtrl.panning = e.button === 2 || e.shiftKey;
      camCtrl.startX = e.clientX;
      camCtrl.startY = e.clientY;
      camCtrl.lastX = e.clientX;
      camCtrl.lastY = e.clientY;
      camCtrl.movedDist = 0;
      canvasEl.setPointerCapture(e.pointerId);
    });

    canvasEl.addEventListener("pointermove", (e) => {
      if (!camCtrl.dragging) {
        // Hover cursor check
        const rect = canvasEl.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObjects(interactiveMeshes, false);
        canvasEl.style.cursor = hits.length ? "pointer" : "grab";
        return;
      }

      const dx = e.clientX - camCtrl.lastX;
      const dy = e.clientY - camCtrl.lastY;
      camCtrl.movedDist += Math.hypot(dx, dy);
      camCtrl.lastX = e.clientX;
      camCtrl.lastY = e.clientY;

      if (camCtrl.panning) {
        const panScale = camCtrl.radius * 0.0014;
        const cosT = Math.cos(camCtrl.theta);
        const sinT = Math.sin(camCtrl.theta);
        camCtrl.goalLookAt.x = Math.max(-14, Math.min(14, camCtrl.goalLookAt.x - (dx * cosT + dy * sinT) * panScale));
        camCtrl.goalLookAt.z = Math.max(-9, Math.min(9, camCtrl.goalLookAt.z - (-dx * sinT + dy * cosT) * panScale));
      } else {
        camCtrl.goalTheta -= dx * 0.0075;
        camCtrl.goalPhi = Math.max(0.22, Math.min(1.32, camCtrl.goalPhi - dy * 0.0065));
      }
    });

    canvasEl.addEventListener("pointerup", (e) => {
      if (!camCtrl.dragging) return;
      camCtrl.dragging = false;
      try { canvasEl.releasePointerCapture(e.pointerId); } catch (_) {}
      if (camCtrl.movedDist < 6) {
        handleCanvasClick(e.clientX, e.clientY);
      }
    });

    canvasEl.addEventListener("contextmenu", (e) => e.preventDefault());

    canvasEl.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        camCtrl.goalRadius = Math.max(7.5, Math.min(58, camCtrl.goalRadius + e.deltaY * 0.016));
      },
      { passive: false }
    );

    // Zone chips
    document.querySelectorAll("#zoneChips .zone-chip").forEach((btn) => {
      btn.addEventListener("click", () => applyZonePreset(btn.dataset.zone));
    });

    // Minimap zone click
    document.querySelectorAll("#minimapSvg .mm-zone").forEach((g) => {
      g.addEventListener("click", () => applyZonePreset(g.dataset.mmzone));
    });

    // Power pill
    document.getElementById("btnPower3d")?.addEventListener("click", () => togglePower());

    // Viewbar buttons
    document.getElementById("btnCamRotL")?.addEventListener("click", () => {
      camCtrl.goalTheta -= 0.42;
    });
    document.getElementById("btnCamRotR")?.addEventListener("click", () => {
      camCtrl.goalTheta += 0.42;
    });
    document.getElementById("btnCamZoomOut")?.addEventListener("click", () => {
      camCtrl.goalRadius = Math.min(58, camCtrl.goalRadius + 3.2);
    });
    document.getElementById("btnCamZoomIn")?.addEventListener("click", () => {
      camCtrl.goalRadius = Math.max(7.5, camCtrl.goalRadius - 3.2);
    });
    document.getElementById("btnCamReset")?.addEventListener("click", () => {
      applyZonePreset("all");
    });

    const btnFlow = document.getElementById("btnToggleFlow3d");
    btnFlow?.addEventListener("click", () => {
      setFlowEnabled(!state.flowEnabled, true);
    });

    const btnLabels = document.getElementById("btnToggleLabels3d");
    btnLabels?.addEventListener("click", () => {
      state.labelsVisible = !state.labelsVisible;
      btnLabels.classList.toggle("active", state.labelsVisible);
      btnLabels.setAttribute("aria-pressed", String(state.labelsVisible));
      stageWrap.classList.toggle("labels-hidden", !state.labelsVisible);
    });

    const btnSch = document.getElementById("btnToggleSchematic3d");
    const ovCard = document.getElementById("schematicOverlayCard");
    function setOverlay(open) {
      state.schematicOverlayOpen = open;
      if (ovCard) ovCard.hidden = !open;
      btnSch?.classList.toggle("active", open);
      btnSch?.setAttribute("aria-pressed", String(open));
    }
    btnSch?.addEventListener("click", () => setOverlay(!state.schematicOverlayOpen));
    document.getElementById("btnSchOvClose")?.addEventListener("click", () => setOverlay(false));
    document.getElementById("btnSchOvExpand")?.addEventListener("click", () => {
      if (window.AmarilisBridge && typeof window.AmarilisBridge.openFritzingLightbox === "function") {
        window.AmarilisBridge.openFritzingLightbox();
      }
    });

    // Floating Inspector Drawer Toggle
    const btnTogInsp = document.getElementById("btnToggleInspector");
    const btnCloseInsp = document.getElementById("btnCloseInspector");
    const inspGlyph = document.getElementById("inspectorToggleGlyph");

    function setInspectorOpen(open) {
      document.body.classList.toggle("inspector-collapsed", !open);
      if (btnTogInsp) btnTogInsp.setAttribute("aria-expanded", String(open));
      if (inspGlyph) inspGlyph.textContent = open ? "▸" : "◂";
      const preset = ZONE_PRESETS[state.activeZone] || ZONE_PRESETS.all;
      camCtrl.goalLookAt.x = getAdjustedTargetX(preset.target[0], state.activeZone);
      camCtrl.goalRadius = getAdjustedRadius(preset.radius, state.activeZone);
      setTimeout(updateCalloutsAndMinimap, 80);
    }

    btnTogInsp?.addEventListener("click", () => {
      const currentlyOpen = !document.body.classList.contains("inspector-collapsed");
      setInspectorOpen(!currentlyOpen);
    });
    btnCloseInsp?.addEventListener("click", () => setInspectorOpen(false));

    // Fullscreen 3D Toggle (Native Fullscreen API + CSS Fallback)
    const btnFs = document.getElementById("btnFullscreen3d");
    function syncFullscreenState(isFs) {
      stageWrap.classList.toggle("is-fullscreen", isFs);
      if (btnFs) {
        btnFs.classList.toggle("active", isFs);
        btnFs.setAttribute("aria-pressed", String(isFs));
      }
      const preset = ZONE_PRESETS[state.activeZone] || ZONE_PRESETS.all;
      camCtrl.goalLookAt.x = getAdjustedTargetX(preset.target[0], state.activeZone);
      camCtrl.goalRadius = getAdjustedRadius(preset.radius, state.activeZone);
      setTimeout(() => {
        resizeRenderer();
        updateCalloutsAndMinimap();
      }, 60);
    }

    btnFs?.addEventListener("click", () => {
      const cssFs = stageWrap.classList.contains("is-fullscreen");
      if (document.fullscreenElement === stageWrap) {
        document.exitFullscreen().catch(() => syncFullscreenState(false));
      } else if (cssFs) {
        syncFullscreenState(false);
      } else if (stageWrap.requestFullscreen) {
        stageWrap.requestFullscreen().catch(() => syncFullscreenState(true));
      } else {
        syncFullscreenState(true);
      }
    });

    document.addEventListener("fullscreenchange", () => {
      syncFullscreenState(document.fullscreenElement === stageWrap);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && stageWrap.classList.contains("is-fullscreen") && !document.fullscreenElement) {
        syncFullscreenState(false);
      }
    });

    // Resize canvas cleanly after sidebar collapse transition
    document.getElementById("sidebarCollapseBtn")?.addEventListener("click", () => {
      setTimeout(resizeRenderer, 240);
    });
  }

  function setFlowEnabled(enabled, notifySidebar = false) {
    state.flowEnabled = Boolean(enabled);
    const btnFlow = document.getElementById("btnToggleFlow3d");
    if (btnFlow) {
      btnFlow.classList.toggle("active", state.flowEnabled);
      btnFlow.setAttribute("aria-pressed", String(state.flowEnabled));
    }
    if (notifySidebar && window.AmarilisBridge && typeof window.AmarilisBridge.onFlowChangeFrom3D === "function") {
      window.AmarilisBridge.onFlowChangeFrom3D(state.flowEnabled);
    }
  }

  // --------------------------------------------------------------------------
  // Animation Loop (60 FPS Camera Lerp, OLED Refresh, Speaker Vibration, Flow)
  // --------------------------------------------------------------------------
  function resizeRenderer() {
    if (!renderer || !stageWrap || !camera) return;
    const w = stageWrap.clientWidth || 640;
    const h = stageWrap.clientHeight || 480;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function animate(now) {
    requestAnimationFrame(animate);
    if (!renderer || !scene || !camera) return;

    // Smooth camera lerp
    const k = 0.12;
    camCtrl.theta += (camCtrl.goalTheta - camCtrl.theta) * k;
    camCtrl.phi += (camCtrl.goalPhi - camCtrl.phi) * k;
    camCtrl.radius += (camCtrl.goalRadius - camCtrl.radius) * k;
    camCtrl.lookAt.lerp(camCtrl.goalLookAt, k);
    updateCameraFromSpherical();

    // Sync OLED CanvasTexture
    if (oledTexture && state.powerOn && now - state.lastOledRefresh > 30) {
      oledTexture.needsUpdate = true;
      state.lastOledRefresh = now;
    }

    // Dynamic LEDs respecting KCD1 power switch
    const pwr = state.powerOn;
    const playing = pwr && state.playState === "PLAYING";
    const audioActive = playing && !state.muted;

    if (kcd1LedMat) kcd1LedMat.color.setHex(pwr ? 0x22c55e : 0x3b1515);
    if (lm2596LedMat) lm2596LedMat.color.setHex(pwr ? 0xef4444 : 0x301818);
    if (pamLedMat) pamLedMat.color.setHex(pwr ? 0x22c55e : 0x16291d);
    if (nanoPwrLedMat) nanoPwrLedMat.color.setHex(pwr ? 0x22c55e : 0x16291d);

    const txPulse = pwr && (now < state.txFlashUntil || (playing && Math.sin(now * 0.025) > 0.72));
    if (nanoTxLedMat) nanoTxLedMat.color.setHex(txPulse ? 0xfbbf24 : 0x3f2f12);
    if (nanoRxLedMat) nanoRxLedMat.color.setHex(txPulse ? 0x38bdf8 : 0x152b3b);
    if (dfpBusyLedMat) dfpBusyLedMat.color.setHex(playing ? 0x3b82f6 : 0x18253d);
    if (espLedMat) espLedMat.color.setHex(pwr ? (playing && Math.sin(now * 0.02) > 0.3 ? 0x60a5fa : 0x1d4ed8) : 0x151e30);

    for (let i = 0; i < 4; i++) {
      if (ttpLedMats[i]) {
        const lit = pwr && now < state.ttpFlashUntil[i];
        ttpLedMats[i].color.setHex(lit ? 0xff3b30 : 0x451a1a);
      }
    }

    // Speaker cone vibration when playing audio
    const vibAmp = audioActive ? 0.032 * (state.vol / 30) : 0;
    const vibOffset = audioActive ? Math.sin(now * 0.048) * vibAmp : 0;
    speakerCones.forEach((coneGrp) => {
      coneGrp.position.y = 0.25 + vibOffset;
    });

    // Current & Signal Flow Particles
    const tSec = now * 0.001;
    flowParticles.forEach((fp) => {
      let active = state.powerOn && state.flowEnabled;
      if (fp.category === "audio") active = active && audioActive;
      else if (fp.category === "spi" || fp.category === "i2c") active = active && (state.playState === "PLAYING" || state.playState === "PAUSED");

      fp.mesh.visible = active;
      if (active) {
        const u = (tSec * fp.speed + fp.offset) % 1;
        const pt = fp.curve.getPointAt(u);
        fp.mesh.position.copy(pt);
      }
    });

    renderer.render(scene, camera);
    updateCalloutsAndMinimap();
  }

  // --------------------------------------------------------------------------
  // Bootstrap Scene & Expose Public API
  // --------------------------------------------------------------------------
  function init() {
    stageWrap = document.getElementById("stage3dWrap");
    canvasEl = document.getElementById("workbench3d");
    calloutSvg = document.getElementById("calloutSvg");
    calloutCardsLayer = document.getElementById("calloutCardsLayer");
    minimapReticle = document.getElementById("minimapReticle");
    const fallbackEl = document.getElementById("stageFallback");

    if (!stageWrap || !canvasEl || typeof THREE === "undefined") {
      if (fallbackEl) fallbackEl.hidden = false;
      return;
    }

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(PARCHMENT_HEX, 1);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(PARCHMENT_HEX);

      const w = stageWrap.clientWidth || 700;
      const h = stageWrap.clientHeight || 468;
      if (w < 540) {
        camCtrl.radius = 48.0;
        camCtrl.goalRadius = 48.0;
      } else {
        const initX = getAdjustedTargetX(ZONE_PRESETS.all.target[0], "all");
        const initR = getAdjustedRadius(ZONE_PRESETS.all.radius, "all");
        camCtrl.lookAt.x = initX;
        camCtrl.goalLookAt.x = initX;
        camCtrl.radius = initR;
        camCtrl.goalRadius = initR;
      }
      camera = new THREE.PerspectiveCamera(34, w / h, 0.2, 140);
      updateCameraFromSpherical();

      // Clean warm blueprint lighting
      scene.add(new THREE.AmbientLight(0xfff9ef, 0.72));
      scene.add(new THREE.HemisphereLight(0xfffdf7, 0xd8cab3, 0.45));
      const keyLight = new THREE.DirectionalLight(0xfffaf0, 0.85);
      keyLight.position.set(14, 24, 16);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.24);
      rimLight.position.set(-14, 12, -12);
      scene.add(rimLight);

      createWorkbenchFloor();
      buildAllAssemblies();
      buildAllWires();
      syncPotKnobVisual();
      setupPointerAndControls();
      resizeRenderer();

      window.addEventListener("resize", resizeRenderer);
      if ("ResizeObserver" in window) {
        new ResizeObserver(resizeRenderer).observe(stageWrap);
      }

      state.initialized = true;
      state.webglOk = true;
      if (fallbackEl) fallbackEl.hidden = true;

      // Render first frame synchronously + start animation loop
      renderer.render(scene, camera);
      updateCalloutsAndMinimap();
      requestAnimationFrame(animate);
    } catch (err) {
      state.webglOk = false;
      if (fallbackEl) fallbackEl.hidden = false;
      if (window.console) console.warn("WebGL fallback activated:", err);
    }
  }

  window.Amarilis3D = {
    init,
    focusZone: applyZonePreset,
    focusNode(nodeId, assemblyId) {
      const targetAsm = assemblyId || NODE_TO_ASSEMBLY[nodeId] || "nano";
      if (nodeId) state.activeNode = nodeId;
      focusAssembly(targetAsm, nodeId);
    },
    setPower(isOn) {
      togglePower(Boolean(isOn));
    },
    getPower() {
      return state.powerOn;
    },
    setFlowEnabled(enabled) {
      setFlowEnabled(enabled, false);
    },
    setVolume(vol) {
      state.vol = vol;
      syncPotKnobVisual();
    },
    setPlaybackState(info) {
      if (info.state) state.playState = info.state;
      if (typeof info.muted === "boolean") state.muted = info.muted;
      if (typeof info.vol === "number") {
        state.vol = info.vol;
        syncPotKnobVisual();
      }
      state.txFlashUntil = performance.now() + 220;
    },
    flashTouchPad(padIdx) {
      if (padIdx >= 0 && padIdx < 4) {
        state.ttpFlashUntil[padIdx] = performance.now() + 340;
      }
    },
    notifyUartActivity() {
      state.txFlashUntil = performance.now() + 180;
    },
    getDiagnostics() {
      return {
        initialized: state.initialized,
        webglOk: state.webglOk,
        powerOn: state.powerOn,
        activeZone: state.activeZone,
        activeNode: state.activeNode,
        interactiveCount: interactiveMeshes.length,
        flowParticles: flowParticles.length
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
