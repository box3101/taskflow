# 대장 3분 유지 모의 전략

## 합의한 최종 동작

기본 variant는 `GATE_10000000000_LEADER_STABLE_180`이다. 당일 누적 100억은 자격 게이트이며, 자격 통과 종목 중 등락률 1위를 대장으로 선정한다. 테마 거래대금 상위 3개에서 각각 평가한다. 테마 전체 유효 시세의 중앙값을 초과해야 하며 단독 UNMAPPED 테마는 예외다. 최초 진입은 09:05 이후 같은 후보가 조건을 180초 연속 유지했을 때다. 고점 돌파·09:30 대기를 사용하지 않는다.

새 대장이 조건을 180초 연속 유지하면 기존 포지션을 `LEADER_CHANGE`로 청산하고, 새 대장이 진입 가능하면 진입한다. 청산과 진입은 서로 다른 이벤트다. 손절 -3%, 테마 상위 3위 이탈, 마감 청산은 교체 타이머와 독립적이다. 충돌 우선순위는 손절 → 마감 → 테마 이탈 → 대장 교체다. 종료시각 이후 신규 교체 진입은 하지 않는다. 같은 후보의 손절 후 무조건 반복 진입하지 않는다. 동률은 현재 관측 중인 후보를 유지하고, 최초 동률은 코드순으로 결정하되 중앙값 조건은 그대로 적용한다.

진입은 variant 전체에서 하루 최대 3회이며 교체도 새 진입 1회다. 세 테마를 합산한다. 같은 틱에 복수 후보가 준비되면 테마 거래대금 순서로 남은 한도를 사용한다. 500억/1,000억은 독립 상태로 병행 기록한다. 소표본에 맞춘 자동 튜닝은 없다. 모든 수치 설정은 `backend/.env.example`에 있다. 당일 전략 설정은 상태에 고정해 재시작이나 장중 환경변수 변경으로 결과가 섞이지 않게 한다.

기존 `leaderBreakout`은 고정 모집단과 원래 09:30·돌파·재확인·손절/마감 규칙을 그대로 실행하고 새 화면의 대조군에 표시한다. 기존 JSON 모의·관측 기록은 삭제하지 않는다. 이전 여러 탐지기의 스케줄러 대신 `startSurge`만 앱에서 실행하므로 중복 스케줄러를 만들지 않는다. 원본 기록 탭은 읽기 전용 아카이브다. 실제 주문 API는 추가하지 않는다.

## 2026-10-07 체크리스트 규칙(B, 기존 조건 교체)

단타 체크리스트(많은 거래대금·최근 핫한 섹터·일봉 신고가 자리·섹터 대장 이력)를 기본 전략 조건에 넣었다. 날짜별 상태에 설정이 고정되므로 10/6 기록은 v1 규칙 그대로이고, 10/7부터 `surge-rotation-v2-checklist`로 기록된다.

- 핫한 테마: 최근 `SURGE_HOT_LOOKBACK_DAYS`(14)일 동안 1,000억·10% 급등일이 `SURGE_HOT_MIN`(2)회 이상 나온 테마만 상위 3 경쟁에 참여한다. 급등 이력이 아직 없으면 이 조건은 적용하지 않는다.
- 분봉 거래대금: 누적 거래대금 샘플 차이로 계산한 직전 1분 거래대금이 `SURGE_MINUTE_GATE_WON`(50억) 이상. 계산 불가(샘플 부족)는 불통과.
- 일봉 신고가 자리: 아침 배치가 pykrx로 직전 `SURGE_HIGH_DAYS`(60)거래일 최고가를 `high60`에 저장하고, 현재가가 그 `SURGE_NEAR_HIGH_PCT`(2%) 이내여야 한다. 고가가 없으면(장중 편입 종목 포함) 불통과.
- 대장 이력: 최근 `SURGE_LEADER_LOOKBACK_DAYS`(90)일 1,000억·10% 급등일이 `SURGE_LEADER_MIN`(1)회 이상. 급등 이력이 없으면 적용하지 않는다.
- 위 조건을 통과한 종목 중 등락률 1위·중앙값 초과·3분 유지는 기존과 같다. 500억/1,000억 비교 줄도 같은 체크리스트를 쓴다. `SURGE_CHECKLIST=false`로 v1 규칙으로 되돌릴 수 있다.

## 데이터와 수집

