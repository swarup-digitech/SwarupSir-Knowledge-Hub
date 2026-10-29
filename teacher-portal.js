/* ============================================================================
   V24 — Admin + Teacher accounts  (V26: teachers add students, take fees;
         Roll No prefix per teacher; question bank limited to own subjects)
   ----------------------------------------------------------------------------
   Loaded by main.html after teacher-app.js.

   * Admin (the original teacher account, profiles.is_admin = true):
       the usual dashboard, plus a "Teachers" card: create teacher accounts,
       give them groups and subjects, approve their questions and release
       mock test results they ask for.
   * Teacher (is_admin = false): a clean dashboard with six tabs —
       Home · Students · Question Bank · Assign & Test · Results · Fees.
       The existing tools (new assignment, mock tests, question papers,
       results, OMR) open from these tabs and only see the teacher's groups.

   Needs V24_TEACHER_ACCOUNTS.sql and the manage-teachers Edge Function.
   Without the SQL every teacher works exactly as before.
   ========================================================================== */

const V24 = {
  scope: null, limited: false, adminIds: [], wrapped: false, basics: false,
  tab: 'home', bank: 'central', work: 'assign', adminTab: 'teachers',
  classes: [], allSubjects: [], mySubjects: [], lessons: [],
  students: null, fees: null, mine: [], mineFilter: 'all', selected: new Set(),
  central: { rows: [], count: 0, page: 0 }, admin: { classes: [], subjects: [], teachers: [] }
};
const V24_TEACHER_FN = 'manage-teachers';
const V24_PARTS = [
  ['MAT_PATTERN', 'MAT'], ['EVS_MCQ', 'EVS MCQ'], ['EVS_PASSAGE', 'EVS passage'],
  ['ARITHMETIC', 'Arithmetic'], ['LANGUAGE_PASSAGE', 'Language passage']
];

