import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CSV_PATH = 'D:/git/lastwar/decoded_csv/building.csv';
const OUTPUT_PATH = join(__dirname, '../../public/building-data.json');

const BUILDING_NAMES_EN = {
  '10100': 'Headquarters',
  '10103': 'Barracks',
  '10104': 'Drill Ground',
  '10105': '1st Squad',
  '10106': 'Alliance Support Hub',
  '10107': 'Wall',
  '10113': 'Recon Plane',
  '10116': 'Tank Center',
  '10117': 'Missile Center',
  '10118': 'Aircraft Center',
  '10119': "Builder's Hut",
  '10123': '1st Tech Center',
  '10124': 'Hospital',
  '10142': '2nd Tech Center',
  '10201': 'Farmland',
  '10202': 'Iron Mine',
  '10207': 'Gold Mine',
  '10221': 'Oil Well',
};

const BUILDING_NAMES_ZH = {
  '10100': '總部',
  '10103': '兵營',
  '10104': '校場',
  '10105': '第一小隊',
  '10106': '同盟互助中心',
  '10107': '城牆',
  '10113': '偵察機',
  '10116': '坦克中心',
  '10117': '導彈中心',
  '10118': '飛機中心',
  '10119': '建築工小屋',
  '10123': '第1科學研究中心',
  '10124': '醫院',
  '10142': '第2科學研究中心',
  '10201': '農田',
  '10202': '鐵礦場',
  '10207': '金礦',
  '10221': '油井',
};

const RESOURCE_NAMES = {
  '2': 'electricity',
  '3': 'water',
  '4': 'oil',
  '5': 'iron',
};

function parseCosts(resourceStr) {
  const costs = {};
  if (!resourceStr || resourceStr.trim() === '') return costs;
  for (const pair of resourceStr.split('|')) {
    const [typeId, amount] = pair.split(';');
    const name = RESOURCE_NAMES[typeId];
    if (name) {
      costs[name] = parseInt(amount, 10);
    }
  }
  return costs;
}

function parsePrerequisites(prereqStr) {
  const prereqs = [];
  if (!prereqStr || prereqStr.trim() === '') return prereqs;
  for (const pair of prereqStr.split('|')) {
    const [rawId, levelStr] = pair.split(';');
    if (!rawId || rawId.trim() === '') continue;
    const typeId = rawId.trim().slice(0, 5);
    const name = BUILDING_NAMES_EN[typeId];
    if (name) {
      prereqs.push({ building: name, level: parseInt(levelStr, 10) });
    }
  }
  return prereqs;
}

export function parseBuildings(csvPath = CSV_PATH) {
  const content = readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').map(l => l.trimEnd());

  const buildings = {};

  let i = 0;
  while (i < lines.length) {
    const line1 = lines[i];
    if (!line1 || line1.trim() === '') { i++; continue; }

    const cols1 = line1.split(',');
    const rawId = cols1[0];
    // ID must be 8 digits
    if (!/^\d{8}$/.test(rawId)) { i++; continue; }

    const typeId = rawId.slice(0, 5);
    const level = parseInt(rawId.slice(5), 10);

    // Skip level 0 (placeholder)
    if (level === 0) { i += 3; continue; }

    const nameEn = BUILDING_NAMES_EN[typeId];
    if (!nameEn) { i += 3; continue; }

    // Parse build time from col[9]
    const buildInfo = cols1[9] || '';
    const buildTime = parseInt(buildInfo.split(';')[0], 10) || 0;

    // Parse prerequisites from col[14]
    const prereqStr = cols1[14] || '';
    const prerequisites = parsePrerequisites(prereqStr);

    // Line 2: costs
    const line2 = lines[i + 1] || '';
    const cols2 = line2.split(',');
    const resourceStr = cols2[13] || '';
    const costs = parseCosts(resourceStr);

    // Build output structure
    if (!buildings[nameEn]) {
      buildings[nameEn] = {
        nameZh: BUILDING_NAMES_ZH[typeId],
        levels: {},
      };
    }

    buildings[nameEn].levels[String(level)] = {
      buildTime,
      costs,
      prerequisites,
    };

    i += 3;
  }

  return { buildings };
}

// Run as script
const data = parseBuildings();
writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log(`Written to ${OUTPUT_PATH}`);
console.log(`Buildings: ${Object.keys(data.buildings).length}`);
