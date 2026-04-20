import { compressStructuredLog } from '../utils/logCompression.js';
import globalEventBus, { BattleEvents } from '../utils/EventBus.js';
import { TurnManager } from './core/TurnManager.js';
import { DamageCalculator } from './core/DamageCalculator.js';
import { SkillResolver } from './core/SkillResolver.js';
import { StatusEffectSystem } from './core/StatusEffectSystem.js';

export class BattleService {
    constructor() {
        this.player1 = null;
        this.player2 = null;
        this.randomFn = Math.random;
        this.structuredLog = null;
        this.textLogLines = [];
        this.compressedLog = null;
        this.turnManager = new TurnManager(this.randomFn);

        // Control mechanisms
        this.isSkipping = false;
        this.isPaused = false;
        this.playbackSpeed = 1.0;
        this.isSilent = false; // Add silent mode for fast simulations
    }

    static LOG_ROUND_HEADER_REGEX = /^第\s*\d+\s*回合[:：]/;

    static LOG_SEPARATOR_REGEX = /^=+$/;

    setPlayers(player1, player2) {
        this.player1 = player1;
        this.player2 = player2;
        this.turnManager.reset();

        // Reset controls
        this.isSkipping = false;
        this.isPaused = false;
    }

    setEventHandlers(handlers = {}) {
        // Obsolete: using globalEventBus now
    }

    emitEvent(eventName, payload) {
        if (!this.isSilent) {
            globalEventBus.emit(eventName, payload);
        }
    }

    setRandomGenerator(randomFn) {
        if (typeof randomFn === 'function') {
            this.randomFn = randomFn;
        } else {
            this.randomFn = Math.random;
        }
        this.turnManager.randomFn = this.randomFn;
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
        if (!this.isSilent) {
            globalEventBus.emit(BattleEvents.PLAYER_INFO_UPDATE, {
                player1: this.player1,
                player2: this.player2
            });
        }
    }

    applyEnrage(round, log) {
        if (round > 50) {
            const state = this.turnManager.getEnrageState();
            if (state.stacks === 1) {
                this.appendLog(log, `⚠️ 战斗进入疲劳阶段 (第 ${round} 回合)! 伤害提升，治疗效果衰减!`);
            } else if (state.stacks % 5 === 0) {
                this.appendLog(log, `⚠️ 疲劳加剧! 所有伤害提升 ${Math.floor((state.multiplier - 1) * 100)}%，治疗下降 ${Math.floor((1 - state.healPenalty) * 100)}%!`);
            }
        }
    }

    get currentRound() {
        return this.turnManager.round;
    }

    async battle() {
        const log = [];
        this.textLogLines = log;
        this.turnManager.reset();

        this.initStructuredLog();
        this.recordKeyframe('battle_start', {
            players: this.capturePlayerStates()
        });

        this.emitEvent('onBattleStart', { player1: this.player1, player2: this.player2 });
        this.appendLog(log, '=======================================', '战斗开始!');

        while (this.playersAlive()) {
            const { attacker, defender, apState } = this.turnManager.getAttackerAndDefender(this.player1, this.player2);

            // Dispatch the active ATB state for UI rendering
            this.emitEvent(BattleEvents.TURN_UPDATE, { apState });

            const isNewRound = this.turnManager.advanceAction();
            const round = this.turnManager.round;

            if (isNewRound) {
                this.emitEvent('onRoundStart', { round });
                this.recordKeyframe('round_start', {
                    round,
                    snapshot: this.capturePlayerStates()
                });
                this.applyEnrage(round, log);
                this.appendLog(log, `第 ${round} 回合：`);
            }

            this.appendLog(log, `【 ${attacker.name} 的行动回合 】`);

            await this.delay(600);

            const statusMessages = this.handleStatusEffectsFor(attacker);
            if (statusMessages.length) {
                this.appendLog(log, ...statusMessages);
            }
            this.updatePlayerUI();

            if (!this.playersAlive()) {
                break;
            }

            this.recordEvent('turn_order', {
                parameters: {
                    round,
                    attacker: this.createEntityReference(attacker)
                }
            });

            this.recordKeyframe('attack_phase', {
                round,
                attacker: this.createEntityReference(attacker),
                defender: this.createEntityReference(defender)
            });
            const attackMessages = await this.executeSingleAttack(attacker, defender);
            if (attackMessages.length) {
                this.appendLog(log, ...attackMessages);
            }
            this.updatePlayerUI();

            if (!this.playersAlive()) {
                break;
            }

            await this.delay(750);
        }

        const bothDefeated = this.player1.health <= 0 && this.player2.health <= 0;
        const winner = bothDefeated ? null : (this.player1.health > this.player2.health ? this.player1 : this.player2);
        const roundsCompleted = Math.max(0, this.turnManager.round - 1);
        const winnerMessage = bothDefeated
            ? '双方同归于尽! 平局!'
            : `${winner?.name ?? ''} 胜利!`;
        this.recordKeyframe('battle_end', {
            winner: this.createEntityReference(winner),
            rounds: roundsCompleted,
            snapshot: this.capturePlayerStates()
        });
        this.appendLog(log, '=======================================', winnerMessage, { finalize: true });
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
        return {
            text: log.join('\n'),
            structured: this.structuredLog,
            compressed: this.compressedLog || compressStructuredLog(this.structuredLog)
        };
    }

