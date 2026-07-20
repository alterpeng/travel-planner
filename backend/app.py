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
def safe_request(url, params, timeout=10, max_retries=2):
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


# ----- 路线生成 -----
@app.route("/api/route/generate", methods=["POST"])
def generate_route():
    """
    生成旅游路线
    Body JSON:
    {
        "destination": "杭州",     // 目的地（必填）
        "days": 3,                // 天数（可选，不填自动推荐）
        "budget": 3000,           // 总预算（元）
        "departure": "上海"        // 出发城市（可选，默认使用配置中的城市）
    }
    """
    data = request.get_json() or {}
    destination = data.get("destination", "").strip()
    days_input = data.get("days")  # 可能为 None
    budget = data.get("budget", 0) or 0
    departure = data.get("departure", "").strip()

    if not destination:
        return jsonify({"error": "请输入目的地城市"}), 400

    # 默认出发城市
    if not departure:
        config = get_config()
        departure = config.get("default_city", "北京")

    key = get_amap_key()
    if not key:
        return jsonify({"error": "请先设置高德地图 API Key"}), 500

    # 获取偏好
    prefs = get_preferences()
    whitelist_names = {item["name"] for item in prefs.get("whitelist", [])}
    whitelist_types = {item.get("type", "") for item in prefs.get("whitelist", [])}
    blacklist_names = {item["name"] for item in prefs.get("blacklist", [])}
    blacklist_types = {item.get("type", "") for item in prefs.get("blacklist", [])}

    # 搜索目的地景点
    all_attractions = []
    search_keywords = ["景点", "公园", "博物馆", "名胜古迹", "寺庙", "自然风光", "老街", "古镇"]

    for kw in search_keywords:
        try:
            params = {
                "key": key,
                "keywords": kw,
                "city": destination,
                "types": "风景名胜|公园|博物馆|纪念馆|寺庙道观|游乐园|动物园|植物园|温泉|海滩|山峰|湖泊|古镇|国家级景点|省级景点",
                "offset": 10,
                "page": 1,
                "extensions": "all",
            }
            result = safe_request("https://restapi.amap.com/v3/place/text", params)
            if result.get("status") == "1":
                for poi in result.get("pois", []):
                    poi_name = poi.get("name", "")
                    poi_type = poi.get("type", "").split(";")[0] if poi.get("type") else ""

                    # 去重
                    if any(a["name"] == poi_name for a in all_attractions):
                        continue

                    all_attractions.append({
                        "id": poi.get("id"),
                        "name": poi_name,
                        "address": poi.get("address"),
                        "type": poi_type,
                        "location": poi.get("location", ""),
                        "rating": poi.get("biz_ext", {}).get("rating", ""),
                        "cost": estimate_ticket(poi.get("type", "")),
                    })
        except Exception:
            continue  # 某个关键词失败不影响整体

    if not all_attractions:
        return jsonify({"error": f"在「{destination}」未找到景点信息"}), 404

    # 应用黑白名单过滤
    filtered = []
    for attr in all_attractions:
        # 黑名单过滤（名字匹配 或 类型匹配）
        if attr["name"] in blacklist_names:
            continue
        if attr["type"] in blacklist_types:
            continue

        # 白名单加分
        boost = 0
        if attr["name"] in whitelist_names:
            boost += 10
        if attr["type"] in whitelist_types:
            boost += 5

        attr["boost"] = boost
        filtered.append(attr)

    # 按热度 + 白名单加成排序
    filtered.sort(key=lambda x: x["boost"] + (float(x["rating"]) if x["rating"] else 0), reverse=True)

    # 确定天数
    if days_input and days_input > 0:
        days = days_input
    else:
        # 自动推荐：按每天 2-3 个景点计算
        days = max(1, min(7, len(filtered) // 3 + 1))

    # 每日景点数
    per_day = min(3, max(2, len(filtered) // days + 1))
    total_attractions_used = min(len(filtered), days * per_day)
    used_attractions = filtered[:total_attractions_used]

    # 计算预算
    if budget > 0:
        budget_per_day = budget / days
    else:
        budget_per_day = 500  # 默认

    hotel_level, hotel_cost = estimate_accommodation(budget_per_day)
    food_cost = 80  # 每人每天餐饮
    transport_inner = 50  # 市内交通每天
    transport_intercity = 200  # 城际交通估算

    # 分配每日行程
    itinerary = []
    total_cost = transport_intercity  # 城际交通

    for d in range(days):
        day_attrs = used_attractions[d * per_day : (d + 1) * per_day]
        day_ticket = sum(a["cost"] for a in day_attrs)
        day_cost = hotel_cost + food_cost + transport_inner + day_ticket

        itinerary.append({
            "day": d + 1,
            "date": (datetime.now() + timedelta(days=d)).strftime("%m月%d日"),
            "attractions": [
                {
                    "name": a["name"],
                    "type": a["type"],
                    "address": a["address"],
                    "ticket": a["cost"],
                }
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

    # 总览
    summary = {
        "departure": departure,
        "destination": destination,
        "days": days,
        "total_budget": budget if budget > 0 else total_cost,
        "total_estimated": total_cost,
        "cost_breakdown": {
            "transport_intercity": transport_intercity,
            "hotel": hotel_cost * days,
            "food": food_cost * days,
            "transport_inner": transport_inner * days,
            "tickets": sum(a["cost"] for a in used_attractions),
        },
        "budget_fit": "在预算范围内" if budget == 0 or total_cost <= budget else f"超出预算 ¥{total_cost - budget}",
    }

    return jsonify({
        "summary": summary,
        "itinerary": itinerary,
        "hotel_level": hotel_level,
        "unused_attractions": [
            {"name": a["name"], "type": a["type"]} for a in filtered[total_attractions_used:total_attractions_used + 5]
        ],
        "blacklist_filtered": len(all_attractions) - len(filtered),
    })


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
