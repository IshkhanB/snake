import { ref, readonly } from 'vue'
import type { BonusFood, GridConfig, SnakeSegment } from '~/types/game'

/**
 * Composable для управления бонусными фруктами на таймере.
 * Бонусные фрукты появляются периодически, дают 5 очков и исчезают через заданное время.
 * Не влияют на скорость и размер змейки.
 */
export function useBonusFood(grid: GridConfig) {
  /** Массив активных бонусных фруктов */
  const bonusFoods = ref<BonusFood[]>([])

  /** Время последнего спавна бонуса */
  let lastSpawnTime = 0

  /** Интервал спавна бонусов (мс) — каждые 10 секунд */
  const SPAWN_INTERVAL = 10000

  /** Время жизни бонуса (мс) — 5 секунд */
  const BONUS_LIFETIME = 5000

  /** Максимум бонусов на поле одновременно */
  const MAX_BONUSES = 3

  /**
   * Попытаться создать бонусный фрукт.
   * Вызывается периодически из игрового цикла.
   */
  const trySpawnBonus = (snake: SnakeSegment[]) => {
    const now = Date.now()

    // Проверяем интервал спавна и лимит
    if (now - lastSpawnTime < SPAWN_INTERVAL) return
    if (bonusFoods.value.length >= MAX_BONUSES) return

    // Удаляем просроченные бонусы перед спавном
    removeExpiredBonuses(now)

    const occupied = new Set<string>()
    for (const s of snake) occupied.add(`${s.x},${s.y}`)
    for (const b of bonusFoods.value) occupied.add(`${b.x},${b.y}`)

    const totalCells = grid.cols * grid.rows
    if (occupied.size >= totalCells) return

    let pos = { x: 0, y: 0 }
    let attempts = 0
    const maxAttempts = totalCells

    do {
      pos = {
        x: Math.floor(Math.random() * grid.cols),
        y: Math.floor(Math.random() * grid.rows),
      }
      attempts++
    } while (occupied.has(`${pos.x},${pos.y}`) && attempts < maxAttempts)

    if (occupied.has(`${pos.x},${pos.y}`)) return

    bonusFoods.value.push({
      x: pos.x,
      y: pos.y,
      type: 'timed',
      points: 5,
      spawnTime: now,
      lifetime: BONUS_LIFETIME,
    })

    lastSpawnTime = now
  }

  /**
   * Удалить просроченные бонусы.
   */
  const removeExpiredBonuses = (now: number = Date.now()) => {
    bonusFoods.value = bonusFoods.value.filter(b => now - b.spawnTime < b.lifetime)
  }

  /**
   * Проверить, съела ли змейка бонус.
   * @returns очки за съеденные бонусы (0 если ничего не съедено)
   */
  const checkBonusEat = (headX: number, headY: number): number => {
    let pointsEarned = 0
    const remaining: BonusFood[] = []

    for (const bonus of bonusFoods.value) {
      if (bonus.x === headX && bonus.y === headY) {
        pointsEarned += bonus.points
      } else {
        remaining.push(bonus)
      }
    }

    if (pointsEarned > 0) {
      bonusFoods.value = remaining
    }

    return pointsEarned
  }

  /**
   * Сбросить все бонусы (при новой игре).
   */
  const reset = () => {
    bonusFoods.value = []
    lastSpawnTime = 0
  }

  /**
   * Получить оставшееся время для бонуса (0-1).
   */
  const getRemainingLife = (bonus: BonusFood, now: number = Date.now()): number => {
    const elapsed = now - bonus.spawnTime
    return Math.max(0, 1 - elapsed / bonus.lifetime)
  }

  return {
    bonusFoods: readonly(bonusFoods),
    trySpawnBonus,
    removeExpiredBonuses,
    checkBonusEat,
    reset,
    getRemainingLife,
  }
}
