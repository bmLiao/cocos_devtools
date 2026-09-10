function launchRemoteDevTools() {
  // 1. 開啟新視窗
  const devWin = window.open(
    '',
    'CCDevToolsRemote',
    'width=450,height=900,location=no,menubar=no,status=no,toolbar=no,resizable=yes',
  );
  if (!devWin) {
    alert('彈出視窗被攔截，請允許此網站的彈出視窗');
    return;
  }

  // 2. 取得 CSS 的絕對路徑
  const cssPath = new URL('./devtools/assets/style.css', window.location.href).href;

  // 3. 寫入新視窗的基礎 HTML 結構
  devWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cocos DevTools Remote</title>
            <link rel="stylesheet" href="${cssPath}">
            <style>
                body { margin: 0; padding: 0; background: #222; overflow: auto; }
                #cc-devtools-root { height: 100vh; width: 100%; }
            </style>
        </head>
        <body>
            <div id="cc-devtools-root"></div>
        </body>
        </html>
    `);
  devWin.document.close();

  // 4. 建立引擎代理
  // 讓彈出視窗可以直接存取原視窗的 Cocos 物件
  devWin.cc = window.cc;
  devWin.Editor = window.Editor;

  // 5. 注入 JS 腳本 (同樣使用絕對路徑)
  // 請將下方的路徑換成您實際的 cc-devtools.js 位置
  const jsPath = new URL('./devtools/assets/index.js', window.location.href).href;
  const script = devWin.document.createElement('script');
  script.src = jsPath;
  devWin.document.body.appendChild(script);

  // 6. (選用) 隱藏原本嵌入在遊戲內的工具
  const originalRoot = document.querySelector('#cc-devtools-root');
  if (originalRoot) originalRoot.style.display = 'none';
}
