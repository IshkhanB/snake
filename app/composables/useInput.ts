import { onMounted, onUnmounted } from 'vue'
import type { Direction } from '~/types/game'
import { Direction as Dir } from '~/types/game'

/** Карта клавиш на направления (абсолютные) */
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: Dir.UP,
  ArrowDown: Dir.DOWN,
  ArrowLeft: Dir.LEFT,
  ArrowRight: Dir.RIGHT,
  w: Dir.UP,
  W: Dir.UP,
  s: Dir.DOWN,
  S: Dir.DOWN,
  a: Dir.LEFT,
  A: Dir.LEFT,
  d: Dir.RIGHT,
  D: Dir.RIGHT,
  ц: Dir.UP, // Russian keyboard layout
  Ц: Dir.UP,
  ы: Dir.DOWN,
  Ы: Dir.DOWN,
  ф: Dir.LEFT,
  Ф: Dir.LEFT,
  в: Dir.RIGHT,
  В: Dir.RIGHT,
}

/** Клавиши относительного поворота (влево/вправо) */
const KEY_TURN_LEFT = new Set(['ArrowLeft', 'a', 'A', 'ф', 'Ф'])
const KEY_TURN_RIGHT = new Set(['ArrowRight', 'd', 'D', 'в', 'В'])

/** Направления по часовой стрелке для относительных поворотов */
const CLOCKWISE: Direction[] = [Dir.UP, Dir.RIGHT, Dir.DOWN, Dir.LEFT]

/**
 * Повернуть направление: +1 по часовой (вправо) или -1 (влево).
 */
const turnDirection = (current: Direction, turn: 'left' | 'right'): Direction => {
  const idx = CLOCKWISE.indexOf(current)
  const offset = turn === 'right' ? 1 : 3 // +3 === -1 mod 4
  return CLOCKWISE[(idx + offset) % CLOCKWISE.length]!
}

/**
 * Composable для обработки ввода: клавиатура + тач/свайпы.
 * @param setDirection — функция установки направления из useSnakeLogic
 * @param onTogglePause — callback для переключения паузы
 * @param onStartGame — callback для старта игры
 * @param isFollowMode — getter: активен ли режим камеры follow
 * @param getCurrentDirection — getter: текущее направление змейки
 * @param onBoostStart — callback для начала ускорения (пробел)
 * @param onBoostEnd — callback для окончания ускорения (пробел)
 */
export function useInput(
  setDirection: (dir: Direction) => void,
  onTogglePause: () => void,
  onStartGame: () => void,
  isFollowMode: () => boolean = () => false,
  getCurrentDirection: () => Direction = () => Dir.RIGHT,
  onBoostStart: () => void = () => {},
  onBoostEnd: () => void = () => {},
) {
  /** Координаты начала свайпа */
  let touchStartX = 0
  let touchStartY = 0

  /** Минимальная длина свайпа в пикселях */
  const SWIPE_THRESHOLD = 30

  /**
   * Обработчик нажатий клавиатуры.
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    // В режиме следования: только относительные повороты влево/вправо
    if (isFollowMode()) {
      if (KEY_TURN_LEFT.has(e.key)) {
        e.preventDefault()
        setDirection(turnDirection(getCurrentDirection(), 'left'))
        return
      }
      if (KEY_TURN_RIGHT.has(e.key)) {
        e.preventDefault()
        setDirection(turnDirection(getCurrentDirection(), 'right'))
        return
      }
      // Вверх/вниз в follow-режиме игнорируем
      if (KEY_TO_DIRECTION[e.key]) {
        e.preventDefault()
        return
      }
    } else {
      const dir = KEY_TO_DIRECTION[e.key]
      if (dir) {
        e.preventDefault()
        setDirection(dir)
        return
      }
    }

    if (e.key === 'p' || e.key === 'P' || e.key === 'з' || e.key === 'З') {
      e.preventDefault()
      onTogglePause()
      return
    }

    if (e.key === ' ') {
      e.preventDefault()
      if (!e.repeat) {
        onBoostStart()
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      onStartGame()
    }
  }

  /**
   * Обработчик отпускания клавиш — для сброса ускорения.
   */
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault()
      onBoostEnd()
    }
  }

  /**
   * Обработчик начала касания.
   */
  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (touch) {
      touchStartX = touch.clientX
      touchStartY = touch.clientY
    }
  }

  /**
   * Обработчик окончания касания — определяет направление свайпа.
   */
  const handleTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0]
    let dx = 0
    let dy = 0
    if (touch) {
      dx = touch.clientX - touchStartX
      dy = touch.clientY - touchStartY
    }

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    // Игнорируем слишком короткие свайпы
    if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return

    e.preventDefault()

    // В follow-режиме учитываем только горизонтальные свайпы как относительные повороты
    if (isFollowMode()) {
      if (absDx > absDy) {
        setDirection(turnDirection(getCurrentDirection(), dx > 0 ? 'right' : 'left'))
      }
      return
    }

    // Определяем доминирующую ось
    if (absDx > absDy) {
      setDirection(dx > 0 ? Dir.RIGHT : Dir.LEFT)
    } else {
      setDirection(dy > 0 ? Dir.DOWN : Dir.UP)
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: false })
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('touchstart', handleTouchStart)
    window.removeEventListener('touchend', handleTouchEnd)
  })
}
