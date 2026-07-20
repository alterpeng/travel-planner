# 🧳 旅游助手 — 家庭智能旅游规划

[![Deployed](https://img.shields.io/badge/deployed-Render-brightgreen)](https://travel-planner-8xg6.onrender.com)
[![Version](https://img.shields.io/badge/version-1.0-orange)](#)

一个面向家庭的 H5 旅游规划应用。**搜索景点、查天气、生成个性化路线、自动学习偏好**——越用越懂你。

🌐 **线上体验**：[https://travel-planner-8xg6.onrender.com](https://travel-planner-8xg6.onrender.com)

---

## ✨ 功能

| 🔍 景点搜索 | 🌤️ 天气查询 | 🗺️ 路线生成 |
|-------------|-------------|-------------|
| 按城市/关键词搜索 | 4 天天气预报 | 自动规划每日行程 |
| 显示评分和门票估算 | 温度/风力/天气 | 包含费用明细 |
| 高德地图数据 | 高德天气数据 | 每天附带当日天气 |

| ⭐ 白名单 | 👎 黑名单 | 💰 预算管控 |
|-----------|-----------|-------------|
| 喜欢的优先推荐 | 不喜欢的自动过滤 | 总预算约束 |
| 👍 一键加入 | 👎 一键加入 | 住宿/餐饮/交通/门票 |

## 📱 手机截图

打开即用，4 个底部标签：🏠 首页 · 🌤️ 天气 · ⭐ 偏好 · ⚙️ 设置

## 🚀 快速开始

### 本地运行

```bash
# 1. 配置 API Key
cp backend/data/config.example.json backend/data/config.json
# 编辑 config.json，填入高德地图 API Key（去 https://lbs.amap.com 免费注册）

# 2. 安装依赖
cd backend
pip install -r requirements.txt

# 3. 启动
python app.py

# 4. 打开浏览器
# http://localhost:5000
```

### 部署到 Render

1. Fork 本项目到你的 GitHub
2. 在 [Render](https://render.com) 创建 Web Service
3. 配置：
   - **Root Directory**: `backend`
   - **Build**: `pip install -r requirements.txt`
   - **Start**: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - **Env Var**: `AMAP_KEY` = 你的高德 Key
4. 部署完成！

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | HTML + CSS + JavaScript（移动端优先） |
| 后端 | Python Flask |
| 数据 | 高德地图 API（景点 + 天气） |
| 存储 | JSON 文件 |
| 部署 | Render（免费） |

## 📂 项目结构

```
travel-planner/
├── README.md               # 本文件
├── PROJECT_PLAN.md         # 项目计划和未来路线图
├── backend/
│   ├── app.py              # Flask 主程序
│   └── requirements.txt    # Python 依赖
└── frontend/
    ├── index.html          # 主页面
    ├── css/style.css       # 样式
    └── js/app.js           # 逻辑
```

## 📋 路线图

- [x] v1.0 — 景点搜索、天气、路线生成、偏好管理、公网部署
- [ ] v1.1 — 行程保存、历史记录、景点详情、交通方式选择
- [ ] v1.5 — 微信小程序、行程分享卡片、酒店推荐
- [ ] v2.0 — AI 对话式规划、地图可视化、多城市串联

详见 [PROJECT_PLAN.md](PROJECT_PLAN.md)

## 🙋 给家人使用

打开 https://travel-planner-8xg6.onrender.com ，手机浏览器也能用。第一次加载可能等 30 秒（免费服务器休眠唤醒），之后正常使用。

---

Made with ❤️ for family
