// 战斗服务模块
import { updatePlayerInfo } from '../ui/playerUI.js';

export class BattleService {
    constructor() {
        this.player1 = null;
        this.player2 = null;
        this.p1Stunned = false;
        this.p2Stunned = false;
        this.updatePlayerInfoCallback = null;
    }

    // 设置玩家和更新回调
    setPlayers(player1, player2, updateCallback) {
        this.player1 = player1;
        this.player2 = player2;
        this.p1Stunned = false;
        this.p2Stunned = false;
        this.updatePlayerInfoCallback = updateCallback;
    }

    // 实时更新玩家UI
    updatePlayerUI() {
        if (this.updatePlayerInfoCallback) {
            this.updatePlayerInfoCallback(this.player1, true);
            this.updatePlayerInfoCallback(this.player2, false);
        }
    }



    // 战斗模拟 - 改为异步执行
    battle(logCallback) {
        return new Promise((resolve) => {
            const log = [];
            let round = 1;
            let battleComplete = false;

            // 重置眩晕状态
            this.p1Stunned = false;
            this.p2Stunned = false;

            // 根据速度决定谁先攻击，速度差小于1时引入随机因素
            let firstAttacker, secondAttacker;
            const speedDiff = Math.abs(this.player1.speed - this.player2.speed);
            if (speedDiff < 1) {
                // 速度相近时，50%概率随机决定先攻
                firstAttacker = Math.random() < 0.5 ? this.player1 : this.player2;
                secondAttacker = firstAttacker === this.player1 ? this.player2 : this.player1;
            } else {
                // 速度差较大时，速度快的先攻
                firstAttacker = this.player1.speed >= this.player2.speed ? this.player1 : this.player2;
                secondAttacker = firstAttacker === this.player1 ? this.player2 : this.player1;
            }

            log.push('=======================================');
            log.push('战斗开始!');
            logCallback(log.join('\n'));

            // 异步执行战斗回合
            const executeRound = () => {
                if (this.player1.health <= 0 || this.player2.health <= 0) {
                    log.push('=======================================');
                    log.push(this.player1.health > 0 ? `${this.player1.name} 胜利!` : `${this.player2.name} 胜利!`);
                    logCallback(log.join('\n'));
                    battleComplete = true;
                    resolve(log.join('\n'));
                    return;
                }

                // 每次回合开始时重新评估攻击顺序
                const speedDiff = Math.abs(this.player1.speed - this.player2.speed);
                if (speedDiff < 1) {
                    // 速度相近时，50%概率随机决定先攻
                    firstAttacker = Math.random() < 0.5 ? this.player1 : this.player2;
                    secondAttacker = firstAttacker === this.player1 ? this.player2 : this.player1;
                } else {
                    // 速度差较大时，速度快的先攻
                    firstAttacker = this.player1.speed >= this.player2.speed ? this.player1 : this.player2;
                    secondAttacker = firstAttacker === this.player1 ? this.player2 : this.player1;
                }

                log.push(`\n第 ${round} 回合:`);
                round++;
                logCallback(log.join('\n'));

                // 延迟执行状态效果处理
                setTimeout(() => {
                    this.handleStatusEffects(log);
                    logCallback(log.join('\n'));
                    this.updatePlayerUI(); // 更新玩家UI

                    // 检查是否有一方已经战败
                    if (this.player1.health <= 0 || this.player2.health <= 0) {
                        setTimeout(() => {
                            log.push('=======================================');
                            log.push(this.player1.health > 0 ? `${this.player1.name} 胜利!` : `${this.player2.name} 胜利!`);
                            logCallback(log.join('\n'));
                            battleComplete = true;
                            resolve(log.join('\n'));
                        }, 500);
                        return;
                    }

                    // 处理眩晕状态
                    const p1CanAttack = !this.p1Stunned && !this.player1.freeze;
                    const p2CanAttack = !this.p2Stunned && !this.player2.freeze;

                    // 延迟执行攻击逻辑
                    setTimeout(() => {
                        // 如果有嘲讽效果，强制攻击被嘲讽的目标
                        if (this.player1.taunted) {
                            log.push(`${this.player1.name}被嘲讽了，只能攻击${this.player2.name}!`);
                            logCallback(log.join('\n'));
                            if (p1CanAttack) {
                                setTimeout(() => {
                                    const attackResult = this.attackEnemy(this.player1, this.player2);
                                    log.push(...attackResult.log);
                                    logCallback(log.join('\n'));
                                    this.updatePlayerUI(); // 更新玩家UI
                                    setTimeout(executeRound, 1000);
                                }, 500);
                            } else if (this.player1.freeze) {
                                log.push(`${this.player1.name}被冰冻了，无法行动!`);
                                this.player1.freeze = false; // 解冻
                                logCallback(log.join('\n'));
                                setTimeout(executeRound, 1000);
                            } else {
                                log.push(`${this.player1.name}被眩晕了，无法行动!`);
                                logCallback(log.join('\n'));
                                this.p1Stunned = false;
                                setTimeout(executeRound, 1000);
                            }
                        } else if (this.player2.taunted) {
                            log.push(`${this.player2.name}被嘲讽了，只能攻击${this.player1.name}!`);
                            logCallback(log.join('\n'));
                            if (p2CanAttack) {
                                setTimeout(() => {
                                    const attackResult = this.attackEnemy(this.player2, this.player1);
                                    log.push(...attackResult.log);
                                    logCallback(log.join('\n'));
                                    this.updatePlayerUI(); // 更新玩家UI
                                    setTimeout(executeRound, 1000);
                                }, 500);
                            } else if (this.player2.freeze) {
                                log.push(`${this.player2.name}被冰冻了，无法行动!`);
                                this.player2.freeze = false; // 解冻
                                logCallback(log.join('\n'));
                                // 回合结束时重置临时状态
                                this.player1.taunted = false;
                                this.player2.taunted = false;
                                setTimeout(executeRound, 1000);
                            } else {
                                log.push(`${this.player2.name}被眩晕了，无法行动!`);
                                logCallback(log.join('\n'));
                                this.p2Stunned = false;
                                // 回合结束时重置临时状态
                                this.player1.taunted = false;
                                this.player2.taunted = false;
                                setTimeout(executeRound, 1000);
                            }
                        } else {
                            // 正常攻击顺序
                            // 第一个攻击者攻击
                            setTimeout(() => {
                                if (firstAttacker === this.player1 && p1CanAttack) {
                                    const attackResult = this.attackEnemy(this.player1, this.player2);
                                    log.push(...attackResult.log);
                                    logCallback(log.join('\n'));
                                } else if (firstAttacker === this.player2 && p2CanAttack) {
                                    const attackResult = this.attackEnemy(this.player2, this.player1);
                                    log.push(...attackResult.log);
                                    logCallback(log.join('\n'));
                                } else if (firstAttacker === this.player1) {
                                    if (this.player1.freeze) {
                                        log.push(`${this.player1.name}被冰冻了，无法行动!`);
                                        this.player1.freeze = false; // 解冻
                                        logCallback(log.join('\n'));
                                    } else {
                                        log.push(`${this.player1.name}被眩晕了，无法行动!`);
                                        logCallback(log.join('\n'));
                                        this.p1Stunned = false;
                                    }
                                } else {
                                    if (this.player2.freeze) {
                                        log.push(`${this.player2.name}被冰冻了，无法行动!`);
                                        this.player2.freeze = false; // 解冻
                                        logCallback(log.join('\n'));
                                    } else {
                                        log.push(`${this.player2.name}被眩晕了，无法行动!`);
                                        logCallback(log.join('\n'));
                                        this.p2Stunned = false;
                                    }
                                }

                                // 检查是否有一方已经战败
                                if (this.player1.health <= 0 || this.player2.health <= 0) {
                                    setTimeout(() => {
                                        log.push('=======================================');
                                        log.push(this.player1.health > 0 ? `${this.player1.name} 胜利!` : `${this.player2.name} 胜利!`);
                                        logCallback(log.join('\n'));
                                        battleComplete = true;
                                        resolve(log.join('\n'));
                                    }, 500);
                                    return;
                                }

                                // 第二个攻击者攻击
                                setTimeout(() => {
                                    if (secondAttacker === this.player1 && p1CanAttack) {
                                        const attackResult = this.attackEnemy(this.player1, this.player2);
                                        log.push(...attackResult.log);
                                        logCallback(log.join('\n'));
                                        this.updatePlayerUI(); // 更新玩家UI
                                    } else if (secondAttacker === this.player2 && p2CanAttack) {
                                        const attackResult = this.attackEnemy(this.player2, this.player1);
                                        log.push(...attackResult.log);
                                        logCallback(log.join('\n'));
                                        this.updatePlayerUI(); // 更新玩家UI
                                    } else if (secondAttacker === this.player1) {
                                        if (this.player1.freeze) {
                                            log.push(`${this.player1.name}被冰冻了，无法行动!`);
                                            logCallback(log.join('\n'));
                                        } else {
                                            log.push(`${this.player1.name}被眩晕了，无法行动!`);
                                            logCallback(log.join('\n'));
                                            this.p1Stunned = false;
                                        }
                                    } else {
                                        if (this.player2.freeze) {
                                            log.push(`${this.player2.name}被冰冻了，无法行动!`);
                                            logCallback(log.join('\n'));
                                        } else {
                                            log.push(`${this.player2.name}被眩晕了，无法行动!`);
                                            logCallback(log.join('\n'));
                                            this.p2Stunned = false;
                                        }
                                    }


                                    // 继续下一轮
                                    setTimeout(executeRound, 1000);
                                }, 1000);
                            }, 500);
                        }
                    }, 500);
                }, 500);
            };

            // 开始执行战斗
            setTimeout(executeRound, 500);
        });
    }

