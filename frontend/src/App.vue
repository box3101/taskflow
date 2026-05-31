<script setup lang="ts">
</script>

<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
  background: #f5f6f8;
  color: #1a1f2b;
  min-height: 100vh;
  transition: background 0.2s, color 0.2s;
}

/* ===================================
   다크모드 글로벌 오버라이드
   taskflow 컴포넌트들이 하드코딩 색상을 쓰므로
   글로벌 CSS로 일괄 전환
   =================================== */
[data-theme="dark"] body {
  background: #111827;
  color: #d1d5db;
}

/* 레이아웃 배경 */
[data-theme="dark"] .layout {
  background: #111827 !important;
}

/* 헤더, 사이드, 탭바 */
[data-theme="dark"] .header {
  background: #1f2937 !important;
  border-bottom-color: #374151 !important;
}
[data-theme="dark"] .menu-toggle-btn {
  color: #d1d5db !important;
}
[data-theme="dark"] .side-menu {
  background: #1f2937 !important;
  border-right-color: #374151 !important;
}
[data-theme="dark"] .side-menu__item {
  color: #d1d5db !important;
}
[data-theme="dark"] .side-menu__item:hover {
  background: #374151 !important;
}
[data-theme="dark"] .bottom-nav {
  background: #1f2937 !important;
  border-top-color: #374151 !important;
}
[data-theme="dark"] .bottom-nav__item {
  color: #9ca3af !important;
}
[data-theme="dark"] .bottom-nav__item:hover,
[data-theme="dark"] .bottom-nav__item.is-active {
  color: #f3f4f6 !important;
}
[data-theme="dark"] .user-avatar-btn:hover {
  background: #374151 !important;
}

/* 인사말 텍스트 */
[data-theme="dark"] .dashboard__greeting-title,
[data-theme="dark"] .dashboard__greeting {
  color: #f3f4f6 !important;
}
[data-theme="dark"] .dashboard__greeting-sub {
  color: #9ca3af !important;
}

/* 로고 */
[data-theme="dark"] .header-logo {
  filter: brightness(2);
}

/* 탭 (할일/완료/휴지통 등) */
[data-theme="dark"] .ui-tab-trigger {
  color: #9ca3af !important;
}
[data-theme="dark"] .ui-tab-trigger[data-state="active"],
[data-theme="dark"] .ui-tab-trigger.is-active {
  color: #f3f4f6 !important;
}

/* Select (필터 드롭다운) */
[data-theme="dark"] .ui-select-trigger {
  background: #374151 !important;
  border-color: #4b5563 !important;
  color: #d1d5db !important;
}

/* 캘린더 위젯 (오늘의 일정) 제목 */
[data-theme="dark"] .calendar-widget__header,
[data-theme="dark"] .todo-quick__header,
[data-theme="dark"] .project-summary__header {
  color: #f3f4f6 !important;
}

/* 전체보기 링크 */
[data-theme="dark"] a,
[data-theme="dark"] .todo-quick__header button,
[data-theme="dark"] .project-summary__header button {
  color: #60a5fa !important;
}

/* 보조 텍스트 전체 */
[data-theme="dark"] .stat-card__value {
  color: #f3f4f6 !important;
}
[data-theme="dark"] .stat-card__label {
  color: #9ca3af !important;
}

/* 날씨 위젯 텍스트 */
[data-theme="dark"] .weather-outfit__temp {
  color: #f3f4f6 !important;
}
[data-theme="dark"] .weather-outfit__row3 {
  color: #9ca3af !important;
}

/* 기분 위젯 */
[data-theme="dark"] .mood-widget__title,
[data-theme="dark"] .mood-widget__label {
  color: #d1d5db !important;
}
[data-theme="dark"] .mood-widget__stats {
  border-top-color: #374151 !important;
  color: #9ca3af !important;
}

/* 명언 */
[data-theme="dark"] .daily-quote__content {
  color: #d1d5db !important;
}
[data-theme="dark"] .daily-quote__text,
[data-theme="dark"] .daily-quote__author-name {
  color: #9ca3af !important;
}
[data-theme="dark"] .daily-quote__input-btn {
  color: #6b7280 !important;
  border-top-color: #374151 !important;
}

