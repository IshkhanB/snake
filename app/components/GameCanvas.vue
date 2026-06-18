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
      <UpgradePanel
        v-if="showUpgrades"
        :coins="coins"
        :levels="upgrades.levels.value"
        @buy="upgrades.buyUpgrade"
        @close="toggleUpgrades"
      />
    </div>
    <GameStats
      :score="score"
      :high-score="highScore"
      :speed="speed"
      :boost-energy="boostEnergy"
      :is-boosting="isBoosting"
      :coins="coins"
      :shields="shields"
      :enemy-score="enemyScore"
      :enemy-active="enemyActive"
    >
      <button
        class="upgrades-toggle-btn"
        title="Улучшения змейки"
        @click="toggleUpgrades"
      >
        🏪 Улучшения
      </button>
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
      <button
        class="enemy-toggle-btn"
        :class="{ 'enemy-toggle-btn--active': enemyActive }"
        :title="enemyActive ? 'Убрать противника' : 'Добавить AI-противника'"
        @click="handleEnemyToggle"
      >
        🤖 {{ enemyActive ? 'Убрать' : 'Противник' }}
      </button>
    </GameStats>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { GameState, DEFAULT_GAME_OPTIONS, DIRECTION_VECTOR } from '~/types/game'
import { useSnakeLogic } from '~/composables/useSnakeLogic'
import { useScore } from '~/composables/useScore'
import { useInput } from '~/composables/useInput'
import { useRender3D } from '~/composables/useRender3D'
import { useGameLoop } from '~/composables/useGameLoop'
import { useBonusFood } from '~/composables/useBonusFood'
import { useObstacles } from '~/composables/useObstacles'
import { useEnemy } from '~/composables/useEnemy'
import { useBoost, BOOST_MULTIPLIER } from '~/composables/useBoost'
import { useUpgrades } from '~/composables/useUpgrades'
import GameStats from './GameStats.vue'
import UpgradePanel from './UpgradePanel.vue'

// SSR-safe: рендерим только после маунта на клиенте
const mounted = ref(false)

const options = DEFAULT_GAME_OPTIONS
const grid = {
  cols: options.gridCols,
  rows: options.gridRows,
  cellSize: options.cellSize,
}

const canvasRef = ref<HTMLCanvasElement | null>(null)

const upgrades = useUpgrades()

const snake = useSnakeLogic(grid)
const scoreManager = useScore(
  options.initialSpeed,
  options.speedIncrement,
  options.scorePerSpeedUp,
  () => 1 + upgrades.getLevel('scoreMult') * 0.25,
)
const bonusFood = useBonusFood(grid)
const obstacles = useObstacles(grid)
const enemy = useEnemy(grid)
const boost = useBoost(
  () => 100 + upgrades.getLevel('boostEnergy') * 20,
  () => 0.4 + upgrades.getLevel('regen') * 0.15,
)

const gameState = ref<GameState>(GameState.IDLE)
const isNewRecord = ref(false)

/** Количество щитов, доступных в текущей игре (на основе улучшения) */
let shieldsRemaining = 0

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
const enemyActive = computed(() => enemy.active.value)
const enemyScore = computed(() => enemy.score.value)

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
    [...enemy.enemySnake.value],
  )
}

const handleEnemyToggle = () => {
  enemy.toggle()
  renderer.render(
    gameState.value,
    [...snake.snake.value],
    { ...snake.food.value },
    [...bonusFood.bonusFoods.value],
    [...obstacles.obstacles.value],
    [...snake.prevSnake.value],
    0,
    [...enemy.enemySnake.value],
  )
}

/** Счётчик тиков — нужен, чтобы противник двигался только в "свои" тики,
 *  а не каждый ускоренный тик игрока. При бусте игровой цикл тикает в 2× чаще,
 *  поэтому противник должен пропускать каждый второй тик. */
let tickCounter = 0

