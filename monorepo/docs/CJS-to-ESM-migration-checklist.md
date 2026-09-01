# CJS → ESM 迁移检查表

适用场景：pnpm workspace、Node.js 22、TypeScript、Nuxt 3、Docker，以及包含 C/C++ Node-API addon `ty_demo` 的 Monorepo。

> 目标不是消灭所有 `require()`。普通 JavaScript/TypeScript 包迁移为 ESM；`.node` 原生 addon 继续在其包装包内部通过 `createRequire()` 稳定加载，对外只暴露 ESM API。

---

## 0. 迁移策略先确认

- [ ] 明确目标是“纯 ESM”还是“ESM + CJS 双产物”。
- [ ] 当前脚手架若没有旧 CJS 消费者，优先选择纯 ESM，避免双包风险。
- [ ] 确认最低 Node.js 版本，并在本地、CI、Docker builder、production 镜像中统一。
- [ ] 若继续使用 Node 22，固定到当前受支持的 Node 22 LTS 补丁版本，而不是宽泛使用浮动版本。
- [ ] 记录迁移前可工作的构建、测试和启动命令，作为回归基线。
- [ ] 迁移按 workspace 包逐个进行，不要一次性修改整个 Monorepo 后再排错。

建议顺序：

1. 叶子工具包，例如 `logger`、`crypto`。
2. 原生 addon 包 `ty_demo`。
3. `biz-*`、`preset-*` 等业务包。
4. 薄装配入口 `apps/server`。
5. Nuxt `apps/webui`、测试、脚本和 Docker。

---

## 1. 搜索全部 CJS 痕迹

在仓库根目录检查：

```bash
rg '\brequire\s*\(' apps packages scripts builder
rg '\bmodule\.exports\b|\bexports\.' apps packages scripts builder
rg '\b__dirname\b|\b__filename\b' apps packages scripts builder
rg '\brequire\.resolve\b|\brequire\.main\b' apps packages scripts builder
rg '"type"\s*:|"main"\s*:|"module"\s*:|"exports"\s*:' --glob package.json
rg 'moduleResolution|module|outDir|declaration' --glob 'tsconfig*.json'
rg '\.node|ty_demo|node-gyp' .
```

- [ ] 每个匹配项都已分类：需要迁移、必须保留的 addon 桥接、或仅存在于文档/测试夹具。
- [ ] 生成器模板、示例代码和脚手架模板也完成搜索，不能只修改当前生成结果。
- [ ] Shell、Docker entrypoint 和配置文件中的启动命令也完成搜索。

---

## 2. 每个 package 的 `package.json`

### 2.1 声明 ESM

- [ ] 所有准备迁移为 ESM 的 workspace 包都包含：

```json
{
  "type": "module"
}
```

- [ ] 没有依赖根目录 `"type": "module"` 隐式决定所有子包行为；每个独立包自己声明。
- [ ] 必须保留为 CommonJS 的脚本使用 `.cjs` 后缀，意图清晰。

### 2.2 声明公开入口

- [ ] 使用 `"exports"` 限制包的公开 API。
- [ ] `"types"`、运行时入口和实际构建目录一致。
- [ ] 不再指向已经删除的 `index.cjs`、源码 `.ts` 或旧 `lib/` 目录。

