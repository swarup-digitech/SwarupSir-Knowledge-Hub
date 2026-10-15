/* Swarup Sir's Knowledge Hub — V23 Bilingual JNVST papers
 *
 * 1. JNVST Question Bank → "🌐 Check missing translations"
 *    Lists every English question without its Assamese version and the other way round,
 *    suggests pairs that belong together, links them, flags linked pairs that disagree,
 *    and lets you type in a missing version.
 * 2. Question Paper Generator (MAT, Arithmetic, EVS)
 *    The questions are chosen once and printed twice: an English-medium and an Assamese-medium
 *    PDF with the same questions, numbering, order and answer key. The Language dropdown only
 *    chooses which language is shown while you pick mandatory questions. Random questions are
 *    taken only from questions that have both versions. Language papers are unchanged.
 *
 * Loaded by main.html after teacher-app.js. If this file is missing, everything works as before.
 */
(function(){
'use strict';
const root=window;
const EN='ENGLISH',AS='ASSAMESE';

/* ---------------------------------------------------------------- helpers */
const up=v=>String(v??'').trim().toUpperCase();
const norm=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
function langOf(q){const v=up(q?.language);if(['ASSAMESE','AS','ASM','ASSAM'].includes(v))return AS;if(['ENGLISH','EN','ENG'].includes(v))return EN;if(['COMMON','MAT','BOTH'].includes(v))return 'COMMON';return v;}
const otherLang=l=>l===EN?AS:l===AS?EN:'';
const langName=l=>l===EN?'English':l===AS?'Assamese':'Common';
const partOf=q=>up(q?.part_code).replace(/[\s-]+/g,'_');
const isLanguageSubject=q=>partOf(q).startsWith('LANGUAGE')||(!partOf(q)&&up(q?.section_code)==='LANGUAGE');
const needsPartner=q=>!!q&&(langOf(q)===EN||langOf(q)===AS)&&!isLanguageSubject(q);
const isPassageQ=q=>!!String(q?.passage_id||'').trim()||['EVS_PASSAGE','LANGUAGE_PASSAGE'].includes(partOf(q));
const groupKeyOf=q=>String(q?.passage_id||q?.set_id||'').trim();
const uuid=()=>(crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);});
const H=s=>(typeof esc==='function'?esc(s):String(s??''));
const preview=(q,o)=>{try{return teacherQuestionPreview(q,o||{width:'120px',height:'85px'});}catch(_){return H(q?.question_text||'');}};
const mathNow=box=>{try{if(root.MathJax?.typesetPromise)root.MathJax.typesetPromise(box?[box]:undefined).catch(()=>{});}catch(_){}};

/* ------------------------------------------------- pair index (saved links) */
// A question's partner is the one question of the other language with the same language_pair_id.
// (Older bulk uploads gave the 5 questions of one passage a shared id inside ONE language; those are not
//  treated as links. When several questions share an id in both languages, they pair by question order.)
function buildPartnerIndex(bank){
  const partner=new Map(),byPair=new Map();
  (bank||[]).forEach(q=>{if(!needsPartner(q))return;const p=String(q.language_pair_id||'').trim();if(!p)return;if(!byPair.has(p))byPair.set(p,[]);byPair.get(p).push(q);});
  byPair.forEach(list=>{
    const en=list.filter(q=>langOf(q)===EN),as=list.filter(q=>langOf(q)===AS);
    if(!en.length||!as.length)return;
    if(en.length===1&&as.length===1){partner.set(en[0].id,as[0]);partner.set(as[0].id,en[0]);return;}
    const ord=q=>String(q.question_order??'');
    en.forEach(e=>{const m=as.filter(a=>ord(a)===ord(e));if(m.length===1&&en.filter(x=>ord(x)===ord(e)).length===1){partner.set(e.id,m[0]);partner.set(m[0].id,e);}});
  });
  return partner;
}
let __idxCache={bank:null,len:-1,idx:null};
function partnerIndexFor(bank){if(__idxCache.bank!==bank||__idxCache.len!==(bank||[]).length){__idxCache={bank,len:(bank||[]).length,idx:buildPartnerIndex(bank)};}return __idxCache.idx;}
root.jnvstBiPartnerIndex=buildPartnerIndex;

// passage groups: complete (5 questions) in one language
function passageGroups(rows){
  const m=new Map();
  (rows||[]).filter(isPassageQ).forEach(q=>{const k=groupKeyOf(q)+'::'+langOf(q);if(!groupKeyOf(q))return;if(!m.has(k))m.set(k,[]);m.get(k).push(q);});
  return [...m.entries()].map(([k,qs])=>{qs.sort((a,b)=>(Number(a.question_order)||0)-(Number(b.question_order)||0));return {key:k,id:groupKeyOf(qs[0]),lang:langOf(qs[0]),questions:qs,title:qs[0].passage_title||'Passage',text:qs.map(x=>String(x.passage_text||'').trim()).find(Boolean)||''};});
}
// A passage group is bilingual-ready when each of its questions has a partner and all partners form one group.
function groupReady(g,idx){
  const ps=g.questions.map(q=>idx.get(q.id));
  if(ps.some(p=>!p))return false;
  const keys=new Set(ps.map(groupKeyOf));
  return keys.size===1&&[...keys][0]!=='';
}

/* ------------------------------------------------------------- suggestions */
function buildSuggestions(bank,idx){
  const unp=(bank||[]).filter(q=>q.active!==false&&needsPartner(q)&&!idx.has(q.id));
  const out=[],used=new Set();
  const mcq=unp.filter(q=>!isPassageQ(q));
  const base=q=>[q.subject_id||'',q.lesson_id||'',partOf(q),norm(q.topic),norm(q.variation_group),up(q.correct_option),String(q.image_url||''),String(q.marks??''),norm(q.difficulty),q.is_fixed?1:0].join('|');
  const run=(rows,keyFn,tier,kind,mk)=>{
    const b=new Map();
    rows.forEach(x=>{const k=keyFn(x);if(!b.has(k))b.set(k,{en:[],as:[]});b.get(k)[x.lang===EN||langOf(x)===EN?'en':'as'].push(x);});
    b.forEach(v=>{const en=v.en.filter(x=>!used.has(x.key||x.id)),as=v.as.filter(x=>!used.has(x.key||x.id));if(en.length===1&&as.length===1){used.add(en[0].key||en[0].id);used.add(as[0].key||as[0].id);out.push(mk(en[0],as[0],tier,kind));}});
  };
  const mkQ=(e,a,tier)=>({tier,kind:'question',en:e,as:a,pairs:[[e,a]]});
  run(mcq,q=>base(q)+'|'+String(q.created_at||''),'sure','question',mkQ);
  run(mcq.filter(q=>!used.has(q.id)),base,'likely','question',mkQ);
  // whole passages
  const groups=passageGroups(unp).filter(g=>g.questions.length===5&&g.questions.every(q=>!idx.has(q.id)));
  const gbase=g=>{const f=g.questions[0];return [f.subject_id||'',f.lesson_id||'',partOf(f),norm(f.topic),norm(f.variation_group),g.questions.map(q=>up(q.correct_option)).join('')].join('|');};
  const mkG=(e,a,tier)=>({tier,kind:'passage',en:e,as:a,pairs:e.questions.map(q=>[q,a.questions.find(x=>String(x.question_order)===String(q.question_order))]).filter(p=>p[1])});
  run(groups,g=>gbase(g)+'|'+String(g.questions[0].created_at||''),'sure','passage',mkG);
  run(groups.filter(g=>!used.has(g.key)),gbase,'likely','passage',mkG);
  return out;
}
function suggestedIds(sugs){const s=new Set();sugs.forEach(x=>x.pairs.forEach(([a,b])=>{s.add(a.id);s.add(b.id);}));return s;}

