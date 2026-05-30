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
      <div class="weather-outfit__desc">{{ weather.description }}</div>
      <div class="weather-outfit__recommend">
        {{ outfit.emoji }} {{ outfit.clothes }}
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.weather-outfit {
  width: 160px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.weather-outfit__icon {
  font-size: 32px;
  line-height: 1;
}

.weather-outfit__temp {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
}

.weather-outfit__desc {
  font-size: 12px;
  color: #9ca3af;
}

.weather-outfit__recommend {
  background: #f0f4ff;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: #3c69db;
  text-align: center;
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
    gap: 8px;
  }

  .weather-outfit__icon {
    font-size: 24px;
  }

  .weather-outfit__temp {
    font-size: 18px;
  }

  .weather-outfit__recommend {
    width: 100%;
  }
}
</style>