    // 攻击敌人
    attackEnemy(attacker, defender) {
        const log = [];

        // 检查是否被冰冻
        if (attacker.freeze) {
            log.push(`${attacker.name}被冰冻了，无法攻击且无法触发技能!`);
            attacker.freeze = false; // 攻击尝试后解冻
            return { log };
        }

        // 防御计算公式，使其效果随防御值增加而递减
        // 使用公式: damage = attacker.attack * (1 - defense / (defense + 50))
        // 同时确保至少造成攻击力15%的保底伤害
        let defenseEffectiveness = defender.defense / (defender.defense + 50);
        
        // 应用破防效果
        if (defender.armorPenetration) {
            const effectiveDefense = defender.defense * (1 - defender.armorPenetration);
            defenseEffectiveness = effectiveDefense / (effectiveDefense + 50);
            log.push(`${defender.name} 破防效果生效! 防御效果降低了 ${Math.floor(defender.armorPenetration * 100)}%!`);
        }
        
        let damage = Math.max(attacker.attack * (1 - defenseEffectiveness), attacker.attack * 0.15);
        damage = Math.floor(damage); // 向下取整
        damage = Math.max(damage, 1); // 确保至少造成 1 点伤害

        // 检查会心
        let isCritical = false;
        if (Math.random() < attacker.critChance) {
            isCritical = true;
            damage = Math.floor(damage * 1.5);
            log.push(`${attacker.name} 触发了会心! 伤害提升至 ${damage}`);
        }

        // 检查招架
        const parryChance = defender.parryChance || 0;
        let isParried = false;
        if (Math.random() < parryChance) {
            isParried = true;
            log.push(`${defender.name} 触发了招架! 完全免疫本次伤害!`);
            damage = 0; // 完全免疫伤害
        }

        // 检查是否触发技能（被嘲讽时无法触发技能）
        let skillTriggered = false;
        if (!attacker.taunted) {
            const skillChance = attacker.skill.chance || 0.1;
            skillTriggered = Math.random() < skillChance;
        } else {
            log.push(`${attacker.name} 被嘲讽了，无法触发技能!`);
        }

        if (skillTriggered) {
            log.push(`${attacker.name} 触发了技能: ${attacker.skill.name}!`);

            // 处理不同技能效果
            if (attacker.skill.damageMultiplier) {
                damage *= attacker.skill.damageMultiplier;
                log.push(`造成了 ${attacker.skill.damageMultiplier} 倍伤害!`);
            } else if (attacker.skill.extraAttack) {
                // 额外攻击一次
                defender.health -= damage;
                log.push(`${attacker.name} 攻击了 ${defender.name}，造成 ${damage} 点伤害! ${defender.name} 剩余生命值: ${Math.max(defender.health, 0)}`);
                const extraDamage = attacker.attack - defender.defense / 2;
                damage = Math.max(extraDamage, 1);
                if (isCritical) damage = Math.floor(damage * 1.5); // 暴击也影响连击
                log.push(`${attacker.name} 连击!`);
            } else if (attacker.skill.defenseBoost) {
                attacker.defense += attacker.skill.defenseBoost;
                attacker.defenseBoostDuration = attacker.skill.turns;
                attacker.originalDefenseBoostDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${attacker.name} 防御力提高了 ${attacker.skill.defenseBoost} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.lifeSteal) {
                const heal = Math.floor(damage * attacker.skill.lifeSteal);
                attacker.health = Math.min(attacker.health + heal, attacker.maxHealth);
                log.push(`${attacker.name} 吸取了 ${heal} 点生命值!`);
            } else if (attacker.skill.stunChance) {
                if (Math.random() < attacker.skill.stunChance) {
                    log.push(`${defender.name} 被眩晕了!`);
                    // 通过名称比较确保正确识别玩家
                    if (defender.name === this.player1.name) this.p1Stunned = true;
                    else if (defender.name === this.player2.name) this.p2Stunned = true;
                } else {
                    log.push(`${defender.name} 成功抵抗了眩晕效果!`);
                }
            } else if (attacker.skill.attackBoost) {
                attacker.attack += attacker.skill.attackBoost;
                attacker.defense -= attacker.skill.defensePenalty;
                attacker.attackBoostDuration = attacker.skill.turns;
                attacker.originalAttackBoostDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${attacker.name} 进入狂暴状态! 攻击提高 ${attacker.skill.attackBoost} 点，防御降低 ${attacker.skill.defensePenalty} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.healAmount) {
                const missingHealth = attacker.maxHealth - attacker.health;
                const healAmount = Math.floor(missingHealth * attacker.skill.healAmount);
                attacker.health = Math.min(attacker.health + healAmount, attacker.maxHealth);
                log.push(`${attacker.name} 恢复了 ${healAmount} 点生命值!`);
                return { log }; // 治疗技能不造成伤害
            } else if (attacker.skill.critChanceBoost) {
                attacker.critChance += attacker.skill.critChanceBoost;
                attacker.critChanceBoostValue = attacker.skill.critChanceBoost;
                attacker.critChanceBoostDuration = attacker.skill.turns;
                attacker.originalCritChanceBoostDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${attacker.name} 聚气效果触发! 会心几率提高了 ${Math.floor(attacker.skill.critChanceBoost * 100)}%，持续 ${attacker.skill.turns || 0} 回合!`);
            } else if (attacker.skill.armorPenetration) {
                defender.armorPenetration = attacker.skill.armorPenetration;
                defender.armorPenetrationDuration = attacker.skill.turns;
                defender.originalArmorPenetrationDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${defender.name} 破防效果触发! 防御力被无视 ${Math.floor(attacker.skill.armorPenetration * 100)}%，持续 ${attacker.skill.turns || 0} 回合!`);
            } else if (attacker.skill.poisonDamage) {
                defender.poison = attacker.skill.turns;
                defender.originalPoisonDuration = attacker.skill.turns; // 保存原始持续时间
                const poisonDamage = Math.floor(defender.maxHealth * attacker.skill.poisonDamage);
                log.push(`${defender.name} 中毒了，将在 ${attacker.skill.turns || 0} 回合内每回合受到 ${poisonDamage} 点伤害!`);
            } else if (attacker.skill.burnDamage) {
                defender.burn = attacker.skill.turns;
                defender.originalBurnDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${defender.name} 燃烧了，将在 ${attacker.skill.turns || 0} 回合内每回合受到 ${attacker.skill.burnDamage} 点伤害!`);
            } else if (attacker.skill.freezeChance) {
                if (Math.random() < attacker.skill.freezeChance) {
                    defender.freeze = true;
                    defender.freezeDuration = attacker.skill.turns;
                    defender.originalFreezeDuration = attacker.skill.turns; // 保存原始持续时间
                    log.push(`${defender.name} 被冰冻了，${attacker.skill.turns || 0} 次攻击无法施展且无法触发技能!`);
                } else {
                    log.push(`${defender.name} 成功抵抗了冰冻效果!`);
                }
            } else if (attacker.skill.taunt) {
                defender.taunted = true;
                defender.tauntDuration = attacker.skill.turns;
                defender.originalTauntDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${defender.name} 被嘲讽了，${attacker.skill.turns || 0} 次攻击只能攻击${attacker.name}且无法触发技能!`);
            } else if (attacker.skill.damageReflection) {
                attacker.reflection = attacker.skill.damageReflection;
                attacker.reflectionDuration = attacker.skill.turns;
                attacker.originalReflectionDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${attacker.name} 获得了伤害反射效果，将反射 ${Math.floor(attacker.skill.damageReflection * 100)}% 的伤害，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.shieldAmount) {
                const shieldAmount = Math.floor(attacker.maxHealth * attacker.skill.shieldAmount);
                attacker.shield += shieldAmount;
                log.push(`${attacker.name} 获得了 ${shieldAmount} 点护盾!`);
            } else if (attacker.skill.parryBoost) {
                attacker.parryChance = (attacker.parryChance || 0) + attacker.skill.parryBoost;
                attacker.parryChanceDuration = attacker.skill.turns;
                attacker.originalParryChanceDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${attacker.name} 获得了招架提升效果，招架率增加 ${Math.floor(attacker.skill.parryBoost * 100)}%，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.speedBoost) {
                attacker.speed += attacker.skill.speedBoost;
                attacker.speedBoostDuration = attacker.skill.turns;
                attacker.originalSpeedBoostDuration = attacker.skill.turns; // 保存原始持续时间
                log.push(`${attacker.name} 获得了速度提升效果，速度增加 ${attacker.skill.speedBoost} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.attackReduction) {
                defender.attack -= attacker.skill.attackReduction;
                defender.attackReductionDuration = attacker.skill.turns;
            defender.originalAttackReductionDuration = attacker.skill.turns; // 保存原始持续时间
            defender.originalAttackReductionValue = attacker.skill.attackReduction; // 保存原始降低值
                log.push(`${defender.name} 受到了化劲效果影响，攻击力降低 ${attacker.skill.attackReduction} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            }
        }

