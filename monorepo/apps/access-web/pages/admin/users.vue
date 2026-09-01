<template>
    <main class="admin-shell">
        <header class="page-header">
            <div>
                <p class="eyebrow">Access Subsystem</p>
                <h1>Local 用户管理</h1>
                <p>管理本地凭据用户、Access 角色、账户状态和现有 Session。</p>
            </div>
            <NuxtLink class="secondary-link" to="/account">返回账户</NuxtLink>
        </header>

        <p v-if="notice" class="notice" :class="{ error: noticeFailed }" role="status">
            {{ notice }}
        </p>

        <section class="create-card">
            <div class="section-heading">
                <div>
                    <p class="eyebrow">Provisioning</p>
                    <h2>创建 Local 用户</h2>
                </div>
                <button class="text-button" type="button" @click="showCreate = !showCreate">
                    {{ showCreate ? '收起' : '展开' }}
                </button>
            </div>

            <form v-if="showCreate" class="create-form" @submit.prevent="createUser">
                <label>
                    用户名
                    <input v-model.trim="createForm.username" autocomplete="off" required>
                </label>
                <label>
                    显示名称
                    <input v-model.trim="createForm.name" autocomplete="off" required>
                </label>
                <label>
                    电子邮箱
                    <input v-model.trim="createForm.email" type="email" autocomplete="off" required>
                </label>
                <label>
                    初始密码
                    <input v-model="createForm.password" type="password" autocomplete="new-password" required>
                </label>
                <label>
                    Access 角色
                    <select v-model="createForm.role">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                    </select>
                </label>
                <button class="primary-button" :disabled="busy !== null" type="submit">
                    创建用户
                </button>
            </form>
        </section>

        <section class="management-grid">
            <section class="user-list-card">
                <div class="section-heading list-heading">
                    <div>
                        <p class="eyebrow">Directory</p>
                        <h2>用户列表</h2>
                    </div>
                    <button class="text-button" :disabled="loading" type="button" @click="loadUsers">
                        刷新
                    </button>
                </div>

                <p v-if="loading" class="empty-state">正在加载用户……</p>
                <p v-else-if="users.length === 0" class="empty-state">还没有 Local 用户。</p>
                <template v-else>
                    <button v-for="user in users" :key="user.id" class="user-row"
                        :class="{ selected: selectedUser?.id === user.id }" type="button" @click="selectUser(user.id)">
                        <span class="avatar" aria-hidden="true">{{ user.name.charAt(0).toUpperCase() }}</span>
                        <span class="user-row-copy">
                            <strong>
                                {{ user.name }}
                                <small v-if="user.isCurrentUser">当前账户</small>
                            </strong>
                            <span>{{ user.username ? `@${user.username}` : user.email }}</span>
                        </span>
                        <span class="badges">
                            <span class="badge role">{{ user.role }}</span>
                            <span class="badge" :class="user.disabled ? 'disabled' : 'active'">
                                {{ user.disabled ? '已停用' : '正常' }}
                            </span>
                        </span>
                    </button>
                </template>
            </section>

            <section v-if="selectedUser" class="detail-card">
                <div class="section-heading">
                    <div>
                        <p class="eyebrow">Selected user</p>
                        <h2>{{ selectedUser.name }}</h2>
                    </div>
                    <span v-if="selectedUser.isLastActiveAdmin" class="last-admin-badge">
                        最后管理员
                    </span>
                </div>

                <dl>
                    <dt>用户名</dt>
                    <dd>{{ selectedUser.username ?? '—' }}</dd>
                    <dt>电子邮箱</dt>
                    <dd>{{ selectedUser.email }}</dd>
                    <dt>创建时间</dt>
                    <dd>{{ formatDate(selectedUser.createdAt) }}</dd>
                    <dt>Session 记录</dt>
                    <dd>{{ selectedUser.sessionCount }}</dd>
                </dl>

                <p v-if="selectedUser.isCurrentUser" class="constraint-note">
                    为避免锁定自身，当前账户不能在此修改自身角色、状态、密码或 Session。
                </p>
                <p v-else-if="selectedUser.isLastActiveAdmin" class="constraint-note">
                    系统必须保留至少一个正常状态的管理员，因此不能停用或降级该账户。
                </p>

                <form class="operation-section" @submit.prevent="saveName">
                    <h3>显示名称</h3>
                    <div class="inline-operation">
                        <input v-model.trim="editName" required>
                        <button class="secondary-button" :disabled="busy !== null" type="submit">
                            保存
                        </button>
                    </div>
                </form>

                <form class="operation-section" @submit.prevent="saveRole">
                    <h3>Access 角色</h3>
                    <div class="inline-operation">
                        <select v-model="editRole" :disabled="selectedUser.isCurrentUser">
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                        </select>
                        <button class="secondary-button" :disabled="roleChangeBlocked || busy !== null" type="submit">
                            更新角色
                        </button>
                    </div>
                </form>

                <form class="operation-section" @submit.prevent="resetPassword">
                    <h3>重置密码</h3>
                    <p>设置新密码后，该用户的全部现有 Session 会被撤销。</p>
                    <div class="inline-operation">
                        <input v-model="newPassword" :disabled="selectedUser.isCurrentUser" type="password"
                            autocomplete="new-password" placeholder="输入新密码" required>
                        <button class="secondary-button" :disabled="selectedUser.isCurrentUser || busy !== null"
                            type="submit">
                            重置
                        </button>
                    </div>
                </form>

                <section class="operation-section danger-zone">
                    <h3>账户状态</h3>
                    <p>停用会阻止后续登录，并立即撤销该用户的全部 Session。</p>
                    <div class="action-row">
                        <button class="secondary-button" :disabled="selectedUser.isCurrentUser || busy !== null"
                            type="button" @click="revokeSessions">
                            撤销 Session
                        </button>
                        <button v-if="selectedUser.disabled" class="restore-button" :disabled="busy !== null"
                            type="button" @click="restoreUser">
                            恢复账户
                        </button>
                        <button v-else class="danger-button" :disabled="disableBlocked || busy !== null" type="button"
                            @click="disableUser">
                            停用账户
                        </button>
                    </div>
                </section>
            </section>

            <section v-else class="detail-card empty-detail">
                从左侧选择一个用户进行管理。
            </section>
        </section>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

