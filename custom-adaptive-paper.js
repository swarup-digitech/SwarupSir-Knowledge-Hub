/* Swarup Sir's Knowledge Hub — Custom Adaptive Question Paper (V16)
 * One personal JNVST question paper per student, built from that student's own
 * previous results (online tests, assignments and imported OMR sheets).
 *
 *   1. Choose the subject and the paper structure (same as the Question Paper Generator)
 *   2. Tick the students
 *   3. For every part, 60% (teacher can change) of the questions come from the student's
 *      active mistakes, the rest are new questions
 *   4. Check each student's paper, swap / choose / remove / add questions, mark it verified
 *   5. Save to Generated History and print — each page carries the student's name and roll no.
 *
 * Reuses the pure selection logic of custom-adaptive.js (CA_API) and the existing paper
 * layout of the Question Paper Generator, so printed papers look exactly the same.
 * OMR import recognises these papers by roll number (see V16_ADAPTIVE_PAPER_OMR.sql).
 */
(function(root){
'use strict';

const CAx=(typeof window==='undefined'&&typeof require==='function')?require('./custom-adaptive.js'):root.CA_API;
const PARTS=[
  {part:'MAT_PATTERN',heading:'PART I — PATTERN COMPLETION'},
  {part:'MAT_SERIES',heading:'PART II — FIGURE SERIES COMPLETION'},
  {part:'MAT_GEOMETRICAL',heading:'PART III — GEOMETRICAL FIGURE COMPLETION'},
  {part:'MAT_MIRROR',heading:'PART IV — MIRROR & WATER IMAGING'},
  {part:'MAT_EMBEDDED',heading:'PART V — EMBEDDED FIGURE'}
];

/* ======================= pure helpers (unit-tested) ======================= */
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
const vk=q=>String(q&&q.variation_group||'').trim().toLowerCase();
const isMistake=p=>CAx.isActiveMistake(p,false);

// Complete 5-question passage groups -> [{id,title,text,questions}]
function completeGroups(groups){
  return (groups||[]).filter(g=>g.questions&&g.questions.length===5&&g.questions.map(q=>Number(q.question_order)||0).sort((a,b)=>a-b).join(',')==='1,2,3,4,5');
}

// Passage groups are chosen as whole units. pct% of the units are the ones that contain
// the student's active mistakes (most mistakes first); the rest are new passages.
// Variation Groups used by the questions of one passage unit (V22)
const unitKeys=g=>new Set((g.questions||[]).map(vk).filter(Boolean));
const overlaps=(g,taken)=>!!taken&&[...unitKeys(g)].some(k=>taken.has(k));

function pickUnits(groups,perfMap,count,scheduled,o){
  count=Math.max(0,Math.floor(count));
  const pct=Math.min(100,Math.max(0,Number(o.pct)||0));
  const target=Math.min(count,Math.round(count*pct/100));
  const mset=g=>new Set(g.questions.filter(q=>isMistake(perfMap.get(q.id))).map(q=>q.id));
  const info=new Map(groups.map(g=>[g.id,mset(g)]));
  const sched=g=>!!(o.avoid&&scheduled&&g.questions.some(q=>scheduled.has(q.id)));
  const seen=g=>g.questions.some(q=>perfMap.has(q.id));
  const taken=o.usedGroups instanceof Set?o.usedGroups:new Set();   // V22: shared with the rest of the paper
  const units=[],used=new Set();
  const take=(g,reason)=>{units.push({g,reason,mistakeIds:info.get(g.id)||new Set()});used.add(g.id);unitKeys(g).forEach(k=>taken.add(k));};
  const weakGroups=groups.filter(g=>info.get(g.id).size>0)
    .sort((a,b)=>info.get(b.id).size-info.get(a.id).size);
  for(const g of weakGroups){if(units.length>=target)break;if(overlaps(g,taken))continue;take(g,'PREVIOUS_MISTAKE');}
  const tiers=[g=>!seen(g)&&!sched(g),g=>info.get(g.id).size===0&&!sched(g),g=>info.get(g.id).size===0,()=>true];
  const ck=o.commonFirst?(o.commonKeys||new Set()):null;
  const cg=g=>g.questions.some(q=>CAx.isCommonQ(q,ck));
  const passes0=o.commonFirst?[...tiers.slice(0,2).map(t=>g=>cg(g)&&t(g)),...tiers]:tiers;
  // V22: first only passages whose Variation Groups are not in the paper yet; a similar passage
  // is used only when nothing else is left (a missing passage would be worse).
  const passes=[...passes0.map(t=>g=>!overlaps(g,taken)&&t(g)),()=>true];
  for(const t of passes){
    if(units.length>=count)break;
    for(const g of shuffle(groups.filter(x=>!used.has(x.id)&&t(x)))){
      if(units.length>=count)break;
      if(t!==passes[passes.length-1]&&overlaps(g,taken))continue;   // a unit taken in this pass may block the next one
      take(g,seen(g)?'NEW_ATTEMPTED_BEFORE':'NEW_UNSEEN');
    }
  }
  return {units,short:Math.max(0,count-units.length)};
}

// defs: [{key,heading,kind:'q'|'p',count,pool|groups}]
function buildPlan(defs,perfMap,scheduled,o){
  const slots=[];let weak=0,total=0,short=0;
  const usedGroups=new Set();   // V22: one Variation Group per PAPER (shared by all parts)
  for(const d of defs){
    if(!(d.count>0))continue;
    if(d.kind==='q'){
      const r=CAx.pickForStudent(d.pool,perfMap,scheduled||new Set(),{total:d.count,pct:o.pct,isSchool:false,useVariation:!!o.useVariation,avoid:!!o.avoid,focus:null,commonFirst:!!o.commonFirst,commonKeys:o.commonKeys,strictGroups:true,usedGroups});
      const items=shuffle(r.items);
      slots.push({key:d.key,heading:d.heading,kind:'q',count:d.count,items,short:r.short});
      weak+=r.weakCount;total+=items.length;short+=r.short;
    }else{
      const r=pickUnits(d.groups,perfMap,d.count,scheduled,Object.assign({},o,{usedGroups}));
      slots.push({key:d.key,heading:d.heading,kind:'p',count:d.count,units:r.units,short:r.short*5});
      r.units.forEach(u=>{weak+=u.mistakeIds.size;total+=5;});short+=r.short*5;
    }
  }
  const plan={slots,weak,total,short,verified:false};
  repairPlan(plan,defs,perfMap,scheduled);   // safety net – normally finds nothing to fix
  return plan;
}

// V22: list the questions of a plan that repeat a Variation Group used earlier in the same paper.
function repeatedInPlan(plan){
  const seen=new Map(),rep=[];
  plan.slots.forEach((s,si)=>{
    if(s.kind==='q')s.items.forEach((it,i)=>{const g=vk(it.q);if(!g)return;if(seen.has(g))rep.push({si,i,group:String(it.q.variation_group).trim()});else seen.set(g,{si,i});});
    else s.units.forEach(u=>unitKeys(u.g).forEach(g=>{if(!seen.has(g))seen.set(g,{si,unit:true});}));
  });
  return rep;
}
// V22: replace every repeated question with the best question of a group not yet in the paper.
// Mistakes are kept where possible: the repeated copy is the later one, the first one stays.
function repairPlan(plan,defs,perfMap,scheduled){
  let fixed=0;const left=[];
  for(const r of repeatedInPlan(plan)){
    const slot=plan.slots[r.si],def=(defs||[]).find(d=>d.key===slot.key);
    if(!def){left.push(r);continue;}
    const c=candidatesFor(def,slot,plan,perfMap||new Map(),scheduled,r.i);
    if(!c.length){left.push(r);continue;}
    const best=c[0].rank,top=c.filter(z=>z.rank===best&&z.common===c[0].common);
    const pick=top[Math.floor(Math.random()*top.length)];
    const p=(perfMap||new Map()).get(pick.q.id);
    slot.items[r.i]={q:pick.q,reason:reasonOfCandidate(pick,perfMap||new Map()),wrongCount:p?p.wrong||0:0};
    fixed++;
  }
  return {fixed,left};
}
function planStats(plan){
  let weak=0,total=0,short=0;
  plan.slots.forEach(s=>{
    if(s.kind==='q'){s.items.forEach(it=>{total++;if(it.reason==='PREVIOUS_MISTAKE'||it.reason==='VARIATION_OF_MISTAKE')weak++;});short+=Math.max(0,s.count-s.items.length);}
    else{s.units.forEach(u=>{total+=5;weak+=u.mistakeIds.size;});short+=Math.max(0,s.count-s.units.length)*5;}
  });
  plan.weak=weak;plan.total=total;plan.short=short;return plan;
}
function rowsFromPlan(plan,subject){
  const rows=[];
  plan.slots.forEach(s=>{
    if(s.kind==='q'){
      s.items.forEach(it=>{
        const r=Object.assign({},it.q,{_selectionType:'ADAPTIVE',_adaptiveReason:it.reason,_wrongCount:it.wrongCount||0});
        if(s.heading)r._partHeading=s.heading;
        if(subject==='MAT')r._commonPart=s.key;
        rows.push(r);
      });
    }else{
      s.units.forEach(u=>u.g.questions.forEach(q=>rows.push(Object.assign({},q,{
        _passageGroup:u.g.id,_passageTitle:u.g.title,_passageText:u.g.text,_selectionType:'ADAPTIVE',
        _adaptiveReason:u.mistakeIds.has(q.id)?'PREVIOUS_MISTAKE':(u.reason==='TEACHER_CHOSEN'?'TEACHER_CHOSEN':'PASSAGE_UNIT')
      }))));
    }
  });
  rows.forEach((q,i)=>{q._number=i+1;});
  return rows;
}
// Common-first settings of the open screen (browser) – harmless defaults in node tests.
let _cfgCommon=false,_cfgKeys=null;
function setCommonCtx(on,keys){_cfgCommon=!!on;_cfgKeys=keys||null;}
const cfgCommon=()=>_cfgCommon,cfgCommonKeys=()=>_cfgKeys;
// Questions the teacher could put into this slot (ranked: Common first when on, then unseen first, mistakes last).
function candidatesFor(def,slot,plan,perfMap,scheduled,skipIdx){
  const sch=scheduled||new Set();
  if(slot.kind==='p'){
    const have=new Set(),taken=new Set();
    plan.slots.forEach(s=>{
      if(s.kind==='q')s.items.forEach(it=>{const g=vk(it.q);if(g)taken.add(g);});
      else s.units.forEach((u,i)=>{if(s===slot&&i===skipIdx)return;if(s===slot)have.add(u.g.id);unitKeys(u.g).forEach(k=>taken.add(k));});
    });
    const info=g=>g.questions.filter(q=>isMistake(perfMap.get(q.id))).length;
    return def.groups.filter(g=>!have.has(g.id)).map(g=>{
      const m=info(g),seen=g.questions.some(q=>perfMap.has(q.id)),sc=g.questions.some(q=>sch.has(q.id));
      // V22: passages that repeat a Variation Group already in the paper come last
      return {g,mistakes:m,common:cfgCommon()&&g.questions.some(q=>CAx.isCommonQ(q,cfgCommonKeys())),rank:((m===0&&!seen&&!sc)?0:(m===0&&!sc)?1:(m===0)?2:3)+(overlaps(g,taken)?10:0)};
    }).sort((a,b)=>(a.rank>=10)-(b.rank>=10)||(b.common-a.common)||(a.rank-b.rank));
  }
  const used=new Set(),groups=new Set();
  plan.slots.forEach(s=>{
    if(s.kind==='q')s.items.forEach((it,i)=>{if(s===slot&&i===skipIdx)return;used.add(it.q.id);const g=vk(it.q);if(g)groups.add(g);});
    else s.units.forEach(u=>u.g.questions.forEach(q=>{used.add(q.id);const g=vk(q);if(g)groups.add(g);}));   // V22: passage groups count too
  });
  return def.pool.filter(q=>!used.has(q.id)&&!(vk(q)&&groups.has(vk(q)))).map(q=>{
    const p=perfMap.get(q.id),m=isMistake(p);
    return {q,mistake:m,common:cfgCommon()&&CAx.isCommonQ(q,cfgCommonKeys()),rank:(!p&&!sch.has(q.id))?0:(!m&&!sch.has(q.id))?1:(!m)?2:3};
  }).sort((a,b)=>(b.common-a.common)||(a.rank-b.rank));
}
const reasonOfCandidate=(c,perfMap)=>perfMap.get(c.q.id)?(c.mistake?'PREVIOUS_MISTAKE':'NEW_ATTEMPTED_BEFORE'):'NEW_UNSEEN';

const getParts=()=>(typeof QP_COMMON_PARTS!=='undefined'&&Array.isArray(QP_COMMON_PARTS)&&QP_COMMON_PARTS.length)?QP_COMMON_PARTS:PARTS;   // the app's own list wins
const api={shuffle,completeGroups,pickUnits,buildPlan,planStats,rowsFromPlan,candidatesFor,setCommonCtx,repeatedInPlan,repairPlan,PARTS};
if(typeof module!=='undefined'&&module.exports){module.exports=api;}
if(typeof window==='undefined')return;   // node: stop here (UI below needs the browser)
root.CAP_API=api;

/* ============================== browser UI =============================== */
let S=null;
const q$=id=>document.getElementById(id);
const chunk=(a,n)=>{const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;};
async function fetchAll(make){const out=[];for(let from=0;;from+=1000){const {data,error}=await make(from,from+999);if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)break;}return out;}
async function inChunks(ids,fn){const out=[];for(const c of chunk([...new Set(ids)],80))out.push(...await fn(c));return out;}
const realText=t=>{const s=String(t==null?'':t).trim();return s&&!/^\[(?:PDF\/)?IMAGE QUESTION[^\]]*\]$/i.test(s)?s:'';};
const realOpt=v=>{const s=String(v==null?'':v).trim();return s&&!/^Option [A-D]$/i.test(s)?s:'';};
const hasMath=t=>/\$|\\\(|\\\[|\\[a-zA-Z]+/.test(String(t||''));
const snip=(t,n=110)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1)+'…':t;};
const mathHtml=t=>typeof jnvstMathPreview==='function'?jnvstMathPreview(t):esc(t);
function typeset(){
  const nodes=['capPreview'].map(q$).filter(Boolean);
  if(typeof jnvstTypesetWhenReady==='function')jnvstTypesetWhenReady(nodes);
  else if(window.MathJax&&window.MathJax.typesetPromise)window.MathJax.typesetPromise(nodes).catch(()=>{});
}
const REASON={
  PREVIOUS_MISTAKE:['Mistake','#fee2e2','#991b1b'],
  VARIATION_OF_MISTAKE:['Variation of mistake','#ffedd5','#9a3412'],
  NEW_UNSEEN:['New','#dcfce7','#166534'],
  NEW_ATTEMPTED_BEFORE:['Seen before','#e0e7ff','#3730a3'],
  PASSAGE_UNIT:['Passage','#e0f2fe','#075985'],
  TEACHER_CHOSEN:['Chosen by you','#f3e8ff','#6b21a8']
};
const tag=r=>{const x=REASON[r]||[r,'#e5e7eb','#374151'];return `<span class="tag" style="background:${x[1]};color:${x[2]}">${esc(x[0])}</span>`;};

