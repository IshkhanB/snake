import { shallowRef, readonly } from 'vue'

/** Расход энергии за один игровой тик */
const DRAIN_PER_TICK = 1.5

/** Минимальная энергия для активации буста */
const MIN_ENERGY_TO_BOOST = 5

/** Множитель скорости при ускорении (экспортируется для GameCanvas) */
export const BOOST_MULTIPLIER = 2

/**
 * Composable для управления ускорением змейки игрока.
 * Энергия тратится при удержании пробела и восстанавливается при отпускании.
 * @param getMaxEnergy getter максимальной энергии (учитывает улучшения)
 * @param getRegenPerTick getter скорости регенерации (учитывает улучшения)
 */
export function useBoost(
  getMaxEnergy: () => number = () => 100,
  getRegenPerTick: () => number = () => 0.4,
) {
  /** Текущая энергия ускорения */
  const energy = shallowRef(getMaxEnergy())

  /** Флаг: активно ли ускорение */
  const isBoosting = shallowRef(false)

  /** Обновить энергию (вызывается каждый игровой тик) */
  const updatePerTick = () => {
    const maxEnergy = getMaxEnergy()
    if (isBoosting.value) {
      energy.value = Math.max(0, energy.value - DRAIN_PER_TICK)
      if (energy.value <= 0) {
        isBoosting.value = false
      }
    } else {
      energy.value = Math.min(maxEnergy, energy.value + getRegenPerTick())
    }
  }

  /** Можно ли активировать ускорение */
  const canBoost = (): boolean => energy.value >= MIN_ENERGY_TO_BOOST

  /** Начать ускорение (если достаточно энергии) */
  const startBoost = () => {
    if (canBoost()) {
      isBoosting.value = true
    }
  }

  /** Прекратить ускорение */
  const endBoost = () => {
    isBoosting.value = false
  }

  /** Принудительно прервать ускорение (например, при паузе/конце игры) */
  const cancelBoost = () => {
    isBoosting.value = false
  }

  /** Полностью заполнить энергию буста (например, при сборе бонуса) */
  const refill = () => {
    energy.value = getMaxEnergy()
  }

  /** Сбросить энергию для новой игры */
  const reset = () => {
    energy.value = getMaxEnergy()
    isBoosting.value = false
  }

  return {
    energy: readonly(energy),
    isBoosting: readonly(isBoosting),
    updatePerTick,
    canBoost,
    startBoost,
    endBoost,
    cancelBoost,
    refill,
    reset,
  }
}