/* ---------------------------------------------------------------- problems */
function pairProblems(q,p){
  const out=[];
  if(up(q.correct_option)!==up(p.correct_option))out.push(`different correct answers (${langName(langOf(q))} ${up(q.correct_option)||'—'}, ${langName(langOf(p))} ${up(p.correct_option)||'—'})`);
  if(partOf(q)!==partOf(p))out.push('different Part');
  if(String(q.subject_id||'')!==String(p.subject_id||''))out.push('different Subject');
  if(String(q.lesson_id||'')!==String(p.lesson_id||''))out.push('different Lesson');
  if(!!String(q.image_url||'').trim()!==!!String(p.image_url||'').trim())out.push('picture only in one language');
  if((q.active!==false)!==(p.active!==false))out.push('one version is switched off');
  if(isPassageQ(q)!==isPassageQ(p))out.push('one is a passage question, the other is not');
  return out;
}

/* ------------------------------------------------------------- linking API */
async function linkPairs(pairs){
  pairs=(pairs||[]).filter(p=>p&&p[0]&&p[1]);
  if(!pairs.length)return 0;
  // one request when the V23 SQL is installed …
  try{
    const {data,error}=await sb.rpc('jnvst_link_language_pairs',{p_pairs:pairs.map(([a,b])=>({a:a.id,b:b.id}))});
    if(!error)return Number(data||0);
    if(!/function|does not exist|schema cache/i.test(error.message||''))throw error;
  }catch(e){if(!/function|does not exist|schema cache/i.test(e.message||''))throw e;}
  // … otherwise one update per question (10 at a time)
  let n=0;
  for(let i=0;i<pairs.length;i+=10){
    await Promise.all(pairs.slice(i,i+10).map(async([a,b])=>{const id=uuid();const {error}=await sb.from('mock_question_bank').update({language_pair_id:id}).in('id',[a.id,b.id]).eq('teacher_id',current.id);if(error)throw error;n++;}));
  }
  return n;
}

/* =========================================================== REPORT PAGE */
const R={bank:[],idx:null,sugs:[],tab:'missing',subject:'',search:'',limit:50};
async function loadBank(){
  const {data,error}=await sbFetchAll(()=>sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).order('created_at',{ascending:true}));
  if(error)throw error;
  R.bank=data||[];try{jnvstQbCache=R.bank.slice().reverse();}catch(_){}
  R.idx=buildPartnerIndex(R.bank.filter(q=>q.active!==false));
  R.sugs=buildSuggestions(R.bank,R.idx);
}
// jnvstSubjects / jnvstSubjectLessons are top-level "let" variables of main.html (not window properties)
const subjList=()=>{try{return jnvstSubjects||[];}catch(_){return [];}};
const lessonList=()=>{try{return jnvstSubjectLessons||[];}catch(_){return [];}};
const subjName=id=>(subjList().find(s=>String(s.id)===String(id))||{}).name||'No subject';
const lessonName=id=>{const l=lessonList().find(x=>String(x.id)===String(id));return l?`${l.lesson_code||''} ${l.lesson_name||''}`.trim():'No lesson';};

function computeLists(){
  const active=R.bank.filter(q=>q.active!==false);
  const checked=active.filter(needsPartner);
  const sIds=suggestedIds(R.sugs);
  const missing=checked.filter(q=>!R.idx.has(q.id)&&!sIds.has(q.id));
  const seen=new Set(),mism=[];
  checked.forEach(q=>{const p=R.idx.get(q.id);if(!p||seen.has(q.id))return;seen.add(q.id);seen.add(p.id);const pr=pairProblems(q,p);if(pr.length)mism.push({q:langOf(q)===EN?q:p,p:langOf(q)===EN?p:q,problems:pr});});
  const linked=checked.filter(q=>R.idx.has(q.id)).length/2;
  return {checked,missing,mism,linked,sure:R.sugs.filter(s=>s.tier==='sure'),likely:R.sugs.filter(s=>s.tier==='likely'),common:active.filter(q=>langOf(q)==='COMMON').length,languageSubj:active.filter(q=>isLanguageSubject(q)).length};
}
const passFilter=q=>(!R.subject||String(q.subject_id||'')===R.subject)&&(!R.search||[q.question_text,q.topic,q.passage_title,q.variation_group,q.option_a,q.option_b].some(v=>norm(v).includes(R.search)));

