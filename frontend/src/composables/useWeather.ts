import { ref, onMounted } from 'vue'

interface WeatherData {
  temp: number
  description: string
  icon: string
  city: string
}

interface OutfitRecommendation {
  clothes: string
  emoji: string
}

const CACHE_KEY = 'weather-cache'
const CACHE_DURATION = 30 * 60 * 1000 // 30분

// 서울 기본 좌표 (위치 권한 거부 시 fallback)
const DEFAULT_LAT = 37.5665
const DEFAULT_LON = 126.978

// 날씨 아이콘 코드 → 이모지 매핑
function weatherEmoji(icon: string): string {
  const map: Record<string, string> = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '❄️', '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️',
  }
  return map[icon] || '🌤️'
}

// 기온 구간별 옷차림 매핑
function getOutfit(temp: number): OutfitRecommendation {
  if (temp >= 28) return { clothes: '민소매, 반팔, 반바지, 원피스', emoji: '👕' }
  if (temp >= 23) return { clothes: '반팔, 얇은 셔츠, 면바지', emoji: '👕' }
  if (temp >= 17) return { clothes: '가디건, 얇은 니트, 긴바지', emoji: '🧥' }
  if (temp >= 12) return { clothes: '자켓, 가디건, 스웨터', emoji: '🧥' }
  if (temp >= 5) return { clothes: '코트, 히트텍, 니트', emoji: '🧣' }
  return { clothes: '패딩, 두꺼운 코트, 목도리, 장갑', emoji: '🧣' }
}

// localStorage 캐시 읽기
function readCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_DURATION) return null
    return data as WeatherData
  } catch {
    return null
  }
}

// localStorage 캐시 쓰기
function writeCache(data: WeatherData) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
}

// 브라우저 위치 가져오기
function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ lat: DEFAULT_LAT, lon: DEFAULT_LON }),
      { timeout: 5000 }
    )
  })
}

export function useWeather() {
  const weather = ref<WeatherData | null>(null)
  const outfit = ref<OutfitRecommendation | null>(null)
  const loading = ref(false)
  const error = ref(false)

  async function fetchWeather() {
    const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY
    if (!apiKey) return // API 키 미설정 시 아무것도 안 함

    // 캐시 확인
    const cached = readCache()
    if (cached) {
      weather.value = cached
      outfit.value = getOutfit(cached.temp)
      return
    }

    loading.value = true
    error.value = false

    try {
      const { lat, lon } = await getPosition()
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`
      const res = await fetch(url)
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      const result: WeatherData = {
        temp: Math.round(data.main.temp),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        city: data.name,
      }

      weather.value = result
      outfit.value = getOutfit(result.temp)
      writeCache(result)
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  onMounted(fetchWeather)

  return {
    weather,
    outfit,
    loading,
    error,
    weatherEmoji,
  }
}
