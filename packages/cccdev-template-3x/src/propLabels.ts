/** 從 dist/assets/prop-labels.json 讀取；檔案不進 IIFE 壓縮 */

export interface EnumOption {
  name: string;
  value: number | string;
}

export interface FieldSpec {
  label: string;
  display?: string;
  print?: boolean;
  show?: boolean;
  /** JSON 覆寫；未填則從引擎 __attrs__ 辨識 */
  enum?: EnumOption[];
}

export interface GroupSpec {
  label: string;
  keys: string[];
  cells?: string[];
}

type ClassRow = Record<string, unknown>;
type LabelFile = Record<string, string | ClassRow | undefined>;

const CLASS_NAME_KEY = '$name';
const GROUPS_KEY = '$groups';
const KEYS_KEY = '$keys';
let tables: LabelFile = {};

function classCandidates(name: string): string[] {
  const raw = String(name ?? '');
  const noComp = raw.replace(/Component$/, '');
  const noCc = noComp.replace(/^cc\./, '');
  const out: string[] = [];
  const add = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };
  add(raw);
  add(noComp);
  add(`cc.${noCc}`);
  add(noCc);
  add('*');
  return out;
}

function classTable(name: string): ClassRow | undefined {
  for (const key of classCandidates(name)) {
    if (key === '*' || key.startsWith('_')) continue;
    const row = tables[key];
    if (row && typeof row === 'object') return row as ClassRow;
  }
  return undefined;
}

function starTable(): ClassRow | undefined {
  const row = tables['*'];
  return row && typeof row === 'object' ? (row as ClassRow) : undefined;
}

function engineDisplayName(target: any, key: string): string {
  try {
    const attrs = target?.constructor?.__attrs__;
    if (!attrs || typeof attrs !== 'object') return '';
    const delim = '$_$';
    const direct = attrs[key + delim + 'displayName'];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const nested = attrs[key];
    if (nested && typeof nested.displayName === 'string' && nested.displayName.trim()) {
      return nested.displayName.trim();
    }
  } catch {
    /* ignore */
  }
  return '';
}

export function prettifyPropKey(key: string): string {
  return key
    .replace(/^_/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (s) => s.toUpperCase());
}

export function parseFieldSpec(raw: unknown, fallbackLabel = ''): FieldSpec | undefined {
  if (typeof raw === 'string') {
    const label = raw.trim();
    if (!label) return undefined;
    return { label };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : fallbackLabel;
  const spec: FieldSpec = { label };
  if (typeof o.display === 'string' && o.display.trim()) spec.display = o.display.trim();
  if (o.print === true) spec.print = true;
  if (o.show === true) spec.show = true;
  if (Array.isArray(o.enum)) {
    const opts = o.enum
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const e = item as Record<string, unknown>;
        const name = String(e.name ?? e.label ?? '');
        if (!name) return null;
        const value = e.value as number | string;
        return { name, value };
      })
      .filter((x): x is EnumOption => !!x);
    if (opts.length) spec.enum = opts;
  }
  if (!spec.label && !spec.display && !spec.print && !spec.show && !spec.enum) return undefined;
  if (!spec.label) spec.label = fallbackLabel;
  return spec;
}

export function isForcedField(spec?: FieldSpec): boolean {
  return !!(spec && (spec.show || spec.display || spec.print));
}

export function getFieldSpec(className: string, key: string): FieldSpec | undefined {
  const fromClass = classTable(className)?.[key];
  const parsed = parseFieldSpec(fromClass, '');
  if (parsed) {
    if (!parsed.label) parsed.label = prettifyPropKey(key);
    return parsed;
  }
  const fromStar = starTable()?.[key];
  return parseFieldSpec(fromStar, prettifyPropKey(key));
}

export function getGroups(className: string): GroupSpec[] {
  const raw = classTable(className)?.[GROUPS_KEY];
  if (!Array.isArray(raw)) return [];
  const groups: GroupSpec[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    const keys = Array.isArray(o.keys)
      ? o.keys.filter((k): k is string => typeof k === 'string' && !!k)
      : [];
    const cells = Array.isArray(o.cells)
      ? o.cells.filter((c): c is string => typeof c === 'string')
      : undefined;
    if (!label || keys.length === 0) continue;
    groups.push({ label, keys, cells });
  }
  return groups;
}

/** 有 `$keys` 時只顯示白名單（順序即顯示順序）；未設則顯示全部反射欄位 */
export function getOnlyKeys(className: string): string[] | null {
  const raw = classTable(className)?.[KEYS_KEY];
  if (!Array.isArray(raw)) return null;
  const keys = raw.filter((k): k is string => typeof k === 'string' && !!k.trim());
  return keys.length ? keys : null;
}