/* ---- run the app's own paper helpers for a given subject / language ---- */
function setCtx(cfg){
  if(!window.qpState)window.qpState={};
  qpState.subject=cfg.subject;
  qpState.language=cfg.subject==='MAT'?'COMMON':cfg.language;
  qpState.mode=cfg.subject==='MAT'?'mat':cfg.subject==='LANGUAGE'?'passages':cfg.subject.toLowerCase();
  qpState.commonCounts=Object.assign({},cfg.mat||{});
}
// qpSubject() normally reads the generator's drop-down; here it must follow the paper being built.
function withSubject(subject,fn){
  const old=window.qpSubject;window.qpSubject=()=>String(subject).toUpperCase();
  try{return fn();}finally{window.qpSubject=old;}
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
    .sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),undefined,{numeric:true}));
  const perf=new Map();students.forEach(s=>perf.set(s.id,new Map()));
  const rows=students.length?await inChunks(students.map(s=>s.id),ids=>fetchAll((a,b)=>sb.from('student_question_performance').select('student_id,mock_question_id,attempt_count,wrong_count,correct_count,correct_streak,last_result,last_wrong_at').in('student_id',ids).order('id').range(a,b))):[];
  rows.forEach(r=>perf.get(r.student_id)?.set(r.mock_question_id,{attempts:+r.attempt_count||0,wrong:+r.wrong_count||0,correct:+r.correct_count||0,streak:+r.correct_streak||0,lastWrong:r.last_wrong_at,lastResult:r.last_result}));
  const bank=await fetchAll((a,b)=>sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).eq('active',true).order('id').range(a,b));
  // Questions already printed in this student's earlier personal papers (so they are not repeated).
  const scheduled=new Map();
  try{
    const recs=await fetchAll((a,b)=>sb.from('jnvst_generated_question_papers').select('id,sid:paper_snapshot->>student_id,key:answer_key_snapshot->rows').eq('teacher_id',current.id).not('paper_snapshot->>student_id','is',null).order('id').range(a,b));
    recs.forEach(r=>{if(!r.sid)return;if(!scheduled.has(r.sid))scheduled.set(r.sid,new Set());(Array.isArray(r.key)?r.key:[]).forEach(x=>{if(x&&x['Question ID'])scheduled.get(r.sid).add(x['Question ID']);});});
  }catch(e){console.warn('Earlier personal papers could not be read:',e);}
  return {classes,students,perf,bank,scheduled};
}

