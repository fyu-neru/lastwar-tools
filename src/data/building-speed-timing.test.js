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

const { scheduleUpgrades, scheduleWithGemCost } = global.window.BuildingCalc;

test('speed bonus is applied per-task at scheduling time, not retroactively', () => {
  // Two tasks with the same base buildTime
  // If speed bonus is applied at task start: both get the same bonus since bonus is fixed
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 1000, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 1000, costs: {} },
  ];
  const scheduled = scheduleUpgrades(upgrades, 1, 50); // 50% speed bonus
  // Expected: each task buildTime = Math.round(1000 / 1.5) = 667
  assert.equal(scheduled[0].buildTime, 667, 'Task A buildTime with 50% bonus');
  assert.equal(scheduled[1].buildTime, 667, 'Task B buildTime with 50% bonus');
  // Task B starts after A finishes
  assert.equal(scheduled[1].startTime, scheduled[0].endTime, 'Task B starts when A ends');
});

test('tasks on different queues start independently based on queue availability', () => {
  // 3 tasks on 2 queues, no speed bonus
  // Q0: [A(100)] then [C(100)]
  // Q1: [B(200)]
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 200, costs: {} },
    { building: 'C', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
  ];
  const scheduled = scheduleUpgrades(upgrades, 2, 0);
  // A: Q0, starts 0, ends 100
  // B: Q1, starts 0, ends 200
  // C: Q0 (free at 100, before Q1 free at 200), starts 100, ends 200
  assert.equal(scheduled[0].queue, 0, 'Task A assigned to queue 0');
  assert.equal(scheduled[0].startTime, 0, 'Task A starts at time 0');
  assert.equal(scheduled[0].endTime, 100, 'Task A ends at time 100');
  assert.equal(scheduled[1].queue, 1, 'Task B assigned to queue 1');
  assert.equal(scheduled[1].startTime, 0, 'Task B starts at time 0');
  assert.equal(scheduled[1].endTime, 200, 'Task B ends at time 200');
  assert.equal(scheduled[2].queue, 0, 'Task C assigned to queue 0');
  assert.equal(scheduled[2].startTime, 100, 'Task C starts at time 100');
  assert.equal(scheduled[2].endTime, 200, 'Task C ends at time 200');
});

test('zero speed bonus leaves buildTime unchanged', () => {
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 900, costs: {} },
  ];
  const scheduled = scheduleUpgrades(upgrades, 1, 0);
  assert.equal(scheduled[0].buildTime, 900, 'buildTime unchanged with 0% bonus');
});

test('scheduleWithGemCost: queue 1 tasks have correct startTime', () => {
  // When numQueues=1 but simulated with 2, Q1 tasks start when Q1 is free
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
    { building: 'C', fromLevel: 0, toLevel: 1, buildTime: 100, costs: {} },
  ];
  const result = scheduleWithGemCost(upgrades, 1, 0);
  // Simulated with 2 queues: A→Q0(0-100), B→Q1(0-100), C→Q0(100-200)
  assert.equal(result.simulatedQueues, 2, 'Simulated with 2 queues when user selects 1');
  assert.ok(result.scheduled[1].startTime === 0, 'B on Q1 starts at 0 (independent of Q0)');
});

test('100% speed bonus halves buildTime', () => {
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 1000, costs: {} },
  ];
  const scheduled = scheduleUpgrades(upgrades, 1, 100);
  // Expected: 1000 / (1 + 100/100) = 1000 / 2 = 500
  assert.equal(scheduled[0].buildTime, 500, 'buildTime halved with 100% bonus');
});

test('speed bonus applied independently per task in multi-queue scenario', () => {
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 600, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 600, costs: {} },
    { building: 'C', fromLevel: 0, toLevel: 1, buildTime: 600, costs: {} },
  ];
  const scheduled = scheduleUpgrades(upgrades, 3, 50);
  // Each task with 50% bonus: 600 / 1.5 = 400
  assert.equal(scheduled[0].buildTime, 400, 'A buildTime with 50% bonus');
  assert.equal(scheduled[1].buildTime, 400, 'B buildTime with 50% bonus');
  assert.equal(scheduled[2].buildTime, 400, 'C buildTime with 50% bonus');
  // All should start at 0 (different queues)
  assert.equal(scheduled[0].startTime, 0, 'A starts at 0');
  assert.equal(scheduled[1].startTime, 0, 'B starts at 0');
  assert.equal(scheduled[2].startTime, 0, 'C starts at 0');
  // All end at 400
  assert.equal(scheduled[0].endTime, 400, 'A ends at 400');
  assert.equal(scheduled[1].endTime, 400, 'B ends at 400');
  assert.equal(scheduled[2].endTime, 400, 'C ends at 400');
});
