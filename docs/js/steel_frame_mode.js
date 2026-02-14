import * as THREE from 'three';

export function createSteelFrameMode(scene, cubeGeometry, cubeMaterial) {
  const lines = [[]];
  let currentLineIndex = 0;
  const segmentMeshes = [];
  const segmentName = 'SteelFrameSegment';
  const pointColor = 0xff0000;
  const selectedPointColor = 0x7be6ff;
  const selectedPoints = [];
  const generatedRecords = [];
  let generatedRecordId = 1;
  let active = false;
  let generated = false;
  let allowPointAppend = false;
  let forcedCreatEnvMap = null;

  const envLoader = new THREE.TextureLoader();
  envLoader.load('textures/ct.jpg', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    forcedCreatEnvMap = texture;

    // Keep non-rite generated meshes on the fixed env map.
    segmentMeshes.forEach((obj) => {
      if (!obj || !obj.traverse) { return; }
      obj.traverse((node) => {
        const mat = node.material;
        if (!mat || mat.type !== 'MeshStandardMaterial') { return; }
        mat.envMap = forcedCreatEnvMap;
        mat.envMapIntensity = 1.0;
        mat.needsUpdate = true;
      });
    });
  });

  function createCreatStandardMaterial(color = 0x8a8f98) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.85,
      roughness: 0.35,
      envMap: forcedCreatEnvMap,
      envMapIntensity: 1.0,
    });
  }
  let segmentProfile = 'round';

  function disposeObject3D(obj) {
    if (!obj) { return; }
    if (obj.traverse) {
      obj.traverse((node) => {
        if (node.geometry && typeof node.geometry.dispose === 'function') {
          node.geometry.dispose();
        }
        if (node.material && typeof node.material.dispose === 'function') {
          node.material.dispose();
        }
      });
    }
  }

  function clearSegments() {
    for (let i = segmentMeshes.length - 1; i >= 0; i--) {
      const obj = segmentMeshes[i];
      if (!obj) { continue; }
      if (obj.parent) {
        obj.parent.remove(obj);
      }
      disposeObject3D(obj);
      segmentMeshes.splice(i, 1);
    }
  }

  function createRoundBarSegmentMesh(start, end) {
    const dir = end.clone().sub(start);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const geometry = new THREE.CylinderGeometry(0.08, 0.08, len, 10);
    const material = createCreatStandardMaterial(0x8a8f98);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = segmentName;

    const mid = start.clone().add(end).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    mesh.visible = active;
    return mesh;
  }

  function createTubularLightSegmentMesh(start, end) {
    const dir = end.clone().sub(start);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const geometry = new THREE.CylinderGeometry(0.07, 0.07, len, 14);
    // Unlit bright white so it looks emissive without adding lights.
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = segmentName;

    const mid = start.clone().add(end).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    mesh.visible = active;
    return mesh;
  }

  function createHBeamSegmentMesh(start, end) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const totalWidth = 0.28;
    const totalHeight = 0.28;
    const webThickness = 0.08;
    const flangeThickness = 0.06;
    const webHeight = Math.max(0.01, totalHeight - flangeThickness * 2);
    const flangeOffset = (totalHeight * 0.5) - (flangeThickness * 0.5);

    const material = createCreatStandardMaterial(0x8a8f98);

    const group = new THREE.Group();
    group.name = segmentName;

    const web = new THREE.Mesh(
      new THREE.BoxGeometry(webThickness, webHeight, len),
      material.clone(),
    );
    group.add(web);

    const topFlange = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, flangeThickness, len),
      material.clone(),
    );
    topFlange.position.y = flangeOffset;
    group.add(topFlange);

    const bottomFlange = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, flangeThickness, len),
      material.clone(),
    );
    bottomFlange.position.y = -flangeOffset;
    group.add(bottomFlange);

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    // Apply yaw + pitch (no roll).
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    group.visible = active;
    return group;
  }

  function createSegmentMesh(start, end) {
    if (segmentProfile === 'tubular') {
      return createTubularLightSegmentMesh(start, end);
    }
    if (segmentProfile === 'h_beam') {
      return createHBeamSegmentMesh(start, end);
    }
    return createRoundBarSegmentMesh(start, end);
  }

  function createSegmentsFromPoints(points) {
    const created = [];
    if (!Array.isArray(points) || points.length < 2) { return created; }
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i]?.position;
      const end = points[i + 1]?.position;
      if (!start || !end) { continue; }
      const mesh = createSegmentMesh(start, end);
      if (!mesh) { continue; }
      scene.add(mesh);
      segmentMeshes.push(mesh);
      created.push(mesh);
    }
    return created;
  }

  function setActive(next) {
    active = Boolean(next);
    lines.forEach((points) => {
      points.forEach((mesh) => {
        if (!mesh) { return; }
        mesh.visible = active;
      });
    });
    segmentMeshes.forEach((mesh) => {
      if (!mesh) { return; }
      mesh.visible = active && generated;
    });
  }

  function setPointColor(mesh, color) {
    if (!mesh || !mesh.material) { return; }
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => {
        if (mat && mat.color) { mat.color.setHex(color); }
      });
      return;
    }
    if (mesh.material.color) {
      mesh.material.color.setHex(color);
    }
  }

  function setPointsFromTargets(targets) {
    return;
  }

  function startNewLine() {
    const newLine = [];
    lines.push(newLine);
    currentLineIndex = lines.length - 1;
    return currentLineIndex;
  }

  function addPoint(point) {
    if (!allowPointAppend) {
      return null;
    }
    const currentPoints = lines[currentLineIndex];
    const mesh = new THREE.Mesh(cubeGeometry, cubeMaterial.clone());
    mesh.position.copy(point);
    mesh.userData = {
      ...(mesh.userData || {}),
      steelFramePoint: true,
      steelFrameLine: currentLineIndex,
    };
    mesh.visible = active;
    scene.add(mesh);
    currentPoints.push(mesh);
    generated = false;
    return mesh;
  }

  function addExistingPoint(mesh, lineIndex = currentLineIndex) {
    if (!mesh) { return false; }
    const safeLine = Number.isInteger(lineIndex) && lineIndex >= 0 ? lineIndex : currentLineIndex;
    while (lines.length <= safeLine) {
      lines.push([]);
    }
    const points = lines[safeLine];
    if (!points.includes(mesh)) {
      points.push(mesh);
    }
    mesh.userData = {
      ...(mesh.userData || {}),
      steelFramePoint: true,
      steelFrameLine: safeLine,
    };
    mesh.visible = active;
    if (!mesh.parent) {
      scene.add(mesh);
    }
    generated = false;
    return true;
  }

  function removePointMesh(mesh) {
    if (!mesh) { return false; }
    let removed = false;
    lines.forEach((points) => {
      const idx = points.indexOf(mesh);
      if (idx >= 0) {
        points.splice(idx, 1);
        removed = true;
      }
    });
    const selectedIdx = selectedPoints.indexOf(mesh);
    if (selectedIdx >= 0) {
      selectedPoints.splice(selectedIdx, 1);
    }
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
    if (removed) {
      generated = false;
    }
    return removed;
  }

  function clearSelection() {
    selectedPoints.forEach((mesh) => setPointColor(mesh, pointColor));
    selectedPoints.length = 0;
  }

  function toggleSelectedPoint(mesh) {
    if (!mesh || !mesh.userData?.steelFramePoint) { return false; }
    const idx = selectedPoints.indexOf(mesh);
    if (idx >= 0) {
      selectedPoints.splice(idx, 1);
      setPointColor(mesh, pointColor);
      return false;
    }
    selectedPoints.push(mesh);
    setPointColor(mesh, selectedPointColor);
    return true;
  }

  function isSelectedPoint(mesh) {
    return selectedPoints.includes(mesh);
  }

  function restorePointColor(mesh) {
    if (!mesh) { return; }
    setPointColor(mesh, isSelectedPoint(mesh) ? selectedPointColor : pointColor);
  }

  function getAllPointMeshes() {
    const out = [];
    lines.forEach((points) => {
      points.forEach((mesh) => out.push(mesh));
    });
    return out;
  }

  function getSelectedPointMeshes() {
    return selectedPoints.slice();
  }

  function getSelectedPointOrder() {
    return selectedPoints.map((mesh, idx) => ({
      order: idx + 1,
      id: mesh?.id ?? null,
      line: mesh?.userData?.steelFrameLine ?? null,
      x: mesh?.position?.x ?? null,
      y: mesh?.position?.y ?? null,
      z: mesh?.position?.z ?? null,
    }));
  }

  function generateSteelFrame() {
    let targetPoints = lines[currentLineIndex];
    if (selectedPoints.length >= 2) {
      const selectedLine = [...selectedPoints];
      targetPoints = selectedLine;
    }
    const createdMeshes = createSegmentsFromPoints(targetPoints);
    if (createdMeshes.length === 0) {
      clearSelection();
      return null;
    }

    const pointSnapshot = targetPoints.map((mesh, idx) => ({
      order: idx + 1,
      id: mesh?.id ?? null,
      x: mesh?.position?.x ?? null,
      y: mesh?.position?.y ?? null,
      z: mesh?.position?.z ?? null,
    }));
    generatedRecords.push({
      id: generatedRecordId++,
      profile: segmentProfile,
      pointCount: pointSnapshot.length,
      points: pointSnapshot,
      meshCount: createdMeshes.length,
    });

    generated = true;
    setActive(active);
    clearSelection();
    return generatedRecords[generatedRecords.length - 1];
  }

  function getCurrentPointMeshes() {
    return lines[currentLineIndex];
  }

  function setAllowPointAppend(next) {
    allowPointAppend = Boolean(next);
  }

  function setSegmentProfile(profile) {
    if (profile === 'h_beam') {
      segmentProfile = 'h_beam';
    } else if (profile === 'tubular') {
      segmentProfile = 'tubular';
    } else {
      segmentProfile = 'round';
    }
  }

  function getGeneratedRecords() {
    return generatedRecords;
  }

  return {
    addPoint,
    clearSelection,
    getAllPointMeshes,
    getSelectedPointMeshes,
    getCurrentPointMeshes,
    getGeneratedRecords,
    getPointMeshes: getCurrentPointMeshes,
    getSelectedPointOrder,
    isSelectedPoint,
    restorePointColor,
    addExistingPoint,
    removePointMesh,
    setActive,
    setSegmentProfile,
    setPointsFromTargets,
    startNewLine,
    setAllowPointAppend,
    toggleSelectedPoint,
    generateSteelFrame,
  };
}
