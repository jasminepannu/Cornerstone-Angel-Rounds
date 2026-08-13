// ============================================================
// CORNERSTONE ANGEL ROUNDS — V2 BRAIN (fixed apostrophes)
// ============================================================

const SUPABASE_URL = 'https://qrvmlfkgpuqsogijlpoe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_huOYD7VwHKdnYFx_iNqF6w_IzcnSCj0';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// STATE
// ============================================

let facilityPasscode = null;
let angelsData = [];
let bedsData = [];
let routingRules = [];
let recentActionItems = [];
let weeklyChecksData = [];

let currentStep = 1;
let currentAngel = null;
let currentBedTab = 0;

const CONCERNS_LIST = [
  { key: 'meals', label: 'Meal timeliness or quality' },
  { key: 'pain', label: 'Pain / discomfort' },
  { key: 'calllight', label: 'Call light response time' },
  { key: 'noise', label: 'Noise / sleep disruption' },
  { key: 'bored', label: 'Feeling bored' },
  { key: 'staffattitude', label: 'Staff attitude or communication' },
  { key: 'laundry', label: 'Missing laundry' },
  { key: 'temp', label: 'Temperature comfort' },
  { key: 'bathroom', label: 'Bathroom / toileting help' },
  { key: 'other', label: 'Something else' }
];

let roundData = {};
let bedData = [];
let followupData = { category: null, description: '' };

// ============================================
// STARTUP
// ============================================

window.addEventListener('DOMContentLoaded', async () => {
  await loadFacilityData();

  const savedPasscode = localStorage.getItem('cornerstone_passcode');
  if (savedPasscode && savedPasscode === facilityPasscode) {
    showHomeScreen();
  }

  const today = new Date();
  document.getElementById('today-date').textContent = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  });

  document.getElementById('passcode-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkPasscode();
  });
});

async function loadFacilityData() {
  try {
    const { data: settings } = await db.from('settings').select('*');
    const passcodeRow = settings ? settings.find(s => s.key === 'facility_passcode') : null;
    facilityPasscode = passcodeRow ? passcodeRow.value : 'CCC2026';

    const { data: angels } = await db.from('angels').select('*').eq('active', true).order('id');
    angelsData = angels || [];

    const { data: beds } = await db.from('beds').select('*').eq('active', true).order('bed_code');
    bedsData = beds || [];

    const { data: rules } = await db.from('routing_rules').select('*').order('display_order');
    routingRules = rules || [];

    const { data: actions } = await db.from('action_items').select('*').eq('status', 'open');
    recentActionItems = actions || [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: weekly } = await db.from('weekly_checks').select('*').gte('checked_at', sevenDaysAgo.toISOString());
    weeklyChecksData = weekly || [];

    console.log('Loaded:', {
      angels: angelsData.length,
      beds: bedsData.length,
      openActions: recentActionItems.length,
      weeklyChecks: weeklyChecksData.length
    });
  } catch (err) {
    console.error('Error loading data:', err);
    alert('Could not connect to the database. Please refresh.');
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
    showHomeScreen();
  } else {
    errorBox.classList.remove('hidden');
    document.getElementById('passcode-input').value = '';
  }
}

// ============================================
// HOME SCREEN
// ============================================

