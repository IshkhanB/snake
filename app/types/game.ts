/**
 * Игровые типы и интерфейсы для игры «Змейка».
 * Все типы строго типизированы для обеспечения безопасности при рефакторинге.
 */

/** Координата на игровом поле */
export interface Coordinate {
  x: number
  y: number
}

/** Направление движения змейки */
export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

/** Сегмент тела змейки */
export interface SnakeSegment extends Coordinate {
  /** Уникальный ID для отслеживания (опционально, для анимаций) */
  id?: number
}

/** Еда на поле */
export interface Food extends Coordinate {
  /** Тип еды: обычная, бонусная или таймерная */
  type: 'normal' | 'bonus' | 'timed'
  /** Очки за поедание */
  points: number
}

/** Бонусный фрукт на таймере — исчезает через определённое время */
export interface BonusFood extends Food {
  type: 'timed'
  points: 5
  /** Время появления (timestamp) */
  spawnTime: number
  /** Время жизни в миллисекундах */
  lifetime: number
}

/** Препятствие на поле — вызывает game over при столкновении */
export interface Obstacle {
  x: number
  y: number
  id: number
}

/** Состояние игры */
export enum GameState {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

/** Конфигурация игрового поля */
export interface GridConfig {
  /** Количество ячеек по ширине */
  cols: number
  /** Количество ячеек по высоте */
  rows: number
  /** Размер одной ячейки в пикселях */
  cellSize: number
}

/** Полное состояние игры (readonly для внешних потребителей) */
export interface GameStore {
  state: GameState
  snake: SnakeSegment[]
  direction: Direction
  nextDirection: Direction
  food: Food
  score: number
  highScore: number
  speed: number
  grid: GridConfig
}

/** Параметры для инициализации игры */
export interface GameOptions {
  gridCols?: number
  gridRows?: number
  cellSize?: number
  initialSpeed?: number
  speedIncrement?: number
  scorePerSpeedUp?: number
}

/** Дефолтная конфигурация игры */
export const DEFAULT_GAME_OPTIONS: Required<GameOptions> = {
  gridCols: 80,
  gridRows: 80,
  cellSize: 15,
  initialSpeed: 8, // ячеек в секунду
  speedIncrement: 1,
  scorePerSpeedUp: 5,
}

/** Карта противоположных направлений (для предотвращения разворота на 180°) */
export const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  [Direction.UP]: Direction.DOWN,
  [Direction.DOWN]: Direction.UP,
  [Direction.LEFT]: Direction.RIGHT,
  [Direction.RIGHT]: Direction.LEFT,
}

/** Вектор смещения для каждого направления */
export const DIRECTION_VECTOR: Record<Direction, Coordinate> = {
  [Direction.UP]: { x: 0, y: -1 },
  [Direction.DOWN]: { x: 0, y: 1 },
  [Direction.LEFT]: { x: -1, y: 0 },
  [Direction.RIGHT]: { x: 1, y: 0 },
}
