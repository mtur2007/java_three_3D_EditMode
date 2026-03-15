import * as THREE from 'three';
import { BASE_WORLD_SCALE, LEGACY_TRACK_SOURCE_SCALE } from './scale_config.js';

const TRACK_DATA_URL = 'map_data/track_points.json';
const TRACK_DATA_VERSION = 1;
const RUNTIME_MAP_DB_NAME = 'train-editmode-runtime-map';
const RUNTIME_MAP_STORE_NAME = 'runtimeMaps';
const RUNTIME_MAP_RECORD_KEY = 'public-selected-map';
export const ENABLE_MANUAL_DIORAMA_SPACE = false;
export const USE_SAVED_DATA_ONLY = true;
const REQUIRED_TRACK_KEYS = ['Points_0'];

function isPlainPoint(value) {
  return !!value &&
    typeof value === 'object' &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z);
}

function pointsToVector3(list) {
  return list.map((point) => new THREE.Vector3(point.x, point.y, point.z));
}

function pointsToPlain(list) {
  return list.map((point) => ({ x: point.x, y: point.y, z: point.z }));
}

function clonePointList(list) {
  return list.map((point) => ({ x: point.x, y: point.y, z: point.z }));
}

async function loadTrackData(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('track_points.json が見つかりません。');
  }
  const data = await response.json();
  if (!data || typeof data !== 'object') {
    throw new Error('track_points.json の形式が正しくありません。');
  }
  return data;
}

function openRuntimeMapDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(RUNTIME_MAP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RUNTIME_MAP_STORE_NAME)) {
        db.createObjectStore(RUNTIME_MAP_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

async function readRuntimeMapRecord() {
  const db = await openRuntimeMapDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RUNTIME_MAP_STORE_NAME, 'readonly');
    const store = transaction.objectStore(RUNTIME_MAP_STORE_NAME);
    const request = store.get(RUNTIME_MAP_RECORD_KEY);
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error('IndexedDB read failed'));
    };
  });
}

async function loadJsZipCtor() {
  const candidates = [
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm',
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  ];
  for (const url of candidates) {
    try {
      const mod = await import(url);
      const ctor = mod?.default || mod?.JSZip || null;
      if (ctor) {
        return ctor;
      }
    } catch (_error) {
      // Try the next candidate.
    }
  }
  throw new Error('ZIP 解析ライブラリの読み込みに失敗しました。');
}

function normalizeRuntimeFiles(record) {
  if (record?.files && typeof record.files === 'object') {
    return record.files;
  }
  if (record?.buffer && record?.name) {
    return { ct: record };
  }
  return {};
}

function isZipBytes(bytes) {
  return bytes instanceof Uint8Array
    && bytes.byteLength >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && bytes[2] === 0x03
    && bytes[3] === 0x04;
}

let msgpackDecodeFnPromise = null;

async function loadMsgpackDecodeFn() {
  if (msgpackDecodeFnPromise) {
    return msgpackDecodeFnPromise;
  }
  msgpackDecodeFnPromise = (async () => {
    const candidates = [
      'https://cdn.jsdelivr.net/npm/@msgpack/msgpack@2.8.0/+esm',
      'https://cdn.jsdelivr.net/npm/@msgpack/msgpack@2.8.0/dist.esm/index.js',
      'https://cdn.jsdelivr.net/npm/@msgpack/msgpack@3.0.0/dist.esm/index.mjs',
    ];
    for (const url of candidates) {
      try {
        const mod = await import(url);
        if (typeof mod?.decode === 'function') {
          return mod.decode.bind(mod);
        }
      } catch (_error) {
        // Try next candidate.
      }
    }
    throw new Error('msgpack codec の読み込みに失敗しました。');
  })();
  return msgpackDecodeFnPromise;
}

async function parseRuntimeTrackBytes(bytes, fileName = 'unknown') {
  const lower = String(fileName || '').trim().toLowerCase();
  if (lower.endsWith('.json')) {
    const text = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(text);
  }
  if (lower.endsWith('.msgpack') || lower.endsWith('.mpk')) {
    const decode = await loadMsgpackDecodeFn();
    return decode(bytes);
  }

  try {
    const text = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(text);
  } catch (_jsonError) {
    const decode = await loadMsgpackDecodeFn();
    return decode(bytes);
  }
}

