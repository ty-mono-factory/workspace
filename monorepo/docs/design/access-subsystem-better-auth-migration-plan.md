# Access Subsystem：Better Auth 迁移与应用边界调整方案

> 文档状态：核心迁移已实施；第 14 节继续作为后续工作指导  
> 更新时间：2026-08-19  
> 当前阶段：本地认证 Access Subsystem MVP，不保留无价值的认证兼容路径

## 1. 目标与核心决策

本阶段的目标是把现有自编认证实现替换为基于 Better Auth 的本地认证 Access Subsystem MVP，同时纠正 `apps/portal` 混合认证入口、账户管理和应用 Dashboard 的边界问题。

已确定以下决策：

1. Better Auth 是唯一认证引擎，独占密码、认证账户、Verification 和 Session 的实现。
2. 不为“隐藏 Better Auth”增加代码。Better Auth 可以出现在依赖、内部 import、锁文件和具体实现文件中。
3. 公共接口、函数、DTO、路由和业务应用契约保持实现无关，但这样做是为了正常的软件边界，而不是安全隐匿。
4. 前端边界调整与 Better Auth 替换作为同一个迁移项目实施，不建立随后必然删除的 Portal API 兼容层。
5. `apps/portal` 不再作为长期应用存在；其中真正属于 Access Subsystem 的页面迁入 `apps/access-web`。
6. 本 MVP 不新建通用的 `apps/app-launcher`。现有 `apps/ty-demo-app` 直接承担应用入口示例和 AccessContext 第一个消费方的角色。
7. `apps/ty-demo-app` 现有页面、原生 C 调用和业务 API 返回逻辑保持不变，只在外围增加访问门禁。
8. Session 完全交给 Better Auth；旧 Session 不迁移。
9. 开发阶段认证数据没有兼容价值时直接重建，不为 PBKDF2、明文测试口令、`providerId: "local"` 或旧 Cookie 编写迁移逻辑。
10. 首个管理员功能暂时保留，但通过 Better Auth 的管理能力创建，不能继续直接写入密码和 Account 表。

核心原则是：

> 保留业务语义，不保留旧认证实现；保留正确的公共边界，不保留旧内部协议；不为了兼容开发期错误而反向污染目标架构。

## 2. 为什么同时进行前端调整和 Better Auth 替换

如果先在 `apps/portal` 中完成 Better Auth 替换，通常需要产生以下过渡代码：

- 为 `/api/portal/auth/*` 保留兼容端点；
- 把 Better Auth Session 再映射成旧 Portal Session；
- 继续维护 `portal-auth.global.ts`；
- 继续维护登录后 `/dashboard` 跳转；
- 继续让 Dashboard 同时加载账户中心和应用列表；
- 继续保留 `postLoginDefaultUrl`、Portal 路径和 Portal DTO；
- 前端先改成使用新认证后端，拆分后再修改一次路由、接口和跳转；
- Better Auth 的 Cookie、Session 和错误先穿过 Portal 兼容层，随后再删除该层。

这些工作不会进入目标架构，因此不应实施。

“同时进行”表示采用同一个目标架构和一次最终切换，但不表示把所有工作塞进一个提交。开发过程应拆成可构建、可测试、可审查的步骤；旧 Portal 在分支开发期间可以暂时作为参照，但不能作为新实现依赖，也不能发布两套并行认证路径。

## 3. MVP 目标结构

```text
apps/
  access-web/
    登录
    退出
    Session
    修改密码
    账户安全
    管理员创建本地用户
    首个管理员初始化入口
    Better Auth HTTP handler

  ty-demo-app/
    保留现有页面和 native C 演示
    根据配置决定公开访问或要求认证
    作为 AccessContext 的第一个消费方

packages/
  access-server/
    Better Auth 配置与 Prisma adapter
    AccessContext 解析
    本地用户 Provisioning
    首个管理员 Bootstrap
    审计集成
```

暂时不创建：

- `apps/app-launcher`；
- `access-core`；
- 通用 Module Registry；
- 自定义 Provider Registry；
- 多种 Session Strategy；
- 独立 Principal、ExternalIdentity 或 ApplicationAccess 数据表。