definePageMeta({ middleware: 'require-admin' })

type LocalRole = 'user' | 'admin'

interface LocalUser {
    id: string
    name: string
    email: string
    username: string | null
    role: LocalRole
    disabled: boolean
    createdAt: string
    sessionCount: number
    isCurrentUser: boolean
    isLastActiveAdmin: boolean
}

interface LocalUserList {
    currentUserId: string
    users: LocalUser[]
}

const users = ref<LocalUser[]>([])
const selectedUserId = ref<string | null>(null)
const loading = ref(true)
const busy = ref<string | null>(null)
const notice = ref('')
const noticeFailed = ref(false)
const showCreate = ref(false)
const editName = ref('')
const editRole = ref<LocalRole>('user')
const newPassword = ref('')
const createForm = reactive({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'user' as LocalRole,
})

const selectedUser = computed(() => {
    return users.value.find((user) => user.id === selectedUserId.value) ?? null
})

const roleChangeBlocked = computed(() => {
    const user = selectedUser.value
    return !user
        || user.isCurrentUser
        || (user.isLastActiveAdmin && editRole.value !== 'admin')
})

const disableBlocked = computed(() => {
    return !selectedUser.value
        || selectedUser.value.isCurrentUser
        || selectedUser.value.isLastActiveAdmin
})

function errorText(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return '操作失败'
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value))
}

function showNotice(message: string, failed = false): void {
    notice.value = message
    noticeFailed.value = failed
}

function syncEditor(user: LocalUser | null): void {
    editName.value = user?.name ?? ''
    editRole.value = user?.role ?? 'user'
    newPassword.value = ''
}

function selectUser(userId: string): void {
    selectedUserId.value = userId
    syncEditor(selectedUser.value)
}

async function loadUsers(): Promise<void> {
    loading.value = true
    try {
        const response = await $fetch<LocalUserList>('/api/access/local-users')
        users.value = response.users

        if (!selectedUserId.value || !users.value.some((user) => user.id === selectedUserId.value)) {
            selectedUserId.value = users.value[0]?.id ?? null
        }
        syncEditor(selectedUser.value)
    } catch (error) {
        showNotice(errorText(error), true)
    } finally {
        loading.value = false
    }
}

