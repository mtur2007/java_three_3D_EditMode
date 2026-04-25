export function createPointActions(deps) {
  const {
    getObjectEditMode,
    getEditObject,
    getSteelFrameMode,
    getChoiceObject,
    getDifferenceSpaceTransformMode,
    getDifferenceSelectedPointsForTransform,
    getConstructionCopyTargets,
    getCopyStructurePointMeshes,
    collectStructurePointsFromHitTarget,
    getNormalStructureGroupPointEditMode,
    getCopiedStructureGroupPointEditMode,
    detachCopiedStructureGroup,
    syncCopiedGroupRotationPanel,
    refreshPointEditPanelUI,
  } = deps;

  function getMovePointPanelTargets() {
    const objectEditMode = getObjectEditMode();
    if (objectEditMode !== 'MOVE_EXISTING' && objectEditMode !== 'CONSTRUCT') {
      return [];
    }
    const editObject = getEditObject();
    if (editObject === 'STEEL_FRAME') {
      const selected = getSteelFrameMode()?.getSelectedPointMeshes?.() || [];
      if (selected.length > 0) {
        return selected.filter((mesh) => Boolean(mesh?.userData?.steelFramePoint));
      }
      const choiceObject = getChoiceObject();
      if (choiceObject?.userData?.steelFramePoint) {
        return [choiceObject];
      }
      const groupedPoints = collectStructurePointsFromHitTarget?.(choiceObject) || [];
      if (groupedPoints.length > 0) {
        return groupedPoints.filter((mesh) => Boolean(mesh?.userData?.steelFramePoint));
      }
      if (choiceObject?.userData?.decorationType) {
        return [choiceObject];
      }
      return [];
    }
    if (editObject === 'DIFFERENCE_SPACE'
      && ['move', 'scale', 'rotation'].includes(getDifferenceSpaceTransformMode())) {
      const selectedDiffPoints = getDifferenceSelectedPointsForTransform();
      if (selectedDiffPoints.length > 0) {
        return selectedDiffPoints;
      }
    }
    return [];
  }

  function ensureCopiedGroupReadyForPointEdit(targets, options = {}) {
    if (getEditObject() !== 'STEEL_FRAME') { return targets; }
    if (!Array.isArray(targets) || targets.length < 1) { return targets; }
    const { promptDetachConfirm = false } = options || {};
    const selectedPoints = targets.filter((mesh) => mesh?.userData?.steelFramePoint);
    if (selectedPoints.length < 1) { return targets; }

    const normalGroupMode = getNormalStructureGroupPointEditMode?.() === 'group' ? 'group' : 'partial';
    const copiedGroupMode = getCopiedStructureGroupPointEditMode?.() === 'group' ? 'group' : 'detach';
    const selectedSet = new Set(selectedPoints);
    const allPointMeshes = getSteelFrameMode()?.getAllPointMeshes?.()?.filter((mesh) => mesh?.userData?.steelFramePoint) || [];
    const pointKey = (mesh) => {
      const id = Number(mesh?.id);
      return Number.isFinite(id)
        ? `id:${id}`
        : `pos:${Number(mesh?.position?.x || 0).toFixed(5)},${Number(mesh?.position?.y || 0).toFixed(5)},${Number(mesh?.position?.z || 0).toFixed(5)}`;
    };

    const collectNormalGroupPoints = (groupId) => {
      const gid = String(groupId || '').trim();
      if (!gid) { return []; }
      const direct = allPointMeshes.filter((mesh) => (
        String(mesh?.userData?.structureGroupId || '').trim() === gid
        && !mesh?.userData?.steelFrameCopied
        && !mesh?.userData?.steelFrameCopyGroupId
        && !mesh?.userData?.structureGroupCopySourceId
      ));
      if (direct.length > 0) { return direct; }
      const out = [];
      const seen = new Set();
      getConstructionCopyTargets()
        .filter((obj) => String(obj?.userData?.structureGroupId || '').trim() === gid)
        .forEach((obj) => {
          getCopyStructurePointMeshes(obj).forEach((pointMesh) => {
            if (!pointMesh?.userData?.steelFramePoint) { return; }
            if (pointMesh?.userData?.steelFrameCopied || pointMesh?.userData?.steelFrameCopyGroupId || pointMesh?.userData?.structureGroupCopySourceId) {
              return;
            }
            const key = pointKey(pointMesh);
            if (seen.has(key)) { return; }
            seen.add(key);
            out.push(pointMesh);
          });
      });
      return out;
    };

    const normalGroupIdsByPointKey = new Map();
    getConstructionCopyTargets()
      .filter((obj) => !obj?.userData?.steelFrameCopiedObject)
      .forEach((obj) => {
        const gid = String(obj?.userData?.structureGroupId || '').trim();
        if (!gid) { return; }
        getCopyStructurePointMeshes(obj).forEach((pointMesh) => {
          if (!pointMesh?.userData?.steelFramePoint) { return; }
          if (pointMesh?.userData?.steelFrameCopied || pointMesh?.userData?.steelFrameCopyGroupId || pointMesh?.userData?.structureGroupCopySourceId) {
            return;
          }
          const key = pointKey(pointMesh);
          if (!normalGroupIdsByPointKey.has(key)) {
            normalGroupIdsByPointKey.set(key, new Set());
          }
          normalGroupIdsByPointKey.get(key).add(gid);
        });
      });

    const normalPartialGroups = [];
    const seenNormalGroups = new Set();
    selectedPoints.forEach((pointMesh) => {
      if (pointMesh?.userData?.steelFrameCopied || pointMesh?.userData?.steelFrameCopyGroupId || pointMesh?.userData?.structureGroupCopySourceId) {
        return;
      }
      const candidateGroupIds = new Set();
      const ownGroupId = String(pointMesh?.userData?.structureGroupId || '').trim();
      if (ownGroupId) {
        candidateGroupIds.add(ownGroupId);
      }
      const indexedGroupIds = normalGroupIdsByPointKey.get(pointKey(pointMesh));
      indexedGroupIds?.forEach((gid) => candidateGroupIds.add(gid));
      candidateGroupIds.forEach((gid) => {
        if (!gid || seenNormalGroups.has(gid)) { return; }
        seenNormalGroups.add(gid);
        const all = collectNormalGroupPoints(gid);
        if (all.length < 1) { return; }
        const picked = all.filter((mesh) => selectedSet.has(mesh));
        if (picked.length > 0 && picked.length < all.length) {
          normalPartialGroups.push({ groupId: gid, all });
        }
      });
    });
    if (normalPartialGroups.length > 0 && normalGroupMode === 'group') {
      normalPartialGroups.forEach(({ all }) => {
        all.forEach((mesh) => {
          getSteelFrameMode()?.appendSelectedPoint?.(mesh);
        });
      });
      refreshPointEditPanelUI({ clearInputs: true });
      return getSteelFrameMode()?.getSelectedPointMeshes?.()?.filter((mesh) => mesh?.userData?.steelFramePoint) || targets;
    }

    const isCopiedStructurePoint = (pointMesh) => {
      if (!pointMesh?.userData?.steelFramePoint) { return false; }
      const sourceId = String(pointMesh?.userData?.structureGroupCopySourceId || '').trim();
      const copyGroupId = String(pointMesh?.userData?.steelFrameCopyGroupId || '').trim();
      return Boolean(pointMesh?.userData?.steelFrameCopied || sourceId || copyGroupId);
    };

    const collectGroupCopiedPoints = (groupId) => {
      const gid = String(groupId || '').trim();
      if (!gid) { return []; }
      const out = [];
      const seenPoints = new Set();
      getConstructionCopyTargets()
        .filter((mesh) => mesh?.parent)
        .filter((mesh) => String(mesh?.userData?.structureGroupId || '').trim() === gid)
        .forEach((mesh) => {
          getCopyStructurePointMeshes(mesh).forEach((pointMesh) => {
            if (!pointMesh?.userData?.steelFramePoint) { return; }
            if (!pointMesh?.parent) { return; }
            if (!isCopiedStructurePoint(pointMesh)) { return; }
            const key = pointKey(pointMesh);
            if (seenPoints.has(key)) { return; }
            seenPoints.add(key);
            out.push(pointMesh);
          });
        });
      return out;
    };
    const partialGroups = [];
    const seenGroupIds = new Set();

    selectedPoints.forEach((pointMesh) => {
      if (!isCopiedStructurePoint(pointMesh)) { return; }
      const gid = String(pointMesh?.userData?.structureGroupId || '').trim();
      if (!gid || seenGroupIds.has(gid)) { return; }
      seenGroupIds.add(gid);
      const all = collectGroupCopiedPoints(gid);
      if (all.length < 1) { return; }
      const picked = all.filter((mesh) => selectedSet.has(mesh));
      if (picked.length > 0 && picked.length < all.length) {
        partialGroups.push({ groupId: gid, picked, all });
      }
    });

    if (partialGroups.length < 1) {
      const copiedTargets = getConstructionCopyTargets()
        .filter((mesh) => mesh?.parent)
        .filter((mesh) => {
          const gid = String(mesh?.userData?.structureGroupId || '').trim();
          const sourceId = String(mesh?.userData?.structureGroupCopySourceId || '').trim();
          const copyGroupId = String(mesh?.userData?.steelFrameCopyGroupId || '').trim();
          return Boolean(gid && (sourceId || copyGroupId || mesh?.userData?.steelFrameCopiedObject));
        });
      copiedTargets.forEach((mesh) => {
        const gid = String(mesh?.userData?.structureGroupId || '').trim();
        if (!gid || seenGroupIds.has(gid)) { return; }
        seenGroupIds.add(gid);
        const all = collectGroupCopiedPoints(gid);
        if (all.length < 1) { return; }
        const picked = all.filter((point) => selectedSet.has(point));
        if (picked.length > 0 && picked.length < all.length) {
          partialGroups.push({ groupId: gid, picked, all });
        }
      });
    }

    if (partialGroups.length < 1) { return targets; }

    if (copiedGroupMode === 'detach') {
      if (!promptDetachConfirm) {
        return targets;
      }
      const detachGroupIds = partialGroups
        .map(({ groupId }) => String(groupId || '').trim())
        .filter(Boolean);
      const detachGroupLabel = detachGroupIds.length > 1
        ? `${detachGroupIds.length}個の複製グループ`
        : 'この複製グループ';
      const ok = window.confirm(`${detachGroupLabel}を独立化します。よろしいですか？`);
      if (!ok) {
        return [];
      }
      const detachedPoints = [];
      partialGroups.forEach(({ groupId, all }) => {
        detachCopiedStructureGroup({
          groupId,
          points: all,
        });
        all.forEach((mesh) => {
          if (!detachedPoints.includes(mesh)) {
            detachedPoints.push(mesh);
          }
        });
      });
      refreshPointEditPanelUI({ clearInputs: true });
      return detachedPoints.length > 0 ? detachedPoints : targets;
    }

    const partialPickedSet = new Set(partialGroups.flatMap((entry) => entry.picked));
    const preserved = selectedPoints.filter((mesh) => !partialPickedSet.has(mesh));
    const expanded = [...preserved];
    partialGroups.forEach(({ all }) => {
      all.forEach((mesh) => {
        if (!expanded.includes(mesh)) {
          expanded.push(mesh);
        }
      });
    });
    const syncGroupId = partialGroups
      .map(({ groupId }) => String(groupId || '').trim())
      .filter(Boolean)
      .find(Boolean);
    if (syncGroupId) {
      syncCopiedGroupRotationPanel?.(syncGroupId);
    }

    // 既存選択は維持し、対象のみを加算選択する。
    expanded.forEach((mesh) => {
      getSteelFrameMode()?.appendSelectedPoint?.(mesh);
    });
    refreshPointEditPanelUI({ clearInputs: true });
    return getSteelFrameMode()?.getSelectedPointMeshes?.()?.filter((mesh) => mesh?.userData?.steelFramePoint) || expanded;
  }

  return {
    getMovePointPanelTargets,
    ensureCopiedGroupReadyForPointEdit,
  };
}
