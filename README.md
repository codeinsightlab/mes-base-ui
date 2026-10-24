# Base MES UI

Base MES 的 Web 管理与现场操作前端，面向中小型离散制造企业。

围绕工单、生产批次和工序，把材料领用、报工、不良申报、入库与追溯放到同一个工作界面，让管理人员看清进度，让现场人员方便地记录生产事实。

配套后端：[mes-base](https://github.com/codeinsightlab/mes-base)。本项目需要后端、数据库和工厂配置共同运行。

## 主要功能

| 场景 | 当前界面能力 |
| --- | --- |
| 业务工作台 | 工单与执行状态、近期报工和不良信息、业务入口 |
| 基础资料 | 物料、分类、单位、版本化 BOM、工序、工艺路线、工作站和设备台账 |
| 生产管理 | 工单、Execution、实际路径、BOM 单材料投产、同批追加、工序报工及记录查询 |
| 质量处理 | 独立不良申报、核实、不良品/报废品入仓和来源查询 |
| 仓储管理 | 仓库、库位、库存及流水、正式单据维护与审核、生产入库 |
| 平台管理 | 用户、角色、菜单、工厂、数据源、系统配置、日志与监控 |

## 界面与交互特点

- **管理与现场操作共用业务模型**：管理页面提供查询和单据维护，现场入口围绕扫码定位与业务提交组织操作。
- **工厂上下文明确**：切换工厂后清理旧数据与相关浮层，权限变化和迟到响应按上下文处理。
- **统一主子单据**：主单信息在上，明细在下；复用单据组件和业务选择器。
- **事实与派生结果分区呈现**：局部数量或关联查询失败时，保留已成功读取且有权查看的事实，并提供错误提示与重试。
- **统一工作区体验**：共享表格、状态、字段和弹出层组件，支持缓存页面的离开审查与未保存编辑提示。

页面菜单与按钮用于引导操作，最终权限、数量、来源和库存规则由后端校验。

## 当前阶段

项目处于开发与交付准备阶段。配套后端的 LOCAL 单材料生产主链已有真实测试环境验收，涵盖 BOM 领料、同批追加、报工、不良入仓、生产分批入库及审核后收尾。

当前重点是统一领料与生产入库的便捷入口、普通单据的草稿/审核交互，以及现场稳定性。工作站现场采集、标签打印、退料调拨与完整管理统计仍需完善。

多阶 BOM 可以维护，生产投产目前只支持一条直接材料组件。页面存在某种单据类型，不等于其来源和审核已经接通；ERP 正式库存业务、完整委外及多材料生产尚未交付。系统监控和业务工作台也不等于设备采集或完整生产分析平台。

## 技术栈

Vue 3 · TypeScript · Vite · Element Plus · Pinia · Vue Router · Vitest · ESLint

```text
src/
  api/          后端接口适配
  components/   公共组件、业务选择器与主子单据组件
  composables/  页面状态及共享交互逻辑
  lib/          请求、权限和基础能力
  stores/       会话与应用状态
  views/        平台管理、生产、质量、仓储等页面
tests/          组件与交互测试
deploy/         Nginx 部署配置模板
```

## 快速开始

需要 Node.js 22.18 或更高版本，并准备可访问的 Base MES 后端。

```sh
nvm use
npm ci
npm run dev
```

`nvm use` 使用仓库的 `.nvmrc`，请确保对应 Node 版本满足 `package.json` 的要求。依赖安装完成后，日常开发无需重复 `npm ci`。

开发环境默认通过 `.env.development` 的 `MES_API_TARGET` 连接 `http://127.0.0.1:8081`。后端端口不同时，在被 Git 忽略的 `.env.development.local` 中覆盖：

```dotenv
MES_API_TARGET=http://127.0.0.1:18081
```

浏览器请求同源 `/api`，由 Vite 代理到后端；开发模式要求显式的 `127.0.0.1` HTTP 地址和端口。地址不含 `/api` 路径或凭证。修改配置后重新启动开发服务。

登录账号、角色、工厂及业务数据源由后端初始化和管理，本项目不提供独立演示账号。

## 检查与构建

```sh
npm run lint
npm run test
npm run build
```

生产构建读取 `.env.production`，本机覆盖使用 `.env.production.local`。构建输出：

- `dist/`：浏览器静态资源。
- `target/deploy/nginx.conf`：根据 API 目标生成的 Nginx 站点配置。

两份产物配套部署；网站域名、静态目录及 HTTPS 按目标环境配置。构建不会自动上传文件或重载 Nginx。更多环境设置、代理和格式规范见[开发与部署说明](docs/development.md)。

## 后续方向

1. 完善统一业务出入库和现场操作体验，补齐请求恢复及异常处理。
2. 补齐退料、调拨、工作站、标签打印与管理统计。
3. 完成首厂现场验收，再逐步扩展 ERP、委外及多材料业务界面。
4. 按实际需求发展设备、辅助排程和只读生产 AI。

路线图以配套后端的正式能力为前提。专门返工、独立放行和定时完结已退出当前方案，不作为后续必建页面。

## 文档与相关项目

- [后端项目与产品介绍](https://github.com/codeinsightlab/mes-base)
- [前端开发与部署说明](docs/development.md)
- [产品当前规划](https://github.com/codeinsightlab/mes-base/blob/main/docs/development/next-stage-plan.md)
- [生产投产与 BOM 规则](https://github.com/codeinsightlab/mes-base/blob/main/docs/development/production-input.md)
- [LOCAL / ERP 业务边界](https://github.com/codeinsightlab/mes-base/blob/main/docs/architecture/local-erp-business-boundary.md)

历史迁移和界面验收记录保留在 `docs/` 及后端专题文档中，不作为本页的项目介绍。

## 来源与第三方声明

部分系统管理能力演进自 RuoYi、ktg-mes-ui 等来源项目，来源清单及第三方许可见[后端声明目录](https://github.com/codeinsightlab/mes-base/tree/main/docs/legal)。不在本页为整个项目新增许可证或变更原组件的授权。