async function runOperation(
    label: string,
    operation: () => Promise<unknown>,
    successMessage: string,
): Promise<void> {
    busy.value = label
    showNotice('')
    try {
        await operation()
        await loadUsers()
        showNotice(successMessage)
    } catch (error) {
        showNotice(errorText(error), true)
    } finally {
        busy.value = null
    }
}

async function command(body: Record<string, unknown>): Promise<unknown> {
    if (!selectedUser.value) {
        return
    }

    return $fetch(`/api/access/local-users/${encodeURIComponent(selectedUser.value.id)}`, {
        method: 'PATCH',
        body,
    })
}

async function createUser(): Promise<void> {
    await runOperation(
        'create',
        () => $fetch('/api/access/local-users', {
            method: 'POST',
            body: { ...createForm },
        }),
        `用户 ${createForm.username} 已创建`,
    )

    if (!noticeFailed.value) {
        createForm.username = ''
        createForm.name = ''
        createForm.email = ''
        createForm.password = ''
        createForm.role = 'user'
    }
}

async function saveName(): Promise<void> {
    await runOperation(
        'update-name',
        () => command({ action: 'update-name', name: editName.value }),
        '显示名称已更新',
    )
}

async function saveRole(): Promise<void> {
    await runOperation(
        'set-role',
        () => command({ action: 'set-role', role: editRole.value }),
        'Access 角色已更新',
    )
}

async function resetPassword(): Promise<void> {
    await runOperation(
        'reset-password',
        () => command({ action: 'reset-password', newPassword: newPassword.value }),
        '密码已重置，现有 Session 已撤销',
    )
}

async function revokeSessions(): Promise<void> {
    await runOperation(
        'revoke-sessions',
        () => command({ action: 'revoke-sessions' }),
        '该用户的全部 Session 已撤销',
    )
}

async function disableUser(): Promise<void> {
    if (!window.confirm(`确定停用 ${selectedUser.value?.name ?? '该用户'}？`)) {
        return
    }

    await runOperation(
        'disable',
        () => command({ action: 'disable' }),
        '用户已停用',
    )
}

async function restoreUser(): Promise<void> {
    await runOperation(
        'restore',
        () => command({ action: 'restore' }),
        '用户已恢复',
    )
}

onMounted(async () => {
    await loadUsers()
})
</script>

<style scoped>
:global(*) {
    box-sizing: border-box;
}