- Python 배치는 로컬/서버에서만 네이버 테마를 수집하며 GitHub Actions는 거부한다. 기본 08:30 KST 거래일 배치다.
- 2026-10-06: `finance.naver.com/sise/theme.naver`가 JS 앱(`stock.naver.com`)으로 리다이렉트되어 테마 0건으로 실패했다. 네이버 모바일 JSON API(`m.stock.naver.com/api/stocks/theme`, `/theme/{no}`)로 바꿨다. 요청별 3회 재시도, 실패한 테마만 건너뛰고 `NAVER_THEME_PARTIAL:n` 경고를 남긴다. 배치 경고는 화면 「배치·알림 처리 상태」에 표시한다.
- 3년 급등 이력(1,000억·10%)은 매일 16:05 KST에 빠진 완료일을 최신순으로 최대 `SURGE_BACKFILL_DAYS`(기본 120)일씩 자동 백필한다. 날짜별 체크포인트로 이어서 진행하며 수동 backfill 명령도 그대로 쓸 수 있다.
- 보유 종목 성적 제외(OBSERVATION_GAP)는 시세 수신이 30초 이상 끊긴 경우만이다. 종목 자체의 체결 공백(VI·거래 부진)은 제외 사유가 아니다(2026-10-06 변경).
- pykrx 완료 거래일 전종목 일봉에서 1,000억·10%를 통과한 행만 `SurgeHistory`에 저장한다. 과거 이력은 모집단 선정에만 쓰고 엔진에 전달하지 않는다. 완료일마다 체크포인트를 저장해 재실행 시 중복 수집을 줄인다.
- 전일 거래대금 상위 400 + 최근 3년 급등 이력 종목의 합집합이다. 500종목 이상을 보장하기 위해 임의로 종목을 추가하지 않는다. 현재 이름/시장/거래량과 KIS 관리·정지 상태를 확인한다.
- ThemeMap은 출처별로 보존한다. 한 종목의 기본 테마는 NAVER 우선, 없으면 SECTOR, 없으면 UNMAPPED다. 복수 NAVER 소속은 안정적인 themeId 순으로 하나를 선택하여 거래대금을 중복 합산하지 않는다. 당일 UniverseDay에 테마를 고정하고 보유 중 LLM 분류로 바꾸지 않는다.
- KIS 거래금액 순위는 1분 주기로 최대 7회 연속조회한다. 최대 200건을 목표로 하지만 연속조회 종료/중복 페이지에서 중단하고 실제 확보 건수·완전성을 저장한다. 7회가 항상 200건을 보장한다고 가정하지 않는다.
- 당일 테마 배치가 준비된 뒤에만 장중 편입한다. addedAt/rankAtAdd를 보존한다. 분봉 응답의 세션 고점을 1회 보충하며 실패 시 재시도한다. 기본 유지 전략은 고점을 사용하지 않으므로 의존하지 않는다. 기존 돌파 대조군은 기존 고정 모집단이라 신규 편입을 사용하지 않는다.
- 확대 모집단 전체는 60초, 후보·상위 테마 종목·보유는 최대 60종목을 10초 주기로 갱신한다. 보유 종목은 우선한다. 기존 고정 대조군은 원래 표본을 보존하기 위한 별도 수집이며 `SURGE_LEGACY_ENABLED=false`로 중지 가능하다.
- 모든 테마 시세를 90초 이내에 수신했고 당일 체결이 있는 경우에만 순위를 확정한다. VI·거래 부진으로 마지막 체결 시각만 오래된 종목은 현재 상태로 보고 허용한다(2026-10-06 변경). 누락 종목 수·사유는 상태에 기록해 화면에 표시한다. 후보 시세는 20초 이내이며 소스 시각이 진행해야 한다. 30초 이상 수집 공백은 타이머를 초기화하고 보유 성적을 제외 표시한다. 결측 때문에 테마 이탈을 만들어내지 않는다. 장 마감 단일가 구간은 기존 전략과 같은 별도 공백 예외가 있다.
- 모의 진입 직전 KIS 종목 상태와 VI 현황을 조회한다. 확인 실패는 `EXECUTION_STATUS_UNKNOWN`, VI·상한가는 차단한다. 호가 잔량에 따른 실제 체결을 보장하지 않는 관측가 모의 기록이다.

## 이벤트와 텔레그램

전략 상태·거래·이벤트는 동일 DB 트랜잭션으로 저장한다. 별도 subscriber가 이벤트를 읽어 `NotificationLog`를 만들고 전송한다. LLM과 Telegram 네트워크 호출은 전략 트랜잭션 안에서 실행하지 않는다.

`NOTIFY_ENABLED=false`가 기본이다. 대상은 전체 variant ID 하나이며 기본 게이트·180초 전략이다. ENTRY, LEADER_CHANGE, THEME_DROP만 기본 발송한다. STOP_LOSS/CLOSE는 설정으로 켠다. 새 대장 알림에는 이름·코드·현재 등락률과 직전 대장 등락률을 기록 당시 값으로 표시한다. HTML 특수문자를 이스케이프한다. 수집 공백/새 진입 차단 이유를 첨부한다.

