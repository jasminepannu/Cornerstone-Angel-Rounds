// ============================================
// CORNERSTONE ANGEL ROUNDS
// Room + per-bed structure
// ============================================

const SUPABASE_URL = 'https://qrvmlfkgpuqsogijlpoe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_huOYD7VwHKdnYFx_iNqF6w_IzcnSCj0';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// STATE
// ============================================

let currentStep = 1;
let facilityPasscode = null;
let angelsData = [];
let routingRules = [];
let bedsData = [];  // All beds from Supabase

let roundData = {
  angel_role: null,
  angel_person: null,
  room_number: null,
  round_date: null,
  // First Look
  name_on_door_correct: null,
  area_clear: null,
  nothing_under_bed: null,
  room_free_of_odor: null,
  temperature_comfortable: null,
  walls_undamaged: null,
  bathroom_clean: null,
  gloves_stocked: null,
  linens_clean: null,
  closets_good_repair: null,
  room_notes: '',
  // Safety
  call_light_reach: null,
  call_light_works: null,
  water_pitcher_ok: null,
  tv_remote_reach: null,
  bed_working: null,
  o2_setting_correct: null,
  o2_tubing_labeled: null,
  o2_tubes_off_floor: null,
  urinals_labeled: null,
  food_labeled: null,
  wound_dressing_done: null,
  enteral_correct: null,
  safety_notes: '',
  // Staff
  staff_seen: null,
  staff_name_badge: null,
  staff_acknowledged: null,
  staff_notes: '',
  // Wrap-up
  overall_rating: null,
  followup_needed: null,
  additional_notes: ''
};

// Per-bed data: one object per bed in the selected room
let bedData = [];  // Array of { bed_code, resident_state, resident_mood, ... }

let followupData = {
  category: null,
  description: ''
};

// ============================================
// STARTUP
// ============================================

window.addEventListener('DOMContentLoaded', async () => {
  await loadFacilityData();

  const savedPasscode = localStorage.getItem('cornerstone_passcode');
  if (savedPasscode && savedPasscode === facilityPasscode) {
    showApp();
  }

  const today = new Date();
  roundData.round_date = today.toISOString().split('T')[0];
  document.getElementById('date-display').value = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('today-date').textContent = today.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  populateAngels();
  populateFollowupCategories();

  document.getElementById('passcode-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkPasscode();
  });
});

// ============================================
// LOAD DATA
// ============================================

