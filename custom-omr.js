/* Swarup Sir's Knowledge Hub — Personal OMR sheets, scanning and result reports (V17)
 * For batches made with Custom Adaptive Question Paper (one personal paper per student):
 *   1. Print one OMR answer sheet per student (name, roll no. and a machine-readable sheet code)
 *   2. Scan photos / scanned PDFs of the filled sheets, check doubtful marks, import
 *      into the Mistake Bank (same import function as "Import OMR Results")
 *   3. Print result reports; students download their own from the student app
 * Loaded by main.html after custom-adaptive-paper.js. Needs omr-engine.js.
 */
(function(root){
'use strict';
const q$=id=>document.getElementById(id);
let B=null;   // open batch  {base,title,subject,recs,byIdx}
let SC=null;
let H=new Map();  // batch list: base -> {rs, free}  // scan session {entries,imported}
const chunk=(a,n)=>{const r=[];for(let i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r;};
const pIdx=serial=>{const m=String(serial||'').match(/-P(\d+)$/);return m?parseInt(m[1],10):null;};
const isCustom=r=>r&&(r.is_custom==='true'||r.is_custom===true||!!(r.paper_snapshot&&r.paper_snapshot.custom));
const fmtDate=d=>{try{return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}catch(_){return '';}};
// Students whose OMR results are already imported for a batch: Set of student ids per base serial.
async function loadScanned(base){
  const by=new Map();
  const add=r=>{if(!by.has(r.paper_base_serial))by.set(r.paper_base_serial,new Set());by.get(r.paper_base_serial).add(r.student_id);};
  for(let from=0;;from+=1000){
    let q=sb.from('omr_responses').select('paper_base_serial,student_id').eq('question_no',1);
    if(base)q=q.eq('paper_base_serial',base);
    const {data,error}=await q.order('id').range(from,from+999);
    if(error)throw error;(data||[]).forEach(add);if(!data||data.length<1000)break;
  }
  return by;
}
const sidOf=r=>r.student_id||(r.paper_snapshot&&r.paper_snapshot.student_id)||'';
// A paper may be deleted only when its student's OMR is not imported (an unknown student is kept, to be safe).
const isScanned=(r,set)=>!sidOf(r)||(set&&set.has(sidOf(r)));
const rollSort=(a,b)=>String(a.roll_no||'').localeCompare(String(b.roll_no||''),undefined,{numeric:true});

/* --------------------------------- batch list --------------------------------- */
async function customOmrHome(){
  render(`<div class="wrap">${header('Personal OMR Sheets')}<div class="card"><p class="muted">Loading your personal paper batches…</p></div></div>`);
  try{
    const recs=(await qpLoadHistoryRecords()).filter(isCustom);
    const groups=new Map();
    recs.forEach(r=>{const k=qpHistoryGroupKey(r.serial_no);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});
    let scannedBy=new Map();try{scannedBy=await loadScanned();}catch(_){}
    H=new Map();
    let imports=[];try{const {data}=await sb.from('omr_imports').select('paper_base_serial,student_count,imported_at').eq('teacher_id',current.id);imports=data||[];}catch(_){}
    const cards=[...groups].map(([base,rs])=>{
      const first=rs[0],imp=imports.filter(i=>i.paper_base_serial===base);
      const set=scannedBy.get(base),free=rs.filter(r=>!isScanned(r,set));H.set(base,{rs,free});
      const n=rs.filter(r=>set&&set.has(sidOf(r))).length||(set?0:imp.reduce((t,i)=>t+(i.student_count||0),0));
      return `<div class="assignment"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
        <div><b>${esc(first.title||'Personal paper')}</b><div class="small muted">${esc(first.subject||'')} · ${esc(fmtDate(first.generated_at))} · ${rs.length} student${rs.length===1?'':'s'} · ${Number(first.question_count||0)} questions · <code>${esc(base)}</code></div>
        ${n?`<span class="tag" style="background:#dcfce7;color:#166534">✓ ${n} of ${rs.length} scanned &amp; imported</span>`:'<span class="tag">Not scanned yet</span>'}</div>
        <div class="actions" style="margin:0"><button onclick="customOmrBatch('${esc(base)}')">Open</button>${free.length?`<button class="danger" onclick="customOmrDeleteUnscanned('${esc(base)}')">🗑 ${free.length===rs.length?'Delete batch':'Delete not-scanned ('+free.length+')'}</button>`:''}</div></div></div>`;}).join('');
    render(`<div class="wrap">${header('Personal OMR Sheets')}
      <div class="card" style="border:2px solid #0f766e;background:#f0fdfa"><h2 style="margin:0">🧾 Personal OMR sheets, scanning and result reports</h2>
        <p class="muted" style="margin:6px 0 0">For papers made with <b>Custom Adaptive Papers</b>: print each student's own OMR sheet, scan the filled sheets with a phone or scanner, and the answers go straight into the Mistake Bank. Students download their result PDF from their own login.</p></div>
      <div class="card"><h2 style="margin-top:0">Personal paper batches</h2>${cards||'<p class="muted">No personal papers yet. Create them first with <b>Custom Adaptive Papers</b>.</p>'}</div>
      <div class="actions"><button class="secondary" onclick="questionPaperGeneratorPage()">← Question Paper Generator</button></div></div>`);
  }catch(e){
    render(`<div class="wrap">${header('Personal OMR Sheets')}<div class="card">${message('Could not load: '+(e.message||e))}</div></div>`);
  }
}

/* ------------------------------------ one batch ------------------------------------ */
async function customOmrBatch(base){
  render(`<div class="wrap">${header('Personal OMR Sheets')}<div class="card"><p class="muted">Loading…</p></div></div>`);
  try{
    const recs=(await qpLoadHistoryRecords()).filter(r=>isCustom(r)&&qpHistoryGroupKey(r.serial_no)===base).sort(rollSort);
    if(!recs.length)throw new Error('This batch was not found in Generated History.');
    const byIdx=new Map();recs.forEach(r=>{const i=pIdx(r.serial_no);if(i!=null)byIdx.set(i,r);});
    let scanned=new Set();try{scanned=(await loadScanned(base)).get(base)||new Set();}catch(_){}
    B={base,title:recs[0].title||'Personal paper',subject:recs[0].subject||'',recs,byIdx,scanned};
    SC={entries:[],imported:false,busy:false};
    const maxQ=Math.max(...recs.map(r=>Number(r.question_count||0)));
    render(`<div class="wrap">${header('Personal OMR Sheets')}
      <div class="card"><h2 style="margin:0">${esc(B.title)}</h2><div class="small muted">${esc(B.subject)} · ${recs.length} students · ${maxQ} questions · <code>${esc(base)}</code></div><div class="small muted">OMR tools version ${esc(OMR.VERSION||'old')}</div></div>
      <div class="card"><h2 style="margin-top:0">Papers in this batch</h2><div id="omrPapers"></div></div>
      <div class="card"><h2 style="margin-top:0">1. Print OMR sheets</h2>
        <p class="muted">One sheet per student with their name, roll no. and a sheet code the scanner reads. Print on plain white A4 at <b>100% scale</b>. Students fill <b>one circle per question</b> with a dark pen or pencil.</p>
        ${maxQ>OMR.FORMATS.full.maxQ?`<div class="notice">A sheet holds up to ${OMR.FORMATS.full.maxQ} questions; this paper has ${maxQ}.</div>`:`
        <div style="margin:8px 0"><label style="display:block;margin:4px 0"><input type="radio" name="omrSize" value="half" ${maxQ<=OMR.FORMATS.half.maxQ?'checked':'disabled'}> <b>Two sheets on one A4 page</b> — cut or tear along the dashed line (up to ${OMR.FORMATS.half.maxQ} questions)${maxQ>OMR.FORMATS.half.maxQ?' <span class="small muted">— not available: this paper has '+maxQ+' questions</span>':''}</label>
          <label style="display:block;margin:4px 0"><input type="radio" name="omrSize" value="full" ${maxQ<=OMR.FORMATS.half.maxQ?'':'checked'}> <b>One sheet per A4 page</b> (up to ${OMR.FORMATS.full.maxQ} questions)</label></div>
        <div class="actions"><button onclick="customOmrPrintSheets()">🖨 Print ${recs.length} OMR sheet${recs.length===1?'':'s'}</button><button class="secondary" onclick="customOmrPrintSheets(true)">🖨 Print one blank test sheet</button></div>`}
      </div>
      <div class="card"><h2 style="margin-top:0">2. Scan filled sheets &amp; import</h2>
        <p class="muted">Take a clear photo of each sheet (all four black corner squares visible, flat, even light) or scan to image/PDF. You can select many files at once; a PDF may contain many pages. Any sheet may be turned in any direction. For two-per-page sheets you can photograph/scan each torn half, or the whole page before tearing (both sheets on it are read).</p>
        <input id="omrFiles" type="file" accept="image/*,application/pdf" multiple onchange="customOmrScanFiles(this.files)">
        <div id="omrProg" class="small muted" style="margin-top:8px"></div>
        <div id="omrSheets" style="margin-top:10px"></div>
        <div id="omrImportBar"></div>
        <div id="omrImportResult"></div>
      </div>
      <div class="card"><h2 style="margin-top:0">3. Result reports</h2>
        <p class="muted">After importing, print every student's report (score, part-wise result, the questions they got wrong). Students can also download their own report from the <b>OMR Test Result</b> page in their login.</p>
        <div class="actions"><button onclick="customOmrPrintReports()">🖨 Print result reports (all students)</button>${typeof omrDiscussionPdf==='function'?`<button class="secondary" onclick="omrDiscussionPdf('${esc(base)}')">📽 Class discussion PDF (one question per page)</button>`:''}</div></div>
      <div class="actions"><button class="secondary" onclick="customOmrHome()">← All batches</button></div></div>`);
    paintPapers();
  }catch(e){
    render(`<div class="wrap">${header('Personal OMR Sheets')}<div class="card">${message(e.message||String(e))}<div class="actions"><button class="secondary" onclick="customOmrHome()">← Back</button></div></div></div>`);
  }
}
function paintPapers(){
  const box=q$('omrPapers');if(!box||!B)return;
  const free=B.recs.filter(r=>!isScanned(r,B.scanned));
  box.innerHTML=`<div class="small muted" style="margin-bottom:6px">Papers whose OMR sheet has already been imported are kept (they hold the student's result). Papers not scanned yet can be deleted.</div>
    <div style="max-height:260px;overflow:auto">${B.recs.map(r=>{const sc=isScanned(r,B.scanned);
      return `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #e5e7eb"><span>${esc(r.roll_no||'')} · ${esc(r.student_name||'')}</span>
      <span>${sc?'<span class="tag" style="background:#dcfce7;color:#166534">✓ OMR imported</span>':`<span class="tag">Not scanned</span> <button class="danger" style="padding:3px 8px" onclick="customOmrDeleteOne('${esc(r.id)}')">🗑</button>`}</span></div>`;}).join('')}</div>
    ${free.length?`<div class="actions" style="margin-top:8px"><button class="danger" onclick="customOmrDeleteUnscanned('${esc(B.base)}')">🗑 Delete all not-scanned papers (${free.length})</button></div>`:''}`;
}
async function deleteRecords(recs,label){
  const ids=recs.map(r=>r.id);if(!ids.length)return false;
  if(!confirm(`Delete ${label}? Their saved question papers and answer keys are removed. This cannot be undone.\n\nPapers whose OMR sheet is already imported are never deleted.`))return false;
  for(const c of chunk(ids,100)){
    const {error}=await sb.from('jnvst_generated_question_papers').delete().eq('teacher_id',current.id).in('id',c);
    if(error){notify('Could not delete: '+(error.message||error));return false;}
  }
  return true;
}
async function customOmrDeleteUnscanned(base){
  try{
    // always re-check against the database right before deleting
    const recs=(await qpLoadHistoryRecords()).filter(r=>isCustom(r)&&qpHistoryGroupKey(r.serial_no)===base);
    const set=(await loadScanned(base)).get(base);
    const free=recs.filter(r=>!isScanned(r,set));
    if(!free.length)return notify('Every paper in this batch has already been scanned, so nothing can be deleted.');
    const label=free.length===recs.length?`this whole batch (${free.length} paper${free.length===1?'':'s'}, none scanned)`:`${free.length} not-scanned paper${free.length===1?'':'s'} (${recs.length-free.length} scanned paper${recs.length-free.length===1?' is':'s are'} kept)`;
    if(!await deleteRecords(free,label))return;
    if(B&&B.base===base&&free.length<recs.length)return customOmrBatch(base);
    customOmrHome();
  }catch(e){notify('Could not delete: '+(e.message||e));}
}
async function customOmrDeleteOne(id){
  if(!B)return;const r=B.recs.find(x=>x.id===id);if(!r)return;
  try{
    const set=(await loadScanned(B.base)).get(B.base);
    if(isScanned(r,set)){B.scanned=set||new Set();paintPapers();return notify('This student\'s OMR sheet has already been imported, so the paper is kept.');}
    if(!await deleteRecords([r],`the paper of ${r.student_name||r.roll_no||'this student'}`))return;
    if(B.recs.length<=1)return customOmrHome();
    customOmrBatch(B.base);
  }catch(e){notify('Could not delete: '+(e.message||e));}
}

/* -------------------------------------- printing -------------------------------------- */
function openDoc(){
  const w=window.open('','_blank','width=1100,height=900');
  if(!w){notify('Your browser blocked the pop-up. Please allow pop-ups for this site and try again.');return null;}
  try{w.document.write('<!doctype html><title>Preparing…</title><body style="font-family:Arial;padding:30px">Preparing…</body>');}catch(_){}
  return w;
}
function customOmrPrintSheets(blank){
  if(!B)return;
  if(!OMR.FORMATS||!OMR.VERSION)return notify('An old copy of omr-engine.js is loaded. Upload the new omr-engine.js and press Ctrl+Shift+R to reload.');
  const w=openDoc();if(!w)return;
  try{
    const hash=OMR.hash24(B.base);
    const list=blank?[B.recs[0]]:B.recs;
    const chosen=document.querySelector('input[name="omrSize"]:checked');
    const maxQ=Math.max(...list.map(r=>Number(r.question_count||0)));
    let format=chosen&&chosen.value==='full'?'full':'half';
    if(format==='half'&&maxQ>OMR.FORMATS.half.maxQ)format='full';
    const sheets=list.map(r=>OMR.sheetHtml({format,
      title:B.title,name:blank?'(test sheet)':(r.student_name||''),roll:blank?'':String(r.roll_no||''),note:B.subject,
      serial:r.serial_no,hash,idx:pIdx(r.serial_no)||1,N:Number(r.question_count||0)}));
    w.document.open();w.document.write(OMR.sheetDoc(B.title+' — OMR sheets',sheets));w.document.close();
  }catch(e){try{w.close();}catch(_){}notify('Could not prepare the sheets: '+(e.message||e));}
}

/* -------------------------------------- scanning -------------------------------------- */
async function decodeSource(src){
  if(src.kind==='img'){
    const bmp=await createImageBitmap(src.file);
    const s=Math.min(1,3000/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height);
    if(bmp.close)bmp.close();
    return {gray:OMR.toGray(d.data,c.width,c.height),w:c.width,h:c.height};
  }
  const pdf=await getPdf(src.file);
  const page=await pdf.getPage(src.page);
  const vp=page.getViewport({scale:2.4});
  const c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
  await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height);
  return {gray:OMR.toGray(d.data,c.width,c.height),w:c.width,h:c.height};
}
const pdfCache=new Map();
async function getPdf(file){
  if(pdfCache.has(file))return pdfCache.get(file);
  const mod=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
  mod.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const pdf=await mod.getDocument({data:await file.arrayBuffer()}).promise;
  pdfCache.set(file,pdf);return pdf;
}
function keyOf(rec){const m=new Map();((rec.answer_key_snapshot&&rec.answer_key_snapshot.rows)||[]).forEach(x=>m.set(Number(x['Q.No.']),String(x['Correct Option']||'').toUpperCase()));return m;}
function cropUrl(canon,N,q,fmt){
  const c=OMR.rowCrop(canon,N,q,fmt),cv=document.createElement('canvas');cv.width=c.w;cv.height=c.h;
  const ctx=cv.getContext('2d'),im=ctx.createImageData(c.w,c.h);
  for(let i=0;i<c.gray.length;i++){const v=c.gray[i];im.data[i*4]=v;im.data[i*4+1]=v;im.data[i*4+2]=v;im.data[i*4+3]=255;}
  ctx.putImageData(im,0,0);return cv.toDataURL('image/png');
}
function fillEntry(e,canon,rec,fmt){
  const N=Number(rec.question_count||0);
  e.fmt=fmt||'full';
  const rd=OMR.readAnswers(canon,N,e.fmt);
  e.rec=rec;e.status='ok';e.message='';
  e.answers=rd.answers.map(a=>a.ans);
  e.flags=rd.answers.filter(a=>a.flag).map(a=>({q:a.q,flag:a.flag,f:a.f,done:false}));
  e.crops={};e.flags.forEach(f=>{try{e.crops[f.q]=cropUrl(canon,N,f.q,e.fmt);}catch(_){}});
  e.blank=e.answers.filter(a=>!a).length;
}
async function customOmrScanFiles(fileList){
  if(!B||SC.busy)return;
  const files=[...fileList];if(!files.length)return;
  SC.busy=true;
  const prog=q$('omrProg');
  try{
    const sources=[];
    for(const f of files){
      if(/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name)){
        try{const pdf=await getPdf(f);for(let p=1;p<=pdf.numPages;p++)sources.push({kind:'pdf',file:f,page:p,name:`${f.name} · page ${p}`});}
        catch(e){SC.entries.push({id:SC.entries.length,src:{name:f.name},status:'error',message:'PDF could not be opened: '+(e.message||e)});}
      }else sources.push({kind:'img',file:f,name:f.name});
    }
    let i=0;
    for(const src of sources){
      i++;if(prog)prog.textContent=`Reading sheet ${i} of ${sources.length}…`;
      await new Promise(r=>setTimeout(r,0));
      try{
        const img=await decodeSource(src);
        const r=OMR.locateSheet(img.gray,img.w,img.h);
        if(!r.ok){
          const e={id:SC.entries.length,src,status:'error',message:r.message,canManual:r.reason==='code',answers:[],flags:[],crops:{},include:true};
          SC.entries.push(e);
        }else{
          const many=r.sheets.length>1;
          r.sheets.forEach((sh,k)=>{
            const e={id:SC.entries.length,src:many?{...src,name:src.name+` · sheet ${k+1} of ${r.sheets.length}`}:src,status:'error',message:'',answers:[],flags:[],crops:{},include:true};
            const rec=B.byIdx.get(sh.code.idx);
            if(sh.code.hash!==OMR.hash24(B.base)||!rec){e.message='This sheet belongs to a different paper batch (sheet code does not match).';}
            else fillEntry(e,sh.canon,rec,sh.fmt);
            SC.entries.push(e);
          });
        }
      }catch(err){
        SC.entries.push({id:SC.entries.length,src,status:'error',message:'Could not read this file: '+(err.message||err),answers:[],flags:[],crops:{},include:true});
      }
    }
    markDuplicates();
    if(prog)prog.textContent=`${sources.length} file${sources.length===1?'':'s'} read.`;
  }finally{SC.busy=false;}
  paintScan();
}
function markDuplicates(){
  const seen=new Map();
  SC.entries.forEach(e=>{
    e.dup=false;
    if(e.status!=='ok')return;
    const k=e.rec.id;
    if(seen.has(k)){e.dup=true;e.include=false;}else seen.set(k,e);
  });
}
const score=e=>{const key=keyOf(e.rec);let c=0;e.answers.forEach((a,i)=>{if(a&&a===key.get(i+1))c++;});return c;};
const open=e=>e.flags.filter(f=>!f.done).length;
function paintScan(){
  const box=q$('omrSheets');if(!box)return;
  const ok=SC.entries.filter(e=>e.status==='ok'),bad=SC.entries.filter(e=>e.status!=='ok');
  const scanned=new Set(ok.filter(e=>!e.dup).map(e=>e.rec.id)),missing=B.recs.filter(r=>!scanned.has(r.id));
  const need=ok.filter(e=>!e.dup&&open(e)>0).length;
  box.innerHTML=`${SC.entries.length?`<div class="success"><b>${ok.filter(e=>!e.dup).length}</b> of ${B.recs.length} students scanned${need?` · <b>${need}</b> need a quick check`:''}${bad.length?` · <b>${bad.length}</b> could not be read`:''}</div>`:''}
    ${SC.entries.map(entryHtml).join('')}
    ${SC.entries.length&&missing.length?`<details style="margin-top:8px"><summary class="small">Not scanned yet (${missing.length})</summary><div class="small">${missing.map(r=>esc((r.roll_no?r.roll_no+' · ':'')+(r.student_name||''))).join(', ')}</div></details>`:''}`;
  const bar=q$('omrImportBar');
  const incl=ok.filter(e=>e.include&&!e.dup);
  bar.innerHTML=ok.length&&!SC.imported?`<div class="actions" style="margin-top:12px"><button onclick="customOmrImport()">✅ Import ${incl.length} sheet${incl.length===1?'':'s'} into the Mistake Bank</button></div><div class="small muted">Wrong and blank answers become mistakes; correct answers count towards fixing earlier mistakes.</div>`:'';
}
function entryHtml(e){
  if(e.status!=='ok'){
    const opts=B.recs.filter(r=>!SC.entries.some(x=>x.status==='ok'&&x.rec&&x.rec.id===r.id)).map(r=>`<option value="${esc(r.id)}">${esc((r.roll_no?r.roll_no+' · ':'')+(r.student_name||''))}</option>`).join('');
    return `<div class="assignment" style="border-left:4px solid #dc2626"><b>✕ ${esc(e.src.name||'File')}</b><div class="small">${esc(e.message)}</div>
      ${e.canManual?`<div class="actions" style="margin-top:6px"><select id="omrWho${e.id}" style="max-width:260px"><option value="">Choose the student…</option>${opts}</select><button class="secondary" onclick="customOmrManual(${e.id})">Read as this student</button></div>`:''}
      <div class="actions" style="margin-top:6px"><button class="secondary" onclick="customOmrDrop(${e.id})">Remove</button></div></div>`;
  }
  const o=open(e),sc=score(e),N=Number(e.rec.question_count||0);
  const colour=e.dup?'#94a3b8':o?'#f59e0b':'#16a34a';
  return `<details class="assignment" data-eid="${e.id}" ontoggle="customOmrOpened(this)" style="border-left:4px solid ${colour}">
    <summary style="cursor:pointer"><b>${esc(e.rec.roll_no||'')} · ${esc(e.rec.student_name||'')}</b>
      <span class="tag">${sc}/${N}</span>
      ${e.dup?'<span class="tag" style="background:#e2e8f0">Duplicate sheet — not included</span>':o?`<span class="tag" style="background:#fef3c7;color:#92400e">${o} to check</span>`:'<span class="tag" style="background:#dcfce7;color:#166534">✓ Clear</span>'}
      <span class="small muted">${e.blank} blank · ${esc(e.src.name||'')}</span></summary>
    <div class="ca-body" data-filled="0"></div></details>`;
}
const CHOICES=['','A','B','C','D'];
function customOmrOpened(el){
  if(!el.open)return;const body=el.querySelector('.ca-body');if(!body||body.dataset.filled==='1')return;
  fillEntryBody(Number(el.dataset.eid));
}
function selectHtml(e,q){
  const cur=e.answers[q-1];const list=CHOICES.includes(cur)?CHOICES:[...CHOICES,cur];
  return `<select onchange="customOmrSet(${e.id},${q},this.value)" style="width:auto">${list.map(c=>`<option value="${esc(c)}" ${c===cur?'selected':''}>${c||'(blank)'}</option>`).join('')}</select>`;
}
function fillEntryBody(id){
  const e=SC.entries[id],el=document.querySelector(`details[data-eid="${id}"]`);if(!el||!e)return;
  const body=el.querySelector('.ca-body');
  const labels={multiple:'More than one circle filled',faint:'Very light mark',check:'Another circle is also marked'};
  const fl=e.flags.map(f=>`<tr><td><b>Q${f.q}</b><div class="small muted">${esc(labels[f.flag]||f.flag)}</div></td><td>${e.crops[f.q]?`<img src="${e.crops[f.q]}" style="width:340px;max-width:100%;border:1px solid #cbd5e1;border-radius:6px;image-rendering:auto">`:''}<div class="small muted">A B C D, left to right</div></td><td>${selectHtml(e,f.q)}<div><label class="small" style="font-weight:400"><input type="checkbox" style="width:auto" ${f.done?'checked':''} onchange="customOmrDone(${e.id},${f.q},this.checked)"> checked</label></div></td></tr>`).join('');
  const N=Number(e.rec.question_count||0),key=keyOf(e.rec);
  const all=Array.from({length:N},(_,i)=>i+1).map(q=>`<span style="display:inline-block;width:104px;margin:2px 6px 2px 0;${e.answers[q-1]&&e.answers[q-1]!==key.get(q)?'color:#b91c1c':''}">Q${q} ${selectHtml(e,q)}</span>`).join('');
  body.innerHTML=`${fl?`<h4 style="margin:8px 0 4px">Marks to check</h4><table><tbody>${fl}</tbody></table>`:'<div class="small muted">No doubtful marks on this sheet.</div>'}
    <details style="margin-top:8px"><summary class="small">All answers (change any that was read wrongly)</summary><div style="margin-top:6px">${all}</div></details>
    <div class="actions" style="margin-top:8px"><label style="font-weight:400"><input type="checkbox" style="width:auto" ${e.include?'checked':''} onchange="customOmrInclude(${e.id},this.checked)"> Include this sheet in the import</label><button class="secondary" onclick="customOmrDrop(${e.id})">Remove sheet</button></div>`;
  body.dataset.filled='1';
}
function refreshEntry(id){
  const e=SC.entries[id],el=document.querySelector(`details[data-eid="${id}"]`);if(!el)return paintScan();
  const wasOpen=el.open,t=document.createElement('div');t.innerHTML=entryHtml(e);const nu=t.firstElementChild;
  if(wasOpen)nu.setAttribute('open','');el.replaceWith(nu);if(wasOpen)fillEntryBody(id);
  const sum=q$('omrSheets').querySelector('.success');if(sum)paintSummaryOnly();
}
function paintSummaryOnly(){
  const ok=SC.entries.filter(e=>e.status==='ok'),bad=SC.entries.filter(e=>e.status!=='ok');
  const sum=q$('omrSheets').querySelector('.success');const need=ok.filter(e=>!e.dup&&open(e)>0).length;
  if(sum)sum.innerHTML=`<b>${ok.filter(e=>!e.dup).length}</b> of ${B.recs.length} students scanned${need?` · <b>${need}</b> need a quick check`:''}${bad.length?` · <b>${bad.length}</b> could not be read`:''}`;
  const incl=ok.filter(e=>e.include&&!e.dup).length,btn=q$('omrImportBar').querySelector('button');if(btn)btn.textContent=`✅ Import ${incl} sheet${incl===1?'':'s'} into the Mistake Bank`;
}
function customOmrSet(id,q,val){
  const e=SC.entries[id];e.answers[q-1]=val;e.blank=e.answers.filter(a=>!a).length;
  const f=e.flags.find(x=>x.q===q);if(f)f.done=true;refreshEntry(id);
}
function customOmrDone(id,q,on){const f=SC.entries[id].flags.find(x=>x.q===q);if(f)f.done=on;refreshEntry(id);}
function customOmrInclude(id,on){SC.entries[id].include=on;paintSummaryOnly();}
function customOmrDrop(id){
  SC.entries[id]={id,src:{name:''},status:'removed'};SC.entries=SC.entries.filter(x=>x.status!=='removed').map((e,i)=>{e.id=i;return e;});markDuplicates();paintScan();
}
async function customOmrManual(id){
  const e=SC.entries[id],sel=q$('omrWho'+id);if(!sel||!sel.value)return notify('Choose the student first.');
  const rec=B.recs.find(r=>r.id===sel.value);if(!rec)return;
  try{
    const img=await decodeSource(e.src);
    const s=OMR.straightenWithoutCode(img.gray,img.w,img.h,Number(rec.question_count||0));
    if(!s)return notify('The corner squares could not be found in this picture. Please retake it.');
    fillEntry(e,s.canon,rec,s.fmt);e.include=true;markDuplicates();paintScan();
  }catch(err){notify('Could not read this file: '+(err.message||err));}
}

/* -------------------------------------- import -------------------------------------- */
async function customOmrImport(){
  const list=SC.entries.filter(e=>e.status==='ok'&&e.include&&!e.dup);
  if(!list.length)return notify('No sheets to import.');
  const dupRoll=list.find((e,i)=>list.findIndex(x=>x.rec.id===e.rec.id)!==i);
  if(dupRoll)return notify('Two included sheets belong to the same student ('+dupRoll.rec.student_name+'). Remove one first.');
  const rows=list.map(e=>({roll_no:String(e.rec.roll_no||''),set_code:'A',answers:e.answers.map(a=>a||''),sheet_keys:[]}));
  const unresolved=list.reduce((t,e)=>t+open(e),0);
  const btn=document.activeElement;if(btn&&btn.tagName==='BUTTON')btn.disabled=true;
  const res=q$('omrImportResult');
  try{
    const args={p_paper_base_serial:B.base,p_exam_title:B.title,p_file_name:'Scanned OMR sheets',p_rows:rows};
    const {data:dry,error:de}=await sb.rpc('teacher_import_omr_results',{...args,p_dry_run:true});
    if(de)throw de;
    const msg=`Import ${dry.imported} of ${list.length} sheet${list.length===1?'':'s'} into the Mistake Bank?`+(unresolved?`\n\n${unresolved} doubtful mark${unresolved===1?'':'s'} not yet checked will be imported as read (a question with two circles counts as wrong).`:'')+((dry.rows||[]).some(r=>r.status!=='ok')?`\n\n${dry.rows.filter(r=>r.status!=='ok').length} sheet(s) will be skipped (see below after import).`:'');
    if(!dry.imported){res.innerHTML=omrReportHtml(dry);return;}
    if(!confirm(msg)){if(btn)btn.disabled=false;return;}
    const {data,error}=await sb.rpc('teacher_import_omr_results',{...args,p_dry_run:false});
    if(error)throw error;
    SC.imported=true;try{B.scanned=(await loadScanned(B.base)).get(B.base)||B.scanned;}catch(_){}paintScan();paintPapers();
    res.innerHTML=`${omrReportHtml(data)}<div class="actions" style="margin-top:8px"><button onclick="customOmrPrintReports()">🖨 Print result reports</button></div>`;
    notify(`Imported ${data.imported} student${data.imported===1?'':'s'} into the Mistake Bank.`,'success');
  }catch(e){
    notify('Import failed: '+(e.message||e),'error');if(btn)btn.disabled=false;
  }
}

/* -------------------------------------- reports -------------------------------------- */
async function customOmrPrintReports(){
  if(!B)return;
  const w=openDoc();if(!w)return;
  try{
    const recs=await qpGetHistoryGroupRecords(B.base);
    const resp=[];
    for(let from=0;;from+=1000){
      const {data,error}=await sb.from('omr_responses').select('student_id,question_no,selected_option,correct_option,is_correct').eq('paper_base_serial',B.base).order('id').range(from,from+999);
      if(error)throw error;resp.push(...(data||[]));if(!data||data.length<1000)break;
    }
    let imp=null;try{const {data}=await sb.from('omr_imports').select('imported_at').eq('teacher_id',current.id).eq('paper_base_serial',B.base).order('imported_at',{ascending:false}).limit(1);imp=data&&data[0];}catch(_){}
    // subject / lesson names for the grouping in the report
    const subjName=new Map(),lessonName=new Map();
    try{
      const [{data:sj},{data:ls}]=await Promise.all([
        sb.from('jnvst_subjects').select('id,name').eq('teacher_id',current.id),
        sb.from('jnvst_subject_lessons').select('id,lesson_name,parent_lesson_id').eq('teacher_id',current.id)]);
      (sj||[]).forEach(x=>subjName.set(x.id,x.name));
      const lm=new Map((ls||[]).map(x=>[x.id,x]));
      (ls||[]).forEach(x=>{const par=x.parent_lesson_id&&lm.get(x.parent_lesson_id);lessonName.set(x.id,(par?par.lesson_name+' › ':'')+x.lesson_name);});
    }catch(_){}
    // V20: current explanations from the question bank (Assamese ones added after the paper was printed)
    const bankEx=new Map();
    try{
      const ids=[...new Set(recs.flatMap(r=>((r.paper_snapshot&&r.paper_snapshot.rows)||[]).map(q=>q&&q.id).filter(Boolean)))];
      for(let i=0;i<ids.length;i+=150){
        const {data,error}=await sb.from('mock_question_bank').select('id,language,explanation,explanation_as').in('id',ids.slice(i,i+150));
        if(error)break;(data||[]).forEach(x=>bankEx.set(x.id,x));
      }
    }catch(_){}
    const withNames=q=>{const b=bankEx.get(q.id)||{};return Object.assign({},q,{subject_name:subjName.get(q.subject_id)||'',lesson_name:lessonName.get(q.lesson_id)||'',
      explanation:String(b.explanation||'').trim()||q.explanation||'',explanation_as:String(b.explanation_as||'').trim()||q.explanation_as||'',language:b.language||q.language||''});};
    const by=new Map();resp.forEach(r=>{if(!by.has(r.student_id))by.set(r.student_id,new Map());by.get(r.student_id).set(r.question_no,r);});
    const list=recs.filter(r=>by.has(r.paper_snapshot&&r.paper_snapshot.student_id)).sort((a,b)=>String(a.paper_snapshot.roll_no||'').localeCompare(String(b.paper_snapshot.roll_no||''),undefined,{numeric:true})).map(r=>{
      const m=by.get(r.paper_snapshot.student_id),rows=r.paper_snapshot.rows||[];
      const items=rows.map((q,i)=>{const x=m.get(i+1);return {no:i+1,selected:x?(x.selected_option||''):'',correct_option:x?x.correct_option:(q.correct_option||''),is_correct:!!(x&&x.is_correct),q:withNames(q)};});
      return {title:r.title,subject:r.subject,studentName:r.paper_snapshot.student_name,rollNo:r.paper_snapshot.roll_no,date:fmtDate(imp&&imp.imported_at||r.generated_at),rows:items,
        fmt:typeof jnvstMathPreview==='function'?jnvstMathPreview:undefined};
    });
    if(!list.length){w.close();return notify('No imported results yet for this batch. Import the scanned sheets first.');}
    w.document.open();w.document.write(OMR.reportDocMany(list));w.document.close();
  }catch(e){try{w.close();}catch(_){}notify('Could not prepare the reports: '+(e.message||e));}
}

Object.assign(root,{customOmrHome,customOmrBatch,customOmrPrintSheets,customOmrScanFiles,customOmrOpened,customOmrSet,customOmrDone,customOmrInclude,customOmrDrop,customOmrManual,customOmrImport,customOmrPrintReports,customOmrDeleteUnscanned,customOmrDeleteOne,customOmrState:()=>({B,SC})});
})(typeof window!=='undefined'?window:globalThis);
