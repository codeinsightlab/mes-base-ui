# 通用组件清单

本页是前端查找和登记通用组件的唯一入口。先按业务内容找组件，再阅读源码的props、事件和实际消费者；没有合适实现时，先检索现有源码，确认不存在后新增并登记。视觉样式遵守[统一设计规范](UI_DESIGN_SYSTEM.md)，请求和运行环境见[开发说明](development.md)。

## 收录与使用规则

- 收录可跨页面复用、具有稳定业务或输入含义的选择器、数量输入、扫码、值展示及基础表单控件，例如单位、BOM版本、物料、仓库和人员选择。
- 不收录工作台、整页、领域处理面板、业务动作，以及为了拆分普通页面而产生的局部组件。页面外壳、CRUD和主子单据的组合方式见现有开发/设计指南，本页不枚举这些页面组件。
- 同一业务内容使用同一组件和规则。调用方负责值、必要上下文、只读/禁用状态及尺寸，不自行覆盖查询、校验、精度、格式、分页、回显、错误/重试和上下文清理规则。不能通过slot、CSS或复制代码绕过这一边界。
- 必要上下文如当前物料、父工单、仓库来源，必须使用组件已有的明确契约；它们不是任意改变业务规则的配置入口。不同业务语义先明确再登记，例如BOM配比系数不等于库存实物数量，不能强制套同一整数限制。
- ID和decimal遵守项目字符串精度规则。切厂、身份/权限变化及卸载按组件契约清理，迟到响应不能回填。前端控件不授予后端权限，也不替代写入校验。
- 新增、移动、改名、替换或删除通用组件时，在同一变更维护清单和引用。登记源码和代表性消费者，不复制完整props定义；准确接口以源码为准。

表中“现有”表示源码已有该控件，不表示所有消费者、场景差异或交互都已完成统一验收。“待归并”不是推荐新入口，新增调用前须先处理或明确边界。

## 业务选择与数量输入

