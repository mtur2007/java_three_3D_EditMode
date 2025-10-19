import * as THREE from 'three';

import { TrainSystem } from './train_system.js';

// 必ず three と同バージョンの examples モジュールを使う（あなたは three@0.169 を使っているので合わせる）
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/DRACOLoader.js';

export async function WorldCreat(scene,train_width,car_Spacing){

// ライト作成
const dirLight = new THREE.DirectionalLight(0xffeeee, 1);
dirLight.name = 'dirLight'

// ライトの位置（光が来る方）
dirLight.position.set(0, 0, 0); // 例: 斜め上（単位はシーンの単位に依存）

// ターゲット（ライトが向く場所）
dirLight.target.position.set(0, 0, 0); // 原点を向かせる例

// ターゲットは scene に追加する必要がある
scene.add(dirLight.target);
scene.add(dirLight);

// // --- 既存の DirectionalLight(dirLight) にシャドウ設定を追加 ---
dirLight.castShadow = true;           // ライトがシャドウを投げる
dirLight.shadow.mapSize.width = 2048; // 解像度（要調整：2048/1024/4096）
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.radius = 4;           // ソフトネス（three r0.150+ で有効）
dirLight.shadow.bias = -0.0005;       // 影のアーティファクト（自動調整必要）
dirLight.shadow.normalBias = 0.05;    // 法線オフセット（改善される場合あり）

// 4) マトリクスを強制更新（これで即時反映）
dirLight.updateMatrixWorld(true);
dirLight.target.updateMatrixWorld(true);

// ----------------- 「床（ground）」を追加して影を受けさせる（GridHelper の下に置く） -----------------
const groundGeo = new THREE.PlaneGeometry(1000, 1000);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0; // 必要ならシーンの床の高さに合わせる
ground.receiveShadow = true; // 影を受ける
ground.name = 'GroundPlane';
scene.add(ground);


// ----------------- シャドウの自動最適化（モデルに合わせてシャドウカメラを調整） -----------------
// モデル読み込み後に呼ぶ関数（root は読み込んだ Group）
function fitDirectionalLightShadowForObject(rootObj, light) {
  const box = new THREE.Box3().setFromObject(rootObj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // シャドウカメラをモデルにフィットさせる（余白 factor を入れる）
  const factor = 1.25;
  const halfWidth = Math.max(size.x, size.z) * factor * 0.5;
  light.position.set(center.x + size.x * 0.5, center.y + Math.max(size.y, 50), center.z + size.z * 0.5); // ライト位置を調整
  light.target.position.copy(center);
  scene.add(light.target);

  light.shadow.camera.left = -halfWidth;
  light.shadow.camera.right = halfWidth;
  light.shadow.camera.top = halfWidth;
  light.shadow.camera.bottom = -halfWidth;

  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = Math.max(500, size.y * 10);
  light.shadow.mapSize.set(2048, 2048); // 必要に応じて解像度を下げる
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.05;
  light.shadow.radius = 4;
  light.shadow.camera.updateProjectionMatrix();
}

// DRACO 使用版（.glb が Draco 圧縮されている／将来使うなら有効化）
const gltfLoader = new GLTFLoader();
const useDraco = true; // Draco を使う場合は true に。未圧縮なら false
if (useDraco) {
  const dracoLoader = new DRACOLoader();
  // CDN のデコーダパス（例）。必要ならローカルの decoder に変えてください
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  gltfLoader.setDRACOLoader(dracoLoader);
}

let car = null

/**
 * modelUrl の glb を読み込んでシーンに追加するユーティリティ。
 * - 中心化（大きな座標を原点付近に移す）
 * - 自動スケール（巨大なら縮小）
 * - マテリアルに scene.environment を適用（PBR反射）
 * - シャドウ設定（必要なら有効化）
 */
async function loadModelToScene(modelUrl, options = {}, adjustment=true) {
  const {
    autoCenter = true,
    autoScaleMax = 1000,   // モデルの最大寸法がこの値を超えるなら縮小する閾値
    scaleIfLarge = 0.001,   // 縮小係数（例：0.001）
    castShadow = false,
    receiveShadow = false,
    onProgress = (xhr) => (xhr.total),
  } = options;

  return new Promise((resolve, reject) => {
    gltfLoader.load(
      modelUrl,
      (gltf) => {
        const root = gltf.scene || gltf.scenes[0];
        if (!root) return reject(new Error('glTF にシーンがありません'));

        // 1) マテリアル側に環境マップをセット（PBRの反射を有効化）
        root.traverse((node) => {
          if (node.isMesh) {
            // ランタイムで環境マップがあれば適用
            // if (scene.environment) {
            //   console.log('run')
            //   // 一部のマテリアルは envMap を直接参照しないことがあるが、通常はこれで反射が得られます
            //   if (node.material) {
            //     console.log('run')
            //     if (Array.isArray(node.material)) {
            //       node.material.forEach(m => {
            //         if (m && 'envMap' in m) {
            //           console.log('run0')
            //           m.envMap = scene.environment;
            //           m.needsUpdate = true;
            //         }
            //       });
            //     } else {
            //       if ('envMap' in node.material) {
            //         node.material.envMap = scene.environment;
            //         node.material.needsUpdate = true;
            //       }
            //     }
            //   }
            // }

            // シャドウ（重くなる場合は false に）
            node.castShadow = castShadow;
            node.receiveShadow = receiveShadow;

            // GPU負荷低減のために、if necessary, フラグなどを調整してもよい
          }
        });

        // 2) 中心化＋自動縮小（CityGML は世界座標が大きいことが多い）
        if (autoCenter) {
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // 原点に移動
          root.position.sub(center);

          // 必要なら scale を下げる
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > autoScaleMax) {
            root.scale.setScalar(scaleIfLarge);
            console.log(`モデルが大きかったため scale=${scaleIfLarge} を適用しました（maxDim=${maxDim}）`);
          }
        }

        // 手動調整
        
        fitDirectionalLightShadowForObject(root, dirLight);

        if (adjustment){
          root.rotation.y = 100 * Math.PI / 180
          root.position.set(145,40,-175)
          root.scale.setScalar(0.45);
        } else {
          root.position.set(0.5,0,0)
          root.scale.setScalar(0.5);
          console.log(root)

          // --- root以下のメッシュに対してマテリアル調整 ---
          root.traverse(o => {
            if (o.isMesh && o.material) {
              // // 例: 環境マップの影響を切りたいメッシュ名
              // if (o.name.includes('平面')) {
              //   // 方法1: 反射(IBL)をゼロ
              //   o.material.envMapIntensity = 0;
              //   // 方法2: さらにマットな質感へ
              //   o.material.metalness = 0.0;
              //   o.material.roughness = 1.0;
              //   o.material.needsUpdate = true;
              // }

              // 別例: サインなど完全Unlitにする
              if (o.name.includes('平面')) {
                const tex = o.material.map;
                o.material = new THREE.MeshBasicMaterial({
                  map: tex,
                  // transparent: true,
                  opacity: 1.0,
                  side: THREE.FrontSide
                });
              }

              // 確認用ログ
              console.log(o.name, o.material.name || '(no name)', o.material.envMapIntensity);
            }
          });

          car = root

          
        }

        // ----------------- GLTF 読み込み時に各メッシュのシャドウを有効化（loadModelToScene の traverse 内で） -----------------
        root.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;     // このメッシュが影を落とす
            node.receiveShadow = true;  // このメッシュが影を受ける（床や周囲の建物に有効）
            // 必要に応じてマテリアルの設定（透明など）を行う
            if (Array.isArray(node.material)) {
              node.material.forEach(m => { if (m) m.needsUpdate = true; });
            } else if (node.material) {
              node.material.needsUpdate = true;
            }
          }
        });

        // 3) シーンに追加
        scene.add(root);

        resolve(root);
      },
      onProgress,
      (err) => {
        console.error('GLTF load error', err);
        reject(err);
      }
    );
  });
}

