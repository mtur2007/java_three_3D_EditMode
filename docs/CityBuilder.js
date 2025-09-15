import * as THREE from "https://esm.sh/three@0.169";
import { TilesRenderer } from "https://esm.sh/3d-tiles-renderer@0.3.19";

export class BuildingSystem {
  constructor(b3dmUrl, camera, renderer, scene, lat, lon) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // 最小の fake tileset を作る
    const fakeTileset = this.createFakeTileset(b3dmUrl, camera.position);
    const blob = new Blob([JSON.stringify(fakeTileset)], { type: "application/json" });
    const tilesetUrl = URL.createObjectURL(blob);

    // TilesRenderer 読み込み
    const tiles = (this.tiles = new TilesRenderer(tilesetUrl));
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);
    scene.add(tiles.group);

    // メッシュが消えないように
    tiles.onLoadModel = (root) => {
      root.traverse((o) => {
        if (o.isMesh) o.frustumCulled = false;
      });
    };

    tiles.onLoadTileSet = () => {
      camera.far = 1e9;
      camera.updateProjectionMatrix();

      // モデル回転----------------------------
      
      // === (0,0,0) から 地面に並行 に伸びる線 ===
      // const phi = ((lat) * Math.PI / 180);   // 経度をラジアンに
      const phi = -0.8147864842334436 +  Math.PI / 2 //lat // ラジアンの場合
      // 0.768
      console.log(phi)
      const lambda = 1.018282777867528//((lon) * Math.PI / 180);   // 経度をラジアンに
      const rangth = 5000

      // ECEF座標系における方向ベクトル
      const origin = new THREE.Vector3(
        Math.sin(phi)*rangth,
        0,
        Math.cos(phi)*rangth
      );

      // ECEF座標系における方向ベクトル
      const end = new THREE.Vector3(
        Math.sin(phi)*-rangth,
        0,
        Math.cos(phi)*-rangth
      );

      // 線のジオメトリを作成
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      this.scene.add(line);

      // 回転軸 = B - A
      const axis = new THREE.Vector3().subVectors(origin, end).normalize();

      // クォータニオンを作成（ここでは 90°回転させてみる）
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, -lambda);
      tiles.group.applyQuaternion(quat);


      // ----------------------------

      // 自動的にカメラを建物全体に合わせる
      const box = new THREE.Box3().setFromObject(tiles.group);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const maxSize = Math.max(size.x, size.y, size.z);

      // camera.position.set(center.x, center.y + maxSize, center.z + maxSize);s
      camera.lookAt(center);
    };
    
  }

  createFakeTileset(b3dmUrl, cameraPos) {
    return {
      asset: { version: "1.0" },
      geometricError: 1e6,
      root: {
        boundingVolume: { sphere: [cameraPos.x, cameraPos.y, cameraPos.z, 1e9] },
        geometricError: 0,
        refine: "ADD",
        content: { uri: b3dmUrl },
      },
    };
  }

  update() {
    if (this.tiles) this.tiles.update();
  }

  dispose() {
    if (!this.tiles) return;
    this.tiles.dispose();
    if (this.tiles.group) this.scene.remove(this.tiles.group);
  }
}