/* ---------------------------------------------------------------- helpers */
function v24Css() {
  if (document.getElementById('v24css')) return;
  const s = document.createElement('style');
  s.id = 'v24css';
  s.textContent = `
  .v24{max-width:1200px;margin:0 auto;color:#0f172a}
  .v24-top{background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:18px}
  .v24-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px}
  .v24-brand{display:flex;align-items:center;gap:12px}
  .v24-logo{width:40px;height:40px;border-radius:10px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
  .v24-who{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .v24-who-text{text-align:right;font-size:13px;color:#475569}
  .v24-who-text b{display:block;color:#0f172a;font-size:14px}
  .v24-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:0 10px;border-top:1px solid #f1f5f9}
  .v24 button.v24-tab{height:48px;padding:0 14px;border:0;border-bottom:3px solid transparent;border-radius:0;background:transparent;color:#475569;font-weight:500;font-size:14px;margin:0;box-shadow:none}
  .v24 button.v24-tab[aria-selected="true"]{border-bottom-color:#2563eb;color:#1d4ed8;font-weight:600}
  .v24-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px;margin:2px 0 14px}
  .v24-head h2{margin:0;font-size:21px}
  .v24-head p{margin:4px 0 0;color:#475569;font-size:14px}
  .v24-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:18px}
  .v24-stat{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px}
  .v24-stat .n{font-size:28px;font-weight:700;margin-top:4px}
  .v24-stat .l,.v24-stat .s{font-size:13px;color:#475569}
  .v24-cols{display:flex;flex-wrap:wrap;gap:18px}
  .v24-panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px}
  .v24-panel h3{margin:0;padding:14px 16px;font-size:16px;border-bottom:1px solid #e2e8f0}
  .v24-item{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px;border-bottom:1px solid #f1f5f9}
  .v24-item:last-child{border-bottom:0}
  .v24-item .t{font-weight:500}.v24-item .d{font-size:13px;color:#475569;margin-top:2px}
  .v24-quick{display:flex;flex-direction:column;gap:10px;padding:14px 16px}
  .v24-quick button{text-align:left;margin:0}
  .v24-seg{display:inline-flex;flex-wrap:wrap;background:#e2e8f0;border-radius:10px;padding:4px;gap:4px;margin-bottom:14px}
  .v24-seg button{background:transparent;color:#475569;border:0;border-radius:8px;height:36px;padding:0 14px;margin:0;font-weight:500;box-shadow:none}
  .v24-seg button[aria-selected="true"]{background:#fff;color:#0f172a;font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.12)}
  .v24-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:12px}
  .v24-filters label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#475569;margin:0}
  .v24-filters select,.v24-filters input{margin:0;min-width:160px}
  .v24-tw{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px}
  .v24-t{width:100%;border-collapse:collapse;font-size:14px}
  .v24-t th{text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#475569;font-weight:600;padding:10px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap;background:#f8fafc}
  .v24-t td{padding:11px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .v24-t tr:last-child td{border-bottom:0}
  .v24-t td.r{text-align:right;white-space:nowrap}
  .v24-t td.nw{white-space:nowrap}
  .v24-q{max-width:520px;max-height:6.5em;overflow:hidden}
  .v24-chip{display:inline-block;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap}
  .v24-private,.v24-none{color:#334155;background:#f1f5f9}
  .v24-pending,.v24-part{color:#92400e;background:#fef3c7}
  .v24-returned,.v24-due{color:#9a3412;background:#ffedd5}
  .v24-approved,.v24-paid,.v24-ok{color:#166534;background:#dcfce7}
  .v24-info{color:#1d4ed8;background:#eff6ff}
  .v24-off{color:#991b1b;background:#fee2e2}
  button.v24-chipbtn{border:0;cursor:pointer;margin:0 6px 6px 0}
  button.v24-chipbtn[aria-pressed="true"]{outline:2px solid #2563eb}
  .v24 button.v24-sm,.v24-admin button.v24-sm{padding:6px 11px;font-size:13px;margin:2px}
  .v24-empty{padding:26px 16px;text-align:center;color:#475569}
  .v24-lock{display:flex;gap:10px;align-items:center;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:11px 14px;margin-bottom:14px;color:#334155;font-size:14px}
  .v24-modal-back{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:36px 12px;z-index:3000;overflow:auto}
  .v24-modal{background:#fff;border-radius:14px;max-width:760px;width:100%;padding:20px;box-shadow:0 10px 40px rgba(15,23,42,.25)}
  .v24-modal h3{margin:0 0 12px}
  .v24-opt{display:flex;gap:8px;padding:6px 8px;border-radius:8px}
  .v24-opt.ok{background:#dcfce7}
  .v24-passage{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:8px 0;white-space:pre-wrap;line-height:1.5}
  .v24-check{display:flex;gap:8px;align-items:center;margin:4px 0;font-size:14px}
  .v24-check input{width:auto;margin:0}
  .v24-group-box{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:8px 0}
  .v24-admin-card{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
  .v24-badge{display:inline-block;min-width:20px;padding:1px 7px;border-radius:999px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;margin-left:4px}
  .v24-review{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin:12px 0;background:#fff}
  @media (max-width:640px){.v24-who-text{text-align:left}.v24-filters select,.v24-filters input{min-width:0;width:100%}.v24-filters label{flex:1 1 140px}}
  `;
  document.head.appendChild(s);
}
const v24e = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
function v24Chip(kind, text) { return `<span class="v24-chip v24-${kind}">${v24e(text)}</span>`; }
function v24Math(t) { const x = String(t ?? ''); if (!x.trim()) return ''; return typeof jnvstMathPreview === 'function' ? jnvstMathPreview(x) : v24e(x); }
function v24Typeset(el) { try { if (!el) return; if (typeof jnvstTypesetWhenReady === 'function') jnvstTypesetWhenReady([el]); else if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([el]).catch(() => {}); } catch (_) {} }
function v24Date(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function v24Money(n) { return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
function v24Err(e) { return e?.message || String(e); }
async function v24Rpc(name, args) { const { data, error } = await sb.rpc(name, args || {}); if (error) throw error; return data; }
async function v24CallFn(fn, body) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('Please log in again.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
    body: JSON.stringify(body)
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error || (res.status === 404 ? 'The manage-teachers Edge Function is not deployed yet.' : 'Request failed.'));
  return j;
}
function v24Modal(html) {
  v24CloseModal();
  const back = document.createElement('div');
  back.className = 'v24-modal-back'; back.id = 'v24ModalBack';
  back.innerHTML = `<div class="v24-modal" role="dialog" aria-modal="true">${html}</div>`;
  back.addEventListener('click', e => { if (e.target === back) v24CloseModal(); });
  document.body.appendChild(back);
  v24Typeset(back);
  return back;
}
function v24CloseModal() { document.getElementById('v24ModalBack')?.remove(); }
function v24QuestionHtml(q, showAnswer = true) {
  const opts = ['A', 'B', 'C', 'D'].map(k => {
    const v = q['option_' + k.toLowerCase()];
    if (v == null || v === '') return '';
    const ok = showAnswer && String(q.correct_option || '').toUpperCase() === k;
    return `<div class="v24-opt${ok ? ' ok' : ''}"><b>(${k})</b><span>${v24Math(v)}</span>${ok ? ' <b>✓</b>' : ''}</div>`;
  }).join('');
  const img = q.image_url ? `<img src="${v24e(q.image_url)}" alt="Question image" style="max-width:100%;max-height:340px;border:1px solid #e2e8f0;border-radius:8px;margin:6px 0">` : '';
  const text = q.question_text && !/^\[IMAGE QUESTION/i.test(q.question_text) ? `<div style="white-space:pre-wrap;line-height:1.5">${v24Math(q.question_text)}</div>` : '';
  return img + text + `<div style="margin-top:6px">${opts}</div>`;
}
function v24PartLabel(p) { const f = V24_PARTS.find(x => x[0] === String(p || '').toUpperCase()); return f ? f[1] : (p || '—'); }

/* -------------------------------------------- who is logged in, and scope */
async function v24LoadScope(force) {
  if (V24.scope && !force) return V24.scope;
  if (!profile || profile.role !== 'teacher') { V24.scope = { is_admin: false, missing: true }; return V24.scope; }
  if (profile.is_admin === undefined) {            // V24 SQL not installed yet: nothing changes
    V24.scope = { is_admin: true, missing: true }; V24.limited = false; return V24.scope;
  }
  const { data, error } = await sb.rpc('v24_my_scope');
  if (error || !data) {
    V24.scope = { is_admin: profile.is_admin !== false, is_active: profile.is_active !== false, missing: true, admin_ids: [] };
  } else {
    V24.scope = data;
  }
  V24.limited = V24.scope.is_admin === false;
  V24.adminIds = V24.scope.admin_ids || [];
  if (V24.limited) v24WrapClient();
  return V24.scope;
}

/* Shared Admin data (groups, subjects, lessons, central questions) belongs to
   the Admin. The existing tools read it with .eq('teacher_id', <me>). For a
   teacher those reads also include the Admin's rows; the database (V24 RLS)
   still decides which rows the teacher may see. Writes are never changed. */
function v24WrapClient() {
  if (V24.wrapped || typeof sb === 'undefined' || !sb) return;
  V24.wrapped = true;
  const SHARED = new Set(['mock_question_bank', 'classes', 'jnvst_subjects', 'jnvst_subject_lessons']);
  const origFrom = sb.from.bind(sb);
  sb.from = function (table) {
    const qb = origFrom(table);
    if (!SHARED.has(table)) return qb;
    const origSelect = qb.select.bind(qb);
    qb.select = function (...args) {
      const fb = origSelect(...args);
      const origEq = fb.eq.bind(fb);
      fb.eq = function (col, val) {
        if (col === 'teacher_id' && current && String(val) === String(current.id) && V24.adminIds.length) {
          return fb.in('teacher_id', [current.id, ...V24.adminIds]);
        }
        return origEq(col, val);
      };
      return fb;
    };
    return qb;
  };
}

/* ======================================================= TEACHER PORTAL == */
async function v24PortalHome(tab, sub) {
  if (tab) V24.tab = tab;
  if (sub && V24.tab === 'bank') V24.bank = sub;
  if (sub && V24.tab === 'work') V24.work = sub;
  v24Css();
  const sc = await v24LoadScope();
  if (sc.is_active === false) {
    return render(`<div class="wrap"><div class="card login"><h2>Account disabled</h2><p class="muted">Your teacher account has been turned off by the Admin. Please contact the Admin.</p><button onclick="logout()">Log out</button></div></div>`);
  }
  render(`<div class="wrap"><div class="card"><p class="muted">Loading your dashboard…</p></div></div>`);
  try { await v24LoadBasics(); }
  catch (e) { return render(`<div class="wrap"><div class="card">${message('Could not load your groups and subjects: ' + v24Err(e))}<div class="actions"><button onclick="v24PortalHome()">Try again</button><button class="secondary" onclick="logout()">Log out</button></div></div></div>`); }

  const tabs = [['home', 'Home'], ['students', 'Students'], ['bank', 'Question Bank'], ['work', 'Assign & Test'], ['results', 'Results'], ['progress', 'Progress'], ['fees', 'Fees']];
  const groupNames = v24TopGroups().map(c => c.name).join(', ') || 'No groups yet';
  const subjNames = V24.mySubjects.map(s => s.name).join(', ') || 'No subjects yet';
  render(`<div class="wrap"><div class="v24">
    <header class="v24-top">
      <div class="v24-bar">
        <div class="v24-brand"><div class="v24-logo" aria-hidden="true">JN</div><div><b style="font-size:17px">JNVST Course</b><div class="small muted">Teacher Dashboard</div></div></div>
        <div class="v24-who">
          <div class="v24-who-text"><b>${v24e(profile?.full_name || 'Teacher')}</b>${v24e(groupNames)} · ${v24e(subjNames)}</div>
          ${v24Chip('info', 'Teacher')}
          <button class="secondary" onclick="logout()">Log out</button>
        </div>
      </div>
      <nav class="v24-tabs" role="tablist" aria-label="Dashboard sections">
        ${tabs.map(([k, l]) => `<button type="button" role="tab" class="v24-tab" id="v24tab-${k}" aria-selected="${k === V24.tab}" onclick="v24ShowTab('${k}')">${l}</button>`).join('')}
      </nav>
    </header>
    <main id="v24Main"></main>
  </div></div>`);
  v24ShowTab(V24.tab);
}

async function v24LoadBasics(force) {
  if (V24.basics && !force) return;
  const [cl, sj, ls] = await Promise.all([
    sb.from('classes').select('id,name,course,jnvst_group_type,jnvst_parent_id').eq('teacher_id', current.id).order('name'),
    sb.from('jnvst_subjects').select('*').eq('teacher_id', current.id).order('name'),
    sb.from('jnvst_subject_lessons').select('*').eq('teacher_id', current.id).order('lesson_code').order('lesson_name')
  ]);
  if (cl.error) throw cl.error; if (sj.error) throw sj.error; if (ls.error) throw ls.error;
  V24.classes = cl.data || [];
  V24.allSubjects = sj.data || [];
  const mine = new Set(V24.scope?.subject_ids || []);
  V24.mySubjects = V24.allSubjects.filter(s => mine.has(s.id));
  V24.lessons = ls.data || [];
  // The existing Add / Bulk upload screens offer these subjects and lessons.
  try { jnvstSubjects = V24.mySubjects; jnvstSubjectLessons = V24.lessons.filter(l => mine.has(l.subject_id)); } catch (_) {}
  V24.basics = true;
}
function v24TopGroups() {
  const ids = new Set(V24.classes.map(c => c.id));
  return V24.classes.filter(c => !c.jnvst_parent_id || !ids.has(c.jnvst_parent_id));
}
function v24ClassName(id) { return V24.classes.find(c => c.id === id)?.name || '—'; }
function v24SubjectName(id) { return V24.allSubjects.find(s => s.id === id)?.name || '—'; }
function v24LessonLabel(id) { const l = V24.lessons.find(x => x.id === id); return l ? `${l.lesson_code || ''} ${l.lesson_name || ''}`.trim() : '—'; }

function v24ShowTab(tab) {
  V24.tab = tab;
  document.querySelectorAll('.v24-tab').forEach(b => b.setAttribute('aria-selected', String(b.id === 'v24tab-' + tab)));
  const el = document.getElementById('v24Main');
  if (!el) return v24PortalHome(tab);
  el.innerHTML = '<div class="v24-empty">Loading…</div>';
  const run = { home: v24TabHome, students: v24TabStudents, bank: v24TabBank, work: v24TabWork, results: v24TabResults, fees: v24TabFees,
    progress: el => (typeof v27TabProgress === 'function' ? v27TabProgress(el) : (el.innerHTML = '<div class="v24-empty">Progress needs progress.js (V27).</div>')) }[tab] || v24TabHome;
  Promise.resolve(run(el)).catch(e => { el.innerHTML = message(v24Err(e)); });
}

async function v24Students(force) {
  if (V24.students && !force) return V24.students;
  V24.students = (await v24Rpc('teacher_my_students')) || [];
  return V24.students;
}
async function v24Fees(force) {
  if (V24.fees && !force) return V24.fees;
  V24.fees = new Map(((await v24Rpc('teacher_my_fees')) || []).map(f => [f.student_id, f]));
  return V24.fees;
}
function v24FeeStatus(f) {
  if (!f) return ['none', 'No record'];
  if (Number(f.due) <= 0) return ['paid', 'Paid'];
  if (Number(f.paid) > 0) return ['part', 'Part paid'];
  return ['due', 'Due'];
}

/* ---------------------------------------------------------------- Home */
async function v24TabHome(el) {
  const me = current.id;
  const [students, asg, mts, qs] = await Promise.all([
    v24Students().catch(() => []),
    sb.from('assignments').select('id', { count: 'exact', head: true }).eq('created_by', me),
    sb.from('mock_tests').select('id,title,results_released,release_requested_at,created_at').eq('teacher_id', me).order('created_at', { ascending: false }),
    sb.from('mock_question_bank').select('id,approval_status,review_note,question_text,passage_title').eq('author_id', me)
  ]);
  const tests = mts.data || [];
  const qrows = qs.data || [];
  const cnt = s => qrows.filter(q => q.approval_status === s).length;
  const notReleased = tests.filter(t => !t.results_released);
  let submitted = new Map();
  if (notReleased.length) {
    const { data: at } = await sb.from('mock_test_attempts').select('mock_test_id').in('mock_test_id', notReleased.map(t => t.id)).eq('status', 'submitted');
    (at || []).forEach(a => submitted.set(a.mock_test_id, (submitted.get(a.mock_test_id) || 0) + 1));
  }
  const groups = v24TopGroups();
  const byGroup = groups.map(g => `${g.name} ${students.filter(s => s.class_id === g.id || V24.classes.find(c => c.id === s.class_id)?.jnvst_parent_id === g.id).length}`).join(' · ');

  const todo = [];
  const returned = qrows.filter(q => q.approval_status === 'returned');
  if (returned.length) todo.push({ t: `${returned.length} question${returned.length === 1 ? '' : 's'} returned by Admin`, d: returned[0].review_note ? `“${returned[0].review_note}”` : 'Fix and send again.', b: `<button class="secondary v24-sm" onclick="v24PortalGo('bank','mine','returned')">Open</button>` });
  notReleased.forEach(t => {
    const n = submitted.get(t.id) || 0;
    if (t.release_requested_at) todo.push({ t: t.title, d: `Release requested ${v24Date(t.release_requested_at)}. Waiting for Admin.`, b: v24Chip('pending', 'Waiting') });
    else if (n) todo.push({ t: t.title, d: `${n} student${n === 1 ? '' : 's'} submitted. Results reach students after Admin releases them.`, b: `<button class="v24-sm" onclick="v24RequestRelease('${t.id}')">Request release</button>` });
  });
  try {
    const fr = (await v24Rpc('teacher_fee_change_requests')) || [];
    const back = fr.filter(r => r.status === 'rejected' && r.reviewed_at && (Date.now() - new Date(r.reviewed_at)) < 14 * 864e5);
    if (back.length) todo.push({ t: `${back.length} fee change${back.length === 1 ? '' : 's'} not approved`, d: back[0].review_note ? `“${back[0].review_note}”` : 'See the Fees tab.', b: `<button class="secondary v24-sm" onclick="v24PortalGo('fees')">Open</button>` });
    const wait = fr.filter(r => r.status === 'pending').length;
    if (wait) todo.push({ t: `${wait} fee change${wait === 1 ? '' : 's'} waiting for Admin`, d: 'The fee changes when the Admin approves it.', b: v24Chip('pending', 'Waiting') });
  } catch (_) {}
  if (!V24.classes.length || !V24.mySubjects.length) todo.unshift({ t: 'Waiting for Admin', d: 'The Admin has not given you ' + (!V24.classes.length ? 'any groups' : 'any subjects') + ' yet.', b: '' });

  el.innerHTML = `
    <div class="v24-head"><div><h2>Hello, ${v24e(profile?.full_name || 'Teacher')}</h2><p>Your groups: ${v24e(groups.map(g => g.name).join(', ') || '—')} · Subjects: ${v24e(V24.mySubjects.map(s => s.name).join(', ') || '—')}</p></div></div>
    <div class="v24-stats">
      <div class="v24-stat"><div class="l">My students</div><div class="n">${students.length}</div><div class="s">${v24e(byGroup || '—')}</div></div>
      <div class="v24-stat"><div class="l">My assignments</div><div class="n">${asg.count || 0}</div><div class="s">Created by you</div></div>
      <div class="v24-stat"><div class="l">Mock tests</div><div class="n">${tests.length}</div><div class="s">${notReleased.length} without released results</div></div>
      <div class="v24-stat"><div class="l">My questions</div><div class="n">${qrows.length}</div><div class="s">${cnt('pending')} waiting · ${cnt('approved')} in central bank</div></div>
    </div>
    <div class="v24-cols">
      <section class="v24-panel" style="flex:2 1 440px;min-width:0"><h3>Needs your attention</h3>
        ${todo.length ? todo.map(x => `<div class="v24-item"><div style="min-width:0"><div class="t">${v24e(x.t)}</div><div class="d">${v24e(x.d)}</div></div>${x.b}</div>`).join('') : '<div class="v24-empty">Nothing needs your attention right now.</div>'}
      </section>
      <section class="v24-panel" style="flex:1 1 250px"><h3>Quick actions</h3>
        <div class="v24-quick">
          <button onclick="newAssignment()">+ New assignment</button>
          <button class="secondary" onclick="mockTestManagement()">Generate mock test</button>
          <button class="secondary" onclick="questionPaperGeneratorPage()">Make question paper</button>
          <button class="secondary" onclick="jnvstManualAddQuestion()">Add my question</button>
        </div>
      </section>
    </div>`;
}
function v24PortalGo(tab, sub, filter) {
  if (filter) V24.mineFilter = filter;
  if (tab === 'bank' && sub) V24.bank = sub;
  if (tab === 'work' && sub) V24.work = sub;
  v24ShowTab(tab);
}

/* ------------------------------------------------------------ Students */
async function v24TabStudents(el) {
  const [rows, fees] = await Promise.all([v24Students(true), v24Fees().catch(() => new Map())]);
  const groups = [...new Map(rows.map(r => [r.class_id, r.class_name])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const prefix = V24.scope?.roll_prefix || '';
  el.innerHTML = `
    <div class="v24-head"><div><h2>My students</h2><p>Students in your groups. ${prefix ? `Students you add get Roll Nos starting with <b>${v24e(prefix)}-</b>.` : 'To add students, the Admin must first give you a Roll No prefix.'} Moving students between groups is done by the Admin.</p></div>
      <div class="actions"><button onclick="v26AddStudentForm()"${prefix && V24.classes.length ? '' : ' disabled'}>+ Add student</button></div></div>
    <div class="v24-filters">
      <label>Group<select id="v24StuGroup" onchange="v24FilterStudents()"><option value="">All groups</option>${groups.map(([id, n]) => `<option value="${id}">${v24e(n)}</option>`).join('')}</select></label>
      <label>Search<input id="v24StuSearch" type="search" placeholder="Name or roll no." oninput="v24FilterStudents()"></label>
    </div>
    <div class="v24-tw"><table class="v24-t"><thead><tr><th>Roll no.</th><th>Name</th><th>Group</th><th>Fees</th><th></th></tr></thead><tbody id="v24StuBody"></tbody></table></div>`;
  V24._feeMap = fees;
  v24FilterStudents();
}
function v24FilterStudents() {
  const g = document.getElementById('v24StuGroup')?.value || '';
  const q = (document.getElementById('v24StuSearch')?.value || '').trim().toLowerCase();
  const list = (V24.students || []).filter(s => (!g || s.class_id === g) && (!q || String(s.full_name || '').toLowerCase().includes(q) || String(s.roll_no || '').toLowerCase().includes(q)))
    .sort((a, b) => String(a.roll_no || '').localeCompare(String(b.roll_no || ''), undefined, { numeric: true }));
  const body = document.getElementById('v24StuBody');
  if (!body) return;
  body.innerHTML = list.length ? list.map(s => {
    const [k, l] = v24FeeStatus(V24._feeMap?.get(s.id));
    return `<tr><td class="nw">${v24e(s.roll_no || '—')}</td><td><b>${v24e(s.full_name || 'Student')}</b>${s.added_by_me ? ' ' + v24Chip('info', 'Added by you') : ''}</td><td class="nw">${v24e(s.class_name || '—')}</td><td>${v24Chip(k, l)}</td>
      <td class="r"><button class="secondary v24-sm" onclick="v26FeeMenu('${s.id}')">Fees</button><button class="secondary v24-sm" onclick="v24ResetStudentPassword('${s.id}')">Reset password</button></td></tr>`;
  }).join('') : `<tr><td colspan="5" class="v24-empty">${(V24.students || []).length ? 'No student matches.' : 'No students in your groups yet.'}</td></tr>`;
}
/* V26: a teacher adds a student to one of their groups (Roll No = PREFIX-number). */
function v26GroupOptions() {
  // Sub-groups under their main group; a main group without sub-groups can be chosen itself.
  const ids = new Set(V24.classes.map(c => c.id));
  const mains = V24.classes.filter(c => !c.jnvst_parent_id || !ids.has(c.jnvst_parent_id));
  return mains.map(m => {
    const subs = V24.classes.filter(c => c.jnvst_parent_id === m.id);
    return subs.length
      ? `<optgroup label="${v24e(m.name)}">${subs.map(s => `<option value="${s.id}">${v24e(s.name)}</option>`).join('')}</optgroup>`
      : `<option value="${m.id}">${v24e(m.name)}</option>`;
  }).join('');
}
function v26AddStudentForm() {
  const prefix = V24.scope?.roll_prefix || '';
  if (!prefix) return notify('The Admin has not given you a Roll No prefix yet. Please ask the Admin.');
  v24Modal(`<h3>Add a student</h3>
    <label for="v26SName">Student name</label><input id="v26SName" autocomplete="off" placeholder="Full name">
    <label for="v26SGroup">Group</label><select id="v26SGroup">${v26GroupOptions()}</select>
    <label for="v26SRoll">Roll No</label>
    <div style="display:flex;align-items:center;gap:6px"><b style="font-size:16px">${v24e(prefix)}-</b><input id="v26SRoll" autocomplete="off" placeholder="001" maxlength="10" style="margin:0"></div>
    <p class="small muted" style="margin:4px 0 0">The student logs in with this Roll No, e.g. <b>${v24e(prefix)}-001</b>.</p>
    <label for="v26SPw">Password (at least 6 characters)</label><input id="v26SPw" autocomplete="new-password" value="${v24e(v24MakePassword().slice(0, 8))}">
    <div id="v26SMsg"></div>
    <div class="actions" style="margin-top:14px"><button id="v26SBtn" onclick="v26AddStudent()">Add student</button><button class="secondary" onclick="v24CloseModal()">Cancel</button></div>`);
  document.getElementById('v26SName')?.focus();
}
async function v26AddStudent() {
  const name = document.getElementById('v26SName').value.trim();
  const class_id = document.getElementById('v26SGroup').value;
  const roll = document.getElementById('v26SRoll').value.trim();
  const password = document.getElementById('v26SPw').value;
  const msg = document.getElementById('v26SMsg');
  if (!name || !class_id || !roll) { msg.innerHTML = message('Enter the name, group and Roll No.'); return; }
  if (!/^[A-Za-z0-9]{1,10}$/.test(roll.replace(new RegExp('^' + (V24.scope.roll_prefix || '') + '-', 'i'), ''))) { msg.innerHTML = message('Roll No: only letters and digits after the prefix, for example 001.'); return; }
  if (password.length < 6) { msg.innerHTML = message('Password must have at least 6 characters.'); return; }
  const btn = document.getElementById('v26SBtn'); btn.disabled = true;
  try {
    const j = await callTeacherFn({ action: 'createStudents', students: [{ name, roll_no: roll, password, class_id }] });
    const r = (j.results || [])[0] || {};
    if (!r.success) { msg.innerHTML = message(r.error || 'Could not add the student.'); btn.disabled = false; return; }
    v24Modal(`<h3>Student added</h3>
      <p>Give these login details to <b>${v24e(name)}</b>:</p>
      <div class="v24-group-box" style="font-size:16px">Roll No: <b>${v24e(r.roll_no)}</b><br>Password: <b>${v24e(password)}</b></div>
      <p class="small muted">The student logs in with “Student Login”. You can reset the password later from this list.</p>
      <div class="actions"><button onclick="v24CloseModal();v26AddStudentForm()">Add another</button><button class="secondary" onclick="v24CloseModal()">Done</button></div>`);
    V24.students = null; V24.fees = null;
    if (V24.tab === 'students') v24ShowTab('students');
  } catch (e) { msg.innerHTML = message(v24Err(e)); btn.disabled = false; }
}

async function v24ResetStudentPassword(id) {
  const s = (V24.students || []).find(x => x.id === id);
  const pw = prompt(`New password for ${s?.full_name || 'this student'} (at least 6 characters):`);
  if (pw == null) return;
  if (pw.length < 6) return notify('Password must have at least 6 characters.');
  try { await callTeacherFn({ action: 'setStudentPassword', student_id: id, password: pw }); notify('Password changed. Tell the student the new password.'); }
  catch (e) { notify('Could not change the password: ' + v24Err(e)); }
}

/* -------------------------------------------------------- Question Bank */
async function v24TabBank(el) {
  el.innerHTML = `
    <div class="v24-head"><div><h2>Question bank</h2><p>Central questions of your subjects (${v24e(V24.mySubjects.map(s => s.name).join(', ') || 'none yet')}). You can add questions only to these subjects; they join the central bank after the Admin approves them.</p></div>
      <div class="actions"><button class="secondary" onclick="jnvstQuestionBulkUpload()"${V24.mySubjects.length ? '' : ' disabled'}>Bulk upload</button><button onclick="jnvstManualAddQuestion()"${V24.mySubjects.length ? '' : ' disabled'}>+ Add question</button></div></div>
    <div class="v24-seg" role="tablist" aria-label="Question bank view">
      <button type="button" role="tab" aria-selected="${V24.bank === 'central'}" onclick="V24.bank='central';v24ShowTab('bank')">Central bank</button>
      <button type="button" role="tab" aria-selected="${V24.bank === 'mine'}" onclick="V24.bank='mine';v24ShowTab('bank')">My questions</button>
    </div>
    <div id="v24BankBody"></div>`;
  const body = document.getElementById('v24BankBody');
  if (V24.bank === 'mine') return v24BankMine(body);
  return v24BankCentral(body);
}

function v24BankCentral(body) {
  const vis = V24.mySubjects;   // V26: only the teacher's own subjects
  body.innerHTML = `
    <div class="v24-filters">
      <label>Subject<select id="v24CSubj" onchange="v24CentralLessons();v24LoadCentral(0)"><option value="">All my subjects</option>${vis.map(s => `<option value="${s.id}">${v24e(s.name)}</option>`).join('')}</select></label>
      <label>Lesson<select id="v24CLesson" onchange="v24LoadCentral(0)"><option value="">All lessons</option></select></label>
      <label>Type<select id="v24CPart" onchange="v24LoadCentral(0)"><option value="">All types</option>${V24_PARTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label>Search<input id="v24CSearch" type="search" placeholder="Words in the question" onkeydown="if(event.key==='Enter')v24LoadCentral(0)"></label>
      <button class="secondary" onclick="v24LoadCentral(0)">Search</button>
    </div>
    <div id="v24CentralList"><div class="v24-empty">Loading…</div></div>`;
  v24CentralLessons();
  v24LoadCentral(0);
}
function v24CentralLessons() {
  const s = document.getElementById('v24CSubj')?.value || '';
  const sel = document.getElementById('v24CLesson'); if (!sel) return;
  const ls = V24.lessons.filter(l => !s || l.subject_id === s);
  sel.innerHTML = '<option value="">All lessons</option>' + ls.map(l => `<option value="${l.id}">${v24e(`${l.lesson_code || ''} ${l.lesson_name || ''}`.trim())}</option>`).join('');
}
async function v24LoadCentral(page) {
  const box = document.getElementById('v24CentralList'); if (!box) return;
  const size = 50, from = page * size;
  const subj = document.getElementById('v24CSubj')?.value || '';
  const lesson = document.getElementById('v24CLesson')?.value || '';
  const part = document.getElementById('v24CPart')?.value || '';
  const search = (document.getElementById('v24CSearch')?.value || '').trim();
  if (!V24.adminIds.length || !V24.mySubjects.length) { box.innerHTML = '<div class="v24-empty">The Admin has not given you any subjects yet.</div>'; return; }
  if (page === 0) box.innerHTML = '<div class="v24-empty">Loading…</div>';
  let q = sb.from('mock_question_bank')
    .select('id,question_text,image_url,part_code,language,subject_id,lesson_id,passage_id,passage_title,passage_text,question_order,author_id,option_a,option_b,option_c,option_d,correct_option', { count: 'exact' })
    .eq('approval_status', 'approved').in('teacher_id', V24.adminIds).eq('active', true);
  q = subj ? q.eq('subject_id', subj) : q.in('subject_id', V24.mySubjects.map(s => s.id));
  if (lesson) q = q.eq('lesson_id', lesson);
  if (part) q = q.eq('part_code', part);
  if (search) q = q.ilike('question_text', `%${search.replace(/[%_]/g, '')}%`);
  const { data, error, count } = await q.order('created_at', { ascending: false }).range(from, from + size - 1);
  if (error) { box.innerHTML = message(error.message); return; }
  V24.central = { rows: page ? V24.central.rows.concat(data || []) : (data || []), count: count || 0, page };
  const rows = V24.central.rows;
  box.innerHTML = rows.length ? `
    <p class="small muted" style="margin:0 0 8px">${V24.central.count} question${V24.central.count === 1 ? '' : 's'}</p>
    <div class="v24-tw"><table class="v24-t"><thead><tr><th>Lesson</th><th>Question</th><th>Type</th><th>Language</th><th>Added by</th><th></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="nw">${v24e(v24LessonLabel(r.lesson_id))}</td>
      <td><div class="v24-q">${r.passage_title ? v24Chip('info', 'Passage: ' + r.passage_title) + '<br>' : ''}${r.image_url ? '🖼 ' : ''}${v24Math(String(r.question_text || '').slice(0, 300))}</div></td>
      <td class="nw">${v24e(v24PartLabel(r.part_code))}</td><td class="nw">${v24e(r.language || '—')}</td>
      <td class="nw">${r.author_id === current.id ? 'You' : (V24.adminIds.includes(r.author_id) ? 'Admin' : 'Teacher')}</td>
      <td class="r"><button class="secondary v24-sm" onclick="v24PreviewCentral(${i})">Preview</button></td></tr>`).join('')}
    </tbody></table></div>
    ${rows.length < V24.central.count ? `<div class="actions" style="justify-content:center;margin-top:12px"><button class="secondary" onclick="v24LoadCentral(${page + 1})">Show more</button></div>` : ''}`
    : '<div class="v24-empty">No questions match these filters.</div>';
  v24Typeset(box);
}
function v24PreviewCentral(i) {
  const q = V24.central.rows[i]; if (!q) return;
  v24Modal(`<h3>${v24e(v24SubjectName(q.subject_id))} · ${v24e(v24LessonLabel(q.lesson_id))}</h3>
    ${q.passage_text ? `<details open><summary><b>Passage: ${v24e(q.passage_title || '')}</b></summary><div class="v24-passage">${v24Math(q.passage_text)}</div></details>` : ''}
    ${v24QuestionHtml(q)}
    <div class="actions" style="margin-top:14px"><button onclick="v24CloseModal()">Close</button></div>`);
}

async function v24BankMine(body) {
  const { data, error } = await sb.from('mock_question_bank')
    .select('id,question_text,image_url,part_code,language,subject_id,lesson_id,passage_id,passage_title,passage_text,question_order,approval_status,review_note,submitted_at,teacher_id,option_a,option_b,option_c,option_d,correct_option,created_at')
    .eq('author_id', current.id).order('created_at', { ascending: false }).limit(1000);
  if (error) { body.innerHTML = message(error.message); return; }
  V24.mine = data || [];
  V24.selected = new Set();
  v24RenderMine(body);
}
function v24RenderMine(body) {
  body = body || document.getElementById('v24BankBody'); if (!body) return;
  const all = V24.mine;
  const statuses = [['all', 'All', 'info'], ['private', 'Private', 'private'], ['pending', 'Waiting for approval', 'pending'], ['returned', 'Returned', 'returned'], ['approved', 'In central bank', 'approved']];
  const n = s => s === 'all' ? all.length : all.filter(q => q.approval_status === s).length;
  const rows = V24.mineFilter === 'all' ? all : all.filter(q => q.approval_status === V24.mineFilter);
  const label = { private: 'Private', pending: 'Waiting for approval', returned: 'Returned', approved: 'In central bank' };
  body.innerHTML = `
    <div>${statuses.map(([k, l, c]) => `<button type="button" class="v24-chip v24-${c} v24-chipbtn" aria-pressed="${V24.mineFilter === k}" onclick="V24.mineFilter='${k}';v24RenderMine()">${l} · ${n(k)}</button>`).join('')}</div>
    <div class="actions" style="margin:6px 0 12px;align-items:center">
      <button onclick="v24SubmitSelected()">Send selected for approval</button>
      <button class="secondary" onclick="v24WithdrawSelected()">Take back selected</button>
      <button class="danger" onclick="v24DeleteSelected()">Delete selected</button>
      <span class="small muted" id="v24SelCount">0 selected</span>
    </div>
    <p class="small muted" style="margin:0 0 10px">A passage and its questions, and the language versions of one question, are always sent and reviewed together.</p>
    ${rows.length ? `<div class="v24-tw"><table class="v24-t"><thead><tr><th><input type="checkbox" aria-label="Select all shown" onchange="v24SelectAllMine(this.checked)" style="width:auto;margin:0"></th><th>Lesson</th><th>Question</th><th>Status</th><th>Admin note</th><th></th></tr></thead><tbody>
      ${rows.map(q => {
        const locked = q.approval_status === 'approved';
        return `<tr><td>${locked ? '' : `<input type="checkbox" aria-label="Select question" data-v24sel="${q.id}" onchange="v24ToggleSel('${q.id}',this.checked)" style="width:auto;margin:0">`}</td>
        <td class="nw">${v24e(v24LessonLabel(q.lesson_id))}<div class="small muted">${v24e(v24PartLabel(q.part_code))} · ${v24e(q.language || '')}</div></td>
        <td><div class="v24-q">${q.passage_title ? v24Chip('info', 'Passage: ' + q.passage_title + (q.question_order ? ' · Q' + q.question_order : '')) + '<br>' : ''}${q.image_url ? '🖼 ' : ''}${v24Math(String(q.question_text || '').slice(0, 300))}</div></td>
        <td>${v24Chip(q.approval_status, label[q.approval_status] || q.approval_status)}</td>
        <td class="small" style="max-width:220px">${v24e(q.review_note || '')}</td>
        <td class="r"><button class="secondary v24-sm" onclick="v24PreviewMine('${q.id}')">Preview</button>
          ${locked ? '' : `<button class="secondary v24-sm" onclick="v24EditMine('${q.id}')">Edit</button>`}
          ${q.approval_status === 'private' || q.approval_status === 'returned' ? `<button class="v24-sm" onclick="v24Submit(['${q.id}'])">${q.approval_status === 'returned' ? 'Send again' : 'Send for approval'}</button>` : ''}
          ${q.approval_status === 'pending' ? `<button class="secondary v24-sm" onclick="v24Withdraw(['${q.id}'])">Take back</button>` : ''}</td></tr>`;
      }).join('')}
    </tbody></table></div>` : `<div class="v24-empty">${all.length ? 'No questions with this status.' : 'You have not added any questions yet. Use “+ Add question” or “Bulk upload”.'}</div>`}`;
  v24Typeset(body);
}
function v24ToggleSel(id, on) { on ? V24.selected.add(id) : V24.selected.delete(id); const c = document.getElementById('v24SelCount'); if (c) c.textContent = V24.selected.size + ' selected'; }
function v24SelectAllMine(on) { document.querySelectorAll('[data-v24sel]').forEach(cb => { cb.checked = on; v24ToggleSel(cb.getAttribute('data-v24sel'), on); }); }
async function v24Submit(ids) {
  if (!ids.length) return notify('Select questions first.');
  try { const n = await v24Rpc('teacher_submit_questions', { p_ids: ids }); notify(n ? `${n} question${n === 1 ? '' : 's'} sent to the Admin for approval.` : 'Nothing to send. Only private or returned questions can be sent.'); }
  catch (e) { notify('Could not send: ' + v24Err(e)); }
  v24BankMine(document.getElementById('v24BankBody'));
}
async function v24Withdraw(ids) {
  if (!ids.length) return notify('Select questions first.');
  try { const n = await v24Rpc('teacher_withdraw_questions', { p_ids: ids }); notify(n ? `${n} question${n === 1 ? '' : 's'} taken back. They are private again.` : 'Only questions waiting for approval can be taken back.'); }
  catch (e) { notify('Could not take back: ' + v24Err(e)); }
  v24BankMine(document.getElementById('v24BankBody'));
}
function v24SubmitSelected() { v24Submit([...V24.selected]); }
function v24WithdrawSelected() { v24Withdraw([...V24.selected]); }
async function v24DeleteSelected() {
  const ids = [...V24.selected]; if (!ids.length) return notify('Select questions first.');
  if (!confirm(`Delete ${ids.length} question${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
  const { error } = await sb.from('mock_question_bank').delete().in('id', ids).eq('teacher_id', current.id).neq('approval_status', 'approved');
  if (error) return notify('Could not delete: ' + error.message);
  notify('Deleted.');
  v24BankMine(document.getElementById('v24BankBody'));
}
function v24PreviewMine(id) {
  const q = V24.mine.find(x => x.id === id); if (!q) return;
  v24Modal(`<h3>${v24e(v24SubjectName(q.subject_id))} · ${v24e(v24LessonLabel(q.lesson_id))}</h3>
    ${q.review_note ? `<div class="notice"><b>Admin note:</b> ${v24e(q.review_note)}</div>` : ''}
    ${q.passage_text ? `<details open><summary><b>Passage: ${v24e(q.passage_title || '')}</b></summary><div class="v24-passage">${v24Math(q.passage_text)}</div></details>` : ''}
    ${v24QuestionHtml(q)}
    <div class="actions" style="margin-top:14px"><button onclick="v24CloseModal()">Close</button></div>`);
}
function v24EditMine(id) {
  const q = V24.mine.find(x => x.id === id); if (!q) return;
  const f = (k, l) => `<label>${l}</label><input id="v24E_${k}" value="${v24e(q[k] || '')}">`;
  v24Modal(`<h3>Edit question</h3>
    ${q.review_note ? `<div class="notice"><b>Admin note:</b> ${v24e(q.review_note)}</div>` : ''}
    ${q.approval_status === 'pending' ? '<div class="notice">This question is waiting for approval. Saving a change makes it private again; send it again when ready.</div>' : ''}
    ${q.passage_id ? `<label>Passage title</label><input id="v24E_passage_title" value="${v24e(q.passage_title || '')}"><label>Passage text (changes every question of this passage)</label><textarea id="v24E_passage_text" rows="6">${v24e(q.passage_text || '')}</textarea>` : ''}
    <label>Question</label><textarea id="v24E_question_text" rows="4">${v24e(q.question_text || '')}</textarea>
    ${f('option_a', 'Option A')}${f('option_b', 'Option B')}${f('option_c', 'Option C')}${f('option_d', 'Option D')}
    <label>Correct answer</label><select id="v24E_correct_option">${['A', 'B', 'C', 'D'].map(k => `<option${q.correct_option === k ? ' selected' : ''}>${k}</option>`).join('')}</select>
    <div class="actions" style="margin-top:14px"><button onclick="v24SaveMine('${q.id}')">Save</button><button class="secondary" onclick="v24CloseModal()">Cancel</button></div>`);
}
async function v24SaveMine(id) {
  const q = V24.mine.find(x => x.id === id); if (!q) return;
  const v = k => document.getElementById('v24E_' + k)?.value ?? null;
  const upd = { question_text: v('question_text'), option_a: v('option_a'), option_b: v('option_b'), option_c: v('option_c'), option_d: v('option_d'), correct_option: v('correct_option') };
  if (!String(upd.question_text || '').trim() && !q.image_url) return notify('Question text is required.');
  const { error } = await sb.from('mock_question_bank').update(upd).eq('id', id).eq('teacher_id', current.id);
  if (error) return notify('Could not save: ' + error.message);
  if (q.passage_id && document.getElementById('v24E_passage_text')) {
    const { error: pe } = await sb.from('mock_question_bank').update({ passage_title: v('passage_title'), passage_text: v('passage_text') })
      .eq('passage_id', q.passage_id).eq('teacher_id', current.id).neq('approval_status', 'approved');
    if (pe) return notify('Question saved, but the passage could not be saved: ' + pe.message);
  }
  v24CloseModal(); notify('Saved.');
  v24BankMine(document.getElementById('v24BankBody'));
}

/* -------------------------------------------------------- Assign & Test */
async function v24TabWork(el) {
  const cta = { assign: ['+ New assignment', 'newAssignment()'], mock: ['Mock test tools', 'mockTestManagement()'], paper: ['+ New question paper', 'questionPaperGeneratorPage()'] }[V24.work];
  el.innerHTML = `
    <div class="v24-head"><div><h2>Assign &amp; test</h2><p>For your groups and subjects.</p></div><div class="actions"><button onclick="${cta[1]}">${cta[0]}</button></div></div>
    <div class="v24-seg" role="tablist" aria-label="Assign and test view">
      ${[['assign', 'Assignments'], ['mock', 'Mock tests'], ['paper', 'Question papers']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${V24.work === k}" onclick="V24.work='${k}';v24ShowTab('work')">${l}</button>`).join('')}
    </div>
    <div id="v24WorkBody"><div class="v24-empty">Loading…</div></div>`;
  const body = document.getElementById('v24WorkBody');
  if (V24.work === 'mock') return v24WorkMock(body);
  if (V24.work === 'paper') return v24WorkPapers(body);
  return v24WorkAssign(body);
}
async function v24WorkAssign(body) {
  const { data, error } = await sb.from('assignments').select('*').eq('created_by', current.id).order('created_at', { ascending: false });
  if (error) { body.innerHTML = message(error.message); return; }
  let list = (data || []).filter(a => String(a.course || '').toUpperCase() !== 'SCHOOL');
  if (!list.length) { body.innerHTML = '<div class="v24-empty">No assignments yet. Use “+ New assignment”.</div>'; return; }
  try { if (typeof normalizeJnvstAssignmentGroups === 'function') list = await normalizeJnvstAssignmentGroups(V24.classes, list) || list; } catch (_) {}
  if (typeof renderTeacherAssignmentsPanel === 'function') {
    try {
      body.innerHTML = `<div class="card" style="margin:0">${renderTeacherAssignmentsPanel(list)}</div>`;
      try { applyTeacherAssignmentView(); } catch (_) {}
      return;
    } catch (_) { /* fall back to the simple list below */ }
  }
  body.innerHTML = `<div class="v24-tw"><table class="v24-t"><thead><tr><th>Title</th><th>Group</th><th>Created</th></tr></thead><tbody>${list.map(a => `<tr><td><b>${v24e(a.title)}</b></td><td>${v24e(v24ClassName(a.class_id))}</td><td>${v24Date(a.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
}
async function v24MyTests() {
  const { data: tests, error } = await sb.from('mock_tests').select('id,title,results_released,release_requested_at,created_at').eq('teacher_id', current.id).order('created_at', { ascending: false });
  if (error) throw error;
  const ids = (tests || []).map(t => t.id);
  const stu = new Map(), sub = new Map(), pct = new Map();
  if (ids.length) {
    const [{ data: rs }, { data: at }] = await Promise.all([
      sb.from('mock_test_students').select('mock_test_id').in('mock_test_id', ids),
      sb.from('mock_test_attempts').select('mock_test_id,status,percentage').in('mock_test_id', ids)
    ]);
    (rs || []).forEach(r => stu.set(r.mock_test_id, (stu.get(r.mock_test_id) || 0) + 1));
    (at || []).filter(a => a.status === 'submitted').forEach(a => {
      sub.set(a.mock_test_id, (sub.get(a.mock_test_id) || 0) + 1);
      if (!pct.has(a.mock_test_id)) pct.set(a.mock_test_id, []);
      pct.get(a.mock_test_id).push(Number(a.percentage || 0));
    });
  }
  return (tests || []).map(t => ({ ...t, students: stu.get(t.id) || 0, submitted: sub.get(t.id) || 0, pcts: pct.get(t.id) || [] }));
}
function v24ReleaseCell(t) {
  if (t.results_released) return v24Chip('approved', 'Released');
  if (t.release_requested_at) return v24Chip('pending', 'Waiting for Admin');
  return `<button class="v24-sm" onclick="v24RequestRelease('${t.id}')"${t.submitted ? '' : ' disabled title="No student has submitted yet"'}>Request release</button>`;
}
async function v24WorkMock(body) {
  const tests = await v24MyTests();
  body.innerHTML = tests.length ? `<div class="v24-tw"><table class="v24-t"><thead><tr><th>Mock test</th><th>Created</th><th>Students</th><th>Submitted</th><th>Results</th></tr></thead><tbody>
    ${tests.map(t => `<tr><td><b>${v24e(t.title)}</b></td><td class="nw">${v24Date(t.created_at)}</td><td>${t.students}</td><td>${t.submitted}</td><td class="nw">${v24ReleaseCell(t)}</td></tr>`).join('')}
    </tbody></table></div><p class="small muted">Edit, print or delete a mock test from “Mock test tools”. Students see results only after the Admin releases them.</p>`
    : '<div class="v24-empty">No mock tests yet. Use “Mock test tools” to generate one.</div>';
}
async function v24WorkPapers(body) {
  const { data, error } = await sb.from('jnvst_generated_question_papers').select('id,title,subject,language,set_code,question_count,generated_at').eq('teacher_id', current.id).order('generated_at', { ascending: false }).limit(40);
  if (error) { body.innerHTML = message(error.message); return; }
  body.innerHTML = (data || []).length ? `<div class="v24-tw"><table class="v24-t"><thead><tr><th>Paper</th><th>Subject</th><th>Language</th><th>Set</th><th>Questions</th><th>Made</th><th></th></tr></thead><tbody>
    ${data.map(p => `<tr><td><b>${v24e(p.title)}</b></td><td>${v24e(p.subject || '')}</td><td>${v24e(p.language || '')}</td><td>${v24e(p.set_code || '')}</td><td>${Number(p.question_count || 0)}</td><td class="nw">${v24Date(p.generated_at)}</td>
      <td class="r">${typeof viewGeneratedQuestionPaper === 'function' ? `<button class="secondary v24-sm" onclick="viewGeneratedQuestionPaper('${p.id}')">Paper</button><button class="secondary v24-sm" onclick="viewGeneratedQuestionPaper('${p.id}',true)">Answer key</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="v24-empty">No question papers yet. Use “+ New question paper”.</div>';
}
async function v24RequestRelease(id) {
  try { await v24Rpc('teacher_request_result_release', { p_test_id: id }); notify('Request sent. The Admin will release the results.'); }
  catch (e) { notify('Could not send the request: ' + v24Err(e)); }
  if (document.getElementById('v24Main')) v24ShowTab(V24.tab);
  else if (document.getElementById('previousMockTests') && typeof loadPreviousMockTests === 'function') loadPreviousMockTests();
}

/* -------------------------------------------------------------- Results */
async function v24TabResults(el) {
  const tests = await v24MyTests();
  el.innerHTML = `
    <div class="v24-head"><div><h2>Results &amp; reports</h2><p>Results of your students. Mock test results reach students after the Admin releases them.</p></div>
      <div class="actions"><button class="secondary" onclick="teacherResultsDashboard()">Assignment results</button><button class="secondary" onclick="mockTeacherResults()">Mock test results</button>${typeof omrImportPage === 'function' ? '<button class="secondary" onclick="omrImportPage()">Import OMR</button>' : ''}</div></div>
    ${tests.length ? `<div class="v24-tw"><table class="v24-t"><thead><tr><th>Mock test</th><th>Submitted</th><th>Average</th><th>Below 40%</th><th>Results</th></tr></thead><tbody>
      ${tests.map(t => { const avg = t.pcts.length ? (t.pcts.reduce((a, b) => a + b, 0) / t.pcts.length) : null; return `<tr><td><b>${v24e(t.title)}</b><div class="small muted">${v24Date(t.created_at)}</div></td><td>${t.submitted} / ${t.students}</td><td>${avg == null ? '—' : avg.toFixed(0) + '%'}</td><td>${t.pcts.filter(p => p < 40).length}</td><td class="nw">${v24ReleaseCell(t)}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<div class="v24-empty">No mock test results yet.</div>'}`;
}

/* ----------------------------------------------------------------- Fees */
async function v24TabFees(el) {
  const [rows, fees] = await Promise.all([v24Students(), v24Fees(true)]);
  const list = [...rows].sort((a, b) => String(a.roll_no || '').localeCompare(String(b.roll_no || ''), undefined, { numeric: true }));
  const sum = k => list.reduce((t, s) => t + Number(fees.get(s.id)?.[k] || 0), 0);
  let mine = null; try { mine = ((await v24Rpc('teacher_my_collections')) || [])[0] || null; } catch (_) {}
  let reqs = []; try { reqs = (await v24Rpc('teacher_fee_change_requests')) || []; } catch (_) {}
  V24.feeReqs = reqs;
  const waiting = new Map(reqs.filter(r => r.status === 'pending').map(r => [r.student_id, r]));
  el.innerHTML = `
    <div class="v24-head"><div><h2>Fees</h2><p>Students in your groups. Record payments; a change of a course fee or discount is sent to the Admin for approval.</p></div></div>
    <div class="v24-stats">
      <div class="v24-stat"><div class="l">Collected</div><div class="n">₹${v24Money(sum('paid'))}</div></div>
      <div class="v24-stat"><div class="l">Still due</div><div class="n">₹${v24Money(sum('due'))}</div></div>
      <div class="v24-stat"><div class="l">Students fully paid</div><div class="n">${list.filter(s => v24FeeStatus(fees.get(s.id))[0] === 'paid').length} / ${list.length}</div></div>
      ${mine ? `<div class="v24-stat"><div class="l">Received by you</div><div class="n">₹${v24Money(mine.total)}</div><div class="s">${mine.payments} payment${mine.payments === 1 ? '' : 's'} · ₹${v24Money(mine.this_month)} this month</div></div>` : ''}
    </div>
    <div class="v24-lock"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></svg>A saved payment cannot be changed or deleted. If a payment was entered wrongly, ask the Admin to correct it.</div>
    ${v26FeeReqPanel(reqs)}
    ${list.length ? `<div class="v24-tw"><table class="v24-t"><thead><tr><th>Roll no.</th><th>Name</th><th>Group</th><th>Fee (₹)</th><th>Paid (₹)</th><th>Due (₹)</th><th>Last payment</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(s => { const f = fees.get(s.id); const [k, l] = v24FeeStatus(f); return `<tr><td>${v24e(s.roll_no || '—')}</td><td><b>${v24e(s.full_name || '')}</b></td><td class="nw">${v24e(s.class_name || '')}</td>
        <td>${f ? v24Money(Number(f.total) - Number(f.discount || 0)) : '—'}</td><td>${f ? v24Money(f.paid) : '—'}</td><td>${f ? v24Money(f.due) : '—'}</td><td class="nw">${f?.last_payment ? v24Date(f.last_payment) : '—'}</td><td>${v24Chip(k, l)}${waiting.has(s.id) ? '<br>' + v24Chip('pending', 'Fee change waiting') : ''}</td>
        <td class="r"><button class="v24-sm" onclick="v26PaymentForm('${s.id}')">Record payment</button><button class="secondary v24-sm" onclick="v26FeeForm('${s.id}')">Change fee</button><button class="secondary v24-sm" onclick="v26FeeHistory('${s.id}')">History</button></td></tr>`; }).join('')}
    </tbody></table></div>` : '<div class="v24-empty">No students in your groups yet.</div>'}`;
}

/* V26: fees of one student (teacher). Payments are added only; the Admin corrects mistakes. */
function v26FeeReqPanel(reqs) {
  if (!reqs || !reqs.length) return '';
  const st = { pending: ['pending', 'Waiting for Admin'], approved: ['approved', 'Approved'], rejected: ['returned', 'Not approved'] };
  const fee = (t, d) => t == null ? '—' : `₹${v24Money(t)}${Number(d) ? ` − ₹${v24Money(d)}` : ''}`;
  return `<section class="v24-panel" style="margin-bottom:14px"><h3>My fee change requests</h3>
    <div class="v24-tw" style="border:0;border-radius:0"><table class="v24-t"><thead><tr><th>Student</th><th>Was</th><th>Requested</th><th>Status</th><th>Admin note</th><th>Sent</th></tr></thead><tbody>
    ${reqs.map(r => `<tr><td><b>${v24e(r.student_name || '')}</b><div class="small muted">${v24e(r.roll_no || '')}</div></td><td class="nw">${fee(r.old_total, r.old_discount)}</td><td class="nw"><b>${fee(r.new_total, r.new_discount)}</b>${r.reason ? `<div class="small muted">${v24e(r.reason)}</div>` : ''}</td>
      <td>${v24Chip(...(st[r.status] || ['none', r.status]))}</td><td class="small" style="max-width:220px">${v24e(r.review_note || '')}</td><td class="nw">${v24Date(r.created_at)}</td></tr>`).join('')}
    </tbody></table></div></section>`;
}
function v26Student(id) { return (V24.students || []).find(s => s.id === id) || {}; }
function v26Today() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
async function v26AfterFeeChange() {
  V24.fees = null;
  if (document.getElementById('v24Main')) v24ShowTab(V24.tab);
}
function v26FeeMenu(id) {
  const s = v26Student(id), f = V24.fees?.get?.(id);
  v24Modal(`<h3>Fees — ${v24e(s.full_name || '')} <span class="small muted">${v24e(s.roll_no || '')}</span></h3>
    <p>${f ? `Fee ₹${v24Money(Number(f.total) - Number(f.discount || 0))} · Paid ₹${v24Money(f.paid)} · <b>Due ₹${v24Money(f.due)}</b>` : 'No fee set yet.'}</p>
    <div class="actions"><button onclick="v26PaymentForm('${id}')">Record payment</button><button class="secondary" onclick="v26FeeForm('${id}')">Change fee</button><button class="secondary" onclick="v26FeeHistory('${id}')">History</button><button class="secondary" onclick="v24CloseModal()">Close</button></div>`);
}
function v26PaymentForm(id) {
  const s = v26Student(id);
  v24Modal(`<h3>Record payment — ${v24e(s.full_name || '')} <span class="small muted">${v24e(s.roll_no || '')}</span></h3>
    <div class="grid">
      <div><label for="v26PAmt">Amount (₹)</label><input id="v26PAmt" type="number" min="1" step="1" inputmode="decimal"></div>
      <div><label for="v26PDate">Payment date</label><input id="v26PDate" type="date" value="${v26Today()}" max="${v26Today()}"></div>
      <div><label for="v26PMode">Mode</label><select id="v26PMode"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Cheque</option><option>Other</option></select></div>
      <div><label for="v26PRef">Reference no. (optional)</label><input id="v26PRef" autocomplete="off"></div>
    </div>
    <label for="v26PRem">Remarks (optional)</label><input id="v26PRem" autocomplete="off">
    <p class="small muted" style="margin:2px 0 0">Recorded as received by you (<b>${v24e(profile?.full_name || '')}</b>) — record only money you collected yourself.</p>
    <div id="v26PMsg"></div>
    <div class="actions" style="margin-top:14px"><button id="v26PBtn" onclick="v26SavePayment('${id}')">Save payment</button><button class="secondary" onclick="v24CloseModal()">Cancel</button></div>`);
  document.getElementById('v26PAmt')?.focus();
}
async function v26SavePayment(id, allowDuplicate) {
  const amount = Number(document.getElementById('v26PAmt').value);
  const payment_date = document.getElementById('v26PDate').value;
  const msg = document.getElementById('v26PMsg');
  if (!(amount > 0)) { msg.innerHTML = message('Enter an amount greater than 0.'); return; }
  if (!payment_date) { msg.innerHTML = message('Choose the payment date.'); return; }
  const s = v26Student(id);
  if (!allowDuplicate && !confirm(`Save a payment of ₹${v24Money(amount)} for ${s.full_name || 'this student'} on ${v24Date(payment_date)}?\n\nA saved payment cannot be changed or deleted by you.`)) return;
  const btn = document.getElementById('v26PBtn'); btn.disabled = true;
  try {
    await callTeacherFn({ action: 'feeAddPayment', student_id: id, amount, payment_date,
      payment_mode: document.getElementById('v26PMode').value, reference_no: document.getElementById('v26PRef').value.trim(),
      remarks: document.getElementById('v26PRem').value.trim(), allow_duplicate: !!allowDuplicate });
    v24CloseModal(); notify(`Payment of ₹${v24Money(amount)} saved for ${s.full_name || 'the student'}.`);
    v26AfterFeeChange();
  } catch (e) {
    btn.disabled = false;
    if (/same date and amount/i.test(v24Err(e)) && confirm('A payment with the same date and amount is already saved for this student.\n\nSave this one as an extra payment anyway?')) return v26SavePayment(id, true);
    msg.innerHTML = message(v24Err(e));
  }
}
function v26FeeForm(id) {
  const s = v26Student(id), f = V24.fees?.get?.(id), w = (V24.feeReqs || []).find(r => r.student_id === id && r.status === 'pending');
  v24Modal(`<h3>Change course fee — ${v24e(s.full_name || '')} <span class="small muted">${v24e(s.roll_no || '')}</span></h3>
    <p class="small" style="margin-top:0">Now: ${f ? `fee ₹${v24Money(f.total)}${Number(f.discount) ? `, discount ₹${v24Money(f.discount)}` : ''}` : 'no fee set'}. Your change is sent to the <b>Admin for approval</b>; until then the current fee stays.</p>
    ${w ? `<div class="notice small">Already waiting: fee ₹${v24Money(w.new_total)}, discount ₹${v24Money(w.new_discount)} (sent ${v24Date(w.created_at)}). Sending a new change replaces it.</div>` : ''}
    <div class="grid">
      <div><label for="v26FTotal">Total course fee (₹)</label><input id="v26FTotal" type="number" min="0" step="1" value="${f ? Number(f.total) : ''}" oninput="v26FeeNet()"></div>
      <div><label for="v26FDisc">Discount (₹)</label><input id="v26FDisc" type="number" min="0" step="1" value="${f ? Number(f.discount || 0) : 0}" oninput="v26FeeNet()"></div>
    </div>
    <p id="v26FNet" class="small"></p>
    <label for="v26FWhy">Reason for the Admin (optional)</label><input id="v26FWhy" maxlength="500" autocomplete="off" placeholder="e.g. sibling discount agreed with parents">
    <div id="v26FMsg"></div>
    <div class="actions" style="margin-top:14px"><button id="v26FBtn" onclick="v26SaveFee('${id}')">Send for approval</button><button class="secondary" onclick="v24CloseModal()">Cancel</button></div>`);
  v26FeeNet();
}
function v26FeeNet() {
  const t = Number(document.getElementById('v26FTotal')?.value || 0), d = Number(document.getElementById('v26FDisc')?.value || 0);
  const el = document.getElementById('v26FNet'); if (el) el.innerHTML = d > t ? '<span style="color:#b91c1c">The discount is more than the fee.</span>' : `Fee to pay: <b>₹${v24Money(t - d)}</b>`;
}
async function v26SaveFee(id) {
  const total = Number(document.getElementById('v26FTotal').value || 0), discount = Number(document.getElementById('v26FDisc').value || 0);
  const msg = document.getElementById('v26FMsg');
  if (total < 0 || discount < 0 || discount > total) { msg.innerHTML = message('Enter a fee of 0 or more and a discount not larger than the fee.'); return; }
  const btn = document.getElementById('v26FBtn'); btn.disabled = true;
  try {
    const j = await callTeacherFn({ action: 'feeSaveAccount', student_id: id, total_course_fee: total, discount_amount: discount, reason: document.getElementById('v26FWhy')?.value.trim() || '' });
    v24CloseModal(); notify(j.pending ? 'Sent to the Admin for approval. The fee changes when the Admin approves it.' : 'Fee saved.'); v26AfterFeeChange();
  } catch (e) { btn.disabled = false; msg.innerHTML = message(v24Err(e)); }
}
async function v26FeeHistory(id) {
  const s = v26Student(id);
  v24Modal(`<h3>Payments — ${v24e(s.full_name || '')} <span class="small muted">${v24e(s.roll_no || '')}</span></h3><div id="v26H" class="v24-empty">Loading…</div>`);
  try {
    const d = await v24Rpc('teacher_student_fee_detail', { p_student: id });
    const p = d?.payments || [], a = d?.account;
    const paid = p.reduce((t, x) => t + Number(x.amount || 0), 0);
    document.getElementById('v26H').outerHTML = `
      <p>${a ? `Course fee ₹${v24Money(a.total_course_fee)}${Number(a.discount_amount) ? ` − discount ₹${v24Money(a.discount_amount)}` : ''} · Paid ₹${v24Money(paid)} · <b>Due ₹${v24Money(Math.max(0, Number(a.total_course_fee) - Number(a.discount_amount || 0) - paid))}</b>` : 'No fee set yet.'}</p>
      ${p.length ? `<div class="v24-tw"><table class="v24-t"><thead><tr><th>Date</th><th>Amount (₹)</th><th>Received by</th><th>Mode</th><th>Reference</th><th>Remarks</th></tr></thead><tbody>
        ${p.map(x => `<tr><td class="nw">${v24Date(x.payment_date)}</td><td>${v24Money(x.amount)}</td><td class="nw"><b>${v24e(x.received_by || '')}</b>${x.received_by_me ? ' ' + v24Chip('info', 'You') : ''}</td><td>${v24e(x.payment_mode || '')}</td><td>${v24e(x.reference_no || '')}</td><td>${v24e(x.remarks || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="v24-empty">No payments yet.</div>'}
      <div class="actions" style="margin-top:14px"><button onclick="v26PaymentForm('${id}')">Record payment</button><button class="secondary" onclick="v24CloseModal()">Close</button></div>`;
  } catch (e) {
    const h = document.getElementById('v26H'); if (h) h.outerHTML = message(/does not exist|Could not find/i.test(v24Err(e)) ? 'Payment history needs V26_TEACHER_STUDENTS_FEES.sql. Please ask the Admin to run it.' : v24Err(e));
  }
}

/* ============================================================ ADMIN SIDE == */
async function v24InjectAdminCard() {
  const wrap = document.querySelector('#app .wrap');
  if (!wrap || document.getElementById('v24AdminCard')) return;
  v24Css();
  const card = document.createElement('div');
  card.className = 'card'; card.id = 'v24AdminCard';
  card.innerHTML = `<div class="v24-admin-card"><div><h2 style="margin:0">👩‍🏫 Teachers</h2><p class="muted small" style="margin:4px 0 0">Teacher accounts, question approvals and result release requests.</p></div>
    <div class="actions"><button onclick="v24AdminHome('teachers')">Manage Teachers</button><button class="secondary" onclick="v24AdminHome('approvals')">Question Approvals<span id="v24PendBadge"></span></button><button class="secondary" onclick="v24AdminHome('release')">Result Release Requests<span id="v24RelBadge"></span></button><button class="secondary" onclick="v24AdminHome('fees')">Fee Change Approvals<span id="v26FeeBadge"></span></button></div></div>`;
  const first = wrap.querySelector('.card');
  if (first && first.nextSibling) wrap.insertBefore(card, first.nextSibling); else wrap.appendChild(card);
  try {
    const [p, r] = await Promise.all([v24Rpc('admin_pending_questions'), v24Rpc('admin_release_requests')]);
    const groups = new Set((p || []).map(q => q.passage_id || q.id)).size;
    if (groups) document.getElementById('v24PendBadge').innerHTML = `<span class="v24-badge">${groups}</span>`;
    if ((r || []).length) document.getElementById('v24RelBadge').innerHTML = `<span class="v24-badge">${r.length}</span>`;
  } catch (_) {}
  try { const f = (await v24Rpc('admin_fee_change_requests')) || []; if (f.length) document.getElementById('v26FeeBadge').innerHTML = `<span class="v24-badge">${f.length}</span>`; } catch (_) {}
}

async function v24AdminHome(tab) {
  if (tab) V24.adminTab = tab;
  v24Css();
  render(`<div class="wrap v24-admin">${header('Teachers')}
    <div class="card"><div class="v24-seg" role="tablist" aria-label="Teachers section" style="margin:0">
      ${[['teachers', 'Teachers'], ['approvals', 'Question approvals'], ['release', 'Result release requests'], ['fees', 'Fee change approvals']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${V24.adminTab === k}" onclick="v24AdminHome('${k}')">${l}</button>`).join('')}
    </div></div>
    <div id="v24AdminMain"><div class="card"><p class="muted">Loading…</p></div></div></div>`);
  const el = document.getElementById('v24AdminMain');
  try {
    if (V24.adminTab === 'approvals') await v24AdminApprovals(el);
    else if (V24.adminTab === 'release') await v24AdminRelease(el);
    else if (V24.adminTab === 'fees') await v26AdminFeeRequests(el);
    else await v24AdminTeachers(el);
  } catch (e) {
    el.innerHTML = `<div class="card">${message(v24Err(e))}<p class="small muted">If this says a function does not exist, run V24_TEACHER_ACCOUNTS.sql in the Supabase SQL Editor.</p></div>`;
  }
}

async function v24AdminData() {
  const [cl, sj] = await Promise.all([
    sb.from('classes').select('id,name,course,jnvst_group_type,jnvst_parent_id').eq('teacher_id', current.id).order('name'),
    sb.from('jnvst_subjects').select('id,name').eq('teacher_id', current.id).order('name')
  ]);
  if (cl.error) throw cl.error; if (sj.error) throw sj.error;
  V24.admin.classes = (cl.data || []).filter(c => String(c.course || '').toUpperCase() !== 'SCHOOL');
  V24.admin.subjects = sj.data || [];
}

async function v24AdminTeachers(el) {
  await v24AdminData();
  V24.admin.teachers = (await v24Rpc('admin_list_teachers')) || [];
  const cName = id => V24.admin.classes.find(c => c.id === id)?.name || '?';
  const sName = id => V24.admin.subjects.find(s => s.id === id)?.name || '?';
  const t = V24.admin.teachers;
  el.innerHTML = `
    <div class="card"><h2 style="margin-top:0">Add a teacher</h2>
      <div class="grid">
        <div><label for="v24NewName">Name</label><input id="v24NewName" placeholder="Teacher's full name" autocomplete="off"></div>
        <div><label for="v24NewEmail">Email (used to log in)</label><input id="v24NewEmail" type="email" placeholder="name@example.com" autocomplete="off"></div>
        <div><label for="v24NewPw">Password (at least 8 characters)</label><input id="v24NewPw" autocomplete="new-password"></div>
      </div>
      <div class="actions"><button onclick="v24CreateTeacher()">Create teacher account</button><button class="secondary" onclick="document.getElementById('v24NewPw').value=v24MakePassword()">Suggest a password</button></div>
      <p class="small muted">After creating the account, choose the teacher's groups and subjects. Give the teacher the email and password; they log in with “Teacher Login”.</p>
    </div>
    <div class="card"><h2 style="margin-top:0">Teachers (${t.length})</h2>
      ${t.length ? `<div class="v24-tw"><table class="v24-t"><thead><tr><th>Teacher</th><th>Groups</th><th>Subjects</th><th>Roll No prefix</th><th>Status</th><th></th></tr></thead><tbody>
      ${t.map(x => `<tr><td><b>${v24e(x.full_name || '')}</b><div class="small muted">${v24e(x.email || '')}</div></td>
        <td>${(x.class_ids || []).map(id => v24Chip('info', cName(id))).join(' ') || '<span class="muted small">None</span>'}</td>
        <td>${(x.subject_ids || []).map(id => v24Chip('info', sName(id))).join(' ') || '<span class="muted small">None</span>'}</td>
        <td class="nw">${x.roll_prefix ? v24Chip('info', x.roll_prefix + '-') : (x.roll_prefix === undefined ? '<span class="small muted">Run V26 SQL</span>' : v24Chip('due', 'Not set'))}${x.students_added ? `<div class="small muted">${x.students_added} student${x.students_added === 1 ? '' : 's'} added</div>` : ''}</td>
        <td>${x.is_active ? v24Chip('ok', 'Active') : v24Chip('off', 'Disabled')}</td>
        <td class="r"><button class="v24-sm" onclick="v24EditAccess('${x.id}')">Groups, subjects &amp; prefix</button>
          <button class="secondary v24-sm" onclick="v24TeacherPassword('${x.id}')">Password</button>
          <button class="secondary v24-sm" onclick="v24RenameTeacher('${x.id}')">Rename</button>
          <button class="${x.is_active ? 'danger' : 'secondary'} v24-sm" onclick="v24SetTeacherActive('${x.id}',${!x.is_active})">${x.is_active ? 'Disable' : 'Enable'}</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">No teacher accounts yet.</p>'}
    </div>`;
}
// V26: suggested prefix from the teacher's initials (e.g. Rina Kalita -> RK).
function v26SuggestPrefix(name) {
  const w = String(name || '').toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean);
  const p = (w.length > 1 ? w.map(x => x[0]).join('') : (w[0] || 'T').slice(0, 2)).slice(0, 4);
  const used = new Set((V24.admin.teachers || []).map(t => String(t.roll_prefix || '').toUpperCase()));
  if (!used.has(p)) return p;
  for (let i = 2; i < 100; i++) if (!used.has(p + i)) return (p + i).slice(0, 6);
  return p;
}
function v24MakePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(10); crypto.getRandomValues(a);
  return Array.from(a, n => chars[n % chars.length]).join('');
}
async function v24CreateTeacher() {
  const full_name = document.getElementById('v24NewName').value.trim();
  const email = document.getElementById('v24NewEmail').value.trim();
  const password = document.getElementById('v24NewPw').value;
  if (!full_name || !email || password.length < 8) return notify('Enter a name, an email and a password of at least 8 characters.');
  try {
    const r = await v24CallFn(V24_TEACHER_FN, { action: 'createTeacher', full_name, email, password });
    notify(`Teacher account created for ${full_name}.\nEmail: ${email}\nPassword: ${password}\n\nNow choose the teacher's groups, subjects and Roll No prefix.`);
    await v24AdminHome('teachers');
    if (r.id) v24EditAccess(r.id);
  } catch (e) { notify('Could not create the account: ' + v24Err(e)); }
}
function v24EditAccess(id) {
  const t = V24.admin.teachers.find(x => x.id === id); if (!t) return;
  const has = new Set(t.class_ids || []), subj = new Set(t.subject_ids || []);
  const mains = V24.admin.classes.filter(c => !c.jnvst_parent_id);
  const subs = p => V24.admin.classes.filter(c => c.jnvst_parent_id === p);
  const box = (id2, name, on, extra = '') => `<label class="v24-check"><input type="checkbox" value="${id2}" data-v24grp ${on ? 'checked' : ''} ${extra}>${v24e(name)}</label>`;
  v24Modal(`<h3>Groups, subjects &amp; Roll No prefix — ${v24e(t.full_name || '')}</h3>
    <p class="small muted" style="margin-top:0">A main group includes all its sub-groups. Tick only a sub-group to limit the teacher to it.</p>
    <b>Groups</b>
    ${mains.map(m => `<div class="v24-group-box">${box(m.id, m.name, has.has(m.id))}${subs(m.id).map(s => `<div style="margin-left:22px">${box(s.id, s.name, has.has(s.id))}</div>`).join('')}</div>`).join('') || '<p class="muted">No groups found.</p>'}
    <b>Subjects</b> <span class="small muted">(the teacher can add questions to these)</span>
    <div class="v24-group-box">${V24.admin.subjects.map(s => `<label class="v24-check"><input type="checkbox" value="${s.id}" data-v24subj ${subj.has(s.id) ? 'checked' : ''}>${v24e(s.name)}</label>`).join('') || '<p class="muted">No subjects found.</p>'}</div>
    <p class="small muted" style="margin:6px 0 0">The teacher sees and uses only the central questions of these subjects. A full 80-question paper needs all four subjects.</p>
    <b style="display:block;margin-top:12px">Roll No prefix</b> <span class="small muted">(students this teacher adds get Roll Nos like <b>${v24e(t.roll_prefix || v26SuggestPrefix(t.full_name))}-001</b>)</span>
    <input id="v26Prefix" maxlength="6" style="max-width:160px;text-transform:uppercase" value="${v24e(t.roll_prefix || (t.roll_prefix === null ? v26SuggestPrefix(t.full_name) : ''))}" placeholder="${v24e(v26SuggestPrefix(t.full_name))}">
    <p class="small muted" style="margin:4px 0 0">1–6 letters or digits, starting with a letter, different for every teacher. Leave empty and the teacher cannot add students.</p>
    <div class="actions" style="margin-top:14px"><button onclick="v24SaveAccess('${id}')">Save</button><button class="secondary" onclick="v24CloseModal()">Cancel</button></div>`);
}
async function v24SaveAccess(id) {
  const classes = [...document.querySelectorAll('[data-v24grp]:checked')].map(x => x.value);
  const subjects = [...document.querySelectorAll('[data-v24subj]:checked')].map(x => x.value);
  const t = V24.admin.teachers.find(x => x.id === id) || {};
  const prefix = (document.getElementById('v26Prefix')?.value || '').trim().toUpperCase();
  if (prefix && !/^[A-Z][A-Z0-9]{0,5}$/.test(prefix)) return notify('Roll No prefix: 1 to 6 letters or digits, starting with a letter (for example RK or T2).');
  try {
    await v24Rpc('admin_set_teacher_access', { p_teacher: id, p_class_ids: classes, p_subject_ids: subjects, p_full_bank: false });
    if (prefix !== String(t.roll_prefix || '')) {
      if (t.roll_prefix && t.students_added && !confirm(`Change the prefix from ${t.roll_prefix} to ${prefix || '(none)'}?\n\nStudents already added keep their Roll Nos (${t.roll_prefix}-…). Only new students get the new prefix.`)) return;
      try { await v24Rpc('admin_set_teacher_prefix', { p_teacher: id, p_prefix: prefix }); }
      catch (e) { return notify('Groups and subjects saved, but the prefix was not: ' + (/does not exist|Could not find/i.test(v24Err(e)) ? 'please run V26_TEACHER_STUDENTS_FEES.sql first.' : v24Err(e))); }
    }
    v24CloseModal(); notify('Saved.'); v24AdminHome('teachers');
  } catch (e) { notify('Could not save: ' + v24Err(e)); }
}
async function v24TeacherPassword(id) {
  const t = V24.admin.teachers.find(x => x.id === id);
  const pw = prompt(`New password for ${t?.full_name || 'this teacher'} (at least 8 characters):`, v24MakePassword());
  if (pw == null) return;
  if (pw.length < 8) return notify('Password must have at least 8 characters.');
  try { await v24CallFn(V24_TEACHER_FN, { action: 'setPassword', teacher_id: id, password: pw }); notify(`Password changed.\nNew password: ${pw}`); }
  catch (e) { notify('Could not change the password: ' + v24Err(e)); }
}
async function v24RenameTeacher(id) {
  const t = V24.admin.teachers.find(x => x.id === id);
  const name = prompt('Teacher name:', t?.full_name || '');
  if (name == null || !name.trim()) return;
  try { await v24CallFn(V24_TEACHER_FN, { action: 'renameTeacher', teacher_id: id, full_name: name.trim() }); v24AdminHome('teachers'); }
  catch (e) { notify('Could not rename: ' + v24Err(e)); }
}
async function v24SetTeacherActive(id, active) {
  const t = V24.admin.teachers.find(x => x.id === id);
  if (!active && !confirm(`Disable ${t?.full_name || 'this teacher'}? They will not be able to log in. Their assignments and questions stay.`)) return;
  try { await v24CallFn(V24_TEACHER_FN, { action: 'setActive', teacher_id: id, active }); notify(active ? 'Teacher enabled.' : 'Teacher disabled.'); v24AdminHome('teachers'); }
  catch (e) { notify('Could not change the account: ' + v24Err(e)); }
}

async function v24AdminApprovals(el) {
  const rows = (await v24Rpc('admin_pending_questions')) || [];
  // One card per passage / language pair / single question.
  const groups = new Map();
  rows.forEach(q => {
    const key = q.author_id + '|' + (q.passage_id ? 'p:' + q.passage_id : 'q:' + q.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  });
  V24.pending = [...groups.values()];
  el.innerHTML = V24.pending.length ? `
    <div class="card"><div class="actions" style="justify-content:space-between;align-items:center"><div><b>${V24.pending.length}</b> item${V24.pending.length === 1 ? '' : 's'} waiting (${rows.length} question row${rows.length === 1 ? '' : 's'}). Approved questions join the central bank under their subject and lesson.</div>
      <button class="secondary" onclick="v24ApproveAll()">Approve all</button></div></div>
    ${V24.pending.map((g, i) => {
      const f = g[0];
      const langs = [...new Set(g.map(q => q.language).filter(Boolean))].join(', ');
      return `<div class="v24-review card">
        <div class="actions" style="justify-content:space-between;align-items:flex-start"><div>
          <b>${v24e(f.author_name)}</b> · ${v24e(f.subject_name || '—')} › ${v24e(`${f.lesson_code || ''} ${f.lesson_name || ''}`.trim() || '—')}
          <div class="small muted">${v24e(v24PartLabel(f.part_code))}${langs ? ' · ' + v24e(langs) : ''} · sent ${v24Date(f.submitted_at)} · ${g.length} question${g.length === 1 ? '' : 's'}</div></div>
          <div class="actions"><button onclick="v24Review(${i},true)">✓ Approve</button><button class="secondary" onclick="v24Review(${i},false)">↩ Return with note</button></div></div>
        ${f.passage_text ? `<details><summary><b>Passage: ${v24e(f.passage_title || '')}</b></summary><div class="v24-passage">${v24Math(f.passage_text)}</div></details>` : ''}
        ${g.map(q => `<div style="border-top:1px solid #f1f5f9;padding-top:8px;margin-top:8px">${q.question_order ? `<div class="small muted">Question ${q.question_order}${q.language ? ' · ' + v24e(q.language) : ''}</div>` : ''}${v24QuestionHtml(q)}</div>`).join('')}
      </div>`;
    }).join('')}` : '<div class="card"><p class="muted" style="margin:0">No questions are waiting for approval.</p></div>';
  v24Typeset(el);
}
async function v24Review(i, approve) {
  const g = V24.pending?.[i]; if (!g) return;
  let note = null;
  if (!approve) { note = prompt('What should the teacher fix? (the teacher sees this note)'); if (note == null) return; if (!note.trim()) return notify('Please write a short note.'); }
  try { await v24Rpc('admin_review_questions', { p_ids: g.map(q => q.id), p_approve: approve, p_note: note }); notify(approve ? 'Approved. The questions are now in the central bank.' : 'Returned to the teacher.'); }
  catch (e) { notify('Could not save: ' + v24Err(e)); }
  v24AdminHome('approvals');
}
async function v24ApproveAll() {
  const ids = (V24.pending || []).flat().map(q => q.id);
  if (!ids.length || !confirm(`Approve all ${V24.pending.length} item(s)? They join the central bank.`)) return;
  try { const n = await v24Rpc('admin_review_questions', { p_ids: ids, p_approve: true, p_note: null }); notify(`${n} question row(s) approved.`); }
  catch (e) { notify('Could not approve: ' + v24Err(e)); }
  v24AdminHome('approvals');
}

/* V26: fee changes sent by teachers; the fee changes only when approved here. */
async function v26AdminFeeRequests(el) {
  let rows;
  try { rows = (await v24Rpc('admin_fee_change_requests')) || []; }
  catch (e) { el.innerHTML = `<div class="card">${message(/does not exist|Could not find/i.test(v24Err(e)) ? 'Run V26_TEACHER_STUDENTS_FEES.sql in the Supabase SQL Editor first.' : v24Err(e))}</div>`; return; }
  V24.feeReqRows = rows;
  const fee = (t, d) => t == null ? '<span class="muted">not set</span>' : `₹${v24Money(Number(t) - Number(d || 0))}<div class="small muted">₹${v24Money(t)}${Number(d) ? ` − ₹${v24Money(d)} discount` : ''}</div>`;
  el.innerHTML = rows.length ? `<div class="card">
    <div class="actions" style="justify-content:space-between;align-items:center"><div><b>${rows.length}</b> fee change${rows.length === 1 ? '' : 's'} waiting. The fee changes only after you approve.</div>
      <button class="secondary" onclick="v26ReviewFee(null,true)">Approve all</button></div>
    <div class="v24-tw" style="margin-top:10px"><table class="v24-t"><thead><tr><th>Student</th><th>Teacher</th><th>Current fee</th><th>Requested fee</th><th>Paid so far</th><th>Reason</th><th>Sent</th><th></th></tr></thead><tbody>
    ${rows.map((r, i) => {
      const changed = r.old_total != null && (Number(r.old_total) !== Number(r.cur_total) || Number(r.old_discount || 0) !== Number(r.cur_discount || 0));
      const net = Number(r.new_total) - Number(r.new_discount || 0);
      return `<tr><td><b>${v24e(r.student_name || '')}</b><div class="small muted">${v24e(r.roll_no || '')} · ${v24e(r.group_name || '')}</div></td><td class="nw">${v24e(r.teacher_name || '')}</td>
        <td class="nw">${fee(r.cur_total, r.cur_discount)}${changed ? '<div class="small" style="color:#b45309">Changed since the request</div>' : ''}</td>
        <td class="nw"><b>${fee(r.new_total, r.new_discount)}</b></td>
        <td class="nw">₹${v24Money(r.paid)}${Number(r.paid) > net ? '<div class="small" style="color:#b91c1c">More than the new fee</div>' : ''}</td>
        <td class="small" style="max-width:220px">${v24e(r.reason || '')}</td><td class="nw">${v24Date(r.created_at)}</td>
        <td class="r"><button class="v24-sm" onclick="v26ReviewFee(${i},true)">✓ Approve</button><button class="secondary v24-sm" onclick="v26ReviewFee(${i},false)">✕ Reject</button></td></tr>`;
    }).join('')}
    </tbody></table></div></div>` : '<div class="card"><p class="muted" style="margin:0">No fee changes are waiting for approval.</p></div>';
}
async function v26ReviewFee(i, approve) {
  const rows = V24.feeReqRows || [];
  const list = i == null ? rows : [rows[i]].filter(Boolean);
  if (!list.length) return;
  let note = null;
  if (!approve) { note = prompt(`Why is the fee change for ${list[0].student_name || 'this student'} not approved? (the teacher sees this note)`); if (note == null) return; if (!note.trim()) return notify('Please write a short note.'); }
  else if (i == null && !confirm(`Approve all ${list.length} fee change(s)? The new fees are saved.`)) return;
  try {
    const n = await v24Rpc('admin_review_fee_change', { p_ids: list.map(r => r.id), p_approve: approve, p_note: note });
    notify(approve ? `${n} fee change${n === 1 ? '' : 's'} approved and saved.` : 'Not approved. The teacher sees your note.');
  } catch (e) { notify('Could not save: ' + v24Err(e)); }
  v24AdminHome('fees');
}

async function v24AdminRelease(el) {
  const rows = (await v24Rpc('admin_release_requests')) || [];
  el.innerHTML = `<div class="card">${rows.length ? `<div class="v24-tw"><table class="v24-t"><thead><tr><th>Mock test</th><th>Teacher</th><th>Students</th><th>Submitted</th><th>Requested</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td><b>${v24e(r.title)}</b><div class="small muted">Created ${v24Date(r.created_at)}</div></td><td>${v24e(r.teacher_name)}</td><td>${r.students}</td><td>${r.submitted}</td><td class="nw">${v24Date(r.requested_at)}</td>
      <td class="r"><button class="v24-sm" onclick="v24AdminRelease1('${r.id}')">✓ Release results</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="muted" style="margin:0">No release requests.</p>'}</div>`;
}
async function v24AdminRelease1(id) {
  if (!confirm('Release the results? Students of this mock test will see their results.')) return;
  try { await v24Rpc('admin_release_results', { p_test_id: id, p_release: true }); notify('Results released.'); }
  catch (e) { notify('Could not release: ' + v24Err(e)); }
  v24AdminHome('release');
}

/* ============================================== hooks into the old tools == */
(function v24Hooks() {
  const wrap = (name, fn) => {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__v24) return;
    const w = function (...args) { return fn.call(this, orig, args); };
    w.__v24 = true;
    window[name] = w;
  };

  // Home: teachers get the new dashboard; the Admin gets the old one + Teachers card.
  wrap('teacherHome', async function (orig, args) {
    if (typeof schoolTeacherMode !== 'undefined' && schoolTeacherMode) return orig.apply(this, args);
    try { await v24LoadScope(); } catch (_) {}
    if (V24.limited) return v24PortalHome();
    const r = await orig.apply(this, args);
    if (V24.scope && !V24.scope.missing) { try { await v24InjectAdminCard(); } catch (_) {} }
    return r;
  });

  // Question Bank: teachers use the "My questions" view.
  wrap('jnvstQuestionBankHome', function (orig, args) {
    if (V24.limited) return v24PortalHome('bank', 'mine');
    return orig.apply(this, args);
  });

  // Result release: teachers send a request instead.
  wrap('toggleMockResultsRelease', function (orig, args) {
    if (!V24.limited) return orig.apply(this, args);
    const [id, release] = args;
    if (!release) return notify('Only the Admin can hide results.');
    return v24RequestRelease(id);
  });
  wrap('loadPreviousMockTests', async function (orig, args) {
    const r = await orig.apply(this, args);
    if (V24.limited) {
      document.querySelectorAll('#previousMockTests button[onclick^="toggleMockResultsRelease"]').forEach(b => {
        const released = /,false\)$/.test(b.getAttribute('onclick') || '');
        if (released) { b.textContent = '✓ Released by Admin'; b.disabled = true; }
        else b.textContent = '📨 Request result release';
      });
    }
    return r;
  });

  // Admin-only tools.
  ['manageJnvstClasses', 'addStudent', 'bulkImportStudents', 'manageStudentAccounts', 'manageStudentFees', 'bulkFeesUploadPage',
   'newJnvstMainGroup', 'newJnvstSubject', 'jnvstLessonBulkUpload', 'jnvstQbDeleteSubject', 'jnvstQbDeleteLesson', 'jnvstQbDeleteFiltered',
   'createJnvstStudent', 'newClass', 'downloadAllResultsExcel'].forEach(n => wrap(n, function (orig, args) {
    if (V24.limited) return notify('Only the Admin can do this.');
    return orig.apply(this, args);
  }));
})();
