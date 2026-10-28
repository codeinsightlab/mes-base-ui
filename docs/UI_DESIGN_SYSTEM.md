# MES Base UI Design System

统一页面设计约定

默认浅色工作区、深蓝灰导航。面向每天长时间使用的制造企业员工：清晰结构、紧凑表格、显式状态、可发现操作。功能、字段和流程继续继承 Source Product；视觉由 Base 统一维护。Home 使用实际账号、Factory、授权入口和既有监控 API 的只读快照；不展示尚不存在的生产指标。

## Foundations

唯一视觉 token 入口是 `src/assets/styles/tokens.css`；Element Plus CSS 后加载 token，再加载 `src/styles.css`。页面禁止再定义主题色、状态色、间距或卡片体系。

| 类型 | 当前规范 |
| --- | --- |
| 色彩 | 冷蓝 `--mes-primary` #285fb5，工业青 `--mes-accent` #087f8c；不以装饰色表达业务状态 |
| 工作区 | `--mes-bg-app` #edf1f5；`--mes-bg-surface` 白；`--mes-bg-elevated` #f6f8fb |
| 文字 / 边框 | `--ui-text`、`--ui-text-secondary`、`--ui-text-muted`；`--ui-border` / `--ui-border-soft` |
| 字体 | 系统中文字体；标题 22px、正文 14px、表格 13px、辅助文字 12px；数字用 `tabular`，编码/端点用 `--ui-font-mono` |
| 间距 | 4/8/12/16/20/24/32px 为日常刻度；40/48/64px 仅用于登录等较大布局 |
| 圆角 / 阴影 | 4px 小控件、6px 控件/表格、8px 面板；内容 `--ui-shadow`，弹层 `--ui-shadow-overlay` |
| 密度 | 默认控件 32px、表格行约 40px；长文本 tooltip、固定操作列、表内横向滚动 |
| 层级 / 动效 | Shell 100、弹层 token 2000；140ms 轻反馈，尊重 reduced-motion；不加持续背景动画 |

## 页面结构与公共实现

单位、BOM版本、数量输入等通用控件的查找和登记入口为[通用组件清单](components.md)。本页维护视觉与页面组合规范，不替代组件清单或组件自身的业务规则。

```vue
<div class="app-container">
  <PageHeader title="页面名称" description="仅必要时解释管理对象" />
  <el-form class="filter-panel" :inline="true"><!-- 保留原字段、ref 与查询处理 --></el-form>
  <el-row class="table-toolbar"><!-- 保留批量动作、权限、RightToolbar --></el-row>
  <el-table><!-- 保留列、字典、选择、loading；操作列给明确宽度 --></el-table>
  <Pagination /><!-- 原分页参数与回调 -->
</div>
```

- `PageHeader`：统一标题/必要说明/可选操作 slot。
- `CodeText`：完整保留字符串 ID / UUID / Code，等宽、次级文字、省略及原值 title；禁止转 Number。
- `MethodBadge`：HTTP 方法的小型标签；已知方法使用语义配色，未知方法保留原值。
- `MetricValue`：数值与单位；latency 仅表达实际耗时分级，不推断超时，字符串数值不改精度。
- `StatusTag` + `src/lib/status.ts`：dot + 业务文字，避免整排彩色胶囊。已有 Source 字典通过 `<dict-tag status ... />` 接入；普通分类字典继续使用原 DictTag。
- FilterPanel 使用 `.filter-panel` 样式协议，TableToolbar 使用 `.table-toolbar`；ContentCard 使用 `.panel` / `.content-card` 或统一主题的 `el-card`。保留现有 `el-form` ref、表单校验及 Source 工具栏，不为三个纯样式容器再包一层空组件。
- `RightToolbar`、`Pagination`、`CrudPage`、request、dict、permission 继续共用。后续只有多个明确场景存在行为复用时才抽新组件。

## 状态与操作

| 语义 | Tone | 颜色 |
| --- | --- | --- |
| 正常 / 启用 / 运行中 | running | 蓝 |
| 成功 / 完成 | success | 绿 |
| 待处理 / 风险 / UNKNOWN | warning | 橙 |
| 失败 / 异常 / REJECTED | error | 红 |
| 停用 / 禁用 / 暂停 / 关闭 | disabled | 灰 |

状态同时显示 dot、颜色和原业务文字。**不根据通用数值 0/1 推断语义**：Source 系统状态正常=0、停用=1，而 OpenAPI 启用=1，分别使用原字典标签或服务端 statusName。未知值显示原文字并用中性灰；领域需要新语义时显式补映射，不改后端状态。编辑型 Switch 保留原 active/inactive 值，补正常/停用文字。

按钮分为 Primary（新增/保存/确认）、Secondary（普通工具）、Text（行操作）、Danger（删除）。高频动作直接展示，低频动作可放“更多”，原权限点必须逐项保留，入口在任一子项可用时才出现。不能以美化删查询、列、批量动作或确认流程。

