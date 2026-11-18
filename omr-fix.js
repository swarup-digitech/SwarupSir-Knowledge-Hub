/* Swarup Sir's Knowledge Hub — V34: correct the answer key of an imported OMR paper / undo an import
 *
 * Opened from Import OMR Results → Previous OMR Imports → "✏️ Correct key / Undo".
 *
 *   ✏️ Correct the answer key   Every question of the paper with its key and how the students marked it.
 *                               Choose a new key (A–D) or Bonus → Preview → Apply. Every imported student is
 *                               re-marked from the answers saved at import time (no rescanning). Only the
 *                               questions whose result changes are changed in the Mistake Bank. The saved
 *                               answer key, the printed copy and (optional) the Question Bank are corrected.
 *   ↩️ Undo import              Removes the imported results (all students or chosen ones) and takes them out
 *                               of the Mistake Bank. The corrected sheet can then be imported again.
 *
 * Needs V34_OMR_KEY_CORRECTION.sql. Loaded by main.html after teacher-app.js.
 */
(function(root){
'use strict';
let F=null;   // state of the open paper
const $=id=>document.getElementById(id);
const E=s=>(typeof esc==='function'?esc(s):String(s??''));
const LET=['A','B','C','D'];
const snip=(t,n)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1)+'…':t;};
const mathHtml=t=>typeof jnvstMathPreview==='function'?jnvstMathPreview(t):E(t);
const typeset=el=>{try{if(typeof jnvstTypesetWhenReady==='function')jnvstTypesetWhenReady([el]);}catch(_){}};
const when=t=>{try{return typeof qpHistoryDate==='function'?qpHistoryDate(t):new Date(t).toLocaleString();}catch(_){return String(t||'');}};
const sqlMissing=e=>/teacher_omr_(key_overview|change_key|undo_import)|function .* does not exist|Could not find the function/i.test(String(e&&e.message||e));
const needSql=`<div class="notice"><b>Run <code>V34_OMR_KEY_CORRECTION.sql</code> in Supabase → SQL Editor first.</b> Then reload this page.</div>`;

// Positions of a question: "Set A Q2 · Set B Q4" or "in 12 personal papers (Q3…)"
function posText(q){
  const p=(q.positions||[]).slice().sort((a,b)=>String(a.set).localeCompare(String(b.set))||a.qno-b.qno);
  const a=p.map(x=>`Set ${x.set} Q${x.qno}`);
  if(q.personal_papers)a.push(`${q.personal_papers} personal paper${q.personal_papers===1?'':'s'}`);
  return a.join(' · ')||'—';
}
// The most chosen option when it is not the key (a sign of a wrong key)
function suspicious(q){
  const m=q.marks||{},key=(q.keys||[])[0];if(q.bonus||!q.answered)return null;
  const best=LET.slice().sort((a,b)=>(m[b]||0)-(m[a]||0))[0];
  if(best&&best!==key&&(m[best]||0)>=Math.max(2,Math.ceil(q.answered*0.4))&&(m[best]||0)>(m[key]||0))return best;
  return null;
}
function bars(q){
  const m=q.marks||{},key=(q.keys||[])[0],tot=Math.max(1,q.answered||0);
  const cell=(lab,n,isKey)=>`<span title="${n} student(s)" style="display:inline-flex;align-items:center;gap:4px;margin:0 8px 2px 0;white-space:nowrap"><b style="${isKey?'color:#166534':''}">${lab}${isKey?' ✓':''}</b><span style="display:inline-block;height:9px;width:${Math.round(60*n/tot)}px;min-width:2px;border-radius:3px;background:${isKey?'#16a34a':'#94a3b8'}"></span><span class="small">${n}</span></span>`;
  return LET.map(l=>cell(l,m[l]||0,l===key&&!q.bonus)).join('')+`<span class="small muted" style="white-space:nowrap">blank ${m.blank||0}${m.multi?` · 2+ marks ${m.multi}`:''}</span>`;
}

