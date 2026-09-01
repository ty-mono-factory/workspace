# Monorepo 编译与运行指南

建议按下面流程操作，Turbo 会自动按依赖顺序编译各 package。

## 1. 准备运行环境

```bash
cd /Users/chent/Downloads/test_demo

nvm install
nvm use

corepack enable
corepack prepare pnpm@10.34.4 --activate

node -v
pnpm -v
```

预期 Node 为 `v22.14.x`、pnpm 为 `10.34.4`。

不要使用 `corepack pnpm build`；应先执行 `corepack enable`，然后直接运行 `pnpm build`，否则 Turbo 可能找不到 pnpm 可执行文件。

项目包含 C++ Native Addon。macOS 如果编译 `node-gyp` 失败，先安装：

```bash
xcode-select --install
```

## 2. 配置环境变量

如果根目录还没有 `.env`：

```bash
cp env.example .env
```

至少修改：

```env
DATABASE_URL=file:///Users/chent/Downloads/test_demo/packages/database/dev.db

BETTER_AUTH_SECRET=替换成至少32字符的随机字符串
BETTER_AUTH_URL=http://localhost:10001
ACCESS_TRUSTED_ORIGINS=http://localhost:10001,http://localhost:10002

ACCESS_WEB_URL=http://localhost:10001
TY_DEMO_URL=http://localhost:10002/
TY_DEMO_ACCESS_MODE=authenticated
```

随机 Secret 可以这样生成：

```bash
openssl rand -base64 32
```

完整配置说明见 [`docs/access-subsystem-configuration.md`](docs/access-subsystem-configuration.md)。

## 3. 安装依赖、初始化数据库

正常使用锁文件安装：

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:push
```

如果刚修改了 `pnpm-workspace.yaml` 中的依赖版本，例如升级 `pino-pretty`，需要更新锁文件：

```bash
pnpm install --no-frozen-lockfile
```

随后再使用 `--frozen-lockfile`，保证其他环境安装出相同依赖树。

## 4. 编译检查

```bash
pnpm -r --if-present run typecheck
pnpm -r --if-present run test
pnpm -r --if-present run test:contracts
pnpm build
```

`pnpm build` 会通过 Turbo 编译数据库、logger、access-server、Native Addon 和两个 Nuxt 应用。

需要查看完整错误时：

```bash
pnpm exec turbo run build --force --output-logs=full
```

## 5. 开发模式运行

最简单的方式是从根目录启动全部应用：

```bash
pnpm dev
```

访问：

- Access Web：<http://localhost:10001>
- Demo App：<http://localhost:10002>

首次需要管理员时，可以临时在 `.env` 中启用：

```env
ACCESS_BOOTSTRAP_ADMIN_ENABLED=true
ACCESS_BOOTSTRAP_ADMIN_PASSWORD=一个满足长度要求的开发密码
```

启动成功并创建管理员后，立即把开关改回 `false`，并删除明文密码。

## 6. 运行生产构建产物

先构建：

```bash
pnpm build
```

然后分别启动两个进程：

```bash
NODE_ENV=production PORT=10001 \
node --env-file=.env apps/access-web/.output/server/index.mjs
```

另一个终端：

```bash
NODE_ENV=production PORT=10002 \
node --env-file=.env apps/ty-demo-app/.output/server/index.mjs
```

## 7. 排查 `pino-pretty 13.0.x` 构建问题

升级后建议先分别执行：

```bash
pnpm --filter @monorepo/logger build
pnpm --filter @monorepo/database build
pnpm --filter @monorepo/access-server build
```

这样可以明确错误究竟来自 logger 依赖，还是 `better-auth/accessAuth` 的声明生成，而不是被完整 Nuxt 构建日志掩盖。