纯 ESM TypeScript 包示例：

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ]
}
```

- [ ] workspace 消费者使用包名导入，例如 `@monorepo/logger`，不穿透到 `src/` 或 `dist/`。
- [ ] 内部依赖使用 `"workspace:*"`，避免解析到 registry 同名包。
- [ ] 若确实需要子路径导出，逐项声明，例如 `"./testing"`，不要开放整个内部目录。
- [ ] 没有在只产出 ESM 的包中虚假声明 `"require"` 条件。

### 2.3 依赖分类

- [ ] 运行时实际 import 的包位于 `dependencies`。
- [ ] 仅构建、类型或测试使用的包位于 `devDependencies`。
- [ ] `@types/node`、TypeScript 和构建工具版本在 workspace 中保持一致。

---

## 3. TypeScript 配置

Node 直接运行的 ESM 包推荐：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] `module` 与 `moduleResolution` 成对使用 `NodeNext`。
- [ ] 没有继续用 `CommonJS` 输出覆盖 ESM 目标。
- [ ] `rootDir`、`outDir` 与 package `exports` 一致。
- [ ] 需要被其他 TypeScript 包消费的库开启 `declaration`。
- [ ] 测试、脚本和源码若运行环境不同，使用单独的 tsconfig。
- [ ] Nuxt 自己管理的 tsconfig 不被根配置粗暴覆盖；通过 Nuxt 推荐方式扩展。

### `tsc -p` 与 `tsc -b`

- [ ] 独立编译单个包时使用 `tsc -p tsconfig.json`。
- [ ] 使用 TypeScript project references 管理包依赖图时使用 `tsc -b`。
- [ ] `--verbose` 只增加 `tsc -b` 的诊断输出，不改变编译语义。
- [ ] 没有仅为了“看起来像 Monorepo”就使用 project references；选择必须与实际配置一致。

---

## 4. 源码导入导出语法

### 4.1 CommonJS → ESM

- [ ] `const x = require("x")` 已改为静态 `import`，除非属于 `.node` addon 桥接。
- [ ] `module.exports = value` 已改为 `export default value` 或命名导出。
- [ ] `exports.name = value` 已改为 `export { value as name }` 或 `export const name = ...`。
- [ ] `require()` 的条件加载已评估是否改为异步 `await import()`。
- [ ] 动态模块路径没有直接机械替换为无法静态分析的 `import`。

示例：

```ts
// Before
const { createLogger } = require("./logger");
exports.createApp = createApp;

// After
import { createLogger } from "./logger.js";
export { createApp };
```

### 4.2 导出名称一致

- [ ] default import 对应 default export。
- [ ] named import 对应实际 named export。
- [ ] 已修复最近发现的 `crypto` 导出名称与消费者 import 不一致问题。
- [ ] `logger` 的入口和全部内部文件都已经 ESM 化。
- [ ] barrel `index.ts` 没有继续转发不存在或已改名的符号。
- [ ] 大小写与真实文件名完全一致，避免 Linux Docker 中失败。

### 4.3 仅类型导入

- [ ] 仅用于类型的依赖使用 `import type`：

```ts
import type { Logger } from "@monorepo/logger";
```

- [ ] 在 `verbatimModuleSyntax` 下没有把类型误当运行时值导入。

---

## 5. Node ESM 的文件扩展名规则

- [ ] NodeNext 下，TypeScript 源码中的相对 import 已写最终运行时的 `.js` 后缀：

```ts
import { createService } from "./service.js";
```

- [ ] 没有写成：

```ts
import { createService } from "./service";
import { createService } from "./service.ts";
```

- [ ] package-name imports 通过 `exports` 解析，不添加文件后缀：

```ts
import { createLogger } from "@monorepo/logger";
```

- [ ] 目录导入已改为具体文件或明确的 package subpath export。
- [ ] 动态 `import()` 中的本地路径同样带 `.js`。
- [ ] 测试文件、生成器模板和示例中的相对路径也已更新。

---

## 6. 替代 CommonJS 全局变量

### `__filename` / `__dirname`

- [ ] 不再直接使用 `__filename` 或 `__dirname`。
- [ ] 若需要兼容整个 Node 22 系列，使用：

```ts
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const directory = dirname(filename);
```

- [ ] 文件定位以模块文件位置为准时使用 `import.meta.url`，不要误用 `process.cwd()`。
- [ ] 产品数据目录、配置目录和模块资源目录已经明确区分。

### 其他 CommonJS 能力

- [ ] `require.resolve()` 已替换为 `import.meta.resolve()`，或在确需 CJS 解析语义时使用 `createRequire(import.meta.url).resolve()`。
- [ ] `require.main === module` 的入口判断已替换，或通过独立 `main.ts` 消除判断。
- [ ] 没有假设 ESM 和 CommonJS 共用同一模块缓存。

---

## 7. JSON、资源文件和动态加载

- [ ] JSON 的加载方式已明确：import attributes 或文件读取。
- [ ] 使用 import attributes 时，目标 Node 与 TypeScript 版本支持：

```ts
import config from "./config.json" with { type: "json" };
```

- [ ] 运行时可修改或位于外部数据目录的 JSON 使用 `fs` 读取，不打包成模块。
- [ ] 证书、SQL、模板和其他资源路径相对 `import.meta.url` 计算。
- [ ] 动态 `import()` 已正确 `await`，上层调用链接受其异步性质。

---

## 8. 第三方 CommonJS 包的互操作

- [ ] 检查每个第三方依赖实际提供 ESM、CJS，还是双入口。
- [ ] 不假设 CommonJS 包一定支持可靠的 named imports。
- [ ] 对只提供 CommonJS 的包，必要时使用 default import 后解构：

```ts
import legacyPackage from "legacy-package";

