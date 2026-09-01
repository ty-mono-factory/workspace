<template>
    <main class="access-shell">
        <p>正在检查访问状态……</p>
    </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { authClient } from '~/utils/auth-client'

onMounted(async () => {
    const session = await authClient.getSession()
    await navigateTo(session.data ? '/account' : '/login', { replace: true })
})
</script>

<style scoped>
.access-shell {
    max-width: 42rem;
    margin: 5rem auto;
    padding: 2rem;
    font-family: sans-serif;
}
</style>
