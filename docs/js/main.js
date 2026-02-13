// main.js
"toggle-daynight"
"frontViewBtn"
"停止"

// モバイルデバッグ用　ログ画面出力

// const ctrl = document.getElementById('controller');

let logwindow = document.getElementById("logwindow");
logwindow.hidden = true

const log_hidden = document.getElementById("log");

let text = ''

function alert(txt){
  text += txt+'\n'
  logwindow.innerText = txt//keepLastNLines(text)
}

function keepLastNLines(text, maxLines = 20, options = {}) {
  const {
    treatEscapedNewline = false,
    normalizeLineEndings = true,
    joinWith = '\n'
  } = options;

  if (text == null) return '';

  let s = String(text);

  // オプション: "\\n" を実改行に変換
  if (treatEscapedNewline) {
    s = s.replace(/\\r\\n/g, '\r\n').replace(/\\r/g, '\r').replace(/\\n/g, '\n');
  }

  // 改行をLFに正規化
  if (normalizeLineEndings) {
    s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
         .replace(/\u2028/g, '\n').replace(/\u2029/g, '\n').replace(/\u0085/g, '\n');
  }

  const lines = s.split('\n'); // 空行も 1 行としてカウント
  if (lines.length <= maxLines) return lines.join(joinWith);

  // 末尾 maxLines を残す（先頭の余分を削除）
  const kept = lines.slice(lines.length - maxLines);
  return kept.join(joinWith);
}

log_hidden.addEventListener("touchstart", () => {
  if (logwindow.hidden){
    let txt = ''
    const max_len = 10
    for (let i = 0; i < group_targetObjects.length; i++){
      const cdnt_0 = group_targetObjects[i][0].position
      const cdnt_1 = group_targetObjects[i][1].position

      txt += '['+ i + '] { x: '+String(cdnt_0.x).slice(0, max_len) +', y: ' +String(cdnt_0.y).slice(0, max_len)+', z: ' +String(cdnt_0.z).slice(0, max_len) + '},'
      txt += '{ x: '+String(cdnt_1.x).slice(0, max_len) +', y: ' +String(cdnt_1.y).slice(0, max_len)+', z: ' +String(cdnt_1.z).slice(0, max_len) + '}\n'
    }
    alert(txt)
  }
  logwindow.hidden = !logwindow.hidden
});

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, HOLLOW_SUBTRACTION } from 'three-bvh-csg';
const scene = new THREE.Scene();

const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const loadingBarFill = document.getElementById('loading-bar-fill');
let loadingDone = false;
let loadingReady = false;
let renderedFramesSinceReady = 0;
let loadingReadyAt = 0;
const LOADING_STABLE_FRAMES = 20;
const LOADING_MIN_WAIT_MS = 450;

function positionLoadingOverlayToCanvas() {
  if (!loadingOverlay || !canvas || loadingDone) { return; }
  const rect = canvas.getBoundingClientRect();
  // サブピクセル丸め誤差で端に隙間が出ないよう、1px外側まで拡張して配置する。
  const bleed = 2;
  const left = Math.max(0, Math.floor(rect.left - bleed));
  const top = Math.max(0, Math.floor(rect.top - bleed));
  const right = Math.min(window.innerWidth, Math.ceil(rect.right + bleed));
  const bottom = Math.min(window.innerHeight, Math.ceil(rect.bottom + bleed));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  loadingOverlay.style.left = `${left}px`;
  loadingOverlay.style.top = `${top}px`;
  loadingOverlay.style.width = `${width}px`;
  loadingOverlay.style.height = `${height}px`;
  const canvasRadius = window.getComputedStyle(canvas).borderRadius || '0px';
  loadingOverlay.style.borderRadius = canvas.classList.contains('intro-canvas') ? canvasRadius : '0px';
}

function setLoadingProgress(loaded, total, url = '') {
  if (!loadingOverlay) { return; }
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeLoaded = Math.max(0, Number(loaded) || 0);
  const percent = safeTotal > 0 ? Math.min(100, Math.round((safeLoaded / safeTotal) * 100)) : 0;
  if (loadingBarFill) {
    loadingBarFill.style.width = `${percent}%`;
  }
  if (loadingText) {
    const tail = url ? ` (${url.split('/').pop()})` : '';
    loadingText.textContent = safeTotal > 0
      ? `読み込み中... ${safeLoaded}/${safeTotal} (${percent}%)${tail}`
      : '読み込み中...';
  }
}

function hideLoadingOverlay() {
  if (!loadingOverlay || loadingDone) { return; }
  loadingDone = true;
  if (loadingBarFill) {
    loadingBarFill.style.width = '100%';
  }
  if (loadingText) {
    loadingText.textContent = '読み込み完了';
  }
  requestAnimationFrame(() => {
    loadingOverlay.classList.add('is-hidden');
  });
}

function tryFinishLoadingOverlay() {
  if (loadingDone) { return; }
  if (!loadingReady) { return; }
  const elapsed = loadingReadyAt > 0 ? (performance.now() - loadingReadyAt) : 0;
  if (renderedFramesSinceReady < LOADING_STABLE_FRAMES || elapsed < LOADING_MIN_WAIT_MS) {
    if (loadingText) {
      loadingText.textContent = `描画準備中... (${Math.min(renderedFramesSinceReady, LOADING_STABLE_FRAMES)}/${LOADING_STABLE_FRAMES})`;
    }
    return;
  }
  hideLoadingOverlay();
}

function markLoadingReady() {
  if (loadingReady) { return; }
  loadingReady = true;
  loadingReadyAt = performance.now();
  renderedFramesSinceReady = 0;
  tryFinishLoadingOverlay();
}

function markRenderFrame() {
  if (!loadingReady || loadingDone) { return; }
  renderedFramesSinceReady += 1;
  tryFinishLoadingOverlay();
}

THREE.DefaultLoadingManager.onStart = (_url, itemsLoaded, itemsTotal) => {
  setLoadingProgress(itemsLoaded, itemsTotal);
};

THREE.DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
  setLoadingProgress(itemsLoaded, itemsTotal, url);
};

THREE.DefaultLoadingManager.onLoad = () => {
  markLoadingReady();
};

THREE.DefaultLoadingManager.onError = (url) => {
  if (loadingText) {
    loadingText.textContent = `一部の読み込みに失敗しました: ${url}`;
  }
  setTimeout(markLoadingReady, 900);
};

// Fallback: ローダー管理に載らない処理が残っても、window load後に終了可能へ遷移。
window.addEventListener('load', () => {
  positionLoadingOverlayToCanvas();
  setTimeout(markLoadingReady, 400);
}, { once: true });

// 初期はウェルカム用の縮小プレビューがある場合、そのサイズに合わせる。
const introWrapper = document.getElementById('intro-wrapper');
// three-ui container (may be moved between intro wrapper and body)
const threeUi = document.getElementById('three-ui');
  const showInstructionsBtn = document.getElementById('show-instructions-btn');
  const instructionsPanel = document.getElementById('instructions-panel');
  const guideWindow = document.getElementById('guide-window');
  const rotationPanel = document.getElementById('rotation-panel');
  const rotationInputX = document.getElementById('rotation-input-x');
  const rotationInputY = document.getElementById('rotation-input-y');
  const rotationInputZ = document.getElementById('rotation-input-z');
  const rotationApplyBtn = document.getElementById('rotation-apply');
  const rotationSelectionInfo = document.getElementById('rotation-selection-info');
  const operationSection = document.getElementById('operation');
  const previewFeature = document.getElementById('preview-feature');
  const previewStartBtn = document.getElementById('preview-start');
  const differencePanel = document.getElementById('difference-panel');
  const differenceShapeSelect = document.getElementById('difference-shape');
  const differencePathSelect = document.getElementById('difference-path');
  const differenceStatus = document.getElementById('difference-status');

  let differenceSpaceModeActive = false;
  let differenceShapeType = differenceShapeSelect?.value || 'tube';
  let differencePathType = differencePathSelect?.value || 'smooth';
  let differenceSpaceTransformMode = 'none';

  // 初期表示: プレビューでは three-ui を隠してプレビュー用パネルを表示
  if (threeUi) {
    try { threeUi.style.display = 'none'; } catch (e) {}
  }
  if (previewFeature) {
    try { previewFeature.style.display = 'block'; } catch (e) {}
  }
  if (differenceShapeSelect) {
    differenceShapeSelect.addEventListener('change', () => {
      differenceShapeType = differenceShapeSelect.value || 'tube';
      refreshDifferencePreview();
    });
  }
  if (differencePathSelect) {
    differencePathSelect.addEventListener('change', () => {
      differencePathType = differencePathSelect.value || 'smooth';
      refreshDifferencePreview();
    });
  }

  if (showInstructionsBtn) {
    showInstructionsBtn.addEventListener('click', () => {
      // まず float パネルを優先表示する
      if (instructionsPanel) {
        const isOpen = instructionsPanel.style.display === 'block';
        instructionsPanel.style.display = isOpen ? 'none' : 'block';
        showInstructionsBtn.textContent = isOpen ? '操作説明' : '閉じる';
        return;
      }
      // パネルが無ければページ内の operation セクションを切り替える
      const welcomeEl = document.getElementById('welcome');
      if (operationSection) {
        const isOpenOp = operationSection.style.display === 'block';
        if (isOpenOp) {
          operationSection.style.display = 'none';
          if (welcomeEl) welcomeEl.style.display = 'flex';
          showInstructionsBtn.textContent = '操作説明';
        } else {
          operationSection.style.display = 'block';
          if (welcomeEl) welcomeEl.style.display = 'none';
          showInstructionsBtn.textContent = '戻る';
        }
      }
    });
  }

  function applyRotationFromPanel() {
    if (pointRotateModeActive && pointRotateTarget) {
      const degToRad = Math.PI / 180;
      const state = pointRotateTarget.userData?.pointRotatePanelAngles || { x: 0, y: 0, z: 0 };
      const xRaw = rotationInputX?.value?.trim?.() ?? '';
      const yRaw = rotationInputY?.value?.trim?.() ?? '';
      const zRaw = rotationInputZ?.value?.trim?.() ?? '';
      const axDeg = Number.isFinite(parseFloat(xRaw)) ? parseFloat(xRaw) : state.x;
      const ayDeg = Number.isFinite(parseFloat(yRaw)) ? parseFloat(yRaw) : state.y;
      const azDeg = Number.isFinite(parseFloat(zRaw)) ? parseFloat(zRaw) : state.z;
      const dx = axDeg - state.x;
      const dy = ayDeg - state.y;
      const dz = azDeg - state.z;

      if (Math.abs(dx) > 1e-6) {
        const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(pointRotateBasisQuat).normalize();
        const qx = new THREE.Quaternion().setFromAxisAngle(axisX, dx * degToRad);
        pointRotateBasisQuat.copy(qx.multiply(pointRotateBasisQuat)).normalize();
      }
      if (Math.abs(dy) > 1e-6) {
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dy * degToRad);
        pointRotateBasisQuat.copy(qy.multiply(pointRotateBasisQuat)).normalize();
      }
      if (Math.abs(dz) > 1e-6) {
        const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat).normalize();
        const qz = new THREE.Quaternion().setFromAxisAngle(axisZ, dz * degToRad);
        pointRotateBasisQuat.copy(qz.multiply(pointRotateBasisQuat)).normalize();
      }

      pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
      pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
      pointRotateGizmoYawStart = pointRotateGizmoYaw;
      pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
      pointRotateTarget.userData = {
        ...(pointRotateTarget.userData || {}),
        pointRotateDirection: pointRotateDirection.clone(),
        pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
        pointRotatePanelAngles: { x: axDeg, y: ayDeg, z: azDeg },
      };
      showPointRotationGuideLine(pointRotateTarget);
      updatePointRotateVisuals();

      if (rotationInputX) { rotationInputX.value = String(Number(axDeg).toFixed(1)); rotationInputX.placeholder = String(axDeg); }
      if (rotationInputY) { rotationInputY.value = String(Number(ayDeg).toFixed(1)); rotationInputY.placeholder = String(ayDeg); }
      if (rotationInputZ) { rotationInputZ.value = String(Number(azDeg).toFixed(1)); rotationInputZ.placeholder = String(azDeg); }
      return;
    }

    const meshes = getRotateSelectionMeshes();
    if (movePlaneMode === 'change_angle') {
      const degToRad = Math.PI / 180;
      const state = (changeAngleGridTarget?.userData?.changeAnglePanelAngles)
        ? { ...changeAngleGridTarget.userData.changeAnglePanelAngles }
        : { ...movePlanePanelAngles };
      const xRaw = rotationInputX?.value?.trim?.() ?? '';
      const yRaw = rotationInputY?.value?.trim?.() ?? '';
      const zRaw = rotationInputZ?.value?.trim?.() ?? '';
      const axDeg = Number.isFinite(parseFloat(xRaw)) ? parseFloat(xRaw) : (Number(state.x) || 0);
      const ayDeg = Number.isFinite(parseFloat(yRaw)) ? parseFloat(yRaw) : (Number(state.y) || 0);
      const azDeg = Number.isFinite(parseFloat(zRaw)) ? parseFloat(zRaw) : (Number(state.z) || 0);
      const dx = axDeg - (Number(state.x) || 0);
      const dy = ayDeg - (Number(state.y) || 0);
      const dz = azDeg - (Number(state.z) || 0);

      if (Math.abs(dx) > 1e-6) {
        const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(movePlaneBasisQuat).normalize();
        const qx = new THREE.Quaternion().setFromAxisAngle(axisX, dx * degToRad);
        movePlaneBasisQuat.copy(qx.multiply(movePlaneBasisQuat)).normalize();
      }
      if (Math.abs(dy) > 1e-6) {
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dy * degToRad);
        movePlaneBasisQuat.copy(qy.multiply(movePlaneBasisQuat)).normalize();
      }
      if (Math.abs(dz) > 1e-6) {
        const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(movePlaneBasisQuat).normalize();
        const qz = new THREE.Quaternion().setFromAxisAngle(axisZ, dz * degToRad);
        movePlaneBasisQuat.copy(qz.multiply(movePlaneBasisQuat)).normalize();
      }
      updateMovePlaneNormal();
      // パネル操作でもギズモ姿勢を反映
      movePlaneGizmoQuat.copy(movePlaneBasisQuat);
      saveChangeAnglePanelAngles({ x: axDeg, y: ayDeg, z: azDeg }, { writeValue: true });
      updateMovePlaneGizmo();
      return;
    }
    if (meshes.length < 1) { return; }
    const degToRad = Math.PI / 180;
    const xRaw = rotationInputX?.value?.trim?.() ?? '';
    const yRaw = rotationInputY?.value?.trim?.() ?? '';
    const zRaw = rotationInputZ?.value?.trim?.() ?? '';
    const axDeg = Number.isFinite(parseFloat(xRaw)) ? parseFloat(xRaw) : rotatePanelState.angles.x;
    const ayDeg = Number.isFinite(parseFloat(yRaw)) ? parseFloat(yRaw) : rotatePanelState.angles.y;
    const azDeg = Number.isFinite(parseFloat(zRaw)) ? parseFloat(zRaw) : rotatePanelState.angles.z;
    const dx = axDeg - rotatePanelState.angles.x;
    const dy = ayDeg - rotatePanelState.angles.y;
    const dz = azDeg - rotatePanelState.angles.z;
    rotatePanelState.angles = { x: axDeg, y: ayDeg, z: azDeg };

    const center = new THREE.Vector3();
    meshes.forEach((m) => center.add(m.position));
    center.multiplyScalar(1 / meshes.length);

    const rotateByAxis = (axis, rad) => {
      if (Math.abs(rad) < 1e-6) return;
      meshes.forEach((m) => {
        const offset = m.position.clone().sub(center);
        offset.applyAxisAngle(axis, rad);
        m.position.copy(center.clone().add(offset));
      });
    };

    rotateByAxis(new THREE.Vector3(1, 0, 0), dx * degToRad);
    rotateByAxis(new THREE.Vector3(0, 1, 0), dy * degToRad);
    rotateByAxis(new THREE.Vector3(0, 0, 1), dz * degToRad);
    const curves = new Set();
    meshes.forEach((m) => {
      if (m?.userData?.guideCurve) {
        const curve = m.userData.guideCurve;
        const idx = m.userData.guideControlIndex;
        if (curve?.userData?.controlPoints && typeof idx === 'number') {
          curve.userData.controlPoints[idx] = m.position.clone();
          curves.add(curve);
        }
      }
    });
    curves.forEach((curve) => updateGuideCurve(curve));

    if (rotationInputX) {
      rotationInputX.value = '';
      rotationInputX.placeholder = String(axDeg);
    }
    if (rotationInputY) {
      rotationInputY.value = '';
      rotationInputY.placeholder = String(ayDeg);
    }
    if (rotationInputZ) {
      rotationInputZ.value = '';
      rotationInputZ.placeholder = String(azDeg);
    }
    updateRotateGizmo();
  }

  if (rotationApplyBtn) {
    rotationApplyBtn.addEventListener('click', applyRotationFromPanel);
  }

  let guidePlacementTemplate = null;
  let guidePlacementActive = false;
  let guideRailHover = null;
  let guideHoverPin = null;

  function buildGuideCurve(template, basePoint, basisQuat = null) {
    const buildLinearClosedCurve = (points) => {
      const path = new THREE.CurvePath();
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        path.add(new THREE.LineCurve3(a.clone(), b.clone()));
      }
      path.autoClose = true;
      return path;
    };

    let offsets = [];
    let isClosed = false;
    let isLinearClosed = false;
    switch (template) {
      case 'curve_s':
        offsets = [[-6, 0, -2], [-2, 0, 2], [2, 0, -2], [6, 0, 2]];
        break;
      case 'curve_l':
        offsets = [[-4, 0, 0], [0, 0, 0], [4, 0, 0], [4, 0, 4]];
        break;
      case 'curve_u':
        offsets = [[-4, 0, -2], [-4, 0, 2], [0, 0, 4], [4, 0, 2], [4, 0, -2]];
        break;
      case 'curve_square':
        offsets = [[-4, 0, -4], [4, 0, -4], [4, 0, 4], [-4, 0, 4]];
        isClosed = true;
        isLinearClosed = true;
        break;
      case 'curve_circle': {
        const radius = 4;
        const segments = 12;
        offsets = Array.from({ length: segments }, (_, i) => {
          const t = (i / segments) * Math.PI * 2;
          return [Math.cos(t) * radius, 0, Math.sin(t) * radius];
        });
        isClosed = true;
        break;
      }
      case 'curve_straight':
      default:
        offsets = [[-6, 0, 0], [0, 0, 0], [6, 0, 0]];
        break;
    }
    const points = offsets.map((o) => {
      const local = new THREE.Vector3(o[0], o[1], o[2]);
      if (basisQuat) {
        local.applyQuaternion(basisQuat);
      }
      return basePoint.clone().add(local);
    });
    const curve = isLinearClosed
      ? buildLinearClosedCurve(points)
      : new THREE.CatmullRomCurve3(points, isClosed);
    curve.closed = isClosed;
    curve.userData = {
      ...(curve.userData || {}),
      controlPoints: points,
      isLinearClosed,
      templateType: template,
    };
    return curve;
  }

  const guideRailPickMeshes = [];

  function createGuideRailPickMesh(curve) {
    const tube = new THREE.TubeGeometry(curve, 60, 0.45, 10, curve?.closed === true);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6d86ff,
      transparent: true,
      opacity: 0.35,
    });
    const mesh = new THREE.Mesh(tube, mat);
    mesh.name = 'GuideRailPick';
    mesh.userData.isGuideRail = true;
    mesh.userData.guideCurve = curve;
    scene.add(mesh);
    guideRailPickMeshes.push(mesh);
    if (curve) {
      curve.userData = { ...(curve.userData || {}), guidePickMesh: mesh };
    }
    return mesh;
  }

  function updateGuideCurve(curve) {
    if (!curve || !curve.userData?.controlPoints) { return; }
    if (curve.userData.isLinearClosed) {
      const cps = curve.userData.controlPoints;
      const rebuilt = new THREE.CurvePath();
      for (let i = 0; i < cps.length; i += 1) {
        const a = cps[i];
        const b = cps[(i + 1) % cps.length];
        rebuilt.add(new THREE.LineCurve3(a.clone(), b.clone()));
      }
      rebuilt.autoClose = true;
      // Keep existing object reference used by other features.
      curve.curves = rebuilt.curves;
      curve.cacheArcLengths = null;
    } else {
      curve.points = curve.userData.controlPoints;
    }

    const pick = curve.userData.guidePickMesh;
    if (pick) {
      const newGeom = new THREE.TubeGeometry(curve, 60, 0.45, 10, curve?.closed === true);
      if (pick.geometry) pick.geometry.dispose();
      pick.geometry = newGeom;
    }

    const line = curve.userData.guideLine;
    if (line) {
      const points = curve.getPoints(100);
      const geom = new THREE.BufferGeometry().setFromPoints(points);
      if (line.geometry) line.geometry.dispose();
      line.geometry = geom;
    }
  }

  function setGuideHoverPin(position) {
    if (!position) {
      if (guideHoverPin && guideHoverPin.parent) {
        guideHoverPin.parent.remove(guideHoverPin);
      }
      guideHoverPin = null;
      return;
    }
    if (!guideHoverPin) {
      guideHoverPin = TSys.Map_pin(position.x, position.z, position.y, 0.12, 0x2ecc71);
      guideHoverPin.name = 'GuideHoverPin';
      guideHoverPin.userData = { ...guideHoverPin.userData, guideHoverPin: true };
      scene.add(guideHoverPin);
    } else {
      guideHoverPin.position.set(position.x, position.y, position.z);
    }
  }

  function getNearestPointOnCurve(curve, point, samples = 120) {
    let nearest = null;
    let minDist = Infinity;
    for (let i = 0; i <= samples; i += 1) {
      const p = curve.getPointAt(i / samples);
      const d = p.distanceToSquared(point);
      if (d < minDist) {
        minDist = d;
        nearest = p;
      }
    }
    return nearest;
  }

  function activateGuidePlacement(template) {
    guidePlacementTemplate = template;
    guidePlacementActive = true;
    OperationMode = 1;
    objectEditMode = 'CREATE_NEW';
    editObject = 'STEEL_FRAME';
    move_direction_y = false;
    search_object = false;
    steelFrameMode.setAllowPointAppend(true);
    setGuideGridVisibleFromUI(true);
  }

  const guideButtons = document.querySelectorAll('[data-guide-template]');
  guideButtons.forEach((btn) => {
    const onActivate = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const template = btn.dataset.guideTemplate || 'curve_straight';
      activateGuidePlacement(template);
    };
    btn.addEventListener('click', onActivate);
    btn.addEventListener('touchstart', onActivate, { passive: false });
  });

if (introWrapper) {
  canvas.classList.add('intro-canvas');
  // 見た目の安定のため、introWrapper の実サイズに合わせてプレビュー幅を選ぶ
  const rect = introWrapper.getBoundingClientRect();
  const previewWidth = Math.min(640, Math.floor(rect.width - 16)); // パディング分を差し引く
  const previewHeight = Math.floor(previewWidth * 9 / 16);
  renderer.setSize(previewWidth, previewHeight);
  try { renderer.setPixelRatio(1); } catch (e) {}
  // CSS 上の表示サイズも明示的に設定しておく
  canvas.style.width = previewWidth + 'px';
  canvas.style.height = previewHeight + 'px';
  positionLoadingOverlayToCanvas();
  // controller 初期位置更新
  try { updateCtrlPos(); } catch (e) {}
} else {
  canvas.classList.add('full-canvas');
  renderer.setSize(window.innerWidth, window.innerHeight);
  positionLoadingOverlayToCanvas();
  // renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

// ----------------- シャドウを有効化（renderer を作った直後あたりに入れる） -----------------
renderer.shadowMap.enabled = true;                         // シャドウを有効化
renderer.shadowMap.type = THREE.PCFSoftShadowMap;         // ソフトシャドウ（見た目良し・負荷中）
renderer.outputColorSpace = THREE.SRGBColorSpace;         // 既存の行があるなら残す

// --- マップの半自動作成(路線設定) ---

// パフォーマンス制御フラグ（フルスクリーン時などに FPS 制限や低解像度を適用するため）
let perfThrottled = false;
let perfTargetFps = 30; // 目標 FPS（負荷が高ければここを下げる）
let lastRenderTime = 0; // FPS 制御用のタイムスタンプ

// 座標感覚の可視化
// Map_pin(10,10,20,0.2,0xff0000)
// Map_pin(10,10,10,0.5,0xff0000)

// Map_pin(-10,10,20,0.2,0xff0000)
// Map_pin(-10,10,10,0.5,0x0000ff)

// Map_pin(-10,-10,20,0.2,0x0000ff)
// Map_pin(-10,-10,10,0.5,0x0000ff)

// Map_pin(10,-10,20,0.2,0x0000ff)
// Map_pin(10,-10,10,0.5,0xff0000)

// 昼の環境マップ（初期）
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.physicallyCorrectLights = true;

// PMREMGenerator を一つだけ作って使い回すのが良い
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

let envMap = null
let envMapNight = null
const loader = new THREE.TextureLoader();
  loader.load('textures/sky.jpg', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
    scene.environment = texture;
    envMap = texture;
  });

loader.load('textures/shanghai_bund_4k.jpg', (texture_night) => {
  texture_night.mapping = THREE.EquirectangularReflectionMapping;
  texture_night.colorSpace = THREE.SRGBColorSpace;
  // scene.background = texture_night;
  // scene.environment = texture_night;
  envMapNight = texture_night ;
});

let ref_envMap = null
let ref_envMapNight = null
loader.load('textures/skyy.jpg', (ref) => {
  ref.mapping = THREE.EquirectangularReflectionMapping;
  ref.colorSpace = THREE.SRGBColorSpace;
  ref_envMap = ref
  scene.ref = ref_envMap;
});

loader.load('textures/shanghai_bund_4k.jpg', (ref_night) => {
  ref_night.mapping = THREE.EquirectangularReflectionMapping;
  ref_night.colorSpace = THREE.SRGBColorSpace;
  // scene.background = texture_night;
  // scene.environment = texture_night;
  ref_envMapNight = ref_night ;
  // scene.ref = ref_envMapNight;
});

// envMap = envMapNight

scene.background = envMapNight;
scene.environment = envMapNight;

scene.background = envMap;
scene.environment = envMap;

renderer.toneMappingExposure = 1;

// 駅(ホームドア)を生成
const train_width = 6.8
const car_Spacing = 0.15

console.log('WorldCreat')

import { WorldCreat } from './world_creat.js';
let LoadModels = await WorldCreat(scene, train_width, car_Spacing);
let geo = LoadModels[0]

console.log('cars : ',LoadModels)
console.log('geo : ',geo)

// world_creat()

const dirLight = scene.getObjectByName('dirLight');


import { TrainSystem } from './train_system.js';
import { createSteelFrameMode } from './steel_frame_mode.js';
import { initTrackSetup } from './track_setup.js';
import { applyFixedPlacements } from './fixed_placements.js';
const TSys = new TrainSystem(scene,dirLight);

// --- ライト追加（初回のみ） ---
// const ambient = new THREE.AmbientLight(0xffffff, 0.6);
// scene.add(ambient);

// --- 昼夜切替 ---
let isNight = false;

function TextureToggle(){

  for (let line = 0; line < Trains.length; line++){
    for (let cars = 0; cars < Trains[line].children.length; cars++){
      const car = Trains[line].children[cars]
     
      car.traverse((node) => {
        if (node.isMesh) {
          node.material.envMap = scene.ref;
          node.material.needsUpdate = true;
          if (node.name.includes('平面')) {
            const tex = node.material.map;
            node.material = new THREE.MeshBasicMaterial({
              map: tex,
              // transparent: true,
              opacity: 1.0,
              side: THREE.FrontSide
            });
          }

        }})
    }
  }
  }

const toggleBtn = document.getElementById("toggle-daynight");

toggleBtn.addEventListener("click", () => {
  isNight = !isNight;

  if (isNight) {
    // 🌙 夜モード
    scene.background = envMapNight;
    scene.environment = envMapNight;

    scene.ref = ref_envMapNight;
    
    dirLight.visible = false;
    // ambient.visible = false;
    TextureToggle();
    toggleBtn.textContent = "☀️ 昼にする";

  } else {
    // ☀️ 昼モード
    scene.background = envMap;
    scene.environment = envMap;

    scene.ref = ref_envMap;

    dirLight.visible = true;
    // ambient.visible = true;
    TextureToggle();
    toggleBtn.textContent = "🌙 夜にする";
  }
});

toggleBtn.addEventListener("touchstart", () => {
  isNight = !isNight;

  if (isNight) {
    // 🌙 夜モード
    scene.background = envMapNight;
    scene.environment = envMapNight;

    scene.ref = ref_envMapNight;

    dirLight.visible = false;
    // ambient.visible = false;
    TextureToggle();

    toggleBtn.textContent = "☀️ 昼にする";

  } else {
    // ☀️ 昼モード
    scene.background = envMap;
    scene.environment = envMap;

    scene.ref = ref_envMap;

    dirLight.visible = true;
    // ambient.visible = true;
    TextureToggle();

    toggleBtn.textContent = "🌙 夜にする";
  }
});

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 200
);

// カメラ初期位置（必要に応じて調整してください）
camera.position.set(0, 10, 30);

// 使用している canvas は既に DOM にあるため、appendChild は行わない。
// (document.body.appendChild(renderer.domElement) をするとプレビュー時の親要素配置が崩れるため削除)

// ウィンドウリサイズ時の処理
function onWindowResize() {
  if (introWrapper && canvas.classList.contains('intro-canvas')) {
    // プレビュー表示中は introWrapper のサイズに合わせる
    const rect = introWrapper.getBoundingClientRect();
    const previewWidth = Math.min(640, Math.floor(rect.width - 16));
    const previewHeight = Math.floor(previewWidth * 9 / 16);
    camera.aspect = previewWidth / previewHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(previewWidth, previewHeight);
    try { renderer.setPixelRatio(1); } catch (e) {}
    canvas.style.width = previewWidth + 'px';
    canvas.style.height = previewHeight + 'px';
    positionLoadingOverlayToCanvas();
  } else {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    positionLoadingOverlayToCanvas();
  try { updateCtrlPos(); } catch (e) {}
  }
}

window.addEventListener('resize', onWindowResize, false);
window.addEventListener('scroll', positionLoadingOverlayToCanvas, { passive: true });

// ウェルカム画面のボタン処理: プレビュー -> 全画面へ
const welcome = document.getElementById('welcome');
const startBtn = document.getElementById('start-3d');
const skipBtn = document.getElementById('skip-3d');

// 共通化: フルスクリーン表示へ切替える関数
function startFullView() {
  try {
    if (welcome) welcome.style.display = 'none';

    // プレビュー内の canvas を body に移動してフルスクリーン化
    try {
      if (canvas && canvas.parentElement !== document.body) document.body.appendChild(canvas);
    } catch (e) {}
    canvas.classList.remove('intro-canvas');
    canvas.classList.add('full-canvas');
    onWindowResize();
    positionLoadingOverlayToCanvas();
    try { updateCtrlPos(); } catch (e) {}

    // show UI overlay on full-screen
    if (threeUi) {
      try {
        if (threeUi.parentElement !== document.body) document.body.appendChild(threeUi);
        threeUi.style.position = 'fixed';
        threeUi.style.inset = '0';
        threeUi.style.zIndex = '2147483647';
        threeUi.style.display = 'block';
        threeUi.style.pointerEvents = 'auto';
      } catch (e) {}
    }

    // hide preview feature panel
    if (previewFeature) {
      try { previewFeature.style.display = 'none'; } catch (e) {}
    }

    // add class to body so only canvas is visible
    try { document.body.classList.add('only-canvas'); } catch (e) {}
  } catch (e) {
    console.error('startFullView error', e);
  }
}

if (startBtn) {
  startBtn.addEventListener('pointerdown', startFullView);
}
if (skipBtn) {
  skipBtn.addEventListener('pointerdown', () => {
    if (welcome) welcome.style.display = 'none';
  });
}

// preview 用大ボタンからフルスクリーンに遷移するための短絡ハンドラ
if (previewStartBtn) {
  previewStartBtn.addEventListener('pointerdown', () => {
    startFullView();
  });
}
// リンクからインナー（プレビュー）に戻す処理
const showIntroLink = document.getElementById('show-intro-link');
async function restorePreview() {
  try {
    if (welcome) welcome.style.display = 'flex';

    // move canvas back into intro-wrapper if available
    const introWrapperEl = document.getElementById('intro-wrapper');
    if (introWrapperEl && canvas && canvas.parentElement !== introWrapperEl) {
      introWrapperEl.appendChild(canvas);
    }

    // swap classes
    canvas.classList.remove('full-canvas');
    canvas.classList.add('intro-canvas');
    positionLoadingOverlayToCanvas();

    // hide three-ui until user starts again
    if (threeUi) {
      try {
        introWrapperEl.appendChild(threeUi);
        threeUi.style.position = 'absolute';
        threeUi.style.inset = '0';
        threeUi.style.zIndex = '2';
        threeUi.style.display = 'none';
        threeUi.style.pointerEvents = 'none';
      } catch (e) {}
    }

    // remove only-canvas class to restore page UI
    try { document.body.classList.remove('only-canvas'); } catch (e) {}

    // プレビュー用パネルを再表示
    if (previewFeature) {
      try { previewFeature.style.display = 'block'; } catch (e) {}
    }


    // restore renderer preview size and pixel ratio
    const previewWidth = Math.min(640, Math.floor(window.innerWidth * 0.6));
    const previewHeight = Math.floor(previewWidth * 9 / 16);
    try { renderer.setPixelRatio(1); } catch (e) {}
    renderer.setSize(previewWidth, previewHeight);
    positionLoadingOverlayToCanvas();
    try { updateCtrlPos(); } catch (e) {}
    perfThrottled = false;
  } catch (e) {
    console.error('restorePreview error', e);
  }
}

if (showIntroLink) {
  showIntroLink.addEventListener('click', (ev) => {
    // Ctrl/Meta/Shift を押していれば外部リンクとして開く
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    ev.preventDefault();
    restorePreview();
  });
}

let run_STOP = false
let quattro = 0
let run_num = 0
let suspendRunTrainAnimations = false

// --- エスカレーター ---
let path_x = 2.8
let path_y = 7
let path_z = 20.2
// ② 軌道を定義
const path_1 = new THREE.CatmullRomCurve3([
  new THREE.Vector3(path_x, 0+path_y, -3.42+path_z),
  new THREE.Vector3(path_x, 0+path_y, -3+path_z),
  new THREE.Vector3(path_x, 0.1+path_y, -2+path_z),
  new THREE.Vector3(path_x, 3.28+path_y, 3.7+path_z),
  new THREE.Vector3(path_x, 3.38+path_y, 4.7+path_z),
  new THREE.Vector3(path_x, 3.38+path_y, 5.2+path_z),
]);

// ③ アニメーション
// TSys.updateObjectOnPath(path_1);
path_x = -2.8
// ② 軌道を定義
const path_2 = new THREE.CatmullRomCurve3([
  new THREE.Vector3(path_x, 0+path_y, -3.42+path_z),
  new THREE.Vector3(path_x, 0+path_y, -3+path_z),
  new THREE.Vector3(path_x, 0.1+path_y, -2+path_z),
  new THREE.Vector3(path_x, 3.28+path_y, 3.7+path_z),
  new THREE.Vector3(path_x, 3.38+path_y, 4.7+path_z),
  new THREE.Vector3(path_x, 3.38+path_y, 5.2+path_z),
]);

// ③ アニメーション
// TSys.updateObjectOnPath(path_2);

path_x = 15
// ② 軌道を定義
const test = new THREE.CatmullRomCurve3([
  new THREE.Vector3(path_x, 0+path_y, -3.42+path_z),
  new THREE.Vector3(path_x, 0+path_y, -3+path_z),
  new THREE.Vector3(path_x, 0.1+path_y, -2+path_z),
  new THREE.Vector3(path_x, 3.28+path_y, 3.7+path_z),
  new THREE.Vector3(path_x, 3.38+path_y, 4.7+path_z),
  new THREE.Vector3(path_x, 3.38+path_y, 5.2+path_z),
]);

// ③ アニメーション
// TSys.updateObjectOnPath(test);

// --- エレベーター🛗 ---

const glass_material = new THREE.MeshStandardMaterial({
  // color: 0x003333,         // 白ベース
  color: 0x004444,         // 白ベース
  transparent: true,       // 透明を有効に
  opacity: 0.05,            // 透明度（0: 完全透明）
  roughness: -1,         // 表面のザラザラ感（低いほどつるつる）
  metalness: 2,          // 金属度（高いほど光沢が強く反射）
  envMapIntensity: 10.0,    // 環境マップの反射強度（envMapを使うなら）
  side: THREE.DoubleSide   // 両面描画（必要なら）
});

const metal_material = new THREE.MeshStandardMaterial({
  color: 0xffffff,         // 白ベース
  metalness: 1,          // 完全な金属
  roughness: 0.1,          // 少しザラつき（0.0だと鏡面すぎる）
  envMapIntensity: 0.3,    // 環境マップの反射強度（あるとリアル）
  side: THREE.DoubleSide   // 両面描画（必要なら）
});

// 表用マテリアル
const bodyFront = new THREE.MeshStandardMaterial({
  color: 0x888888,
  metalness: 0.8,
  roughness: 0.1,
  envMapIntensity: 1.0,
  side: THREE.FrontSide
});

// 裏用マテリアル
const bodyBack = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  color: 0x999999,
  metalness: 0.3,
  roughness: 1,
  envMapIntensity: 1.0,
  side: THREE.FrontSide,
});

const elevatorA1 = TSys.createElevator(-2.7, 6.62, 36, 1, 1, glass_material, metal_material, bodyFront, bodyBack, true);
scene.add(elevatorA1);
const elevatorA2 = TSys.createElevator(-2.7, 9.9, 37.2, 1, -1, glass_material, metal_material, bodyFront, bodyBack);
scene.add(elevatorA2);

const ElevatorDoorGroup_A1 = elevatorA1.children[1].children[0]
const ElevatorDoorGroup_A2 = elevatorA1.children[1].children[1]
const ElevatorDoorGroup_C1 = elevatorA1.children[2].children[0]
const ElevatorDoorGroup_C2 = elevatorA1.children[2].children[1]
const ElevatorDoorGroup_B1 = elevatorA2.children[1].children[0]
const ElevatorDoorGroup_B2 = elevatorA2.children[1].children[1]
const ElevatorDoorGroup_D1 = elevatorA2.children[2].children[0]
const ElevatorDoorGroup_D2 = elevatorA2.children[2].children[1]
ElevatorDoorGroup_D1.position.y = -3.28
ElevatorDoorGroup_D2.position.y = -3.28
const ElevatorBodyGroup = elevatorA1.children[3]

const elevatorB1 = TSys.createElevator(2.7, 6.62, 36, -1, 1, glass_material, metal_material, bodyFront, bodyBack, true);
scene.add(elevatorB1);
const elevatorB2 = TSys.createElevator(2.7, 9.9, 37.2, -1, -1 ,glass_material, metal_material, bodyFront, bodyBack,);
scene.add(elevatorB2);

