/* Swarup Sir's Knowledge Hub — Custom Test (V23)
 * The teacher chooses the questions; every selected student gets a personal paper.
 *
 *   * A chosen question that has a Variation Group: each student gets one question of that group
 *     (a variation). Variations are spread evenly over the class, neighbours in roll order get
 *     different ones, and a student gets a variation they have not attempted / not been given before.
 *   * A chosen question without a Variation Group: the same question is in every paper.
 *   * Passages (EVS / Language) work the same way as whole 5-question units.
 *   * Every student's paper has its own question order (can be switched off).
 *   * Papers are saved like Custom Adaptive Papers (one per student, serial QSET-…-P01 …), so
 *     Personal OMR Sheets prints each student's own OMR sheet, scans it, and the import puts the
 *     mistakes into the Mistake Bank exactly as before.
 *
 * Loaded by main.html after custom-adaptive-paper.js. Needs teacher-app.js.
 */
(function(root){
'use strict';

/* ======================= pure helpers (unit-tested) ======================= */
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
const vk=q=>String(q&&q.variation_group||'').trim().toLowerCase();
const unitKeys=g=>new Set(((g&&g.questions)||[]).map(vk).filter(Boolean));
const itemKeys=it=>it.kind==='p'?unitKeys(it.g):new Set(vk(it.q)?[vk(it.q)]:[]);
const itemId=it=>it.kind==='p'?'p:'+it.g.id:'q:'+it.q.id;

// Chosen items that share a Variation Group (only one per group is allowed): [[index,index],…]
function groupConflicts(items){
  const by=new Map();
  items.forEach((it,i)=>itemKeys(it).forEach(k=>{if(!by.has(k))by.set(k,new Set());by.get(k).add(i);}));
  return [...by.entries()].filter(([,s])=>s.size>1).map(([k,s])=>({group:k,items:[...s]}));
}

// All questions / passages a chosen item may be replaced by (the item itself first).
// o: {vary:boolean, includeChosen:boolean}
function variantsFor(item,pool,groups,o){
  if(item.kind==='q'){
    const g=vk(item.q);
    if(!o.vary||!g)return [item.q];
    const others=pool.filter(x=>vk(x)===g&&x.id!==item.q.id);
    return o.includeChosen||!others.length?[item.q,...others]:others;
  }
  const keys=unitKeys(item.g);
  if(!o.vary||!keys.size)return [item.g];
  const others=groups.filter(x=>x.id!==item.g.id&&[...unitKeys(x)].some(k=>keys.has(k)));
  return o.includeChosen||!others.length?[item.g,...others]:others;
}

/* Give every student one variant of every chosen item.
 * items     chosen items [{kind:'q',q}|{kind:'p',g}]
 * variants  variantsFor() result per item
 * students  [{id,…}] in roll-number order
 * ctx       {perfOf(sid)->Map(qid->perf), schedOf(sid)->Set(qid)}
 * o         {avoid:boolean}
 * returns   Map(sid -> [{item:i, pick, reason}])   reason: CT_SAME | CT_CHOSEN | CT_VARIATION
 */
function spreadVariants(items,variants,students,ctx,o){
  const usage=items.map(()=>new Map()),prev=items.map(()=>null),out=new Map();
  const qsOf=v=>v&&v.questions?v.questions:[v];
  const idOf=v=>v&&v.questions?'p:'+v.id:'q:'+v.id;
  const keysOf=v=>v&&v.questions?unitKeys(v):new Set(vk(v)?[vk(v)]:[]);
  // most-constrained items first, so a student's few fresh variants are not used up by easier items
  const order=items.map((_,i)=>i).sort((a,b)=>variants[a].length-variants[b].length);
  for(const s of students){
    const perf=(ctx&&ctx.perfOf&&ctx.perfOf(s.id))||new Map(),sched=(ctx&&ctx.schedOf&&ctx.schedOf(s.id))||new Set();
    const usedIds=new Set(),usedKeys=new Set(),picks=new Array(items.length);
    const tier=v=>{if(!o.avoid)return 0;const qs=qsOf(v);return qs.some(q=>sched.has(q.id))?2:qs.some(q=>perf.has(q.id))?1:0;};
    for(const i of order){
      const it=items[i],vars=variants[i];
      // a variant must not repeat a question or a Variation Group already in this student's paper
      const clash=v=>usedIds.has(idOf(v))||qsOf(v).some(q=>usedIds.has('q:'+q.id))||[...keysOf(v)].some(k=>usedKeys.has(k)&&!itemKeys(it).has(k));
      let cand=vars.filter(v=>!clash(v));if(!cand.length)cand=vars;
      let pick;
      if(cand.length===1)pick=cand[0];
      else{
        const t=Math.min(...cand.map(tier));cand=cand.filter(v=>tier(v)===t);
        const u=Math.min(...cand.map(v=>usage[i].get(idOf(v))||0));cand=cand.filter(v=>(usage[i].get(idOf(v))||0)===u);
        const notPrev=cand.filter(v=>idOf(v)!==prev[i]);if(notPrev.length)cand=notPrev;
        pick=cand[Math.floor(Math.random()*cand.length)];
      }
      usage[i].set(idOf(pick),(usage[i].get(idOf(pick))||0)+1);prev[i]=idOf(pick);
      usedIds.add(idOf(pick));qsOf(pick).forEach(q=>usedIds.add('q:'+q.id));keysOf(pick).forEach(k=>usedKeys.add(k));
      const same=vars.length===1;
      picks[i]={item:i,pick,reason:same?'CT_SAME':(idOf(pick)===itemId(it)?'CT_CHOSEN':'CT_VARIATION')};
    }
    out.set(s.id,picks);
  }
  return out;
}

/* One student's paper as plan slots (same shape as Custom Adaptive Papers).
 * parts: [{part,heading}] for MAT. o.shuffle: own question order for this student. */
function planFor(subject,picks,parts,o){
  const S=String(subject).toUpperCase(),mix=a=>o&&o.shuffle?shuffle(a):a;
  const qItems=picks.filter(p=>!p.pick.questions).map(p=>({q:p.pick,reason:p.reason,item:p.item}));
  const units=picks.filter(p=>p.pick.questions).map(p=>({g:p.pick,reason:p.reason,item:p.item,mistakeIds:new Set()}));
  const slots=[];
  if(S==='MAT'){
    const partOf=q=>String(q.part_code||'').toUpperCase();
    (parts||[]).forEach(p=>{const its=qItems.filter(x=>partOf(x.q)===p.part);if(its.length)slots.push({key:p.part,heading:p.heading,kind:'q',count:its.length,items:mix(its)});});
    const known=new Set((parts||[]).map(p=>p.part)),rest=qItems.filter(x=>!known.has(partOf(x.q)));
    if(rest.length)slots.push({key:'MAT_OTHER',heading:'',kind:'q',count:rest.length,items:mix(rest)});
  }else{
    if(qItems.length)slots.push({key:S==='EVS'?'EVS_MCQ':S,heading:'',kind:'q',count:qItems.length,items:mix(qItems)});
    if(units.length)slots.push({key:S==='EVS'?'EVS_PASSAGE':'LANGUAGE_PASSAGE',heading:'',kind:'p',count:units.length,units:mix(units)});
  }
  return {slots,verified:false};
}
function rowsFromPlan(plan,subject){
  const rows=[];
  plan.slots.forEach(s=>{
    if(s.kind==='q')s.items.forEach(it=>{
      const r=Object.assign({},it.q,{_selectionType:'CUSTOM_TEST',_adaptiveReason:it.reason});
      if(s.heading)r._partHeading=s.heading;
      if(String(subject).toUpperCase()==='MAT')r._commonPart=s.key;
      rows.push(r);
    });
    else s.units.forEach(u=>u.g.questions.forEach(q=>rows.push(Object.assign({},q,{
      _passageGroup:u.g.id,_passageTitle:u.g.title,_passageText:u.g.text,_selectionType:'CUSTOM_TEST',_adaptiveReason:u.reason}))));
  });
  rows.forEach((q,i)=>{q._number=i+1;});
  return rows;
}
// How often each variant of each chosen item was given: [{item, uses:[{v,n}]}]
function spreadSummary(items,variants,assign){
  return items.map((it,i)=>{
    const n=new Map();assign.forEach(picks=>{const p=picks[i];if(p){const k=p.pick.id;n.set(k,(n.get(k)||0)+1);}});
    return {item:i,uses:variants[i].map(v=>({v,n:n.get(v.id)||0}))};
  });
}

const api={shuffle,groupConflicts,variantsFor,spreadVariants,planFor,rowsFromPlan,spreadSummary};
if(typeof module!=='undefined'&&module.exports){module.exports=api;}
if(typeof window==='undefined')return;   // node: stop here (UI below needs the browser)
root.CT_API=api;

/* ============================== browser UI =============================== */
let S=null;
const q$=id=>document.getElementById(id);
const chunk=(a,n)=>{const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;};
async function fetchAll(make){const out=[];for(let from=0;;from+=1000){const {data,error}=await make(from,from+999);if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)break;}return out;}
async function inChunks(ids,fn){const out=[];for(const c of chunk([...new Set(ids)],80))out.push(...await fn(c));return out;}
const realText=t=>{const s=String(t==null?'':t).trim();return s&&!/^\[(?:PDF\/)?IMAGE QUESTION[^\]]*\]$/i.test(s)?s:'';};
const realOpt=v=>{const s=String(v==null?'':v).trim();return s&&!/^Option [A-D]$/i.test(s)?s:'';};
const snip=(t,n=110)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1)+'…':t;};
const mathHtml=t=>typeof jnvstMathPreview==='function'?jnvstMathPreview(t):esc(t);
const hasMath=t=>/\$|\\\(|\\\[|\\[a-zA-Z]+/.test(String(t||''));
const typeset=nodes=>{if(typeof jnvstTypesetWhenReady==='function')jnvstTypesetWhenReady(nodes.filter(Boolean));};
const PARTS_FALLBACK=[
  {part:'MAT_PATTERN',heading:'PART I — PATTERN COMPLETION'},{part:'MAT_SERIES',heading:'PART II — FIGURE SERIES COMPLETION'},
  {part:'MAT_GEOMETRICAL',heading:'PART III — GEOMETRICAL FIGURE COMPLETION'},{part:'MAT_MIRROR',heading:'PART IV — MIRROR & WATER IMAGING'},
  {part:'MAT_EMBEDDED',heading:'PART V — EMBEDDED FIGURE'}];
const getParts=()=>(typeof QP_COMMON_PARTS!=='undefined'&&Array.isArray(QP_COMMON_PARTS)&&QP_COMMON_PARTS.length)?QP_COMMON_PARTS:PARTS_FALLBACK;
const REASON={
  CT_SAME:['Same for all','#e0f2fe','#075985'],
  CT_CHOSEN:['Your question','#f3e8ff','#6b21a8'],
  CT_VARIATION:['Variation','#ffedd5','#9a3412']
};
const tag=r=>{const x=REASON[r]||[r,'#e5e7eb','#374151'];return `<span class="tag" style="background:${x[1]};color:${x[2]}">${esc(x[0])}</span>`;};
const topicOf=q=>[String(q.lesson_code||'').trim(),String(q.topic||'').trim()].filter(Boolean).join(' ')||'—';

/* ---- run the app's own paper helpers for this test's subject / language ---- */
function setCtx(cfg,matCounts){
  if(!window.qpState)window.qpState={};
  qpState.subject=cfg.subject;
  qpState.language=cfg.subject==='MAT'?'COMMON':cfg.language;
  qpState.mode=cfg.subject==='MAT'?'mat':cfg.subject==='LANGUAGE'?'passages':cfg.subject.toLowerCase();
  qpState.commonCounts=Object.assign({},matCounts||{});
}
function withSubject(subject,fn){
  const old=window.qpSubject;window.qpSubject=()=>String(subject).toUpperCase();
  try{return fn();}finally{window.qpSubject=old;}
}
function completeGroups(groups){
  return (groups||[]).filter(g=>g.questions&&g.questions.length===5&&g.questions.map(q=>Number(q.question_order)||0).sort((a,b)=>a-b).join(',')==='1,2,3,4,5');
}

/* ------------------------------ data loading ------------------------------ */
async function loadData(){
  const classes=(await fetchAll((a,b)=>sb.from('classes').select('id,name,course,jnvst_parent_id').eq('teacher_id',current.id).order('id').range(a,b)))
    .filter(c=>String(c.course||'').toUpperCase().startsWith('JNVST'));
  const classIds=classes.map(c=>c.id);
  const members=classIds.length?await inChunks(classIds,ids=>fetchAll((a,b)=>sb.from('class_students').select('class_id,student_id').in('class_id',ids).order('class_id').order('student_id').range(a,b))):[];
  const classOf=new Map();members.forEach(m=>{if(!classOf.has(m.student_id))classOf.set(m.student_id,m.class_id);});
  const profs=classOf.size?await inChunks([...classOf.keys()],ids=>fetchAll((a,b)=>sb.from('profiles').select('id,full_name,roll_no').in('id',ids).order('id').range(a,b))):[];
  const students=profs.map(p=>Object.assign({},p,{class_id:classOf.get(p.id)}))
    .sort((a,b)=>String(a.roll_no||'').localeCompare(String(b.roll_no||''),undefined,{numeric:true})||String(a.full_name||'').localeCompare(String(b.full_name||'')));
  const perf=new Map();students.forEach(s=>perf.set(s.id,new Map()));
  const rows=students.length?await inChunks(students.map(s=>s.id),ids=>fetchAll((a,b)=>sb.from('student_question_performance').select('student_id,mock_question_id,attempt_count,wrong_count,correct_count,correct_streak,last_result,last_wrong_at').in('student_id',ids).order('id').range(a,b))):[];
  rows.forEach(r=>perf.get(r.student_id)?.set(r.mock_question_id,{attempts:+r.attempt_count||0,wrong:+r.wrong_count||0,correct:+r.correct_count||0,streak:+r.correct_streak||0,lastWrong:r.last_wrong_at,lastResult:r.last_result}));
  const bank=await fetchAll((a,b)=>sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).eq('active',true).order('id').range(a,b));
  const scheduled=new Map();
  try{
    const recs=await fetchAll((a,b)=>sb.from('jnvst_generated_question_papers').select('id,sid:paper_snapshot->>student_id,key:answer_key_snapshot->rows').eq('teacher_id',current.id).not('paper_snapshot->>student_id','is',null).order('id').range(a,b));
    recs.forEach(r=>{if(!r.sid)return;if(!scheduled.has(r.sid))scheduled.set(r.sid,new Set());(Array.isArray(r.key)?r.key:[]).forEach(x=>{if(x&&x['Question ID'])scheduled.get(r.sid).add(x['Question ID']);});});
  }catch(e){console.warn('Earlier personal papers could not be read:',e);}
  return {classes,students,perf,bank,scheduled};
}

/* -------------------------------- settings -------------------------------- */
function readCfg(){
  return {
    subject:(q$('ctSubject')?.value||'ARITHMETIC').toUpperCase(),
    language:(q$('ctLanguage')?.value||'ASSAMESE').toUpperCase(),
    title:String(q$('ctTitle')?.value||'').trim()||'Custom Test',
    vary:!!q$('ctVary')?.checked,includeChosen:!!q$('ctIncl')?.checked,avoid:!!q$('ctAvoid')?.checked,
    shuffle:!!q$('ctShuffle')?.checked,answers:q$('ctAnswers')?.value==='yes'
  };
}
// Question pool and passage pool of the chosen subject / language (same rules as the paper generator)
function pools(cfg){
  setCtx(cfg);
  const bank=S.bank;
  return withSubject(cfg.subject,()=>{
    if(cfg.subject==='MAT')return {qs:bank.filter(q=>String(q.part_code||'').toUpperCase().startsWith('MAT_')),ps:[]};
    if(cfg.subject==='ARITHMETIC')return {qs:bank.filter(q=>!qpIsPassage(q)&&qpLangMatches(q)&&qpQuestionSubjectMatches(q)),ps:[]};
    if(cfg.subject==='EVS')return {qs:bank.filter(q=>qpIsEVSMCQ(q)),ps:completeGroups(qpPassageGroups(bank.filter(q=>qpIsEVSPassageQuestion(q))))};
    return {qs:[],ps:completeGroups(qpPassageGroups(bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&String(q.part_code||'').toUpperCase().replace(/-/g,'_')==='LANGUAGE_PASSAGE')))};
  });
}

