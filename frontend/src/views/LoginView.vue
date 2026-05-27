<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { UiInput, UiButton } from '@leechanyong/ispark-ui'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('chanyong@test.com')
const password = ref('1234')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push('/')
  } catch (err: any) {
    error.value = err.response?.data?.message || '로그인에 실패했습니다.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">TaskFlow</h1>
      <p class="login-desc">프로젝트 관리 시작하기</p>

      <form @submit.prevent="onSubmit" class="login-form">
        <UiInput
          v-model="email"
          label="이메일"
          type="email"
          size="auth"
          placeholder="이메일을 입력하세요"
          clearable
        />
        <UiInput
          v-model="password"
          label="비밀번호"
          type="password"
          size="auth"
          placeholder="비밀번호를 입력하세요"
          show-password-toggle
        />
        <p v-if="error" class="login-error">{{ error }}</p>
        <UiButton
          type="submit"
          variant="primary"
          size="lg"
          full-width
          :loading="loading"
        >로그인</UiButton>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f6f8;
}
.login-card {
  width: 100%;
  max-width: 400px;
  padding: 48px 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.login-title {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 4px;
}
.login-desc {
  font-size: 14px;
  color: #6b7280;
  text-align: center;
  margin-bottom: 32px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.login-error {
  font-size: 13px;
  color: #ef4444;
}
</style>
