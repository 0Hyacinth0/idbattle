import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BattleService } from '../services/battleService.js';
import { applyEquipmentAttributes } from '../services/equipmentService.js';
import {
    createBasePlayer,
    evaluatePlans,
    deriveBalanceAdjustments,
    generateRandomSequences
} from '../services/balanceAnalyzer.js';

function computeMitigatedDamage(attacker, defender, adjustments, { willCrit = false } = {}) {
    const combinedStats = Math.max(attacker.attack + defender.defense, 1);
    const defenseAdvantage = Math.max(0, defender.defense - attacker.attack);
    const defenseMitigationRatio = defenseAdvantage / combinedStats;
    const defenseMitigation = 1 - Math.min(
        adjustments.defenseMitigationCeiling,
        defenseMitigationRatio * adjustments.defenseAdvantageMitigation
    );

    let defenseEffectiveness = defender.defense / (defender.defense + 50);
    defenseEffectiveness *= Math.max(defenseMitigation, 0.5);

    const defenseOverageThreshold = adjustments.defenseOverageThreshold ?? 22;
    const defenseOveragePenalty = adjustments.defenseOveragePenalty ?? 0.12;
    const defenseOverage = Math.max(0, defender.defense - (attacker.attack + defenseOverageThreshold));
    if (defenseOverage > 0 && defenseOveragePenalty > 0) {
        const defensePressure = Math.min(0.45, (defenseOverage / (defenseOverageThreshold + 50)) * defenseOveragePenalty);
        defenseEffectiveness *= Math.max(1 - defensePressure, 0.4);
    }

    const minimumDamageScalar = Math.max(adjustments.minimumDamageScalar, 0.05);
    let damage = attacker.attack * (1 - defenseEffectiveness);
    damage = Math.max(damage, attacker.attack * minimumDamageScalar);
    damage = Math.floor(damage);
    damage = Math.max(damage, 1);

    const attackAdvantage = Math.max(0, attacker.attack - defender.defense);
    const attackAdvantageRatio = attackAdvantage / combinedStats;

    if (willCrit) {
        const critMitigation = 1 - Math.min(
            adjustments.critMitigationCeiling,
            attackAdvantageRatio * adjustments.critDamageMitigation
        );
        const critBonus = Math.max(adjustments.critBaseBonus, 0.1) * Math.max(critMitigation, 0.4);
        damage = Math.floor(damage * (1 + critBonus));
    }

    const attackMitigation = 1 - Math.min(
        adjustments.attackMitigationCeiling,
        attackAdvantageRatio * adjustments.attackAdvantageMitigation
    );
    const mitigatedDamage = Math.floor(damage * Math.max(attackMitigation, 0.5));
    const minDamageFloor = Math.max(Math.floor(attacker.attack * minimumDamageScalar), 1);
    let finalDamage = Math.max(mitigatedDamage, minDamageFloor);

    const overageThreshold = adjustments.attackOverageThreshold ?? 18;
    const overagePenalty = adjustments.attackOveragePenalty ?? 0.18;
    const overageDivisor = adjustments.attackOverageDivisor ?? 80;
    const attackOverage = Math.max(0, attacker.attack - (defender.defense + overageThreshold));
    if (attackOverage > 0 && overagePenalty > 0 && overageDivisor > 0) {
        const overageRatio = Math.min(overagePenalty, attackOverage / overageDivisor);
        finalDamage = Math.max(Math.floor(finalDamage * (1 - overageRatio)), minDamageFloor);
    }

    return finalDamage;
}

test('automated growth plan simulations drive targeted balance adjustments', async () => {
    const baselinePlan = { name: '基准养成', overrides: {} };
    const growthPlans = [
        { name: '均衡养成', overrides: {} },
        { name: '暴击流', overrides: { attack: 52, defense: 12 } },
        { name: '铁壁流', overrides: { attack: 28, defense: 30, health: 280 } }
    ];

    const randomSequences = generateRandomSequences(20240521, 8, 4);
    const baselineAdjustments = {
        attackAdvantageMitigation: 0.12,
        attackMitigationCeiling: 0.35,
        defenseAdvantageMitigation: 0.18,
        defenseMitigationCeiling: 0.32,
        minimumDamageScalar: 0.15,
        critBaseBonus: 0.5,
        critDamageMitigation: 0.08,
        critMitigationCeiling: 0.25,
        attackOverageThreshold: 18,
        attackOveragePenalty: 0.18,
        attackOverageDivisor: 80,
        defenseOverageThreshold: 22,
        defenseOveragePenalty: 0.12
    };
    const evaluation = await evaluatePlans(growthPlans, baselinePlan, randomSequences, {
        balanceAdjustments: baselineAdjustments
    });

    const balancedScore = evaluation.get('均衡养成').averageScore;
    const burstScore = evaluation.get('暴击流').averageScore;
    const fortressScore = evaluation.get('铁壁流').averageScore;
    assert.ok(Math.abs(balancedScore) < 6, `Expected balanced plan to remain near neutral but got ${balancedScore}`);

    const { adjustments, flaggedPlans } = deriveBalanceAdjustments(evaluation, { imbalanceThreshold: 30 });
    assert.ok(flaggedPlans.some(plan => plan.planName === '暴击流'), 'Burst plan should be flagged for mitigation');
    assert.ok(flaggedPlans.some(plan => plan.planName === '铁壁流'), 'Defensive plan should also trigger mitigation');
    assert.ok(adjustments.attackAdvantageMitigation > 0.18, 'Attack mitigation should increase for burst builds');
    assert.ok(adjustments.defenseAdvantageMitigation > 0.2, 'Defense mitigation should increase for fortress builds');

    const tunedEvaluation = await evaluatePlans(growthPlans, baselinePlan, randomSequences, {
        balanceAdjustments: adjustments
    });
    const tunedBurst = tunedEvaluation.get('暴击流').averageScore;
    const tunedFortress = tunedEvaluation.get('铁壁流').averageScore;

    assert.ok(Math.abs(tunedBurst) < Math.abs(burstScore), 'Burst plan should be moderated after applying adjustments');
    assert.ok(Math.abs(tunedFortress) < Math.abs(fortressScore), 'Defensive plan should fall back within acceptable range after adjustments');
    assert.ok(Math.abs(tunedBurst) <= Math.abs(burstScore) * 0.7, 'Burst advantage should be reduced by at least 30%');
    assert.ok(Math.abs(tunedFortress) <= Math.abs(fortressScore) * 0.7, 'Defensive advantage should be reduced by at least 30%');
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

    const inflictedDamage = 260 - defender.health;
    const willCrit = 0.01 < playerWithEquipment.critChance;
    const expectedDamage = computeMitigatedDamage(
        { ...playerWithEquipment, attack: originalAttack },
        { ...defender, defense: defender.defense },
        battle.balanceAdjustments,
        { willCrit }
    );
    assert.equal(inflictedDamage, expectedDamage, 'defender health should account for balanced damage output');

    battle.handleStatusEffects();
    assert.equal(playerWithEquipment.attackBoostDuration, 2, 'duration should tick down after status handling');

    battle.handleStatusEffects();
    battle.handleStatusEffects();
    assert.equal(playerWithEquipment.attack, originalAttack, 'attack should revert after boost duration expires');
    assert.equal(playerWithEquipment.defense, originalDefense, 'defense penalty should be removed when duration ends');
});
