// 玩家UI模块
import { updateHealthMeter, resetHealthMeter } from './healthBar.js';
import { battleStore } from '../store/BattleStore.js';

// 统一格式化数值展示，避免出现过多小数位
function formatNumericDisplay(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return value;
    }

    const rounded = Math.round(value * 10) / 10;
    const normalized = Math.abs(rounded) < 0.0001 ? 0 : rounded;

    if (Number.isInteger(normalized)) {
        return normalized.toString();
    }

    return normalized.toFixed(1).replace(/\.0$/, '');
}

function formatEquipmentProperty(name, value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '';
    }

    const rounded = Math.round(value * 10) / 10;
    if (Math.abs(rounded) < 0.05) {
        return '';
    }

    const sign = rounded > 0 ? '+' : '-';
    const magnitude = formatNumericDisplay(Math.abs(rounded));
    return `${name}${sign}${magnitude}`;
}

const ATTRIBUTE_LABELS = {
    attack: '攻击',
    defense: '防御',
    health: '生命',
    speed: '速度',
    critChance: '会心',
    critDamage: '会心伤害',
    parryChance: '招架',
    dodge: '闪避',
    block: '格挡',
    lifeSteal: '吸血',
    resilience: '韧性'
};

const RARITY_STYLES = {
    '破败': { color: 'var(--rarity-poor, #8f93a3)', label: '破败' },
    '普通': { color: 'var(--rarity-normal, #f4f1ff)', label: '普通' },
    '精巧': { color: 'var(--rarity-magic, #6dd39e)', label: '精巧' },
    '卓越': { color: 'var(--rarity-rare, #59a6ff)', label: '卓越' },
    '珍奇': { color: 'var(--rarity-epic, #c282ff)', label: '珍奇' },
    '稀世': { color: 'var(--rarity-legendary, #ff9b52)', label: '稀世' }
};

function getRarityStyle(quality) {
    if (!quality) {
        return null;
    }

    const trimmed = `${quality}`.trim();
    return RARITY_STYLES[trimmed] || null;
}

function createTooltipLine(text, className) {
    const line = document.createElement('span');
    if (className) {
        line.className = className;
    }
    line.textContent = text;
    return line;
}

function buildEquipmentTooltip(type, item) {
    const equipmentDiv = document.createElement('div');
    equipmentDiv.className = 'detail-entry equipment-item';
    equipmentDiv.tabIndex = 0;

    const header = document.createElement('div');
    header.className = 'equipment-item__header';

    const slotLabel = document.createElement('span');
    slotLabel.className = 'equipment-slot';
    slotLabel.textContent = type;
    header.appendChild(slotLabel);

    const formatEquipmentName = (equipment) => {
        const baseName = (equipment && equipment.name) ? equipment.name : '未知装备';
        if (equipment && typeof equipment.enhancementLevel === 'number') {
            return `${baseName} +${equipment.enhancementLevel}`;
        }
        return baseName;
    };

    const nameSpan = document.createElement('span');
    nameSpan.className = 'equipment-name';
    nameSpan.textContent = formatEquipmentName(item);
    header.appendChild(nameSpan);

    const rarityStyle = getRarityStyle(item.quality);
    if (rarityStyle) {
        const rarityChip = document.createElement('span');
        rarityChip.className = 'equipment-rarity-chip';
        rarityChip.style.setProperty('--rarity-color', rarityStyle.color);
        rarityChip.setAttribute('aria-hidden', 'true');
        header.appendChild(rarityChip);
        equipmentDiv.style.setProperty('--item-rarity-color', rarityStyle.color);
    }

    equipmentDiv.appendChild(header);

    const tooltip = document.createElement('div');
    tooltip.className = 'equipment-tooltip';

    const tooltipName = document.createElement('div');
    tooltipName.className = 'equipment-tooltip__name';
    tooltipName.textContent = formatEquipmentName(item);
    tooltip.appendChild(tooltipName);

    if (rarityStyle) {
        nameSpan.style.color = rarityStyle.color;
        tooltipName.style.color = rarityStyle.color;
        const rarityLine = createTooltipLine(`稀有度：${rarityStyle.label}`, 'equipment-tooltip__rarity');
        rarityLine.style.color = rarityStyle.color;
        tooltip.appendChild(rarityLine);
    }

    const metaInfo = [];
    if (typeof item.enhancementLevel === 'number') {
        metaInfo.push(`精炼 +${item.enhancementLevel}`);
    }
    if (item.set) {
        metaInfo.push(`套装：${item.set}`);
    }

    if (metaInfo.length > 0) {
        const metaContainer = document.createElement('div');
        metaContainer.className = 'equipment-tooltip__meta';
        metaInfo.forEach(info => {
            metaContainer.appendChild(createTooltipLine(info));
        });
        tooltip.appendChild(metaContainer);
    }

    const attributes = item.attributes || {};
    const formattedAttributes = Object.entries(attributes).reduce((result, [key, value]) => {
        const label = ATTRIBUTE_LABELS[key] || key;
        const formatted = formatEquipmentProperty(label, value);
        if (formatted) {
            result.push(formatted);
        }
        return result;
    }, []);

    const statsContainer = document.createElement('div');
    statsContainer.className = 'equipment-tooltip__stats';

    if (formattedAttributes.length > 0) {
        formattedAttributes.forEach(text => {
            statsContainer.appendChild(createTooltipLine(text));
        });
    } else {
        statsContainer.appendChild(createTooltipLine('无额外属性', 'equipment-tooltip__empty'));
    }

    tooltip.appendChild(statsContainer);
    equipmentDiv.appendChild(tooltip);

    return equipmentDiv;
}

