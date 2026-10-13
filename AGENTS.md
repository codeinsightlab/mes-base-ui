# MES Base UI
2026-10-05 Active。先读个人 `/Users/user/Documents/agents/AGENTS.md`、前端专项规范，以及相邻 `../mes-base/AGENTS.md` 的公共/范围/工作区规则。

## 手工修改生成文件的保护（2026-10-13 用户要求）

修改代码前检查目标文件是否包含 `MES-CODEGEN` 生成归属标记；手工修改带标记的生成页面或其他生成代码时，必须同时移除该文件的生成归属标记，防止未来重新生成覆盖手工改动。仅阅读不移除，不清理未修改文件的标记。通用生成模板、标记检测逻辑和测试样例保留必要标记字符串。移除后生成冲突不得通过擅自恢复标记解决；恢复生成器维护须有用户明确授权。完整规则见 `../mes-base/AGENTS.md` 第 11.1 节。

Vue3 + TypeScript + Vue Router4 + Pinia + Element Plus；.nvmrc Node22，不改变用户全局 Node16。保持 API/VO 真实契约、损失为零的 bigint/decimal 字符串；源项目 Vue2 页面是迁移产品资产，保留字段、查询、列、按钮、弹窗/联动、权限、字典和实际用户流程，适配 Vue3，不带客户数据/身份/Secret。

迁移阶段不调用 Codegen Skill，先 COPY / PORT 源页面与 API，不能用重新生成 CRUD 替代已有功能。后续新增开发的标准表驱动页面才先读取 `../mes-base/.agents/skills/mes-crud-codegen/SKILL.md`，通过 Base CLI 自动放置，再做 UI review/优化/test/build。公共 shell、CrudPage、dict、request 与 permission 在 src；使用已有视觉系统。菜单仅能指向已编译模块，客户端按钮和路由不承担最终授权。请求可声明预期 scope；有已选 Factory 时所有请求携带 X-Factory-Id，接口归属由后端 URL 判断，平台/个人请求不因请求头进入业务库；切换清除旧数据/权限，过期响应不能回填。按用户2026-10-06明确要求保留刷新登录态：localStorage只保存Token、有效期与选厂偏好，不保存密码、用户资料、菜单或权限；初始化从后端重新校验身份/权限/启用厂，过期、401或注销清除保存值，网络失败保留并允许重试。文件走带认证的私有下载。

`npm run test`、`npm run build`；页面需真实浏览器和窄屏/错误/删除取消检查，单元或构建通过不冒充业务验收。源码优先 src，TEST ONLY 生成页 target/codegen-acceptance 不进正式路由。保留用户已有修改；提交/推送/部署按已有授权。

## Base Design System（2026-10-06）

2026-10-11 请求语义：允许 A 请求未完成时选 B 并发起 B 请求，后端 A 保持原上下文；前端在 fetch 返回、错误 body、JSON/text 和 blob body 读取后检查 token/factoryId/revision，拒绝旧响应回填。过期的 A 请求 401 不得清除 B 或新登录态。SESSION_REVOCATION_PENDING 表示账号修改已提交、会话撤销待恢复，不以响应失败误称数据库已回滚；有效期与本地登录恢复契约保持。

新增及迁入 MES 页面必须复用 [`docs/UI_DESIGN_SYSTEM.md`](docs/UI_DESIGN_SYSTEM.md)。主题 token 唯一入口 `src/assets/styles/tokens.css`，公共布局样式 `src/styles.css`；禁止页面自行创造颜色、status 映射、spacing 或 card 体系。默认浅色现代工业工作区，保留高信息密度，不引入假生产数据、展示型大屏或阻塞操作的装饰动画。

优先复用 PageHeader、StatusTag、ScopeTag、RightToolbar、Pagination、CrudPage；FilterPanel / TableToolbar / ContentCard 当前分别为 `.filter-panel` / `.table-toolbar` / `.panel` 样式协议，保留 Source 表单 ref 与操作流程。仅多个明确场景存在行为复用时再抽组件，不提前造空组件库。状态按原业务标签或显式 tone，禁止把所有领域数值 0/1 当作同一状态。移动到“更多”的操作必须保留各自权限、可发现入口和确认流程。

页面至少按 Page Header → Filter → Toolbar → Content 统一；保护查询字段、列、批量动作、树、校验、loading/empty/error、分页、导入导出、动态路由和范围清理。真实浏览器检查 1440/1920/1280；窄屏允许侧栏折叠、查询换行和表内滚动。UI 完成不改变后端迁移状态。


