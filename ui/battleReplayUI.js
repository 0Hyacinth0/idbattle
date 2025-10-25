import { BattleReplayController } from '../services/battleReplayService.js';
import { renderBattleLogSnapshot } from './logUI.js';
import { buildBattleSummary } from '../services/battleSummaryService.js';
import { initBattleSummaryPanel } from './battleSummaryPanel.js';

function formatTime(ms) {
    if (!Number.isFinite(ms)) {
        return '0:00';
    }
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function cloneEntity(entity) {
    if (!entity) {
        return null;
    }
    if (typeof globalThis.structuredClone === 'function') {
        try {
            return globalThis.structuredClone(entity);
        } catch (error) {
            // ignore and fallback
        }
    }
    return JSON.parse(JSON.stringify(entity));
}

function createRoundOption(round) {
    const option = document.createElement('option');
    option.value = String(round.round);
    option.textContent = `第 ${round.round} 回合`;
    return option;
}

function setActiveSpeedButton(buttons, activeButton) {
    buttons.forEach((button) => {
        button.classList.toggle('battle-replay__speed--active', button === activeButton);
    });
}

export function initBattleReplayUI({ updatePlayerInfo }) {
    const container = document.querySelector('[data-role="battle-replay"]');
    if (!container) {
        return {
            handleBattleStart() {},
            handleBattleEnd() {}
        };
    }

    const playButton = container.querySelector('[data-action="replay-toggle"]');
    const speedButtons = Array.from(container.querySelectorAll('[data-speed]'));
    const slider = container.querySelector('[data-role="replay-slider"]');
    const currentTimeLabel = container.querySelector('[data-role="replay-current"]');
    const totalTimeLabel = container.querySelector('[data-role="replay-total"]');
    const roundLabel = container.querySelector('[data-role="replay-round-label"]');
    const roundSelect = container.querySelector('[data-role="replay-round"]');
    const summaryButton = container.querySelector('[data-role="open-summary"]');

    const summaryPanel = initBattleSummaryPanel();

    let controller = null;
    let lastBattlePayload = null;
    let summaryCache = null;
    let isScrubbing = false;
    let hasReplayActivated = false;

    const disableControls = () => {
        playButton.disabled = true;
        slider.disabled = true;
        roundSelect.disabled = true;
        summaryButton.disabled = true;
    };

    const resetSlider = () => {
        slider.value = '0';
        slider.min = '0';
        slider.max = '1';
        slider.step = '50';
    };

    const resetTimeLabels = () => {
        currentTimeLabel.textContent = '0:00';
        totalTimeLabel.textContent = '0:00';
        roundLabel.textContent = '';
    };

    const resetRoundOptions = () => {
        roundSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '回合跳转';
        placeholder.disabled = true;
        placeholder.selected = true;
        roundSelect.appendChild(placeholder);
    };

    const resetState = () => {
        container.hidden = true;
        if (controller) {
            controller.destroy();
            controller = null;
        }
        lastBattlePayload = null;
        summaryCache = null;
        isScrubbing = false;
        hasReplayActivated = false;
        playButton.textContent = '播放';
        setActiveSpeedButton(speedButtons, speedButtons[0] || null);
        disableControls();
        resetSlider();
        resetTimeLabels();
        resetRoundOptions();
    };

    const updatePlayButton = (isPlaying) => {
        playButton.textContent = isPlaying ? '暂停' : '播放';
    };

    const updateSliderConfig = (duration) => {
        const roundedDuration = Math.max(1, Math.round(duration));
        slider.max = String(roundedDuration);
        const step = Math.max(50, Math.round(roundedDuration / 200));
        slider.step = String(step);
        slider.disabled = false;
    };

    const populateRoundOptions = (rounds) => {
        resetRoundOptions();
        if (!Array.isArray(rounds) || !rounds.length) {
            roundSelect.disabled = true;
            return;
        }
        rounds.forEach((round) => {
            if (typeof round.round !== 'number' || Number.isNaN(round.round)) {
                return;
            }
            roundSelect.appendChild(createRoundOption(round));
        });
        roundSelect.disabled = false;
    };

    const applyPlayerState = (players) => {
        const cloned = {
            player1: players?.player1 ? cloneEntity(players.player1) : null,
            player2: players?.player2 ? cloneEntity(players.player2) : null
        };
        if (cloned.player1) {
            updatePlayerInfo(cloned.player1, true);
        }
        if (cloned.player2) {
            updatePlayerInfo(cloned.player2, false);
        }
        return cloned;
    };

    const updateLog = (payload) => {
        if (!controller) {
            return;
        }
        const player1 = payload.players?.player1 || null;
        const player2 = payload.players?.player2 || null;
        const logPayload = controller.getLogPayload();
        if (!logPayload) {
            return;
        }

        const logIndex = Number.isInteger(payload?.logIndex) ? payload.logIndex : null;
        const currentTime = Number.isFinite(payload?.time) ? payload.time : 0;
        const firstEntryTimestamp = Number.isFinite(payload?.logEntries?.[0]?.timestamp)
            ? payload.logEntries[0].timestamp
            : 0;
        const atInitialState = (!Number.isInteger(logIndex) || logIndex <= 1) && currentTime <= firstEntryTimestamp;

        if (!hasReplayActivated && !controller.isPlaying && !isScrubbing && atInitialState) {
            return;
        }

        if (!hasReplayActivated) {
            hasReplayActivated = true;
        }

        const visibleCount = Number.isInteger(logIndex) ? logIndex : null;
        renderBattleLogSnapshot(logPayload, visibleCount, player1, player2);
    };

    const updateTimeline = (payload) => {
        if (!payload) {
            return;
        }
        if (!isScrubbing) {
            slider.value = String(Math.round(payload.time));
        }
        currentTimeLabel.textContent = formatTime(payload.time);
        totalTimeLabel.textContent = formatTime(payload.duration);
        if (payload.round && payload.round > 0) {
            roundLabel.textContent = `当前：第 ${payload.round} 回合`;
        } else {
            roundLabel.textContent = '当前：准备阶段';
        }
    };

    const bindController = (instance) => {
        controller = instance;
        const readyHandler = ({ duration, rounds }) => {
            updateSliderConfig(duration);
            totalTimeLabel.textContent = formatTime(duration);
            populateRoundOptions(rounds);
        };
        const updateHandler = (state) => {
            const clonedPlayers = applyPlayerState(state.players || {});
            updateLog({ ...state, players: clonedPlayers });
            updateTimeline(state);
        };
        const playstateHandler = ({ isPlaying }) => {
            updatePlayButton(Boolean(isPlaying));
        };

        controller.on('ready', readyHandler);
        controller.on('update', updateHandler);
        controller.on('playstate', playstateHandler);

        // Ensure UI reflects initial state
        updateSliderConfig(controller.getDuration());
        populateRoundOptions(controller.getRounds());
        if (speedButtons.length) {
            const defaultButton = speedButtons[0];
            const defaultSpeed = Number(defaultButton.dataset.speed) || 1;
            controller.setSpeed(defaultSpeed);
            setActiveSpeedButton(speedButtons, defaultButton);
        }
        controller.seekTo(0);
        controller.pause();
    };

    const ensureSummary = () => {
        if (summaryCache || !lastBattlePayload) {
            return summaryCache;
        }
        try {
            summaryCache = buildBattleSummary({
                structuredLog: lastBattlePayload.structuredLog || controller?.getLogPayload()?.structured || null,
                compressedLog: lastBattlePayload.compressedLog || null,
                textLog: lastBattlePayload.log || '',
                player1: lastBattlePayload.player1,
                player2: lastBattlePayload.player2,
                winner: lastBattlePayload.winner || null,
                isDraw: lastBattlePayload.isDraw
            });
        } catch (error) {
            console.error('生成战斗总结失败', error);
            summaryCache = null;
        }
        return summaryCache;
    };

    playButton.addEventListener('click', () => {
        if (!controller) {
            return;
        }
        if (!hasReplayActivated) {
            hasReplayActivated = true;
            controller.seekTo(0);
            controller.play();
            return;
        }
        if (!controller.isPlaying) {
            const duration = controller.getDuration();
            if (Number.isFinite(duration) && duration > 0 && controller.currentTime >= duration) {
                controller.seekTo(0);
            }
        }
        controller.togglePlay();
    });

    speedButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (!controller) {
                return;
            }
            const speed = Number(button.dataset.speed);
            if (!Number.isFinite(speed) || speed <= 0) {
                return;
            }
            controller.setSpeed(speed);
            setActiveSpeedButton(speedButtons, button);
        });
    });

    if (slider) {
        slider.addEventListener('pointerdown', () => {
            isScrubbing = true;
            hasReplayActivated = true;
            if (controller) {
                controller.pause();
            }
        });
        slider.addEventListener('pointerup', () => {
            isScrubbing = false;
        });
        slider.addEventListener('input', () => {
            if (!controller) {
                return;
            }
            const value = Number(slider.value);
            if (!Number.isFinite(value)) {
                return;
            }
            controller.seekTo(value);
        });
    }

    if (roundSelect) {
        roundSelect.addEventListener('change', () => {
            if (!controller) {
                return;
            }
            const selected = Number(roundSelect.value);
            if (Number.isNaN(selected)) {
                return;
            }
            hasReplayActivated = true;
            controller.pause();
            controller.jumpToRound(selected);
        });
    }

    summaryButton.addEventListener('click', () => {
        const summary = ensureSummary();
        if (!summary) {
            return;
        }
        summaryPanel.open(summary);
    });

    return {
        handleBattleStart() {
            summaryPanel.close();
            resetState();
        },
        handleBattleEnd(payload) {
            summaryPanel.close();
            resetState();
            if (!payload) {
                return;
            }
            lastBattlePayload = payload;
            try {
                const instance = new BattleReplayController({
                    structuredLog: payload.structuredLog || null,
                    compressedLog: payload.compressedLog || null,
                    textLog: payload.log || '',
                    players: { player1: payload.player1, player2: payload.player2 }
                });
                bindController(instance);
                container.hidden = false;
                playButton.disabled = false;
                summaryButton.disabled = false;
            } catch (error) {
                console.error('初始化战斗回放失败', error);
                resetState();
            }
        }
    };
}