:global(body) {
    margin: 0;
    background: #f4f6f8;
    color: #17212b;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

.admin-shell {
    width: min(100%, 78rem);
    margin: 0 auto;
    padding: 3rem 1.5rem 5rem;
}

.page-header,
.section-heading,
.inline-operation,
.action-row {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.page-header,
.section-heading {
    justify-content: space-between;
}

.page-header {
    align-items: flex-start;
    margin-bottom: 1.5rem;
}

.page-header h1 {
    margin: 0.3rem 0 0.6rem;
    font-size: clamp(2rem, 4vw, 3rem);
}

.page-header p:last-child {
    margin: 0;
    color: #607080;
}

.eyebrow {
    margin: 0;
    color: #647585;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.secondary-link {
    padding: 0.65rem 0.9rem;
    color: #264d3c;
    text-decoration: none;
    border: 1px solid #b9c7c0;
    border-radius: 0.5rem;
}

.notice {
    padding: 0.8rem 1rem;
    color: #1d603f;
    background: #e3f7eb;
    border: 1px solid #bce5cc;
    border-radius: 0.55rem;
}

.notice.error {
    color: #9d2d2d;
    background: #fff0f0;
    border-color: #efc1c1;
}

.create-card,
.user-list-card,
.detail-card {
    background: #fff;
    border: 1px solid #dce3e7;
    border-radius: 0.8rem;
    box-shadow: 0 10px 30px rgb(25 41 52 / 0.05);
}

.create-card {
    margin-bottom: 1.25rem;
    padding: 1.35rem;
}

.section-heading h2 {
    margin: 0.25rem 0 0;
    font-size: 1.2rem;
}

.text-button {
    color: #235d44;
    background: transparent;
    border: 0;
    font-weight: 700;
    cursor: pointer;
}

.create-form {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 1rem;
    align-items: end;
    margin-top: 1.25rem;
}

label {
    display: grid;
    gap: 0.4rem;
    color: #445360;
    font-size: 0.84rem;
}

input,
select {
    min-width: 0;
    width: 100%;
    padding: 0.68rem 0.75rem;
    color: #17212b;
    background: #fff;
    border: 1px solid #b9c5cd;
    border-radius: 0.45rem;
}

button {
    font: inherit;
}

button:disabled {
    cursor: not-allowed;
    opacity: 0.48;
}

.primary-button,
.secondary-button,
.danger-button,
.restore-button {
    padding: 0.68rem 0.85rem;
    border-radius: 0.45rem;
    cursor: pointer;
}

.primary-button {
    color: #fff;
    background: #185c3d;
    border: 1px solid #185c3d;
}

.secondary-button {
    color: #243641;
    background: #f7f9fa;
    border: 1px solid #b9c5cd;
}

.danger-button {
    color: #fff;
    background: #a83434;
    border: 1px solid #a83434;
}

.restore-button {
    color: #fff;
    background: #236143;
    border: 1px solid #236143;
}

.management-grid {
    display: grid;
    grid-template-columns: minmax(19rem, 0.8fr) minmax(24rem, 1.2fr);
    gap: 1.25rem;
    align-items: start;
}

.user-list-card {
    overflow: hidden;
}

.list-heading {
    padding: 1.25rem;
    border-bottom: 1px solid #e2e7ea;
}

.user-row {
    width: 100%;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    padding: 0.9rem 1.1rem;
    text-align: left;
    background: #fff;
    border: 0;
    border-bottom: 1px solid #edf0f2;
    cursor: pointer;
}

.user-row:hover,
.user-row.selected {
    background: #f0f6f3;
}

.avatar {
    width: 2.25rem;
    height: 2.25rem;
    display: grid;
    place-items: center;
    color: #fff;
    background: #315b48;
    border-radius: 50%;
    font-weight: 800;
}

.user-row-copy {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
}

.user-row-copy strong,
.user-row-copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.user-row-copy span {
    color: #667784;
    font-size: 0.8rem;
}

.user-row-copy small {
    margin-left: 0.35rem;
    color: #667784;
    font-weight: 500;
}

.badges,
.action-row {
    display: flex;
    flex-wrap: wrap;
}

.badge,
.last-admin-badge {
    padding: 0.2rem 0.45rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 700;
}

.badge.role {
    color: #324b60;
    background: #e8eef3;
}

.badge.active {
    color: #17613c;
    background: #ddf5e7;
}

.badge.disabled {
    color: #923737;
    background: #fbe2e2;
}

.detail-card {
    padding: 1.4rem;
}

.last-admin-badge {
    color: #7d4d00;
    background: #fff0c9;
}

dl {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr);
    gap: 0.7rem;
    margin: 1.4rem 0;
}

dt {
    color: #6b7b87;
}

dd {
    margin: 0;
    overflow-wrap: anywhere;
}

.constraint-note {
    padding: 0.75rem;
    color: #795400;
    background: #fff6dc;
    border-radius: 0.45rem;
    font-size: 0.85rem;
}

.operation-section {
    padding: 1.1rem 0;
    border-top: 1px solid #e4e9ec;
}

.operation-section h3 {
    margin: 0 0 0.65rem;
    font-size: 0.95rem;
}

.operation-section p {
    margin: -0.25rem 0 0.75rem;
    color: #6b7b87;
    font-size: 0.82rem;
    line-height: 1.5;
}

.inline-operation input,
.inline-operation select {
    flex: 1;
}

.danger-zone {
    padding-bottom: 0;
}

.empty-state,
.empty-detail {
    padding: 2rem;
    color: #6b7b87;
    text-align: center;
}

@media (max-width: 960px) {
    .create-form {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .management-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 620px) {
    .admin-shell {
        padding: 2rem 1rem 3rem;
    }

    .page-header {
        display: grid;
    }

    .secondary-link {
        width: fit-content;
    }

    .create-form {
        grid-template-columns: 1fr;
    }

    .user-row {
        grid-template-columns: auto minmax(0, 1fr);
    }

    .badges {
        grid-column: 2;
    }

    .inline-operation {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
