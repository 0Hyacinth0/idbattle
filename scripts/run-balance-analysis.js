#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
    evaluatePlans,
    deriveBalanceAdjustments,
    generateRandomSequences
} from '../services/balanceAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baselinePlan = { name: '基准养成', overrides: {} };
const growthPlans = [
    { name: '均衡养成', overrides: {} },
    { name: '暴击流', overrides: { attack: 52, defense: 12 } },
    { name: '铁壁流', overrides: { attack: 28, defense: 30, health: 280 } }
];

const randomSequences = generateRandomSequences(20240521, 8, 6);

console.log('运行对比战斗模拟...');
const evaluation = await evaluatePlans(growthPlans, baselinePlan, randomSequences);
for (const [planName, { averageScore, runs }] of evaluation.entries()) {
    console.log(`  方案: ${planName} => 平均分 ${averageScore.toFixed(2)} (样本 ${runs})`);
}

const { adjustments, flaggedPlans } = deriveBalanceAdjustments(evaluation, { imbalanceThreshold: 30 });

if (flaggedPlans.length === 0) {
    console.log('所有方案均在合理范围内，无需更新平衡配置。');
} else {
    console.log('检测到以下超出阈值的方案:');
    flaggedPlans.forEach(({ planName, averageScore }) => {
        console.log(`  - ${planName}: 平均分 ${averageScore.toFixed(2)}`);
    });

    const balanceConfigPath = resolve(__dirname, '../config/balanceAdjustments.json');
    const payload = {
        ...adjustments,
        generatedAt: new Date().toISOString(),
        sampleSize: Array.from(evaluation.values())[0]?.runs ?? 0,
        randomSequenceSeed: 20240521
    };
    await writeFile(balanceConfigPath, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`已根据模拟结果更新 ${balanceConfigPath}`);
    console.log('新的平衡参数:', adjustments);
}
