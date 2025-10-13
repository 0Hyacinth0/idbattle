/**
 * 战斗记录仓储接口。
 */
export class BattleRecordRepository {
    /**
     * 创建新的战斗记录。
     * @param {object} record 战斗记录数据
     * @returns {Promise<object>}
     */
    // eslint-disable-next-line class-methods-use-this
    async createRecord(record) {
        void record;
        throw new Error('createRecord 未实现');
    }

    /**
     * 查询战斗记录列表。
     * @param {{ limit?: number, cursor?: string, characterId?: string }} [options]
     * @returns {Promise<{ items: Array<object>, nextCursor?: string }>}
     */
    // eslint-disable-next-line class-methods-use-this
    async listRecords(options = {}) {
        void options;
        throw new Error('listRecords 未实现');
    }
}