function showHomeScreen() {
  document.getElementById('passcode-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('home-screen').classList.remove('hidden');

  const rememberedAngelId = localStorage.getItem('cornerstone_angel_id');
  if (rememberedAngelId) {
    const angel = angelsData.find(a => a.id == rememberedAngelId);
    if (angel) {
      currentAngel = angel;
      renderHomeRecognized(angel);
      return;
    }
  }

  renderHomeNotRecognized();
}

function renderHomeNotRecognized() {
  document.getElementById('home-not-recognized').classList.remove('hidden');
  document.getElementById('home-recognized').classList.add('hidden');
  document.getElementById('home-greeting').textContent = 'Welcome';
  document.getElementById('home-subtitle').textContent = 'Pick your role to get started.';

  const select = document.getElementById('home-angel-select');
  select.innerHTML = '<option value="">Select your role...</option>';
  angelsData.forEach(angel => {
    if (angel.role === 'Maintenance') return;
    const opt = document.createElement('option');
    opt.value = angel.id;
    const person = angel.current_person ? ' — ' + angel.current_person : ' (unfilled)';
    opt.textContent = angel.role + person;
    select.appendChild(opt);
  });
}

function onHomeAngelSelect() {
  const val = document.getElementById('home-angel-select').value;
  if (!val) return;
  const angel = angelsData.find(a => a.id == val);
  if (angel) {
    currentAngel = angel;
    localStorage.setItem('cornerstone_angel_id', angel.id);
    renderHomeRecognized(angel);
  }
}

function switchUser() {
  localStorage.removeItem('cornerstone_angel_id');
  currentAngel = null;
  renderHomeNotRecognized();
}

async function renderHomeRecognized(angel) {
  document.getElementById('home-not-recognized').classList.add('hidden');
  document.getElementById('home-recognized').classList.remove('hidden');

  const firstName = (angel.current_person || angel.role).split(' ')[0];
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('home-greeting').textContent = timeGreeting + ', ' + firstName + '!';
  document.getElementById('home-subtitle').textContent = angel.role + ' · Today\'s rounds';

  const today = new Date().toISOString().split('T')[0];
  const { data: myRounds } = await db.from('rounds')
    .select('room_number, submitted_at, round_status')
    .eq('angel_role', angel.role)
    .eq('round_date', today);

  const completedRooms = (myRounds || [])
    .filter(r => r.round_status === 'submitted')
    .map(r => r.room_number);

  const container = document.getElementById('home-rooms-list');
  container.innerHTML = '';

  if (!angel.assigned_rooms || angel.assigned_rooms.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px;">No rooms assigned. Contact your administrator.</div>';
    return;
  }

  angel.assigned_rooms.forEach(room => {
    const isDone = completedRooms.includes(room);
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; background: white;';
    row.innerHTML = '<div><div style="font-weight: 600; color: var(--text); font-size: 15px;">' +
      (isDone ? '✓' : '○') + ' Room ' + room +
      '</div><div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">' +
      (isDone ? 'Completed' : 'Not yet started') +
      '</div></div>' +
      '<button class="btn-primary" style="flex: none; padding: 8px 14px; font-size: 13px;" onclick="startRoundForRoom(\'' + room + '\')">' +
      (isDone ? 'Round again' : 'Start →') +
      '</button>';
    container.appendChild(row);
  });

  const remaining = angel.assigned_rooms.length - completedRooms.length;
  const summary = document.createElement('div');
  summary.style.cssText = 'text-align: center; padding: 12px; margin-top: 12px; font-size: 13px; color: var(--text-muted);';
  summary.textContent = remaining === 0
    ? '🎉 All rooms rounded today. Great work!'
    : remaining + ' room' + (remaining === 1 ? '' : 's') + ' remaining today';
  container.appendChild(summary);
}

function startRoundForRoom(room) {
  if (!currentAngel) return;
  resetRoundData();
  roundData.angel_role = currentAngel.role;
  roundData.angel_person = currentAngel.current_person;
  roundData.round_date = new Date().toISOString().split('T')[0];
  roundData.room_number = room;

  const roomBeds = bedsData.filter(b => b.room_number === room);
  bedData = roomBeds.map(b => makeEmptyBedRecord(b.bed_code));

  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  setTimeout(() => {
    populateAngels();
    document.getElementById('angel-select').value = currentAngel.id;
    onAngelChange();
    document.getElementById('room-select').value = room;
    onRoomChange();
    goToStep(2);
  }, 100);
}

function goToHome() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('success-screen').classList.add('hidden');
  document.getElementById('step-1').classList.remove('hidden');
  document.querySelectorAll('.step').forEach((s, i) => {
    if (i > 0) s.classList.add('hidden');
  });
  currentStep = 1;
  showHomeScreen();
}

// ============================================
// STEP NAVIGATION + PROGRESS BAR
// ============================================

const STEP_NAMES = {
  1: 'Who & Where',
  2: 'First Look',
  3: 'Bathroom',
  4: 'Resident Check',
  5: 'Staff Check-in',
  6: 'Wrap-up'
};

