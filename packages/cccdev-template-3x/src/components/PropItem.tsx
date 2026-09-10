import { useRef, useEffect } from 'preact/hooks';
import { cc } from '../engine';
import { inspectType, isInspectableValue } from '../propInspect';

interface PropItemProps {
  model: any;
  propName: string;
  propKey: string;
  inspectableOnly?: boolean;
}

const VEC_TYPES = new Set(['cc.Vec2', 'cc.Vec3', 'cc.Vec4', 'cc.Size', 'cc.Rect']);

function colorToHex(color: any): string {
  const hex = color.toHEX() as string;
  return `#${hex}`;
}

function hexToColor(hex: string): any {
  return new (cc().Color)().fromHEX(hex);
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

export function PropItem({ model, propName, propKey, inspectableOnly }: PropItemProps) {
  const value = model[propKey];
  if (inspectableOnly && !isInspectableValue(value)) return null;

  const type = inspectType(value);

  return (
    <div class={`prop-row${VEC_TYPES.has(type) ? ' prop-row-vec' : ''}`}>
      <span class="prop-name" title={propName}>
        {propName}
      </span>
      <div class="prop-value">
        {type === 'number' && <NumberInput model={model} propKey={propKey} />}
        {type === 'string' && <StringInput model={model} propKey={propKey} />}
        {type === 'boolean' && (
          <input
            type="checkbox"
            class="prop-checkbox"
            checked={value}
            onChange={(e) => {
              model[propKey] = (e.target as HTMLInputElement).checked;
            }}
          />
        )}
        {type === 'array' && <ArrayInput model={model} propKey={propKey} />}
        {type === 'cc.Color' && (
          <input
            type="color"
            class="prop-color"
            value={colorToHex(value)}
            onChange={(e) => {
              model[propKey] = hexToColor((e.target as HTMLInputElement).value);
            }}
          />
        )}
        {type === 'cc.Vec2' && <VecInput model={model} propKey={propKey} axes={['x', 'y']} />}
        {type === 'cc.Vec3' && <VecInput model={model} propKey={propKey} axes={['x', 'y', 'z']} />}
        {type === 'cc.Vec4' && <VecInput model={model} propKey={propKey} axes={['x', 'y', 'z', 'w']} />}
        {type === 'cc.Size' && <VecInput model={model} propKey={propKey} axes={['width', 'height']} />}
        {type === 'cc.Rect' && (
          <VecInput model={model} propKey={propKey} axes={['x', 'y', 'width', 'height']} />
        )}
        {!inspectableOnly && type === 'unknown' && (
          <span class="prop-unknown">{value == null ? '' : String(value)}</span>
        )}
      </div>
    </div>
  );
}
