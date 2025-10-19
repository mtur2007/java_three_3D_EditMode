// main.js

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

const scene = new THREE.Scene();
import { TrainSystem } from './train_system.js';
const TSys = new TrainSystem(scene);

import { WorldCreat } from './world_creat.js';

// 駅(ホームドア)を生成
const train_width = 6.8
const car_Spacing = 0.15

console.log('WorldCreat')
let geo = await WorldCreat(scene, train_width, car_Spacing);
console.log('geo : ',geo)

// world_creat()

const dirLight = scene.getObjectByName('dirLight');

const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

// ----------------- シャドウを有効化（renderer を作った直後あたりに入れる） -----------------
renderer.shadowMap.enabled = true;                         // シャドウを有効化
renderer.shadowMap.type = THREE.PCFSoftShadowMap;         // ソフトシャドウ（見た目良し・負荷中）
renderer.outputColorSpace = THREE.SRGBColorSpace;         // 既存の行があるなら残す

// --- マップの半自動作成(路線設定) ---

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

loader.load('textures/night.jpg', (texture_night) => {
  texture_night.mapping = THREE.EquirectangularReflectionMapping;
  texture_night.colorSpace = THREE.SRGBColorSpace;
  // scene.background = texture_night;
  // scene.environment = texture_night;
  envMapNight = texture_night ;
});

// envMap = envMapNight

scene.background = envMapNight;
scene.environment = envMapNight;

scene.background = envMap;
scene.environment = envMap;

renderer.toneMappingExposure = 1;

// --- ライト追加（初回のみ） ---
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

// --- 昼夜切替 ---
let isNight = false;

const toggleBtn = document.getElementById("toggle-daynight");

toggleBtn.addEventListener("click", () => {
  isNight = !isNight;

  if (isNight) {
    // 🌙 夜モード
    scene.background = envMapNight;
    scene.environment = envMapNight;
    
    dirLight.visible = false;
    ambient.visible = false;

    toggleBtn.textContent = "☀️ 昼にする";

  } else {
    // ☀️ 昼モード
    scene.background = envMap;
    scene.environment = envMap;

    dirLight.visible = true;
    ambient.visible = true;

    toggleBtn.textContent = "🌙 夜にする";
  }
});

toggleBtn.addEventListener("touchstart", () => {
  isNight = !isNight;

  if (isNight) {
    // 🌙 夜モード
    scene.background = envMapNight;
    scene.environment = envMapNight;

    dirLight.visible = false;
    ambient.visible = false;

    toggleBtn.textContent = "☀️ 昼にする";

  } else {
    // ☀️ 昼モード
    scene.background = envMap;
    scene.environment = envMap;

    dirLight.visible = true;
    ambient.visible = true;

    toggleBtn.textContent = "🌙 夜にする";
  }
});

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);

document.body.appendChild(renderer.domElement);

let run_STOP = false
let quattro = 0
let run_num = 0

// --- エスカレーター ---
let path_x = 2.8
let path_y = 6.536
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