function goToStep(step) {
  if (step > currentStep) {
    if (currentStep === 1) {
      if (!roundData.angel_role || !roundData.room_number) {
        alert('Please select your role and a room before continuing.');
        return;
      }
    }
  }

  document.getElementById('step-' + currentStep).classList.add('hidden');
  document.getElementById('step-' + step).classList.remove('hidden');

  document.getElementById('step-label').textContent = 'Step ' + step + ' of 6';
  document.getElementById('step-name').textContent = STEP_NAMES[step];
  document.getElementById('progress-fill').style.width = (step / 6 * 100) + '%';
  document.getElementById('round-header-title').textContent = 'Room ' + (roundData.room_number || '—') + ' · ' + STEP_NAMES[step];

  currentStep = step;

  if (step === 2 || step === 3) {
    buildThreeStateButtons();
  }

  if (step === 4 && bedData.length > 0) {
    buildBedTabs();
    showBedContent(0);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// THREE-STATE ANSWER BUTTONS
// ============================================

function buildThreeStateButtons() {
  document.querySelectorAll('.three-state').forEach(q => {
    const btnContainer = q.querySelector('.q-buttons');
    if (btnContainer.children.length > 0) return;

    btnContainer.style.cssText = 'display: flex; gap: 6px; margin-top: 10px;';
    ['Meets Standard', 'Needs Attention', 'N/A'].forEach(label => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label === 'Meets Standard' ? '✓ Meets' : label === 'Needs Attention' ? '⚠ Needs Attention' : 'N/A';
      btn.className = 'ts-btn ts-' + label.toLowerCase().replace(/[^a-z]/g, '');
      btn.style.cssText = 'flex: 1; padding: 10px 8px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--text-muted); transition: all 0.15s;';
      btn.onclick = () => selectThreeState(q, label, btn);
      btnContainer.appendChild(btn);
    });

    const qText = q.querySelector('.q-text');
    qText.style.cssText = 'font-size: 14px; color: var(--text); line-height: 1.4;';

    q.style.cssText = 'padding: 14px 0; border-bottom: 1px solid var(--border);';
  });
}

function selectThreeState(qEl, value, btnEl) {
  const field = qEl.dataset.field;
  const section = qEl.dataset.section;

  if (qEl.dataset.bedIdx !== undefined) {
    const idx = parseInt(qEl.dataset.bedIdx);
    bedData[idx][field] = value;
  } else {
    roundData[field] = value;
  }

  qEl.querySelectorAll('.ts-btn').forEach(b => {
    b.style.background = 'white';
    b.style.color = 'var(--text-muted)';
    b.style.borderColor = 'var(--border-strong)';
    b.style.fontWeight = '500';
  });

  if (value === 'Meets Standard') {
    btnEl.style.background = 'var(--bg-success)';
    btnEl.style.color = 'var(--green)';
    btnEl.style.borderColor = 'var(--green)';
    btnEl.style.fontWeight = '600';
  } else if (value === 'Needs Attention') {
    btnEl.style.background = 'var(--bg-warning)';
    btnEl.style.color = 'var(--orange)';
    btnEl.style.borderColor = 'var(--orange)';
    btnEl.style.fontWeight = '600';
  } else {
    btnEl.style.background = 'var(--bg)';
    btnEl.style.color = 'var(--text)';
    btnEl.style.borderColor = 'var(--border-strong)';
  }

  const followup = qEl.querySelector('.q-followup');
  if (value === 'Needs Attention') {
    if (followup.innerHTML === '') {
      const bedIdxAttr = qEl.dataset.bedIdx || '';
      followup.innerHTML = '<textarea placeholder="What did you observe?" style="margin-top: 8px; min-height: 60px; font-size: 14px;" oninput="saveFollowupNote(this, \'' + field + '\', \'' + bedIdxAttr + '\')"></textarea>';
    }
    followup.classList.remove('hidden');
  } else {
    followup.classList.add('hidden');
  }

  if (value === 'Needs Attention' && section) {
    const btn = document.getElementById('markall-' + section);
    if (btn && btn.dataset.markedAll === 'true') {
      btn.dataset.markedAll = 'false';
      btn.textContent = '✓ Mark all as Meets Standard';
      document.getElementById('undo-' + section).classList.add('hidden');
    }
  }
}

function saveFollowupNote(el, field, bedIdx) {
  const noteField = field + '_note';
  if (bedIdx) {
    bedData[parseInt(bedIdx)][noteField] = el.value;
  } else {
    roundData[noteField] = el.value;
  }
}

// ============================================
// MARK ALL AS MEETS STANDARD (undoable)
// ============================================

function markAllStandard(section) {
  const step = section === 'firstlook' ? document.getElementById('step-2') : document.getElementById('step-3');
  const questions = step.querySelectorAll('.three-state');

  questions.forEach(q => {
    const meetsBtn = q.querySelector('.ts-meets');
    if (meetsBtn) selectThreeState(q, 'Meets Standard', meetsBtn);
  });

  const btn = document.getElementById('markall-' + section);
  btn.dataset.markedAll = 'true';
  btn.textContent = '✓ All marked — you can still change individual answers';
  document.getElementById('undo-' + section).classList.remove('hidden');
}

function undoMarkAll(section) {
  const step = section === 'firstlook' ? document.getElementById('step-2') : document.getElementById('step-3');
  const questions = step.querySelectorAll('.three-state');

  questions.forEach(q => {
    q.querySelectorAll('.ts-btn').forEach(b => {
      b.style.background = 'white';
      b.style.color = 'var(--text-muted)';
      b.style.borderColor = 'var(--border-strong)';
      b.style.fontWeight = '500';
    });
    q.querySelector('.q-followup').classList.add('hidden');
    const field = q.dataset.field;
    if (field) roundData[field] = null;
  });

  const btn = document.getElementById('markall-' + section);
  btn.dataset.markedAll = 'false';
  btn.textContent = '✓ Mark all as Meets Standard';
  document.getElementById('undo-' + section).classList.add('hidden');
}

// ============================================
// STEP 1 - ANGEL / ROOM
// ============================================

function populateAngels() {
  const select = document.getElementById('angel-select');
  select.innerHTML = '<option value="">Select your role...</option>';
  angelsData.forEach(angel => {
    if (angel.role === 'Maintenance') return;
    const opt = document.createElement('option');
    opt.value = angel.id;
    const person = angel.current_person ? ' — ' + angel.current_person : ' (unfilled)';
    opt.textContent = angel.role + person;
    select.appendChild(opt);
  });
}

function onAngelChange() {
  const select = document.getElementById('angel-select');
  const roomSelect = document.getElementById('room-select');
  roomSelect.innerHTML = '<option value="">Select room...</option>';
  document.getElementById('bed-count-note').textContent = '';

  if (!select.value) {
    roundData.angel_role = null;
    roundData.angel_person = null;
    return;
  }

  const angel = angelsData.find(a => a.id == select.value);
  roundData.angel_role = angel.role;
  roundData.angel_person = angel.current_person;
  currentAngel = angel;

  angel.assigned_rooms.forEach(room => {
    const opt = document.createElement('option');
    opt.value = room;
    opt.textContent = 'Room ' + room;
    roomSelect.appendChild(opt);
  });
}

function onRoomChange() {
  const roomSelect = document.getElementById('room-select');
  roundData.room_number = roomSelect.value;

  if (!roomSelect.value) {
    document.getElementById('bed-count-note').textContent = '';
    document.getElementById('unresolved-items').classList.add('hidden');
    bedData = [];
    return;
  }

  const roomBeds = bedsData.filter(b => b.room_number === roomSelect.value);
  bedData = roomBeds.map(b => makeEmptyBedRecord(b.bed_code));

  const bedCount = bedData.length;
  document.getElementById('bed-count-note').textContent =
    'This room has ' + bedCount + ' bed' + (bedCount === 1 ? '' : 's') + ' to check.';

  const unresolved = recentActionItems.filter(a => a.room_number === roomSelect.value);
  if (unresolved.length > 0) {
    const listEl = document.getElementById('unresolved-list');
    listEl.innerHTML = unresolved.map(a => {
      const urgent = a.urgent ? ' 🚨' : '';
      return '<div style="margin-bottom: 4px;">• ' + a.description + urgent + ' <em style="color: var(--text-muted);">(→ ' + a.assigned_to_role + ')</em></div>';
    }).join('');
    document.getElementById('unresolved-items').classList.remove('hidden');
  } else {
    document.getElementById('unresolved-items').classList.add('hidden');
  }
}

function makeEmptyBedRecord(bedCode) {
  return {
    bed_code: bedCode,
    resident_state: null,
    call_light_reach: null,
    call_light_functional: null,
    water_available: null,
    tv_remote_reach: null,
    bed_safe_position: null,
    bedside_table_organized: null,
    hygiene_items_organized: null,
    area_under_bed_clear: null,
    resident_clean_appearance: null,
    grooming_appropriate: null,
    oral_hygiene_ok: null,
    no_body_odor: null,
    resident_comfortably_positioned: null,
    resident_no_pain_signs: null,
    nails_ok: null,
    has_oxygen: false,
    has_catheter: false,
    has_fall_mat: false,
    o2_tubing_no_kinks: null,
    o2_tubing_off_floor: null,
    o2_tubing_dated_7_days: null,
    o2_no_smoking_sign: null,
    cath_bag_dignity_cover: null,
    cath_bag_off_floor: null,
    cath_tubing_no_kinks: null,
    cath_tubing_not_trapped: null,
    cath_tubing_clean: null,
    mat_clear_of_furniture: null,
    mat_clean_no_stains: null,
    mat_not_ripped: null,
    mat_positioned_ok: null,
    staff_treating_well: null,
    environment_comfortable: null,
    resident_own_words: '',
    asked_if_help_needed: null,
    concerns_mentioned: ''
  };
}

// ============================================
// STEP 4 — PER-BED TABS AND CONTENT
// ============================================

function buildBedTabs() {
  const container = document.getElementById('bed-tabs');
  container.innerHTML = '';
  bedData.forEach((bed, idx) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.textContent = bed.bed_code;
    tab.dataset.idx = idx;
    tab.style.cssText = 'padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; font-weight: 500; cursor: pointer; flex-shrink: 0; color: var(--text-muted);';
    tab.onclick = () => showBedContent(idx);
    container.appendChild(tab);
  });
}

