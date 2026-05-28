import { ref, shallowRef, onMounted, onUnmounted, readonly } from 'vue'
import { GameState } from '~/types/game'
import type { GameOptions } from '~/types/game'

/**
 * Composable для управления игровым циклом на основе requestAnimationFrame.
 * Обеспечивает стабильный FPS с расчётом delta time.
 * Автоматически ставит паузу при потере фокуса окна.
 */
export function useGameLoop(
  tickFn: () => void,
  getSpeed: () => number,
  gameStateRef: { value: GameState },
) {
  /** ID текущего requestAnimationFrame */
  let rafId = 0

  /** Время последнего кадра (ms) */
  let lastTime = 0

  /** Аккумулированное время для тиков игры */
  let accumulator = 0

  /** Последний использованный интервал тика (ms) — для расчёта интерполяции */
  let lastTickInterval = 0

  /** Флаг: цикл запущен */
  const isRunning = shallowRef(false)

  /**
   * Основной цикл рендеринга.
   * Вызывается каждый кадр через requestAnimationFrame.
   */
  const loop = (timestamp: number) => {
    if (!isRunning.value) return

    if (!lastTime) lastTime = timestamp
    const delta = timestamp - lastTime
    lastTime = timestamp

    // Аккумулируем время и выполняем тики с фиксированным шагом
    accumulator += delta
    const tickInterval = 1000 / getSpeed()
    lastTickInterval = tickInterval

    while (accumulator >= tickInterval) {
      tickFn()
      accumulator -= tickInterval
    }

    rafId = requestAnimationFrame(loop)
  }

  /** Запустить игровой цикл */
  const start = () => {
    if (isRunning.value) return
    isRunning.value = true
    lastTime = 0
    accumulator = 0
    lastTickInterval = 1000 / getSpeed()
    rafId = requestAnimationFrame(loop)
  }

  /** Остановить игровой цикл */
  const stop = () => {
    isRunning.value = false
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  /** Возобновить цикл (после паузы) */
  const resume = () => {
    if (isRunning.value) return
    isRunning.value = true
    lastTime = 0
    accumulator = 0
    lastTickInterval = 1000 / getSpeed()
    rafId = requestAnimationFrame(loop)
  }

  /** Обработчик потери фокуса окна — автопауза */
  const onBlur = () => {
    if (gameStateRef.value === GameState.PLAYING) {
      stop()
    }
  }

  /** Обработчик возврата фокуса — автовозобновление */
  const onFocus = () => {
    if (gameStateRef.value === GameState.PLAYING) {
      resume()
    }
  }

  onMounted(() => {
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
  })

  onUnmounted(() => {
    stop()
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
  })

  /**
   * Доля времени (0..1) между последним и следующим тиком.
   * Используется рендерером для плавной интерполяции позиций между тиками.
   */
  const getInterpolation = (): number => {
    if (lastTickInterval <= 0) return 0
    return Math.min(1, Math.max(0, accumulator / lastTickInterval))
  }

  return {
    isRunning: readonly(isRunning),
    start,
    stop,
    resume,
    getInterpolation,
  }
}
