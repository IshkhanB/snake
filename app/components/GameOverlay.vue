<template>
  <div class="overlay" :class="{ 'overlay--hidden': !visible }" role="dialog" aria-modal="true">
    <div class="overlay__content">
      <!-- Start Screen -->
      <div v-if="state === GameStateEnum.IDLE" class="overlay__screen">
        <h1 class="overlay__title">🐍 Snake Game</h1>
        <p class="overlay__subtitle">Управление: стрелки / WASD / свайпы</p>
        <p class="overlay__hint">Пауза: P или Space</p>
        <button
          class="overlay__btn"
          @click="$emit('start')"
          autofocus
          aria-label="Начать игру"
        >
          Начать игру
        </button>
        <p v-if="highScore > 0" class="overlay__highscore">
          🏆 Рекорд: {{ highScore }}
        </p>
      </div>

      <!-- Pause Screen -->
      <div v-else-if="state === GameStateEnum.PAUSED" class="overlay__screen">
        <h2 class="overlay__title">⏸ Пауза</h2>
        <p class="overlay__subtitle">Счёт: {{ score }}</p>
        <button
          class="overlay__btn"
          @click="$emit('resume')"
          autofocus
          aria-label="Продолжить игру"
        >
          Продолжить
        </button>
      </div>

      <!-- Game Over Screen -->
      <div v-else-if="state === GameStateEnum.GAME_OVER" class="overlay__screen">
        <h2 class="overlay__title">💀 Game Over</h2>
        <p class="overlay__score">Счёт: {{ score }}</p>
        <p class="overlay__highscore">
          🏆 Рекорд: {{ highScore }}
          <span v-if="isNewRecord" class="overlay__new-record">Новый рекорд!</span>
        </p>
        <button
          class="overlay__btn"
          @click="$emit('restart')"
          autofocus
          aria-label="Играть снова"
        >
          Играть снова
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { GameState } from '~/types/game'

// Экспортируем GameState для использования в шаблоне
const GameStateEnum = GameState

const props = defineProps<{
  state: GameState
  score: number
  highScore: number
  isNewRecord?: boolean
}>()

defineEmits<{
  start: []
  resume: []
  restart: []
}>()

const visible = computed(() => {
  return props.state !== GameStateEnum.PLAYING
})
</script>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 26, 46, 0.92);
  backdrop-filter: blur(4px);
  z-index: 10;
  transition: opacity 0.3s ease;
}

.overlay--hidden {
  opacity: 0;
  pointer-events: none;
}

.overlay__content {
  text-align: center;
  padding: 2rem;
}

.overlay__title {
  font-size: 2.5rem;
  font-weight: 700;
  color: #e94560;
  margin: 0 0 0.5rem;
  text-shadow: 0 0 20px rgba(233, 69, 96, 0.4);
}

.overlay__subtitle {
  font-size: 1rem;
  color: #a0a0b8;
  margin: 0 0 0.25rem;
}

.overlay__hint {
  font-size: 0.85rem;
  color: #6a6a80;
  margin: 0 0 1.5rem;
}

.overlay__score {
  font-size: 1.5rem;
  color: #ffffff;
  margin: 0.5rem 0;
}

.overlay__highscore {
  font-size: 1.1rem;
  color: #ffd700;
  margin: 0.5rem 0 1.5rem;
}

.overlay__new-record {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.15rem 0.5rem;
  background: #e94560;
  color: #fff;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  animation: pulse 1s ease-in-out infinite;
}

.overlay__btn {
  display: inline-block;
  padding: 0.75rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  background: #e94560;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(233, 69, 96, 0.3);
}

.overlay__btn:hover {
  background: #ff6b81;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(233, 69, 96, 0.5);
}

.overlay__btn:focus-visible {
  outline: 2px solid #ffd700;
  outline-offset: 2px;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