// // --------------- 実行例：model.glb を読み込む ----------------
// ここのファイル名をあなたの .glb の名前に変えてください
await loadModelToScene('trainD.glb', { autoCenter: true, autoScaleMax: 10000, scaleIfLarge: 0.001 },false)
  .then((root) => {
    console.log('GLB loaded and added to scene:', root);
    console.log('GLB',car)
  })
  .catch((err) => {
    console.error('モデルの読み込みで失敗:', err);
    alert('モデル読み込みに失敗しました。コンソールを確認してください。');
  });

// -----------------------------------------------------------------


// --------------- 実行例：model.glb を読み込む ----------------
// ここのファイル名をあなたの .glb の名前に変えてください
loadModelToScene('model.glb', { autoCenter: true, autoScaleMax: 10000, scaleIfLarge: 0.001 })
  .then((root) => {
    console.log('GLB loaded and added to scene:', root);
  })
  .catch((err) => {
    console.error('モデルの読み込みで失敗:', err);
    alert('モデル読み込みに失敗しました。コンソールを確認してください。');
  });

// --- 駅舎作成 ---

const ceiling_Spacing = (train_width+car_Spacing) +2
const beam_Spacing = ceiling_Spacing/9
const Podium_deck_width = ceiling_Spacing*5 + beam_Spacing*3