只有在出现第二个真实应用、需要应用目录 UI 时，才重新评估通用 App Launcher。

## 4. `ty-demo-app` 的 MVP 定位

`apps/ty-demo-app` 当前展示账户摘要和 native C 返回结果，适合作为最小应用接入样例。它不需要改造成通用应用目录，现有 Native 业务逻辑保持不变。

本阶段只增加外围访问行为：

```ts
interface DemoApplicationEntry {
  key: "ty-demo-app"
  access: "public" | "authenticated"
}
```

访问流程：

```text
用户进入 ty-demo-app
        ↓
读取 ty-demo-app 的 access 属性
  ├─ public
  │    → 直接显示现有页面
  │    → 允许调用现有 /api/ty-demo
  │
  └─ authenticated
       → 解析 AccessContext
       ├─ 有有效 Session
       │    → 显示现有页面
       │    → 允许调用现有 /api/ty-demo
       └─ 无有效 Session
            → 导航到 access-web 登录
            → 携带受信任的 appKey=ty-demo-app
            → 登录成功后返回 ty-demo-app
```

认证模式下必须同时保护页面和 `/api/ty-demo`。如果只保护页面而保留 API 匿名可访问，登录只是视觉门禁，无法验证 Access Subsystem 的真实边界。

现有页面上的“退出登录”链接本阶段可以保持原样，不修改现有 UI 和业务逻辑。它不是本阶段验证 Access Subsystem 的必要入口；正式的注销能力由 `access-web` 和 Better Auth 提供。开发人员暂不使用该旧链接。

`ty-demo-app` 在本 MVP 中承担的是“应用入口与访问消费示例”，不是未来通用 App Launcher 的最终实现。这个区别可以避免为单个演示应用提前建立应用目录框架。

## 5. Access Web 的边界

`apps/access-web` 只包含 Access Subsystem 的交互界面：

- 登录；
- 注销；
- Session 状态；
- 修改密码；
- 账户安全；
- 管理员手工添加本地用户；
- 首个管理员 Bootstrap 的开发期入口；
- 如果本阶段明确保留，则包括由 Better Auth 实现的注册和恢复流程。

以下内容不属于 Access Web：

- 应用目录；
- 业务 Dashboard；
- `ty-demo-app` 的业务页面；
- 目标应用内部角色和业务授权；
- 通用 App Launcher UI。

Access Web 不再拥有登录后的统一 `/dashboard`。带 `appKey` 发起的登录成功后返回对应应用；没有应用上下文的直接登录可以进入账户安全页。

## 6. Better Auth 的使用边界

Better Auth 可以直接出现在 Access Subsystem 内部实现中：

```ts
import { betterAuth } from "better-auth"
```

也允许存在具体内部文件，例如 `better-auth.ts`。不需要为了消除依赖名称而使用含义模糊的文件名。

但业务应用不应直接依赖 Better Auth User、Session、Account 或客户端类型。业务应用消费稳定的 AccessContext：

```ts
type AccessContext =
  | { authenticated: false; user: null; session: null }
  | {
      authenticated: true
      user: {
        id: string
        name: string
        email: string
        username: string | null
        roles: string[]
      }
      session: { id: string; expiresAt: Date }
    }
```

当前 MVP 使用 `AccessContext.user.id` 表示本地主体标识：

```text
AccessContext.user.id = betterAuthUser.id
```

公共函数使用功能名称：

```ts
resolveAccessContext()
createLocalUser()
bootstrapAdmin()
revokeUserSessions()
handleAccessRequest()
```

Better Auth HTTP handler 可以挂载在中性路径，例如：

```text
/api/access/auth/*
```

`access-web` 内部可以直接使用 Better Auth Client，不再重新编写一套登录、注销、Cookie 和 Session HTTP 协议。`ty-demo-app` 只使用 `resolveAccessContext()`，不使用 Better Auth Client。

## 7. 数据和类型原则

Better Auth 是以下数据的权威所有者：

