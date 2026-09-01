# Access Subsystem：本地主体记录知识与初始设计

> 文档状态：边界设计初稿  
> 更新时间：2026-08-19  
> 适用对象：作为应用开发底座组成部分、支持多种认证与 Provisioning 能力且可裁剪的 Access Subsystem

## 1. 核心结论

本地主体（Local Principal）是 Access Subsystem 对“谁正在访问”建立的稳定、内部表示。它不是本地密码账户，也不是外部身份资料的完整副本。

在 **Managed Access Profile** 中，本地主体是身份状态、应用访问关系、Session、审计事件和业务数据引用的核心锚点；但它不是流程执行引擎。Access Orchestrator 才负责驱动认证、身份解析、Session 和应用入口授权。

在 **Stateless Federation Profile** 中，可以不保存本地主体记录，直接以可信发行方和外部 subject 识别访问者。但这种模式很难提供集中禁用、长期授权、身份合并、可靠审计和跨应用稳定引用，不应作为当前 MVP 的主模式。

推荐当前底座以 Managed Access Profile 为 MVP，同时通过接口边界保留未来的 Stateless Federation Profile。

## 2. 术语

### 2.1 Principal

Access Subsystem 内部能够接受身份、Session 或访问策略约束的主体。主体类型未来可以包括：

- `human`：自然人；
- `service`：服务、机器人或工作负载；
- 以后必要时增加其他类型。

`Service` 是 Principal 类型，不是角色。

### 2.2 Local Principal Record

Access Subsystem 保存的最小主体记录。它提供稳定的 `principalId`、所属 Realm 和生命周期状态。

“本地”表示由本系统的访问域控制和解释，并不要求物理上存放在目标应用自带的数据库中。

### 2.3 External Identity

由外部身份提供方识别的身份，例如：

- OIDC 的 `issuer + subject`；
- SAML 的 IdP 与稳定 NameID；
- 企业 LDAP 的目录对象标识；
- 微信等外部身份提供方的稳定用户标识。

External Identity 可以映射到一个 Local Principal。一个 Principal 也可以关联多个 External Identity。

### 2.4 Credential

用于证明身份的秘密或认证器，例如密码、Passkey、公钥或恢复凭证。

Credential 与 Principal 必须分离：

- 有 Principal 不代表存在本地密码；
- 使用外部 OIDC、SAML 或 LDAP 时，本地可以完全不保存用户密码；
- 如果启用本地认证，Credential 由认证引擎管理，不应塞入 Principal 记录。

### 2.5 Session

Session 是“某个主体已经在某个时间、通过某种方式完成认证”所产生的有限时效运行时状态。

Principal 是长期身份锚点；Session 是短期认证结果。两者不是同一个对象。

## 3. 为什么需要本地主体

本地主体的主要价值不是保存姓名、邮箱，也不仅是为了 Audit，而是提供下列系统能力：

1. **稳定引用**：外部用户名、邮箱、手机号或目录路径变化时，业务数据仍引用同一个 `principalId`。
2. **统一多个身份来源**：同一个人可以同时关联企业 SSO、Passkey 和其他外部身份。
3. **主体生命周期控制**：系统可以将主体置为 `suspended` 或 `deprovisioned`，而不依赖外部身份提供方立即响应。
4. **应用入口授权**：建立 `principalId → applicationInstanceId → access relation`。
5. **Session 管理**：识别 Session 属于哪个稳定主体，并在主体状态变化时使 Session 失效。
6. **业务数据关联**：积分、订单、项目、战队、审批等数据引用稳定的主体标识。
7. **可靠审计**：外部标识变化或身份解绑后，历史事件仍能指向同一个主体。
8. **Provisioning 幂等性与冲突处理**：SCIM、LDAP、HR 或 JIT 事件可以安全地重复执行、更新或撤销。

Audit 是本地主体的消费者之一，不是引入本地主体的唯一理由。

## 4. 本地主体不是什么