root.jnvstTranslationCheck=async function(){
  render(`<div class="wrap">${header('🌐 Missing translations — JNVST Question Bank')}<div class="card"><p class="muted">Checking every English and Assamese question…</p></div></div>`);
  try{await loadBank();}catch(e){return render(`<div class="wrap">${header('🌐 Missing translations')}<div class="card">${message('Could not load the question bank: '+(e.message||e))}</div></div>`);}
  R.limit=50;drawReport();
};
function drawReport(){
  const L=computeLists();
  const subjects=[...new Set(L.checked.map(q=>String(q.subject_id||'')))].map(id=>({id,name:subjName(id)})).sort((a,b)=>a.name.localeCompare(b.name));
  const tab=(k,t,n,color)=>`<button type="button" class="${R.tab===k?'':'secondary'}" onclick="jnvstBiTab('${k}')" ${R.tab===k&&color?`style="background:${color}"`:''}>${t} (${n})</button>`;
  render(`<div class="wrap">${header('🌐 Missing translations — JNVST Question Bank')}
   <div class="card"><div class="notice small">Every English question should have its Assamese version and the other way round, so a question paper can be printed in both languages.
    Checked here: <b>${L.checked.length}</b> English/Assamese questions (switched-off questions are left out).
    Not checked: <b>${L.common}</b> Common (MAT) questions, which serve both languages, and <b>${L.languageSubj}</b> Language-subject questions, which have their own paper for each language.</div>
    <div class="grid" style="margin-top:12px">
     <div class="card" style="margin:0"><div class="muted">Linked pairs</div><div class="stat">${L.linked}</div></div>
     <div class="card" style="margin:0"><div class="muted">Suggested pairs</div><div class="stat">${L.sure.length+L.likely.length}</div></div>
     <div class="card" style="margin:0"><div class="muted">Missing other version</div><div class="stat" style="color:${L.missing.length?'#b45309':'inherit'}">${L.missing.length}</div></div>
     <div class="card" style="margin:0"><div class="muted">Linked but different</div><div class="stat" style="color:${L.mism.length?'#b91c1c':'inherit'}">${L.mism.length}</div></div>
    </div>
    <div class="actions" style="margin-top:12px">${tab('suggest','🔗 Suggested pairs',L.sure.length+L.likely.length,'#16a34a')}${tab('missing','➕ Missing',L.missing.length,'#b45309')}${tab('mismatch','⚠ Linked but different',L.mism.length,'#b91c1c')}<button class="secondary" type="button" onclick="jnvstQuestionBankHome()">← Question Bank</button></div>
    <div class="grid" style="margin-top:10px"><div><label>Subject</label><select id="biSubject" onchange="jnvstBiFilter()"><option value="">All subjects</option>${subjects.map(s=>`<option value="${H(s.id)}" ${R.subject===s.id?'selected':''}>${H(s.name)}</option>`).join('')}</select></div><div><label>Search</label><input id="biSearch" value="${H(R.search)}" placeholder="Question text, topic, variation group…" oninput="jnvstBiSearch()"></div></div>
   </div>
   <div class="card" id="biBody">${R.tab==='suggest'?drawSuggest(L):R.tab==='mismatch'?drawMismatch(L):drawMissing(L)}</div>
  </div>`);
  mathNow(document.getElementById('biBody'));
}
function moreBtn(total){return total>R.limit?`<div class="actions" style="justify-content:center;margin-top:10px"><button type="button" class="secondary" onclick="jnvstBiMore()">Show 50 more · ${total-R.limit} not shown</button></div>`:'';}
function qCard(q,extra){
  const tag=langOf(q)===EN?'<span class="tag">English</span>':'<span class="tag" style="background:#fef3c7;color:#92400e">Assamese</span>';
  return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:9px;background:#fff;min-width:0">${tag} <span class="small muted">${H(q.topic||'')}${q.variation_group?' · '+H(q.variation_group):''} · Answer ${H(up(q.correct_option)||'—')}${q.active===false?' · <b>switched off</b>':''}</span>${q.passage_id?`<div class="small"><b>Passage:</b> ${H(q.passage_title||q.passage_id)} · Q${H(q.question_order||'')}</div>`:''}<div style="margin-top:5px">${preview(q)}</div>${['a','b','c','d'].map(k=>q['option_'+k]?`<div class="small">(${k.toUpperCase()}) ${typeof jnvstMathPreview==='function'?jnvstMathPreview(q['option_'+k]):H(q['option_'+k])}</div>`:'').join('')}${extra||''}</div>`;
}
function drawSuggest(L){
  const list=[...L.sure,...L.likely].filter(s=>passFilter(s.kind==='passage'?s.en.questions[0]:s.en)||passFilter(s.kind==='passage'?s.as.questions[0]:s.as));
  if(!list.length)return '<p class="muted">No suggested pairs. Questions that still have no partner are under ➕ Missing.</p>';
  const nSure=list.filter(s=>s.tier==='sure').length,nLikely=list.length-nSure;
  const head=`<div class="notice small"><b>Sure</b> = uploaded together, same lesson, topic, answer and picture. <b>Likely</b> = same lesson, topic, answer and picture, but uploaded at different times. Look through the pairs, then link them. A wrong link can be undone under ⚠ Linked but different → Unlink.</div>
   <div class="actions" style="margin:10px 0">${nSure?`<button type="button" style="background:#16a34a" onclick="jnvstBiLinkAll('sure')">🔗 Link all ${nSure} sure pairs</button>`:''}${nLikely?`<button type="button" class="secondary" onclick="jnvstBiLinkAll('likely')">🔗 Link all ${nLikely} likely pairs</button>`:''}</div>`;
  const shown=list.slice(0,R.limit);
  return head+shown.map(s=>{
    const i=R.sugs.indexOf(s);
    const badge=s.tier==='sure'?'<span class="tag" style="background:#dcfce7;color:#166534">Sure</span>':'<span class="tag" style="background:#fef9c3;color:#854d0e">Likely</span>';
    const sides=s.kind==='passage'
      ?`<div class="small"><b>Passage pair</b> · 5 questions each</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><b>${H(s.en.title)}</b><div class="small" style="max-height:110px;overflow:auto;white-space:pre-wrap">${H(s.en.text).slice(0,600)}</div></div><div><b>${H(s.as.title)}</b><div class="small" style="max-height:110px;overflow:auto;white-space:pre-wrap">${H(s.as.text).slice(0,600)}</div></div></div>`
      :`<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px">${qCard(s.en)}${qCard(s.as)}</div>`;
    return `<div class="student-card">${badge} <span class="small muted">${H(subjName((s.en.questions?s.en.questions[0]:s.en).subject_id))} → ${H(lessonName((s.en.questions?s.en.questions[0]:s.en).lesson_id))}</span><div style="margin-top:8px">${sides}</div><div class="actions" style="margin-top:8px"><button type="button" onclick="jnvstBiLinkOne(${i})">🔗 Link</button></div></div>`;
  }).join('')+moreBtn(list.length);
}
function drawMissing(L){
  const rows=L.missing.filter(passFilter);
  if(!rows.length)return '<p class="success">No missing versions'+(R.subject||R.search?' for this filter':'')+'. 🎉</p>';
  // passage questions are handled as whole passages
  const groups=passageGroups(rows.filter(isPassageQ));
  const singles=rows.filter(q=>!isPassageQ(q));
  const items=[...groups.map(g=>({type:'g',g,s:g.questions[0].subject_id,l:g.questions[0].lesson_id})),...singles.map(q=>({type:'q',q,s:q.subject_id,l:q.lesson_id}))]
    .sort((a,b)=>subjName(a.s).localeCompare(subjName(b.s))||lessonName(a.l).localeCompare(lessonName(b.l),undefined,{numeric:true}));
  const shown=items.slice(0,R.limit);let lastHead='';
  const html=shown.map(it=>{
    const head=`${subjName(it.s)} → ${lessonName(it.l)}`;const h=head!==lastHead?`<h3 style="margin:14px 0 6px">${H(head)}</h3>`:'';lastHead=head;
    if(it.type==='q'){const miss=langName(otherLang(langOf(it.q)));return h+`<div style="margin:6px 0">${qCard(it.q,`<div class="actions" style="margin-top:7px"><button type="button" onclick="jnvstBiAddMissing('${H(it.q.id)}')">➕ Add ${miss} version</button><button type="button" class="secondary" onclick="jnvstBiPickPartner('${H(it.q.id)}')">🔗 Link to an existing ${miss} question</button><button type="button" class="secondary" onclick="jnvstQbEdit('${H(it.q.id)}')">✎ Edit</button></div>`)}</div>`;}
    const g=it.g,miss=langName(otherLang(g.lang)),complete=g.questions.length===5;
    return h+`<div class="student-card"><span class="tag">${langName(g.lang)} passage</span> <b>${H(g.title)}</b> <span class="small muted">· ${g.questions.length} question(s) without their ${miss} version</span><div class="small" style="max-height:90px;overflow:auto;white-space:pre-wrap;margin-top:5px">${H(g.text).slice(0,500)}</div><div class="actions" style="margin-top:7px">${complete?`<button type="button" onclick="jnvstBiAddMissingPassage('${H(g.id)}','${g.lang}')">➕ Add ${miss} passage (5 questions)</button>`:'<span class="small muted">Incomplete passage — fix it in the Question Bank first.</span>'}<button type="button" class="secondary" onclick="jnvstBiPickPassage('${H(g.id)}','${g.lang}')">🔗 Link to an existing ${miss} passage</button></div></div>`;
  }).join('');
  return `<div class="small muted" style="margin-bottom:6px">${items.length} item(s) · a passage counts as one item.</div>`+html+moreBtn(items.length);
}
function drawMismatch(L){
  const rows=L.mism.filter(m=>passFilter(m.q)||passFilter(m.p));
  if(!rows.length)return '<p class="success">All linked pairs agree. 🎉</p>';
  return rows.slice(0,R.limit).map(m=>`<div class="student-card"><div class="notice small"><b>Problem:</b> ${H(m.problems.join('; '))}</div><div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-top:8px">${qCard(m.q,`<div class="actions" style="margin-top:6px"><button type="button" class="secondary" onclick="jnvstQbEdit('${H(m.q.id)}')">✎ Edit English</button></div>`)}${qCard(m.p,`<div class="actions" style="margin-top:6px"><button type="button" class="secondary" onclick="jnvstQbEdit('${H(m.p.id)}')">✎ Edit Assamese</button></div>`)}</div><div class="actions" style="margin-top:8px"><button type="button" class="danger" onclick="jnvstBiUnlink('${H(m.q.id)}','${H(m.p.id)}')">✂ Unlink (they are not the same question)</button></div></div>`).join('')+moreBtn(rows.length);
}
root.jnvstBiTab=function(t){R.tab=t;R.limit=50;drawReport();};
root.jnvstBiMore=function(){R.limit+=50;const y=window.scrollY;drawReport();window.scrollTo(0,y);};
root.jnvstBiFilter=function(){R.subject=document.getElementById('biSubject')?.value||'';R.limit=50;drawReport();};
let __biT=null;root.jnvstBiSearch=function(){clearTimeout(__biT);__biT=setTimeout(()=>{const el=document.getElementById('biSearch');R.search=norm(el?.value);R.limit=50;const pos=el?.selectionStart;drawReport();const e2=document.getElementById('biSearch');if(e2){e2.focus();try{e2.setSelectionRange(pos,pos);}catch(_){}}},350);};
root.jnvstBiLinkOne=async function(i){const s=R.sugs[i];if(!s)return;try{await linkPairs(s.pairs);notify('Linked.');await loadBank();drawReport();}catch(e){notify('Could not link: '+(e.message||e));}};
root.jnvstBiLinkAll=async function(tier){
  const list=R.sugs.filter(s=>s.tier===tier);const pairs=list.flatMap(s=>s.pairs);if(!pairs.length)return;
  if(!confirm(`Link ${list.length} ${tier} pair(s) (${pairs.length} question pair(s))?${tier==='likely'?'\n\nLikely pairs were uploaded at different times. Please make sure you looked through them.':''}`))return;
  try{const n=await linkPairs(pairs);notify(`${n} question pair(s) linked.`);await loadBank();drawReport();}catch(e){notify('Could not link: '+(e.message||e));}
};
root.jnvstBiUnlink=async function(a,b){if(!confirm('Unlink these two questions? Both will then show as missing their other version.'))return;try{const {error}=await sb.from('mock_question_bank').update({language_pair_id:null}).in('id',[a,b]).eq('teacher_id',current.id);if(error)throw error;await loadBank();drawReport();}catch(e){notify('Could not unlink: '+(e.message||e));}};