const ElevatorDoorGroup_Ab1 = elevatorB1.children[1].children[0]
const ElevatorDoorGroup_Ab2 = elevatorB1.children[1].children[1]
const ElevatorDoorGroup_Cb1 = elevatorB1.children[2].children[0]
const ElevatorDoorGroup_Cb2 = elevatorB1.children[2].children[1]
const ElevatorDoorGroup_Bb1 = elevatorB2.children[1].children[0]
const ElevatorDoorGroup_Bb2 = elevatorB2.children[1].children[1]
const ElevatorDoorGroup_Db1 = elevatorB2.children[2].children[0]
const ElevatorDoorGroup_Db2 = elevatorB2.children[2].children[1]
const ElevatorBodyGroup_B = elevatorB1.children[3]

ElevatorDoorGroup_Cb1.position.y = +3.28
ElevatorDoorGroup_Cb2.position.y = +3.28
ElevatorBodyGroup_B.position.y = +3.28

// グループ全体を移動
// 一定時間待つ関数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ドア開閉アニメーション
async function elevator_door_open(
  ElevatorDoorGroup_1,
  ElevatorDoorGroup_2,
  ElevatorDoorGroup_3,
  ElevatorDoorGroup_4
) {
  const range_num = 100;
  const xOffset = 0.17 / range_num;

  // ドアを開ける（徐々に）
  for (let i = 0; i <= range_num; i++) {
    ElevatorDoorGroup_1.position.x += -xOffset*2;
    ElevatorDoorGroup_2.position.x += -xOffset;

    // 内側は少し遅れて動き始める
    if (i > range_num * 0.05) {
      ElevatorDoorGroup_3.position.x += -xOffset*2;
      ElevatorDoorGroup_4.position.x += -xOffset;
    }

    await sleep(25);
  }

  // 🔁 内側ドアの残り 0.2 分を追加で動かす
  const delayedSteps = Math.floor(range_num * 0.05);
  for (let i = 0; i < delayedSteps; i++) {
    ElevatorDoorGroup_3.position.x += -xOffset*2;
    ElevatorDoorGroup_4.position.x += -xOffset;
    await sleep(25);
  }

  await sleep(7000);

  // ドアを閉める（徐々に）
  for (let i = range_num; i >= 0; i--) {
    ElevatorDoorGroup_1.position.x += xOffset*2;
    ElevatorDoorGroup_2.position.x += xOffset;

    if (i < range_num * 0.95) {  // 外側が先に閉まり、内側は少し遅れて
      ElevatorDoorGroup_3.position.x += xOffset*2;
      ElevatorDoorGroup_4.position.x += xOffset;
    }

    await sleep(25);
  }

  // 🔁 内側ドアの残り 0.2 分を追加で閉じる
  for (let i = 0; i < delayedSteps; i++) {
    ElevatorDoorGroup_3.position.x += xOffset*2;
    ElevatorDoorGroup_4.position.x += xOffset;
    await sleep(25);
  }

}

function getSleepTime(i, range_num, steps) {
  const slowRange = range_num * 0.15; // 10%部分の全ステップ数
  const stepSize = slowRange / steps; // 1段階あたりのステップ数

  if (i < slowRange) {
    // 最初の10%（加速）: 何段階目か計算
    const currentStep = Math.floor(i / stepSize);
    // sleep時間を段階ごとに段階的に減らす（30ms→10ms）
    const sleepStart = 30;
    const sleepEnd = 10;
    const sleepDiff = sleepStart - sleepEnd;
    const sleepTime = sleepStart - (sleepDiff / (steps - 1)) * currentStep;
    return sleepTime;

  } else if (i >= range_num - slowRange) {
    // 最後の10%（減速）: 何段階目か計算
    const currentStep = Math.floor((i - (range_num - slowRange)) / stepSize);
    const sleepStart = 10;
    const sleepEnd = 30;
    const sleepDiff = sleepEnd - sleepStart;
    const sleepTime = sleepStart + (sleepDiff / (steps - 1)) * currentStep;
    return sleepTime;

  } else {
    // 中央80%は一定速度
    return 10;
  }
}

// 無限ループで繰り返し（止めたいなら条件を追加）
async function startLoop() {
  while (true) {
    elevator_door_open(
      ElevatorDoorGroup_A1,
      ElevatorDoorGroup_A2,
      ElevatorDoorGroup_C1,
      ElevatorDoorGroup_C2
    );

    await elevator_door_open(
      ElevatorDoorGroup_Bb1,
      ElevatorDoorGroup_Bb2,
      ElevatorDoorGroup_Db1,
      ElevatorDoorGroup_Db2
    );
    await sleep(7000); // 3秒待ってからまた開ける

    // Cドアを y+方向へスライド（内側ドアを上に移動して2階へ）
    const F2_y = 3.28
    const range_num = 1800
    const yOffset = F2_y/range_num
    const steps = 30
    
    for (let i = 0; i < range_num; i++) {
      ElevatorBodyGroup.position.y += yOffset;
      ElevatorDoorGroup_C1.position.y += yOffset;
      ElevatorDoorGroup_C2.position.y += yOffset;
      ElevatorDoorGroup_D1.position.y += yOffset;
      ElevatorDoorGroup_D2.position.y += yOffset;

      ElevatorBodyGroup_B.position.y -= yOffset;
      ElevatorDoorGroup_Cb1.position.y -= yOffset;
      ElevatorDoorGroup_Cb2.position.y -= yOffset;
      ElevatorDoorGroup_Db1.position.y -= yOffset;
      ElevatorDoorGroup_Db2.position.y -= yOffset;
    
      const sleepTime = getSleepTime(i, range_num, steps);
      await sleep(sleepTime);
    }

    await sleep(3000); // 3秒待ってからまた開ける

    elevator_door_open(
      ElevatorDoorGroup_B1,
      ElevatorDoorGroup_B2,
      ElevatorDoorGroup_D1,
      ElevatorDoorGroup_D2
    );

    await elevator_door_open(
      ElevatorDoorGroup_Ab1,
      ElevatorDoorGroup_Ab2,
      ElevatorDoorGroup_Cb1,
      ElevatorDoorGroup_Cb2
    );

    await sleep(3000); // 3秒待ってからまた開ける


    for (let i = 0; i < range_num; i++) {
      ElevatorBodyGroup.position.y -= yOffset;
      ElevatorDoorGroup_C1.position.y -= yOffset;
      ElevatorDoorGroup_C2.position.y -= yOffset;
      ElevatorDoorGroup_D1.position.y -= yOffset;
      ElevatorDoorGroup_D2.position.y -= yOffset;

      ElevatorBodyGroup_B.position.y += yOffset;
      ElevatorDoorGroup_Cb1.position.y += yOffset;
      ElevatorDoorGroup_Cb2.position.y += yOffset;
      ElevatorDoorGroup_Db1.position.y += yOffset;
      ElevatorDoorGroup_Db2.position.y += yOffset;

      const sleepTime = getSleepTime(i, range_num, steps);
      await sleep(sleepTime);
    }

    await sleep(3000); // 3秒待ってからまた開ける
  }
}

// startLoop(); // 処理開始

// --- 駅用ユーティリティ ---

const arm_material = new THREE.MeshStandardMaterial({
  color: 0x444444,         // 白ベース
  metalness: 1,          // 完全な金属
  roughness: 0.2,          // 少しザラつき（0.0だと鏡面すぎる）
  envMapIntensity: 0.3,    // 環境マップの反射強度（あるとリアル）
  side: THREE.DoubleSide   // 両面描画（必要なら）
});

// パンタフラフ ¯¯"<"¯¯
function createPantograph(Arm_rotation_z) {
  const pantograph = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial(arm_material);

  const Arm_len = 0.45
  const Arm_X_len = Math.sin(Arm_rotation_z)*Arm_len*0.5
  const Arm_Y_len = Math.cos(Arm_rotation_z)*Arm_len
  // 下アーム
  const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.01, Arm_len, 0.01), mat);
  lowerArm.rotation.z = Arm_rotation_z;
  lowerArm.position.set(0, Arm_Y_len*0.5, 0);
  pantograph.add(lowerArm);

  const lowerArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.004, Arm_len-0.1, 0.004), mat);
  lowerArm2.rotation.z = Arm_rotation_z-0.065;
  lowerArm2.position.set(-0.07,(Math.cos(Arm_rotation_z-0.065)*(Arm_len-0.1)*0.5), 0);
  pantograph.add(lowerArm2);

  // 上アーム（斜め）
  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.01, Arm_len, 0.01), mat);
  upperArm.rotation.z = -Arm_rotation_z;
  upperArm.position.set(0, Arm_Y_len*1.5, 0);
  pantograph.add(upperArm.clone());

  const upperArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.004, Arm_len-0.02, 0.004), mat);
  upperArm2.rotation.z = -(Arm_rotation_z-0.0);
  upperArm2.rotation.y = 0.27;
  upperArm2.position.set(+0.03, Arm_Y_len*1.5-0.02, -0.045);
  pantograph.add(upperArm2.clone());

  const upperArm3 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.01), mat);
  upperArm3.rotation.z = -(Arm_rotation_z-0.5);
  upperArm3.position.set(-0.21, Arm_Y_len-0.015, 0);
  pantograph.add(upperArm3.clone());


  pantograph.rotation.y = Math.PI / 2;
  // 接触板
  const contactGroup = new THREE.Group();
  const contact = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.5), new THREE.MeshStandardMaterial(arm_material));
  contact.position.set(Arm_X_len-0.01, Arm_Y_len*2,0);
  contactGroup.add(contact.clone());
  contact.position.set(Arm_X_len+0.01, Arm_Y_len*2,0);
  contactGroup.add(contact.clone());

  const contact_rotation_x = Math.PI / 3
  const contact_Y_len = Math.sin(contact_rotation_x)*0.1*0.5
  const contact_X_len = Math.cos(contact_rotation_x)*0.1*0.5

  const contact2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.1), new THREE.MeshStandardMaterial(arm_material));
  contact2.rotation.x = contact_rotation_x
  contact2.position.set(Arm_X_len, Arm_Y_len*2-contact_Y_len, 0.25+contact_X_len);
  contactGroup.add(contact2.clone());

  contact2.rotation.x = -contact_rotation_x
  contact2.position.x = Arm_X_len
  contact2.position.z = -(0.25+contact_X_len);
  contactGroup.add(contact2.clone());

  contactGroup.position.x = -0.025
  pantograph.add(contactGroup.clone())
  contactGroup.position.x = 0.025
  pantograph.add(contactGroup.clone())

  pantograph.scale.set(2.5,2.3,2)

  return pantograph;
}

function disableShadowRecursive(object3d) {
  if (!object3d) { return; }
  object3d.traverse((node) => {
    if (!node || !node.isMesh) { return; }
    node.castShadow = false;
  });
}

const Trains = []

// 車両設定（テクスチャ対応版）
function TrainSettings(
  length,
  color,
  cars,
  transparency = 1,
  textureHead = {},
  textureMiddle = {},
  textureTail = {}
) {
  // const geo = new THREE.BoxGeometry(1, 1, length);
  // const geo = scene.getObjectById('train')//new THREE.BoxGeometry(1, 1, length);
  // console.log(geo)

  const loader = new THREE.TextureLoader();

  // テクスチャ読み込みヘルパー
  function loadTexture(path) {
    const texture = loader.load(path);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const metalness_num = 1
  const roughness_num = 0.6
  const envMapIntensity_num = 1.0
  // 指定されたテクスチャセットをもとにマテリアル6面分を生成
  function createMaterials(set) {
    const sideRightMat = set.side_right
      ? new THREE.MeshStandardMaterial({ map: loadTexture(set.side_right),   transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num })
      : set.side
        ? new THREE.MeshStandardMaterial({ map: loadTexture(set.side), transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num })
        : new THREE.MeshStandardMaterial({ color, transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num });

    const sideLeftMat = set.side_left
      ? new THREE.MeshStandardMaterial({ map: loadTexture(set.side_left), transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num }) // 反転なし
      : set.side
        ? new THREE.MeshStandardMaterial({ map: loadTexture(set.side), transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num })
        : sideRightMat.clone();

    const topMat = set.top
      ? new THREE.MeshStandardMaterial({ map: loadTexture(set.top), transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num })
      : new THREE.MeshStandardMaterial({ color, transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num });

    const bottomMat = set.bottom
      ? new THREE.MeshStandardMaterial({ map: loadTexture(set.bottom), transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num })
      : topMat.clone();

    const frontMat = set.front
      ? new THREE.MeshStandardMaterial({ map: loadTexture(set.front), transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num })
      : new THREE.MeshStandardMaterial({ color, transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num });

    const backMat = set.back
      ? new THREE.MeshStandardMaterial({ map: loadTexture(set.back), transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num })
      : new THREE.MeshStandardMaterial({ color, transparent: true, opacity: transparency, metalness: metalness_num, roughness: roughness_num, envMap: scene.environment, envMapIntensity: envMapIntensity_num });

    // 面の順番：[右, 左, 上, 下, 前, 後]
    return [
      sideRightMat,  // +X
      sideLeftMat,   // -X
      topMat,        // +Y
      bottomMat,     // -Y
      frontMat,      // +Z
      backMat        // -Z
    ];
  }


  const trainGroup = new THREE.Group(); // これをまとめる親
  const trainCars = [];

  for (let i = 0; i < cars; i++) {
    let textureSet;

    if (i === 0 && Object.keys(textureHead).length > 0) {
      textureSet = textureHead;
    } else if (i === cars - 1 && Object.keys(textureTail).length > 0) {
      textureSet = textureTail;
    } else {
      textureSet = textureMiddle;
    }

    const materials = createMaterials(textureSet);
    // const car = new THREE.Mesh(geo, materials.map(m => m.clone()));

    const car = geo.clone()
    // car.material.envMap = scene.ref;

    // ▼ 車両の位置を z 方向にずらす（中央起点）
    const spacing = 6.95; // 車両の長さと同じだけ間隔を空ける
    car.position.z = - i * spacing;

    // const light = new THREE.PointLight(0xffffff, 2, 3);
    // light.position.set(0,0,0);
    // car.add(light);

    // if (i === 0){
    //   const headlight = new THREE.SpotLight(0xfff5e1, 7);
    //   headlight.angle = Math.PI / 8;
    //   headlight.penumbra = 0.2;
    //   headlight.distance = 10;
    //   headlight.decay = 1;
    //   headlight.castShadow = false;

    //   headlight.position.set(0, -0.3, 1);  // 先頭部に合わせて調整（電車前方向に）
    //   car.add(headlight);
    //   car.add(headlight.target);   // スポットライトはtargetが必須
    //   headlight.target.position.set(0, 0, 4);  // 向き（車両前方）に合わせて調整

    //   // const light = new THREE.PointLight(0xffffff, 3, 5);
    //   // light.position.set(0,0,0);
    //   // car.add(light);

    // } 
    
    // ▼ パンタグラフ設置（例: 1, 4, 7 両目など）
    if (i % 3 === 1) {
      const pantograph = createPantograph(Math.PI / 2.7);
      pantograph.position.set(0, 0.9, 5);
      car.add(pantograph);

      const pantograph2 = createPantograph(Math.PI / -2.1);
      pantograph2.position.set(0, 0.9, -5);
      car.add(pantograph2);
    }

    // const Opposition = car.clone()
    // Opposition.rotation.y = Math.PI
    // trainCars.push(Opposition);
    // trainGroup.add(Opposition); // グループに追加
    
    disableShadowRecursive(car);
    trainCars.push(car);
    trainGroup.add(car); // グループに追加
  }

  trainGroup.userData.cars = trainCars; // 必要ならアクセスしやすく保存
  trainGroup.visible = false;   // 再表示する
  
  scene.add(trainGroup); // シーンに一括追加
  Trains.push(trainGroup)

  return trainGroup;
  
}

// 車両設定（新幹線用）
function Sin_TrainSettings(
  cars,
  textureHead = {},
  textureMiddle = {},
  textureTail = {}
) {
  // const geo = new THREE.BoxGeometry(1, 1, length);
  // const geo = scene.getObjectById('train')//new THREE.BoxGeometry(1, 1, length);
  // console.log(geo)

  const loader = new THREE.TextureLoader();

  // テクスチャ読み込みヘルパー
  function loadTexture(path) {
    const texture = loader.load(path);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const trainGroup = new THREE.Group(); // これをまとめる親
  const trainCars = [];

  for (let i = 0; i < cars; i++) {
    let textureSet;

    if (i === 0 && Object.keys(textureHead).length > 0) {
      textureSet = textureHead;
    } else if (i === cars - 1 && Object.keys(textureTail).length > 0) {
      textureSet = textureTail;
    } else {
      textureSet = textureMiddle;
    }

    // const car = new THREE.Mesh(geo, materials.map(m => m.clone()));

    // ▼ 車両の位置を z 方向にずらす（中央起点）
    const spacing = 6.95; // 車両の長さと同じだけ間隔を空ける
    let car = null
    if (i === 0 || i === cars-1){
      car = LoadModels[1].clone()
      car.position.z = - i * spacing;
      if ( i === 0){
        car.rotation.y = 90 * Math.PI/180
      }
    } else {
      car = LoadModels[2].clone()
      car.position.z = - i * spacing;
    }
    
    // ▼ パンタグラフ設置（例: 1, 4, 7 両目など）
    if (i % 3 === 1) {
      const pantograph = createPantograph(Math.PI / 2.7);
      pantograph.position.set(0, 0.9, 5);
 
      const pantograph2 = createPantograph(Math.PI / -2.1);
      pantograph2.position.set(0, 0.9, -5);
    }

    // const Opposition = car.clone()
    // Opposition.rotation.y = Math.PI
    // trainCars.push(Opposition);
    // trainGroup.add(Opposition); // グループに追加
    
    disableShadowRecursive(car);
    trainCars.push(car);
    trainGroup.add(car); // グループに追加
  }

  trainGroup.userData.cars = trainCars; // 必要ならアクセスしやすく保存
  trainGroup.visible = false;   // 再表示する
  
  scene.add(trainGroup); // シーンに一括追加

  return trainGroup;
  
}

// --- アニメーション ---
// ホームドア開閉
function moveDoorsFromGroup(group, mode, distance = 0.32, duration = 2000) {
  return new Promise(resolve => {

    if (mode === 0) {
      mode = -1;
    }

    const children = group.children;
    const startPositions = children.map(child => child.position.clone());
    const startTime = performance.now();
    let pausedAt = null;
    let pausedDuration = 0;

    function animate(time) {
      if (suspendRunTrainAnimations) {
        if (pausedAt === null) {
          pausedAt = time;
        }
        requestAnimationFrame(animate);
        return;
      }

      if (pausedAt !== null) {
        pausedDuration += (time - pausedAt);
        pausedAt = null;
      }

      const t = Math.min((time - startTime - pausedDuration) / duration, 1);

      children.forEach((child, index) => {
        let angle = child.rotation.y;
        let dirX = Math.sin(angle);
        let dirZ = Math.cos(angle);
        const sign = index % 2 === 0 ? 1 * mode : -1 * mode;
        const start = startPositions[index];
        child.position.set(
          start.x + dirX * distance * sign * t,
          start.y,
          start.z + dirZ * distance * sign * t
        );
      });

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();  // アニメーション終了を通知
      }
    }

    requestAnimationFrame(animate);  // アニメーション開始
  });
}

// 列車の運行
async function runTrain(trainCars, root, track_doors, door_interval, max_speed=0.002, add_speed=0.000005, stop_position={x: 0, y:0, z:0}, start_position = 0, rapid = false, random_time = 1) {

  const Equal_root = TSys.getPointsEveryM(root, 0.01); // spacing=0.1mごと（細かすぎたら25に）

  for (let i=0; i < Equal_root.length; i+=1){
    Equal_root[i].y = Equal_root[i].y+0.95
  }

  const totalPoints = Equal_root.length;

  const length = root.getLength(root);

  const carSpacing = door_interval / length
  
  const maxOffsetT = carSpacing * (trainCars.userData.cars.length + 1);

  let t = start_position

  let speed = max_speed
  let brake_range = 0

  while (speed >= 0){
    speed -= add_speed
    brake_range += speed
  };
  brake_range = brake_range/length
  
  let min_index = 0
  let min_range = Math.sqrt((Equal_root[min_index].x - stop_position.x) ** 2 + (Equal_root[min_index].z - stop_position.z)**2)
  
  for (let i = 0; i < totalPoints; i++){
    let range =  Math.sqrt((Equal_root[i].x - stop_position.x) ** 2 + (Equal_root[i].z - stop_position.z)**2)
    if (min_range > range){
          min_range = range
          min_index = i
        }
  }
  
  const brake_point = ((min_index/totalPoints) - brake_range)
 
  speed = max_speed
  
  let train_stoped = rapid
  if (quattro > 0){train_stoped = true}

  trainCars.visible = false;   // 再表示する
 
  let offsetT = NaN;
  let safeIndex = NaN

  let Pos = NaN
  let Tan = NaN
  let car = NaN // ← ここだけ変わる

  run_num += 1

  const front_right = trainCars.userData.cars[0].children[0]

  // ランダムな秒数（1000〜5000ミリ秒）
  await sleep( 1000 + (Math.random()*random_time) * 15000);
  trainCars.visible = true;   // 再表示する

  async function runCar() {
    if (suspendRunTrainAnimations) {
      requestAnimationFrame(runCar);
      return;
    }

    if (t >= 1 + maxOffsetT) {
      
      if (quattro > 0){
        quattro -= 1
        run_num -= 1
        return
      };

      speed = max_speed
      train_stoped = rapid
      t = 0
      await sleep( 1000 + (Math.random()*random_time) * 15000);
      // return NaN
      
    }
  
    if (speed >= 0){ 
      for (let i = 0; i < trainCars.userData.cars.length; i++) {

        // const offsetT = t - carSpacing * i;
        offsetT = t - carSpacing * i;
    
        // offsetT が負ならその車両はまだ線路に出ない
        if (offsetT < 0 | offsetT > 1) {
          trainCars.userData.cars[i].visible = false;
          continue;
        } else {
          trainCars.userData.cars[i].visible = true;
        };
      
        safeIndex = Math.min(Math.floor(offsetT * totalPoints), totalPoints - 2);
      
        Pos = Equal_root[safeIndex];
        Tan = Equal_root[safeIndex+1].clone().sub(Pos).normalize();
        
        // if (i === 0 & isNight){
        //   if (Pos.z <= -20) {
        //     front_right.visible = true;
        //   } else {
        //     front_right.visible = false;
        //   }
        // } else if (!isNight) {front_right.visible = false}
      
        car = trainCars.userData.cars[i]; // ← ここだけ変わる
        car.position.copy(Pos);
        if (i === 0){
          Tan.x *= -1
          Tan.z *= -1
          Tan.y *= -1
          car.lookAt(Pos.clone().add(Tan));
        } else {
          car.lookAt(Pos.clone().add(Tan));
        }
      
      }

      if (train_stoped === false && t > brake_point){
        speed -= add_speed;
      } else {
        speed += add_speed
        if (speed >= max_speed){speed = max_speed}
      }
      
      t += (speed / length);

    } else {

      train_stoped = true
      speed = 0

      await sleep(3000); // 3秒待ってからまた開ける
      if (run_STOP){
        trainCars.visible = false;
        run_num -= 1
        return
      }
      await moveDoorsFromGroup(track_doors,1);

      await sleep(7000); // 3秒待ってからまた開ける
      if (run_STOP){
        trainCars.visible = false;
        moveDoorsFromGroup(track_doors,0);
        run_num -= 1
        return
      }
      await moveDoorsFromGroup(track_doors,0)
      if (run_STOP){
        trainCars.visible = false;
        run_num -= 1
        return
      }
      await sleep(3000); // 3秒待ってからまた開ける

    }

    if (run_STOP){
      trainCars.visible = false;
      run_num -= 1
      return
    }
    requestAnimationFrame(runCar);
    
  }

  runCar();

}

// --- リサイズ対応 ---
// Use unified handler
window.addEventListener('resize', onWindowResize, false);

let y = 6
const trackSetup = await initTrackSetup();
const {
  Points_0,
  Points_1,
  Points_2,
  Points_3,
  JK_upbound_point,
  JY_upbound_point,
  JY_downbound_point,
  JK_downbound_point,
  J_UJT_upbound_point,
  J_UJT_downbound_point,
  sinkansen_upbound_point,
  sinkansen_downbound_point,
  marunouchi_point,
  line_1,
  line_2,
  line_3,
  line_4,
  JK_upbound,
  JY_upbound,
  JY_downbound,
  JK_downbound,
  J_UJT_upbound,
  J_UJT_downbound,
  sinkansen_upbound,
  sinkansen_downbound,
  marunouchi,
  railTrackDefs,
  railTrackCurveMap,
} = trackSetup;

let railTubeMesh = null;
let railTubeDirty = false;
let railModeActive = false;
const railTubeDefaultColor = 0x2f2f2f;
const railTubeColors = [
  0xff5f5f,
  0xffa94d,
  0xffd84d,
  0xa3d977,
  0x2ecc71,
  0x1abc9c,
  0x4aa3ff,
  0x9b59b6,
  0x8e44ad,
  0x95a5a6,
  0x34495e,
  0xe67e22,
];
const railSelectionRadius = 100;
const railSelectionRange = 3;
const railSelectionLineColor = 0x00ff00;
const railSelectionLineName = 'RailSelected';
let selectedRailPoint = null;

const structureSampleInterval = 0.5;
const structureHoverColor = 0xffff33;
const structurePinnedColor = 0xff33aa;
const structureSelectedColor = 0x33ffaa;
const structureDataUrl = 'map_data/structure.json';
let structureModeActive = false;
let structureViewActive = false;
let constructionModeActive = false;
let structureSamplesDirty = true;
let structureSamplePoints = [];
let structureHoverPoint = null;
let structureHoverTrackName = null;
let structureHoverPin = null;
const structurePinnedPins = [];
const constructionSelectedPins = [];
let lastPointerScreen = null;
let structurePointerBlockedByUI = false;
let pointerBlockedByUI = false;

function buildSquareTubeMesh(curves, {
  size = 0.35,
  steps = 600,
  colors = railTubeColors,
} = {}) {
  const half = size * 0.5;
  const shape = new THREE.Shape([
    new THREE.Vector2(-half, -half),
    new THREE.Vector2(half, -half),
    new THREE.Vector2(half, half),
    new THREE.Vector2(-half, half),
    new THREE.Vector2(-half, -half),
  ]);

  const geometries = curves.map((curve) => new THREE.ExtrudeGeometry(shape, {
    steps,
    bevelEnabled: false,
    extrudePath: curve,
  }));

  const mergedGeometry = mergeGeometries(geometries, true);
  const materials = curves.map((_, index) => new THREE.MeshStandardMaterial({
    color: colors[index] ?? railTubeDefaultColor,
  }));
  const mesh = new THREE.Mesh(mergedGeometry, materials);
  mesh.name = 'RailTubeMesh';
  return mesh;
}

function setRailTubeRenderVisible(visible) {
  if (!railTubeMesh) { return; }
  const materials = Array.isArray(railTubeMesh.material)
    ? railTubeMesh.material
    : [railTubeMesh.material];
  materials.forEach((material) => {
    if (!material) { return; }
    material.transparent = true;
    material.opacity = visible ? 1 : 0;
  });
}

function disposeRailTube() {
  if (!railTubeMesh) { return; }
  if (railTubeMesh.parent) {
    railTubeMesh.parent.remove(railTubeMesh);
  }
  if (railTubeMesh.geometry && typeof railTubeMesh.geometry.dispose === 'function') {
    railTubeMesh.geometry.dispose();
  }
  const materials = Array.isArray(railTubeMesh.material)
    ? railTubeMesh.material
    : [railTubeMesh.material];
  materials.forEach((material) => material?.dispose?.());
  railTubeMesh = null;
}

function toggleRailTube(visible) {
  if (visible) {
    if (!railTubeMesh || railTubeDirty) {
      disposeRailTube();
      railTubeMesh = buildSquareTubeMesh(railTrackDefs.map((track) => track.curve));
      scene.add(railTubeMesh);
      railTubeDirty = false;
    }
    railTubeMesh.visible = true;
    setRailTubeRenderVisible(true);
  } else if (railTubeMesh) {
    setRailTubeRenderVisible(false);
  }
}

function getRailTrackByName(trackName) {
  return railTrackDefs.find((track) => track.name === trackName) || null;
}

function clearRailSelectionLine() {
  clean_object([railSelectionLineName]);
}

function drawRailSelectionLine(trackName, pointIndex) {
  const track = getRailTrackByName(trackName);
  if (!track) { return; }
  const points = track.points;
  if (!points || points.length < 2) { return; }
  const start = Math.max(0, pointIndex - railSelectionRange);
  const end = Math.min(points.length - 1, pointIndex + railSelectionRange);
  const segment = points.slice(start, end + 1).map((point) => point.clone());
  if (segment.length < 2) { return; }
  clearRailSelectionLine();
  const curve = new THREE.CatmullRomCurve3(segment);
  TSys.createTrack(curve, 0, railSelectionLineColor, railSelectionLineName);
}

function updateRailPointFromMesh(mesh) {
  if (!mesh || !mesh.userData) { return; }
  const { trackName, pointIndex } = mesh.userData;
  if (trackName == null || pointIndex == null) { return; }
  const track = getRailTrackByName(trackName);
  if (!track || !track.points[pointIndex]) { return; }
  track.points[pointIndex].copy(mesh.position);
  selectedRailPoint = { trackName, pointIndex };
  railTubeDirty = true;
  structureSamplesDirty = true;
  drawRailSelectionLine(trackName, pointIndex);
}

function refreshRailSelectionTargets() {
  removeMeshes(targetObjects);
  selectedRailPoint = null;
  clearRailSelectionLine();

  const radiusSq = railSelectionRadius * railSelectionRadius;
  const camPos = camera.position;

  railTrackDefs.forEach((track) => {
    track.points.forEach((point, index) => {
      if (!point) { return; }
      if (point.distanceToSquared(camPos) > radiusSq) { return; }
      const mesh = new THREE.Mesh(cube_geometry, cube_material.clone());
      mesh.position.copy(point);
      mesh.userData = { trackName: track.name, pointIndex: index };
      scene.add(mesh);
      targetObjects.push(mesh);
    });
  });
}

function buildStructureSamplePoints() {
  structureSamplePoints = [];
  railTrackDefs.forEach((track) => {
    const sampled = TSys.getPointsEveryM(track.curve, structureSampleInterval);
    sampled.forEach((point) => {
      structureSamplePoints.push({ trackName: track.name, point });
    });
  });
  structureSamplesDirty = false;
}

function getNearestStructureTrackName(position) {
  if (!position) { return null; }
  if (structureSamplesDirty || structureSamplePoints.length === 0) {
    buildStructureSamplePoints();
  }
  let bestName = null;
  let bestDist = Infinity;
  for (let i = 0; i < structureSamplePoints.length; i++) {
    const sample = structureSamplePoints[i];
    const dist = sample.point.distanceToSquared(position);
    if (dist < bestDist) {
      bestDist = dist;
      bestName = sample.trackName ?? null;
    }
  }
  return bestName;
}

function ensureStructureHoverPin() {
  if (structureHoverPin) { return; }
  structureHoverPin = TSys.Map_pin(0, 0, 0, 0.15, structureHoverColor);
  structureHoverPin.name = 'StructureHoverPin';
}

function updateStructureHover() {
  if (!structureModeActive || !lastPointerScreen || structurePointerBlockedByUI) {
    if (structureHoverPin) {
      structureHoverPin.visible = false;
    }
    structureHoverPoint = null;
    structureHoverTrackName = null;
    return;
  }

  if (structureSamplesDirty || structureSamplePoints.length === 0) {
    buildStructureSamplePoints();
  }

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w === 0 || h === 0) { return; }

  const targetX = lastPointerScreen.x;
  const targetY = lastPointerScreen.y;

  let best = null;
  let bestDist = Infinity;
  const tmp = new THREE.Vector3();

  structureSamplePoints.forEach((sample) => {
    tmp.copy(sample.point).project(camera);
    if (tmp.z < -1 || tmp.z > 1) { return; }
    const sx = (tmp.x + 1) * 0.5 * w;
    const sy = (1 - (tmp.y + 1) * 0.5) * h;
    const dx = sx - targetX;
    const dy = sy - targetY;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = sample;
    }
  });

  if (!best) {
    if (structureHoverPin) {
      structureHoverPin.visible = false;
    }
    structureHoverPoint = null;
    structureHoverTrackName = null;
    return;
  }

  structureHoverPoint = best.point.clone();
  structureHoverTrackName = best.trackName ?? null;
  ensureStructureHoverPin();
  structureHoverPin.position.copy(best.point);
  structureHoverPin.visible = true;
}

function placeStructurePinnedPin() {
  if (!structureHoverPoint) { return; }
  placeStructurePinnedPinAt(structureHoverPoint, structureHoverTrackName);
}

function placeStructurePinnedPinAt(position, trackName = null) {
  if (!position) { return; }
  const pos = position instanceof THREE.Vector3
    ? position
    : new THREE.Vector3(position.x, position.y, position.z);
  const resolvedTrackName = trackName ?? getNearestStructureTrackName(pos);
  const pin = TSys.Map_pin(
    pos.x,
    pos.z,
    pos.y,
    0.2,
    structurePinnedColor
  );
  pin.name = 'StructurePinnedPin';
  pin.userData = { ...pin.userData, constructionSelected: false, trackName: resolvedTrackName };
  pin.visible = structureViewActive || structureModeActive || constructionModeActive;
  structurePinnedPins.push(pin);
}

function clearStructurePinnedPins() {
  clearConstructionSelection();
  for (let i = structurePinnedPins.length - 1; i >= 0; i--) {
    const pin = structurePinnedPins[i];
    if (pin && pin.parent) {
      pin.parent.remove(pin);
    }
    if (pin && pin.geometry && typeof pin.geometry.dispose === 'function') {
      pin.geometry.dispose();
    }
    if (pin && pin.material && typeof pin.material.dispose === 'function') {
      pin.material.dispose();
    }
    structurePinnedPins.splice(i, 1);
  }
}

function setStructurePinnedVisibility(visible) {
  structurePinnedPins.forEach((pin) => {
    if (pin) {
      pin.visible = visible;
    }
  });
}

function updateStructurePinnedVisibility() {
  setStructurePinnedVisibility(structureViewActive || structureModeActive || constructionModeActive);
}

function setPinColor(pin, color) {
  if (!pin || !pin.material) { return; }
  if (Array.isArray(pin.material)) {
    pin.material.forEach((material) => material?.color?.set?.(color));
    return;
  }
  pin.material.color?.set?.(color);
}

function isConstructionPinSelected(pin) {
  return Boolean(pin?.userData?.constructionSelected);
}

function setConstructionPinSelected(pin, selected) {
  if (!pin) { return; }
  pin.userData = pin.userData || {};
  pin.userData.constructionSelected = selected;
  setPinColor(pin, selected ? structureSelectedColor : structurePinnedColor);
}

function clearConstructionSelection() {
  constructionSelectedPins.forEach((pin) => {
    setConstructionPinSelected(pin, false);
  });
  constructionSelectedPins.length = 0;
}

function toggleConstructionPinSelection(pin) {
  if (!pin) { return; }
  if (isConstructionPinSelected(pin)) {
    setConstructionPinSelected(pin, false);
    const index = constructionSelectedPins.indexOf(pin);
    if (index !== -1) {
      constructionSelectedPins.splice(index, 1);
    }
    return;
  }
  setConstructionPinSelected(pin, true);
  constructionSelectedPins.push(pin);
}

function pickStructurePinnedPin() {
  if (structurePinnedPins.length === 0) { return null; }
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(structurePinnedPins, false);
  if (hits.length === 0) { return null; }
  return hits[0].object;
}

function getSelectedTrackCurvesForConstruction() {
  const pinGroups = new Map();
  constructionSelectedPins.forEach((pin) => {
    const trackName = pin.userData?.trackName;
    if (typeof trackName !== 'string' || trackName.length === 0) { return; }
    if (!pinGroups.has(trackName)) {
      pinGroups.set(trackName, []);
    }
    pinGroups.get(trackName).push(pin.position.clone());
  });

  const getNearestTOnCurve = (curve, point, resolution = 500) => {
    let bestT = 0;
    let bestDist = Infinity;
    const sample = new THREE.Vector3();
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution;
      sample.copy(curve.getPointAt(t));
      const dist = sample.distanceToSquared(point);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
    return bestT;
  };

  const result = [];
  pinGroups.forEach((pins, trackName) => {
    const baseCurve = railTrackCurveMap[trackName];
    if (!baseCurve) { return; }
    if (pins.length < 2) {
      result.push({ trackName, curve: baseCurve.clone() });
      return;
    }
    const sortedByT = pins
      .map((point) => ({ point, t: getNearestTOnCurve(baseCurve, point) }))
      .sort((a, b) => a.t - b.t);
    const start = sortedByT[0].point;
    const end = sortedByT[sortedByT.length - 1].point;
    const segmentCurve = findCurveRange(baseCurve, start, end);
    result.push({ trackName, curve: segmentCurve });
  });

  return result;
}

function getOrderedTracksByLateralPosition(trackCurves, sampleDistance = 0.5) {
  if (!Array.isArray(trackCurves) || trackCurves.length === 0) {
    return [];
  }
  const ref = trackCurves[0];
  const refStart = ref.curve.getPointAt(0).clone();
  const refLength = ref.curve.getLength();
  const refSampleT = refLength > 0 ? Math.min(sampleDistance / refLength, 1) : 0;
  const refEnd = ref.curve.getPointAt(refSampleT).clone();
  const refDir = refEnd.sub(refStart).setY(0);
  if (refDir.lengthSq() === 0) {
    refDir.set(0, 0, 1);
  } else {
    refDir.normalize();
  }
  const refAngle = Math.atan2(refDir.x, refDir.z);
  const normalizeRadSigned = (rad) => {
    let value = rad;
    while (value > Math.PI) { value -= Math.PI * 2; }
    while (value < -Math.PI) { value += Math.PI * 2; }
    return value;
  };

  return trackCurves.map((entry) => {
    let workingCurve = entry.curve.clone();
    const rawStart = workingCurve.getPointAt(0).clone();
    const rawEnd = workingCurve.getPointAt(1).clone();
    const dirB = rawEnd.clone().sub(rawStart).setY(0);
    if (dirB.lengthSq() === 0) {
      dirB.copy(refDir);
    } else {
      dirB.normalize();
    }
    const dot = Math.min(1, Math.max(-1, refDir.dot(dirB)));
    const angleBetween = Math.acos(dot);
    let reversed = false;
    if (angleBetween >= Math.PI * 0.5 && entry.trackName !== ref.trackName) {
      reversed = true;
      const reversedPoints = workingCurve.getPoints(300).map((point) => point.clone()).reverse();
      workingCurve = new THREE.CatmullRomCurve3(reversedPoints);
    }
    const point = workingCurve.getPointAt(0).clone();
    const vec = point.sub(refStart).setY(0);
    const distance = vec.length();
    const vecNorm = distance > 0 ? vec.clone().multiplyScalar(1 / distance) : new THREE.Vector3(0, 0, 1);
    const angle = Math.atan2(vecNorm.x, vecNorm.z);
    const delta = normalizeRadSigned(angle - refAngle);
    const xLocal = Math.sin(delta) * distance;
    return {
      trackName: entry.trackName,
      xLocal,
      delta,
      distance,
      reversed,
      curve: workingCurve,
      refTrackName: ref.trackName,
    };
  }).sort((a, b) => b.xLocal - a.xLocal);
}

