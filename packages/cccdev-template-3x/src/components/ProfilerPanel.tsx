import { useEffect, useRef } from 'preact/hooks';
import { useComputed, useSignal } from '@preact/signals';
import { profilerOpen } from '../store';
import { readProfilerStats, type ProfilerStatItem } from '../engine';

export function ProfilerPanel() {
  const open = useComputed(() => profilerOpen.value);
  const items = useSignal<ProfilerStatItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const posX = useSignal(8);
  const posY = useSignal(40);

  useEffect(() => {
    if (!open.value) return;

    function refresh() {
      items.value = readProfilerStats();
    }

    refresh();
    const id = setInterval(refresh, 500);
    return () => clearInterval(id);
  }, [open.value]);

  useEffect(() => {
    if (!open.value) return;
    const header = panelRef.current?.querySelector('.profiler-drag') as HTMLElement | null;
    if (!header) return;

    let startX = 0;
    let startY = 0;
    let startPX = 0;
    let startPY = 0;
    let dragging = false;

    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      posX.value = startPX + (e.clientX - startX);
      posY.value = startPY + (e.clientY - startY);
    }

    function onMouseUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    function onMouseDown(e: MouseEvent) {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startPX = posX.value;
      startPY = posY.value;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    header.addEventListener('mousedown', onMouseDown);
    return () => header.removeEventListener('mousedown', onMouseDown);
  }, [open.value]);

  if (!open.value) return null;

  return (
    <div
      ref={panelRef}
      class="profiler-float"
      style={{ left: `${posX.value}px`, top: `${posY.value}px` }}
    >
      <div class="profiler-drag">
        <span>Profiler</span>
        <button
          class="icon-btn"
          onClick={() => {
            profilerOpen.value = false;
          }}
        >
          ✕
        </button>
      </div>
      <div class="profiler-body">
        {items.value.map((item) => (
          <div class="profiler-row" key={item.key}>
            <span class="profiler-desc">{item.desc}</span>
            <span class="profiler-val">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
