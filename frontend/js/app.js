/**
 * 旅游助手 - 前端应用
 * 家庭旅游规划 H5 网页
 */

// ========== 配置 ==========
// API 使用相对路径（前后端同服务器，无需跨域）
const API_BASE = '';

// ========== DOM 元素 ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Tab 页面
const tabPages = $$('.tab-page');
const navItems = $$('.nav-item');

// 首页
const searchKeyword = $('#search-keyword');
const searchCity = $('#search-city');
const btnSearch = $('#btn-search');
const searchResults = $('#search-results');
const routeDestination = $('#route-destination');
const routeDate = $('#route-date');
const routeDays = $('#route-days');
const routeBudget = $('#route-budget');
const routeDeparture = $('#route-departure');
const budgetPresets = $$('.budget-preset');
const btnGenerate = $('#btn-generate');
const routeResult = $('#route-result');

// 详情弹窗
const detailModal = $('#detail-modal');
const detailClose = $('#detail-close');
const detailName = $('#detail-name');
const detailRating = $('#detail-rating');
const detailCost = $('#detail-cost');
const detailTime = $('#detail-time');
const detailPhone = $('#detail-phone');
const detailAddress = $('#detail-address');
const detailType = $('#detail-type');
const detailPhotos = $('#detail-photos');
const detailLike = $('#detail-like');
const detailDislike = $('#detail-dislike');
let currentDetailAttraction = null;
let currentRouteData = null;  // 当前生成的路线数据，用于保存

// 已保存路线 + 完整线路
const savedRoutesCard = $('#saved-routes-card');
const savedRoutesList = $('#saved-routes-list');
const fullrouteModal = $('#fullroute-modal');
const fullrouteClose = $('#fullroute-close');
const fullrouteBody = $('#fullroute-body');

// 天气
const weatherCity = $('#weather-city');
const btnWeather = $('#btn-weather');
const weatherResult = $('#weather-result');

// 偏好
const prefName = $('#pref-name');
const prefType = $('#pref-type');
const btnAddWhitelist = $('#btn-add-whitelist');
const btnAddBlacklist = $('#btn-add-blacklist');
const whitelistItems = $('#whitelist-items');
const blacklistItems = $('#blacklist-items');

// 设置
const settingCity = $('#setting-city');
const btnSaveCity = $('#btn-save-city');
const settingAmapKey = $('#setting-amap-key');
const btnSaveKeys = $('#btn-save-keys');

// 通用
const toastEl = $('#toast');
const loadingEl = $('#loading');

// ========== 工具函数 ==========
function showToast(msg, type = '') {
    toastEl.textContent = msg;
    toastEl.className = 'toast ' + type + ' show';
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 2500);
}

function showLoading() {
    loadingEl.style.display = 'flex';
}

function hideLoading() {
    loadingEl.style.display = 'none';
}

async function api(method, path, body = null) {
    const url = API_BASE + path;
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
        opts.body = JSON.stringify(body);
    }
    const resp = await fetch(url, opts);
    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(data.error || '请求失败');
    }
    return data;
}

// 天气图标映射
function weatherIcon(desc) {
    if (!desc) return '🌈';
    const map = {
        '晴': '☀️', '少云': '🌤️', '晴间多云': '⛅',
        '多云': '☁️', '阴': '☁️',
        '小雨': '🌧️', '中雨': '🌧️', '大雨': '⛈️', '暴雨': '⛈️',
        '小雪': '🌨️', '中雪': '🌨️', '大雪': '❄️', '暴雪': '❄️',
        '阵雨': '🌦️', '雷阵雨': '⛈️',
        '雾': '🌫️', '霾': '🌫️', '浮尘': '💨',
        '风': '💨', '大风': '💨',
    };
    for (const [key, icon] of Object.entries(map)) {
        if (desc.includes(key)) return icon;
    }
    return '🌈';
}

// ========== Tab 切换 ==========
function switchTab(tabName) {
    tabPages.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));

    const page = document.getElementById('tab-' + tabName);
    if (page) page.classList.add('active');

    const nav = document.querySelector(`[data-tab="tab-${tabName}"]`);
    if (nav) nav.classList.add('active');

    // 切换到首页时加载已保存路线
    if (tabName === 'home') loadSavedRoutes();
    // 切换到偏好 tab 时刷新
    if (tabName === 'preferences') loadPreferences();
    // 切换到设置 tab 时加载配置
    if (tabName === 'settings') loadSettings();
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const tabName = item.dataset.tab.replace('tab-', '');
        switchTab(tabName);
    });
});

