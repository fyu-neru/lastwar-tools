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
            <div
              v-for="building in groupBuildings"
              :key="building"
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
          </div>
        </details>

        <button
          @click="calculate"
          class="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
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
            <div>
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
          </div>
        </div>

        <!-- Step List -->
        <h3 class="font-semibold mb-2">{{ labels.timeOptimized }}</h3>
        <ol class="space-y-1">
          <li
            v-for="(step, index) in steps"
            :key="index"
            class="text-sm p-2 border-b border-gray-100 flex flex-wrap gap-x-3 gap-y-1"
          >
            <span class="font-medium text-gray-700">{{ labels.step }} {{ index + 1 }}:</span>
            <span>{{ displayName(step.building) }}</span>
            <span class="text-gray-500">→</span>
            <span>{{ labels.upgradeTo }} {{ step.level }}</span>
            <span class="text-gray-400">|</span>
            <span class="text-blue-600">{{ formatTime(step.buildTime) }}</span>
            <span class="text-gray-400">|</span>
            <span class="text-gray-600 text-xs">
              E:{{ step.costs.electricity.toLocaleString() }}
              W:{{ step.costs.water.toLocaleString() }}
              O:{{ step.costs.oil.toLocaleString() }}
              I:{{ step.costs.iron.toLocaleString() }}
            </span>
          </li>
        </ol>
      </div>
    </section>

    <div v-else-if="dataLoaded" class="mt-8 text-gray-400 italic text-sm">
      {{ labels.noResults }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';

const props = defineProps({
  lang: { type: String, default: 'en' },
});

const BUILDING_GROUPS = {
  core: ['Headquarters', '1st Tech Center', '2nd Tech Center'],
  military: ['Barracks', 'Drill Ground', '1st Squad', 'Recon Plane', 'Tank Center', 'Missile Center', 'Aircraft Center'],
  defense: ['Wall'],
  economy: ['Farmland', 'Iron Mine', 'Gold Mine'],
  support: ['Hospital', 'Alliance Support Hub', "Builder's Hut"],
};

const groupNames = {
  en: { core: 'Core', military: 'Military', defense: 'Defense', economy: 'Economy', support: 'Support' },
  zh: { core: '核心', military: '軍事', defense: '防禦', economy: '經濟', support: '支援' },
};

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
  },
};

const labels = computed(() => labelMap[props.lang] || labelMap.en);

const buildingData = ref(null);
const dataLoaded = ref(false);
const currentLevels = reactive({});
const steps = ref([]);
const totalTime = ref(0);
const totalResources = ref({ electricity: 0, water: 0, oil: 0, iron: 0 });
const calculated = ref(false);

onMounted(async () => {
  try {
    const resp = await fetch('/lastwar-tools/building-data.json');
    buildingData.value = await resp.json();
    // Initialize all buildings to 0
    for (const group of Object.values(BUILDING_GROUPS)) {
      for (const b of group) {
        currentLevels[b] = 0;
      }
    }
    dataLoaded.value = true;
  } catch (e) {
    console.error('Failed to load building data', e);
  }
});

function levelOptions(building) {
  const data = buildingData.value?.buildings?.[building];
  if (!data) return [0];
  const maxLevel = Math.max(...Object.keys(data.levels).map(Number));
  const opts = [];
  for (let i = 0; i <= maxLevel; i++) opts.push(i);
  return opts;
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

  const resolved = window.BuildingCalc.resolveUpgrades(
    buildingData.value,
    'Headquarters',
    35,
    { ...currentLevels }
  );

  const summary = window.BuildingCalc.sumResources(resolved);

  steps.value = resolved;
  totalTime.value = summary.totalTime;
  totalResources.value = summary.totalCosts;
  calculated.value = true;
}
</script>
