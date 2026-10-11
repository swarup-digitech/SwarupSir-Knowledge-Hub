/* Swarup Sir's Knowledge Hub — Custom Adaptive Assignment (V15)
 * Teacher-controlled adaptive assignments for JNVST and School courses.
 * Loaded by main.html right after teacher-app.js (teacher login only).
 *
 *   1. See every student's performance (accuracy, weak areas, active mistakes)
 *   2. Tick one student, a few, or a whole class
 *   3. Choose subject / area, how many questions, how much from mistakes (0–100%)
 *   4. Preview each student's personal set, remove / swap / add questions
 *   5. Assign: every student gets their own assignment
 *
 * It reuses the same tables, columns and student view as the existing automatic
 * adaptive assignments, so no database migration is needed.
 */
(function(root){
'use strict';

/* ======================= pure helpers (unit-tested) ======================= */
function isCorrectWord(v){return ['true','t','1','correct','right','yes','y'].includes(String(v==null?'':v).toLowerCase());}

// perf: {attempts,wrong,correct,lastWrong,streak,lastResult}
function isActiveMistake(p,isSchool){
  if(!p||!(p.wrong>0))return false;
  if(isSchool)return !isCorrectWord(p.lastResult);          // fixed once the last answer was correct
  return (Number(p.streak)||0)<2;                           // JNVST: fixed after 2 correct in a row
}
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
function varKey(q){return String(q&&q.variation_group||'').trim().toLowerCase();}

/* Build one student's question set.
 * pool      normalised questions [{id,area,topic,variation_group,...}]
 * perfMap   Map(questionId -> perf)
 * scheduled Set(questionId) already given to this student before
 * o         {total, pct, focus:Set(area), avoid:boolean, useVariation:boolean, isSchool}
 */
function pickForStudent(pool,perfMap,scheduled,o){
  const total=Math.max(1,Math.floor(o.total)), pct=Math.min(100,Math.max(0,Number(o.pct)||0));
  const target=Math.min(total,Math.round(total*pct/100));
  const inFocus=q=>!o.focus||!o.focus.size||o.focus.has(q.area);
  const items=[], used=new Set(), groups=new Set();
  const take=(q,reason,extra)=>{
    items.push(Object.assign({q,reason},extra||{}));
    used.add(q.id); const g=varKey(q); if(g)groups.add(g);
  };
  const perfOf=id=>perfMap.get(id);

  // 1) previous mistakes, worst first (most wrong, then most recent)
  const mistakes=pool.filter(q=>isActiveMistake(perfOf(q.id),o.isSchool)&&inFocus(q))
    .sort((a,b)=>{const pa=perfOf(a.id),pb=perfOf(b.id);
      return (pb.wrong-pa.wrong)||String(pb.lastWrong||'').localeCompare(String(pa.lastWrong||''));});
  let weak=0;
  for(const w of mistakes){
    if(weak>=target)break;
    if(used.has(w.id))continue;
    const g=varKey(w); let chosen=null,reason='PREVIOUS_MISTAKE';
    if(o.useVariation&&g){
      // prefer a different, never-attempted variation of the same concept
      const alt=shuffle(pool.filter(x=>x.id!==w.id&&varKey(x)===g&&!used.has(x.id)&&!perfOf(x.id)&&!(o.avoid&&scheduled.has(x.id))));
      if(alt.length){chosen=alt[0];reason='VARIATION_OF_MISTAKE';}
    }
    if(!chosen)chosen=w;
    take(chosen,reason,{wrongCount:w?perfOf(w.id).wrong:0,wrongSourceId:w.id});
    if(g)groups.add(g);
    used.add(w.id);
    weak++;
  }

  // 2) fill the rest with fresh questions, best group first
  const rest=pool.filter(q=>!used.has(q.id));
  const notSched=q=>!(o.avoid&&scheduled.has(q.id));
  const notMistake=q=>!isActiveMistake(perfOf(q.id),o.isSchool);
  const tiers=[
    q=>inFocus(q)&&!perfOf(q.id)&&notSched(q),
    q=>inFocus(q)&&notMistake(q)&&notSched(q),
    q=>!perfOf(q.id)&&notSched(q),
    q=>notMistake(q)&&notSched(q),
    q=>notMistake(q),
    ()=>true
  ];
  for(const tier of tiers){
    if(items.length>=total)break;
    for(const q of shuffle(rest.filter(x=>!used.has(x.id)&&tier(x)))){
      if(items.length>=total)break;
      const g=varKey(q); if(g&&groups.has(g))continue;      // one question per variation group
      take(q,perfOf(q.id)?'NEW_ATTEMPTED_BEFORE':'NEW_UNSEEN');
    }
  }
  // last resort: allow a second question of a variation group
  if(items.length<total){
    for(const q of shuffle(rest.filter(x=>!used.has(x.id)))){
      if(items.length>=total)break;
      take(q,perfOf(q.id)?'NEW_ATTEMPTED_BEFORE':'NEW_UNSEEN');
    }
  }
  return {items,weakCount:items.filter(x=>x.reason==='PREVIOUS_MISTAKE'||x.reason==='VARIATION_OF_MISTAKE').length,short:Math.max(0,total-items.length)};
}

function studentStats(perfMap,isSchool){
  let attempts=0,correct=0,wrong=0,active=0;
  perfMap.forEach(p=>{attempts+=p.attempts;correct+=p.correct;wrong+=p.wrong;if(isActiveMistake(p,isSchool))active++;});
  return {attempts,correct,wrong,active,accuracy:attempts?Math.round(correct*100/attempts):null,questions:perfMap.size};
}

function areaStats(perfMap,catalogById,isSchool){
  const m=new Map();
  perfMap.forEach((p,id)=>{
    const q=catalogById.get(id); if(!q)return;
    const a=q.area||'Unspecified'; const x=m.get(a)||{area:a,attempts:0,correct:0,wrong:0,active:0};
    x.attempts+=p.attempts;x.correct+=p.correct;x.wrong+=p.wrong;if(isActiveMistake(p,isSchool))x.active++;
    m.set(a,x);
  });
  return [...m.values()].map(x=>Object.assign(x,{accuracy:x.attempts?Math.round(x.correct*100/x.attempts):null}))
    .sort((a,b)=>(a.accuracy==null)-(b.accuracy==null)||a.accuracy-b.accuracy||b.active-a.active);
}

const api={isCorrectWord,isActiveMistake,pickForStudent,studentStats,areaStats};
if(typeof module!=='undefined'&&module.exports){module.exports=api;}
if(typeof window==='undefined')return;   // node: stop here (UI below needs the browser)

/* ============================== browser UI =============================== */
const CA={api};
root.CA_API=api;
let S=null;   // state of the open screen

const chunk=(a,n)=>{const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;};
async function fetchAll(make){
  const out=[];
  for(let from=0;;from+=1000){
    const {data,error}=await make(from,from+999);
    if(error)throw error;
    out.push(...(data||[]));
    if(!data||data.length<1000)break;
  }
  return out;
}
async function inChunks(ids,fn){
  const out=[];
  for(const c of chunk([...new Set(ids)],80)){out.push(...await fn(c));}
  return out;
}
const q$=id=>document.getElementById(id);
const snippet=(t,n=90)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1)+'…':t;};
// Question text for display. Math written as LaTeX ($..$, \\(..\\), \\frac{}{} ...) is converted by the
// app's own jnvstMathPreview() and then typeset by MathJax (see typeset()). Text containing math is
// never cut short, because cutting would break the formula.
const hasMath=t=>/\$|\\\(|\\\[|\\[a-zA-Z]+/.test(String(t||''));
function qHtml(t){
  t=String(t||'');
  const shown=hasMath(t)?t:snippet(t,90);
  return typeof jnvstMathPreview==='function'?jnvstMathPreview(shown):esc(shown);
}
function typeset(){
  const nodes=['caPreview','caProfile'].map(id=>q$(id)).filter(Boolean);
  if(typeof jnvstTypesetWhenReady==='function')jnvstTypesetWhenReady(nodes);
  else if(window.MathJax&&window.MathJax.typesetPromise)window.MathJax.typesetPromise(nodes).catch(()=>{});
}
const REASON={
  PREVIOUS_MISTAKE:['Mistake','#fee2e2','#991b1b'],
  VARIATION_OF_MISTAKE:['Variation of mistake','#ffedd5','#9a3412'],
  NEW_UNSEEN:['New','#dcfce7','#166534'],
  NEW_ATTEMPTED_BEFORE:['Seen before','#e0e7ff','#3730a3'],
  TEACHER_ADDED:['Added by you','#f3e8ff','#6b21a8']
};
const tag=(r)=>{const x=REASON[r]||[r,'#e5e7eb','#374151'];return `<span class="tag" style="background:${x[1]};color:${x[2]}">${esc(x[0])}</span>`;};

/* ------------------------------ data loading ------------------------------ */
async function loadData(){
  const school=!!schoolTeacherMode;
  const classes=(await fetchAll((a,b)=>sb.from('classes').select('id,name,course,jnvst_parent_id,jnvst_group_type').eq('teacher_id',current.id).order('id').range(a,b)))
    .filter(c=>school?String(c.course||'').toUpperCase()==='SCHOOL':String(c.course||'').toUpperCase().startsWith('JNVST'));
  const classIds=classes.map(c=>c.id);
  const members=classIds.length?await inChunks(classIds,ids=>fetchAll((a,b)=>sb.from('class_students').select('class_id,student_id').in('class_id',ids).order('class_id').order('student_id').range(a,b))):[];
  const classOf=new Map();members.forEach(m=>{if(!classOf.has(m.student_id))classOf.set(m.student_id,m.class_id);});
  const studentIds=[...classOf.keys()];
  const profs=studentIds.length?await inChunks(studentIds,ids=>fetchAll((a,b)=>sb.from('profiles').select('id,full_name,roll_no,course,school_group_id').in('id',ids).order('id').range(a,b))):[];
  const students=profs.filter(p=>!school||String(p.course||'').toUpperCase()==='SCHOOL')
    .map(p=>Object.assign({},p,{class_id:classOf.get(p.id)})).sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),undefined,{numeric:true}));

  // performance
  const perf=new Map();students.forEach(s=>perf.set(s.id,new Map()));
  const rows=students.length?await inChunks(students.map(s=>s.id),ids=>fetchAll((a,b)=>school
    ?sb.from('school_student_question_performance').select('student_id,source_school_question_bank_id,attempt_count,wrong_count,correct_count,last_result,last_wrong_at').in('student_id',ids).order('id').range(a,b)
    :sb.from('student_question_performance').select('student_id,mock_question_id,attempt_count,wrong_count,correct_count,correct_streak,last_result,last_wrong_at').in('student_id',ids).order('id').range(a,b))):[];
  rows.forEach(r=>{
    const qid=school?r.source_school_question_bank_id:r.mock_question_id;
    perf.get(r.student_id)?.set(qid,{attempts:+r.attempt_count||0,wrong:+r.wrong_count||0,correct:+r.correct_count||0,streak:+r.correct_streak||0,lastWrong:r.last_wrong_at,lastResult:r.last_result});
  });

  // question catalogue
  let catalog=[],chapters=[],groups=[];
  if(school){
    groups=await fetchAll((a,b)=>sb.from('school_course_groups').select('id,name,class_id').eq('teacher_id',current.id).order('id').range(a,b));
    await ensureSchoolSubjects();
    chapters=await fetchAll((a,b)=>sb.from('school_question_bank_chapters').select('id,chapter_number,chapter_name,subject_id').eq('teacher_id',current.id).order('id').range(a,b));
    const chName=new Map(chapters.map(c=>[c.id,`Ch ${c.chapter_number} · ${c.chapter_name}`]));
    const qs=await fetchAll((a,b)=>sb.from('school_question_bank_questions').select('id,chapter_id,topic,subject_id,medium,variation_group,question_text_en,question_text_as,question_type').eq('teacher_id',current.id).eq('course_type','SCHOOL').eq('question_type','MCQ').order('id').range(a,b));
    catalog=qs.map(q=>({id:q.id,area:chName.get(q.chapter_id)||q.topic||'Unspecified',topic:q.topic||'',variation_group:q.variation_group,subject_id:q.subject_id,medium:q.medium||'',text:q.question_text_en||q.question_text_as||'[Image question]'}));
  }else{
    const qs=await fetchAll((a,b)=>sb.from('mock_question_bank').select('id,question_text,option_a,option_b,option_c,option_d,correct_option,image_url,topic,language,passage_id,part_code,variation_group,question_order').eq('teacher_id',current.id).eq('active',true).order('id').range(a,b));
    catalog=qs.filter(q=>!String(q.passage_id||'').trim()&&!/PASSAGE/i.test(String(q.part_code||'')))
      .map(q=>Object.assign({},q,{area:q.part_code||'Other',text:q.image_url&&!q.question_text?'[Image question]':q.question_text}));
  }
  return {school,classes,students,perf,catalog,catalogById:new Map(catalog.map(q=>[q.id,q])),chapters,groups};
}