// ========== 预算预设 ==========
budgetPresets.forEach(btn => {
    btn.addEventListener('click', () => {
        budgetPresets.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const budget = btn.dataset.budget;
        routeBudget.value = budget;
        // 根据预算自动推荐天数
        if (budget === '1500') routeDays.value = '2';
        else if (budget === '3000') routeDays.value = '3';
        else routeDays.value = '4';
        // 聚焦到目的地输入框
        routeDestination.focus();
    });
});

// ========== 景点详情弹窗 ==========
function openDetail(attraction) {
    currentDetailAttraction = attraction;
    detailName.textContent = attraction.name;
    detailRating.textContent = attraction.rating || '暂无';
    detailCost.textContent = formatTicketText(attraction);
    detailCost.title = attraction.ticket_source || '';
    detailTime.textContent = '加载中...';
    detailPhone.textContent = '加载中...';
    detailAddress.textContent = attraction.address || '';
    detailType.textContent = attraction.type || '';
    detailPhotos.innerHTML = attraction.photo
        ? `<img src="${attraction.photo}" alt="${attraction.name}" onerror="this.style.display='none'">`
        : '<p style="color:#999;text-align:center;padding:20px;">暂无照片</p>';
    detailModal.style.display = 'flex';

    // 异步加载详情
    const params = `id=${encodeURIComponent(attraction.id)}`;
    api('GET', `/api/attractions/detail?${params}`)
        .then(d => {
            detailTime.textContent = d.open_time || '暂无';
            detailPhone.textContent = d.phone || '暂无';
            detailCost.textContent = formatTicketText(d);
            detailCost.title = d.ticket_source || '';
            if (d.photos && d.photos.length > 0) {
                detailPhotos.innerHTML = d.photos.map(url =>
                    `<img src="${url}" alt="" onerror="this.style.display='none'">`
                ).join('');
            }
            currentDetailAttraction = { ...currentDetailAttraction, ...d };
        })
        .catch(() => {
            detailTime.textContent = '暂无';
            detailPhone.textContent = '暂无';
        });
}

function closeDetail() {
    detailModal.style.display = 'none';
    currentDetailAttraction = null;
}

detailClose.addEventListener('click', closeDetail);
detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetail();
});

