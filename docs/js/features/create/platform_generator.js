import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function buildRailPlatformMeshFromTwoTracks({
  rightCurve,
  leftCurve,
  rightTrackName = '',
  leftTrackName = '',
  innerOffset = 0.6,
  thickness = 0.22,
  topLift = 0.1,
  sampleStepMeters = 2.0,
  edgeLineColor = 0xB33E08,
  edgeLineWidth = 0.06,
  edgeLineInset = 0.015,
  edgeLineLift = 0.002,
  applyFixedEnvMap = null,
} = {}) {
  if (!rightCurve || !leftCurve) { return null; }
  const up = new THREE.Vector3(0, 1, 0);
  const rightLength = Number(rightCurve.getLength?.()) || 0;
  const leftLength = Number(leftCurve.getLength?.()) || 0;
  const baseLength = Math.max(rightLength, leftLength, 1);
  const steps = THREE.MathUtils.clamp(Math.floor(baseLength / Math.max(0.5, sampleStepMeters)), 16, 420);
  const safeInnerOffset = Math.max(0, Number(innerOffset) || 0);
  const safeThickness = Math.max(0.02, Number(thickness) || 0.22);
  const safeTopLift = Number(topLift) || 0;

  const frameAt = (curve, t, fallbackDir = new THREE.Vector3(0, 0, 1)) => {
    const tc = THREE.MathUtils.clamp(t, 0, 1);
    const point = curve.getPointAt(tc).clone();
    let tangent = (typeof curve.getTangentAt === 'function')
      ? curve.getTangentAt(tc).clone()
      : fallbackDir.clone();
    tangent.setY(0);
    if (tangent.lengthSq() < 1e-8) {
      tangent.copy(fallbackDir).setY(0);
    }
    if (tangent.lengthSq() < 1e-8) {
      tangent.set(0, 0, 1);
    }
    tangent.normalize();
    let right = new THREE.Vector3().crossVectors(up, tangent);
    if (right.lengthSq() < 1e-8) {
      right = new THREE.Vector3(1, 0, 0);
    } else {
      right.normalize();
    }
    return { point, tangent, right };
  };

  const rightTop = [];
  const leftTop = [];
  const rightBottom = [];
  const leftBottom = [];
  let prevRightTangent = new THREE.Vector3(0, 0, 1);
  let prevLeftTangent = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const rf = frameAt(rightCurve, t, prevRightTangent);
    const lf = frameAt(leftCurve, t, prevLeftTangent);
    prevRightTangent = rf.tangent.clone();
    prevLeftTangent = lf.tangent.clone();
    const ri = rf.point.clone().addScaledVector(rf.right, -safeInnerOffset);
    const li = lf.point.clone().addScaledVector(lf.right, safeInnerOffset);
    const y = ((rf.point.y + lf.point.y) * 0.5) + safeTopLift;
    ri.y = y;
    li.y = y;
    if (ri.distanceToSquared(li) < 1e-8) {
      li.add(new THREE.Vector3(0.02, 0, 0));
    }
    rightTop.push(ri);
    leftTop.push(li);
    rightBottom.push(ri.clone().addScaledVector(up, -safeThickness));
    leftBottom.push(li.clone().addScaledVector(up, -safeThickness));
  }
  if (rightTop.length < 2 || leftTop.length < 2) { return null; }

  const positions = [];
  const pushTri = (a, b, c) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  const addQuad = (a, b, c, d, flip = false) => {
    if (!flip) {
      pushTri(a, b, c);
      pushTri(a, c, d);
    } else {
      pushTri(a, c, b);
      pushTri(a, d, c);
    }
  };

  for (let i = 0; i < rightTop.length - 1; i += 1) {
    const j = i + 1;
    addQuad(rightTop[i], rightTop[j], leftTop[j], leftTop[i], false);
    addQuad(rightBottom[i], leftBottom[i], leftBottom[j], rightBottom[j], false);
    addQuad(rightTop[i], rightBottom[i], rightBottom[j], rightTop[j], false);
    addQuad(leftTop[i], leftTop[j], leftBottom[j], leftBottom[i], false);
  }
  addQuad(rightTop[0], leftTop[0], leftBottom[0], rightBottom[0], false);
  const last = rightTop.length - 1;
  addQuad(rightTop[last], rightBottom[last], leftBottom[last], leftTop[last], false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox?.();
  geometry.computeBoundingSphere?.();

  const material = new THREE.MeshStandardMaterial({
    color: 0x929286,
    roughness: 0.58,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });
  if (typeof applyFixedEnvMap === 'function') {
    applyFixedEnvMap(material);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'RailPlatformMesh';

  const buildTopEdgeLineMesh = (edgePoints, oppositePoints, name) => {
    if (!Array.isArray(edgePoints) || !Array.isArray(oppositePoints) || edgePoints.length < 2 || oppositePoints.length < 2) {
      return null;
    }
    const outer = [];
    const inner = [];
    for (let i = 0; i < edgePoints.length; i += 1) {
      const ep = edgePoints[i];
      const op = oppositePoints[i];
      if (!ep || !op) { return null; }
      const towardInner = op.clone().sub(ep);
      towardInner.y = 0;
      const span = towardInner.length();
      if (span < 1e-6) {
        const p = ep.clone();
        p.y += edgeLineLift;
        outer.push(p.clone());
        inner.push(p.clone());
        continue;
      }
      towardInner.normalize();
      const inset = Math.min(Math.max(0, edgeLineInset), span * 0.45);
      const width = Math.min(Math.max(0.003, edgeLineWidth), Math.max(0.003, span * 0.45 - inset));
      const outPoint = ep.clone().addScaledVector(towardInner, inset);
      const inPoint = outPoint.clone().addScaledVector(towardInner, width);
      outPoint.y += edgeLineLift;
      inPoint.y += edgeLineLift;
      outer.push(outPoint);
      inner.push(inPoint);
    }
    if (outer.length < 2 || inner.length < 2) { return null; }
    const stripPositions = [];
    const pushLineTri = (a, b, c) => {
      stripPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    };
    for (let i = 0; i < outer.length - 1; i += 1) {
      const j = i + 1;
      pushLineTri(outer[i], outer[j], inner[j]);
      pushLineTri(outer[i], inner[j], inner[i]);
    }
    const stripGeometry = new THREE.BufferGeometry();
    stripGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stripPositions, 3));
    stripGeometry.computeVertexNormals();
    stripGeometry.computeBoundingBox?.();
    stripGeometry.computeBoundingSphere?.();
    const stripMaterial = new THREE.MeshStandardMaterial({
      color: edgeLineColor,
      emissive: edgeLineColor,
      emissiveIntensity: 0.35,
      roughness: 0.42,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    if (typeof applyFixedEnvMap === 'function') {
      applyFixedEnvMap(stripMaterial);
    }
    const stripMesh = new THREE.Mesh(stripGeometry, stripMaterial);
    stripMesh.name = name;
    stripMesh.userData = {
      ...(stripMesh.userData || {}),
      railPlatformEdgeLine: true,
    };
    return stripMesh;
  };

  const rightEdgeLine = buildTopEdgeLineMesh(rightTop, leftTop, 'RailPlatformEdgeLineRight');
  const leftEdgeLine = buildTopEdgeLineMesh(leftTop, rightTop, 'RailPlatformEdgeLineLeft');
  if (rightEdgeLine) {
    mesh.add(rightEdgeLine);
  }
  if (leftEdgeLine) {
    mesh.add(leftEdgeLine);
  }

  mesh.userData = {
    ...(mesh.userData || {}),
    decorationType: 'rail_platform',
    railPlatform: true,
    railConstructionCategory: 'platform',
    rightTrackName: rightTrackName || '',
    leftTrackName: leftTrackName || '',
    innerOffset: safeInnerOffset,
    thickness: safeThickness,
    edgeLineColor,
    edgeLineWidth,
    edgeLineInset,
  };
  return mesh;
}