/* -------------------------------- screens --------------------------------- */
async function customAdaptiveHome(){
  render(`<div class="wrap">${header('Custom Adaptive Assignment')}<div class="card"><p class="muted">Loading students and performance…</p></div></div>`);
  try{
    const d=await loadData();
    S=Object.assign(d,{selected:new Set(),focus:new Set(),plans:new Map(),profileId:null});
    paint();
  }catch(e){
    render(`<div class="wrap">${header('Custom Adaptive Assignment')}<div class="card">${message('Could not load data: '+(e.message||e))}</div></div>`);
  }
}

function backAction(){return S&&S.school?'schoolAssignmentManagement()':'teacherHome()';}

function paint(){
  const school=S.school;
  const classOpts=S.classes.map(c=>{
    const parent=S.classes.find(x=>x.id===c.jnvst_parent_id);
    return `<option value="${esc(c.id)}">${esc(parent?parent.name+' › '+c.name:c.name)}</option>`;
  }).join('');
  const subjects=school?(schoolSubjects||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''):'';
  const mediums=school?[...new Set(S.catalog.map(q=>q.medium).filter(Boolean))].map(m=>`<option>${esc(m)}</option>`).join(''):'';
  const parts=!school?[...new Set(S.catalog.map(q=>q.area))].sort().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join(''):'';
  const langs=!school?[...new Set(S.catalog.map(q=>String(q.language||'').toUpperCase()).filter(Boolean))].map(l=>`<option>${esc(l)}</option>`).join(''):'';
  render(`<div class="wrap">${header('Custom Adaptive Assignment')}
  <div class="card" style="border:2px solid #7c3aed;background:#faf5ff">
    <h2 style="margin:0">🎯 Custom Adaptive Assignment — ${school?'School Course':'JNVST'}</h2>
    <p class="muted" style="margin:6px 0 0">Look at each student's performance, choose who gets an assignment and what it focuses on, review the personal question set, then assign. Every student receives their own assignment.</p>
  </div>

  <div class="card"><h2 style="margin-top:0">1. Choose students</h2>
    <div class="grid">
      <div><label>Class / Group</label><select id="caClass" onchange="caFilter()"><option value="">All</option>${classOpts}</select></div>
      <div><label>Search name or roll no.</label><input id="caSearch" oninput="caFilter()" placeholder="Type to search"></div>
      <div><label>Show</label><select id="caShow" onchange="caFilter()"><option value="">All students</option><option value="mistakes">With active mistakes</option><option value="low">Accuracy below 60%</option><option value="none">No attempts yet</option></select></div>
    </div>
    <div class="actions" style="margin:10px 0"><button class="secondary" onclick="caSelectVisible(true)">☑ Select shown</button><button class="secondary" onclick="caSelectVisible(false)">☐ Clear shown</button><span id="caSelCount" class="tag">0 selected</span></div>
    <div id="caStudents" style="overflow:auto;max-height:420px"></div>
  </div>

  <div class="card" id="caProfileCard" style="display:none"><div id="caProfile"></div></div>

  <div class="card"><h2 style="margin-top:0">2. Assignment settings</h2>
    <div class="grid">
      <div><label>Title *</label><input id="caTitle" placeholder="e.g. Personal practice — Week 3"></div>
      ${school
        ?`<div><label>Subject *</label><select id="caSubject" onchange="caPoolChanged()">${subjects||'<option value="">No subjects</option>'}</select></div>
          <div><label>Medium</label><select id="caMedium" onchange="caPoolChanged()"><option value="">Any</option>${mediums}</select></div>
          <div><label>Question language</label><select id="caLang" onchange="caLangChanged()"><option value="EN">English</option><option value="AS">Assamese</option><option value="BOTH">Both</option></select></div>`
        :`<div><label>Subject (label)</label><input id="caSubject" placeholder="e.g. Mixed practice"></div>
          <div><label>Part / Area</label><select id="caPart" onchange="caPoolChanged()"><option value="">All parts</option>${parts}</select></div>
          <div><label>Language</label><select id="caLangFilter" onchange="caPoolChanged()"><option value="">Any</option>${langs}</select></div>`}
      <div><label>Questions per student *</label><input id="caTotal" type="number" min="1" max="100" value="20"></div>
      <div><label>From mistakes (%)</label><input id="caPct" type="number" min="0" max="100" value="60"><div class="small muted">0–100. If a student has fewer mistakes, the rest are new questions.</div></div>
    </div>
    <div style="margin-top:8px"><label style="font-weight:400"><input type="checkbox" id="caAvoid" checked style="width:auto;margin-right:8px">Avoid new questions already given to that student before</label>
    <label style="font-weight:400"><input type="checkbox" id="caVar" checked style="width:auto;margin-right:8px">When a question has a Variation Group, ask a fresh variation instead of the exact mistake</label></div>
    <div style="margin-top:8px"><b>Focus areas</b> <span class="muted small">(optional — limits mistakes and new questions to these ${school?'chapters':'parts'}; tick them from a student's profile or here)</span>
      <div id="caFocus" class="actions" style="margin-top:6px"></div></div>
    <div class="actions" style="margin-top:14px"><button onclick="caGenerate()">⚙ Generate personal sets</button><button class="secondary" onclick="${backAction()}">← Back</button></div>
  </div>

  <div id="caPreview"></div></div>`);
  caFilter();paintFocus();
}

