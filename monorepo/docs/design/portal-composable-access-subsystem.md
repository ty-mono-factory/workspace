# 可组合 Access Portal：边界、裁剪机制与最小核心

> 本文整理自一组关于应用开发底座中 Portal 定位的问答。重点不是某个具体业务应用的登录页面，而是如何设计一个可组合、可裁剪的身份访问子系统。

## 问题一

> 这个 Portal 是为一个应用开发底座开发的，需要提供多种 Provisioning 和 Authentication 方式，且可任意裁剪剥离。应该如何定义它？

## 回答

### 1. Portal 的准确定位

Portal 应定义为：

> **应用开发底座中的可组合身份访问子系统，负责从用户进入系统到向应用交付身份上下文；Provisioning、Enrollment 和 Authentication 均由可选能力模块组成。**

它不是某个固定应用的登录前台，也不是业务应用本身。它提供统一的访问流程、扩展协议和应用交接点，具体软件在组装阶段选择需要的能力。

### 2. “任意裁剪”并不是真正无条件任意

更准确的要求是：

> **在依赖关系允许的范围内，按能力组合，并在构建阶段剥离未选择的实现。**

典型依赖关系包括：

- 删除 SAML 不应影响 OIDC。
- 删除 local password 后，可以同时删除密码设置、密码重置和密码凭据表。
- 保留 Passkey Authentication，就必须保留相应的 Passkey Enrollment。
- 保留 JIT Provisioning，就必须有 Authentication 结果作为触发输入。
- 使用 Portal Session，就必须选择一种 Session 实现。
- 删除所有 Authentication 后，Portal 只能依赖外部可信身份代理，不能独立完成登录。

因此每个模块至少应声明：

```text
提供哪些能力
依赖哪些能力
贡献哪些服务端路由
需要哪些配置
需要哪些数据库表和 Migration
贡献哪些管理界面
与哪些其他实现互斥
```

### 3. 不可裁剪的最小核心

最小核心只保留协议、模型和编排，不直接实现 OIDC、SAML、LDAP、密码或 SCIM：

```text
portal-contracts
portal-core
identity-resolution
application-registry
application-access
access-context
module-registry
```

这些名称首先代表**逻辑能力**，并不意味着必须创建七个 package、文件夹或文件。

最小核心负责：

- 定义 `Principal` 和外部身份解析结果。
- 定义统一的 `VerifiedIdentity`。
- 定义应用和应用实例。
- 判断 Principal 是否能够进入指定应用实例。
- 定义向应用交付的 `ApplicationContext`。
- 注册可选模块并校验依赖关系。
- 编排从身份验证结果到应用交接点的流程。

### 4. 可裁剪能力模块

#### Provisioning

```text
provision-admin
provision-self-registration
provision-invitation
provision-jit
provision-scim
provision-ldap-sync
provision-hr-sync
```

#### Enrollment

```text
enroll-password
enroll-passkey
enroll-totp
enroll-recovery-code
enroll-device
```

#### Authentication

```text
auth-password
auth-passkey
auth-email-otp
auth-magic-link
auth-oidc
auth-saml
auth-ldap
auth-client-certificate
```

#### Session

```text
session-database-cookie
session-redis-cookie
session-jwt
session-external
```

一次组装通常只选择一种主 Session 策略。多个互斥实现不能简单叠加。

#### 管理和交互界面

```text
admin-ui
audit-ui
self-service-ui
application-launcher
```

UI 也应当可以裁剪。没有 `admin-ui` 时，系统仍可通过 API、配置文件或部署工具进行管理。

### 5. 由 Composition Root 完成组装

一个面向本地用户和消费者的产品可以这样组装：

```ts
export default createPortal({
  provisioning: [
    adminProvisioning(),
    selfRegistration(),
    jitProvisioning(),
  ],

  enrollment: [
    passkeyEnrollment(),
  ],

  authentication: [
    passkeyAuthentication(),
    oidcAuthentication(),
  ],

  session: databaseCookieSession(),
})
```

一个企业部署可以选择另一组能力：

```ts
export default createPortal({
  provisioning: [
    scimProvisioning(),
    jitProvisioning(),
  ],

  authentication: [
    oidcAuthentication(),
    samlAuthentication(),
    ldapAuthentication(),
  ],

  session: redisCookieSession(),
})
```

真正被剥离的模块应满足：

- 不注册路由。
- 不安装其专用依赖。
- 不执行它的 Migration。
- 不出现相应管理页面。
- 不进入最终构建产物。

仅仅设置 `enabled: false` 不等于完成剥离，因为实现代码和依赖仍可能存在。

### 6. 统一模块接口

Provisioning 模块实现统一接口：

```ts
interface ProvisioningProvider {
  capability: string

  provision(input: ProvisioningInput): Promise<Principal>
  update?(input: UpdatePrincipalInput): Promise<Principal>
  deprovision?(input: DeprovisionInput): Promise<void>
}
```

Authentication 模块输出统一的验证结果：

```ts
interface AuthenticationProvider {
  capability: string

  begin(input: AuthenticationRequest): Promise<AuthChallenge>
  complete(input: AuthenticationResponse): Promise<VerifiedIdentity>
}
```

Portal Core 只认识 `VerifiedIdentity`，不需要知道它来自 LDAP、SAML、OIDC 还是 Passkey。

### 7. 数据库边界

