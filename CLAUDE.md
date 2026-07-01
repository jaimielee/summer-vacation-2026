# SUMMER VACATION — 프로젝트 안내 (Claude용)

우리 가족 여름 휴가(2026-07-29 ~ 08-08) 일정을 모바일에서 달력으로 보고,
날짜를 누르면 그날의 시간대별 계획이 달력 아래에 인라인으로 표시되는 정적 페이지.

## 스택 / 배포
- 순수 HTML/CSS/JS. 빌드 도구 없음.
- 배포: `main` 브랜치에 **커밋 & 푸시하면 GitHub Pages가 자동 재배포**(약 1분).
- 라이브: https://jaimielee.github.io/summer-vacation-2026/
- 검색엔진 차단(noindex + robots.txt) 유지할 것 — 가족 정보가 있어 공개 색인 금지.

## 파일 구조
- `index.html` — 뼈대. 타이틀 텍스트/메타 태그.
- `styles.css` — 디자인. 색상은 상단 `:root` 변수(`--c-grpA/B/C`, `--accent` 등).
- `data.js` — **일정 데이터. 대부분의 수정은 여기서 끝남.**
- `app.js` — 달력/상세 렌더링 로직. 구조를 바꿀 때만 손댐.

## data.js 에서 자주 하는 수정
- `RANGE` — 달력에 보이는 날짜 범위 `{ start, end }`.
- `EVENTS` — 달력에 색 바로 표시되는 일정 구간.
  각 항목 `{ id, label, start, end, color: 'grpA'|'grpB'|'grpC', lane }`.
  서로 겹치지 않으면 한 줄(lane 0)로 이어짐. label 이 바 위 글자.
- `SCHEDULES` — 날짜별 상세 시간표. 키는 `'YYYY-MM-DD'`,
  항목 `{ time, icon(이모지), title, sub, tag }`. 없는 날짜는 자동 생성됨.

## 수정 후 (필수)
```bash
git add -A && git commit -m "<무엇을 바꿨는지>" && git push
```
푸시하면 라이브에 자동 반영. 별도 배포 명령 불필요.

## 톤 / 규칙
- 모바일 우선(그리드는 `repeat(7, minmax(0,1fr))` 유지 — 안 그러면 모바일에서 날짜 밀림).
- 밝은 오렌지 톤, 둥근 카드, 이모지 아이콘.
