const KEY = 'cc_devtools_layout';

/** 與 style.css `#ccdev-split` 同寬 */
export const SPLITTER_W = 5;

export interface LayoutState {
  w: number;
  h: number;
  iw: number;
  ih: number;
  x: number;
  y: number;
  split: number;
  leftW: number;
  rightW: number;
}

export const DEFAULT_LAYOUT: LayoutState = {
  w: 920,
  h: 580,
  iw: 0,
  ih: 0,
  x: 80,
  y: 60,
  split: 0.42,
  leftW: 0,
  rightW: 0,
};

let persistEnabled = false;

export function isPersistEnabled(): boolean {
  return persistEnabled;
}

export function setPersistEnabled(enabled: boolean): void {
  persistEnabled = enabled;
}

/** 彈窗與遊戲頁同源不一定成立；一律寫到 opener（遊戲頁） */
function hostWindow(): Window {
  try {
    if (window.opener && !window.opener.closed) return window.opener as Window;
  } catch {
    /* ignore */
  }
  return window;
}

export function readLayout(): LayoutState {
  const host = hostWindow() as Window & { __ccDevToolsLayout?: Partial<LayoutState> };
  const fromMem = host.__ccDevToolsLayout;
  if (fromMem && typeof fromMem === 'object') {
    return { ...DEFAULT_LAYOUT, ...fromMem };
  }
  try {
    const raw = host.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  const self = window as Window & { __ccDevToolsRestore?: Partial<LayoutState> };
  if (self.__ccDevToolsRestore && typeof self.__ccDevToolsRestore === 'object') {
    return { ...DEFAULT_LAYOUT, ...self.__ccDevToolsRestore };
  }
  return { ...DEFAULT_LAYOUT };
}

export function readApplyLayout(): LayoutState {
  const self = window as Window & { __ccDevToolsRestore?: Partial<LayoutState> };
  if (self.__ccDevToolsRestore && typeof self.__ccDevToolsRestore === 'object') {
    return { ...DEFAULT_LAYOUT, ...self.__ccDevToolsRestore };
  }
  return readLayout();
}

function persistToHost(next: LayoutState): LayoutState {
  const host = hostWindow() as Window & { __ccDevToolsLayout?: LayoutState };
  host.__ccDevToolsLayout = next;
  try {
    host.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function capturePanes(win: Window, next: LayoutState): void {
  try {
    const left = win.document.querySelector('.ccdev-pane-left');
    const right = win.document.querySelector('.ccdev-pane-right');
    if (!left || !right) return;
    const leftW = Math.round(left.getBoundingClientRect().width);
    const rightW = Math.round(right.getBoundingClientRect().width);
    if (leftW > 0 && rightW > 0) {
      next.leftW = leftW;
      next.rightW = rightW;
      next.split = leftW / (leftW + rightW);
    }
  } catch {
    /* ignore */
  }
}

function captureWindowBox(win: Window, base: LayoutState): LayoutState {
  const next = { ...base };
  if (win && !win.closed) {
    next.w = Math.round(win.outerWidth);
    next.h = Math.round(win.outerHeight);
    next.iw = Math.round(win.innerWidth);
    next.ih = Math.round(win.innerHeight);
    next.x = Math.round(win.screenX);
    next.y = Math.round(win.screenY);
    capturePanes(win, next);
  }
  return next;
}

export function writeLayout(partial: Partial<LayoutState> = {}, win: Window = window): LayoutState {
  return persistToHost(captureWindowBox(win, { ...readLayout(), ...partial }));
}

export function saveWindowLayout(win: Window = window): void {
  if (!persistEnabled) return;
  if (!win || win.closed) return;
  if (win.innerWidth < 280 || win.innerHeight < 200) return;
  writeLayout({}, win);
}

/** 用儲存的外框與螢幕座標還原（resizeTo = outer，moveTo = screenX/Y） */
export function applySavedWindowBox(win: Window = window): boolean {
  const layout = readApplyLayout();
  if (!win || win.closed) return false;
  try {
    if (layout.w > 200 && layout.h > 200) {
      if (Math.abs(win.outerWidth - layout.w) > 8 || Math.abs(win.outerHeight - layout.h) > 8) {
        win.resizeTo(layout.w, layout.h);
      }
    }
    if (Math.abs(win.screenX - layout.x) > 8 || Math.abs(win.screenY - layout.y) > 8) {
      win.moveTo(layout.x, layout.y);
    }
    return true;
  } catch {
    return false;
  }
}

export function splitRatioFromLayout(layout: LayoutState): number {
  if (layout.leftW > 0 && layout.rightW > 0) {
    return layout.leftW / (layout.leftW + layout.rightW);
  }
  if (Number.isFinite(layout.split) && layout.split > 0) return layout.split;
  return DEFAULT_LAYOUT.split;
}
