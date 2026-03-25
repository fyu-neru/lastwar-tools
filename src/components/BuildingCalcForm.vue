<template>
  <div>
    <!-- Input Form -->
    <section>
      <h2 class="text-xl font-semibold mb-4">{{ labels.currentBuildings }}</h2>
      <div v-if="!dataLoaded" class="text-gray-500">Loading building data...</div>
      <div v-else>
        <details
          v-for="(groupBuildings, groupKey) in BUILDING_GROUPS"
          :key="groupKey"
          open
          class="mb-3 border border-gray-200 rounded"
        >
          <summary class="cursor-pointer px-4 py-2 bg-gray-50 font-medium select-none">
            {{ groupName(groupKey) }}
          </summary>
          <div class="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <template v-for="building in groupBuildings" :key="building">
              <!-- Hidden when slots = 0 (e.g. Oil Well before science unlock) -->
              <template v-if="getMultiInstanceSlots(building) === 0" />
              <!-- Multi-instance buildings (slots > 1) -->
              <template v-else-if="getMultiInstanceSlots(building) > 1">
                <div
                  v-for="slot in getMultiInstanceSlots(building)"
                  :key="`${building}_${slot}`"
                  class="flex items-center justify-between gap-2"
                >
                  <label class="text-sm flex-1">{{ displayName(building) }} {{ slot }}</label>
                  <select
                    v-model="currentLevels[`${building}_${slot}`]"
                    class="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                  >
                    <option v-for="lvl in levelOptions(building)" :key="lvl" :value="lvl">
                      {{ lvl }}
                    </option>
                  </select>
                </div>
              </template>
              <!-- Single-instance buildings (slots = 1) -->
              <div
                v-else
                class="flex items-center justify-between gap-2"
              >
                <label class="text-sm flex-1">{{ displayName(building) }}</label>
                <select
                  v-model="currentLevels[building]"
                  class="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                >
                  <option v-for="lvl in levelOptions(building)" :key="lvl" :value="lvl">
                    {{ lvl }}
                  </option>
                </select>
              </div>
            </template>
          </div>
        </details>

        <!-- Settings Section -->
        <div class="mt-4 mb-4 p-4 border border-gray-200 rounded bg-gray-50">
          <h3 class="font-semibold mb-3">{{ labels.settings }}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm text-gray-600">{{ labels.buildQueues }}</label>
              <select
                v-model="numQueues"
                class="border border-gray-300 rounded px-2 py-1 text-sm w-24"
              >
                <option v-for="q in [1,2,3,4]" :key="q" :value="q">{{ q }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm text-gray-600">{{ labels.vipLevel }}</label>
              <select
                v-model="vipLevel"
                class="border border-gray-300 rounded px-2 py-1 text-sm w-24"
              >
                <option v-for="v in 16" :key="v-1" :value="v-1">{{ v-1 }}</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm text-gray-600">{{ labels.vipPoints }}</label>
              <input
                type="number"
                v-model.number="vipPoints"
                min="0"
                class="border border-gray-300 rounded px-2 py-1 text-sm w-32"
              />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm text-gray-600">{{ labels.researchQueues }}</label>
              <select
                v-model="numResearchQueues"
                class="border border-gray-300 rounded px-2 py-1 text-sm w-24"
              >
                <option :value="1">1</option>
                <option :value="2">2</option>
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm text-gray-600">{{ labels.scienceBuildSpeed }}</label>
              <input
                type="number"
                v-model.number="scienceBuildSpeed"
                min="0"
                max="200"
                class="border border-gray-300 rounded px-2 py-1 text-sm w-24"
              />
            </div>
            <div class="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="officialPosition"
                v-model="hasPosition"
                class="w-4 h-4"
              />
              <label for="officialPosition" class="text-sm text-gray-700 cursor-pointer">
                {{ labels.officialPosition }}
              </label>
            </div>
          </div>

          <!-- Science Unlocks -->
          <div class="mt-4 pt-4 border-t border-gray-200">
            <h4 class="text-sm font-medium text-gray-600 mb-2">{{ labels.scienceUnlocks }}</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div v-for="[key, label] in [
                ['extra_farmland', labels.extraFarmland],
                ['extra_iron_mine', labels.extraIronMine],
                ['extra_gold_mine', labels.extraGoldMine],
                ['unlock_oil_well', labels.unlockOilWell],
                ['extra_oil_well', labels.extraOilWell],
              ]" :key="key" class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :id="`science_${key}`"
                  v-model="scienceUnlocks[key]"
                  :disabled="key === 'extra_oil_well' && !scienceUnlocks.unlock_oil_well"
                  class="w-4 h-4"
                />
                <label
                  :for="`science_${key}`"
                  class="text-sm cursor-pointer"
                  :class="key === 'extra_oil_well' && !scienceUnlocks.unlock_oil_well ? 'text-gray-400' : 'text-gray-700'"
                >
                  {{ label }}
                </label>
              </div>
            </div>
          </div>
        </div>

        <button
          @click="calculate"
          class="mt-2 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
        >
          {{ labels.calculateBtn }}
        </button>
      </div>
    </section>

    <!-- Results -->
    <section v-if="calculated" class="mt-8">
      <h2 class="text-xl font-semibold mb-4">{{ labels.results }}</h2>

      <div v-if="steps.length === 0" class="text-gray-500">{{ labels.noResults }}</div>
      <div v-else>
        <!-- Summary -->
        <div class="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 class="font-semibold mb-2">{{ labels.resourceOptimized }}</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            <!-- Time display: dual column if position active -->
            <div v-if="hasPosition" class="col-span-2 sm:col-span-3 grid grid-cols-2 gap-2">
              <div>
                <span class="text-gray-600">{{ labels.withPosition }}: </span>
                <span class="font-medium text-green-700">{{ formatTime(totalTimeWithPosition) }}</span>
              </div>
              <div>
                <span class="text-gray-600">{{ labels.withoutPosition }}: </span>
                <span class="font-medium text-gray-700">{{ formatTime(totalTimeWithoutPosition) }}</span>
              </div>
            </div>
            <div v-else>
              <span class="text-gray-600">{{ labels.totalTime }}: </span>
              <span class="font-medium">{{ formatTime(totalTime) }}</span>
            </div>
            <div>
              <span class="text-gray-600">{{ labels.electricity }}: </span>
              <span class="font-medium">{{ totalResources.electricity.toLocaleString() }}</span>
            </div>
            <div>
              <span class="text-gray-600">{{ labels.water }}: </span>
              <span class="font-medium">{{ totalResources.water.toLocaleString() }}</span>
            </div>
            <div>
              <span class="text-gray-600">{{ labels.oil }}: </span>
              <span class="font-medium">{{ totalResources.oil.toLocaleString() }}</span>
            </div>
            <div>
              <span class="text-gray-600">{{ labels.iron }}: </span>
              <span class="font-medium">{{ totalResources.iron.toLocaleString() }}</span>
            </div>
            <div v-if="gemCost > 0" class="col-span-2 sm:col-span-3">
              <span class="text-gray-600">{{ labels.queueRentalCost }}: </span>
              <span class="font-medium text-yellow-600">~{{ gemCost }} 💎</span>
            </div>
          </div>
        </div>

        <!-- Queue Tabs -->
        <div class="flex flex-wrap gap-2 mb-3">
          <button
            @click="activeQueue = null"
            :class="[
              'px-3 py-1 rounded text-sm font-medium border',
              activeQueue === null
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            ]"
          >
            {{ labels.allQueues }}
          </button>
          <button
            v-for="q in displayQueues"
            :key="q"
            @click="activeQueue = q"
            :class="[
              'px-3 py-1 rounded text-sm font-medium border',
              activeQueue === q
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            ]"
          >
            {{ labels.queue }}{{ q }}
          </button>
        </div>

        <!-- Step List -->
        <h3 class="font-semibold mb-2">{{ labels.timeOptimized }}</h3>
        <ol class="space-y-1">
          <li
            v-for="(step, index) in filteredSteps"
            :key="index"
            class="text-sm p-2 border-b border-gray-100 flex flex-wrap gap-x-3 gap-y-1"
          >
            <span class="font-medium text-gray-700">{{ labels.step }} {{ step._originalIndex + 1 }}:</span>
            <span>{{ displayName(step.building) }}</span>
            <span class="text-gray-500">→</span>
            <span>{{ labels.upgradeTo }} {{ step.toLevel }}</span>
            <span class="text-gray-400">|</span>
            <span class="text-purple-600 font-medium">{{ labels.queue }}{{ step.queue }}</span>
            <span class="text-gray-400">|</span>
            <span class="text-gray-500 text-xs">{{ labels.starts }}: {{ formatTime(step.startTime) }}</span>
            <span class="text-gray-400">|</span>
            <span class="text-blue-600">{{ formatTime(step.endTime - step.startTime) }}</span>
            <span class="text-gray-400">|</span>
            <span class="text-gray-600 text-xs">
              E:{{ step.costs.electricity.toLocaleString() }}
              W:{{ step.costs.water.toLocaleString() }}
              O:{{ step.costs.oil.toLocaleString() }}
              I:{{ step.costs.iron.toLocaleString() }}
            </span>
          </li>
        </ol>

        <!-- Dependency Tree -->
        <details class="mt-6 border border-gray-200 rounded">
          <summary class="cursor-pointer px-4 py-2 bg-gray-50 font-medium select-none">
            {{ labels.dependencyTree }}
          </summary>
          <div class="px-4 py-3">
            <TreeNode
              v-if="dependencyTree"
              :node="dependencyTree"
              :display-name="displayName"
              :already-met-label="labels.alreadyMet"
            />
          </div>
        </details>
      </div>
    </section>

    <div v-else-if="dataLoaded" class="mt-8 text-gray-400 italic text-sm">
      {{ labels.noResults }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, defineComponent, h } from 'vue';

