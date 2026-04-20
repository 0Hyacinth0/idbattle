import { BattleService } from './battleService.js';
import globalEventBus from '../utils/EventBus.js';

function deepClone(entity) {
    if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(entity);
    }
    return JSON.parse(JSON.stringify(entity));
}

function ensurePlayerState(basePlayer, role) {
    const clone = deepClone(basePlayer);
    clone.role = role;
    clone.health = typeof clone.health === 'number' ? clone.health : clone.maxHealth;
    clone.maxHealth = typeof clone.maxHealth === 'number' ? clone.maxHealth : clone.health;
    clone.poison = clone.poison || 0;
    clone.freeze = clone.freeze || false;
    clone.taunted = clone.taunted || false;
    clone.shield = clone.shield || 0;
    clone.reflection = clone.reflection || 0;
    clone.poisonSource = null;
    return clone;
}

function createPlayerAggregate(name) {
    return {
        name,
        wins: 0,
        totalDamage: 0,
        totalStatusDamage: 0,
        totalReflectionDamage: 0,
        totalShieldAbsorbed: 0,
        totalAttacks: 0,
        criticalHits: 0,
        skillTriggers: 0,
        attackDamages: [],
        statusDamages: [],
        reflectionDamages: [],
        shieldAbsorptions: [],
        perBattleTotalDamage: [],
        perBattleStatusDamage: []
    };
}

function percentile(sortedValues, ratio) {
    if (!sortedValues.length) {
        return 0;
    }
    if (sortedValues.length === 1) {
        return sortedValues[0];
    }
    const position = (sortedValues.length - 1) * ratio;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    if (lowerIndex === upperIndex) {
        return sortedValues[lowerIndex];
    }
    const weight = position - lowerIndex;
    return sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
}

function computeStats(values) {
    const count = values.length;
    if (!count) {
        return {
            count: 0,
            min: 0,
            max: 0,
            mean: 0,
            median: 0,
            p25: 0,
            p75: 0,
            p90: 0,
            stdDev: 0
        };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, value) => acc + value, 0);
    const mean = sum / count;
    const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / count;
    return {
        count,
        min: sorted[0],
        max: sorted[count - 1],
        mean,
        median: percentile(sorted, 0.5),
        p25: percentile(sorted, 0.25),
        p75: percentile(sorted, 0.75),
        p90: percentile(sorted, 0.9),
        stdDev: Math.sqrt(variance)
    };
}

function buildHistogram(values, binCount = 10) {
    if (!values.length) {
        return [];
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
        return [{ range: [min, max], count: values.length }];
    }
    const span = max - min;
    const width = span / binCount || 1;
    const bins = Array.from({ length: binCount }, (_, index) => ({
        from: min + index * width,
        to: index === binCount - 1 ? max : min + (index + 1) * width,
        count: 0
    }));
    values.forEach(value => {
        let binIndex = Math.floor((value - min) / width);
        if (binIndex >= binCount) {
            binIndex = binCount - 1;
        }
        bins[binIndex].count += 1;
    });
    return bins.map(({ from, to, count }) => ({
        range: [Number(from.toFixed(2)), Number(to.toFixed(2))],
        count
    }));
}

function finalizePlayerSummary(playerAggregate, iterations, histogramBins) {
    return {
        name: playerAggregate.name,
        wins: playerAggregate.wins,
        winRate: iterations ? playerAggregate.wins / iterations : 0,
        totalDamage: playerAggregate.totalDamage,
        totalStatusDamage: playerAggregate.totalStatusDamage,
        totalReflectionDamage: playerAggregate.totalReflectionDamage,
        totalShieldAbsorbed: playerAggregate.totalShieldAbsorbed,
        totalAttacks: playerAggregate.totalAttacks,
        criticalRate: playerAggregate.totalAttacks ? playerAggregate.criticalHits / playerAggregate.totalAttacks : 0,
        skillTriggerRate: playerAggregate.totalAttacks ? playerAggregate.skillTriggers / playerAggregate.totalAttacks : 0,
        attackDamageStats: computeStats(playerAggregate.attackDamages),
        statusDamageStats: computeStats(playerAggregate.statusDamages),
        reflectionDamageStats: computeStats(playerAggregate.reflectionDamages),
        shieldAbsorptionStats: computeStats(playerAggregate.shieldAbsorptions),
        perBattleDamageStats: computeStats(playerAggregate.perBattleTotalDamage),
        perBattleStatusStats: computeStats(playerAggregate.perBattleStatusDamage),
        attackHistogram: buildHistogram(playerAggregate.attackDamages, histogramBins),
        statusHistogram: buildHistogram(playerAggregate.statusDamages, histogramBins)
    };
}