function getEdgeTrackNamesForConstruction(sampleDistance = 0.5) {
  const trackCurves = getSelectedTrackCurvesForConstruction();
  const ordered = getOrderedTracksByLateralPosition(trackCurves, sampleDistance);
  if (ordered.length === 0) {
    return { right: null, left: null, ordered: [] };
  }
  return {
    right: ordered[0].trackName,
    left: ordered[ordered.length - 1].trackName,
    ordered,
  };
}

function logPillarSideJudgement() {
  const trackCurves = getSelectedTrackCurvesForConstruction();
  if (trackCurves.length < 2) {
    console.warn('pillar judgement requires at least 2 selected tracks.');
    return;
  }
  const rows = [];
  for (let i = 0; i < trackCurves.length; i++) {
    for (let j = i + 1; j < trackCurves.length; j++) {
      const a = trackCurves[i];
      const b = trackCurves[j];
      const side = TSys.getCurveSideByDirection(a.curve, b.curve, 0.5);
      rows.push({
        leftTrack: a.trackName,
        rightTrack: b.trackName,
        side,
      });
    }
  }
  const order = { right: 0, center: 1, left: 2 };
  rows.sort((r1, r2) => {
    const v1 = order[r1.side] ?? 99;
    const v2 = order[r2.side] ?? 99;
    if (v1 !== v2) { return v1 - v2; }
    return `${r1.leftTrack}->${r1.rightTrack}`.localeCompare(`${r2.leftTrack}->${r2.rightTrack}`);
  });
  rows.forEach((row) => {
  });

  const scored = getOrderedTracksByLateralPosition(trackCurves, 0.5);
  const reversedTracks = scored.filter((row) => row.reversed).map((row) => row.trackName);
  if (reversedTracks.length > 0) {
  } else {
  }
  if (scored.length > 0) {
    const rightmost = scored[0].trackName;
    const leftmost = scored[scored.length - 1].trackName;
  }
}

async function loadStructureData(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    if (!data || typeof data !== 'object' || !Array.isArray(data.pins)) {
      return;
    }
    clearStructurePinnedPins();
    data.pins.forEach((pin) => {
      if (!pin || !Number.isFinite(pin.x) || !Number.isFinite(pin.y) || !Number.isFinite(pin.z)) {
        return;
      }
      placeStructurePinnedPinAt(pin, pin.trackName ?? null);
    });
    updateStructurePinnedVisibility();
  } catch (err) {
    console.warn('structure.json load failed', err);
  }
}
function buildStructurePayload() {
  return {
    meta: {
      version: 1,
      savedAt: new Date().toISOString(),
    },
    pins: structurePinnedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    })),
  };
}

function downloadStructureData() {
  const payload = buildStructurePayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'structure.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  alert('structure.json を保存しました。');
}

const saveStructureButton = document.getElementById('save-structure-data');
if (saveStructureButton) {
  saveStructureButton.addEventListener('click', downloadStructureData);
}

await loadStructureData(structureDataUrl);

function sliceCurvePoints(curve, startRatio, endRatio, resolution = 1000) {
  const points = curve.getPoints(resolution);
  const startIndex = Math.floor(startRatio * points.length);
  const endIndex = Math.floor(endRatio * points.length);
  const sliced = points.slice(startIndex, endIndex);
  return new THREE.CatmullRomCurve3(sliced);
}

function findCurveRange(curve, targetA, targetB, { axis = 'z', resolution = 1000 } = {}) {
  const sampledPoints = curve.getPoints(resolution);
  const lastIndex = sampledPoints.length - 1;

  const isVectorLike = (value) =>
    value instanceof THREE.Vector3 ||
    (value && typeof value === 'object' && ('x' in value || 'y' in value || 'z' in value));

  const useVectorTargets = isVectorLike(targetA) && isVectorLike(targetB);

  const getComponent = (value, key) => {
    if (value instanceof THREE.Vector3) {
      return value[key];
    }
    if (value && typeof value === 'object' && key in value) {
      return value[key];
    }
    return undefined;
  };

  const hasAnyComponent = (value) => ['x', 'y', 'z'].some((key) => getComponent(value, key) !== undefined);

  const axisKey = axis === 'x' ? 'x' : axis === 'y' ? 'y' : 'z';

  const findNearestIndex = (target, searchStart = 0, searchEnd = lastIndex) => {
    let closestIndex = searchStart;
    let smallestMetric = Infinity;

    if (useVectorTargets) {
      if (!hasAnyComponent(target)) {
        return closestIndex;
      }

      for (let i = searchStart; i <= searchEnd; i++) {
        const point = sampledPoints[i];
        let metric = 0;
        let usedComponents = 0;

        ['x', 'y', 'z'].forEach((key) => {
          const component = getComponent(target, key);
          if (component !== undefined) {
            const diff = point[key] - component;
            metric += diff * diff;
            usedComponents += 1;
          }
        });

        if (usedComponents === 0) {
          continue;
        }

        if (metric < smallestMetric) {
          smallestMetric = metric;
          closestIndex = i;
        }
      }
    } else {
      for (let i = searchStart; i <= searchEnd; i++) {
        const diff = Math.abs(sampledPoints[i][axisKey] - target);
        if (diff < smallestMetric) {
          smallestMetric = diff;
          closestIndex = i;
        }
      }
    }

    return closestIndex;
  };

  let firstIndex = findNearestIndex(targetA);
  let secondIndex = findNearestIndex(targetB);

  if (!useVectorTargets) {
    if (targetA <= targetB && secondIndex < firstIndex) {
      secondIndex = findNearestIndex(targetB, firstIndex, lastIndex);
    } else if (targetA > targetB && secondIndex > firstIndex) {
      secondIndex = findNearestIndex(targetB, 0, firstIndex);
    }
  }

  let startIndex = Math.min(firstIndex, secondIndex);
  let endIndex = Math.max(firstIndex, secondIndex);

  if (startIndex === endIndex) {
    if (endIndex < lastIndex) {
      endIndex += 1;
    } else if (startIndex > 0) {
      startIndex -= 1;
    }
  }

  const slicePoints = sampledPoints
    .slice(startIndex, endIndex + 1)
    .map((point) => point.clone());

  const Range = {
    startIndex,
    endIndex,
    startRatio: startIndex / lastIndex,
    endRatio: endIndex / lastIndex,
    startPoint: sampledPoints[startIndex].clone(),
    endPoint: sampledPoints[endIndex].clone(),
    slicePoints,
    sliceCurve: slicePoints.length > 1 ? new THREE.CatmullRomCurve3(slicePoints) : null,
  };
  
  return Range.sliceCurve ?? sliceCurvePoints(curve, Range.startRatio, Range.endRatio);
}

// 物体描画
const cube_geometry = new THREE.BoxGeometry();
const cube_material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const steelFrameMode = createSteelFrameMode(scene, cube_geometry, cube_material);
const cube = new THREE.Mesh(cube_geometry, cube_material);
let targetObjects = [];
const targetPins = [];

const {
  door_interval,
  track1_doors,
  track2_doors,
  track3_doors,
  track4_doors,
} = applyFixedPlacements({
  TSys,
  line_1,
  line_2,
  line_3,
  line_4,
  Points_0,
  Points_1,
  Points_2,
  Points_3,
  JK_upbound,
  JY_upbound,
  JY_downbound,
  JK_downbound,
  J_UJT_upbound,
  J_UJT_downbound,
  sinkansen_upbound,
  sinkansen_downbound,
  marunouchi,
  train_width,
  car_Spacing,
  y,
  LoadModels,
  scene,
  findCurveRange,
  targetObjects,
  resetMeshListOpacity,
  setMeshListOpacity,
});
// const board_length_1 = tunnel_1.getLength(line_4)/quantity;
// const board_length_2 = tunnel_2.getLength(line_4)/quantity;
// const points_1 = TSys.RailMargin(TSys.getPointsEveryM(tunnel_1, board_length_1), 1);
// const points_2 = TSys.RailMargin(TSys.getPointsEveryM(tunnel_2, board_length_2), -1);

// for(let i=0; i < points_1.length-1; i++){
//   const coordinate1 = points_1[i]
//   const coordinate2 = points_2[i]
  
//   const coordinate4 = points_1[i+1]
//   const coordinate3 = points_2[i+1]

//   const shape = new THREE.Shape();
//   shape.moveTo(coordinate1.x, coordinate1.z);
//   shape.lineTo( coordinate2.x, coordinate2.z);
//   shape.lineTo(coordinate3.x, coordinate3.z);
//   shape.lineTo(coordinate4.x, coordinate4.z);

//   const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false });
//   const material = new THREE.MeshStandardMaterial({
//     color: 0x333333,
//     metalness: 0.5,
//     roughness: 0.9,
//     envMap: scene.environment,  // もし読み込んでるなら
//     envMapIntensity: 3,
//     side: THREE.FrontSide
//   });
  
  
//   const mesh = new THREE.Mesh(geometry, material);

//   mesh.rotation.x = 91 * Math.PI / 180;
//   mesh.position.y = 7.25; // 高さ1.5に移動

//   scene.add(mesh);

// }

// 桁橋 実装中
// TSys.placeGirderBridge(bridge_2,bridge_3,9,2)

// 電車の運行
// const max_speed = 0.001 // 制限速度(最高)
// const add_speed = 0.0000010 // 追加速度(加速/減速)
const max_speed = 0.1 // 制限速度(最高)
const add_speed = 0.00008 // 追加速度(加速/減速)

const exhibition_tyuou = TrainSettings(
  train_width,
  0xa15110,
  3,
  1,
);

const exhibition_soubu = TrainSettings(
  train_width,
  0xaaaa00,
  3,
  1,
);

exhibition_tyuou.position.set(11,0.8,15)
exhibition_tyuou.visible = false;   // 再表示する
exhibition_soubu.position.set(13,0.8,15)
exhibition_soubu.visible = false;   // 再表示する

const Train_1 = TrainSettings(
  train_width,
  0xaaaaaa,
  12,
  1,
);

const Train_4 = TrainSettings(
  train_width,
  0xaaaaaa,
  12,
  1,
);

const reversedCurve_4 = new THREE.CatmullRomCurve3(
  line_4.getPoints(100).reverse()
);

const Train_2 = TrainSettings(
  train_width,
  0xaaaaaa,
  10,
  1,
);

const Train_3 = TrainSettings(
  train_width,
  0xaaaaaa,
  10,
  1,
);

const Train_5 = TrainSettings(
  train_width,
  0xaaaaaa,
  10,
  1,
);

const Train_6 = TrainSettings(
  train_width,
  0xaaaaaa,
  10,
  1,
);

const Train_7 = Sin_TrainSettings(
  10,
);
const Train_8 = Sin_TrainSettings(
  10,
);

const Train_9 = TrainSettings(
  train_width,
  0xaaaaaa,
  10,
  1,
);
const Train_a = TrainSettings(
  train_width,
  0xaaaaaa,
  10,
  1,
);

const Train_b = TrainSettings(
  train_width,
  0xaaaaaa,
  10,
  1,
);
const Train_c = TrainSettings(
  train_width,
  0xaaaaaa,
  10,
  1,
);


const reversedCurve_3 = new THREE.CatmullRomCurve3(
  line_3.getPoints(100).reverse()
);

const J_UJT_U = new THREE.CatmullRomCurve3(
  J_UJT_upbound.getPoints(100).reverse()
);
const si_U = new THREE.CatmullRomCurve3(
  sinkansen_upbound.getPoints(100).reverse()
);

const JK_U = new THREE.CatmullRomCurve3(
  JK_upbound.getPoints(100).reverse()
);

const JY_U = new THREE.CatmullRomCurve3(
  JY_upbound.getPoints(100).reverse()
);

TextureToggle()

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// ボタン取得
let button = document.getElementById("toggle-crossover");
let run_quattro = 0
// クアトロ交差を実行する関数
async function startQuadrupleCrossDemo() {
  
  run_quattro += 1
  const run_number = run_quattro
  
  // ボタン押下イベント（要求をフラグにする）
  button.addEventListener("click", () => {
    crossoverRequested = true;
    button.innerText = `立体交差 [ 準備中... ]（列車未撤収 ${run_num} 編成）`;
  });

  // ボタン押下イベント（要求をフラグにする）
  button.addEventListener("touchstart", () => {
    crossoverRequested = true;
    button.innerText = `立体交差 [ 準備中... ]（列車未撤収 ${run_num} 編成）`;
  });

  crossoverRequested = true;

  while (run_quattro != run_number){
    await sleep(2000)
  }

  run_STOP = true
  quattro = 4

  while (run_num > 0){
    if (run_quattro > run_number){
      return
    }  
    button.innerText = `立体交差 [ 準備中... ]（列車未撤収 ${run_num} 編成）`;
    await sleep(2000)
  }

  run_STOP = false

  // 4本の列車を同時にスタート
  runTrain(Train_3, reversedCurve_3, track3_doors, door_interval, max_speed, add_speed, 0.501, 0.5)
  runTrain(Train_4, reversedCurve_4, track4_doors, door_interval, max_speed, add_speed, 0.5439, 0.5)
  runTrain(Train_1, line_1, track1_doors, door_interval, max_speed, add_speed, 0.7695, -0.4)
  runTrain(Train_2, line_2, track2_doors, door_interval, max_speed, add_speed, 0.777 -0.4)

  while (quattro > 0){
    if (run_quattro > run_number){
      return
    }  
    button.innerText = `立体交差 実行中...（走行中 ${run_num}）`;
    await sleep(2000)
  }

  button.innerText = `ランダム立体交差（クアトロ交差）切替`

  runTrain(Train_1, line_1, track1_doors, door_interval, max_speed, add_speed, 0.7695)
  runTrain(Train_2, line_2, track2_doors, door_interval, max_speed, add_speed, 0.777)
  runTrain(Train_3, reversedCurve_3, track3_doors, door_interval, max_speed, add_speed, 0.501)
  runTrain(Train_4, reversedCurve_4, track4_doors, door_interval, max_speed, add_speed, 0.5439)

  run_quattro = 0
  crossoverRequested = false;
}

// document.getElementById("toggle-crossover").addEventListener("click", () => {
//   startQuadrupleCrossDemo();
// });

// document.getElementById("toggle-crossover").addEventListener("touchstart", () => {
//   startQuadrupleCrossDemo();
// });

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

runTrain(Train_1, line_1, track1_doors, door_interval, max_speed, add_speed, {x: 5.004321528601909, y: 5.7801280229757035, z: 37.4120950158768})
runTrain(Train_2, line_2, track2_doors, door_interval, max_speed, add_speed, {x: 1.0240355423268666, y: 5.816552915007958, z: 37.15240930025928})
runTrain(Train_3, reversedCurve_3, track3_doors, door_interval, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405})
runTrain(Train_4, reversedCurve_4, track4_doors, door_interval, max_speed, add_speed, {x: -3.649657039547105, y: 6.160546555847148, z: -37.92222740355654})

runTrain(Train_5, J_UJT_downbound, track3_doors, door_interval, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405}, 0, true, 8)
runTrain(Train_6, J_UJT_U, track3_doors, door_interval, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405}, 0, true, 8)

runTrain(Train_7, sinkansen_downbound, track3_doors, 7.4, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405}, 0, true, 8)
runTrain(Train_8, si_U, track3_doors, 7.4, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405}, 0, true, 8)

runTrain(Train_9, JY_downbound, track3_doors, door_interval, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405}, 0, true, 8)
runTrain(Train_a, JK_downbound, track3_doors, door_interval, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405}, 0, true, 8)

runTrain(Train_b, JY_U, track3_doors, door_interval, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405}, 0, true, 8)
runTrain(Train_c, JK_U, track3_doors, door_interval, max_speed, add_speed, {x: -0.6148349428903073, y: 5.777509336861839, z: -25.499137220900405}, 0, true, 8)

// runTrain(, reversedCurve_4, track4_doors, door_interval, max_speed, add_speed, {x: -3.649657039547105, y: 6.160546555847148, z: -37.92222740355654}, true)

// 全面展望 -----------------------------------------------------------------

let frontViewActive = false;
let currentTrainCar = null;
let frontViewRequestId = null;
// 各列車の定義（先頭車両）
const trainCars = {
  1: Train_1.userData.cars[0],
  2: Train_2.userData.cars[0],
  3: Train_3.userData.cars[0],
  4: Train_4.userData.cars[0],
};

function startFrontView(trainCar) {
  currentTrainCar = trainCar;
  frontViewActive = true;

  function update() {
    if (!frontViewActive || !currentTrainCar) return;

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const direction = new THREE.Vector3();

    currentTrainCar.getWorldPosition(position);
    currentTrainCar.getWorldQuaternion(quaternion);
    currentTrainCar.getWorldDirection(direction);

    // オフセット（少し後ろ＆上から）
    const offset = new THREE.Vector3(0, 0.2, -3.4);
    offset.applyQuaternion(quaternion);

    camera.position.copy(position).add(offset);

    // === 🔽 Yaw / Pitch で視線方向を調整 ===
    const yaw = Math.atan2(-direction.x, -direction.z);   // Y軸回転（左右）
    const pitch = Math.asin(direction.y);               // X軸回転（上下）

    // 必要な変数に代入（外部で使いたい場合）
    cameraAngleY = yaw;
    cameraAngleX = pitch;

    camera.rotation.set(pitch, yaw, 0); // ← Three.jsは (X, Y, Z) の順です
    // ====================================

    frontViewRequestId = requestAnimationFrame(update);
  }

  update();
}

function stopFrontView() {
  frontViewActive = false;
  if (frontViewRequestId !== null) {
    cancelAnimationFrame(frontViewRequestId);
    frontViewRequestId = null;
  }
}

const fbuttons = document.querySelectorAll(".frontViewBtn");

fbuttons.forEach(button => {

  button.addEventListener("click", () => {
    const trainNum = parseInt(button.dataset.train);
    const selectedCar = trainCars[trainNum];

    if (!frontViewActive || currentTrainCar !== selectedCar) {
      stopFrontView(); // 他の列車からの切り替え対応
      startFrontView(selectedCar);
      updateButtonLabels(trainNum);
    } else {
      stopFrontView();
      updateButtonLabels(null);
    }
  });

  button.addEventListener("touchstart", () => {
    const trainNum = parseInt(button.dataset.train);
    const selectedCar = trainCars[trainNum];

    if (!frontViewActive || currentTrainCar !== selectedCar) {
      stopFrontView(); // 他の列車からの切り替え対応
      startFrontView(selectedCar);
      updateButtonLabels(trainNum);
    } else {
      stopFrontView();
      updateButtonLabels(null);
    }
  });
});

function updateButtonLabels(activeTrainNum) {
  fbuttons.forEach(button => {
    const num = parseInt(button.dataset.train);
    if (num === activeTrainNum) {
      button.textContent = `${num}番線 🚫 停止`;
    } else {
      button.textContent = `${num}番線`;
    }
  });
}

// 編集モード [関数]  ----------------------------------------------------------------

const cameraSub = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
// サブカメラ（別角度）
cameraSub.position.set(10, 5, 0);
cameraSub.lookAt(0, 0, 0);

// 線描画
function createLine(p1, p2, color = 0xff0000) {
  const points = [
    new THREE.Vector3(p1.x, p1.y, p1.z),
    new THREE.Vector3(p2.x, p2.y, p2.z)
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });
  return new THREE.Line(geometry, material);
}

// マウスを動かしたときのイベント
function handleMouseMove(x, y) {
  lastPointerClient = { x, y };
  const element = canvas;
  const hovered = document.elementFromPoint(x, y);
  pointerBlockedByUI = Boolean(hovered?.closest?.('button'));
  structurePointerBlockedByUI = pointerBlockedByUI;
  // Use bounding rect to correctly account for CSS, padding and page offsets
  const rect = element.getBoundingClientRect();
  const clientX = x - rect.left;
  const clientY = y - rect.top;
  const w = rect.width;
  const h = rect.height;
  lastPointerScreen = { x: clientX, y: clientY };
  // normalize to -1..+1 for raycaster
  mouse.x = (clientX / w) * 2 - 1;
  mouse.y = -(clientY / h) * 2 + 1;
  updateDifferenceFaceHoverFromPointer();
}

// 物体の表示/非表示
function setMeshListOpacity(list, opacity) {
  list.forEach((mesh) => {
    if (!mesh || !mesh.isMesh) { return; }
    if (mesh.name === 'AddPointGridHandle') {
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            if (mat && 'opacity' in mat) {
              mat.opacity = 0;
              mat.transparent = true;
            }
          });
        } else if ('opacity' in mesh.material) {
          mesh.material.opacity = 0;
          mesh.material.transparent = true;
        }
      }
      mesh.visible = true;
      return;
    }

    // Difference 空間ボックスは独自の透過/描画設定を維持する。
    // 汎用の opacity 上書きで material が変質して見える問題を防ぐ。
    if (mesh.userData?.differenceSpacePlane) {
      const applyDifferenceStyle = (material) => {
        if (!material) { return; }
        material.opacity = 0.5;
        material.transparent = true;
        material.side = THREE.DoubleSide;
        material.depthWrite = false;
        if ('metalness' in material) { material.metalness = 0.0; }
        if ('roughness' in material) { material.roughness = 1.0; }
        if ('flatShading' in material) { material.flatShading = true; }
        material.needsUpdate = true;
      };
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(applyDifferenceStyle);
      } else {
        applyDifferenceStyle(mesh.material);
      }
      mesh.visible = opacity > 0;
      return;
    }

    const applyOpacity = (material) => {
      if (!material) { return; }
      if ('opacity' in material) {
        material.opacity = opacity;
      }
      material.transparent = opacity < 1;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(applyOpacity);
    } else {
      applyOpacity(mesh.material);
    }

    mesh.visible = opacity > 0;
  });
}

// 物体の削除
function removeMeshes(list) {
  const disposeMaterial = (material) => {
    if (!material) { return; }
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
      return;
    }
    if (typeof material.dispose === 'function') {
      material.dispose();
    }
  };

  for (let i = list.length - 1; i >= 0; i--) {
    const mesh = list[i];
    if (!mesh || !mesh.isMesh) { continue; }

    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }

    if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
      mesh.geometry.dispose();
    }

    disposeMaterial(mesh.material);

    list.splice(i, 1);
  }
}

function markPointsWithPins(pointsSource, store = targetPins) {
  if (!Array.isArray(pointsSource)) { return []; }

  pointsSource.forEach((point) => {
    if (!point) { return; }
    const pin = TSys.Map_pin(point.x, point.z, point.y, 0.1);
    scene.add(pin);
      
    }
  );
}

function resetMeshListOpacity(list, pointsSource) {
  if (!Array.isArray(list)) { return; }

  removeMeshes(list);
  removeMeshes(targetPins);

  if (!Array.isArray(pointsSource)) { return; }

  pointsSource.forEach((point) => {
    if (!point) { return; }
    const mesh = new THREE.Mesh(cube_geometry, cube_material.clone());
    mesh.position.copy(point);
    scene.add(mesh);
    list.push(mesh);
  });

}


// レイキャストを作成
const raycaster = new THREE.Raycaster();

// for (let i = 1; i < 4; i++) {
//   const cube = new THREE.Mesh(geometry, material.clone()); // 色変更できるようにclone
//   cube.position.set(i * 2, 0.5, 0); // X方向に2ずつ離して配置
//   scene.add(cube);
//   targetObjects.push(cube);
// }

let pause = false;

// すべてのボタンに hover 検出を付ける
const buttons = document.querySelectorAll("button");

buttons.forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    pause = true; // 一時停止
  });

  btn.addEventListener("mouseleave", () => {
    pause = false; // 再開
  });
});

buttons.forEach(btn => {
  // 指がボタンに触れたとき（mouseenter 相当）
  btn.addEventListener("touchstart", (e) => {
    e.preventDefault(); // ページスクロールを防止
    pause = true; // 一時停止
  }, { passive: false });

  // 指がボタンから離れたとき（mouseleave 相当）
  btn.addEventListener("touchend", () => {
    pause = false; // 再開
  });

  // タッチがキャンセルされたとき（例: 指が画面外にずれた）
  btn.addEventListener("touchcancel", () => {
    pause = false; // 再開
  });
});

// 物体の削除
function clean_object(namesToFind){
  const targets = [];
  scene.traverse(obj => {
    if (namesToFind.includes(obj.name)) {
      targets.push(obj);
    }
  });
  // まとめて削除
  targets.forEach(obj => {
    scene.remove(obj);

    // メモリ解放したい場合
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
}

function getObject(namesToFind){
  const targets = [];
  scene.traverse(obj => {
    if (namesToFind.includes(obj.name)) {
      targets.push(obj);
    }
  });
  return targets
}

// 物体の非表示/表示
function visual_object(targets=[]){
  // まとめて変更
  targets.forEach(obj => {
    obj.visible = !obj.visible; // 非表示
  });
}

function drawingObject(){

  if (editObject === 'CUSTOM'){return}

  if (editObject === 'RAIL') {
    if (selectedRailPoint) {
      drawRailSelectionLine(selectedRailPoint.trackName, selectedRailPoint.pointIndex);
    } else {
      clearRailSelectionLine();
    }
    return;
  }

  if (editObject === 'STEEL_FRAME') {
    steelFrameMode.setPointsFromTargets(targetObjects);
    return;
  }

  clean_object(['DeckSlab','Pillar','Rail','OBJECT' + group_EditNow])
  if (targetObjects.length < 2){return}

  const Points = targetObjects.map(obj => obj.position.clone());

  // console.log(Points)

  // 指定したポイントから線(線路の軌道)を生成
  const line = new THREE.CatmullRomCurve3(Points);


  // TSys.generateElevated(line, 5, 1, 'Rail');
  TSys.createTrack(line, 0, 0x00ff00, 'Rail')
  // if (editObject === 'ORIGINAL'){
  //   if (dragging){
  //     TSys.createTrack(line, 0, 0x00ff00, 'Rail')
  //   } else {
  //     const mesh = TSys.createBoxBetweenPoints3D(Points[0], Points[1], 0.1, 0.1)
  //     mesh.name = 'OBJECT' + group_EditNow
  //     group_object[group_EditNow] = mesh
  //     scene.add(mesh)
  //   }
  // }else{
  //   TSys.createRail(line, true)
  // }
  // console.log(positions); // [Vector3, Vector3, ...]
}


const GuideLine = createLine({x:0,y:2,z:0}, {x:0,y:-2,z:0}, 0xff0000)
GuideLine.name = 'GuideLine'
GuideLine.position.set(0,0,0);
scene.add(GuideLine)

function updateGuideLineDirectionFromMesh(mesh) {
  if (!GuideLine) { return; }
  const baseAxis = new THREE.Vector3(0, 1, 0);
  const dir = mesh?.userData?.pointRotateDirection;
  if (dir?.x != null && dir?.y != null && dir?.z != null) {
    const d = new THREE.Vector3(dir.x, dir.y, dir.z);
    if (d.lengthSq() > 1e-8) {
      GuideLine.quaternion.setFromUnitVectors(baseAxis, d.normalize());
      return;
    }
  }
  GuideLine.quaternion.identity();
}

function showPointRotationGuideLine(mesh) {
  if (!mesh || !mesh.position) { return; }
  GuideLine.position.copy(mesh.position);
  updateGuideLineDirectionFromMesh(mesh);
  GuideLine.visible = true;
}

const GuideGrid = new THREE.GridHelper(5, 10, 0x8888aa, 0x88aa88);
GuideGrid.name = "GuideGrid";
GuideGrid.position.set(0,0,0);
scene.add(GuideGrid);

const AddPointGuideGrid = new THREE.GridHelper(5, 10, 0x88aa88, 0x88aa88);
AddPointGuideGrid.name = 'AddPointGuideGrid';
AddPointGuideGrid.position.set(0,0,0);
scene.add(AddPointGuideGrid);

const GuideGrid_Center_x = createLine({x:2,y:0.1,z:0}, {x:-2,y:0.1,z:0}, 0xff0000)
GuideGrid_Center_x.name = 'GuideLine'
GuideGrid_Center_x.position.set(0,0,0);
scene.add(GuideGrid_Center_x)

const GuideGrid_Center_z = createLine({x:0,y:0.1,z:2}, {x:0,y:0.1,z:-2}, 0xff0000)
GuideGrid_Center_z.name = 'GuideLine'
GuideGrid_Center_z.position.set(0,0,0);
scene.add(GuideGrid_Center_z)

GuideLine.visible = false
GuideGrid.visible = true
AddPointGuideGrid.visible = false
GuideGrid_Center_x.visible = false
GuideGrid_Center_z.visible = false

const addPointGridHandle = new THREE.Mesh(
  new THREE.PlaneGeometry(5, 5),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide })
);
addPointGridHandle.name = 'AddPointGridHandle';
addPointGridHandle.rotation.x = -Math.PI / 2;
scene.add(addPointGridHandle);
const addPointGridBaseQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

function setGuideAddGridColor(grid, color) {
  if (!grid || !grid.material) { return; }
  if (Array.isArray(grid.material)) {
    grid.material.forEach((mat) => mat?.color?.set?.(color));
  } else if (grid.material.color) {
    grid.material.color.set(color);
  }
}

console.log(new THREE.Vector3(5.5, y, -50))

let group_object = []
let group_targetObjects = []
let group_EditNow = 'None'
let createModeWorldFocused = false
const createModeHiddenObjects = new Map()
let sinjyukuCity = null
let differencePreviewTube = null
const differenceSpacePlanes = []
let differenceSelectedPlane = null
let differenceFaceHighlight = null
const differenceSelectedFaceHighlights = []
let differenceHoverFaceKey = null
let differenceHoveredFaceHit = null
const differenceSelectedControlPoints = new Set()
const differenceSelectedFaces = new Map()
const differenceSharedPointLinkEpsilon = 0.02
let differenceFaceVertexDragActive = false
let differenceFaceVertexDragMesh = null
let differenceFaceVertexDragLocalNormal = null
let differenceFaceVertexDragAxis = 'z'
let differenceFaceVertexDragStartT = 0
let differenceFaceVertexDragStartLen = 1
let differenceFaceVertexDragStartPos = new THREE.Vector3()
let differenceControlPointDragActive = false
let differenceControlPointDragPoint = null
let differenceControlPointDragMesh = null
let differenceControlPointDragAxisWorld = new THREE.Vector3()
let differenceControlPointDragStartT = 0
let differenceControlPointDragStartLocalPos = new THREE.Vector3()
let differenceControlPointDragStartWorldPos = new THREE.Vector3()
let differenceMoveClickPending = false
let differenceMoveDownPos = null
let differenceMoveShouldToggle = false
let differenceMoveHitKind = 'none'
let differenceMoveHitControlPoint = null
let differenceMoveHitFace = null
const differenceCsgEvaluator = new Evaluator()
const differenceCsgOperation = HOLLOW_SUBTRACTION
let addPointGridActive = false
let guideAddModeActive = false
const guideAddGrids = []
const guideAddGridPicks = []
let changeAngleGridTarget = null
let addPointGridY = 0
const GUIDE_ADD_GRID_COLOR = 0x88aa88;
const GUIDE_ADD_GRID_SELECTED_COLOR = 0x00ff00;
const searchGridVisuals = [];
let searchSelectedGrid = null;

function clearSearchGridVisuals() {
  for (let i = searchGridVisuals.length - 1; i >= 0; i -= 1) {
    const obj = searchGridVisuals[i];
    if (!obj) { continue; }
    if (obj.parent) {
      obj.parent.remove(obj);
    }
    obj.traverse?.((node) => {
      if (node.geometry?.dispose) {
        node.geometry.dispose();
      }
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach((m) => {
            if (m?.map?.dispose) { m.map.dispose(); }
            m?.dispose?.();
          });
        } else if (node.material.dispose) {
          if (node.material.map?.dispose) { node.material.map.dispose(); }
          node.material.dispose();
        }
      }
    });
    searchGridVisuals.splice(i, 1);
  }
}

function buildSimpleLabelSprite(text, color = '#16324f') {
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 82;
  const ctx = canvas.getContext('2d');
  if (!ctx) { return null; }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  ctx.fillRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.fillStyle = color;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.1, 0.78, 1);
  sprite.renderOrder = 1001;
  return sprite;
}

function updateSearchGridTiltVisuals() {
  clearSearchGridVisuals();
  if (!angleSearchModeActive || !searchSelectedGrid) { return; }

  const center = searchSelectedGrid.position.clone();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = up.clone().applyQuaternion(searchSelectedGrid.quaternion).normalize();
  const radius = 1.2;

  const upArrow = new THREE.ArrowHelper(up.clone(), center.clone(), radius, 0x2ecc71, 0.3, 0.18);
  upArrow.name = 'SearchGridUpArrow';
  scene.add(upArrow);
  searchGridVisuals.push(upArrow);

  const normalArrow = new THREE.ArrowHelper(normal.clone(), center.clone(), radius, 0x00bcd4, 0.3, 0.18);
  normalArrow.name = 'SearchGridNormalArrow';
  scene.add(normalArrow);
  searchGridVisuals.push(normalArrow);

  const axis = new THREE.Vector3().crossVectors(up, normal);
  const axisLen = axis.length();
  const dot = Math.min(1, Math.max(-1, up.dot(normal)));
  const tiltRad = Math.acos(dot);
  const tiltDeg = tiltRad * 180 / Math.PI;
  if (axisLen > 1e-6 && tiltRad > 1e-6) {
    const axisN = axis.normalize();
    const points = [];
    const steps = 24;
    for (let i = 0; i <= steps; i += 1) {
      const t = tiltRad * (i / steps);
      const dir = up.clone().applyAxisAngle(axisN, t);
      points.push(center.clone().add(dir.multiplyScalar(radius * 0.58)));
    }
    const arcGeom = new THREE.BufferGeometry().setFromPoints(points);
    const arc = new THREE.Line(arcGeom, new THREE.LineBasicMaterial({ color: 0xf39c12 }));
    arc.name = 'SearchGridTiltArc';
    scene.add(arc);
    searchGridVisuals.push(arc);
  }

  const label = buildSimpleLabelSprite(`${tiltDeg.toFixed(1)}deg`, '#1f5f7f');
  if (label) {
    label.position.copy(center.clone().add(normal.clone().multiplyScalar(radius * 0.72)).add(new THREE.Vector3(0, 0.16, 0)));
    scene.add(label);
    searchGridVisuals.push(label);
  }
}

let choice_object = false
let search_object = false
let move_direction_y = false

let tiles = []
let pick_vertexs = [] // カスタムジオメトリ 頂点指定時の格納用
// search_point();

function setCreateModeWorldFocus(enable) {
  if (enable) {
    if (createModeWorldFocused) { return; }

    const keep = new Set([GuideLine, GuideGrid, GuideGrid_Center_x, GuideGrid_Center_z]);
    targetObjects.forEach((obj) => keep.add(obj));
    group_object.forEach((obj) => keep.add(obj));
    if (!sinjyukuCity) {
      sinjyukuCity = scene.getObjectByName('sinjyuku_city');
    }
    if (sinjyukuCity) {
      keep.add(sinjyukuCity);
      sinjyukuCity.visible = true;
    }

    scene.children.forEach((root) => {
      if (!root) { return; }
      if (root.isLight) { return; }

      let keepRoot = false;
      for (const obj of keep) {
        let node = obj;
        while (node) {
          if (node === root) {
            keepRoot = true;
            break;
          }
          node = node.parent;
        }
        if (keepRoot) { break; }
      }

      if (keepRoot) { return; }
      createModeHiddenObjects.set(root, root.visible);
      root.visible = false;
    });

    suspendRunTrainAnimations = true;
    createModeWorldFocused = true;
    return;
  }

  if (!createModeWorldFocused) { return; }
  for (const [obj, wasVisible] of createModeHiddenObjects.entries()) {
    if (!obj) { continue; }
    obj.visible = wasVisible;
  }
  createModeHiddenObjects.clear();
  if (!sinjyukuCity) {
    sinjyukuCity = scene.getObjectByName('sinjyuku_city');
  }
  if (sinjyukuCity) {
    sinjyukuCity.visible = false;
  }
  suspendRunTrainAnimations = false;
  createModeWorldFocused = false;
}

function clearDifferencePreviewTube() {
  if (!differencePreviewTube) { return; }
  if (differencePreviewTube.parent) {
    differencePreviewTube.parent.remove(differencePreviewTube);
  }
  if (differencePreviewTube.geometry?.dispose) {
    differencePreviewTube.geometry.dispose();
  }
  if (Array.isArray(differencePreviewTube.material)) {
    differencePreviewTube.material.forEach((mat) => mat?.dispose?.());
  } else {
    differencePreviewTube.material?.dispose?.();
  }
  differencePreviewTube = null;
}

function clearDifferenceFaceHighlight(resetHoverState = true) {
  if (!differenceFaceHighlight) { return; }
  if (differenceFaceHighlight.parent) {
    differenceFaceHighlight.parent.remove(differenceFaceHighlight);
  }
  if (differenceFaceHighlight.geometry?.dispose) {
    differenceFaceHighlight.geometry.dispose();
  }
  if (differenceFaceHighlight.material?.dispose) {
    differenceFaceHighlight.material.dispose();
  }
  differenceFaceHighlight = null;
  if (resetHoverState) {
    differenceHoverFaceKey = null;
    differenceHoveredFaceHit = null;
  }
}

function clearDifferenceSelectedFaceHighlights() {
  while (differenceSelectedFaceHighlights.length > 0) {
    const mesh = differenceSelectedFaceHighlights.pop();
    if (!mesh) { continue; }
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
    mesh.geometry?.dispose?.();
    mesh.material?.dispose?.();
  }
}

function updateDifferenceFaceHoverFromPointer() {
  if (!differenceSpaceModeActive || differenceSpaceTransformMode !== 'add' || editObject !== 'DIFFERENCE_SPACE') {
    if (differenceHoverFaceKey) {
      clearDifferenceFaceHighlight();
    }
    differenceHoveredFaceHit = null;
    return;
  }
  if (pointerBlockedByUI || differenceFaceVertexDragActive || differenceControlPointDragActive || pointRotateDragging || pointRotateMoveDragging) {
    if (differenceHoverFaceKey) {
      clearDifferenceFaceHighlight();
    }
    differenceHoveredFaceHit = null;
    return;
  }
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(differenceSpacePlanes.filter((m) => m?.parent), true);
  const faceHit = hits.find((h) => h?.object?.userData?.differenceSpacePlane && h?.face) || null;
  if (!faceHit) {
    if (differenceHoverFaceKey) {
      clearDifferenceFaceHighlight();
    }
    differenceHoveredFaceHit = null;
    return;
  }
  const localNormal = getLocalFaceNormalFromHit(faceHit);
  const key = getDifferenceFaceKey(faceHit.object, localNormal);
  if (!key) {
    if (differenceHoverFaceKey) {
      clearDifferenceFaceHighlight();
    }
    differenceHoveredFaceHit = null;
    return;
  }
  differenceHoveredFaceHit = faceHit;
  if (key === differenceHoverFaceKey) {
    return;
  }
  differenceHoverFaceKey = key;
  showDifferenceFaceHighlight(faceHit);
}

function resetDifferenceControlPointsHighlight(mesh) {
  if (!mesh) { return; }
  mesh.children.forEach((child) => {
    if (!child?.userData?.differenceControlPoint || !child?.material?.color) { return; }
    child.material.color.set(0xff6b6b);
  });
  for (const point of Array.from(differenceSelectedControlPoints)) {
    if (!point || point.parent !== mesh) { continue; }
    differenceSelectedControlPoints.delete(point);
  }
}

