// ==UserScript==
// @name         艾薇社区破解VIP视频免费看
// @namespace    aiwei_vip_video_free_see
// @version      1.9
// @description  支持avjb/bav53，支持安卓拖动/缩放/最小化，记忆播放器位置。 
// @author       w2f 
// @match        https://avjb.com/video/*
// @match        https://bav53.cc/video/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @license      MIT
// @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.1.5/hls.min.js
// @downloadURL  https://update.sleazyfork.org/scripts/529208/%E8%89%BE%E8%96%87%E7%A4%BE%E5%8C%BA%E7%A0%B4%E8%A7%A3VIP%E8%A7%86%E9%A2%91%E5%85%8D%E8%B4%B9%E7%9C%8B.user.js
// @updateURL    https://update.sleazyfork.org/scripts/529208/%E8%89%BE%E8%96%87%E7%A4%BE%E5%8C%BA%E7%A0%B4%E8%A7%A3VIP%E8%A7%86%E9%A2%91%E5%85%8D%E8%B4%B9%E7%9C%8B.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置区域 ---
    const STORAGE_KEY_POS = 'av_player_pos'; // 记忆位置的Key
    
    // 内部保留线路定义，仅用于自动初始化，不再提供手动切换
    const DOMAINS = [
        'https://99newline.jb-aiwei.cc',
        'https://88newline.jb-aiwei.cc'
    ];
    let globalVideoId = null;
    let globalFolderId = null;

    // 1. 创建播放器结构 (极简版)
    const player = document.createElement('div');
    player.id = 'hlsPlayer';
    player.innerHTML = `
        <div id="dragHeader">
            <span id="headerTitle">📺 破解播放器</span>
            <div class="header-controls">
                <span id="toggleBtn" style="padding: 0 10px; cursor: pointer;">➖</span>
            </div>
        </div>
        <div id="playerBody">
            <video id="videoElement" controls playsinline webkit-playsinline></video>
            <div class="player-footer">
                <span id="showTips">⌛️ 就绪</span>
                <div class="action-btns">
                    <button id="copyBtn">📋 复制链接</button>
                </div>
            </div>
        </div>
        <div id="resizeHandle">◢</div>
    `;

    const video = player.querySelector('#videoElement');
    const showTipsEl = player.querySelector('#showTips');
    const toggleBtn = player.querySelector('#toggleBtn');
    const copyBtn = player.querySelector('#copyBtn');
    const dragHeader = player.querySelector('#dragHeader');
    let hls = null;
    let isMinimized = false;
    let currentM3u8Url = "";

    // 2. 样式优化
    GM_addStyle(`
        #hlsPlayer {
            position: fixed;
            top: 60px;
            left: 10px;
            width: 320px;
            min-width: 250px;
            background: #1a1a1a;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.7);
            z-index: 999999;
            color: white;
            font-size: 14px;
            border: 1px solid #444;
            display: flex;
            flex-direction: column;
            touch-action: none; 
        }
        #dragHeader {
            padding: 10px 15px;
            background: linear-gradient(to bottom, #3d3d3d, #2d2d2d);
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #444;
            user-select: none;
            border-radius: 8px 8px 0 0;
        }
        #playerBody {
            padding: 8px;
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #1a1a1a;
        }
        #videoElement {
            width: 100%;
            height: auto;
            max-height: 60vh;
            border-radius: 4px;
            background: #000;
            display: block;
        }
        .player-footer {
            padding-top: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
        }
        button {
            background: #333;
            color: #7bed9f;
            border: 1px solid #7bed9f;
            padding: 3px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        /* 右下角调整大小手柄 */
        #resizeHandle {
            position: absolute;
            bottom: 2px;
            right: 2px;
            cursor: nwse-resize;
            color: #666;
            font-size: 10px;
            line-height: 10px;
            user-select: none;
        }

        /* 最小化状态 */
        #hlsPlayer.minimized {
            width: auto !important;
            height: auto !important;
            min-width: 0;
        }
        #hlsPlayer.minimized #playerBody, 
        #hlsPlayer.minimized #resizeHandle {
            display: none;
        }
        #hlsPlayer.minimized #dragHeader {
            border-bottom: none;
            border-radius: 8px;
        }
    `);

    // 3. 记忆位置与拖动逻辑
    function loadPosition() {
        const saved = localStorage.getItem(STORAGE_KEY_POS);
        if (saved) {
            try {
                const pos = JSON.parse(saved);
                const x = Math.min(Math.max(0, pos.x), window.innerWidth - 50);
                const y = Math.min(Math.max(0, pos.y), window.innerHeight - 50);
                player.style.left = x + 'px';
                player.style.top = y + 'px';
                if (pos.w) player.style.width = pos.w + 'px';
            } catch(e) {}
        }
    }

    function savePosition() {
        const rect = player.getBoundingClientRect();
        localStorage.setItem(STORAGE_KEY_POS, JSON.stringify({
            x: rect.left,
            y: rect.top,
            w: rect.width
        }));
    }

    function initDrag(element) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const startDrag = (e) => {
            if (e.target.tagName === 'SPAN' && e.target.parentElement.className === 'header-controls') return;
            isDragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            const rect = player.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            e.preventDefault();
        };

        const doDrag = (e) => {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            player.style.left = `${initialLeft + (clientX - startX)}px`;
            player.style.top = `${initialTop + (clientY - startY)}px`;
            e.preventDefault();
        };

        const stopDrag = () => {
            if (isDragging) savePosition(); 
            isDragging = false;
        };

        element.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
        element.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', doDrag, {passive: false});
        document.addEventListener('touchend', stopDrag);
    }

    // 4. 调整大小逻辑
    const resizeHandle = player.querySelector('#resizeHandle');
    let isResizing = false;
    let startW, startResizeX;

    const startResize = (e) => {
        isResizing = true;
        startResizeX = e.touches ? e.touches[0].clientX : e.clientX;
        startW = player.offsetWidth;
        e.preventDefault();
        e.stopPropagation();
    };

    const doResize = (e) => {
        if (!isResizing) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const newW = startW + (clientX - startResizeX);
        if (newW > 200) {
            player.style.width = newW + 'px';
        }
    };

    const stopResize = () => {
        if (isResizing) savePosition(); 
        isResizing = false;
    };

    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize, {passive: false});
    document.addEventListener('mousemove', doResize);
    document.addEventListener('touchmove', doResize, {passive: false});
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('touchend', stopResize);


    // 5. 按钮事件
    toggleBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        if (isMinimized) {
            player.classList.add('minimized');
            toggleBtn.innerText = '⬜';
            video.pause(); // 最小化自动暂停
        } else {
            player.classList.remove('minimized');
            toggleBtn.innerText = '➖';
        }
    });

    copyBtn.addEventListener('click', () => {
        if (currentM3u8Url) {
            GM_setClipboard(currentM3u8Url);
            const oldText = copyBtn.innerText;
            copyBtn.innerText = "👌 已复制";
            setTimeout(() => copyBtn.innerText = oldText, 1000);
        }
    });

    // 6. 播放核心
    function loadHlsStream(url) {
        currentM3u8Url = url;
        console.log(`脚本: 加载 -> ${url}`);
        
        if (Hls.isSupported()) {
            if (hls) hls.destroy();
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play();
                showTipsEl.innerText = `✅ 播放中`;
                showTipsEl.style.color = '#4cd137';
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                   showTipsEl.innerText = `❌ 加载失败`;
                   showTipsEl.style.color = '#ff4757';
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', () => video.play());
            showTipsEl.innerText = `✅ 播放中 (原生)`;
        }
    }

    function main() {
        if (!document.body) return;
        clearInterval(my_timer);
        
        loadPosition(); 
        initDrag(dragHeader); 
        document.body.appendChild(player);

        // 提取ID
        const urlMatch = window.location.pathname.match(/\/video\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
            globalVideoId = urlMatch[1];
            globalFolderId = Math.floor(parseInt(globalVideoId) / 1000) * 1000;
        } else {
            const img = document.querySelector(".player-holder img");
            if (img) {
                const tmp = img.src.split('/');
                const possibleVid = tmp[tmp.length - 3];
                const possibleFid = tmp[tmp.length - 4];
                if (!isNaN(possibleVid) && !isNaN(possibleFid)) {
                    globalVideoId = possibleVid;
                    globalFolderId = possibleFid;
                }
            }
        }

        if (globalVideoId && globalFolderId) {
            // 自动选择线路 (保留此逻辑以确保视频能播放)
            let initialDomain = DOMAINS[0]; // 默认 99newline
            if (parseInt(globalVideoId) >= 92803) {
                initialDomain = DOMAINS[1]; // 88newline
            }
            
            const m3u8_url = `${initialDomain}/videos/${globalFolderId}/${globalVideoId}/index.m3u8`;
            loadHlsStream(m3u8_url);
        } else {
            showTipsEl.innerText = '❌ 未找到ID';
        }
    }

    let my_timer = setInterval(main, 1000);

})();
