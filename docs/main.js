import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169/build/three.module.js';
import { ARButton } from 'https://cdn.jsdelivr.net/npm/three@0.169/examples/jsm/webxr/ARButton.js';

const canvas = document.getElementById('three-canvas');
const scene = new THREE.Scene();

// 昼の環境マップ（初期）
const envMap = new THREE.CubeTextureLoader()
  .setPath('https://threejs.org/examples/textures/cube/Bridge2/')
  .load([
    'posx.jpg','negx.jpg',
    'posy.jpg','negy.jpg',
    'posz.jpg','negz.jpg'
  ], (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.environment = texture;
    scene.background = texture;
  });

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth/window.innerHeight, 0.1, 1000
);

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;

// 🔹 ARボタンを追加
document.body.appendChild(
  ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
);


// サブカメラ（別角度）
const cameraSub = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
cameraSub.position.set(10, 5, 0);
cameraSub.lookAt(0, 0, 0);

import { TrainSystem } from './functions.js';
const TSys = new TrainSystem(scene);

// --- GridHelper 追加（初回のみ） ---
const grid = new THREE.GridHelper(200, 80);
grid.name = "Keep";
scene.add(grid);

// 物体描画
const cube_geometry = new THREE.BoxGeometry();
const cube_material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(cube_geometry, cube_material);

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



// console.log(scene)

// 光源
// const light = new THREE.DirectionalLight(0xffffff, 2);
// light.position.set(5,5,5);
// light.name = "Keep"
// scene.add(light);

// --- ライト追加（初回のみ） ---
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 6, 0);
dirLight.name = "SunLight";
scene.add(dirLight);


// マウス座標管理用のベクトルを作成
const mouse = new THREE.Vector2();
// マウスイベントを登録
canvas.addEventListener('mousemove', (e) => {
  handleMouseMove(e.clientX, e.clientY);
});
// タッチイベント
document.addEventListener("touchstart", (e) => {
  e.preventDefault(); // スクロール防止
  const touch = e.touches[0];
  handleMouseMove(touch.clientX, touch.clientY);
}, { passive: false });

document.addEventListener("touchmove", (e) => {
  e.preventDefault(); // スクロール防止
  const touch = e.touches[0];
  handleMouseMove(touch.clientX, touch.clientY);
}, { passive: false });

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

// レイキャストを作成
const raycaster = new THREE.Raycaster();

// モード切替関数
function toggleMode(Btn,Ricons,Mode) {
  Mode = (Mode + 1) % Ricons.length; // モードを順番に切替
  const bgIcon = Btn.querySelector('.background-icon');
  const fgIcon = Btn.querySelector('.foreground-icon');

  bgIcon.textContent = Ricons[Mode].bg;
  fgIcon.textContent = Ricons[Mode].fg;

  return Mode
}


const targetObjects = []; // 変更する描画物体のポイントを格納
let pause = false; // 処理状況

// すべてのボタンに hover 検出を付ける
const buttons = document.querySelectorAll("button");

buttons.forEach(btn => {
  btn.addEventListener("mouseenter", () => {
    console.log("カーソルがボタン上にある:", btn.textContent);
    pause = true; // 一時停止
  });

  btn.addEventListener("mouseleave", () => {
    console.log("カーソルがボタンから離れた:", btn.textContent);
    pause = false; // 再開
  });
});

