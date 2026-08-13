// ============================================================
// CORNERSTONE ANGEL ROUNDS — Admin Dashboard v2 (timezone fixed)
// ============================================================

const SUPABASE_URL = 'https://qrvmlfkgpuqsogijlpoe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_huOYD7VwHKdnYFx_iNqF6w_IzcnSCj0';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let facilityPasscode = null;
let angelsData = [];
let bedsData = [];
let roundsData = [];
let roundBedsData = [];
let actionItemsData = [];
let currentActionFilter = 'open';
let currentRoundFilter = 'today';
let currentWeekOffset = 0;

const STANDUP_DEADLINE_HOUR = 10;
const IN_PROGRESS_WINDOW_MIN = 15;

// ============================================
// TIMEZONE-SAFE LOCAL DATE HELPER
// ============================================

function getLocalDateString(d) {
  const date = d || new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// ============================================
// STARTUP
// ============================================

window.addEventListener('DOMContentLoaded', async () => {
  await loadPasscode();

  const savedPasscode = localStorage.getItem('cornerstone_passcode');
  if (savedPasscode && savedPasscode === facilityPasscode) {
    showDashboard();
    await loadDashboard();
  }

  const today = new Date();
  document.getElementById('today-date').textContent = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  document.getElementById('passcode-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkPasscode();
  });

  setInterval(() => {
    if (!document.getElementById('dashboard').classList.contains('hidden')) {
      loadDashboard();
    }
  }, 60000);
});

async function loadPasscode() {
  try {
    const { data } = await db.from('settings').select('*');
    const row = data ? data.find(s => s.key === 'facility_passcode') : null;
    facilityPasscode = row ? row.value : 'CCC2026';
  } catch (err) {
    console.error(err);
  }
}

// ============================================
// PASSCODE
// ============================================

function checkPasscode() {
  const input = document.getElementById('passcode-input').value.trim();
  const errorBox = document.getElementById('passcode-error');

  if (input === facilityPasscode) {
    localStorage.setItem('cornerstone_passcode', input);
    errorBox.classList.add('hidden');
    showDashboard();
    loadDashboard();
  } else {
    errorBox.classList.remove('hidden');
    document.getElementById('passcode-input').value = '';
  }
}

