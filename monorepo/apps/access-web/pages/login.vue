<template>
    <main class="access-shell">
        <form class="access-card" @submit.prevent="submit">
            <header>
                <p class="eyebrow">Access Subsystem</p>
                <h1>登录</h1>
                <p>使用本地用户名或电子邮箱继续。</p>
            </header>

            <label>
                用户名或电子邮箱
                <input v-model.trim="identifier" autocomplete="username" required>
            </label>

            <label>
                密码
                <input v-model="password" type="password" autocomplete="current-password" required>
            </label>

            <label class="inline-field">
                <input v-model="rememberMe" type="checkbox">
                保持登录
            </label>

            <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
            <button :disabled="submitting" type="submit">
                {{ submitting ? '登录中……' : '登录' }}
            </button>
        </form>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { authClient } from '~/utils/auth-client'
import { requestedAppKey } from '~/utils/app-destinations'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const identifier = ref('')
const password = ref('')
const rememberMe = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const appKey = computed(() => requestedAppKey(route.query.app))

function destination(): string {
    return appKey.value === 'ty-demo-app'
        ? runtimeConfig.public.tyDemoUrl
        : '/account'
}

async function continueToDestination(): Promise<void> {
    const target = destination()
    await navigateTo(target, {
        external: /^https?:\/\//.test(target),
        replace: true,
    })
}

onMounted(async () => {
    const session = await authClient.getSession()
    if (session.data) {
        await continueToDestination()
    }
})

async function submit(): Promise<void> {
    submitting.value = true
    errorMessage.value = ''

    const credentials = {
        password: password.value,
        rememberMe: rememberMe.value,
    }
    const result = identifier.value.includes('@')
        ? await authClient.signIn.email({
            email: identifier.value,
            ...credentials,
        })
        : await authClient.signIn.username({
            username: identifier.value,
            ...credentials,
        })

    submitting.value = false
    if (result.error) {
        errorMessage.value = result.error.message ?? '登录失败'
        return
    }

    await continueToDestination()
}
</script>

<style scoped>
.access-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    background: #f5f7fb;
    font-family: sans-serif;
}

.access-card {
    width: min(100%, 26rem);
    display: grid;
    gap: 1rem;
    padding: 2rem;
    background: white;
    border: 1px solid #dfe4ec;
    border-radius: 0.75rem;
}

.access-card header p {
    color: #596274;
}

.access-card h1 {
    margin: 0.25rem 0;
}

.eyebrow {
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

label {
    display: grid;
    gap: 0.4rem;
}

input {
    padding: 0.7rem;
    border: 1px solid #b7bfcc;
    border-radius: 0.35rem;
}

.inline-field {
    display: flex;
    align-items: center;
}

button {
    padding: 0.75rem;
    border: 0;
    border-radius: 0.35rem;
    background: #155eef;
    color: white;
}

button:disabled {
    opacity: 0.6;
}

.error {
    color: #b42318;
}
</style>
