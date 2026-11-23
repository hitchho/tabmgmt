/**
 * Service worker: chrome.* side of tabmgmt.
 *
 * All ordering decisions live in ./domains.js (pure, tested). This file only
 * reads window state, applies the computed order, and handles the close/undo
 * bookkeeping.
 */

import {
  computeMoves,
  gatherAllOrder,
  gatherAroundOrder,
  idsByIndex,
  moveOrder,
  tabDomain,
} from './domains.js';

const UNDO_KEY = 'lastClosed';

/** @returns {Promise<chrome.tabs.Tab[]>} every tab in the current window */
function currentWindowTabs() {
  return chrome.tabs.query({ currentWindow: true });
}

/**
 * Apply a computed target order with the minimum number of chrome.tabs.move
 * calls. Failures (tab closed mid-flight) are logged and skipped so one stale
 * id cannot abort the whole rearrangement.
 *
 * @param {chrome.tabs.Tab[]} tabs
 * @param {number[]} targetIds
 */
async function applyOrder(tabs, targetIds) {
  const moves = computeMoves(idsByIndex(tabs), targetIds);
  for (const { id, index } of moves) {
    try {
      await chrome.tabs.move(id, { index });
    } catch (err) {
      console.warn('tabmgmt: move failed', { id, index }, err);
    }
  }
}

/** @returns {chrome.tabs.Tab|undefined} */
function activeTab(tabs) {
  return tabs.find((tab) => tab.active);
}

/**
 * Close every non-active, non-pinned, non-audible tab sharing the active tab's domain.
 *
 * @returns {Promise<{closed: number, domain: string|null, reason?: string}>}
 */
async function closeDomainTabs() {
  const tabs = await currentWindowTabs();
  const active = activeTab(tabs);
  const domain = tabDomain(active);
  if (!active || !domain) return { closed: 0, domain: null, reason: 'unsupported-url' };

  // Pinned and audible tabs are deliberately kept.
  const victims = tabs.filter(
    (tab) => !tab.active && !tab.pinned && !tab.audible && tabDomain(tab) === domain,
  );
  if (victims.length === 0) return { closed: 0, domain };

  await rememberClosed(victims);
  try {
    await chrome.tabs.remove(victims.map((tab) => tab.id));
  } catch (err) {
    console.warn('tabmgmt: close failed', err);
  }
  return { closed: victims.length, domain };
}

/**
 * Bring a same-domain group together. `all` groups the whole window by domain.
 *
 * @param {boolean} all
 */
async function gatherTabs(all) {
  const tabs = await currentWindowTabs();
  const active = activeTab(tabs);
  const target = all
    ? gatherAllOrder(tabs)
    : active
      ? gatherAroundOrder(tabs, active.id)
      : idsByIndex(tabs);
  await applyOrder(tabs, target);
}

/**
 * Move the highlighted tab(s) one step.
 *
 * @param {'left'|'right'|'start'|'end'} direction
 */
async function moveTabs(direction) {
  const tabs = await currentWindowTabs();
  const selected = tabs.filter((tab) => tab.highlighted || tab.active).map((tab) => tab.id);
  await applyOrder(tabs, moveOrder(tabs, selected, direction));
}

/**
 * Persist the most recent close batch so the popup can offer an undo.
 *
 * @param {chrome.tabs.Tab[]} tabs
 */
async function rememberClosed(tabs) {
  const records = tabs
    .filter((tab) => tabDomain(tab)) // non-web URLs cannot be recreated
    .map((tab) => ({
      url: tab.url,
      pinned: Boolean(tab.pinned),
      index: tab.index,
      windowId: tab.windowId,
    }));
  await chrome.storage.session.set({ [UNDO_KEY]: records });
}

/**
 * Reopen the tabs remembered by the last close.
 *
 * @returns {Promise<{restored: number, attempted: number}>}
 */
async function undoClose() {
  const { [UNDO_KEY]: records = [] } = await chrome.storage.session.get(UNDO_KEY);
  if (!Array.isArray(records) || records.length === 0) return { restored: 0, attempted: 0 };

  await chrome.storage.session.remove(UNDO_KEY);

  let restored = 0;
  for (const record of records) {
    const base = { url: record.url, index: record.index, pinned: record.pinned, active: false };
    try {
      await chrome.tabs.create({ ...base, windowId: record.windowId });
      restored++;
    } catch {
      // Original window is gone; fall back to the current one.
      try {
        await chrome.tabs.create(base);
        restored++;
      } catch (err) {
        console.warn('tabmgmt: undo failed', record.url, err);
      }
    }
  }
  return { restored, attempted: records.length };
}

const MOVE_COMMANDS = {
  'move-tab-left': 'left',
  'move-tab-right': 'right',
  'move-tab-start': 'start',
  'move-tab-end': 'end',
};

const DOMAIN_COMMANDS = {
  'close-tabs': closeDomainTabs,
  'gather-tabs': () => gatherTabs(false),
  'gather-tabs-all': () => gatherTabs(true),
};

/**
 * Commands run one at a time: overlapping runs (a held-down shortcut) would
 * compute moves from stale tab indices and scramble the order.
 */
let queue = Promise.resolve();

/** @param {string} cmd */
function handleCommand(cmd) {
  const run = queue.then(() => runCommand(cmd));
  queue = run.catch(() => {});
  return run;
}

/**
 * @param {string} cmd
 * @returns {Promise<{ok: boolean, [key: string]: unknown}>}
 */
async function runCommand(cmd) {
  try {
    if (Object.hasOwn(MOVE_COMMANDS, cmd)) {
      await moveTabs(MOVE_COMMANDS[cmd]);
      return { ok: true };
    }
    if (Object.hasOwn(DOMAIN_COMMANDS, cmd)) {
      return { ok: true, ...(await DOMAIN_COMMANDS[cmd]()) };
    }
    if (cmd === 'undo-close') {
      return { ok: true, ...(await undoClose()) };
    }
    return { ok: false, error: `unknown command: ${cmd}` };
  } catch (err) {
    console.error('tabmgmt: command failed', cmd, err);
    return { ok: false, error: String(err?.message ?? err) };
  }
}

chrome.commands.onCommand.addListener((cmd) => {
  void handleCommand(cmd);
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request || typeof request.cmd !== 'string') return false;
  handleCommand(request.cmd).then(sendResponse);
  return true; // keep the channel open for the async reply
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`tabmgmt: ${details.reason}`);
});
