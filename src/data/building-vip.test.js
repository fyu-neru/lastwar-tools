import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

global.window = {};
const src = readFileSync(new URL('../../public/building-calc.js', import.meta.url), 'utf8');
new Function('window', src)(window);
const { scheduleWithVipProgression, getVipLevel } = window.BuildingCalc;

test('getVipLevel: 0 points = VIP 1', () => {
  assert.equal(getVipLevel(0), 1);
});

test('getVipLevel: 499 points = VIP 1', () => {
  assert.equal(getVipLevel(499), 1);
});

test('getVipLevel: 500 points = VIP 2', () => {
  assert.equal(getVipLevel(500), 2);
});

test('getVipLevel: 5000 points = VIP 4', () => {
  assert.equal(getVipLevel(5000), 4);
});

test('getVipLevel: 3000000 points = VIP 15', () => {
  assert.equal(getVipLevel(3000000), 15);
});

test('scheduleWithVipProgression: VIP level-up increases speed for later tasks', () => {
  // Start at VIP 2 (500 points, speed=0%). Need 500 more to reach VIP 3 (speed=10%).
  // Task A: buildTime=600s → grants 600 VIP exp → total=1100, reaches VIP 3
  // Task B: buildTime=1000s → should use VIP 3 speed (10%) → actualBuildTime=909s
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 600, costs: {} },
    { building: 'B', fromLevel: 0, toLevel: 1, buildTime: 1000, costs: {} },
  ];
  const result = scheduleWithVipProgression(upgrades, 1, {
    startingVipPoints: 500, // VIP 2 threshold
    startingVipLevel: 2,
    hasPosition: false,
  });
  // Task A: VIP 2 speed=0%, actualBuildTime=600
  assert.equal(result.scheduled[0].buildTime, 600);
  assert.equal(result.scheduled[0].vipLevelAtStart, 2);
  // Task B: VIP 3 speed=10%, actualBuildTime=Math.round(1000/1.1)=909
  assert.equal(result.scheduled[1].buildTime, Math.round(1000 / 1.1));
  assert.equal(result.scheduled[1].vipLevelAtStart, 3);
});

test('scheduleWithVipProgression: no VIP level-up if insufficient exp', () => {
  // Start at VIP 1 (0 points). Task builds 400s, needs 500 to reach VIP 2.
  const upgrades = [
    { building: 'A', fromLevel: 0, toLevel: 1, buildTime: 400, costs: {} },
  ];
  const result = scheduleWithVipProgression(upgrades, 1, {
    startingVipPoints: 0,
    startingVipLevel: 1,
    hasPosition: false,
  });
  assert.equal(result.scheduled[0].vipLevelAtStart, 1);
  assert.equal(result.scheduled[0].buildTime, 400); // VIP 1 = 0% speed
});
