/**
 * Popup controller.
 *
 * Renders live context (domain + sibling count), wires buttons to the service
 * worker, surfaces shortcut bindings, and offers undo after a close.
 */

import { urlDomain } from './domains.js';

const UNDO_KEY = 'lastClosed';

/** @type {Record<string, HTMLElement>} */
const el = {};

let sameDomainCount = 0;
let undoCount = 0;
let busy = false;

function $(id) {
  return document.getElementById(id);
}

function cacheElements() {
  for (const id of [
    'window-count',
    'domain',
    'sibling-count',
    'close-label',
    'status',
    'undo-row',
    'undo-label',
    'open-shortcuts',
  ]) {
    el[id] = $(id);
  }
}

function setStatus(message, tone = 'info') {
  el.status.textContent = message;
  el.status.dataset.tone = tone;
}

/**
 * @param {string} cmd
 * @returns {Promise<Record<string, unknown>>}
 */
async function sendCommand(cmd) {
  try {
    return (await chrome.runtime.sendMessage({ cmd })) ?? { ok: false, error: 'no response' };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) };
  }
}

async function applyShortcutBadges() {
  let commands = [];
  try {
    commands = await chrome.commands.getAll();
  } catch {
    return;
  }
  for (const command of commands) {
    const badge = document.querySelector(`[data-shortcut="${command.name}"]`);
    if (badge && command.shortcut) badge.textContent = command.shortcut;
  }
}

async function refreshContext() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const active = tabs.find((tab) => tab.active);
  const domain = urlDomain(active?.url);

  sameDomainCount = domain
    ? tabs.filter((tab) => !tab.active && !tab.pinned && !tab.audible && urlDomain(tab.url) === domain).length
    : 0;

  el['window-count'].textContent = `${tabs.length} tab${tabs.length === 1 ? '' : 's'}`;
  el.domain.textContent = domain ?? 'no web domain';
  el['sibling-count'].textContent = domain
    ? `· ${sameDomainCount} sibling${sameDomainCount === 1 ? '' : 's'}`
    : '';

  const closeButton = $('close-tabs');
  const closeLabel = sameDomainCount === 0
    ? 'No sibling tabs'
    : `Close ${sameDomainCount} tab${sameDomainCount === 1 ? '' : 's'}`;
  el['close-label'].textContent = closeLabel;
  closeButton.disabled = sameDomainCount === 0 || !domain;
}

async function refreshUndo() {
  let records = [];
  try {
    ({ [UNDO_KEY]: records = [] } = await chrome.storage.session.get(UNDO_KEY));
  } catch {
    records = [];
  }
  undoCount = Array.isArray(records) ? records.length : 0;
  el['undo-row'].hidden = undoCount === 0;
  el['undo-label'].textContent = undoCount
    ? `Undo close (${undoCount} tab${undoCount === 1 ? '' : 's'})`
    : 'Undo close';
}

const MOVE_COMMANDS = new Set(['move-tab-left', 'move-tab-right', 'move-tab-start', 'move-tab-end']);

/**
 * Run a command. Moves stay silent and keep the popup open so they can be
 * clicked repeatedly (the service worker queues them). Everything else closes
 * the popup on success. Only errors are shown.
 *
 * @param {string} cmd
 */
async function runCommand(cmd) {
  const isMove = MOVE_COMMANDS.has(cmd);
  if (!isMove) {
    if (busy) return;
    busy = true;
  }

  const result = await sendCommand(cmd);
  if (!isMove) busy = false;

  if (!result.ok) {
    setStatus(`Failed: ${result.error ?? 'unknown error'}`, 'error');
    await refreshUndo();
    return;
  }
  if (isMove) return;
  window.close();
}

function openShortcuts(event) {
  event.preventDefault();
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
}

function handleKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const shortcuts = { c: 'close-tabs', g: 'gather-tabs', a: 'gather-tabs-all', u: 'undo-close' };
  const cmd = shortcuts[event.key.toLowerCase()];
  if (!cmd) return;
  const button = $(cmd);
  if (!button || button.disabled) return;
  event.preventDefault();
  runCommand(cmd);
}

function initPopup() {
  cacheElements();

  for (const button of document.querySelectorAll('button[id]')) {
    button.addEventListener('click', () => runCommand(button.id));
  }
  document.addEventListener('keydown', handleKeydown);
  el['open-shortcuts'].addEventListener('click', openShortcuts);

  Promise.all([refreshContext(), refreshUndo(), applyShortcutBadges()]).catch((err) => {
    setStatus(`Init failed: ${err?.message ?? err}`, 'error');
  });
}

document.addEventListener('DOMContentLoaded', initPopup);
