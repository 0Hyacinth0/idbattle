// 主应用入口
import { generateAttributes } from './models/player.js';
import { BattleService } from './services/battleService.js';
import { initPlayerPanels } from './ui/playerUI.js';
import { initLogUI } from './ui/logUI.js';
import { EquipmentType, equipmentList, setEffects, equipmentByType } from './models/equipment.js';
import { initPlayerGrowthUI } from './ui/playerGrowthUI.js';
import { getPlayerConfig, listPlayerConfigs } from './utils/storage.js';
import { initBattleSummaryUI } from './ui/battleSummaryUI.js';
import { showFloatingText } from './ui/floatingText.js';
import { initTournamentUI } from './ui/tournamentUI.js';
import globalEventBus from './utils/EventBus.js';

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
    initLogUI();
    initPlayerGrowthUI();
    initTournamentUI();

    const battleSummaryUI = initBattleSummaryUI();

    // Theme toggle logic
    const themeBtn = document.getElementById('theme-toggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            document.documentElement.removeAttribute('data-theme');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }
    
    applyTheme(currentTheme);
    
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.hasAttribute('data-theme');
            const newTheme = isDark ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    globalEventBus.on('onBattleStart', () => {
        battleSummaryUI.handleBattleStart();
    });
    globalEventBus.on('onBattleEnd', (payload) => {
        battleSummaryUI.handleBattleEnd(payload);
    });
    globalEventBus.on('critical_hit', (payload) => {
        const targetEl = payload.target.id === battleService.player1.id ? document.querySelector('.player1-info .player-card') : document.querySelector('.player2-info .player-card');
        showFloatingText(targetEl, `-${payload.parameters.damage}`, 'crit');
    });
    globalEventBus.on('parry', (payload) => {
        const targetEl = payload.actor.id === battleService.player1.id ? document.querySelector('.player1-info .player-card') : document.querySelector('.player2-info .player-card');
        showFloatingText(targetEl, '招架', 'shield');
    });
    globalEventBus.on('state_change', (payload) => {
        // Only care about health changes during battle (excludes initial setup)
        if (payload.attribute === 'health' && battleService.currentRound) {
            const targetEl = payload.player.id === battleService.player1.id ? document.querySelector('.player1-info .player-card') : document.querySelector('.player2-info .player-card');
            const diff = payload.newValue - payload.oldValue;
            if (diff < 0) {
                // Normal damage
                showFloatingText(targetEl, `${diff}`, 'damage');
            } else if (diff > 0) {
                // Heal
                showFloatingText(targetEl, `+${diff}`, 'heal');
            }
        }
    });

    // Populate Datalist with saved profiles
    const savedPlayersList = document.getElementById('saved-players-list');
    function populateDatalist() {
        if (!savedPlayersList) return;
        savedPlayersList.innerHTML = '';
        const configs = listPlayerConfigs();
        configs.forEach(conf => {
            const option = document.createElement('option');
            option.value = conf.name;
            savedPlayersList.appendChild(option);
        });
    }
    populateDatalist();

    if (viewSwitcher && battleView && growthView) {
        const viewButtons = Array.from(viewSwitcher.querySelectorAll('[data-view]'));

        const setActiveView = (targetView) => {
            if (targetView === currentView) {
                return;
            }

            // Ensure valid target view
            if (!['battle', 'growth', 'tournament'].includes(targetView)) {
                targetView = 'battle';
            }

            currentView = targetView;

            const tournamentView = document.querySelector('[data-role="tournament-view"]');

            battleView.hidden = currentView !== 'battle';
            growthView.hidden = currentView !== 'growth';
            if (tournamentView) {
                tournamentView.hidden = currentView !== 'tournament';
            }

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

        // Setup battle controls
        const btnPause = document.getElementById('control-pause');
        const btnSpeed = document.getElementById('control-speed');
        const btnSkip = document.getElementById('control-skip');

        btnPause.disabled = false;
        btnSpeed.disabled = false;
        btnSkip.disabled = false;

        btnPause.textContent = '暂停';
        btnSpeed.textContent = '1x倍速';
        battleService.isPaused = false;
        battleService.isSkipping = false;
        battleService.playbackSpeed = 1.0;

        btnPause.onclick = () => {
            battleService.isPaused = !battleService.isPaused;
            btnPause.textContent = battleService.isPaused ? '继续' : '暂停';
        };

        btnSpeed.onclick = () => {
            if (battleService.playbackSpeed === 1.0) {
                battleService.playbackSpeed = 2.0;
                btnSpeed.textContent = '2x倍速';
            } else if (battleService.playbackSpeed === 2.0) {
                battleService.playbackSpeed = 4.0;
                btnSpeed.textContent = '4x倍速';
            } else {
                battleService.playbackSpeed = 1.0;
                btnSpeed.textContent = '1x倍速';
            }
        };

        btnSkip.onclick = () => {
            // Unpause if paused when skipping
            battleService.isPaused = false;
            btnPause.textContent = '暂停';
            btnPause.disabled = true;
            btnSpeed.disabled = true;
            btnSkip.disabled = true;
            battleService.isSkipping = true;
        };

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

            battleService.setPlayers(player1, player2);


            await battleService.battle();
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

        const btnPause = document.getElementById('control-pause');
        const btnSpeed = document.getElementById('control-speed');
        const btnSkip = document.getElementById('control-skip');
        if (btnPause) btnPause.disabled = true;
        if (btnSpeed) btnSpeed.disabled = true;
        if (btnSkip) btnSkip.disabled = true;
    }
});
