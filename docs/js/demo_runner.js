function getRuntimeDemoParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    demoPath: String(params.get('demo') || '').trim(),
    autorun: String(params.get('autorun') || '').trim() === '1',
    runtimeMap: String(params.get('runtime_map') || '').trim(),
  };
}

function waitForDemoApi() {
  if (window.EditModeDemoApi) {
    return Promise.resolve(window.EditModeDemoApi);
  }
  return new Promise((resolve) => {
    window.addEventListener('edit-mode-demo-api-ready', (event) => {
      resolve(event.detail?.api || window.EditModeDemoApi);
    }, { once: true });
  });
}

async function loadDemoScenario(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`demo scenario fetch failed: ${response.status}`);
  }
  const parsed = await response.json();
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps)) {
    throw new Error('demo scenario must be an object with a steps array');
  }
  return parsed;
}

async function runDemoStep(step, api, defaults = {}) {
  const type = String(step?.type || '').trim();
  if (!type) {
    throw new Error('step.type is required');
  }
  if (type === 'wait') {
    await api.wait(step.ms);
    return;
  }
  if (type === 'mode') {
    await api.setMode(step.ui, step.toggle || 'active');
    return;
  }
  if (type === 'mouse') {
    await api.moveMouse(step.x, step.y);
    return;
  }
  if (type === 'click') {
    await api.click(step.x, step.y, {
      holdMs: step.holdMs ?? defaults.clickHoldMs,
      mobile: step.mobile,
    });
    return;
  }
  if (type === 'drag') {
    await api.drag(step.from, step.to, {
      duration: step.duration,
      steps: step.steps ?? defaults.dragSteps,
      mobile: step.mobile,
    });
    return;
  }
  if (type === 'view') {
    await api.setView({
      position: step.position,
      angles: step.angles,
    }, {
      duration: step.duration,
      steps: step.steps ?? defaults.moveSteps,
    });
    return;
  }
  if (type === 'note') {
    api.notice(step.message || '', step.durationMs);
    await api.wait(step.waitMs ?? 300);
    return;
  }
  if (type === 'replay_structure_build') {
    await api.replayStructureBuild(step.group_name, {
      timing: step.timing,
      hide_source: step.hide_source,
      restore_source: step.restore_source,
      clear_preview: step.clear_preview,
    });
    return;
  }
  if (type === 'replay_line_build') {
    await api.replayLineBuild(step.group_name, {
      timing: step.timing,
      hide_source: step.hide_source,
      restore_source: step.restore_source,
      clear_preview: step.clear_preview,
      previewScale: step.previewScale,
    });
    return;
  }
  throw new Error(`unsupported demo step type: ${type}`);
}

async function runDemoScenario(scenario, api) {
  const defaults = scenario?.defaults && typeof scenario.defaults === 'object'
    ? scenario.defaults
    : {};
  const steps = Array.isArray(scenario?.steps) ? scenario.steps : [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    try {
      await runDemoStep(step, api, defaults);
    } catch (error) {
      throw new Error(`step ${index + 1} failed: ${error?.message || error}`);
    }
  }
}

let demoRunInFlight = null;

async function runDemoScenarioByPath(path, { api = null } = {}) {
  const targetPath = String(path || '').trim();
  if (!targetPath) {
    throw new Error('demo path is required');
  }
  if (demoRunInFlight) {
    return demoRunInFlight;
  }
  const runPromise = (async () => {
    const runtimeApi = api || await waitForDemoApi();
    const scenario = await loadDemoScenario(targetPath);
    await runDemoScenario(scenario, runtimeApi);
    return scenario;
  })();
  demoRunInFlight = runPromise;
  try {
    return await runPromise;
  } finally {
    demoRunInFlight = null;
  }
}

function setupDemoPlayButton() {
  const { demoPath, runtimeMap } = getRuntimeDemoParams();
  const playButton = document.getElementById('demo-play-btn');
  if (!(playButton instanceof HTMLButtonElement)) {
    return;
  }
  const scenarioPath = demoPath || 'demo_move.json';
  const shouldShow = runtimeMap === 'edit_upload';
  playButton.style.display = shouldShow ? 'inline-flex' : 'none';
  if (!shouldShow) {
    return;
  }
  playButton.disabled = false;
  playButton.setAttribute('aria-disabled', 'false');
  playButton.addEventListener('click', async () => {
    if (demoRunInFlight) {
      return;
    }
    playButton.disabled = true;
    playButton.setAttribute('aria-disabled', 'true');
    playButton.textContent = '再生中...';
    try {
      await runDemoScenarioByPath(scenarioPath);
    } catch (_error) {
    } finally {
      playButton.disabled = false;
      playButton.setAttribute('aria-disabled', 'false');
      playButton.textContent = 'デモ再生';
    }
  });
}

async function bootDemoRunner() {
  const { demoPath, autorun } = getRuntimeDemoParams();
  setupDemoPlayButton();
  if (!demoPath || !autorun) {
    return;
  }
  const api = await waitForDemoApi();
  await runDemoScenarioByPath(demoPath, { api });
}

bootDemoRunner().catch((_error) => {
});
