<template>
  <div class="upgrade-overlay" @click.self="$emit('close')">
    <div class="upgrade-panel">
      <div class="upgrade-panel__header">
        <h2 class="upgrade-panel__title">🏪 Улучшения</h2>
        <div class="upgrade-panel__coins">🪙 {{ coins }}</div>
        <button class="upgrade-panel__close" @click="$emit('close')" aria-label="Закрыть">✕</button>
      </div>
      <div class="upgrade-panel__list">
        <div
          v-for="def in defs"
          :key="def.id"
          class="upgrade-card"
          :class="{ 'upgrade-card--maxed': isMaxed(def.id) }"
        >
          <div class="upgrade-card__icon">{{ def.icon }}</div>
          <div class="upgrade-card__body">
            <div class="upgrade-card__header">
              <span class="upgrade-card__name">{{ def.name }}</span>
              <span class="upgrade-card__level">
                Ур. {{ getLevel(def.id) }} / {{ def.maxLevel }}
              </span>
            </div>
            <div class="upgrade-card__desc">{{ def.description(getLevel(def.id)) }}</div>
            <div class="upgrade-card__progress">
              <div
                class="upgrade-card__progress-fill"
                :style="{ width: (getLevel(def.id) / def.maxLevel * 100) + '%' }"
              />
            </div>
          </div>
          <button
            class="upgrade-card__buy"
            :disabled="!canBuy(def.id)"
            @click="handleBuy(def.id)"
          >
            <template v-if="isMaxed(def.id)">MAX</template>
            <template v-else>🪙 {{ getCost(def.id) }}</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UPGRADE_DEFS } from '~/composables/useUpgrades'
import type { UpgradeId } from '~/composables/useUpgrades'

const props = defineProps<{
  coins: number
  levels: Record<UpgradeId, number>
}>()

const emit = defineEmits<{
  (e: 'buy', id: UpgradeId): void
  (e: 'close'): void
}>()

const defs = UPGRADE_DEFS

const getLevel = (id: UpgradeId): number => props.levels[id] ?? 0

const getCost = (id: UpgradeId): number => {
  const def = defs.find(d => d.id === id)
  if (!def) return 0
  return def.costForLevel(getLevel(id) + 1)
}

const isMaxed = (id: UpgradeId): boolean => {
  const def = defs.find(d => d.id === id)
  if (!def) return true
  return getLevel(id) >= def.maxLevel
}

const canBuy = (id: UpgradeId): boolean => {
  if (isMaxed(id)) return false
  return props.coins >= getCost(id)
}

const handleBuy = (id: UpgradeId) => {
  if (canBuy(id)) {
    emit('buy', id)
  }
}
</script>

<style scoped>
.upgrade-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  padding: 1rem;
}

.upgrade-panel {
  width: 100%;
  max-width: 640px;
  max-height: 90vh;
  background: linear-gradient(145deg, rgba(20, 20, 45, 0.98), rgba(35, 20, 55, 0.98));
  border: 1px solid rgba(168, 85, 247, 0.4);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(168, 85, 247, 0.2);
  overflow: hidden;
}

.upgrade-panel__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(168, 85, 247, 0.2);
}

.upgrade-panel__title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  flex: 1;
}

.upgrade-panel__coins {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fbbf24;
  padding: 0.4rem 0.9rem;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}

.upgrade-panel__close {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s ease;
}

.upgrade-panel__close:hover {
  background: rgba(233, 69, 96, 0.3);
  border-color: rgba(233, 69, 96, 0.6);
}

.upgrade-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.upgrade-panel__list::-webkit-scrollbar {
  width: 6px;
}

.upgrade-panel__list::-webkit-scrollbar-thumb {
  background: rgba(168, 85, 247, 0.4);
  border-radius: 3px;
}

.upgrade-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.upgrade-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(168, 85, 247, 0.3);
}

.upgrade-card--maxed {
  opacity: 0.6;
}

.upgrade-card__icon {
  font-size: 2rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(168, 85, 247, 0.15);
  border-radius: 10px;
  flex-shrink: 0;
}

.upgrade-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.upgrade-card__header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}

.upgrade-card__name {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.upgrade-card__level {
  font-size: 0.8rem;
  color: #a78bfa;
  font-variant-numeric: tabular-nums;
}

.upgrade-card__desc {
  font-size: 0.85rem;
  color: #9ca3af;
}

.upgrade-card__progress {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 0.2rem;
}

.upgrade-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #a78bfa, #c084fc);
  transition: width 0.3s ease;
  border-radius: 2px;
}

.upgrade-card__buy {
  min-width: 90px;
  padding: 0.55rem 0.9rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border: 1px solid rgba(168, 85, 247, 0.6);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.upgrade-card__buy:hover:not(:disabled) {
  background: linear-gradient(135deg, #8b5cf6, #c084fc);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.5);
}

.upgrade-card__buy:disabled {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  color: #6b7280;
  cursor: not-allowed;
}
</style>
