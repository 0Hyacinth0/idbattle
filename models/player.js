import simpleMD5 from '../utils/md5.js';
import { EquipmentType, equipmentByType, getEquipmentByName, createEquipmentInstance, deriveEnhancementLevelFromHash } from './equipment.js';
import skills from './skills.js';
import { applyEquipmentAttributes } from '../services/equipmentService.js';
import { validateAttributes, mergeAttributes } from '../utils/validation.js';

/**
 * @typedef {Object} Skill
 * @property {string} name - 技能名称
 * @property {string} description - 技能描述
 * @property {number} triggerChance - 触发概率 (0~1)
 * @property {function} effect - 技能效果函数
 */

/**
 * @typedef {Object} BasePlayer
 * @property {string} name - 玩家名称
 * @property {number} health - 当前生命值
 * @property {number} maxHealth - 最大生命值
 * @property {number} attack - 攻击力
 * @property {number} defense - 防御力
 * @property {number} speed - 速度 (决定出手顺序)
 * @property {Skill} skill - 装备的技能
 * @property {number} poison - 中毒层数
 * @property {boolean} freeze - 是否被冰冻
 * @property {boolean} taunted - 是否被嘲讽
 * @property {number} shield - 护盾值
 * @property {number} reflection - 反伤比例 (0~1)
 * @property {number} critChance - 会心概率 (0~1)
 * @property {number} parryChance - 招架概率 (0~1)
 */

/**
 * 根据玩家名称生成基础属性模板
 * @param {string} name - 玩家名称
 * @returns {{ md5: string, basePlayer: BasePlayer, defaultSkill: Skill }} 基础属性模板
 */
function generateBaseTemplate(name) {
    const md5 = simpleMD5(name);
    const baseAttributes = {
        health: 100 + (parseInt(md5.substr(0, 2), 16) % 50),
        attack: 10 + (parseInt(md5.substr(2, 2), 16) % 10),
        defense: 5 + (parseInt(md5.substr(4, 2), 16) % 10),
        speed: 5 + (parseInt(md5.substr(6, 2), 16) % 10),
        critChance: 0.1,
        parryChance: 0,
        shield: 0
    };
    const { sanitized } = validateAttributes(baseAttributes);

    const hash1 = parseInt(md5.substr(0, 2), 16);
    const hash2 = parseInt(md5.substr(2, 2), 16);
    const hash3 = parseInt(md5.substr(4, 2), 16);
    const combinedHash = (hash1 << 16) | (hash2 << 8) | hash3;
    const defaultSkill = skills[combinedHash % skills.length];

    return {
        md5,
        basePlayer: {
            name,
            health: sanitized.health,
            maxHealth: sanitized.health,
            attack: sanitized.attack,
            defense: sanitized.defense,
            speed: sanitized.speed,
            skill: defaultSkill,
            poison: 0,
            freeze: false,
            taunted: false,
            shield: sanitized.shield,
            reflection: 0,
            critChance: sanitized.critChance,
            parryChance: sanitized.parryChance
        },
        defaultSkill
    };
}

function resolveSkill(defaultSkill, override) {
    if (!override) {
        return defaultSkill;
    }

    if (typeof override === 'string') {
        const skill = skills.find(s => s.name === override);
        return skill || defaultSkill;
    }

    if (override && typeof override === 'object' && override.name) {
        return override;
    }

    return defaultSkill;
}

function applyPlayerCustomization(basePlayer, defaultSkill, customization = {}) {
    const { baseOverrides = {}, statAdjustments = {}, skillOverride } = customization;
    const overridden = { ...basePlayer };

    Object.entries(baseOverrides).forEach(([key, value]) => {
        overridden[key] = value;
    });

    const numericFields = ['health', 'attack', 'defense', 'speed', 'critChance', 'parryChance', 'shield'];
    const numericBase = {};
    numericFields.forEach(field => {
        if (typeof overridden[field] === 'number') {
            numericBase[field] = overridden[field];
        }
    });

    const merged = mergeAttributes(numericBase, statAdjustments);
    const { sanitized } = validateAttributes(merged);

    const customized = { ...overridden, ...sanitized };
    if (typeof sanitized.health === 'number') {
        customized.maxHealth = sanitized.health;
    }
    customized.skill = resolveSkill(defaultSkill, skillOverride);

    return customized;
}

const typeKeyByLabel = Object.fromEntries(Object.entries(EquipmentType).map(([key, label]) => [label, key]));

function cloneEquipmentItem(item) {
    return { ...item, attributes: { ...item.attributes } };
}

function generateEquipment(playerName, customization = {}) {
    const { equipmentLoadout = {} } = customization;
    const md5 = simpleMD5(playerName);
    const equipmentTypes = Object.values(EquipmentType);
    const equipment = {};

    equipmentTypes.forEach((type, index) => {
        const typeKey = typeKeyByLabel[type];
        const overrideConfig = equipmentLoadout[typeKey] ?? equipmentLoadout[type];
        let overrideName = null;
        let overrideEnhancement = undefined;

        if (typeof overrideConfig === 'string') {
            overrideName = overrideConfig;
        } else if (overrideConfig && typeof overrideConfig === 'object') {
            overrideName = overrideConfig.name ?? overrideConfig.equipmentName ?? null;
            if (typeof overrideConfig.enhancementLevel === 'number') {
                overrideEnhancement = overrideConfig.enhancementLevel;
            }
        }

        const baseOverride = overrideName ? getEquipmentByName(overrideName) : null;

        let baseItem = baseOverride;
        if (!baseItem) {
            const available = equipmentByType[type] || [];
            if (available.length === 0) {
                return;
            }
            const startIndex = (index * 2) % (md5.length - 1);
            const equipmentIndex = parseInt(md5.substr(startIndex, 2), 16) % available.length;
            baseItem = available[equipmentIndex];
            overrideEnhancement = undefined;
        }

        const hashedLevel = deriveEnhancementLevelFromHash(md5, typeKey, baseItem?.name);
        const equipmentInstance = createEquipmentInstance(
            baseItem,
            typeof overrideEnhancement === 'number' ? overrideEnhancement : hashedLevel
        );
        equipment[type] = cloneEquipmentItem(equipmentInstance);
    });

    return equipment;
}

/**
 * 生成并应用定制化的玩家属性
 * @param {string} name - 玩家名称
 * @param {Object} [customization={}] - 玩家定制化配置
 * @returns {BasePlayer & { md5: string }} 包含装备和属性加成的最终玩家对象
 */
function generateAttributes(name, customization = {}) {
    const { md5, basePlayer, defaultSkill } = generateBaseTemplate(name);
    const customizedPlayer = applyPlayerCustomization(basePlayer, defaultSkill, customization);
    const equipment = generateEquipment(name, customization);

    const playerWithEquipment = applyEquipmentAttributes(customizedPlayer, equipment);
    playerWithEquipment.md5 = md5;

    return playerWithEquipment;
}

function getBasePlayerProfile(name) {
    if (typeof name !== 'string' || name.trim() === '') {
        return null;
    }
    const trimmedName = name.trim();
    const template = generateBaseTemplate(trimmedName);
    return {
        md5: template.md5,
        basePlayer: { ...template.basePlayer },
        defaultSkill: { ...template.defaultSkill }
    };
}

export { generateAttributes, getBasePlayerProfile };
