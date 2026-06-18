<template>
  <div class="stats">
    <div class="stats__row">
      <div class="stats__item">
        <span class="stats__label">Счёт</span>
        <span class="stats__value stats__value--score">{{ score }}</span>
      </div>
      <div class="stats__item">
        <span class="stats__label">Рекорд</span>
        <span class="stats__value stats__value--highscore">{{ highScore }}</span>
      </div>
      <div class="stats__item">
        <span class="stats__label">Скорость</span>
        <span class="stats__value stats__value--speed">{{ speed }}</span>
      </div>
      <div class="stats__item">
        <span class="stats__label">⚡ Буст</span>
        <div class="stats__boost-bar">
          <div
            class="stats__boost-fill"
            :class="{ 'stats__boost-fill--active': isBoosting }"
            :style="{ width: boostEnergy + '%' }"
          />
        </div>
      </div>
      <div class="stats__item">
        <span class="stats__label">🪙 Монеты</span>
        <span class="stats__value stats__value--coins">{{ coins }}</span>
      </div>
      <div v-if="shields > 0" class="stats__item">
        <span class="stats__label">🛡️ Щиты</span>
        <span class="stats__value stats__value--shield">{{ shields }}</span>
      </div>
      <div v-if="enemyActive" class="stats__item">
        <span class="stats__label">🤖 Враг</span>
        <span class="stats__value stats__value--enemy">{{ enemyScore }}</span>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  score: number
  highScore: number
  speed: number
  boostEnergy: number
  isBoosting: boolean
  coins: number
  shields: number
  enemyScore?: number
  enemyActive?: boolean
}>()
</script>

<style scoped>
.stats {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: rgba(15, 15, 35, 0.75);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  min-width: auto;
}

.stats__row {
  display: flex;
  flex-direction: row;
  gap: 1.5rem;
  align-items: center;
}

.stats__item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  align-items: center;
}

.stats__label {
  font-size: 0.7rem;
  color: #6a6a80;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats__value {
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stats__value--score {
  color: #e94560;
  text-shadow: 0 0 10px rgba(233, 69, 96, 0.3);
}

.stats__value--highscore {
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
}

.stats__value--speed {
  color: #4ecdc4;
  text-shadow: 0 0 10px rgba(78, 205, 196, 0.3);
}

.stats__value--enemy {
  color: #00ff88;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.4);
}

.stats__value--coins {
  color: #fbbf24;
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.4);
}

.stats__value--shield {
  color: #60a5fa;
  text-shadow: 0 0 10px rgba(96, 165, 250, 0.5);
}

.stats__boost-bar {
  width: 80px;
  height: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid rgba(255, 200, 0, 0.3);
  margin-top: 0.4rem;
}

.stats__boost-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffb400, #ffd700);
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
  transition: width 0.1s linear;
  border-radius: 5px;
}

.stats__boost-fill--active {
  background: linear-gradient(90deg, #ff4500, #ff8c00);
  box-shadow: 0 0 12px rgba(255, 140, 0, 0.8);
  animation: boost-pulse 0.4s ease-in-out infinite;
}

@keyframes boost-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
