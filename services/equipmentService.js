import { setEffects } from '../models/equipment.js';

// 计算套装效果（2件部分效果，4件全部效果）
function calculateSetEffects(equipment) {
    const setCounts = new Map();
    let effects = {};

    // 统计每种套装的装备数量
    for (const item of Object.values(equipment)) {
        if (item.套装) {
            setCounts.set(item.套装, (setCounts.get(item.套装) || 0) + 1);
        }
    }

    // 应用套装效果
    for (const [setName, count] of setCounts) {
        if (setEffects[setName]) {
            // 确定适用的套装等级
            let effectLevel = 0;
            if (count >= 4) {
                effectLevel = 4;
            } else if (count >= 2) {
                effectLevel = 2;
            }

            // 应用对应等级的效果
            if (effectLevel > 0 && setEffects[setName][effectLevel]) {
                effects = {...effects, ...setEffects[setName][effectLevel]};
                effects.activeSet = setName;
                effects.setCount = count;
                effects.effectLevel = effectLevel;
            }
        }
    }

    return effects;
}

// 应用装备属性
function applyEquipmentAttributes(player, equipment) {
    // 初始属性
    let attack = player.attack;
    let defense = player.defense;
    let health = player.health;
    let speed = player.speed;

    // 应用每件装备的属性
    Object.values(equipment).forEach(item => {
        attack += item.attack;
        defense += item.defense;
        health += item.health;
        speed += item.speed;
    });

    // 应用套装效果
    const setEffectsResult = calculateSetEffects(equipment);
    if (setEffectsResult.attackMultiplier) attack *= setEffectsResult.attackMultiplier;
    if (setEffectsResult.defenseMultiplier) defense *= setEffectsResult.defenseMultiplier;
    if (setEffectsResult.healthMultiplier) health *= setEffectsResult.healthMultiplier;
    if (setEffectsResult.speedMultiplier) speed *= setEffectsResult.speedMultiplier;

    // 确保属性不为负
    attack = Math.max(attack, 1);
    defense = Math.max(defense, 0);
    health = Math.max(health, 1);
    speed = Math.max(speed, 1);

    return {
        ...player,
        attack: Math.floor(attack),
        defense: Math.floor(defense),
        health: Math.floor(health),
        maxHealth: Math.floor(health),
        speed: Math.floor(speed),
        equipment,
        setEffects: setEffectsResult
    };
}

export { calculateSetEffects, applyEquipmentAttributes };