function isDifferenceControlPointSelected(point) {
  return differenceSelectedControlPoints.has(point);
}

function setDifferenceControlPointVisual(point, color = 0xff6b6b) {
  if (!point?.material?.color) { return; }
  point.material.color.set(color);
}

function clearDifferenceControlPointSelection() {
  for (const point of Array.from(differenceSelectedControlPoints)) {
    setDifferenceControlPointVisual(point, 0xff6b6b);
  }
  differenceSelectedControlPoints.clear();
}

function toggleDifferenceControlPointSelection(point) {
  if (!point?.userData?.differenceControlPoint) { return; }
  if (differenceSelectedControlPoints.has(point)) {
    differenceSelectedControlPoints.delete(point);
    setDifferenceControlPointVisual(point, 0xff6b6b);
    return;
  }
  differenceSelectedControlPoints.add(point);
  setDifferenceControlPointVisual(point, 0x7be6ff);
}

function highlightDifferenceFaceControlPoints(mesh, localNormal) {
  if (!mesh || !localNormal) { return; }
  const axis = Math.abs(localNormal.x) > 0.9
    ? 'x'
    : (Math.abs(localNormal.y) > 0.9 ? 'y' : 'z');
  const sign = localNormal[axis] >= 0 ? 1 : -1;
  resetDifferenceControlPointsHighlight(mesh);
  mesh.children.forEach((child) => {
    if (!child?.userData?.differenceControlPoint || !child?.material?.color) { return; }
    const v = child.position[axis] || 0;
    if (isDifferenceControlPointSelected(child)) { return; }
    if ((sign > 0 && v > 0) || (sign < 0 && v < 0)) {
      child.material.color.set(0xffd64d);
    }
  });
}

function setDifferenceControlPointSelected(point) {
  clearDifferenceControlPointSelection();
  if (!point) { return; }
  differenceSelectedControlPoints.add(point);
  setDifferenceControlPointVisual(point, 0x7be6ff);
}

function getDifferenceFaceKey(mesh, localNormal) {
  if (!mesh || !localNormal) { return null; }
  const axis = Math.abs(localNormal.x) > 0.9
    ? 'x'
    : (Math.abs(localNormal.y) > 0.9 ? 'y' : 'z');
  const sign = localNormal[axis] >= 0 ? 1 : -1;
  return `${mesh.id}:${axis}:${sign}`;
}

function createDifferenceFaceHighlightPlane(mesh, localNormal, color = 0xffd64d, opacity = 0.55, renderOrder = 2500) {
  if (!mesh?.isMesh || !mesh?.geometry || !localNormal) { return null; }
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();
  if (worldNormal.lengthSq() < 1e-8) { return null; }
  mesh.geometry.computeBoundingBox?.();
  const bb = mesh.geometry.boundingBox;
  if (!bb) { return null; }
  const size = bb.getSize(new THREE.Vector3());
  const center = bb.getCenter(new THREE.Vector3());
  const axis = Math.abs(localNormal.x) > 0.9
    ? 'x'
    : (Math.abs(localNormal.y) > 0.9 ? 'y' : 'z');

  let faceCenterLocal = center.clone();
  let w = 1;
  let h = 1;
  if (axis === 'x') {
    faceCenterLocal.x = center.x + Math.sign(localNormal.x) * (size.x * 0.5);
    w = Math.max(0.08, size.z * 0.92);
    h = Math.max(0.08, size.y * 0.92);
  } else if (axis === 'y') {
    faceCenterLocal.y = center.y + Math.sign(localNormal.y) * (size.y * 0.5);
    w = Math.max(0.08, size.x * 0.92);
    h = Math.max(0.08, size.z * 0.92);
  } else {
    faceCenterLocal.z = center.z + Math.sign(localNormal.z) * (size.z * 0.5);
    w = Math.max(0.08, size.x * 0.92);
    h = Math.max(0.08, size.y * 0.92);
  }

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    }),
  );
  const faceCenterWorld = faceCenterLocal.applyMatrix4(mesh.matrixWorld);
  const lookAtTarget = faceCenterWorld.clone().add(worldNormal);
  plane.position.copy(faceCenterWorld.clone().add(worldNormal.clone().multiplyScalar(0.01)));
  plane.lookAt(lookAtTarget);
  plane.renderOrder = renderOrder;
  return plane;
}

function refreshDifferenceSelectedFaceHighlights() {
  clearDifferenceSelectedFaceHighlights();
  if (differenceSelectedFaces.size < 1) { return; }
  differenceSelectedFaces.forEach((entry) => {
    const mesh = entry?.mesh;
    const localNormal = entry?.localNormal?.clone?.();
    if (!mesh?.parent || !localNormal) { return; }
    const plane = createDifferenceFaceHighlightPlane(mesh, localNormal, 0x67b7ff, 0.42, 2400);
    if (!plane) { return; }
    scene.add(plane);
    differenceSelectedFaceHighlights.push(plane);
  });
}

function toggleDifferenceFaceSelection(mesh, localNormal) {
  const key = getDifferenceFaceKey(mesh, localNormal);
  if (!key) { return false; }
  if (differenceSelectedFaces.has(key)) {
    differenceSelectedFaces.delete(key);
    refreshDifferenceSelectedFaceHighlights();
    return false;
  }
  differenceSelectedFaces.set(key, {
    mesh,
    localNormal: localNormal.clone(),
  });
  refreshDifferenceSelectedFaceHighlights();
  return true;
}

function clearDifferenceFaceSelection() {
  differenceSelectedFaces.clear();
  clearDifferenceSelectedFaceHighlights();
}

function clearDifferenceMovePending() {
  differenceMoveClickPending = false;
  differenceMoveDownPos = null;
  differenceMoveShouldToggle = false;
  differenceMoveHitKind = 'none';
  differenceMoveHitControlPoint = null;
  differenceMoveHitFace = null;
}

function startDifferenceMoveDragFromPending() {
  if (!differenceMoveClickPending || !differenceMoveHitKind) { return false; }
  if (differenceMoveHitKind === 'point' && differenceMoveHitControlPoint?.userData?.differenceControlPoint) {
    const primary = differenceMoveHitControlPoint;
    const selected = Array.from(differenceSelectedControlPoints).filter((p) => p?.parent);
    const others = selected.filter((p) => p !== primary);
    const dragPoints = [primary].concat(others);
    const ok = beginDifferenceControlPointDrag(primary, dragPoints);
    if (ok) {
      clearDifferenceMovePending();
    }
    return ok;
  }
  if (differenceMoveHitKind === 'face' && differenceMoveHitFace?.mesh && differenceMoveHitFace?.localNormal) {
    const primary = differenceMoveHitFace;
    const key = getDifferenceFaceKey(primary.mesh, primary.localNormal);
    const selectedFaces = Array.from(differenceSelectedFaces.values()).filter((v) => v?.mesh && v?.localNormal);
    const others = selectedFaces.filter((v) => getDifferenceFaceKey(v.mesh, v.localNormal) !== key);
    const worldToLocal = new THREE.Matrix4().copy(primary.mesh.matrixWorld).invert();
    const primaryFacePointLocal = primary?.hit?.point?.clone?.()?.applyMatrix4?.(worldToLocal) || null;
    const dragFaces = [{ mesh: primary.mesh, localNormal: primary.localNormal.clone(), facePointLocal: primaryFacePointLocal }]
      .concat(others.map((v) => ({ mesh: v.mesh, localNormal: v.localNormal.clone() })));
    const ok = beginDifferenceFaceVertexDrag({
      object: primary.mesh,
      face: { normal: primary.localNormal.clone() },
    }, dragFaces);
    if (ok) {
      clearDifferenceMovePending();
    }
    return ok;
  }
  return false;
}

function toggleDifferenceMoveSelectionFromPending() {
  if (!differenceMoveClickPending || !differenceMoveShouldToggle) {
    clearDifferenceMovePending();
    return false;
  }
  if (differenceMoveHitKind === 'point' && differenceMoveHitControlPoint?.userData?.differenceControlPoint) {
    toggleDifferenceControlPointSelection(differenceMoveHitControlPoint);
    updateDifferenceStatus(`point選択: ${differenceSelectedControlPoints.size} / face選択: ${differenceSelectedFaces.size}`);
    clearDifferenceFaceHighlight();
    clearDifferenceMovePending();
    return true;
  }
  if (differenceMoveHitKind === 'face' && differenceMoveHitFace?.mesh && differenceMoveHitFace?.localNormal) {
    // クリック選択時点で、面を操作対象として確定する。
    pointRotateTarget = differenceMoveHitFace.mesh;
    selectDifferencePlane(pointRotateTarget);
    if (differenceMoveHitFace?.hit?.point) {
      pointRotateCenter.copy(differenceMoveHitFace.hit.point);
    } else {
      pointRotateCenter.copy(pointRotateTarget.position);
    }
    pointRotateDirection.copy(
      differenceMoveHitFace.localNormal.clone().applyQuaternion(pointRotateTarget.quaternion).normalize()
    );
    pointRotateBasisQuat.copy(buildBasisQuatFromDirection(pointRotateDirection));
    pointRotateTarget.userData = {
      ...(pointRotateTarget.userData || {}),
      pointRotateDirection: pointRotateDirection.clone(),
      pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
      pointRotateFaceNormalWorld: pointRotateDirection.toArray(),
    };
    pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
    pointRotateGizmoYawStart = pointRotateGizmoYaw;
    pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
    updatePointRotatePanelAnglesFromDirection(pointRotateDirection, { apply: true });
    updatePointRotateVisuals();

    const selected = toggleDifferenceFaceSelection(differenceMoveHitFace.mesh, differenceMoveHitFace.localNormal);
    updateDifferenceStatus(`point選択: ${differenceSelectedControlPoints.size} / face選択: ${differenceSelectedFaces.size}`);
    if (selected) {
      showDifferenceFaceHighlight({
        object: differenceMoveHitFace.mesh,
        face: { normal: differenceMoveHitFace.localNormal.clone() },
      });
    } else {
      clearDifferenceFaceHighlight();
    }
    clearDifferenceMovePending();
    return true;
  }
  clearDifferenceMovePending();
  return false;
}

function setDifferencePlaneVisual(mesh, selected = false) {
  if (!mesh?.material?.color) { return; }
  if (differenceSpaceTransformMode === 'move') {
    mesh.material.color.set(0x2ed0c9);
    return;
  }
  mesh.material.color.set(selected ? 0x4cd3ff : 0x2ed0c9);
}

function createDifferenceSpacePlane(position) {
  const plane = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x2ed0c9,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      metalness: 0.0,
      roughness: 1.0,
      flatShading: true,
    }),
  );
  plane.position.copy(position);
  plane.name = 'DifferenceSpacePlane';
  plane.userData = {
    ...(plane.userData || {}),
    differenceSpacePlane: true,
  };
  scene.add(plane);
  differenceSpacePlanes.push(plane);
  return plane;
}

function addDifferenceControlPoints(mesh) {
  if (!mesh?.geometry) { return; }
  const half = 0.5;
  const offsets = [
    [-half, -half, -half], [half, -half, -half], [half, half, -half], [-half, half, -half],
    [-half, -half, half],  [half, -half, half],  [half, half, half],  [-half, half, half],
  ];
  const pointGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const pointMat = new THREE.MeshBasicMaterial({
    color: 0xff6b6b,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  offsets.forEach((o, idx) => {
    const p = new THREE.Mesh(pointGeo, pointMat.clone());
    p.position.set(o[0], o[1], o[2]);
    const cornerKey = `${o[0] >= 0 ? 1 : -1},${o[1] >= 0 ? 1 : -1},${o[2] >= 0 ? 1 : -1}`;
    p.name = `DifferenceControlPoint_${idx}`;
    p.userData = {
      ...(p.userData || {}),
      differenceControlPoint: true,
      parentDifferenceSpacePlane: mesh,
      differenceCornerKey: cornerKey,
    };
    mesh.add(p);
  });
  updateDifferenceControlPointMarkerTransform(mesh);
}

function updateDifferenceControlPointMarkerTransform(mesh) {
  if (!mesh) { return; }
  const sx = Math.max(1e-6, Math.abs(mesh.scale?.x || 1));
  const sy = Math.max(1e-6, Math.abs(mesh.scale?.y || 1));
  const sz = Math.max(1e-6, Math.abs(mesh.scale?.z || 1));
  mesh.children.forEach((child) => {
    if (!child?.userData?.differenceControlPoint) { return; }
    // 親の非等方スケールを打ち消して、制御点は常に球形表示を維持する。
    child.scale.set(1 / sx, 1 / sy, 1 / sz);
  });
}

function ensureDifferenceCornerVertexMap(mesh) {
  if (!mesh?.geometry?.attributes?.position) { return null; }
  if (mesh.userData?.differenceCornerVertexMap) {
    return mesh.userData.differenceCornerVertexMap;
  }
  const pos = mesh.geometry.attributes.position;
  const map = {};
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x >= 0 ? 1 : -1},${y >= 0 ? 1 : -1},${z >= 0 ? 1 : -1}`;
    if (!map[key]) { map[key] = []; }
    map[key].push(i);
  }
  mesh.userData = {
    ...(mesh.userData || {}),
    differenceCornerVertexMap: map,
  };
  return map;
}

function syncDifferenceGeometryFromControlPoints(mesh) {
  if (!mesh?.geometry?.attributes?.position) { return; }
  const vertexMap = ensureDifferenceCornerVertexMap(mesh);
  if (!vertexMap) { return; }
  const positionAttr = mesh.geometry.attributes.position;
  const cornerPositions = {};
  mesh.children.forEach((child) => {
    if (!child?.userData?.differenceControlPoint) { return; }
    const key = child.userData?.differenceCornerKey;
    if (!key) { return; }
    cornerPositions[key] = child.position.clone();
  });
  Object.entries(cornerPositions).forEach(([key, cornerPos]) => {
    const indices = vertexMap[key] || [];
    indices.forEach((i) => {
      positionAttr.setXYZ(i, cornerPos.x, cornerPos.y, cornerPos.z);
    });
  });
  mesh.children.forEach((child) => {
    if (!child?.userData?.differenceControlPoint) { return; }
    const indices = child.userData?.differenceVertexIndices;
    if (!Array.isArray(indices) || indices.length < 1) { return; }
    indices.forEach((i) => {
      if (!Number.isInteger(i) || i < 0 || i >= positionAttr.count) { return; }
      positionAttr.setXYZ(i, child.position.x, child.position.y, child.position.z);
    });
  });
  positionAttr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox?.();
  mesh.geometry.computeBoundingSphere?.();
  updateDifferenceControlPointMarkerTransform(mesh);
}

function getDifferenceControlPointMapByCornerKey(mesh) {
  const out = {};
  if (!mesh) { return out; }
  mesh.children.forEach((child) => {
    if (!child?.userData?.differenceControlPoint) { return; }
    const key = child.userData?.differenceCornerKey;
    if (!key) { return; }
    out[key] = child;
  });
  return out;
}

function getDifferenceFaceControlPoints(mesh, localNormal, facePointLocal = null) {
  if (!mesh || !localNormal) { return []; }

  // クリック面の情報がある場合は、軸依存ではなく「平面距離」で面頂点を抽出する。
  // これにより斜め面でも押し出し対象の頂点群を拾える。
  if (facePointLocal) {
    const n = localNormal.clone().normalize();
    if (n.lengthSq() > 1e-8) {
      const planeTol = 0.11;
      const planePoints = mesh.children.filter((child) => {
        if (!child?.userData?.differenceControlPoint) { return false; }
        const p = child.position;
        const d = p.clone().sub(facePointLocal).dot(n);
        return Math.abs(d) <= planeTol;
      });
      if (planePoints.length >= 3) {
        return planePoints;
      }
    }
  }

  // 既存互換: 軸平行面向けの簡易抽出
  const axis = Math.abs(localNormal.x) > 0.9
    ? 'x'
    : (Math.abs(localNormal.y) > 0.9 ? 'y' : 'z');
  const sign = localNormal[axis] >= 0 ? 1 : -1;
  const target = facePointLocal ? (facePointLocal[axis] || 0) : null;
  const tol = 0.08;
  const points = mesh.children.filter((child) => {
    if (!child?.userData?.differenceControlPoint) { return false; }
    const v = child.position?.[axis] || 0;
    if (target !== null) {
      return Math.abs(v - target) <= tol;
    }
    return (sign > 0 && v > 0) || (sign < 0 && v < 0);
  });
  return points;
}

function rebuildDifferenceControlPointsFromGeometry(mesh) {
  if (!mesh?.geometry?.attributes?.position) { return; }
  const oldPoints = mesh.children.filter((child) => child?.userData?.differenceControlPoint);
  oldPoints.forEach((p) => {
    mesh.remove(p);
    p.geometry?.dispose?.();
    p.material?.dispose?.();
  });
  const pos = mesh.geometry.attributes.position;
  const grouped = new Map();
  const eps = 1e-5;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x / eps)},${Math.round(y / eps)},${Math.round(z / eps)}`;
    if (!grouped.has(key)) {
      grouped.set(key, { position: new THREE.Vector3(x, y, z), indices: [] });
    }
    grouped.get(key).indices.push(i);
  }

  const pointGeo = new THREE.SphereGeometry(0.05, 8, 8);
  grouped.forEach((entry, idx) => {
    const point = new THREE.Mesh(
      pointGeo.clone(),
      new THREE.MeshBasicMaterial({
        color: 0xff6b6b,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    point.position.copy(entry.position);
    point.name = `DifferenceControlPoint_${idx}`;
    point.userData = {
      ...(point.userData || {}),
      differenceControlPoint: true,
      parentDifferenceSpacePlane: mesh,
      differenceVertexIndices: entry.indices.slice(),
    };
    mesh.add(point);
  });
  updateDifferenceControlPointMarkerTransform(mesh);
}

function addDifferenceSharedPointLink(a, b) {
  if (!a?.userData?.differenceControlPoint || !b?.userData?.differenceControlPoint || a === b) { return; }
  const linksA = Array.isArray(a.userData.sharedDifferencePoints) ? a.userData.sharedDifferencePoints : [];
  if (!linksA.includes(b)) {
    linksA.push(b);
  }
  a.userData.sharedDifferencePoints = linksA;

  const linksB = Array.isArray(b.userData.sharedDifferencePoints) ? b.userData.sharedDifferencePoints : [];
  if (!linksB.includes(a)) {
    linksB.push(a);
  }
  b.userData.sharedDifferencePoints = linksB;
}

function findDifferenceControlPointByLocalPosition(mesh, localPos, eps = differenceSharedPointLinkEpsilon) {
  if (!mesh || !localPos) { return null; }
  let best = null;
  let bestDist = Infinity;
  mesh.children.forEach((child) => {
    if (!child?.userData?.differenceControlPoint) { return; }
    const d = child.position.distanceToSquared(localPos);
    if (d < bestDist) {
      best = child;
      bestDist = d;
    }
  });
  if (!best) { return null; }
  return bestDist <= (eps * eps) ? best : null;
}

function linkDifferenceSharedBoundaryPoints(sourceMesh, newMesh, sourceFaceLocalPoints) {
  if (!sourceMesh || !newMesh || !Array.isArray(sourceFaceLocalPoints) || sourceFaceLocalPoints.length < 3) { return 0; }
  let linked = 0;
  sourceFaceLocalPoints.forEach((lp) => {
    const a = findDifferenceControlPointByLocalPosition(sourceMesh, lp, differenceSharedPointLinkEpsilon);
    const b = findDifferenceControlPointByLocalPosition(newMesh, lp, differenceSharedPointLinkEpsilon);
    if (!a || !b) { return; }
    addDifferenceSharedPointLink(a, b);
    linked += 1;
  });
  return linked;
}

function propagateDifferenceSharedPoints(points, dirtyMeshes = null) {
  if (!Array.isArray(points) || points.length < 1) { return; }
  const queue = points.filter((p) => p?.userData?.differenceControlPoint);
  const visited = new Set();
  const worldPos = new THREE.Vector3();
  while (queue.length > 0) {
    const point = queue.shift();
    if (!point || visited.has(point.id)) { continue; }
    visited.add(point.id);
    const links = Array.isArray(point.userData?.sharedDifferencePoints) ? point.userData.sharedDifferencePoints : [];
    if (links.length < 1) { continue; }
    point.getWorldPosition(worldPos);
    links.forEach((linkedPoint) => {
      if (!linkedPoint?.userData?.differenceControlPoint || !linkedPoint.parent) { return; }
      const local = worldPos.clone().applyMatrix4(new THREE.Matrix4().copy(linkedPoint.parent.matrixWorld).invert());
      linkedPoint.position.copy(local);
      if (dirtyMeshes) {
        dirtyMeshes.add(linkedPoint.parent);
      }
      if (!visited.has(linkedPoint.id)) {
        queue.push(linkedPoint);
      }
    });
  }
}

function buildExtrudePrismGeometryFromFacePoints(mesh, facePoints, worldNormal, distance = 1) {
  if (!mesh || !Array.isArray(facePoints) || facePoints.length < 3 || !worldNormal) { return null; }
  const normalLocal = worldNormal.clone().applyQuaternion(mesh.quaternion.clone().invert()).normalize();
  const center = new THREE.Vector3();
  facePoints.forEach((p) => center.add(p));
  center.multiplyScalar(1 / facePoints.length);

  let u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(normalLocal)) > 0.9) { u = new THREE.Vector3(0, 1, 0); }
  u = u.sub(normalLocal.clone().multiplyScalar(u.dot(normalLocal))).normalize();
  const v = new THREE.Vector3().crossVectors(normalLocal, u).normalize();

  const sorted = facePoints.slice().sort((a, b) => {
    const da = a.clone().sub(center);
    const db = b.clone().sub(center);
    const aa = Math.atan2(da.dot(v), da.dot(u));
    const ab = Math.atan2(db.dot(v), db.dot(u));
    return aa - ab;
  });

  const worldToLocal = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const near = sorted.map((p) => p.clone());
  const far = near.map((p) => {
    const wp = p.clone().applyMatrix4(mesh.matrixWorld);
    const fp = wp.add(worldNormal.clone().multiplyScalar(distance));
    return fp.applyMatrix4(worldToLocal);
  });

  const positions = [];
  near.forEach((p) => positions.push(p.x, p.y, p.z));
  far.forEach((p) => positions.push(p.x, p.y, p.z));

  const n = near.length;
  const indices = [];
  for (let i = 0; i < n; i += 1) {
    const ni0 = i;
    const ni1 = (i + 1) % n;
    const fi0 = i + n;
    const fi1 = ((i + 1) % n) + n;
    indices.push(ni0, ni1, fi1);
    indices.push(ni0, fi1, fi0);
  }
  for (let i = 1; i < n - 1; i += 1) {
    indices.push(n, n + i, n + i + 1);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // mergeGeometries 互換のため、base geometry と同じ属性セット（最低限 uv）を揃える。
  const vertexCount = positions.length / 3;
  const uvs = new Float32Array(vertexCount * 2);
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  // 面境界で座標が同一の頂点を同一化して、押し出し形状の頂点連結を安定させる。
  const welded = mergeVertices(geom, 1e-5);
  welded.computeVertexNormals();
  welded.computeBoundingBox?.();
  welded.computeBoundingSphere?.();
  geom.dispose?.();
  return welded;
}

function createDifferenceSpaceMeshFromGeometry(geometry, referenceMesh = null) {
  if (!geometry) { return null; }
  const mat = (referenceMesh?.material && referenceMesh.material.clone)
    ? referenceMesh.material.clone()
    : new THREE.MeshStandardMaterial({
      color: 0x2ed0c9,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
      metalness: 0.0,
      roughness: 1.0,
      flatShading: true,
    });
  if (mat) {
    mat.opacity = 0.5;
    mat.transparent = true;
    mat.side = THREE.DoubleSide;
    mat.depthWrite = false;
    if ('metalness' in mat) { mat.metalness = 0.0; }
    if ('roughness' in mat) { mat.roughness = 1.0; }
    if ('flatShading' in mat) { mat.flatShading = true; }
    mat.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = 'DifferenceSpacePlane';
  mesh.userData = {
    ...(mesh.userData || {}),
    differenceSpacePlane: true,
  };
  if (referenceMesh) {
    mesh.position.copy(referenceMesh.position);
    mesh.quaternion.copy(referenceMesh.quaternion);
    mesh.scale.copy(referenceMesh.scale);
  }
  scene.add(mesh);
  differenceSpacePlanes.push(mesh);
  return mesh;
}

function formatDifferenceExtrudeFailureMessage(result, hit) {
  const code = result?.error || 'unknown';
  const meshId = hit?.object?.id ?? 'n/a';
  const faceNormal = hit?.face?.normal;
  const normalText = faceNormal
    ? `${Number(faceNormal.x).toFixed(2)},${Number(faceNormal.y).toFixed(2)},${Number(faceNormal.z).toFixed(2)}`
    : 'n/a';
  const pointCount = Number.isFinite(result?.facePointCount) ? result.facePointCount : 'n/a';
  const detail = [];
  detail.push(`code=${code}`);
  detail.push(`mesh=${meshId}`);
  detail.push(`normal=${normalText}`);
  detail.push(`facePoints=${pointCount}`);
  return `面押し出しに失敗: ${detail.join(' / ')}。対象面を選び直してください。`;
}

function removeDifferenceFaceTriangles(mesh, facePointLocal, localNormal, faceControlPoints = null, tol = 0.06) {
  const geometry = mesh?.geometry;
  const pos = geometry?.attributes?.position;
  if (!geometry || !pos || !facePointLocal || !localNormal) { return 0; }
  const n = localNormal.clone().normalize();
  if (n.lengthSq() < 1e-8) { return 0; }

  const indexAttr = geometry.getIndex();
  const triCount = indexAttr
    ? Math.floor(indexAttr.count / 3)
    : Math.floor(pos.count / 3);
  if (triCount < 1) { return 0; }

  const kept = [];
  let removed = 0;
  const faceVertexSet = new Set();
  if (Array.isArray(faceControlPoints)) {
    faceControlPoints.forEach((cp) => {
      const ids = cp?.userData?.differenceVertexIndices;
      if (!Array.isArray(ids)) { return; }
      ids.forEach((i) => {
        if (Number.isInteger(i)) { faceVertexSet.add(i); }
      });
    });
  }
  const readVertex = (i, out) => out.set(pos.getX(i), pos.getY(i), pos.getZ(i));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  for (let t = 0; t < triCount; t += 1) {
    const ia = indexAttr ? indexAttr.getX(t * 3 + 0) : (t * 3 + 0);
    const ib = indexAttr ? indexAttr.getX(t * 3 + 1) : (t * 3 + 1);
    const ic = indexAttr ? indexAttr.getX(t * 3 + 2) : (t * 3 + 2);
    const byVertexSet = faceVertexSet.size > 0
      && faceVertexSet.has(ia)
      && faceVertexSet.has(ib)
      && faceVertexSet.has(ic);
    if (byVertexSet) {
      removed += 1;
      continue;
    }
    readVertex(ia, a);
    readVertex(ib, b);
    readVertex(ic, c);
    const da = Math.abs(a.clone().sub(facePointLocal).dot(n));
    const db = Math.abs(b.clone().sub(facePointLocal).dot(n));
    const dc = Math.abs(c.clone().sub(facePointLocal).dot(n));
    const onFace = da <= tol && db <= tol && dc <= tol;
    if (onFace) {
      removed += 1;
      continue;
    }
    kept.push(ia, ib, ic);
  }

  if (removed < 1) { return 0; }
  geometry.setIndex(kept);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  geometry.computeBoundingSphere?.();
  return removed;
}

function extrudeDifferenceFaceToNewSpace(hit, distance = 1) {
  const sourceMesh = hit?.object;
  const localNormal = getLocalFaceNormalFromHit(hit);
  const worldNormal = getWorldFaceNormalFromHit(hit);
  if (!sourceMesh?.userData?.differenceSpacePlane || !localNormal || !worldNormal) {
    return { mesh: null, error: 'invalid_target' };
  }

  const worldToLocal = new THREE.Matrix4().copy(sourceMesh.matrixWorld).invert();
  const facePointLocal = hit?.point?.clone?.()?.applyMatrix4?.(worldToLocal) || null;
  const sourceFacePoints = getDifferenceFaceControlPoints(sourceMesh, localNormal, facePointLocal);
  const localFacePoints = sourceFacePoints.map((p) => p.getWorldPosition(new THREE.Vector3()).applyMatrix4(worldToLocal));
  if (localFacePoints.length < 3) {
    return { mesh: null, error: 'face_points_insufficient', facePointCount: localFacePoints.length };
  }

  const prismGeometry = buildExtrudePrismGeometryFromFacePoints(sourceMesh, localFacePoints, worldNormal, distance);
  if (!prismGeometry) {
    return { mesh: null, error: 'prism_geometry_failed', facePointCount: localFacePoints.length };
  }

  const removedFaceCount = removeDifferenceFaceTriangles(sourceMesh, facePointLocal, localNormal, sourceFacePoints);
  if (removedFaceCount < 1) {
    prismGeometry.dispose?.();
    return { mesh: null, error: 'source_face_remove_failed', facePointCount: localFacePoints.length };
  }

  sourceMesh.userData = {
    ...(sourceMesh.userData || {}),
    differenceCornerVertexMap: null,
  };
  rebuildDifferenceControlPointsFromGeometry(sourceMesh);
  syncDifferenceGeometryFromControlPoints(sourceMesh);

  const newMesh = createDifferenceSpaceMeshFromGeometry(prismGeometry, sourceMesh);
  if (!newMesh) {
    prismGeometry.dispose?.();
    return { mesh: null, error: 'create_mesh_failed', facePointCount: localFacePoints.length };
  }
  newMesh.userData = {
    ...(newMesh.userData || {}),
    differenceCornerVertexMap: null,
  };
  rebuildDifferenceControlPointsFromGeometry(newMesh);
  syncDifferenceGeometryFromControlPoints(newMesh);
  linkDifferenceSharedBoundaryPoints(sourceMesh, newMesh, localFacePoints);
  selectDifferencePlane(newMesh);
  return { mesh: newMesh, error: null, facePointCount: localFacePoints.length };
}

function selectDifferencePlane(mesh) {
  if (differenceSelectedPlane && differenceSelectedPlane !== mesh) {
    setDifferencePlaneVisual(differenceSelectedPlane, false);
  }
  differenceSelectedPlane = mesh || null;
  if (differenceSelectedPlane) {
    setDifferencePlaneVisual(differenceSelectedPlane, true);
  }
}

function getDifferenceSelectedPoints() {
  const planes = differenceSpacePlanes.filter((mesh) => mesh?.parent);
  if (planes.length === 1) {
    const mesh = planes[0];
    const center = mesh.position.clone();
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion).normalize();
    const half = 2.2;
    return [
      center.clone().add(normal.clone().multiplyScalar(-half)),
      center.clone().add(normal.clone().multiplyScalar(half)),
    ];
  }
  return planes.map((mesh) => mesh.position.clone());
}

function expandDifferencePointsForPenetration(points, extend = 2.4) {
  if (!Array.isArray(points) || points.length < 2) { return points || []; }
  const out = points.map((p) => p.clone());
  const headDir = out[0].clone().sub(out[1]);
  if (headDir.lengthSq() > 1e-8) {
    out[0].add(headDir.normalize().multiplyScalar(extend));
  }
  const last = out.length - 1;
  const tailDir = out[last].clone().sub(out[last - 1]);
  if (tailDir.lengthSq() > 1e-8) {
    out[last].add(tailDir.normalize().multiplyScalar(extend));
  }
  return out;
}

function buildDifferencePath(points, pathType) {
  if (points.length < 2) { return null; }
  if (pathType === 'linear') {
    return null;
  }
  return new THREE.CatmullRomCurve3(points.map((p) => p.clone()), false, 'catmullrom', 0.2);
}

function createSegmentBoxGeometry(start, end, width = 0.85, height = 0.85) {
  const dir = end.clone().sub(start);
  const len = dir.length();
  if (len < 1e-5) { return null; }
  const geom = new THREE.BoxGeometry(width, height, len);
  const mid = start.clone().add(end).multiplyScalar(0.5);

  // ロールを固定（0）して、yaw/pitch のみで姿勢を決める。
  const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
  const yaw = Math.atan2(planarDir.x, planarDir.z);
  const planarLen = Math.max(1e-8, planarDir.length());
  const pitch = Math.atan2(dir.y, planarLen);
  const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
  const mat = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
  geom.applyMatrix4(mat);
  return geom;
}

function buildDifferenceCutterMesh(points, { shapeType = 'tube', pathType = 'smooth' } = {}) {
  if (!Array.isArray(points) || points.length < 2) { return null; }
  const workingPoints = expandDifferencePointsForPenetration(points, 2.4);

  let geometry = null;
  if (shapeType === 'box') {
    const geoms = [];
    if (pathType === 'smooth' && workingPoints.length >= 3) {
      const curve = buildDifferencePath(workingPoints, 'smooth');
      const samples = curve.getPoints(Math.max(32, workingPoints.length * 24));
      for (let i = 0; i < samples.length - 1; i += 1) {
        const g = createSegmentBoxGeometry(samples[i], samples[i + 1]);
        if (g) { geoms.push(g); }
      }
    } else {
      for (let i = 0; i < workingPoints.length - 1; i += 1) {
        const g = createSegmentBoxGeometry(workingPoints[i], workingPoints[i + 1]);
        if (g) { geoms.push(g); }
      }
    }
    if (geoms.length > 0) {
      geometry = mergeGeometries(geoms, false);
      geoms.forEach((g) => g.dispose?.());
    }
  } else {
    let curve = null;
    if (pathType === 'smooth' && workingPoints.length >= 3) {
      curve = buildDifferencePath(workingPoints, 'smooth');
    } else {
      const curvePath = new THREE.CurvePath();
      for (let i = 0; i < workingPoints.length - 1; i += 1) {
        curvePath.add(new THREE.LineCurve3(workingPoints[i].clone(), workingPoints[i + 1].clone()));
      }
      curve = curvePath;
    }
    geometry = new THREE.TubeGeometry(curve, Math.max(36, workingPoints.length * 26), 0.42, 18, false);
  }

  if (!geometry) { return null; }

  const material = new THREE.MeshStandardMaterial({
    color: 0x2ed0c9,
    transparent: true,
    opacity: 0.5,
    metalness: 0.1,
    roughness: 0.42,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'DifferencePreviewCutter';
  mesh.renderOrder = 1200;
  return mesh;
}

function buildDifferenceCutterMeshFromSpaces() {
  const spaces = differenceSpacePlanes.filter((mesh) => mesh?.parent && mesh?.geometry);
  if (spaces.length < 1) { return null; }

  const geoms = [];
  spaces.forEach((mesh) => {
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    geoms.push(g);
  });
  if (geoms.length < 1) { return null; }

  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose?.());
  if (!merged) { return null; }
  merged.computeVertexNormals();
  merged.computeBoundingBox?.();
  merged.computeBoundingSphere?.();

  const material = new THREE.MeshStandardMaterial({
    color: 0x2ed0c9,
    transparent: true,
    opacity: 0.5,
    metalness: 0.1,
    roughness: 0.42,
    depthWrite: false,
  });
  const cutter = new THREE.Mesh(merged, material);
  cutter.name = 'DifferencePreviewCutter';
  cutter.renderOrder = 1200;
  return cutter;
}

function updateDifferenceStatus(text) {
  if (!differenceStatus) { return; }
  differenceStatus.textContent = text;
}

function refreshDifferencePreview() {
  clearDifferencePreviewTube();
  const points = getDifferenceSelectedPoints();
  if (!differenceSpaceModeActive) { return false; }
  // チューブは tube モード時のみ生成する。
  if (differenceSpaceTransformMode !== 'tube') {
    return false;
  }
  if (points.length < 2) {
    updateDifferenceStatus('spaceで平面を1枚以上配置してください。');
    return false;
  }
  const cutter = buildDifferenceCutterMesh(points, {
    shapeType: differenceShapeType,
    pathType: differencePathType,
  });
  if (!cutter) {
    updateDifferenceStatus('プレビュー作成に失敗しました。');
    return false;
  }
  scene.add(cutter);
  differencePreviewTube = cutter;
  updateDifferenceStatus(`プレビュー表示中: ${differenceShapeType} / ${differencePathType}`);
  return true;
}

function applyDifferenceToSinjyuku(cutterMesh) {
  if (!cutterMesh || !cutterMesh.geometry) { return 0; }
  if (!sinjyukuCity) {
    sinjyukuCity = scene.getObjectByName('sinjyuku_city');
  }
  if (!sinjyukuCity) {
    console.warn('sinjyuku_city is not available yet.');
    return 0;
  }

  scene.updateMatrixWorld(true);
  cutterMesh.updateMatrixWorld(true);
  const cutterBox = new THREE.Box3().setFromObject(cutterMesh);

  let changedCount = 0;
  sinjyukuCity.traverse((node) => {
    if (!node?.isMesh || !node.geometry) { return; }
    const meshBox = new THREE.Box3().setFromObject(node);
    if (!meshBox.intersectsBox(cutterBox)) { return; }

    const targetGeometry = node.geometry.clone();
    const cutterLocalGeometry = cutterMesh.geometry.clone();
    const worldToLocal = node.matrixWorld.clone().invert();
    cutterLocalGeometry.applyMatrix4(worldToLocal.multiply(cutterMesh.matrixWorld));

    const aBrush = new Brush(targetGeometry);
    const bBrush = new Brush(cutterLocalGeometry);
    let result = null;
    try {
      result = differenceCsgEvaluator.evaluate(aBrush, bBrush, differenceCsgOperation);
    } catch (err) {
      console.warn('Difference CSG failed for one mesh.', err);
      targetGeometry.dispose?.();
      cutterLocalGeometry.dispose?.();
      return;
    }
    if (!result?.geometry) {
      targetGeometry.dispose?.();
      cutterLocalGeometry.dispose?.();
      return;
    }

    result.geometry.computeVertexNormals();
    if (node.geometry?.dispose) {
      node.geometry.dispose();
    }
    node.geometry = result.geometry;
    if (Array.isArray(node.material)) {
      node.material.forEach((mat) => { if (mat) mat.needsUpdate = true; });
    } else if (node.material) {
      node.material.needsUpdate = true;
    }
    changedCount += 1;
  });

  return changedCount;
}

function runDifferenceOnSinjyukuFromSelectedPoints() {
  const spaceCutter = buildDifferenceCutterMeshFromSpaces();
  const selectedPoints = getDifferenceSelectedPoints();
  const pathCutter = (selectedPoints.length >= 2)
    ? (differencePreviewTube || buildDifferenceCutterMesh(selectedPoints, {
      shapeType: differenceShapeType,
      pathType: differencePathType,
    }))
    : null;
  const cutter = spaceCutter || pathCutter;
  if (!cutter) {
    console.warn('Failed to create Difference cutter.');
    updateDifferenceStatus('空間を1つ以上作成してから excavation を押してください。');
    return false;
  }

  if (spaceCutter) {
    if (differencePreviewTube?.parent) {
      differencePreviewTube.parent.remove(differencePreviewTube);
    }
    if (differencePreviewTube?.geometry?.dispose) {
      differencePreviewTube.geometry.dispose();
    }
    if (differencePreviewTube?.material?.dispose) {
      differencePreviewTube.material.dispose();
    }
    differencePreviewTube = cutter;
    scene.add(cutter);
  } else if (!differencePreviewTube) {
    scene.add(cutter);
    differencePreviewTube = cutter;
  }

  const changedCount = applyDifferenceToSinjyuku(cutter);
  if (changedCount < 1) {
    console.warn('Difference executed, but no sinjyuku_city mesh was updated.');
    updateDifferenceStatus('対象に交差しませんでした。');
    return false;
  }
  console.log(`Difference applied to ${changedCount} sinjyuku meshes.`);
  updateDifferenceStatus(`excavation完了: ${changedCount} メッシュ更新`);
  return true;
}

function getIntersectObjects(){

  // レイキャスト = マウス位置からまっすぐに伸びる光線ベクトルを生成
  raycaster.setFromCamera(mouse, camera);

  // その光線とぶつかったオブジェクトを得る
  if (editObject === 'STEEL_FRAME' && objectEditMode === 'CREATE_NEW') {
    const list = targetObjects.concat(guideRailPickMeshes);
    return raycaster.intersectObjects(list, true);
  }
  return raycaster.intersectObjects(targetObjects, true);
};

let TargetDiff = [0,0]

function coord_DisplayTo3DAtCenter(axis) {
  const prev = { x: mouse.x, y: mouse.y };
  mouse.x = 0;
  mouse.y = 0;
  const point = coord_DisplayTo3D(axis);
  mouse.x = prev.x;
  mouse.y = prev.y;
  return point;
}

function setGuideGridColor(color) {
  if (!GuideGrid || !GuideGrid.material) { return; }
  if (Array.isArray(GuideGrid.material)) {
    GuideGrid.material.forEach((mat) => mat?.color?.set?.(color));
  } else if (GuideGrid.material.color) {
    GuideGrid.material.color.set(color);
  }
}

function setAddPointGuideGridColor(color) {
  if (!AddPointGuideGrid || !AddPointGuideGrid.material) { return; }
  if (Array.isArray(AddPointGuideGrid.material)) {
    AddPointGuideGrid.material.forEach((mat) => mat?.color?.set?.(color));
  } else if (AddPointGuideGrid.material.color) {
    AddPointGuideGrid.material.color.set(color);
  }
}

function setGuideGridVisibleFromUI(visible) {
  GuideGrid.visible = Boolean(visible);
}

function setAddPointGuideGridVisibleFromUI(visible) {
  AddPointGuideGrid.visible = Boolean(visible);
}

function resetChoiceObjectColor(mesh) {
  if (!mesh) { return; }
  if (mesh?.userData?.differenceSpacePlane) {
    setDifferencePlaneVisual(mesh, mesh === differenceSelectedPlane);
    return;
  }
  if (editObject === 'STEEL_FRAME' && steelFrameMode?.isSelectedPoint && steelFrameMode.isSelectedPoint(mesh)) {
    // グループ所属は水色に戻す
    if (mesh?.material?.color) {
      mesh.material.color.set(0x7be6ff);
    }
    return;
  }
  if (editObject === 'STEEL_FRAME' && objectEditMode === 'CONSTRUCT') {
    steelFrameMode.restorePointColor(mesh);
    return;
  }
  if (mesh === addPointGridHandle) {
    mesh.material.color.set(0xff0000);
    setAddPointGuideGridColor(0xff0000);
    return;
  }
  if (objectEditMode === 'CONSTRUCT' && !pick_vertexs.includes(mesh.id)) {
    mesh.material.color.set(0xff0000);
    return;
  }
  mesh.material.color.set(0xff0000);
}

// 毎フレーム時に実行されるループイベントです
async function search_point() {
  
  if (!search_object){return}

  // 画面上の光線とぶつかったオブジェクトを得る
  const intersects = getIntersectObjects();
  
  await sleep(80);

  if (intersects.length > 0) {
    const guideHit = intersects.find(hit => hit?.object?.userData?.isGuideRail);
    if (!addPointGridActive || objectEditMode === 'MOVE_EXISTING') {
      guideRailHover = null;
      setGuideHoverPin(null);
    } else if (guideHit?.object?.userData?.isGuideRail && guideHit.point) {
      const curve = guideHit.object.userData.guideCurve;
      const nearest = curve ? getNearestPointOnCurve(curve, guideHit.point) : null;
      guideRailHover = nearest ? { curve, point: nearest } : null;
      if (guideRailHover) {
        GuideGrid.visible = true;
        GuideGrid.position.copy(guideRailHover.point);
        GuideGrid.material.color.set(0x88aa88);
        setGuideHoverPin(guideRailHover.point);
      }
    } else {
      guideRailHover = null;
      setGuideHoverPin(null);
    }
    // console.log('hit')
    // console.log(intersects.length)
    if (choice_object != intersects[0].object){
      if (choice_object !== false){ 
        // 残像防止
        console.log('green')
        resetChoiceObjectColor(choice_object);

        GuideLine.visible = false
      }

      // 物体の取得
      choice_object = intersects[0].object
      choice_object.material.color.set(0x00ff00)
      if (choice_object === addPointGridHandle) {
        setAddPointGuideGridColor(0x00ff00);
      }

      console.log('color set')
      console.log(choice_object)

      if (move_direction_y){
        GuideLine.position.copy(choice_object.position)
        GuideLine.quaternion.identity()
        GuideLine.visible = true
      } else if (pointRotateModeActive) {
        showPointRotationGuideLine(choice_object);

      } else {
        if (movePlaneMode !== 'change_angle') {
          GuideGrid.visible = true
        }
        if (targetObjects.includes(addPointGridHandle)) {
          AddPointGuideGrid.position.copy(choice_object.position)
          setAddPointGuideGridColor(0x88aa88)
          if (movePlaneMode !== 'change_angle') {
            GuideGrid.position.copy(choice_object.position)
            GuideGrid.material.color.set(0x88aa88)
          }
        } else {
          if (movePlaneMode !== 'change_angle') {
            GuideGrid.position.copy(choice_object.position)
            GuideGrid.material.color.set(0x88aa88)
          }
        }
        // visibility controlled by UIevent
      }
    }

  } else {
    // console.log('not hit')
    if (choice_object !== false){
      resetChoiceObjectColor(choice_object);
    }

    choice_object = false;
    guideRailHover = null;
    setGuideHoverPin(null);
    // dragging = false;
    GuideLine.visible = false
    GuideGrid.visible = false
  }  

  // レンダリング
  renderer.render(scene, camera);
  await search_point();
}

async function onerun_search_point() {
  
  // 画面上の光線とぶつかったオブジェクトを得る
  const intersects = getIntersectObjects();
  

  if (intersects.length > 0) {
    const guideHit = intersects.find(hit => hit?.object?.userData?.isGuideRail);
    if (!addPointGridActive || objectEditMode === 'MOVE_EXISTING') {
      guideRailHover = null;
      setGuideHoverPin(null);
    } else if (guideHit?.object?.userData?.isGuideRail && guideHit.point) {
      const curve = guideHit.object.userData.guideCurve;
      const nearest = curve ? getNearestPointOnCurve(curve, guideHit.point) : null;
      guideRailHover = nearest ? { curve, point: nearest } : null;
      if (guideRailHover) {
        GuideGrid.visible = true;
        GuideGrid.position.copy(guideRailHover.point);
        GuideGrid.material.color.set(0x88aa88);
        setGuideHoverPin(guideRailHover.point);
      }
    } else {
      guideRailHover = null;
      setGuideHoverPin(null);
    }
    // console.log('hit')
    console.log(intersects.length)
    if (choice_object != intersects[0].object){
      if (choice_object !== false){ 
        // 残像防止
        console.log('green')
        resetChoiceObjectColor(choice_object);

        GuideLine.visible = false
      }

      // 物体の取得
      choice_object = intersects[0].object
      choice_object.material.color.set(0x00ff00)
      if (choice_object === addPointGridHandle) {
        setAddPointGuideGridColor(0x00ff00);
      }

      console.log('color set')
      console.log(choice_object)

      if (move_direction_y){
        GuideLine.position.copy(choice_object.position)
        GuideLine.quaternion.identity()
        GuideLine.visible = true
      } else if (pointRotateModeActive) {
        showPointRotationGuideLine(choice_object);

      } else {
        if (movePlaneMode !== 'change_angle') {
          GuideGrid.visible = true
        }
        if (targetObjects.includes(addPointGridHandle)) {
          AddPointGuideGrid.position.copy(choice_object.position)
          setAddPointGuideGridColor(0x88aa88)
          if (movePlaneMode !== 'change_angle') {
            GuideGrid.position.copy(choice_object.position)
            GuideGrid.material.color.set(0x88aa88)
          }
        } else {
          if (movePlaneMode !== 'change_angle') {
            GuideGrid.position.copy(choice_object.position)
            GuideGrid.material.color.set(0x88aa88)
          }
        }
        // visibility controlled by UIevent
      }
    }

  } else {
    // console.log('not hit')
    if (choice_object !== false){
      resetChoiceObjectColor(choice_object);
    }

    choice_object = false;
    guideRailHover = null;
    setGuideHoverPin(null);
    // dragging = false;
    GuideLine.visible = false
    GuideGrid.visible = false
  }  

  // レンダリング
  renderer.render(scene, camera);
  return choice_object;
}

function coord_DisplayTo3D(Axis_num=false){

  const pos = camera.position
  
  let t = 0
  let point = []
  if (choice_object?.userData?.planeRef && !move_direction_y) {
    const planeRef = choice_object.userData.planeRef;
    const normal = new THREE.Vector3(0, 1, 0);
    if (planeRef?.quaternion) {
      normal.applyQuaternion(planeRef.quaternion).normalize();
    }
    const anchor = planeRef?.position ? planeRef.position : choice_object.position;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, anchor);
    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(plane, hit);
    if (ok) {
      return hit;
    }
  }
  if (movePlaneMode === 'change_angle' && choice_object) {
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(movePlaneNormal, movePlaneAnchor);
    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(plane, hit);
    if (ok) {
      return hit;
    }
  }
  if (movePlaneMode === 'change_angle' && changeAngleGridTarget && !move_direction_y) {
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(movePlaneNormal, movePlaneAnchor);
    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(plane, hit);
    if (ok) {
      return hit;
    }
  }
  if (move_direction_y === false | Axis_num === false){

    let set_y = 1
    if (Axis_num!=false){ set_y = Axis_num.y}

    raycaster.setFromCamera(mouse, camera);
    const dir = raycaster.ray.direction

    const t = Math.abs((pos.y - set_y)/dir.y)

    // 交点を計算
    point = new THREE.Vector3(
      pos.x + dir.x * t,
      set_y,
      pos.z + dir.z * t
    );

    // console.log(point)
    // if (targetObjects.length === 2){
    //   const pos_0 = targetObjects[0].position
    //   const phi = 0.768 + 1.5708
    //   const phi_rangth = Math.sqrt((point.x - pos_0.x)**2 + (point.z - pos_0.z)**2) 
    //   point.x = pos_0.x + Math.sin(phi) * phi_rangth
    //   point.z = pos_0.z + Math.cos(phi) * phi_rangth
    // }

    // console.log('point : '+point.x+', '+point.y+', '+point.z)

    if (objectEditMode != 'CREATE_NEW') {
      point.x += TargetDiff[0]
      point.z += TargetDiff[1]
    }

    // console.log('point : '+point.x+', '+point.y+', '+point.z)

  } else {
    raycaster.setFromCamera(mouse, camera);
    const dir = raycaster.ray.direction
    
    const diff = {x: Axis_num.x - pos.x, z: Axis_num.z - pos.z}
    const hypotenuse = Math.cos(Math.atan2(diff.x, diff.z) - cameraAngleY) * Math.sqrt(diff.x**2 + diff.z**2)
    
    // console.log('• • : '+'x, '+diff.x+'z, '+diff.z)
    // console.log('•-• : '+hypotenuse)
    // console.log('_./ : '+mouAngleY + ' x,'+ Math.sin(mouAngleY) + ' y,'+Math.cos(mouAngleY))
    // console.log('--,-: '+(hypotenuse/Math.cos(mouAngleY))*Math.cos(mouAngleY),hypotenuse/Math.cos(mouAngleY)*dir.y)
    
    t = hypotenuse/(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x)//,dir.z
    
    // console.log('/ : '+hypotenuse+' '+Math.floor(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x))
    // console.log('t : '+t)
  
    // 交点を計算
    point = new THREE.Vector3(
      Axis_num.x,
      // pos.x + dir.x * t,
      pos.y + dir.y * t,
      // pos.z + dir.z * t,
      Axis_num.z
    );

    point.y += TargetDiff

  }
  return point
}

// ヘルパー：対象Object3Dのマテリアルに色を適用（配列マテリアル対応）
function applyColor(obj, color) {
  const m = obj.material;
  if (!m) return false;

  const set = (mat) => mat?.color?.set?.(color);

  if (Array.isArray(m)) {
    let ok = false;
    m.forEach(mm => { ok = set(mm) || ok; });
    return ok;
  } else {
    return !!set(m);
  }
}

/**
 * 複数 id のオブジェクトの色を変更
 * @param {THREE.Scene} scene
 * @param {number[]|Set<number>} ids - Object3D.id のリスト
 * @param {string|number|THREE.Color|Object|Function} colorSpec
 *    - 1色を全てに: '#ff5533' や 0xff5533, new THREE.Color(…)
 *    - id→色のマップ: { 12:'#f00', 34:'#0f0' }
 *    - 関数: (id, obj) => 色
 * @param {Object} [opts]
 * @param {boolean} [opts.deep=false] - 子孫も含めて色変更（traverse）
 * @returns {{success:number[], notFound:number[], skipped:number[]}}
 */
function setColorsByIds(scene, ids, colorSpec, opts = {}) {
  const { deep = false } = opts;
  const idSet = Array.isArray(ids) ? new Set(ids) : new Set([...ids]);

  const success = [];
  const notFound = [];
  const skipped  = [];

  const getColorFor = (id, obj) => {
    if (typeof colorSpec === 'function') return colorSpec(id, obj);
    if (colorSpec && typeof colorSpec === 'object' && !(colorSpec.isColor)) {
      // マップ指定
      return id in colorSpec ? colorSpec[id] : undefined;
    }
    // 単一色
    return colorSpec;
  };

  idSet.forEach((id) => {
    const obj = scene.getObjectById(id);
    if (!obj) { notFound.push(id); return; }

    const color = getColorFor(id, obj);
    if (color === undefined) { skipped.push(id); return; }

    let changed = false;
    if (deep) {
      obj.traverse(o => { changed = applyColor(o, color) || changed; });
    } else {
      changed = applyColor(obj, color);
    }

    (changed ? success : skipped).push(id);
  });

  return { success, notFound, skipped };
}


// 近似比較
function equals3(ax, ay, az, bx, by, bz, eps) {
  return Math.abs(ax - bx) <= eps &&
         Math.abs(ay - by) <= eps &&
         Math.abs(az - bz) <= eps;
}

/**
 * 三角形単位でターゲット3頂点の出現を調べる
 * @param {Object} args
 * @param {Float32Array|number[]|THREE.BufferAttribute|number[][]} args.tiles
 *   - 非インデックス: [x0,y0,z0, x1,y1,z1, ...] または [[x,y,z], ...] や BufferAttribute(itemSize=3)
 * @param {Uint16Array|Uint32Array|number[]|THREE.BufferAttribute|null} [args.indices]
 *   - インデックス配列（3つで1三角形）。非インデックスなら省略
 * @param {Array<[number,number,number]>|Array<THREE.Vector3>} args.targets
 *   - 長さ3を想定（重複なし前提）
 * @param {number} [args.eps=1e-6]
 * @returns {{
 *   allTargetsFound: boolean,               // 3頂点すべてどこかの三角形に存在
 *   anyTriangleContainsAllThree: boolean,   // 同一三角形の中に3頂点すべてが揃うものがある
 *   targetsFoundAt: number[],               // 各ターゲットが見つかった "頂点インデックス"（見つからない場合-1）
 *   trianglesWithAny: number[],             // ターゲットのいずれかを含む三角形インデックス一覧
 *   trianglesWithAllThree: number[],        // 3頂点すべてを含む三角形インデックス一覧（通常0か1個）
 *   hitsPerTriangle: Array<{triIndex:number, vertexIndices:[number,number,number], matchedTargets:boolean[]}>
 * }}
 */
function findTargetsByTriangles( tiles, targets, indices = 3, eps = 1e-6 ) {
  if (tiles.length === 0){return null};
  const range_num = tiles.length / indices //- tiles.length % indices
  console.log('range : '+range_num)
  for (let ti = 0; ti < range_num -1; ti++){
    console.log('tile : '+ti*indices)
    const now_tile = [tiles[ti*indices],tiles[ti*indices+1],tiles[ti*indices+2]]
    let hit_num = 0
    for ( let i = 0; i < 3; i++){
      if (now_tile[0] === targets[i][0] && now_tile[1] === targets[i][1] && now_tile[2] === targets[i][2]){
        hit_num += 1
        console.log('hit : '+range_num)
        for ( let vi = 0; vi < 6; vi+=3){
          for ( let i = 0; i < 3; i++){
            if (tiles[ti*indices+3+vi] === targets[i][0] && tiles[ti*indices+3+vi+1] === targets[i][1] && tiles[ti*indices+3+vi+2] === targets[i][2]){
              hit_num += 1
              break
            }
          }
        }
      }
      if (hit_num === 3){
        return ti*indices
      }
    }
  }

  return null
}


// 1) Object3D を id で取得
function getObjectById(scene, id) {
  return scene.getObjectById(id) || null;
}

// 2) ローカル/ワールド座標を取得
function getPositionById(scene, id, space = 'world') {
  const obj = scene.getObjectById(id);
  if (!obj) return null;

  if (space === 'world') {
    // 最新のワールド行列を反映してから取得
    scene.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    return p;
  }
  return obj.position.clone(); // local
}

let dragging = false;
let efficacy = true;
let lastPointerClient = null;
let moveClickPending = false;
let moveDownPos = null;
let shouldToggle = false;
let moveDragStartPositions = [];
let moveDragAnchorStart = null;
const MOVE_CLICK_THRESHOLD = 4;
let movePlaneMode = 'default';
let movePlaneAnchor = new THREE.Vector3();
let movePlaneAngles = { x: 0, y: 0, z: 0 };
let movePlaneNormal = new THREE.Vector3(0, 1, 0);
let movePlaneBasisQuat = new THREE.Quaternion();
const movePlaneGrid = new THREE.PlaneHelper(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), 8, 0x7be6ff);
const movePlaneGridHelper = new THREE.GridHelper(8, 8, 0x7be6ff, 0x7be6ff);
movePlaneGridHelper.material.transparent = true;
movePlaneGridHelper.material.opacity = 0.6;
movePlaneGridHelper.visible = false;
movePlaneGrid.visible = false;
scene.add(movePlaneGrid);
scene.add(movePlaneGridHelper);
let movePlaneGizmoGroup = null;
const movePlaneGizmoMeshes = [];
let movePlaneRotateDragging = false;
let movePlaneRotateAxis = new THREE.Vector3(0, 1, 0);
let movePlaneRotateAxisLocal = null;
let movePlaneRotateStartVector = new THREE.Vector3();
let movePlaneRotatePlane = new THREE.Plane();
let movePlaneNormalStart = new THREE.Vector3(0, 1, 0);
let movePlaneBasisQuatStart = new THREE.Quaternion();
let movePlaneRotateCenter = new THREE.Vector3();
let movePlaneGizmoQuat = new THREE.Quaternion();
let movePlaneGizmoYaw = 0;
let movePlaneGizmoYawStart = 0;
let movePlanePanelAngles = { x: 0, y: 0, z: 0 };
let movePlanePanelAnglesStart = { x: 0, y: 0, z: 0 };

function syncMovePlaneGizmoFromBasis() {
  const moveForward = new THREE.Vector3(0, 0, 1).applyQuaternion(movePlaneBasisQuat);
  movePlaneGizmoYaw = Math.atan2(moveForward.x, moveForward.z);
  movePlaneGizmoYawStart = movePlaneGizmoYaw;
  movePlaneGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), movePlaneGizmoYaw);
}

