import { BattleRecordRepository } from './battleRecordRepository.js';
import { MockBattleRecordRepository } from './mockBattleRecordRepository.js';

export class BattleRecordService {
    /**
     * @param {{ battleRecordRepository?: BattleRecordRepository }} [options]
     */
    constructor({ battleRecordRepository } = {}) {
        const repository = battleRecordRepository || new MockBattleRecordRepository();
        if (!(repository instanceof BattleRecordRepository)) {
            throw new TypeError('battleRecordRepository 必须继承 BattleRecordRepository');
        }
        this.repository = repository;
    }

    /**
     * 记录一场战斗结果。
     * @param {object} record
     * @returns {Promise<object>}
     */
    async logBattle(record) {
        return this.repository.createRecord(record);
    }

    /**
     * 获取最近的战斗记录。
     * @param {{ limit?: number, cursor?: string, characterId?: string }} [options]
     * @returns {Promise<{ items: Array<object>, nextCursor?: string }>}
     */
    async getBattleHistory(options) {
        return this.repository.listRecords(options);
    }
}

export function createBattleRecordService(options) {
    return new BattleRecordService(options);
}
