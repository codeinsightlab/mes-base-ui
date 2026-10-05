# MES Base UI

Vue3 / TypeScript / Router4 / Pinia / Element Plus / Vite。RuoYi 通用交互模式重建；没有复制公司页面或生产配置。

```sh
nvm use 22
npm ci
npm test
npm run build
npm run dev
```

开发代理默认 loopback `8080`，可用 `MES_DEV_API_TARGET=http://127.0.0.1:<port>` 指定本地后端，生产使用同源反向代理，不包含客户部署地址。
后端必须显式启用 Platform 并由管理员开通账号；没有默认账号/密码。会话只驻内存，刷新需重新登录。
菜单来自后端授权 Navigation；工厂切换清空 Factory 权限，Platform 权限独立。前端展示不替代后端授权。

生成页面位于 `src/views/<module>/<class>/index.vue`；构建时进入编译 catalog，运行期由授权菜单路径匹配组件并动态注册/撤销路由，无需逐页手工注册。管理员仍需配置 Menu/Role；生成器不自动创建菜单或赋权。仅匹配已编译的两级视图路径，不能按服务端 URL 任意导入组件。
TEST ONLY Codegen 验收输出在 `target/`（忽略），不进入生产路由或生产包。
# mes-base-ui
