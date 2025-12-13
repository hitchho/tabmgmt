// Domain helpers
function getDomain(tab) {
  var url = new URL(tab.url);
  return url.origin + "/*";
}

function tabsMatchingDomain(domain, tabs) {
  var matching = [];
  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    if (getDomain(tab) === domain) {
      matching.push(tab);
    }
  }
  return matching;
}

function separateActiveFromInactive(tabs) {
  var inactiveTabs = [];
  var activeTab;
  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    if (tab.active) {
      activeTab = tab;
    } else {
      inactiveTabs.push(tab);
    }
  }
  return { activeTab: activeTab, inactiveTabs: inactiveTabs };
}

// Domain tab operations
function closeTabs(tabs) {
  for (var i = 0; i < tabs.length; i++) {
    chrome.tabs.remove(tabs[i].id);
  }
}

function gatherTabs(tabs, activeTabIndex) {
  var leftTabs = [];
  var rightIdx = 1;

  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    if (tab.index < activeTabIndex) {
      leftTabs.push(tab.id);
    } else {
      chrome.tabs.move(tab.id, { index: activeTabIndex + rightIdx });
      rightIdx++;
    }
  }

  for (var i = leftTabs.length - 1, decrement = 1; i >= 0; i--, decrement++) {
    chrome.tabs.move(leftTabs[i], { index: activeTabIndex - decrement });
  }
}

function gatherTabsAll(tabs) {
  var idx = tabs[0].index;
  var seenDomains = new Set();

  for (var i = 0; i < tabs.length; i++) {
    var tab = tabs[i];
    var domain = getDomain(tab);

    if (!seenDomains.has(domain)) {
      var matching = tabsMatchingDomain(domain, tabs);
      for (var j = 0; j < matching.length; j++) {
        chrome.tabs.move(matching[j].id, { index: idx });
        idx += 1;
      }
      seenDomains.add(domain);
    }
  }
}

// Tab movement operations
async function moveTabsLeft(tabs, pinnedTabs, unpinnedTabs) {
  for (const tab of tabs) {
    const minIndex = tab.pinned ? 0 : pinnedTabs.length;
    let newIndex = tab.index - 1;

    if (newIndex < minIndex) {
      newIndex = tab.pinned ? pinnedTabs.length - 1 : pinnedTabs.length + unpinnedTabs.length - 1;
    }

    await chrome.tabs.move(tab.id, { index: newIndex });
  }
}

async function moveTabsRight(tabs, pinnedTabs, unpinnedTabs, totalTabs) {
  for (let i = tabs.length - 1; i >= 0; i--) {
    const tab = tabs[i];
    const maxIndex = tab.pinned ? pinnedTabs.length - 1 : totalTabs - 1;
    let newIndex = tab.index + 1;

    if (newIndex > maxIndex) {
      newIndex = tab.pinned ? 0 : pinnedTabs.length;
    }

    await chrome.tabs.move(tab.id, { index: newIndex });
  }
}

async function moveTabsToStart(tabs, pinnedTabs) {
  let insertIndex = tabs[0].pinned ? 0 : pinnedTabs.length;

  for (const tab of tabs) {
    await chrome.tabs.move(tab.id, { index: insertIndex });
    insertIndex++;
  }
}

async function moveTabsToEnd(tabs, pinnedTabs, totalTabs) {
  for (const tab of tabs) {
    const endIndex = tab.pinned ? pinnedTabs.length - 1 : totalTabs - 1;
    await chrome.tabs.move(tab.id, { index: endIndex });
  }
}

async function handleMoveCommand(cmd) {
  const tabs = await chrome.tabs.query({ highlighted: true, currentWindow: true });
  if (tabs.length === 0) return;

  tabs.sort((a, b) => a.index - b.index);

  const currentWindow = await chrome.windows.getCurrent();
  const allTabs = await chrome.tabs.query({ windowId: currentWindow.id });

  const pinnedTabs = allTabs.filter(t => t.pinned);
  const unpinnedTabs = allTabs.filter(t => !t.pinned);

  switch (cmd) {
    case 'move-tab-left':
      await moveTabsLeft(tabs, pinnedTabs, unpinnedTabs);
      break;
    case 'move-tab-right':
      await moveTabsRight(tabs, pinnedTabs, unpinnedTabs, allTabs.length);
      break;
    case 'move-tab-start':
      await moveTabsToStart(tabs, pinnedTabs);
      break;
    case 'move-tab-end':
      await moveTabsToEnd(tabs, pinnedTabs, allTabs.length);
      break;
  }
}

function handleDomainCommand(cmd) {
  chrome.tabs.query({ currentWindow: true, pinned: false }, function(tabs) {
    if (cmd === 'gather-tabs-all') {
      gatherTabsAll(tabs);
    } else {
      var tabPartition = separateActiveFromInactive(tabs);
      var activeTab = tabPartition.activeTab;
      var inactiveTabs = tabPartition.inactiveTabs;
      var sameDomainTabs = tabsMatchingDomain(getDomain(activeTab), inactiveTabs);

      if (cmd === 'gather-tabs') {
        gatherTabs(sameDomainTabs, activeTab.index);
      } else if (cmd === 'close-tabs') {
        closeTabs(sameDomainTabs);
      }
    }
  });
}

function handleCommand(cmd) {
  if (cmd.startsWith('move-tab-')) {
    handleMoveCommand(cmd);
  } else {
    handleDomainCommand(cmd);
  }
}

// Event listeners
chrome.commands.onCommand.addListener(function(cmd) {
  handleCommand(cmd);
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  handleCommand(request.cmd);
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Manage Tabs extension installed');
});
