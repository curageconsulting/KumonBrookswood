/* ── CONFIG ── Change these to match your centre */
const CENTRE_NAME = "Kumon Brookswood";
const SUBJECTS = ["Mathematics", "English"];
const EARLY_LEVELS = ['early'];
const STD_LEVELS   = ['main'];
const MAX_EARLY = 6;
const MAX_STD   = 15;
const SCHEDULE = {
  Monday:   { hours: ['2:30','3:00','3:30','4:00','4:30','5:00','5:30'], suffix: 'PM' },
  Thursday: { hours: ['2:30','3:00','3:30','4:00','4:30','5:00','5:30'], suffix: 'PM' },
  Friday:   { hours: ['2:30','3:00','3:30','4:00','4:30','5:00','5:30'], suffix: 'PM' },
  Saturday: { hours: ['9:00','9:30','10:00','10:30','11:00','11:30'],    suffix: 'AM' }
};
const DAY_ORDER = { Monday:0, Thursday:1, Friday:2, Saturday:3 };
const CANCEL_NOTICE_DAYS = 3;
const ADMIN_PASSWORD = "Kumon2024!";
/* ── END CONFIG ── */

const isEarly = lvl => lvl === 'early';
const classLabel = lvl => isEarly(lvl) ? 'Early Learner' : 'Main class';
const slotDur = lvl => isEarly(lvl) ? 30 : 45;
const slotMax = lvl => isEarly(lvl) ? MAX_EARLY : MAX_STD;
const initials = n => n.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const fmtTime  = (h, day) => h + ' ' + (day && SCHEDULE[day] ? SCHEDULE[day].suffix : (parseInt(h) < 9 ? 'AM' : 'PM'));
const availHours = (day, lvl) => {
  const suffix = SCHEDULE[day].suffix;
  const closeMin = suffix === 'AM' ? 12*60 : 18*60;
  const toMin = h => {
    const [hr, mn] = h.split(':').map(Number);
    return (hr + (suffix === 'PM' && hr !== 12 ? 12 : 0)) * 60 + mn;
  };
  const toHHMM = totalMin => {
    let h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (suffix === 'PM' && h > 12) h = h - 12;
    return h + ':' + (m === 0 ? '00' : m < 10 ? '0'+m : m);
  };
  if (isEarly(lvl)) {
    // Early Learner: use the centre's fixed 30-min slots, filter those that end by close
    return SCHEDULE[day].hours.filter(h => toMin(h) + 30 <= closeMin);
  } else {
    // Main class: generate 45-min slots starting from opening time
    const openMin = toMin(SCHEDULE[day].hours[0]);
    const slots = [];
    let t = openMin;
    while (t + 45 <= closeMin) {
      slots.push(toHHMM(t));
      t += 45;
    }
    return slots;
  }
};
const uid = () => Math.random().toString(36).slice(2,9);

// Returns the next Date object for a given day name (Monday, Saturday etc.)
function nextOccurrence(dayName) {
  const dayNum = {Sunday:0,Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6};
  const today = new Date();
  today.setHours(0,0,0,0);
  let diff = dayNum[dayName] - today.getDay();
  if (diff <= 0) diff += 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

// Returns days between today (midnight) and a future Date
function daysUntil(date) {
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.round((date - today) / 86400000);
}

// Format a Date as "Mon, Jun 9"
function fmtDate(date) {
  return date.toLocaleDateString('en-CA', {weekday:'short', month:'short', day:'numeric'});
}

/* ── Storage ── localStorage for real persistence */
const LS = {
  get: k => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):null; } catch(e){return null;} },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch(e){} },
  del: k => { try { localStorage.removeItem(k); } catch(e){} }
};

function allPossibleSlots(day) {
  const suffix = SCHEDULE[day].suffix;
  const closeMin = suffix === 'AM' ? 12*60 : 18*60;
  const toMin = h => {
    const [hr, mn] = h.split(':').map(Number);
    return (hr + (suffix === 'PM' && hr !== 12 ? 12 : 0)) * 60 + mn;
  };
  const toHHMM = totalMin => {
    let h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (suffix === 'PM' && h > 12) h = h - 12;
    return h + ':' + (m === 0 ? '00' : m < 10 ? '0'+m : m);
  };
  const earlySlots = SCHEDULE[day].hours;
  const openMin = toMin(SCHEDULE[day].hours[0]);
  const mainSlots = [];
  let t = openMin;
  while (t + 45 <= closeMin) { mainSlots.push(toHHMM(t)); t += 45; }
  return [...new Set([...earlySlots, ...mainSlots])];
}

function loadCap() {
  let c = LS.get('kum_cap');
  if (!c) {
    c = {};
    Object.keys(SCHEDULE).forEach(d => {
      c[d] = {};
      allPossibleSlots(d).forEach(h => { c[d][h] = {early:0, std:0}; });
    });
    LS.set('kum_cap', c);
  } else {
    // Ensure any new slots are initialised in existing cap data
    Object.keys(SCHEDULE).forEach(d => {
      if (!c[d]) c[d] = {};
      allPossibleSlots(d).forEach(h => { if (!c[d][h]) c[d][h] = {early:0, std:0}; });
    });
  }
  return c;
}

let S = { view:'login', user:null, cap:loadCap(), tab:'bookings', adminTab:'overview', bookFlow:null, pendingEmail:'', confirmRemove:null };

/* ── Render engine ── */
const root = () => document.getElementById('root');
function render() { root().innerHTML = VIEWS[S.view](); attachEvents(); }
function go(patch) { Object.assign(S,patch); render(); }

