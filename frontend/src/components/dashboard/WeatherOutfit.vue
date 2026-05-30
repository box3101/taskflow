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
      <div class="weather-outfit__icon">{{ weatherEmoji(weather.icon) }}</div>
      <div class="weather-outfit__temp">{{ weather.temp }}°C</div>
      <div class="weather-outfit__feeling">{{ weather.feeling }} · {{ weather.description }}</div>
      <div class="weather-outfit__recommend">
        {{ outfit.emoji }} {{ outfit.clothes }}
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.weather-outfit {
  flex-shrink: 0;
  background: #fff;
  border-radius: 12px;
  padding: 10px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.weather-outfit__icon {
  font-size: 24px;
  line-height: 1;
}

.weather-outfit__temp {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}

.weather-outfit__feeling {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.weather-outfit__recommend {
  width: 100%;
  background: #f0f4ff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: #3c69db;
  text-align: center;
}

.weather-outfit__placeholder {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  padding: 8px 0;
}

@media (max-width: 640px) {
  .weather-outfit {
    flex-wrap: wrap;
    gap: 6px;
  }

  .weather-outfit__recommend {
    width: 100%;
  }
}
</style>
