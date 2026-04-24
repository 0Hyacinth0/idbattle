#!/bin/bash
GREEN='\033[0;32m'
NC='\033[0m' 

cd "$(dirname "$0")"
echo -e "${GREEN}正在停止并移除 idbattle 服务...${NC}"
pm2 delete ecosystem.config.cjs
echo -e "${GREEN}服务已完全停止。${NC}"