本地主体不是：

- 用户密码记录；
- 外部 IdP 用户对象的完整复制；
- 目标应用中的业务用户档案；
- “已经可以进入所有应用”的证明；
- Session；
- Admin、Auditor、Guest、Member 等角色本身。

主体回答“是谁”；应用访问关系回答“能否进入哪个应用”；应用内部角色和权限回答“进入后能做什么”。

## 5. 三类数据的所有权

| 数据 | 权威所有者 | 推荐存储位置 |
| --- | --- | --- |
| 外部账号及其认证资料 | 外部 IdP、LDAP 或认证引擎 | 保留在原系统；本地仅保存必要映射 |
| Principal、External Identity 映射、主体状态 | Access Subsystem | Principal Store 或外部 Principal Service |
| Application Access | Access Subsystem | Access Store |
| Session | 认证/Session 模块 | Session Store、缓存或受保护令牌 |
| 积分、订单、战队、项目成员等业务数据 | 目标应用 | 目标应用数据库 |
| 应用内部角色和权限 | 目标应用 | 目标应用授权存储 |

目标应用通常只需要保存 `principalId` 作为业务外键，不需要复制密码或完整身份资料。

## 6. 扫码场景的准确解释

“扫码创建用户”不是一个足够准确的领域动作。二维码只是传输或启动机制，它可能触发：

- 跳转到外部 IdP 完成认证；
- 接受邀请并加入 Realm；
- 绑定已有主体；
- 绑定设备或浏览器 Session；
- 建立一次性匿名访问。

扫描后应根据实际语义执行认证、Enrollment、Identity Resolution 或设备绑定。只有策略决定建立受管理主体时，才创建 Local Principal。

扫码产生的姓名、头像、手机号等外部身份资料不必持久化到目标应用数据库；但如果系统需要长期业务关联、访问控制、禁用、身份合并或可靠审计，Access Subsystem 应保存最小主体记录，或者依赖能够提供同等能力的外部 Principal Service。

## 7. Principal 的产生方式

Local Principal 可以由多种入口产生或更新：

| 来源 | 触发者 | 典型决策 |
| --- | --- | --- |
| 管理员手工创建 | Access Admin | 管理员权限与输入校验 |
| 自助注册/扫码 Enrollment | 最终用户 | 邀请、验证码、Realm 和注册策略 |
| JIT Provisioning | 一次成功的外部认证 | Provider、Realm、域名或群组策略 |
| SCIM | 客户身份管理系统 | SCIM 连接和 Provisioning Policy |
| LDAP Sync | Access Subsystem 连接器 | 同步范围、过滤器和映射规则 |
| HR Sync | HR 连接器或任务 | 数据源信任、审批和映射规则 |

这些机制并不都处在同一抽象层：SCIM 是标准协议，LDAP/HR Sync 是数据源适配器，JIT 是认证时触发的 Provisioning 策略。

典型流程为：

```text
Source/Event
    ↓
Adapter
    ↓
ProvisioningCommand
    ↓
Policy Decision: allow / deny / review / quarantine
    ↓
Principal Registry
    ↓
Principal / ExternalIdentity / ApplicationAccess
```

两端不必使用完全相同的数据格式。Adapter 负责把外部 SCIM、LDAP、HR 或认证声明归一化为 Access Subsystem 自己的 `ProvisioningCommand`。

审批应分层，而不是要求每个用户事件都由人工批准：

1. 管理员批准连接和信任关系；
2. 管理员配置映射、范围和 Provisioning Policy；
3. 系统对每个事件自动判定 `allow`、`deny`、`review` 或 `quarantine`。

## 8. 最小数据模型

以下是逻辑模型，不表示必须创建同名表，也不要求采用同一个物理数据库。

### 8.1 Principal

```ts
interface Principal {
  principalId: string
  realmId: string
  type: 'human' | 'service'
  status: 'pending' | 'active' | 'suspended' | 'deprovisioned'
  version: number
  createdAt: string
  updatedAt: string
}
```

