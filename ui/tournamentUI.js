import { tournamentStore } from '../store/TournamentStore.js';
import { initTournament, simulateMatchFast, watchMatch, transitionToBracket } from '../services/tournamentService.js';
import { getPlayerConfig, listPlayerConfigs } from '../utils/storage.js';

export function initTournamentUI() {
    const container = document.getElementById('tournament-container');
    if (!container) return;

    // Listen to store changes to re-render the view
    tournamentStore.subscribe(() => {
        renderTournamentView(container);
    });

    // Initial render
    renderTournamentView(container);
}

function renderTournamentView(container) {
    const phase = tournamentStore.phase;

    container.innerHTML = ''; // Clear container

    if (phase === 'registration') {
        renderRegistrationPhase(container);
    } else if (phase === 'group_stage') {
        renderGroupStagePhase(container);
    } else if (phase === 'bracket_stage') {
        renderBracketPhase(container);
    } else if (phase === 'finished') {
        renderTournamentFinished(container);
    }
}

function renderRegistrationPhase(container) {
    // Top wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'tournament-registration';

    const title = document.createElement('h2');
    title.textContent = '淘汰赛报名 (8 - 25人)';
    wrapper.appendChild(title);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'registration-input-area';
    inputArea.style.marginBottom = '20px';
    inputArea.style.display = 'flex';
    inputArea.style.gap = '10px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '输入或选择玩家名...';
    input.setAttribute('list', 'tournament-players-list');

    // Create datalist for saved configs
    const dataList = document.createElement('datalist');
    dataList.id = 'tournament-players-list';
    const configs = listPlayerConfigs();
    configs.forEach(conf => {
        const option = document.createElement('option');
        option.value = conf.name;
        dataList.appendChild(option);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '添加选手';
    addBtn.onclick = () => {
        const name = input.value.trim();
        if (name) {
            const added = tournamentStore.addParticipant(name);
            if (added) {
                input.value = '';
                input.focus();
            } else {
                alert('玩家已存在或名字无效！');
            }
        }
    };

    inputArea.appendChild(input);
    inputArea.appendChild(dataList);
    inputArea.appendChild(addBtn);
    wrapper.appendChild(inputArea);

    // Participant List
    const pCountStr = document.createElement('p');
    pCountStr.textContent = `已报名选手：${tournamentStore.participants.length} 人`;
    pCountStr.style.fontWeight = 'bold';
    wrapper.appendChild(pCountStr);

    const pList = document.createElement('ul');
    pList.className = 'participant-list';
    pList.style.display = 'grid';
    pList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    pList.style.gap = '10px';
    pList.style.listStyle = 'none';
    pList.style.padding = '0';
    pList.style.marginTop = '10px';

    tournamentStore.participants.forEach(p => {
        const li = document.createElement('li');
        li.style.background = '#333';
        li.style.padding = '8px';
        li.style.borderRadius = '4px';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = p;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.style.background = 'transparent';
        removeBtn.style.color = '#ff4444';
        removeBtn.style.border = 'none';
        removeBtn.style.cursor = 'pointer';
        removeBtn.onclick = () => {
            tournamentStore.removeParticipant(p);
        };

        li.appendChild(nameSpan);
        li.appendChild(removeBtn);
        pList.appendChild(li);
    });
    wrapper.appendChild(pList);

    // Start Button
    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.textContent = '生成赛事 & 开始小组赛';
    startBtn.style.marginTop = '30px';
    startBtn.style.padding = '10px 20px';
    startBtn.style.fontSize = '1.1em';

    const count = tournamentStore.participants.length;
    if (count < 8 || count > 25) {
        startBtn.disabled = true;
        startBtn.title = '人数必须在8到25人之间';
    }

    startBtn.onclick = () => {
        if (count >= 8 && count <= 25) {
            initTournament(tournamentStore.participants);
        }
    };

    wrapper.appendChild(startBtn);
    container.appendChild(wrapper);
}

function renderGroupStagePhase(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tournament-group-stage';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const title = document.createElement('h2');
    title.textContent = '小组赛';

    const nextPhaseBtn = document.createElement('button');
    nextPhaseBtn.textContent = '结束小组赛进入淘汰赛';
    nextPhaseBtn.onclick = () => {
        transitionToBracket();
    };

    header.appendChild(title);
    header.appendChild(nextPhaseBtn);
    wrapper.appendChild(header);

    // Two columns for Group A and Group B
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '20px';

    const renderGroup = (group) => {
        const gDiv = document.createElement('div');
        gDiv.className = 'tournament-group';

        const gTitle = document.createElement('h3');
        gTitle.textContent = `${group.name} 组积分榜`;
        gDiv.appendChild(gTitle);

        // Standings Table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginBottom = '20px';

        table.innerHTML = `
            <thead>
                <tr style="border-bottom: 1px solid #666; text-align: left;">
                    <th style="padding: 8px;">排名</th>
                    <th style="padding: 8px;">ID</th>
                    <th style="padding: 8px;">分数</th>
                    <th style="padding: 8px;">胜场</th>
                    <th style="padding: 8px;">场次</th>
                </tr>
            </thead>
            <tbody>
                ${group.standings.map((s, idx) => `
                    <tr style="border-bottom: 1px solid #444;">
                        <td style="padding: 8px;">${idx + 1}</td>
                        <td style="padding: 8px; font-weight: bold;">${s.id}</td>
                        <td style="padding: 8px;">${s.points}</td>
                        <td style="padding: 8px;">${s.wins}</td>
                        <td style="padding: 8px;">${s.matchesPlayed}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        gDiv.appendChild(table);

        // Schedule
        const sTitle = document.createElement('h3');
        sTitle.textContent = `${group.name} 组赛程`;
        gDiv.appendChild(sTitle);

        const sList = document.createElement('div');
        sList.className = 'tournament-schedule';
        sList.style.display = 'flex';
        sList.style.flexDirection = 'column';
        sList.style.gap = '10px';
        sList.style.maxHeight = '400px';
        sList.style.overflowY = 'auto';

        // Group by round
        const rounds = {};
        group.schedule.forEach(m => {
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        });

        Object.keys(rounds).sort((a, b) => a - b).forEach(r => {
            const rDiv = document.createElement('div');
            const rTitle = document.createElement('h4');
            rTitle.textContent = `第 ${r} 轮`;
            rTitle.style.margin = '5px 0';
            rDiv.appendChild(rTitle);

            const ml = document.createElement('ul');
            ml.style.listStyle = 'none';
            ml.style.padding = '0';
            ml.style.margin = '0';

            rounds[r].forEach(m => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.style.padding = '8px';
                li.style.background = '#2a2a2a';
                li.style.borderRadius = '4px';
                li.style.marginBottom = '5px';

                const matchInfo = document.createElement('span');
                const isP1Win = m.state === 'completed' && m.winner === m.p1;
                const isP2Win = m.state === 'completed' && m.winner === m.p2;

                let p1Text = m.p1;
                let p2Text = m.p2;

                if (isP1Win) p1Text = `<strong style="color: #4CAF50;">${m.p1}</strong>`;
                if (isP2Win) p2Text = `<strong style="color: #4CAF50;">${m.p2}</strong>`;

                matchInfo.innerHTML = `${p1Text} <span style="color:#888;">vs</span> ${p2Text}`;

                const controls = document.createElement('div');
                controls.style.display = 'flex';
                controls.style.gap = '5px';

                if (m.state === 'pending') {
                    const simBtn = document.createElement('button');
                    simBtn.textContent = '快速结算';
                    simBtn.style.padding = '4px 8px';
                    simBtn.style.fontSize = '0.9em';
                    simBtn.onclick = () => simulateMatchFast(m.id);

                    const watchBtn = document.createElement('button');
                    watchBtn.textContent = '观看比赛';
                    watchBtn.style.padding = '4px 8px';
                    watchBtn.style.fontSize = '0.9em';
                    watchBtn.onclick = () => watchMatch(m.id);

                    controls.appendChild(simBtn);
                    controls.appendChild(watchBtn);
                } else {
                    const status = document.createElement('span');
                    status.textContent = '已结束';
                    status.style.color = '#888';
                    controls.appendChild(status);
                }

                li.appendChild(matchInfo);
                li.appendChild(controls);
                ml.appendChild(li);
            });

            rDiv.appendChild(ml);
            sList.appendChild(rDiv);
        });

        gDiv.appendChild(sList);
        return gDiv;
    };

    grid.appendChild(renderGroup(tournamentStore.groups.A));
    grid.appendChild(renderGroup(tournamentStore.groups.B));

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
}

function renderBracketPhase(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tournament-bracket-stage';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '20px';
    wrapper.style.overflowX = 'auto';
    wrapper.style.padding = '20px';

    const header = document.createElement('h2');
    header.textContent = '双败淘汰赛赛程';
    wrapper.appendChild(header);

    const matchCardRenderer = (match) => {
        const card = document.createElement('div');
        card.style.background = '#222';
        card.style.border = '1px solid #444';
        card.style.borderRadius = '5px';
        card.style.padding = '10px';
        card.style.minWidth = '150px';
        card.style.position = 'relative';

        const p1Div = document.createElement('div');
        p1Div.style.display = 'flex';
        p1Div.style.justifyContent = 'space-between';
        p1Div.style.borderBottom = '1px solid #333';
        p1Div.style.paddingBottom = '5px';
        p1Div.style.marginBottom = '5px';

        const p1Name = document.createElement('span');
        p1Name.textContent = match.p1 || 'TBD';
        if (match.state === 'completed' && match.winner === match.p1) p1Name.style.color = '#4CAF50';

        const p1Score = document.createElement('span');
        p1Score.textContent = match.state === 'completed' ? (match.winner === match.p1 ? 'W' : 'L') : '-';

        p1Div.appendChild(p1Name);
        p1Div.appendChild(p1Score);

        const p2Div = document.createElement('div');
        p2Div.style.display = 'flex';
        p2Div.style.justifyContent = 'space-between';

        const p2Name = document.createElement('span');
        p2Name.textContent = match.p2 || 'TBD';
        if (match.state === 'completed' && match.winner === match.p2) p2Name.style.color = '#4CAF50';

        const p2Score = document.createElement('span');
        p2Score.textContent = match.state === 'completed' ? (match.winner === match.p2 ? 'W' : 'L') : '-';

        p2Div.appendChild(p2Name);
        p2Div.appendChild(p2Score);

        card.appendChild(p1Div);
        card.appendChild(p2Div);

        if (match.state === 'pending' && match.p1 && match.p2 && match.p1 !== 'BYE' && match.p2 !== 'BYE') {
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '5px';
            controls.style.marginTop = '10px';

            const simBtn = document.createElement('button');
            simBtn.textContent = '结算';
            simBtn.style.flex = '1';
            simBtn.style.padding = '4px';
            simBtn.style.cursor = 'pointer';
            simBtn.onclick = () => simulateMatchFast(match.id);

            const watchBtn = document.createElement('button');
            watchBtn.textContent = '观看';
            watchBtn.style.flex = '1';
            watchBtn.style.padding = '4px';
            watchBtn.style.cursor = 'pointer';
            watchBtn.onclick = () => watchMatch(match.id);

            controls.appendChild(simBtn);
            controls.appendChild(watchBtn);
            card.appendChild(controls);
        }

        const label = document.createElement('div');
        label.textContent = match.id;
        label.style.position = 'absolute';
        label.style.top = '-10px';
        label.style.left = '5px';
        label.style.background = '#000';
        label.style.fontSize = '0.75em';
        label.style.padding = '0 5px';
        label.style.borderRadius = '3px';
        label.style.border = '1px solid #444';
        card.appendChild(label);

        return card;
    };

    const renderBracketTree = (matches, titleStr) => {
        const section = document.createElement('div');
        section.style.marginBottom = '30px';

        const title = document.createElement('h3');
        title.textContent = titleStr;
        section.appendChild(title);

        const flexContainer = document.createElement('div');
        flexContainer.style.display = 'flex';
        flexContainer.style.gap = '40px'; // Space between columns

        const rounds = {};
        matches.forEach(m => {
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        });

        // Ensure chronological order. E.g. W-R1, W-R2 etc.
        const roundNames = Object.keys(rounds).sort();

        roundNames.forEach(r => {
            const col = document.createElement('div');
            col.style.display = 'flex';
            col.style.flexDirection = 'column';
            col.style.justifyContent = 'space-around';
            col.style.gap = '20px';
            col.style.minWidth = '180px';

            const rTitle = document.createElement('h4');
            rTitle.textContent = r;
            rTitle.style.textAlign = 'center';
            rTitle.style.marginBottom = '10px';
            rTitle.style.borderBottom = '1px solid #555';
            rTitle.style.paddingBottom = '5px';
            col.appendChild(rTitle);

            const matchesContainer = document.createElement('div');
            matchesContainer.style.display = 'flex';
            matchesContainer.style.flexDirection = 'column';
            matchesContainer.style.justifyContent = 'space-around';
            matchesContainer.style.flex = '1';
            matchesContainer.style.gap = '20px';

            rounds[r].forEach(m => {
                matchesContainer.appendChild(matchCardRenderer(m));
            });

            col.appendChild(matchesContainer);
            flexContainer.appendChild(col);
        });

        section.appendChild(flexContainer);
        return section;
    };

    wrapper.appendChild(renderBracketTree(tournamentStore.bracket.winners, '胜者组 (Winner Bracket)'));
    wrapper.appendChild(renderBracketTree(tournamentStore.bracket.losers, '败者组 (Loser Bracket)'));

    // Grand Final Area
    const gfSection = document.createElement('div');
    const gfTitle = document.createElement('h3');
    gfTitle.textContent = '总决赛 (Grand Final)';
    gfSection.appendChild(gfTitle);

    const gfFlex = document.createElement('div');
    gfFlex.style.display = 'flex';
    gfFlex.style.gap = '40px';
    gfFlex.appendChild(matchCardRenderer(tournamentStore.bracket.grandFinal));

    // Only show Reset Match if it's active or completed or if it has players
    if (tournamentStore.bracket.resetMatch.p1) {
        gfFlex.appendChild(matchCardRenderer(tournamentStore.bracket.resetMatch));
    }

    gfSection.appendChild(gfFlex);

    wrapper.appendChild(gfSection);

    container.appendChild(wrapper);
}

function renderTournamentFinished(container) {
    const wrapper = document.createElement('div');
    wrapper.style.textAlign = 'center';
    wrapper.style.padding = '30px 20px';
    wrapper.style.marginBottom = '20px';
    wrapper.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 140, 0, 0.1))';
    wrapper.style.border = '2px solid #FFD700';
    wrapper.style.borderRadius = '12px';
    wrapper.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.2)';

    let winner = '未知';
    const resetMatch = tournamentStore.bracket.resetMatch;
    const grandFinal = tournamentStore.bracket.grandFinal;

    if (resetMatch && resetMatch.state === 'completed') {
        winner = resetMatch.winner;
    } else if (grandFinal && grandFinal.state === 'completed') {
        winner = grandFinal.winner;
    }

    const title = document.createElement('h1');
    title.textContent = `🏆 赛事已圆满结束 🏆`;
    title.style.color = '#FFD700';
    title.style.fontSize = '2.5em';
    title.style.margin = '0 0 10px 0';
    title.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
    wrapper.appendChild(title);

    const subtitle = document.createElement('h2');
    subtitle.textContent = `恭喜 ${winner} 获得总冠军！`;
    subtitle.style.color = '#fff';
    subtitle.style.fontSize = '1.8em';
    subtitle.style.margin = '0 0 20px 0';
    wrapper.appendChild(subtitle);

    const restartBtn = document.createElement('button');
    restartBtn.textContent = '返回报名大厅重开赛事';
    restartBtn.style.padding = '12px 24px';
    restartBtn.style.fontSize = '1.2em';
    restartBtn.style.backgroundColor = '#FFD700';
    restartBtn.style.color = '#000';
    restartBtn.style.border = 'none';
    restartBtn.style.borderRadius = '6px';
    restartBtn.style.cursor = 'pointer';
    restartBtn.style.fontWeight = 'bold';
    restartBtn.style.transition = 'all 0.2s';

    restartBtn.onmouseover = () => {
        restartBtn.style.transform = 'scale(1.05)';
        restartBtn.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.6)';
    };
    restartBtn.onmouseout = () => {
        restartBtn.style.transform = 'scale(1)';
        restartBtn.style.boxShadow = 'none';
    };

    restartBtn.onclick = () => {
        tournamentStore.reset();
    };
    wrapper.appendChild(restartBtn);

    container.appendChild(wrapper);

    // Call renderBracketPhase to show the historical bracket and results
    renderBracketPhase(container);
}