function allAreas(){return [...new Set(S.catalog.map(q=>q.area))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));}
function paintFocus(){
  const box=q$('caFocus');if(!box)return;
  box.innerHTML=allAreas().map(a=>{
    const on=S.focus.has(a);
    return `<button type="button" class="${on?'':'secondary'}" style="padding:5px 10px;font-size:13px" onclick="caToggleFocus(this.dataset.a)" data-a="${esc(a)}">${on?'✓ ':''}${esc(a)}</button>`;
  }).join('')||'<span class="muted small">No questions in the question bank yet.</span>';
}
function caToggleFocus(a){S.focus.has(a)?S.focus.delete(a):S.focus.add(a);paintFocus();}

function visibleStudents(){
  const cls=q$('caClass')?.value||'',txt=String(q$('caSearch')?.value||'').trim().toLowerCase(),show=q$('caShow')?.value||'';
  const inClass=id=>{
    if(!cls)return true;
    if(id===cls)return true;
    return S.classes.some(c=>c.id===id&&c.jnvst_parent_id===cls);
  };
  return S.students.filter(s=>{
    if(!inClass(s.class_id))return false;
    if(txt&&!(String(s.full_name||'').toLowerCase().includes(txt)||String(s.roll_no||'').toLowerCase().includes(txt)))return false;
    const st=studentStats(S.perf.get(s.id),S.school);
    if(show==='mistakes'&&!st.active)return false;
    if(show==='low'&&!(st.accuracy!=null&&st.accuracy<60))return false;
    if(show==='none'&&st.attempts)return false;
    return true;
  });
}
function caFilter(){
  const list=visibleStudents();
  const rows=list.map(s=>{
    const st=studentStats(S.perf.get(s.id),S.school);
    const acc=st.accuracy==null?'—':st.accuracy+'%';
    const col=st.accuracy==null?'#64748b':st.accuracy<50?'#b91c1c':st.accuracy<70?'#b45309':'#15803d';
    return `<tr><td><input type="checkbox" style="width:auto" ${S.selected.has(s.id)?'checked':''} onchange="caToggleStudent('${esc(s.id)}',this.checked)"></td>
      <td>${esc(s.full_name||'Student')}</td><td>${esc(s.roll_no||'')}</td><td>${st.attempts}</td>
      <td style="font-weight:700;color:${col}">${acc}</td><td>${st.active?`<span class="tag" style="background:#fee2e2;color:#991b1b">${st.active}</span>`:'0'}</td>
      <td><button class="secondary" style="padding:5px 10px;font-size:13px" onclick="caProfile('${esc(s.id)}')">Profile</button></td></tr>`;
  }).join('');
  q$('caStudents').innerHTML=list.length
    ?`<table><thead><tr><th></th><th>Student</th><th>Roll</th><th>Answers</th><th>Accuracy</th><th>Active mistakes</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    :'<p class="muted">No students match.</p>';
  updateCount();
}
function updateCount(){const n=S.selected.size;const el=q$('caSelCount');if(el)el.textContent=n+' selected';}
function caToggleStudent(id,on){on?S.selected.add(id):S.selected.delete(id);updateCount();}
function caSelectVisible(on){visibleStudents().forEach(s=>on?S.selected.add(s.id):S.selected.delete(s.id));caFilter();}

function caProfile(id){
  const s=S.students.find(x=>x.id===id);if(!s)return;
  S.profileId=id;
  const pm=S.perf.get(id),st=studentStats(pm,S.school),areas=areaStats(pm,S.catalogById,S.school);
  const weak=[...pm.entries()].filter(([,p])=>p.wrong>0).sort((a,b)=>b[1].wrong-a[1].wrong).slice(0,15);
  const tile=(l,v)=>`<div class="card" style="margin:0"><div class="muted">${l}</div><div style="font-size:26px;font-weight:800">${v}</div></div>`;
  q$('caProfileCard').style.display='block';
  q$('caProfile').innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><h2 style="margin:0">${esc(s.full_name||'Student')} ${s.roll_no?`<span class="muted">(${esc(s.roll_no)})</span>`:''}</h2>
    <div class="actions"><button onclick="caToggleStudent('${esc(id)}',true);caFilter()">＋ Select for assignment</button><button class="secondary" onclick="q$('caProfileCard').style.display='none'">Close</button></div></div>
    <div class="grid" style="margin:12px 0">${tile('Accuracy',st.accuracy==null?'—':st.accuracy+'%')}${tile('Answers recorded',st.attempts)}${tile('Questions seen',st.questions)}${tile('Active mistakes',st.active)}</div>
    <h3>${S.school?'Chapters':'Parts'} — weakest first</h3>
    ${areas.length?`<div style="overflow:auto"><table><thead><tr><th>${S.school?'Chapter':'Part'}</th><th>Answers</th><th>Accuracy</th><th>Active mistakes</th><th></th></tr></thead><tbody>${areas.map(a=>`<tr><td>${esc(a.area)}</td><td>${a.attempts}</td><td>${a.accuracy==null?'—':a.accuracy+'%'}</td><td>${a.active}</td><td><button class="secondary" style="padding:4px 9px;font-size:12px" data-a="${esc(a.area)}" onclick="caToggleFocus(this.dataset.a)">${S.focus.has(a.area)?'✓ In focus':'Focus on this'}</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No recorded answers for this student yet.</p>'}
    <h3>Most frequently wrong questions</h3>
    ${weak.length?`<table><thead><tr><th>Question</th><th>${S.school?'Chapter':'Part'}</th><th>Wrong</th><th>Status</th></tr></thead><tbody>${weak.map(([qid,p])=>{const q=S.catalogById.get(qid);return `<tr><td class="ca-q">${q?qHtml(q.text):'(question no longer in bank)'}</td><td>${esc(q?q.area:'')}</td><td>${p.wrong}</td><td>${isActiveMistake(p,S.school)?'<span class="tag" style="background:#fee2e2;color:#991b1b">Active</span>':'<span class="tag" style="background:#dcfce7;color:#166534">Fixed</span>'}</td></tr>`}).join('')}</tbody></table>`:'<p class="muted">No mistakes recorded.</p>'}`;
  typeset();
  q$('caProfileCard').scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ------------------------------ generating -------------------------------- */
function currentPool(){
  if(S.school){
    const sub=q$('caSubject')?.value||'',med=q$('caMedium')?.value||'';
    return S.catalog.filter(q=>(!sub||String(q.subject_id)===String(sub))&&(!med||q.medium===med));
  }
  const part=q$('caPart')?.value||'',lang=String(q$('caLangFilter')?.value||'').toUpperCase();
  return S.catalog.filter(q=>(!part||q.area===part)&&(!lang||String(q.language||'').toUpperCase()===lang));
}
function caPoolChanged(){if(S.plans.size){S.plans=new Map();q$('caPreview').innerHTML='<div class="notice">Settings changed — generate the personal sets again.</div>';}}

async function scheduledFor(studentIds){
  const out=new Map();studentIds.forEach(id=>out.set(id,new Set()));
  const col=S.school?'source_school_question_bank_id':'source_mock_question_id';
  const links=await inChunks(studentIds,ids=>fetchAll((a,b)=>sb.from('assignment_students').select('assignment_id,student_id').in('student_id',ids).order('assignment_id').order('student_id').range(a,b)));
  const aids=[...new Set(links.map(l=>l.assignment_id))];if(!aids.length)return out;
  const mine=await inChunks(aids,ids=>fetchAll((a,b)=>sb.from('assignments').select('id').in('id',ids).eq('created_by',current.id).order('id').range(a,b)));
  const valid=new Set(mine.map(a=>a.id));
  const qs=await inChunks([...valid],ids=>fetchAll((a,b)=>sb.from('questions').select('assignment_id,'+col).in('assignment_id',ids).not(col,'is',null).order('id').range(a,b)));
  const byA=new Map();links.forEach(l=>{if(!valid.has(l.assignment_id))return;(byA.get(l.assignment_id)||byA.set(l.assignment_id,new Set()).get(l.assignment_id)).add(l.student_id);});
  qs.forEach(q=>(byA.get(q.assignment_id)||[]).forEach(sid=>out.get(sid)?.add(q[col])));
  return out;
}

function settings(){
  const total=Math.floor(Number(q$('caTotal')?.value));
  return {total,pct:Number(q$('caPct')?.value),avoid:!!q$('caAvoid')?.checked,useVariation:!!q$('caVar')?.checked,focus:new Set(S.focus),isSchool:S.school};
}
async function caGenerate(){
  const o=settings();
  if(!S.selected.size)return notify('Select at least one student.');
  if(!(o.total>=1&&o.total<=100))return notify('Questions per student must be between 1 and 100.');
  if(!(o.pct>=0&&o.pct<=100))return notify('From mistakes (%) must be between 0 and 100.');
  if(S.school&&!q$('caSubject')?.value)return notify('Select a Subject.');
  const pool=currentPool();
  if(!pool.length)return notify('No questions match the chosen subject/part. Change the filters.');
  if(o.total>pool.length)return notify(`Only ${pool.length} questions match the filters. Reduce "Questions per student" or widen the filters.`);
  q$('caPreview').innerHTML='<div class="card"><p class="muted">Building personal sets…</p></div>';
  try{
    const ids=[...S.selected];
    const sched=o.avoid?await scheduledFor(ids):new Map(ids.map(i=>[i,new Set()]));
    S.plans=new Map();S.pool=pool;
    ids.forEach(id=>{
      const r=pickForStudent(pool,S.perf.get(id),sched.get(id)||new Set(),o);
      S.plans.set(id,{items:r.items,short:r.short});
    });
    S.sched=sched;S.opts=o;S.snaps=new Map();
    await ensureSnaps([...S.plans.values()].flatMap(p=>p.items.map(x=>x.q.id)));
    paintPreview();
  }catch(e){q$('caPreview').innerHTML=`<div class="card">${message('Could not generate: '+(e.message||e))}</div>`;}
}

/* Full display data of a question: image + real text + options (+ correct option).
 * JNVST: from the catalogue. School: from snapshots loaded for the chosen questions. */
const PLACEHOLDER_Q=/^\[(?:PDF\/)?IMAGE QUESTION[^\]]*\]$/i, PLACEHOLDER_OPT=/^Option [A-D]$/i;
const realQ=t=>{t=String(t==null?'':t).trim();return t&&!PLACEHOLDER_Q.test(t)?t:'';};
const realO=t=>{t=String(t==null?'':t).trim();return t&&!PLACEHOLDER_OPT.test(t)?t:'';};
function displayOf(q){
  const src=S.school?(S.snaps&&S.snaps.get(q.id)):S.catalogById.get(q.id);
  if(!src)return {image:'',text:realQ(q.text),opts:['','','',''],correct:'',loading:S.school};
  return {image:src.image_url||'',text:realQ(src.question_text),opts:[src.option_a,src.option_b,src.option_c,src.option_d].map(realO),correct:String(src.correct_option||'').toUpperCase()};
}
function questionCell(q){
  const d=displayOf(q);
  const img=d.image?`<img src="${esc(d.image)}" alt="Question image" loading="lazy" style="display:block;max-width:100%;width:340px;max-height:240px;object-fit:contain;border:1px solid #cbd5e1;border-radius:6px;padding:3px;background:#fff;margin:0 0 6px">`:'';
  const txt=d.text?`<div style="line-height:1.45">${typeof jnvstMathPreview==='function'?jnvstMathPreview(d.text):esc(d.text)}</div>`:'';
  const opts=d.opts.some(Boolean)?`<div class="small" style="margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:3px 14px">${d.opts.map((o,i)=>{const L='ABCD'[i];const ok=d.correct===L;return o?`<div style="${ok?'font-weight:700;color:#166534':''}">${L}. ${typeof jnvstMathPreview==='function'?jnvstMathPreview(o):esc(o)}${ok?' ✓':''}</div>`:'';}).join('')}</div>`:(d.image&&d.correct?`<div class="small muted" style="margin-top:4px">Options are in the image · correct: <b>${esc(d.correct)}</b></div>`:'');
  const body=img+txt+opts;
  return body||`<span class="muted">${d.loading?'Loading…':'[Image question]'}</span>`;
}
async function ensureSnaps(ids){
  if(!S.school)return;
  const lang=q$('caLang')?.value||'EN';
  const need=[...new Set(ids)].filter(id=>!(S.snaps&&S.snaps.has(id)));
  if(!need.length)return;
  const m=await loadSchoolAdaptiveSnapshots(need,lang);
  S.snaps=S.snaps||new Map();m.forEach((v,k)=>S.snaps.set(k,v));
}
async function caLangChanged(){
  if(!S.school||!S.plans.size)return;
  S.snaps=new Map();
  try{await ensureSnaps([...S.plans.values()].flatMap(p=>p.items.map(x=>x.q.id)));}catch(e){notify('Could not reload questions: '+(e.message||e));}
  paintPreview();
}
function paintPreview(){
  const blocks=[...S.plans.entries()].map(([sid,plan])=>{
    const s=S.students.find(x=>x.id===sid)||{};
    const weak=plan.items.filter(x=>x.reason==='PREVIOUS_MISTAKE'||x.reason==='VARIATION_OF_MISTAKE').length;
    const rows=plan.items.map((it,i)=>`<tr><td>${i+1}</td><td>${tag(it.reason)}</td><td class="ca-q" style="min-width:260px">${questionCell(it.q)}</td><td class="small muted">${esc(it.q.area)}</td>
      <td style="white-space:nowrap"><button class="secondary" style="padding:4px 9px;font-size:12px" title="Replace with another question" onclick="caSwap('${esc(sid)}',${i})">⇄</button> <button class="danger" style="padding:4px 9px;font-size:12px" title="Remove" onclick="caRemove('${esc(sid)}',${i})">✕</button></td></tr>`).join('');
    return `<details class="card" ${S.plans.size<=3?'open':''}><summary style="cursor:pointer;font-weight:700">${esc(s.full_name||'Student')} ${s.roll_no?`(${esc(s.roll_no)})`:''} — ${plan.items.length} questions · ${weak} from mistakes${plan.short?` · <span style="color:#b91c1c">${plan.short} short</span>`:''}</summary>
      <div style="overflow:auto;margin-top:8px"><table><thead><tr><th>#</th><th>Why</th><th>Question</th><th>${S.school?'Chapter':'Part'}</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="muted">No questions.</td></tr>'}</tbody></table></div>
      <div class="actions" style="margin-top:8px"><button class="secondary" onclick="caAdd('${esc(sid)}')">＋ Add a question</button></div></details>`;
  }).join('');
  q$('caPreview').innerHTML=`<div class="card" style="border:2px solid #16a34a;background:#f0fdf4"><h2 style="margin:0">3. Review & assign</h2><p class="muted" style="margin:6px 0 0">Each student below gets a separate assignment. Remove (✕), replace (⇄) or add questions as you like.</p></div>${blocks}
    <div class="card"><div class="actions"><button onclick="caAssign()">✔ Assign to ${S.plans.size} student${S.plans.size===1?'':'s'}</button><button class="secondary" onclick="caGenerate()">↻ Regenerate all</button></div><div id="caResult"></div></div>`;
  typeset();
}
function candidatesFor(sid,plan,sameArea){
  const have=new Set(plan.items.map(x=>x.q.id));
  const pm=S.perf.get(sid),sched=S.sched.get(sid)||new Set(),o=S.opts;
  let c=S.pool.filter(q=>!have.has(q.id)&&!isActiveMistake(pm.get(q.id),S.school));
  const fresh=c.filter(q=>!pm.has(q.id)&&!(o.avoid&&sched.has(q.id)));
  if(fresh.length)c=fresh;
  const inArea=sameArea?c.filter(q=>q.area===sameArea):[];
  return inArea.length?inArea:c;
}
async function caSwap(sid,i){
  const plan=S.plans.get(sid),old=plan.items[i];if(!old)return;
  const c=candidatesFor(sid,plan,old.q.area);
  if(!c.length)return notify('No other questions are available to swap in.');
  const q=c[Math.floor(Math.random()*c.length)];
  try{await ensureSnaps([q.id]);}catch(e){return notify('Could not load the question: '+(e.message||e));}
  plan.items[i]={q,reason:S.perf.get(sid).has(q.id)?'NEW_ATTEMPTED_BEFORE':'NEW_UNSEEN'};
  paintPreview();
}
function caRemove(sid,i){const plan=S.plans.get(sid);plan.items.splice(i,1);plan.short=Math.max(0,S.opts.total-plan.items.length);paintPreview();}
async function caAdd(sid){
  const plan=S.plans.get(sid),c=candidatesFor(sid,plan,null);
  if(!c.length)return notify('No more questions are available to add.');
  const q=c[Math.floor(Math.random()*c.length)];
  try{await ensureSnaps([q.id]);}catch(e){return notify('Could not load the question: '+(e.message||e));}
  plan.items.push({q,reason:'TEACHER_ADDED'});plan.short=Math.max(0,S.opts.total-plan.items.length);paintPreview();
}

/* -------------------------------- assigning ------------------------------- */
function newBatchId(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^(crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4)).toString(16));}
async function caAssign(){
  const title=String(q$('caTitle')?.value||'').trim();
  if(!title)return notify('Enter an assignment title (Settings → Title).');
  const empty=[...S.plans.entries()].filter(([,p])=>!p.items.length);
  if(empty.length)return notify('Some students have no questions. Add questions or remove them from the selection.');
  const subjectId=S.school?(q$('caSubject')?.value||''):'';
  if(S.school&&!subjectId)return notify('Select a Subject.');
  const subjectName=S.school?((schoolSubjects||[]).find(x=>String(x.id)===String(subjectId))?.name||''):String(q$('caSubject')?.value||'').trim();
  if(!confirm(`Create ${S.plans.size} personal assignment(s) titled "${title}"?\n\nEach selected student receives their own question set.`))return;
  const resBox=q$('caResult');resBox.innerHTML='<p class="muted">Creating assignments…</p>';
  const lang=q$('caLang')?.value||'EN';
  const batchId=newBatchId(),created=[],errors=[];
  try{
    let snaps=new Map();
    if(S.school){
      const ids=[...new Set([...S.plans.values()].flatMap(p=>p.items.map(x=>x.q.id)))];
      snaps=await loadSchoolAdaptiveSnapshots(ids,lang);   // fresh copy in the chosen language
    }
    for(const [sid,plan] of S.plans){
      const s=S.students.find(x=>x.id===sid)||{},name=s.full_name||sid;
      const cls=S.classes.find(c=>c.id===s.class_id)||{};
      const parent=S.classes.find(c=>c.id===cls.jnvst_parent_id);
      const grp=S.school?(schoolGroupName(s)):(parent?cls.name:'');
      const mainGroup=S.school?(cls.name||'School Class'):(parent?parent.name:(cls.name||'JNVST Main Group'));
      const weak=plan.items.filter(x=>x.reason==='PREVIOUS_MISTAKE'||x.reason==='VARIATION_OF_MISTAKE').length;
      const row={class_id:s.class_id,title,subject:subjectName,description:'',video_url:null,assignment_type:'MCQ',time_limit:null,shuffle_questions:false,shuffle_options:false,
        main_group:mainGroup,sub_group:grp,created_by:current.id,
        adaptive_mode:true,adaptive_max_percent:Math.round(S.opts.pct),adaptive_batch_id:batchId,adaptive_for_student_id:sid,
        adaptive_weakness_count:weak,adaptive_normal_count:plan.items.length-weak,
        adaptive_selection_summary:{course:S.school?'SCHOOL':'JNVST',custom:true,student_name:name,roll_no:s.roll_no||'',requested_percent:S.opts.pct,focus:[...S.opts.focus],total:plan.items.length}};
      if(S.school)row.school_subject_id=subjectId;
      const {data:a,error:ae}=await sb.from('assignments').insert(row).select('id').single();
      if(ae){errors.push(`${name}: ${ae.message}`);continue;}
      const qs=plan.items.map((it,i)=>S.school?questionRowSchool(snaps,it,a.id,i):questionRowJnvst(it,a.id,i)).filter(Boolean);
      if(qs.length!==plan.items.length){await sb.from('assignments').delete().eq('id',a.id);errors.push(`${name}: some questions could not be read from the question bank`);continue;}
      const {error:qe}=await sb.from('questions').insert(qs);
      if(qe){await sb.from('assignments').delete().eq('id',a.id);errors.push(`${name}: could not save questions — ${qe.message}`);continue;}
      const {error:re}=await sb.from('assignment_students').insert({assignment_id:a.id,student_id:sid});
      if(re){await sb.from('questions').delete().eq('assignment_id',a.id);await sb.from('assignments').delete().eq('id',a.id);errors.push(`${name}: could not assign — ${re.message}`);continue;}
      created.push(sid);
    }
  }catch(e){errors.push(e.message||String(e));}
  created.forEach(id=>{S.plans.delete(id);S.selected.delete(id);});
  resBox.innerHTML=`${created.length?message(`Created ${created.length} personal assignment${created.length===1?'':'s'}.`,true):''}${errors.length?message('Not created:\n'+errors.join('\n')):''}
    <div class="actions" style="margin-top:8px"><button class="secondary" onclick="${backAction()}">← Done</button></div>`;
  if(created.length){updateCount();caFilter();}
}
function schoolGroupName(s){
  const g=(S.groups||[]).find(x=>x.id===s.school_group_id);
  return g?g.name:'';
}
function questionRowJnvst(it,aid,i){
  const q=S.catalogById.get(it.q.id);if(!q)return null;
  const img=!!q.image_url;
  // With an image, keep the real question text and option texts when the bank has them;
  // otherwise use the app's placeholders (the picture then contains everything).
  const qt=img?(realQ(q.question_text)||'[IMAGE QUESTION]'):(q.question_text||'');
  const op=(v,L)=>img?(realO(v)||'Option '+L):v;
  return {assignment_id:aid,question_text:qt,option_a:op(q.option_a,'A'),option_b:op(q.option_b,'B'),option_c:op(q.option_c,'C'),option_d:op(q.option_d,'D'),
    correct_option:q.correct_option,question_order:i+1,image_url:q.image_url||null,explanation:null,source_mock_question_id:q.id,source_variation_group:q.variation_group||null,source_topic:q.topic||null,
    adaptive_selection_reason:it.reason,adaptive_source_wrong_question_id:null,adaptive_source_wrong_count:it.wrongCount||0};
}
function questionRowSchool(snaps,it,aid,i){
  const snap=snaps.get(it.q.id);if(!snap)return null;
  return Object.assign({},snap,{assignment_id:aid,question_order:i+1,adaptive_selection_reason:it.reason,adaptive_source_wrong_question_id:it.wrongSourceId||null,adaptive_source_wrong_count:it.wrongCount||0});
}

Object.assign(root,{customAdaptiveHome,caFilter,caSelectVisible,caToggleStudent,caToggleFocus,caProfile,caPoolChanged,caLangChanged,caGenerate,caSwap,caRemove,caAdd,caAssign,q$});
})(typeof window!=='undefined'?window:globalThis);
