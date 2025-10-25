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
        isDraw: Boolean(isDraw || (!winner && !isDraw && playersByRole.player1.damageTaken === playersByRole.player2.damageTaken))
    };
}
