# Access Web 配置与操作指南

> 适用版本：当前 Better Auth 本地认证 MVP
> 配置示例：[env.example](../../env.example)
> 开发环境配置文件：项目根目录 `.env`

## 构建与交付

交付压缩包为 `artifacts/access-web.tar.gz`。发布构建会先清理，再完整重建应用及其依赖：

```bash
bash build/release/build.sh --project access-web
bash build/release/image.sh --project access-web --release-tag 1.2.3
```

数据库使用同版本的 [dbmigrator 镜像](../../build/dbmigrator/README.md)执行迁移。
全新部署还需执行下文的 `admin-init`，随后才能登录管理账号；应用启动不再自动创建用户。

## 1. 最小开发配置

开始开发前，至少确认以下配置：

```env
DATABASE_URL=file:///workspace/data/monorepo/database/dev.db

BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=http://localhost:10001
ACCESS_TRUSTED_ORIGINS=http://localhost:10001,http://localhost:10002

ACCESS_WEB_URL=http://localhost:10001
TY_DEMO_URL=http://localhost:10002/
TY_DEMO_ACCESS_MODE=authenticated
```

不要把示例 Secret 用于真实环境。可以用密码管理器或系统随机数工具生成至少 32 字符的随机值，例如：

```bash
openssl rand -base64 32
```

## 2. 配置总表

| 配置项 | 必需性 | 默认值 | 作用与说明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 必需 | 无，必须由外部注入 | Access Subsystem 的 User、Account、Session、Verification 和审计数据地址。当前 Prisma provider 是 SQLite，运行时通过 libSQL adapter 连接。 |
| `DATABASE_AUTH_TOKEN` | 远程数据库需要 | 空 | 远程 libSQL/Turso 的认证 Token。本地 `file:` SQLite 必须留空。 |
| `BETTER_AUTH_SECRET` | 必需 | 无 | Better Auth 用于保护认证数据的服务端 Secret。至少 32 个字符；生产环境必须随机生成并通过 Secret Manager 注入。改变该值可能使已有认证状态失效。 |
| `BETTER_AUTH_URL` | 生产环境必需显式配置 | `http://localhost:10001` | Access Web 对用户公开的 Origin。只能是 `http://` 或 `https://` Origin，不能包含路径、查询参数或 fragment。认证路由路径由代码固定。 |
| `ACCESS_TRUSTED_ORIGINS` | 推荐显式配置 | 自动包含 `BETTER_AUTH_URL` | 允许调用认证端点的浏览器 Origin，多个值以英文逗号分隔。不要使用不必要的宽泛来源。 |
| `ACCESS_SESSION_TTL_MINS` | 可选 | `1440` | Session 有效期，单位为分钟，只接受正整数。当前默认值是 24 小时。 |
| `ACCESS_PASSWORD_MIN_LENGTH` | 可选 | `10` | 本地密码最小长度，只接受正整数。由 Better Auth 执行。 |
| `ACCESS_PASSWORD_MAX_LENGTH` | 可选 | `128` | 本地密码最大长度，只接受正整数，且不能小于最小长度。 |
| `ACCESS_WEB_PORT` | 开发期可选 | `10001` | `access-web` 的 Nuxt 开发服务器端口。生产构建产物通常由部署平台的 `PORT`/Nitro 配置决定监听端口。 |
| `DEMO_PORT` | 开发期可选 | `10002` | `ty-demo-app` 的 Nuxt 开发服务器端口。 |
| `ACCESS_WEB_URL` | 必需 | `http://localhost:10001` | `ty-demo-app` 发现未登录访问时跳转到的 Access Web 公共地址。通常应与 `BETTER_AUTH_URL` 使用同一 Origin。 |
| `TY_DEMO_URL` | 必需 | `http://localhost:10002/` | Access Web 登录成功后，受信任的 `app=ty-demo-app` 返回目标。它来自服务端配置，不接受用户提交任意返回 URL。 |
| `TY_DEMO_ACCESS_MODE` | 可选 | `authenticated` | `ty-demo-app` 的访问模式，只能设置为 `public` 或 `authenticated`。 |
| `NODE_ENV` | 推荐 | 由运行工具决定 | 通常使用 `development`、`test` 或 `production`。它不是认证策略开关。 |

