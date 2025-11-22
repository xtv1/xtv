// ==UserScript==
// @name         艾薇社区破解VIP视频免费看(DPlayer版)
// @namespace    aiwei_vip_video_free_see
// @version      2.2
// @description  使用DPlayer播放器，直接覆盖原播放器位置
// @author       w2f
// @match        https://avjb.com/video/*
// @match        https://bav53.cc/video/*
// @grant        GM_addStyle
// @license      MIT
// @require      https://cdn.jsdelivr.net/npm/dplayer@1.27.1/dist/DPlayer.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.1.5/hls.min.js
// ==/UserScript==

(function() {
    'use strict';

    const DOMAINS = [
        'https://99newline.jb-aiwei.cc',
        'https://88newline.jb-aiwei.cc'
    ];
    let globalVideoId = null;
    let globalFolderId = null;
    let currentM3u8Url = '';
    let dp = null;

    // 样式优化
    GM_addStyle(`
        #cracked-player-container {
            width: 100%;
            height: 0;
            padding-bottom: 56.25%;
            position: relative;
            background: #000;
        }
        #dplayer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        /* DPlayer样式微调 */
        .dplayer-logo {
            display: none !important;
        }
        /* 复制成功提示 */
        .copy-success-toast {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.85);
            color: #7bed9f;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 16px;
            z-index: 999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            animation: fadeInOut 1.5s ease-in-out;
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
    `);

    function createPlayer() {
        const playerContainer = document.createElement('div');
        playerContainer.id = 'cracked-player-container';
        playerContainer.innerHTML = `<div id="dplayer"></div>`;
        return playerContainer;
    }

    function showCopyToast() {
        const toast = document.createElement('div');
        toast.className = 'copy-success-toast';
        toast.innerText = '✅ 链接已复制到剪贴板';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    }

    function replaceDownloadButton() {
        const downloadLi = document.querySelector('.sort.download');
        if (!downloadLi || !currentM3u8Url) return;

        const iconHtml = downloadLi.querySelector('.icon')?.outerHTML || '<i class="icon type-sort"></i>';
        const strongText = downloadLi.querySelector('strong')?.innerText || '下载';

        downloadLi.innerHTML = `
            ${iconHtml}
            <strong>${strongText}</strong>
            <ul>
                <a href="javascript:void(0);" id="copy-m3u8-link">📋 复制M3U8链接</a>
                <a href="javascript:void(0);" id="open-m3u8-link" target="_blank">🔗 新标签打开</a>
            </ul>
        `;

        const copyLink = document.getElementById('copy-m3u8-link');
        if (copyLink) {
            copyLink.addEventListener('click', (e) => {
                e.preventDefault();
                const textarea = document.createElement('textarea');
                textarea.value = currentM3u8Url;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showCopyToast();
            });
        }

        const openLink = document.getElementById('open-m3u8-link');
        if (openLink) {
            openLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.open(currentM3u8Url, '_blank');
            });
        }

        console.log('[DPlayer播放器] 下载按钮已替换');
    }

    function initDPlayer(url) {
        currentM3u8Url = url;
        console.log(`[DPlayer播放器] 加载: ${url}`);

        // 获取视频封面图
        const posterImg = document.querySelector(".player-holder img, .no-player img");
        const poster = posterImg ? posterImg.src : '';

        // 获取视频标题
        const titleElement = document.querySelector('h1.title-yakov, .video-info h1');
        const videoTitle = titleElement ? titleElement.innerText.trim() : '视频播放';

        dp = new DPlayer({
            container: document.getElementById('dplayer'),
            screenshot: true,
            video: {
                url: url,
                type: 'customHls',
                customType: {
                    customHls: function (video, player) {
                        const hls = new Hls();
                        hls.loadSource(video.src);
                        hls.attachMedia(video);
                    },
                },
                pic: poster,
            },
            autoplay: true,
            theme: '#7bed9f',
            logo: '',
            contextmenu: [
                {
                    text: '脚本作者：w2f',
                    link: 'https://greasyfork.org',
                },
                {
                    text: '复制视频链接',
                    click: (player) => {
                        const textarea = document.createElement('textarea');
                        textarea.value = currentM3u8Url;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        player.notice('链接已复制到剪贴板');
                    },
                },
            ],
        });

        // 播放器加载完成后替换下载按钮
        dp.on('loadeddata', () => {
            console.log('[DPlayer播放器] 视频加载完成');
            replaceDownloadButton();
        });

        // 错误处理
        dp.on('error', () => {
            console.error('[DPlayer播放器] 播放错误');
            dp.notice('视频加载失败，请刷新重试', 5000);
        });
    }

    function extractVideoInfo() {
        // 方法1: 从URL提取
        const urlMatch = window.location.pathname.match(/\/video\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
            globalVideoId = urlMatch[1];
            globalFolderId = Math.floor(parseInt(globalVideoId) / 1000) * 1000;
            return true;
        }

        // 方法2: 从图片路径提取
        const img = document.querySelector(".player-holder img, .no-player img");
        if (img && img.src) {
            const parts = img.src.split('/');
            const possibleVid = parts[parts.length - 3];
            const possibleFid = parts[parts.length - 4];
            if (!isNaN(possibleVid) && !isNaN(possibleFid)) {
                globalVideoId = possibleVid;
                globalFolderId = possibleFid;
                return true;
            }
        }

        return false;
    }

    function main() {
        const originalPlayer = document.querySelector('.player-holder');
        if (!originalPlayer) return;

        clearInterval(timer);

        if (!extractVideoInfo()) {
            console.error('[DPlayer播放器] 无法提取视频ID');
            return;
        }

        console.log(`[DPlayer播放器] 视频ID: ${globalVideoId}, 文件夹ID: ${globalFolderId}`);

        // 选择线路
        let domain = DOMAINS[0];
        if (parseInt(globalVideoId) >= 92803) {
            domain = DOMAINS[1];
        }
        const m3u8Url = `${domain}/videos/${globalFolderId}/${globalVideoId}/index.m3u8`;

        // 创建并插入播放器容器
        const playerContainer = createPlayer();
        originalPlayer.innerHTML = '';
        originalPlayer.appendChild(playerContainer);

        // 调整父容器样式
        const parentPlayer = document.querySelector('.player');
        if (parentPlayer) {
            parentPlayer.style.height = '0';
            parentPlayer.style.width = '100%';
            parentPlayer.style.paddingBottom = '56.25%';
            parentPlayer.style.position = 'relative';
        }

        // 初始化DPlayer
        initDPlayer(m3u8Url);
    }

    let timer = setInterval(main, 500);
})();
