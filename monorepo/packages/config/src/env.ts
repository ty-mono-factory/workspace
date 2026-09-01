import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { AppEnvironmentSchema } from "@monorepo/types";

type RuntimeEnv = Record<string, string | undefined>;

function readRuntimeEnv(): RuntimeEnv {
    return (
        globalThis as {
            process?: {
                env?: RuntimeEnv;
            };
        }
    ).process?.env ?? {};
}

const trueFalseSchema = z
    .enum(["true", "false"])
    .transform((value: string) => value === "true");
const integerStringSchema = z
    .string()
    .regex(/^\d+$/, "必须是正整数")
    .transform((value: string) => Number.parseInt(value, 10));
const dbUrlSchema = z.string().min(1, "DATABASE_URL 不能为空");

function createValidatedEnv(runtimeEnv: RuntimeEnv) {
    return createEnv({
        // 后端私有变量校验（Nitro / Node 侧使用）
        server: {
            NODE_ENV: AppEnvironmentSchema,
            DATABASE_URL: dbUrlSchema,
            ACCESS_WEB_PORT: integerStringSchema.default("10001"),
            DEMO_PORT: integerStringSchema.default("10002"),
            BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET 至少需要 32 个字符"),
            BETTER_AUTH_URL: z.string().url().default("http://localhost:10001"),
            ACCESS_TRUSTED_ORIGINS: z.string().optional(),
            ACCESS_SESSION_TTL_MINS: integerStringSchema.default("1440"),
            ACCESS_PASSWORD_MIN_LENGTH: integerStringSchema.default("10"),
            ACCESS_PASSWORD_MAX_LENGTH: integerStringSchema.default("128"),
            ACCESS_BOOTSTRAP_ADMIN_ENABLED: trueFalseSchema.default("false"),
            ACCESS_BOOTSTRAP_ADMIN_USERNAME: z.string().default("admin"),
            ACCESS_BOOTSTRAP_ADMIN_EMAIL: z.string().email().default("admin@localhost.local"),
            ACCESS_BOOTSTRAP_ADMIN_DISPLAY_NAME: z.string().default("Admin"),
            ACCESS_BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
            ACCESS_WEB_URL: z.string().url().default("http://localhost:10001"),
            TY_DEMO_URL: z.string().url().default("http://localhost:10002/"),
            TY_DEMO_ACCESS_MODE: z.enum(["public", "authenticated"]).default("authenticated"),
        },

        // 前端公开变量校验（Nuxt 必须以 WEB_PAGE_ 开头）
        clientPrefix: "WEB_PAGE_",
        client: {},

        runtimeEnv,
        skipValidation: runtimeEnv.SKIP_ENV_VALIDATION === "true",
        emptyStringAsUndefined: true,
    });
}

let cachedEnv: ReturnType<typeof createValidatedEnv> | null = null;

export function getEnv(runtimeEnv: RuntimeEnv = readRuntimeEnv()) {
    if (cachedEnv && runtimeEnv === readRuntimeEnv()) {
        return cachedEnv;
    }

    const validated = createValidatedEnv(runtimeEnv);

    if (runtimeEnv === readRuntimeEnv()) {
        cachedEnv = validated;
    }

    return validated;
}

export type AppEnv = ReturnType<typeof getEnv>;
