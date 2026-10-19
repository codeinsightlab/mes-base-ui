# MES Base UI

## 2026-10-17 — LOCAL / ERP 页面与请求约束（用户确认）

本节覆盖旧的混合生产与无缝切换页面建议；后端完整约束见 [mes-base/AGENTS.md](../mes-base/AGENTS.md)，业务规则与当前未实现项见 [业务边界设计方案 V1.0](../mes-base/docs/architecture/local-erp-business-boundary.md)。以下规则持续生效；V1.7 来源展示与受控选择器已实施，验收及未验证边界见 [V1.7 实施报告](../mes-base/docs/reviews/2026-10-17-local-external-source-isolation-v17-report.md)。

- 工厂新业务仅按服务端当前 LOCAL/ERP 模式开放；工单、原料仓、成品仓必须同来源（LOCAL 或 EXTERNAL）且模式允许。选择器过滤与提交前提示须一致，缺来源/映射或配置异常阻止新正式操作；最终校验由后端负责，不在浏览器推断来源或 ERP 降级。
- 来源仅展示服务端可信字段，普通编辑不得填写、变更来源或伪造 ERP 映射；EXTERNAL 库存镜像明确标示参考用途，不作为正式可领/可入权威依据。历史来源记录可查不等于允许两套新业务并行。
- 每厂最多选择一个有效 ERP；保留模式锁定与迁移准备提示，解绑不解锁，禁止普通工厂编辑切换有历史的模式。迁移采用停旧启新，补录须区分历史加工和新增加工，不提供一键无缝迁移或直接删除历史事实入口。
- 历史核实/撤销通过原操作 ID 请求，由后端使用冻结来源/provider/binding；UNKNOWN 保留原身份，不自动重建、重试创建或改派当前 ERP。沿用切厂、撤权、卸载和迟到响应清理，不能用当前页面模式重解释旧事实。

## 2026-10-14 主子单据页面

未来遇到主表带明细的单据结构，前端不沿用生成的单表页面或两张独立CRUD页面，优先复用 `src/components/document/MasterDetailDocument.vue`、`DocumentFields.vue`，采用上方主单、下方绑定当前主单的明细表。业务模块显式提供真实字段、API、权限、父单关联键和业务选择器，组件保持通用交互。前端组件复用不豁免后端生成：新增主表与明细表仍必须通过Codegen Skill生成完整基础后端（persistence + backend，通常同时test），生成配置不产出独立单表前端页面；基础后端生成与业务规则补齐遵守相邻 mes-base/AGENTS.md 第13/14节及迁移例外。

本轮组件沿用现有CrudApi、API适配层、request及主单/明细CRUD后端；领料接口继续经业务Service调用生成Mapper/XML/Example，并保留引用校验、事务和父单删除保护。没有另建通用主子后端引擎，也不由前端执行后端业务规则。先保存主单再新增明细，明细查询和创建固定父单标识，避免手输父单或跨单操作。当前逐次保存与未来整单事务契约必须明确区分；切厂/撤权/卸载清理数据并拒绝迟到响应，保留分页、精确字符串ID/decimal和删除确认。旧独立页面只作必要地址跳转，不保留第二套实现。

2026-10-05 Active。先读个人 `/Users/user/Documents/agents/AGENTS.md`、前端专项规范，以及相邻 `../mes-base/AGENTS.md` 的公共/范围/工作区规则。

## 手工修改生成文件的保护（2026-10-13 用户要求）

修改代码前检查目标文件是否包含 `MES-CODEGEN` 生成归属标记；手工修改带标记的生成页面或其他生成代码时，必须同时移除该文件的生成归属标记，防止未来重新生成覆盖手工改动。仅阅读不移除，不清理未修改文件的标记。通用生成模板、标记检测逻辑和测试样例保留必要标记字符串。移除后生成冲突不得通过擅自恢复标记解决；恢复生成器维护须有用户明确授权。完整规则见 `../mes-base/AGENTS.md` 第 11.1 节。

Vue3 + TypeScript + Vue Router4 + Pinia + Element Plus；.nvmrc Node22，不改变用户全局 Node16。保持 API/VO 真实契约、损失为零的 bigint/decimal 字符串；源项目 Vue2 页面是迁移产品资产，保留字段、查询、列、按钮、弹窗/联动、权限、字典和实际用户流程，适配 Vue3，不带客户数据/身份/Secret。

