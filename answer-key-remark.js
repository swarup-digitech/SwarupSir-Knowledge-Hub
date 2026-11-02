/* V32: changing an answer key re-marks earlier results — teacher side
   Whenever any screen saves a new Correct Answer for a question-bank question or an assignment question
   (Question Bank edit, passage edit, Mock Bank edit, teacher's question editor, an assignment's Edit Questions),
   the app first asks the database what will change and shows it:
     "B → C: 12 earlier answers of 9 students in 3 assignments and 1 mock test will be re-marked."
   OK saves (the database then re-marks everything itself), Cancel does not save.
   Needs V32_ANSWER_KEY_REMARK.sql. Without it, saving works as before (no message, no re-marking). */
(function(){
'use strict';
const root=window;
if(typeof sb==='undefined'||sb.__v32)return;
const TABLES=new Set(['mock_question_bank','questions']);
const K=v=>String(v==null?'':v).trim().toUpperCase();
const toast=m=>{try{jnvstQbToast(m)}catch(_){try{notify(m)}catch(__){}}};
const origFrom=sb.from.bind(sb);

async function check(table,ids,newKey){
  try{
    const nk=K(newKey);if(!ids.length||!nk)return {ok:true};
    const {data:cur,error:ce}=await origFrom(table).select('id,correct_option').in('id',[...new Set(ids)]);
    if(ce||!cur)return {ok:true};
    const changed=cur.filter(r=>K(r.correct_option)!==nk);
    if(!changed.length)return {ok:true};
    const {data:imp,error}=await sb.rpc('v32_answer_key_impact',{p_table:table,p_ids:changed.map(r=>r.id),p_new:nk});
    if(error||!imp)return {ok:true};                      // V32 SQL not installed: save as before
    const chg=Number(imp.changes)||0;
    if(!chg)return {ok:true};                             // nobody's result changes
    const old=[...new Set(changed.map(r=>K(r.correct_option)||'—'))].join(' / ');
    const where=[imp.assignments?`${imp.assignments} assignment${imp.assignments==1?'':'s'}`:'',imp.mock_tests?`${imp.mock_tests} mock test${imp.mock_tests==1?'':'s'}`:''].filter(Boolean).join(' and ');
    const ok=confirm(`Correct Answer changes: ${old} → ${nk}\n\n`+
      `This question was answered ${imp.answers} time(s) in ${where||'earlier exams'}.\n`+
      `${chg} answer(s) of ${imp.students} student(s) will change between right and wrong.\n\n`+
      `Their scores${imp.mock_tests?', mock test marks':''} and the Mistake Bank / Student progress will be RE-MARKED automatically. OMR results are not changed.\n\n`+
      `OK = save and re-mark      Cancel = do not save`);
    return {ok,chg,students:imp.students};
  }catch(_){return {ok:true};}
}

sb.from=function(table){
  const q=origFrom(table);
  if(!TABLES.has(table)||!q||typeof q.update!=='function')return q;
  const upd=q.update.bind(q);
  q.update=function(payload,opts){
    const b=upd(payload,opts);
    if(!payload||Array.isArray(payload)||!Object.prototype.hasOwnProperty.call(payload,'correct_option')||root.__v32Skip)return b;
    const ids=[];
    ['eq','in'].forEach(m=>{const o=typeof b[m]==='function'?b[m].bind(b):null;if(!o)return;
      b[m]=function(k,v){if(k==='id')ids.push(...(m==='in'?(v||[]):[v]));o(k,v);return b;};});
    const othen=b.then.bind(b);let gate=null;
    b.then=function(res,rej){
      gate=gate||check(table,ids,payload.correct_option);
      return gate.then(g=>{
        if(!g.ok)return Promise.resolve({data:null,error:{message:'Not saved — you cancelled the answer key change.'}}).then(res,rej);
        return othen(r=>{if(r&&!r.error&&g.chg)setTimeout(()=>toast(`Saved · ${g.chg} earlier answer(s) of ${g.students} student(s) re-marked`),400);return res?res(r):r;},rej);
      },rej);
    };
    return b;
  };
  return q;
};
sb.__v32=true;
})();

/* V34: ♻ Re-generate results — on assignment cards (via assignment-schedule.js), mock tests and the Question Bank.
   Asks the database what would change with today's answer keys, shows it, and re-marks after OK. */
