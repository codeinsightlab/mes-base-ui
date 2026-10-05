# MES Base UI

Vue3 / TypeScript / Router4 / Pinia / Element Plus / Vite。RuoYi 通用交互模式重建；没有复制公司页面或生产配置。

```sh
nvm use 22
npm ci
npm test
npm run build
npm run dev
```

开发代理固定 loopback `8080`，生产使用同源反向代理，不包含客户部署地址。
后端必须显式启用 Platform 并由管理员开通账号；没有默认账号/密码。会话只驻内存，刷新需重新登录。
菜单来自后端授权 Navigation；工厂切换清空 Factory 权限，Platform 权限独立。前端展示不替代后端授权。

生成页面位于 `src/views/<module>/<class>/index.vue`；需在 router 注册真实组件并由管理员配置 Menu/Role，不自动赋权。
TEST ONLY Codegen 验收输出在 `target/`（忽略），不进入生产路由或生产包。
# mes-base-ui
