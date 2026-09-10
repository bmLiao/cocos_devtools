/**
 * Chrome MV3 service worker.
 * 安装后不注入任何页面脚本；仅在用户点击扩展图标时才进入当前页 MAIN world。
 * 再点一次关闭弹窗。页面关闭或刷新时也会关掉弹窗。
 */

function toggleRemoteDevTools(cssPath, jsPath) {
  const page = window;

  const existing = page.__ccDevToolsWin;
  if (existing && !existing.closed) {
    existing.close();
    page.__ccDevToolsWin = null;
    return { ok: true, closed: true };
  }

  if (!page.cc) {
    alert('未检测到 Cocos Creator（window.cc）。请在游戏预览页使用。');
    return { ok: false, reason: 'no_cc' };
  }

  if (!page.__ccDevToolsWinId) {
    page.__ccDevToolsWinId = Date.now();
  }

  const features =
    'width=920,height=580,left=80,top=60,location=no,menubar=no,status=no,toolbar=no,resizable=yes';
  const devWin = page.open('', 'CCDevToolsRemote_' + String(page.__ccDevToolsWinId), features);
  if (!devWin) {
    alert('弹出窗口被拦截，请允许此网站的弹出窗口');
    return { ok: false, reason: 'popup_blocked' };
  }

  page.__ccDevToolsWin = devWin;

  devWin.document.open();
  devWin.document.write(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cocos DevTools</title></head><body><div id="cc-devtools-root"></div></body></html>',
  );
  devWin.document.close();

  const link = devWin.document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssPath;
  devWin.document.head.appendChild(link);

  // 与 exsimple.js 相同：让弹窗直接持有游戏页的引擎对象
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

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: toggleRemoteDevTools,
      args: [cssPath, jsPath],
    });
  } catch (err) {
    console.warn('Cocos DevTools: cannot inject into this page', err);
  }
});