- User 的认证基础记录；
- Account 与密码凭据；
- Verification；
- Session；
- Admin 插件使用的认证管理状态。

Access Subsystem 自己拥有：

- AccessContext；
- Provisioning 用例；
- 审计事件；
- AccessContext 中本地主体标识的公共语义；
- 应用入口解析；
- 对业务应用稳定的错误与访问结果。

不要把 Better Auth 的所有类型复制成一套 Access 类型。只在跨边界时映射一次；Access Web 内部可以直接使用 Better Auth 推导类型。

当前字段应按下列原则处理：

- `authSource` 不应继续作为长期 User 属性扩散，因为一个用户以后可能关联多个认证 Account；
- `appRole` 不应作为全局认证用户的长期应用授权模型；
- `status` 当前混合冻结、强制改密和主体生命周期，后续应按真实需求拆分；
- `role` 目前只承担 Access 管理权限，不等同于目标应用业务角色；
- 本阶段不为这些未来模型创建新表，只停止扩大错误语义的使用范围。

## 8. Session 决策

Session 完全交给 Better Auth：

- Better Auth 创建、读取、刷新和撤销 Session；
- Better Auth 管理 Session Cookie；
- Access Subsystem 只把有效 Session 映射为 AccessContext；
- `ty-demo-app` 只解析 AccessContext；
- 旧 `portal_session` Cookie 和旧 Session 记录不迁移；
- 切换后所有开发用户重新登录；
- 用户禁用、密码重置等安全事件按 Better Auth 能力撤销相关 Session。

当前 MVP 不创建 Session Provider 或 JWT/Redis 策略抽象。

开发期可以假定 `access-web` 和 `ty-demo-app` 通过同一公开 Origin、同一反向代理域名或当前 `localhost` 环境接收 Session Cookie。真正跨域的身份交付不在本阶段实现。

## 9. 口令与 Verification 决策

本阶段不专门设计新的口令策略，也不保留旧 PBKDF2：

```ts
emailAndPassword: {
  enabled: true,
  minPasswordLength: 10,
  maxPasswordLength: 128,
}
```

原则如下：

- 使用 Better Auth 的密码哈希实现；
- 不迁移无价值的开发口令；
- 不保留明文兼容；
- 不为精确复刻“大写、小写、数字、符号”规则编写自定义密码框架；
- 以后调整口令策略时只修改配置或必要 hook，不改变认证数据所有权。

如果保留注册或恢复功能，其 Verification、OTP、尝试次数和消费逻辑必须使用 Better Auth。不能把旧自写验证码流程作为例外继续运行。

## 10. 首个管理员和手工添加用户

首个管理员是特殊的 Bootstrap Provisioning，不是一般登录逻辑：

- 默认关闭；
- 仅在开发测试或显式初始化时运行；
- 幂等；
- 使用 Better Auth Admin API 创建；
- 不直接写 User、Account 或 password；
- 不记录或返回密码；
- 本 MVP 不重新引入旧的“首次登录强制改密”状态；开发期管理员应主动修改引导密码；
- 以后可以改成一次性 CLI，但本阶段不以 CLI 完善度阻塞迁移。

日常管理员添加用户属于 Local User Provisioning，也必须委托 Better Auth 创建用户和密码凭据。

## 11. 实施顺序

### 阶段 1：固定目标契约

确定并测试：

- AccessContext；
- `ty-demo-app` 的 `public | authenticated` 入口属性；
- `appKey=ty-demo-app` 的受信任返回流程；
- Access Web 页面清单；
- 不再保留 `/dashboard` 和 `/api/portal/*` 的决定。

### 阶段 2：建立唯一 Better Auth 实例

- 固定 Better Auth 版本；
- 使用对应版本生成并核对 Prisma Schema；
- 配置 Prisma adapter；
- 启用 email/password、username、admin 和数据库 Session；
- 配置 Secret、可信 Origin、Cookie 和必要限流；
- 不接入旧密码或旧 Session。

### 阶段 3：建立 `apps/access-web`

