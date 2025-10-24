#!/usr/bin/env node
import { readFile } from 'fs/promises';
import path from 'path';
import process from 'process';
import { generateAttributes } from '../models/player.js';
import { runBatchSimulation } from '../services/balanceAnalysis.js';

function printUsage() {
    console.log(`平衡分析工具\n\n用法:\n  node scripts/balance-analysis.js --player1 <名称> --player2 <名称> [选项]\n\n选项:\n  --player1, -a <名称>         玩家1名称\n  --player2, -b <名称>         玩家2名称\n  --iterations, -n <次数>      模拟次数(默认: 1000)\n  --bins <数量>                直方图分箱数量(默认: 12)\n  --seed <种子>               随机数种子, 便于复现\n  --config <文件>             指定包含自定义配置的JSON文件\n  --player1-config <文件>     玩家1的自定义配置JSON\n  --player2-config <文件>     玩家2的自定义配置JSON\n  --json                      以JSON格式输出结果\n  --help                      查看帮助\n`);
}

function parseArgs(argv) {
    const options = {
        histogramBins: undefined,
        iterations: undefined,
        json: false
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        switch (arg) {
            case '--player1':
            case '-a':
                options.player1 = argv[++index];
                break;
            case '--player2':
            case '-b':
                options.player2 = argv[++index];
                break;
            case '--iterations':
            case '-n':
                options.iterations = Number.parseInt(argv[++index], 10);
                break;
            case '--bins':
                options.histogramBins = Number.parseInt(argv[++index], 10);
                break;
            case '--seed':
                options.seed = argv[++index];
                break;
            case '--config':
                options.configPath = argv[++index];
                break;
            case '--player1-config':
                options.player1ConfigPath = argv[++index];
                break;
            case '--player2-config':
                options.player2ConfigPath = argv[++index];
                break;
            case '--json':
                options.json = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                console.warn(`未知参数: ${arg}`);
        }
    }
    return options;
}

async function loadJsonConfig(filePath) {
    const resolved = path.resolve(process.cwd(), filePath);
    const content = await readFile(resolved, 'utf8');
    return JSON.parse(content);
}

function normalizeSeed(seedValue) {
    if (seedValue === undefined || seedValue === null) {
        return undefined;
    }
    if (typeof seedValue === 'number' && Number.isFinite(seedValue)) {
        return seedValue >>> 0;
    }
    const text = String(seedValue).trim();
    const numeric = Number.parseInt(text, 10);
    if (!Number.isNaN(numeric)) {
        return numeric >>> 0;
    }
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    return hash >>> 0;
}

function createSeededGenerator(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return '0.00';
    }
    return value.toFixed(2);
}

function formatPercent(value) {
    if (!Number.isFinite(value)) {
        return '0.00%';
    }
    return `${(value * 100).toFixed(2)}%`;
}

function renderHistogram(title, histogram) {
    console.log(`\n${title}`);
    if (!histogram.length) {
        console.log('  无数据');
        return;
    }
    const maxCount = Math.max(...histogram.map(bin => bin.count));
    const scale = maxCount > 0 ? 20 / maxCount : 0;
    histogram.forEach(({ range, count }) => {
        const [from, to] = range;
        const barLength = count > 0 ? Math.max(1, Math.round(count * scale)) : 0;
        const bar = barLength > 0 ? '█'.repeat(barLength) : '';
        console.log(`  [${formatNumber(from)} - ${formatNumber(to)}] ${bar} ${count}`);
    });
}

