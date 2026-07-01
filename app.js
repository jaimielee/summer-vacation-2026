/* =========================================================================
   달력 렌더링 + 날짜 상세 시트
   데이터는 data.js (EVENTS, MONTHS, SCHEDULES) 에 있습니다.
   ========================================================================= */

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/* --- 날짜 유틸 (로컬 기준, 타임존 안전) --- */
function ymd(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtYmd(date) {
  return ymd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
function todayStr() {
  return fmtYmd(new Date());
}

/* 특정 날짜(문자열)에 걸쳐있는 이벤트 목록 */
function eventsOnDate(dateStr) {
  const t = parseYmd(dateStr).getTime();
  return EVENTS.filter(ev => {
    const s = parseYmd(ev.start).getTime();
    const e = parseYmd(ev.end).getTime();
    return t >= s && t <= e;
  });
}

/* --- 달력 그리기 (RANGE 구간만, 한 줄 스트립) --- */
function buildCalendar() {
  const root = document.getElementById('calendar');
  root.innerHTML = '';
  const today = todayStr();

  // 요일 헤더 (한 번만)
  const dow = document.getElementById('dow');
  dow.innerHTML = '';
  DOW_LABELS.forEach((d, i) => {
    const s = document.createElement('span');
    s.textContent = d;
    if (i === 0) s.classList.add('sun');
    if (i === 6) s.classList.add('sat');
    dow.appendChild(s);
  });

  const rangeStart = parseYmd(RANGE.start);
  const rangeEnd = parseYmd(RANGE.end);

  // 그리드 시작 = 범위 시작일이 속한 주의 일요일
  const cur = new Date(rangeStart);
  cur.setDate(cur.getDate() - cur.getDay());

  while (cur.getTime() <= rangeEnd.getTime()) {
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur);
      d.setDate(cur.getDate() + i);
      weekDates.push(d);
    }
    root.appendChild(buildWeek(weekDates, rangeStart, rangeEnd, today));
    cur.setDate(cur.getDate() + 7);
  }
}

function inRange(date, rangeStart, rangeEnd) {
  const t = date.getTime();
  return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
}

function buildWeek(weekDates, rangeStart, rangeEnd, today) {
  const week = document.createElement('div');
  week.className = 'week';

  // 날짜 숫자 줄
  const daysRow = document.createElement('div');
  daysRow.className = 'week-days';

  weekDates.forEach((date, i) => {
    const cell = document.createElement('div');
    cell.className = 'day';
    if (!inRange(date, rangeStart, rangeEnd)) {
      cell.classList.add('empty');
      daysRow.appendChild(cell);
      return;
    }
    const dateStr = fmtYmd(date);
    if (i === 0) cell.classList.add('sun');
    if (i === 6) cell.classList.add('sat');
    if (dateStr === today) cell.classList.add('today');

    const evs = eventsOnDate(dateStr);
    if (evs.length) cell.classList.add('has-ev');

    cell.dataset.date = dateStr;

    const num = document.createElement('div');
    num.className = 'num';
    // 매월 1일은 "8/1" 처럼 월을 함께 표시해 헷갈리지 않게
    num.textContent = date.getDate() === 1
      ? `${date.getMonth() + 1}/1`
      : date.getDate();
    if (date.getDate() === 1) num.classList.add('first');
    cell.appendChild(num);

    cell.addEventListener('click', () => selectByDate(dateStr));
    daysRow.appendChild(cell);
  });
  week.appendChild(daysRow);

  // 이벤트 바 레인
  const lanes = document.createElement('div');
  lanes.className = 'lanes';

  const maxLane = Math.max(...EVENTS.map(e => e.lane));
  for (let laneIdx = 0; laneIdx <= maxLane; laneIdx++) {
    const laneEvents = EVENTS.filter(e => e.lane === laneIdx);
    const laneEl = document.createElement('div');
    laneEl.className = 'lane';
    let placed = false;

    laneEvents.forEach(ev => {
      const seg = segmentInWeek(ev, weekDates, rangeStart, rangeEnd);
      if (!seg) return;
      placed = true;
      const bar = document.createElement('div');
      bar.className = `bar bar--${ev.color}`;
      if (seg.contLeft) bar.classList.add('cont-left');
      if (seg.contRight) bar.classList.add('cont-right');
      bar.style.gridColumn = `${seg.startCol} / span ${seg.span}`;
      bar.textContent = seg.showLabel ? ev.label : '‹ ' + ev.label;
      bar.title = ev.label;
      bar.addEventListener('click', (e) => {
        e.stopPropagation();
        selectByDate(ev.start);
      });
      laneEl.appendChild(bar);
    });

    if (placed) lanes.appendChild(laneEl);
  }

  if (lanes.children.length) week.appendChild(lanes);
  return week;
}

/* 이벤트가 이 주에서 차지하는 컬럼 계산 (범위 밖 칸은 제외).
   반환: {startCol(1~7), span, contLeft, contRight, showLabel} 또는 null */
