const VISIBLE_KEY = 'snippet_ui_visible';

async function getVisible() {
  const data = await chrome.storage.local.get(VISIBLE_KEY);
  return data[VISIBLE_KEY] !== false;
}

chrome.action.onClicked.addListener(async (tab) => {
  const next = !(await getVisible());
  await chrome.storage.local.set({ [VISIBLE_KEY]: next });
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'set_visible', visible: next });
  } catch {
    /* chrome:// 等無法注入的頁：狀態已寫入，下次一般網頁會套用 */
  }
});
