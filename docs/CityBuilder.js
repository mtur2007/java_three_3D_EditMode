import * as THREE from "https://esm.sh/three@0.169";
import { TilesRenderer } from "https://esm.sh/3d-tiles-renderer@0.3.19";

export class BuildingSystem {
  constructor(b3dmUrl, camera, renderer, scene) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // カメラ位置を中心に「むちゃくちゃ大きい球」を設定（選択段階のカリング回避）
    const c = camera.position;
    const fakeTileset = {
      asset: { version: "1.0" },
      geometricError: 1e6,
      root: {
        // ← ここを box ではなく sphere に。半径は超巨大に。
        boundingVolume: { sphere: [c.x, c.y, c.z, 1e9] },
        geometricError: 1e6,
        refine: "ADD",
        children: [{
          boundingVolume: { sphere: [c.x, c.y, c.z, 1e9] },
          geometricError: 0,
          content: { uri: b3dmUrl }
        }]
      }
    };

    const blob = new Blob([JSON.stringify(fakeTileset)], { type: "application/json" });
    const tilesetUrl = URL.createObjectURL(blob);

    const tiles = this.tiles = new TilesRenderer(tilesetUrl);

    // 「選択段階」での読み込み量を増やす方向にチューニング
    tiles.stopAtEmptyTiles = false;   // 空タイルでもさらに潜る
    tiles.errorTarget = 0.0;          // 画面上の誤差許容量（小さいほど細かく読む）
    tiles.maxDepth = Infinity;

    // キュー/キャッシュ（必要に応じて）
    tiles.downloadQueue.maxJobs = 4;
    tiles.lruCache.maxSize = 128;

    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);

    // group を追加
    scene.add(tiles.group);

    // モデルがロードされた直後に Mesh のカリングを無効化（“表示後”のカリング対策）
    tiles.onLoadModel = (root /* THREE.Object3D */, tile) => {
      root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    };

    // tilesetが読めたらカメラ調整
    tiles.onLoadTileSet = () => {
      // 万一、b3dm が遠くに出ても見えるように far を拡大
      camera.far = 1e9;
      camera.updateProjectionMatrix();

      // 中心を向く（中心が取れない場合はスキップしてもOK）
      const box = new THREE.Box3().setFromObject(tiles.group);
      const center = new THREE.Vector3();
      box.getCenter(center);
      if (isFinite(center.x)) camera.lookAt(center);
    };

    tiles.onError = (err) => console.error("❌ タイル読み込みエラー:", err);
  }

  update() { this.tiles && this.tiles.update(); }
  dispose() {
    if (!this.tiles) return;
    this.tiles.dispose();
    if (this.tiles.group) this.scene.remove(this.tiles.group);
  }
}
