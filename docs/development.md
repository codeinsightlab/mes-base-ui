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


## 2026-10-24 — B1/B2 独立真实验收（退回 B1，B2 传输通过）

本节追加当前证据，不覆盖上面的“待真实验收”时间线。只审查、创建独立 QA、注入测试故障及保存验收产物；没有修复业务代码、修改公共请求实现/配置/Schema/迁移、改变角色权限、调用 ERP、启停用户服务、推送或部署。未创建子 Agent，也未向其他用户会话发消息。

### 输入与运行前提

- 前端 `http://localhost:5173`，源码 HEAD `9a2f7be` 包含 B1 `5dc19fc511fd33e9d0d63a370a83787045935b7b` 和 B2 `621c3c77aada13d8b949e286db2c038417828ae5`。B1 的恢复模块、报工页、auth 与其指定提交逐字节相同；request.ts 与 B2 指定提交相同。读取 Vite 实际编译模块并在真实 Chrome 使用；指纹见 `versions.json`。
- 后端 `http://localhost:8081`，只读核实 PID24753 正在运行 `./target/mes-base-0.1.0-SNAPSHOT.jar`，JAR SHA256 `1e8e1f1aa6956a3d85d4fee51643557ae57ab637f2b97bff496f6527d73d5338`，验收期间未变化。源码初读 `d931f77`、最终版本核对 `c051e3d`，均包含 A 验收记录 `18a7fe1`，中间其他任务提交为文档调整。JAR没有已核实的内嵌Git提交号，因此不把源码HEAD直接称为运行版本；本轮正式领料审核、投入、现场报工、入库审核与收尾的真实成功作为 A 链路已加载的行为证据。
- 已认证账号 `admin/userId=100`，Factory `TEST_DEV_PERF_20261019`。新核实中心绑定 datasource9，Factory/数据源均 ENABLED，LOCAL；`192.168.18.25:3306/mes_base_dev_perf_test`，实际 `DATABASE()` 一致，MySQL8.2.0。只读确认 V61/V62成功记录；**本轮没有执行迁移**。
- 写前检查 `QA_B1_20261024_%` 工单前缀无冲突；保存保护范围原行TSV和SHA256。所有测试业务事实通过正式API产生，没有直接数据库写入。后端并行文档改动、前端既有系统页面及测试脏改动均未暂存或代交。

### B1 真实业务与故障注入结果

正式调用链：原报工页面 `submit` → `productionReporting.submit` → `POST /api/production/reporting` → `ProductionReportingController`（正式报工权限）→ `ProductionReportSubmitService.submit`（原UUID重放优先、事务锁与资格/数量校验）→ `MesProductionReportMapper`。准备数据经正式工单、BOM、库存单审核及生产投入API，没有用管理员补报替代现场报工。

QA 工单1930/执行12380是首轮独立准备，因缺少共享工序能力，context真实返回NO_CAPABILITY；没有给共享工序或角色扩权。另建专用工序632、路线829/节点9435及本账号在该专用工序的合法能力，再准备工单1931/执行12381，目标4件；两组独立库存2240–2243与所有已生成事实均保留。后者完成4件报工及正式审核入库，最终FULLY_RECEIVED/工单COMPLETED。

