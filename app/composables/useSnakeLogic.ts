import { ref, shallowRef, readonly } from 'vue'
import type { Coordinate, Direction, SnakeSegment, Food, GridConfig, Obstacle } from '~/types/game'
import { Direction as Dir, DIRECTION_VECTOR, OPPOSITE_DIRECTION } from '~/types/game'

/**
 * Composable для управления логикой змейки.
 * Содержит состояние змейки, направление, еду и логику коллизий.
 */
export function useSnakeLogic(grid: GridConfig) {
  /** Тело змейки (голова — первый элемент) */
  const snake = ref<SnakeSegment[]>([])

  /** Снимок змейки до последнего move — для интерполяции в рендерере */
  const prevSnake = ref<SnakeSegment[]>([])

  /** Текущее направление движения */
  const direction = shallowRef<Direction>(Dir.RIGHT)

  /** Буфер следующего направления (применяется в начале тика) */
  const nextDirection = shallowRef<Direction>(Dir.RIGHT)

  /** Еда на поле */
  const food = ref<Food>({ x: 0, y: 0, type: 'normal', points: 1 })

  /** Счётчик для генерации ID сегментов */
  let segmentIdCounter = 0

  /**
   * Инициализация змейки в центре поля.
   */
  const reset = () => {
    const centerX = Math.floor(grid.cols / 2)
    const centerY = Math.floor(grid.rows / 2)

    snake.value = [
      { x: centerX, y: centerY, id: segmentIdCounter++ },
      { x: centerX - 1, y: centerY, id: segmentIdCounter++ },
      { x: centerX - 2, y: centerY, id: segmentIdCounter++ },
    ]

    // prevSnake = текущее состояние на старте (нет интерполяции в первом кадре)
    prevSnake.value = snake.value.map(s => ({ ...s }))

    direction.value = Dir.RIGHT
    nextDirection.value = Dir.RIGHT
    spawnFood()
  }

  /**
   * Сгенерировать еду в случайной свободной ячейке.
   * Безопасно: не зацикливается при полном заполнении поля.
   */
  const spawnFood = () => {
    const occupied = new Set(snake.value.map(s => `${s.x},${s.y}`))
    const totalCells = grid.cols * grid.rows

    // Если поле полностью заполнено — не спавним еду (победа!)
    if (occupied.size >= totalCells) return

    let pos: Coordinate
    let attempts = 0
    const maxAttempts = totalCells

    do {
      pos = {
        x: Math.floor(Math.random() * grid.cols),
        y: Math.floor(Math.random() * grid.rows),
      }
      attempts++
    } while (occupied.has(`${pos.x},${pos.y}`) && attempts < maxAttempts)

    // Если не нашли свободную ячейку за maxAttempts — выходим
    if (occupied.has(`${pos.x},${pos.y}`)) return

    food.value = { ...pos, type: 'normal', points: 1 }
  }

  /**
   * Установить новое направление с защитой от разворота на 180°.
   * Проверяем против nextDirection, чтобы избежать двойного ввода за один тик.
   */
  const setDirection = (newDir: Direction) => {
    if (OPPOSITE_DIRECTION[newDir] !== nextDirection.value) {
      nextDirection.value = newDir
    }
  }

  /**
   * Выполнить один шаг змейки.
   * Змейка проходит сквозь стены (wrap-around).
   * @returns true если змейка съела еду, false если змейка пуста
   */
  const move = (): boolean => {
    if (snake.value.length === 0) return false

    // Сохраняем снимок ДО хода — для интерполяции в рендерере
    // Для каждого сегмента запоминаем текущую позицию как "предыдущую"
    prevSnake.value = snake.value.map(s => ({ ...s }))

    // Применяем буферизованное направление
    direction.value = nextDirection.value

    const head = snake.value[0]!
    const vector = DIRECTION_VECTOR[direction.value]

    // Wrap-around: змейка проходит сквозь стены
    const rawX = head.x + vector.x
    const rawY = head.y + vector.y
    const wrappedX = ((rawX % grid.cols) + grid.cols) % grid.cols
    const wrappedY = ((rawY % grid.rows) + grid.rows) % grid.rows

    const newHead: SnakeSegment = {
      x: wrappedX,
      y: wrappedY,
      id: segmentIdCounter++,
    }

    // Проверяем, съели ли еду
    const ate = newHead.x === food.value.x && newHead.y === food.value.y

    // Добавляем новую голову
    snake.value.unshift(newHead)

    // Для интерполяции: голова «выезжает» из старой позиции головы
    // Вставляем старую позицию головы как prevSnake[0], чтобы индексы совпали
    prevSnake.value.unshift({ ...head })

    // Если не съели — убираем хвост
    if (!ate) {
      snake.value.pop()
      prevSnake.value.pop()
    }
    // Если съели: prevSnake короче snake на 1 — рендерер обработает
    // (новый хвост будет "выезжать" из последней позиции prevSnake)

    return ate
  }

  /**
   * Проверка коллизий: собственное тело и препятствия.
   * Стены не являются препятствием (wrap-around).
   * @param obstacles массив препятствий на поле
   * @returns true при столкновении, false если змейка пуста
   */
  const checkCollision = (obstacles: Obstacle[] = []): boolean => {
    if (snake.value.length === 0) return false

    const head = snake.value[0]!

    // Столкновение с собственным телом (пропускаем голову)
    for (let i = 1; i < snake.value.length; i++) {
      const segment = snake.value[i]!
      if (segment.x === head.x && segment.y === head.y) {
        return true
      }
    }

    // Столкновение с препятствиями
    for (const obstacle of obstacles) {
      if (obstacle.x === head.x && obstacle.y === head.y) {
        return true
      }
    }

    return false
  }

  return {
    snake: readonly(snake),
    prevSnake: readonly(prevSnake),
    direction: readonly(direction),
    nextDirection: readonly(nextDirection),
    food: readonly(food),
    reset,
    move,
    spawnFood,
    setDirection,
    checkCollision,
  }
}
