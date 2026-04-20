// 战斗日志UI模块
import { battleStore } from '../store/BattleStore.js';

export function initLogUI() {
    battleStore.subscribe((state, changedKeys) => {
        if (changedKeys.includes('logs') && state.logs.length > 0) {
            const latestLog = state.logs[state.logs.length - 1];
            displayBattleLog(latestLog, state.player1, state.player2);
        } else if (changedKeys.includes('isBattling') && state.isBattling) {
            resetBattleLog('战斗开始！');
        }
    });
}

const LOG_RENDER_INTERVAL = 0;

let resizeListenerAttached = false;

function parseCssValue(value) {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function calculateResultLogMetrics(resultLog) {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return { availableHeight: null, battleResult: null, maxPlayerHeight: null };
    }

    const battleResult = resultLog?.closest('.battle-result') ?? null;
    const playerPanels = Array.from(document.querySelectorAll('.player-info'));

    if (!resultLog || !battleResult || !playerPanels.length) {
        return { availableHeight: null, battleResult, maxPlayerHeight: null };
    }

    const maxPlayerHeight = Math.max(
        ...playerPanels.map((panel) => panel.offsetHeight || 0)
    );

    if (!Number.isFinite(maxPlayerHeight) || maxPlayerHeight <= 0) {
        return { availableHeight: null, battleResult, maxPlayerHeight: null };
    }

    const battleResultStyles = window.getComputedStyle(battleResult);
    const paddingTop = parseCssValue(battleResultStyles.paddingTop);
    const paddingBottom = parseCssValue(battleResultStyles.paddingBottom);

    const header = battleResult.querySelector('h2');
    let headerSpace = 0;
    if (header) {
        const headerStyles = window.getComputedStyle(header);
        headerSpace =
            header.offsetHeight +
            parseCssValue(headerStyles.marginTop) +
            parseCssValue(headerStyles.marginBottom);
    }

    const availableHeight = Math.max(0, maxPlayerHeight - paddingTop - paddingBottom - headerSpace);

    return { availableHeight, battleResult, maxPlayerHeight };
}

function syncResultLogHeight(resultLog) {
    ensureResizeListener();

    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    const target = resultLog || document.getElementById('result-log');

    if (!target) {
        return;
    }

    const { availableHeight, battleResult, maxPlayerHeight } = calculateResultLogMetrics(target);

    if (!battleResult) {
        target.style.maxHeight = '';
        return;
    }

    if (availableHeight === null || maxPlayerHeight === null) {
        target.style.maxHeight = '';
        battleResult.style.removeProperty('max-height');
        return;
    }

    window.requestAnimationFrame(() => {
        battleResult.style.maxHeight = `${maxPlayerHeight}px`;
        target.style.maxHeight = `${availableHeight}px`;
    });
}

function ensureResizeListener() {
    if (resizeListenerAttached || typeof window === 'undefined') {
        return;
    }

    window.addEventListener('resize', () => syncResultLogHeight());
    resizeListenerAttached = true;
}

