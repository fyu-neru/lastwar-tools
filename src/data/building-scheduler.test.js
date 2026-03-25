import { test } from 'node:test';
import assert from 'node:assert';

// Load the building calculator from the public directory
// We'll inline the functions for testing
const scheduleUpgrades = (upgrades, numQueues, speedBonusPct = 0) => {
  const queueFreeAt = new Array(numQueues).fill(0);
  const scheduled = [];

  for (let step = 0; step < upgrades.length; step++) {
    const upgrade = upgrades[step];

    let earliestQueue = 0;
    let earliestTime = queueFreeAt[0];
    for (let i = 1; i < numQueues; i++) {
      if (queueFreeAt[i] < earliestTime) {
        earliestTime = queueFreeAt[i];
        earliestQueue = i;
      }
    }

    const actualBuildTime = Math.round(
      upgrade.buildTime / (1 + speedBonusPct / 100)
    );

    const startTime = queueFreeAt[earliestQueue];
    const endTime = startTime + actualBuildTime;

    queueFreeAt[earliestQueue] = endTime;

    scheduled.push({
      step,
      building: upgrade.building,
      fromLevel: upgrade.fromLevel,
      toLevel: upgrade.toLevel,
      queue: earliestQueue,
      startTime,
      endTime,
      buildTime: actualBuildTime,
      costs: upgrade.costs || {},
    });
  }

  return scheduled;
};

const getTotalTime = (scheduledUpgrades) => {
  if (scheduledUpgrades.length === 0) return 0;
  return scheduledUpgrades[scheduledUpgrades.length - 1].endTime;
};

test('Single queue: 3 upgrades with buildTimes [100, 200, 300]', () => {
  const upgrades = [
    { building: 'Barracks', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
    { building: 'Factory', fromLevel: 0, toLevel: 1, buildTime: 200, costs: {} },
    { building: 'Lab', fromLevel: 0, toLevel: 1, buildTime: 300, costs: {} },
  ];

  const scheduled = scheduleUpgrades(upgrades, 1);

  assert.strictEqual(scheduled.length, 3);
  assert.strictEqual(scheduled[0].queue, 0);
  assert.strictEqual(scheduled[0].startTime, 0);
  assert.strictEqual(scheduled[0].endTime, 100);
  assert.strictEqual(scheduled[1].queue, 0);
  assert.strictEqual(scheduled[1].startTime, 100);
  assert.strictEqual(scheduled[1].endTime, 300);
  assert.strictEqual(scheduled[2].queue, 0);
  assert.strictEqual(scheduled[2].startTime, 300);
  assert.strictEqual(scheduled[2].endTime, 600);
});

test('Two queues: 4 upgrades [100, 100, 100, 100]', () => {
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
    { building: 'C', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
    { building: 'D', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
  ];

  const scheduled = scheduleUpgrades(upgrades, 2);

  assert.strictEqual(scheduled.length, 4);
  // Queue assignment: step 0 → queue 0, step 1 → queue 1, step 2 → queue 0, step 3 → queue 1
  assert.strictEqual(scheduled[0].queue, 0);
  assert.strictEqual(scheduled[0].endTime, 100);
  assert.strictEqual(scheduled[1].queue, 1);
  assert.strictEqual(scheduled[1].endTime, 100);
  assert.strictEqual(scheduled[2].queue, 0);
  assert.strictEqual(scheduled[2].endTime, 200);
  assert.strictEqual(scheduled[3].queue, 1);
  assert.strictEqual(scheduled[3].endTime, 200);

  const totalTime = getTotalTime(scheduled);
  assert.strictEqual(totalTime, 200);
});

test('Speed bonus 100%: buildTime 900 → actualBuildTime 450', () => {
  const upgrades = [
    { building: 'Tech', fromLevel: 0, toLevel: 1, buildTime: 900, costs: {} },
  ];

  const scheduled = scheduleUpgrades(upgrades, 1, 100);

  assert.strictEqual(scheduled.length, 1);
  assert.strictEqual(scheduled[0].buildTime, 450);
  assert.strictEqual(scheduled[0].endTime, 450);
});

test('getTotalTime: returns endTime of last scheduled step', () => {
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 200, costs: {} },
    { building: 'C', fromLevel: 0, toLevel: 1, buildTime: 150, costs: {} },
  ];

  const scheduled = scheduleUpgrades(upgrades, 2);
  const totalTime = getTotalTime(scheduled);

  assert.strictEqual(totalTime, scheduled[scheduled.length - 1].endTime);
  assert.strictEqual(totalTime, 250);
});

// --- scheduleWithGemCost tests ---
// Simulate window.BuildingCalc for node test environment
const window = { BuildingCalc: null };
// Load the IIFE by evaluating building-calc.js in this scope
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const calcSrc = readFileSync(path.resolve(__dirname, '../../public/building-calc.js'), 'utf8');
// eslint-disable-next-line no-new-func
new Function('window', calcSrc)(window);

test('1-queue selection simulates 2 queues and returns gem cost', () => {
  // 4 upgrades, each 3600 seconds (1 hour)
  // With 2 queues: total time = 2 * 3600 = 7200s (tasks go [Q0,Q1,Q0,Q1])
  // Renting 2nd queue for 7200s = ceil(7200/7200) = 1 rental = 200 gems
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 3600, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 3600, costs: {} },
    { building: 'C', fromLevel: 0, toLevel: 1, buildTime: 3600, costs: {} },
    { building: 'D', fromLevel: 0, toLevel: 1, buildTime: 3600, costs: {} },
  ];
  // When user selects 1 queue, we simulate with 2 and track gem cost
  const result = window.BuildingCalc.scheduleWithGemCost(upgrades, 1, 0);
  assert.equal(result.simulatedQueues, 2);
  assert.ok(result.gemCost >= 200, `gemCost should be >= 200, got ${result.gemCost}`);
  assert.equal(result.scheduled.length, 4);
  // All tasks should be assigned to either queue 0 or queue 1
  assert.ok(result.scheduled.every(s => s.queue === 0 || s.queue === 1));
});

test('scheduleWithGemCost with 2+ queues: no gem cost', () => {
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 900, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 900, costs: {} },
  ];
  const result = window.BuildingCalc.scheduleWithGemCost(upgrades, 2, 0);
  assert.equal(result.gemCost, 0);
  assert.equal(result.simulatedQueues, 2);
});
