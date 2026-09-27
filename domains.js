/**
 * Pure tab-grouping and ordering logic.
 *
 * No chrome.* usage here on purpose: every function is deterministic and unit
 * testable with plain objects shaped like `chrome.tabs.Tab` ({ id, index,
 * url, pinned, active }).
 */

/**
 * Grouping key for a URL. Web pages only, `www.` normalised away.
 *
 * @param {unknown} rawUrl
 * @returns {string|null} host, or null for anything that is not http(s)
 */
export function urlDomain(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl === '') return null;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  return host === '' ? null : host;
}

/**
 * @param {{url?: string}} tab
 * @returns {string|null}
 */
export function tabDomain(tab) {
  return urlDomain(tab?.url);
}

/**
 * @param {string|null} domain
 * @param {Array<{url?: string}>} tabs
 */
export function tabsMatchingDomain(domain, tabs) {
  if (!domain) return [];
  return tabs.filter((tab) => tabDomain(tab) === domain);
}

/** @param {Array<{index: number}>} tabs */
export function sortByIndex(tabs) {
  return [...tabs].sort((a, b) => a.index - b.index);
}

/** @param {Array<{index: number}>} tabs */
export function idsByIndex(tabs) {
  return sortByIndex(tabs).map((tab) => tab.id);
}

/**
 * Bucket tabs by domain. Tabs without a web domain become singletons keyed by
 * tab id so they keep their relative placement instead of merging together.
 *
 * @returns {Map<string, Array<{id: number}>>}
 */
export function groupByDomain(tabs) {
  const groups = new Map();
  for (const tab of sortByIndex(tabs)) {
    const key = tabDomain(tab) ?? `tab:${tab.id}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(tab);
    else groups.set(key, [tab]);
  }
  return groups;
}

/**
 * Target order for "gather around": same-domain tabs pack tightly against the
 * active tab, everything else is pushed outward. Pinned tabs stay pinned-first.
 *
 * @param {Array<object>} tabs all tabs in the window
 * @param {number} activeId
 * @returns {number[]} target tab order
 */
export function gatherAroundOrder(tabs, activeId) {
  const sorted = sortByIndex(tabs);
  const ids = sorted.map((tab) => tab.id);
  const active = sorted.find((tab) => tab.id === activeId);
  if (!active) return ids;

  const domain = tabDomain(active);
  if (!domain) return ids;

  const domainById = new Map(sorted.map((tab) => [tab.id, tabDomain(tab)]));
  const pinned = sorted.filter((tab) => tab.pinned).map((tab) => tab.id);
  const pinnedSet = new Set(pinned);
  const unpinned = ids.filter((id) => !pinnedSet.has(id));
  const at = unpinned.indexOf(activeId);
  if (at === -1) return ids;

  const matches = (id) => domainById.get(id) === domain;
  const before = unpinned.slice(0, at);
  const after = unpinned.slice(at + 1);

  return [
    ...pinned,
    ...before.filter((id) => !matches(id)),
    ...before.filter(matches),
    activeId,
    ...after.filter(matches),
    ...after.filter((id) => !matches(id)),
  ];
}

/**
 * Target order for "gather all": pinned tabs first, then unpinned tabs grouped
 * by domain, groups ordered by first appearance.
 */
export function gatherAllOrder(tabs) {
  const sorted = sortByIndex(tabs);
  const pinned = [];
  const unpinned = [];
  for (const tab of sorted) (tab.pinned ? pinned : unpinned).push(tab);

  const order = [];
  for (const bucket of groupByDomain(unpinned).values()) {
    for (const tab of bucket) order.push(tab.id);
  }
  return [...pinned.map((tab) => tab.id), ...order];
}

/** Directions understood by {@link moveOrder}. */
export const MOVE_DIRECTIONS = ['left', 'right', 'start', 'end'];

/**
 * Target order after moving the selection one step.
 *
 * The selection is treated as a single block inside its region (pinned or
 * unpinned): it shifts one slot and wraps to the opposite edge of the region
 * when it already sits at the boundary. Single-tab selections — the normal
 * shortcut case — behave exactly like a one-step tab move.
 *
 * @param {Array<object>} tabs all tabs in the window
 * @param {Iterable<number>} selectedIds
 * @param {'left'|'right'|'start'|'end'} direction
 * @returns {number[]} target tab order
 */
export function moveOrder(tabs, selectedIds, direction) {
  const sorted = sortByIndex(tabs);
  const ids = sorted.map((tab) => tab.id);
  const selected = new Set(selectedIds);
  if (selected.size === 0) return ids;

  const pinned = sorted.filter((tab) => tab.pinned).map((tab) => tab.id);
  const pinnedSet = new Set(pinned);
  const unpinned = ids.filter((id) => !pinnedSet.has(id));

  const pinnedSel = new Set(pinned.filter((id) => selected.has(id)));
  const unpinnedSel = new Set(unpinned.filter((id) => selected.has(id)));

  return [
    ...shiftRegion(pinned, pinnedSel, direction),
    ...shiftRegion(unpinned, unpinnedSel, direction),
  ];
}

/**
 * Minimal ordered move list turning `currentIds` into `targetIds`, mirroring
 * chrome.tabs.move insert semantics (remove, then splice at index).
 *
 * @param {number[]} currentIds
 * @param {number[]} targetIds
 * @returns {Array<{id: number, index: number}>}
 */
export function computeMoves(currentIds, targetIds) {
  const sim = [...currentIds];
  const moves = [];
  for (let i = 0; i < targetIds.length; i++) {
    const want = targetIds[i];
    const at = sim.indexOf(want);
    if (at === -1 || at === i) continue;
    sim.splice(at, 1);
    sim.splice(i, 0, want);
    moves.push({ id: want, index: i });
  }
  return moves;
}

function shiftRegion(region, sel, direction) {
  if (region.length === 0) return region.slice();
  const block = region.filter((id) => sel.has(id));
  if (block.length === 0) return region.slice();

  const rest = region.filter((id) => !sel.has(id));
  const first = region.findIndex((id) => sel.has(id));

  switch (direction) {
    case 'start':
      return [...block, ...rest];
    case 'end':
      return [...rest, ...block];
    case 'left':
      return insertAt(rest, block, first === 0 ? rest.length : first - 1);
    case 'right':
      return insertAt(rest, block, first + 1 > rest.length ? 0 : first + 1);
    default:
      return region.slice();
  }
}

function insertAt(rest, block, index) {
  return [...rest.slice(0, index), ...block, ...rest.slice(index)];
}