const ROUND_HEADER_REGEX = /^第\s*\d+\s*回合[:：]/;
const SEPARATOR_REGEX = /^=+$/;
const ACTION_HEADER_REGEX = /^【.*行动回合.*】/;

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeIdSpacing(line) {
    if (typeof line !== 'string') {
        return line;
    }
    let normalized = line.replace(/\bID\b\s*[:：]\s*/gi, 'ID：');
    normalized = normalized.replace(/\bID\b\s*(\d+)/gi, 'ID：$1');
    normalized = normalized.replace(/([（(])\s*(ID：)/g, '$1$2');
    normalized = normalized.replace(/(?<![\s（(])ID：/g, ' ID：');
    normalized = normalized.replace(/ID：\s+/g, 'ID：');
    normalized = normalized.replace(/\s+(ID：)/g, ' $1');
    normalized = normalized.replace(/^\s+ID：/g, 'ID：');
    return normalized;
}

function highlightLine(line, players) {
    const container = document.createElement('span');
    const normalizedLine = normalizeIdSpacing(line);
    container.textContent = normalizedLine;
    let processed = container.innerHTML;

    players.forEach(({ name, color }) => {
        if (!name) {
            return;
        }
        const escapedName = escapeHtml(name);
        const highlight = `<span style="color:${color};">${escapedName}</span>`;
        const nameRegex = new RegExp(escapedName, 'g');
        processed = processed.replace(nameRegex, highlight);
    });

    container.innerHTML = processed;
    return container;
}

function renderLogSnapshot(resultLog, lines, players, activeIndex = -1) {
    if (!resultLog) {
        return;
    }

    resultLog.innerHTML = '';
    let currentRoundBody = null;

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (ROUND_HEADER_REGEX.test(trimmedLine)) {
            const roundElement = document.createElement('div');
            roundElement.classList.add('log-round');

            const header = document.createElement('div');
            header.classList.add('log-round__header');
            if (index === activeIndex) {
                header.classList.add('log-round__header--active');
            }
            header.appendChild(highlightLine(line, players));
            roundElement.appendChild(header);

            const body = document.createElement('div');
            body.classList.add('log-round__body');
            roundElement.appendChild(body);

            resultLog.appendChild(roundElement);
            currentRoundBody = body;
        } else if (SEPARATOR_REGEX.test(trimmedLine)) {
            const separator = document.createElement('div');
            separator.classList.add('log-line', 'log-line--system');
            if (index === activeIndex) {
                separator.classList.add('log-line--active');
            }
            separator.textContent = normalizeIdSpacing(line);
            resultLog.appendChild(separator);
            currentRoundBody = null;
        } else if (currentRoundBody) {
            const entry = document.createElement('div');
            entry.classList.add('log-entry');
            if (ACTION_HEADER_REGEX.test(trimmedLine)) {
                entry.classList.add('log-entry--action-header');
            }
            if (index === activeIndex) {
                entry.classList.add('log-entry--active');
            }
            entry.appendChild(highlightLine(line, players));
            currentRoundBody.appendChild(entry);
        } else {
            const lineElement = document.createElement('div');
            lineElement.classList.add('log-line');
            if (index === activeIndex) {
                lineElement.classList.add('log-line--active');
            }
            lineElement.appendChild(highlightLine(line, players));
            resultLog.appendChild(lineElement);
        }
    });

    resultLog.scrollTop = resultLog.scrollHeight;
    syncResultLogHeight(resultLog);
}

function ensureLogState(resultLog) {
    if (!resultLog._logState) {
        resultLog._logState = {
            queue: [],
            renderedLines: 0,
            processing: false,
            timeoutId: null,
            players: [],
            currentRoundBody: null,
            playerRefs: null,
            structuredLog: null,
            compressedLog: null
        };
    }
    return resultLog._logState;
}

function createRoundContainer(resultLog, line, players) {
    const roundElement = document.createElement('div');
    roundElement.classList.add('log-round');

    const header = document.createElement('div');
    header.classList.add('log-round__header');
    header.appendChild(highlightLine(line, players));
    roundElement.appendChild(header);

    const body = document.createElement('div');
    body.classList.add('log-round__body');
    roundElement.appendChild(body);

    resultLog.appendChild(roundElement);
    return body;
}

function appendSystemLine(resultLog, line, className = 'log-line') {
    const lineElement = document.createElement('div');
    lineElement.classList.add(...className.split(' '));
    lineElement.textContent = normalizeIdSpacing(line);
    resultLog.appendChild(lineElement);
}

function processLogQueue(resultLog) {
    const state = resultLog._logState;

    if (!state || !state.queue.length) {
        if (state) {
            state.processing = false;
            state.timeoutId = null;
        }
        return;
    }

    state.processing = true;
    const line = state.queue.shift();
    const trimmedLine = line.trim();

    if (ROUND_HEADER_REGEX.test(trimmedLine)) {
        state.currentRoundBody = createRoundContainer(resultLog, trimmedLine, state.players);
    } else if (SEPARATOR_REGEX.test(trimmedLine)) {
        appendSystemLine(resultLog, line, 'log-line log-line--system');
        state.currentRoundBody = null;
    } else if (state.currentRoundBody) {
        const entry = document.createElement('div');
        entry.classList.add('log-entry');
        entry.appendChild(highlightLine(line, state.players));
        state.currentRoundBody.appendChild(entry);
    } else {
        const lineElement = document.createElement('div');
        lineElement.classList.add('log-line');
        lineElement.appendChild(highlightLine(line, state.players));
        resultLog.appendChild(lineElement);
    }

    resultLog.scrollTop = resultLog.scrollHeight;
    syncResultLogHeight(resultLog);

    state.timeoutId = window.setTimeout(() => processLogQueue(resultLog), LOG_RENDER_INTERVAL);
}

