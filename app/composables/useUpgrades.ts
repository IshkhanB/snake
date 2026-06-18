import { shallowRef, readonly, type ShallowRef } from 'vue'

/** Ключ для localStorage: валюта */
const COINS_KEY = 'snake_coins'

/** Ключ для localStorage: уровни улучшений */
const UPGRADES_KEY = 'snake_upgrades'

/** ID всех улучшений */
export type UpgradeId = 'length' | 'boostEnergy' | 'regen' | 'scoreMult' | 'shield'

/** Описание одного уровня улучшения (для отображения) */
export interface UpgradeDefinition {
  id: UpgradeId
  name: string
  icon: string
  description: (level: number) => string
  maxLevel: number
  /** Стоимость перехода на следующий уровень (level -> level+1) */
  costForLevel: (nextLevel: number) => number
}

/** Определения всех улучшений */
export const UPGRADE_DEFS: UpgradeDefinition[] = [
  {
    id: 'length',
    name: 'Длина',
    icon: '🐍',
    description: (lvl) => `Стартовая длина: ${3 + lvl} сегм.`,
    maxLevel: 10,
    costForLevel: (next) => 10 + next * 8,
  },
  {
    id: 'boostEnergy',
    name: 'Энергия',
    icon: '⚡',
    description: (lvl) => `Макс. энергия: ${100 + lvl * 20}`,
    maxLevel: 10,
    costForLevel: (next) => 15 + next * 10,
  },
  {
    id: 'regen',
    name: 'Регенерация',
    icon: '🔋',
    description: (lvl) => `Восст. за тик: ${(0.4 + lvl * 0.15).toFixed(2)}`,
    maxLevel: 10,
    costForLevel: (next) => 20 + next * 12,
  },
  {
    id: 'scoreMult',
    name: 'Множитель',
    icon: '💎',
    description: (lvl) => `Очки: ×${(1 + lvl * 0.25).toFixed(2)}`,
    maxLevel: 8,
    costForLevel: (next) => 50 + next * 30,
  },
  {
    id: 'shield',
    name: 'Щит',
    icon: '🛡️',
    description: (lvl) => lvl === 0
      ? 'Спасает от одной смерти за игру'
      : `Спасает от ${lvl} смерт. за игру`,
    maxLevel: 3,
    costForLevel: (next) => 100 + next * 80,
  },
]

/** Map для O(1)-поиска по id (вместо линейного find) */
export const UPGRADE_DEFS_MAP: ReadonlyMap<UpgradeId, UpgradeDefinition> = new Map(
  UPGRADE_DEFS.map((def) => [def.id, def]),
)

/** Тип карты уровней улучшений */
type UpgradeLevels = Record<UpgradeId, number>

const DEFAULT_LEVELS: UpgradeLevels = {
  length: 0,
  boostEnergy: 0,
  regen: 0,
  scoreMult: 0,
  shield: 0,
}

function loadCoins(): number {
  if (!import.meta.client) return 0
  try {
    const v = localStorage.getItem(COINS_KEY)
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0
  } catch {
    return 0
  }
}

function saveCoins(value: number) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(COINS_KEY, String(value))
  } catch {
    // ignore
  }
}

function loadLevels(): UpgradeLevels {
  if (!import.meta.client) return { ...DEFAULT_LEVELS }
  try {
    const v = localStorage.getItem(UPGRADES_KEY)
    if (!v) return { ...DEFAULT_LEVELS }
    const parsed = JSON.parse(v) as Partial<UpgradeLevels>
    return { ...DEFAULT_LEVELS, ...parsed }
  } catch {
    return { ...DEFAULT_LEVELS }
  }
}

function saveLevels(value: UpgradeLevels) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(UPGRADES_KEY, JSON.stringify(value))
  } catch {
    // ignore
  }
}

// Singleton-состояние: единый ref на модуль, чтобы все вызовы
// useUpgrades() в разных компонентах делили одни и те же данные.
let coinsRef: ShallowRef<number> | null = null
let levelsRef: ShallowRef<UpgradeLevels> | null = null

function ensureCoins(): ShallowRef<number> {
  if (!coinsRef) coinsRef = shallowRef(loadCoins())
  return coinsRef
}

function ensureLevels(): ShallowRef<UpgradeLevels> {
  if (!levelsRef) levelsRef = shallowRef<UpgradeLevels>(loadLevels())
  return levelsRef
}

/**
 * Composable для системы постоянных улучшений змейки.
 * Монеты и уровни сохраняются в localStorage между сессиями.
 * Возвращает singleton — все вызовы разделяют одно состояние.
 */
export function useUpgrades() {
  const coins = ensureCoins()
  const levels = ensureLevels()

  /** Уровень улучшения по ID */
  const getLevel = (id: UpgradeId): number => levels.value[id] ?? 0

  /** Купить улучшение. Возвращает true при успехе. */
  const buyUpgrade = (id: UpgradeId): boolean => {
    const def = UPGRADE_DEFS_MAP.get(id)
    if (!def) return false
    const current = getLevel(id)
    if (current >= def.maxLevel) return false
    const cost = def.costForLevel(current + 1)
    if (coins.value < cost) return false

    coins.value -= cost
    levels.value = { ...levels.value, [id]: current + 1 }
    saveCoins(coins.value)
    saveLevels(levels.value)
    return true
  }

  /** Начислить монеты (в конце игры) */
  const addCoins = (amount: number) => {
    if (amount <= 0) return
    coins.value += amount
    saveCoins(coins.value)
  }

  /** Сбросить все улучшения и валюту (debug) */
  const resetAll = () => {
    coins.value = 0
    levels.value = { ...DEFAULT_LEVELS }
    saveCoins(0)
    saveLevels(levels.value)
  }

  return {
    coins: readonly(coins),
    levels: readonly(levels),
    getLevel,
    buyUpgrade,
    addCoins,
    resetAll,
  }
}
