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

/* --- 달력 그리기 --- */
function buildCalendar() {
  const root = document.getElementById('calendar');
  root.innerHTML = '';
  const today = todayStr();

  MONTHS.forEach(({ year, month }) => {
    const monthEl = document.createElement('div');
    monthEl.className = 'month';

    const h2 = document.createElement('h2');
    h2.textContent = `${year}년 ${month}월`;
    monthEl.appendChild(h2);

    // 요일 헤더
    const dow = document.createElement('div');
    dow.className = 'dow';
    DOW_LABELS.forEach((d, i) => {
      const s = document.createElement('span');
      s.textContent = d;
      if (i === 0) s.classList.add('sun');
      if (i === 6) s.classList.add('sat');
      dow.appendChild(s);
    });
    monthEl.appendChild(dow);

    // 주 단위로 분해
    const first = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDow = first.getDay(); // 0=일

    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    for (let w = 0; w < cells.length / 7; w++) {
      const weekCells = cells.slice(w * 7, w * 7 + 7);
      monthEl.appendChild(buildWeek(year, month, weekCells, today));
    }

    root.appendChild(monthEl);
  });
}

function buildWeek(year, month, weekCells, today) {
  const week = document.createElement('div');
  week.className = 'week';

  // 날짜 숫자 줄
  const daysRow = document.createElement('div');
  daysRow.className = 'week-days';

  weekCells.forEach((d, i) => {
    const cell = document.createElement('div');
    cell.className = 'day';
    if (d === null) {
      cell.classList.add('empty');
      daysRow.appendChild(cell);
      return;
    }
    const dateStr = ymd(year, month, d);
    if (i === 0) cell.classList.add('sun');
    if (i === 6) cell.classList.add('sat');
    if (dateStr === today) cell.classList.add('today');

    const evs = eventsOnDate(dateStr);
    if (evs.length) cell.classList.add('has-ev');

    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = d;
    cell.appendChild(num);

    cell.addEventListener('click', () => openSheet(dateStr));
    daysRow.appendChild(cell);
  });
  week.appendChild(daysRow);

  // 이벤트 바 레인
  const lanes = document.createElement('div');
  lanes.className = 'lanes';

  // 이 주에 걸치는 이벤트를 lane 순서대로
  const maxLane = Math.max(...EVENTS.map(e => e.lane));
  for (let laneIdx = 0; laneIdx <= maxLane; laneIdx++) {
    const laneEvents = EVENTS.filter(e => e.lane === laneIdx);
    const laneEl = document.createElement('div');
    laneEl.className = 'lane';
    let placed = false;

    laneEvents.forEach(ev => {
      const seg = segmentInWeek(ev, year, month, weekCells);
      if (!seg) return;
      placed = true;
      const bar = document.createElement('div');
      bar.className = `bar bar--${ev.color}`;
      if (seg.contLeft) bar.classList.add('cont-left');
      if (seg.contRight) bar.classList.add('cont-right');
      bar.style.gridColumn = `${seg.startCol} / span ${seg.span}`;
      // 이벤트가 이 주에서 시작하면 라벨, 이어지는 주면 화살표
      bar.textContent = seg.showLabel ? ev.label : '‹ ' + ev.label;
      bar.title = ev.label;
      bar.addEventListener('click', (e) => {
        e.stopPropagation();
        openSheet(ev.start);
      });
      laneEl.appendChild(bar);
    });

    // 빈 레인도 자리 유지 (바 정렬 안정) — 단, 이 주에 아무 이벤트도 없으면 접기
    if (placed) lanes.appendChild(laneEl);
  }

  if (lanes.children.length) week.appendChild(lanes);
  return week;
}

/* 이벤트가 이 주(weekCells)에서 차지하는 컬럼 계산.
   반환: {startCol(1~7), span, contLeft, contRight, showLabel} 또는 null */