export async function runBatchSimulation({
    player1,
    player2,
    iterations = 100,
    histogramBins = 10,
    randomGenerator = null
}) {
    if (!player1 || !player2) {
        throw new Error('player1 和 player2 数据不能为空');
    }
    const summary = {
        iterations,
        draws: 0,
        rounds: [],
        players: {
            player1: createPlayerAggregate(player1.name || 'Player 1'),
            player2: createPlayerAggregate(player2.name || 'Player 2')
        }
    };

    for (let index = 0; index < iterations; index += 1) {
        const battlePlayers = {
            player1: ensurePlayerState(player1, 'player1'),
            player2: ensurePlayerState(player2, 'player2')
        };

        const service = new BattleService();
        service.setPlayers(battlePlayers.player1, battlePlayers.player2);
        service.delay = () => Promise.resolve();
        if (randomGenerator) {
            service.setRandomGenerator(randomGenerator);
        }

        const perBattle = {
            rounds: 0,
            totalDamage: { player1: 0, player2: 0 },
            statusDamage: { player1: 0, player2: 0 }
        };

        const handlers = {
            onRoundStart: ({ round }) => {
                perBattle.rounds = round;
            },
            onAttack: ({ attacker, defender, damage, isCritical, skillTriggered, shieldAbsorbed, reflectionDamage }) => {
                if (!attacker || !defender) {
                    return;
                }
                const attackerRole = attacker.role || (attacker === battlePlayers.player1 ? 'player1' : 'player2');
                const defenderRole = defender.role || (defender === battlePlayers.player1 ? 'player1' : 'player2');
                const attackerAggregate = summary.players[attackerRole];
                const defenderAggregate = summary.players[defenderRole];

                if (damage > 0) {
                    attackerAggregate.totalDamage += damage;
                    attackerAggregate.attackDamages.push(damage);
                    perBattle.totalDamage[attackerRole] += damage;
                }
                attackerAggregate.totalAttacks += 1;
                if (isCritical) {
                    attackerAggregate.criticalHits += 1;
                }
                if (skillTriggered) {
                    attackerAggregate.skillTriggers += 1;
                }
                if (shieldAbsorbed > 0) {
                    defenderAggregate.totalShieldAbsorbed += shieldAbsorbed;
                    defenderAggregate.shieldAbsorptions.push(shieldAbsorbed);
                }
                if (reflectionDamage > 0) {
                    defenderAggregate.totalReflectionDamage += reflectionDamage;
                    defenderAggregate.reflectionDamages.push(reflectionDamage);
                    perBattle.totalDamage[defenderRole] += reflectionDamage;
                }
            },
            onStatusEffect: ({ target, damage, source }) => {
                if (!target || !damage) {
                    return;
                }
                const targetRole = target.role || (target === battlePlayers.player1 ? 'player1' : 'player2');
                let sourceRole = source?.role;
                if (!sourceRole) {
                    sourceRole = targetRole === 'player1' ? 'player2' : 'player1';
                }
                const aggregate = summary.players[sourceRole];
                if (aggregate) {
                    aggregate.totalStatusDamage += damage;
                    aggregate.statusDamages.push(damage);
                    perBattle.statusDamage[sourceRole] += damage;
                }
            },
            onBattleEnd: ({ winner, isDraw, rounds }) => {
                perBattle.rounds = rounds;
                if (isDraw) {
                    summary.draws += 1;
                } else if (winner) {
                    const role = winner.role || (winner === battlePlayers.player1 ? 'player1' : 'player2');
                    const aggregate = summary.players[role];
                    if (aggregate) {
                        aggregate.wins += 1;
                    }
                }
            }
        };

        for (const [event, handler] of Object.entries(handlers)) {
            globalEventBus.on(event, handler);
        }

        await service.battle();

        for (const [event, handler] of Object.entries(handlers)) {
            globalEventBus.off(event, handler);
        }

        summary.rounds.push(perBattle.rounds);
        summary.players.player1.perBattleTotalDamage.push(perBattle.totalDamage.player1);
        summary.players.player2.perBattleTotalDamage.push(perBattle.totalDamage.player2);
        summary.players.player1.perBattleStatusDamage.push(perBattle.statusDamage.player1);
        summary.players.player2.perBattleStatusDamage.push(perBattle.statusDamage.player2);
    }

    return {
        iterations: summary.iterations,
        draws: summary.draws,
        roundStats: computeStats(summary.rounds),
        roundHistogram: buildHistogram(summary.rounds, histogramBins),
        players: {
            player1: finalizePlayerSummary(summary.players.player1, summary.iterations, histogramBins),
            player2: finalizePlayerSummary(summary.players.player2, summary.iterations, histogramBins)
        }
    };
}

export { computeStats, buildHistogram };
