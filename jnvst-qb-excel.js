/* V29: JNVST Question Bank — Download for Editing + Re-upload (English + Assamese kept together)

   Admin → 📚 JNVST Question Bank
     ⬇ Download for Editing (Excel)  – the ticked questions (or every question that matches the filters).
                                        English and Assamese versions of a question are on ONE row, in the
                                        same columns as the Bulk Upload template, plus Record ID columns.
     ⬆ Re-upload Edited Excel        – reads that file back, shows every change, and after "Apply" updates
                                        the SAME questions in place (no duplicates). Only changed cells are saved.

   Loaded after teacher-portal.js. Uses the globals of main.html / teacher-app.js:
   sb, current, jnvstQbCache, jnvstQbSelected, jnvstSubjects, jnvstSubjectLessons, render, header, esc, notify. */
(function(){
'use strict';
const root=window;

/* ---------- small helpers ---------- */
const T=v=>String(v??'').replace(/\r\n?/g,'\n').trim();
const U=v=>T(v).toUpperCase();
const L=q=>U(q&&q.language);
const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const say=m=>(typeof notify==='function'?notify(m):alert(m));
const toast=m=>{try{jnvstQbToast(m)}catch(_){}};
const bankRows=()=>{try{return Array.isArray(jnvstQbCache)?jnvstQbCache:[]}catch(_){return []}};
const subjects=()=>{try{return jnvstSubjects||[]}catch(_){return []}};
const lessons=()=>{try{return jnvstSubjectLessons||[]}catch(_){return []}};
const normMath=v=>{const s=T(v);try{return typeof jnvstNormalizeMathText==='function'?jnvstNormalizeMathText(s):s}catch(_){return s}};
const BN='০১২৩৪৫৬৭৮৯';
const nums=s=>(String(s||'').replace(/[০-৯]/g,d=>BN.indexOf(d)).match(/\d+(?:\.\d+)?/g)||[]).join(',');
const yes=v=>['YES','TRUE','1','Y'].includes(U(v));
const boolCell=v=>{const s=U(v);if(['YES','TRUE','1','Y'].includes(s))return true;if(['NO','FALSE','0','N',''].includes(s))return false;return null;};
const EXCEL_MAX=32000;

const HEAD=['Subject Name','Part','Medium','Lesson Code','Topic','Variation Group','Fixed Question','Common','Question Type','Marks','Cognitive Level','Difficulty','Local Passage No.','Question Order','Passage Title English','Passage English','Passage Title Assamese','Passage Assamese','Question English','Question Assamese','Option A English','Option B English','Option C English','Option D English','Option A Assamese','Option B Assamese','Option C Assamese','Option D Assamese','Correct Answer','Explanation','Explanation Assamese'];
const ID_EN='Record ID English (do not change)',ID_AS='Record ID Assamese (do not change)',CHECK='Check (information only)';
const ALL_HEAD=[...HEAD,ID_EN,ID_AS,CHECK];
const LANG_FIELDS={'Question English':['e','question_text'],'Option A English':['e','option_a'],'Option B English':['e','option_b'],'Option C English':['e','option_c'],'Option D English':['e','option_d'],
  'Question Assamese':['a','question_text'],'Option A Assamese':['a','option_a'],'Option B Assamese':['a','option_b'],'Option C Assamese':['a','option_c'],'Option D Assamese':['a','option_d']};
const PASSAGE_FIELDS={'Passage Title English':['e','passage_title'],'Passage English':['e','passage_text'],'Passage Title Assamese':['a','passage_title'],'Passage Assamese':['a','passage_text']};
const TEXT_SHARED={'Topic':'topic','Variation Group':'variation_group','Cognitive Level':'cognitive_level','Difficulty':'difficulty'};

/* ---------- 1. find the English ↔ Assamese pairs ---------- */
/* A "unit" is one stand-alone question, or one passage (all its questions) in one language. */
function buildIndex(all){
  const units=new Map(),unitOf=new Map();
  for(const q of all){
    const lang=L(q),pass=!!T(q.passage_id);
    const key=pass?`P|${T(q.passage_id)}|${lang}`:`S|${q.id}`;
    let u=units.get(key);if(!u){u={key,lang,pass,recs:[]};units.set(key,u);}
    u.recs.push(q);unitOf.set(q.id,u);
  }
  for(const u of units.values())if(u.pass)u.recs.sort((a,b)=>(Number(a.question_order)||999)-(Number(b.question_order)||999)||String(a.id).localeCompare(String(b.id)));
  const partner=new Map(),how=new Map(),doubt=new Set();
  const link=(a,b,h)=>{partner.set(a,b);partner.set(b,a);how.set(a,h);how.set(b,h);};
  const list=[...units.values()],EN=list.filter(u=>u.lang==='ENGLISH'),AS=list.filter(u=>u.lang==='ASSAMESE');
  const groupBy=(arr,f)=>{const m=new Map();arr.forEach(x=>{const k=f(x);if(!k)return;(m.get(k)||m.set(k,[]).get(k)).push(x)});return m;};
  // (a) same passage_id in both languages (passages typed in the app)
  const asPid=groupBy(AS.filter(u=>u.pass),u=>T(u.recs[0].passage_id)),enPid=groupBy(EN.filter(u=>u.pass),u=>T(u.recs[0].passage_id));
  for(const [k,es] of enPid){const as=asPid.get(k)||[];if(es.length===1&&as.length===1)link(es[0],as[0],'linked');}
  // (b) the same language_pair_id
  const pid=u=>{const s=new Set(u.recs.map(r=>T(r.language_pair_id)).filter(Boolean));return s.size===1?[...s][0]:'';};
  const enPair=groupBy(EN.filter(u=>!partner.has(u)),pid),asPair=groupBy(AS.filter(u=>!partner.has(u)),pid);
  for(const [k,es] of enPair){const as=(asPair.get(k)||[]).filter(x=>x.pass===es[0].pass);if(es.length===1&&as.length===1)link(es[0],as[0],'linked');}
  // (c) the rest: same subject, lesson, part, variation group and type – then the best clear match
  const ctx=u=>{const r=u.recs[0];return [r.subject_id,r.lesson_id,U(r.part_code),T(r.variation_group).toLowerCase(),u.pass?'P'+u.recs.length:U(r.question_type||'MCQ')].join('|');};
  const score=(e,a)=>{let s=0;
    if(T(e.recs[0].created_at)&&T(e.recs[0].created_at)===T(a.recs[0].created_at))s+=100; // saved in the same upload
    const n=Math.max(e.recs.length,a.recs.length);
    for(let i=0;i<n;i++){const x=e.recs[i],y=a.recs[i];if(!x||!y)continue;
      if(U(x.correct_option)&&U(x.correct_option)===U(y.correct_option))s+=5;
      if(T(x.image_url)&&T(x.image_url)===T(y.image_url))s+=40;
      if(T(x.explanation)&&T(x.explanation)===T(y.explanation))s+=40;
      const nx=nums([x.question_text,x.option_a,x.option_b,x.option_c,x.option_d].join(' ')),ny=nums([y.question_text,y.option_a,y.option_b,y.option_c,y.option_d].join(' '));
      if(nx&&nx===ny)s+=15;
      ['option_a','option_b','option_c','option_d'].forEach(k=>{if(T(x[k])&&T(x[k])===T(y[k]))s+=3;});
      if(T(x.topic)&&T(x.topic).toLowerCase()===T(y.topic).toLowerCase())s+=5;
      ['difficulty','cognitive_level','marks','is_fixed','source_type'].forEach(k=>{if(T(x[k])===T(y[k]))s+=1;});
    }return s;};
  for(let round=0;round<6;round++){
    const enC=groupBy(EN.filter(u=>!partner.has(u)),ctx),asC=groupBy(AS.filter(u=>!partner.has(u)),ctx);let added=0;
    for(const [k,es] of enC){const as=asC.get(k);if(!as)continue;
      const best=(u,others)=>{let b=null,bs=-1,second=-1;for(const o of others){const s=score(u.lang==='ENGLISH'?u:o,u.lang==='ENGLISH'?o:u);if(s>bs){second=bs;bs=s;b=o}else if(s>second)second=s;}return {b,bs,unique:bs>second};};
      for(const e of es){if(partner.has(e))continue;const freeAs=as.filter(x=>!partner.has(x));if(!freeAs.length)break;
        const r=best(e,freeAs);if(!r.b||!r.unique){doubt.add(e);continue;}
        const back=best(r.b,es.filter(x=>!partner.has(x)));if(back.b!==e||!back.unique){doubt.add(e);doubt.add(r.b);continue;}
        const sameUpload=r.bs>=100,onlyOne=freeAs.length===1&&es.filter(x=>!partner.has(x)).length===1&&!!T(e.recs[0].variation_group);
        if(sameUpload||onlyOne){link(e,r.b,sameUpload?'matched':'guessed');doubt.delete(e);doubt.delete(r.b);added++;}else{doubt.add(e);doubt.add(r.b);}
      }
      as.forEach(a=>{if(!partner.has(a)&&es.length)doubt.add(a);});
    }
    if(!added)break;
  }
  return {units,unitOf,partner,how,doubt};
}

/* ---------- 2. the values shown in each Excel cell (used for download AND for finding changes) ---------- */
function makeReader(){
  const hasExplAs=bankRows().some(q=>Object.prototype.hasOwnProperty.call(q,'explanation_as'));
  const subjName=id=>{const s=subjects().find(x=>x.id===id);return s?s.name:'';};
  const lessonCode=q=>{const l=lessons().find(x=>x.id===q.lesson_id);return T(l?l.lesson_code:q.lesson_code);};
  const firstOf=(u,f)=>{if(!u)return '';const r=u.recs.find(x=>T(x[f]));return r?T(r[f]):'';};
  const medium=(e,a)=>e?(L(e)==='COMMON'?'COMMON':L(e)==='ENGLISH'?'ENGLISH':L(e)):a?'ASSAMESE':'';
  // value of one column for a row made of English record e and Assamese record a (either may be missing)
  function cur(col,e,a,ue,ua){
    const b=e||a;if(!b)return '';
    if(col in LANG_FIELDS){const [w,f]=LANG_FIELDS[col];const r=w==='e'?e:a;return r?T(r[f]):'';}
    if(col in PASSAGE_FIELDS){const [w,f]=PASSAGE_FIELDS[col];const r=w==='e'?e:a,u=w==='e'?ue:ua;if(!r||!u||!u.pass||u.recs[0].id!==r.id)return '';return firstOf(u,f);}
    if(col in TEXT_SHARED)return T(b[TEXT_SHARED[col]]);
    switch(col){
      case 'Subject Name':return subjName(b.subject_id);
      case 'Part':return U(b.part_code);
      case 'Medium':return medium(e,a);
      case 'Lesson Code':return lessonCode(b);
      case 'Fixed Question':return b.is_fixed?'YES':'NO';
      case 'Common':return (e&&e.is_common)||(a&&a.is_common)?'YES':'NO';
      case 'Question Type':return T(b.question_type)||'MCQ';
      case 'Marks':return b.marks==null||b.marks===''?'':String(Number(b.marks));
      case 'Question Order':return T(b.passage_id)?String(b.question_order??''):'';
      case 'Correct Answer':return U(b.correct_option);
      case 'Explanation':return e?T(e.explanation):(hasExplAs&&a?T(a.explanation):'');
      case 'Explanation Assamese':
        if(hasExplAs){const r=a||(e&&L(e)==='COMMON'?e:null);return r?T(r.explanation_as):'';}
        return a?T(a.explanation):'';
    }
    return '';
  }
  return {cur,hasExplAs,medium};
}

/* ---------- 3. Download for Editing ---------- */
function selectedIdsInOrder(){
  let shown=[];try{shown=jnvstQbFilteredRows().map(q=>q.id)}catch(_){}
  let sel=[];try{sel=[...jnvstQbSelected]}catch(_){}
  if(sel.length)return {ids:shown.filter(id=>sel.includes(id)).concat(sel.filter(id=>!shown.includes(id))),ticked:true};
  return {ids:shown,ticked:false};
}
function exportRows(ids){
  const all=bankRows(),idx=buildIndex(all),R=makeReader(),out=[],done=new Set();let pno=0;
  const stats={rows:0,both:0,enOnly:0,asOnly:0,common:0,check:0};
  for(const id of ids){
    const u=idx.unitOf.get(id);if(!u||done.has(u))continue;
    const p=idx.partner.get(u)||null;done.add(u);if(p)done.add(p);
    const ue=u.lang==='ASSAMESE'?p:u,ua=u.lang==='ASSAMESE'?u:p;
    const how=idx.how.get(u)||'',pass=u.pass;if(pass)pno++;
    const n=Math.max(ue?ue.recs.length:0,ua?ua.recs.length:0);
    for(let i=0;i<n;i++){
      const e=ue?ue.recs[i]:null,a=ua?ua.recs[i]:null;
      const row={};HEAD.forEach(h=>row[h]=R.cur(h,e,a,ue,ua));
      if(pass)row['Local Passage No.']='P'+String(pno).padStart(3,'0');
      row[ID_EN]=e?e.id:'';row[ID_AS]=a?a.id:'';
      const notes=[];const lang=e?L(e):'';
      if(e&&lang==='COMMON'){stats.common++;}
      else if(e&&lang!=='ENGLISH')notes.push('Medium not set on this question');
      else if(e&&a){stats.both++;if(how==='guessed')notes.push('English/Assamese matched by Variation Group only – please check they are the same question');}
      else if(e){stats.enOnly++;notes.push(idx.doubt.has(ue)?'Assamese version could not be identified for sure – if you know it, paste its Record ID in “Record ID Assamese” and delete its own row':'No Assamese version in the bank – type it in the Assamese columns to add it');}
      else if(a){stats.asOnly++;notes.push(idx.doubt.has(ua)?'English version could not be identified for sure – if you know it, paste its Record ID in “Record ID English” and delete its own row':'No English version in the bank – type it in the English columns to add it');}
      if(e&&a){const diff=[['correct_option','Correct Answer'],['topic','Topic'],['variation_group','Variation Group'],['difficulty','Difficulty'],['marks','Marks'],['lesson_id','Lesson']].filter(([f])=>T(e[f])!==T(a[f])).map(x=>x[1]);if(diff.length)notes.push('English and Assamese differ in: '+diff.join(', ')+' (English value shown; a change here is saved to both)');}
      if(HEAD.some(h=>String(row[h]).length>EXCEL_MAX))notes.push('A cell is longer than Excel allows – edit that text in the app instead');
      if((e&&T(e.image_url))||(a&&T(a.image_url)))notes.push('Has a picture (pictures are not in Excel and are kept as they are)');
      row[CHECK]=notes.join(' · ');if(notes.length)stats.check++;
      out.push(row);stats.rows++;
    }
  }
  return {out,stats};
}
function writeWorkbook(rows,stats){
  const aoa=[ALL_HEAD,...rows.map(r=>ALL_HEAD.map(h=>r[h]==null?'':String(r[h])))];
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  // every cell is TEXT, so Excel keeps 0.50, 1/2, 007 … exactly as typed
  const range=XLSX.utils.decode_range(ws['!ref']);
  for(let R=1;R<=range.e.r;R++)for(let C=0;C<=range.e.c;C++){const ref=XLSX.utils.encode_cell({r:R,c:C});if(!ws[ref])ws[ref]={t:'s',v:''};ws[ref].t='s';ws[ref].z='@';}
  ws['!cols']=ALL_HEAD.map(h=>({wch:/^Question |^Passage |Explanation/.test(h)?40:/^Option /.test(h)?22:h===CHECK?60:/^Record ID/.test(h)?38:16}));
  ws['!autofilter']={ref:ws['!ref']};
  const ins=[['JNVST Question Bank — Edit in Excel and Re-upload'],[''],
    ['1. Each row is ONE question. Its English and Assamese versions are on the same row (English columns + Assamese columns).'],
    ['2. Change any text you like: questions, options A–D, passages, explanations, Topic, Variation Group, Difficulty, Cognitive Level, Marks, Correct Answer, Fixed Question, Common, Lesson Code.'],
    ['3. Do NOT change the two “Record ID” columns – they tell the app which saved question each row is. Rows can be sorted or filtered freely.'],
    ['4. Save as .xlsx and use “⬆ Re-upload Edited Excel” in the JNVST Question Bank. You will see every change before anything is saved. Only changed cells are saved; no duplicates are made.'],
    ['5. Shared fields (Topic, Variation Group, Difficulty, Marks, Correct Answer, Lesson …) are saved to BOTH the English and the Assamese version of the row.'],
    ['6. Passage: the passage text and title are on the row with Question Order 1. A change there is saved to all 5 questions of that passage. Changing the Lesson Code of a passage row moves the whole passage.'],
    ['7. Missing language: if a row has no Assamese (or English) version, type it into the empty language columns – it is added and linked to this question (not for passages).'],
    ['8. Part, Medium, Question Type, Local Passage No. and Question Order cannot be changed here (they are ignored). Pictures are not in the file and stay as they are.'],
    ['9. Deleting a row does NOT delete the question. New questions (rows without Record IDs) are not added here – use “📥 Bulk Upload JNVST Questions”.'],
    ['10. Mathematics: LaTeX such as \\frac{3}{4}, x^2, \\sqrt{16} works as in Bulk Upload.'],
    ['11. The “Check” column is only information (e.g. a missing language version) and is never saved.'],
    [''],['This file',`${stats.rows} row(s): ${stats.both} with English + Assamese, ${stats.enOnly} English only, ${stats.asOnly} Assamese only, ${stats.common} Common (MAT).`],
    ['Downloaded',new Date().toLocaleString()]];
  const wi=XLSX.utils.aoa_to_sheet(ins);wi['!cols']=[{wch:120},{wch:80}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'JNVST Questions');XLSX.utils.book_append_sheet(wb,wi,'Instructions');
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  XLSX.writeFile(wb,`JNVST_Questions_for_Editing_${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`);
}
root.jnvstQbDownloadForEditing=function(){
  if(typeof XLSX==='undefined')return say('Excel library is not loaded yet. Please wait a moment and try again.');
  const {ids,ticked}=selectedIdsInOrder();
  if(!ids.length)return say('No questions to download. Tick questions, or change the filters so questions are shown.');
  if(!ticked&&!confirm(`No question is ticked.\n\nDownload all ${ids.length} question record(s) that match the current filters?\n(The other-language version of each question is added automatically.)`))return;
  const {out,stats}=exportRows(ids);
  if(!out.length)return say('Nothing to download.');
  writeWorkbook(out,stats);
  toast(`Downloaded ${stats.rows} row(s): ${stats.both} English + Assamese, ${stats.enOnly} English only, ${stats.asOnly} Assamese only, ${stats.common} Common`);
};

/* ---------- 4. Re-upload ---------- */
let plan=null;
root.jnvstQbReuploadPage=function(){
  plan=null;
  render(`<div class="wrap">${header('⬆ Re-upload Edited JNVST Questions')}
   <div class="card"><div class="notice"><b>Use the Excel file made with “⬇ Download for Editing”.</b> Each row is matched to the saved question by its Record ID, so the
   <b>same questions are updated</b> (English and Assamese together) — nothing is duplicated. Only cells you changed are saved, and you see every change before saving.</div>
   <div class="actions"><button class="secondary" onclick="jnvstQuestionBankHome()">← Back to Question Bank</button></div>
   <label>Edited Excel file (.xlsx)</label><input id="jqxFile" type="file" accept=".xlsx,.xls" onchange="jnvstQbReadEditedExcel(event)">
   <div id="jqxPreview" class="small muted" style="margin-top:10px">No file selected.</div>
   <label id="jqxLinkWrap" style="display:none;align-items:center;gap:8px;margin-top:10px"><input id="jqxLink" type="checkbox" checked style="width:auto"> <span id="jqxLinkText"></span></label>
   <div class="actions" style="margin-top:12px"><button id="jqxApply" disabled onclick="jnvstQbApplyEditedExcel()" style="background:#16a34a;color:#fff;border:0;font-weight:700">✓ Apply changes</button><button class="secondary" onclick="jnvstQuestionBankHome()">Cancel</button></div>
   <div id="jqxChanges" style="margin-top:12px"></div></div></div>`);
};

async function freshBank(){
  const {data,error}=await sbFetchAll(()=>sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).order('created_at',{ascending:false}));
  if(error)throw error;jnvstQbCache=data||[];return jnvstQbCache;
}

function buildPlan(sheetRows){
  const all=bankRows(),byId=new Map(all.map(q=>[q.id,q])),idx=buildIndex(all),R=makeReader();
  const errors=[],warns=[],changes=[],payload=new Map(),inserts=[],links=[];
  const unitSet=new Map();const usedIds=new Map();
  const put=(rec,field,value,row)=>{let p=payload.get(rec.id);if(!p){p={};payload.set(rec.id,p);}
    if(Object.prototype.hasOwnProperty.call(p,field)&&JSON.stringify(p[field])!==JSON.stringify(value)){errors.push(`Row ${row}: two different new values for “${field}” of the same question (e.g. two rows of one passage). Make them the same.`);return;}
    p[field]=value;};
  const who=r=>L(r)==='ASSAMESE'?'Assamese':L(r)==='COMMON'?'Common':'English';
  const note=(row,label,recs,oldV,newV)=>changes.push({row,label,who:recs.length>1?'Both':who(recs[0]),old:oldV,neu:newV});
  let rowsWithChange=0,newRows=0,emptyRows=0;
  sheetRows.forEach((x,i)=>{
    const row=i+2,get=h=>T(x[h]);
    const idE=get(ID_EN),idA=get(ID_AS);
    if(!idE&&!idA){if(HEAD.some(h=>get(h)))newRows++;else emptyRows++;return;}
    let e=idE?byId.get(idE):null,a=idA?byId.get(idA):null,bad=false;
    if(idE&&!e){errors.push(`Row ${row}: Record ID English “${idE}” is not in your question bank (changed, or the question was deleted).`);bad=true;}
    if(idA&&!a){errors.push(`Row ${row}: Record ID Assamese “${idA}” is not in your question bank (changed, or the question was deleted).`);bad=true;}
    if(e&&L(e)==='ASSAMESE'){errors.push(`Row ${row}: the ID in “Record ID English” belongs to an Assamese question.`);bad=true;}
    if(a&&L(a)!=='ASSAMESE'){errors.push(`Row ${row}: the ID in “Record ID Assamese” is not an Assamese question.`);bad=true;}
    if(e&&a&&L(e)==='COMMON'){errors.push(`Row ${row}: a Common (MAT) question cannot have an Assamese record ID.`);bad=true;}
    {let dup=0;[[idE,e],[idA,a]].forEach(([id,r])=>{if(!r)return;if(usedIds.has(id))dup=dup||usedIds.get(id);else usedIds.set(id,row);});if(dup){errors.push(`Row ${row}: the same Record ID is also on row ${dup}. Each question may be on one row only — delete the extra row.`);bad=true;}}
    if(bad)return;
    const ue=e?idx.unitOf.get(e.id):null,ua=a?idx.unitOf.get(a.id):null;
    if(e&&a&&ue.pass!==ua.pass){errors.push(`Row ${row}: a passage question and a normal question cannot be on the same row.`);return;}
    const b=e||a,pass=!!(ue||ua).pass,before=changes.length,recs=[e,a].filter(Boolean);
    const changed=h=>{if(!(h in x))return false;const c=R.cur(h,e,a,ue,ua);if(c.length>EXCEL_MAX)return false;return get(h)!==c;};
    // fields that cannot be changed here
    ['Part','Medium','Question Type','Question Order'].forEach(h=>{if(changed(h)&&!(h==='Medium'&&!get(h)))warns.push(`Row ${row}: “${h}” cannot be changed here – change ignored.`);});
    // language text
    for(const [h,[w,f]] of Object.entries(LANG_FIELDS)){if(!changed(h))continue;const r=w==='e'?e:a;if(!r)continue;const v=normMath(get(h));
      if(f==='question_text'&&!v&&!T(r.image_url)){errors.push(`Row ${row}: “${h}” cannot be empty.`);continue;}
      if(normMath(R.cur(h,e,a,ue,ua))===v)continue;put(r,f,v||null,row);note(row,h,[r],R.cur(h,e,a,ue,ua),v);}
    // passage title / text → every question of that passage
    for(const [h,[w,f]] of Object.entries(PASSAGE_FIELDS)){if(!changed(h))continue;const r=w==='e'?e:a,u=w==='e'?ue:ua;if(!r||!u)continue;
      if(!u.pass){warns.push(`Row ${row}: “${h}” is only for passage questions – ignored.`);continue;}
      const v=get(h);if(!v){errors.push(`Row ${row}: “${h}” cannot be empty for a passage.`);continue;}
      const k=u.key+'|'+f;if(unitSet.has(k)&&unitSet.get(k)!==v){errors.push(`Row ${row}: a different “${h}” was typed on another row of the same passage.`);continue;}
      if(unitSet.has(k))continue;unitSet.set(k,v);
      const old=u.recs.map(q=>T(q[f])).find(Boolean)||'';u.recs.forEach(q=>put(q,f,v,row));note(row,h+' (all 5 questions)',[r],old,v);}
    // shared text fields → both languages
    for(const [h,f] of Object.entries(TEXT_SHARED)){if(!changed(h))continue;let v=get(h);
      if(h==='Difficulty'){const m=['Easy','Medium','Hard'].find(d=>d.toLowerCase()===v.toLowerCase());if(v&&!m){errors.push(`Row ${row}: Difficulty must be Easy, Medium or Hard (or blank).`);continue;}v=m||'';}
      recs.forEach(r=>put(r,f,v||null,row));note(row,h,recs,R.cur(h,e,a,ue,ua),v);}
    if(changed('Marks')){const v=Number(get('Marks'));if(!get('Marks')||!Number.isFinite(v)||v<0)errors.push(`Row ${row}: Marks must be a number, 0 or more.`);else if(v!==Number(R.cur('Marks',e,a,ue,ua))){recs.forEach(r=>put(r,'marks',v,row));note(row,'Marks',recs,R.cur('Marks',e,a,ue,ua),String(v));}}
    if(changed('Correct Answer')&&U(get('Correct Answer'))!==R.cur('Correct Answer',e,a,ue,ua)){const v=U(get('Correct Answer'));if(!['A','B','C','D'].includes(v))errors.push(`Row ${row}: Correct Answer must be A, B, C or D.`);else{recs.forEach(r=>put(r,'correct_option',v,row));note(row,'Correct Answer',recs,R.cur('Correct Answer',e,a,ue,ua),v);}}
    for(const [h,f] of [['Fixed Question','is_fixed'],['Common','is_common']]){if(!changed(h))continue;const v=boolCell(get(h));
      if(v===null){errors.push(`Row ${row}: “${h}” must be YES or NO.`);continue;}if((v?'YES':'NO')===R.cur(h,e,a,ue,ua))continue;
      if(f==='is_common'&&!Object.prototype.hasOwnProperty.call(b,'is_common')){warns.push(`Row ${row}: Common needs the V19 SQL – ignored.`);continue;}
      recs.forEach(r=>put(r,f,v,row));note(row,h,recs,R.cur(h,e,a,ue,ua),v?'YES':'NO');}
    // subject / lesson (a passage moves as a whole, both languages)
    if(changed('Subject Name')||changed('Lesson Code')){
      const sn=get('Subject Name'),lc=get('Lesson Code');
      const s=subjects().find(z=>T(z.name).toLowerCase()===sn.toLowerCase());
      const l=s&&lessons().find(z=>z.subject_id===s.id&&T(z.lesson_code).toLowerCase()===lc.toLowerCase());
      if(!s)errors.push(`Row ${row}: Subject “${sn}” not found.`);
      else if(!l)errors.push(`Row ${row}: Lesson Code “${lc}” not found under ${s.name}.`);
      else if(l.id!==b.lesson_id||s.id!==b.subject_id){
        const targets=pass?[ue,ua].filter(Boolean).flatMap(u=>u.recs):recs;
        targets.forEach(r=>{put(r,'subject_id',s.id,row);put(r,'lesson_id',l.id,row);put(r,'lesson_code',T(l.lesson_code),row);});
        note(row,pass?'Subject / Lesson (whole passage)':'Subject / Lesson',recs,`${R.cur('Subject Name',e,a,ue,ua)} · ${R.cur('Lesson Code',e,a,ue,ua)}`,`${s.name} · ${l.lesson_code}`);}
    }
    // explanations
    if(changed('Explanation')){const v=normMath(get('Explanation'));
      const t=[];if(e)t.push(e);if(a&&(R.hasExplAs||!e))t.push(a);
      if(!R.hasExplAs&&!e)warns.push(`Row ${row}: no English version – use “Explanation Assamese” for the Assamese explanation. “Explanation” ignored.`);
      else if(v!==normMath(R.cur('Explanation',e,a,ue,ua))){t.forEach(r=>put(r,'explanation',v||null,row));note(row,'Explanation',t,R.cur('Explanation',e,a,ue,ua),v);}}
    if(changed('Explanation Assamese')){const v=normMath(get('Explanation Assamese'));
      const r=a||(e&&L(e)==='COMMON'?e:null),f=R.hasExplAs?'explanation_as':'explanation';
      if(!r){if(!(e&&!a&&get('Question Assamese')))warns.push(`Row ${row}: no Assamese version – “Explanation Assamese” ignored.`);}
      else if(v!==normMath(R.cur('Explanation Assamese',e,a,ue,ua))){put(r,f,v||null,row);note(row,'Explanation Assamese',[r],R.cur('Explanation Assamese',e,a,ue,ua),v);}}
    // a missing language version typed in → add it, linked to this question
    const addSide=(src,lang)=>{
      const pre=lang==='ASSAMESE'?'Assamese':'English';
      const q=get('Question '+pre);if(!q)return;
      if(pass){warns.push(`Row ${row}: a missing ${pre} passage cannot be added here – use Bulk Upload. Ignored.`);return;}
      if(L(src)==='COMMON'){warns.push(`Row ${row}: Common (MAT) questions have one version only – Assamese text ignored.`);return;}
      const m=Object.assign({},src,payload.get(src.id)||{});
      const rec={teacher_id:current.id,section_code:m.section_code,part_code:m.part_code,topic:m.topic??null,variation_group:m.variation_group??null,is_fixed:!!m.is_fixed,question_type:m.question_type||'MCQ',marks:m.marks??1,cognitive_level:m.cognitive_level??null,difficulty:m.difficulty??null,language:lang,subject_id:m.subject_id,lesson_id:m.lesson_id,lesson_code:m.lesson_code??null,
        question_text:normMath(q),option_a:normMath(get('Option A '+pre))||null,option_b:normMath(get('Option B '+pre))||null,option_c:normMath(get('Option C '+pre))||null,option_d:normMath(get('Option D '+pre))||null,correct_option:U(m.correct_option)||'A',
        image_url:m.image_url??null,source_type:src.source_type??null,active:true,passage_id:null,passage_title:null,passage_text:null,question_order:null,set_id:null};
      if(Object.prototype.hasOwnProperty.call(src,'is_common'))rec.is_common=!!m.is_common;
      const ex=normMath(get('Explanation')),exAs=normMath(get('Explanation Assamese'));
      if(lang==='ASSAMESE'){rec.explanation=(R.hasExplAs?ex:exAs)||null;if(R.hasExplAs&&exAs)rec.explanation_as=exAs;}
      else rec.explanation=ex||null;
      const pairId=T(src.language_pair_id)&&!all.some(z=>z.id!==src.id&&T(z.language_pair_id)===T(src.language_pair_id))?T(src.language_pair_id):crypto.randomUUID();
      rec.language_pair_id=pairId;if(T(src.language_pair_id)!==pairId)put(src,'language_pair_id',pairId,row);
      inserts.push({row,rec,src});changes.push({row,label:'New '+pre+' version added (linked to this question)',who:pre,old:'',neu:rec.question_text});
    };
    if(e&&!a)addSide(e,'ASSAMESE');
    if(a&&!e)addSide(a,'ENGLISH');
    // two separate questions put on one row → save them as a linked pair
    if(e&&a&&!pass&&L(e)==='ENGLISH'&&!(T(e.language_pair_id)&&T(e.language_pair_id)===T(a.language_pair_id)))links.push({row,e,a});
    if(changes.length>before)rowsWithChange++;
  });
  if(newRows)warns.push(`${newRows} row(s) have no Record ID – new questions are not added here (use “📥 Bulk Upload JNVST Questions”). Ignored.`);
  return {errors,warns,changes,payload,inserts,links,rowsWithChange,rows:sheetRows.length-emptyRows};
}

root.jnvstQbReadEditedExcel=function(ev){
  const f=ev.target.files?.[0],box=document.getElementById('jqxPreview'),btn=document.getElementById('jqxApply'),list=document.getElementById('jqxChanges');
  if(!f||!box)return;btn.disabled=true;plan=null;list.innerHTML='';document.getElementById('jqxLinkWrap').style.display='none';
  box.innerHTML='Reading the file and loading the latest questions…';
  const fr=new FileReader();
  fr.onload=async e=>{try{
    if(typeof XLSX==='undefined')throw new Error('Excel library is not loaded.');
    const wb=XLSX.read(e.target.result,{type:'array'});
    const name=wb.SheetNames.find(n=>/question/i.test(n))||wb.SheetNames[0];
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:false});
    // accept the ID headers even if Excel trimmed the "(do not change)" part
    const fix=r=>{const o={};for(const [k,v] of Object.entries(r)){const kk=T(k);const key=/^record id english/i.test(kk)?ID_EN:/^record id assamese/i.test(kk)?ID_AS:/^check/i.test(kk)?CHECK:(HEAD.find(h=>h.toLowerCase()===kk.toLowerCase())||kk);o[key]=v;}return o;};
    const data=rows.map(fix);
    if(!data.length)throw new Error('The sheet is empty.');
    if(!data.some(r=>ID_EN in r||ID_AS in r))throw new Error('This file has no “Record ID” columns, so it was not made with “⬇ Download for Editing”. To add NEW questions use “📥 Bulk Upload JNVST Questions”.');
    await freshBank();
    plan=buildPlan(data);showPlan();
  }catch(err){box.innerHTML=`<div class="notice">Could not read the file: ${escx(err.message||err)}</div>`;}};
  fr.readAsArrayBuffer(f);
};

