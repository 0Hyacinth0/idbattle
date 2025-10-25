import { decompressStructuredLog } from '../utils/logCompression.js';

function deepClone(value) {
    if (typeof globalThis.structuredClone === 'function') {
        try {
            return globalThis.structuredClone(value);
        } catch (error) {
            // Fallback to JSON method below
        }
    }
    return JSON.parse(JSON.stringify(value ?? null));
}

function clamp(value, min, max) {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}

function getBattleStartSnapshots(structuredLog) {
    const keyframe = (structuredLog?.keyframes || []).find((item) => item?.type === 'battle_start');
    if (keyframe?.detail?.players && Array.isArray(keyframe.detail.players)) {
        return keyframe.detail.players;
    }
    if (structuredLog?.meta?.players && Array.isArray(structuredLog.meta.players)) {
        return structuredLog.meta.players;
    }
    return [null, null];
}

function applySnapshot(player, snapshot) {
    if (!player || !snapshot) {
        return;
    }
    const { health, maxHealth, shield, statuses = {} } = snapshot;
    if (typeof maxHealth === 'number') {
        player.maxHealth = maxHealth;
    }
    if (typeof health === 'number') {
        player.health = health;
    } else if (typeof player.maxHealth === 'number' && typeof player.health !== 'number') {
        player.health = player.maxHealth;
    }
    if (typeof shield === 'number') {
        player.shield = shield;
    }
    if (typeof statuses.poison === 'number') {
        player.poison = statuses.poison;
    }
    if (typeof statuses.freeze === 'boolean') {
        player.freeze = statuses.freeze;
    }
    if (typeof statuses.taunted === 'boolean') {
        player.taunted = statuses.taunted;
    }
    if (typeof statuses.reflection === 'number') {
        player.reflection = statuses.reflection;
    }
}

function ensureBasePlayer(player, role) {
    const base = deepClone(player || {});
    base.role = role;
    base.poison = typeof base.poison === 'number' ? base.poison : 0;
    base.freeze = Boolean(base.freeze);
    base.taunted = Boolean(base.taunted);
    base.shield = typeof base.shield === 'number' ? base.shield : 0;
    base.reflection = typeof base.reflection === 'number' ? base.reflection : 0;
    base.parryChance = typeof base.parryChance === 'number' ? base.parryChance : 0;
    base.critChance = typeof base.critChance === 'number' ? base.critChance : 0;
    return base;
}

function buildBasePlayers(players, structuredLog) {
    const snapshots = getBattleStartSnapshots(structuredLog);
    const basePlayer1 = ensureBasePlayer(players?.player1, 'player1');
    const basePlayer2 = ensureBasePlayer(players?.player2, 'player2');
    applySnapshot(basePlayer1, snapshots?.[0] || null);
    applySnapshot(basePlayer2, snapshots?.[1] || null);
    return { player1: basePlayer1, player2: basePlayer2 };
}

function sortByTimestamp(list = []) {
    return [...list].map((item, index) => ({ ...item, __index: index }))
        .sort((a, b) => {
            if (a.timestamp === b.timestamp) {
                return a.__index - b.__index;
            }
            return (a.timestamp ?? 0) - (b.timestamp ?? 0);
        })
        .map(({ __index, ...rest }) => rest);
}

function buildFallbackLogEntries(lines, duration) {
    if (!Array.isArray(lines) || !lines.length) {
        return [];
    }
    const step = duration > 0 ? duration / lines.length : 1000;
    return lines.map((text, index) => ({
        timestamp: Math.floor(step * index),
        type: 'entry',
        text,
        round: null
    }));
}

function now() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }
    return Date.now();
}

