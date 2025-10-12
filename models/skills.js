import { skillConfig } from '../config/skillConfig.js';

const skills = skillConfig.map(skill => ({ ...skill }));

export default skills;