## 错误反馈

页面内错误继续使用 `el-alert type="error"`：`--ui-feedback-error-bg` 浅底、`--ui-feedback-error-border` 细边框、`--ui-feedback-error-text` 深红文字；16px 图标、13px 主文案、12px 内边距。不截断错误文案，不只靠颜色表达失败。恢复操作使用紧凑描边按钮，与文案同行；空间不足时换行。带说明的提示保留说明，带关闭入口时预留右侧空间。

顶部 `ElMessage.error` 使用同一文字/边框语义与白色背景，长文案换行，最大宽度随视口收缩。保留原 alert 可访问语义、错误内容、显示条件、关闭时机和重试回调，不把错误隐藏或改成成功。公共样式在 `src/styles.css`，页面不重复定义错误提示配色。

## Table / Form / Dialog / Tree

搜索面板紧凑对齐、自然换行；保留 Source 的显隐搜索。表头浅灰、hover/selection 轻蓝；空态、loading、错误重试各自保留。操作列给足 `width/min-width`，拥挤时固定右侧并允许横向滚动，禁止截断必要操作。保留原导入导出、显隐列、日期、精度和分页。

表单保持 label 对齐、必填及错误位置；长表单使用原已有分组，不重新定义字段。简单新增/编辑用 Dialog，统一标题、内边距、分隔线和 footer；宽度受视口限制，提交期禁用/加载按原逻辑。复杂详情以后可使用 Drawer，并复用相同 spacing/footer 规则。

菜单/部门树保留查询、展开折叠、层级缩进、选择及行操作。User 的部门树与表格形成明确的主次区域，不以卡片替代高密度列表。

## Shell / Login / Responsive

侧栏 224px，折叠 64px；层级线与轻高亮识别当前菜单，折叠目录使用可操作弹出菜单，长菜单省略并保留 title。Navbar 60px，保留祖先导航、前端构建环境、当前工作空间 / Factory 名称与 ID、用户必要动作。当前页面身份由 Tags 和 PageHeader 承担，移除重复技术标签和当前页 breadcrumb。工厂未选择时明确显示“未选择工厂”，不自动选首厂；切换沿用 auth revision 清授权/页面缓存/对话框。

Tags 保留完整路径和 query，概览固定；支持关闭、关闭其他、关闭全部、刷新。Token/有效期/选厂偏好在浏览器保存，整页刷新先恢复身份并重新读取当前菜单/权限，恢复动态路由后保留原页面。密码和权限不保存，过期/401/注销清除；网络故障显示可重试恢复状态，不强制重新登录。标签没有强制十个截断；页面缓存仍有界。

登录页为深蓝灰品牌区 + 简洁白色表单，不使用图库照片或生产指标；保留登录/验证码刷新/注册条件/错误反馈。密码不持久化，错误后清空原密码。

优先 1440/1920，1280 自然换行；800 以下侧栏抽屉化、表单/树布局回落，表格内部横向滚动。不为手机强行改变桌面 MES 操作；PDA 独立演进。

## 页面交付约束

沿用 Source 功能与当前真实 API；后台授权仍是最终边界。检查标题、查询、工具栏、列顺序、字典、日期/精度、表单、loading/empty/error、删除取消、分页、窄屏、中文/tooltip/权限。运行 `npm run test` 和 `npm run build`，再做真实浏览器操作；构建不替代业务验证。具体浏览器证据保存在自有忽略目录。


## MES 语义 Token 与 Scope

`--mes-*` 是新主题的语义颜色入口；已有 `--ui-*` 保留为兼容别名。不要在 Vue 内硬编码主题色。

| Token | 值 / 用途 |
| --- | --- |
| `--mes-sidebar` | #142738，工业深蓝导航 |
| `--mes-border` | #d4dee7，面板与上下文边界 |
| `--mes-text-primary` / `--mes-text-secondary` | #203448 / #52687b |
| `--mes-status-success` / `--mes-status-warning` | #267b55 / #a76a1d |
| `--mes-status-danger` / `--mes-status-info` | #bd4248 / #617689 |
| `--mes-table-header` | #eaf0f5，表头对比 |
| `--mes-grid` | #dce6ee，保留兼容 token，Home 不再使用网格纹理 |
| `--mes-nav-active` / `--mes-nav-indicator` | #25475b / #63c4cc，当前菜单底色与细线 |

`ScopeTag` 只表达范围，不授权。PLATFORM 用蓝色网格图标与“平台范围”；FACTORY 用青色工厂图标与“工厂”。可传 `factoryName` / `factoryId`，未知 kind 保留原值且使用中性样式。角色表保留独立所属工厂列：当前已知工厂显示名称和 ID，名称不可用时保留真实 ID，禁止猜名称或为展示追加数据请求。显示状态用 `StatusTag`，可执行切换继续用原 Switch 与确认流程。
