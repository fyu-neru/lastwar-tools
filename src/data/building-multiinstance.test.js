import { test } from 'node:test';
import assert from 'node:assert';

// Load building-calc.js
global.window = {};
const src = (await import('node:fs')).readFileSync(
  new URL('../../public/building-calc.js', import.meta.url), 'utf8'
);
new Function('window', src)(window);

test('getUnlockedSlots: Farmland starts at 1 slot at HQ1', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Farmland', 1);
  assert.equal(slots, 1);
});

test('getUnlockedSlots: Farmland gets 2 slots at HQ2', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Farmland', 2);
  assert.equal(slots, 2);
});

test('getUnlockedSlots: Farmland gets 4 slots at HQ12', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Farmland', 12);
  assert.equal(slots, 4);
});

test('getUnlockedSlots: Farmland still 3 slots at HQ11', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Farmland', 11);
  assert.equal(slots, 3);
});

test('getUnlockedSlots: Gold Mine unlocks at HQ2', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Gold Mine', 2);
  assert.equal(slots, 1);
});

test('getUnlockedSlots: single-instance building returns 1', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Headquarters', 10);
  assert.equal(slots, 1);
});
