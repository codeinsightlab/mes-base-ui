# MES Base UI
2026-10-05 Active。先读个人 `/Users/user/Documents/agents/AGENTS.md`、前端专项规范，以及相邻 `../mes-base/AGENTS.md` 的公共/范围/工作区规则。

Vue3 + TypeScript + Vue Router4 + Pinia + Element Plus；.nvmrc Node22，不改变用户全局 Node16。保持 API/VO 真实契约、损失为零的 bigint/decimal 字符串；不复制 Vue2 公司页面。

标准表驱动页面先读取 `../mes-base/.agents/skills/mes-crud-codegen/SKILL.md`，通过 Base CLI 自动放置，再做 UI review/优化/test/build；禁止可用 Skill 存在时重写整套 CRUD。公共 shell、CrudPage、dict、request 与 permission 在 src；使用已有视觉系统。菜单仅能指向已编译模块，客户端按钮和路由不承担最终授权。平台请求明确 scope=platform；厂请求传当前 Factory，切换清除旧数据/权限，过期响应不能回填。Token 只在内存；文件走带认证的私有下载。

`npm run test`、`npm run build`；页面需真实浏览器和窄屏/错误/删除取消检查，单元或构建通过不冒充业务验收。源码优先 src，TEST ONLY 生成页 target/codegen-acceptance 不进正式路由。保留用户已有修改；提交/推送/部署按已有授权。
