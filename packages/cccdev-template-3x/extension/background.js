/**
 * Chrome MV3 service worker.
 * 安裝後不注入任何頁面腳本；僅在使用者點擊擴充圖示時才進入目前頁 MAIN world。
 * 再點一次關閉彈窗。頁面關閉或重新整理時也會關掉彈窗。
 *
 * BM <cit49836085@gmail.com>
 * 原作者來源：https://github.com/potato47/ccc-devtools
 *
 * 注意：executeScript 只會序列化 func 本身，輔助邏輯必須寫在這個函式內部。
 */

function toggleRemoteDevTools(cssPath, jsPath, version) {
  const page = window;
  const LAYOUT_KEY = 'cc_devtools_layout';
  const defaults = { w: 920, h: 580, iw: 0, ih: 0, x: 80, y: 60, split: 0.42, leftW: 0, rightW: 0 };

  function readLayout() {
    if (page.__ccDevToolsLayout && typeof page.__ccDevToolsLayout === 'object') {
      return Object.assign({}, defaults, page.__ccDevToolsLayout);
    }
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) return Object.assign({}, defaults, JSON.parse(raw));
    } catch (e) {
      /* ignore */
    }
    return Object.assign({}, defaults);
  }

  /**
   * resizeTo / moveTo 用外框與螢幕座標（與儲存的 outerWidth、screenX 一致）。
   * document.write 常會把 window.open 的尺寸清掉，所以寫完文件後套一次。
   */
  function applyOuterBox(win, layout) {
    if (!win || win.closed) return;
    try {
      win.resizeTo(layout.w, layout.h);
      win.moveTo(layout.x, layout.y);
    } catch (e) {
      /* ignore */
    }
  }

  const existing = page.__ccDevToolsWin;
  if (existing && !existing.closed) {
    existing.close();
    page.__ccDevToolsWin = null;
    return { ok: true, closed: true };
  }

  if (!page.cc) {
    console.error('Cocos DevTools: 未偵測到 Cocos Creator（window.cc）。請在遊戲預覽頁使用。');
    return { ok: false, reason: 'no_cc' };
  }

  const layout = readLayout();
  layout.w = Math.max(280, Math.round(layout.w) || 920);
  layout.h = Math.max(200, Math.round(layout.h) || 580);
  layout.x = Math.round(Number(layout.x) || 0);
  layout.y = Math.round(Number(layout.y) || 0);

  // window.open 的 width/height = 內容區；resizeTo 才是外框
  const featW = layout.iw > 100 ? layout.iw : layout.w;
  const featH = layout.ih > 100 ? layout.ih : layout.h;

  // 每次使用新名稱，避免 Chrome 對同名視窗忽略 width/height
  const winName = 'CCDevTools_' + Date.now();
  const features =
    'width=' +
    featW +
    ',height=' +
    featH +
    ',left=' +
    layout.x +
    ',top=' +
    layout.y +
    ',location=no,menubar=no,status=no,toolbar=no,resizable=yes';
  const devWin = page.open('', winName, features);
  if (!devWin) {
    console.error('Cocos DevTools: 彈出視窗被攔截，請允許此網站的彈出視窗');
    return { ok: false, reason: 'popup_blocked' };
  }

  page.__ccDevToolsWin = devWin;
  page.__ccDevToolsLayout = layout;
  try {
    devWin.__ccDevToolsRestore = layout;
  } catch (e) {
    /* ignore */
  }

  const title = version ? 'Cocos DevTools v' + version : 'Cocos DevTools';

  devWin.document.open();
  devWin.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      title +
      '</title></head><body><div id="cc-devtools-root"></div></body></html>',
  );
  devWin.document.close();
  try {
    devWin.document.title = title;
  } catch (e) {
    /* ignore */
  }

  applyOuterBox(devWin, layout);

  try {
    devWin.__ccDevToolsRestore = layout;
  } catch (e) {
    /* ignore */
  }

  const link = devWin.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssPath;
  devWin.document.head.appendChild(link);

  // 與 exsimple.js 相同：讓彈窗直接持有遊戲頁的引擎物件
  devWin.cc = page.cc;
  devWin.Editor = page.Editor;

  const script = devWin.document.createElement('script');
  script.src = jsPath;
  devWin.document.body.appendChild(script);

  if (!page.__ccDevToolsCloseBound) {
    page.__ccDevToolsCloseBound = true;
    const closeDevWin = function () {
      const w = page.__ccDevToolsWin;
      if (w && !w.closed) w.close();
      page.__ccDevToolsWin = null;
    };
    page.addEventListener('pagehide', closeDevWin);
    page.addEventListener('beforeunload', closeDevWin);
  }

  return { ok: true };
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const cssPath = chrome.runtime.getURL('assets/style.css');
  const jsPath = chrome.runtime.getURL('assets/index.js');
  const version = chrome.runtime.getManifest().version;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: toggleRemoteDevTools,
      args: [cssPath, jsPath, version],
    });
  } catch (err) {
    console.warn('Cocos DevTools: cannot inject into this page', err);
  }
});
