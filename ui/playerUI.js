// 玩家UI模块
import { updateHealthMeter, resetHealthMeter } from './healthBar.js';

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

function formatNonNegativeInteger(value, minimum = 0) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '-';
    }
    const normalized = Math.max(minimum, Math.floor(value));
    return normalized.toString();
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
    '破败': { color: '#8f93a3', label: '破败' },
    poor: { color: '#8f93a3', label: '破败' },
    '普通': { color: '#f4f1ff', label: '普通' },
    common: { color: '#f4f1ff', label: '普通' },
    '精巧': { color: '#6dd39e', label: '精巧' },
    uncommon: { color: '#6dd39e', label: '精巧' },
    '卓越': { color: '#59a6ff', label: '卓越' },
    rare: { color: '#59a6ff', label: '卓越' },
    '珍奇': { color: '#c282ff', label: '珍奇' },
    epic: { color: '#c282ff', label: '珍奇' },
    '稀世': { color: '#ff9b52', label: '稀世' },
    legendary: { color: '#ff9b52', label: '稀世' }
};

function getRarityStyle(quality) {
    if (!quality) {
        return null;
    }

    const trimmed = `${quality}`.trim();
    const lowerCase = trimmed.toLowerCase();
    return RARITY_STYLES[trimmed] || RARITY_STYLES[lowerCase] || null;
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
        level: document.getElementById(`${prefix}-level`),
        experience: document.getElementById(`${prefix}-experience`),
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
        if (elements.level) {
            elements.level.textContent = formatNonNegativeInteger(player.level, 1);
        }
        if (elements.experience) {
            elements.experience.textContent = formatNonNegativeInteger(player.experience, 0);
        }
    }

    if (shouldUpdate('stats')) {
        // 计算考虑临时效果后的实际属性值
        let actualAttack = player.attack;
        let actualDefense = player.defense;
        let actualSpeed = player.speed;

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

        // 应用速度相关临时效果
        if (player.speedBoostDuration > 0) {
            actualSpeed += player.skill?.speedBoost || 0;
        }

        elements.attack.textContent = formatNumericDisplay(actualAttack);
        elements.defense.textContent = formatNumericDisplay(actualDefense);
        elements.speed.textContent = formatNumericDisplay(actualSpeed);

        elements.attack.style.color = (player.attackBoostDuration > 0 || player.attackReductionDuration > 0) ? '#FF9800' : '';
        elements.defense.style.color = (player.defenseBoostDuration > 0 || player.attackBoostDuration > 0) ? '#FF9800' : '';
        elements.speed.style.color = player.speedBoostDuration > 0 ? '#FF9800' : '';

        const speedLabel = document.querySelector(`[data-speed-label="${prefix}"]`);
        if (speedLabel) {
            speedLabel.textContent = '加速';
        }
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
        if (player.poison > 0) statusEffects.push(`中毒 (${player.poison}回合)`);
        if (player.burn > 0) statusEffects.push(`燃烧 (${player.burn}回合)`);
        if (player.freeze) statusEffects.push('冰冻');
        if (player.taunted) statusEffects.push('嘲讽');
        if (player.shield > 0) statusEffects.push(`护盾 (${player.shield})`);
        if (player.critChance > 0.1) statusEffects.push(`会心提升 (${Math.floor((player.critChance - 0.1) * 100)}%)`);
        if (player.reflection > 0) statusEffects.push(`反射伤害 (${Math.floor(player.reflection * 100)}%)`);
        if (player.parryChance > 0) statusEffects.push(`招架率提升 (${Math.floor(player.parryChance * 100)}%)`);

        const statusFragment = document.createDocumentFragment();
        if (statusEffects.length > 0) {
            statusEffects.forEach(effect => {
                const effectDiv = document.createElement('div');
                effectDiv.className = 'detail-entry status-item';
                effectDiv.textContent = effect;
                statusFragment.appendChild(effectDiv);
            });
            elements.status.innerHTML = '';
            elements.status.appendChild(statusFragment);
        } else {
            renderEmptyMessage(elements.status, '无特殊状态');
        }
    }
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

    // 玩家2
    document.getElementById('p2-name').textContent = '-';
    document.getElementById('p2-attack').textContent = '-';
    document.getElementById('p2-defense').textContent = '-';
    document.getElementById('p2-speed').textContent = '-';
    document.getElementById('p2-skill').textContent = '-';
    renderEmptyMessage(document.getElementById('p2-equipment'), '暂无装备');
    renderEmptyMessage(document.getElementById('p2-status'), '无特殊状态');
    resetHealthMeter('p2');
}

export { updatePlayerInfo, initPlayerPanels };
