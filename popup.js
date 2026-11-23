/**
 * Popup controller.
 *
 * Renders version + live context (domain + sibling count), wires buttons to the
 * service worker, shows shortcut bindings as tooltips, and offers undo.
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
    'close-label',
    'status',
    'undo-row',
    'undo-label',
    'open-shortcuts',
    'version',
    'window-count',
    'domain',
    'sibling-count',
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

/** Show each command's binding as a hover tooltip instead of a badge. */
async function applyShortcutTooltips() {
  let commands = [];
  try {
    commands = await chrome.commands.getAll();
  } catch {
    return;
  }
  for (const { name, shortcut } of commands) {
    const button = $(name);
    if (!button || !shortcut) continue;
    const base = button.title || button.textContent.trim();
    button.title = `${base} (${shortcut})`;
  }
}

/** Scroll the domain back and forth when it is wider than the readout. */
function rollIfOverflowing() {
  const box = $('domain-box');
  const overflow = el.domain.scrollWidth - box.clientWidth;
  box.classList.toggle('roll', overflow > 0);
  if (overflow > 0) {
    box.style.setProperty('--roll-by', `-${overflow}px`);
    box.style.setProperty('--roll-time', `${Math.max(3, overflow / 15)}s`);
  }
}

async function refreshContext() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const active = tabs.find((tab) => tab.active);
  const domain = urlDomain(active?.url);

  sameDomainCount = domain
    ? tabs.filter((tab) => !tab.active && !tab.pinned && !tab.audible && urlDomain(tab.url) === domain).length
    : 0;

  el['window-count'].textContent = `${tabs.length} tabs`;
  el.domain.textContent = domain ?? '— no web domain —';
  rollIfOverflowing();
  el['sibling-count'].textContent = domain ? `${sameDomainCount} same` : '';

  const closeButton = $('close-tabs');
  const closeLabel = sameDomainCount === 0
    ? 'Close Domain Tabs'
    : `Close ${sameDomainCount} Tab${sameDomainCount === 1 ? '' : 's'}`;
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
    ? `Undo (${undoCount})`
    : 'Undo';
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

  el.version.textContent = `v${chrome.runtime.getManifest().version}`;

  Promise.all([refreshContext(), refreshUndo(), applyShortcutTooltips()]).catch((err) => {
    setStatus(`Init failed: ${err?.message ?? err}`, 'error');
  });
}

document.addEventListener('DOMContentLoaded', initPopup);