export class BattleReplayController {
    constructor({ structuredLog = null, compressedLog = null, textLog = '', players = {} } = {}) {
        const resolvedLog = structuredLog || (compressedLog ? decompressStructuredLog(compressedLog) : null);
        if (!resolvedLog) {
            throw new Error('无法初始化战斗回放: 缺少结构化日志数据');
        }

        this.structuredLog = resolvedLog;
        this.textLog = typeof textLog === 'string' ? textLog : '';
        this.textLines = this.textLog ? this.textLog.split('\n') : [];
        this.logPayload = { text: this.textLog, structured: this.structuredLog };
        this.basePlayers = buildBasePlayers(players, this.structuredLog);
        this.stateChanges = sortByTimestamp(this.structuredLog.stateChanges || []);
        this.keyframes = sortByTimestamp(this.structuredLog.keyframes || []);
        this.roundKeyframes = this.keyframes.filter((keyframe) => keyframe?.type === 'round_start' && keyframe?.detail);
        this.rounds = this.roundKeyframes.map((keyframe) => ({
            round: Number(keyframe.detail.round) || 0,
            timestamp: keyframe.timestamp ?? 0
        }));

        const rawLogEntries = Array.isArray(this.structuredLog.logEntries) ? sortByTimestamp(this.structuredLog.logEntries) : [];
        const lastStateTimestamp = this.stateChanges.length ? this.stateChanges[this.stateChanges.length - 1].timestamp ?? 0 : 0;
        const lastKeyframeTimestamp = this.keyframes.length ? this.keyframes[this.keyframes.length - 1].timestamp ?? 0 : 0;
        const lastLogTimestamp = rawLogEntries.length ? rawLogEntries[rawLogEntries.length - 1].timestamp ?? 0 : 0;
        const maximumTimestamp = Math.max(lastStateTimestamp, lastKeyframeTimestamp, lastLogTimestamp);
        this.duration = maximumTimestamp > 0 ? maximumTimestamp : Math.max(1, this.textLines.length * 750);

        this.logEntries = rawLogEntries.length ? rawLogEntries : buildFallbackLogEntries(this.textLines, this.duration);

        this.entityIndex = this.buildEntityIndex();
        this.listeners = new Map();
        this.isPlaying = false;
        this.speed = 1;
        this.currentTime = 0;
        this.lastTick = null;
        this.rafId = null;
        this.currentPlayers = null;
        this.currentRound = 0;
        this.currentLogIndex = 0;

        this.applyStateForTime(0);
        this.emit('ready', {
            duration: this.duration,
            rounds: this.rounds
        });
        this.emitUpdate();
    }

    on(eventName, handler) {
        if (typeof handler !== 'function') {
            return () => {};
        }
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        const handlers = this.listeners.get(eventName);
        handlers.add(handler);
        return () => this.off(eventName, handler);
    }

    off(eventName, handler) {
        const handlers = this.listeners.get(eventName);
        if (!handlers) {
            return;
        }
        handlers.delete(handler);
    }

    emit(eventName, payload) {
        const handlers = this.listeners.get(eventName);
        if (!handlers || !handlers.size) {
            return;
        }
        handlers.forEach((handler) => {
            try {
                handler(payload);
            } catch (error) {
                console.error('BattleReplayController listener error:', error);
            }
        });
    }

    buildEntityIndex() {
        const index = new Map();
        const nameToRole = new Map();
        if (this.basePlayers.player1?.name) {
            nameToRole.set(this.basePlayers.player1.name, 'player1');
        }
        if (this.basePlayers.player2?.name) {
            nameToRole.set(this.basePlayers.player2.name, 'player2');
        }

        index.set('player1', 'player1');
        index.set('player2', 'player2');

        return {
            resolve: (entity) => {
                if (!entity) {
                    return null;
                }
                if (entity.role && index.has(entity.role)) {
                    return index.get(entity.role);
                }
                if (entity.name && nameToRole.has(entity.name)) {
                    return nameToRole.get(entity.name);
                }
                return null;
            }
        };
    }

    getPlayerClone(role) {
        const source = role === 'player2' ? this.basePlayers.player2 : this.basePlayers.player1;
        return deepClone(source);
    }

