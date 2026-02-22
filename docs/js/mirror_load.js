export function rebuildMirrorStateOnLoadRuntime({
  guideAddGrids = [],
  resolveMirrorSourceGridFromMirrorGrid,
  restoreMirrorGridPoseFromSourceLink,
  isInfluencePlane = (grid) => Boolean(grid?.userData?.guideMillerInfluencePlane),
  setGuideMirrorSourceGridOverride = () => {},
  getBaseGuideGrid = () => null,
  maxPasses = 4,
} = {}) {
  const mirrorTargets = guideAddGrids.filter((grid) =>
    grid?.parent
    && grid?.userData?.guideMirrorLocked
    && !isInfluencePlane(grid)
  );
  if (mirrorTargets.length < 1) {
    return { restoredCount: 0, unresolvedCount: 0 };
  }

  const restoredSet = new Set();
  for (let pass = 0; pass < Math.max(1, maxPasses); pass += 1) {
    let changed = false;
    mirrorTargets.forEach((mirrorGrid) => {
      if (!mirrorGrid || restoredSet.has(mirrorGrid.id)) { return; }
      const sourceGrid = resolveMirrorSourceGridFromMirrorGrid?.(mirrorGrid) || null;
      const baseGrid = getBaseGuideGrid?.() || null;
      const resolvedSource = sourceGrid?.parent ? sourceGrid : (baseGrid?.parent ? baseGrid : null);
      if (!resolvedSource) { return; }
      const restored = restoreMirrorGridPoseFromSourceLink?.(mirrorGrid, resolvedSource);
      if (!restored) { return; }
      mirrorGrid.userData = {
        ...(mirrorGrid.userData || {}),
        mirroredFromSourceGridId: resolvedSource?.id || null,
        mirroredFromSourceGridKey: resolvedSource === baseGrid
          ? 'base'
          : (typeof resolvedSource?.userData?.saveKey === 'string' ? resolvedSource.userData.saveKey : null),
      };
      setGuideMirrorSourceGridOverride?.(resolvedSource);
      restoredSet.add(mirrorGrid.id);
      changed = true;
    });
    if (!changed) { break; }
  }

  const unresolved = mirrorTargets.filter((grid) => !restoredSet.has(grid.id));
  if (unresolved.length > 0) {
    console.warn('[mirror][load] unresolved mirror-source links', unresolved.map((grid) => ({
      id: grid?.id || null,
      name: grid?.name || '',
      sourceKey: typeof grid?.userData?.mirroredFromSourceGridKey === 'string'
        ? grid.userData.mirroredFromSourceGridKey
        : null,
      sourceId: Number(grid?.userData?.mirroredFromSourceGridId) || null,
      edge: typeof grid?.userData?.mirroredFromEdge === 'string'
        ? grid.userData.mirroredFromEdge
        : null,
    })));
  }

  return {
    restoredCount: restoredSet.size,
    unresolvedCount: unresolved.length,
  };
}

export function rebuildMirrorFromStatesRuntime({
  mirrorStates = [],
  tryCreateMirrorFromState,
  maxPasses = 4,
} = {}) {
  const targets = Array.isArray(mirrorStates)
    ? mirrorStates.filter((state) => state && typeof state === 'object')
    : [];
  if (targets.length < 1) {
    return { createdCount: 0, unresolvedCount: 0 };
  }

  const created = new Set();
  for (let pass = 0; pass < Math.max(1, Number(maxPasses) || 1); pass += 1) {
    let changed = false;
    targets.forEach((state, index) => {
      if (created.has(index)) { return; }
      const ok = Boolean(tryCreateMirrorFromState?.(state, { pass, index }));
      if (!ok) { return; }
      created.add(index);
      changed = true;
    });
    if (!changed) { break; }
  }

  const unresolved = targets
    .map((state, index) => ({ state, index }))
    .filter((entry) => !created.has(entry.index));

  if (unresolved.length > 0) {
    console.warn('[mirror][load] unresolved mirror states', unresolved.map(({ state, index }) => ({
      index,
      name: String(state?.name || ''),
      saveKey: typeof state?.saveKey === 'string' ? state.saveKey : null,
      sourceKey: typeof state?.mirroredFromSourceGridKey === 'string' ? state.mirroredFromSourceGridKey : null,
      sourceId: Number(state?.mirroredFromSourceGridId) || null,
      edge: typeof state?.mirroredFromEdge === 'string' ? state.mirroredFromEdge : null,
    })));
  }

  return {
    createdCount: created.size,
    unresolvedCount: unresolved.length,
  };
}
