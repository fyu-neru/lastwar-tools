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

  window.BuildingCalc = { resolveUpgrades, sumResources };
})();
