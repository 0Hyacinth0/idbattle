export const skillConfig = [
    { name: '绝刀', description: '本次攻击造成1.5倍伤害', damageMultiplier: 1.5, chance: 0.15, cooldown: 0 },
    { name: '断潮', description: '本次攻击额外攻击一次', extraAttack: 1, chance: 0.14, cooldown: 1 },
    { name: '锻骨诀', description: '提高10点防御力(持续2次攻击)', defenseBoost: 10, turns: 2, chance: 0.25, cooldown: 0 },
    { name: '归寂道', description: '本次攻击吸取伤害的50%转化为生命值', lifeSteal: 0.5, chance: 0.2, cooldown: 2 },
    { name: '莺鸣柳', description: '攻击提高10点但防御降低5点(持续3次攻击,可叠加)', attackBoost: 10, defensePenalty: 5, turns: 3, chance: 0.15, cooldown: 3 },
    { name: '王母挥袂', description: '回复已损失生命值的20%', healAmount: 0.2, chance: 0.2, cooldown: 2 },
    { name: '不愧君', description: '无视对手最大防御的20%(持续2次攻击,可叠加)', armorPenetration: 0.2, turns: 2, chance: 0.18, cooldown: 2 },
    { name: '百足', description: '使对手持续扣除最大生命值的10%(持续3次攻击,可叠加)', poisonDamage: 0.1, turns: 3, chance: 0.18, cooldown: 1 },
    { name: '七星拱瑞', description: '使对手下次攻击无法施展且无法触发技能(但有30%概率抵抗成功)', freezeChance: 0.7, chance: 0.18, cooldown: 4 },
    { name: '定军', description: '强制对手攻击自己,无法触发技能(持续2次攻击)', taunt: true, turns: 2, chance: 0.19, cooldown: 3 },
    { name: '金钟罩', description: '对手下次攻击时反弹伤害的20%给对手', damageReflection: 0.2, turns: 1, chance: 0.23, cooldown: 2 },
    { name: '紫气东来', description: '增加自身20%会心几率(持续2次攻击,可叠加)', critChanceBoost: 0.2, turns: 2, chance: 0.18, cooldown: 1 },
    { name: '阳春白雪', description: '获得一个最大生命值20%的护盾(可叠加)', shieldAmount: 0.2, chance: 0.15, cooldown: 3 },
    { name: '灭影追风', description: '降低对手10点攻击力(持续2次攻击,可叠加)', attackReduction: 10, turns: 2, chance: 0.19, cooldown: 2 },
    { name: '盾壁', description: '提升50%招架率,对手攻击有概率招架,不受到伤害(持续2次攻击,可叠加)', parryBoost: 0.5, turns: 2, chance: 0.18, cooldown: 2 }
];
