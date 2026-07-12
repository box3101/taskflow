<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiBadge, UiButton, UiIcon } from '@leechanyong/ispark-ui'
import api from '../../api/client'

interface Holding {
  code: string
  name: string
  qty: number
  avgPrice: number
  scoreAtBuy: number | null
}

interface Trade {
  id: number
  stockCode: string
  stockName: string
  action: 'buy' | 'sell'
  price: number
  quantity: number
  scoreAtBuy: number | null
  reason: string | null
  date: string
}

interface PortfolioData {
  id: number
  initialCash: number
  maxStocks: number
  maxHoldDays: number
  rules: string | null
  cash: number
  holdings: Holding[]
  trades: Trade[]
}

const portfolio = ref<PortfolioData | null>(null)
const loading = ref(false)
const showTradeForm = ref(false)
const showSettings = ref(false)

// 매매 입력 폼
const form = ref({
  stockCode: '',
  stockName: '',
  action: 'buy' as 'buy' | 'sell',
  price: 0,
  quantity: 0,
  scoreAtBuy: null as number | null,
  reason: '',
  date: new Date().toISOString().slice(0, 10),
})

async function loadPortfolio() {
  loading.value = true
  try {
    const { data } = await api.get('/score-portfolio')
    portfolio.value = data.data
  } catch (e) {
    console.error('포트폴리오 로드 실패:', e)
  } finally {
    loading.value = false
  }
}

async function submitTrade() {
  if (!form.value.stockCode || !form.value.price || !form.value.quantity) return
  try {
    await api.post('/score-portfolio/trades', form.value)
    showTradeForm.value = false
    resetForm()
    await loadPortfolio()
  } catch (e) {
    console.error('매매 등록 실패:', e)
  }
}

async function deleteTrade(id: number) {
  if (!confirm('이 매매 기록을 삭제할까요?')) return
  await api.delete(`/score-portfolio/trades/${id}`)
  await loadPortfolio()
}

async function saveSettings() {
  if (!portfolio.value) return
  try {
    await api.patch('/score-portfolio', {
      initialCash: portfolio.value.initialCash,
      maxStocks: portfolio.value.maxStocks,
      maxHoldDays: portfolio.value.maxHoldDays,
      rules: portfolio.value.rules,
    })
    showSettings.value = false
  } catch (e) {
    console.error('설정 저장 실패:', e)
  }
}

function resetForm() {
  form.value = {
    stockCode: '',
    stockName: '',
    action: 'buy',
    price: 0,
    quantity: 0,
    scoreAtBuy: null,
    reason: '',
    date: new Date().toISOString().slice(0, 10),
  }
}

// 총 평가금액 (현금 + 보유종목 평가)
const totalValue = computed(() => {
  if (!portfolio.value) return 0
  const holdingsValue = portfolio.value.holdings.reduce((s, h) => s + h.avgPrice * h.qty, 0)
  return portfolio.value.cash + holdingsValue
})

// 총 수익률
const totalReturn = computed(() => {
  if (!portfolio.value) return 0
  return ((totalValue.value - portfolio.value.initialCash) / portfolio.value.initialCash) * 100
})

