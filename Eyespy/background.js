chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'OPEN_TAB' && request.url) {
        let targetUrl = request.url.trim();

        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
        }

        chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error('[Background] Tab creation failed:', chrome.runtime.lastError.message);
            }
        });
        return true;
    }

    if (request.action === 'GET_TAB_INFO') {
        const currentTabId = sender.tab ? 'TAB-' + sender.tab.id : null;
        chrome.tabs.query({}, (tabs) => {
            const formattedTabs = tabs.map(tab => ({
                tabId: 'TAB-' + tab.id,
                title: tab.title || 'Untitled',
                url: tab.url || '',
                active: tab.active
            }));
            sendResponse({ myTabId: currentTabId, tabs: formattedTabs });
        });
        return true;
    }

    if (request.action === 'CLOSE_TAB' && request.tabId) {
        // Strip the 'TAB-' prefix to get the native Chrome numeric ID
        const numericId = parseInt(request.tabId.replace('TAB-', ''), 10);
        if (!isNaN(numericId)) {
            chrome.tabs.remove(numericId, () => {
                if (chrome.runtime.lastError) {
                    console.error('[Background] Tab close failed:', chrome.runtime.lastError.message);
                }
            });
        }
        return true;
    }
});