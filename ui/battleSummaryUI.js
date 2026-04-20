import { buildBattleSummary } from '../services/battleSummaryService.js';
import { initBattleSummaryPanel } from './battleSummaryPanel.js';

function formatResultMessage(summary) {
    if (!summary) {
        return '战斗总结暂不可用';
    }
    if (summary.isDraw) {
        return '战斗以平局结束';
    }
    if (summary.winner) {
        return `胜者：${summary.winner}`;
    }
    return '战斗已结束';
}

export function initBattleSummaryUI() {
    const trigger = document.querySelector('[data-role="battle-summary-trigger"]');
    if (!trigger) {
        return {
            handleBattleStart() {},
            handleBattleEnd() {}
        };
    }

    const openButton = trigger.querySelector('[data-action="open-summary"]');
    const statusLabel = trigger.querySelector('[data-role="summary-status"]');
    if (statusLabel) {
        statusLabel.textContent = statusLabel.textContent.trim();
    }
    const summaryPanel = initBattleSummaryPanel();

    let summaryCache = null;

    const updateTriggerState = ({ enabled, message, hidden }) => {
        if (typeof hidden === 'boolean') {
            trigger.hidden = hidden;
        }
        if (openButton) {
            openButton.disabled = !enabled;
        }
        if (statusLabel && typeof message === 'string') {
            statusLabel.textContent = message;
        }
    };

    const closeSummary = () => {
        summaryPanel.close();
    };

    openButton?.addEventListener('click', () => {
        if (!summaryCache) {
            return;
        }
        summaryPanel.open(summaryCache);
    });

    return {
        handleBattleStart() {
            summaryCache = null;
            closeSummary();
            updateTriggerState({
                enabled: false,
                message: '战斗总结生成中...',
                hidden: true
            });
        },
        handleBattleEnd(payload) {
            summaryCache = null;
            closeSummary();

            if (!payload) {
                updateTriggerState({
                    enabled: false,
                    message: '战斗数据缺失，无法生成总结',
                    hidden: false
                });
                return;
            }

            try {
                summaryCache = buildBattleSummary({
                    structuredLog: payload.structuredLog || null,
                    compressedLog: payload.compressedLog || null,
                    textLog: payload.log || '',
                    player1: payload.player1,
                    player2: payload.player2,
                    winner: payload.winner || null,
                    isDraw: payload.isDraw
                });
            } catch (error) {
                console.error('生成战斗总结失败', error);
                summaryCache = null;
            }

            if (!summaryCache) {
                updateTriggerState({
                    enabled: false,
                    message: '战斗总结生成失败',
                    hidden: false
                });
                return;
            }

            updateTriggerState({
                enabled: true,
                message: formatResultMessage(summaryCache),
                hidden: false
            });
        }
    };
}