function syncChangeAnglePanelFromBasis({ writeValue = false } = {}) {
  const state = (changeAngleGridTarget?.userData?.changeAnglePanelAngles)
    ? { ...changeAngleGridTarget.userData.changeAnglePanelAngles }
    : { ...movePlanePanelAngles };
  const axDeg = Number(state.x) || 0;
  const ayDeg = Number(state.y) || 0;
  const azDeg = Number(state.z) || 0;
  movePlanePanelAngles = { x: axDeg, y: ayDeg, z: azDeg };
  movePlaneAngles = { ...movePlanePanelAngles };

  if (rotationInputX) {
    if (writeValue) {
      rotationInputX.value = String(axDeg.toFixed(1));
    } else {
      rotationInputX.value = '';
    }
    rotationInputX.placeholder = String(Number(axDeg.toFixed(1)));
  }
  if (rotationInputY) {
    if (writeValue) {
      rotationInputY.value = String(ayDeg.toFixed(1));
    } else {
      rotationInputY.value = '';
    }
    rotationInputY.placeholder = String(Number(ayDeg.toFixed(1)));
  }
  if (rotationInputZ) {
    if (writeValue) {
      rotationInputZ.value = String(azDeg.toFixed(1));
    } else {
      rotationInputZ.value = '';
    }
    rotationInputZ.placeholder = String(Number(azDeg.toFixed(1)));
  }
}

function saveChangeAnglePanelAngles(state, { writeValue = true } = {}) {
  const next = {
    x: Number(state?.x) || 0,
    y: Number(state?.y) || 0,
    z: Number(state?.z) || 0,
  };
  movePlanePanelAngles = next;
  movePlaneAngles = { ...next };
  if (changeAngleGridTarget) {
    changeAngleGridTarget.userData = {
      ...(changeAngleGridTarget.userData || {}),
      changeAnglePanelAngles: { ...next },
    };
  }
  if (rotationInputX) {
    rotationInputX.value = writeValue ? String(next.x.toFixed(1)) : '';
    rotationInputX.placeholder = String(Number(next.x.toFixed(1)));
  }
  if (rotationInputY) {
    rotationInputY.value = writeValue ? String(next.y.toFixed(1)) : '';
    rotationInputY.placeholder = String(Number(next.y.toFixed(1)));
  }
  if (rotationInputZ) {
    rotationInputZ.value = writeValue ? String(next.z.toFixed(1)) : '';
    rotationInputZ.placeholder = String(Number(next.z.toFixed(1)));
  }
}

function updateMovePlaneNormal() {
  const base = new THREE.Vector3(0, 1, 0);
  if (movePlaneMode === 'change_angle') {
    movePlaneNormal.copy(base.applyQuaternion(movePlaneBasisQuat)).normalize();
  } else {
    const euler = new THREE.Euler(
      movePlaneAngles.x * Math.PI / 180,
      movePlaneAngles.y * Math.PI / 180,
      movePlaneAngles.z * Math.PI / 180,
      'XYZ'
    );
    movePlaneNormal.copy(base.applyEuler(euler)).normalize();
  }
  movePlaneGrid.plane.setFromNormalAndCoplanarPoint(movePlaneNormal, movePlaneAnchor);
  movePlaneGrid.position.copy(movePlaneAnchor);
  movePlaneGrid.quaternion.copy(movePlaneBasisQuat);
  movePlaneGrid.updateMatrixWorld(true);
  movePlaneGridHelper.position.copy(movePlaneAnchor);
  movePlaneGridHelper.quaternion.copy(movePlaneBasisQuat);
  movePlaneGridHelper.updateMatrixWorld(true);
  if (movePlaneMode === 'change_angle') {
    addPointGridHandle.position.copy(movePlaneAnchor);
    addPointGridHandle.quaternion.copy(movePlaneBasisQuat).multiply(addPointGridBaseQuat);
    if (changeAngleGridTarget) {
      changeAngleGridTarget.position.copy(movePlaneAnchor);
      changeAngleGridTarget.quaternion.copy(movePlaneBasisQuat);
      changeAngleGridTarget.updateMatrixWorld(true);
      const pick = changeAngleGridTarget.userData?.pickMesh;
      if (pick) {
        pick.position.copy(changeAngleGridTarget.position);
        pick.quaternion.copy(changeAngleGridTarget.quaternion).multiply(addPointGridBaseQuat);
        pick.updateMatrixWorld(true);
      }
    }
  }
  updateMovePlaneGizmo();
}

function updateMovePlaneGizmo() {
  if (!movePlaneGizmoGroup) { return; }
  movePlaneGizmoGroup.position.copy(movePlaneAnchor);
  movePlaneGizmoGroup.quaternion.copy(movePlaneGizmoQuat);
  movePlaneGizmoGroup.visible = movePlaneMode === 'change_angle';
  movePlaneGizmoGroup.updateMatrixWorld(true);
}

function ensureMovePlaneGizmo() {
  if (movePlaneGizmoGroup) { return; }
  movePlaneGizmoGroup = new THREE.Group();
  movePlaneGizmoGroup.name = 'MovePlaneGizmo';

  const ringRadius = 1.0;
  const ringTube = 0.03;
  const geom = new THREE.TorusGeometry(ringRadius, ringTube, 12, 64);
  const makeRing = (color, axis) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { ...(mesh.userData || {}), isMovePlaneGizmo: true, axis };
    movePlaneGizmoGroup.add(mesh);
    movePlaneGizmoMeshes.push(mesh);
    return mesh;
  };

  const ringX = makeRing(0xff5c5c, new THREE.Vector3(1, 0, 0));
  ringX.rotation.y = Math.PI / 2;
  const ringY = makeRing(0x5cff88, new THREE.Vector3(0, 1, 0));
  ringY.rotation.x = Math.PI / 2;
  // change_angle では X/Y のみ使用（Zリングは表示しない）

  movePlaneGizmoGroup.visible = false;
  scene.add(movePlaneGizmoGroup);
}

function beginMovePlaneRotateDrag(axisMesh) {
  ensureMovePlaneGizmo();
  movePlaneRotateAxisLocal = axisMesh.userData.axis.clone().normalize();
  // 平面側の軸は現在の平面回転を反映した軸に合わせる
  if (movePlaneRotateAxisLocal.y === 1) {
    // Y軸は常にワールド固定
    movePlaneRotateAxis = new THREE.Vector3(0, 1, 0);
  } else {
    // X/Z は平面の回転に追従
    movePlaneRotateAxis = movePlaneRotateAxisLocal.clone().applyQuaternion(movePlaneBasisQuat).normalize();
  }
  movePlaneRotateCenter.copy(movePlaneAnchor);
  movePlaneRotatePlane.setFromNormalAndCoplanarPoint(movePlaneRotateAxis, movePlaneRotateCenter);
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(movePlaneRotatePlane, hit);
  if (!ok) { return; }
  movePlaneRotateStartVector.copy(hit).sub(movePlaneRotateCenter).normalize();
  movePlaneNormalStart.copy(movePlaneNormal);
  movePlaneBasisQuatStart.copy(movePlaneBasisQuat);
  movePlanePanelAnglesStart = (changeAngleGridTarget?.userData?.changeAnglePanelAngles)
    ? { ...changeAngleGridTarget.userData.changeAnglePanelAngles }
    : { ...movePlanePanelAngles };
  if (movePlaneRotateAxisLocal && movePlaneRotateAxisLocal.y === 1) {
    movePlaneGizmoYawStart = movePlaneGizmoYaw;
  }
  movePlaneRotateDragging = true;
  efficacy = false;
  console.log('[change_angle] rotate start', {
    axis: movePlaneRotateAxis.toArray(),
    anchor: movePlaneAnchor.toArray(),
  });
}

function beginMovePlaneRotateDragAxis(axisWorld, axisLocal = axisWorld) {
  ensureMovePlaneGizmo();
  movePlaneRotateAxisLocal = axisLocal.clone().normalize();
  movePlaneRotateAxis = axisWorld.clone().normalize();
  movePlaneRotateCenter.copy(movePlaneAnchor);
  movePlaneRotatePlane.setFromNormalAndCoplanarPoint(movePlaneRotateAxis, movePlaneRotateCenter);
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(movePlaneRotatePlane, hit);
  if (!ok) { return; }
  movePlaneRotateStartVector.copy(hit).sub(movePlaneRotateCenter).normalize();
  movePlaneNormalStart.copy(movePlaneNormal);
  movePlaneBasisQuatStart.copy(movePlaneBasisQuat);
  movePlanePanelAnglesStart = (changeAngleGridTarget?.userData?.changeAnglePanelAngles)
    ? { ...changeAngleGridTarget.userData.changeAnglePanelAngles }
    : { ...movePlanePanelAngles };
  if (movePlaneRotateAxisLocal && movePlaneRotateAxisLocal.y === 1) {
    movePlaneGizmoYawStart = movePlaneGizmoYaw;
  }
  movePlaneRotateDragging = true;
  efficacy = false;
  console.log('[change_angle] rotate start (grid)', {
    axis: movePlaneRotateAxis.toArray(),
    anchor: movePlaneAnchor.toArray(),
  });
}

function updateMovePlaneRotateDrag() {
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(movePlaneRotatePlane, hit);
  if (!ok) { return; }
  const current = hit.clone().sub(movePlaneRotateCenter).normalize();
  const cross = new THREE.Vector3().crossVectors(movePlaneRotateStartVector, current);
  const dot = movePlaneRotateStartVector.dot(current);
  const angle = Math.atan2(cross.dot(movePlaneRotateAxis), dot);
  const angleDeg = angle * (180 / Math.PI);
  const deltaQuat = new THREE.Quaternion().setFromAxisAngle(movePlaneRotateAxis, angle);
  movePlaneBasisQuat.copy(deltaQuat.multiply(movePlaneBasisQuatStart)).normalize();
  movePlaneNormal.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(movePlaneBasisQuat)).normalize();
  movePlaneGrid.plane.setFromNormalAndCoplanarPoint(movePlaneNormal, movePlaneAnchor);
  movePlaneGrid.position.copy(movePlaneAnchor);
  movePlaneGrid.quaternion.copy(movePlaneBasisQuat);
  movePlaneGrid.updateMatrixWorld(true);
  movePlaneGridHelper.position.copy(movePlaneAnchor);
  movePlaneGridHelper.quaternion.copy(movePlaneBasisQuat);
  movePlaneGridHelper.updateMatrixWorld(true);
  if (movePlaneMode === 'change_angle' && changeAngleGridTarget) {
    changeAngleGridTarget.position.copy(movePlaneAnchor);
    changeAngleGridTarget.quaternion.copy(movePlaneBasisQuat);
    changeAngleGridTarget.updateMatrixWorld(true);
    addPointGridHandle.position.copy(movePlaneAnchor);
    addPointGridHandle.quaternion.copy(movePlaneBasisQuat).multiply(addPointGridBaseQuat);
    addPointGridHandle.updateMatrixWorld(true);
    const pick = changeAngleGridTarget.userData?.pickMesh;
    if (pick) {
      pick.position.copy(changeAngleGridTarget.position);
      pick.quaternion.copy(changeAngleGridTarget.quaternion).multiply(addPointGridBaseQuat);
      pick.updateMatrixWorld(true);
    }
  }
  // ギズモは平面に追従させず、Y回転時のみワールドY基準で回す
  if (movePlaneRotateAxisLocal && movePlaneRotateAxisLocal.y === 1) {
    movePlaneGizmoYaw = movePlaneGizmoYawStart + angle;
    movePlaneGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), movePlaneGizmoYaw);
  }
  if (movePlaneMode === 'change_angle') {
    const next = { ...movePlanePanelAnglesStart };
    if (movePlaneRotateAxisLocal?.x === 1) {
      next.x = (Number(movePlanePanelAnglesStart.x) || 0) + angleDeg;
    } else if (movePlaneRotateAxisLocal?.y === 1) {
      next.y = (Number(movePlanePanelAnglesStart.y) || 0) + angleDeg;
    } else if (movePlaneRotateAxisLocal?.z === 1) {
      next.z = (Number(movePlanePanelAnglesStart.z) || 0) + angleDeg;
    }
    saveChangeAnglePanelAngles(next, { writeValue: true });
  }
  updateMovePlaneGizmo();
  console.log('[change_angle] rotating', {
    angle,
    normal: movePlaneNormal.toArray(),
  });
}

function handleDrag() {
  if (differenceControlPointDragActive) {
    updateDifferenceControlPointDrag();
    return;
  }
  if (differenceFaceVertexDragActive) {
    updateDifferenceFaceVertexDrag();
    return;
  }
  if (pointRotateMoveDragging) {
    updatePointRotateMoveDrag();
    return;
  }
  if (pointRotateDragging) {
    updatePointRotateDrag();
    return;
  }
  if (rotateDragging) {
    updateRotateDrag();
    return;
  }
  if (movePlaneRotateDragging) {
    updateMovePlaneRotateDrag();
    return;
  }
  if (dragging != true) { return }

  let point = 0

  if (!move_direction_y){
    point = coord_DisplayTo3D(choice_object.position)
  } else {
    point = coord_DisplayTo3D(choice_object.position)
  }

  if (editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING' && moveDragStartPositions.length > 0) {
    const delta = new THREE.Vector3(
      point.x - moveDragAnchorStart.x,
      point.y - moveDragAnchorStart.y,
      point.z - moveDragAnchorStart.z
    );
    moveDragStartPositions.forEach(({ mesh, pos }) => {
      mesh.position.set(pos.x + delta.x, pos.y + delta.y, pos.z + delta.z);
      if (mesh?.userData?.guideCurve && typeof mesh.userData.guideControlIndex === 'number') {
        const curve = mesh.userData.guideCurve;
        const idx = mesh.userData.guideControlIndex;
        if (curve?.userData?.controlPoints && curve.userData.controlPoints[idx]) {
          curve.userData.controlPoints[idx] = mesh.position.clone();
          updateGuideCurve(curve);
        }
      }
    });
  } else {
    if (!choice_object || !choice_object.position) { return; }
    choice_object.position.set(point.x,point.y,point.z)
    if (choice_object?.userData?.guideCurve && typeof choice_object.userData.guideControlIndex === 'number') {
      const curve = choice_object.userData.guideCurve;
      const idx = choice_object.userData.guideControlIndex;
      if (curve?.userData?.controlPoints && curve.userData.controlPoints[idx]) {
        curve.userData.controlPoints[idx] = choice_object.position.clone();
        updateGuideCurve(curve);
      }
    }
  }

  if (choice_object === addPointGridHandle) {
    addPointGridY = choice_object.position.y;
    AddPointGuideGrid.position.set(point.x, point.y, point.z);
  }

  GuideLine.position.set(point.x,point.y,point.z)
  if (move_direction_y) {
    GuideLine.quaternion.identity();
  }
  // GuideLine.visible = true

  if (!move_direction_y){
    GuideGrid.position.set(point.x,point.y,point.z)
    GuideGrid.material.color.set(0x8888aa)
    // GuideGrid.visible = true
  }

  if (editObject === 'RAIL') {
    updateRailPointFromMesh(choice_object);
  }

  drawingObject();
}

async function handleMouseUp(mobile = false) {

  if (pause){return};
  if (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'move' && differenceMoveClickPending) {
    toggleDifferenceMoveSelectionFromPending();
    efficacy = true;
    return;
  }
  if (differenceControlPointDragActive) {
    differenceControlPointDragActive = false;
    differenceControlPointDragPoint = null;
    differenceControlPointDragMesh = null;
    differenceControlPointDragAxisWorld.set(0, 0, 0);
    efficacy = true;
    return;
  }
  if (differenceFaceVertexDragActive) {
    differenceFaceVertexDragActive = false;
    differenceFaceVertexDragMesh = null;
    differenceFaceVertexDragLocalNormal = null;
    efficacy = true;
    return;
  }
  if (pointRotateMoveDragging) {
    pointRotateMoveDragging = false;
    efficacy = true;
    return;
  }
  if (pointRotateDragging) {
    pointRotateDragging = false;
    efficacy = true;
    return;
  }
  if (rotateDragging) {
    rotateDragging = false;
    updateRotateGizmo();
    efficacy = true;
    return;
  }

  if (dragging === true) {
    // ドラッグ中なら必ずここで終了処理
    dragging = false;
    efficacy = true;
    if (objectEditMode === 'MOVE_EXISTING') {
      resetChoiceObjectColor(choice_object);
      search_object = true;
      search_point();
    }
    moveClickPending = false;
    shouldToggle = false;
    moveDragStartPositions = [];
    moveDragAnchorStart = null;
    GuideLine.visible = false;
    drawingObject();
    return;
  }

  if (movePlaneRotateDragging) {
    movePlaneRotateDragging = false;
    efficacy = true;
    return;
  }

  if (editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING' && moveClickPending) {
    moveClickPending = false;
    moveDownPos = null;
    if (shouldToggle) {
      console.log('onerun')
      await onerun_search_point();
      
      if (choice_object) {
        console.log('add_group')
        const already = steelFrameMode.isSelectedPoint(choice_object);
        steelFrameMode.toggleSelectedPoint(choice_object);
        if (steelFrameMode?.getSelectedPointMeshes) {
          const group = steelFrameMode.getSelectedPointMeshes();
          const tag = already ? 'remove' : 'add';
          console.log(`[move_point] group(${tag})`, group.map((m) => ({
            id: m?.id,
            x: m?.position?.x,
            y: m?.position?.y,
            z: m?.position?.z,
          })));
        }
      }
    }
    shouldToggle = true;
    return;
  }

  if (OperationMode === 1 && (objectEditMode === 'MOVE_EXISTING' || objectEditMode === 'CONSTRUCT')){
  
    if (dragging != false){
      
      dragging = false;
      efficacy = true;
      moveClickPending = false;
      shouldToggle = false;
      moveDragStartPositions = [];
      moveDragAnchorStart = null;

      // レイキャスト = マウス位置からまっすぐに伸びる光線ベクトルを生成
      let point= 0
      if (choice_object) { // Only update position if an object was chosen
        if (!move_direction_y){
          point = coord_DisplayTo3D(choice_object.position)
        } else {
          point = coord_DisplayTo3D(choice_object.position)
        }
        
        let txt = ''
        for (let i = 0; i < targetObjects.length; i++){
          const pos = targetObjects[i].position
          txt += ' new THREE.Vector3('+pos.x+', y+'+(pos.y - y)+', '+pos.z+' ),\n'
        }
        console.log(txt)

        // if (editObject === 'ORIGINAL'){}
        choice_object.position.set(point.x,point.y,point.z)
        choice_object.material.color.set(0xff0000) // Reset color to red
      }

      GuideLine.visible = false;
      // visibility controlled by UIevent

      if (editObject === 'RAIL') {
        updateRailPointFromMesh(choice_object);
        if (railModeActive && railTubeDirty) {
          toggleRailTube(true);
        }
      }

      drawingObject();
    }

    if (search_object === false){

      await sleep(200);
      search_object = true;
      choice_object = false; // Deselect the object

      dragging = false
      efficacy = true

      if (!mobile){
        search_point();
      }
    }
  }
}
  
