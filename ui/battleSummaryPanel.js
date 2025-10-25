const DETAIL_LIMIT = 10;

function formatNumber(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '0';
    }
    return Math.round(value).toLocaleString('zh-CN');
}

function formatPercent(value) {
    if (!Number.isFinite(value)) {
        return '0%';
    }
    const percentage = Math.round(value * 1000) / 10;
    return `${percentage.toFixed(1).replace(/\.0$/, '')}%`;
}

function clearElement(element) {
    if (!element) {
        return;
    }
    element.innerHTML = '';
}

function createMetricItem(label, value) {
    const item = document.createElement('li');
    item.className = 'summary-metrics__item';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'summary-metrics__label';
    labelSpan.textContent = label;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'summary-metrics__value';
    valueSpan.textContent = value;
    item.append(labelSpan, valueSpan);
    return item;
}

function formatDamageDetail(detail, direction) {
    if (!detail) {
        return '';
    }
    const parts = [];
    if (typeof detail.round === 'number' && detail.round > 0) {
        parts.push(`回合 ${detail.round}`);
    }
    const valueText = formatNumber(detail.value || 0);
    if (direction === 'dealt') {
        const target = detail.target || '对手';
        parts.push(`对 ${target} ${valueText}`);
    } else {
        const source = detail.source || '未知';
        parts.push(`来自 ${source} ${valueText}`);
    }
    if (detail.type) {
        parts.push(detail.type);
    }
    const flags = [];
    if (detail.isCritical) {
        flags.push('会心');
    }
    if (detail.viaSkill) {
        flags.push('技能');
    }
    if (direction === 'dealt') {
        if (detail.reflectionDamage) {
            flags.push(`反弹 ${formatNumber(detail.reflectionDamage)}`);
        }
        if (detail.shieldAbsorbed) {
            flags.push(`护盾抵消 ${formatNumber(detail.shieldAbsorbed)}`);
        }
    }
    if (flags.length) {
        parts.push(`(${flags.join('，')})`);
    }
    return parts.join(' · ');
}

function renderSkillCard(summary) {
    const card = document.createElement('article');
    card.className = 'summary-card';

    const title = document.createElement('h4');
    title.textContent = summary.skillName ? `${summary.name}（${summary.skillName}）` : summary.name;
    card.appendChild(title);

    const metrics = document.createElement('ul');
    metrics.className = 'summary-metrics';
    metrics.appendChild(createMetricItem('技能触发', `${summary.skillTriggerCount} 次`));
    metrics.appendChild(createMetricItem('攻击次数', `${summary.attackCount} 次`));
    const actualRate = summary.attackCount ? summary.skillTriggerCount / summary.attackCount : 0;
    const expectedRate = typeof summary.skillChance === 'number' ? summary.skillChance : null;
    const rateText = expectedRate !== null
        ? `${formatPercent(actualRate)} / 期望 ${formatPercent(expectedRate)}`
        : `${formatPercent(actualRate)}`;
    metrics.appendChild(createMetricItem('技能触发率', rateText));

    const actualCritRate = summary.attackCount ? summary.criticalCount / summary.attackCount : 0;
    const expectedCrit = typeof summary.critChance === 'number' ? summary.critChance : null;
    const critText = expectedCrit !== null
        ? `${formatPercent(actualCritRate)} / 期望 ${formatPercent(expectedCrit)}`
        : `${formatPercent(actualCritRate)}`;
    metrics.appendChild(createMetricItem('会心率', critText));
    card.appendChild(metrics);

    if (Array.isArray(summary.skillCounts) && summary.skillCounts.length) {
        const list = document.createElement('ul');
        list.className = 'summary-list';
        summary.skillCounts.forEach(({ skill, count }) => {
            const item = document.createElement('li');
            item.textContent = `${skill}：${count} 次`;
            list.appendChild(item);
        });
        card.appendChild(list);
    }

    return card;
}

