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
      if (choiceObject?.userData?.decorationType) {
        return [choiceObject];
      }
      return [];
    }
    if (editObject === 'DIFFERENCE_SPACE'
      && (getDifferenceSpaceTransformMode() === 'scale' || getDifferenceSpaceTransformMode() === 'rotation')) {
      const selectedDiffPoints = getDifferenceSelectedPointsForTransform();
      if (selectedDiffPoints.length > 0) {
        return selectedDiffPoints;
      }
    }
    return [];
  }

  function ensureCopiedGroupReadyForPointEdit(targets) {
    if (getEditObject() !== 'STEEL_FRAME') { return targets; }
    if (!Array.isArray(targets) || targets.length < 1) { return targets; }
    const selectedPoints = targets.filter((mesh) => mesh?.userData?.steelFramePoint);
    if (selectedPoints.length < 1) { return targets; }

    const selectedSet = new Set(selectedPoints);
    const copyStructures = getConstructionCopyTargets()
      .filter((mesh) => Boolean(mesh?.userData?.steelFrameCopiedObject));
    const copyStructureEntries = copyStructures.map((mesh) => ({
      mesh,
      points: getCopyStructurePointMeshes(mesh).filter((p) => p?.userData?.steelFramePoint),
    }));
    const structureIndexByMesh = new Map();
    copyStructureEntries.forEach((entry, idx) => {
      structureIndexByMesh.set(entry.mesh, idx);
    });
    const pointKey = (mesh) => {
      const id = Number(mesh?.id);
      return Number.isFinite(id) ? `id:${id}` : `pos:${Number(mesh?.position?.x || 0).toFixed(5)},${Number(mesh?.position?.y || 0).toFixed(5)},${Number(mesh?.position?.z || 0).toFixed(5)}`;
    };
    const structureAdj = copyStructureEntries.map(() => new Set());
    const pointToStructureIdx = new Map();
    copyStructureEntries.forEach((entry, idx) => {
      entry.points.forEach((pointMesh) => {
        const key = pointKey(pointMesh);
        if (!pointToStructureIdx.has(key)) {
          pointToStructureIdx.set(key, []);
        }
        pointToStructureIdx.get(key).push(idx);
      });
    });
    pointToStructureIdx.forEach((idxList) => {
      if (!Array.isArray(idxList) || idxList.length < 2) { return; }
      for (let i = 0; i < idxList.length; i += 1) {
        for (let j = i + 1; j < idxList.length; j += 1) {
          const a = idxList[i];
          const b = idxList[j];
          structureAdj[a].add(b);
          structureAdj[b].add(a);
        }
      }
    });
    const collectConnectedPoints = (startMesh) => {
      const startIdx = structureIndexByMesh.get(startMesh);
      if (!Number.isInteger(startIdx)) { return []; }
      const visited = new Set([startIdx]);
      const queue = [startIdx];
      while (queue.length > 0) {
        const idx = queue.shift();
        structureAdj[idx].forEach((nextIdx) => {
          if (visited.has(nextIdx)) { return; }
          visited.add(nextIdx);
          queue.push(nextIdx);
        });
      }
      const out = [];
      const seenPoints = new Set();
      visited.forEach((idx) => {
        const row = copyStructureEntries[idx];
        row?.points?.forEach((pointMesh) => {
          const key = pointKey(pointMesh);
          if (seenPoints.has(key)) { return; }
          seenPoints.add(key);
          out.push(pointMesh);
        });
      });
      return out;
    };
    const collectGroupCopiedPoints = (groupId) => {
      const gid = String(groupId || '').trim();
      if (!gid) { return []; }
      const out = [];
      const seenPoints = new Set();
      copyStructureEntries.forEach((entry) => {
        const entryGroupId = String(entry?.mesh?.userData?.structureGroupId || '').trim();
        if (entryGroupId !== gid) { return; }
        entry?.points?.forEach((pointMesh) => {
          const key = pointKey(pointMesh);
          if (seenPoints.has(key)) { return; }
          seenPoints.add(key);
          out.push(pointMesh);
        });
      });
      return out;
    };
    const partialGroups = [];
    const seenConnectedKey = new Set();

    copyStructures.forEach((structureMesh) => {
      const all = collectConnectedPoints(structureMesh);
      if (all.length < 1) { return; }
      const picked = all.filter((mesh) => selectedSet.has(mesh));
      if (picked.length > 0 && picked.length < all.length) {
        const key = all
          .map((mesh) => pointKey(mesh))
          .sort()
          .join(',');
        if (seenConnectedKey.has(key)) { return; }
        seenConnectedKey.add(key);
        partialGroups.push({ structureMesh, picked, all });
      }
    });

    // フォールバック: 構造物参照が無い古いデータは copyGroupId 単位で扱う。
    if (partialGroups.length < 1) {
      const allPoints = getSteelFrameMode()?.getAllPointMeshes?.()?.filter((mesh) => mesh?.userData?.steelFramePoint) || [];
      // 旧データ対策: copyGroupId ではなく位置近傍で判定する。
      // 意図しない構造物を巻き込まないため、許容差は極小にする。
      const FALLBACK_POS_EPS = 0.02;
      const candidatePoints = allPoints.filter((mesh) =>
        Boolean(mesh?.userData?.steelFrameCopied) || Boolean(mesh?.userData?.steelFrameCopyGroupId)
      );
      const makeNearSet = (seed) =>
        candidatePoints.filter((mesh) => mesh?.position?.distanceTo?.(seed.position) <= FALLBACK_POS_EPS);

      const seenNearKey = new Set();
      selectedPoints.forEach((seed) => {
        const all = makeNearSet(seed);
        if (all.length < 1) { return; }
        const picked = all.filter((mesh) => selectedSet.has(mesh));
        if (picked.length < 1 || picked.length >= all.length) { return; }
        const key = all.map((mesh) => mesh.id).sort((a, b) => a - b).join(',');
        if (seenNearKey.has(key)) { return; }
        seenNearKey.add(key);
        partialGroups.push({ nearKey: key, picked, all });
      });

      if (partialGroups.length < 1) { return targets; }
    }

    const yesDetach = window.confirm('複製されたオブジェクトを独立させますか？\nOK=はい / キャンセル=いいえ');
    if (yesDetach) {
      partialGroups.forEach(({ structureMesh, all }) => {
        const groupId = String(structureMesh?.userData?.structureGroupId || '').trim();
        detachCopiedStructureGroup({
          groupId,
          points: all,
        });
      });
      return targets;
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
    partialGroups.forEach(({ structureMesh }) => {
      const gid = String(structureMesh?.userData?.structureGroupId || '').trim();
      if (!gid) { return; }
      const groupPoints = collectGroupCopiedPoints(gid);
      groupPoints.forEach((mesh) => {
        if (!expanded.includes(mesh)) {
          expanded.push(mesh);
        }
      });
    });
    const syncGroupId = partialGroups
      .map(({ structureMesh }) => String(structureMesh?.userData?.structureGroupId || '').trim())
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