迁移阶段不调用 Codegen Skill，先 COPY / PORT 源页面与 API，不能用重新生成 CRUD 替代已有功能。后续新增开发的标准表驱动页面才先读取 `../mes-base/.agents/skills/mes-crud-codegen/SKILL.md`，通过 Base CLI 自动放置，再做 UI review/优化/test/build。公共 shell、CrudPage、dict、request 与 permission 在 src；使用已有视觉系统。菜单仅能指向已编译模块，客户端按钮和路由不承担最终授权。请求可声明预期 scope；有已选 Factory 时所有请求携带 X-Factory-Id，接口归属由后端 URL 判断，平台/个人请求不因请求头进入业务库；切换清除旧数据/权限，过期响应不能回填。按用户2026-10-06明确要求保留刷新登录态：localStorage只保存Token与选厂偏好（2026-10-15用户更新：不保存或按本地时间判断有效期，由后端401确定会话失效），不保存密码、用户资料、菜单或权限；初始化从后端重新校验身份/权限/启用厂，后端401或注销清除保存值，网络失败保留并允许重试。文件走带认证的私有下载。

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


## 弹出层失焦关闭（2026-10-15 用户要求）

后续新增或修改的弹窗、抽屉、浮层，默认在点击内容区域外（遮罩/外部区域）时隐藏，保留 Esc 与关闭按钮；不得无理由设置 `close-on-click-modal=false`。此处失焦指离开整个弹出区域的交互，不是表单内输入框之间切换焦点、操作下拉选择器或切换系统窗口就关闭。
有未保存编辑时，先确认是否放弃，取消确认继续保留编辑；不能静默丢失。嵌套弹窗关闭只作用于当前层。开始关闭、切厂、撤权及卸载时及时失效请求序列并清理相关浮层，迟到响应不得重新填回或打开旧详情。凭证等特定资源继续遵守关闭即清理规则。


## 2026-10-15 用户确认：统一业务目录与引用缓存

工艺、工序、系统用户等跨页面通用选择及引用回显统一由 BusinessDirectory 提供：前端公共组件经 BusinessDirectoryController，后端业务 Service 调用 BusinessDirectoryService；禁止在各业务模块、Controller 或前端组件另建同对象的共享名称缓存。批量回显先收集本批去重 ID，统一批量读取缓存，仅对未命中 ID 执行参数化 IN 查询，再按 ID 回填；不能在行循环中逐条查询数据库或逐次远程缓存调用。

同一对象的单对象缓存统一使用经审查的 Entity，通用层提供较宽、可复用的数据能力；具体业务需要更窄字段时，在上层按需求转换 DTO/VO，不为这些转换另建投影缓存。不缓存密码、联系方式、角色、权限或生产资格；敏感 Entity 必须在进入缓存前落实安全字段边界。状态仅用于展示，授权、人员可派工资格、存在性及工单适用工艺等规则仍由相应业务服务实时校验，不能由目录缓存替代。历史事实优先使用已有姓名/工序快照，当前目录名称不能伪装成历史快照。

业务目录缓存按当前 Factory 与业务资源隔离，命中前后保留固定事务/租约检查；缺 Scope 不回退全局或中心库。中心用户目录为共享引用。对象写入成功提交后统一失效，回滚不失效；写事务不得向共享缓存发布未提交对象。Redis 故障可退回一次批量数据库查询，数据库失败必须传播。通用缓存实现仅作为目录服务的内部基础设施；原有完整实体业务缓存、认证会话和数据源路由缓存不属于名称回显，不因本约束复制或替代其规则。

单对象缓存必须复用通用详情 Key：同一数据库范围、业务资源和 ID 只使用同一个 `<资源前缀>detail:<编码ID>`，由 DetailCacheKeys 统一生成。BusinessDirectoryService 可以保留批量缓存读取和未命中 IDs 一次 IN 查询，不强制循环调用 findById/selectById；但不得另建 reference/directory/label 或 IDs 组合形式的对象缓存 Key，也不得在同一 Key 下混存 Entity 与窄 DTO/VO。批量读取与通用详情查询必须能双向命中同一份 Entity 数据，使用同一提交后失效规则。资源级失效版本仅作为通用详情的写入屏障元数据，不是另一份对象缓存。

新增目录对象时同时验证生成的新增/修改/删除及导入/同步入口均触发通用淘汰；中心用户等对象通过其统一写入边界失效。验收覆盖真实 Redis 的详情与批量双向复用、完整 Entity 字段保留、提交后刷新、回滚保留及迟到回填被拒绝，不仅验证 key 含有 detail 字样。
