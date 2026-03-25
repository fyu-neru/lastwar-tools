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

// Science-based slot unlock tests
test('getUnlockedSlots: Oil Well has 0 slots without unlock_oil_well science', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 35, {});
  assert.equal(slots, 0);
});

test('getUnlockedSlots: Oil Well gets 1 slot at HQ30 with unlock_oil_well science', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 30, { unlock_oil_well: true });
  assert.equal(slots, 1);
});

test('getUnlockedSlots: Oil Well gets 2 slots at HQ31 with unlock_oil_well science', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 31, { unlock_oil_well: true });
  assert.equal(slots, 2);
});

test('getUnlockedSlots: Oil Well gets 3 slots at HQ33 with unlock_oil_well science', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 33, { unlock_oil_well: true });
  assert.equal(slots, 3);
});

test('getUnlockedSlots: Oil Well gets 4 slots at HQ34 with unlock_oil_well science', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 34, { unlock_oil_well: true });
  assert.equal(slots, 4);
});

test('getUnlockedSlots: Oil Well gets 5 slots at HQ34 with both oil well sciences', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 34, { unlock_oil_well: true, extra_oil_well: true });
  assert.equal(slots, 5);
});

test('getUnlockedSlots: Oil Well: extra_oil_well alone gives 0 (gate not met)', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 35, { extra_oil_well: true });
  assert.equal(slots, 0);
});

test('getUnlockedSlots: Oil Well matches confirmed HQ31 account (3 wells = HQ31 + extra science)', () => {
  // User confirmed: HQ31 account with 額外油井 science = 3 oil wells
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 31, { unlock_oil_well: true, extra_oil_well: true });
  assert.equal(slots, 3);
});

test('getUnlockedSlots: Oil Well matches confirmed HQ34 account (5 wells = HQ34 + extra science)', () => {
  // User confirmed: HQ34 account with 額外油井 science = 5 oil wells
  const slots = window.BuildingCalc.getUnlockedSlots('Oil Well', 34, { unlock_oil_well: true, extra_oil_well: true });
  assert.equal(slots, 5);
});

test('getUnlockedSlots: Farmland with extra_farmland science gets +1 slot', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Farmland', 12, { extra_farmland: true });
  assert.equal(slots, 5);
});

test('getUnlockedSlots: Gold Mine with extra_gold_mine science gets 2 slots', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Gold Mine', 15, { extra_gold_mine: true });
  assert.equal(slots, 2);
});

test('getUnlockedSlots: Iron Mine with extra_iron_mine science gets 2 slots', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Iron Mine', 10, { extra_iron_mine: true });
  assert.equal(slots, 2);
});

test('getUnlockedSlots: science param defaults to no bonus when omitted', () => {
  const slots = window.BuildingCalc.getUnlockedSlots('Farmland', 12);
  assert.equal(slots, 4);
});