/* -------------------------------- settings -------------------------------- */
function readCfg(){
  const num=(id,d)=>{const n=Math.floor(Number(q$(id)?.value));return Number.isFinite(n)&&n>=0?n:d;};
  const subject=(q$('capSubject')?.value||'MAT').toUpperCase();
  const mat={};getParts().forEach(p=>{mat[p.part]=num('capMat_'+p.part,4);});
  return {
    subject,language:(q$('capLanguage')?.value||'ASSAMESE').toUpperCase(),
    title:String(q$('capTitle')?.value||'').trim()||'Personal Practice Paper',
    mat,arith:num('capArith',20),evsSets:Math.max(1,num('capEvsSets',1)),langSets:Math.max(1,num('capLangSets',4)),
    pct:Math.min(100,Math.max(0,Number(q$('capPct')?.value)||0)),
    avoid:!!q$('capAvoid')?.checked,useVariation:!!q$('capVar')?.checked,commonFirst:!!q$('capCommon')?.checked,
    answers:q$('capAnswers')?.value==='yes'
  };
}
function defsFor(cfg){
  setCtx(cfg);
  const bank=S.bank;
  return withSubject(cfg.subject,()=>{
    if(cfg.subject==='MAT')return getParts().map(p=>({key:p.part,heading:p.heading,kind:'q',count:cfg.mat[p.part]||0,pool:bank.filter(q=>String(q.part_code||'').toUpperCase()===p.part)}));
    if(cfg.subject==='ARITHMETIC')return [{key:'ARITHMETIC',heading:'',kind:'q',count:cfg.arith,pool:bank.filter(q=>!qpIsPassage(q)&&qpLangMatches(q)&&qpQuestionSubjectMatches(q))}];
    if(cfg.subject==='EVS')return [
      {key:'EVS_MCQ',heading:'',kind:'q',count:15*cfg.evsSets,pool:bank.filter(q=>qpIsEVSMCQ(q))},
      {key:'EVS_PASSAGE',heading:'',kind:'p',count:cfg.evsSets,groups:completeGroups(qpPassageGroups(bank.filter(q=>qpIsEVSPassageQuestion(q))))}];
    return [{key:'LANGUAGE_PASSAGE',heading:'',kind:'p',count:cfg.langSets,groups:completeGroups(qpPassageGroups(bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&String(q.part_code||'').toUpperCase().replace(/-/g,'_')==='LANGUAGE_PASSAGE')))}];
  });
}
const defLabel=d=>d.heading?d.heading.replace(/^PART [IVX]+ — /,''):d.key==='EVS_MCQ'?'EVS questions':d.key==='EVS_PASSAGE'?'EVS passages':d.key==='LANGUAGE_PASSAGE'?'Language passages':'Arithmetic';
// V22: for questions, what limits a paper is the number of DIFFERENT Variation Groups, not questions
const defAvail=d=>d.kind==='q'?CAx.groupCapacity(d.pool):d.groups.length;
const availText=d=>d.kind==='q'?`${d.pool.length} questions in ${defAvail(d)} groups`:`${defAvail(d)}`;

