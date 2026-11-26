/**
 * Chrome MV3 service worker.
 * 工具列左鍵無動作；右鍵選單：便條紙開關、DevTools 開關、視窗模式。
 * DevTools：對目前分頁注入 MAIN world；該網域成功開啟後會記下來，
 * 下次預覽頁載入、引擎初始化完成後自動再開。手動關閉彈窗則取消自動開啟。
 *
 * 視窗模式：子母畫面 Document PiP（預設）／泡泡 popup。
 *
 * BM <cit49836085@gmail.com>
 * 原作者來源：https://github.com/potato47/ccc-devtools
 *
 * 注意：executeScript 只會序列化 func 本身，輔助邏輯必須寫在這個函式內部。
 */

const AUTO_OPEN_KEY = 'autoOpenOrigins';
const WINDOW_MODE_KEY = 'windowMode';
const SNIPPET_VISIBLE_KEY = 'snippet_ui_visible';

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

async function getWindowMode() {
  const data = await chrome.storage.local.get(WINDOW_MODE_KEY);
  return data[WINDOW_MODE_KEY] === 'popup' ? 'popup' : 'pip';
}

async function setWindowMode(mode) {
  const next = mode === 'pip' ? 'pip' : 'popup';
  await chrome.storage.local.set({ [WINDOW_MODE_KEY]: next });
  await syncActionTitle(next);
  try {
    await chrome.contextMenus.update('cccdev-mode-popup', { checked: next === 'popup' });
    await chrome.contextMenus.update('cccdev-mode-pip', { checked: next === 'pip' });
  } catch {
    await ensureActionMenus();
  }
}

async function syncActionTitle(mode) {
  const label = mode === 'pip' ? '子母畫面' : '泡泡模式';
  await chrome.action.setTitle({
    title: '右鍵開啟選單（便條紙／DevTools／' + label + '）',
  });
}

async function getSnippetVisible() {
  const data = await chrome.storage.local.get(SNIPPET_VISIBLE_KEY);
  return data[SNIPPET_VISIBLE_KEY] !== false;
}

async function setSnippetVisible(visible) {
  await chrome.storage.local.set({ [SNIPPET_VISIBLE_KEY]: !!visible });
  try {
    await chrome.contextMenus.update('cccdev-snippet-visible', { checked: !!visible });
  } catch {
    await ensureActionMenus();
  }
}

async function ensureActionMenus() {
  const mode = await getWindowMode();
  const snippetOn = await getSnippetVisible();
  try {
    await chrome.contextMenus.removeAll();
  } catch {
    /* ignore */
  }
  await chrome.contextMenus.create({
    id: 'cccdev-snippet-visible',
    type: 'checkbox',
    title: '便條紙',
    contexts: ['action'],
    checked: snippetOn,
  });
  await chrome.contextMenus.create({
    id: 'cccdev-devtools-toggle',
    title: '開啟／關閉 Cocos DevTools',
    contexts: ['action'],
  });
  await chrome.contextMenus.create({
    id: 'cccdev-mode-popup',
    type: 'radio',
    title: '泡泡模式（獨立視窗）',
    contexts: ['action'],
    checked: mode === 'popup',
  });
  await chrome.contextMenus.create({
    id: 'cccdev-mode-pip',
    type: 'radio',
    title: '子母畫面（置頂）',
    contexts: ['action'],
    checked: mode === 'pip',
  });
  await syncActionTitle(mode);
}

function assetArgs() {
  return [
    chrome.runtime.getURL('assets/style.css'),
    chrome.runtime.getURL('assets/index.js'),
    chrome.runtime.getManifest().version,
    chrome.runtime.getURL('assets/prop-labels.json'),
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
    if (!data || data.source !== 'cccdev') return;
    if (data.type === 'popup-closed') {
      chrome.runtime.sendMessage({ type: 'cccdev-popup-closed' });
      return;
    }
    if (data.type === 'popup-opened') {
      chrome.runtime.sendMessage({ type: 'cccdev-popup-opened' });
    }
  });
}

/**
 * @param {string} cssPath
 * @param {string} jsPath
 * @param {string} version
 * @param {string} mode toggle | open
 * @param {string} labelsPath
 * @param {string} windowMode popup | pip
 */