const props = defineProps({
  lang: { type: String, default: 'en' },
});

const TARGET_BUILDING = 'Headquarters';
const TARGET_LEVEL = 35;
const POSITION_SPEED_BONUS = 20;
const DATA_URL = '/lastwar-tools/building-data.json';

// Recursive tree node component (depth-limited to avoid exponential rendering)
const MAX_TREE_DEPTH = 4;
const TreeNode = defineComponent({
  name: 'TreeNode',
  props: {
    node: { type: Object, required: true },
    displayName: { type: Function, required: true },
    alreadyMetLabel: { type: String, default: 'already met' },
    depth: { type: Number, default: 0 },
  },
  setup(props) {
    return () => {
      const { node, displayName, alreadyMetLabel, depth } = props;
      const label = h('div', {
        class: node.met ? 'text-gray-400' : 'text-gray-800',
      }, [
        `${displayName(node.building)} → Lv ${node.level}`,
        node.met
          ? h('span', { class: 'text-xs text-green-500 ml-1' }, `(✓ ${alreadyMetLabel})`)
          : null,
      ]);

      let children = null;
      if (node.children && node.children.length) {
        if (depth >= MAX_TREE_DEPTH) {
          children = h('div', { class: 'ml-4 text-xs text-gray-400' }, '...');
        } else {
          children = h('div', { class: 'ml-4 border-l border-gray-200 pl-2' },
            node.children.map(child =>
              h(TreeNode, {
                node: child,
                displayName,
                alreadyMetLabel,
                depth: depth + 1,
              })
            )
          );
        }
      }

      return h('div', { class: 'tree-node ml-4' }, [label, children]);
    };
  },
});

