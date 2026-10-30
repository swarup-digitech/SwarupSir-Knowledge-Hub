/* Swarup Sir's Knowledge Hub — V21 Class discussion PDF after an OMR import
 *
 * One wide (landscape) page per question, large text for a projector / pen tablet:
 *   - the question (passage, picture, options) in big letters
 *   - its question number in every set (Set A Q5 · Set B Q12 …) or in each student's personal paper
 *   - how many chose each option, and who answered wrongly or skipped it
 * Works for papers imported with "Import OMR Results" (Excel) and for Personal OMR Sheets.
 * Opens a print-ready page: choose "Save as PDF" in the print window.
 * Loaded by main.html after custom-omr.js. Needs omr-engine.js (maths fallback) and teacher-app.js.
 */
(function(root){
'use strict';
const q$=id=>document.getElementById(id);
const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fixRupee=t=>String(t==null?'':t).replace(/\\text\s*\{\s*\\(?:rupee|Rupee|inr|INR)\s*\}/g,'₹').replace(/\\(?:rupee|Rupee|inr|INR)(?![A-Za-z])\s?/g,'₹');   // V23.6: \rupee → ₹
const fmt=t=>typeof jnvstMathPreview==='function'?jnvstMathPreview(t):e(fixRupee(t));   // V23.7: jnvstMathPreview handles ₹ itself (\text{₹} inside formulas)
const isImageText=t=>/^\[(?:PDF\/)?IMAGE QUESTION[^\]]*\]$/i.test(String(t||'').trim());
const realOpt=v=>{v=String(v||'').trim();return v&&!/^Option [A-D]$/i.test(v)?v:'';};
const blank=v=>!String(v||'').trim();
const isCustomRec=r=>!!(r&&r.paper_snapshot&&r.paper_snapshot.custom);
const setOf=r=>String(r.set_code||(r.paper_snapshot&&r.paper_snapshot.setCode)||'A').toUpperCase();

async function fetchAll(make){
  const out=[];
  for(let from=0;;from+=1000){const {data,error}=await make(from,from+999);if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)break;}
  return out;
}

