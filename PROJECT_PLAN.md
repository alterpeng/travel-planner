# 🧳 旅游助手 - 项目计划文档

> 最后更新：2026-07-20

## 项目概述

一个面向家庭的旅游规划 H5 网页应用，帮助查询国内景点、天气，生成个性化旅游路线，并自动学习用户偏好（白名单/黑名单），实现智能推荐。

## 技术选型

| 项目 | 选型 |
|------|------|
| 前端 | 纯 HTML/CSS/JS（移动端优先） |
| 后端 | Python Flask |
| 存储 | JSON 文件（轻量级） |
| 景点数据 | 高德地图 POI 搜索 API |
| 天气数据 | 高德地图天气 API |
| 前端部署 | Vercel（免费） |
| 后端部署 | Render（免费） |

## 核心功能

### 1. 景点搜索
- 支持按关键词、城市搜索国内景点
- 显示景点名称、地址、类型、评级
- 调用高德地图 API

### 2. 天气查询
- 查询指定城市的天气（当前 + 未来 7 天）
- 显示温度、天气状况、风力等
- 调用和风天气 API

### 3. 路线生成
- 输入：目的地城市、出行天数（可选）、预算、出发城市
- 智能规划：考虑黑白名单偏好、预算约束、景点距离
- 输出：每日行程安排（景点列表、交通方式、费用预估）
- 自动处理黑白名单

### 4. 偏好管理
- 白名单：用户喜欢的景点/类型，下次自动优先推荐
- 黑名单：用户不喜欢的景点/类型，下次自动过滤
- 支持手动添加/删除
- 路线反馈后自动记录

### 5. 设置
- 设置默认出发城市
- API Key 配置入口

## 项目结构

```
travel-planner/
├── PROJECT_PLAN.md          # 本文件
├── backend/
│   ├── app.py               # Flask 主程序
│   ├── requirements.txt     # Python 依赖
│   └── data/
│       ├── preferences.json # 黑白名单数据
│       └── config.json      # 用户配置
├── frontend/
│   ├── index.html           # 主页面
│   ├── css/
│   │   └── style.css        # 样式
│   └── js/
│       └── app.js           # 前端逻辑
```

## API 接口设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/attractions` | 搜索景点 |
| GET | `/api/weather` | 查询天气 |
| POST | `/api/route/generate` | 生成路线 |
| GET | `/api/preferences` | 获取偏好 |
| POST | `/api/preferences` | 添加偏好 |
| DELETE | `/api/preferences/<id>` | 删除偏好 |
| GET | `/api/config` | 获取配置 |
| PUT | `/api/config` | 更新配置 |

## 开发计划

### ✅ 已完成（2026-07-20）
- [x] 需求确认（10个问题全部明确）
- [x] 项目目录结构创建
- [x] 项目计划文档编写
- [x] 后端 Flask API 全部开发完成（8个接口）
- [x] 高德地图 API 集成（景点搜索、POI查询）
- [x] 和风天气 API 集成（城市查询、7天预报）
- [x] 路线生成算法（预算约束、天数规划、黑白名单过滤）
- [x] 偏好管理功能（白名单/黑名单 CRUD）
- [x] 前端 H5 页面开发（4个标签页）
- [x] 移动端 UI 适配（响应式布局）
- [x] 后端 API 测试通过（health/config/preferences）

### ⏳ 待完成
- [ ] 用户注册获取高德/和风天气 API Key
- [ ] 前后端联调（填入 API Key 后测试完整流程）
- [ ] 前端 API 地址配置（替换为 Render 实际地址）
- [ ] 部署到 Vercel（前端）+ Render（后端）
- [ ] 家人实际使用测试反馈

### 💡 未来可以考虑
- [ ] 转成微信小程序版本
- [ ] 添加景点照片展示
- [ ] 支持多人出行预算分摊
- [ ] 行程导出为图片/PDF
- [ ] 添加游记记录功能
- [ ] 语音输入城市名称
- [ ] 离线浏览已保存路线
- [ ] 节假日人流量预估
- [ ] 酒店/餐饮推荐
- [ ] 行程分享链接

---

## 部署步骤

> ⚠️ 以下步骤需要在获取 API Key 后进行

### 第一步：获取 API Key（你在网页上完成）
1. **高德地图 Key**：打开 https://lbs.amap.com/ → 注册 → 应用管理 → 创建应用 → 添加 Key（选择"Web服务"）→ 复制 Key
2. **和风天气 Key**：打开 https://dev.qweather.com/ → 注册 → 控制台 → 创建项目 → 选择"免费订阅" → 复制 Key

### 第二步：部署后端到 Render（免费）
1. 注册 Render 账号：https://render.com
2. 将整个项目上传到 GitHub
3. 在 Render 创建 Web Service，连接 GitHub 仓库
4. 设置：
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT`
5. 在 Environment 中添加：`AMAP_KEY`
6. 部署完成后会得到一个地址，如 `https://travel-planner-xxxx.onrender.com`

### 第三步：部署前端到 Vercel
1. 注册 Vercel 账号：https://vercel.com
2. 导入同一个 GitHub 仓库
3. Root Directory 设为 `frontend`
4. 部署完成后会得到一个地址，如 `https://travel-planner.vercel.app`
5. **重要**：打开 `frontend/js/app.js`，把第8行的 `https://your-app.onrender.com` 替换为第二步得到的 Render 地址，然后重新部署

### 第四步（可选）：先用本地模式测试
1. 在设置页填入 API Key
2. 后端会在本地保存 Key
3. 完整测试所有功能

---

## 给用户的待办

### ✅ 已完成
- [x] 高德地图 API Key 已配置（景点搜索 + 天气 + 路线生成全部通过测试）

### 要部署上线时做：
1. 注册 [Render](https://render.com) 账号
2. 注册 [Vercel](https://vercel.com) 账号
3. 把项目上传到 GitHub
4. 按照"部署步骤"操作

### 要部署上线时做：
4. 注册 [Render](https://render.com) 账号
5. 注册 [Vercel](https://vercel.com) 账号
6. 把项目上传到 GitHub
7. 按照上面"部署步骤"操作
