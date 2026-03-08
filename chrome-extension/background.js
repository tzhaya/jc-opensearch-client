// ツールバーアイコンクリックでサイドパネルを開く
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// fetch 代行メッセージハンドラ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'fetch') return false;

  (async () => {
    try {
      const res = await fetch(message.url);
      if (!res.ok) {
        sendResponse({ error: `HTTP ${res.status}: ${res.statusText}` });
        return;
      }
      const text = await res.text();
      sendResponse({ text });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();

  return true; // 非同期レスポンスを示す
});
