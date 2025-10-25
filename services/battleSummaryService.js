import { decompressStructuredLog } from '../utils/logCompression.js';

const ROLE_LABEL = {
    player1: '玩家1',
    player2: '玩家2'
};

function deepClone(value) {
    if (typeof globalThis.structuredClone === 'function') {
        try {
            return globalThis.structuredClone(value);
        } catch (error) {
            // ignore and fallback
        }
    }
    return JSON.parse(JSON.stringify(value ?? null));
}

function createSummary(player, role) {
    const clone = deepClone(player || {});
    const name = clone?.name || ROLE_LABEL[role] || role;
    return {
        name,
        role,
        skillName: clone?.skill?.name || '',
        skillChance: typeof clone?.skill?.chance === 'number' ? clone.skill.chance : null,
        critChance: typeof clone?.critChance === 'number' ? clone.critChance : null,
        damageDealt: 0,
        damageTaken: 0,
        damageDealtDetails: [],
        damageTakenDetails: [],
        skillCounts: new Map(),
        attackCount: 0,
        criticalCount: 0,
        skillTriggerCount: 0,
        statusDamageDealt: 0,
        statusDamageTaken: 0,
        reflectionDamageDealt: 0,
        reflectionDamageTaken: 0
    };
}

function formatPercent(value) {
    if (!Number.isFinite(value)) {
        return '0%';
    }
    const percentage = Math.round(value * 1000) / 10;
    return `${percentage.toFixed(1).replace(/\.0$/, '')}%`;
}

function resolveRole(entity, nameMap) {
    if (!entity) {
        return null;
    }
    if (entity.role && nameMap.has(entity.role)) {
        return entity.role;
    }
    if (entity.name && nameMap.has(entity.name)) {
        return nameMap.get(entity.name);
    }
    return null;
}

function ensureSkillCount(summary, skillName) {
    if (!skillName) {
        return;
    }
    if (!summary.skillCounts.has(skillName)) {
        summary.skillCounts.set(skillName, 0);
    }
}

function pushDetail(list, detail) {
    list.push(detail);
}

function analyseVerdict(playerSummaries) {
    const evaluations = playerSummaries.map((summary) => {
        const attackCount = summary.attackCount || 0;
        const actualSkillRate = attackCount ? summary.skillTriggerCount / attackCount : 0;
        const expectedSkillRate = typeof summary.skillChance === 'number' ? summary.skillChance : null;
        const skillDiff = expectedSkillRate !== null ? actualSkillRate - expectedSkillRate : 0;
        const actualCritRate = attackCount ? summary.criticalCount / attackCount : 0;
        const expectedCritRate = typeof summary.critChance === 'number' ? summary.critChance : null;
        const critDiff = expectedCritRate !== null ? actualCritRate - expectedCritRate : 0;
        return {
            summary,
            attackCount,
            actualSkillRate,
            expectedSkillRate,
            skillDiff,
            actualCritRate,
            expectedCritRate,
            critDiff
        };
    });

    const maxDeviation = evaluations.reduce((max, current) => {
        const skillDeviation = Math.abs(current.skillDiff || 0);
        const critDeviation = Math.abs(current.critDiff || 0);
        return Math.max(max, skillDeviation, critDeviation);
    }, 0);

    const verdict = maxDeviation >= 0.18 ? '运气局' : '实力局';

    const reasons = evaluations.flatMap(({ summary, attackCount, actualSkillRate, expectedSkillRate, actualCritRate, expectedCritRate }) => {
        const result = [];
        const name = summary.name || ROLE_LABEL[summary.role] || summary.role;
        if (expectedSkillRate !== null) {
            result.push(`${name} 技能触发率 ${formatPercent(actualSkillRate)} (期望 ${formatPercent(expectedSkillRate)})`);
        } else {
            result.push(`${name} 技能触发 ${summary.skillTriggerCount} 次 / ${attackCount} 次攻击`);
        }
        if (expectedCritRate !== null) {
            result.push(`${name} 会心率 ${formatPercent(actualCritRate)} (期望 ${formatPercent(expectedCritRate)})`);
        } else {
            result.push(`${name} 会心 ${summary.criticalCount} 次 / ${attackCount} 次攻击`);
        }
        return result;
    });

    const highlight = evaluations
        .filter(({ skillDiff, critDiff }) => Math.abs(skillDiff || 0) >= 0.18 || Math.abs(critDiff || 0) >= 0.18)
        .map(({ summary, skillDiff, critDiff, actualSkillRate, expectedSkillRate, actualCritRate, expectedCritRate }) => {
            const fragments = [];
            const name = summary.name || ROLE_LABEL[summary.role] || summary.role;
            if (expectedSkillRate !== null && Math.abs(skillDiff || 0) >= 0.18) {
                fragments.push(`${name} 的技能触发偏离 ${formatPercent(actualSkillRate)} / ${formatPercent(expectedSkillRate)}`);
            }
            if (expectedCritRate !== null && Math.abs(critDiff || 0) >= 0.18) {
                fragments.push(`${name} 的会心率偏离 ${formatPercent(actualCritRate)} / ${formatPercent(expectedCritRate)}`);
            }
            return fragments.join('，');
        })
        .filter(Boolean)
        .join('；');

    const summaryText = verdict === '运气局'
        ? (highlight || '多次关键触发大幅偏离预期，战局受到运气影响明显。')
        : '技能与会心触发率与期望值差距不大，整体表现偏向实力。';

    return {
        verdict,
        reasons,
        highlight,
        summary: summaryText
    };
}

