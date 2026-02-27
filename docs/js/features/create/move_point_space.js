import * as THREE from 'three';

export function createMovePointSpaceHelpers({
  getGuideCoordinateFrameOverride,
  getChangeAngleGridTarget,
} = {}) {
  function parseMovePointAxisInput(raw) {
    const text = String(raw ?? '').trim();
    if (!text) { return null; }
    const delta = text.match(/^\+=\s*([+-]?(?:\d+\.?\d*|\.\d+))$/);
    if (delta) {
      return { mode: 'delta', value: parseFloat(delta[1]) };
    }
    const absolute = text.match(/^[+-]?(?:\d+\.?\d*|\.\d+)$/);
    if (absolute) {
      return { mode: 'absolute', value: parseFloat(absolute[0]) };
    }
    return { mode: 'invalid', raw: text };
  }

  function readGuideMirrorCoordFrame(rawFrame) {
    if (!rawFrame || !Array.isArray(rawFrame.anchor) || !Array.isArray(rawFrame.quat)) { return null; }
    const anchor = new THREE.Vector3(
      Number(rawFrame.anchor[0]) || 0,
      Number(rawFrame.anchor[1]) || 0,
      Number(rawFrame.anchor[2]) || 0
    );
    const quat = new THREE.Quaternion(
      Number(rawFrame.quat[0]) || 0,
      Number(rawFrame.quat[1]) || 0,
      Number(rawFrame.quat[2]) || 0,
      Number(rawFrame.quat[3]) || 1
    ).normalize();
    return { anchor, quat };
  }

  function getMovePointGridFrameForMesh(mesh) {
    const planeRef = mesh?.userData?.planeRef;

    const selectedMirrorFrame = readGuideMirrorCoordFrame(getGuideCoordinateFrameOverride?.())
      || readGuideMirrorCoordFrame(getChangeAngleGridTarget?.()?.userData?.guideMirrorCoordFrame);
    if (selectedMirrorFrame) {
      return selectedMirrorFrame;
    }

    const mirrorFrame = readGuideMirrorCoordFrame(planeRef?.userData?.guideMirrorCoordFrame);
    if (mirrorFrame) {
      return mirrorFrame;
    }
    if (!planeRef?.quaternion?.isQuaternion) { return null; }
    const anchor = planeRef?.position ? planeRef.position.clone() : new THREE.Vector3(0, 0, 0);
    const quat = planeRef.quaternion.clone().normalize();
    return { anchor, quat };
  }

  function worldToGridPosition(worldPos, frame) {
    return worldPos.clone().sub(frame.anchor).applyQuaternion(frame.quat.clone().invert());
  }

  function gridToWorldPosition(gridPos, frame) {
    return gridPos.clone().applyQuaternion(frame.quat).add(frame.anchor);
  }

  function getMovePointAxisPosition(mesh, mode = 'world') {
    if (mode !== 'grid') {
      return mesh.position.clone();
    }
    const frame = getMovePointGridFrameForMesh(mesh);
    if (!frame) {
      return mesh.position.clone();
    }
    return worldToGridPosition(mesh.position, frame);
  }

  return {
    parseMovePointAxisInput,
    readGuideMirrorCoordFrame,
    getMovePointGridFrameForMesh,
    worldToGridPosition,
    gridToWorldPosition,
    getMovePointAxisPosition,
  };
}