function normalizeLogPayload(payload) {
    if (typeof payload === 'string') {
        return { text: payload, structured: null, compressed: null };
    }
    if (!payload || typeof payload !== 'object') {
        return { text: '', structured: null, compressed: null };
    }
    return {
        text: typeof payload.text === 'string' ? payload.text : '',
        structured: payload.structured ?? null,
        compressed: payload.compressed ?? null
    };
}

function displayBattleLog(logPayload, player1, player2) {
    const resultLog = document.getElementById('result-log');
    if (!resultLog) {
        console.error('战斗日志DOM元素不存在');
        return;
    }

    syncResultLogHeight(resultLog);

    const state = ensureLogState(resultLog);
    const { text, structured, compressed } = normalizeLogPayload(logPayload);
    state.structuredLog = structured;
    state.compressedLog = compressed;
    state.players = [
        { name: player1?.name, color: 'rgb(58, 109, 185)' },
        { name: player2?.name, color: 'rgb(218, 64, 53)' }
    ];
    state.playerRefs = { player1, player2 };

    const logLines = text.split('\n');
    const newLines = logLines.slice(state.renderedLines);
    if (!newLines.length) {
        return;
    }

    state.renderedLines = logLines.length;
    state.queue.push(...newLines);

    if (!state.processing) {
        processLogQueue(resultLog);
    }
}

function resetBattleLog(initialMessage = '') {
    const resultLog = document.getElementById('result-log');
    if (!resultLog) {
        return;
    }

    if (resultLog._logState?.timeoutId) {
        window.clearTimeout(resultLog._logState.timeoutId);
    }

    resultLog.innerHTML = '';
    resultLog.scrollTop = 0;
    resultLog._logState = {
        queue: [],
        renderedLines: 0,
        processing: false,
        timeoutId: null,
        players: [],
        currentRoundBody: null,
        playerRefs: null,
        structuredLog: null,
        compressedLog: null
    };

    if (initialMessage) {
        const messageLine = document.createElement('div');
        messageLine.classList.add('log-line', 'log-line--system');
        messageLine.textContent = initialMessage;
        resultLog.appendChild(messageLine);
    }

    syncResultLogHeight(resultLog);
}

function renderBattleLogSnapshot(logPayload, visibleCount = null, player1 = null, player2 = null, options = {}) {
    const resultLog = document.getElementById('result-log');
    if (!resultLog) {
        return;
    }

    const state = ensureLogState(resultLog);
    const { text, structured, compressed } = normalizeLogPayload(logPayload);
    state.structuredLog = structured;
    state.compressedLog = compressed;

    const players = [
        { name: player1?.name, color: 'rgb(58, 109, 185)' },
        { name: player2?.name, color: 'rgb(218, 64, 53)' }
    ];
    state.players = players;

    const lines = text ? text.split('\n') : [];
    const count = Number.isInteger(visibleCount) ? Math.min(Math.max(visibleCount, 0), lines.length) : lines.length;
    const subset = lines.slice(0, count);
    const highlightLatest = options.highlightLatest !== false;
    const activeIndex = highlightLatest && count > 0 ? count - 1 : -1;

    renderLogSnapshot(resultLog, subset, players, activeIndex);

    state.renderedLines = count;
    state.queue = [];
    state.processing = false;
    state.currentRoundBody = null;
    state.timeoutId = null;
    state.playerRefs = { player1, player2 };
}

export { displayBattleLog, resetBattleLog, renderBattleLogSnapshot };
