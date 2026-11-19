/* Swarup Sir's Knowledge Hub — V35 Most-missed questions (Question Bank)
 *
 * Shows the questions that students get wrong most often, with how many students and what %,
 * and makes the Discussion PDF (one question per wide page, writing space for the pen tablet)
 * from them in one click.
 *   Admin   : all students of the Admin's groups.   Teacher : students of their groups, own subjects only.
 * Needs V35_MOST_MISSED_QUESTIONS.sql (database) and omr-discussion.js (the PDF).
 * Opened with  mostMissedOpen()  from the Question Bank buttons.
 */
(function(root){
'use strict';
const q$=id=>document.getElementById(id);
const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=(m,t)=>{try{(typeof notify==='function'?notify:alert)(m,t);}catch(_){alert(m);}};
const isImageText=t=>/^\[(?:PDF\/)?IMAGE QUESTION[^\]]*\]$/i.test(String(t||'').trim());
const txt=t=>typeof jnvstMathPreview==='function'?jnvstMathPreview(t):e(t);
const COLS='id,subject_id,lesson_id,topic,part_code,language,question_text,image_url,passage_title,variation_group';
let ST={rows:[],qs:new Map(),pick:new Set(),loaded:false,failed:''};

async function load(){
  ST.rows=[];ST.qs=new Map();ST.failed='';
  const minAtt=Number(q$('mmAtt')?.value||3), top=Number(q$('mmTop')?.value||50);
  const {data,error}=await sb.rpc('question_bank_most_missed',{p_min_attempts:minAtt,p_limit:1000});
  if(error){ST.failed=/question_bank_most_missed|schema cache|does not exist/i.test(error.message||'')
    ?'Run V35_MOST_MISSED_QUESTIONS.sql in Supabase → SQL Editor first, then press Ctrl+Shift+R.'
    :'Could not load: '+(error.message||error);return;}
  ST.rows=data||[];
  const ids=ST.rows.map(r=>r.mock_question_id);
  for(let i=0;i<ids.length;i+=100){
    const {data:qs,error:qe}=await sb.from('mock_question_bank').select(COLS).in('id',ids.slice(i,i+100));
    if(qe){ST.failed='Could not load the questions: '+qe.message;return;}
    (qs||[]).forEach(q=>ST.qs.set(q.id,q));
  }
  ST.rows=ST.rows.filter(r=>ST.qs.has(r.mock_question_id));   // only questions this user may see
  ST.loaded=true;
}
function shown(){
  const minPct=Number(q$('mmPct')?.value||0), top=Number(q$('mmTop')?.value||50);
  const lang=q$('mmLang')?.value||'', part=q$('mmPart')?.value||'';
  return ST.rows.filter(r=>{
    const q=ST.qs.get(r.mock_question_id);
    if(Number(r.wrong_pct)<minPct)return false;
    if(lang&&String(q.language||'').toUpperCase()!==lang)return false;
    if(part&&String(q.part_code||'')!==part)return false;
    return true;
  }).slice(0,top);
}
function paint(){
  const box=q$('mmRows');if(!box)return;
  if(ST.failed){box.innerHTML=`<div class="notice">${e(ST.failed)}</div>`;return;}
  const rows=shown();
  const parts=[...new Set(ST.rows.map(r=>ST.qs.get(r.mock_question_id).part_code).filter(Boolean))].sort();
  const ps=q$('mmPart');if(ps&&ps.options.length<=1)ps.innerHTML='<option value="">All types</option>'+parts.map(p=>`<option value="${e(p)}">${e(typeof mockPartLabel==='function'?mockPartLabel(p):p)}</option>`).join('');
  const n=q$('mmCount');if(n)n.textContent=`${rows.length} question${rows.length===1?'':'s'} shown`;
  box.innerHTML=rows.length?rows.map((r,i)=>{
    const q=ST.qs.get(r.mock_question_id),id=q.id;
    const t=isImageText(q.question_text)||!String(q.question_text||'').trim()?'🖼 Picture question':txt(String(q.question_text).slice(0,260));
    const pct=Number(r.wrong_pct),col=pct>=70?'#dc2626':pct>=50?'#d97706':'#475569';
    return `<label style="display:flex;gap:12px;align-items:flex-start;padding:10px;border:1px solid #e2e8f0;border-radius:10px;margin:6px 0;background:${ST.pick.has(id)?'#fff7ed':'#fff'};cursor:pointer">
      <input type="checkbox" style="width:22px;height:22px;margin-top:3px;flex:none" ${ST.pick.has(id)?'checked':''} onchange="mostMissedTick('${id}',this.checked)">
      <div style="flex:none;text-align:center;min-width:74px"><div style="font-size:22px;font-weight:800;color:${col}">${pct}%</div><div class="small muted">wrong</div></div>
      <div style="flex:1;min-width:0"><div style="line-height:1.45">${q.passage_title?`<span class="tag">Passage: ${e(q.passage_title)}</span> `:''}${t}</div>
        <div class="small muted" style="margin-top:4px">#${i+1} · ${r.wrong_answers} of ${r.answers} answers wrong · ${r.students_wrong} of ${r.students_tried} students got it wrong · <b>${r.students_still}</b> still not fixed${q.topic?' · '+e(q.topic):''}${q.language?' · '+e(q.language):''}</div></div>
      </label>`;}).join('')
    :'<div class="notice">No question matches. Lower “Minimum answers” or “Wrong at least”. Students must have answered questions from the Question Bank (online tests, assignments or imported OMR exams).</div>';
  count();
}
function count(){const c=q$('mmSel');if(c)c.textContent=ST.pick.size;}
async function refresh(){const b=q$('mmRows');if(b)b.innerHTML='<div class="muted">Loading…</div>';await load();ST.pick=new Set(shown().map(r=>r.mock_question_id));paint();}
function mostMissedTick(id,on){on?ST.pick.add(id):ST.pick.delete(id);paint();}
function mostMissedAll(on){shown().forEach(r=>on?ST.pick.add(r.mock_question_id):ST.pick.delete(r.mock_question_id));paint();}
function mostMissedPdf(){
  const ids=shown().map(r=>r.mock_question_id).filter(id=>ST.pick.has(id));   // worst first
  if(!ids.length)return say('Tick at least one question first.');
  if(typeof bankDiscussionPdf!=='function')return say('Upload the new omr-discussion.js and press Ctrl+Shift+R.');
  bankDiscussionPdf(ids);
  setTimeout(()=>{const t=q$('bdTitle');if(t&&t.value==='Class discussion')t.value='Most missed questions';},0);
}
function mostMissedOpen(){
  const old=q$('mmDlg');if(old)old.remove();
  const d=document.createElement('div');d.id='mmDlg';
  d.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99990;display:flex;align-items:center;justify-content:center;padding:14px';
  d.innerHTML=`<div class="card" style="max-width:980px;width:100%;margin:0;max-height:94vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
      <div><h2 style="margin:0">⚠ Most missed questions</h2><div class="small muted">Questions your students get wrong most often, worst first. Tick the ones to discuss, then download the PDF.</div></div>
      <button class="secondary" onclick="document.getElementById('mmDlg').remove()">Close</button></div>
    <div class="grid" style="margin-top:10px">
      <div><label>Wrong at least</label><select id="mmPct" onchange="mostMissedRefilter()"><option value="0">Any</option><option value="30">30%</option><option value="50" selected>50%</option><option value="70">70%</option></select></div>
      <div><label>Minimum answers</label><select id="mmAtt" onchange="mostMissedRefresh()"><option value="2">2</option><option value="3" selected>3</option><option value="5">5</option><option value="10">10</option></select></div>
      <div><label>Show top</label><select id="mmTop" onchange="mostMissedRefilter()"><option value="10">10</option><option value="20">20</option><option value="50" selected>50</option><option value="100">100</option></select></div>
      <div><label>Language</label><select id="mmLang" onchange="mostMissedRefilter()"><option value="">All</option><option value="ENGLISH">English</option><option value="ASSAMESE">Assamese</option><option value="COMMON">Common (MAT)</option></select></div>
      <div><label>Type</label><select id="mmPart" onchange="mostMissedRefilter()"><option value="">All types</option></select></div></div>
    <div class="actions" style="margin:10px 0;align-items:center">
      <button class="secondary" onclick="mostMissedAll(true)">Tick all shown</button><button class="secondary" onclick="mostMissedAll(false)">Clear</button>
      <button onclick="mostMissedPdf()" style="background:#0f766e;color:#fff;border:0;font-weight:700">📽 Discussion PDF (<span id="mmSel">0</span> ticked)</button>
      <span id="mmCount" class="small muted"></span></div>
    <div id="mmRows" style="overflow:auto;flex:1;min-height:200px"><div class="muted">Loading…</div></div></div>`;
  document.body.appendChild(d);
  d.addEventListener('click',ev=>{if(ev.target===d)d.remove();});
  refresh();
}
function mostMissedRefilter(){ST.pick=new Set(shown().map(r=>r.mock_question_id));paint();}
root.mostMissedOpen=mostMissedOpen;root.mostMissedTick=mostMissedTick;root.mostMissedAll=mostMissedAll;
root.mostMissedPdf=mostMissedPdf;root.mostMissedRefresh=refresh;root.mostMissedRefilter=mostMissedRefilter;
})(window);
