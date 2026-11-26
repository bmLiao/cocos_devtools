(function () {
  'use strict';

  if (window.top !== window.self) return;

  // Key 名稱
  const STORAGE_PAGES_KEY = 'snippet_sticky_pages';
  const STORAGE_INDEX_KEY = 'snippet_sticky_current_page';
  const STORAGE_BTN_POS_KEY = 'snippet_sticky_btn_pos';
  const STORAGE_FOLDED_KEY = 'snippet_sticky_is_folded';
  const STORAGE_VISIBLE_KEY = 'snippet_ui_visible';

  const defaultPages = [
    {
      title: '# 1',
      notes: [],
      colors: { text: '#000000', bodyBg: '#fffd88' },
    },
  ];

  let pages = defaultPages;
  let currentPageIndex = 0;
  let zIndexCounter = 999990;
  let isAllFolded = false;
  let isGlobalHidden = false;

  function saveData() {
    try {
      localStorage.setItem(STORAGE_PAGES_KEY, JSON.stringify(pages));
      localStorage.setItem(STORAGE_INDEX_KEY, currentPageIndex.toString());
      localStorage.setItem(STORAGE_FOLDED_KEY, JSON.stringify(isAllFolded));
    } catch (e) {
      console.warn('[Snippet] LocalStorage set item failed:', e);
    }
  }

  function saveBtnPos(pos) {
    try {
      localStorage.setItem(STORAGE_BTN_POS_KEY, JSON.stringify(pos));
    } catch (e) {
      console.warn('[Snippet] LocalStorage save btn pos failed:', e);
    }
  }

  // 時間格式化改為 [月/日-hh:mm:ss]
  function formatDate(ts) {
    const d = new Date(ts);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds} ${month}/${date}`;
  }

  function clampX(x, elementWidth = 50) {
    const maxX = Math.max(0, window.innerWidth - elementWidth);
    return Math.min(Math.max(0, x), maxX);
  }

  function clampY(y, elementHeight = 36) {
    const maxY = Math.max(0, window.innerHeight - elementHeight);
    return Math.min(Math.max(0, y), maxY);
  }

  // 建立根容器，以便控制整組顯示/隱藏
  const rootContainer = document.createElement('div');
  rootContainer.className = 'snippet_root_container';

  // 浮動主按鈕
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'snippet_control_toggle_btn';
  let btnX = window.innerWidth - 100;
  let btnY = window.innerHeight - 50;
  toggleBtn.style.left = btnX + 'px';
  toggleBtn.style.top = btnY + 'px';

  // 面板建立
  const panel = document.createElement('div');
  panel.className = 'snippet_panel snippet_hidden';

  const row1 = document.createElement('div');
  row1.className = 'snippet_panel_row snippet_panel_row_stretch';
  const prevBtn = document.createElement('button');
  prevBtn.className = 'snippet_btn snippet_btn_yellow snippet_btn_icon';
  prevBtn.textContent = '←';
  const pageTitleInput = document.createElement('input');
  pageTitleInput.type = 'text';
  pageTitleInput.placeholder = '頁面標題';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'snippet_btn snippet_btn_yellow snippet_btn_icon';
  nextBtn.textContent = '→';
  row1.appendChild(prevBtn);
  row1.appendChild(pageTitleInput);
  row1.appendChild(nextBtn);

  const row2 = document.createElement('div');
  row2.className = 'snippet_panel_row';
  const addNoteBtn = document.createElement('button');
  addNoteBtn.className = 'snippet_btn snippet_btn_green';
  addNoteBtn.textContent = '新增便條紙';
  const foldToggleBtn = document.createElement('button');
  foldToggleBtn.className = 'snippet_btn snippet_btn_orange';
  row2.appendChild(addNoteBtn);
  row2.appendChild(foldToggleBtn);

  const row3 = document.createElement('div');
  row3.className = 'snippet_panel_row';
  const addPageBtn = document.createElement('button');
  addPageBtn.className = 'snippet_btn snippet_btn_green';
  addPageBtn.textContent = '新增頁面';
  const clearPageBtn = document.createElement('button');
  clearPageBtn.className = 'snippet_btn snippet_btn_red';
  clearPageBtn.textContent = '清除頁面';
  row3.appendChild(addPageBtn);
  row3.appendChild(clearPageBtn);

  const row4 = document.createElement('div');
  row4.className = 'snippet_panel_row';
  const textLabel = document.createElement('label');
  textLabel.textContent = '文字顏色:';
  const textColorText = document.createElement('input');
  textColorText.type = 'text';
  textColorText.style.width = '65px';
  const textColorPicker = document.createElement('input');
  textColorPicker.type = 'color';
  row4.appendChild(textLabel);
  row4.appendChild(textColorText);
  row4.appendChild(textColorPicker);

  const row5 = document.createElement('div');
  row5.className = 'snippet_panel_row';
  const bgLabel = document.createElement('label');
  bgLabel.textContent = '背景顏色:';
  const bodyColorText = document.createElement('input');
  bodyColorText.type = 'text';
  bodyColorText.style.width = '65px';
  const bodyColorPicker = document.createElement('input');
  bodyColorPicker.type = 'color';
  row5.appendChild(bgLabel);
  row5.appendChild(bodyColorText);
  row5.appendChild(bodyColorPicker);

  const row6 = document.createElement('div');
  row6.className = 'snippet_panel_row';
  const importBtn = document.createElement('button');
  importBtn.className = 'snippet_btn snippet_btn_red';
  importBtn.textContent = '匯入';
  const exportBtn = document.createElement('button');
  exportBtn.className = 'snippet_btn snippet_btn_green';
  exportBtn.textContent = '匯出';
  row6.appendChild(importBtn);
  row6.appendChild(exportBtn);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';

  panel.appendChild(row1);
  panel.appendChild(row2);
  panel.appendChild(row3);
  panel.appendChild(row4);
  panel.appendChild(row5);
  panel.appendChild(row6);

  function applyGlobalVisibility() {
    rootContainer.style.display = isGlobalHidden ? 'none' : '';
  }

  function setExtensionVisible(visible) {
    isGlobalHidden = !visible;
    applyGlobalVisibility();
  }

  let uiStarted = false;
  function initUI() {
    if (uiStarted) {
      applyGlobalVisibility();
      return;
    }
    uiStarted = true;
    rootContainer.appendChild(toggleBtn);
    rootContainer.appendChild(panel);
    rootContainer.appendChild(fileInput);
    document.body.appendChild(rootContainer);
    renderPage();
    applyGlobalVisibility();
  }

  // 讀取資料
  try {
    const rawPages = localStorage.getItem(STORAGE_PAGES_KEY);
    if (rawPages) {
      const parsedPages = JSON.parse(rawPages);
      if (Array.isArray(parsedPages) && parsedPages.length > 0)
        pages = parsedPages;
    }

    const rawIndex = localStorage.getItem(STORAGE_INDEX_KEY);
    if (rawIndex !== null) {
      let idx = parseInt(rawIndex, 10);
      if (!isNaN(idx) && idx >= 0 && idx < pages.length) currentPageIndex = idx;
    }

    const rawFolded = localStorage.getItem(STORAGE_FOLDED_KEY);
    if (rawFolded !== null) isAllFolded = JSON.parse(rawFolded);

    const rawBtnPos = localStorage.getItem(STORAGE_BTN_POS_KEY);
    if (rawBtnPos) {
      const pos = JSON.parse(rawBtnPos);
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        btnX = clampX(pos.x, 80);
        btnY = clampY(pos.y, 36);
        toggleBtn.style.left = btnX + 'px';
        toggleBtn.style.top = btnY + 'px';
      }
    }
  } catch (e) {
    console.warn('[Snippet] LocalStorage load failed:', e);
  }

  function restoreGlobalVisibility() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      initUI();
      return;
    }
    chrome.storage.local
      .get(STORAGE_VISIBLE_KEY)
      .then((data) => {
        if (!uiStarted && data[STORAGE_VISIBLE_KEY] === false) isGlobalHidden = true;
        initUI();
      })
      .catch(() => {
        initUI();
      });
  }

  restoreGlobalVisibility();

  function updatePanelPosition() {
    const rect = toggleBtn.getBoundingClientRect();
    const panelWidth = 270;
    const panelHeight = 260;
    let pLeft = rect.left;
    let pTop = rect.top - panelHeight - 10;
    if (pTop < 10) pTop = rect.bottom + 10;
    pLeft = clampX(pLeft, panelWidth);
    pTop = clampY(pTop, panelHeight);
    panel.style.left = pLeft + 'px';
    panel.style.top = pTop + 'px';
  }

  let isDraggingBtn = false;
  let btnShiftX = 0,
    btnShiftY = 0;
  let startX = 0,
    startY = 0;

  function getCoords(e) {
    if (e.touches && e.touches.length > 0)
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function onBtnMove(e) {
    const c = getCoords(e);
    if (Math.hypot(c.x - startX, c.y - startY) > 5) isDraggingBtn = true;
    if (isDraggingBtn) {
      const rect = toggleBtn.getBoundingClientRect();
      const nx = clampX(c.x - btnShiftX, rect.width);
      const ny = clampY(c.y - btnShiftY, rect.height);
      toggleBtn.style.left = nx + 'px';
      toggleBtn.style.top = ny + 'px';
      if (!panel.classList.contains('snippet_hidden')) updatePanelPosition();
    }
  }

  function onBtnEnd() {
    document.removeEventListener('mousemove', onBtnMove);
    document.removeEventListener('mouseup', onBtnEnd);
    document.removeEventListener('touchmove', onBtnMove);
    document.removeEventListener('touchend', onBtnEnd);
    if (isDraggingBtn) {
      const rect = toggleBtn.getBoundingClientRect();
      saveBtnPos({ x: rect.left, y: rect.top });
    }
  }

  toggleBtn.addEventListener('mousedown', (e) => {
    isDraggingBtn = false;
    const c = getCoords(e);
    startX = c.x;
    startY = c.y;
    const rect = toggleBtn.getBoundingClientRect();
    btnShiftX = c.x - rect.left;
    btnShiftY = c.y - rect.top;
    document.addEventListener('mousemove', onBtnMove);
    document.addEventListener('mouseup', onBtnEnd);
  });

  toggleBtn.addEventListener(
    'touchstart',
    (e) => {
      isDraggingBtn = false;
      const c = getCoords(e);
      startX = c.x;
      startY = c.y;
      const rect = toggleBtn.getBoundingClientRect();
      btnShiftX = c.x - rect.left;
      btnShiftY = c.y - rect.top;
      document.addEventListener('touchmove', onBtnMove, { passive: false });
      document.addEventListener('touchend', onBtnEnd);
    },
    { passive: false },
  );

  let backdrop = null;

  // 顯示面板與遮罩
  function showPanel() {
    panel.classList.remove('snippet_hidden');
    updatePanelPosition();

    // 若遮罩不存在則建立
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'snippet_backdrop';
      Object.assign(backdrop.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '999998',
        backgroundColor: 'transparent',
        cursor: 'default',
      });

      const stopPropagation = (e) => e.stopPropagation();
      backdrop.addEventListener('pointerdown', stopPropagation);
      backdrop.addEventListener('mousedown', stopPropagation);

      backdrop.addEventListener('click', (e) => {
        e.stopPropagation();
        hidePanel();
      });

      rootContainer.appendChild(backdrop);
    }
  }

  // 隱藏面板並移除遮罩
  function hidePanel() {
    panel.classList.add('snippet_hidden');
    if (backdrop) {
      backdrop.remove();
      backdrop = null;
    }
  }

  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    if (!isDraggingBtn) {
      if (panel.classList.contains('snippet_hidden')) {
        showPanel();
      } else {
        hidePanel();
      }
    }
  };

  function autoSize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  function addNoteAtCenter() {
    const noteWidth = 140;
    const noteHeight = 100;
    const x = Math.max(10, (window.innerWidth - noteWidth) / 2);
    const y = Math.max(10, (window.innerHeight - noteHeight) / 2);
    const newNoteData = { x, y, title: '#', text: '', updated: Date.now() };
    pages[currentPageIndex].notes.push(newNoteData);
    createNoteUI(newNoteData);
    saveData();
  }

  addNoteBtn.onclick = addNoteAtCenter;

  function updateFoldStateUI() {
    foldToggleBtn.textContent = isAllFolded ? '展開便條紙' : '摺疊便條紙';
    if (isAllFolded) toggleBtn.classList.add('snippet_btn_folded');
    else toggleBtn.classList.remove('snippet_btn_folded');

    rootContainer.querySelectorAll('.snippet_note').forEach((note) => {
      const titleEl = note.querySelector('h4');
      if (isAllFolded) {
        note.classList.add('snippet_folded');
        if (titleEl) titleEl.contentEditable = 'false';
      } else {
        note.classList.remove('snippet_folded');
        if (titleEl) titleEl.contentEditable = 'true';
        const textarea = note.querySelector('textarea');
        if (textarea) autoSize(textarea);
      }
    });
  }

  foldToggleBtn.onclick = () => {
    isAllFolded = !isAllFolded;
    saveData();
    updateFoldStateUI();
  };

  function createNoteUI(data) {
    const page = pages[currentPageIndex];
    const note = document.createElement('div');
    note.className = 'snippet_note';
    const initialClampedX = clampX(data.x, 140);
    const initialClampedY = clampY(data.y, 100);
    note.style.left = initialClampedX + 'px';
    note.style.top = initialClampedY + 'px';
    note.style.zIndex = ++zIndexCounter;

    const header = document.createElement('div');
    header.className = 'snippet_note_header';
    const titleEl = document.createElement('h4');
    titleEl.textContent = data.title;
    const dragBtn = document.createElement('button');
    dragBtn.className = 'snippet_drag_btn';
    dragBtn.textContent = '-';
    const delBtn = document.createElement('button');
    delBtn.className = 'snippet_delete_btn';
    delBtn.textContent = 'X';

    header.appendChild(titleEl);
    header.appendChild(dragBtn);
    header.appendChild(delBtn);

    const content = document.createElement('div');
    content.className = 'snippet_note_content';
    const textarea = document.createElement('textarea');
    textarea.value = data.text;
    content.appendChild(textarea);

    const timestampEl = document.createElement('div');
    timestampEl.className = 'snippet_timestamp';
    timestampEl.textContent = formatDate(data.updated);

    note.appendChild(header);
    note.appendChild(content);
    note.appendChild(timestampEl);
    rootContainer.appendChild(note);

    if (isAllFolded) {
      note.classList.add('snippet_folded');
      titleEl.contentEditable = 'false';
    } else {
      titleEl.contentEditable = 'true';
    }

    function applyNoteStyles() {
      note.style.backgroundColor = page.colors.bodyBg;
      note.style.color = page.colors.text;
      textarea.style.color = page.colors.text;
      timestampEl.style.color = page.colors.text;
    }
    applyNoteStyles();

    function update() {
      data.updated = Date.now();
      timestampEl.textContent = formatDate(data.updated);
      saveData();
    }

    titleEl.oninput = () => {
      if (!isAllFolded) {
        data.title = titleEl.textContent;
        update();
      }
    };

    textarea.oninput = () => {
      data.text = textarea.value;
      autoSize(textarea);
      update();
    };

    delBtn.onclick = (e) => {
      e.stopPropagation();
      note.remove();
      page.notes = page.notes.filter((n) => n !== data);
      saveData();
    };

    let shiftX, shiftY;
    function onNotePointerMove(e) {
      const coords = getCoords(e);
      const rect = note.getBoundingClientRect();
      const newX = clampX(coords.x - shiftX, rect.width);
      const newY = clampY(coords.y - shiftY, rect.height);
      note.style.left = newX + 'px';
      note.style.top = newY + 'px';
      data.x = newX;
      data.y = newY;
    }

    function onNotePointerEnd() {
      document.removeEventListener('mousemove', onNotePointerMove);
      document.removeEventListener('mouseup', onNotePointerEnd);
      document.removeEventListener('touchmove', onNotePointerMove);
      document.removeEventListener('touchend', onNotePointerEnd);
      saveData();
    }

    function onNotePointerStart(e) {
      // 摺疊時不允許拖曳
      if (isAllFolded) return;
      // 限制：只能透過點擊拖曳按鈕 [-] 來觸發拖曳
      if (e.target !== dragBtn) return;

      const coords = getCoords(e);
      shiftX = coords.x - note.getBoundingClientRect().left;
      shiftY = coords.y - note.getBoundingClientRect().top;
      note.style.zIndex = ++zIndexCounter;

      if (e.type === 'touchstart') {
        document.addEventListener('touchmove', onNotePointerMove, {
          passive: false,
        });
        document.addEventListener('touchend', onNotePointerEnd);
      } else {
        document.addEventListener('mousemove', onNotePointerMove);
        document.addEventListener('mouseup', onNotePointerEnd);
        e.preventDefault();
      }
    }

    // 只將拖曳啟動事件綁定在 dragBtn [-] 上
    dragBtn.addEventListener('mousedown', onNotePointerStart);
    dragBtn.addEventListener('touchstart', onNotePointerStart, {
      passive: false,
    });

    note.ondragstart = () => false;
    autoSize(textarea);
  }

  function renderPage() {
    rootContainer.querySelectorAll('.snippet_note').forEach((n) => n.remove());
    const page = pages[currentPageIndex];
    toggleBtn.textContent = page.title;
    pageTitleInput.value = page.title;

    bindColorPair(textColorText, textColorPicker, page.colors.text, (val) => {
      page.colors.text = val;
      saveData();
      refreshStyles();
    });
    bindColorPair(bodyColorText, bodyColorPicker, page.colors.bodyBg, (val) => {
      page.colors.bodyBg = val;
      saveData();
      refreshStyles();
    });

    page.notes.forEach(createNoteUI);
    updateFoldStateUI();
  }

  function refreshStyles() {
    const page = pages[currentPageIndex];
    rootContainer.querySelectorAll('.snippet_note').forEach((note) => {
      note.style.backgroundColor = page.colors.bodyBg;
      note.style.color = page.colors.text;
      const textarea = note.querySelector('textarea');
      if (textarea) textarea.style.color = page.colors.text;
      const ts = note.querySelector('.snippet_timestamp');
      if (ts) ts.style.color = page.colors.text;
    });
  }

  function bindColorPair(textEl, pickerEl, initVal, onChange) {
    textEl.value = initVal;
    pickerEl.value = isValidHex(initVal) ? initVal : '#000000';
    textEl.oninput = () => {
      const val = textEl.value;
      if (isValidHex(val)) {
        pickerEl.value = val;
        onChange(val);
      }
    };
    pickerEl.oninput = () => {
      const val = pickerEl.value;
      textEl.value = val;
      onChange(val);
    };
  }

  function isValidHex(hex) {
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
  }

  exportBtn.onclick = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(pages, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `snippet_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  importBtn.onclick = () => {
    fileInput.click();
  };

  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedPages = JSON.parse(event.target.result);
        if (Array.isArray(importedPages) && importedPages.length > 0) {
          if (confirm('匯入備份將會覆蓋現有的便條紙資料，確定繼續嗎？')) {
            pages = importedPages;
            currentPageIndex = 0;
            saveData();
            renderPage();
            alert('成功匯入便條紙備份！');
          }
        } else alert('匯入的 JSON 檔案格式不正確！');
      } catch (err) {
        alert('解析 JSON 檔案失敗。');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  };

  pageTitleInput.oninput = (e) => {
    const val = e.target.value;
    pages[currentPageIndex].title = val;
    toggleBtn.textContent = val;
    saveData();
  };

  prevBtn.onclick = () => {
    currentPageIndex = (currentPageIndex - 1 + pages.length) % pages.length;
    saveData();
    renderPage();
  };

  nextBtn.onclick = () => {
    currentPageIndex = (currentPageIndex + 1) % pages.length;
    saveData();
    renderPage();
  };

  addPageBtn.onclick = () => {
    const newPage = {
      title: '# ' + (pages.length + 1),
      notes: [],
      colors: { text: '#000000', bodyBg: '#fffd88' },
    };
    pages.push(newPage);
    currentPageIndex = pages.length - 1;
    saveData();
    renderPage();
  };

  clearPageBtn.onclick = () => {
    if (pages.length <= 1) return alert('最少需要保留一個頁面！');
    if (confirm(`確定要刪除「${pages[currentPageIndex].title}」頁面嗎？`)) {
      pages.splice(currentPageIndex, 1);
      if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;
      saveData();
      renderPage();
    }
  };

  // 圖示開關：狀態由 background 寫入 chrome.storage.local，此處套用並跨分頁同步
  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    chrome.runtime.onMessage
  ) {
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'set_visible') {
        setExtensionVisible(!!request.visible);
        return;
      }
      if (request.action === 'toggle_extension') {
        setExtensionVisible(isGlobalHidden);
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_VISIBLE_KEY]) return;
      const next = changes[STORAGE_VISIBLE_KEY].newValue;
      if (typeof next === 'boolean') setExtensionVisible(next);
    });
  }

  window.addEventListener('resize', () => {
    const activePage = pages[currentPageIndex];
    const noteEls = rootContainer.querySelectorAll('.snippet_note');
    noteEls.forEach((noteEl, index) => {
      const noteData = activePage.notes[index];
      if (noteData) {
        const rect = noteEl.getBoundingClientRect();
        noteEl.style.left = clampX(noteData.x, rect.width) + 'px';
        noteEl.style.top = clampY(noteData.y, rect.height) + 'px';
      }
    });
    const btnRect = toggleBtn.getBoundingClientRect();
    toggleBtn.style.left = clampX(btnRect.left, btnRect.width) + 'px';
    toggleBtn.style.top = clampY(btnRect.top, btnRect.height) + 'px';
  });

  window.addEventListener('beforeunload', saveData);
})();