const BUILDING_GROUPS = {
  core: ['Headquarters', '1st Tech Center', '2nd Tech Center'],
  military: ['Barracks', 'Drill Ground', '1st Squad', 'Recon Plane', 'Tank Center', 'Missile Center', 'Aircraft Center'],
  defense: ['Wall'],
  economy: ['Farmland', 'Iron Mine', 'Gold Mine', 'Oil Well'],
  support: ['Hospital', 'Alliance Support Hub', "Builder's Hut"],
};

// Max possible slots for initialization (HQ-gated + science bonus)
const MAX_SLOTS = {
  'Farmland': 5,
  'Iron Mine': 2,
  'Gold Mine': 2,
  'Oil Well': 5,
};

const groupNames = {
  en: { core: 'Core', military: 'Military', defense: 'Defense', economy: 'Economy', support: 'Support' },
  zh: { core: '核心', military: '軍事', defense: '防禦', economy: '經濟', support: '支援' },
};

// Use correct VIP build speed table from game data (loaded from building-calc.js at runtime)
const VIP_BUILD_SPEED = (typeof window !== 'undefined' && window.BuildingCalc)
  ? window.BuildingCalc.VIP_BUILD_SPEED_TABLE
  : { 0: 0, 1: 0, 2: 0, 3: 10, 4: 10, 5: 20, 6: 20, 7: 30, 8: 30, 9: 40, 10: 40, 11: 50, 12: 50, 13: 50, 14: 50, 15: 50 };