## 3. `ty-demo-app` 访问模式

### 公开模式

```env
TY_DEMO_ACCESS_MODE=public
```

- `/` 可以匿名访问；
- `/api/ty-demo` 可以匿名调用；
- 不解析 Access Session；
- 不需要连接认证数据库才能显示当前演示功能。

### 认证模式

```env
TY_DEMO_ACCESS_MODE=authenticated
```

- 匿名访问 `/` 时跳转到 Access Web 登录页；
- 登录请求携带受信任的 `app=ty-demo-app`；
- 登录成功后返回 `TY_DEMO_URL`；
- `/api/ty-demo` 没有有效 Session 时返回 HTTP 401；
- 有效 Session 会映射为实现无关的 `AccessContext`；
- 被禁用的用户不会获得已认证的 `AccessContext`。

`credential` 不是应用访问模式。它是 Better Auth 中本地密码 Account 的内部 provider ID。应用只应关心访问者是否已经认证，不应关心认证是通过密码、Passkey 还是未来的 OIDC 完成。因此不要配置：

```env
# 错误示例
TY_DEMO_ACCESS_MODE=credential
```

## 4. 首个管理员：显式执行 admin-init

应用启动不再创建账号；旧的 `ACCESS_BOOTSTRAP_ADMIN_*` 变量已全部删除，
请从本地环境、Docker env-file 和部署 Secret 中移除。普通启动只负责 Web 服务。

### 首次部署顺序

1. 构建应用 release 和同版本 dbmigrator 镜像。
2. 使用 dbmigrator 执行数据库迁移，确认退出码为 0。
3. 仅对全新、尚无用户的数据库，使用应用 release 镜像执行 `admin-init`。
4. 初始化成功后移除临时密码文件，再正常启动应用。

迁移步骤和备份要求见 [dbmigrator 操作说明](../../build/dbmigrator/README.md)。
应用、迁移器和初始化命令必须使用相同的持久化数据库目录、`DATABASE_URL`，
并使用兼容的 UID/GID。应用镜像默认以 node 用户（UID 1000）运行。

准备 `/etc/mini-factory/application.env`，其中至少包括：

```env
DATABASE_URL=file:/data/access-web.db
BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=https://access.example.com
ACCESS_TRUSTED_ORIGINS=https://access.example.com,https://demo.example.com
```

使用密码管理器或编辑器创建强密码文件 `/etc/mini-factory/admin-password`。
文件必须是普通文件，权限为 `0400` 或 `0600`，所有者需允许容器运行用户读取；
最多 4096 字节，结尾的一个换行会被去掉。不要把密码放进命令参数、shell 历史或环境变量。

```bash
docker run --rm --init --network none \
  --env-file /etc/mini-factory/application.env \
  --mount type=bind,source=/srv/mini-factory/database,target=/data \
  --mount type=bind,source=/etc/mini-factory/admin-password,target=/run/secrets/admin-password,readonly \
  registry.example.com/mini-factory/mini-factory-access-web:1.2.3 admin-init \
  --username operator --email operator@example.com --display-name Administrator \
  --password-file /run/secrets/admin-password
```

镜像名称、版本和路径需要按实际部署调整。初始化退出码为 0 后，删除临时密码文件
或撤销对应 Secret 的分发；日常应用容器不再挂载它。

正常启动应用：

```bash
docker run --rm --init \
  --env-file /etc/mini-factory/application.env \
  --mount type=bind,source=/srv/mini-factory/database,target=/data \
  -p 3000:3000 \
  registry.example.com/mini-factory/mini-factory-access-web:1.2.3
```

