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
