/* Swarup Sir's Knowledge Hub — V20 Assamese explanations (JNVST / Mock question bank)
 *
 * - Shows how many Assamese explanations are waiting / machine-translated / checked.
 * - Translates queued explanations automatically (Edge Function `translate-explanations`)
 *   every time the Question Bank is opened, so new questions get Assamese explanations
 *   without any extra step.
 * - Adds an "Assamese explanation" filter and a badge in the Question Bank table, so the
 *   teacher can find machine translations to check and correct.
 * Loaded by main.html after the other teacher modules. Needs V20_ASSAMESE_EXPLANATIONS.sql;
 * without it this module stays silent and everything works as before.
 */
(function(root){
'use strict';
const FN='translate-explanations';
const AS_LANGS=['ASSAMESE','COMMON'];
const needsAs=q=>q&&AS_LANGS.includes(String(q.language||'').toUpperCase());
const st=q=>String(q&&q.explanation_as_status||'');
let running=false,serviceProblem='',lastRun=null;
// jnvstQbCache / jnvstQbSelected are top-level `let` variables of main.html (not window properties).
const cache=()=>{try{return jnvstQbCache||[]}catch(_){return []}};
const selected=()=>{try{return jnvstQbSelected||new Set()}catch(_){return new Set()}};

root.jnvstExplAsOn=root.jnvstExplAsOn||false;
root.jnvstHasAssamese=t=>/[ঀ-৿]/.test(String(t||''));

function badge(q){
  if(!root.jnvstExplAsOn||!needsAs(q))return '';
  const s=st(q);
  const b=(bg,fg,t,title)=>`<span class="tag" title="${esc(title)}" style="background:${bg};color:${fg}">${t}</span>`;
  if(s==='AUTO')return b('#e0f2fe','#075985','অ Auto — check','Assamese explanation was translated automatically. Please check it.');
  if(s==='REVIEWED')return b('#dcfce7','#166534','অ Checked','Assamese explanation checked by the teacher.');
  if(s==='PENDING')return b('#fef9c3','#854d0e','অ Waiting','Waiting for automatic translation.');
  if(s==='FAILED')return b('#fee2e2','#991b1b','অ Failed',q.explanation_as_error||'Translation failed.');
  return '';
}
root.jnvstExplAsBadge=badge;

function counts(){
  const c={PENDING:0,AUTO:0,REVIEWED:0,FAILED:0};
  cache().forEach(q=>{if(needsAs(q)&&c[st(q)]!==undefined)c[st(q)]++;});
  return c;
}

function renderBar(msg){
  const el=document.getElementById('jnvstExplAsBar');if(!el)return;
  const c=counts();
  const busy=running?'disabled':'';
  el.innerHTML=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <b>🌐 Assamese explanations</b>
    <span class="tag" style="background:#fef9c3;color:#854d0e">Waiting: ${c.PENDING}</span>
    <span class="tag" style="background:#e0f2fe;color:#075985">Auto-translated, to check: ${c.AUTO}</span>
    <span class="tag" style="background:#dcfce7;color:#166534">Checked: ${c.REVIEWED}</span>
    ${c.FAILED?`<span class="tag" style="background:#fee2e2;color:#991b1b">Failed: ${c.FAILED}</span>`:''}
  </div>
  <div class="actions" style="margin-top:8px">
    <button ${busy} onclick="jnvstExplAsRun({retryFailed:false})">🌐 Translate waiting now</button>
    ${c.FAILED?`<button class="secondary" ${busy} onclick="jnvstExplAsRun({retryFailed:true})">↻ Retry failed</button>`:''}
    <button class="secondary" onclick="jnvstExplAsShow('AUTO')">🔎 Show auto-translated (to check)</button>
    <button class="secondary" onclick="jnvstExplAsMarkSelected()">✓ Mark selected as checked</button>
  </div>
  <div id="jnvstExplAsMsg" class="small ${serviceProblem?'':'muted'}" style="margin-top:6px;${serviceProblem?'color:#991b1b':''}">${msg?esc(msg):serviceProblem?esc(serviceProblem):'New questions are translated automatically when you open the Question Bank. Edit a question to correct its Assamese explanation — corrected ones are never replaced.'}</div>`;
}

function addFilter(){
  if(document.getElementById('jnvstQbExplAsFilter'))return;
  const anchor=document.getElementById('jnvstQbCommonFilter');const cell=anchor&&anchor.closest('div');if(!cell||!cell.parentNode)return;
  const d=document.createElement('div');
  d.innerHTML=`<label>Assamese explanation</label><select id="jnvstQbExplAsFilter" onchange="jnvstQbRenderTable()"><option value="">All questions</option><option value="AUTO">Auto-translated (to check)</option><option value="REVIEWED">Checked</option><option value="PENDING">Waiting</option><option value="FAILED">Failed</option><option value="ANY">Has an Assamese explanation</option></select>`;
  cell.parentNode.insertBefore(d,cell.nextSibling);
}

async function invoke(body){
  const {data,error}=await sb.functions.invoke(FN,{body});
  if(error){
    let m=error.message||String(error);
    try{const j=await error.context.json();if(j&&j.error)m=j.error;}catch(_){}
    if(/Failed to send|not found|404|FunctionsFetchError|FunctionsRelayError/i.test(m))m='The translate-explanations function is not deployed yet ('+m+'). See CHANGES_V20.md.';
    throw new Error(m);
  }
  if(data&&data.error)throw new Error(data.error);
  return data||{};
}

// Re-read only the Assamese fields and merge them into the cached rows.
async function refreshStatuses(){
  const map=new Map();
  for(let from=0;;from+=1000){
    const {data,error}=await sb.from('mock_question_bank').select('id,explanation_as,explanation_as_status,explanation_as_error')
      .eq('teacher_id',current.id).in('language',AS_LANGS).order('id').range(from,from+999);
    if(error)throw error;(data||[]).forEach(r=>map.set(r.id,r));if(!data||data.length<1000)break;
  }
  cache().forEach(q=>{const r=map.get(q.id);if(r)Object.assign(q,r);});
}

async function run(opts){
  opts=opts||{};
  if(running||!root.jnvstExplAsOn)return;
  running=true;serviceProblem='';
  let done=0,failed=0,remaining=0;
  try{
    renderBar('Translating…');
    for(let round=0;round<60;round++){
      const r=await invoke({limit:24,retry_failed:!!opts.retryFailed&&round===0});
      done+=r.translated||0;failed+=r.failed||0;remaining=r.remaining||0;
      renderBar(`Translating… ${done} done${failed?`, ${failed} failed`:''}${remaining?`, ${remaining} waiting`:''}`);
      if(!remaining||(!(r.translated||0)&&!(r.failed||0)))break;
    }
    await refreshStatuses();
    lastRun=new Date();
    const msg=done||failed?`Translated ${done} explanation${done===1?'':'s'} into Assamese${failed?` · ${failed} failed (open the question to see why, or press Retry)`:''}. Please check the auto-translated ones.`:'Nothing waiting for translation.';
    if(!opts.quiet||done||failed){try{jnvstQbToast(`${done} Assamese explanation${done===1?'':'s'} ready`)}catch(_){}}
    running=false;
    if(document.getElementById('jnvstQbTable'))jnvstQbRenderTable();
    renderBar(msg);
  }catch(e){
    running=false;serviceProblem='Automatic translation could not run: '+(e.message||e);
    try{await refreshStatuses();}catch(_){}
    renderBar();
  }
}
root.jnvstExplAsRun=run;

root.jnvstExplAsShow=function(v){const s=document.getElementById('jnvstQbExplAsFilter');if(s){s.value=v;jnvstQbRenderTable();s.scrollIntoView({block:'center'});}};

root.jnvstExplAsMarkSelected=async function(){
  const ids=[...selected()].filter(id=>{const q=cache().find(x=>x.id===id);return q&&st(q)==='AUTO'&&q.explanation_as;});
  if(!ids.length)return notify('Tick the questions whose auto-translated Assamese explanation you have checked, then press this button. (Only questions marked “অ Auto — check” are changed.)');
  if(!confirm(`Mark the Assamese explanation of ${ids.length} question(s) as checked?\n\nChecked explanations are never replaced by automatic translation.`))return;
  try{
    for(let i=0;i<ids.length;i+=100){
      const {error}=await sb.from('mock_question_bank').update({explanation_as_status:'REVIEWED'}).in('id',ids.slice(i,i+100)).eq('teacher_id',current.id).eq('explanation_as_status','AUTO');
      if(error)throw error;
    }
    cache().forEach(q=>{if(ids.includes(q.id))q.explanation_as_status='REVIEWED';});
    jnvstQbRenderTable();renderBar(`${ids.length} marked as checked.`);
  }catch(e){notify('Could not mark as checked: '+(e.message||e));}
};

/* ---- hooks into the Question Bank page ---- */
const origFiltered=root.jnvstQbFilteredRows;
if(typeof origFiltered==='function'){
  root.jnvstQbFilteredRows=function(){
    const rows=origFiltered.apply(this,arguments);
    const v=document.getElementById('jnvstQbExplAsFilter')?.value||'';
    if(!v)return rows;
    return rows.filter(q=>needsAs(q)&&(v==='ANY'?!!q.explanation_as:st(q)===v));
  };
}
const origBadges=root.jnvstQbLevelBadges;
if(typeof origBadges==='function'){
  root.jnvstQbLevelBadges=function(q){const b=badge(q);const h=origBadges.apply(this,arguments);return b?h.replace(/<\/div>\s*$/,`${b}</div>`):h;};
}
const origHome=root.jnvstQuestionBankHome;
if(typeof origHome==='function'){
  root.jnvstQuestionBankHome=async function(){
    const out=await origHome.apply(this,arguments);
    const rows=cache();
    if(rows.length)root.jnvstExplAsOn=Object.prototype.hasOwnProperty.call(rows[0],'explanation_as_status');
    else{try{const {error}=await sb.from('mock_question_bank').select('explanation_as_status').limit(1);root.jnvstExplAsOn=!error;}catch(_){root.jnvstExplAsOn=false;}}
    if(!root.jnvstExplAsOn)return out;
    const table=document.getElementById('jnvstQbTable');const card=table&&table.closest('.card');
    if(card&&!document.getElementById('jnvstExplAsBar')){
      const bar=document.createElement('div');bar.className='card';bar.id='jnvstExplAsBar';bar.style.border='2px solid #0ea5e9';
      card.parentNode.insertBefore(bar,card);
    }
    addFilter();renderBar();jnvstQbRenderTable();
    // Automatic: translate whatever is waiting (new uploads, edited English explanations).
    if(counts().PENDING&&!running&&!serviceProblem)run({quiet:true});
    return out;
  };
}
})(typeof window!=='undefined'?window:globalThis);