function renderDamageCard(summary, direction) {
    const card = document.createElement('article');
    card.className = 'summary-card';

    const title = document.createElement('h4');
    title.textContent = summary.name;
    card.appendChild(title);

    const metrics = document.createElement('ul');
    metrics.className = 'summary-metrics';

    if (direction === 'dealt') {
        metrics.appendChild(createMetricItem('总伤害', formatNumber(summary.damageDealt)));
        metrics.appendChild(createMetricItem('状态伤害', formatNumber(summary.statusDamageDealt)));
        metrics.appendChild(createMetricItem('反弹伤害', formatNumber(summary.reflectionDamageDealt)));
    } else {
        metrics.appendChild(createMetricItem('承伤总量', formatNumber(summary.damageTaken)));
        metrics.appendChild(createMetricItem('状态承伤', formatNumber(summary.statusDamageTaken)));
        metrics.appendChild(createMetricItem('反弹承伤', formatNumber(summary.reflectionDamageTaken)));
    }

    card.appendChild(metrics);

    const detailList = document.createElement('ul');
    detailList.className = 'summary-list summary-list--details';

    const sourceDetails = direction === 'dealt' ? summary.damageDealtDetails : summary.damageTakenDetails;
    if (Array.isArray(sourceDetails) && sourceDetails.length) {
        const topDetails = [...sourceDetails]
            .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
            .slice(0, DETAIL_LIMIT);
        topDetails.forEach((detail) => {
            const item = document.createElement('li');
            item.textContent = formatDamageDetail(detail, direction);
            detailList.appendChild(item);
        });
    } else {
        const empty = document.createElement('li');
        empty.className = 'summary-list__empty';
        empty.textContent = '暂无数据';
        detailList.appendChild(empty);
    }

    card.appendChild(detailList);
    return card;
}

export function initBattleSummaryPanel() {
    const root = document.querySelector('[data-role="battle-summary"]');
    if (!root) {
        return {
            open() {},
            close() {},
            render() {}
        };
    }

    const overlay = root.querySelector('.battle-summary__overlay');
    const panel = root.querySelector('.battle-summary__panel');
    const closeButtons = root.querySelectorAll('[data-action="summary-close"]');
    const winnerLabel = root.querySelector('[data-summary="winner"]');
    const roundsLabel = root.querySelector('[data-summary="rounds"]');
    const skillGrid = root.querySelector('[data-summary-section="skills"] .summary-grid');
    const damageDealtGrid = root.querySelector('[data-summary-section="damage-dealt"] .summary-grid');
    const damageTakenGrid = root.querySelector('[data-summary-section="damage-taken"] .summary-grid');

    let lastActiveElement = null;

    const close = () => {
        root.classList.remove('battle-summary--visible');
        root.hidden = true;
        if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
            lastActiveElement.focus();
        }
    };

    const render = (summary) => {
        if (!summary) {
            return;
        }
        if (winnerLabel) {
            if (summary.isDraw) {
                winnerLabel.textContent = '结果：平局';
            } else if (summary.winner) {
                winnerLabel.textContent = `胜者：${summary.winner}`;
            } else {
                winnerLabel.textContent = '';
            }
        }
        if (roundsLabel) {
            roundsLabel.textContent = summary.rounds ? `回合数：${summary.rounds}` : '';
        }

        if (skillGrid) {
            clearElement(skillGrid);
            skillGrid.appendChild(renderSkillCard(summary.players.player1));
            skillGrid.appendChild(renderSkillCard(summary.players.player2));
        }

        if (damageDealtGrid) {
            clearElement(damageDealtGrid);
            damageDealtGrid.appendChild(renderDamageCard(summary.players.player1, 'dealt'));
            damageDealtGrid.appendChild(renderDamageCard(summary.players.player2, 'dealt'));
        }

        if (damageTakenGrid) {
            clearElement(damageTakenGrid);
            damageTakenGrid.appendChild(renderDamageCard(summary.players.player1, 'taken'));
            damageTakenGrid.appendChild(renderDamageCard(summary.players.player2, 'taken'));
        }
    };

    const open = (summary) => {
        if (summary) {
            render(summary);
        }
        lastActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        root.hidden = false;
        root.classList.add('battle-summary--visible');
        if (panel) {
            panel.focus();
        }
    };

    const handleBackdropClick = (event) => {
        if (event.target === overlay) {
            close();
        }
    };

    overlay?.addEventListener('click', handleBackdropClick);
    closeButtons.forEach((button) => {
        button.addEventListener('click', () => close());
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !root.hidden) {
            close();
        }
    });

    return {
        open,
        close,
        render
    };
}