/* pick an existing partner by hand */
root.jnvstBiPickPartner=function(id){
  const q=R.bank.find(x=>x.id===id);if(!q)return;const want=otherLang(langOf(q));
  const cands=R.bank.filter(x=>x.active!==false&&langOf(x)===want&&!R.idx.has(x.id)&&!isPassageQ(x)&&String(x.subject_id||'')===String(q.subject_id||''))
    .map(x=>({x,score:(String(x.lesson_id)===String(q.lesson_id)?4:0)+(norm(x.topic)===norm(q.topic)?2:0)+(up(x.correct_option)===up(q.correct_option)?2:0)+(norm(x.variation_group)===norm(q.variation_group)?1:0)}))
    .sort((a,b)=>b.score-a.score).slice(0,40);
  render(`<div class="wrap">${header('🔗 Link to an existing '+langName(want)+' question')}<div class="card">${qCard(q)}</div><div class="card"><h3>Choose its ${langName(want)} version</h3><p class="small muted">Unlinked ${langName(want)} questions of the same subject, closest matches first (same lesson, topic, answer).</p>${cands.length?cands.map(c=>`<div style="margin:6px 0">${qCard(c.x,`<div class="actions" style="margin-top:6px"><button type="button" onclick="jnvstBiLinkIds('${H(q.id)}','${H(c.x.id)}')">🔗 This is the same question</button></div>`)}</div>`).join(''):'<p class="muted">No unlinked questions found. Use ➕ Add version instead.</p>'}<div class="actions"><button class="secondary" type="button" onclick="jnvstBiBack()">← Back</button></div></div></div>`);
  mathNow();
};
root.jnvstBiPickPassage=function(gid,lang){
  const g=passageGroups(R.bank.filter(q=>q.active!==false)).find(x=>x.id===gid&&x.lang===lang);if(!g)return;const want=otherLang(lang);
  const cands=passageGroups(R.bank.filter(q=>q.active!==false&&langOf(q)===want&&!R.idx.has(q.id))).filter(x=>x.questions.length===g.questions.length&&partOf(x.questions[0])===partOf(g.questions[0]));
  render(`<div class="wrap">${header('🔗 Link passage to its '+langName(want)+' version')}<div class="card"><b>${H(g.title)}</b><div class="small" style="white-space:pre-wrap">${H(g.text).slice(0,800)}</div></div><div class="card">${cands.length?cands.map(c=>`<div class="student-card"><b>${H(c.title)}</b> <span class="small muted">answers ${H(c.questions.map(q=>up(q.correct_option)).join(''))} (this passage: ${H(g.questions.map(q=>up(q.correct_option)).join(''))})</span><div class="small" style="max-height:90px;overflow:auto;white-space:pre-wrap">${H(c.text).slice(0,500)}</div><div class="actions" style="margin-top:6px"><button type="button" onclick="jnvstBiLinkPassages('${H(g.id)}','${lang}','${H(c.id)}')">🔗 This is the same passage</button></div></div>`).join(''):'<p class="muted">No unlinked passages found.</p>'}<div class="actions"><button class="secondary" type="button" onclick="jnvstBiBack()">← Back</button></div></div></div>`);
};
root.jnvstBiLinkIds=async function(a,b){const x=R.bank.find(q=>q.id===a),y=R.bank.find(q=>q.id===b);try{await linkPairs([[x,y]]);await loadBank();drawReport();}catch(e){notify('Could not link: '+(e.message||e));}};
root.jnvstBiLinkPassages=async function(gid,lang,cid){const gs=passageGroups(R.bank.filter(q=>q.active!==false));const g=gs.find(x=>x.id===gid&&x.lang===lang),c=gs.find(x=>x.id===cid&&x.lang===otherLang(lang));if(!g||!c)return;const pairs=g.questions.map(q=>[q,c.questions.find(x=>String(x.question_order)===String(q.question_order))]).filter(p=>p[1]);try{await linkPairs(pairs);await loadBank();drawReport();}catch(e){notify('Could not link: '+(e.message||e));}};
root.jnvstBiBack=function(){drawReport();};