function hasTrackPayloadShape(payload) {
  return !!payload
    && typeof payload === 'object'
    && payload.tracks
    && typeof payload.tracks === 'object'
    && !Array.isArray(payload.tracks);
}

async function loadRuntimeTrackDataFromUpload() {
  const searchParams = new URLSearchParams(window.location.search);
  const runtimeMapMode = String(searchParams.get('runtime_map') || '').trim();
  if (runtimeMapMode !== 'public_upload' && runtimeMapMode !== 'edit_upload') {
    return null;
  }

  const record = await readRuntimeMapRecord();
  const runtimeFiles = normalizeRuntimeFiles(record);
  const fileEntries = Object.values(runtimeFiles).filter((file) => file && typeof file === 'object' && file.buffer);
  if (fileEntries.length < 1) {
    return null;
  }

  for (const file of fileEntries) {
    const bytes = new Uint8Array(file.buffer);
    if (!isZipBytes(bytes)) {
      try {
        const payload = await parseRuntimeTrackBytes(bytes, file?.name);
        if (hasTrackPayloadShape(payload)) {
          console.info('[public_upload][tracks] loaded track payload from uploaded file', {
            name: file?.name,
          });
          return payload;
        }
      } catch (error) {
        console.warn('[public_upload][tracks] failed to parse non-zip runtime file', {
          name: file?.name,
          error: error?.message || String(error),
        });
      }
    }
    if (!isZipBytes(bytes)) {
      console.info('[public_upload][tracks] skip non-zip runtime file', {
        name: file?.name,
      });
      continue;
    }
    const JSZipCtor = await loadJsZipCtor();
    const zip = await JSZipCtor.loadAsync(bytes);
    const entryNames = Object.values(zip.files)
      .filter((entry) => entry && !entry.dir)
      .map((entry) => String(entry.name || ''));
    console.info('[public_upload][tracks] inspect uploaded zip entries', {
      zipName: file?.name,
      entryCount: entryNames.length,
      entryNames,
    });
    const trackEntry = Object.values(zip.files).find((entry) => {
      if (!entry || entry.dir) { return false; }
      const lower = String(entry.name || '').trim().toLowerCase();
      return lower.endsWith('track_points.json') || lower.endsWith('orbit.msgpack');
    });
    if (!trackEntry) {
      const payloadEntry = Object.values(zip.files).find((entry) => {
        if (!entry || entry.dir) { return false; }
        const lower = String(entry.name || '').trim().toLowerCase();
        return /\.(json|msgpack|mpk)$/i.test(lower);
      });
      if (!payloadEntry) {
        console.warn('[public_upload][tracks] track payload not found in uploaded zip', {
          zipName: file?.name,
        });
        continue;
      }
      try {
        const payloadBytes = await payloadEntry.async('uint8array');
        const payload = await parseRuntimeTrackBytes(payloadBytes, payloadEntry.name);
        if (hasTrackPayloadShape(payload)) {
          console.info('[public_upload][tracks] loaded track payload from uploaded zip entry', {
            zipName: file?.name,
            entryName: payloadEntry.name,
          });
          return payload;
        }
      } catch (error) {
        console.warn('[public_upload][tracks] failed to parse uploaded zip track payload', {
          zipName: file?.name,
          error: error?.message || String(error),
        });
      }
      console.warn('[public_upload][tracks] track payload not found in uploaded zip', {
        zipName: file?.name,
      });
      continue;
    }
    const entryBytes = await trackEntry.async('uint8array');
    const data = await parseRuntimeTrackBytes(entryBytes, trackEntry.name);
    console.info('[public_upload][tracks] loaded track payload from uploaded zip', {
      zipName: file.name,
      entryName: trackEntry.name,
    });
    return data;
  }

  return null;
}

