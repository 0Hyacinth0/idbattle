import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleService } from '../services/battleService.js';
import { applyEquipmentAttributes } from '../services/equipmentService.js';

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

async function simulateDeterministicBattle(planConfig, baselineConfig, { planFirst = true, randomSequence } = {}) {
    const battle = new BattleService();
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

test('automated growth plan simulations flag significant imbalances', async () => {
    const baselinePlan = { name: '基准养成', overrides: {} };
    const growthPlans = [
        { name: '均衡养成', overrides: {} },
        { name: '暴击流', overrides: { attack: 52, defense: 12 } },
        { name: '铁壁流', overrides: { attack: 28, defense: 30, health: 280 } }
    ];

    const randomSequences = [
        [0.62, 0.81, 0.44, 0.73, 0.55, 0.67, 0.49],
        [0.18, 0.92, 0.36, 0.79, 0.58, 0.27, 0.63]
    ];

    const evaluation = new Map();

    for (const plan of growthPlans) {
        let cumulativeScore = 0;
        for (const sequence of randomSequences) {
            const firstRun = await simulateDeterministicBattle(plan, baselinePlan, { planFirst: true, randomSequence: sequence });
            const secondRun = await simulateDeterministicBattle(plan, baselinePlan, { planFirst: false, randomSequence: sequence });
            cumulativeScore += (calculatePlanScore(firstRun) + calculatePlanScore(secondRun)) / 2;
        }
        const averageScore = cumulativeScore / randomSequences.length;
        evaluation.set(plan.name, averageScore);
    }

    const balancedScore = evaluation.get('均衡养成');
    const burstScore = evaluation.get('暴击流');
    const fortressScore = evaluation.get('铁壁流');

    assert.ok(Math.abs(balancedScore) < 5, `Expected balanced plan to stay neutral but got ${balancedScore}`);
    assert.ok(burstScore > 40, 'High offensive plan should expose imbalance with a strong positive score');
    assert.ok(fortressScore > 40, 'Defensive plan should also be highlighted when its survivability outpaces the baseline');
    assert.ok(burstScore > fortressScore, 'Burst plan should outperform defensive plan in damage differential');
});

test('equipment stacking and skill effects remain consistent through combat flow', async () => {
    const equipment = {
        武器: { name: '力道武器', set: '力道', attributes: { attack: 22 } },
        上衣: { name: '力道护甲', set: '力道', attributes: { attack: 8, defense: 6 } },
        帽子: { name: '护心头盔', set: '根骨', attributes: { defense: 12 } }
    };

    const basePlayer = createBasePlayer('攻坚者', {
        attack: 40,
        defense: 20,
        health: 250,
        maxHealth: 250,
        skill: { name: '爆发', attackBoost: 12, defensePenalty: 5, turns: 3, chance: 1 }
    });

    const playerWithEquipment = applyEquipmentAttributes(basePlayer, equipment);
    const defender = createBasePlayer('守护者', {
        attack: 32,
        defense: 24,
        health: 260,
        maxHealth: 260,
        skill: { name: '稳固心法', chance: 0 }
    });

    const originalAttack = playerWithEquipment.attack;
    const originalDefense = playerWithEquipment.defense;

    const battle = new BattleService();
    battle.delay = async () => {};
    battle.setPlayers(playerWithEquipment, defender, () => {});

    const originalRandom = Math.random;
    Math.random = () => 0.01;

    try {
        await battle.executeSingleAttack(playerWithEquipment, defender);
    } finally {
        Math.random = originalRandom;
    }

    assert.equal(playerWithEquipment.attack, originalAttack + 12, 'attack boost should apply on top of equipment bonuses');
    assert.equal(playerWithEquipment.defense, originalDefense - 5, 'defense penalty should stack after equipment bonuses');
    assert.equal(playerWithEquipment.attackBoostDuration, 3, 'skill duration should be set after activation');

    const defenseEffectiveness = defender.defense / (defender.defense + 50);
    const rawDamage = Math.max(originalAttack * (1 - defenseEffectiveness), originalAttack * 0.15);
    const expectedDamage = Math.max(Math.floor(rawDamage), 1);
    assert.equal(defender.health, 260 - expectedDamage, 'defender health should account for boosted damage output');

    battle.handleStatusEffects();
    assert.equal(playerWithEquipment.attackBoostDuration, 2, 'duration should tick down after status handling');

    battle.handleStatusEffects();
    battle.handleStatusEffects();
    assert.equal(playerWithEquipment.attack, originalAttack, 'attack should revert after boost duration expires');
    assert.equal(playerWithEquipment.defense, originalDefense, 'defense penalty should be removed when duration ends');
});