const labelMap = {
  en: {
    currentBuildings: 'Your Current Buildings',
    calculateBtn: 'Calculate Optimal Path',
    results: 'Results',
    timeOptimized: 'Time-Optimized',
    resourceOptimized: 'Resource Summary',
    totalTime: 'Total Build Time',
    totalResources: 'Total Resources',
    step: 'Step',
    upgradeTo: 'Upgrade to Level',
    noResults: 'Enter your current building levels and click Calculate.',
    days: 'd',
    hours: 'h',
    minutes: 'm',
    electricity: 'Electricity',
    water: 'Water',
    oil: 'Oil',
    iron: 'Iron',
    settings: 'Settings',
    buildQueues: 'Build Queues',
    vipLevel: 'VIP Level',
    vipPoints: 'Current VIP Points',
    officialPosition: 'Has Official Position Bonus',
    withPosition: 'With Position',
    withoutPosition: 'Without Position',
    queue: 'Q',
    allQueues: 'All Queues',
    starts: 'starts',
    dependencyTree: 'Dependency Tree',
    alreadyMet: 'already met',
    queueRentalCost: 'Est. 2nd Queue Gems',
    researchQueues: 'Research Queues',
    scienceBuildSpeed: 'Science Build Speed (%)',
    scienceUnlocks: 'Science Unlocks (Building Slots)',
    extraFarmland: 'Extra Farmland',
    extraIronMine: 'Extra Iron Mine',
    extraGoldMine: 'Extra Gold Mine',
    unlockOilWell: 'Unlock Oil Well',
    extraOilWell: 'Extra Oil Well',
  },
  zh: {
    currentBuildings: '您目前的建築等級',
    calculateBtn: '計算最佳路徑',
    results: '結果',
    timeOptimized: '時間最佳化',
    resourceOptimized: '資源統計',
    totalTime: '總建造時間',
    totalResources: '總資源消耗',
    step: '步驟',
    upgradeTo: '升至等級',
    noResults: '輸入您目前的建築等級後點擊計算。',
    days: '天',
    hours: '時',
    minutes: '分',
    electricity: '電力',
    water: '水',
    oil: '油',
    iron: '鐵',
    settings: '設置',
    buildQueues: '建造佇列',
    vipLevel: 'VIP 等級',
    vipPoints: '目前VIP點數',
    officialPosition: '有官職加成',
    withPosition: '有官職',
    withoutPosition: '無官職',
    queue: 'Q',
    allQueues: '全部佇列',
    starts: '開始',
    dependencyTree: '依賴樹',
    alreadyMet: '已滿足',
    queueRentalCost: '2隊租用寶石',
    researchQueues: '研究佇列',
    scienceBuildSpeed: '科技建造速度（%）',
    scienceUnlocks: '科技解鎖（建築欄位）',
    extraFarmland: '額外農田',
    extraIronMine: '額外鐵礦場',
    extraGoldMine: '額外金礦',
    unlockOilWell: '解鎖油井',
    extraOilWell: '額外油井',
  },
};

const labels = computed(() => labelMap[props.lang] || labelMap.en);

const buildingData = ref(null);
const dataLoaded = ref(false);
const levelOptionsCache = {};
const currentLevels = reactive({});
const steps = ref([]);
const totalTime = ref(0);
const totalTimeWithPosition = ref(0);
const totalTimeWithoutPosition = ref(0);
const totalResources = ref({ electricity: 0, water: 0, oil: 0, iron: 0 });
const calculated = ref(false);
const dependencyTree = ref(null);
const gemCost = ref(0);
const simulatedQueues = ref(2);

// Settings
const numQueues = ref(2);
const numResearchQueues = ref(1);
const vipLevel = ref(0);
const vipPoints = ref(0);
const hasPosition = ref(false);
const scienceBuildSpeed = ref(0);
const activeQueue = ref(null);

// Science-based building slot unlocks
const scienceUnlocks = reactive({
  extra_farmland: false,
  extra_iron_mine: false,
  extra_gold_mine: false,
  unlock_oil_well: false,
  extra_oil_well: false,
});

const vipSpeed = computed(() => VIP_BUILD_SPEED[vipLevel.value] || 0);

// When numQueues=1, we simulate with 2 queues — show both queue tabs
const displayQueues = computed(() => simulatedQueues.value);

const filteredSteps = computed(() => {
  if (activeQueue.value === null) return steps.value;
  return steps.value.filter(s => s.queue === activeQueue.value);
});

// Collapse multi-instance buildings to their max level for resolveUpgrades
const currentLevelsForCalc = computed(() => {
  const result = { ...currentLevels };
  for (const building of Object.keys(MAX_SLOTS)) {
    const maxLevel = Math.max(
      0,
      ...Object.keys(currentLevels)
        .filter(k => k.startsWith(building + '_'))
        .map(k => currentLevels[k] || 0)
    );
    result[building] = maxLevel;
  }
  return result;
});

function getMultiInstanceSlots(building) {
  if (!window.BuildingCalc) return MAX_SLOTS[building] ? 1 : 0;
  const hqLevel = currentLevels['Headquarters'] || 0;
  return window.BuildingCalc.getUnlockedSlots(building, hqLevel, scienceUnlocks);
}

