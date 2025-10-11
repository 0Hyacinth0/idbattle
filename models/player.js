import simpleMD5 from '../utils/md5.js';
import { EquipmentType, equipmentByType } from './equipment.js';
import skills from './skills.js';
import { calculateSetEffects, applyEquipmentAttributes } from '../services/equipmentService.js';

// 生成玩家属性
function generateAttributes(name) {
    const md5 = simpleMD5(name);

    // 基础属性生成
    let health = 100 + parseInt(md5.substr(0, 2), 16) % 50;
    let attack = 10 + parseInt(md5.substr(2, 2), 16) % 10;
    let defense = 5 + parseInt(md5.substr(4, 2), 16) % 10;
    let speed = 5 + parseInt(md5.substr(6, 2), 16) % 10;

    // 生成技能索引 - 改进为使用更多位哈希值以获得更均匀的分布
    // 结合多个字节的哈希值来增加随机性
    const hash1 = parseInt(md5.substr(0, 2), 16);
    const hash2 = parseInt(md5.substr(2, 2), 16);
    const hash3 = parseInt(md5.substr(4, 2), 16);
    const combinedHash = (hash1 << 16) | (hash2 << 8) | hash3;
    const skillIndex = combinedHash % skills.length;
    const skill = skills[skillIndex];

    // 生成装备
    const equipment = generateEquipment(name);

    // 应用装备属性
    const player = applyEquipmentAttributes({
        name,
        health,
        maxHealth: health,
        attack,
        defense,
        speed,
        skill,
        poison: 0,
        burn: 0,
        freeze: false,
        taunted: false,
        shield: 0,
        reflection: 0,
        critChance: 0.1, // 基础会心几率10%
        parryChance: 0
    }, equipment);

    return player;
}

// 生成装备
function generateEquipment(playerName) {
    // 使用玩家名称生成MD5哈希值
    const md5 = simpleMD5(playerName);
    const equipmentTypes = Object.values(EquipmentType);
    const equipment = {};

    // 为每种装备类型生成一个装备
    equipmentTypes.forEach(type => {
        // 使用类型索引来生成不同类型的装备
        const typeIndex = equipmentTypes.indexOf(type);
        const startIndex = (typeIndex * 2) % 8;
        const equipmentIndex = parseInt(md5.substr(startIndex, 2), 16) % equipmentByType[type].length;
        const [equipmentName, equipmentItem] = equipmentByType[type][equipmentIndex];
        equipment[type] = equipmentItem;
    });

    return equipment;
}

export { generateAttributes };