function showBedContent(idx) {
  currentBedTab = idx;

  document.querySelectorAll('#bed-tabs button').forEach((t, i) => {
    if (i === idx) {
      t.style.background = 'var(--purple)';
      t.style.color = 'white';
      t.style.borderColor = 'var(--purple)';
      t.style.fontWeight = '600';
    } else {
      t.style.background = 'white';
      t.style.color = 'var(--text-muted)';
      t.style.borderColor = 'var(--border-strong)';
      t.style.fontWeight = '500';
    }
  });

  const container = document.getElementById('bed-content-container');
  const bed = bedData[idx];
  const isTuesday = new Date().getDay() === 2;

  const nailsAlreadyChecked = weeklyChecksData.some(w =>
    w.bed_code === bed.bed_code && w.check_type === 'nails'
  );

  let html = '';
  html += '<div style="padding: 8px 0; margin-bottom: 12px;">';
  html += '<div style="font-size: 12px; color: var(--text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Bed</div>';
  html += '<div style="font-size: 18px; font-weight: 600; color: var(--text); margin-top: 2px;">' + bed.bed_code + '</div>';
  html += '</div>';

  html += '<label>Resident state <span class="required">*</span></label>';
  html += '<div class="state-grid">';
  html += '<button type="button" class="state-btn" data-state="awake" onclick="selectBedState(' + idx + ', this, \'awake\')">Awake &amp; responsive</button>';
  html += '<button type="button" class="state-btn" data-state="sleeping" onclick="selectBedState(' + idx + ', this, \'sleeping\')">Sleeping</button>';
  html += '<button type="button" class="state-btn" data-state="away" onclick="selectBedState(' + idx + ', this, \'away\')">Away from room</button>';
  html += '<button type="button" class="state-btn" data-state="empty_bed" onclick="selectBedState(' + idx + ', this, \'empty_bed\')">Empty bed</button>';
  html += '<button type="button" class="state-btn" data-state="no_response" onclick="selectBedState(' + idx + ', this, \'no_response\')" style="grid-column: span 2;">Resident does not respond</button>';
  html += '</div>';

  html += '<div id="bed-details-' + idx + '" class="hidden">';

  html += '<div class="section-label">Bedside environment</div>';
  html += buildBedQuestion(idx, 'call_light_reach', 'Call light is within the resident reach.');
  html += buildBedQuestion(idx, 'call_light_functional', 'Call light appears functional.');
  html += buildBedQuestion(idx, 'water_available', 'Water is available and within reach when appropriate.');
  html += buildBedQuestion(idx, 'tv_remote_reach', 'TV remote and/or telephone are within reach when used.');
  html += buildBedQuestion(idx, 'bed_safe_position', 'Bed is stable, brakes locked when applicable.');
  html += buildBedQuestion(idx, 'area_under_bed_clear', 'Area under and around the bed is free of inappropriate stored items.');
  html += buildBedQuestion(idx, 'bedside_table_organized', 'Bedside table is reasonably organized, respecting resident preferences.');
  html += buildBedQuestion(idx, 'hygiene_items_organized', 'Hygiene items are stored in an organized manner.');

  html += '<div class="section-label">Resident appearance &amp; comfort</div>';
  html += buildBedQuestion(idx, 'resident_clean_appearance', 'Resident appears clean and free of obvious food, crumbs or significant stains.');
  html += buildBedQuestion(idx, 'grooming_appropriate', 'Hair and grooming appear appropriate for the resident condition and time of day.');
  html += buildBedQuestion(idx, 'oral_hygiene_ok', 'Oral hygiene appears appropriate based on observation.');
  html += buildBedQuestion(idx, 'no_body_odor', 'No significant body odor or hygiene concern observed.');
  html += buildBedQuestion(idx, 'resident_comfortably_positioned', 'Resident appears comfortably positioned.');
  html += buildBedQuestion(idx, 'resident_no_pain_signs', 'Resident appears comfortable with no obvious signs of pain or distress.', 'Ask: Are you having any pain or discomfort right now?');

  if (nailsAlreadyChecked) {
    html += '<div style="padding: 12px; background: var(--bg-success); border-radius: 6px; margin: 12px 0; font-size: 13px; color: var(--green);">✓ Nails checked this week</div>';
  } else if (isTuesday) {
    html += '<div style="padding: 12px; background: var(--bg-warning); border-radius: 6px; margin: 12px 0;">';
    html += '<div style="font-size: 13px; font-weight: 600; color: var(--orange); margin-bottom: 6px;">Weekly nail check (Tuesdays)</div>';
    html += buildBedQuestion(idx, 'nails_ok', 'Nails appear clean and appropriately maintained.');
    html += '</div>';
  }

  html += '<div class="section-label">Equipment</div>';
  html += '<div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">Does this resident have any of the following?</div>';
  html += '<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">';
  html += '<button type="button" class="eq-btn" data-eq="none" onclick="toggleEquipment(' + idx + ', \'none\', this)" style="padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; cursor: pointer;">None</button>';
  html += '<button type="button" class="eq-btn" data-eq="oxygen" onclick="toggleEquipment(' + idx + ', \'oxygen\', this)" style="padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; cursor: pointer;">Oxygen</button>';
  html += '<button type="button" class="eq-btn" data-eq="catheter" onclick="toggleEquipment(' + idx + ', \'catheter\', this)" style="padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; cursor: pointer;">Catheter</button>';
  html += '<button type="button" class="eq-btn" data-eq="fall_mat" onclick="toggleEquipment(' + idx + ', \'fall_mat\', this)" style="padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; cursor: pointer;">Fall/floor mat</button>';
  html += '</div>';

  html += '<div id="eq-oxygen-' + idx + '" class="hidden" style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 10px;">';
  html += '<div class="section-label" style="margin-top: 0;">Oxygen</div>';
  html += buildBedQuestion(idx, 'o2_tubing_no_kinks', 'Oxygen tubing is positioned without obvious kinks.');
  html += buildBedQuestion(idx, 'o2_tubing_off_floor', 'Oxygen tubing is kept off the floor.');
  html += buildBedQuestion(idx, 'o2_tubing_dated_7_days', 'Oxygen tubing and bag dated within 7 days.');
  html += buildBedQuestion(idx, 'o2_no_smoking_sign', 'NO SMOKING / oxygen safety sign is present.');
  html += '</div>';

  html += '<div id="eq-catheter-' + idx + '" class="hidden" style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 10px;">';
  html += '<div class="section-label" style="margin-top: 0;">Catheter</div>';
  html += buildBedQuestion(idx, 'cath_bag_dignity_cover', 'Catheter bag is covered with a dignity/privacy bag.');
  html += buildBedQuestion(idx, 'cath_bag_off_floor', 'Catheter bag is not touching the floor.');
  html += buildBedQuestion(idx, 'cath_tubing_no_kinks', 'Tubing is positioned without obvious kinks.');
  html += buildBedQuestion(idx, 'cath_tubing_not_trapped', 'Tubing is not trapped under the resident leg or body.');
  html += buildBedQuestion(idx, 'cath_tubing_clean', 'Tubing does not appear visibly soiled or discolored.');
  html += '</div>';

  html += '<div id="eq-fall_mat-' + idx + '" class="hidden" style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 10px;">';
  html += '<div class="section-label" style="margin-top: 0;">Fall / Floor Mat</div>';
  html += buildBedQuestion(idx, 'mat_clear_of_furniture', 'Mat is clear of furniture.');
  html += buildBedQuestion(idx, 'mat_clean_no_stains', 'Mat is clean and free of significant stains.');
  html += buildBedQuestion(idx, 'mat_not_ripped', 'Mat is not ripped.');
  html += buildBedQuestion(idx, 'mat_positioned_ok', 'Mat is positioned appropriately.');
  html += '</div>';

  html += '<div id="conversation-' + idx + '" class="hidden">';
  html += '<div class="section-label">Resident conversation</div>';
  html += '<div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Spend a moment talking with the resident. Try: <em>How are you doing today? · Is there anything I can help you with? · How has staff been treating you?</em></div>';
  html += buildBedQuestion(idx, 'staff_treating_well', 'Resident reports staff are treating them well.');
  html += buildBedQuestion(idx, 'environment_comfortable', 'Resident reports feeling comfortable with their environment.');
  html += '<label style="margin-top: 16px;">Any concerns expressed? (tap all that apply)</label>';
  html += '<div id="concerns-' + idx + '" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">';
  CONCERNS_LIST.forEach(c => {
    html += '<button type="button" class="concern-chip" data-key="' + c.key + '" onclick="toggleConcern(' + idx + ', \'' + c.key + '\', this)" style="padding: 8px 12px; border-radius: 20px; border: 1px solid var(--border-strong); background: white; font-size: 13px; cursor: pointer; color: var(--text-muted);">' + c.label + '</button>';
  });
  html += '</div>';
  html += '<label style="margin-top: 16px;">In the resident own words (optional)</label>';
  html += '<textarea id="own-words-' + idx + '" placeholder="e.g., I wish someone would walk me outside more often" oninput="bedData[' + idx + '].resident_own_words = this.value"></textarea>';
  html += '<label style="margin-top: 12px;">Did you ask: Is there anything I can do for you right now?</label>';
  html += '<div class="state-grid" style="margin-top: 8px;">';
  html += '<button type="button" class="state-btn help-btn-' + idx + '" onclick="selectHelpAsked(' + idx + ', this, \'Yes\')">Yes</button>';
  html += '<button type="button" class="state-btn help-btn-' + idx + '" onclick="selectHelpAsked(' + idx + ', this, \'No\')">No</button>';
  html += '</div>';
  html += '</div>';

  html += '</div>';

  container.innerHTML = html;

  if (bed.resident_state) {
    const stateBtn = container.querySelector('[data-state="' + bed.resident_state + '"]');
    if (stateBtn) {
      stateBtn.classList.add('selected');
      if (bed.resident_state === 'awake' || bed.resident_state === 'sleeping' || bed.resident_state === 'no_response') {
        document.getElementById('bed-details-' + idx).classList.remove('hidden');
      }
      if (bed.resident_state === 'awake') {
        document.getElementById('conversation-' + idx).classList.remove('hidden');
      }
    }
  }

  buildThreeStateButtons();
  restoreBedAnswers(idx);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildBedQuestion(bedIdx, field, text, helperText) {
  const helper = helperText ? '<div style="font-size: 12px; color: var(--text-muted); font-style: italic; margin-top: 2px;">' + helperText + '</div>' : '';
  return '<div class="three-state" data-field="' + field + '" data-bed-idx="' + bedIdx + '">' +
    '<div class="q-text">' + text + '</div>' +
    helper +
    '<div class="q-buttons"></div>' +
    '<div class="q-followup hidden"></div>' +
    '</div>';
}

function restoreBedAnswers(idx) {
  const bed = bedData[idx];
  document.querySelectorAll('.three-state[data-bed-idx="' + idx + '"]').forEach(q => {
    const field = q.dataset.field;
    const value = bed[field];
    if (!value) return;
    const btnClass = value === 'Meets Standard' ? '.ts-meets' : value === 'Needs Attention' ? '.ts-needsattention' : '.ts-na';
    const btn = q.querySelector(btnClass);
    if (btn) selectThreeState(q, value, btn);
  });

  ['oxygen', 'catheter', 'fall_mat'].forEach(eq => {
    const key = 'has_' + eq;
    if (bed[key]) {
      const btn = document.querySelector('#bed-content-container [data-eq="' + eq + '"]');
      if (btn) toggleEquipment(idx, eq, btn, true);
    }
  });

  if (bed.concerns_mentioned) {
    const selected = bed.concerns_mentioned.split(',').filter(Boolean);
    selected.forEach(key => {
      const chip = document.querySelector('#concerns-' + idx + ' [data-key="' + key + '"]');
      if (chip) toggleConcern(idx, key, chip, true);
    });
  }

  const ownWords = document.getElementById('own-words-' + idx);
  if (ownWords) ownWords.value = bed.resident_own_words || '';
}

function selectBedState(idx, btn, state) {
  const container = document.getElementById('bed-content-container');
  container.querySelectorAll('.state-btn[data-state]').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  bedData[idx].resident_state = state;

  const details = document.getElementById('bed-details-' + idx);
  const conversation = document.getElementById('conversation-' + idx);

  if (state === 'away' || state === 'empty_bed') {
    details.classList.add('hidden');
  } else {
    details.classList.remove('hidden');
    if (state === 'awake') {
      conversation.classList.remove('hidden');
    } else {
      conversation.classList.add('hidden');
    }
  }
}

function toggleEquipment(idx, eq, btn, restore) {
  const bed = bedData[idx];

  if (eq === 'none') {
    ['oxygen', 'catheter', 'fall_mat'].forEach(x => {
      bed['has_' + x] = false;
      document.getElementById('eq-' + x + '-' + idx).classList.add('hidden');
      const b = document.querySelector('#bed-content-container [data-eq="' + x + '"]');
      if (b) {
        b.style.background = 'white';
        b.style.color = 'var(--text)';
        b.style.borderColor = 'var(--border-strong)';
      }
    });
    document.querySelectorAll('#bed-content-container [data-eq="none"]').forEach(b => {
      b.style.background = 'var(--purple)';
      b.style.color = 'white';
      b.style.borderColor = 'var(--purple)';
    });
    return;
  }

  const key = 'has_' + eq;
  bed[key] = restore ? true : !bed[key];

  if (bed[key]) {
    btn.style.background = 'var(--purple)';
    btn.style.color = 'white';
    btn.style.borderColor = 'var(--purple)';
    document.getElementById('eq-' + eq + '-' + idx).classList.remove('hidden');
    const noneBtn = document.querySelector('#bed-content-container [data-eq="none"]');
    if (noneBtn) {
      noneBtn.style.background = 'white';
      noneBtn.style.color = 'var(--text)';
      noneBtn.style.borderColor = 'var(--border-strong)';
    }
  } else {
    btn.style.background = 'white';
    btn.style.color = 'var(--text)';
    btn.style.borderColor = 'var(--border-strong)';
    document.getElementById('eq-' + eq + '-' + idx).classList.add('hidden');
  }
}

function toggleConcern(idx, key, btn, restore) {
  const bed = bedData[idx];
  const current = bed.concerns_mentioned ? bed.concerns_mentioned.split(',').filter(Boolean) : [];
  const isSelected = current.includes(key);
  const shouldSelect = restore ? true : !isSelected;

  if (shouldSelect && !isSelected) {
    current.push(key);
    btn.style.background = 'var(--bg-warning)';
    btn.style.color = 'var(--orange)';
    btn.style.borderColor = 'var(--orange)';
    btn.style.fontWeight = '600';
  } else if (!shouldSelect && isSelected) {
    const i = current.indexOf(key);
    current.splice(i, 1);
    btn.style.background = 'white';
    btn.style.color = 'var(--text-muted)';
    btn.style.borderColor = 'var(--border-strong)';
    btn.style.fontWeight = 'normal';
  }

  bed.concerns_mentioned = current.join(',');
}

function selectHelpAsked(idx, btn, value) {
  document.querySelectorAll('.help-btn-' + idx).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  bedData[idx].asked_if_help_needed = value;
}

// ============================================
// STEP 5 - STAFF
// ============================================

function selectStaffSeen(btn, seen) {
  const parent = btn.parentElement;
  parent.querySelectorAll('.state-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  roundData.staff_seen = seen;

  const staffFields = document.getElementById('staff-fields');
  if (seen) staffFields.classList.remove('hidden');
  else {
    staffFields.classList.add('hidden');
    roundData.staff_name_badge = null;
    roundData.staff_acknowledged = null;
    roundData.staff_notes = '';
  }
}

function toggleCheck(el) {
  el.classList.toggle('checked');
  const field = el.dataset.field;
  if (!field) return;
  roundData[field] = el.classList.contains('checked');
}

// ============================================
// STEP 6 - WRAP-UP
// ============================================

function selectRating(btn, rating) {
  const parent = btn.parentElement;
  parent.querySelectorAll('.state-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  roundData.overall_rating = rating;
}

function selectFollowup(btn, needed) {
  const parent = btn.parentElement;
  parent.querySelectorAll('.state-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  roundData.followup_needed = needed;

  const followupFields = document.getElementById('followup-fields');
  if (needed) {
    followupFields.classList.remove('hidden');
    populateFollowupCategoriesIfNeeded();
  } else {
    followupFields.classList.add('hidden');
    followupData.category = null;
    followupData.description = '';
  }
}

function populateFollowupCategoriesIfNeeded() {
  const select = document.getElementById('followup-category');
  if (select.options.length > 1) return;
  routingRules.forEach(rule => {
    const opt = document.createElement('option');
    opt.value = rule.category;
    opt.textContent = rule.category_label + ' → ' + rule.routes_to_role;
    select.appendChild(opt);
  });
}

// ============================================
// SUBMIT
// ============================================

async function submitRound() {
  roundData.room_notes = document.getElementById('room-notes').value;
  roundData.bathroom_notes = document.getElementById('bathroom-notes').value;
  roundData.staff_notes = document.getElementById('staff-notes').value;
  roundData.additional_notes = document.getElementById('additional-notes').value;
  roundData.round_status = 'submitted';

  if (roundData.followup_needed) {
    followupData.category = document.getElementById('followup-category').value;
    followupData.description = document.getElementById('followup-description').value;
    if (!followupData.category || !followupData.description) {
      alert('Please pick a follow-up category and describe the issue.');
      return;
    }
  }

  try {
    const cleanRound = { ...roundData };
    const { data: roundResult, error: roundError } = await db.from('rounds').insert([cleanRound]).select();
    if (roundError) throw roundError;
    const newRoundId = roundResult[0].id;

    if (bedData.length > 0) {
      const bedRows = bedData.map(b => ({ ...b, round_id: newRoundId }));
      const { error: bedError } = await db.from('round_beds').insert(bedRows);
      if (bedError) throw bedError;

      const isTuesday = new Date().getDay() === 2;
      if (isTuesday) {
        for (const bed of bedData) {
          if (bed.nails_ok && bed.nails_ok !== 'N/A') {
            await db.from('weekly_checks').insert([{
              bed_code: bed.bed_code,
              check_type: 'nails',
              checked_by: roundData.angel_person || roundData.angel_role,
              status: bed.nails_ok
            }]);
          }
        }
      }
    }

    await createActionItemsFromNeedsAttention(newRoundId);

    if (roundData.followup_needed) {
      const rule = routingRules.find(r => r.category === followupData.category);
      const assignedRole = rule ? rule.routes_to_role : 'Administrator';
      let finalRole = assignedRole;
      const targetAngel = angelsData.find(a => a.role === assignedRole);
      if (targetAngel && !targetAngel.current_person && rule && rule.fallback_role) {
        finalRole = rule.fallback_role;
      }
      const isUrgent = rule ? rule.urgent : false;

      await db.from('action_items').insert([{
        round_id: newRoundId,
        room_number: roundData.room_number,
        reported_by_role: roundData.angel_role,
        reported_by_person: roundData.angel_person,
        category: followupData.category,
        assigned_to_role: finalRole,
        description: followupData.description,
        urgent: isUrgent
      }]);
    }

    showSuccessScreen();
  } catch (err) {
    console.error('Submit error:', err);
    alert('Something went wrong saving your round. Please try again.\n\n' + (err.message || ''));
  }
}

async function createActionItemsFromNeedsAttention(roundId) {
  const items = [];

  for (const key of Object.keys(roundData)) {
    if (roundData[key] === 'Needs Attention') {
      const note = roundData[key + '_note'] || '';
      items.push({
        round_id: roundId,
        room_number: roundData.room_number,
        reported_by_role: roundData.angel_role,
        reported_by_person: roundData.angel_person,
        category: 'auto_flagged',
        assigned_to_role: guessDepartment(key),
        description: humanizeField(key) + (note ? ' — ' + note : ''),
        urgent: false
      });
    }
  }

  for (const bed of bedData) {
    for (const key of Object.keys(bed)) {
      if (bed[key] === 'Needs Attention') {
        const note = bed[key + '_note'] || '';
        items.push({
          round_id: roundId,
          room_number: roundData.room_number,
          reported_by_role: roundData.angel_role,
          reported_by_person: roundData.angel_person,
          category: 'auto_flagged',
          assigned_to_role: guessDepartment(key),
          description: '[' + bed.bed_code + '] ' + humanizeField(key) + (note ? ' — ' + note : ''),
          urgent: false
        });
      }
    }
  }

  if (items.length > 0) {
    await db.from('action_items').insert(items);
  }
}

function guessDepartment(field) {
  if (/bathroom|floor|odor|linen|curtain|clean|walls|clutter/i.test(field)) return 'Housekeeping';
  if (/bed|furniture|closet|dresser|call_light|walls|mat/i.test(field)) return 'Maintenance';
  if (/oxygen|o2|catheter|pain|wound|enteral|nail/i.test(field)) return 'DON';
  if (/water|pitcher|food|gloves/i.test(field)) return 'Dietary';
  if (/name_on_door|phi/i.test(field)) return 'Admissions Director';
  return 'Administrator';
}

function humanizeField(field) {
  return field
    .replace(/_/g, ' ')
    .replace(/\bok\b/g, 'OK')
    .replace(/^\w/, c => c.toUpperCase())
    .replace(/o2/i, 'O2');
}

function showSuccessScreen() {
  document.getElementById('step-6').classList.add('hidden');
  document.getElementById('progress-bar-container').classList.add('hidden');
  document.getElementById('success-screen').classList.remove('hidden');
  document.getElementById('success-summary').textContent =
    'Room ' + roundData.room_number + ' complete (' + bedData.length + ' bed' + (bedData.length === 1 ? '' : 's') + '). Great work.';
}

function resetRoundData() {
  roundData = {
    angel_role: null,
    angel_person: null,
    room_number: null,
    round_date: null,
    round_status: 'submitted',
    names_on_door_accurate: null,
    no_visible_phi: null,
    walking_paths_clear: null,
    room_no_odor: null,
    room_temperature_ok: null,
    walls_surfaces_ok: null,
    floors_clean_dry: null,
    no_exposed_linens: null,
    curtains_clean_intact: null,
    bed_linens_pillows_clean: null,
    closets_dressers_ok: null,
    room_furniture_safe: null,
    gloves_stocked_v2: null,
    room_notes: '',
    bathroom_floor_clean: null,
    bathroom_no_odor: null,
    bathroom_toilet_sink_clean: null,
    bathroom_stocked: null,
    bathroom_no_personal_products: null,
    bathroom_no_urinals_bedpans: null,
    bathroom_notes: '',
    staff_seen: null,
    staff_name_badge: null,
    staff_acknowledged: null,
    staff_notes: '',
    overall_rating: null,
    followup_needed: null,
    additional_notes: ''
  };
  bedData = [];
  followupData = { category: null, description: '' };
  currentStep = 1;
  currentBedTab = 0;
}
