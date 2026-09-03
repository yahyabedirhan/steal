// Service worker: owns the toolbar action, injects the content script on demand,
// and keeps the "ON" badge in sync with per-tab inspect-mode state.

const activeTabs = new Set(); // tab ids where inspect mode is currently on

const BADGE_TEXT = "ON";
const BADGE_COLOR = "#1a73e8";

async function setBadge(tabId, on) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    await chrome.action.setBadgeText({ tabId, text: on ? BADGE_TEXT : "" });
  } catch (e) {
    // Tab may have closed; ignore.
  }
}

async function ensureInjected(tabId) {
  // Injecting twice is safe: content.js guards against double init. But we still
  // avoid the redundant work when we can.
  await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["lib/dom-nav.js", "content.js"],
  });
}

async function toggleOnTab(tab) {
  if (!tab || tab.id == null) return;
  const tabId = tab.id;
  try {
    await ensureInjected(tabId);
    await chrome.tabs.sendMessage(tabId, { type: "inspect:toggle" });
  } catch (e) {
    // Most common cause: a restricted page (chrome://, the Web Store, PDF viewer)
    // where content scripts cannot run.
    console.warn("Steal: cannot run on this page.", e);
  }
}

// Toolbar icon.
chrome.action.onClicked.addListener((tab) => toggleOnTab(tab));

// Keyboard shortcut (default Alt+Shift+S, rebindable at
// chrome://extensions/shortcuts). Chrome passes the active tab on newer
// versions; fall back to querying it.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "toggle-steal") return;
  if (!tab) {
    [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  }
  toggleOnTab(tab);
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null || !msg || typeof msg.type !== "string") return;

  if (msg.type === "inspect:started") {
    activeTabs.add(tabId);
    setBadge(tabId, true);
  } else if (msg.type === "inspect:ended") {
    activeTabs.delete(tabId);
    setBadge(tabId, false);
  }
});

// The injected script does not survive a navigation, so clear our state when the
// page reloads or navigates.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
    setBadge(tabId, false);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});
