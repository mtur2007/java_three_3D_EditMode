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
import { Brush, Evaluator, HOLLOW_SUBTRACTION, ADDITION } from 'three-bvh-csg';
import { encode, decode } from 'https://cdn.jsdelivr.net/npm/@msgpack/msgpack@3.0.0/dist.esm/index.mjs';
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
  const rotationPanelTitle = document.getElementById('rotation-panel-title');
  const rotationLabelX = document.getElementById('rotation-label-x');
  const rotationLabelY = document.getElementById('rotation-label-y');
  const rotationLabelZ = document.getElementById('rotation-label-z');
  const rotationInputX = document.getElementById('rotation-input-x');
  const rotationInputY = document.getElementById('rotation-input-y');
  const rotationInputZ = document.getElementById('rotation-input-z');
  const rotationInputXGhost = document.getElementById('rotation-input-x-ghost');
  const rotationInputYGhost = document.getElementById('rotation-input-y-ghost');
  const rotationInputZGhost = document.getElementById('rotation-input-z-ghost');
  const rotationInputXMask = document.getElementById('rotation-input-x-mask');
  const rotationInputYMask = document.getElementById('rotation-input-y-mask');
  const rotationInputZMask = document.getElementById('rotation-input-z-mask');
  const rotationApplyBtn = document.getElementById('rotation-apply');
  const rotationSelectionInfo = document.getElementById('rotation-selection-info');
  const movePointCoordinateModeRow = document.getElementById('move-point-coordinate-mode');
  const movePointAxisLegend = document.getElementById('move-point-axis-legend');
  const movePointCoordinateWorldBtn = document.getElementById('move-point-coordinate-world');
  const movePointCoordinateGridBtn = document.getElementById('move-point-coordinate-grid');
  const operationSection = document.getElementById('operation');
  const previewFeature = document.getElementById('preview-feature');
  const previewStartBtn = document.getElementById('preview-start');
  const differencePanel = document.getElementById('difference-panel');
  const differenceShapeSelect = document.getElementById('difference-shape');
  const differencePathSelect = document.getElementById('difference-path');
  const differenceBodySelectButton = document.getElementById('difference-body-select');
  const differenceUnifyButton = document.getElementById('difference-unify-button');
  let differenceViewToggleButton = document.getElementById('difference-view-toggle-button');
  const differenceStatus = document.getElementById('difference-status');
  const constructionCategoryPanel = document.getElementById('construction-category-panel');
  const constructionCategoryCards = Array.from(document.querySelectorAll('[data-construction-profile]'));
  const constructionGenerateButton = document.getElementById('construction-generate-button');
  const constructionCategoryStatus = document.getElementById('construction-category-status');
  const railConstructionPanel = document.getElementById('rail-construction-panel');
  const railConstructionCards = Array.from(document.querySelectorAll('[data-rail-construction-category]'));
  const railConstructionGenerateButton = document.getElementById('rail-construction-generate-button');
  const railConstructionStatus = document.getElementById('rail-construction-status');
  const ghostMeasureCanvas = document.createElement('canvas');
  const ghostMeasureCtx = ghostMeasureCanvas.getContext('2d');

  function alignGhostToInput(inputEl, ghostEl) {
    if (!inputEl || !ghostEl) { return; }
    const cs = window.getComputedStyle(inputEl);
    const padLeft = parseFloat(cs.paddingLeft || '0') || 0;
    const borderLeft = parseFloat(cs.borderLeftWidth || '0') || 0;
    const textIndent = parseFloat(cs.textIndent || '0') || 0;
    ghostEl.style.left = `${padLeft + borderLeft + textIndent}px`;
    ghostEl.style.fontSize = cs.fontSize || '';
    ghostEl.style.fontFamily = cs.fontFamily || '';
    ghostEl.style.lineHeight = cs.lineHeight || '';
  }

  function syncInputMask(inputEl, maskEl) {
    if (!inputEl || !maskEl || !ghostMeasureCtx) { return; }
    const cs = window.getComputedStyle(inputEl);
    const padLeft = parseFloat(cs.paddingLeft || '0') || 0;
    const borderLeft = parseFloat(cs.borderLeftWidth || '0') || 0;
    const textIndent = parseFloat(cs.textIndent || '0') || 0;
    const font = `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize} / ${cs.lineHeight} ${cs.fontFamily}`;
    ghostMeasureCtx.font = font;
    const value = String(inputEl.value ?? '');
    const textWidth = value ? ghostMeasureCtx.measureText(value).width : 0;
    const letterSpacing = parseFloat(cs.letterSpacing || '0');
    const spacingWidth = Number.isFinite(letterSpacing) && value.length > 1
      ? letterSpacing * (value.length - 1)
      : 0;
    const width = Math.max(0, Math.round(textWidth + spacingWidth));
    maskEl.style.left = `${padLeft + borderLeft + textIndent}px`;
    maskEl.style.height = cs.lineHeight && cs.lineHeight !== 'normal' ? cs.lineHeight : cs.fontSize;
    maskEl.style.width = `${width}px`;
  }

  function shouldShowGhostForInput(inputEl, ghostEl) {
    if (!inputEl || !ghostEl) { return false; }
    const rawInput = String(inputEl.value ?? '').trim();
    if (!rawInput) { return true; }
    const hint = String(ghostEl.textContent ?? '').trim();
    if (!hint) { return false; }
    return hint.startsWith(rawInput);
  }

  function applyGhostVisibility(inputEl, ghostEl, maskEl) {
    const visible = shouldShowGhostForInput(inputEl, ghostEl);
    if (ghostEl) {
      ghostEl.style.opacity = visible ? '1' : '0';
    }
    if (maskEl) {
      maskEl.style.opacity = visible ? '1' : '0';
    }
  }

  function syncRotationInputGhostHints() {
    alignGhostToInput(rotationInputX, rotationInputXGhost);
    alignGhostToInput(rotationInputY, rotationInputYGhost);
    alignGhostToInput(rotationInputZ, rotationInputZGhost);
    if (rotationInputXGhost) { rotationInputXGhost.textContent = rotationInputX?.placeholder || ''; }
    if (rotationInputYGhost) { rotationInputYGhost.textContent = rotationInputY?.placeholder || ''; }
    if (rotationInputZGhost) { rotationInputZGhost.textContent = rotationInputZ?.placeholder || ''; }
    syncInputMask(rotationInputX, rotationInputXMask);
    syncInputMask(rotationInputY, rotationInputYMask);
    syncInputMask(rotationInputZ, rotationInputZMask);
    applyGhostVisibility(rotationInputX, rotationInputXGhost, rotationInputXMask);
    applyGhostVisibility(rotationInputY, rotationInputYGhost, rotationInputYMask);
    applyGhostVisibility(rotationInputZ, rotationInputZGhost, rotationInputZMask);
  }

  [
    [rotationInputX, rotationInputXMask],
    [rotationInputY, rotationInputYMask],
    [rotationInputZ, rotationInputZMask],
  ].forEach(([inputEl, maskEl]) => {
    if (!inputEl || !maskEl) { return; }
    const ghostEl = inputEl === rotationInputX
      ? rotationInputXGhost
      : (inputEl === rotationInputY ? rotationInputYGhost : rotationInputZGhost);
    inputEl.addEventListener('input', () => {
      syncInputMask(inputEl, maskEl);
      applyGhostVisibility(inputEl, ghostEl, maskEl);
    });
  });
  let uiHiddenByHotkey = false;
  let panelClampQueued = false;

  function clampPanelToViewport(panel, margin = 12) {
    if (!panel) { return; }
    const style = window.getComputedStyle(panel);
    if (style.display === 'none' || style.visibility === 'hidden') { return; }
    if (style.position !== 'fixed') { return; }

    const maxHeight = Math.max(140, window.innerHeight - (margin * 2));
    panel.style.maxHeight = `${maxHeight}px`;
    panel.style.overflowY = 'auto';

    const rect = panel.getBoundingClientRect();
    let nextTop = rect.top;
    const overflowBottom = rect.bottom - (window.innerHeight - margin);
    if (overflowBottom > 0) {
      nextTop -= overflowBottom;
    }
    if (nextTop < margin) {
      nextTop = margin;
    }
    panel.style.top = `${Math.round(nextTop)}px`;
    if (panel.style.bottom && panel.style.bottom !== 'auto') {
      panel.style.bottom = 'auto';
    }
  }

  function clampUiPanelsToViewport() {
    [
      instructionsPanel,
      rotationPanel,
      differencePanel,
      constructionCategoryPanel,
      railConstructionPanel,
      guideWindow,
    ].forEach((panel) => clampPanelToViewport(panel));
  }

  function scheduleClampUiPanels() {
    if (panelClampQueued) { return; }
    panelClampQueued = true;
    requestAnimationFrame(() => {
      panelClampQueued = false;
      clampUiPanelsToViewport();
    });
  }

  window.addEventListener('resize', scheduleClampUiPanels);

  function setUiVisibleByHotkey(visible) {
    const uiGroup = document.getElementById('UiGroup');
    if (uiGroup) {
      if (visible) {
        uiGroup.style.border = uiGroup.dataset.prevBorderByHotkey ?? '';
        uiGroup.style.borderRadius = uiGroup.dataset.prevBorderRadiusByHotkey ?? '';
        uiGroup.style.background = uiGroup.dataset.prevBackgroundByHotkey ?? '';
        uiGroup.style.backdropFilter = uiGroup.dataset.prevBackdropFilterByHotkey ?? '';
      } else {
        if (uiGroup.dataset.prevBorderByHotkey == null) {
          uiGroup.dataset.prevBorderByHotkey = uiGroup.style.border || '';
          uiGroup.dataset.prevBorderRadiusByHotkey = uiGroup.style.borderRadius || '';
          uiGroup.dataset.prevBackgroundByHotkey = uiGroup.style.background || '';
          uiGroup.dataset.prevBackdropFilterByHotkey = uiGroup.style.backdropFilter || '';
        }
        uiGroup.style.border = 'none';
        uiGroup.style.borderRadius = '0';
        uiGroup.style.background = 'transparent';
        uiGroup.style.backdropFilter = 'none';
      }
    }

    const targets = Array.from(document.querySelectorAll(
      '#speed-up, #speed-down, #btn-up, #btn-down, #controller-area, #controller, #log, #toggle-daynight, #difference-body-select, #UiGroup > button, #frontViewButtons > button, #save-buttons > button, #show-instructions-btn'
    ));
    targets.forEach((el) => {
      if (!el) { return; }
      if (visible) {
        const prev = el.dataset.prevDisplayByHotkey;
        el.style.display = prev != null ? prev : '';
      } else {
        if (el.dataset.prevDisplayByHotkey == null) {
          el.dataset.prevDisplayByHotkey = el.style.display || '';
        }
        el.style.display = 'none';
      }
    });
  }

  let differenceSpaceModeActive = false;
  let differenceShapeType = differenceShapeSelect?.value || 'tube';
  let differencePathType = differencePathSelect?.value || 'smooth';
  let differenceSpaceTransformMode = 'none';
  let differenceBodySelectModeActive = false;
  let movePointPanelActive = false;
  let scalePointPanelActive = false;
  let copyModeActive = false;
  let styleModeActive = false;
  const copySelectedObjects = new Set();
  const styleSelectedObjects = new Set();
  const copyObjectRegistry = new Map();
  let copyObjectRegistrySeq = 1;
  let steelFrameCopyGroupSeq = 1;
  let movePointCoordinateMode = 'world';
  let selectedConstructionProfile = null;
  let selectedRailConstructionCategory = null;
  const manualDioramaSpaceEnabled = ENABLE_MANUAL_DIORAMA_SPACE === true;

  function blockManualDioramaSpaceMode() {
    // Difference は手動ジオラマ空間の有効/無効に依存させない。
    // 既存呼び出し箇所との互換のため関数は残し、常にブロックしない。
    void manualDioramaSpaceEnabled;
    return false;
  }

  function setConstructionCategoryPanelVisible(visible) {
    if (!constructionCategoryPanel) { return; }
    constructionCategoryPanel.style.display = visible ? 'block' : 'none';
  }

  function setConstructionCategory(profile) {
    const next = (profile === 'round'
      || profile === 'h_beam'
      || profile === 't_beam'
      || profile === 'l_beam'
      || profile === 'tubular') ? profile : null;
    selectedConstructionProfile = next;
    constructionCategoryCards.forEach((card) => {
      const isSelected = card.dataset.constructionProfile === next;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
    if (next) {
      steelFrameMode.setSegmentProfile(next);
    }
    const label = next === 'h_beam'
      ? 'H形鋼'
      : (next === 't_beam'
        ? 'T形鋼'
        : (next === 'l_beam'
          ? 'L形鋼'
          : (next === 'tubular' ? 'ライト管' : (next === 'round' ? '丸鋼' : ''))));
    if (constructionCategoryStatus) {
      constructionCategoryStatus.textContent = next
        ? `選択中: ${label}。点を2つ以上選択して「選択カテゴリで生成」。`
        : '選択中: 未選択。カテゴリを選んで「選択カテゴリで生成」。';
    }
  }

  function setRailConstructionPanelVisible(visible) {
    if (!railConstructionPanel) { return; }
    railConstructionPanel.style.display = visible ? 'block' : 'none';
  }

  function setRailConstructionCategory(category) {
    const allow = ['bridge', 'elevated', 'wall', 'floor', 'pillar', 'catenary_pole', 'rib_bridge', 'tunnel_rect'];
    const next = allow.includes(category) ? category : null;
    selectedRailConstructionCategory = next;
    railConstructionCards.forEach((card) => {
      const isSelected = card.dataset.railConstructionCategory === next;
      card.classList.toggle('is-selected', isSelected);
      card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
    if (railConstructionStatus) {
      railConstructionStatus.textContent = next
        ? `選択中: ${next}。ピンを選択して「選択カテゴリで生成」。`
        : '選択中: 未選択。カテゴリを選んで「選択カテゴリで生成」。';
    }
  }

  function getConstructionPinsPayload() {
    return constructionSelectedPins.map((pin) => ({
      x: pin.position.x,
      y: pin.position.y,
      z: pin.position.z,
      trackName: pin.userData?.trackName ?? null,
    }));
  }

  function getBridgeSourcePins() {
    if (Array.isArray(constructionSelectedPins) && constructionSelectedPins.length > 0) {
      return constructionSelectedPins;
    }
    if (Array.isArray(structurePinnedPins) && structurePinnedPins.length > 0) {
      return structurePinnedPins;
    }
    return [];
  }

  function getBridgeDirectionFromSelectedTrackCurves() {
    const trackCurves = getSelectedTrackCurvesForConstruction();
    if (!Array.isArray(trackCurves) || trackCurves.length < 2) {
      return null;
    }
    const dirs = [];
    const sampleT = 0.02;
    trackCurves.forEach((entry) => {
      const curve = entry?.curve;
      if (!curve || typeof curve.getPointAt !== 'function') { return; }
      const p0 = curve.getPointAt(0).clone();
      const p1 = curve.getPointAt(sampleT).clone();
      const dir = p1.sub(p0).setY(0);
      if (dir.lengthSq() <= 1e-8) { return; }
      dir.normalize();
      dirs.push(dir);
    });
    if (dirs.length < 2) { return null; }
    const ref = dirs[0].clone();
    const merged = new THREE.Vector3();
    dirs.forEach((dir) => {
      if (ref.dot(dir) < 0) {
        merged.add(dir.clone().multiplyScalar(-1));
      } else {
        merged.add(dir);
      }
    });
    if (merged.lengthSq() <= 1e-8) { return null; }
    return merged.normalize();
  }

  function getBridgePlacementFromSelectedPins() {
    const sourcePins = getBridgeSourcePins();
    if (sourcePins.length < 1) {
      return null;
    }
    const points = sourcePins.map((pin) => pin.position.clone());
    const center = points.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);

    // 2路線以上のピン選択時は、路線カーブの接線方向平均で橋の向きを決める。
    // それ以外は従来どおり最も離れた2点方向を使用する。
    let dir = getBridgeDirectionFromSelectedTrackCurves();
    if (!dir) {
      let start = points[0];
      let end = points[0];
      let bestDistSq = -1;
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const d = points[i].distanceToSquared(points[j]);
          if (d > bestDistSq) {
            bestDistSq = d;
            start = points[i];
            end = points[j];
          }
        }
      }
      dir = end.clone().sub(start).setY(0);
    }

    const BRIDGE_YAW_OFFSET = Math.PI / 2;
    let rotationY = 1.750662913747207; // fallback
    if (dir.lengthSq() > 1e-8) {
      rotationY = Math.atan2(dir.x, dir.z) + BRIDGE_YAW_OFFSET;
    }
    // アーチ形状のローカル原点が高めにあるため、線路高さに合わせて下方向へ補正。
    center.y -= 24.8;
    return { position: center, rotationY };
  }

  function alignObjectXZCenterToWorldTarget(object3d, targetPosition) {
    if (!object3d || !targetPosition) { return; }
    object3d.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object3d);
    if (box.isEmpty()) { return; }
    const center = box.getCenter(new THREE.Vector3());
    object3d.position.x += (targetPosition.x - center.x);
    object3d.position.z += (targetPosition.z - center.z);
    object3d.updateMatrixWorld(true);
  }

  function runRailConstructionByCategory(category) {
    const kind = ['bridge', 'elevated', 'wall', 'floor', 'pillar', 'catenary_pole', 'rib_bridge', 'tunnel_rect'].includes(category)
      ? category
      : 'bridge';
    const bridgeSourcePins = getBridgeSourcePins();
    const minPins = kind === 'bridge' ? 1 : (kind === 'pillar' ? 1 : 2);
    const activePinCount = kind === 'bridge' ? bridgeSourcePins.length : constructionSelectedPins.length;
    if (activePinCount < minPins) {
      const msg = kind === 'bridge'
        ? 'bridge は最低1つのピン選択が必要です。'
        : kind === 'pillar'
        ? 'pillar は最低1つのピン選択が必要です。'
        : kind === 'catenary_pole'
        ? 'catenary_pole は最低2つのピン選択が必要です。'
        : `${kind} は最低2つのピン選択が必要です。`;
      console.warn(msg);
      if (railConstructionStatus) {
        railConstructionStatus.textContent = msg;
      }
      return false;
    }
    const pins = getConstructionPinsPayload();
    if (kind === 'bridge') {
      const placement = getBridgePlacementFromSelectedPins();
      if (!placement) {
        if (railConstructionStatus) {
          railConstructionStatus.textContent = 'bridge 生成に必要なピンがありません。';
        }
        return false;
      }
      const bridgeObj = TSys.createDefaultArchBridge({
        position: placement.position,
        rotationY: placement.rotationY,
        addToScene: true,
        castShadow: true,
        receiveShadow: true,
      });
      // 橋モデルのローカル原点が端寄りのため、生成後に実形状中心をピン中心へ合わせる。
      alignObjectXZCenterToWorldTarget(bridgeObj, placement.position);
    } else if (kind === 'pillar') {
      logPillarSideJudgement();
      TSys.buildStructureFromPins('pillar', pins, railTrackCurveMap, {
        baseInterval: 8,
        avoidRadius: 0.7,
        searchRadius: 3,
        samplePrecision: 0.1,
        maxOffset: 3,
        baseOffset: 0,
        offsetStep: 0.2,
      });
    } else if (kind === 'catenary_pole') {
      TSys.buildStructureFromPins('catenary_pole', pins, railTrackCurveMap, {
        interval: 14,
        leftHeight: 3.2,
        rightHeight: 3.2,
        beamLength: 2.6,
        beamHeight: 3.2,
        yOffset: 0,
        yawOffset: 0,
      });
    } else if (kind === 'rib_bridge') {
      const edges = getEdgeTrackNamesForConstruction(0.5);
      TSys.buildStructureFromPins('rib_bridge', pins, railTrackCurveMap, {
        edgeTrackNames: { right: edges.right, left: edges.left },
      });
    } else if (kind === 'tunnel_rect') {
      TSys.buildStructureFromPins('tunnel_rect', pins, railTrackCurveMap, {
        innerWidth: 1.7,
        innerHeight: 2,
        wallThickness: 0.15,
        segmentSpacing: 1.2,
        yOffset: -0.1,
        color: 0x8b8f94,
      });
    } else {
      TSys.buildStructureFromPins(kind, pins, railTrackCurveMap);
    }
    if (railConstructionStatus) {
      railConstructionStatus.textContent = `生成完了: ${kind} / pins=${pins.length}`;
    }
    return true;
  }

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
  if (differenceUnifyButton) {
    differenceUnifyButton.addEventListener('click', () => {
      runHighQualityDifferenceUnify();
    });
  }
  if (!differenceViewToggleButton && differenceUnifyButton?.parentElement) {
    differenceViewToggleButton = document.createElement('button');
    differenceViewToggleButton.id = 'difference-view-toggle-button';
    differenceViewToggleButton.type = 'button';
    differenceViewToggleButton.style.marginTop = '6px';
    differenceViewToggleButton.style.width = '100%';
    differenceViewToggleButton.style.padding = '6px 8px';
    differenceViewToggleButton.style.display = 'none';
    differenceViewToggleButton.textContent = 'view[diff]';
    differenceUnifyButton.insertAdjacentElement('afterend', differenceViewToggleButton);
  }
  if (differenceViewToggleButton) {
    differenceViewToggleButton.addEventListener('click', () => {
      differenceViewMode = differenceViewMode === 'preview' ? 'diff' : 'preview';
      if (typeof applyDifferenceViewMode === 'function') {
        applyDifferenceViewMode();
      }
      if (differenceStatus) {
        differenceStatus.textContent = differenceViewMode === 'preview'
          ? 'view[preview]: 黄を表示 / 橙を削除 / 赤を非表示'
          : 'view[diff]: 黄・橙・赤の判定表示';
      }
    });
  }
  if (differenceBodySelectButton) {
    setDifferenceBodySelectButtonState(false);
    differenceBodySelectButton.addEventListener('click', () => {
      const nextActive = !differenceBodySelectModeActive;
      UIevent('body_select', nextActive ? 'active' : 'inactive');
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

  function setRotationPanelMode(mode = 'rotation') {
    const isMovePoint = mode === 'move_point';
    const isScalePoint = mode === 'scale_point';
    const isMovePointRotation = mode === 'move_point_rotation';
    const isDecorationRotation = mode === 'rotation_decoration';
    const isCopyMode = mode === 'copy_mode';
    const isStyleMode = mode === 'style_mode';
    if (rotationPanelTitle) {
      rotationPanelTitle.textContent = isMovePoint
        ? 'Move Point'
        : (isScalePoint
          ? 'Scale Point'
          : (isMovePointRotation
            ? 'Point Rotate'
            : (isDecorationRotation ? 'Decoration Rotate' : (isCopyMode ? 'Copy' : (isStyleMode ? 'Style' : 'Rotation')))));
    }
    const axisSuffix = isMovePoint
      ? (movePointCoordinateMode === 'grid' ? ' (grid)' : ' (world)')
      : isScalePoint
      ? ' (scale)'
      : ' (deg)';
    if (rotationLabelX) {
      rotationLabelX.childNodes[0].nodeValue = isStyleMode ? '横梁 幅' : (isCopyMode ? 'Offset X' : `X${axisSuffix}`);
    }
    if (rotationLabelY) {
      rotationLabelY.childNodes[0].nodeValue = isStyleMode ? '縦梁 高さ' : (isCopyMode ? 'Offset Y' : `Y${axisSuffix}`);
    }
    if (rotationLabelZ) {
      rotationLabelZ.childNodes[0].nodeValue = isStyleMode
        ? '梁 厚み'
        : (isMovePointRotation
          ? 'Len'
          : (isDecorationRotation ? `Z${axisSuffix}` : (isCopyMode ? 'Offset Y2' : `Y2${axisSuffix}`)));
    }
    if (rotationApplyBtn) {
      rotationApplyBtn.textContent = isStyleMode
        ? 'スタイル適用'
        : (isCopyMode ? 'コピー実行' : (isMovePoint ? '座標適用' : (isScalePoint ? 'スケール適用' : '適用')));
    }
    if (movePointCoordinateModeRow) {
      movePointCoordinateModeRow.style.display = (isMovePoint || isScalePoint) ? 'block' : 'none';
    }
    if (movePointAxisLegend) {
      movePointAxisLegend.style.display = (isMovePoint || isScalePoint) ? 'block' : 'none';
    }
    syncRotationInputGhostHints();
  }

  function setCopyObjectVisual(mesh, selected) {
    if (!mesh) { return; }
    const paintRecursive = (obj, colorHex) => {
      const paintMaterial = (mat) => mat?.color?.set?.(colorHex);
      if (Array.isArray(obj?.material)) {
        obj.material.forEach((mat) => paintMaterial(mat));
      } else {
        paintMaterial(obj?.material);
      }
      obj?.traverse?.((node) => {
        if (node === obj) { return; }
        if (Array.isArray(node?.material)) {
          node.material.forEach((mat) => paintMaterial(mat));
        } else {
          paintMaterial(node?.material);
        }
      });
    };
    if (mesh?.userData?.steelFrameCopiedObject) {
      paintRecursive(mesh, 0xffd400);
      return;
    }
    if (selected) {
      paintRecursive(mesh, 0x3f7bff);
      return;
    }
    paintRecursive(mesh, mesh?.userData?.baseColor || 0x8a8f98);
  }

  function clearCopySelection() {
    copySelectedObjects.forEach((mesh) => setCopyObjectVisual(mesh, false));
    copySelectedObjects.clear();
    steelFrameMode?.clearSelection?.();
  }

  function clearStyleSelection() {
    styleSelectedObjects.forEach((mesh) => setCopyObjectVisual(mesh, false));
    styleSelectedObjects.clear();
  }

  function ensureCopyObjectRefId(mesh) {
    if (!mesh) { return null; }
    const current = mesh?.userData?.copyObjectRefId;
    if (current) { return current; }
    const next = `copy_obj_${copyObjectRegistrySeq}`;
    copyObjectRegistrySeq += 1;
    mesh.userData = {
      ...(mesh.userData || {}),
      copyObjectRefId: next,
    };
    return next;
  }

  function registerCopyObject(mesh) {
    if (!mesh || mesh?.name !== 'SteelFrameSegment') { return null; }
    const refId = ensureCopyObjectRefId(mesh);
    if (!refId) { return null; }
    copyObjectRegistry.set(refId, mesh);
    return refId;
  }

  function unregisterCopyObject(mesh) {
    const refId = mesh?.userData?.copyObjectRefId;
    if (!refId) { return false; }
    return copyObjectRegistry.delete(refId);
  }

  function resolveCopySourceObject(mesh) {
    if (!mesh) { return null; }
    const refId = mesh?.userData?.copyObjectRefId;
    if (!refId) { return mesh; }
    const registered = copyObjectRegistry.get(refId);
    if (registered === mesh) { return mesh; }
    if (registered?.parent) { return registered; }
    copyObjectRegistry.set(refId, mesh);
    return mesh;
  }

  function clearCopiedStateFromSegmentsByPoints(points) {
    const pointSet = new Set(
      (Array.isArray(points) ? points : []).filter((mesh) => mesh?.userData?.steelFramePoint)
    );
    if (pointSet.size < 1) { return; }
    scene.traverse((obj) => {
      if (!obj?.parent) { return; }
      if (obj?.name !== 'SteelFrameSegment') { return; }
      if (obj?.userData?.steelFramePoint) { return; }
      const refs = Array.isArray(obj?.userData?.steelFrameSegmentPointRefs)
        ? obj.userData.steelFrameSegmentPointRefs
        : [];
      const belongsToDetachedPoints = refs.some((pointMesh) => pointSet.has(pointMesh));
      if (!belongsToDetachedPoints) { return; }
      obj.userData = {
        ...(obj.userData || {}),
        steelFrameCopiedObject: false,
        steelFrameCopyGroupId: null,
      };
      if (copySelectedObjects.has(obj)) {
        copySelectedObjects.delete(obj);
      }
      setCopyObjectVisual(obj, false);
    });
  }

  function getConstructionCopyTargets() {
    const out = [];
    scene.traverse((obj) => {
      if (!obj?.parent) { return; }
      if (obj?.name !== 'SteelFrameSegment') { return; }
      if (obj?.userData?.steelFramePoint) { return; }
      registerCopyObject(obj);
      out.push(obj);
    });
    return out;
  }

  function resolveCopySelectableFromHit(mesh) {
    if (!mesh) { return null; }
    if (mesh?.userData?.steelFramePoint) { return mesh; }
    let cur = mesh;
    while (cur) {
      if (cur?.name === 'SteelFrameSegment' && !cur?.userData?.steelFramePoint) {
        return cur;
      }
      cur = cur.parent || null;
    }
    return null;
  }

  function resolveSelectableHitObject(mesh) {
    let decoRoot = mesh?.userData?.decorationRoot || null;
    if (!decoRoot) {
      let cur = mesh;
      while (cur) {
        if (cur?.userData?.decorationType) {
          decoRoot = cur;
          break;
        }
        cur = cur.parent || null;
      }
    }
    decoRoot = decoRoot || mesh;
    const inConstructionObjectSelectMode = (copyModeActive && objectEditMode === 'COPY')
      || (styleModeActive && objectEditMode === 'STYLE');
    if (!inConstructionObjectSelectMode) {
      return decoRoot;
    }
    return resolveCopySelectableFromHit(decoRoot) || decoRoot;
  }

  function isCopySelectableMesh(mesh) {
    return Boolean(resolveCopySelectableFromHit(mesh));
  }

  function isStyleSelectableMesh(mesh) {
    const target = resolveCopySelectableFromHit(mesh);
    if (!target || target?.userData?.steelFramePoint) { return false; }
    return target?.name === 'SteelFrameSegment';
  }

  function toggleCopySelection(mesh) {
    const target = resolveCopySelectableFromHit(mesh);
    if (!target) { return false; }
    if (target.userData?.steelFramePoint) {
      return steelFrameMode.toggleSelectedPoint(target);
    }
    if (copySelectedObjects.has(target)) {
      copySelectedObjects.delete(target);
      setCopyObjectVisual(target, false);
      return false;
    }
    copySelectedObjects.add(target);
    setCopyObjectVisual(target, true);
    return true;
  }

  function toggleStyleSelection(mesh) {
    const target = resolveCopySelectableFromHit(mesh);
    if (!target || target?.userData?.steelFramePoint || target?.name !== 'SteelFrameSegment') { return false; }
    if (styleSelectedObjects.has(target)) {
      styleSelectedObjects.delete(target);
      setCopyObjectVisual(target, false);
      return false;
    }
    if (target?.userData?.steelFrameCopiedObject) {
      const ok = window.confirm('コピーされた構築物のスタイルを変更しますか？');
      if (!ok) { return false; }
    }
    styleSelectedObjects.add(target);
    setCopyObjectVisual(target, true);
    return true;
  }

  function updateStylePanelUI({ clearInputs = false } = {}) {
    if (!styleModeActive) { return; }
    setRotationPanelMode('style_mode');
    setRotationPanelVisible(true);
    const selected = Array.from(styleSelectedObjects).filter((mesh) => mesh?.parent);
    const first = selected[0] || null;
    const style = steelFrameMode?.getSegmentStyle?.(first) || null;
    if (rotationInputX) {
      if (clearInputs) { rotationInputX.value = ''; }
      rotationInputX.placeholder = style ? String(Number(style.beamWidthHorizontal).toFixed(3)) : '0.280';
    }
    if (rotationInputY) {
      if (clearInputs) { rotationInputY.value = ''; }
      rotationInputY.placeholder = style ? String(Number(style.beamHeightVertical).toFixed(3)) : '0.280';
    }
    if (rotationInputZ) {
      if (clearInputs) { rotationInputZ.value = ''; }
      rotationInputZ.placeholder = style ? String(Number(style.beamThickness).toFixed(3)) : '0.070';
    }
    if (rotationSelectionInfo) {
      rotationSelectionInfo.textContent = [
        `選択構造物: ${selected.length}`,
        '対象: H/T/L beam',
        'X: 横梁 幅',
        'Y: 縦梁 高さ',
        'Z: 梁 厚み',
        '※ コピー物は適用前に確認ダイアログを表示',
      ].join('\n');
    }
    syncRotationInputGhostHints();
  }

  function applyStyleFromPanel() {
    if (!styleModeActive) { return; }
    const targets = Array.from(styleSelectedObjects).filter((mesh) => mesh?.parent && mesh?.name === 'SteelFrameSegment');
    if (targets.length < 1) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '構造物が未選択です。beamを選択してください。';
      }
      return;
    }
    const parseOrUndefined = (raw) => {
      const text = String(raw ?? '').trim();
      if (!text) { return undefined; }
      const n = Number(text);
      if (!Number.isFinite(n) || n <= 0) { return null; }
      return n;
    };
    const x = parseOrUndefined(rotationInputX?.value);
    const y = parseOrUndefined(rotationInputY?.value);
    const z = parseOrUndefined(rotationInputZ?.value);
    if (x === null || y === null || z === null) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '入力は正の数値のみ有効です。';
      }
      return;
    }
    if (x === undefined && y === undefined && z === undefined) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '入力が空です。変更値を入力してください。';
      }
      return;
    }
    const stylePatch = {};
    if (x !== undefined) { stylePatch.beamWidthHorizontal = x; }
    if (y !== undefined) { stylePatch.beamHeightVertical = y; }
    if (z !== undefined) { stylePatch.beamThickness = z; }
    const result = steelFrameMode?.applySegmentStyle?.(targets, stylePatch);
    if (!result || result.rebuilt < 1) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '適用対象がありません（H/T/L beamを選択してください）。';
      }
      return;
    }
    if (Array.isArray(result?.meshes) && result.meshes.length > 0) {
      clearStyleSelection();
      result.meshes.forEach((mesh) => {
        if (!mesh?.parent) { return; }
        styleSelectedObjects.add(mesh);
        setCopyObjectVisual(mesh, true);
      });
      if (choice_object && !choice_object.parent) {
        choice_object = result.meshes[0] || false;
      }
    }
    refreshCreateTargetsForSearch();
    updateStylePanelUI({ clearInputs: true });
  }

  function parseCopyOffsetInput(raw, fallback = 0) {
    const text = String(raw ?? '').trim();
    if (!text) { return fallback; }
    const n = parseFloat(text);
    if (!Number.isFinite(n)) { return null; }
    return n;
  }

  function updateCopyPanelUI({ clearInputs = false } = {}) {
    if (!copyModeActive) { return; }
    setRotationPanelMode('copy_mode');
    setRotationPanelVisible(true);
    if (rotationInputX) {
      if (clearInputs) { rotationInputX.value = ''; }
      rotationInputX.placeholder = '0.600';
    }
    if (rotationInputY) {
      if (clearInputs) { rotationInputY.value = ''; }
      rotationInputY.placeholder = '0.000';
    }
    if (rotationInputZ) {
      if (clearInputs) { rotationInputZ.value = ''; }
      rotationInputZ.placeholder = '0.600';
    }
    if (rotationSelectionInfo) {
      const pointCount = steelFrameMode?.getSelectedPointMeshes?.()?.length || 0;
      const objectCount = copySelectedObjects.size;
      rotationSelectionInfo.textContent = [
        `選択点: ${pointCount}`,
        `選択オブジェクト: ${objectCount}`,
        '点 または construction物体 をクリックして選択',
        '適用でまとめてコピー',
        'Offset X/Y/Z は複製位置のずらし量',
      ].join('\n');
    }
    syncRotationInputGhostHints();
  }

  function cloneLedBoardDecoration(source, offset) {
    const cloned = createLedBoardDecoration(source.position.clone().add(offset));
    cloned.quaternion.copy(source.quaternion);
    cloned.scale.copy(source.scale);
    const srcData = source?.userData?.ledBoardData || {};
    cloned.userData = {
      ...(cloned.userData || {}),
      planeRef: source?.userData?.planeRef || null,
      ledBoardData: {
        topLeft: String(srcData.topLeft || ''),
        topRight: String(srcData.topRight || ''),
        line1: String(srcData.line1 || ''),
        line2: String(srcData.line2 || ''),
        line3: String(srcData.line3 || ''),
      },
    };
    renderLedBoardTexture(cloned);
    return cloned;
  }

  function runCopySelectionFromPanel() {
    if (!copyModeActive || editObject !== 'STEEL_FRAME') { return; }
    const dx = parseCopyOffsetInput(rotationInputX?.value ?? '', 0.6);
    const dy = parseCopyOffsetInput(rotationInputY?.value ?? '', 0.0);
    const dz = parseCopyOffsetInput(rotationInputZ?.value ?? '', 0.6);
    if (dx === null || dy === null || dz === null) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = 'Offset入力が不正です。数値で入力してください。';
      }
      return;
    }
    const offset = new THREE.Vector3(dx, dy, dz);
    const srcPoints = steelFrameMode?.getSelectedPointMeshes?.()?.filter((mesh) => mesh?.userData?.steelFramePoint) || [];
    const srcObjects = Array.from(copySelectedObjects)
      .map((mesh) => resolveCopySourceObject(mesh))
      .filter((mesh) => mesh?.parent);
    const copiedObjectGroupId = srcObjects.length > 0 ? allocateSteelFrameCopyGroupId() : null;
    if (srcPoints.length < 1 && srcObjects.length < 1) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = 'コピー対象がありません。点またはオブジェクトを選択してください。';
      }
      return;
    }

    const pointItems = [];
    const sourceToCopiedPoint = new Map();

    const paintPointColor = (mesh, colorHex) => {
      if (!mesh?.material) { return; }
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat?.color?.setHex?.(colorHex));
        return;
      }
      if (mesh.material.color?.setHex) {
        mesh.material.color.setHex(colorHex);
      }
    };

    const ensureCopiedPoint = (src, { forceYellow = false, copyGroupId = null } = {}) => {
      if (!src?.userData?.steelFramePoint) { return null; }
      const existing = sourceToCopiedPoint.get(src);
      if (existing) {
        if (forceYellow && !existing.userData?.steelFrameCopied) {
          existing.userData = {
            ...(existing.userData || {}),
            steelFrameCopied: true,
          };
          paintPointColor(existing, 0xffd400);
        }
        return existing;
      }
      const lineIndex = Number.isInteger(src?.userData?.steelFrameLine) ? src.userData.steelFrameLine : 0;
      const mesh = new THREE.Mesh(cube_geometry, cube_material.clone());
      mesh.position.copy(src.position).add(offset);
      mesh.scale.copy(src.scale);
        mesh.userData = {
          ...(src.userData || {}),
          steelFramePoint: true,
          steelFrameLine: lineIndex,
          steelFrameCopied: forceYellow || Boolean(src?.userData?.steelFrameCopied),
          steelFrameCopyGroupId: copyGroupId || src?.userData?.steelFrameCopyGroupId || null,
        };
      delete mesh.userData.guideCurve;
      delete mesh.userData.guideControlIndex;
      steelFrameMode.addExistingPoint(mesh, lineIndex);
      pointItems.push({ mesh, lineIndex });
      if (mesh.userData?.steelFrameCopied) {
        paintPointColor(mesh, 0xffd400);
      }
      sourceToCopiedPoint.set(src, mesh);
      return mesh;
    };

    srcPoints.forEach((src) => {
      ensureCopiedPoint(src, { forceYellow: false });
    });

    const objectItems = [];
    srcObjects.forEach((src) => {
      let cloned = null;
      if (src?.clone) {
        const srcPointRefs = Array.isArray(src?.userData?.steelFrameSegmentPointRefs)
          ? src.userData.steelFrameSegmentPointRefs
          : [];
        const copiedPointRefs = srcPointRefs
          .map((pointMesh) => ensureCopiedPoint(pointMesh, { forceYellow: true, copyGroupId: copiedObjectGroupId }))
          .filter((pointMesh) => Boolean(pointMesh?.userData?.steelFramePoint));
        cloned = src.clone(true);
        cloned.position.copy(src.position).add(offset);
        cloned.traverse?.((node) => {
          if (node?.material?.clone) {
            node.material = node.material.clone();
          }
        });
        const sourceRefId = ensureCopyObjectRefId(src);
        cloned.userData = {
          ...(src.userData || {}),
          steelFrameSegmentPointRefs: copiedPointRefs,
          steelFrameCopyGroupId: copiedObjectGroupId || src?.userData?.steelFrameCopyGroupId || null,
          steelFrameCopiedObject: true,
          copyObjectSourceRefId: sourceRefId || null,
        };
      }
      if (!cloned) { return; }
      scene.add(cloned);
      if (cloned?.userData?.steelFrameCopiedObject) {
        setCopyObjectVisual(cloned, false);
      }
      if (cloned?.name === 'SteelFrameSegment') {
        registerCopyObject(cloned);
        steelFrameMode?.addExistingSegmentMesh?.(cloned);
      }
      objectItems.push(cloned);
    });

    if (pointItems.length > 0 || objectItems.length > 0) {
      pushCreateHistory({
        type: 'copy_items',
        pointItems,
        objectItems,
      });
      refreshCreateTargetsForSearch();
      drawingObject(pointItems.map((item) => item.mesh));
      updateCopyPanelUI({ clearInputs: true });
    }
  }

  function updateMovePointCoordinateButtons() {
    if (!movePointCoordinateWorldBtn || !movePointCoordinateGridBtn) { return; }
    const isWorld = movePointCoordinateMode === 'world';
    movePointCoordinateWorldBtn.style.background = isWorld ? '#b9d5ff' : '#eaf2ff';
    movePointCoordinateWorldBtn.style.borderColor = isWorld ? '#6f95cf' : '#9eb7db';
    movePointCoordinateGridBtn.style.background = isWorld ? '#eefcf3' : '#bfe9ca';
    movePointCoordinateGridBtn.style.borderColor = isWorld ? '#b8d7c0' : '#6ea984';
  }

  function setMovePointCoordinateMode(mode = 'world', { refresh = true } = {}) {
    const next = mode === 'grid' ? 'grid' : 'world';
    movePointCoordinateMode = next;
    updateMovePointCoordinateButtons();
    if (movePointPanelActive || scalePointPanelActive) {
      setRotationPanelMode(movePointPanelActive ? 'move_point' : 'scale_point');
      if (refresh) {
        if (movePointPanelActive) {
          updateMovePointPanelUI({ clearInputs: true });
        } else if (scalePointPanelActive) {
          updateScalePointPanelUI({ clearInputs: true });
        }
      }
    }
  }

  function setRotationPanelVisible(visible) {
    if (!rotationPanel) { return; }
    rotationPanel.style.display = visible ? 'block' : 'none';
    if (visible) {
      scheduleClampUiPanels();
    }
    if (visible) {
      syncRotationInputGhostHints();
    }
  }

  function setDifferenceBodySelectButtonState(active) {
    if (!differenceBodySelectButton) { return; }
    differenceBodySelectButton.style.background = active ? '#2b4f8a' : '';
    differenceBodySelectButton.style.color = active ? '#ffffff' : '';
  }

  function getMovePointPanelTargets() {
    if (objectEditMode !== 'MOVE_EXISTING' && objectEditMode !== 'CONSTRUCT') {
      return [];
    }
    if (editObject === 'STEEL_FRAME') {
      const selected = steelFrameMode?.getSelectedPointMeshes?.() || [];
      if (selected.length > 0) {
        return selected.filter((mesh) => Boolean(mesh?.userData?.steelFramePoint));
      }
      if (choice_object?.userData?.steelFramePoint) {
        return [choice_object];
      }
      return [];
    }
    if (editObject === 'DIFFERENCE_SPACE'
      && (differenceSpaceTransformMode === 'scale' || differenceSpaceTransformMode === 'rotation')) {
      const selectedDiffPoints = getDifferenceSelectedPointsForTransform();
      if (selectedDiffPoints.length > 0) {
        return selectedDiffPoints;
      }
    }
    return [];
  }

  function parseMovePointAxisInput(raw) {
    const text = String(raw ?? '').trim();
    if (!text) { return null; }
    const delta = text.match(/^\+=\s*([+-]?(?:\d+\.?\d*|\.\d+))$/);
    if (delta) {
      return { mode: 'delta', value: parseFloat(delta[1]) };
    }
    const absolute = text.match(/^[+-]?(?:\d+\.?\d*|\.\d+)$/);
    if (absolute) {
      return { mode: 'absolute', value: parseFloat(text) };
    }
    return { mode: 'invalid', raw: text };
  }

  function allocateSteelFrameCopyGroupId() {
    const id = `steel_copy_group_${steelFrameCopyGroupSeq}`;
    steelFrameCopyGroupSeq += 1;
    return id;
  }

  function ensureCopiedGroupReadyForPointEdit(targets) {
    if (editObject !== 'STEEL_FRAME') { return targets; }
    if (!Array.isArray(targets) || targets.length < 1) { return targets; }
    const selectedPoints = targets.filter((mesh) => mesh?.userData?.steelFramePoint);
    if (selectedPoints.length < 1) { return targets; }

    const selectedByGroup = new Map();
    selectedPoints.forEach((mesh) => {
      const groupId = mesh?.userData?.steelFrameCopyGroupId;
      if (!groupId) { return; }
      if (!selectedByGroup.has(groupId)) {
        selectedByGroup.set(groupId, []);
      }
      selectedByGroup.get(groupId).push(mesh);
    });
    if (selectedByGroup.size < 1) { return targets; }

    const allPoints = steelFrameMode?.getAllPointMeshes?.()?.filter((mesh) => mesh?.userData?.steelFramePoint) || [];
    const allByGroup = new Map();
    allPoints.forEach((mesh) => {
      const groupId = mesh?.userData?.steelFrameCopyGroupId;
      if (!groupId || !selectedByGroup.has(groupId)) { return; }
      if (!allByGroup.has(groupId)) {
        allByGroup.set(groupId, []);
      }
      allByGroup.get(groupId).push(mesh);
    });

    const partialGroups = [];
    selectedByGroup.forEach((picked, groupId) => {
      const all = allByGroup.get(groupId) || [];
      if (all.length > 0 && picked.length < all.length) {
        partialGroups.push({ groupId, picked, all });
      }
    });
    if (partialGroups.length < 1) { return targets; }

    const yesDetach = window.confirm('複製されたオブジェクトを独立させますか？\nOK=はい / キャンセル=いいえ');
    if (yesDetach) {
      partialGroups.forEach(({ picked }) => {
        picked.forEach((mesh) => {
          mesh.userData = {
            ...(mesh.userData || {}),
            steelFrameCopied: false,
            steelFrameCopyGroupId: null,
          };
          steelFrameMode?.restorePointColor?.(mesh);
        });
        clearCopiedStateFromSegmentsByPoints(picked);
      });
      return targets;
    }

    const partialGroupIds = new Set(partialGroups.map((entry) => entry.groupId));
    const preserved = selectedPoints.filter((mesh) => !partialGroupIds.has(mesh?.userData?.steelFrameCopyGroupId));
    const expanded = [...preserved];
    partialGroups.forEach(({ all }) => {
      all.forEach((mesh) => {
        if (!expanded.includes(mesh)) {
          expanded.push(mesh);
        }
      });
    });

    steelFrameMode?.clearSelection?.();
    expanded.forEach((mesh) => {
      steelFrameMode?.appendSelectedPoint?.(mesh);
    });
    refreshPointEditPanelUI({ clearInputs: true });
    return steelFrameMode?.getSelectedPointMeshes?.()?.filter((mesh) => mesh?.userData?.steelFramePoint) || expanded;
  }

  function getMovePointGridFrameForMesh(mesh) {
    const planeRef = mesh?.userData?.planeRef;
    if (!planeRef?.quaternion?.isQuaternion) {
      return null;
    }
    const anchor = planeRef?.position ? planeRef.position.clone() : new THREE.Vector3(0, 0, 0);
    const quat = planeRef.quaternion.clone().normalize();
    return { anchor, quat };
  }

  function worldToGridPosition(worldPos, frame) {
    return worldPos.clone().sub(frame.anchor).applyQuaternion(frame.quat.clone().invert());
  }

  function gridToWorldPosition(gridPos, frame) {
    return gridPos.clone().applyQuaternion(frame.quat).add(frame.anchor);
  }

  function getMovePointAxisPosition(mesh, mode = 'world') {
    if (mode !== 'grid') {
      return mesh.position.clone();
    }
    const frame = getMovePointGridFrameForMesh(mesh);
    if (!frame) {
      return mesh.position.clone();
    }
    return worldToGridPosition(mesh.position, frame);
  }

  function getAxisDisplayForTargets(targets, axis) {
    if (!Array.isArray(targets) || targets.length === 0) { return '-'; }
    if (targets.length === 1) {
      const pos = getMovePointAxisPosition(targets[0], movePointCoordinateMode);
      return Number(pos[axis]).toFixed(3);
    }
    return 'each';
  }

  function updateMovePointPanelUI({ clearInputs = false } = {}) {
    if (!movePointPanelActive) { return; }
    setRotationPanelMode('move_point');
    setRotationPanelVisible(true);
    const targets = getMovePointPanelTargets();

    const xDisplay = getAxisDisplayForTargets(targets, 'x');
    const yDisplay = getAxisDisplayForTargets(targets, 'y');
    const zDisplay = getAxisDisplayForTargets(targets, 'z');
    if (rotationInputX) {
      if (clearInputs) { rotationInputX.value = ''; }
      rotationInputX.placeholder = xDisplay;
    }
    if (rotationInputY) {
      if (clearInputs) { rotationInputY.value = ''; }
      rotationInputY.placeholder = yDisplay;
    }
    if (rotationInputZ) {
      if (clearInputs) { rotationInputZ.value = ''; }
      rotationInputZ.placeholder = zDisplay;
    }

    if (rotationSelectionInfo) {
      if (targets.length === 0) {
        rotationSelectionInfo.textContent = '選択点: なし\n点をクリックで選択してください。';
      } else if (targets.length === 1) {
        const p = getMovePointAxisPosition(targets[0], movePointCoordinateMode);
        const coordModeLabel = movePointCoordinateMode === 'grid' ? 'Grid' : 'World';
        rotationSelectionInfo.textContent = [
          '選択点: 1',
          `座標系: ${coordModeLabel}`,
          `id: ${targets[0].id}`,
          `x: ${p.x.toFixed(3)}`,
          `y: ${p.y.toFixed(3)}`,
          `z: ${p.z.toFixed(3)}`,
          '入力: 数値=絶対座標 / +=数値=相対移動',
        ].join('\n');
      } else {
        const coordModeLabel = movePointCoordinateMode === 'grid' ? 'Grid' : 'World';
        rotationSelectionInfo.textContent = [
          `選択点: ${targets.length}`,
          `座標系: ${coordModeLabel}`,
          `x: ${xDisplay}`,
          `y: ${yDisplay}`,
          `z: ${zDisplay}`,
          'グループ入力:',
          '数値 -> その軸を全点に一律適用',
          '+=数値 -> 各点の現在値から加算',
        ].join('\n');
      }
    }
    syncRotationInputGhostHints();
  }

  function refreshPointEditPanelUI({ clearInputs = false } = {}) {
    if (scalePointPanelActive) {
      updateScalePointPanelUI({ clearInputs });
      return;
    }
    updateMovePointPanelUI({ clearInputs });
  }

  function getCenterDisplayForTargets(targets) {
    if (!Array.isArray(targets) || targets.length < 1) { return null; }
    const center = new THREE.Vector3();
    targets.forEach((mesh) => {
      center.add(getMovePointAxisPosition(mesh, movePointCoordinateMode));
    });
    center.multiplyScalar(1 / targets.length);
    return center;
  }

  function parseScaleAxisInput(raw) {
    const text = String(raw ?? '').trim();
    if (!text) { return null; }
    const mul = text.match(/^\*=\s*([+-]?(?:\d+\.?\d*|\.\d+))$/);
    if (mul) {
      return { mode: 'factor', value: parseFloat(mul[1]) };
    }
    const absolute = text.match(/^[+-]?(?:\d+\.?\d*|\.\d+)$/);
    if (absolute) {
      return { mode: 'factor', value: parseFloat(text) };
    }
    return { mode: 'invalid', raw: text };
  }

  function updateScalePointPanelUI({ clearInputs = false } = {}) {
    if (!scalePointPanelActive) { return; }
    setRotationPanelMode('scale_point');
    setRotationPanelVisible(true);
    const targets = getMovePointPanelTargets();

    if (rotationInputX) {
      if (clearInputs) { rotationInputX.value = ''; }
      rotationInputX.placeholder = '1.000';
    }
    if (rotationInputY) {
      if (clearInputs) { rotationInputY.value = ''; }
      rotationInputY.placeholder = '1.000';
    }
    if (rotationInputZ) {
      if (clearInputs) { rotationInputZ.value = ''; }
      rotationInputZ.placeholder = '1.000';
    }

    if (rotationSelectionInfo) {
      if (targets.length < 1) {
        rotationSelectionInfo.textContent = '選択点: なし\n点をクリックで選択してください。';
      } else {
        const coordModeLabel = movePointCoordinateMode === 'grid' ? 'Grid' : 'World';
        const center = getCenterDisplayForTargets(targets);
        rotationSelectionInfo.textContent = [
          `選択点: ${targets.length}`,
          `座標系: ${coordModeLabel}`,
          center ? `center x:${center.x.toFixed(3)} y:${center.y.toFixed(3)} z:${center.z.toFixed(3)}` : 'center: -',
          'リング(X/Y)で矢印方向を回転',
          '矢印をドラッグでその方向にスケール',
          'パネル入力も併用可 (1.2 / *=1.2)',
        ].join('\n');
      }
    }
    syncRotationInputGhostHints();
  }

  function applyScalePointFromPanel() {
    const targets = ensureCopiedGroupReadyForPointEdit(getMovePointPanelTargets());
    if (targets.length < 1) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '選択点がありません。点をクリックで選択してください。';
      }
      return;
    }

    const inputX = parseScaleAxisInput(rotationInputX?.value ?? '');
    const inputY = parseScaleAxisInput(rotationInputY?.value ?? '');
    const inputZ = parseScaleAxisInput(rotationInputZ?.value ?? '');
    const inputs = { x: inputX, y: inputY, z: inputZ };
    const invalidAxis = Object.entries(inputs).find(([, parsed]) => parsed?.mode === 'invalid');
    if (invalidAxis) {
      const axis = invalidAxis[0].toUpperCase();
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = `${axis} の入力が不正です。1.2 または *=1.2 を入力してください。`;
      }
      return;
    }
    if (!inputX && !inputY && !inputZ) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '入力が空です。1.2 などの倍率を入力してください。';
      }
      return;
    }

    const sx = inputX ? inputX.value : 1;
    const sy = inputY ? inputY.value : 1;
    const sz = inputZ ? inputZ.value : 1;
    if (![sx, sy, sz].every((v) => Number.isFinite(v))) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '倍率に数値を入力してください。';
      }
      return;
    }

    const differenceContext = (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'scale');
    const workItems = targets.map((mesh) => {
      const frame = getMovePointGridFrameForMesh(mesh);
      const posWorld = getScaleTargetWorldPosition(mesh);
      const useGridFrame = !differenceContext && movePointCoordinateMode === 'grid' && Boolean(frame);
      const pos = useGridFrame ? worldToGridPosition(posWorld, frame) : posWorld.clone();
      return { mesh, frame, useGridFrame, pos };
    });

    const center = new THREE.Vector3();
    workItems.forEach((item) => center.add(item.pos));
    center.multiplyScalar(1 / workItems.length);

    const beforeItems = targets.map((mesh) => ({ mesh, before: getScaleTargetWorldPosition(mesh), after: null }));
    const dirtyMeshes = new Set();
    const movedPoints = [];
    if (differenceContext) {
      beginDifferenceHistorySession();
      rebuildDifferenceEdgeOverlapConstraints();
    }
    workItems.forEach((item) => {
      const offset = item.pos.clone().sub(center);
      const scaled = new THREE.Vector3(offset.x * sx, offset.y * sy, offset.z * sz).add(center);
      const nextWorld = item.useGridFrame ? gridToWorldPosition(scaled, item.frame) : scaled;
      setScaleTargetWorldPosition(item.mesh, nextWorld);
      if (differenceContext && item.mesh?.userData?.differenceControlPoint) {
        const parentMesh = item.mesh.userData?.parentDifferenceSpacePlane || item.mesh.parent;
        if (parentMesh?.userData?.differenceSpacePlane) {
          dirtyMeshes.add(parentMesh);
          movedPoints.push(item.mesh);
        }
      } else {
        syncGuideCurveFromPointMesh(item.mesh);
      }
    });

    const movedItems = beforeItems
      .map((item) => ({ ...item, after: getScaleTargetWorldPosition(item.mesh) }))
      .filter((item) => vecMoved(item.before, item.after));
    if (movedItems.length > 0) {
      if (differenceContext) {
        if (movedPoints.length > 0) {
          propagateDifferenceSharedPoints(movedPoints, dirtyMeshes);
        }
        const constrained = applyDifferenceEdgeOverlapConstraints(dirtyMeshes);
        const finalDirty = constrained || dirtyMeshes;
        finalDirty.forEach((mesh) => syncDifferenceGeometryFromControlPoints(mesh));
        autoMergeNearbyDifferencePoints(movedPoints);
        mergeOverlappedBoundaryControlPoints();
        refreshDifferencePreview();
        refreshDifferenceSelectedEdgeHighlights();
        commitDifferenceHistoryIfNeeded();
      } else {
        pushCreateHistory({
          type: 'move_meshes',
          items: movedItems,
          includesGridHandle: movedItems.some((item) => item.mesh === addPointGridHandle),
        });
      }
    }

    drawingObject(targets);
    updateScalePointPanelUI({ clearInputs: true });
  }

  function applyMovePointFromPanel() {
    const targets = ensureCopiedGroupReadyForPointEdit(getMovePointPanelTargets());
    if (targets.length === 0) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '選択点がありません。点をクリックで選択してください。';
      }
      return;
    }

    const inputX = parseMovePointAxisInput(rotationInputX?.value ?? '');
    const inputY = parseMovePointAxisInput(rotationInputY?.value ?? '');
    const inputZ = parseMovePointAxisInput(rotationInputZ?.value ?? '');
    const inputs = { x: inputX, y: inputY, z: inputZ };
    const invalidAxis = Object.entries(inputs).find(([, parsed]) => parsed?.mode === 'invalid');
    if (invalidAxis) {
      const axis = invalidAxis[0].toUpperCase();
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = `${axis} の入力が不正です。数値 または +=数値 で入力してください。`;
      }
      return;
    }

    if (!inputX && !inputY && !inputZ) {
      if (rotationSelectionInfo) {
        rotationSelectionInfo.textContent = '入力が空です。数値 または +=数値 を入力してください。';
      }
      return;
    }

    const beforeItems = targets.map((mesh) => ({ mesh, before: mesh.position.clone(), after: null }));
    targets.forEach((mesh) => {
      const frame = getMovePointGridFrameForMesh(mesh);
      const useGridFrame = movePointCoordinateMode === 'grid' && Boolean(frame);
      const workPos = useGridFrame
        ? worldToGridPosition(mesh.position, frame)
        : mesh.position.clone();
      ['x', 'y', 'z'].forEach((axis) => {
        const parsed = inputs[axis];
        if (!parsed) { return; }
        if (parsed.mode === 'delta') {
          workPos[axis] += parsed.value;
        } else if (parsed.mode === 'absolute') {
          workPos[axis] = parsed.value;
        }
      });
      const nextWorldPos = useGridFrame
        ? gridToWorldPosition(workPos, frame)
        : workPos;
      mesh.position.copy(nextWorldPos);
      syncGuideCurveFromPointMesh(mesh);
    });

    const movedItems = beforeItems
      .map((item) => ({ ...item, after: item.mesh.position.clone() }))
      .filter((item) => vecMoved(item.before, item.after));
    if (movedItems.length > 0) {
      pushCreateHistory({
        type: 'move_meshes',
        items: movedItems,
        includesGridHandle: movedItems.some((item) => item.mesh === addPointGridHandle),
      });
    }

    drawingObject(targets);
    refreshPointEditPanelUI({ clearInputs: true });
  }

  function applyRotationFromPanel() {
    if (styleModeActive && editObject === 'STEEL_FRAME' && objectEditMode === 'STYLE') {
      applyStyleFromPanel();
      return;
    }
    if (copyModeActive && editObject === 'STEEL_FRAME' && objectEditMode === 'COPY') {
      runCopySelectionFromPanel();
      return;
    }
    if (scalePointPanelActive
      && (editObject === 'STEEL_FRAME' || editObject === 'DIFFERENCE_SPACE')
      && (objectEditMode === 'MOVE_EXISTING' || objectEditMode === 'CONSTRUCT')
      && !pointRotateModeActive
      && movePlaneMode !== 'change_angle') {
      applyScalePointFromPanel();
      return;
    }
    if (movePointPanelActive
      && editObject === 'STEEL_FRAME'
      && objectEditMode === 'MOVE_EXISTING'
      && !pointRotateModeActive
      && movePlaneMode !== 'change_angle') {
      applyMovePointFromPanel();
      return;
    }
    if (pointRotateModeActive && pointRotateTarget) {
      const degToRad = Math.PI / 180;
      const state = pointRotateTarget.userData?.pointRotatePanelAngles || { x: 0, y: 0, z: 0 };
      const isMovePointRotate = editObject === 'STEEL_FRAME'
        && objectEditMode === 'MOVE_EXISTING'
        && Boolean(pointRotateTarget?.userData?.steelFramePoint);
      const xRaw = rotationInputX?.value?.trim?.() ?? '';
      const yRaw = rotationInputY?.value?.trim?.() ?? '';
      const zRaw = rotationInputZ?.value?.trim?.() ?? '';
      const axDeg = Number.isFinite(parseFloat(xRaw)) ? parseFloat(xRaw) : state.x;
      const ayDeg = Number.isFinite(parseFloat(yRaw)) ? parseFloat(yRaw) : state.y;
      const azDeg = Number.isFinite(parseFloat(zRaw)) ? parseFloat(zRaw) : state.z;
      const currentLen = (() => {
        const raw = Number(pointRotateTarget?.userData?.pointRotateLen);
        return Number.isFinite(raw) ? raw : 0;
      })();
      const nextLen = (() => {
        if (!isMovePointRotate) { return currentLen; }
        const parsed = parseFloat(zRaw);
        if (!Number.isFinite(parsed)) { return currentLen; }
        return parsed;
      })();
      const nextQuat = new THREE.Quaternion();
      const isDecorationRotate = !isMovePointRotate && isDecorationRotationContext(pointRotateTarget);
      if (isDecorationRotate) {
        const baseQuat = getDecorationRotationBaseQuat(pointRotateTarget, { ensure: true });
        nextQuat.copy(buildDecorationQuatFromPanelAngles(pointRotateTarget, {
          x: axDeg,
          y: ayDeg,
          z: azDeg,
        }));
        debugDecorationRotationLog('apply-panel', {
          id: pointRotateTarget?.id,
          input: { x: axDeg, y: ayDeg, z: azDeg },
          baseQuat: baseQuat.toArray(),
        });
      } else {
        if (Math.abs(axDeg) > 1e-6) {
          const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(nextQuat).normalize();
          const qx = new THREE.Quaternion().setFromAxisAngle(axisX, axDeg * degToRad);
          nextQuat.copy(qx.multiply(nextQuat)).normalize();
        }
        if (Math.abs(ayDeg) > 1e-6) {
          const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ayDeg * degToRad);
          nextQuat.copy(qy.multiply(nextQuat)).normalize();
        }
        if (!isMovePointRotate && Math.abs(azDeg) > 1e-6) {
          const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(nextQuat).normalize();
          const qz = new THREE.Quaternion().setFromAxisAngle(axisZ, azDeg * degToRad);
          nextQuat.copy(qz.multiply(nextQuat)).normalize();
        }
      }
      pointRotateBasisQuat.copy(nextQuat);

      pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
      pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
      pointRotateGizmoYawStart = pointRotateGizmoYaw;
      if (isDecorationRotationContext(pointRotateTarget)) {
        pointRotateGizmoQuat.copy(getDecorationRotationBaseQuat(pointRotateTarget, { ensure: true })).normalize();
      } else {
        pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
      }
      const normalizedPanelAngles = (!isMovePointRotate && isDecorationRotationContext(pointRotateTarget))
        ? { x: axDeg, y: ayDeg, z: azDeg }
        : { x: axDeg, y: ayDeg, z: (isMovePointRotate ? (Number(state.z) || 0) : azDeg) };
      pointRotateTarget.userData = {
        ...(pointRotateTarget.userData || {}),
        pointRotateDirection: pointRotateDirection.clone(),
        pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
        pointRotateLen: nextLen,
        pointRotatePanelAngles: normalizedPanelAngles,
      };
      if (!isMovePointRotate
        && pointRotateTarget?.userData?.decorationType
        && pointRotateTarget?.quaternion?.isQuaternion) {
        pointRotateTarget.quaternion.copy(pointRotateBasisQuat).normalize();
        pointRotateTarget.updateMatrixWorld(true);
      }
      if (isMovePointRotate) {
        pointRotateTarget.position.add(pointRotateDirection.clone().multiplyScalar(nextLen));
        pointRotateCenter.copy(pointRotateTarget.position);
        if (pointRotateTarget?.userData?.steelFramePoint) {
          drawingObject([pointRotateTarget]);
        }
      }
      if (editObject === 'DIFFERENCE_SPACE' && ['move', 'rotation'].includes(differenceSpaceTransformMode)) {
        saveDifferencePointRotateAngleState(differenceSpaceTransformMode);
      }
      showPointRotationGuideLine(pointRotateTarget);
      updatePointRotateVisuals();

      if (rotationInputX) { rotationInputX.value = String(Number(normalizedPanelAngles.x).toFixed(1)); rotationInputX.placeholder = String(normalizedPanelAngles.x); }
      if (rotationInputY) { rotationInputY.value = String(Number(normalizedPanelAngles.y).toFixed(1)); rotationInputY.placeholder = String(normalizedPanelAngles.y); }
      if (rotationInputZ) {
        if (isMovePointRotate) {
          rotationInputZ.value = String(Number(nextLen).toFixed(3));
          rotationInputZ.placeholder = String(Number(nextLen).toFixed(3));
        } else {
          rotationInputZ.value = String(Number(normalizedPanelAngles.z).toFixed(1));
          rotationInputZ.placeholder = String(normalizedPanelAngles.z);
        }
      }
      syncRotationInputGhostHints();
      return;
    }

    const isDecorationRotate = false;
    const meshes = isDecorationRotate
      ? [rotateTargetObject]
      : ensureCopiedGroupReadyForPointEdit(getRotateSelectionMeshes());
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
      const nextQuat = new THREE.Quaternion();
      if (Math.abs(axDeg) > 1e-6) {
        const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(nextQuat).normalize();
        const qx = new THREE.Quaternion().setFromAxisAngle(axisX, axDeg * degToRad);
        nextQuat.copy(qx.multiply(nextQuat)).normalize();
      }
      if (Math.abs(ayDeg) > 1e-6) {
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ayDeg * degToRad);
        nextQuat.copy(qy.multiply(nextQuat)).normalize();
      }
      if (Math.abs(azDeg) > 1e-6) {
        const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(nextQuat).normalize();
        const qz = new THREE.Quaternion().setFromAxisAngle(axisZ, azDeg * degToRad);
        nextQuat.copy(qz.multiply(nextQuat)).normalize();
      }
      movePlaneBasisQuat.copy(nextQuat);
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

    if (isDecorationRotate) {
      const target = rotateTargetObject;
      const state = target.userData?.pointRotatePanelAngles || rotatePanelState.angles;
      const xDeg = Number.isFinite(parseFloat(xRaw)) ? parseFloat(xRaw) : (Number(state?.x) || 0);
      const yDeg = Number.isFinite(parseFloat(yRaw)) ? parseFloat(yRaw) : (Number(state?.y) || 0);
      const zDeg = Number.isFinite(parseFloat(zRaw)) ? parseFloat(zRaw) : (Number(state?.z) || 0);
      const nextQuat = new THREE.Quaternion();
      if (Math.abs(xDeg) > 1e-6) {
        const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(nextQuat).normalize();
        const qx = new THREE.Quaternion().setFromAxisAngle(axisX, xDeg * degToRad);
        nextQuat.copy(qx.multiply(nextQuat)).normalize();
      }
      if (Math.abs(yDeg) > 1e-6) {
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yDeg * degToRad);
        nextQuat.copy(qy.multiply(nextQuat)).normalize();
      }
      if (Math.abs(zDeg) > 1e-6) {
        const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(nextQuat).normalize();
        const qz = new THREE.Quaternion().setFromAxisAngle(axisZ, zDeg * degToRad);
        nextQuat.copy(qz.multiply(nextQuat)).normalize();
      }
      target.quaternion.copy(nextQuat).normalize();
      const normalizedPanelAngles = getRotationPanelAnglesFromQuaternion(target.quaternion);
      rotatePanelState.angles = normalizedPanelAngles;
      target.userData = {
        ...(target.userData || {}),
        pointRotateBasisQuat: nextQuat.toArray(),
        pointRotateDirection: new THREE.Vector3(0, 0, 1).applyQuaternion(nextQuat).normalize(),
        pointRotatePanelAngles: normalizedPanelAngles,
      };
      target.updateMatrixWorld(true);
      if (rotationInputX) {
        rotationInputX.value = String(Number(normalizedPanelAngles.x).toFixed(1));
        rotationInputX.placeholder = String(Number(normalizedPanelAngles.x).toFixed(1));
      }
      if (rotationInputY) {
        rotationInputY.value = String(Number(normalizedPanelAngles.y).toFixed(1));
        rotationInputY.placeholder = String(Number(normalizedPanelAngles.y).toFixed(1));
      }
      if (rotationInputZ) {
        rotationInputZ.value = String(Number(normalizedPanelAngles.z).toFixed(1));
        rotationInputZ.placeholder = String(Number(normalizedPanelAngles.z).toFixed(1));
      }
      syncRotationInputGhostHints();
      updateRotateGizmo();
      return;
    } else {
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
    }

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
  if (movePointCoordinateWorldBtn) {
    movePointCoordinateWorldBtn.addEventListener('click', () => {
      setMovePointCoordinateMode('world');
    });
  }
  if (movePointCoordinateGridBtn) {
    movePointCoordinateGridBtn.addEventListener('click', () => {
      setMovePointCoordinateMode('grid');
    });
  }
  updateMovePointCoordinateButtons();

  let guidePlacementTemplate = null;
  let guidePlacementActive = false;
  let guideRailHover = null;
  let guideHoverPin = null;
  const GUIDE_TUBE_RADIUS = 0.225;

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
    const tube = new THREE.TubeGeometry(curve, 60, GUIDE_TUBE_RADIUS, 10, curve?.closed === true);
    const mat = createRaycastOnlyMaterial({ side: THREE.FrontSide });
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
      const newGeom = new THREE.TubeGeometry(curve, 60, GUIDE_TUBE_RADIUS, 10, curve?.closed === true);
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

  function renderLedBoardTexture(board) {
    const data = board?.userData?.ledBoardData;
    const canvas = board?.userData?.ledBoardCanvas;
    const ctx = board?.userData?.ledBoardCtx;
    const texture = board?.userData?.ledBoardTexture;
    if (!data || !canvas || !ctx || !texture) { return; }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0f1318';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#2c3d57';
    ctx.fillRect(20, 20, w - 40, 86);

    ctx.fillStyle = '#d7e9ff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(data.topLeft || ''), 34, 62);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(String(data.topRight || ''), w - 34, 62);

    const rows = [
      { y: 158, color: '#6dff7e', text: String(data.line1 || '') },
      { y: 226, color: '#ff5e5e', text: String(data.line2 || '') },
      { y: 294, color: '#ffd24a', text: String(data.line3 || '') },
    ];
    rows.forEach((row) => {
      ctx.fillStyle = '#12181f';
      ctx.fillRect(20, row.y - 28, w - 40, 50);
      ctx.fillStyle = row.color;
      ctx.font = 'bold 42px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = row.color;
      ctx.shadowBlur = 12;
      ctx.fillText(row.text, 34, row.y);
      ctx.shadowBlur = 0;
    });

    texture.needsUpdate = true;
  }

  function createLedBoardDecoration(position) {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 1.9, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x1f2228,
        metalness: 0.45,
        roughness: 0.6,
      }),
    );
    board.name = `DecorationLedBoard_${Date.now()}`;
    board.position.copy(position);
    board.userData = {
      ...(board.userData || {}),
      decorationType: 'led_board',
      baseColor: 0x1f2228,
    };

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 352;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.45, 1.2),
      new THREE.MeshBasicMaterial({
        map: texture,
      }),
    );
    screen.position.z = 0.076;
    screen.userData = { ...(screen.userData || {}), decorationRoot: board };
    board.add(screen);

    const toCam = camera.position.clone().sub(position);
    toCam.y = 0;
    if (toCam.lengthSq() > 1e-8) {
      board.rotation.y = Math.atan2(toCam.x, toCam.z);
    }

    board.userData.ledBoardCanvas = canvas;
    board.userData.ledBoardCtx = ctx;
    board.userData.ledBoardTexture = texture;
    board.userData.ledBoardData = {
      topLeft: '宇都宮線 (東北線)',
      topRight: '3',
      line1: '普通 9:14 高崎線',
      line2: '列車がまいります',
      line3: 'ご注意ください',
    };
    renderLedBoardTexture(board);
    return board;
  }

  function openLedBoardTextEditor(board) {
    if (!board?.userData?.decorationType || board.userData.decorationType !== 'led_board') { return false; }
    const now = board.userData.ledBoardData || {};
    const topLeft = window.prompt('電光掲示板 上段(左)', String(now.topLeft || ''));
    if (topLeft === null) { return false; }
    const topRight = window.prompt('電光掲示板 上段(右)', String(now.topRight || ''));
    if (topRight === null) { return false; }
    const line1 = window.prompt('電光掲示板 1行目', String(now.line1 || ''));
    if (line1 === null) { return false; }
    const line2 = window.prompt('電光掲示板 2行目', String(now.line2 || ''));
    if (line2 === null) { return false; }
    const line3 = window.prompt('電光掲示板 3行目', String(now.line3 || ''));
    if (line3 === null) { return false; }

    board.userData.ledBoardData = {
      topLeft: String(topLeft).slice(0, 30),
      topRight: String(topRight).slice(0, 12),
      line1: String(line1).slice(0, 36),
      line2: String(line2).slice(0, 36),
      line3: String(line3).slice(0, 36),
    };
    renderLedBoardTexture(board);
    return true;
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
const SHOW_MAP_GLB = false;
const SHOW_TRAINS = false;
const SHOW_ELEVATORS = false;
const ONLY_RAIL_AND_GROUND = true;

console.log('WorldCreat')

import { WorldCreat } from './world_creat.js';
let LoadModels = await WorldCreat(scene, train_width, car_Spacing, {
  showMapGlb: SHOW_MAP_GLB,
  onlyRailAndGround: ONLY_RAIL_AND_GROUND,
});
let geo = LoadModels[0]

console.log('cars : ',LoadModels)
console.log('geo : ',geo)

// world_creat()

const dirLight = scene.getObjectByName('dirLight');


import { TrainSystem } from './train_system.js';
import { createSteelFrameMode } from './steel_frame_mode.js';
import { initTrackSetup, ENABLE_MANUAL_DIORAMA_SPACE, USE_SAVED_DATA_ONLY } from './track_setup.js';
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

let ElevatorDoorGroup_A1 = null;
let ElevatorDoorGroup_A2 = null;
let ElevatorDoorGroup_C1 = null;
let ElevatorDoorGroup_C2 = null;
let ElevatorDoorGroup_B1 = null;
let ElevatorDoorGroup_B2 = null;
let ElevatorDoorGroup_D1 = null;
let ElevatorDoorGroup_D2 = null;
let ElevatorBodyGroup = null;
let ElevatorDoorGroup_Ab1 = null;
let ElevatorDoorGroup_Ab2 = null;
let ElevatorDoorGroup_Cb1 = null;
let ElevatorDoorGroup_Cb2 = null;
let ElevatorDoorGroup_Bb1 = null;
let ElevatorDoorGroup_Bb2 = null;
let ElevatorDoorGroup_Db1 = null;
let ElevatorDoorGroup_Db2 = null;
let ElevatorBodyGroup_B = null;

if (SHOW_ELEVATORS) {
  const elevatorA1 = TSys.createElevator(-2.7, 6.62, 36, 1, 1, glass_material, metal_material, bodyFront, bodyBack, true);
  scene.add(elevatorA1);
  const elevatorA2 = TSys.createElevator(-2.7, 9.9, 37.2, 1, -1, glass_material, metal_material, bodyFront, bodyBack);
  scene.add(elevatorA2);

  ElevatorDoorGroup_A1 = elevatorA1.children[1].children[0]
  ElevatorDoorGroup_A2 = elevatorA1.children[1].children[1]
  ElevatorDoorGroup_C1 = elevatorA1.children[2].children[0]
  ElevatorDoorGroup_C2 = elevatorA1.children[2].children[1]
  ElevatorDoorGroup_B1 = elevatorA2.children[1].children[0]
  ElevatorDoorGroup_B2 = elevatorA2.children[1].children[1]
  ElevatorDoorGroup_D1 = elevatorA2.children[2].children[0]
  ElevatorDoorGroup_D2 = elevatorA2.children[2].children[1]
  ElevatorDoorGroup_D1.position.y = -3.28
  ElevatorDoorGroup_D2.position.y = -3.28
  ElevatorBodyGroup = elevatorA1.children[3]

  const elevatorB1 = TSys.createElevator(2.7, 6.62, 36, -1, 1, glass_material, metal_material, bodyFront, bodyBack, true);
  scene.add(elevatorB1);
  const elevatorB2 = TSys.createElevator(2.7, 9.9, 37.2, -1, -1 ,glass_material, metal_material, bodyFront, bodyBack,);
  scene.add(elevatorB2);

  ElevatorDoorGroup_Ab1 = elevatorB1.children[1].children[0]
  ElevatorDoorGroup_Ab2 = elevatorB1.children[1].children[1]
  ElevatorDoorGroup_Cb1 = elevatorB1.children[2].children[0]
  ElevatorDoorGroup_Cb2 = elevatorB1.children[2].children[1]
  ElevatorDoorGroup_Bb1 = elevatorB2.children[1].children[0]
  ElevatorDoorGroup_Bb2 = elevatorB2.children[1].children[1]
  ElevatorDoorGroup_Db1 = elevatorB2.children[2].children[0]
  ElevatorDoorGroup_Db2 = elevatorB2.children[2].children[1]
  ElevatorBodyGroup_B = elevatorB1.children[3]

  ElevatorDoorGroup_Cb1.position.y = +3.28
  ElevatorDoorGroup_Cb2.position.y = +3.28
  ElevatorBodyGroup_B.position.y = +3.28
}

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
  if (!SHOW_ELEVATORS) { return; }
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
  if (!SHOW_TRAINS) {
    const emptyTrainGroup = new THREE.Group();
    emptyTrainGroup.userData.cars = [];
    emptyTrainGroup.visible = false;
    return emptyTrainGroup;
  }
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
  if (!SHOW_TRAINS) {
    const emptyTrainGroup = new THREE.Group();
    emptyTrainGroup.userData.cars = [];
    emptyTrainGroup.visible = false;
    return emptyTrainGroup;
  }
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

const UI_STATE_STORAGE_KEY = 'train_editmode_ui_state_v1';

const u8view = (typed) => new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);

function maxIndexValue(indices) {
  if (!Array.isArray(indices) || indices.length < 1) { return -1; }
  let m = -1;
  for (let i = 0; i < indices.length; i += 1) {
    const v = Number(indices[i]) || 0;
    if (v > m) { m = v; }
  }
  return m;
}

function packState(state) {
  const packed = structuredClone(state);
  const spaces = Array.isArray(packed?.differenceSpaces) ? packed.differenceSpaces : [];
  spaces.forEach((ds) => {
    const geom = ds?.geometry;
    if (!geom || !Array.isArray(geom.position)) { return; }
    const posF32 = Float32Array.from(geom.position);
    const rawIndex = Array.isArray(geom.index) ? geom.index : [];
    const idxMax = maxIndexValue(rawIndex);
    const idxTyped = (idxMax >= 0 && idxMax <= 65535)
      ? Uint16Array.from(rawIndex)
      : Uint32Array.from(rawIndex);
    ds.geometry = {
      position: { dtype: 'f32', itemSize: 3, data: u8view(posF32) },
      index: { dtype: (idxTyped instanceof Uint16Array) ? 'u16' : 'u32', data: u8view(idxTyped) },
    };
  });
  return encode(packed);
}

function fromBin(binU8, dtype) {
  const src = Array.isArray(binU8) ? Uint8Array.from(binU8) : binU8;
  if (!src || typeof src !== 'object' || !('buffer' in src) || !('byteOffset' in src) || !('byteLength' in src)) {
    throw new Error('invalid binary payload');
  }
  const toAlignedView = (bytesPerElement, Ctor) => {
    const byteLen = src.byteLength;
    if (byteLen % bytesPerElement !== 0) {
      throw new Error(`invalid ${dtype} byteLength=${byteLen}`);
    }
    // MessagePack decode の戻りは byteOffset が未アラインな場合があるため、
    // 必要時のみコピーして安全に TypedArray を生成する。
    if (src.byteOffset % bytesPerElement !== 0) {
      const copy = new Uint8Array(byteLen);
      copy.set(new Uint8Array(src.buffer, src.byteOffset, byteLen));
      return new Ctor(copy.buffer);
    }
    return new Ctor(src.buffer, src.byteOffset, byteLen / bytesPerElement);
  };
  if (dtype === 'f32') { return toAlignedView(4, Float32Array); }
  if (dtype === 'u16') { return toAlignedView(2, Uint16Array); }
  if (dtype === 'u32') { return toAlignedView(4, Uint32Array); }
  throw new Error('unknown dtype');
}

function unpackState(bytes) {
  const state = decode(bytes);
  const spaces = Array.isArray(state?.differenceSpaces) ? state.differenceSpaces : [];
  spaces.forEach((ds) => {
    const gp = ds?.geometry?.position;
    const gi = ds?.geometry?.index;
    if (!gp?.data || !gp?.dtype) { return; }
    const pos = fromBin(gp.data, gp.dtype);
    const idx = (gi?.data && gi?.dtype) ? fromBin(gi.data, gi.dtype) : new Uint32Array();
    ds.geometry = {
      position: Array.from(pos),
      index: Array.from(idx),
    };
  });
  return state;
}

function serializeDifferenceSpaceMesh(mesh) {
  if (!mesh?.geometry?.attributes?.position) { return null; }
  const positionAttr = mesh.geometry.attributes.position;
  const indexAttr = mesh.geometry.getIndex();
  return {
    position: [mesh.position.x, mesh.position.y, mesh.position.z],
    quaternion: [mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w],
    scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
    geometry: {
      position: Array.from(positionAttr.array),
      index: indexAttr ? Array.from(indexAttr.array) : null,
    },
  };
}

function buildCreateModePayload() {
  const uiStateRaw = localStorage.getItem(UI_STATE_STORAGE_KEY);
  let uiState = null;
  try {
    uiState = uiStateRaw ? JSON.parse(uiStateRaw) : null;
  } catch (err) {
    uiState = null;
  }

  const spaces = differenceSpacePlanes
    .filter((mesh) => mesh?.parent && mesh?.userData?.differenceSpacePlane)
    .map((mesh) => serializeDifferenceSpaceMesh(mesh))
    .filter(Boolean);
  const baseGuideGrid = serializeBaseGuideGridState();
  const guideGridStates = guideAddGrids
    .filter((grid) => grid?.parent)
    .map((grid) => serializeGuideGridState(grid))
    .filter(Boolean);

  return {
    meta: {
      version: 1,
      savedAt: new Date().toISOString(),
      app: 'Train_EditMode_demo',
    },
    mode: {
      editObject,
      objectEditMode,
      searchObject: search_object,
      moveDirectionY: move_direction_y,
      differenceSpaceModeActive,
      differenceSpaceTransformMode,
      differenceShapeType,
      differencePathType,
    },
    uiState,
    baseGuideGrid,
    guideAddGrids: guideGridStates,
    differenceSpaces: spaces,
  };
}

function downloadCreateModeData() {
  const payload = buildCreateModePayload();
  const msgpackBytes = packState(payload);
  const blob = new Blob([msgpackBytes], { type: 'application/x-msgpack' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.download = `create_mode_state_${stamp}.msgpack`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  alert('create_mode_state.msgpack を保存しました。');
}

const saveCreateModeButton = document.getElementById('save-create-mode-data');
if (saveCreateModeButton) {
  saveCreateModeButton.addEventListener('click', downloadCreateModeData);
}
const undoActionButton = document.getElementById('undo-action');
const redoActionButton = document.getElementById('redo-action');

const loadMapDataButton = document.getElementById('load-map-data');
const loadMapDataInput = document.getElementById('load-map-data-input');
if (undoActionButton) {
  undoActionButton.addEventListener('click', undoHistoryByContext);
}
if (redoActionButton) {
  redoActionButton.addEventListener('click', redoHistoryByContext);
}

function clearDifferenceSpacesForImport() {
  clearDifferencePreviewTube();
  clearDifferenceFaceHighlight();
  clearDifferenceFaceSelection();
  clearDifferenceEdgeSelection();
  clearDifferenceControlPointSelection();
  differenceSpacePlanes.forEach((mesh) => {
    if (!mesh) { return; }
    mesh.children.forEach((child) => {
      if (child?.userData?.differenceControlPoint) {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
    });
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
    mesh.geometry?.dispose?.();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m?.dispose?.());
    } else {
      mesh.material?.dispose?.();
    }
  });
  differenceSpacePlanes.length = 0;
  differenceSelectedPlane = null;
  updateDifferenceUnifyButtonState();
}

function buildGeometryFromSerializedSpace(rawSpace) {
  const posArr = rawSpace?.geometry?.position;
  const idxArr = rawSpace?.geometry?.index;
  if (!Array.isArray(posArr) || posArr.length < 9 || posArr.length % 3 !== 0) { return null; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  const uv = new Float32Array((posArr.length / 3) * 2);
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (Array.isArray(idxArr) && idxArr.length >= 3) {
    geometry.setIndex(idxArr);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  geometry.computeBoundingSphere?.();
  return geometry;
}

function relinkImportedDifferenceSharedPoints(eps = differenceSharedPointLinkEpsilon) {
  const points = [];
  differenceSpacePlanes.forEach((mesh) => {
    mesh?.children?.forEach((child) => {
      if (!child?.userData?.differenceControlPoint || !child.parent) { return; }
      points.push(child);
    });
  });
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const aw = a.getWorldPosition(new THREE.Vector3());
    for (let j = i + 1; j < points.length; j += 1) {
      const b = points[j];
      if (a.parent === b.parent) { continue; }
      const bw = b.getWorldPosition(new THREE.Vector3());
      if (aw.distanceToSquared(bw) <= eps * eps) {
        addDifferenceSharedPointLink(a, b);
      }
    }
  }
}

function applyCreateModePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('map_data の形式が不正です。');
  }
  clearCreateHistory();
  clearDifferenceHistory();
  const baseGuideGrid = (payload?.baseGuideGrid && typeof payload.baseGuideGrid === 'object')
    ? payload.baseGuideGrid
    : null;
  const guideGridStates = Array.isArray(payload?.guideAddGrids) ? payload.guideAddGrids : [];
  applyBaseGuideGridState(baseGuideGrid);
  clearGuideAddGridsForImport();
  guideGridStates.forEach((state) => addGuideGridFromState(state));
  changeAngleGridTarget = guideAddGrids.length > 0 ? guideAddGrids[guideAddGrids.length - 1] : null;
  const spaces = Array.isArray(payload.differenceSpaces) ? payload.differenceSpaces : [];
  clearDifferenceSpacesForImport();
  spaces.forEach((rawSpace) => {
    const geometry = buildGeometryFromSerializedSpace(rawSpace);
    if (!geometry) { return; }
    const mesh = createDifferenceSpaceMeshFromGeometry(geometry, null);
    const pos = Array.isArray(rawSpace.position) ? rawSpace.position : [0, 0, 0];
    const quat = Array.isArray(rawSpace.quaternion) ? rawSpace.quaternion : [0, 0, 0, 1];
    const scl = Array.isArray(rawSpace.scale) ? rawSpace.scale : [1, 1, 1];
    mesh.position.set(Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0);
    mesh.quaternion.set(Number(quat[0]) || 0, Number(quat[1]) || 0, Number(quat[2]) || 0, Number(quat[3]) || 1);
    mesh.scale.set(Number(scl[0]) || 1, Number(scl[1]) || 1, Number(scl[2]) || 1);
    mesh.updateMatrixWorld(true);
    rebuildDifferenceControlPointsFromGeometry(mesh);
    syncDifferenceGeometryFromControlPoints(mesh);
    mergeCoincidentDifferenceControlPoints(mesh);
    pruneDifferenceControlPointsByMeaningfulEdges(mesh);
  });
  relinkImportedDifferenceSharedPoints();
  mergeOverlappedBoundaryControlPoints();
  rebuildDifferenceEdgeOverlapConstraints();

  const mode = payload.mode && typeof payload.mode === 'object' ? payload.mode : {};
  editObject = typeof mode.editObject === 'string' ? mode.editObject : editObject;
  objectEditMode = typeof mode.objectEditMode === 'string' ? mode.objectEditMode : objectEditMode;
  search_object = Boolean(mode.searchObject);
  move_direction_y = Boolean(mode.moveDirectionY);
  differenceSpaceModeActive = Boolean(mode.differenceSpaceModeActive);
  differenceSpaceTransformMode = typeof mode.differenceSpaceTransformMode === 'string'
    ? mode.differenceSpaceTransformMode
    : differenceSpaceTransformMode;
  differenceShapeType = typeof mode.differenceShapeType === 'string' ? mode.differenceShapeType : differenceShapeType;
  differencePathType = typeof mode.differencePathType === 'string' ? mode.differencePathType : differencePathType;
  if (differenceShapeSelect) {
    differenceShapeSelect.value = differenceShapeType;
  }
  if (differencePathSelect) {
    differencePathSelect.value = differencePathType;
  }
  targetObjects = differenceSpacePlanes.filter((m) => m?.parent);
  setMeshListOpacity(targetObjects, 1);
  refreshDifferencePreview();
  updateDifferenceStatus(`map_data 読込完了: 空間 ${differenceSpacePlanes.length} 件 / ガイド ${guideAddGrids.length} 件`);
  updateDifferenceUnifyButtonState();

  if (payload.uiState && typeof payload.uiState === 'object') {
    try {
      localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(payload.uiState));
    } catch (err) {
      console.warn('failed to store uiState', err);
    }
  }
}

function readMapDataFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = reader.result;
        if (!(data instanceof ArrayBuffer)) {
          reject(new Error('ファイル形式が不正です。'));
          return;
        }
        const bytes = new Uint8Array(data);
        const name = String(file?.name || '').toLowerCase();
        const explicitJson = name.endsWith('.json');
        const explicitMsgPack = name.endsWith('.msgpack') || name.endsWith('.mpk');

        const tryMsgPack = () => unpackState(bytes);
        const tryJson = () => {
          const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
          return JSON.parse(text);
        };

        if (explicitMsgPack) {
          resolve(tryMsgPack());
          return;
        }
        if (explicitJson) {
          resolve(tryJson());
          return;
        }

        // 拡張子不明時は MessagePack -> JSON の順で試す
        try {
          resolve(tryMsgPack());
          return;
        } catch (msgpackErr) {
          try {
            resolve(tryJson());
            return;
          } catch (jsonErr) {
            const detail = [
              `msgpack: ${msgpackErr?.message || msgpackErr}`,
              `json: ${jsonErr?.message || jsonErr}`,
            ].join(' | ');
            reject(new Error(`MessagePack / JSON の解析に失敗しました。${detail}`));
            return;
          }
        }
      } catch (err) {
        reject(new Error(`MessagePack / JSON の解析に失敗しました。${err?.message || err}`));
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsArrayBuffer(file);
  });
}

if (loadMapDataButton && loadMapDataInput) {
  loadMapDataButton.addEventListener('click', () => {
    loadMapDataInput.value = '';
    loadMapDataInput.click();
  });
  loadMapDataInput.addEventListener('change', async (event) => {
    const file = event.target?.files?.[0];
    if (!file) { return; }
    try {
      const payload = await readMapDataFile(file);
      applyCreateModePayload(payload);
      alert('map_data を読み込みました。');
    } catch (err) {
      console.warn(err);
      alert(err?.message || 'map_data の読み込みに失敗しました。');
    }
  });
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
constructionCategoryCards.forEach((card) => {
  card.addEventListener('click', () => {
    setConstructionCategory(card.dataset.constructionProfile);
  });
});
railConstructionCards.forEach((card) => {
  card.addEventListener('click', () => {
    setRailConstructionCategory(card.dataset.railConstructionCategory);
  });
});
if (constructionGenerateButton) {
  constructionGenerateButton.addEventListener('click', () => {
    if (editObject !== 'STEEL_FRAME' || objectEditMode !== 'CONSTRUCT') {
      if (constructionCategoryStatus) {
        constructionCategoryStatus.textContent = 'construction モードを有効にしてください。';
      }
      return;
    }
    if (!selectedConstructionProfile) {
      if (constructionCategoryStatus) {
        constructionCategoryStatus.textContent = 'カテゴリを選択してください。';
      }
      return;
    }
    const record = steelFrameMode.generateSteelFrame();
    if (!record) {
      if (constructionCategoryStatus) {
        constructionCategoryStatus.textContent = '生成に必要な点が足りません（2点以上が必要）。';
      }
      return;
    }
    if (constructionCategoryStatus) {
      constructionCategoryStatus.textContent = `生成完了: ${record.profile} / 点${record.pointCount} / メッシュ${record.meshCount}`;
    }
  });
}
if (railConstructionGenerateButton) {
  railConstructionGenerateButton.addEventListener('click', () => {
    if (!selectedRailConstructionCategory) {
      if (railConstructionStatus) {
        railConstructionStatus.textContent = 'カテゴリを選択してください。';
      }
      return;
    }
    runRailConstructionByCategory(selectedRailConstructionCategory);
  });
}
setConstructionCategory(null);
setRailConstructionCategory(null);
const cube = new THREE.Mesh(cube_geometry, cube_material);
let targetObjects = [];
const targetPins = [];

let door_interval = train_width + car_Spacing;
let track1_doors = new THREE.Group();
let track2_doors = new THREE.Group();
let track3_doors = new THREE.Group();
let track4_doors = new THREE.Group();

if (!USE_SAVED_DATA_ONLY) {
  ({
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
  }));
} else {
  console.info('[main] USE_SAVED_DATA_ONLY=true: applyFixedPlacements をスキップ');
  railTrackDefs.forEach((track) => {
    if (!track?.curve) { return; }
    TSys.createRail(track.curve);
  });
}
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

const allTrains = [
  exhibition_tyuou,
  exhibition_soubu,
  Train_1,
  Train_2,
  Train_3,
  Train_4,
  Train_5,
  Train_6,
  Train_7,
  Train_8,
  Train_9,
  Train_a,
  Train_b,
  Train_c,
];
if (!SHOW_TRAINS) {
  allTrains.forEach((train) => {
    if (train) {
      train.visible = false;
    }
  });
}


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
  if (!SHOW_TRAINS) { return; }
  
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

if (SHOW_TRAINS) {
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
}

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
        if ('metalness' in material) { material.metalness = 0.08; }
        if ('roughness' in material) { material.roughness = 0.58; }
        if ('flatShading' in material) { material.flatShading = false; }
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

function drawingObject(changedPoints = null){

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
    steelFrameMode.setPointsFromTargets(changedPoints);
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
  GuideLine.scale.set(1, 1, 1);
  updateGuideLineDirectionFromMesh(mesh);
  GuideLine.visible = true;
}

const ADD_POINT_GRID_SIZE = 20;
const ADD_POINT_GRID_DIVISIONS = 40;

const GuideGrid = new THREE.GridHelper(5, 10, 0x8888aa, 0x88aa88);
GuideGrid.name = "GuideGrid";
GuideGrid.position.set(0,0,0);
if (GuideGrid.material) {
  if (Array.isArray(GuideGrid.material)) {
    GuideGrid.material.forEach((mat) => {
      if (!mat) { return; }
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
    });
  } else {
    GuideGrid.material.transparent = true;
    GuideGrid.material.opacity = 0;
    GuideGrid.material.depthWrite = false;
  }
}
scene.add(GuideGrid);
const GUIDE_GRID_AXIS_LEN = 2.2;
const GuideGridAxisGroup = new THREE.Group();
GuideGridAxisGroup.name = 'GuideGridAxisGroup';
const GuideGridAxisX = createLine({x:-GUIDE_GRID_AXIS_LEN, y:0.01, z:0}, {x:GUIDE_GRID_AXIS_LEN, y:0.01, z:0}, 0xe34c4c);
GuideGridAxisX.name = 'GuideGridAxisX';
const GuideGridAxisY = createLine({x:0, y:-GUIDE_GRID_AXIS_LEN, z:0}, {x:0, y:GUIDE_GRID_AXIS_LEN, z:0}, 0x46b86a);
GuideGridAxisY.name = 'GuideGridAxisY';
const GuideGridAxisZ = createLine({x:0, y:0.01, z:-GUIDE_GRID_AXIS_LEN}, {x:0, y:0.01, z:GUIDE_GRID_AXIS_LEN}, 0x3f7fd6);
GuideGridAxisZ.name = 'GuideGridAxisZ';
GuideGridAxisGroup.add(GuideGridAxisX);
GuideGridAxisGroup.add(GuideGridAxisY);
GuideGridAxisGroup.add(GuideGridAxisZ);
GuideGrid.add(GuideGridAxisGroup);

const AddPointGuideGrid = new THREE.GridHelper(ADD_POINT_GRID_SIZE, ADD_POINT_GRID_DIVISIONS, 0x88aa88, 0x88aa88);
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
GuideGrid.visible = false
GuideGridAxisGroup.visible = true
AddPointGuideGrid.visible = false
GuideGrid_Center_x.visible = false
GuideGrid_Center_z.visible = false

const addPointGridHandle = new THREE.Mesh(
  new THREE.PlaneGeometry(ADD_POINT_GRID_SIZE, ADD_POINT_GRID_SIZE),
  createRaycastOnlyMaterial()
);
addPointGridHandle.name = 'AddPointGridHandle';
addPointGridHandle.rotation.x = -Math.PI / 2;
addPointGridHandle.position.set(0, 0, 0);
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

const GUIDE_GRID_PICK_OFFSET = 0.02;
const GIZMO_PICK_OFFSET = 0.04;
function createRaycastOnlyMaterial({ side = THREE.DoubleSide } = {}) {
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side,
    depthWrite: false,
    depthTest: false,
  });
  mat.colorWrite = false;
  return mat;
}

function syncGuidePickMeshFromGrid(grid, pick) {
  if (!grid || !pick) { return; }
  const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(grid.quaternion).normalize();
  pick.position.copy(grid.position).addScaledVector(planeNormal, -GUIDE_GRID_PICK_OFFSET);
  pick.quaternion.copy(grid.quaternion).multiply(addPointGridBaseQuat);
  pick.updateMatrixWorld(true);
}

function serializeGuideGridState(grid) {
  if (!grid?.position || !grid?.quaternion) { return null; }
  const angles = grid?.userData?.changeAnglePanelAngles;
  return {
    position: [grid.position.x, grid.position.y, grid.position.z],
    quaternion: [grid.quaternion.x, grid.quaternion.y, grid.quaternion.z, grid.quaternion.w],
    changeAnglePanelAngles: angles
      ? {
        x: Number(angles.x) || 0,
        y: Number(angles.y) || 0,
        z: Number(angles.z) || 0,
      }
      : null,
  };
}

function serializeBaseGuideGridState() {
  return serializeGuideGridState(AddPointGuideGrid);
}

function applyBaseGuideGridState(state) {
  if (!state || typeof state !== 'object') { return; }
  const pos = Array.isArray(state.position) ? state.position : [0, 0, 0];
  const quat = Array.isArray(state.quaternion) ? state.quaternion : [0, 0, 0, 1];
  const p = new THREE.Vector3(Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0);
  const q = new THREE.Quaternion(Number(quat[0]) || 0, Number(quat[1]) || 0, Number(quat[2]) || 0, Number(quat[3]) || 1).normalize();
  AddPointGuideGrid.position.copy(p);
  AddPointGuideGrid.quaternion.copy(q);
  AddPointGuideGrid.updateMatrixWorld(true);
  addPointGridHandle.position.copy(p);
  addPointGridHandle.quaternion.copy(q).multiply(addPointGridBaseQuat);
  addPointGridHandle.updateMatrixWorld(true);
  addPointGridY = p.y;
  addPointGridInitialized = true;
  if (state.changeAnglePanelAngles && typeof state.changeAnglePanelAngles === 'object') {
    AddPointGuideGrid.userData = {
      ...(AddPointGuideGrid.userData || {}),
      changeAnglePanelAngles: {
        x: Number(state.changeAnglePanelAngles.x) || 0,
        y: Number(state.changeAnglePanelAngles.y) || 0,
        z: Number(state.changeAnglePanelAngles.z) || 0,
      },
    };
  }
}

function clearGuideAddGridsForImport() {
  guideAddGridPicks.forEach((pick) => {
    if (pick?.parent) { pick.parent.remove(pick); }
    pick?.geometry?.dispose?.();
    if (Array.isArray(pick?.material)) {
      pick.material.forEach((m) => m?.dispose?.());
    } else {
      pick?.material?.dispose?.();
    }
  });
  guideAddGrids.forEach((grid) => {
    if (grid?.parent) { grid.parent.remove(grid); }
    grid?.geometry?.dispose?.();
    if (Array.isArray(grid?.material)) {
      grid.material.forEach((m) => m?.dispose?.());
    } else {
      grid?.material?.dispose?.();
    }
  });
  guideAddGridPicks.length = 0;
  guideAddGrids.length = 0;
  changeAngleGridTarget = null;
}

function addGuideGridFromState(state) {
  const pos = Array.isArray(state?.position) ? state.position : [0, 0, 0];
  const quat = Array.isArray(state?.quaternion) ? state.quaternion : [0, 0, 0, 1];
  const newGrid = new THREE.GridHelper(ADD_POINT_GRID_SIZE, ADD_POINT_GRID_DIVISIONS, GUIDE_ADD_GRID_COLOR, GUIDE_ADD_GRID_COLOR);
  newGrid.name = 'AddPointGuideGridClone';
  newGrid.position.set(Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0);
  newGrid.quaternion.set(Number(quat[0]) || 0, Number(quat[1]) || 0, Number(quat[2]) || 0, Number(quat[3]) || 1).normalize();
  if (state?.changeAnglePanelAngles && typeof state.changeAnglePanelAngles === 'object') {
    newGrid.userData = {
      ...(newGrid.userData || {}),
      changeAnglePanelAngles: {
        x: Number(state.changeAnglePanelAngles.x) || 0,
        y: Number(state.changeAnglePanelAngles.y) || 0,
        z: Number(state.changeAnglePanelAngles.z) || 0,
      },
    };
  }
  scene.add(newGrid);
  guideAddGrids.push(newGrid);
  const pick = new THREE.Mesh(
    new THREE.PlaneGeometry(ADD_POINT_GRID_SIZE, ADD_POINT_GRID_SIZE),
    createRaycastOnlyMaterial()
  );
  pick.name = 'GuideAddGridPick';
  syncGuidePickMeshFromGrid(newGrid, pick);
  pick.userData = { ...pick.userData, guideAddGrid: newGrid };
  newGrid.userData = { ...(newGrid.userData || {}), pickMesh: pick };
  scene.add(pick);
  guideAddGridPicks.push(pick);
}

console.log(new THREE.Vector3(5.5, y, -50))

let group_object = []
let group_targetObjects = []
let group_EditNow = 'None'
let createModeWorldFocused = false
const createModeHiddenObjects = new Map()
let sinjyukuCity = null
let baseMapRoot = null
let differencePreviewTube = null
const differenceSpacePlanes = []
let differenceSelectedPlane = null
let differenceFaceHighlight = null
const differenceSelectedFaceHighlights = []
const differenceSelectedBodyHighlights = []
const differenceSelectedEdgeHighlights = []
const differenceEdgeFaceIntersectionMarkers = []
const differenceFaceFaceIntersectionLines = []
const differencePenetrationEdgeLines = []
const differencePreviewWireframeLines = []
const differenceClassifiedYellowSegments = []
const differenceClassifiedOrangeSegments = []
const differenceClassifiedRedSegments = []
const differenceClassifiedOrangeEdgeKeys = new Set()
const differenceClassifiedRedEdgeKeys = new Set()
const differenceClassifiedEdgePriority = new Map()
var differenceViewMode = 'diff'
let differenceHoverFaceKey = null
let differenceHoveredFaceHit = null
const differenceSelectedControlPoints = new Set()
const differenceSelectedFaces = new Map()
const differenceSelectedEdges = new Map()
const differenceSelectedBodies = new Map()
let differenceSelectionKind = 'none'
const differenceSharedPointLinkEpsilon = 0.02
const differenceAutoMergeDistance = 0.08
const differenceBoundaryMergeDistance = 0.06
const differenceMoveRangeFromStart = 30
const differenceEdgeOverlapConstraints = []
const differenceIntersectionPointRadius = 0.035
const differenceIntersectionLineRadius = 0.01
const differencePenetrationEdgeRadius = 0.013
const differenceContactEpsilon = 0.008
const differenceRayHitEpsilon = 0.003
const differencePseudoExpandEpsilon = 0.0015
const differenceDragRefreshIntervalMs = 120
let differenceLastIntersectionRefreshAt = 0
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
let differenceMoveHitEdge = null
let differenceMoveHitBody = null
let differenceAddClickPending = false
let differenceAddDownPos = null
let differenceAddShouldCreate = false
const differenceCsgEvaluator = new Evaluator()
const differenceCsgOperation = HOLLOW_SUBTRACTION
let addPointGridActive = false
let guideAddModeActive = false
const guideAddGrids = []
const guideAddGridPicks = []
const decorationObjects = []
let changeAngleGridTarget = null
let addPointGridY = 0
let addPointGridInitialized = false
const GUIDE_ADD_GRID_COLOR = 0x88aa88;
const GUIDE_ADD_GRID_SELECTED_COLOR = 0x00ff00;
const searchGridVisuals = [];
let searchSelectedGrid = null;
const HISTORY_LIMIT = 100;
const HISTORY_EPS = 1e-5;
const createUndoStack = [];
const createRedoStack = [];
const differenceUndoStack = [];
const differenceRedoStack = [];
let historyApplying = false;
let moveHistoryStart = null;
let differenceHistoryApplying = false;
let differenceHistoryStartSnapshot = null;
updateDifferenceUnifyButtonState();

function getActiveHistoryContext() {
  try {
    if (editObject === 'DIFFERENCE_SPACE' || differenceSpaceModeActive) {
      return 'difference';
    }
    return 'create';
  } catch (err) {
    // let 宣言前(TDZ)の初期化順でも安全に create 側を返す
    return 'create';
  }
}

function updateUndoRedoButtons() {
  const context = getActiveHistoryContext();
  const undoStack = context === 'difference' ? differenceUndoStack : createUndoStack;
  const redoStack = context === 'difference' ? differenceRedoStack : createRedoStack;
  if (undoActionButton) {
    undoActionButton.disabled = undoStack.length === 0;
  }
  if (redoActionButton) {
    redoActionButton.disabled = redoStack.length === 0;
  }
}

function vecMoved(a, b, eps = HISTORY_EPS) {
  if (!a || !b) { return false; }
  return Math.abs(a.x - b.x) > eps
    || Math.abs(a.y - b.y) > eps
    || Math.abs(a.z - b.z) > eps;
}

  function refreshCreateTargetsForSearch() {
    if (editObject !== 'STEEL_FRAME') { return; }
    const activeDecorations = decorationObjects.filter((mesh) => mesh?.parent);
    const constructionObjects = getConstructionCopyTargets();
    if (objectEditMode === 'CREATE_NEW') {
      targetObjects = steelFrameMode.getCurrentPointMeshes()
        .concat(guideRailPickMeshes)
        .concat(activeDecorations);
    } else if (objectEditMode === 'MOVE_EXISTING') {
      targetObjects = steelFrameMode.getAllPointMeshes().concat(activeDecorations);
    } else if (objectEditMode === 'COPY') {
      targetObjects = steelFrameMode.getAllPointMeshes().concat(constructionObjects);
    } else if (objectEditMode === 'STYLE') {
      targetObjects = constructionObjects;
    }
  }

function syncGuideCurveFromPointMesh(mesh) {
  if (!mesh?.userData?.guideCurve || typeof mesh.userData.guideControlIndex !== 'number') { return; }
  const curve = mesh.userData.guideCurve;
  const idx = mesh.userData.guideControlIndex;
  if (curve?.userData?.controlPoints && curve.userData.controlPoints[idx]) {
    curve.userData.controlPoints[idx] = mesh.position.clone();
    updateGuideCurve(curve);
  }
}

function syncGridFromHandle() {
  if (!addPointGridHandle || !AddPointGuideGrid) { return; }
  addPointGridY = addPointGridHandle.position.y;
  AddPointGuideGrid.position.copy(addPointGridHandle.position);
}

function syncGuideGridFromObject(mesh) {
  if (!GuideGrid) { return; }
  if (!mesh?.position) {
    GuideGrid.quaternion.identity();
    return;
  }
  GuideGrid.position.copy(mesh.position);
  const planeQuat = mesh?.userData?.planeRef?.quaternion;
  if (planeQuat?.isQuaternion && !move_direction_y) {
    GuideGrid.quaternion.copy(planeQuat).normalize();
  } else {
    GuideGrid.quaternion.identity();
  }
}

function pushCreateHistory(action) {
  if (historyApplying || !action) { return; }
  createUndoStack.push(action);
  if (createUndoStack.length > HISTORY_LIMIT) {
    createUndoStack.shift();
  }
  createRedoStack.length = 0;
  updateUndoRedoButtons();
  updateDifferenceUnifyButtonState();
}

function clearCreateHistory() {
  createUndoStack.length = 0;
  createRedoStack.length = 0;
  moveHistoryStart = null;
  updateUndoRedoButtons();
}

function captureDifferenceSnapshot() {
  return differenceSpacePlanes
    .filter((mesh) => mesh?.parent && mesh?.userData?.differenceSpacePlane)
    .map((mesh) => serializeDifferenceSpaceMesh(mesh))
    .filter(Boolean);
}

function isSameDifferenceSnapshot(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyDifferenceSnapshot(snapshot) {
  clearDifferenceSpacesForImport();
  const list = Array.isArray(snapshot) ? snapshot : [];
  list.forEach((rawSpace) => {
    const geometry = buildGeometryFromSerializedSpace(rawSpace);
    if (!geometry) { return; }
    const mesh = createDifferenceSpaceMeshFromGeometry(geometry, null);
    const pos = Array.isArray(rawSpace.position) ? rawSpace.position : [0, 0, 0];
    const quat = Array.isArray(rawSpace.quaternion) ? rawSpace.quaternion : [0, 0, 0, 1];
    const scl = Array.isArray(rawSpace.scale) ? rawSpace.scale : [1, 1, 1];
    mesh.position.set(Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0);
    mesh.quaternion.set(Number(quat[0]) || 0, Number(quat[1]) || 0, Number(quat[2]) || 0, Number(quat[3]) || 1);
    mesh.scale.set(Number(scl[0]) || 1, Number(scl[1]) || 1, Number(scl[2]) || 1);
    mesh.updateMatrixWorld(true);
    rebuildDifferenceControlPointsFromGeometry(mesh);
    syncDifferenceGeometryFromControlPoints(mesh);
  });
  relinkImportedDifferenceSharedPoints();
  targetObjects = differenceSpacePlanes.filter((m) => m?.parent);
  setMeshListOpacity(targetObjects, 1);
  refreshDifferencePreview();
  updateDifferenceStatus(`Difference履歴を適用: 空間 ${differenceSpacePlanes.length} 件`);
  updateDifferenceUnifyButtonState();
}

function pushDifferenceHistory(action) {
  if (historyApplying || differenceHistoryApplying || !action) { return; }
  differenceUndoStack.push(action);
  if (differenceUndoStack.length > HISTORY_LIMIT) {
    differenceUndoStack.shift();
  }
  differenceRedoStack.length = 0;
  updateUndoRedoButtons();
}

function clearDifferenceHistory() {
  differenceUndoStack.length = 0;
  differenceRedoStack.length = 0;
  differenceHistoryStartSnapshot = null;
  updateUndoRedoButtons();
}

function beginDifferenceHistorySession() {
  if (historyApplying || differenceHistoryApplying) { return; }
  if (differenceHistoryStartSnapshot) { return; }
  differenceHistoryStartSnapshot = captureDifferenceSnapshot();
}

function commitDifferenceHistoryIfNeeded() {
  if (!differenceHistoryStartSnapshot) { return; }
  const before = differenceHistoryStartSnapshot;
  const after = captureDifferenceSnapshot();
  differenceHistoryStartSnapshot = null;
  if (isSameDifferenceSnapshot(before, after)) { return; }
  pushDifferenceHistory({
    type: 'difference_snapshot',
    before,
    after,
  });
}

function applyDifferenceHistory(action, mode) {
  if (!action || action.type !== 'difference_snapshot') { return; }
  differenceHistoryApplying = true;
  try {
    if (mode === 'undo') {
      applyDifferenceSnapshot(action.before);
    } else {
      applyDifferenceSnapshot(action.after);
    }
  } finally {
    differenceHistoryApplying = false;
  }
}

function undoDifferenceHistory() {
  if (differenceUndoStack.length === 0) { return; }
  const action = differenceUndoStack.pop();
  applyDifferenceHistory(action, 'undo');
  differenceRedoStack.push(action);
  updateUndoRedoButtons();
}

function redoDifferenceHistory() {
  if (differenceRedoStack.length === 0) { return; }
  const action = differenceRedoStack.pop();
  applyDifferenceHistory(action, 'redo');
  differenceUndoStack.push(action);
  updateUndoRedoButtons();
}

function undoHistoryByContext() {
  if (getActiveHistoryContext() === 'difference') {
    undoDifferenceHistory();
  } else {
    undoCreateHistory();
  }
}

function redoHistoryByContext() {
  if (getActiveHistoryContext() === 'difference') {
    redoDifferenceHistory();
  } else {
    redoCreateHistory();
  }
}

function applyCreateHistory(action, mode) {
  if (!action) { return; }
  historyApplying = true;
  try {
    if (action.type === 'add_points') {
      if (mode === 'undo') {
        action.items.forEach((item) => {
          steelFrameMode.removePointMesh(item.mesh);
        });
      } else {
        action.items.forEach((item) => {
          steelFrameMode.addExistingPoint(item.mesh, item.lineIndex);
        });
      }
      refreshCreateTargetsForSearch();
      drawingObject();
      return;
    }
    if (action.type === 'copy_items') {
      const pointItems = Array.isArray(action.pointItems) ? action.pointItems : [];
      const objectItems = Array.isArray(action.objectItems) ? action.objectItems : [];
      if (mode === 'undo') {
        pointItems.forEach((item) => {
          steelFrameMode.removePointMesh(item.mesh);
        });
        objectItems.forEach((mesh) => {
          if (mesh?.parent) {
            mesh.parent.remove(mesh);
          }
          if (mesh?.name === 'SteelFrameSegment') {
            unregisterCopyObject(mesh);
            steelFrameMode?.removeExistingSegmentMesh?.(mesh);
          }
        });
      } else {
        pointItems.forEach((item) => {
          steelFrameMode.addExistingPoint(item.mesh, item.lineIndex);
        });
        objectItems.forEach((mesh) => {
          if (!mesh?.parent) {
            scene.add(mesh);
          }
          if (mesh?.name === 'SteelFrameSegment') {
            registerCopyObject(mesh);
            steelFrameMode?.addExistingSegmentMesh?.(mesh);
          }
        });
      }
      refreshCreateTargetsForSearch();
      drawingObject(pointItems.map((item) => item.mesh));
      return;
    }
    if (action.type === 'move_meshes') {
      action.items.forEach((item) => {
        const next = mode === 'undo' ? item.before : item.after;
        item.mesh.position.copy(next);
        syncGuideCurveFromPointMesh(item.mesh);
      });
      if (action.includesGridHandle) {
        syncGridFromHandle();
      }
      drawingObject(action.items.map((item) => item.mesh));
      return;
    }
    if (action.type === 'add_guide_grid') {
      const { grid, pick } = action;
      if (mode === 'undo') {
        const gIdx = guideAddGrids.indexOf(grid);
        if (gIdx >= 0) {
          guideAddGrids.splice(gIdx, 1);
        }
        const pIdx = guideAddGridPicks.indexOf(pick);
        if (pIdx >= 0) {
          guideAddGridPicks.splice(pIdx, 1);
        }
        if (grid?.parent) {
          grid.parent.remove(grid);
        }
        if (pick?.parent) {
          pick.parent.remove(pick);
        }
      } else {
        if (grid && !grid.parent) {
          scene.add(grid);
        }
        if (pick && !pick.parent) {
          scene.add(pick);
        }
        if (grid && !guideAddGrids.includes(grid)) {
          guideAddGrids.push(grid);
        }
        if (pick && !guideAddGridPicks.includes(pick)) {
          guideAddGridPicks.push(pick);
        }
      }
      changeAngleGridTarget = guideAddGrids.length > 0 ? guideAddGrids[guideAddGrids.length - 1] : null;
      refreshCreateTargetsForSearch();
      drawingObject();
      return;
    }
    if (action.type === 'add_decoration') {
      const items = Array.isArray(action.items) ? action.items : [];
      if (mode === 'undo') {
        items.forEach((mesh) => {
          if (mesh === choice_object) {
            choice_object = false;
          }
          if (mesh?.parent) {
            mesh.parent.remove(mesh);
          }
        });
      } else {
        items.forEach((mesh) => {
          if (!mesh?.parent) {
            scene.add(mesh);
          }
          if (mesh && !decorationObjects.includes(mesh)) {
            decorationObjects.push(mesh);
          }
        });
      }
      refreshCreateTargetsForSearch();
      drawingObject();
      return;
    }
  } finally {
    historyApplying = false;
  }
}

function undoCreateHistory() {
  if (createUndoStack.length === 0) { return; }
  const action = createUndoStack.pop();
  applyCreateHistory(action, 'undo');
  createRedoStack.push(action);
  updateUndoRedoButtons();
}

function redoCreateHistory() {
  if (createRedoStack.length === 0) { return; }
  const action = createRedoStack.pop();
  applyCreateHistory(action, 'redo');
  createUndoStack.push(action);
  updateUndoRedoButtons();
}

function captureMoveHistoryStart() {
  if (editObject !== 'STEEL_FRAME' || objectEditMode !== 'MOVE_EXISTING' || !choice_object) {
    return null;
  }
  const items = (moveDragStartPositions.length > 0)
    ? moveDragStartPositions.map(({ mesh, pos }) => ({ mesh, before: pos.clone(), after: null }))
    : [{ mesh: choice_object, before: choice_object.position.clone(), after: null }];
  return {
    type: 'move_meshes',
    items,
    includesGridHandle: items.some((it) => it.mesh === addPointGridHandle),
  };
}

function commitMoveHistoryIfNeeded() {
  if (!moveHistoryStart || !Array.isArray(moveHistoryStart.items)) {
    moveHistoryStart = null;
    return;
  }
  const items = moveHistoryStart.items
    .map((it) => ({ ...it, after: it.mesh?.position?.clone?.() || null }))
    .filter((it) => it.after && vecMoved(it.before, it.after));
  if (items.length > 0) {
    pushCreateHistory({
      type: 'move_meshes',
      items,
      includesGridHandle: items.some((it) => it.mesh === addPointGridHandle),
    });
  }
  moveHistoryStart = null;
}
updateUndoRedoButtons();

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
  scene.userData = scene.userData || {};
  scene.userData.createModeWorldFocused = Boolean(enable);
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

    if (!baseMapRoot) {
      baseMapRoot = scene.getObjectByName('base_map');
    }
    if (baseMapRoot) {
      if (!createModeHiddenObjects.has(baseMapRoot)) {
        createModeHiddenObjects.set(baseMapRoot, baseMapRoot.visible);
      }
      baseMapRoot.visible = false;
    }
    Trains.forEach((trainGroup) => {
      if (!trainGroup) { return; }
      if (!createModeHiddenObjects.has(trainGroup)) {
        createModeHiddenObjects.set(trainGroup, trainGroup.visible);
      }
      trainGroup.visible = false;
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

function syncSinjyukuCityVisibility() {
  if (!sinjyukuCity) {
    sinjyukuCity = scene.getObjectByName('sinjyuku_city');
  }
  if (!sinjyukuCity) { return; }
  const shouldShow = Boolean(createModeWorldFocused && OperationMode === 1);
  if (sinjyukuCity.visible !== shouldShow) {
    sinjyukuCity.visible = shouldShow;
  }
}

function clearDifferencePreviewTube() {
  purgeDifferencePreviewCuttersInScene();
  differencePreviewTube = null;
}

function purgeDifferencePreviewCuttersInScene() {
  const cutters = [];
  scene.traverse((obj) => {
    if (!obj?.isMesh) { return; }
    if (obj.name === 'DifferencePreviewCutter') {
      cutters.push(obj);
    }
  });
  cutters.forEach((obj) => {
    if (obj.parent) {
      obj.parent.remove(obj);
    }
    obj.geometry?.dispose?.();
    if (Array.isArray(obj.material)) {
      obj.material.forEach((m) => m?.dispose?.());
    } else {
      obj.material?.dispose?.();
    }
  });
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

function clearDifferenceSelectedBodyHighlights() {
  while (differenceSelectedBodyHighlights.length > 0) {
    const helper = differenceSelectedBodyHighlights.pop();
    if (!helper) { continue; }
    if (helper.parent) {
      helper.parent.remove(helper);
    }
    helper.geometry?.dispose?.();
    helper.material?.dispose?.();
  }
}

function clearDifferenceSelectedEdgeHighlights() {
  while (differenceSelectedEdgeHighlights.length > 0) {
    const edgeObj = differenceSelectedEdgeHighlights.pop();
    if (!edgeObj) { continue; }
    if (edgeObj.parent) {
      edgeObj.parent.remove(edgeObj);
    }
    edgeObj.traverse?.((node) => {
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) {
        node.material.forEach((m) => m?.dispose?.());
      } else {
        node.material?.dispose?.();
      }
    });
    edgeObj.geometry?.dispose?.();
    if (Array.isArray(edgeObj.material)) {
      edgeObj.material.forEach((m) => m?.dispose?.());
    } else {
      edgeObj.material?.dispose?.();
    }
  }
}

function clearDifferenceIntersectionVisuals() {
  while (differenceEdgeFaceIntersectionMarkers.length > 0) {
    const marker = differenceEdgeFaceIntersectionMarkers.pop();
    if (!marker) { continue; }
    if (marker.parent) { marker.parent.remove(marker); }
    marker.geometry?.dispose?.();
    marker.material?.dispose?.();
  }
  while (differenceFaceFaceIntersectionLines.length > 0) {
    const line = differenceFaceFaceIntersectionLines.pop();
    if (!line) { continue; }
    if (line.parent) { line.parent.remove(line); }
    line.geometry?.dispose?.();
    line.material?.dispose?.();
  }
  while (differencePenetrationEdgeLines.length > 0) {
    const line = differencePenetrationEdgeLines.pop();
    if (!line) { continue; }
    if (line.parent) { line.parent.remove(line); }
    line.geometry?.dispose?.();
    line.material?.dispose?.();
  }
}

function createDifferenceIntersectionPointMarker(position) {
  const geom = new THREE.SphereGeometry(differenceIntersectionPointRadius, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xadff2f,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(position);
  mesh.renderOrder = 2480;
  return mesh;
}

function createDifferenceIntersectionLine(a, b, color = 0xffea00, radius = differenceIntersectionLineRadius, renderOrder = 2470) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-6) { return null; }
  const geom = new THREE.CylinderGeometry(
    radius,
    radius,
    len,
    10,
    1,
    false,
  );
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
  });
  const segment = new THREE.Mesh(geom, mat);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  segment.position.copy(mid);
  const up = new THREE.Vector3(0, 1, 0);
  segment.quaternion.setFromUnitVectors(up, dir.normalize());
  segment.renderOrder = renderOrder;
  return segment;
}

function distancePointToTriangle(point, tri) {
  if (!point || !Array.isArray(tri) || tri.length < 3) { return Infinity; }
  const triangle = new THREE.Triangle(tri[0], tri[1], tri[2]);
  const closest = triangle.closestPointToPoint(point, new THREE.Vector3());
  return closest.distanceTo(point);
}

function isPointNearDifferenceSurface(point, tris, eps = differenceContactEpsilon) {
  if (!point || !Array.isArray(tris) || tris.length < 1) { return false; }
  const epsSq = eps * eps;
  for (let i = 0; i < tris.length; i += 1) {
    const tri = tris[i];
    const d = distancePointToTriangle(point, tri);
    if (d * d <= epsSq) {
      return true;
    }
  }
  return false;
}

function pointInsideDifferenceMeshByRay(point, tris, dir, eps = differenceRayHitEpsilon) {
  const ray = new THREE.Ray(point.clone(), dir.clone().normalize());
  const hits = [];
  for (let i = 0; i < tris.length; i += 1) {
    const tri = tris[i];
    const hit = ray.intersectTriangle(tri[0], tri[1], tri[2], false, new THREE.Vector3());
    if (!hit) { continue; }
    const t = hit.clone().sub(point).dot(ray.direction);
    if (t <= eps) { continue; }
    const isDup = hits.some((p) => p.distanceToSquared(hit) <= eps * eps);
    if (!isDup) {
      hits.push(hit);
    }
  }
  return (hits.length % 2) === 1;
}

function classifyPointInsideState(point, tris, {
  rayEps = differenceRayHitEpsilon,
  surfaceEps = differenceContactEpsilon,
  expandEps = differencePseudoExpandEpsilon,
} = {}) {
  if (!point || !Array.isArray(tris) || tris.length < 1) { return -1; }
  // 0: boundary(不確定), 1: inside, -1: outside
  const isNearSurface = isPointNearDifferenceSurface(point, tris, Math.max(1e-4, surfaceEps));
  // 単一レイだと面向きや頂点付近で揺れるため、複数方向の多数決で inside を決める。
  const dirs = [
    new THREE.Vector3(0.373, 0.781, 0.499),
    new THREE.Vector3(-0.611, 0.522, 0.596),
    new THREE.Vector3(0.284, -0.739, 0.611),
    new THREE.Vector3(-0.217, -0.864, -0.454),
    new THREE.Vector3(0.746, -0.226, -0.626),
  ];
  let insideCount = 0;
  for (let i = 0; i < dirs.length; i += 1) {
    if (pointInsideDifferenceMeshByRay(point, tris, dirs[i], rayEps)) {
      insideCount += 1;
    }
  }

  // 密着時でも判別できるよう、近傍サンプルで強制的に inside/outside を決める。
  if (isNearSurface) {
    const nearOffsets = [
      new THREE.Vector3(expandEps, 0, 0),
      new THREE.Vector3(-expandEps, 0, 0),
      new THREE.Vector3(0, expandEps, 0),
      new THREE.Vector3(0, -expandEps, 0),
      new THREE.Vector3(0, 0, expandEps),
      new THREE.Vector3(0, 0, -expandEps),
    ];
    let nearInsideVotes = 0;
    let nearTotalVotes = 0;
    for (let i = 0; i < nearOffsets.length; i += 1) {
      const p = point.clone().add(nearOffsets[i]);
      for (let j = 0; j < dirs.length; j += 1) {
        nearTotalVotes += 1;
        if (pointInsideDifferenceMeshByRay(p, tris, dirs[j], rayEps)) {
          nearInsideVotes += 1;
        }
      }
    }
    if (nearInsideVotes > (nearTotalVotes * 0.5)) { return 1; }
    if (nearInsideVotes < (nearTotalVotes * 0.5)) { return -1; }
    // 同数のみ不確定
    return 0;
  }

  if (insideCount >= 4) { return 1; }
  if (insideCount <= 1) {
    // ほんの少しだけ擬似拡張判定。inside 確証が高い場合のみ inside にする。
    if (expandEps > 0) {
      const offsets = [
        new THREE.Vector3(expandEps, 0, 0),
        new THREE.Vector3(-expandEps, 0, 0),
        new THREE.Vector3(0, expandEps, 0),
        new THREE.Vector3(0, -expandEps, 0),
        new THREE.Vector3(0, 0, expandEps),
        new THREE.Vector3(0, 0, -expandEps),
      ];
      let expandedInside = 0;
      for (let i = 0; i < offsets.length; i += 1) {
        const p = point.clone().add(offsets[i]);
        let c = 0;
        for (let j = 0; j < dirs.length; j += 1) {
          if (pointInsideDifferenceMeshByRay(p, tris, dirs[j], rayEps)) {
            c += 1;
          }
        }
        if (c >= 4) {
          expandedInside += 1;
        }
      }
      if (expandedInside >= 3) { return 1; }
    }
    return -1;
  }
  return 0;
}

function pointInsideDifferenceMeshStrict(point, tris, eps = differenceRayHitEpsilon) {
  return classifyPointInsideState(point, tris, {
    rayEps: eps,
    surfaceEps: differenceContactEpsilon,
    expandEps: differencePseudoExpandEpsilon,
  }) === 1;
}

function pointInsideDifferenceMeshExpanded(point, tris, expandEps = differencePseudoExpandEpsilon) {
  return classifyPointInsideState(point, tris, {
    rayEps: differenceRayHitEpsilon,
    surfaceEps: differenceContactEpsilon,
    expandEps,
  }) === 1;
}

function isContactOnlySegment(a, b, tris) {
  if (!a || !b || !Array.isArray(tris) || tris.length < 1) { return false; }
  const s0 = classifyPointInsideState(a, tris);
  const s1 = classifyPointInsideState(b, tris);
  if (s0 === 1 || s1 === 1) { return false; }
  const mid = a.clone().lerp(b, 0.5);
  const sm = classifyPointInsideState(mid, tris);
  if (sm === 1) { return false; }
  const hitCount = getSegmentTriangleHitCount(a, b, tris, 0.008);
  if (hitCount > 0) { return false; }
  // 境界付近のみで、交差ヒットも inside も無いときだけ contact-only 扱い。
  return s0 === 0 || s1 === 0 || sm === 0;
}

function getInsideIntervalsOnSegment(a, b, tris, sampleCount = 12, maxDepthOpt = 6) {
  if (!a || !b || !Array.isArray(tris) || tris.length < 1) { return []; }
  if (a.distanceToSquared(b) <= 1e-10) { return []; }
  const n = Math.max(16, sampleCount * 2);
  const step = 1 / n;
  const stateAt = (t) => {
    const p = a.clone().lerp(b, THREE.MathUtils.clamp(t, 0, 1));
    let s = classifyPointInsideState(p, tris);
    if (s !== 0) { return s; }
    // boundary を局所サンプルで inside/outside に寄せる
    const dt = Math.max(0.001, step * 0.5);
    const sPrev = classifyPointInsideState(a.clone().lerp(b, Math.max(0, t - dt)), tris);
    const sNext = classifyPointInsideState(a.clone().lerp(b, Math.min(1, t + dt)), tris);
    if (sPrev === 1 || sNext === 1) { return 1; }
    if (sPrev === -1 || sNext === -1) { return -1; }
    return 0;
  };

  const tsSet = new Set();
  for (let i = 0; i <= n; i += 1) {
    tsSet.add(Number((i * step).toFixed(6)));
  }
  const hitTs = getSegmentTriangleHitTs(a, b, tris, 0.004);
  hitTs.forEach((t) => {
    tsSet.add(Number(t.toFixed(6)));
    tsSet.add(Number(Math.max(0, t - step * 0.5).toFixed(6)));
    tsSet.add(Number(Math.min(1, t + step * 0.5).toFixed(6)));
  });
  const ts = Array.from(tsSet).sort((x, y) => x - y);
  const intervals = [];
  const maxDepth = Math.max(1, maxDepthOpt);
  const walk = (t0, t1, s0, s1, depth) => {
    if ((t1 - t0) <= 1e-5) { return; }
    const tm = (t0 + t1) * 0.5;
    const sm = stateAt(tm);
    const hasInside = s0 === 1 || s1 === 1 || sm === 1;
    const uncertain = s0 === 0 || s1 === 0 || sm === 0 || s0 !== s1 || s0 !== sm || s1 !== sm;
    if (uncertain && depth < maxDepth) {
      walk(t0, tm, s0, sm, depth + 1);
      walk(tm, t1, sm, s1, depth + 1);
      return;
    }
    if (hasInside) {
      intervals.push([t0, t1]);
    }
  };
  for (let i = 0; i < ts.length - 1; i += 1) {
    const t0 = ts[i];
    const t1 = ts[i + 1];
    if ((t1 - t0) <= 1e-5) { continue; }
    walk(t0, t1, stateAt(t0), stateAt(t1), 0);
  }
  return mergeUnitIntervals(intervals);
}

function isDifferenceHeavyDragActive() {
  return Boolean(
    differenceControlPointDragActive
    || differenceFaceVertexDragActive
    || pointRotateDragging
    || pointRotateMoveDragging
    || dragging,
  );
}

function pointInsideDifferenceMesh(point, tris, eps = differenceRayHitEpsilon) {
  // 表示補助用: 密着点は inside 扱いに寄せる
  if (isPointNearDifferenceSurface(point, tris, differenceContactEpsilon)) {
    return true;
  }
  return pointInsideDifferenceMeshStrict(point, tris, eps);
}

function getSegmentTriangleHitCount(a, b, tris, eps = 0.012) {
  if (!a || !b || !Array.isArray(tris) || tris.length < 1) { return 0; }
  const hits = [];
  for (let i = 0; i < tris.length; i += 1) {
    const hit = intersectSegmentTriangle(a, b, tris[i]);
    if (!hit) { continue; }
    const isDup = hits.some((p) => p.distanceToSquared(hit) <= eps * eps);
    if (!isDup) {
      hits.push(hit);
    }
  }
  return hits.length;
}

function getSegmentTriangleHitTs(a, b, tris, eps = 0.012) {
  if (!a || !b || !Array.isArray(tris) || tris.length < 1) { return []; }
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-7) { return []; }
  const rayDir = dir.clone().multiplyScalar(1 / len);
  const ts = [];
  for (let i = 0; i < tris.length; i += 1) {
    const hit = intersectSegmentTriangle(a, b, tris[i]);
    if (!hit) { continue; }
    const tLen = hit.clone().sub(a).dot(rayDir);
    if (tLen < -1e-5 || tLen > len + 1e-5) { continue; }
    const t = THREE.MathUtils.clamp(tLen / len, 0, 1);
    const isDup = ts.some((v) => Math.abs(v - t) <= eps);
    if (!isDup) {
      ts.push(t);
    }
  }
  ts.sort((x, y) => x - y);
  return ts;
}

function getDifferenceMeshTrianglesWorld(mesh) {
  const geom = mesh?.geometry;
  const pos = geom?.attributes?.position;
  if (!pos) { return []; }
  const out = [];
  const toWorld = mesh.matrixWorld;
  const readWorld = (i) => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(toWorld);
  if (geom.index) {
    const arr = geom.index.array;
    for (let i = 0; i + 2 < arr.length; i += 3) {
      const ia = Number(arr[i]);
      const ib = Number(arr[i + 1]);
      const ic = Number(arr[i + 2]);
      out.push([readWorld(ia), readWorld(ib), readWorld(ic)]);
    }
  } else {
    for (let i = 0; i + 2 < pos.count; i += 3) {
      out.push([readWorld(i), readWorld(i + 1), readWorld(i + 2)]);
    }
  }
  return out;
}

function intersectSegmentTriangle(a, b, tri) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-7) { return null; }
  const ray = new THREE.Ray(a.clone(), dir.clone().multiplyScalar(1 / len));
  const hit = ray.intersectTriangle(tri[0], tri[1], tri[2], false, new THREE.Vector3());
  if (!hit) { return null; }
  const t = hit.clone().sub(a).dot(ray.direction);
  if (t < -differenceRayHitEpsilon || t > len + differenceRayHitEpsilon) { return null; }
  return hit;
}

function dedupeWorldPoints(points, eps = 0.03) {
  const out = [];
  points.forEach((p) => {
    const exists = out.some((q) => q.distanceToSquared(p) <= (eps * eps));
    if (!exists) { out.push(p.clone()); }
  });
  return out;
}

function getTriangleEdges(tri) {
  return [
    [tri[0], tri[1]],
    [tri[1], tri[2]],
    [tri[2], tri[0]],
  ];
}

function getTriangleAABB(tri) {
  return new THREE.Box3().setFromPoints(tri);
}

function simplifyOrderedPointsByAngle(points, angleDegThreshold = 6, minSegmentLength = 1e-3, lineDistanceTol = 0.03) {
  if (!Array.isArray(points) || points.length < 3) { return Array.isArray(points) ? points.slice() : []; }
  let work = points.map((p) => p.clone());
  const radThreshold = THREE.MathUtils.degToRad(Math.max(0.1, angleDegThreshold));
  // 1回では取り切れないので、削除が止まるまで数回反復する。
  for (let pass = 0; pass < 6; pass += 1) {
    if (work.length < 3) { break; }
    const out = [work[0].clone()];
    let removedInPass = false;
    for (let i = 1; i < work.length - 1; i += 1) {
      const prev = out[out.length - 1];
      const curr = work[i];
      const next = work[i + 1];
      const v1 = curr.clone().sub(prev);
      const v2 = next.clone().sub(curr);
      const l1 = v1.length();
      const l2 = v2.length();
      if (l1 < minSegmentLength || l2 < minSegmentLength) {
        removedInPass = true;
        continue;
      }
      v1.multiplyScalar(1 / l1);
      v2.multiplyScalar(1 / l2);
      const angle = Math.acos(THREE.MathUtils.clamp(v1.dot(v2), -1, 1));
      // 直線距離でも判定して、微小なノイズ点を落とす。
      const prevToNext = next.clone().sub(prev);
      const prevToCurr = curr.clone().sub(prev);
      let lineDist = Infinity;
      const baseLenSq = prevToNext.lengthSq();
      if (baseLenSq > 1e-10) {
        const t = THREE.MathUtils.clamp(prevToCurr.dot(prevToNext) / baseLenSq, 0, 1);
        const closest = prev.clone().add(prevToNext.multiplyScalar(t));
        lineDist = curr.distanceTo(closest);
      }
      // 進行方向の変化が小さい（ほぼ直線）点は削除。
      if (angle <= radThreshold || lineDist <= lineDistanceTol) {
        removedInPass = true;
        continue;
      }
      out.push(curr.clone());
    }
    out.push(work[work.length - 1].clone());
    work = out;
    if (!removedInPass) { break; }
  }
  return work;
}

function orderPointsAsChain(points, nearTol = 0.06) {
  if (!Array.isArray(points) || points.length < 2) { return Array.isArray(points) ? points.slice() : []; }
  if (points.length === 2) { return [points[0].clone(), points[1].clone()]; }

  const list = points.map((p) => p.clone());
  const n = list.length;
  const nearTolSq = nearTol * nearTol;
  const edges = Array.from({ length: n }, () => []);

  // 近傍グラフを作る（近い点を双方向で接続）
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const d2 = list[i].distanceToSquared(list[j]);
      if (d2 <= nearTolSq) {
        edges[i].push(j);
        edges[j].push(i);
      }
    }
  }

  // 端点候補: 次数1。なければ最遠2点のどちらかを開始点にする。
  const degree1 = [];
  for (let i = 0; i < n; i += 1) {
    if (edges[i].length === 1) { degree1.push(i); }
  }
  let start = degree1.length > 0 ? degree1[0] : 0;
  if (degree1.length < 1) {
    let bestI = 0;
    let bestJ = 1;
    let bestD = list[0].distanceToSquared(list[1]);
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const d = list[i].distanceToSquared(list[j]);
        if (d > bestD) {
          bestD = d;
          bestI = i;
          bestJ = j;
        }
      }
    }
    start = bestI < bestJ ? bestI : bestJ;
  }

  // 連結辿り + 途切れたら未訪問中の最近点へジャンプ
  const ordered = [];
  const visited = new Set();
  let current = start;
  while (visited.size < n) {
    if (!visited.has(current)) {
      ordered.push(list[current].clone());
      visited.add(current);
    }

    let next = null;
    let nextDist = Infinity;
    const neighbors = edges[current] || [];
    for (let i = 0; i < neighbors.length; i += 1) {
      const ni = neighbors[i];
      if (visited.has(ni)) { continue; }
      const d = list[current].distanceToSquared(list[ni]);
      if (d < nextDist) {
        nextDist = d;
        next = ni;
      }
    }
    if (next !== null) {
      current = next;
      continue;
    }

    for (let i = 0; i < n; i += 1) {
      if (visited.has(i)) { continue; }
      const d = list[current].distanceToSquared(list[i]);
      if (d < nextDist) {
        nextDist = d;
        next = i;
      }
    }
    if (next === null) { break; }
    current = next;
  }
  return ordered.length >= 2 ? ordered : list;
}

function dedupeSegmentEndpoints(points, eps = 0.02) {
  if (!Array.isArray(points) || points.length < 2) { return null; }
  const uniq = dedupeWorldPoints(points, eps);
  if (uniq.length < 2) { return null; }
  let bestA = uniq[0];
  let bestB = uniq[1];
  let bestDist = bestA.distanceToSquared(bestB);
  for (let i = 0; i < uniq.length; i += 1) {
    for (let j = i + 1; j < uniq.length; j += 1) {
      const d = uniq[i].distanceToSquared(uniq[j]);
      if (d > bestDist) {
        bestDist = d;
        bestA = uniq[i];
        bestB = uniq[j];
      }
    }
  }
  if (bestDist < 1e-8) { return null; }
  const chainOrdered = orderPointsAsChain(uniq, eps * 2.6);
  const simplified = simplifyOrderedPointsByAngle(chainOrdered, 14, eps * 0.8, eps * 2.4);
  const finalPoints = simplified.length >= 2 ? simplified : chainOrdered;
  return {
    a: finalPoints[0].clone(),
    b: finalPoints[finalPoints.length - 1].clone(),
    points: finalPoints,
  };
}

function getTrianglePairIntersectionSegment(triA, triB) {
  const hits = [];
  const edgesA = getTriangleEdges(triA);
  const edgesB = getTriangleEdges(triB);
  edgesA.forEach((edge) => {
    const hit = intersectSegmentTriangle(edge[0], edge[1], triB);
    if (hit) { hits.push(hit); }
  });
  edgesB.forEach((edge) => {
    const hit = intersectSegmentTriangle(edge[0], edge[1], triA);
    if (hit) { hits.push(hit); }
  });
  return dedupeSegmentEndpoints(hits, 0.02);
}

function getSegmentKey(a, b, eps = 0.02) {
  const qa = `${Math.round(a.x / eps)},${Math.round(a.y / eps)},${Math.round(a.z / eps)}`;
  const qb = `${Math.round(b.x / eps)},${Math.round(b.y / eps)},${Math.round(b.z / eps)}`;
  return qa < qb ? `${qa}|${qb}` : `${qb}|${qa}`;
}

function splitYellowSegmentByOtherSpaces(segA, segB, meshA, meshB, meshes, trisCache) {
  if (!segA || !segB || !Array.isArray(meshes)) {
    return [{ a: segA?.clone?.(), b: segB?.clone?.(), cls: 'yellow' }].filter((s) => s.a && s.b);
  }
  const segLenSq = segA.distanceToSquared(segB);
  if (segLenSq <= 1e-10) {
    return [{ a: segA.clone(), b: segB.clone(), cls: 'yellow' }];
  }
  const segBox = new THREE.Box3().setFromPoints([segA, segB]);
  const breakTs = [0, 1];
  const targetTrisList = [];
  for (let i = 0; i < meshes.length; i += 1) {
    const mesh = meshes[i];
    if (!mesh?.parent || mesh === meshA || mesh === meshB) { continue; }
    const box = new THREE.Box3().setFromObject(mesh);
    if (!segBox.intersectsBox(box)) { continue; }
    const tris = trisCache.get(mesh) || [];
    if (tris.length < 1) { continue; }
    if (isContactOnlySegment(segA, segB, tris)) { continue; }
    targetTrisList.push(tris);
    const ts = getSegmentTriangleHitTs(segA, segB, tris, 0.004);
    ts.forEach((t) => breakTs.push(t));
  }
  if (targetTrisList.length < 1) {
    return [{ a: segA.clone(), b: segB.clone(), cls: 'yellow' }];
  }

  const uniqTs = Array.from(new Set(breakTs.map((t) => Number(t.toFixed(5)))))
    .filter((t) => Number.isFinite(t) && t >= 0 && t <= 1)
    .sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < uniqTs.length - 1; i += 1) {
    const t0 = uniqTs[i];
    const t1 = uniqTs[i + 1];
    if ((t1 - t0) <= 1e-4) { continue; }
    const a = segA.clone().lerp(segB, t0);
    const b = segA.clone().lerp(segB, t1);
    const mid = segA.clone().lerp(segB, (t0 + t1) * 0.5);
    let insideCount = 0;
    targetTrisList.forEach((tris) => {
      const sm = classifyPointInsideState(mid, tris);
      if (sm === 1) {
        insideCount += 1;
      }
    });
    out.push({
      a,
      b,
      cls: insideCount > 0 ? 'orange' : 'yellow',
    });
  }
  return out.length > 0 ? out : [{ a: segA.clone(), b: segB.clone(), cls: 'yellow' }];
}

function getDifferenceSourceEdgeKeyByWorldPoints(a, b, eps = 0.01) {
  return getSegmentKey(a, b, Math.max(1e-6, eps));
}

function clearDifferencePreviewWireframeLines() {
  while (differencePreviewWireframeLines.length > 0) {
    const line = differencePreviewWireframeLines.pop();
    if (!line) { continue; }
    if (line.parent) { line.parent.remove(line); }
    line.geometry?.dispose?.();
    line.material?.dispose?.();
  }
}

function clearDifferenceClassifiedSegments() {
  differenceClassifiedYellowSegments.length = 0;
  differenceClassifiedOrangeSegments.length = 0;
  differenceClassifiedRedSegments.length = 0;
  differenceClassifiedOrangeEdgeKeys.clear();
  differenceClassifiedRedEdgeKeys.clear();
  differenceClassifiedEdgePriority.clear();
}

function setDifferenceEdgePriority(edgeKey, level) {
  if (!edgeKey) { return; }
  const prev = differenceClassifiedEdgePriority.get(edgeKey) || 0;
  if (level > prev) {
    differenceClassifiedEdgePriority.set(edgeKey, level);
  }
}

function setDifferenceMeshFacesVisible(visible) {
  const spaces = getActiveDifferenceSpaces();
  spaces.forEach((mesh) => {
    const applyMaterial = (material) => {
      if (!material) { return; }
      material.transparent = true;
      material.opacity = visible ? 0.5 : 0.0;
      material.depthWrite = visible;
      material.needsUpdate = true;
    };
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(applyMaterial);
    } else {
      applyMaterial(mesh.material);
    }
    mesh.children.forEach((child) => {
      if (!child?.userData?.differenceControlPoint) { return; }
      child.visible = visible;
    });
  });
}

function getSegmentOverlapLengthApprox(a0, a1, b0, b1, distTol = 0.08, angleDegTol = 10) {
  const da = a1.clone().sub(a0);
  const db = b1.clone().sub(b0);
  const la = da.length();
  const lb = db.length();
  if (la < 1e-6 || lb < 1e-6) { return 0; }
  const ua = da.clone().multiplyScalar(1 / la);
  const ub = db.clone().multiplyScalar(1 / lb);
  const cosTol = Math.cos(THREE.MathUtils.degToRad(angleDegTol));
  if (Math.abs(ua.dot(ub)) < cosTol) { return 0; }

  const lineDist = Math.max(
    distancePointToInfiniteLine(b0, a0, ua),
    distancePointToInfiniteLine(b1, a0, ua),
  );
  if (lineDist > distTol) { return 0; }

  const tA0 = projectPointTOnSegment(a0, a0, a1);
  const tA1 = projectPointTOnSegment(a1, a0, a1);
  const tB0 = projectPointTOnSegment(b0, a0, a1);
  const tB1 = projectPointTOnSegment(b1, a0, a1);
  const minA = Math.min(tA0, tA1);
  const maxA = Math.max(tA0, tA1);
  const minB = Math.min(tB0, tB1);
  const maxB = Math.max(tB0, tB1);
  const overlap = Math.max(0, Math.min(maxA, maxB) - Math.max(minA, minB));
  return overlap * la;
}

function collectSourceEdgeKeysForSegment(segA, segB, candidateEdges = [], maxDiag = 1) {
  if (!segA || !segB || !Array.isArray(candidateEdges) || candidateEdges.length < 1) { return []; }
  const distTol = Math.max(0.05, maxDiag * 0.03);
  const overlapTol = Math.max(0.004, maxDiag * 0.0025);
  const keys = new Set();
  candidateEdges.forEach((edge) => {
    const p0 = edge?.p0;
    const p1 = edge?.p1;
    if (!p0 || !p1) { return; }
    const ov = getSegmentOverlapLengthApprox(segA, segB, p0, p1, distTol, 12);
    if (ov < overlapTol) { return; }
    const key = edge.key || getDifferenceSourceEdgeKeyByWorldPoints(p0, p1);
    keys.add(key);
  });
  return Array.from(keys);
}

function mergeUnitIntervals(intervals) {
  if (!Array.isArray(intervals) || intervals.length < 1) { return []; }
  const sorted = intervals
    .map((it) => [Math.max(0, Math.min(1, it[0])), Math.max(0, Math.min(1, it[1]))])
    .filter((it) => it[1] > it[0])
    .sort((a, b) => a[0] - b[0]);
  if (sorted.length < 1) { return []; }
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur[0] <= last[1] + 1e-6) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

function collectHiddenIntervalsOnEdge(edgeA, edgeB, edgeKey, maxDiag = 1) {
  const hiddenSegs = differenceClassifiedOrangeSegments.concat(differenceClassifiedRedSegments);
  if (hiddenSegs.length < 1) { return []; }
  const intervals = [];
  hiddenSegs.forEach((seg) => {
    const sourceKeys = Array.isArray(seg?.sourceEdgeKeys) ? seg.sourceEdgeKeys : [];
    // 誤判定防止: 「同じ元辺キー」で一致した区間のみ隠す。
    const byKey = sourceKeys.includes(edgeKey);
    if (!byKey) { return; }
    const t0 = THREE.MathUtils.clamp(projectPointTOnSegment(seg.a, edgeA, edgeB), 0, 1);
    const t1 = THREE.MathUtils.clamp(projectPointTOnSegment(seg.b, edgeA, edgeB), 0, 1);
    const s = Math.min(t0, t1);
    const e = Math.max(t0, t1);
    if ((e - s) <= 1e-5) { return; }
    intervals.push([s, e]);
  });
  return mergeUnitIntervals(intervals);
}

function isDifferencePreviewHiddenEdgeByOverlap(p0, p1, maxDiag = 0) {
  const key = getDifferenceSourceEdgeKeyByWorldPoints(p0, p1, 0.01);
  const rank = differenceClassifiedEdgePriority.get(key) || 0;
  if (rank >= 2 || differenceClassifiedRedEdgeKeys.has(key) || differenceClassifiedOrangeEdgeKeys.has(key)) {
    return true;
  }
  // 誤判定防止: 近傍重なりだけで隠さない（キー一致ベースのみ）。
  void maxDiag;
  return false;
}

function drawDifferencePreviewWireframe() {
  clearDifferencePreviewWireframeLines();
  if (differenceViewMode !== 'preview') { return; }
  const spaces = getActiveDifferenceSpaces();
  if (spaces.length < 1) { return; }
  const maxDiag = spaces.reduce((acc, mesh) => {
    mesh.geometry?.computeBoundingBox?.();
    const d = mesh.geometry?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 0;
    return Math.max(acc, d);
  }, 0);
  const previewKeySnap = Math.max(1e-4, maxDiag * 0.002);
  const previewSegKeys = new Set();
  const minDrawLen = Math.max(0.004, maxDiag * 0.0015);
  const addPreviewBlueSegment = (a, b, radius = 0.012) => {
    if (!a || !b) { return; }
    if (a.distanceToSquared(b) < (minDrawLen * minDrawLen)) { return; }
    const qa = `${Math.round(a.x / previewKeySnap)},${Math.round(a.y / previewKeySnap)},${Math.round(a.z / previewKeySnap)}`;
    const qb = `${Math.round(b.x / previewKeySnap)},${Math.round(b.y / previewKeySnap)},${Math.round(b.z / previewKeySnap)}`;
    const key = qa < qb ? `${qa}|${qb}` : `${qb}|${qa}`;
    if (previewSegKeys.has(key)) { return; }
    previewSegKeys.add(key);
    const line = createDifferenceIntersectionLine(a, b, 0x2f6dff, radius, 2468);
    if (!line) { return; }
    scene.add(line);
    differencePreviewWireframeLines.push(line);
  };
  spaces.forEach((mesh) => {
    const edges = getDifferenceMeshControlPointEdges(mesh);
    edges.forEach((edge) => {
      const p0 = edge.pointA.getWorldPosition(new THREE.Vector3());
      const p1 = edge.pointB.getWorldPosition(new THREE.Vector3());
      const edgeKey = getDifferenceSourceEdgeKeyByWorldPoints(p0, p1, 0.01);
      const hiddenIntervals = collectHiddenIntervalsOnEdge(p0, p1, edgeKey, maxDiag);
      if (hiddenIntervals.length < 1) {
        if (!isDifferencePreviewHiddenEdgeByOverlap(p0, p1, maxDiag)) {
          addPreviewBlueSegment(p0, p1, 0.012);
        }
        return;
      }
      let cursor = 0;
      hiddenIntervals.forEach((it) => {
        const s = it[0];
        const e = it[1];
        if (s > cursor + 1e-6) {
          addPreviewBlueSegment(
            p0.clone().lerp(p1, cursor),
            p0.clone().lerp(p1, s),
            0.012,
          );
        }
        cursor = Math.max(cursor, e);
      });
      if (cursor < 1 - 1e-6) {
        addPreviewBlueSegment(
          p0.clone().lerp(p1, cursor),
          p0.clone().lerp(p1, 1),
          0.012,
        );
      }
    });
  });

  differenceClassifiedYellowSegments.forEach((seg) => {
    const sourceKeys = Array.isArray(seg?.sourceEdgeKeys) ? seg.sourceEdgeKeys : [];
    const rank = sourceKeys.reduce((acc, key) => Math.max(acc, differenceClassifiedEdgePriority.get(key) || 0), 0);
    if (rank >= 2) { return; }
    // preview は「青い辺の可視化」に統一し、黄分類は“残す辺”として青で描く。
    addPreviewBlueSegment(seg.a, seg.b, 0.012);
  });
}

function applyDifferenceViewMode() {
  if (differenceViewToggleButton) {
    differenceViewToggleButton.textContent = differenceViewMode === 'preview' ? 'view[preview]' : 'view[diff]';
  }
  setDifferenceMeshFacesVisible(differenceViewMode !== 'preview');
  if (differenceViewMode === 'preview') {
    // preview は「加工結果のみ」を表示する。
    clearDifferenceSelectedEdgeHighlights();
    clearDifferenceSelectedFaceHighlights();
    clearDifferenceFaceHighlight();
    clearDifferencePreviewWireframeLines();
    clearDifferenceIntersectionVisuals();
    // move/add 系は加工後の可視線を再描画（tube 系は DifferencePreviewCutter をそのまま表示）。
    if (differenceSpaceModeActive
      && (differenceSpaceTransformMode === 'move' || differenceSpaceTransformMode === 'add')) {
      refreshDifferenceIntersectionVisuals();
    }
  } else {
    clearDifferencePreviewWireframeLines();
    refreshDifferenceSelectedEdgeHighlights();
  }
}

function refreshDifferenceIntersectionVisuals() {
  const now = performance.now();
  const heavyDrag = isDifferenceHeavyDragActive();
  if (heavyDrag && (now - differenceLastIntersectionRefreshAt) < differenceDragRefreshIntervalMs) {
    return;
  }
  differenceLastIntersectionRefreshAt = now;

  clearDifferenceIntersectionVisuals();
  clearDifferenceClassifiedSegments();
  if (!differenceSpaceModeActive) { return; }
  // preview でも分類（黄/橙/赤）は必要。add/move で同じ計算を使う。
  if (differenceSpaceTransformMode !== 'move'
    && differenceSpaceTransformMode !== 'add'
    && differenceViewMode !== 'preview') { return; }
  const meshes = differenceSpacePlanes.filter((m) => m?.parent && m?.geometry);
  if (meshes.length < 2) { return; }
  const maxDiag = meshes.reduce((acc, mesh) => {
    mesh.geometry?.computeBoundingBox?.();
    const d = mesh.geometry?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 0;
    return Math.max(acc, d);
  }, 0);
  const insideSampleCount = heavyDrag ? 4 : 8;
  const insideMaxDepth = heavyDrag ? 2 : 4;
  scene.updateMatrixWorld(true);
  const trisCache = new Map();
  meshes.forEach((mesh) => {
    trisCache.set(mesh, getDifferenceMeshTrianglesWorld(mesh));
  });
  for (let i = 0; i < meshes.length; i += 1) {
    const a = meshes[i];
    const boxA = new THREE.Box3().setFromObject(a);
    const edgesA = getDifferenceMeshControlPointEdges(a).map((e) => ({
      p0: e.pointA.getWorldPosition(new THREE.Vector3()),
      p1: e.pointB.getWorldPosition(new THREE.Vector3()),
      key: getDifferenceSourceEdgeKeyByWorldPoints(
        e.pointA.getWorldPosition(new THREE.Vector3()),
        e.pointB.getWorldPosition(new THREE.Vector3()),
        0.01,
      ),
    }));
    for (let j = i + 1; j < meshes.length; j += 1) {
      const b = meshes[j];
      const boxB = new THREE.Box3().setFromObject(b);
      if (!boxA.intersectsBox(boxB)) { continue; }
      const trisA = trisCache.get(a) || [];
      const trisB = trisCache.get(b) || [];
      const drawPenetrationEdges = (edges, targetTris) => {
        edges.forEach((edge) => {
          const p0 = edge.p0;
          const p1 = edge.p1;
          if (isContactOnlySegment(p0, p1, targetTris)) { return; }
          const edgeKey = edge.key || getDifferenceSourceEdgeKeyByWorldPoints(p0, p1, 0.01);
          const insideIntervals = getInsideIntervalsOnSegment(p0, p1, targetTris, insideSampleCount, insideMaxDepth);
          if (insideIntervals.length < 1) { return; }
          const onlyFullInside = insideIntervals.length === 1
            && insideIntervals[0][0] <= 1e-4
            && insideIntervals[0][1] >= (1 - 1e-4);
          if (onlyFullInside) {
            differenceClassifiedRedEdgeKeys.add(edgeKey);
            setDifferenceEdgePriority(edgeKey, 3);
            differenceClassifiedRedSegments.push({
              a: p0.clone(),
              b: p1.clone(),
              sourceEdgeKeys: [edgeKey],
            });
            const edgeLine = createDifferenceIntersectionLine(
              p0,
              p1,
              0xff3b30, // 完全に内側: 赤
              differencePenetrationEdgeRadius,
              2465,
            );
            if (!edgeLine) { return; }
            scene.add(edgeLine);
            differencePenetrationEdgeLines.push(edgeLine);
            return;
          }
          if (!differenceClassifiedRedEdgeKeys.has(edgeKey)) {
            differenceClassifiedOrangeEdgeKeys.add(edgeKey);
            setDifferenceEdgePriority(edgeKey, 2);
          }
          // 部分侵入は、内側区間のみオレンジ表示する。
          for (let k = 0; k < insideIntervals.length; k += 1) {
            const tA = insideIntervals[k][0];
            const tB = insideIntervals[k][1];
            if (tB - tA <= 1e-4) { continue; }
            const segA = p0.clone().lerp(p1, tA);
            const segB = p0.clone().lerp(p1, tB);
            differenceClassifiedOrangeSegments.push({
              a: segA.clone(),
              b: segB.clone(),
              sourceEdgeKeys: [edgeKey],
            });
            const partialLine = createDifferenceIntersectionLine(
              segA,
              segB,
              0xff9800, // 一部侵入: オレンジ
              differencePenetrationEdgeRadius,
              2466,
            );
            if (!partialLine) { continue; }
            scene.add(partialLine);
            differencePenetrationEdgeLines.push(partialLine);
          }
        });
      };
      drawPenetrationEdges(edgesA, trisB);
      const edgesB = getDifferenceMeshControlPointEdges(b).map((e) => ({
        p0: e.pointA.getWorldPosition(new THREE.Vector3()),
        p1: e.pointB.getWorldPosition(new THREE.Vector3()),
        key: getDifferenceSourceEdgeKeyByWorldPoints(
          e.pointA.getWorldPosition(new THREE.Vector3()),
          e.pointB.getWorldPosition(new THREE.Vector3()),
          0.01,
        ),
      }));
      drawPenetrationEdges(edgesB, trisA);
      const pairEdges = edgesA.concat(edgesB);

      const points = [];
      const segmentMap = new Map();

      for (let ta = 0; ta < trisA.length; ta += 1) {
        const triA = trisA[ta];
        const triABox = getTriangleAABB(triA);
        for (let tb = 0; tb < trisB.length; tb += 1) {
          const triB = trisB[tb];
          const triBBox = getTriangleAABB(triB);
          if (!triABox.intersectsBox(triBBox)) { continue; }
          const segment = getTrianglePairIntersectionSegment(triA, triB);
          if (!segment) { continue; }
          points.push(...segment.points);
          const key = getSegmentKey(segment.a, segment.b, 0.025);
          if (!segmentMap.has(key)) {
            segmentMap.set(key, segment);
          }
        }
      }

      const uniq = dedupeWorldPoints(points, 0.03);
      uniq.forEach((p) => {
        const marker = createDifferenceIntersectionPointMarker(p);
        scene.add(marker);
        differenceEdgeFaceIntersectionMarkers.push(marker);
      });

      segmentMap.forEach((seg) => {
        const sourceEdgeKeys = collectSourceEdgeKeysForSegment(seg.a, seg.b, pairEdges, maxDiag);
        const pieces = splitYellowSegmentByOtherSpaces(seg.a, seg.b, a, b, meshes, trisCache);
        pieces.forEach((piece) => {
          if (!piece?.a || !piece?.b) { return; }
          let color = 0xffea00;
          if (piece.cls === 'orange') {
            color = 0xff9800;
            sourceEdgeKeys.forEach((k) => {
              if (!k) { return; }
              if (!differenceClassifiedRedEdgeKeys.has(k)) {
                differenceClassifiedOrangeEdgeKeys.add(k);
                setDifferenceEdgePriority(k, 2);
              }
            });
            differenceClassifiedOrangeSegments.push({
              a: piece.a.clone(),
              b: piece.b.clone(),
              sourceEdgeKeys,
            });
          } else {
            sourceEdgeKeys.forEach((k) => setDifferenceEdgePriority(k, 1));
            differenceClassifiedYellowSegments.push({
              a: piece.a.clone(),
              b: piece.b.clone(),
              sourceEdgeKeys,
            });
          }
          const line = createDifferenceIntersectionLine(piece.a, piece.b, color, differenceIntersectionLineRadius, 2470);
          if (!line) { return; }
          scene.add(line);
          differenceFaceFaceIntersectionLines.push(line);
        });
      });
    }
  }
  if (differenceViewMode === 'preview') {
    clearDifferenceIntersectionVisuals();
    drawDifferencePreviewWireframe();
    return;
  }
}

function updateDifferenceSelectionStatus() {
  syncDifferenceSelectionKind();
  updateDifferenceStatus(`選択種別: ${differenceSelectionKind} / point: ${differenceSelectedControlPoints.size} / edge: ${differenceSelectedEdges.size} / face: ${differenceSelectedFaces.size} / body: ${differenceSelectedBodies.size}`);
}

function syncDifferenceSelectionKind() {
  if (differenceSelectedControlPoints.size > 0) {
    differenceSelectionKind = 'point';
    return;
  }
  if (differenceSelectedEdges.size > 0) {
    differenceSelectionKind = 'edge';
    return;
  }
  if (differenceSelectedFaces.size > 0) {
    differenceSelectionKind = 'face';
    return;
  }
  if (differenceSelectedBodies.size > 0) {
    differenceSelectionKind = 'body';
    return;
  }
  differenceSelectionKind = 'none';
}

function clearDifferenceSelectionKindsExcept(kind = 'none') {
  if (kind !== 'point') { clearDifferenceControlPointSelection(); }
  if (kind !== 'edge') { clearDifferenceEdgeSelection(); }
  if (kind !== 'face') { clearDifferenceFaceSelection(); }
  if (kind !== 'body') { clearDifferenceBodySelection(); }
  syncDifferenceSelectionKind();
}

function setDifferenceBodySelectionMode(active) {
  differenceBodySelectModeActive = Boolean(active);
  setDifferenceBodySelectButtonState(differenceBodySelectModeActive);
  if (differenceBodySelectModeActive) {
    clearDifferenceControlPointSelection();
    clearDifferenceFaceSelection();
    clearDifferenceEdgeSelection();
    clearDifferenceFaceHighlight();
  } else {
    clearDifferenceBodySelection();
  }
  updateDifferenceSelectionStatus();
  refreshDifferenceSelectedEdgeHighlights();
  refreshDifferenceSelectedFaceHighlights();
  refreshDifferenceSelectedBodyHighlights();
}

function getDifferenceEdgeKey(mesh, pointA, pointB) {
  if (!mesh || !pointA?.userData?.differenceControlPoint || !pointB?.userData?.differenceControlPoint || pointA === pointB) { return null; }
  const [a, b] = [pointA.id, pointB.id].sort((x, y) => x - y);
  return `${mesh.id}:p${a}|p${b}`;
}

function createDifferenceEdgeHighlightLine(pointA, pointB, color = 0x67b7ff) {
  if (!pointA?.isObject3D || !pointB?.isObject3D) { return null; }
  const a = pointA.getWorldPosition(new THREE.Vector3());
  const b = pointB.getWorldPosition(new THREE.Vector3());
  const dir = b.clone().sub(a);
  const len = dir.length();
  if (len < 1e-6) { return null; }
  const radius = 0.02;
  const geom = new THREE.CylinderGeometry(radius, radius, len, 6, 1, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.88,
    roughness: 0.75,
    metalness: 0.0,
    flatShading: true,
    depthTest: false,
    depthWrite: false,
  });
  const segment = new THREE.Mesh(geom, mat);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  segment.position.copy(mid);
  const up = new THREE.Vector3(0, 1, 0);
  segment.quaternion.setFromUnitVectors(up, dir.normalize());
  segment.renderOrder = 2450;
  return segment;
}

function getDifferenceMeshControlPointEdges(mesh) {
  const pos = mesh?.geometry?.attributes?.position;
  if (!mesh?.userData?.differenceSpacePlane || !pos) { return []; }
  const cpList = mesh.children.filter((c) => c?.userData?.differenceControlPoint);
  if (cpList.length < 2) { return []; }

  const idxToPoint = new Map();
  cpList.forEach((p) => {
    const ids = p?.userData?.differenceVertexIndices;
    if (!Array.isArray(ids)) { return; }
    ids.forEach((idx) => {
      if (Number.isInteger(idx) && idx >= 0 && idx < pos.count) {
        idxToPoint.set(idx, p);
      }
    });
  });
  // differenceVertexIndices が無い制御点（初期ボックス等）も、cornerKey から厳密対応させる
  const cornerMap = ensureDifferenceCornerVertexMap(mesh);
  if (cornerMap) {
    cpList.forEach((p) => {
      const key = p?.userData?.differenceCornerKey;
      if (!key || !Array.isArray(cornerMap[key])) { return; }
      cornerMap[key].forEach((idx) => {
        if (Number.isInteger(idx) && idx >= 0 && idx < pos.count) {
          idxToPoint.set(idx, p);
        }
      });
    });
  }

  const resolvePointByIndex = (idx) => {
    const mapped = idxToPoint.get(idx);
    if (mapped) { return mapped; }
    // 近接スナップは誤った対角線辺を生みやすいので使わない
    return null;
  };

  mesh.geometry.computeBoundingBox?.();
  const meshDiag = mesh.geometry.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
  const vtxSnap = Math.max(1e-6, meshDiag * 1e-5);
  const makeVertexKey = (idx) => {
    const x = Math.round(pos.getX(idx) / vtxSnap);
    const y = Math.round(pos.getY(idx) / vtxSnap);
    const z = Math.round(pos.getZ(idx) / vtxSnap);
    return `${x},${y},${z}`;
  };

  const edgeFaces = new Map();
  const edgeIndexPairs = new Map();
  const addTriEdge = (a, b, triNormal, triPoint = null) => {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b || !triNormal) { return; }
    const ka = makeVertexKey(a);
    const kb = makeVertexKey(b);
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (!edgeFaces.has(key)) {
      edgeFaces.set(key, []);
      edgeIndexPairs.set(key, []);
    }
    // 平面キー（法線+距離）で同一平面をまとめる。三角分割の対角線除去に使う。
    const n = triNormal.clone().normalize();
    const p = triPoint ? triPoint.clone() : getVertex(a);
    const d = -n.dot(p);
    const nSnap = Math.max(1e-4, Math.sin(THREE.MathUtils.degToRad(10)) * 0.5);
    const dSnap = Math.max(1e-6, meshDiag * 1e-3);
    const planeKey = `${Math.round(n.x / nSnap)},${Math.round(n.y / nSnap)},${Math.round(n.z / nSnap)}|${Math.round(d / dSnap)}`;
    edgeFaces.get(key).push({
      normal: n,
      planeKey,
    });
    edgeIndexPairs.get(key).push([a, b]);
  };
  const getVertex = (idx) => new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
  const computeTriNormal = (ia, ib, ic) => {
    const a = getVertex(ia);
    const b = getVertex(ib);
    const c = getVertex(ic);
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const n = new THREE.Vector3().crossVectors(ab, ac);
    if (n.lengthSq() < 1e-12) { return null; }
    return n.normalize();
  };

  if (mesh.geometry.index) {
    const arr = mesh.geometry.index.array;
    for (let i = 0; i + 2 < arr.length; i += 3) {
      const a = Number(arr[i]);
      const b = Number(arr[i + 1]);
      const c = Number(arr[i + 2]);
      const triNormal = computeTriNormal(a, b, c);
      const triPoint = triNormal ? getVertex(a) : null;
      addTriEdge(a, b, triNormal, triPoint);
      addTriEdge(b, c, triNormal, triPoint);
      addTriEdge(c, a, triNormal, triPoint);
    }
  } else {
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const triNormal = computeTriNormal(i, i + 1, i + 2);
      const triPoint = triNormal ? getVertex(i) : null;
      addTriEdge(i, i + 1, triNormal, triPoint);
      addTriEdge(i + 1, i + 2, triNormal, triPoint);
      addTriEdge(i + 2, i, triNormal, triPoint);
    }
  }

  const isMeaningfulEdge = (ia, ib, faces) => {
    // 三角分割由来の細かい辺を消すため、短すぎる辺は除外
    const pa = new THREE.Vector3(pos.getX(ia), pos.getY(ia), pos.getZ(ia));
    const pb = new THREE.Vector3(pos.getX(ib), pos.getY(ib), pos.getZ(ib));
    const len = pa.distanceTo(pb);
    const diag = meshDiag;
    const minLen = Math.max(0.02, diag * 0.01);
    if (len < minLen) { return false; }

    // 同一平面しか関与しない辺（三角分割の対角線など）は除外
    const planeKeys = new Set();
    const uniqueNormals = [];
    (faces || []).forEach((f) => {
      if (!f?.planeKey || !f?.normal) { return; }
      planeKeys.add(f.planeKey);
      const isNew = uniqueNormals.every((n) => Math.abs(n.dot(f.normal)) < 0.9999);
      if (isNew) {
        uniqueNormals.push(f.normal.clone().normalize());
      }
    });
    if (planeKeys.size <= 1) { return false; }

    // 折れ角が極小なら表示しない（ほぼ同一平面の誤検出対策）
    // 側面（|ny|が小さい）では誤差が出やすいので許容角を広める
    const avgAbsY = uniqueNormals.length > 0
      ? uniqueNormals.reduce((acc, nn) => acc + Math.abs(nn.y), 0) / uniqueNormals.length
      : 1;
    const creaseDeg = avgAbsY < 0.45 ? 14 : 8;
    const creaseCos = Math.cos(THREE.MathUtils.degToRad(creaseDeg));
    let hasCrease = false;
    for (let i = 0; i < uniqueNormals.length; i += 1) {
      for (let j = i + 1; j < uniqueNormals.length; j += 1) {
        const d = Math.abs(uniqueNormals[i].dot(uniqueNormals[j]));
        if (d < creaseCos) {
          hasCrease = true;
          break;
        }
      }
      if (hasCrease) { break; }
    }
    if (!hasCrease && planeKeys.size > 1) { return false; }
    return true;
  };

  const edges = [];
  const cpEdgeSeen = new Set();
  edgeFaces.forEach((normals, rawKey) => {
    const candidates = edgeIndexPairs.get(rawKey) || [];
    let ia = null;
    let ib = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      const paTry = resolvePointByIndex(c[0]);
      const pbTry = resolvePointByIndex(c[1]);
      if (paTry && pbTry && paTry !== pbTry) {
        ia = c[0];
        ib = c[1];
        break;
      }
    }
    if (!Number.isInteger(ia) || !Number.isInteger(ib)) { return; }
    if (!isMeaningfulEdge(ia, ib, normals)) { return; }
    const pa = resolvePointByIndex(ia);
    const pb = resolvePointByIndex(ib);
    if (!pa || !pb || pa === pb) { return; }
    const cpKey = pa.id < pb.id ? `${pa.id}|${pb.id}` : `${pb.id}|${pa.id}`;
    if (cpEdgeSeen.has(cpKey)) { return; }
    cpEdgeSeen.add(cpKey);
    edges.push({ pointA: pa, pointB: pb });
  });

  const mergeSplitCollinearEdges = (rawEdges, collinearDegTol = 3.0) => {
    if (!Array.isArray(rawEdges) || rawEdges.length < 2) { return rawEdges || []; }
    const cosTol = Math.cos(THREE.MathUtils.degToRad(Math.max(0.1, collinearDegTol)));
    const keyOf = (a, b) => {
      const ia = a.id;
      const ib = b.id;
      return ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`;
    };

    let work = rawEdges.slice();
    let changed = true;
    while (changed) {
      changed = false;
      const adj = new Map();
      const addAdj = (a, b) => {
        if (!adj.has(a)) { adj.set(a, []); }
        adj.get(a).push(b);
      };
      const edgeKeySet = new Set();
      work.forEach((e) => {
        if (!e?.pointA || !e?.pointB || e.pointA === e.pointB) { return; }
        const k = keyOf(e.pointA, e.pointB);
        if (edgeKeySet.has(k)) { return; }
        edgeKeySet.add(k);
        addAdj(e.pointA, e.pointB);
        addAdj(e.pointB, e.pointA);
      });

      for (const [mid, neighbors] of adj.entries()) {
        if (!Array.isArray(neighbors) || neighbors.length !== 2) { continue; }
        const n0 = neighbors[0];
        const n1 = neighbors[1];
        if (!n0 || !n1 || n0 === n1) { continue; }

        const v0 = n0.position.clone().sub(mid.position);
        const v1 = n1.position.clone().sub(mid.position);
        const l0 = v0.lengthSq();
        const l1 = v1.lengthSq();
        if (l0 <= 1e-12 || l1 <= 1e-12) { continue; }
        v0.multiplyScalar(1 / Math.sqrt(l0));
        v1.multiplyScalar(1 / Math.sqrt(l1));
        const d = Math.abs(v0.dot(v1));
        if (d < cosTol) { continue; }

        // mid を挟んだ2分割辺を 1 本に統合
        const kA = keyOf(mid, n0);
        const kB = keyOf(mid, n1);
        const next = [];
        work.forEach((e) => {
          const k = keyOf(e.pointA, e.pointB);
          if (k === kA || k === kB) { return; }
          next.push(e);
        });
        work = next;
        // edgeKeySet はこの時点の work で再構築するため、ここでは使わない
        const edgeKeySet = new Set(work.map((e) => keyOf(e.pointA, e.pointB)));
        if (!edgeKeySet.has(keyOf(n0, n1))) {
          work.push({ pointA: n0, pointB: n1 });
        }
        changed = true;
        break;
      }
    }
    return work;
  };

  return mergeSplitCollinearEdges(edges, 5.5);
}

function getDifferenceMeshRawControlPointEdges(mesh) {
  const pos = mesh?.geometry?.attributes?.position;
  if (!mesh?.userData?.differenceSpacePlane || !pos) { return []; }
  const cpList = mesh.children.filter((c) => c?.userData?.differenceControlPoint);
  if (cpList.length < 2) { return []; }

  mesh.geometry.computeBoundingBox?.();
  const meshDiag = mesh.geometry.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
  const nearestTolSq = Math.max(0.04, meshDiag * 0.08) ** 2;

  const idxToPoint = new Map();
  cpList.forEach((p) => {
    const ids = p?.userData?.differenceVertexIndices;
    if (!Array.isArray(ids)) { return; }
    ids.forEach((idx) => {
      if (Number.isInteger(idx) && idx >= 0 && idx < pos.count) {
        idxToPoint.set(idx, p);
      }
    });
  });
  const cornerMap = ensureDifferenceCornerVertexMap(mesh);
  if (cornerMap) {
    cpList.forEach((p) => {
      const key = p?.userData?.differenceCornerKey;
      if (!key || !Array.isArray(cornerMap[key])) { return; }
      cornerMap[key].forEach((idx) => {
        if (Number.isInteger(idx) && idx >= 0 && idx < pos.count) {
          idxToPoint.set(idx, p);
        }
      });
    });
  }
  const resolvePointByIndex = (idx) => {
    const mapped = idxToPoint.get(idx);
    if (mapped) { return mapped; }
    const vx = pos.getX(idx);
    const vy = pos.getY(idx);
    const vz = pos.getZ(idx);
    let best = null;
    let bestD = Infinity;
    cpList.forEach((p) => {
      const dx = p.position.x - vx;
      const dy = p.position.y - vy;
      const dz = p.position.z - vz;
      const d = (dx * dx) + (dy * dy) + (dz * dz);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    });
    if (!best || bestD > nearestTolSq) { return null; }
    idxToPoint.set(idx, best);
    return best;
  };

  const edges = [];
  const seen = new Set();
  const addEdgeByIndex = (ia, ib) => {
    const pa = resolvePointByIndex(ia);
    const pb = resolvePointByIndex(ib);
    if (!pa || !pb || pa === pb) { return; }
    const key = pa.id < pb.id ? `${pa.id}|${pb.id}` : `${pb.id}|${pa.id}`;
    if (seen.has(key)) { return; }
    seen.add(key);
    edges.push({ pointA: pa, pointB: pb });
  };

  const idx = mesh.geometry.getIndex();
  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
  for (let t = 0; t < triCount; t += 1) {
    const a = idx ? Number(idx.getX(t * 3 + 0)) : (t * 3 + 0);
    const b = idx ? Number(idx.getX(t * 3 + 1)) : (t * 3 + 1);
    const c = idx ? Number(idx.getX(t * 3 + 2)) : (t * 3 + 2);
    addEdgeByIndex(a, b);
    addEdgeByIndex(b, c);
    addEdgeByIndex(c, a);
  }
  return edges;
}

function projectPointTOnSegment(point, a, b) {
  const ab = b.clone().sub(a);
  const lenSq = ab.lengthSq();
  if (lenSq < 1e-10) { return 0; }
  return point.clone().sub(a).dot(ab) / lenSq;
}

function distancePointToInfiniteLine(point, linePoint, lineDirNorm) {
  const rel = point.clone().sub(linePoint);
  const cross = new THREE.Vector3().crossVectors(rel, lineDirNorm);
  return cross.length();
}

function rebuildDifferenceEdgeOverlapConstraints() {
  differenceEdgeOverlapConstraints.length = 0;
  const spaces = getActiveDifferenceSpaces();
  if (spaces.length < 1) { return 0; }
  const edges = spaces
    .flatMap((mesh) => getDifferenceMeshRawControlPointEdges(mesh).map((edge) => ({ ...edge, mesh })))
    .filter((edge) => edge?.pointA?.parent && edge?.pointB?.parent && edge.pointA !== edge.pointB);
  if (edges.length < 2) { return 0; }

  const maxDiag = spaces.reduce((acc, mesh) => {
    mesh.geometry?.computeBoundingBox?.();
    const d = mesh.geometry?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 0;
    return Math.max(acc, d);
  }, 0);
  const distanceTol = Math.max(0.06, maxDiag * 0.035);
  const overlapLenTol = Math.max(0.015, maxDiag * 0.008);
  const parallelCos = Math.cos(THREE.MathUtils.degToRad(12.0));

  const worldData = edges.map((edge) => {
    const a = edge.pointA.getWorldPosition(new THREE.Vector3());
    const b = edge.pointB.getWorldPosition(new THREE.Vector3());
    const vec = b.clone().sub(a);
    const len = vec.length();
    const dir = len > 1e-8 ? vec.clone().multiplyScalar(1 / len) : new THREE.Vector3(0, 0, 0);
    return { edge, a, b, len, dir };
  });
  const followerBest = new Map();
  const upsertFollower = (candidate) => {
    const key = candidate?.follower?.id;
    if (!key) { return; }
    const prev = followerBest.get(key);
    if (!prev) {
      followerBest.set(key, candidate);
      return;
    }
    const prevScore = (prev.overlapLen * 3) + prev.masterLen;
    const nextScore = (candidate.overlapLen * 3) + candidate.masterLen;
    if (nextScore > prevScore) {
      followerBest.set(key, candidate);
    }
  };

  for (let i = 0; i < worldData.length; i += 1) {
    const e1 = worldData[i];
    if (e1.len < 1e-6) { continue; }
    for (let j = i + 1; j < worldData.length; j += 1) {
      const e2 = worldData[j];
      if (e2.len < 1e-6) { continue; }
      const samePair = (
        (e1.edge.pointA === e2.edge.pointA && e1.edge.pointB === e2.edge.pointB)
        || (e1.edge.pointA === e2.edge.pointB && e1.edge.pointB === e2.edge.pointA)
      );
      if (samePair) {
        continue;
      }
      const dot = Math.abs(e1.dir.dot(e2.dir));
      if (dot < parallelCos) { continue; }

      const d11 = distancePointToInfiniteLine(e1.a, e2.a, e2.dir);
      const d12 = distancePointToInfiniteLine(e1.b, e2.a, e2.dir);
      const d21 = distancePointToInfiniteLine(e2.a, e1.a, e1.dir);
      const d22 = distancePointToInfiniteLine(e2.b, e1.a, e1.dir);
      const lineDistance = Math.min(Math.max(d11, d12), Math.max(d21, d22));
      if (lineDistance > distanceTol) { continue; }

      let master = e1;
      let slave = e2;
      if (e2.len > e1.len) {
        master = e2;
        slave = e1;
      } else if (Math.abs(e2.len - e1.len) < 1e-6) {
        const mA = Math.min(e1.edge.pointA.id, e1.edge.pointB.id);
        const sA = Math.min(e2.edge.pointA.id, e2.edge.pointB.id);
        if (sA < mA) {
          master = e2;
          slave = e1;
        }
      }

      const t0 = projectPointTOnSegment(slave.a, master.a, master.b);
      const t1 = projectPointTOnSegment(slave.b, master.a, master.b);
      const rangeMin = Math.max(0, Math.min(t0, t1));
      const rangeMax = Math.min(1, Math.max(t0, t1));
      const overlapLen = Math.max(0, (rangeMax - rangeMin) * master.len);
      if (overlapLen < overlapLenTol) { continue; }

      const addFollower = (followerPoint, followerWorld) => {
        if (!followerPoint?.parent || followerPoint === master.edge.pointA || followerPoint === master.edge.pointB) { return; }
        const rawT = projectPointTOnSegment(followerWorld, master.a, master.b);
        const t = THREE.MathUtils.clamp(rawT, 0, 1);
        upsertFollower({
          masterA: master.edge.pointA,
          masterB: master.edge.pointB,
          follower: followerPoint,
          t,
          overlapLen,
          masterLen: master.len,
        });
      };
      addFollower(slave.edge.pointA, slave.a);
      addFollower(slave.edge.pointB, slave.b);
    }
  }

  followerBest.forEach((entry) => {
    differenceEdgeOverlapConstraints.push({
      masterA: entry.masterA,
      masterB: entry.masterB,
      follower: entry.follower,
      t: entry.t,
    });
  });
  return differenceEdgeOverlapConstraints.length;
}

function applyDifferenceEdgeOverlapConstraints(dirtyMeshes = null) {
  if (!Array.isArray(differenceEdgeOverlapConstraints) || differenceEdgeOverlapConstraints.length < 1) { return 0; }
  const usedDirty = dirtyMeshes || new Set();
  const touched = [];
  let changed = 0;
  for (let i = 0; i < differenceEdgeOverlapConstraints.length; i += 1) {
    const c = differenceEdgeOverlapConstraints[i];
    const a = c?.masterA;
    const b = c?.masterB;
    const follower = c?.follower;
    if (!a?.parent || !b?.parent || !follower?.parent) { continue; }
    const aw = a.getWorldPosition(new THREE.Vector3());
    const bw = b.getWorldPosition(new THREE.Vector3());
    const targetWorld = aw.clone().lerp(bw, THREE.MathUtils.clamp(Number(c.t) || 0, 0, 1));
    const inv = new THREE.Matrix4().copy(follower.parent.matrixWorld).invert();
    const targetLocal = targetWorld.applyMatrix4(inv);
    if (follower.position.distanceToSquared(targetLocal) <= 1e-12) { continue; }
    follower.position.copy(targetLocal);
    usedDirty.add(follower.parent);
    touched.push(follower);
    changed += 1;
  }
  if (changed > 0) {
    propagateDifferenceSharedPoints(touched, usedDirty);
  }
  return changed;
}

function refreshDifferenceSelectedEdgeHighlights() {
  clearDifferenceSelectedEdgeHighlights();
  refreshDifferenceIntersectionVisuals();
  if (differenceViewMode === 'preview') { return; }
  if (!differenceSpaceModeActive || !['move', 'rotation', 'scale'].includes(differenceSpaceTransformMode)) { return; }
  for (const [key, entry] of Array.from(differenceSelectedEdges.entries())) {
    const pa = entry?.pointA;
    const pb = entry?.pointB;
    const mesh = entry?.mesh;
    if (!mesh?.parent || !pa?.parent || !pb?.parent || pa.parent !== mesh || pb.parent !== mesh) {
      differenceSelectedEdges.delete(key);
    }
  }
  const activeMeshes = differenceSpacePlanes.filter((m) => m?.parent);
  const selectedEdgeCount = differenceSelectedEdges.size;
  const selectedEdgeColor = selectedEdgeCount <= 1 ? 0xff8a00 : 0x0066ff;
  activeMeshes.forEach((mesh) => {
    if (!mesh?.parent) { return; }
    const edges = getDifferenceMeshControlPointEdges(mesh);
    edges.forEach((edge) => {
      const edgeKey = getDifferenceEdgeKey(mesh, edge.pointA, edge.pointB);
      const isSelected = Boolean(edgeKey && differenceSelectedEdges.has(edgeKey));
      const color = isSelected ? selectedEdgeColor : 0x5c8fff;
      const line = createDifferenceEdgeHighlightLine(edge.pointA, edge.pointB, color);
      if (!line) { return; }
      scene.add(line);
      differenceSelectedEdgeHighlights.push(line);
    });
  });
}

function getDifferenceSelectedPointsForTransform() {
  const points = [];
  const pushUnique = (point) => {
    if (!point?.userData?.differenceControlPoint || !point?.parent) { return; }
    if (points.includes(point)) { return; }
    points.push(point);
  };

  Array.from(differenceSelectedControlPoints || []).forEach((point) => pushUnique(point));
  Array.from(differenceSelectedEdges.values()).forEach((entry) => {
    pushUnique(entry?.pointA);
    pushUnique(entry?.pointB);
  });
  Array.from(differenceSelectedFaces.values()).forEach((entry) => {
    const facePoints = getDifferenceFaceControlPoints(entry?.mesh, entry?.localNormal, null);
    if (!Array.isArray(facePoints)) { return; }
    facePoints.forEach((point) => pushUnique(point));
  });
  Array.from(differenceSelectedBodies.values()).forEach((entry) => {
    const mesh = entry?.mesh;
    if (!mesh?.userData?.differenceSpacePlane) { return; }
    mesh.children.forEach((child) => pushUnique(child));
  });
  return points;
}

function toggleDifferenceEdgeSelection(mesh, pointA, pointB) {
  if (!mesh?.userData?.differenceSpacePlane || !pointA?.userData?.differenceControlPoint || !pointB?.userData?.differenceControlPoint) { return false; }
  const key = getDifferenceEdgeKey(mesh, pointA, pointB);
  if (!key) { return false; }
  if (!differenceSelectedEdges.has(key)) {
    clearDifferenceSelectionKindsExcept('edge');
  }
  if (differenceSelectedEdges.has(key)) {
    differenceSelectedEdges.delete(key);
    refreshDifferenceSelectedEdgeHighlights();
    syncDifferenceSelectionKind();
    return false;
  }
  differenceSelectedEdges.set(key, {
    mesh,
    pointA,
    pointB,
  });
  refreshDifferenceSelectedEdgeHighlights();
  syncDifferenceSelectionKind();
  return true;
}

function clearDifferenceEdgeSelection() {
  differenceSelectedEdges.clear();
  // 辺ガイドの表示/非表示は view toggle(differenceViewMode) 側でのみ制御する。
  // ここでは「選択状態」だけをリセットし、可視ガイドは現在モードに合わせて再描画する。
  refreshDifferenceSelectedEdgeHighlights();
  syncDifferenceSelectionKind();
}

function getNearestDifferenceEdgeHitFromFaceHit(hit) {
  const mesh = hit?.object;
  const localNormal = getLocalFaceNormalFromHit(hit);
  if (!mesh?.userData?.differenceSpacePlane || !localNormal || !mesh?.geometry?.attributes?.position) { return null; }
  const candidateEdges = getDifferenceMeshControlPointEdges(mesh);
  if (!Array.isArray(candidateEdges) || candidateEdges.length < 1) { return null; }
  const worldClick = hit?.point?.clone?.();
  if (!worldClick) { return null; }
  const worldToLocal = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const clickLocal = worldClick.clone().applyMatrix4(worldToLocal);
  const pointToSegmentDistance = (p, a, b) => {
    const ab = b.clone().sub(a);
    const len2 = ab.lengthSq();
    if (len2 < 1e-10) { return p.distanceTo(a); }
    const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / len2, 0, 1);
    const closest = a.clone().add(ab.multiplyScalar(t));
    return p.distanceTo(closest);
  };
  let best = null;
  candidateEdges.forEach((edge) => {
    const a = edge?.pointA;
    const b = edge?.pointB;
    if (!a?.userData?.differenceControlPoint || !b?.userData?.differenceControlPoint) { return; }
    const dist = pointToSegmentDistance(clickLocal, a.position, b.position);
    if (!best || dist < best.distanceLocal) {
      best = { pointA: a, pointB: b, distanceLocal: dist };
    }
  });
  if (!best) { return null; }
  mesh.geometry.computeBoundingBox?.();
  const size = mesh.geometry.boundingBox?.getSize?.(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1);
  const diag = Math.max(1e-6, size.length());
  // 面選択を阻害しないよう、辺ヒット判定はかなり近接時だけ有効にする
  const maxDistance = Math.max(0.01, Math.min(0.04, diag * 0.03));
  if (best.distanceLocal > maxDistance) { return null; }
  return {
    mesh,
    pointA: best.pointA,
    pointB: best.pointB,
    distanceLocal: best.distanceLocal,
    localNormal,
    hit,
  };
}

function resolveDifferencePickByPriority(hits, { strictEdge = false } = {}) {
  const controlPointHit = hits.find((h) => h?.object?.userData?.differenceControlPoint) || null;
  if (controlPointHit?.object?.userData?.differenceControlPoint) {
    const mesh = controlPointHit.object.userData?.parentDifferenceSpacePlane || controlPointHit.object.parent || null;
    if (mesh?.userData?.differenceSpacePlane) {
      return { kind: 'point', mesh, controlPointHit };
    }
  }

  const faceHits = hits.filter((h) => h?.object?.userData?.differenceSpacePlane && h?.face);
  const faceHit = faceHits[0] || null;
  if (!faceHit?.object?.userData?.differenceSpacePlane) {
    return { kind: 'none' };
  }

  // 面の手前/奥を問わず、レイ上の全 face hit から edge 候補を探す。
  let bestEdgePick = null;
  faceHits.forEach((fh) => {
    const edgeHit = getNearestDifferenceEdgeHitFromFaceHit(fh);
    if (!edgeHit?.pointA || !edgeHit?.pointB) { return; }
    if (strictEdge) {
      const g = fh?.object?.geometry;
      g?.computeBoundingBox?.();
      const diag = Math.max(
        1e-6,
        g?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1,
      );
      const strictEdgePickDistance = Math.max(0.008, Math.min(0.028, diag * 0.02));
      if (Number(edgeHit.distanceLocal) > strictEdgePickDistance) { return; }
    }
    const candidate = {
      kind: 'edge',
      mesh: fh.object,
      faceHit: fh,
      edgeHit,
      localNormal: edgeHit.localNormal || getLocalFaceNormalFromHit(fh),
    };
    if (!bestEdgePick) {
      bestEdgePick = candidate;
      return;
    }
    const distA = Number(candidate.edgeHit.distanceLocal);
    const distB = Number(bestEdgePick.edgeHit.distanceLocal);
    if (distA < distB - 1e-8) {
      bestEdgePick = candidate;
      return;
    }
    if (Math.abs(distA - distB) <= 1e-8 && Number(candidate.faceHit?.distance) < Number(bestEdgePick.faceHit?.distance)) {
      bestEdgePick = candidate;
    }
  });
  if (bestEdgePick) {
    return bestEdgePick;
  }

  const mesh = faceHit.object;
  const localNormal = getLocalFaceNormalFromHit(faceHit);
  if (localNormal) {
    return { kind: 'face', mesh, faceHit, localNormal };
  }
  return { kind: 'none' };
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
    setDifferenceControlPointVisual(child);
  });
  for (const point of Array.from(differenceSelectedControlPoints)) {
    if (!point || point.parent !== mesh) { continue; }
    differenceSelectedControlPoints.delete(point);
  }
}

function isDifferenceControlPointSelected(point) {
  return differenceSelectedControlPoints.has(point);
}

function isGroupedDifferenceControlPoint(point) {
  const links = point?.userData?.sharedDifferencePoints;
  return Array.isArray(links) && links.length > 0;
}

function getDifferenceControlPointBaseColor(point) {
  return isGroupedDifferenceControlPoint(point) ? 0x3f7cff : 0xff6b6b;
}

function setDifferenceControlPointVisual(point, color = null) {
  if (!point?.material?.color) { return; }
  point.material.color.set(color ?? getDifferenceControlPointBaseColor(point));
}

function clearDifferenceControlPointSelection() {
  for (const point of Array.from(differenceSelectedControlPoints)) {
    setDifferenceControlPointVisual(point, getDifferenceControlPointBaseColor(point));
  }
  differenceSelectedControlPoints.clear();
  syncDifferenceSelectionKind();
}

function toggleDifferenceControlPointSelection(point) {
  if (!point?.userData?.differenceControlPoint) { return; }
  if (!differenceSelectedControlPoints.has(point)) {
    clearDifferenceSelectionKindsExcept('point');
  }
  if (differenceSelectedControlPoints.has(point)) {
    differenceSelectedControlPoints.delete(point);
    setDifferenceControlPointVisual(point, getDifferenceControlPointBaseColor(point));
    syncDifferenceSelectionKind();
    return;
  }
  differenceSelectedControlPoints.add(point);
  setDifferenceControlPointVisual(point, 0x7be6ff);
  syncDifferenceSelectionKind();
}

function highlightDifferenceFaceControlPoints(mesh, localNormal, facePointLocal = null) {
  if (!mesh || !localNormal) { return; }
  resetDifferenceControlPointsHighlight(mesh);
  let facePoints = getDifferenceFaceControlPoints(mesh, localNormal, facePointLocal);
  if (!Array.isArray(facePoints) || facePoints.length < 3) {
    facePoints = getDifferenceFaceControlPoints(mesh, localNormal, null);
  }
  if (!Array.isArray(facePoints) || facePoints.length < 1) { return; }
  facePoints.forEach((child) => {
    if (!child?.userData?.differenceControlPoint || !child?.material?.color) { return; }
    if (isDifferenceControlPointSelected(child)) { return; }
    child.material.color.set(0xffd64d);
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

function createDifferenceFaceHighlightPlane(mesh, localNormal, color = 0xff8a00, opacity = 0.82, renderOrder = 2500, facePointLocal = null) {
  if (!mesh?.isMesh || !mesh?.geometry || !localNormal) { return null; }
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();
  if (worldNormal.lengthSq() < 1e-8) { return null; }
  let facePoints = getDifferenceFaceControlPoints(mesh, localNormal, facePointLocal);
  if ((!Array.isArray(facePoints) || facePoints.length < 3) && facePointLocal) {
    facePoints = getDifferenceFaceControlPoints(mesh, localNormal, null);
  }
  if (!Array.isArray(facePoints) || facePoints.length < 3) { return null; }

  const worldPoints = [];
  const dedupeTol = 1e-4;
  facePoints.forEach((p) => {
    const w = p?.getWorldPosition?.(new THREE.Vector3());
    if (!w) { return; }
    const exists = worldPoints.some((q) => q.distanceToSquared(w) <= dedupeTol);
    if (!exists) {
      worldPoints.push(w);
    }
  });
  if (worldPoints.length < 3) { return null; }

  const center = new THREE.Vector3();
  worldPoints.forEach((p) => center.add(p));
  center.multiplyScalar(1 / worldPoints.length);

  let refUp = new THREE.Vector3(0, 1, 0);
  if (Math.abs(worldNormal.dot(refUp)) > 0.96) {
    refUp = new THREE.Vector3(1, 0, 0);
  }
  const axisU = new THREE.Vector3().crossVectors(refUp, worldNormal).normalize();
  const axisV = new THREE.Vector3().crossVectors(worldNormal, axisU).normalize();

  const ordered = worldPoints
    .map((p) => {
      const rel = p.clone().sub(center);
      const u = rel.dot(axisU);
      const v = rel.dot(axisV);
      return { p, a: Math.atan2(v, u) };
    })
    .sort((a, b) => a.a - b.a)
    .map((e) => e.p);
  if (ordered.length < 3) { return null; }

  const offset = worldNormal.clone().multiplyScalar(0.012);
  const vertices = [];
  const centerOffset = center.clone().add(offset);
  vertices.push(centerOffset.x, centerOffset.y, centerOffset.z);
  ordered.forEach((p) => {
    const q = p.clone().add(offset);
    vertices.push(q.x, q.y, q.z);
  });

  const indices = [];
  for (let i = 1; i < ordered.length; i += 1) {
    indices.push(0, i, i + 1);
  }
  if (indices.length < 3) { return null; }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const poly = new THREE.Mesh(geom, mat);
  poly.renderOrder = renderOrder;
  return poly;
}

function refreshDifferenceSelectedFaceHighlights() {
  clearDifferenceSelectedFaceHighlights();
  if (differenceSelectedFaces.size < 1) { return; }
  differenceSelectedFaces.forEach((entry) => {
    const mesh = entry?.mesh;
    const localNormal = entry?.localNormal?.clone?.();
    if (!mesh?.parent || !localNormal) { return; }
    const plane = createDifferenceFaceHighlightPlane(mesh, localNormal, 0x0000ff, 0.76, 2400);
    if (!plane) { return; }
    scene.add(plane);
    differenceSelectedFaceHighlights.push(plane);
  });
}

function refreshDifferenceSelectedBodyHighlights() {
  clearDifferenceSelectedBodyHighlights();
  if (differenceSelectedBodies.size < 1) { return; }
  for (const [key, entry] of Array.from(differenceSelectedBodies.entries())) {
    const mesh = entry?.mesh;
    if (!mesh?.parent || !mesh?.userData?.differenceSpacePlane) {
      differenceSelectedBodies.delete(key);
      continue;
    }
    const helper = new THREE.BoxHelper(mesh, 0x0066ff);
    helper.material.transparent = true;
    helper.material.opacity = 0.95;
    helper.material.depthTest = false;
    helper.material.depthWrite = false;
    helper.renderOrder = 2465;
    scene.add(helper);
    differenceSelectedBodyHighlights.push(helper);
  }
}

function toggleDifferenceFaceSelection(mesh, localNormal) {
  const key = getDifferenceFaceKey(mesh, localNormal);
  if (!key) { return false; }
  if (!differenceSelectedFaces.has(key)) {
    clearDifferenceSelectionKindsExcept('face');
  }
  if (differenceSelectedFaces.has(key)) {
    differenceSelectedFaces.delete(key);
    refreshDifferenceSelectedFaceHighlights();
    syncDifferenceSelectionKind();
    return false;
  }
  differenceSelectedFaces.set(key, {
    mesh,
    localNormal: localNormal.clone(),
  });
  refreshDifferenceSelectedFaceHighlights();
  syncDifferenceSelectionKind();
  return true;
}

function toggleDifferenceBodySelection(mesh) {
  if (!mesh?.userData?.differenceSpacePlane) { return false; }
  const key = String(mesh.id);
  if (!differenceSelectedBodies.has(key)) {
    clearDifferenceSelectionKindsExcept('body');
  }
  if (differenceSelectedBodies.has(key)) {
    differenceSelectedBodies.delete(key);
    refreshDifferenceSelectedBodyHighlights();
    syncDifferenceSelectionKind();
    return false;
  }
  differenceSelectedBodies.set(key, { mesh });
  refreshDifferenceSelectedBodyHighlights();
  syncDifferenceSelectionKind();
  return true;
}

function clearDifferenceFaceSelection() {
  differenceSelectedFaces.clear();
  clearDifferenceSelectedFaceHighlights();
  syncDifferenceSelectionKind();
}

function clearDifferenceBodySelection() {
  differenceSelectedBodies.clear();
  clearDifferenceSelectedBodyHighlights();
  syncDifferenceSelectionKind();
}

function clearDifferenceMovePending() {
  differenceMoveClickPending = false;
  differenceMoveDownPos = null;
  differenceMoveShouldToggle = false;
  differenceMoveHitKind = 'none';
  differenceMoveHitControlPoint = null;
  differenceMoveHitFace = null;
  differenceMoveHitEdge = null;
  differenceMoveHitBody = null;
}

function clearDifferenceAddPending() {
  differenceAddClickPending = false;
  differenceAddDownPos = null;
  differenceAddShouldCreate = false;
}

function performDifferenceAddFromPointer() {
  if (!(editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'add')) { return false; }
  let faceHit = differenceHoveredFaceHit;
  if (!faceHit?.object?.userData?.differenceSpacePlane || !faceHit?.face) {
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(differenceSpacePlanes.filter((m) => m?.parent), true);
    faceHit = hits.find((h) => h?.object?.userData?.differenceSpacePlane && h?.face) || null;
  }
  if (faceHit?.object?.userData?.differenceSpacePlane && faceHit?.face) {
    beginDifferenceHistorySession();
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
      refreshDifferenceSelectedEdgeHighlights();
      commitDifferenceHistoryIfNeeded();
      return true;
    }
    differenceHistoryStartSnapshot = null;
    updateDifferenceStatus(formatDifferenceExtrudeFailureMessage(extrudeResult, faceHit));
    return true;
  }

  const point = coord_DisplayTo3D({ y: addPointGridY });
  beginDifferenceHistorySession();
  const plane = createDifferenceSpacePlane(point);
  addDifferenceControlPoints(plane);
  autoMergeNearbyDifferencePoints(plane.children.filter((child) => child?.userData?.differenceControlPoint));
  selectDifferencePlane(plane);
  targetObjects = differenceSpacePlanes.filter((m) => m?.parent);
  setMeshListOpacity(targetObjects, 1);
  refreshDifferencePreview();
  refreshDifferenceSelectedEdgeHighlights();
  updateDifferenceStatus('空き領域に空間ボックスを追加しました。');
  commitDifferenceHistoryIfNeeded();
  return true;
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
  if (differenceMoveHitKind === 'edge' && differenceMoveHitEdge?.mesh && differenceMoveHitEdge?.pointA && differenceMoveHitEdge?.pointB) {
    const primary = differenceMoveHitEdge;
    const dragPoints = [];
    const pushUnique = (p) => {
      if (!p?.userData?.differenceControlPoint || !p?.parent) { return; }
      if (dragPoints.includes(p)) { return; }
      dragPoints.push(p);
    };
    pushUnique(primary.pointA);
    pushUnique(primary.pointB);
    Array.from(differenceSelectedEdges.values()).forEach((entry) => {
      if (!entry?.mesh?.parent) { return; }
      pushUnique(entry?.pointA);
      pushUnique(entry?.pointB);
    });
    if (dragPoints.length < 1) { return false; }
    const ok = beginDifferenceControlPointDrag(dragPoints[0], dragPoints);
    if (ok) {
      clearDifferenceMovePending();
    }
    return ok;
  }
  if (differenceMoveHitKind === 'body' && differenceMoveHitBody?.userData?.differenceSpacePlane) {
    const primaryMesh = differenceMoveHitBody;
    const selectedBodies = Array.from(differenceSelectedBodies.values())
      .map((entry) => entry?.mesh)
      .filter((mesh) => mesh?.userData?.differenceSpacePlane && mesh !== primaryMesh);
    const meshes = [primaryMesh].concat(selectedBodies);
    const dragPoints = [];
    const pushUnique = (p) => {
      if (!p?.userData?.differenceControlPoint || !p?.parent) { return; }
      if (dragPoints.includes(p)) { return; }
      dragPoints.push(p);
    };
    meshes.forEach((mesh) => {
      mesh.children.forEach((child) => pushUnique(child));
    });
    if (dragPoints.length < 1) { return false; }
    const ok = beginDifferenceControlPointDrag(dragPoints[0], dragPoints);
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
    updateDifferenceSelectionStatus();
    clearDifferenceFaceHighlight();
    clearDifferenceMovePending();
    return true;
  }
  if (differenceMoveHitKind === 'edge' && differenceMoveHitEdge?.mesh && differenceMoveHitEdge?.pointA && differenceMoveHitEdge?.pointB) {
    toggleDifferenceEdgeSelection(
      differenceMoveHitEdge.mesh,
      differenceMoveHitEdge.pointA,
      differenceMoveHitEdge.pointB,
    );
    clearDifferenceFaceHighlight();
    updateDifferenceSelectionStatus();
    clearDifferenceMovePending();
    return true;
  }
  if (differenceMoveHitKind === 'face' && differenceMoveHitFace?.mesh && differenceMoveHitFace?.localNormal) {
    const selectionKey = buildDifferenceTransformSelectionKey({
      mesh: differenceMoveHitFace.mesh,
      localNormal: differenceMoveHitFace.localNormal,
    });
    const sameSelection = pointRotateTarget === differenceMoveHitFace.mesh && isSameDifferenceTransformSelection(selectionKey);
    // クリック選択時点で、面を操作対象として確定する。
    pointRotateTarget = differenceMoveHitFace.mesh;
    selectDifferencePlane(pointRotateTarget);
    if (differenceMoveHitFace?.hit?.point) {
      pointRotateCenter.copy(differenceMoveHitFace.hit.point);
    } else {
      pointRotateCenter.copy(pointRotateTarget.position);
    }
    if (!sameSelection) {
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
    }
    rememberDifferenceTransformSelection(selectionKey);
    updatePointRotateVisuals();

    const selected = toggleDifferenceFaceSelection(differenceMoveHitFace.mesh, differenceMoveHitFace.localNormal);
    updateDifferenceSelectionStatus();
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
  if (differenceMoveHitKind === 'body' && differenceMoveHitBody?.userData?.differenceSpacePlane) {
    const mesh = differenceMoveHitBody;
    const selectionKey = buildDifferenceTransformSelectionKey({ mesh });
    const sameSelection = pointRotateTarget === mesh && isSameDifferenceTransformSelection(selectionKey);
    pointRotateTarget = mesh;
    selectDifferencePlane(mesh);
    const selected = toggleDifferenceBodySelection(mesh);
    const selectedPoints = getDifferenceSelectedPointsForTransform();
    if (selectedPoints.length > 0) {
      const center = new THREE.Vector3();
      selectedPoints.forEach((point) => center.add(point.getWorldPosition(new THREE.Vector3())));
      center.multiplyScalar(1 / selectedPoints.length);
      pointRotateCenter.copy(center);
    } else {
      pointRotateCenter.copy(mesh.position);
    }
    if (!sameSelection) {
      pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
      pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
    }
    rememberDifferenceTransformSelection(selectionKey);
    updatePointRotateVisuals();
    if (!selected) {
      clearDifferenceFaceHighlight();
    }
    updateDifferenceSelectionStatus();
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
      metalness: 0.08,
      roughness: 0.58,
      flatShading: false,
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

function getDifferenceFaceControlPointsByPlaneCluster(mesh, localNormal, facePointLocal) {
  if (!mesh || !localNormal || !facePointLocal) { return []; }
  const cps = mesh.children.filter((child) => child?.userData?.differenceControlPoint);
  if (cps.length < 3) { return []; }
  const n = localNormal.clone().normalize();
  if (n.lengthSq() < 1e-8) { return []; }

  mesh.geometry?.computeBoundingBox?.();
  const diag = mesh.geometry?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
  const clusterGap = Math.max(0.02, diag * 0.018);
  const planeTol = Math.max(0.05, diag * 0.03);
  const targetD = n.dot(facePointLocal);

  const entries = cps.map((point) => ({
    point,
    d: n.dot(point.position),
  })).sort((a, b) => a.d - b.d);
  if (entries.length < 3) { return []; }

  const clusters = [];
  let current = [entries[0]];
  for (let i = 1; i < entries.length; i += 1) {
    if (Math.abs(entries[i].d - entries[i - 1].d) <= clusterGap) {
      current.push(entries[i]);
    } else {
      clusters.push(current);
      current = [entries[i]];
    }
  }
  clusters.push(current);
  if (clusters.length < 1) { return []; }

  let bestCluster = clusters[0];
  let bestDist = Infinity;
  clusters.forEach((cluster) => {
    const mean = cluster.reduce((acc, item) => acc + item.d, 0) / cluster.length;
    const dist = Math.abs(mean - targetD);
    if (dist < bestDist) {
      bestDist = dist;
      bestCluster = cluster;
    }
  });

  const meanD = bestCluster.reduce((acc, item) => acc + item.d, 0) / bestCluster.length;
  const expanded = entries
    .filter((item) => Math.abs(item.d - meanD) <= planeTol)
    .map((item) => item.point);

  if (expanded.length >= 3) { return expanded; }
  if (bestCluster.length >= 3) { return bestCluster.map((item) => item.point); }
  return [];
}

function getDifferenceFaceControlPoints(mesh, localNormal, facePointLocal = null) {
  if (!mesh || !localNormal) { return []; }

  // クリック面の情報がある場合は、軸依存ではなく「平面距離」で面頂点を抽出する。
  // これにより斜め面でも押し出し対象の頂点群を拾える。
  if (facePointLocal) {
    const clustered = getDifferenceFaceControlPointsByPlaneCluster(mesh, localNormal, facePointLocal);
    if (clustered.length >= 3) {
      return clustered;
    }
    const n = localNormal.clone().normalize();
    if (n.lengthSq() > 1e-8) {
      mesh.geometry?.computeBoundingBox?.();
      const diag = mesh.geometry?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
      const planeTol = Math.max(0.07, diag * 0.04);
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

function getDifferenceFaceControlPointsFromTriangles(mesh, localNormal, facePointLocal, tol = 0.14) {
  if (!mesh?.geometry?.attributes?.position || !localNormal || !facePointLocal) { return []; }
  const geometry = mesh.geometry;
  const pos = geometry.attributes.position;
  const n = localNormal.clone().normalize();
  if (n.lengthSq() < 1e-8) { return []; }

  const idxAttr = geometry.getIndex();
  const triCount = idxAttr ? Math.floor(idxAttr.count / 3) : Math.floor(pos.count / 3);
  if (triCount < 1) { return []; }

  const nearFaceVertexIndices = new Set();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const readV = (i, out) => out.set(pos.getX(i), pos.getY(i), pos.getZ(i));
  for (let t = 0; t < triCount; t += 1) {
    const ia = idxAttr ? idxAttr.getX(t * 3 + 0) : (t * 3 + 0);
    const ib = idxAttr ? idxAttr.getX(t * 3 + 1) : (t * 3 + 1);
    const ic = idxAttr ? idxAttr.getX(t * 3 + 2) : (t * 3 + 2);
    readV(ia, a);
    readV(ib, b);
    readV(ic, c);
    const da = Math.abs(a.clone().sub(facePointLocal).dot(n));
    const db = Math.abs(b.clone().sub(facePointLocal).dot(n));
    const dc = Math.abs(c.clone().sub(facePointLocal).dot(n));
    if (da <= tol && db <= tol && dc <= tol) {
      nearFaceVertexIndices.add(ia);
      nearFaceVertexIndices.add(ib);
      nearFaceVertexIndices.add(ic);
    }
  }
  if (nearFaceVertexIndices.size < 1) { return []; }

  const points = [];
  mesh.children.forEach((child) => {
    if (!child?.userData?.differenceControlPoint) { return; }
    const ids = child.userData?.differenceVertexIndices;
    if (!Array.isArray(ids) || ids.length < 1) { return; }
    const used = ids.some((i) => nearFaceVertexIndices.has(i));
    if (used) {
      points.push(child);
    }
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
  mesh.geometry.computeBoundingBox?.();
  const diag = mesh.geometry.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
  // 近接頂点の微小ブレを最初からまとめる（点増殖の抑制）
  const eps = Math.max(1e-5, diag * 2e-4);
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
  mergeCoincidentDifferenceControlPoints(mesh);
}

function pruneDifferenceControlPointsByMeaningfulEdges(mesh) {
  if (!mesh?.userData?.differenceSpacePlane) { return 0; }
  const points = mesh.children.filter((child) => child?.userData?.differenceControlPoint);
  if (points.length < 3) { return 0; }

  const meaningfulEdges = getDifferenceMeshControlPointEdges(mesh);
  if (!Array.isArray(meaningfulEdges) || meaningfulEdges.length < 1) { return 0; }

  const used = new Set();
  meaningfulEdges.forEach((edge) => {
    if (edge?.pointA?.parent === mesh) { used.add(edge.pointA); }
    if (edge?.pointB?.parent === mesh) { used.add(edge.pointB); }
  });
  // 落とし過ぎ防止: 最低4点は維持
  if (used.size < 4) { return 0; }

  let removed = 0;
  points.forEach((point) => {
    if (used.has(point)) { return; }
    const links = Array.isArray(point.userData?.sharedDifferencePoints)
      ? point.userData.sharedDifferencePoints.slice()
      : [];
    links.forEach((linked) => removeDifferenceSharedPointLink(point, linked));
    if (differenceSelectedControlPoints.has(point)) {
      differenceSelectedControlPoints.delete(point);
    }
    if (point.parent) {
      point.parent.remove(point);
    }
    point.geometry?.dispose?.();
    point.material?.dispose?.();
    removed += 1;
  });
  if (removed > 0) {
    updateDifferenceControlPointMarkerTransform(mesh);
  }
  return removed;
}

function mergeCoincidentDifferenceControlPoints(mesh, eps = null) {
  if (!mesh?.userData?.differenceSpacePlane) { return 0; }
  const points = mesh.children.filter((child) => child?.userData?.differenceControlPoint);
  if (points.length < 2) { return 0; }
  mesh.geometry?.computeBoundingBox?.();
  const diag = mesh.geometry?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
  // 辺を維持したまま点を統合したいので、許容をやや広めにする
  const tol = Number.isFinite(eps) ? Math.max(1e-6, eps) : Math.max(2e-5, diag * 5e-4);

  const keyOfPos = (p) => {
    const x = Math.round(p.position.x / tol);
    const y = Math.round(p.position.y / tol);
    const z = Math.round(p.position.z / tol);
    return `${x},${y},${z}`;
  };

  const buckets = new Map();
  points.forEach((p) => {
    const k = keyOfPos(p);
    if (!buckets.has(k)) { buckets.set(k, []); }
    buckets.get(k).push(p);
  });

  let removed = 0;
  buckets.forEach((group) => {
    if (!Array.isArray(group) || group.length < 2) { return; }
    const keeper = group[0];
    const keepIdx = new Set(Array.isArray(keeper.userData?.differenceVertexIndices) ? keeper.userData.differenceVertexIndices : []);
    for (let i = 1; i < group.length; i += 1) {
      const point = group[i];
      if (!point || !point.parent || point === keeper) { continue; }

      const idx = Array.isArray(point.userData?.differenceVertexIndices) ? point.userData.differenceVertexIndices : [];
      idx.forEach((v) => {
        if (Number.isInteger(v)) { keepIdx.add(v); }
      });

      const links = Array.isArray(point.userData?.sharedDifferencePoints)
        ? point.userData.sharedDifferencePoints.slice()
        : [];
      links.forEach((linked) => {
        if (!linked || linked === keeper || linked === point) { return; }
        addDifferenceSharedPointLink(keeper, linked);
        removeDifferenceSharedPointLink(point, linked);
      });
      removeDifferenceSharedPointLink(point, keeper);

      if (differenceSelectedControlPoints.has(point)) {
        differenceSelectedControlPoints.delete(point);
        differenceSelectedControlPoints.add(keeper);
      }
      if (differenceControlPointDragPoint === point) {
        differenceControlPointDragPoint = keeper;
      }
      if (differenceMoveHitControlPoint === point) {
        differenceMoveHitControlPoint = keeper;
      }

      point.parent.remove(point);
      point.geometry?.dispose?.();
      point.material?.dispose?.();
      removed += 1;
    }
    keeper.userData = {
      ...(keeper.userData || {}),
      differenceVertexIndices: Array.from(keepIdx),
    };
    setDifferenceControlPointVisual(keeper);
  });

  if (removed > 0) {
    updateDifferenceControlPointMarkerTransform(mesh);
  }
  return removed;
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

  if (!isDifferenceControlPointSelected(a)) {
    setDifferenceControlPointVisual(a);
  }
  if (!isDifferenceControlPointSelected(b)) {
    setDifferenceControlPointVisual(b);
  }
}

function removeDifferenceSharedPointLink(a, b) {
  if (!a || !b || a === b) { return; }
  const linksA = Array.isArray(a.userData?.sharedDifferencePoints) ? a.userData.sharedDifferencePoints : [];
  a.userData.sharedDifferencePoints = linksA.filter((p) => p && p !== b);
  const linksB = Array.isArray(b.userData?.sharedDifferencePoints) ? b.userData.sharedDifferencePoints : [];
  b.userData.sharedDifferencePoints = linksB.filter((p) => p && p !== a);
}

function getActiveDifferenceSpaces() {
  return differenceSpacePlanes.filter((mesh) => mesh?.parent && mesh?.geometry && mesh?.userData?.differenceSpacePlane);
}

function getDifferenceMeshBoundaryControlPoints(mesh) {
  if (!mesh?.userData?.differenceSpacePlane || !mesh?.geometry?.attributes?.position) { return []; }
  const geometry = mesh.geometry;
  const pos = geometry.attributes.position;
  const idx = geometry.getIndex();
  const cpList = mesh.children.filter((child) => child?.userData?.differenceControlPoint);
  if (cpList.length < 2 || pos.count < 3) { return []; }

  geometry.computeBoundingBox?.();
  const diag = geometry.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
  const weldTol = Math.max(1e-5, diag * 8e-4);
  const findTolSq = Math.max(0.03, diag * 0.06) ** 2;
  const edgeCount = new Map();
  const keyOfCoord = (x, y, z) => {
    const ix = Math.round(x / weldTol);
    const iy = Math.round(y / weldTol);
    const iz = Math.round(z / weldTol);
    return `${ix},${iy},${iz}`;
  };
  const keyOfVertex = (vi) => keyOfCoord(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
  const addEdge = (a, b) => {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) { return; }
    const ka = keyOfVertex(a);
    const kb = keyOfVertex(b);
    const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
  };

  const triCount = idx ? Math.floor(idx.count / 3) : Math.floor(pos.count / 3);
  for (let t = 0; t < triCount; t += 1) {
    const a = idx ? Number(idx.getX(t * 3 + 0)) : (t * 3 + 0);
    const b = idx ? Number(idx.getX(t * 3 + 1)) : (t * 3 + 1);
    const c = idx ? Number(idx.getX(t * 3 + 2)) : (t * 3 + 2);
    addEdge(a, b);
    addEdge(b, c);
    addEdge(c, a);
  }

  const resolvePointByKey = (vKey) => {
    const [sx, sy, sz] = String(vKey).split(',');
    const vx = Number(sx) * weldTol;
    const vy = Number(sy) * weldTol;
    const vz = Number(sz) * weldTol;
    let best = null;
    let bestD = Infinity;
    cpList.forEach((point) => {
      const dx = point.position.x - vx;
      const dy = point.position.y - vy;
      const dz = point.position.z - vz;
      const d = (dx * dx) + (dy * dy) + (dz * dz);
      if (d < bestD) {
        bestD = d;
        best = point;
      }
    });
    if (!best || bestD > findTolSq) { return null; }
    return best;
  };

  const boundaryPoints = new Set();
  edgeCount.forEach((count, key) => {
    // 境界辺: 三角形1枚のみに属する辺
    if (count !== 1) { return; }
    const [ka, kb] = key.split('|');
    const pa = resolvePointByKey(ka);
    const pb = resolvePointByKey(kb);
    if (pa?.parent === mesh) { boundaryPoints.add(pa); }
    if (pb?.parent === mesh) { boundaryPoints.add(pb); }
  });

  // 完全閉空間などで境界辺が0件でも、意味あるエッジ上の点は対象に含める。
  if (boundaryPoints.size < 2) {
    const edges = getDifferenceMeshControlPointEdges(mesh);
    edges.forEach((edge) => {
      if (edge?.pointA?.parent === mesh) { boundaryPoints.add(edge.pointA); }
      if (edge?.pointB?.parent === mesh) { boundaryPoints.add(edge.pointB); }
    });
  }
  return Array.from(boundaryPoints);
}

function mergeOverlappedBoundaryControlPoints(threshold = differenceBoundaryMergeDistance) {
  const spaces = getActiveDifferenceSpaces();
  if (spaces.length < 1) { return 0; }
  const boundaryPoints = spaces
    .flatMap((mesh) => getDifferenceMeshBoundaryControlPoints(mesh))
    .filter((point) => point?.userData?.differenceControlPoint && point?.parent);
  if (boundaryPoints.length < 2) { return 0; }

  const maxDiag = spaces.reduce((acc, mesh) => {
    mesh.geometry?.computeBoundingBox?.();
    const d = mesh.geometry?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 0;
    return Math.max(acc, d);
  }, 0);
  const adaptiveTol = Math.max(Number(threshold) || differenceBoundaryMergeDistance, maxDiag * 0.015);
  const tol = Math.max(1e-6, adaptiveTol);
  const tolSq = tol * tol;
  const worldPoints = boundaryPoints.map((point) => point.getWorldPosition(new THREE.Vector3()));
  const visited = new Array(boundaryPoints.length).fill(false);
  const dirtyMeshes = new Set();
  const touchedPoints = [];
  let merged = 0;

  for (let i = 0; i < boundaryPoints.length; i += 1) {
    if (visited[i]) { continue; }
    const cluster = [i];
    visited[i] = true;
    const queue = [i];
    while (queue.length > 0) {
      const cur = queue.shift();
      const p = worldPoints[cur];
      for (let j = 0; j < boundaryPoints.length; j += 1) {
        if (visited[j]) { continue; }
        if (p.distanceToSquared(worldPoints[j]) > tolSq) { continue; }
        visited[j] = true;
        cluster.push(j);
        queue.push(j);
      }
    }
    if (cluster.length < 2) { continue; }

    const center = new THREE.Vector3();
    cluster.forEach((idxCp) => center.add(worldPoints[idxCp]));
    center.multiplyScalar(1 / cluster.length);
    const keeper = boundaryPoints[cluster[0]];
    cluster.forEach((idxCp) => {
      const point = boundaryPoints[idxCp];
      const inv = new THREE.Matrix4().copy(point.parent.matrixWorld).invert();
      point.position.copy(center.clone().applyMatrix4(inv));
      dirtyMeshes.add(point.parent);
      touchedPoints.push(point);
      if (point !== keeper) {
        addDifferenceSharedPointLink(keeper, point);
      }
    });
    merged += (cluster.length - 1);
  }

  if (merged < 1) {
    rebuildDifferenceEdgeOverlapConstraints();
    return 0;
  }
  propagateDifferenceSharedPoints(touchedPoints, dirtyMeshes);
  dirtyMeshes.forEach((mesh) => {
    syncDifferenceGeometryFromControlPoints(mesh);
    mergeCoincidentDifferenceControlPoints(mesh, Math.max(1e-6, tol * 0.6));
    updateDifferenceControlPointMarkerTransform(mesh);
  });
  rebuildDifferenceEdgeOverlapConstraints();
  return merged;
}

function buildDifferenceIntersectGroups(spaces = getActiveDifferenceSpaces()) {
  const list = Array.isArray(spaces)
    ? spaces.filter((mesh) => mesh?.parent && mesh?.geometry)
    : [];
  if (list.length < 2) { return []; }

  const parents = list.map((_, i) => i);
  const findRoot = (i) => {
    let node = i;
    while (parents[node] !== node) {
      parents[node] = parents[parents[node]];
      node = parents[node];
    }
    return node;
  };
  const unionSet = (a, b) => {
    const ra = findRoot(a);
    const rb = findRoot(b);
    if (ra !== rb) {
      parents[rb] = ra;
    }
  };

  const boxes = list.map((mesh) => {
    mesh.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(mesh);
  });
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const boxA = boxes[i];
      const boxB = boxes[j];
      if (!boxA || !boxB || boxA.isEmpty() || boxB.isEmpty()) { continue; }
      if (!boxA.intersectsBox(boxB)) { continue; }
      unionSet(i, j);
    }
  }

  const groups = new Map();
  list.forEach((mesh, idx) => {
    const root = findRoot(idx);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root).push(mesh);
  });
  return Array.from(groups.values()).filter((group) => group.length >= 2);
}

function updateDifferenceUnifyButtonState() {
  if (!differenceUnifyButton) { return; }
  let isDifferenceContext = false;
  try {
    isDifferenceContext = (editObject === 'DIFFERENCE_SPACE') || differenceSpaceModeActive;
  } catch (err) {
    isDifferenceContext = false;
  }
  differenceUnifyButton.style.display = isDifferenceContext ? 'block' : 'none';
  differenceUnifyButton.disabled = !isDifferenceContext;
  if (differenceViewToggleButton) {
    differenceViewToggleButton.style.display = isDifferenceContext ? 'block' : 'none';
    differenceViewToggleButton.disabled = !isDifferenceContext;
  }
  let viewModeReady = true;
  try {
    void differenceViewMode;
  } catch (err) {
    viewModeReady = false;
  }
  if (!isDifferenceContext && viewModeReady && differenceViewMode !== 'diff') {
    differenceViewMode = 'diff';
    applyDifferenceViewMode();
  }
}

function removeDifferenceSpaceMeshForUnify(mesh) {
  if (!mesh) { return false; }
  const controlPoints = mesh.children.filter((child) => child?.userData?.differenceControlPoint);
  controlPoints.forEach((point) => {
    if (isDifferenceControlPointSelected(point)) {
      differenceSelectedControlPoints.delete(point);
    }
    const linkedPoints = Array.isArray(point.userData?.sharedDifferencePoints)
      ? point.userData.sharedDifferencePoints.slice()
      : [];
    linkedPoints.forEach((linked) => removeDifferenceSharedPointLink(point, linked));
    point.userData.sharedDifferencePoints = [];
    mesh.remove(point);
    point.geometry?.dispose?.();
    point.material?.dispose?.();
  });

  if (differenceSelectedPlane === mesh) {
    selectDifferencePlane(null);
  }
  if (mesh.parent) {
    mesh.parent.remove(mesh);
  }
  mesh.geometry?.dispose?.();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => mat?.dispose?.());
  } else {
    mesh.material?.dispose?.();
  }
  const idx = differenceSpacePlanes.indexOf(mesh);
  if (idx >= 0) {
    differenceSpacePlanes.splice(idx, 1);
  }
  return true;
}

function cleanupDifferenceUnifiedGeometry(geometry) {
  if (!geometry?.attributes?.position) { return geometry || null; }
  let geom = geometry;
  const pos = geom.attributes.position;
  if (!geom.getIndex()) {
    const index = Array.from({ length: pos.count }, (_, i) => i);
    geom.setIndex(index);
  }
  const indexAttr = geom.getIndex();
  if (indexAttr && indexAttr.count >= 3) {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const cross = new THREE.Vector3();
    const kept = [];
    const triDedup = new Set();
    for (let i = 0; i < indexAttr.count; i += 3) {
      const ia = indexAttr.getX(i + 0);
      const ib = indexAttr.getX(i + 1);
      const ic = indexAttr.getX(i + 2);
      a.set(pos.getX(ia), pos.getY(ia), pos.getZ(ia));
      b.set(pos.getX(ib), pos.getY(ib), pos.getZ(ib));
      c.set(pos.getX(ic), pos.getY(ic), pos.getZ(ic));
      ab.subVectors(b, a);
      ac.subVectors(c, a);
      cross.crossVectors(ab, ac);
      if (cross.lengthSq() <= 1e-12) { continue; }
      const ka = Math.min(ia, ib, ic);
      const kc = Math.max(ia, ib, ic);
      const kb = (ia + ib + ic) - ka - kc;
      const triKey = `${ka}|${kb}|${kc}`;
      if (triDedup.has(triKey)) { continue; }
      triDedup.add(triKey);
      kept.push(ia, ib, ic);
    }
    if (kept.length >= 3 && kept.length < indexAttr.count) {
      geom.setIndex(kept);
    }
  }
  geom.computeBoundingBox?.();
  const diag = geom.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
  // 品質優先: 溶接を段階的に行い、微小な割れを減らす
  const weldSteps = [
    Math.max(1e-6, diag * 6e-5),
    Math.max(1e-6, diag * 1e-4),
    Math.max(1e-6, diag * 1.6e-4),
  ];
  weldSteps.forEach((eps) => {
    const welded = mergeVertices(geom, eps) || geom;
    if (welded !== geom) {
      geom.dispose?.();
      geom = welded;
    }
    geom.computeVertexNormals();
    geom.computeBoundingBox?.();
    geom.computeBoundingSphere?.();
  });

  // さらに微小三角形を除去して面のちらつき/乱れを低減
  const pos2 = geom.attributes?.position;
  const idx2 = geom.getIndex();
  if (pos2 && idx2 && idx2.count >= 3) {
    const bbDiag = geom.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || diag || 1;
    const areaThreshold = Math.max(1e-12, (bbDiag * bbDiag) * 1e-10);
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const p2 = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    const n = new THREE.Vector3();
    const kept = [];
    for (let i = 0; i < idx2.count; i += 3) {
      const ia = idx2.getX(i + 0);
      const ib = idx2.getX(i + 1);
      const ic = idx2.getX(i + 2);
      p0.set(pos2.getX(ia), pos2.getY(ia), pos2.getZ(ia));
      p1.set(pos2.getX(ib), pos2.getY(ib), pos2.getZ(ib));
      p2.set(pos2.getX(ic), pos2.getY(ic), pos2.getZ(ic));
      e1.subVectors(p1, p0);
      e2.subVectors(p2, p0);
      n.crossVectors(e1, e2);
      const area2 = n.lengthSq() * 0.25;
      if (area2 <= areaThreshold) { continue; }
      kept.push(ia, ib, ic);
    }
    if (kept.length >= 3 && kept.length < idx2.count) {
      geom.setIndex(kept);
    }
  }
  geom.computeVertexNormals();
  geom.computeBoundingBox?.();
  geom.computeBoundingSphere?.();
  geom = simplifyCoplanarPatchesToPlanes(geom, {
    angleDegTol: 2.8,
    distTolScale: 1.6e-3,
    minTrianglesPerPatch: 3,
  }) || geom;
  geom.computeVertexNormals();
  geom.computeBoundingBox?.();
  geom.computeBoundingSphere?.();
  return geom;
}

function simplifyCoplanarPatchesToPlanes(geometry, options = {}) {
  if (!geometry?.attributes?.position) { return geometry || null; }
  const geom = geometry;
  const pos = geom.attributes.position;
  if (!geom.getIndex()) {
    const idx = Array.from({ length: pos.count }, (_, i) => i);
    geom.setIndex(idx);
  }
  const indexAttr = geom.getIndex();
  if (!indexAttr || indexAttr.count < 9) { return geom; }

  geom.computeBoundingBox?.();
  const diag = geom.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
  const angleDegTol = Number.isFinite(options.angleDegTol) ? options.angleDegTol : 2.0;
  const angleTol = THREE.MathUtils.degToRad(Math.max(0.05, angleDegTol));
  const normalStep = Math.max(1e-4, Math.sin(angleTol) * 0.5);
  const distTol = Math.max(1e-6, diag * (Number.isFinite(options.distTolScale) ? options.distTolScale : 1e-3));
  const minTrianglesPerPatch = Math.max(3, Number(options.minTrianglesPerPatch) || 3);

  const triCount = Math.floor(indexAttr.count / 3);
  const triangles = new Array(triCount);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let t = 0; t < triCount; t += 1) {
    const i0 = indexAttr.getX(t * 3 + 0);
    const i1 = indexAttr.getX(t * 3 + 1);
    const i2 = indexAttr.getX(t * 3 + 2);
    a.set(pos.getX(i0), pos.getY(i0), pos.getZ(i0));
    b.set(pos.getX(i1), pos.getY(i1), pos.getZ(i1));
    c.set(pos.getX(i2), pos.getY(i2), pos.getZ(i2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac);
    const lenSq = n.lengthSq();
    if (lenSq <= 1e-12) {
      triangles[t] = { i0, i1, i2, valid: false };
      continue;
    }
    n.multiplyScalar(1 / Math.sqrt(lenSq));
    const d = -n.dot(a);
    const sideLike = Math.abs(n.y) < 0.45;
    const nStepLocal = normalStep * (sideLike ? 1.7 : 1.0);
    const dTolLocal = distTol * (sideLike ? 2.4 : 1.0);
    const key = `${Math.round(n.x / nStepLocal)},${Math.round(n.y / nStepLocal)},${Math.round(n.z / nStepLocal)}|${Math.round(d / dTolLocal)}`;
    triangles[t] = { i0, i1, i2, n: n.clone(), d, key, valid: true };
  }

  const planeGroups = new Map();
  for (let t = 0; t < triangles.length; t += 1) {
    const tri = triangles[t];
    if (!tri?.valid) { continue; }
    if (!planeGroups.has(tri.key)) {
      planeGroups.set(tri.key, []);
    }
    planeGroups.get(tri.key).push(t);
  }

  const triRemove = new Set();
  const triAdd = [];
  const edgeKey = (u, v) => (u < v ? `${u}|${v}` : `${v}|${u}`);

  const buildPatchComponents = (triIndices) => {
    const edgeToTris = new Map();
    triIndices.forEach((ti) => {
      const tri = triangles[ti];
      const edges = [
        [tri.i0, tri.i1],
        [tri.i1, tri.i2],
        [tri.i2, tri.i0],
      ];
      edges.forEach(([u, v]) => {
        const key = edgeKey(u, v);
        if (!edgeToTris.has(key)) { edgeToTris.set(key, []); }
        edgeToTris.get(key).push(ti);
      });
    });
    const adj = new Map();
    triIndices.forEach((ti) => adj.set(ti, new Set()));
    edgeToTris.forEach((owners) => {
      if (!owners || owners.length < 2) { return; }
      for (let i = 0; i < owners.length; i += 1) {
        for (let j = i + 1; j < owners.length; j += 1) {
          adj.get(owners[i])?.add(owners[j]);
          adj.get(owners[j])?.add(owners[i]);
        }
      }
    });
    const visited = new Set();
    const comps = [];
    triIndices.forEach((start) => {
      if (visited.has(start)) { return; }
      const q = [start];
      const comp = [];
      visited.add(start);
      while (q.length > 0) {
        const cur = q.pop();
        comp.push(cur);
        adj.get(cur)?.forEach((nx) => {
          if (visited.has(nx)) { return; }
          visited.add(nx);
          q.push(nx);
        });
      }
      comps.push(comp);
    });
    return comps;
  };

  const extractBoundaryLoop = (comp) => {
    const edgeCount = new Map();
    comp.forEach((ti) => {
      const tri = triangles[ti];
      const edges = [
        [tri.i0, tri.i1],
        [tri.i1, tri.i2],
        [tri.i2, tri.i0],
      ];
      edges.forEach(([u, v]) => {
        const k = edgeKey(u, v);
        edgeCount.set(k, (edgeCount.get(k) || 0) + 1);
      });
    });
    const boundaryEdges = [];
    edgeCount.forEach((count, k) => {
      if (count !== 1) { return; }
      const [su, sv] = k.split('|');
      boundaryEdges.push([Number(su), Number(sv)]);
    });
    if (boundaryEdges.length < 3) { return null; }

    const nbr = new Map();
    boundaryEdges.forEach(([u, v]) => {
      if (!nbr.has(u)) { nbr.set(u, []); }
      if (!nbr.has(v)) { nbr.set(v, []); }
      nbr.get(u).push(v);
      nbr.get(v).push(u);
    });
    for (const [, list] of nbr) {
      if (list.length !== 2) { return null; }
    }

    let start = null;
    for (const key of nbr.keys()) {
      start = key;
      break;
    }
    if (start == null) { return null; }

    const loop = [start];
    let prev = null;
    let cur = start;
    const maxSteps = boundaryEdges.length + 4;
    for (let step = 0; step < maxSteps; step += 1) {
      const nexts = nbr.get(cur) || [];
      if (nexts.length < 1) { return null; }
      let nx = nexts[0];
      if (prev != null && nexts.length > 1 && nx === prev) {
        nx = nexts[1];
      }
      if (nx === start) {
        break;
      }
      loop.push(nx);
      prev = cur;
      cur = nx;
    }
    if (loop.length < 3) { return null; }
    return loop;
  };

  const buildPatchTrianglesFromLoop = (loop, normalRef) => {
    if (!Array.isArray(loop) || loop.length < 3 || !normalRef) { return null; }
    const p0 = new THREE.Vector3(pos.getX(loop[0]), pos.getY(loop[0]), pos.getZ(loop[0]));
    let u = null;
    for (let i = 1; i < loop.length; i += 1) {
      const pi = new THREE.Vector3(pos.getX(loop[i]), pos.getY(loop[i]), pos.getZ(loop[i]));
      const v = pi.clone().sub(p0);
      if (v.lengthSq() > 1e-10) {
        u = v.normalize();
        break;
      }
    }
    if (!u) { return null; }
    const vAxis = new THREE.Vector3().crossVectors(normalRef, u).normalize();
    if (vAxis.lengthSq() <= 1e-10) { return null; }

    const simplifyLoopIndices = (indices) => {
      if (!Array.isArray(indices) || indices.length < 4) { return indices || []; }
      const sideFactor = Math.abs(normalRef.y) < 0.45 ? 1.8 : 1.0;
      const shortTol = Math.max(1e-6, diag * 2e-4 * sideFactor);
      const shortTolSq = shortTol * shortTol;
      const lineTol = Math.max(1e-6, diag * 1e-4 * sideFactor);
      const straightDegTol = Math.min(6.0, 2.0 * sideFactor);
      let work = indices.slice();
      for (let pass = 0; pass < 6; pass += 1) {
        if (work.length < 4) { break; }
        let changed = false;
        const next = [];
        for (let i = 0; i < work.length; i += 1) {
          const prevIdx = work[(i - 1 + work.length) % work.length];
          const curIdx = work[i];
          const nextIdx = work[(i + 1) % work.length];
          const pPrev = new THREE.Vector3(pos.getX(prevIdx), pos.getY(prevIdx), pos.getZ(prevIdx));
          const pCur = new THREE.Vector3(pos.getX(curIdx), pos.getY(curIdx), pos.getZ(curIdx));
          const pNext = new THREE.Vector3(pos.getX(nextIdx), pos.getY(nextIdx), pos.getZ(nextIdx));

          const v1 = pCur.clone().sub(pPrev);
          const v2 = pNext.clone().sub(pCur);
          const l1Sq = v1.lengthSq();
          const l2Sq = v2.lengthSq();
          if (l1Sq <= shortTolSq || l2Sq <= shortTolSq) {
            changed = true;
            continue;
          }
          const l1 = Math.sqrt(l1Sq);
          const l2 = Math.sqrt(l2Sq);
          const d = THREE.MathUtils.clamp(v1.dot(v2) / (l1 * l2), -1, 1);
          const angle = Math.acos(d);

          const base = pNext.clone().sub(pPrev);
          let lineDist = Infinity;
          const baseLenSq = base.lengthSq();
          if (baseLenSq > 1e-10) {
            const t = THREE.MathUtils.clamp(pCur.clone().sub(pPrev).dot(base) / baseLenSq, 0, 1);
            const close = pPrev.clone().add(base.multiplyScalar(t));
            lineDist = pCur.distanceTo(close);
          }
          // ほぼ一直線（180deg付近）かつ線からのズレが小さい頂点は削除する。
          if (Math.abs(Math.PI - angle) <= THREE.MathUtils.degToRad(straightDegTol) && lineDist <= lineTol) {
            changed = true;
            continue;
          }
          next.push(curIdx);
        }
        if (!changed) { break; }
        work = next;
      }
      return work.length >= 3 ? work : indices;
    };

    const simplifiedLoop = simplifyLoopIndices(loop);
    if (!Array.isArray(simplifiedLoop) || simplifiedLoop.length < 3) { return null; }

    const contour = simplifiedLoop.map((vi) => {
      const p = new THREE.Vector3(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
      const rel = p.sub(p0);
      return new THREE.Vector2(rel.dot(u), rel.dot(vAxis));
    });
    const tri2d = THREE.ShapeUtils.triangulateShape(contour, []);
    if (!Array.isArray(tri2d) || tri2d.length < 1) { return null; }

    const out = tri2d.map((tri) => {
      const ia = simplifiedLoop[tri[0]];
      const ib = simplifiedLoop[tri[1]];
      const ic = simplifiedLoop[tri[2]];
      return [ia, ib, ic];
    });
    if (out.length < 1) { return null; }

    const t0 = out[0];
    const ta = new THREE.Vector3(pos.getX(t0[0]), pos.getY(t0[0]), pos.getZ(t0[0]));
    const tb = new THREE.Vector3(pos.getX(t0[1]), pos.getY(t0[1]), pos.getZ(t0[1]));
    const tc = new THREE.Vector3(pos.getX(t0[2]), pos.getY(t0[2]), pos.getZ(t0[2]));
    const tn = new THREE.Vector3().crossVectors(tb.clone().sub(ta), tc.clone().sub(ta)).normalize();
    if (tn.lengthSq() > 1e-10 && tn.dot(normalRef) < 0) {
      for (let i = 0; i < out.length; i += 1) {
        const tmp = out[i][1];
        out[i][1] = out[i][2];
        out[i][2] = tmp;
      }
    }
    return out;
  };

  planeGroups.forEach((triIndices) => {
    if (!Array.isArray(triIndices) || triIndices.length < minTrianglesPerPatch) { return; }
    const comps = buildPatchComponents(triIndices);
    comps.forEach((comp) => {
      if (!Array.isArray(comp) || comp.length < minTrianglesPerPatch) { return; }
      const loop = extractBoundaryLoop(comp);
      if (!loop) { return; }
      const normalRef = comp
        .map((ti) => triangles[ti]?.n)
        .filter(Boolean)
        .reduce((acc, cn) => acc.add(cn), new THREE.Vector3());
      if (normalRef.lengthSq() <= 1e-12) { return; }
      normalRef.normalize();
      const patchTris = buildPatchTrianglesFromLoop(loop, normalRef);
      if (!patchTris || patchTris.length < 1) { return; }
      comp.forEach((ti) => triRemove.add(ti));
      patchTris.forEach((tri) => triAdd.push(tri));
    });
  });

  if (triRemove.size < 1 || triAdd.length < 1) { return geom; }

  const rebuilt = [];
  for (let t = 0; t < triangles.length; t += 1) {
    const tri = triangles[t];
    if (!tri?.valid) { continue; }
    if (triRemove.has(t)) { continue; }
    rebuilt.push(tri.i0, tri.i1, tri.i2);
  }
  triAdd.forEach((tri) => {
    rebuilt.push(tri[0], tri[1], tri[2]);
  });
  if (rebuilt.length >= 3) {
    geom.setIndex(rebuilt);
  }
  return geom;
}

function runHighQualityDifferenceUnify() {
  const spaces = getActiveDifferenceSpaces();
  if (spaces.length < 2) {
    updateDifferenceStatus('高品質一体化: 空間が2つ以上必要です。');
    updateDifferenceUnifyButtonState();
    return false;
  }

  scene.updateMatrixWorld(true);
  const groups = buildDifferenceIntersectGroups(spaces);
  if (groups.length < 1) {
    updateDifferenceStatus('高品質一体化: 交差する空間がありません。');
    updateDifferenceUnifyButtonState();
    return false;
  }

  beginDifferenceHistorySession();
  let unifiedGroupCount = 0;
  let removedSpaceCount = 0;

  groups.forEach((group) => {
    if (!Array.isArray(group) || group.length < 2) { return; }
    const root = group.find((mesh) => mesh?.parent && mesh?.geometry);
    if (!root) { return; }

    const worldGeometries = group
      .filter((mesh) => mesh?.parent && mesh?.geometry)
      .map((mesh) => {
        mesh.updateMatrixWorld(true);
        let cloned = mesh.geometry.clone();
        cloned = cleanupDifferenceUnifiedGeometry(cloned) || cloned;
        cloned.applyMatrix4(mesh.matrixWorld);
        return cloned;
      });
    if (worldGeometries.length < 2) {
      worldGeometries.forEach((g) => g.dispose?.());
      return;
    }

    let mergedGeometry = null;
    try {
      mergedGeometry = worldGeometries[0];
      for (let i = 1; i < worldGeometries.length; i += 1) {
        const nextGeometry = worldGeometries[i];
        const result = differenceCsgEvaluator.evaluate(
          new Brush(mergedGeometry),
          new Brush(nextGeometry),
          ADDITION,
        );
        if (!result?.geometry) {
          throw new Error('union_result_empty');
        }
        mergedGeometry.dispose?.();
        nextGeometry.dispose?.();
        mergedGeometry = result.geometry;
      }
    } catch (err) {
      // 品質優先: 失敗時の雑な mergeGeometries フォールバックは使わない
      // （重なり面が残って見た目が崩れやすいため）
      console.warn('Difference union failed; quality mode skips fallback merge', err);
      worldGeometries.forEach((g) => g.dispose?.());
      return;
    }

    const worldToRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    mergedGeometry.applyMatrix4(worldToRoot);
    const cleaned = cleanupDifferenceUnifiedGeometry(mergedGeometry);
    if (!cleaned) {
      mergedGeometry.dispose?.();
      return;
    }

    const previousGeometry = root.geometry;
    root.geometry = cleaned;
    if (previousGeometry && previousGeometry !== cleaned) {
      previousGeometry.dispose?.();
    }
    root.userData = {
      ...(root.userData || {}),
      differenceCornerVertexMap: null,
      differenceSpacePlane: true,
    };
    rebuildDifferenceControlPointsFromGeometry(root);
    syncDifferenceGeometryFromControlPoints(root);
    mergeCoincidentDifferenceControlPoints(root);
    pruneDifferenceControlPointsByMeaningfulEdges(root);

    group.forEach((mesh) => {
      if (!mesh || mesh === root) { return; }
      if (removeDifferenceSpaceMeshForUnify(mesh)) {
        removedSpaceCount += 1;
      }
    });
    unifiedGroupCount += 1;
  });

  relinkImportedDifferenceSharedPoints();
  mergeOverlappedBoundaryControlPoints();
  rebuildDifferenceEdgeOverlapConstraints();
  clearDifferenceFaceSelection();
  clearDifferenceEdgeSelection();
  clearDifferenceControlPointSelection();
  selectDifferencePlane(null);
  targetObjects = getActiveDifferenceSpaces();
  setMeshListOpacity(targetObjects, 1);
  refreshDifferencePreview();
  refreshDifferenceSelectedEdgeHighlights();
  commitDifferenceHistoryIfNeeded();

  if (removedSpaceCount < 1) {
    updateDifferenceStatus('高品質一体化: 形状更新はありませんでした。');
    updateDifferenceUnifyButtonState();
    return false;
  }
  updateDifferenceStatus(`高品質一体化 完了: ${unifiedGroupCount}グループ / ${removedSpaceCount}空間を統合`);
  updateDifferenceUnifyButtonState();
  return true;
}

function showDifferenceMergeNoticeAt(worldPos, text = '結合しました') {
  const sprite = buildSimpleLabelSprite(text, '#1f4ecf');
  if (!sprite) { return; }
  sprite.position.copy(worldPos);
  sprite.position.y += 0.24;
  sprite.renderOrder = 2600;
  scene.add(sprite);
  window.setTimeout(() => {
    if (sprite.parent) {
      sprite.parent.remove(sprite);
    }
    if (sprite.material?.map?.dispose) {
      sprite.material.map.dispose();
    }
    if (sprite.material?.dispose) {
      sprite.material.dispose();
    }
  }, 1400);
}

function autoMergeNearbyDifferencePoints(changedPoints = [], threshold = differenceAutoMergeDistance) {
  const candidatePoints = (Array.isArray(changedPoints) && changedPoints.length > 0)
    ? changedPoints
    : differenceSpacePlanes.flatMap((mesh) => mesh?.children?.filter?.((child) => child?.userData?.differenceControlPoint) || []);
  const sources = candidatePoints.filter((point) => point?.userData?.differenceControlPoint && point?.parent);
  if (sources.length < 1) { return 0; }

  const allPoints = differenceSpacePlanes.flatMap((mesh) => mesh?.children?.filter?.((child) => child?.userData?.differenceControlPoint) || [])
    .filter((point) => point?.parent);
  if (allPoints.length < 2) { return 0; }

  const thresholdSq = Math.max(1e-8, threshold * threshold);
  const visitedPairs = new Set();
  const dirtyMeshes = new Set();
  const touchedPoints = new Set();
  const wa = new THREE.Vector3();
  const wb = new THREE.Vector3();
  let mergedCount = 0;

  sources.forEach((a) => {
    if (!a?.parent) { return; }
    a.getWorldPosition(wa);
    allPoints.forEach((b) => {
      if (!b?.parent || a === b) { return; }
      const idA = Math.min(a.id, b.id);
      const idB = Math.max(a.id, b.id);
      const pairKey = `${idA}:${idB}`;
      if (visitedPairs.has(pairKey)) { return; }
      visitedPairs.add(pairKey);
      b.getWorldPosition(wb);
      if (wa.distanceToSquared(wb) > thresholdSq) { return; }

      const mergedWorld = wa.clone().add(wb).multiplyScalar(0.5);
      const invA = new THREE.Matrix4().copy(a.parent.matrixWorld).invert();
      const invB = new THREE.Matrix4().copy(b.parent.matrixWorld).invert();
      a.position.copy(mergedWorld.clone().applyMatrix4(invA));
      b.position.copy(mergedWorld.clone().applyMatrix4(invB));
      addDifferenceSharedPointLink(a, b);

      touchedPoints.add(a);
      touchedPoints.add(b);
      dirtyMeshes.add(a.parent);
      dirtyMeshes.add(b.parent);
      mergedCount += 1;
    });
  });

  if (mergedCount < 1) { return 0; }
  propagateDifferenceSharedPoints(Array.from(touchedPoints), dirtyMeshes);
  dirtyMeshes.forEach((mesh) => syncDifferenceGeometryFromControlPoints(mesh));
  touchedPoints.forEach((point) => {
    const pos = point.getWorldPosition(new THREE.Vector3());
    showDifferenceMergeNoticeAt(pos, '結合しました');
  });
  return mergedCount;
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
      metalness: 0.08,
      roughness: 0.58,
      flatShading: false,
    });
  if (mat) {
    mat.opacity = 0.5;
    mat.transparent = true;
    mat.side = THREE.DoubleSide;
    mat.depthWrite = false;
    if ('metalness' in mat) { mat.metalness = 0.08; }
    if ('roughness' in mat) { mat.roughness = 0.58; }
    if ('flatShading' in mat) { mat.flatShading = false; }
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
  autoMergeNearbyDifferencePoints([
    ...sourceMesh.children.filter((child) => child?.userData?.differenceControlPoint),
    ...newMesh.children.filter((child) => child?.userData?.differenceControlPoint),
  ]);
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
  if (!differenceSpaceModeActive) {
    updateDifferenceUnifyButtonState();
    applyDifferenceViewMode();
    return false;
  }
  // チューブは tube モード時のみ生成する。
  if (differenceSpaceTransformMode !== 'tube') {
    updateDifferenceUnifyButtonState();
    applyDifferenceViewMode();
    return false;
  }
  if (points.length < 2) {
    updateDifferenceStatus('spaceで平面を1枚以上配置してください。');
    updateDifferenceUnifyButtonState();
    applyDifferenceViewMode();
    return false;
  }
  const cutter = buildDifferenceCutterMesh(points, {
    shapeType: differenceShapeType,
    pathType: differencePathType,
  });
  if (!cutter) {
    updateDifferenceStatus('プレビュー作成に失敗しました。');
    updateDifferenceUnifyButtonState();
    applyDifferenceViewMode();
    return false;
  }
  scene.add(cutter);
  differencePreviewTube = cutter;
  updateDifferenceStatus(`プレビュー表示中: ${differenceShapeType} / ${differencePathType}`);
  updateDifferenceUnifyButtonState();
  applyDifferenceViewMode();
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
    const list = Array.from(new Set(targetObjects.concat(guideRailPickMeshes)));
    return raycaster.intersectObjects(list, true);
  }
  return raycaster.intersectObjects(targetObjects, true);
};

let TargetDiff = [0,0]

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
  const setMeshColorSafe = (obj, colorHex) => {
    if (!obj) { return false; }
    let painted = false;
    const paintMaterial = (mat) => {
      if (mat?.color?.set) {
        mat.color.set(colorHex);
        painted = true;
      }
    };
    if (Array.isArray(obj.material)) {
      obj.material.forEach((mat) => paintMaterial(mat));
    } else {
      paintMaterial(obj.material);
    }
    obj.traverse?.((node) => {
      if (node === obj) { return; }
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => paintMaterial(mat));
      } else {
        paintMaterial(node.material);
      }
    });
    return painted;
  };
  if (copyModeActive && copySelectedObjects.has(mesh)) {
    setCopyObjectVisual(mesh, true);
    return;
  }
  if (styleModeActive && styleSelectedObjects.has(mesh)) {
    setCopyObjectVisual(mesh, true);
    return;
  }
  if (mesh?.userData?.decorationType === 'led_board') {
    if (mesh?.material?.color) {
      mesh.material.color.set(mesh?.userData?.baseColor || 0x1f2228);
    }
    return;
  }
  if (mesh?.userData?.differenceSpacePlane) {
    setDifferencePlaneVisual(mesh, mesh === differenceSelectedPlane);
    return;
  }
  if (mesh?.userData?.differenceControlPoint) {
    if (isDifferenceControlPointSelected(mesh)) {
      setDifferenceControlPointVisual(mesh, 0x7be6ff);
    } else {
      setDifferenceControlPointVisual(mesh);
    }
    return;
  }
  if (mesh?.userData?.steelFrameCopiedObject) {
    setMeshColorSafe(mesh, 0xffd400);
    return;
  }
  if (editObject === 'STEEL_FRAME' && steelFrameMode?.isSelectedPoint && steelFrameMode.isSelectedPoint(mesh)) {
    // グループ所属は水色に戻す
    if (mesh?.material?.color) {
      mesh.material.color.set(0x7be6ff);
    }
    return;
  }
  if (mesh?.userData?.steelFramePoint && mesh?.userData?.steelFrameCopied) {
    setMeshColorSafe(mesh, 0xffd400);
    return;
  }
  if (editObject === 'STEEL_FRAME' && objectEditMode === 'CONSTRUCT') {
    steelFrameMode.restorePointColor(mesh);
    return;
  }
  if (mesh === addPointGridHandle) {
    setMeshColorSafe(mesh, 0xff0000);
    setAddPointGuideGridColor(0xff0000);
    return;
  }
  if (objectEditMode === 'CONSTRUCT' && !pick_vertexs.includes(mesh.id)) {
    setMeshColorSafe(mesh, 0xff0000);
    return;
  }
  setMeshColorSafe(mesh, 0xff0000);
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
        GuideGrid.quaternion.identity();
        GuideGrid.material.color.set(0x88aa88);
        setGuideHoverPin(guideRailHover.point);
      }
    } else {
      guideRailHover = null;
      setGuideHoverPin(null);
    }
    // console.log('hit')
    // console.log(intersects.length)
    const hitObjectRaw = intersects[0].object;
    const hitObject = resolveSelectableHitObject(hitObjectRaw);
    if (choice_object != hitObject){
      if (choice_object !== false){ 
        // 残像防止
        console.log('green')
        resetChoiceObjectColor(choice_object);

        GuideLine.visible = false
      }

      // 物体の取得
      choice_object = hitObject
      if (choice_object?.material?.color) {
        choice_object.material.color.set(0x00ff00)
      }
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
            syncGuideGridFromObject(choice_object)
            GuideGrid.material.color.set(0x88aa88)
          }
        } else {
          if (movePlaneMode !== 'change_angle') {
            syncGuideGridFromObject(choice_object)
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
    GuideGrid.quaternion.identity();
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
        GuideGrid.quaternion.identity();
        GuideGrid.material.color.set(0x88aa88);
        setGuideHoverPin(guideRailHover.point);
      }
    } else {
      guideRailHover = null;
      setGuideHoverPin(null);
    }
    // console.log('hit')
    console.log(intersects.length)
    const hitObjectRaw = intersects[0].object;
    const hitObject = resolveSelectableHitObject(hitObjectRaw);
    if (choice_object != hitObject){
      if (choice_object !== false){ 
        // 残像防止
        console.log('green')
        resetChoiceObjectColor(choice_object);

        GuideLine.visible = false
      }

      // 物体の取得
      choice_object = hitObject
      if (choice_object?.material?.color) {
        choice_object.material.color.set(0x00ff00)
      }
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
            syncGuideGridFromObject(choice_object)
            GuideGrid.material.color.set(0x88aa88)
          }
        } else {
          if (movePlaneMode !== 'change_angle') {
            syncGuideGridFromObject(choice_object)
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
    GuideGrid.quaternion.identity();
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
  // add_point(create) 中は、親元ガイドグリッドの面を優先。
  // guideAddModeActive 中は直前ターゲット(changeAngleGridTarget)を使わず、
  // 常に親元(AddPointGuideGrid)を使って角度の持ち越しを防ぐ。
  if (editObject === 'STEEL_FRAME' && objectEditMode === 'CREATE_NEW' && addPointGridActive && !move_direction_y) {
    const planeRef = guideAddModeActive
      ? (AddPointGuideGrid || null)
      : (changeAngleGridTarget || AddPointGuideGrid || null);
    const normal = new THREE.Vector3(0, 1, 0);
    if (planeRef?.quaternion?.isQuaternion) {
      normal.applyQuaternion(planeRef.quaternion).normalize();
    }
    const anchor = planeRef?.position?.clone?.() || addPointGridHandle?.position?.clone?.() || new THREE.Vector3();
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, anchor);
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
let constructionStrokePending = false;
let constructionStrokeActive = false;
let constructionStrokeDownPos = null;
let constructionStrokeLastPointId = null;
let constructionStrokeStartPoint = null;
let constructionStrokePreviewLine = null;
const MOVE_CLICK_THRESHOLD = 4;
const CONSTRUCTION_STROKE_THRESHOLD = 6;
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

function resetConstructionStrokeState() {
  constructionStrokePending = false;
  constructionStrokeActive = false;
  constructionStrokeDownPos = null;
  constructionStrokeLastPointId = null;
  constructionStrokeStartPoint = null;
  if (constructionStrokePreviewLine) {
    constructionStrokePreviewLine.visible = false;
  }
}

function ensureConstructionStrokePreviewLine() {
  if (constructionStrokePreviewLine) { return; }
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: 0xffdd66,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  constructionStrokePreviewLine = new THREE.LineSegments(geom, mat);
  constructionStrokePreviewLine.visible = false;
  constructionStrokePreviewLine.renderOrder = 3100;
  scene.add(constructionStrokePreviewLine);
}

function updateConstructionStrokePreviewLine() {
  ensureConstructionStrokePreviewLine();
  if (!constructionStrokePreviewLine) { return; }
  const sequences = steelFrameMode?.getSelectedPointSequences
    ? steelFrameMode.getSelectedPointSequences()
    : [steelFrameMode?.getSelectedPointMeshes?.() || []];
  const segmentPoints = [];
  sequences.forEach((seq) => {
    if (!Array.isArray(seq) || seq.length < 2) { return; }
    for (let i = 0; i < seq.length - 1; i += 1) {
      const a = seq[i]?.position;
      const b = seq[i + 1]?.position;
      if (!a || !b) { continue; }
      segmentPoints.push(a.clone(), b.clone());
    }
  });
  if (segmentPoints.length < 2) {
    constructionStrokePreviewLine.visible = false;
    return;
  }
  const nextGeom = new THREE.BufferGeometry().setFromPoints(segmentPoints);
  constructionStrokePreviewLine.geometry?.dispose?.();
  constructionStrokePreviewLine.geometry = nextGeom;
  constructionStrokePreviewLine.visible = true;
}

function pickSteelFramePointAtPointer() {
  if (editObject !== 'STEEL_FRAME' || objectEditMode !== 'CONSTRUCT') { return null; }
  const hits = getIntersectObjects();
  const hit = hits.find((h) => h?.object?.userData?.steelFramePoint) || null;
  return hit?.object || null;
}

function appendConstructionStrokePoint(pointMesh) {
  if (!pointMesh?.userData?.steelFramePoint) { return; }
  if (!steelFrameMode?.isSelectedPoint || !steelFrameMode?.toggleSelectedPoint) { return; }
  if (constructionStrokeLastPointId === pointMesh.id) { return false; }
  constructionStrokeLastPointId = pointMesh.id;
  if (steelFrameMode?.appendSelectedPoint) {
    steelFrameMode.appendSelectedPoint(pointMesh);
    return true;
  }
  if (!steelFrameMode.isSelectedPoint(pointMesh)) {
    steelFrameMode.toggleSelectedPoint(pointMesh);
  }
  return true;
}

function updateConstructionStrokeSelection(clientX, clientY) {
  if (editObject !== 'STEEL_FRAME' || objectEditMode !== 'CONSTRUCT') { return; }
  if (!constructionStrokePending) { return; }
  if (!constructionStrokeDownPos) {
    constructionStrokeDownPos = { x: clientX, y: clientY };
  }
  if (!constructionStrokeActive) {
    const dx = clientX - constructionStrokeDownPos.x;
    const dy = clientY - constructionStrokeDownPos.y;
    if ((dx * dx + dy * dy) < (CONSTRUCTION_STROKE_THRESHOLD * CONSTRUCTION_STROKE_THRESHOLD)) {
      return;
    }
    constructionStrokeActive = true;
    if (constructionStrokeStartPoint?.userData?.steelFramePoint) {
      const selectedBefore = steelFrameMode?.getSelectedPointMeshes?.() || [];
      if (selectedBefore.length > 0) {
        steelFrameMode?.appendSelectionBreak?.();
      }
      appendConstructionStrokePoint(constructionStrokeStartPoint);
      updateConstructionStrokePreviewLine();
    }
  }
  const hitPoint = pickSteelFramePointAtPointer();
  if (!hitPoint) { return; }
  if (appendConstructionStrokePoint(hitPoint)) {
    updateConstructionStrokePreviewLine();
  }
}

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
  syncRotationInputGhostHints();
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
  syncRotationInputGhostHints();
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
        syncGuidePickMeshFromGrid(changeAngleGridTarget, pick);
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
    const pick = new THREE.Mesh(
      geom,
      createRaycastOnlyMaterial()
    );
    pick.position.y = -GIZMO_PICK_OFFSET;
    pick.userData = { ...(pick.userData || {}), isMovePlaneGizmo: true, axis };
    movePlaneGizmoGroup.add(mesh);
    movePlaneGizmoGroup.add(pick);
    movePlaneGizmoMeshes.push(pick);
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
      syncGuidePickMeshFromGrid(changeAngleGridTarget, pick);
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

function isObjectTransformDraggingActive() {
  return dragging === true
    || rotateDragging
    || scaleDragging
    || scaleRotateDragging
    || pointRotateDragging
    || pointRotateMoveDragging
    || differenceControlPointDragActive
    || differenceFaceVertexDragActive;
}

function syncEfficacyForTransformDrag() {
  if (isObjectTransformDraggingActive()) {
    efficacy = false;
  }
}

function handleDrag() {
  syncEfficacyForTransformDrag();
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
  if (scaleRotateDragging) {
    updateScaleRotateDrag();
    return;
  }
  if (scaleDragging) {
    updateScaleDrag();
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

  let changedSteelFramePoints = null;
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
    changedSteelFramePoints = moveDragStartPositions.map((entry) => entry?.mesh).filter(Boolean);
  } else {
    if (!choice_object || !choice_object.position) { return; }
    choice_object.position.set(point.x,point.y,point.z)
    if (choice_object?.userData?.steelFramePoint) {
      changedSteelFramePoints = [choice_object];
    }
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
    syncGuideGridFromObject(choice_object)
    GuideGrid.material.color.set(0x8888aa)
    // GuideGrid.visible = true
  }

  if (editObject === 'RAIL') {
    updateRailPointFromMesh(choice_object);
  }

  drawingObject(changedSteelFramePoints);
}

async function handleMouseUp(mobile = false) {

  if (pause){return};
  if (editObject === 'STEEL_FRAME' && objectEditMode === 'CONSTRUCT' && constructionStrokePending) {
    if (!constructionStrokeActive) {
      const clickPoint = constructionStrokeStartPoint?.userData?.steelFramePoint
        ? constructionStrokeStartPoint
        : pickSteelFramePointAtPointer();
      if (clickPoint?.userData?.steelFramePoint) {
        steelFrameMode?.toggleSelectedPoint?.(clickPoint);
      }
      if (differenceSpaceModeActive) {
        refreshDifferencePreview();
      }
    }
    resetConstructionStrokeState();
    return;
  }
  if (constructionStrokePending || constructionStrokeActive) {
    resetConstructionStrokeState();
  }
  if (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'move' && differenceMoveClickPending) {
    toggleDifferenceMoveSelectionFromPending();
    efficacy = true;
    return;
  }
  if (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'add' && differenceAddClickPending) {
    const shouldCreate = differenceAddShouldCreate;
    clearDifferenceAddPending();
    if (shouldCreate) {
      performDifferenceAddFromPointer();
    }
    efficacy = true;
    return;
  }
  if (differenceControlPointDragActive) {
    const draggedPoints = Array.isArray(differenceControlPointDragPoint)
      ? differenceControlPointDragPoint.map((entry) => entry?.point).filter(Boolean)
      : [];
    autoMergeNearbyDifferencePoints(draggedPoints);
    mergeOverlappedBoundaryControlPoints();
    refreshDifferencePreview();
    refreshDifferenceSelectedEdgeHighlights();
    commitDifferenceHistoryIfNeeded();
    differenceControlPointDragActive = false;
    differenceControlPointDragPoint = null;
    differenceControlPointDragMesh = null;
    differenceControlPointDragAxisWorld.set(0, 0, 0);
    efficacy = true;
    return;
  }
  if (differenceFaceVertexDragActive) {
    const movedPoints = Array.isArray(differenceFaceVertexDragMesh)
      ? differenceFaceVertexDragMesh.flatMap((entry) => entry?.points?.map?.((p) => p.point) || [])
      : [];
    autoMergeNearbyDifferencePoints(movedPoints);
    mergeOverlappedBoundaryControlPoints();
    refreshDifferencePreview();
    refreshDifferenceSelectedEdgeHighlights();
    commitDifferenceHistoryIfNeeded();
    differenceFaceVertexDragActive = false;
    differenceFaceVertexDragMesh = null;
    differenceFaceVertexDragLocalNormal = null;
    efficacy = true;
    return;
  }
  if (pointRotateMoveDragging) {
    if (pointRotateTarget?.userData?.differenceSpacePlane) {
      refreshDifferenceSelectedEdgeHighlights();
      commitDifferenceHistoryIfNeeded();
    }
    pointRotateMoveDragging = false;
    efficacy = true;
    return;
  }
  if (pointRotateDragging) {
    if (pointRotateTarget?.userData?.differenceSpacePlane) {
      refreshDifferenceSelectedEdgeHighlights();
      commitDifferenceHistoryIfNeeded();
    }
    pointRotateDragging = false;
    efficacy = true;
    return;
  }
  if (scaleRotateDragging) {
    scaleRotateDragging = false;
    efficacy = true;
    return;
  }
  if (scaleDragging) {
    const draggedPoints = Array.isArray(scaleDragStartPositions)
      ? scaleDragStartPositions.map((entry) => entry?.mesh).filter((mesh) => mesh?.userData?.differenceControlPoint)
      : [];
    scaleDragging = false;
    scaleDragStartPositions = [];
    if (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'scale') {
      autoMergeNearbyDifferencePoints(draggedPoints);
      mergeOverlappedBoundaryControlPoints();
      refreshDifferencePreview();
      refreshDifferenceSelectedEdgeHighlights();
      commitDifferenceHistoryIfNeeded();
    } else {
      commitMoveHistoryIfNeeded();
    }
    updateScalePointPanelUI({ clearInputs: true });
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
    commitMoveHistoryIfNeeded();
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
    refreshPointEditPanelUI({ clearInputs: true });
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
      if (choice_object?.userData?.decorationType === 'led_board') {
        openLedBoardTextEditor(choice_object);
        shouldToggle = true;
        return;
      }
      
      if (choice_object) {
        console.log('add_group')
        const already = steelFrameMode.isSelectedPoint(choice_object);
        steelFrameMode.toggleSelectedPoint(choice_object);
        refreshPointEditPanelUI({ clearInputs: true });
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
        resetChoiceObjectColor(choice_object);
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
      refreshPointEditPanelUI({ clearInputs: true });
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
  if (!(editObject === 'STEEL_FRAME' && objectEditMode === 'CONSTRUCT')) {
    resetConstructionStrokeState();
  }

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

  if (copyModeActive && editObject === 'STEEL_FRAME' && objectEditMode === 'COPY') {
    await onerun_search_point();
    if (choice_object && isCopySelectableMesh(choice_object)) {
      toggleCopySelection(choice_object);
      updateCopyPanelUI({ clearInputs: false });
    }
    return;
  }

  if (styleModeActive && editObject === 'STEEL_FRAME' && objectEditMode === 'STYLE') {
    await onerun_search_point();
    if (choice_object && isStyleSelectableMesh(choice_object)) {
      toggleStyleSelection(choice_object);
      updateStylePanelUI({ clearInputs: false });
    }
    return;
  }

  if (objectEditMode === 'CREATE_NEW'
    && editObject === 'DIFFERENCE_SPACE'
    && differenceSpaceTransformMode === 'add') {
    differenceAddClickPending = true;
    differenceAddShouldCreate = true;
    differenceAddDownPos = lastPointerClient ? { ...lastPointerClient } : null;
    return;
  }

  if (objectEditMode === ROTATE_MODE) {
    raycaster.setFromCamera(mouse, camera);
    if (rotateTargetObject?.userData?.decorationType) {
      rotateTargetObject = null;
    }
    const decorationPointRotateActive = pointRotateModeActive && pointRotateTarget?.userData?.decorationType;
    if (decorationPointRotateActive) {
      const pointGizmoHit = raycaster.intersectObjects(pointRotateGizmoMeshes, true)[0] || null;
      if (pointGizmoHit) {
        beginPointRotateDrag(pointGizmoHit.object, { gizmoOnly: false });
        return;
      }
    } else {
      const gizmoHit = raycaster.intersectObjects(rotateGizmoMeshes, true)[0] || null;
      if (gizmoHit) {
        beginRotateDrag(gizmoHit.object);
        return;
      }
    }
    const hits = getIntersectObjects();
    const hit = hits.find((h) => {
      const obj = resolveSelectableHitObject(h?.object) || h?.object;
      return Boolean(obj?.userData?.steelFramePoint) || Boolean(obj?.userData?.decorationType);
    });
    if (hit?.object) {
      const obj = resolveSelectableHitObject(hit.object) || hit.object;
      if (obj?.userData?.steelFramePoint) {
        pointRotateModeActive = false;
        pointRotateTarget = null;
        rotateTargetObject = null;
        steelFrameMode.toggleSelectedPoint(obj);
        setRotationPanelMode('rotation');
        updatePointRotateVisuals();
      } else if (obj?.userData?.decorationType) {
        steelFrameMode.clearSelection?.();
        rotateTargetObject = null;
        rotatePanelState.idsKey = '';
        rotatePanelState.angles = { x: 0, y: 0, z: 0 };
        setRotationPanelMode('rotation_decoration');
        pointRotateModeActive = true;
        pointRotateTarget = obj;
        pointRotateCenter.copy(obj.position);
        pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(obj));
        pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
        pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
        pointRotateGizmoYawStart = pointRotateGizmoYaw;
        pointRotateGizmoQuat.copy(getDecorationRotationBaseQuat(obj, { ensure: true })).normalize();
        const panelFromState = obj.userData?.pointRotatePanelAngles;
        obj.userData = {
          ...(obj.userData || {}),
          pointRotatePanelAngles: panelFromState || getRotationPanelAnglesFromTargetQuat(obj, pointRotateBasisQuat),
        };
        syncPointRotatePanelFromTarget();
        updatePointRotateVisuals();
      }
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

  if (scalePointPanelActive
    && ((objectEditMode === 'MOVE_EXISTING' && editObject === 'STEEL_FRAME')
      || (objectEditMode === 'CONSTRUCT' && editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'scale'))) {
    updateScaleGizmo();
    raycaster.setFromCamera(mouse, camera);
    const ringHit = raycaster.intersectObjects(scaleGizmoMeshes, true)[0] || null;
    if (ringHit) {
      beginScaleRotateDrag(ringHit.object);
      return;
    }
    const arrowHit = scaleArrowPick ? (raycaster.intersectObjects([scaleArrowPick], true)[0] || null) : null;
    if (arrowHit) {
      beginScaleDrag();
      return;
    }
    if (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'scale') {
      const hits = getIntersectObjects();
      if (differenceBodySelectModeActive) {
        const bodyHit = hits.find((h) => h?.object?.userData?.differenceSpacePlane) || null;
        const cpHit = hits.find((h) => h?.object?.userData?.differenceControlPoint) || null;
        const mesh = bodyHit?.object?.userData?.differenceSpacePlane
          ? bodyHit.object
          : (cpHit?.object?.userData?.parentDifferenceSpacePlane || cpHit?.object?.parent || null);
        if (mesh?.userData?.differenceSpacePlane) {
          toggleDifferenceBodySelection(mesh);
          clearDifferenceFaceHighlight();
          selectDifferencePlane(mesh);
          updateDifferenceSelectionStatus();
          refreshDifferenceSelectedBodyHighlights();
          updateScalePointPanelUI({ clearInputs: true });
          updateScaleGizmo();
        }
        return;
      }
      const pick = resolveDifferencePickByPriority(hits, { strictEdge: false });
      if (pick.kind === 'point' && pick.controlPointHit?.object) {
        toggleDifferenceControlPointSelection(pick.controlPointHit.object);
        updateDifferenceSelectionStatus();
        selectDifferencePlane(pick.mesh);
        updateScalePointPanelUI({ clearInputs: true });
        updateScaleGizmo();
      } else if (pick.kind === 'edge' && pick.edgeHit?.pointA && pick.edgeHit?.pointB) {
        toggleDifferenceEdgeSelection(pick.mesh, pick.edgeHit.pointA, pick.edgeHit.pointB);
        clearDifferenceFaceHighlight();
        updateDifferenceSelectionStatus();
        selectDifferencePlane(pick.mesh);
        updateScalePointPanelUI({ clearInputs: true });
        updateScaleGizmo();
      } else if (pick.kind === 'face' && pick.localNormal) {
        const selected = toggleDifferenceFaceSelection(pick.mesh, pick.localNormal);
        if (selected) {
          showDifferenceFaceHighlight(pick.faceHit);
        } else {
          clearDifferenceFaceHighlight();
        }
        updateDifferenceSelectionStatus();
        selectDifferencePlane(pick.mesh);
        updateScalePointPanelUI({ clearInputs: true });
        updateScaleGizmo();
      }
      return;
    }
  }

  if (pointRotateModeActive) {
    ensurePointRotateGizmo();
    raycaster.setFromCamera(mouse, camera);
    const gizmoHit = raycaster.intersectObjects(pointRotateGizmoMeshes, true)[0] || null;
    if (gizmoHit && pointRotateTarget) {
      if (gizmoHit.object?.userData?.action === 'rotate_gizmo_y') {
        beginPointRotateDrag(gizmoHit.object, {
          gizmoOnly: true,
          forceAxis: new THREE.Vector3(0, 1, 0),
        });
      } else {
        beginPointRotateDrag(gizmoHit.object, { gizmoOnly: false });
      }
      return;
    }
    const hits = getIntersectObjects();
    if (differenceBodySelectModeActive
      && editObject === 'DIFFERENCE_SPACE'
      && ['move', 'rotation'].includes(differenceSpaceTransformMode)) {
      const bodyHit = hits.find((h) => h?.object?.userData?.differenceSpacePlane) || null;
      const cpHit = hits.find((h) => h?.object?.userData?.differenceControlPoint) || null;
      const mesh = bodyHit?.object?.userData?.differenceSpacePlane
        ? bodyHit.object
        : (cpHit?.object?.userData?.parentDifferenceSpacePlane || cpHit?.object?.parent || null);
      if (mesh?.userData?.differenceSpacePlane) {
        if (differenceSpaceTransformMode === 'move') {
          pointRotateTarget = mesh;
          selectDifferencePlane(mesh);
          pointRotateCenter.copy(mesh.position);
          pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
          pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
          updatePointRotateVisuals();
          differenceMoveClickPending = true;
          differenceMoveShouldToggle = true;
          differenceMoveDownPos = lastPointerClient ? { ...lastPointerClient } : null;
          differenceMoveHitKind = 'body';
          differenceMoveHitBody = mesh;
          differenceMoveHitControlPoint = null;
          differenceMoveHitFace = null;
          differenceMoveHitEdge = null;
          clearDifferenceFaceHighlight();
          return;
        }
        const selectionKey = buildDifferenceTransformSelectionKey({ mesh });
        const sameSelection = pointRotateTarget === mesh && isSameDifferenceTransformSelection(selectionKey);
        toggleDifferenceBodySelection(mesh);
        clearDifferenceFaceHighlight();
        selectDifferencePlane(mesh);
        pointRotateTarget = mesh;
        const selectedPoints = getDifferenceSelectedPointsForTransform();
        if (selectedPoints.length > 0) {
          const center = new THREE.Vector3();
          selectedPoints.forEach((point) => center.add(point.getWorldPosition(new THREE.Vector3())));
          center.multiplyScalar(1 / selectedPoints.length);
          pointRotateCenter.copy(center);
        } else {
          pointRotateCenter.copy(mesh.position);
        }
        if (!sameSelection) {
          pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
          pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
        }
        rememberDifferenceTransformSelection(selectionKey);
        updateDifferenceSelectionStatus();
        refreshDifferenceSelectedBodyHighlights();
        updatePointRotateVisuals();
        showPointRotationGuideLine(pointRotateTarget);
        syncPointRotatePanelFromTarget();
      }
      return;
    }
    if (differenceSpaceTransformMode === 'rotation' && editObject === 'DIFFERENCE_SPACE') {
      const pick = resolveDifferencePickByPriority(hits, { strictEdge: false });
      if (pick.kind === 'point' && pick.controlPointHit?.object) {
        toggleDifferenceControlPointSelection(pick.controlPointHit.object);
        updateDifferenceSelectionStatus();
        const selectedPoints = getDifferenceSelectedPointsForTransform();
        const mesh = pick.mesh;
        if (mesh?.userData?.differenceSpacePlane) {
          const selectionKey = buildDifferenceTransformSelectionKey({ mesh, controlPoint: pick.controlPointHit.object });
          const sameSelection = pointRotateTarget === mesh && isSameDifferenceTransformSelection(selectionKey);
          pointRotateTarget = mesh;
          selectDifferencePlane(mesh);
          if (selectedPoints.length > 0) {
            const center = new THREE.Vector3();
            selectedPoints.forEach((point) => center.add(point.getWorldPosition(new THREE.Vector3())));
            center.multiplyScalar(1 / selectedPoints.length);
            pointRotateCenter.copy(center);
          } else {
            pointRotateCenter.copy(mesh.position);
          }
          if (!sameSelection) {
            pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
            pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
          }
          rememberDifferenceTransformSelection(selectionKey);
          updatePointRotateVisuals();
        }
        return;
      }
      if (pick.kind === 'edge' || pick.kind === 'face') {
        const mesh = pick.mesh;
        const localNormal = pick.localNormal;
        const faceHit = pick.faceHit;
        const selectionKey = buildDifferenceTransformSelectionKey({ mesh, localNormal });
        const sameSelection = pointRotateTarget === mesh && isSameDifferenceTransformSelection(selectionKey);
        let edgeHandled = false;
        if (pick.kind === 'edge' && pick.edgeHit?.pointA && pick.edgeHit?.pointB) {
          const edgeSelected = toggleDifferenceEdgeSelection(mesh, pick.edgeHit.pointA, pick.edgeHit.pointB);
          edgeHandled = true;
          void edgeSelected;
          clearDifferenceFaceHighlight();
        }
        if (!edgeHandled && localNormal) {
          const faceSelected = toggleDifferenceFaceSelection(mesh, localNormal);
          if (faceSelected) {
            showDifferenceFaceHighlight(faceHit);
          } else {
            clearDifferenceFaceHighlight();
          }
        }
        updateDifferenceSelectionStatus();
        const selectedPoints = getDifferenceSelectedPointsForTransform();
        pointRotateTarget = mesh;
        selectDifferencePlane(mesh);
        if (selectedPoints.length > 0) {
          const center = new THREE.Vector3();
          selectedPoints.forEach((point) => center.add(point.getWorldPosition(new THREE.Vector3())));
          center.multiplyScalar(1 / selectedPoints.length);
          pointRotateCenter.copy(center);
        } else if (faceHit?.point) {
          pointRotateCenter.copy(faceHit.point);
        } else {
          pointRotateCenter.copy(mesh.position);
        }
        if (!sameSelection) {
          const faceNormalWorld = getWorldFaceNormalFromHit(faceHit);
          if (faceNormalWorld) {
            pointRotateDirection.copy(faceNormalWorld).normalize();
            pointRotateBasisQuat.copy(buildBasisQuatFromDirection(pointRotateDirection));
          } else {
            pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
            pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
          }
          pointRotateTarget.userData = {
            ...(pointRotateTarget.userData || {}),
            pointRotateDirection: pointRotateDirection.clone(),
            pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
            pointRotateFaceNormalWorld: pointRotateDirection.toArray(),
            pointRotatePanelAngles: pointRotateTarget.userData?.pointRotatePanelAngles || { x: 0, y: 0, z: 0 },
          };
          pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
          pointRotateGizmoYawStart = pointRotateGizmoYaw;
          pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
        }
        rememberDifferenceTransformSelection(selectionKey);
        updatePointRotateVisuals();
        showPointRotationGuideLine(pointRotateTarget);
        syncPointRotatePanelFromTarget();
        return;
      }
    }
    if (differenceSpaceTransformMode === 'move' && editObject === 'DIFFERENCE_SPACE') {
      const pick = resolveDifferencePickByPriority(hits, { strictEdge: false });
      if (pick.kind !== 'none') {
        const mesh = pick.mesh;
        const selectionKey = pick.kind === 'point'
          ? buildDifferenceTransformSelectionKey({ mesh, controlPoint: pick.controlPointHit?.object || null })
          : buildDifferenceTransformSelectionKey({ mesh, localNormal: pick.localNormal || null });
        const sameSelection = pointRotateTarget === mesh && isSameDifferenceTransformSelection(selectionKey);
        pointRotateTarget = mesh;
        selectDifferencePlane(mesh);
        if (pick.kind === 'point' && pick.controlPointHit?.object?.userData?.differenceControlPoint) {
          pick.controlPointHit.object.getWorldPosition(pointRotateCenter);
        } else if (pick.faceHit?.point) {
          pointRotateCenter.copy(pick.faceHit.point);
        } else {
          pointRotateCenter.copy(mesh.position);
        }
        if (!sameSelection) {
          if (pick.kind !== 'point' && pick.faceHit?.object?.userData?.differenceSpacePlane) {
            const faceNormalWorld = getWorldFaceNormalFromHit(pick.faceHit);
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
        }
        rememberDifferenceTransformSelection(selectionKey);
        updatePointRotateVisuals();

        differenceMoveClickPending = true;
        differenceMoveShouldToggle = true;
        differenceMoveDownPos = lastPointerClient ? { ...lastPointerClient } : null;
        differenceMoveHitBody = null;
        if (pick.kind === 'point' && pick.controlPointHit?.object?.userData?.differenceControlPoint) {
          differenceMoveHitKind = 'point';
          differenceMoveHitControlPoint = pick.controlPointHit.object;
          differenceMoveHitFace = null;
          differenceMoveHitEdge = null;
          clearDifferenceFaceHighlight();
          return;
        }
        if (pick.kind === 'edge' && pick.edgeHit?.pointA && pick.edgeHit?.pointB) {
          differenceMoveHitKind = 'edge';
          differenceMoveHitEdge = pick.edgeHit;
          differenceMoveHitFace = null;
          differenceMoveHitControlPoint = null;
          clearDifferenceFaceHighlight();
          return;
        }
        if (pick.kind === 'face' && pick.localNormal) {
          differenceMoveHitKind = 'face';
          differenceMoveHitFace = {
            mesh: pick.mesh,
            localNormal: pick.localNormal.clone(),
            hit: pick.faceHit,
          };
          differenceMoveHitControlPoint = null;
          differenceMoveHitEdge = null;
          showDifferenceFaceHighlight(pick.faceHit);
          return;
        }
      }
    }
    const controlPointHit = hits.find((h) => h?.object?.userData?.differenceControlPoint);
    if (controlPointHit?.object?.userData?.differenceControlPoint && differenceSpaceTransformMode === 'move') {
      const mesh = controlPointHit.object.userData?.parentDifferenceSpacePlane || controlPointHit.object.parent || null;
      if (mesh?.userData?.differenceSpacePlane) {
        const selectionKey = buildDifferenceTransformSelectionKey({ mesh, controlPoint: controlPointHit.object });
        const sameSelection = pointRotateTarget === mesh && isSameDifferenceTransformSelection(selectionKey);
        pointRotateTarget = mesh;
        selectDifferencePlane(mesh);
        pointRotateCenter.copy(mesh.position);
        if (!sameSelection) {
          pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(mesh));
          pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
        }
        rememberDifferenceTransformSelection(selectionKey);
        updatePointRotateVisuals();
      }
      beginDifferenceControlPointDrag(controlPointHit.object);
      return;
    }
    const hit = hits.find((h) => {
      const obj = resolveSelectableHitObject(h?.object);
      return obj?.userData?.steelFramePoint
        || obj?.userData?.differenceSpacePlane
        || obj?.userData?.decorationType;
    });
    if (hit?.object) {
      const resolvedHitObject = resolveSelectableHitObject(hit.object) || hit.object;
      const pickedFaceNormal = getWorldFaceNormalFromHit(hit);
      const pickedLocalNormal = getLocalFaceNormalFromHit(hit);
      const selectionKey = resolvedHitObject?.userData?.differenceSpacePlane
        ? buildDifferenceTransformSelectionKey({ mesh: resolvedHitObject, localNormal: pickedLocalNormal })
        : buildDifferenceTransformSelectionKey({ mesh: resolvedHitObject });
      if (resolvedHitObject?.userData?.differenceSpacePlane && differenceSpaceTransformMode === 'move') {
        pointRotateTarget = resolvedHitObject;
        selectDifferencePlane(pointRotateTarget);
        if (beginDifferenceFaceVertexDrag(hit)) {
          pointRotateCenter.copy(pointRotateTarget.position);
          pointRotateBasisQuat.copy(loadPointRotateBasisFromTarget(pointRotateTarget));
          pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
          updatePointRotateVisuals();
        }
        rememberDifferenceTransformSelection(selectionKey);
        return;
      }
      if (pointRotateTarget && resolvedHitObject === pointRotateTarget) {
        const sameSelection = isSameDifferenceTransformSelection(selectionKey);
        if (!sameSelection && pickedFaceNormal && pointRotateTarget?.userData?.differenceSpacePlane) {
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
        rememberDifferenceTransformSelection(selectionKey);
        beginPointRotateMoveDrag();
        return;
      }
      pointRotateTarget = resolvedHitObject;
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
      if (isDecorationRotationContext(pointRotateTarget)) {
        pointRotateGizmoQuat.copy(getDecorationRotationBaseQuat(pointRotateTarget, { ensure: true })).normalize();
        pointRotateTarget.userData = {
          ...(pointRotateTarget.userData || {}),
          pointRotatePanelAngles: getRotationPanelAnglesFromTargetQuat(pointRotateTarget, pointRotateBasisQuat),
        };
      } else {
        // 再計算時は Y 軸固定で表示姿勢を復元する
        pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
        pointRotateGizmoYawStart = pointRotateGizmoYaw;
        pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
      }
      rememberDifferenceTransformSelection(selectionKey);
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
      setGuideAddGridColor(AddPointGuideGrid, GUIDE_ADD_GRID_COLOR);
      // 追加: 現在位置を複製グリッドとして保存
      const newGrid = new THREE.GridHelper(ADD_POINT_GRID_SIZE, ADD_POINT_GRID_DIVISIONS, GUIDE_ADD_GRID_COLOR, GUIDE_ADD_GRID_COLOR);
      newGrid.name = 'AddPointGuideGridClone';
      newGrid.position.copy(AddPointGuideGrid.position);
      newGrid.quaternion.copy(AddPointGuideGrid.quaternion);
      scene.add(newGrid);
      guideAddGrids.push(newGrid);
  const pick = new THREE.Mesh(
    new THREE.PlaneGeometry(ADD_POINT_GRID_SIZE, ADD_POINT_GRID_SIZE),
    createRaycastOnlyMaterial()
  );
  pick.name = 'GuideAddGridPick';
  syncGuidePickMeshFromGrid(newGrid, pick);
  pick.userData = { ...pick.userData, guideAddGrid: newGrid };
      newGrid.userData = { ...newGrid.userData, pickMesh: pick };
      scene.add(pick);
      guideAddGridPicks.push(pick);
      changeAngleGridTarget = newGrid;
      pushCreateHistory({ type: 'add_guide_grid', grid: newGrid, pick });
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
      if (guidePlacementTemplate === 'led_board') {
        const board = createLedBoardDecoration(basePoint);
        board.userData = {
          ...(board.userData || {}),
          planeRef: basisPlaneRef || null,
        };
        scene.add(board);
        decorationObjects.push(board);
        refreshCreateTargetsForSearch();
        pushCreateHistory({ type: 'add_decoration', items: [board] });
        openLedBoardTextEditor(board);
        return;
      }
      const curve = buildGuideCurve(guidePlacementTemplate, basePoint, basisQuat);
      const name = `GuideRail_${Date.now()}`;
      const line = TSys.createTrack(curve, 0, 0x00ff00, name);
      if (line) {
        line.userData = { ...(line.userData || {}), guideCurve: curve };
        curve.userData = { ...(curve.userData || {}), guideLine: line };
      }
      createGuideRailPickMesh(curve);
      const addedPointItems = [];
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
            addedPointItems.push({
              mesh,
              lineIndex: mesh?.userData?.steelFrameLine ?? 0,
            });
          }
        });
      }
      if (addedPointItems.length > 0) {
        pushCreateHistory({ type: 'add_points', items: addedPointItems });
      }
      if (editObject === 'STEEL_FRAME') {
        targetObjects = steelFrameMode.getCurrentPointMeshes()
          .concat(guideRailPickMeshes)
          .concat(decorationObjects.filter((mesh) => mesh?.parent));
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
        beginDifferenceHistorySession();
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
          refreshDifferenceSelectedEdgeHighlights();
          commitDifferenceHistoryIfNeeded();
          return;
        }
        differenceHistoryStartSnapshot = null;
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
      if (mesh) {
        pushCreateHistory({
          type: 'add_points',
          items: [{ mesh, lineIndex: mesh?.userData?.steelFrameLine ?? 0 }],
        });
      }
      targetObjects = steelFrameMode.getCurrentPointMeshes()
        .concat(guideRailPickMeshes)
        .concat(decorationObjects.filter((mesh) => mesh?.parent));
    } else if (editObject === 'DIFFERENCE_SPACE') {
      beginDifferenceHistorySession();
      const plane = createDifferenceSpacePlane(point);
      addDifferenceControlPoints(plane);
      autoMergeNearbyDifferencePoints(plane.children.filter((child) => child?.userData?.differenceControlPoint));
      selectDifferencePlane(plane);
      targetObjects = differenceSpacePlanes.filter((m) => m?.parent);
      setMeshListOpacity(targetObjects, 1);
      refreshDifferencePreview();
      refreshDifferenceSelectedEdgeHighlights();
      commitDifferenceHistoryIfNeeded();

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
        constructionStrokeStartPoint = choice_object?.userData?.steelFramePoint ? choice_object : null;
        constructionStrokePending = true;
        constructionStrokeActive = false;
        constructionStrokeDownPos = lastPointerClient ? { ...lastPointerClient } : null;
        constructionStrokeLastPointId = null;
        if (constructionStrokePreviewLine) {
          constructionStrokePreviewLine.visible = false;
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
let rotateTargetObject = null;
let rotateTargetStartQuaternion = new THREE.Quaternion();
let rotateAxisLocal = new THREE.Vector3(0, 1, 0);
let rotateDragAction = 'rotate_points';
let rotatePanelAnglesStart = { x: 0, y: 0, z: 0 };
const rotatePlane = new THREE.Plane();
let rotatePanelState = {
  idsKey: '',
  angles: { x: 0, y: 0, z: 0 },
};
let scaleGizmoGroup = null;
const scaleGizmoMeshes = [];
let scaleArrow = null;
let scaleArrowPick = null;
let scaleRotateDragging = false;
let scaleRotateAxis = new THREE.Vector3(0, 1, 0);
let scaleRotateAxisLocal = null;
const scaleRotatePlane = new THREE.Plane();
let scaleRotateStartVector = new THREE.Vector3();
let scaleGizmoQuat = new THREE.Quaternion();
let scaleGizmoQuatStart = new THREE.Quaternion();
let scaleDirection = new THREE.Vector3(0, 0, 1);
let scaleDragging = false;
let scaleDragAxisWorld = new THREE.Vector3(1, 0, 0);
let scaleDragCenter = new THREE.Vector3();
const scaleDragPlane = new THREE.Plane();
let scaleDragStartAxisT = 0;
let scaleDragStartSpan = 1;
let scaleDragCurrentFactor = 1;
let scaleDragStartPositions = [];
let scaleGizmoIdsKey = '';
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
let pointRotateRelativeQuatStart = new THREE.Quaternion();
let pointRotateGizmoQuat = new THREE.Quaternion();
let pointRotateGizmoYaw = 0;
let pointRotateGizmoYawStart = 0;
let pointRotateMoveStartT = 0;
let pointRotateMoveStartCenter = new THREE.Vector3();
let pointRotatePanelAnglesStart = { x: 0, y: 0, z: 0 };
let pointRotateDragAction = 'rotate_points';
let pointRotateTargetStartQuaternion = new THREE.Quaternion();
let pointRotateSelectionDragEntries = null;
let pointRotateSelectionMoveEntries = null;
let pointRotateGizmoOnly = false;
let pointRotateLastSelectionKey = null;
let pointRotateLastSelectionMode = null;
const decorationRotationBaseQuatMap = new WeakMap();
const DEBUG_DECORATION_ROTATE_LOG = false;
const DIFFERENCE_ANGLE_STATE_STORAGE_KEY = 'difference_transform_angle_state_v1';

function buildDifferenceTransformSelectionKey({ mesh = null, controlPoint = null, localNormal = null, edge = null } = {}) {
  if (controlPoint?.userData?.differenceControlPoint) {
    return `point:${controlPoint.id}`;
  }
  if (edge?.mesh && edge?.pointA?.id && edge?.pointB?.id) {
    const ids = [edge.pointA.id, edge.pointB.id].sort((a, b) => a - b);
    return `edge:${edge.mesh.id}:${ids[0]}:${ids[1]}`;
  }
  if (mesh && localNormal) {
    const faceKey = getDifferenceFaceKey(mesh, localNormal);
    return faceKey ? `face:${faceKey}` : `face:${mesh.id}`;
  }
  if (mesh) {
    return `mesh:${mesh.id}`;
  }
  return null;
}

function isSameDifferenceTransformSelection(key) {
  return Boolean(key)
    && pointRotateLastSelectionMode === differenceSpaceTransformMode
    && pointRotateLastSelectionKey === key;
}

function rememberDifferenceTransformSelection(key) {
  pointRotateLastSelectionKey = key || null;
  pointRotateLastSelectionMode = key ? differenceSpaceTransformMode : null;
}

function defaultDifferenceAngleState() {
  return {
    move: {
      basisQuat: [0, 0, 0, 1],
      direction: [0, 0, 1],
      panelAngles: { x: 0, y: 0, z: 0 },
    },
    rotation: {
      basisQuat: [0, 0, 0, 1],
      direction: [0, 0, 1],
      panelAngles: { x: 0, y: 0, z: 0 },
    },
    scale: {
      gizmoQuat: [0, 0, 0, 1],
      direction: [0, 0, 1],
    },
  };
}

function loadDifferenceAngleState() {
  const fallback = defaultDifferenceAngleState();
  try {
    const raw = localStorage.getItem(DIFFERENCE_ANGLE_STATE_STORAGE_KEY);
    if (!raw) { return fallback; }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') { return fallback; }
    return {
      move: { ...fallback.move, ...(parsed.move || {}) },
      rotation: { ...fallback.rotation, ...(parsed.rotation || {}) },
      scale: { ...fallback.scale, ...(parsed.scale || {}) },
    };
  } catch (err) {
    return fallback;
  }
}

let differenceAngleState = loadDifferenceAngleState();

function persistDifferenceAngleState() {
  try {
    localStorage.setItem(DIFFERENCE_ANGLE_STATE_STORAGE_KEY, JSON.stringify(differenceAngleState));
  } catch (err) {
    // ignore storage failures
  }
}

function saveDifferencePointRotateAngleState(mode = differenceSpaceTransformMode) {
  if (!['move', 'rotation'].includes(mode)) { return; }
  const panelAngles = pointRotateTarget?.userData?.pointRotatePanelAngles || { x: 0, y: 0, z: 0 };
  differenceAngleState[mode] = {
    basisQuat: pointRotateBasisQuat.toArray(),
    direction: pointRotateDirection.toArray(),
    panelAngles: { x: Number(panelAngles.x) || 0, y: Number(panelAngles.y) || 0, z: Number(panelAngles.z) || 0 },
  };
  persistDifferenceAngleState();
}

function applyDifferencePointRotateAngleState(mode = differenceSpaceTransformMode, { attachToTarget = false } = {}) {
  if (!['move', 'rotation'].includes(mode)) { return; }
  const saved = differenceAngleState?.[mode];
  if (!saved) { return; }
  if (Array.isArray(saved.basisQuat) && saved.basisQuat.length === 4) {
    pointRotateBasisQuat.fromArray(saved.basisQuat).normalize();
  }
  if (Array.isArray(saved.direction) && saved.direction.length === 3) {
    pointRotateDirection.fromArray(saved.direction).normalize();
  } else {
    pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
  }
  pointRotateGizmoYaw = Math.atan2(pointRotateDirection.x, pointRotateDirection.z);
  pointRotateGizmoYawStart = pointRotateGizmoYaw;
  pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
  if (attachToTarget && pointRotateTarget) {
    pointRotateTarget.userData = {
      ...(pointRotateTarget.userData || {}),
      pointRotateDirection: pointRotateDirection.clone(),
      pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
      pointRotatePanelAngles: { ...(saved.panelAngles || { x: 0, y: 0, z: 0 }) },
    };
  }
  const panel = saved.panelAngles || { x: 0, y: 0, z: 0 };
  if (rotationInputX) { rotationInputX.value = String(Number(panel.x || 0).toFixed(1)); }
  if (rotationInputY) { rotationInputY.value = String(Number(panel.y || 0).toFixed(1)); }
  if (rotationInputZ) { rotationInputZ.value = String(Number(panel.z || 0).toFixed(1)); }
}

function saveDifferenceScaleAngleState() {
  differenceAngleState.scale = {
    gizmoQuat: scaleGizmoQuat.toArray(),
    direction: scaleDirection.toArray(),
  };
  persistDifferenceAngleState();
}

function applyDifferenceScaleAngleState() {
  const saved = differenceAngleState?.scale;
  if (!saved) { return; }
  if (Array.isArray(saved.gizmoQuat) && saved.gizmoQuat.length === 4) {
    scaleGizmoQuat.fromArray(saved.gizmoQuat).normalize();
  }
  if (Array.isArray(saved.direction) && saved.direction.length === 3) {
    scaleDirection.fromArray(saved.direction).normalize();
  } else {
    scaleDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(scaleGizmoQuat)).normalize();
  }
}

function ensurePointRotateGizmo() {
  if (pointRotateGizmoGroup) { return; }
  pointRotateGizmoGroup = new THREE.Group();
  pointRotateGizmoGroup.name = 'PointRotateGizmo';
  const ringRadius = 1.0;
  const ringTube = 0.03;
  const geom = new THREE.TorusGeometry(ringRadius, ringTube, 12, 64);
  const makeRing = (color, axis, euler, action = 'rotate_gizmo', radiusScale = 1.0) => {
    const ringGeom = radiusScale === 1.0
      ? geom
      : new THREE.TorusGeometry(ringRadius * radiusScale, ringTube, 12, 64);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(ringGeom, mat);
    const pick = new THREE.Mesh(
      ringGeom,
      createRaycastOnlyMaterial()
    );
    mesh.rotation.set(euler.x, euler.y, euler.z);
    mesh.userData = { ...(mesh.userData || {}), isPointRotateGizmo: true, axis, action };
    pick.rotation.set(euler.x, euler.y, euler.z);
    pick.position.y = -GIZMO_PICK_OFFSET;
    pick.userData = { ...(pick.userData || {}), isPointRotateGizmo: true, axis, action };
    pointRotateGizmoGroup.add(mesh);
    pointRotateGizmoGroup.add(pick);
    pointRotateGizmoMeshes.push(pick);
  };
  // 緑: Yリング（点を回転）
  makeRing(0x5cff88, new THREE.Vector3(0, 1, 0), new THREE.Euler(Math.PI / 2, 0, 0), 'rotate_points', 1.0);
  // 黄: 2本目Yリング（Difference rotation のみ使用）
  makeRing(0xffc857, new THREE.Vector3(0, 1, 0), new THREE.Euler(Math.PI / 2, 0, 0), 'rotate_gizmo_y', 1.24);
  // 赤: Xリング（点を回転）
  makeRing(0xe63946, new THREE.Vector3(1, 0, 0), new THREE.Euler(0, Math.PI / 2, 0), 'rotate_points', 1.0);
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
  const isMovePointRotate = editObject === 'STEEL_FRAME'
    && objectEditMode === 'MOVE_EXISTING'
    && pointRotateModeActive
    && Boolean(pointRotateTarget?.userData?.steelFramePoint);
  const rawLen = Number(pointRotateTarget.userData?.pointRotateLen);
  const safeLen = Number.isFinite(rawLen) ? rawLen : 0;
  if (rotationInputX) {
    rotationInputX.value = String(Number(state.x ?? 0).toFixed(1));
    rotationInputX.placeholder = String(state.x ?? 0);
  }
  if (rotationInputY) {
    rotationInputY.value = String(Number(state.y ?? 0).toFixed(1));
    rotationInputY.placeholder = String(state.y ?? 0);
  }
  if (rotationInputZ) {
    if (isMovePointRotate) {
      rotationInputZ.value = String(Number(safeLen).toFixed(3));
      rotationInputZ.placeholder = String(Number(safeLen).toFixed(3));
    } else {
      rotationInputZ.value = String(Number(state.z ?? 0).toFixed(1));
      rotationInputZ.placeholder = String(state.z ?? 0);
    }
  }
  syncRotationInputGhostHints();
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

function isDecorationRotationContext(target = pointRotateTarget) {
  return editObject === 'STEEL_FRAME'
    && (objectEditMode === 'MOVE_EXISTING' || objectEditMode === ROTATE_MODE)
    && Boolean(target?.userData?.decorationType);
}

function getDecorationRotationBaseQuat(target, { ensure = true } = {}) {
  const base = new THREE.Quaternion();
  if (!target) { return base; }
  const cached = decorationRotationBaseQuatMap.get(target);
  if (cached?.isQuaternion) {
    base.copy(cached).normalize();
    return base;
  }
  const saved = target?.userData?.pointRotateInitialBasisQuat;
  if (Array.isArray(saved) && saved.length === 4) {
    const arr = saved.map((v) => Number(v));
    if (arr.every((v) => Number.isFinite(v))) {
      base.fromArray(arr).normalize();
      decorationRotationBaseQuatMap.set(target, base.clone());
      return base;
    }
  }
  if (target?.quaternion?.isQuaternion) {
    base.copy(target.quaternion).normalize();
  } else {
    base.identity();
  }
  debugDecorationRotationLog('capture-base', {
    id: target?.id,
    baseQuat: base.toArray(),
    ensure,
  });
  if (ensure) {
    target.userData = {
      ...(target.userData || {}),
      pointRotateInitialBasisQuat: base.toArray(),
    };
  }
  decorationRotationBaseQuatMap.set(target, base.clone());
  return base;
}

function debugDecorationRotationLog(tag, payload = {}) {
  if (!DEBUG_DECORATION_ROTATE_LOG) { return; }
  console.log(`[decoration-rotate] ${tag}`, payload);
}

function loadPointRotateBasisFromTarget(target) {
  const q = new THREE.Quaternion();
  if (isDecorationRotationContext(target) && target?.quaternion?.isQuaternion) {
    q.copy(target.quaternion).normalize();
    const base = getDecorationRotationBaseQuat(target, { ensure: true });
    target.userData = {
      ...(target.userData || {}),
      pointRotateInitialBasisQuat: base.toArray(),
      pointRotateBasisQuat: q.toArray(),
    };
    return q;
  }
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
  const showSecondaryY = (
    editObject === 'DIFFERENCE_SPACE'
    && objectEditMode === 'CONSTRUCT'
    && differenceSpaceTransformMode === 'rotation'
  ) || (
    editObject === 'STEEL_FRAME'
    && (objectEditMode === 'MOVE_EXISTING' || objectEditMode === ROTATE_MODE)
    && pointRotateModeActive
    && Boolean(pointRotateTarget?.userData?.decorationType)
  );
  pointRotateGizmoGroup.children.forEach((child) => {
    if (!child?.userData?.isPointRotateGizmo) { return; }
    if (child.userData.action === 'rotate_gizmo_y') {
      child.visible = showSecondaryY;
    } else {
      child.visible = true;
    }
  });
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
  const worldToLocal = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const facePointLocal = hit?.point?.clone?.()?.applyMatrix4?.(worldToLocal) || null;
  clearDifferenceFaceHighlight(false);
  const plane = createDifferenceFaceHighlightPlane(mesh, localNormal, 0xff8a00, 0.84, 2500, facePointLocal);
  if (!plane) { return; }
  scene.add(plane);
  differenceFaceHighlight = plane;
  highlightDifferenceFaceControlPoints(mesh, localNormal, facePointLocal);
}

function beginDifferenceFaceVertexDrag(hit, selectedFaces = null) {
  const mesh = hit?.object;
  const localNormal = getLocalFaceNormalFromHit(hit);
  const worldNormal = getWorldFaceNormalFromHit(hit);
  if (!mesh?.userData?.differenceSpacePlane || !localNormal || !worldNormal) { return false; }
  beginDifferenceHistorySession();
  rebuildDifferenceEdgeOverlapConstraints();
  const gizmoAxisWorld = pointRotateDirection?.clone?.().normalize?.() || new THREE.Vector3();
  const dragAxisWorld = gizmoAxisWorld.lengthSq() > 1e-8 ? gizmoAxisWorld : worldNormal.clone().normalize();
  if (dragAxisWorld.lengthSq() < 1e-8) { return false; }
  const axis = Math.abs(localNormal.x) > 0.9
    ? 'x'
    : (Math.abs(localNormal.y) > 0.9 ? 'y' : 'z');
  differenceFaceVertexDragActive = true;
  differenceFaceVertexDragMesh = mesh;
  differenceFaceVertexDragLocalNormal = localNormal.clone();
  differenceFaceVertexDragAxis = axis;
  const primaryOrigin = hit?.point?.clone?.() || mesh.position.clone();
  differenceFaceVertexDragStartPos.copy(primaryOrigin);
  differenceFaceVertexDragStartT = getAxisParamFromPointer(primaryOrigin, dragAxisWorld);
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
    const meshDiag = (() => {
      m.geometry?.computeBoundingBox?.();
      return m.geometry?.boundingBox?.getSize?.(new THREE.Vector3())?.length?.() || 1;
    })();
    const triTol = Math.max(0.08, meshDiag * 0.06);
    const triFacePoints = getDifferenceFaceControlPointsFromTriangles(m, n, localHit, triTol);
    if (triFacePoints.length > 0) {
      const merged = new Set([...(facePoints || []), ...triFacePoints]);
      facePoints = Array.from(merged);
    }
    if (localHit && Array.isArray(facePoints) && facePoints.length > 0) {
      const nn = n.clone().normalize();
      const centerD = facePoints.reduce((acc, p) => acc + nn.dot(p.position), 0) / facePoints.length;
      const planeTol = Math.max(0.06, meshDiag * 0.035);
      const expandedByPlane = m.children.filter((child) => {
        if (!child?.userData?.differenceControlPoint) { return false; }
        const d = nn.dot(child.position);
        return Math.abs(d - centerD) <= planeTol;
      });
      if (expandedByPlane.length > facePoints.length) {
        facePoints = expandedByPlane;
      }
    }
    if (!Array.isArray(facePoints) || facePoints.length < 3) {
      facePoints = getDifferenceFaceControlPoints(m, n, null);
    }
    if (!Array.isArray(facePoints) || facePoints.length < 3) { return null; }
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
      axisDir: dragAxisWorld.clone(),
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
  beginDifferenceHistorySession();
  rebuildDifferenceEdgeOverlapConstraints();
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
  const deltaWorldClamped = THREE.MathUtils.clamp(deltaWorld, -differenceMoveRangeFromStart, differenceMoveRangeFromStart);
  const dirtyMeshes = new Set();
  differenceControlPointDragPoint.forEach((entry) => {
    const m = entry.mesh;
    const worldToLocalQuat = m.quaternion.clone().invert();
    const localAxis = entry.axisWorld.clone().applyQuaternion(worldToLocalQuat).normalize();
    if (localAxis.lengthSq() < 1e-8) { return; }
    const next = entry.startLocalPos.clone().add(localAxis.multiplyScalar(deltaWorldClamped));
    entry.point.position.copy(next);
    dirtyMeshes.add(m);
  });
  propagateDifferenceSharedPoints(
    differenceControlPointDragPoint.map((entry) => entry.point),
    dirtyMeshes,
  );
  for (let i = 0; i < 3; i += 1) {
    const moved = applyDifferenceEdgeOverlapConstraints(dirtyMeshes);
    if (moved < 1) { break; }
  }
  dirtyMeshes.forEach((m) => syncDifferenceGeometryFromControlPoints(m));
  refreshDifferenceSelectedEdgeHighlights();
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
  const deltaClamped = THREE.MathUtils.clamp(delta, -differenceMoveRangeFromStart, differenceMoveRangeFromStart);
  const dirtyMeshes = new Set();
  const movedPoints = [];
  differenceFaceVertexDragMesh.forEach((entry) => {
    const worldToLocalQuat = entry.mesh.quaternion.clone().invert();
    const localAxis = entry.axisDir.clone().applyQuaternion(worldToLocalQuat).normalize();
    if (localAxis.lengthSq() < 1e-8) { return; }
    entry.points.forEach((p) => {
      const next = p.startPos.clone().add(localAxis.clone().multiplyScalar(deltaClamped));
      p.point.position.copy(next);
      movedPoints.push(p.point);
    });
    if (pointRotateTarget === entry.mesh) {
      pointRotateCenter.copy(entry.faceOrigin.clone().add(entry.axisDir.clone().multiplyScalar(deltaClamped)));
    }
    dirtyMeshes.add(entry.mesh);
  });
  propagateDifferenceSharedPoints(movedPoints, dirtyMeshes);
  for (let i = 0; i < 3; i += 1) {
    const moved = applyDifferenceEdgeOverlapConstraints(dirtyMeshes);
    if (moved < 1) { break; }
  }
  dirtyMeshes.forEach((m) => {
    syncDifferenceGeometryFromControlPoints(m);
    updateDifferenceControlPointMarkerTransform(m);
  });
  refreshDifferenceSelectedFaceHighlights();
  refreshDifferenceSelectedEdgeHighlights();
  refreshDifferencePreview();
  showDifferenceFaceHighlight({
    object: mesh,
    face: { normal: localNormal.clone() },
  });
}

function beginPointRotateDrag(axisMesh, { gizmoOnly = false, forceAxis = null } = {}) {
  pointRotateGizmoOnly = Boolean(gizmoOnly);
  pointRotateDragAction = axisMesh?.userData?.action || 'rotate_points';
  if (pointRotateTarget?.quaternion?.isQuaternion) {
    pointRotateTargetStartQuaternion.copy(pointRotateTarget.quaternion);
  } else {
    pointRotateTargetStartQuaternion.identity();
  }
  if (!pointRotateGizmoOnly && pointRotateTarget?.userData?.differenceSpacePlane) {
    beginDifferenceHistorySession();
  }
  pointRotateSelectionDragEntries = null;
  if (!pointRotateGizmoOnly && editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'rotation') {
    const selectedPoints = getDifferenceSelectedPointsForTransform();
    if (selectedPoints.length > 0) {
      const selectionCenter = new THREE.Vector3();
      selectedPoints.forEach((point) => selectionCenter.add(point.getWorldPosition(new THREE.Vector3())));
      selectionCenter.multiplyScalar(1 / selectedPoints.length);
      pointRotateCenter.copy(selectionCenter);
      pointRotateSelectionDragEntries = selectedPoints.map((point) => ({
        point,
        parent: point.parent,
        startWorldPos: point.getWorldPosition(new THREE.Vector3()),
      }));
      rebuildDifferenceEdgeOverlapConstraints();
    }
  }
  pointRotateAxisLocal = forceAxis?.clone?.().normalize?.()
    || axisMesh?.userData?.axis?.clone?.().normalize?.()
    || new THREE.Vector3(0, 1, 0);
  if (isDecorationRotationContext(pointRotateTarget) && pointRotateDragAction === 'rotate_gizmo_y') {
    pointRotateAxisLocal = new THREE.Vector3(0, 0, 1);
  }
  if (pointRotateAxisLocal.y === 1 && !isDecorationRotationContext(pointRotateTarget)) {
    pointRotateAxis.copy(new THREE.Vector3(0, 1, 0));
  } else if (isDecorationRotationContext(pointRotateTarget)) {
    const baseQuat = getDecorationRotationBaseQuat(pointRotateTarget, { ensure: true });
    pointRotateAxis.copy(pointRotateAxisLocal.clone().applyQuaternion(baseQuat).normalize());
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
  if (isDecorationRotationContext(pointRotateTarget)) {
    const baseQuat = getDecorationRotationBaseQuat(pointRotateTarget, { ensure: true });
    pointRotateRelativeQuatStart.copy(
      baseQuat.clone().invert().multiply(pointRotateBasisQuat.clone()).normalize()
    );
  } else {
    pointRotateRelativeQuatStart.identity();
  }
  pointRotatePanelAnglesStart = pointRotateTarget?.userData?.pointRotatePanelAngles
    ? { ...pointRotateTarget.userData.pointRotatePanelAngles }
    : { x: 0, y: 0, z: 0 };
  if (pointRotateAxisLocal && pointRotateAxisLocal.y === 1) {
    pointRotateGizmoYawStart = pointRotateGizmoYaw;
  }
  if (isDecorationRotationContext(pointRotateTarget)) {
    debugDecorationRotationLog('begin-gizmo', {
      id: pointRotateTarget?.id,
      action: pointRotateDragAction,
      gizmoOnly: pointRotateGizmoOnly,
      axisLocal: pointRotateAxisLocal ? pointRotateAxisLocal.toArray() : null,
      axisWorld: pointRotateAxis ? pointRotateAxis.toArray() : null,
      panelStart: { ...pointRotatePanelAnglesStart },
    });
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
  pointRotateSelectionMoveEntries = null;
  if (pointRotateTarget?.userData?.differenceSpacePlane) {
    beginDifferenceHistorySession();
    rebuildDifferenceEdgeOverlapConstraints();
    if (differenceSpaceTransformMode === 'rotation') {
      const selectedPoints = Array.from(differenceSelectedControlPoints || [])
        .filter((point) => point?.userData?.differenceControlPoint && point?.parent);
      if (selectedPoints.length > 0) {
        const center = new THREE.Vector3();
        selectedPoints.forEach((point) => center.add(point.getWorldPosition(new THREE.Vector3())));
        center.multiplyScalar(1 / selectedPoints.length);
        pointRotateCenter.copy(center);
        pointRotateSelectionMoveEntries = selectedPoints.map((point) => ({
          point,
          parent: point.parent,
          startWorldPos: point.getWorldPosition(new THREE.Vector3()),
        }));
      }
    }
  }
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
  const isDecorationRotateContext = isDecorationRotationContext(pointRotateTarget);
  const deltaQuat = new THREE.Quaternion().setFromAxisAngle(pointRotateAxis, angle);
  if (!isDecorationRotateContext) {
    pointRotateBasisQuat.copy(deltaQuat.multiply(pointRotateBasisQuatStart)).normalize();
  }
  if (pointRotateTarget) {
    const isMovePointRotate = editObject === 'STEEL_FRAME'
      && objectEditMode === 'MOVE_EXISTING'
      && Boolean(pointRotateTarget?.userData?.steelFramePoint);
    const currentLen = (() => {
      const raw = Number(pointRotateTarget?.userData?.pointRotateLen);
      return Number.isFinite(raw) ? raw : 0;
    })();
    let panelAngles = { ...pointRotatePanelAnglesStart };
    if (isDecorationRotateContext && !isMovePointRotate) {
      if (pointRotateAxisLocal?.x === 1) {
        panelAngles.x = pointRotatePanelAnglesStart.x + angleDeg;
      } else if (pointRotateAxisLocal?.y === 1) {
        panelAngles.y = pointRotatePanelAnglesStart.y + angleDeg;
      } else if (pointRotateAxisLocal?.z === 1) {
        panelAngles.z = pointRotatePanelAnglesStart.z + angleDeg;
      }
      pointRotateBasisQuat.copy(buildDecorationQuatFromPanelAngles(pointRotateTarget, panelAngles));
      debugDecorationRotationLog('drag', {
        id: pointRotateTarget?.id,
        axisLocal: pointRotateAxisLocal ? pointRotateAxisLocal.toArray() : null,
        angleDeg,
        panelAngles: { ...panelAngles },
      });
    } else if (pointRotateAxisLocal?.x === 1) {
      panelAngles.x = pointRotatePanelAnglesStart.x + angleDeg;
    } else if (pointRotateAxisLocal?.y === 1) {
      if (pointRotateDragAction === 'rotate_gizmo_y') {
        panelAngles.z = pointRotatePanelAnglesStart.z + angleDeg;
      } else {
        panelAngles.y = pointRotatePanelAnglesStart.y + angleDeg;
      }
    } else if (pointRotateAxisLocal?.z === 1) {
      panelAngles.z = pointRotatePanelAnglesStart.z + angleDeg;
    }
    pointRotateDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(pointRotateBasisQuat)).normalize();
    if (pointRotateAxisLocal && pointRotateAxisLocal.y === 1 && !isDecorationRotateContext) {
      pointRotateGizmoYaw = pointRotateGizmoYawStart + angle;
      pointRotateGizmoQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pointRotateGizmoYaw);
    }
    if (isDecorationRotateContext) {
      pointRotateGizmoQuat.copy(getDecorationRotationBaseQuat(pointRotateTarget, { ensure: true })).normalize();
    }

    pointRotateTarget.userData = {
      ...(pointRotateTarget.userData || {}),
      pointRotateDirection: pointRotateDirection.clone(),
      pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
      pointRotateLen: currentLen,
      pointRotatePanelAngles: panelAngles,
    };
    if (!pointRotateGizmoOnly
      && pointRotateTarget?.userData?.decorationType
      && pointRotateTarget?.quaternion?.isQuaternion) {
      pointRotateTarget.quaternion.copy(pointRotateBasisQuat).normalize();
      pointRotateTarget.updateMatrixWorld(true);
    }
    if (editObject === 'DIFFERENCE_SPACE' && ['move', 'rotation'].includes(differenceSpaceTransformMode)) {
      saveDifferencePointRotateAngleState(differenceSpaceTransformMode);
    }
    if (rotationInputX) {
      const xText = String(panelAngles.x.toFixed(1));
      rotationInputX.value = xText;
      rotationInputX.placeholder = xText;
    }
    if (rotationInputY) {
      const yText = String(panelAngles.y.toFixed(1));
      rotationInputY.value = yText;
      rotationInputY.placeholder = yText;
    }
    if (rotationInputZ) {
      if (isMovePointRotate) {
        const zLenText = String(Number(currentLen).toFixed(3));
        rotationInputZ.value = zLenText;
        rotationInputZ.placeholder = zLenText;
      } else {
        const zText = String(panelAngles.z.toFixed(1));
        rotationInputZ.value = zText;
        rotationInputZ.placeholder = zText;
      }
    }
    syncRotationInputGhostHints();
    showPointRotationGuideLine(pointRotateTarget);
    if (!pointRotateGizmoOnly
      && editObject === 'DIFFERENCE_SPACE'
      && differenceSpaceTransformMode === 'rotation'
      && Array.isArray(pointRotateSelectionDragEntries)
      && pointRotateSelectionDragEntries.length > 0) {
      const rotationQuat = new THREE.Quaternion().setFromAxisAngle(pointRotateAxis, angle);
      const dirtyMeshes = new Set();
      const movedPoints = [];
      pointRotateSelectionDragEntries.forEach((entry) => {
        if (!entry?.point || !entry?.parent) { return; }
        const rotatedOffset = entry.startWorldPos.clone().sub(pointRotateCenter).applyQuaternion(rotationQuat);
        const nextWorldPos = pointRotateCenter.clone().add(rotatedOffset);
        const nextLocalPos = entry.parent.worldToLocal(nextWorldPos.clone());
        entry.point.position.copy(nextLocalPos);
        const parentMesh = entry.point.userData?.parentDifferenceSpacePlane || entry.point.parent;
        if (parentMesh?.userData?.differenceSpacePlane) {
          dirtyMeshes.add(parentMesh);
          movedPoints.push(entry.point);
        }
      });
      if (movedPoints.length > 0) {
        propagateDifferenceSharedPoints(movedPoints, dirtyMeshes);
      }
      for (let i = 0; i < 3; i += 1) {
        const moved = applyDifferenceEdgeOverlapConstraints(dirtyMeshes);
        if (moved < 1) { break; }
      }
      dirtyMeshes.forEach((mesh) => syncDifferenceGeometryFromControlPoints(mesh));
      refreshDifferenceSelectedEdgeHighlights();
      refreshDifferencePreview();
    } else if (!pointRotateGizmoOnly && pointRotateTarget?.userData?.differenceSpacePlane) {
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
  if (editObject === 'DIFFERENCE_SPACE'
    && differenceSpaceTransformMode === 'rotation'
    && Array.isArray(pointRotateSelectionMoveEntries)
    && pointRotateSelectionMoveEntries.length > 0) {
    const dirtyMeshes = new Set();
    const movedPoints = [];
    pointRotateSelectionMoveEntries.forEach((entry) => {
      if (!entry?.point || !entry?.parent) { return; }
      const nextWorldPos = entry.startWorldPos.clone().add(pointRotateDirection.clone().multiplyScalar(delta));
      const nextLocalPos = entry.parent.worldToLocal(nextWorldPos.clone());
      entry.point.position.copy(nextLocalPos);
      const parentMesh = entry.point.userData?.parentDifferenceSpacePlane || entry.point.parent;
      if (parentMesh?.userData?.differenceSpacePlane) {
        dirtyMeshes.add(parentMesh);
        movedPoints.push(entry.point);
      }
    });
    if (movedPoints.length > 0) {
      propagateDifferenceSharedPoints(movedPoints, dirtyMeshes);
    }
    for (let i = 0; i < 3; i += 1) {
      const moved = applyDifferenceEdgeOverlapConstraints(dirtyMeshes);
      if (moved < 1) { break; }
    }
    dirtyMeshes.forEach((mesh) => syncDifferenceGeometryFromControlPoints(mesh));
    refreshDifferenceSelectedEdgeHighlights();
    refreshDifferencePreview();
    updatePointRotateVisuals();
    return;
  }
  pointRotateTarget.position.copy(nextCenter);
  pointRotateTarget.userData = {
    ...(pointRotateTarget.userData || {}),
    pointRotateDirection: pointRotateDirection.clone(),
    pointRotateBasisQuat: pointRotateBasisQuat.toArray(),
  };
  showPointRotationGuideLine(pointRotateTarget);
  if (pointRotateTarget?.userData?.steelFramePoint) {
    drawingObject([pointRotateTarget]);
  }
  if (pointRotateTarget?.userData?.differenceSpacePlane) {
    const dirtyMeshes = new Set();
    for (let i = 0; i < 3; i += 1) {
      const moved = applyDifferenceEdgeOverlapConstraints(dirtyMeshes);
      if (moved < 1) { break; }
    }
    dirtyMeshes.forEach((m) => syncDifferenceGeometryFromControlPoints(m));
    refreshDifferenceSelectedEdgeHighlights();
    refreshDifferencePreview();
  }
  updatePointRotateVisuals();
}

function clearPointRotateState() {
  pointRotateDragging = false;
  pointRotateMoveDragging = false;
  pointRotateSelectionDragEntries = null;
  pointRotateSelectionMoveEntries = null;
  pointRotateGizmoOnly = false;
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
  moveHistoryStart = null;
  differenceHistoryStartSnapshot = null;
  pointRotateTarget = null;
  pointRotateAxisLocal = null;
  pointRotateBasisQuat.identity();
  pointRotateBasisQuatStart.identity();
  pointRotateRelativeQuatStart.identity();
  pointRotateGizmoQuat.identity();
  pointRotateGizmoYaw = 0;
  pointRotateGizmoYawStart = 0;
  pointRotateLastSelectionKey = null;
  pointRotateLastSelectionMode = null;
  if (pointRotateGizmoGroup) {
    pointRotateGizmoGroup.visible = false;
  }
  clearDifferenceFaceHighlight();
  clearDifferenceFaceSelection();
  clearDifferenceEdgeSelection();
  clearDifferenceBodySelection();
  clearDifferenceIntersectionVisuals();
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

  const makeRing = (color, axis, euler, radiusScale = 1.0, action = 'rotate_points') => {
    const ringGeom = radiusScale === 1.0
      ? geom
      : new THREE.TorusGeometry(ringRadius * radiusScale, ringTube, 12, 64);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(ringGeom, mat);
    const pick = new THREE.Mesh(
      ringGeom,
      createRaycastOnlyMaterial()
    );
    mesh.rotation.set(euler.x, euler.y, euler.z);
    pick.rotation.set(euler.x, euler.y, euler.z);
    pick.position.y = -GIZMO_PICK_OFFSET;
    pick.userData = { ...(pick.userData || {}), isRotateGizmo: true, axis, action };
    rotateGizmoGroup.add(mesh);
    rotateGizmoGroup.add(pick);
    rotateGizmoMeshes.push(pick);
  };

  makeRing(0xff5c5c, new THREE.Vector3(1, 0, 0), new THREE.Euler(0, Math.PI / 2, 0), 1.0, 'rotate_points');
  makeRing(0x5cff88, new THREE.Vector3(0, 1, 0), new THREE.Euler(Math.PI / 2, 0, 0), 1.0, 'rotate_points');
  makeRing(0xffc857, new THREE.Vector3(0, 1, 0), new THREE.Euler(Math.PI / 2, 0, 0), 1.24, 'rotate_gizmo_y');
  makeRing(0x5cc0ff, new THREE.Vector3(0, 0, 1), new THREE.Euler(0, 0, 0), 1.0, 'rotate_points');

  rotateGizmoGroup.visible = false;
  scene.add(rotateGizmoGroup);
}

function getRotateSelectionMeshes() {
  if (!steelFrameMode?.getSelectedPointMeshes) { return []; }
  return steelFrameMode.getSelectedPointMeshes();
}

function getRotationPanelAnglesFromQuaternion(quat) {
  const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
  return {
    x: THREE.MathUtils.radToDeg(euler.x),
    y: THREE.MathUtils.radToDeg(euler.y),
    z: THREE.MathUtils.radToDeg(euler.z),
  };
}

function getRotationPanelAnglesFromTargetQuat(target, quat) {
  if (isDecorationRotationContext(target)) {
    const base = getDecorationRotationBaseQuat(target, { ensure: true });
    const rel = base.clone().invert().multiply(quat.clone()).normalize();
    return getRotationPanelAnglesFromQuaternion(rel);
  }
  return getRotationPanelAnglesFromQuaternion(quat);
}

function buildDecorationQuatFromPanelAngles(target, panelAngles = { x: 0, y: 0, z: 0 }) {
  const baseQuat = getDecorationRotationBaseQuat(target, { ensure: true });
  const degToRad = Math.PI / 180;
  const xDeg = Number(panelAngles?.x) || 0;
  const yDeg = Number(panelAngles?.y) || 0;
  const zDeg = Number(panelAngles?.z) || 0;
  const rel = new THREE.Quaternion();
  if (Math.abs(xDeg) > 1e-6) {
    const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(rel).normalize();
    const qx = new THREE.Quaternion().setFromAxisAngle(axisX, xDeg * degToRad);
    rel.copy(qx.multiply(rel)).normalize();
  }
  if (Math.abs(yDeg) > 1e-6) {
    const axisY = new THREE.Vector3(0, 1, 0).applyQuaternion(rel).normalize();
    const qy = new THREE.Quaternion().setFromAxisAngle(axisY, yDeg * degToRad);
    rel.copy(qy.multiply(rel)).normalize();
  }
  if (Math.abs(zDeg) > 1e-6) {
    const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(rel).normalize();
    const qz = new THREE.Quaternion().setFromAxisAngle(axisZ, zDeg * degToRad);
    rel.copy(qz.multiply(rel)).normalize();
  }
  return baseQuat.clone().multiply(rel).normalize();
}

function ensureScaleGizmo() {
  if (scaleGizmoGroup) { return; }
  scaleGizmoGroup = new THREE.Group();
  scaleGizmoGroup.name = 'ScaleGizmo';

  const ringRadius = 1.0;
  const ringTube = 0.03;
  const ringGeom = new THREE.TorusGeometry(ringRadius, ringTube, 12, 64);
  const makeRing = (color, axis, euler, radiusScale = 1.0) => {
    const geom = radiusScale === 1.0
      ? ringGeom
      : new THREE.TorusGeometry(ringRadius * radiusScale, ringTube, 12, 64);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geom, mat);
    const pick = new THREE.Mesh(
      geom,
      createRaycastOnlyMaterial()
    );
    mesh.rotation.set(euler.x, euler.y, euler.z);
    pick.rotation.set(euler.x, euler.y, euler.z);
    pick.position.y = -GIZMO_PICK_OFFSET;
    pick.userData = { ...(pick.userData || {}), isScaleGizmo: true, axis };
    scaleGizmoGroup.add(mesh);
    scaleGizmoGroup.add(pick);
    scaleGizmoMeshes.push(pick);
  };

  // 横方向（yaw: Y軸）
  makeRing(0x5cff88, new THREE.Vector3(0, 1, 0), new THREE.Euler(Math.PI / 2, 0, 0));
  // 縦方向（pitch: X軸）
  makeRing(0xe63946, new THREE.Vector3(1, 0, 0), new THREE.Euler(0, Math.PI / 2, 0));
  scaleGizmoGroup.visible = false;
  scene.add(scaleGizmoGroup);

  scaleArrow = new THREE.ArrowHelper(scaleDirection.clone().normalize(), new THREE.Vector3(), 2, 0xf4c430, 0.45, 0.25);
  scaleArrow.name = 'ScaleArrow';
  scaleArrow.visible = false;
  scene.add(scaleArrow);

  scaleArrowPick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 1, 8),
    createRaycastOnlyMaterial({ side: THREE.FrontSide })
  );
  scaleArrowPick.name = 'ScaleArrowPick';
  scaleArrowPick.visible = false;
  scene.add(scaleArrowPick);
}

function getScaleSelectionBasisQuat(meshes) {
  if (!Array.isArray(meshes) || meshes.length < 1) { return new THREE.Quaternion(); }
  if (movePointCoordinateMode !== 'grid') { return new THREE.Quaternion(); }
  const ref = meshes[0]?.userData?.planeRef;
  if (ref?.quaternion?.isQuaternion) {
    return ref.quaternion.clone().normalize();
  }
  return new THREE.Quaternion();
}

function getScaleTargetWorldPosition(mesh) {
  if (mesh?.userData?.differenceControlPoint) {
    return mesh.getWorldPosition(new THREE.Vector3());
  }
  return mesh?.position?.clone ? mesh.position.clone() : new THREE.Vector3();
}

function setScaleTargetWorldPosition(mesh, worldPos) {
  if (!mesh || !worldPos) { return; }
  if (mesh.userData?.differenceControlPoint && mesh.parent) {
    const local = mesh.parent.worldToLocal(worldPos.clone());
    mesh.position.copy(local);
    return;
  }
  mesh.position.copy(worldPos);
}

function updateScaleGizmo() {
  ensureScaleGizmo();
  const meshes = getMovePointPanelTargets();
  const isSteelFrameScale = (editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING');
  const isDifferenceScale = (editObject === 'DIFFERENCE_SPACE' && objectEditMode === 'CONSTRUCT' && differenceSpaceTransformMode === 'scale');
  if (!scalePointPanelActive
    || (!isSteelFrameScale && !isDifferenceScale)
    || meshes.length < 2) {
    scaleGizmoGroup.visible = false;
    if (scaleArrow) { scaleArrow.visible = false; }
    if (scaleArrowPick) { scaleArrowPick.visible = false; }
    return;
  }
  const center = new THREE.Vector3();
  meshes.forEach((m) => center.add(getScaleTargetWorldPosition(m)));
  center.multiplyScalar(1 / meshes.length);
  const basisQuat = getScaleSelectionBasisQuat(meshes);

  const idsKey = meshes.map((m) => m.id).sort((a, b) => a - b).join(',') + `|${movePointCoordinateMode}`;
  const useSavedDifferenceScaleAngle = (
    editObject === 'DIFFERENCE_SPACE'
    && objectEditMode === 'CONSTRUCT'
    && ['scale', 'rotation'].includes(differenceSpaceTransformMode)
  );
  if (scaleGizmoIdsKey !== idsKey) {
    scaleGizmoIdsKey = idsKey;
    if (useSavedDifferenceScaleAngle) {
      applyDifferenceScaleAngleState();
    } else {
      scaleGizmoQuat.copy(basisQuat);
      scaleDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(scaleGizmoQuat).normalize());
    }
  }

  let maxDist = 1.0;
  meshes.forEach((m) => {
    const d = getScaleTargetWorldPosition(m).distanceTo(center);
    if (d > maxDist) { maxDist = d; }
  });
  scaleGizmoGroup.position.copy(center);
  scaleGizmoGroup.quaternion.copy(scaleGizmoQuat);
  scaleGizmoGroup.scale.setScalar(Math.max(1.1, maxDist * 0.9));
  scaleGizmoGroup.visible = true;
  const arrowLen = Math.max(1.6, maxDist * 1.35);
  if (scaleArrow) {
    scaleArrow.position.copy(center);
    scaleArrow.setDirection(scaleDirection.clone().normalize());
    scaleArrow.setLength(arrowLen, 0.45, 0.25);
    scaleArrow.visible = true;
  }
  if (scaleArrowPick) {
    scaleArrowPick.visible = true;
    scaleArrowPick.position.copy(center.clone().add(scaleDirection.clone().multiplyScalar(arrowLen * 0.45)));
    scaleArrowPick.position.y -= GIZMO_PICK_OFFSET;
    scaleArrowPick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), scaleDirection.clone().normalize());
    scaleArrowPick.scale.set(1, arrowLen * 0.9, 1);
  }
}

function beginScaleRotateDrag(axisMesh) {
  if (!scalePointPanelActive || !axisMesh?.userData?.axis) { return; }
  scaleRotateAxisLocal = axisMesh.userData.axis.clone().normalize();
  if (scaleRotateAxisLocal.y === 1) {
    scaleRotateAxis.copy(new THREE.Vector3(0, 1, 0));
  } else {
    scaleRotateAxis.copy(scaleRotateAxisLocal.clone().applyQuaternion(scaleGizmoQuat).normalize());
  }
  scaleRotatePlane.setFromNormalAndCoplanarPoint(scaleRotateAxis, scaleGizmoGroup.position);
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(scaleRotatePlane, hit);
  if (!ok) { return; }
  scaleRotateStartVector.copy(hit).sub(scaleGizmoGroup.position).normalize();
  scaleGizmoQuatStart.copy(scaleGizmoQuat);
  scaleRotateDragging = true;
  efficacy = false;
}

function beginScaleDrag() {
  const meshes = ensureCopiedGroupReadyForPointEdit(getMovePointPanelTargets());
  if (!scalePointPanelActive || meshes.length < 2) { return; }
  updateScaleGizmo();
  scaleDragAxisWorld.copy(scaleDirection).normalize();
  scaleDragCenter.copy(scaleGizmoGroup.position);

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const n = camDir.clone().sub(scaleDragAxisWorld.clone().multiplyScalar(camDir.dot(scaleDragAxisWorld)));
  if (n.lengthSq() < 1e-8) {
    n.copy(new THREE.Vector3(0, 1, 0).sub(scaleDragAxisWorld.clone().multiplyScalar(scaleDragAxisWorld.y)));
  }
  if (n.lengthSq() < 1e-8) {
    n.copy(new THREE.Vector3(1, 0, 0));
  }
  n.normalize();
  scaleDragPlane.setFromNormalAndCoplanarPoint(n, scaleDragCenter);

  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(scaleDragPlane, hit);
  if (!ok) { return; }
  scaleDragStartAxisT = hit.clone().sub(scaleDragCenter).dot(scaleDragAxisWorld);

  scaleDragStartPositions = meshes.map((mesh) => ({ mesh, pos: getScaleTargetWorldPosition(mesh) }));
  let span = 0;
  scaleDragStartPositions.forEach(({ pos }) => {
    const proj = pos.clone().sub(scaleDragCenter).dot(scaleDragAxisWorld);
    span = Math.max(span, Math.abs(proj));
  });
  scaleDragStartSpan = Math.max(0.25, span);
  scaleDragCurrentFactor = 1;
  scaleDragging = true;
  moveClickPending = false;
  shouldToggle = false;
  if (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'scale') {
    beginDifferenceHistorySession();
    rebuildDifferenceEdgeOverlapConstraints();
  } else {
    moveHistoryStart = captureMoveHistoryStart();
  }
  efficacy = false;
}

function updateScaleRotateDrag() {
  if (!scaleRotateDragging) { return; }
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(scaleRotatePlane, hit);
  if (!ok) { return; }
  const current = hit.clone().sub(scaleGizmoGroup.position).normalize();
  const cross = new THREE.Vector3().crossVectors(scaleRotateStartVector, current);
  const dot = scaleRotateStartVector.dot(current);
  const angle = Math.atan2(cross.dot(scaleRotateAxis), dot);
  const deltaQuat = new THREE.Quaternion().setFromAxisAngle(scaleRotateAxis, angle);
  scaleGizmoQuat.copy(deltaQuat.multiply(scaleGizmoQuatStart)).normalize();
  scaleDirection.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(scaleGizmoQuat)).normalize();
  if (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'scale') {
    saveDifferenceScaleAngleState();
  }
  updateScaleGizmo();
}

function updateScaleDrag() {
  if (!scaleDragging || scaleDragStartPositions.length < 1) { return; }
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(scaleDragPlane, hit);
  if (!ok) { return; }
  const axisT = hit.clone().sub(scaleDragCenter).dot(scaleDragAxisWorld);
  const delta = axisT - scaleDragStartAxisT;
  const factor = Math.max(0.05, 1 + (delta / scaleDragStartSpan));
  scaleDragCurrentFactor = factor;

  const differenceContext = (editObject === 'DIFFERENCE_SPACE' && differenceSpaceTransformMode === 'scale');
  const curves = new Set();
  const dirtyMeshes = new Set();
  const movedPoints = [];
  scaleDragStartPositions.forEach(({ mesh, pos }) => {
    const offset = pos.clone().sub(scaleDragCenter);
    const projLen = offset.dot(scaleDragAxisWorld);
    const proj = scaleDragAxisWorld.clone().multiplyScalar(projLen);
    const perp = offset.clone().sub(proj);
    const world = perp.add(proj.multiplyScalar(factor)).add(scaleDragCenter);
    setScaleTargetWorldPosition(mesh, world);
    if (differenceContext && mesh?.userData?.differenceControlPoint) {
      const parentMesh = mesh.userData?.parentDifferenceSpacePlane || mesh.parent;
      if (parentMesh?.userData?.differenceSpacePlane) {
        dirtyMeshes.add(parentMesh);
        movedPoints.push(mesh);
      }
      return;
    }
    if (mesh?.userData?.guideCurve && typeof mesh.userData.guideControlIndex === 'number') {
      const curve = mesh.userData.guideCurve;
      const idx = mesh.userData.guideControlIndex;
      if (curve?.userData?.controlPoints && curve.userData.controlPoints[idx]) {
        curve.userData.controlPoints[idx] = mesh.position.clone();
        curves.add(curve);
      }
    }
  });
  curves.forEach((curve) => updateGuideCurve(curve));
  if (differenceContext) {
    if (movedPoints.length > 0) {
      propagateDifferenceSharedPoints(movedPoints, dirtyMeshes);
    }
    const constrained = applyDifferenceEdgeOverlapConstraints(dirtyMeshes);
    const finalDirty = constrained || dirtyMeshes;
    finalDirty.forEach((mesh) => syncDifferenceGeometryFromControlPoints(mesh));
    refreshDifferenceSelectedEdgeHighlights();
    refreshDifferencePreview();
  }

  if (rotationInputX) { rotationInputX.value = String(Number(factor).toFixed(3)); }
  if (rotationInputY) { rotationInputY.value = ''; }
  if (rotationInputZ) { rotationInputZ.value = ''; }
  updateScalePointPanelUI({ clearInputs: false });
  if (editObject === 'STEEL_FRAME') {
    drawingObject(scaleDragStartPositions.map((entry) => entry?.mesh).filter(Boolean));
  }
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
  if (objectEditMode !== ROTATE_MODE) {
    rotateGizmoGroup.visible = false;
    updateRotationSelectionInfo();
    return;
  }
  if (pointRotateModeActive && pointRotateTarget?.userData?.decorationType) {
    rotateGizmoGroup.visible = false;
    updateRotationSelectionInfo();
    return;
  }
  if (rotateTargetObject?.parent && rotateTargetObject?.quaternion?.isQuaternion) {
    rotateCenter.copy(rotateTargetObject.position);
    rotateGizmoGroup.position.copy(rotateCenter);
    rotateGizmoGroup.quaternion.copy(rotateTargetObject.quaternion);
    rotateGizmoGroup.scale.setScalar(1.6);
    rotateGizmoGroup.visible = true;
    if (rotationInputX) rotationInputX.placeholder = String(Number(rotatePanelState.angles.x || 0).toFixed(1));
    if (rotationInputY) rotationInputY.placeholder = String(Number(rotatePanelState.angles.y || 0).toFixed(1));
    if (rotationInputZ) rotationInputZ.placeholder = String(Number(rotatePanelState.angles.z || 0).toFixed(1));
    return;
  }
  const meshes = getRotateSelectionMeshes();
  if (meshes.length < 2) {
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
  const isDecorationRotate = false;
  const meshes = isDecorationRotate
    ? [rotateTargetObject]
    : ensureCopiedGroupReadyForPointEdit(getRotateSelectionMeshes());
  if (meshes.length < (isDecorationRotate ? 1 : 2)) { return; }
  rotateAxisLocal = axisMesh?.userData?.axis?.clone?.()?.normalize?.() || new THREE.Vector3(0, 1, 0);
  rotateDragAction = axisMesh?.userData?.action || 'rotate_points';
  rotatePanelAnglesStart = {
    x: Number(rotatePanelState?.angles?.x) || 0,
    y: Number(rotatePanelState?.angles?.y) || 0,
    z: Number(rotatePanelState?.angles?.z) || 0,
  };
  rotateAxis = rotateAxisLocal.clone();
  if (isDecorationRotate) {
    rotateAxis.applyQuaternion(rotateTargetObject.quaternion).normalize();
    rotateTargetStartQuaternion.copy(rotateTargetObject.quaternion);
  }
  rotateCenter = rotateGizmoGroup.position.clone();
  rotatePlane.setFromNormalAndCoplanarPoint(rotateAxis, rotateCenter);
  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  const ok = raycaster.ray.intersectPlane(rotatePlane, hit);
  if (!ok) { return; }
  rotateStartVector.copy(hit).sub(rotateCenter).normalize();
  rotateStartPositions = meshes.map((m) => ({ mesh: m, pos: m.position.clone() }));
  // console.log('[rotate-gizmo] begin', {
  //   isDecorationRotate,
  //   axisLocal: rotateAxisLocal ? rotateAxisLocal.toArray() : null,
  //   axisWorld: rotateAxis ? rotateAxis.toArray() : null,
  //   center: rotateCenter ? rotateCenter.toArray() : null,
  //   targets: meshes.map((m) => m?.id).filter(Boolean),
  // });
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
  // console.log('[rotate-gizmo] drag', {
  //   angleDeg: Number((angle * 180 / Math.PI).toFixed(3)),
  //   axisWorld: rotateAxis ? rotateAxis.toArray() : null,
  // });
  const isDecorationRotate = false;
  if (isDecorationRotate) {
    const dq = new THREE.Quaternion().setFromAxisAngle(rotateAxis, angle);
    rotateTargetObject.quaternion.copy(dq.multiply(rotateTargetStartQuaternion).normalize());
    const panelAngles = getRotationPanelAnglesFromQuaternion(rotateTargetObject.quaternion);
    rotatePanelState.angles = panelAngles;
    rotateTargetObject.userData = {
      ...(rotateTargetObject.userData || {}),
      pointRotateBasisQuat: rotateTargetObject.quaternion.toArray(),
      pointRotateDirection: new THREE.Vector3(0, 0, 1).applyQuaternion(rotateTargetObject.quaternion).normalize(),
      pointRotatePanelAngles: panelAngles,
    };
    if (rotationInputX) { rotationInputX.value = String(panelAngles.x.toFixed(1)); }
    if (rotationInputY) { rotationInputY.value = String(panelAngles.y.toFixed(1)); }
    if (rotationInputZ) { rotationInputZ.value = String(panelAngles.z.toFixed(1)); }
    syncRotationInputGhostHints();
    rotateTargetObject.updateMatrixWorld(true);
    updateRotateGizmo();
    return;
  }

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
  const angleDeg = angle * (180 / Math.PI);
  const panelAngles = { ...rotatePanelAnglesStart };
  if (rotateAxisLocal?.x === 1) {
    panelAngles.x = rotatePanelAnglesStart.x + angleDeg;
  } else if (rotateAxisLocal?.y === 1) {
    if (rotateDragAction === 'rotate_gizmo_y') {
      panelAngles.z = rotatePanelAnglesStart.z + angleDeg;
    } else {
      panelAngles.y = rotatePanelAnglesStart.y + angleDeg;
    }
  } else if (rotateAxisLocal?.z === 1) {
    panelAngles.z = rotatePanelAnglesStart.z + angleDeg;
  }
  rotatePanelState.angles = panelAngles;
  if (rotationInputX) {
    const xText = String(panelAngles.x.toFixed(1));
    rotationInputX.value = xText;
    rotationInputX.placeholder = xText;
  }
  if (rotationInputY) {
    const yText = String(panelAngles.y.toFixed(1));
    rotationInputY.value = yText;
    rotationInputY.placeholder = yText;
  }
  if (rotationInputZ) {
    const zText = String(panelAngles.z.toFixed(1));
    rotationInputZ.value = zText;
    rotationInputZ.placeholder = zText;
  }
  syncRotationInputGhostHints();
  // update curves once per drag step
  const curves = new Set();
  rotateStartPositions.forEach(({ mesh }) => {
    if (mesh?.userData?.guideCurve) {
      curves.add(mesh.userData.guideCurve);
    }
  });
  curves.forEach((curve) => updateGuideCurve(curve));
  updateRotationSelectionInfo();
  if (editObject === 'STEEL_FRAME') {
    drawingObject(rotateStartPositions.map((entry) => entry?.mesh).filter(Boolean));
  }
}

// Ensure resize uses unified handler
window.addEventListener('resize', onWindowResize, false);

export function UIevent (uiID, toggle){
  scheduleClampUiPanels();
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
    setRailConstructionPanelVisible(false);

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
  resetConstructionStrokeState();
  constructionModeActive = true;
  setRailConstructionPanelVisible(true);
  setRailConstructionCategory(selectedRailConstructionCategory);
  updateStructurePinnedVisibility();
  } else {
  console.log( 'construction _inactive' )
  resetConstructionStrokeState();
  constructionModeActive = false;
  setRailConstructionPanelVisible(false);
  clearConstructionSelection();
  updateStructurePinnedVisibility();
  }} else if ( uiID === 'bridge' ){ if ( toggle === 'active' ){
  console.log( 'bridge _active' )
  setRailConstructionCategory('bridge');
  runRailConstructionByCategory('bridge');
  }} else if ( uiID === 'elevated' ){ if ( toggle === 'active' ){
  console.log( 'elevated _active' )
  setRailConstructionCategory('elevated');
  runRailConstructionByCategory('elevated');
  }} else if ( uiID === 'wall' ){ if ( toggle === 'active' ){
  console.log( 'wall _active' )
  setRailConstructionCategory('wall');
  runRailConstructionByCategory('wall');
  }} else if ( uiID === 'floor' ){ if ( toggle === 'active' ){
  console.log( 'floor _active' )
  setRailConstructionCategory('floor');
  runRailConstructionByCategory('floor');
  }} else if ( uiID === 'pillar' ){ if ( toggle === 'active' ){
  console.log( 'pillar _active' )
  setRailConstructionCategory('pillar');
  runRailConstructionByCategory('pillar');
  }} else if ( uiID === 'catenary_pole' ){ if ( toggle === 'active' ){
  console.log( 'catenary_pole _active' )
  setRailConstructionCategory('catenary_pole');
  runRailConstructionByCategory('catenary_pole');
  }} else if ( uiID === 'rib_bridge' ){ if ( toggle === 'active' ){
  console.log( 'rib_bridge _active' )
  setRailConstructionCategory('rib_bridge');
  runRailConstructionByCategory('rib_bridge');
  }} else if ( uiID === 'tunnel_rect' ){ if ( toggle === 'active' ){
  console.log( 'tunnel_rect _active' )
  setRailConstructionCategory('tunnel_rect');
  runRailConstructionByCategory('tunnel_rect');
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
    setCreateModeWorldFocus(false);

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
    targetObjects = steelFrameMode.getCurrentPointMeshes()
      .concat(guideRailPickMeshes)
      .concat(decorationObjects.filter((mesh) => mesh?.parent))
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    addPointGridActive = true
    if (!addPointGridInitialized) {
      addPointGridHandle.position.set(0, 0, 0);
      addPointGridInitialized = true;
    }
    addPointGridY = addPointGridHandle.position.y
    AddPointGuideGrid.position.copy(addPointGridHandle.position);
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
    if (!addPointGridInitialized) {
      addPointGridHandle.position.set(0, 0, 0);
      addPointGridInitialized = true;
    }
    addPointGridY = addPointGridHandle.position.y;
    AddPointGuideGrid.position.copy(addPointGridHandle.position);
    // 追加モードでは実体グリッド(newGrid)のみ表示し、親元グリッドの二重表示を防ぐ。
    setAddPointGuideGridVisibleFromUI(false);
  } else {
  console.log( 'add _inactive' )
    guideAddModeActive = false;
    guidePlacementTemplate = null;
    guidePlacementActive = false;
    guideRailHover = null;
    setGuideHoverPin(null);
    // add を閉じたら add_point の状態を再適用する
    UIevent('add_point', 'active');

  }} else if ( uiID === 'x_z_move' ){ if ( toggle === 'active' ){
  console.log( 'x_z_move _active' )
    editObject = 'STEEL_FRAME'
    objectEditMode = 'MOVE_EXISTING'
    move_direction_y = false
    search_object = true
    addPointGridActive = true
    steelFrameMode.setAllowPointAppend(false)
    if (!addPointGridInitialized) {
      addPointGridHandle.position.set(0, 0, 0);
      addPointGridInitialized = true;
    }
    addPointGridY = addPointGridHandle.position.y;
    addPointGridHandle.position.set(addPointGridHandle.position.x, addPointGridY, addPointGridHandle.position.z);
    AddPointGuideGrid.position.copy(addPointGridHandle.position);
    targetObjects = [addPointGridHandle]
    setMeshListOpacity(targetObjects, 1)
    search_point()
  } else {
  console.log( 'x_z_move _inactive' )
    search_object = false
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
      addPointGridY = addPointGridHandle.position.y
      setAddPointGuideGridVisibleFromUI(true);
    }

  }} else if ( uiID === 'y_add' ){ if ( toggle === 'active' ){
  console.log( 'y_add _active' )
    editObject = 'STEEL_FRAME'
    objectEditMode = 'MOVE_EXISTING'
    move_direction_y = true
    search_object = true
    addPointGridActive = true
    steelFrameMode.setAllowPointAppend(false)
    if (!addPointGridInitialized) {
      addPointGridHandle.position.set(0, 0, 0);
      addPointGridInitialized = true;
    }
    addPointGridHandle.position.set(addPointGridHandle.position.x, addPointGridY, addPointGridHandle.position.z);
    AddPointGuideGrid.position.copy(addPointGridHandle.position);
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
    movePointPanelActive = false
    setRotationPanelMode('rotation');
    angleSearchModeActive = false
    pointRotateModeActive = false
    clearPointRotateState()
    rotateTargetObject = null
    rotatePanelState.idsKey = ''
    rotatePanelState.angles = { x: 0, y: 0, z: 0 }
    editObject = 'STEEL_FRAME'
    objectEditMode = ROTATE_MODE
    search_object = true
    steelFrameMode.setAllowPointAppend(false)
    targetObjects = steelFrameMode.getAllPointMeshes().concat(decorationObjects.filter((mesh) => mesh?.parent))
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    updateRotateGizmo()
    setRotationPanelVisible(true);
    search_point()
  } else {
  console.log( 'rotation _inactive' )
    angleSearchModeActive = false
    rotateDragging = false
    pointRotateModeActive = false
    clearPointRotateState()
    rotateTargetObject = null
    rotatePanelState.idsKey = ''
    rotatePanelState.angles = { x: 0, y: 0, z: 0 }
    if (rotateGizmoGroup) {
      rotateGizmoGroup.visible = false;
    }
    setRotationPanelVisible(false);
    if (editObject === 'STEEL_FRAME') {
      objectEditMode = 'Standby'
    }

  }} else if ( uiID === 'search' ){ if ( toggle === 'active' ){
  console.log( 'search _active' )
    movePointPanelActive = false
    setRotationPanelMode('rotation');
    angleSearchModeActive = true
    searchSelectedGrid = null
    editObject = 'STEEL_FRAME'
    objectEditMode = SEARCH_MODE
    search_object = true
    steelFrameMode.setAllowPointAppend(false)
    targetObjects = steelFrameMode.getAllPointMeshes()
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    setRotationPanelVisible(true);
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
    setRotationPanelVisible(false);
    if (editObject === 'STEEL_FRAME' && objectEditMode === SEARCH_MODE) {
      objectEditMode = 'Standby'
    }
    search_object = false

  }} else if ( uiID === 'move_point' ){ if ( toggle === 'active' ){
  console.log( 'move_point _active' )
    movePointPanelActive = true
    scalePointPanelActive = false
    move_direction_y = false
    // search_object = false
    editObject = 'STEEL_FRAME'
    // steelFrameMode.clearSelection()
    steelFrameMode.setAllowPointAppend(false)
    objectEditMode = 'MOVE_EXISTING'
    targetObjects = steelFrameMode.getAllPointMeshes().concat(decorationObjects.filter((mesh) => mesh?.parent))
    console.log(targetObjects)
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)

    search_object = true
    updateMovePointPanelUI({ clearInputs: true });

  } else {
  console.log( 'move_point _inactive' )
    movePointPanelActive = false
    scalePointPanelActive = false
    setRotationPanelMode('rotation');
    setRotationPanelVisible(false);
    pointRotateModeActive = false
    search_object = false
    move_direction_y = false
    steelFrameMode.setAllowPointAppend(false)
    if (editObject === 'STEEL_FRAME') {
      objectEditMode = 'Standby'
    }
    clearPointRotateState();
    copyModeActive = false;
    clearCopySelection();
    styleModeActive = false;
    clearStyleSelection();
  }} else if ( uiID === 'copy' ){ if ( toggle === 'active' ){
  console.log( 'copy _active' )
    copyModeActive = true
    styleModeActive = false
    clearStyleSelection()
    movePointPanelActive = false
    scalePointPanelActive = false
    pointRotateModeActive = false
    clearPointRotateState()
    editObject = 'STEEL_FRAME'
    steelFrameMode.setAllowPointAppend(false)
    objectEditMode = 'COPY'
    targetObjects = steelFrameMode.getAllPointMeshes().concat(getConstructionCopyTargets())
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    search_object = true
    setRotationPanelMode('copy_mode');
    setRotationPanelVisible(true);
    updateCopyPanelUI({ clearInputs: true });
    search_point()

  } else {
  console.log( 'copy _inactive' )
    copyModeActive = false
    clearCopySelection()
    setRotationPanelMode('rotation');
    setRotationPanelVisible(false);
    search_object = false
    if (editObject === 'STEEL_FRAME' && objectEditMode === 'COPY') {
      objectEditMode = 'Standby'
    }
  }} else if ( uiID === 'style' ){ if ( toggle === 'active' ){
  console.log( 'style _active' )
    styleModeActive = true
    copyModeActive = false
    clearCopySelection()
    movePointPanelActive = false
    scalePointPanelActive = false
    pointRotateModeActive = false
    clearPointRotateState()
    editObject = 'STEEL_FRAME'
    steelFrameMode.setAllowPointAppend(false)
    objectEditMode = 'STYLE'
    targetObjects = getConstructionCopyTargets()
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    search_object = true
    setRotationPanelMode('style_mode');
    setRotationPanelVisible(true);
    updateStylePanelUI({ clearInputs: true });
    search_point()

  } else {
  console.log( 'style _inactive' )
    styleModeActive = false
    clearStyleSelection()
    setRotationPanelMode('rotation');
    setRotationPanelVisible(false);
    search_object = false
    if (editObject === 'STEEL_FRAME' && objectEditMode === 'STYLE') {
      objectEditMode = 'Standby'
    }
  }} else if ( uiID === 'scale' ){ if ( toggle === 'active' ){
  console.log( 'scale _active' )
    movePointPanelActive = false
    scalePointPanelActive = true
    pointRotateModeActive = false
    clearPointRotateState()
    move_direction_y = false
    editObject = 'STEEL_FRAME'
    steelFrameMode.setAllowPointAppend(false)
    objectEditMode = 'MOVE_EXISTING'
    targetObjects = steelFrameMode.getAllPointMeshes()
    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    search_object = true
    scaleGizmoIdsKey = ''
    scaleGizmoQuat.identity();
    scaleDirection.set(0, 0, 1);
    updateScalePointPanelUI({ clearInputs: true });
    updateScaleGizmo();

  } else {
  console.log( 'scale _inactive' )
    scalePointPanelActive = false
    scaleDragging = false
    scaleRotateDragging = false
    scaleDragStartPositions = []
    setRotationPanelMode('rotation');
    setRotationPanelVisible(false);
    search_object = false
    move_direction_y = false
    steelFrameMode.setAllowPointAppend(false)
    if (editObject === 'STEEL_FRAME') {
      objectEditMode = 'Standby'
    }
    if (scaleGizmoGroup) {
      scaleGizmoGroup.visible = false;
    }
    if (scaleArrow) {
      scaleArrow.visible = false;
    }
    if (scaleArrowPick) {
      scaleArrowPick.visible = false;
    }
  }} else if ( uiID === 'x_z_sf' ){ if ( toggle === 'active' ){
  console.log( 'x_z_sf _active' )
    movePointPanelActive = true
    scalePointPanelActive = false
    pointRotateModeActive = false
    clearPointRotateState()
    editObject = 'STEEL_FRAME'
    move_direction_y = false
    objectEditMode = 'MOVE_EXISTING'
    targetObjects = steelFrameMode.getCurrentPointMeshes().concat(decorationObjects.filter((mesh) => mesh?.parent))
    setMeshListOpacity(targetObjects, 1)
    search_object = true
    search_point()
    updateMovePointPanelUI({ clearInputs: true });

  } else {
  console.log( 'x_z_sf _inactive' )
    search_object = false
  }} else if ( uiID === 'y_sf' ){ if ( toggle === 'active' ){
  console.log( 'y_sf _active' )
    movePointPanelActive = true
    scalePointPanelActive = false
    pointRotateModeActive = false
    clearPointRotateState()
    editObject = 'STEEL_FRAME'
    move_direction_y = true
    objectEditMode = 'MOVE_EXISTING'
    targetObjects = steelFrameMode.getCurrentPointMeshes().concat(decorationObjects.filter((mesh) => mesh?.parent))
    setMeshListOpacity(targetObjects, 1)
    search_object = true
    search_point()
    updateMovePointPanelUI({ clearInputs: true });

  } else {
  console.log( 'y_sf _inactive' )
    search_object = false
  }} else if ( uiID === 'rotation/2' ){ if ( toggle === 'active' ){
  console.log( 'rotation/2 _active' )
    movePointPanelActive = false
    setRotationPanelMode('move_point_rotation');
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
    setRotationPanelVisible(true);
    updatePointRotateVisuals()
    search_point()
  } else {
  console.log( 'rotation/2 _inactive' )
    pointRotateModeActive = false
    setRotationPanelVisible(false);
    clearPointRotateState()
    if (editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING') {
      search_object = true
      search_point()
    }
  }} else if ( uiID === 'change_angle' ){ if ( toggle === 'active' ){
  console.log( 'change_angle _active' )
    movePointPanelActive = false
    setRotationPanelMode('rotation');
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
    setRotationPanelVisible(true);
    movePlaneGrid.visible = false;
    movePlaneGridHelper.visible = false;
  } else {
  console.log( 'change_angle _inactive' )
    if (movePlaneMode === 'change_angle') {
      movePlaneMode = 'default'
    }
    changeAngleGridTarget = null;
    movePlaneRotateDragging = false;
    setRotationPanelVisible(false);
    movePlaneGrid.visible = false;
    movePlaneGridHelper.visible = false;
    if (movePlaneGizmoGroup) movePlaneGizmoGroup.visible = false;
  }} else if ( uiID === 'construction/2' ){ if ( toggle === 'active' ){
  console.log( 'construction/2 _active' )
    resetConstructionStrokeState();
    editObject = 'STEEL_FRAME'
    objectEditMode = 'CONSTRUCT'
    search_object = false
    targetObjects = steelFrameMode.getAllPointMeshes()
    console.log(targetObjects)

    setMeshListOpacity(targetObjects, 1)
    steelFrameMode.setActive(true)
    setConstructionCategoryPanelVisible(true);
    setConstructionCategory(selectedConstructionProfile);
  } else {
  console.log( 'construction/2 _inactive' )
    resetConstructionStrokeState();
    // steelFrameMode.clearSelection()
    search_object = false
    move_direction_y = false
    setConstructionCategoryPanelVisible(false);
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
    setConstructionCategory('round')
  } else {
  console.log( 'Round_bar _inactive' )
  }} else if ( uiID === 'H_beam' ){ if ( toggle === 'active' ){
  console.log( 'H_beam _active' )
    setConstructionCategory('h_beam')
  } else {
  console.log( 'H_beam _inactive' )
  }} else if ( uiID === 'T_beam' ){ if ( toggle === 'active' ){
  console.log( 'T_beam _active' )
    setConstructionCategory('t_beam')
  } else {
  console.log( 'T_beam _inactive' )
  }} else if ( uiID === 'L_beam' ){ if ( toggle === 'active' ){
  console.log( 'L_beam _active' )
    setConstructionCategory('l_beam')
  } else {
  console.log( 'L_beam _inactive' )
  }} else if ( uiID === 'tubular' ){ if ( toggle === 'active' ){
  console.log( 'tubular _active' )
    setConstructionCategory('tubular')
  } else {
  console.log( 'tubular _inactive' )
  }} else if ( uiID === 'Difference' ){ if ( toggle === 'active' ){
  console.log( 'Difference _active' )
    if (blockManualDioramaSpaceMode()) { return; }
    differenceSpaceTransformMode = 'none'
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'none'; }
    setDifferenceBodySelectionMode(false);
    if (differencePanel) {
      differencePanel.style.display = 'none';
    }
    updateDifferenceStatus('spaceで平面を配置し、カテゴリ指定後に excavation を実行してください。');
  } else {
  console.log( 'Difference _inactive' )
    differenceSpaceModeActive = false
    differenceSpaceTransformMode = 'none'
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'none'; }
    setDifferenceBodySelectionMode(false);
    pointRotateModeActive = false
    scalePointPanelActive = false
    scaleDragging = false
    scaleRotateDragging = false
    scaleDragStartPositions = []
    if (scaleGizmoGroup) { scaleGizmoGroup.visible = false; }
    if (scaleArrow) { scaleArrow.visible = false; }
    if (scaleArrowPick) { scaleArrowPick.visible = false; }
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
    clearDifferenceSelectedBodyHighlights();
  }} else if ( uiID === 'body_select' ){ if ( toggle === 'active' ){
  console.log( 'body_select _active' )
    setDifferenceBodySelectionMode(true);
  } else {
  console.log( 'body_select _inactive' )
    setDifferenceBodySelectionMode(false);
  }} else if ( uiID === 'space' ){ if ( toggle === 'active' ){
  console.log( 'space _active' )
    if (blockManualDioramaSpaceMode()) { return; }
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
      differencePanel.style.display = 'none';
    }
    refreshDifferencePreview();
  } else {
  console.log( 'space _inactive' )
    differenceSpaceModeActive = false
    differenceSpaceTransformMode = 'none'
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'none'; }
    setDifferenceBodySelectionMode(false);
    pointRotateModeActive = false
    scalePointPanelActive = false
    scaleDragging = false
    scaleRotateDragging = false
    scaleDragStartPositions = []
    if (scaleGizmoGroup) { scaleGizmoGroup.visible = false; }
    if (scaleArrow) { scaleArrow.visible = false; }
    if (scaleArrowPick) { scaleArrowPick.visible = false; }
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
    refreshDifferenceSelectedEdgeHighlights();
  }} else if ( uiID === 'add/2' || uiID === 'add_space' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
    if (blockManualDioramaSpaceMode()) { return; }
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'add'
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'none'; }
    setDifferenceBodySelectionMode(false);
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
    refreshDifferenceSelectedEdgeHighlights();
  } else {
  console.log( uiID + ' _inactive' )
    differenceSpaceTransformMode = 'none'
    if (editObject === 'DIFFERENCE_SPACE' && objectEditMode === 'CREATE_NEW') {
      objectEditMode = 'Standby';
    }
    clearDifferenceFaceHighlight();
    differenceHoverFaceKey = null;
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
    refreshDifferenceSelectedEdgeHighlights();
  }} else if ( uiID === 'move/2' || uiID === 'move_space' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
    if (blockManualDioramaSpaceMode()) { return; }
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'move'
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'block'; }
    setDifferenceBodySelectButtonState(differenceBodySelectModeActive);
    differenceShapeType = 'box'
    if (differenceShapeSelect) {
      differenceShapeSelect.value = 'box';
    }
    pointRotateModeActive = true
    scalePointPanelActive = false
    scaleDragging = false
    scaleRotateDragging = false
    scaleDragStartPositions = []
    if (scaleGizmoGroup) { scaleGizmoGroup.visible = false; }
    if (scaleArrow) { scaleArrow.visible = false; }
    if (scaleArrowPick) { scaleArrowPick.visible = false; }
    editObject = 'DIFFERENCE_SPACE'
    objectEditMode = 'CONSTRUCT'
    search_object = false
    targetObjects = differenceSpacePlanes.filter((m) => m?.parent)
    setMeshListOpacity(targetObjects, 1)
    differenceSpacePlanes.forEach((mesh) => setDifferencePlaneVisual(mesh, false));
    movePointPanelActive = false;
    setRotationPanelMode('rotation');
    applyDifferencePointRotateAngleState('move', { attachToTarget: Boolean(pointRotateTarget) });
    setRotationPanelVisible(true);
    updatePointRotateVisuals();
    updateDifferenceStatus('move: 面を選択してドラッグで形状を変更します。');
    refreshDifferenceSelectedEdgeHighlights();
  } else {
  console.log( uiID + ' _inactive' )
    if (differenceSpaceTransformMode === 'move') {
      differenceSpaceTransformMode = 'none'
    }
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'none'; }
    setDifferenceBodySelectionMode(false);
    pointRotateModeActive = false
    setRotationPanelVisible(false);
    clearPointRotateState()
    if (editObject === 'DIFFERENCE_SPACE' && objectEditMode === 'CONSTRUCT') {
      objectEditMode = 'Standby';
    }
    clearDifferenceFaceHighlight();
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
    refreshDifferenceSelectedEdgeHighlights();
  }} else if ( uiID === 'rotation/3' || uiID === 'rotation_space' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
    if (blockManualDioramaSpaceMode()) { return; }
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'rotation'
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'block'; }
    setDifferenceBodySelectButtonState(differenceBodySelectModeActive);
    differenceShapeType = 'box'
    if (differenceShapeSelect) {
      differenceShapeSelect.value = 'box';
    }
    pointRotateModeActive = true
    scalePointPanelActive = false
    scaleDragging = false
    scaleRotateDragging = false
    scaleDragStartPositions = []
    if (scaleGizmoGroup) { scaleGizmoGroup.visible = false; }
    if (scaleArrow) { scaleArrow.visible = false; }
    if (scaleArrowPick) { scaleArrowPick.visible = false; }
    editObject = 'DIFFERENCE_SPACE'
    objectEditMode = 'CONSTRUCT'
    search_object = false
    targetObjects = differenceSpacePlanes.filter((m) => m?.parent)
    setMeshListOpacity(targetObjects, 1)
    differenceSpacePlanes.forEach((mesh) => setDifferencePlaneVisual(mesh, false));
    movePointPanelActive = false;
    setRotationPanelMode('rotation');
    applyDifferencePointRotateAngleState('rotation', { attachToTarget: Boolean(pointRotateTarget) });
    setRotationPanelVisible(true);
    updatePointRotateVisuals();
    updateDifferenceStatus('rotation: 面/点を選択し、ギズモで回転します。');
    refreshDifferenceSelectedEdgeHighlights();
  } else {
  console.log( uiID + ' _inactive' )
    if (differenceSpaceTransformMode === 'rotation') {
      differenceSpaceTransformMode = 'none'
    }
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'none'; }
    setDifferenceBodySelectionMode(false);
    pointRotateModeActive = false
    setRotationPanelVisible(false);
    clearPointRotateState()
    if (editObject === 'DIFFERENCE_SPACE' && objectEditMode === 'CONSTRUCT') {
      objectEditMode = 'Standby';
    }
    clearDifferenceFaceHighlight();
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
    refreshDifferenceSelectedEdgeHighlights();
  }} else if ( uiID === 'scale/2' || uiID === 'scale_space' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
    if (blockManualDioramaSpaceMode()) { return; }
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'scale'
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'block'; }
    setDifferenceBodySelectButtonState(differenceBodySelectModeActive);
    differenceShapeType = 'box'
    if (differenceShapeSelect) {
      differenceShapeSelect.value = 'box';
    }
    pointRotateModeActive = false
    clearPointRotateState()
    movePointPanelActive = false
    scalePointPanelActive = true
    editObject = 'DIFFERENCE_SPACE'
    objectEditMode = 'CONSTRUCT'
    search_object = false
    targetObjects = differenceSpacePlanes.filter((m) => m?.parent)
    setMeshListOpacity(targetObjects, 1)
    differenceSpacePlanes.forEach((mesh) => setDifferencePlaneVisual(mesh, false));
    setRotationPanelMode('scale_point');
    applyDifferenceScaleAngleState();
    setRotationPanelVisible(true);
    updateScalePointPanelUI({ clearInputs: true });
    updateScaleGizmo();
    updateDifferenceStatus('scale: control pointを複数選択してギズモでスケールします。');
    refreshDifferenceSelectedEdgeHighlights();
  } else {
  console.log( uiID + ' _inactive' )
    if (differenceSpaceTransformMode === 'scale') {
      differenceSpaceTransformMode = 'none'
    }
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'none'; }
    setDifferenceBodySelectionMode(false);
    scalePointPanelActive = false
    scaleDragging = false
    scaleRotateDragging = false
    scaleDragStartPositions = []
    if (scaleGizmoGroup) { scaleGizmoGroup.visible = false; }
    if (scaleArrow) { scaleArrow.visible = false; }
    if (scaleArrowPick) { scaleArrowPick.visible = false; }
    setRotationPanelVisible(false);
    if (editObject === 'DIFFERENCE_SPACE' && objectEditMode === 'CONSTRUCT') {
      objectEditMode = 'Standby';
    }
    refreshDifferenceSelectedEdgeHighlights();
  }} else if ( uiID === 'tube' || uiID === 'tube/2' || uiID === 'tube_space' ){ if ( toggle === 'active' ){
  console.log( uiID + ' _active' )
    if (blockManualDioramaSpaceMode()) { return; }
    differenceSpaceModeActive = true
    differenceSpaceTransformMode = 'tube'
    if (differenceBodySelectButton) { differenceBodySelectButton.style.display = 'none'; }
    setDifferenceBodySelectionMode(false);
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
    refreshDifferenceSelectedEdgeHighlights();
  } else {
  console.log( uiID + ' _inactive' )
    if (differenceSpaceTransformMode === 'tube') {
      differenceSpaceTransformMode = 'none'
    }
    clearDifferenceFaceHighlight();
    differenceSpacePlanes.forEach((mesh) => resetDifferenceControlPointsHighlight(mesh));
    refreshDifferenceSelectedEdgeHighlights();
  }} else if ( uiID === 'excavation' ){ if ( toggle === 'active' ){
  console.log( 'excavation _active' )
    if (blockManualDioramaSpaceMode()) { return; }
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
  updateUndoRedoButtons();
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
  updateConstructionStrokeSelection(e.clientX, e.clientY);
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
  if (differenceAddClickPending && differenceAddDownPos && differenceAddShouldCreate) {
    const dx = e.clientX - differenceAddDownPos.x;
    const dy = e.clientY - differenceAddDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      differenceAddShouldCreate = false;
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
  if (moveClickPending && moveDownPos && !dragging && !scalePointPanelActive && editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING') {
    const dx = e.clientX - moveDownPos.x;
    const dy = e.clientY - moveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      shouldToggle = false;
      if (choice_object) {
        if (choice_object?.userData?.decorationType === 'led_board') {
          moveDragAnchorStart = choice_object.position.clone();
          moveDragStartPositions = [];
        } else {
          const hasGroup = steelFrameMode.getSelectedPointMeshes().length > 0;
          if (!hasGroup) {
            // グループが空でも、複製グループ判定を通して単体/全体を確定
            const readyTargets = ensureCopiedGroupReadyForPointEdit([choice_object]);
            if (Array.isArray(readyTargets) && readyTargets.length > 0) {
              moveDragAnchorStart = choice_object.position.clone();
              moveDragStartPositions = readyTargets.map((mesh) => ({
                mesh,
                pos: mesh.position.clone(),
              }));
            } else {
              moveDragAnchorStart = choice_object.position.clone();
              moveDragStartPositions = [];
            }
          } else {
            if (!steelFrameMode.isSelectedPoint(choice_object)) {
              steelFrameMode.toggleSelectedPoint(choice_object);
              refreshPointEditPanelUI({ clearInputs: true });
            }
            const readyTargets = ensureCopiedGroupReadyForPointEdit(steelFrameMode.getSelectedPointMeshes());
            if (!Array.isArray(readyTargets) || readyTargets.length < 1) {
              return;
            }
            moveDragAnchorStart = choice_object.position.clone();
            moveDragStartPositions = readyTargets.map((mesh) => ({
              mesh,
              pos: mesh.position.clone(),
            }));
          }
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
        moveHistoryStart = captureMoveHistoryStart();
        efficacy = false;
        moveClickPending = false;
        search_object = false;
        GuideLine.visible = true;
      }
    }
  }
  syncEfficacyForTransformDrag();
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
  updateConstructionStrokeSelection(touch.clientX, touch.clientY);
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
  if (differenceAddClickPending && differenceAddDownPos && differenceAddShouldCreate) {
    const dx = touch.clientX - differenceAddDownPos.x;
    const dy = touch.clientY - differenceAddDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      differenceAddShouldCreate = false;
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
  if (moveClickPending && moveDownPos && !dragging && !scalePointPanelActive && editObject === 'STEEL_FRAME' && objectEditMode === 'MOVE_EXISTING') {
    const dx = touch.clientX - moveDownPos.x;
    const dy = touch.clientY - moveDownPos.y;
    if (dx * dx + dy * dy >= MOVE_CLICK_THRESHOLD * MOVE_CLICK_THRESHOLD) {
      shouldToggle = false;
      if (choice_object) {
        if (choice_object?.userData?.decorationType === 'led_board') {
          moveDragAnchorStart = choice_object.position.clone();
          moveDragStartPositions = [];
        } else {
          const hasGroup = steelFrameMode.getSelectedPointMeshes().length > 0;
          if (!hasGroup) {
            const readyTargets = ensureCopiedGroupReadyForPointEdit([choice_object]);
            if (Array.isArray(readyTargets) && readyTargets.length > 0) {
              moveDragAnchorStart = choice_object.position.clone();
              moveDragStartPositions = readyTargets.map((mesh) => ({
                mesh,
                pos: mesh.position.clone(),
              }));
            } else {
              moveDragAnchorStart = choice_object.position.clone();
              moveDragStartPositions = [];
            }
          } else {
            if (!steelFrameMode.isSelectedPoint(choice_object)) {
              steelFrameMode.toggleSelectedPoint(choice_object);
              refreshPointEditPanelUI({ clearInputs: true });
            }
            const readyTargets = ensureCopiedGroupReadyForPointEdit(steelFrameMode.getSelectedPointMeshes());
            if (!Array.isArray(readyTargets) || readyTargets.length < 1) {
              return;
            }
            moveDragAnchorStart = choice_object.position.clone();
            moveDragStartPositions = readyTargets.map((mesh) => ({
              mesh,
              pos: mesh.position.clone(),
            }));
          }
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
        moveHistoryStart = captureMoveHistoryStart();
        efficacy = false;
        search_object = false;
        GuideLine.visible = true;
      }
    }
  }
  syncEfficacyForTransformDrag();

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
document.addEventListener('keydown', (e) => {
  const keyLower = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && keyLower === 'z') {
    const activeTag = document.activeElement?.tagName?.toLowerCase?.() || '';
    if (activeTag === 'input' || activeTag === 'textarea') { return; }
    e.preventDefault();
    if (e.shiftKey) {
      redoHistoryByContext();
    } else {
      undoHistoryByContext();
    }
  } else if ((e.ctrlKey || e.metaKey) && keyLower === 'y') {
    const activeTag = document.activeElement?.tagName?.toLowerCase?.() || '';
    if (activeTag === 'input' || activeTag === 'textarea') { return; }
    e.preventDefault();
    redoHistoryByContext();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.repeat) { return; }
  const activeTag = document.activeElement?.tagName?.toLowerCase?.() || '';
  if (activeTag === 'input' || activeTag === 'textarea') { return; }
  if (e.key !== '`' && e.code !== 'Backquote') { return; }
  e.preventDefault();
  uiHiddenByHotkey = !uiHiddenByHotkey;
  setUiVisibleByHotkey(!uiHiddenByHotkey);
});
document.addEventListener('keyup', (e) => {
  if (canvas && canvas.classList.contains('intro-canvas') && !canvasFocused) return;
  keys[e.key.toLowerCase()] = false;
});

// ========== カメラ制御変数 ========== //
let cameraAngleY = 180 * Math.PI / 180;  // 水平回転
let cameraAngleX = -30 * Math.PI / 180;  // 垂直回転
let moveVectorX = 0
let moveVectorZ = 0

camera.position.y += 5
camera.position.z = 20//-13
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
  if (scalePointPanelActive) {
    updateScaleGizmo();
  } else if (scaleGizmoGroup) {
    scaleGizmoGroup.visible = false;
    if (scaleArrow) { scaleArrow.visible = false; }
    if (scaleArrowPick) { scaleArrowPick.visible = false; }
  }
  syncSinjyukuCityVisibility();

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
      GuideGrid_Center_x.quaternion.copy(GuideGrid.quaternion)
      GuideGrid_Center_x.visible = true
      GuideGrid_Center_z.position.copy(choice_object.position)
      GuideGrid_Center_z.quaternion.copy(GuideGrid.quaternion)
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
