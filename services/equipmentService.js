import { setEffects } from '../models/equipment.js';
import { validateAttributes } from '../utils/validation.js';

function calculateSetEffects(equipment) {
    const setCounts = new Map();

    Object.values(equipment).forEach(item => {
        if (item && item.set) {
            setCounts.set(item.set, (setCounts.get(item.set) || 0) + 1);
        }
    });

    const cumulative = {
        attackMultiplier: 1,
        defenseMultiplier: 1,
        healthMultiplier: 1,
        speedMultiplier: 1,
        critChance: 0,
        parryChance: 0
    };
    const activeSets = [];

    for (const [setName, count] of setCounts) {
        const effectConfig = setEffects[setName];
        if (!effectConfig) continue;

        let effectLevel = 0;
        if (count >= 4 && effectConfig[4]) {
            effectLevel = 4;
        } else if (count >= 2 && effectConfig[2]) {
            effectLevel = 2;
        }

        if (!effectLevel) {
            continue;
        }

        const effect = effectConfig[effectLevel];
        if (!effect) {
            continue;
        }

        if (typeof effect.attackMultiplier === 'number') {
            cumulative.attackMultiplier *= effect.attackMultiplier;
        }
        if (typeof effect.defenseMultiplier === 'number') {
            cumulative.defenseMultiplier *= effect.defenseMultiplier;
        }
        if (typeof effect.healthMultiplier === 'number') {
            cumulative.healthMultiplier *= effect.healthMultiplier;
        }
        if (typeof effect.speedMultiplier === 'number') {
            cumulative.speedMultiplier *= effect.speedMultiplier;
        }
        if (typeof effect.critChance === 'number') {
            cumulative.critChance += effect.critChance;
        }
        if (typeof effect.parryChance === 'number') {
            cumulative.parryChance += effect.parryChance;
        }

        activeSets.push({
            name: setName,
            description: effect.description || `${setName}套装(${effectLevel}件)`,
            effectLevel,
            count,
            bonuses: effect
        });
    }

    const result = {};

    if (activeSets.length > 0) {
        result.activeSets = activeSets;
    }

    if (cumulative.attackMultiplier !== 1) {
        result.attackMultiplier = cumulative.attackMultiplier;
    }
    if (cumulative.defenseMultiplier !== 1) {
        result.defenseMultiplier = cumulative.defenseMultiplier;
    }
    if (cumulative.healthMultiplier !== 1) {
        result.healthMultiplier = cumulative.healthMultiplier;
    }
    if (cumulative.speedMultiplier !== 1) {
        result.speedMultiplier = cumulative.speedMultiplier;
    }
    if (cumulative.critChance !== 0) {
        result.critChance = cumulative.critChance;
    }
    if (cumulative.parryChance !== 0) {
        result.parryChance = cumulative.parryChance;
    }

    return result;
}

function applyEquipmentAttributes(player, equipment) {
    const aggregated = {
        attack: player.attack ?? 0,
        defense: player.defense ?? 0,
        health: player.health ?? 0,
        speed: player.speed ?? 0,
        critChance: player.critChance ?? 0,
        parryChance: player.parryChance ?? 0,
        shield: player.shield ?? 0
    };

    Object.values(equipment).forEach(item => {
        if (!item || !item.attributes) {
            return;
        }
        Object.entries(item.attributes).forEach(([key, value]) => {
            if (typeof value === 'number') {
                aggregated[key] = (aggregated[key] || 0) + value;
            }
        });
    });

    const setEffectsResult = calculateSetEffects(equipment);
    if (setEffectsResult.attackMultiplier) aggregated.attack *= setEffectsResult.attackMultiplier;
    if (setEffectsResult.defenseMultiplier) aggregated.defense *= setEffectsResult.defenseMultiplier;
    if (setEffectsResult.healthMultiplier) aggregated.health *= setEffectsResult.healthMultiplier;
    if (setEffectsResult.speedMultiplier) aggregated.speed *= setEffectsResult.speedMultiplier;
    if (setEffectsResult.critChance) aggregated.critChance = (aggregated.critChance || 0) + setEffectsResult.critChance;
    if (setEffectsResult.parryChance) aggregated.parryChance = (aggregated.parryChance || 0) + setEffectsResult.parryChance;

    const { sanitized, adjustments } = validateAttributes(aggregated);

    return {
        ...player,
        ...sanitized,
        health: Math.floor(sanitized.health),
        maxHealth: Math.floor(sanitized.health),
        attack: Math.floor(sanitized.attack),
        defense: Math.floor(sanitized.defense),
        speed: Math.floor(sanitized.speed),
        shield: sanitized.shield,
        critChance: sanitized.critChance,
        parryChance: sanitized.parryChance,
        equipment,
        setEffects: setEffectsResult,
        validationAdjustments: adjustments
    };
}

export { calculateSetEffects, applyEquipmentAttributes };
