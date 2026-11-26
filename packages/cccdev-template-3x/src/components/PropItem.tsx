import { useRef, useEffect } from 'preact/hooks';
import { cc, outputToConsole } from '../engine';
import { inspectType, isInspectableValue, readEnumOptions } from '../propInspect';
import type { FieldSpec } from '../propLabels';
import { fontFaceText, formatFieldText, isForcedField } from '../propLabels';
import { buildPropRows, editTarget, rawValue, shortAxisLabel } from '../propRows';

interface PropItemProps {
  model: any;
  component?: any;
  propName: string;
  propKey: string;
  spec?: FieldSpec;
  inspectableOnly?: boolean;
  compact?: boolean;
  axisLabel?: string;
}

const VEC_TYPES = new Set(['cc.Vec2', 'cc.Vec3', 'cc.Vec4', 'cc.Size', 'cc.Rect']);

function byteHex(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
  return v.toString(16).padStart(2, '0');
}

function colorAlpha(color: any): number {
  const a = Number(color?.a ?? color?._a);
  return Number.isFinite(a) ? a : 255;
}

function colorToPickerHex(color: any): string {
  return `#${byteHex(color.r)}${byteHex(color.g)}${byteHex(color.b)}`;
}

/** 無有效 Alpha（視為 255）時只顯示 #RRGGBB，否則 #RRGGBBAA */
function colorToHexText(color: any): string {
  const rgb = `${byteHex(color.r)}${byteHex(color.g)}${byteHex(color.b)}`.toUpperCase();
  const a = colorAlpha(color);
  if (a >= 254.5) return `#${rgb}`;
  return `#${rgb}${byteHex(a).toUpperCase()}`;
}

function parseHexToRgba(hex: string, fallbackA = 255): { r: number; g: number; b: number; a: number } | null {
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) {
    s = s
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (s.length !== 6 && s.length !== 8) return null;
  if (!/^[0-9a-fA-F]+$/.test(s)) return null;
  const n = (i: number) => parseInt(s.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? n(6) : fallbackA };
}

function makeColor(r: number, g: number, b: number, a: number): any {
  const C = cc()?.Color;
  if (!C) return null;
  try {
    return new C(r, g, b, a);
  } catch {
    const c = new C();
    if (typeof c.fromHEX === 'function') {
      c.fromHEX(`#${byteHex(r)}${byteHex(g)}${byteHex(b)}`);
      if ('a' in c) c.a = a;
    }
    return c;
  }
}

function ColorEditor({ model, propKey, value }: { model: any; propKey: string; value: any }) {
  const hexRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = hexRef.current;
    if (!el || document.activeElement === el) return;
    const next = colorToHexText(value);
    if (el.value.toUpperCase() !== next) el.value = next;
  });

  return (
    <div class="prop-color-row">
      <input
        type="color"
        class="prop-color"
        title="色票"
        value={colorToPickerHex(value)}
        onChange={(e) => {
          const parsed = parseHexToRgba((e.target as HTMLInputElement).value, colorAlpha(value));
          if (!parsed) return;
          const c = makeColor(parsed.r, parsed.g, parsed.b, parsed.a);
          if (c) model[propKey] = c;
        }}
      />
      <input
        ref={hexRef}
        type="text"
        class="prop-input prop-color-hex"
        spellcheck={false}
        defaultValue={colorToHexText(value)}
        title="#RRGGBB 或 #RRGGBBAA"
        onChange={(e) => {
          const parsed = parseHexToRgba((e.target as HTMLInputElement).value, colorAlpha(value));
          if (!parsed) return;
          const c = makeColor(parsed.r, parsed.g, parsed.b, parsed.a);
          if (c) model[propKey] = c;
        }}
      />
    </div>
  );
}