function showDashboard() {
  document.getElementById('passcode-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
}

function switchTab(btn, tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  ['board', 'weekly', 'actions', 'rounds'].forEach(name => {
    document.getElementById('tab-' + name).classList.add('hidden');
  });
  document.getElementById('tab-' + tabName).classList.remove('hidden');

  if (tabName === 'weekly') renderWeekly();
}

// ============================================
// LOAD DATA
// ============================================

async function loadDashboard() {
  try {
    const today = getLocalDateString();
    const startDateD = new Date();
    startDateD.setDate(startDateD.getDate() - 30);
    const startDate = getLocalDateString(startDateD);

    const [angels, beds, rounds, roundBeds, actions] = await Promise.all([
      db.from('angels').select('*').eq('active', true).order('id'),
      db.from('beds').select('*').eq('active', true),
      db.from('rounds').select('*').gte('round_date', startDate).order('submitted_at', { ascending: false }),
      db.from('round_beds').select('*'),
      db.from('action_items').select('*').order('created_at', { ascending: false })
    ]);

    angelsData = angels.data || [];
    bedsData = beds.data || [];
    roundsData = rounds.data || [];
    roundBedsData = roundBeds.data || [];
    actionItemsData = actions.data || [];

    renderBoard(today);
    renderActionItems();
    renderRounds();
    updateBadges();

    document.getElementById('last-updated').textContent =
      'Last refreshed ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (err) {
    console.error('Dashboard load error:', err);
    alert('Could not load dashboard. Refresh and try again.');
  }
}

function renderBoard(today) {
  const todayRounds = roundsData.filter(r => r.round_date === today && r.round_status === 'submitted');
  const todayRoundIds = todayRounds.map(r => r.id);
  const todayBeds = roundBedsData.filter(b => todayRoundIds.includes(b.round_id));

  const rounderAngels = angelsData.filter(a => a.role !== 'Maintenance');
  const angelsDone = rounderAngels.filter(a => isAngelComplete(a, todayRounds));

  const roomsRounded = [...new Set(todayRounds.map(r => r.room_number))].length;
  const bedsChecked = todayBeds.length;

  const openActions = actionItemsData.filter(a => a.status === 'open');
  const urgentActions = openActions.filter(a => a.urgent);

  updateStat('stat-angels', angelsDone.length, 14);
  updateStat('stat-rooms', roomsRounded, 41);
  updateStat('stat-beds', bedsChecked, 99);

  const openEl = document.getElementById('stat-open');
  openEl.querySelector('.stat-number').textContent = openActions.length;
  openEl.classList.remove('warning', 'danger', 'good');
  if (urgentActions.length > 0) openEl.classList.add('danger');
  else if (openActions.length > 0) openEl.classList.add('warning');
  else openEl.classList.add('good');
  document.getElementById('stat-urgent-sub').textContent = 'Urgent: ' + urgentActions.length;

  renderCurrentlyRounding(rounderAngels, todayRounds);

  const missingAngels = rounderAngels.filter(a => !isAngelComplete(a, todayRounds));
  const now = new Date();
  const hour = now.getHours();
  const missingBanner = document.getElementById('missing-banner');
  if (missingAngels.length > 0 && hour >= STANDUP_DEADLINE_HOUR) {
    missingBanner.classList.remove('hidden');
    document.getElementById('missing-names').textContent =
      missingAngels.map(a => a.role + (a.current_person ? ' (' + a.current_person + ')' : '')).join(', ');
  } else {
    missingBanner.classList.add('hidden');
  }

  renderAngelCompliance(rounderAngels, todayRounds);
}

function renderCurrentlyRounding(rounderAngels, todayRounds) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - IN_PROGRESS_WINDOW_MIN * 60 * 1000);

  const currentlyRounding = [];

  rounderAngels.forEach(angel => {
    const angelRounds = todayRounds.filter(r => r.angel_role === angel.role);
    if (angelRounds.length === 0) return;

    const lastRound = angelRounds.reduce((latest, r) => {
      return new Date(r.submitted_at) > new Date(latest.submitted_at) ? r : latest;
    }, angelRounds[0]);

    const submitTime = new Date(lastRound.submitted_at);
    if (submitTime > cutoff && !isAngelComplete(angel, todayRounds)) {
      const roundedRooms = [...new Set(angelRounds.map(r => r.room_number))];
      const remaining = (angel.assigned_rooms || []).filter(r => !roundedRooms.includes(r));
      currentlyRounding.push({
        angel: angel,
        lastSubmit: submitTime,
        nextRoom: remaining[0] || null
      });
    }
  });

  const panel = document.getElementById('now-rounding-panel');
  const list = document.getElementById('now-rounding-list');

  if (currentlyRounding.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  list.innerHTML = currentlyRounding.map(x => {
    const person = x.angel.current_person || x.angel.role;
    const timeAgo = Math.round((now - x.lastSubmit) / 60000);
    const nextText = x.nextRoom ? '· next: Room ' + x.nextRoom : '· wrapping up';
    return '<span class="now-rounding-item"><strong>' + person + '</strong> (' + x.angel.role + ') ' + nextText + ' · ' + timeAgo + ' min ago</span>';
  }).join('');
}

function isAngelComplete(angel, todayRounds) {
  if (!angel.assigned_rooms || angel.assigned_rooms.length === 0) return false;
  const angelRounds = todayRounds.filter(r => r.angel_role === angel.role);
  const roundedRooms = [...new Set(angelRounds.map(r => r.room_number))];
  return angel.assigned_rooms.every(room => roundedRooms.includes(room));
}

function updateStat(id, value, total) {
  const el = document.getElementById(id);
  el.querySelector('.stat-number').textContent = value + ' / ' + total;
  el.classList.remove('warning', 'danger', 'good');
  const pct = value / total;
  if (pct >= 0.9) el.classList.add('good');
  else if (pct >= 0.5) el.classList.add('warning');
  else el.classList.add('danger');
}

function renderAngelCompliance(angels, todayRounds) {
  const tbody = document.getElementById('angel-compliance-body');
  if (angels.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No angels configured.</td></tr>';
    return;
  }

  tbody.innerHTML = angels.map(angel => {
    const angelRounds = todayRounds.filter(r => r.angel_role === angel.role);
    const roundedRooms = [...new Set(angelRounds.map(r => r.room_number))];
    const totalRooms = angel.assigned_rooms ? angel.assigned_rooms.length : 0;
    const rounded = roundedRooms.length;

    let statusClass, statusText;
    if (rounded === totalRooms && totalRooms > 0) {
      statusClass = 'compliance-good';
      statusText = '✓ Complete';
    } else if (rounded > 0) {
      statusClass = 'compliance-partial';
      statusText = '● Partial';
    } else {
      statusClass = 'compliance-missing';
      statusText = '○ Not started';
    }

    const person = angel.current_person || '(unfilled)';
    const rooms = angel.assigned_rooms ? angel.assigned_rooms.join(', ') : '—';

    const times = angelRounds.map(r => {
      const t = new Date(r.submitted_at);
      const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isLate = t.getHours() >= STANDUP_DEADLINE_HOUR;
      const tag = isLate ? '<span class="late-tag">LATE</span>' : '<span class="ontime-tag">ON TIME</span>';
      return r.room_number + ': ' + timeStr + ' ' + tag;
    }).join('<br>');

    return '<tr>' +
      '<td><strong>' + angel.role + '</strong><br><span style="color: var(--text-muted); font-size: 12px;">' + person + '</span></td>' +
      '<td style="color: var(--text-muted); font-size: 13px;">' + rooms + '</td>' +
      '<td>' + rounded + ' / ' + totalRooms + '</td>' +
      '<td style="font-size: 12px;">' + (times || '—') + '</td>' +
      '<td class="' + statusClass + '">' + statusText + '</td>' +
      '</tr>';
  }).join('');
}

