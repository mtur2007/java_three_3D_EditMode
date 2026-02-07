import * as THREE from 'three';

export function applyFixedPlacements({
  TSys,
  line_1,
  line_2,
  line_3,
  line_4,
  Points_0,
  Points_1,
  Points_2,
  Points_3,
  JK_upbound,
  JY_upbound,
  JY_downbound,
  JK_downbound,
  J_UJT_upbound,
  J_UJT_downbound,
  sinkansen_upbound,
  sinkansen_downbound,
  marunouchi,
  train_width,
  car_Spacing,
  y,
  LoadModels,
  scene,
  findCurveRange,
  targetObjects,
  resetMeshListOpacity,
  setMeshListOpacity,
}) {
  const station_s = { x: -0.08825664191497662, y: 6.394628223749855, z: -30.695962680017335 };
  const station_loof_f = { x: -0.3852393328186856, y: 6.394628223749855, z: -3.535125641715606 };
  const station_f = { x: -0.023948863771414863, y: 6.394628223749855, z: 60.51354120550737 };
  const wall_f = { x: 3.5989745081382956, y: 6.394628223749855, z: -97.26135689524132 };
  const tunnel_f = { x: 6.600868195728852, y: 7.382920205399699, z: -114.92055445840528 };
  const GirderBridge_2s = { x: 5.001398579127916, y: 8.083673215609398, z: -112.97485249672447 };
  const GirderBridge_3s = { x: 4.230750095101928, y: 8.083673215609398, z: -107.2650424352493 };
  const GirderBridge_2f = { x: 0.6169566203936264, y: 8.083673215609398, z: -131.36793571309448 };
  const GirderBridge_3f = { x: -0.25619051153051203, y: 8.083673215609398, z: -129.1500954585025 };

  const JB_elevated_s = { x: -5.7208845108099355, y: 3.4737070495198132, z: -163.0539699013825 };
  const JB_elevated_f = { x: 17.981473636001454, y: 3.4737070495198132, z: -232.08566441107527 };

  const track1 = findCurveRange(line_1, station_s, station_f);
  const track2 = findCurveRange(line_2, station_s, station_f);
  const track3 = findCurveRange(line_3, station_s, station_f);
  const track4 = findCurveRange(line_4, station_s, station_f);

  const JB_u_elevated = findCurveRange(line_2, JB_elevated_s, JB_elevated_f);
  const JB_d_elevated = findCurveRange(line_3, JB_elevated_s, JB_elevated_f);

  const roof_track1 = findCurveRange(line_1, station_s, station_loof_f);
  const roof_track2 = findCurveRange(line_2, station_s, station_loof_f);
  const roof_track3 = findCurveRange(line_3, station_s, station_loof_f);
  const roof_track4 = findCurveRange(line_4, station_s, station_loof_f);

  const wall_track1 = findCurveRange(line_1, station_s, wall_f);
  const wall_track2 = findCurveRange(line_2, station_s, wall_f);
  const wall_track3 = findCurveRange(line_3, station_s, wall_f);
  const wall_track4 = findCurveRange(line_4, station_s, wall_f);

  const tunnel_1 = findCurveRange(line_4, wall_f, tunnel_f);
  const tunnel_2 = findCurveRange(line_4, wall_f, tunnel_f);

  const bridge_2 = findCurveRange(line_2, GirderBridge_2s, GirderBridge_2f);
  const bridge_3 = findCurveRange(line_3, GirderBridge_3s, GirderBridge_3f);

  const Elevated_2 = findCurveRange(line_2, Points_1[0], GirderBridge_2s);
  const Elevated_3 = findCurveRange(line_3, Points_2[0], GirderBridge_3f);

  TSys.createTrack(line_1, 1.83, 0x000000);
  TSys.createTrack(line_2, 1.83, 0x000000);
  TSys.createTrack(line_3, 1.83, 0x000000);
  TSys.createTrack(line_4, 1.83, 0x000000);

  // 駅(プラットホーム)を生成
  TSys.createStation(track1, track2, 200, y - 1, 0.6, '|[]|');
  TSys.createStation(track3, track4, 200, y - 1, 0.6, '|[]|');

  // 駅(屋根)を生成
  TSys.placePlatformRoof(roof_track1, roof_track2, y + 0.4, 10);
  TSys.placePlatformRoof(roof_track3, roof_track4, y + 0.4, 10);

  const door_interval = train_width + car_Spacing;
  const track1_doors = TSys.placePlatformDoors(track1, 0.7, door_interval, 'left');
  const track2_doors = TSys.placePlatformDoors(track2, 0.7, door_interval, 'right');
  const track3_doors = TSys.placePlatformDoors(track3, 0.7, door_interval, 'left');
  const track4_doors = TSys.placePlatformDoors(track4, 0.7, door_interval, 'right');

  const quantity = 3;
  const river = findCurveRange(line_4, Points_3[Points_3.length - 1], { x: 38.79449255756082, y: y + 0.40000000000000036, z: -189.92134871967772 });
  console.log(river);

  TSys.createWall(river, river, 40, 0.885, 2, 0, -4);
  TSys.createWall(river, river, 40, 10, 10, -4, -3);
  TSys.createWall(river, river, 40, 10, 30, -3, -3);

  const water_material = new THREE.MeshStandardMaterial({
    color: 0x005555,
    metalness: 0.3,
    roughness: 0,
    envMapIntensity: 1,
    side: THREE.DoubleSide,
  });
  TSys.createWall(river, river, 40, 2, 10, -4, -4, 0x003355, water_material);
  TSys.createElevator;

  // 高架(柱/床版)を生成
  const interval = 1;
  TSys.generateElevated(JB_d_elevated, 10, interval);
  TSys.generateElevated(JB_u_elevated, 10, interval);

  // 線路生成
  TSys.createRail(line_1);
  TSys.createRail(line_2);
  TSys.createRail(line_3);
  TSys.createRail(line_4);

  TSys.createRail(JK_upbound);
  TSys.createRail(JY_upbound);
  TSys.createRail(JY_downbound);
  TSys.createRail(JK_downbound);

  TSys.createWall(JK_upbound, JK_downbound, 40, 1, -1, 0, 0, 0x6d5c4e);

  TSys.createRail(J_UJT_upbound);
  TSys.createRail(J_UJT_downbound);
  TSys.createWall(J_UJT_upbound, J_UJT_upbound, 40, 0.9, 0.9, 0.8, 0, 0xbbbbbb);
  TSys.createWall(J_UJT_upbound, J_UJT_upbound, 40, 1, 1, 0.8, 0, 0xbbbbbb);
  TSys.createWall(J_UJT_upbound, J_UJT_upbound, 40, 1, 0.9, 0.8, 0.8, 0xbbbbbb);
  TSys.createWall(J_UJT_downbound, J_UJT_downbound, 40, -0.9, -0.9, 0.8, 0, 0xbbbbbb);

  TSys.createRail(sinkansen_upbound);
  TSys.createRail(sinkansen_downbound);
  TSys.createRail(marunouchi);

  TSys.generateElevated(sinkansen_upbound, 10, interval);
  TSys.generateElevated(sinkansen_downbound, 10, interval);
  TSys.createWall(sinkansen_upbound, sinkansen_upbound, 40, 0.9, 0.9, 0.8, 0, 0x999999);
  TSys.createWall(sinkansen_downbound, sinkansen_downbound, 40, -0.9, -0.9, 0.8, 0, 0x999999);

  TSys.generateElevated(J_UJT_downbound, 10, interval, sinkansen_downbound, J_UJT_upbound);

  // 架線柱の生成
  const point_data = TSys.RailMargin(TSys.getPointsEveryM(wall_track4, 8), 1, true);
  const pole_line = point_data[0];
  const pole_angle = point_data[1];

  // right_height, left_height, beamLength, beam_height
  const Poles = TSys.createCatenaryPole(0, 3.2, 1.4, 2.3, 5);
  for (let i = 0; i < Poles.children.length; i++) {
    Poles.children[i].rotation.y += pole_angle[i];
    Poles.children[i].position.set(pole_line[i].x, pole_line[i].y, pole_line[i].z);
  }
  scene.add(Poles);

  const poletrak = findCurveRange(line_3, Points_2[0], station_f);
  const point_data2 = TSys.RailMargin(TSys.getPointsEveryM(poletrak, 8), 1, true);
  const pole_line2 = point_data2[0];
  const pole_angle2 = point_data2[1];

  // right_height, left_height, beamLength, beam_height
  // const Poles2 = TSys.createCatenaryPole(2.8,2.8,3.5,2.3, 40)
  // for(let i=0; i<Poles2.children.length; i++){
  //   Poles2.children[i].rotation.y += pole_angle2[i]
  //   Poles2.children[i].position.set(pole_line2[i].x,pole_line2[i].y,pole_line2[i].z)
  // }
  // scene.add(Poles2)

  // 架線柱の配置(上野東京ライン)
  if (LoadModels && LoadModels[3]) {
    const margin_data = TSys.RailMargin(TSys.getPointsEveryM(J_UJT_downbound, 9.5), 1, true);
    const margin = margin_data[0];
    const margin_angle = margin_data[1];
    const pole = LoadModels[3];
    for (let i = 0; i < margin.length; i++) {
      const clone_pole = pole.clone();
      clone_pole.rotation.y += margin_angle[i] + 90 * Math.PI / 180;
      const i_margin = margin[i];
      clone_pole.position.set(i_margin.x, i_margin.y + 1.1, i_margin.z);
      scene.add(clone_pole);
    }
  }

  resetMeshListOpacity(targetObjects, Points_1);
  setMeshListOpacity(targetObjects, 0);

  return {
    door_interval,
    track1_doors,
    track2_doors,
    track3_doors,
    track4_doors,
  };
}
