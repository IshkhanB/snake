import { ref, readonly } from 'vue'
import type { Obstacle, GridConfig, SnakeSegment, Food } from '~/types/game'

/**
 * Composable для управления препятствиями на поле.
 * Препятствия размещаются случайно при активации и вызывают game over при столкновении.
 */
export function useObstacles(grid: GridConfig) {
  /** Массив препятствий на поле */
  const obstacles = ref<Obstacle[]>([])

  /** Активен ли режим препятствий */
  const active = ref(false)

  /** Счётчик для генерации ID */
  let obstacleIdCounter = 0

  /** Количество препятствий при случайной генерации */
  const RANDOM_COUNT = 40

  /**
   * Переключить состояние препятствий:
   * если неактивны — спавним случайно, если активны — очищаем.
   */
  const toggleRandom = (snake: SnakeSegment[], food: Food) => {
    if (active.value) {
      obstacles.value = []
      active.value = false
    } else {
      spawnRandom(snake, food)
      active.value = true
    }
  }

  /**
   * Разместить RANDOM_COUNT препятствий в случайных свободных ячейках.
   * Не размещает на занятых ячейках (змея, еда).
   */
  const spawnRandom = (snake: SnakeSegment[], food: Food) => {
    obstacles.value = []

    const occupied = new Set<string>()
    for (const s of snake) occupied.add(`${s.x},${s.y}`)
    occupied.add(`${food.x},${food.y}`)

    const totalCells = grid.cols * grid.rows
    if (occupied.size >= totalCells) return

    // Собираем все свободные ячейки и выбираем из них случайные
    const freeCells: { x: number; y: number }[] = []
    for (let x = 0; x < grid.cols; x++) {
      for (let y = 0; y < grid.rows; y++) {
        if (!occupied.has(`${x},${y}`)) {
          freeCells.push({ x, y })
        }
      }
    }

    // Перемешиваем (Fisher-Yates)
    for (let i = freeCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = freeCells[i]!
      freeCells[i] = freeCells[j]!
      freeCells[j] = tmp!
    }

    const count = Math.min(RANDOM_COUNT, freeCells.length)
    for (let i = 0; i < count; i++) {
      const cell = freeCells[i]!
      obstacles.value.push({ x: cell.x, y: cell.y, id: obstacleIdCounter++ })
    }
  }

  /**
   * Очистить все препятствия.
   */
  const clearAll = () => {
    obstacles.value = []
    active.value = false
  }

  /**
   * Сбросить состояние (при новой игре).
   */
  const reset = () => {
    obstacles.value = []
    active.value = false
  }

  return {
    obstacles: readonly(obstacles),
    active: readonly(active),
    toggleRandom,
    spawnRandom,
    clearAll,
    reset,
  }
}
