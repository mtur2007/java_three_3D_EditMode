import * as THREE from 'three';

const TRACK_DATA_URL = 'map_data/track_points.json';
const TRACK_DATA_VERSION = 1;
const REQUIRED_TRACK_KEYS = [
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

  const tracks = {};
  REQUIRED_TRACK_KEYS.forEach((name) => {
    const rawList = rawTracks[name];
    if (!Array.isArray(rawList) || !rawList.every(isPlainPoint)) {
      throw new Error('track_points.json に不足または不正な点群があります: ' + name);
    }
    tracks[name] = pointsToVector3(rawList);
  });

  const dataIsScaled = !!(rawData && rawData.meta && rawData.meta.scaled === true);
  return { tracks, dataIsScaled };
}

function buildTrackDataPayload(trackMap) {
  return {
    meta: {
      version: TRACK_DATA_VERSION,
      scaled: true,
      savedAt: new Date().toISOString(),
    },
    tracks: {
      Points_0: pointsToPlain(trackMap.Points_0),
      Points_1: pointsToPlain(trackMap.Points_1),
      Points_2: pointsToPlain(trackMap.Points_2),
      Points_3: pointsToPlain(trackMap.Points_3),
      JK_upbound_point: pointsToPlain(trackMap.JK_upbound_point),
      JY_upbound_point: pointsToPlain(trackMap.JY_upbound_point),
      JY_downbound_point: pointsToPlain(trackMap.JY_downbound_point),
      JK_downbound_point: pointsToPlain(trackMap.JK_downbound_point),
      J_UJT_upbound_point: pointsToPlain(trackMap.J_UJT_upbound_point),
      J_UJT_downbound_point: pointsToPlain(trackMap.J_UJT_downbound_point),
      sinkansen_upbound_point: pointsToPlain(trackMap.sinkansen_upbound_point),
      sinkansen_downbound_point: pointsToPlain(trackMap.sinkansen_downbound_point),
      marunouchi_point: pointsToPlain(trackMap.marunouchi_point),
    },
  };
}

function downloadTrackData(trackMap) {
  const payload = buildTrackDataPayload(trackMap);
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

export async function initTrackSetup() {
  let trackMap = null;
  let dataIsScaled = false;
  try {
    const trackDataRaw = await loadTrackData(TRACK_DATA_URL);
    const normalized = normalizeTrackData(trackDataRaw);
    trackMap = normalized.tracks;
    dataIsScaled = normalized.dataIsScaled;
  } catch (err) {
    alert(err.message);
    throw err;
  }

  const scale = 0.35 / 0.45;
  if (!dataIsScaled) {
    Object.keys(trackMap).forEach((name) => {
      trackMap[name].forEach((v) => v.multiplyScalar(scale));
    });
  }

  const saveTrackButton = document.getElementById('save-track-data');
  if (saveTrackButton) {
    saveTrackButton.addEventListener('click', () => downloadTrackData(trackMap));
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

  const railTrackDefs = [
    { name: 'Points_0', curve: line_1, points: Points_0 },
    { name: 'Points_1', curve: line_2, points: Points_1 },
    { name: 'Points_2', curve: line_3, points: Points_2 },
    { name: 'Points_3', curve: line_4, points: Points_3 },
    { name: 'JK_upbound_point', curve: JK_upbound, points: JK_upbound_point },
    { name: 'JY_upbound_point', curve: JY_upbound, points: JY_upbound_point },
    { name: 'JY_downbound_point', curve: JY_downbound, points: JY_downbound_point },
    { name: 'JK_downbound_point', curve: JK_downbound, points: JK_downbound_point },
    { name: 'J_UJT_upbound_point', curve: J_UJT_upbound, points: J_UJT_upbound_point },
    { name: 'J_UJT_downbound_point', curve: J_UJT_downbound, points: J_UJT_downbound_point },
    { name: 'sinkansen_upbound_point', curve: sinkansen_upbound, points: sinkansen_upbound_point },
    { name: 'sinkansen_downbound_point', curve: sinkansen_downbound, points: sinkansen_downbound_point },
    { name: 'marunouchi_point', curve: marunouchi, points: marunouchi_point },
  ];

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
