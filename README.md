# id大作战

这是一个纯前端的战斗模拟小游戏。仓库提供了战斗逻辑、UI以及用于回归的Node测试。下面是快速运行指南。

## 环境准备

- Node.js 18 或更高版本
- npm 9 以上

克隆项目后先安装依赖（本仓库目前没有额外依赖，但执行一次可以确保npm的正确运行）：

```bash
npm install
```

## 启动开发服务器

项目是静态站点，只需要本地静态资源服务器即可。已经在 `package.json` 中提供了 `start` 命令，会启动一个无缓存的本地服务器，保证样式和脚本能够正确加载。

```bash
npm start
```

运行成功后命令行会输出访问地址（默认 `http://0.0.0.0:8000`，在浏览器中访问 `http://localhost:8000` 即可）。

如果你使用的是 VS Code，也可以直接右键 `index.html` 选择 “Open with Live Server”，效果与 `npm start` 一致。

## 运行测试

项目带有一组 Node Test，用于验证数值逻辑是否正确：

```bash
npm test
```

全部用例通过即可确认战斗核心逻辑无误。

## 自动化平衡调优

为了快速检测并缓解数值失衡问题，新增了 `scripts/run-balance-analysis.js` 脚本。脚本会运行多组固定随机序列的模拟战斗，对比不同成长方案的平均表现，并在检测到偏离阈值时自动写入 `config/balanceAdjustments.json` 中的平衡参数。

```bash
node scripts/run-balance-analysis.js
```

执行完成后，终端会输出各方案的分数、被标记的失衡方案以及新的调优参数。随后重新运行测试即可验证调整是否生效。
