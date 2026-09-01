# Portal 底座蓝图文档

## 1. 文档目标

本文件用于定义 Portal 模块的稳定边界与工业化实现方案，作为未来多应用体系的统一认证底座。

设计原则：
- Portal 只负责认证与账户生命周期，不承担业务页面导航职责。
- 登录成功后，用户离开 Portal，进入目标业务应用。
- 所有关键策略由后端统一判定，前端只负责展示与交互。
- 认证策略可配置、可审计、可扩展，满足长期演进。

## 2. 已确认的业务规则

### 2.1 首次登录强制改密
- 适用于所有角色，无例外。
- 首次登录后，必须完成密码修改。
- 未完成改密前，不能进入任何业务应用。

### 2.2 Self Sign-up 开关
- 术语统一为 Self Sign-up（自助注册）。
- 当 ALLOW_SELF_SIGNIN=true 时，开放自助注册流程。
- 当 ALLOW_SELF_SIGNIN=false 时，隐藏或禁用注册入口。

### 2.3 Portal 职责边界
- Portal 负责登录、改密、注册、找回密码、认证策略执行。
- Portal 不负责业务应用首页、业务菜单、业务页面聚合。
- 登录通过后由后端或前端跳转到目标应用地址。

## 3. 总体架构

### 3.1 分层
- Presentation 层：Portal 页面组件，仅处理 UI 与表单交互。
- Application 层：用例编排（登录、改密、注册、找回密码）。
- Domain 层：认证策略与状态机规则（首次改密、锁定策略、注册开关）。
- Infrastructure 层：存储适配器、邮件/短信通道、验证码服务、审计日志。

### 3.2 关键模块
- auth-policy：统一策略引擎。
- auth-session：会话签发与刷新。
- auth-credential：密码校验与修改。
- auth-registration：自助注册。
- auth-recovery：找回密码流程。
- auth-audit：审计日志。
- auth-provider-local / sso / ldap：认证提供方插件。

### 3.3 运行时配置
建议使用 Nuxt runtimeConfig，避免构建期与运行期不一致。

public 配置建议：
- auth.postLoginDefaultUrl
- auth.allowSelfSignIn
- auth.passwordPolicyHint

private 配置建议：
- auth.jwtSecret
- auth.smtp
- auth.smsProvider
- auth.qrSigningKey
- auth.maxRetryCount
- auth.lockDurationMins

环境变量建议：
- WEB_PAGE_POST_LOGIN_URL
- ALLOW_SELF_SIGNIN
- AUTH_MAX_RETRY_COUNT
- AUTH_LOCK_DURATION_MINS

说明：
- public 只放前端需要读取的无敏感配置。
- 敏感信息必须只在 private 与服务端使用。

## 4. 状态机定义

### 4.1 用户认证状态
- ANONYMOUS：未认证。
- AUTHENTICATED_FORCE_PASSWORD_CHANGE：已认证但必须改密。
- AUTHENTICATED_ACTIVE：已认证且可进入业务系统。
- LOCKED_TEMPORARY：临时锁定中。

### 4.2 登录流程
1. 提交 identifier。
2. 后端执行 provider resolve。
3. 提交 credential。
4. 后端返回登录结果与用户状态。
5. 若状态为 AUTHENTICATED_FORCE_PASSWORD_CHANGE，停留在 Portal 改密页面。
6. 改密成功后状态转为 AUTHENTICATED_ACTIVE。
7. 跳转到目标业务应用。

### 4.3 自助注册流程（预留）
1. 判断 ALLOW_SELF_SIGNIN。
2. 允许则进入注册页。
3. 提交邮箱/手机基础信息。
4. 发送验证码（email 或 sms）。
5. 验证通过后创建用户并标记首次状态。
6. 用户首次登录时仍需强制改密。

## 5. API 契约草案

### 5.1 登录相关
- POST /api/portal/auth/identifier
  - 入参：identifier
  - 出参：providerType、nextStep、lockState

- POST /api/portal/auth/login
  - 入参：identifier、credential
  - 出参：
    - success
    - user
    - authState
    - mustChangePassword
    - redirectUrl（可选）

- POST /api/portal/auth/logout

### 5.2 改密相关
- POST /api/portal/password/change-first-login
  - 入参：oldPassword、newPassword、confirmPassword
  - 出参：success、authState、redirectUrl

