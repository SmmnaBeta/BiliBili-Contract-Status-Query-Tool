// ==UserScript==
// @name         B站直播间主播签约状态查询器
// @namespace    http://tampermonkey.net/
// @version      1.8.5
// @description  在B站直播间页面自动查询并在右上角显示主播的签约状态、繁星等级和有效开播天数（需要已登录且有公会经纪人权限的账号）
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

    // 繁星等级标准
    const STAR_LEVELS = [
        { level: 1, minRevenue: 10000 },
        { level: 2, minRevenue: 30000 },
        { level: 3, minRevenue: 60000 },
        { level: 4, minRevenue: 120000 },
        { level: 5, minRevenue: 300000 }
    ];

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
    `;
    document.head.appendChild(style);

    // 主函数：页面加载完成后执行
    function main() {
        // 1. 检查当前URL是否是具体的直播间（包含房间号）
        const roomId = extractRoomId();
        if (!roomId) {
            console.log("[签约查询] 当前页面不是具体的直播间，脚本退出。");
            return;
        }

        console.log(`[签约查询] 检测到直播间房间号: ${roomId}, 开始查询...`);

        // 2. 稍作延迟，确保页面完全加载
        setTimeout(() => {
            queryAnchorStatus(roomId);
        }, 1000);
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

    // 计算繁星等级
    function calculateStarRank(starMetrics) {
        if (!starMetrics || starMetrics.length === 0) {
            return 0; // 没有营收数据，不是繁星主播
        }

        // 获取最新季度的营收数据（数组最后一个元素）
        const latestQuarter = starMetrics[starMetrics.length - 1];
        const revenue = latestQuarter.Val;

        // 根据营收金额确定繁星等级
        for (let i = STAR_LEVELS.length - 1; i >= 0; i--) {
            if (revenue >= STAR_LEVELS[i].minRevenue) {
                return STAR_LEVELS[i].level;
            }
        }

        return 0; // 营收低于1万，不是繁星主播
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
        const isSigned = anchor.is_signed;
        const uname = anchor.uname;
        const baseStarLevel = anchor.star_level || 0; // 基础主播等级
        const validLiveDay = anchor.valid_live_day || 0;
        const starMetrics = anchor.star_metrics;
        const face = anchor.face || '';

        // 计算繁星等级
        const starRank = calculateStarRank(starMetrics);

        // 判断是否是繁星主播
        const isStarAnchor = starRank > 0;

        // 在页面上显示状态
        showStatusOnPage(isSigned, uname, baseStarLevel, validLiveDay, isStarAnchor, face, starRank);
    }

    // 在页面上显示状态的函数
    function showStatusOnPage(isSigned, uname, baseStarLevel, validLiveDay, isStarAnchor, face, starRank, customMessage = null) {
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
            // 确定状态颜色和图标 - 反转颜色逻辑：未签约绿色，已签约红色
            let statusColor, statusIcon, statusText;
            if (isSigned === true) {
                statusColor = '#ff4d4f'; // 红色 - 已签约
                statusIcon = '📝';
                statusText = '已签约';
            } else if (isSigned === false) {
                statusColor = '#52c41a'; // 绿色 - 未签约
                statusIcon = '🔍';
                statusText = '未签约';
            } else {
                statusColor = '#8c8c8c'; // 灰色 - 状态未知
                statusIcon = '❓';
                statusText = '状态未知';
            }

            // 繁星状态
            const starStatus = isStarAnchor ? '繁星主播' : '非繁星主播';
            const starStatusColor = isStarAnchor ? '#faad14' : '#8c8c8c';

            // 头像HTML
            const faceHtml = face ? `<img src="${face}" style="width: 44px; height: 44px; border-radius: 50%; margin-right: 12px; object-fit: cover; border: 2px solid #f0f0f0;">` : '';

            // 创建内容HTML - 优化排版
            const contentHtml = `
                <div style="display: flex; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #f0f0f0; padding-bottom: 14px;">
                    ${faceHtml}
                    <div style="flex: 1;">
                        <div class="anchor-name" style="font-size: 15px; color: #262626; margin-bottom: 6px;">${uname}</div>
                        <div style="display: flex; align-items: center;">
                            <span style="font-size: 14px; margin-right: 6px; color: ${statusColor};">${statusIcon}</span>
                            <span style="font-size: 12px; color: ${statusColor}; font-weight: 500;">${statusText}</span>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="metric-label" style="color: #595959; white-space: nowrap; font-size: 12px; font-weight: bold;">繁星状态:</span>
                        <span style="color: ${starStatusColor}; font-weight: 600; white-space: nowrap; font-size: 12px;">${starStatus}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="metric-label" style="color: #595959; white-space: nowrap; font-size: 12px; font-weight: bold;">繁星等级:</span>
                        <span class="metric-value" style="color: #faad14; white-space: nowrap; font-size: 12px;">${isStarAnchor ? `${starRank}星` : '无'}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span class="metric-label" style="color: #595959; white-space: nowrap; font-size: 12px; font-weight: bold;">基础等级:</span>
                        <span class="metric-value" style="color: #722ed1; white-space: nowrap; font-size: 12px;">Lv.${baseStarLevel}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="metric-label" style="color: #595959; white-space: nowrap; font-size: 12px; font-weight: bold;">有效开播:</span>
                        <span class="metric-value" style="color: #1890ff; white-space: nowrap; font-size: 12px;">${validLiveDay} 天</span>
                    </div>
                </div>
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
        console.error(`[签约查询错误] ${title}: ${message}`);

        // 在页面上显示错误信息
        showStatusOnPage(null, "查询失败", null, null, null, null, null, `${title}: ${message}`);

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