/* add a missing version */
const COPY=['section_code','part_code','topic','variation_group','is_fixed','question_type','marks','cognitive_level','difficulty','subject_id','lesson_id','lesson_code','correct_option'];
function newRowFrom(src,lang,fields,pairId){
  const r={teacher_id:current.id,source_type:'JNVST_TRANSLATION',active:true,language:lang,language_pair_id:pairId};
  COPY.forEach(k=>{if(src[k]!==undefined)r[k]=src[k];});
  if(src.is_common)r.is_common=true;
  return Object.assign(r,fields);
}
const optInputs=(p,src)=>['a','b','c','d'].map(k=>`<div><label>Option ${k.toUpperCase()}</label><input id="${p}_${k}" placeholder="${H(src['option_'+k]||'')}"></div>`).join('');
root.jnvstBiAddMissing=function(id){
  const q=R.bank.find(x=>x.id===id);if(!q)return;const want=otherLang(langOf(q));
  render(`<div class="wrap">${header('➕ Add '+langName(want)+' version')}<div class="grid"><div class="card"><h3>${langName(langOf(q))} (existing)</h3>${qCard(q)}</div><div class="card"><h3>${langName(want)} (new)</h3>
   <label>Question</label><textarea id="biQ" rows="4" placeholder="Type the ${langName(want)} question"></textarea>
   <div class="grid">${optInputs('biO',{})}</div>
   ${q.image_url?`<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="biImg" checked style="width:auto"> Use the same picture</label>`:''}
   <label>Explanation (optional)</label><textarea id="biExp" rows="3">${H(q.explanation||'')}</textarea>
   <div class="small muted">Correct answer (${H(up(q.correct_option))}), subject, lesson, topic, variation group and level are copied from the existing question.</div>
   <div class="actions" style="margin-top:12px"><button type="button" id="biSave" onclick="jnvstBiSaveMissing('${H(q.id)}')">💾 Save and link</button><button type="button" class="secondary" onclick="jnvstBiBack()">Cancel</button></div></div></div></div>`);
  mathNow();
};
root.jnvstBiSaveMissing=async function(id){
  const q=R.bank.find(x=>x.id===id);if(!q)return;const want=otherLang(langOf(q));
  const v=k=>document.getElementById(k)?.value.trim()||'';
  const text=v('biQ');if(!text&&!q.image_url)return notify('Type the question.');
  const opts={option_a:v('biO_a')||null,option_b:v('biO_b')||null,option_c:v('biO_c')||null,option_d:v('biO_d')||null};
  if(['a','b','c','d'].some(k=>q['option_'+k]&&!opts['option_'+k])&&!confirm('Some options are empty although the existing question has them. Save anyway?'))return;
  const btn=document.getElementById('biSave');if(btn)btn.disabled=true;
  try{
    const pair=uuid();
    const {error:ue}=await sb.from('mock_question_bank').update({language_pair_id:pair}).eq('id',q.id).eq('teacher_id',current.id);if(ue)throw ue;
    const row=newRowFrom(q,want,{question_text:text||'[IMAGE QUESTION]',...opts,image_url:(q.image_url&&document.getElementById('biImg')?.checked)?q.image_url:null,explanation:v('biExp')||null,passage_id:null,passage_title:null,passage_text:null,question_order:null,set_id:null},pair);
    const {error}=await sb.from('mock_question_bank').insert(row);if(error)throw error;
    notify(langName(want)+' version saved and linked.');await loadBank();drawReport();
  }catch(e){notify('Could not save: '+(e.message||e));if(btn)btn.disabled=false;}
};
root.jnvstBiAddMissingPassage=function(gid,lang){
  const g=passageGroups(R.bank.filter(q=>q.active!==false)).find(x=>x.id===gid&&x.lang===lang);if(!g)return;const want=otherLang(lang);
  render(`<div class="wrap">${header('➕ Add '+langName(want)+' passage')}<div class="card"><h3>${langName(lang)} passage (existing)</h3><b>${H(g.title)}</b><div class="small" style="white-space:pre-wrap;max-height:200px;overflow:auto">${H(g.text)}</div></div>
   <div class="card"><h3>${langName(want)} passage (new)</h3><label>Passage title</label><input id="biPT"><label>Passage text</label><textarea id="biPX" rows="8"></textarea>
   ${g.questions.map((q,i)=>`<div class="student-card"><b>Question ${H(q.question_order||i+1)}</b> <span class="small muted">· answer ${H(up(q.correct_option))} (copied)</span>${qCard(q)}<label>${langName(want)} question</label><textarea id="biQ${i}" rows="2"></textarea><div class="grid">${optInputs('biO'+i,{})}</div></div>`).join('')}
   <div class="actions"><button type="button" id="biSave" onclick="jnvstBiSaveMissingPassage('${H(g.id)}','${lang}')">💾 Save passage and link</button><button type="button" class="secondary" onclick="jnvstBiBack()">Cancel</button></div></div></div>`);
  mathNow();
};
root.jnvstBiSaveMissingPassage=async function(gid,lang){
  const g=passageGroups(R.bank.filter(q=>q.active!==false)).find(x=>x.id===gid&&x.lang===lang);if(!g)return;const want=otherLang(lang);
  const v=k=>document.getElementById(k)?.value.trim()||'';
  const title=v('biPT'),text=v('biPX');if(!title||!text)return notify('Type the passage title and text.');
  if(g.questions.some((q,i)=>!v('biQ'+i)))return notify('Type all 5 questions.');
  const btn=document.getElementById('biSave');if(btn)btn.disabled=true;
  try{
    const kind=partOf(g.questions[0])==='EVS_PASSAGE'?'EVS':'LANG';
    const pid=`JNVST-${kind}-${want[0]}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const pairs=g.questions.map(()=>uuid());
    await Promise.all(g.questions.map((q,i)=>sb.from('mock_question_bank').update({language_pair_id:pairs[i]}).eq('id',q.id).eq('teacher_id',current.id).then(r=>{if(r.error)throw r.error;})));
    const rows=g.questions.map((q,i)=>newRowFrom(q,want,{question_text:v('biQ'+i),option_a:v(`biO${i}_a`)||null,option_b:v(`biO${i}_b`)||null,option_c:v(`biO${i}_c`)||null,option_d:v(`biO${i}_d`)||null,image_url:q.image_url||null,explanation:q.explanation||null,passage_id:pid,set_id:pid,passage_title:title,passage_text:text,question_order:q.question_order},pairs[i]));
    const {error}=await sb.from('mock_question_bank').insert(rows);if(error)throw error;
    notify(langName(want)+' passage saved and linked.');await loadBank();drawReport();
  }catch(e){notify('Could not save: '+(e.message||e));if(btn)btn.disabled=false;}
};

/* button in the Question Bank */
const qbHome=root.jnvstQuestionBankHome;
if(typeof qbHome==='function'){
  root.jnvstQuestionBankHome=async function(){
    const r=await qbHome.apply(this,arguments);
    try{
      if(!document.getElementById('jnvstBiBtn')){
        const anchor=[...document.querySelectorAll('button')].find(b=>/jnvstQuestionBulkUpload\(\)/.test(b.getAttribute('onclick')||''));
        if(anchor){const b=document.createElement('button');b.id='jnvstBiBtn';b.type='button';b.textContent='🌐 Check missing translations';b.style.cssText='background:#0f766e;color:#fff';b.onclick=()=>root.jnvstTranslationCheck();anchor.parentNode.appendChild(b);}
      }
    }catch(_){}
    return r;
  };
}

/* ============================================== QUESTION PAPER GENERATOR */
const BI_SUBJECTS=['MAT','ARITHMETIC','EVS'];
const biOn=()=>typeof qpSubject==='function'&&BI_SUBJECTS.includes(qpSubject());
const displayLang=()=>{const v=up(document.getElementById('qpLanguage')?.value||'ASSAMESE');return v===EN?EN:AS;};
function bankIdx(){return partnerIndexFor(qpState.bank);}
// passage groups of the current bank that are complete in both languages
function readyGroupIds(idx){const s=new Set();passageGroups(qpState.bank).forEach(g=>{if(g.questions.length===5&&groupReady(g,idx))s.add(g.id);});return s;}
// May this question be picked at random for a bilingual paper?
function randomOk(q,idx,ready){
  const l=langOf(q);
  if(l==='COMMON'||!l)return true;
  if(!needsPartner(q))return true;
  if(qpSubject()==='MAT'&&l!==displayLang())return false; // MAT: one copy of each question (the display language)
  if(isPassageQ(q))return ready.has(groupKeyOf(q));
  return idx.has(q.id);
}
const origPrepare=root.qpPrepareRows;
root.qpPrepareRows=function(){
  if(!biOn())return origPrepare.apply(this,arguments);
  const full=qpState.bank,idx=bankIdx(),ready=readyGroupIds(idx);
  qpState.bank=full.filter(q=>qpState.selected.has(q.id)||randomOk(q,idx,ready));
  try{return origPrepare.apply(this,arguments);}finally{qpState.bank=full;}
};

/* MAT: show Common questions + the display language only */
const origCommonRows=root.qpCommonPartRows;
if(typeof origCommonRows==='function')root.qpCommonPartRows=function(){
  const rows=origCommonRows.apply(this,arguments);if(!biOn())return rows;
  const idx=bankIdx(),d=displayLang();
  return rows.map(x=>({...x,questions:x.questions.filter(q=>{const l=langOf(q);return l==='COMMON'||!l||(l===d&&idx.has(q.id));})}));
};
const origCommonQs=root.qpRenderCommonQuestions;
if(typeof origCommonQs==='function')root.qpRenderCommonQuestions=function(part){
  if(!biOn())return origCommonQs.apply(this,arguments);
  const full=qpState.bank,d=displayLang();
  qpState.bank=full.filter(q=>{const l=langOf(q);return l==='COMMON'||!l||l===d||qpState.selected.has(q.id);});
  try{origCommonQs.apply(this,arguments);}finally{qpState.bank=full;}
  markLists();
};

/* mark questions without a partner in the mandatory lists */
function markLists(){
  if(!biOn())return;
  const idx=bankIdx(),ready=readyGroupIds(idx),miss=langName(otherLang(displayLang()));
  const byId=new Map(qpState.bank.map(q=>[q.id,q]));
  document.querySelectorAll('#qpQuestionList input[type=checkbox],#qpEvsQuestionList input[type=checkbox],#qpPassageList input[type=checkbox],[id^="qpc_questions_"] input[type=checkbox]').forEach(cb=>{
    const on=cb.getAttribute('onchange')||'';let bad=false;
    let m=on.match(/qpMandatoryChanged\('([^']+)'/);
    if(m){const q=byId.get(m[1]);bad=!!q&&needsPartner(q)&&!idx.has(q.id);}
    else if((m=on.match(/qpToggleMandatoryPassage\('([^']+)'/))){bad=!ready.has(m[1]);const any=qpState.bank.find(q=>groupKeyOf(q)===m[1]);if(any&&!needsPartner(any))bad=false;}
    else return;
    const host=cb.closest('label')||cb.parentElement;if(!host)return;
    const old=host.querySelector('.qp-bi-miss');if(old)old.remove();
    if(bad){const s=document.createElement('span');s.className='qp-bi-miss';s.style.cssText='display:inline-block;margin:3px 0 0 6px;padding:2px 7px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700';s.textContent=`⚠ No ${miss} version — used only if you tick it`;host.appendChild(s);}
  });
}
function wrapAfter(name){const f=root[name];if(typeof f!=='function'||f.__bi)return;const w=function(){const r=f.apply(this,arguments);try{setTimeout(()=>{markLists();summaryNote();},0);}catch(_){}return r;};w.__bi=true;root[name]=w;}
['qpRefreshQuestionPool','qpRefreshEVSPools','qpRefreshSubjectSummary'].forEach(wrapAfter);

function summaryNote(){
  const el=document.getElementById('qpSubjectSummary');if(!el)return;
  let n=el.parentNode.querySelector('#qpBiNote');
  if(!biOn()){if(n)n.remove();return;}
  if(!n){n=document.createElement('div');n.id='qpBiNote';n.className='notice small';n.style.marginBottom='12px';el.parentNode.insertBefore(n,el.nextSibling);}
  const idx=bankIdx(),d=displayLang(),subj=qpSubject();
  const relevant=qpState.bank.filter(q=>{try{return needsPartner(q)&&langOf(q)===d&&(subj==='MAT'?partOf(q).startsWith('MAT_'):qpQuestionSubjectMatches(q));}catch(_){return false;}});
  const missing=relevant.filter(q=>!idx.has(q.id)).length;
  n.innerHTML=`<b>🌐 Two PDFs:</b> this paper is printed as an <b>English-medium</b> and an <b>Assamese-medium</b> PDF with the same questions, order and answer key. Questions are shown in ${langName(d)} while you choose.`+(missing?` <b>${missing}</b> ${langName(d)} ${subj==='MAT'?'MAT':subj==='ARITHMETIC'?'Arithmetic':'EVS'} question(s) have no ${langName(otherLang(d))} version, so they are not used for random questions. <a href="#" onclick="event.preventDefault();jnvstTranslationCheck()">Check missing translations →</a>`:'');
}

/* the Language dropdown: shown language only (Language subject: still the paper's medium) */
function relabel(){
  const sel=document.getElementById('qpLanguage');if(!sel)return;
  const lab=sel.previousElementSibling,note=sel.nextElementSibling;
  if(biOn()){if(lab&&lab.tagName==='LABEL')lab.textContent='Show questions in';if(note)note.textContent='Both an English and an Assamese PDF are always made. This only changes the language shown while you pick questions.';}
  else{if(lab&&lab.tagName==='LABEL')lab.textContent='Language';if(note)note.textContent='Language papers are made in the chosen language only.';}
}
const origMode=root.qpRenderGeneratorMode;
if(typeof origMode==='function')root.qpRenderGeneratorMode=function(){const r=origMode.apply(this,arguments);relabel();setTimeout(()=>{markLists();summaryNote();},0);return r;};
const origLangChanged=root.qpLanguageChanged;
root.qpLanguageChanged=function(){
  if(!biOn())return origLangChanged.apply(this,arguments);
  // keep the mandatory choice: switch each ticked question to its partner in the newly shown language
  const idx=bankIdx(),d=displayLang(),next=new Set();
  qpState.selected.forEach(id=>{const q=qpState.bank.find(x=>x.id===id);const p=q&&needsPartner(q)&&langOf(q)!==d?idx.get(id):null;next.add(p?p.id:id);});
  qpState.selected=next;qpState.language=qpCurrentLanguage();qpState.lastRows=null;qpState.lastSignature='';qpState.lastSerial='';qpState.savedHistoryId=null;qpState.lastSetVariants=null;
  const s=qpSubject();
  if(s==='MAT')QP_COMMON_PARTS.forEach(x=>qpRenderCommonQuestions(x.part));else if(s==='ARITHMETIC'){qpRenderTopicRows();qpRefreshQuestionPool();}else if(s==='EVS')qpRefreshEVSPools();
  qpRefreshSubjectSummary();relabel();
};

/* build the other-language rows: same order, numbering and answer key */
const CONTENT=['id','language','question_text','option_a','option_b','option_c','option_d','explanation','explanation_as','language_pair_id','passage_id','set_id','passage_title','passage_text'];
function translateRows(rows,idx){
  return (rows||[]).map(q=>{
    if(!needsPartner(q))return {...q};
    const p=idx.get(q.id);
    if(!p)return {...q,_translationMissing:true};
    const t={...q};CONTENT.forEach(k=>{t[k]=p[k];});
    t.image_url=p.image_url||q.image_url||null;
    t.correct_option=q.correct_option; // one answer key for both papers
    if(isPassageQ(q)){t._passageGroup=groupKeyOf(p)||q._passageGroup;t._passageTitle=p.passage_title||q._passageTitle;t._passageText=p.passage_text||q._passageText;}
    t._primaryId=q.id;
    return t;
  });
}
function addMedium(html,lang){
  return String(html).replace(/<table class="jnvst-fields">/g,`<div class="qp-medium-tag" style="text-align:center;font:700 13pt 'Times New Roman',Times,serif;letter-spacing:1px;margin:2px 0 6px">${lang===EN?'ENGLISH MEDIUM':'ASSAMESE MEDIUM'}</div><table class="jnvst-fields">`);
}

const origGenerate=root.generateSelectedQuestionPaper;
root.generateSelectedQuestionPaper=async function(){
  if(!biOn())return origGenerate.apply(this,arguments);
  let w=null;
  try{
    const master=qpMasterRows();
    const idx=bankIdx(),primary=displayLang(),other=otherLang(primary);
    const problems=[];
    master.forEach((q,i)=>{
      if(!needsPartner(q))return;
      const p=idx.get(q.id);
      if(!p){problems.push(`Q${i+1}: no ${langName(other)} version — it will be printed in ${langName(primary)} in both PDFs`);return;}
      if(up(p.correct_option)!==up(q.correct_option))problems.push(`Q${i+1}: the ${langName(other)} version has a different answer (${up(p.correct_option)} instead of ${up(q.correct_option)}) — the ${langName(primary)} answer is used`);
    });
    if(problems.length&&!confirm(`Before the two PDFs are made, please note:\n\n${problems.slice(0,15).join('\n')}${problems.length>15?`\n… and ${problems.length-15} more`:''}\n\nOK = make the papers anyway · Cancel = go back and fix (🌐 Check missing translations).`))return;
    const count=await qpAskSetCountModal(qpRequestedSetCount());
    if(count===null)return;
    w=qpOpenPrintWindow();if(!w)return;
    const variants=qpBuildSetVariants(master,count);
    const qcReports=variants.map(v=>qpValidatePaperQuality(v.rows,qpSubject(),`SET ${v.setCode}`));
    if(qcReports.some(r=>r.errors.length)){try{w.close();}catch(_){}qpShowQualityControl(qcReports,true);return;}
    const title=document.getElementById('qpTitle')?.value||'JNVST Practice Question Paper';
    const baseSerial=qpGetSetSerial(JSON.stringify({subject:qpSubject(),language:qpCurrentLanguage(),mode:qpState.mode,selected:[...qpState.selected].sort(),counts:qpState.commonCounts,sets:count}));
    qpState.lastSetVariants=variants;qpState.multiSetSerial=baseSerial;
    const includeAnswers=document.getElementById('qpPdfAnswers')?.value==='yes';
    const numbered=v=>v.rows.map((q,i)=>({...q,_masterNumber:master.findIndex(m=>m.id===q.id)+1,_number:i+1}));
    const sets=variants.map(v=>{const rows=numbered(v);return {setCode:v.setCode,rows,other:translateRows(rows,idx)};});
    const masterOther=translateRows(master,idx);
    const saveErrors=[];
    for(const s of sets){
      try{
        const oldSet=qpState.setCode,oldSerial=qpState.lastSerial,oldSignature=qpState.lastSignature;
        qpState.savedHistoryId=null;qpState.setCode=s.setCode;qpState.lastSerial=`${baseSerial}-${s.setCode}`;qpState.lastSignature='MULTISET';
        qpState.__bilingual={primary,other,rows_other:s.other,master_rows_other:masterOther};
        await saveGeneratedQuestionPaper(s.rows);
        qpState.savedHistoryId=null;qpState.setCode=oldSet;qpState.lastSerial=oldSerial;qpState.lastSignature=oldSignature;
      }catch(e){saveErrors.push(`SET ${s.setCode}: ${e.message||e}`);qpState.savedHistoryId=null;}
      finally{delete qpState.__bilingual;}
    }
    if(saveErrors.length)notify('The papers will still open, but some sets could not be saved to Generated History:\n'+saveErrors.join('\n'));
    loadGeneratedQuestionPaperHistory();
    qpState.__lastBilingual={title,baseSerial,includeAnswers,sets,primary,other,subject:qpSubject()};
    writeLangWindow(w,primary);
    showReadyPanel();
  }catch(e){try{if(w)w.close();}catch(_){}notify('Could not generate Question Paper Sets: '+(e.message||e));}
};
function writeLangWindow(w,lang){
  const B=qpState.__lastBilingual;if(!B)return;
  const useOther=lang!==B.primary;
  const html=B.sets.map((s,i)=>qpBuildSetHtml(useOther?s.other:s.rows,s.setCode,`${B.baseSerial}-${s.setCode}`,B.title,B.includeAnswers,i===B.sets.length-1)).join('');
  qpWritePrintWindow(w,`${B.title} — ${langName(lang)} medium — ${B.sets.map(s=>'SET '+s.setCode).join(', ')}`,addMedium(html,lang));
}
root.qpBilingualOpen=function(lang){const w=qpOpenPrintWindow();if(!w)return;writeLangWindow(w,lang);};
function showReadyPanel(){
  const B=qpState.__lastBilingual;const anchor=document.getElementById('qpSubjectSummary');if(!B||!anchor)return;
  let p=document.getElementById('qpBiReady');if(!p){p=document.createElement('div');p.id='qpBiReady';p.className='card';p.style.cssText='border:2px solid #0f766e;background:#f0fdfa';anchor.parentNode.insertBefore(p,anchor);}
  const btn=l=>`<button type="button" ${l===B.primary?'class="secondary"':''} onclick="qpBilingualOpen('${l}')">🖨 ${langName(l)}-medium PDF${l===B.primary?' (opened)':''}</button>`;
  p.innerHTML=`<h3 style="margin:0 0 6px">✅ Paper ready in two languages — ${H(B.baseSerial)}</h3><p class="small muted" style="margin:0 0 8px">Same questions, numbering and answer key in both. ${langName(B.primary)} opened in a new window. Open the ${langName(B.other)} paper below and save it as a separate PDF.</p><div class="actions">${btn(EN)}${btn(AS)}</div>`;
  p.scrollIntoView({behavior:'smooth',block:'center'});
}

/* history: save both languages in the same record */
const origSave=root.saveGeneratedQuestionPaper;
root.saveGeneratedQuestionPaper=async function(rows){
  const B=qpState.__bilingual;
  if(!B)return origSave.apply(this,arguments);
  if(qpState.savedHistoryId)return qpState.savedHistoryId;
  const title=document.getElementById('qpTitle')?.value||'JNVST Practice Question Paper';
  const setCode=document.getElementById('qpSetCode')?.value||qpState.setCode||'A';
  const subject=qpSubject(),language=B.primary,serial=qpCurrentSetSerial();
  const snapshot={rows:rows.map(q=>({...q})),subject,language,mode:qpState.mode,setCode,serial,title,questionOrder:document.getElementById('qpOrder')?.value||'random',
    master_rows:Array.isArray(qpState.historyMasterRows)?qpState.historyMasterRows.map(q=>({...q})):null,
    bilingual:{primary:B.primary,other:B.other,rows_other:B.rows_other,master_rows_other:B.master_rows_other}};
  const keyRows=qpBuildAnswerRows(rows).map((r,i)=>({...r,[`Question ID ${langName(B.other)}`]:B.rows_other[i]?.id||''}));
  const payload={teacher_id:current.id,title,serial_no:serial,set_code:setCode,subject,language,mode:qpState.mode||'',question_count:rows.length,total_marks:rows.length,
    paper_snapshot:snapshot,answer_key_snapshot:{rows:keyRows,serial,title,subject,language,set_code:setCode,bilingual:true}};
  const {data,error}=await sb.from('jnvst_generated_question_papers').insert(payload).select('id,generated_at').single();
  if(error)throw error;
  qpState.savedHistoryId=data.id;return data.id;
};

/* history: open either language */
function asOther(rec){
  const b=rec?.paper_snapshot?.bilingual;if(!b)return rec;
  return {...rec,language:b.other,paper_snapshot:{...rec.paper_snapshot,rows:b.rows_other||[],master_rows:b.master_rows_other||rec.paper_snapshot.master_rows,language:b.other}};
}
async function withMedium(lang,fn){
  const orig=root.qpWritePrintWindow;
  root.qpWritePrintWindow=function(w,title,body){return orig.call(this,w,`${title} — ${langName(lang)} medium`,addMedium(body,lang));};
  try{return await fn();}finally{root.qpWritePrintWindow=orig;}
}
const origView=root.viewGeneratedQuestionPaper;
root.viewGeneratedQuestionPaper=async function(id,answers=false,lang){
  if(!lang)return origView.apply(this,arguments);
  const {data,error}=await sb.from('jnvst_generated_question_papers').select('*').eq('id',id).eq('teacher_id',current.id).single();
  if(error)return notify('Could not load saved paper: '+error.message);
  const b=data.paper_snapshot?.bilingual;
  const rec=b&&lang===b.other?asOther(data):data;
  return withMedium(lang,()=>qpOpenSavedPaper(rec,answers));
};
const origGroup=root.viewGeneratedQuestionPaperGroup,origGetGroup=root.qpGetHistoryGroupRecords;
root.viewGeneratedQuestionPaperGroup=async function(base,lang){
  if(!lang)return origGroup.apply(this,arguments);
  root.qpGetHistoryGroupRecords=async function(){const recs=await origGetGroup.apply(this,arguments);return recs.map(r=>{const b=r.paper_snapshot?.bilingual;return b&&lang===b.other?asOther(r):r;});};
  try{return await withMedium(lang,()=>origGroup.call(this,base));}finally{root.qpGetHistoryGroupRecords=origGetGroup;}
};
const origLoadHist=root.qpLoadHistoryRecords;
root.qpLoadHistoryRecords=async function(){
  const cols='id,title,serial_no,set_code,subject,language,mode,question_count,total_marks,generated_at,answer_key_snapshot,is_custom:paper_snapshot->>custom,student_name:paper_snapshot->>student_name,roll_no:paper_snapshot->>roll_no,student_id:paper_snapshot->>student_id,bi_primary:paper_snapshot->bilingual->>primary,bi_other:paper_snapshot->bilingual->>other';
  const out=[];
  try{
    for(let from=0;from<20000;from+=1000){const {data,error}=await sb.from('jnvst_generated_question_papers').select(cols).eq('teacher_id',current.id).order('generated_at',{ascending:false}).range(from,from+999);if(error)throw error;out.push(...(data||[]));if(!data||data.length<1000)break;}
  }catch(e){return origLoadHist.apply(this,arguments);}
  root.__qpHistRecords=out;return out;
};
const origHist=root.loadGeneratedQuestionPaperHistory;
root.loadGeneratedQuestionPaperHistory=async function(){
  const r=await origHist.apply(this,arguments);
  try{
    const recs=(root.__qpHistRecords||[]).filter(x=>x.bi_other);if(!recs.length)return r;
    const el=document.getElementById('qpGeneratedHistory');if(!el)return r;
    const groups=new Map();
    recs.forEach(x=>{
      const b=el.querySelector(`button[onclick="viewGeneratedQuestionPaper('${x.id}')"]`);
      if(b&&!b.dataset.bi){b.dataset.bi='1';b.textContent=`Paper (${langName(x.bi_primary)})`;b.setAttribute('onclick',`viewGeneratedQuestionPaper('${x.id}',false,'${x.bi_primary}')`);
        const o=document.createElement('button');o.className='secondary';o.textContent=`Paper (${langName(x.bi_other)})`;o.setAttribute('onclick',`viewGeneratedQuestionPaper('${x.id}',false,'${x.bi_other}')`);b.after(o);}
      groups.set(qpHistoryGroupKey(x.serial_no),x);
    });
    groups.forEach((x,key)=>{
      const b=el.querySelector(`button[onclick="viewGeneratedQuestionPaperGroup('${key}')"]`);
      if(b&&!b.dataset.bi){b.dataset.bi='1';b.textContent=`📄 All Questions (${langName(x.bi_primary)})`;b.setAttribute('onclick',`viewGeneratedQuestionPaperGroup('${key}','${x.bi_primary}')`);
        const o=document.createElement('button');o.className='secondary';o.textContent=`📄 All Questions (${langName(x.bi_other)})`;o.setAttribute('onclick',`viewGeneratedQuestionPaperGroup('${key}','${x.bi_other}')`);b.after(o);
        const head=b.closest('.qp-history-group-head');const info=head&&head.querySelector('.small.muted');if(info&&!/English \+ Assamese/.test(info.textContent))info.textContent=info.textContent.replace(/· (ENGLISH|ASSAMESE) ·/,'· English + Assamese ·');}
    });
  }catch(e){console.warn('Bilingual history buttons',e);}
  return r;
};

root.__bilingualPapersLoaded=true;
})();
