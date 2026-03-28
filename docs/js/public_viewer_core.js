import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { createCreateModeStateCodec } from "./create_mode_state.js";

const RUNTIME_MAP_DB_NAME = "train-editmode-runtime-map";
const RUNTIME_MAP_STORE_NAME = "runtimeMaps";
const RUNTIME_MAP_RECORD_KEY = "public-selected-map";

export function createPublicViewerShell({
  canvas,
  loadingOverlay,
  loadingText,
  loadingBarFill,
  cameraStorageKey = "train_public_viewer_camera_v1",
}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);

  let constructionFixedEnvMap = null;
  const constructionFixedEnvMaterials = new Set();
  const keys = Object.create(null);
  const pitchLimit = Math.PI / 2 - 0.1;
  const rotateSpeed = 0.03;

  let cameraAngleY = Math.PI;
  let cameraAngleX = -30 * Math.PI / 180;
  let baseSpeed = 0.1;
  let moveVectorX = 0;
  let moveVectorZ = 0;

  let draggingView = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let cameraViewLastSaveAt = 0;
  let cameraViewLastSerialized = "";
  let topNoticeHideTimer = null;

  function ensureTopNoticeElement() {
    let el = document.getElementById("top-notice-banner");
    if (el) {
      return el;
    }
    el = document.createElement("div");
    el.id = "top-notice-banner";
    el.setAttribute("aria-live", "polite");
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.top = "14px";
    el.style.transform = "translate(-50%, -24px)";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.style.zIndex = "2147483647";
    el.style.minWidth = "220px";
    el.style.maxWidth = "min(92vw, 760px)";
    el.style.padding = "10px 14px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(17, 28, 45, 0.92)";
    el.style.border = "1px solid rgba(157, 195, 255, 0.45)";
    el.style.color = "#eaf3ff";
    el.style.fontSize = "12px";
    el.style.lineHeight = "1.45";
    el.style.whiteSpace = "pre-wrap";
    el.style.boxShadow = "0 12px 26px rgba(0, 0, 0, 0.35)";
    el.style.backdropFilter = "blur(6px)";
    el.style.transition = "opacity 220ms ease, transform 220ms ease";
    document.body.appendChild(el);
    return el;
  }

  function showTopNotice(message, durationMs = 2600) {
    const el = ensureTopNoticeElement();
    el.textContent = String(message ?? "");
    if (topNoticeHideTimer) {
      clearTimeout(topNoticeHideTimer);
      topNoticeHideTimer = null;
    }
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translate(-50%, 0)";
    });
    topNoticeHideTimer = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translate(-50%, -24px)";
      topNoticeHideTimer = null;
    }, Math.max(900, Number(durationMs) || 2600));
  }

  function createHud() {
    const hud = document.createElement("div");
    hud.id = "public-local-load-hud";
    hud.style.position = "fixed";
    hud.style.left = "16px";
    hud.style.top = "16px";
    hud.style.zIndex = "2147483647";
    hud.style.maxWidth = "min(92vw, 460px)";
    hud.style.padding = "12px 14px";
    hud.style.borderRadius = "12px";
    hud.style.border = "1px solid rgba(154, 198, 255, 0.34)";
    hud.style.background = "rgba(9, 20, 38, 0.82)";
    hud.style.color = "#eaf3ff";
    hud.style.fontSize = "12px";
    hud.style.lineHeight = "1.5";
    hud.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.32)";
    hud.style.backdropFilter = "blur(8px)";
    document.body.appendChild(hud);
    return hud;
  }

  function setHudMessage(hud, title, lines = []) {
    if (!hud) {
      return;
    }
    const body = lines.map((line) => `<div>${line}</div>`).join("");
    hud.innerHTML = `<strong style="display:block;margin-bottom:6px;">${title}</strong>${body}`;
  }

  function positionLoadingOverlayToCanvas() {
    if (!loadingOverlay || !canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const bleed = 2;
    const left = Math.max(0, Math.floor(rect.left - bleed));
    const top = Math.max(0, Math.floor(rect.top - bleed));
    const right = Math.min(window.innerWidth, Math.ceil(rect.right + bleed));
    const bottom = Math.min(window.innerHeight, Math.ceil(rect.bottom + bleed));
    loadingOverlay.style.left = `${left}px`;
    loadingOverlay.style.top = `${top}px`;
    loadingOverlay.style.width = `${Math.max(1, right - left)}px`;
    loadingOverlay.style.height = `${Math.max(1, bottom - top)}px`;
    loadingOverlay.style.borderRadius = "0px";
  }

  function setLoadingProgress(loaded, total, label = "") {
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeLoaded = Math.max(0, Number(loaded) || 0);
    const percent = safeTotal > 0 ? Math.min(100, Math.round((safeLoaded / safeTotal) * 100)) : 0;
    if (loadingBarFill) {
      loadingBarFill.style.width = `${percent}%`;
    }
    if (loadingText) {
      loadingText.textContent = safeTotal > 0
        ? `読み込み中... ${safeLoaded}/${safeTotal}${label ? ` (${label})` : ""}`
        : "読み込み中...";
    }
  }

  function hideLoadingOverlay(message = "読み込み完了") {
    if (loadingBarFill) {
      loadingBarFill.style.width = "100%";
    }
    if (loadingText) {
      loadingText.textContent = message;
    }
    if (loadingOverlay) {
      loadingOverlay.classList.add("is-hidden");
    }
  }

  function showLoadingOverlay(message = "ファイルを読み込み中です。") {
    if (loadingText) {
      loadingText.textContent = message;
    }
    if (loadingOverlay) {
      loadingOverlay.classList.remove("is-hidden");
      loadingOverlay.style.display = "flex";
    }
    positionLoadingOverlayToCanvas();
  }

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let next = angle % twoPi;
    if (next < 0) {
      next += twoPi;
    }
    return next;
  }

  function applyConstructionFixedEnvMapToMaterial(mat) {
    if (!mat) {
      return;
    }
    constructionFixedEnvMaterials.add(mat);
    if (constructionFixedEnvMap) {
      mat.envMap = constructionFixedEnvMap;
      mat.envMapIntensity = 1.45;
      mat.needsUpdate = true;
    }
  }

  function applyCameraLook() {
    const direction = new THREE.Vector3(
      Math.sin(cameraAngleY) * Math.cos(cameraAngleX),
      Math.sin(cameraAngleX),
      Math.cos(cameraAngleY) * Math.cos(cameraAngleX)
    );
    camera.lookAt(new THREE.Vector3().addVectors(camera.position, direction));
  }

  function buildCameraViewState() {
    return {
      version: 1,
      position: {
        x: Number(camera.position.x) || 0,
        y: Number(camera.position.y) || 0,
        z: Number(camera.position.z) || 0,
      },
      angles: {
        yaw: Number(cameraAngleY) || 0,
        pitch: Number(cameraAngleX) || 0,
      },
      savedAt: new Date().toISOString(),
    };
  }

  function restoreCameraViewStateFromLocalStorage() {
    try {
      const raw = localStorage.getItem(cameraStorageKey);
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw);
      const px = Number(parsed?.position?.x);
      const py = Number(parsed?.position?.y);
      const pz = Number(parsed?.position?.z);
      const yaw = Number(parsed?.angles?.yaw);
      const pitch = Number(parsed?.angles?.pitch);
      if ([px, py, pz, yaw, pitch].every((v) => Number.isFinite(v))) {
        camera.position.set(px, py, pz);
        cameraAngleY = yaw;
        cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
        return true;
      }
    } catch (_err) {
      // Ignore storage restore failures.
    }
    return false;
  }

  function persistCameraViewStateToLocalStorage({ force = false } = {}) {
    try {
      const now = performance.now();
      if (!force && (now - cameraViewLastSaveAt) < 800) {
        return false;
      }
      const serialized = JSON.stringify(buildCameraViewState());
      if (!force && serialized === cameraViewLastSerialized) {
        cameraViewLastSaveAt = now;
        return false;
      }
      localStorage.setItem(cameraStorageKey, serialized);
      cameraViewLastSerialized = serialized;
      cameraViewLastSaveAt = now;
      return true;
    } catch (_err) {
      return false;
    }
  }

  function normalizeAndLiftRoot(root) {
    const initialBox = new THREE.Box3().setFromObject(root);
    if (initialBox.isEmpty()) {
      return;
    }
    const center = initialBox.getCenter(new THREE.Vector3());
    root.position.sub(center);
    root.updateMatrixWorld(true);

    const centeredBox = new THREE.Box3().setFromObject(root);
    root.position.y -= centeredBox.min.y;

    const size = centeredBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 10000) {
      root.scale.setScalar(0.001);
      root.updateMatrixWorld(true);
    }
  }

  function frameCameraToRoots(roots) {
    const box = new THREE.Box3();
    roots.forEach((root) => {
      if (root) {
        box.expandByObject(root);
      }
    });
    if (box.isEmpty()) {
      camera.position.set(0, 10, 30);
      return;
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.8 || 12;

    camera.position.set(center.x + radius, center.y + radius * 0.65, center.z + radius);
    const offset = center.clone().sub(camera.position);
    const flatLength = Math.sqrt(offset.x * offset.x + offset.z * offset.z) || 1;
    cameraAngleY = Math.atan2(offset.x, offset.z);
    cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, Math.atan2(offset.y, flatLength)));
  }

  function setupScene() {
    scene.background = new THREE.Color(0x0f1726);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    camera.position.set(0, 10, 30);

    const envLoader = new THREE.TextureLoader();
    envLoader.load("textures/ct.jpg", (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      constructionFixedEnvMap = texture;
      constructionFixedEnvMaterials.forEach((mat) => {
        if (!mat) {
          return;
        }
        mat.envMap = constructionFixedEnvMap;
        mat.envMapIntensity = 1.45;
        mat.needsUpdate = true;
      });
    });

    scene.add(new THREE.AmbientLight(0xffffff, 1.8));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
    directionalLight.position.set(12, 18, 10);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x9ac6ff, 0.7);
    fillLight.position.set(-16, 10, -8);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(160, 32, 0x3d5f87, 0x25384f);
    scene.add(grid);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({
        color: 0x152236,
        metalness: 0.08,
        roughness: 0.92,
        side: THREE.DoubleSide,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    positionLoadingOverlayToCanvas();
  }

  function onKeyDown(event) {
    const activeTag = document.activeElement?.tagName?.toLowerCase?.() || "";
    if (activeTag === "input" || activeTag === "textarea") {
      return;
    }
    keys[event.key.toLowerCase()] = true;
  }

  function onKeyUp(event) {
    keys[event.key.toLowerCase()] = false;
  }

  function updatePointerAngles(deltaX, deltaY) {
    cameraAngleY = normalizeAngle(cameraAngleY + deltaX * 0.005);
    cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, cameraAngleX + deltaY * 0.005));
  }

  function onPointerDown(event) {
    draggingView = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!draggingView) {
      return;
    }
    updatePointerAngles(lastPointerX - event.clientX, lastPointerY - event.clientY);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  function onPointerUp(event) {
    draggingView = false;
    canvas.releasePointerCapture?.(event.pointerId);
  }

  function onTouchStart(event) {
    const firstTouch = event.touches?.[0];
    if (!firstTouch) {
      return;
    }
    draggingView = true;
    lastPointerX = firstTouch.clientX;
    lastPointerY = firstTouch.clientY;
  }

  function onTouchMove(event) {
    const firstTouch = event.touches?.[0];
    if (!draggingView || !firstTouch) {
      return;
    }
    event.preventDefault();
    updatePointerAngles(lastPointerX - firstTouch.clientX, lastPointerY - firstTouch.clientY);
    lastPointerX = firstTouch.clientX;
    lastPointerY = firstTouch.clientY;
  }

  function onTouchEnd() {
    draggingView = false;
    moveVectorX = 0;
    moveVectorZ = 0;
  }

  function bindInputHandlers() {
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("resize", onWindowResize, false);
    window.addEventListener("scroll", positionLoadingOverlayToCanvas, { passive: true });
  }

  function animate() {
    const moveSpeed = baseSpeed;
    const strafe = (keys["a"] ? 1 : 0) - (keys["d"] ? 1 : 0);
    const forward = (keys["w"] ? 1 : 0) - (keys["s"] ? 1 : 0);

    if (keys["1"]) { baseSpeed = 0.05; }
    if (keys["2"]) { baseSpeed = 0.2; }
    if (keys["3"]) { baseSpeed = 0.45; }
    if (keys["4"]) { baseSpeed = 0.8; }
    if (keys["0"]) { baseSpeed = 0.1; }

    camera.position.x += Math.sin(cameraAngleY + Math.PI / 2) * moveSpeed * strafe;
    camera.position.z += Math.cos(cameraAngleY + Math.PI / 2) * moveSpeed * strafe;
    camera.position.x += Math.sin(cameraAngleY) * moveSpeed * forward;
    camera.position.z += Math.cos(cameraAngleY) * moveSpeed * forward;
    camera.position.x += moveVectorX * moveSpeed;
    camera.position.z += moveVectorZ * moveSpeed;

    if (keys["q"]) {
      camera.position.y += moveSpeed * 0.5;
    }
    if (keys["e"]) {
      camera.position.y -= moveSpeed * 0.5;
    }

    if (keys["arrowleft"]) { cameraAngleY = normalizeAngle(cameraAngleY + rotateSpeed); }
    if (keys["arrowright"]) { cameraAngleY = normalizeAngle(cameraAngleY - rotateSpeed); }
    if (keys["arrowup"]) { cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, cameraAngleX + rotateSpeed)); }
    if (keys["arrowdown"]) { cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, cameraAngleX - rotateSpeed)); }

    applyCameraLook();
    persistCameraViewStateToLocalStorage();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  return {
    THREE,
    scene,
    camera,
    renderer,
    createHud,
    setHudMessage,
    showTopNotice,
    showLoadingOverlay,
    hideLoadingOverlay,
    setLoadingProgress,
    setupScene,
    bindInputHandlers,
    onWindowResize,
    applyCameraLook,
    restoreCameraViewStateFromLocalStorage,
    buildCameraViewState,
    setCameraViewSerialized(value) {
      cameraViewLastSerialized = String(value || "");
    },
    normalizeAndLiftRoot,
    frameCameraToRoots,
    applyConstructionFixedEnvMapToMaterial,
    animate,
  };
}

