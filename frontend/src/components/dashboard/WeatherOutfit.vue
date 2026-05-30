<script setup lang="ts">
import { useWeather } from '../../composables/useWeather'

const { weather, outfit, loading, error, weatherEmoji } = useWeather()
</script>

<template>
  <!-- API 키 미설정이면 렌더링 안 함 -->
  <div v-if="weather || loading || error" class="weather-outfit">
    <!-- 로딩 -->
    <div v-if="loading" class="weather-outfit__loading">
      날씨 정보를 불러오는 중...
    </div>

    <!-- 에러 -->
    <div v-else-if="error" class="weather-outfit__error">
      날씨 정보를 불러올 수 없습니다
    </div>

    <!-- 정상 -->
    <template v-else-if="weather && outfit">
      <div class="weather-outfit__header">
        <span class="weather-outfit__icon">{{ weatherEmoji(weather.icon) }}</span>
        <div class="weather-outfit__info">
          <span class="weather-outfit__temp">{{ weather.temp }}°C</span>
          <span class="weather-outfit__meta">{{ weather.city }} · {{ weather.description }}</span>
        </div>
      </div>
      <div class="weather-outfit__recommend">
        {{ outfit.emoji }} {{ outfit.clothes }}
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.weather-outfit {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.weather-outfit__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.weather-outfit__icon {
  font-size: 36px;
  line-height: 1;
}

.weather-outfit__info {
  display: flex;
  flex-direction: column;
}

.weather-outfit__temp {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
}

.weather-outfit__meta {
  font-size: 13px;
  color: #9ca3af;
}

.weather-outfit__recommend {
  background: #f0f4ff;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: #3c69db;
}

.weather-outfit__loading,
.weather-outfit__error {
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
  padding: 8px 0;
}
</style>
