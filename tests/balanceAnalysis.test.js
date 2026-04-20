import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAttributes } from '../models/player.js';
import { computeStats, buildHistogram, runBatchSimulation } from '../services/balanceAnalysis.js';

test('computeStats calculates descriptive metrics', () => {
    const stats = computeStats([1, 2, 3, 4, 5]);
    assert.equal(stats.count, 5);
    assert.equal(stats.min, 1);
    assert.equal(stats.max, 5);
    assert.equal(stats.median, 3);
    assert.equal(stats.p25, 2);
    assert.equal(stats.p75, 4);
    assert.equal(stats.p90, 4.6);
    assert.ok(Math.abs(stats.mean - 3) < 1e-9);
    assert.ok(Math.abs(stats.stdDev - Math.sqrt(2)) < 1e-9);
});

test('buildHistogram collapses identical values into single bin', () => {
    const histogram = buildHistogram([10, 10, 10], 5);
    assert.equal(histogram.length, 1);
    assert.deepEqual(histogram[0], { range: [10, 10], count: 3 });
});

test('runBatchSimulation returns deterministic summary with seeded RNG', async () => {
    const player1 = generateAttributes('测试玩家A');
    const player2 = generateAttributes('测试玩家B');
    let cursor = 0;
    const values = [0.1, 0.3, 0.5, 0.7, 0.9];
    const generator = () => {
        const value = values[cursor % values.length];
        cursor += 1;
        return value;
    };
    const report = await runBatchSimulation({
        player1,
        player2,
        iterations: 5,
        histogramBins: 5,
        randomGenerator: generator
    });

    assert.equal(report.iterations, 5);
    assert.equal(report.roundStats.count, 5);
    assert.equal(typeof report.players.player1.winRate, 'number');
    assert.equal(typeof report.players.player2.winRate, 'number');
    assert.ok(report.players.player1.attackDamageStats.count >= 0);
    assert.ok(report.players.player2.attackDamageStats.count >= 0);
    assert.ok(report.players.player1.attackHistogram.length <= 5);
    assert.ok(report.players.player2.attackHistogram.length <= 5);
});