export function normalizeRuntimeFiles(record) {
  if (record?.files && typeof record.files === "object") {
    return {
      st: record.files.st || null,
      ct: record.files.ct || null,
      tr: record.files.tr || null,
    };
  }
  if (record?.buffer && record?.name) {
    return { st: null, ct: record, tr: null };
  }
  return { st: null, ct: null, tr: null };
}

export async function readRuntimeMapRecord() {
  const db = await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(RUNTIME_MAP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains(RUNTIME_MAP_STORE_NAME)) {
        nextDb.createObjectStore(RUNTIME_MAP_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RUNTIME_MAP_STORE_NAME, "readonly");
    const store = transaction.objectStore(RUNTIME_MAP_STORE_NAME);
    const request = store.get(RUNTIME_MAP_RECORD_KEY);
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error("IndexedDB read failed"));
    };
  });
}

export async function deleteRuntimeMapRecord() {
  const db = await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(RUNTIME_MAP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const nextDb = request.result;
      if (!nextDb.objectStoreNames.contains(RUNTIME_MAP_STORE_NAME)) {
        nextDb.createObjectStore(RUNTIME_MAP_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RUNTIME_MAP_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RUNTIME_MAP_STORE_NAME);
    store.delete(RUNTIME_MAP_RECORD_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB delete failed"));
    };
  });
}

