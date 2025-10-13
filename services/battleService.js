// 战斗服务模块
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let defaultBalanceAdjustments = {};
try {
    const balanceConfigPath = resolve(__dirname, '../config/balanceAdjustments.json');
    const fileContent = readFileSync(balanceConfigPath, 'utf-8');
    defaultBalanceAdjustments = JSON.parse(fileContent);
} catch (error) {
    defaultBalanceAdjustments = {};
}

const BASE_BALANCE_ADJUSTMENTS = {
    attackAdvantageMitigation: 0.12,
    attackMitigationCeiling: 0.35,
    defenseAdvantageMitigation: 0.18,
    defenseMitigationCeiling: 0.32,
    minimumDamageScalar: 0.15,
    critBaseBonus: 0.5,
    critDamageMitigation: 0.08,
    critMitigationCeiling: 0.25,
    attackOverageThreshold: 18,
    attackOverageDivisor: 80,
    attackOveragePenalty: 0.18,
    defenseOverageThreshold: 22,
    defenseOveragePenalty: 0.12,
    ...defaultBalanceAdjustments
};

export class BattleService {
    constructor(options = {}) {
        this.player1 = null;
        this.player2 = null;
        this.p1Stunned = false;
        this.p2Stunned = false;
        this.updatePlayerInfoCallback = null;
        this.balanceAdjustments = {
            ...BASE_BALANCE_ADJUSTMENTS,
            ...(options.balanceAdjustments || {})
        };
    }

    setPlayers(player1, player2, updateCallback) {
        this.player1 = player1;
        this.player2 = player2;
        this.p1Stunned = false;
        this.p2Stunned = false;
        this.updatePlayerInfoCallback = updateCallback;
    }

    updatePlayerUI() {
        if (this.updatePlayerInfoCallback) {
            this.updatePlayerInfoCallback(this.player1, true);
            this.updatePlayerInfoCallback(this.player2, false);
        }
    }

    async battle(logCallback) {
        const log = [];
        let round = 1;

        this.p1Stunned = false;
        this.p2Stunned = false;

        this.appendLog(log, logCallback, '=======================================', '战斗开始!');

        while (this.playersAlive()) {
            this.appendLog(log, logCallback, `\n第 ${round} 回合:`);
            round++;

            await this.delay(600);
            const statusMessages = this.handleStatusEffects();
            if (statusMessages.length) {
                this.appendLog(log, logCallback, ...statusMessages);
            }
            this.updatePlayerUI();

            if (!this.playersAlive()) {
                break;
            }

            const order = this.getAttackOrder();
            for (const attacker of order) {
                if (!this.playersAlive()) {
                    break;
                }

                const defender = attacker === this.player1 ? this.player2 : this.player1;
                const attackMessages = await this.executeSingleAttack(attacker, defender);
                if (attackMessages.length) {
                    this.appendLog(log, logCallback, ...attackMessages);
                }
                this.updatePlayerUI();

                if (!this.playersAlive()) {
                    break;
                }

                await this.delay(750);
            }
        }

        const winnerMessage = (this.player1.health <= 0 && this.player2.health <= 0)
            ? '双方同归于尽! 平局!'
            : `${(this.player1.health > this.player2.health ? this.player1 : this.player2).name} 胜利!`;
        this.appendLog(log, logCallback, '=======================================', winnerMessage);
        return log.join('\n');
    }

    getAttackOrder() {
        const speedDiff = Math.abs(this.player1.speed - this.player2.speed);
        if (speedDiff < 1) {
            return Math.random() < 0.5 ? [this.player1, this.player2] : [this.player2, this.player1];
        }
        return this.player1.speed >= this.player2.speed
            ? [this.player1, this.player2]
            : [this.player2, this.player1];
    }

    async executeSingleAttack(attacker, defender) {
        const messages = [];
        const stunnedFlag = attacker === this.player1 ? 'p1Stunned' : 'p2Stunned';

        if (this[stunnedFlag]) {
            messages.push(`${attacker.name}被眩晕了，无法行动!`);
            this[stunnedFlag] = false;
            return messages;
        }

        if (attacker.freeze) {
            messages.push(`${attacker.name}被冰冻了，无法行动!`);
            attacker.freeze = false;
            return messages;
        }

        const attackResult = this.attackEnemy(attacker, defender);
        if (attackResult?.log?.length) {
            messages.push(...attackResult.log);
        }

        return messages;
    }

