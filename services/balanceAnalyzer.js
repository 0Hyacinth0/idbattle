import { BattleService } from './battleService.js';

function createBasePlayer(name, overrides = {}) {
    const base = {
        name,
        health: 220,
        maxHealth: 220,
        attack: 35,
        defense: 18,
        speed: 12,
        critChance: 0,
        parryChance: 0,
        shield: 0,
        poison: 0,
        burn: 0,
        freeze: false,
        taunted: false,
        reflection: 0,
        skill: { name: '稳固心法', chance: 0 }
    };

    const player = { ...base, ...overrides };
    if (typeof overrides.health === 'number' && typeof overrides.maxHealth !== 'number') {
        player.maxHealth = overrides.health;
    }

    if (typeof player.maxHealth !== 'number') {
        player.maxHealth = player.health;
    }

    return player;
}

function clonePlayer(player) {
    return JSON.parse(JSON.stringify(player));
}

async function simulateDeterministicBattle(planConfig, baselineConfig, options = {}) {
    const {
        planFirst = true,
        randomSequence,
        balanceAdjustments,
        battleOverrides = {}
    } = options;

    const battle = new BattleService({
        ...battleOverrides,
        balanceAdjustments
    });
    battle.delay = async () => {};

    const planPlayer = clonePlayer(createBasePlayer(planConfig.name, planConfig.overrides));
    const baselinePlayer = clonePlayer(createBasePlayer(baselineConfig.name, baselineConfig.overrides));

    const firstAttacker = planFirst ? planPlayer : baselinePlayer;
    const secondAttacker = planFirst ? baselinePlayer : planPlayer;
    battle.setPlayers(firstAttacker, secondAttacker, () => {});

    const sequence = Array.isArray(randomSequence) && randomSequence.length > 0
        ? randomSequence.slice()
        : [0.6];
    let index = 0;
    const originalRandom = Math.random;
    Math.random = () => {
        const value = sequence[index % sequence.length];
        index += 1;
        return value;
    };

    try {
        await battle.battle(() => {});
    } finally {
        Math.random = originalRandom;
    }

    const planState = planFirst ? battle.player1 : battle.player2;
    const baselineState = planFirst ? battle.player2 : battle.player1;

    return {
        planInitial: planFirst ? planPlayer.maxHealth : baselinePlayer.maxHealth,
        baselineInitial: planFirst ? baselinePlayer.maxHealth : planPlayer.maxHealth,
        planRemaining: planState.health,
        baselineRemaining: baselineState.health
    };
}

function calculatePlanScore(result) {
    const damageDealt = result.baselineInitial - result.baselineRemaining;
    const damageTaken = result.planInitial - result.planRemaining;
    return damageDealt - damageTaken;
}

async function evaluatePlans(plans, baselinePlan, randomSequences, options = {}) {
    const {
        includeMirroredRuns = true,
        balanceAdjustments,
        battleOverrides
    } = options;
    const evaluation = new Map();

    for (const plan of plans) {
        let cumulativeScore = 0;
        let runs = 0;
        for (const sequence of randomSequences) {
            const firstRun = await simulateDeterministicBattle(plan, baselinePlan, {
                planFirst: true,
                randomSequence: sequence,
                balanceAdjustments,
                battleOverrides
            });
            cumulativeScore += calculatePlanScore(firstRun);
            runs += 1;

            if (includeMirroredRuns) {
                const secondRun = await simulateDeterministicBattle(plan, baselinePlan, {
                    planFirst: false,
                    randomSequence: sequence,
                    balanceAdjustments,
                    battleOverrides
                });
                cumulativeScore += calculatePlanScore(secondRun);
                runs += 1;
            }
        }
        evaluation.set(plan.name, {
            averageScore: cumulativeScore / runs,
            runs
        });
    }

    return evaluation;
}

function deriveBalanceAdjustments(evaluation, options = {}) {
    const {
        imbalanceThreshold = 30,
        offensePlan = '暴击流',
        defensePlan = '铁壁流'
    } = options;

    const offenseScore = evaluation.get(offensePlan)?.averageScore ?? 0;
    const defenseScore = evaluation.get(defensePlan)?.averageScore ?? 0;

    const offenseExcess = Math.max(0, offenseScore - imbalanceThreshold);
    const defenseExcess = Math.max(0, defenseScore - imbalanceThreshold);

    const offenseMitigation = Math.min(0.5, 0.2 + offenseExcess / 220);
    const defenseMitigation = Math.min(0.42, 0.22 + defenseExcess / 280);
    const scalarOffset = Math.max(0, defenseExcess - offenseExcess / 2);
    const minimumDamageScalar = Math.min(0.24, 0.15 + scalarOffset / 5200);
    const critDamageMitigation = Math.min(0.24, 0.1 + offenseExcess / 300);

    const attackOverageThreshold = Math.max(10, 18 - offenseExcess / 4);
    const attackOveragePenalty = Math.min(0.5, 0.2 + offenseExcess / 120);
    const attackOverageDivisor = Math.max(30, 70 - offenseExcess / 3);
    const defenseOverageThreshold = Math.max(18, 22 - Math.max(0, defenseExcess - offenseExcess) / 8);
    const defenseOveragePenalty = Math.min(0.25, 0.12 + defenseExcess / 260);

    const adjustments = {
        attackAdvantageMitigation: parseFloat(offenseMitigation.toFixed(4)),
        attackMitigationCeiling: 0.52,
        defenseAdvantageMitigation: parseFloat(defenseMitigation.toFixed(4)),
        defenseMitigationCeiling: 0.38,
        minimumDamageScalar: parseFloat(minimumDamageScalar.toFixed(4)),
        critBaseBonus: 0.5,
        critDamageMitigation: parseFloat(critDamageMitigation.toFixed(4)),
        critMitigationCeiling: 0.32,
        attackOverageThreshold: parseFloat(attackOverageThreshold.toFixed(2)),
        attackOveragePenalty: parseFloat(attackOveragePenalty.toFixed(4)),
        attackOverageDivisor: parseFloat(attackOverageDivisor.toFixed(2)),
        defenseOverageThreshold: parseFloat(defenseOverageThreshold.toFixed(2)),
        defenseOveragePenalty: parseFloat(defenseOveragePenalty.toFixed(4))
    };

    const flaggedPlans = [];
    for (const [planName, { averageScore }] of evaluation.entries()) {
        if (Math.abs(averageScore) > imbalanceThreshold) {
            flaggedPlans.push({ planName, averageScore });
        }
    }

    return {
        adjustments,
        flaggedPlans
    };
}

function generateRandomSequences(seed, length, count) {
    const sequences = [];
    let state = seed % 2147483647;
    if (state <= 0) state += 2147483646;

    function nextRandom() {
        state = (state * 48271) % 2147483647;
        return state / 2147483647;
    }

    for (let i = 0; i < count; i += 1) {
        const sequence = [];
        for (let j = 0; j < length; j += 1) {
            sequence.push(parseFloat(nextRandom().toFixed(4)));
        }
        sequences.push(sequence);
    }

    return sequences;
}

export {
    createBasePlayer,
    clonePlayer,
    simulateDeterministicBattle,
    calculatePlanScore,
    evaluatePlans,
    deriveBalanceAdjustments,
    generateRandomSequences
};