`principalId` 必须稳定、无业务含义且不可重用。不要使用用户名、邮箱、手机号或 LDAP DN 作为业务主键。

### 8.2 ExternalIdentity

```ts
interface ExternalIdentity {
  externalIdentityId: string
  principalId: string
  realmId: string
  providerId: string
  issuer: string
  subject: string
  status: 'active' | 'unlinked' | 'disabled'
  linkedAt: string
  lastAuthenticatedAt?: string
}
```

应对 `(realmId, issuer, subject)` 或协议对应的稳定组合建立唯一约束。邮箱只能作为属性或匹配线索，不能默认作为可信身份键。

### 8.3 ApplicationAccess

```ts
interface ApplicationAccess {
  principalId: string
  applicationInstanceId: string
  relation: string
  status: 'active' | 'suspended' | 'revoked'
  source: 'manual' | 'group-mapping' | 'provisioning' | 'policy'
  validFrom?: string
  validUntil?: string
}
```

这里控制主体能否进入一个应用实例。进入应用后的业务权限仍由目标应用定义。

### 8.4 Session

```ts
interface Session {
  sessionId: string
  principalId: string
  realmId: string
  authenticatedAt: string
  expiresAt: string
  authenticationMethods: string[]
  assuranceLevel?: string
  principalVersion?: number
  revokedAt?: string
}
```

实际字段由认证引擎和 Session 方案决定。公共契约不应绑定某个认证产品的数据库结构。

## 9. 本地主体是不是 Access Subsystem 的操作核心

准确回答是：**在 Managed Access Profile 中，它是状态与引用核心，但不是操作核心。**

可以把三个“核心”分开：

| 核心 | 职责 |
| --- | --- |
| Access Orchestrator | 执行认证、身份解析、Session 和入口授权流程 |
| Principal Registry | 保存“是谁”以及主体当前是否有效，是稳定状态核心 |
| AccessContext | 将认证与授权结果交付给目标应用，是输出契约核心 |

如果把 Principal 称作唯一的“操作核心”，会产生两个设计错误：

1. 把所有认证、Session、角色和业务资料都塞进 Principal；
2. 无法表达 Stateless Federation 等不落本地主体的部署模式。

因此推荐表述为：

> Local Principal 是 Managed Access Profile 的身份状态核心与关联锚点；Access Orchestrator 是运行时操作核心；AccessContext 是面向应用的交付核心。

## 10. Principal 与 Session 的关系

### 10.1 基本关系

```text
Principal 1 ───────── 0..n Session
   │                       │
   │ 长期、稳定             │ 短期、有认证时间和有效期
   │ 回答“是谁”             │ 回答“这次是否已认证”
   │ 可以无 Session          │ 必须引用或解析到 Subject
   └───────────────────────┘
```

一个 Principal 可以没有任何 Session，也可以同时拥有多个设备或浏览器 Session。Session 过期或注销不会删除 Principal。

### 10.2 Session 的建立

```text
认证结果
  ↓
Identity Resolution
  ├─ 找到已有 Principal
  └─ 按 JIT/Enrollment 策略创建 Principal
  ↓
检查 Principal.status
  ↓
建立 Session
  ↓
检查 ApplicationAccess
  ↓
交付 AccessContext 或拒绝访问
```

原则上应先把认证结果解析为稳定主体，再创建面向该主体的受管理 Session。JIT 可以在同一编排流程中创建 Principal，但不能绕过 Provisioning Policy。

### 10.3 每次请求时的互动

每次请求至少要验证：

1. Session 是否真实、未过期、未撤销；
2. Session 对应的 Principal 是否仍然有效；
3. 访问目标应用时，ApplicationAccess 是否仍然成立；
4. 敏感操作是否需要更高认证强度或重新认证。

不一定要在每次请求中直接查询关系数据库。可以使用缓存、短期访问令牌、状态版本或 Token Introspection，但这些优化不能改变上述安全语义。

