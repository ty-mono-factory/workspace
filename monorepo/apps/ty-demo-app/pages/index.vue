<template>
    <main class="app-shell">
        <aside class="sidebar">
            <div>
                <p class="product-kicker">Mini-factory</p>
                <h1 class="product-name">TY Demo</h1>
                <p class="product-description">Nuxt 与 Native C 的最小应用链路</p>
            </div>

            <nav class="primary-nav" aria-label="应用导航">
                <a class="nav-link active" href="/" aria-current="page">
                    <span class="nav-icon" aria-hidden="true">⌂</span>
                    首页
                </a>
            </nav>

            <section class="account-panel" aria-labelledby="account-heading">
                <p id="account-heading" class="section-label">当前账户</p>

                <div v-if="accountLoading" class="account-loading">
                    正在加载账户……
                </div>

                <template v-else-if="account">
                    <div class="account-identity">
                        <span class="avatar" aria-hidden="true">{{ accountInitial }}</span>
                        <div class="account-copy">
                            <strong>{{ account.name }}</strong>
                            <span>{{ account.username ? `@${account.username}` : account.email }}</span>
                        </div>
                    </div>

                    <div class="role-list" aria-label="账户角色">
                        <span v-for="role in accountRoles" :key="role" class="role-badge">
                            {{ role }}
                        </span>
                    </div>

                    <a class="account-link" :href="accountCenterUrl">
                        账户中心
                        <span aria-hidden="true">→</span>
                    </a>
                </template>

                <template v-else>
                    <p class="guest-copy">当前以访客身份访问。</p>
                    <a class="account-link" :href="loginUrl">
                        登录
                        <span aria-hidden="true">→</span>
                    </a>
                </template>
            </section>
        </aside>

        <section class="content-panel">
            <header class="page-header">
                <div>
                    <p class="page-kicker">Native capability</p>
                    <h2>Native C 调用</h2>
                    <p>这次请求从 Nuxt 服务端经过 TypeScript 和 Node-API，最终进入本地 C 实现。</p>
                </div>
                <span class="status-badge" :class="{ error: nativeFailed }">
                    {{ nativeLoading ? '正在调用' : nativeFailed ? '调用失败' : '链路已连接' }}
                </span>
            </header>

            <section class="architecture-card" aria-labelledby="architecture-heading">
                <p id="architecture-heading" class="section-label">调用链</p>
                <div class="architecture-flow" aria-label="Nuxt 到 Native C 的调用链">
                    <span>Nuxt 3</span>
                    <span aria-hidden="true">→</span>
                    <span>TypeScript</span>
                    <span aria-hidden="true">→</span>
                    <span>Node-API</span>
                    <span aria-hidden="true">→</span>
                    <span>Native C</span>
                </div>
            </section>

            <section class="result-card" aria-live="polite">
                <div class="result-heading">
                    <div>
                        <p class="section-label">执行结果</p>
                        <h3>getWholeSentence()</h3>
                    </div>
                    <span class="language-label">C</span>
                </div>
                <code :class="{ error: nativeFailed }">{{ message }}</code>
            </section>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface AccountUser {
    id: string
    name: string
    email: string
    username: string | null
    roles: string[]
}

type AccountResponse =
    | { authenticated: false }
    | { authenticated: true; user: AccountUser }

type NativeResponse =
    | string
    | {
        data?: string
        message?: string
    }

const runtimeConfig = useRuntimeConfig()
const message = ref('正在调用 Native C……')
const nativeLoading = ref(true)
const nativeFailed = ref(false)
const account = ref<AccountUser | null>(null)
const accountLoading = ref(true)

const accountInitial = computed(() => account.value?.name.trim().charAt(0).toUpperCase() || '?')
const accountRoles = computed(() => account.value?.roles.length ? account.value.roles : ['user'])

const accountCenterUrl = computed(() => {
    return new URL('/account', runtimeConfig.public.accessWebUrl).toString()
})

const loginUrl = computed(() => {
    const url = new URL('/login', runtimeConfig.public.accessWebUrl)
    url.searchParams.set('app', 'ty-demo-app')
    return url.toString()
})

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : '未知错误'
}

async function loadNativeResult(): Promise<void> {
    try {
        const response = await $fetch<NativeResponse>('/api/ty-demo')
        message.value = typeof response === 'string'
            ? response
            : response.data ?? response.message ?? JSON.stringify(response)
    } catch (error) {
        nativeFailed.value = true
        message.value = `加载失败：${errorMessage(error)}`
    } finally {
        nativeLoading.value = false
    }
}

async function loadAccount(): Promise<void> {
    try {
        const response = await $fetch<AccountResponse>('/api/access/account')
        account.value = response.authenticated ? response.user : null
    } catch {
        account.value = null
    } finally {
        accountLoading.value = false
    }
}

onMounted(async () => {
    await Promise.all([
        loadNativeResult(),
        loadAccount(),
    ])
})
</script>

