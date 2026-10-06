# MES Base UI
2026-10-05 Active。先读个人 `/Users/user/Documents/agents/AGENTS.md`、前端专项规范，以及相邻 `../mes-base/AGENTS.md` 的公共/范围/工作区规则。

Vue3 + TypeScript + Vue Router4 + Pinia + Element Plus；.nvmrc Node22，不改变用户全局 Node16。保持 API/VO 真实契约、损失为零的 bigint/decimal 字符串；源项目 Vue2 页面是迁移产品资产，保留字段、查询、列、按钮、弹窗/联动、权限、字典和实际用户流程，适配 Vue3，不带客户数据/身份/Secret。

迁移阶段不调用 Codegen Skill，先 COPY / PORT 源页面与 API，不能用重新生成 CRUD 替代已有功能。后续新增开发的标准表驱动页面才先读取 `../mes-base/.agents/skills/mes-crud-codegen/SKILL.md`，通过 Base CLI 自动放置，再做 UI review/优化/test/build。公共 shell、CrudPage、dict、request 与 permission 在 src；使用已有视觉系统。菜单仅能指向已编译模块，客户端按钮和路由不承担最终授权。平台请求明确 scope=platform；厂请求传当前 Factory，切换清除旧数据/权限，过期响应不能回填。Token 只在内存；文件走带认证的私有下载。

`npm run test`、`npm run build`；页面需真实浏览器和窄屏/错误/删除取消检查，单元或构建通过不冒充业务验收。源码优先 src，TEST ONLY 生成页 target/codegen-acceptance 不进正式路由。保留用户已有修改；提交/推送/部署按已有授权。

## Base Design System（2026-10-06）

新增及迁入 MES 页面必须复用 [`docs/UI_DESIGN_SYSTEM.md`](docs/UI_DESIGN_SYSTEM.md)。主题 token 唯一入口 `src/assets/styles/tokens.css`，公共布局样式 `src/styles.css`；禁止页面自行创造颜色、status 映射、spacing 或 card 体系。默认浅色现代工业工作区，保留高信息密度，不引入假生产数据、展示型大屏或阻塞操作的装饰动画。

优先复用 PageHeader、StatusTag、RightToolbar、Pagination、CrudPage；FilterPanel / TableToolbar / ContentCard 当前分别为 `.filter-panel` / `.table-toolbar` / `.panel` 样式协议，保留 Source 表单 ref 与操作流程。仅多个明确场景存在行为复用时再抽组件，不提前造空组件库。状态按原业务标签或显式 tone，禁止把所有领域数值 0/1 当作同一状态。移动到“更多”的操作必须保留各自权限、可发现入口和确认流程。

页面至少按 Page Header → Filter → Toolbar → Content 统一；保护查询字段、列、批量动作、树、校验、loading/empty/error、分页、导入导出、动态路由和范围清理。真实浏览器检查 1440/1920/1280；窄屏允许侧栏折叠、查询换行和表内滚动。UI 完成不改变后端迁移状态。
