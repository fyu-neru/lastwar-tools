import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// Load building-calc.js in Node (simulate browser window)
global.window = {};
const src = readFileSync(new URL('../../public/building-calc.js', import.meta.url), 'utf8');
new Function('window', src)(window);
const { buildDependencyTree } = window.BuildingCalc;

const buildingData = JSON.parse(
  readFileSync(new URL('../../public/building-data.json', import.meta.url), 'utf8')
);

test('buildDependencyTree: root node is the target building', () => {
  const tree = buildDependencyTree(buildingData, 'Headquarters', 3, {});
  assert.equal(tree.building, 'Headquarters');
  assert.equal(tree.level, 3);
  assert.equal(tree.met, false);
});

test('buildDependencyTree: met=true when player already has the level', () => {
  const tree = buildDependencyTree(buildingData, 'Wall', 2, { 'Wall': 3 });
  assert.equal(tree.met, true);
});

test('buildDependencyTree: children include prerequisites', () => {
  // HQ level 1 requires Drill Ground 1 and 1st Squad 1
  const tree = buildDependencyTree(buildingData, 'Headquarters', 1, {});
  const childNames = tree.children.map(c => c.building);
  assert.ok(childNames.includes('Drill Ground'), 'should include Drill Ground');
  assert.ok(childNames.includes('1st Squad'), 'should include 1st Squad');
});

test('buildDependencyTree: met prerequisites are marked correctly', () => {
  const tree = buildDependencyTree(buildingData, 'Headquarters', 1, {
    'Drill Ground': 1, // met
    '1st Squad': 0,    // not met
  });
  const drillNode = tree.children.find(c => c.building === 'Drill Ground');
  const squadNode = tree.children.find(c => c.building === '1st Squad');
  assert.ok(drillNode, 'Drill Ground node should exist');
  assert.ok(squadNode, '1st Squad node should exist');
  assert.equal(drillNode.met, true);
  assert.equal(squadNode.met, false);
});

test('buildDependencyTree: no infinite recursion (returns cleanly)', () => {
  // Should complete without stack overflow even for deep tree
  const tree = buildDependencyTree(buildingData, 'Headquarters', 10, {});
  assert.ok(tree, 'tree should be defined');
  assert.ok(Array.isArray(tree.children), 'children should be array');
});
