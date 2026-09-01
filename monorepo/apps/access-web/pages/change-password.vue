<template>
    <main class="access-shell">
        <form class="access-card" @submit.prevent="submit">
            <h1>修改密码</h1>
            <label>
                当前密码
                <input v-model="currentPassword" type="password" autocomplete="current-password" required>
            </label>
            <label>
                新密码
                <input v-model="newPassword" type="password" autocomplete="new-password" required>
            </label>
            <p v-if="message" :class="{ error: failed }" role="status">{{ message }}</p>
            <button :disabled="submitting" type="submit">保存</button>
            <NuxtLink to="/account">返回账户</NuxtLink>
        </form>
    </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { authClient } from '~/utils/auth-client'

definePageMeta({ middleware: 'require-access' })

const currentPassword = ref('')
const newPassword = ref('')
const message = ref('')
const failed = ref(false)
const submitting = ref(false)

async function submit(): Promise<void> {
    submitting.value = true
    message.value = ''
    const result = await authClient.changePassword({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value,
        revokeOtherSessions: true,
    })
    submitting.value = false
    failed.value = Boolean(result.error)
    message.value = result.error?.message ?? '密码已更新'

    if (!result.error) {
        currentPassword.value = ''
        newPassword.value = ''
    }
}
</script>

<style scoped>
.access-shell {
    max-width: 30rem;
    margin: 4rem auto;
    padding: 1.5rem;
    font-family: sans-serif;
}

.access-card {
    display: grid;
    gap: 1rem;
    padding: 2rem;
    border: 1px solid #dfe4ec;
    border-radius: 0.75rem;
}

label {
    display: grid;
    gap: 0.4rem;
}

input {
    padding: 0.7rem;
}

.error {
    color: #b42318;
}
</style>
