# 持久化设计与接口草案

本文件梳理了未来服务端持久化层的核心数据模型，并为主要实体提供了初步的 RESTful 接口草案。设计目标是在保证数值玩法可扩展的同时，便于前端通过统一的数据访问层接入真实后端服务。

## 领域概览

- **用户 (User)**：登录账号及其权限信息。
- **角色/人物 (Character)**：用于战斗的具体人物配置，与用户一对多关联。
- **装备 (Equipment)**：包括装备模板与具体实例，支持强化与套装效果。
- **战斗记录 (BattleRecord)**：记录每场对战的参与者、结果及战斗日志。

## 核心实体模型

### 用户 (`users`)

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `username` | string | 唯一用户名 |
| `email` | string | 唯一邮箱 |
| `passwordHash` | string | 口令哈希值 |
| `status` | enum(`active`,`disabled`,`pending`) | 账号状态 |
| `createdAt` | datetime | 创建时间 |
| `updatedAt` | datetime | 更新时间 |
| `lastLoginAt` | datetime | 最近一次登录 |

### 系统角色 (`roles`)

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `code` | string | 角色代码，唯一 |
| `name` | string | 显示名称 |
| `description` | string | 描述 |
| `permissions` | string[] | 权限点列表 |

> 用户与系统角色为多对多关系，通过 `user_roles(userId, roleId)` 维护。

### 人物/角色 (`characters`)

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `userId` | UUID | 归属用户 |
| `name` | string | 角色名称 |
| `baseSeed` | string | 生成基础属性的种子（当前沿用 MD5 方案） |
| `skillId` | UUID | 默认技能 |
| `attributes` | JSON | 基础属性（health/attack/defense/speed 等） |
| `metadata` | JSON | 额外信息，例如皮肤、简介 |
| `createdAt` | datetime | 创建时间 |
| `updatedAt` | datetime | 更新时间 |

### 装备模板 (`equipment_templates`)

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `slot` | enum | 位置（武器、头盔、护甲等） |
| `name` | string | 唯一名称 |
| `rarity` | enum | 品质（common/rare/epic/legendary） |
| `setName` | string | 套装名称，可为空 |
| `baseAttributes` | JSON | 装备基础属性加成 |
| `maxEnhancementLevel` | int | 最大强化等级 |
| `createdAt` | datetime | 创建时间 |
| `updatedAt` | datetime | 更新时间 |

### 装备实例 (`equipment_items`)

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `characterId` | UUID | 所属角色 |
| `templateId` | UUID | 对应模板 |
| `enhancementLevel` | int | 当前强化等级 |
| `attributes` | JSON | 实际属性（含强化加成） |
| `isEquipped` | boolean | 是否装备在角色身上 |
| `createdAt` | datetime | 创建时间 |
| `updatedAt` | datetime | 更新时间 |

### 战斗记录 (`battle_records`)

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `startedAt` | datetime | 开始时间 |
| `endedAt` | datetime | 结束时间 |
| `winnerCharacterId` | UUID | 胜利者 |
| `loserCharacterId` | UUID | 失败者 |
| `durationMs` | int | 战斗耗时 |
| `log` | text | 完整战斗日志（文本或 JSON） |
| `summary` | JSON | 关键事件概要 |

### 战斗参与者快照 (`battle_participants`)

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID | 主键 |
| `battleId` | UUID | 战斗记录 ID |
| `characterId` | UUID | 角色 ID |
| `snapshot` | JSON | 战斗开始前的角色数值、装备快照 |

## 关系示意

- `users` ⇔ `roles`：多对多。
- `users` ⇔ `characters`：一对多。
- `characters` ⇔ `equipment_items`：一对多，`equipment_items.templateId` 关联 `equipment_templates.id`。
- `battle_records` ⇔ `battle_participants`：一对多，记录参战者快照。

## 接口草案

### 认证与用户

| Method | Path | 描述 |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | 登录，返回访问令牌与刷新令牌 |
| `POST` | `/api/v1/auth/refresh` | 刷新令牌 |
| `POST` | `/api/v1/users` | 创建用户 |
| `GET` | `/api/v1/users/me` | 获取当前登录用户信息 |
| `PATCH` | `/api/v1/users/me` | 更新当前用户资料 |