- 将 Access 页面从 `apps/portal` 迁入；
- 直接接入 Better Auth handler 和 client；
- 完成登录、Session、注销和修改密码；
- 不建立 Portal API 兼容层；
- 不迁移旧 Dashboard。

### 阶段 4：接入 `apps/ty-demo-app`

- 保持现有页面模板、native C 调用和业务 API 返回逻辑不变；
- 在外围加入入口访问决策；
- 认证模式下保护页面和 `/api/ty-demo`；
- 未登录时导航到 Access Web；
- 登录成功后通过受信任 `appKey` 返回；
- 用真实请求验证 `resolveAccessContext()`。

### 阶段 5：Provisioning 与审计

- 管理员手工创建用户改用 Better Auth Admin API；
- Local 用户管理覆盖列表、创建、显示名称、`user/admin` 角色、停用/恢复、重置密码和 Session 撤销；
- 服务端阻止管理员自我锁定，并保留至少一个正常状态的管理员；
- 只有会减少有效管理员集合的操作进入管理员退出协调器，普通用户之间的变更保持并行；
- 当前协调器只具有单进程作用域，集群部署前必须替换为共享的持久化实现；
- 首个管理员改用同一创建路径；
- 审计由 Better Auth 路由或 Access 管理操作边界触发，管理变更记录 actor、target 与 outcome；
- 不把凭据、Cookie 或 token 写入审计。

### 阶段 6：决定自助注册与恢复范围

两项功能分别只能选择：

1. 本阶段使用 Better Auth 正确实现；或
2. 本阶段移除或禁用，留待以后实现。

不允许继续保留旧自写认证路径。

### 阶段 7：破坏式切换与删除

确认没有需要保留的开发数据或业务外键后：

- 重建开发认证数据；
- 重新初始化首个管理员；
- 失效全部旧 Session；
- 删除 `apps/portal`；
- 删除自写密码、Session 和验证码实现；
- 删除未采用的 AuthManager、ProviderRegistry 和相关平行 package；
- 删除 `/api/portal/*`、Portal DTO、Dashboard 组件和旧 Portal 配置；
- 不编写只为开发测试数据存在的迁移程序。

## 12. 本阶段验收条件

以下条件不能留待以后：

- Better Auth 是唯一密码验证路径；
- Better Auth 是唯一 Session 所有者；
- 运行时不存在旧 PBKDF2 或明文密码兼容；
- 运行时不存在旧 `portal_session`；
- 用户禁用后不能建立或继续使用有效 Session；
- 密码修改或管理员重置能够按确定的策略撤销 Session；
- 注册和恢复如果存在，必须使用 Better Auth；
- 登录返回只接受受信任的 `appKey`；
- `ty-demo-app` 公开模式可以直接访问；
- `ty-demo-app` 认证模式必须先取得有效 AccessContext；
- 认证模式下 `/api/ty-demo` 不能匿名访问；
- `ty-demo-app` 不直接依赖 Better Auth 类型或客户端；
- `apps/portal`、旧 Dashboard 和 Portal 兼容 API 被删除；
- 至少有登录、Session、禁用用户、管理员创建用户、应用返回和 API 门禁的集成测试。

## 13. 明确不做的事情

- 不为隐藏 Better Auth 增加包装；
- 不保留旧 Portal API；
- 不迁移旧开发密码和 Session；
- 不建立第二套 AuthManager；
- 不建立通用 Provider Registry；
- 不创建 Session Strategy 框架；
- 不创建通用 App Launcher 应用；
- 不提前创建 Principal、ExternalIdentity、ApplicationAccess；
- 不实现 LDAP、OIDC、SAML、SCIM 空壳；
- `ty-demo-app` 的 UI 只增加应用内布局和账户摘要，不抽象通用 App Launcher；
- 账户操作继续由 Access Web 承担，业务应用只提供账户中心入口。

## 14. 留待今后处理

### 14.1 通用 App Launcher

- 新建独立 `apps/app-launcher`；
- 应用目录、图标、分组、排序和搜索；
- 多应用入口属性；
- 按用户显示可访问应用；
- 管理员维护 Application Registry。

