import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  // 응답이 들쭉날쭉한 백엔드 대비: 12초 넘으면 끊고 재시도 (무한 대기 방지)
  timeout: 12000,
})

// 요청마다 JWT 토큰 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 응답 시 로그인 페이지로
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(err)
    }

    // 자동 재시도: GET 요청이 타임아웃/네트워크/서버오류(5xx)로 실패하면 1회만 다시 시도
    // - GET만 재시도 (POST/PUT/DELETE는 중복 실행 위험이 있어 제외)
    // - 백엔드가 0.3~15초로 들쭉날쭉하므로 재시도가 빠른 구간을 잡을 수 있음
    const config = err.config
    const isTimeout = err.code === 'ECONNABORTED'
    const isNetwork = !err.response
    const isServerError = err.response && err.response.status >= 500
    const isRetryable =
      config &&
      config.method === 'get' &&
      !config.__retried &&
      (isTimeout || isNetwork || isServerError)

    if (isRetryable) {
      config.__retried = true
      return api(config)
    }

    return Promise.reject(err)
  },
)

export default api