### 10.4 状态变化的传播

| 事件 | 对 Principal 的影响 | 对 Session 的影响 |
| --- | --- | --- |
| 用户注销 | 无 | 撤销当前或指定 Session |
| Session 过期 | 无 | Session 不再有效 |
| Principal 被暂停 | `status = suspended` | 应拒绝并撤销全部或相关 Session |
| Principal 被 Deprovision | 保留不可重用的记录或墓碑 | 撤销全部 Session，并停止新建 Session |
| 外部身份解绑 | Principal 可以继续存在 | 按风险策略撤销由该身份建立的 Session |
| 新外部身份绑定 | 同一 Principal 增加映射 | 不必自动影响已有 Session |
| 应用访问被撤销 | Principal 仍可有效 | Session 可继续用于其他应用，但不得再进入该应用 |
| 角色或权限变化 | Principal 通常不变 | 使权限快照过期，或在请求时读取最新授权 |
| 密码重置/凭证泄露 | Principal 通常不变 | 通常撤销相关或全部 Session |

删除 Principal 不应直接物理删除历史引用。更稳妥的做法是 `deprovisioned`、匿名化可识别属性，并保留不可重用的 `principalId` 作为审计和业务引用锚点。

### 10.5 Session 中不应承载什么

Session 不应成为以下数据的权威来源：

- 可变的用户档案；
- 永久应用访问关系；
- 完整角色和权限数据库；
- 外部身份提供方返回的全部 Claims；
- 密码或长期认证秘密。

Session 可以携带必要快照，但必须有过期、版本检查或撤销机制。否则暂停主体、撤销应用访问或修改权限后，旧 Session 会继续拥有陈旧能力。

## 11. 推荐的 Session 策略

MVP 推荐采用服务端持久 Session，或者“服务端 Refresh Session + 短期 Access Token”的混合方式：

- Principal 和应用访问发生变化时可以集中撤销；
- Access Token 保持较短有效期；
- Session 记录引用 `principalId`；
- 必要时记录 `principalVersion` 或授权版本；
- 高风险操作执行实时状态检查或 Step-up Authentication。

纯长效自包含 JWT 不适合作为 Managed Access MVP 的唯一 Session 机制，因为主体暂停和访问撤销难以及时生效。

## 12. AccessContext 中如何表达主体

目标应用不应直接消费 OIDC Claims、SAML Assertion、LDAP DN 或特定认证框架的用户表。Access Subsystem 应交付稳定、协议无关的上下文，例如：

```ts
interface AccessContext {
  principal: {
    principalId: string
    type: 'human' | 'service'
    realmId: string
  }
  session: {
    sessionId: string
    authenticatedAt: string
    authenticationMethods: string[]
    assuranceLevel?: string
  }
  target: {
    applicationInstanceId: string
  }
  access: {
    allowed: boolean
    relations?: string[]
  }
}
```

目标应用把 `principalId` 用作稳定业务引用，并自行解释应用内部权限。

## 13. 存储边界

Access Core 不应直接依赖某种数据库，而应依赖端口：

```ts
interface PrincipalStore {
  findById(principalId: string): Promise<Principal | null>
  resolveExternalIdentity(ref: ExternalIdentityRef): Promise<Principal | null>
  create(command: CreatePrincipalCommand): Promise<Principal>
  changeStatus(command: ChangePrincipalStatusCommand): Promise<Principal>
}

interface SessionStore {
  create(command: CreateSessionCommand): Promise<Session>
  find(sessionId: string): Promise<Session | null>
  revoke(sessionId: string, reason: string): Promise<void>
  revokeByPrincipal(principalId: string, reason: string): Promise<void>
}
```

这些端口可以由以下实现提供：

- Access Subsystem 专用 PostgreSQL；
- 与其他底座模块共享的数据库实例，但使用独立 schema；
- 外部 Principal Service；
- 测试或轻量部署使用的替代存储。

