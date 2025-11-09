// ==UserScript==
// @name         B站直播间主播信息查询器
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  在B站直播间页面自动查询并在右上角显示主播的详细信息（需要已登录且有公会经纪人权限的账号）
// @author       是木木呐Beta
// @match        https://live.bilibili.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @connect      api.live.bilibili.com
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// ==/UserScript==

(function() {
    'use strict';

    // 存储当前显示状态
    let isVisible = true;

    // 添加自定义字体样式 - 改为黑体
    const style = document.createElement('style');
    style.textContent = `
        .bili-status-box {
            font-family: "SimHei", "黑体", "Microsoft YaHei", sans-serif !important;
            letter-spacing: 0.3px;
        }

        .bili-status-box .anchor-name {
            font-weight: 700 !important;
            letter-spacing: 0.5px;
            font-size: 16px !important;
        }

        .bili-status-box .metric-value {
            font-weight: 700 !important;
        }

        .bili-status-box .metric-label {
            font-weight: 700 !important; /* 添加标签加粗样式 */
        }

        .bili-show-tab {
            font-family: "SimHei", "黑体", "Microsoft YaHei", sans-serif !important;
            font-weight: 600;
            letter-spacing: 0.5px;
        }

        .bili-message-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 8px 12px;
            margin-top: 12px;
            background: linear-gradient(135deg, #fb7299, #ff9db5);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-family: 'SimHei', '黑体', 'Microsoft YaHei', sans-serif;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(251, 114, 153, 0.3);
        }

        .bili-message-btn:hover {
            background: linear-gradient(135deg, #ff9db5, #ffb6c1);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(251, 114, 153, 0.4);
        }

        .bili-message-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 4px rgba(251, 114, 153, 0.3);
        }

        /* 修改：有利状态的高亮样式 - 粉色带脉冲效果 */
        .bili-highlight-positive {
            color: #fb7299 !important;
            font-weight: 800 !important;
            text-shadow: 0 1px 2px rgba(251, 114, 153, 0.2);
            padding: 2px 6px;
            border-radius: 4px;
            background: linear-gradient(135deg, rgba(251, 114, 153, 0.1), rgba(251, 114, 153, 0.05));
            animation: pulse-glow 2s infinite;
        }

        /* 新增：不利状态的高亮样式 - 淡绿色 */
        .bili-highlight-negative {
            color: #00b894 !important;
            font-weight: 700 !important;
            text-shadow: 0 1px 2px rgba(0, 184, 148, 0.2);
            padding: 2px 6px;
            border-radius: 4px;
            background: linear-gradient(135deg, rgba(0, 184, 148, 0.1), rgba(0, 184, 148, 0.05));
        }

        .bili-highlight-neutral {
            color: #8c8c8c !important;
            font-weight: 600 !important;
        }

        @keyframes pulse-glow {
            0% { box-shadow: 0 0 0 0 rgba(251, 114, 153, 0.4); }
            70% { box-shadow: 0 0 0 4px rgba(251, 114, 153, 0); }
            100% { box-shadow: 0 0 0 0 rgba(251, 114, 153, 0); }
        }
    `;
    document.head.appendChild(style);

    // 主函数：页面加载完成后执行
    function main() {
        // 1. 检查当前URL是否是具体的直播间（包含房间号）
        const roomId = extractRoomId();
        if (!roomId) {
            console.log("[信息查询] 当前页面不是具体的直播间，脚本退出。");
            return;
        }

        console.log(`[信息查询] 检测到直播间房间号: ${roomId}, 开始查询...`);

        // 2. 稍作延迟，确保页面完全加载
        setTimeout(() => {
            queryAnchorStatus(roomId);
        }, 500);
    }

    // 从URL中提取房间号
    function extractRoomId() {
        // 匹配类似 https://live.bilibili.com/216 或 https://live.bilibili.com/216?xxx=yyy 的URL
        const match = window.location.href.match(/https:\/\/live\.bilibili\.com\/(\d+)/);
        return match ? match[1] : null;
    }

    // 查询主播状态的API函数
    function queryAnchorStatus(roomId) {
        const apiUrl = `https://api.live.bilibili.com/xlive/mcn-interface/v1/mcn_mng/SearchAnchor?search_type=3&search=${roomId}`;

        // 使用GM_xmlhttpRequest发起跨域请求，并自动携带当前站点的Cookie
        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            headers: {
                'Host': 'api.live.bilibili.com',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
                'Accept': 'application/json, text/plain, */*',
                'Sec-Ch-Ua': '"Not;A=Brand";v="99", "Microsoft Edge";v="139", "Chromium";v="139"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Origin': 'https://live.bilibili.com',
                'Sec-Fetch-Site': 'same-site',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Referer': 'https://live.bilibili.com/',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
                'Priority': 'u=1, i'
            },
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    handleApiResponse(data, roomId);
                } catch (e) {
                    showError("解析API响应失败", e.toString());
                }
            },
            onerror: function(error) {
                showError("网络请求失败", error.statusText);
            }
        });
    }

    // 处理API返回的数据
    function handleApiResponse(data, roomId) {
        if (data.code !== 0) {
            showError(`API返回错误 (Code: ${data.code})`, data.message || "未知错误");
            return;
        }

        // 检查是否有数据
        if (!data.data || !data.data.items || data.data.items.length === 0) {
            showStatusOnPage(null, `房间 ${roomId}`, "未找到主播信息");
            return;
        }

        const anchor = data.data.items[0];
        const uname = anchor.uname;
        const uid = anchor.uid;
        const anchorRoomId = anchor.room_id;
        const face = anchor.face || '';

        // 新字段处理
        const isStarAnchor = anchor.is_star_anchor === 1; // 是否繁星主播
        const canJoin = anchor.status === 0; // 是否可入会 (status: 0可入会)
        const isNewAnchor = anchor.is_new_anchor === 1; // 是否政策新主播
        const hasHistoryEntry = anchor.is_history_entry === 1; // 历史是否有入会

        // 在页面上显示状态
        showStatusOnPage(uname, uid, anchorRoomId, isStarAnchor, canJoin, isNewAnchor, hasHistoryEntry, face);
    }

    // 在页面上显示状态的函数
    function showStatusOnPage(uname, uid, roomId, isStarAnchor, canJoin, isNewAnchor, hasHistoryEntry, face, customMessage = null) {
        // 先尝试查找是否已经存在我们创建的显示框
        let statusBox = document.getElementById('bili-anchor-status-box');
        let toggleBtn = document.getElementById('bili-anchor-toggle-btn');
        let showTab = document.getElementById('bili-anchor-show-tab');

        // 创建显示标签（始终存在，用于隐藏后重新显示插件）
        if (!showTab) {
            showTab = document.createElement('div');
            showTab.id = 'bili-anchor-show-tab';
            showTab.className = 'bili-show-tab';
            Object.assign(showTab.style, {
                position: 'fixed',
                top: '100px',
                right: '0',
                zIndex: '9999',
                padding: '10px 14px',
                backgroundColor: '#fb7299',
                color: 'white',
                borderRadius: '8px 0 0 8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                boxShadow: '-3px 3px 12px rgba(0,0,0,0.2)',
                display: 'none', // 默认隐藏
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: '0.9'
            });
            showTab.innerHTML = '显示插件';
            showTab.addEventListener('click', function() {
                toggleVisibility();
            });

            // 添加悬停动画效果
            showTab.addEventListener('mouseenter', function() {
                this.style.opacity = '1';
                this.style.paddingRight = '18px';
                this.style.transform = 'translateX(0)';
                this.style.boxShadow = '-4px 4px 15px rgba(0,0,0,0.25)';
            });

            showTab.addEventListener('mouseleave', function() {
                this.style.opacity = '0.9';
                this.style.paddingRight = '14px';
                this.style.transform = 'translateX(calc(100% - 10px))';
                this.style.boxShadow = '-3px 3px 12px rgba(0,0,0,0.2)';
            });

            document.body.appendChild(showTab);
        }

        if (!statusBox) {
            // 如果不存在，则创建一个新的div元素
            statusBox = document.createElement('div');
            statusBox.id = 'bili-anchor-status-box';
            statusBox.className = 'bili-status-box';
            // 设置白色底色样式，固定在右上角，向下移动一些
            Object.assign(statusBox.style, {
                position: 'fixed',
                top: '100px',
                right: '20px',
                zIndex: '10000',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#333',
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                border: '1px solid ',
                maxWidth: '300px',
                lineHeight: '1.5',
                fontFamily: '"SimHei", "黑体", "Microsoft YaHei", sans-serif',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: '1',
                transform: 'translateX(0) scale(1)',
                transformOrigin: 'top right'
            });
            document.body.appendChild(statusBox);
        }

        // 创建切换按钮 - 放在插件右上角
        if (!toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'bili-anchor-toggle-btn';
            toggleBtn.innerHTML = '×';
            toggleBtn.title = '隐藏插件';
            Object.assign(toggleBtn.style, {
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                zIndex: '10002',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#fff',
                backgroundColor: '#fb7299',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0',
                boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.3s ease'
            });

            // 添加悬停效果
            toggleBtn.addEventListener('mouseover', function() {
                this.style.backgroundColor = '#ff9db5';
                this.style.transform = 'scale(1.15) rotate(90deg)';
                this.style.boxShadow = '0 4px 10px rgba(0,0,0,0.25)';
            });

            toggleBtn.addEventListener('mouseout', function() {
                this.style.backgroundColor = '#fb7299';
                this.style.transform = 'scale(1) rotate(0deg)';
                this.style.boxShadow = '0 3px 8px rgba(0,0,0,0.2)';
            });

            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleVisibility();
            });

            statusBox.appendChild(toggleBtn);
        }

        // 根据状态设置内容
        if (customMessage) {
            statusBox.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 8px; color: #666;">
                    <span style="font-size: 16px; margin-right: 8px;">❓</span>
                    <span style="font-weight: 600;">${customMessage}</span>
                </div>
            `;
        } else {
            // 状态颜色定义 - 根据新要求调整
            const highlightPositive = 'bili-highlight-positive'; // 有利状态 - 粉色带脉冲效果
            const highlightNegative = 'bili-highlight-negative'; // 不利状态 - 淡绿色
            const highlightNeutral = 'bili-highlight-neutral'; // 中性状态 - 灰色

            // 根据状态确定CSS类
            // 繁星主播：是（不利-淡绿色） vs 否（有利-粉色带脉冲）
            const starAnchorClass = isStarAnchor ? highlightNegative : highlightPositive;
            // 可入会状态：不可入会（不利-淡绿色） vs 可入会（有利-粉色带脉冲）
            const canJoinClass = canJoin ? highlightPositive : highlightNegative;
            // 政策新主播：否（不利-淡绿色） vs 是（有利-粉色带脉冲）
            const isNewAnchorClass = isNewAnchor ? highlightPositive : highlightNegative;
            // 历史入会：有（不利-淡绿色） vs 无（有利-粉色带脉冲）
            const hasHistoryEntryClass = hasHistoryEntry ? highlightNegative : highlightPositive;

            // 头像HTML
            const faceHtml = face ? `<img src="${face}" style="width: 44px; height: 44px; border-radius: 50%; margin-right: 12px; object-fit: cover; border: 2px solid #f0f0f0;">` : '';

            // 创建私信按钮
            const messageButtonHtml = `
                <button class="bili-message-btn" id="bili-message-btn" title="给主播发送私信">
                    <span style="margin-right: 6px;">✉️</span>
                    发送私信
                </button>
            `;

            // 创建内容HTML - 优化排版，房间号和UID分成两行显示
            const contentHtml = `
                <div style="display: flex; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #f0f0f0; padding-bottom: 14px;">
                    ${faceHtml}
                    <div style="flex: 1;">
                        <div class="anchor-name" style="font-size: 15px; color: #262626; margin-bottom: 6px;">${uname}</div>
                        <div style="font-size: 12px; color: #666;">
                            <div style="margin-bottom: 2px;">房间号: ${roomId}</div>
                            <div>UID: ${uid}</div>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="metric-label" style="color: #595959; white-space: nowrap; font-size: 12px; font-weight: bold;">是否繁星主播:</span>
                        <span class="${starAnchorClass}" style="white-space: nowrap; font-size: 12px;">${isStarAnchor ? '是' : '否'}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="metric-label" style="color: #595959; white-space: nowrap; font-size: 12px; font-weight: bold;">是否可入会:</span>
                        <span class="${canJoinClass}" style="white-space: nowrap; font-size: 12px;">${canJoin ? '可入会' : '不可入会'}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="metric-label" style="color: #595959; white-space: nowrap; font-size: 12px; font-weight: bold;">是否政策新主播:</span>
                        <span class="${isNewAnchorClass}" style="white-space: nowrap; font-size: 12px;">${isNewAnchor ? '是' : '否'}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="metric-label" style="color: #595959; white-space: nowrap; font-size: 12px; font-weight: bold;">历史是否有入会:</span>
                        <span class="${hasHistoryEntryClass}" style="white-space: nowrap; font-size: 12px;">${hasHistoryEntry ? '有' : '无'}</span>
                    </div>
                </div>

                ${messageButtonHtml}
            `;

            // 创建内容容器
            const contentContainer = document.createElement('div');
            contentContainer.innerHTML = contentHtml;

            // 清空并添加内容
            while (statusBox.firstChild) {
                statusBox.removeChild(statusBox.firstChild);
            }
            statusBox.appendChild(contentContainer);
            statusBox.appendChild(toggleBtn); // 确保按钮在最上层

            // 添加私信按钮点击事件
            const messageBtn = document.getElementById('bili-message-btn');
            if (messageBtn && uid) {
                messageBtn.addEventListener('click', function() {
                    const messageUrl = `https://message.bilibili.com/?spm_id_from=333.1387.0.0#/whisper/mid${uid}`;
                    window.open(messageUrl, '_blank');
                });
            }
        }
    }

    // 切换显示/隐藏
    function toggleVisibility() {
        const statusBox = document.getElementById('bili-anchor-status-box');
        const toggleBtn = document.getElementById('bili-anchor-toggle-btn');
        const showTab = document.getElementById('bili-anchor-show-tab');

        if (!statusBox || !showTab) return;

        isVisible = !isVisible;

        if (isVisible) {
            // 显示动画：从左下到右上淡入
            statusBox.style.opacity = '1';
            statusBox.style.transform = 'translateX(0) scale(1)';
            statusBox.style.pointerEvents = 'auto';
            toggleBtn.innerHTML = '×';
            toggleBtn.title = '隐藏插件';

            // 隐藏显示标签
            showTab.style.display = 'none';
        } else {
            // 隐藏动画：从右上到左下淡出
            statusBox.style.opacity = '0';
            statusBox.style.transform = 'translateX(-20px) translateY(20px) scale(0.8)';
            statusBox.style.pointerEvents = 'none';
            toggleBtn.innerHTML = '+';
            toggleBtn.title = '显示插件';

            // 显示标签
            showTab.style.display = 'block';
            showTab.style.transform = 'translateX(calc(100% - 10px))';
        }
    }

    // 显示错误信息
    function showError(title, message) {
        console.error(`[信息查询错误] ${title}: ${message}`);

        // 在页面上显示错误信息
        showStatusOnPage(null, null, null, null, null, null, null, null, `${title}: ${message}`);

        // 使用SweetAlert2显示更友好的错误提示
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: '查询失败',
                text: `${title}: ${message}`,
                icon: 'error',
                confirmButtonText: '确定',
                confirmButtonColor: '#fb7299',
                background: '#fff',
                backdrop: 'rgba(0,0,0,0.4)'
            });
        } else {
            // 如果Swal未定义，使用原生alert
            alert(`查询失败: ${title}: ${message}`);
        }
    }

    // 监听页面URL变化（SPA路由切换）
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            // URL变化后重新执行主函数
            setTimeout(main, 1000);
        }
    }).observe(document, {subtree: true, childList: true});

    // 页面加载完成后执行主函数
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        setTimeout(main, 1000);
    }
})();