async function omrFixOpen(base){
  render(`<div class="wrap">${header('Correct OMR Key')}<div class="card"><p class="muted">Loading paper ${E(base)}…</p></div></div>`);
  try{
    const {data,error}=await sb.rpc('teacher_omr_key_overview',{p_paper_base_serial:base});
    if(error)throw error;
    F={base,ov:data,changes:new Map(),dry:null,undoDry:null,undoSel:new Set()};
    paint();
  }catch(e){
    render(`<div class="wrap">${header('Correct OMR Key')}<div class="card">${sqlMissing(e)?needSql:`<div class="notice">Could not load the paper: ${E(e.message||e)}</div>`}
      <div class="actions"><button class="secondary" onclick="omrImportPage()">← Import OMR Results</button></div></div></div>`);
  }
}

function paint(){
  const ov=F.ov,qs=ov.questions||[];
  const nSus=qs.filter(suspicious).length;
  const hist=(ov.changes||[]).length?`<details style="margin-top:8px"><summary>Earlier key changes (${ov.changes.length})</summary><table><thead><tr><th>When</th><th>Question</th><th>Old</th><th>New</th><th>Students changed</th><th>Bank</th></tr></thead><tbody>${ov.changes.map(c=>{const q=qs.find(x=>x.question_id===c.question_id);return `<tr><td>${E(when(c.changed_at))}</td><td>${q?E(posText(q)):'—'}</td><td>${E(c.old_key||'')}</td><td><b>${E(c.new_key)}</b></td><td>${c.students_changed}</td><td>${c.bank_updated?'corrected':'—'}</td></tr>`;}).join('')}</tbody></table></details>`:'';
  render(`<div class="wrap">${header('Correct OMR Key')}
  <div class="card" style="border:2px solid #0f766e;background:#f0fdfa">
    <h2 style="margin:0">✏️ ${E(ov.title||'Paper')} <span class="tag">${E(ov.subject||'')}</span></h2>
    <p class="muted" style="margin:6px 0 0"><code>${E(ov.base)}</code> · ${ov.personal?`${ov.papers} personal papers`:`${ov.papers} set${ov.papers===1?'':'s'}`} · <b>${ov.students_imported}</b> student${ov.students_imported===1?'':'s'} imported · ${(ov.imports||[]).map(i=>E(when(i.imported_at))).join(', ')||'no import'}</p>
    ${hist}
  </div>

  <div class="card"><h2 style="margin-top:0">1. Correct the answer key</h2>
    <p class="small muted">Choose a new key only for the wrong questions. Every imported student is re-marked from the answers saved at import time — <b>no rescanning</b>. <b>Bonus</b> takes the question out of every student's result and Mistake Bank. Questions marked ⚠ were answered differently by most students.</p>
    ${nSus?`<div class="notice small">⚠ ${nSus} question${nSus===1?'':'s'} where most students chose another option than the key — check ${nSus===1?'it':'them'} first.</div>`:''}
    <div style="overflow:auto"><table id="ofTable"><thead><tr><th>Where</th><th>Question</th><th>Key</th><th>How students marked it</th><th>New key</th></tr></thead><tbody>
    ${qs.map((q,i)=>{const sus=suspicious(q),key=(q.keys||[]).join('/'),cur=F.changes.get(q.question_id)||'';
      return `<tr style="${sus?'background:#fffbeb':''}${cur?';outline:2px solid #0f766e':''}"><td class="small" style="white-space:nowrap">${E(posText(q))}</td>
        <td style="min-width:220px">${q.image_url?`<img src="${E(q.image_url)}" alt="" style="max-width:150px;max-height:80px;display:block;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:3px">`:''}${q.passage_title?`<div class="small muted">📖 ${E(q.passage_title)}</div>`:''}<div>${mathHtml(snip(q.question_text,160))}</div>
          <div class="small">${LET.map(l=>{const v=q['option_'+l.toLowerCase()];return v&&!/^Option [A-D]$/i.test(v)?`<span style="margin-right:10px">${l}. ${mathHtml(snip(v,40))}</span>`:'';}).join('')}</div></td>
        <td style="text-align:center"><b style="font-size:1.1em">${q.bonus?'<span class="tag">Bonus</span>':E(key)}</b>${q.bank_key&&!q.bonus&&q.bank_key!==key?`<div class="small muted">bank: ${E(q.bank_key)}</div>`:''}</td>
        <td>${bars(q)}<div class="small muted">${q.correct}/${q.answered} correct${sus?` · <b style="color:#b45309">⚠ most chose ${sus}</b>`:''}</div></td>
        <td><select onchange="omrFixSet('${E(q.question_id)}',this.value)" style="min-width:120px"><option value="">No change</option>${LET.filter(l=>l!==key||q.bonus).map(l=>`<option value="${l}" ${cur===l?'selected':''}>${l}${l===sus?' (most chose)':''}</option>`).join('')}${q.bonus?'':`<option value="BONUS" ${cur==='BONUS'?'selected':''}>Bonus (cancel)</option>`}</select></td></tr>`;}).join('')}
    </tbody></table></div>
    <label style="font-weight:400;margin-top:10px;display:block"><input type="checkbox" id="ofBank" checked style="width:auto;margin-right:8px">Also correct the question in the <b>Question Bank</b> (and its other-language copy), so new papers get the right key${(ov.questions||[]).some(q=>q.v32)?' — online assignments and mock tests that used it are re-marked too':''}</label>
    <div class="actions" style="margin-top:10px"><button onclick="omrFixPreview()">1. Preview changes</button><button id="ofApply" ${F.dry?'':'disabled'} onclick="omrFixApply()">2. Apply &amp; re-mark</button><span class="tag" id="ofCount">${F.changes.size} change${F.changes.size===1?'':'s'}</span></div>
    <div id="ofOut" style="margin-top:10px">${F.dry?dryHtml(F.dry):''}</div>
  </div>

  <div class="card"><h2 style="margin-top:0">2. Undo the import (to import the sheet again)</h2>
    <p class="small muted">Use this when the scanned sheet itself was wrong (wrong roll no., misread marks, wrong file). The results are removed and taken out of the Mistake Bank; then import the corrected sheet in <b>Import OMR Results</b>. For a wrong key alone, use step 1 instead — no rescanning needed.</p>
    <label style="font-weight:400;display:block"><input type="radio" name="ofUndoWho" value="all" checked style="width:auto;margin-right:8px" onchange="omrFixUndoWho()">All ${ov.students_imported} students</label>
    <label style="font-weight:400;display:block"><input type="radio" name="ofUndoWho" value="some" style="width:auto;margin-right:8px" onchange="omrFixUndoWho()">Only these students:</label>
    <div id="ofUndoList" style="display:none;max-height:240px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;margin:6px 0">${(ov.students||[]).map(s=>`<label style="font-weight:400;display:block"><input type="checkbox" style="width:auto;margin-right:6px" ${F.undoSel.has(s.id)?'checked':''} onchange="omrFixUndoPick('${E(s.id)}',this.checked)">${E(s.roll_no||'')} ${E(s.name||'')} <span class="small muted">${ov.personal?'':'Set '+E(s.set_code||'')}</span></label>`).join('')||'<span class="muted small">No imported students.</span>'}</div>
    <div class="actions" style="margin-top:8px"><button class="secondary" onclick="omrFixUndo(true)">1. Preview undo</button><button id="ofUndoGo" class="danger" style="background:#dc2626" ${F.undoDry?'':'disabled'} onclick="omrFixUndo(false)">2. Undo import</button></div>
    <div id="ofUndoOut" style="margin-top:8px"></div>
  </div>
  <div class="actions"><button class="secondary" onclick="omrImportPage()">← Import OMR Results</button></div>
  </div>`);
  typeset($('ofTable'));
}
function omrFixSet(qid,val){if(val)F.changes.set(qid,val);else F.changes.delete(qid);F.dry=null;const b=$('ofApply');if(b)b.disabled=true;const c=$('ofCount');if(c)c.textContent=`${F.changes.size} change${F.changes.size===1?'':'s'}`;const o=$('ofOut');if(o)o.innerHTML='';}
function changeList(){return [...F.changes.entries()].map(([question_id,new_key])=>({question_id,new_key}));}
function dryHtml(d){
  const qs=F.ov.questions||[];
  const rows=(d.changes||[]).map(c=>{const q=qs.find(x=>x.question_id===c.question_id);
    let bank={updated:d.dry_run?'will be corrected':'corrected',not_yours:'not yours — ask the Admin to correct it',approved_locked:'approved by the Admin — ask the Admin to correct it',deleted:'question deleted',not_changed:'—'}[c.bank]||c.bank;
    const on=c.online;if(c.bank==='updated'&&on&&(on.assignments||on.mock_tests))bank+=` · online: ${on.assignments||0} assignment${on.assignments===1?'':'s'}, ${on.mock_tests||0} mock test${on.mock_tests===1?'':'s'} re-marked (${on.changes||0} answer${on.changes===1?'':'s'} change, ${on.students||0} student${on.students===1?'':'s'})`;
    return `<tr><td>${q?E(posText(q)):''}</td><td>${E(c.old_key)} → <b>${E(c.new_key==='BONUS'?'Bonus':c.new_key)}</b></td><td>${c.new_key==='BONUS'?`<b>${c.removed}</b> result${c.removed===1?'':'s'} removed`:`<span class="result-correct">+${c.to_correct} now correct</span> · <span class="result-wrong">${c.to_wrong} now wrong</span>`}</td><td class="small">${E(c.new_key==='BONUS'?'—':bank)}</td></tr>`;}).join('');
  const tot=(d.changes||[]).reduce((s,c)=>s+c.to_correct+c.to_wrong+c.removed,0);
  return `<div class="${d.dry_run?'notice':'success'}"><b>${d.dry_run?'Preview — nothing changed yet':'Done — results re-marked'}:</b> ${tot} student result${tot===1?'':'s'} ${d.dry_run?'will change':'changed'}.</div>
    <div style="overflow:auto"><table><thead><tr><th>Question</th><th>Key</th><th>Students</th><th>Question Bank</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
async function omrFixPreview(){
  if(!F.changes.size)return notify('Choose a new key for at least one question.');
  try{
    const {data,error}=await sb.rpc('teacher_omr_change_key',{p_paper_base_serial:F.base,p_changes:changeList(),p_fix_bank:!!$('ofBank')?.checked,p_dry_run:true});
    if(error)throw error;
    F.dry=data;$('ofOut').innerHTML=dryHtml(data);$('ofApply').disabled=false;
  }catch(e){$('ofOut').innerHTML=sqlMissing(e)?needSql:`<div class="notice">Preview failed: ${E(e.message||e)}</div>`;}
}
async function omrFixApply(){
  if(!F.dry)return;
  if(!confirm(`Change ${F.changes.size} key${F.changes.size===1?'':'s'} and re-mark all imported students of this paper?`))return;
  const btn=$('ofApply');btn.disabled=true;
  try{
    const bank=!!$('ofBank')?.checked;
    const {data,error}=await sb.rpc('teacher_omr_change_key',{p_paper_base_serial:F.base,p_changes:changeList(),p_fix_bank:bank,p_dry_run:false});
    if(error)throw error;
    const done=dryHtml(data);
    const {data:ov,error:e2}=await sb.rpc('teacher_omr_key_overview',{p_paper_base_serial:F.base});
    if(!e2&&ov)F.ov=ov;
    F.changes=new Map();F.dry=null;paint();
    $('ofOut').innerHTML=done+`<div class="small muted" style="margin-top:6px">Result reports, the class discussion PDF and the students' result pages now use the new key. Reprint the papers from Generated History if you need an answer key copy. If your OMR software has a key column, correct it there too before importing more sheets of this paper.</div>`;
    notify('Answer key corrected and results re-marked.','success');
  }catch(e){btn.disabled=false;$('ofOut').innerHTML=`<div class="notice">Could not apply: ${E(e.message||e)}</div>`;}
}
function omrFixUndoWho(){const some=document.querySelector('input[name="ofUndoWho"]:checked')?.value==='some';$('ofUndoList').style.display=some?'':'none';F.undoDry=null;$('ofUndoGo').disabled=true;$('ofUndoOut').innerHTML='';}
function omrFixUndoPick(id,on){on?F.undoSel.add(id):F.undoSel.delete(id);F.undoDry=null;$('ofUndoGo').disabled=true;$('ofUndoOut').innerHTML='';}
async function omrFixUndo(dry){
  const some=document.querySelector('input[name="ofUndoWho"]:checked')?.value==='some';
  const ids=some?[...F.undoSel]:null;
  if(some&&!ids.length)return notify('Tick the students whose import should be undone.');
  if(!dry&&!confirm(`Remove the imported results of ${some?ids.length+' student(s)':'ALL students'} for this paper and take them out of the Mistake Bank?`))return;
  try{
    const {data,error}=await sb.rpc('teacher_omr_undo_import',{p_paper_base_serial:F.base,p_student_ids:ids,p_dry_run:!!dry});
    if(error)throw error;
    if(dry){F.undoDry=data;$('ofUndoGo').disabled=false;$('ofUndoOut').innerHTML=`<div class="notice"><b>Preview:</b> ${data.students} student${data.students===1?'':'s'} · ${data.responses} answers will be removed and taken out of the Mistake Bank.</div>`;return;}
    $('ofUndoOut').innerHTML=`<div class="success"><b>Undone:</b> ${data.students} student${data.students===1?'':'s'} (${data.responses} answers) removed from this paper and from the Mistake Bank. You can import the corrected sheet now.<div class="actions" style="margin-top:8px"><button onclick="omrImportPage()">📥 Import OMR Results</button></div></div>`;
    F.undoDry=null;$('ofUndoGo').disabled=true;
    const {data:ov}=await sb.rpc('teacher_omr_key_overview',{p_paper_base_serial:F.base});if(ov)F.ov=ov;
    notify('Import undone.','success');
  }catch(e){$('ofUndoOut').innerHTML=sqlMissing(e)?needSql:`<div class="notice">Could not undo: ${E(e.message||e)}</div>`;}
}

