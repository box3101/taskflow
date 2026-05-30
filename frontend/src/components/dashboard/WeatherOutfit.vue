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
      <div class="weather-outfit__row1">
        <span class="weather-outfit__icon">{{ weatherEmoji(weather.icon) }}</span>
        <span class="weather-outfit__temp">{{ weather.temp }}°C</span>
      </div>
      <div class="weather-outfit__row2">{{ weather.feeling }} · {{ weather.description }}</div>
      <div class="weather-outfit__row3">{{ outfit.emoji }} {{ outfit.clothes }}</div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.weather-outfit {
  flex-shrink: 0;
  width: 140px;
  background: linear-gradient(135deg, #f0f4ff 0%, #e8eeff 100%);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.weather-outfit__row1 {
  display: flex;
  align-items: center;
  gap: 6px;
}

.weather-outfit__icon {
  font-size: 28px;
  line-height: 1;
}

.weather-outfit__temp {
  font-size: 22px;
  font-weight: 800;
  color: #1e293b;
  letter-spacing: -0.5px;
}

.weather-outfit__row2 {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.weather-outfit__row3 {
  font-size: 11px;
  color: #3b6df0;
  background: rgba(59, 109, 240, 0.1);
  border-radius: 20px;
  padding: 3px 10px;
  margin-top: 2px;
}

.weather-outfit__placeholder {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  padding: 8px 0;
}

@media (max-width: 640px) {
  .weather-outfit {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    padding: 10px 14px;
    gap: 6px;
  }
  .weather-outfit__row3 { width: auto; }
}
</style>