onMounted(async () => {
  try {
    const resp = await fetch(DATA_URL);
    buildingData.value = await resp.json();
    // Initialize all buildings to 0
    for (const group of Object.values(BUILDING_GROUPS)) {
      for (const b of group) {
        currentLevels[b] = 0;
        // Initialize multi-instance slots up to max possible
        const maxSlots = MAX_SLOTS[b];
        if (maxSlots) {
          for (let i = 1; i <= maxSlots; i++) {
            currentLevels[`${b}_${i}`] = 0;
          }
        }
      }
    }
    dataLoaded.value = true;
    for (const [name, bdata] of Object.entries(buildingData.value.buildings)) {
      const maxLevel = Math.max(...Object.keys(bdata.levels).map(Number));
      levelOptionsCache[name] = Array.from({ length: maxLevel + 1 }, (_, i) => i);
    }
  } catch (e) {
    console.error('Failed to load building data', e);
  }
});

function levelOptions(building) {
  return levelOptionsCache[building] || [0];
}

function displayName(building) {
  if (props.lang === 'zh') {
    const nameZh = buildingData.value?.buildings?.[building]?.nameZh;
    if (nameZh) return nameZh;
  }
  return building;
}

function groupName(key) {
  return (groupNames[props.lang] || groupNames.en)[key] || key;
}

function formatTime(seconds) {
  const lbl = labels.value;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  let result = '';
  if (d > 0) result += `${d}${lbl.days} `;
  if (h > 0 || d > 0) result += `${h}${lbl.hours} `;
  result += `${m}${lbl.minutes}`;
  return result.trim();
}

function calculate() {
  if (!window.BuildingCalc || !buildingData.value) return;

  const levelsForCalc = currentLevelsForCalc.value;

  const resolved = window.BuildingCalc.resolveUpgrades(
    buildingData.value,
    TARGET_BUILDING,
    TARGET_LEVEL,
    levelsForCalc
  );

  const summary = window.BuildingCalc.sumResources(resolved);

  // Use VIP progression simulation for the main schedule
  const vipState = {
    startingVipPoints: vipPoints.value,
    startingVipLevel: vipLevel.value,
    hasPosition: hasPosition.value,
    scienceBuildSpeedPct: scienceBuildSpeed.value,
  };
  const simQueues = Math.max(numQueues.value, 2);
  const vipResult = window.BuildingCalc.scheduleWithVipProgression(resolved, simQueues, vipState);
  const scheduled = vipResult.scheduled;

  // Gem cost for 2nd queue when numQueues=1
  let cost = 0;
  if (numQueues.value === 1) {
    const GEM_RENTAL_BLOCK_SECONDS = 7200;
    const GEM_COST_PER_BLOCK = 200;
    const queue1Tasks = scheduled.filter(s => s.queue === 1);
    if (queue1Tasks.length > 0) {
      const maxQueue1Time = Math.max(...queue1Tasks.map(s => s.endTime));
      const rentalBlocks = Math.ceil(maxQueue1Time / GEM_RENTAL_BLOCK_SECONDS);
      cost = rentalBlocks * GEM_COST_PER_BLOCK;
    }
  }
  gemCost.value = cost;
  simulatedQueues.value = simQueues;
  const totalT = window.BuildingCalc.getTotalTime(scheduled);

  // For dual-column display when position is active
  if (hasPosition.value) {
    const vipWithPos = window.BuildingCalc.scheduleWithVipProgression(resolved, simQueues, { ...vipState, hasPosition: true });
    const vipWithoutPos = window.BuildingCalc.scheduleWithVipProgression(resolved, simQueues, { ...vipState, hasPosition: false });
    totalTimeWithPosition.value = window.BuildingCalc.getTotalTime(vipWithPos.scheduled);
    totalTimeWithoutPosition.value = window.BuildingCalc.getTotalTime(vipWithoutPos.scheduled);
  }

  // Annotate steps with original index for display
  const annotated = scheduled.map((s, i) => ({ ...s, _originalIndex: i }));

  steps.value = annotated;
  totalTime.value = totalT;
  totalResources.value = {
    electricity: summary.electricity,
    water: summary.water,
    oil: summary.oil,
    iron: summary.iron,
  };
  calculated.value = true;
  // Reset queue filter when recalculating
  activeQueue.value = null;

  // Build dependency tree
  dependencyTree.value = window.BuildingCalc.buildDependencyTree(
    buildingData.value,
    TARGET_BUILDING,
    TARGET_LEVEL,
    levelsForCalc
  );
}
</script>
