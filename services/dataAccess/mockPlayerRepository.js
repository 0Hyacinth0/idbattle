import { PlayerRepository } from './playerRepository.js';
import { generateAttributes, getBasePlayerProfile } from '../../models/player.js';
import {
    getPlayerConfig,
    savePlayerConfig,
    listPlayerConfigs
} from '../../utils/storage.js';

/**
 * 以内存与现有前端模型为数据源的仓储实现，用于在接入真实后端前解耦调用逻辑。
 */
export class MockPlayerRepository extends PlayerRepository {
    async fetchBaseProfile(name) {
        return getBasePlayerProfile(name) || null;
    }

    async fetchPlayerProfile(name, { customization } = {}) {
        const override = typeof customization === 'undefined' ? getPlayerConfig(name) : customization;
        if (!name) {
            return null;
        }
        return generateAttributes(name, override || undefined);
    }

    async getCustomization(name) {
        return getPlayerConfig(name);
    }

    async saveCustomization(name, customization) {
        const stored = savePlayerConfig(name, customization || {});
        return {
            name,
            config: stored
        };
    }

    async listSavedPlayers() {
        return listPlayerConfigs();
    }
}
