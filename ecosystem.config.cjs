module.exports = {
  apps: [
    {
      name: "idbattle-frontend",
      script: "serve", // PM2 内置的静态服务器
      env: {
        PM2_SERVE_PATH: "./dist",    // 托管构建后的目录
        PM2_SERVE_PORT: 8000,        // 访问端口
        PM2_SERVE_SPA: "true",       // 开启 SPA 单页应用路由回退，防止刷新 404
        PM2_SERVE_HOMEPAGE: "/index.html"
      }
    }
  ]
};