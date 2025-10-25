// 战斗服务模块
import { compressStructuredLog } from '../utils/logCompression.js';

export class BattleService {
    constructor() {
        this.player1 = null;
        this.player2 = null;
        this.updatePlayerInfoCallback = null;
        this.eventHandlers = {};
        this.randomFn = Math.random;
        this.battleStartTime = 0;
        this.structuredLog = null;
        this.textLogLines = [];
        this.compressedLog = null;
        this.currentRound = null;
    }

    setPlayers(player1, player2, updateCallback) {
        this.player1 = player1;
        this.player2 = player2;
        this.updatePlayerInfoCallback = updateCallback;
    }

    setEventHandlers(handlers = {}) {
        this.eventHandlers = { ...handlers };
    }

    emitEvent(eventName, payload) {
        const handler = this.eventHandlers?.[eventName];
        if (typeof handler === 'function') {
            handler(payload);
        }
    }

    setRandomGenerator(randomFn) {
        if (typeof randomFn === 'function') {
            this.randomFn = randomFn;
        } else {
            this.randomFn = Math.random;
        }
    }

    random() {
        try {
            const value = this.randomFn?.();
            if (typeof value === 'number' && value >= 0 && value <= 1) {
                return value;
            }
        } catch (error) {
            // ignore and fall back to Math.random
        }
        return Math.random();
    }

    getSkillName(skillOrName) {
        if (!skillOrName) {
            return '';
        }
        if (typeof skillOrName === 'string') {
            return skillOrName;
        }
        if (typeof skillOrName === 'object' && skillOrName !== null) {
            return skillOrName.name || '';
        }
        return '';
    }

    formatSkillReference(skillOrName, fallback = '技能效果') {
        const name = this.getSkillName(skillOrName)?.trim();
        if (!name) {
            return fallback;
        }
        return `技能「${name}」`;
    }

    updatePlayerUI() {
        if (this.updatePlayerInfoCallback) {
            this.updatePlayerInfoCallback(this.player1, true);
            this.updatePlayerInfoCallback(this.player2, false);
        }
    }