export function listClassFieldKeys(className: string): string[] {
  const row = classTable(className);
  if (!row) return [];
  return Object.keys(row).filter(
    (k) => k !== CLASS_NAME_KEY && k !== GROUPS_KEY && k !== KEYS_KEY && !k.startsWith('_'),
  );
}

export function classLabel(className: string, fallback?: string): string {
  for (const key of classCandidates(className)) {
    if (key === '*') continue;
    const row = tables[key];
    if (typeof row === 'string' && row.trim()) return row.trim();
    if (row && typeof row === 'object') {
      const n = (row as ClassRow)[CLASS_NAME_KEY];
      if (typeof n === 'string' && n.trim()) return n.trim();
    }
  }
  return fallback || className.replace(/^cc\./, '') || className;
}

export function propLabel(className: string, key: string, fallback?: string, target?: any): string {
  const spec = getFieldSpec(className, key);
  if (spec?.label) return spec.label;
  const fromEngine = engineDisplayName(target, key);
  if (fromEngine) return fromEngine;
  if (fallback && fallback !== key) return fallback;
  return prettifyPropKey(key);
}

export function resolvePath(obj: any, path?: string): any {
  if (obj == null || !path) return obj;
  let cur = obj;
  for (const part of path.split('.').filter(Boolean)) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function formatFieldText(value: any, spec?: FieldSpec): string {
  if (value == null) return '—';
  const fromDisplay = textAt(value, spec?.display);
  if (fromDisplay) return fromDisplay;
  const fromName = textAt(value, 'name') || textAt(value, '_name') || assetFileName(value);
  if (fromName) return fromName;
  if (typeof value !== 'object') return String(value);
  return '—';
}

function textAt(obj: any, path?: string): string {
  if (!path) return '';
  try {
    const v = resolvePath(obj, path);
    if (typeof v !== 'string' && typeof v !== 'number') return '';
    const s = String(v).trim();
    return s;
  } catch {
    return '';
  }
}

function assetFileName(asset: any): string {
  if (!asset || typeof asset !== 'object') return '';
  let url = '';
  try {
    url = String(asset.nativeUrl || asset._nativeUrl || asset._native || '');
  } catch {
    return '';
  }
  const base = decodeURIComponent(url.split('?')[0].split('/').pop() || '').trim();
  return base;
}

/** Label / RichText：系統字顯示 fontFamily，自訂字型顯示資源名稱或檔名 */
export function fontFaceText(host: any): string | null {
  if (!host || typeof host !== 'object') return null;
  let sys = false;
  let family = '';
  let font: any = null;
  try {
    const hasFace =
      host.useSystemFont != null ||
      host.isSystemFontUsed != null ||
      typeof host.fontFamily === 'string' ||
      typeof host._fontFamily === 'string';
    if (!hasFace) return null;
    sys = !!(host.useSystemFont ?? host.isSystemFontUsed);
    const rawFamily = host.fontFamily ?? host._fontFamily;
    if (typeof rawFamily === 'string') family = rawFamily.trim();
    font = host.font ?? host._font;
  } catch {
    return null;
  }
  if (sys && family) return family;
  const named =
    textAt(font, 'name') ||
    textAt(font, '_name') ||
    assetFileName(font) ||
    textAt(font, 'spriteFrame.name') ||
    textAt(font, 'spriteFrame._name');
  if (named) return named;
  if (family) return family;
  return '—';
}

function resolveLabelsUrl(): string {
  try {
    const w = window as Window & { __ccDevToolsLabelsUrl?: string };
    if (w.__ccDevToolsLabelsUrl) return w.__ccDevToolsLabelsUrl;
  } catch {
    /* ignore */
  }
  const scripts = document.querySelectorAll('script[src]');
  for (const el of scripts) {
    const src = (el as HTMLScriptElement).src;
    if (/assets\/index\.js(\?|$)/.test(src)) {
      return src.replace(/index\.js(\?.*)?$/, 'prop-labels.json');
    }
  }
  return '';
}

export async function loadPropLabels(): Promise<void> {
  const url = resolveLabelsUrl();
  if (!url) return;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return;
    const data = (await res.json()) as LabelFile;
    if (data && typeof data === 'object') tables = data;
  } catch {
    /* 讀不到表時用 fallback / 引擎 displayName */
  } finally {
    window.clearTimeout(timer);
  }
}
