<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiDrawer, UiInput, UiSelect, UiTextarea, UiButton, openToast } from '@leechanyong/ispark-ui'
import type { SelectOption } from '@leechanyong/ispark-ui'
import { STATUS_LABELS, type TradeLog } from '../../composables/useTradeLog'

const props = defineProps<{
  open: boolean
  log?: TradeLog | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [log: Partial<TradeLog>]
  deleted: [id: string]
}>()

const form = ref({
  stockName: '',
  stockCode: '',
  buyPrice: '',
  targetPrice: '',
  stopLoss: '',
  sellPrice: '',
  quantity: '1',
  buyDate: '',
  sellDate: '',
  status: 'holding',
  memo: '',
  realPnl: '',
  entryReason: '',
  exitReason: '',
})

const statusOptions: SelectOption[] = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

watch(() => props.open, (open) => {
  if (open) {
    if (props.log) {
      form.value = {
        stockName: props.log.stockName,
        stockCode: props.log.stockCode,
        buyPrice: String(props.log.buyPrice),
        targetPrice: props.log.targetPrice ? String(props.log.targetPrice) : '',
        stopLoss: props.log.stopLoss ? String(props.log.stopLoss) : '',
        sellPrice: props.log.sellPrice ? String(props.log.sellPrice) : '',
        quantity: String(props.log.quantity),
        buyDate: props.log.buyDate,
        sellDate: props.log.sellDate || '',
        status: props.log.status,
        memo: props.log.memo || '',
        realPnl: props.log.realPnl ? String(props.log.realPnl) : '',
        entryReason: props.log.entryReason || '',
        exitReason: props.log.exitReason || '',
      }
    } else {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      form.value = {
        stockName: '', stockCode: '', buyPrice: '', targetPrice: '', stopLoss: '',
        sellPrice: '', quantity: '1', buyDate: today, sellDate: '', status: 'holding', memo: '',
        realPnl: '', entryReason: '', exitReason: '',
      }
    }
  }
})

function handleSave() {
  if (!form.value.stockName.trim() || !form.value.buyPrice || !form.value.buyDate) {
    openToast({ message: '종목명, 매수가, 매수일은 필수입니다.', type: 'warning' })
    return
  }
  emit('saved', {
    stockName: form.value.stockName.trim(),
    stockCode: form.value.stockCode.trim(),
    buyPrice: Number(form.value.buyPrice),
    targetPrice: form.value.targetPrice ? Number(form.value.targetPrice) : null,
    stopLoss: form.value.stopLoss ? Number(form.value.stopLoss) : null,
    sellPrice: form.value.sellPrice ? Number(form.value.sellPrice) : null,
    quantity: Number(form.value.quantity) || 1,
    buyDate: form.value.buyDate,
    sellDate: form.value.sellDate || null,
    status: form.value.status as TradeLog['status'],
    memo: form.value.memo.trim() || null,
    realPnl: form.value.realPnl ? Number(form.value.realPnl) : null,
    entryReason: form.value.entryReason.trim() || null,
    exitReason: form.value.exitReason.trim() || null,
  })
}
</script>

<template>
  <UiDrawer
    :open="open"
    :title="log ? '매매 기록 수정' : '새 매매 기록'"
    @update:open="emit('update:open', $event)"
  >
    <div class="trade-form">
      <div class="trade-form__row">
        <div class="trade-form__field">
          <label>종목명 *</label>
          <UiInput v-model="form.stockName" placeholder="SK하이닉스" />
        </div>
        <div class="trade-form__field">
          <label>상태</label>
          <UiSelect v-model="form.status" :options="statusOptions" />
        </div>
      </div>

      <div class="trade-form__row">
        <div class="trade-form__field">
          <label>매수가 *</label>
          <UiInput v-model="form.buyPrice" number-only placeholder="235000" />
        </div>
        <div class="trade-form__field">
          <label>수량</label>
          <UiInput v-model="form.quantity" number-only placeholder="10" />
        </div>
      </div>

      <div class="trade-form__row">
        <div class="trade-form__field">
          <label>목표가</label>
          <UiInput v-model="form.targetPrice" number-only placeholder="280000" />
        </div>
        <div class="trade-form__field">
          <label>손절가</label>
          <UiInput v-model="form.stopLoss" number-only placeholder="220000" />
        </div>
      </div>

      <div class="trade-form__row">
        <div class="trade-form__field">
          <label>매수일 *</label>
          <UiInput v-model="form.buyDate" type="date" />
        </div>
        <div class="trade-form__field">
          <label>매도일</label>
          <UiInput v-model="form.sellDate" type="date" />
        </div>
      </div>

      <div v-if="form.status === 'profit' || form.status === 'stopped'" class="trade-form__row">
        <div class="trade-form__field">
          <label>매도가</label>
          <UiInput v-model="form.sellPrice" number-only placeholder="280000" />
        </div>
        <div class="trade-form__field">
          <label>실제 손익</label>
          <UiInput v-model="form.realPnl" number-only allow-negative placeholder="+37308 또는 -29136" />
        </div>
      </div>

      <div class="trade-form__field">
        <label>진입 사유</label>
        <UiInput v-model="form.entryReason" placeholder="돌파 매매, HBM 실적 기대 등" />
      </div>

      <div v-if="form.status === 'profit' || form.status === 'stopped'" class="trade-form__field">
        <label>청산 사유</label>
        <UiInput v-model="form.exitReason" placeholder="목표 도달, 손절선 이탈 등" />
      </div>

      <div class="trade-form__field">
        <label>메모</label>
        <UiTextarea v-model="form.memo" placeholder="추가 메모..." :rows="2" />
      </div>

      <div class="trade-form__actions">
        <UiButton
          v-if="log"
          variant="danger"
          size="sm"
          @click="emit('deleted', log!.id)"
        >
          삭제
        </UiButton>
        <div style="flex: 1" />
        <UiButton variant="secondary" size="sm" @click="emit('update:open', false)">취소</UiButton>
        <UiButton :variant="log ? 'secondary' : 'primary'" size="sm" @click="handleSave">
          {{ log ? '수정' : '저장' }}
        </UiButton>
      </div>
    </div>
  </UiDrawer>
</template>

<style scoped lang="scss">
.trade-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}
.trade-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.trade-form__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
  }
}
.trade-form__actions {
  display: flex;
  gap: 8px;
  padding-top: 8px;
}
:global([data-theme="dark"]) {
  .trade-form__field label { color: #9ca3af; }
}
</style>
