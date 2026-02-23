import * as THREE from 'three';
import { BASE_WORLD_SCALE, LEGACY_TRACK_SOURCE_SCALE } from './scale_config.js';

const TRACK_DATA_URL = 'map_data/track_points.json';
const TRACK_DATA_VERSION = 1;
export const ENABLE_MANUAL_DIORAMA_SPACE = false;
export const USE_SAVED_DATA_ONLY = true;
const CORE_TRACK_KEYS = [
  'Points_0',
  'Points_1',
  'Points_2',
  'Points_3',
  'JK_upbound_point',
  'JY_upbound_point',
  'JY_downbound_point',
  'JK_downbound_point',
  'J_UJT_upbound_point',
  'J_UJT_downbound_point',
  'sinkansen_upbound_point',
  'sinkansen_downbound_point',
  'marunouchi_point',
];

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

  // 既存コード互換のため、主要キーは不足時に補完して必ず存在させる。
  CORE_TRACK_KEYS.forEach((name) => {
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
    const trackDataRaw = await loadTrackData(TRACK_DATA_URL);
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

  const Points_0 = trackMap.Points_0;
  const Points_1 = trackMap.Points_1;
  const Points_2 = trackMap.Points_2;
  const Points_3 = trackMap.Points_3;

  const JK_upbound_point = trackMap.JK_upbound_point;
  const JY_upbound_point = trackMap.JY_upbound_point;
  const JY_downbound_point = trackMap.JY_downbound_point;
  const JK_downbound_point = trackMap.JK_downbound_point;

  const J_UJT_upbound_point = trackMap.J_UJT_upbound_point;
  const J_UJT_downbound_point = trackMap.J_UJT_downbound_point;

  const sinkansen_upbound_point = trackMap.sinkansen_upbound_point;
  const sinkansen_downbound_point = trackMap.sinkansen_downbound_point;
  const marunouchi_point = trackMap.marunouchi_point;

  const line_1 = new THREE.CatmullRomCurve3(Points_0);
  const line_2 = new THREE.CatmullRomCurve3(Points_1);
  const line_3 = new THREE.CatmullRomCurve3(Points_2);
  const line_4 = new THREE.CatmullRomCurve3(Points_3);

  const JK_upbound = new THREE.CatmullRomCurve3(JK_upbound_point);
  const JY_upbound = new THREE.CatmullRomCurve3(JY_upbound_point);
  const JY_downbound = new THREE.CatmullRomCurve3(JY_downbound_point);
  const JK_downbound = new THREE.CatmullRomCurve3(JK_downbound_point);

  const J_UJT_upbound = new THREE.CatmullRomCurve3(J_UJT_upbound_point);
  const J_UJT_downbound = new THREE.CatmullRomCurve3(J_UJT_downbound_point);

  const sinkansen_upbound = new THREE.CatmullRomCurve3(sinkansen_upbound_point);
  const sinkansen_downbound = new THREE.CatmullRomCurve3(sinkansen_downbound_point);
  const marunouchi = new THREE.CatmullRomCurve3(marunouchi_point);

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
    Points_0,
    Points_1,
    Points_2,
    Points_3,
    JK_upbound_point,
    JY_upbound_point,
    JY_downbound_point,
    JK_downbound_point,
    J_UJT_upbound_point,
    J_UJT_downbound_point,
    sinkansen_upbound_point,
    sinkansen_downbound_point,
    marunouchi_point,
    line_1,
    line_2,
    line_3,
    line_4,
    JK_upbound,
    JY_upbound,
    JY_downbound,
    JK_downbound,
    J_UJT_upbound,
    J_UJT_downbound,
    sinkansen_upbound,
    sinkansen_downbound,
    marunouchi,
    railTrackDefs,
    railTrackCurveMap,
  };
}