function structureHtml(){
  const sub=(q$('capSubject')?.value||'MAT').toUpperCase();
  const box=(id,label,v,hint)=>`<div><label>${label}</label><input id="${id}" type="number" min="0" max="100" value="${v}" oninput="capSettingsChanged()">${hint?`<div class="small muted">${hint}</div>`:''}</div>`;
  if(sub==='MAT')return `<div class="grid">${getParts().map(p=>box('capMat_'+p.part,esc(p.heading.replace(/^PART ([IVX]+) — /,'Part $1 · ')),4,'')).join('')}</div>`;
  if(sub==='ARITHMETIC')return `<div class="grid">${box('capArith','Number of questions',20,'')}</div>`;
  if(sub==='EVS')return `<div class="grid">${box('capEvsSets','EVS sets',1,'Each set = 15 MCQs + 1 passage (5 questions)')}</div>`;
  return `<div class="grid">${box('capLangSets','Language passages',4,'Each passage = 5 questions')}</div>`;
}
function capSubjectChanged(){
  const box=q$('capStructure');if(box)box.innerHTML=structureHtml();
  const lg=q$('capLangWrap');if(lg)lg.style.display=(q$('capSubject').value==='MAT')?'none':'';
  capSettingsChanged();
}
function capSettingsChanged(){
  if(!S)return;
  S.defs=null;
  if(S.plans.size){S.plans=new Map();const p=q$('capPreview');if(p)p.innerHTML='<div class="notice">Settings changed — generate the papers again.</div>';}
  paintAvail();capFilter();
}
function paintAvail(){
  const box=q$('capAvail');if(!box)return;
  try{
    const cfg=readCfg();S.defs=defsFor(cfg);
    box.innerHTML='Available in your bank: '+S.defs.map(d=>`<span class="tag" style="background:${d.count>defAvail(d)?'#fee2e2':'#f1f5f9'};color:${d.count>defAvail(d)?'#991b1b':'#334155'}">${esc(defLabel(d))}: ${esc(availText(d))}${d.count>defAvail(d)?' (need '+d.count+')':''}</span>`).join(' ')
      +'<div class="muted" style="margin-top:4px">A paper never has two questions of the same Variation Group, so the number of different groups is the limit.</div>';
    const ids=new Set();S.defs.forEach(d=>(d.kind==='q'?d.pool:d.groups.flatMap(g=>g.questions)).forEach(q=>ids.add(q.id)));S.poolIds=ids;
  }catch(e){box.textContent='';S.poolIds=new Set();}
}

/* -------------------------------- screens --------------------------------- */
async function customAdaptivePaperHome(){
  render(`<div class="wrap">${header('Custom Adaptive Question Paper')}<div class="card"><p class="muted">Loading students, results and question bank…</p></div></div>`);
  try{
    const d=await loadData();
    S=Object.assign(d,{selected:new Set(),plans:new Map(),defs:null,poolIds:new Set(),cfg:null});
    paint();
  }catch(e){
    render(`<div class="wrap">${header('Custom Adaptive Question Paper')}<div class="card">${message('Could not load data: '+(e.message||e))}<div class="actions"><button class="secondary" onclick="questionPaperGeneratorPage()">← Back</button></div></div></div>`);
  }
}
function paint(){
  const classOpts=S.classes.map(c=>{const parent=S.classes.find(x=>x.id===c.jnvst_parent_id);return `<option value="${esc(c.id)}">${esc(parent?parent.name+' › '+c.name:c.name)}</option>`;}).join('');
  render(`<div class="wrap">${header('Custom Adaptive Question Paper')}
  <div class="card" style="border:2px solid #7c3aed;background:#faf5ff">
    <h2 style="margin:0">🎯 Custom Adaptive Question Paper</h2>
    <p class="muted" style="margin:6px 0 0">Each student gets a personal paper built from their own earlier results. For every part, the chosen percentage (60% by default) of the questions are questions that student got wrong and has not yet fixed; the rest are new. You check every paper, change any question, then print. Papers are saved in Generated History and can be checked later with Import OMR Results.</p>
  </div>

  <div class="card"><h2 style="margin-top:0">1. Paper</h2>
    <div class="grid">
      <div><label>Paper title *</label><input id="capTitle" value="Personal Practice Paper"></div>
      <div><label>Subject</label><select id="capSubject" onchange="capSubjectChanged()"><option value="MAT">Mental Ability (MAT)</option><option value="ARITHMETIC">Arithmetic</option><option value="EVS">EVS</option><option value="LANGUAGE">Language</option></select></div>
      <div id="capLangWrap" style="display:none"><label>Language</label><select id="capLanguage" onchange="capSettingsChanged()"><option value="ASSAMESE">Assamese</option><option value="ENGLISH">English</option></select></div>
      <div><label>From mistakes (%)</label><input id="capPct" type="number" min="0" max="100" value="60" oninput="capSettingsChanged()"><div class="small muted">Applied to every part separately. A student with fewer mistakes gets more new questions.</div></div>
      <div><label>Teacher copy</label><select id="capAnswers"><option value="no">Question paper only</option><option value="yes">Include answer key after each paper</option></select></div>
    </div>
    <div id="capStructure" style="margin-top:10px">${structureHtml()}</div>
    <div id="capAvail" class="small" style="margin-top:8px"></div>
    <div style="margin-top:8px"><label style="font-weight:400"><input type="checkbox" id="capAvoid" checked style="width:auto;margin-right:8px" onchange="capSettingsChanged()">Do not repeat new questions already printed in this student's earlier personal papers</label>
    <label style="font-weight:400"><input type="checkbox" id="capCommon" checked style="width:auto;margin-right:8px" onchange="capSettingsChanged()">⭐ For the non-mistake questions, use <b>Common</b> questions first (frequently asked in exams; same Variation Group counts too). Other questions fill in only if Common ones run out.</label>
    <label style="font-weight:400"><input type="checkbox" id="capVar" checked style="width:auto;margin-right:8px" onchange="capSettingsChanged()">When a question has a Variation Group, ask a fresh variation instead of the exact mistake</label></div>
  </div>

  <div class="card"><h2 style="margin-top:0">2. Choose students</h2>
    <div class="grid">
      <div><label>Class / Group</label><select id="capClass" onchange="capFilter()"><option value="">All</option>${classOpts}</select></div>
      <div><label>Search name or roll no.</label><input id="capSearch" oninput="capFilter()" placeholder="Type to search"></div>
      <div><label>Show</label><select id="capShow" onchange="capFilter()"><option value="">All students</option><option value="mistakes">With mistakes in this paper's questions</option><option value="none">No attempts yet</option></select></div>
    </div>
    <div class="actions" style="margin:10px 0"><button class="secondary" onclick="capSelectVisible(true)">☑ Select shown</button><button class="secondary" onclick="capSelectVisible(false)">☐ Clear shown</button><span id="capSelCount" class="tag">0 selected</span></div>
    <div id="capStudents" style="overflow:auto;max-height:420px"></div>
  </div>

  <div class="card"><h2 style="margin-top:0">3. Generate &amp; check</h2>
    <div class="actions"><button onclick="capGenerate()">⚙ Generate personal papers</button><button class="secondary" onclick="window.customOmrHome?customOmrHome():notify('Please reload the page.')">📚 Past personal papers, OMR &amp; delete</button><button class="secondary" onclick="questionPaperGeneratorPage()">← Question Paper Generator</button></div>
    <div id="capPreview" style="margin-top:12px"></div>
  </div>
  </div>`);
  paintAvail();capFilter();
}
function mistakesInPool(sid){
  const pm=S.perf.get(sid);let n=0;if(!pm)return 0;
  pm.forEach((p,id)=>{if(S.poolIds.has(id)&&isMistake(p))n++;});return n;
}
function visibleStudents(){
  const cls=q$('capClass')?.value||'',txt=String(q$('capSearch')?.value||'').trim().toLowerCase(),show=q$('capShow')?.value||'';
  return S.students.filter(s=>{
    if(cls&&s.class_id!==cls){
      const c=S.classes.find(x=>x.id===s.class_id);
      if(!c||c.jnvst_parent_id!==cls)return false;
    }
    if(txt&&!(String(s.full_name||'').toLowerCase().includes(txt)||String(s.roll_no||'').toLowerCase().includes(txt)))return false;
    const st=CAx.studentStats(S.perf.get(s.id)||new Map(),false);
    if(show==='mistakes'&&!mistakesInPool(s.id))return false;
    if(show==='none'&&st.attempts)return false;
    return true;
  });
}
function capFilter(){
  const box=q$('capStudents');if(!box||!S)return;
  const list=visibleStudents();
  box.innerHTML=list.length?`<table><thead><tr><th></th><th>Roll</th><th>Name</th><th>Attempted</th><th>Accuracy</th><th>Active mistakes</th><th>In this paper's questions</th></tr></thead><tbody>${list.map(s=>{
    const st=CAx.studentStats(S.perf.get(s.id)||new Map(),false),m=mistakesInPool(s.id);
    return `<tr><td><input type="checkbox" style="width:auto" ${S.selected.has(s.id)?'checked':''} onchange="capToggleStudent('${esc(s.id)}',this.checked)"></td><td>${esc(s.roll_no||'')}</td><td>${esc(s.full_name||'')}</td><td>${st.attempts?st.questions+' q':'—'}</td><td>${st.accuracy==null?'—':st.accuracy+'%'}</td><td>${st.active}</td><td>${m?`<span class="tag" style="background:#fee2e2;color:#991b1b">${m}</span>`:'0'}</td></tr>`;}).join('')}</tbody></table>`:'<p class="muted">No students match.</p>';
  updateCount();
}
function updateCount(){const el=q$('capSelCount');if(el)el.textContent=S.selected.size+' selected';}
function capToggleStudent(id,on){on?S.selected.add(id):S.selected.delete(id);updateCount();}
function capSelectVisible(on){visibleStudents().forEach(s=>on?S.selected.add(s.id):S.selected.delete(s.id));capFilter();}

