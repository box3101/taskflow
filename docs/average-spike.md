# Average 급등 탐지기 메뉴

`/spike`는 `C:/Average/index.html`의 급등 탭을 Vue 화면으로 옮긴 메뉴입니다.
원본의 첫 알림 기준, 2026-09-03 이후 표본, 날짜·라벨 필터, 청산 룰별 성적,
라벨별 성적, 시장 배경과 종목 상세를 유지합니다. 실매매는 기존 체결 기록의 조회입니다.

백엔드 설정:

```env
AVERAGE_ROOT=C:/Average
AVERAGE_SPIKE_OWNER_ID=<기록 소유자의 TaskFlow 사용자 ID>
PYTHON_BIN=python
```

백엔드 실행 디렉터리는 `backend`입니다. `scripts/read-average-spike.py`가
원본 `spike_dashboard.snapshot()`을 호출하여 채점 기록과 당일 알림을 함께 읽습니다.
30초마다 조회하며 서버에서 15초간 캐시합니다. 파일 쓰기, 탐지기 실행, 주문,
텔레그램 발송을 하지 않습니다. 원본 탐지기와 채점 작업은 Average에서 계속 실행합니다.
해당 소유자 외의 사용자는 API 조회가 거부됩니다.

Railway에는 로컬 `C:/Average`가 없습니다. 이 메뉴를 클라우드에서 사용하려면
Python 및 원본 스크립트·기록을 같은 서버에서 접근 가능하게 제공하고 환경변수를
설정해야 합니다. 설정이나 원본 데이터가 없으면 연결 오류를 표시합니다.
원본 데이터와 비밀키는 저장소에 복사하지 않습니다.
