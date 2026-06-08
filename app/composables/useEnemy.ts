import { ref, readonly } from 'vue'
import type { Coordinate, SnakeSegment, Food, GridConfig, Obstacle } from '~/types/game'
import { Direction, DIRECTION_VECTOR } from '~/types/game'

/**
 * Composable для управления AI-противником.
 * Использует BFS для поиска пути к еде, избегая столкновений.
 */
export function useEnemy(grid: GridConfig) {
  const enemySnake = ref<SnakeSegment[]>([])
  const direction = ref<Direction>(Direction.LEFT)
  const score = ref(0)
  const active = ref(false)

  let segmentIdCounter = 0

  const reset = () => {
    const startX = Math.floor(grid.cols * 0.75)
    const startY = Math.floor(grid.rows * 0.75)

    enemySnake.value = [
      { x: startX, y: startY, id: segmentIdCounter++ },
      { x: startX + 1, y: startY, id: segmentIdCounter++ },
      { x: startX + 2, y: startY, id: segmentIdCounter++ },
    ]
    direction.value = Direction.LEFT
    score.value = 0
  }

  /**
   * BFS для поиска кратчайшего пути от start до target.
   * Возвращает первое направление для движения или null, если путь не найден.
   */
  const findPath = (
    start: Coordinate,
    target: Coordinate,
    obstacles: Set<string>,
  ): Direction | null => {
    const queue: Array<{ pos: Coordinate; firstDir: Direction | null }> = [
      { pos: start, firstDir: null },
    ]
    const visited = new Set<string>()
    visited.add(`${start.x},${start.y}`)

    const directions: Direction[] = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]

    while (queue.length > 0) {
      const current = queue.shift()!

      if (current.pos.x === target.x && current.pos.y === target.y) {
        return current.firstDir
      }

      for (const dir of directions) {
        const vec = DIRECTION_VECTOR[dir]
        const nextX = current.pos.x + vec.x
        const nextY = current.pos.y + vec.y

        const wrappedX = ((nextX % grid.cols) + grid.cols) % grid.cols
        const wrappedY = ((nextY % grid.rows) + grid.rows) % grid.rows

        const key = `${wrappedX},${wrappedY}`

        if (visited.has(key) || obstacles.has(key)) {
          continue
        }

        visited.add(key)
        queue.push({
          pos: { x: wrappedX, y: wrappedY },
          firstDir: current.firstDir ?? dir,
        })
      }
    }

    return null
  }

  const chooseDirection = (
    playerSnake: SnakeSegment[],
    food: Food,
    obstacles: Obstacle[],
  ): Direction => {
    if (enemySnake.value.length === 0) return direction.value

    const head = enemySnake.value[0]!
    const obstacleSet = new Set<string>()

    for (const seg of playerSnake) {
      obstacleSet.add(`${seg.x},${seg.y}`)
    }
    // Пропускаем хвост противника — он сдвинется
    for (let i = 0; i < enemySnake.value.length - 1; i++) {
      const seg = enemySnake.value[i]!
      obstacleSet.add(`${seg.x},${seg.y}`)
    }
    for (const obs of obstacles) {
      obstacleSet.add(`${obs.x},${obs.y}`)
    }

    const pathToFood = findPath(head, food, obstacleSet)
    if (pathToFood) {
      return pathToFood
    }

    // Fallback: выбираем любое безопасное направление
    const directions: Direction[] = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT]
    const currentDir = direction.value
    const orderedDirs = [currentDir, ...directions.filter(d => d !== currentDir)]

    for (const dir of orderedDirs) {
      const vec = DIRECTION_VECTOR[dir]
      const nextX = head.x + vec.x
      const nextY = head.y + vec.y
      const wrappedX = ((nextX % grid.cols) + grid.cols) % grid.cols
      const wrappedY = ((nextY % grid.rows) + grid.rows) % grid.rows

      if (!obstacleSet.has(`${wrappedX},${wrappedY}`)) {
        return dir
      }
    }

    return currentDir
  }

  /**
   * Выполнить один шаг противника.
   * @returns true если противник съел еду
   */
  const move = (
    playerSnake: SnakeSegment[],
    food: Food,
    obstacles: Obstacle[],
  ): boolean => {
    if (enemySnake.value.length === 0) return false

    direction.value = chooseDirection(playerSnake, food, obstacles)

    const head = enemySnake.value[0]!
    const vector = DIRECTION_VECTOR[direction.value]

    const rawX = head.x + vector.x
    const rawY = head.y + vector.y
    const wrappedX = ((rawX % grid.cols) + grid.cols) % grid.cols
    const wrappedY = ((rawY % grid.rows) + grid.rows) % grid.rows

    const newHead: SnakeSegment = {
      x: wrappedX,
      y: wrappedY,
      id: segmentIdCounter++,
    }

    const ate = newHead.x === food.x && newHead.y === food.y

    enemySnake.value.unshift(newHead)

    if (!ate) {
      enemySnake.value.pop()
    } else {
      score.value += 1
    }

    return ate
  }

  /**
   * Проверка столкновения противника.
   * @returns true при столкновении
   */
  const checkCollision = (
    playerSnake: SnakeSegment[],
    obstacles: Obstacle[],
  ): boolean => {
    if (enemySnake.value.length === 0) return false

    const head = enemySnake.value[0]!

    for (const segment of playerSnake) {
      if (segment.x === head.x && segment.y === head.y) {
        return true
      }
    }

    for (let i = 1; i < enemySnake.value.length; i++) {
      const segment = enemySnake.value[i]!
      if (segment.x === head.x && segment.y === head.y) {
        return true
      }
    }

    for (const obstacle of obstacles) {
      if (obstacle.x === head.x && obstacle.y === head.y) {
        return true
      }
    }

    return false
  }

  const toggle = () => {
    active.value = !active.value
    if (active.value) {
      reset()
    } else {
      enemySnake.value = []
      score.value = 0
    }
  }

  return {
    enemySnake: readonly(enemySnake),
    direction: readonly(direction),
    score: readonly(score),
    active: readonly(active),
    reset,
    move,
    checkCollision,
    toggle,
  }
}