// ============================================
// WEEKLY TAB
// ============================================

function changeWeek(delta) {
  currentWeekOffset += delta;
  if (currentWeekOffset > 0) currentWeekOffset = 0;
  renderWeekly();
}

function getWeekDates(offset) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday + (offset * 7));

  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function renderWeekly() {
  const days = getWeekDates(currentWeekOffset);
  const dayStrings = days.map(d => getLocalDateString(d));
  const today = getLocalDateString();

  const weekLabel = document.getElementById('week-label');
  if (currentWeekOffset === 0) weekLabel.textContent = 'This week';
  else if (currentWeekOffset === -1) weekLabel.textContent = 'Last week';
  else weekLabel.textContent = Math.abs(currentWeekOffset) + ' weeks ago';

  const rangeStr = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                   ' – ' +
                   days[4].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  document.getElementById('week-range').textContent = rangeStr;

  document.getElementById('next-week-btn').disabled = (currentWeekOffset === 0);
  document.getElementById('next-week-btn').style.opacity = (currentWeekOffset === 0) ? '0.4' : '1';

  const rounderAngels = angelsData.filter(a => a.role !== 'Maintenance');

  const tbody = document.getElementById('weekly-grid-body');
  tbody.innerHTML = rounderAngels.map(angel => {
    let completedDays = 0;
    let possibleDays = 0;

    const dayCells = dayStrings.map(dateStr => {
      const isFuture = dateStr > today;
      const isToday = dateStr === today;
      const dayRounds = roundsData.filter(r =>
        r.round_date === dateStr &&
        r.angel_role === angel.role &&
        r.round_status === 'submitted'
      );
      const roundedRooms = [...new Set(dayRounds.map(r => r.room_number))];
      const totalRooms = (angel.assigned_rooms || []).length;

      if (!angel.current_person) return '<td><span class="day-cell day-future">—</span></td>';
      if (isFuture) return '<td><span class="day-cell day-future">—</span></td>';

      possibleDays++;

      if (totalRooms === 0) return '<td><span class="day-cell day-future">—</span></td>';

      if (roundedRooms.length === totalRooms) {
        completedDays++;
        return '<td><span class="day-cell day-complete" title="Completed">✓</span></td>';
      } else if (roundedRooms.length > 0) {
        return '<td><span class="day-cell day-partial" title="' + roundedRooms.length + ' of ' + totalRooms + '">⚠</span></td>';
      } else if (isToday) {
        return '<td><span class="day-cell day-future">—</span></td>';
      } else {
        return '<td><span class="day-cell day-missed" title="Missed">✗</span></td>';
      }
    }).join('');

    const person = angel.current_person || '(unfilled)';

    let scoreClass = 'compliance-none';
    let scoreText = '—';
    if (angel.current_person && possibleDays > 0) {
      const ratio = completedDays / possibleDays;
      if (ratio >= 1) scoreClass = 'compliance-good';
      else if (ratio >= 0.6) scoreClass = 'compliance-partial';
      else scoreClass = 'compliance-missing';
      scoreText = completedDays + ' / ' + possibleDays;
    }

    return '<tr>' +
      '<td><div class="angel-name-cell">' + angel.role + '</div><div class="angel-person">' + person + '</div></td>' +
      dayCells +
      '<td class="score-cell ' + scoreClass + '">' + scoreText + '</td>' +
      '</tr>';
  }).join('');
}

// ============================================
// ACTION ITEMS TAB
// ============================================

