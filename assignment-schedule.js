/* V30: Assignment schedule — teacher side
   * Every "create assignment" screen (Create Assignment, Import, Custom Adaptive) gets a 📅 Schedule box:
     Start date & time + End date & time (both required). They are saved with every assignment created there.
   * Every assignment card / personalised batch shows its schedule and result status, with
     📅 Schedule / Extend (change times, +1 hour/+1 day/+1 week, extend for chosen students only) and
     📢 Publish Results / 🙈 Hide Results.
   Needs V30_ASSIGNMENT_SCHEDULE.sql. Loaded after teacher-portal.js. */
(function(){
'use strict';
const root=window;
const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const say=m=>(typeof notify==='function'?notify(m):alert(m));
const pad=n=>String(n).padStart(2,'0');
const toInput=d=>{if(!d)return '';const x=new Date(d);if(isNaN(x))return '';return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;};
const fromInput=v=>{if(!v)return null;const x=new Date(v);return isNaN(x)?null:x.toISOString();};
const fmt=d=>{try{return new Date(d).toLocaleString(undefined,{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch(_){return String(d)}};
const $=id=>document.getElementById(id);
let ready=null; // null = unknown, true/false after the check

async function checkReady(){
  if(ready!==null)return ready;
  try{const {error}=await sb.from('assignments').select('start_at,end_at,results_published_at').limit(1);ready=!error;}catch(_){ready=false;}
  if(!ready){const b=$('v30SchedBlock');if(b)paintBlockWarning(b);}
  return ready;
}

/* ---------- 1. the 📅 Schedule box on the create screens ---------- */
const TITLE_IDS=['at','iat','caTitle'];
function defaultStart(){const d=new Date();d.setSeconds(0,0);d.setMinutes(Math.ceil((d.getMinutes()+1)/5)*5);return d;}
function blockHtml(){
  const s=defaultStart();
  return `<div id="v30SchedBlock" style="margin:12px 0;padding:12px 14px;border:2px solid #2563eb;background:#eff6ff;border-radius:12px">
    <div style="font-weight:700;color:#1d4ed8;margin-bottom:4px">📅 Schedule *</div>
    <div class="small muted" style="margin-bottom:8px">Students can open the assignment from the start time; it closes at the end time. They see their score after submitting; the answers, answer key and class analysis only after you publish the results (on the assignment card). You can extend the end time later.</div>
    <div class="grid"><div><label>Start date &amp; time *</label><input id="v30Start" type="datetime-local" value="${toInput(s)}"></div>
    <div><label>End date &amp; time *</label><input id="v30End" type="datetime-local"></div></div>
    <div class="actions" style="margin-top:6px;align-items:center"><span class="small muted">End =</span>
      <button type="button" class="secondary" onclick="v30QuickEnd(1/24)">start + 1 hour</button>
      <button type="button" class="secondary" onclick="v30QuickEnd(1)">+ 1 day</button>
      <button type="button" class="secondary" onclick="v30QuickEnd(3)">+ 3 days</button>
      <button type="button" class="secondary" onclick="v30QuickEnd(7)">+ 1 week</button></div>
    <div id="v30SchedMsg" class="small" style="margin-top:6px"></div></div>`;
}
function paintBlockWarning(b){const m=b.querySelector('#v30SchedMsg');if(m)m.innerHTML='<span style="color:#b91c1c"><b>The schedule cannot be saved yet:</b> run <code>V30_ASSIGNMENT_SCHEDULE.sql</code> in Supabase first. Until then assignments are created without a schedule (always open).</span>';}
root.v30QuickEnd=function(days){const s=$('v30Start'),e=$('v30End');if(!s||!e)return;const base=s.value?new Date(s.value):new Date();e.value=toInput(new Date(base.getTime()+days*86400000));};
function injectBlock(){
  if($('v30SchedBlock'))return;
  const input=TITLE_IDS.map($).find(Boolean);if(!input)return;
  const anchor=input.closest('.grid')||input;
  anchor.insertAdjacentHTML('afterend',blockHtml());
  if(ready===false)paintBlockWarning($('v30SchedBlock'));else checkReady();
}
new MutationObserver(()=>{try{injectBlock()}catch(_){}}).observe(document.body,{childList:true,subtree:true});

function readBlock(){ // {skip:true} when no box / database not ready; {error} or {start_at,end_at}
  const b=$('v30SchedBlock');if(!b||!document.body.contains(b)||ready===false)return {skip:true};
  const s=fromInput($('v30Start')?.value),e=fromInput($('v30End')?.value);
  if(!s)return {error:'Please choose the Start date & time (📅 Schedule).'};
  if(!e)return {error:'Please choose the End date & time (📅 Schedule).'};
  if(new Date(e)<=new Date(s))return {error:'The End time must be after the Start time.'};
  if(new Date(e)<=new Date())return {error:'The End time is already in the past. Please choose a later End time.'};
  return {start_at:s,end_at:e};
}
// check before any create button does its work
['saveAssignment','finishImportedAssignment','caAssign'].forEach(name=>{
  const orig=root[name];if(typeof orig!=='function'||orig.__v30)return;
  const w=async function(){await checkReady();const r=readBlock();if(r.error){say(r.error);$('v30SchedBlock')?.scrollIntoView({block:'center'});return;}return orig.apply(this,arguments);};
  w.__v30=true;root[name]=w;
});
// add the schedule to every new assignment row
if(typeof sb!=='undefined'&&!sb.__v30){
  const origFrom=sb.from.bind(sb);
  sb.from=function(table){
    const q=origFrom(table);
    if(table==='assignments'&&q&&typeof q.insert==='function'){
      const ins=q.insert.bind(q);
      q.insert=function(rows,opts){const r=readBlock();if(!r.skip&&!r.error){const add=x=>Object.assign({},x,{start_at:r.start_at,end_at:r.end_at});rows=Array.isArray(rows)?rows.map(add):add(rows);}return ins(rows,opts);};
    }
    return q;
  };
  sb.__v30=true;
}

/* ---------- 2. status + buttons on every assignment card ---------- */
const REG=new Map(); // key → assignment objects
function state(items){
  const sch=items.filter(a=>a.end_at);
  if(!sch.length)return {scheduled:false};
  const starts=sch.map(a=>a.start_at).filter(Boolean).map(d=>new Date(d)),ends=sch.map(a=>new Date(a.end_at));
  const start=starts.length?new Date(Math.min(...starts)):null,end=new Date(Math.max(...ends)),now=new Date();
  const pub=sch.filter(a=>a.results_published_at).length;
  return {scheduled:true,start,end,notOpen:!!(start&&now<start),closed:now>end,published:pub===sch.length,partlyPublished:pub>0&&pub<sch.length};
}
const chip=(t,bg,fg)=>`<span class="tag" style="background:${bg};color:${fg}">${t}</span>`;
function barHtml(key,inModal){
  const items=REG.get(key)||[],st=state(items),k=escx(key);
  let chips;
  if(!st.scheduled)chips=chip('📅 No schedule (always open)','#f1f5f9','#475569');
  else{
    chips=(st.notOpen?chip('🕒 Opens '+fmt(st.start),'#fef3c7','#92400e'):st.closed?chip('⛔ Closed '+fmt(st.end),'#fee2e2','#991b1b'):chip('🟢 Open until '+fmt(st.end),'#dcfce7','#166534'))
      +(st.start&&!st.notOpen?chip('Started '+fmt(st.start),'#f1f5f9','#475569'):'')
      +(st.published?chip('📢 Results published','#dbeafe','#1e40af'):st.partlyPublished?chip('📢 Partly published','#dbeafe','#1e40af'):chip('🔒 Results not published','#f1f5f9','#475569'));
  }
  const pubBtn=st.scheduled?(st.published?`<button type="button" class="secondary" onclick="v30Publish('${k}',false)">🙈 Hide Results</button>`:`<button type="button" style="background:#1d4ed8;color:#fff;border:0;font-weight:700" onclick="v30Publish('${k}',true)">📢 Publish Results</button>`):'';
  return `<div class="v30-bar" id="v30Bar_${k}" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1">${chips}${inModal?'':`<button type="button" class="secondary" onclick="v30Open('${k}')">📅 ${st.scheduled?'Schedule / Extend':'Set schedule'}</button>`}${pubBtn}</div>`;
}
function repaint(key){const el=$('v30Bar_'+key);if(el)el.outerHTML=barHtml(key);}
const origCards=root.renderTeacherAssignmentCards;
if(typeof origCards==='function'){
  root.renderTeacherAssignmentCards=function(list){
    if(!Array.isArray(list)||!list.length)return origCards.apply(this,arguments);
    return list.map(a=>{const key='a:'+a.id;REG.set(key,[a]);const h=origCards.call(this,[a]);return h.replace(/<\/div>\s*$/,barHtml(key)+'</div>');}).join('');
  };
}
const origBatch=root.taBatchCard;
if(typeof origBatch==='function'){
  root.taBatchCard=function(b){
    const h=origBatch.apply(this,arguments);if(!b||!Array.isArray(b.items))return h;
    const key='b:'+b.key;REG.set(key,b.items);
    // put the bar before the hidden students box of the batch card
    const i=h.lastIndexOf('<div id="taBody_');
    return i>0?h.slice(0,i)+barHtml(key)+h.slice(i):h.replace(/<\/div>\s*$/,barHtml(key)+'</div>');
  };
}

/* ---------- 3. publish / hide ---------- */
async function updateAll(items,patch){
  const ids=items.map(a=>a.id);
  for(let i=0;i<ids.length;i+=100){
    const {error}=await sb.from('assignments').update(patch).in('id',ids.slice(i,i+100));
    if(error)throw new Error(error.message+(/column/.test(error.message||'')?' — run V30_ASSIGNMENT_SCHEDULE.sql in Supabase first.':''));
  }
  items.forEach(a=>Object.assign(a,patch));
}
root.v30Publish=async function(key,on){
  const items=REG.get(key)||[],st=state(items);if(!items.length)return;
  const sch=items.filter(a=>a.end_at);
  if(on){
    let msg=`Publish the results of “${items[0].title}”?\n\nStudents will see their answers, the answer key, explanations and the class analysis.`;
    if(!st.closed)msg+=`\n\n⚠ The end time (${fmt(st.end)}) has NOT passed yet. Students who have not submitted can still see nothing, but students who submitted will see the answers now.`;
    if(!confirm(msg))return;
  }else if(!confirm('Hide the results again? Students will only see their score until you publish again.'))return;
  try{await updateAll(sch,{results_published_at:on?new Date().toISOString():null});repaint(key);if($('v30mPub'))$('v30mPub').innerHTML=barHtml(key,true).replace(/id="v30Bar_[^"]*"/,'');try{jnvstQbToast(on?'Results published':'Results hidden')}catch(_){say(on?'Results published.':'Results hidden.')}}
  catch(e){say('Could not change: '+(e.message||e));}
};

/* ---------- 4. 📅 Schedule / Extend window ---------- */
function closeModal(){$('v30Modal')?.remove();}
root.v30Close=closeModal;
root.v30Open=async function(key){
  const items=REG.get(key)||[];if(!items.length)return;
  if(!(await checkReady()))return say('Run V30_ASSIGNMENT_SCHEDULE.sql in the Supabase SQL Editor first, then press Ctrl+Shift+R.');
  closeModal();
  const st=state(items),batch=key.startsWith('b:'),a0=items[0];
  const d=document.createElement('div');d.id='v30Modal';
  d.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.6);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto';
  d.innerHTML=`<div style="background:#fff;border-radius:14px;max-width:760px;width:100%;padding:18px 20px;box-shadow:0 20px 50px rgba(0,0,0,.3)">
   <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h2 style="margin:0">📅 ${escx(a0.title)}</h2><div class="small muted">${batch?`Personalised batch · ${items.length} student(s)`:'Standard assignment'}</div></div><button type="button" class="secondary" onclick="v30Close()">✕ Close</button></div>
   <h3 style="margin:16px 0 6px">1. Start and end ${batch?'(all students of this batch)':'(everyone)'}</h3>
   ${st.scheduled?'':'<div class="notice small">This assignment has no schedule yet. After you save one, it becomes a scheduled assignment: one attempt, the score is shown at once, and the answers + class analysis after you publish.</div>'}
   <div class="grid"><div><label>Start date &amp; time</label><input id="v30mStart" type="datetime-local" value="${toInput(st.start||a0.start_at||(st.scheduled?'':new Date()))}"></div>
   <div><label>End date &amp; time</label><input id="v30mEnd" type="datetime-local" value="${toInput(st.end||'')}"></div></div>
   <div class="actions" style="align-items:center"><span class="small muted">Extend the end by</span>
    <button type="button" class="secondary" onclick="v30Bump('v30mEnd',1/24)">+1 hour</button><button type="button" class="secondary" onclick="v30Bump('v30mEnd',1)">+1 day</button><button type="button" class="secondary" onclick="v30Bump('v30mEnd',7)">+1 week</button>
    <button type="button" onclick="v30SaveWindow('${escx(key)}')" style="font-weight:700">💾 Save start &amp; end</button></div>
   <h3 style="margin:18px 0 6px">2. Extend for some students only</h3>
   <div class="small muted" style="margin-bottom:6px">Tick the students who need more time (for example, absent students) and choose their new end time. Others keep the normal end time.</div>
   <div id="v30mStudents" class="small muted">Loading students…</div>
   <div class="grid" style="margin-top:8px"><div><label>New end time for the ticked students</label><input id="v30mExt" type="datetime-local" value="${toInput(st.end?new Date(Math.max(st.end.getTime(),Date.now())+86400000):'')}"></div></div>
   <div class="actions" style="align-items:center"><button type="button" class="secondary" onclick="v30Bump('v30mExt',1)">+1 day</button>
    <button type="button" onclick="v30SaveExt('${escx(key)}',false)" style="font-weight:700">⏩ Extend ticked students</button>
    <button type="button" class="secondary" onclick="v30SaveExt('${escx(key)}',true)">Remove their extension</button></div>
   <h3 style="margin:18px 0 6px">3. Results</h3>
   <div id="v30mPub">${barHtml(key,true).replace(/id="v30Bar_[^"]*"/,'')}</div>
  </div>`;
  document.body.appendChild(d);
  d.addEventListener('click',e=>{if(e.target===d)closeModal();});
  loadStudents(key);
};
root.v30Bump=function(id,days){const e=$(id);if(!e)return;const cur=e.value?new Date(e.value):new Date();const base=new Date(Math.max(cur.getTime(),Date.now()));e.value=toInput(new Date((e.value?cur:base).getTime()+days*86400000));};

async function names(ids){
  const known=new Map(((root._jnvstStudents)||[]).map(s=>[s.id,s]));
  const miss=ids.filter(id=>!known.has(id));
  for(let i=0;i<miss.length;i+=100){try{const {data}=await sb.from('profiles').select('id,full_name,roll_no').in('id',miss.slice(i,i+100));(data||[]).forEach(p=>known.set(p.id,p));}catch(_){}}
  return known;
}
async function loadStudents(key){
  const box=$('v30mStudents');if(!box)return;
  const items=REG.get(key)||[],batch=key.startsWith('b:');
  try{
    let rows=[];
    if(batch){
      const ids=items.map(a=>a.id),done=new Set();
      for(let i=0;i<ids.length;i+=100){const {data}=await sb.from('attempts').select('assignment_id').in('assignment_id',ids.slice(i,i+100));(data||[]).forEach(r=>done.add(r.assignment_id));}
      const nm=await names(items.map(a=>a.adaptive_for_student_id).filter(Boolean));
      rows=items.map(a=>{const p=nm.get(a.adaptive_for_student_id)||{},sum=a.adaptive_selection_summary||{};return {id:a.id,name:p.full_name||sum.student_name||'Student',roll:p.roll_no||sum.roll_no||'',done:done.has(a.id),until:a.end_at,own:true};});
    }else{
      const a=items[0];
      const {data:links,error}=await sb.from('assignment_students').select('*').eq('assignment_id',a.id);if(error)throw error;
      const {data:att}=await sb.from('attempts').select('student_id,attempt_number').eq('assignment_id',a.id);
      const nm=await names((links||[]).map(l=>l.student_id));
      rows=(links||[]).map(l=>{const p=nm.get(l.student_id)||{};const cur=Number(l.current_attempt_number||1);return {id:l.student_id,name:p.full_name||'Student',roll:p.roll_no||'',done:(att||[]).some(t=>t.student_id===l.student_id&&Number(t.attempt_number||1)===cur),until:l.extended_end_at,own:false};});
    }
    rows.sort((x,y)=>(x.done-y.done)||String(x.name).localeCompare(String(y.name)));
    const notDone=rows.filter(r=>!r.done).length;
    box.innerHTML=rows.length?`<div class="actions" style="margin:0 0 6px"><button type="button" class="secondary" onclick="v30TickAll(true,true)">Tick not submitted (${notDone})</button><button type="button" class="secondary" onclick="v30TickAll(false)">Clear</button></div>
      <div style="max-height:260px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px"><table style="margin:0"><thead><tr><th></th><th>Student</th><th>Status</th><th>${batch?'End time':'Extended until'}</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td><input type="checkbox" class="v30tick" value="${escx(r.id)}" data-done="${r.done?1:0}" style="width:auto"></td><td>${escx(r.name)}${r.roll?` <span class="muted">· ${escx(r.roll)}</span>`:''}</td><td>${r.done?'<span style="color:#166534">✓ Submitted</span>':'<span style="color:#b91c1c">Not submitted</span>'}</td><td>${r.until?fmt(r.until):'<span class="muted">—</span>'}</td></tr>`).join('')}
      </tbody></table></div>`:'<div class="muted">No students are assigned yet.</div>';
  }catch(e){box.innerHTML='<span style="color:#b91c1c">Could not load the students: '+escx(e.message||e)+'</span>';}
}
root.v30TickAll=function(on,onlyNotDone){document.querySelectorAll('#v30Modal .v30tick').forEach(c=>{c.checked=on&&(!onlyNotDone||c.dataset.done!=='1');});};

root.v30SaveWindow=async function(key){
  const items=REG.get(key)||[];
  const s=fromInput($('v30mStart')?.value),e=fromInput($('v30mEnd')?.value);
  if(!e)return say('Choose the End date & time.');
  if(s&&new Date(e)<=new Date(s))return say('The End time must be after the Start time.');
  const was=state(items);
  if(!was.scheduled&&!confirm('Save this schedule? From now on this assignment allows one attempt and the answers are shown only after you publish the results.'))return;
  try{await updateAll(items,{start_at:s,end_at:e});repaint(key);$('v30mPub').innerHTML=barHtml(key,true).replace(/id="v30Bar_[^"]*"/,'');loadStudents(key);
    say(`Saved.\nStart: ${s?fmt(s):'immediately'}\nEnd: ${fmt(e)}${new Date(e)>new Date()&&was.closed?'\n\nThe assignment is open again until the new end time.':''}`);}
  catch(err){say('Could not save: '+(err.message||err));}
};
root.v30SaveExt=async function(key,remove){
  const items=REG.get(key)||[],batch=key.startsWith('b:');
  const ticked=[...document.querySelectorAll('#v30Modal .v30tick:checked')].map(c=>c.value);
  if(!ticked.length)return say('Tick at least one student first.');
  const until=remove?null:fromInput($('v30mExt')?.value);
  if(!remove&&!until)return say('Choose the new end time for the ticked students.');
  if(!remove&&new Date(until)<=new Date())return say('The new end time must be in the future.');
  try{
    if(batch){
      if(remove)return say('In a personalised batch every student has their own assignment: change their end time with “New end time”, or use part 1 for everyone.');
      await updateAll(items.filter(a=>ticked.includes(a.id)),{end_at:until});
    }else{
      const {data,error}=await sb.rpc('teacher_extend_assignment_students',{p_assignment_id:items[0].id,p_student_ids:ticked,p_until:until});
      if(error)throw error;if(!data)throw new Error('No student was changed.');
    }
    repaint(key);await loadStudents(key);
    say(remove?`Extension removed for ${ticked.length} student(s).`:`Extended until ${fmt(until)} for ${ticked.length} student(s).`);
  }catch(e){say('Could not extend: '+(e.message||e));}
};
checkReady();
})();