    appendLog(log, logCallback, ...lines) {
        const filteredLines = lines.filter(line => typeof line === 'string' && line.trim() !== '');
        if (!filteredLines.length) {
            return;
        }
        log.push(...filteredLines);
        if (typeof logCallback === 'function') {
            logCallback(log.join('\n'));
        }
    }

    playersAlive() {
        return this.player1.health > 0 && this.player2.health > 0;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    attackEnemy(attacker, defender) {
        const log = [];

        if (attacker.freeze) {
            log.push(`${attacker.name}被冰冻了，无法攻击且无法触发技能!`);
            attacker.freeze = false;
            return { log };
        }

        const adjustments = this.balanceAdjustments;

        const combinedStats = Math.max(attacker.attack + defender.defense, 1);
        const defenseAdvantage = Math.max(0, defender.defense - attacker.attack);

        const defenseMitigationRatio = defenseAdvantage / combinedStats;
        const defenseMitigation = 1 - Math.min(
            adjustments.defenseMitigationCeiling,
            defenseMitigationRatio * adjustments.defenseAdvantageMitigation
        );

        let defenseEffectiveness = defender.defense / (defender.defense + 50);
        defenseEffectiveness *= Math.max(defenseMitigation, 0.5);

        const defenseOverageThreshold = adjustments.defenseOverageThreshold ?? 22;
        const defenseOveragePenalty = adjustments.defenseOveragePenalty ?? 0.12;
        const defenseOverage = Math.max(0, defender.defense - (attacker.attack + defenseOverageThreshold));
        if (defenseOverage > 0 && defenseOveragePenalty > 0) {
            const defensePressure = Math.min(0.45, (defenseOverage / (defenseOverageThreshold + 50)) * defenseOveragePenalty);
            defenseEffectiveness *= Math.max(1 - defensePressure, 0.4);
        }

        if (defender.armorPenetration) {
            const effectiveDefense = defender.defense * (1 - defender.armorPenetration);
            defenseEffectiveness = effectiveDefense / (effectiveDefense + 50);
            log.push(`${defender.name} 破防效果生效! 防御效果降低了 ${Math.floor(defender.armorPenetration * 100)}%!`);
        }

        const minimumDamageScalar = Math.max(adjustments.minimumDamageScalar || 0.15, 0.05);
        let damage = attacker.attack * (1 - defenseEffectiveness);
        damage = Math.max(damage, attacker.attack * minimumDamageScalar);
        damage = Math.floor(damage);
        damage = Math.max(damage, 1);

        let isCritical = false;
        if (Math.random() < attacker.critChance) {
            isCritical = true;
            const attackAdvantage = Math.max(0, attacker.attack - defender.defense);
            const attackAdvantageRatio = attackAdvantage / combinedStats;
            const critMitigation = 1 - Math.min(
                adjustments.critMitigationCeiling,
                attackAdvantageRatio * (adjustments.critDamageMitigation || 0)
            );
            const critBonus = Math.max(adjustments.critBaseBonus || 0.5, 0.1) * Math.max(critMitigation, 0.4);
            damage = Math.floor(damage * (1 + critBonus));
            log.push(`${attacker.name} 触发了会心! 伤害提升至 ${damage}`);
        }

        const parryChance = defender.parryChance || 0;
        if (Math.random() < parryChance) {
            log.push(`${defender.name} 触发了招架! 完全免疫本次伤害!`);
            damage = 0;
        }

        if (damage > 0) {
            const attackAdvantage = Math.max(0, attacker.attack - defender.defense);
            const attackAdvantageRatio = attackAdvantage / combinedStats;
            const attackMitigation = 1 - Math.min(
                adjustments.attackMitigationCeiling,
                attackAdvantageRatio * (adjustments.attackAdvantageMitigation || 0)
            );
            const mitigatedDamage = Math.floor(damage * Math.max(attackMitigation, 0.5));
            const minDamageFloor = Math.max(Math.floor(attacker.attack * minimumDamageScalar), 1);
            damage = Math.max(mitigatedDamage, minDamageFloor);

            const overageThreshold = adjustments.attackOverageThreshold ?? 18;
            const overagePenalty = adjustments.attackOveragePenalty ?? 0.18;
            const overageDivisor = adjustments.attackOverageDivisor ?? 80;
            const attackOverage = Math.max(0, attacker.attack - (defender.defense + overageThreshold));
            if (attackOverage > 0 && overagePenalty > 0 && overageDivisor > 0) {
                const overageRatio = Math.min(overagePenalty, attackOverage / overageDivisor);
                const penalizedDamage = Math.floor(damage * (1 - overageRatio));
                damage = Math.max(penalizedDamage, minDamageFloor);
            }
        }

        let skillTriggered = false;
        if (!attacker.taunted) {
            const skillChance = attacker.skill.chance || 0.1;
            skillTriggered = Math.random() < skillChance;
        } else {
            log.push(`${attacker.name} 被嘲讽了，无法触发技能!`);
        }

        if (skillTriggered) {
            log.push(`${attacker.name} 触发了技能: ${attacker.skill.name}!`);

            if (attacker.skill.damageMultiplier) {
                damage *= attacker.skill.damageMultiplier;
                log.push(`造成了 ${attacker.skill.damageMultiplier} 倍伤害!`);
            } else if (attacker.skill.extraAttack) {
                defender.health -= damage;
                log.push(`${attacker.name} 攻击了 ${defender.name}，造成 ${damage} 点伤害! ${defender.name} 剩余生命值: ${Math.max(defender.health, 0)}`);
                const extraDamage = attacker.attack - defender.defense / 2;
                damage = Math.max(extraDamage, 1);
                if (isCritical) damage = Math.floor(damage * 1.5);
                log.push(`${attacker.name} 连击!`);
            } else if (attacker.skill.defenseBoost) {
                attacker.defense += attacker.skill.defenseBoost;
                attacker.defenseBoostDuration = attacker.skill.turns;
                attacker.originalDefenseBoostDuration = attacker.skill.turns;
                log.push(`${attacker.name} 防御力提高了 ${attacker.skill.defenseBoost} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.lifeSteal) {
                const heal = Math.floor(damage * attacker.skill.lifeSteal);
                attacker.health = Math.min(attacker.health + heal, attacker.maxHealth);
                log.push(`${attacker.name} 吸取了 ${heal} 点生命值!`);
            } else if (attacker.skill.stunChance) {
                if (Math.random() < attacker.skill.stunChance) {
                    log.push(`${defender.name} 被眩晕了!`);
                    if (defender.name === this.player1.name) this.p1Stunned = true;
                    else if (defender.name === this.player2.name) this.p2Stunned = true;
                } else {
                    log.push(`${defender.name} 成功抵抗了眩晕效果!`);
                }
            } else if (attacker.skill.attackBoost) {
                attacker.attack += attacker.skill.attackBoost;
                attacker.defense -= attacker.skill.defensePenalty;
                attacker.attackBoostDuration = attacker.skill.turns;
                attacker.originalAttackBoostDuration = attacker.skill.turns;
                log.push(`${attacker.name} 进入狂暴状态! 攻击提高 ${attacker.skill.attackBoost} 点，防御降低 ${attacker.skill.defensePenalty} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.healAmount) {
                const missingHealth = attacker.maxHealth - attacker.health;
                const healAmount = Math.floor(missingHealth * attacker.skill.healAmount);
                attacker.health = Math.min(attacker.health + healAmount, attacker.maxHealth);
                log.push(`${attacker.name} 恢复了 ${healAmount} 点生命值!`);
                return { log };
            } else if (attacker.skill.critChanceBoost) {
                attacker.critChance += attacker.skill.critChanceBoost;
                attacker.critChanceBoostValue = attacker.skill.critChanceBoost;
                attacker.critChanceBoostDuration = attacker.skill.turns;
                attacker.originalCritChanceBoostDuration = attacker.skill.turns;
                log.push(`${attacker.name} 聚气效果触发! 会心几率提高了 ${Math.floor(attacker.skill.critChanceBoost * 100)}%，持续 ${attacker.skill.turns || 0} 回合!`);
            } else if (attacker.skill.armorPenetration) {
                defender.armorPenetration = attacker.skill.armorPenetration;
                defender.armorPenetrationDuration = attacker.skill.turns;
                defender.originalArmorPenetrationDuration = attacker.skill.turns;
                log.push(`${defender.name} 破防效果触发! 防御力被无视 ${Math.floor(attacker.skill.armorPenetration * 100)}%，持续 ${attacker.skill.turns || 0} 回合!`);
            } else if (attacker.skill.poisonDamage) {
                defender.poison = attacker.skill.turns;
                defender.originalPoisonDuration = attacker.skill.turns;
                const poisonDamage = Math.floor(defender.maxHealth * attacker.skill.poisonDamage);
                log.push(`${defender.name} 中毒了，将在 ${attacker.skill.turns || 0} 回合内每回合受到 ${poisonDamage} 点伤害!`);
            } else if (attacker.skill.burnDamage) {
                defender.burn = attacker.skill.turns;
                defender.originalBurnDuration = attacker.skill.turns;
                log.push(`${defender.name} 燃烧了，将在 ${attacker.skill.turns || 0} 回合内每回合受到 ${attacker.skill.burnDamage} 点伤害!`);
            } else if (attacker.skill.freezeChance) {
                if (Math.random() < attacker.skill.freezeChance) {
                    defender.freeze = true;
                    defender.freezeDuration = attacker.skill.turns;
                    defender.originalFreezeDuration = attacker.skill.turns;
                    log.push(`${defender.name} 被冰冻了，${attacker.skill.turns || 0} 次攻击无法施展且无法触发技能!`);
                } else {
                    log.push(`${defender.name} 成功抵抗了冰冻效果!`);
                }
            } else if (attacker.skill.taunt) {
                defender.taunted = true;
                defender.tauntDuration = attacker.skill.turns;
                defender.originalTauntDuration = attacker.skill.turns;
                log.push(`${defender.name} 被嘲讽了，${attacker.skill.turns || 0} 次攻击只能攻击${attacker.name}且无法触发技能!`);
            } else if (attacker.skill.damageReflection) {
                attacker.reflection = attacker.skill.damageReflection;
                attacker.reflectionDuration = attacker.skill.turns;
                attacker.originalReflectionDuration = attacker.skill.turns;
                log.push(`${attacker.name} 获得了伤害反射效果，将反射 ${Math.floor(attacker.skill.damageReflection * 100)}% 的伤害，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.shieldAmount) {
                const shieldAmount = Math.floor(attacker.maxHealth * attacker.skill.shieldAmount);
                attacker.shield += shieldAmount;
                log.push(`${attacker.name} 获得了 ${shieldAmount} 点护盾!`);
            } else if (attacker.skill.parryBoost) {
                attacker.parryChance = (attacker.parryChance || 0) + attacker.skill.parryBoost;
                attacker.parryChanceDuration = attacker.skill.turns;
                attacker.originalParryChanceDuration = attacker.skill.turns;
                log.push(`${attacker.name} 获得了招架提升效果，招架率增加 ${Math.floor(attacker.skill.parryBoost * 100)}%，持续${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.speedBoost) {
                attacker.speed += attacker.skill.speedBoost;
                attacker.speedBoostDuration = attacker.skill.turns;
                attacker.originalSpeedBoostDuration = attacker.skill.turns;
                log.push(`${attacker.name} 获得了速度提升效果，速度增加 ${attacker.skill.speedBoost} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            } else if (attacker.skill.attackReduction) {
                defender.attack -= attacker.skill.attackReduction;
                defender.attackReductionDuration = attacker.skill.turns;
                defender.originalAttackReductionDuration = attacker.skill.turns;
                defender.originalAttackReductionValue = attacker.skill.attackReduction;
                log.push(`${defender.name} 受到了化劲效果影响，攻击力降低 ${attacker.skill.attackReduction} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
            }
        }

        if (defender.shield > 0) {
            const shieldAbsorb = Math.min(damage, defender.shield);
            defender.shield -= shieldAbsorb;
            damage -= shieldAbsorb;
            log.push(`${defender.name} 的护盾吸收了 ${shieldAbsorb} 点伤害，剩余护盾: ${defender.shield}`);
        }

        defender.health -= damage;
        defender.health = Math.max(defender.health, 0);
        log.push(`${attacker.name} 攻击了 ${defender.name}，造成 ${damage} 点伤害! ${defender.name} 剩余生命值: ${defender.health}`);

        this.updatePlayerUI();

        if (defender.reflection > 0) {
            const reflectDamage = Math.floor(damage * defender.reflection);
            attacker.health = Math.max(attacker.health - reflectDamage, 0);
            log.push(`${defender.name} 反射了 ${reflectDamage} 点伤害给 ${attacker.name}，${attacker.name} 剩余生命值: ${attacker.health}`);

            defender.reflectionDuration--;
            if (defender.reflectionDuration === 0) {
                defender.reflection = 0;
                log.push(`${defender.name} 的伤害反射效果结束! 已持续 ${defender.originalReflectionDuration || 0} 次攻击!`);
            }

            this.updatePlayerUI();
        }

        return { log };
    }

    handleStatusEffects() {
        const messages = [];
        [this.player1, this.player2].forEach(player => {
            if (player.poison > 0) {
                const poisonDamage = Math.floor(player.maxHealth * 0.1);
                player.health = Math.max(player.health - poisonDamage, 0);
                messages.push(`${player.name} 中毒了，受到 ${poisonDamage} 点伤害，剩余生命值: ${player.health}`);
                player.poison--;
            }

            if (player.defenseBoostDuration > 0) {
                player.defenseBoostDuration--;
                if (player.defenseBoostDuration === 0) {
                    player.defense -= player.skill?.defenseBoost || 0;
                    messages.push(`${player.name} 的防御提升效果结束! 已持续 ${player.originalDefenseBoostDuration || 0} 次攻击!`);
                }
            }

            if (player.attackBoostDuration > 0) {
                player.attackBoostDuration--;
                if (player.attackBoostDuration === 0) {
                    player.attack -= player.skill?.attackBoost || 0;
                    player.defense += player.skill?.defensePenalty || 0;
                    messages.push(`${player.name} 的狂暴状态结束! 已持续 ${player.skill?.turns || 0} 次攻击! 攻击和防御已恢复正常!`);
                }
            }

            if (player.armorPenetrationDuration > 0) {
                player.armorPenetrationDuration--;
                if (player.armorPenetrationDuration === 0) {
                    player.armorPenetration = 0;
                    messages.push(`${player.name} 的破防效果结束! 已持续 ${player.originalArmorPenetrationDuration || 0} 次攻击! 防御力已恢复正常!`);
                }
            }

            if (player.critChanceBoostDuration > 0) {
                player.critChanceBoostDuration--;
                if (player.critChanceBoostDuration === 0) {
                    player.critChance -= player.critChanceBoostValue || 0;
                    player.critChanceBoostValue = 0;
                    messages.push(`${player.name} 的聚气效果结束! 已持续 ${player.originalCritChanceBoostDuration || 0} 次攻击! 会心几率已恢复正常!`);
                }
            }

            if (player.freezeDuration > 0) {
                player.freezeDuration--;
                if (player.freezeDuration === 0) {
                    player.freeze = false;
                    messages.push(`${player.name} 的冰冻效果结束! 已持续 ${player.originalFreezeDuration || 0} 次攻击!`);
                }
            }

            if (player.tauntDuration > 0) {
                player.tauntDuration--;
                if (player.tauntDuration === 0) {
                    player.taunted = false;
                    messages.push(`${player.name} 的嘲讽效果结束! 已持续 ${player.originalTauntDuration || 0} 次攻击!`);
                }
            }

            if (player.speedBoostDuration > 0) {
                player.speedBoostDuration--;
                if (player.speedBoostDuration === 0) {
                    player.speed -= player.skill?.speedBoost || 0;
                    messages.push(`${player.name} 的速度提升效果结束! 已持续 ${player.originalSpeedBoostDuration || 0} 次攻击!`);
                }
            }

            if (player.attackReductionDuration > 0) {
                player.attackReductionDuration--;
                if (player.attackReductionDuration === 0) {
                    player.attack += player.originalAttackReductionValue || 0;
                    messages.push(`${player.name} 的攻击力降低效果结束! 已持续 ${player.originalAttackReductionDuration || 0} 次攻击!`);
                }
            }

            if (player.parryChanceDuration > 0) {
                player.parryChanceDuration--;
                if (player.parryChanceDuration === 0) {
                    player.parryChance = 0;
                    messages.push(`${player.name} 的招架提升效果结束! 已持续 ${player.originalParryChanceDuration || 0} 次攻击!`);
                }
            }
        });

        return messages;
    }
}