| 场景 | 预期与本轮实际 | 结果/证据 |
| --- | --- | --- |
| 普通页面按钮 | 顶层正式页实际点击确认；一笔1件，流水262477 | 通过：`normal-button.*`、数据库UUID核对 |
| 表单submit路径 | 测试壳触发原生requestSubmit，原页面handler提交；一笔1件，流水262478 | 通过：`form-normal.json`；不是把测试壳按钮冒称普通按钮 |
| 发送前存储失败 | 注入setItem异常后零报工POST，显示“尚未发送”并阻止新报 | 通过：`b1-storage-write-failure.*` |
| 服务端成功、页面未取得完整结果 | 原页面冻结五字段、真实Fetch发送；服务端流水262479。壳保留真实结果作证据，向页面注入停滞响应体，页面超时后保留原请求 | 恢复记录保留通过；**成功语义显示失败，见缺陷B1-01**；`lost-response.json`、`reports-after-lost-body.tsv` |
| 刷新、离页返回、重新定位 | 原UUID仍在；明确恢复按钮前无新增report-post/后端事实 | 通过：`reload-no-post.txt`、`return-no-post.txt`、`other-execution-no-post.txt`；只读证据条目不是POST |
| 未决期间定位其他执行 | 可读本任务12380；普通按钮禁用，原生表单submit不POST，未创建新UUID | 通过；该另一个执行本身无工序能力，尚未覆盖“另一个也具备报工资格”的组合 |
| 未知后403/404/通用409 | 注入三类错误；均保留原UUID和完整命令，没有自动清理 | 通过：`recovery-403/404/409.txt`；这些错误是浏览器注入，不是后端真实撤权/资源删除 |
| 数量上下文失败 | 注入503，页面明确显示失败，独立恢复面板仍在；随后不依赖context成功就能原样恢复 | 通过：`context-failure-pending.txt`、`recovered-original.json` |
| 存储读取失败 | 注入getItem异常，显示不可读取并阻止新报；解除故障、明确重新读取后才可恢复 | 通过：`storage-read-failure.txt` |
| 同UUID原样重放 | 原UUID `7f883f37-6d91-4c9d-9400-b236d8351560` 的真实重放返回原流水262479；五个字段逐一相等 | 通过：`recovered-original.json`、`final-browser.json`、`uuid-final.tsv` |
| 成功但清理失败 | 最后一件流水262480成功；注入removeItem失败，成功流水保持可见，清理错误独立显示，禁止新报 | 通过：`cleanup-failure.*` |
| 执行已关闭后恢复 | 正式审核入库4件并收尾后，原UUID `7322f7d0-8a67-49d8-8a7d-8c179bc4ca5c` 仍返回原流水262480，无须重满足新报资格 | 通过：`closed-execution.json`、`closed-pending-before-replay.txt`、`closed-replay.txt` |
| 真实切厂、同账号重新登录、不同账号、登录挂起、撤权 | 当前仅使用admin既有身份；有其他启用LOCAL厂，但其绑定不同业务库。本轮未在其他库开展业务验收，也没有隔离的新登录身份或第二账号凭据；未改权限制造撤权条件 | **未验**；B2合成上下文测试不能代替 |
| 未知后401、CONTEXT_CHANGED；损坏记录；迟到查询/响应竞态 | 本轮未在正式报工页面执行这些组合。无TTL、版本票据、命令/owner比较仅完成源码审查 | **未验**；修复B1-01后须补独立真实验收，不计为通过 |

原丢失结果请求（由生产页面自行生成，未手填存储）：

```json
{"executionId":"12381","routingNodeId":"9435","reportQty":"1","workstationId":null,"requestId":"7f883f37-6d91-4c9d-9400-b236d8351560"}
```

数据库最终只读核对：UUID `34d62666-b76a-437c-9ac7-62e18d3f517d` / `a075cebc-e037-4310-a67c-c2426311dea4` / `7f883f37-6d91-4c9d-9400-b236d8351560` / `7322f7d0-8a67-49d8-8a7d-8c179bc4ca5c` 各1条事实，分别对应262477–262480，各1件，合计4件。重放没有重复增加数量或收尾事实。壳中的403/404/409未发送到后端；对账时按`kind=report-post`筛选，再区分`injected`与真实发送，不能直接把含只读取证的entries长度当POST数。

### B1-01：新请求未知结果被上一笔成功结果误标（P2，退回修改）

位置：`src/views/production/productionReporting/index.vue:69–74` 开始新请求时保留旧result；`:111`继续显示旧成功流水；`:115–119`以result是否存在决定当前pending“已成功”及按钮文案，没有证明两者属于同一原请求。

复现：在同一次定位中成功报工1件（本次流水262478）；再选择同工序报工1件并注入lose-body；等页面报告超时。实际同时显示“连接失败或超时”、“报工成功：流水262478”，却把新UUID `7f883f37-...` 的恢复面板标为“报工已成功，恢复记录待清理”。预期新请求应显示待确认，直到该原请求的可信结果返回；上一笔成功不能证明下一笔已成功。本次只读知道服务端确已生成262479，并不授权客户端在未知时提前宣称成功。完整DOM `b1-stale-success-defect.txt`、现场读取与原请求/数据库证据可复核该错误文案；`b1-stale-success-defect.png` 只捕获了当时滚动后的表单视区，没有包含上方恢复面板，不把它当作错误文案的可视证据。没有实施修复。

