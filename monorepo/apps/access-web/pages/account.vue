<template>
    <main class="access-shell">
        <section v-if="account" class="access-card">
            <header>
                <p class="eyebrow">Access Subsystem</p>
                <h1>{{ account.name }}</h1>
            </header>

            <dl>
                <dt>用户名</dt>
                <dd>{{ account.username ?? '—' }}</dd>
                <dt>电子邮箱</dt>
                <dd>{{ account.email }}</dd>
                <dt>角色</dt>
                <dd>{{ account.role ?? 'user' }}</dd>
            </dl>

            <nav>
                <NuxtLink to="/change-password">修改密码</NuxtLink>
                <NuxtLink v-if="isAdmin" to="/admin/users">Local 用户管理</NuxtLink>
            </nav>

            <button type="button" @click="signOut">退出登录</button>
        </section>
        <p v-else>正在加载账户……</p>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { authClient } from '~/utils/auth-client'

definePageMeta({ middleware: 'require-access' })

interface AccountView {
    name: string
    email: string
    username: string | null
    role: string | null
}

const account = ref<AccountView | null>(null)
const isAdmin = computed(() => {
    return account.value?.role
        ?.split(',')
        .map((role) => role.trim())
        .includes('admin') === true
})

onMounted(async () => {
    const session = await authClient.getSession()
    if (!session.data) {
        await navigateTo('/login', { replace: true })
        return
    }

    account.value = {
        name: session.data.user.name,
        email: session.data.user.email,
        username: session.data.user.username ?? null,
        role: session.data.user.role ?? null,
    }
})

async function signOut(): Promise<void> {
    await authClient.signOut()
    await navigateTo('/login', { replace: true })
}
</script>

<style scoped>
.access-shell {
    max-width: 42rem;
    margin: 4rem auto;
    padding: 1.5rem;
    font-family: sans-serif;
}

.access-card {
    display: grid;
    gap: 1.5rem;
    padding: 2rem;
    border: 1px solid #dfe4ec;
    border-radius: 0.75rem;
}

.eyebrow {
    color: #596274;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

h1 {
    margin: 0;
}

dl {
    display: grid;
    grid-template-columns: 8rem 1fr;
    gap: 0.7rem;
}

dt {
    color: #596274;
}

dd {
    margin: 0;
}

nav {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
}

button {
    width: fit-content;
    padding: 0.65rem 1rem;
}
</style>
