export class DamageCalculator {
    /**
     * 计算基础伤害
     * @param {Object} attacker 攻击者
     * @param {Object} defender 防御者
     * @param {number} enrageMultiplier 狂暴伤害加成系数
     * @returns {number} 计算得出的基础伤害值
     */
    static calculateBaseDamage(attacker, defender, enrageMultiplier = 1.0) {
        let defenseEffectiveness = defender.defense / (defender.defense + 50);
        const actualArmorPen = defender.armorPenetration || 0;

        if (actualArmorPen) {
            const effectiveDefense = defender.defense * (1 - actualArmorPen);
            defenseEffectiveness = effectiveDefense / (effectiveDefense + 50);
        }

        let damage = Math.max(attacker.attack * (1 - defenseEffectiveness), attacker.attack * 0.15);
        damage = Math.floor(damage);
        damage = Math.max(damage, 1);

        if (enrageMultiplier > 1.0) {
            damage = Math.floor(damage * enrageMultiplier);
        }

        return damage;
    }

    /**
     * 判断是否暴击
     * @param {Object} attacker 攻击者
     * @param {Function} randomFn 随机函数
     * @param {boolean} skillConditionMet 是否满足特殊技能暴击条件
     * @returns {boolean}
     */
    static checkCritical(attacker, randomFn, skillConditionMet = false) {
        if (skillConditionMet && attacker.skill?.critOverride) {
            return true;
        }
        return randomFn() < attacker.critChance;
    }

    /**
     * 判断是否招架
     * @param {Object} defender 防御者
     * @param {Function} randomFn 随机函数
     * @returns {boolean}
     */
    static checkParry(defender, randomFn) {
        const parryChance = defender.parryChance || 0;
        return randomFn() < parryChance;
    }

    /**
     * 判断技能前置触发条件是否满足 (例如血量低于某值)
     * @param {Object} attacker 
     * @returns {boolean}
     */
    static isSkillConditionMet(attacker) {
        if (!attacker.skill?.condition) {
            return true;
        }
        const cond = attacker.skill.condition;
        if (cond.type === 'hp_below') {
            return (attacker.health / attacker.maxHealth) < cond.value;
        }
        return true;
    }
}
