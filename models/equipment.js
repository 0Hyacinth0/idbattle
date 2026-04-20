import { equipmentConfig } from '../config/equipmentConfig.js';
import { setConfig } from '../config/setConfig.js';

/**
 * @typedef {Object} EquipmentBase
 * @property {string} name - 装备名称
 * @property {string} type - 装备类型标签
 * @property {string} typeKey - 装备内部标识键
 * @property {string} [set] - 所属套装
 * @property {string} quality - 装备品质
 * @property {Object.<string, number>} baseAttributes - 基础属性键值对
 */

/**
 * @typedef {EquipmentBase} EquipmentInstance
 * @property {number} enhancementLevel - 精炼等级
 * @property {Object.<string, number>} attributes - 计算精炼加成后的最终属性
 */

/**
 * @enum {string}
 */
const EquipmentType = {
    WEAPON: '武器',
    ARMOR: '上衣',
    HELMET: '帽子',
    BOOTS: '鞋子',
    ACCESSORY: '精简'
};

const QUALITY_MULTIPLIERS = {
    '破败': 0.92,
    '普通': 1,
    '精巧': 1.06,
    '卓越': 1.12,
    '珍奇': 1.18,
    '稀世': 1.25
};

const MAX_ENHANCEMENT_LEVEL = 6;

/**
 * 限制并归一化精炼等级
 * @param {number} level - 输入等级
 * @returns {number} 归一化后的有效等级
 */
function normalizeEnhancementLevel(level) {
    if (typeof level !== 'number' || Number.isNaN(level)) {
        return 0;
    }
    return Math.min(Math.max(Math.floor(level), 0), MAX_ENHANCEMENT_LEVEL);
}

/**
 * 计算包含精炼加成的装备属性
 * @param {Object.<string, number>} attributes - 基础属性
 * @param {string} quality - 装备品质
 * @param {number} enhancementLevel - 精炼等级
 * @returns {Object.<string, number>} 最终属性对象
 */
function calculateAttributeWithEnhancement(attributes, quality, enhancementLevel) {
    const normalizedEnhancement = normalizeEnhancementLevel(enhancementLevel);
    const multiplier = (QUALITY_MULTIPLIERS[quality] || 1) * (1 + normalizedEnhancement * 0.05);
    return Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [key, typeof value === 'number' ? value * multiplier : value])
    );
}

function deriveEnhancementLevelFromHash(hash, typeKey, itemName) {
    if (typeof hash !== 'string' || hash.length < 2) {
        return 0;
    }

    const typeSegment = typeof typeKey === 'string' ? typeKey : '';
    const nameSegment = typeof itemName === 'string' ? itemName : '';
    const seedSource = `${typeSegment}:${nameSegment}`;

    let seed = 0;
    for (let i = 0; i < seedSource.length; i += 1) {
        seed = (seed + seedSource.charCodeAt(i)) & 0xff;
    }

    const startIndex = seed % (hash.length - 1);
    const slice = hash.substr(startIndex, 2);
    const value = Number.parseInt(slice, 16);

    if (Number.isNaN(value)) {
        return 0;
    }

    return normalizeEnhancementLevel(value % (MAX_ENHANCEMENT_LEVEL + 1));
}

const equipmentList = {};
const equipmentByType = {};

for (const item of equipmentConfig) {
    const type = EquipmentType[item.typeKey];
    if (!type) {
        continue;
    }

    const baseItem = {
        name: item.name,
        type,
        typeKey: item.typeKey,
        set: item.set,
        quality: item.quality,
        baseAttributes: { ...item.attributes }
    };

    equipmentList[item.name] = baseItem;
    if (!equipmentByType[type]) {
        equipmentByType[type] = [];
    }
    equipmentByType[type].push(baseItem);
}

const setEffects = {};
setConfig.forEach(set => {
    setEffects[set.name] = set.effects;
});

/**
 * 创建装备实例（包含精炼后属性）
 * @param {EquipmentBase} baseItem - 基础装备对象
 * @param {number} [enhancementLevel=0] - 精炼等级
 * @returns {EquipmentInstance|null} 装备实例
 */
function createEquipmentInstance(baseItem, enhancementLevel) {
    if (!baseItem) {
        return null;
    }

    const level = typeof enhancementLevel === 'number'
        ? normalizeEnhancementLevel(enhancementLevel)
        : 0;

    return {
        name: baseItem.name,
        type: baseItem.type,
        typeKey: baseItem.typeKey,
        set: baseItem.set,
        quality: baseItem.quality,
        enhancementLevel: level,
        attributes: calculateAttributeWithEnhancement(baseItem.baseAttributes, baseItem.quality, level)
    };
}

/**
 * 根据名称获取基础装备对象
 * @param {string} name - 装备名称
 * @returns {EquipmentBase|null} 基础装备对象
 */
function getEquipmentByName(name) {
    return equipmentList[name] || null;
}

/**
 * 获取指定名称和精炼等级的装备实例
 * @param {string} name - 装备名称
 * @param {number} enhancementLevel - 精炼等级
 * @returns {EquipmentInstance|null} 装备实例
 */
function getEquipmentWithEnhancement(name, enhancementLevel) {
    const baseItem = getEquipmentByName(name);
    return createEquipmentInstance(baseItem, enhancementLevel);
}

export {
    EquipmentType,
    equipmentList,
    setEffects,
    equipmentByType,
    getEquipmentByName,
    getEquipmentWithEnhancement,
    createEquipmentInstance,
    MAX_ENHANCEMENT_LEVEL,
    deriveEnhancementLevelFromHash
};
