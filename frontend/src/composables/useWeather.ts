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

// 날씨 코드 → 이모지 매핑
function weatherEmoji(icon: string): string {
  return icon
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

// localStorage 캐시
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

function writeCache(data: WeatherData) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
}

// WMO 날씨 코드 → 이모지 + 한글
function wmoToWeather(code: number, isNight: boolean): { emoji: string; description: string } {
  if (code === 0) return { emoji: isNight ? '🌙' : '☀️', description: '맑음' }
  if (code <= 3) return { emoji: '⛅', description: '구름조금' }
  if (code <= 48) return { emoji: '🌫️', description: '안개' }
  if (code <= 57) return { emoji: '🌧️', description: '이슬비' }
  if (code <= 67) return { emoji: '🌧️', description: '비' }
  if (code <= 77) return { emoji: '❄️', description: '눈' }
  if (code <= 82) return { emoji: '🌧️', description: '소나기' }
  if (code <= 86) return { emoji: '❄️', description: '눈' }
  if (code <= 99) return { emoji: '⛈️', description: '천둥번개' }
  return { emoji: '☁️', description: '흐림' }
}

export function useWeather() {
  const weather = ref<WeatherData | null>(null)
  const outfit = ref<OutfitRecommendation | null>(null)
  const loading = ref(false)
  const error = ref(false)

  async function fetchWeather() {
    const cached = readCache()
    if (cached) {
      weather.value = cached
      outfit.value = getOutfit(cached.temp)
      return
    }

    loading.value = true
    error.value = false

    try {
      // Open-Meteo API (무료, 키 불필요, CORS 지원)
      // 서울 좌표 기본값, 위치 정보 사용 가능하면 실제 좌표 사용
      let lat = 37.5665
      let lon = 126.9780

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        })
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      } catch {
        // 위치 권한 거부 시 서울 좌표 사용
      }

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`
      )
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      const temp = Math.round(data.current.temperature_2m)
      const weatherCode = data.current.weather_code
      const hour = new Date().getHours()
      const isNight = hour < 6 || hour >= 19
      const { emoji, description } = wmoToWeather(weatherCode, isNight)

      const result: WeatherData = {
        temp,
        description,
        icon: emoji,
        city: 'Seoul',
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