async function handleMouseDown() {
  if (pause || OperationMode != 1) { return; }
  if (pointerBlockedByUI) { return; }

  console.log('run')
  shouldToggle = true

  if (movePlaneMode === 'change_angle') {
    ensureMovePlaneGizmo();
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(movePlaneGizmoMeshes, true);
    const hit = hits[0] || null;
    if (hit) {
      beginMovePlaneRotateDrag(hit.object);
      return;
    }
    if (guideAddGridPicks.length > 0) {
      const gridHits = raycaster.intersectObjects(guideAddGridPicks, true);
      const gridHit = gridHits[0] || null;
      const pickedGrid = gridHit?.object?.userData?.guideAddGrid || null;
      if (pickedGrid) {
        changeAngleGridTarget = pickedGrid;
        if (pickedGrid?.quaternion) {
          movePlaneBasisQuat.copy(pickedGrid.quaternion).normalize();
        } else {
          movePlaneBasisQuat.identity();
        }
        syncMovePlaneGizmoFromBasis();
        movePlaneAnchor.copy(pickedGrid.position);
        updateMovePlaneNormal();
        syncChangeAnglePanelFromBasis({ writeValue: false });
        // クリックで回転開始（ワールドY基準）
        beginMovePlaneRotateDragAxis(new THREE.Vector3(0, 1, 0));
      }
    }
    // change_angle 中はポイント追加や配置を行わない
    return;
  }

  if (constructionModeActive) {
    const pin = pickStructurePinnedPin();
    if (pin) {
      toggleConstructionPinSelection(pin);
    }
    return;
  }

  if (structureModeActive) {
    if (structurePointerBlockedByUI) {
      return;
    }
    placeStructurePinnedPin();
    return;
  }

  if (objectEditMode === ROTATE_MODE) {
    raycaster.setFromCamera(mouse, camera);
    const gizmoHit = raycaster.intersectObjects(rotateGizmoMeshes, true)[0] || null;
    if (gizmoHit) {
      beginRotateDrag(gizmoHit.object);
      return;
    }
    const hits = getIntersectObjects();
    const hit = hits.find((h) => h?.object?.userData?.steelFramePoint);
    if (hit?.object) {
      steelFrameMode.toggleSelectedPoint(hit.object);
      updateRotateGizmo();
    }
    return;
  }

  if (objectEditMode === SEARCH_MODE) {
    raycaster.setFromCamera(mouse, camera);
    const gridHits = raycaster.intersectObjects(guideAddGridPicks, true);
    const gridHit = gridHits[0] || null;
    const pickedGrid = gridHit?.object?.userData?.guideAddGrid || null;
    if (pickedGrid) {
      searchSelectedGrid = pickedGrid;
      guideAddGrids.forEach((grid) => {
        setGuideAddGridColor(grid, grid === pickedGrid ? GUIDE_ADD_GRID_SELECTED_COLOR : GUIDE_ADD_GRID_COLOR);
      });
      updateSearchGridTiltVisuals();
      return;
    }

    const hits = getIntersectObjects();
    const hit = hits.find((h) => h?.object?.userData?.steelFramePoint);
    if (hit?.object) {
      steelFrameMode.toggleSelectedPoint(hit.object);
      updateRotationSelectionInfo();
    }
    return;
  }

  if (pointRotateModeActive) {
    ensurePointRotateGizmo();
    raycaster.setFromCamera(mouse, camera);
    const gizmoHit = raycaster.intersectObjects(pointRotateGizmoMeshes, true)[0] || null;
    if (gizmoHit && pointRotateTarget) {
      beginPointRotateDrag(gizmoHit.object);
      return;
    }
    const hits = getIntersectObjects();
    if (differenceSpaceTransformMode === 'move' && editObject === 'DIFFERENCE_SPACE') {
      const moveHit = hits.find((h) => h?.object?.userData?.differenceControlPoint || h?.object?.userData?.differenceSpacePlane) || null;
      const hitObj = moveHit?.object || null;
      if (hitObj) {
        const isControlPointHit = Boolean(hitObj?.userData?.differenceControlPoint);
        const controlPointHit = isControlPointHit ? moveHit : null;
        const faceHit = !isControlPointHit ? moveHit : null;
        const mesh = isControlPointHit
          ? (hitObj?.userData?.parentDifferenceSpacePlane || hitObj?.parent || null)
          : hitObj;
        if (mesh?.userData?.differenceSpacePlane) {
          pointRotateTarget = mesh;
          selectDifferencePlane(mesh);
          if (controlPointHit?.object?.userData?.differenceControlPoint) {
            controlPointHit.object.getWorldPosition(pointRotateCenter);
          } else if (faceHit?.point) {
            pointRotateCenter.copy(faceHit.point);
          } else {
            pointRotateCenter.copy(mesh.position);
          }
          if (faceHit?.object?.userData?.differenceSpacePlane) {
            const faceNormalWorld = getWorldFaceNormalFromHit(faceHit);
            if (faceNormalWorld) {
              pointRotateDirection.copy(faceNormalWorld).normalize();
              pointRotateBasisQuat.copy(buildBasisQuatFromDirection(pointRotateDirection));
              pointRotateTarget.userData = {
                ...(pointRotateTarget.userData || {}),
                pointRotateDirection: pointRotateDirection.clone(),
                pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
                pointRotateFaceNormalWorld: pointRotateDirection.toArray(),
              };
              pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
              pointRotateGizmoYawStart = pointRotateGizmoYaw;
              pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
              updatePointRotatePanelAnglesFromDirection(pointRotateDirection, { apply: true });
            } else {
              pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
              pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
            }
          } else {
            pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
            pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
          }
          updatePointRotateVisuals();
        }
        differenceMoveClickPending = true;
        differenceMoveShouldToggle = true;
        differenceMoveDownPos = lastPointerClient ? { ...lastPointerClient } : null;
        if (controlPointHit?.object?.userData?.differenceControlPoint) {
          differenceMoveHitKind = 'point';
          differenceMoveHitControlPoint = controlPointHit.object;
          differenceMoveHitFace = null;
          clearDifferenceFaceHighlight();
          return;
        }
        const localNormal = getLocalFaceNormalFromHit(faceHit);
        if (localNormal) {
          differenceMoveHitKind = 'face';
          differenceMoveHitFace = {
            mesh: faceHit.object,
            localNormal: localNormal.clone(),
            hit: faceHit,
          };
          differenceMoveHitControlPoint = null;
          showDifferenceFaceHighlight(faceHit);
          return;
        }
      }
    }
    const controlPointHit = hits.find((h) => h?.object?.userData?.differenceControlPoint);
    if (controlPointHit?.object?.userData?.differenceControlPoint && differenceSpaceTransformMode === 'move') {
      const mesh = controlPointHit.object.userData?.parentDifferenceSpacePlane || controlPointHit.object.parent || null;
      if (mesh?.userData?.differenceSpacePlane) {
        pointRotateTarget = mesh;
        selectDifferencePlane(mesh);
        pointRotateCenter.copy(mesh.position);
        pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
        pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
        updatePointRotateVisuals();
      }
      beginDifferenceControlPointDrag(controlPointHit.object);
      return;
    }
    const hit = hits.find((h) => h?.object?.userData?.steelFramePoint || h?.object?.userData?.differenceSpacePlane);
    if (hit?.object) {
      const pickedFaceNormal = getWorldFaceNormalFromHit(hit);
      if (hit.object?.userData?.differenceSpacePlane && differenceSpaceTransformMode === 'move') {
        pointRotateTarget = hit.object;
        selectDifferencePlane(pointRotateTarget);
        if (beginDifferenceFaceVertexDrag(hit)) {
          pointRotateCenter.copy(pointRotateTarget.position);
          pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(pointRotateTarget));
          pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
          updatePointRotateVisuals();
        }
        return;
      }
      if (pointRotateTarget && hit.object === pointRotateTarget) {
        if (pickedFaceNormal && pointRotateTarget?.userData?.differenceSpacePlane) {
          showDifferenceFaceHighlight(hit);
          pointRotateDirection.copy(pickedFaceNormal).normalize();
          pointRotateBasisQuat.copy(buildBasisQuatFromDirection(pointRotateDirection));
          pointRotateTarget.userData = {
            ...(pointRotateTarget.userData || {}),
            pointRotateDirection: pointRotateDirection.clone(),
            pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
            pointRotateFaceNormalWorld: pointRotateDirection.toArray(),
          };
          pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
          pointRotateGizmoYawStart = pointRotateGizmoYaw;
          pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
          updatePointRotateVisuals();
        }
        beginPointRotateMoveDrag();
        return;
      }
      pointRotateTarget = hit.object;
      if (pointRotateTarget?.userData?.differenceSpacePlane) {
        selectDifferencePlane(pointRotateTarget);
        showDifferenceFaceHighlight(hit);
      }
      pointRotateCenter.copy(pointRotateTarget.position);
      if (pointRotateTarget?.userData?.differenceSpacePlane && pickedFaceNormal) {
        pointRotateDirection.copy(pickedFaceNormal).normalize();
        pointRotateBasisQuat.copy(buildBasisQuatFromDirection(pointRotateDirection));
      } else {
        pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(pointRotateTarget));
        pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
      }
      pointRotateTarget.userData = {
        ...(pointRotateTarget.userData || {}),
        pointRotateDirection: pointRotateDirection.clone(),
        pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
        pointRotateFaceNormalWorld: pointRotateDirection.toArray(),
        pointRotatePanelAngles: pointRotateTarget.userData?.pointRotatePanelAngles || { x: 0, y: 0, z: 0 },
      };
      // 再計算時は Y 軸固定で表示姿勢を復元する
      pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
      pointRotateGizmoYawStart = pointRotateGizmoYaw;
      pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
      updatePointRotateVisuals();
      showPointRotationGuideLine(pointRotateTarget);
      syncPointRotatePanelFromTarget();
      // Difference space の move では、面クリックで即移動ドラッグ開始。
      if (pointRotateTarget?.userData?.differenceSpacePlane
        && differenceSpaceTransformMode === 'move') {
        beginPointRotateMoveDrag();
      }
      // move モード中の選択クリックはここで完結させる
      return;
    }
  }
  
  // 架線柱配置モード
  if (polePlacementMode) {
    const point = coord_DisplayTo3D();
    const pole = TSys.createCatenaryPole(5, 5, 2, 5, 1);
    pole.position.set(point.x, point.y, point.z);
    scene.add(pole);
    deactivateAllModes(); // 配置後に全モードを解除
    return;} 
  
  // 新規作成モード
  if (objectEditMode === 'CREATE_NEW') {

    console.log('adding point...')

    if (guideAddModeActive) {
      const point = coord_DisplayTo3D({ y: addPointGridY || 0 });
      addPointGridActive = true;
      addPointGridHandle.position.set(point.x, addPointGridY || 0, point.z);
      AddPointGuideGrid.position.set(point.x, addPointGridY || 0, point.z);
      setAddPointGuideGridVisibleFromUI(true);
      setGuideAddGridColor(AddPointGuideGrid, GUIDE_ADD_GRID_COLOR);
      // 追加: 現在位置を複製グリッドとして保存
      const newGrid = new THREE.GridHelper(5, 10, GUIDE_ADD_GRID_COLOR, GUIDE_ADD_GRID_COLOR);
      newGrid.name = 'AddPointGuideGridClone';
      newGrid.position.copy(AddPointGuideGrid.position);
      newGrid.quaternion.copy(AddPointGuideGrid.quaternion);
      scene.add(newGrid);
      guideAddGrids.push(newGrid);
      const pick = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 5),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide })
      );
      pick.name = 'GuideAddGridPick';
      pick.position.copy(newGrid.position);
      pick.quaternion.copy(newGrid.quaternion).multiply(addPointGridBaseQuat);
      pick.userData = { ...pick.userData, guideAddGrid: newGrid };
      newGrid.userData = { ...newGrid.userData, pickMesh: pick };
      scene.add(pick);
      guideAddGridPicks.push(pick);
      changeAngleGridTarget = newGrid;
      if (movePlaneMode === 'change_angle') {
        movePlaneAnchor.copy(AddPointGuideGrid.position);
        updateMovePlaneNormal();
      }
      return;
    }

    if (guidePlacementActive && guidePlacementTemplate) {
      let basePoint = coord_DisplayTo3D({ y: addPointGridY || 0 });
      let basisQuat = (changeAngleGridTarget?.quaternion || AddPointGuideGrid?.quaternion || null);
      let basisPlaneRef = changeAngleGridTarget || AddPointGuideGrid || null;
      if (guideAddGridPicks.length > 0) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(guideAddGridPicks, true);
        const hit = hits[0] || null;
        const hitGrid = hit?.object?.userData?.guideAddGrid || null;
        if (hit?.point) {
          basePoint = hit.point.clone();
        }
        if (hitGrid?.quaternion) {
          basisQuat = hitGrid.quaternion;
          basisPlaneRef = hitGrid;
        }
      }
      const curve = buildGuideCurve(guidePlacementTemplate, basePoint, basisQuat);
      const name = `GuideRail_${Date.now()}`;
      const line = TSys.createTrack(curve, 0, 0x00ff00, name);
      if (line) {
        line.userData = { ...(line.userData || {}), guideCurve: curve };
        curve.userData = { ...(curve.userData || {}), guideLine: line };
      }
      createGuideRailPickMesh(curve);
      if (editObject === 'STEEL_FRAME' && curve?.userData?.controlPoints) {
        curve.userData.controlPoints.forEach((p, idx) => {
          const mesh = steelFrameMode.addPoint(p);
          if (mesh) {
            mesh.userData = {
              ...(mesh.userData || {}),
              guideCurve: curve,
              guideControlIndex: idx,
              planeRef: basisPlaneRef || null,
            };
          }
        });
      }
      if (editObject === 'STEEL_FRAME') {
        targetObjects = steelFrameMode.getCurrentPointMeshes().concat(guideRailPickMeshes);
        setMeshListOpacity(targetObjects, 1);
      }
      return;
    }

    if (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'add') {
      let faceHit = differenceHoveredFaceHit;
      if (!faceHit?.object?.userData?.differenceSpacePlane || !faceHit?.face) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(differenceSpacePlanes.filter((m) => m?.parent), true);
        faceHit = hits.find((h) => h?.object?.userData?.differenceSpacePlane && h?.face) || null;
      }
      if (faceHit?.object?.userData?.differenceSpacePlane && faceHit?.face) {
        const extrudeResult = extrudeDifferenceFaceToNewSpace(faceHit, 1);
        const expanded = extrudeResult?.mesh || null;
        if (expanded) {
          pointRotateTarget = expanded;
          pointRotateCenter.copy(expanded.position);
          pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(expanded));
          pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
          updatePointRotateVisuals();
          targetObjects = differenceSpacePlanes.filter((m) => m?.parent);
          setMeshListOpacity(targetObjects, 1);
          updateDifferenceStatus('面を押し出して空間を拡張しました。');
          differenceHoveredFaceHit = null;
          refreshDifferencePreview();
          return;
        }
        updateDifferenceStatus(formatDifferenceExtrudeFailureMessage(extrudeResult, faceHit));
        return;
      }
    }

    let gridHitPoint = null;
    let gridHitRef = null;
    if (editObject === 'STEEL_FRAME' && guideAddGridPicks.length > 0) {
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(guideAddGridPicks, true);
      const hit = hits[0] || null;
      console.log('[grid-hit] count:', hits.length);
      if (hit?.point) {
        gridHitPoint = hit.point.clone();
        const hitGrid = hit.object?.userData?.guideAddGrid || null;
        gridHitRef = hitGrid || null;
        guideAddGrids.forEach((grid) => {
          setGuideAddGridColor(grid, grid === hitGrid ? GUIDE_ADD_GRID_SELECTED_COLOR : GUIDE_ADD_GRID_COLOR);
        });
        console.log('[grid-hit] true');
      } else {
        console.log('[grid-hit] false');
        guideAddGrids.forEach((grid) => {
          setGuideAddGridColor(grid, GUIDE_ADD_GRID_COLOR);
        });
      }
    } else if (editObject === 'STEEL_FRAME') {
      console.log('[grid-hit] no picks');
      guideAddGrids.forEach((grid) => {
        setGuideAddGridColor(grid, GUIDE_ADD_GRID_COLOR);
      });
    }

    let guideSnapPoint = null;
    if (editObject === 'STEEL_FRAME') {
      const intersects = getIntersectObjects();
      const guideHit = intersects.find(hit => hit?.object?.userData?.isGuideRail);
      if (guideHit?.object?.userData?.guideCurve && guideHit.point) {
        const nearest = getNearestPointOnCurve(guideHit.object.userData.guideCurve, guideHit.point);
        if (nearest) {
          guideSnapPoint = nearest.clone();
        }
      }
    }

    let point = (editObject === 'STEEL_FRAME')
      ? coord_DisplayTo3D({ y: addPointGridY })
      : coord_DisplayTo3D({ y: addPointGridY });
    if (gridHitPoint) {
      point = gridHitPoint;
    }
    if (guideSnapPoint) {
      point = guideSnapPoint;
    }
    const cube_clone = new THREE.Mesh(cube_geometry, cube_material.clone());
    if (editObject === 'RAIL' || editObject === 'CUSTOM'){

      cube_clone.position.set(point.x, point.y, point.z);
      // cube_clone.position.set(5.1567957781852725, 5.786358250355474, 37.50032584968354);
      scene.add(cube_clone);
      targetObjects.push(cube_clone);
    } else if (editObject === 'STEEL_FRAME') {
      const mesh = steelFrameMode.addPoint(point);
      if (mesh && gridHitRef) {
        mesh.userData = { ...(mesh.userData || {}), planeRef: gridHitRef };
      }
      targetObjects = steelFrameMode.getCurrentPointMeshes().concat(guideRailPickMeshes);
    } else if (editObject === 'DIFFERENCE_SPACE') {
      const plane = createDifferenceSpacePlane(point);
      addDifferenceControlPoints(plane);
      selectDifferencePlane(plane);
      targetObjects = differenceSpacePlanes.filter((m) => m?.parent);
      setMeshListOpacity(targetObjects, 1);
      refreshDifferencePreview();

    } else if (editObject === 'ORIGINAL'){
      
      if (group_EditNow != 'None'){
        group_targetObjects[group_EditNow][0].visible = false;
        group_targetObjects[group_EditNow][1].visible = false;
      }

      group_EditNow = group_object.length
      group_object.push([])
      group_targetObjects.push([false,false])
      targetObjects = []

      // 1つずつ複製して位置を指定する
      const c1 = new THREE.Mesh(cube_geometry, cube_material.clone());
      c1.position.set(point.x, point.y, point.z);
      scene.add(c1);
      targetObjects.push(c1);
      group_targetObjects[group_EditNow][0] = c1

      const c2 = new THREE.Mesh(cube_geometry, cube_material.clone())
      c2.position.set(point.x, point.y + 3, point.z); // 元の cube_clone を変更しない
      scene.add(c2);
      targetObjects.push(c2);
      group_targetObjects[group_EditNow][1] = c2

      console.log(targetObjects)
    }

    drawingObject();
    return;

  }

  // 通常のオブジェクト選択・移動モード
  if (objectEditMode === 'MOVE_EXISTING' || objectEditMode === 'PICK' || objectEditMode === 'CONSTRUCT' || objectEditMode === EDIT_RAIL){

    console.log('selecting object...')
    moveClickPending = true;

    if (objectEditMode === 'MOVE_EXISTING') {
      search_object = false
      console.log('start search_point')
    }
    // await sleep(100);

    // if (editObject === 'RAIL' && (objectEditMode === 'MOVE_EXISTING' || objectEditMode === EDIT_RAIL)) {
    //   refreshRailSelectionTargets();
    //   setMeshListOpacity(targetObjects, 1);
    // }

    // if (editObject === 'RAIL' && (objectEditMode === 'MOVE_EXISTING' || objectEditMode === EDIT_RAIL)) {
    //   refreshRailSelectionTargets();
    //   setMeshListOpacity(targetObjects, 1);
    //   console.log('selecting object...')
    // }

    const answer = await onerun_search_point();
    if (answer === false){
      return;
    }

    if (editObject === 'RAIL' && choice_object && choice_object.userData) {
      const { trackName, pointIndex } = choice_object.userData;
      if (trackName != null && pointIndex != null) {
        selectedRailPoint = { trackName, pointIndex };
        drawRailSelectionLine(trackName, pointIndex);
      }
    }

    const beginDragFromChoice = () => {
      if (!choice_object) { 
        console.log('no choice_object')
        return;
       }
      const pos = camera.position;
      if (!move_direction_y){
        let set_y = choice_object.position.y;

        raycaster.setFromCamera(mouse, camera);
        const dir = raycaster.ray.direction;

        const t = Math.abs((pos.y - set_y)/dir.y);

        // 交点を計算
        TargetDiff = [
          choice_object.position.x - (pos.x + dir.x * t),
          choice_object.position.z - (pos.z + dir.z * t)
        ];
      } else {
        raycaster.setFromCamera(mouse, camera);
        const dir = raycaster.ray.direction;

        const mouAngleY = cameraAngleY - Math.atan2(dir.x,dir.z); // マウスを3d世界の座標のベクトルに変換
        const diff = {x: choice_object.position.x - pos.x, z: choice_object.position.z - pos.z}
        const hypotenuse = Math.cos(Math.atan2(diff.x, diff.z) - cameraAngleY) * Math.sqrt(diff.x**2 + diff.z**2)

        const t = hypotenuse/(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x);

        // 交点を計算
        TargetDiff = choice_object.position.y - (pos.y + dir.y * t); 
      }

      choice_object.material.color.set(0x0000ff)

      dragging = true;
      efficacy = false;

      GuideLine.visible = true
      if (!move_direction_y){
        // visibility controlled by UIevent
      }
    };

    if (editObject === 'RAIL' && objectEditMode !== 'MOVE_EXISTING') {
      beginDragFromChoice();
      return;
    }

    if (objectEditMode === 'MOVE_EXISTING'){
      if (editObject === 'STEEL_FRAME') {
        // move_point: クリック or ドラッグで複数移動
        moveClickPending = true;
        shouldToggle = true;
        moveDownPos = lastPointerClient ? { ...lastPointerClient } : null;
        if (choice_object?.position) {
          movePlaneAnchor.copy(choice_object.position);
          updateMovePlaneNormal();
        }
        updateMovePlaneGizmo();
        moveDragStartPositions = [];
        moveDragAnchorStart = null;
        await onerun_search_point();
        return;
      }

      beginDragFromChoice();
    
    } else if (objectEditMode === 'CONSTRUCT'){
      if (editObject === 'STEEL_FRAME') {
        steelFrameMode.toggleSelectedPoint(choice_object);
        if (differenceSpaceModeActive) {
          refreshDifferencePreview();
        }
        return;
      }
      if (editObject === 'DIFFERENCE_SPACE') {
        selectDifferencePlane(choice_object);
        if (pointRotateModeActive) {
          pointRotateTarget = choice_object;
          pointRotateCenter.copy(choice_object.position);
          pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(choice_object));
          pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
          updatePointRotateVisuals();
          showPointRotationGuideLine(choice_object);
        }
        refreshDifferencePreview();
        return;
      }
      if (pick_vertexs.includes(choice_object.id)){
        setColorsByIds(scene, pick_vertexs, '#ff0000');
        pick_vertexs = []
      } else {
        pick_vertexs.push(choice_object.id)
        if (pick_vertexs.length === 3) {
          console.log('push_three')
          setColorsByIds(scene, pick_vertexs, '#ff0000');

          const vertex0 = getObjectById(scene, pick_vertexs[0]).position
          const vertex1 = getObjectById(scene, pick_vertexs[1]).position
          const vertex2 = getObjectById(scene, pick_vertexs[2]).position
          const vertex = [[vertex0.x,vertex0.y,vertex0.z],[vertex1.x,vertex1.y,vertex1.z],[vertex2.x,vertex2.y,vertex2.z]]

          console.log(tiles)
          console.log(vertex)

          const res = findTargetsByTriangles(tiles, vertex);
          console.log(res) 

          if (res === null) {
              tiles.push(vertex0.x,vertex0.y,vertex0.z,vertex1.x,vertex1.y,vertex1.z,vertex2.x,vertex2.y,vertex2.z)
              console.log('push')
            }

          pick_vertexs = []
        }
      }
    }

  }
}

// モード状態（例）
let OperationMode = 0;

let polePlacementMode = false;
let editObject = 'Standby'
// let trackEditSubMode = 'CREATE_NEW'; // 'CREATE_NEW' or 'MOVE_EXISTING'
let objectEditMode = 'Standby'; // 'CREATE_NEW' or 'MOVE_EXISTING'
const EDIT_RAIL = 'EDIT_RAIL';
const ROTATE_MODE = 'ROTATE';
const SEARCH_MODE = 'SEARCH';
let pointRotateModeActive = false;
let angleSearchModeActive = false;

let rotateGizmoGroup = null;
const rotateGizmoMeshes = [];
let rotateDragging = false;
let rotateAxis = new THREE.Vector3(0, 1, 0);
let rotateCenter = new THREE.Vector3();
let rotateStartVector = new THREE.Vector3();
let rotateStartPositions = [];
const rotatePlane = new THREE.Plane();
let rotatePanelState = {
  idsKey: '',
  angles: { x: 0, y: 0, z: 0 },
};
const rotationInfoVisuals = [];
let pointRotateGizmoGroup = null;
const pointRotateGizmoMeshes = [];
let pointRotateArrow = null;
let pointRotateTarget = null;
let pointRotateCenter = new THREE.Vector3();
let pointRotateDirection = new THREE.Vector3(0, 0, 1);
let pointRotateDragging = false;
let pointRotateMoveDragging = false;
let pointRotateAxis = new THREE.Vector3(0, 1, 0);
const pointRotatePlane = new THREE.Plane();
let pointRotateStartVector = new THREE.Vector3();
let pointRotateAxisLocal = null;
let pointRotateBasisQuat = new THREE.Quaternion();
let pointRotateBasisQuatStart = new THREE.Quaternion();
let pointRotateGizmoQuat = new THREE.Quaternion();
let pointRotateGizmoYaw = 0;
let pointRotateGizmoYawStart = 0;
let pointRotateMoveStartT = 0;
let pointRotateMoveStartCenter = new THREE.Vector3();
let pointRotatePanelAnglesStart = { x: 0, y: 0, z: 0 };

function ensurePointRotateGizmo() {
  if (pointRotateGizmoGroup) { return; }
  pointRotateGizmoGroup = new THREE.Group();
  pointRotateGizmoGroup.name = 'PointRotateGizmo';
  const ringRadius = 1.0;
  const ringTube = 0.03;
  const geom = new THREE.TorusGeometry(ringRadius, ringTube, 12, 64);
  const makeRing = (color, axis, euler) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.set(euler.x, euler.y, euler.z);
    mesh.userData = { ...(mesh.userData || {}), isPointRotateGizmo: true, axis };
    pointRotateGizmoGroup.add(mesh);
    pointRotateGizmoMeshes.push(mesh);
  };
  // 横方向（yaw: Y軸）
  makeRing(0x5cff88, new THREE.Vector3(0, 1, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  // 縦方向（pitch: X軸）
  makeRing(0xe63946, new THREE.Vector3(1, 0, 0), new THREE.Euler(0, Math.PI / 2, 0));
  pointRotateGizmoGroup.visible = false;
  scene.add(pointRotateGizmoGroup);
}

function ensurePointRotateArrow() {
  if (pointRotateArrow) { return; }
  pointRotateArrow = new THREE.ArrowHelper(pointRotateDirection.clone().normalize(), pointRotateCenter.clone(), 2, 0xf4c430, 0.45, 0.25);
  pointRotateArrow.name = 'PointRotateArrow';
  pointRotateArrow.visible = false;
  scene.add(pointRotateArrow);
}

function syncPointRotatePanelFromTarget() {
  if (!pointRotateTarget) { return; }
  const state = pointRotateTarget.userData?.pointRotatePanelAngles || { x: 0, y: 0, z: 0 };
  if (rotationInputX) {
    rotationInputX.value = String(Number(state.x ?? 0).toFixed(1));
    rotationInputX.placeholder = String(state.x ?? 0);
  }
  if (rotationInputY) {
    rotationInputY.value = String(Number(state.y ?? 0).toFixed(1));
    rotationInputY.placeholder = String(state.y ?? 0);
  }
  if (rotationInputZ) {
    rotationInputZ.value = String(Number(state.z ?? 0).toFixed(1));
    rotationInputZ.placeholder = String(state.z ?? 0);
  }
}

function updatePointRotatePanelAnglesFromDirection(direction, { apply = false } = {}) {
  if (!pointRotateTarget || !direction) { return; }
  const dir = direction.clone().normalize();
  if (dir.lengthSq() < 1e-8) { return; }
  const state = pointRotateTarget.userData?.pointRotatePanelAngles || { x: 0, y: 0, z: 0 };
  const pitchDeg = Math.atan2(dir.y, Math.sqrt((dir.x * dir.x) + (dir.z * dir.z))) * 180 / Math.PI;
  const yawDeg = Math.atan2(dir.x, dir.z) * 180 / Math.PI;
  const next = { x: pitchDeg, y: yawDeg, z: Number(state.z) || 0 };
  pointRotateTarget.userData = {
    ...(pointRotateTarget.userData || {}),
    pointRotatePanelAngles: next,
  };
  if (rotationInputX) {
    rotationInputX.value = String(Number(next.x).toFixed(1));
    rotationInputX.placeholder = String(Number(next.x).toFixed(1));
  }
  if (rotationInputY) {
    rotationInputY.value = String(Number(next.y).toFixed(1));
    rotationInputY.placeholder = String(Number(next.y).toFixed(1));
  }
  if (apply) {
    applyRotationFromPanel();
  }
}

function loadPointRotateBasisFromTarget(target) {
  const q = new THREE.Quaternion();
  const savedQuat = target?.userData?.pointRotateBasisQuat;

  // Backward-compatible restore:
  // accept [x,y,z,w], Float32Array, THREE.Quaternion, or {x,y,z,w}.
  let restored = false;
  if (Array.isArray(savedQuat) && savedQuat.length === 4) {
    const arr = savedQuat.map((v) => Number(v));
    if (arr.every((v) => Number.isFinite(v))) {
      q.fromArray(arr).normalize();
      restored = true;
    }
  } else if (savedQuat && typeof savedQuat === 'object' && 'length' in savedQuat && savedQuat.length === 4) {
    const arr = Array.from(savedQuat);
    if (arr.every((v) => Number.isFinite(v))) {
      q.fromArray(arr).normalize();
      restored = true;
    }
  } else if (savedQuat?.isQuaternion) {
    q.copy(savedQuat).normalize();
    restored = true;
  } else if (savedQuat && typeof savedQuat === 'object') {
    const x = Number(savedQuat.x);
    const y = Number(savedQuat.y);
    const z = Number(savedQuat.z);
    const w = Number(savedQuat.w);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(w)) {
      q.set(x, y, z, w).normalize();
      restored = true;
    }
  }
  if (restored) {
    target.userData = {
      ...(target.userData || {}),
      pointRotateBasisQuat: q.toArray(),
    };
    return q;
  }
  // 回転方式と揃えるため、復元は basisQuat のみを正として扱う。
  // 未保存データは identity で初期化して保存する。
  q.identity();
  target.userData = {
    ...(target.userData || {}),
    pointRotateBasisQuat: q.toArray(),
    pointRotateDirection: new THREE.Vector3(0, 0, 1),
  };
  return q;
}

function updatePointRotateVisuals() {
  ensurePointRotateGizmo();
  ensurePointRotateArrow();
  const active = pointRotateModeActive && Boolean(pointRotateTarget);
  pointRotateGizmoGroup.visible = active;
  pointRotateArrow.visible = active;
  if (!active) { return; }
  pointRotateGizmoGroup.position.copy(pointRotateCenter);
  pointRotateGizmoGroup.quaternion.copy(pointRotateGizmoQuat);
  pointRotateGizmoGroup.scale.setScalar(1.2);
  pointRotateArrow.position.copy(pointRotateCenter);
  pointRotateArrow.setDirection(pointRotateDirection.clone().normalize());
  pointRotateArrow.setLength(2, 0.45, 0.25);
}

function getYawOnlyQuatFromDirection(direction) {
  const flat = direction.clone();
  flat.y = 0;
  if (flat.lengthSq() < 1e-8) {
    return new THREE.Quaternion();
  }
  flat.normalize();
  const yaw = Math.atan2(flat.x, flat.z);
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

function getWorldFaceNormalFromHit(hit) {
  const localNormal = hit?.face?.normal?.clone?.();
  if (!localNormal || !hit?.object) { return null; }
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  const worldNormal = localNormal.applyMatrix3(normalMatrix).normalize();
  if (worldNormal.lengthSq() < 1e-8) { return null; }
  return worldNormal;
}

function getLocalFaceNormalFromHit(hit) {
  const localNormal = hit?.face?.normal?.clone?.();
  if (!localNormal) { return null; }
  if (localNormal.lengthSq() < 1e-8) { return null; }
  return localNormal.normalize();
}

function buildBasisQuatFromDirection(direction) {
  const zAxis = direction.clone().normalize();
  if (zAxis.lengthSq() < 1e-8) {
    return new THREE.Quaternion();
  }
  let up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(zAxis.dot(up)) > 0.98) {
    up = new THREE.Vector3(1, 0, 0);
  }
  const xAxis = new THREE.Vector3().crossVectors(up, zAxis).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  return new THREE.Quaternion().setFromRotationMatrix(m).normalize();
}

function showDifferenceFaceHighlight(hit) {
  const mesh = hit?.object;
  if (!mesh?.isMesh || !mesh?.geometry) { return; }
  const localNormal = getLocalFaceNormalFromHit(hit);
  if (!localNormal) { return; }
  clearDifferenceFaceHighlight(false);
  const plane = createDifferenceFaceHighlightPlane(mesh, localNormal, 0xffd64d, 0.55, 2500);
  if (!plane) { return; }
  scene.add(plane);
  differenceFaceHighlight = plane;
  highlightDifferenceFaceControlPoints(mesh, localNormal);
}

function beginDifferenceFaceVertexDrag(hit, selectedFaces = null) {
  const mesh = hit?.object;
  const localNormal = getLocalFaceNormalFromHit(hit);
  const worldNormal = getWorldFaceNormalFromHit(hit);
  if (!mesh?.userData?.differenceSpacePlane || !localNormal || !worldNormal) { return false; }
  const axis = Math.abs(localNormal.x) > 0.9
    ? 'x'
    : (Math.abs(localNormal.y) > 0.9 ? 'y' : 'z');
  const axisDir = worldNormal.clone().normalize();
  differenceFaceVertexDragActive = true;
  differenceFaceVertexDragMesh = mesh;
  differenceFaceVertexDragLocalNormal = localNormal.clone();
  differenceFaceVertexDragAxis = axis;
  const primaryOrigin = hit?.point?.clone?.() || mesh.position.clone();
  differenceFaceVertexDragStartPos.copy(primaryOrigin);
  differenceFaceVertexDragStartT = getAxisParamFromPointer(primaryOrigin, axisDir);
  differenceFaceVertexDragStartLen = 0;
  const faces = Array.isArray(selectedFaces) && selectedFaces.length > 0
    ? selectedFaces
    : [{ mesh, localNormal: localNormal.clone(), facePointLocal: hit?.point?.clone?.().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert()) }];
  differenceFaceVertexDragMesh = faces.map((entry) => {
    const n = entry?.localNormal?.clone?.();
    const m = entry?.mesh;
    if (!m?.userData?.differenceSpacePlane || !n) { return null; }
    const localHit = entry?.facePointLocal?.clone?.() || null;
    let facePoints = getDifferenceFaceControlPoints(m, n, localHit);
    if (!Array.isArray(facePoints) || facePoints.length < 3) {
      facePoints = getDifferenceFaceControlPoints(m, n, null);
    }
    if (!Array.isArray(facePoints) || facePoints.length < 3) { return null; }
    const wd = n.clone().applyQuaternion(m.quaternion).normalize();
    const faceOrigin = new THREE.Vector3();
    const points = facePoints.map((p) => {
      const startPos = p.position.clone();
      const world = p.getWorldPosition(new THREE.Vector3());
      faceOrigin.add(world);
      return { point: p, startPos };
    });
    faceOrigin.multiplyScalar(1 / points.length);
    return {
      mesh: m,
      localNormal: n,
      axisDir: wd,
      faceOrigin,
      points,
    };
  }).filter(Boolean);
  if (differenceFaceVertexDragMesh.length < 1) {
    differenceFaceVertexDragActive = false;
    return false;
  }
  showDifferenceFaceHighlight(hit);
  return true;
}

function beginDifferenceControlPointDrag(point, selectedPoints = null) {
  const mesh = point?.userData?.parentDifferenceSpacePlane || point?.parent || null;
  if (!point?.userData?.differenceControlPoint || !mesh?.userData?.differenceSpacePlane) { return false; }
  const gizmoAxisWorld = pointRotateDirection?.clone?.().normalize?.() || new THREE.Vector3();
  const fallbackAxisWorld = point.position.clone().applyQuaternion(mesh.quaternion).normalize();
  const axisWorld = gizmoAxisWorld.lengthSq() > 1e-8 ? gizmoAxisWorld : fallbackAxisWorld;
  if (axisWorld.lengthSq() < 1e-8) { return false; }
  point.getWorldPosition(differenceControlPointDragStartWorldPos);
  differenceControlPointDragActive = true;
  differenceControlPointDragPoint = point;
  differenceControlPointDragMesh = mesh;
  differenceControlPointDragAxisWorld.copy(axisWorld);
  differenceControlPointDragStartLocalPos.copy(point.position);
  differenceControlPointDragStartT = getAxisParamFromPointer(differenceControlPointDragStartWorldPos, axisWorld);
  const points = Array.isArray(selectedPoints) && selectedPoints.length > 0
    ? selectedPoints
    : [point];
  differenceControlPointDragPoint = points.map((p) => {
    const m = p?.userData?.parentDifferenceSpacePlane || p?.parent || null;
    if (!p?.userData?.differenceControlPoint || !m?.userData?.differenceSpacePlane) { return null; }
    return {
      point: p,
      mesh: m,
      axisWorld: axisWorld.clone(),
      startLocalPos: p.position.clone(),
      startWorldPos: p.getWorldPosition(new THREE.Vector3()),
    };
  }).filter(Boolean);
  if (differenceControlPointDragPoint.length < 1) {
    differenceControlPointDragActive = false;
    return false;
  }
  if (!isDifferenceControlPointSelected(point)) {
    differenceSelectedControlPoints.add(point);
    setDifferenceControlPointVisual(point, 0x7be6ff);
  }
  clearDifferenceFaceHighlight();
  return true;
}

function updateDifferenceControlPointDrag() {
  if (!differenceControlPointDragActive || !Array.isArray(differenceControlPointDragPoint) || differenceControlPointDragPoint.length < 1) { return; }
  const mesh = differenceControlPointDragMesh;
  const axisWorld = differenceControlPointDragAxisWorld.clone().normalize();
  if (axisWorld.lengthSq() < 1e-8) { return; }
  const nowT = getAxisParamFromPointer(differenceControlPointDragStartWorldPos, axisWorld);
  const deltaWorld = nowT - differenceControlPointDragStartT;
  const dirtyMeshes = new Set();
  differenceControlPointDragPoint.forEach((entry) => {
    const m = entry.mesh;
    const worldToLocalQuat = m.quaternion.clone().invert();
    const localAxis = entry.axisWorld.clone().applyQuaternion(worldToLocalQuat).normalize();
    if (localAxis.lengthSq() < 1e-8) { return; }
    const next = entry.startLocalPos.clone().add(localAxis.multiplyScalar(deltaWorld));
    next.x = THREE.MathUtils.clamp(next.x, -3, 3);
    next.y = THREE.MathUtils.clamp(next.y, -3, 3);
    next.z = THREE.MathUtils.clamp(next.z, -3, 3);
    entry.point.position.copy(next);
    dirtyMeshes.add(m);
  });
  propagateDifferenceSharedPoints(
    differenceControlPointDragPoint.map((entry) => entry.point),
    dirtyMeshes,
  );
  dirtyMeshes.forEach((m) => syncDifferenceGeometryFromControlPoints(m));
  refreshDifferencePreview();
}