function segmentInWeek(ev, year, month, weekCells) {
  const evStart = parseYmd(ev.start).getTime();
  const evEnd = parseYmd(ev.end).getTime();

  let startIdx = -1, endIdx = -1;
  weekCells.forEach((d, i) => {
    if (d === null) return;
    const t = parseYmd(ymd(year, month, d)).getTime();
    if (t >= evStart && t <= evEnd) {
      if (startIdx === -1) startIdx = i;
      endIdx = i;
    }
  });
  if (startIdx === -1) return null;

  // 이 주 첫 유효일 / 마지막 유효일
  const firstValidDay = weekCells.find(d => d !== null);
  const lastValidDay = [...weekCells].reverse().find(d => d !== null);
  const weekFirst = parseYmd(ymd(year, month, firstValidDay)).getTime();
  const weekLast = parseYmd(ymd(year, month, lastValidDay)).getTime();

  return {
    startCol: startIdx + 1,
    span: endIdx - startIdx + 1,
    contLeft: evStart < weekFirst,   // 이전 주에서 이어짐
    contRight: evEnd > weekLast,     // 다음 주로 이어짐
    showLabel: evStart >= weekFirst, // 이 주에서 시작 → 라벨 표시
  };
}

/* --- 상세 시트 --- */
const sheet = document.getElementById('sheet');
const sheetBg = document.getElementById('sheet-bg');

function openSheet(dateStr) {
  const date = parseYmd(dateStr);
  const weekday = DOW_LABELS[date.getDay()];
  const data = SCHEDULES[dateStr];
  const evs = eventsOnDate(dateStr);

  // 헤더
  document.getElementById('sheet-date').textContent =
    `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
  document.getElementById('sheet-title').textContent =
    (data && data.title) || (evs.length ? evs.map(e => e.label.replace(/^📦 /, '')).join(' · ') : '이 날의 계획');

  // 태그 (진행 중 일정)
  const tagWrap = document.getElementById('sheet-tags');
  tagWrap.innerHTML = '';
  evs.forEach(ev => {
    const t = document.createElement('span');
    t.className = 't';
    t.style.background = `var(--c-${ev.color === 'jiyoung' ? 'jiyoung-c' : ev.color})`;
    t.textContent = ev.label.replace(/^📦 /, '');
    tagWrap.appendChild(t);
  });

  // 타임라인
  const tl = document.getElementById('timeline');
  tl.innerHTML = '';
  const items = (data && data.items) || fallbackItems(dateStr, evs);

  if (!items.length) {
    tl.innerHTML = '<div class="empty-note">아직 등록된 일정이 없어요.<br>data.js 에 추가해 주세요 ✍️</div>';
  } else {
    items.forEach((it, i) => tl.appendChild(buildTlItem(it, i, items.length)));
  }

  sheetBg.classList.add('open');
  sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
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
  const items = [
    { time: '09:00', icon: '☀️', title: '아침 · 하루 시작', sub: '오늘 일정을 확인해요', tag: '일상' },
  ];
  evs.forEach(ev => {
    items.push({
      time: '',
      icon: ev.color === 'move' ? '📦' : '📌',
      title: ev.label.replace(/^📦 /, ''),
      sub: `${ev.person} · ${ev.start} ~ ${ev.end}`,
      tag: ev.person,
    });
  });
  items.push({ time: '19:00', icon: '🍚', title: '저녁 · 마무리', sub: '가족과 함께', tag: '식사' });
  return items;
}

function closeSheet() {
  sheetBg.classList.remove('open');
  sheet.classList.remove('open');
  document.body.style.overflow = '';
}

/* --- 범례 --- */
function buildLegend() {
  const legend = document.getElementById('legend');
  const seen = new Set();
  const order = [
    { color: 'move', label: '이사' },
    { color: 'jiyoung', label: '지영 휴가' },
    { color: 'jaeyeon', label: '재연 방학' },
    { color: 'hayeon', label: '하연 방학' },
    { color: 'jeongmin', label: '정민 휴가' },
  ];
  order.forEach(o => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const dot = document.createElement('span');
    dot.className = `dot dot--${o.color}`;
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(o.label));
    legend.appendChild(chip);
  });
}

/* --- 시작 --- */
document.addEventListener('DOMContentLoaded', () => {
  buildLegend();
  buildCalendar();
  document.getElementById('sheet-back').addEventListener('click', closeSheet);
  sheetBg.addEventListener('click', closeSheet);
});
