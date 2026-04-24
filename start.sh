#!/bin/bash
set -e

# 定义颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' 

cd "$(dirname "$0")"

echo -e "${GREEN}正在检查及更新代码...${NC}"
# 如果确认不需要 git 可以把下面两行注释掉
git fetch --all
git reset --hard origin/main 

echo -e "${GREEN}正在检查及安装依赖...${NC}"
npm install --silent

echo -e "${GREEN}正在构建项目 (Vite build)...${NC}"
rm -rf dist
npm run build

echo -e "${GREEN}使用 pm2 ecosystem 配置文件在后台启动服务...${NC}"
# 重启或启动应用
pm2 start ecosystem.config.cjs

echo "==================================================="
echo -e "${GREEN}idbattle 前端服务已成功在后台启动！${NC}"
echo -e "你可以通过以下命令管理服务："
echo -e "👉 查看状态: ${YELLOW}pm2 status${NC}"
echo -e "👉 查看日志: ${YELLOW}pm2 logs idbattle-frontend${NC}"
echo -e "👉 停止服务: ${YELLOW}./stop.sh${NC}"
echo -e "👉 访问地址: ${YELLOW}http://http://59.110.36.83:8000${NC}"
echo "==================================================="