- POST /api/portal/password/change-self

### 5.3 注册相关
- POST /api/portal/signup/start
- POST /api/portal/signup/verify
- POST /api/portal/signup/complete

### 5.4 找回密码相关
- POST /api/portal/recovery/start
- POST /api/portal/recovery/verify
- POST /api/portal/recovery/reset

### 5.5 平台配置查询
- GET /api/portal/config/public
  - 出参：allowSelfSignIn、passwordPolicyHint、postLoginDefaultUrl

## 6. 错误码规范

建议统一错误码前缀 PORTAL_：
- PORTAL_INVALID_CREDENTIAL
- PORTAL_ACCOUNT_LOCKED
- PORTAL_FORCE_PASSWORD_CHANGE_REQUIRED
- PORTAL_SIGNUP_DISABLED
- PORTAL_VERIFICATION_EXPIRED
- PORTAL_RATE_LIMITED
- PORTAL_INTERNAL_ERROR

前端不直接依赖错误文案，只依赖错误码与结构化字段。

## 7. 数据模型草案

说明：以下为最小集合，便于工业化稳定。

### 7.1 user（已有可复用）
核心字段建议：
- id
- email
- username
- status（NORMAL / FORCE_CHANGE_PASSWORD / LOCKED）
- authSource（local / sso / ldap）
- createdAt / updatedAt

### 7.2 auth_credential_history
- id
- userId
- passwordHash
- passwordSalt
- rotatedAt
- rotationReason

### 7.3 auth_lock_state
- id
- principal
- failedCount
- lockUntil
- lastFailureAt

### 7.4 auth_verification_ticket
- id
- channelType（email / sms / qr）
- principal
- codeHash
- expiresAt
- consumedAt
- scenario（signup / recovery / high_risk_login）

### 7.5 auth_audit（已有基础）
- id
- eventType
- outcome
- providerId
- userId
- requestId
- ipAddress
- userAgent
- occurredAt

## 8. 安全与合规要求

- 登录失败计数必须在后端持久层判定，不在前端内存判定。
- 密码策略后端强校验，前端提示仅做体验增强。
- 所有敏感操作写入审计日志。
- 所有验证码一次性消费，并设置短时有效期。
- 增加接口限流与人机校验机制，防止撞库与刷接口。

## 9. Portal 与业务应用的解耦协议

### 9.1 跳转协议
登录成功后：
- 优先使用后端返回 redirectUrl。
- 无 redirectUrl 时使用 postLoginDefaultUrl。

### 9.2 身份传递
建议使用 HttpOnly Cookie 会话，不在 URL 传递敏感 token。

### 9.3 业务应用接入要求
- 所有业务应用共享统一认证态检查中间件。
- 若认证态失效，回跳 Portal 登录页。

## 10. 分阶段实施计划

### 阶段 A：稳定核心
- 固化首次登录强制改密策略（全角色）。
- 完成后端锁定策略持久化。
- runtimeConfig/public 接入 postLoginDefaultUrl。

### 阶段 B：自助注册
- 实现 ALLOW_SELF_SIGNIN 配置闭环。
- 落地 email/sms 验证码注册流程。

### 阶段 C：多认证提供方
- 接入 SSO / LDAP provider。
- 将 provider resolve 从 if-else 升级为插件注册表。

### 阶段 D：工业化治理
- 接入全链路审计、限流、告警。
- 补齐契约测试、集成测试、回归测试。

## 11. 测试策略

- 单元测试：策略引擎、状态迁移、错误码映射。
- 集成测试：登录、改密、锁定、注册、找回密码全流程。
- 契约测试：Portal API 响应结构稳定性。
- 安全测试：暴力破解、验证码重放、会话固定攻击。

## 12. 近期建议的最小落地项

1. 将当前登录失败计数从前端内存迁移到后端持久层。
2. 将登录后跳转地址统一迁移到 runtimeConfig/public。
3. 将首次登录强制改密逻辑下沉到后端策略层。
4. 增加 /api/portal/config/public 供前端读取开关。
5. 在 Portal 中用配置控制是否展示 Self Sign-up 入口。

---

如本蓝图确认无误，下一步可按阶段 A 直接进入代码实现。