// パンタフラフ ¯¯"<"¯¯
function createPantograph(Arm_rotation_z) {
  const pantograph = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial(metal_material);

  const Arm_len = 0.45
  const Arm_X_len = Math.sin(Arm_rotation_z)*Arm_len*0.5
  const Arm_Y_len = Math.cos(Arm_rotation_z)*Arm_len
  // 下アーム
  const lowerArm = new THREE.Mesh(new THREE.BoxGeometry(0.02, Arm_len, 0.02), mat);
  lowerArm.rotation.z = Arm_rotation_z;
  lowerArm.position.set(0, Arm_Y_len*0.5, 0);
  pantograph.add(lowerArm);

  const lowerArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.004, Arm_len-0.1, 0.004), mat);
  lowerArm2.rotation.z = Arm_rotation_z-0.065;
  lowerArm2.position.set(-0.07,(Math.cos(Arm_rotation_z-0.065)*(Arm_len-0.1)*0.5), 0);
  pantograph.add(lowerArm2);

  // 上アーム（斜め）
  const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.02, Arm_len, 0.02), mat);
  upperArm.rotation.z = -Arm_rotation_z;
  upperArm.position.set(0, Arm_Y_len*1.5, 0);
  pantograph.add(upperArm.clone());

  const upperArm2 = new THREE.Mesh(new THREE.BoxGeometry(0.004, Arm_len-0.02, 0.004), mat);
  upperArm2.rotation.z = -(Arm_rotation_z-0.065);
  upperArm2.rotation.y = 0.27;
  upperArm2.position.set(+0.03, Arm_Y_len*1.5-0.02, -0.045);
  pantograph.add(upperArm2.clone());

  const upperArm3 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), mat);
  upperArm3.rotation.z = -(Arm_rotation_z-0.35);
  upperArm3.position.set(-0.19, Arm_Y_len-0.015, 0);
  pantograph.add(upperArm3.clone());


  pantograph.rotation.y = Math.PI / 2;
  // 接触板
  const contactGroup = new THREE.Group();
  const contact = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.5), new THREE.MeshStandardMaterial(metal_material));
  contact.position.set(Arm_X_len-0.02, Arm_Y_len*2,0);
  contactGroup.add(contact.clone());
  contact.position.set(Arm_X_len+0.02, Arm_Y_len*2,0);
  contactGroup.add(contact.clone());

  const contact_rotation_x = Math.PI / 3
  const contact_Y_len = Math.sin(contact_rotation_x)*0.1*0.5
  const contact_X_len = Math.cos(contact_rotation_x)*0.1*0.5

  const contact2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.1), new THREE.MeshStandardMaterial(metal_material));
  contact2.rotation.x = contact_rotation_x
  contact2.position.set(Arm_X_len, Arm_Y_len*2-contact_Y_len, 0.25+contact_X_len);
  contactGroup.add(contact2.clone());

  contact2.rotation.x = -contact_rotation_x
  contact2.position.x = Arm_X_len
  contact2.position.z = -(0.25+contact_X_len);
  contactGroup.add(contact2.clone());

  contactGroup.position.x = -0.05
  pantograph.add(contactGroup.clone())
  contactGroup.position.x = 0.05
  pantograph.add(contactGroup.clone())
  return pantograph;
}

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
  console.log(geo)

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

    // ▼ 車両の位置を z 方向にずらす（中央起点）
    const spacing = 6.95; // 車両の長さと同じだけ間隔を空ける
    car.position.z = - i * spacing;

    // const light = new THREE.PointLight(0xffffff, 2, 3);
    // light.position.set(0,0,0);
    // car.add(light);

    if (i === 0){
      const headlight = new THREE.SpotLight(0xfff5e1, 7);
      headlight.angle = Math.PI / 8;
      headlight.penumbra = 0.2;
      headlight.distance = 10;
      headlight.decay = 1;
      headlight.castShadow = false;

      headlight.position.set(0, -0.3, 1);  // 先頭部に合わせて調整（電車前方向に）
      car.add(headlight);
      car.add(headlight.target);   // スポットライトはtargetが必須
      headlight.target.position.set(0, 0, 4);  // 向き（車両前方）に合わせて調整

      // const light = new THREE.PointLight(0xffffff, 3, 5);
      // light.position.set(0,0,0);
      // car.add(light);

    } 
    
    // ▼ パンタグラフ設置（例: 1, 4, 7 両目など）
    if (i % 3 === 1) {
      const pantograph = createPantograph(Math.PI / 2.7);
      pantograph.position.set(0, 0.5, 2.8);
      car.add(pantograph);

      const pantograph2 = createPantograph(Math.PI / -2.1);
      pantograph2.position.set(0, 0.5, -2.8);
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
async function runTrain(trainCars, root, track_doors, door_interval, max_speed=0.002, add_speed=0.000005, stop_point=0.5, start_position = 0) {

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
  let stop_point_diff = 0

  while (speed >= 0){
    speed -= add_speed
    stop_point_diff += speed};
  
  const brake_point = stop_point - stop_point_diff

  speed = max_speed
  
  let train_stoped = false
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
  await sleep( 1000 + Math.random() * 15000);
  trainCars.visible = true;   // 再表示する

  async function runCar() {
    if (t >= 1 + maxOffsetT) {
      
      if (quattro > 0){
        quattro -= 1
        run_num -= 1
        return
      };

      speed = max_speed
      train_stoped = false
      t = 0
      await sleep( 1000 + Math.random() * 20000);
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
        
        if (i === 0 & isNight){
          if (Pos.z <= -20) {
            front_right.visible = true;
          } else {
            front_right.visible = false;
          }
        } else if (!isNight) {front_right.visible = false}
      
        car = trainCars.userData.cars[i]; // ← ここだけ変わる
        car.position.copy(Pos);
        car.lookAt(Pos.clone().add(Tan));
      
      }

      if (train_stoped === false && t > brake_point){
        speed -= add_speed;
      } else {
        speed += add_speed
        if (speed >= max_speed){speed = max_speed}
      }
      
      t += speed;

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
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let y = 0
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


y = 6
const x_plus = 10
const z_plus = 0
const points = [
  new THREE.Vector3(7+x_plus, y+0.7, -140.601+z_plus),
  new THREE.Vector3(0.312+x_plus, y+0.5, -104.023+z_plus),
  new THREE.Vector3(-14.196+x_plus, y+2.3, -146.858+z_plus),
  new THREE.Vector3(-4.561+x_plus, y+2.3, -109.569+z_plus),
  new THREE.Vector3(-15.657+x_plus, y+2.3, -146.520+z_plus),
  new THREE.Vector3(-6.022+x_plus, y+2.3, -109.232+z_plus),
  new THREE.Vector3(5+x_plus, y+0.4, -140.151+z_plus),
  new THREE.Vector3(-5.198+x_plus, y-0.5, -107.883+z_plus),
]

// --- JR中央線 track1 ---
Points_0 = [
  points[0],
  points[1],
  new THREE.Vector3(5.5, y, -50),
  new THREE.Vector3(4.8, y, -30),
  new THREE.Vector3(4.8, y, 50),     // お茶の水駅上空
  new THREE.Vector3(3,y, 90), // 高架にする（y = 5）
];
// --- JR総武線 track2 ---
Points_1 = [
  new THREE.Vector3(-11.3, y+2.3, -170),
  points[2],
  points[3],
  new THREE.Vector3(3-0.5, y, -50),
  new THREE.Vector3(0.8, y, -25),
  new THREE.Vector3(0.8, y, 50),
  new THREE.Vector3(-2, y, 90),
];

// --- JR総武線 track3 ---
Points_2 = [
  new THREE.Vector3(-13.3, y+2.3, -170),
  points[4],
  points[5],
  new THREE.Vector3(1, y, -50),
  new THREE.Vector3(-0.8, y, -20),
  new THREE.Vector3(-0.8, y, 50),     // お茶の水駅上空
  new THREE.Vector3(-4,y, 90), // 高架にする（y = 5）
];

// --- JR中央線 track4 ---
Points_3 = [ 
  points[6],
  points[7],
  new THREE.Vector3(-2.5, y, -50),
  new THREE.Vector3(-4.8, y, -20),
  new THREE.Vector3(-4.8, y, 40),
  new THREE.Vector3(-9, y, 90),
];

// --- JR京浜東北線(JK) 上り(upbound) ---
JK_upbound_point = [
  new THREE.Vector3(-111.76990362335863, y+0, -295.55533787884985),
  new THREE.Vector3(-89.28536046011544, y+0, -298.1541893646885),
  new THREE.Vector3(-57.711307454803375, y+0, -301.1911328283426),
  new THREE.Vector3(-4.018352121806821, y+0, -311.1907667542943),
  new THREE.Vector3(37.11147026940992, y+0, -321.31858416862843),
  new THREE.Vector3(61.76861895808672, y+0, -325.94921343406867),
  new THREE.Vector3(96.96201204744818, y+0, -329.0490279551624),
  new THREE.Vector3(162.70344013787383, y+0, -328.0021231693154),
  new THREE.Vector3(247.85810344992842, y+0, -323.93439483106204),
  new THREE.Vector3(287.7631243456569, y+0, -319.77343263388633),
  new THREE.Vector3(324.5430417668258, y+0, -317.28342052560583),
  new THREE.Vector3(368.5693719852972, y+0, -316.4539250192787),
  new THREE.Vector3(394.06074396630294, y+0, -317.7655486002887),
];


JY_upbound_point = [
  new THREE.Vector3(-125.21339859227305, y+0, -296.69577623835823),
  new THREE.Vector3(-94.8777375074411, y+0, -300.3658537739735),
  new THREE.Vector3(-80.2605922089954, y+0, -302.6421916314635),
  new THREE.Vector3(-60.97801415541439, y+0, -305.76947418492296),
  new THREE.Vector3(-5.442546655264097, y+0, -315.8814542201736),
  new THREE.Vector3(35.41232161533707, y+0, -323.75981941243475),
  new THREE.Vector3(61.197688730203055, y+0, -327.55845607928376),
  new THREE.Vector3(96.51938083502435, y+0, -330.48356730370244),
  new THREE.Vector3(162.21662969199488, y+0, -329.3996829195323),
  new THREE.Vector3(247.4301434594096, y+0, -325.4854096663424),
  new THREE.Vector3(288.9963926349608, y+0, -323.33523864671946),
  new THREE.Vector3(323.88760471246167, y+0, -320.7344575653564),
  new THREE.Vector3(368.30682704399777, y+0, -318.2831628078685),
  new THREE.Vector3(394.09187011088176, y+0, -319.4755886056227),
];


JY_downbound_point = [
  new THREE.Vector3(-122.17215393661779, y+0, -298.8925460232571),
  new THREE.Vector3(-80.42881516425733, y+0, -304.82795056563515),
  new THREE.Vector3(-5.826757239045998, y+0, -318.15368741852643),
  new THREE.Vector3(34.84569022775433, y+0, -325.76125009407633),
  new THREE.Vector3(60.79020296479766, y+0, -329.30590534698786),
  new THREE.Vector3(96.18968993409968, y+0, -332.07909452761186),
  new THREE.Vector3(161.91727922480115, y+0, -330.9822439341698),
  new THREE.Vector3(247.10434070276528, y+0, -327.26442699646265),
  new THREE.Vector3(289.0982280344045, y+0, -325.2560382392302),
  new THREE.Vector3(356.8688576378576, y+0, -322.30395429003124),
  new THREE.Vector3(399.59040208745387, y+0, -320.1676357058684),
];

JK_downbound_point = [
  new THREE.Vector3(-124.43022443921315, y+0, -300.3020874375335),
  new THREE.Vector3(-81.16116758122712, y+0, -309.17838157877924),
  new THREE.Vector3(-61.176654786959716, y+0, -313.612216326006),
  new THREE.Vector3(8.215521387265273, y+0, -325.5308680196141),
  new THREE.Vector3(94.9341065540915, y+0, -333.71399243406285),
  new THREE.Vector3(161.62389558698544, y+0, -332.71128002847263),
  new THREE.Vector3(221.4487986731928, y+0, -330.9206960719724),
  new THREE.Vector3(263.70157276228207, y+0, -331.7715381178346),
  new THREE.Vector3(289.02060154904507, y+0, -331.68351199544094),
  new THREE.Vector3(324.6413521542111, y+0, -327.6754938537136),
  new THREE.Vector3(357.5320762061322, y+0, -323.7494132257973),
  new THREE.Vector3(399.1569336423814, y+0, -321.6563331013228),
];

J_UJT_upbound_point = [
  new THREE.Vector3(-120.01522869733687, y+0, -302.9188732688797),
  new THREE.Vector3(-82.09186013719402, y+0, -310.7281630112079),
  new THREE.Vector3(-58.947028586666164, y+0, -316.1657368440674),
  new THREE.Vector3(8.489518914759882, y+0, -327.4768270890304),
  new THREE.Vector3(94.98860814005752, y+0.789958964891393, -335.41675188918447),
  new THREE.Vector3(170.61735648548975, y+2.631426048102636, -334.0304355439938),
  new THREE.Vector3(231.00421612962472, y+3.2085414706180426, -332.4570173414121),
  new THREE.Vector3(266.3810561630889, y+3.695212192977211, -333.2835940670695),
  new THREE.Vector3(291.88024877381997, y+3.387685383703271, -332.51227713636956),
  new THREE.Vector3(327.45730771861037, y+3.368951525840888, -328.6081402659737),
  new THREE.Vector3(366.6797428823438, y+2.6516091213290274, -324.7058647644941),
  new THREE.Vector3(404.0778447587348, y+2.1572608865051848, -322.15962385213055),
];

J_UJT_downbound_point = [
  new THREE.Vector3(-119.77980725578028, y+0, -304.61572140275007),
  new THREE.Vector3(-83.35126362095043, y+0, -312.1580862515084),
  new THREE.Vector3(-59.48419187511876, y+0, -317.925500389709),
  new THREE.Vector3(8.799902422258866, y+0, -329.33207033365204),
  new THREE.Vector3(94.72769020659211, y+0.789958964891393, -337.06032212652366),
  new THREE.Vector3(172.4969543843784, y+2.631426048102636, -335.53647208749794),
  new THREE.Vector3(230.72892309903594, y+3.2085414706180426, -334.19845517414586),
  new THREE.Vector3(266.588538621058, y+3.695212192977211, -335.01404080819106),
  new THREE.Vector3(292.0234571425137, y+3.3876853837032694, -334.68245942245693),
  new THREE.Vector3(328.14684315034026, y+3.368951525840888, -330.6026061310047),
  new THREE.Vector3(366.5493245858342, y+2.6516091213290274, -326.2626751173474),
  new THREE.Vector3(404.5031641357191, y+2.1572608865051848, -323.870955377407),
];

sinkansen_upbound_point = [
  new THREE.Vector3(-117.80038662122091, y-1.1378560032556138, -308.0822973340168),
  new THREE.Vector3(-43.804755338386585, y-1.2589600310431734, -325.73815144008734),
  new THREE.Vector3(-12.249485519096753, y-0.8082158373489516, -331.030730959448),
  new THREE.Vector3(29.164320175824187, y-0.2065329936222744, -335.9110014242368),
  new THREE.Vector3(96.17907740615152, y+0, -340.3307306113299),
  new THREE.Vector3(148.0044984457235, y+0.2261471373060342, -338.2284969602672),
  new THREE.Vector3(185.49776590926083, y+0.495248588404289, -334.9896528965828),
  new THREE.Vector3(227.06322572615449, y+1.2280396483740894, -333.5313586165467),
  new THREE.Vector3(262.9788547470736, y+1.2520147649648683, -334.33302915427737),
  new THREE.Vector3(290.7642685239293, y+1.154187254070644, -334.37698409462143),
  new THREE.Vector3(325.49879946980997, y+0.788423129441572, -330.561524390554),
  new THREE.Vector3(366.3108366923121, y+0.257075531569086, -327.20410351982184),
  new THREE.Vector3(406.3293279112425, y+0, -327.2559831011056),
];
  
sinkansen_downbound_point = [
  new THREE.Vector3(-117.91571602764624, y-1.1378560032556138, -310.02676011747116),
  new THREE.Vector3(-43.710394568340334, y-1.2589600310431734, -327.56791979462525),
  new THREE.Vector3(-11.897866325379892, y-0.8082158373489516, -332.70875051820747),
  new THREE.Vector3(29.680698889210568, y-0.2065329936222744, -337.6380230626265),
  new THREE.Vector3(96.51592973835274, y+0, -342.0452285480721),
  new THREE.Vector3(147.98442160890954, y+0.2261471373060342, -339.9166111836655),
  new THREE.Vector3(185.0950260588999, y+0.495248588404289, -336.8849097480831),
  new THREE.Vector3(226.33041713930058, y+1.2280396483740894, -335.3565345694915),
  new THREE.Vector3(262.5745484664577, y+1.2520147649648683, -336.160613390138),
  new THREE.Vector3(290.7558015205605, y+1.154187254070644, -336.41475365974344),
  new THREE.Vector3(325.8841863700687, y+0.788423129441572, -332.2026513481826),
  new THREE.Vector3(367.3440010679313, y+0.257075531569086, -329.3563162418554),
  new THREE.Vector3(406.0943207437069, y+0, -329.2244867534149),
];


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

const station_s = { x:1.9018166962470082, y:6.394628223749855 , z:-49.67098084774971 }
const station_loof_f = { x:-0.3852393328186856 , y:6.394628223749855 , z:-3.535125641715606 }
const station_f = { x:-0.023948863771414863, y:6.394628223749855, z:47.51354120550737 }
const wall_f = {x:3.5989745081382956, y:6.394628223749855, z:-97.26135689524132}
const tunnel_f ={ x: 6.600868195728852, y: 7.382920205399699, z: -114.92055445840528}

const track1 = findCurveRange(line_1, station_s, station_f)
const track2 = findCurveRange(line_2, station_s, station_f)
const track3 = findCurveRange(line_3, station_s, station_f)
const track4 = findCurveRange(line_4, station_s, station_f)

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

TSys.createTrack(line_1, 1.83, 0x000000)
TSys.createTrack(line_2, 1.83, 0x000000)

TSys.createTrack(line_3, 1.83, 0x000000)
TSys.createTrack(line_4, 1.83, 0x000000)

// 高架(柱/床版)を生成
const interval = 1
const Elevated_start = 0.32
const Elevated_end = 1
TSys.generateElevated(line_1, 10, interval);
TSys.generateElevated(sliceCurvePoints(line_2, Elevated_start, Elevated_end), 10, interval);
TSys.generateElevated(sliceCurvePoints(line_3, Elevated_start+0.02, Elevated_end), 10, interval);
TSys.generateElevated(line_4, 10, interval);

TSys.createBridgeGirder(sliceCurvePoints(line_2, 0, Elevated_start), 10, interval);
TSys.createBridgeGirder(sliceCurvePoints(line_3, 0, Elevated_start+0.02), 10, interval);

// 線路生成
TSys.createRail(line_1)
TSys.createRail(line_2)
TSys.createRail(line_3)
TSys.createRail(line_4)

// 駅(プラットホーム)を生成
TSys.createStation(track1,track2,200,y,0.7, '|[]|') // 島式 |[]| : 相対式 []||[]
TSys.createStation(track3,track4,200,y,0.7, '|[]|') // 島式 |[]| : 相対式 []||[]

// 駅(屋根)を生成
TSys.placePlatformRoof(roof_track1,roof_track2,y+1.4,10)
TSys.placePlatformRoof(roof_track3,roof_track4,y+1.4,10)

const door_interval = train_width + car_Spacing
const track1_doors = TSys.placePlatformDoors(track1, 0.9, door_interval, 'left');  // 左側に設置
const track2_doors = TSys.placePlatformDoors(track2, 0.9, door_interval, 'right');  // 左側に設置

const track3_doors = TSys.placePlatformDoors(track3, 0.9, door_interval, 'left');  // 左側に設置
const track4_doors = TSys.placePlatformDoors(track4, 0.9, door_interval, 'right');  // 左側に設置

// 壁の生成
TSys.createWall(wall_track1,wall_track2,40,0.85,-0.85, 0.1, 0.1)
TSys.createWall(wall_track3,wall_track4,40,0.85,-0.85, 0.1, 0.1)

const quantity = 3

TSys.createWall(tunnel_1,tunnel_1,40,-0.9,-0.9,0,2.2)
TSys.createWall(tunnel_1,tunnel_1,40,0.9,0.9,0,2.2)

TSys.createWall(line_4,line_4,40,0.885,2,0,-4) // 線路側:壁
TSys.createWall(line_4,line_4,40,10,10,-4,-3) // 対岸側:壁
TSys.createWall(line_4,line_4,40,10,30,-3,-3) // 対岸側:地面

const water_material = new THREE.MeshStandardMaterial({
  color: 0x005555,         // 白ベース
  metalness: 0.3,          // 完全な金属
  roughness: 0,          // 少しザラつき（0.0だと鏡面すぎる）
  envMapIntensity: 1,    // 環境マップの反射強度（あるとリアル）
  side: THREE.DoubleSide   // 両面描画（必要なら）
});
TSys.createWall(line_4,line_4,40,2,10,-4,-4,0x003355,water_material)

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
  mesh.position.y = 6.25; // 高さ1.5に移動

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

const poletrak = sliceCurvePoints(line_3, 0, 0.8);
const point_data2 = TSys.RailMargin(TSys.getPointsEveryM(poletrak, 8), 1, true);
const pole_line2 = point_data2[0]
const pole_angle2 = point_data2[1]

// right_height, left_height, beamLength, beam_height
const Poles2 = TSys.createCatenaryPole(2.8,2.8,3.5,2.3, 16)
for(let i=0; i<Poles2.children.length; i++){
  Poles2.children[i].rotation.y += pole_angle2[i]
  Poles2.children[i].position.set(pole_line2[i].x,pole_line2[i].y,pole_line2[i].z)
}
scene.add(Poles2)

// 桁橋 実装中
TSys.placeGirderBridge(sliceCurvePoints(line_2, 0.24, 0.32),sliceCurvePoints(line_3, 0.25, 0.34),8,2)

// 電車の運行
// const max_speed = 0.001 // 制限速度(最高)
// const add_speed = 0.0000010 // 追加速度(加速/減速)
const max_speed = 0.0004 // 制限速度(最高)
const add_speed = 0.000001 // 追加速度(加速/減速)

const exhibition_tyuou = TrainSettings(
  train_width,
  0xa15110,
  12,
  1,
);

const exhibition_soubu = TrainSettings(
  train_width,
  0xaaaa00,
  10,
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

const reversedCurve_3 = new THREE.CatmullRomCurve3(
  line_3.getPoints(100).reverse()
);

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

runTrain(Train_1, line_1, track1_doors, door_interval, max_speed, add_speed, 0.7695)
runTrain(Train_2, line_2, track2_doors, door_interval, max_speed, add_speed, 0.777)
runTrain(Train_3, reversedCurve_3, track3_doors, door_interval, max_speed, add_speed, 0.501)
runTrain(Train_4, reversedCurve_4, track4_doors, door_interval, max_speed, add_speed, 0.5439)

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
    const offset = new THREE.Vector3(0, 0.2, 3.4);
    offset.applyQuaternion(quaternion);

    camera.position.copy(position).add(offset);

    // === 🔽 Yaw / Pitch で視線方向を調整 ===
    const yaw = Math.atan2(direction.x, direction.z);   // Y軸回転（左右）
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
  // canvas要素上のXY座標
  const clientX = x - element.offsetLeft;
  const clientY = y - element.offsetTop;
  // canvas要素の幅・高さ
  const w = element.offsetWidth;
  const h = element.offsetHeight;
  // -1〜+1の範囲で現在のマウス座標を登録する
  mouse.x = ( clientX / w ) * 2 - 1;
  mouse.y = -( clientY / h ) * 2 + 1;
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

TSys.createRail(JK_upbound)
TSys.createRail(JY_upbound)
TSys.createRail(JY_downbound)
TSys.createRail(JK_downbound)

TSys.createWall(JK_upbound, JK_downbound, 40,1,-1,0,0, 0x6d5c4e)

TSys.createRail(J_UJT_upbound)
TSys.createRail(J_UJT_downbound)
TSys.createWall(J_UJT_upbound, J_UJT_upbound, 40,0.9,0.9,0.8,0, 0x999999)
TSys.createWall(J_UJT_downbound, J_UJT_downbound, 40,-0.9,-0.9,0.8,0, 0x999999)

TSys.createRail(sinkansen_upbound)
TSys.createRail(sinkansen_downbound)

TSys.generateElevated(sinkansen_upbound, 10, interval);
TSys.generateElevated(sinkansen_downbound, 10, interval);
TSys.createWall(sinkansen_upbound, sinkansen_upbound, 40,0.9,0.9,0.8,0, 0x999999)
TSys.createWall(sinkansen_downbound, sinkansen_downbound, 40,-0.9,-0.9,0.8,0, 0x999999)

// TSys.sampleCurveCoordinates(sinkansen_upbound,{x: 187.35576904181207, y: 6.550897661798941, z: -335.1433442621323},0*Math.PI/180)//1.54)

TSys.generateElevated(J_UJT_downbound, 10, interval, sinkansen_downbound);
TSys.generateElevated(J_UJT_upbound, 10, interval);

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


// レイキャストを作成
const raycaster = new THREE.Raycaster();
// resetMeshListOpacity(targetObjects, JK_downbound_point);
// setMeshListOpacity(targetObjects, 0);

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

  clean_object(['DeckSlab','Pillar','Rail','OBJECT' + group_EditNow])
  if (targetObjects.length < 2){return}

  const Points = targetObjects.map(obj => obj.position.clone());

  // console.log(Points)

  // 指定したポイントから線(線路の軌道)を生成
  const line = new THREE.CatmullRomCurve3(Points);


  // TSys.generateElevated(line, 5, 1);
  if (editObject === 'ORIGINAL'){
    if (dragging){
      TSys.createTrack(line, 0, 0x00ff00, 'Rail')
    } else {
      const mesh = TSys.createBoxBetweenPoints3D(Points[0], Points[1], 0.1, 0.1)
      mesh.name = 'OBJECT' + group_EditNow
      group_object[group_EditNow] = mesh
      scene.add(mesh)
    }
  }else{
    TSys.createRail(line, true)
  }
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
    console.log('green_clean')
    if (choice_object !== false){
      if (objectEditMode === 'CONSTRUCT' && !pick_vertexs.includes(choice_object.id)){
        choice_object.material.color.set(0xff0000)
      }
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
        console.log('1_green')
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
    console.log('1_green_clean')
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

        // console.log(targetObjects)

        // if (editObject === 'ORIGINAL'){}
        choice_object.position.set(point.x,point.y,point.z)
        choice_object.material.color.set(0xff0000) // Reset color to red
      }

      GuideLine.visible = false;
      GuideGrid.visible = false;

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
  if (objectEditMode === 'MOVE_EXISTING' || objectEditMode === 'PICK' || objectEditMode === 'CONSTRUCT'){

    search_object = false
    await sleep(100);

    const answer = await onerun_search_point();
    if (answer === false){
      return;
    }

    if (objectEditMode === 'MOVE_EXISTING'){

      const pos = camera.position
      if (move_direction_y === false){
        let set_y = choice_object.position.y

        raycaster.setFromCamera(mouse, camera);
        const dir = raycaster.ray.direction

        const t = Math.abs((pos.y - set_y)/dir.y)
        
        // 交点を計算
        TargetDiff = [
          choice_object.position.x - (pos.x + dir.x * t),
          choice_object.position.z - (pos.z + dir.z * t)
        ];
      } else {
        raycaster.setFromCamera(mouse, camera);
        const dir = raycaster.ray.direction

        const mouAngleY = cameraAngleY - Math.atan2(dir.x,dir.z) // マウスを3d世界の座標のベクトルに変換
        const diff = {x: choice_object.position.x - pos.x, z: choice_object.position.z - pos.z}
        const hypotenuse = Math.cos(Math.atan2(diff.x, diff.z) - cameraAngleY) * Math.sqrt(diff.x**2 + diff.z**2)
        
        // console.log('• • : '+'x, '+diff.x+'z, '+diff.z)
        // console.log('•-• : '+hypotenuse)
        // console.log('_./ : '+mouAngleY + ' x,'+ Math.sin(mouAngleY) + ' y,'+Math.cos(mouAngleY))
        // console.log('--,-: '+(hypotenuse/Math.cos(mouAngleY))*Math.cos(mouAngleY),hypotenuse/Math.cos(mouAngleY)*dir.y)
        
        const t = hypotenuse/(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x)//,dir.z
        
        // console.log('/ : '+hypotenuse+' '+Math.floor(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x))
        // console.log('t : '+t)
      
        // 交点を計算
        TargetDiff = choice_object.position.y - (pos.y + dir.y * t) 
      }

      choice_object.material.color.set(0x0000ff)
      
      dragging = true;
      
      GuideLine.visible = true
      if (!move_direction_y){
        GuideGrid.visible = true
      }
    
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

// リサイズ変更
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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
    setMeshListOpacity(targetObjects, 1);
    editObject = 'RAIL'
 
  } else {
    console.log( 'rail _inactive' )
    setMeshListOpacity(targetObjects, 0);
    search_object = false
    move_direction_y = false
    editObject = 'Standby'

  }} else if ( uiID === 'new' ){ if ( toggle === 'active' ){
    console.log( 'new _active' )
    objectEditMode = 'CREATE_NEW'
    search_object = false

  } else {
    console.log( 'new _inactive' )

  }} else if ( uiID === 'move' ){ if ( toggle === 'active' ){
    console.log( 'move _active' )
    objectEditMode = 'MOVE_EXISTING'

    search_object = true
    search_point();

  } else {
    console.log( 'move _inactive' )
    search_object = false
    move_direction_y = false

    objectEditMode = 'Standby'

  }} else if ( uiID === 'x_z' ){ if ( toggle === 'active' ){
    console.log( 'x_z _active' )
    move_direction_y = false
  } else {
    console.log( 'x_z _inactive' )
    search_object = false
  }} else if ( uiID === 'y' ){ if ( toggle === 'active' ){
    console.log( 'y _active' )
    move_direction_y = true
  } else {
    console.log( 'y _inactive' )
    search_object = false
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

const ctrl_ui = document.getElementById("controller")
let lastPosition1 = { x: 0, y: 0 };

const ctrlX = 160
const ctrlY = canvas.height - 60 - 80
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

// ジョイコン or 視点 判定 : 物体移動開始
window.addEventListener('mousedown', handleMouseDown);

window.addEventListener('touchstart', (e) => {

  // UI監視
  const touch = e.touches[0];
  handleMouseMove(touch.clientX, touch.clientY);
  
  // 視点
  search_ctrl_num(e)
  if (e.changedTouches[0].identifier != ctrl_id && e.touches.length <= 2){
  lastPosition1 = { x: e.touches[e.touches.length-1].clientX, y: e.touches[e.touches.length-1].clientY }
  }

  // --- 編集モード
  if (OperationMode === 0){return}
  e.preventDefault();      // ← スクロールを止める
  if (objectEditMode === 'MOVE_EXISTING') { 
    dragging = null//'stand_by';
    onerun_search_point();
  }

  handleMouseDown();      // ← 同じ関数に渡している

}, { passive: false });


// 位置&視点 操作 : 物体移動追尾
document.addEventListener('mousemove', (e) => {
  
  // UI監視 編集モード
  handleMouseMove(e.clientX, e.clientY);
  handleDrag();
});

document.addEventListener('touchmove', (e) => {
  e.preventDefault();

  // UI監視
  const touch = e.touches[0];
  handleMouseMove(touch.clientX, touch.clientY);

  // console.log('see'+ dragging)

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
document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

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
  requestAnimationFrame(animate);

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

  // メインカメラ：画面全体
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(true);

  renderer.render(scene, camera); 

  if (dragging === true){
    const pos = choice_object.position
    cameraSub.position.set(pos.x-Math.sin(cameraAngleY)*0.2,pos.y+5,pos.z-Math.cos(cameraAngleY)*0.2)

    cameraSub.lookAt(pos.x,pos.y,pos.z)
    // サブカメラ：画面右下に小さく表示
    const insetWidth = window.innerWidth / 4;  // 画面幅の1/4サイズ
    const insetHeight = window.innerHeight / 4; // 画面高の1/4サイズ
    const insetX = 110; // 右下から10pxマージン
    const insetY = window.innerHeight - insetHeight - 100; // 下から10pxマージン

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
}

animate();
