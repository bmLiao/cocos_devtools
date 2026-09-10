/**
 * Chrome MV3 service worker.
 * 點擊圖示才對目前分頁注入 MAIN world；該網域成功開啟後會記下來，
 * 下次預覽頁載入、引擎初始化完成後自動再開。手動關閉彈窗則取消自動開啟。
 *
 * BM <cit49836085@gmail.com>
 * 原作者來源：https://github.com/potato47/ccc-devtools
 *
 * 注意：executeScript 只會序列化 func 本身，輔助邏輯必須寫在這個函式內部。
 */

const AUTO_OPEN_KEY = 'autoOpenOrigins';

function tabOriginKey(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') {
      u.hash = '';
      return u.href;
    }
    return u.origin;
  } catch {
    return '';
  }
}

function isInjectableUrl(url) {
  return /^(https?:|file:)/i.test(url || '');
}

async function getAutoMap() {
  const data = await chrome.storage.local.get(AUTO_OPEN_KEY);
  const map = data[AUTO_OPEN_KEY];
  return map && typeof map === 'object' ? map : {};
}

async function setAutoOrigin(origin, on) {
  if (!origin) return;
  const map = await getAutoMap();
  if (on) map[origin] = true;
  else delete map[origin];
  await chrome.storage.local.set({ [AUTO_OPEN_KEY]: map });
}

function assetArgs() {
  return [
    chrome.runtime.getURL('assets/style.css'),
    chrome.runtime.getURL('assets/index.js'),
    chrome.runtime.getManifest().version,
  ];
}

/**
 * Isolated world：把頁面 postMessage 轉成 runtime message（可喚醒 service worker）。
 */
function isolatedCloseBridge() {
  if (window.__cccdevCloseBridge) return;
  window.__cccdevCloseBridge = true;
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'cccdev' || data.type !== 'popup-closed') return;
    chrome.runtime.sendMessage({ type: 'cccdev-popup-closed' });
  });
}