이벤트 ID로 중복 enqueue를 막고 DB 원자적 claim으로 작업자 중복 전송을 막는다. 명시적 전송 실패는 재시도 1회, 429는 서버 retry_after와 지수 백오프 중 긴 시간을 따른다. 응답 타임아웃/전송 중 프로세스 종료는 성공 여부를 알 수 없어 자동 재전송하지 않는다. Telegram은 클라이언트 멱등 키를 지원하지 않으므로 네트워크 단절까지 포함한 정확히 한 번 전달을 보장하지 않는다. 최근 5분 이벤트만 새로 enqueue하여 활성화 시 옛 거래 알림이 쏟아지지 않게 한다.

## Sonnet 역할

사용 모델은 `claude-sonnet-5`이며 환경변수로 지정한다. 최초·교체 진입 이벤트 뒤 해당 종목의 당일 네이버 뉴스 검색 결과와 DART 공시 제목을 읽고 요약한다. 15:35 이후 해당 일 진입 종목의 문서들을 한 번 더 요약해 장 마감 자료 복기로 저장한다. 거래 성적은 코드 집계로 화면에 표시하며 LLM에 숫자 해석/임계값 개선을 맡기지 않는다.

뉴스 검색은 정확한 종목명이 제목에 들어간 당일 기사 최대 5건으로 제한하며 링크·발행시각을 보관한다. DART는 당일 목록을 페이지별로 읽고 종목 코드로 매칭한다. 기사 전문은 수집하지 않는다. 이는 제목 수준의 관련 자료 요약이며 상승 원인의 입증이 아니다.

