import { cc } from './engine';

/** 通用 Inspector 只展示能完整編輯的值；手寫 Model 不走這套過濾 */

const STRUCT_TYPES = new Set([
  'cc.Color',
  'cc.Vec2',
  'cc.Vec3',
  'cc.Vec4',
  'cc.Size',
  'cc.Rect',
]);

function normalizeClass(name: string): string {
  return String(name ?? '').replace(/Component$/, '');
}

export function isPrimitive(v: unknown): v is string | number | boolean {
  const t = typeof v;
  return t === 'string' || t === 'number' || t === 'boolean';
}

export function isPrimitiveArray(v: unknown): v is Array<string | number | boolean> {
  return Array.isArray(v) && v.every(isPrimitive);
}

export function inspectType(value: any): string {
  if (value === null || value === undefined) return 'unknown';
  if (isPrimitiveArray(value)) return 'array';
  if (Array.isArray(value)) return 'unknown';
  if (typeof value !== 'object') return typeof value;

  const cls = normalizeClass(value.__classname__);
  if (STRUCT_TYPES.has(cls)) return cls;
  if ('r' in value && 'g' in value && 'b' in value && typeof value.toHEX === 'function') {
    return 'cc.Color';
  }
  if (value.uuid || typeof value.addComponent === 'function' || typeof value.getComponent === 'function') {
    return 'unknown';
  }
  if ('width' in value && 'height' in value && !('x' in value) && typeof value.width === 'number') {
    return 'cc.Size';
  }
  if ('x' in value && 'y' in value && 'width' in value && 'height' in value && typeof value.x === 'number') {
    return 'cc.Rect';
  }
  if ('x' in value && 'y' in value && 'z' in value && 'w' in value && typeof value.x === 'number') {
    return 'cc.Vec4';
  }
  if ('x' in value && 'y' in value && 'z' in value && typeof value.x === 'number') return 'cc.Vec3';
  if ('x' in value && 'y' in value && typeof value.x === 'number') return 'cc.Vec2';
  return 'unknown';
}

export function isInspectableValue(value: any): boolean {
  const t = inspectType(value);
  return t === 'number' || t === 'string' || t === 'boolean' || t === 'array' || STRUCT_TYPES.has(t);
}

function attrOf(target: any, key: string, field: string): any {
  try {
    const attrs = target?.constructor?.__attrs__;
    if (!attrs || typeof attrs !== 'object') return undefined;
    return attrs[`${key}$_$${field}`] ?? attrs[key]?.[field];
  } catch {
    return undefined;
  }
}

type EnumOpt = { name: string; value: number | string };

function mapNamedList(list: any): EnumOpt[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item: any) => {
      if (item == null || typeof item !== 'object') return null;
      const name = String(item.name ?? item.label ?? '');
      if (!name) return null;
      return { name, value: item.value as number | string };
    })
    .filter((x): x is EnumOpt => !!x);
}

function optionsFromEnumObject(type: any): EnumOpt[] {
  if (!type || (typeof type !== 'object' && typeof type !== 'function')) return [];
  const EnumApi = cc()?.Enum;
  if (EnumApi && typeof EnumApi.getList === 'function') {
    try {
      const listed = mapNamedList(EnumApi.getList(type));
      if (listed.length >= 2) return listed;
    } catch {
      /* ignore */
    }
  }
  const opts: EnumOpt[] = [];
  for (const name of Object.keys(type)) {
    if (!name || name.startsWith('_') || /^\d+$/.test(name)) continue;
    if (name === 'isEnum' || name === 'default' || name === 'name') continue;
    const value = type[name];
    if (typeof value !== 'number') continue;
    opts.push({ name, value });
  }
  // 真正的 cc.Enum / BitMask 至少兩個常數；單一 name 多半是 CCFloat 等型別描述
  if (opts.length < 2) return [];
  return opts;
}

function optionsFromNodeLayer(): EnumOpt[] {
  const Layers = cc()?.Layers;
  if (!Layers) return [];
  const bits = optionsFromEnumObject(Layers.BitMask);
  return bits.length >= 2 ? bits : optionsFromEnumObject(Layers.Enum);
}

/** 從 CCClass __attrs__ 或 JSON spec 讀 enum / bitmask 選項 */
export function readEnumOptions(
  target: any,
  key: string,
  specEnum?: EnumOpt[],
): EnumOpt[] {
  if (Array.isArray(specEnum) && specEnum.length > 0) return specEnum;
  const fromEnumList = mapNamedList(attrOf(target, key, 'enumList'));
  if (fromEnumList.length > 1) return fromEnumList;
  const fromBits = mapNamedList(attrOf(target, key, 'bitmaskList'));
  if (fromBits.length > 1) return fromBits;
  const fromType = optionsFromEnumObject(attrOf(target, key, 'type'));
  if (fromType.length > 1) return fromType;
  if (key === 'layer') return optionsFromNodeLayer();
  return [];
}