function object_update({
  ins_obj = NaN,
  ins_idx = NaN,
  pos_x = NaN,
  pos_y = NaN,
  pos_z = NaN,
  rot_x = NaN,
  rot_y = NaN,
  rot_z = NaN,
  scale = NaN} = {}) {
    
    const dummy = new THREE.Object3D();
    // 位置の更新
    if (!Number.isNaN(pos_x)) dummy.position.x = pos_x;
    if (!Number.isNaN(pos_y)) dummy.position.y = pos_y;
    if (!Number.isNaN(pos_z)) dummy.position.z = pos_z;

    // 回転の更新
    if (!Number.isNaN(rot_x)) dummy.rotation.x = rot_x;
    if (!Number.isNaN(rot_y)) dummy.rotation.y = rot_y;
    if (!Number.isNaN(rot_z)) dummy.rotation.z = rot_z;

    // スケールの更新
    if (!Number.isNaN(scale)) dummy.scale.setScalar(scale);

    dummy.updateMatrix();                       // 行列計算更新
    ins_obj.setMatrixAt(ins_idx, dummy.matrix); // i番目のインスタンスに行列を適用
    ins_obj.instanceMatrix.needsUpdate = true;  // 更新フラグ
  }

if (true) {

  // 鉄のような金属マテリアル設定
  const metalParams = {
    color: 0x999999,      // 明るめのグレー（鉄色）
    metalness: 0.3,       // 金属光沢最大
    roughness: 0.25,      // 少しザラザラ（低くするとツルツル）
    envMapIntensity: 1.0,    // 環境マップの反射強度（envMapを使うなら）
    side: THREE.FrontSide,
  };

  // 鉄のような金属マテリアル設定
  const metalParams_2 = {
    color: 0xffffff,      // 暗めのグレー（鉄色）
    metalness: 0.5,       // 金属光沢最大
    roughness: 0.0,       // 少しザラザラ（低くするとツルツル）
    envMapIntensity: 1.0,    // 環境マップの反射強度（envMapを使うなら）
    side: THREE.FrontSide,
  };

  // 1. 天井本体（Mesh）
  const ceilingGeometry = new THREE.BoxGeometry(10, 0.1, Podium_deck_width);
  const ceilingMaterial = new THREE.MeshStandardMaterial({...metalParams});
  const ceilingMesh = new THREE.Mesh(ceilingGeometry, ceilingMaterial);

  let geometry = NaN
  let material = NaN

  // 2. 柱（縦方向ビーム）
  geometry = new THREE.BoxGeometry(0.05, 1, Podium_deck_width);
  material = new THREE.MeshStandardMaterial({...metalParams});
  const beam_pillar = new THREE.InstancedMesh(geometry, material, 10);

  // 3. 柱（横方向ビーム）
  geometry = new THREE.BoxGeometry(0.05, 1, 10);
  material = new THREE.MeshStandardMaterial({...metalParams});
  const count = 49;
  const beam_pillar_2 = new THREE.InstancedMesh(geometry, material, count);

  // 4. 鉄骨梁（縦）
  geometry = new THREE.BoxGeometry(0.15, 0.05, Podium_deck_width);
  material = new THREE.MeshStandardMaterial({...metalParams});
  const beam = new THREE.InstancedMesh(geometry, material, 10);

  // 5. 鉄骨梁（横）
  geometry = new THREE.BoxGeometry(0.15, 0.05, 10);
  material = new THREE.MeshStandardMaterial({...metalParams});
  const beam_2 = new THREE.InstancedMesh(geometry, material, count);

  // 6. 小天井板（パーツ）
  geometry = new THREE.BoxGeometry(beam_Spacing, 0.05, 10);
  material = new THREE.MeshStandardMaterial({...metalParams});
  const ceiling = new THREE.InstancedMesh(geometry, material, 6);

  // 7. 柱
  const radiusTop = 0.3;     // 上面の半径
  const radiusBottom = 0.3;  // 下面の半径
  const height = 3;          // 高さ
  const radialSegments = 32; // 円周方向の分割数

  geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
  material = new THREE.MeshStandardMaterial({...metalParams});
  const cylinder = new THREE.InstancedMesh(geometry, material, 12);
  
  // 8. 支柱
  const radiusTop_2 = 0.01;    // 上面の半径
  const radiusBottom_2 = 0.01; // 下面の半径
  const height_2 = 0.5;        // 高さ
  const radialSegments_2 = 5;  // 円周方向の分割数

  geometry = new THREE.CylinderGeometry(radiusTop_2, radiusBottom_2, height_2, radialSegments_2);
  material = new THREE.MeshStandardMaterial({...metalParams_2});
  const prop = new THREE.InstancedMesh(geometry, material, 376);

  // 9. 小天井板（パーツ）
  geometry = new THREE.BoxGeometry(Podium_deck_width, 0.04, 0.3);
  material = new THREE.MeshStandardMaterial({...metalParams});
  const board = new THREE.InstancedMesh(geometry, material, 4);

  // 光源の追加
  function createPointLight(color = 0xffffff, intensity = 1, distance = 100, position = [0, 10, 0]) {
    const light = new THREE.PointLight(color, intensity, distance);
    light.position.set(...position);
    scene.add(light);
    return light;
  }  

  let beam_y = 9.4
  let beam_z = 20
  object_update({ins_obj: beam_pillar, ins_idx: 0, pos_x: 5.5,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // | : : : : : : :
  object_update({ins_obj: beam_pillar, ins_idx: 1, pos_x: 4,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : | : : : : : :
  object_update({ins_obj: beam_pillar, ins_idx: 2, pos_x: 2.8,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : : | : : : : :
  object_update({ins_obj: beam_pillar, ins_idx: 3, pos_x: 1.7,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : : | : : : : :
  object_update({ins_obj: beam_pillar, ins_idx: 4, pos_x: 0.6,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : : : | : : : :
  object_update({ins_obj: beam_pillar, ins_idx: 5, pos_x: -0.6, pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : : : : | : : :
  object_update({ins_obj: beam_pillar, ins_idx: 6, pos_x: -1.7, pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : : : : : | : :
  object_update({ins_obj: beam_pillar, ins_idx: 7, pos_x: -2.9,   pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : : : : : : | : 
  object_update({ins_obj: beam_pillar, ins_idx: 8, pos_x: -4,   pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : : : : : : | :
  object_update({ins_obj: beam_pillar, ins_idx: 9, pos_x: -4.5, pos_y: beam_y+0.5, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})  // : : : : : : : |

  beam_y -= 0.5
  object_update({ins_obj: beam, ins_idx: 0, pos_x: 5.5,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})
  object_update({ins_obj: beam, ins_idx: 1, pos_x: 4,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})
  object_update({ins_obj: beam, ins_idx: 2, pos_x: 2.8,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})      // : : | : : : : :
  object_update({ins_obj: beam, ins_idx: 3, pos_x: 1.7,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})
  object_update({ins_obj: beam, ins_idx: 4, pos_x: 0.6,  pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})
  object_update({ins_obj: beam, ins_idx: 6, pos_x: -0.6, pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})
  object_update({ins_obj: beam, ins_idx: 5, pos_x: -1.7, pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})
  object_update({ins_obj: beam, ins_idx: 7, pos_x: -2.9,   pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})
  object_update({ins_obj: beam, ins_idx: 8, pos_x: -4,   pos_y: beam_y, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})
  object_update({ins_obj: beam, ins_idx: 9, pos_x: -4.5, pos_y: beam_y+0.5, pos_z: beam_z, rot_x: NaN, rot_y: NaN, rot_z: NaN,scale: NaN})


  beam_y += 0.5
  const Podium_deck_start = Podium_deck_width/2
  for (let i = 0; i < 49; i++) {
    object_update({ins_obj: beam_pillar_2, ins_idx: i, pos_x: 0.5, pos_y: beam_y, pos_z: beam_z-Podium_deck_start + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: beam_2, ins_idx: i, pos_x: 0.5, pos_y: beam_y-0.5, pos_z: beam_z-Podium_deck_start + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
  }

  const Light_Spot_margin = ceiling_Spacing/2
  for (let i = 0; i < 6; i++) {
    object_update({ins_obj: ceiling,  ins_idx: i, pos_x: 0.5, pos_y: beam_y-0.5, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*ceiling_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: cylinder, ins_idx: i*2, pos_x: 2.8, pos_y: beam_y-1.5, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*ceiling_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: cylinder, ins_idx: i*2+1, pos_x: -2.9, pos_y: beam_y-1.5, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*ceiling_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    createPointLight(0xffffff, 10, 10, [2.55, beam_y-1.05, beam_z-Podium_deck_start+ beam_Spacing/2*3 - ceiling_Spacing/4 + Light_Spot_margin + i*ceiling_Spacing]);
    createPointLight(0xffffff, 10, 10, [2.55, beam_y-1.05, beam_z-Podium_deck_start+ beam_Spacing/2*3 - ceiling_Spacing/4 + Light_Spot_margin*2 + i*ceiling_Spacing]);
    createPointLight(0xffffff, 10, 10, [-2.9, beam_y-1.05, beam_z-Podium_deck_start+ beam_Spacing/2*3 - ceiling_Spacing/4 + Light_Spot_margin + i*ceiling_Spacing]);
    createPointLight(0xffffff, 10, 10, [-2.9, beam_y-1.05, beam_z-Podium_deck_start+ beam_Spacing/2*3 - ceiling_Spacing/4 + Light_Spot_margin*2 + i*ceiling_Spacing]);
  }

  for (let i = 0; i < 47; i++){
    // 3.5
    object_update({ins_obj: prop, ins_idx: i*8,   pos_x: 4.05, pos_y: beam_y-0.8, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: prop, ins_idx: i*8+1, pos_x: 3.95, pos_y: beam_y-0.8, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    // 1.7
    object_update({ins_obj: prop, ins_idx: i*8+2, pos_x: 1.75, pos_y: beam_y-0.8, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: prop, ins_idx: i*8+3, pos_x: 1.65, pos_y: beam_y-0.8, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    // -2.1
    object_update({ins_obj: prop, ins_idx: i*8+4, pos_x: -1.65, pos_y: beam_y-0.8, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: prop, ins_idx: i*8+5, pos_x: -1.75, pos_y: beam_y-0.8, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    // -4
    object_update({ins_obj: prop, ins_idx: i*8+6, pos_x: -3.95, pos_y: beam_y-0.8, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: prop, ins_idx: i*8+7, pos_x: -4.05, pos_y: beam_y-0.8, pos_z: beam_z-Podium_deck_start+beam_Spacing/2*3 + i*beam_Spacing, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
  }

  for (let i = 0; i < 4; i++){
    object_update({ins_obj: board, ins_idx: i*4,   pos_x: 4,  pos_y: beam_y-1.05, pos_z: beam_z, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: board, ins_idx: i*4+1, pos_x: 1.7,  pos_y: beam_y-1.05, pos_z: beam_z, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: board, ins_idx: i*4+2, pos_x: -1.7, pos_y: beam_y-1.05, pos_z: beam_z, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
    object_update({ins_obj: board, ins_idx: i*4+3, pos_x: -4,   pos_y: beam_y-1.05, pos_z: beam_z, rot_x: NaN, rot_y: Math.PI/2, rot_z: NaN,scale: NaN})
  }

  // 4. 配置（位置の設定）
  ceilingMesh.position.set(0.5, beam_y+0.5, beam_z); // 高さ12に配置（天井）
  // 5. シーンに追加
  scene.add(ceilingMesh);
  scene.add(ceiling);

  scene.add(beam_pillar);
  scene.add(beam);

  scene.add(beam_pillar_2);
  scene.add(beam_2);

  scene.add(cylinder);
  scene.add(prop);
  scene.add(board)

}

// --- 橋の作成 ---

// 円弧Aのパラメータ
const arcA = {
  radius: 29,
  rangeDeg: 65,
  stepDeg: 16,
  thickness: 0.4,
  depth: 0.5,
  color: 0x996633,
  centerOffset: new THREE.Vector3(5, 0, 0),
  rotationOffset: 90 * Math.PI / 180
};

// 円弧Bのパラメータ
const arcB = {
  radius: 25.2,
  rangeDeg: 85,
  stepDeg: 16,
  thickness: 0.4,
  depth: 0.5,
  color: 0x336699,
  centerOffset: new THREE.Vector3(5, 3, 0),
  rotationOffset: 90 * Math.PI / 180
};

function createBoxBetweenPoints(x1, y1, x2, y2, thickness, depth, material) {
  // 長さと角度
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // 中心位置
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  // Box Geometry（幅＝length、厚み、奥行き）
  const geometry = new THREE.BoxGeometry(length, thickness, depth);
  const mesh = new THREE.Mesh(geometry, material);

  // 平面上での回転（Z軸回転でX-Yに合わせる）
  mesh.rotation.z = angle;

  // 配置
  mesh.position.set(centerX, centerY, 0); // zは0平面に
  return mesh;
}

function createBoxBetweenPoints3D(p1, p2, thickness, depth, material) {
  const dir = new THREE.Vector3().subVectors(p2, p1); // 方向ベクトル
  const length = dir.length(); // 距離（ボックスの長さ）
  const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5); // 中心点

  const geometry = new THREE.BoxGeometry(length, thickness, depth);
  const mesh = new THREE.Mesh(geometry, material);

  // デフォルトのボックスはX軸方向に長い → 回転してdir方向に合わせる
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
  mesh.quaternion.copy(quaternion);

  mesh.position.copy(center);
  return mesh;
}

function createDoubleArcPoints(params1, params2) {
  const Bridge = new THREE.Group()
  const Bridge_beam = new THREE.Group()

  const rangeRad1 = (params1.rangeDeg * Math.PI) / 180;
  const segments1 = params1.stepDeg;
  const halfRangeX1 = params1.radius * Math.sin(rangeRad1 / 2);
  const xStart1 = -halfRangeX1;
  const xEnd1 = halfRangeX1;
  const stepX1 = (xEnd1 - xStart1) / segments1;

  const rangeRad2 = (params2.rangeDeg * Math.PI) / 180;
  const segments2 = params2.stepDeg;
  const halfRangeX2 = params2.radius * Math.sin(rangeRad2 / 2);
  const xStart2 = -halfRangeX2;
  const xEnd2 = halfRangeX2;
  const stepX2 = (xEnd2 - xStart2) / segments2;

  const material = new THREE.MeshStandardMaterial({//color: 0x3399cc 
    color: 0xffffff,      // 暗めのグレー（鉄色）
    metalness: 0.8,       // 金属光沢最大
    roughness: 0.5,       // 少しザラザラ（低くするとツルツル）
    envMapIntensity: 1.0,    // 環境マップの反射強度（envMapを使うなら）
    side: THREE.FrontSide,
  });

  const x1 = xStart1 + 1 * stepX1;
  const y1 = Math.sqrt(params1.radius ** 2 - x1 ** 2) + params1.centerOffset.y;
  const x2 = xStart1 + 2 * stepX1;

  const x1_b = xStart2 + 1 * stepX2;
  const y1_b = Math.sqrt(params2.radius ** 2 - x1_b ** 2) + params2.centerOffset.y;

  const x2_b = xStart2 + 2 * stepX2;
  const y2_b = Math.sqrt(params2.radius ** 2 - x2_b ** 2) + params2.centerOffset.y;

  const beam_x = x2;
  const beam_y = y2_b;

  const box = createBoxBetweenPoints3D(
    new THREE.Vector3(x1, y1, 0),
    new THREE.Vector3(x1, y1_b, 0),
    0.3, 0.3, material
  );
  Bridge.add(box);

  const Bridge_depth = 3.5

  for (let i = 1; i < Math.max(segments1, segments2) - 1; i++) {
    let x1 = xStart1 + i * stepX1;
    const y1 = Math.sqrt(params1.radius ** 2 - x1 ** 2) + params1.centerOffset.y;
  
    let x2 = xStart1 + (i + 1) * stepX1;
    const y2 = Math.sqrt(params1.radius ** 2 - x2 ** 2) + params1.centerOffset.y;

    const box = createBoxBetweenPoints3D(
      new THREE.Vector3(x2, y2, 0),
      new THREE.Vector3(x1, y1, 0),
      0.3, 0.3, material
    );
    Bridge.add(box);

    const x1_b = xStart2 + i * stepX2;
    const y1_b = Math.sqrt(params2.radius ** 2 - x1_b ** 2) + params2.centerOffset.y;

    const x2_b = xStart2 + (i + 1) * stepX2;
    const y2_b = Math.sqrt(params2.radius ** 2 - x2_b ** 2) + params2.centerOffset.y;

    const box2 = createBoxBetweenPoints3D(
      new THREE.Vector3(x1, y1_b, 0),
      new THREE.Vector3(x2, y2_b, 0),
      0.3, 0.3, material
    );
    Bridge.add(box2);

    if (i < (Math.max(segments1, segments2) - 1) / 2) {
      const box3 = createBoxBetweenPoints3D(
        new THREE.Vector3(x1, y1, 0),
        new THREE.Vector3(x2, y2_b, 0),
        0.2, 0.2, material
      );
      Bridge.add(box3);
      if (i>2){
        const box3_1 = createBoxBetweenPoints3D(
          new THREE.Vector3(x1, y1, 0),
          new THREE.Vector3(x2, y2, Bridge_depth*0.5),
          0.1, 0.1, material
        );
        const box3_2 = createBoxBetweenPoints3D(
          new THREE.Vector3(x1, y1, Bridge_depth),
          new THREE.Vector3(x2, y2, Bridge_depth*0.5),
          0.1, 0.1, material
        );
        Bridge_beam.add(box3_1)
        Bridge_beam.add(box3_2)
      }
    } else {
      const box3 = createBoxBetweenPoints3D(
        new THREE.Vector3(x2, y2, 0),
        new THREE.Vector3(x1, y1_b, 0),
        0.2, 0.2, material
      );
      Bridge.add(box3);
      if (i<Math.max(segments1, segments2) - 3){
        const box3_1 = createBoxBetweenPoints3D(
          new THREE.Vector3(x1, y1, Bridge_depth*0.5),
          new THREE.Vector3(x2, y2, 0),
          0.1, 0.1, material
        );
        const box3_2 = createBoxBetweenPoints3D(
          new THREE.Vector3(x1, y1, Bridge_depth*0.5),
          new THREE.Vector3(x2, y2, Bridge_depth),
          0.1, 0.1, material
        );
      
        Bridge_beam.add(box3_1)
        Bridge_beam.add(box3_2)
      }
    }

    const box4 = createBoxBetweenPoints3D(
      new THREE.Vector3(x2, y2, 0),
      new THREE.Vector3(x2, y2_b, 0),
      0.2, 0.2, material
    );
    Bridge.add(box4);

    if (i>2&&i<Math.max(segments1, segments2) - 3){
      const box4_1 = createBoxBetweenPoints3D(
        new THREE.Vector3(x1, y1, Bridge_depth),
        new THREE.Vector3(x1, y1, 0),
        0.1, 0.1, material
      );
      Bridge_beam.add(box4_1)
    }

    const box5 = createBoxBetweenPoints3D(
      new THREE.Vector3(x2, y2, 0),
      new THREE.Vector3(x2, beam_y, 0),
      0.2, 0.2, material
    );
    Bridge.add(box5);

    if (i === (Math.max(segments1, segments2) - 4)){
      const box6 = createBoxBetweenPoints3D(
        new THREE.Vector3(x2, y2, Bridge_depth),
        new THREE.Vector3(x2, y2, 0),
        0.2, 0.2, material
      );
      Bridge_beam.add(box6);
  
    }

    if (i === (Math.max(segments1, segments2) - 2)) {
      const box5 = createBoxBetweenPoints3D(
        new THREE.Vector3(beam_x, beam_y, 0),
        new THREE.Vector3(x1, y1_b, 0),
        0.3, 0.3, material
      );
      Bridge.add(box5);
    
    }

  }

  const Bridge2 = Bridge.clone();
  Bridge2.position.z += Bridge_depth
  const ArchBridge = new THREE.Group()
  ArchBridge.add(Bridge)
  ArchBridge.add(Bridge2)
  ArchBridge.add(Bridge_beam)
  return ArchBridge
}
const ArchBridge = createDoubleArcPoints(arcA, arcB)
ArchBridge.position.set(-6.2,-17,-145)
ArchBridge.rotation.y = 107 * Math.PI / 180
scene.add(ArchBridge)

console.log('return',car)
return car
}