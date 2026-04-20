export class SkillResolver {
    /**
     * 执行技能效果
     * @param {Object} attacker 
     * @param {Object} defender 
     * @param {number} damage 当前物理伤害 
     * @param {boolean} isCritical 是否暴击
     * @param {Object} context BattleService上下文环境
     * @returns {number} 最终伤害
     */
    static resolveSkill(attacker, defender, damage, isCritical, context) {
        const {
            log,
            recordEvent,
            recordStateChange,
            createEntityReference,
            formatSkillReference,
            getSkillName,
            currentRound,
            turnManager
        } = context;

        const refAttacker = createEntityReference(attacker);
        const refDefender = createEntityReference(defender);
        const skillName = attacker.skill.name;

        if (attacker.skill.damageMultiplier) {
            damage *= attacker.skill.damageMultiplier;
            log.push(`${formatSkillReference(attacker.skill)}使伤害提高至 ${attacker.skill.damageMultiplier} 倍!`);
            recordEvent('skill_effect', {
                actor: refAttacker,
                target: refDefender,
                parameters: {
                    round: currentRound,
                    skill: skillName,
                    type: 'damage_multiplier',
                    value: attacker.skill.damageMultiplier
                }
            });
        } else if (attacker.skill.extraAttack) {
            const beforeFirstStrike = defender.health;
            defender.health -= damage;
            log.push(`${attacker.name} 攻击了 ${defender.name}，造成 ${damage} 点伤害! ${defender.name} 剩余生命值: ${Math.max(defender.health, 0)}`);

            const extraDamage = attacker.attack - defender.defense / 2;
            damage = Math.max(extraDamage, 1);
            if (isCritical) damage = Math.floor(damage * 1.5);
            log.push(`${formatSkillReference(attacker.skill)}触发，${attacker.name}发动连击!`);

            recordStateChange(defender, 'health', beforeFirstStrike, Math.max(defender.health, 0), {
                round: currentRound,
                source: refAttacker,
                cause: 'extra_attack_initial'
            });
            recordEvent('skill_effect', {
                actor: refAttacker,
                target: refDefender,
                parameters: {
                    round: currentRound,
                    skill: skillName,
                    type: 'extra_attack'
                }
            });
        } else if (attacker.skill.defenseBoost) {
            const previousDefense = attacker.defense;
            attacker.defense += attacker.skill.defenseBoost;
            attacker.defenseBoostDuration = attacker.skill.turns;
            attacker.originalDefenseBoostDuration = attacker.skill.turns;
            attacker.defenseBoostSkillName = getSkillName(attacker.skill);
            attacker.defenseBoostValue = attacker.skill.defenseBoost;
            log.push(`${formatSkillReference(attacker.skill)}为${attacker.name}提供防御力加成，提高 ${attacker.skill.defenseBoost} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            recordStateChange(attacker, 'defense', previousDefense, attacker.defense, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.lifeSteal) {
            let heal = Math.floor(damage * attacker.skill.lifeSteal);
            heal = Math.floor(heal * turnManager.enrageHealPenalty);
            const previousHealth = attacker.health;
            attacker.health = Math.min(attacker.health + heal, attacker.maxHealth);
            log.push(`${formatSkillReference(attacker.skill)}使${attacker.name}吸取了 ${heal} 点生命值!`);
            recordStateChange(attacker, 'health', previousHealth, attacker.health, {
                round: currentRound,
                source: refAttacker,
                skill: skillName,
                type: 'life_steal'
            });
        } else if (attacker.skill.attackBoost) {
            const previousAttack = attacker.attack;
            const previousDefense = attacker.defense;
            attacker.attack += attacker.skill.attackBoost;
            attacker.defense -= attacker.skill.defensePenalty;
            attacker.attackBoostDuration = attacker.skill.turns;
            attacker.originalAttackBoostDuration = attacker.skill.turns;
            attacker.attackBoostSkillName = getSkillName(attacker.skill);
            attacker.attackBoostValue = attacker.skill.attackBoost;
            attacker.attackBoostDefensePenalty = attacker.skill.defensePenalty;
            log.push(`${formatSkillReference(attacker.skill)}使${attacker.name}进入狂暴状态! 攻击提高 ${attacker.skill.attackBoost} 点，防御降低 ${attacker.skill.defensePenalty} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            recordStateChange(attacker, 'attack', previousAttack, attacker.attack, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
            recordStateChange(attacker, 'defense', previousDefense, attacker.defense, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.healAmount) {
            const missingHealth = attacker.maxHealth - attacker.health;
            let healAmount = Math.floor(missingHealth * attacker.skill.healAmount);
            healAmount = Math.floor(healAmount * turnManager.enrageHealPenalty);
            const previousHealth = attacker.health;
            attacker.health = Math.min(attacker.health + healAmount, attacker.maxHealth);
            log.push(`${formatSkillReference(attacker.skill)}使${attacker.name}恢复了 ${healAmount} 点生命值!`);
            recordStateChange(attacker, 'health', previousHealth, attacker.health, {
                round: currentRound,
                source: refAttacker,
                skill: skillName,
                type: 'heal'
            });
            // 治疗技能不产生伤害，所以通常返回 damage=0 或者原逻辑有提前 return
            // 原逻辑是立刻 return { log } 以跳过后续伤害流程
            return { damage: 0, healInterrupt: true };
        } else if (attacker.skill.critChanceBoost) {
            const previousCrit = attacker.critChance;
            attacker.critChance += attacker.skill.critChanceBoost;
            attacker.critChanceBoostValue = attacker.skill.critChanceBoost;
            attacker.critChanceBoostDuration = attacker.skill.turns;
            attacker.originalCritChanceBoostDuration = attacker.skill.turns;
            attacker.critChanceBoostSkillName = getSkillName(attacker.skill);
            log.push(`${formatSkillReference(attacker.skill)}提升了${attacker.name}的会心几率 ${Math.floor(attacker.skill.critChanceBoost * 100)}%，持续 ${attacker.skill.turns || 0} 回合!`);
            recordStateChange(attacker, 'critChance', previousCrit, attacker.critChance, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.armorPenetration) {
            const previousArmorPenetration = defender.armorPenetration || 0;
            defender.armorPenetration = attacker.skill.armorPenetration;
            defender.armorPenetrationDuration = attacker.skill.turns;
            defender.originalArmorPenetrationDuration = attacker.skill.turns;
            defender.armorPenetrationSourceSkillName = getSkillName(attacker.skill);
            log.push(`${formatSkillReference(attacker.skill)}令${defender.name}的防御被无视 ${Math.floor(attacker.skill.armorPenetration * 100)}%，持续 ${attacker.skill.turns || 0} 回合!`);
            recordStateChange(defender, 'armorPenetration', previousArmorPenetration, defender.armorPenetration, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.poisonDamage) {
            const previousPoison = defender.poison || 0;
            defender.poison = attacker.skill.turns;
            defender.originalPoisonDuration = attacker.skill.turns;
            defender.poisonSource = {
                name: attacker.name,
                role: attacker.role,
                skillName: getSkillName(attacker.skill)
            };
            const poisonDamage = Math.floor(defender.maxHealth * attacker.skill.poisonDamage);
            log.push(`${formatSkillReference(attacker.skill)}让${defender.name}中毒，将在 ${attacker.skill.turns || 0} 回合内每回合受到 ${poisonDamage} 点伤害!`);
            recordStateChange(defender, 'poison', previousPoison, defender.poison, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.freezeChance) {
            if (turnManager.randomFn() < attacker.skill.freezeChance) {
                const previousFreeze = Boolean(defender.freeze);
                defender.freeze = true;
                defender.freezeDuration = attacker.skill.turns;
                defender.originalFreezeDuration = attacker.skill.turns;
                defender.freezeSourceSkillName = getSkillName(attacker.skill);
                log.push(`${formatSkillReference(attacker.skill)}令${defender.name}被冰冻，${attacker.skill.turns || 0} 次攻击无法施展且无法触发技能!`);
                recordStateChange(defender, 'freeze', previousFreeze, defender.freeze, {
                    round: currentRound,
                    source: refAttacker,
                    skill: skillName
                });
            } else {
                log.push(`${defender.name} 成功抵抗了${formatSkillReference(attacker.skill)}的冰冻效果!`);
            }
        } else if (attacker.skill.taunt) {
            const previousTaunt = Boolean(defender.taunted);
            defender.taunted = true;
            defender.tauntDuration = attacker.skill.turns;
            defender.originalTauntDuration = attacker.skill.turns;
            defender.tauntSourceSkillName = getSkillName(attacker.skill);
            log.push(`${formatSkillReference(attacker.skill)}嘲讽了${defender.name}，${attacker.skill.turns || 0} 次攻击只能攻击${attacker.name}且无法触发技能!`);
            recordStateChange(defender, 'taunted', previousTaunt, defender.taunted, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.damageReflection) {
            const previousReflection = attacker.reflection || 0;
            attacker.reflection = attacker.skill.damageReflection;
            attacker.reflectionDuration = attacker.skill.turns;
            attacker.originalReflectionDuration = attacker.skill.turns;
            attacker.reflectionSkillName = getSkillName(attacker.skill);
            log.push(`${formatSkillReference(attacker.skill)}为${attacker.name}赋予伤害反射效果，将反射 ${Math.floor(attacker.skill.damageReflection * 100)}% 的伤害，持续 ${attacker.skill.turns || 0} 次攻击!`);
            recordStateChange(attacker, 'reflection', previousReflection, attacker.reflection, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.shieldAmount) {
            const shieldAmount = Math.floor(attacker.maxHealth * attacker.skill.shieldAmount);
            const previousShield = attacker.shield || 0;
            attacker.shield += shieldAmount;
            attacker.shieldSkillName = getSkillName(attacker.skill);
            log.push(`${formatSkillReference(attacker.skill)}为${attacker.name}提供了${shieldAmount} 点护盾!`);
            recordStateChange(attacker, 'shield', previousShield, attacker.shield, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.parryBoost) {
            const previousParry = attacker.parryChance || 0;
            attacker.parryChance = (attacker.parryChance || 0) + attacker.skill.parryBoost;
            attacker.parryChanceDuration = attacker.skill.turns;
            attacker.originalParryChanceDuration = attacker.skill.turns;
            attacker.parryBoostSkillName = getSkillName(attacker.skill);
            log.push(`${formatSkillReference(attacker.skill)}提升了${attacker.name}的招架率 ${Math.floor(attacker.skill.parryBoost * 100)}%，持续${attacker.skill.turns || 0} 次攻击!`);
            recordStateChange(attacker, 'parryChance', previousParry, attacker.parryChance, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        } else if (attacker.skill.attackReduction) {
            const previousAttack = defender.attack;
            defender.attack -= attacker.skill.attackReduction;
            defender.attackReductionDuration = attacker.skill.turns;
            defender.originalAttackReductionDuration = attacker.skill.turns;
            defender.originalAttackReductionValue = attacker.skill.attackReduction;
            defender.attackReductionSkillName = getSkillName(attacker.skill);
            log.push(`${formatSkillReference(attacker.skill)}削弱了${defender.name}的攻击力 ${attacker.skill.attackReduction} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            recordStateChange(defender, 'attack', previousAttack, defender.attack, {
                round: currentRound,
                source: refAttacker,
                skill: skillName
            });
        }

        return { damage, healInterrupt: false };
    }
}
