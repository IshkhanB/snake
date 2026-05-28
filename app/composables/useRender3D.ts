import { onUnmounted, shallowRef } from 'vue'
import * as THREE from 'three'
import type { SnakeSegment, Food, GridConfig, GameState, BonusFood, Obstacle } from '~/types/game'

/** Предустановленные виды камеры */
export type CameraView = 'isometric' | 'top' | 'side' | 'follow'

/**
 * Composable для 3D-рендеринга игры на Three.js.
 * Змея — цельная: сферические сегменты + цилиндрические коннекторы + выразительная голова с глазами.
 */
export function useRender3D(
  canvasRef: { value: HTMLCanvasElement | null },
  grid: GridConfig,
) {
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null

  /** Текущий вид камеры */
  const currentView = shallowRef<CameraView>('isometric')
  const CAMERA_VIEWS: CameraView[] = ['isometric', 'top', 'side', 'follow']

  /** Группы сегментов змейки: { сфера тела, цилиндр-коннектор к следующему } */
  type BodySegment = { sphere: THREE.Mesh; connector: THREE.Mesh }
  const bodySegments: BodySegment[] = []
  const bodyPool: BodySegment[] = []
  let snakeGroup: THREE.Group | null = null

  /** Голова: отдельная группа (сфера + глаза) */
  let headGroup: THREE.Group | null = null
  let headSphere: THREE.Mesh | null = null
  let eyeLeft: THREE.Mesh | null = null
  let eyeRight: THREE.Mesh | null = null
  let pupilLeft: THREE.Mesh | null = null
  let pupilRight: THREE.Mesh | null = null

  let foodMesh: THREE.Mesh | null = null
  let foodLight: THREE.PointLight | null = null

  const bonusMeshes: Map<BonusFood, { mesh: THREE.Mesh; ring: THREE.Mesh }> = new Map()
  const obstacleMeshes: Map<Obstacle, THREE.Mesh> = new Map()

  let renderRafId = 0
  const isRendering = shallowRef(false)

  /** Сохранённое направление головы (для follow-камеры при wrap-around) */
  let lastLookDirX = 1
  let lastLookDirZ = 0

  // Геометрии и материалы (создаются один раз)
  let bodySphereGeo: THREE.SphereGeometry | null = null
  let connectorGeo: THREE.CylinderGeometry | null = null
  let headSphereGeo: THREE.SphereGeometry | null = null
  let eyeWhiteGeo: THREE.SphereGeometry | null = null
  let pupilGeo: THREE.SphereGeometry | null = null
  let headMat: THREE.MeshStandardMaterial | null = null
  let bodyMatEven: THREE.MeshStandardMaterial | null = null
  let bodyMatOdd: THREE.MeshStandardMaterial | null = null
  let connectorMat: THREE.MeshStandardMaterial | null = null
  let eyeWhiteMat: THREE.MeshStandardMaterial | null = null
  let pupilMat: THREE.MeshStandardMaterial | null = null
  let foodMat: THREE.MeshStandardMaterial | null = null
  let bonusMat: THREE.MeshStandardMaterial | null = null
  let ringMat: THREE.MeshBasicMaterial | null = null
  let obstacleMat: THREE.MeshStandardMaterial | null = null
  let foodGeo: THREE.SphereGeometry | null = null
  let ringGeo: THREE.RingGeometry | null = null
  let obstacleGeo: THREE.BoxGeometry | null = null

  /** Цвета сцены */
  const COLORS = {
    background: 0x0f0f23,
    floor: 0x16213e,
    gridLine: 0x1f2d50,
    snakeHead: 0xe94560,
    snakeBodyEven: 0x0f3460,
    snakeBodyOdd: 0x1a4a80,
    snakeConnector: 0x0a2540,
    eyeWhite: 0xffffff,
    pupil: 0x111111,
    food: 0xe94560,
    bonusFood: 0xffd700,
    bonusTimer: 0xff6b6b,
    obstacle: 0x8b4513,
  }

  /**
   * Инициализация Three.js сцены, камеры и рендерера.
   */
  const initCanvas = () => {
    const canvas = canvasRef.value
    if (!canvas || typeof window === 'undefined') return

    const { cols, rows } = grid
    const width = window.innerWidth
    const height = window.innerHeight

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    renderer.setClearColor(COLORS.background)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Сцена без fog — дальняя сторона должна быть видна так же чётко
    scene = new THREE.Scene()

    const aspect = width / height
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500)
    const centerX = cols / 2
    const centerZ = rows / 2
    const fieldDiag = Math.sqrt(cols * cols + rows * rows)
    const camDist = fieldDiag * 0.75
    camera.position.set(centerX, camDist * 0.85, centerZ + camDist * 0.8)
    camera.lookAt(centerX, 0, centerZ)

    // Сферический сегмент тела (диаметр ~0.9)
    bodySphereGeo = new THREE.SphereGeometry(0.45, 24, 24)
    // Цилиндр-коннектор: толщина 0.35, длина 1 (масштабируется по оси Y)
    connectorGeo = new THREE.CylinderGeometry(0.35, 0.35, 1, 20, 1)
    // Голова: чуть крупнее тела
    headSphereGeo = new THREE.SphereGeometry(0.55, 28, 28)
    // Белки глаз и зрачки
    eyeWhiteGeo = new THREE.SphereGeometry(0.14, 16, 16)
    pupilGeo = new THREE.SphereGeometry(0.07, 12, 12)

    headMat = new THREE.MeshStandardMaterial({
      color: COLORS.snakeHead,
      emissive: COLORS.snakeHead,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.2,
    })
    bodyMatEven = new THREE.MeshStandardMaterial({
      color: COLORS.snakeBodyEven,
      roughness: 0.5,
      metalness: 0.15,
    })
    bodyMatOdd = new THREE.MeshStandardMaterial({
      color: COLORS.snakeBodyOdd,
      roughness: 0.5,
      metalness: 0.15,
    })
    connectorMat = new THREE.MeshStandardMaterial({
      color: COLORS.snakeConnector,
      roughness: 0.6,
      metalness: 0.1,
    })
    eyeWhiteMat = new THREE.MeshStandardMaterial({
      color: COLORS.eyeWhite,
      roughness: 0.2,
      metalness: 0.0,
    })
    pupilMat = new THREE.MeshStandardMaterial({
      color: COLORS.pupil,
      roughness: 0.3,
      metalness: 0.0,
    })

    foodGeo = new THREE.SphereGeometry(0.4, 24, 24)
    foodMat = new THREE.MeshStandardMaterial({
      color: COLORS.food,
      emissive: COLORS.food,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.3,
    })
    bonusMat = new THREE.MeshStandardMaterial({
      color: COLORS.bonusFood,
      emissive: COLORS.bonusFood,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.4,
      transparent: true,
      depthWrite: false,
    })
    ringGeo = new THREE.RingGeometry(0.55, 0.65, 32)
    ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.bonusTimer,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    })
    obstacleGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9)
    obstacleMat = new THREE.MeshStandardMaterial({
      color: COLORS.obstacle,
      roughness: 0.7,
      metalness: 0.2,
    })

    buildFloor(cols, rows)
    buildLights(cols, rows)

    snakeGroup = new THREE.Group()
    scene.add(snakeGroup)

    // Голова (создаётся один раз, переиспользуется)
    headGroup = new THREE.Group()
    headSphere = new THREE.Mesh(headSphereGeo, headMat)
    headSphere.castShadow = true
    headGroup.add(headSphere)

    eyeLeft = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat)
    eyeLeft.position.set(0.25, 0.2, 0.4)
    headGroup.add(eyeLeft)

    eyeRight = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat)
    eyeRight.position.set(-0.25, 0.2, 0.4)
    headGroup.add(eyeRight)

    pupilLeft = new THREE.Mesh(pupilGeo, pupilMat)
    pupilLeft.position.set(0.25, 0.2, 0.5)
    headGroup.add(pupilLeft)

    pupilRight = new THREE.Mesh(pupilGeo, pupilMat)
    pupilRight.position.set(-0.25, 0.2, 0.5)
    headGroup.add(pupilRight)

    snakeGroup.add(headGroup)

    // Еда
    foodMesh = new THREE.Mesh(foodGeo, foodMat)
    foodMesh.castShadow = true
    scene.add(foodMesh)
    foodLight = new THREE.PointLight(COLORS.food, 1.5, 6, 2)
    scene.add(foodLight)

    window.addEventListener('resize', onResize)
  }

  const buildFloor = (cols: number, rows: number) => {
    if (!scene) return
    const floorGeo = new THREE.PlaneGeometry(cols, rows)
    const floorMat = new THREE.MeshStandardMaterial({
      color: COLORS.floor,
      roughness: 0.9,
      metalness: 0.05,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(cols / 2, 0, rows / 2)
    floor.receiveShadow = true
    scene.add(floor)

    const gridHelper = new THREE.GridHelper(
      Math.max(cols, rows),
      Math.max(cols, rows),
      COLORS.gridLine,
      COLORS.gridLine,
    )
    gridHelper.position.set(cols / 2, 0.01, rows / 2)
    if (cols !== rows) {
      gridHelper.scale.set(cols / Math.max(cols, rows), 1, rows / Math.max(cols, rows))
    }
    ;(gridHelper.material as THREE.Material).transparent = true
    ;(gridHelper.material as THREE.Material).opacity = 0.35
    ;(gridHelper.material as THREE.Material).depthWrite = false
    scene.add(gridHelper)
  }

  const buildLights = (cols: number, rows: number) => {
    if (!scene) return
    const ambient = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x2a3a5a, 0.6)
    scene.add(hemi)

    const dir = new THREE.DirectionalLight(0xffffff, 0.7)
    dir.position.set(cols * 0.5, cols * 1.5, rows * 0.5)
    dir.castShadow = true
    dir.shadow.mapSize.set(1024, 1024)
    dir.shadow.camera.left = -cols
    dir.shadow.camera.right = cols
    dir.shadow.camera.top = rows
    dir.shadow.camera.bottom = -rows
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = cols * 4
    scene.add(dir)

    const fill = new THREE.DirectionalLight(0xffc78a, 0.35)
    fill.position.set(-cols * 0.6, cols * 0.4, rows * 1.2)
    scene.add(fill)

    const rim = new THREE.DirectionalLight(0x4ecdc4, 0.2)
    rim.position.set(-cols, 2, rows * 1.5)
    scene.add(rim)
  }

  /**
   * Применить предустановленный вид камеры.
   * Для 'follow' позиция обновляется каждый кадр в render().
   */
  const applyCameraView = (view: CameraView, headPos?: { x: number; z: number; lookX: number; lookZ: number }) => {
    if (!camera) return
    const { cols, rows } = grid
    const centerX = cols / 2
    const centerZ = rows / 2
    const fieldDiag = Math.sqrt(cols * cols + rows * rows)

    switch (view) {
      case 'isometric': {
        const camDist = fieldDiag * 0.75
        camera.position.set(centerX, camDist * 0.85, centerZ + camDist * 0.8)
        camera.lookAt(centerX, 0, centerZ)
        break
      }
      case 'top': {
        const camDist = fieldDiag * 0.75
        camera.position.set(centerX, camDist, centerZ)
        camera.lookAt(centerX, 0, centerZ)
        break
      }
      case 'side': {
        const camDist = fieldDiag * 0.8
        camera.position.set(centerX, camDist * 0.3, centerZ + camDist)
        camera.lookAt(centerX, 0, centerZ)
        break
      }
      case 'follow': {
        if (headPos) {
          // Камера сзади головы, взгляд вперёд по направлению движения
          const behindDist = 10
          const lookAheadDist = 14
          const camX = headPos.x - headPos.lookX * behindDist
          const camZ = headPos.z - headPos.lookZ * behindDist
          const targetX = headPos.x + headPos.lookX * lookAheadDist
          const targetZ = headPos.z + headPos.lookZ * lookAheadDist
          camera.position.set(camX, 8, camZ)
          camera.lookAt(targetX, 0, targetZ)
        } else {
          const camDist = fieldDiag * 0.75
          camera.position.set(centerX, camDist * 0.85, centerZ + camDist * 0.8)
          camera.lookAt(centerX, 0, centerZ)
        }
        break
      }
    }
  }

  /**
   * Переключить вид камеры на следующий.
   */
  const cycleCameraView = () => {
    const idx = CAMERA_VIEWS.indexOf(currentView.value)
    currentView.value = CAMERA_VIEWS[(idx + 1) % CAMERA_VIEWS.length]!
    applyCameraView(currentView.value)
  }

  const onResize = () => {
    if (!renderer || !camera || !canvasRef.value) return
    const width = window.innerWidth
    const height = window.innerHeight
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  /**
   * Получить/создать сегмент тела из пула.
   */
  const acquireBodySegment = (): BodySegment => {
    if (!bodySphereGeo || !connectorGeo) throw new Error('geometries not initialized')
    let seg = bodyPool.pop()
    if (!seg) {
      const sphere = new THREE.Mesh(bodySphereGeo, bodyMatEven!)
      sphere.castShadow = true
      sphere.receiveShadow = true
      const connector = new THREE.Mesh(connectorGeo, connectorMat!)
      connector.castShadow = true
      seg = { sphere, connector }
    }
    return seg
  }

  /**
   * Поставить цилиндр-коннектор между двумя точками.
   */
  const placeConnector = (
    connector: THREE.Mesh,
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
  ) => {
    const dx = toX - fromX
    const dz = toZ - fromZ
    const length = Math.sqrt(dx * dx + dz * dz)

    // Позиция — середина между двумя точками
    connector.position.set((fromX + toX) / 2, 0.45, (fromZ + toZ) / 2)

    // Масштаб по Y = длина, по X/Z = 1 (толщина уже задана геометрией)
    connector.scale.set(1, Math.max(0.01, length), 1)

    // Цилиндр по умолчанию направлен вверх (по Y). Поворачиваем в нужную сторону.
    // Угол в плоскости XZ: 0 -> вдоль Z, π/2 -> вдоль X
    const angle = Math.atan2(dx, dz)
    // Поворот вокруг оси Y: поворачивает "вверх" в сторону от from к to в плоскости XZ
    connector.rotation.set(Math.PI / 2, 0, 0)
    // Теперь цилиндр направлен вдоль оси Z локально, но нужно повернуть вокруг Y
    connector.rotation.order = 'YXZ'
    connector.rotation.y = angle
    connector.rotation.x = Math.PI / 2
  }

  /**
   * Интерполировать координату с учётом wrap-around через границу поля.
   * Если dist > halfSize — интерполируем «через стену».
   */
  const lerpWrap = (prev: number, curr: number, t: number, size: number): number => {
    let d = curr - prev
    if (d > size / 2) d -= size
    else if (d < -size / 2) d += size
    return prev + d * t
  }

  /**
   * Отрисовать один кадр.
   * @param interp доля (0..1) между предыдущим и текущим тиком — для плавности
   */
  const render = (
    gameState: GameState,
    snake: SnakeSegment[],
    food: Food,
    bonusFoods: BonusFood[] = [],
    obstacles: Obstacle[] = [],
    prevSnake: SnakeSegment[] = [],
    interp: number = 0,
  ) => {
    if (!renderer || !scene || !camera || !snakeGroup) return

    const { cols, rows } = grid
    // Функция для получения интерполированной позиции i-го сегмента
    const getSegPos = (i: number) => {
      const curr = snake[i]
      if (!curr) return null
      const prev = prevSnake[i]
      // Если prev нет (змея только выросла) — «выезжает» из последней известной prev-позиции
      if (!prev) {
        const fallback = prevSnake[prevSnake.length - 1] ?? curr
        return {
          x: lerpWrap(fallback.x, curr.x, interp, cols) + 0.5,
          z: lerpWrap(fallback.y, curr.y, interp, rows) + 0.5,
        }
      }
      return {
        x: lerpWrap(prev.x, curr.x, interp, cols) + 0.5,
        z: lerpWrap(prev.y, curr.y, interp, rows) + 0.5,
      }
    }

    // --- Тело змеи (сегменты после головы) ---
    // Нужно (snake.length - 1) сегментов тела, начиная со второго элемента snake[1..]
    const bodyCount = Math.max(0, snake.length - 1)
    while (bodySegments.length < bodyCount) {
      const seg = acquireBodySegment()
      bodySegments.push(seg)
      snakeGroup.add(seg.sphere)
      snakeGroup.add(seg.connector)
    }
    while (bodySegments.length > bodyCount) {
      const seg = bodySegments.pop()!
      snakeGroup.remove(seg.sphere)
      snakeGroup.remove(seg.connector)
      bodyPool.push(seg)
    }

    for (let i = 0; i < bodyCount; i++) {
      const { sphere, connector } = bodySegments[i]!
      const pos = getSegPos(i + 1) // тело начинается с индекса 1
      if (!pos) continue

      sphere.position.set(pos.x, 0.45, pos.z)
      sphere.material = i % 2 === 0 ? bodyMatEven! : bodyMatOdd!

      // Коннектор: от текущего сегмента к следующему
      if (i + 1 < bodyCount) {
        const nextPos = getSegPos(i + 2)
        if (!nextPos) {
          connector.visible = false
        } else {
          const dx = nextPos.x - pos.x
          const dz = nextPos.z - pos.z
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist > 1.5) {
            connector.visible = false
          } else {
            placeConnector(connector, pos.x, pos.z, nextPos.x, nextPos.z)
            connector.visible = true
          }
        }
      } else {
        connector.visible = false
      }
    }

    // --- Голова ---
    let headLookDirX = lastLookDirX
    let headLookDirZ = lastLookDirZ
    if (headGroup && snake.length > 0) {
      const headPos = getSegPos(0)!
      headGroup.position.set(headPos.x, 0.55, headPos.z)

      // Направление взгляда: от шеи к голове с учётом wrap-around
      if (snake.length > 1) {
        const neckPos = getSegPos(1)
        if (neckPos) {
          let dx = headPos.x - neckPos.x
          let dz = headPos.z - neckPos.z
          // Коррекция wrap-around: если расстояние больше половины поля — это переход через границу
          if (dx > cols / 2) dx -= cols
          else if (dx < -cols / 2) dx += cols
          if (dz > rows / 2) dz -= rows
          else if (dz < -rows / 2) dz += rows
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist > 0.01 && dist < 2) {
            headLookDirX = dx / dist
            headLookDirZ = dz / dist
            lastLookDirX = headLookDirX
            lastLookDirZ = headLookDirZ
          }
        }
      }
      headGroup.rotation.y = Math.atan2(headLookDirX, headLookDirZ)

      // Лёгкое покачивание головы
      const bob = Math.sin(performance.now() * 0.006) * 0.03
      headSphere!.position.y = bob

      // Обновляем follow-камеру
      if (currentView.value === 'follow') {
        applyCameraView('follow', {
          x: headPos.x,
          z: headPos.z,
          lookX: headLookDirX,
          lookZ: headLookDirZ,
        })
      }
    }

    // --- Еда ---
    if (foodMesh) {
      foodMesh.position.set(food.x + 0.5, 0.5, food.y + 0.5)
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.08
      foodMesh.scale.setScalar(pulse)
    }
    if (foodLight) {
      foodLight.position.set(food.x + 0.5, 1.2, food.y + 0.5)
    }

    // --- Бонусная еда ---
    const now = Date.now()
    const activeBonusSet = new Set<BonusFood>()
    for (const bonus of bonusFoods) {
      activeBonusSet.add(bonus)
      let entry = bonusMeshes.get(bonus)
      if (!entry) {
        const m = new THREE.Mesh(foodGeo!, bonusMat!)
        m.castShadow = true
        const r = new THREE.Mesh(ringGeo!, ringMat!)
        r.rotation.x = -Math.PI / 2
        scene!.add(m)
        scene!.add(r)
        entry = { mesh: m, ring: r }
        bonusMeshes.set(bonus, entry)
      }
      const remaining = Math.max(0, 1 - (now - bonus.spawnTime) / bonus.lifetime)
      const scale = 0.6 + remaining * 0.5
      entry.mesh.position.set(bonus.x + 0.5, 0.4, bonus.y + 0.5)
      entry.mesh.scale.setScalar(scale)
      entry.ring.position.set(bonus.x + 0.5, 0.02, bonus.y + 0.5)
      entry.ring.scale.setScalar(remaining)
      ;(entry.mesh.material as THREE.MeshStandardMaterial).opacity = 0.5 + remaining * 0.5
    }
    for (const [bonus, entry] of bonusMeshes) {
      if (!activeBonusSet.has(bonus)) {
        scene!.remove(entry.mesh)
        scene!.remove(entry.ring)
        entry.mesh.geometry.dispose()
        entry.ring.geometry.dispose()
        bonusMeshes.delete(bonus)
      }
    }

    // --- Препятствия ---
    const activeObstacleSet = new Set<Obstacle>()
    for (const obstacle of obstacles) {
      activeObstacleSet.add(obstacle)
      let mesh = obstacleMeshes.get(obstacle)
      if (!mesh) {
        mesh = new THREE.Mesh(obstacleGeo!, obstacleMat!)
        mesh.castShadow = true
        mesh.receiveShadow = true
        scene!.add(mesh)
        obstacleMeshes.set(obstacle, mesh)
      }
      mesh.position.set(obstacle.x + 0.5, 0.45, obstacle.y + 0.5)
    }
    for (const [obstacle, mesh] of obstacleMeshes) {
      if (!activeObstacleSet.has(obstacle)) {
        scene!.remove(mesh)
        mesh.geometry?.dispose()
        obstacleMeshes.delete(obstacle)
      }
    }

    renderer.render(scene, camera)
  }

  /** Запустить цикл рендеринга */
  const startRender = (
    getState: () => GameState,
    getSnake: () => SnakeSegment[],
    getFood: () => Food,
    getBonusFoods: () => BonusFood[] = () => [],
    getObstacles: () => Obstacle[] = () => [],
    getPrevSnake: () => SnakeSegment[] = () => [],
    getInterpolation: () => number = () => 0,
  ) => {
    if (isRendering.value) return
    isRendering.value = true

    const frame = () => {
      if (!isRendering.value) return
      render(
        getState(),
        getSnake(),
        getFood(),
        getBonusFoods(),
        getObstacles(),
        getPrevSnake(),
        getInterpolation(),
      )
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
    window.removeEventListener('resize', onResize)

    for (const seg of bodySegments) {
      seg.sphere.geometry?.dispose()
      seg.connector.geometry?.dispose()
    }
    for (const seg of bodyPool) {
      seg.sphere.geometry?.dispose()
      seg.connector.geometry?.dispose()
    }
    bodySegments.length = 0
    bodyPool.length = 0

    for (const { mesh, ring } of bonusMeshes.values()) {
      mesh.geometry?.dispose()
      ring.geometry?.dispose()
    }
    bonusMeshes.clear()

    for (const mesh of obstacleMeshes.values()) {
      mesh.geometry?.dispose()
    }
    obstacleMeshes.clear()

    bodySphereGeo?.dispose()
    connectorGeo?.dispose()
    headSphereGeo?.dispose()
    eyeWhiteGeo?.dispose()
    pupilGeo?.dispose()
    foodGeo?.dispose()
    ringGeo?.dispose()
    obstacleGeo?.dispose()
    headMat?.dispose()
    bodyMatEven?.dispose()
    bodyMatOdd?.dispose()
    connectorMat?.dispose()
    eyeWhiteMat?.dispose()
    pupilMat?.dispose()
    foodMat?.dispose()
    bonusMat?.dispose()
    ringMat?.dispose()
    obstacleMat?.dispose()

    if (renderer) {
      renderer.dispose()
      renderer = null
    }
    scene = null
    camera = null
  })

  return {
    isRendering,
    currentView,
    initCanvas,
    render,
    startRender,
    stopRender,
    cycleCameraView,
  }
}
