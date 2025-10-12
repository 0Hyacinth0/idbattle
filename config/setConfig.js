export const setConfig = [
    {
        name: '根骨',
        quality: 'legendary',
        bonusType: 'defensive',
        effects: {
            2: { description: '根骨套装(2件) - 增加 8% 防御力和 5% 生命值', defenseMultiplier: 1.08, healthMultiplier: 1.05 },
            4: { description: '根骨套装(4件) - 增加 15% 防御力、10% 生命值和 3% 攻击力', defenseMultiplier: 1.15, healthMultiplier: 1.1, attackMultiplier: 1.03 }
        }
    },
    {
        name: '力道',
        quality: 'epic',
        bonusType: 'offensive',
        effects: {
            2: { description: '力道套装(2件) - 增加 10% 攻击力和 2% 防御力', attackMultiplier: 1.1, defenseMultiplier: 1.02 },
            4: { description: '力道套装(4件) - 增加 20% 攻击力和 5% 防御力', attackMultiplier: 1.2, defenseMultiplier: 1.05 }
        }
    },
    {
        name: '元气',
        quality: 'epic',
        bonusType: 'speed',
        effects: {
            2: { description: '元气套装(2件) - 增加 10% 攻击力和 5% 加速', attackMultiplier: 1.1, speedMultiplier: 1.05 },
            4: { description: '元气套装(4件) - 增加 20% 攻击力和 10% 加速', attackMultiplier: 1.2, speedMultiplier: 1.1 }
        }
    },
    {
        name: '身法',
        quality: 'rare',
        bonusType: 'crit',
        effects: {
            2: { description: '身法套装(2件) - 增加 5% 攻击力、5% 加速和 2% 会心几率', attackMultiplier: 1.05, speedMultiplier: 1.05, critChance: 0.02 },
            4: { description: '身法套装(4件) - 增加 10% 攻击力、10% 加速和 5% 会心几率', attackMultiplier: 1.1, speedMultiplier: 1.1, critChance: 0.05 }
        }
    },
    {
        name: '体质',
        quality: 'rare',
        bonusType: 'survivability',
        effects: {
            2: { description: '体质套装(2件) - 增加 5% 防御力、5% 生命值和 2% 招架几率', defenseMultiplier: 1.05, healthMultiplier: 1.05, parryChance: 0.02 },
            4: { description: '体质套装(4件) - 增加 10% 防御力、10% 生命值和 5% 招架几率', defenseMultiplier: 1.1, healthMultiplier: 1.1, parryChance: 0.05 }
        }
    }
];
