import type { PropDef } from './NodeModel';
import { isInspectableValue } from '../propInspect';
import { prettifyPropKey } from '../propLabels';

export interface ComponentViewModel {
  props: PropDef[];
  /** 手寫 Model：不過濾屬性。通用反射為 true，只留可完整編輯的欄位 */
  inspectableOnly?: boolean;
  [key: string]: any;
}

const SKIP_KEYS = new Set([
  'uuid',
  'name',
  'enabled',
  'node',
  'info',
  'hideFlags',
  '__scriptAsset',
  '__editorExtras__',
]);

/** cc.UITransformComponent → cc.UITransform（相容 3.x 早期類名） */
export function normalizeClassName(name: string): string {
  return (name ?? '').replace(/Component$/, '');
}

export function getComponentViewModel(
  name: string,
  componentGetter: () => any,
): ComponentViewModel | null {
  const normalized = normalizeClassName(name);
  switch (normalized) {
    case 'cc.UITransform':
      return new CCUITransformModel(componentGetter);
    case 'cc.Label':
      return new CCLabelModel(componentGetter);
    case 'cc.Sprite':
      return new CCSpriteModel(componentGetter);
    default:
      return createGenericViewModel(componentGetter);
  }
}

function shouldSkipKey(key: string): boolean {
  if (!key) return true;
  if (key.includes('__')) return true;
  if (key.startsWith('_')) return true;
  // Widget 的 editorTop 等是編輯器預覽用，與 top/bottom/left/right 重複
  if (/^editor[A-Z]/.test(key)) return true;
  return SKIP_KEYS.has(key);
}

function collectPropKeys(comp: any): string[] {
  const keys: string[] = [];
  const add = (k: unknown) => {
    if (typeof k !== 'string' || shouldSkipKey(k) || keys.includes(k)) return;
    keys.push(k);
  };

  const ctor = comp?.constructor;
  if (Array.isArray(ctor?.__props__)) ctor.__props__.forEach(add);
  if (Array.isArray(ctor?.__values__)) ctor.__values__.forEach(add);

  const attrs = ctor?.__attrs__;
  if (attrs && typeof attrs === 'object') {
    for (const k of Object.keys(attrs)) {
      const base = k.split('$_$')[0];
      if (base) add(base);
    }
  }

  if (keys.length === 0) {
    for (const k of Object.keys(comp ?? {})) add(k);
  }

  return keys.filter((k) => {
    try {
      if (typeof comp[k] === 'function') return false;
      return isInspectableValue(comp[k]);
    } catch {
      return false;
    }
  });
}

function createGenericViewModel(componentGetter: () => any): ComponentViewModel | null {
  const comp = componentGetter();
  if (!comp) return null;

  const keys = collectPropKeys(comp);
  const model: ComponentViewModel = {
    inspectableOnly: true,
    props: keys.map((key) => ({ name: prettifyPropKey(key), key })),
  };

  for (const key of keys) {
    Object.defineProperty(model, key, {
      enumerable: true,
      get() {
        return componentGetter()?.[key];
      },
      set(v) {
        const target = componentGetter();
        if (target) target[key] = v;
      },
    });
  }

  return model;
}

class CCUITransformModel implements ComponentViewModel {
  props: PropDef[] = [
    { name: 'Width', key: 'width' },
    { name: 'Height', key: 'height' },
    { name: 'Anchor X', key: 'anchorX' },
    { name: 'Anchor Y', key: 'anchorY' },
  ];

  constructor(private getter: () => any) {}

  get width(): number {
    return this.getter()?.contentSize.width ?? 0;
  }
  set width(v: number) {
    const c = this.getter();
    if (!c) return;
    c.setContentSize(v, c.contentSize.height);
  }

  get height(): number {
    return this.getter()?.contentSize.height ?? 0;
  }
  set height(v: number) {
    const c = this.getter();
    if (!c) return;
    c.setContentSize(c.contentSize.width, v);
  }

  get anchorX(): number {
    return this.getter()?.anchorPoint.x ?? 0;
  }
  set anchorX(v: number) {
    const c = this.getter();
    if (!c) return;
    c.setAnchorPoint(v, c.anchorPoint.y);
  }

  get anchorY(): number {
    return this.getter()?.anchorPoint.y ?? 0;
  }
  set anchorY(v: number) {
    const c = this.getter();
    if (!c) return;
    c.setAnchorPoint(c.anchorPoint.x, v);
  }
}

class CCLabelModel implements ComponentViewModel {
  props: PropDef[] = [
    { name: 'String', key: 'string' },
    { name: 'Color', key: 'color' },
    { name: 'Font Size', key: 'fontSize' },
    { name: 'Line Height', key: 'lineHeight' },
  ];
  constructor(private getter: () => any) {}
  get string(): string {
    return this.getter()?.string ?? '';
  }
  set string(v: string) {
    const c = this.getter();
    if (c) c.string = v;
  }
  get color(): any {
    return this.getter()?.color;
  }
  set color(v: any) {
    const c = this.getter();
    if (c) c.color = v;
  }
  get fontSize(): number {
    return this.getter()?.fontSize ?? 0;
  }
  set fontSize(v: number) {
    const c = this.getter();
    if (c) c.fontSize = v;
  }
  get lineHeight(): number {
    return this.getter()?.lineHeight ?? 0;
  }
  set lineHeight(v: number) {
    const c = this.getter();
    if (c) c.lineHeight = v;
  }
}

class CCSpriteModel implements ComponentViewModel {
  props: PropDef[] = [{ name: 'Color', key: 'color' }];
  constructor(private getter: () => any) {}
  get color(): any {
    return this.getter()?.color;
  }
  set color(v: any) {
    const c = this.getter();
    if (c) c.color = v;
  }
}
