# ID Battle 设计规范文档

本文档定义了 ID Battle 项目的完整 UI 设计系统，确保界面设计的一致性和规范性。

---

## 目录

1. [设计理念](#1-设计理念)
2. [色彩系统](#2-色彩系统)
3. [排版规范](#3-排版规范)
4. [组件样式](#4-组件样式)
5. [布局规则](#5-布局规则)
6. [玻璃质感效果](#6-玻璃质感效果)
7. [动画系统](#7-动画系统)
8. [响应式设计](#8-响应式设计)

---

## 1. 设计理念

本项目采用 **Liquid Glass（液态玻璃）** 设计语言，灵感来源于 Apple 的设计哲学。核心特点包括：

- **极简主义**：界面元素精简，内容为王
- **毛玻璃质感**：半透明背景配合模糊效果，创造层次感
- **高光边缘**：玻璃边缘的白色高光渐变，增强立体感
- **色彩克制**：主色调为中性色，强调色仅用于交互元素

---

## 2. 色彩系统

### 2.1 亮色模式 (Light Mode)

#### 背景色
| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--bg-body` | `#f5f5f7` | 页面主背景 |
| `--bg-panel` | `linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.1) 100%)` | 面板背景（渐变半透明） |
| `--bg-panel-light` | `linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 100%)` | 轻量面板背景 |

#### 文字色
| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--text-primary` | `#1d1d1f` | 主要文字 |
| `--text-muted` | `rgba(0, 0, 0, 0.56)` | 次要/提示文字 |
| `--button-text` | `#ffffff` | 按钮文字 |

#### 强调色
| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--accent-blue` | `#0071e3` | 主要交互色（链接、按钮、焦点） |
| `--accent-blue-dark` | `#0077ed` | 蓝色深色变体 |
| `--accent-red` | `#ff3b30` | 危险/错误提示、玩家2标识 |
| `--accent-gold` | `#f59e0b` | 警告、金币、高亮 |
| `--accent-green` | `#34c759` | 成功、生命值、正面状态 |

#### 边框色
| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--border-light` | `rgba(255, 255, 255, 0.5)` | 通用边框 |
| `--border-dark` | `transparent` | 透明边框占位 |

### 2.2 暗色模式 (Dark Mode)

#### 背景色
| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--bg-body` | `#000000` | 页面主背景（纯黑） |
| `--bg-panel` | `linear-gradient(135deg, rgba(44,44,46,0.6) 0%, rgba(28,28,30,0.2) 100%)` | 面板背景 |
| `--bg-panel-light` | `linear-gradient(135deg, rgba(58,58,60,0.4) 0%, rgba(28,28,30,0.1) 100%)` | 轻量面板背景 |

#### 文字色
| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--text-primary` | `#ffffff` | 主要文字（纯白） |
| `--text-muted` | `rgba(255, 255, 255, 0.55)` | 次要/提示文字 |

#### 强调色（暗色模式调整）
| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--accent-blue` | `#0a84ff` | 主要交互色 |
| `--accent-blue-dark` | `#2997ff` | 蓝色深色变体 |
| `--accent-red` | `#ff453a` | 危险/错误提示 |
| `--accent-gold` | `#ffd60a` | 警告、金币 |
| `--accent-green` | `#32d74b` | 成功、生命值 |

### 2.3 装备稀有度色彩

| 稀有度 | 亮色模式 | 暗色模式 |
|--------|----------|----------|
| Poor（劣质） | `#8e8e93` | `#8f93a3` |
| Normal（普通） | `#6e6e73` | `#f4f1ff` |
| Magic（魔法） | `#34c759` | `#6dd39e` |
| Rare（稀有） | `#0071e3` | `#59a6ff` |
| Epic（史诗） | `#af52de` | `#c282ff` |
| Legendary（传说） | `#ff9500` | `#ff9b52` |

---

## 3. 排版规范

### 3.1 字体家族

```css
--font-display: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
--font-text: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
```

- **SF Pro Display**：用于标题、大字号展示
- **SF Pro Text**：用于正文、UI 元素

### 3.2 字号层级

| 变量名 | 大小 | 用途 |
|--------|------|------|
| `--font-size-base` | `17px` | 正文基准字号 |
| `--font-size-section` | `19px` | 小节标题 |
| `--font-size-subheading` | `clamp(20px, 3vw, 28px)` | 副标题（响应式） |
| `--font-size-heading` | `clamp(32px, 5vw, 56px)` | 主标题（响应式） |
| `--font-size-label` | `13px` | 标签文字 |
| `--font-size-small` | `14px` | 小号文字 |
| `--font-size-xs` | `12px` | 极小文字 |
| `--font-size-caption` | `11px` | 说明文字 |

### 3.3 字重规范

| 字重 | 数值 | 用途 |
|------|------|------|
| Regular | `400` | 正文、按钮 |
| Medium | `500` | 强调文字 |
| Semibold | `600` | 标题、重要信息 |

### 3.4 行高与字间距

| 元素 | 行高 | 字间距 |
|------|------|--------|
| 正文 | `1.47` | `-0.011em` |
| H2 副标题 | `1.14` | `-0.02em` |
| H3 小节标题 | `1.2` | `-0.015em` |
| 标签 | `1.0` | `0.15rem`（大写字母间距） |

---

## 4. 组件样式

### 4.1 按钮 (Button)

#### 基础按钮
```css
padding: 10px 18px;
font-size: var(--font-size-small);
font-weight: 500;
background: var(--accent-blue);
color: var(--button-text);
border: none;
border-radius: 8px;
cursor: pointer;
```

#### 胶囊按钮（Pill Button）
```css
border-radius: 980px;
padding: 6px 14px;
```

#### 按钮状态
| 状态 | 样式 |
|------|------|
| Hover | `filter: brightness(1.1)` + 增强阴影 |
| Active | `transform: scale(0.98)` |
| Disabled | `background: rgba(0,0,0,0.04)` + `color: rgba(0,0,0,0.48)` |
| Focus | `outline: 3px solid rgba(108, 216, 255, 0.6)` + `outline-offset: 2px` |

### 4.2 表单元素

#### 输入框 (Input)
```css
padding: 12px;
font-size: var(--font-size-small);
background: var(--bg-panel-light);
border: 1px solid var(--border-light);
border-radius: 8px;
```

#### 焦点状态
```css
border-color: var(--accent-blue);
box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.12);
```

#### 标签 (Label)
```css
font-size: var(--font-size-label);
letter-spacing: 0.15rem;
color: var(--text-muted);
```

### 4.3 卡片 (Card)

#### 面板卡片
```css
background: var(--bg-panel-light);
backdrop-filter: blur(var(--glass-blur)) saturate(180%);
border: 1px solid var(--border-light);
box-shadow: var(--shadow-card);
border-radius: 16px;
```

#### 圆角规范
| 类型 | 圆角值 |
|------|--------|
| 小型元素 | `4px - 6px` |
| 按钮、输入框 | `8px` |
| 卡片、面板 | `16px - 20px` |
| 胶囊形状 | `980px` |

### 4.4 导航栏 (Navigation)

```css
position: sticky;
top: 16px;
max-width: 980px;
border-radius: 980px;
background: var(--nav-bg);
backdrop-filter: blur(var(--glass-blur)) saturate(180%);
padding: 8px 16px;
box-shadow: 0 4px 14px rgba(0,0,0,0.06);
```

### 4.5 生命值条 (Health Meter)

```css
height: 14px;
border-radius: 6px;
background: var(--bg-body);
```

#### 状态颜色
| 状态 | 颜色 |
|------|------|
| 正常 | `linear-gradient(90deg, #34c759, #32d74b)` |
| 警告（<50%） | `linear-gradient(90deg, #f59e0b, #ffd60a)` |
| 危险（<25%） | `linear-gradient(90deg, #ff3b30, #ff453a)` |
| 过量治疗 | `--accent-blue` |

---

## 5. 布局规则

### 5.1 容器

```css
.container {
    max-width: 1120px;
    margin: 0 auto;
    padding: 32px 28px 40px;
}
```

### 5.2 间距系统

| 变量/值 | 用途 |
|---------|------|
| `4px` | 极小间距（图标与文字） |
| `8px` | 小间距（行内元素） |
| `12px` | 中小间距（组件内部） |
| `16px` | 中等间距（标准间距） |
| `20px` | 较大间距（区块间距） |
| `24px` | 大间距（面板内边距） |
| `28px` | 较大间距（主要区块） |
| `32px` | 大间距（容器内边距） |

### 5.3 Grid 布局

#### 表单双列布局
```css
grid-template-columns: repeat(2, minmax(0, 1fr));
gap: 16px 20px;
```

#### 自适应网格
```css
grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
gap: 20px;
```

---

## 6. 玻璃质感效果

### 6.1 毛玻璃背景

```css
background: var(--bg-panel-light);
backdrop-filter: blur(var(--glass-blur)) saturate(180%);
-webkit-backdrop-filter: blur(var(--glass-blur)) saturate(180%);
```

- `--glass-blur: 24px` - 模糊半径

### 6.2 玻璃边缘高光

```css
/* 亮色模式 */
--glass-border-gradient: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0.3) 20%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.3) 80%,
    rgba(255, 255, 255, 0.7) 100%
);
```

### 6.3 阴影系统

| 变量名 | 样式 | 用途 |
|--------|------|------|
| `--shadow-card` | `0 8px 32px 0 rgba(31,38,135,0.1), inset 1px 1px 0 0 rgba(255,255,255,0.8)` | 卡片阴影 |
| `--shadow-subtle` | `0 4px 16px 0 rgba(31,38,135,0.05), inset 1px 1px 0 0 rgba(255,255,255,0.6)` | 轻微阴影 |

### 6.4 背景装饰

页面背景使用四个角落的彩色径向渐变，为玻璃效果提供折射底色：

```css
background-image: 
    radial-gradient(circle at 0% 0%, rgba(0, 113, 227, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 100% 100%, rgba(52, 199, 89, 0.25) 0%, transparent 50%),
    radial-gradient(circle at 100% 0%, rgba(255, 59, 48, 0.2) 0%, transparent 40%),
    radial-gradient(circle at 0% 100%, rgba(245, 158, 11, 0.2) 0%, transparent 40%);
```

---

## 7. 动画系统

### 7.1 过渡时间

| 时长 | 用途 |
|------|------|
| `0.1s` | 快速反馈（按钮按下） |
| `0.2s` | 标准过渡（颜色、边框） |
| `0.3s` | 中等过渡（背景色） |
| `0.5s` | 慢速过渡（进度条） |

### 7.2 缓动函数

| 函数 | 用途 |
|------|------|
| `ease` | 通用过渡 |
| `ease-in-out` | 双向动画 |
| `cubic-bezier(0.25, 1, 0.5, 1)` | 进度条动画 |

### 7.3 浮动文字动画

#### 普通伤害
```css
@keyframes fct-float {
    0%   { opacity: 0; transform: translate(-50%, 20px) scale(0.8); }
    15%  { opacity: 1; transform: translate(-50%, -5px) scale(1.1); }
    30%  { transform: translate(-50%, -15px) scale(1.0); }
    80%  { opacity: 1; transform: translate(-50%, -40px); }
    100% { opacity: 0; transform: translate(-50%, -60px); }
}
```

#### 暴击伤害
```css
@keyframes fct-float-crit {
    /* 更大的缩放和位移 */
}
```

#### 治疗效果
```css
@keyframes fct-float-heal {
    /* 绿色向上飘动 */
}
```

---

## 8. 响应式设计

### 8.1 断点设置

| 断点 | 宽度 | 用途 |
|------|------|------|
| 大屏 | `> 960px` | 默认布局 |
| 中屏 | `≤ 960px` | 减少内边距，堆叠布局 |
| 小屏 | `≤ 720px` | 单列布局，全宽按钮 |
| 属性表格 | `≤ 900px` | 属性表格简化为双列 |

### 8.2 响应式调整

#### 中屏 (≤ 960px)
```css
body { padding: 24px 12px 36px; }
.container { padding: 28px 22px 34px; }
.battle-area { flex-direction: column; }
```

#### 小屏 (≤ 720px)
```css
.player-form { grid-template-columns: 1fr; }
button { width: 100%; }
```

---

## 附录：CSS 变量速查表

### 完整变量列表

```css
:root {
    /* 背景 */
    --bg-body: #f5f5f7;
    --bg-panel: linear-gradient(...);
    --bg-panel-light: linear-gradient(...);
    
    /* 文字 */
    --text-primary: #1d1d1f;
    --text-muted: rgba(0, 0, 0, 0.56);
    --button-text: #ffffff;
    
    /* 强调色 */
    --accent-blue: #0071e3;
    --accent-blue-dark: #0077ed;
    --accent-red: #ff3b30;
    --accent-gold: #f59e0b;
    --accent-green: #34c759;
    
    /* 边框 */
    --border-light: rgba(255, 255, 255, 0.5);
    --border-dark: transparent;
    
    /* 字体 */
    --font-display: 'SF Pro Display', ...;
    --font-text: 'SF Pro Text', ...;
    
    /* 字号 */
    --font-size-base: 17px;
    --font-size-small: 14px;
    --font-size-xs: 12px;
    --font-size-caption: 11px;
    --font-size-label: 13px;
    --font-size-heading: clamp(32px, 5vw, 56px);
    --font-size-subheading: clamp(20px, 3vw, 28px);
    --font-size-section: 19px;
    
    /* 阴影 */
    --shadow-card: 0 8px 32px 0 rgba(31, 38, 135, 0.1), inset 1px 1px 0 0 rgba(255, 255, 255, 0.8);
    --shadow-subtle: 0 4px 16px 0 rgba(31, 38, 135, 0.05), inset 1px 1px 0 0 rgba(255, 255, 255, 0.6);
    
    /* 玻璃效果 */
    --glass-blur: 24px;
    --glass-border-gradient: linear-gradient(...);
    
    /* 导航 */
    --nav-bg: linear-gradient(...);
    --nav-border: rgba(255, 255, 255, 0.5);
}
```

---

*文档版本: 1.0.0*
*最后更新: 2026-04-17*