/* Questions made Bonus with this tool are skipped again when more sheets of the paper are imported:
   the import page asks this for each student row (by set, or by roll no. for personal papers). */
function omrSavedBonusFor(candidate){
  const recs=(candidate&&candidate.recs)||[];
  const bySet=new Map(),byRoll=new Map();
  recs.forEach(r=>{
    const s=new Set();((r.answer_key_snapshot&&r.answer_key_snapshot.rows)||[]).forEach(x=>{if(x&&x.Bonus)s.add(Number(x['Q.No.']));});
    if(!s.size)return;
    const roll=String(r.roll_no||(r.paper_snapshot&&r.paper_snapshot.roll_no)||'').trim();
    if(roll&&(r.is_custom==='true'||r.is_custom===true||(r.paper_snapshot&&r.paper_snapshot.custom)))byRoll.set(roll,s);
    else bySet.set(String(r.set_code||'A').toUpperCase(),s);
  });
  return row=>byRoll.get(String(row.roll||'').trim())||bySet.get(String(row.set||'').toUpperCase())||new Set();
}

Object.assign(root,{omrFixOpen,omrFixSet,omrFixPreview,omrFixApply,omrFixUndoWho,omrFixUndoPick,omrFixUndo,omrSavedBonusFor,omrFixState:()=>F});
})(window);