function updateDifferenceFaceVertexDrag() {
  if (!differenceFaceVertexDragActive || !Array.isArray(differenceFaceVertexDragMesh) || differenceFaceVertexDragMesh.length < 1) { return; }
  const primary = differenceFaceVertexDragMesh[0];
  const mesh = primary.mesh;
  const localNormal = primary.localNormal;
  const axisDir = primary.axisDir.clone();
  if (axisDir.lengthSq() < 1e-8) { return; }
  const nowT = getAxisParamFromPointer(differenceFaceVertexDragStartPos, axisDir);
  const delta = nowT - differenceFaceVertexDragStartT;
  const dirtyMeshes = new Set();
  const movedPoints = [];
  differenceFaceVertexDragMesh.forEach((entry) => {
    const worldToLocalQuat = entry.mesh.quaternion.clone().invert();
    const localAxis = entry.axisDir.clone().applyQuaternion(worldToLocalQuat).normalize();
    if (localAxis.lengthSq() < 1e-8) { return; }
    entry.points.forEach((p) => {
      const next = p.startPos.clone().add(localAxis.clone().multiplyScalar(delta));
      p.point.position.copy(next);
      movedPoints.push(p.point);
    });
    if (pointRotateTarget === entry.mesh) {
      pointRotateCenter.copy(entry.faceOrigin.clone().add(entry.axisDir.clone().multiplyScalar(delta)));
    }
    dirtyMeshes.add(entry.mesh);
  });
  propagateDifferenceSharedPoints(movedPoints, dirtyMeshes);
  dirtyMeshes.forEach((m) => {
    syncDifferenceGeometryFromControlPoints(m);
    updateDifferenceControlPointMarkerTransform(m);
  });
  refreshDifferenceSelectedFaceHighlights();
  refreshDifferencePreview();
  showDifferenceFaceHighlight({
    object: mesh,
    face: { normal: localNormal.clone() },
  });
}

function beginPointRotateDrag(axisMesh) {
  pointRotateAxisLocal = axisMesh?.userData?.axis?.clone?.().normalize?.() || new THREE.Vector3(0, 1, 0);
  if (pointRotateAxisLocal.y === 1) {
    pointRotateAxis.copy(new THREE.Vector3(0, 1, 0));
  } else {
    pointRotateAxis.copy(pointRotateAxisLocal.clone().applyQuaternion(pointRotateBasisQuat).normalize());
  }
  pointRotatePlane.setFromNormalAndCoplanarPoint(pointRotateAxis, pointRotateCenter);
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(pointRotatePlane, hit);
  if (!ok) { return; }
  pointRotateStartVector.copy(hit).sub(pointRotateCenter).normalize();
  pointRotateBasisQuatStart.copy(pointRotateBasisQuat);
  pointRotatePanelAnglesStart = pointRotateTarget?.userData?.pointRotatePanelAngles
    ? { ...pointRotateTarget.userData.pointRotatePanelAngles }
    : { x: 0, y: 0, z: 0 };
  if (pointRotateAxisLocal && pointRotateAxisLocal.y === 1) {
    pointRotateGizmoYawStart = pointRotateGizmoYaw;
  }
  pointRotateDragging = true;
  efficacy = false;
}

function getAxisParamFromPointer(axisOrigin, axisDir) {
  raycaster.setFromCamera(mouse, camera);
  const rayOrigin = raycaster.ray.origin;
  const rayDir = raycaster.ray.direction.clone().normalize();
  const u = axisDir.clone().normalize();
  const w0 = axisOrigin.clone().sub(rayOrigin);
  const a = u.dot(u);
  const b = u.dot(rayDir);
  const c = rayDir.dot(rayDir);
  const d = u.dot(w0);
  const e = rayDir.dot(w0);
  const denom = (a * c) - (b * b);
  if (Math.abs(denom) < 1e-6) {
    return d;
  }
  return ((b * e) - (c * d)) / denom;
}

function beginPointRotateMoveDrag() {
  if (!pointRotateTarget) { return; }
  const axisDir = pointRotateDirection.clone().normalize();
  if (axisDir.lengthSq() < 1e-8) { return; }
  pointRotateMoveStartCenter.copy(pointRotateCenter);
  pointRotateMoveStartT = getAxisParamFromPointer(pointRotateCenter, axisDir);
  pointRotateMoveDragging = true;
  efficacy = false;
}

function updatePointRotateDrag() {
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(pointRotatePlane, hit);
  if (!ok) { return; }
  const current = hit.clone().sub(pointRotateCenter).normalize();
  const cross = new THREE.Vector3().crossVectors(pointRotateStartVector, current);
  const dot = pointRotateStartVector.dot(current);
  const angle = Math.atan2(cross.dot(pointRotateAxis), dot);
  const angleDeg = angle * (180 / Math.PI);
  const deltaQuat = new THREE.Quaternion().setFromAxisAngle(pointRotateAxis, angle);
  pointRotateBasisQuat.copy(deltaQuat.multiply(pointRotateBasisQuatStart)).normalize();
  pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
  if (pointRotateAxisLocal && pointRotateAxisLocal.y === 1) {
    pointRotateGizmoYaw = pointRotateGizmoYawStart + angle;
    pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
  }
  if (pointRotateTarget) {
    const panelAngles = { ...pointRotatePanelAnglesStart };
    if (pointRotateAxisLocal?.x === 1) {
      panelAngles.x = pointRotatePanelAnglesStart.x + angleDeg;
    } else if (pointRotateAxisLocal?.y === 1) {
      panelAngles.y = pointRotatePanelAnglesStart.y + angleDeg;
    } else if (pointRotateAxisLocal?.z === 1) {
      panelAngles.z = pointRotatePanelAnglesStart.z + angleDeg;
    }

    pointRotateTarget.userData = {
      ...(pointRotateTarget.userData || {}),
      pointRotateDirection: pointRotateDirection.clone(),
      pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
      pointRotatePanelAngles: panelAngles,
    };
    if (rotationInputX) { rotationInputX.value = String(panelAngles.x.toFixed(1)); }
    if (rotationInputY) { rotationInputY.value = String(panelAngles.y.toFixed(1)); }
    if (rotationInputZ) { rotationInputZ.value = String(panelAngles.z.toFixed(1)); }
    showPointRotationGuideLine(pointRotateTarget);
    if (pointRotateTarget?.userData?.differenceSpacePlane) {
      refreshDifferencePreview();
    }
  }
  updatePointRotateVisuals();
}

function updatePointRotateMoveDrag() {
  if (!pointRotateTarget) { return; }
  const axisDir = pointRotateDirection.clone().normalize();
  if (axisDir.lengthSq() < 1e-8) { return; }
  const nowT = getAxisParamFromPointer(pointRotateMoveStartCenter, axisDir);
  const delta = nowT - pointRotateMoveStartT;
  const nextCenter = pointRotateMoveStartCenter.clone().add(axisDir.multiplyScalar(delta));
  pointRotateCenter.copy(nextCenter);
  pointRotateTarget.position.copy(nextCenter);
  pointRotateTarget.userData = {
    ...(pointRotateTarget.userData || {}),
    pointRotateDirection: pointRotateDirection.clone(),
    pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
  };
  showPointRotationGuideLine(pointRotateTarget);
  if (pointRotateTarget?.userData?.differenceSpacePlane) {
    refreshDifferencePreview();
  }
  updatePointRotateVisuals();
}

function clearPointRotateState() {
  pointRotateDragging = false;
  pointRotateMoveDragging = false;
  clearDifferenceMovePending();
  differenceControlPointDragActive = false;
  differenceControlPointDragPoint = null;
  differenceControlPointDragMesh = null;
  differenceControlPointDragAxisWorld.set(0, 0, 0);
  differenceFaceVertexDragActive = false;
  differenceFaceVertexDragMesh = null;
  differenceFaceVertexDragLocalNormal = null;
  dragging = false;
  moveClickPending = false;
  shouldToggle = false;
  moveDragStartPositions = [];
  moveDragAnchorStart = null;
  pointRotateTarget = null;
  pointRotateAxisLocal = null;
  pointRotateBasisQuat.identity();
  pointRotateBasisQuatStart.identity();
  pointRotateGizmoQuat.identity();
  pointRotateGizmoYaw = 0;
  pointRotateGizmoYawStart = 0;
  if (pointRotateGizmoGroup) {
    pointRotateGizmoGroup.visible = false;
  }
  clearDifferenceFaceHighlight();
  clearDifferenceFaceSelection();
  setDifferenceControlPointSelected(null);
  if (pointRotateArrow) {
    pointRotateArrow.visible = false;
  }
  GuideLine.visible = false;
  GuideLine.quaternion.identity();
}

function clearRotationInfoVisuals() {
  for (let i = rotationInfoVisuals.length - 1; i >= 0; i -= 1) {
    const obj = rotationInfoVisuals[i];
    if (!obj) { continue; }
    if (obj.parent) {
      obj.parent.remove(obj);
    }
    obj.traverse?.((node) => {
      if (node.geometry?.dispose) {
        node.geometry.dispose();
      }
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach((m) => {
            if (m?.map?.dispose) { m.map.dispose(); }
            m?.dispose?.();
          });
        } else if (node.material.dispose) {
          if (node.material.map?.dispose) { node.material.map.dispose(); }
          node.material.dispose();
        }
      }
    });
    rotationInfoVisuals.splice(i, 1);
  }
}

function updateRotationInfoVisuals() {
  clearRotationInfoVisuals();
  if (!angleSearchModeActive) { return; }
  const meshes = getRotateSelectionMeshes();
  if (!Array.isArray(meshes) || meshes.length < 2) { return; }

  const colorLen = 0xf4c430;   // yellow
  const colorEl = 0xe63946;    // red
  const colorZero = 0x6c757d;  // gray (0deg reference)
  const colorDc = 0x17a2b8;    // cyan (vertical component)
  const colorAz = 0x2ecc71;    // green
  const arcSegments = 24;

  const buildArcLine = (center, fromDir, toDir, radius, color) => {
    const a = fromDir.clone().normalize();
    const b = toDir.clone().normalize();
    const axis = new THREE.Vector3().crossVectors(a, b);
    const axisLen = axis.length();
    if (axisLen < 1e-6) { return null; }
    axis.normalize();
    const angle = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
    const points = [];
    for (let i = 0; i <= arcSegments; i += 1) {
      const t = angle * (i / arcSegments);
      const p = a.clone().applyAxisAngle(axis, t).multiplyScalar(radius).add(center);
      points.push(p);
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(geom, mat);
  };
  const buildAzSector = (center, fromDir, toDir, radius, color, opacity = 0.22) => {
    const a = fromDir.clone().normalize();
    const b = toDir.clone().normalize();
    const crossY = a.z * b.x - a.x * b.z;
    let signed = Math.atan2(crossY, a.dot(b));
    if (Math.abs(signed) < 1e-6) { return null; }
    const steps = Math.max(8, Math.floor(arcSegments * 0.75));
    const points = [center.clone()];
    for (let i = 0; i <= steps; i += 1) {
      const t = signed * (i / steps);
      const p = a.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t).multiplyScalar(radius).add(center);
      points.push(p);
    }
    const vertices = [];
    points.forEach((p) => {
      vertices.push(p.x, p.y + 0.03, p.z);
    });
    const indices = [];
    for (let i = 1; i < points.length - 1; i += 1) {
      indices.push(0, i, i + 1);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 999;
    return mesh;
  };
  const buildAngleSector3D = (center, fromDir, toDir, axis, radius, color, opacity = 0.22) => {
    const from = fromDir.clone().normalize();
    const to = toDir.clone().normalize();
    const rotAxis = axis.clone().normalize();
    if (rotAxis.lengthSq() < 1e-6) { return null; }
    const signed = Math.atan2(
      new THREE.Vector3().crossVectors(from, to).dot(rotAxis),
      from.dot(to),
    );
    if (Math.abs(signed) < 1e-6) { return null; }
    const steps = Math.max(8, Math.floor(arcSegments * 0.75));
    const points = [center.clone()];
    for (let i = 0; i <= steps; i += 1) {
      const t = signed * (i / steps);
      const p = from.clone().applyAxisAngle(rotAxis, t).multiplyScalar(radius).add(center);
      points.push(p);
    }
    const vertices = [];
    points.forEach((p) => {
      vertices.push(p.x, p.y, p.z);
    });
    const indices = [];
    for (let i = 1; i < points.length - 1; i += 1) {
      indices.push(0, i, i + 1);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.add(rotAxis.clone().multiplyScalar(0.03));
    mesh.renderOrder = 999;
    return mesh;
  };
  const buildAngleLabelSprite = (text, color = '#e63946') => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) { return null; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 10);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
      ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    }
    ctx.fillStyle = color;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.2, 0.9, 1);
    sprite.renderOrder = 1000;
    return sprite;
  };

  for (let i = 0; i < meshes.length - 1; i += 1) {
    const a = meshes[i]?.position;
    const b = meshes[i + 1]?.position;
    if (!a || !b) { continue; }
    const full = b.clone().sub(a);
    const fullLen = full.length();
    if (fullLen < 1e-6) { continue; }

    const pH = new THREE.Vector3(b.x, a.y, b.z);
    const horizontal = pH.clone().sub(a);
    const hLen = horizontal.length();
    const vertical = b.clone().sub(pH);
    const vLen = vertical.length();

    // 1) full vector (len) - yellow
    const fullArrow = new THREE.ArrowHelper(
      full.clone().normalize(),
      a.clone(),
      fullLen,
      colorLen,
      Math.min(0.9, fullLen * 0.18),
      Math.min(0.45, fullLen * 0.1)
    );
    fullArrow.name = 'RotationInfoLenArrow';
    scene.add(fullArrow);
    rotationInfoVisuals.push(fullArrow);

    // 2) horizontal projection (el baseline) - red
    if (hLen > 1e-6) {
      const hDir = horizontal.clone().normalize();
      const hArrow = new THREE.ArrowHelper(
        hDir,
        a.clone(),
        hLen,
        colorEl,
        Math.min(0.8, hLen * 0.2),
        Math.min(0.4, hLen * 0.12)
      );
      hArrow.name = 'RotationInfoElArrow';
      scene.add(hArrow);
      rotationInfoVisuals.push(hArrow);

      // el: horizontal -> full direction angle sector/arc/label in red
      const fullDir = full.clone().normalize();
      const elAxis = new THREE.Vector3().crossVectors(hDir, fullDir);
      if (elAxis.lengthSq() > 1e-8) {
        const elSector = buildAngleSector3D(a.clone(), hDir, fullDir, elAxis, fullLen, colorEl, 0.35);
        if (elSector) {
          elSector.name = 'RotationInfoElSector';
          scene.add(elSector);
          rotationInfoVisuals.push(elSector);
        }
        const elArcRadius = Math.min(1.2, Math.max(0.45, hLen * 0.22));
        const elArc = buildArcLine(a.clone(), hDir, fullDir, elArcRadius, colorEl);
        if (elArc) {
          elArc.name = 'RotationInfoElArc';
          scene.add(elArc);
          rotationInfoVisuals.push(elArc);
        }
        const elDeg = Math.atan2(vertical.y, hLen) * 180 / Math.PI;
        const signedElRad = Math.atan2(
          new THREE.Vector3().crossVectors(hDir, fullDir).dot(elAxis.clone().normalize()),
          hDir.dot(fullDir),
        );
        const labelRadius = Math.max(0.7, fullLen * 0.45);
        const labelDir = hDir.clone().applyAxisAngle(elAxis.clone().normalize(), signedElRad * 0.5);
        const labelPos = a.clone().add(labelDir.multiplyScalar(labelRadius));
        labelPos.y += 0.22;
        const elLabel = buildAngleLabelSprite(`${Math.abs(elDeg).toFixed(1)}deg`, '#8f1020');
        if (elLabel) {
          elLabel.position.copy(labelPos);
          scene.add(elLabel);
          rotationInfoVisuals.push(elLabel);
        }
      }
    }

    // 3) vertical component (dc) - cyan
    if (vLen > 1e-6) {
      const vArrow = new THREE.ArrowHelper(
        vertical.clone().normalize(),
        pH.clone(),
        vLen,
        colorDc,
        Math.min(0.7, vLen * 0.25),
        Math.min(0.35, vLen * 0.15)
      );
      vArrow.name = 'RotationInfoDcArrow';
      scene.add(vArrow);
      rotationInfoVisuals.push(vArrow);
    }

    // 4) 0 degree reference in XZ plane - green
    if (hLen > 1e-6) {
      const forward = new THREE.Vector3(0, 0, 1);
      const zeroRefLen = fullLen;
      const zeroRefArrow = new THREE.ArrowHelper(
        forward.clone(),
        a.clone(),
        zeroRefLen,
        colorZero,
        Math.min(0.5, zeroRefLen * 0.25),
        Math.min(0.25, zeroRefLen * 0.14)
      );
      zeroRefArrow.name = 'RotationInfoZeroRefArrow';
      scene.add(zeroRefArrow);
      rotationInfoVisuals.push(zeroRefArrow);

      // 5) azimuth arc in XZ plane - red
      const hDir = horizontal.clone().normalize();
      const arcRadius = Math.min(1.2, Math.max(0.45, hLen * 0.22));
      const azSector = buildAzSector(a.clone(), forward, hDir, fullLen, colorAz, 0.5);
      if (azSector) {
        azSector.name = 'RotationInfoAzSector';
        scene.add(azSector);
        rotationInfoVisuals.push(azSector);
      }
      const azArc = buildArcLine(a.clone(), forward, hDir, arcRadius, colorAz);
      if (azArc) {
        azArc.name = 'RotationInfoAzArc';
        scene.add(azArc);
        rotationInfoVisuals.push(azArc);
      }
      const azDeg = Math.atan2(horizontal.x, horizontal.z) * 180 / Math.PI;
      const midAngle = (azDeg * Math.PI / 180) * 0.5;
      const labelRadius = Math.max(0.7, fullLen * 0.5);
      const labelDir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), midAngle);
      const labelPos = a.clone().add(labelDir.multiplyScalar(labelRadius));
      labelPos.y += 0.22;
      const label = buildAngleLabelSprite(`${Math.abs(azDeg).toFixed(1)}deg`, '#0f6b35');
      if (label) {
        label.position.copy(labelPos);
        scene.add(label);
        rotationInfoVisuals.push(label);
      }
    }
  }
}

function ensureRotateGizmo() {
  if (rotateGizmoGroup) { return; }
  rotateGizmoGroup = new THREE.Group();
  rotateGizmoGroup.name = 'RotateGizmo';

  const ringRadius = 1;
  const ringTube = 0.03;
  const geom = new THREE.TorusGeometry(ringRadius, ringTube, 12, 64);

  const makeRing = (color, axis) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { ...(mesh.userData || {}), isRotateGizmo: true, axis };
    rotateGizmoGroup.add(mesh);
    rotateGizmoMeshes.push(mesh);
    return mesh;
  };

  const ringX = makeRing(0xff5c5c, new THREE.Vector3(1, 0, 0));
  ringX.rotation.y = Math.PI / 2;
  const ringY = makeRing(0x5cff88, new THREE.Vector3(0, 1, 0));
  ringY.rotation.x = Math.PI / 2;
  const ringZ = makeRing(0x5cc0ff, new THREE.Vector3(0, 0, 1));

  rotateGizmoGroup.visible = false;
  scene.add(rotateGizmoGroup);
}

function getRotateSelectionMeshes() {
  if (!steelFrameMode?.getSelectedPointMeshes) { return []; }
  return steelFrameMode.getSelectedPointMeshes();
}

function updateRotationSelectionInfo() {
  if (!rotationSelectionInfo) { return; }
  if (!angleSearchModeActive) {
    rotationSelectionInfo.textContent = '選択点: 2点以上で情報を表示';
    clearRotationInfoVisuals();
    return;
  }
  const order = steelFrameMode?.getSelectedPointOrder ? steelFrameMode.getSelectedPointOrder() : [];
  if (!Array.isArray(order) || order.length < 2) {
    rotationSelectionInfo.textContent = '選択点: 2点以上で情報を表示';
    updateRotationInfoVisuals();
    return;
  }
  const lines = [];
  const toNum = (v) => (Number.isFinite(v) ? v : 0);
  const fmt = (v) => toNum(v).toFixed(2);
  lines.push(`選択点: ${order.length}`);
  for (let i = 0; i < order.length - 1; i += 1) {
    const a = order[i];
    const b = order[i + 1];
    const dx = toNum(b.x) - toNum(a.x);
    const dy = toNum(b.y) - toNum(a.y);
    const dz = toNum(b.z) - toNum(a.z);
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const azDeg = Math.atan2(dx, dz) * 180 / Math.PI;
    const elDeg = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) * 180 / Math.PI;
    lines.push(`[${i + 1}] ${a.id} -> ${b.id}`);
    lines.push(`vec: (${fmt(dx)}, ${fmt(dy)}, ${fmt(dz)})`);
    lines.push(`len(yellow): ${fmt(len)}`);
    lines.push(`el(red): ${fmt(elDeg)}deg`);
    lines.push(`az(green): ${fmt(azDeg)}deg`);
    lines.push(`0deg ref(gray): +Z`);
  }
  rotationSelectionInfo.textContent = lines.join('\n');
  updateRotationInfoVisuals();
}

function updateRotateGizmo() {
  ensureRotateGizmo();
  const meshes = getRotateSelectionMeshes();
  if (objectEditMode !== ROTATE_MODE || meshes.length < 2) {
    rotateGizmoGroup.visible = false;
    updateRotationSelectionInfo();
    return;
  }
  const idsKey = meshes.map((m) => m.id).sort((a, b) => a - b).join(',');
  if (rotatePanelState.idsKey !== idsKey) {
    rotatePanelState.idsKey = idsKey;
    const baseCenter = new THREE.Vector3();
    meshes.forEach((m) => baseCenter.add(m.position));
    baseCenter.multiplyScalar(1 / meshes.length);
    rotatePanelState.angles = { x: 0, y: 0, z: 0 };
    if (rotationInputX) rotationInputX.value = '';
    if (rotationInputY) rotationInputY.value = '';
    if (rotationInputZ) rotationInputZ.value = '';
    if (rotationInputX) rotationInputX.placeholder = '0';
    if (rotationInputY) rotationInputY.placeholder = '0';
    if (rotationInputZ) rotationInputZ.placeholder = '0';
  }
  const center = new THREE.Vector3();
  meshes.forEach((m) => center.add(m.position));
  center.multiplyScalar(1 / meshes.length);
  rotateCenter.copy(center);

  let maxDist = 1.2;
  meshes.forEach((m) => {
    const d = m.position.distanceTo(center);
    if (d > maxDist) maxDist = d;
  });
  rotateGizmoGroup.position.copy(center);
  const scale = Math.max(1.2, maxDist * 1.2);
  rotateGizmoGroup.scale.setScalar(scale);
  rotateGizmoGroup.visible = true;
  updateRotationSelectionInfo();
}

function beginRotateDrag(axisMesh) {
  const meshes = getRotateSelectionMeshes();
  if (meshes.length < 2) { return; }
  rotateAxis = axisMesh.userData.axis.clone();
  rotateCenter = rotateGizmoGroup.position.clone();
  rotatePlane.setFromNormalAndCoplanarPoint(rotateAxis, rotateCenter);
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(rotatePlane, hit);
  if (!ok) { return; }
  rotateStartVector.copy(hit).sub(rotateCenter).normalize();
  rotateStartPositions = meshes.map((m) => ({ mesh: m, pos: m.position.clone() }));
  rotateDragging = true;
  efficacy = false;
}

function updateRotateDrag() {
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(rotatePlane, hit);
  if (!ok) { return; }
  const current = hit.clone().sub(rotateCenter).normalize();
  const cross = new THREE.Vector3().crossVectors(rotateStartVector, current);
  const dot = rotateStartVector.dot(current);
  const angle = Math.atan2(cross.dot(rotateAxis), dot);

  rotateStartPositions.forEach(({ mesh, pos }) => {
    const offset = pos.clone().sub(rotateCenter);
    offset.applyAxisAngle(rotateAxis, angle);
    mesh.position.copy(rotateCenter.clone().add(offset));
    if (mesh?.userData?.guideCurve && typeof mesh.userData.guideControlIndex === 'number') {
      const curve = mesh.userData.guideCurve;
      const idx = mesh.userData.guideControlIndex;
      if (curve?.userData?.controlPoints && curve.userData.controlPoints[idx]) {
        curve.userData.controlPoints[idx] = mesh.position.clone();
      }
    }
  });
  // update curves once per drag step
  const curves = new Set();
  rotateStartPositions.forEach(({ mesh }) => {
    if (mesh?.userData?.guideCurve) {
      curves.add(mesh.userData.guideCurve);
    }
  });
  curves.forEach((curve) => updateGuideCurve(curve));
  updateRotationSelectionInfo();
}

// Ensure resize uses unified handler
window.addEventListener('resize', onWindowResize, false);

