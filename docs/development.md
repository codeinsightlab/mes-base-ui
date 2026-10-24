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

## 2026-10-24 — B2 普通请求完整响应超时

源码事实：`src/lib/request.ts` 的普通 `request` / `requestBlob` 现在从发送到完整响应体读取完成共用一个截止时间（默认15秒，既有1–120秒范围不变）。成功 JSON/text、下载 blob 与非2xx错误JSON均受保护；体读取超时、取消及连接中断返回 `NETWORK_ERROR` / status=0，并保留已取得的 `X-Request-Id`，不将其误判为确定的4xx业务拒绝，也不自动重试写请求。完整但无效的成功JSON仍为 `INVALID_RESPONSE`；完整非JSON错误页仍按HTTP失败返回。所有等待分支清理计时器与自身abort监听。

每阶段继续检查 token、Factory及revision；旧请求的迟到体与401/专用422不能影响新上下文。`requestStream` 成功取得头部后结束普通超时，保持长期读取与调用者signal取消；其非2xx错误体仍执行完整响应截止时间。此前[会话恢复验收](acceptance/session-restore/README.md)记载的成功SSE响应头超时及调用者取消契约继续成立。

测试事实（Node 22.23.1、Vitest/jsdom、受控fetch/Response/ReadableStream与假时钟）：新增 `tests/requestTimeout.test.ts` 27项，覆盖头快体慢、部分JSON停滞、错误JSON、blob、发送与读体共用时限、及时完成/204/空体、主动取消/完成竞态、网络与格式错误、计时器/监听清理、切厂/撤权/新登录迟到响应和长期SSE。关联request与sessionRestore定向共75项通过；最终全量89个文件583项通过；定向ESLint及生产构建通过（构建仍有既有deep选择器弃用及大chunk提示）。首次全量为582/583：会话恢复的401 Mock将同一Response交给两个并行请求，第二次读体被正确识别为传输失败；仅改为每次创建独立Response，保留所有业务断言，之后全量通过。

未验证：真实浏览器慢网络、真实后端/代理与部署环境；上述测试和构建不代替这些证据。本次不涉及数据库、业务页面、pending恢复、服务启停、推送或部署。回滚应只撤销本次四个文件的提交差异，不覆盖共享工作区其他改动。

## 2026-10-24：B1 现场报工原请求恢复

### 行为与边界

现场 `productionReporting` 首次发送前，把完整 `ReportCommand`（executionId、routingNodeId、reportQty、workstationId、requestId）及版本、userId/Factory身份绑定写入本标签页sessionStorage。仅使用服务端 `/api/session/info` 验证的字符串userId；auth仅在内存接收该字段，clear或新登录清空，不改变原有Token/选厂持久化契约。恢复记录没有Token副本、用户资料、权限、工艺或数量投影缓存，也不授予任何后端能力。

记录一经保存即保守视为未决；刷新、离页、重新定位和同标签页重新登录后，只有正确账号、当前Factory且当前仍具正式报工权限时展示。切厂、撤权、登出立即隐藏内存内容，保留隔离记录；切回或原账号重新认证授权后恢复。无TTL自动删除，不提供“清除并换UUID重报”。sessionStorage不是长期离线平台，关闭标签页、清除浏览器存储或换设备后不保证恢复；不宣称跨标签页、跨设备共享。

恢复面板独立于Execution上下文读取，不依赖节点当前可报或数量投影成功。只由用户点击人工原样重放；定位和页面恢复不自动POST。同账号同Factory最多一笔未决请求，期间仍可定位其他执行进行只读查询，但不能以新UUID新增报工。服务端仍走正式报工POST权限及原UUID、原操作者和完整内容重放核对，已成功事实先于当前状态/数量资格校验返回；本轮未新增后端恢复接口或修改生产规则。

