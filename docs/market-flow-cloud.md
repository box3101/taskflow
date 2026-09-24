# 노트북 없이 수급 수집하기

수급 수집기는 `backend/src/app.ts` 서버 시작 시 등록됩니다. 한국시간 정규장에
거래일을 확인하고 1분마다 조회하여 PostgreSQL `flow_snapshots`에 저장합니다.
브라우저 접속은 필요하지 않지만 서버 프로세스는 계속 실행되어야 합니다.
DB만 클라우드에 있고 서버는 노트북에서 실행하는 경우, 노트북을 끄면 수집도 멈춥니다.

## Railway 앱 서비스

기존 Railway 프로젝트의 **앱 서비스**를 재사용합니다. PostgreSQL 서비스와 구분하세요.

1. GitHub 저장소 `box3101/taskflow`의 수급 수집 코드가 포함된 커밋을 배포합니다.
2. 서비스 Root Directory는 저장소 루트로 지정합니다. 루트 `package.json`의 기존
   postinstall이 프런트/백엔드 의존성 설치, Prisma 생성/마이그레이션, 빌드를 수행합니다.
3. 루트 `railway.json`은 `npm start`, `/health`, 재시작 정책 `ALWAYS`를 지정합니다.
4. 서비스 Settings에서 **Serverless/App Sleeping을 끄고**, 단일 replica로 실행합니다.
   별도 Railway Cron Schedule은 설정하지 않습니다. 내부 node-cron이 1분마다 동작합니다.
5. 앱 서비스 Variables에 아래 환경변수를 설정합니다. 로컬 `.env`가 자동 전달되지는 않습니다.

| 변수 | 용도 |
| --- | --- |
| `DATABASE_URL` | 기존 Railway PostgreSQL 연결 |
| `JWT_SECRET` | 앱의 기존 인증 설정 유지 |
| `KIS_APP_KEY`, `KIS_APP_SECRET` | 한국투자 실전 조회 API 인증 |
| `KIS_CASH_AMOUNT_UNIT`, `KIS_PROGRAM_AMOUNT_UNIT` | 공식 단위 대조 후 `won`, `million`, `eok` 설정 |

AI API 키는 수급 저장에 필요하지 않습니다. 기존 AI 기능을 사용하려면 별도로 설정합니다.
민감한 값은 GitHub/railway.json에 넣지 않습니다.

## 배포 후 확인

- 앱 로그에서 서버 시작 성공 여부를 확인합니다.
- 실제 배포 주소의 `/health` 응답을 확인합니다. 헬스체크 성공만으로 수집 성공을 판정하지 않습니다.
- 배포 앱에 로그인하여 수급 화면에서 API 설정과 DB 연결을 확인합니다.
- 다음 거래일 09:00 이후 `flow_snapshots`의 건수와 최신 `observedAt`이 증가하는지 확인합니다.
- 현물·선물·외국인 비차익·전체 비차익·지수의 값과 항목별 source 상태도 확인합니다.
  일부 항목이 실패한 기록도 저장될 수 있어 건수만으로 정상 수집을 판정하지 않습니다.
- 장외에는 `outside`, 휴장일에는 `holiday` 상태로 새 기록을 생성하지 않습니다.
- 클라우드 동작을 확인한 뒤 로컬 백엔드를 종료하면 동일 키의 중복 조회를 피할 수 있습니다.
  DB의 시각 unique 제약은 중복 저장을 막지만 여러 서버의 중복 API 호출까지 막지는 않습니다.

## 현재 확인 상태 (2026-09-24)

Railway 인증 후 `faithful-stillness/taskflow`의 Hobby 요금제, 앱/DB 실행 및 절전 꺼짐을 확인했습니다.
9/12~10/12 기간의 계정 전체 누적 사용료는 약 $1.30, API 예상액은 $2.42입니다.
일반 Hobby는 월 $5에 사용량 $5가 포함됩니다. 실제 청구액은 크레딧·면제·세금 등에 따라 달라집니다.
자동 수집의 증가분은 배포 후 실측해야 합니다. Claude 호출 요금은 Railway 요금과 별도입니다.

