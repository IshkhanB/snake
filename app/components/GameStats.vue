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
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  score: number
  highScore: number
  speed: number
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
</style>
