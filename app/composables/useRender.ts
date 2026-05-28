import { onUnmounted, shallowRef } from 'vue'
import type { SnakeSegment, Food, GridConfig, GameState, BonusFood } from '~/types/game'

/** Цвета для рендеринга */
const COLORS = {
  background: '#1a1a2e',
  gridLine: '#16213e',
  snakeHead: '#e94560',
  snakeBody: '#0f3460',
  snakeBodyAlt: '#16213e',
  food: '#e94560',
  foodGlow: 'rgba(233, 69, 96, 0.3)',
  bonusFood: '#ffd700',
  bonusFoodGlow: 'rgba(255, 215, 0, 0.4)',
  bonusTimer: '#ff6b6b',
} as const

/**
 * Composable для рендеринга игры на Canvas.
 * Вся работа с Canvas API инкапсулирована здесь.
 */
export function useRender(
  canvasRef: { value: HTMLCanvasElement | null },
  grid: GridConfig,
) {
  /** Canvas 2D контекст */
  let ctx: CanvasRenderingContext2D | null = null

  /** ID текущего requestAnimationFrame для рендера */
  let renderRafId = 0

  /** Флаг: рендер активен */
  const isRendering = shallowRef(false)

  /**
   * Инициализация Canvas контекста.
   */
  const initCanvas = () => {
    const canvas = canvasRef.value
    console.log('[useRender] initCanvas, canvas:', canvas)
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    const width = grid.cols * grid.cellSize
    const height = grid.rows * grid.cellSize

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx = canvas.getContext('2d')
    console.log('[useRender] ctx:', ctx, 'dpr:', dpr, 'size:', width, height)
    if (ctx) {
      ctx.scale(dpr, dpr)
    }
  }

  /**
   * Отрисовать один кадр игры.
   */
  const render = (
    gameState: GameState,
    snake: SnakeSegment[],
    food: Food,
    bonusFoods: BonusFood[] = [],
  ) => {
    if (!ctx) {
      console.warn('[useRender] render skipped: ctx is null')
      return
    }
    console.log('[useRender] render called, snake:', snake.length, 'food:', food)

    const { cols, rows, cellSize } = grid
    const width = cols * cellSize
    const height = rows * cellSize

    // Очистка
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // Сетка
    ctx.strokeStyle = COLORS.gridLine
    ctx.lineWidth = 0.5
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cellSize, 0)
      ctx.lineTo(x * cellSize, height)
      ctx.stroke()
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cellSize)
      ctx.lineTo(width, y * cellSize)
      ctx.stroke()
    }

    // Еда с эффектом свечения
    const foodX = food.x * cellSize + cellSize / 2
    const foodY = food.y * cellSize + cellSize / 2
    const foodRadius = cellSize * 0.4

    ctx.save()
    ctx.shadowColor = COLORS.foodGlow
    ctx.shadowBlur = 15
    ctx.fillStyle = COLORS.food
    ctx.beginPath()
    ctx.arc(foodX, foodY, foodRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Бонусные фрукты с таймером
    const now = Date.now()
    for (const bonus of bonusFoods) {
      const bx = bonus.x * cellSize + cellSize / 2
      const by = bonus.y * cellSize + cellSize / 2
      const remaining = Math.max(0, 1 - (now - bonus.spawnTime) / bonus.lifetime)
      const bonusRadius = cellSize * 0.4 * (0.5 + remaining * 0.5)

      ctx.save()
      ctx.shadowColor = COLORS.bonusFoodGlow
      ctx.shadowBlur = 12
      ctx.fillStyle = COLORS.bonusFood
      ctx.globalAlpha = 0.5 + remaining * 0.5
      ctx.beginPath()
      ctx.arc(bx, by, bonusRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // Индикатор оставшегося времени (дуга)
      ctx.save()
      ctx.strokeStyle = COLORS.bonusTimer
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.arc(bx, by, cellSize * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining)
      ctx.stroke()
      ctx.restore()
    }

    // Змейка
    for (let i = snake.length - 1; i >= 0; i--) {
      const seg = snake[i]
      let x = 0
      let y = 0
      if (seg) {
        x = seg.x * cellSize
        y = seg.y * cellSize
      }
      const padding = 1

      if (i === 0) {
        // Голова
        ctx.fillStyle = COLORS.snakeHead
        roundRect(ctx, x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 4)
        ctx.fill()
      } else {
        // Тело с чередованием цветов
        ctx.fillStyle = i % 2 === 0 ? COLORS.snakeBody : COLORS.snakeBodyAlt
        roundRect(ctx, x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2, 3)
        ctx.fill()
      }
    }
  }

  /**
   * Вспомогательная функция для рисования скруглённых прямоугольников.
   */
  const roundRect = (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => {
    context.beginPath()
    context.moveTo(x + r, y)
    context.lineTo(x + w - r, y)
    context.quadraticCurveTo(x + w, y, x + w, y + r)
    context.lineTo(x + w, y + h - r)
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    context.lineTo(x + r, y + h)
    context.quadraticCurveTo(x, y + h, x, y + h - r)
    context.lineTo(x, y + r)
    context.quadraticCurveTo(x, y, x + r, y)
    context.closePath()
  }

  /** Запустить цикл рендеринга */
  const startRender = (
    getState: () => GameState,
    getSnake: () => SnakeSegment[],
    getFood: () => Food,
    getBonusFoods: () => BonusFood[] = () => [],
  ) => {
    if (isRendering.value) return
    isRendering.value = true

    const frame = () => {
      render(getState(), getSnake(), getFood(), getBonusFoods())
      renderRafId = requestAnimationFrame(frame)
    }
    renderRafId = requestAnimationFrame(frame)
  }

  /** Остановить цикл рендеринга */
  const stopRender = () => {
    isRendering.value = false
    if (renderRafId) {
      cancelAnimationFrame(renderRafId)
      renderRafId = 0
    }
  }

  onUnmounted(() => {
    stopRender()
  })

  return {
    isRendering,
    initCanvas,
    render,
    startRender,
    stopRender,
  }
}
