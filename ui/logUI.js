// 战斗日志UI模块

// 显示战斗日志
function displayBattleLog(log, updatePlayerInfo, player1, player2) {
    const resultLog = document.getElementById('result-log');
    if (!resultLog) {
        console.error('战斗日志DOM元素不存在');
        return;
    }

    // 清空战斗日志
    resultLog.textContent = '';

    // 拆分日志为行
    const logLines = log.split('\n');

    // 一次性显示所有日志行，为玩家名字添加颜色
    logLines.forEach(line => {
        // 为玩家1和玩家2的名字添加不同颜色
        let coloredLine = line;
        if (player1 && player1.name) {
            coloredLine = coloredLine.replace(
                new RegExp(player1.name, 'g'),
                `<span style="color:rgb(58, 109, 185);">${player1.name}</span>`
            );
        }
        if (player2 && player2.name) {
            coloredLine = coloredLine.replace(
                new RegExp(player2.name, 'g'),
                `<span style="color:rgb(218, 64, 53);">${player2.name}</span>`
            );
        }
        resultLog.innerHTML += coloredLine + '<br>';
    });

    // 滚动到底部
    resultLog.scrollTop = resultLog.scrollHeight;

    // 更新玩家信息
    updatePlayerInfo(player1, true);
    updatePlayerInfo(player2, false);
}

export { displayBattleLog };