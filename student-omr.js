/* Swarup Sir's Knowledge Hub — Student OMR results (V17)
 * Lists the student's own scanned OMR exams and lets them download a result report as PDF.
 * Loaded on demand by main.html (student side). Needs omr-engine.js for the report layout.
 */
(function(root){
'use strict';
function loadOnce(src){
  return new Promise((res,rej)=>{
    const key='__load_'+src;if(root[key])return root[key].then(res,rej);
    root[key]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('Could not load '+src));document.head.appendChild(s);});
    root[key].then(res,rej);
  });
}
async function studentOmrLoadApp(){
  const box=document.getElementById('omrAppResults');if(!box)return;
  try{
    const {data,error}=await sb.rpc('student_omr_exams');
    if(error)throw error;
    if(!data||!data.length){box.innerHTML='';return;}
    box.innerHTML=`<div class="card omr-result-card"><h3 style="margin-top:0;color:#1d4ed8">📝 My scanned OMR exams</h3>
      ${data.map(x=>{const pct=x.total?Math.round(x.correct*100/x.total):0;
        return `<div class="assignment" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
          <div><b>${esc(x.title||'OMR exam')}</b><div class="small muted">${esc(x.subject||'')} · ${x.imported_at?new Date(x.imported_at).toLocaleDateString('en-IN'):''}</div>
          <div><span class="tag">${x.correct}/${x.total}</span> <span class="tag">${pct}%</span></div></div>
          <button onclick="studentOmrDownload('${esc(x.paper_base_serial)}')">⬇ Download result PDF</button></div>`;}).join('')}
      <div class="small muted" style="margin-top:8px">Questions you got wrong are in your Mistake Bank and will come back in your next practice.</div></div>`;
  }catch(e){
    box.innerHTML='';console.warn('OMR results unavailable:',e);
  }
}
async function studentOmrDownload(base){
  const w=window.open('','_blank');
  if(!w)return notify('Your browser blocked the pop-up. Please allow pop-ups for this site and try again.');
  try{
    w.document.write('<!doctype html><title>Preparing…</title><body style="font-family:Arial;padding:30px">Preparing your result report…</body>');
    await loadOnce('omr-engine.js?v=4');
    const {data,error}=await sb.rpc('student_omr_report',{p_paper_base_serial:base});
    if(error)throw error;
    const html=OMR.reportHtml({
      title:data.title,subject:data.subject,studentName:data.student_name,rollNo:data.roll_no,
      date:data.imported_at?new Date(data.imported_at).toLocaleDateString('en-IN'):'',
      rows:data.rows||[],fmt:typeof jnvstMathPreview==='function'?jnvstMathPreview:undefined
    });
    w.document.open();w.document.write(html);w.document.close();
  }catch(e){
    try{w.close();}catch(_){}
    notify('Could not open your result report: '+(e.message||e));
  }
}
Object.assign(root,{studentOmrLoadApp,studentOmrDownload});
})(typeof window!=='undefined'?window:globalThis);