function renderEmptyMessage(container, message) {
    if (!container) {
        return;
    }

    container.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'detail-entry detail-placeholder';
    placeholder.textContent = message;
    container.appendChild(placeholder);
}

// 更新玩家信息显示
function updatePlayerInfo(player, isPlayer1, options = {}) {
    const prefix = isPlayer1 ? 'p1' : 'p2';
    const sections = Array.isArray(options.sections) ? new Set(options.sections) : null;
    const shouldUpdate = (section) => !sections || sections.has(section);

    // 初始化招架几率(如果不存在)
    player.parryChance = player.parryChance || 0;

    // 使用对象存储DOM元素引用，避免多次查询
    const elements = {
        name: document.getElementById(`${prefix}-name`),
        attack: document.getElementById(`${prefix}-attack`),
        defense: document.getElementById(`${prefix}-defense`),
        speed: document.getElementById(`${prefix}-speed`),
        skill: document.getElementById(`${prefix}-skill`),
        equipment: document.getElementById(`${prefix}-equipment`),
        status: document.getElementById(`${prefix}-status`)
    };

    // 错误处理：检查DOM元素是否存在
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`DOM元素不存在: ${prefix}-${key}`);
            return;
        }
    }

    if (shouldUpdate('summary')) {
        elements.name.textContent = player.name;
        updateHealthMeter(prefix, player.health, player.maxHealth);
        if (elements.skill && player.skill) {
            elements.skill.textContent = `${player.skill.name} (${player.skill.description})`;
        }
    }

    if (shouldUpdate('stats')) {
        // 计算考虑临时效果后的实际属性值
        let actualAttack = player.attack;
        let actualDefense = player.defense;
        const actualSpeed = player.speed;

        // 应用攻击相关临时效果
        if (player.attackBoostDuration > 0) {
            actualAttack += player.skill?.attackBoost || 0;
        }
        if (player.attackReductionDuration > 0) {
            actualAttack -= player.originalAttackReductionValue || 0;
        }

        // 应用防御相关临时效果
        if (player.defenseBoostDuration > 0) {
            actualDefense += player.skill?.defenseBoost || 0;
        }
        if (player.attackBoostDuration > 0) {
            actualDefense -= player.skill?.defensePenalty || 0;
        }

        elements.attack.textContent = formatNumericDisplay(actualAttack);
        elements.defense.textContent = formatNumericDisplay(actualDefense);
        elements.speed.textContent = formatNumericDisplay(actualSpeed);

        elements.attack.style.color = (player.attackBoostDuration > 0 || player.attackReductionDuration > 0) ? '#FF9800' : '';
        elements.defense.style.color = (player.defenseBoostDuration > 0 || player.attackBoostDuration > 0) ? '#FF9800' : '';
        elements.speed.style.color = '';
    }

    if (shouldUpdate('equipment')) {
        const equipmentFragment = document.createDocumentFragment();

        if (player.equipment) {
            Object.entries(player.equipment).forEach(([type, item]) => {
                if (!item) {
                    return;
                }

                const equipmentEntry = buildEquipmentTooltip(type, item);
                equipmentFragment.appendChild(equipmentEntry);
            });
        }

        if (player.setEffects && player.setEffects.activeSet) {
            const setEffectDiv = document.createElement('div');
            setEffectDiv.className = 'detail-entry set-effect-entry';
            setEffectDiv.textContent = `套装：${player.setEffects.description} (装备了${player.setEffects.setCount}件)`;
            equipmentFragment.appendChild(setEffectDiv);
        }

        elements.equipment.innerHTML = '';
        if (equipmentFragment.childNodes.length > 0) {
            elements.equipment.appendChild(equipmentFragment);
        } else {
            renderEmptyMessage(elements.equipment, '暂无装备');
        }
    }

    if (shouldUpdate('status')) {
        const statusEffects = [];
        // Helper to push stylized status objects
        const addStatus = (label, type, duration = '') => {
            statusEffects.push({ label, type, duration });
        };

        if (player.poison > 0) addStatus('中毒', 'debuff', `${player.poison}回合`);
        if (player.freeze) addStatus('冰冻', 'debuff');
        if (player.taunted) addStatus('嘲讽', 'debuff');
        if (player.shield > 0) addStatus(`护盾 (${player.shield})`, 'buff');

        if (player.critChanceBoostDuration > 0) {
            addStatus(`会心提升`, 'buff', `${player.critChanceBoostDuration}回合`);
        }
        if (player.reflectionDuration > 0) {
            addStatus(`反射伤害`, 'buff', `${player.reflectionDuration}回合`);
        }
        if (player.parryChance > 0) addStatus(`招架提升`, 'buff');

        if (player.attackBoostDuration > 0) {
            addStatus(`攻击提升`, 'buff', `${player.attackBoostDuration}回合`);
        }
        if (player.attackReductionDuration > 0) {
            addStatus(`防御下降`, 'debuff', `${player.attackReductionDuration}回合`);
        }
        if (player.defenseBoostDuration > 0) {
            addStatus(`防御提升`, 'buff', `${player.defenseBoostDuration}回合`);
        }
        if (player.armorPenetrationDuration > 0) {
            addStatus(`破甲效果`, 'debuff', `${player.armorPenetrationDuration}回合`);
        }

        const statusFragment = document.createDocumentFragment();
        if (statusEffects.length > 0) {
            statusEffects.forEach(effect => {
                const effectDiv = document.createElement('div');
                effectDiv.className = `status-icon status-icon--${effect.type}`;

                const iconSpan = document.createElement('span');
                iconSpan.className = 'status-icon__img';
                iconSpan.textContent = effect.type === 'buff' ? '🟢' : '🔴';

                const textSpan = document.createElement('span');
                textSpan.className = 'status-icon__text';
                textSpan.textContent = effect.duration ? `${effect.label} [${effect.duration}]` : effect.label;

                effectDiv.appendChild(iconSpan);
                effectDiv.appendChild(textSpan);
                statusFragment.appendChild(effectDiv);
            });
            elements.status.innerHTML = '';
            elements.status.appendChild(statusFragment);
        } else {
            renderEmptyMessage(elements.status, '无特殊状态');
        }
    }
}

