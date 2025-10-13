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

    const viewSwitcher = document.querySelector('[data-role="view-switcher"]');
    const battleView = document.querySelector('[data-role="battle-view"]');
    const growthView = document.querySelector('[data-role="growth-view"]');
    let currentView = 'battle';

    initPlayerPanels();
    initPlayerGrowthUI();

    if (viewSwitcher && battleView && growthView) {
        const viewButtons = Array.from(viewSwitcher.querySelectorAll('[data-view]'));

        const setActiveView = (targetView) => {
            if (targetView === currentView) {
                return;
            }

            currentView = targetView === 'growth' ? 'growth' : 'battle';

            const showingGrowth = currentView === 'growth';
            battleView.hidden = showingGrowth;
            growthView.hidden = !showingGrowth;

            viewButtons.forEach((button) => {
                const isActive = button.dataset.view === currentView;
                button.classList.toggle('view-switcher__button--active', isActive);
                button.setAttribute('aria-selected', isActive ? 'true' : 'false');
                button.setAttribute('tabindex', isActive ? '0' : '-1');
            });
        };

        viewSwitcher.addEventListener('click', (event) => {
            const button = event.target.closest('[data-view]');
            if (!button) {
                return;
            }
            setActiveView(button.dataset.view);
        });

        viewSwitcher.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
                return;
            }
            event.preventDefault();
            const currentIndex = viewButtons.findIndex((button) => button.dataset.view === currentView);
            if (currentIndex === -1) {
                return;
            }
            const offset = event.key === 'ArrowLeft' ? -1 : 1;
            const nextIndex = (currentIndex + offset + viewButtons.length) % viewButtons.length;
            const nextButton = viewButtons[nextIndex];
            if (nextButton) {
                nextButton.focus();
                setActiveView(nextButton.dataset.view);
            }
        });
    }

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