function filterActions(btn, filter) {
  document.querySelectorAll('#tab-actions .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentActionFilter = filter;
  renderActionItems();
}

function renderActionItems() {
  let items = actionItemsData;

  if (currentActionFilter === 'open') items = items.filter(a => a.status === 'open');
  else if (currentActionFilter === 'urgent') items = items.filter(a => a.urgent && a.status === 'open');
  else if (currentActionFilter === 'closed') items = items.filter(a => a.status === 'closed');

  const container = document.getElementById('action-items-list');

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state">No action items in this view.</div>';
    return;
  }

  container.innerHTML = items.map(item => {
    const urgentClass = item.urgent && item.status === 'open' ? 'urgent' : '';
    const closedClass = item.status === 'closed' ? 'closed' : '';
    const urgentTag = item.urgent && item.status === 'open' ? '<span class="urgent-tag">URGENT</span>' : '';
    const created = new Date(item.created_at);
    const timeStr = created.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const buttons = item.status === 'open'
      ? '<button class="btn-small btn-close" onclick="closeAction(' + item.id + ')">Mark closed</button>'
      : '<button class="btn-small" onclick="reopenAction(' + item.id + ')">Reopen</button>';

    return '<div class="action-item-row ' + urgentClass + ' ' + closedClass + '">' +
      '<div class="action-details">' +
        '<div class="action-title">' + item.description + urgentTag + '</div>' +
        '<div class="action-meta">' +
          '<strong>Room ' + item.room_number + '</strong> · ' +
          'Assigned to <strong>' + item.assigned_to_role + '</strong> · ' +
          'Reported by ' + (item.reported_by_person || item.reported_by_role) + ' · ' +
          timeStr +
        '</div>' +
      '</div>' +
      '<div class="action-buttons">' + buttons + '</div>' +
    '</div>';
  }).join('');
}

async function closeAction(id) {
  const notes = prompt('Resolution notes (optional):') || '';
  try {
    await db.from('action_items').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: 'Admin',
      resolution_notes: notes
    }).eq('id', id);
    loadDashboard();
  } catch (err) {
    alert('Could not close: ' + err.message);
  }
}

async function reopenAction(id) {
  if (!confirm('Reopen this action item?')) return;
  try {
    await db.from('action_items').update({
      status: 'open',
      closed_at: null,
      closed_by: null,
      resolution_notes: null
    }).eq('id', id);
    loadDashboard();
  } catch (err) {
    alert('Could not reopen: ' + err.message);
  }
}

// ============================================
// RECENT ROUNDS TAB
// ============================================

function filterRounds(btn, filter) {
  document.querySelectorAll('#tab-rounds .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentRoundFilter = filter;
  renderRounds();
}

function renderRounds() {
  const today = getLocalDateString();
  const weekAgoD = new Date();
  weekAgoD.setDate(weekAgoD.getDate() - 7);
  const weekAgoStr = getLocalDateString(weekAgoD);

  let rounds = roundsData.filter(r => r.round_status === 'submitted');
  if (currentRoundFilter === 'today') rounds = rounds.filter(r => r.round_date === today);
  else if (currentRoundFilter === 'week') rounds = rounds.filter(r => r.round_date >= weekAgoStr);

  const tbody = document.getElementById('rounds-list-body');

  if (rounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No rounds in this view.</td></tr>';
    return;
  }

  tbody.innerHTML = rounds.map(r => {
    const submitTime = new Date(r.submitted_at);
    const dateStr = submitTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = submitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isLate = submitTime.getHours() >= STANDUP_DEADLINE_HOUR && r.round_date === today;
    const timeTag = isLate ? '<span class="late-tag">LATE</span>' : (r.round_date === today ? '<span class="ontime-tag">ON TIME</span>' : '');

    const bedCount = roundBedsData.filter(b => b.round_id === r.id).length;
    const rating = r.overall_rating || '—';
    const followup = r.followup_needed ? '⚠ Yes' : '✓ No';
    const person = r.angel_person || r.angel_role;

    return '<tr>' +
      '<td style="font-size: 13px;">' + dateStr + ' ' + timeStr + ' ' + timeTag + '</td>' +
      '<td><strong>' + r.angel_role + '</strong><br><span style="color: var(--text-muted); font-size: 12px;">' + person + '</span></td>' +
      '<td><strong>' + r.room_number + '</strong></td>' +
      '<td>' + bedCount + '</td>' +
      '<td style="text-transform: capitalize;">' + rating.replace('_', ' ') + '</td>' +
      '<td>' + followup + '</td>' +
    '</tr>';
  }).join('');
}

function updateBadges() {
  const openCount = actionItemsData.filter(a => a.status === 'open').length;
  const badge = document.getElementById('actions-count-badge');
  if (openCount > 0) {
    const urgentCount = actionItemsData.filter(a => a.status === 'open' && a.urgent).length;
    const color = urgentCount > 0 ? 'var(--red)' : 'var(--orange)';
    badge.innerHTML = '<span style="background: ' + color + '; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 4px;">' + openCount + '</span>';
  } else {
    badge.innerHTML = '';
  }
}
