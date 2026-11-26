import { useComputed } from '@preact/signals';
import { selectedNode, updateTick } from '../store';
import { isValid, getComponents, outputToConsole, drawNodeRect } from '../engine';
import { NodeModel } from '../models/NodeModel';
import { PropRowsView } from './PropItem';
import { ComponentPanel } from './ComponentPanel';

export function PropPanel() {
  const node = useComputed(() => selectedNode.value);
  const tick = useComputed(() => updateTick.value);

  if (!node.value || !isValid(node.value)) {
    return (
      <div class="prop-panel">
        <div class="panel-header">屬性</div>
        <div class="prop-empty">未選取節點</div>
      </div>
    );
  }

  const ccNode = node.value;
  const components = getComponents(ccNode);

  return (
    <div class="prop-panel">
      <div class="panel-header">屬性</div>
      <div class="prop-scroll">
        {/* 節點基礎屬性 */}
        <div class="comp-panel">
          <div class="comp-header">
            <input
              type="checkbox"
              class="comp-enabled"
              checked={ccNode.active}
              onChange={(e) => {
                ccNode.active = (e.target as HTMLInputElement).checked;
              }}
            />
            <span class="comp-name" title="cc.Node">
              {ccNode.name || '（未命名）'}
            </span>
            <div style="flex:1" />
            <button class="icon-btn" title="標示節點" onClick={() => drawNodeRect(ccNode)}>
              ⊡
            </button>
            <button class="icon-btn" title="輸出到主控台" onClick={() => outputToConsole(ccNode)}>
              &gt;
            </button>
          </div>
          <div class="comp-props">
            <PropRowsView className="cc.Node" model={NodeModel} component={ccNode} />
          </div>
        </div>

        <div class="divider" />

        {/* 元件列表 */}
        {components.map(({ name, target }) => (
          <ComponentPanel key={name} name={name} component={target} updateKey={tick.value} />
        ))}
      </div>
    </div>
  );
}
