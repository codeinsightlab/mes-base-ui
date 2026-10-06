# MES Base UI

当前前端由 Source 系统页面的 Vue3/Element Plus PORT 与既有 Base 自写框架组成。用户、组织岗位、角色菜单等页面迁入了旧模板和操作逻辑；App/Shell、侧栏、路由、Pinia
会话、登录外观及请求适配仍有 Base 重写实现，尚未完整迁入 Source Layout/Navbar/TagsView/Settings。不能将页面迁入等同于整个前端按原架构迁移完成。当前
Phase1 在真实环境验收，未迁正式 MES Domain。

本轮 `http://127.0.0.1:15174` 代理本轮后端18081和远程测试 MySQL 的独立 Schema；admin 已建立，凭证不入文档。原15173/18080服务保留。

使用 .nvmrc 已安装 Node22，不改全局默认 Node：

```sh
nvm use 22
npm run test
npm run build
MES_API_TARGET=http://127.0.0.1:18081 npm run dev -- --host 127.0.0.1 --port 15174 --strictPort
```

启动前核对端口归属；依赖已安装时无需反复 npm ci。Vite 路由修改/依赖优化可能整页重载，Token 仅在内存，重载后重新登录。

## 开发 / 生产 API 配置

后端地址的唯一配置键是 `MES_API_TARGET`，固定放在对应环境文件中；启动 / 构建时自动选择环境，不用每次手改地址。浏览器在所有环境始终请求同源 `/api`，不再使用 `/dev-api` / `/prod-api`。[Vite 环境文件说明](https://vite.dev/guide/env-and-mode.html)

| 场景 | 配置文件 | 默认后端地址 | 命令 |
| --- | --- | --- | --- |
| 开发 | `.env.development` | `http://127.0.0.1:8081` | `npm run dev` / `npm run build:dev` |
| 生产 | `.env.production` | `http://127.0.0.1:8080` | `npm run build` / `npm run build:prod` |
| 单元测试 | `.env.test` | TEST ONLY / Mock，不调用该地址 | `npm run test` |

```sh
# 开发：读取 .env.development，无需每次在命令前写后端地址
npm run dev

# 生产：读取 .env.production，输出 dist/ 和 target/deploy/nginx.conf
npm run build:prod
```

例如 `.env.development` 中填写 `MES_API_TARGET=http://127.0.0.1:8081`，`.env.production` 中填写生产后端 origin；地址不包含 `/api`、用户名密码、查询参数或 fragment。开发目标仍只允许显式 `127.0.0.1` HTTP 后端；生产可填写后端主机的 HTTP/HTTPS origin。同机部署时 `127.0.0.1` 指 Nginx 所在机器；分机 / 容器部署时填 Nginx 能访问的后端地址。

本机临时覆盖可放入 `.env.development.local` 或 `.env.production.local`（Git 忽略），启动进程已有的环境变量优先。旧 `MES_DEV_API_TARGET` 已由统一的 `MES_API_TARGET` 替代。环境文件修改后重启开发服务或重新构建；日常不需要在启动命令里填写地址。

开发时 Vite 将 `/api`、`/open-api`、`/health` 转发到开发地址；构建时读取相应环境地址，根据 [`deploy/nginx.conf.template`](deploy/nginx.conf.template) 自动生成 `target/deploy/nginx.conf`。后端地址仅进入服务器转发配置，不写入浏览器 JS。普通请求、私有文件、消息 SSE、Swagger 以及外部 Open API 的路径、认证和 Factory 行为保持原样。

发布时部署 `dist/` 静态内容，并将本次生成的 `target/deploy/nginx.conf` 安装到服务器 Nginx 配置目录，检查配置后重载。该文件是供 Nginx 的 `http` 块加载的站点配置；网站域名、静态目录和 HTTPS 在模板中按部署环境配置。API 地址只改环境文件，不手改生成的配置。两份产物需要配套发布，否则服务器仍可能转发到上一次的后端地址。改变后端地址后浏览器 JS 可以复用，但需要更新服务器转发配置。

构建只生成产物，不自动上传、重载 Nginx 或启动服务；本次未部署线上。Nginx 的真实连通性与部署行为需在目标服务器验收。

## ESLint 检查与自动修复

使用项目本地 ESLint flat config，配合 Vue3、TypeScript 和 ESLint Stylistic 插件。沿用 ktg-mes-ui 的主要格式风格：两空格缩进、单引号、无分号、无尾逗号、函数括号前不加空格、LF 换行；不强制按 100 列重排。Vue 属性单行最多 10 个，多行每行 1 个。EditorConfig 统一编辑器缩进和换行。

```sh
nvm use
npm run lint         # 检查格式及基础代码问题，不修改文件
npm run lint:fix     # 自动修复所有可修复问题，请先核对工作区改动
npm run lint -- --max-warnings 0 # 严格检查，错误或警告都会导致失败
npm exec eslint -- src/views/Home.vue --fix # 仅修复指定文件
```

VS Code 安装推荐的 ESLint 扩展后，手动保存 Vue、TypeScript、JavaScript 文件会执行 ESLint 自动修复；格式化文档也使用 ESLint。Volar 保留 Vue 语言服务，不再作为格式化入口。IDEA/WebStorm 在 ESLint 设置中使用本项目的 `node_modules/eslint` 和 `eslint.config.mjs`，启用保存时执行 `eslint --fix`；需使用支持当前 ESLint flat config 的 IDE 版本。本次未验证编辑器实际操作。

仅使用 ESLint 进行代码检查和自动修复，不使用 Prettier 或独立格式化流程。Vue、TypeScript、Stylistic 是 ESLint 插件，统一在 `eslint.config.mjs` 配置。ESLint 检查 JS/TS/Vue 和脚本配置，忽略依赖、构建产物和 IDEA 本地文件；不沿用旧项目会屏蔽全部 JS/Vue 的忽略模式。CSS、JSON、Markdown 和 SVG 不在本次 ESLint 范围内。启用 JS/TS/Vue 推荐基础检查；为兼容现有迁入代码，保留显式 `any`、既有 `v-html` 和单词组件名。`lint:fix` 只修复规则提供自动修复的问题，剩余错误仍需手工处理，命令会返回非零状态。

2026-10-06 全项目清理：补齐组件 props/emits，Cron 使用 Vue3 props 且 computed 不修改状态；列显隐通过 `update:columns` 更新父页面，个人资料使用本地草稿并在保存成功后刷新父页面。清理无用导入、调试语句及编码规则页没有入口和接口实现的缓存刷新残留方法。严格 ESLint 检查为 0 错误、0 警告，45 项测试及生产构建通过；`tests/eslintRegression.test.ts` 使用 Mock 验证上述组件行为，不代表真实后端或浏览器验收。构建仍有原有深度 CSS 选择器弃用及大分块提示。

现有功能页面包括用户/组织岗位/角色菜单/字典参数/公告消息/自动编码、日志在线用户/Quartz/Server/Cache/Druid、系统接口及个人资料/文件/消息。具体来源及迁移缺口见相邻
Base 的迁移报告“前端迁移来源复核”章节；功能列表不代表每项前端实现均直接来自 Source。Source data/rows/total 经
src/utils/request.ts 按真实成功契约读取；HTTP 错误保留 requestId，无多结构猜测。

动态菜单仅注册已编译 views catalog；PLATFORM/FACTORY 权限独立。切厂清旧权限、数据、弹窗和过期响应。按钮和菜单不承担最终授权。公告图片、头像、个人文件走认证私有资源
policy，文件下载使用 FileSaver；API 字节验证与浏览器下载产物分别记录。

/tool/swagger 从授权接口读取 SDK 生成的真实 OpenAPI，关闭外部 validator、持久化认证及跨源请求，鉴权来自当前内存会话。注册由
Source 参数开关控制且默认关闭；密码规则来自后端 profile。浏览器输入/修改新凭证需用户接手。

迁移阶段不调用 Codegen；后续新增开发才使用相邻 Base CRUD
Skill。详见 [交接入口](../mes-base/docs/development/next-stage-plan.md)、[功能矩阵](../mes-base/docs/development/MES_MIGRATION_MATRIX.md)、[实际验收](../mes-base/docs/reviews/2026-10-06-phase1-verification.json)
。本轮未提交、推送或部署。

## OpenAPI 应用

`/system/openApiClient` PORT Source 提交中的应用列表/详情、默认禁用的新建表单、一次性凭证、启停、Secret重置、分组接口授权和权限按钮。读取实际
API catalog，不提供工艺路线范围表单；业务数据范围开关状态由后端返回。凭证不持久化，离开/关闭销毁。

系统接口页包含外部 Token/诊断契约；外部请求使用单独 OpenApiBearer，后台 Token/工厂头不会自动注入。开发代理 /open-api 与
/api 共用显式 loopback MES_API_TARGET。实际 Token/API/限流/撤销/数据库隔离已由HTTP验收，浏览器列表/详情/目录已验证；浏览器创建/重置凭证需用户亲自完成，未自动点击赋权保存。
