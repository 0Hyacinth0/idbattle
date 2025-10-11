// 战斗日志UI模块

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

// 显示战斗日志
function displayBattleLog(log, updatePlayerInfo, player1, player2) {
    const resultLog = document.getElementById('result-log');
    if (!resultLog) {
        console.error('战斗日志DOM元素不存在');
        return;
    }

    const logLines = log.split('\n');
    const fragment = document.createDocumentFragment();
    const players = [
        { name: player1?.name, color: 'rgb(58, 109, 185)' },
        { name: player2?.name, color: 'rgb(218, 64, 53)' }
    ];

    logLines.forEach(line => {
        const lineElement = document.createElement('div');
        lineElement.appendChild(highlightLine(line, players));
        fragment.appendChild(lineElement);
    });

    resultLog.innerHTML = '';
    resultLog.appendChild(fragment);
    resultLog.scrollTop = resultLog.scrollHeight;

    updatePlayerInfo(player1, true);
    updatePlayerInfo(player2, false);
}

export { displayBattleLog };
