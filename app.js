// ============================================================
// CORNERSTONE ANGEL ROUNDS — LEAN v2 BRAIN
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

const HYGIENE_CONCERNS = [
  { key: 'body_odor', label: 'Body odor' },
  { key: 'oral', label: 'Oral hygiene' },
  { key: 'nails', label: 'Nails' },
  { key: 'grooming', label: 'Grooming' },
  { key: 'skin', label: 'Skin appearance' },
  { key: 'clothing', label: 'Clothing' }
];

const FIRSTLOOK_QUESTIONS = [
  { field: 'names_on_door_accurate', text: 'All resident names on the room door are accurate.' },
  { field: 'walking_paths_clear', text: 'Walking paths are clear and free of trip hazards.' },
  { field: 'room_no_odor', text: 'Room is free of strong or unpleasant odor.' },
  { field: 'room_temperature_ok', text: 'Room temperature appears comfortable.' },
  { field: 'walls_surfaces_ok', text: 'Walls, doors and surfaces are free of significant damage.' },
  { field: 'floors_clean_dry', text: 'Floors appear clean, dry and not sticky.' },
  { field: 'no_exposed_linens', text: 'No unnecessary linens left exposed in the room.' },
  { field: 'curtains_clean_intact', text: 'Privacy curtains are clean and intact.' },
  { field: 'bed_linens_pillows_clean', text: 'Bed linens and pillows appear clean.' },
  { field: 'furniture_good_repair', text: 'Closets, dressers and furniture in good repair.' },
  { field: 'gloves_stocked_v2', text: 'Gloves are stocked.' }
];

const BATHROOM_QUESTIONS = [
  { field: 'bathroom_floor_clean', text: 'Bathroom floor is clean, dry and not sticky.' },
  { field: 'bathroom_no_odor', text: 'Bathroom is free of strong odor.' },
  { field: 'bathroom_no_products_left', text: 'No products left behind (personal hygiene items, urinals, bedpans, linens).' }
];

