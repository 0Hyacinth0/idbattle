// 战斗日志UI模块

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

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlightLine(line, players) {
    const container = document.createElement('span');
    container.textContent = line;
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
            updatePlayerInfo: null,
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
    lineElement.textContent = line;
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

    if (typeof state.updatePlayerInfo === 'function' && state.playerRefs) {
        const { player1, player2 } = state.playerRefs;
        state.updatePlayerInfo(player1, true);
        state.updatePlayerInfo(player2, false);
    }

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

function displayBattleLog(logPayload, updatePlayerInfo, player1, player2) {
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
    state.updatePlayerInfo = updatePlayerInfo;

    const logLines = text.split('\n');
    const newLines = logLines.slice(state.renderedLines);
    if (!newLines.length) {
        if (typeof updatePlayerInfo === 'function') {
            updatePlayerInfo(player1, true);
            updatePlayerInfo(player2, false);
        }
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
        updatePlayerInfo: null,
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

export { displayBattleLog, resetBattleLog };
