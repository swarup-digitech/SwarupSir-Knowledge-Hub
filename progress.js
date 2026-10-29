/* ============================================================================
   V27 — Student progress from the Mistake Bank
   ----------------------------------------------------------------------------
   Loaded by main.html after omr-discussion.js and before teacher-portal.js.
   Needs V27_STUDENT_PROGRESS.sql (functions progress_class_summary and
   progress_student_detail). Admin: "📈 Student Progress" card on the dashboard.
   Assigned teacher: "Progress" tab in the teacher dashboard (own groups/subjects).
   ========================================================================== */
(function (root) {
'use strict';
const P = { rows: [], filter: { status: '', group: '', q: '' }, el: null, admin: false };
const e = s => (typeof esc === 'function' ? esc(s) : String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const pct = (a, b) => b ? Math.round(a * 100 / b) : null;
const fmtD = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const ST = {
  IMPROVING: ['Improving', 'p27-up', 1], STEADY: ['Steady', 'p27-flat', 2], NEEDS_HELP: ['Needs help', 'p27-down', 0], NO_DATA: ['Not enough data', 'p27-none', 3]
};
const chip = s => { const x = ST[s] || ST.NO_DATA; return `<span class="p27-chip ${x[1]}">${x[0]}</span>`; };

function css() {
  if (document.getElementById('p27css')) return;
  const s = document.createElement('style'); s.id = 'p27css';
  s.textContent = `
  .p27{color:#0f172a}.p27 h2{margin:0}.p27-sub{color:#475569;font-size:14px;margin:4px 0 0}
  .p27-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}
  .p27-tile{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;text-align:left;cursor:default;color:#0f172a;margin:0;box-shadow:none;font:inherit}
  button.p27-tile{cursor:pointer}button.p27-tile[aria-pressed="true"]{outline:2px solid #2563eb}
  .p27-tile .l{font-size:12px;color:#475569}.p27-tile .n{font-size:26px;font-weight:700;margin-top:2px}.p27-tile .s{font-size:12px;color:#64748b}
  .p27-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:10px}
  .p27-filters label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#475569;margin:0}.p27-filters select,.p27-filters input{margin:0;min-width:170px}
  .p27-tw{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px}
  .p27-t{width:100%;border-collapse:collapse;font-size:14px}
  .p27-t th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#475569;padding:9px 11px;border-bottom:1px solid #e2e8f0;background:#f8fafc;white-space:nowrap}
  .p27-t td{padding:9px 11px;border-bottom:1px solid #f1f5f9;vertical-align:middle}.p27-t tr:last-child td{border-bottom:0}
  .p27-t td.nw{white-space:nowrap}.p27-t td.r{text-align:right;white-space:nowrap}
  .p27-chip{display:inline-block;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap}
  .p27-up{background:#dcfce7;color:#166534}.p27-down{background:#fee2e2;color:#991b1b}.p27-flat{background:#e0f2fe;color:#075985}.p27-none{background:#f1f5f9;color:#475569}
  .p27-bar{display:inline-block;width:70px;height:7px;background:#e2e8f0;border-radius:4px;vertical-align:middle;margin-left:6px;overflow:hidden}.p27-bar i{display:block;height:100%;background:#16a34a}
  .p27-tr{font-weight:700}.p27-tr.up{color:#15803d}.p27-tr.down{color:#b91c1c}.p27-tr.flat{color:#475569}
  .p27-muted{color:#64748b;font-size:12px}
  .p27-panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:14px 0}
  .p27-panel h3{margin:0 0 10px;font-size:16px}
  .p27-why{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-size:13px;color:#334155;margin:10px 0}
  .p27-why summary{cursor:pointer;font-weight:600}
  .p27-reason{font-size:14px;color:#334155;margin:6px 0 0}
  .p27-q{max-width:520px;max-height:4.5em;overflow:hidden}
  .p27-chart svg{width:100%;max-width:760px;height:auto;display:block}
  @media (max-width:640px){.p27-filters select,.p27-filters input{min-width:0;width:100%}.p27-filters label{flex:1 1 140px}}`;
  document.head.appendChild(s);
}

function reason(r) {
  const out = [];
  if (r.trend_delta != null && r.exams >= 2) out.push(`exam scores ${r.trend_delta >= 0 ? 'up' : 'down'} ${Math.abs(r.trend_delta)} points`);
  if (r.retries) out.push(`old mistakes right ${pct(r.retries_right, r.retries)}% (${r.retries_right} of ${r.retries})`);
  if (r.ever_wrong) out.push(`${r.fixed} of ${r.ever_wrong} mistakes fixed`);
  if (r.stubborn) out.push(`${r.stubborn} stubborn mistake${r.stubborn === 1 ? '' : 's'}`);
  return out.join(' · ') || 'Not enough exams or repeated questions yet.';
}
function trendCell(r) {
  if (r.trend_delta == null || r.exams < 2) return '<span class="p27-muted">—</span>';
  const d = Number(r.trend_delta), k = d >= 5 ? 'up' : d <= -5 ? 'down' : 'flat';
  return `<span class="p27-tr ${k}">${k === 'up' ? '↑' : k === 'down' ? '↓' : '→'} ${d > 0 ? '+' : ''}${d}</span>`;
}
const WHY = `<details class="p27-why"><summary>How is this decided?</summary>
  <ul style="margin:8px 0 0;padding-left:18px">
  <li><b>Mistakes fixed</b>: of all questions the student ever got wrong, how many are fixed (answered right twice in a row).</li>
  <li><b>Second chance</b>: when an old mistake comes back (personal paper, assignment, OMR exam), how often it is now answered right. The clearest sign of learning.</li>
  <li><b>Stubborn</b>: wrong 3 or more times and still not fixed — re-teach these.</li>
  <li><b>Trend</b>: average of the last 2 exams minus the 2 before (OMR exams and online mock tests; with 2–3 exams: last minus first), in percentage points.</li>
  <li><b>Improving</b>: trend +5 or more, or second chance 60%+ (of at least 5). <b>Needs help</b>: trend −5 or less, second chance under 40% (of at least 5), or 5+ stubborn mistakes. <b>Not enough data</b>: under 2 exams and under 5 second chances.</li>
  </ul><p style="margin:6px 0 0">Second-chance history starts from your scanned OMR exams and from the day V27 was installed; older online answers were only stored as totals.</p></details>`;

/* -------------------------------------------------------------- class list */
async function load(el) {
  P.el = el; css();
  el.innerHTML = '<div class="p27-muted" style="padding:20px">Loading progress…</div>';
  const { data, error } = await sb.rpc('progress_class_summary', { p_class: null });
  if (error) {
    el.innerHTML = (typeof message === 'function' ? message : x => `<div class="notice">${x}</div>`)(
      /does not exist|Could not find/i.test(error.message || '') ? 'Student progress needs V27_STUDENT_PROGRESS.sql. ' + (P.admin ? 'Run it in the Supabase SQL Editor.' : 'Please ask the Admin.') : e(error.message));
    return;
  }
  P.rows = (data || []).map(r => ({ ...r, trend_delta: r.trend_delta == null ? null : Number(r.trend_delta), last_pct: r.last_pct == null ? null : Number(r.last_pct) }));
  paint();
}
function paint() {
  const el = P.el; if (!el) return;
  const rows = P.rows, f = P.filter;
  const groups = [...new Set(rows.map(r => r.class_name).filter(Boolean))].sort();
  const cnt = s => rows.filter(r => r.status === s).length;
  const sumF = rows.reduce((t, r) => t + r.fixed, 0), sumE = rows.reduce((t, r) => t + r.ever_wrong, 0);
  const sumR = rows.reduce((t, r) => t + r.retries_right, 0), sumT = rows.reduce((t, r) => t + r.retries, 0);
  const tile = (k, l, n, s) => `<button type="button" class="p27-tile" aria-pressed="${f.status === k}" onclick="progressFilter('status','${f.status === k ? '' : k}')"><div class="l">${l}</div><div class="n">${n}</div>${s ? `<div class="s">${s}</div>` : ''}</button>`;
  el.innerHTML = `<div class="p27">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div>${P.admin ? '' : '<h2>Student progress</h2>'}<p class="p27-sub">From the Mistake Bank and exam results${P.admin ? '' : ' — your groups and subjects'}. Click a number to filter.</p></div>
      <div class="actions" style="margin:0"><button class="secondary" onclick="progressExcel()">↓ Excel</button>${P.admin ? '<button class="secondary" onclick="teacherHome()">← Dashboard</button>' : ''}</div></div>
    <div class="p27-tiles">
      ${tile('', 'Students', rows.length, '')}
      ${tile('NEEDS_HELP', '🔴 Needs help', cnt('NEEDS_HELP'), '')}
      ${tile('IMPROVING', '🟢 Improving', cnt('IMPROVING'), '')}
      ${tile('STEADY', '🔵 Steady', cnt('STEADY'), '')}
      ${tile('NO_DATA', '⚪ Not enough data', cnt('NO_DATA'), '')}
      <div class="p27-tile"><div class="l">Mistakes fixed (all)</div><div class="n">${sumE ? pct(sumF, sumE) + '%' : '—'}</div><div class="s">${sumF} of ${sumE}</div></div>
      <div class="p27-tile"><div class="l">Second chance right (all)</div><div class="n">${sumT ? pct(sumR, sumT) + '%' : '—'}</div><div class="s">${sumR} of ${sumT}</div></div>
    </div>
    ${WHY}
    <div class="p27-filters">
      <label>Group<select onchange="progressFilter('group',this.value)"><option value="">All groups</option>${groups.map(g => `<option ${f.group === g ? 'selected' : ''}>${e(g)}</option>`).join('')}</select></label>
      <label>Search<input type="search" value="${e(f.q)}" placeholder="Name or roll no." oninput="progressFilter('q',this.value,true)"></label>
    </div>
    <div class="p27-tw"><table class="p27-t"><thead><tr><th>Roll no.</th><th>Name</th><th>Group</th><th>Status</th><th>Mistakes fixed</th><th>Second chance</th><th>Stubborn</th><th>Exams</th><th>Trend</th><th></th></tr></thead><tbody id="p27Body"></tbody></table></div></div>`;
  paintRows();
}
function visibleRows() {
  const f = P.filter, q = f.q.trim().toLowerCase();
  return P.rows.filter(r => (!f.status || r.status === f.status) && (!f.group || r.class_name === f.group)
      && (!q || String(r.full_name || '').toLowerCase().includes(q) || String(r.roll_no || '').toLowerCase().includes(q)))
    .sort((a, b) => (ST[a.status]?.[2] ?? 9) - (ST[b.status]?.[2] ?? 9) || String(a.roll_no || '').localeCompare(String(b.roll_no || ''), undefined, { numeric: true }));
}
function paintRows() {
  const body = document.getElementById('p27Body'); if (!body) return;
  const list = visibleRows();
  body.innerHTML = list.length ? list.map(r => {
    const fp = pct(r.fixed, r.ever_wrong), sp = pct(r.retries_right, r.retries);
    return `<tr><td class="nw">${e(r.roll_no || '—')}</td><td><b>${e(r.full_name || '')}</b></td><td class="nw">${e(r.class_name || '—')}</td><td>${chip(r.status)}</td>
      <td class="nw">${r.ever_wrong ? `${r.fixed} of ${r.ever_wrong}<span class="p27-bar"><i style="width:${fp}%"></i></span>` : '<span class="p27-muted">no mistakes</span>'}</td>
      <td class="nw">${r.retries ? `<b>${sp}%</b> <span class="p27-muted">${r.retries_right}/${r.retries}</span>` : '<span class="p27-muted">—</span>'}</td>
      <td>${r.stubborn ? `<b style="color:#b91c1c">${r.stubborn}</b>` : '0'}</td>
      <td class="nw">${r.exams}${r.last_pct != null ? ` <span class="p27-muted">· last ${r.last_pct}%</span>` : ''}</td>
      <td class="nw">${trendCell(r)}</td>
      <td class="r"><button class="secondary" style="padding:6px 11px;font-size:13px;margin:0" onclick="progressStudent('${r.student_id}')">View</button></td></tr>`;
  }).join('') : `<tr><td colspan="10" class="p27-muted" style="text-align:center;padding:24px">${P.rows.length ? 'No student matches.' : 'No students yet.'}</td></tr>`;
}
function progressFilter(k, v, soft) { P.filter[k] = v; if (soft) paintRows(); else paint(); }

function progressExcel() {
  if (typeof XLSX === 'undefined') return notify('The Excel library is not loaded yet. Please try again.');
  const rows = visibleRows();
  const aoa = [['Roll No', 'Name', 'Group', 'Status', 'Mistakes ever', 'Fixed', 'Still open', 'Fixed %', 'Stubborn (wrong 3+ times)', 'Second chances', 'Second chance right', 'Second chance %', 'Second chance % (last 30 days)', 'Exams', 'Last exam %', 'Trend (points)', 'Last exam date', 'Why']];
  rows.forEach(r => aoa.push([r.roll_no || '', r.full_name || '', r.class_name || '', (ST[r.status] || ST.NO_DATA)[0], r.ever_wrong, r.fixed, r.open_mistakes,
    r.ever_wrong ? r.fixed / r.ever_wrong : '', r.stubborn, r.retries, r.retries_right, r.retries ? r.retries_right / r.retries : '',
    r.retries_30d ? r.retries_right_30d / r.retries_30d : '', r.exams, r.last_pct ?? '', r.trend_delta ?? '', r.last_exam_at ? new Date(r.last_exam_at).toISOString().slice(0, 10) : '', reason(r)]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let i = 1; i < aoa.length; i++) [7, 11, 12].forEach(c => { const a = XLSX.utils.encode_cell({ r: i, c }); if (ws[a] && ws[a].t === 'n') ws[a].z = '0%'; });
  ws['!cols'] = aoa[0].map((h, i) => ({ wch: i === 1 ? 26 : i === 17 ? 70 : Math.max(10, Math.min(24, h.length + 2)) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: aoa[0].length - 1 } }) };
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Progress');
  XLSX.writeFile(wb, `Student_Progress_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ------------------------------------------------------------ one student */
function chart(exams) {
  const pts = exams.filter(x => x.pct != null);
  if (pts.length < 2) return '<p class="p27-muted">The chart appears after two exams.</p>';
  const W = 640, H = 220, L = 36, R = 12, T = 12, B = 34, iw = W - L - R, ih = H - T - B;
  const x = i => L + (pts.length === 1 ? iw / 2 : i * iw / (pts.length - 1)), y = v => T + ih - (Number(v) / 100) * ih;
  const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#64748b">${v}</text>`).join('');
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.pct)}" r="5" fill="${p.kind === 'OMR' ? '#2563eb' : '#f59e0b'}"><title>${e(p.title)} · ${fmtD(p.at)} · ${p.pct}%</title></circle>`).join('');
  const lab = pts.map((p, i) => (pts.length <= 8 || i % Math.ceil(pts.length / 8) === 0 || i === pts.length - 1) ? `<text x="${x(i)}" y="${H - 12}" font-size="10" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}" fill="#64748b">${new Date(p.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</text>` : '').join('');
  return `<div class="p27-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Exam score over time">${grid}<path d="${path}" fill="none" stroke="#94a3b8" stroke-width="2"/>${dots}${lab}</svg>
    <div class="p27-muted"><span style="color:#2563eb">●</span> scanned OMR exam &nbsp; <span style="color:#f59e0b">●</span> online mock test &nbsp; (score %)</div></div>`;
}
async function progressStudent(id) {
  const el = P.el; if (!el) return;
  css();
  el.innerHTML = '<div class="p27-muted" style="padding:20px">Loading…</div>';
  const { data, error } = await sb.rpc('progress_student_detail', { p_student: id });
  if (error) { el.innerHTML = `<div class="notice">${e(error.message)}</div><div class="actions"><button class="secondary" onclick="progressBack()">← All students</button></div>`; return; }
  const s = data.summary || {}, ex = data.exams || [], tp = data.topics || [], sb2 = data.stubborn || [], mo = data.months || [];
  const r = { ...s, trend_delta: s.trend_delta == null ? null : Number(s.trend_delta) };
  const omr = ex.filter(x => x.kind === 'OMR');
  el.innerHTML = `<div class="p27">
    <div class="actions" style="margin:0 0 10px"><button class="secondary" onclick="progressBack()">← All students</button></div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h2>${e(s.full_name || '')}</h2><span class="p27-muted">Roll No. ${e(s.roll_no || '')}</span>${chip(s.status)}</div>
    <p class="p27-reason">${e(reason(r))}</p>
    <div class="p27-tiles">
      <div class="p27-tile"><div class="l">Mistakes fixed</div><div class="n">${s.ever_wrong ? pct(s.fixed, s.ever_wrong) + '%' : '—'}</div><div class="s">${s.fixed} of ${s.ever_wrong} · ${s.open_mistakes} still open</div></div>
      <div class="p27-tile"><div class="l">Second chance right</div><div class="n">${s.retries ? pct(s.retries_right, s.retries) + '%' : '—'}</div><div class="s">${s.retries_right} of ${s.retries}${s.retries_30d ? ` · last 30 days ${pct(s.retries_right_30d, s.retries_30d)}%` : ''}</div></div>
      <div class="p27-tile"><div class="l">Stubborn mistakes</div><div class="n" style="${s.stubborn ? 'color:#b91c1c' : ''}">${s.stubborn}</div><div class="s">wrong 3+ times, not fixed</div></div>
      <div class="p27-tile"><div class="l">Exams</div><div class="n">${s.exams}</div><div class="s">${s.last_pct != null ? `last ${s.last_pct}% · trend ${trendCell(r)}` : '—'}</div></div>
    </div>
    <div class="p27-panel"><h3>Exam scores over time</h3>${chart(ex)}</div>
    ${omr.length ? `<div class="p27-panel"><h3>Scanned OMR exams</h3><p class="p27-muted" style="margin-top:-6px">“Old mistakes” = questions this student had got wrong before that exam.</p>
      <div class="p27-tw"><table class="p27-t"><thead><tr><th>Date</th><th>Exam</th><th>Score</th><th>Old mistakes right</th><th>New mistakes</th></tr></thead><tbody>
      ${omr.slice().reverse().map(x => `<tr><td class="nw">${fmtD(x.at)}</td><td>${e(x.title)}</td><td class="nw"><b>${x.correct}/${x.total}</b> <span class="p27-muted">${x.pct}%</span></td>
        <td class="nw">${x.old_tried ? `${x.old_right} of ${x.old_tried} <span class="p27-muted">(${pct(x.old_right, x.old_tried)}%)</span>` : '<span class="p27-muted">—</span>'}</td><td>${x.new_mistakes}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
    ${mo.length ? `<div class="p27-panel"><h3>Month by month</h3><div class="p27-tw"><table class="p27-t"><thead><tr><th>Month</th><th>Answers</th><th>New mistakes</th><th>Old mistakes tried</th><th>Old mistakes right</th></tr></thead><tbody>
      ${mo.slice().reverse().map(m => `<tr><td class="nw">${new Date(m.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td><td>${m.answers}</td><td>${m.new_mistakes}</td><td>${m.retries}</td>
        <td class="nw">${m.retries ? `<b>${pct(m.retries_right, m.retries)}%</b> <span class="p27-muted">${m.retries_right}/${m.retries}</span>` : '—'}</td></tr>`).join('')}
      </tbody></table></div></div>` : ''}
    <div class="p27-panel"><h3>By topic</h3>${tp.length ? `<div class="p27-tw"><table class="p27-t"><thead><tr><th>Subject</th><th>Topic</th><th>Mistakes</th><th>Fixed</th><th>Still open</th><th>Second chance</th></tr></thead><tbody>
      ${tp.map(t => `<tr><td class="nw">${e(t.subject || '')}</td><td><b>${e(t.topic)}</b></td><td>${t.ever_wrong}</td><td class="nw">${t.fixed}<span class="p27-bar"><i style="width:${pct(t.fixed, t.ever_wrong) || 0}%"></i></span></td>
        <td>${t.open_mistakes ? `<b style="color:#b91c1c">${t.open_mistakes}</b>` : '0'}</td><td class="nw">${t.retries ? `${pct(t.retries_right, t.retries)}% <span class="p27-muted">${t.retries_right}/${t.retries}</span>` : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="p27-muted">No mistakes recorded.</p>'}</div>
    <div class="p27-panel"><h3>Questions still going wrong</h3><p class="p27-muted" style="margin-top:-6px">Wrong at least twice and not yet fixed (fixed = right twice in a row). Wrong 3+ times = re-teach.</p>
      ${sb2.length ? `<div class="p27-tw"><table class="p27-t"><thead><tr><th>Question</th><th>Topic</th><th>Wrong</th><th>Right</th><th>Last wrong</th></tr></thead><tbody>
      ${sb2.map(q => `<tr><td><div class="p27-q">${q.image_url ? '🖼 ' : ''}${typeof jnvstMathPreview === 'function' ? jnvstMathPreview(q.question_text) : e(q.question_text)}</div></td><td class="nw">${e(q.topic || '')}<div class="p27-muted">${e(q.subject || '')}</div></td>
        <td><b style="color:${q.wrong_count >= 3 ? '#b91c1c' : 'inherit'}">${q.wrong_count}×</b></td><td>${q.correct_count}×</td><td class="nw">${fmtD(q.last_wrong_at)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="p27-muted">None — every repeated mistake has been fixed.</p>'}</div>
    ${WHY}</div>`;
  try { if (typeof jnvstTypesetWhenReady === 'function') jnvstTypesetWhenReady([el]); else if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([el]).catch(() => {}); } catch (_) {}
  window.scrollTo && window.scrollTo(0, 0);
}
function progressBack() { if (P.el) paint(); }

/* ------------------------------------------------------------ entry points */
// Admin: full page.
async function progressHome() {
  P.admin = true;
  render(`<div class="wrap">${typeof header === 'function' ? header('Student Progress') : ''}<div class="card"><div id="p27Root"></div></div></div>`);
  return load(document.getElementById('p27Root'));
}
// Assigned teacher: "Progress" tab of the teacher dashboard (teacher-portal.js).
function v27TabProgress(el) { P.admin = false; return load(el); }

// Admin dashboard card (the teacher dashboard of assigned teachers has its own tab).
async function injectCard() {
  const wrap = document.querySelector('#app .wrap');
  if (!wrap || document.getElementById('p27Card')) return;
  css();
  const card = document.createElement('div');
  card.className = 'card'; card.id = 'p27Card';
  card.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between"><div><h2 style="margin:0">📈 Student Progress</h2><p class="muted small" style="margin:4px 0 0">Is each student improving? Mistakes fixed, old mistakes answered right on the second chance, exam trend.</p></div>
    <div class="actions"><button onclick="progressHome()">Open Student Progress</button></div></div>`;
  const first = wrap.querySelector('.card');
  if (first && first.nextSibling) wrap.insertBefore(card, first.nextSibling); else wrap.appendChild(card);
}
(function hook() {
  const orig = root.teacherHome;
  if (typeof orig !== 'function' || orig.__v27) return;
  const w = async function (...args) {
    const r = await orig.apply(this, args);
    try { if (!(typeof schoolTeacherMode !== 'undefined' && schoolTeacherMode)) await injectCard(); } catch (_) {}
    return r;
  };
  w.__v27 = true; root.teacherHome = w;
})();

Object.assign(root, { progressHome, progressStudent, progressBack, progressFilter, progressExcel, v27TabProgress, __progress: { reason, P } });
})(typeof window !== 'undefined' ? window : globalThis);