<style scoped>
:global(*) {
    box-sizing: border-box;
}

:global(body) {
    margin: 0;
    background: #f4f6f8;
    color: #15202b;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(16rem, 19rem) minmax(0, 1fr);
}

.sidebar {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 2rem 1.5rem;
    color: #f8fafc;
    background: #17212b;
    border-right: 1px solid #263545;
}

.product-kicker,
.page-kicker,
.section-label {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.product-kicker {
    color: #5ee0a0;
}

.product-name {
    margin: 0.35rem 0 0;
    font-size: 1.65rem;
}

.product-description {
    margin: 0.7rem 0 0;
    color: #aab8c5;
    font-size: 0.9rem;
    line-height: 1.6;
}

.primary-nav {
    display: grid;
    gap: 0.5rem;
}

.nav-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0.9rem;
    color: #c7d2dc;
    text-decoration: none;
    border-radius: 0.55rem;
}

.nav-link.active {
    color: #ffffff;
    background: #263545;
}

.nav-icon {
    width: 1.25rem;
    color: #5ee0a0;
    font-size: 1.15rem;
    text-align: center;
}

.account-panel {
    display: grid;
    gap: 1rem;
    margin-top: auto;
    padding-top: 1.5rem;
    border-top: 1px solid #344454;
}

.account-panel .section-label {
    color: #7f93a5;
}

.account-identity {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    min-width: 0;
}

.avatar {
    width: 2.6rem;
    height: 2.6rem;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    color: #112019;
    background: #5ee0a0;
    border-radius: 50%;
    font-weight: 800;
}

.account-copy {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
}

.account-copy strong,
.account-copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.account-copy span,
.account-loading,
.guest-copy {
    color: #9fb0bf;
    font-size: 0.82rem;
}

.guest-copy {
    margin: 0;
}

.role-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.role-badge {
    padding: 0.2rem 0.5rem;
    color: #b9f8d5;
    background: #1f4435;
    border: 1px solid #2d654e;
    border-radius: 999px;
    font-size: 0.72rem;
}

.account-link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.7rem 0.8rem;
    color: #ffffff;
    text-decoration: none;
    background: #263545;
    border-radius: 0.5rem;
}

.account-link:hover {
    background: #314354;
}

.content-panel {
    width: min(100%, 72rem);
    padding: clamp(2rem, 5vw, 5rem);
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    margin-bottom: 2.5rem;
}

.page-kicker,
.content-panel .section-label {
    color: #5f6d79;
}

.page-header h2 {
    margin: 0.35rem 0 0.75rem;
    font-size: clamp(2rem, 4vw, 3.2rem);
    letter-spacing: -0.04em;
}

.page-header p:last-child {
    max-width: 42rem;
    margin: 0;
    color: #5f6d79;
    line-height: 1.7;
}

.status-badge {
    flex: 0 0 auto;
    padding: 0.45rem 0.75rem;
    color: #12613b;
    background: #dff8e9;
    border: 1px solid #b7eaca;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
}

.status-badge.error {
    color: #9e2f2f;
    background: #fff0f0;
    border-color: #f2c2c2;
}

.architecture-card,
.result-card {
    background: #ffffff;
    border: 1px solid #dce2e7;
    border-radius: 0.9rem;
    box-shadow: 0 12px 35px rgb(23 33 43 / 0.06);
}

.architecture-card {
    padding: 1.4rem;
}

.architecture-flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.65rem;
    margin-top: 1rem;
}

.architecture-flow span:nth-child(odd) {
    padding: 0.55rem 0.75rem;
    color: #263545;
    background: #eef2f4;
    border-radius: 0.45rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.84rem;
}

.architecture-flow span:nth-child(even) {
    color: #82909c;
}

.result-card {
    margin-top: 1.25rem;
    overflow: hidden;
}

.result-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.4rem;
    border-bottom: 1px solid #e4e9ed;
}

.result-heading h3 {
    margin: 0.35rem 0 0;
    font-size: 1rem;
}

.language-label {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    color: #ffffff;
    background: #17212b;
    border-radius: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-weight: 800;
}

.result-card code {
    display: block;
    min-height: 9rem;
    padding: 2rem 1.4rem;
    color: #c5f9d9;
    background: #101820;
    font-size: clamp(1rem, 2.5vw, 1.35rem);
    line-height: 1.7;
    white-space: pre-wrap;
}

.result-card code.error {
    color: #ffc7c7;
}

@media (max-width: 760px) {
    .app-shell {
        grid-template-columns: 1fr;
    }

    .sidebar {
        min-height: auto;
    }

    .account-panel {
        margin-top: 0;
    }

    .content-panel {
        padding: 2rem 1.25rem 3rem;
    }

    .page-header {
        display: grid;
    }

    .status-badge {
        width: fit-content;
    }
}
</style>
