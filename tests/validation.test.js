import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySoftCap, validateAttributes, ATTRIBUTE_LIMITS, mergeAttributes } from '../utils/validation.js';
import { applyEquipmentAttributes } from '../services/equipmentService.js';

const mockEquipment = {
    武器: {
        name: '测试武器',
        set: '力道',
        attributes: { attack: 200, defense: 0, health: 0, speed: 10 }
    }
};

test('applySoftCap enforces diminishing returns beyond soft cap', () => {
    const limits = ATTRIBUTE_LIMITS.attack;
    const overCapped = applySoftCap(limits.softCap + 100, limits);
    assert.ok(overCapped < limits.softCap + 100, 'value should be reduced by soft cap formula');
    assert.ok(overCapped > limits.softCap, 'value should remain above the soft cap threshold');
});

test('validateAttributes clamps invalid values and reports adjustments', () => {
    const { sanitized, adjustments } = validateAttributes({
        health: -50,
        speed: ATTRIBUTE_LIMITS.speed.softCap + 200,
        critChance: 2
    });

    assert.equal(sanitized.health, ATTRIBUTE_LIMITS.health.min, 'health should be raised to minimum');
    assert.ok(sanitized.speed <= ATTRIBUTE_LIMITS.speed.hardCap, 'speed should be limited by hard cap');
    assert.ok(sanitized.critChance <= ATTRIBUTE_LIMITS.critChance.hardCap, 'crit chance should not exceed hard cap');
    assert.ok(adjustments.health, 'health adjustment should be recorded');
    assert.ok(adjustments.speed, 'speed adjustment should be recorded');
    assert.ok(adjustments.critChance, 'crit chance adjustment should be recorded');
});

test('mergeAttributes adds stat adjustments to base values', () => {
    const merged = mergeAttributes({ attack: 10, defense: 5 }, { attack: 5, defense: -2, speed: 3 });
    assert.deepEqual(merged, { attack: 15, defense: 3, speed: 3 }, 'adjustments should be applied additively');
});

test('applyEquipmentAttributes applies validation to combined stats', () => {
    const player = { attack: 50, defense: 20, health: 500, speed: 35, critChance: 0.2, parryChance: 0 };
    const result = applyEquipmentAttributes(player, mockEquipment);

    assert.ok(result.attack <= ATTRIBUTE_LIMITS.attack.hardCap, 'final attack should respect hard cap');
    assert.ok(result.health <= ATTRIBUTE_LIMITS.health.hardCap, 'final health should respect hard cap');
    assert.ok(result.validationAdjustments.attack, 'attack adjustment should be tracked');
    assert.equal(result.equipment.武器.name, '测试武器');
});