        // 检查护盾
        if (defender.shield > 0) {
            const shieldAbsorb = Math.min(damage, defender.shield);
            defender.shield -= shieldAbsorb;
            damage -= shieldAbsorb;
            log.push(`${defender.name} 的护盾吸收了 ${shieldAbsorb} 点伤害，剩余护盾: ${defender.shield}`);
        }

        defender.health -= damage;
        defender.health = Math.max(defender.health, 0);
        log.push(`${attacker.name} 攻击了 ${defender.name}，造成 ${damage} 点伤害! ${defender.name} 剩余生命值: ${defender.health}`);

        // 实时更新玩家UI
        this.updatePlayerUI();

        // 检查反射伤害
        if (defender.reflection > 0) {
                const reflectDamage = Math.floor(damage * defender.reflection);
                attacker.health = Math.max(attacker.health - reflectDamage, 0);
                log.push(`${defender.name} 反射了 ${reflectDamage} 点伤害给 ${attacker.name}，${attacker.name} 剩余生命值: ${attacker.health}`);

                // 反射伤害后减少持续时间
                defender.reflectionDuration--;
                if (defender.reflectionDuration === 0) {
                    defender.reflection = 0;
                    log.push(`${defender.name} 的伤害反射效果结束! 已持续 ${defender.originalReflectionDuration || 0} 次攻击!`);
                }

                // 实时更新玩家UI
                this.updatePlayerUI();
            }

