/**
 * Tool Registry
 *
 * To add a new tool:
 * 1. Create src/pages/tools/[your-tool-slug].astro (EN)
 * 2. Create src/pages/zh/tools/[your-tool-slug].astro (ZH)
 * 3. Add an entry to the `tools` array below
 */

export interface ToolMeta {
  id: string;           // URL slug, e.g. "damage-calc"
  titleKey: string;     // i18n key, e.g. "tools.damageCalc.title"
  descKey: string;      // i18n key, e.g. "tools.damageCalc.desc"
  status: 'available' | 'coming-soon';
}

export const tools: ToolMeta[] = [
  {
    id: 'building-calc',
    titleKey: 'tools.buildingCalc.title',
    descKey: 'tools.buildingCalc.desc',
    status: 'available',
  },
];