/* -------------------------------- screens --------------------------------- */
async function customTestHome(){
  render(`<div class="wrap">${header('Custom Test')}<div class="card"><p class="muted">Loading students, results and question bank…</p></div></div>`);
  try{
    const d=await loadData();
    S=Object.assign(d,{chosen:new Map(),selected:new Set(),plans:new Map(),cfg:null,pool:{qs:[],ps:[]},items:null,variants:null});
    paint();
  }catch(e){
    render(`<div class="wrap">${header('Custom Test')}<div class="card">${message('Could not load data: '+(e.message||e))}<div class="actions"><button class="secondary" onclick="questionPaperGeneratorPage()">← Back</button></div></div></div>`);
  }
}
function paint(){
  const classOpts=S.classes.map(c=>{const parent=S.classes.find(x=>x.id===c.jnvst_parent_id);return `<option value="${esc(c.id)}">${esc(parent?parent.name+' › '+c.name:c.name)}</option>`;}).join('');
  const chk=(id,label,on=true)=>`<label style="font-weight:400;display:block"><input type="checkbox" id="${id}" ${on?'checked':''} style="width:auto;margin-right:8px" onchange="ctOptionsChanged()">${label}</label>`;
  render(`<div class="wrap">${header('Custom Test')}
  <div class="card" style="border:2px solid #b45309;background:#fffbeb">
    <h2 style="margin:0">📝 Custom Test</h2>
    <p class="muted" style="margin:6px 0 0">You choose the questions. Every selected student gets a personal paper: for a question with a <b>Variation Group</b> each student gets a different question of that group; a question without a group is in every paper. The question order is different for every student. Print each student's OMR sheet in <b>Personal OMR Sheets</b>; the imported results go into the <b>Mistake Bank</b> as usual.</p>
  </div>

  <div class="card"><h2 style="margin-top:0">1. Test</h2>
    <div class="grid">
      <div><label>Test title *</label><input id="ctTitle" value="Custom Test"></div>
      <div><label>Subject</label><select id="ctSubject" onchange="ctSubjectChanged()"><option value="ARITHMETIC">Arithmetic</option><option value="MAT">Mental Ability (MAT)</option><option value="EVS">EVS</option><option value="LANGUAGE">Language</option></select></div>
      <div id="ctLangWrap"><label>Language</label><select id="ctLanguage" onchange="ctSubjectChanged()"><option value="ASSAMESE">Assamese</option><option value="ENGLISH">English</option></select></div>
      <div><label>Teacher copy</label><select id="ctAnswers"><option value="no">Question paper only</option><option value="yes">Include answer key after each paper</option></select></div>
    </div>
    <div style="margin-top:8px">
      ${chk('ctVary','For a question with a Variation Group, give each student a <b>variation</b> (another question of the same group)')}
      ${chk('ctIncl','The question I chose may also be one of the variations')}
      ${chk('ctAvoid','Prefer variations the student has not attempted and has not been given in an earlier personal paper')}
      ${chk('ctShuffle','Different question order for every student (passage questions stay 1–5 inside their passage)')}
    </div>
  </div>

  <div class="card"><h2 style="margin-top:0">2. Choose questions</h2>
    <div class="grid">
      <div><label>Search</label><input id="ctSearch" oninput="ctRenderBank()" placeholder="Words in the question, group name…"></div>
      <div><label>Lesson / Topic</label><select id="ctTopic" onchange="ctRenderBank()"></select></div>
      <div><label>Show</label><select id="ctShow" onchange="ctRenderBank()"><option value="">All</option><option value="var">Only questions with variations</option><option value="chosen">Only chosen</option></select></div>
    </div>
    <div id="ctChosenInfo" class="notice small" style="margin-top:10px"></div>
    <div class="actions" style="margin:8px 0"><button class="secondary" onclick="ctClearChosen()">☐ Clear all chosen</button></div>
    <div id="ctBank" style="overflow:auto;max-height:520px"></div>
  </div>

  <div class="card"><h2 style="margin-top:0">3. Choose students</h2>
    <div class="grid">
      <div><label>Class / Group</label><select id="ctClass" onchange="ctFilter()"><option value="">All</option>${classOpts}</select></div>
      <div><label>Search name or roll no.</label><input id="ctStuSearch" oninput="ctFilter()" placeholder="Type to search"></div>
    </div>
    <div class="actions" style="margin:10px 0"><button class="secondary" onclick="ctSelectVisible(true)">☑ Select shown</button><button class="secondary" onclick="ctSelectVisible(false)">☐ Clear shown</button><span id="ctSelCount" class="tag">0 selected</span></div>
    <div id="ctStudents" style="overflow:auto;max-height:380px"></div>
  </div>

  <div class="card"><h2 style="margin-top:0">4. Generate, check &amp; print</h2>
    <div class="actions"><button onclick="ctGenerate()">⚙ Generate personal papers</button><button class="secondary" onclick="window.customOmrHome?customOmrHome():notify('Please reload the page.')">🧾 Personal OMR Sheets</button><button class="secondary" onclick="questionPaperGeneratorPage()">← Question Paper Generator</button></div>
    <div id="ctPreview" style="margin-top:12px"></div>
  </div>
  </div>`);
  ctSubjectChanged();ctFilter();
}