export async function parseGlb(buffer, fileName) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      buffer,
      "",
      (gltf) => {
        const root = gltf?.scene || gltf?.scenes?.[0] || null;
        if (!root) {
          reject(new Error(`${fileName}: glb にシーンがありません。`));
          return;
        }
        resolve(root);
      },
      (error) => reject(error || new Error(`${fileName}: glb parse failed`))
    );
  });
}

export function getRuntimeFileBytes(file) {
  const buffer = file?.buffer;
  if (buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer);
  }
  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
  throw new Error(`${file?.name || "runtime file"}: buffer がありません。`);
}

export async function parseRuntimePayload(file) {
  const msgpackCodec = await (async () => {
    const candidates = [
      "https://cdn.jsdelivr.net/npm/@msgpack/msgpack@2.8.0/+esm",
      "https://cdn.jsdelivr.net/npm/@msgpack/msgpack@2.8.0/dist.esm/index.js",
      "https://cdn.jsdelivr.net/npm/@msgpack/msgpack@3.0.0/dist.esm/index.mjs",
    ];
    for (const url of candidates) {
      try {
        const mod = await import(url);
        if (typeof mod?.encode === "function" && typeof mod?.decode === "function") {
          return { encode: mod.encode, decode: mod.decode };
        }
      } catch (_err) {
        // Try next candidate.
      }
    }
    throw new Error("msgpack codec の読み込みに失敗しました。");
  })();
  const codec = createCreateModeStateCodec(msgpackCodec);
  return codec.readMapDataBytes(getRuntimeFileBytes(file), {
    name: String(file?.name || "runtime"),
    size: Number(file?.size) || 0,
  });
}