(function(){
'use strict';
const root=window;
const say=m=>(typeof notify==='function'?notify(m):alert(m));
const toast=m=>{try{jnvstQbToast(m)}catch(_){say(m)}};
root.v34Regen=async function(assignIds,mockIds,label){
  const args={p_assignment_ids:assignIds&&assignIds.length?assignIds:null,p_mock_test_ids:mockIds&&mockIds.length?mockIds:null};
  const all=!args.p_assignment_ids&&!args.p_mock_test_ids;
  try{
    const {data:d,error}=await sb.rpc('v34_regenerate',{...args,p_apply:false});
    if(error)throw new Error(/v34_regenerate|function/.test(error.message||'')&&!/own/.test(error.message||'')?'Run V34_REGENERATE_RESULTS.sql in Supabase first.':error.message);
    const subs=(+d.submissions||0)+(+d.mock_submissions||0);
    if(!(+d.old_keys)&&!(+d.answers)&&!subs)return say(`✓ ${label||'These results'} ${all?'are':'is'} up to date with the current answer keys. Nothing to re-generate.`);
    const lines=[];
    if(+d.old_keys)lines.push(`• ${d.old_keys} question(s) still have an old answer key (they get the Question Bank key)`);
    if(+d.answers)lines.push(`• ${d.answers} student answer(s) change between right and wrong`);
    if(+d.submissions)lines.push(`• ${d.submissions} assignment submission(s) get a new score`);
    if(+d.mock_submissions)lines.push(`• ${d.mock_submissions} mock test submission(s) get new marks`);
    if(+d.students)lines.push(`• ${d.students} student(s) concerned`);
    if(!confirm(`♻ Re-generate results of ${label||'this'} with the current answer keys?\n\n${lines.join('\n')}\n\nThe Mistake Bank / Student progress is corrected too. OMR results are not changed.`))return;
    const {data:r,error:e2}=await sb.rpc('v34_regenerate',{...args,p_apply:true});if(e2)throw e2;
    toast(`♻ Results re-generated: ${(+r.submissions||0)+(+r.mock_submissions||0)} submission(s) re-marked`);
    return r;
  }catch(e){say('Could not re-generate: '+(e.message||e));}
};
// mock tests list: a button next to "Approve Results"
const origMock=root.loadPreviousMockTests;
if(typeof origMock==='function'&&!origMock.__v34){
  const w=async function(){const r=await origMock.apply(this,arguments);
    try{document.querySelectorAll('#previousMockTests button[onclick^="toggleMockResultsRelease("]').forEach(b=>{
      if(b.parentNode.querySelector('.v34-regen'))return;
      const id=(b.getAttribute('onclick').match(/toggleMockResultsRelease\('([^']+)'/)||[])[1];if(!id)return;
      const t=b.closest('.assignment')?.querySelector('h3')?.textContent||'this mock test';
      const x=document.createElement('button');x.type='button';x.className='secondary v34-regen';x.textContent='♻ Re-generate results';
      x.title='Mark all submissions again with the current answer keys';
      x.onclick=async()=>{const res=await root.v34Regen(null,[id],`“${t}”`);if(res)root.loadPreviousMockTests();};
      b.after(x);});}catch(_){}
    return r;};
  w.__v34=true;root.loadPreviousMockTests=w;
}
// Question Bank: one button for everything you manage
const origHome=root.jnvstQuestionBankHome;
if(typeof origHome==='function'&&!origHome.__v34){
  const w=async function(){const r=await origHome.apply(this,arguments);
    try{if(document.getElementById('jnvstQbTable')&&!document.getElementById('v34RegenAll')){
      const tpl=[...document.querySelectorAll('button')].find(b=>/downloadJnvstQuestionTemplate/.test(b.getAttribute('onclick')||''));
      if(tpl){const x=document.createElement('button');x.id='v34RegenAll';x.type='button';x.className='secondary';x.textContent='♻ Re-generate all results';
        x.title='After answer keys were changed: mark every assignment and mock test again with the current keys';
        x.onclick=()=>root.v34Regen(null,null,'all your assignments and mock tests');
        tpl.parentNode.appendChild(x);}}}catch(_){}
    return r;};
  w.__v34=true;root.jnvstQuestionBankHome=w;
}
})();
