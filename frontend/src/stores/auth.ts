import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../api/client'

interface User {
  id: number
  email: string
  name: string
  role: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(
    JSON.parse(localStorage.getItem('user') || 'null'),
  )
  const token = ref(localStorage.getItem('token') || '')

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })
    user.value = data.user
    token.value = data.token
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.setItem('token', data.token)
  }

  function logout() {
    user.value = null
    token.value = ''
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  return { user, token, login, logout }
})
