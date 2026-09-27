import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeMoves,
  gatherAllOrder,
  gatherAroundOrder,
  groupByDomain,
  moveOrder,
  tabDomain,
  tabsMatchingDomain,
  urlDomain,
} from '../domains.js';

/** Build minimal chrome.tabs.Tab-shaped objects from [id, url] pairs. */
function tabs(...specs) {
  return specs.map(([id, url, extra = {}], index) => ({ id, index, url, pinned: false, active: false, ...extra }));
}

function order(tabList, target) {
  // Simulate chrome.tabs.move insert semantics to prove target order is reachable.
  const sim = tabList.map((tab) => tab.id);
  for (const { id, index } of computeMoves(sim, target)) {
    const at = sim.indexOf(id);
    sim.splice(at, 1);
    sim.splice(index, 0, id);
  }
  return sim;
}

test('urlDomain groups only web pages, normalising www', () => {
  assert.equal(urlDomain('https://example.com/a?b=1'), 'example.com');
  assert.equal(urlDomain('http://example.com'), 'example.com');
  assert.equal(urlDomain('https://www.example.com'), 'example.com');
  assert.equal(urlDomain('https://WWW.Example.COM'), 'example.com');
  assert.equal(urlDomain('https://sub.example.com'), 'sub.example.com');
  assert.equal(urlDomain('https://example.com:8443/x'), 'example.com');
});

test('urlDomain rejects everything that is not http(s)', () => {
  assert.equal(urlDomain('chrome://extensions'), null);
  assert.equal(urlDomain('chrome-extension://abc/popup.html'), null);
  assert.equal(urlDomain('file:///home/user/notes.md'), null);
  assert.equal(urlDomain('about:blank'), null);
  assert.equal(urlDomain('view-source:https://example.com'), null);
  assert.equal(urlDomain(''), null);
  assert.equal(urlDomain(undefined), null);
  assert.equal(urlDomain(null), null);
  assert.equal(urlDomain('not a url'), null);
  assert.equal(urlDomain('https://'), null);
});

test('tabDomain tolerates tabs without a url', () => {
  assert.equal(tabDomain({ id: 1 }), null);
  assert.equal(tabDomain({ id: 1, url: 'https://example.com' }), 'example.com');
});

test('tabsMatchingDomain matches by normalised host and ignores the active flag', () => {
  const list = tabs(
    [1, 'https://example.com/a'],
    [2, 'https://www.example.com/b'],
    [3, 'https://other.com'],
    [4, 'chrome://newtab'],
  );
  assert.deepEqual(tabsMatchingDomain('example.com', list).map((t) => t.id), [1, 2]);
  assert.deepEqual(tabsMatchingDomain(null, list), []);
});

test('groupByDomain keeps first-appearance order and singletons non-web tabs', () => {
  const list = tabs(
    [1, 'https://b.com'],
    [2, 'https://a.com'],
    [3, 'https://b.com'],
    [4, 'chrome://newtab'],
    [5, 'chrome://settings'],
  );
  const groups = [...groupByDomain(list).values()].map((bucket) => bucket.map((t) => t.id));
  assert.deepEqual(groups, [[1, 3], [2], [4], [5]]);
});

test('gatherAroundOrder packs siblings against the active tab', () => {
  const list = tabs(
    [1, 'https://a.com'],
    [2, 'https://target.com'],
    [3, 'https://b.com'],
    [4, 'https://target.com', { active: true }],
    [5, 'https://c.com'],
    [6, 'https://www.target.com'],
  );
  // active tab id 4; siblings 2 and 6
  assert.deepEqual(gatherAroundOrder(list, 4), [1, 3, 2, 4, 6, 5]);
});

test('gatherAroundOrder is a no-op without a usable domain', () => {
  const list = tabs([1, 'chrome://newtab', { active: true }], [2, 'https://a.com']);
  assert.deepEqual(gatherAroundOrder(list, 1), [1, 2]);
});

test('gatherAroundOrder keeps pinned tabs pinned-first', () => {
  const list = tabs(
    [1, 'https://pinned.com', { pinned: true }],
    [2, 'https://target.com'],
    [3, 'https://a.com'],
    [4, 'https://target.com', { active: true }],
    [5, 'https://target.com'],
  );
  assert.deepEqual(gatherAroundOrder(list, 4), [1, 3, 2, 4, 5]);
});

