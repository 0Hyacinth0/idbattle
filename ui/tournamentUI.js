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
    const wrapper = document.createElement('div');
    wrapper.className = 'tournament-registration';

    const title = document.createElement('h2');
    title.textContent = '淘汰赛报名 (8 - 25人)';
    wrapper.appendChild(title);

    const inputArea = document.createElement('div');
    inputArea.className = 'tournament-registration__input-area';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '输入或选择玩家名...';
    input.setAttribute('list', 'tournament-players-list');

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
    addBtn.className = 'tournament-registration__add-btn';
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

    const pCountStr = document.createElement('p');
    pCountStr.className = 'tournament-registration__count';
    pCountStr.textContent = `已报名选手：${tournamentStore.participants.length} 人`;
    wrapper.appendChild(pCountStr);

    const pList = document.createElement('ul');
    pList.className = 'tournament-registration__list';

    tournamentStore.participants.forEach(p => {
        const li = document.createElement('li');
        li.className = 'tournament-registration__item';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = p;

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.className = 'tournament-registration__remove-btn';
        removeBtn.onclick = () => {
            tournamentStore.removeParticipant(p);
        };

        li.appendChild(nameSpan);
        li.appendChild(removeBtn);
        pList.appendChild(li);
    });
    wrapper.appendChild(pList);

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.textContent = '生成赛事 & 开始小组赛';
    startBtn.className = 'tournament-registration__start-btn';

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

    const header = document.createElement('div');
    header.className = 'tournament-group-stage__header';

    const title = document.createElement('h2');
    title.textContent = '小组赛';

    const nextPhaseBtn = document.createElement('button');
    nextPhaseBtn.textContent = '结束小组赛进入淘汰赛';
    nextPhaseBtn.className = 'tournament-group-stage__next-btn';
    nextPhaseBtn.onclick = () => {
        transitionToBracket();
    };

    header.appendChild(title);
    header.appendChild(nextPhaseBtn);
    wrapper.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'tournament-group-stage__grid';

    const renderGroup = (group) => {
        const gDiv = document.createElement('div');
        gDiv.className = 'tournament-group';

        const gTitle = document.createElement('h3');
        gTitle.textContent = `${group.name} 组积分榜`;
        gDiv.appendChild(gTitle);

        const tableContainer = document.createElement('div');
        tableContainer.className = 'tournament-table-container';

        const table = document.createElement('table');
        table.className = 'tournament-table';

        table.innerHTML = `
            <thead>
                <tr>
                    <th>排名</th>
                    <th>ID</th>
                    <th>分数</th>
                    <th>胜场</th>
                    <th>场次</th>
                </tr>
            </thead>
            <tbody>
                ${group.standings.map((s, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td class="tournament-table__id">${s.id}</td>
                        <td>${s.points}</td>
                        <td>${s.wins}</td>
                        <td>${s.matchesPlayed}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        tableContainer.appendChild(table);
        gDiv.appendChild(tableContainer);

        const sTitle = document.createElement('h3');
        sTitle.textContent = `${group.name} 组赛程`;
        gDiv.appendChild(sTitle);

        const sList = document.createElement('div');
        sList.className = 'tournament-schedule';

        const rounds = {};
        group.schedule.forEach(m => {
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        });

        Object.keys(rounds).sort((a, b) => a - b).forEach(r => {
            const rDiv = document.createElement('div');
            rDiv.className = 'tournament-schedule__round';

            const rTitle = document.createElement('h4');
            rTitle.textContent = `第 ${r} 轮`;
            rDiv.appendChild(rTitle);

            const ml = document.createElement('ul');
            ml.className = 'tournament-schedule__list';

            rounds[r].forEach(m => {
                const li = document.createElement('li');
                li.className = 'tournament-match-item';

                const matchInfo = document.createElement('span');
                matchInfo.className = 'tournament-match-item__info';

                const isP1Win = m.state === 'completed' && m.winner === m.p1;
                const isP2Win = m.state === 'completed' && m.winner === m.p2;

                let p1Text = m.p1;
                let p2Text = m.p2;

                if (isP1Win) p1Text = `<strong class="winner">${m.p1}</strong>`;
                if (isP2Win) p2Text = `<strong class="winner">${m.p2}</strong>`;

                matchInfo.innerHTML = `${p1Text} <span class="vs">vs</span> ${p2Text}`;

                const controls = document.createElement('div');
                controls.className = 'tournament-match-item__controls';

                if (m.state === 'pending') {
                    const simBtn = document.createElement('button');
                    simBtn.textContent = '快速结算';
                    simBtn.className = 'tournament-match-item__btn';
                    simBtn.onclick = () => simulateMatchFast(m.id);

                    const watchBtn = document.createElement('button');
                    watchBtn.textContent = '观看比赛';
                    watchBtn.className = 'tournament-match-item__btn';
                    watchBtn.onclick = () => watchMatch(m.id);

                    controls.appendChild(simBtn);
                    controls.appendChild(watchBtn);
                } else {
                    const status = document.createElement('span');
                    status.textContent = '已结束';
                    status.className = 'tournament-match-item__status';
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

    const header = document.createElement('h2');
    header.textContent = '双败淘汰赛赛程';
    wrapper.appendChild(header);

    const matchCardRenderer = (match) => {
        const card = document.createElement('div');
        card.className = 'tournament-match-card';

        const p1Div = document.createElement('div');
        p1Div.className = 'tournament-match-card__player';

        const p1Name = document.createElement('span');
        p1Name.className = 'tournament-match-card__name';
        p1Name.textContent = match.p1 || 'TBD';
        if (match.state === 'completed' && match.winner === match.p1) p1Name.classList.add('winner');

        const p1Score = document.createElement('span');
        p1Score.className = 'tournament-match-card__score';
        p1Score.textContent = match.state === 'completed' ? (match.winner === match.p1 ? 'W' : 'L') : '-';

        p1Div.appendChild(p1Name);
        p1Div.appendChild(p1Score);

        const p2Div = document.createElement('div');
        p2Div.className = 'tournament-match-card__player';

        const p2Name = document.createElement('span');
        p2Name.className = 'tournament-match-card__name';
        p2Name.textContent = match.p2 || 'TBD';
        if (match.state === 'completed' && match.winner === match.p2) p2Name.classList.add('winner');

        const p2Score = document.createElement('span');
        p2Score.className = 'tournament-match-card__score';
        p2Score.textContent = match.state === 'completed' ? (match.winner === match.p2 ? 'W' : 'L') : '-';

        p2Div.appendChild(p2Name);
        p2Div.appendChild(p2Score);

        card.appendChild(p1Div);
        card.appendChild(p2Div);

        if (match.state === 'pending' && match.p1 && match.p2 && match.p1 !== 'BYE' && match.p2 !== 'BYE') {
            const controls = document.createElement('div');
            controls.className = 'tournament-match-card__controls';

            const simBtn = document.createElement('button');
            simBtn.textContent = '结算';
            simBtn.className = 'tournament-match-card__btn';
            simBtn.onclick = () => simulateMatchFast(match.id);

            const watchBtn = document.createElement('button');
            watchBtn.textContent = '观看';
            watchBtn.className = 'tournament-match-card__btn';
            watchBtn.onclick = () => watchMatch(match.id);

            controls.appendChild(simBtn);
            controls.appendChild(watchBtn);
            card.appendChild(controls);
        }

        const label = document.createElement('div');
        label.className = 'tournament-match-card__label';
        label.textContent = match.id;
        card.appendChild(label);

        return card;
    };

    const renderBracketTree = (matches, titleStr) => {
        const section = document.createElement('div');
        section.className = 'tournament-bracket-tree';

        const title = document.createElement('h3');
        title.textContent = titleStr;
        section.appendChild(title);

        const flexContainer = document.createElement('div');
        flexContainer.className = 'tournament-bracket-tree__container';

        const rounds = {};
        matches.forEach(m => {
            if (!rounds[m.round]) rounds[m.round] = [];
            rounds[m.round].push(m);
        });

        const roundNames = Object.keys(rounds).sort();

        roundNames.forEach(r => {
            const col = document.createElement('div');
            col.className = 'tournament-bracket-tree__column';

            const rTitle = document.createElement('h4');
            rTitle.textContent = r;
            col.appendChild(rTitle);

            const matchesContainer = document.createElement('div');
            matchesContainer.className = 'tournament-bracket-tree__matches';

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

    const gfSection = document.createElement('div');
    gfSection.className = 'tournament-bracket-tree';
    const gfTitle = document.createElement('h3');
    gfTitle.textContent = '总决赛 (Grand Final)';
    gfSection.appendChild(gfTitle);

    const gfFlex = document.createElement('div');
    gfFlex.className = 'tournament-bracket-tree__container';
    gfFlex.appendChild(matchCardRenderer(tournamentStore.bracket.grandFinal));

    if (tournamentStore.bracket.resetMatch.p1) {
        gfFlex.appendChild(matchCardRenderer(tournamentStore.bracket.resetMatch));
    }

    gfSection.appendChild(gfFlex);
    wrapper.appendChild(gfSection);

    container.appendChild(wrapper);
}

function renderTournamentFinished(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tournament-finished';

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
    title.className = 'tournament-finished__title';
    wrapper.appendChild(title);

    const subtitle = document.createElement('h2');
    subtitle.textContent = `恭喜 ${winner} 获得总冠军！`;
    subtitle.className = 'tournament-finished__subtitle';
    wrapper.appendChild(subtitle);

    const restartBtn = document.createElement('button');
    restartBtn.textContent = '返回报名大厅重开赛事';
    restartBtn.className = 'tournament-finished__restart-btn';

    restartBtn.onclick = () => {
        tournamentStore.reset();
    };
    wrapper.appendChild(restartBtn);

    container.appendChild(wrapper);

    // Call renderBracketPhase to show the historical bracket and results
    renderBracketPhase(container);
}
