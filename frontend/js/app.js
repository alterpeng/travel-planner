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
const routeDays = $('#route-days');
const routeBudget = $('#route-budget');
const routeDeparture = $('#route-departure');
const btnGenerate = $('#btn-generate');
const routeResult = $('#route-result');

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
    searchResults.innerHTML = attractions.map(a => `
        <div class="result-item">
            <div class="result-photo">${a.photo ? `<img src="${a.photo}" alt="${a.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : '🏞️'}</div>
            <div class="result-info">
                <div class="result-name">${escHtml(a.name)}</div>
                ${a.type ? `<span class="result-type">${escHtml(a.type)}</span>` : ''}
                <div class="result-address">📍 ${escHtml(a.address || a.city || '')}</div>
                <div class="result-meta">
                    ${a.rating ? `<span>⭐ ${a.rating}</span>` : ''}
                    <span>💰 门票约 ¥${a.estimated_cost}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
        if (days > 0) body.days = days;
        if (budget > 0) body.budget = budget;
        if (departure) body.departure = departure;

        const data = await api('POST', '/api/route/generate', body);
        renderRoute(data);
    } catch (err) {
        showToast(err.message, 'error');
        routeResult.innerHTML = '';
    } finally {
        hideLoading();
    }
});

function renderRoute(data) {
    const { summary, itinerary, hotel_level, unused_attractions, blacklist_filtered } = data;

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
                    <div class="summary-val">¥${summary.total_estimated}</div>
                    <div class="summary-label">预估总费用</div>
                </div>
                <div class="summary-item">
                    <div class="summary-val">${hotel_level}</div>
                    <div class="summary-label">住宿等级</div>
                </div>
            </div>
            <div class="budget-fit ${fitClass}">${summary.budget_fit}</div>
            ${blacklist_filtered > 0 ? `<p style="margin-top:8px;font-size:13px;color:#999;">已自动过滤 ${blacklist_filtered} 个黑名单景点</p>` : ''}
        </div>
    `;

    // 每天行程
    itinerary.forEach(day => {
        const w = day.weather || {};
        const hasWeather = w.weather_day && w.temp_max;
        html += `
            <div class="day-card">
                <div class="day-header">
                    <span>📅 第${day.day}天 · ${day.date}</span>
                    ${hasWeather ? `<span class="day-weather-inline">${weatherIcon(w.weather_day)} ${w.weather_day} ${w.temp_min}°~${w.temp_max}° 🌬️${w.wind_dir}${w.wind_scale}级</span>` : ''}
                    <span>💰 ¥${day.day_total}</span>
                </div>
                <div class="day-body">
                    ${day.attractions.map(a => `
                        <div class="day-attraction">
                            <span class="day-attr-name">🏛️ ${escHtml(a.name)}</span>
                            <span class="day-attr-tag">${escHtml(a.type)}</span>
                            <span class="day-attr-cost">门票 ¥${a.ticket}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="day-footer">
                    <span>🏨 ${day.hotel} ¥${day.hotel_cost}</span>
                    <span>🍜 餐饮 ¥${day.food_cost}</span>
                    <span>🚌 交通 ¥${day.transport_cost}</span>
                </div>
                <div class="feedback-row">
                    <button class="feedback-btn" data-action="like" data-day="${day.day}">👍 喜欢这天</button>
                    <button class="feedback-btn" data-action="dislike" data-day="${day.day}">👎 不喜欢</button>
                </div>
            </div>
        `;
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

    // 未安排景点（如果存在）
    if (unused_attractions && unused_attractions.length > 0) {
        html += `
            <p style="margin-top:12px;font-size:13px;color:#999;text-align:center;">
                📌 还有 ${unused_attractions.length} 个景点未排入：${unused_attractions.map(a => escHtml(a.name)).join('、')}
            </p>
        `;
    }

    routeResult.innerHTML = html;

    // 绑定反馈按钮事件
    routeResult.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const action = this.dataset.action;
            const dayNum = this.dataset.day;
            const dayData = itinerary[parseInt(dayNum) - 1];

            if (!dayData) return;

            // 把该天的所有景点加入偏好
            for (const attr of dayData.attractions) {
                const listType = action === 'like' ? 'whitelist' : 'blacklist';
                try {
                    await api('POST', '/api/preferences', {
                        name: attr.name,
                        type: attr.type,
                        list: listType,
                    });
                } catch (err) {
                    // 已存在的忽略
                    if (!err.message.includes('已存在')) {
                        console.error(err);
                    }
                }
            }

            // UI 反馈
            const allBtns = this.parentElement.querySelectorAll('.feedback-btn');
            allBtns.forEach(b => b.classList.remove('liked', 'disliked'));
            this.classList.add(action === 'like' ? 'liked' : 'disliked');

            const label = action === 'like' ? '白名单' : '黑名单';
            showToast(`已加入${label}！`, 'success');
        });
    });

    // 滚动到路线结果
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