/* ── Views ── */
const VIEWS = {

  login: () => `
    <div class="section-label">Welcome</div>
    <div class="card">
      <div class="card-hd"><i class="ti ti-mail"></i> Sign in to your account</div>
      <p class="muted" style="margin-bottom:1.25rem">Enter your email to sign in. First time visiting? We'll set up your account automatically.</p>
      <div class="field"><label>Email address</label><input id="em" type="email" placeholder="your@email.com" autocomplete="email" /></div>
      <div id="msg"></div>
      <button class="btn btn-primary mt12" onclick="handleLogin()">Continue <i class="ti ti-arrow-right"></i></button>
    </div>
    <p style="text-align:center;margin-top:12px"><span class="link" onclick="go({view:'adminLogin'})"><i class="ti ti-shield-lock" style="font-size:12px"></i> Centre admin login</span></p>`,

  register: () => `
    <div class="section-label">New account</div>
    <div class="card">
      <div class="card-hd"><i class="ti ti-user-plus"></i> Create your account</div>
      <p class="muted" style="margin-bottom:1.25rem">Welcome to Kumon Brookswood! Just a few details to get you set up.</p>
      <div class="g2">
        <div class="field"><label>First name</label><input id="fn" placeholder="Sarah" autocomplete="given-name" /></div>
        <div class="field"><label>Last name</label><input id="ln" placeholder="Chen" autocomplete="family-name" /></div>
      </div>
      <div class="field"><label>Phone number</label><input id="ph" type="tel" placeholder="+1 604 000 0000" autocomplete="tel" /></div>
      <div class="field"><label>Email</label><input id="em2" value="${S.pendingEmail}" readonly /></div>
      <div id="msg"></div>
      <button class="btn btn-primary mt12" onclick="handleRegister()"><i class="ti ti-check"></i> Create account & continue</button>
      <button class="btn mt8" onclick="go({view:'login'})"><i class="ti ti-arrow-left"></i> Back</button>
    </div>`,

  dashboard: () => {
    const u = S.user;
    return `
    <div class="user-card">
      <div class="avatar">${initials(u.firstName+' '+u.lastName)}</div>
      <div style="flex:1;min-width:0">
        <div class="user-card-name">Hi, ${u.firstName}!</div>
        <div class="user-card-email">${u.email}</div>
      </div>
      <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border-color:rgba(255,255,255,0.25);backdrop-filter:blur(4px)" onclick="signOut()">Sign out</button>
    </div>
    <div class="tab-bar">
      <div class="tab ${S.tab==='bookings'?'active':''}" onclick="go({tab:'bookings'})"><i class="ti ti-calendar"></i> Bookings</div>
      <div class="tab ${S.tab==='students'?'active':''}" onclick="go({tab:'students'})"><i class="ti ti-users"></i> Students</div>
      <div class="tab ${S.tab==='account'?'active':''}" onclick="go({tab:'account'})"><i class="ti ti-settings"></i> Account</div>
    </div>
    ${S.tab==='bookings' ? renderBookings(u) : ''}
    ${S.tab==='students' ? renderStudents(u) : ''}
    ${S.tab==='account'  ? renderAccount(u)  : ''}`;
  },

  addStudent: () => `
    <div class="section-label">New student</div>
    <div class="card">
      <div class="card-hd"><i class="ti ti-user-plus"></i> Add a student</div>
      <div class="g2">
        <div class="field"><label>First name</label><input id="sfn" placeholder="Alex" /></div>
        <div class="field"><label>Last name</label><input id="sln" placeholder="Chen" /></div>
      </div>
      <div class="field">
        <label>Kumon level</label>
        <select id="slvl">
          <option value="">-- Select class type --</option>
          <option value="early">Early Learner — 30 min slot (Age 3–9)</option>
          <option value="main">Main class — 45 min slot (Age 10+)</option>
        </select>
      </div>
      <div class="field">
        <label>Subject</label>
        <select id="ssubj">${SUBJECTS.map(s=>`<option>${s}</option>`).join('')}</select>
      </div>
      <div id="msg"></div>
      <button class="btn btn-primary mt8" onclick="handleAddStudent()"><i class="ti ti-plus"></i> Add student</button>
      <button class="btn mt8" onclick="go({view:'dashboard',tab:'students'})">Cancel</button>
    </div>`,

  bookSlots: () => {
    const bf = S.bookFlow;
    const steps = ['Pick day 1','Pick time','Pick day 2','Pick time','Review'];
    const stepIdx = bf.step - 1;
    const progressW = Math.round((bf.step / 5) * 100);
    return `
    <div class="card">
      <div class="card-hd"><i class="ti ti-calendar-plus"></i> Book sessions — ${bf.student.firstName}</div>
      <div class="step-label"><span>${steps[stepIdx]}</span><span>Step ${bf.step} of 5</span></div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${progressW}%"></div></div>
      ${bf.step===1 ? renderDayPicker(1) : ''}
      ${bf.step===2 ? renderSlotPicker(1) : ''}
      ${bf.step===3 ? renderDayPicker(2) : ''}
      ${bf.step===4 ? renderSlotPicker(2) : ''}
      ${bf.step===5 ? renderReview() : ''}
      <div id="msg"></div>
    </div>`;
  },


  adminLogin: () => `
    <div class="section-label">Staff access</div>
    <div class="card">
      <div class="card-hd"><i class="ti ti-shield-lock"></i> Admin login</div>
      <p class="muted" style="margin-bottom:1.25rem">For Kumon Brookswood Centre staff only. Please enter your admin password to continue.</p>
      <div class="field"><label>Admin password</label><input id="apw" type="password" placeholder="Enter password" /></div>
      <div id="msg"></div>
      <button class="btn btn-primary mt12" onclick="handleAdminLogin()"><i class="ti ti-lock-open"></i> Sign in as admin</button>
      <button class="btn mt8" onclick="go({view:'login'})"><i class="ti ti-arrow-left"></i> Back to parent login</button>
    </div>`,

  admin: () => {
    const allBookings = getAllBookings();
    const allParents  = getAllParents();
    return `
    <div class="admin-card">
      <div class="avatar"><i class="ti ti-shield" style="font-size:18px"></i></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px">Admin Dashboard</div>
        <div style="font-size:12px;opacity:.7;margin-top:2px">Kumon Brookswood · ${allBookings.length} bookings · ${allParents.length} families</div>
      </div>
      <button class="btn btn-sm" style="background:rgba(255,255,255,0.12);color:#fff;border-color:rgba(255,255,255,0.2)" onclick="go({view:'login',user:null})">Sign out</button>
    </div>
    <div class="tab-bar">
      <div class="tab ${S.adminTab==='overview'?'active':''}" onclick="go({adminTab:'overview'})"><i class="ti ti-layout-dashboard"></i> Overview</div>
      <div class="tab ${S.adminTab==='bookings'?'active':''}" onclick="go({adminTab:'bookings'})"><i class="ti ti-calendar"></i> Bookings</div>
      <div class="tab ${S.adminTab==='slots'?'active':''}" onclick="go({adminTab:'slots'})"><i class="ti ti-table"></i> Slots</div>
      <div class="tab ${S.adminTab==='families'?'active':''}" onclick="go({adminTab:'families'})"><i class="ti ti-users"></i> Families</div>
    </div>
    ${S.adminTab==='overview'  ? renderAdminOverview(allBookings, allParents) : ''}
    ${S.adminTab==='bookings'  ? renderAdminBookings(allBookings) : ''}
    ${S.adminTab==='slots'     ? renderAdminSlots() : ''}
    ${S.adminTab==='families'  ? renderAdminFamilies(allParents) : ''}
    `;},

  bookingSuccess: () => {
    const st = S.user.students.find(s=>s.id===S.lastBookedStudentId);
    const bookings = st ? st.bookings.filter(b=>S.lastBookedIds.includes(b.id)) : [];
    return `
    <div class="section-label">Booking confirmed</div>
    <div class="card" style="text-align:center;padding:2rem 1.5rem">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--green-bg);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem">
        <i class="ti ti-circle-check" style="font-size:30px;color:var(--green)"></i>
      </div>
      <h2 style="font-family:'DM Serif Display',serif;font-size:22px;margin-bottom:6px">You're booked!</h2>
      <p class="muted" style="margin-bottom:1.5rem">Sessions have been confirmed for <strong>${st?st.firstName:''}</strong>. Add them to your calendar so you never miss a class.</p>
      ${bookings.map(b=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--fog);border-radius:var(--radius);margin-bottom:8px;text-align:left">
          <div>
            <div style="font-weight:600;font-size:14px">${b.day} · ${fmtTime(b.time,b.day)}</div>
            <div style="font-size:12px;color:var(--ink3);margin-top:1px">Weekly · ${slotDur(b.level)} min</div>
          </div>
          <span class="pill pill-green"><i class="ti ti-check" style="font-size:11px"></i> Confirmed</span>
        </div>`).join('')}
      <button class="btn btn-primary mt12" onclick="addBookingToCalendar('${S.lastBookedStudentId}',${JSON.stringify(S.lastBookedIds||[])})">
        <i class="ti ti-calendar-plus"></i> Add sessions to calendar
      </button>
      <p class="muted" style="font-size:12px;margin-top:8px">Downloads an .ics file — works with Google Calendar, Apple Calendar &amp; Outlook</p>
      <button class="btn mt8" onclick="go({view:'dashboard',tab:'bookings'})"><i class="ti ti-arrow-right"></i> Go to my bookings</button>
    </div>`;
  },

  cancelConfirm: () => {
    const b = S.cancelTarget;
    const nextDate = nextOccurrence(b.day);
    const days = daysUntil(nextDate);
    const canCancel = days >= CANCEL_NOTICE_DAYS;
    const dateStr = fmtDate(nextDate);

    // Build next 4 upcoming dates for this day
    const upcomingDates = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(nextDate);
      d.setDate(nextDate.getDate() + i * 7);
      upcomingDates.push(d);
    }

    return `
    <div class="section-label">Cancel a session</div>
    <div class="card">
      <div class="card-hd"><i class="ti ti-calendar-x"></i> Cancel a session</div>
      <div class="row"><span class="row-label">Student</span><span class="row-val">${b.studentName}</span></div>
      <div class="row"><span class="row-label">Recurring slot</span><span class="row-val">${b.day} · ${fmtTime(b.time, b.day)}</span></div>
      <div class="row"><span class="row-label">Subject</span><span class="row-val">${b.subject} · ${classLabel(b.level)}</span></div>
      <hr/>
      <p class="muted" style="margin-bottom:12px">Select the date you want to cancel. This will skip that one session only — your recurring slot stays intact.</p>
      ${upcomingDates.map((d,i) => {
        const dDays = daysUntil(d);
        const dStr = fmtDate(d);
        const isoStr = d.toISOString().slice(0,10);
        const ok = dDays >= CANCEL_NOTICE_DAYS;
        const alreadyCancelled = (b.cancelledDates||[]).includes(isoStr);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:${alreadyCancelled?'var(--fog2)':ok?'var(--fog)':'var(--red-bg)'};border:1px solid ${alreadyCancelled?'var(--border)':ok?'var(--border)':'rgba(214,48,49,0.15)'};margin-bottom:8px">
          <div>
            <div style="font-weight:600;font-size:14px;color:${alreadyCancelled?'var(--ink3)':'var(--ink)'}">${dStr}</div>
            <div style="font-size:12px;margin-top:2px;color:${ok?'var(--ink3)':'var(--red)'}">
              ${alreadyCancelled ? '✓ Already cancelled' : ok ? dDays+' days away — can cancel' : 'Less than '+CANCEL_NOTICE_DAYS+' days — too late'}
            </div>
          </div>
          ${alreadyCancelled
            ? `<span class="pill pill-ink">Cancelled</span>`
            : ok
              ? `<button class="btn btn-danger btn-sm" onclick="doCancelDate('${isoStr}')"><i class="ti ti-x"></i> Cancel</button>`
              : `<span class="pill pill-red">Too late</span>`
          }
        </div>`;
      }).join('')}
      <div class="alert alert-warn mt8"><i class="ti ti-info-circle"></i> Need to cancel a date less than ${CANCEL_NOTICE_DAYS} days away? Please call us at (604) 245-2121.</div>
      <button class="btn mt8" onclick="go({view:'dashboard',tab:'bookings'})"><i class="ti ti-arrow-left"></i> Back to bookings</button>
    </div>`;
  }
};

/* ── Sub-renderers ── */
function renderBookings(u) {
  const all = [];
  (u.students||[]).forEach(st => {
    (st.bookings||[]).forEach(b => all.push({...b, studentName:st.firstName+' '+st.lastName, studentId:st.id}));
  });
  all.sort((a,b) => (DAY_ORDER[a.day]||0)-(DAY_ORDER[b.day]||0));

  if (!all.length) return `
    <div class="card empty-state">
      <div class="empty-icon"><i class="ti ti-calendar-off"></i></div>
      <h3>No bookings yet</h3>
      <p>${(u.students||[]).length ? 'Go to Students to book your first session.' : 'Add a student first, then book their sessions.'}</p>
      ${(u.students||[]).length ? `<button class="btn btn-primary" onclick="go({view:'dashboard',tab:'students'})"><i class="ti ti-plus"></i> Book a session</button>` : ''}
    </div>`;

  return `
    <div class="card">
      <div class="card-hd"><i class="ti ti-calendar-week"></i> Weekly schedule
        <button class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:12px" onclick="addAllToCalendar()"><i class="ti ti-calendar-plus"></i> Add all to calendar</button>
      </div>
      ${all.map(b=>{
        const nextDate = nextOccurrence(b.day);
        const days = daysUntil(nextDate);
        const dateStr = fmtDate(nextDate);
        return `
        <div class="row" style="align-items:flex-start">
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${b.day} · ${fmtTime(b.time, b.day)}</div>
            <div style="font-size:12px;color:var(--ink3);margin-top:2px">${b.studentName} · ${b.subject}</div>
            <div style="margin-top:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span class="pill ${isEarly(b.level)?'pill-green':'pill-teal'}">${classLabel(b.level)}</span>
              <span class="pill pill-ink"><i class="ti ti-calendar" style="font-size:11px"></i> Next: ${dateStr}</span>
              <span class="pill ${days<=3?'pill-amber':'pill-ink'}">${days}d away</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;margin-top:2px">
            <button class="btn btn-ghost btn-sm" onclick="addBookingToCalendar('${b.studentId}',['${b.id}'])"><i class="ti ti-calendar-plus"></i> Add to calendar</button>
            <button class="btn btn-danger btn-sm" onclick="startCancel('${b.studentId}','${b.id}')"><i class="ti ti-x"></i> Cancel session</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function renderStudents(u) {
  const students = u.students||[];
  if (!students.length) return `
    <div class="card empty-state">
      <div class="empty-icon"><i class="ti ti-users"></i></div>
      <h3>No students yet</h3>
      <p>Add your child to start booking their weekly sessions.</p>
      <button class="btn btn-primary" onclick="go({view:'addStudent'})"><i class="ti ti-plus"></i> Add a student</button>
    </div>`;

  return `
    <div class="card">
      <div class="card-hd"><i class="ti ti-users"></i> Your students</div>
      ${students.map(st=>`
        <div class="student-row">
          <div class="avatar" style="margin-top:2px">${initials(st.firstName+' '+st.lastName)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px">${st.firstName} ${st.lastName}</div>
            <div style="font-size:12px;color:var(--text2)">${st.subject} · ${classLabel(st.level)} · ${slotDur(st.level)}-min slots</div>
            <div style="margin-top:5px">${(st.bookings||[]).map(b=>`<span class="chip"><i class="ti ti-clock" style="font-size:11px"></i>${b.day.slice(0,3)} ${fmtTime(b.time, b.day)}</span>`).join('') || '<span class="muted" style="font-size:12px">No sessions booked</span>'}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">
            ${(st.bookings||[]).length<2 ? `<button class="btn btn-primary btn-sm" onclick="startBooking('${st.id}')">Book</button>` : ''}
            ${S.confirmRemove===st.id
              ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
                   <span style="font-size:11px;color:var(--red-text);font-weight:600">Are you sure?</span>
                   <div style="display:flex;gap:4px">
                     <button class="btn btn-sm" onclick="go({confirmRemove:null})">No</button>
                     <button class="btn btn-danger btn-sm" onclick="doRemoveStudent('${st.id}')"><i class="ti ti-trash"></i> Yes</button>
                   </div>
                 </div>`
              : `<button class="btn btn-danger btn-sm" onclick="go({confirmRemove:'${st.id}'})">Remove</button>`
            }
          </div>
        </div>`).join('')}
    </div>
    <button class="btn" onclick="go({view:'addStudent'})"><i class="ti ti-plus"></i> Add another student</button>`;
}

function renderAccount(u) {
  return `
    <div class="card">
      <div class="card-hd"><i class="ti ti-user"></i> Account details</div>
      <div class="row"><span class="row-label">Name</span><span class="row-val">${u.firstName} ${u.lastName}</span></div>
      <div class="row"><span class="row-label">Email</span><span class="row-val">${u.email}</span></div>
      <div class="row"><span class="row-label">Phone</span><span class="row-val">${u.phone||'—'}</span></div>
      <div class="row"><span class="row-label">Member since</span><span class="row-val">${new Date(u.createdAt).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'})}</span></div>
    </div>
    <div class="card">
      <div class="card-hd"><i class="ti ti-info-circle"></i> Booking policy</div>
      <p style="font-size:14px;color:var(--text2);line-height:1.7">
        Each student attends <strong>twice per week</strong> on consistent days. Cancellations or changes must be requested at least <strong>${CANCEL_NOTICE_DAYS} days</strong> before the class day — otherwise please contact the centre directly.
      </p>
      <hr/>
      <div style="font-size:13px;color:var(--text2)">
        <div class="row"><span class="row-label">Early Learner (Age 3–9)</span><span class="row-val">30 min · max ${MAX_EARLY} per slot</span></div>
        <div class="row"><span class="row-label">Main class (Age 10+)</span><span class="row-val">45 min · max ${MAX_STD} per slot</span></div>
      </div>
    </div>`;
}

function renderDayPicker(which) {
  const bf = S.bookFlow;
  const taken = which===2 ? bf.day1 : null;
  return `
    <p class="muted" style="margin-bottom:10px">Select <strong>day ${which}</strong> of 2 for ${bf.student.firstName}:</p>
    ${Object.keys(SCHEDULE).map(d=>`
      <button class="day-btn ${bf['day'+which]===d?'sel':''}" ${d===taken?'disabled':''} onclick="pickDay(${which},'${d}')">
        <span>${d}</span>
        <span class="day-badge">${d==='Saturday'?'9 AM – 12 PM':'2:30 – 6 PM'}</span>
      </button>`).join('')}
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn" onclick="bfBack()"><i class="ti ti-arrow-left"></i> Back</button>
      <button class="btn btn-primary" ${bf['day'+which]?'':'disabled'} onclick="bfNext()">Next <i class="ti ti-arrow-right"></i></button>
    </div>`;
}

function renderSlotPicker(which) {
  const bf = S.bookFlow;
  const day = bf['day'+which];
  const lvl = bf.student.level;
  const capKey = isEarly(lvl) ? 'early' : 'std';
  return `
    <p class="muted" style="margin-bottom:6px">Choose a time on <strong>${day}</strong>:</p>
    <div class="slot-grid">
      ${availHours(day, lvl).map(h => {
        const used = (S.cap[day]&&S.cap[day][h]) ? S.cap[day][h][capKey] : 0;
        const avail = slotMax(lvl) - used;
        const full = avail <= 0;
        const sel  = bf['slot'+which]===h;
        return `<div class="slot ${full?'full':''} ${sel?'sel':''}" ${full?'':('onclick="pickSlot('+which+',\''+h+'\')"')}>
          <div class="slot-t">${fmtTime(h, day)}</div>
          <div class="slot-a">${full?'Full':''+avail+' spot'+(avail!==1?'s':'')+' left'}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn" onclick="bfBack()"><i class="ti ti-arrow-left"></i> Back</button>
      <button class="btn btn-primary" ${bf['slot'+which]?'':'disabled'} onclick="bfNext()">Next <i class="ti ti-arrow-right"></i></button>
    </div>`;
}

function renderReview() {
  const bf = S.bookFlow;
  return `
    <div class="alert alert-info"><i class="ti ti-check"></i> Review your selection before confirming.</div>
    <div class="row"><span class="row-label">Student</span><span class="row-val">${bf.student.firstName} ${bf.student.lastName}</span></div>
    <div class="row"><span class="row-label">Subject</span><span class="row-val">${bf.student.subject}</span></div>
    <div class="row"><span class="row-label">Class type</span><span class="row-val">${classLabel(bf.student.level)}</span></div>
    <div class="row"><span class="row-label">Session length</span><span class="row-val">${slotDur(bf.student.level)} minutes</span></div>
    <div class="row"><span class="row-label">Day 1</span><span class="row-val">${bf.day1} at ${fmtTime(bf.slot1, bf.day1)}</span></div>
    <div class="row"><span class="row-label">Day 2</span><span class="row-val">${bf.day2} at ${fmtTime(bf.slot2, bf.day2)}</span></div>
    <div class="row"><span class="row-label">Frequency</span><span class="row-val">Weekly (recurring)</span></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn" onclick="bfBack()"><i class="ti ti-arrow-left"></i> Back</button>
      <button class="btn btn-primary" onclick="confirmBooking()"><i class="ti ti-check"></i> Confirm booking</button>
    </div>`;
}

/* ── Actions ── */
function showMsg(txt, type='alert-err') {
  const el = document.getElementById('msg');
  if (el) el.innerHTML = `<div class="alert ${type}" style="margin-top:10px"><i class="ti ti-${type==='alert-err'?'alert-triangle':'check'}"></i> ${txt}</div>`;
}

function handleLogin() {
  const em = (document.getElementById('em').value||'').trim().toLowerCase();
  if (!em || !em.includes('@') || !em.includes('.')) { showMsg('Please enter a valid email address.'); return; }
  const existing = LS.get('kum_user:'+em);
  if (existing) { S.user = existing; go({view:'dashboard', tab:'bookings'}); }
  else { go({view:'register', pendingEmail:em}); }
}

function handleRegister() {
  const fn = (document.getElementById('fn').value||'').trim();
  const ln = (document.getElementById('ln').value||'').trim();
  const ph = (document.getElementById('ph').value||'').trim();
  if (!fn||!ln) { showMsg('Please enter your first and last name.'); return; }
  const user = { firstName:fn, lastName:ln, phone:ph, email:S.pendingEmail, students:[], createdAt:Date.now() };
  LS.set('kum_user:'+S.pendingEmail, user);
  S.user = user;
  go({view:'dashboard', tab:'students'});
}

function signOut() { S.user=null; go({view:'login'}); }

function handleAddStudent() {
  const fn   = (document.getElementById('sfn').value||'').trim();
  const ln   = (document.getElementById('sln').value||'').trim();
  const lvl  = document.getElementById('slvl').value;
  const subj = document.getElementById('ssubj').value;
  if (!fn||!ln||!lvl) { showMsg('Please fill in all fields.'); return; }
  const st = { id:uid(), firstName:fn, lastName:ln, level:lvl, subject:subj, bookings:[] };
  S.user.students.push(st);
  LS.set('kum_user:'+S.user.email, S.user);
  go({view:'dashboard', tab:'students'});
}

function doRemoveStudent(id) {
  const st = S.user.students.find(s=>s.id===id);
  if (st) {
    const capKey = isEarly(st.level)?'early':'std';
    (st.bookings||[]).forEach(b => {
      if (S.cap[b.day]&&S.cap[b.day][b.time]) S.cap[b.day][b.time][capKey] = Math.max(0, S.cap[b.day][b.time][capKey]-1);
    });
    LS.set('kum_cap', S.cap);
  }
  S.user.students = S.user.students.filter(s=>s.id!==id);
  LS.set('kum_user:'+S.user.email, S.user);
  S.confirmRemove = null;
  go({view:'dashboard', tab:'students'});
}

function startBooking(sid) {
  const st = S.user.students.find(s=>s.id===sid);
  if (!st) return;
  if ((st.bookings||[]).length >= 2) { alert('This student already has 2 sessions booked. Please cancel one first.'); return; }
  S.bookFlow = { student:st, step:1, day1:null, slot1:null, day2:null, slot2:null };
  go({view:'bookSlots'});
}

function pickDay(which, day) { S.bookFlow['day'+which]=day; render(); }
function pickSlot(which, h)  { S.bookFlow['slot'+which]=h;  render(); }

function bfNext() {
  const s = S.bookFlow.step;
  if (s===1 && !S.bookFlow.day1)  return;
  if (s===2 && !S.bookFlow.slot1) return;
  if (s===3 && !S.bookFlow.day2)  return;
  if (s===4 && !S.bookFlow.slot2) return;
  S.bookFlow.step = Math.min(5, s+1);
  render();
}
function bfBack() {
  if (S.bookFlow.step <= 1) { go({view:'dashboard',tab:'students'}); return; }
  S.bookFlow.step--;
  render();
}

function confirmBooking() {
  const bf = S.bookFlow;
  const st = S.user.students.find(s=>s.id===bf.student.id);
  const capKey = isEarly(st.level)?'early':'std';
  const id = uid();
  st.bookings = st.bookings||[];
  st.bookings.push(
    {id:id+'a', day:bf.day1, time:bf.slot1, subject:st.subject, level:st.level},
    {id:id+'b', day:bf.day2, time:bf.slot2, subject:st.subject, level:st.level}
  );
  if (!S.cap[bf.day1]) S.cap[bf.day1]={};
  if (!S.cap[bf.day1][bf.slot1]) S.cap[bf.day1][bf.slot1]={early:0,std:0};
  if (!S.cap[bf.day2]) S.cap[bf.day2]={};
  if (!S.cap[bf.day2][bf.slot2]) S.cap[bf.day2][bf.slot2]={early:0,std:0};
  S.cap[bf.day1][bf.slot1][capKey]++;
  S.cap[bf.day2][bf.slot2][capKey]++;
  LS.set('kum_cap', S.cap);
  LS.set('kum_user:'+S.user.email, S.user);
  S.lastBookedStudentId = bf.student.id;
  S.lastBookedIds = [id+'a', id+'b'];
  go({view:'bookingSuccess'});
}

function startCancel(sid, bid) {
  const st = S.user.students.find(s=>s.id===sid);
  const b  = st.bookings.find(x=>x.id===bid);
  S.cancelTarget = {...b, studentName:st.firstName+' '+st.lastName, studentId:sid};
  go({view:'cancelConfirm'});
}

function doCancelDate(isoDate) {
  const b  = S.cancelTarget;
  const st = S.user.students.find(s=>s.id===b.studentId);
  const booking = st.bookings.find(x=>x.id===b.id);
  if (!booking.cancelledDates) booking.cancelledDates = [];
  if (!booking.cancelledDates.includes(isoDate)) {
    booking.cancelledDates.push(isoDate);
  }
  // Update cancelTarget so the screen refreshes with the new state
  S.cancelTarget = {...booking, studentName:st.firstName+' '+st.lastName, studentId:st.id};
  LS.set('kum_user:'+S.user.email, S.user);
  // Auto-download updated ICS so calendar reflects the cancellation
  const updatedICS = generateICS([booking], st.firstName+' '+st.lastName, st.subject, slotDur(st.level));
  downloadICS(updatedICS, 'kumon-'+st.firstName.toLowerCase()+'-updated.ics');
  render();
}

function doCancel() {
  // Full permanent cancel (removes the recurring slot entirely)
  const b  = S.cancelTarget;
  const st = S.user.students.find(s=>s.id===b.studentId);
  const capKey = isEarly(b.level)?'early':'std';
  if (S.cap[b.day]&&S.cap[b.day][b.time]) S.cap[b.day][b.time][capKey]=Math.max(0, S.cap[b.day][b.time][capKey]-1);
  st.bookings = st.bookings.filter(x=>x.id!==b.id);
  LS.set('kum_cap', S.cap);
  LS.set('kum_user:'+S.user.email, S.user);
  go({view:'dashboard', tab:'bookings'});
}


/* ── Admin helpers ── */
function getAllParents() {
  const parents = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('kum_user:')) {
      const u = LS.get(key);
      if (u) parents.push(u);
    }
  }
  return parents;
}

function getAllBookings() {
  const all = [];
  getAllParents().forEach(u => {
    (u.students||[]).forEach(st => {
      (st.bookings||[]).forEach(b => {
        all.push({
          ...b,
          studentName: st.firstName + ' ' + st.lastName,
          parentName:  u.firstName + ' ' + u.lastName,
          parentEmail: u.email,
          parentPhone: u.phone||'—',
          classType:   classLabel(b.level)
        });
      });
    });
  });
  all.sort((a,b) => (DAY_ORDER[a.day]||0)-(DAY_ORDER[b.day]||0) || a.time.localeCompare(b.time));
  return all;
}

function handleAdminLogin() {
  const pw = (document.getElementById('apw').value||'').trim();
  if (pw === ADMIN_PASSWORD) {
    go({view:'admin', adminTab:'overview'});
  } else {
    showMsg('Incorrect password. Please try again.');
  }
}

function renderAdminOverview(allBookings, allParents) {
  const earlyCount = allBookings.filter(b=>isEarly(b.level)).length;
  const mainCount  = allBookings.filter(b=>!isEarly(b.level)).length;
  const dayTotals  = {};
  Object.keys(SCHEDULE).forEach(d => { dayTotals[d] = allBookings.filter(b=>b.day===d).length; });
  return `
    <div class="stats-grid" style="margin-bottom:0">
      <div class="stat-card"><div class="stat-num">${allBookings.length}</div><div class="stat-label">Total bookings</div></div>
      <div class="stat-card"><div class="stat-num">${allParents.length}</div><div class="stat-label">Registered families</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--green)">${earlyCount}</div><div class="stat-label">Early Learner</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--teal)">${mainCount}</div><div class="stat-label">Main class</div></div>
    <div class="stat-card" style="grid-column:span 2;display:none"></div>
    </div>
    <div class="card" style="margin-top:0">
      <div class="card-hd"><i class="ti ti-calendar-week"></i> Bookings per day</div>
      ${Object.keys(SCHEDULE).map(d => {
        const count = dayTotals[d]||0;
        const totalSlots = SCHEDULE[d].hours.length;
        const pct = Math.round((count / (totalSlots * (MAX_EARLY + MAX_STD))) * 100);
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
            <span style="font-weight:500">${d}</span>
            <span style="color:var(--text2)">${count} student${count!==1?'s':''}</span>
          </div>
          <div style="height:6px;background:var(--bg2);border-radius:3px">
            <div style="height:6px;background:var(--blue-mid);border-radius:3px;width:${Math.min(pct,100)}%"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function renderAdminBookings(allBookings) {
  if (!allBookings.length) return `
    <div class="card empty-state">
      <div class="empty-icon"><i class="ti ti-calendar-off"></i></div>
      <h3>No bookings yet</h3>
      <p>Bookings will appear here once parents start registering.</p>
    </div>`;
  const byDay = {};
  Object.keys(SCHEDULE).forEach(d => { byDay[d] = allBookings.filter(b=>b.day===d); });
  return Object.keys(SCHEDULE).map(d => {
    if (!byDay[d].length) return '';
    return `<div class="card">
      <div class="card-hd"><i class="ti ti-calendar-event"></i> ${d}
        <span class="pill pill-blue" style="margin-left:auto;font-size:11px">${byDay[d].length} booking${byDay[d].length!==1?'s':''}</span>
      </div>
      ${byDay[d].map(b=>`
        <div class="row" style="align-items:flex-start">
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${fmtTime(b.time, b.day)} · ${b.studentName}</div>
            <div style="font-size:12px;color:var(--text2);margin-top:2px">${b.subject} · <span class="pill ${isEarly(b.level)?'pill-green':'pill-blue'}">${b.classType}</span></div>
            <div style="font-size:12px;color:var(--text2);margin-top:3px"><i class="ti ti-user" style="font-size:11px"></i> ${b.parentName} · ${b.parentEmail}</div>
          </div>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function renderAdminSlots() {
  return Object.keys(SCHEDULE).map(day => {
    const earlyHours = availHours(day, 'early');
    const mainHours  = availHours(day, 'main');
    const hours = allPossibleSlots(day).filter(h =>
      earlyHours.includes(h) || mainHours.includes(h)
    ).sort();
    return `<div class="card">
      <div class="card-hd"><i class="ti ti-table"></i> ${day}
        <span style="font-size:12px;color:var(--text2);font-weight:400;margin-left:4px">${day==='Saturday'?'9 AM – 12 PM':'2:30 – 6 PM'}</span>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed">
          <thead>
            <tr style="border-bottom:0.5px solid var(--border)">
              <th style="text-align:left;padding:7px 6px;color:var(--text2);font-weight:600;width:70px">Time</th>
              <th style="text-align:center;padding:7px 6px;color:var(--green-text);font-weight:600">Early Learner<br/><span style="font-weight:400;font-size:11px">max ${MAX_EARLY}</span></th>
              <th style="text-align:center;padding:7px 6px;color:var(--blue-text);font-weight:600">Main class<br/><span style="font-weight:400;font-size:11px">max ${MAX_STD}</span></th>
            </tr>
          </thead>
          <tbody>
            ${hours.map(h => {
              const cap = (S.cap[day]&&S.cap[day][h]) ? S.cap[day][h] : {early:0,std:0};
              const earlyLeft = MAX_EARLY - cap.early;
              const stdLeft   = MAX_STD   - cap.std;
              const earlyPct  = Math.round((cap.early/MAX_EARLY)*100);
              const stdPct    = Math.round((cap.std/MAX_STD)*100);
              const earlyColor = cap.early===0?'var(--text3)':cap.early>=MAX_EARLY?'var(--red-text)':'var(--green-text)';
              const stdColor   = cap.std===0?'var(--text3)':cap.std>=MAX_STD?'var(--red-text)':'var(--blue-text)';
              return `<tr style="border-bottom:0.5px solid var(--border)">
                <td style="padding:8px 6px;font-weight:600;font-size:13px;color:var(--text)">${fmtTime(h,day)}</td>
                <td style="padding:8px 6px;text-align:center">
                  <div style="font-weight:700;font-size:15px;color:${earlyColor}">${cap.early}/${MAX_EARLY}</div>
                  <div style="height:4px;background:var(--bg2);border-radius:2px;margin-top:4px">
                    <div style="height:4px;background:${cap.early>=MAX_EARLY?'var(--red-text)':'var(--green-text)'};border-radius:2px;width:${earlyPct}%"></div>
                  </div>
                  <div style="font-size:11px;color:var(--text2);margin-top:2px">${earlyLeft} left</div>
                </td>
                <td style="padding:8px 6px;text-align:center">
                  <div style="font-weight:700;font-size:15px;color:${stdColor}">${cap.std}/${MAX_STD}</div>
                  <div style="height:4px;background:var(--bg2);border-radius:2px;margin-top:4px">
                    <div style="height:4px;background:${cap.std>=MAX_STD?'var(--red-text)':'var(--blue-mid)'};border-radius:2px;width:${stdPct}%"></div>
                  </div>
                  <div style="font-size:11px;color:var(--text2);margin-top:2px">${stdLeft} left</div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

function renderAdminFamilies(allParents) {
  if (!allParents.length) return `
    <div class="card empty-state">
      <div class="empty-icon"><i class="ti ti-users"></i></div>
      <h3>No families yet</h3>
      <p>Registered families will appear here.</p>
    </div>`;
  return `<div class="card">
    <div class="card-hd"><i class="ti ti-users"></i> Registered families <span class="pill pill-blue" style="margin-left:auto">${allParents.length}</span></div>
    ${allParents.map(u => {
      const students = u.students||[];
      const totalBookings = students.reduce((n,st)=>n+(st.bookings||[]).length,0);
      return `<div class="student-row">
        <div class="avatar">${initials(u.firstName+' '+u.lastName)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">${u.firstName} ${u.lastName}</div>
          <div style="font-size:12px;color:var(--text2)">${u.email} · ${u.phone||'no phone'}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${students.length} student${students.length!==1?'s':''} · ${totalBookings} active booking${totalBookings!==1?'s':''}</div>
          <div style="margin-top:5px">${students.map(st=>`<span class="chip"><i class="ti ti-user" style="font-size:11px"></i>${st.firstName} · ${classLabel(st.level)}</span>`).join('')}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ── Calendar (ICS) helpers ── */

function dayNameToICSDay(day) {
  return {Monday:'MO',Tuesday:'TU',Wednesday:'WE',Thursday:'TH',Friday:'FR',Saturday:'SA',Sunday:'SU'}[day];
}

// Convert "2:30" + suffix "PM" -> "143000" (HHMMSS in UTC-like local)
function timeToICS(h, suffix) {
  let [hr, mn] = h.split(':').map(Number);
  if (suffix === 'PM' && hr !== 12) hr += 12;
  if (suffix === 'AM' && hr === 12) hr = 0;
  return String(hr).padStart(2,'0') + String(mn).padStart(2,'0') + '00';
}

// Format a Date as YYYYMMDD
function dateToICS(d) {
  return d.toISOString().slice(0,10).replace(/-/g,'');
}

// Add minutes to a HHMMSS string, returns HHMMSS
function addMinsToICSTime(icsTime, mins) {
  const hr = parseInt(icsTime.slice(0,2));
  const mn = parseInt(icsTime.slice(2,4));
  const total = hr*60 + mn + mins;
  return String(Math.floor(total/60)).padStart(2,'0') + String(total%60).padStart(2,'0') + '00';
}

function generateICS(bookings, studentName, subject, duration) {
  const now = new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  let cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kumon Brookswood//Booking Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kumon Brookswood — '+studentName,
    'X-WR-TIMEZONE:America/Vancouver'
  ];

  bookings.forEach(b => {
    const suffix = SCHEDULE[b.day] ? SCHEDULE[b.day].suffix : 'PM';
    const startTime = timeToICS(b.time, suffix);
    const endTime   = addMinsToICSTime(startTime, duration);
    const firstDate = nextOccurrence(b.day);
    const dtStart   = dateToICS(firstDate) + 'T' + startTime;
    const dtEnd     = dateToICS(firstDate) + 'T' + endTime;
    const byday     = dayNameToICSDay(b.day);
    const uid_str   = b.id + '@kumonbrookswood';

    // Build EXDATE list for cancelled dates
    let exdates = '';
    if ((b.cancelledDates||[]).length) {
      const exList = b.cancelledDates.map(iso => {
        return iso.replace(/-/g,'') + 'T' + startTime;
      }).join(',');
      exdates = 'EXDATE;TZID=America/Vancouver:' + exList + '
';
    }

    cal.push(
      'BEGIN:VEVENT',
      'UID:' + uid_str,
      'DTSTAMP:' + now,
      'DTSTART;TZID=America/Vancouver:' + dtStart,
      'DTEND;TZID=America/Vancouver:' + dtEnd,
      'RRULE:FREQ=WEEKLY;BYDAY=' + byday,
      exdates.trim() ? exdates.trim() : null,
      'SUMMARY:Kumon ' + subject + ' — ' + studentName,
      'DESCRIPTION:Kumon Brookswood Centre\n' + subject + ' (' + classLabel(b.level) + ')\n' + duration + ' min session',
      'LOCATION:4043 200 St\, Langley\, BC V3A 1K8',
      'COLOR:CORNFLOWERBLUE',
      'END:VEVENT'
    ).filter(Boolean);
  });

  cal.push('END:VCALENDAR');
  return cal.join('
');
}

function downloadICS(icsContent, filename) {
  const blob = new Blob([icsContent], {type: 'text/calendar;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function addBookingToCalendar(studentId, bookingIds) {
  const st = S.user.students.find(s=>s.id===studentId);
  if (!st) return;
  const bookings = bookingIds
    ? st.bookings.filter(b => bookingIds.includes(b.id))
    : st.bookings;
  if (!bookings.length) return;
  const ics = generateICS(bookings, st.firstName+' '+st.lastName, st.subject, slotDur(st.level));
  downloadICS(ics, 'kumon-'+st.firstName.toLowerCase()+'-sessions.ics');
}

function addAllToCalendar() {
  const allBookings = [];
  const allInfo = [];
  (S.user.students||[]).forEach(st => {
    (st.bookings||[]).forEach(b => {
      allBookings.push(b);
      allInfo.push({st, b});
    });
  });
  if (!allBookings.length) return;
  // Group by student since duration may differ
  const byStudent = {};
  allInfo.forEach(({st,b}) => {
    if (!byStudent[st.id]) byStudent[st.id] = {st, bookings:[]};
    byStudent[st.id].bookings.push(b);
  });
  // Merge all into one ICS
  let combined = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kumon Brookswood//Booking Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kumon Brookswood Sessions'
  ];
  Object.values(byStudent).forEach(({st, bookings}) => {
    const suffix = (day) => SCHEDULE[day]?.suffix || 'PM';
    const dur = slotDur(st.level);
    const now = new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    bookings.forEach(b => {
      const startTime = timeToICS(b.time, suffix(b.day));
      const endTime   = addMinsToICSTime(startTime, dur);
      const firstDate = nextOccurrence(b.day);
      const dtStart   = dateToICS(firstDate) + 'T' + startTime;
      const dtEnd     = dateToICS(firstDate) + 'T' + endTime;
      let exdates = '';
      if ((b.cancelledDates||[]).length) {
        exdates = 'EXDATE;TZID=America/Vancouver:' + b.cancelledDates.map(iso=>iso.replace(/-/g,'')+'T'+startTime).join(',');
      }
      combined.push(
        'BEGIN:VEVENT',
        'UID:'+b.id+'@kumonbrookswood',
        'DTSTAMP:'+now,
        'DTSTART;TZID=America/Vancouver:'+dtStart,
        'DTEND;TZID=America/Vancouver:'+dtEnd,
        'RRULE:FREQ=WEEKLY;BYDAY='+dayNameToICSDay(b.day),
        ...(exdates ? [exdates] : []),
        'SUMMARY:Kumon '+st.subject+' — '+st.firstName,
        'DESCRIPTION:Kumon Brookswood Centre\n'+st.subject+' ('+classLabel(b.level)+')\n'+dur+' min session',
        'LOCATION:4043 200 St\, Langley\, BC V3A 1K8',
        'END:VEVENT'
      );
    });
  });
  combined.push('END:VCALENDAR');
  downloadICS(combined.join('
'), 'kumon-all-sessions.ics');
}

/* ── Event wiring ── */
function attachEvents() {
  const em = document.getElementById('em');
  if (em) em.addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
  const fn = document.getElementById('fn');
  if (fn) fn.focus();
}

/* ── Boot ── */
render();