核心可以拥有以下共享表：

```text
principal
external_identity
application
application_instance
application_access
session
```

可选模块拥有自己的表和 Migration：

```text
auth_passkey_credential
auth_password_credential
auth_saml_provider
auth_oidc_provider
provision_scim_token
provision_invitation
```

其他模块不应直接依赖某个可选模块的私有表。

卸载模块与删除模块数据应当分开处理。卸载时立即删除表可能造成不可恢复的数据损失。

### 8. 管理 UI 也由模块贡献

例如 OIDC 模块可以同时贡献：

```text
服务端：
  /auth/oidc/*
  OIDC 配置 Schema
  OIDC 数据表和 Migration
  OIDC Authentication Provider

管理端：
  添加 OIDC Provider 页面
  测试连接页面
  Claim Mapping 配置页面
```

未安装 OIDC 模块时，Admin UI 不应显示 OIDC 设置。

### 9. 是否还需要具体应用需求

不需要先提供某个应用的完整业务需求，但底座必须明确支持哪些应用接入形态：

| 应用形态 | 推荐身份交付方式 |
| --- | --- |
| 同进程 Nuxt 模块 | 服务端 Session Context |
| 同域独立 Web 应用 | 中央 Session 或短期启动 Token |
| 跨域第一方应用 | OIDC Authorization Code |
| 桌面或移动应用 | OIDC + PKCE |
| 第三方应用 | 标准 OIDC 或 SAML |

MVP 不宜同时实现所有接入形态。对于 pnpm workspace、ESM Node.js 和 Nuxt 3 底座，第一种接入形态可收敛为：

```text
同一 monorepo
同一部署边界
Nuxt/Node 应用
服务端读取统一 Session Context
```

Portal Core 的接口仍不应直接依赖 Nuxt，以便后续增加跨域或外部应用。

### 10. 边界总结

> **Portal Core 定义身份、应用访问和交付协议；具体 Provisioning、Enrollment、Authentication、Session 和管理 UI 由独立模块实现；宿主软件在构建阶段选择模块，Portal 校验依赖并组装完整访问流程。**

---

## 问题二

> “不可裁剪的最小核心”是七个文件夹，还是七个文件？

## 回答

都不是。它们是七个逻辑能力。MVP 不建议机械地拆成七个 workspace package，也不建议强行对应七个文件。

### 推荐的 MVP 物理结构

先建立两个真正的 package 边界：

```text
packages/
├─ portal-contracts/       # 公共协议，可被应用和插件引用
└─ portal-core/            # Portal 服务端核心实现
```

建议的初始文件结构：

```text
packages/
├─ portal-contracts/
│  ├─ src/
│  │  ├─ principal.ts
│  │  ├─ verified-identity.ts
│  │  ├─ application.ts
│  │  ├─ access-context.ts
│  │  ├─ portal-module.ts
│  │  └─ index.ts
│  ├─ package.json
│  └─ tsconfig.json
│
└─ portal-core/
   ├─ src/
   │  ├─ identity/
   │  │  └─ identity-resolver.ts
   │  ├─ applications/
   │  │  ├─ application-registry.ts
   │  │  └─ application-access.ts
   │  ├─ access/
   │  │  ├─ access-flow.ts
   │  │  └─ create-access-context.ts
   │  ├─ modules/
   │  │  └─ module-registry.ts
   │  ├─ ports/
   │  │  ├─ principal-repository.ts
   │  │  ├─ identity-repository.ts
   │  │  ├─ application-repository.ts
   │  │  └─ access-repository.ts
   │  └─ index.ts
   ├─ package.json
   └─ tsconfig.json
```

七个逻辑能力的落点如下：

| 逻辑能力 | MVP 中的物理位置 |
| --- | --- |
| `portal-contracts` | 独立 package |
| `portal-core` | 独立 package |
| `identity-resolution` | `portal-core/src/identity/` |
| `application-registry` | `portal-core/src/applications/` |
| `application-access` | `portal-core/src/applications/` |
| `access-context` | 类型位于 contracts，创建逻辑位于 core |
| `module-registry` | 接口位于 contracts，实现位于 core |

### 为什么单独拆出 `portal-contracts`

- OIDC、SAML、LDAP 等可选模块需要实现统一接口。
- 应用需要读取 `ApplicationContext`。
- 可选模块和应用不应依赖 Portal Core 的内部实现。
- 该包应保持纯 TypeScript，不依赖数据库、Nuxt 或 Node.js 特定 API。

依赖方向：

```text
portal-core ────────────────→ portal-contracts
auth-oidc ──────────────────→ portal-contracts
auth-saml ──────────────────→ portal-contracts
provision-scim ─────────────→ portal-contracts
业务应用 ───────────────────→ portal-contracts
```

随着能力落地，可选实现再成为独立 package：

```text
packages/
├─ portal-contracts/
├─ portal-core/
├─ auth-oidc/
├─ auth-saml/
├─ auth-ldap/
├─ provision-admin/
├─ provision-self/
└─ provision-scim/
```

### 最终原则

> **Package 表示真实依赖边界，folder 表示代码组织，file 表示具体实现单元。逻辑能力不应机械地一一对应 package、folder 或 file。**

MVP 从 `portal-contracts` 和 `portal-core` 两个核心 package 开始；只有当某项内部能力确实需要独立替换、发布或裁剪时，再将其提升为独立 package。
