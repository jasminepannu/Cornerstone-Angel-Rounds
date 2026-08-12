// ============================================
// CORNERSTONE ANGEL ROUNDS — Admin Dashboard
// ============================================

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

// ============================================
// STARTUP
// ============================================

window.addEventListener('DOMContentLoaded', async () => {
  await loadPasscode();

  // Check if this device is already unlocked
  const savedPasscode = localStorage.getItem('cornerstone_passcode');
  if (savedPasscode && savedPasscode === facilityPasscode) {
    showDashboard();
    await loadDashboard();
  }

  // Set date
  const today = new Date();
  document.getElementById('today-date').textContent = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Enter key on passcode
  document.getElementById('passcode-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkPasscode();
  });

  // Auto-refresh every 60 seconds when on the dashboard
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

// ============================================
// TABS
// ============================================

function switchTab(btn, tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  ['board', 'actions', 'rounds'].forEach(name => {
    document.getElementById('tab-' + name).classList.add('hidden');
  });
  document.getElementById('tab-' + tabName).classList.remove('hidden');
}

// ============================================
// LOAD DASHBOARD DATA
// ============================================

async function loadDashboard() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Load everything in parallel
    const [angels, rounds, roundBeds, actions] = await Promise.all([
      db.from('angels').select('*').eq('active', true).order('id'),
      db.from('rounds').select('*').order('submitted_at', { ascending: false }),
      db.from('round_beds').select('*'),
      db.from('action_items').select('*').order('created_at', { ascending: false })
    ]);

    angelsData = angels.data || [];
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

// ============================================
// BOARD TAB
// ============================================

function renderBoard(today) {
  const todayRounds = roundsData.filter(r => r.round_date === today);
  const todayRoundIds = todayRounds.map(r => r.id);
  const todayBeds = roundBedsData.filter(b => todayRoundIds.includes(b.round_id));

  // Angels done: those with at least one round today
  const angelsDoneNames = [...new Set(todayRounds.map(r => r.angel_role))];
  const rounderAngels = angelsData.filter(a => a.role !== 'Maintenance');
  const angelsDone = rounderAngels.filter(a =>
    angelsDoneNames.includes(a.role) && isAngelComplete(a, todayRounds)
  );

  // Rooms rounded
  const roomsRounded = [...new Set(todayRounds.map(r => r.room_number))].length;

  // Beds checked
  const bedsChecked = todayBeds.length;

  // Open + urgent actions
  const openActions = actionItemsData.filter(a => a.status === 'open');
  const urgentActions = openActions.filter(a => a.urgent);

  // Update stat cards
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

  // Missing angels banner
  const missingAngels = rounderAngels.filter(a => !isAngelComplete(a, todayRounds));
  const now = new Date();
  const hour = now.getHours();

  const missingBanner = document.getElementById('missing-banner');
  if (missingAngels.length > 0 && hour >= 10) {
    missingBanner.classList.remove('hidden');
    document.getElementById('missing-names').textContent =
      missingAngels.map(a => a.role + (a.current_person ? ' (' + a.current_person + ')' : '')).join(', ');
  } else {
    missingBanner.classList.add('hidden');
  }

  // Angel compliance table
  renderAngelCompliance(rounderAngels, todayRounds);
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
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No angels configured.</td></tr>';
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

    return `
      <tr>
        <td><strong>${angel.role}</strong><br><span style="color: var(--text-muted); font-size: 12px;">${person}</span></td>
        <td style="color: var(--text-muted); font-size: 13px;">${rooms}</td>
        <td>${rounded} / ${totalRooms}</td>
        <td class="${statusClass}">${statusText}</td>
      </tr>
    `;
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
      ? `<button class="btn-small btn-close" onclick="closeAction(${item.id})">Mark closed</button>`
      : `<button class="btn-small" onclick="reopenAction(${item.id})">Reopen</button>`;

    return `
      <div class="action-item-row ${urgentClass} ${closedClass}">
        <div class="action-details">
          <div class="action-title">${item.description}${urgentTag}</div>
          <div class="action-meta">
            <strong>Room ${item.room_number}</strong> ·
            Assigned to <strong>${item.assigned_to_role}</strong> ·
            Reported by ${item.reported_by_person || item.reported_by_role} ·
            ${timeStr}
          </div>
        </div>
        <div class="action-buttons">${buttons}</div>
      </div>
    `;
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
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  let rounds = roundsData;
  if (currentRoundFilter === 'today') rounds = rounds.filter(r => r.round_date === today);
  else if (currentRoundFilter === 'week') rounds = rounds.filter(r => r.round_date >= weekAgoStr);

  const tbody = document.getElementById('rounds-list-body');

  if (rounds.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No rounds in this view.</td></tr>';
    return;
  }

  tbody.innerHTML = rounds.map(r => {
    const time = new Date(r.submitted_at).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const bedCount = roundBedsData.filter(b => b.round_id === r.id).length;
    const rating = r.overall_rating || '—';
    const followup = r.followup_needed ? '⚠️ Yes' : '✓ No';
    const person = r.angel_person || r.angel_role;

    return `
      <tr>
        <td style="color: var(--text-muted); font-size: 12px;">${time}</td>
        <td><strong>${r.angel_role}</strong><br><span style="color: var(--text-muted); font-size: 12px;">${person}</span></td>
        <td><strong>${r.room_number}</strong></td>
        <td>${bedCount}</td>
        <td style="text-transform: capitalize;">${rating.replace('_', ' ')}</td>
        <td>${followup}</td>
      </tr>
    `;
  }).join('');
}

// ============================================
// BADGES
// ============================================

function updateBadges() {
  const openCount = actionItemsData.filter(a => a.status === 'open').length;
  const badge = document.getElementById('actions-count-badge');
  if (openCount > 0) {
    const urgentCount = actionItemsData.filter(a => a.status === 'open' && a.urgent).length;
    const color = urgentCount > 0 ? 'var(--red)' : 'var(--orange)';
    badge.innerHTML = `<span style="background: ${color}; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 4px;">${openCount}</span>`;
  } else {
    badge.innerHTML = '';
  }
}
