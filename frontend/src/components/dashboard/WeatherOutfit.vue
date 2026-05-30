<script setup lang="ts">
import { useWeather } from '../../composables/useWeather'

const { weather, outfit, loading, error, weatherEmoji } = useWeather()
</script>

<template>
  <div v-if="weather || loading || error" class="weather-outfit">
    <!-- 로딩 -->
    <div v-if="loading" class="weather-outfit__placeholder">
      날씨 정보를 불러오는 중...
    </div>

    <!-- 에러 -->
    <div v-else-if="error" class="weather-outfit__placeholder">
      날씨 정보를 불러올 수 없습니다
    </div>

    <!-- 정상 -->
    <template v-else-if="weather && outfit">
      <span class="weather-outfit__main">
        {{ weatherEmoji(weather.icon) }} {{ weather.temp }}°C {{ weather.feeling }} · {{ weather.description }}
      </span>
      <span class="weather-outfit__divider">|</span>
      <span class="weather-outfit__recommend">{{ outfit.emoji }} {{ outfit.clothes }}</span>
    </template>
  </div>
</template>

<style scoped lang="scss">
.weather-outfit {
  flex-shrink: 0;
  background: #fff;
  border-radius: 12px;
  padding: 8px 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  white-space: nowrap;
}

.weather-outfit__main {
  font-weight: 600;
  color: #374151;
}

.weather-outfit__divider {
  color: #d1d5db;
}

.weather-outfit__recommend {
  color: #3c69db;
  font-size: 12px;
}

.weather-outfit__placeholder {
  font-size: 12px;
  color: #9ca3af;
  padding: 4px 0;
}

@media (max-width: 640px) {
  .weather-outfit {
    flex-wrap: wrap;
    white-space: normal;
    gap: 4px;
  }
  .weather-outfit__divider { display: none; }
  .weather-outfit__recommend { width: 100%; }
}
</style>