        return { log };
    }

    // 处理状态效果
    handleStatusEffects(log) {
        // 使用循环处理两个玩家的状态效果，提高代码复用
        [this.player1, this.player2].forEach(player => {
            if (player.poison > 0) {
                // 中毒伤害为最大生命值的10%
                const poisonDamage = Math.floor(player.maxHealth * 0.1);
                player.health = Math.max(player.health - poisonDamage, 0);
                log.push(`${player.name} 中毒了，受到 ${poisonDamage} 点伤害，剩余生命值: ${player.health}`);
                player.poison--;

            // 实时更新玩家UI
            this.updatePlayerUI();
            }

            // 处理防御提升效果持续时间
            if (player.defenseBoostDuration > 0) {
                player.defenseBoostDuration--;
                if (player.defenseBoostDuration === 0) {
                    player.defense -= player.skill?.defenseBoost || 0;
                    log.push(`${player.name} 的防御提升效果结束! 已持续 ${player.originalDefenseBoostDuration || 0} 次攻击!`);
                }
            }

            // 处理攻击提升效果持续时间
            if (player.attackBoostDuration > 0) {
                player.attackBoostDuration--;
                if (player.attackBoostDuration === 0) {
                    player.attack -= player.skill?.attackBoost || 0;
                    player.defense += player.skill?.defensePenalty || 0;
                    log.push(`${player.name} 的狂暴状态结束! 已持续 ${player.skill?.turns || 0} 次攻击! 攻击和防御已恢复正常!`);
                }
            }

            // 处理破防效果持续时间
            if (player.armorPenetrationDuration > 0) {
                player.armorPenetrationDuration--;
                if (player.armorPenetrationDuration === 0) {
                    player.armorPenetration = 0;
                    log.push(`${player.name} 的破防效果结束! 已持续 ${player.originalArmorPenetrationDuration || 0} 次攻击! 防御力已恢复正常!`);
                }
            }

            // 处理会心几率提升效果持续时间
            if (player.critChanceBoostDuration > 0) {
                player.critChanceBoostDuration--;
                if (player.critChanceBoostDuration === 0) {
                    player.critChance -= player.critChanceBoostValue || 0;
                    player.critChanceBoostValue = 0;
                    log.push(`${player.name} 的聚气效果结束! 已持续 ${player.originalCritChanceBoostDuration || 0} 次攻击! 会心几率已恢复正常!`);
                }
            }

            // 处理冰冻效果持续时间
            if (player.freezeDuration > 0) {
                player.freezeDuration--;
                if (player.freezeDuration === 0) {
                    player.freeze = false;
                    log.push(`${player.name} 的冰冻效果结束! 已持续 ${player.originalFreezeDuration || 0} 次攻击!`);
                }
            }

            // 处理嘲讽效果持续时间
            if (player.tauntDuration > 0) {
                player.tauntDuration--;
                if (player.tauntDuration === 0) {
                player.taunted = false;
                log.push(`${player.name} 的嘲讽效果结束! 已持续 ${player.originalTauntDuration || 0} 次攻击!`);
            }
            }

            // 伤害反射效果持续时间在反射伤害触发后处理
            

            // 处理速度提升效果持续时间
            if (player.speedBoostDuration > 0) {
                player.speedBoostDuration--;
                if (player.speedBoostDuration === 0) {
                    player.speed -= player.skill?.speedBoost || 0;
                    log.push(`${player.name} 的速度提升效果结束! 已持续 ${player.originalSpeedBoostDuration || 0} 次攻击!`);
                }
            }

            // 处理攻击力降低效果持续时间
            if (player.attackReductionDuration > 0) {
                player.attackReductionDuration--;
                if (player.attackReductionDuration === 0) {
                    player.attack += player.originalAttackReductionValue || 0;
                    log.push(`${player.name} 的攻击力降低效果结束! 已持续 ${player.originalAttackReductionDuration || 0} 次攻击!`);
                }
            }

            // 处理招架率提升效果持续时间
            if (player.parryChanceDuration > 0) {
                player.parryChanceDuration--;
                if (player.parryChanceDuration === 0) {
                    player.parryChance = 0;
                    log.push(`${player.name} 的招架提升效果结束! 已持续 ${player.originalParryChanceDuration || 0} 次攻击!`);
                }
            }
        });
    }
}