function printTableSummary(report) {
    const { players, iterations, draws, roundStats } = report;
    const player1 = players.player1;
    const player2 = players.player2;
    const drawRate = iterations ? draws / iterations : 0;

    console.log('\n=== 胜率与整体指标 ===');
    console.table([
        {
            指标: '胜率',
            [player1.name]: formatPercent(player1.winRate),
            [player2.name]: formatPercent(player2.winRate),
            平局率: formatPercent(drawRate)
        },
        {
            指标: '平均每局伤害',
            [player1.name]: formatNumber(player1.perBattleDamageStats.mean),
            [player2.name]: formatNumber(player2.perBattleDamageStats.mean),
            平局率: ''
        },
        {
            指标: '平均每局状态伤害',
            [player1.name]: formatNumber(player1.perBattleStatusStats.mean),
            [player2.name]: formatNumber(player2.perBattleStatusStats.mean),
            平局率: ''
        },
        {
            指标: '技能触发率',
            [player1.name]: formatPercent(player1.skillTriggerRate),
            [player2.name]: formatPercent(player2.skillTriggerRate),
            平局率: ''
        },
        {
            指标: '会心率',
            [player1.name]: formatPercent(player1.criticalRate),
            [player2.name]: formatPercent(player2.criticalRate),
            平局率: ''
        }
    ]);

    console.log('\n=== 回合统计 ===');
    console.table([
        { 指标: '平均回合数', 数值: formatNumber(roundStats.mean) },
        { 指标: '中位数', 数值: formatNumber(roundStats.median) },
        { 指标: 'P90', 数值: formatNumber(roundStats.p90) },
        { 指标: '最长回合', 数值: formatNumber(roundStats.max) },
        { 指标: '最短回合', 数值: formatNumber(roundStats.min) }
    ]);
}

async function loadPlayerConfig(configPath, fallback = {}) {
    if (!configPath) {
        return fallback;
    }
    try {
        const loaded = await loadJsonConfig(configPath);
        return { ...fallback, ...loaded };
    } catch (error) {
        console.error(`读取配置失败: ${configPath}`, error.message);
        process.exit(1);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printUsage();
        return;
    }

    let baseConfig = {};
    if (args.configPath) {
        try {
            baseConfig = await loadJsonConfig(args.configPath);
        } catch (error) {
            console.error(`读取配置文件失败: ${args.configPath}`, error.message);
            process.exit(1);
        }
    }

    const player1Config = await loadPlayerConfig(args.player1ConfigPath, baseConfig.player1?.customization || {});
    const player2Config = await loadPlayerConfig(args.player2ConfigPath, baseConfig.player2?.customization || {});

    const player1Name = args.player1 || baseConfig.player1?.name;
    const player2Name = args.player2 || baseConfig.player2?.name;

    if (!player1Name || !player2Name) {
        printUsage();
        process.exit(1);
    }

    const iterations = Number.isInteger(args.iterations) && args.iterations > 0
        ? args.iterations
        : Number.isInteger(baseConfig.iterations) && baseConfig.iterations > 0
            ? baseConfig.iterations
            : 1000;

    const histogramBins = Number.isInteger(args.histogramBins) && args.histogramBins > 0
        ? args.histogramBins
        : Number.isInteger(baseConfig.histogramBins) && baseConfig.histogramBins > 0
            ? baseConfig.histogramBins
            : 12;

    const seedValue = normalizeSeed(args.seed ?? baseConfig.seed);
    const rng = seedValue !== undefined ? createSeededGenerator(seedValue) : null;

    const player1 = generateAttributes(player1Name, player1Config);
    const player2 = generateAttributes(player2Name, player2Config);

    const report = await runBatchSimulation({
        player1,
        player2,
        iterations,
        histogramBins,
        randomGenerator: rng ? () => rng() : null
    });

    if (args.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log('=======================================');
    console.log(`批量战斗模拟: ${player1.name} VS ${player2.name}`);
    console.log(`模拟次数: ${iterations}${seedValue !== undefined ? ` | 随机种子: ${seedValue}` : ''}`);
    console.log('=======================================');

    printTableSummary(report);

    renderHistogram(`${player1.name} 每次攻击伤害分布`, report.players.player1.attackHistogram);
    renderHistogram(`${player2.name} 每次攻击伤害分布`, report.players.player2.attackHistogram);
    renderHistogram('回合数分布', report.roundHistogram);
}

main().catch(error => {
    console.error('执行平衡分析时发生错误:', error);
    process.exit(1);
});