// 弹窗中添加到偏好
detailLike.addEventListener('click', async () => {
    if (!currentDetailAttraction) return;
    try {
        await api('POST', '/api/preferences', {
            name: currentDetailAttraction.name,
            type: currentDetailAttraction.type || '',
            list: 'whitelist',
        });
        showToast('已加入白名单！', 'success');
        closeDetail();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

detailDislike.addEventListener('click', async () => {
    if (!currentDetailAttraction) return;
    try {
        await api('POST', '/api/preferences', {
            name: currentDetailAttraction.name,
            type: currentDetailAttraction.type || '',
            list: 'blacklist',
        });
        showToast('已加入黑名单！', 'success');
        closeDetail();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ========== 地图生成 ==========
function generateMapImage(mapUrlFromServer) {
    // 地图 URL 由后端生成（保护 API Key 安全）
    return mapUrlFromServer || '';
}

// ========== 保存路线 ==========
async function saveRoute() {
    if (!currentRouteData) {
        showToast('没有可保存的路线', 'error');
        return;
    }
    const dest = currentRouteData.summary.destination;
    const name = prompt('给这条路线起个名字：', dest);
    if (!name) return;

    try {
        const resp = await api('POST', '/api/routes/saved', {
            name: name.trim(),
            route_data: currentRouteData,
        });
        showToast(resp.message, 'success');
        loadSavedRoutes();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadSavedRoutes() {
    try {
        const data = await api('GET', '/api/routes/saved');
        const routes = data.routes || [];
        if (routes.length === 0) {
            savedRoutesCard.style.display = 'none';
            return;
        }
        savedRoutesCard.style.display = 'block';
        savedRoutesList.innerHTML = routes.map(r => `
            <div class="saved-route-card">
                <div class="saved-route-info">
                    <div class="saved-route-name">📌 ${escHtml(r.name)}</div>
                    <div class="saved-route-meta">${escHtml(r.destination)} · ${r.days}天 · ¥${r.budget} · ${r.saved_at ? r.saved_at.slice(0, 10) : ''}</div>
                </div>
                <div class="saved-route-actions">
                    <button class="btn btn-sm btn-primary load-route" data-id="${r.id}">查看</button>
                    <button class="btn btn-sm btn-outline del-route" data-id="${r.id}">删除</button>
                </div>
            </div>
        `).join('');

        savedRoutesList.querySelectorAll('.load-route').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    showLoading();
                    const data = await api('GET', `/api/routes/saved/${btn.dataset.id}`);
                    renderRoute(data, null, null, 'comfort');
                    hideLoading();
                } catch (err) {
                    showToast(err.message, 'error');
                    hideLoading();
                }
            });
        });

        savedRoutesList.querySelectorAll('.del-route').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('确定删除这条路线吗？')) return;
                try {
                    await api('DELETE', `/api/routes/saved/${btn.dataset.id}`);
                    showToast('已删除', 'success');
                    loadSavedRoutes();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });
    } catch (err) {
        console.error('加载已保存路线失败:', err);
    }
}

// ========== 完整线路视图 ==========
function showFullRoute(data) {
    const { summary, itinerary } = data;
    let html = '';

    // 概览
    html += `<div style="text-align:center;margin-bottom:16px;">
        <h3 style="margin:0;">${summary.departure} → ${summary.destination}</h3>
        <p style="color:#999;font-size:13px;">${summary.days}天 · ¥${summary.total_estimated} · ${summary.budget_fit}</p>
    </div>`;

    // 时间线
    html += '<div class="timeline">';

    itinerary.forEach(item => {
        if (item.type === 'city_header') {
            html += `
                <div class="timeline-item city-header">
                    <span class="city-badge">🏙️ ${escHtml(item.city)}</span>
                    <span class="city-days">从第${item.day_start}天开始</span>
                </div>
            `;
        } else if (item.type === 'transport') {
            html += `
                <div class="timeline-item transport">
                    <div class="transport-badge">
                        <span class="trans-icon">🚄</span>
                        <span class="trans-info">${escHtml(item.from_city)} → ${escHtml(item.to_city)}<br><small>${item.mode} · ${item.duration}</small></span>
                        <span class="trans-cost">¥${item.cost}</span>
                    </div>
                </div>
            `;
        } else if (item.type === 'day' || item.day) {
            const w = item.weather || {};
            html += `
                <div class="timeline-item">
                    <div class="timeline-day">
                        <div class="td-header">📅 第${item.day}天 · ${item.date} ${w.weather_day ? `· ${weatherIcon(w.weather_day)} ${w.weather_day} ${w.temp_min}°~${w.temp_max}°` : ''}</div>
                        <div class="td-spots">
                            ${(item.attractions || []).map(a => `<span>${escHtml(a.name)}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
    });

    html += '</div>';
    fullrouteBody.innerHTML = html;
    fullrouteModal.style.display = 'flex';
}

fullrouteClose.addEventListener('click', () => { fullrouteModal.style.display = 'none'; });
fullrouteModal.addEventListener('click', (e) => {
    if (e.target === fullrouteModal) fullrouteModal.style.display = 'none';
});

// ========== 首页 - 搜索景点 ==========
btnSearch.addEventListener('click', async () => {
    const keyword = searchKeyword.value.trim();
    if (!keyword) {
        showToast('请输入景点名称', 'error');
        return;
    }

    showLoading();
    try {
        const city = searchCity.value.trim();
        let url = `/api/attractions?keyword=${encodeURIComponent(keyword)}`;
        if (city) url += `&city=${encodeURIComponent(city)}`;

        const data = await api('GET', url);
        renderSearchResults(data.attractions);
        if (data.attractions.length === 0) {
            showToast('未找到相关景点');
        }
    } catch (err) {
        showToast(err.message, 'error');
        searchResults.innerHTML = '';
    } finally {
        hideLoading();
    }
});

// 搜索框回车触发
searchKeyword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnSearch.click();
});