| 业务内容 / 组件 | 权威源码 | 必要数据与规则边界 | 代表性消费者 |
| --- | --- | --- | --- |
| 计量单位 `UnitMeasureSelect` | [UnitMeasureSelect.vue](../src/components/business/material/UnitMeasureSelect.vue) | 单位ID、禁用状态；组件负责远程分页检索、已选项回显、错误重试和上下文失效 | [物料维护](../src/views/basic/materials/index.vue)、[工单用料](../src/components/business/production/WorkorderMaterialPanel.vue) |
| BOM版本 `BomVersionSelect` | [BomVersionSelect.vue](../src/components/business/material/BomVersionSelect.vue) | BOM ID、所属物料ID、禁用状态；按物料选择已发布版本，返回选中版本及revision并补查当前已选项以支持跨页回显；只显示默认标记，不自行应用默认。子BOM未选仍表示叶项 | [BOM组成](../src/components/business/material/MaterialBomPanel.vue)、[工单用料](../src/components/business/production/WorkorderMaterialPanel.vue) |
| 实物数量 `QuantityInput` | [QuantityInput.vue](../src/components/business/material/QuantityInput.vue) | 数量值、物料ID及必要输入状态；规则取自物料单位；原值不变、官方精确余量等使用已有明确契约，不能由页面伪造或自由指定精度。默认 `physical`；BOM基准/组件系数显式 `semantic="bom-ratio"`，`showUnit` 按同次读取的正式单位显示后缀；比例不使用实物余量/原值豁免参数 | [质量申报](../src/components/business/quality/DefectDeclarationPanel.vue)、[生产入库](../src/components/business/production/ProductionReceiptAction.vue)、[销售订单](../src/views/sales/order/index.vue) |
| 物料 `MaterialSelect` | [MaterialSelect.vue](../src/components/business/MaterialSelect.vue) | 物料ID、禁用状态；远程检索、分页、回显及上下文保护在组件内维护 | [销售订单](../src/views/sales/order/index.vue)、[库存单据](../src/views/wm/stockDocuments/StockDocumentPage.vue) |
| 仓库 `WarehouseSelect` | [WarehouseSelect.vue](../src/components/business/WarehouseSelect.vue) | 仓库ID、可信来源及已有历史读取语义；保留LOCAL/EXTERNAL来源约束，不由页面另写候选算法 | [工单用料](../src/components/business/production/WorkorderMaterialPanel.vue)、[生产入库](../src/components/business/production/ProductionReceiptAction.vue) |
| 库存来源 `StockSourceSelect` | [StockSourceSelect.vue](../src/components/business/warehouse/StockSourceSelect.vue) | 当前物料、仓库和库存身份；选择具体库存来源，不等同于选择仓库或选择物料 | [库存单据](../src/views/wm/stockDocuments/StockDocumentPage.vue)、[生产入库](../src/components/business/production/ProductionReceiptAction.vue) |
| 工作站 `WorkstationSelect` | [WorkstationSelect.vue](../src/components/business/WorkstationSelect.vue) | 工作站ID；共享检索、分页和回显；页面不根据设备/报工用途重复实现同义工作站选择 | [设备维护](../src/views/basic/equipment/index.vue) |
| 客户 `CustomerSelect` | [CustomerSelect.vue](../src/components/business/CustomerSelect.vue) | 客户ID、禁用状态；统一远程搜索、分页、回显和错误处理 | [销售订单](../src/views/sales/order/index.vue) |
| 业务人员 `PersonnelSelect` | [PersonnelSelect.vue](../src/components/business/directory/PersonnelSelect.vue) | 引用sys_user ID；统一人员目录包装，不代表独立Personnel主数据，不以目录代替工序资格或派工校验 | [质量记录](../src/views/quality/productionDefect/index.vue) |
| 业务目录底层 `BusinessDirectorySelect` | [BusinessDirectorySelect.vue](../src/components/business/directory/BusinessDirectorySelect.vue) | 仅使用已有的受支持目录资源；人员优先使用PersonnelSelect；工艺目录按已有资源语义复用，不另建目录HTTP或名称缓存 | [人员选择](../src/components/business/directory/PersonnelSelect.vue)、[执行列表工艺筛选](../src/components/business/production/ProductionExecutionList.vue) |
| 工单 `WorkOrderSelect` | [WorkOrderSelect.vue](../src/components/business/production/WorkOrderSelect.vue) | 工单ID、来源/状态上下文、禁用状态；保持可信来源与业务场景准入；不得由名称猜测工单身份 | [库存单据](../src/views/wm/stockDocuments/StockDocumentPage.vue) |
| 执行关联 `ExecutionSelect`（待归并） | [ExecutionSelect.vue](../src/components/business/production/ExecutionSelect.vue) | 执行ID及可选父工单；当前用于记录查询/申报关联。与下一行的检索、候选及返回方式不同，新增消费者前须统一同义规则 | [报工记录](../src/views/production/productionReport/index.vue)、[质量申报](../src/components/business/quality/DefectDeclarationPanel.vue) |
| 单据执行选择 `ProductionExecutionSelect`（待归并） | [ProductionExecutionSelect.vue](../src/components/business/production/ProductionExecutionSelect.vue) | 执行ID、状态上下文及selected事件；与ExecutionSelect并存不表示允许持续维护两套同义规则；不能混淆ID关联与用户扫码定位 | [库存单据](../src/views/wm/stockDocuments/StockDocumentPage.vue) |
| 工单可用工艺 `ExecutionRoutingSelect` | [ExecutionRoutingSelect.vue](../src/components/business/production/ExecutionRoutingSelect.vue) | 父工单ID、工艺选择值和禁用状态；候选来自该工单上下文，不等同于通用工艺目录或路径编辑 | [执行列表](../src/components/business/production/ProductionExecutionList.vue) |

## 扫码与值展示

| 通用内容 / 组件 | 权威源码 | 规则边界 | 代表性消费者 |
| --- | --- | --- | --- |
| 扫码/人工输入 `CodeScanner` | [CodeScanner.vue](../src/components/scanner/CodeScanner.vue) | 统一输入和确认事件、输入方式及上下文失效。生产标识解析与定位使用正式productionScan接口，调用方不复制扫码规则。图片识别辅助位于同目录qrImage.ts | [现场报工](../src/views/production/productionReporting/index.vue)、[质量申报](../src/components/business/quality/DefectDeclarationPanel.vue) |
| 数量展示 `QuantityText` | [QuantityText.vue](../src/components/business/production/QuantityText.vue) | 数量格式使用公共quantity规则；保留原值精度和待确认语义，不能由页面各写toFixed或将null当0 | [工单进度](../src/components/WorkOrderProgress.vue)、[工单用料](../src/components/business/production/WorkorderMaterialPanel.vue) |
| 编码/ID展示 `CodeText` | [CodeText.vue](../src/components/CodeText.vue) | 保留原字符串、完整值title和统一等宽展示，不把大整数ID转Number | [工单](../src/views/production/workorder/index.vue)、[公共列表](../src/components/CrudPage.vue) |

