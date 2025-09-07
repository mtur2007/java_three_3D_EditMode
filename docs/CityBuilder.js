import * as THREE from "https://esm.sh/three@0.169";
import { TilesRenderer } from "https://esm.sh/3d-tiles-renderer@0.3.19";

export class BuildingSystem {
  constructor(b3dmUrl, camera, renderer, scene) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // 仮の tileset JSON
    const fakeTileset = {
      asset: { version: "1.0" },
      geometricError: 500,
      root: {
        boundingVolume: { box: [0,0,0, 50,0,0, 0,50,0, 0,0,50] },
        geometricError: 500,
        refine: "ADD",
        children: [
          {
            boundingVolume: { box: [0,0,0, 50,0,0, 0,50,0, 0,0,50] },
            geometricError: 0,
            content: { uri: b3dmUrl }
          }
        ]
      }
    };

    const blob = new Blob([JSON.stringify(fakeTileset)], { type: "application/json" });
    const tilesetUrl = URL.createObjectURL(blob);

    this.tiles = new TilesRenderer(tilesetUrl);
    this.tiles.lruCache.maxSize = 1;
    this.tiles.downloadQueue.maxJobs = 1;

    this.tiles.setCamera(camera);
    this.tiles.setResolutionFromRenderer(camera, renderer);

    scene.add(this.tiles.group);

    this.tiles.onLoadTileSet = () => {
      console.log("✅ b3dm 読み込み完了");

      const box = new THREE.Box3().setFromObject(this.tiles.group);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // カメラを中心に向ける
      const size = box.getSize(new THREE.Vector3()).length();
      camera.position.set(center.x + size, center.y + size*0.5, center.z + size);
      camera.up.set(0,1,0);
      camera.lookAt(center);
      // --------------------------
      // transform 行列の逆適用で水平化
      // --------------------------
      const rootTransform = this.tiles.tileset.root?.transform; 
      if(rootTransform){
        const m = new THREE.Matrix4();
        m.fromArray(rootTransform);
        const mInv = new THREE.Matrix4();
        mInv.copy(m).invert(); // 逆行列

        // wrapper グループを作り逆行列を適用
        const wrapper = new THREE.Group();
        wrapper.add(this.tiles.group);
        wrapper.applyMatrix4(mInv);  // 逆行列適用で水平化
        this.scene.add(wrapper);
      }
    };

    this.tiles.onError = (err) => console.error("❌ タイル読み込みエラー:", err);
  }

  update() {
    if (this.tiles) this.tiles.update();
  }

  dispose() {
    if (this.tiles) {
      this.tiles.dispose();
      if (this.tiles.group) this.scene.remove(this.tiles.group);
    }
  }
}