// 更新行动条 (ATB) UI
function updateAtbMeter(apState) {
    if (!apState) return;
    const p1Fill = document.getElementById('p1-atb-fill');
    const p2Fill = document.getElementById('p2-atb-fill');

    if (p1Fill) p1Fill.style.width = `${Math.min(100, (apState.p1 / 1000) * 100)}%`;
    if (p2Fill) p2Fill.style.width = `${Math.min(100, (apState.p2 / 1000) * 100)}%`;
}

// 初始化玩家信息面板
function initPlayerPanels() {
    // 玩家1
    document.getElementById('p1-name').textContent = '-';
    document.getElementById('p1-attack').textContent = '-';
    document.getElementById('p1-defense').textContent = '-';
    document.getElementById('p1-speed').textContent = '-';
    document.getElementById('p1-skill').textContent = '-';
    renderEmptyMessage(document.getElementById('p1-equipment'), '暂无装备');
    renderEmptyMessage(document.getElementById('p1-status'), '无特殊状态');
    resetHealthMeter('p1');
    const p1Atb = document.getElementById('p1-atb-fill');
    if (p1Atb) p1Atb.style.width = '0%';

    // 玩家2
    document.getElementById('p2-name').textContent = '-';
    document.getElementById('p2-attack').textContent = '-';
    document.getElementById('p2-defense').textContent = '-';
    document.getElementById('p2-speed').textContent = '-';
    document.getElementById('p2-skill').textContent = '-';
    renderEmptyMessage(document.getElementById('p2-equipment'), '暂无装备');
    renderEmptyMessage(document.getElementById('p2-status'), '无特殊状态');
    resetHealthMeter('p2');
    const p2Atb = document.getElementById('p2-atb-fill');
    if (p2Atb) p2Atb.style.width = '0%';

    battleStore.subscribe((state, changedKeys) => {
        if (changedKeys.includes('player1') && state.player1) {
            updatePlayerInfo(state.player1, true);
        }
        if (changedKeys.includes('player2') && state.player2) {
            updatePlayerInfo(state.player2, false);
        }
        if (changedKeys.includes('apState') && state.apState) {
            updateAtbMeter(state.apState);
        }
    });
}

export { updatePlayerInfo, initPlayerPanels, getRarityStyle };
