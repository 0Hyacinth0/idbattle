// 主应用入口
import { generateAttributes } from './models/player.js';
import { BattleService } from './services/battleService.js';
import { updatePlayerInfo, initPlayerPanels } from './ui/playerUI.js';
import { displayBattleLog, resetBattleLog } from './ui/logUI.js';
import { EquipmentType, equipmentList, setEffects, equipmentByType } from './models/equipment.js';
import { initPlayerGrowthUI } from './ui/playerGrowthUI.js';
import { getPlayerConfig } from './utils/storage.js';

// 将一些常量挂载到window对象，以便在其他模块中访问
window.equipmentList = equipmentList;
window.setEffects = setEffects;
window.equipmentByType = equipmentByType;
window.EquipmentType = EquipmentType;

document.addEventListener('DOMContentLoaded', () => {
    const battleBtn = document.getElementById('battle-btn');
    const formError = document.getElementById('form-error');
    const battleService = new BattleService();
    let isBattleRunning = false;

    initPlayerPanels();
    initPlayerGrowthUI();

    battleBtn.addEventListener('click', async () => {
        if (isBattleRunning) {
            return;
        }

        isBattleRunning = true;
        battleBtn.disabled = true;
        if (formError) {
            formError.textContent = '';
        }

        const player1Name = document.getElementById('player1').value.trim();
        const player2Name = document.getElementById('player2').value.trim();

        if (!player1Name || !player2Name) {
            if (formError) {
                formError.textContent = '请输入两个玩家的名称。';
            }
            resetBattleButton();
            return;
        }

        try {
            const player1Customization = getPlayerConfig(player1Name) || undefined;
            const player2Customization = getPlayerConfig(player2Name) || undefined;

            const player1 = generateAttributes(player1Name, player1Customization);
            const player2 = generateAttributes(player2Name, player2Customization);

            battleService.setPlayers(player1, player2, updatePlayerInfo);

            updatePlayerInfo(player1, true);
            updatePlayerInfo(player2, false);

            resetBattleLog('战斗准备中...');

            const logCallback = (newLog) => {
                displayBattleLog(newLog, updatePlayerInfo, player1, player2);
            };

            await battleService.battle(logCallback);
        } catch (error) {
            console.error('战斗过程中发生错误:', error);
            const resultLog = document.getElementById('result-log');
            if (resultLog) {
                resultLog.textContent = `战斗过程中发生错误: ${error.message}`;
            }
        } finally {
            resetBattleButton();
        }
    });

    function resetBattleButton() {
        battleBtn.disabled = false;
        isBattleRunning = false;
    }
});