buttons.forEach(btn => {
  // 指がボタンに触れたとき（mouseenter 相当）
  btn.addEventListener("touchstart", (e) => {
    e.preventDefault(); // ページスクロールを防止
    console.log("指がボタンに触れた:", btn.textContent);
    pause = true; // 一時停止
  }, { passive: false });

  // 指がボタンから離れたとき（mouseleave 相当）
  btn.addEventListener("touchend", () => {
    console.log("指がボタンから離れた:", btn.textContent);
    pause = false; // 再開
  });

  // タッチがキャンセルされたとき（例: 指が画面外にずれた）
  btn.addEventListener("touchcancel", () => {
    console.log("タッチキャンセル:", btn.textContent);
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
  clean_object(['DeckSlab','Pillar','Rail'])

  const Points = targetObjects.map(obj => obj.position.clone());

  // 指定したポイントから線(線路の軌道)を生成
  const line = new THREE.CatmullRomCurve3(Points);


  TSys.generateElevated(line, 5, 1);
  TSys.createRail(line, 60)
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

let choice_object = false
let search_object = true
let move_direction_y = false

// search_point();

// 毎フレーム時に実行されるループイベントです
function search_point() {
  
  if (!search_object){return}

  // レイキャスト = マウス位置からまっすぐに伸びる光線ベクトルを生成
  raycaster.setFromCamera(mouse, camera);
 
  // その光線とぶつかったオブジェクトを得る
  const intersects = raycaster.intersectObjects(targetObjects, true);

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
    GuideLine.visible = false
    GuideGrid.visible = false
  }  

  // レンダリング
  renderer.render(scene, camera);
  requestAnimationFrame(search_point);
}

// マウスの位置2D座標を3D座標に変換する関数_平面移動/垂直移動
function coord_DisplayTo3D(Axis_num=false){

  const pos = camera.position

  console.log(Axis_num)
  
  let t = 0
  let point = []
  if (move_direction_y === false | Axis_num === false){

    let set_y = 0
    if (Axis_num!=false){ set_y = Axis_num.y}

    raycaster.setFromCamera(mouse, camera);
    const dir = raycaster.ray.direction

    const t = Math.abs((camera.position.y - set_y)/dir.y)
    console.log(dir)
    
    // 交点を計算
    point = new THREE.Vector3(
      pos.x + dir.x * t,
      set_y,
      pos.z + dir.z * t
    );

    console.log(point)

  } else {
    raycaster.setFromCamera(mouse, camera);
    const dir = raycaster.ray.direction

    const mouAngleY = cameraAngleY - Math.atan2(dir.x,dir.z) // マウスを3d世界の座標のベクトルに変換
    const diff = {x: Axis_num.x - pos.x, z: Axis_num.z - pos.z}
    const hypotenuse = Math.cos(Math.atan2(diff.x, diff.z) - cameraAngleY) * Math.sqrt(diff.x**2 + diff.z**2)
    
    console.log('• • : '+'x, '+diff.x+'z, '+diff.z)
    console.log('•-• : '+hypotenuse)
    console.log('_./ : '+mouAngleY + ' x,'+ Math.sin(mouAngleY) + ' y,'+Math.cos(mouAngleY))
    console.log('--,-: '+(hypotenuse/Math.cos(mouAngleY))*Math.cos(mouAngleY),hypotenuse/Math.cos(mouAngleY)*dir.y)
    // t = hypotenuse/(Math.cos(cameraAngleY)*dir.z)
    t = hypotenuse /(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x)//,dir.z
    
    console.log('/ : '+hypotenuse+' '+Math.floor(Math.cos(cameraAngleY)*dir.z+Math.sin(cameraAngleY)*dir.x))
    console.log('t : '+t)
  
    // 交点を計算
    point = new THREE.Vector3(
      Axis_num.x,
      // pos.x + dir.x * t,
      pos.y + dir.y * t,
      // pos.z + dir.z * t,
      Axis_num.z
    );
  }

  console.log('retun')
  return point
}

// ドラッグ処理
let dragging = false;
function handleDrag() {
  if (dragging) {
    let point = 0
    console.log(`ドラッグ中:`);
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
}

// ドラッグ終了時、位置を確定させる処理
function handleMouseUp() {
  
  console.log('UP')

  dragging = false;
  if (event.target.tagName === 'BUTTON') {
    pause = false;
  }
  if (OperationMode === 0){return}

  // レイキャスト = マウス位置からまっすぐに伸びる光線ベクトルを生成
  let point= 0
  if (choice_object) { // Only update position if an object was chosen
    if (!move_direction_y){
      point = coord_DisplayTo3D(choice_object.position)
    } else {
      point = coord_DisplayTo3D(choice_object.position)
    }
    choice_object.position.set(point.x,point.y,point.z)
    choice_object.material.color.set(0xff0000) // Reset color to red
  }

  search_object = true;
  choice_object = false; // Deselect the object

  GuideLine.visible = false;
  GuideGrid.visible = false;

  drawingObject();

  console.log("ドラッグ終了");
}

// ドラック開始時の処理
function handleMouseDown() {
  console.log('Down')
  if (event.target.tagName === 'BUTTON') {
    pause = true;
  }
  if (pause || OperationMode !== 1) { return; }

  // 架線柱配置モード
  if (polePlacementMode) {
    const point = coord_DisplayTo3D();
    const pole = TSys.createCatenaryPole(5, 5, 2, 5, 1);
    pole.position.set(point.x, point.y, point.z);
    scene.add(pole);
    deactivateAllModes(); // 配置後に全モードを解除
    return;
  }

  // 線路描画モード
  if (trackDrawingMode && objectEditMode === 'CREATE_NEW') {
    const point = coord_DisplayTo3D();
    const cube_clone = new THREE.Mesh(cube_geometry, cube_material.clone());
    cube_clone.position.set(point.x, point.y, point.z);
    scene.add(cube_clone);
    targetObjects.push(cube_clone);
    drawingObject();
    return;
  }

  // 通常のオブジェクト選択・移動モード
  if (choice_object != false && objectEditMode === 'MOVE_EXISTING'){
    if (search_object){
      search_object = false
      choice_object.material.color.set(0x0000ff)
      
      dragging = true;
      
      GuideLine.visible = true
      if (!move_direction_y){
        GuideGrid.visible = true
      }
      console.log(`ドラッグ開始`);
    }

  } else {
    // This part for adding new points is now handled by trackDrawingMode
  }
}

// 物体移動開始
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('touchstart', (e) => {
  e.preventDefault();      // ← スクロールを止める
  if (objectEditMode === 'MOVE_EXISTING') { search_point(); }
  handleMouseDown();      // ← 同じ関数に渡している
}, { passive: false });

// 物体移動追尾
document.addEventListener('mousemove', handleDrag);
document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  handleDrag();
}, { passive: false });

// 物体移動完了
document.addEventListener('mouseup', () => {
  handleMouseUp();
  if (objectEditMode === 'MOVE_EXISTING') { search_point(); }
});
document.addEventListener('touchend', () => {
  // e.preventDefault(); ← 多分ここは不要（あとで説明）
  // console.log('UP')
  handleMouseUp();
});


function setMeshListOpacity(list, opacity) {
  list.forEach(mesh => {
    if (mesh.isMesh) {
      // mesh.material.transparent = true;
      // mesh.material.opacity = opacity;
      mesh.visible = !mesh.visible
    }
  });
}

const ModeChangeBtn = document.getElementById("mode-change")
const createPoleBtn = document.getElementById('create-pole');
const drawTrackBtn = document.getElementById('draw-track');

// モード状態（例）
let OperationMode = 0;
// アイコンセット例
const ModeRicons = [
  { bg: '🌐', fg: '🛠️' }, // モード0
  { bg: '🌐', fg: '🎦' }, // モード1
]

let polePlacementMode = false;
let trackDrawingMode = false;
// let trackEditSubMode = 'CREATE_NEW'; // 'CREATE_NEW' or 'MOVE_EXISTING'
let objectEditMode = 'CREATE_NEW'; // 'CREATE_NEW' or 'MOVE_EXISTING'

const trackCreateNewBtn = document.getElementById('track-create-new');
const trackMoveExistingBtn = document.getElementById('track-move-existing');

function deactivateAllModes() {
  polePlacementMode = false;
  trackDrawingMode = false;
  createPoleBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
  drawTrackBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
  trackCreateNewBtn.style.display = "none";
  trackMoveExistingBtn.style.display = "none";
}

function setObjectEditMode(mode) {
  objectEditMode = mode;
  if (objectEditMode === 'CREATE_NEW') {
    trackCreateNewBtn.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
    trackMoveExistingBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    search_object = false
  } else {
    trackCreateNewBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    trackMoveExistingBtn.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
    if (objectEditMode === 'MOVE_EXISTING') { search_point(); }
  }
}

trackCreateNewBtn.addEventListener('touchstart', () => setObjectEditMode('CREATE_NEW'));
trackCreateNewBtn.addEventListener('click', () => setObjectEditMode('CREATE_NEW'));

trackMoveExistingBtn.addEventListener('touchstart', () => setObjectEditMode('MOVE_EXISTING'));
trackMoveExistingBtn.addEventListener('click', () => setObjectEditMode('MOVE_EXISTING'));

createPoleBtn.addEventListener('touchstart', handleCreatePoleClick);
createPoleBtn.addEventListener('click', handleCreatePoleClick);

function handleCreatePoleClick() {
  if (OperationMode !== 1) return;
  polePlacementMode = !polePlacementMode;
  trackDrawingMode = false;
  if (polePlacementMode) {
    createPoleBtn.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
    drawTrackBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
  } else {
    deactivateAllModes();
  }
}

drawTrackBtn.addEventListener('touchstart', handleDrawTrackClick);
drawTrackBtn.addEventListener('click', handleDrawTrackClick);

function handleDrawTrackClick() {
  if (OperationMode !== 1) return;
  trackDrawingMode = !trackDrawingMode;
  polePlacementMode = false;
  if (trackDrawingMode) {
    drawTrackBtn.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
    createPoleBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    trackCreateNewBtn.style.display = "block";
    trackMoveExistingBtn.style.display = "block";
    setObjectEditMode(objectEditMode); // Apply current sub-mode style
  } else {
    deactivateAllModes();
  }
}

ModeChangeBtn.addEventListener("touchstart", handleModeChangeClick);
ModeChangeBtn.addEventListener("click", handleModeChangeClick);

function handleModeChangeClick() {
  OperationMode = toggleMode(ModeChangeBtn,ModeRicons,OperationMode);
  if (OperationMode === 1){
    // 編集モード
    createPoleBtn.style.display = "block";
    drawTrackBtn.style.display = "block";
    EditRBtn.style.display = "block";
    search_object = true
    move_direction_y = false
    EditRmode = 0
    EditRmode = toggleMode(EditRBtn,EditRicons,EditRmode);
    setMeshListOpacity(targetObjects, 1);
    // search_point()
  }
  else {
    // 閲覧モード
    createPoleBtn.style.display = "none";
    drawTrackBtn.style.display = "none";
    deactivateAllModes();
    EditRBtn.style.display = "none";
    search_object = false
    choice_object = false
    dragging = false
    setMeshListOpacity(targetObjects, 0.0);
  }
}


const EditRBtn = document.getElementById("edit-rotation")
// モード状態（例）
let EditRmode = 1;
// アイコンセット例
const EditRicons = [
  { bg: '⏥', fg: '⤮' }, // モード0
  { bg: '⏥', fg: '⇡' },  // モード1
]

EditRBtn.addEventListener("touchstart", handleEditRClick);
EditRBtn.addEventListener("click", handleEditRClick);

function handleEditRClick() {
  move_direction_y = !move_direction_y
  EditRmode = toggleMode(EditRBtn,EditRicons,EditRmode);
}

// 非表示
EditRBtn.style.display = "none";

  
// リサイズ変更
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// 視点操作
// カメラ操作 ----------------------------------------------------------------

let touchState = 'NONE';
let lastPosition1 = { x: 0, y: 0 };
let lastPosition2 = { x: 0, y: 0 };
let lastDistance = 0;

canvas.addEventListener('touchstart', (e) => {
  // e.preventDefault();
  switch (e.touches.length) {
    case 1:
      touchState = 'ROTATE';
      lastPosition1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      break;
    case 2:
      touchState = 'PAN_ZOOM';
      lastPosition1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastPosition2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      lastDistance = Math.hypot(lastPosition1.x - lastPosition2.x, lastPosition1.y - lastPosition2.y);
      break;
    default:
      touchState = 'NONE';
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();

  // Update mouse vector for raycasting (from handleMouseMove)
  handleMouseMove(e.touches[0].clientX, e.touches[0].clientY);

  // Object Dragging Logic
  if (dragging) { // If dragging is true, it means an object was selected in handleMouseDown
    let point = 0;
    console.log(`ドラッグ中:`);
    if (!move_direction_y){
      point = coord_DisplayTo3D(choice_object.position);
    } else {
      point = coord_DisplayTo3D(choice_object.position);
    }

    choice_object.position.set(point.x,point.y,point.z);

    GuideLine.position.set(point.x,point.y,point.z);
    if (!move_direction_y){
      GuideGrid.position.set(point.x,point.y,point.z);
      GuideGrid.material.color.set(0x8888aa);
    }
    drawingObject();
    return; // Object dragging takes precedence over camera controls
  }

  // Camera control logic
  if (touchState === 'NONE') return;

  if (e.touches.length === 1 && touchState === 'ROTATE') {
    const dx = e.touches[0].clientX - lastPosition1.x;
    const dy = e.touches[0].clientY - lastPosition1.y;

    cameraAngleY -= dx * 0.01;
    cameraAngleX -= dy * 0.01;
    cameraAngleX = Math.max(-pitchLimit, Math.min(pitchLimit, cameraAngleX));

    lastPosition1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  } else if (e.touches.length === 2 && touchState === 'PAN_ZOOM') {
    const currentPosition1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const currentPosition2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
    const currentDistance = Math.hypot(currentPosition1.x - currentPosition2.x, currentPosition1.y - currentPosition2.y);
    const midPoint = { x: (currentPosition1.x + currentPosition2.x) / 2, y: (currentPosition1.y + currentPosition2.y) / 2 };
    const lastMidPoint = { x: (lastPosition1.x + lastPosition2.x) / 2, y: (lastPosition1.y + lastPosition2.y) / 2 };

    // Zoom
    const zoomAmount = lastDistance / currentDistance;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    camera.position.addScaledVector(direction, (zoomAmount - 1) * -5);

    // Pan
    const dx = midPoint.x - lastMidPoint.x;
    const dy = midPoint.y - lastMidPoint.y;

    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const forward = new THREE.Vector3(Math.sin(cameraAngleY), 0, Math.cos(cameraAngleY));

    camera.position.addScaledVector(right.setY(0).normalize(), -dx * 0.1);
    camera.position.addScaledVector(forward.setY(0).normalize(), dy * 0.1);

    lastPosition1 = currentPosition1;
    lastPosition2 = currentPosition2;
    lastDistance = currentDistance;
  }
});

canvas.addEventListener('touchend', (e) => {
  touchState = 'NONE';
});


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
let cameraAngleY = 0;  // 水平回転
let cameraAngleX = 0;  // 垂直回転
camera.position.y += 10
cameraAngleX = -1.5
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

// ========== アニメーションループ ========== //

let key = '0'
document.addEventListener('keydown', (e) => {
  key = e.key.toLowerCase();
});

function animate() {
  requestAnimationFrame(animate);

  const moveSpeed = baseSpeed;

  // キーボード移動処理
  const strafe = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
  const forward = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0);
    
  // 数字キー押下で倍率設定
  if (key >= '1' && key <= '9') {
    baseSpeed = parseInt(key, 10) * (parseInt(key, 10) *0.005);
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
  // camera.position.x += moveVector.x * moveSpeed;
  // camera.position.z += moveVector.y * moveSpeed;

  if (speedUp) {
    if (baseSpeed === 0.1){
      baseSpeed = 0.3
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
    camera.position.y += moveSpeed;
  }
  if (keys['e'] || moveDown) {
    camera.position.y -= moveSpeed;
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

  if (dragging){
    const pos = choice_object.position
    cameraSub.position.set(pos.x-Math.sin(cameraAngleY)*0.2,pos.y+5,pos.z-Math.cos(cameraAngleY)*0.2)

    cameraSub.lookAt(pos.x,pos.y,pos.z)
    // サブカメラ：画面右下に小さく表示
    const insetWidth = window.innerWidth / 4;  // 画面幅の1/4サイズ
    const insetHeight = window.innerHeight / 4; // 画面高の1/4サイズ
    const insetX = 10; // 右下から10pxマージン
    const insetY = window.innerHeight - insetHeight - 10; // 下から10pxマージン

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