2026-10-06: 뉴스 공급자를 NAVER API HUB의 `/search/v1/news`로 변경했다. Railway의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`에는 Ncloud API HUB에서 뉴스 권한을 부여한 인증키를 저장한다. 기존 개발자센터/네이버 로그인 키와 호환되지 않는다. 인증 헤더는 `X-NCP-APIGW-API-KEY-ID`, `X-NCP-APIGW-API-KEY`다. API 실패는 자료 수집 오류로 격리하며 모의 전략을 중단하지 않는다.

2026-10-06 변경: 제목만 요약해 내용이 빈약하다는 피드백으로 재료 정리를 강화했다. 네이버 뉴스는 최근 3일·본문 요약(description)까지 넣고, 진입 시 Anthropic 서버 측 웹 검색(`web_search_20260209`, 최대 `SURGE_WEB_SEARCH_MAX_USES`회)으로 정책·업황·리포트 자료를 찾는다. 웹 검색 인용(citation)만 근거로 등록한다. 출력은 summary(배경)·drivers(상승 배경)·outlook(앞으로 볼 일정·변수)·risks(유의점)·evidenceIds다. 매수·매도 권유와 가격 예측은 금지하며, 결과는 여전히 전략 엔진 입력으로 쓰지 않는다. `SURGE_WEB_SEARCH=false`로 웹 검색만 끌 수 있다.

2026-10-07 추가: 소유자(`AVERAGE_SPIKE_OWNER_ID`)가 수급 탭에 올리고 검색 준비를 마친 당일 장전 리포트 PDF 중, 진입 시각 이전에 올린 것에서 종목명·테마와 관련된 발췌 최대 4개를 PDF 근거로 함께 전달한다. 리포트의 [전망]은 작성자 전망으로 표시한다.

JSON 스키마, 입력에 있는 근거 ID, 문장 길이와 금지된 의견을 검사한다. 자료가 없으면 `확인된 당일 재료 없음`, 실패 시 기존 전략은 계속한다. 일일 한도는 실패/자료 없음 실행도 포함해 DB에서 예약한다. 자동 모델 대체와 자동 LLM 재시도는 없다. 뉴스와 모델 출력은 전략 엔진 입력으로 사용하지 않는다.

신규 테마 자동 생성/반영은 마지막 합의에 따라 이번 버전에서 활성화하지 않는다. LLM 우선순위·high 신뢰도·당일 만료를 위한 순수 병합 함수는 검증하지만 실제 배치는 NAVER/SECTOR만 쓴다. 원래 09:40/매시간 그룹 추출 기능 대신 진입 관련 요약과 마감 자료 복기를 구현했다.

## 실행

```powershell
cd backend
python -m pip install -r scripts/requirements-surge.txt
npx prisma migrate deploy
npx prisma generate
npm run surge:batch -- backfill 2023-10-06 2026-10-05
npm run surge:batch -- prepare 2026-10-06
npm run dev
```

현재 날짜에 맞게 backfill 범위를 바꾼다. 명령 실행 전 `npm run build`가 필요하다. batch 실패일은 체크포인트가 생성되지 않으므로 재실행한다. 네이버·KRX·KIS 공급 장애나 포맷 변경을 실데이터 검증 전 성공으로 간주하지 않는다. pykrx 1.2.9 실조회에서 KRX 로그인이 필요함을 확인했으므로 `KRX_ID`, `KRX_PW`를 설정한다.

운영은 Railway production/taskflow 환경변수를 사용한다. 비밀값을 로컬로 복사하지 않는다. Docker 이미지에 Python/pykrx와 Node를 포함하고 시작 시 Prisma migration을 적용한다. `SURGE_ENABLED=true`, 조회 소유자 `AVERAGE_SPIKE_OWNER_ID`를 지정한다. Telegram bot/chat, 네이버 검색 API, DART 키는 Railway Variables에 설정한다. LLM은 `SURGE_LLM_ENABLED=true`와 Anthropic 키를 요구한다. 뉴스·공시 키가 없으면 자료 없는 상태를 표시한다. 최초 모집단 준비가 안 되면 새 전략의 진입은 보류하고 기존 대조군만 관측한다.

집계 쿼리는 `docs/surge-rotation.sql`. 완료·관측 경로가 유효한 거래만 평균 순수익/승률/청산사유 집계에 넣는다. 평균 진입시각은 KST 자정부터의 초다.

## 검증과 출처

2026-10-06 검증: 백엔드 235개, 프론트엔드 61개, Python 배치 4개 테스트 통과. 백엔드 TypeScript/Prisma 생성과 프론트 Vite 빌드 통과. Railway 배포 `6d6c92e0-4f86-426b-ba76-4cd879f6c5fd` SUCCESS, migration 적용 완료. 운영 `/health` 200, `/spike` 200, 미인증 rotation API 401, 지정 소유자 API 200 확인. 소유자 ID는 41 (`chanyong@test.com`)이다.

2026-10-06 06:20 KST 재점검: Railway에 KRX, NAVER API HUB, Telegram 인증이 설정됐다. 뉴스 서버 호출 HTTP 200, Telegram 사용자 요청 예시 1건 발송 성공. NOTIFY_ENABLED=true이며 기본 100억·180초 variant만 알린다. DART_API_KEY는 아직 없다. Anthropic 모델 조회에서 claude-sonnet-5 HTTP 200을 확인했지만 실제 요약 생성 성공을 검증한 것은 아니다.

현재 운영 준비 한계: SurgeHistory 0건, 당일 UniverseDay 0건, 배치 기록 0건이다. 08:30 정기 준비 전이므로 당일 모집단이 없는 것은 예상 상태이나, 3년 과거 이력 백필은 별도로 실행·완료해야 한다. 500개 이상 확보 및 실시간 3분 관측→DB 이벤트→알림 전체 흐름은 아직 검증하지 않았다. 장전 KIS 거래대금 순위 실제 응답은 28개이며 complete=false다. 현재 페이징 구현으로 상위 200개를 확보했다고 간주하면 안 된다. 장중 재검증 및 조회 방식 보완이 남아 있다.

실서버 점검에서 삼성전자 응답은 iscd_stat_cls_code=55, temp_stop_yn=N, mang_issu_cls_code=N, sltr_yn=N이었다. 기존 55를 정리매매로 보는 해석을 제거하고 공식 현재가 응답의 임시정지·관리·정리매매 Y/N 필드로 자격을 판정하도록 수정했다. 필드가 누락되면 진입 자격을 부여하지 않는다. 또한 15:20 진입 종료와 보유 감시 종료를 분리해 대장 교체 청산은 15:30까지 계속한다. 이때 새 종목 진입은 하지 않는다. 관련 Vitest 35개와 Python 4개 통과.

Vitest에서 최초 유지, 교체 대기, 출렁임 취소, 동률, 중앙값, 손절/테마 이탈, 공백, 한도, VI/상한가, 독립 게이트, 뉴스 날짜/종목 필터, 스키마/근거 검증, 테마 우선순위/만료, HTML 포맷과 HTTP 실패/429를 검증한다. 외부 Telegram/LLM은 모킹한다.

- [KIS 거래금액 순위 예제](https://github.com/koreainvestment/open-trading-api/tree/main/examples_llm/domestic_stock/volume_rank)
- [KIS VI 현황](https://github.com/koreainvestment/open-trading-api/tree/main/examples_llm/domestic_stock/inquire_vi_status)
- [NAVER API HUB 뉴스 검색 API](https://api.ncloud-docs.com/docs/naver-api-hub-search-news)
- [DART 공시 검색](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001)
- [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage)
- [Sonnet 5](https://platform.claude.com/docs/en/docs/about-claude/models/whats-new-sonnet-5)
