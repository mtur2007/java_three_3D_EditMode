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
import { mergeGeometries } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js';
const scene = new THREE.Scene();

const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

// 初期はウェルカム用の縮小プレビューがある場合、そのサイズに合わせる。
const introWrapper = document.getElementById('intro-wrapper');
// three-ui container (may be moved between intro wrapper and body)
const threeUi = document.getElementById('three-ui');
  const showInstructionsBtn = document.getElementById('show-instructions-btn');
  const instructionsPanel = document.getElementById('instructions-panel');
  const operationSection = document.getElementById('operation');
  const previewFeature = document.getElementById('preview-feature');
  const previewStartBtn = document.getElementById('preview-start');
  const previewSkipBtn = document.getElementById('preview-skip');

  // 初期表示: プレビューでは three-ui を隠してプレビュー用パネルを表示
  if (threeUi) {
    try { threeUi.style.display = 'none'; } catch (e) {}
  }
  if (previewFeature) {
    try { previewFeature.style.display = 'block'; } catch (e) {}
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
  // controller 初期位置更新
  try { updateCtrlPos(); } catch (e) {}
} else {
  canvas.classList.add('full-canvas');
  renderer.setSize(window.innerWidth, window.innerHeight);
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

loader.load('textures/moonless_golf.jpg', (texture_night) => {
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
  } else {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  try { updateCtrlPos(); } catch (e) {}
  }
}

window.addEventListener('resize', onWindowResize, false);

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
if (previewSkipBtn) {
  previewSkipBtn.addEventListener('pointerdown', () => {
    if (welcome) welcome.style.display = 'none';
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
TSys.updateObjectOnPath(path_1);
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
TSys.updateObjectOnPath(path_2);

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
TSys.updateObjectOnPath(test);

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

startLoop(); // 処理開始

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

    function animate(time) {
      const t = Math.min((time - startTime) / duration, 1);

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
let Points_0 = []
let Points_1 = []
let Points_2 = []
let Points_3 = []

let JK_upbound_point = []
let JY_upbound_point = []
let JY_downbound_point = []
let JK_downbound_point = []

let sinkansen_upbound_point = []
let sinkansen_downbound_point = []

let J_UJT_upbound_point = []
let J_UJT_downbound_point = []

const TRACK_DATA_URL = 'map_data/track_points.json';
const TRACK_DATA_VERSION = 1;
const REQUIRED_TRACK_KEYS = [
  'Points_0',
  'Points_1',
  'Points_2',
  'Points_3',
  'JK_upbound_point',
  'JY_upbound_point',
  'JY_downbound_point',
  'JK_downbound_point',
  'J_UJT_upbound_point',
  'J_UJT_downbound_point',
  'sinkansen_upbound_point',
  'sinkansen_downbound_point',
];

function isPlainPoint(value) {
  return !!value &&
    typeof value === 'object' &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z);
}

function pointsToVector3(list) {
  return list.map((point) => new THREE.Vector3(point.x, point.y, point.z));
}

function pointsToPlain(list) {
  return list.map((point) => ({ x: point.x, y: point.y, z: point.z }));
}

async function loadTrackData(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('track_points.json が見つかりません。');
  }
  const data = await response.json();
  if (!data || typeof data !== 'object') {
    throw new Error('track_points.json の形式が正しくありません。');
  }
  return data;
}

function normalizeTrackData(rawData) {
  const rawTracks = rawData && typeof rawData === 'object' ? rawData.tracks : null;
  if (!rawTracks || typeof rawTracks !== 'object') {
    throw new Error('track_points.json に tracks がありません。');
  }

  const tracks = {};
  REQUIRED_TRACK_KEYS.forEach((name) => {
    const rawList = rawTracks[name];
    if (!Array.isArray(rawList) || !rawList.every(isPlainPoint)) {
      throw new Error('track_points.json に不足または不正な点群があります: ' + name);
    }
    tracks[name] = pointsToVector3(rawList);
  });

  const dataIsScaled = !!(rawData && rawData.meta && rawData.meta.scaled === true);
  return { tracks, dataIsScaled };
}

let trackMap = null;
let dataIsScaled = false;
try {
  const trackDataRaw = await loadTrackData(TRACK_DATA_URL);
  const normalized = normalizeTrackData(trackDataRaw);
  trackMap = normalized.tracks;
  dataIsScaled = normalized.dataIsScaled;
} catch (err) {
  alert(err.message);
  throw err;
}

const scale = 0.35/0.45; // 好きな倍率
if (!dataIsScaled) {
  Object.keys(trackMap).forEach((name) => {
    trackMap[name].forEach((v) => v.multiplyScalar(scale));
  });
}

Points_0 = trackMap.Points_0;
Points_1 = trackMap.Points_1;
Points_2 = trackMap.Points_2;
Points_3 = trackMap.Points_3;

JK_upbound_point = trackMap.JK_upbound_point;
JY_upbound_point = trackMap.JY_upbound_point;
JY_downbound_point = trackMap.JY_downbound_point;
JK_downbound_point = trackMap.JK_downbound_point;

J_UJT_upbound_point = trackMap.J_UJT_upbound_point;
J_UJT_downbound_point = trackMap.J_UJT_downbound_point;

sinkansen_upbound_point = trackMap.sinkansen_upbound_point;
sinkansen_downbound_point = trackMap.sinkansen_downbound_point;

function buildTrackDataPayload() {
  return {
    meta: {
      version: TRACK_DATA_VERSION,
      scaled: true,
      savedAt: new Date().toISOString(),
    },
    tracks: {
      Points_0: pointsToPlain(Points_0),
      Points_1: pointsToPlain(Points_1),
      Points_2: pointsToPlain(Points_2),
      Points_3: pointsToPlain(Points_3),
      JK_upbound_point: pointsToPlain(JK_upbound_point),
      JY_upbound_point: pointsToPlain(JY_upbound_point),
      JY_downbound_point: pointsToPlain(JY_downbound_point),
      JK_downbound_point: pointsToPlain(JK_downbound_point),
      J_UJT_upbound_point: pointsToPlain(J_UJT_upbound_point),
      J_UJT_downbound_point: pointsToPlain(J_UJT_downbound_point),
      sinkansen_upbound_point: pointsToPlain(sinkansen_upbound_point),
      sinkansen_downbound_point: pointsToPlain(sinkansen_downbound_point),
    },
  };
}

function downloadTrackData() {
  const payload = buildTrackDataPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'track_points.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  alert('track_points.json を保存しました。');
}

const saveTrackButton = document.getElementById('save-track-data');
if (saveTrackButton) {
  saveTrackButton.addEventListener('click', downloadTrackData);
}

// 指定したポイントから線(線路の軌道)を生成
const line_1 = new THREE.CatmullRomCurve3(Points_0);
const line_2 = new THREE.CatmullRomCurve3(Points_1);
const line_3 = new THREE.CatmullRomCurve3(Points_2);
const line_4 = new THREE.CatmullRomCurve3(Points_3);

const JK_upbound = new THREE.CatmullRomCurve3(JK_upbound_point);
const JY_upbound = new THREE.CatmullRomCurve3(JY_upbound_point);
const JY_downbound = new THREE.CatmullRomCurve3(JY_downbound_point);
const JK_downbound = new THREE.CatmullRomCurve3(JK_downbound_point);

const J_UJT_upbound = new THREE.CatmullRomCurve3(J_UJT_upbound_point);
const J_UJT_downbound = new THREE.CatmullRomCurve3(J_UJT_downbound_point);

const sinkansen_upbound = new THREE.CatmullRomCurve3(sinkansen_upbound_point);
const sinkansen_downbound = new THREE.CatmullRomCurve3(sinkansen_downbound_point);

const railTrackDefs = [
  { name: 'Points_0', curve: line_1, points: Points_0 },
  { name: 'Points_1', curve: line_2, points: Points_1 },
  { name: 'Points_2', curve: line_3, points: Points_2 },
  { name: 'Points_3', curve: line_4, points: Points_3 },
  { name: 'JK_upbound_point', curve: JK_upbound, points: JK_upbound_point },
  { name: 'JY_upbound_point', curve: JY_upbound, points: JY_upbound_point },
  { name: 'JY_downbound_point', curve: JY_downbound, points: JY_downbound_point },
  { name: 'JK_downbound_point', curve: JK_downbound, points: JK_downbound_point },
  { name: 'J_UJT_upbound_point', curve: J_UJT_upbound, points: J_UJT_upbound_point },
  { name: 'J_UJT_downbound_point', curve: J_UJT_downbound, points: J_UJT_downbound_point },
  { name: 'sinkansen_upbound_point', curve: sinkansen_upbound, points: sinkansen_upbound_point },
  { name: 'sinkansen_downbound_point', curve: sinkansen_downbound, points: sinkansen_downbound_point },
];

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
const railSelectionRadius = 30;
const railSelectionRange = 3;
const railSelectionLineColor = 0x00ff00;
const railSelectionLineName = 'RailSelected';
let selectedRailPoint = null;

const structureSampleInterval = 2;
const structureHoverColor = 0xffff33;
const structurePinnedColor = 0xff33aa;
let structureModeActive = false;
let structureSamplesDirty = true;
let structureSamplePoints = [];
let structureHoverPoint = null;
let structureHoverPin = null;
const structurePinnedPins = [];
let lastPointerScreen = null;

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

function ensureStructureHoverPin() {
  if (structureHoverPin) { return; }
  structureHoverPin = TSys.Map_pin(0, 0, 0, 0.15, structureHoverColor);
  structureHoverPin.name = 'StructureHoverPin';
}

function updateStructureHover() {
  if (!structureModeActive || !lastPointerScreen) {
    if (structureHoverPin) {
      structureHoverPin.visible = false;
    }
    structureHoverPoint = null;
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
    return;
  }

  structureHoverPoint = best.point.clone();
  ensureStructureHoverPin();
  structureHoverPin.position.copy(best.point);
  structureHoverPin.visible = true;
}

function placeStructurePinnedPin() {
  if (!structureHoverPoint) { return; }
  const pin = TSys.Map_pin(
    structureHoverPoint.x,
    structureHoverPoint.z,
    structureHoverPoint.y,
    0.2,
    structurePinnedColor
  );
  pin.name = 'StructurePinnedPin';
  structurePinnedPins.push(pin);
}

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

const station_s = { x:-0.08825664191497662, y:6.394628223749855 , z:-30.695962680017335 }
const station_loof_f = { x:-0.3852393328186856 , y:6.394628223749855 , z:-3.535125641715606 }
const station_f = { x:-0.023948863771414863, y:6.394628223749855, z:60.51354120550737 }
const wall_f = {x:3.5989745081382956, y:6.394628223749855, z:-97.26135689524132}
const tunnel_f ={ x: 6.600868195728852, y: 7.382920205399699, z: -114.92055445840528}
const GirderBridge_2s = { x: 5.001398579127916, y:8.083673215609398, z:-112.97485249672447}
const GirderBridge_3s = { x:4.230750095101928, y:8.083673215609398, z:-107.2650424352493}
const GirderBridge_2f = { x:0.6169566203936264, y:8.083673215609398, z:-131.36793571309448}
const GirderBridge_3f = { x:-0.25619051153051203, y:8.083673215609398, z:-129.1500954585025}

const JB_elevated_s = {x:-5.7208845108099355, y:3.4737070495198132, z:-163.0539699013825 }
const JB_elevated_f = {x:17.981473636001454, y:3.4737070495198132, z:-232.08566441107527 }

const track1 = findCurveRange(line_1, station_s, station_f)
const track2 = findCurveRange(line_2, station_s, station_f)
const track3 = findCurveRange(line_3, station_s, station_f)
const track4 = findCurveRange(line_4, station_s, station_f)

const JB_u_elevated = findCurveRange(line_2, JB_elevated_s, JB_elevated_f)
const JB_d_elevated = findCurveRange(line_3, JB_elevated_s, JB_elevated_f)

const roof_track1 = findCurveRange(line_1, station_s, station_loof_f);
const roof_track2 = findCurveRange(line_2, station_s, station_loof_f);
const roof_track3 = findCurveRange(line_3, station_s, station_loof_f);
const roof_track4 = findCurveRange(line_4, station_s, station_loof_f);

const wall_track1 = findCurveRange(line_1, station_s, wall_f)
const wall_track2 = findCurveRange(line_2, station_s, wall_f)

const wall_track3 = findCurveRange(line_3, station_s, wall_f)
const wall_track4 = findCurveRange(line_4, station_s, wall_f)

const tunnel_1 = findCurveRange(line_4, wall_f, tunnel_f)
const tunnel_2 = findCurveRange(line_4, wall_f, tunnel_f)

const bridge_2 = findCurveRange(line_2, GirderBridge_2s, GirderBridge_2f)
const bridge_3 = findCurveRange(line_3, GirderBridge_3s, GirderBridge_3f)

const Elevated_2 = findCurveRange(line_2, Points_1[0], GirderBridge_2s)
const Elevated_3 = findCurveRange(line_3, Points_2[0], GirderBridge_3f)

TSys.createTrack(line_1, 1.83, 0x000000)
TSys.createTrack(line_2, 1.83, 0x000000)

TSys.createTrack(line_3, 1.83, 0x000000)
TSys.createTrack(line_4, 1.83, 0x000000)

// 駅(プラットホーム)を生成
TSys.createStation(track1,track2,200,y,0.6, '|[]|') // 島式 |[]| : 相対式 []||[]
TSys.createStation(track3,track4,200,y,0.6, '|[]|') // 島式 |[]| : 相対式 []||[]

// 駅(屋根)を生成
TSys.placePlatformRoof(roof_track1,roof_track2,y+1.4,10)
TSys.placePlatformRoof(roof_track3,roof_track4,y+1.4,10)

const door_interval = train_width + car_Spacing
const track1_doors = TSys.placePlatformDoors(track1, 0.7, door_interval, 'left');  // 左側に設置
const track2_doors = TSys.placePlatformDoors(track2, 0.7, door_interval, 'right');  // 左側に設置

const track3_doors = TSys.placePlatformDoors(track3, 0.7, door_interval, 'left');  // 左側に設置
const track4_doors = TSys.placePlatformDoors(track4, 0.7, door_interval, 'right');  // 左側に設置

// 壁の生成
TSys.createWall(wall_track1,wall_track2,40,0.85,-0.85, 0.1, 0.1)
TSys.createWall(wall_track3,wall_track4,40,0.85,-0.85, 0.1, 0.1)

const quantity = 3

TSys.createWall(tunnel_1,tunnel_1,40,-0.9,-0.9,0,2.2)
TSys.createWall(tunnel_1,tunnel_1,40,0.9,0.9,0,2.2)

const river = findCurveRange(line_4, Points_3[Points_3.length-1], {x:38.79449255756082, y:y+0.40000000000000036, z:-189.92134871967772 })
console.log(river)

TSys.createWall(river,river,40,0.885,2,0,-4) // 線路側:壁
TSys.createWall(river,river,40,10,10,-4,-3) // 対岸側:壁
TSys.createWall(river,river,40,10,30,-3,-3) // 対岸側:地面

const water_material = new THREE.MeshStandardMaterial({
  color: 0x005555,         // 白ベース
  metalness: 0.3,          // 完全な金属
  roughness: 0,          // 少しザラつき（0.0だと鏡面すぎる）
  envMapIntensity: 1,    // 環境マップの反射強度（あるとリアル）
  side: THREE.DoubleSide   // 両面描画（必要なら）
});
TSys.createWall(river,river,40,2,10,-4,-4,0x003355,water_material)

const board_length_1 = tunnel_1.getLength(line_4)/quantity;
const board_length_2 = tunnel_2.getLength(line_4)/quantity;
const points_1 = TSys.RailMargin(TSys.getPointsEveryM(tunnel_1, board_length_1), 1);
const points_2 = TSys.RailMargin(TSys.getPointsEveryM(tunnel_2, board_length_2), -1);

for(let i=0; i < points_1.length-1; i++){
  const coordinate1 = points_1[i]
  const coordinate2 = points_2[i]
  
  const coordinate4 = points_1[i+1]
  const coordinate3 = points_2[i+1]

  const shape = new THREE.Shape();
  shape.moveTo(coordinate1.x, coordinate1.z);
  shape.lineTo( coordinate2.x, coordinate2.z);
  shape.lineTo(coordinate3.x, coordinate3.z);
  shape.lineTo(coordinate4.x, coordinate4.z);

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: false });
  const material = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.5,
    roughness: 0.9,
    envMap: scene.environment,  // もし読み込んでるなら
    envMapIntensity: 3,
    side: THREE.FrontSide
  });
  
  
  const mesh = new THREE.Mesh(geometry, material);

  mesh.rotation.x = 91 * Math.PI / 180;
  mesh.position.y = 7.25; // 高さ1.5に移動

  scene.add(mesh);

}

