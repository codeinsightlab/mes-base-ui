# MES Base UI
2026-10-05 Active。先读个人 `/Users/user/Documents/agents/AGENTS.md`、前端专项规范，以及相邻 `../mes-base/AGENTS.md` 的公共/范围/工作区规则。

Vue3 + TypeScript + Vue Router4 + Pinia + Element Plus；.nvmrc Node22，不改变用户全局 Node16。保持 API/VO 真实契约、损失为零的 bigint/decimal 字符串；源项目 Vue2 页面是迁移产品资产，保留字段、查询、列、按钮、弹窗/联动、权限、字典和实际用户流程，适配 Vue3，不带客户数据/身份/Secret。

迁移阶段不调用 Codegen Skill，先 COPY / PORT 源页面与 API，不能用重新生成 CRUD 替代已有功能。后续新增开发的标准表驱动页面才先读取 `../mes-base/.agents/skills/mes-crud-codegen/SKILL.md`，通过 Base CLI 自动放置，再做 UI review/优化/test/build。公共 shell、CrudPage、dict、request 与 permission 在 src；使用已有视觉系统。菜单仅能指向已编译模块，客户端按钮和路由不承担最终授权。平台请求明确 scope=platform；厂请求传当前 Factory，切换清除旧数据/权限，过期响应不能回填。按用户2026-10-06明确要求保留刷新登录态：localStorage只保存Token、有效期与选厂偏好，不保存密码、用户资料、菜单或权限；初始化从后端重新校验身份/权限/启用厂，过期、401或注销清除保存值，网络失败保留并允许重试。文件走带认证的私有下载。

`npm run test`、`npm run build`；页面需真实浏览器和窄屏/错误/删除取消检查，单元或构建通过不冒充业务验收。源码优先 src，TEST ONLY 生成页 target/codegen-acceptance 不进正式路由。保留用户已有修改；提交/推送/部署按已有授权。

## Base Design System（2026-10-06）

新增及迁入 MES 页面必须复用 [`docs/UI_DESIGN_SYSTEM.md`](docs/UI_DESIGN_SYSTEM.md)。主题 token 唯一入口 `src/assets/styles/tokens.css`，公共布局样式 `src/styles.css`；禁止页面自行创造颜色、status 映射、spacing 或 card 体系。默认浅色现代工业工作区，保留高信息密度，不引入假生产数据、展示型大屏或阻塞操作的装饰动画。

优先复用 PageHeader、StatusTag、ScopeTag、RightToolbar、Pagination、CrudPage；FilterPanel / TableToolbar / ContentCard 当前分别为 `.filter-panel` / `.table-toolbar` / `.panel` 样式协议，保留 Source 表单 ref 与操作流程。仅多个明确场景存在行为复用时再抽组件，不提前造空组件库。状态按原业务标签或显式 tone，禁止把所有领域数值 0/1 当作同一状态。移动到“更多”的操作必须保留各自权限、可发现入口和确认流程。

页面至少按 Page Header → Filter → Toolbar → Content 统一；保护查询字段、列、批量动作、树、校验、loading/empty/error、分页、导入导出、动态路由和范围清理。真实浏览器检查 1440/1920/1280；窄屏允许侧栏折叠、查询换行和表内滚动。UI 完成不改变后端迁移状态。


应用内视觉延续 Modern Industrial / Control Workspace：`--mes-*` 为语义颜色，`--ui-*` 为已有消费者兼容别名；深工业蓝侧栏、浅冷灰数据工作区、克制青色范围标识。ScopeTag 只表达 PLATFORM / FACTORY，不承担授权；真实 Factory 名称未知时保留 ID，禁止猜测。Environment 只表达前端构建模式，不能伪装服务健康。Home 只使用已验证的账号、范围、菜单与真实接口数据，不造生产指标。Filter → Toolbar → Table → Pagination 使用连续内容面，避免每段独立大卡片；普通行约 40px，允许长内容增高，空态不补假行。日期列留足单行宽度，保留格式和字段。侧栏、Tags 和工厂切换保留原行为；视觉改动须经过真实截图复核、至少一轮针对问题的微调和三档宽度验证。Login 主设计与流程保持稳定。


第二轮数据语言（2026-10-06）：复用 CodeText / MethodBadge / MetricValue / StatusTag / ScopeTag；ID 字符串不转数字，日期不改格式，耗时分级只表达 latency，不能推断 timeout。数据表 / Monitor 使用全部可用宽度，设置页按具体需要限宽。Navbar 60px、Tags 34px，移除重复页面技术标签。Home 复用现有 5 个只读监控 API，按平台权限分别读取，context revision / 卸载拒绝过期回填；不轮询，不以已读取冒充健康，不以任务启用冒充执行。授权入口和个人链接降为次要区域。第一轮主题及 Login 保持稳定。

用户授权的工作台扩展（2026-10-06）：上述 Home 不造生产指标的约束继续适用于真实数据模式；用户明确授权 BusinessWorkspace 的独立示例视图。上下文、指标、列表与详情持续标明“示例数据”，禁止作为真实业务请求失败的兜底，禁止业务提交或写入。服务端 workspaces 契约决定工作台：有有效工厂角色默认业务，仅平台角色默认平台，无角色展示个人入口；双范围可切换，不由可选工厂推断授权，不自动选择首厂。平台账号可显式预览业务示例，预览不改变 Factory 或权限。侧栏一级模块默认只展开活动分支、手动展开一个模块时收起其他一级模块。Druid 目录仅覆盖当前节点中心库与工厂业务池（2026-10-09 收敛）；未初始化明确表达，不因监控主动加载业务池。验收追加到 docs/acceptance/ui-industrial-upgrade/ROUND2.md。
