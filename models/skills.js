import { skillConfig } from '../config/skillConfig.js';

/**
 * @typedef {Object} Skill
 * @property {string} name - 技能名称
 * @property {string} description - 技能描述
 * @property {number} triggerChance - 触发概率 (0~1)
 * @property {function} effect - 技能效果函数
 */

/**
 * @type {Skill[]}
 */
const skills = skillConfig.map(skill => ({ ...skill }));

export default skills;
