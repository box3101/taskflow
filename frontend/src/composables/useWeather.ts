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

// 날씨 상태 → 이모지
function conditionEmoji(condition: string, isNight: boolean): string {
  const c = condition.toLowerCase()
  if (c.includes('snow')) return '❄️'
  if (c.includes('thunder')) return '⛈️'
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧️'
  if (c.includes('fog') || c.includes('mist')) return '🌫️'
  if (c.includes('cloud') || c.includes('overcast')) return '☁️'
  if (c.includes('partly')) return '⛅'
  return isNight ? '🌙' : '☀️'
}

// 날씨 상태 한글 변환
function conditionKorean(condition: string): string {
  const c = condition.toLowerCase()
  if (c.includes('heavy snow')) return '대설'
  if (c.includes('snow')) return '눈'
  if (c.includes('thunder')) return '천둥번개'
  if (c.includes('heavy rain')) return '폭우'
  if (c.includes('rain') || c.includes('drizzle')) return '비'
  if (c.includes('shower')) return '소나기'
  if (c.includes('fog') || c.includes('mist')) return '안개'
  if (c.includes('overcast')) return '흐림'
  if (c.includes('cloud')) return '구름많음'
  if (c.includes('partly')) return '구름조금'
  if (c.includes('sunny') || c.includes('clear')) return '맑음'
  return condition
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
      const res = await fetch('https://wttr.in/?format=j1', {
        headers: { 'Accept': 'application/json' },
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      const current = data.current_condition[0]
      const temp = parseInt(current.temp_C)
      const condition = current.weatherDesc[0].value
      const city = data.nearest_area[0].areaName[0].value
      const hour = new Date().getHours()
      const isNight = hour < 6 || hour >= 19

      const result: WeatherData = {
        temp,
        description: conditionKorean(condition),
        icon: conditionEmoji(condition, isNight),
        city,
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
