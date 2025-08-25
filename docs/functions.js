// functions.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169/build/three.module.js';

export class TrainSystem {
  constructor(scene) {
    this.scene = scene;
  }

  Map_pin(x, z, height = 5, Thickness = 0.5, color = 0xff0000) {
    const geometry = new THREE.BoxGeometry(Thickness, height - 2, Thickness);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.set(x, height / 2, z);
    this.scene.add(pillar);
  }


  //三角関数(ラジアンの方向可視化)
  getArrowSymbolFromAngle(deg,red) {
    if (red){
      const angle = (radian + 2 * Math.PI) % (2 * Math.PI); // 0〜2π に正規化
      deg = angle * (180 / Math.PI); // 度数に変換
    };
  
    if (deg >= 337.5 || deg < 22.5) return '↑'+deg;
    if (deg >= 22.5 && deg < 67.5) return '↗'+deg;
    if (deg >= 67.5 && deg < 112.5) return '→'+deg;
    if (deg >= 112.5 && deg < 157.5) return '↘'+deg;
    if (deg >= 157.5 && deg < 202.5) return '↓'+deg;
    if (deg >= 202.5 && deg < 247.5) return '↙'+deg;
    if (deg >= 247.5 && deg < 292.5) return '←'+deg;
    if (deg >= 292.5 && deg < 337.5) return '↖'+deg;
  }
  
  degToRad(deg) {
    return deg * (Math.PI / 180);
  }
  
  radToDeg(rad) {
    return rad * (180 / Math.PI);
  }
  
  vectorToDegreesXZ(vector) {
    let angleRad = Math.atan2(vector.x, vector.z); // Z前方基準
    let angleDeg = angleRad * (180 / Math.PI);
    return (angleDeg + 360) % 360; // 0〜360度に正規化
  }
    
  normalizeRad(rad) {
    return (rad % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  }
  
  getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }
  
  getPointByDistanceRatio(curvePoints, ratio) {
    const totalLength = curvePoints.length;
    const index = Math.floor(ratio * totalLength);
    return curvePoints[Math.min(index, totalLength - 1)];
  }
  
  createDebugSphere(position, radius = 0.1, color = 0xff0000) {
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(position.x, position.y, position.z);
    this.scene.add(sphere);
    return sphere;  // 必要なら戻り値でMeshを返す
  }
  
