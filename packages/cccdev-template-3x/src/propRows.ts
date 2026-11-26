import type { FieldSpec } from './propLabels';
import {
  getFieldSpec,
  getGroups,
  getOnlyKeys,
  isForcedField,
  listClassFieldKeys,
  propLabel,
} from './propLabels';

export type PropRow =
  | { kind: 'group'; label: string; keys: string[]; cells?: string[] }
  | { kind: 'field'; key: string; label: string; spec?: FieldSpec };

export function hasModelKey(model: any, key: string): boolean {
  if (!model) return false;
  try {
    if (key in model) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function editTarget(model: any, component: any, key: string): any {
  if (hasModelKey(model, key)) return model;
  return component ?? model;
}

export function rawValue(model: any, component: any, key: string): any {
  if (component != null) {
    try {
      const v = component[key];
      if (v !== undefined) return v;
    } catch {
      /* ignore */
    }
  }
  try {
    return model?.[key];
  } catch {
    return undefined;
  }
}

function canShowKey(model: any, component: any, key: string, spec?: FieldSpec): boolean {
  if (isForcedField(spec)) return component != null || hasModelKey(model, key);
  return hasModelKey(model, key) || (component != null && component[key] !== undefined);
}

export function buildPropRows(className: string, model: any, component?: any): PropRow[] {
  const rows: PropRow[] = [];
  const onlyKeys = getOnlyKeys(className);
  const onlySet = onlyKeys ? new Set(onlyKeys) : null;
  const modelKeys: string[] = Array.isArray(model?.props) ? model.props.map((p: { key: string }) => p.key) : [];
  const groups = getGroups(className).map((g) => ({
    ...g,
    keys: g.keys.filter((key) => {
      if (onlySet && !onlySet.has(key)) return false;
      return canShowKey(model, component, key, getFieldSpec(className, key));
    }),
  })).filter((g) => g.keys.length > 0);

  const keyToGroup = new Map<string, (typeof groups)[number]>();
  for (const g of groups) {
    for (const k of g.keys) {
      if (!keyToGroup.has(k)) keyToGroup.set(k, g);
    }
  }

  const walkKeys = onlyKeys
    ? onlyKeys.filter((k) => modelKeys.includes(k) || canShowKey(model, component, k, getFieldSpec(className, k)))
    : [...groups.flatMap((g) => g.keys), ...modelKeys.filter((k) => !keyToGroup.has(k))];

  const emitted = new Set<string>();
  const emittedGroups = new Set<(typeof groups)[number]>();

  for (const key of walkKeys) {
    if (emitted.has(key)) continue;
    const g = keyToGroup.get(key);
    if (g) {
      if (emittedGroups.has(g)) continue;
      emittedGroups.add(g);
      g.keys.forEach((k) => emitted.add(k));
      rows.push({ kind: 'group', label: g.label, keys: g.keys, cells: g.cells });
      continue;
    }
    emitted.add(key);
    const spec = getFieldSpec(className, key);
    const fallback = model?.props?.find((p: { key: string; name?: string }) => p.key === key)?.name;
    rows.push({
      kind: 'field',
      key,
      label: propLabel(className, key, fallback, component),
      spec,
    });
  }

  if (!onlySet) {
    for (const g of groups) {
      if (emittedGroups.has(g)) continue;
      g.keys.forEach((k) => emitted.add(k));
      rows.push({ kind: 'group', label: g.label, keys: g.keys, cells: g.cells });
    }
    for (const key of listClassFieldKeys(className)) {
      if (emitted.has(key) || modelKeys.includes(key)) continue;
      const spec = getFieldSpec(className, key);
      if (!isForcedField(spec)) continue;
      if (!canShowKey(model, component, key, spec)) continue;
      rows.push({
        kind: 'field',
        key,
        label: propLabel(className, key, spec?.label, component),
        spec,
      });
    }
  }

  return rows;
}

export function shortAxisLabel(key: string): string {
  const m = key.match(/([A-Z][a-z]*|[a-z]+)$/);
  const s = m?.[1] ?? key;
  return s.length <= 3 ? s.toLowerCase() : s.slice(0, 1).toLowerCase();
}