/* ----------------------------- generate / preview ----------------------------- */
function capGenerate(){
  if(!S.selected.size)return notify('Select at least one student.');
  let cfg;try{cfg=readCfg();S.defs=defsFor(cfg);}catch(e){return notify('Could not read the settings: '+(e.message||e));}
  const active=S.defs.filter(d=>d.count>0);
  if(!active.length)return notify('Enter how many questions each part needs.');
  const lack=active.filter(d=>defAvail(d)<d.count);
  if(lack.length)return notify('Not enough different questions in your bank (one per Variation Group): '+lack.map(d=>`${defLabel(d)} needs ${d.count}, has ${d.kind==='q'?defAvail(d)+' different Variation Groups':defAvail(d)}`).join('; ')+'. Add questions in new Variation Groups or lower the number.');
  S.cfg=cfg;S.plans=new Map();
  const ckeys=CAx.commonKeys(S.bank);setCommonCtx(cfg.commonFirst,ckeys);
  const o={pct:cfg.pct,avoid:cfg.avoid,useVariation:cfg.useVariation,commonFirst:cfg.commonFirst,commonKeys:ckeys};
  S.students.filter(s=>S.selected.has(s.id)).forEach(s=>{
    S.plans.set(s.id,buildPlan(S.defs,S.perf.get(s.id)||new Map(),S.scheduled.get(s.id)||new Set(),o));
  });
  paintPreview();
}
const defOf=key=>S.defs.find(d=>d.key===key);
function qCell(q){
  const img=q.image_url?`<img src="${esc(q.image_url)}" alt="" style="max-width:170px;max-height:100px;display:block;margin-bottom:4px;border:1px solid #e2e8f0;border-radius:6px;background:#fff">`:'';
  const t=realText(q.question_text);
  const L=['A','B','C','D'];
  const opts=['a','b','c','d'].map((k,i)=>{const v=realOpt(q['option_'+k]);return v?`<span style="margin-right:12px;${String(q.correct_option||'').toUpperCase()===L[i]?'font-weight:700;color:#166534':''}">${L[i]}. ${mathHtml(snip(v,40))}</span>`:'';}).join('');
  const ans=q.image_url&&!opts?`<span class="small muted">Answer: <b>${esc(q.correct_option||'?')}</b></span>`:'';
  return `${img}${t?`<div>${mathHtml(hasMath(t)?t:snip(t,130))}</div>`:(q.image_url?'':'<i class="muted">[no text]</i>')}${opts?`<div class="small" style="margin-top:3px">${opts}</div>`:''}${ans}`;
}
function unitCell(g){
  return `<div><b>${esc(g.title||'Passage')}</b></div><div class="small muted">${esc(snip(g.text||'',160))}</div><div class="small" style="margin-top:3px">${g.questions.map(q=>`<div>${q.question_order}. ${mathHtml(snip(realText(q.question_text),70))}</div>`).join('')}</div>`;
}
function planCard(s){
  const plan=S.plans.get(s.id);if(!plan)return '';
  planStats(plan);
  const pct=plan.total?Math.round(plan.weak*100/plan.total):0;
  return `<details class="ca-stu" data-sid="${esc(s.id)}" ontoggle="capOpened(this)" style="border:1px solid #e2e8f0;border-radius:10px;margin:8px 0;padding:8px 12px;background:${plan.verified?'#f0fdf4':'#fff'}">
    <summary style="cursor:pointer"><b>${esc(s.full_name||'')}</b> <span class="muted small">Roll ${esc(s.roll_no||'')}</span>
      <span class="tag" style="background:#fee2e2;color:#991b1b">${plan.weak} mistake question${plan.weak===1?'':'s'} · ${pct}%</span>
      <span class="tag">${plan.total} questions</span>
      ${plan.short?`<span class="tag" style="background:#fef3c7;color:#92400e">${plan.short} short</span>`:''}
      ${plan.verified?'<span class="tag" style="background:#dcfce7;color:#166534">✓ Verified</span>':'<span class="tag" style="background:#f1f5f9;color:#475569">Not verified</span>'}</summary>
    <div class="ca-body" data-filled="0"></div></details>`;
}
function paintPreview(){
  const box=q$('capPreview');if(!box)return;
  if(!S.plans.size){box.innerHTML='';return;}
  const stu=S.students.filter(s=>S.plans.has(s.id));
  const ver=stu.filter(s=>S.plans.get(s.id).verified).length;
  box.innerHTML=`<div class="success"><b>${stu.length}</b> personal paper${stu.length===1?'':'s'} ready · <span id="capVerCount">${ver}</span> verified. Open a student to check the questions; you can swap, choose, remove or add questions.</div>
    <div class="actions" style="margin:10px 0"><button class="secondary" onclick="capVerifyAll()">✓ Mark all verified</button><button onclick="capPrint()">🖨️ Save to history &amp; print</button><button class="secondary" onclick="capAnswerExcel()">📊 Answer key Excel</button></div>
    <div id="capCards">${stu.map(planCard).join('')}</div>
    <div id="capOut" style="margin-top:10px"></div>`;
}
function capOpened(el){
  if(!el.open)return;
  const body=el.querySelector('.ca-body');if(!body||body.dataset.filled==='1')return;
  fillBody(el.dataset.sid);
}
function fillBody(sid){
  const el=document.querySelector(`details[data-sid="${sid}"]`);if(!el)return;
  const body=el.querySelector('.ca-body');const plan=S.plans.get(sid);if(!plan)return;
  let n=0;
  const slotHtml=plan.slots.map((sl,si)=>{
    const def=defOf(sl.key);
    const head=sl.heading?`<div class="small" style="font-weight:700;margin:10px 0 4px">${esc(sl.heading)}</div>`:(plan.slots.length>1?`<div class="small" style="font-weight:700;margin:10px 0 4px">${esc(defLabel(def))}</div>`:'');
    if(sl.kind==='q'){
      const rows=sl.items.map((it,i)=>`<tr><td>${++n}</td><td>${tag(it.reason)}${it.wrongCount?`<div class="small muted">wrong ${it.wrongCount}×</div>`:''}</td><td style="min-width:240px">${qCell(it.q)}</td>
        <td style="white-space:nowrap"><button class="secondary" onclick="capSwap('${esc(sid)}',${si},${i})">⇄ Swap</button> <button class="secondary" onclick="capChoose('${esc(sid)}',${si},${i})">✎ Choose…</button> <button class="secondary" onclick="capRemove('${esc(sid)}',${si},${i})">✕</button></td></tr>`).join('');
      const miss=Math.max(0,sl.count-sl.items.length);
      return head+`<table><tbody>${rows||'<tr><td class="muted">No questions</td></tr>'}</tbody></table>${miss?`<div class="notice small">${miss} question${miss===1?'':'s'} missing in this part.</div>`:''}<div style="margin:4px 0"><button class="secondary" onclick="capAdd('${esc(sid)}',${si})">+ Add question</button></div>`;
    }
    const rows=sl.units.map((u,i)=>`<tr><td>${i+1}</td><td>${tag(u.reason)}${u.mistakeIds.size?`<div class="small muted">${u.mistakeIds.size} mistake${u.mistakeIds.size===1?'':'s'} inside</div>`:''}</td><td style="min-width:240px">${unitCell(u.g)}</td>
      <td style="white-space:nowrap"><button class="secondary" onclick="capSwap('${esc(sid)}',${si},${i})">⇄ Swap</button> <button class="secondary" onclick="capChoose('${esc(sid)}',${si},${i})">✎ Choose…</button></td></tr>`).join('');
    return head+`<table><tbody>${rows}</tbody></table>`;
  }).join('');
  body.innerHTML=slotHtml+`<div class="actions" style="margin-top:10px"><button onclick="capVerify('${esc(sid)}')">${plan.verified?'↺ Mark not verified':'✓ Mark verified'}</button><button class="secondary" onclick="capPreviewOne('${esc(sid)}')">👁 Preview paper</button></div>`;
  body.dataset.filled='1';
  if(typeof jnvstTypesetWhenReady==='function')jnvstTypesetWhenReady([body]);
}
function refreshCard(sid){
  const el=document.querySelector(`details[data-sid="${sid}"]`);if(!el)return;
  const s=S.students.find(x=>x.id===sid);const open=el.open;
  const tmp=document.createElement('div');tmp.innerHTML=planCard(s);
  const nu=tmp.firstElementChild;if(open)nu.setAttribute('open','');
  el.replaceWith(nu);
  if(open)fillBody(sid);
  const c=q$('capVerCount');if(c)c.textContent=[...S.plans.values()].filter(p=>p.verified).length;
}
function capVerify(sid){const p=S.plans.get(sid);p.verified=!p.verified;refreshCard(sid);}
function capVerifyAll(){S.plans.forEach(p=>{p.verified=true;});paintPreview();}