function cut(s,n=140){s=String(s??'');return s.length>n?s.slice(0,n)+'…':s;}
function showPlan(){
  const box=document.getElementById('jqxPreview'),btn=document.getElementById('jqxApply'),list=document.getElementById('jqxChanges'),p=plan;
  const nUpd=p.payload.size,nIns=p.inserts.length,nLink=p.links.length;
  let h='';
  if(p.errors.length)h+=`<div class="notice" style="border-color:#dc2626;background:#fef2f2"><b>❌ ${p.errors.length} problem(s) — fix them in Excel and choose the file again. Nothing has been saved.</b><br>${p.errors.slice(0,60).map(escx).join('<br>')}${p.errors.length>60?'<br>…':''}</div>`;
  h+=`<div class="${p.errors.length?'notice':'success'}" style="margin-top:8px"><b>${p.rows}</b> row(s) read · <b>${p.rowsWithChange}</b> row(s) changed · <b>${nUpd}</b> saved question record(s) to update${nIns?` · <b>${nIns}</b> new language version(s) to add`:''}${nLink?` · <b>${nLink}</b> English–Assamese pair(s) to link`:''}</div>`;
  if(p.warns.length)h+=`<div class="notice" style="margin-top:8px"><b>Note:</b><br>${p.warns.slice(0,40).map(escx).join('<br>')}${p.warns.length>40?'<br>…':''}</div>`;
  box.innerHTML=h;
  const lw=document.getElementById('jqxLinkWrap');
  if(nLink){lw.style.display='flex';document.getElementById('jqxLinkText').innerHTML=`Also save the English–Assamese link of <b>${nLink}</b> row(s) whose two versions were not linked yet (recommended — next time they are found together for sure).`;}
  const nothing=!nUpd&&!nIns&&!nLink;
  btn.disabled=!!p.errors.length||nothing;
  if(nothing&&!p.errors.length)box.innerHTML+=`<div class="notice" style="margin-top:8px">No changes found — the file is the same as the question bank.</div>`;
  else if(!nUpd&&!nIns&&!p.errors.length)box.innerHTML+=`<div class="notice" style="margin-top:8px">No text changes found — only the English–Assamese links below can be saved.</div>`;
  list.innerHTML=p.changes.length?`<h3 style="margin:6px 0">Changes (${p.changes.length})</h3><div style="overflow:auto;max-height:60vh"><table><thead><tr><th>Row</th><th>Field</th><th>Version</th><th>Now</th><th>New</th></tr></thead><tbody>${p.changes.slice(0,500).map(c=>`<tr><td>${c.row}</td><td>${escx(c.label)}</td><td>${escx(c.who)}</td><td class="small" style="color:#991b1b;white-space:pre-wrap">${escx(cut(c.old))||'<span class="muted">—</span>'}</td><td class="small" style="color:#166534;white-space:pre-wrap">${escx(cut(c.neu))||'<span class="muted">(blank)</span>'}</td></tr>`).join('')}</tbody></table></div>${p.changes.length>500?`<div class="small muted">…and ${p.changes.length-500} more</div>`:''}`:'';
}