const { feature } = legacyPackage;
```

- [ ] 在 Node 实际运行环境中测试，而不只依赖编辑器类型提示。
- [ ] 没有仅为迁移语法而启用不必要的 bundler。

---

## 9. `ty_demo` 原生 addon 专项

### 9.1 稳定加载边界

- [ ] `.node` 只在 `packages/ty-demo` 内部加载。
- [ ] `apps/server` 和其他包不会直接引用 `.node` 路径。
- [ ] Node 22 生产环境继续使用稳定的 `createRequire()`，不依赖 `--experimental-addon-modules`。

推荐包装：

```ts
// packages/ty-demo/src/index.ts
import { createRequire } from "node:module";

interface TyDemoNativeAddon {
  SecureActionWithJS(
    fn: (input: string) => unknown,
  ): unknown;
}

const require = createRequire(import.meta.url);

const nativeAddon = require(
  "../build/Release/ty_demo.node",
) as TyDemoNativeAddon;

export function secureActionWithJS(
  fn: (input: string) => unknown,
): unknown {
  return nativeAddon.SecureActionWithJS(fn);
}
```

- [ ] `as TyDemoNativeAddon` 被理解为编译期类型声明，不是运行时校验。
- [ ] 若原生导出结构可能变化，已增加最小运行时断言或启动自检。
- [ ] 对外导出使用稳定、符合项目命名风格的 ESM API，不泄漏 C++ 原始加载细节。

### 9.2 `.node` 路径

- [ ] 路径是相对于编译后的 `dist/index.js`，不是相对于源码 `src/index.ts` 推测。
- [ ] 已检查最终文件布局，例如：

```text
packages/ty-demo/
├── build/Release/ty_demo.node
└── dist/index.js
```

上述布局中，`dist/index.js` 到 addon 通常是：

```ts
require("../build/Release/ty_demo.node");
```

- [ ] Docker production 镜像中保留相同相对布局。
- [ ] `package.json.files` 或 Docker COPY 没有漏掉 `ty_demo.node`。
- [ ] Debug 与 Release 路径策略明确；生产环境不静默回退到 Debug。

### 9.3 构建脚本

只运行：

```json
"build": "node-gyp rebuild"
```

只能编译 C/C++，不会把 TypeScript wrapper 编译为 JavaScript。

如果 `ty_demo` 仍有 `src/index.ts`，应保留两段构建：

```json
{
  "scripts": {
    "build:addon": "node-gyp rebuild",
    "build:compile": "tsc -p tsconfig.json",
    "build": "pnpm run build:addon && pnpm run build:compile"
  }
}
```

- [ ] `node-gyp rebuild` 成功生成 `build/Release/ty_demo.node`。
- [ ] `tsc` 成功生成 `dist/index.js` 和 `dist/index.d.ts`。
- [ ] `build` 同时执行 addon 构建和 wrapper 编译。
- [ ] 若 wrapper 已改成纯 `.js/.mjs` 且无需声明文件，才可以有依据地取消 `tsc`。
- [ ] addon 使用 Node-API/`node-addon-api`，避免直接绑定不稳定的 V8 ABI。
- [ ] 更换 Node 版本后重新执行 `node-gyp rebuild` 并运行冒烟测试。

### 9.4 `ty-demo/package.json`

- [ ] workspace 包名使用 `@monorepo/ty-demo`；`binding.gyp` 的 C/C++ 标识符和输出文件有意保留 `ty_demo`。
- [ ] `exports` 指向 ESM wrapper，不直接导出 `.node`：

```json
{
  "name": "@monorepo/ty-demo",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "build/Release/ty_demo.node"
  ]
}
```

---

## 10. Monorepo 包边界

- [ ] `apps/server` 是 ESM 运行入口和 composition root。
- [ ] `apps/server` 只通过包的公开 `exports` 使用 `logger`、`biz-*`、`preset-*` 和 `ty_demo`。
- [ ] `apps/webui` 不导入 `biz-auth`、`logger`、database、LDAP、crypto 或 `ty_demo`。
- [ ] WebUI 只通过 HTTP JSON，例如 `POST /api/v1/auth/login`，调用 server。
- [ ] `AuthAuditLogger` 等业务 port 仍定义在 `biz-auth`，没有因 ESM 迁移错误移动到 `logger`。
- [ ] `apps/server` 中的 adapter 使用 `@monorepo/logger` 实现 `AuthAuditLogger`。
- [ ] 没有为了修复 ESM 循环依赖而把所有代码重新聚合到一个包。
- [ ] pnpm workspace 依赖图不存在循环；必要时执行递归构建验证拓扑。

---

## 11. Nuxt 3 检查

- [ ] 没有把 Node-only 包导入 Vue component、client plugin 或普通 composable。
- [ ] Nuxt 客户端可访问的环境变量只使用明确的 public runtime config。
- [ ] server-only secret 没有因为共享 barrel 或 auto-import 进入客户端 bundle。
- [ ] Nuxt Layer、module、plugin 的配置使用 ESM 导出。
- [ ] UI feature packages 只依赖 UI 包和 `contracts-*`。
- [ ] Nuxt 构建产物是按既定部署模型运行：独立 Nitro，或静态 `.output/public` 交给 `apps/server` 托管。

---

## 12. 测试与工具链

- [ ] 测试运行器配置支持 ESM。
- [ ] 测试中的 mock 方式不再依赖 CommonJS `require.cache`。
- [ ] ESLint 配置文件已迁移为 ESM，或明确使用 `.cjs`。
- [ ] node-gyp、代码生成器、数据库 migration 等 CLI 脚本逐个验证。
- [ ] generator 生成的新 package 默认包含正确的 `"type": "module"`、`exports` 和 tsconfig。
- [ ] generator 生成的相对 import 默认带 `.js`。
- [ ] root 示例、模板、README 命令与真实实现同步。
- [ ] 没有用 tsup 掩盖模块格式和 `.node` 路径问题。
- [ ] 如果以后引入 tsup，`ty_demo.node` 及其包装包被正确 external/copy，且文件名不会被 hash 改写。

---

## 13. Docker 与部署

- [ ] Docker builder 与 production 使用相同 Node major/minor 策略和相同 CPU 架构。
- [ ] Node 版本同时更新于：
  - [ ] Dockerfile builder
  - [ ] Dockerfile production
  - [ ] `package.json.engines`
  - [ ] `.nvmrc`、Volta 或其他版本文件
  - [ ] CI 配置
  - [ ] 开发文档
- [ ] production 启动的是编译后的 ESM `.js`，不是 TypeScript 源码。
- [ ] production 镜像包含所有 `dist/`、必要 dependencies、数据库 migration 和 `.node` 文件。
- [ ] production 镜像不依赖 builder 中偶然存在的全局工具。
- [ ] Docker 中实际执行一次 addon 加载和函数调用冒烟测试。
- [ ] 没有依赖 `--experimental-addon-modules`。
- [ ] Linux 文件名大小写、文件权限、动态链接库和 libc 兼容性已验证。
- [ ] `SIGTERM`、退出码和服务关闭流程在 ESM 入口下仍然正常。

---

## 14. 构建产物检查

不要只看 `tsc` 成功；直接检查产物：

```bash
rg '\brequire\s*\(|\bmodule\.exports\b|\bexports\.' packages/*/dist apps/*/dist
rg "from\s+['\"][.]{1,2}/[^'\"]+['\"]" packages/*/dist apps/*/dist
find packages apps -path '*/dist/*.js' -o -path '*/dist/*.d.ts'
find packages -name '*.node'
```

- [ ] 普通包产物中没有意外的 `require()`、`module.exports`。
- [ ] `ty_demo` wrapper 中保留的 `createRequire()` 是有意的例外。
- [ ] 编译后的相对 imports 都包含可解析扩展名。
- [ ] `.d.ts` 中没有引用无法解析的源码路径。
- [ ] source map 指向正确源码。
- [ ] package tarball/部署目录中没有漏文件。

可用以下方式预览实际打包内容：

```bash
pnpm --filter @monorepo/ty-demo pack --pack-destination /tmp
```

---

## 15. 分层验收命令

按顺序执行，失败时更容易定位：

```bash
# 1. 干净安装依赖
pnpm install --frozen-lockfile