应用内视觉延续 Modern Industrial / Control Workspace：`--mes-*` 为语义颜色，`--ui-*` 为已有消费者兼容别名；深工业蓝侧栏、浅冷灰数据工作区、克制青色范围标识。ScopeTag 只表达 PLATFORM / FACTORY，不承担授权；真实 Factory 名称未知时保留 ID，禁止猜测。Environment 只表达前端构建模式，不能伪装服务健康。Home 只使用已验证的账号、范围、菜单与真实接口数据，不造生产指标。Filter → Toolbar → Table → Pagination 使用连续内容面，避免每段独立大卡片；普通行约 40px，允许长内容增高，空态不补假行。日期列留足单行宽度，保留格式和字段。侧栏、Tags 和工厂切换保留原行为；视觉改动须经过真实截图复核、至少一轮针对问题的微调和三档宽度验证。Login 主设计与流程保持稳定。


第二轮数据语言（2026-10-06）：复用 CodeText / MethodBadge / MetricValue / StatusTag / ScopeTag；ID 字符串不转数字，日期不改格式，耗时分级只表达 latency，不能推断 timeout。数据表 / Monitor 使用全部可用宽度，设置页按具体需要限宽。Navbar 60px、Tags 34px，移除重复页面技术标签。Home 复用现有 5 个只读监控 API，按平台权限分别读取，context revision / 卸载拒绝过期回填；不轮询，不以已读取冒充健康，不以任务启用冒充执行。授权入口和个人链接降为次要区域。第一轮主题及 Login 保持稳定。

用户授权的工作台扩展（2026-10-06）：上述 Home 不造生产指标的约束继续适用于真实数据模式；用户明确授权 BusinessWorkspace 的独立示例视图。上下文、指标、列表与详情持续标明“示例数据”，禁止作为真实业务请求失败的兜底，禁止业务提交或写入。服务端 workspaces 契约决定工作台：有有效工厂角色或平台角色已授予业务权限（platformBusiness）默认业务；仅持有平台权限默认平台，无角色展示个人入口；双范围可切换，不由可选工厂推断授权，默认选厂按服务端规则：有效偏好优先，否则从启用且绑定启用业务库的工厂选择工厂 ID 最小值，纯数字按数值比较；选厂不授予角色或权限。平台账号可显式预览业务示例，预览不改变 Factory 或权限。侧栏一级模块默认只展开活动分支、手动展开一个模块时收起其他一级模块。Druid 目录仅覆盖当前节点中心库与工厂业务池（2026-10-09 收敛）；未初始化明确表达，不因监控主动加载业务池。验收追加到 docs/acceptance/ui-industrial-upgrade/ROUND2.md。


## 业务人员 / 部门 / 岗位嵌入组件（2026-10-10）

业务模块需要人员、部门、岗位搜索或选择时，优先复用 mes-base-ui 的
`src/components/business/directory/PersonnelSelect.vue`、`DepartmentSelect.vue`、`PostSelect.vue`。
接口统一为 `/api/business/directory/{personnel|departments|posts}` 与 `/{id}`，仅提供 GET 列表和单个查询；禁止在这组能力中增加新增、修改、删除或角色分配。
复用中心库 sys_user/sys_dept/sys_post 的平台 Mapper，使用 masterTransactionManager 只读事务；不新增表、不复制目录到业务库。
HTTP 授权使用当前工厂的 business:directory:{personnel|department|post}:read 权限，不能让组件调用平台管理 API 或要求 system 权限。
中心目录为跨厂共享引用，不表示人员所属工厂；不能把选厂过滤误称为目录行隔离。人员只暴露编号、名称、人员编码和部门编号，禁止返回密码、联系方式、角色等 SysUser 敏感字段。
组件 ID 使用字符串，切厂/撤权清理已选项与候选数据、拒绝过期响应。平台管理页面保持原有管理能力。
契约与使用方式见 mes-base 的 docs/development/business-directory.md。

## 工厂上下文恢复（2026-10-12 用户确认）

只处理服务端专用 `422 / FACTORY_SELECTION_REQUIRED`，不按任意 422 猜测工厂问题。
保留 Token、平台授权，清空工厂 ID、业务菜单/权限及旧页面状态，路由到 `/select-factory`。
选厂页和首页复用 `auth.loadFactoryOptions()` 与 `/api/foundation/factories`；服务端只返回启用且绑定启用数据源的候选。
登录/刷新期间遇到此码不清登录态；过期响应不得触发新上下文恢复。不自动选其他工厂、不重放失败请求。
零候选允许进入平台/个人工作台，不绑定默认数据库；重新选择成功才恢复业务授权。

## OpenAPI 管理恢复（2026-10-12 用户明确要求）

`src/views/system/openApiClient/index.vue` 与 `src/api/system/openApiClient.ts` 恢复客户端创建、启停、一次性 Secret 展示/重置与接口分组授权。
复用平台 request/权限/菜单机制；凭证不写 localStorage，关闭对话框/离开页面清空 Secret，迟到响应不恢复凭证。
后台用户 Token 与外部应用 Token 不互通，页面不保存外部 Token，不自动赋予角色或外部 API 权限。