/* ---- choose questions ---- */
function ctSubjectChanged(){
  if(!S)return;
  const cfg=readCfg();
  const lw=q$('ctLangWrap');if(lw)lw.style.display=cfg.subject==='MAT'?'none':'';
  const key=cfg.subject+'|'+(cfg.subject==='MAT'?'COMMON':cfg.language);
  if(S.poolKey!==key){S.poolKey=key;S.chosen=new Map();}
  S.pool=pools(cfg);
  // group sizes in this pool (how many variations a chosen question has)
  S.groupSize=new Map();S.pool.qs.forEach(q=>{const g=vk(q);if(g)S.groupSize.set(g,(S.groupSize.get(g)||0)+1);});
  S.unitVar=new Map();S.pool.ps.forEach(g=>{const k=unitKeys(g);S.unitVar.set(g.id,k.size?S.pool.ps.filter(x=>[...unitKeys(x)].some(z=>k.has(z))).length:1);});
  const topics=[...new Set([...S.pool.qs,...S.pool.ps.flatMap(g=>g.questions)].map(topicOf))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const sel=q$('ctTopic');if(sel){const old=sel.value;sel.innerHTML='<option value="">All</option>'+topics.map(t=>`<option ${t===old?'selected':''}>${esc(t)}</option>`).join('');}
  clearPlans();ctRenderBank();
}
function ctOptionsChanged(){clearPlans();ctRenderBank();}
function clearPlans(){if(S&&S.plans.size){S.plans=new Map();const p=q$('ctPreview');if(p)p.innerHTML='<div class="notice">Settings changed — generate the papers again.</div>';}}
function chosenItems(){return [...S.chosen.values()];}
function takenKeys(exceptId){const k=new Map();S.chosen.forEach((it,id)=>{if(id===exceptId)return;itemKeys(it).forEach(x=>k.set(x,it));});return k;}
function varCount(it){return it.kind==='p'?(S.unitVar.get(it.g.id)||1):(vk(it.q)?(S.groupSize.get(vk(it.q))||1):1);}
function qPreview(q){
  if(typeof teacherQuestionPreview==='function')return teacherQuestionPreview(q,{width:'160px',height:'110px'});
  return mathHtml(snip(realText(q.question_text),160));
}
function ctRenderBank(){
  const box=q$('ctBank');if(!box||!S)return;
  const txt=String(q$('ctSearch')?.value||'').trim().toLowerCase(),top=q$('ctTopic')?.value||'',show=q$('ctShow')?.value||'';
  const taken=takenKeys(null);
  const match=(text,topic,keyed,chosen)=>(!txt||text.toLowerCase().includes(txt))&&(!top||topic===top)&&(show!=='var'||keyed)&&(show!=='chosen'||chosen);
  const groupLine=(g,n)=>g?`<span class="small muted">Group <b>${esc(g)}</b> · ${n} variation${n===1?'':'s'}</span>`:'<span class="small muted">No group — same question for every student</span>';
  const qRows=S.pool.qs.filter(q=>match([q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,q.variation_group,q.topic].join(' '),topicOf(q),!!vk(q)&&(S.groupSize.get(vk(q))||0)>1,S.chosen.has('q:'+q.id)));
  const pRows=S.pool.ps.filter(g=>match([g.title,g.text,...g.questions.map(q=>q.question_text+' '+(q.variation_group||''))].join(' '),topicOf(g.questions[0]||{}),(S.unitVar.get(g.id)||1)>1,S.chosen.has('p:'+g.id)));
  const LIMIT=200;
  const qHtml=qRows.slice(0,LIMIT).map(q=>{
    const id='q:'+q.id,on=S.chosen.has(id),g=vk(q),other=g&&taken.get(g),dis=!on&&other;
    return `<label class="assignment" style="display:flex;gap:10px;align-items:flex-start;${dis?'opacity:.45':''}"><input type="checkbox" style="width:auto;margin-top:4px" ${on?'checked':''} ${dis?'disabled title="Another question of this Variation Group is already chosen"':''} onchange="ctToggle('${esc(id)}',this.checked)">
      <span style="flex:1;min-width:0"><span class="small muted">${esc(topicOf(q))}${q.part_code&&String(q.part_code).toUpperCase().startsWith('MAT_')?' · '+esc(q.part_code):''}</span><div>${qPreview(q)}</div>${groupLine(q.variation_group?String(q.variation_group).trim():'',S.groupSize.get(g)||1)}${dis?'<div class="small" style="color:#b45309">Another question of this group is already chosen — every student gets a variation of it.</div>':''}</span></label>`;
  }).join('');
  const pHtml=pRows.slice(0,LIMIT).map(g=>{
    const id='p:'+g.id,on=S.chosen.has(id),keys=[...unitKeys(g)],other=keys.some(k=>taken.has(k)),dis=!on&&other,n=S.unitVar.get(g.id)||1;
    return `<label class="assignment" style="display:flex;gap:10px;align-items:flex-start;${dis?'opacity:.45':''}"><input type="checkbox" style="width:auto;margin-top:4px" ${on?'checked':''} ${dis?'disabled title="A passage of this Variation Group is already chosen"':''} onchange="ctToggle('${esc(id)}',this.checked)">
      <span style="flex:1;min-width:0"><b>📖 ${esc(g.title||'Passage')}</b> <span class="small muted">5 questions</span><div class="small muted">${esc(snip(g.text||'',180))}</div>${keys.length?`<span class="small muted">Group <b>${esc(keys.join(', '))}</b> · ${n} passage${n===1?'':'s'} to vary</span>`:'<span class="small muted">No group — same passage for every student</span>'}</span></label>`;
  }).join('');
  const more=(qRows.length>LIMIT||pRows.length>LIMIT)?`<div class="notice small">Showing the first ${LIMIT}. Use Search or Lesson/Topic to find the rest.</div>`:'';
  box.innerHTML=more+(pRows.length&&qRows.length?'<h3>Questions</h3>':'')+(qHtml||'')+(pRows.length?(qRows.length?'<h3>Passages</h3>':'')+pHtml:'')+((!qRows.length&&!pRows.length)?'<p class="muted">No questions match. Check the subject, language and filters.</p>':'');
  typeset([box]);
  paintChosenInfo();
}
function paintChosenInfo(){
  const el=q$('ctChosenInfo');if(!el)return;
  const items=chosenItems();
  const nq=items.filter(i=>i.kind==='q').length,np=items.filter(i=>i.kind==='p').length;
  const withVar=items.filter(i=>varCount(i)>1).length;
  const total=nq+np*5;
  el.innerHTML=items.length?`<b>${total} question${total===1?'':'s'} per paper</b> (${nq} question${nq===1?'':'s'}${np?` + ${np} passage${np===1?'':'s'} × 5`:''}) · <b>${withVar}</b> will be varied between students · <b>${items.length-withVar}</b> same for everyone`
    :'No questions chosen yet. Tick the questions for this test.';
  el.className=items.length?'success small':'notice small';
}
function ctToggle(id,on){
  const cfg=readCfg();
  if(on){
    let it=null;
    if(id.startsWith('q:')){const q=S.pool.qs.find(x=>'q:'+x.id===id);if(q)it={kind:'q',q};}
    else{const g=S.pool.ps.find(x=>'p:'+x.id===id);if(g)it={kind:'p',g};}
    if(!it)return;
    const clash=[...itemKeys(it)].map(k=>takenKeys(null).get(k)).find(Boolean);
    if(clash){notify('Only one question per Variation Group can be chosen — every student already gets a variation of it.');ctRenderBank();return;}
    S.chosen.set(id,it);
  }else S.chosen.delete(id);
  clearPlans();ctRenderBank();
}
function ctClearChosen(){S.chosen=new Map();clearPlans();ctRenderBank();}

/* ---- students ---- */
function visibleStudents(){
  const cls=q$('ctClass')?.value||'',txt=String(q$('ctStuSearch')?.value||'').trim().toLowerCase();
  return S.students.filter(s=>{
    if(cls&&s.class_id!==cls){const c=S.classes.find(x=>x.id===s.class_id);if(!c||c.jnvst_parent_id!==cls)return false;}
    if(txt&&!(String(s.full_name||'').toLowerCase().includes(txt)||String(s.roll_no||'').toLowerCase().includes(txt)))return false;
    return true;
  });
}
function ctFilter(){
  const box=q$('ctStudents');if(!box||!S)return;
  const list=visibleStudents();
  box.innerHTML=list.length?`<table><thead><tr><th></th><th>Roll</th><th>Name</th><th>Class</th></tr></thead><tbody>${list.map(s=>{const c=S.classes.find(x=>x.id===s.class_id);
    return `<tr><td><input type="checkbox" style="width:auto" ${S.selected.has(s.id)?'checked':''} onchange="ctToggleStudent('${esc(s.id)}',this.checked)"></td><td>${esc(s.roll_no||'')}</td><td>${esc(s.full_name||'')}</td><td>${esc(c?c.name:'')}</td></tr>`;}).join('')}</tbody></table>`:'<p class="muted">No students match.</p>';
  updateCount();
}
function updateCount(){const el=q$('ctSelCount');if(el)el.textContent=S.selected.size+' selected';}
function ctToggleStudent(id,on){on?S.selected.add(id):S.selected.delete(id);clearPlans();updateCount();}
function ctSelectVisible(on){visibleStudents().forEach(s=>on?S.selected.add(s.id):S.selected.delete(s.id));clearPlans();ctFilter();}

/* ---- generate ---- */
function ctGenerate(){
  if(!S.chosen.size)return notify('Choose at least one question.');
  if(!S.selected.size)return notify('Select at least one student.');
  const cfg=readCfg();
  const items=chosenItems();
  const conf=groupConflicts(items);
  if(conf.length)return notify('Two chosen questions share a Variation Group ('+conf.map(c=>c.group).join(', ')+'). Keep only one of them.');
  const o={vary:cfg.vary,includeChosen:cfg.includeChosen,avoid:cfg.avoid};
  const variants=items.map(it=>variantsFor(it,S.pool.qs,S.pool.ps,o));
  const students=S.students.filter(s=>S.selected.has(s.id));   // roll-number order
  const assign=spreadVariants(items,variants,students,{perfOf:id=>S.perf.get(id),schedOf:id=>S.scheduled.get(id)},o);
  S.cfg=cfg;S.items=items;S.variants=variants;S.assign=assign;S.plans=new Map();
  students.forEach(s=>S.plans.set(s.id,planFor(cfg.subject,assign.get(s.id),getParts(),{shuffle:cfg.shuffle})));
  paintPreview();
}
const itemLabel=it=>it.kind==='p'?('📖 '+(it.g.title||'Passage')):snip(realText(it.q.question_text)||('[image question] '+(it.q.part_code||'')),70);
const variantLabel=v=>v.questions?(v.title||'Passage'):snip(realText(v.question_text)||'[image question]',50);
function paintPreview(){
  const box=q$('ctPreview');if(!box)return;
  if(!S.plans.size){box.innerHTML='';return;}
  const stu=S.students.filter(s=>S.plans.has(s.id));
  const sum=spreadSummary(S.items,S.variants,S.assign);
  const spread=sum.filter(x=>x.uses.length>1).map(x=>`<tr><td>${esc(itemLabel(S.items[x.item]))}</td><td>${x.uses.map(u=>`<span class="tag" title="${esc(variantLabel(u.v))}">${esc(snip(variantLabel(u.v),28))} × ${u.n}</span>`).join(' ')}</td></tr>`).join('');
  box.innerHTML=`<div class="success"><b>${stu.length}</b> personal paper${stu.length===1?'':'s'} ready · ${rowsFromPlan(S.plans.get(stu[0].id),S.cfg.subject).length} questions each. Open a student to check; ⇄ gives that student another variation.</div>
    ${spread?`<details style="margin:10px 0"><summary><b>How the variations are spread</b></summary><table><thead><tr><th>Chosen question</th><th>Variations given (× students)</th></tr></thead><tbody>${spread}</tbody></table></details>`:'<div class="notice small" style="margin:10px 0">None of the chosen questions has variations in this bank — every student gets the same questions in a different order.</div>'}
    <div class="actions" style="margin:10px 0"><button onclick="ctPrint()">🖨️ Save to history &amp; print</button><button class="secondary" onclick="ctAnswerExcel()">📊 Answer key Excel</button></div>
    <div id="ctCards">${stu.map(card).join('')}</div>
    <div id="ctOut" style="margin-top:10px"></div>`;
}
function card(s){
  return `<details class="ca-stu" data-sid="${esc(s.id)}" ontoggle="ctOpened(this)" style="border:1px solid #e2e8f0;border-radius:10px;margin:8px 0;padding:8px 12px;background:#fff">
    <summary style="cursor:pointer"><b>${esc(s.full_name||'')}</b> <span class="muted small">Roll ${esc(s.roll_no||'')}</span></summary><div class="ct-body" data-filled="0"></div></details>`;
}
function ctOpened(el){if(!el.open)return;const b=el.querySelector('.ct-body');if(b&&b.dataset.filled!=='1')fillBody(el.dataset.sid);}
function qCell(q){
  const img=q.image_url?`<img src="${esc(q.image_url)}" alt="" style="max-width:170px;max-height:100px;display:block;margin-bottom:4px;border:1px solid #e2e8f0;border-radius:6px;background:#fff">`:'';
  const t=realText(q.question_text),L=['A','B','C','D'];
  const opts=['a','b','c','d'].map((k,i)=>{const v=realOpt(q['option_'+k]);return v?`<span style="margin-right:12px;${String(q.correct_option||'').toUpperCase()===L[i]?'font-weight:700;color:#166534':''}">${L[i]}. ${mathHtml(snip(v,40))}</span>`:'';}).join('');
  return `${img}${t?`<div>${mathHtml(hasMath(t)?t:snip(t,130))}</div>`:''}${opts?`<div class="small" style="margin-top:3px">${opts}</div>`:''}`;
}
function fillBody(sid){
  const el=document.querySelector(`details[data-sid="${sid}"]`);if(!el)return;
  const body=el.querySelector('.ct-body'),plan=S.plans.get(sid);let n=0;
  const html=plan.slots.map((sl,si)=>{
    const head=sl.heading?`<div class="small" style="font-weight:700;margin:10px 0 4px">${esc(sl.heading)}</div>`:'';
    if(sl.kind==='q')return head+`<table><tbody>${sl.items.map((it,i)=>`<tr><td>${++n}</td><td>${tag(it.reason)}</td><td style="min-width:240px">${qCell(it.q)}</td><td>${S.variants[it.item].length>1?`<button class="secondary" onclick="ctOther('${esc(sid)}',${si},${i})">⇄ Other variation</button>`:''}</td></tr>`).join('')}</tbody></table>`;
    return head+`<table><tbody>${sl.units.map((u,i)=>`<tr><td>${n+1}–${(n+=5)}</td><td>${tag(u.reason)}</td><td style="min-width:240px"><b>${esc(u.g.title||'Passage')}</b><div class="small muted">${esc(snip(u.g.text||'',150))}</div></td><td>${S.variants[u.item].length>1?`<button class="secondary" onclick="ctOther('${esc(sid)}',${si},${i})">⇄ Other passage</button>`:''}</td></tr>`).join('')}</tbody></table>`;
  }).join('');
  body.innerHTML=html+`<div class="actions" style="margin-top:10px"><button class="secondary" onclick="ctPreviewOne('${esc(sid)}')">👁 Preview paper</button></div>`;
  body.dataset.filled='1';typeset([body]);
}
// Give this student another variant of the same chosen item (one not already in the paper).
function ctOther(sid,si,i){
  const plan=S.plans.get(sid),sl=plan.slots[si],cur=sl.kind==='q'?sl.items[i]:sl.units[i];
  const vars=S.variants[cur.item];
  const inPaper=new Set();plan.slots.forEach(s=>s.kind==='q'?s.items.forEach(x=>inPaper.add(x.q.id)):s.units.forEach(u=>inPaper.add(u.g.id)));
  const curId=sl.kind==='q'?cur.q.id:cur.g.id;
  const opts=vars.filter(v=>v.id!==curId&&!inPaper.has(v.id));
  if(!opts.length)return notify('No other variation is available for this question.');
  const k=vars.findIndex(v=>v.id===curId);
  const next=opts.find(v=>vars.indexOf(v)>k)||opts[0];        // step through the variations in turn
  const it=S.items[cur.item],reason=itemId(it)===(next.questions?'p:':'q:')+next.id?'CT_CHOSEN':'CT_VARIATION';
  if(sl.kind==='q')sl.items[i]={q:next,reason,item:cur.item};else sl.units[i]={g:next,reason,item:cur.item,mistakeIds:new Set()};
  const picks=S.assign.get(sid);if(picks&&picks[cur.item])picks[cur.item]={item:cur.item,pick:next,reason};
  const el=document.querySelector(`details[data-sid="${sid}"] .ct-body`);if(el)el.dataset.filled='0';fillBody(sid);
}

/* -------------------------- checking, saving, printing -------------------------- */
function matCountsOf(rows){const c={};rows.forEach(q=>{const p=q._commonPart||String(q.part_code||'').toUpperCase();c[p]=(c[p]||0)+1;});return c;}
function syncQcInputs(rows,subject){
  let box=q$('ctQcInputs');
  if(!box){box=document.createElement('div');box.id='ctQcInputs';box.style.display='none';document.body.appendChild(box);}
  const passages=new Set(rows.filter(q=>q._passageGroup).map(q=>q._passageGroup)).size;
  box.innerHTML=`<input id="qpQuestionCount" value="${rows.length}"><input id="qpEvsSetCount" value="${Math.max(1,passages)}"><input id="qpLanguageSetCount" value="${Math.max(1,passages)}">`;
  setCtx(S.cfg,subject==='MAT'?matCountsOf(rows):null);
}
function gatherPapers(){
  const cfg=S.cfg;
  const stu=S.students.filter(s=>S.plans.has(s.id));
  return withSubject(cfg.subject,()=>stu.map(s=>{
    const plan=S.plans.get(s.id),rows=rowsFromPlan(plan,cfg.subject);
    syncQcInputs(rows,cfg.subject);
    const report=qpValidatePaperQuality(rows,cfg.subject,`${s.roll_no||''} ${s.full_name||''}`.trim());
    // A custom test has its own length: the generator's "N sets × 20" EVS rule does not apply.
    if(cfg.subject==='EVS')report.errors=report.errors.filter(e=>!/^Question count/.test(e));
    return {s,plan,rows,report};
  }));
}
function newBaseSerial(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `QSET-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}
const decorate=(html,snap)=>typeof capDecorate==='function'?capDecorate(html,snap):html;
async function ctPrint(){
  if(!S||!S.plans.size)return;
  const papers=gatherPapers();
  const bad=papers.filter(p=>p.report.errors.length);
  const out=q$('ctOut');
  if(bad.length){
    out.innerHTML=`<div class="notice"><b>${bad.length} paper${bad.length===1?'':'s'} need${bad.length===1?'s':''} attention before printing:</b><ul style="margin:6px 0 0 18px">${bad.map(p=>`<li><b>${esc(p.report.setLabel)}</b> — ${p.report.errors.map(esc).join('; ')}</li>`).join('')}</ul></div>`;
    return;
  }
  const cfg=S.cfg;
  const w=qpOpenPrintWindow();if(!w)return;
  out.innerHTML='<p class="muted">Saving to Generated History…</p>';
  try{
    const base=newBaseSerial();
    const chosen=S.items.map(it=>it.kind==='p'?{passage:it.g.id,title:it.g.title||''}:{question_id:it.q.id,variation_group:it.q.variation_group||''});
    const payloads=papers.map((p,i)=>{
      const serial=`${base}-P${String(i+1).padStart(2,'0')}`;p.serial=serial;
      const snap={rows:p.rows.map(q=>({...q})),subject:cfg.subject,language:cfg.subject==='MAT'?'COMMON':cfg.language,mode:qpState.mode,setCode:'A',serial,title:cfg.title,questionOrder:cfg.shuffle?'custom-shuffled':'custom',master_rows:null,
        custom:true,custom_kind:'CUSTOM_TEST',student_id:p.s.id,student_name:p.s.full_name||'',roll_no:String(p.s.roll_no||''),
        custom_test:{chosen,vary:cfg.vary,include_chosen:cfg.includeChosen,avoid:cfg.avoid,shuffle:cfg.shuffle}};
      p.snap=snap;
      return {teacher_id:current.id,title:cfg.title,serial_no:serial,set_code:'A',subject:cfg.subject,language:snap.language,mode:qpState.mode||'',question_count:p.rows.length,total_marks:p.rows.length,
        paper_snapshot:snap,answer_key_snapshot:{rows:qpBuildAnswerRows(p.rows),serial,title:cfg.title,subject:cfg.subject,language:snap.language,set_code:'A',student_id:p.s.id,roll_no:String(p.s.roll_no||'')}};
    });
    const {error}=await sb.from('jnvst_generated_question_papers').insert(payloads);
    if(error)throw error;
    S.base=base;
    papers.forEach(p=>{const sch=S.scheduled.get(p.s.id)||new Set();p.rows.forEach(q=>sch.add(q.id));S.scheduled.set(p.s.id,sch);});
    let printErr='';
    try{
      const html=withSubject(cfg.subject,()=>papers.map((p,i)=>{syncQcInputs(p.rows,cfg.subject);return decorate(qpBuildSetHtml(p.rows,'A',p.serial,cfg.title,cfg.answers,i===papers.length-1),p.snap);}).join(''));
      qpWritePrintWindow(w,`${cfg.title} — Personal papers`,html);
    }catch(pe){printErr=pe.message||String(pe);try{w.close();}catch(_){}}
    out.innerHTML=`${printErr?`<div class="notice">The papers were saved, but the print window could not be prepared: ${esc(printErr)}. Print them from <b>Generated History</b>.</div>`:''}<div class="success">Saved ${papers.length} personal paper${papers.length===1?'':'s'} to Generated History (<code>${esc(base)}</code>).
      <div class="actions" style="margin-top:8px"><button onclick="window.customOmrBatch?customOmrBatch('${esc(base)}'):notify('Personal OMR Sheets are not available. Please reload the page.')">🧾 Print OMR sheets, scan &amp; import results</button></div>
      <div class="small">After the test: scan the filled OMR sheets there (or use <b>Import OMR Results</b> with this paper). Every student is matched by roll number to their own paper, and their mistakes go into the Mistake Bank.</div></div>`;
  }catch(e){
    try{w.close();}catch(_){}
    out.innerHTML=`<div class="notice">Could not save the papers: ${esc(e.message||e)}<br><span class="small">Nothing was printed.</span></div>`;
  }
}
function ctPreviewOne(sid){
  const cfg=S.cfg,s=S.students.find(x=>x.id===sid),plan=S.plans.get(sid);if(!s||!plan)return;
  const w=qpOpenPrintWindow();if(!w)return;
  const html=withSubject(cfg.subject,()=>{const rows=rowsFromPlan(plan,cfg.subject);syncQcInputs(rows,cfg.subject);return decorate(qpBuildSetHtml(rows,'A','(not saved yet)',cfg.title,cfg.answers,true),{custom:true,student_name:s.full_name,roll_no:s.roll_no});});
  qpWritePrintWindow(w,`${cfg.title} — ${s.full_name}`,html);
}
function ctAnswerExcel(){
  if(!S||!S.plans.size)return;
  if(typeof XLSX==='undefined')return notify('Excel library is not loaded.');
  const papers=gatherPapers(),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Roll No','Name','Questions'],...papers.map(p=>[p.s.roll_no||'',p.s.full_name||'',p.rows.length])]),'Students');
  const max=Math.max(0,...papers.map(p=>p.rows.length));
  const m=[['Q.No.',...papers.map(p=>p.s.roll_no||p.s.full_name)]];
  for(let i=0;i<max;i++)m.push([i+1,...papers.map(p=>p.rows[i]?String(p.rows[i].correct_option||'').toUpperCase():'')]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(m),'Answer Key');
  const blob=new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Custom_Test_Answer_Key.xlsx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}

Object.assign(root,{customTestHome,ctSubjectChanged,ctOptionsChanged,ctRenderBank,ctToggle,ctClearChosen,ctFilter,ctToggleStudent,ctSelectVisible,ctGenerate,ctOpened,ctOther,ctPrint,ctPreviewOne,ctAnswerExcel,ctState:()=>S});
})(typeof window!=='undefined'?window:globalThis);