/* ------------------------------- editing ---------------------------------- */
function ctxOf(sid,si){return {plan:S.plans.get(sid),slot:S.plans.get(sid).slots[si],def:defOf(S.plans.get(sid).slots[si].key),perf:S.perf.get(sid)||new Map(),sched:S.scheduled.get(sid)||new Set()};
}
function itemFor(c,perf){return {q:c.q,reason:reasonOfCandidate(c,perf),wrongCount:perf.get(c.q.id)?.wrong||0};}
function applyChoice(sid,si,idx,cand){
  const x=ctxOf(sid,si);
  if(x.slot.kind==='p'){
    const unit={g:cand.g,reason:cand.mistakes?'PREVIOUS_MISTAKE':'TEACHER_CHOSEN',mistakeIds:new Set(cand.g.questions.filter(q=>isMistake(x.perf.get(q.id))).map(q=>q.id))};
    if(idx==null)x.slot.units.push(unit);else x.slot.units[idx]=unit;
  }else{
    const it=itemFor(cand,x.perf);it.reason=it.reason==='NEW_UNSEEN'?'TEACHER_CHOSEN':it.reason;
    if(idx==null)x.slot.items.push(it);else x.slot.items[idx]=it;
  }
  refreshCard(sid);
}
function capSwap(sid,si,i){
  const x=ctxOf(sid,si);
  const c=candidatesFor(x.def,x.slot,x.plan,x.perf,x.sched,i);
  if(!c.length)return notify('No other question is available for this place. Use Choose… or Remove.');
  const best=c[0].rank;const top=c.filter(z=>z.rank===best);
  const pick=top[Math.floor(Math.random()*top.length)];
  if(x.slot.kind==='p'){x.slot.units[i]={g:pick.g,reason:pick.mistakes?'PREVIOUS_MISTAKE':(pick.rank===0?'NEW_UNSEEN':'NEW_ATTEMPTED_BEFORE'),mistakeIds:new Set(pick.g.questions.filter(q=>isMistake(x.perf.get(q.id))).map(q=>q.id))};refreshCard(sid);}
  else{x.slot.items[i]=itemFor(pick,x.perf);refreshCard(sid);}
}
function capRemove(sid,si,i){const x=ctxOf(sid,si);x.slot.items.splice(i,1);x.plan.verified=false;refreshCard(sid);}
function capChoose(sid,si,i){openPicker(sid,si,i);}
function capAdd(sid,si){openPicker(sid,si,null);}

