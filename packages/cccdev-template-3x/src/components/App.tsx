import { useEffect, useRef } from 'preact/hooks';
import { useComputed, useSignal } from '@preact/signals';
import { profilerOpen } from '../store';
import {
  applySavedWindowBox,
  readApplyLayout,
  saveWindowLayout,
  setPersistEnabled,
  splitRatioFromLayout,
  SPLITTER_W,
} from '../persist';
import { TreePanel } from './TreePanel';
import { PropPanel } from './PropPanel';
import { ProfilerPanel } from './ProfilerPanel';

const MIN_PANE = 180;

export function App() {
  const leftW = useSignal(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const restored = useSignal(false);
  const profilerActive = useComputed(() => profilerOpen.value);

  // 尺寸在開啟時由 window.open 帶入；若 Chrome 忽略 features，這裡只補正一次，關閉時不再重量
  useEffect(() => {
    setPersistEnabled(false);
    let finished = false;
    const timers: number[] = [];

    function applySplitAfterBox() {
      const wrap = wrapRef.current;
      const layout = readApplyLayout();
      const wrapW = wrap?.getBoundingClientRect().width || window.innerWidth;
      if (wrapW < MIN_PANE * 2) return;
      const ratio = splitRatioFromLayout(layout);
      const usable = wrapW - SPLITTER_W;
      const maxLeft = wrapW - MIN_PANE - SPLITTER_W;
      leftW.value = Math.round(Math.min(maxLeft, Math.max(MIN_PANE, ratio * usable)));
    }

    function finish() {
      if (finished) return;
      finished = true;
      applySavedWindowBox();
      applySplitAfterBox();
      restored.value = true;
      setPersistEnabled(true);
    }

    timers.push(window.setTimeout(finish, 80));

    return () => {
      finished = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (!restored.value) return;

    let timer = 0;
    let lastSig = '';
    function persistLayout() {
      saveWindowLayout();
    }
    function onResize() {
      window.clearTimeout(timer);
      timer = window.setTimeout(persistLayout, 200);
    }
    function pollBox() {
      const sig = `${window.screenX},${window.screenY},${window.outerWidth},${window.outerHeight}`;
      if (sig === lastSig) return;
      lastSig = sig;
      persistLayout();
    }
    lastSig = `${window.screenX},${window.screenY},${window.outerWidth},${window.outerHeight}`;
    window.addEventListener('resize', onResize);
    const pollId = window.setInterval(pollBox, 400);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(pollId);
      window.removeEventListener('resize', onResize);
    };
  }, [restored.value]);

  useEffect(() => {
    const handle = splitRef.current;
    const wrap = wrapRef.current;
    if (!handle || !wrap) return;

    function onMouseMove(e: MouseEvent) {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const maxLeft = rect.width - MIN_PANE - SPLITTER_W;
      const next = e.clientX - rect.left;
      leftW.value = Math.round(Math.min(maxLeft, Math.max(MIN_PANE, next)));
    }

    function onMouseUp() {
      handle!.classList.remove('dragging');
      saveWindowLayout();
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      handle!.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    handle.addEventListener('mousedown', onMouseDown);
    return () => handle.removeEventListener('mousedown', onMouseDown);
  }, []);

  const leftStyle = leftW.value > 0 ? `${leftW.value}px` : '42%';

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
        title="原作者 potato47 / GitHub"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </a>
      <div class="ccdev-pane ccdev-pane-left" ref={leftRef} style={{ width: leftStyle }}>
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
