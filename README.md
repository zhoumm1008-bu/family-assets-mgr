# 家庭资产管理工具

基于状态快照的家庭资产负债表，以最小心智负担掌控财富宏观趋势。

## 功能

- **资产配置管理** — 管理资产账户（现金/股票/基金/期权/保险/其他），支持启用/停用
- **定期快照录入** — 按大类分组填报，显示上期参考值，实时汇总，支持备注
- **数据大盘** — 总资产净值、增长趋势图（堆叠面积图）、资产结构占比（饼图）
- **数据导出/导入** — JSON 格式备份与恢复

## 环境要求

- macOS
- Python 3.9+
- Node.js 18+（仅首次构建前端需要）

## 快速启动

```bash
# 克隆项目后，一键启动
./start.sh
```

首次运行会自动完成以下步骤：
1. 创建 Python 虚拟环境并安装依赖
2. 构建前端静态文件
3. 启动桌面窗口

后续启动秒开，无需重复安装。

## 手动安装（换电脑时）

如果 `start.sh` 执行遇到问题，可按以下步骤手动操作：

```bash
# 1. 安装前端依赖并构建
cd frontend
npm install
npm run build
cd ..

# 2. 创建 Python 虚拟环境并安装依赖
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# 3. 启动应用
./venv/bin/python main.py
```

## 数据存储

- 数据库文件位于 `~/.family-assets-mgr/data.db`（SQLite）
- 迁移数据到新电脑：通过应用内「导出数据」生成 JSON 文件，在新电脑上「导入数据」即可

## 技术栈

- **后端**: Python + Flask + SQLite
- **前端**: React + TypeScript + Ant Design + Recharts
- **桌面窗口**: pywebview
