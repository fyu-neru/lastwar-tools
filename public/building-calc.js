/**
 * Building upgrade path calculator (DAG dependency resolver + resource summation).
 * Attached to window.BuildingCalc for use in browser via <script> tag.
 */

(function () {
  const GEM_RENTAL_BLOCK_SECONDS = 7200; // 2-hour rental block
  const GEM_COST_PER_BLOCK = 200;        // gems per rental

  /**
   * Resolve all required upgrades to reach targetBuilding at targetLevel,
   * given the player's current building levels.
   *
   * @param {Object} buildingData - the parsed building-data.json content
   * @param {string} targetBuilding - e.g., "Headquarters"
   * @param {number} targetLevel - e.g., 35
   * @param {Object} currentLevels - map of building name → current level (default 0 if missing)
   * @returns {Array<{building: string, fromLevel: number, toLevel: number, buildTime: number, costs: Object}>}
   */
  function resolveUpgrades(buildingData, targetBuilding, targetLevel, currentLevels) {
    const result = [];
    // Track which individual level upgrades are already added: key = "building:toLevel"
    const added = new Set();
    // Track currently-in-progress resolutions to detect cycles
    const visiting = new Set();

    function resolve(building, toLevel) {
      const currentLevel = (currentLevels && currentLevels[building] != null)
        ? currentLevels[building]
        : 0;

      // Already at or past this level — nothing to do
      if (currentLevel >= toLevel) return;

      const buildingDef = buildingData.buildings[building];
      if (!buildingDef) {
        throw new Error(`Unknown building: "${building}"`);
      }

      // Upgrade each level from (currentLevel+1) up to toLevel
      for (let lvl = currentLevel + 1; lvl <= toLevel; lvl++) {
        const lvlKey = `${building}:${lvl}`;

        // Already scheduled this upgrade
        if (added.has(lvlKey)) continue;

        // Cycle guard: if we're already in the middle of resolving this exact level, skip
        if (visiting.has(lvlKey)) continue;

        const levelDef = buildingDef.levels[String(lvl)];
        if (!levelDef) {
          throw new Error(`No data for ${building} level ${lvl}`);
        }

        visiting.add(lvlKey);

        // Resolve prerequisites for this level first
        const prereqs = levelDef.prerequisites || [];
        for (const prereq of prereqs) {
          resolve(prereq.building, prereq.level);
        }

        visiting.delete(lvlKey);

        // Now add this upgrade step (if not already added by a recursive call)
        if (!added.has(lvlKey)) {
          added.add(lvlKey);
          result.push({
            building,
            fromLevel: lvl - 1,
            toLevel: lvl,
            buildTime: levelDef.buildTime || 0,
            costs: levelDef.costs || {},
          });
        }
      }
    }

    resolve(targetBuilding, targetLevel);
    return result;
  }

  /**
   * Sum all resource costs from an upgrade list.
   * @param {Array} upgrades - from resolveUpgrades()
   * @returns {{ electricity: number, water: number, oil: number, iron: number, totalTime: number }}
   */
  function sumResources(upgrades) {
    const totals = { electricity: 0, water: 0, oil: 0, iron: 0, totalTime: 0 };
    for (const upgrade of upgrades) {
      totals.totalTime += upgrade.buildTime || 0;
      const costs = upgrade.costs || {};
      for (const resource of ['electricity', 'water', 'oil', 'iron']) {
        totals[resource] += costs[resource] || 0;
      }
    }
    return totals;
  }

  /**
   * Schedule upgrades across multiple build queues.
   * Uses greedy approach: assign each upgrade to the queue that finishes earliest.
   *
   * @param {Array} upgrades - from resolveUpgrades(), in topological order
   * @param {number} numQueues - number of build queues (1-4)
   * @param {number} speedBonusPct - build speed bonus % (0 = no bonus, 50 = 50% faster)
   * @returns {Array<{
   *   step: number,
   *   building: string,
   *   fromLevel: number,
   *   toLevel: number,
   *   queue: number,
   *   startTime: number,
   *   endTime: number,
   *   buildTime: number,
   *   costs: Object,
   * }>}
   */
  function scheduleUpgrades(upgrades, numQueues, speedBonusPct = 0) {
    const queueFreeAt = new Array(numQueues).fill(0);
    const scheduled = [];
    const speedDivisor = 1 + speedBonusPct / 100;

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

      const actualBuildTime = Math.round(upgrade.buildTime / speedDivisor);

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
  }

  /**
   * Get total time for a set of scheduled upgrades.
   * @param {Array} scheduledUpgrades - from scheduleUpgrades()
   * @returns {number} total time in seconds (endTime of last task)
   */
  function getTotalTime(scheduledUpgrades) {
    if (scheduledUpgrades.length === 0) return 0;
    return scheduledUpgrades[scheduledUpgrades.length - 1].endTime;
  }

  /**
   * Build a nested dependency tree for display.
   * @param {Object} buildingData
   * @param {string} targetBuilding - e.g., "Headquarters"
   * @param {number} targetLevel - e.g., 35
   * @param {Object} currentLevels - player's current levels
   * @returns {Object} Tree node: { building, level, met: boolean, children: [...] }
   *   met = true if player already meets this requirement
   */
  function buildDependencyTree(buildingData, targetBuilding, targetLevel, currentLevels) {
    // Cache: "building:level" -> node (avoids exponential blowup in DAG)
    const cache = new Map();

    function buildNode(building, level) {
      const cacheKey = `${building}:${level}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);

      const currentLevel = (currentLevels && currentLevels[building] != null)
        ? currentLevels[building]
        : 0;
      const met = currentLevel >= level;

      // Insert a placeholder to break cycles
      const node = { building, level, met, children: [] };
      cache.set(cacheKey, node);

      const buildingDef = buildingData.buildings[building];
      if (buildingDef) {
        // Collect unique prerequisites across all levels up to target
        const prereqMap = new Map(); // building -> highest required level
        for (let lvl = 1; lvl <= level; lvl++) {
          const levelDef = buildingDef.levels[String(lvl)];
          if (!levelDef) continue;
          const prereqs = levelDef.prerequisites || [];
          for (const prereq of prereqs) {
            const existing = prereqMap.get(prereq.building);
            if (!existing || prereq.level > existing.level) {
              prereqMap.set(prereq.building, prereq);
            }
          }
        }

        for (const prereq of prereqMap.values()) {
          node.children.push(buildNode(prereq.building, prereq.level));
        }
      }

      return node;
    }

    return buildNode(targetBuilding, targetLevel);
  }

  const MULTI_INSTANCE_UNLOCKS = {
    'Farmland': [
      { slots: 1, hqLevel: 1 },
      { slots: 2, hqLevel: 2 },
      { slots: 3, hqLevel: 8 },
      { slots: 4, hqLevel: 12 },
    ],
    'Iron Mine': [
      { slots: 1, hqLevel: 1 },
      { slots: 2, hqLevel: 4 },
    ],
    'Gold Mine': [
      { slots: 1, hqLevel: 2 },
    ],
  };

  /**
   * Get the number of building slots unlocked for a given HQ level.
   * @param {string} building - building name
   * @param {number} hqLevel - current HQ level
   * @returns {number} number of slots (1 for single-instance buildings)
   */
  function getUnlockedSlots(building, hqLevel) {
    const unlocks = MULTI_INSTANCE_UNLOCKS[building];
    if (!unlocks) return 1;
    let slots = 0;
    for (const unlock of unlocks) {
      if (hqLevel >= unlock.hqLevel) slots = unlock.slots;
    }
    return slots;
  }

  /**
   * Schedule upgrades, with gem cost calculation when user selects 1 queue.
   * Per game mechanics: 2nd queue costs 200 gems per 2-hour rental block.
   * When numQueues=1, simulates with 2 queues to show time saved + gem cost.
   *
   * @param {Array} upgrades - from resolveUpgrades()
   * @param {number} numQueues - user-selected queue count (1-4)
   * @param {number} speedBonusPct - build speed bonus %
   * @returns {{ scheduled: Array, simulatedQueues: number, gemCost: number }}
   */
  function scheduleWithGemCost(upgrades, numQueues, speedBonusPct) {
    const simulatedQueues = Math.max(numQueues, 2);
    const scheduled = scheduleUpgrades(upgrades, simulatedQueues, speedBonusPct);

    let gemCost = 0;
    if (numQueues === 1) {
      const queue1Tasks = scheduled.filter(s => s.queue === 1);
      if (queue1Tasks.length > 0) {
        const maxQueue1Time = Math.max(...queue1Tasks.map(s => s.endTime));
        const rentalBlocks = Math.ceil(maxQueue1Time / GEM_RENTAL_BLOCK_SECONDS);
        gemCost = rentalBlocks * GEM_COST_PER_BLOCK;
      }
    }

    return { scheduled, simulatedQueues, gemCost };
  }

  // Correct VIP build speed bonuses from game data (effect 50129, cumulative %)
  const VIP_BUILD_SPEED_TABLE = {
    0: 0, 1: 0, 2: 0, 3: 10, 4: 10,
    5: 20, 6: 20, 7: 30, 8: 30,
    9: 40, 10: 40, 11: 50, 12: 50,
    13: 50, 14: 50, 15: 50,
  };

  // Cumulative VIP points required to reach each VIP level (index = level - 1)
  const VIP_THRESHOLDS = [
    0, 500, 1000, 5000, 10000, 15000, 30000, 50000,
    100000, 150000, 250000, 500000, 1000000, 2000000, 3000000,
  ];

  /**
   * Get VIP level from cumulative points.
   * @param {number} points - total cumulative VIP points
   * @returns {number} VIP level (1-15)
   */
  function getVipLevel(points) {
    let level = 1;
    for (let i = 0; i < VIP_THRESHOLDS.length; i++) {
      if (points >= VIP_THRESHOLDS[i]) level = i + 1;
      else break;
    }
    return Math.min(level, 15);
  }

  /**
   * Schedule upgrades with VIP level-up simulation.
   * VIP exp = buildTime seconds. Speed bonus re-evaluated at each task's start.
   *
   * @param {Array} upgrades - from resolveUpgrades()
   * @param {number} numQueues - number of queues
   * @param {Object} vipState - { startingVipPoints, startingVipLevel, hasPosition }
   * @returns {{ scheduled: Array, finalVipPoints: number, finalVipLevel: number }}
   */
  function scheduleWithVipProgression(upgrades, numQueues, vipState) {
    const { startingVipPoints = 0, hasPosition = false } = vipState;
    const POSITION_BONUS = hasPosition ? 20 : 0;

    const queueFreeAt = new Array(numQueues).fill(0);
    let cumulativeVipPoints = startingVipPoints;
    const scheduled = [];

    for (let step = 0; step < upgrades.length; step++) {
      const upgrade = upgrades[step];

      // Find earliest available queue
      let earliestQueue = 0;
      for (let i = 1; i < numQueues; i++) {
        if (queueFreeAt[i] < queueFreeAt[earliestQueue]) earliestQueue = i;
      }

      // Apply speed bonus at THIS task's start (based on current VIP level)
      const currentVipLevel = getVipLevel(cumulativeVipPoints);
      const speedBonus = (VIP_BUILD_SPEED_TABLE[currentVipLevel] || 0) + POSITION_BONUS;
      const speedDivisor = 1 + speedBonus / 100;
      const actualBuildTime = Math.round(upgrade.buildTime / speedDivisor);

      const startTime = queueFreeAt[earliestQueue];
      const endTime = startTime + actualBuildTime;
      queueFreeAt[earliestQueue] = endTime;

      // Accumulate VIP exp from original (unmodified) buildTime
      cumulativeVipPoints += upgrade.buildTime;

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
        vipLevelAtStart: currentVipLevel,
        speedBonusPct: speedBonus,
      });
    }

    return {
      scheduled,
      finalVipPoints: cumulativeVipPoints,
      finalVipLevel: getVipLevel(cumulativeVipPoints),
    };
  }

  window.BuildingCalc = { resolveUpgrades, sumResources, scheduleUpgrades, getTotalTime, buildDependencyTree, scheduleWithGemCost, getUnlockedSlots, getVipLevel, scheduleWithVipProgression, VIP_BUILD_SPEED_TABLE };
})();