    async battle(logCallback) {
        const log = [];
        this.textLogLines = log;
        let round = 1;

        this.initStructuredLog();
        this.recordKeyframe('battle_start', {
            players: this.capturePlayerStates()
        });

        this.emitEvent('onBattleStart', { player1: this.player1, player2: this.player2 });
        this.appendLog(log, logCallback, '=======================================', '战斗开始!');

        while (this.playersAlive()) {
            this.currentRound = round;
            this.emitEvent('onRoundStart', { round });
            this.recordKeyframe('round_start', {
                round,
                snapshot: this.capturePlayerStates()
            });
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
            this.recordEvent('turn_order', {
                parameters: {
                    round: this.currentRound,
                    order: order.map((entity) => this.createEntityReference(entity))
                }
            });
            for (const attacker of order) {
                if (!this.playersAlive()) {
                    break;
                }

                const defender = attacker === this.player1 ? this.player2 : this.player1;
                this.recordKeyframe('attack_phase', {
                    round: this.currentRound,
                    attacker: this.createEntityReference(attacker),
                    defender: this.createEntityReference(defender)
                });
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

        const bothDefeated = this.player1.health <= 0 && this.player2.health <= 0;
        const winner = bothDefeated ? null : (this.player1.health > this.player2.health ? this.player1 : this.player2);
        const roundsCompleted = Math.max(0, round - 1);
        const winnerMessage = bothDefeated
            ? '双方同归于尽! 平局!'
            : `${winner?.name ?? ''} 胜利!`;
        this.recordKeyframe('battle_end', {
            winner: this.createEntityReference(winner),
            rounds: roundsCompleted,
            snapshot: this.capturePlayerStates()
        });
        this.appendLog(log, logCallback, '=======================================', winnerMessage, { finalize: true });
        this.emitEvent('onBattleEnd', {
            winner,
            isDraw: !winner,
            rounds: roundsCompleted,
            player1: this.player1,
            player2: this.player2,
            log: log.join('\n'),
            structuredLog: this.structuredLog,
            compressedLog: this.compressedLog || compressStructuredLog(this.structuredLog)
        });
        this.currentRound = null;
        return {
            text: log.join('\n'),
            structured: this.structuredLog,
            compressed: this.compressedLog || compressStructuredLog(this.structuredLog)
        };
    }

    getAttackOrder() {
        const speedDiff = Math.abs(this.player1.speed - this.player2.speed);
        if (speedDiff < 1) {
            return this.random() < 0.5 ? [this.player1, this.player2] : [this.player2, this.player1];
        }
        return this.player1.speed >= this.player2.speed
            ? [this.player1, this.player2]
            : [this.player2, this.player1];
    }

    async executeSingleAttack(attacker, defender) {
        const messages = [];
        if (attacker.freeze) {
            const freezeSkillRef = this.formatSkillReference(attacker.freezeSourceSkillName, '技能效果');
            messages.push(`${attacker.name}受到${freezeSkillRef}影响被冰冻，无法行动!`);
            const wasFrozen = Boolean(attacker.freeze);
            attacker.freeze = false;
            if (wasFrozen) {
                this.recordStateChange(attacker, 'freeze', true, false, {
                    round: this.currentRound,
                    reason: 'freeze_consumed'
                });
            }
            this.recordEvent('action_blocked', {
                actor: this.createEntityReference(attacker),
                parameters: {
                    round: this.currentRound,
                    reason: 'freeze'
                }
            });
            return messages;
        }

        const attackResult = this.attackEnemy(attacker, defender);
        if (attackResult?.log?.length) {
            messages.push(...attackResult.log);
        }

        return messages;
    }

    appendLog(log, logCallback, ...lines) {
        let options = {};
        if (lines.length) {
            const potentialOptions = lines[lines.length - 1];
            if (potentialOptions && typeof potentialOptions === 'object' && !Array.isArray(potentialOptions)) {
                options = potentialOptions;
                lines = lines.slice(0, -1);
            }
        }

        const filteredLines = lines.filter(line => typeof line === 'string' && line.trim() !== '');
        if (!filteredLines.length) {
            if (options.finalize) {
                this.notifyLogUpdate(logCallback, { finalize: true });
            }
            return;
        }
        log.push(...filteredLines);
        this.notifyLogUpdate(logCallback, { finalize: options.finalize });
    }

    playersAlive() {
        return this.player1.health > 0 && this.player2.health > 0;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    attackEnemy(attacker, defender) {
        const log = [];
        const defenderHealthInitial = defender.health;
        const attackerHealthInitial = attacker.health;
        let shieldAbsorb = 0;
        let reflectionDamage = 0;

        if (attacker.freeze) {
            const freezeSkillRef = this.formatSkillReference(attacker.freezeSourceSkillName, '技能效果');
            log.push(`${attacker.name}受到${freezeSkillRef}影响被冰冻，无法攻击且无法触发技能!`);
            const wasFrozen = Boolean(attacker.freeze);
            attacker.freeze = false;
            if (wasFrozen) {
                this.recordStateChange(attacker, 'freeze', true, false, {
                    round: this.currentRound,
                    reason: 'freeze_consumed_before_attack'
                });
            }
            this.recordEvent('action_blocked', {
                actor: this.createEntityReference(attacker),
                parameters: {
                    round: this.currentRound,
                    reason: 'freeze'
                }
            });
            return { log };
        }

        let defenseEffectiveness = defender.defense / (defender.defense + 50);

        if (defender.armorPenetration) {
            const effectiveDefense = defender.defense * (1 - defender.armorPenetration);
            defenseEffectiveness = effectiveDefense / (effectiveDefense + 50);
            const armorPenSkillRef = this.formatSkillReference(defender.armorPenetrationSourceSkillName, '技能效果');
            log.push(`${armorPenSkillRef}在${defender.name}身上生效，防御效果降低了 ${Math.floor(defender.armorPenetration * 100)}%!`);
            this.recordEvent('status_effect', {
                actor: this.createEntityReference(defender),
                parameters: {
                    round: this.currentRound,
                    type: 'armor_penetration_active',
                    value: defender.armorPenetration
                }
            });
        }

        let damage = Math.max(attacker.attack * (1 - defenseEffectiveness), attacker.attack * 0.15);
        damage = Math.floor(damage);
        damage = Math.max(damage, 1);

        let isCritical = false;
        if (this.random() < attacker.critChance) {
            isCritical = true;
            damage = Math.floor(damage * 1.5);
            log.push(`${attacker.name} 触发了会心! 伤害提升至 ${damage}`);
            this.recordEvent('critical_hit', {
                actor: this.createEntityReference(attacker),
                target: this.createEntityReference(defender),
                parameters: {
                    round: this.currentRound,
                    damage
                }
            });
        }

        const parryChance = defender.parryChance || 0;
        if (this.random() < parryChance) {
            log.push(`${defender.name} 触发了招架! 完全免疫本次伤害!`);
            damage = 0;
            this.recordEvent('parry', {
                actor: this.createEntityReference(defender),
                target: this.createEntityReference(attacker),
                parameters: {
                    round: this.currentRound
                }
            });
        }

        let skillTriggered = false;
        if (!attacker.taunted) {
            const skillChance = attacker.skill.chance || 0.1;
            skillTriggered = this.random() < skillChance;
        } else {
            const tauntSkillRef = this.formatSkillReference(attacker.tauntSourceSkillName, '技能效果');
            log.push(`${attacker.name}受到${tauntSkillRef}影响被嘲讽，无法触发技能!`);
            this.recordEvent('taunt_block', {
                actor: this.createEntityReference(attacker),
                target: this.createEntityReference(defender),
                parameters: {
                    round: this.currentRound
                }
            });
        }

        if (skillTriggered) {
            log.push(`${attacker.name} 触发了${this.formatSkillReference(attacker.skill)}!`);
            this.recordEvent('skill_triggered', {
                actor: this.createEntityReference(attacker),
                target: this.createEntityReference(defender),
                parameters: {
                    round: this.currentRound,
                    skill: attacker.skill.name
                }
            });

            if (attacker.skill.damageMultiplier) {
                damage *= attacker.skill.damageMultiplier;
                log.push(`${this.formatSkillReference(attacker.skill)}使伤害提高至 ${attacker.skill.damageMultiplier} 倍!`);
                this.recordEvent('skill_effect', {
                    actor: this.createEntityReference(attacker),
                    target: this.createEntityReference(defender),
                    parameters: {
                        round: this.currentRound,
                        skill: attacker.skill.name,
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
                log.push(`${this.formatSkillReference(attacker.skill)}触发，${attacker.name}发动连击!`);
                this.recordStateChange(defender, 'health', beforeFirstStrike, Math.max(defender.health, 0), {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    cause: 'extra_attack_initial'
                });
                this.recordEvent('skill_effect', {
                    actor: this.createEntityReference(attacker),
                    target: this.createEntityReference(defender),
                    parameters: {
                        round: this.currentRound,
                        skill: attacker.skill.name,
                        type: 'extra_attack'
                    }
                });
            } else if (attacker.skill.defenseBoost) {
                const previousDefense = attacker.defense;
                attacker.defense += attacker.skill.defenseBoost;
                attacker.defenseBoostDuration = attacker.skill.turns;
                attacker.originalDefenseBoostDuration = attacker.skill.turns;
                attacker.defenseBoostSkillName = this.getSkillName(attacker.skill);
                attacker.defenseBoostValue = attacker.skill.defenseBoost;
                log.push(`${this.formatSkillReference(attacker.skill)}为${attacker.name}提供防御力加成，提高 ${attacker.skill.defenseBoost} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
                this.recordStateChange(attacker, 'defense', previousDefense, attacker.defense, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.lifeSteal) {
                const heal = Math.floor(damage * attacker.skill.lifeSteal);
                const previousHealth = attacker.health;
                attacker.health = Math.min(attacker.health + heal, attacker.maxHealth);
                log.push(`${this.formatSkillReference(attacker.skill)}使${attacker.name}吸取了 ${heal} 点生命值!`);
                this.recordStateChange(attacker, 'health', previousHealth, attacker.health, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name,
                    type: 'life_steal'
                });
            } else if (attacker.skill.attackBoost) {
                const previousAttack = attacker.attack;
                const previousDefense = attacker.defense;
                attacker.attack += attacker.skill.attackBoost;
                attacker.defense -= attacker.skill.defensePenalty;
                attacker.attackBoostDuration = attacker.skill.turns;
                attacker.originalAttackBoostDuration = attacker.skill.turns;
                attacker.attackBoostSkillName = this.getSkillName(attacker.skill);
                attacker.attackBoostValue = attacker.skill.attackBoost;
                attacker.attackBoostDefensePenalty = attacker.skill.defensePenalty;
                log.push(`${this.formatSkillReference(attacker.skill)}使${attacker.name}进入狂暴状态! 攻击提高 ${attacker.skill.attackBoost} 点，防御降低 ${attacker.skill.defensePenalty} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
                this.recordStateChange(attacker, 'attack', previousAttack, attacker.attack, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
                this.recordStateChange(attacker, 'defense', previousDefense, attacker.defense, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.healAmount) {
                const missingHealth = attacker.maxHealth - attacker.health;
                const healAmount = Math.floor(missingHealth * attacker.skill.healAmount);
                const previousHealth = attacker.health;
                attacker.health = Math.min(attacker.health + healAmount, attacker.maxHealth);
                log.push(`${this.formatSkillReference(attacker.skill)}使${attacker.name}恢复了 ${healAmount} 点生命值!`);
                this.recordStateChange(attacker, 'health', previousHealth, attacker.health, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name,
                    type: 'heal'
                });
                return { log };
            } else if (attacker.skill.critChanceBoost) {
                const previousCrit = attacker.critChance;
                attacker.critChance += attacker.skill.critChanceBoost;
                attacker.critChanceBoostValue = attacker.skill.critChanceBoost;
                attacker.critChanceBoostDuration = attacker.skill.turns;
                attacker.originalCritChanceBoostDuration = attacker.skill.turns;
                attacker.critChanceBoostSkillName = this.getSkillName(attacker.skill);
                log.push(`${this.formatSkillReference(attacker.skill)}提升了${attacker.name}的会心几率 ${Math.floor(attacker.skill.critChanceBoost * 100)}%，持续 ${attacker.skill.turns || 0} 回合!`);
                this.recordStateChange(attacker, 'critChance', previousCrit, attacker.critChance, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.armorPenetration) {
                const previousArmorPenetration = defender.armorPenetration || 0;
                defender.armorPenetration = attacker.skill.armorPenetration;
                defender.armorPenetrationDuration = attacker.skill.turns;
                defender.originalArmorPenetrationDuration = attacker.skill.turns;
                defender.armorPenetrationSourceSkillName = this.getSkillName(attacker.skill);
                log.push(`${this.formatSkillReference(attacker.skill)}令${defender.name}的防御被无视 ${Math.floor(attacker.skill.armorPenetration * 100)}%，持续 ${attacker.skill.turns || 0} 回合!`);
                this.recordStateChange(defender, 'armorPenetration', previousArmorPenetration, defender.armorPenetration, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.poisonDamage) {
                const previousPoison = defender.poison || 0;
                defender.poison = attacker.skill.turns;
                defender.originalPoisonDuration = attacker.skill.turns;
                defender.poisonSource = {
                    name: attacker.name,
                    role: attacker.role,
                    skillName: this.getSkillName(attacker.skill)
                };
                const poisonDamage = Math.floor(defender.maxHealth * attacker.skill.poisonDamage);
                log.push(`${this.formatSkillReference(attacker.skill)}让${defender.name}中毒，将在 ${attacker.skill.turns || 0} 回合内每回合受到 ${poisonDamage} 点伤害!`);
                this.recordStateChange(defender, 'poison', previousPoison, defender.poison, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.freezeChance) {
                if (this.random() < attacker.skill.freezeChance) {
                    const previousFreeze = Boolean(defender.freeze);
                    defender.freeze = true;
                    defender.freezeDuration = attacker.skill.turns;
                    defender.originalFreezeDuration = attacker.skill.turns;
                    defender.freezeSourceSkillName = this.getSkillName(attacker.skill);
                    log.push(`${this.formatSkillReference(attacker.skill)}令${defender.name}被冰冻，${attacker.skill.turns || 0} 次攻击无法施展且无法触发技能!`);
                    this.recordStateChange(defender, 'freeze', previousFreeze, defender.freeze, {
                        round: this.currentRound,
                        source: this.createEntityReference(attacker),
                        skill: attacker.skill.name
                    });
                } else {
                    log.push(`${defender.name} 成功抵抗了${this.formatSkillReference(attacker.skill)}的冰冻效果!`);
                }
            } else if (attacker.skill.taunt) {
                const previousTaunt = Boolean(defender.taunted);
                defender.taunted = true;
                defender.tauntDuration = attacker.skill.turns;
                defender.originalTauntDuration = attacker.skill.turns;
                defender.tauntSourceSkillName = this.getSkillName(attacker.skill);
                log.push(`${this.formatSkillReference(attacker.skill)}嘲讽了${defender.name}，${attacker.skill.turns || 0} 次攻击只能攻击${attacker.name}且无法触发技能!`);
                this.recordStateChange(defender, 'taunted', previousTaunt, defender.taunted, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.damageReflection) {
                const previousReflection = attacker.reflection || 0;
                attacker.reflection = attacker.skill.damageReflection;
                attacker.reflectionDuration = attacker.skill.turns;
                attacker.originalReflectionDuration = attacker.skill.turns;
                attacker.reflectionSkillName = this.getSkillName(attacker.skill);
                log.push(`${this.formatSkillReference(attacker.skill)}为${attacker.name}赋予伤害反射效果，将反射 ${Math.floor(attacker.skill.damageReflection * 100)}% 的伤害，持续 ${attacker.skill.turns || 0} 次攻击!`);
                this.recordStateChange(attacker, 'reflection', previousReflection, attacker.reflection, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.shieldAmount) {
                const shieldAmount = Math.floor(attacker.maxHealth * attacker.skill.shieldAmount);
                const previousShield = attacker.shield || 0;
                attacker.shield += shieldAmount;
                attacker.shieldSkillName = this.getSkillName(attacker.skill);
                log.push(`${this.formatSkillReference(attacker.skill)}为${attacker.name}提供了${shieldAmount} 点护盾!`);
                this.recordStateChange(attacker, 'shield', previousShield, attacker.shield, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.parryBoost) {
                const previousParry = attacker.parryChance || 0;
                attacker.parryChance = (attacker.parryChance || 0) + attacker.skill.parryBoost;
                attacker.parryChanceDuration = attacker.skill.turns;
                attacker.originalParryChanceDuration = attacker.skill.turns;
                attacker.parryBoostSkillName = this.getSkillName(attacker.skill);
                log.push(`${this.formatSkillReference(attacker.skill)}提升了${attacker.name}的招架率 ${Math.floor(attacker.skill.parryBoost * 100)}%，持续${attacker.skill.turns || 0} 次攻击!`);
                this.recordStateChange(attacker, 'parryChance', previousParry, attacker.parryChance, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            } else if (attacker.skill.attackReduction) {
                const previousAttack = defender.attack;
                defender.attack -= attacker.skill.attackReduction;
                defender.attackReductionDuration = attacker.skill.turns;
                defender.originalAttackReductionDuration = attacker.skill.turns;
                defender.originalAttackReductionValue = attacker.skill.attackReduction;
                defender.attackReductionSkillName = this.getSkillName(attacker.skill);
                log.push(`${this.formatSkillReference(attacker.skill)}削弱了${defender.name}的攻击力 ${attacker.skill.attackReduction} 点，持续 ${attacker.skill.turns || 0} 次攻击!`);
                this.recordStateChange(defender, 'attack', previousAttack, defender.attack, {
                    round: this.currentRound,
                    source: this.createEntityReference(attacker),
                    skill: attacker.skill.name
                });
            }
        }

        if (defender.shield > 0) {
            shieldAbsorb = Math.min(damage, defender.shield);
            const previousShield = defender.shield;
            defender.shield -= shieldAbsorb;
            damage -= shieldAbsorb;
            const shieldSkillRef = this.formatSkillReference(defender.shieldSkillName, '护盾效果');
            log.push(`来自${shieldSkillRef}的护盾为${defender.name}吸收了 ${shieldAbsorb} 点伤害，剩余护盾: ${defender.shield}`);
            this.recordStateChange(defender, 'shield', previousShield, defender.shield, {
                round: this.currentRound,
                source: this.createEntityReference(attacker),
                cause: 'damage_absorb'
            });
        }

        defender.health -= damage;
        defender.health = Math.max(defender.health, 0);
        log.push(`${attacker.name} 攻击了 ${defender.name}，造成 ${damage} 点伤害! ${defender.name} 剩余生命值: ${defender.health}`);
        this.recordStateChange(defender, 'health', defenderHealthInitial, defender.health, {
            round: this.currentRound,
            source: this.createEntityReference(attacker),
            cause: 'direct_damage'
        });

        this.updatePlayerUI();

        if (defender.reflection > 0) {
            const reflectDamage = Math.floor(damage * defender.reflection);
            const previousHealth = attacker.health;
            attacker.health = Math.max(attacker.health - reflectDamage, 0);
            reflectionDamage = reflectDamage;
            const reflectionSkillRef = this.formatSkillReference(defender.reflectionSkillName, '反射效果');
            log.push(`${reflectionSkillRef}使${defender.name}反射了 ${reflectDamage} 点伤害给 ${attacker.name}，${attacker.name} 剩余生命值: ${attacker.health}`);
            this.recordStateChange(attacker, 'health', previousHealth, attacker.health, {
                round: this.currentRound,
                source: this.createEntityReference(defender),
                cause: 'reflection'
            });

            defender.reflectionDuration--;
            if (defender.reflectionDuration === 0) {
                const previousReflection = defender.reflection;
                defender.reflection = 0;
                const reflectionSkillRef = this.formatSkillReference(defender.reflectionSkillName, '伤害反射效果');
                log.push(`${defender.name}的${reflectionSkillRef}结束! 已持续 ${defender.originalReflectionDuration || 0} 次攻击!`);
                defender.reflectionSkillName = null;
                this.recordStateChange(defender, 'reflection', previousReflection, defender.reflection, {
                    round: this.currentRound,
                    reason: 'reflection_expired'
                });
            }

            this.updatePlayerUI();
            this.emitEvent('onReflection', {
                source: defender,
                target: attacker,
                damage: reflectDamage
            });
            this.recordEvent('damage_reflected', {
                actor: this.createEntityReference(defender),
                target: this.createEntityReference(attacker),
                parameters: {
                    round: this.currentRound,
                    damage: reflectDamage
                }
            });
        }

        const defenderHealthAfter = defender.health;
        const attackerHealthAfter = attacker.health;
        const damageDealt = Math.max(defenderHealthInitial - defenderHealthAfter, 0);
        const reflectedDamageTaken = Math.max(attackerHealthInitial - attackerHealthAfter, 0);

        this.emitEvent('onAttack', {
            attacker,
            defender,
            damage: damageDealt,
            isCritical,
            skillTriggered,
            shieldAbsorbed: shieldAbsorb,
            reflectionDamage: reflectionDamage || reflectedDamageTaken
        });

        this.recordEvent('attack', {
            actor: this.createEntityReference(attacker),
            target: this.createEntityReference(defender),
            parameters: {
                round: this.currentRound,
                damage: damageDealt,
                isCritical,
                skillTriggered,
                shieldAbsorbed: shieldAbsorb,
                reflectionDamage: reflectionDamage || reflectedDamageTaken
            }
        });

        return {
            log,
            damage: damageDealt,
            isCritical,
            skillTriggered
        };
    }

    handleStatusEffects() {
        const messages = [];
        [this.player1, this.player2].forEach(player => {
            if (!player) {
                return;
            }

            if (player.poison > 0) {
                const poisonDamage = Math.floor(player.maxHealth * 0.1);
                const previousHealth = player.health;
                const previousStacks = player.poison;
                player.health = Math.max(player.health - poisonDamage, 0);
                player.poison = Math.max(player.poison - 1, 0);
                const poisonSkillRef = this.formatSkillReference(player.poisonSource?.skillName, '技能效果');
                messages.push(`${player.name} 受到${poisonSkillRef}影响持续中毒，损失 ${poisonDamage} 点生命值，剩余生命值: ${player.health}`);
                this.emitEvent('onStatusEffect', {
                    target: player,
                    type: 'poison',
                    damage: poisonDamage,
                    source: player.poisonSource || null
                });
                this.recordStateChange(player, 'health', previousHealth, player.health, {
                    round: this.currentRound,
                    type: 'poison',
                    source: player.poisonSource || null
                });
                this.recordStateChange(player, 'poison', previousStacks, player.poison, {
                    round: this.currentRound,
                    type: 'poison_duration'
                });
                this.recordEvent('status_tick', {
                    actor: this.createEntityReference(player.poisonSource || null),
                    target: this.createEntityReference(player),
                    parameters: {
                        round: this.currentRound,
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
                    const defenseSkillRef = this.formatSkillReference(player.defenseBoostSkillName, '防御提升效果');
                    messages.push(`${player.name}的${defenseSkillRef}结束! 已持续 ${player.originalDefenseBoostDuration || 0} 次攻击!`);
                    player.defenseBoostSkillName = null;
                    player.defenseBoostValue = 0;
                    this.recordStateChange(player, 'defense', previousDefense, player.defense, {
                        round: this.currentRound,
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
                    const attackBoostSkillRef = this.formatSkillReference(player.attackBoostSkillName, '狂暴状态');
                    messages.push(`${player.name}的${attackBoostSkillRef}结束! 已持续 ${player.originalAttackBoostDuration || player.skill?.turns || 0} 次攻击! 攻击和防御已恢复正常!`);
                    player.attackBoostSkillName = null;
                    player.attackBoostValue = 0;
                    player.attackBoostDefensePenalty = 0;
                    this.recordStateChange(player, 'attack', previousAttack, player.attack, {
                        round: this.currentRound,
                        reason: 'attack_boost_expired'
                    });
                    this.recordStateChange(player, 'defense', previousDefense, player.defense, {
                        round: this.currentRound,
                        reason: 'attack_boost_expired'
                    });
                }
            }

            if (player.armorPenetrationDuration > 0) {
                player.armorPenetrationDuration--;
                if (player.armorPenetrationDuration === 0) {
                    const previousArmorPenetration = player.armorPenetration;
                    player.armorPenetration = 0;
                    const armorPenSkillRef = this.formatSkillReference(player.armorPenetrationSourceSkillName, '破防效果');
                    messages.push(`${player.name}的${armorPenSkillRef}结束! 已持续 ${player.originalArmorPenetrationDuration || 0} 次攻击! 防御力已恢复正常!`);
                    player.armorPenetrationSourceSkillName = null;
                    this.recordStateChange(player, 'armorPenetration', previousArmorPenetration, player.armorPenetration, {
                        round: this.currentRound,
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
                    const critSkillRef = this.formatSkillReference(player.critChanceBoostSkillName, '聚气效果');
                    messages.push(`${player.name}的${critSkillRef}结束! 已持续 ${player.originalCritChanceBoostDuration || 0} 次攻击! 会心几率已恢复正常!`);
                    player.critChanceBoostSkillName = null;
                    this.recordStateChange(player, 'critChance', previousCrit, player.critChance, {
                        round: this.currentRound,
                        reason: 'crit_chance_expired'
                    });
                }
            }

            if (player.freezeDuration > 0) {
                player.freezeDuration--;
                if (player.freezeDuration === 0) {
                    const wasFrozen = Boolean(player.freeze);
                    player.freeze = false;
                    const freezeSkillRef = this.formatSkillReference(player.freezeSourceSkillName, '冰冻效果');
                    messages.push(`${player.name}的${freezeSkillRef}结束! 已持续 ${player.originalFreezeDuration || 0} 次攻击!`);
                    player.freezeSourceSkillName = null;
                    if (wasFrozen) {
                        this.recordStateChange(player, 'freeze', true, false, {
                            round: this.currentRound,
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
                    const tauntSkillRef = this.formatSkillReference(player.tauntSourceSkillName, '嘲讽效果');
                    messages.push(`${player.name}的${tauntSkillRef}结束! 已持续 ${player.originalTauntDuration || 0} 次攻击!`);
                    player.tauntSourceSkillName = null;
                    if (wasTaunted) {
                        this.recordStateChange(player, 'taunted', true, false, {
                            round: this.currentRound,
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
                    const attackReductionSkillRef = this.formatSkillReference(player.attackReductionSkillName, '攻击力降低效果');
                    messages.push(`${player.name}的${attackReductionSkillRef}结束! 已持续 ${player.originalAttackReductionDuration || 0} 次攻击!`);
                    player.attackReductionSkillName = null;
                    this.recordStateChange(player, 'attack', previousAttack, player.attack, {
                        round: this.currentRound,
                        reason: 'attack_reduction_expired'
                    });
                }
            }

            if (player.parryChanceDuration > 0) {
                player.parryChanceDuration--;
                if (player.parryChanceDuration === 0) {
                    const previousParry = player.parryChance;
                    player.parryChance = 0;
                    const parrySkillRef = this.formatSkillReference(player.parryBoostSkillName, '招架提升效果');
                    messages.push(`${player.name}的${parrySkillRef}结束! 已持续 ${player.originalParryChanceDuration || 0} 次攻击!`);
                    player.parryBoostSkillName = null;
                    this.recordStateChange(player, 'parryChance', previousParry, player.parryChance, {
                        round: this.currentRound,
                        reason: 'parry_boost_expired'
                    });
                }
            }
        });

        return messages;
    }

    initStructuredLog() {
        this.battleStartTime = Date.now();
        this.structuredLog = {
            meta: {
                startedAt: this.battleStartTime,
                players: [
                    this.createEntitySnapshot(this.player1),
                    this.createEntitySnapshot(this.player2)
                ]
            },
            keyframes: [],
            events: [],
            stateChanges: []
        };
        this.compressedLog = null;
    }

    getRelativeTimestamp() {
        if (!this.battleStartTime) {
            return 0;
        }
        return Date.now() - this.battleStartTime;
    }

    createEntityReference(entity) {
        if (!entity) {
            return null;
        }
        return {
            name: entity.name ?? null,
            role: entity.role ?? null,
            id: entity.id ?? null
        };
    }

    createEntitySnapshot(entity) {
        if (!entity) {
            return null;
        }
        return {
            name: entity.name ?? null,
            role: entity.role ?? null,
            id: entity.id ?? null,
            maxHealth: entity.maxHealth ?? null,
            attack: entity.attack ?? null,
            defense: entity.defense ?? null,
            speed: entity.speed ?? null
        };
    }

    snapshotPlayerState(player) {
        if (!player) {
            return null;
        }
        return {
            reference: this.createEntityReference(player),
            health: player.health,
            maxHealth: player.maxHealth,
            shield: player.shield || 0,
            statuses: {
                poison: player.poison || 0,
                freeze: Boolean(player.freeze),
                taunted: Boolean(player.taunted),
                reflection: player.reflection || 0
            }
        };
    }

    capturePlayerStates() {
        return [this.snapshotPlayerState(this.player1), this.snapshotPlayerState(this.player2)];
    }

    recordKeyframe(type, detail = {}) {
        if (!this.structuredLog) {
            return;
        }
        this.structuredLog.keyframes.push({
            timestamp: this.getRelativeTimestamp(),
            type,
            detail
        });
    }

    recordEvent(type, { actor = null, target = null, parameters = {} } = {}) {
        if (!this.structuredLog) {
            return;
        }
        this.structuredLog.events.push({
            timestamp: this.getRelativeTimestamp(),
            type,
            actor: actor ? { ...actor } : null,
            target: target ? { ...target } : null,
            parameters: parameters ? JSON.parse(JSON.stringify(parameters)) : null
        });
    }

    recordStateChange(entity, attribute, previousValue, currentValue, context = {}) {
        if (!this.structuredLog || previousValue === currentValue) {
            return;
        }
        this.structuredLog.stateChanges.push({
            timestamp: this.getRelativeTimestamp(),
            entity: this.createEntityReference(entity),
            attribute,
            previousValue,
            currentValue,
            context: context ? JSON.parse(JSON.stringify(context)) : null
        });
    }

    notifyLogUpdate(logCallback, { finalize = false } = {}) {
        if (typeof logCallback !== 'function') {
            return;
        }
        const payload = {
            text: this.textLogLines.join('\n'),
            structured: this.structuredLog
        };
        if (finalize) {
            this.compressedLog = this.compressedLog || compressStructuredLog(this.structuredLog);
            payload.compressed = this.compressedLog;
        }
        logCallback(payload);
    }

}