状态、范围、HTTP方法及指标的纯视觉展示沿用[设计规范的公共实现](UI_DESIGN_SYSTEM.md#页面结构与公共实现)，不在业务页面另建配色或状态语义。

## 基础表单控件

| 通用内容 / 组件 | 权威源码 | 规则边界 / 使用位置 |
| --- | --- | --- |
| 字典选择 `DictSelect` | [DictSelect.vue](../src/components/DictSelect.vue) | 以字典code和值驱动，复用公共字典读取及错误状态；例如系统用户表单。不要用于替代有独立业务API的单位或物料选择 |
| 字典值展示 `DictTag` | [DictTag/index.vue](../src/components/DictTag/index.vue) | 共享字典值/标签与状态展示；通过systemPlugin全局注册，不能因页面没有显式import判为未使用 |
| 树选择 `Treeselect` | [Treeselect/index.vue](../src/components/Treeselect/index.vue) | 统一树控件适配；系统用户、菜单和部门页面提供各自真实树数据，控件不决定业务授权 |
| 系统用户单选 `userSelect/single` | [userSelect/single.vue](../src/components/userSelect/single.vue) | 系统消息等平台用户选择；与业务人员目录分属不同用例，不能用于绕过业务资格限制 |
| 私有文件上传 `FileUpload` | [FileUpload/index.vue](../src/components/FileUpload/index.vue) | 统一上传模型和文件限制；使用服务端资源策略和认证接口，不能从页面改成公共裸路径 |
| 图片上传 `ImageUpload` | [ImageUpload/index.vue](../src/components/ImageUpload/index.vue) | 图片语义包装，内部复用FileUpload；图片限制及预览沿用公共能力 |
| 富文本 `Editor` | [Editor/index.vue](../src/components/Editor/index.vue) | 公共编辑器适配，文件上传沿用私有接口；通过systemPlugin注册，具体数据权限由使用业务决定 |
| 图标选择 `IconSelect` | [IconSelect/index.vue](../src/components/IconSelect/index.vue) | 系统菜单图标选择，使用已有图标资源；不另建页面级图标选择实现 |

## 已知统一缺口

- **分页交互：** 单位、物料、仓库、工作站、客户等选择器已有分页，但多处“加载更多”在下拉面板外。这是现状，不是推荐设计；应在组件层统一面板内分页交互，保留完整检索、失败重试和迟到响应保护，不能简单只取第一页或改成无界全量加载。
- **单位回显：** 物料页仍有独立loadUnitNames查询；已复用单位选择器不等于所有单位名称读取都已统一。后续按统一引用读取与缓存规则治理，不再复制页面查询。
- **物料对话框：** BOM面板内部仍使用MaterialPicker，与公共MaterialSelect的交互/读取需要核对并统一同义规则。该局部实现不作为另一个推荐公共入口，不能未经边界分析就复制到新页面。
- **执行选择：** ExecutionSelect与ProductionExecutionSelect尚未统一；先明确记录查询、单据选择、可信状态候选和扫码定位的差异，再收敛共同选择能力。不能仅为减少文件而删除必要准入，也不能以不同组件名长期维护相同业务规则。
- **数量语义：** QuantityInput用于物料单位约束的实际数量。BOM基准/组件系数使用 `QuantityInput semantic="bom-ratio"`，单位用于说明对应物料的基本单位，不限制配比为整数；配比校验复用固定的 `bomRatio` 契约，不开放任意精度或跳过校验开关。

这些条目是后续治理范围，不表示本清单已经修改了组件行为。

### BOM默认版本

产品默认BOM版本由工单用料场景读取并决定是否预选。`BomVersionSelect`本身不自动选择默认，避免改变BOM组成中的可选子BOM语义；工单首次维护且没有已保存BOM时，`WorkorderMaterialPanel`读取默认值，仅在用户尚未改选或清空时写入未保存表单。读取失败显示错误和重试；确无默认时允许人工选择。选择器通过`selected`事件提供当前已发布BOM及revision，工单保存将该revision交由服务端复验。默认切换不改写已保存工单用料或冻结事实。