**B1结论：退回修改。** 上表已通过的恢复/数量场景不抵消该缺陷；身份及竞态未验项仍须补齐，不宣称B1整体通过。

### B2 浏览器响应生命周期

使用无数据库连接的本机隔离HTTP探针 `127.0.0.1:18763`，真实Chrome Fetch/Response流加载与当前Vite相同的request模块（移除source map后SHA256 `a1b0e4c563d73884425f2775e35b184560a27c33de33526f221bb1a04f3439de`）。只配置合成token和Factory，未把真实Token发送给探针；没有修改现有代理或用户服务。可复用脚本最终运行的PID55686已在自身会话Ctrl-C退出，端口确认无监听。

| 场景 | 实际（配置1000ms；记录浏览器调度抖动） | 结果 |
| --- | --- | --- |
| 头部立即、成功JSON体停滞3秒 | 1092ms以NETWORK_ERROR/status0结束，保留X-Request-Id | 通过 |
| 非2xx错误体停滞3秒 | 1095ms，NETWORK_ERROR/status0，保留requestId；未误作确定403 | 通过 |
| blob体停滞3秒 | 1095ms，NETWORK_ERROR/status0，保留requestId | 通过 |
| 发送650ms＋读取650ms | 1130ms结束，未重新给读取体1000ms | 通过 |
| 截止前完整JSON、空响应、204 | 417/6/6ms正常返回；空响应undefined | 通过 |
| 主动取消读取、体中断 | 277/324ms，NETWORK_ERROR/status0且requestId保留 | 通过 |
| 合成切Factory后的迟到200/401/专用422 | 513/510/508ms，CONTEXT_CHANGED，401与选厂回调均未执行 | 通过（三项） |
| 合成换登录态后的迟到200/401/专用422 | 504/510/510ms，CONTEXT_CHANGED，回调均未执行 | 通过（三项） |
| 成功SSE | 实际收到有效data事件，持续1395ms超过普通1000ms后仍活跃，调用方取消中止reader | 通过 |
| 非2xx SSE错误流停滞 | 1090ms，NETWORK_ERROR/status0、保留requestId | 通过 |

**B2结论：审核通过，所需浏览器传输验收完成（17/17）。** 这是请求库对真实HTTP响应流的证据，不是B1真实账号切换、后端权限、部署或首厂交付证明。计时是浏览器墙钟观测，存在约0.1秒调度延迟，不宣称硬实时定时器保证。未重复把此前Vitest结果计入17项。

### 数据保护、产物与交接

私有证据根目录：`/Users/user/work/lixin/mes-base/.local/b1b2-20261024/`（Git忽略）。`versions.json`、`target.json`、`summary.json`记录版本与目标；`*-request.json`为独立QA正式API输入；浏览器DOM/PNG及`final-browser.json`为受控故障证据；`uuid-final.tsv`/`context-final.json`为正式API与只读数据库对账；`b2/metadata.json`、`b2/results.json`、`b2/network.jsonl`、`b2/browser-final.*`、`b2/process-stop.json`为传输及进程清理证据。完整业务快照、凭证和大体积截图不进Git。

写前保护原行与写后校验覆盖：工单1921–1929、执行12372–12378，以及关联领料主/明细、投入、提交、报工、仓储单主/明细、库存动作、结束事实和质量处置，共12组。`protected-before.json`与`protected-after.json`、`protected-final.json`的12组哈希及行数全部一致。该结论覆盖原90＋10和A的独立QA范围，**不宣称未快照的余额表或全库所有表均不变**。新建QA工单1930、1931及其事实均保留，没有清空或订正旧事实。

只新增本节和 `scripts/acceptance/b1b2/` 的可复用验收脚本/使用说明。Python AST及JS语法检查通过；17项真实浏览器传输通过，B1正式页面/服务/数据库结果如上；未运行前后端全量单测或构建，未把旧自动化、H2、Mock当成本轮真实业务证据。业务修复交回实施方处理B1-01，修复后继续补齐上表未验项目。
