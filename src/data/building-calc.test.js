import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mock window before loading the module
global.window = {};

// Load building-calc.js by reading and eval-ing (since it attaches to window)
const calcPath = join(__dirname, '../../public/building-calc.js');
const calcSource = readFileSync(calcPath, 'utf-8');
// eslint-disable-next-line no-eval
(0, eval)(calcSource);

const { resolveUpgrades, sumResources } = global.window.BuildingCalc;

// Load building data
const dataPath = join(__dirname, '../../public/building-data.json');
const buildingData = JSON.parse(readFileSync(dataPath, 'utf-8'));

test('Test 1: resolveUpgrades HQ3 from scratch', () => {
  const upgrades = resolveUpgrades(buildingData, 'Headquarters', 3, {});

  const buildingLevels = upgrades.map(u => `${u.building}:${u.toLevel}`);

  // Must include HQ 1, 2, 3
  assert.ok(buildingLevels.includes('Headquarters:1'), 'Must include HQ:1');
  assert.ok(buildingLevels.includes('Headquarters:2'), 'Must include HQ:2');
  assert.ok(buildingLevels.includes('Headquarters:3'), 'Must include HQ:3');

  // Must include known prerequisites
  assert.ok(buildingLevels.includes('Drill Ground:1'), 'Must include Drill Ground:1');
  assert.ok(buildingLevels.includes('1st Squad:1'), 'Must include 1st Squad:1');
  assert.ok(buildingLevels.includes('Wall:2'), 'Must include Wall:2');
  assert.ok(buildingLevels.includes('Recon Plane:1'), 'Must include Recon Plane:1');

  // Topological order: each prerequisite must appear before the dependent HQ upgrade
  function indexOfUpgrade(building, toLevel) {
    return upgrades.findIndex(u => u.building === building && u.toLevel === toLevel);
  }

  // Drill Ground:1 must come before HQ:1
  assert.ok(
    indexOfUpgrade('Drill Ground', 1) < indexOfUpgrade('Headquarters', 1),
    'Drill Ground:1 before HQ:1'
  );
  // 1st Squad:1 must come before HQ:1
  assert.ok(
    indexOfUpgrade('1st Squad', 1) < indexOfUpgrade('Headquarters', 1),
    '1st Squad:1 before HQ:1'
  );
  // Wall:2 must come before HQ:2
  assert.ok(
    indexOfUpgrade('Wall', 2) < indexOfUpgrade('Headquarters', 2),
    'Wall:2 before HQ:2'
  );
  // Recon Plane:1 must come before HQ:2
  assert.ok(
    indexOfUpgrade('Recon Plane', 1) < indexOfUpgrade('Headquarters', 2),
    'Recon Plane:1 before HQ:2'
  );
  // Barracks:3 must come before HQ:3
  assert.ok(
    indexOfUpgrade('Barracks', 3) < indexOfUpgrade('Headquarters', 3),
    'Barracks:3 before HQ:3'
  );
  // Drill Ground:3 must come before HQ:3
  assert.ok(
    indexOfUpgrade('Drill Ground', 3) < indexOfUpgrade('Headquarters', 3),
    'Drill Ground:3 before HQ:3'
  );
});

test('Test 2: resolveUpgrades HQ3 with partial current levels', () => {
  const currentLevels = { 'Headquarters': 2, 'Wall': 2, 'Recon Plane': 1 };
  const upgrades = resolveUpgrades(buildingData, 'Headquarters', 3, currentLevels);

  const buildingLevels = upgrades.map(u => `${u.building}:${u.toLevel}`);

  // Should NOT include already-met upgrades
  assert.ok(!buildingLevels.includes('Headquarters:1'), 'Must NOT include HQ:1');
  assert.ok(!buildingLevels.includes('Headquarters:2'), 'Must NOT include HQ:2');
  assert.ok(!buildingLevels.includes('Wall:2'), 'Must NOT include Wall:2 (already met)');
  assert.ok(!buildingLevels.includes('Recon Plane:1'), 'Must NOT include Recon Plane:1 (already met)');

  // Should include HQ:3 and its new prereqs
  assert.ok(buildingLevels.includes('Headquarters:3'), 'Must include HQ:3');
});

test('Test 3: sumResources from HQ3 scratch', () => {
  const upgrades = resolveUpgrades(buildingData, 'Headquarters', 3, {});
  const totals = sumResources(upgrades);

  assert.ok(totals.electricity > 0, 'electricity > 0');
  assert.ok(totals.water > 0, 'water > 0');
  assert.ok(totals.oil > 0, 'oil > 0');
  assert.ok(totals.iron > 0, 'iron > 0');
  assert.ok(totals.totalTime > 0, 'totalTime > 0');
});