function renderSearchResults(attractions) {
    if (!attractions || attractions.length === 0) {
        searchResults.innerHTML = '<p class="empty-hint">暂无结果</p>';
        return;
    }
    searchResults.innerHTML = attractions.map((a, i) => `
        <div class="result-item" data-attraction-index="${i}">
            <div class="result-photo">${a.photo ? `<img src="${a.photo}" alt="${escHtml(a.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '🏞️'}</div>
            <div class="result-info">
                <div class="result-name">${escHtml(a.name)}</div>
                ${a.type ? `<span class="result-type">${escHtml(a.type)}</span>` : ''}
                <div class="result-address">📍 ${escHtml(a.address || a.city || '')}</div>
                <div class="result-meta">
                    ${a.rating ? `<span>⭐ ${a.rating}</span>` : ''}
                    <span title="${escHtml(a.ticket_source || '')}">🎫 ${formatTicketText(a)}</span>
                </div>
            </div>
        </div>
    `).join('');

    // 点击打开详情弹窗
    searchResults.querySelectorAll('.result-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.attractionIndex);
            openDetail(attractions[idx]);
        });
    });
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTicketText(attraction) {
    const price = Number(attraction.estimated_cost ?? attraction.ticket ?? attraction.cost ?? 0);
    const confirmed = Boolean(attraction.cost_confirmed);
    if (confirmed && price === 0) return '免费（需预约时以官方为准）';
    if (confirmed) return `¥${price}（挂牌价参考）`;
    if (price > 0) return `约 ¥${price}`;
    return '票价待确认';
}

function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod|HarmonyOS/i.test(navigator.userAgent);
}

function openMobileAppWithFallback(appUrl, webUrl) {
    let fallbackTimer = null;
    const cancelFallback = () => {
        if (document.hidden && fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
        }
    };
    document.addEventListener('visibilitychange', cancelFallback, { once: true });
    window.location.href = appUrl;
    fallbackTimer = setTimeout(() => {
        document.removeEventListener('visibilitychange', cancelFallback);
        if (!document.hidden) window.location.href = webUrl;
    }, 1400);
}

// ========== 首页 - 路线生成 ==========
btnGenerate.addEventListener('click', async () => {
    const destination = routeDestination.value.trim();
    if (!destination) {
        showToast('请输入目的地城市', 'error');
        return;
    }

    const days = parseInt(routeDays.value) || 0;
    const budget = parseInt(routeBudget.value) || 0;
    const departure = routeDeparture.value.trim();

    // 自动记住出发城市
    if (departure) {
        try {
            await api('PUT', '/api/config', { default_city: departure });
        } catch (e) { /* 忽略保存失败 */ }
    }

    showLoading();
    try {
        const body = { destination };
        if (routeDate.value) body.start_date = routeDate.value;
        if (days > 0) body.days = days;
        if (budget > 0) body.budget = budget;
        if (departure) body.departure = departure;

        const data = await api('POST', '/api/route/generate', body);

        // 同时加载酒店推荐和攻略链接
        let hotelData = null;
        let guideData = null;
        const budgetLevel = budget <= 2000 ? 'budget' : budget <= 5000 ? 'comfort' : 'luxury';
        try {
            hotelData = await api('GET', `/api/hotels?city=${encodeURIComponent(destination)}&budget_level=${budgetLevel}`);
        } catch (e) { /* silent */ }
        try {
            guideData = await api('GET', `/api/guide?city=${encodeURIComponent(destination)}`);
        } catch (e) { /* silent */ }

        renderRoute(data, hotelData, guideData, budgetLevel);
    } catch (err) {
        showToast(err.message, 'error');
        routeResult.innerHTML = '';
    } finally {
        hideLoading();
    }
});

let currentHotelLevel = '';
let originalCostBreakdown = null;
let originalTotalCost = 0;

function renderRoute(data, hotelData, guideData, budgetLevel) {
    currentRouteData = data;
    const { summary, itinerary, hotel_level } = data;
    currentHotelLevel = hotel_level;
    originalCostBreakdown = { ...summary.cost_breakdown };
    originalTotalCost = summary.total_estimated;

    let html = '';

    // 概览
    const fitClass = summary.budget_fit.includes('超出') ? 'over' : 'ok';
    html += `
        <div class="route-summary">
            <h3>🎯 ${summary.departure} → ${summary.destination}</h3>
            <div class="summary-rows">
                <div class="summary-item">
                    <div class="summary-val">${summary.days}</div>
                    <div class="summary-label">天数</div>
                </div>
                <div class="summary-item">
                    <div class="summary-val">${summary.cities ? summary.cities.length : 1}</div>
                    <div class="summary-label">城市</div>
                </div>
                <div class="summary-item">
                    <div class="summary-val">¥${summary.total_estimated}</div>
                    <div class="summary-label">预估总费用</div>
                </div>
                <div class="summary-item">
                    <div class="summary-val">${hotel_level}</div>
                    <div class="summary-label">住宿等级</div>
                </div>
            </div>
            <div class="budget-fit ${fitClass}">${summary.budget_fit}</div>
        </div>
    `;

    // 城际交通概览（多城市时显示）
    if (summary.intercity_transports && summary.intercity_transports.length > 0) {
        html += `<div class="transport-badge" style="margin-bottom:12px;">`;
        html += `<span class="trans-icon">🚄</span><span class="trans-info">`;
        summary.intercity_transports.forEach((t, i) => {
            html += `${t.from} → ${t.to}: ${t.mode} ¥${t.cost} (${t.duration})`;
            if (i < summary.intercity_transports.length - 1) html += ' | ';
        });
        html += `</span></div>`;
    }

    // 每日行程（处理多城市格式）
    let currentCity = '';
    itinerary.forEach(item => {
        if (item.type === 'city_header') {
            currentCity = item.city;
            html += `<div style="text-align:center;margin:16px 0 8px;">
                <span class="city-badge">🏙️ ${escHtml(item.city)}</span>
            </div>`;
        } else if (item.type === 'transport') {
            html += `
                <div class="transport-badge">
                    <span class="trans-icon">🚄</span>
                    <span class="trans-info">${escHtml(item.from_city)} → ${escHtml(item.to_city)}: ${item.mode} ${item.duration}</span>
                    <span class="trans-cost">¥${item.cost}</span>
                </div>
            `;
        } else if (item.type === 'day' || item.day) {
            const w = item.weather || {};
            const hasWeather = w.weather_day && w.temp_max;
            const cityLabel = currentCity && summary.is_multi_city ? `🏙️ ${currentCity} · ` : '';
            html += `
                <div class="day-card">
                    <div class="day-header">
                        <span>📅 ${cityLabel}第${item.day}天 · ${item.date}</span>
                        ${hasWeather ? `<span class="day-weather-inline">${weatherIcon(w.weather_day)} ${w.weather_day} ${w.temp_min}°~${w.temp_max}°</span>` : ''}
                        <span>💰 ¥${item.day_total}</span>
                    </div>
                    <div class="day-body">
                        ${(item.attractions || []).map(a => `
                            <div class="day-attraction clickable" data-id="${escHtml(a.id || a.name)}">
                                <span class="day-attr-name">🏛️ ${escHtml(a.name)}</span>
                                <span class="day-attr-tag">${escHtml(a.type)}</span>
                                <span class="day-attr-cost" title="${escHtml(a.ticket_source || '')}">🎫 ${formatTicketText(a)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="day-footer">
                        <span class="hotel-toggle" data-day="${item.day}" data-cost="${item.hotel_cost}">🏨 ${item.hotel} ¥${item.hotel_cost} <small style="color:var(--primary);cursor:pointer;">[不住]</small></span>
                        <span>🍜 餐饮 ¥${item.food_cost}</span>
                        <span>🚌 交通 ¥${item.transport_cost}</span>
                    </div>
                    <div class="feedback-row">
                        <button class="feedback-btn" data-action="like" data-day="${item.day}">👍 喜欢</button>
                        <button class="feedback-btn" data-action="dislike" data-day="${item.day}">👎 不喜欢</button>
                    </div>
                </div>
            `;
        }
    });

    // 费用明细
    html += `
        <div class="cost-breakdown">
            <h4>📊 费用明细</h4>
            <div class="cost-row"><span>🚄 城际交通</span><span>¥${summary.cost_breakdown.transport_intercity}</span></div>
            <div class="cost-row"><span>🏨 住宿 (${summary.days}晚)</span><span>¥${summary.cost_breakdown.hotel}</span></div>
            <div class="cost-row"><span>🍜 餐饮 (${summary.days}天)</span><span>¥${summary.cost_breakdown.food}</span></div>
            <div class="cost-row"><span>🚌 市内交通</span><span>¥${summary.cost_breakdown.transport_inner}</span></div>
            <div class="cost-row"><span>🎫 门票</span><span>¥${summary.cost_breakdown.tickets}</span></div>
            <div class="cost-row" style="font-weight:700; border-top:1px solid #ddd; padding-top:4px; margin-top:4px;">
                <span>总计</span><span style="color:var(--primary-dark)">¥${summary.total_estimated}</span>
            </div>
        </div>
    `;

    // 完整线路时间线（内联显示）
    html += '<h3 style="margin-top:16px;margin-bottom:8px;">📋 完整线路</h3>';
    html += '<div class="timeline" style="margin-bottom:12px;">';
    itinerary.forEach(item => {
        if (item.type === 'city_header') {
            html += `<div class="timeline-item city-header"><span class="city-badge">🏙️ ${escHtml(item.city)}</span></div>`;
        } else if (item.type === 'transport') {
            html += `<div class="timeline-item transport"><div class="transport-badge"><span class="trans-icon">🚄</span><span class="trans-info">${escHtml(item.from_city)} → ${escHtml(item.to_city)} · ${item.mode} ${item.duration}</span><span class="trans-cost">¥${item.cost}</span></div></div>`;
        } else if (item.type === 'day' || item.day) {
            const w = item.weather || {};
            html += `<div class="timeline-item"><div class="timeline-day"><div class="td-header">📅 第${item.day}天 · ${item.date} ${w.weather_day ? `· ${weatherIcon(w.weather_day)} ${w.weather_day}` : ''}</div><div class="td-spots">${(item.attractions || []).map(a => `<span>${escHtml(a.name)}</span>`).join('')}</div></div></div>`;
        }
    });
    html += '</div>';

    // 地图由本站代理生成；加入刷新标识，避免浏览器缓存曾经的错误响应。
    const routePoints = itinerary
        .filter(item => item.type === 'day' || item.day)
        .flatMap(item => item.attractions || [])
        .map(item => item.location)
        .filter(Boolean)
        .slice(0, 10);
    let mapUrl = data.map_image_url || data.map_url || '';
    // 兼容修复前保存的旧路线：旧数据含错误的高德静态图参数，按坐标重建代理地址。
    if (routePoints.length && (!mapUrl || mapUrl.includes('restapi.amap.com/v3/staticmap'))) {
        mapUrl = `/api/map-image?points=${encodeURIComponent(routePoints.join('|'))}`;
    }
    const navUrl = data.nav_url || '';
    if (mapUrl) {
        const refreshedMapUrl = `${mapUrl}${mapUrl.includes('?') ? '&' : '?'}refresh=${Date.now()}`;
        html += `
            <div class="map-container" style="margin-top:16px;">
                <h3 style="margin-bottom:8px;">🗺️ 路线地图</h3>
                <img id="route-map-image" src="${refreshedMapUrl}" data-base-src="${mapUrl}" alt="路线地图" style="width:100%;">
                <div id="route-map-error" class="map-placeholder" style="display:none;">
                    <span>地图暂时没有加载出来</span>
                    <button id="btn-retry-map" type="button" class="btn btn-outline btn-sm">重新加载</button>
                </div>
                ${navUrl ? `<a href="${navUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-block" style="margin-top:8px;">🗺️ 在高德地图中打开导航</a>` : ''}
            </div>
        `;
    }

    // 酒店
    if (hotelData && hotelData.hotels && hotelData.hotels.length > 0) {
        html += `
            <div class="hotel-section">
                <h3>🏨 附近酒店推荐</h3>
                ${hotelData.hotels.slice(0, 4).map(h => `
                    <div class="hotel-card">
                        <div class="hotel-photo">${h.photo ? `<img src="${h.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '🏨'}</div>
                        <div class="hotel-info">
                            <div class="hotel-name">${escHtml(h.name)}</div>
                            <div class="hotel-meta">📍 ${escHtml(h.address || '')} ${h.rating ? '⭐'+h.rating : ''}</div>
                        </div>
                        <div class="hotel-price">
                            <div class="price-val">¥${h.estimated_price}</div>
                            <div class="price-label">约/晚</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // 全网攻略推荐
    if (guideData && guideData.guides && guideData.guides.length > 0) {
        html += `
            <div class="guide-section" style="margin-top:16px;">
                <h3 style="margin-bottom:8px;">🌐 全网攻略推荐</h3>
                <div class="guide-links">
                    ${guideData.guides.map(g => `
                        <a href="${g.url}" target="_blank" rel="noopener" class="guide-link" ${g.app_url ? `data-app-url="${escHtml(g.app_url)}" data-web-url="${escHtml(g.url)}"` : ''}>
                            <span class="guide-icon">${g.icon}</span>
                            <div class="guide-info">
                                <div class="guide-name">${escHtml(g.platform)}</div>
                                <div class="guide-desc">${escHtml(g.desc)}</div>
                            </div>
                            <span class="guide-arrow">→</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 保存按钮 + 查看完整线路
    html += `
        <div class="route-actions">
            <button id="btn-save-route" class="btn btn-outline">💾 保存路线</button>
            <button id="btn-fullroute" class="btn btn-primary">📋 查看完整线路</button>
        </div>
    `;

    routeResult.innerHTML = html;

    const mapImage = $('#route-map-image');
    const mapError = $('#route-map-error');
    if (mapImage && mapError) {
        mapImage.addEventListener('load', () => {
            mapImage.style.display = 'block';
            mapError.style.display = 'none';
        });
        mapImage.addEventListener('error', () => {
            mapImage.style.display = 'none';
            mapError.style.display = 'flex';
        });
        if (mapImage.complete) {
            if (mapImage.naturalWidth > 0) {
                mapImage.style.display = 'block';
                mapError.style.display = 'none';
            } else {
                mapImage.style.display = 'none';
                mapError.style.display = 'flex';
            }
        }
        $('#btn-retry-map').addEventListener('click', () => {
            mapError.style.display = 'none';
            mapImage.style.display = 'block';
            const separator = mapImage.dataset.baseSrc.includes('?') ? '&' : '?';
            mapImage.src = `${mapImage.dataset.baseSrc}${separator}refresh=${Date.now()}`;
        });
    }

    routeResult.querySelectorAll('.guide-link[data-app-url]').forEach(link => {
        link.addEventListener('click', event => {
            if (!isMobileBrowser()) return;
            event.preventDefault();
            openMobileAppWithFallback(link.dataset.appUrl, link.dataset.webUrl);
        });
    });

    // 保存按钮
    $('#btn-save-route').addEventListener('click', () => saveRoute());
    $('#btn-fullroute').addEventListener('click', () => showFullRoute(data));

    // 反馈按钮
    routeResult.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const action = this.dataset.action;
            const allBtns = this.parentElement.querySelectorAll('.feedback-btn');
            const dayCard = this.closest('.day-card');
            const names = Array.from(dayCard.querySelectorAll('.day-attr-name'))
                .map(el => el.textContent.replace('🏛️ ', ''));

            for (const name of names) {
                try {
                    await api('POST', '/api/preferences', { name, type: '', list: action === 'like' ? 'whitelist' : 'blacklist' });
                } catch (e) { /* ignore duplicates */ }
            }

            allBtns.forEach(b => b.classList.remove('liked', 'disliked'));
            this.classList.add(action === 'like' ? 'liked' : 'disliked');
            showToast(`已加入${action === 'like' ? '白名单' : '黑名单'}！`, 'success');
        });
    });

    // 景点点击查看详情
    routeResult.querySelectorAll('.day-attraction.clickable').forEach(item => {
        item.addEventListener('click', () => {
            const attrId = item.dataset.id;
            const allAttr = itinerary
                .filter(i => i.type === 'day' || i.day)
                .flatMap(i => i.attractions || []);
            const found = allAttr.find(a => (a.id || a.name) === attrId);
            if (found) {
                openDetail({
                    id: found.id || '',
                    name: found.name,
                    type: found.type || '',
                    address: found.address || '',
                    rating: found.rating || '',
                    estimated_cost: found.ticket || 0,
                    cost_confirmed: found.cost_confirmed || false,
                    ticket_source: found.ticket_source || '',
                    location: found.location || '',
                    photo: '',
                });
            }
        });
    });

    // 酒店切换：点击 [不住] 切���当天酒店费用
    routeResult.onclick = function(e) {
        const target = e.target;
        if (target.tagName === 'SMALL' && target.parentElement.classList.contains('hotel-toggle')) {
            e.stopPropagation();
            const span = target.parentElement;
            const originalCost = parseInt(span.dataset.cost);
            const isOff = span.classList.toggle('hotel-off');
            if (isOff) {
                span.innerHTML = `🏠 不住 ¥0 <small style="color:var(--success);cursor:pointer;">[恢复]</small>`;
                span.dataset.currentCost = '0';
            } else {
                span.innerHTML = `🏨 ${currentHotelLevel || '酒店'} ¥${originalCost} <small style="color:var(--primary);cursor:pointer;">[不住]</small>`;
                span.dataset.currentCost = originalCost.toString();
            }
            span.dataset.cost = originalCost.toString();
            recalcRouteTotal();
        }
    };

    routeResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========== 天气查询 ==========
btnWeather.addEventListener('click', async () => {
    const city = weatherCity.value.trim();
    if (!city) {
        showToast('请输入城市名称', 'error');
        return;
    }

    showLoading();
    try {
        const data = await api('GET', `/api/weather?city=${encodeURIComponent(city)}`);
        renderWeather(data);
    } catch (err) {
        showToast(err.message, 'error');
        weatherResult.innerHTML = '';
    } finally {
        hideLoading();
    }
});

weatherCity.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnWeather.click();
});

function renderWeather(data) {
    let html = `<div class="weather-city">📍 ${escHtml(data.city)}</div><div class="weather-grid">`;

    data.forecasts.forEach((day, i) => {
        const isToday = i === 0;
        const icon = weatherIcon(day.weather_day);

        if (isToday) {
            html += `
                <div class="weather-card today">
                    <div>
                        <div class="w-icon">${icon}</div>
                        <div class="w-desc">${day.weather_day}</div>
                    </div>
                    <div class="w-today-info">
                        <div class="w-today-temp">${day.temp_max}°</div>
                        <div class="w-today-range">↓ ${day.temp_min}°</div>
                        <div style="margin-top:8px;font-size:13px;color:#666;">
                            🌬️ ${day.wind_dir} ${day.wind_scale}级
                            ${day.humidity ? `💧 ${day.humidity}%` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="weather-card">
                    <div class="w-date">${day.date}</div>
                    <div class="w-icon">${icon}</div>
                    <div class="w-temp">${day.temp_max}° / ${day.temp_min}°</div>
                    <div class="w-desc">${day.weather_day}</div>
                    <div class="w-detail">🌬️ ${day.wind_dir} ${day.wind_scale}级</div>
                </div>
            `;
        }
    });

    html += '</div>';
    weatherResult.innerHTML = html;
}

// ========== 偏好管理 ==========
async function loadPreferences() {
    try {
        const data = await api('GET', '/api/preferences');
        renderPrefList(whitelistItems, data.whitelist, 'whitelist');
        renderPrefList(blacklistItems, data.blacklist, 'blacklist');
    } catch (err) {
        console.error('加载偏好失败:', err);
    }
}

function renderPrefList(container, items, listType) {
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="empty-hint">暂无数据</p>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="pref-item">
            <div>
                <span class="pref-name">${escHtml(item.name)}</span>
                ${item.type ? `<span class="pref-tag">${escHtml(item.type)}</span>` : ''}
            </div>
            <div class="pref-meta">
                <span style="font-size:12px;color:#999;">${item.added_at ? item.added_at.slice(0, 10) : ''}</span>
                <button class="btn-delete" data-id="${item.id}" data-list="${listType}">🗑️</button>
            </div>
        </div>
    `).join('');

    // 绑定删除事件
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            try {
                await api('DELETE', `/api/preferences/${id}`);
                showToast('已删除', 'success');
                loadPreferences();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    });
}

async function addPreference(listType) {
    const name = prefName.value.trim();
    if (!name) {
        showToast('请输入名称', 'error');
        return;
    }
    try {
        await api('POST', '/api/preferences', {
            name,
            type: prefType.value.trim(),
            list: listType,
        });
        const label = listType === 'whitelist' ? '白名单' : '黑名单';
        showToast(`已加入${label}！`, 'success');
        prefName.value = '';
        prefType.value = '';
        loadPreferences();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

btnAddWhitelist.addEventListener('click', () => addPreference('whitelist'));
btnAddBlacklist.addEventListener('click', () => addPreference('blacklist'));

// ========== 设置管理 ==========
async function loadSettings() {
    try {
        const data = await api('GET', '/api/config');
        settingCity.value = data.default_city;
        // 更新出发城市显示
        if (routeDeparture) {
            routeDeparture.value = data.default_city;
            routeDeparture.placeholder = data.default_city;
        }
        // Key 状态提示
        if (data.has_amap_key) {
            settingAmapKey.placeholder = '已设置（输入新值将覆盖）';
        }
    } catch (err) {
        console.error('加载设置失败:', err);
    }
}

btnSaveCity.addEventListener('click', async () => {
    const city = settingCity.value.trim();
    if (!city) {
        showToast('请输入默认城市', 'error');
        return;
    }
    try {
        await api('PUT', '/api/config', { default_city: city });
        showToast('默认城市已更新', 'success');
        if (routeDeparture) {
            routeDeparture.value = city;
            routeDeparture.placeholder = city;
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
});

btnSaveKeys.addEventListener('click', async () => {
    const body = {};
    const amapKey = settingAmapKey.value.trim();

    if (amapKey) body.amap_key = amapKey;

    if (Object.keys(body).length === 0) {
        showToast('请输入至少一个 API Key', 'error');
        return;
    }

    try {
        await api('PUT', '/api/config', body);
        showToast('API Key 已保存！', 'success');
        settingAmapKey.value = '';
        loadSettings();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// 切换密码可见性
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle-key')) {
        const targetId = e.target.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
            e.target.textContent = input.type === 'password' ? '👁️' : '🙈';
        }
    }
});

// ========== 重算路线总费用 ==========
function recalcRouteTotal() {
    if (!originalCostBreakdown) return;

    // 计算当前各天酒店费用
    let currentHotelTotal = 0;
    routeResult.querySelectorAll('.hotel-toggle').forEach(span => {
        currentHotelTotal += parseInt(span.dataset.currentCost || span.dataset.cost || '0');
    });

    // 新总费用 = 原总费用 - 原酒店费 + 当前酒店费
    const oldHotel = originalCostBreakdown.hotel;
    const newTotal = originalTotalCost - oldHotel + currentHotelTotal;

    // 更新费用明细中的酒店和总计
    const costRows = routeResult.querySelectorAll('.cost-row');
    costRows.forEach(row => {
        const label = row.querySelector('span:first-child');
        const val = row.querySelector('span:last-child');
        if (!label || !val) return;
        if (label.textContent.includes('住宿')) {
            val.textContent = `¥${currentHotelTotal}`;
        }
        if (label.textContent.includes('总计')) {
            val.textContent = `¥${newTotal}`;
        }
    });
}

// ========== 初始加载 ==========
async function init() {
    // 加载默认配置
    try {
        const data = await api('GET', '/api/config');
        if (routeDeparture) {
            routeDeparture.value = data.default_city;
            routeDeparture.placeholder = data.default_city;
        }
        settingCity.value = data.default_city;
        // 加载已保存路线
        loadSavedRoutes();
    } catch (err) {
        // 后端未启动时的fallback
        console.warn('无法连接后端，请先启动 backend 服务');
        if (routeDeparture) {
            routeDeparture.value = '北京';
            routeDeparture.placeholder = '北京';
        }
    }
}

init();
