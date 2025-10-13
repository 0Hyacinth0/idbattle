import { BattleRecordRepository } from './battleRecordRepository.js';

/**
 * 使用内存数组模拟战斗记录持久化。
 */
export class MockBattleRecordRepository extends BattleRecordRepository {
    constructor() {
        super();
        this.records = [];
    }

    async createRecord(record) {
        const globalCrypto = typeof globalThis !== 'undefined' && globalThis.crypto
            ? globalThis.crypto
            : (typeof crypto !== 'undefined' ? crypto : undefined);
        const normalized = {
            id: globalCrypto?.randomUUID ? globalCrypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            createdAt: new Date().toISOString(),
            ...record
        };
        this.records.unshift(normalized);
        return normalized;
    }

    async listRecords({ limit = 20, cursor } = {}) {
        let startIndex = 0;
        if (cursor) {
            const index = this.records.findIndex(item => item.id === cursor);
            startIndex = index >= 0 ? index + 1 : 0;
        }
        const items = this.records.slice(startIndex, startIndex + limit);
        const last = items[items.length - 1];
        return {
            items,
            nextCursor: last ? last.id : undefined
        };
    }
}
