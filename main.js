// 主应用入口
import { generateAttributes } from './models/player.js';
import { BattleService } from './services/battleService.js';
import { updatePlayerInfo, initPlayerPanels } from './ui/playerUI.js';
import { displayBattleLog } from './ui/logUI.js';
import { EquipmentType, equipmentList, setEffects, equipmentByType } from './models/equipment.js';

// 将一些常量挂载到window对象，以便在其他模块中访问
window.equipmentList = equipmentList;
window.setEffects = setEffects;
window.equipmentByType = equipmentByType;
window.EquipmentType = EquipmentType;

// 页面加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => {
        const battleBtn = document.getElementById('battle-btn');
        const battleService = new BattleService();
        let isBattleRunning = false; // 添加战斗状态标志

        // 初始化面板
        initPlayerPanels();

        battleBtn.addEventListener('click', async () => {
            // 立即禁用按钮，防止重复点击
            battleBtn.disabled = true;

            // 检查战斗是否正在进行
            if (isBattleRunning) {
                battleBtn.disabled = false; // 如果战斗正在进行，恢复按钮状态
                return; // 不执行后续逻辑
            }

            isBattleRunning = true;
        const player1Name = document.getElementById('player1').value.trim();
        const player2Name = document.getElementById('player2').value.trim();

        // 输入验证
        if (!player1Name || !player2Name) {
            const resultLog = document.getElementById('result-log');
            if (resultLog) {
                resultLog.textContent = '请输入两个玩家的名称!';
            }
            return;
        }

        try {
            // 生成玩家属性
            const player1 = generateAttributes(player1Name);
            const player2 = generateAttributes(player2Name);

            // 设置玩家到战斗服务，并传递更新UI的回调函数
            battleService.setPlayers(player1, player2, updatePlayerInfo);

            // 更新玩家信息显示
            updatePlayerInfo(player1, true);
            updatePlayerInfo(player2, false);

            // 清空日志
            const resultLog = document.getElementById('result-log');
            if (resultLog) {
                resultLog.textContent = '战斗开始...';
            }

            // 定义日志回调函数
            const logCallback = (newLog) => {
                displayBattleLog(newLog, updatePlayerInfo, player1, player2);
            };

            // 异步执行战斗
            await battleService.battle(logCallback);
        } catch (error) {
            console.error('战斗过程中发生错误:', error);
            const resultLog = document.getElementById('result-log');
            if (resultLog) {
                resultLog.textContent = `战斗过程中发生错误: ${error.message}`;
            }
        } finally {
            // 战斗结束后，启用按钮并重置战斗状态标志
            battleBtn.disabled = false;
            isBattleRunning = false;
        }
    });
});