/**
 * Building upgrade path calculator (DAG dependency resolver + resource summation).
 * Attached to window.BuildingCalc for use in browser via <script> tag.
 */

(function () {
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
    // Initialize queue finish times
    const queueFreeAt = new Array(numQueues).fill(0);
    const scheduled = [];

    for (let step = 0; step < upgrades.length; step++) {
      const upgrade = upgrades[step];

      // Find the queue that will be free earliest
      let earliestQueue = 0;
      let earliestTime = queueFreeAt[0];
      for (let i = 1; i < numQueues; i++) {
        if (queueFreeAt[i] < earliestTime) {
          earliestTime = queueFreeAt[i];
          earliestQueue = i;
        }
      }

      // Calculate actual build time after speed bonus
      const actualBuildTime = Math.round(
        upgrade.buildTime / (1 + speedBonusPct / 100)
      );

      const startTime = queueFreeAt[earliestQueue];
      const endTime = startTime + actualBuildTime;

      // Update queue free time
      queueFreeAt[earliestQueue] = endTime;

      // Add to scheduled list
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
    const visiting = new Set();

    function buildNode(building, level) {
      const currentLevel = (currentLevels && currentLevels[building] != null)
        ? currentLevels[building]
        : 0;
      const met = currentLevel >= level;

      const children = [];
      const visitKey = `${building}:${level}`;

      if (visiting.has(visitKey)) {
        return { building, level, met, children };
      }
      visiting.add(visitKey);

      const buildingDef = buildingData.buildings[building];
      if (buildingDef) {
        // Collect unique prerequisites across all levels up to target
        const prereqMap = new Map(); // "building:level" -> {building, level}
        for (let lvl = 1; lvl <= level; lvl++) {
          const levelDef = buildingDef.levels[String(lvl)];
          if (!levelDef) continue;
          const prereqs = levelDef.prerequisites || [];
          for (const prereq of prereqs) {
            const key = `${prereq.building}:${prereq.level}`;
            if (!prereqMap.has(key)) {
              prereqMap.set(key, prereq);
            } else {
              // Keep the highest level requirement for same building
              if (prereq.level > prereqMap.get(key).level) {
                prereqMap.set(key, prereq);
              }
            }
          }
        }

        for (const prereq of prereqMap.values()) {
          children.push(buildNode(prereq.building, prereq.level));
        }
      }

      visiting.delete(visitKey);
      return { building, level, met, children };
    }

    return buildNode(targetBuilding, targetLevel);
  }

  window.BuildingCalc = { resolveUpgrades, sumResources, scheduleUpgrades, getTotalTime, buildDependencyTree };
})();
