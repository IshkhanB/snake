import { ref, shallowRef, readonly } from 'vue'

/** Ключ для localStorage */
const HIGH_SCORE_KEY = 'snake_high_score'

/**
 * Composable для управления счётом и рекордом.
 * Рекорд сохраняется в localStorage.
 * @param getScoreMult getter множителя очков (учитывает улучшения)
 */
export function useScore(
  initialSpeed: number,
  speedIncrement: number,
  scorePerSpeedUp: number,
  getScoreMult: () => number = () => 1,
) {
  /** Текущий счёт */
  const score = shallowRef(0)

  /** Рекорд (загружается из localStorage) */
  const highScore = shallowRef(loadHighScore())

  /** Текущая скорость (ячеек в секунду) */
  const speed = shallowRef(initialSpeed)

  /**
   * Загрузить рекорд из localStorage.
   * Безопасно для SSR — вызывается только на клиенте.
   */
  function loadHighScore(): number {
    if (!import.meta.client) return 0
    try {
      const stored = localStorage.getItem(HIGH_SCORE_KEY)
      return stored ? parseInt(stored, 10) : 0
    } catch {
      return 0
    }
  }

  /**
   * Сохранить рекорд в localStorage.
   */
  const saveHighScore = () => {
    if (!import.meta.client) return
    if (score.value > highScore.value) {
      highScore.value = score.value
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(score.value))
      } catch {
        // localStorage недоступен — игнорируем
      }
    }
  }

  /**
   * Добавить очки и увеличить скорость при достижении порога.
   * @param points количество очков
   * @param affectSpeed если false, скорость не увеличивается (для бонусов)
   */
  const addScore = (points: number, affectSpeed: boolean = true) => {
    const gained = Math.max(1, Math.round(points * getScoreMult()))
    score.value += gained

    if (affectSpeed) {
      const newSpeed = initialSpeed + Math.floor(score.value / scorePerSpeedUp) * speedIncrement
      speed.value = newSpeed
    }
  }

  /** Сбросить счёт и скорость для новой игры */
  const reset = () => {
    score.value = 0
    speed.value = initialSpeed
  }

  return {
    score: readonly(score),
    highScore: readonly(highScore),
    speed: readonly(speed),
    addScore,
    reset,
    saveHighScore,
  }
}