root.jnvstQbApplyEditedExcel=async function(){
  if(!plan||plan.errors.length||document.getElementById('jnvstBulkUploadLock'))return;
  const p=plan,doLink=!!document.getElementById('jqxLink')?.checked;
  const ups=new Map([...p.payload].map(([id,v])=>[id,Object.assign({},v)]));
  if(doLink)for(const {e,a} of p.links){const id=crypto.randomUUID();[e,a].forEach(r=>{const o=ups.get(r.id)||{};if(!o.language_pair_id)o.language_pair_id=id;ups.set(r.id,o);});}
  // a new language version uses its partner's pair id; keep them equal
  for(const {rec,src} of p.inserts){const o=ups.get(src.id);if(o&&o.language_pair_id)rec.language_pair_id=o.language_pair_id;}
  const list=[...ups].filter(([,v])=>Object.keys(v).length),total=list.length+(p.inserts.length?1:0);
  if(!total)return say('Nothing to save.');
  // V32: answer keys changed → earlier results are re-marked; ask once for the whole file
  let remark='';
  try{
    const byKey=new Map();list.forEach(([id,v])=>{if(v.correct_option){const k=String(v.correct_option).toUpperCase();(byKey.get(k)||byKey.set(k,[]).get(k)).push(id);}});
    let ans=0,chg=0,stu=0,asg=0,mk=0;
    for(const [k,ids] of byKey){const {data,error}=await sb.rpc('v32_answer_key_impact',{p_table:'mock_question_bank',p_ids:ids,p_new:k});if(error)break;ans+=+data.answers||0;chg+=+data.changes||0;stu+=+data.students||0;asg+=+data.assignments||0;mk+=+data.mock_tests||0;}
    if(chg)remark=`\n\n⚠ Correct Answer changed: ${chg} earlier answer(s) of about ${stu} student(s) in ${asg} assignment(s) and ${mk} mock test(s) will be RE-MARKED automatically (scores, mock test marks and Mistake Bank). OMR results are not changed.`;
  }catch(_){}
  if(!confirm(`Save the changes now?\n\n${list.length} question record(s) will be updated${p.inserts.length?`\n${p.inserts.length} new language version(s) will be added`:''}.${remark}`))return;
  root.__v32Skip=true;   // already confirmed for the whole file
  try{jnvstBulkUploadLock('Saving edited JNVST questions…','Please do not close this page.')}catch(_){}
  const prog=(pc,t)=>{try{jnvstBulkUploadProgress(pc,t)}catch(_){}};
  let done=0,failed=[];
  try{
    for(let i=0;i<list.length;i+=5){
      await Promise.all(list.slice(i,i+5).map(async([id,v])=>{
        const {error}=await sb.from('mock_question_bank').update(v).eq('id',id).eq('teacher_id',current.id);
        if(error)failed.push(`${id}: ${error.message}`);else{done++;const c=bankRows().find(q=>q.id===id);if(c)Object.assign(c,v);}
      }));
      prog(Math.round(5+85*Math.min(i+5,list.length)/Math.max(1,list.length)),`Updated ${done} of ${list.length}…`);
    }
    let added=0;
    if(p.inserts.length){for(let i=0;i<p.inserts.length;i+=200){const {error}=await sb.from('mock_question_bank').insert(p.inserts.slice(i,i+200).map(x=>x.rec));if(error)failed.push('New versions: '+error.message);else added+=Math.min(200,p.inserts.length-i);}}
    prog(100,'Done.');
    setTimeout(()=>{try{jnvstBulkUploadUnlock()}catch(_){}
      say(`Re-upload finished.\nUpdated: ${done} question record(s)${p.inserts.length?`\nAdded: ${added} new language version(s)`:''}${failed.length?`\n\nNot saved (${failed.length}):\n${failed.slice(0,10).join('\n')}`:''}`);
      plan=null;root.__v32Skip=false;jnvstQuestionBankHome();},300);
  }catch(e){root.__v32Skip=false;try{jnvstBulkUploadUnlock()}catch(_){}say('Saving stopped: '+(e.message||e)+`\n\n${done} record(s) were already updated.`);}
};

