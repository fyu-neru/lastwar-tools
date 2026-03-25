import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBuildings } from './parse-buildings.js';

const data = parseBuildings();
const buildings = data.buildings;

test('HQ level 1: buildTime, costs, prerequisites', () => {
  const hq1 = buildings['Headquarters']?.levels?.['1'];
  assert.ok(hq1, 'Headquarters level 1 should exist');
  assert.equal(hq1.buildTime, 900);
  assert.deepEqual(hq1.costs, { electricity: 1, water: 6, oil: 10, iron: 13 });
  assert.deepEqual(hq1.prerequisites, [
    { building: 'Drill Ground', level: 1 },
    { building: '1st Squad', level: 1 },
  ]);
});

test('HQ level 2: prerequisites include Wall lv2 and Recon Plane lv1', () => {
  const hq2 = buildings['Headquarters']?.levels?.['2'];
  assert.ok(hq2, 'Headquarters level 2 should exist');
  const prereqs = hq2.prerequisites;
  const wall = prereqs.find(p => p.building === 'Wall');
  const recon = prereqs.find(p => p.building === 'Recon Plane');
  assert.ok(wall, 'Wall prerequisite should exist');
  assert.equal(wall.level, 2);
  assert.ok(recon, 'Recon Plane prerequisite should exist');
  assert.equal(recon.level, 1);
});

test('Wall level 1 exists and has buildTime > 0', () => {
  const wall1 = buildings['Wall']?.levels?.['1'];
  assert.ok(wall1, 'Wall level 1 should exist');
  assert.ok(wall1.buildTime > 0, `buildTime should be > 0, got ${wall1.buildTime}`);
});

test('1st Tech Center level 1 exists', () => {
  const tech1 = buildings['1st Tech Center']?.levels?.['1'];
  assert.ok(tech1, '1st Tech Center level 1 should exist');
});