不要把 `packages/platform` 当作公用数据库能力的唯一归属；数据库、配置和事件等通用部件可以被 Access 和各业务模块共同使用。

## 14. 与成熟认证框架的边界

应尽量复用成熟实现完成密码、Passkey、OIDC、SAML、Session 和 SCIM 协议处理，不自行实现密码学和协议细节。

如果采用 Better Auth 一类认证框架：

- 认证框架拥有自己的 `user`、`account`、`session`、`verification` 和 Provider 数据；
- Access Subsystem 拥有 `application`、`application_instance`、`application_access`、外部群组映射、Provisioning Policy 和访问安全事件；
- MVP 可以暂时将认证框架的 `user.id` 用作人类主体的 `principalId`；
- 对外公共契约只能承诺 `principalId`，不能暴露或绑定认证框架的表结构；
- 未来若拆出独立 Principal Registry，应用契约不应因此改变。

不要在认证框架之外立即再造一套重复的通用 Authentication Provider 或 Provisioning Provider 框架。Access 层只需要补足产品策略、映射、应用访问和稳定契约。

## 15. 安全与隐私不变量

1. 外部身份必须使用可信发行方和稳定 subject 的组合解析，不能仅凭邮箱自动合并。
2. `principalId` 不可重用，即使主体已经 Deprovision。
3. Principal 被暂停或撤销后，不得继续签发新 Session。
4. 高风险主体状态变化必须能够使相关 Session 失效。
5. Session 过期和注销不得误删 Principal。
6. 目标应用不能把“认证成功”直接等同于“允许进入该应用”。
7. Principal 不能自动获得所有应用权限；ApplicationAccess 必须按应用实例确定。
8. 外部 Claims 只按最小必要原则保存和交付。
9. 身份解绑、合并和重绑定必须产生安全事件并防止账户接管。
10. Provisioning 事件必须支持幂等、版本或冲突处理；事件标识不仅用于审计。

## 16. MVP 决策

当前建议实现的最小闭环：

1. 支持 `human` Principal；
2. 使用稳定、不可重用的 `principalId`；
3. 支持一种外部认证方式，例如 OIDC；
4. 支持 JIT 创建或解析 Principal；
5. 使用数据库 Session；
6. 支持 Principal 的 `active`、`suspended`、`deprovisioned` 状态；
7. 支持一个 Application Registry 和 ApplicationAccess；
8. 主体暂停、Deprovision 和关键凭证事件可以撤销 Session；
9. 向一个示例应用交付协议无关的 AccessContext；
10. 记录最小安全事件。

暂不实现但在契约上预留：

- SCIM；
- LDAP Sync；
- HR Sync；
- 多个外部身份的复杂自动合并；
- `service` Principal 的完整认证流程；
- Stateless Federation Profile；
- 跨区域 Principal Registry；
- 复杂审批流和完整管理 UI。

“预留”只表示稳定概念、端口和事件边界允许扩展，不表示现在创建所有空包、空表或未使用的抽象层。

## 17. 最终设计判断

本地主体是否必须存在，取决于部署 Profile，而不是认证方式：

- 外部认证并不排斥本地主体；本地可以只有主体映射而没有本地密码。
- 扫码也不决定是否建立本地主体；它只是一种交互或传输机制。
- Managed Access 需要持久的主体状态或具有同等能力的外部主体服务。
- Stateless Federation 可以没有本地主体记录，但会主动放弃集中生命周期和长期访问管理能力。

对当前应用开发底座，推荐的稳定表述是：

> Local Principal 是 Managed Access Profile 的身份状态核心和全系统稳定引用锚点。认证证明当前访问者控制某个身份，Identity Resolution 将该身份解析为 Principal，Session 保存这次认证在有限时间内的有效状态，ApplicationAccess 决定该 Principal 能否进入目标应用，最终由 Access Subsystem 向应用交付 AccessContext。