function formatMoney(v: number): string {
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}만`
  return v.toLocaleString()
}

function formatPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

onMounted(loadPortfolio)
</script>

<template>
  <div class="score-portfolio">
    <div class="section-header">
      <h3><UiIcon name="wallet" :size="18" /> 실자금 검증 포트폴리오</h3>
      <div class="header-btns">
        <UiButton size="sm" variant="secondary" @click="showSettings = !showSettings">
          <UiIcon name="settings" :size="14" />
        </UiButton>
        <UiButton size="sm" variant="primary" @click="showTradeForm = !showTradeForm">
          매매 등록
        </UiButton>
      </div>
    </div>

    <div v-if="loading" class="loading-msg">로딩 중...</div>

    <template v-else-if="portfolio">
      <!-- 설정 패널 -->
      <div v-if="showSettings" class="settings-panel">
        <div class="settings-grid">
          <label>초기자금 <input type="number" v-model.number="portfolio.initialCash" /></label>
          <label>최대 종목수 <input type="number" v-model.number="portfolio.maxStocks" /></label>
          <label>최대 보유일 <input type="number" v-model.number="portfolio.maxHoldDays" /></label>
        </div>
        <label class="rules-label">매매 규칙
          <textarea v-model="portfolio.rules" rows="3" placeholder="예: 스코어 70+ 종목만 매수, 추격매수 금지, -5% 손절"></textarea>
        </label>
        <UiButton size="sm" variant="primary" @click="saveSettings">규칙 저장</UiButton>
      </div>

      <!-- 요약 카드 -->
      <div class="summary-cards">
        <div class="card">
          <div class="card-label">초기자금</div>
          <div class="card-value">{{ formatMoney(portfolio.initialCash) }}원</div>
        </div>
        <div class="card">
          <div class="card-label">현금</div>
          <div class="card-value">{{ formatMoney(portfolio.cash) }}원</div>
        </div>
        <div class="card">
          <div class="card-label">평가금(장부)</div>
          <div class="card-value">{{ formatMoney(totalValue) }}원</div>
        </div>
        <div class="card">
          <div class="card-label">수익률</div>
          <div class="card-value" :style="{ color: totalReturn >= 0 ? '#ef4444' : '#3b82f6' }">
            {{ formatPct(totalReturn) }}
          </div>
        </div>
      </div>

      <!-- 규칙 경고 -->
      <div v-if="portfolio.rules" class="rules-display">
        <strong>📏 매매 규칙:</strong> {{ portfolio.rules }}
      </div>

      <!-- 보유 종목 -->
      <div v-if="portfolio.holdings.length > 0" class="holdings-section">
        <h4>보유 종목 ({{ portfolio.holdings.length }}/{{ portfolio.maxStocks }})</h4>
        <div class="holdings-list">
          <div v-for="h in portfolio.holdings" :key="h.code" class="holding-item">
            <span class="h-name">{{ h.name }}</span>
            <span class="h-qty">{{ h.qty }}주</span>
            <span class="h-avg">평균 {{ h.avgPrice.toLocaleString() }}원</span>
            <UiBadge v-if="h.scoreAtBuy" variant="warning" size="sm">S{{ h.scoreAtBuy }}</UiBadge>
          </div>
        </div>
      </div>

      <!-- 매매 입력 폼 -->
      <div v-if="showTradeForm" class="trade-form">
        <h4>매매 등록</h4>
        <div class="form-grid">
          <label>종목코드 <input v-model="form.stockCode" placeholder="000660" /></label>
          <label>종목명 <input v-model="form.stockName" placeholder="SK하이닉스" /></label>
          <label>구분
            <select v-model="form.action">
              <option value="buy">매수</option>
              <option value="sell">매도</option>
            </select>
          </label>
          <label>체결가 <input type="number" v-model.number="form.price" /></label>
          <label>수량 <input type="number" v-model.number="form.quantity" /></label>
          <label>스코어 <input type="number" v-model.number="form.scoreAtBuy" placeholder="선택" /></label>
          <label>날짜 <input type="date" v-model="form.date" /></label>
          <label>사유 <input v-model="form.reason" placeholder="매매 사유" /></label>
        </div>
        <div class="form-total" v-if="form.price && form.quantity">
          총액: {{ (form.price * form.quantity).toLocaleString() }}원
        </div>
        <div class="form-actions">
          <UiButton size="sm" variant="secondary" @click="showTradeForm = false">취소</UiButton>
          <UiButton size="sm" variant="primary" @click="submitTrade">등록</UiButton>
        </div>
      </div>

      <!-- 매매 히스토리 -->
      <div class="trades-section">
        <h4>매매 기록</h4>
        <div v-if="portfolio.trades.length === 0" class="loading-msg">아직 매매 기록이 없습니다.</div>
        <table v-else class="trades-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>구분</th>
              <th>종목</th>
              <th>가격</th>
              <th>수량</th>
              <th>금액</th>
              <th>스코어</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in portfolio.trades" :key="t.id">
              <td>{{ t.date.slice(5) }}</td>
              <td>
                <UiBadge :variant="t.action === 'buy' ? 'danger' : 'default'" size="sm">
                  {{ t.action === 'buy' ? '매수' : '매도' }}
                </UiBadge>
              </td>
              <td>{{ t.stockName }}</td>
              <td>{{ t.price.toLocaleString() }}</td>
              <td>{{ t.quantity }}</td>
              <td>{{ (t.price * t.quantity).toLocaleString() }}</td>
              <td>{{ t.scoreAtBuy || '-' }}</td>
              <td><button class="del-btn" @click="deleteTrade(t.id)">×</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 소표본 경고 -->
      <div class="warning-box">
        ⚠️ 실자금 2~3거래 결과로 스코어 판단 금지. 이건 파이프라인·규율 테스트용.
        <br>스코어 성능은 구간 스프레드로만 판단하세요.
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.score-portfolio {
  background: #fff;
  border: 1px solid #e6e8ec;
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  h3 { font-size: 16px; font-weight: 700; margin: 0; }
}
.header-btns { display: flex; gap: 6px; }

.loading-msg { text-align: center; padding: 24px; color: #9ca3af; font-size: 14px; }

.settings-panel {
  background: #f9fafb;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
  label { font-size: 12px; color: #6b7280; display: flex; flex-direction: column; gap: 4px; }
  input { padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; }
}
.rules-label {
  font-size: 12px; color: #6b7280; display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px;
  textarea { padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; resize: vertical; }
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.card {
  text-align: center;
  padding: 12px 8px;
  background: #f9fafb;
  border-radius: 8px;
}
.card-label { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
.card-value { font-size: 16px; font-weight: 700; color: #374151; }

.rules-display {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 16px;
  color: #92400e;
}

.holdings-section {
  margin-bottom: 16px;
  h4 { font-size: 13px; font-weight: 600; margin: 0 0 8px; }
}
.holdings-list { display: flex; flex-direction: column; gap: 6px; }
.holding-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
}
.h-name { font-weight: 600; }
.h-qty { color: #6b7280; }
.h-avg { color: #9ca3af; font-size: 12px; }

.trade-form {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
  h4 { font-size: 13px; font-weight: 600; margin: 0 0 10px; }
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 10px;
  label { font-size: 11px; color: #6b7280; display: flex; flex-direction: column; gap: 3px; }
  input, select { padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; }
}
.form-total { font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #374151; }
.form-actions { display: flex; gap: 8px; justify-content: flex-end; }

.trades-section {
  margin-bottom: 16px;
  h4 { font-size: 13px; font-weight: 600; margin: 0 0 8px; }
}
.trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  th, td { padding: 6px 8px; text-align: center; border-bottom: 1px solid #f3f4f6; }
  th { background: #f9fafb; color: #6b7280; font-weight: 600; font-size: 11px; }
}
.del-btn {
  border: none; background: none; color: #d1d5db; font-size: 16px; cursor: pointer;
  &:hover { color: #ef4444; }
}

.warning-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  color: #991b1b;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .score-portfolio { padding: 14px; }
  .summary-cards { grid-template-columns: repeat(2, 1fr); }
  .settings-grid { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: repeat(2, 1fr); }
  .card-value { font-size: 14px; }
}
</style>