function segmentInWeek(ev, weekDates, rangeStart, rangeEnd) {
  const evStart = parseYmd(ev.start).getTime();
  const evEnd = parseYmd(ev.end).getTime();

  let startIdx = -1, endIdx = -1;
  const inRangeIdx = [];
  weekDates.forEach((date, i) => {
    if (!inRange(date, rangeStart, rangeEnd)) return;
    inRangeIdx.push(i);
    const t = date.getTime();
    if (t >= evStart && t <= evEnd) {
      if (startIdx === -1) startIdx = i;
      endIdx = i;
    }
  });
  if (startIdx === -1) return null;

  const weekFirst = weekDates[inRangeIdx[0]].getTime();
  const weekLast = weekDates[inRangeIdx[inRangeIdx.length - 1]].getTime();

  return {
    startCol: startIdx + 1,
    span: endIdx - startIdx + 1,
    contLeft: evStart < weekFirst,   // 이전 주에서 이어짐
    contRight: evEnd > weekLast,     // 다음 주로 이어짐
    showLabel: evStart >= weekFirst, // 이 주에서 시작 → 라벨 표시
  };
}

/* --- 상세 일정 (달력 아래 인라인 표시) --- */

/* 날짜 선택: 달력에서 해당 칸을 강조하고, 아래에 상세를 그린다 */
function selectByDate(dateStr) {
  document.querySelectorAll('.day.selected').forEach(d => d.classList.remove('selected'));
  const cell = document.querySelector(`.day[data-date="${dateStr}"]`);
  if (cell) cell.classList.add('selected');
  renderDetail(dateStr);
}

function renderDetail(dateStr) {
  const date = parseYmd(dateStr);
  const weekday = DOW_LABELS[date.getDay()];
  const data = SCHEDULES[dateStr];
  const evs = eventsOnDate(dateStr);

  const wrap = document.getElementById('detail');
  wrap.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'detail-card';

  // 헤더
  const head = document.createElement('div');
  head.className = 'detail-head';

  const big = document.createElement('div');
  big.className = 'date-big';
  big.textContent = `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
  head.appendChild(big);

  const sub = document.createElement('p');
  sub.className = 'date-sub';
  sub.textContent =
    (data && data.title) || (evs.length ? evs.map(e => e.label).join(' · ') : '이 날의 계획');
  head.appendChild(sub);

  if (evs.length) {
    const tagWrap = document.createElement('div');
    tagWrap.className = 'tags';
    evs.forEach(ev => {
      const t = document.createElement('span');
      t.className = 't';
      t.style.background = `var(--c-${ev.color})`;
      t.textContent = ev.label;
      tagWrap.appendChild(t);
    });
    head.appendChild(tagWrap);
  }
  card.appendChild(head);

  // 타임라인
  const tl = document.createElement('div');
  tl.className = 'timeline';
  const items = (data && data.items) || fallbackItems(dateStr, evs);
  if (!items.length) {
    tl.innerHTML = '<div class="empty-note">등록된 일정이 없어요.</div>';
  } else {
    items.forEach((it, i) => tl.appendChild(buildTlItem(it, i, items.length)));
  }
  card.appendChild(tl);

  wrap.appendChild(card);
}

function buildTlItem(it, idx, total) {
  const item = document.createElement('div');
  item.className = 'tl-item';

  const time = document.createElement('div');
  time.className = 'tl-time';
  time.textContent = it.time || '';

  const rail = document.createElement('div');
  rail.className = 'tl-rail';
  const node = document.createElement('div');
  node.className = 'tl-node';
  node.textContent = it.icon || '•';
  rail.appendChild(node);

  const card = document.createElement('div');
  card.className = 'tl-card';
  const h = document.createElement('div');
  h.className = 'h';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = it.title || '';
  h.appendChild(title);
  if (it.tag) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = it.tag;
    h.appendChild(tag);
  }
  card.appendChild(h);
  if (it.sub) {
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = it.sub;
    card.appendChild(sub);
  }

  item.appendChild(time);
  item.appendChild(rail);
  item.appendChild(card);
  return item;
}

/* 상세가 없는 날: 진행 중 일정으로 간단한 하루 자동 생성 */
function fallbackItems(dateStr, evs) {
  if (!evs.length) return [];
  const label = evs[0].label;
  return [
    { time: '09:00', icon: '☀️', title: '아침 · 하루 시작', sub: `오늘은 「${label}」 일정`, tag: label },
    { time: '12:30', icon: '🍽️', title: '점심', sub: '맛집 탐방', tag: '식사' },
    { time: '15:00', icon: '🌳', title: '오후 활동', sub: '가까운 곳 나들이', tag: label },
    { time: '19:00', icon: '🍚', title: '저녁', sub: '다 같이 저녁', tag: '식사' },
  ];
}

/* --- 시작 --- */
document.addEventListener('DOMContentLoaded', () => {
  buildCalendar();
  selectByDate(RANGE.start); // 첫날 상세를 기본으로 표시
});