// 架線柱の生成
const point_data = TSys.RailMargin(TSys.getPointsEveryM(wall_track4, 8), 1, true);
const pole_line = point_data[0]
const pole_angle = point_data[1]

// right_height, left_height, beamLength, beam_height
const Poles = TSys.createCatenaryPole(0,3.2,1.4,2.3, 5)
for(let i=0; i<Poles.children.length; i++){
  Poles.children[i].rotation.y += pole_angle[i]
  Poles.children[i].position.set(pole_line[i].x,pole_line[i].y,pole_line[i].z)
}
scene.add(Poles)

const poletrak = findCurveRange(line_3, Points_2[0], station_f)
const point_data2 = TSys.RailMargin(TSys.getPointsEveryM(poletrak, 8), 1, true);
const pole_line2 = point_data2[0]
const pole_angle2 = point_data2[1]

// right_height, left_height, beamLength, beam_height
// const Poles2 = TSys.createCatenaryPole(2.8,2.8,3.5,2.3, 40)
// for(let i=0; i<Poles2.children.length; i++){
//   Poles2.children[i].rotation.y += pole_angle2[i]
//   Poles2.children[i].position.set(pole_line2[i].x,pole_line2[i].y,pole_line2[i].z)
// }
// scene.add(Poles2)

// 架線柱の配置(上野東京ライン)
const margin_data = TSys.RailMargin(TSys.getPointsEveryM(J_UJT_downbound, 9.5), 1, true);
const margin = margin_data[0]
const margin_angle = margin_data[1]
const pole = LoadModels[3]
for(let i=0; i<margin.length; i++){
  let clone_pole = pole.clone()
  clone_pole.rotation.y += margin_angle[i] + 90*Math.PI/180
  const i_margin = margin[i]
  // console.log(i_margin)
  clone_pole.position.set(i_margin.x,i_margin.y+1.1,i_margin.z)
  scene.add(clone_pole)
}