用户名长度为 3–30，只允许字母、数字、下划线、点，并会统一转为小写；
邮箱也会统一转为小写，显示名称长度为 1–100，密码长度遵循配置表。
当前不提供首次登录强制改密功能，初始化时应直接使用正式强密码。

### 技术保证和重复执行

数据库表 `access_initialization` 使用唯一键 `first-admin` 记录初始化成功状态。
命令先用 Better Auth 的密码哈希实现生成凭据，再在同一个数据库事务中完成：

1. 插入唯一初始化记录，取得本次初始化资格。
2. 确认数据库中没有用户。
3. 创建管理员、credential Account 和成功审计。
4. 提交事务。

重复执行会失败，不能用此命令修改已有管理员的密码。并发执行只能有一个事务成功。
失败时标记、账号、凭据和审计一起回滚；若提交时连接断开，先确认数据库状态再决定是否重试。
初始化记录不与用户建立级联外键，删除或停用管理员不会重新开放初始化。

当前尚未发布，数据库结构已合并为单个初始迁移，迁移本身不创建管理员。
初始化命令遇到任何已有用户都会拒绝，不会修改账号或提升权限；已有账号的恢复需要单独处理。
本命令不提供 `--force`、重置或恢复功能，不要手动删标记来重新初始化。
这些保证以数据库访问权限受控为前提，数据库直接写权限仍属于运维信任边界。

### 本地开发初始化

在 monorepo 根目录执行。环境变量需已由 shell 或 builder 的 env-file 注入。
先安装锁定依赖、生成 Prisma 客户端并执行迁移，然后使用权限受限的密码文件：

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @monorepo/database db:deploy
pnpm --filter @monorepo/access-web exec tsx scripts/admin-init.ts \
  --username operator --email operator@example.com --display-name Administrator \
  --password-file /absolute/path/admin-password
