import { setEffects } from '../models/equipment.js';
import { validateAttributes } from '../utils/validation.js';

function calculateSetEffects(equipment) {
    const setCounts = new Map();
    let effects = {};

    Object.values(equipment).forEach(item => {
        if (item && item.set) {
            setCounts.set(item.set, (setCounts.get(item.set) || 0) + 1);
        }
    });

    for (const [setName, count] of setCounts) {
        const effectConfig = setEffects[setName];
        if (!effectConfig) continue;

        let effectLevel = 0;
        if (count >= 4) {
            effectLevel = 4;
        } else if (count >= 2) {
            effectLevel = 2;
        }

        if (effectLevel > 0 && effectConfig[effectLevel]) {
            effects = { ...effects, ...effectConfig[effectLevel], activeSet: setName, setCount: count, effectLevel };
        }
    }

    return effects;
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