let PK=null;
function openPicker(sid,si,idx){
  const x=ctxOf(sid,si);
  const list=candidatesFor(x.def,x.slot,x.plan,x.perf,x.sched,idx);
  PK={sid,si,idx,list};
  const ov=document.createElement('div');ov.id='capPickerOverlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML=`<div style="background:#fff;border-radius:14px;max-width:820px;width:100%;max-height:88vh;overflow:auto;padding:16px">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h3 style="margin:0">${x.slot.kind==='p'?'Choose a passage':'Choose a question'}</h3><button class="secondary" onclick="capPickerClose()">✕ Close</button></div>
    <input id="capPickerSearch" placeholder="Search text…" oninput="capPickerRender()" style="margin:10px 0">
    <div class="small muted">Best choices first: new questions, then seen before, then this student's mistakes. ${list.length} available.</div>
    <div id="capPickerList"></div></div>`;
  document.body.appendChild(ov);
  capPickerRender();
}
function capPickerClose(){const o=q$('capPickerOverlay');if(o)o.remove();PK=null;}
function capPickerRender(){
  if(!PK)return;
  const txt=String(q$('capPickerSearch')?.value||'').toLowerCase();
  const isP=!!(PK.list[0]&&PK.list[0].g);
  const text=c=>isP?[c.g.title,c.g.text,...c.g.questions.map(q=>q.question_text)].join(' '):[c.q.question_text,c.q.option_a,c.q.option_b,c.q.option_c,c.q.option_d,c.q.topic].join(' ');
  const shown=PK.list.map((c,k)=>({c,k})).filter(z=>!txt||text(z.c).toLowerCase().includes(txt)).slice(0,60);
  const perf=S.perf.get(PK.sid)||new Map();
  const lbl=c=>{const r=isP?(c.mistakes?'PREVIOUS_MISTAKE':(c.rank===0?'NEW_UNSEEN':'NEW_ATTEMPTED_BEFORE')):reasonOfCandidate(c,perf);return tag(r);};
  q$('capPickerList').innerHTML=shown.length?`<table><tbody>${shown.map(z=>`<tr><td>${lbl(z.c)}</td><td style="min-width:240px">${isP?unitCell(z.c.g):qCell(z.c.q)}</td><td><button onclick="capPickerUse(${z.k})">Use</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">Nothing matches.</p>';
  if(typeof jnvstTypesetWhenReady==='function')jnvstTypesetWhenReady([q$('capPickerList')]);
}
function capPickerUse(k){
  if(!PK)return;const {sid,si,idx,list}=PK;const cand=list[k];capPickerClose();
  S.plans.get(sid).verified=false;applyChoice(sid,si,idx,cand);
}

/* -------------------------- checking, saving, printing -------------------------- */
function syncQcInputs(cfg){
  let box=q$('capQcInputs');
  if(!box){box=document.createElement('div');box.id='capQcInputs';box.style.display='none';document.body.appendChild(box);}
  box.innerHTML=`<input id="qpQuestionCount" value="${cfg.arith}"><input id="qpEvsSetCount" value="${cfg.evsSets}"><input id="qpLanguageSetCount" value="${cfg.langSets}">`;
}
function gatherPapers(){
  const cfg=S.cfg;setCtx(cfg);syncQcInputs(cfg);
  const stu=S.students.filter(s=>S.plans.has(s.id));
  return withSubject(cfg.subject,()=>stu.map(s=>{
    const plan=S.plans.get(s.id);
    const rows=rowsFromPlan(plan,cfg.subject);
    const report=qpValidatePaperQuality(rows,cfg.subject,`${s.roll_no||''} ${s.full_name||''}`.trim());
    return {s,plan,rows,report};
  }));
}
function newBaseSerial(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `QSET-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}
function decorate(html,snap){
  if(!snap||!snap.custom)return html;
  const nm=esc(snap.student_name||''),rl=esc(snap.roll_no||'');
  return String(html)
    .replace('<td class="label">Name</td><td>&nbsp;</td><td class="label">Roll No.</td><td>&nbsp;</td>',`<td class="label">Name</td><td><b>${nm}</b></td><td class="label">Roll No.</td><td><b>${rl}</b></td>`)
    .replace(/>SET [A-D]<\/span>/g,'>PERSONAL PAPER</span>')
    .replace(/ANSWER KEY — TEACHER COPY — SET [A-D]</g,'ANSWER KEY — TEACHER COPY — PERSONAL PAPER<');
}
async function capPrint(){
  if(!S||!S.plans.size)return;
  const papers=gatherPapers();
  const bad=papers.filter(p=>p.report.errors.length);
  const out=q$('capOut');
  if(bad.length){
    const vg=bad.filter(p=>p.report.errors.some(e=>/Variation Group/i.test(e))).length;
    out.innerHTML=`<div class="notice"><b>${bad.length} paper${bad.length===1?'':'s'} need${bad.length===1?'s':''} attention before printing:</b><ul style="margin:6px 0 0 18px">${bad.map(p=>`<li><b>${esc(p.report.setLabel)}</b> — ${p.report.errors.map(esc).join('; ')}</li>`).join('')}</ul>
      ${vg?`<div class="actions" style="margin-top:8px"><button onclick="capFixRepeats()">🔧 Fix repeated Variation Groups automatically (${vg} paper${vg===1?'':'s'})</button></div><div class="small muted">Each repeated question is replaced by the best question from a group that is not in that paper yet. Changed papers are marked “not verified” so you can check them.</div>`:''}</div>`;
    return;
  }
  const unver=papers.filter(p=>!p.plan.verified).length;
  if(unver&&!confirm(`${unver} of ${papers.length} papers are not marked verified. Print anyway?`))return;
  const cfg=S.cfg;
  const w=qpOpenPrintWindow();if(!w)return;
  out.innerHTML='<p class="muted">Saving to Generated History…</p>';
  try{
    const base=newBaseSerial();
    const payloads=papers.map((p,i)=>{
      const serial=`${base}-P${String(i+1).padStart(2,'0')}`;
      p.serial=serial;
      const snap={rows:p.rows.map(q=>({...q})),subject:cfg.subject,language:cfg.subject==='MAT'?'COMMON':cfg.language,mode:qpState.mode,setCode:'A',serial,title:cfg.title,questionOrder:'adaptive',master_rows:null,
        custom:true,adaptive:true,student_id:p.s.id,student_name:p.s.full_name||'',roll_no:String(p.s.roll_no||''),adaptive_percent:cfg.pct,
        adaptive_summary:{mistake_questions:p.plan.weak,total:p.rows.length,verified:!!p.plan.verified}};
      p.snap=snap;
      return {teacher_id:current.id,title:cfg.title,serial_no:serial,set_code:'A',subject:cfg.subject,language:snap.language,mode:qpState.mode||'',question_count:p.rows.length,total_marks:p.rows.length,
        paper_snapshot:snap,answer_key_snapshot:{rows:qpBuildAnswerRows(p.rows),serial,title:cfg.title,subject:cfg.subject,language:snap.language,set_code:'A',student_id:p.s.id,roll_no:String(p.s.roll_no||'')}};
    });
    const {error}=await sb.from('jnvst_generated_question_papers').insert(payloads);
    if(error)throw error;
    S.base=base;S.printed=papers;
    const html=withSubject(cfg.subject,()=>papers.map((p,i)=>decorate(qpBuildSetHtml(p.rows,'A',p.serial,cfg.title,cfg.answers,i===papers.length-1),p.snap)).join(''));
    qpWritePrintWindow(w,`${cfg.title} — Personal papers`,html);
    out.innerHTML=`<div class="success">Saved ${papers.length} personal paper${papers.length===1?'':'s'} to Generated History (<code>${esc(base)}</code>). After the exam, use <b>Import OMR Results</b> with this paper — every student is matched by roll number.</div>`;
  }catch(e){
    try{w.close();}catch(_){}
    out.innerHTML=`<div class="notice">Could not save the papers: ${esc(e.message||e)}<br><span class="small">Nothing was printed. Run the JNVST generated question paper history SQL if the table does not exist.</span></div>`;
  }
}
// V22: replace repeated Variation Group questions in all generated papers
function capFixRepeats(){
  if(!S||!S.plans.size)return;
  let fixed=0,papers=0;const left=[];
  S.plans.forEach((plan,sid)=>{
    const r=repairPlan(plan,S.defs,S.perf.get(sid)||new Map(),S.scheduled.get(sid)||new Set());
    if(r.fixed){fixed+=r.fixed;papers++;plan.verified=false;}
    if(r.left.length){const s=S.students.find(x=>x.id===sid);left.push(`${s?.roll_no||''} ${s?.full_name||''}`.trim()+' ('+r.left.map(x=>x.group).join(', ')+')');}
  });
  paintPreview();
  const out=q$('capOut');
  if(out)out.innerHTML=fixed||!left.length
    ?`<div class="success">Replaced ${fixed} repeated question${fixed===1?'':'s'} in ${papers} paper${papers===1?'':'s'}. These papers are marked not verified — please check them, then press <b>Save to history &amp; print</b> again.</div>${left.length?`<div class="notice small">Could not fix (no other group left in the bank): ${left.map(esc).join('; ')}</div>`:''}`
    :`<div class="notice">Nothing could be replaced: the bank has no other Variation Group left for ${left.map(esc).join('; ')}. Add questions in new groups or use ✎ Choose… / ✕ in those papers.</div>`;
}
function capPreviewOne(sid){
  const cfg=S.cfg;const papers=gatherPapers();const p=papers.find(x=>x.s.id===sid);if(!p)return;
  const w=qpOpenPrintWindow();if(!w)return;
  const snap={custom:true,student_name:p.s.full_name,roll_no:p.s.roll_no};
  const html=withSubject(cfg.subject,()=>decorate(qpBuildSetHtml(p.rows,'A','(not saved yet)',cfg.title,cfg.answers,true),snap));
  qpWritePrintWindow(w,`${cfg.title} — ${p.s.full_name}`,html);
}
function capAnswerExcel(){
  if(!S||!S.plans.size)return;
  if(typeof XLSX==='undefined')return notify('Excel library is not loaded.');
  const papers=gatherPapers();
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Roll No','Name','Questions','Mistake questions','Verified'],...papers.map(p=>[p.s.roll_no||'',p.s.full_name||'',p.rows.length,p.plan.weak,p.plan.verified?'Yes':'No'])]),'Students');
  const max=Math.max(0,...papers.map(p=>p.rows.length));
  const m=[['Q.No.',...papers.map(p=>p.s.roll_no||p.s.full_name)]];
  for(let i=0;i<max;i++)m.push([i+1,...papers.map(p=>p.rows[i]?String(p.rows[i].correct_option||'').toUpperCase():'')]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(m),'Answer Key');
  const blob=new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Personal_Papers_Answer_Key.xlsx';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}

/* ---- Generated History: print all personal papers of one batch ---- */
function capViewGroup(records){
  const first=records[0]||{};const title=first.title||'Personal Practice Paper';
  const subject=String(first.subject||first.paper_snapshot?.subject||'MAT').toUpperCase();
  const sorted=[...records].sort((a,b)=>String(a.serial_no).localeCompare(String(b.serial_no)));
  const w=qpOpenPrintWindow();if(!w)return;
  if(!window.qpState)window.qpState={};
  const oldMode=qpState.mode;
  try{
    qpState.mode=first.paper_snapshot?.mode||first.mode||qpState.mode;
    const html=withSubject(subject,()=>sorted.map((r,i)=>{
      const rows=(r.paper_snapshot?.rows||[]).map((q,n)=>({...q,_number:n+1}));
      return decorate(qpBuildSetHtml(rows,'A',r.serial_no,title,false,i===sorted.length-1),r.paper_snapshot);
    }).join(''));
    qpWritePrintWindow(w,`${title} — Personal papers`,html);
  }finally{qpState.mode=oldMode;}
}

Object.assign(root,{customAdaptivePaperHome,capSubjectChanged,capSettingsChanged,capFilter,capSelectVisible,capToggleStudent,capGenerate,capOpened,capSwap,capChoose,capAdd,capRemove,capVerify,capVerifyAll,capPrint,capFixRepeats,capPreviewOne,capAnswerExcel,capPickerClose,capPickerRender,capPickerUse,capDecorate:decorate,capViewGroup,capState:()=>S});
})(typeof window!=='undefined'?window:globalThis);