async function loadFacilityData() {
  try {
    const { data: settings } = await db.from('settings').select('*');
    const passcodeRow = settings ? settings.find(s => s.key === 'facility_passcode') : null;
    facilityPasscode = passcodeRow ? passcodeRow.value : 'CCC2026';

    const { data: angels } = await db
      .from('angels').select('*').eq('active', true).order('id');
    angelsData = angels || [];

    const { data: beds } = await db
      .from('beds').select('*').eq('active', true).order('bed_code');
    bedsData = beds || [];

    const { data: rules } = await db
      .from('routing_rules').select('*').order('display_order');
    routingRules = rules || [];

    console.log('Loaded:', {
      passcode: facilityPasscode,
      angels: angelsData.length,
      beds: bedsData.length,
      rules: routingRules.length
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
    showApp();
  } else {
    errorBox.classList.remove('hidden');
    document.getElementById('passcode-input').value = '';
  }
}

function showApp() {
  document.getElementById('passcode-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

// ============================================
// STEP NAVIGATION
// ============================================

function goToStep(step) {
  if (step > currentStep) {
    if (currentStep === 1) {
      if (!roundData.angel_role || !roundData.room_number) {
        alert('Please select your role and a room before continuing.');
        return;
      }
    }
    if (currentStep === 3) {
      // Require at least one bed to have a state selected
      const anyStateSelected = bedData.some(b => b.resident_state !== null);
      if (!anyStateSelected) {
        alert('Please select a state for at least one bed before continuing.');
        return;
      }
    }
  }

  document.getElementById('step-' + currentStep).classList.add('hidden');
  document.getElementById('step-' + step).classList.remove('hidden');

  for (let i = 1; i <= 5; i++) {
    const dot = document.getElementById('dot-' + i);
    dot.classList.remove('done', 'current');
    if (i < step) dot.classList.add('done');
    else if (i === step) dot.classList.add('current');
  }

  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// STEP 1 - ANGEL / ROOM
// ============================================

function populateAngels() {
  const select = document.getElementById('angel-select');
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
    bedData = [];
    return;
  }

  // Find beds for this room and prep bedData
  const roomBeds = bedsData.filter(b => b.room_number === roomSelect.value);
  bedData = roomBeds.map(b => ({
    bed_code: b.bed_code,
    resident_state: null,
    resident_mood: null,
    conversation_notes: '',
    offered_help: null,
    nails_ok: null,
    grooming_ok: null,
    appearance_clean: null,
    pillow_comfortable: null,
    pain_observed: null,
    bed_notes: ''
  }));

  const bedCount = bedData.length;
  document.getElementById('bed-count-note').textContent =
    'This room has ' + bedCount + ' bed' + (bedCount === 1 ? '' : 's') +
    ' to check.';

  buildBedCards();
}

// ============================================
// BUILD PER-BED CARDS (Step 3)
// ============================================

function buildBedCards() {
  const container = document.getElementById('bed-cards-container');
  container.innerHTML = '';

  const today = new Date();
  const isMonday = today.getDay() === 1;

  bedData.forEach((bed, idx) => {
    const card = document.createElement('div');
    card.className = 'bed-card';
    card.style.cssText = 'margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border);';
    if (idx === bedData.length - 1) card.style.borderBottom = 'none';

    card.innerHTML = `
      <div class="section-label" style="color: var(--purple); font-size: 14px; margin-top: 8px;">
        Bed ${bed.bed_code}
      </div>

      <label>Resident state <span class="required">*</span></label>
      <div class="state-grid">
        <button type="button" class="state-btn" onclick="selectBedState(${idx}, this, 'awake')">Awake &amp; alert</button>
        <button type="button" class="state-btn" onclick="selectBedState(${idx}, this, 'sleeping')">Sleeping</button>
        <button type="button" class="state-btn" onclick="selectBedState(${idx}, this, 'away')">Away from room</button>
        <button type="button" class="state-btn" onclick="selectBedState(${idx}, this, 'empty_bed')">Empty bed</button>
        <button type="button" class="state-btn" onclick="selectBedState(${idx}, this, 'no_response')" style="grid-column: span 2;">Resident did not respond</button>
      </div>

      <div id="engaged-fields-${idx}" class="hidden">
        <label>How is their mood?</label>
        <div class="mood-scale">
          <span class="mood-option" onclick="selectBedMood(${idx}, this, 'good')" title="Good">😊</span>
          <span class="mood-option" onclick="selectBedMood(${idx}, this, 'okay')" title="Okay">😐</span>
          <span class="mood-option" onclick="selectBedMood(${idx}, this, 'concerning')" title="Concerning">😟</span>
        </div>

        <label>Conversation notes</label>
        <textarea id="conversation-notes-${idx}" placeholder="What did the resident share? Any concerns?"
                  oninput="bedData[${idx}].conversation_notes = this.value"></textarea>

        <div class="check-item" onclick="toggleBedCheck(${idx}, this, 'offered_help')">
          <div class="circle"></div>
          <span>I asked if I could help them</span>
        </div>
      </div>

      <div class="section-label">Appearance</div>

      <div class="check-item" onclick="toggleBedCheck(${idx}, this, 'appearance_clean')">
        <div class="circle"></div>
        <span>Clean — no crumbs or stains</span>
      </div>

      <div class="check-item" onclick="toggleBedCheck(${idx}, this, 'grooming_ok')">
        <div class="circle"></div>
        <span>Grooming looks good</span>
      </div>

      <div class="check-item" onclick="toggleBedCheck(${idx}, this, 'pillow_comfortable')">
        <div class="circle"></div>
        <span>Pillow looks comfortable</span>
      </div>

      ${isMonday ? `
      <div class="check-item" onclick="toggleBedCheck(${idx}, this, 'nails_ok')">
        <div class="circle"></div>
        <span>Nails checked and OK (weekly check today)</span>
      </div>
      ` : ''}

      <div class="check-item" onclick="toggleBedCheck(${idx}, this, 'pain_observed')">
        <div class="circle"></div>
        <span>⚠️ Signs of pain observed</span>
      </div>

      <label>Notes for this bed</label>
      <textarea id="bed-notes-${idx}" placeholder="Anything else specific to this bed..."
                oninput="bedData[${idx}].bed_notes = this.value"></textarea>
    `;

    container.appendChild(card);
  });

  // Auto-mark nails as N/A on non-Mondays for all beds
  if (!isMonday) {
    bedData.forEach(bed => { bed.nails_ok = 'N/A'; });
  }
}

function selectBedState(idx, btn, state) {
  const card = btn.closest('.bed-card');
  card.querySelectorAll('.state-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  bedData[idx].resident_state = state;

  const engagedFields = document.getElementById('engaged-fields-' + idx);
  if (state === 'awake') {
    engagedFields.classList.remove('hidden');
  } else {
    engagedFields.classList.add('hidden');
    bedData[idx].resident_mood = null;
    bedData[idx].conversation_notes = '';
    bedData[idx].offered_help = null;
  }
}

function selectBedMood(idx, el, mood) {
  const card = el.closest('.bed-card');
  card.querySelectorAll('.mood-option').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
  bedData[idx].resident_mood = mood;
}

function toggleBedCheck(idx, el, field) {
  el.classList.toggle('checked');
  bedData[idx][field] = el.classList.contains('checked');
}

// ============================================
// ROOM-LEVEL CHECKBOXES
// ============================================

function toggleCheck(el) {
  el.classList.toggle('checked');
  const field = el.dataset.field;
  if (!field) return;
  roundData[field] = el.classList.contains('checked');
}

function allClear(section) {
  if (section === 'firstlook') {
    const step = document.getElementById('step-2');
    const items = step.querySelectorAll('.check-item:not(.all-clear)');
    items.forEach(item => {
      item.classList.add('checked');
      const field = item.dataset.field;
      if (field) roundData[field] = true;
    });
    const allClearBtn = step.querySelector('.all-clear');
    allClearBtn.classList.add('checked');
  }
}

// ============================================
// STEP 5 - STAFF / RATING / FOLLOWUP
// ============================================

function selectStaffSeen(btn, seen) {
  const parent = btn.parentElement;
  parent.querySelectorAll('.state-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  roundData.staff_seen = seen;

  const staffFields = document.getElementById('staff-fields');
  if (seen) {
    staffFields.classList.remove('hidden');
  } else {
    staffFields.classList.add('hidden');
    roundData.staff_name_badge = null;
    roundData.staff_acknowledged = null;
    roundData.staff_notes = '';
  }
}

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
  } else {
    followupFields.classList.add('hidden');
    followupData.category = null;
    followupData.description = '';
  }
}

function populateFollowupCategories() {
  const select = document.getElementById('followup-category');
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
  // Grab textareas
  roundData.room_notes = document.getElementById('room-notes').value;
  roundData.safety_notes = document.getElementById('safety-notes').value;
  roundData.staff_notes = document.getElementById('staff-notes').value;
  roundData.additional_notes = document.getElementById('additional-notes').value;

  if (roundData.followup_needed) {
    followupData.category = document.getElementById('followup-category').value;
    followupData.description = document.getElementById('followup-description').value;

    if (!followupData.category || !followupData.description) {
      alert('Please pick a follow-up category and describe the issue.');
      return;
    }
  }

  try {
    // Insert the parent round
    const { data: roundResult, error: roundError } = await db
      .from('rounds')
      .insert([roundData])
      .select();

    if (roundError) throw roundError;
    const newRoundId = roundResult[0].id;

    // Insert one row per bed into round_beds
    if (bedData.length > 0) {
      const bedRows = bedData.map(b => ({ ...b, round_id: newRoundId }));
      const { error: bedError } = await db.from('round_beds').insert(bedRows);
      if (bedError) throw bedError;
    }

    // Follow-up action item
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

    // Auto-flag urgent for pain observed on any bed
    const bedsWithPain = bedData.filter(b => b.pain_observed);
    for (const bed of bedsWithPain) {
      await db.from('action_items').insert([{
        round_id: newRoundId,
        room_number: roundData.room_number,
        reported_by_role: roundData.angel_role,
        reported_by_person: roundData.angel_person,
        category: 'clinical_urgent',
        assigned_to_role: 'DON',
        description: 'Signs of pain observed at Bed ' + bed.bed_code,
        urgent: true
      }]);
    }

    // Auto-flag urgent for O2 mismatch
    if (roundData.o2_setting_correct === false) {
      await db.from('action_items').insert([{
        round_id: newRoundId,
        room_number: roundData.room_number,
        reported_by_role: roundData.angel_role,
        reported_by_person: roundData.angel_person,
        category: 'clinical_urgent',
        assigned_to_role: 'DON',
        description: 'O2 setting does not match order — reported to DON',
        urgent: true
      }]);
    }

    showSuccessScreen();
  } catch (err) {
    console.error('Submit error:', err);
    alert('Something went wrong saving your round. Please try again.\n\n' + (err.message || ''));
  }
}

function showSuccessScreen() {
  document.getElementById('step-5').classList.add('hidden');
  document.querySelector('.progress-dots').classList.add('hidden');
  document.getElementById('success-screen').classList.remove('hidden');
  document.getElementById('success-summary').textContent =
    'Room ' + roundData.room_number + ' complete (' + bedData.length + ' beds). Great work.';
}

function startNewRound() {
  // Reset roundData except angel
  Object.keys(roundData).forEach(key => {
    if (key !== 'angel_role' && key !== 'angel_person' && key !== 'round_date') {
      roundData[key] = typeof roundData[key] === 'string' ? '' : null;
    }
  });

  bedData = [];
  followupData = { category: null, description: '' };

  document.querySelectorAll('.check-item.checked').forEach(el => el.classList.remove('checked'));
  document.querySelectorAll('.state-btn.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.mood-option.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('textarea').forEach(t => t.value = '');

  document.getElementById('room-select').value = '';
  document.getElementById('bed-count-note').textContent = '';
  roundData.room_number = null;

  document.getElementById('staff-fields').classList.add('hidden');
  document.getElementById('followup-fields').classList.add('hidden');
  document.getElementById('bed-cards-container').innerHTML = '';

  document.querySelector('.progress-dots').classList.remove('hidden');
  document.getElementById('success-screen').classList.add('hidden');
  goToStep(1);
}