  // 線路表示
  createTrack(curve, color = 0x333333) {
    const points = curve.getPoints(100);
    // すべての点にY座標を追加 or 修正（例：Y=1.5）
    for (let i = 0; i < points.length; i++) {
      points[i].y += 0.865;
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x000000 });
    const line = new THREE.Line(geom, mat);
    this.scene.add(line);
  }  

  //---- 軌道調整 ----

  // 線路から均等に空ける関数
  RailMargin(points, margin, angle=false){
    const edit_points = structuredClone(points); // 深いコピーを作る（破壊防止）
    const angles_y = []
  
    for (let i = 0; i < points.length; i++){
      const rear = i > 0 ? points[i - 1] : points[i];
      const now = points[i];
      const next = i < points.length-1 ? points[i + 1] : points[i];
  
      let rear_atan2 = this.normalizeRad(Math.atan2(now.x - rear.x, now.z - rear.z));
      let next_atan2 = this.normalizeRad(Math.atan2(now.x - next.x, now.z - next.z));
      if (i === 0){
        rear_atan2 = next_atan2 + 180 * Math.PI / 180;
      } else if (i === points.length-1){
        next_atan2 = rear_atan2 + 180 * Math.PI / 180;
      }
  
      let whole = next_atan2 - rear_atan2;
      if (whole < 0) whole += Math.PI * 2;
  
      const diff = rear_atan2 + whole * 0.5;
  
      edit_points[i].x = now.x - Math.sin(diff) * margin;
      edit_points[i].z = now.z - Math.cos(diff) * margin;
      
      angles_y.push(diff)
    }
    if (angle){return [edit_points,angles_y]}else{return edit_points}
  }

  // 線路の座標を指定されたmで均等に分ける為の関数
  getPointsEveryM(curve, interval = 25) {
    const length = curve.getLength();
    const divisions = Math.floor(length / interval);
    const points = [];

    let num = divisions
    for (let i = 0; i <= divisions; i++) {
        const t = Math.min((interval * i) / length,1);
        const point = curve.getPointAt(t).clone();
        points.push(point);
    }

    return points;
    }

  // --- 角度計算 ---
  
  // 縦方向の角度を求める関数
  getVerticalAngle(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
  
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const verticalAngle = Math.atan2(dy, horizontalDistance);  // ラジアン
  
    return verticalAngle;
  }
  
  scaleVectors(vectors, scale = 1.0) {
    return vectors.map(([x, y]) => [x * scale, y * scale]);
  }
  
  // --- 物体操作 ----
  object_update({
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

  //物体を生成する補助関数
  createBoxBetweenPoints3D(p1, p2, thickness, depth, material) {
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

  // --- 鉄橋用ユーティリティ ---
  // 柱
  createBridgePillar(x, z, height = 5) {
    const geometry = new THREE.BoxGeometry(0.2, height, 0.2);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x555555,
      side: THREE.FrontSide
    });
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.set(x, height / 2, z);
    pillar.name = 'Pillar';
    this.scene.add(pillar);
  }
  
  // 橋面(高架橋の上面・床)
  createBridgeGirder(curve) {
    const points_center = this.RailMargin(this.getPointsEveryM(curve, 0.3), 0,true);
    const points = points_center[0]
    const angles = points_center[1]
  
    const geometry = new THREE.BoxGeometry(0.12, 0.05, 0.9);
    const material = new THREE.MeshStandardMaterial({
      color: 0x603513,     // 石っぽいグレー（DimGray）
      roughness: 0.4,      // 表面ザラザラ（石っぽさを出す）
      metalness: 0.8,      // 金属感なし
      side: THREE.FrontSide
    });
  
    const sleeper = new THREE.InstancedMesh(geometry, material, points.length);
  
    for(let i = 0; i<points.length; i++){
      const pos = points[i]//-0.95
      this.object_update({ins_obj: sleeper, ins_idx: i, pos_x: pos.x,  pos_y: pos.y, pos_z: pos.z, rot_x: NaN, rot_y: angles[i], rot_z: NaN,scale: NaN})
    }

    this.scene.add(sleeper)
  
  }
  // 床板(コンクリート床)
  createDeckSlab(start, end) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const dy = end.y - start.y;
  
    const length = Math.sqrt(dx * dx + dz * dz);
    const geometry = new THREE.BoxGeometry(length, 0.2 ,1.75);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      side: THREE.FrontSide
    });
    const girder = new THREE.Mesh(geometry, material);
    girder.position.set(
      (start.x + end.x) / 2,
       start.y +dy/2,
      (start.z + end.z) / 2
    );
    girder.rotation.y = Math.atan2(dx,dz)-1.57;
    girder.rotation.z = Math.atan2(dy,length);
    girder.name = 'DeckSlab'
    this.scene.add(girder);
  }

  // 高架線路生成(線型に沿う)
  generateElevated(curve, pillarInterval = 10, interval = 25) {
    const points = this.getPointsEveryM(curve, interval);
    for (let i = 0; i < points.length; i += pillarInterval) {
      const p = points[i];
      this.createBridgePillar(p.x, p.z, p.y);
  
      if (i + pillarInterval < points.length) {
        const p2 = points[i + pillarInterval];
        this.createDeckSlab(p, p2);
      }
    }
  } 
  
  // 線路 ,I...I,
  rawRail(points_data){
    const points = points_data[0]
    const angles = points_data[1]
    
    //   0123456
    // 7 .#---#.
    // 6 ..\./..
    // 5 ..#.#..
    // 4 ..|.|..
    // 3.5  ◆
    // 3 ..|.|..
    // 2 ..|.|..
    // 1 . #.#..
    // 0 #-----#
    const baseVectors = [
      [  0.07,  0.175 ],
      [ -0.07,  0.175 ],
      [  0.02,  0.075 ],
      [ -0.02,  0.075 ],
      [  0.02, -0.125 ],
      [ -0.02, -0.125 ],
      [  0.14, -0.15 ],
      [ -0.14, -0.15 ]
    ];
    
    // 任意の倍率（例：0.5倍）
    const scaleFactor = 0.25;
    const scaledVectors_plane = this.scaleVectors(baseVectors, scaleFactor);
    
    const verticesArray = [];
    const vertexArray = [];
    
    let before_pos = points[0]
    for (let i = 0; i<points.length; i++){
      
      const pos = points[i]; //基準座標
  
      const anglex = this.getVerticalAngle(before_pos, pos);
      const angle_vertical = Math.cos(anglex)
      const angle_plene = Math.sin(anglex)
      // createDebugSphere(scene, pos, 0.01, 0xff0000);
      // createDebugSphere(scene, {x:0,y:0,z:0}, 0.01, 0xff0000);
      // 新しい座標配列（x, z の2D座標）
      scaledVectors_plane.map((theta, c) => {
  
        const y_new = pos.y+theta[1] * angle_vertical +0.17;
        let z_new = theta[1] * angle_plene
        let x_new = theta[0]
  
        // console.log(angles[i])
        const rotation_y = Math.atan2(z_new,x_new)+angles[i]// + i*90 * Math.PI / 180;
        const length = Math.sqrt(x_new**2 + z_new**2)
        x_new = pos.x+Math.sin(rotation_y)*length
        z_new = pos.z+Math.cos(rotation_y)*length
  
        const debugPos = { x: x_new, y: y_new, z: z_new };
        // createDebugSphere(scene, debugPos, 0.005, 0x00ff00);
  
        verticesArray.push(x_new, y_new, z_new);
      });
      if (i>1){
        // vertexArray.push((i-1)*8,(i-1)*8+1,i*8)
        // vertexArray.push((i-1)*8+1,i*8+1,i*8)
  
        // vertexArray.push(i*8+1,(i-1)*8+3,(i-1)*8+1)
        // vertexArray.push(i*8+1,i*8+3,(i-1)*8+3)
  
        // vertexArray.push(i*8+3,(i-1)*8+5,(i-1)*8+3)
        // vertexArray.push(i*8+3,i*8+5,(i-1)*8+5)
  
        // vertexArray.push((i-1)*8+5,(i-1)*8+7,i*8+5)
        // vertexArray.push((i-1)*8+7,i*8+7,i*8+5)
  
        // // -----------------------------------------
  
        // vertexArray.push((i-1)*8+2,(i-1)*8+4,i*8+2)
        // vertexArray.push((i-1)*8+4,i*8+4,i*8+2)
  
        // vertexArray.push((i-1)*8+4,(i-1)*8+6,i*8+4)
        // vertexArray.push((i-1)*8+6,i*8+6,i*8+4)
  
        // vertexArray.push((i-1)*8,(i-1)*8+2,i*8)
        // vertexArray.push((i-1)*8+2,i*8+2,i*8)
        // =========================================
        // vertexArray.push(i*8,(i-1)*8+1,(i-1)*8)
        // vertexArray.push(i*8,i*8+1,(i-1)*8+1)
  
        // vertexArray.push(i*8+1,(i-1)*8+3,(i-1)*8+1)
        // vertexArray.push(i*8+1,i*8+3,(i-1)*8+3)
  
        // vertexArray.push(i*8+3,(i-1)*8+5,(i-1)*8+3)
        // vertexArray.push(i*8+3,i*8+5,(i-1)*8+5)
  
        // vertexArray.push((i-1)*8+5,(i-1)*8+7,i*8+5)
        // vertexArray.push((i-1)*8+7,i*8+7,i*8+5)
  
        // // -----------------------------------------
  
        // vertexArray.push((i-1)*8+2,(i-1)*8+4,i*8+2)
        // vertexArray.push((i-1)*8+4,i*8+4,i*8+2)
  
        // vertexArray.push((i-1)*8+4,(i-1)*8+6,i*8+4)
        // vertexArray.push((i-1)*8+6,i*8+6,i*8+4)
  
        // vertexArray.push((i-1)*8,(i-1)*8+2,i*8)
        // vertexArray.push((i-1)*8+2,i*8+2,i*8)
  
        // =========================================
  
        vertexArray.push((i-1)*8,(i-1)*8+1,i*8)
        vertexArray.push((i-1)*8+1,i*8+1,i*8)
  
        vertexArray.push((i-1)*8+1,(i-1)*8+3,i*8+1)
        vertexArray.push((i-1)*8+3,i*8+3,i*8+1)
  
        vertexArray.push((i-1)*8+3,(i-1)*8+5,i*8+3)
        vertexArray.push((i-1)*8+5,i*8+5,i*8+3)
  
        vertexArray.push((i-1)*8+5,(i-1)*8+7,i*8+5)
        vertexArray.push((i-1)*8+7,i*8+7,i*8+5)
  
        // -----------------------------------------
  
        vertexArray.push((i-1)*8+4,(i-1)*8+2,i*8+2)
        vertexArray.push(i*8+2,i*8+4,(i-1)*8+4)
  
        vertexArray.push(i*8+4,(i-1)*8+6,(i-1)*8+4)
        vertexArray.push(i*8+4,i*8+6,(i-1)*8+6)
  
        vertexArray.push(i*8,(i-1)*8+2,(i-1)*8)
        vertexArray.push(i*8,i*8+2,(i-1)*8+2)
  
      }
      // console.log(rotatedPositions);
      before_pos = pos
    }
  
    // 最後にFloat32Arrayに変換
    const vertices = new Float32Array(verticesArray);
    
    // BufferGeometryにセット
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  
    geometry.setIndex(vertexArray); // 2枚の三角形で四角形に
    geometry.computeVertexNormals(); // 光の当たり具合を正しくする
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x603513,
      metalness: 1,   // 金属っぽさ（0〜1）
      roughness: 0.3,   // 表面の粗さ（0：つるつる、1：ザラザラ）
      envMapIntensity: 3,    // 環境マップの反射強度（envMapを使うなら）
      side: THREE.FrontSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Rail'
    this.scene.add(mesh);
  
  }

  createRail(curve, interval){
    const points_right = this.RailMargin(curve.getPoints(70), 0.24,true);
    const points_lift = this.RailMargin(curve.getPoints(70), -0.24,true);
    const points_center = this.RailMargin(this.getPointsEveryM(curve, 0.3), 0,true);
    const points = points_center[0]
    const angles = points_center[1]
  
    const geometry = new THREE.BoxGeometry(0.12, 0.05, 0.95);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x999999,     // 石っぽいグレー（DimGray）
      roughness: 0.9,      // 表面ザラザラ（石っぽさを出す）
      metalness: 0.0,      // 金属感なし
      side: THREE.FrontSide
    });
    const loc_geometry = new THREE.BoxGeometry(0.05, 0.02, 0.1);
    const loc_material = new THREE.MeshStandardMaterial({
      color: 0x774513,
      metalness: 1,   // 金属っぽさ（0〜1）
      roughness: 0.5,   // 表面の粗さ（0：つるつる、1：ザラザラ）
      side: THREE.FrontSide
    });
  
    const sleeper = new THREE.InstancedMesh(geometry, stoneMaterial, points.length);
    const loc = new THREE.InstancedMesh(loc_geometry, loc_material, points.length*2);
    for(let i = 0; i<points.length; i++){
      const pos = points[i]
      this.object_update({ins_obj: sleeper, ins_idx: i, pos_x: pos.x,  pos_y: pos.y+0.1, pos_z: pos.z, rot_x: NaN, rot_y: angles[i], rot_z: NaN,scale: NaN})
      const x_sin = Math.sin(angles[i])
      const z_cos = Math.cos(angles[i])
      this.object_update({ins_obj: loc, ins_idx: i*2, pos_x: pos.x+x_sin*0.245,  pos_y: pos.y+0.14, pos_z: pos.z+z_cos*0.21, rot_x: NaN, rot_y: angles[i], rot_z: NaN,scale: NaN})
      this.object_update({ins_obj: loc, ins_idx: i*2+1, pos_x: pos.x+x_sin*-0.245,  pos_y: pos.y+0.14, pos_z: pos.z+z_cos*-0.21, rot_x: NaN, rot_y: angles[i], rot_z: NaN,scale: NaN})
  
    }
    sleeper.name = 'Rail'
    this.scene.add(sleeper)
    loc.name = 'Rail'
    this.scene.add(loc)
  
    this.rawRail(points_right)
    this.rawRail(points_lift)
    
  }
  
  // 壁の生成
  createWall(track_1,track_2,quantity,margin_1=0.8,margin_2=-0.8,y_1=0,y_2=0,color=0x666666,material=false){
    const board_length_1 = track_1.getLength(track_1)/quantity;
    const board_length_2 = track_2.getLength(track_2)/quantity;
    const points_1 = this.RailMargin(this.getPointsEveryM(track_1, board_length_1), margin_1);
    const points_2 = this.RailMargin(this.getPointsEveryM(track_2, board_length_2), margin_2);
    
    const verticesArray = [];
    const vertexArray = [];
  
    for(let i=0; i < points_1.length; i++){
      const coordinate1 = points_1[i]
      verticesArray.push(coordinate1.x, coordinate1.y+y_1, coordinate1.z)
      const coordinate2 = points_2[i]
      verticesArray.push(coordinate2.x, coordinate2.y+y_2, coordinate2.z)
      if (i < points_1.length-2){
        vertexArray.push(i*2,i*2+1,i*2+2);
        vertexArray.push(i*2+3,i*2+2,i*2+1);
      }
    }
  
    // 最後にFloat32Arrayに変換
    const vertices = new Float32Array(verticesArray);
    
    // BufferGeometryにセット
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  
    geometry.setIndex(vertexArray); // 2枚の三角形で四角形に
    geometry.computeVertexNormals(); // 光の当たり具合を正しくする
    
    if (material === false){material =  new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide })};
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    
  }

  // 架線柱 トラス型                   ,__________|¯'¯|_______________|¯'¯|__________,
  createCatenaryPole(left_height, right_height, beamLength, beam_height, makes) {//
    const pos_x = 0 //　             |_|_/_\_/_\_|_|_/_\_/_\_/_\_/_\_|_|_/_\_/_\_|_|
    const pos_y = 0 //　             |X|/      ___|___             ___|___      \|X|
    const pos_z = 0 //　             |X|        ¯¯¥¯¯               ¯¯¥¯¯        |X|
    const Poles = new THREE.Group(); // 　　　 　　　　                            |X|
    const Side_len = 0.1 //　        |X|                                         |X|
    const board_rotation = 45 * Math.PI / 180; // /_ 45度  　　　                 |X|
    //　                             |X|__,I,,,I,__,I,,,I,_____,I,,,I,__,I,,,I,__|X|
    const rotation_x_len = Math.sin(board_rotation)*Side_len*0.8
    const board_xlen = (Side_len/rotation_x_len)*rotation_x_len+rotation_x_len
    const boardGeometry = new THREE.BoxGeometry(board_xlen, 0.02, 0.01);
    const poleMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xaaaaaa,
      metalness: 1,   // 金属っぽさ（0〜1）
      roughness: 0.6,   // 表面の粗さ（0：つるつる、1：ザラザラ）
      envMapIntensity: 1,    // 環境マップの反射強度（envMapを使うなら）
      side: THREE.FrontSide
     });
    const board = new THREE.InstancedMesh(boardGeometry, poleMaterial, ((right_height/Side_len)*4+(left_height/Side_len)*4+(beamLength/Side_len)*4));
  
    right_height = right_height-right_height%Side_len
    left_height = left_height-left_height%Side_len
    beam_height = beam_height-beam_height%Side_len
    beamLength = beamLength-beamLength%Side_len
  
    let plus_index = 0
    const Pole = new THREE.Group();
  
    if (right_height != 0){
      for (let i =0; i<right_height/Side_len; i++){
        if (i%2===0){
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_x: pos_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z+Side_len*0.5, rot_x: NaN, rot_y: 0 * Math.PI / 180, rot_z: board_rotation,scale: NaN})      
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_x: pos_x+Side_len*0.5,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: board_rotation,scale: NaN})  
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_x: pos_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z-Side_len*0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_x: pos_x-Side_len*0.5,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
        } else {
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_x: pos_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z+Side_len*0.5, rot_x: NaN, rot_y: 0 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_x: pos_x+Side_len*0.5,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_x: pos_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z-Side_len*0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: -board_rotation,scale: NaN})
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_x: pos_x-Side_len*0.5,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
        }
        
      }
      const poleGeometry_right = new THREE.BoxGeometry(0.02, right_height, 0.02);
      const pole_right = new THREE.Mesh(poleGeometry_right, poleMaterial);
      pole_right.position.set(pos_x+Side_len*0.5,pos_y+right_height*0.5,pos_z+Side_len*0.5)
      Pole.add(pole_right.clone());
      pole_right.position.set(pos_x+Side_len*0.5,pos_y+right_height*0.5,pos_z-Side_len*0.5)
      Pole.add(pole_right.clone());
      pole_right.position.set(pos_x-Side_len*0.5,pos_y+right_height*0.5,pos_z+Side_len*0.5)
      Pole.add(pole_right.clone());
      pole_right.position.set(pos_x-Side_len*0.5,pos_y+right_height*0.5,pos_z-Side_len*0.5)
      Pole.add(pole_right.clone());
    
      plus_index += (right_height/Side_len)*4
    }
  
    if (left_height != 0){
      const move_x = beamLength-Side_len
      for (let i =0; i<left_height/Side_len; i++){
        if (i%2===0){
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_x: pos_x+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z+Side_len*0.5, rot_x: NaN, rot_y: 0 * Math.PI / 180, rot_z: board_rotation,scale: NaN})      
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_x: pos_x+Side_len*0.5+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: board_rotation,scale: NaN})  
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_x: pos_x+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z-Side_len*0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_x: pos_x-Side_len*0.5+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
        } else {
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_x: pos_x+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z+Side_len*0.5, rot_x: NaN, rot_y: 0 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_x: pos_x+Side_len*0.5+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_x: pos_x+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z-Side_len*0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: -board_rotation,scale: NaN})
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_x: pos_x-Side_len*0.5+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
        }
      }
      const poleGeometry_left = new THREE.BoxGeometry(0.02, left_height, 0.02);
      const pole_left = new THREE.Mesh(poleGeometry_left, poleMaterial);
      pole_left.position.set(pos_x+Side_len*0.5+move_x,pos_y+left_height*0.5,pos_z+Side_len*0.5)
      Pole.add(pole_left.clone());
      pole_left.position.set(pos_x+Side_len*0.5+move_x,pos_y+left_height*0.5,pos_z-Side_len*0.5)
      Pole.add(pole_left.clone());
      pole_left.position.set(pos_x-Side_len*0.5+move_x,pos_y+left_height*0.5,pos_z+Side_len*0.5)
      Pole.add(pole_left.clone());
      pole_left.position.set(pos_x-Side_len*0.5+move_x,pos_y+left_height*0.5,pos_z-Side_len*0.5)
      Pole.add(pole_left.clone());
    
      plus_index += (left_height/Side_len)*4
    }
    
    // scene.add(Pole2)
  
    for (let i =0; i<beamLength/Side_len; i++){
      if (i%2===0){
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_y: beam_height-Side_len*0.5,  pos_x: Side_len*i, pos_z: Side_len*0.5, rot_y: NaN, rot_x: 0 * Math.PI / 180, rot_z: board_rotation,scale: NaN})      
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_y: beam_height,  pos_x: Side_len*i, pos_z: 0, rot_y: NaN, rot_x: 270 * Math.PI / 180, rot_z: board_rotation,scale: NaN})  
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_y: beam_height-Side_len*0.5,  pos_x: Side_len*i, pos_z: -Side_len*0.5, rot_y: NaN, rot_x: 180 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_y: beam_height-Side_len,  pos_x: Side_len*i, pos_z: 0, rot_y: NaN, rot_x: 90 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
      } else {
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_y: beam_height-Side_len*0.5,  pos_x: Side_len*i, pos_z: Side_len*0.5, rot_y: NaN, rot_x: 0 * Math.PI / 180, rot_z: -board_rotation,scale: NaN})      
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_y: beam_height,  pos_x: Side_len*i, pos_z: 0, rot_y: NaN, rot_x: 270 * Math.PI / 180, rot_z: -board_rotation,scale: NaN})  
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_y: beam_height-Side_len*0.5,  pos_x: Side_len*i, pos_z: -Side_len*0.5, rot_y: NaN, rot_x: 180 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_y: beam_height-Side_len,  pos_x: Side_len*i, pos_z: 0, rot_y: NaN, rot_x: 90 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
      }
    }
  
    const poleGeometry_beam = new THREE.BoxGeometry(beamLength, 0.02, 0.02);
    const pole_beam = new THREE.Mesh(poleGeometry_beam, poleMaterial);
    pole_beam.position.set(beamLength*0.5-Side_len*0.5,beam_height-Side_len,Side_len*0.5)
    Pole.add(pole_beam.clone());
    pole_beam.position.set(beamLength*0.5-Side_len*0.5,beam_height,-Side_len*0.5)
    Pole.add(pole_beam.clone());
    pole_beam.position.set(beamLength*0.5-Side_len*0.5,beam_height,Side_len*0.5)
    Pole.add(pole_beam.clone());
    pole_beam.position.set(beamLength*0.5-Side_len*0.5,beam_height-Side_len,-Side_len*0.5)
    Pole.add(pole_beam.clone());
  
    Pole.add(board)
  
    Pole.rotation.y += -90 * Math.PI / 180
    plus_index += (beamLength/Side_len)*4
  
    for (let i=0; i<makes; i++){Poles.add(Pole.clone())}
    return Poles
  }
  

  // --- 駅用ユーティリティ ---
  // 駅
  createStation(track_1,track_2,delicacy,y,margin,a){

    const points_1 = track_1.getPoints(delicacy);
    const points_2 = track_2.getPoints(delicacy);
  
    let track_1_s = 0;
    let track_1_after = track_1_s
    let track_1_m = points_1[0];
    let track_1_f = points_1[1];
  
    let track_2_s = 0;
    let track_2_after = track_2_s
    let track_2_m = points_2[0];
    let track_2_f = points_2[1];
  
    let track_1_diff = 0
    let track_2_diff = 0
  
    let track_1a_atan2 = 0
    let track_1b_atan2 = 0
  
    let track_2a_atan2 = 0
    let track_2b_atan2 = 0
  
    for (let i = 1; i < delicacy-3; i++) {
  
      track_1_after = track_1_m.clone();
  
      track_1_s = points_1[i-1].clone();
      track_1_m = points_1[i].clone();
      track_1_f = points_1[i+1].clone();
  
      track_1a_atan2 = this.normalizeRad(Math.atan2(track_1_m.x-track_1_s.x,track_1_m.z-track_1_s.z));
      track_1b_atan2 = this.normalizeRad(Math.atan2(track_1_m.x-track_1_f.x,track_1_m.z-track_1_f.z));
      track_1b_atan2 -= track_1a_atan2;
      if (track_1b_atan2 < 0) {track_1b_atan2 += 6.283185307179586};
     
      track_1_diff = track_1a_atan2+track_1b_atan2*0.5;
      track_1_m.x -= Math.sin(track_1_diff) *margin; // dx
      track_1_m.z -= Math.cos(track_1_diff) *margin; // dy
     
      track_2_after = track_2_m.clone();
  
      track_2_s = points_2[i-1].clone();
      track_2_m = points_2[i].clone();
      track_2_f = points_2[i+1].clone();
  
      track_2a_atan2 = this.normalizeRad(Math.atan2(track_2_s.x-track_2_m.x,track_2_s.z-track_2_m.z));
      track_2b_atan2 = this.normalizeRad(Math.atan2(track_2_f.x-track_2_m.x,track_2_f.z-track_2_m.z));
  
      track_2b_atan2 -= track_2a_atan2;
      if (track_2b_atan2 < 0) {track_2b_atan2 += 6.283185307179586}
    
      track_2_diff = track_2a_atan2-track_2b_atan2*0.5;
  
      track_2_m.x += Math.sin(track_2_diff) *margin; // dx
      track_2_m.z += Math.cos(track_2_diff) *margin; // dy
  
      const shape = new THREE.Shape();
      shape.moveTo(track_1_after.x, track_1_after.z);
      shape.lineTo(track_1_m.x, track_1_m.z);
      shape.lineTo(track_2_m.x, track_2_m.z);
      shape.lineTo(track_2_after.x, track_2_after.z);
  
      const materials = [
        new THREE.MeshStandardMaterial({ color: 0x222222 }), // right
        new THREE.MeshStandardMaterial({ color: 0x444444 }), // left
        new THREE.MeshStandardMaterial({ color: 0x000000 }), // top
        new THREE.MeshStandardMaterial({ color: 0x000000 }), // bottom
        new THREE.MeshStandardMaterial({ color: 0x111111 }), // front
        new THREE.MeshStandardMaterial({ color: 0x000000 })  // back
      ];
      
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
      const material = new THREE.MeshBasicMaterial({ color: 0x869989, side: THREE.FrontSide });
      const mesh = new THREE.Mesh(geometry, materials);
  
      mesh.rotation.x = 90 * Math.PI / 180;
      mesh.position.y = y-0.4; // 高さ1.5に移動
  
      this.scene.add(mesh);
      
    }
  }
  // ホーム屋根 の作成
  placePlatformRoof(track_1,track_2,y,quantity) {
  
    const board_length_1 = track_1.getLength(track_1)/quantity;
    const board_length_2 = track_2.getLength(track_2)/quantity;
    const points_1 = this.RailMargin(this.getPointsEveryM(track_1, board_length_1), 0.7);
    const points_2 = this.RailMargin(this.getPointsEveryM(track_2, board_length_2), -0.7);
    
    if (points_1.length != points_2.length){console.log('Err: 不均一')}
  
  
    // 1. テクスチャ読み込み
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('textures/roof.png');
    texture.colorSpace = THREE.SRGBColorSpace;
  
    // 表示位置
    texture.repeat.set(0.2, 0.2);   // サイズを50%
    texture.offset.set(0.25, 0.25); // 真ん中に寄せる
    
    // 2. 繰り返し設定
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  
    // 3. 幾何体サイズ（例：10m × 5m）
    const width = 0.6;
    const height = 0.4;
  
    // 4. 画像1枚 = 1m四方とみなして、自動で repeat を計算
    texture.repeat.set(width / 1, height / 1);
  
    // 5. マテリアルに貼る
    const material = new THREE.MeshStandardMaterial({ map: texture });
  
    const diff_x = points_1[0].x - points_2[0].x
    const diff_z = points_1[0].z - points_2[0].z
  
    let middle_0 = {}
    let middle_1 = {
      x: points_1[0].x - diff_x / 2,
      z: points_1[0].z - diff_z / 2
    }
  
    for (let i = 0; i < points_1.length-1; i++){
  
      // for (let i = 0; i < 1; i++){
      const diff_x = points_1[i+1].x - points_2[i+1].x
      const diff_z = points_1[i+1].z - points_2[i+1].z
  
      middle_0 = middle_1
      middle_1 = {
        x: points_1[i+1].x - diff_x / 2,
        z: points_1[i+1].z - diff_z / 2
      }
  
      // １番線
      const corner_1 = {
        x: middle_0.x - middle_1.x, 
        z: middle_0.z - middle_1.z}
      const diff_rotation = 0 - Math.atan2(corner_1.x,corner_1.z)
      const fixes_rotation_1 = Math.atan2(corner_1.x,corner_1.z) + diff_rotation
      const radius_1 = Math.sqrt(corner_1.x**2 + corner_1.z**2)
  
      const geometry = new THREE.BoxGeometry(0.15, 1.4, 0.15);
      const roofpillar = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({color: 0xaaaaaa}), 4);
      roofpillar.position.x = middle_0.x-corner_1.x/2
      roofpillar.position.y = y-1.1
      roofpillar.position.z = middle_0.z-corner_1.z/2
      this.scene.add(roofpillar)
  
      const corner_2 = {
        x: middle_0.x - points_1[i].x, 
        z: middle_0.z - points_1[i].z}
      const fixes_rotation_2 = Math.atan2(corner_2.x,corner_2.z) + diff_rotation
      const radius_2 = Math.sqrt(corner_2.x**2 + corner_2.z**2)
  
      const corner_3 = {
        x: middle_0.x - points_1[i+1].x, 
        z: middle_0.z - points_1[i+1].z}
      const fixes_rotation_3 = Math.atan2(corner_3.x,corner_3.z) + diff_rotation
      const radius_3 = Math.sqrt(corner_3.x**2 + corner_3.z**2)
  
      // Map_pin(middle_0.x,middle_0.z,15,0.05,0x00ff00)
      // Map_pin(points_1[i].x,points_1[i].z,15,0.05,0x0000ff)
  
      // Map_pin(middle_1.x,middle_1.z,15,0.05,0x00ff00)
      // Map_pin(points_1[i+1].x,points_1[i+1].z,15,0.05,0x0000ff)
  
      const board_1 = new THREE.Shape();
      board_1.moveTo(0, 0);
      board_1.lineTo(Math.sin(fixes_rotation_1) * radius_1, Math.cos(fixes_rotation_1) * radius_1);
      board_1.lineTo(Math.sin(fixes_rotation_3) * radius_3,Math.cos(fixes_rotation_3) * radius_3);
      board_1.lineTo(Math.sin(fixes_rotation_2) * radius_2, Math.cos(fixes_rotation_2) * radius_2);
  
      const geometry_1 = new THREE.ExtrudeGeometry(board_1, { depth: 0.1, bevelEnabled: false });
      const mesh_1 = new THREE.Mesh(geometry_1, material);
  
      mesh_1.rotation.z = Math.atan2(corner_1.x,corner_1.z)
      mesh_1.rotation.x = -90 * Math.PI / 180;
      
      const cornerA = new THREE.Vector3(
        0, 
        0,
        0
      );
      
      const cornerB = new THREE.Vector3(
        Math.sin(fixes_rotation_1) * radius_1,
        Math.cos(fixes_rotation_1) * radius_1,
        0
      );
  
      // 1. 最新の点Aと点Bを取得（ローカル or ワールド座標で）
      const pointA_world = mesh_1.localToWorld(cornerA.clone());
      const pointB_world = mesh_1.localToWorld(cornerB.clone());
  
      // 2. 回転軸 = B - A（単位ベクトルに正規化）
      const axis = new THREE.Vector3().subVectors(pointB_world, pointA_world).normalize();
  
      // 3. クォータニオンで回転
      const angle = -170 * Math.PI / 180; // 例えば毎回2度ずつ回転させたいとき
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  
      // 4. 回転を適用
      mesh_1.applyQuaternion(quat);
  
      mesh_1.position.x = middle_0.x
      mesh_1.position.z = middle_0.z
      mesh_1.position.y = y-0.4; // 高さ1.5に移動
    
      this.scene.add(mesh_1);
  
      // 2番線
      const corner2_1 = {
        x: middle_0.x - middle_1.x, 
        z: middle_0.z - middle_1.z}
      const diff_rotation2 = 0 - Math.atan2(corner2_1.x,corner2_1.z)
      const fixes_rotation2_1 = Math.atan2(corner2_1.x,corner2_1.z) + diff_rotation2
      const radius2_1 = Math.sqrt(corner2_1.x**2 + corner2_1.z**2)
  
      const corner2_2 = {
        x: middle_0.x - points_2[i].x, 
        z: middle_0.z - points_2[i].z}
      const fixes_rotation2_2 = Math.atan2(corner2_2.x,corner2_2.z) + diff_rotation2
      const radius2_2 = Math.sqrt(corner2_2.x**2 + corner2_2.z**2)
  
      const corner2_3 = {
        x: middle_0.x - points_2[i+1].x, 
        z: middle_0.z - points_2[i+1].z}
      const fixes_rotation2_3 = Math.atan2(corner2_3.x,corner2_3.z) + diff_rotation2
      const radius2_3 = Math.sqrt(corner2_3.x**2 + corner2_3.z**2)
  
      // Map_pin(points_2[i].x,points_2[i].z,15,0.05,0xff0000)
      // Map_pin(points_2[i+1].x,points_2[i+1].z,15,0.05,0x000000)
  
      const board2_1 = new THREE.Shape();
      board2_1.moveTo(0, 0);
      board2_1.lineTo(Math.sin(fixes_rotation2_1) * radius2_1, Math.cos(fixes_rotation2_1) * radius2_1);
      board2_1.lineTo(Math.sin(fixes_rotation2_3) * radius2_3,Math.cos(fixes_rotation2_3) * radius2_3);
      board2_1.lineTo(Math.sin(fixes_rotation2_2) * radius2_2, Math.cos(fixes_rotation2_2) * radius2_2);
  
      const geometry2_1 = new THREE.ExtrudeGeometry(board2_1, { depth: 0.1, bevelEnabled: false });
      const mesh2_1 = new THREE.Mesh(geometry2_1, material);
  
      mesh2_1.rotation.z = Math.atan2(corner2_1.x,corner2_1.z)
      mesh2_1.rotation.x = -90 * Math.PI / 180;
      
      const corner2A = new THREE.Vector3(
        0, 
        0,
        0
      );
      
      const corner2B = new THREE.Vector3(
        Math.sin(fixes_rotation2_1) * radius2_1,
        Math.cos(fixes_rotation2_1) * radius2_1,
        0
      );
  
      // 1. 最新の点Aと点Bを取得（ローカル or ワールド座標で）
      const point2A_world = mesh2_1.localToWorld(corner2A.clone());
      const point2B_world = mesh2_1.localToWorld(corner2B.clone());
  
      // 2. 回転軸 = B - A（単位ベクトルに正規化）
      const axis2 = new THREE.Vector3().subVectors(point2B_world, point2A_world).normalize();
  
      // 3. クォータニオンで回転
      const angle2 = 170 * Math.PI / 180; // 例えば毎回2度ずつ回転させたいとき
      const quat2 = new THREE.Quaternion().setFromAxisAngle(axis2, angle2);
  
      // 4. 回転を適用
      mesh2_1.applyQuaternion(quat2);
  
      mesh2_1.position.x = middle_0.x
      mesh2_1.position.z = middle_0.z
      mesh2_1.position.y = y-0.4; // 高さ1.5に移動
    
      this.scene.add(mesh2_1);
  
    }
  }
  // ホームドア の生成
  placeTrainDoors(centerX, centerY, centerZ, angle, track_doors, totalLength = 4, doorCount = 4) {
    const spacing = totalLength / doorCount;   // ドア同士の中心間隔（例：1m）
    const doorWidth = 0.65;                    // ドアの横幅
    const half = (doorCount - 1) / 2;          // 例：4枚 → half = 1.5
  
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
  
    const fence_point = spacing/2;
    const fenceLength = spacing - doorWidth;
  
    const fence_material = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.3,
      roughness: 0.15,
      envMapIntensity: 1.0,
      side: THREE.FrontSide
    });
  
    for (let i = 0; i < doorCount; i++) {
      const offset = (i - half) * spacing;      // -1.5, 1 -0.5, 1 +0.5, 1 +1.5（m）(ドアの横幅4mの場合)
      const x = centerX + dirX * offset;
      const z = centerZ + dirZ * offset;
      const y = centerY;
  
      // ドア(開閉部分)（横:可変長, 高さ0.37m, 厚さ0.03m）
      const door_0 = new THREE.Group();
      
      let door_center = 0.37/2
      let leng_move_door = 0.05
      
      let door_object = new THREE.Mesh(new THREE.BoxGeometry(0.02, leng_move_door, doorWidth/2), fence_material)
      door_object.position.set(0,door_center-leng_move_door*0.5,0)
      door_0.add(door_object)
  
      door_object = new THREE.Mesh(new THREE.BoxGeometry(0.02, leng_move_door, doorWidth/2), fence_material)
      door_object.position.set(0,(-door_center)+leng_move_door*0.5,0)
      door_0.add(door_object)
      
      const over_space = 0.045
      const half_fence = (fenceLength/2) + over_space
      const half_fence_diff = half_fence/2 - over_space
      
      const door_1 = door_0.clone(true);
      
      door_center = doorWidth/4
      leng_move_door = 0.015
    
      door_object = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.37, leng_move_door), fence_material)
      door_object.position.set(0,0,(-door_center)+leng_move_door*0.5)
      door_0.add(door_object)
  
      door_object = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.37, leng_move_door), fence_material)
      door_object.position.set(0,0,door_center-leng_move_door*0.5)
      door_1.add(door_object)
  
  
      // ドア:右
      door_0.position.set(x+dirX*doorWidth/4, y+0.005, z+dirZ*doorWidth/4);
      door_0.rotation.y = angle;
    
      // ドア:左
      door_1.position.set(x-dirX*doorWidth/4, y+0.005, z-dirZ*doorWidth/4);
      door_1.rotation.y = angle;
    
      track_doors.add(door_0);
      track_doors.add(door_1);
  
      // 柵(非開閉部分)（横:可変長, 高さ0.45m, 厚さ0.07m）
      if ( i === 0 ){
        const fence_geometry = new THREE.BoxGeometry(0.07, 0.45, half_fence);
        const fence = new THREE.Mesh(fence_geometry, fence_material);
        
        // 高さ中央をY=ドア中心に（例：y+1）
        fence.position.set(centerX + dirX * (offset-fence_point+half_fence_diff), y, centerZ + dirZ * (offset-fence_point+half_fence_diff));
        fence.rotation.y = angle;
        this.scene.add(fence);
      }
      
      if (i === 3) {
        const fence_geometry = new THREE.BoxGeometry(0.07, 0.45, half_fence);
        const fence = new THREE.Mesh(fence_geometry, fence_material);
  
        // 高さ中央をY=ドア中心に（例：y+1）
        fence.position.set(centerX + dirX * (offset+fence_point-half_fence_diff), y, centerZ + dirZ * (offset+fence_point-half_fence_diff));
        fence.rotation.y = angle;
        this.scene.add(fence);
  
      } else {
        const fence_geometry = new THREE.BoxGeometry(0.07, 0.45, fenceLength);
        const fence = new THREE.Mesh(fence_geometry, fence_material);
  
        // 高さ中央をY=ドア中心に（例：y+1）
        fence.position.set(centerX + dirX * (offset+fence_point), y, centerZ + dirZ * (offset+fence_point));
        fence.rotation.y = angle;
        this.scene.add(fence);
      }
    }
    
    this.scene.add(track_doors);
    return track_doors;
  }

  // ホームドア場所の計算
  placePlatformDoors(curve, offset = 1, interval = 25, side = 'left') {
    const points = this.getPointsEveryM(curve, interval);
    let track_doors = new THREE.Group();
  
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
  
      const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);
      const dist = p1.distanceTo(p2);
  
      // 中点をラジアンと長さで計算
      const midX = p1.x + Math.sin(angle) * (dist / 2);
      const midZ = p1.z + Math.cos(angle) * (dist / 2);
  
      // 左右方向のオフセット
      const direction = (side === 'left') ? 1 : -1;
      const offsetAngle = angle + direction * Math.PI / 2;
  
      const x = midX - Math.sin(offsetAngle) * offset;
      const z = midZ - Math.cos(offsetAngle) * offset;
  
      track_doors = this.placeTrainDoors(x, p1.y-0.2, z, angle, track_doors, interval);  // 中心点と角度を渡すだけ！
    }
    return track_doors
  }
  
  // ---- エスカレーター ----
  // 斜め前カットのステップ形状を返す関数
  createEscalatorStepMesh() {
    const shape = new THREE.Shape();
    shape.moveTo(0.3, 0.15);    // 1. 上奥  
    shape.lineTo(0, 0.15);      // 2. 上手前 2 . - . 1
    shape.lineTo(0.015, 0.075); // 3. 中手前  3 .  |
    shape.lineTo(0.06, -0.015); // 4. 下       4  .
    // shape.lineTo(0.015, 0.075); // 3. 上手前
    // shape.lineTo(0, 0.15);      // 2. 中手前
  
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.8,               // ステップの奥行き
      bevelEnabled: false,
    });
  
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('textures/step.png'); // ← パスを適宜変更
    texture.colorSpace = THREE.SRGBColorSpace;
  
    const material = new THREE.MeshStandardMaterial({
      map: texture,           // ← テクスチャ画像を適用
      color: 0xffffff,        // ← 色も併用可能（色 × テクスチャ）
    });
  
    geometry.center(); // ← これを追加すると原点中心になります
  
    const mesh = new THREE.Mesh(geometry, material);
    // 形状が縦に立っているので寝かせる
    mesh.rotation.y = -Math.PI / 2;
    return mesh;
  }
  
  createSteps(numSteps = 5) {
    const group = [];
  
    for (let i = 0; i < numSteps; i++) {
      const step = this.createEscalatorStepMesh();
  
      // ステップを少しずつ後ろに配置（例：0.3m間隔）
      step.position.y = 0; // 高さは固定
      step.position.z = i * -0.35; // 奥に並べる
  
      this.scene.add(step);
      group.push(step);
    }
  
    return group;
  }
  
  updateObjectOnPath(path, time=0, speed=0.0005) {
    const Equal_path = this.getPointsEveryM(path, 0.005); // spacing=0.1mごと（細かすぎたら25に）
    const length = path.getLength(path);
    const step_depth = 0.3
    const depth_idx = step_depth/length
    const steps_num = Math.floor(length/step_depth)
    const step_diff = depth_idx * steps_num
    const steps = this.createSteps(steps_num);
    const leng = Equal_path.length-1
  
    // 1. 長方形の幅と高さを指定（例：幅3、高さ1.5）
    const width = 0.6;
    const height = 1;
  
    // 2. 形状を作成（PlaneGeometry はXZ平面ではなくXY平面）
    const geometry = new THREE.PlaneGeometry(height, width);
  
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('textures/roof.png'); // ← パスを適宜変更
    texture.colorSpace = THREE.SRGBColorSpace;
  
    // 3. マテリアル（色やテクスチャ）を設定
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      // color: 0x00ff00,
      side: THREE.DoubleSide // 裏からも見えるようにする
    });
  
    // 4. メッシュを作成してシーンに追加
    const rectangle = new THREE.Mesh(geometry, material);
  
    rectangle.rotation.x = -Math.PI/2;
    // rectangle.rotation.z = -Math.PI/2;
    const point = 0
    rectangle.position.set(Equal_path[point].x,Equal_path[point].y+0.085,Equal_path[point].z); 
    this.scene.add(rectangle);
  
    const rectangle2 = new THREE.Mesh(geometry, material);
    rectangle2.rotation.x = -Math.PI/2;
    const point2 = Math.floor(leng * step_diff)
    rectangle2.position.set(Equal_path[point2].x,Equal_path[point2].y+0.085,Equal_path[point2].z); 
    this.scene.add(rectangle2);
  
    function moveObject(){
      for (let i =0; i < steps_num; i++){
        steps[i].position.copy(Equal_path[Math.floor(leng*((time+i*depth_idx)%step_diff))]);
      }
      if (time >= step_diff){time = 0}else{time+=speed};
      requestAnimationFrame(moveObject);
    };
    moveObject();
  }  
  

  // --- アニメーション ---

  // 桁橋 の作成
  placeGirderBridge(track_1,track_2,y,quantity) {
  
  const board_length_1 = track_1.getLength(track_1)/quantity;
  const board_length_2 = track_2.getLength(track_2)/quantity;
  const points_data_1 = this.RailMargin(this.getPointsEveryM(track_1, board_length_1), -0.7, true);
  const points_1 = points_data_1[0]
  const angles_1 = points_data_1[1]
  const points_data_2 = this.RailMargin(this.getPointsEveryM(track_2, board_length_2), 0.7, true);
  const points_2 = points_data_2[0]
  const angles_2 = points_data_2[1]
  
  if (points_1.length != points_2.length){console.log('Err: 不均一')}

  const material = new THREE.MeshStandardMaterial({//color: 0x3399cc 
    color: 0xffffff,      // 暗めのグレー（鉄色）
    metalness: 0.8,       // 金属光沢最大
    roughness: 0.5,       // 少しザラザラ（低くするとツルツル）
    envMapIntensity: 1.0,    // 環境マップの反射強度（envMapを使うなら）
    side: THREE.FrontSide,
  });

  const diff_x = points_1[0].x - points_2[0].x
  const diff_z = points_1[0].z - points_2[0].z

  let middle_0 = {}
  let middle_1 = {
    x: points_1[0].x - diff_x / 2,
    z: points_1[0].z - diff_z / 2,
    y: y
  }
  
  let Bridge_width_1 = Math.sqrt(diff_x**2+diff_z**2)-0.1
  let Angle_1 = Math.atan2(diff_x,diff_z)
  
  for (let i = 0; i < points_1.length-1; i++){

    // for (let i = 0; i < 1; i++){
    const diff_x = points_1[i+1].x - points_2[i+1].x
    const diff_z = points_1[i+1].z - points_2[i+1].z

    middle_0 = middle_1
    middle_1 = {
      x: points_1[i+1].x - diff_x / 2,
      z: points_1[i+1].z - diff_z / 2,
      y: y
    }
    
    const Bridge_width_0 = Bridge_width_1
    Bridge_width_1 = Math.sqrt(diff_x**2+diff_z**2)

    const beam_num = 3
    const cut_len = -0.5

    const margin_0 = (Bridge_width_0/(beam_num-1))*0.5
    const margin_1 = (Bridge_width_1/(beam_num-1))*0.5
    const half = (beam_num+1)%2

    const Angle_0 = Angle_1
    Angle_1 = Math.atan2(diff_x,diff_z)
    console.log(Bridge_width_1,((Bridge_width_0/3)*0.25),)
    console.log(margin_1)

    for (let i = 0; i<Math.floor(beam_num/2); i++){
      this.scene.add(this.createBoxBetweenPoints3D(({x: middle_0.x+Math.sin(Angle_0)*margin_0*(((i+1)*2)-half)+Math.sin(angles_1[i])*cut_len,z: middle_0.z+Math.cos(Angle_0)*margin_0*(((i+1)*2)-half)+Math.cos(angles_1[i])*cut_len, y: y}),
                                                   ({x: middle_1.x+Math.sin(Angle_1)*margin_1*(((i+1)*2)-half)+Math.sin(angles_1[i+1])*cut_len,z: middle_1.z+Math.cos(Angle_1)*margin_1*(((i+1)*2)-half)+Math.cos(angles_1[i+1])*cut_len, y: y}),0.7,0.2,material))
    };
    for (let i = 0; i<Math.floor(beam_num/2); i++){
      this.scene.add(this.createBoxBetweenPoints3D(({x: middle_0.x-Math.sin(Angle_0)*margin_0*(((i+1)*2)-half)-Math.sin(angles_2[i])*cut_len,z: middle_0.z-Math.cos(Angle_0)*margin_0*(((i+1)*2)-half)-Math.cos(angles_2[i])*cut_len, y: y}),
                                                   ({x: middle_1.x-Math.sin(Angle_1)*margin_1*(((i+1)*2)-half)-Math.sin(angles_2[i+1])*cut_len,z: middle_1.z-Math.cos(Angle_1)*margin_1*(((i+1)*2)-half)-Math.cos(angles_2[i+1])*cut_len, y: y}),0.7,0.2,material))
      };
    
    if (beam_num%2 === 1){
        for (let i = 0; i<Math.floor(beam_num/2); i++){
            this.scene.add(this.createBoxBetweenPoints3D(middle_0,middle_1,0.7,0.2,material))
          };        
    }

    this.Map_pin(points_1[i].x,points_1[i].z)
    this.Map_pin(points_2[i].x,points_2[i].z)

    // for (let i = 0; i<beam_num/2; i++){
    //     this.scene.add(this.createBoxBetweenPoints3D(({x: middle_0.x-Math.sin(angles_1[i])*margin_0*(i*2+half),z: middle_0.z-Math.cos(angles_1[i])*margin_0*(i*2+1), y: y}),
    //                                                  ({x: middle_1.x-Math.sin(angles_1[i+1])*margin_1*(i*2+half),z: middle_1.z-Math.cos(angles_1[i+1])*margin_1*(i*2+1), y: y}),0.7,0.2,material))
  
    //   };
  
    // const beam_3 = this.createBoxBetweenPoints3D(({x: middle_0.x-Math.sin(angles_1[i])*margin_0,z: middle_0.z-Math.cos(angles_1[i])*margin_0, y: y}),
    //                                              ({x: middle_1.x-Math.sin(angles_1[i+1])*margin_1,z: middle_1.z-Math.cos(angles_1[i+1])*margin_1, y: y}),1,0.2,material)
    // const beam_4 = this.createBoxBetweenPoints3D(({x: middle_0.x-Math.sin(angles_1[i])*margin_0*3,z: middle_0.z-Math.cos(angles_1[i])*margin_0*3, y: y}),
    //                                              ({x: middle_1.x-Math.sin(angles_1[i+1])*margin_1*3,z: middle_1.z-Math.cos(angles_1[i+1])*margin_1*3, y: y}),1,0.2,material)

    // beam_1.position.set(middle_1.x,middle_1.y,middle_1.z)
    // this.scene.add(beam_1)
    // this.scene.add(beam_3)
    // this.scene.add(beam_4)
}
}
}

