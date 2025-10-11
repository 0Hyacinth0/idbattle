// 装备类型枚举
const EquipmentType = {
    WEAPON: '武器',
    ARMOR: '上衣',
    HELMET: '帽子',
    BOOTS: '鞋子',
    ACCESSORY: '精简'
};

// 装备列表
const equipmentList = {
    // 武器
    '风雷瑶琴剑': { type: EquipmentType.WEAPON, attack: 12, defense: 3, health: 25, speed: 1,套装: '根骨' },  // 根骨：高内力、中等防御
    '炎枪重黎': { type: EquipmentType.WEAPON, attack: 18, defense: 0, health: 5, speed: 0,套装: '力道' },   // 力道：高攻击
    '雪凤冰王笛': { type: EquipmentType.WEAPON, attack: 15, defense: 1, health: 15, speed: 3,套装: '元气' },  // 元气：高攻击、高速度
    '画影': { type: EquipmentType.WEAPON, attack: 14, defense: 0, health: 5, speed: 4,套装: '身法' },   // 身法：中等攻击、高速度
    '斩马刑天': { type: EquipmentType.WEAPON, attack: 10, defense: 4, health: 30, speed: 2,套装: '体质' }, // 体质：高生命、高防御

    // 上衣
    '月涛衣': { type: EquipmentType.ARMOR, attack: 0, defense: 15, health: 40, speed: -1,套装: '根骨' },  // 根骨：高防御、高生命
    '月溪衣': { type: EquipmentType.ARMOR, attack: 5, defense: 8, health: 15, speed: 1,套装: '力道' },    // 力道：中等攻击、中等防御
    '月声衣': { type: EquipmentType.ARMOR, attack: 7, defense: 4, health: 10, speed: 3,套装: '元气' },    // 元气：高攻击、高速度
    '月霭衣': { type: EquipmentType.ARMOR, attack: 3, defense: 10, health: 20, speed: 2,套装: '身法' },   // 身法：中等防御、高速度
    '月钟衣': { type: EquipmentType.ARMOR, attack: 2, defense: 12, health: 30, speed: 1,套装: '体质' },   // 体质：高防御、高生命

    // 帽子
    '月涛冠': { type: EquipmentType.HELMET, attack: 0, defense: 8, health: 25, speed: -1,套装: '根骨' },  // 根骨：高防御、高生命
    '月溪冠': { type: EquipmentType.HELMET, attack: 3, defense: 4, health: 10, speed: 1,套装: '力道' },    // 力道：中等攻击、中等防御
    '月声冠': { type: EquipmentType.HELMET, attack: 5, defense: 3, health: 5, speed: 2,套装: '元气' },     // 元气：高攻击、高速度
    '月霭冠': { type: EquipmentType.HELMET, attack: 2, defense: 3, health: 5, speed: 3,套装: '身法' },     // 身法：中等攻击、高速度
    '月钟冠': { type: EquipmentType.HELMET, attack: 1, defense: 6, health: 15, speed: 1,套装: '体质' },  // 体质：高防御、高生命

    // 鞋子
    '月涛履': { type: EquipmentType.BOOTS, attack: 0, defense: 5, health: 15, speed: -1,套装: '根骨' },   // 根骨：高防御、高生命
    '月溪履': { type: EquipmentType.BOOTS, attack: 1, defense: 3, health: 5, speed: 2,套装: '力道' },     // 力道：低攻击、中等防御、中等速度
    '月声履': { type: EquipmentType.BOOTS, attack: 3, defense: 2, health: 5, speed: 4,套装: '元气' },       // 元气：中等攻击、高速度
    '月霭履': { type: EquipmentType.BOOTS, attack: 2, defense: 2, health: 5, speed: 5,套装: '身法' },     // 身法：中等攻击、最高速度
    '月钟履': { type: EquipmentType.BOOTS, attack: 0, defense: 4, health: 10, speed: 3,套装: '体质' },    // 体质：中等防御、高生命、中等速度

    // 精简
    '心自宽': { type: EquipmentType.ACCESSORY, attack: 2, defense: 5, health: 20, speed: 0,套装: '根骨' }, // 根骨：高防御、高生命
    '向天歌': { type: EquipmentType.ACCESSORY, attack: 6, defense: 1, health: 5, speed: 1,套装: '力道' },  // 力道：高攻击
    '满枝春': { type: EquipmentType.ACCESSORY, attack: 5, defense: 0, health: 10, speed: 3,套装: '元气' }, // 元气：高攻击、高速度
    '醉芙蓉': { type: EquipmentType.ACCESSORY, attack: 3, defense: 2, health: 5, speed: 4,套装: '身法' },  // 身法：中等攻击、高速度
    '锁南天': { type: EquipmentType.ACCESSORY, attack: 1, defense: 4, health: 15, speed: 2,套装: '体质' }, // 体质：高防御、高生命
};

// 套装效果定义
const setEffects = {
    '根骨': {
        2: { description: '根骨套装(2件) - 增加 8% 防御力和 5% 生命值', defenseMultiplier: 1.08, healthMultiplier: 1.05 },
        4: { description: '根骨套装(4件) - 增加 15% 防御力、10% 生命值和 3% 攻击力', defenseMultiplier: 1.15, healthMultiplier: 1.1, attackMultiplier: 1.03 }
    },
    '力道': {
        2: { description: '力道套装(2件) - 增加 10% 攻击力和 2% 防御力', attackMultiplier: 1.1, defenseMultiplier: 1.02 },
        4: { description: '力道套装(4件) - 增加 20% 攻击力和 5% 防御力', attackMultiplier: 1.2, defenseMultiplier: 1.05 }
    },
    '元气': {
        2: { description: '元气套装(2件) - 增加 10% 攻击力和 5% 加速', attackMultiplier: 1.1, speedMultiplier: 1.05 },
        4: { description: '元气套装(4件) - 增加 20% 攻击力和 10% 加速', attackMultiplier: 1.2, speedMultiplier: 1.1 }
    },
    '身法': {
        2: { description: '身法套装(2件) - 增加 5% 攻击力、5% 加速和 2% 会心几率', attackMultiplier: 1.05, speedMultiplier: 1.05, critChance: 0.02 },
        4: { description: '身法套装(4件) - 增加 10% 攻击力、10% 加速和 5% 会心几率', attackMultiplier: 1.1, speedMultiplier: 1.1, critChance: 0.05 }
    },
    '体质': {
        2: { description: '体质套装(2件) - 增加 5% 防御力、5% 生命值和 2% 招架几率', defenseMultiplier: 1.05, healthMultiplier: 1.05, parryChance: 0.02 },
        4: { description: '体质套装(4件) - 增加 10% 防御力、10% 生命值和 5% 招架几率', defenseMultiplier: 1.1, healthMultiplier: 1.1, parryChance: 0.05 }
    }
};

// 装备类型分组预处理
const equipmentByType = {};
Object.entries(equipmentList).forEach(([name, item]) => {
    if (!equipmentByType[item.type]) {
        equipmentByType[item.type] = [];
    }
    equipmentByType[item.type].push([name, item]);
});

export { EquipmentType, equipmentList, setEffects, equipmentByType };