export function UIevent (uiID, toggle){
  if ( uiID === 'see' ){ if ( toggle === 'active' ){
    console.log( 'see _active' )
    OperationMode = 0
    search_object = false
    choice_object = false
    dragging = false
    efficacy = true
    setMeshListOpacity(targetObjects, 0.0);

  } else {
    console.log( 'see _inactive' )
  }} else if ( uiID === 'edit' ){ if ( toggle === 'active' ){
    console.log( 'edit _active' )
    OperationMode = 1
  } else {
    console.log( 'edit _inactive' )
  }} else if ( uiID === 'rail' ){ if ( toggle === 'active' ){
    console.log( 'rail _active' +'_'+ search_object)
    move_direction_y = false
    editObject = 'RAIL'
    // objectEditMode = EDIT_RAIL;
    removeMeshes(targetObjects);
    clearRailSelectionLine();
    selectedRailPoint = null;
    railModeActive = true;
    toggleRailTube(true);
    refreshRailSelectionTargets();
    setMeshListOpacity(targetObjects, 1);
 
  } else {
    console.log( 'rail _inactive' )
    removeMeshes(targetObjects);
    clearRailSelectionLine();
    selectedRailPoint = null;
    search_object = false
    move_direction_y = false
    editObject = 'Standby'
    if (objectEditMode === EDIT_RAIL) {
      objectEditMode = 'Standby';
    }
    railModeActive = false;
    toggleRailTube(false);

  }} else if ( uiID === 'new' ){ if ( toggle === 'active' ){
    console.log( 'new _active' )
    objectEditMode = 'CREATE_NEW'
    search_object = false

  } else {
    console.log( 'new _inactive' )

  }} else if ( uiID === 'move' ){ if ( toggle === 'active' ){
    console.log( 'move _active' )
    objectEditMode = 'MOVE_EXISTING'
    if (editObject === 'RAIL') {
      refreshRailSelectionTargets();
      setMeshListOpacity(targetObjects, 1);
    }

  } else {
    console.log( 'move _inactive' )
    search_object = false
    move_direction_y = false

    objectEditMode = 'Standby'
    if (editObject === 'RAIL') {
      removeMeshes(targetObjects);
      clearRailSelectionLine();
      selectedRailPoint = null;
    }

  }} else if ( uiID === 'x_z' ){ if ( toggle === 'active' ){
    console.log( 'x_z _active' )
    move_direction_y = false
    if (editObject === 'RAIL') {
      refreshRailSelectionTargets();
      setMeshListOpacity(targetObjects, 1);
    }
    
    search_object = true
    search_point();

  } else {
    console.log( 'x_z _inactive' )
    search_object = false
  }} else if ( uiID === 'y' ){ if ( toggle === 'active' ){
    console.log( 'y _active' )
    move_direction_y = true
    if (editObject === 'RAIL') {
      refreshRailSelectionTargets();
      setMeshListOpacity(targetObjects, 1);
    }
    
    search_object = true
    search_point();
  
  } else {
    console.log( 'y _inactive' )
    search_object = false
  }} else if ( uiID === 'structure' ){ if ( toggle === 'active' ){
    console.log( 'structure _active' )
    structureViewActive = true;
    updateStructurePinnedVisibility();
  } else {
    structureViewActive = false;
    updateStructurePinnedVisibility();
  }} else if ( uiID === 'new/2' ){ if ( toggle === 'active' ){
    console.log( 'new/2 _active' )
    structureModeActive = true;
    structureSamplesDirty = true;
    updateStructureHover();
    updateStructurePinnedVisibility();
  } else {
    console.log( 'new/2 _inactive' )
    structureModeActive = false;
    structureHoverPoint = null;
    structureHoverTrackName = null;
    if (structureHoverPin) {
      structureHoverPin.visible = false;
    }
    updateStructurePinnedVisibility();
  }} else if ( uiID === 'construction' ){ if ( toggle === 'active' ){
  console.log( 'construction _active' )
  constructionModeActive = true;
  updateStructurePinnedVisibility();
  } else {
  console.log( 'construction _inactive' )
  constructionModeActive = false;
  clearConstructionSelection();
  updateStructurePinnedVisibility();
  }} else if ( uiID === 'bridge' ){ if ( toggle === 'active' ){
  console.log( 'bridge _active' )
  if (constructionSelectedPins.length < 2) {
    console.warn('bridge requires at least 2 selected pins.');
  } else {
    const pins = constructionSelectedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    }));
    TSys.buildStructureFromPins('bridge', pins, railTrackCurveMap);
  }
  }} else if ( uiID === 'elevated' ){ if ( toggle === 'active' ){
  console.log( 'elevated _active' )
  if (constructionSelectedPins.length < 2) {
    console.warn('elevated requires at least 2 selected pins.');
  } else {
    const pins = constructionSelectedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    }));
    TSys.buildStructureFromPins('elevated', pins, railTrackCurveMap);
  }
  }} else if ( uiID === 'wall' ){ if ( toggle === 'active' ){
  console.log( 'wall _active' )
  if (constructionSelectedPins.length < 2) {
    console.warn('wall requires at least 2 selected pins.');
  } else {
    const pins = constructionSelectedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    }));
    TSys.buildStructureFromPins('wall', pins, railTrackCurveMap);
  }
  }} else if ( uiID === 'floor' ){ if ( toggle === 'active' ){
  console.log( 'floor _active' )
  if (constructionSelectedPins.length < 2) {
    console.warn('floor requires at least 2 selected pins.');
  } else {
    const pins = constructionSelectedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    }));
    TSys.buildStructureFromPins('floor', pins, railTrackCurveMap);
  }
  }} else if ( uiID === 'pillar' ){ if ( toggle === 'active' ){
  console.log( 'pillar _active' )
  logPillarSideJudgement();
  if (constructionSelectedPins.length < 1) {
    console.warn('pillar requires selected pins.');
  } else {
    const pins = constructionSelectedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    }));
    TSys.buildStructureFromPins('pillar', pins, railTrackCurveMap, {
      baseInterval: 8,
      avoidRadius: 0.7,
      searchRadius: 3,
      samplePrecision: 0.1,
      maxOffset: 3,
      baseOffset: 0,
      offsetStep: 0.2,
    });
  }
  }} else if ( uiID === 'rib_bridge' ){ if ( toggle === 'active' ){
  console.log( 'rib_bridge _active' )
  if (constructionSelectedPins.length < 2) {
    console.warn('rib_bridge requires at least 2 selected pins.');
  } else {
    const pins = constructionSelectedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    }));
    const edges = getEdgeTrackNamesForConstruction(0.5);
    TSys.buildStructureFromPins('rib_bridge', pins, railTrackCurveMap, {
      edgeTrackNames: { right: edges.right, left: edges.left },
    });
  }
  }} else if ( uiID === 'tunnel_rect' ){ if ( toggle === 'active' ){
  console.log( 'tunnel_rect _active' )
  if (constructionSelectedPins.length < 2) {
    console.warn('tunnel_rect requires at least 2 selected pins.');
  } else {
    const pins = constructionSelectedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    }));
    TSys.buildStructureFromPins('tunnel_rect', pins, railTrackCurveMap, {
      innerWidth: 1.7,
      innerHeight: 2,
      wallThickness: 0.15,
      segmentSpacing: 1.2,
      yOffset: -0.1,
      color: 0x8b8f94,
    });
  }
  }} else if ( uiID === 'move/2_legacy' ){ if ( toggle === 'active' ){
  console.log( 'move/2_legacy _active' )
  } else {
  console.log( 'move/2_legacy _inactive' )
  }} else if ( uiID === 'x_z/2_legacy' ){ if ( toggle === 'active' ){
  console.log( 'x_z/2_legacy _active' )
  } else {
  console.log( 'x_z/2_legacy _inactive' )
  }} else if ( uiID === 'y/2_legacy' ){ if ( toggle === 'active' ){
  console.log( 'y/2_legacy _active' )
  } else {
  console.log( 'y/2_legacy _inactive' )
  




  }} else if ( uiID === 'creat' ){ if ( toggle === 'active' ){
  console.log( 'creat _active' )
    // const tilt = [
    // new THREE.Vector3(1, 10, -4),
    // new THREE.Vector3(0, 10, -2),
    // ]
    // const pos = new THREE.CatmullRomCurve3(tilt);
    // resetMeshListOpacity(targetObjects, tilt);
    // setMeshListOpacity(targetObjects, 1);

    // TSys.createTrack(pos,0,0xff0000)
    editObject = 'ORIGINAL'
    targetObjects = steelFrameMode.getCurrentPointMeshes()
    console.log(targetObjects)
    setMeshListOpacity(targetObjects, 1);
    setCreateModeWorldFocus(true);

  } else {
    console.log( 'creat _inactive' )
    // targetObjects = []
    // view モード以外では非表示にしない
    // steelFrameMode.clearSelection();
    steelFrameMode.setActive(false);
    editObject = 'Standby'
    targetObjects = []
    console.log(targetObjects)
    differenceSpaceModeActive = false
    if (differencePanel) {
      differencePanel.style.display = 'none';
    }
    clearDifferencePreviewTube();

  }} else if ( uiID === 'view' ){ if ( toggle === 'active' ){
  console.log( 'view _active' )
    search_object = false
    targetObjects = steelFrameMode.getCurrentPointMeshes()
    setMeshListOpacity(targetObjects, 0);
  } else {
  console.log( 'view _inactive' )
    targetObjects = steelFrameMode.getCurrentPointMeshes()
    setMeshListOpacity(targetObjects, 1);

  }} else if ( uiID === 'add_point' ){ if ( toggle === 'active' ){
  console.log( 'add_point _active' )
    editObject = 'STEEL_FRAME'
    steelFrameMode.setAllowPointAppend(true)
    objectEditMode = 'CREATE_NEW'
    search_object = true
    targetObjects = steelFrameMode.getCurrentPointMeshes().concat(guideRailPickMeshes)
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    addPointGridActive = true
    addPointGridY = addPointGridY || 0
    const gridPos = coord_DisplayTo3DAtCenter({ y: addPointGridY });
    addPointGridHandle.position.set(gridPos.x, addPointGridY, gridPos.z);
    AddPointGuideGrid.position.set(gridPos.x, addPointGridY, gridPos.z);
    setAddPointGuideGridVisibleFromUI(true);
    search_point();
    guideRailPickMeshes.forEach((mesh) => { if (mesh) mesh.visible = true; });
  } else {
  console.log( 'add_point _inactive' )
    search_object = false
    steelFrameMode.setAllowPointAppend(false)
    if (editObject === 'STEEL_FRAME') {
      objectEditMode = 'Standby'
    }
    addPointGridActive = false
    guideRailHover = null
    // setGuideGridVisibleFromUI(false)
    setAddPointGuideGridVisibleFromUI(false);
    guideRailPickMeshes.forEach((mesh) => { if (mesh) mesh.visible = false; });

  }} else if ( uiID === 'template' ){ if ( toggle === 'active' ){
  console.log( 'template _active' )
    if (guideWindow) {
      guideWindow.style.display = 'block';
    }
  } else {
  console.log( 'template _inactive' )
    if (guideWindow) {
      guideWindow.style.display = 'none';
    }
    guidePlacementTemplate = null;
    guidePlacementActive = false;
    guideRailHover = null;
    setGuideHoverPin(null);
    // template を閉じたら add_point の状態を再適用する
    UIevent('add_point', 'active');
  }} else if ( uiID === 'guide' ){ if ( toggle === 'active' ){
  console.log( 'guide _active' )
  } else {
  console.log( 'guide _inactive' )
  }} else if ( uiID === 'add' ){ if ( toggle === 'active' ){
  console.log( 'add _active' )
    guideAddModeActive = true;
    if (guideWindow) {
      guideWindow.style.display = 'none';
    }
    editObject = 'STEEL_FRAME';
    objectEditMode = 'CREATE_NEW';
    search_object = true;
    // 平面指定でガイド用グリッドを表示
    addPointGridActive = true;
    addPointGridY = addPointGridY || 0;
    const gridPos = coord_DisplayTo3DAtCenter({ y: addPointGridY });
    addPointGridHandle.position.set(gridPos.x, addPointGridY, gridPos.z);
    AddPointGuideGrid.position.set(gridPos.x, addPointGridY, gridPos.z);
    setAddPointGuideGridVisibleFromUI(true);
  } else {
  console.log( 'add _inactive' )
    guideAddModeActive = false;
    guidePlacementTemplate = null;
    guidePlacementActive = false;
    guideRailHover = null;
    setGuideHoverPin(null);
    // add を閉じたら add_point の状態を再適用する
    UIevent('add_point', 'active');

  }} else if ( uiID === 'y_add' ){ if ( toggle === 'active' ){
  console.log( 'y_add _active' )
    editObject = 'STEEL_FRAME'
    objectEditMode = 'MOVE_EXISTING'
    move_direction_y = true
    search_object = true
    addPointGridActive = true
    steelFrameMode.setAllowPointAppend(false)
    const gridPos = coord_DisplayTo3DAtCenter({
      y: addPointGridY,
      x: addPointGridHandle.position.x || camera.position.x,
      z: addPointGridHandle.position.z || camera.position.z,
    });
    addPointGridHandle.position.set(gridPos.x, addPointGridY, gridPos.z);
    AddPointGuideGrid.position.set(gridPos.x, addPointGridY, gridPos.z);
    // setAddPointGuideGridVisibleFromUI(true);
    targetObjects = [addPointGridHandle]
    setMeshListOpacity(targetObjects, 1)
    search_point()
  } else {
  console.log( 'y_add _inactive' )
    search_object = false
    move_direction_y = false
    steelFrameMode.setAllowPointAppend(false)
    if (editObject === 'STEEL_FRAME') {
      editObject = 'STEEL_FRAME'
      steelFrameMode.setAllowPointAppend(true)
      objectEditMode = 'CREATE_NEW'
      search_object = false
      targetObjects = steelFrameMode.getCurrentPointMeshes()
      setMeshListOpacity(targetObjects, 1)
      steelFrameMode.setActive(true)
      addPointGridActive = true
      addPointGridY = addPointGridY || 0
      setAddPointGuideGridVisibleFromUI(true);
    }
    // setAddPointGuideGridVisibleFromUI(false);

  }} else if ( uiID === 'rotation' ){ if ( toggle === 'active' ){
  console.log( 'rotation _active' )
    angleSearchModeActive = false
    editObject = 'STEEL_FRAME'
    objectEditMode = ROTATE_MODE
    search_object = true
    steelFrameMode.setAllowPointAppend(false)
    targetObjects = steelFrameMode.getAllPointMeshes()
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    updateRotateGizmo()
    if (rotationPanel) {
      rotationPanel.style.display = 'block';
    }
    search_point()
  } else {
  console.log( 'rotation _inactive' )
    angleSearchModeActive = false
    rotateDragging = false
    if (rotateGizmoGroup) {
      rotateGizmoGroup.visible = false;
    }
    if (rotationPanel) {
      rotationPanel.style.display = 'none';
    }
    if (editObject === 'STEEL_FRAME') {
      objectEditMode = 'Standby'
    }

  }} else if ( uiID === 'search' ){ if ( toggle === 'active' ){
  console.log( 'search _active' )
    angleSearchModeActive = true
    searchSelectedGrid = null
    editObject = 'STEEL_FRAME'
    objectEditMode = SEARCH_MODE
    search_object = true
    steelFrameMode.setAllowPointAppend(false)
    targetObjects = steelFrameMode.getAllPointMeshes()
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    if (rotationPanel) {
      rotationPanel.style.display = 'block';
    }
    updateSearchGridTiltVisuals();
    updateRotationSelectionInfo()
    search_point()
  } else {
  console.log( 'search _inactive' )
    angleSearchModeActive = false
    searchSelectedGrid = null
    guideAddGrids.forEach((grid) => setGuideAddGridColor(grid, GUIDE_ADD_GRID_COLOR));
    clearSearchGridVisuals();
    clearRotationInfoVisuals();
    if (rotationSelectionInfo) {
      rotationSelectionInfo.textContent = '選択点: 2点以上で情報を表示';
    }
    if (rotationPanel) {
      rotationPanel.style.display = 'none';
    }
    if (editObject === 'STEEL_FRAME' && objectEditMode === SEARCH_MODE) {
      objectEditMode = 'Standby'
    }
    search_object = false

  }} else if ( uiID === 'move_point' ){ if ( toggle === 'active' ){
  console.log( 'move_point _active' )
    // search_object = false
    editObject = 'STEEL_FRAME'
    // steelFrameMode.clearSelection()
    steelFrameMode.setAllowPointAppend(false)
    objectEditMode = 'MOVE_EXISTING'
    targetObjects = steelFrameMode.getAllPointMeshes()
    console.log(targetObjects)
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)

    search_object = true

  } else {
  console.log( 'move_point _inactive' )
    pointRotateModeActive = false
    search_object = false
    move_direction_y = false
    steelFrameMode.setAllowPointAppend(false)
    if (editObject === 'STEEL_FRAME') {
      objectEditMode = 'Standby'
    }
    clearPointRotateState();
  }} else if ( uiID === 'x_z_sf' ){ if ( toggle === 'active' ){
  console.log( 'x_z_sf _active' )
    pointRotateModeActive = false
    clearPointRotateState()
    editObject = 'STEEL_FRAME'
    move_direction_y = false
    objectEditMode = 'MOVE_EXISTING'
    targetObjects = steelFrameMode.getCurrentPointMeshes()
    setMeshListOpacity(targetObjects, 1)
    search_object = true
    search_point()

  } else {
  console.log( 'x_z_sf _inactive' )
    search_object = false
  }} else if ( uiID === 'y_sf' ){ if ( toggle === 'active' ){
  console.log( 'y_sf _active' )
    pointRotateModeActive = false
    clearPointRotateState()
    editObject = 'STEEL_FRAME'
    move_direction_y = true
    objectEditMode = 'MOVE_EXISTING'
    targetObjects = steelFrameMode.getCurrentPointMeshes()
    setMeshListOpacity(targetObjects, 1)
    search_object = true
    search_point()

  } else {
  console.log( 'y_sf _inactive' )
    search_object = false
  }} else if ( uiID === 'rotation/2' ){ if ( toggle === 'active' ){
  console.log( 'rotation/2 _active' )
    pointRotateModeActive = true
    editObject = 'STEEL_FRAME'
    if (objectEditMode === 'Standby') {
      objectEditMode = 'MOVE_EXISTING'
    }
    search_object = true
    steelFrameMode.setAllowPointAppend(false)
    targetObjects = steelFrameMode.getAllPointMeshes()
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    if (rotationPanel) {
      rotationPanel.style.display = 'block';
    }
    updatePointRotateVisuals()
    search_point()
  } else {
  console.log( 'rotation/2 _inactive' )
    pointRotateModeActive = false
    if (rotationPanel) {
      rotationPanel.style.display = 'none';
    }
    clearPointRotateState()
    if (editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING') {
      search_object = true
      search_point()
    }
  }} else if ( uiID === 'change_angle' ){ if ( toggle === 'active' ){
  console.log( 'change_angle _active' )
    movePlaneMode = 'change_angle'
    ensureMovePlaneGizmo();
    changeAngleGridTarget = guideAddGrids.length > 0
      ? guideAddGrids[guideAddGrids.length - 1]
      : AddPointGuideGrid;
    if (changeAngleGridTarget?.quaternion) {
      movePlaneBasisQuat.copy(changeAngleGridTarget.quaternion).normalize();
    } else {
      movePlaneBasisQuat.identity();
    }
    syncMovePlaneGizmoFromBasis();
    AddPointGuideGrid.visible = true;
    GuideGrid.visible = false;
    addPointGridActive = true;
    movePlaneAnchor.copy(changeAngleGridTarget.position);
    updateMovePlaneNormal();
    syncChangeAnglePanelFromBasis({ writeValue: false });
    targetObjects = [addPointGridHandle];
    setMeshListOpacity(targetObjects, 1);
    search_object = true;
    search_point();
    if (rotationPanel) {
      rotationPanel.style.display = 'block';
    }
    movePlaneGrid.visible = false;
    movePlaneGridHelper.visible = false;
  } else {
  console.log( 'change_angle _inactive' )
    if (movePlaneMode === 'change_angle') {
      movePlaneMode = 'default'
    }
    changeAngleGridTarget = null;
    movePlaneRotateDragging = false;
    if (rotationPanel) {
      rotationPanel.style.display = 'none';
    }
    movePlaneGrid.visible = false;
    movePlaneGridHelper.visible = false;
    if (movePlaneGizmoGroup) movePlaneGizmoGroup.visible = false;
  }} else if ( uiID === 'construction/2' ){ if ( toggle === 'active' ){
  console.log( 'construction/2 _active' )
    editObject = 'STEEL_FRAME'
    objectEditMode = 'CONSTRUCT'
    search_object = false
    targetObjects = steelFrameMode.getAllPointMeshes()
    console.log(targetObjects)

    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
  } else {
  console.log( 'construction/2 _inactive' )
    // steelFrameMode.clearSelection()
    search_object = false
    move_direction_y = false
    if (editObject === 'STEEL_FRAME') {
      objectEditMode = 'Standby'
    }
  }} else if ( uiID === 'pillar/2' || uiID === 'pillar' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
  } else {
  console.log( uiID + ' _inactive' )
  }} else if ( uiID === 'rite' ){ if ( toggle === 'active' ){
  console.log( 'rite _active' )
  } else {
  console.log( 'rite _inactive' )
  }} else if ( uiID === 'Round_bar' ){ if ( toggle === 'active' ){
  console.log( 'Round_bar _active' )
    steelFrameMode.setSegmentProfile('round')
  } else {
  console.log( 'Round_bar _inactive' )
  }} else if ( uiID === 'H_beam' ){ if ( toggle === 'active' ){
  console.log( 'H_beam _active' )
    steelFrameMode.setSegmentProfile('h_beam')
  } else {
  console.log( 'H_beam _inactive' )
  }} else if ( uiID === 'tubular' ){ if ( toggle === 'active' ){
  console.log( 'tubular _active' )
    steelFrameMode.setSegmentProfile('tubular')
  } else {
  console.log( 'tubular _inactive' )
  }} else if ( uiID === 'Difference' ){ if ( toggle === 'active' ){
  console.log( 'Difference _active' )
    differenceSpaceTransformMode = 'none'
    if (differencePanel) {
      differencePanel.style.display = 'block';
    }
    updateDifferenceStatus('spaceで平面を配置し、カテゴリ指定後に excavation を実行してください。');
  } else {
  console.log( 'Difference _inactive' )
    differenceSpaceModeActive = false
    differenceSpaceTransformMode = 'none'
    pointRotateModeActive = false
    clearPointRotateState()
    if (differencePanel) {
      differencePanel.style.display = 'none';
    }
    if (editObject === 'STEEL_FRAME' && objectEditMode === 'CONSTRUCT') {
      objectEditMode = 'Standby';
    }
    if (editObject === 'DIFFERENCE_SPACE') {
      editObject = 'Standby';
      objectEditMode = 'Standby';
    }
    clearDifferencePreviewTube();
    clearDifferenceFaceHighlight();
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
  }} else if ( uiID === 'space' ){ if ( toggle === 'active' ){
  console.log( 'space _active' )
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'none'
    differenceShapeType = 'box'
    if (differenceShapeSelect) {
      differenceShapeSelect.value = 'box';
    }
    editObject = 'DIFFERENCE_SPACE'
    objectEditMode = 'Standby'
    search_object = false
    targetObjects = differenceSpacePlanes.filter((m) => m?.parent)
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(false)
    if (differencePanel) {
      differencePanel.style.display = 'block';
    }
    refreshDifferencePreview();
  } else {
  console.log( 'space _inactive' )
    differenceSpaceModeActive = false
    differenceSpaceTransformMode = 'none'
    pointRotateModeActive = false
    clearPointRotateState()
    if (editObject === 'DIFFERENCE_SPACE' && objectEditMode === 'CONSTRUCT') {
      objectEditMode = 'Standby';
    }
    if (editObject === 'DIFFERENCE_SPACE') {
      editObject = 'Standby';
    }
    clearDifferencePreviewTube();
    clearDifferenceFaceHighlight();
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
    updateDifferenceStatus('spaceで平面を1枚以上配置してください。');
  }} else if ( uiID === 'add/2' || uiID === 'add_space' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'add'
    pointRotateModeActive = false
    clearPointRotateState()
    editObject = 'DIFFERENCE_SPACE'
    objectEditMode = 'CREATE_NEW'
    search_object = false
    targetObjects = differenceSpacePlanes.filter((m) => m?.parent)
    setMeshListOpacity(targetObjects, 1)
    differenceShapeType = 'box'
    if (differenceShapeSelect) {
      differenceShapeSelect.value = 'box';
    }
    clearDifferencePreviewTube();
    updateDifferenceStatus('空き領域クリックでボックス追加。既存面クリックで押し出し拡張します。');
  } else {
  console.log( uiID + ' _inactive' )
    differenceSpaceTransformMode = 'none'
    if (editObject === 'DIFFERENCE_SPACE' && objectEditMode === 'CREATE_NEW') {
      objectEditMode = 'Standby';
    }
    clearDifferenceFaceHighlight();
    differenceHoverFaceKey = null;
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
  }} else if ( uiID === 'move/2' || uiID === 'move_space' || uiID === 'rotation/3' || uiID === 'rotation_space' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'move'
    differenceShapeType = 'box'
    if (differenceShapeSelect) {
      differenceShapeSelect.value = 'box';
    }
    pointRotateModeActive = true
    editObject = 'DIFFERENCE_SPACE'
    objectEditMode = 'CONSTRUCT'
    search_object = false
    targetObjects = differenceSpacePlanes.filter((m) => m?.parent)
    setMeshListOpacity(targetObjects, 1)
    differenceSpacePlanes.forEach((mesh) => setDifferencePlaneVisual(mesh, false));
    if (rotationPanel) {
      rotationPanel.style.display = 'block';
    }
    updateDifferenceStatus('面を選択してドラッグで形状を変更します。');
  } else {
  console.log( uiID + ' _inactive' )
    differenceSpaceTransformMode = 'none'
    pointRotateModeActive = false
    if (rotationPanel) {
      rotationPanel.style.display = 'none';
    }
    clearPointRotateState()
    if (editObject === 'DIFFERENCE_SPACE' && objectEditMode === 'CONSTRUCT') {
      objectEditMode = 'Standby';
    }
    clearDifferenceFaceHighlight();
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
  }} else if ( uiID === 'tube' || uiID === 'tube/2' || uiID === 'tube_space' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'tube'
    pointRotateModeActive = false
    clearPointRotateState()
    editObject = 'DIFFERENCE_SPACE'
    objectEditMode = 'Standby'
    search_object = false
    targetObjects = differenceSpacePlanes.filter((m) => m?.parent)
    setMeshListOpacity(targetObjects, 1)
    differenceShapeType = 'tube'
    if (differenceShapeSelect) {
      differenceShapeSelect.value = 'tube';
    }
    if (differencePanel) {
      differencePanel.style.display = 'block';
    }
    refreshDifferencePreview();
    updateDifferenceStatus('tubeモード: 配置済みボックス列からチューブを生成します。');
  } else {
  console.log( uiID + ' _inactive' )
    if (differenceSpaceTransformMode === 'tube') {
      differenceSpaceTransformMode = 'none'
    }
    clearDifferenceFaceHighlight();
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
  }} else if ( uiID === 'excavation' ){ if ( toggle === 'active' ){
  console.log( 'excavation _active' )
    if (!runDifferenceOnSinjyukuFromSelectedPoints()) {
      console.warn('excavation failed.');
    }
  } else {
  console.log( 'excavation _inactive' )




  }} else if ( uiID === 'sphere' ){ if ( toggle === 'active' ){
  console.log( 'sphere _active' )
  } else {
  console.log( 'sphere _inactive' )
  }} else if ( uiID === 'cube' ){ if ( toggle === 'active' ){
    console.log( 'cube _active' )
    objectEditMode = 'CREATE_NEW'
    search_object = false
    targetObjects = []
    setMeshListOpacity(targetObjects, 1);

  } else {
    console.log( 'cube _inactive' )
    // if (group_EditNow != 'None'){
    //   console.log('bisible')
    //   group_targetObjects[group_EditNow][0].visible = false;
    //   group_targetObjects[group_EditNow][1].visible = false;
    // }

    console.log('false; '+targetObjects)
    setMeshListOpacity(targetObjects, 0);

  }} else if ( uiID === 'pick' ){ if ( toggle === 'active' ){
    console.log( 'pick _active' )
    objectEditMode = 'PICK'

    search_object = true

    targetObjects = group_object
    setMeshListOpacity(targetObjects, 1);
    search_point();

  } else {
    console.log( 'pick _inactive' )

    search_object = false
    move_direction_y = false

    objectEditMode = 'Standby'

  }} else if ( uiID === 'move/3' ){ if ( toggle === 'active' ){
    console.log( 'move/3 _active' )
    objectEditMode = 'MOVE_EXISTING'

    targetObjects = group_targetObjects[group_EditNow]
    setMeshListOpacity(targetObjects, 1);

    search_object = true
    search_point();

  } else {
    console.log( 'move/3 _inactive' )
    search_object = false
    move_direction_y = false
    setMeshListOpacity(targetObjects, 0);

    objectEditMode = 'Standby'

  }} else if ( uiID === 'x_z/3' ){ if ( toggle === 'active' ){
    console.log( 'x_z/3 _active' )
    move_direction_y = false
  } else {
    console.log( 'x_z/3 _inactive' )
;
  }} else if ( uiID === 'y/3' ){ if ( toggle === 'active' ){
    console.log( 'y/3 _active' )
    move_direction_y = true
    
  } else {
    console.log( 'y/3 _inactive' )
    search_object = false
  
  }} else if ( uiID === 'custom' ){ if ( toggle === 'active' ){
    console.log( 'custom _active' )
    move_direction_y = false
    setMeshListOpacity(targetObjects, 1);
    editObject = 'CUSTOM'

    } else {
    console.log( 'custom _inactive' )

  }} else if ( uiID === 'new/3' ){ if ( toggle === 'active' ){
    console.log( 'new/3 _active' )
    objectEditMode = 'CREATE_NEW'
    search_object = false

    } else {
    console.log( 'new/3 _inactive' )
    search_object = false
    move_direction_y = false

    objectEditMode = 'Standby'

  }} else if ( uiID === 'move/4' ){ if ( toggle === 'active' ){
    console.log( 'move/4 _active' )
    } else {
    console.log( 'move/4 _inactive' )
  }} else if ( uiID === 'x_z/4' ){ if ( toggle === 'active' ){
    console.log( 'x_z/4 _active' )
    } else {
    console.log( 'x_z/4 _inactive' )
  }} else if ( uiID === 'y/4' ){ if ( toggle === 'active' ){
    console.log( 'y/4 _active' )
    } else {
    console.log( 'y/4 _inactive' )
  }} else if ( uiID === 'construct' ){ if ( toggle === 'active' ){
    console.log( 'construct _active' )
    objectEditMode = 'CONSTRUCT'

    search_object = true
    search_point();
 
    } else {
    console.log( 'construct _inactive' )
    objectEditMode = 'Standby'
    search_object = false

  }}
}

// 視点操作
// カメラ操作 ----------------------------------------------------------------

const ctrl_area = document.getElementById("controller-area")
const ctrl_ui = document.getElementById("controller")
let lastPosition1 = { x: 0, y: 0 };

// コントローラ位置（画面または canvas に対して左から 80px、下から 80px）
let ctrlX = 160;
let ctrlY = 80;

function updateCtrlPos() {
  if (!ctrl_ui || !canvas) return;
  const crect = canvas.getBoundingClientRect();
  const offsetParent = ctrl_ui.offsetParent || ctrl_ui.parentElement || document.body;
  const prect = offsetParent.getBoundingClientRect ? offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
  // left/top relative to offsetParent
  const relLeft = Math.floor((crect.left - prect.left) + 160);
  const relTop = Math.floor((crect.top - prect.top) + crect.height - 80);
  // update global client coordinates for hit testing
  ctrlX = relLeft
  ctrlY = relTop
  // apply styles relative to offsetParent
  ctrl_ui.style.left = relLeft + 'px';
  ctrl_ui.style.top = relTop + 'px';
  
  ctrl_area.style.left = relLeft + 'px';
  ctrl_area.style.top = relTop + 'px';
}
let camera_num = 1
let ctrl_num = 0

let ctrl_id = null

function search_ctrl_num(e){
  const touches = e.touches
  for(let i = 0; i < touches.length; i++){
    if (40 > Math.sqrt((ctrlX-touches[i].clientX)**2 + (ctrlY-touches[i].clientY)**2)){
      if (ctrl_id === null){
        ctrl_id = e.changedTouches[0].identifier
        ctrl_num = i
        camera_num = (ctrl_num+1)%2
      }
    }
  }
}

// マウス座標管理用のベクトルを作成
const mouse = new THREE.Vector2();

// ヘルパー: 指定クライアント座標がキャンバス内にあるか
function pointInCanvas(clientX, clientY){
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

// プレビュー（intro-canvas）時はキャンバス内での操作のみ許可するユーティリティ
function isInteractionAllowed(clientX, clientY){
  // フルスクリーン時は常に許可
  if (!canvas) return false;
  if (!canvas.classList.contains('intro-canvas')) return true;
  // ドラッグ中なら継続して操作を許可
  if (typeof dragging !== 'undefined' && dragging) return true;
  return pointInCanvas(clientX, clientY);
}

// ジョイコン or 視点 判定 : 物体移動開始
window.addEventListener('mousedown', (e) => {
  if (!isInteractionAllowed(e.clientX, e.clientY)) return; // outside canvas in preview -> ignore (allow page interactions)
  handleMouseMove(e.clientX, e.clientY);
  handleMouseDown(e);
});

window.addEventListener('touchstart', (e) => {

  // UI監視
  const touch = e.touches[0];
  // 常にマウス座標は更新しておく（UI フィードバックのため）
  handleMouseMove(touch.clientX, touch.clientY);
  
  // 視点制御やオブジェクト編集は、プレビュー時にキャンバス内で始まった場合のみ処理する
  const allow = isInteractionAllowed(touch.clientX, touch.clientY);
  
  // 視点
  search_ctrl_num(e)
  if (e.changedTouches[0].identifier != ctrl_id && e.touches.length <= 2){
    lastPosition1 = { x: e.touches[e.touches.length-1].clientX, y: e.touches[e.touches.length-1].clientY }
  }

  if (!allow) {
    // キャンバス外でのタッチはページスクロールを優先させる
    return;
  }

  // --- 編集モード
  if (OperationMode === 0){return}
  e.preventDefault();      // ← スクロールを止める（キャンバス内の操作として扱う）
  if (objectEditMode === 'MOVE_EXISTING') { 
    dragging = null//'stand_by';
    onerun_search_point();
  }

  handleMouseDown();      // ← 同じ関数に渡している

}, { passive: false });


// 位置&視点 操作 : 物体移動追尾
document.addEventListener('mousemove', (e) => {
  // プレビュー時はキャンバス外のマウス移動は無視（ただしドラッグ中は継続）
  if (!isInteractionAllowed(e.clientX, e.clientY)) return;
  // UI監視 編集モード
  handleMouseMove(e.clientX, e.clientY);
  if (movePlaneRotateDragging) {
    updateMovePlaneRotateDrag();
    return;
  }
  if (differenceMoveClickPending && differenceMoveDownPos && differenceMoveShouldToggle) {
    const dx = e.clientX - differenceMoveDownPos.x;
    const dy = e.clientY - differenceMoveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      differenceMoveShouldToggle = false;
    }
  }
  if (differenceMoveClickPending && differenceMoveDownPos && !dragging
    && editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'move') {
    const dx = e.clientX - differenceMoveDownPos.x;
    const dy = e.clientY - differenceMoveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      differenceMoveShouldToggle = false;
      startDifferenceMoveDragFromPending();
    }
  }
  if (moveClickPending && moveDownPos && shouldToggle) {
    const dx = e.clientX - moveDownPos.x;
    const dy = e.clientY - moveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      shouldToggle = false;
    }
  }
  if (moveClickPending && moveDownPos && !dragging && editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING') {
    const dx = e.clientX - moveDownPos.x;
    const dy = e.clientY - moveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      shouldToggle = false;
      if (choice_object) {
        const hasGroup = steelFrameMode.getSelectedPointMeshes().length > 0;
        if (!hasGroup) {
          // グループが空なら単体移動に切替
          moveDragAnchorStart = choice_object.position.clone();
          moveDragStartPositions = [];
        } else {
          if (!steelFrameMode.isSelectedPoint(choice_object)) {
            steelFrameMode.toggleSelectedPoint(choice_object);
          }
          moveDragAnchorStart = choice_object.position.clone();
          moveDragStartPositions = steelFrameMode.getSelectedPointMeshes().map((mesh) => ({
            mesh,
            pos: mesh.position.clone(),
          }));
        }

        const pos = camera.position;
        if (!move_direction_y){
          let set_y = choice_object.position.y;
          raycaster.setFromCamera(mouse, camera);
          const dir = raycaster.ray.direction;
          const t = Math.abs((pos.y - set_y)/dir.y);
          TargetDiff = [
            choice_object.position.x - (pos.x + dir.x * t),
            choice_object.position.z - (pos.z + dir.z * t)
          ];
        } else {
          raycaster.setFromCamera(mouse, camera);
          const dir = raycaster.ray.direction;
          const diff = {x: choice_object.position.x - pos.x, z: choice_object.position.z - pos.z}
          const hypotenuse = Math.cos(Math.atan2(diff.x, diff.z) - cameraAngleY) * Math.sqrt(diff.x**2 + diff.z**2)
          const t = hypotenuse/(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x);
          TargetDiff = choice_object.position.y - (pos.y + dir.y * t); 
        }

        dragging = true;
        efficacy = false;
        moveClickPending = false;
        search_object = false;
        GuideLine.visible = true;
      }
    }
  }
  handleDrag();
});

document.addEventListener('touchmove', (e) => {
  // 判定: キャンバス内での操作かどうか
  const touch = e.touches[0];
  const allow = isInteractionAllowed(touch.clientX, touch.clientY);
  if (!allow) return; // outside canvas in preview -> allow page scrolling

  e.preventDefault();

  // UI監視
  handleMouseMove(touch.clientX, touch.clientY);
  if (movePlaneRotateDragging) {
    updateMovePlaneRotateDrag();
    return;
  }
  if (differenceMoveClickPending && differenceMoveDownPos && differenceMoveShouldToggle) {
    const dx = touch.clientX - differenceMoveDownPos.x;
    const dy = touch.clientY - differenceMoveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      differenceMoveShouldToggle = false;
    }
  }
  if (differenceMoveClickPending && differenceMoveDownPos && !dragging
    && editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'move') {
    const dx = touch.clientX - differenceMoveDownPos.x;
    const dy = touch.clientY - differenceMoveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      differenceMoveShouldToggle = false;
      startDifferenceMoveDragFromPending();
    }
  }
  if (moveClickPending && moveDownPos && shouldToggle) {
    const dx = touch.clientX - moveDownPos.x;
    const dy = touch.clientY - moveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      shouldToggle = false;
    }
  }
  if (moveClickPending && moveDownPos && !dragging && editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING') {
    const dx = touch.clientX - moveDownPos.x;
    const dy = touch.clientY - moveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      shouldToggle = false;
      if (choice_object) {
        if (!steelFrameMode.isSelectedPoint(choice_object)) {
          steelFrameMode.toggleSelectedPoint(choice_object);
        }
        moveDragAnchorStart = choice_object.position.clone();
        moveDragStartPositions = steelFrameMode.getSelectedPointMeshes().map((mesh) => ({
          mesh,
          pos: mesh.position.clone(),
        }));

        const pos = camera.position;
        if (!move_direction_y){
          let set_y = choice_object.position.y;
          raycaster.setFromCamera(mouse, camera);
          const dir = raycaster.ray.direction;
          const t = Math.abs((pos.y - set_y)/dir.y);
          TargetDiff = [
            choice_object.position.x - (pos.x + dir.x * t),
            choice_object.position.z - (pos.z + dir.z * t)
          ];
        } else {
          raycaster.setFromCamera(mouse, camera);
          const dir = raycaster.ray.direction;
          const diff = {x: choice_object.position.x - pos.x, z: choice_object.position.z - pos.z}
          const hypotenuse = Math.cos(Math.atan2(diff.x, diff.z) - cameraAngleY) * Math.sqrt(diff.x**2 + diff.z**2)
          const t = hypotenuse/(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x);
          TargetDiff = choice_object.position.y - (pos.y + dir.y * t); 
        }

        dragging = true;
        efficacy = false;
        search_object = false;
        GuideLine.visible = true;
      }
    }
  }

  // 視点
  if (e.touches.length === 1 && efficacy) {
    if (ctrl_id === null){
      const dx = lastPosition1.x - e.touches[0].clientX;
      const dy = lastPosition1.y - e.touches[0].clientY;

      const angle2 = Math.atan2(dx,dy)
      const range = Math.sqrt(dx**2 + dy**2)

      cameraAngleY += Math.sin(angle2) * range * 0.005;
      cameraAngleX += Math.cos(angle2) * range * 0.005;
      cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, cameraAngleX));

      lastPosition1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      const dx = ctrlX - e.touches[0].clientX;
      const dy = ctrlY - e.touches[0].clientY;

      const angley = cameraAngleY + Math.atan2(dx,dy)
      const range = Math.sqrt(dx**2 + dy**2)
      moveVectorX = Math.sin(angley) * range * 0.01
      moveVectorZ = Math.cos(angley) * range * 0.01

      const ctrl_angle = Math.atan2(dx,dy)
      ctrl_ui.style.left = ctrlX - Math.sin(ctrl_angle) * Math.min(40, range) + 'px';
      ctrl_ui.style.top = ctrlY - Math.cos(ctrl_angle) * Math.min(40, range) + 'px';

    }
  } else if (e.touches.length >= 2 && efficacy) {

    if (ctrl_id===null){return}
    // if (e.changedTouches[1].identifier === ctrl_id){alert('ctrl1')}

    const cdx = lastPosition1.x - e.touches[camera_num].clientX;
    const cdy = lastPosition1.y - e.touches[camera_num].clientY;
    const angle2 = Math.atan2(cdx,cdy)
    const crange = Math.sqrt(cdx**2 + cdy**2)

    cameraAngleY += Math.sin(angle2) * crange * 0.005;
    cameraAngleX += Math.cos(angle2) * crange * 0.005;
    cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, cameraAngleX));

    lastPosition1 = { x: e.touches[camera_num].clientX, y: e.touches[camera_num].clientY };
  
    const dx = ctrlX - e.touches[ctrl_num].clientX;
    const dy = ctrlY - e.touches[ctrl_num].clientY;

    const angley = cameraAngleY + Math.atan2(dx,dy)
    const range = Math.sqrt(dx**2 + dy**2)
    moveVectorX = Math.sin(angley) * range * 0.01
    moveVectorZ = Math.cos(angley) * range * 0.01

    const ctrl_angle = Math.atan2(dx,dy)
    ctrl_ui.style.left = ctrlX - Math.sin(ctrl_angle) * Math.min(40, range) + 'px';
    ctrl_ui.style.top = ctrlY - Math.cos(ctrl_angle) * Math.min(40, range) + 'px';

  }

  // 編集モード
  handleDrag();

}, { passive: false });


// 物体移動完了
document.addEventListener('mouseup', () => {
  handleMouseUp();
});

document.addEventListener('touchend',(e)=>{
  // 視点
  if (ctrl_id === e.changedTouches[0].identifier){
    ctrl_id = null
    ctrl_num = null
    moveVectorX = 0;
    moveVectorZ = 0; 
    ctrl_ui.style.left = ctrlX + 'px';
    ctrl_ui.style.top = ctrlY + 'px';
  } else {
    ctrl_num = 0
    camera_num = 1

    if (e.touches.length > 0){
      // 2本以上指が置かれいた場合に備えて、最後のベクトルを格納
      lastPosition1 = { x: e.touches[e.touches.length-1].clientX, y: e.touches[e.touches.length-1].clientY }
    }
  }

  // 編集モード
  handleMouseUp(true);
}
);

// アナロク操作（デバッグ用）
// カメラの位置（視点の位置）

// キーボード操作（鑑賞用）
// ========== 設定値 ========== //
let baseSpeed = 0.1;
const rotateSpeed = 0.03;
const pitchLimit = Math.PI / 2 - 0.1;

// ========== 入力管理 ========== //
const keys = {};
// キーボード入力はプレビュー時にキャンバス上にポインタがある場合のみ受け付ける
let canvasFocused = false;
if (canvas) {
  // スクロール無効化用リスナ
  const _wheelHandler = (e) => { e.preventDefault(); };
  const _touchMoveHandler = (e) => { e.preventDefault(); };
  // keep previous states to restore later
  let _prevBodyOverflow = null;
  let _prevCanvasTouchAction = null;

  function enableCanvasScrollBlock(){
    try {
      // try preventing wheel/touchmove via listeners
      window.addEventListener('wheel', _wheelHandler, { passive: false });
      window.addEventListener('touchmove', _touchMoveHandler, { passive: false });
      // and forcibly disable body scrolling as a fallback
      _prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // disable touch-action on canvas to prevent browser gesture
      _prevCanvasTouchAction = canvas.style.touchAction;
      canvas.style.touchAction = 'none';
    } catch (e) {}
  }
  function disableCanvasScrollBlock(){
    try {
      window.removeEventListener('wheel', _wheelHandler, { passive: false });
      window.removeEventListener('touchmove', _touchMoveHandler, { passive: false });
      if (_prevBodyOverflow !== null) document.body.style.overflow = _prevBodyOverflow;
      _prevBodyOverflow = null;
      if (_prevCanvasTouchAction !== null) canvas.style.touchAction = _prevCanvasTouchAction;
      _prevCanvasTouchAction = null;
    } catch (e) {}
  }

  canvas.addEventListener('pointerenter', () => { canvasFocused = true; enableCanvasScrollBlock(); });
  canvas.addEventListener('pointerleave', () => { canvasFocused = false; disableCanvasScrollBlock(); });
  // タッチ開始でもフォーカス状態にする
  canvas.addEventListener('touchstart', () => { canvasFocused = true; enableCanvasScrollBlock(); });
  canvas.addEventListener('touchend', () => { canvasFocused = false; disableCanvasScrollBlock(); });
}
document.addEventListener('keydown', (e) => {
  // プレビュー時はキャンバス上にポインタがなければ無視
  if (canvas && canvas.classList.contains('intro-canvas') && !canvasFocused) return;
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
  if (canvas && canvas.classList.contains('intro-canvas') && !canvasFocused) return;
  keys[e.key.toLowerCase()] = false;
});

// ========== カメラ制御変数 ========== //
let cameraAngleY = 180 * Math.PI / 180;  // 水平回転
let cameraAngleX = -10 * Math.PI / 180;  // 垂直回転
let moveVectorX = 0
let moveVectorZ = 0

camera.position.y += 5
camera.position.z = -20//-13
// ========== ボタン UI ========== //
// 状態フラグ
let speedUp = false;
let moveUp = false;
let moveDown = false;

document.getElementById('speed-up').addEventListener('touchstart', () => speedUp = true);
document.getElementById('speed-up').addEventListener('mousedown', () => speedUp = true);

document.getElementById('speed-down').style.display = 'none';
document.getElementById('speed-down').addEventListener('touchstart', () => speedUp = true);
document.getElementById('speed-down').addEventListener('mousedown', () => speedUp = true);

document.getElementById('btn-up').addEventListener('touchstart', () => moveUp = true);
document.getElementById('btn-up').addEventListener('touchend', () => moveUp = false);
document.getElementById('btn-down').addEventListener('touchstart', () => moveDown = true);
document.getElementById('btn-down').addEventListener('touchend', () => moveDown = false);

document.getElementById('btn-up').addEventListener('mousedown', () => moveUp = true);
document.getElementById('btn-up').addEventListener('mouseup', () => moveUp = false);
document.getElementById('btn-down').addEventListener('mousedown', () => moveDown = true);
document.getElementById('btn-down').addEventListener('mouseup', () => moveDown = false);

// // 例：クリックで移動
// stage.addEventListener('click', (e) => {
//   // e.clientX/Y はビューポート座標（スクロール影響なし）
//   setControllerPos(e.clientX, e.clientY);
// });

// ========== アニメーションループ ========== //

let key = '0'
document.addEventListener('keydown', (e) => {
  key = e.key.toLowerCase();
});

function animate() {

  // console.log(b6dm.rotation)

  const moveSpeed = baseSpeed;

  // キーボード移動処理
  const strafe = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
  const forward = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0);
    
  // 数字キー押下で倍率設定
  if (key >= '1' && key <= '9') {
    baseSpeed = parseInt(key, 10) * (parseInt(key, 10) *0.05);
  }
  // 0キーで倍率リセット
  else if (key === '0') {
    baseSpeed = moveSpeed;
  }

  // 横移動
  camera.position.x += Math.sin(cameraAngleY + Math.PI / 2) * moveSpeed * strafe;
  camera.position.z += Math.cos(cameraAngleY + Math.PI / 2) * moveSpeed * strafe;

  // 前後移動
  camera.position.x += Math.sin(cameraAngleY) * moveSpeed * forward;
  camera.position.z += Math.cos(cameraAngleY) * moveSpeed * forward;

  // スティック入力（カメラ基準移動）
  camera.position.x += moveVectorX * moveSpeed;
  camera.position.z += moveVectorZ * moveSpeed;

  if (speedUp) {
    if (baseSpeed === 0.1){
      baseSpeed = 0.9
      document.getElementById('speed-up').style.display = 'none';
      document.getElementById('speed-down').style.display = 'block';
    } else {
      baseSpeed = 0.1
      document.getElementById('speed-up').style.display = 'block';
      document.getElementById('speed-down').style.display = 'none';
    }
    speedUp = false
  }

  // 上下移動（Q/Eキー）
  if (keys['q'] || moveUp) {
    camera.position.y += moveSpeed*0.5;
  }
  if (keys['e'] || moveDown) {
    camera.position.y -= moveSpeed*0.5;
  }
  
  // 回転（左右）
  if (keys['arrowleft'])  cameraAngleY += rotateSpeed;
  if (keys['arrowright']) cameraAngleY -= rotateSpeed;

  // 回転（上下）
  if (keys['arrowup'])    cameraAngleX += rotateSpeed;
  if (keys['arrowdown'])  cameraAngleX -= rotateSpeed;
  cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, cameraAngleX));

  // cameraAngleY += rotateSpeed

  // カメラ注視点の更新
  // rightStickVector.x → 左右方向（横回転に使う）
  // rightStickVector.y → 上下方向（縦回転に使う）

  // ピッチ制限（上下の角度が大きくなりすぎないように）
  cameraAngleX = Math.min(pitchLimit, Math.max(-pitchLimit, cameraAngleX));

  // カメラの注視点の更新（カメラ位置 + 方向ベクトル）
  const direction = new THREE.Vector3(
    Math.sin(cameraAngleY) * Math.cos(cameraAngleX),
    Math.sin(cameraAngleX),
    Math.cos(cameraAngleY) * Math.cos(cameraAngleX)
  );

  camera.lookAt(new THREE.Vector3().addVectors(camera.position, direction));
  updateStructureHover();
  if (addPointGridActive) {
    // visibility controlled by UIevent
  }

  // メインカメラ：プレビュー時は canvas の描画バッファサイズに合わせる
  const isIntro = canvas.classList.contains('intro-canvas');
  if (isIntro) {
    const w = canvas.width;
    const h = canvas.height;
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
  } else {
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
  }
  renderer.setScissorTest(true);

  // document.body.classList.toggle('dragging', dragging === true);
  if (movePlaneMode === 'change_angle') {
    updateMovePlaneGizmo();
  }

  renderer.render(scene, camera);
  markRenderFrame();

  if (dragging === true){
    if (!choice_object || !choice_object.position) {
      dragging = false;
      return;
    }
    const pos = choice_object.position
    cameraSub.position.set(pos.x-Math.sin(cameraAngleY)*0.2,pos.y+5,pos.z-Math.cos(cameraAngleY)*0.2)

    cameraSub.lookAt(pos.x,pos.y,pos.z)
    // サブカメラ：画面右下に小さく表示（プレビュー時は canvas 内に収める）
    const mainW = isIntro ? canvas.width : window.innerWidth;
    const mainH = isIntro ? canvas.height : window.innerHeight;
    const insetWidth = Math.floor(mainW / 4);
    const insetHeight = Math.floor(mainH / 4);
    const insetX = isIntro ? (mainW - insetWidth - 10) : 110;
    const insetY = isIntro ? (mainH - insetHeight - 10) : (window.innerHeight - insetHeight - 100);

    renderer.setViewport(insetX, insetY, insetWidth, insetHeight);
    renderer.setScissor(insetX, insetY, insetWidth, insetHeight);
    renderer.setScissorTest(true);
    
    if (!move_direction_y){
      GuideGrid_Center_x.position.copy(choice_object.position)
      GuideGrid_Center_x.visible = true
      GuideGrid_Center_z.position.copy(choice_object.position)
      GuideGrid_Center_z.visible = true
    }
    renderer.render(scene, cameraSub);
    if (!move_direction_y){
      GuideGrid_Center_x.visible = false
      GuideGrid_Center_z.visible = false
    }
  }
    requestAnimationFrame(animate);
}

animate();
