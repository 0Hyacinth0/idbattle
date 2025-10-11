// 玩家UI模块
import { updateHealthMeter, resetHealthMeter } from './healthBar.js';

// 更新玩家信息显示
function updatePlayerInfo(player, isPlayer1) {
    const prefix = isPlayer1 ? 'p1' : 'p2';

    // 初始化招架几率(如果不存在)
    player.parryChance = player.parryChance || 0;

    // 使用对象存储DOM元素引用，避免多次查询
    const elements = {
        name: document.getElementById(`${prefix}-name`),
        health: document.getElementById(`${prefix}-health`),
        maxHealth: document.getElementById(`${prefix}-max-health`),
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

    // 更新基本属性（考虑临时效果）
    elements.name.textContent = player.name;
    elements.health.textContent = player.health;
    elements.maxHealth.textContent = player.maxHealth;
    updateHealthMeter(prefix, player.health, player.maxHealth);

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

    // 更新UI显示，添加颜色区分临时效果
    elements.attack.textContent = actualAttack;
    elements.defense.textContent = actualDefense;
    elements.speed.textContent = actualSpeed;

    // 如果有临时效果，改变显示颜色
    elements.attack.style.color = (player.attackBoostDuration > 0 || player.attackReductionDuration > 0) ? '#FF9800' : '';
    elements.defense.style.color = (player.defenseBoostDuration > 0 || player.attackBoostDuration > 0) ? '#FF9800' : '';
    elements.speed.style.color = player.speedBoostDuration > 0 ? '#FF9800' : '';

    // 重命名UI显示为加速 - 添加data属性避免重复更新
    if (elements.speed && elements.speed.parentElement) {
        const parentElement = elements.speed.parentElement;
        if (!parentElement.dataset.speedLabelUpdated) {
            parentElement.innerHTML = parentElement.innerHTML.replace(/^.*?:/, '加速:');
            parentElement.dataset.speedLabelUpdated = 'true';
        }
    }

    elements.skill.textContent = `${player.skill.name} (${player.skill.description})`;

    // 格式化属性显示的辅助函数
    function formatProperty(name, value) {
        if (value === 0) return '';
        if (value > 0) return `${name}+${value}`;
        return `${name}${value}`; // 负数自动带负号
    }

    // 更新装备信息 - 使用DocumentFragment减少重排
    const equipmentFragment = document.createDocumentFragment();

    if (player.equipment) {
        Object.entries(player.equipment).forEach(([type, item]) => {
            const equipmentDiv = document.createElement('div');
            // 找到装备名称（通过属性匹配，而不是引用比较）
            const equipmentName = Object.keys(window.equipmentList || {}).find(key => 
                window.equipmentList[key].type === item.type &&
                window.equipmentList[key].attack === item.attack &&
                window.equipmentList[key].defense === item.defense &&
                window.equipmentList[key].health === item.health &&
                window.equipmentList[key].speed === item.speed &&
                window.equipmentList[key].套装 === item.套装
            ) || '未知装备';

            // 格式化各个属性
            const attackStr = formatProperty('攻击', item.attack);
            const defenseStr = formatProperty('防御', item.defense);
            const healthStr = formatProperty('生命', item.health);
            const speedStr = formatProperty('速度', item.speed);

            // 过滤掉空字符串并连接属性
            const properties = [attackStr, defenseStr, healthStr, speedStr].filter(Boolean).join(', ');

            equipmentDiv.textContent = `${type}: ${equipmentName} (${properties})`;
            equipmentFragment.appendChild(equipmentDiv);
        });
    }

    // 更新套装效果
    if (player.setEffects && player.setEffects.activeSet) {
        const setEffectDiv = document.createElement('div');
        setEffectDiv.textContent = `套装: ${player.setEffects.description} (装备了${player.setEffects.setCount}件)`;
        setEffectDiv.style.fontWeight = 'bold';
        equipmentFragment.appendChild(setEffectDiv);
    }

    // 一次性更新装备DOM
    elements.equipment.innerHTML = '';
    elements.equipment.appendChild(equipmentFragment);

    // 更新状态效果 - 使用DocumentFragment减少重排
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
            effectDiv.textContent = effect;
            statusFragment.appendChild(effectDiv);
        });
        elements.status.innerHTML = '';
        elements.status.appendChild(statusFragment);
    } else {
        elements.status.textContent = '无特殊状态';
    }
}

// 初始化玩家信息面板
function initPlayerPanels() {
    // 玩家1
    document.getElementById('p1-name').textContent = '-';
    document.getElementById('p1-health').textContent = '-';
    document.getElementById('p1-max-health').textContent = '-';
    document.getElementById('p1-attack').textContent = '-';
    document.getElementById('p1-defense').textContent = '-';
    document.getElementById('p1-speed').textContent = '-';
    document.getElementById('p1-skill').textContent = '-';
    document.getElementById('p1-equipment').innerHTML = '';
    document.getElementById('p1-status').textContent = '无特殊状态';
    resetHealthMeter('p1');

    // 玩家2
    document.getElementById('p2-name').textContent = '-';
    document.getElementById('p2-health').textContent = '-';
    document.getElementById('p2-max-health').textContent = '-';
    document.getElementById('p2-attack').textContent = '-';
    document.getElementById('p2-defense').textContent = '-';
    document.getElementById('p2-speed').textContent = '-';
    document.getElementById('p2-skill').textContent = '-';
    document.getElementById('p2-equipment').innerHTML = '';
    document.getElementById('p2-status').textContent = '无特殊状态';
    resetHealthMeter('p2');
}

export { updatePlayerInfo, initPlayerPanels };
