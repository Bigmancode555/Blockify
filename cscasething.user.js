// ==UserScript==
// @name         CS Case Opening Search Bar
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  CS case opener with direct image CDN links, exact reel alignment, custom side-case MP3 audio, GIF handling, and side coin flip.
// @author       You
// @license      MIT
// @match        https://www.google.com/search*
// @match        https://www.google.*/search*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Check if session already has a saved background for this tab
    const savedBg = sessionStorage.getItem('cs_won_background');
    if (savedBg) {
        document.body.style.backgroundImage = `url("${savedBg}")`;
        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";
        document.body.style.backgroundAttachment = "fixed";
        return;
    }

    // =========================================================================
    // MAIN CASE IMAGES & GIFS
    // =========================================================================
    const MAIN_IMAGES = [
        "https://s15.gifyu.com/images/bQEoL.png",
        "https://s15.gifyu.com/images/bQEoH.jpg",
        "https://s15.gifyu.com/images/bQEoK.jpg",
        "https://s15.gifyu.com/images/bQEos.jpg",
        "https://s15.gifyu.com/images/bQEoM.jpg",
        "https://s15.gifyu.com/images/bQEoN.jpg",
        "https://s15.gifyu.com/images/bQEoT.gif",
        "https://s15.gifyu.com/images/bQEop.jpg",
        "https://s15.gifyu.com/images/bQEPm.jpg",
        "https://s15.gifyu.com/images/bQE1f.gif"
    ];

    // =========================================================================
    // GIF TEST POOL (Used when searching "gif test")
    // =========================================================================
    const GIF_TEST_IMAGES = [
        "https://s15.gifyu.com/images/bQEoT.gif",
        "https://s15.gifyu.com/images/bQE1f.gif"
    ];

    // =========================================================================
    // SIDE CASE ITEMS
    // =========================================================================
    const SIDE_CASE_ITEMS = [
        {
            img: "https://s15.gifyu.com/images/bQEAf.jpg",
            audio: "https://www.image2url.com/r2/default/files/1790992124121-ae3f7d5c-8676-49dd-a484-f1ae802c752d.mp3"
        },
        {
            img: "https://www.image2url.com/r2/default/files/1790992335115-699d941d-b78c-40fa-8d7f-34ee6b06052a.png",
            audio: "https://www.image2url.com/r2/default/files/1790992461454-3bd5f10f-c2df-47ab-a56a-b30960f92805.mp3"
        },
        {
            img: "https://s15.gifyu.com/images/bQEBd.jpg",
            audio: "https://www.image2url.com/r2/default/files/1790992645895-c2a15e60-cff4-4d1a-97bb-187a41ec7b84.mp3"
        },
        {
            img: "https://s15.gifyu.com/images/bQEOc.jpg",
            audio: "https://www.image2url.com/r2/default/files/1790993181396-bc004df5-9f60-46f9-9a37-58d71a6eeffb.mp3"
        },
        {
            img: "https://s15.gifyu.com/images/bQEyo.jpg",
            audio: "https://www.image2url.com/r2/default/files/1790993589895-bce4a8d9-6be9-48c8-891f-ca3f37d2bc27.mp3"
        }
    ];

    const RARITY_COLORS = ["#4b69ff", "#8847ff", "#d32ce6", "#eb4b4b", "#ffd700"];

    const TOTAL_ITEMS = 60;
    const WINNING_INDEX = 50;
    const ITEM_PITCH = 110;

    let audioCtx = null;
    let tickTimeoutId = null;
    let isRolling = false;

    function isGifUrl(url) {
        return /\.gif($|\?)/i.test(url);
    }

    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function createReelMedia(url) {
        if (isGifUrl(url)) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                canvas.width = img.naturalWidth || 100;
                canvas.height = img.naturalHeight || 100;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = url;
            return canvas;
        } else {
            const img = document.createElement('img');
            img.src = url;
            return img;
        }
    }

    function playTickSound() {
        if (!audioCtx) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.04);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.04);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.04);
        } catch (e) {}
    }

    function playWinSound() {
        if (!audioCtx) return;
        try {
            const notes = [261.63, 329.63, 392.00, 523.25];
            notes.forEach((freq, index) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + (index * 0.08));
                gain.gain.setValueAtTime(0, audioCtx.currentTime + (index * 0.08));
                gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + (index * 0.08) + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + (index * 0.08));
                osc.stop(audioCtx.currentTime + 0.8);
            });
        } catch (e) {}
    }

    function playSideAudio(audioUrl) {
        if (!audioUrl) return;
        try {
            const audio = new Audio(audioUrl);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {}
    }

    function stopAllRolls() {
        isRolling = false;
        if (tickTimeoutId) {
            clearTimeout(tickTimeoutId);
            tickTimeoutId = null;
        }
        ['cs-case-container', 'cs-win-overlay', 'cs-coin-overlay', 'cs-side-container'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    function injectStyles() {
        if (document.getElementById('cs-case-styles')) return;
        const style = document.createElement('style');
        style.id = 'cs-case-styles';
        style.textContent = `
            #cs-case-container {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                width: 700px;
                height: 130px;
                background-color: rgba(15, 18, 25, 0.95);
                border: 2px solid #323844;
                border-radius: 8px;
                overflow: hidden;
                z-index: 999998;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
                font-family: sans-serif;
            }

            #cs-case-pointer {
                position: absolute;
                top: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 4px;
                height: 100%;
                background-color: #ff3333;
                z-index: 10;
                box-shadow: 0 0 10px #ff3333;
            }

            #cs-case-reel {
                display: flex;
                align-items: center;
                height: 100%;
                position: absolute;
                left: 0;
                top: 0;
                will-change: transform;
                transition: transform 5s cubic-bezier(0.1, 1, 0.1, 1);
            }

            .cs-case-item {
                width: 100px;
                height: 100px;
                margin: 5px;
                background-color: #1a1e29;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-sizing: border-box;
                border-bottom: 5px solid #fff;
                overflow: hidden;
            }

            .cs-case-item img, .cs-case-item canvas {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 4px;
            }

            #cs-win-overlay {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.5);
                opacity: 0;
                background: rgba(15, 18, 25, 0.95);
                border: 3px solid #ffd700;
                border-radius: 12px;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                z-index: 999999;
                box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
                transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease;
                pointer-events: none;
            }

            #cs-win-overlay.show {
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }

            #cs-win-overlay h2 {
                color: #ffd700;
                margin: 0 0 10px 0;
                font-family: sans-serif;
                font-size: 22px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            #cs-win-overlay img {
                width: 180px;
                height: 180px;
                object-fit: cover;
                border-radius: 8px;
                border: 4px solid #fff;
            }

            #cs-coin-overlay {
                position: fixed;
                right: 30px;
                top: 50%;
                transform: translateY(-50%);
                z-index: 1000000;
                display: flex;
                flex-direction: column;
                align-items: center;
                background: rgba(15, 18, 25, 0.95);
                padding: 25px;
                border-radius: 12px;
                border: 2px solid #323844;
                font-family: sans-serif;
                color: #fff;
                perspective: 1000px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
            }

            .cs-coin-wrapper {
                width: 100px;
                height: 100px;
                position: relative;
                transform-style: preserve-3d;
            }

            .cs-coin-face {
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                font-weight: bold;
                backface-visibility: hidden;
                box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
                border: 3px solid #fff;
                box-sizing: border-box;
            }

            .cs-coin-heads {
                background: #4b69ff;
                color: #fff;
            }

            .cs-coin-tails {
                background: #eb4b4b;
                color: #fff;
                transform: rotateY(180deg);
            }

            #cs-side-container {
                position: fixed;
                right: 20px;
                top: 50%;
                transform: translateY(-50%);
                width: 130px;
                height: 500px;
                background-color: rgba(15, 18, 25, 0.95);
                border: 2px solid #4b69ff;
                border-radius: 8px;
                overflow: hidden;
                z-index: 999998;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
            }

            #cs-side-pointer {
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 100%;
                height: 4px;
                background-color: #ff3333;
                z-index: 10;
                box-shadow: 0 0 10px #ff3333;
            }

            #cs-side-reel {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100%;
                position: absolute;
                top: 0;
                left: 0;
                will-change: transform;
                transition: transform 4s cubic-bezier(0.1, 1, 0.1, 1);
            }
        `;
        document.head.appendChild(style);
    }

    function startSideCaseRoll() {
        const sideContainer = document.createElement('div');
        sideContainer.id = 'cs-side-container';

        const sidePointer = document.createElement('div');
        sidePointer.id = 'cs-side-pointer';
        sideContainer.appendChild(sidePointer);

        const sideReel = document.createElement('div');
        sideReel.id = 'cs-side-reel';

        let winningSideItem = null;
        const totalSideItems = 40;
        const winningSideIndex = 32;

        for (let i = 0; i < totalSideItems; i++) {
            const item = document.createElement('div');
            item.className = 'cs-case-item';

            const selectedItem = SIDE_CASE_ITEMS[Math.floor(Math.random() * SIDE_CASE_ITEMS.length)];
            const randomColor = RARITY_COLORS[Math.floor(Math.random() * RARITY_COLORS.length)];

            if (i === winningSideIndex) {
                winningSideItem = selectedItem;
            }

            item.style.borderColor = randomColor;
            const mediaEl = createReelMedia(selectedItem.img);

            item.appendChild(mediaEl);
            sideReel.appendChild(item);
        }

        sideContainer.appendChild(sideReel);
        document.body.appendChild(sideContainer);

        const containerHeight = 500;
        const targetPosition = (winningSideIndex * ITEM_PITCH) - (containerHeight / 2) + (ITEM_PITCH / 2);

        requestAnimationFrame(() => {
            setTimeout(() => {
                sideReel.style.transform = `translateY(-${targetPosition}px)`;
            }, 50);
        });

        setTimeout(() => {
            if (winningSideItem) {
                playSideAudio(winningSideItem.audio);
                sessionStorage.setItem('cs_won_background', winningSideItem.img);
                document.body.style.backgroundImage = `url("${winningSideItem.img}")`;
                document.body.style.backgroundSize = "cover";
                document.body.style.backgroundPosition = "center";
                document.body.style.backgroundAttachment = "fixed";
            }
            setTimeout(() => {
                sideContainer.style.transition = 'opacity 0.8s ease';
                sideContainer.style.opacity = '0';
                setTimeout(() => sideContainer.remove(), 800);
            }, 2000);
        }, 4200);
    }

    function triggerCoinFlip() {
        const coinOverlay = document.createElement('div');
        coinOverlay.id = 'cs-coin-overlay';
        coinOverlay.innerHTML = `
            <h4 style="margin:0 0 15px 0; letter-spacing:1px; font-size: 14px; text-align: center;">SIDE CASE BONUS FLIP</h4>
            <div class="cs-coin-wrapper" id="cs-coin-wrapper">
                <div class="cs-coin-face cs-coin-heads">HEADS</div>
                <div class="cs-coin-face cs-coin-tails">TAILS</div>
            </div>
            <p id="cs-coin-result" style="margin:15px 0 0 0; font-weight:bold; font-size:13px; text-align: center;">FLIPPING...</p>
        `;
        document.body.appendChild(coinOverlay);

        const coinWrapper = document.getElementById('cs-coin-wrapper');
        const resultEl = document.getElementById('cs-coin-result');

        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = (urlParams.get('q') || '').toLowerCase();
        const isTestSearch = searchQuery.includes('test');

        const isLoss = isTestSearch ? false : (Math.random() < 0.70);
        const targetRotation = (360 * 10) + (isLoss ? 180 : 0);

        requestAnimationFrame(() => {
            setTimeout(() => {
                coinWrapper.style.transition = 'transform 2.5s cubic-bezier(0.1, 0.9, 0.2, 1)';
                coinWrapper.style.transform = `rotateY(${targetRotation}deg)`;
            }, 50);
        });

        setTimeout(() => {
            if (!isLoss) {
                resultEl.textContent = "HEADS (WIN)!";
                resultEl.style.color = "#4b69ff";
                setTimeout(() => {
                    coinOverlay.remove();
                    sessionStorage.removeItem('cs_won_background');
                    startSideCaseRoll();
                }, 1200);
            } else {
                resultEl.textContent = "TAILS (LOSS)";
                resultEl.style.color = "#eb4b4b";
                setTimeout(() => coinOverlay.remove(), 2000);
            }
        }, 2600);
    }

    function startRoll() {
        stopAllRolls();
        isRolling = true;
        initAudio();
        injectStyles();

        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = (urlParams.get('q') || '').toLowerCase();
        const isGifTest = searchQuery.includes('gif test');

        const activeImagePool = isGifTest ? GIF_TEST_IMAGES : MAIN_IMAGES;

        const container = document.createElement('div');
        container.id = 'cs-case-container';

        const pointer = document.createElement('div');
        pointer.id = 'cs-case-pointer';
        container.appendChild(pointer);

        const reel = document.createElement('div');
        reel.id = 'cs-case-reel';

        let winningImage = "";
        let winningColor = "";

        for (let i = 0; i < TOTAL_ITEMS; i++) {
            const item = document.createElement('div');
            item.className = 'cs-case-item';

            const randomImg = activeImagePool[Math.floor(Math.random() * activeImagePool.length)];
            const randomColor = RARITY_COLORS[Math.floor(Math.random() * RARITY_COLORS.length)];

            if (i === WINNING_INDEX) {
                winningImage = randomImg;
                winningColor = randomColor;
            }

            item.style.borderColor = randomColor;
            const mediaEl = createReelMedia(randomImg);

            item.appendChild(mediaEl);
            reel.appendChild(item);
        }

        container.appendChild(reel);
        document.body.appendChild(container);

        const animatedWinningImage = isGifUrl(winningImage) ? `${winningImage}?reset=${Date.now()}` : winningImage;

        const winOverlay = document.createElement('div');
        winOverlay.id = 'cs-win-overlay';
        winOverlay.innerHTML = `
            <h2>YOU UNBOXED</h2>
            <img src="${animatedWinningImage}" style="border-color: ${winningColor}">
        `;
        document.body.appendChild(winOverlay);

        const randomOffset = Math.floor(Math.random() * 80) - 40;
        const containerWidth = 700;
        const targetPosition = (WINNING_INDEX * ITEM_PITCH) - (containerWidth / 2) + (ITEM_PITCH / 2) + randomOffset;

        requestAnimationFrame(() => {
            setTimeout(() => {
                if (!isRolling) return;
                reel.style.transform = `translateX(-${targetPosition}px)`;

                let currentItem = 0;
                let delay = 50;

                function playTicks() {
                    if (!isRolling) return;
                    if (currentItem < WINNING_INDEX) {
                        playTickSound();
                        currentItem++;
                        delay = Math.min(600, delay * 1.08);
                        tickTimeoutId = setTimeout(playTicks, delay);
                    }
                }
                playTicks();

            }, 50);
        });

        setTimeout(() => {
            if (!isRolling) return;
            isRolling = false;
            if (tickTimeoutId) clearTimeout(tickTimeoutId);

            playWinSound();
            winOverlay.classList.add('show');

            sessionStorage.setItem('cs_won_background', winningImage);

            document.body.style.backgroundImage = `url("${winningImage}")`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundPosition = "center";
            document.body.style.backgroundAttachment = "fixed";

            setTimeout(() => {
                container.style.transition = 'opacity 0.8s ease';
                container.style.opacity = '0';
                winOverlay.style.opacity = '0';

                setTimeout(() => {
                    container.remove();
                    winOverlay.remove();
                    triggerCoinFlip();
                }, 800);
            }, 2500);

        }, 5200);
    }

    function init() {
        startRoll();
    }

    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();