/* ---------- 5. buttons in the JNVST Question Bank ---------- */
function addButtons(){
  if(!document.getElementById('jnvstQbTable'))return;
  if(!document.getElementById('jqxDownloadBtn')){
    const pdf=[...document.querySelectorAll('button')].find(b=>/jnvstQbDiscussionPdf/.test(b.getAttribute('onclick')||''));
    const clear=[...document.querySelectorAll('button')].find(b=>/jnvstQbClearSelection/.test(b.getAttribute('onclick')||''));
    const b=document.createElement('button');b.id='jqxDownloadBtn';b.type='button';
    b.style.cssText='background:#7c3aed;color:#fff;border:0;font-weight:700';
    b.title='Excel with English + Assamese on one row. Edit it, then use “Re-upload Edited Excel”. Nothing ticked = all questions matching the filters.';
    b.textContent='⬇ Download for Editing (Excel)';b.onclick=()=>root.jnvstQbDownloadForEditing();
    const at=pdf||clear;if(at)at.after(b);
  }
  if(!document.getElementById('jqxReuploadBtn')){
    const tpl=[...document.querySelectorAll('button')].find(b=>/downloadJnvstQuestionTemplate/.test(b.getAttribute('onclick')||''));
    if(tpl){const b=document.createElement('button');b.id='jqxReuploadBtn';b.type='button';b.className='secondary';b.textContent='⬆ Re-upload Edited Excel';b.onclick=()=>root.jnvstQbReuploadPage();tpl.after(b);}
  }
}
const origHome=root.jnvstQuestionBankHome;
if(typeof origHome==='function'){
  root.jnvstQuestionBankHome=async function(){const r=await origHome.apply(this,arguments);try{addButtons()}catch(e){console.error('V29 buttons',e)}return r;};
}
root.__jnvstQbExcel={buildIndex,exportRows,buildPlan}; // for testing
})();
