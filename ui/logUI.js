// 战斗日志UI模块

const LOG_RENDER_INTERVAL = 600;

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
            players: []
        };
    }
    return resultLog._logState;
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
    const lineElement = document.createElement('div');
    lineElement.classList.add('log-line');
    lineElement.appendChild(highlightLine(line, state.players));
    resultLog.appendChild(lineElement);
    resultLog.scrollTop = resultLog.scrollHeight;

    state.timeoutId = window.setTimeout(() => processLogQueue(resultLog), LOG_RENDER_INTERVAL);
}

function displayBattleLog(log, updatePlayerInfo, player1, player2) {
    const resultLog = document.getElementById('result-log');
    if (!resultLog) {
        console.error('战斗日志DOM元素不存在');
        return;
    }

    const state = ensureLogState(resultLog);
    state.players = [
        { name: player1?.name, color: 'rgb(58, 109, 185)' },
        { name: player2?.name, color: 'rgb(218, 64, 53)' }
    ];

    const logLines = log.split('\n');
    const newLines = logLines.slice(state.renderedLines);
    if (!newLines.length) {
        updatePlayerInfo(player1, true);
        updatePlayerInfo(player2, false);
        return;
    }

    state.renderedLines = logLines.length;
    state.queue.push(...newLines);

    if (!state.processing) {
        processLogQueue(resultLog);
    }

    updatePlayerInfo(player1, true);
    updatePlayerInfo(player2, false);
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
        players: []
    };

    if (initialMessage) {
        const messageLine = document.createElement('div');
        messageLine.classList.add('log-line', 'log-line--system');
        messageLine.textContent = initialMessage;
        resultLog.appendChild(messageLine);
    }
}

export { displayBattleLog, resetBattleLog };