const gameLoop = useGameLoop(
  () => {
    if (gameState.value !== GameState.PLAYING) return

    tickCounter++

    // Обновляем энергию ускорения каждый тик
    boost.updatePerTick()

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
        // Бонусный шар полностью заполняет энергию буста
        boost.refill()
      }
    }

    // Спавн и удаление бонусов
    bonusFood.trySpawnBonus([...snake.snake.value])
    bonusFood.removeExpiredBonuses()

    // Двигаем противника, если активен.
    // При бусте игрока цикл тикает в 2× чаще — противник двигается
    // только в чётные тики, сохраняя свою обычную скорость.
    const shouldEnemyMove = !boost.isBoosting.value || tickCounter % 2 === 0
    if (enemy.active.value && shouldEnemyMove) {
      const enemyAte = enemy.move(
        [...snake.snake.value],
        { ...snake.food.value },
        [...obstacles.obstacles.value],
      )
      if (enemyAte) {
        snake.spawnFood()
      }
      // Проверяем столкновение противника с игроком или препятствиями
      if (enemy.checkCollision([...snake.snake.value], [...obstacles.obstacles.value])) {
        // Противник умер — просто убираем его
        enemy.toggle()
      }
    }

    // Проверка столкновения игрока с противником
    let hitEnemy = false
    if (enemy.active.value) {
      const playerHead = snake.snake.value[0]
      if (playerHead) {
        for (const seg of enemy.enemySnake.value) {
          if (seg.x === playerHead.x && seg.y === playerHead.y) {
            hitEnemy = true
            break
          }
        }
      }
    }

    if (hitEnemy || snake.checkCollision([...obstacles.obstacles.value])) {
      // Щит спасает от смерти (на основе уровня улучшения)
      if (shieldsRemaining > 0) {
        shieldsRemaining--
        // Отбрасываем змейку на предыдущую позицию головы
        const playerHead = snake.snake.value[0]
        if (playerHead && snake.snake.value.length > 1) {
          const vec = DIRECTION_VECTOR[snake.direction.value]
          const prevX = ((playerHead.x - vec.x + grid.cols) % grid.cols)
          const prevY = ((playerHead.y - vec.y + grid.rows) % grid.rows)
          snake.snake.value[0] = { ...playerHead, x: prevX, y: prevY }
        }
      } else {
        gameState.value = GameState.GAME_OVER
        scoreManager.saveHighScore()
        isNewRecord.value = scoreManager.score.value >= scoreManager.highScore.value
        // Начисляем монеты за игру (1 монета за каждые 5 очков)
        upgrades.addCoins(Math.floor(scoreManager.score.value / 5))
        boost.cancelBoost()
        gameLoop.stop()
        renderer.stopRender()
      }
    }
  },
  () => {
    // Скорость игрока: базовая × множитель буста (если активен)
    const baseSpeed = scoreManager.speed.value
    return boost.isBoosting.value ? baseSpeed * BOOST_MULTIPLIER : baseSpeed
  },
  gameState,
)

const togglePause = () => {
  if (gameState.value === GameState.PLAYING) {
    gameState.value = GameState.PAUSED
    boost.cancelBoost()
    gameLoop.stop()
  } else if (gameState.value === GameState.PAUSED) {
    gameState.value = GameState.PLAYING
    gameLoop.resume()
  }
}

const handleStart = () => {
  const startLength = 3 + upgrades.getLevel('length')
  shieldsRemaining = upgrades.getLevel('shield')
  snake.reset(startLength)
  scoreManager.reset()
  bonusFood.reset()
  obstacles.reset()
  boost.reset()
  if (enemy.active.value) {
    enemy.reset()
  }
  isNewRecord.value = false
  tickCounter = 0
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
    () => [...enemy.enemySnake.value],
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
  boost.startBoost,
  boost.endBoost,
)

const score = computed(() => scoreManager.score.value)
const highScore = computed(() => scoreManager.highScore.value)
const speed = computed(() => scoreManager.speed.value)
const boostEnergy = computed(() => boost.energy.value)
const isBoosting = computed(() => boost.isBoosting.value)
const coins = computed(() => upgrades.coins.value)
const shields = computed(() => shieldsRemaining)

const showUpgrades = ref(false)
const toggleUpgrades = () => {
  showUpgrades.value = !showUpgrades.value
  // Открываем панель только вне активного геймплея (паузим игру)
  if (showUpgrades.value && gameState.value === GameState.PLAYING) {
    togglePause()
  }
}

onMounted(async () => {
  // 1. Разрешаем рендеринг шаблона (canvas появится в DOM)
  mounted.value = true
  // 2. Ждём, пока Vue привяжет template ref к DOM-элементу
  await nextTick()
  // 3. Теперь canvasRef.value гарантированно не null
  renderer.initCanvas()
  snake.reset(3 + upgrades.getLevel('length'))
  renderer.render(GameState.IDLE, [...snake.snake.value], { ...snake.food.value }, [], [], [], 0, [])
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

.upgrades-toggle-btn {
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: rgba(106, 13, 173, 0.85);
  border: 1px solid rgba(168, 85, 247, 0.6);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upgrades-toggle-btn:hover {
  background: rgba(168, 85, 247, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.5);
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

.enemy-toggle-btn {
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 100, 60, 0.85);
  border: 1px solid rgba(0, 170, 85, 0.6);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.enemy-toggle-btn:hover {
  background: rgba(0, 170, 85, 0.9);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 170, 85, 0.5);
}

.enemy-toggle-btn--active {
  background: rgba(0, 255, 136, 0.25);
  border-color: rgba(0, 255, 136, 0.8);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