async function runRemoteDevTools(cssPath, jsPath, version, mode, labelsPath, windowMode) {
  const page = window;
  const LAYOUT_KEY = 'cc_devtools_layout';
  const defaults = { w: 920, h: 580, iw: 0, ih: 0, x: 80, y: 60, split: 0.42, leftW: 0, rightW: 0 };
  mode = mode || 'toggle';
  windowMode = windowMode === 'popup' ? 'popup' : 'pip';

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
   * 子母畫面不支援指定螢幕座標。
   */
  function applyOuterBox(win, layout, isPip) {
    if (!win || win.closed) return;
    try {
      win.resizeTo(layout.w, layout.h);
      if (!isPip) win.moveTo(layout.x, layout.y);
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

  function notifyPopupOpened() {
    try {
      page.postMessage({ source: 'cccdev', type: 'popup-opened' }, '*');
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

  async function openPopupWindow(featW, featH, layout) {
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
      return null;
    }
    return { win: devWin, kind: 'popup' };
  }

  function removePipGestureGate(result) {
    const gate = page.__ccDevToolsPipGate;
    if (!gate) return;
    page.__ccDevToolsPipGate = null;
    try {
      if (gate.onKey) page.removeEventListener('keydown', gate.onKey, true);
    } catch (e) {
      /* ignore */
    }
    try {
      if (gate.el && gate.el.parentNode) gate.el.parentNode.removeChild(gate.el);
    } catch (e) {
      /* ignore */
    }
    const done = gate.finish;
    gate.finish = null;
    if (done && result) {
      try {
        done(result);
      } catch (e) {
        /* ignore */
      }
    }
  }

  /**
   * Document PiP 必須在頁面真實使用者啟用下呼叫。
   * 擴充圖示 → executeScript 不會帶入手勢，故在預覽頁蓋一層請使用者點一下。
   */
  function requestPipWithUserGesture(featW, featH) {
    if (!page.documentPictureInPicture || typeof page.documentPictureInPicture.requestWindow !== 'function') {
      console.error('Cocos DevTools: 此瀏覽器不支援 Document Picture-in-Picture（子母畫面）');
      return Promise.resolve({ ok: false, reason: 'pip_unsupported' });
    }

    const opts = {
      width: Math.max(280, featW),
      height: Math.max(200, featH),
    };

    function tryRequest() {
      return page.documentPictureInPicture.requestWindow(opts).then(
        function (win) {
          return { ok: true, win: win, kind: 'pip' };
        },
        function (e) {
          return {
            ok: false,
            reason: 'pip_failed',
            error: String(e && e.message ? e.message : e),
            err: e,
          };
        },
      );
    }

    const activation = page.navigator && page.navigator.userActivation;
    if (activation && activation.isActive) {
      return tryRequest().then(function (result) {
        if (result.ok) return result;
        if (result.err && result.err.name === 'NotAllowedError') {
          return showPipGestureGate(tryRequest);
        }
        console.error('Cocos DevTools: 子母畫面開啟失敗', result.err || result.error);
        return result;
      });
    }

    return showPipGestureGate(tryRequest);
  }

  function showPipGestureGate(tryRequest) {
    // 清掉舊遮罩，但不 resolve（舊 Promise 若還在等，應已被新流程取代）
    const prev = page.__ccDevToolsPipGate;
    if (prev) {
      page.__ccDevToolsPipGate = null;
      try {
        if (prev.onKey) page.removeEventListener('keydown', prev.onKey, true);
      } catch (e) {
        /* ignore */
      }
      try {
        if (prev.el && prev.el.parentNode) prev.el.parentNode.removeChild(prev.el);
      } catch (e) {
        /* ignore */
      }
      if (prev.finish) {
        try {
          prev.finish({ ok: false, reason: 'pip_cancelled' });
        } catch (e) {
          /* ignore */
        }
      }
    }

    return new Promise(function (resolve) {
      const el = page.document.createElement('div');
      el.id = 'cccdev-pip-gesture-gate';
      el.setAttribute(
        'style',
        [
          'position:fixed',
          'inset:0',
          'z-index:2147483647',
          'display:flex',
          'align-items:center',
          'justify-content:center',
          'background:rgba(0,0,0,0.45)',
          'cursor:pointer',
          'font:14px/1.45 system-ui,sans-serif',
          'color:#f5f5f5',
          'user-select:none',
        ].join(';'),
      );

      const card = page.document.createElement('div');
      card.setAttribute(
        'style',
        [
          'max-width:360px',
          'padding:18px 20px',
          'border-radius:10px',
          'background:#1e1e1e',
          'border:1px solid #444',
          'box-shadow:0 8px 28px rgba(0,0,0,0.45)',
          'text-align:center',
          'pointer-events:none',
        ].join(';'),
      );
      card.innerHTML =
        '<div style="font-weight:600;margin-bottom:8px">開啟 Cocos DevTools 子母畫面</div>' +
        '<div style="opacity:0.85;font-size:13px">瀏覽器要求真實點擊才能置頂。請點此畫面任意處；Esc 取消。</div>';
      el.appendChild(card);

      let settled = false;
      function finish(result) {
        if (settled) return;
        settled = true;
        const gate = page.__ccDevToolsPipGate;
        if (gate) gate.finish = null;
        removePipGestureGate();
        resolve(result);
      }

      function onKey(ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          finish({ ok: false, reason: 'pip_cancelled' });
        }
      }

      el.addEventListener(
        'click',
        function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          tryRequest().then(function (result) {
            if (!result.ok) {
              console.error('Cocos DevTools: 子母畫面開啟失敗', result.err || result.error);
            }
            finish(result);
          });
        },
        true,
      );

      page.addEventListener('keydown', onKey, true);
      page.__ccDevToolsPipGate = {
        el: el,
        onKey: onKey,
        finish: finish,
      };

      const parent = page.document.documentElement || page.document.body;
      parent.appendChild(el);
    });
  }

  async function openPipWindow(featW, featH) {
    return requestPipWithUserGesture(featW, featH);
  }

  function mountDevTools(devWin, layout, kind) {
    page.__ccDevToolsWin = devWin;
    page.__ccDevToolsWasOpen = true;
    page.__ccDevToolsLayout = layout;
    try {
      devWin.__ccDevToolsRestore = layout;
      devWin.__ccDevToolsWindowMode = kind;
    } catch (e) {
      /* ignore */
    }
    try {
      if (labelsPath) devWin.__ccDevToolsLabelsUrl = labelsPath;
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

    applyOuterBox(devWin, layout, kind === 'pip');

    try {
      devWin.__ccDevToolsRestore = layout;
      devWin.__ccDevToolsWindowMode = kind;
    } catch (e) {
      /* ignore */
    }
    try {
      if (labelsPath) devWin.__ccDevToolsLabelsUrl = labelsPath;
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
    notifyPopupOpened();
  }

  async function openDevTools() {
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

    if (windowMode === 'pip') {
      const pip = await openPipWindow(featW, featH);
      if (!pip.ok) return { ok: false, reason: pip.reason, error: pip.error };
      mountDevTools(pip.win, layout, 'pip');
      return { ok: true, windowMode: 'pip' };
    }

    const opened = await openPopupWindow(featW, featH, layout);
    if (!opened) {
      return { ok: false, reason: 'popup_blocked' };
    }
    mountDevTools(opened.win, layout, 'popup');
    return { ok: true, windowMode: 'popup' };
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
    removePipGestureGate({ ok: false, reason: 'pip_cancelled' });
    return { ok: true, closed: true };
  }

  if (mode === 'toggle' && page.__ccDevToolsPipGate) {
    removePipGestureGate({ ok: false, reason: 'pip_cancelled' });
    cancelWaiter();
    page.__ccDevToolsWasOpen = false;
    return { ok: true, closed: true };
  }

  if (mode === 'toggle' && page.__ccDevToolsWaiter) {
    cancelWaiter();
    page.__ccDevToolsWasOpen = false;
    return { ok: true, closed: true };
  }

  if (mode === 'open') {
    if (isEngineReady()) return await openDevTools();
    return startWaiter();
  }

  if (!page.cc) {
    console.error('Cocos DevTools: 未偵測到 Cocos Creator（window.cc）。請在遊戲預覽頁使用。');
    return { ok: false, reason: 'no_cc' };
  }

  return await openDevTools();
}

async function injectRun(tabId, mode) {
  const [cssPath, jsPath, version, labelsPath] = assetArgs();
  const windowMode = await getWindowMode();
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'ISOLATED',
    func: isolatedCloseBridge,
  });
  const [inj] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: runRemoteDevTools,
    args: [cssPath, jsPath, version, mode, labelsPath, windowMode],
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

ensureActionMenus().catch((err) => {
  console.warn('Cocos DevTools: context menu setup failed', err);
});

chrome.runtime.onInstalled.addListener(() => {
  ensureActionMenus().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  ensureActionMenus().catch(() => {});
});

async function toggleDevToolsForTab(tab) {
  if (!tab || !tab.id) return;
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
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'cccdev-snippet-visible') {
    setSnippetVisible(!!info.checked);
    return;
  }
  if (info.menuItemId === 'cccdev-devtools-toggle') {
    toggleDevToolsForTab(tab);
    return;
  }
  if (info.menuItemId === 'cccdev-mode-popup') {
    setWindowMode('popup');
    return;
  }
  if (info.menuItemId === 'cccdev-mode-pip') {
    setWindowMode('pip');
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  maybeAutoOpen(tabId, tab.url || info.url);
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg) return;
  const origin = tabOriginKey(sender.tab && sender.tab.url);
  if (msg.type === 'cccdev-popup-closed') {
    setAutoOrigin(origin, false);
    return;
  }
  if (msg.type === 'cccdev-popup-opened') {
    setAutoOrigin(origin, true);
  }
});
