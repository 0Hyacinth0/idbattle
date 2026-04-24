#!/bin/bash

# ---------------------------------------------------------
# idbattle 自动化更新脚本 (Linux)
# ---------------------------------------------------------

# 确保脚本在出错时立即停止执行
set -e

# 定义颜色 (用于输出提示)
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}>>> 开始更新 idbattle 项目...${NC}"

# 1. 进入脚本所在目录 (由于是在根目录执行，通常已就绪)
cd "$(dirname "$0")"

# 2. 拉取最新代码
echo -e "${GREEN}步骤 1: 正在从仓库拉取最新代码...${NC}"
git fetch --all
# 优先尝试 main，如果失败则尝试 master
BRANCH=$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')
echo -e "检测到上游分支为: ${BRANCH}"
git reset --hard origin/$BRANCH

# 3. 安装依赖
echo -e "${GREEN}步骤 2: 正在更新 npm 依赖...${NC}"
npm install

# 4. 构建项目 (Vite)
echo -e "${GREEN}步骤 3: 正在执行 Vite 构建...${NC}"
npm run build

echo -e "${BLUE}>>> 更新成功！项目已构建完成。${NC}"
echo -e "构建结果保存在 ${GREEN}dist/${NC} 目录中。"