function EnumSelect({
  model,
  propKey,
  value,
  options,
}: {
  model: any;
  propKey: string;
  value: any;
  options: Array<{ name: string; value: number | string }>;
}) {
  const current = value;
  const hasCurrent = options.some((o) => o.value == current);
  return (
    <select
      class="prop-input prop-select"
      value={String(current)}
      onChange={(e) => {
        const raw = (e.target as HTMLSelectElement).value;
        const opt = options.find((o) => String(o.value) === raw);
        if (!opt) return;
        model[propKey] = opt.value;
      }}
    >
      {!hasCurrent && <option value={String(current)}>{String(current)}</option>}
      {options.map((o) => (
        <option key={`${o.name}:${o.value}`} value={String(o.value)}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

function fontPrintValue(component: any, propKey: string, value: any, face: string | null): any {
  if (propKey !== 'font' || face == null) return value;
  try {
    const sys = !!(component?.useSystemFont ?? component?.isSystemFontUsed);
    if (!sys) {
      const font = component?.font ?? component?._font;
      if (font) return font;
    }
  } catch {
    /* ignore */
  }
  return face === '—' ? null : face;
}

function formatNum(v: number): string {
  return Number.isInteger(v) ? String(v) : parseFloat(v.toFixed(3)).toString();
}

function NumberInput({ model, propKey }: { model: any; propKey: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const external = model[propKey];
    if (parseFloat(el.value) !== external) {
      el.value = formatNum(external);
    }
  });

  return (
    <input
      ref={ref}
      type="number"
      class="prop-input"
      defaultValue={formatNum(model[propKey])}
      step="0.1"
      onInput={(e) => {
        const v = parseFloat((e.target as HTMLInputElement).value);
        if (!isNaN(v)) model[propKey] = v;
      }}
    />
  );
}

function StringInput({ model, propKey }: { model: any; propKey: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const external = String(model[propKey] ?? '');
    if (el.value !== external) el.value = external;
  });

  return (
    <input
      ref={ref}
      type="text"
      class="prop-input"
      defaultValue={model[propKey]}
      onInput={(e) => {
        model[propKey] = (e.target as HTMLInputElement).value;
      }}
    />
  );
}

function parsePrimitiveArray(text: string, sample: unknown[]): Array<string | number | boolean> {
  const parts = text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const kind = typeof sample[0];
  if (kind === 'number') return parts.map(Number).filter((n) => !Number.isNaN(n));
  if (kind === 'boolean') return parts.map((p) => p === 'true' || p === '1');
  return parts;
}

function ArrayInput({ model, propKey }: { model: any; propKey: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const external = Array.isArray(model[propKey]) ? model[propKey].join(', ') : '';
    if (el.value !== external) el.value = external;
  });

  return (
    <input
      ref={ref}
      type="text"
      class="prop-input"
      defaultValue={Array.isArray(model[propKey]) ? model[propKey].join(', ') : ''}
      onChange={(e) => {
        const sample = Array.isArray(model[propKey]) ? model[propKey] : [];
        model[propKey] = parsePrimitiveArray((e.target as HTMLInputElement).value, sample);
      }}
    />
  );
}

function AxisInput({
  model,
  propKey,
  axis,
}: {
  model: any;
  propKey: string;
  axis: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const external = model[propKey]?.[axis];
    if (external == null) return;
    if (parseFloat(el.value) !== external) el.value = formatNum(external);
  });

  return (
    <input
      ref={ref}
      type="number"
      class="prop-input"
      title={axis}
      defaultValue={formatNum(model[propKey]?.[axis] ?? 0)}
      step="0.1"
      onInput={(e) => {
        const n = parseFloat((e.target as HTMLInputElement).value);
        if (isNaN(n)) return;
        const cur = model[propKey];
        if (!cur) return;
        cur[axis] = n;
        model[propKey] = cur;
      }}
    />
  );
}

function VecInput({ model, propKey, axes }: { model: any; propKey: string; axes: string[] }) {
  return (
    <div class="prop-vec">
      {axes.map((axis) => (
        <AxisInput key={axis} model={model} propKey={propKey} axis={axis} />
      ))}
    </div>
  );
}

export function PropItem({
  model,
  component,
  propName,
  propKey,
  spec,
  inspectableOnly,
  compact,
  axisLabel,
}: PropItemProps) {
  const target = editTarget(model, component, propKey);
  const value = rawValue(model, component, propKey);
  const forced = isForcedField(spec);
  if (inspectableOnly && !forced && !isInspectableValue(value)) return null;

  const type = inspectType(value);
  const enumOpts = readEnumOptions(component ?? target, propKey, spec?.enum);
  const useEnum = enumOpts.length > 0 && (type === 'number' || type === 'string');
  const readonly = !!(spec?.print || (spec?.display && !isInspectableValue(value)));
  const face = propKey === 'font' ? fontFaceText(component) : null;
  const text = face ?? (readonly ? formatFieldText(value, spec) : '');
  const printValue = fontPrintValue(component, propKey, value, face);

  function onPrint() {
    if (printValue == null || printValue === '') return;
    outputToConsole(printValue);
  }

  const editor = (
    <>
      {useEnum && !readonly && (
        <EnumSelect model={target} propKey={propKey} value={value} options={enumOpts} />
      )}
      {!useEnum && type === 'number' && <NumberInput model={target} propKey={propKey} />}
      {!useEnum && type === 'string' && <StringInput model={target} propKey={propKey} />}
      {type === 'boolean' && (
        <input
          type="checkbox"
          class="prop-checkbox"
          checked={value}
          onChange={(e) => {
            target[propKey] = (e.target as HTMLInputElement).checked;
          }}
        />
      )}
      {type === 'array' && <ArrayInput model={target} propKey={propKey} />}
      {type === 'cc.Color' && <ColorEditor model={target} propKey={propKey} value={value} />}
      {type === 'cc.Vec2' && <VecInput model={target} propKey={propKey} axes={['x', 'y']} />}
      {type === 'cc.Vec3' && <VecInput model={target} propKey={propKey} axes={['x', 'y', 'z']} />}
      {type === 'cc.Vec4' && <VecInput model={target} propKey={propKey} axes={['x', 'y', 'z', 'w']} />}
      {type === 'cc.Size' && <VecInput model={target} propKey={propKey} axes={['width', 'height']} />}
      {type === 'cc.Rect' && (
        <VecInput model={target} propKey={propKey} axes={['x', 'y', 'width', 'height']} />
      )}
      {readonly && (
        <button
          type="button"
          class="prop-print"
          title="點擊打印到主控台"
          disabled={printValue == null || printValue === ''}
          onClick={onPrint}
        >
          {text}
        </button>
      )}
      {!readonly && !inspectableOnly && type === 'unknown' && (
        <span class="prop-unknown">{value == null ? '' : String(value)}</span>
      )}
    </>
  );

  if (compact) {
    return (
      <div class="prop-cell">
        <span class="prop-axis">{axisLabel || shortAxisLabel(propKey)}</span>
        <div class="prop-value">{editor}</div>
      </div>
    );
  }

  return (
    <div class={`prop-row${VEC_TYPES.has(type) || type === 'cc.Color' ? ' prop-row-vec' : ''}`}>
      <span class="prop-name" title={propName}>
        {propName}
      </span>
      <div class="prop-value">{editor}</div>
    </div>
  );
}

export function PropRowsView({
  className,
  model,
  component,
  inspectableOnly,
}: {
  className: string;
  model: any;
  component?: any;
  inspectableOnly?: boolean;
}) {
  const rows = buildPropRows(className, model, component);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((row) => {
        if (row.kind === 'group') {
          return (
            <div class="prop-row prop-row-group" key={`g:${row.label}:${row.keys.join(',')}`}>
              <span class="prop-name" title={row.label}>
                {row.label}
              </span>
              <div
                class="prop-group-cells"
                style={{ gridTemplateColumns: `repeat(${row.keys.length}, 1fr)` }}
              >
                {row.keys.map((key, i) => (
                  <PropItem
                    key={key}
                    model={model}
                    component={component}
                    propName={key}
                    propKey={key}
                    inspectableOnly={inspectableOnly}
                    compact
                    axisLabel={row.cells?.[i]}
                  />
                ))}
              </div>
            </div>
          );
        }
        return (
          <PropItem
            key={row.key}
            model={model}
            component={component}
            propName={row.label}
            propKey={row.key}
            spec={row.spec}
            inspectableOnly={inspectableOnly}
          />
        );
      })}
    </>
  );
}