// 桁橋 実装中
TSys.placeGirderBridge(bridge_2,bridge_3,9,2)

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
exhibition_tyuou.visible = true;   // 再表示する
exhibition_soubu.position.set(13,0.8,15)
exhibition_soubu.visible = true;   // 再表示する

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

document.getElementById("toggle-crossover").addEventListener("click", () => {
  startQuadrupleCrossDemo();
});

document.getElementById("toggle-crossover").addEventListener("touchstart", () => {
  startQuadrupleCrossDemo();
});

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

// 物体描画
const cube_geometry = new THREE.BoxGeometry();
const cube_material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(cube_geometry, cube_material);
let targetObjects = [];
const targetPins = [];

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
  const element = canvas;
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
}

// 物体の表示/非表示
function setMeshListOpacity(list, opacity) {
  list.forEach((mesh) => {
    if (!mesh || !mesh.isMesh) { return; }

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

// 高架(柱/床版)を生成
const interval = 1
const Elevated_start = 0.32
const Elevated_end = 1
TSys.generateElevated(line_1, 10, interval);
TSys.generateElevated(sliceCurvePoints(line_2, Elevated_start, Elevated_end), 10, interval);
TSys.generateElevated(sliceCurvePoints(line_3, Elevated_start+0.02, Elevated_end), 10, interval);
TSys.generateElevated(line_4, 10, interval);

TSys.generateElevated(JB_d_elevated, 10, interval);
TSys.generateElevated(JB_u_elevated, 10, interval);

// TSys.createBridgeGirder(sliceCurvePoints(line_2, 0, Elevated_start), 10, interval);
// TSys.createBridgeGirder(sliceCurvePoints(line_3, 0, Elevated_start+0.02), 10, interval);

// 線路生成
TSys.createRail(line_1)
TSys.createRail(line_2)
TSys.createRail(line_3)
TSys.createRail(line_4)

TSys.createRail(JK_upbound)
TSys.createRail(JY_upbound)
TSys.createRail(JY_downbound)
TSys.createRail(JK_downbound)

TSys.createWall(JK_upbound, JK_downbound, 40,1,-1,0,0, 0x6d5c4e)

TSys.createRail(J_UJT_upbound)
TSys.createRail(J_UJT_downbound)
TSys.createWall(J_UJT_upbound, J_UJT_upbound, 40,0.9,0.9,0.8,0, 0xbbbbbb)
TSys.createWall(J_UJT_upbound, J_UJT_upbound, 40,1,1,0.8,0, 0xbbbbbb)
TSys.createWall(J_UJT_upbound, J_UJT_upbound, 40,1,0.9,0.8,0.8, 0xbbbbbb)
TSys.createWall(J_UJT_downbound, J_UJT_downbound, 40,-0.9,-0.9,0.8,0, 0xbbbbbb)

TSys.createRail(sinkansen_upbound)
TSys.createRail(sinkansen_downbound)

TSys.generateElevated(sinkansen_upbound, 10, interval);
TSys.generateElevated(sinkansen_downbound, 10, interval);
TSys.createWall(sinkansen_upbound, sinkansen_upbound, 40,0.9,0.9,0.8,0, 0x999999)
TSys.createWall(sinkansen_downbound, sinkansen_downbound, 40,-0.9,-0.9,0.8,0, 0x999999)

// TSys.sampleCurveCoordinates(sinkansen_upbound,{x: 187.35576904181207, y: 6.550897661798941, z: -335.1433442621323},0*Math.PI/180)//1.54)

TSys.generateElevated(J_UJT_downbound, 10, interval, sinkansen_downbound,J_UJT_upbound);
// TSys.generateElevated(J_UJT_upbound, 10, interval);

// markPointsWithPins(Points_1);

resetMeshListOpacity(targetObjects, Points_1);
setMeshListOpacity(targetObjects, 0);

// TSys.generateElevated(JK_upbound, 10, interval);

// const cube_clone = new THREE.Mesh(cube_geometry, cube_material.clone());
// cube_clone.position.set(point.x, point.y, point.z);
// scene.add(cube_clone);
// targetObjects.push(cube_clone);
// drawingObject();

// markPointsWithPins(JK_upbound_point);
// markPointsWithPins(JY_upbound_point);

// markPointsWithPins(JY_downbound_point);
// markPointsWithPins(JK_downbound_point);

// markPointsWithPins(J_UJT_upbound_point);
// markPointsWithPins(J_UJT_downbound_point);

// markPointsWithPins(sinkansen_upbound_point);
// markPointsWithPins(sinkansen_downbound_point);
// markPointsWithPins(Points_0);

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

const GuideGrid = new THREE.GridHelper(5, 10, 0x8888aa, 0x88aa88);
GuideGrid.name = "GuideGrid";
GuideGrid.position.set(0,0,0);
scene.add(GuideGrid);

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
GuideGrid_Center_x.visible = false
GuideGrid_Center_z.visible = false

console.log(new THREE.Vector3(5.5, y, -50))

let group_object = []
let group_targetObjects = []
let group_EditNow = 'None'

let choice_object = false
let search_object = false
let move_direction_y = false

let tiles = []
let pick_vertexs = [] // カスタムジオメトリ 頂点指定時の格納用
// search_point();

function getIntersectObjects(){

  // レイキャスト = マウス位置からまっすぐに伸びる光線ベクトルを生成
  raycaster.setFromCamera(mouse, camera);

  // その光線とぶつかったオブジェクトを得る
  return raycaster.intersectObjects(targetObjects, true);
};

let TargetDiff = [0,0]
// 毎フレーム時に実行されるループイベントです
async function search_point() {
  
  if (!search_object){return}

  // 画面上の光線とぶつかったオブジェクトを得る
  const intersects = getIntersectObjects();
  
  await sleep(80);

  if (intersects.length > 0) {
    // console.log('hit')
    if (choice_object != intersects[0].object){
      if (choice_object !== false){ 
        // 残像防止
        console.log('green')

        if (objectEditMode === 'CONSTRUCT' && !pick_vertexs.includes(choice_object.id)){
          choice_object.material.color.set(0xff0000)
        }

        GuideLine.visible = false
        GuideGrid.visible = false
      }

      // 物体の取得
      choice_object = intersects[0].object
      choice_object.material.color.set(0x00ff00)

      console.log(choice_object)

      if (move_direction_y){
        GuideLine.position.copy(choice_object.position)
        GuideLine.visible = true

      } else {
        GuideGrid.position.copy(choice_object.position)
        GuideGrid.material.color.set(0x88aa88)
        GuideGrid.visible = true
      }
    }

  } else {
    // console.log('not hit')
    if (choice_object !== false){
      if (objectEditMode === 'CONSTRUCT' && !pick_vertexs.includes(choice_object.id)){
        choice_object.material.color.set(0xff0000)
      }
      choice_object.material.color.set(0xff0000)
    }

    choice_object = false;
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

  if (objectEditMode === 'PICK' && intersects.length > 0) {
    const hit = intersects[0];           // 一番近いヒット
    console.log('hit.object =', hit.object);

    // top-level の targetObjects の要素を見つける（子メッシュから親を辿る）
    let top = hit.object;
    while (top && !targetObjects.includes(top)) {
      top = top.parent;                  // parent を辿っていく
    }

    const idx = top ? targetObjects.indexOf(top) : -1; // 見つからなければ -1
    console.log('targetObjects のインデックス:', idx);
    group_EditNow = idx

    // InstancedMesh の場合は instanceId があるかチェック
    if ('instanceId' in hit && hit.instanceId !== undefined) {
      console.log('InstancedMesh のインスタンス番号:', hit.instanceId);
      group_EditNow = hit.instanceId
    }
  }

  if (intersects.length > 0) {
    if (choice_object != intersects[0].object){
      if (choice_object !== false){ 
        // 残像防止
        choice_object.material.color.set(0xff0000)
        GuideLine.visible = false
        GuideGrid.visible = false
      }

      // 物体の取得
      choice_object = intersects[0].object
      choice_object.material.color.set(0x00ff00)

      if (move_direction_y){
        GuideLine.position.copy(choice_object.position)
        GuideLine.visible = true

      } else {
        GuideGrid.position.copy(choice_object.position)
        GuideGrid.material.color.set(0x88aa88)
        GuideGrid.visible = true
      }
    }
  

  } else {
    if (choice_object !== false){choice_object.material.color.set(0xff0000)}
    choice_object = false;

    dragging = false;
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
    point.x += TargetDiff[0]
    point.z += TargetDiff[1]

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
function handleDrag() {
  if (dragging != true) { return }

  let point = 0

  if (!move_direction_y){
    point = coord_DisplayTo3D(choice_object.position)
  } else {
    point = coord_DisplayTo3D(choice_object.position)
  }

  choice_object.position.set(point.x,point.y,point.z)

  GuideLine.position.set(point.x,point.y,point.z)
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

  if (OperationMode === 1 && (objectEditMode === 'MOVE_EXISTING' || objectEditMode === 'CONSTRUCT')){
  
    if (dragging != false){
      
      dragging = false;

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
      GuideGrid.visible = false;

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

      if (!mobile){
        search_point();
      }
    }
  }
}
  
async function handleMouseDown() {
  if (pause || OperationMode != 1) { return; }

  console.log('run')

  if (structureModeActive) {
    placeStructurePinnedPin();
    return;
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

    const point = coord_DisplayTo3D();
    const cube_clone = new THREE.Mesh(cube_geometry, cube_material.clone());
    if (editObject === 'RAIL' || editObject === 'CUSTOM'){

      cube_clone.position.set(point.x, point.y, point.z);
      // cube_clone.position.set(5.1567957781852725, 5.786358250355474, 37.50032584968354);
      scene.add(cube_clone);
      targetObjects.push(cube_clone);

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

    search_object = false
    await sleep(100);

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
      console.log('dragging started');

      GuideLine.visible = true
      if (!move_direction_y){
        GuideGrid.visible = true
      }
    };

    if (editObject === 'RAIL' && objectEditMode !== 'MOVE_EXISTING') {
      beginDragFromChoice();
      return;
    }

    if (objectEditMode === 'MOVE_EXISTING'){

      beginDragFromChoice();
    
    } else if (objectEditMode === 'CONSTRUCT'){
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

// Ensure resize uses unified handler
window.addEventListener('resize', onWindowResize, false);

export function UIevent (uiID, toggle){
  if ( uiID === 'see' ){ if ( toggle === 'active' ){
    console.log( 'see _active' )
    OperationMode = 0
    search_object = false
    choice_object = false
    dragging = false
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
    structureModeActive = true;
    structureSamplesDirty = true;
    updateStructureHover();
  } else {
    console.log( 'structure _inactive' )
    structureModeActive = false;
    structureHoverPoint = null;
    if (structureHoverPin) {
      structureHoverPin.visible = false;
    }
  }} else if ( uiID === 'poll' ){ if ( toggle === 'active' ){
  console.log( 'poll _active' )
  } else {
  console.log( 'poll _inactive' )
  }} else if ( uiID === 'new/2' ){ if ( toggle === 'active' ){
  console.log( 'new/2 _active' )
  } else {
  console.log( 'new/2 _inactive' )
  }} else if ( uiID === 'move/2' ){ if ( toggle === 'active' ){
  console.log( 'move/2 _active' )
  } else {
  console.log( 'move/2 _inactive' )
  }} else if ( uiID === 'x_z/2' ){ if ( toggle === 'active' ){
  console.log( 'x_z/2 _active' )
  } else {
  console.log( 'x_z/2 _inactive' )
  }} else if ( uiID === 'y/2' ){ if ( toggle === 'active' ){
  console.log( 'y/2 _active' )
  } else {
  console.log( 'y/2 _inactive' )
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
    targetObjects = group_object
    setMeshListOpacity(targetObjects, 1);

  } else {
    console.log( 'creat _inactive' )
    // targetObjects = []
    setMeshListOpacity(targetObjects, 0);
    editObject = 'Standby'

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

  // 視点
  if (e.touches.length === 1 && dragging === false) {
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
  } else if (e.touches.length >= 2 && dragging === false) {

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
let cameraAngleY = 0 * Math.PI / 180;  // 水平回転
let cameraAngleX = -10 * Math.PI / 180;  // 垂直回転
let moveVectorX = 0
let moveVectorZ = 0

camera.position.y += 15
camera.position.z = -10//-13
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

  renderer.render(scene, camera);

  if (dragging === true){
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