触发条件：出现第二个真实应用，或确实需要应用目录首页。届时 `ty-demo-app` 回归纯目标应用身份。

### 14.2 独立主体模型

- Principal 表；
- Human/Service Principal；
- 一个 Principal 关联多个外部身份；
- 主体合并、解绑、停用和删除生命周期；
- Realm、Tenant 或组织隔离。

触发条件：出现非人类主体、多身份来源、多租户或独立主体生命周期需求。

### 14.3 应用访问与授权

- ApplicationAccess 持久化模型；
- 按用户、组或策略授予应用访问；
- 应用实例；
- 临时访问、有效期和审批；
- Access 入口权限与应用内部角色分离。

触发条件：访问判断不再只是 `public | authenticated`。

### 14.4 外部认证与身份关联

- OIDC Client；
- SAML；
- LDAP；
- 企业 SSO；
- 社交登录；
- 外部身份绑定、解绑和冲突处理。

触发条件：出现第一个真实外部身份来源。届时优先使用 Better Auth 已有能力，不提前重建 Provider Registry。

### 14.5 跨域应用身份交付

- Access Subsystem 作为 OIDC/OAuth Provider；
- Authorization Code + PKCE；
- 短期应用启动 Token；
- audience、issuer 和密钥轮换；
- 移动端、桌面端和第三方应用接入。

触发条件：目标应用无法共享当前服务端 Session 或公共 Origin。

### 14.6 自动化 Provisioning

- 邀请注册；
- JIT Provisioning；
- SCIM；
- LDAP/HR 同步；
- 自动 Deprovisioning；
- 幂等、冲突和审批策略。

当前只保留管理员手工创建用户和开发期 Bootstrap。

### 14.7 Session 增强

- 多设备 Session 列表；
- 管理员批量撤销；
- Redis 或 secondary storage；
- 多实例分布式限流；
- Session freshness；
- Step-up authentication；
- 跨子域 Cookie；
- 风险 Session 检测。

触发条件：多实例、跨域部署或敏感操作需要二次认证。

### 14.8 认证器与口令策略增强

- Passkey/WebAuthn；
- TOTP/MFA；
- 恢复码；
- Magic Link；
- 弱口令和泄露口令检查；
- 更现代的长度与口令短语策略。

当前只采用 Better Auth 的简单长度配置，不编写自定义密码框架。

### 14.9 生产级自助服务

- 生产邮件服务；
- 邮件模板；
- 邮件地址变更和重新验证；
- 用户自行管理 Session；
- 凭据绑定、解绑和恢复；
- 账号删除。

### 14.10 审计、安全与运维

- 完整审计事件分类；
- 审计保存、归档和完整性策略；
- 指标、告警和异常登录检测；
- 依赖漏洞监控；
- Better Auth 升级流程；
- 生产认证数据迁移、备份和恢复手册；
- 安全测试与渗透测试。

### 14.11 UI 与产品体验

- Access Web 设计系统；
- 无障碍；
- 国际化；
- 移动端体验；
- 管理员用户列表、搜索和批量操作；
- 根据真实应用需求继续完善 `ty-demo-app` 导航和移动端体验。

## 15. 最终目标关系

```text
用户
  ↓
ty-demo-app（公开或要求认证）
  ↓ 未认证时
access-web
  ↓
Access Subsystem 公共契约
  ↓
Better Auth + Prisma

ty-demo-app 服务端
  ↓
resolveAccessContext()
  ↓
获得有效 AccessContext 或拒绝访问
```

这个 MVP 能验证四件真正重要的事情：

1. Better Auth 是否能够完整替代自编认证路径；
2. Access Web 是否能独立于目标应用存在；
3. 目标应用是否只依赖稳定 AccessContext；
4. 公开访问与认证访问是否能在不修改业务逻辑的前提下切换。

完成这些验证后，再根据真实应用数量、部署拓扑和身份来源决定是否引入通用 App Launcher、独立 Principal Registry 或标准联合身份协议。