**示例：**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "playerA",
  "password": "******"
}
```
```json
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": "uuid",
    "username": "playerA",
    "roles": ["player"],
    "lastLoginAt": "2024-01-01T12:00:00Z"
  }
}
```

### 角色/人物

| Method | Path | 描述 |
| --- | --- | --- |
| `GET` | `/api/v1/characters` | 列出当前用户的角色 |
| `POST` | `/api/v1/characters` | 创建角色（可指定名称、初始技能等） |
| `GET` | `/api/v1/characters/{id}` | 获取角色详情（含装备快照） |
| `PATCH` | `/api/v1/characters/{id}` | 更新角色属性调整、技能、备注等 |
| `DELETE` | `/api/v1/characters/{id}` | 删除角色 |
| `POST` | `/api/v1/characters/{id}/generate` | 基于名称重新生成基础属性（保持可重复性） |

**角色详情响应示例：**
```json
{
  "id": "uuid-character-1",
  "userId": "uuid-user-1",
  "name": "艾达",
  "baseSeed": "0f3a4c...",
  "skillId": "uuid-skill-8",
  "attributes": {
    "health": 132,
    "attack": 17,
    "defense": 12,
    "speed": 11,
    "critChance": 0.12
  },
  "equipment": [
    {
      "id": "uuid-equip-1",
      "templateId": "uuid-template-weapon",
      "slot": "weapon",
      "enhancementLevel": 3,
      "attributes": { "attack": 24 }
    }
  ],
  "metadata": {
    "notes": "首发角色"
  },
  "createdAt": "2024-02-01T10:00:00Z",
  "updatedAt": "2024-02-10T22:15:00Z"
}
```

### 装备

| Method | Path | 描述 |
| --- | --- | --- |
| `GET` | `/api/v1/equipment/templates` | 查询装备模板列表（支持分页、slot、rarity 过滤） |
| `POST` | `/api/v1/equipment/templates` | 创建新模板 |
| `GET` | `/api/v1/equipment/templates/{id}` | 模板详情 |
| `GET` | `/api/v1/equipment/items` | 查询角色的装备实例 |
| `POST` | `/api/v1/equipment/items` | 新增或锻造装备实例 |
| `PATCH` | `/api/v1/equipment/items/{id}` | 强化、重铸或更新装备状态 |
| `DELETE` | `/api/v1/equipment/items/{id}` | 分解或删除装备 |

### 战斗记录

| Method | Path | 描述 |
| --- | --- | --- |
| `POST` | `/api/v1/battles` | 提交一场战斗的完整记录（由前端或战斗服务生成） |
| `GET` | `/api/v1/battles` | 列出战斗记录，支持角色、时间范围过滤 |
| `GET` | `/api/v1/battles/{id}` | 获取详细战斗日志与参与者快照 |

**战斗记录提交示例：**
```json
{
  "startedAt": "2024-03-08T12:00:00Z",
  "endedAt": "2024-03-08T12:03:22Z",
  "winnerCharacterId": "uuid-character-1",
  "loserCharacterId": "uuid-character-2",
  "durationMs": 202000,
  "log": "第1回合...",
  "summary": {
    "totalTurns": 12,
    "criticalHits": 3,
    "statusEffects": ["burn", "stun"]
  },
  "participants": [
    {
      "characterId": "uuid-character-1",
      "snapshot": { "attributes": { "health": 132, "attack": 30 } }
    },
    {
      "characterId": "uuid-character-2",
      "snapshot": { "attributes": { "health": 110, "attack": 28 } }
    }
  ]
}
```

## 扩展与实现建议

1. **数据一致性**：对装备和角色的写操作需使用事务，确保属性与装备加成一致。
2. **日志存储**：`battle_records.log` 可根据需求拆分为文本存储（快速读取）与结构化事件表（便于统计）。
3. **版本管理**：在 `characters` 和 `equipment_items` 表中保留 `schemaVersion` 字段，便于后续属性体系调整。
4. **缓存策略**：角色基础模板与装备模板适合使用缓存或 CDN，加速只读查询。
5. **审计与追踪**：在所有写接口中记录操作者 `userId` 与来源 IP，满足运营审计需求。

该草案为后续持久化落地提供了统一的结构化参考，可与数据库建模及后端实现同步迭代。