## 서버 자동 AI 분석

- 앱에만 `FLOW_AUTO_ENABLED=true`, `FLOW_AUTO_USER_ID=41`을 설정합니다. 로컬은 기본 비활성입니다.
- 장중 수집을 완료한 뒤 거래일 09:15~15:00, 15분 간격으로 수급만 분석합니다. 예측 구간은 15분입니다.
- 평일이어도 KIS 거래일 조회가 휴장으로 응답하면 실행하지 않습니다. 조회 실패 시에도 실행하지 않습니다.
- 최근 15분의 연속 관측과 다섯 항목(현물/선물/외국인 비차익/전체 비차익/지수)이 모두 있어야 합니다.
- 관측은 90초 이내여야 하며, 예약 시각의 첫 3분을 넘기면 과거 실행을 따라잡지 않습니다.
- 하루 24개 슬롯, 슬롯당 Claude 1회, 응답 최대 2,048토큰입니다. 실패도 실행 횟수에 포함합니다.
- 호출 전에 DB에 사용자/날짜/슬롯 유일 예약을 저장합니다. 재시작·여러 인스턴스에서도 같은 슬롯을 재호출하지 않습니다.
- 호출 중 서버가 중단되면 해당 슬롯은 재시도하지 않습니다. 5분이 지난 미완료 기록은 앱에서 중단으로 표시합니다.
- 결과는 관리자 소유 `flow_predictions`에 저장되어 앱의 AI 판단·검증에 표시됩니다. PDF와 상위 모델 자동 호출은 없습니다.
- 이후 가격도 서버가 저장하므로 앱 접속 시 규칙/AI 성적을 계산할 수 있습니다. 평가를 위해 노트북이 켜져 있을 필요가 없습니다.
- `/market-flow/agent/automation?date=YYYY-MM-DD`에서 소유자만 자동 실행 상태를 조회합니다.
- 앱에서 수동으로 추가 실행한 AI 분석은 위 자동 호출 한도와 별도입니다.

KIS 실조회에서 2026-09-24/25는 휴장, 28일은 거래일로 확인했습니다.
Claude 모델 조회와 구조화 응답 검증도 통과했습니다. 검증용 합성 응답은 예측 DB에 저장하지 않았습니다.
현재 장외/휴장 상태이므로 실제 장중 누적 및 첫 자동 예측 확인은 다음 거래일에 가능합니다.

### 배포 검증

- 2026-09-24 Railway 앱에 키와 자동 실행 설정을 적용하고 배포했습니다.
- 운영 `/health`, `/market-flow`, `/market-flow/agent`, `/market-flow/agent/automation` 인증 조회가 모두 HTTP 200입니다.
- 자동 상태는 `enabled=true`, `configured=true`, 15분 간격, 하루 최대 24회입니다. 휴장일 관측/판단은 0건입니다.
- 관련 테스트 68개, 백엔드/프론트엔드 빌드, Vue 타입 검사를 통과했습니다.
- 전체 비차익은 투자자별 표를 합산하지 않고 `comp-program-trade-today`의 `nabt_smtn_ntby_tr_pbmn`을 사용합니다.
  실조회에서 다섯 수급/지수 항목을 모두 확인했습니다. 단위는 별도 검증 전까지 API 원단위로 유지합니다.
- 수급 기능 관련 파일만 별도 배포 디렉터리에 반영해 CLI로 먼저 배포하고, 같은 변경을 Git에서 관리합니다.
  API 키는 Railway 환경변수에만 설정하며 저장소에는 포함하지 않습니다.

GitHub Actions 예약 실행은 최소 5분 간격이며 지연·누락될 수 있어, 이 1분 수집기의 실행 환경으로 사용하지 않습니다.

- [Railway 실행 설정](https://docs.railway.com/config-as-code/reference)
- [Railway Serverless](https://docs.railway.com/deployments/serverless)
- [GitHub Actions schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