function normalizeTrackData(rawData) {
  const rawTracks = rawData && typeof rawData === 'object' ? rawData.tracks : null;
  if (!rawTracks || typeof rawTracks !== 'object') {
    throw new Error('track_points.json に tracks がありません。');
  }

  const defaultFallback = [
    { x: -20, y: 1, z: 0 },
    { x: 20, y: 1, z: 0 },
  ];
  const points0Raw = rawTracks.Points_0;
  const baseFallback = (Array.isArray(points0Raw) && points0Raw.every(isPlainPoint) && points0Raw.length >= 2)
    ? clonePointList(points0Raw)
    : defaultFallback;

  const tracks = {};
  Object.entries(rawTracks).forEach(([name, rawList]) => {
    if (!Array.isArray(rawList) || !rawList.every(isPlainPoint) || rawList.length < 2) {
      console.warn(`[track_setup] 不正な点群をスキップしました: ${name}`);
      return;
    }
    tracks[name] = pointsToVector3(rawList);
  });

  REQUIRED_TRACK_KEYS.forEach((name) => {
    if (Array.isArray(tracks[name]) && tracks[name].length >= 2) { return; }
    console.warn(`[track_setup] 不足/不正な点群を補完しました: ${name}`);
    tracks[name] = pointsToVector3(baseFallback);
  });

  const dataIsScaled = !!(rawData && rawData.meta && rawData.meta.scaled === true);
  const metaScaleRaw = rawData?.meta?.scale;
  const metaScale = Number.isFinite(metaScaleRaw) && metaScaleRaw > 0 ? Number(metaScaleRaw) : null;
  const sourceScale = metaScale || (dataIsScaled ? BASE_WORLD_SCALE : LEGACY_TRACK_SOURCE_SCALE);
  return { tracks, sourceScale };
}

function buildFallbackTrackData() {
  const fallbackTracks = {
    Points_0: [
      { x: -40, y: 1, z: 0 },
      { x: 40, y: 1, z: 0 },
    ],
  };
  return {
    meta: {
      version: TRACK_DATA_VERSION,
      scaled: true,
      scale: BASE_WORLD_SCALE,
      savedAt: new Date().toISOString(),
      source: 'public_upload_fallback',
    },
    tracks: fallbackTracks,
  };
}

function buildTrackDataPayload(trackMap, scale = BASE_WORLD_SCALE) {
  const serializedTracks = Object.entries(trackMap || {}).reduce((acc, [name, points]) => {
    if (!Array.isArray(points) || points.length < 2) { return acc; }
    acc[name] = pointsToPlain(points);
    return acc;
  }, {});
  return {
    meta: {
      version: TRACK_DATA_VERSION,
      scaled: true,
      scale,
      savedAt: new Date().toISOString(),
    },
    tracks: serializedTracks,
  };
}

function downloadTrackData(trackMap, scale = BASE_WORLD_SCALE) {
  const payload = buildTrackDataPayload(trackMap, scale);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'track_points.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  alert('track_points.json を保存しました。');
}

export async function initTrackSetup(options = {}) {
  const {
    worldScale = BASE_WORLD_SCALE,
  } = options;
  let trackMap = null;
  let sourceScale = LEGACY_TRACK_SOURCE_SCALE;
  try {
    const runtimeTrackData = await loadRuntimeTrackDataFromUpload();
    const runtimeMapMode = String(new URLSearchParams(window.location.search).get('runtime_map') || '').trim();
    const isRuntimeLocalView = runtimeMapMode === 'public_upload' || runtimeMapMode === 'edit_upload';
    const trackDataRaw = isRuntimeLocalView
      ? (runtimeTrackData || buildFallbackTrackData())
      : await loadTrackData(TRACK_DATA_URL);
    if (isRuntimeLocalView && !runtimeTrackData) {
      console.warn('[public_upload][tracks] uploaded track data missing, using fallback tracks');
    }
    const normalized = normalizeTrackData(trackDataRaw);
    trackMap = normalized.tracks;
    sourceScale = normalized.sourceScale;
  } catch (err) {
    alert(err.message);
    throw err;
  }

  const scale = worldScale / sourceScale;
  if (Math.abs(scale - 1) > 1e-8) {
    Object.keys(trackMap).forEach((name) => {
      trackMap[name].forEach((v) => v.multiplyScalar(scale));
    });
  }

  const saveTrackButton = document.getElementById('save-track-data');
  if (saveTrackButton) {
    saveTrackButton.addEventListener('click', () => downloadTrackData(trackMap, worldScale));
  }

  const railTrackDefs = Object.entries(trackMap).map(([name, points]) => ({
    name,
    curve: new THREE.CatmullRomCurve3(points),
    points,
  }));

  const railTrackCurveMap = railTrackDefs.reduce((acc, track) => {
    acc[track.name] = track.curve;
    return acc;
  }, {});

  return {
    railTrackDefs,
    railTrackCurveMap,
  };
}
