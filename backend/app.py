"""
旅游助手 - Flask 后端
提供景点搜索、天气查询、路线生成、偏好管理等功能
"""

import os
import json
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# ========== 配置文件 ==========
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PREFERENCES_FILE = os.path.join(DATA_DIR, "preferences.json")
CONFIG_FILE = os.path.join(DATA_DIR, "config.json")

# API Keys（优先从环境变量读取，其次从 config.json）
AMAP_KEY = os.environ.get("AMAP_KEY", "")

# ========== 数据读取工具 ==========
def read_json(filepath, default=None):
    """安全读取 JSON 文件"""
    if default is None:
        default = {}
    try:
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return default

def write_json(filepath, data):
    """安全写入 JSON 文件"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ========== 偏好管理 ==========
def get_preferences():
    return read_json(PREFERENCES_FILE, {"whitelist": [], "blacklist": []})

def save_preferences(prefs):
    write_json(PREFERENCES_FILE, prefs)

# ========== 配置管理 ==========
def get_config():
    config = read_json(CONFIG_FILE, {"default_city": "北京"})
    # 尝试从环境变量或 config 文件获取 API keys
    if not AMAP_KEY and "amap_key" in config:
        pass  # Will use config fallback
    return config

def save_config(config):
    write_json(CONFIG_FILE, config)

# ========== 辅助函数 ==========
def get_amap_key():
    """获取高德地图 API Key（环境变量优先）"""
    if AMAP_KEY:
        return AMAP_KEY
    config = get_config()
    return config.get("amap_key", "")

# ========== 景点费用参考 ==========
# 按景点类型估算门票价格范围（元）
TICKET_ESTIMATE = {
    "风景名胜": (30, 150),
    "公园": (0, 50),
    "博物馆": (0, 80),
    "纪念馆": (0, 50),
    "寺庙": (10, 100),
    "游乐园": (100, 400),
    "动物园": (20, 150),
    "植物园": (10, 50),
    "温泉": (80, 300),
    "滑雪": (100, 500),
    "海滩": (0, 50),
    "山峰": (30, 150),
    "湖泊": (0, 80),
    "古镇": (0, 120),
    "古建筑": (20, 100),
}

def estimate_ticket(attraction_type):
    """估算景点门票价格"""
    for key, (low, high) in TICKET_ESTIMATE.items():
        if key in attraction_type:
            return round((low + high) / 2)
    return 50  # 默认估算

def estimate_accommodation(budget_per_day):
    """根据预算估算住宿等级"""
    if budget_per_day < 300:
        return "经济型", 120
    elif budget_per_day < 600:
        return "舒适型", 250
    elif budget_per_day < 1000:
        return "高档型", 450
    else:
        return "豪华型", 700

# ========== 重试机制（处理 API 超时等偶发失败）==========
def safe_request(url, params, timeout=10, max_retries=1):
    """带重试的 HTTP 请求"""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            resp = requests.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.Timeout as e:
            last_error = e
            if attempt < max_retries:
                continue
        except requests.exceptions.RequestException as e:
            last_error = e
            if attempt < max_retries:
                continue
    raise last_error

# ========== API 路由 ==========

# ===== 前端页面 =====
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")


@app.route("/")
def index():
    """首页"""
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    """静态资源（CSS、JS）"""
    # API 路径不处理
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(FRONTEND_DIR, path)


@app.route("/api/health")
def health():
    """健康检查"""
    return jsonify({"status": "ok", "time": datetime.now().isoformat()})


# ----- 景点搜索 -----
@app.route("/api/attractions")
def search_attractions():
    """
    搜索景点
    参数: keyword (必填), city (可选), page (可选, 默认1)
    """
    keyword = request.args.get("keyword", "").strip()
    city = request.args.get("city", "").strip()
    page = int(request.args.get("page", 1))

    if not keyword:
        return jsonify({"error": "请输入搜索关键词"}), 400

    key = get_amap_key()
    if not key:
        return jsonify({"error": "请先设置高德地图 API Key"}), 500

    # 构建高德 POI 搜索请求
    params = {
        "key": key,
        "keywords": keyword,
        "types": "风景名胜|公园|博物馆|纪念馆|寺庙道观|游乐园|动物园|植物园|温泉|海滩|山峰|湖泊|古镇|国家级景点|省级景点",
        "offset": 15,
        "page": page,
        "extensions": "all",
    }
    if city:
        params["city"] = city

    try:
        data = safe_request("https://restapi.amap.com/v3/place/text", params)

        if data.get("status") != "1":
            return jsonify({"error": data.get("info", "搜索失败")}), 500

        attractions = []
        for poi in data.get("pois", []):
            attraction = {
                "id": poi.get("id"),
                "name": poi.get("name"),
                "address": poi.get("address"),
                "city": poi.get("cityname") or (city if city else ""),
                "type": poi.get("type", "").split(";")[0] if poi.get("type") else "",
                "rating": poi.get("biz_ext", {}).get("rating", ""),
                "photo": "",
                "location": poi.get("location", ""),
                "distance": poi.get("distance", ""),
                "estimated_cost": estimate_ticket(
                    poi.get("type", "")
                ),
            }
            # 处理照片
            photos = poi.get("photos", [])
            if photos:
                # 高德图片需要拼接完整 URL
                photo_info = photos[0]
                photo_url = photo_info.get("url", "")
                if photo_url and not photo_url.startswith("http"):
                    photo_url = "https://" + photo_url.lstrip("/") if photo_url else ""
                attraction["photo"] = photo_url

            attractions.append(attraction)

        return jsonify({
            "attractions": attractions,
            "total": int(data.get("count", 0)),
            "page": page,
        })

    except requests.exceptions.Timeout:
        return jsonify({"error": "高德地图 API 请求超时，请重试"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"请求失败：{str(e)}"}), 500


# ----- 景点详情 -----
@app.route("/api/attractions/detail")
def attraction_detail():
    """
    获取景点详情（营业时间、门票、评价等）
    参数: id (高德POI ID), city (可选)
    """
    poi_id = request.args.get("id", "").strip()
    city = request.args.get("city", "").strip()

    if not poi_id:
        return jsonify({"error": "缺少景点ID"}), 400

    key = get_amap_key()
    if not key:
        return jsonify({"error": "请先设置高德地图 API Key"}), 500

    try:
        # 使用高德 POI 详情接口（通过搜索指定ID）
        params = {
            "key": key,
            "id": poi_id,
            "extensions": "all",
        }
        if city:
            params["city"] = city

        data = safe_request("https://restapi.amap.com/v3/place/detail", params, timeout=10)

        if data.get("status") != "1" or not data.get("pois"):
            return jsonify({"error": "未找到景点详情"}), 404

        poi = data["pois"][0]
        biz = poi.get("biz_ext", {}) or {}
        deep = poi.get("deep_info", {}) or {}

        detail = {
            "id": poi.get("id"),
            "name": poi.get("name"),
            "address": poi.get("address"),
            "city": poi.get("cityname", ""),
            "type": poi.get("type", "").split(";")[:3],
            "rating": biz.get("rating", ""),
            "cost": biz.get("cost", ""),
            "open_time": biz.get("open_time", ""),
            "phone": poi.get("tel", "") or biz.get("tel", ""),
            "website": poi.get("website", ""),
            "photos": [p.get("url", "") for p in (poi.get("photos", [])[:8])],
            "description": poi.get("business_area", "") or deep.get("intro", ""),
        }

        return jsonify(detail)

    except requests.exceptions.Timeout:
        return jsonify({"error": "请求超时，请重试"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"请求失败：{str(e)}"}), 500


# ----- 酒店推荐 -----
@app.route("/api/hotels")
def search_hotels():
    """
    搜索目的地附近酒店
    参数: city (必填), budget_level (可选: budget/comfort/luxury)
    """
    city = request.args.get("city", "").strip()
    level = request.args.get("budget_level", "comfort").strip()

    if not city:
        return jsonify({"error": "请输入城市名称"}), 400

    key = get_amap_key()
    if not key:
        return jsonify({"error": "请先设置高德地图 API Key"}), 500

    # 根据预算等级设置星级偏好
    star_map = {
        "budget": "二星及以下|三星级",
        "comfort": "三星级|四星级",
        "luxury": "四星级|五星级|豪华型",
    }
    cost_range = {
        "budget": (100, 250),
        "comfort": (250, 500),
        "luxury": (500, 2000),
    }

    try:
        params = {
            "key": key,
            "keywords": "酒店",
            "city": city,
            "types": "酒店|宾馆|旅馆|客栈",
            "offset": 10,
            "page": 1,
            "extensions": "all",
        }

        data = safe_request("https://restapi.amap.com/v3/place/text", params, timeout=10)

        if data.get("status") != "1":
            return jsonify({"error": "酒店搜索失败"}), 500

        low, high = cost_range.get(level, (200, 500))
        hotels = []
        for poi in data.get("pois", []):
            biz = poi.get("biz_ext", {}) or {}
            rating = biz.get("rating", "")
            cost = biz.get("cost", "")

            # 估算价格
            try:
                est_cost = float(cost) if cost else (low + high) // 2
            except ValueError:
                est_cost = (low + high) // 2

            hotels.append({
                "id": poi.get("id"),
                "name": poi.get("name"),
                "address": poi.get("address"),
                "rating": rating,
                "estimated_price": int(est_cost) if est_cost else (low + high) // 2,
                "type": poi.get("type", "").split(";")[0],
                "photo": (poi.get("photos", [{}])[0].get("url", "")) if poi.get("photos") else "",
                "location": poi.get("location", ""),
            })

        return jsonify({
            "city": city,
            "budget_level": level,
            "price_range": f"¥{low}~¥{high}",
            "hotels": hotels,
        })

    except requests.exceptions.Timeout:
        return jsonify({"error": "请求超时，请重试"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"请求失败：{str(e)}"}), 500


# ----- 天气查询 -----
@app.route("/api/weather")
def get_weather():
    """
    查询天气（使用高德地图天气 API）
    参数: city (必填)
    """
    city = request.args.get("city", "").strip()

    if not city:
        return jsonify({"error": "请输入城市名称"}), 400

    key = get_amap_key()
    if not key:
        return jsonify({"error": "请先设置高德地图 API Key"}), 500

    try:
        # 调用高德天气 API
        params = {
            "key": key,
            "city": city,
            "extensions": "all",  # all = 预报, base = 实时
        }
        data = safe_request("https://restapi.amap.com/v3/weather/weatherInfo", params)

        if data.get("status") != "1":
            return jsonify({"error": data.get("info", "天气查询失败")}), 500

        forecasts = []
        city_full = city

        # 处理预报数据（extensions=all）
        if "forecasts" in data and data["forecasts"]:
            f = data["forecasts"][0]
            city_full = f"{f.get('province', '')} {f.get('city', city)}".strip()
            update_time = f.get("reporttime", "")

            for cast in f.get("casts", []):
                forecasts.append({
                    "date": cast.get("date"),
                    "week": cast.get("week"),
                    "temp_max": cast.get("daytemp"),
                    "temp_min": cast.get("nighttemp"),
                    "weather_day": cast.get("dayweather"),
                    "weather_night": cast.get("nightweather"),
                    "wind_dir": cast.get("daywind"),
                    "wind_scale": cast.get("daypower"),
                })

        # 处理实时天气（extensions=base，作为 fallback 或当日补充）
        if "lives" in data and data["lives"]:
            live = data["lives"][0]
            city_full = f"{live.get('province', '')} {live.get('city', city)}".strip()
            update_time = live.get("reporttime", "")

            # 如果没有预报数据，至少返回当天天气
            if not forecasts:
                forecasts.append({
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "temp_max": live.get("temperature", ""),
                    "temp_min": "",
                    "weather_day": live.get("weather", ""),
                    "weather_night": "",
                    "wind_dir": live.get("winddirection", ""),
                    "wind_scale": live.get("windpower", ""),
                    "humidity": live.get("humidity", ""),
                })

        if not forecasts:
            return jsonify({"error": f"未获取到城市「{city}」的天气数据"}), 404

        return jsonify({
            "city": city_full,
            "forecasts": forecasts,
            "update_time": update_time,
            "source": "高德地图",
        })

    except requests.exceptions.Timeout:
        return jsonify({"error": "天气 API 请求超时，请重试"}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"请求失败：{str(e)}"}), 500


# ----- 路线生成（支持多城市串联）-----

def search_city_attractions(city, key, whitelist_names, whitelist_types, blacklist_names, blacklist_types):
    """搜索单个城市的景点并应用偏好过滤"""
    all_attractions = []
    try:
        params = {
            "key": key,
            "keywords": "旅游景点",
            "city": city,
            "types": "风景名胜|公园|博物馆|纪念馆|寺庙道观|游乐园|动物园|植物园|温泉|海滩|山峰|湖泊|古镇|国家级景点|省级景点|知名景点",
            "offset": 15,
            "page": 1,
            "extensions": "all",
        }
        result = safe_request("https://restapi.amap.com/v3/place/text", params, timeout=15)
        if result.get("status") == "1":
            for poi in result.get("pois", []):
                poi_type = poi.get("type", "").split(";")[0] if poi.get("type") else ""
                poi_name = poi.get("name", "")

                # 黑名单过滤
                if poi_name in blacklist_names or poi_type in blacklist_types:
                    continue

                # 白名单加分
                boost = 0
                if poi_name in whitelist_names:
                    boost += 10
                if poi_type in whitelist_types:
                    boost += 5

                all_attractions.append({
                    "id": poi.get("id"),
                    "name": poi_name,
                    "address": poi.get("address"),
                    "type": poi_type,
                    "city": city,
                    "location": poi.get("location", ""),
                    "rating": poi.get("biz_ext", {}).get("rating", ""),
                    "cost": estimate_ticket(poi.get("type", "")),
                    "boost": boost,
                })
    except Exception:
        pass

    # 排序
    all_attractions.sort(key=lambda x: x["boost"] + (float(x["rating"]) if x["rating"] else 0), reverse=True)
    return all_attractions


def fetch_weather(city, key):
    """获取城市天气预报"""
    forecasts = {}
    try:
        params = {"key": key, "city": city, "extensions": "all"}
        data = safe_request("https://restapi.amap.com/v3/weather/weatherInfo", params, timeout=10)
        if data.get("status") == "1" and "forecasts" in data:
            for cast in data["forecasts"][0].get("casts", []):
                forecasts[cast.get("date")] = {
                    "weather_day": cast.get("dayweather", ""),
                    "weather_night": cast.get("nightweather", ""),
                    "temp_max": cast.get("daytemp", ""),
                    "temp_min": cast.get("nighttemp", ""),
                    "wind_dir": cast.get("daywind", ""),
                    "wind_scale": cast.get("daypower", ""),
                }
    except Exception:
        pass
    return forecasts


def estimate_intercity_transport(from_city, to_city):
    """估算城际交通方式与费用"""
    # 基于距离的经验估算
    distance_map = {
        ("北京","天津"): (120, "高铁", 55, "0.5小时"),
        ("北京","上海"): (1200, "高铁", 550, "4.5小时"),
        ("北京","杭州"): (1300, "高铁", 580, "5小时"),
        ("上海","杭州"): (170, "高铁", 75, "1小时"),
        ("上海","南京"): (300, "高铁", 140, "1.5小时"),
        ("上海","苏州"): (100, "高铁", 40, "0.5小时"),
        ("杭州","苏州"): (200, "高铁", 110, "1.5小时"),
        ("杭州","南京"): (280, "高铁", 130, "1.5小时"),
        ("南京","苏州"): (220, "高铁", 100, "1小时"),
        ("广州","深圳"): (140, "高铁", 75, "0.5小时"),
        ("成都","重庆"): (300, "高铁", 150, "1.5小时"),
        ("西安","洛阳"): (380, "高铁", 175, "1.5小时"),
    }

    pair1 = (from_city, to_city)
    pair2 = (to_city, from_city)

    if pair1 in distance_map:
        dist, mode, cost, duration = distance_map[pair1]
    elif pair2 in distance_map:
        dist, mode, cost, duration = distance_map[pair2]
    else:
        # 默认估算
        dist, mode, cost, duration = 500, "高铁", 200, "3小时"

    return {"from": from_city, "to": to_city, "distance_km": dist,
            "mode": mode, "cost": cost, "duration": duration}


@app.route("/api/route/generate", methods=["POST"])
def generate_route():
    """
    生成旅游路线（支持多城市串联）
    Body JSON:
    {
        "destination": "杭州,苏州,南京",  // 多城市用逗号分隔
        "days": 6,
        "budget": 5000,
        "departure": "上海"
    }
    """
    data = request.get_json() or {}
    destination = data.get("destination", "").strip()
    days_input = data.get("days")
    budget = data.get("budget", 0) or 0
    departure = data.get("departure", "").strip()

    if not destination:
        return jsonify({"error": "请输入目的地城市"}), 400

    # 解析多城市
    cities = [c.strip() for c in destination.replace("，", ",").split(",") if len(c.strip()) >= 2]
    if not cities:
        return jsonify({"error": "请输入有效的城市名称"}), 400
    is_multi_city = len(cities) > 1

    if not departure:
        config = get_config()
        departure = config.get("default_city", "北京")

    key = get_amap_key()
    if not key:
        return jsonify({"error": "请先设置高德地图 API Key"}), 500

    # 偏好
    prefs = get_preferences()
    whitelist_names = {item["name"] for item in prefs.get("whitelist", [])}
    whitelist_types = {item.get("type", "") for item in prefs.get("whitelist", [])}
    blacklist_names = {item["name"] for item in prefs.get("blacklist", [])}
    blacklist_types = {item.get("type", "") for item in prefs.get("blacklist", [])}

    # 搜索每个城市的景点
    city_attractions = {}
    all_attractions_flat = []
    for city in cities:
        attrs = search_city_attractions(city, key, whitelist_names, whitelist_types, blacklist_names, blacklist_types)
        city_attractions[city] = attrs
        all_attractions_flat.extend(attrs)

    if not all_attractions_flat:
        return jsonify({"error": f"在「{destination}」未找到景点信息"}), 404

    # 确定天数分配
    if days_input and days_input > 0:
        total_days = days_input
    else:
        total_per_city = [max(1, min(5, len(city_attractions[c]) // 3 + 1)) for c in cities]
        total_days = sum(total_per_city)

    if is_multi_city:
        # 按景点数量比例分配天数
        total_attr_count = sum(len(city_attractions[c]) for c in cities)
        days_per_city = []
        remaining = total_days
        for i, city in enumerate(cities):
            if i == len(cities) - 1:
                d = max(1, remaining)
            else:
                ratio = len(city_attractions[city]) / max(1, total_attr_count)
                d = max(1, min(remaining - (len(cities) - i - 1), round(total_days * ratio)))
            days_per_city.append(d)
            remaining -= d
    else:
        days_per_city = [total_days]

    # 计算预算
    if budget > 0:
        budget_per_day = budget / max(1, total_days)
    else:
        budget_per_day = 500

    hotel_level, hotel_cost = estimate_accommodation(budget_per_day)
    food_cost = 80
    transport_inner = 50

    # 城际交通
    intercity_transports = []
    intercity_total = 0
    all_routes = [departure] + cities
    for i in range(len(all_routes) - 1):
        trans = estimate_intercity_transport(all_routes[i], all_routes[i + 1])
        intercity_transports.append(trans)
        intercity_total += trans["cost"]

    # 构建行程
    itinerary = []
    total_cost = intercity_total
    day_counter = 0
    all_used = []
    all_locations = []

    for ci, city in enumerate(cities):
        city_attrs = city_attractions[city]
        city_days = days_per_city[ci]
        per_day = min(3, max(2, len(city_attrs) // max(1, city_days) + 1))
        used_count = min(len(city_attrs), city_days * per_day)
        used = city_attrs[:used_count]
        all_used.extend(used)

        # 天气
        weather_fc = fetch_weather(city, key)

        # 城市分隔标记
        if is_multi_city:
            itinerary.append({
                "type": "city_header",
                "city": city,
                "day_start": day_counter + 1,
            })

        # 城市内每日行程
        for d in range(city_days):
            day_attrs = used[d * per_day : (d + 1) * per_day]
            if not day_attrs:
                continue
            day_ticket = sum(a["cost"] for a in day_attrs)
            day_cost = hotel_cost + food_cost + transport_inner + day_ticket
            day_counter += 1
            day_date = (datetime.now() + timedelta(days=day_counter - 1)).strftime("%Y-%m-%d")
            day_weather = weather_fc.get(day_date, {})
            for a in day_attrs:
                if a.get("location"):
                    all_locations.append(a["location"])

            itinerary.append({
                "type": "day",
                "day": day_counter,
                "date": (datetime.now() + timedelta(days=day_counter - 1)).strftime("%m月%d日"),
                "city": city,
                "weather": {
                    "weather_day": day_weather.get("weather_day", ""),
                    "weather_night": day_weather.get("weather_night", ""),
                    "temp_max": day_weather.get("temp_max", ""),
                    "temp_min": day_weather.get("temp_min", ""),
                    "wind_dir": day_weather.get("wind_dir", ""),
                    "wind_scale": day_weather.get("wind_scale", ""),
                },
                "attractions": [
                    {"id": a["id"], "name": a["name"], "type": a["type"],
                     "address": a["address"], "ticket": a["cost"],
                     "location": a["location"], "rating": a["rating"]}
                    for a in day_attrs
                ],
                "hotel": hotel_level,
                "hotel_cost": hotel_cost,
                "food_cost": food_cost,
                "transport_cost": transport_inner,
                "ticket_total": day_ticket,
                "day_total": day_cost,
            })
            total_cost += day_cost

        # 城市间交通
        if ci < len(cities) - 1:
            trans = intercity_transports[ci + 1]  # +1 because first transport is departure→city1
            itinerary.append({
                "type": "transport",
                "from_city": city,
                "to_city": cities[ci + 1],
                "mode": trans["mode"],
                "cost": trans["cost"],
                "duration": trans["duration"],
            })

    # 总览
    summary = {
        "departure": departure,
        "destination": destination,
        "cities": cities,
        "is_multi_city": is_multi_city,
        "days": total_days,
        "total_budget": budget if budget > 0 else total_cost,
        "total_estimated": total_cost,
        "cost_breakdown": {
            "transport_intercity": intercity_total,
            "hotel": hotel_cost * total_days,
            "food": food_cost * total_days,
            "transport_inner": transport_inner * total_days,
            "tickets": sum(a["cost"] for a in all_used),
        },
        "budget_fit": "在预算范围内" if budget == 0 or total_cost <= budget else f"超出预算 ¥{total_cost - budget}",
        "intercity_transports": intercity_transports,
    }

    # 地图 URL（多城市用较小的 zoom）
    map_url = ""
    if all_locations:
        loc_str = "|".join(all_locations[:15])
        map_url = (
            f"https://restapi.amap.com/v3/staticmap?key={key}"
            f"&locations={loc_str}"
            f"&size=800*350&scale=2&zoom={'7' if is_multi_city else '12'}"
            f"&markers=mid,0xFF6B35,A:{all_locations[0]}"
        )

    return jsonify({
        "summary": summary,
        "itinerary": itinerary,
        "hotel_level": hotel_level,
        "map_url": map_url,
        "blacklist_filtered": 0,
    })


# ----- 行程保存 -----
SAVED_ROUTES_FILE = os.path.join(DATA_DIR, "saved_routes.json")


def get_saved_routes():
    return read_json(SAVED_ROUTES_FILE, {"routes": []})


def save_saved_routes(data):
    write_json(SAVED_ROUTES_FILE, data)


@app.route("/api/routes/saved")
def list_saved_routes():
    """列出已保存的路线"""
    data = get_saved_routes()
    # 按时间倒序，只返回摘要
    routes = sorted(data.get("routes", []), key=lambda r: r.get("saved_at", ""), reverse=True)
    summaries = [{
        "id": r["id"],
        "name": r.get("name", ""),
        "destination": r.get("destination", ""),
        "days": r.get("days", 0),
        "budget": r.get("budget", 0),
        "saved_at": r.get("saved_at", ""),
    } for r in routes]
    return jsonify({"routes": summaries})


@app.route("/api/routes/saved", methods=["POST"])
def save_route():
    """保存路线"""
    data = request.get_json() or {}
    route_data = data.get("route_data", {})
    name = data.get("name", "").strip()

    if not route_data:
        return jsonify({"error": "缺少路线数据"}), 400

    if not name:
        summary = route_data.get("summary", {})
        name = summary.get("destination", "未命名路线")

    routes_data = get_saved_routes()
    route_entry = {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "destination": route_data.get("summary", {}).get("destination", ""),
        "days": route_data.get("summary", {}).get("days", 0),
        "budget": route_data.get("summary", {}).get("total_budget", 0),
        "route_data": route_data,
        "saved_at": datetime.now().isoformat(),
    }
    routes_data.setdefault("routes", []).insert(0, route_entry)
    save_saved_routes(routes_data)
    return jsonify({"message": "路线已保存", "id": route_entry["id"]})


@app.route("/api/routes/saved/<route_id>")
def get_saved_route(route_id):
    """获取单条已保存路线"""
    routes_data = get_saved_routes()
    for r in routes_data.get("routes", []):
        if r["id"] == route_id:
            return jsonify(r["route_data"])
    return jsonify({"error": "路线不存在"}), 404


@app.route("/api/routes/saved/<route_id>", methods=["DELETE"])
def delete_saved_route(route_id):
    """删除已保存路线"""
    routes_data = get_saved_routes()
    routes_data["routes"] = [r for r in routes_data.get("routes", []) if r["id"] != route_id]
    save_saved_routes(routes_data)
    return jsonify({"message": "路线已删除"})


# ----- 偏好管理 -----
@app.route("/api/preferences")
def api_get_preferences():
    """获取所有偏好"""
    prefs = get_preferences()
    return jsonify(prefs)


@app.route("/api/preferences", methods=["POST"])
def api_add_preference():
    """
    添加偏好
    Body JSON:
    {
        "name": "故宫",       // 景点名称/类型
        "type": "historical",  // 景点类型（可选）
        "list": "whitelist"    // "whitelist" 或 "blacklist"
    }
    """
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    ptype = data.get("type", "").strip()
    list_type = data.get("list", "").strip()

    if not name:
        return jsonify({"error": "请输入名称"}), 400

    if list_type not in ("whitelist", "blacklist"):
        return jsonify({"error": "请指定 list 为 whitelist 或 blacklist"}), 400

    prefs = get_preferences()
    target_list = prefs.get(list_type, [])

    # 检查重复
    for item in target_list:
        if item["name"] == name:
            return jsonify({"error": f"「{name}」已存在", "preferences": prefs}), 409

    new_item = {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "type": ptype,
        "added_at": datetime.now().isoformat(),
    }
    target_list.append(new_item)
    prefs[list_type] = target_list
    save_preferences(prefs)

    return jsonify({"message": f"已添加到{'白名单' if list_type == 'whitelist' else '黑名单'}", "preferences": prefs})


@app.route("/api/preferences/<item_id>", methods=["DELETE"])
def api_delete_preference(item_id):
    """删除偏好"""
    prefs = get_preferences()
    found = False
    for list_type in ("whitelist", "blacklist"):
        for item in prefs.get(list_type, []):
            if item["id"] == item_id:
                prefs[list_type].remove(item)
                found = True
                break

    if not found:
        return jsonify({"error": "未找到该偏好"}), 404

    save_preferences(prefs)
    return jsonify({"message": "已删除", "preferences": prefs})


# ----- 配置管理 -----
@app.route("/api/config")
def api_get_config():
    """获取配置"""
    config = get_config()
    # 不返回 API key 完整值
    safe_config = {
        "default_city": config.get("default_city", "北京"),
        "has_amap_key": bool(get_amap_key()),
    }
    return jsonify(safe_config)


@app.route("/api/config", methods=["PUT"])
def api_update_config():
    """
    更新配置
    Body JSON: { "default_city": "上海", "amap_key": "xxx" }
    """
    data = request.get_json() or {}
    config = get_config()

    if "default_city" in data:
        config["default_city"] = data["default_city"].strip()
    if "amap_key" in data and data["amap_key"]:
        config["amap_key"] = data["amap_key"].strip()

    save_config(config)
    return jsonify({"message": "配置已更新"})


# ========== 启动 ==========
if __name__ == "__main__":
    # 确保 data 目录存在
    os.makedirs(DATA_DIR, exist_ok=True)

    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") != "production"

    print("=" * 50)
    print("[Travel Assistant] Backend Service Starting...")
    print(f"   Address: http://0.0.0.0:{port}")
    print(f"   Debug: {'ON' if debug else 'OFF'}")
    print(f"   Amap Key: {'SET' if get_amap_key() else 'NOT SET'}")
    print("=" * 50)

    app.run(host="0.0.0.0", port=port, debug=debug)
