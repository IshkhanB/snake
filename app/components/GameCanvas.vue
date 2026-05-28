<template>
  <div
    v-if="mounted"
    class="game-wrapper"
    role="application"
    aria-label="Игра Змейка"
    tabindex="0"
  >
    <div class="game-container">
      <canvas ref="canvasRef" class="game-canvas" />
      <GameOverlay
        :state="gameState"
        :score="score"
        :high-score="highScore"
        :is-new-record="isNewRecord"
        @start="handleStart"
        @resume="handleResume"
        @restart="handleRestart"
      />
    </div>
    <GameStats
      :score="score"
      :high-score="highScore"
      :speed="speed"
    >
      <button
        class="camera-toggle-btn"
        :title="`Вид камеры: ${cameraViewLabel}`"
        @click="handleCameraToggle"
      >
        📷 {{ cameraViewLabel }}
      </button>
      <button
        class="obstacle-toggle-btn"
        :class="{ 'obstacle-toggle-btn--active': obstaclesActive }"
        :title="obstaclesActive ? 'Убрать препятствия' : 'Добавить случайные препятствия'"
        @click="handleObstacleToggle"
      >
        🧱 {{ obstaclesActive ? 'Убрать' : 'Препятствия' }}
      </button>
    </GameStats>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { GameState, DEFAULT_GAME_OPTIONS } from '~/types/game'
import { useSnakeLogic } from '~/composables/useSnakeLogic'
import { useScore } from '~/composables/useScore'
import { useInput } from '~/composables/useInput'
import { useRender3D } from '~/composables/useRender3D'
import { useGameLoop } from '~/composables/useGameLoop'
import { useBonusFood } from '~/composables/useBonusFood'
import { useObstacles } from '~/composables/useObstacles'
import GameStats from './GameStats.vue'

// SSR-safe: рендерим только после маунта на клиенте
const mounted = ref(false)

const options = DEFAULT_GAME_OPTIONS
const grid = {
  cols: options.gridCols,
  rows: options.gridRows,
  cellSize: options.cellSize,
}

const canvasRef = ref<HTMLCanvasElement | null>(null)

const snake = useSnakeLogic(grid)
const scoreManager = useScore(options.initialSpeed, options.speedIncrement, options.scorePerSpeedUp)
const bonusFood = useBonusFood(grid)
const obstacles = useObstacles(grid)

const gameState = ref<GameState>(GameState.IDLE)
const isNewRecord = ref(false)

const renderer = useRender3D(canvasRef, grid)

const cameraViewLabel = computed(() => {
  const labels: Record<string, string> = {
    isometric: 'Изометрия',
    top: 'Сверху',
    side: 'Сбоку',
    follow: 'Следование',
  }
  return labels[renderer.currentView.value] ?? renderer.currentView.value
})

const handleCameraToggle = () => {
  renderer.cycleCameraView()
}

const obstaclesActive = computed(() => obstacles.active.value)

const handleObstacleToggle = () => {
  obstacles.toggleRandom([...snake.snake.value], { ...snake.food.value })
  renderer.render(
    gameState.value,
    [...snake.snake.value],
    { ...snake.food.value },
    [...bonusFood.bonusFoods.value],
    [...obstacles.obstacles.value],
    [...snake.prevSnake.value],
    0,
  )
}

const gameLoop = useGameLoop(
  () => {
    if (gameState.value !== GameState.PLAYING) return

    const ate = snake.move()
    if (ate) {
      scoreManager.addScore(1)
      snake.spawnFood()
    }

    // Проверяем бонусные фрукты
    const head = snake.snake.value[0]
    if (head) {
      const bonusPoints = bonusFood.checkBonusEat(head.x, head.y)
      if (bonusPoints > 0) {
        scoreManager.addScore(bonusPoints, false)
      }
    }

    // Спавн и удаление бонусов
    bonusFood.trySpawnBonus([...snake.snake.value])
    bonusFood.removeExpiredBonuses()

    if (snake.checkCollision([...obstacles.obstacles.value])) {
      gameState.value = GameState.GAME_OVER
      scoreManager.saveHighScore()
      isNewRecord.value = scoreManager.score.value >= scoreManager.highScore.value
      gameLoop.stop()
      renderer.stopRender()
    }
  },
  () => scoreManager.speed.value,
  gameState,
)

const togglePause = () => {
  if (gameState.value === GameState.PLAYING) {
    gameState.value = GameState.PAUSED
    gameLoop.stop()
  } else if (gameState.value === GameState.PAUSED) {
    gameState.value = GameState.PLAYING
    gameLoop.resume()
  }
}

const handleStart = () => {
  snake.reset()
  scoreManager.reset()
  bonusFood.reset()
  obstacles.reset()
  isNewRecord.value = false
  gameState.value = GameState.PLAYING
  gameLoop.start()
  renderer.startRender(
    () => gameState.value,
    () => [...snake.snake.value],
    () => ({ ...snake.food.value }),
    () => [...bonusFood.bonusFoods.value],
    () => [...obstacles.obstacles.value],
    () => [...snake.prevSnake.value],
    () => gameLoop.getInterpolation(),
  )
}

const handleResume = () => {
  gameState.value = GameState.PLAYING
  gameLoop.resume()
}

const handleRestart = () => {
  handleStart()
}

useInput(
  snake.setDirection,
  togglePause,
  handleStart,
  () => renderer.currentView.value === 'follow',
  () => snake.direction.value,
)

const score = computed(() => scoreManager.score.value)
const highScore = computed(() => scoreManager.highScore.value)
const speed = computed(() => scoreManager.speed.value)

onMounted(async () => {
  // 1. Разрешаем рендеринг шаблона (canvas появится в DOM)
  mounted.value = true
  // 2. Ждём, пока Vue привяжет template ref к DOM-элементу
  await nextTick()
  // 3. Теперь canvasRef.value гарантированно не null
  renderer.initCanvas()
  snake.reset()
  renderer.render(GameState.IDLE, [...snake.snake.value], { ...snake.food.value }, [], [])
})

onUnmounted(() => {
  gameLoop.stop()
  renderer.stopRender()
})
</script>

<style scoped>
.game-wrapper {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.game-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.camera-toggle-btn {
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: rgba(15, 52, 96, 0.85);
  border: 1px solid rgba(233, 69, 96, 0.4);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.camera-toggle-btn:hover {
  background: rgba(233, 69, 96, 0.7);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
}

.camera-toggle-btn:focus-visible {
  outline: 2px solid #ffd700;
  outline-offset: 2px;
}

.obstacle-toggle-btn {
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: rgba(139, 69, 19, 0.85);
  border: 1px solid rgba(139, 69, 19, 0.6);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.obstacle-toggle-btn:hover {
  background: rgba(160, 82, 45, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.5);
}

.obstacle-toggle-btn--active {
  background: rgba(233, 69, 96, 0.85);
  border-color: rgba(233, 69, 96, 0.8);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
