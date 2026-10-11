# Turborepo 在 monorepo 中的落地指南

> 基于当前工程实际状态整理，覆盖安装验证、`turbo.json` 配置、缓存机制、clean build 取舍、`--filter` 用法，以及分阶段实施步骤。

---

## 1. 当前状态

### 已验证通过

| 检查项 | 命令 | 结果 |
|---|---|---|
| 本地安装 | `pnpm turbo --version` | `2.5.0` ✅ |
| Workspace 识别 | `pnpm turbo run` | 列出 6 个包、18 个任务 ✅ |

`pnpm turbo run` 已能识别以下包与任务：

- `build`：`@monorepo/access-server`、`@monorepo/access-web`、`@monorepo/database`、`@monorepo/logger`、`@monorepo/ty-demo` 等
- `typecheck`、`dev`、`generate`、`lint`、`test`、`db:generate`、`db:push`、`db:studio` 等

### 尚未验证

- `build` 任务的缓存是否真正命中（“两次构建”验证）
- 根 `build` 脚本是否已从 `pnpm -r run build` 切换为 `turbo run build`
- `turbo.json` 是否已加 `clean` 任务

---

## 2. `turbo.json` 配置说明

当前配置（根目录）：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**/*", "*.ts", "package.json", "tsconfig.json"],
      "outputs": ["dist/**", "build/**", ".nuxt/**", ".output/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": [],
      "inputs": ["**/*.ts", "**/*.js", "**/*.vue", "eslint.config.js", "tsconfig.json"],
      "outputs": []
    },
    "db:generate": {
      "inputs": ["./prisma/schema.prisma"],
      "outputs": ["../../node_modules/@prisma/client"],
      "cache": true
    },
    "db:push": { "cache": false },
    "db:studio": { "cache": false, "persistent": true }
  }
}
```

### 需要注意的点

**`outputs` 里的 `build/**`**

Turborepo 的 `outputs` 是相对**每个包目录**的 glob。你的 monorepo 根目录有个 `build/`（放构建脚本和 Dockerfile），它**不会**被当作产物缓存，因为 Turbo 只处理包目录内的路径。但如果未来某个包里出现名为 `build` 的源码目录，Turbo 会把它当产物处理，需警惕。

**`db:generate` 的 `outputs` 路径**

```json
"outputs": ["../../node_modules/@prisma/client"]
```

相对起点是执行 `db:generate` 的包目录（`packages/database`）。`../../` 指向 monorepo 根。你的 Prisma Client 实际生成在 `node_modules/.prisma/client`（`prisma-client-js` 默认行为），这个 `outputs` 路径可能需要核对是否准确。

**`globalDependencies` 的 `tsconfig.json`**

只覆盖根目录的 `tsconfig.json`。各包内的 `tsconfig.json` 已通过 `build` 任务的 `inputs`（相对包目录）覆盖，这块没问题。

---

## 3. 缓存机制与 clean build 取舍

### Turbo 缓存是什么

Turborepo 为每个任务计算哈希（输入文件内容、依赖包任务哈希、环境变量、任务定义）。哈希未变时，**直接恢复上次产物，不执行构建脚本**。

### clean build 为什么不该信任缓存

用于**可交付产物**时，缓存存在风险：

1. **缓存污染**：上次构建的环境变量、工具链版本若有细微差异且未被纳入哈希，产物可能与当前环境不一致。
2. **不可复现**：交付物的可信度来自“能从当前源码和环境重新得到它”，命中缓存等于跳过验证。
3. **CI 与本地不一致**：本地命中缓存、CI 从零构建，产物可能有差异。

### 命令对照

| 场景 | 命令 | 缓存行为 |
|---|---|---|
| 日常开发构建 | `pnpm turbo run build` | 读 + 写缓存 |
| 出可交付产物 | `pnpm turbo run build --force` | 不读不写 |
| 重建但保留缓存结果 | `pnpm turbo run build --no-cache` | 不读，但写 |
| 彻底 clean build | `pnpm clean && pnpm turbo run build --force` | 先删产物，再强制重建 |

### 关键前提

clean build 的可靠性 = **clean 是否彻底** + **build 是否绕过缓存**，两者缺一不可。如果 `clean` 没真正删掉 `dist`、`.output`、`.nuxt`，即使 `--force` 也可能因增量工具跳过部分工作。

---

## 4. `--filter` 精准控制

Turborepo 的 `--filter` 支持依赖图感知，这是相对 `pnpm --filter` 的核心优势。

### 常用语法

```bash
# 只构建 @monorepo/access-web 及其依赖
pnpm turbo run build --filter=@monorepo/access-web

# 简写（按目录名匹配）
pnpm turbo run build --filter=webui

# 构建 access-web，以及它依赖的所有包（含传递依赖）
pnpm turbo run build --filter=@monorepo/access-web...

# 只构建直接依赖，不含传递依赖
pnpm turbo run build --filter=@monorepo/access-web^...

# 构建所有包，但排除 ty-demo
pnpm turbo run build --filter='!@monorepo/ty-demo'
```

### 为什么比手写 `build.sh` 安全

`--filter` 是**声明式**的：你指定“要什么”，不符合条件的包（如 `ty-demo`）自动排除。手写 `build.sh` 需手动枚举每个包的清理和构建步骤，新增包时容易遗漏。

### 建议的 `build.sh` 形态

```bash
#!/bin/bash
# build.sh
PROJECT=$1
pnpm turbo run build --filter="$PROJECT"
```

`build.sh` 只负责参数解析，构建编排完全交给 Turborepo。新增 app 时不需要改脚本。

---

## 5. 包级 `turbo.json`（可选）

**不需要为每个包添加 `turbo.json`。** 根配置已覆盖通用场景。仅在以下情况才需要包级配置：

- 框架特定的输出目录（如 `access-web` 的 `.nuxt`、`.output`）
- 包特有的环境变量
- 不同的缓存策略
- 排除继承的任务

### 示例：`ty-demo` 双交付形态

```json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/standalone/**"]
    },
    "build:auth": {
      "dependsOn": ["^build", "access-auth#build"],
      "outputs": ["dist/auth/**"],
      "env": ["AUTH_MODE"]
    }
  }
}
```

调用：

```bash
pnpm turbo run build --filter=ty-demo            # 单独发布
pnpm turbo run build:auth --filter=ty-demo       # 带认证发布
```

### 注意

包级 `turbo.json` 的数组字段（`outputs`、`env`、`dependsOn`）**默认是覆盖而非追加**。如需追加，使用 `$TURBO_EXTENDS$` 语法。

---

## 6. 分阶段实施步骤

### 阶段一：确认每个包的 `clean` 已就位

检查每个 `package.json` 是否有 `clean`，且**不清符号链接**。

参考已确认的：

```jsonc
// packages/database/package.json
"clean": "rm -rf dist .turbo node_modules/.cache *.tsbuildinfo"
```

```jsonc
// packages/access-server/package.json
"clean": "rm -rf dist .turbo node_modules/.cache *.tsbuildinfo"
```

需确认的包：`logger`、`ty-demo`、`config`、`crypto`、`types`、`access-web`、`ty-demo-app`。

**原则**：每个包只清自己真正产生的产物。`access-web` 清 `.nuxt`、`.output`；`ty-demo`（原生模块）清 `build`。

### 阶段二：验证基线（不用 Turbo）

```bash
pnpm clean
pnpm build
```

确认每个包能独立清干净、再构建成功。出问题容易定位是 clean 逻辑还是构建逻辑的问题。

### 阶段三：确认 Prisma 流程

```bash
pnpm --filter @monorepo/database db:generate
pnpm --filter @monorepo/database db:push    # 仅本地
pnpm build
```

- `db:generate`：保留，确保 Client 与 schema 同步。
- `db:push`：仅本地，**不进 CI / 交付流程**。

### 阶段四：引入 Turbo

把根 `build` 脚本从 `pnpm -r run build` 改为 `turbo run build`，然后：

```bash
pnpm turbo run build --force    # 第一次：强制跑，建立缓存
pnpm turbo run build            # 第二次：应命中缓存，显示 FULL TURBO
```

第二次秒过并显示缓存命中，说明 Turbo 生效。

### 阶段五：给 `clean` 加 Turbo 任务（可选）

在根 `turbo.json` 加：

```json
"clean": { "cache": false }
```

然后可以 `turbo run clean`。优先级低，先确保 `build` 的 Turbo 化稳定。

### 阶段六：处理 `ty-demo` 双交付形态

等基础 Turbo 流程稳定后，再为 `ty-demo` 添加包级 `turbo.json`，定义 `build` 和 `build:auth` 两个任务。

---

## 7. Turbo vs `pnpm build` 对比

| 维度 | `pnpm -r run build` | `turbo run build` |
|---|---|---|
| 缓存 | ❌ 每次全量执行 | ✅ 任务级哈希缓存 |
| 依赖图感知 | ❌ 按包名/目录顺序 | ✅ 读取 `dependsOn`，拓扑排序 |
| 并行 | 盲目并行/串行 | 无依赖的包并行执行 |
| `--filter` | 仅按包名/目录 | 结合依赖图，支持 `...`、`^...` |
| 任务语义声明 | 散落在各 `package.json` | 根 `turbo.json` 统一声明 |
| 远程缓存 | ❌ | ✅ 团队/CI 共享 |

**最大优势**：任务级缓存 + 依赖图感知的增量执行。

---

## 8. 常见陷阱

1. **环境变量未纳入哈希**：`ty-demo` 的认证模式若通过 `AUTH_MODE` 控制，必须写入 `turbo.json` 的 `env` 字段，否则缓存会返回错误产物。
2. **包级 `turbo.json` 数组覆盖**：默认覆盖根配置，需用 `$TURBO_EXTENDS$` 追加。
3. **`outputs` 相对包目录**：不是相对 monorepo 根，写 glob 时注意。
4. **`db:push` 误入 CI**：它是数据层操作，不是构建步骤。
5. **`clean` 误删符号链接**：`node_modules/@monorepo/*` 是 pnpm 管理的依赖表示，不是产物，所有包的 `clean` 都不该清它。

---

## 9. 命令速查

```bash
# 安装验证
pnpm turbo --version
pnpm turbo run

# 构建
pnpm turbo run build                          # 日常，带缓存
pnpm turbo run build --force                  # 可交付产物，绕过缓存
pnpm turbo run build --no-cache               # 不读缓存，但写

# 过滤
pnpm turbo run build --filter=@monorepo/access-web
pnpm turbo run build --filter=@monorepo/access-web...
pnpm turbo run build --filter='!@monorepo/ty-demo'

# clean build 完整流程
pnpm clean
pnpm install --frozen-lockfile                # 依赖没变可省
pnpm --filter @monorepo/database db:generate
pnpm turbo run build --force

# 两次构建验证缓存
pnpm turbo run build --force
pnpm turbo run build
```