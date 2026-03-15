#!/bin/bash
# 家庭资产管理工具 - 一键启动脚本
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# 检查并创建 Python 虚拟环境
if [ ! -d "$DIR/backend/venv" ]; then
    echo "首次运行，正在创建 Python 虚拟环境..."
    python3 -m venv "$DIR/backend/venv"
    echo "正在安装 Python 依赖..."
    "$DIR/backend/venv/bin/pip" install -r "$DIR/backend/requirements.txt" -q
fi

# 检查前端是否已构建
if [ ! -d "$DIR/frontend/dist" ]; then
    echo "正在构建前端..."
    cd "$DIR/frontend"
    npm install --silent
    npm run build
fi

echo "启动家庭资产管理..."
cd "$DIR/backend"
exec ./venv/bin/python main.py