网络/超时、5xx、响应解析失败、401/403/404、通用409及CONTEXT_CHANGED保留原命令。仅首次未中断活动调用收到明确领域事务拒绝白名单时允许释放冻结意图（REPORT_QUANTITY_CONFLICT、REPORT_PATH_REQUIRED、REPORT_REFERENCE_INVALID、OPERATOR_CAPABILITY_REQUIRED、OPERATOR_NOT_ASSIGNED、EXECUTION_INVALID、WORKORDER_NOT_RELEASED、QUALITY_ATTRIBUTION_REQUIRED）；任何恢复的请求、或此前已未知的请求，即便重试得到同样拒绝也继续保留。已成功但数量刷新失败不恢复写请求。迟到响应不回填旧页面，仅身份/授权/会话代际仍可信且完整原命令匹配时处理原记录。

存储写入失败时零POST；读取故障、损坏、不支持版本、记录被替换和删除失败明确显示错误并阻止新报工，不覆盖旧证据。可“重新读取原报工请求”在存储恢复后继续核对。删除失败不把已确认成功降格成未成功；提示结果已确定，保留原UUID供幂等核对。

### 验证与后续真实验收

本轮自动化结果见下方完成回执；所有组件交互使用Mock API，存储单元测试使用测试环境sessionStorage，不构成真实后端或数据库验收。没有运行真实业务写、迁移、服务启停、推送或部署；未修改A仓储链路和公共request。

后续由独立验收包执行：先核实中心Factory绑定与实际DATABASE()为mes_base_dev_perf_test，用户加载包含本改动的服务/前端版本。使用有权限的独立QA执行，经正式报工成功后对响应施加明确标记的故障注入，覆盖刷新、离页、重新定位、同标签页重新登录，再人工按原UUID重放；核对只形成一条报工事实、数量不重复。另验证切厂、不同账号、撤权隔离，以及原执行已关闭/数量接口失败时仍能恢复原请求。记录真实浏览器、正式API与数据库证据，故障注入不能冒称自然网络故障；测试账户或条件不足逐项保留未验边界。服务启停仍由用户控制。

### B1 完成回执（2026-10-24，代码与自动化）

普通表单submit和普通按钮click均显式调用无事件参数的普通提交入口，存在pending时两者零POST；只有恢复面板的明确按钮才能人工原样重放。每次发送开始失效此前定位/数量读取并结束对应loading，迟到context不得覆盖写入后的视图。清理恢复记录失败时仍展示已取得的成功流水，并独立显示清理失败；原UUID保留、新请求阻断。新登录在发出认证请求前清内存userId，挂起期间不能沿旧身份展示或提交恢复请求。

Node22.23.1：最终定向3文件60项通过；全量90文件613项通过；生产构建通过（保留既有chunk大于500kB提示）；自有6个源码/测试文件ESLint与7路径diff检查通过。全量结果包含当前工作区既有其他任务代码，不表示本提交包含那些差异。DOM按钮、表单、恢复按钮测试均挂载真实Vue/Element Plus组件，API仍为Mock。

保留失败过程：首次新增DOM按钮用例在直接赋值选择项后未等待Vue更新disabled状态，定向59通过/1失败，随后同步开始的全量612通过/1失败；仅补点击前的组件刷新等待，原POST数量和内容断言保持，最终上述定向/全量通过。原失败日志 `/tmp/b1-target-dom-final.log`、`/tmp/b1-full-test-dom-final.log`；最终日志 `/tmp/b1-target-dom-final-v2.log`、`/tmp/b1-full-test-final-pass.log`、`/tmp/b1-build-final-pass.log`、`/tmp/b1-eslint-final-pass.log`、`/tmp/b1-diff-check.log`。这些是本机临时日志，长期结论保留在本章节。

仍未验证真实浏览器/API/数据库报工恢复、真实受限账号和实际故障代理；未验步骤沿用上一节独立验收方案。代码审核通过不能代替该验收，不宣称首厂交付完成。回滚应仅撤销本B1提交；已有未决sessionStorage记录不得作为回滚清理对象，应先按原UUID核实，避免回滚页面失去恢复入口后重复新报。