test('gatherAllOrder keeps pinned first then groups unpinned by domain', () => {
  const list = tabs(
    [1, 'https://pinned.com', { pinned: true }],
    [2, 'https://b.com'],
    [3, 'https://a.com'],
    [4, 'https://b.com'],
    [5, 'https://a.com'],
    [6, 'chrome://newtab'],
  );
  assert.deepEqual(gatherAllOrder(list), [1, 2, 4, 3, 5, 6]);
});

test('moveOrder shifts a single unpinned tab and wraps at the edges', () => {
  const list = tabs([1, 'https://a.com'], [2, 'https://b.com'], [3, 'https://c.com']);
  assert.deepEqual(moveOrder(list, [2], 'left'), [2, 1, 3]);
  assert.deepEqual(moveOrder(list, [2], 'right'), [1, 3, 2]);
  assert.deepEqual(moveOrder(list, [1], 'left'), [2, 3, 1]); // wraps to end
  assert.deepEqual(moveOrder(list, [3], 'right'), [3, 1, 2]); // wraps to start
  assert.deepEqual(moveOrder(list, [3], 'start'), [3, 1, 2]);
  assert.deepEqual(moveOrder(list, [1], 'end'), [2, 3, 1]);
});

test('moveOrder respects the pinned region boundary', () => {
  const list = tabs(
    [1, 'https://p1.com', { pinned: true }],
    [2, 'https://p2.com', { pinned: true }],
    [3, 'https://a.com'],
    [4, 'https://b.com'],
  );
  // first unpinned cannot cross into pinned space — wraps within unpinned only
  assert.deepEqual(moveOrder(list, [3], 'left'), [1, 2, 4, 3]);
  // pinned tab wraps within pinned region only
  assert.deepEqual(moveOrder(list, [2], 'right'), [2, 1, 3, 4]);
  assert.deepEqual(moveOrder(list, [3], 'start'), [1, 2, 3, 4]);
  assert.deepEqual(moveOrder(list, [4], 'end'), [1, 2, 3, 4]);
});

test('moveOrder moves a multi-tab selection as one block', () => {
  const list = tabs([1, 'https://a.com'], [2, 'https://b.com'], [3, 'https://c.com'], [4, 'https://d.com']);
  assert.deepEqual(moveOrder(list, [2, 3], 'right'), [1, 4, 2, 3]);
  assert.deepEqual(moveOrder(list, [2, 3], 'left'), [2, 3, 1, 4]);
  assert.deepEqual(moveOrder(list, [3, 4], 'right'), [3, 4, 1, 2]); // wraps as a block
});

test('moveOrder with an empty selection is a no-op', () => {
  const list = tabs([1, 'https://a.com'], [2, 'https://b.com']);
  assert.deepEqual(moveOrder(list, [], 'left'), [1, 2]);
  assert.deepEqual(moveOrder(list, [99], 'left'), [1, 2]);
});

test('computeMoves is minimal and reaches the target order', () => {
  assert.deepEqual(computeMoves([1, 2, 3], [1, 2, 3]), []);
  assert.deepEqual(computeMoves([1, 2, 3], [3, 1, 2]), [{ id: 3, index: 0 }]);
  assert.deepEqual(computeMoves([1, 2, 3, 4], [2, 1, 3, 4]), [{ id: 2, index: 0 }]);
  assert.deepEqual(computeMoves([1, 2], [1, 2, 3]), []); // unknown ids ignored
});

test('computed orders are actually reachable via chrome.tabs.move', () => {
  const list = tabs(
    [1, 'https://a.com'],
    [2, 'https://b.com'],
    [3, 'https://a.com'],
    [4, 'https://c.com'],
    [5, 'https://a.com', { active: true }],
  );
  for (const target of [
    gatherAroundOrder(list, 5),
    gatherAllOrder(list),
    moveOrder(list, [2, 4], 'left'),
    moveOrder(list, [1], 'right'),
  ]) {
    assert.deepEqual(order(list, target), target);
  }
});