pnpm build
pnpm dev
```

这里的迁移和初始化都是显式操作；日常开发仍使用 install/build/dev 流程，
不需要每次执行迁移或管理员初始化。不要指向生产库执行本地初始化测试。

## 5. Local 用户管理

管理员登录 Access Web 后，可以从 `/account` 进入 `/admin/users`。当前 MVP 支持：

- 列出 Local 用户，并查看角色、账户状态和 Session 记录数；
- 创建 Local 用户，指定 `user` 或 `admin` 角色；
- 修改显示名称和 Access 角色；
- 停用、恢复用户；停用时同时撤销该用户的 Session；
- 管理员重置密码，并撤销该用户的 Session；
- 单独撤销某个用户的全部 Session。

保护规则在服务端强制执行：

- 只有已认证且未停用的 `admin` 可以调用管理 API；
- 变更请求的 Origin 必须等于 `BETTER_AUTH_URL`；
- 管理员不能修改自己的角色、停用自己、管理员重置自己的密码或撤销自己的 Session；
- 当前单进程协调边界内，服务端保证至少保留一个正常状态的管理员；
- 变更审计记录 actor、target、outcome 和失败代码，不记录密码或 Session Token；
- Better Auth 原始 `/api/access/auth/admin/*` 浏览器管理路由被屏蔽，页面只调用 Access 自己的受控 API。

当前不提供硬删除、批量操作、模拟登录、SSO、JIT/self-provision 或应用内业务角色。用户禁用是 MVP 的可恢复离职路径。

并发边界采用“对所有会减少有效管理员集合的操作进行串行化”的表达：

- 停用有效管理员、将有效管理员降为 `user`，以及未来如果引入的管理员删除，属于管理员退出操作；
- 管理员退出操作进入专用协调器，并在串行边界内重新认证操作者、重新读取目标和有效管理员数量；
- 创建用户、修改显示名称、重置密码、撤销 Session 等不进入管理员专用队列；
- 不同普通用户的命令可以并行，只有同一用户上可能冲突的命令才按用户 ID 排序。

当前 `AdminReductionCoordinator` 明确声明为 `process` scope，因此上述保证只对单个 Access Web 进程成立。当前 Mini-factory 的单实例部署可以使用这个边界；如果以后水平扩展到多个 Access Web 实例，必须先替换为共享、持久化的 cluster-scope 协调器，并使“重新检查＋变更”保持原子性。

## 6. 固定配置与行为

以下内容目前由代码固定，不存在对应环境变量：

| 项目 | 当前值或行为 |
| --- | --- |
| 认证路由 | `/api/access/auth/*` |
| 认证引擎 | Better Auth |
| 数据库 adapter | Prisma libSQL adapter（schema provider 为 SQLite） |
| 本地认证 | Email/Password + Username |
| 自助注册 | 禁用 |
| 用户名可用性公开端点 | 禁用 |
| Access 管理角色 | `admin` |
| 普通默认角色 | `user` |
| Session 所有者 | Better Auth |
| 认证限流 | Better Auth 内置限流已启用 |
| 登录返回参数 | 只接受受信任的 `app=ty-demo-app` |

不要为了调整这些值而重新建立 Portal API、旧 Session、密码兼容层或通用 Provider Registry。出现真实需求后，再把确实需要调整的项目提升为配置。

当前 MVP 尚未提供“可信代理列表/客户端 IP Header”的环境配置。如果部署环境不能让 Better Auth 解析可信客户端 IP，内置限流会退化为共享的按路径桶。生产部署前应根据真实反向代理拓扑配置 Better Auth 的可信代理/IP 解析能力；不要盲目信任来自公网请求的 `X-Forwarded-For`。

## 7. 开发配置与生产运行时覆盖

当前 Nuxt 命令使用 `--dotenv /dev/null`，不会自动读取根目录 `.env`；Prisma 也要求外部注入 `DATABASE_URL`。
使用 builder 时通过 `build/builder/launch.sh --env-file <path>` 注入；在主机运行时由 shell 或部署工具注入。
修改 env-file 后应重新创建 builder 容器，修改 shell 环境后应重启开发进程。

Nuxt `runtimeConfig` 在生产构建产物中应使用 `NUXT_` 命名的变量进行启动时覆盖：

| 构建/开发变量 | 生产启动时对应的 Nuxt 覆盖变量 |
| --- | --- |
| `TY_DEMO_ACCESS_MODE` | `NUXT_ACCESS_MODE` |
| `ACCESS_WEB_URL` | `NUXT_PUBLIC_ACCESS_WEB_URL` |
| `TY_DEMO_URL` | `NUXT_PUBLIC_TY_DEMO_URL` |

例如，在不重新构建 `ty-demo-app` 的情况下切换为公开模式：

```env
NUXT_ACCESS_MODE=public
```

浏览器可见的 `NUXT_PUBLIC_*` 值不能存放 Secret。`BETTER_AUTH_SECRET` 和数据库 Token 只能通过服务端环境注入；初始化密码只通过受限文件传递。

## 8. Origin、Cookie 与部署拓扑

当前 localhost 开发环境中，Cookie 不按端口隔离，因此 `localhost:10001` 和 `localhost:10002` 可以共享认证 Cookie。

部署时检查：

- `BETTER_AUTH_URL` 使用用户实际访问的 HTTPS Origin；
- `ACCESS_WEB_URL` 指向用户能够访问的 Access Web；
- `TY_DEMO_URL` 指向用户能够访问的应用地址；
- 两个应用能够在预期域名范围内接收同一个 Session Cookie；
- 所有实际浏览器 Origin 都在 `ACCESS_TRUSTED_ORIGINS` 中；
- 反向代理正确转发 HTTPS、Host 和客户端地址相关请求头；
- 不要把内部容器地址误用为浏览器返回地址。

如果未来应用位于无法共享 Cookie 的独立域名，不能仅靠增加 Trusted Origin 解决。届时需要评估标准 OIDC/OAuth 身份交付或短期应用启动 Token，这不属于当前 MVP。

## 9. 数据库初始化与重建

生成 Prisma Client：

```bash
pnpm db:generate
```

正常初始化和后续升级都使用迁移，以执行完整 SQL，包括初始化状态表的自定义约束：

```bash
pnpm --filter @monorepo/database db:deploy
```

生产部署使用同版本 dbmigrator，参见上面的首次部署顺序。
`pnpm db:push` 只同步 schema，不执行迁移中的自定义 SQL 和约束，不能替代本流程。

初始迁移在首次发布前已合并；已应用旧迁移的本地开发数据库不能直接沿用旧迁移历史。
确认数据可丢弃后，可以用下面命令重建。若需要保留本地数据，应先备份并单独规划迁移历史对齐，
不要直接修改 `_prisma_migrations` 或把所有迁移标成已应用。

开发期旧认证数据与 Better Auth Schema 不兼容且确认数据库可丢弃时，也可以破坏式重建：

```bash
pnpm --filter @monorepo/database exec prisma migrate reset --force --config prisma.config.ts
```

`migrate reset --force` 会清空目标数据库并重新应用迁移。执行前必须再次确认 `DATABASE_URL` 指向可丢弃的开发数据库；不要对包含业务数据或生产数据的数据库使用该命令。

## 10. 生产检查清单

- [ ] `BETTER_AUTH_SECRET` 是独立生成的高熵 Secret，且没有提交到源码；
- [ ] `BETTER_AUTH_URL` 是无路径的 HTTPS Origin；
- [ ] `ACCESS_TRUSTED_ORIGINS` 只包含必要 Origin；
- [ ] `DATABASE_URL` 指向正确的持久化数据库；
- [ ] 远程数据库 Token 仅通过服务端 Secret 注入；
- [ ] 已移除所有旧 bootstrap 环境变量；
- [ ] 已完成数据库迁移，首次部署已显式执行 `admin-init`；
- [ ] 环境中不存在首个管理员明文密码，初始化密码文件已移除；
- [ ] `ACCESS_WEB_URL` 和 `TY_DEMO_URL` 都是用户可访问地址；
- [ ] `ty-demo-app` 的访问模式已经明确选择；
- [ ] 反向代理与 Cookie 域部署方式经过真实登录测试；
- [ ] 匿名请求无法访问认证模式下的 `/api/ty-demo`；
- [ ] 已验证登录、注销、修改密码、管理员创建用户和禁用用户行为；
- [ ] 已验证最后管理员与管理员自我锁定保护；
- [ ] 已验证管理员重置密码、停用用户后的 Session 撤销；
- [ ] 已在 Schema 更改后执行 `pnpm db:generate` 和数据库迁移；
- [ ] 没有重新启用旧 Portal、旧 Session 或旧密码数据路径。

## 11. 配置位置索引

- 示例变量：`env.example`
- 本地开发变量：`.env`
- Better Auth 配置：`packages/access-server/src/auth.ts`
- 配置读取与校验：`packages/access-server/src/config.ts`
- 首个管理员事务：`packages/access-server/src/provisioning.ts`
- 初始化 CLI：`apps/access-web/scripts/admin-init.ts`
- release 命令分发：`apps/access-web/delivery/entrypoint.sh`
- 初始化状态迁移：`packages/database/prisma/migrations/20261018061521_init/migration.sql`
- Access Web Nuxt 配置：`apps/access-web/nuxt.config.ts`
- Demo App Nuxt 配置：`apps/ty-demo-app/nuxt.config.ts`
- Demo App 访问策略：`apps/ty-demo-app/utils/access-policy.ts`
- Demo App 服务端门禁：`apps/ty-demo-app/server/middleware/access.ts`
- Local 用户管理服务：`packages/access-server/src/local-users.ts`
- Local 用户管理页面：`apps/access-web/pages/admin/users.vue`
- 管理员退出协调器：`packages/access-server/src/admin-reduction-coordinator.ts`
