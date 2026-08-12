// ============================================
// CORNERSTONE ANGEL ROUNDS
// The brain of the angel form.
// Talks to Supabase to load angels/rooms and save rounds.
// ============================================

// Your Supabase connection info
const SUPABASE_URL = 'https://qrvmlfkgpuqsogijlpoe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_huOYD7VwHKdnYFx_iNqF6w_IzcnSCj0';

// Create the Supabase client (renamed to 'db' to avoid conflict with the library)
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// STATE - the running memory of the current round
// ============================================

let currentStep = 1;
let facilityPasscode = null;
let angelsData = [];
let routingRules = [];

let roundData = {
  angel_role: null,
  angel_person: null,
  room_number: null,
  round_date: null,
  name_on_door_correct: null,
  floor_clear: null,
  room_free_of_odor: null,
  temperature_comfortable: null,
  walls_undamaged: null,
  bathroom_clean: null,
  closets_good_repair: null,
  room_notes: '',
  resident_state: null,
  resident_mood: null,
  conversation_notes: '',
  offered_help: null,
  nails_ok: null,
  grooming_ok: null,
  appearance_clean: null,
  pillow_comfortable: null,
  pain_observed: null,
  linens_clean: null,
  abuse_concern: null,
  resident_notes: '',
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
  staff_seen: null,
  staff_name_badge: null,
  staff_acknowledged: null,
  staff_notes: '',
  overall_rating: null,
  followup_needed: null,
  additional_notes: ''
};

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

  handleNailCheckVisibility(today);
  populateAngels();
  populateFollowupCategories();

  document.getElementById('passcode-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkPasscode();
  });
});

// ============================================
// LOADING DATA FROM SUPABASE
// ============================================

async function loadFacilityData() {
  try {
    const { data: settings, error: settingsError } = await db.from('settings').select('*');
    if (settingsError) {
      console.error('Settings error:', settingsError);
    }
    const passcodeRow = settings ? settings.find(s => s.key === 'facility_passcode') : null;
    facilityPasscode = passcodeRow ? passcodeRow.value : 'CCC2026';
    console.log('Loaded passcode:', facilityPasscode);

    const { data: angels, error: angelsError } = await db
      .from('angels')
      .select('*')
      .eq('active', true)
      .order('id');
    if (angelsError) {
      console.error('Angels error:', angelsError);
    }
    angelsData = angels || [];
    console.log('Loaded angels:', angelsData.length);

    const { data: rules, error: rulesError } = await db
      .from('routing_rules')
      .select('*')
      .order('display_order');
    if (rulesError) {
      console.error('Routing rules error:', rulesError);
    }
    routingRules = rules || [];
    console.log('Loaded routing rules:', routingRules.length);
  } catch (err) {
    console.error('Error loading data from Supabase:', err);
    alert('Could not connect to the database. Please refresh and try again.');
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
      if (!roundData.resident_state) {
        alert('Please select the resident state before continuing.');
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

  roomSelect.onchange = () => {
    roundData.room_number = roomSelect.value;
  };
}

// ============================================
// CHECKBOXES
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
// STEP 3 - RESIDENT
// ============================================

function selectState(btn, state) {
  document.querySelectorAll('#step-3 .state-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  roundData.resident_state = state;

  const engagedFields = document.getElementById('engaged-fields');
  if (state === 'awake') {
    engagedFields.classList.remove('hidden');
  } else {
    engagedFields.classList.add('hidden');
    roundData.resident_mood = null;
    roundData.conversation_notes = '';
    roundData.offered_help = null;
  }
}

function selectMood(el, mood) {
  document.querySelectorAll('.mood-option').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
  roundData.resident_mood = mood;
}

function handleNailCheckVisibility(today) {
  const isMonday = today.getDay() === 1;
  const nailsEl = document.getElementById('nails-container');
  const nailsLabel = document.getElementById('nails-label');

  if (isMonday) {
    nailsLabel.textContent = 'Nails checked and OK (weekly check today)';
  } else {
    nailsEl.classList.add('hidden');
    roundData.nails_ok = 'N/A';
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
  roundData.room_notes = document.getElementById('room-notes').value;
  roundData.conversation_notes = document.getElementById('conversation-notes').value;
  roundData.resident_notes = document.getElementById('resident-notes').value;
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
    const { data: roundResult, error: roundError } = await db
      .from('rounds')
      .insert([roundData])
      .select();

    if (roundError) throw roundError;

    const newRoundId = roundResult[0].id;

    if (roundData.followup_needed) {
      const rule = routingRules.find(r => r.category === followupData.category);
      const assignedRole = rule ? rule.routes_to_role : 'Administrator';

      let finalRole = assignedRole;
      const targetAngel = angelsData.find(a => a.role === assignedRole);
      if (targetAngel && !targetAngel.current_person && rule.fallback_role) {
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
        urgent: isUrgent || roundData.abuse_concern
      }]);
    }

    if (roundData.abuse_concern && !roundData.followup_needed) {
      await db.from('action_items').insert([{
        round_id: newRoundId,
        room_number: roundData.room_number,
        reported_by_role: roundData.angel_role,
        reported_by_person: roundData.angel_person,
        category: 'abuse_urgent',
        assigned_to_role: 'Administrator',
        description: 'Possible abuse indicator flagged during round',
        urgent: true
      }]);
    }

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
    'Room ' + roundData.room_number + ' complete. Great work.';
}

function startNewRound() {
  Object.keys(roundData).forEach(key => {
    if (key !== 'angel_role' && key !== 'angel_person' && key !== 'round_date') {
      roundData[key] = typeof roundData[key] === 'string' ? '' : null;
    }
  });

  followupData = { category: null, description: '' };

  document.querySelectorAll('.check-item.checked').forEach(el => el.classList.remove('checked'));
  document.querySelectorAll('.state-btn.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.mood-option.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('textarea').forEach(t => t.value = '');

  document.getElementById('room-select').value = '';
  roundData.room_number = null;

  document.getElementById('engaged-fields').classList.add('hidden');
  document.getElementById('staff-fields').classList.add('hidden');
  document.getElementById('followup-fields').classList.add('hidden');

  document.querySelector('.progress-dots').classList.remove('hidden');
  document.getElementById('success-screen').classList.add('hidden');
  goToStep(1);
}
