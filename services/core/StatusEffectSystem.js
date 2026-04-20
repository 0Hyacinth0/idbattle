export class StatusEffectSystem {
    /**
     * 处理玩家的所有状态效果并返回战斗日志消息
     * @param {Object} player 
     * @param {Object} context 
     * @returns {string[]}
     */
    static processEffects(player, context) {
        const messages = [];
        const {
            recordStateChange,
            recordEvent,
            createEntityReference,
            formatSkillReference,
            currentRound
        } = context;

        const refPlayer = createEntityReference(player);

        if (player.reflectionDuration > 0) {
            player.reflectionDuration--;
            if (player.reflectionDuration === 0) {
                const previousReflection = player.reflection;
                player.reflection = 0;
                const reflectionSkillRef = formatSkillReference(player.reflectionSkillName, '伤害反射效果');
                messages.push(`${player.name}的${reflectionSkillRef}结束! 已持续 ${player.originalReflectionDuration || 0} 次攻击!`);
                player.reflectionSkillName = null;
                recordStateChange(player, 'reflection', previousReflection, player.reflection, {
                    round: currentRound,
                    reason: 'reflection_expired'
                });
            }
        }

        if (player.poison > 0) {
            player.poison--;
            const poisonDamage = Math.floor(player.maxHealth * (player.skill?.poisonDamage || 0.1)); // 默认为0.1，或者由施放者决定
            const previousHealth = player.health;
            player.health -= poisonDamage;
            player.health = Math.max(player.health, 0);

            const poisonSourceSkillRef = formatSkillReference(player.poisonSource?.skillName, '中毒效果');
            messages.push(`${player.name}受到${poisonSourceSkillRef}的折磨，损失了 ${poisonDamage} 点生命值! 剩余生命值: ${player.health}`);

            recordStateChange(player, 'health', previousHealth, player.health, {
                round: currentRound,
                source: createEntityReference(player.poisonSource || null),
                cause: 'poison_damage'
            });
            recordStateChange(player, 'poison', player.poison + 1, player.poison, {
                round: currentRound,
                type: 'poison_duration'
            });
            recordEvent('status_tick', {
                actor: createEntityReference(player.poisonSource || null),
                target: refPlayer,
                parameters: {
                    round: currentRound,
                    type: 'poison',
                    damage: poisonDamage,
                    remaining: player.poison
                }
            });

            if (player.poison === 0) {
                player.poisonSource = null;
            }
        }

        if (player.defenseBoostDuration > 0) {
            player.defenseBoostDuration--;
            if (player.defenseBoostDuration === 0) {
                const previousDefense = player.defense;
                player.defense -= player.defenseBoostValue || player.skill?.defenseBoost || 0;
                const defenseSkillRef = formatSkillReference(player.defenseBoostSkillName, '防御提升效果');
                messages.push(`${player.name}的${defenseSkillRef}结束! 已持续 ${player.originalDefenseBoostDuration || 0} 次攻击!`);
                player.defenseBoostSkillName = null;
                player.defenseBoostValue = 0;
                recordStateChange(player, 'defense', previousDefense, player.defense, {
                    round: currentRound,
                    reason: 'defense_boost_expired'
                });
            }
        }

        if (player.attackBoostDuration > 0) {
            player.attackBoostDuration--;
            if (player.attackBoostDuration === 0) {
                const previousAttack = player.attack;
                const previousDefense = player.defense;
                player.attack -= player.attackBoostValue || player.skill?.attackBoost || 0;
                player.defense += player.attackBoostDefensePenalty || player.skill?.defensePenalty || 0;
                const attackBoostSkillRef = formatSkillReference(player.attackBoostSkillName, '狂暴状态');
                messages.push(`${player.name}的${attackBoostSkillRef}结束! 已持续 ${player.originalAttackBoostDuration || player.skill?.turns || 0} 次攻击! 攻击和防御已恢复正常!`);
                player.attackBoostSkillName = null;
                player.attackBoostValue = 0;
                player.attackBoostDefensePenalty = 0;
                recordStateChange(player, 'attack', previousAttack, player.attack, {
                    round: currentRound,
                    reason: 'attack_boost_expired'
                });
                recordStateChange(player, 'defense', previousDefense, player.defense, {
                    round: currentRound,
                    reason: 'attack_boost_expired'
                });
            }
        }

        if (player.armorPenetrationDuration > 0) {
            player.armorPenetrationDuration--;
            if (player.armorPenetrationDuration === 0) {
                const previousArmorPenetration = player.armorPenetration;
                player.armorPenetration = 0;
                const armorPenSkillRef = formatSkillReference(player.armorPenetrationSourceSkillName, '破防效果');
                messages.push(`${player.name}的${armorPenSkillRef}结束! 已持续 ${player.originalArmorPenetrationDuration || 0} 次攻击! 防御力已恢复正常!`);
                player.armorPenetrationSourceSkillName = null;
                recordStateChange(player, 'armorPenetration', previousArmorPenetration, player.armorPenetration, {
                    round: currentRound,
                    reason: 'armor_penetration_expired'
                });
            }
        }

        if (player.critChanceBoostDuration > 0) {
            player.critChanceBoostDuration--;
            if (player.critChanceBoostDuration === 0) {
                const boostValue = player.critChanceBoostValue || 0;
                const previousCrit = player.critChance;
                player.critChance -= boostValue;
                player.critChanceBoostValue = 0;
                const critSkillRef = formatSkillReference(player.critChanceBoostSkillName, '聚气效果');
                messages.push(`${player.name}的${critSkillRef}结束! 已持续 ${player.originalCritChanceBoostDuration || 0} 次攻击! 会心几率已恢复正常!`);
                player.critChanceBoostSkillName = null;
                recordStateChange(player, 'critChance', previousCrit, player.critChance, {
                    round: currentRound,
                    reason: 'crit_chance_expired'
                });
            }
        }

        if (player.freezeDuration > 0) {
            player.freezeDuration--;
            if (player.freezeDuration === 0) {
                const wasFrozen = Boolean(player.freeze);
                player.freeze = false;
                const freezeSkillRef = formatSkillReference(player.freezeSourceSkillName, '冰冻效果');
                messages.push(`${player.name}的${freezeSkillRef}结束! 已持续 ${player.originalFreezeDuration || 0} 次攻击!`);
                player.freezeSourceSkillName = null;
                if (wasFrozen) {
                    recordStateChange(player, 'freeze', true, false, {
                        round: currentRound,
                        reason: 'freeze_expired'
                    });
                }
            }
        }

        if (player.tauntDuration > 0) {
            player.tauntDuration--;
            if (player.tauntDuration === 0) {
                const wasTaunted = Boolean(player.taunted);
                player.taunted = false;
                const tauntSkillRef = formatSkillReference(player.tauntSourceSkillName, '嘲讽效果');
                messages.push(`${player.name}的${tauntSkillRef}结束! 已持续 ${player.originalTauntDuration || 0} 次攻击!`);
                player.tauntSourceSkillName = null;
                if (wasTaunted) {
                    recordStateChange(player, 'taunted', true, false, {
                        round: currentRound,
                        reason: 'taunt_expired'
                    });
                }
            }
        }

        if (player.attackReductionDuration > 0) {
            player.attackReductionDuration--;
            if (player.attackReductionDuration === 0) {
                const previousAttack = player.attack;
                player.attack += player.originalAttackReductionValue || 0;
                const attackReductionSkillRef = formatSkillReference(player.attackReductionSkillName, '攻击力降低效果');
                messages.push(`${player.name}的${attackReductionSkillRef}结束! 已持续 ${player.originalAttackReductionDuration || 0} 次攻击!`);
                player.attackReductionSkillName = null;
                recordStateChange(player, 'attack', previousAttack, player.attack, {
                    round: currentRound,
                    reason: 'attack_reduction_expired'
                });
            }
        }

        if (player.parryChanceDuration > 0) {
            player.parryChanceDuration--;
            if (player.parryChanceDuration === 0) {
                const previousParry = player.parryChance;
                player.parryChance = 0;
                const parrySkillRef = formatSkillReference(player.parryBoostSkillName, '招架提升效果');
                messages.push(`${player.name}的${parrySkillRef}结束! 已持续 ${player.originalParryChanceDuration || 0} 次攻击!`);
                player.parryBoostSkillName = null;
                recordStateChange(player, 'parryChance', previousParry, player.parryChance, {
                    round: currentRound,
                    reason: 'parry_boost_expired'
                });
            }
        }

        return messages;
    }
}
