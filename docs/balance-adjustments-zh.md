# 平衡性调整说明（中文）

本文档总结最新一轮基于自动化分析脚本得出的战斗数值调整。调优流程通过 `scripts/run-balance-analysis.js` 批量运行固定随机序列的模拟对局，根据暴击流与铁壁流等极端成长方案的平均表现，自动回写缓解参数到 `config/balanceAdjustments.json`。本轮分析使用 12 组样本、随机种子 20240521，于 2025-10-13T09:26:36.857Z 生成结果。

## 调整目标

- **抑制高攻方极端输出**：在攻击方比防御方高出大量属性时，引入额外惩罚与会心收益衰减，避免一轮秒杀或多次会心连锁。
- **缓冲高防御堆叠的拖延局**：当防御过度领先时，降低防御减伤收益并提高最低伤害系数，确保战斗仍能推进。
- **保持极端方案可识别**：仍允许偏攻或偏防的数值风格具有差异化，但将其均值表现限制在 ±30 分以内。

## 关键参数变化

| 参数 | 新值 | 作用说明 |
| --- | --- | --- |
| `attackAdvantageMitigation` = 0.2523 | 结合攻击优势比例，削减最终伤害，抑制堆攻暴击的爆发。 |
| `attackMitigationCeiling` = 0.52 | 限制攻击端减益的最大幅度，避免极端情况直接归零。 |
| `attackOverageThreshold` = 15.13 | 当攻击高于防御超过该阈值时触发额外惩罚，缩短过强方案的领先。 |
| `attackOveragePenalty` = 0.2958 | 超阈值后按比例衰减伤害，叠加到攻击减益链路中。 |
| `attackOverageDivisor` = 66.17 | 控制惩罚强度随超额攻击的增长曲线，减缓一次性大幅削弱。 |
| `critDamageMitigation` = 0.1383 | 会心加成受攻防差影响的衰减系数，提高防御对会心的抑制力。 |
| `critMitigationCeiling` = 0.32 | 限制会心衰减的上限，确保会心仍具备威胁。 |
| `defenseAdvantageMitigation` = 0.22 | 当防御领先时，按比例降低减伤效率，防止纯堆防拖死对局。 |
| `defenseMitigationCeiling` = 0.38 | 防御减伤上限，避免出现 100% 吸收场景。 |
| `defenseOverageThreshold` = 22 | 防御超额触发压制的阈值，保障攻方最低输出。 |
| `defenseOveragePenalty` = 0.12 | 超阈值后对防御端的额外削弱，配合最低伤害系数使用。 |
| `minimumDamageScalar` = 0.15 | 所有攻击至少造成攻击力 15% 的伤害，防止战斗僵局。 |
| `critBaseBonus` = 0.5 | 会心基础倍数保持 50%，在衰减后仍具可感知提升。 |

## 实装效果

1. **BattleService 行为更新**：在 `attackEnemy` 流程中读取上述参数，用于计算攻击端的额外削弱、会心衰减、防御端的压制及最低伤害下限。通过组合式阈值与上限设计，既控制峰值也防止伤害为零。【F:services/battleService.js†L1-L115】【F:services/battleService.js†L116-L229】
2. **自动化验证**：`services/balanceAnalyzer.js` 固定随机数列跑多套方案，比较攻防流派平均分差，超出 ±30 分则标记并导出新的缓解参数供战斗服务加载。【F:services/balanceAnalyzer.js†L1-L165】【F:services/balanceAnalyzer.js†L166-L262】
3. **配置落地**：所有调优数值存放在 `config/balanceAdjustments.json`，便于后续脚本覆盖与人工校对。【F:config/balanceAdjustments.json†L1-L18】

## 使用建议

- 若需重新评估平衡性，运行 `node scripts/run-balance-analysis.js`，脚本会在完成后更新配置文件并打印失衡方案名单。
- 建议在提交数值改动前运行 `npm test`，确认战斗模拟覆盖的回归用例仍然通过。
- 如需保留旧参数，请在运行脚本前备份 `config/balanceAdjustments.json`。

