import { useSignal } from '@preact/signals';
import { PropRowsView } from './PropItem';
import { getComponentViewModel } from '../models/ComponentModels';
import { outputToConsole } from '../engine';
import { classLabel } from '../propLabels';

interface ComponentPanelProps {
  name: string;
  component: any;
  updateKey: number;
}

export function ComponentPanel({ name, component, updateKey: _updateKey }: ComponentPanelProps) {
  const collapsed = useSignal(false);
  const model = getComponentViewModel(name, () => component);

  return (
    <div class="comp-panel">
      <div
        class="comp-header"
        onClick={() => {
          collapsed.value = !collapsed.value;
        }}
      >
        <span
          class={`comp-arrow${collapsed.value ? '' : ' expanded'}`}
          title={collapsed.value ? '展開' : '收合'}
        >
          ›
        </span>
        <input
          type="checkbox"
          class="comp-enabled"
          checked={component?.enabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (component) component.enabled = (e.target as HTMLInputElement).checked;
          }}
        />
        <span class="comp-name" title={name}>
          {classLabel(name)}
        </span>
        <button
          class="icon-btn"
          title="輸出到主控台"
          onClick={(e) => {
            e.stopPropagation();
            outputToConsole(component);
          }}
        >
          &gt;
        </button>
      </div>
      {!collapsed.value && model && (
        <div class="comp-props">
          <PropRowsView
            className={name}
            model={model}
            component={component}
            inspectableOnly={!!model.inspectableOnly}
          />
        </div>
      )}
      {!collapsed.value && !model && (
        <div class="comp-empty">（無可編輯屬性）</div>
      )}
    </div>
  );
}
