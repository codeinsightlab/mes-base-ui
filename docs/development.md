# 前端开发与部署说明

本页维护环境、检查与发布操作；产品定位和能力范围见 [README](../README.md)。

## 环境与常用命令

Node.js 要求以 `package.json` 为准，当前为 >=22.18；`.nvmrc` 使用 Node 22。

```sh
nvm use
npm ci
npm run dev
npm run test
npm run build
```

依赖未变化时不必重复安装。单元测试使用 Vitest/jsdom，不能代替真实后端、浏览器或目标服务器验收。

## API 地址

唯一配置键为 `MES_API_TARGET`，浏览器始终访问同源 `/api`。

| 模式 | 环境文件 | 仓库默认 API 目标 | 命令 |
| --- | --- | --- | --- |
| 开发 | `.env.development` | `http://127.0.0.1:8081` | `npm run dev` / `npm run build:dev` |
| 生产 | `.env.production` | `http://127.0.0.1:8080` | `npm run build` / `npm run build:prod` |
| 测试 | `.env.test` | 仅测试占位 | `npm run test` |

本机覆盖放在 `.env.development.local` 或 `.env.production.local`，不提交 Git；进程环境变量优先。修改后需重启开发服务或重新构建。

地址必须是 HTTP/HTTPS origin，不包含路径、用户名密码、查询参数或 fragment。开发/测试模式仅接受显式 `127.0.0.1` HTTP 地址及端口；生产可使用后端主机的 HTTP/HTTPS origin。分机或容器部署填写 Nginx 实际可达的后端地址。

Vite 开发代理还处理健康检查、OpenAPI 及接口文档相关路径，以 `vite.config.ts` 为准。代理不会替代后端登录、授权和工厂隔离。

## 生产部署

1. 在生产环境文件中配置后端 origin。
2. 按目标服务器调整 [`deploy/nginx.conf.template`](../deploy/nginx.conf.template) 中的网站域名、静态目录及 HTTPS。
3. 执行 `npm run build:prod`，生成 `dist/` 和 `target/deploy/nginx.conf`。
4. 配套发布静态资源与生成的站点配置，在服务器验证 Nginx 配置后受控重载。
5. 验证登录、工厂选择、业务权限、普通请求、私有文件及长连接等实际链路。

生成配置供 Nginx 的 `http` 块加载。API 目标从环境文件生成，不手工修改产物；后端地址不写入浏览器 JS。构建不自动部署、不自动重载 Nginx，也不证明目标后端连通。

## 格式与检查

使用仓库的 ESLint flat config 与 EditorConfig：两空格缩进、单引号、无分号、无尾逗号、LF。Vue/TypeScript 的检查和自动修复统一使用 ESLint。

```sh
npm run lint
npm run lint -- --max-warnings 0
npm run test
npm run build
# 只修复指定文件；先确认工作区差异
npm exec eslint -- src/views/Home.vue --fix
```

`npm run lint:fix` 会修复整个检查范围，执行前确认没有不应改动的工作。Markdown 不在现有 ESLint 检查范围。

编辑器使用项目本地 `node_modules/eslint` 和 `eslint.config.mjs`；Vue 语言支持与格式检查分别由语言服务和 ESLint 负责。构建包含 `vue-tsc` 类型检查。

## 协作入口

修改前读取本仓库 [AGENTS.md](../AGENTS.md) 及其引用规范。前端复用公共请求、权限、工厂上下文和主子单据组件；业务规则及最终授权由后端负责。提交只包含本次任务的差异，检查结果区分静态、Mock、构建与真实业务验收。

页面开发遵守[统一设计规范](UI_DESIGN_SYSTEM.md)，复用主题、布局和公共组件。

## 质量详情读取契约

质量详情复用公共 `request`、权限及工厂上下文；基本信息、当前汇总、处理记录和申报版本各自维护加载、失败与重试状态。局部失败保留其他成功区域，不以空列表或数量0表示失败。无法可靠解释的派生数量允许为null，界面显示待确认并禁用依赖该数量的新处理。

- `GET /api/quality/defects/{id}/treatment` 返回当前汇总，不携带处理历史；核实和入仓成功响应同样返回汇总。
- `GET /api/quality/defects/{id}/treatment/events` 接受 `offset`（默认0）和 `limit`（默认20、最大100），返回 `items/total/offset/limit`，按记录时间及ID倒序稳定分页。
- `POST /api/quality/defects/{id}/treatment/requests/check` 只读核对原请求。请求为 `{kind: 'assess', assessment: 原核实命令}` 或 `{kind: 'dispose', disposition: 原入仓命令}`；后端校验原UUID、申报、操作者、动作及完整内容。此入口要求处理权限，不授予新处理能力。

原未决请求独立于汇总恢复；核对未找到或失败时继续保留原身份和内容，不扫描事件第一页判断请求结果。切厂、身份变化、撤权、离页及各区域后发请求必须使迟到响应失效；成功业务响应与后续刷新失败分别展示。真实API、MySQL和浏览器验证需分别取证，单元测试不替代运行验收。
