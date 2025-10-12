export const skillConfig = [
    { name: '暴击', description: '本次攻击造成1.5倍伤害', damageMultiplier: 1.5, chance: 0.15, rarity: 'rare', cooldown: 0 },
    { name: '连击', description: '本次攻击额外攻击一次', extraAttack: 1, chance: 0.14, rarity: 'epic', cooldown: 1 },
    { name: '御劲', description: '提高10点防御力(持续2次攻击)', defenseBoost: 10, turns: 2, chance: 0.25, rarity: 'common', cooldown: 0 },
    { name: '吸血', description: '本次攻击吸取伤害的50%转化为生命值', lifeSteal: 0.5, chance: 0.2, rarity: 'epic', cooldown: 2 },
    { name: '爆发', description: '攻击提高10点但防御降低5点(持续3次攻击,可叠加)', attackBoost: 10, defensePenalty: 5, turns: 3, chance: 0.15, rarity: 'legendary', cooldown: 3 },
    { name: '疗伤', description: '回复已损失生命值的20%', healAmount: 0.2, chance: 0.2, rarity: 'common', cooldown: 2 },
    { name: '破防', description: '无视对手最大防御的20%(持续2次攻击,可叠加)', armorPenetration: 0.2, turns: 2, chance: 0.18, rarity: 'rare', cooldown: 2 },
    { name: '中毒', description: '使对手持续扣除最大生命值的10%(持续3次攻击,可叠加)', poisonDamage: 0.1, turns: 3, chance: 0.18, rarity: 'rare', cooldown: 1 },
    { name: '冰冻', description: '使对手下次攻击无法施展且无法触发技能(但有30%概率抵抗成功)', freezeChance: 0.7, chance: 0.18, rarity: 'epic', cooldown: 4 },
    { name: '嘲讽', description: '强制对手攻击自己,无法触发技能(持续2次攻击)', taunt: true, turns: 2, chance: 0.19, rarity: 'common', cooldown: 3 },
    { name: '反弹', description: '对手下次攻击时反弹伤害的20%给对手', damageReflection: 0.2, turns: 1, chance: 0.23, rarity: 'epic', cooldown: 2 },
    { name: '聚气', description: '增加自身10%会心几率(持续2次攻击,可叠加)', critChanceBoost: 0.1, turns: 2, chance: 0.18, rarity: 'rare', cooldown: 1 },
    { name: '护盾', description: '获得一个最大生命值20%的护盾(可叠加)', shieldAmount: 0.2, chance: 0.15, rarity: 'legendary', cooldown: 3 },
    { name: '加速', description: '提高自身5点加速,加速高于对方时可先手攻击(持续3次攻击,可叠加)', speedBoost: 5, turns: 3, chance: 0.28, rarity: 'common', cooldown: 1 },
    { name: '化劲', description: '降低对手10点攻击力(持续2次攻击,可叠加)', attackReduction: 10, turns: 2, chance: 0.19, rarity: 'rare', cooldown: 2 },
    { name: '招架', description: '提升50%招架率,对手攻击有概率招架,不受到伤害(持续2次攻击,可叠加)', parryBoost: 0.5, turns: 2, chance: 0.18, rarity: 'legendary', cooldown: 2 }
];