export function buildBattleSummary({
    structuredLog = null,
    compressedLog = null,
    textLog = '',
    player1 = null,
    player2 = null,
    winner = null,
    isDraw = false
} = {}) {
    const resolvedLog = structuredLog || (compressedLog ? decompressStructuredLog(compressedLog) : null);
    if (!resolvedLog) {
        throw new Error('缺少结构化日志，无法生成战斗总结');
    }

    const playersByRole = {
        player1: createSummary(player1, 'player1'),
        player2: createSummary(player2, 'player2')
    };

    const nameMap = new Map([
        [player1?.name, 'player1'],
        [player2?.name, 'player2'],
        ['player1', 'player1'],
        ['player2', 'player2']
    ].filter(([name]) => typeof name === 'string' && name));

    const resolve = (entity) => resolveRole(entity, nameMap);

    (resolvedLog.events || []).forEach((event) => {
        const type = event?.type;
        if (!type) {
            return;
        }
        const actorRole = resolve(event.actor);
        const targetRole = resolve(event.target);
        const parameters = event.parameters || {};

        if (type === 'attack') {
            if (actorRole && playersByRole[actorRole]) {
                const summary = playersByRole[actorRole];
                summary.attackCount += 1;
                const damage = Math.max(0, Number(parameters.damage) || 0);
                summary.damageDealt += damage;
                if (parameters.isCritical) {
                    summary.criticalCount += 1;
                }
                pushDetail(summary.damageDealtDetails, {
                    round: parameters.round ?? null,
                    target: event.target?.name || (targetRole ? playersByRole[targetRole]?.name : ''),
                    value: damage,
                    type: parameters.skillTriggered ? '技能攻击' : '普通攻击',
                    isCritical: Boolean(parameters.isCritical),
                    viaSkill: Boolean(parameters.skillTriggered),
                    reflectionDamage: Math.max(0, Number(parameters.reflectionDamage) || 0),
                    shieldAbsorbed: Math.max(0, Number(parameters.shieldAbsorbed) || 0)
                });
            }
            if (targetRole && playersByRole[targetRole]) {
                const summary = playersByRole[targetRole];
                const damage = Math.max(0, Number(parameters.damage) || 0);
                summary.damageTaken += damage;
                pushDetail(summary.damageTakenDetails, {
                    round: parameters.round ?? null,
                    source: event.actor?.name || (actorRole ? playersByRole[actorRole]?.name : ''),
                    value: damage,
                    type: parameters.skillTriggered ? '技能攻击' : '普通攻击',
                    isCritical: Boolean(parameters.isCritical),
                    viaSkill: Boolean(parameters.skillTriggered)
                });
            }
        } else if (type === 'status_tick') {
            const damage = Math.max(0, Number(parameters.damage) || 0);
            if (actorRole && playersByRole[actorRole]) {
                const summary = playersByRole[actorRole];
                summary.damageDealt += damage;
                summary.statusDamageDealt += damage;
                pushDetail(summary.damageDealtDetails, {
                    round: parameters.round ?? null,
                    target: event.target?.name || (targetRole ? playersByRole[targetRole]?.name : ''),
                    value: damage,
                    type: `${parameters.type || '状态'}伤害`,
                    isCritical: false,
                    viaSkill: true
                });
            }
            if (targetRole && playersByRole[targetRole]) {
                const summary = playersByRole[targetRole];
                summary.damageTaken += damage;
                summary.statusDamageTaken += damage;
                pushDetail(summary.damageTakenDetails, {
                    round: parameters.round ?? null,
                    source: event.actor?.name || (actorRole ? playersByRole[actorRole]?.name : ''),
                    value: damage,
                    type: `${parameters.type || '状态'}伤害`,
                    isCritical: false,
                    viaSkill: true
                });
            }
        } else if (type === 'damage_reflected') {
            const damage = Math.max(0, Number(parameters.damage) || 0);
            if (actorRole && playersByRole[actorRole]) {
                const summary = playersByRole[actorRole];
                summary.damageDealt += damage;
                summary.reflectionDamageDealt += damage;
                pushDetail(summary.damageDealtDetails, {
                    round: parameters.round ?? null,
                    target: event.target?.name || (targetRole ? playersByRole[targetRole]?.name : ''),
                    value: damage,
                    type: '反弹伤害',
                    viaSkill: true,
                    isCritical: false
                });
            }
            if (targetRole && playersByRole[targetRole]) {
                const summary = playersByRole[targetRole];
                summary.damageTaken += damage;
                summary.reflectionDamageTaken += damage;
                pushDetail(summary.damageTakenDetails, {
                    round: parameters.round ?? null,
                    source: event.actor?.name || (actorRole ? playersByRole[actorRole]?.name : ''),
                    value: damage,
                    type: '反弹伤害',
                    viaSkill: true,
                    isCritical: false
                });
            }
        } else if (type === 'skill_triggered') {
            if (actorRole && playersByRole[actorRole]) {
                const summary = playersByRole[actorRole];
                const skillName = parameters.skill || summary.skillName || '技能';
                ensureSkillCount(summary, skillName);
                summary.skillCounts.set(skillName, (summary.skillCounts.get(skillName) || 0) + 1);
                summary.skillTriggerCount += 1;
            }
        }
    });

    Object.values(playersByRole).forEach((summary) => {
        if (summary.skillName) {
            ensureSkillCount(summary, summary.skillName);
        }
    });

    const battleEnd = (resolvedLog.keyframes || []).find((item) => item.type === 'battle_end');
    const totalRounds = battleEnd?.detail?.rounds ?? null;

    const analysis = analyseVerdict(Object.values(playersByRole));

    return {
        textLog,
        players: {
            player1: {
                ...playersByRole.player1,
                skillCounts: Array.from(playersByRole.player1.skillCounts.entries()).map(([skill, count]) => ({ skill, count }))
            },
            player2: {
                ...playersByRole.player2,
                skillCounts: Array.from(playersByRole.player2.skillCounts.entries()).map(([skill, count]) => ({ skill, count }))
            }
        },
        rounds: totalRounds,
        winner: winner ? (winner.name || winner.role || '') : null,
        isDraw: Boolean(isDraw || (!winner && !isDraw && playersByRole.player1.damageTaken === playersByRole.player2.damageTaken)),
        analysis
    };
}
