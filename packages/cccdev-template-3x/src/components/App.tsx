import { useEffect, useRef } from 'preact/hooks';
import { useComputed, useSignal } from '@preact/signals';
import { profilerOpen } from '../store';
import { TreePanel } from './TreePanel';
import { PropPanel } from './PropPanel';
import { ProfilerPanel } from './ProfilerPanel';

const SPLIT_KEY = 'cc_devtools_split';
const MIN_PANE = 180;

function getSavedSplit(): number {
  const v = parseFloat(localStorage.getItem(SPLIT_KEY) ?? '');
  return Number.isFinite(v) ? Math.min(0.75, Math.max(0.25, v)) : 0.42;
}

export function App() {
  const split = useSignal(getSavedSplit());
  const wrapRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const profilerActive = useComputed(() => profilerOpen.value);

  useEffect(() => {
    const handle = splitRef.current;
    const wrap = wrapRef.current;
    if (!handle || !wrap) return;

    let startX = 0;
    let startRatio = 0;

    function onMouseMove(e: MouseEvent) {
      const width = wrap!.getBoundingClientRect().width;
      if (width <= 0) return;
      const minRatio = MIN_PANE / width;
      const maxRatio = 1 - minRatio;
      const next = startRatio + (e.clientX - startX) / width;
      split.value = Math.min(maxRatio, Math.max(minRatio, next));
    }

    function onMouseUp() {
      handle!.classList.remove('dragging');
      localStorage.setItem(SPLIT_KEY, String(split.value));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      startX = e.clientX;
      startRatio = split.value;
      handle!.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    handle.addEventListener('mousedown', onMouseDown);
    return () => handle.removeEventListener('mousedown', onMouseDown);
  }, []);

  const leftPct = `${split.value * 100}%`;

  return (
    <div id="cc-devtools" ref={wrapRef}>
      <button
        class={`ccdev-profiler-btn${profilerActive.value ? ' active' : ''}`}
        title="Profiler"
        onClick={() => {
          profilerOpen.value = !profilerOpen.value;
        }}
      >
        P
      </button>
      <a
        class="ccdev-github"
        href="https://github.com/potato47/ccc-devtools"
        target="_blank"
        title="GitHub"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </a>
      <div class="ccdev-pane ccdev-pane-left" style={{ width: leftPct }}>
        <TreePanel />
      </div>
      <div id="ccdev-split" ref={splitRef} title="拖曳調整寬度" />
      <div class="ccdev-pane ccdev-pane-right">
        <PropPanel />
      </div>
      <ProfilerPanel />
    </div>
  );
}