# 2. 类型检查
pnpm -r typecheck

# 3. 构建全部 workspace
pnpm -r build

# 4. 运行测试
pnpm -r test

# 5. 单独验证原生 addon
pnpm --filter @monorepo/ty-demo build
pnpm --filter @monorepo/ty-demo test

# 6. 构建最终 server/webui
pnpm --filter ./apps/server... build
pnpm --filter ./apps/webui... build

# 7. 构建并运行 Docker
# 使用项目现有 builder/docker 脚本
```

- [ ] `pnpm install --frozen-lockfile` 成功。
- [ ] 每个包的 typecheck 成功。
- [ ] 每个包的 build 成功。
- [ ] 单元测试成功。
- [ ] `ty_demo` 冒烟测试成功。
- [ ] `apps/server` 从干净构建产物启动成功。
- [ ] WebUI HTTP JSON 调用成功。
- [ ] Docker 镜像从干净上下文构建并启动成功。

---

## 16. 常见错误快速定位

| 错误 | 优先检查 |
| --- | --- |
| `require is not defined in ES module scope` | 普通 CJS 语法是否漏改；若是 `.node`，是否封装在 `createRequire()` 中 |
| `exports is not defined` | `exports.*` / `module.exports` 是否漏改 |
| `ERR_MODULE_NOT_FOUND` | 相对 import 是否缺 `.js`；exports 是否指错；大小写是否一致 |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | 是否穿透导入了未在 `exports` 声明的路径 |
| `Cannot find module ...ty_demo.node` | 编译后 wrapper 与 `.node` 的相对路径、Docker COPY |
| `Module did not self-register` | addon 注册宏、Node ABI、构建 Node 版本、CPU/OS 架构 |
| `undefined is not a function` | native addon 的实际导出名与 `TyDemoNativeAddon` 类型声明不一致 |
| `Named export ... not found` | 第三方依赖是否只有 CommonJS，改用 default import 后解构 |
| 类型检查通过但运行失败 | `as` 仅是类型断言；增加运行时自检并直接执行构建产物 |
| 本地成功、Docker 失败 | 大小写、libc、动态库、架构、Node 版本、遗漏 `.node` |
| `index.ts` 没有生成 `index.js` | 是否错误取消了 `tsc`，或 tsconfig include/rootDir 配置错误 |

---

## 17. 完成定义

只有下面全部满足，才视为 CJS → ESM 迁移完成：

- [ ] 普通 workspace 包均明确声明 ESM。
- [ ] package `exports` 与真实产物一致。
- [ ] NodeNext 配置和 `.js` import 后缀一致。
- [ ] 不再依赖隐式 CJS 全局变量。
- [ ] `logger`、`crypto` 和其他基础包导入导出一致。
- [ ] `ty_demo` 同时完成原生编译和 TypeScript wrapper 编译。
- [ ] `.node` 加载桥只存在于 `ty_demo` 内部。
- [ ] `apps/server` 只消费 `ty_demo` 的公开 ESM API。
- [ ] WebUI 与 server 的安全边界没有因迁移而改变。
- [ ] generator/template 生成的新代码默认就是 ESM。
- [ ] 本地、CI、Docker 使用一致的 Node 版本策略。
- [ ] 从全新 checkout/干净 Docker context 可以安装、构建、测试并启动。
- [ ] 对外 API、HTTP JSON 行为和核心 C/C++ 功能完成回归测试。

---

## 官方参考

- [Node.js ECMAScript Modules](https://nodejs.org/api/esm.html)
- [Node.js `module.createRequire()`](https://nodejs.org/api/module.html#modulecreaterequirefilename)
- [Node.js C++ Addons](https://nodejs.org/api/addons.html)
- [Node.js Node-API](https://nodejs.org/api/n-api.html)
- [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [TypeScript `module` configuration](https://www.typescriptlang.org/tsconfig/module.html)
- [TypeScript `moduleResolution` configuration](https://www.typescriptlang.org/tsconfig/moduleResolution.html)
- [pnpm Workspace](https://pnpm.io/workspaces)