    // getAttackOrder is no longer needed due to ATB logic

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

    appendLog(log, ...lines) {
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
                this.notifyLogUpdate({ finalize: true });
            }
            return;
        }
        log.push(...filteredLines);
        this.recordLogEntries(filteredLines);
        this.notifyLogUpdate({ finalize: options.finalize });
    }

    recordLogEntries(lines) {
        if (!this.structuredLog || !Array.isArray(lines) || !lines.length) {
            return;
        }

        const timestamp = this.getRelativeTimestamp();
        lines.forEach((line) => {
            const trimmed = typeof line === 'string' ? line.trim() : '';
            let type = 'entry';
            if (/^第\s*\d+\s*回合[:：]/.test(trimmed)) {
                type = 'round_header';
            } else if (BattleService.LOG_SEPARATOR_REGEX.test(trimmed)) {
                type = 'separator';
            }

            this.structuredLog.logEntries.push({
                timestamp,
                text: line,
                round: this.currentRound,
                type
            });
        });
    }

    playersAlive() {
        return this.player1.health > 0 && this.player2.health > 0;
    }

    async delay(ms) {
        if (this.isSkipping || this.isSilent) return;

        const adjustedMs = ms / this.playbackSpeed;
        const tick = 50;
        let elapsed = 0;

        while (elapsed < adjustedMs || this.isPaused) {
            await new Promise(resolve => setTimeout(resolve, tick));
            if (!this.isPaused && !this.isSkipping) {
                elapsed += tick;
            }
            if (this.isSkipping) {
                break;
            }
        }
    }

    attackEnemy(attacker, defender) {
        const log = [];
        const defenderHealthInitial = defender.health;
        const attackerHealthInitial = attacker.health;
        let shieldAbsorb = 0;
        let reflectionDamage = 0;



        if (defender.armorPenetration) {
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

        let damage = DamageCalculator.calculateBaseDamage(attacker, defender, this.turnManager.enrageMultiplier);
        let skillConditionMet = DamageCalculator.isSkillConditionMet(attacker);
        let isCritical = DamageCalculator.checkCritical(attacker, this.randomFn, skillConditionMet);

        if (isCritical) {
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

        if (DamageCalculator.checkParry(defender, this.randomFn)) {
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
            if (skillConditionMet) {
                const skillChance = attacker.skill.chance || 0.1;
                skillTriggered = this.random() < skillChance;
            }
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

            const context = {
                log,
                recordEvent: this.recordEvent.bind(this),
                recordStateChange: this.recordStateChange.bind(this),
                createEntityReference: this.createEntityReference.bind(this),
                formatSkillReference: this.formatSkillReference.bind(this),
                getSkillName: this.getSkillName.bind(this),
                currentRound: this.currentRound,
                turnManager: this.turnManager
            };

            const result = SkillResolver.resolveSkill(attacker, defender, damage, isCritical, context);
            damage = result.damage;
            if (result.healInterrupt) {
                return { log };
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

    handleStatusEffectsFor(player) {
        if (!player || player.health <= 0) return [];

        const context = {
            recordStateChange: this.recordStateChange.bind(this),
            recordEvent: this.recordEvent.bind(this),
            createEntityReference: this.createEntityReference.bind(this),
            formatSkillReference: this.formatSkillReference.bind(this),
            currentRound: this.currentRound
        };
        return StatusEffectSystem.processEffects(player, context);
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
            stateChanges: [],
            logEntries: []
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

    notifyLogUpdate({ finalize = false } = {}) {
        if (this.isSilent) return;
        const payload = {
            text: this.textLogLines.join('\n'),
            structured: this.structuredLog
        };
        if (finalize) {
            this.compressedLog = this.compressedLog || compressStructuredLog(this.structuredLog);
            payload.compressed = this.compressedLog;
        }
        globalEventBus.emit(BattleEvents.LOG_APPEND, payload);
    }

}