function runRemoteDevTools(cssPath, jsPath, version, mode) {
  const page = window;
  const LAYOUT_KEY = 'cc_devtools_layout';
  const defaults = { w: 920, h: 580, iw: 0, ih: 0, x: 80, y: 60, split: 0.42, leftW: 0, rightW: 0 };
  mode = mode || 'toggle';

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

  function isEngineReady() {
    const cc = page.cc;
    if (!cc) return false;
    try {
      const scene = cc.director && cc.director.getScene && cc.director.getScene();
      if (scene) return true;
    } catch (e) {
      /* ignore */
    }
    try {
      if (cc.game && (cc.game._inited || cc.game.isInited)) return true;
    } catch (e) {
      /* ignore */
    }
    return false;
  }

  function cancelWaiter() {
    if (page.__ccDevToolsWaiter) {
      page.clearTimeout(page.__ccDevToolsWaiter);
      page.__ccDevToolsWaiter = 0;
    }
  }

  function notifyPopupClosedByUser() {
    try {
      page.postMessage({ source: 'cccdev', type: 'popup-closed' }, '*');
    } catch (e) {
      /* ignore */
    }
  }

  function bindUserCloseWatch() {
    if (page.__ccDevToolsUserCloseBound) return;
    page.__ccDevToolsUserCloseBound = true;
    page.setInterval(function () {
      const w = page.__ccDevToolsWin;
      if (w && !w.closed) {
        page.__ccDevToolsWasOpen = true;
        return;
      }
      if (!page.__ccDevToolsWasOpen) return;
      if (page.__ccDevToolsUnloading) return;
      page.__ccDevToolsWasOpen = false;
      page.__ccDevToolsWin = null;
      notifyPopupClosedByUser();
    }, 400);
  }

  function bindUnloadClose() {
    if (page.__ccDevToolsCloseBound) return;
    page.__ccDevToolsCloseBound = true;
    const closeDevWin = function () {
      page.__ccDevToolsUnloading = true;
      cancelWaiter();
      const w = page.__ccDevToolsWin;
      if (w && !w.closed) w.close();
      page.__ccDevToolsWin = null;
    };
    page.addEventListener('pagehide', closeDevWin);
    page.addEventListener('beforeunload', closeDevWin);
  }

  function openDevTools() {
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
    page.__ccDevToolsWasOpen = true;
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

    bindUnloadClose();
    bindUserCloseWatch();
    return { ok: true };
  }

  function armGameInit() {
    if (page.__ccDevToolsGameInitBound) return;
    const cc = page.cc;
    if (!cc || !cc.game || typeof cc.game.once !== 'function') return;
    page.__ccDevToolsGameInitBound = true;
    const ev = (cc.Game && cc.Game.EVENT_GAME_INITED) || 'game_inited';
    cc.game.once(ev, function () {
      cancelWaiter();
      const existing = page.__ccDevToolsWin;
      if (existing && !existing.closed) return;
      openDevTools();
    });
  }

  function startWaiter() {
    if (page.__ccDevToolsWaiter) return { ok: true, waiting: true };
    bindUnloadClose();
    bindUserCloseWatch();
    const t0 = Date.now();
    let ccSince = 0;
    const waitMax = 5 * 60 * 1000;
    const ccFallback = 12000;

    function tick() {
      page.__ccDevToolsWaiter = 0;
      const existing = page.__ccDevToolsWin;
      if (existing && !existing.closed) return;
      if (page.cc) {
        if (!ccSince) ccSince = Date.now();
        armGameInit();
      }
      if (isEngineReady()) {
        openDevTools();
        return;
      }
      if (page.cc && Date.now() - ccSince > ccFallback) {
        openDevTools();
        return;
      }
      if (Date.now() - t0 > waitMax) return;
      page.__ccDevToolsWaiter = page.setTimeout(tick, 250);
    }

    tick();
    return { ok: true, waiting: true };
  }

  const existing = page.__ccDevToolsWin;
  if (existing && !existing.closed) {
    if (mode === 'open') {
      bindUserCloseWatch();
      return { ok: true, already: true };
    }
    existing.close();
    page.__ccDevToolsWin = null;
    page.__ccDevToolsWasOpen = false;
    cancelWaiter();
    return { ok: true, closed: true };
  }

  if (mode === 'toggle' && page.__ccDevToolsWaiter) {
    cancelWaiter();
    page.__ccDevToolsWasOpen = false;
    return { ok: true, closed: true };
  }

  if (mode === 'open') {
    if (isEngineReady()) return openDevTools();
    return startWaiter();
  }

  if (!page.cc) {
    console.error('Cocos DevTools: 未偵測到 Cocos Creator（window.cc）。請在遊戲預覽頁使用。');
    return { ok: false, reason: 'no_cc' };
  }

  return openDevTools();
}

async function injectRun(tabId, mode) {
  const [cssPath, jsPath, version] = assetArgs();
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: isolatedCloseBridge,
  });
  const [inj] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: runRemoteDevTools,
    args: [cssPath, jsPath, version, mode],
  });
  return inj && inj.result;
}

async function maybeAutoOpen(tabId, url) {
  if (!tabId || !isInjectableUrl(url)) return;
  const origin = tabOriginKey(url);
  if (!origin) return;
  const map = await getAutoMap();
  if (!map[origin]) return;
  try {
    await injectRun(tabId, 'open');
  } catch (err) {
    console.warn('Cocos DevTools: auto-open failed', err);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const origin = tabOriginKey(tab.url);

  try {
    const result = await injectRun(tab.id, 'toggle');
    if (result && result.closed) {
      await setAutoOrigin(origin, false);
    } else if (result && result.ok) {
      await setAutoOrigin(origin, true);
    }
  } catch (err) {
    console.warn('Cocos DevTools: cannot inject into this page', err);
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  maybeAutoOpen(tabId, tab.url || info.url);
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'cccdev-popup-closed') return;
  const origin = tabOriginKey(sender.tab && sender.tab.url);
  setAutoOrigin(origin, false);
});