    applyStateForTime(time) {
        const players = {
            player1: this.getPlayerClone('player1'),
            player2: this.getPlayerClone('player2')
        };

        this.stateChanges.forEach((change) => {
            if ((change.timestamp ?? 0) > time) {
                return;
            }
            const role = this.entityIndex.resolve(change.entity);
            if (!role || !players[role]) {
                return;
            }
            const player = players[role];
            const value = change.currentValue;
            switch (change.attribute) {
                case 'health': {
                    const max = typeof player.maxHealth === 'number' ? player.maxHealth : undefined;
                    if (typeof value === 'number') {
                        const clampedHealth = typeof max === 'number' ? clamp(value, 0, max) : Math.max(0, value);
                        player.health = clampedHealth;
                    }
                    break;
                }
                case 'shield':
                case 'poison':
                case 'reflection':
                case 'attack':
                case 'defense':
                case 'speed':
                case 'parryChance':
                case 'critChance': {
                    player[change.attribute] = typeof value === 'number' ? value : 0;
                    break;
                }
                case 'freeze':
                case 'taunted': {
                    player[change.attribute] = Boolean(value);
                    break;
                }
                default: {
                    player[change.attribute] = value;
                }
            }
        });

        this.currentPlayers = players;
        this.currentRound = this.resolveRound(time);
        this.currentLogIndex = this.resolveLogIndex(time);
    }

    resolveRound(time) {
        let activeRound = 0;
        for (const entry of this.rounds) {
            if ((entry.timestamp ?? 0) <= time) {
                activeRound = entry.round;
            } else {
                break;
            }
        }
        return activeRound;
    }

    resolveLogIndex(time) {
        if (!this.logEntries.length) {
            return 0;
        }
        let index = 0;
        for (const entry of this.logEntries) {
            if ((entry.timestamp ?? 0) <= time) {
                index += 1;
            } else {
                break;
            }
        }
        return index;
    }

    emitUpdate() {
        this.emit('update', {
            time: this.currentTime,
            duration: this.duration,
            progress: this.duration ? this.currentTime / this.duration : 0,
            players: this.currentPlayers,
            round: this.currentRound,
            logIndex: this.currentLogIndex,
            logEntries: this.logEntries
        });
    }

    getDuration() {
        return this.duration;
    }

    getRounds() {
        return this.rounds;
    }

    getBasePlayers() {
        return this.basePlayers;
    }

    getLogPayload() {
        return this.logPayload;
    }

    play() {
        if (this.isPlaying) {
            return;
        }
        this.isPlaying = true;
        this.lastTick = now();
        this.emit('playstate', { isPlaying: true });
        this.scheduleNextFrame();
    }

    pause() {
        if (!this.isPlaying) {
            return;
        }
        this.isPlaying = false;
        this.lastTick = null;
        if (this.rafId !== null) {
            if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(this.rafId);
            } else {
                clearTimeout(this.rafId);
            }
        }
        this.rafId = null;
        this.emit('playstate', { isPlaying: false });
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    scheduleNextFrame() {
        if (!this.isPlaying) {
            return;
        }
        const callback = (timestamp) => {
            if (!this.isPlaying) {
                return;
            }
            const currentTick = typeof timestamp === 'number' ? timestamp : now();
            const delta = currentTick - (this.lastTick ?? currentTick);
            this.lastTick = currentTick;
            const nextTime = this.currentTime + delta * this.speed;
            this.seekTo(nextTime);
            this.scheduleNextFrame();
        };

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            this.rafId = window.requestAnimationFrame(callback);
        } else {
            this.rafId = setTimeout(() => callback(now()), 16);
        }
    }

    seekTo(time) {
        const clampedTime = clamp(time, 0, this.duration);
        this.currentTime = clampedTime;
        this.applyStateForTime(clampedTime);
        this.emitUpdate();
        if (this.isPlaying && clampedTime >= this.duration) {
            this.pause();
        }
    }

    seekByRatio(ratio) {
        const normalized = clamp(ratio, 0, 1);
        this.seekTo(this.duration * normalized);
    }

    setSpeed(multiplier) {
        if (!Number.isFinite(multiplier) || multiplier <= 0) {
            return;
        }
        this.speed = multiplier;
        this.emit('speed', { speed: this.speed });
    }

    jumpToRound(roundNumber) {
        const target = this.rounds.find((entry) => entry.round === Number(roundNumber));
        if (!target) {
            return;
        }
        this.seekTo(target.timestamp);
    }

    stop() {
        this.pause();
        this.seekTo(0);
    }

    destroy() {
        this.pause();
        this.listeners.clear();
    }
}