/* ------------------------------- options dialog ------------------------------- */
function omrDiscussionPdf(base){
  const old=q$('omrDiscDlg');if(old)old.remove();
  const d=document.createElement('div');d.id='omrDiscDlg';
  d.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML=`<div class="card" style="max-width:520px;width:100%;margin:0;max-height:92vh;overflow:auto">
    <h2 style="margin-top:0">📽 Class discussion PDF</h2>
    <p class="small muted" style="margin-top:0">One wide page per question in big letters, with its number in every set and the students who answered wrongly, skipped it or answered correctly. <code>${e(base)}</code></p>
    <label>Page shape</label><select id="odShape"><option value="a4">A4 landscape (print or projector)</option><option value="wide">16:9 widescreen (projector / smart board)</option></select>
    <label>Questions</label><select id="odWhich"><option value="mist">Only questions someone got wrong or skipped</option><option value="all">All questions</option></select>
    <label>Order</label><select id="odOrder"><option value="paper">Paper order (Set A numbering)</option><option value="most">Most mistakes first</option></select>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input id="odAns" type="checkbox" style="width:auto" checked> Mark the correct answer</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="odCount" type="checkbox" style="width:auto" checked> Show how many students chose each option</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="odNames" type="checkbox" style="width:auto" checked> Show names of students who were wrong / skipped</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="odRight" type="checkbox" style="width:auto" checked> Show names of students who answered correctly</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="odExpl" type="checkbox" style="width:auto"> Show the explanation</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="odSpace" type="checkbox" style="width:auto" checked> Leave writing space for the pen tablet</label>
    <div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:10px">
      <label style="margin:0">Students to include <span id="odStuCount" class="small muted"></span></label>
      <div class="small muted" style="margin:2px 0 6px">Only the ticked students are used: their names, the option counts and (with “Only questions someone got wrong”) which questions get a page.</div>
      <div id="odStu"><div class="small muted">Loading students…</div></div>
    </div>
    <div class="actions" style="margin-top:14px"><button id="odGo">📽 Create PDF</button><button class="secondary" onclick="document.getElementById('omrDiscDlg').remove()">Cancel</button></div>
    <div id="odMsg" class="small muted"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click',ev=>{if(ev.target===d)d.remove();});
  q$('odGo').onclick=()=>{
    const only=picked();
    if(only&&!only.size){const m=q$('odMsg');if(m)m.textContent='Tick at least one student.';return;}
    if(only)savePick(base,only);
    build(base,{shape:q$('odShape').value,which:q$('odWhich').value,order:q$('odOrder').value,
      ans:q$('odAns').checked,count:q$('odCount').checked,names:q$('odNames').checked,right:!!(q$('odRight')&&q$('odRight').checked),expl:q$('odExpl').checked,space:q$('odSpace').checked,only});
  };
  loadStudents(base).catch(err=>{const b=q$('odStu');if(b)b.innerHTML=`<div class="small muted">Could not load the student list (${e(err.message||err)}). All students will be included.</div>`;});
}

/* ------------------------------ which students ------------------------------ */
// Students with imported results for this paper, with their group, ticked by default
// (or as last time for this paper).
let STU=[];
const PICK_KEY=b=>'skh_disc_students_'+b;
function savePick(base,set){try{localStorage.setItem(PICK_KEY(base),JSON.stringify([...set]));}catch(_){}}
function loadPick(base){try{const v=JSON.parse(localStorage.getItem(PICK_KEY(base))||'null');return Array.isArray(v)?new Set(v):null;}catch(_){return null;}}
async function loadStudents(base){
  const rows=await fetchAll((a,b)=>sb.from('omr_responses').select('student_id').eq('paper_base_serial',base).eq('question_no',1).order('id').range(a,b));
  const ids=[...new Set(rows.map(r=>String(r.student_id)))];
  const people=new Map(),groups=new Map();
  for(let i=0;i<ids.length;i+=150){
    const part=ids.slice(i,i+150);
    try{const {data}=await sb.from('profiles').select('id,full_name,roll_no').in('id',part);(data||[]).forEach(p=>people.set(String(p.id),p));}catch(_){}
    try{const {data}=await sb.from('class_students').select('student_id,class_id').in('student_id',part);(data||[]).forEach(m=>{const k=String(m.student_id);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(String(m.class_id));});}catch(_){}
  }
  const cids=[...new Set([...groups.values()].flat())],cls=new Map();
  for(let i=0;i<cids.length;i+=150){try{const {data}=await sb.from('classes').select('id,name,jnvst_parent_id').in('id',cids.slice(i,i+150));(data||[]).forEach(c=>cls.set(String(c.id),c));}catch(_){}}
  const prev=loadPick(base);
  STU=ids.map(id=>{const p=people.get(id)||{};const gs=(groups.get(id)||[]).map(g=>cls.get(g)).filter(Boolean);
    const sub=gs.find(c=>c.jnvst_parent_id)||gs[0];
    return {id,name:p.full_name||'',roll:p.roll_no||'',group:sub?sub.name:'',on:prev?prev.has(id):true};})
    .sort((a,b)=>String(a.roll).localeCompare(String(b.roll),undefined,{numeric:true}));
  paintStudents();
}
function paintStudents(){
  const box=q$('odStu');if(!box)return;
  const groups=[...new Set(STU.map(s=>s.group).filter(Boolean))].sort();
  box.innerHTML=`<div class="actions" style="margin:0 0 6px;align-items:center;gap:6px">
      <button type="button" class="secondary" style="padding:5px 10px" onclick="omrDiscPick('all')">All</button>
      <button type="button" class="secondary" style="padding:5px 10px" onclick="omrDiscPick('none')">None</button>
      ${groups.length>1?`<select style="width:auto;margin:0" onchange="omrDiscPick('group',this.value);this.value=''"><option value="">Only one group…</option>${groups.map(g=>`<option>${e(g)}</option>`).join('')}</select>`:''}
      <input id="odStuQ" type="search" placeholder="Search name / roll" style="width:auto;flex:1;min-width:120px;margin:0" oninput="omrDiscPick('search')">
    </div>
    <div id="odStuList" style="max-height:220px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px">
      ${STU.map((s,i)=>`<label data-i="${i}" style="display:flex;gap:8px;align-items:center;margin:3px 0;font-weight:400"><input type="checkbox" style="width:auto;margin:0" ${s.on?'checked':''} onchange="omrDiscPick('one',${i},this.checked)"><b style="min-width:52px">${e(s.roll||'—')}</b><span style="flex:1">${e(s.name||'Student')}</span><span class="small muted">${e(s.group)}</span></label>`).join('')||'<div class="small muted">No students found.</div>'}
    </div>`;
  countStudents();
}
function countStudents(){const c=q$('odStuCount');if(c)c.textContent=`(${STU.filter(s=>s.on).length} of ${STU.length} ticked)`;}
function omrDiscPick(kind,a,b){
  if(kind==='all'||kind==='none')STU.forEach(s=>{s.on=kind==='all';});
  else if(kind==='group')STU.forEach(s=>{s.on=s.group===a;});
  else if(kind==='one'){if(STU[a])STU[a].on=!!b;countStudents();return;}
  else if(kind==='search'){
    const q=String(q$('odStuQ')?.value||'').trim().toLowerCase();
    document.querySelectorAll('#odStuList label[data-i]').forEach(l=>{const s=STU[+l.dataset.i];l.style.display=!q||String(s.name).toLowerCase().includes(q)||String(s.roll).toLowerCase().includes(q)?'':'none';});
    return;
  }
  document.querySelectorAll('#odStuList input[type=checkbox]').forEach((cb,i)=>{cb.checked=!!(STU[i]&&STU[i].on);});
  countStudents();
}
// null = all students (list not loaded or everyone ticked)
function picked(){if(!STU.length)return null;const on=STU.filter(s=>s.on);return on.length===STU.length?null:new Set(on.map(s=>s.id));}

/* ------------------------------- collect the data ------------------------------- */
async function collect(base,only){
  const recs=(await qpGetHistoryGroupRecords(base)).filter(r=>r.paper_snapshot&&Array.isArray(r.paper_snapshot.rows));
  if(!recs.length)throw new Error('The question paper of this exam was not found in Generated History.');
  const resp=await fetchAll((a,b)=>sb.from('omr_responses').select('student_id,set_code,question_no,mock_question_id,selected_option,correct_option,is_correct')
    .eq('paper_base_serial',base).order('id').range(a,b));
  if(!resp.length)throw new Error('No OMR results are imported for this paper yet.');
  const totalStudents=new Set(resp.map(x=>String(x.student_id))).size;
  if(only){const all=resp.splice(0);all.forEach(x=>{if(only.has(String(x.student_id)))resp.push(x);});
    if(!resp.length)throw new Error('None of the chosen students has a result for this paper.');}
  const custom=recs.some(isCustomRec);
  const bySet=new Map(),byStudent=new Map();
  recs.forEach(r=>{if(isCustomRec(r))byStudent.set(String(r.paper_snapshot.student_id||''),r);else if(!bySet.has(setOf(r)))bySet.set(setOf(r),r);});

  // student names
  const people=new Map();
  recs.forEach(r=>{const s=r.paper_snapshot;if(s&&s.student_id)people.set(String(s.student_id),{name:s.student_name||'',roll:s.roll_no||''});});
  const ids=[...new Set(resp.map(x=>x.student_id))].filter(id=>!people.has(id));
  for(let i=0;i<ids.length;i+=150){
    try{const {data}=await sb.from('profiles').select('id,full_name,roll_no').in('id',ids.slice(i,i+150));(data||[]).forEach(p=>people.set(p.id,{name:p.full_name||'',roll:p.roll_no||''}));}catch(_){}
  }

  // one entry per distinct question
  const Q=new Map();
  const keyOf=(row,set,no)=>(row&&row.id)||`${set}:${no}`;
  const ensure=(key,row)=>{if(!Q.has(key))Q.set(key,{key,row,where:new Map(),wrong:[],skip:[],right:[],pick:{A:0,B:0,C:0,D:0},first:1e9,papers:0});return Q.get(key);};
  if(!custom){
    [...bySet.keys()].sort().forEach(set=>{
      bySet.get(set).paper_snapshot.rows.forEach((row,i)=>{const it=ensure(keyOf(row,set,i+1),row);if(!it.where.has(set))it.where.set(set,i+1);
        if(set===[...bySet.keys()].sort()[0])it.first=Math.min(it.first,i+1);});
    });
  }
  resp.forEach(x=>{
    const rec=custom?byStudent.get(String(x.student_id)):(bySet.get(String(x.set_code||'').toUpperCase())||bySet.get('A'));
    const row=rec&&rec.paper_snapshot.rows[x.question_no-1];
    const key=x.mock_question_id||keyOf(row,x.set_code,x.question_no);
    const it=ensure(key,row||{question_text:'Question '+x.question_no});
    if(custom){it.papers++;it.first=Math.min(it.first,x.question_no);}
    const p=people.get(x.student_id)||{name:'',roll:''};
    const who={name:p.name,roll:p.roll,no:x.question_no,set:custom?'':String(x.set_code||'').toUpperCase(),sel:String(x.selected_option||'').trim()};
    if(x.is_correct)it.right.push(who);else if(blank(who.sel))it.skip.push(who);else it.wrong.push(who);
    String(who.sel).toUpperCase().split(/[^A-D]+/).filter(Boolean).forEach(l=>{if(it.pick[l]!=null)it.pick[l]++;});
    if(!it.correct)it.correct=String(x.correct_option||row&&row.correct_option||'').toUpperCase();
  });
  // current explanations (incl. Assamese) from the question bank
  const bankIds=[...Q.values()].map(it=>it.row&&it.row.id).filter(Boolean);
  const bank=new Map();
  for(let i=0;i<bankIds.length;i+=150){
    try{const {data}=await sb.from('mock_question_bank').select('id,language,explanation,explanation_as').in('id',bankIds.slice(i,i+150));(data||[]).forEach(b=>bank.set(b.id,b));}catch(_){}
  }
  const first=recs[0];
  return {base,custom,recs,items:[...Q.values()],bank,title:first.title||'Question paper',subject:first.subject||'',language:String(first.language||'').toUpperCase(),
    students:new Set(resp.map(x=>x.student_id)).size,totalStudents,sets:[...bySet.keys()].sort()};
}

/* ----------------------------------- pages ----------------------------------- */
function explFor(it,D){
  const b=D.bank.get(it.row&&it.row.id)||{};const row=it.row||{};
  const en=String(b.explanation||row.explanation||'').trim(),as=String(b.explanation_as||row.explanation_as||'').trim();
  const lang=String(b.language||row.language||D.language||'').toUpperCase();
  if(lang==='ASSAMESE')return as?[['ব্যাখ্যা',as]]:en?[['Explanation',en]]:[];
  if(lang==='COMMON')return [en&&['Explanation',en],as&&as!==en&&['ব্যাখ্যা',as]].filter(Boolean);
  return en?[['Explanation',en]]:[];
}
const passageOf=row=>({title:String(row._passageTitle||row.passage_title||'').trim(),text:String(row._passageText||row.passage_text||'').trim(),id:row._passageGroup||row.passage_id||''});

function whereLine(it,D){
  if(D.bankMode)return it.chips||'';
  if(D.custom)return `In ${it.papers} student paper${it.papers===1?'':'s'}`;
  return D.sets.filter(s=>it.where.has(s)).map(s=>`<span class="sn">Set ${e(s)} · Q${it.where.get(s)}</span>`).join('');
}
// First name only (e.g. "Rahul" for "Rahul Kumar Das"), so the chosen option and
// the student's own Q No always fit. If a first name is still too long, only the
// name is shortened ("…"); roll no., option and Q No are never cut off.
function firstName(n){return String(n||'').trim().split(/\s+/)[0]||'Student';}
function whoChip(w,D,short,kind){
  const no=D.custom?`Q${w.no}`:(D.sets.length>1?`${e(w.set)}${w.no}`:'');
  return `<span class="who${kind==='ok'?' ok':''}"><b>${e(w.roll||'')}</b><span class="nm">${e(firstName(w.name))}</span>${w.sel&&kind!=='ok'?`<i>${e(w.sel)}</i>`:''}${no?`<small>${no}</small>`:''}</span>`;
}

function questionPage(it,idx,total,D,o){
  const row=it.row||{};const pas=passageOf(row);
  const text=String(row.question_text||'').trim();const realText=text&&!isImageText(text)?text:'';
  const opts=['A','B','C','D'].map(L=>{const v=realOpt(row['option_'+L.toLowerCase()]);const ok=o.ans&&L===it.correct;
    return {L,v,ok,n:it.pick[L]||0};});
  const anyOpt=opts.some(x=>x.v);
  const attempted=it.right.length+it.wrong.length+it.skip.length;
  const short=it.wrong.length+it.skip.length+(o.right?it.right.length:0)>10;
  // V23.6: long options (e.g. "0.04 < 0.004 < 0.44 …") get one option per row so nothing is cut off
  const plainLen=v=>String(v||'').replace(/\\(?:frac|dfrac)\{([^{}]*)\}\{([^{}]*)\}/g,'$1/$2').replace(/\\[A-Za-z]+/g,'x').replace(/[{}$\\]/g,'').length;
  const longOpts=opts.some(x=>plainLen(x.v)>22);
  const optHtml=anyOpt?`<div class="opts${longOpts?' one':''}">${opts.map(x=>`<div class="opt${x.ok?' ok':''}"><span class="L">${x.L}</span><span class="ot">${fmt(x.v)}</span>${o.count?`<span class="cnt">${x.n}</span>`:''}${x.ok?'<span class="tick">✓</span>':''}</div>`).join('')}</div>`
    :(o.count||o.ans)?`<div class="opts small4">${opts.map(x=>`<div class="opt${x.ok?' ok':''}"><span class="L">${x.L}</span>${o.count?`<span class="cnt">${x.n} chose</span>`:''}${x.ok?'<span class="tick">✓</span>':''}</div>`).join('')}</div>`:'';
  const ex=o.expl?explFor(it,D).map(([l,t])=>`<div class="ex"><b>${e(l)}:</b> ${fmt(t)}</div>`).join(''):'';
  const side=D.bankMode?'':`<div class="side">
      <div class="stat"><span class="sw">✗ ${it.wrong.length}</span><span class="ss">— ${it.skip.length}</span><span class="sr">✓ ${it.right.length}</span></div>
      <div class="small2">${attempted} student${attempted===1?'':'s'} · wrong · skipped · correct</div>
      ${(o.names||o.right)?`<div class="lists">${o.names?`
        <h4>✗ Wrong (${it.wrong.length})</h4><div class="chips">${it.wrong.sort((a,b)=>String(a.roll).localeCompare(String(b.roll),undefined,{numeric:true})).map(w=>whoChip(w,D,short)).join('')||'<span class="none">—</span>'}</div>
        <h4>— Skipped (${it.skip.length})</h4><div class="chips">${it.skip.sort((a,b)=>String(a.roll).localeCompare(String(b.roll),undefined,{numeric:true})).map(w=>whoChip(w,D,short)).join('')||'<span class="none">—</span>'}</div>`:''}
        ${o.right?`<h4 class="okh">✓ Correct (${it.right.length})</h4><div class="chips">${it.right.sort((a,b)=>String(a.roll).localeCompare(String(b.roll),undefined,{numeric:true})).map(w=>whoChip(w,D,short,'ok')).join('')||'<span class="none">—</span>'}</div>`:''}
      </div>`:''}
    </div>`;
  return `<section class="pg"><div class="hd"><div class="qn">${idx}<small>/${total}</small></div><div class="wh">${whereLine(it,D)}</div><div class="tt">${e(D.title)}</div></div>
    <div class="bd"><div class="main fit">
      ${pas.title?`<div class="pt">📖 ${e(pas.title)}</div>`:''}
      ${row.image_url?`<img class="qi" src="${e(row.image_url)}" alt="">`:''}
      ${realText?`<div class="qt">${fmt(realText)}</div>`:''}
      ${optHtml}${ex}
      ${o.space?'<div class="space"></div>':''}
    </div>${side}</div></section>`;
}
function passagePage(p,D){
  return `<section class="pg"><div class="hd"><div class="qn">📖</div><div class="wh"><span class="sn">Passage</span></div><div class="tt">${e(D.title)}</div></div>
    <div class="bd"><div class="main fit pass"><div class="pt">${e(p.title)}</div><div class="ptx">${fmt(p.text)}</div></div></div></section>`;
}
function coverPage(list,D,o){
  const tot=D.items.length;
  return `<section class="pg cover"><div class="hd"><div class="qn">📽</div><div class="wh"><span class="sn">Class discussion</span></div><div class="tt">SWARUP SIR'S KNOWLEDGE HUB</div></div>
    <div class="bd"><div class="main fit"><div class="ct">${e(D.title)}</div>
      <div class="cs">${e(D.subject)} · ${D.totalStudents&&D.totalStudents>D.students?`${D.students} of ${D.totalStudents} students (chosen)`:`${D.students} students`} · ${tot} questions · ${list.length} on the following pages · <code>${e(D.base)}</code></div>
      <table class="ix"><thead><tr><th>Page</th><th>${D.custom?'Asked in':'Question no.'}</th><th>✗ Wrong</th><th>— Skipped</th><th>✓ Correct</th></tr></thead><tbody>
      ${list.map((it,i)=>`<tr><td>${i+1}</td><td>${D.custom?it.papers+' papers':D.sets.filter(s=>it.where.has(s)).map(s=>s+'·'+it.where.get(s)).join('  ')}</td><td>${it.wrong.length}</td><td>${it.skip.length}</td><td>${it.right.length}</td></tr>`).join('')}
      </tbody></table></div></div></section>`;
}

function docHtml(D,o){
  let list=D.bankMode?D.items:D.items.filter(it=>o.which==='all'||it.wrong.length+it.skip.length>0);
  if(!D.bankMode){list.sort((a,b)=>a.first-b.first);
    if(o.order==='most')list.sort((a,b)=>(b.wrong.length+b.skip.length)-(a.wrong.length+a.skip.length)||a.first-b.first);}
  const wide=o.shape==='wide';const W=297,H=wide?167:210;
  const pages=[D.bankMode?bankCoverPage(list,D):coverPage(list,D,o)];const shown=new Set();
  list.forEach((it,i)=>{const p=passageOf(it.row||{});const pk=p.id||p.title;
    if(p.text&&pk&&!shown.has(pk)){shown.add(pk);pages.push(passagePage(p,D));}
    pages.push(questionPage(it,i+1,list.length,D,o));});
  if(D.bankMode&&o.key)pages.push(...answerKeyPages(list,D));
  const css=`@page{size:${W}mm ${H}mm;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#cbd5e1;font-family:Arial,'Noto Sans Bengali','Nirmala UI',sans-serif;color:#0f172a}
.pg{width:${W}mm;height:${H}mm;background:#fff;margin:6mm auto;display:flex;flex-direction:column;overflow:hidden;page-break-after:always;break-after:page}
.pg:last-child{page-break-after:auto;break-after:auto}
@media print{body{background:#fff}.pg{margin:0}.bn{display:none!important}}
.hd{display:flex;align-items:center;gap:5mm;padding:2.5mm 7mm;background:#17365D;color:#fff;flex:0 0 auto}
.qn{font:700 13mm/1 Arial;min-width:16mm}.qn small{font-size:5mm;opacity:.7}
.wh{display:flex;flex-wrap:wrap;gap:2mm;flex:1}.sn{background:#fde68a;color:#78350f;border-radius:2mm;padding:1mm 3mm;font:700 5.2mm/1.2 Arial}
.tt{font:4mm/1.2 Arial;opacity:.85;text-align:right;max-width:70mm}
.bd{flex:1;display:flex;gap:5mm;padding:4mm 7mm 4mm;min-height:0}
.main{flex:1;min-width:0;overflow:hidden;font-size:9mm;line-height:1.35;display:flex;flex-direction:column}
.pt{font-weight:700;color:#1e3a8a;font-size:.7em;margin-bottom:2mm}
.ptx{font-size:.62em;line-height:1.5;white-space:pre-wrap}
.qi{display:block;max-width:100%;max-height:${wide?92:122}mm;object-fit:contain;margin:0 auto 3mm;border:.3mm solid #e2e8f0;border-radius:2mm}
.qt{font-weight:600;margin-bottom:3mm}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm 5mm;font-size:.85em}
.opts.small4{grid-template-columns:repeat(4,1fr);font-size:.7em}
.opts.one{grid-template-columns:1fr}
.opt{display:flex;align-items:center;gap:3mm;min-width:0;border:.5mm solid #cbd5e1;border-radius:3mm;padding:1.8mm 3mm;position:relative}
.opt .L{font-weight:800;color:#1e3a8a;min-width:1.2em}.opt .ot{flex:1;min-width:0;overflow-wrap:anywhere}
.opt .cnt{font:700 .55em/1 Arial;background:#e2e8f0;color:#334155;border-radius:9mm;padding:1mm 2.5mm;white-space:nowrap}
.opt.ok{border-color:#16a34a;background:#f0fdf4}.opt .tick{color:#16a34a;font-weight:800}
.ex{margin-top:3mm;font-size:.6em;background:#f0fdf4;border-left:1.2mm solid #16a34a;padding:2mm 3mm;border-radius:1.5mm}
.space{flex:1;min-height:12mm;border-top:.4mm dashed #e2e8f0;margin-top:3mm}
.side{width:${wide?72:78}mm;flex:0 0 auto;border-left:.4mm solid #e2e8f0;padding-left:4mm;overflow:hidden;display:flex;flex-direction:column;font-size:5.6mm}
.stat{display:flex;gap:3mm;font-weight:800;font-size:1.6em;line-height:1}.sw{color:#dc2626}.ss{color:#b45309}.sr{color:#16a34a}
.small2{font-size:.7em;color:#64748b;margin:1mm 0 2mm}
.lists{flex:1;min-height:0;overflow:hidden}.lists h4{margin:2mm 0 1mm;font-size:.95em}
.chips{display:flex;flex-wrap:wrap;gap:1mm}.who{display:inline-flex;align-items:baseline;gap:1.2mm;border:.3mm solid #fecaca;background:#fef2f2;border-radius:1.5mm;padding:.5mm 1.8mm;font-size:.9em;white-space:nowrap;max-width:100%;min-width:0}
.who>b,.who>i,.who>small{flex:0 0 auto}.who .nm{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.who.ok{border-color:#bbf7d0;background:#f0fdf4}.okh{color:#166534}
.who i{font-style:normal;font-weight:700;color:#b91c1c}.who small{color:#64748b}.none{color:#94a3b8}
.cover .ct{font-size:1.1em;font-weight:800;color:#17365D}.cover .cs{font-size:.5em;color:#475569;margin:2mm 0 4mm}
table.ix{border-collapse:collapse;font-size:.42em;width:100%}
.key{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm 6mm;font-size:.8em}.key div{border-bottom:.3mm solid #e2e8f0;padding:.8mm 0;display:flex;gap:2mm}.key b{min-width:9mm;color:#1e3a8a}.key i{font-style:normal;font-weight:800;color:#166534}.key small{color:#64748b;font-size:.75em;align-self:center}table.ix td,table.ix th{border:.3mm solid #cbd5e1;padding:1mm 2mm;text-align:left}table.ix th{background:#f1f5f9}
mjx-container{font-size:100%!important}
.bn{position:sticky;top:0;z-index:5;font:14px Arial;background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.bn button{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:9px 16px;font-weight:700;cursor:pointer}.bn button:disabled{background:#94a3b8;cursor:wait}`;
  const PLAIN=(root.OMR&&root.OMR.plainTeX)?root.OMR.plainTeX.toString():'function(t){return t}';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${e('Class discussion — '+D.title)}</title>
<script>window.MathJax={tex:{macros:{rupee:"\\\\text{₹}",Rupee:"\\\\text{₹}",inr:"\\\\text{₹}"},inlineMath:[["\\\\(","\\\\)"],["$","$"]],displayMath:[["\\\\[","\\\\]"],["$$","$$"]],processEscapes:true},options:{skipHtmlTags:["script","noscript","style","textarea","pre","code"]},startup:{typeset:false}};<\/script>
<script async src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js"><\/script><style>${css}</style></head><body>
<div class="bn"><b>Class discussion PDF</b><button id="pbtn" disabled onclick="window.print()">Preparing maths…</button><span>In the print window choose <b>Save as PDF</b>. Layout and paper size are already set (${wide?'16:9 widescreen':'A4 landscape'}); keep margins <b>None</b> / <b>Default</b> and scale <b>100%</b>.</span></div>
${pages.join('')}
<script>
(function(){
  var btn=document.getElementById('pbtn');
  var plainTeX=${PLAIN};
  function fit(){
    var els=document.querySelectorAll('.fit');
    var wide=function(m){var x=m.querySelectorAll('.ot,.qt');for(var q=0;q<x.length;q++)if(x[q].scrollWidth>x[q].clientWidth+1)return true;return false;};
    for(var i=0;i<els.length;i++){var m=els[i],size=parseFloat(getComputedStyle(m).fontSize),img=m.querySelector('.qi'),sp=m.querySelector('.space'),n=0;
      var op=m.querySelector('.opts');if(op&&!op.classList.contains('one')&&!op.classList.contains('small4')&&wide(m))op.classList.add('one');   // too wide side by side: one option per row
      if(sp&&m.scrollHeight>m.clientHeight+1)sp.style.display='none';
      while((m.scrollHeight>m.clientHeight+1||wide(m))&&size>11&&n++<60){size*=0.93;m.style.fontSize=size+'px';if(img){var h=img.getBoundingClientRect().height;img.style.maxHeight=Math.max(80,h*0.93)+'px';}}
      if(sp&&m.scrollHeight<=m.clientHeight-60)sp.style.display='';}
    var ls=document.querySelectorAll('.lists');
    for(var j=0;j<ls.length;j++){var s=ls[j],hi=parseFloat(getComputedStyle(s).fontSize),lo=8;
      if(s.scrollHeight<=s.clientHeight+1)continue;
      for(var k=0;k<14;k++){var mid=(lo+hi)/2;s.style.fontSize=mid+'px';if(s.scrollHeight<=s.clientHeight+1)lo=mid;else hi=mid;}
      s.style.fontSize=lo+'px';}
  }
  function ready(){try{fit();}catch(_){}btn.disabled=false;btn.textContent='🖨 Save as PDF / Print';}
  function fallback(){
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n,list=[];
    while(n=w.nextNode()){if(n.parentNode&&/^(SCRIPT|STYLE|BUTTON)$/.test(n.parentNode.nodeName))continue;if(/\\\\\\(|\\\\\\[|\\$/.test(n.nodeValue))list.push(n);}
    list.forEach(function(t){t.nodeValue=plainTeX(t.nodeValue);});
  }
  function imgs(){var a=[].slice.call(document.images);return Promise.all(a.map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r;});}));}
  var tries=0;
  (function wait(){
    if(window.MathJax&&MathJax.typesetPromise){
      Promise.resolve(MathJax.startup&&MathJax.startup.promise).then(function(){return MathJax.typesetPromise([document.body]);}).then(imgs).then(ready,function(){fallback();imgs().then(ready);});
    }else if(tries++<120){setTimeout(wait,100);}
    else{fallback();imgs().then(ready);}
  })();
})();
<\/script></body></html>`;
}

/* ======================= V28: discussion PDF from the question bank =======================
   The teacher ticks questions in the Question Bank; every other question of the same
   Variation Group (same subject) is added after it, one question per page, answers not
   marked. Optional answer key at the end. */
const BQ_COLS='id,teacher_id,subject_id,lesson_id,topic,part_code,language,question_text,option_a,option_b,option_c,option_d,correct_option,image_url,passage_id,passage_title,passage_text,question_order,variation_group,active,created_at';
const vgOf=q=>String(q&&q.variation_group||'').trim();
function bankDiscussionPdf(ids){
  ids=[...new Set((ids||[]).filter(Boolean))];
  if(!ids.length)return (typeof notify==='function'?notify:alert)('Tick the questions you want to discuss first.');
  const old=q$('omrDiscDlg');if(old)old.remove();
  const d=document.createElement('div');d.id='omrDiscDlg';
  d.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML=`<div class="card" style="max-width:520px;width:100%;margin:0;max-height:92vh;overflow:auto">
    <h2 style="margin-top:0">📽 Discussion PDF</h2>
    <p class="small muted" style="margin-top:0">${ids.length} question${ids.length===1?'':'s'} chosen. One wide page per question in big letters; the answer is not shown on the pages.</p>
    <label>Title (on every page)</label><input id="bdTitle" value="Class discussion" maxlength="80">
    <label>Page shape</label><select id="bdShape"><option value="a4">A4 landscape (print or projector)</option><option value="wide">16:9 widescreen (projector / smart board)</option></select>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input id="bdVar" type="checkbox" style="width:auto" checked> Add all variations of each Variation Group</label>
    <label>Variations in</label><select id="bdLang"><option value="same">The same medium as the chosen question (English / Assamese / Common)</option><option value="all">Every medium</option></select>
    <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input id="bdSpace" type="checkbox" style="width:auto" checked> Leave writing space for the pen tablet</label>
    <label style="display:flex;gap:8px;align-items:center"><input id="bdKey" type="checkbox" style="width:auto"> Answer key at the end (last page)</label>
    <div class="actions" style="margin-top:14px"><button id="bdGo">📽 Create PDF</button><button class="secondary" onclick="document.getElementById('omrDiscDlg').remove()">Cancel</button></div>
    <div id="bdMsg" class="small muted"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click',ev=>{if(ev.target===d)d.remove();});
  q$('bdGo').onclick=()=>buildBank(ids,{title:q$('bdTitle').value.trim()||'Class discussion',shape:q$('bdShape').value,vars:q$('bdVar').checked,lang:q$('bdLang').value,space:q$('bdSpace').checked,key:q$('bdKey').checked,ans:false,count:false,expl:false,names:false,right:false});
}
const sameMedium=(a,b)=>{a=String(a||'').toUpperCase();b=String(b||'').toUpperCase();return !a||!b||a===b||a==='COMMON'||b==='COMMON';};
async function collectBank(ids,o){
  const chosen=[];
  for(let i=0;i<ids.length;i+=150){const {data,error}=await sb.from('mock_question_bank').select(BQ_COLS).in('id',ids.slice(i,i+150));if(error)throw error;chosen.push(...(data||[]));}
  if(!chosen.length)throw new Error('The chosen questions were not found (or you cannot use them).');
  const pos=new Map(ids.map((id,i)=>[id,i]));chosen.sort((a,b)=>pos.get(a.id)-pos.get(b.id));
  // every question of the groups involved (the database shows each teacher only what they may use)
  const groups=[...new Set(chosen.map(vgOf).filter(Boolean))];const members=new Map();
  if(o.vars&&groups.length){
    const rows=[];
    for(let i=0;i<groups.length;i+=50){const {data,error}=await sb.from('mock_question_bank').select(BQ_COLS).in('variation_group',groups.slice(i,i+50));if(error)throw error;rows.push(...(data||[]));}
    rows.forEach(r=>{const k=vgOf(r)+'|'+(r.subject_id||'');if(!members.has(k))members.set(k,[]);members.get(k).push(r);});
    members.forEach(list=>list.sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id))));
  }
  const items=[],used=new Set();let nChosen=0,nVar=0;
  const picked=new Set(ids);
  const blankStats={where:new Map(),wrong:[],skip:[],right:[],pick:{A:0,B:0,C:0,D:0}};
  const chip=t=>`<span class="sn">${e(t)}</span>`;
  chosen.forEach(q=>{
    if(used.has(q.id))return;
    const g=vgOf(q),all=g&&o.vars?(members.get(g+'|'+(q.subject_id||''))||[q]).filter(r=>r.id===q.id||(r.active!==false&&(o.lang==='all'||sameMedium(r.language,q.language)))):[q];
    if(!all.some(r=>r.id===q.id))all.unshift(q);
    const order=[q,...all.filter(r=>r.id!==q.id&&!used.has(r.id))];
    order.forEach((r,k)=>{used.add(r.id);const isC=k===0||picked.has(r.id);isC?nChosen++:nVar++;
      items.push({...blankStats,key:r.id,row:r,correct:String(r.correct_option||'').toUpperCase(),group:g,chosen:isC,
        chips:(isC?chip('Chosen question'):chip('Variation'))+(g&&order.length>1?chip(`Group ${g} · ${k+1} of ${order.length}`):g?chip(`Group ${g}`):'')});});
  });
  return {bankMode:true,items,nChosen,nVar,title:o.title,subject:'',bank:new Map(),language:'',groups:new Set(items.map(it=>it.group).filter(Boolean)).size};
}
function bankCoverPage(list,D){
  const date=new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  return `<section class="pg cover"><div class="hd"><div class="qn">📽</div><div class="wh"><span class="sn">Class discussion</span></div><div class="tt">SWARUP SIR'S KNOWLEDGE HUB</div></div>
    <div class="bd"><div class="main fit"><div class="ct">${e(D.title)}</div>
      <div class="cs">${date} · ${list.length} question${list.length===1?'':'s'} · ${D.nChosen} chosen${D.nVar?` + ${D.nVar} variation${D.nVar===1?'':'s'}`:''}${D.groups?` · ${D.groups} Variation Group${D.groups===1?'':'s'}`:''}</div>
      <table class="ix"><thead><tr><th>Page</th><th>Question</th><th>Topic</th><th>Variation Group</th></tr></thead><tbody>
      ${list.map((it,i)=>`<tr><td>${i+1}</td><td>${it.chosen?'Chosen':'↳ variation'}</td><td>${e(it.row.topic||it.row.part_code||'')}</td><td>${e(it.group||'—')}</td></tr>`).join('')}
      </tbody></table></div></div></section>`;
}
function answerKeyPages(list,D){
  const per=60,out=[];
  for(let s0=0;s0<list.length;s0+=per){
    const part=list.slice(s0,s0+per);
    out.push(`<section class="pg"><div class="hd"><div class="qn">🔑</div><div class="wh"><span class="sn">Answer key${list.length>per?` (${s0+1}–${s0+part.length})`:''}</span></div><div class="tt">${e(D.title)}</div></div>
      <div class="bd"><div class="main fit"><div class="key">${part.map((it,i)=>`<div><b>${s0+i+1}.</b><i>${e(it.correct||'—')}</i>${it.group?`<small>${e(it.group)}</small>`:''}</div>`).join('')}</div></div></div></section>`);
  }
  return out;
}
async function buildBank(ids,o){
  const msg=q$('bdMsg'),btn=q$('bdGo');
  const w=window.open('','_blank');
  if(!w){if(msg)msg.textContent='Your browser blocked the pop-up. Please allow pop-ups for this site and try again.';return;}
  try{w.document.write('<!doctype html><title>Preparing…</title><body style="font-family:Arial;padding:30px">Preparing the discussion pages…</body>');}catch(_){}
  if(btn)btn.disabled=true;if(msg)msg.textContent='Collecting the questions and their variations…';
  try{
    const D=await collectBank(ids,o);
    w.document.open();w.document.write(docHtml(D,o));w.document.close();
    const dlg=q$('omrDiscDlg');if(dlg)dlg.remove();
  }catch(err){
    try{w.close();}catch(_){}
    if(msg)msg.textContent='Could not prepare the PDF: '+(err.message||err);
    if(btn)btn.disabled=false;
  }
}

async function build(base,o){
  const msg=q$('odMsg'),btn=q$('odGo');
  const w=window.open('','_blank');
  if(!w){if(msg)msg.textContent='Your browser blocked the pop-up. Please allow pop-ups for this site and try again.';return;}
  try{w.document.write('<!doctype html><title>Preparing…</title><body style="font-family:Arial;padding:30px">Preparing the class discussion pages…</body>');}catch(_){}
  if(btn)btn.disabled=true;if(msg)msg.textContent='Collecting results…';
  try{
    const D=await collect(base,o.only||null);
    const html=docHtml(D,o);
    w.document.open();w.document.write(html);w.document.close();
    const dlg=q$('omrDiscDlg');if(dlg)dlg.remove();
  }catch(err){
    try{w.close();}catch(_){}
    if(msg)msg.textContent='Could not prepare the PDF: '+(err.message||err);
    if(btn)btn.disabled=false;
  }
}

root.omrDiscussionPdf=omrDiscussionPdf;
root.omrDiscPick=omrDiscPick;
root.bankDiscussionPdf=bankDiscussionPdf;
root.__omrDiscussion={collect,docHtml,collectBank};
})(typeof window!=='undefined'?window:globalThis);
