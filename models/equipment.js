import { equipmentConfig } from '../config/equipmentConfig.js';
import { setConfig } from '../config/setConfig.js';

const EquipmentType = {
    WEAPON: '武器',
    ARMOR: '上衣',
    HELMET: '帽子',
    BOOTS: '鞋子',
    ACCESSORY: '精简'
};

const QUALITY_MULTIPLIERS = {
    legendary: 1.08,
    epic: 1.05,
    rare: 1.03,
    common: 1
};

function calculateAttributeWithEnhancement(attributes, quality, enhancementLevel) {
    const multiplier = (QUALITY_MULTIPLIERS[quality] || 1) * (1 + enhancementLevel * 0.05);
    return Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [key, typeof value === 'number' ? value * multiplier : value])
    );
}

const equipmentList = {};
const equipmentByType = {};

for (const item of equipmentConfig) {
    const type = EquipmentType[item.typeKey];
    if (!type) {
        continue;
    }

    const normalizedAttributes = calculateAttributeWithEnhancement(item.attributes, item.quality, item.enhancementLevel);
    const equipmentItem = {
        name: item.name,
        type,
        typeKey: item.typeKey,
        set: item.set,
        quality: item.quality,
        enhancementLevel: item.enhancementLevel,
        attributes: normalizedAttributes
    };

    equipmentList[item.name] = equipmentItem;
    if (!equipmentByType[type]) {
        equipmentByType[type] = [];
    }
    equipmentByType[type].push(equipmentItem);
}

const setEffects = {};
setConfig.forEach(set => {
    setEffects[set.name] = set.effects;
});

function getEquipmentByName(name) {
    return equipmentList[name];
}

export { EquipmentType, equipmentList, setEffects, equipmentByType, getEquipmentByName };
