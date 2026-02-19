import * as THREE from 'three';

export function createSteelFrameMode(scene, cubeGeometry, cubeMaterial) {
  const lines = [[]];
  let currentLineIndex = 0;
  const segmentMeshes = [];
  const segmentName = 'SteelFrameSegment';
  const pointColor = 0xff0000;
  const copiedPointColor = 0xffd400;
  const selectedPointColor = 0x7be6ff;
  const selectedPoints = [];
  const selectionBreakMarker = Object.freeze({ __steelFrameSelectionBreak: true });
  const generatedRecords = [];
  let generatedRecordId = 1;
  let active = false;
  let generated = false;
  let allowPointAppend = false;
  const createPointScale = 0.5;
  let forcedCreatEnvMap = null;

  function getDefaultPointColor(mesh) {
    return mesh?.userData?.steelFrameCopied ? copiedPointColor : pointColor;
  }

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

  function getDefaultBeamStyle(profile) {
    const p = String(profile || '').toLowerCase();
    if (p === 'h_beam' || p === 't_beam' || p === 'l_beam') {
      return {
        beamWidthHorizontal: 0.28,
        beamHeightVertical: 0.28,
        beamThickness: 0.07,
      };
    }
    return null;
  }

  function normalizeBeamStyle(profile, rawStyle = null) {
    const base = getDefaultBeamStyle(profile);
    if (!base) { return null; }
    const merged = {
      beamWidthHorizontal: Number(rawStyle?.beamWidthHorizontal),
      beamHeightVertical: Number(rawStyle?.beamHeightVertical),
      beamThickness: Number(rawStyle?.beamThickness),
    };
    const width = Number.isFinite(merged.beamWidthHorizontal) ? Math.max(0.02, merged.beamWidthHorizontal) : base.beamWidthHorizontal;
    const height = Number.isFinite(merged.beamHeightVertical) ? Math.max(0.02, merged.beamHeightVertical) : base.beamHeightVertical;
    const maxThickness = Math.max(0.01, Math.min(width, height) * 0.45);
    const thicknessRaw = Number.isFinite(merged.beamThickness) ? merged.beamThickness : base.beamThickness;
    const thickness = THREE.MathUtils.clamp(thicknessRaw, 0.01, maxThickness);
    return {
      beamWidthHorizontal: width,
      beamHeightVertical: height,
      beamThickness: thickness,
    };
  }

  function setMeshColorRecursive(obj, colorHex) {
    if (!obj) { return; }
    const paint = (mat) => mat?.color?.setHex?.(colorHex);
    if (Array.isArray(obj.material)) {
      obj.material.forEach((mat) => paint(mat));
    } else {
      paint(obj.material);
    }
    obj.traverse?.((node) => {
      if (node === obj) { return; }
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => paint(mat));
      } else {
        paint(node.material);
      }
    });
  }

  function applySegmentVisualState(mesh) {
    if (!mesh) { return; }
    if (mesh?.userData?.steelFrameCopiedObject) {
      setMeshColorRecursive(mesh, 0xffd400);
    }
  }

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

  function createHBeamSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('h_beam', style);
    const totalWidth = dims.beamWidthHorizontal;
    const totalHeight = dims.beamHeightVertical;
    const webThickness = dims.beamThickness;
    const flangeThickness = dims.beamThickness;
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

  function createTBeamSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('t_beam', style);
    const totalWidth = dims.beamWidthHorizontal;
    const totalHeight = dims.beamHeightVertical;
    const webThickness = dims.beamThickness;
    const flangeThickness = dims.beamThickness;
    const webHeight = Math.max(0.01, totalHeight - flangeThickness);

    const material = createCreatStandardMaterial(0x8a8f98);
    const group = new THREE.Group();
    group.name = segmentName;

    const topFlangeY = (totalHeight * 0.5) - (flangeThickness * 0.5);
    const webY = topFlangeY - (flangeThickness * 0.5) - (webHeight * 0.5);

    const topFlange = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, flangeThickness, len),
      material.clone(),
    );
    topFlange.position.y = topFlangeY;
    group.add(topFlange);

    const web = new THREE.Mesh(
      new THREE.BoxGeometry(webThickness, webHeight, len),
      material.clone(),
    );
    web.position.y = webY;
    group.add(web);

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    group.visible = active;
    return group;
  }

  function createLBeamSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('l_beam', style);
    const totalWidth = dims.beamWidthHorizontal;
    const totalHeight = dims.beamHeightVertical;
    const legThickness = dims.beamThickness;

    const material = createCreatStandardMaterial(0x8a8f98);
    const group = new THREE.Group();
    group.name = segmentName;

    const vertical = new THREE.Mesh(
      new THREE.BoxGeometry(legThickness, totalHeight, len),
      material.clone(),
    );
    vertical.position.x = -(totalWidth * 0.5) + (legThickness * 0.5);
    group.add(vertical);

    const horizontal = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, legThickness, len),
      material.clone(),
    );
    horizontal.position.y = (totalHeight * 0.5) - (legThickness * 0.5);
    group.add(horizontal);

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    group.visible = active;
    return group;
  }

  function createSegmentMesh(start, end, { profile = segmentProfile, style = null } = {}) {
    if (profile === 'tubular') {
      return createTubularLightSegmentMesh(start, end);
    }
    if (profile === 'h_beam') {
      return createHBeamSegmentMesh(start, end, style);
    }
    if (profile === 't_beam') {
      return createTBeamSegmentMesh(start, end, style);
    }
    if (profile === 'l_beam') {
      return createLBeamSegmentMesh(start, end, style);
    }
    return createRoundBarSegmentMesh(start, end);
  }

  function createSegmentMeshWithProfile(start, end, profile, style = null) {
    const prevProfile = segmentProfile;
    setSegmentProfile(profile);
    const mesh = createSegmentMesh(start, end, { profile, style });
    segmentProfile = prevProfile;
    return mesh;
  }

  function replaceSegmentMesh(srcMesh, rebuiltMesh, index) {
    if (!rebuiltMesh) { return false; }
    rebuiltMesh.userData = {
      ...(srcMesh?.userData || {}),
    };
    applySegmentVisualState(rebuiltMesh);
    rebuiltMesh.visible = srcMesh?.visible ?? (active && generated);
    scene.add(rebuiltMesh);
    if (srcMesh?.parent) {
      srcMesh.parent.remove(srcMesh);
    }
    disposeObject3D(srcMesh);
    segmentMeshes[index] = rebuiltMesh;
    return true;
  }

  function createSegmentsFromPoints(points) {
    const created = [];
    if (!Array.isArray(points) || points.length < 2) { return created; }
    for (let i = 0; i < points.length - 1; i++) {
      const startMesh = points[i];
      const endMesh = points[i + 1];
      const start = startMesh?.position;
      const end = endMesh?.position;
      if (!start || !end) { continue; }
      const segmentStyle = normalizeBeamStyle(segmentProfile, null);
      const mesh = createSegmentMesh(start, end, { profile: segmentProfile, style: segmentStyle });
      if (!mesh) { continue; }
      mesh.userData = {
        ...(mesh.userData || {}),
        steelFrameSegmentPointRefs: [startMesh, endMesh].filter((item) => item?.userData?.steelFramePoint),
        steelFrameSegmentProfile: segmentProfile,
        steelFrameSegmentStyle: segmentStyle ? { ...segmentStyle } : null,
      };
      scene.add(mesh);
      segmentMeshes.push(mesh);
      created.push(mesh);
    }
    return created;
  }

  function rebuildSegmentsFromPoints() {
    if (!Array.isArray(segmentMeshes) || segmentMeshes.length < 1) { return 0; }
    let rebuilt = 0;
    const nextMeshes = [];
    const prevMeshes = [...segmentMeshes];
    prevMeshes.forEach((srcMesh) => {
      const refs = Array.isArray(srcMesh?.userData?.steelFrameSegmentPointRefs)
        ? srcMesh.userData.steelFrameSegmentPointRefs
        : [];
      const startMesh = refs[0];
      const endMesh = refs[1];
      const start = startMesh?.position;
      const end = endMesh?.position;
      if (!start || !end) {
        if (srcMesh?.parent) {
          srcMesh.parent.remove(srcMesh);
        }
        disposeObject3D(srcMesh);
        return;
      }
      const profile = srcMesh?.userData?.steelFrameSegmentProfile || segmentProfile;
      const style = normalizeBeamStyle(profile, srcMesh?.userData?.steelFrameSegmentStyle || null);
      const rebuiltMesh = createSegmentMeshWithProfile(start, end, profile, style);
      if (!rebuiltMesh) {
        if (srcMesh?.parent) {
          srcMesh.parent.remove(srcMesh);
        }
        disposeObject3D(srcMesh);
        return;
      }
      rebuiltMesh.userData = {
        ...(srcMesh.userData || {}),
        steelFrameSegmentPointRefs: [startMesh, endMesh],
        steelFrameSegmentProfile: profile,
        steelFrameSegmentStyle: style ? { ...style } : null,
      };
      rebuiltMesh.visible = srcMesh.visible;
      scene.add(rebuiltMesh);
      nextMeshes.push(rebuiltMesh);
      if (srcMesh?.parent) {
        srcMesh.parent.remove(srcMesh);
      }
      disposeObject3D(srcMesh);
      rebuilt += 1;
    });
    segmentMeshes.length = 0;
    nextMeshes.forEach((mesh) => segmentMeshes.push(mesh));
    setActive(active);
    return rebuilt;
  }

  function rebuildSegmentsForPoints(points) {
    if (!Array.isArray(points) || points.length < 1) { return 0; }
    if (!Array.isArray(segmentMeshes) || segmentMeshes.length < 1) { return 0; }
    const movedSet = new Set(points.filter((mesh) => mesh?.userData?.steelFramePoint));
    if (movedSet.size < 1) { return 0; }

    let rebuilt = 0;
    for (let i = 0; i < segmentMeshes.length; i += 1) {
      const srcMesh = segmentMeshes[i];
      const refs = Array.isArray(srcMesh?.userData?.steelFrameSegmentPointRefs)
        ? srcMesh.userData.steelFrameSegmentPointRefs
        : [];
      const startMesh = refs[0];
      const endMesh = refs[1];
      if (!startMesh || !endMesh) { continue; }
      if (!movedSet.has(startMesh) && !movedSet.has(endMesh)) { continue; }
      const start = startMesh.position;
      const end = endMesh.position;
      if (!start || !end) { continue; }
      const profile = srcMesh?.userData?.steelFrameSegmentProfile || segmentProfile;
      const style = normalizeBeamStyle(profile, srcMesh?.userData?.steelFrameSegmentStyle || null);
      const rebuiltMesh = createSegmentMeshWithProfile(start, end, profile, style);
      if (!rebuiltMesh) { continue; }
      rebuiltMesh.userData = {
        ...(srcMesh.userData || {}),
        steelFrameSegmentPointRefs: [startMesh, endMesh],
        steelFrameSegmentProfile: profile,
        steelFrameSegmentStyle: style ? { ...style } : null,
      };
      if (replaceSegmentMesh(srcMesh, rebuiltMesh, i)) {
        rebuilt += 1;
      }
    }
    if (rebuilt > 0) {
      setActive(active);
    }
    return rebuilt;
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
      mesh.visible = active;
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
    rebuildSegmentsForPoints(targets);
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
    mesh.scale.setScalar(createPointScale);
    mesh.userData = {
      ...(mesh.userData || {}),
      steelFramePoint: true,
      steelFrameLine: currentLineIndex,
      steelFrameCopied: Boolean(mesh?.userData?.steelFrameCopied),
    };
    setPointColor(mesh, getDefaultPointColor(mesh));
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
      steelFrameCopied: Boolean(mesh?.userData?.steelFrameCopied),
    };
    setPointColor(mesh, isSelectedPoint(mesh) ? selectedPointColor : getDefaultPointColor(mesh));
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

  function addExistingSegmentMesh(mesh) {
    if (!mesh) { return false; }
    if (!segmentMeshes.includes(mesh)) {
      segmentMeshes.push(mesh);
    }
    if (!mesh.parent) {
      scene.add(mesh);
    }
    applySegmentVisualState(mesh);
    mesh.visible = active;
    return true;
  }

  function removeExistingSegmentMesh(mesh) {
    if (!mesh) { return false; }
    const idx = segmentMeshes.indexOf(mesh);
    if (idx < 0) { return false; }
    segmentMeshes.splice(idx, 1);
    return true;
  }

  function getSegmentStyle(mesh) {
    if (!mesh || mesh.name !== segmentName) { return null; }
    const profile = mesh?.userData?.steelFrameSegmentProfile || null;
    const style = normalizeBeamStyle(profile, mesh?.userData?.steelFrameSegmentStyle || null);
    if (!style) { return null; }
    return { ...style };
  }

  function applySegmentStyle(meshes, stylePatch = {}) {
    const targets = Array.isArray(meshes) ? meshes : [];
    const unique = Array.from(new Set(targets.filter((mesh) => mesh?.name === segmentName)));
    if (unique.length < 1) {
      return { updated: 0, rebuilt: 0, points: [] };
    }
    const points = [];
    let updated = 0;
    unique.forEach((mesh) => {
      const profile = mesh?.userData?.steelFrameSegmentProfile || null;
      const current = normalizeBeamStyle(profile, mesh?.userData?.steelFrameSegmentStyle || null);
      if (!current) { return; }
      const next = normalizeBeamStyle(profile, {
        ...current,
        ...stylePatch,
      });
      if (!next) { return; }
      mesh.userData = {
        ...(mesh.userData || {}),
        steelFrameSegmentStyle: { ...next },
      };
      const refs = Array.isArray(mesh?.userData?.steelFrameSegmentPointRefs)
        ? mesh.userData.steelFrameSegmentPointRefs
        : [];
      refs.forEach((pointMesh) => {
        if (pointMesh?.userData?.steelFramePoint) {
          points.push(pointMesh);
        }
      });
      updated += 1;
    });
    const rebuildResult = rebuildSegmentsForMeshes(unique);
    const mapping = rebuildResult?.mapping instanceof Map ? rebuildResult.mapping : new Map();
    const nextMeshes = unique.map((mesh) => mapping.get(mesh) || mesh).filter(Boolean);
    return {
      updated,
      rebuilt: Number(rebuildResult?.rebuilt) || 0,
      meshes: nextMeshes,
      points: Array.from(new Set(points)),
    };
  }

  function rebuildSegmentsForMeshes(meshes) {
    const targets = Array.isArray(meshes) ? meshes : [];
    const unique = Array.from(new Set(targets.filter((mesh) => mesh?.name === segmentName)));
    let rebuilt = 0;
    const mapping = new Map();
    unique.forEach((srcMesh) => {
      const idx = segmentMeshes.indexOf(srcMesh);
      if (idx < 0) { return; }
      const refs = Array.isArray(srcMesh?.userData?.steelFrameSegmentPointRefs)
        ? srcMesh.userData.steelFrameSegmentPointRefs
        : [];
      const startMesh = refs[0];
      const endMesh = refs[1];
      const start = startMesh?.position;
      const end = endMesh?.position;
      if (!start || !end) { return; }
      const profile = srcMesh?.userData?.steelFrameSegmentProfile || segmentProfile;
      const style = normalizeBeamStyle(profile, srcMesh?.userData?.steelFrameSegmentStyle || null);
      const rebuiltMesh = createSegmentMeshWithProfile(start, end, profile, style);
      if (!rebuiltMesh) { return; }
      rebuiltMesh.userData = {
        ...(srcMesh.userData || {}),
        steelFrameSegmentPointRefs: [startMesh, endMesh],
        steelFrameSegmentProfile: profile,
        steelFrameSegmentStyle: style ? { ...style } : null,
      };
      if (replaceSegmentMesh(srcMesh, rebuiltMesh, idx)) {
        rebuilt += 1;
        mapping.set(srcMesh, rebuiltMesh);
      }
    });
    if (rebuilt > 0) {
      setActive(active);
    }
    return { rebuilt, mapping };
  }

  function clearSelection() {
    selectedPoints.forEach((mesh) => {
      if (!mesh?.userData?.steelFramePoint) { return; }
      setPointColor(mesh, getDefaultPointColor(mesh));
    });
    selectedPoints.length = 0;
  }

  function toggleSelectedPoint(mesh) {
    if (!mesh || !mesh.userData?.steelFramePoint) { return false; }
    const idx = selectedPoints.indexOf(mesh);
    if (idx >= 0) {
      selectedPoints.splice(idx, 1);
      setPointColor(mesh, getDefaultPointColor(mesh));
      return false;
    }
    selectedPoints.push(mesh);
    setPointColor(mesh, selectedPointColor);
    return true;
  }

  function appendSelectedPoint(mesh) {
    if (!mesh || !mesh.userData?.steelFramePoint) { return false; }
    const idx = selectedPoints.indexOf(mesh);
    if (idx >= 0) {
      selectedPoints.splice(idx, 1);
    }
    selectedPoints.push(mesh);
    setPointColor(mesh, selectedPointColor);
    return true;
  }

  function appendSelectionBreak() {
    if (selectedPoints.length === 0) { return false; }
    const last = selectedPoints[selectedPoints.length - 1];
    if (last === selectionBreakMarker) { return false; }
    selectedPoints.push(selectionBreakMarker);
    return true;
  }

  function isSelectedPoint(mesh) {
    return selectedPoints.includes(mesh);
  }

  function restorePointColor(mesh) {
    if (!mesh) { return; }
    setPointColor(mesh, isSelectedPoint(mesh) ? selectedPointColor : getDefaultPointColor(mesh));
  }

  function getAllPointMeshes() {
    const out = [];
    lines.forEach((points) => {
      points.forEach((mesh) => out.push(mesh));
    });
    return out;
  }

  function getSelectedPointMeshes() {
    return selectedPoints.filter((mesh) => mesh?.userData?.steelFramePoint);
  }

  function getSelectedPointOrder() {
    return getSelectedPointMeshes().map((mesh, idx) => ({
      order: idx + 1,
      id: mesh?.id ?? null,
      line: mesh?.userData?.steelFrameLine ?? null,
      x: mesh?.position?.x ?? null,
      y: mesh?.position?.y ?? null,
      z: mesh?.position?.z ?? null,
    }));
  }

  function getSelectedPointSequences() {
    const sequences = [];
    let current = [];
    selectedPoints.forEach((item) => {
      if (item === selectionBreakMarker) {
        if (current.length > 0) {
          sequences.push(current);
          current = [];
        }
        return;
      }
      if (item?.userData?.steelFramePoint) {
        current.push(item);
      }
    });
    if (current.length > 0) {
      sequences.push(current);
    }
    return sequences;
  }

  function generateSteelFrame() {
    let targetPoints = lines[currentLineIndex];
    if (getSelectedPointMeshes().length >= 2) {
      const selectedLine = [...selectedPoints];
      targetPoints = selectedLine;
    }
    const createdMeshes = createSegmentsFromPoints(targetPoints);
    if (createdMeshes.length === 0) {
      clearSelection();
      return null;
    }

    const pointSnapshot = targetPoints
      .filter((mesh) => mesh?.userData?.steelFramePoint)
      .map((mesh, idx) => ({
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
    } else if (profile === 't_beam') {
      segmentProfile = 't_beam';
    } else if (profile === 'l_beam') {
      segmentProfile = 'l_beam';
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
    getSelectedPointSequences,
    isSelectedPoint,
    restorePointColor,
    addExistingPoint,
    addExistingSegmentMesh,
    removeExistingSegmentMesh,
    removePointMesh,
    setActive,
    setSegmentProfile,
    setPointsFromTargets,
    startNewLine,
    setAllowPointAppend,
    appendSelectedPoint,
    appendSelectionBreak,
    toggleSelectedPoint,
    generateSteelFrame,
    rebuildSegmentsFromPoints,
    rebuildSegmentsForPoints,
    rebuildSegmentsForMeshes,
    getSegmentStyle,
    applySegmentStyle,
  };
}