const BED_ENV_QUESTIONS = [
  { field: 'call_light_ok', text: 'Call light is within reach and functional.' },
  { field: 'water_available', text: 'Water is available and within reach (unless on fluid restrictions).' },
  { field: 'bed_safe_and_clear', text: 'Bed is stable, brakes locked, area under bed is clear.' },
  { field: 'bedside_organized', text: 'Bedside table and hygiene items organized (toothbrush + paste together, oral care together, hair care separate).' }
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

    console.log('Loaded:', {
      angels: angelsData.length,
      beds: bedsData.length,
      openActions: recentActionItems.length
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
    .filter(r => r.round_status === 'submitted' || !r.round_status)
    .map(r => r.room_number);

  const container = document.getElementById('home-rooms-list');
  container.innerHTML = '';

  if (!angel.assigned_rooms || angel.assigned_rooms.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px;">No rooms assigned.</div>';
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
    ? '🎉 All rooms rounded today!'
    : remaining + ' room' + (remaining === 1 ? '' : 's') + ' remaining';
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
  document.getElementById('progress-bar-container').classList.remove('hidden');
  document.getElementById('step-1').classList.remove('hidden');
  document.querySelectorAll('.step').forEach((s, i) => {
    if (i > 0) s.classList.add('hidden');
  });
  currentStep = 1;
  showHomeScreen();
}

// ============================================
// STEP NAVIGATION
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

  if (step === 2) buildFirstLookQuestions();
  if (step === 3) buildBathroomQuestions();
  if (step === 4 && bedData.length > 0) {
    buildBedTabs();
    showBedContent(0);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// BUILDING FIRST LOOK & BATHROOM
// ============================================

function buildFirstLookQuestions() {
  const container = document.getElementById('firstlook-questions');
  if (container.children.length > 0) return;
  container.innerHTML = FIRSTLOOK_QUESTIONS.map(q =>
    buildThreeStateHTML(q.field, q.text, 'firstlook')
  ).join('');
  attachThreeStateHandlers(container, 'firstlook');
}

function buildBathroomQuestions() {
  const container = document.getElementById('bathroom-questions');
  if (container.children.length > 0) return;
  container.innerHTML = BATHROOM_QUESTIONS.map(q =>
    buildThreeStateHTML(q.field, q.text, 'bathroom')
  ).join('');
  attachThreeStateHandlers(container, 'bathroom');
}

function buildThreeStateHTML(field, text, section, bedIdx) {
  const bedAttr = bedIdx !== undefined ? ' data-bed-idx="' + bedIdx + '"' : '';
  return '<div class="three-state" data-field="' + field + '" data-section="' + section + '"' + bedAttr + ' style="padding: 14px 0; border-bottom: 1px solid var(--border);">' +
    '<div class="q-text" style="font-size: 14px; color: var(--text); line-height: 1.4;">' + text + '</div>' +
    '<div class="q-buttons" style="display: flex; gap: 6px; margin-top: 10px;">' +
      '<button type="button" class="ts-btn ts-meets" style="flex: 1; padding: 10px 8px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--text-muted);">✓ Meets</button>' +
      '<button type="button" class="ts-btn ts-needsattention" style="flex: 1; padding: 10px 8px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--text-muted);">⚠ Needs Attention</button>' +
      '<button type="button" class="ts-btn ts-na" style="flex: 1; padding: 10px 8px; border-radius: 6px; border: 1px solid var(--border-strong); background: white; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--text-muted);">N/A</button>' +
    '</div>' +
    '<div class="q-followup hidden"></div>' +
  '</div>';
}

function attachThreeStateHandlers(container, section) {
  container.querySelectorAll('.three-state').forEach(q => {
    const buttons = q.querySelectorAll('.ts-btn');
    buttons[0].onclick = () => selectThreeState(q, 'Meets Standard', buttons[0]);
    buttons[1].onclick = () => selectThreeState(q, 'Needs Attention', buttons[1]);
    buttons[2].onclick = () => selectThreeState(q, 'N/A', buttons[2]);
  });
}

function selectThreeState(qEl, value, btnEl) {
  const field = qEl.dataset.field;
  const section = qEl.dataset.section;
  const bedIdx = qEl.dataset.bedIdx;

  if (bedIdx !== undefined) {
    bedData[parseInt(bedIdx)][field] = value;
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

  // Show/hide follow-up
  const followup = qEl.querySelector('.q-followup');
  if (value === 'Needs Attention') {
    if (followup.innerHTML === '') {
      const bedIdxAttr = bedIdx || '';
      followup.innerHTML =
        '<div style="margin-top: 10px; padding: 10px 12px; background: var(--bg-warning); border-radius: 6px; border-left: 3px solid var(--orange);">' +
          '<div style="font-size: 12px; color: var(--orange); font-weight: 600; margin-bottom: 6px;">💡 Let a CNA or Nurse know so they can respond.</div>' +
          '<textarea placeholder="What did you observe?" style="min-height: 60px; font-size: 14px; margin: 0;" oninput="saveFollowupNote(this, \'' + field + '\', \'' + bedIdxAttr + '\')"></textarea>' +
        '</div>';
    }
    followup.classList.remove('hidden');

    // Show hygiene concerns if this is the hygiene question
    if (field === 'resident_clean_groomed' && bedIdx !== undefined) {
      const idx = parseInt(bedIdx);
      const concernsContainer = document.getElementById('hygiene-concerns-' + idx);
      if (concernsContainer) concernsContainer.classList.remove('hidden');
    }
  } else {
    followup.classList.add('hidden');
    if (field === 'resident_clean_groomed' && bedIdx !== undefined) {
      const idx = parseInt(bedIdx);
      const concernsContainer = document.getElementById('hygiene-concerns-' + idx);
      if (concernsContainer) concernsContainer.classList.add('hidden');
    }
  }

  // If Needs Attention, un-mark "mark all clear"
  if (value === 'Needs Attention' && section && section !== 'bed') {
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
// MARK ALL AS MEETS STANDARD
// ============================================

function markAllStandard(section) {
  const containerId = section === 'firstlook' ? 'firstlook-questions' : 'bathroom-questions';
  const container = document.getElementById(containerId);
  const questions = container.querySelectorAll('.three-state');

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
  const containerId = section === 'firstlook' ? 'firstlook-questions' : 'bathroom-questions';
  const container = document.getElementById(containerId);
  const questions = container.querySelectorAll('.three-state');

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
    bed_ready_for_admission: null,
    call_light_ok: null,
    water_available: null,
    bed_safe_and_clear: null,
    bedside_organized: null,
    resident_clean_groomed: null,
    hygiene_concerns: '',
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
    spoke_with_resident: null,
    resident_own_words: '',
    concerns_mentioned: '',
    asked_if_help_needed: null
  };
}

// ============================================
// STEP 4 - BED TABS + CONTENT
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

  // Empty bed: just ask if ready for new admission
  html += '<div id="bed-empty-' + idx + '" class="hidden">';
  html += '<div class="section-label" style="margin-top: 20px;">Empty bed check</div>';
  html += buildThreeStateHTML('bed_ready_for_admission', 'Bed appears ready for a new admission.', 'bed', idx);
  html += '</div>';

  // Full bed check (sleeping / awake / no_response)
  html += '<div id="bed-details-' + idx + '" class="hidden">';

  html += '<div class="section-label">Bedside environment</div>';
  BED_ENV_QUESTIONS.forEach(q => {
    html += buildThreeStateHTML(q.field, q.text, 'bed', idx);
  });

  html += '<div class="section-label">Resident appearance</div>';
  html += buildThreeStateHTML('resident_clean_groomed', 'Resident appears clean and well-groomed for the time of day.', 'bed', idx);

  // Hygiene concerns checklist (hidden until Needs Attention)
  html += '<div id="hygiene-concerns-' + idx + '" class="hidden" style="margin: 10px 0; padding: 12px; background: var(--bg-warning); border-radius: 6px;">';
  html += '<div style="font-size: 13px; color: var(--orange); font-weight: 600; margin-bottom: 8px;">Which concerns? (tap all that apply)</div>';
  html += '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
  HYGIENE_CONCERNS.forEach(c => {
    html += '<button type="button" class="hyg-chip-' + idx + '" data-key="' + c.key + '" onclick="toggleHygieneConcern(' + idx + ', \'' + c.key + '\', this)" style="padding: 6px 12px; border-radius: 16px; border: 1px solid var(--border-strong); background: white; font-size: 13px; cursor: pointer; color: var(--text-muted);">' + c.label + '</button>';
  });
  html += '</div>';
  html += '</div>';

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
  html += buildThreeStateHTML('o2_tubing_no_kinks', 'Oxygen tubing without obvious kinks.', 'bed', idx);
  html += buildThreeStateHTML('o2_tubing_off_floor', 'Oxygen tubing kept off the floor.', 'bed', idx);
  html += buildThreeStateHTML('o2_tubing_dated_7_days', 'Tubing and bag dated within 7 days.', 'bed', idx);
  html += buildThreeStateHTML('o2_no_smoking_sign', 'NO SMOKING / O2 safety sign present.', 'bed', idx);
  html += '</div>';

  html += '<div id="eq-catheter-' + idx + '" class="hidden" style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 10px;">';
  html += '<div class="section-label" style="margin-top: 0;">Catheter</div>';
  html += buildThreeStateHTML('cath_bag_dignity_cover', 'Catheter bag covered with dignity/privacy bag.', 'bed', idx);
  html += buildThreeStateHTML('cath_bag_off_floor', 'Catheter bag not touching the floor.', 'bed', idx);
  html += buildThreeStateHTML('cath_tubing_no_kinks', 'Tubing without obvious kinks.', 'bed', idx);
  html += buildThreeStateHTML('cath_tubing_not_trapped', 'Tubing not trapped under resident leg or body.', 'bed', idx);
  html += buildThreeStateHTML('cath_tubing_clean', 'Tubing not visibly soiled or discolored.', 'bed', idx);
  html += '</div>';

  html += '<div id="eq-fall_mat-' + idx + '" class="hidden" style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 10px;">';
  html += '<div class="section-label" style="margin-top: 0;">Fall / Floor Mat</div>';
  html += buildThreeStateHTML('mat_clear_of_furniture', 'Mat is clear of furniture.', 'bed', idx);
  html += buildThreeStateHTML('mat_clean_no_stains', 'Mat is clean and free of stains.', 'bed', idx);
  html += buildThreeStateHTML('mat_not_ripped', 'Mat is not ripped.', 'bed', idx);
  html += buildThreeStateHTML('mat_positioned_ok', 'Mat is positioned appropriately.', 'bed', idx);
  html += '</div>';

  // Conversation (only if awake)
  html += '<div id="conversation-' + idx + '" class="hidden">';
  html += '<div class="section-label">Resident conversation</div>';
  html += '<label>Did you speak with the resident?</label>';
  html += '<div class="state-grid" style="margin-top: 8px;">';
  html += '<button type="button" class="spoke-btn-' + idx + '" onclick="selectSpokeWith(' + idx + ', this, \'Yes\')" style="padding: 12px; border-radius: 8px; border: 1px solid var(--border-strong); background: white; font-size: 14px; cursor: pointer;">Yes</button>';
  html += '<button type="button" class="spoke-btn-' + idx + '" onclick="selectSpokeWith(' + idx + ', this, \'No\')" style="padding: 12px; border-radius: 8px; border: 1px solid var(--border-strong); background: white; font-size: 14px; cursor: pointer;">No</button>';
  html += '</div>';

  html += '<div id="convo-details-' + idx + '" class="hidden" style="margin-top: 16px;">';
  html += '<div style="font-size: 13px; color: var(--text-muted); font-style: italic; margin-bottom: 12px;">Try: How are you doing today? · Is there anything I can help you with? · How has staff been treating you?</div>';

  html += '<label>Any concerns expressed? (tap all that apply)</label>';
  html += '<div id="concerns-' + idx + '" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">';
  CONCERNS_LIST.forEach(c => {
    html += '<button type="button" class="concern-chip-' + idx + '" data-key="' + c.key + '" onclick="toggleConcern(' + idx + ', \'' + c.key + '\', this)" style="padding: 8px 12px; border-radius: 20px; border: 1px solid var(--border-strong); background: white; font-size: 13px; cursor: pointer; color: var(--text-muted);">' + c.label + '</button>';
  });
  html += '</div>';

  html += '<label style="margin-top: 16px;">In the resident\'s own words (optional)</label>';
  html += '<textarea id="own-words-' + idx + '" placeholder="e.g., I wish someone would walk me outside more often" oninput="bedData[' + idx + '].resident_own_words = this.value"></textarea>';

  html += '<label style="margin-top: 12px;">Did you ask: "Is there anything I can do for you right now?"</label>';
  html += '<div class="state-grid" style="margin-top: 8px;">';
  html += '<button type="button" class="help-btn-' + idx + '" onclick="selectHelpAsked(' + idx + ', this, \'Yes\')" style="padding: 12px; border-radius: 8px; border: 1px solid var(--border-strong); background: white; font-size: 14px; cursor: pointer;">Yes</button>';
  html += '<button type="button" class="help-btn-' + idx + '" onclick="selectHelpAsked(' + idx + ', this, \'No\')" style="padding: 12px; border-radius: 8px; border: 1px solid var(--border-strong); background: white; font-size: 14px; cursor: pointer;">No</button>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  html += '</div>';

  container.innerHTML = html;

  // Attach three-state handlers to the newly built content
  attachThreeStateHandlers(container, 'bed');

  // Restore state
  if (bed.resident_state) {
    const stateBtn = container.querySelector('[data-state="' + bed.resident_state + '"]');
    if (stateBtn) selectBedState(idx, stateBtn, bed.resident_state);
  }

  restoreBedAnswers(idx);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function restoreBedAnswers(idx) {
  const bed = bedData[idx];

  // Restore three-state answers
  document.querySelectorAll('.three-state[data-bed-idx="' + idx + '"]').forEach(q => {
    const field = q.dataset.field;
    const value = bed[field];
    if (!value) return;
    const btnClass = value === 'Meets Standard' ? '.ts-meets' : value === 'Needs Attention' ? '.ts-needsattention' : '.ts-na';
    const btn = q.querySelector(btnClass);
    if (btn) selectThreeState(q, value, btn);
  });

  // Restore equipment
  ['oxygen', 'catheter', 'fall_mat'].forEach(eq => {
    if (bed['has_' + eq]) {
      const btn = document.querySelector('#bed-content-container [data-eq="' + eq + '"]');
      if (btn) toggleEquipment(idx, eq, btn, true);
    }
  });

  // Restore hygiene concerns
  if (bed.hygiene_concerns) {
    bed.hygiene_concerns.split(',').filter(Boolean).forEach(key => {
      const chip = document.querySelector('.hyg-chip-' + idx + '[data-key="' + key + '"]');
      if (chip) toggleHygieneConcern(idx, key, chip, true);
    });
  }

  // Restore conversation concerns
  if (bed.concerns_mentioned) {
    bed.concerns_mentioned.split(',').filter(Boolean).forEach(key => {
      const chip = document.querySelector('.concern-chip-' + idx + '[data-key="' + key + '"]');
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

  const empty = document.getElementById('bed-empty-' + idx);
  const details = document.getElementById('bed-details-' + idx);
  const conversation = document.getElementById('conversation-' + idx);

  // Hide everything first
  empty.classList.add('hidden');
  details.classList.add('hidden');

  if (state === 'empty_bed') {
    empty.classList.remove('hidden');
  } else if (state === 'away') {
    // Away: nothing to check
  } else {
    // Awake / sleeping / no_response: show full bed check
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
      const subEl = document.getElementById('eq-' + x + '-' + idx);
      if (subEl) subEl.classList.add('hidden');
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

function toggleHygieneConcern(idx, key, btn, restore) {
  const bed = bedData[idx];
  const current = bed.hygiene_concerns ? bed.hygiene_concerns.split(',').filter(Boolean) : [];
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
  bed.hygiene_concerns = current.join(',');
}

function selectSpokeWith(idx, btn, value) {
  document.querySelectorAll('.spoke-btn-' + idx).forEach(b => {
    b.style.background = 'white';
    b.style.color = 'var(--text)';
    b.style.borderColor = 'var(--border-strong)';
    b.style.fontWeight = '400';
  });
  btn.style.background = 'var(--purple)';
  btn.style.color = 'white';
  btn.style.borderColor = 'var(--purple)';
  btn.style.fontWeight = '600';
  bedData[idx].spoke_with_resident = value;

  const details = document.getElementById('convo-details-' + idx);
  if (value === 'Yes') details.classList.remove('hidden');
  else details.classList.add('hidden');
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
  document.querySelectorAll('.help-btn-' + idx).forEach(b => {
    b.style.background = 'white';
    b.style.color = 'var(--text)';
    b.style.borderColor = 'var(--border-strong)';
    b.style.fontWeight = '400';
  });
  btn.style.background = 'var(--purple)';
  btn.style.color = 'white';
  btn.style.borderColor = 'var(--purple)';
  btn.style.fontWeight = '600';
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

  // Build a whitelist of columns that exist in the rounds table (lean v2 only)
  const allowedFields = [
    'angel_role', 'angel_person', 'room_number', 'round_date', 'round_status',
    'names_on_door_accurate', 'walking_paths_clear', 'room_no_odor',
    'room_temperature_ok', 'walls_surfaces_ok', 'floors_clean_dry',
    'no_exposed_linens', 'curtains_clean_intact', 'bed_linens_pillows_clean',
    'furniture_good_repair', 'gloves_stocked_v2',
    'bathroom_floor_clean', 'bathroom_no_odor', 'bathroom_no_products_left',
    'names_on_door_accurate_note', 'walking_paths_clear_note', 'room_no_odor_note',
    'room_temperature_ok_note', 'walls_surfaces_ok_note', 'floors_clean_dry_note',
    'no_exposed_linens_note', 'curtains_clean_intact_note', 'bed_linens_pillows_clean_note',
    'furniture_good_repair_note', 'gloves_stocked_v2_note',
    'bathroom_floor_clean_note', 'bathroom_no_odor_note', 'bathroom_no_products_left_note',
    'room_notes', 'bathroom_notes', 'staff_seen', 'staff_name_badge',
    'staff_acknowledged', 'staff_notes', 'overall_rating',
    'followup_needed', 'additional_notes'
  ];

  const cleanRound = {};
  allowedFields.forEach(f => {
    if (roundData[f] !== undefined) cleanRound[f] = roundData[f];
  });

  try {
    const { data: roundResult, error: roundError } = await db.from('rounds').insert([cleanRound]).select();
    if (roundError) throw roundError;
    const newRoundId = roundResult[0].id;

    if (bedData.length > 0) {
      // Whitelist for round_beds
      const bedFields = [
        'bed_code', 'resident_state', 'bed_ready_for_admission',
        'call_light_ok', 'water_available', 'bed_safe_and_clear', 'bedside_organized',
        'resident_clean_groomed', 'hygiene_concerns',
        'has_oxygen', 'has_catheter', 'has_fall_mat',
        'o2_tubing_no_kinks', 'o2_tubing_off_floor', 'o2_tubing_dated_7_days', 'o2_no_smoking_sign',
        'cath_bag_dignity_cover', 'cath_bag_off_floor', 'cath_tubing_no_kinks', 'cath_tubing_not_trapped', 'cath_tubing_clean',
        'mat_clear_of_furniture', 'mat_clean_no_stains', 'mat_not_ripped', 'mat_positioned_ok',
        'spoke_with_resident', 'resident_own_words', 'concerns_mentioned', 'asked_if_help_needed',
        'bed_ready_for_admission_note', 'call_light_ok_note', 'water_available_note',
        'bed_safe_and_clear_note', 'bedside_organized_note', 'resident_clean_groomed_note',
        'o2_tubing_no_kinks_note', 'o2_tubing_off_floor_note', 'o2_tubing_dated_7_days_note',
        'o2_no_smoking_sign_note', 'cath_bag_dignity_cover_note', 'cath_bag_off_floor_note',
        'cath_tubing_no_kinks_note', 'cath_tubing_not_trapped_note', 'cath_tubing_clean_note',
        'mat_clear_of_furniture_note', 'mat_clean_no_stains_note', 'mat_not_ripped_note', 'mat_positioned_ok_note'
      ];

      const bedRows = bedData.map(b => {
        const clean = { round_id: newRoundId };
        bedFields.forEach(f => {
          if (b[f] !== undefined) clean[f] = b[f];
        });
        return clean;
      });

      const { error: bedError } = await db.from('round_beds').insert(bedRows);
      if (bedError) throw bedError;
    }

    // Auto-create action items from Needs Attention
    await createActionItemsFromNeedsAttention(newRoundId);

    // User-declared follow-up
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

  Object.keys(roundData).forEach(key => {
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
  });

  bedData.forEach(bed => {
    Object.keys(bed).forEach(key => {
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
    });
  });

  if (items.length > 0) {
    await db.from('action_items').insert(items);
  }
}

function guessDepartment(field) {
  if (/bathroom|floor|odor|linen|curtain|clean|walls|exposed/i.test(field)) return 'Housekeeping';
  if (/bed|furniture|closet|dresser|call_light|walls|mat|repair/i.test(field)) return 'Maintenance';
  if (/oxygen|o2|catheter|pain|wound|enteral|hygiene|clean_groomed/i.test(field)) return 'DON';
  if (/water|food|gloves/i.test(field)) return 'Dietary';
  if (/name_on_door|admission/i.test(field)) return 'Admissions Director';
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
    angel_role: null, angel_person: null, room_number: null, round_date: null,
    round_status: 'submitted',
    names_on_door_accurate: null, walking_paths_clear: null, room_no_odor: null,
    room_temperature_ok: null, walls_surfaces_ok: null, floors_clean_dry: null,
    no_exposed_linens: null, curtains_clean_intact: null, bed_linens_pillows_clean: null,
    furniture_good_repair: null, gloves_stocked_v2: null,
    bathroom_floor_clean: null, bathroom_no_odor: null, bathroom_no_products_left: null,
    room_notes: '', bathroom_notes: '',
    staff_seen: null, staff_name_badge: null, staff_acknowledged: null, staff_notes: '',
    overall_rating: null, followup_needed: null, additional_notes: ''
  };
  bedData = [];
  followupData = { category: null, description: '' };
  currentStep = 1;
  currentBedTab = 0;

  // Clear built questions so they rebuild fresh
  const fl = document.getElementById('firstlook-questions');
  if (fl) fl.innerHTML = '';
  const bath = document.getElementById('bathroom-questions');
  if (bath) bath.innerHTML = '';
}