/* 배경: #fff, #f5f6f8, #f8fafc, #f9fafb, #f4f7f9 → 다크 배경 */
[data-theme="dark"] .dashboard__quote,
[data-theme="dark"] .stat-card,
[data-theme="dark"] .todo-quick,
[data-theme="dark"] .project-summary,
[data-theme="dark"] .calendar-widget,
[data-theme="dark"] .mood-widget,
[data-theme="dark"] .weather-outfit {
  background: linear-gradient(145deg, #1f2937 0%, #1e2a42 100%) !important;
  border-color: #374151 !important;
  color: #d1d5db !important;
}
[data-theme="dark"] .dashboard__quote-weather {
  color: #d1d5db;
}
[data-theme="dark"] .daily-quote,
[data-theme="dark"] .todo-card,
[data-theme="dark"] .ai-tool-card,
[data-theme="dark"] .skill-drawer,
[data-theme="dark"] .drawer-form,
[data-theme="dark"] .health-page__side,
[data-theme="dark"] .health-page__stats,
[data-theme="dark"] .workout-card,
[data-theme="dark"] .meal-item {
  background: #1f2937 !important;
  border-color: #374151 !important;
  color: #d1d5db;
}

/* 텍스트: 제목 (#1f2937, #1e2124, #1a1f2b) → 밝은 텍스트 */
[data-theme="dark"] h1,
[data-theme="dark"] h2,
[data-theme="dark"] h3,
[data-theme="dark"] h4 {
  color: #f3f4f6 !important;
}

/* 보조 텍스트: #4d5462, #64748b, #6b7280, #9ca3af */
[data-theme="dark"] .stat-card__label,
[data-theme="dark"] .todo-quick__header span,
[data-theme="dark"] .project-summary__header span {
  color: #9ca3af !important;
}

/* 보더/구분선: #e5e7eb, #f3f4f6, #ecf0f3, #dce4e9 → 어두운 보더 */
[data-theme="dark"] .dashboard__quote-weather,
[data-theme="dark"] .dashboard__stats,
[data-theme="dark"] .dashboard__content {
  border-color: #374151 !important;
}

/* 입력 필드 */
[data-theme="dark"] input,
[data-theme="dark"] textarea,
[data-theme="dark"] select {
  background: #374151 !important;
  color: #d1d5db !important;
  border-color: #4b5563 !important;
}

/* 캘린더 */
[data-theme="dark"] .calendar-grid,
[data-theme="dark"] .calendar-month,
[data-theme="dark"] .day-cell {
  color: #d1d5db;
}
[data-theme="dark"] .day-cell.is-other-month {
  color: #4b5563 !important;
}
[data-theme="dark"] .day-cell:hover {
  background: #374151 !important;
}

/* 프로젝트 테이블 */
[data-theme="dark"] .ui-table-wrap,
[data-theme="dark"] table,
[data-theme="dark"] th,
[data-theme="dark"] td {
  background: #1f2937 !important;
  border-color: #374151 !important;
  color: #d1d5db !important;
}
[data-theme="dark"] th {
  color: #9ca3af !important;
}

/* 카드 hover */
[data-theme="dark"] .todo-card:hover,
[data-theme="dark"] .ai-tool-card:hover,
[data-theme="dark"] .stat-card:hover {
  background: #374151 !important;
}

/* 주식 */
[data-theme="dark"] .stock-section,
[data-theme="dark"] .stock-card,
[data-theme="dark"] .holding-summary,
[data-theme="dark"] .foreign-table,
[data-theme="dark"] .stock-calendar,
[data-theme="dark"] .ai-analysis,
[data-theme="dark"] .theme-list,
[data-theme="dark"] .smart-score {
  background: #1f2937 !important;
  border-color: #374151 !important;
  color: #d1d5db !important;
}

/* Drawer */
[data-theme="dark"] .ui-drawer {
  background: #1f2937 !important;
}
[data-theme="dark"] .ui-drawer-header {
  border-bottom-color: #374151 !important;
}
[data-theme="dark"] .ui-drawer-footer {
  border-top-color: #374151 !important;
}
[data-theme="dark"] .ui-drawer-title {
  color: #f3f4f6 !important;
}

/* 오늘의 일정 */
[data-theme="dark"] .calendar-widget {
  background: #1f2937 !important;
  border-color: #374151 !important;
  color: #d1d5db !important;
}

/* 모든 텍스트 강제 밝게 */
[data-theme="dark"] p,
[data-theme="dark"] span,
[data-theme="dark"] li,
[data-theme="dark"] label,
[data-theme="dark"] div {
  color: inherit;
}

/* 할일/프로젝트 목록 아이템 텍스트 */
[data-theme="dark"] .todo-quick__item,
[data-theme="dark"] .todo-quick__title,
[data-theme="dark"] .todo-quick__item-title,
[data-theme="dark"] .project-summary__item,
[data-theme="dark"] .project-summary__name,
[data-theme="dark"] .project-summary__item-name {
  color: #d1d5db !important;
}
[data-theme="dark"] .todo-quick__dday,
[data-theme="dark"] .project-summary__meta {
  color: #9ca3af !important;
}

/* 구분선 */
[data-theme="dark"] .todo-quick__item + .todo-quick__item,
[data-theme="dark"] .project-summary__item + .project-summary__item {
  border-top-color: #374151 !important;
}
[data-theme="dark"] hr,
[data-theme="dark"] [class*="__divider"] {
  border-color: #374151 !important;
}

/* 캘린더 위젯 내부 */
[data-theme="dark"] .calendar-widget__title {
  color: #f3f4f6 !important;
}
[data-theme="dark"] .calendar-widget__item,
[data-theme="dark"] .calendar-widget__item-title,
[data-theme="dark"] .calendar-widget__item-sub {
  color: #d1d5db !important;
}
[data-theme="dark"] .calendar-widget__empty {
  color: #6b7280 !important;
}

/* 날씨 위젯 전체 텍스트 */
[data-theme="dark"] .weather-outfit * {
  color: #d1d5db !important;
}
[data-theme="dark"] .weather-outfit__status {
  color: #60a5fa !important;
}

/* 하단 탭바 active 상태 */
[data-theme="dark"] .bottom-nav__item.is-active {
  background: #374151 !important;
  color: #f3f4f6 !important;
}

/* 오늘의 일정 Todo 카드 배경 (라이트 핑크 → 다크 대응) */
[data-theme="dark"] .calendar-widget__event {
  background: #3b1f1f !important;
  border-color: #7f1d1d !important;
}

/* 스크롤바 */
[data-theme="dark"] ::-webkit-scrollbar-track {
  background: #1f2937;
}
[data-theme="dark"] ::-webkit-scrollbar-thumb {
  background: #4b5563;
}
</style>
