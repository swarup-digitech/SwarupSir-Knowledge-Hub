/* Swarup Sir's Knowledge Hub — Teacher tools (V13)
 * Loaded by main.html only after a TEACHER logs in, so students no longer
 * download ~542 KB of teacher-only code.
 * Do not load this file directly; main.html calls loadTeacherApp().
 */
async function ensureSchoolSubjects(){if(schoolSubjects?.length)return schoolSubjects;const {data,error}=await sb.from('school_subjects').select('id,name,code').eq('teacher_id',current.id).eq('active',true).order('name');if(error)throw error;schoolSubjects=data||[];return schoolSubjects;}
function schoolSubjectSelectHtml(selected=''){if(!schoolSubjects.length)return '<option value="">No subjects found — add subjects in Teacher Dashboard</option>';return schoolSubjects.map(x=>`<option value="${esc(x.id)}" ${String(selected)===String(x.id)?'selected':''}>${esc(x.name)}</option>`).join('')}
function renderStudentDashboardLoading(){
  render(`<div class="wrap">${header("Student Dashboard",false)}
    <div class="card">
      <h2>Welcome, ${esc(studentDisplayName())}</h2>
      <p class="muted">Loading your assignments and results…</p>
      <div class="success small" style="margin-top:12px">Your dashboard will appear as soon as your latest data is ready.</div>
    </div>
  </div>`);
}
async function doLogin(){return doTeacherLogin()}
async function loadPreviousMockTests(){
  const box=document.getElementById('previousMockTests');
  if(!box)return;
  box.innerHTML='<p class="muted">Loading previous Mock Tests…</p>';
  const {data:tests,error}=await sb.from('mock_tests').select('id,title,language,time_limit_seconds,status,results_released,created_at').eq('teacher_id',current.id).order('created_at',{ascending:false});
  if(error){box.innerHTML=message(error.message);return;}
  if(!tests?.length){box.innerHTML='<p class="muted">No Mock Tests have been created yet.</p>';return;}
  const ids=tests.map(t=>t.id);
  const {data:recipients}=await sb.from('mock_test_students').select('mock_test_id,student_id').in('mock_test_id',ids);
  const {data:attempts}=await sb.from('mock_test_attempts').select('mock_test_id,status,score').in('mock_test_id',ids);
  const rc=new Map(),ac=new Map();
  (recipients||[]).forEach(r=>rc.set(r.mock_test_id,(rc.get(r.mock_test_id)||0)+1));
  (attempts||[]).forEach(a=>ac.set(a.mock_test_id,(ac.get(a.mock_test_id)||0)+1));
  box.innerHTML=tests.map(t=>{
    const lang=t.language==='ENGLISH'?'English':t.language==='ASSAMESE'?'Assamese':'Common';
    const mins=Math.round(Number(t.time_limit_seconds||7200)/60);
    return `<div class="assignment" style="margin:8px 0">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
        <div><h3 style="margin:0 0 5px">${esc(t.title||'Mock Test')}</h3>
          <div class="small muted">${lang} · ${mins} minutes · ${rc.get(t.id)||0} student(s) · ${ac.get(t.id)||0} attempt(s) · Created ${t.created_at?new Date(t.created_at).toLocaleString():'—'}</div>
        </div>
        <div class="actions">
          <button onclick="generateMockTestPDF('${t.id}')">🖨 Question Paper PDF</button>
          <button class="secondary" onclick="editMockTest('${t.id}')">✎ Edit</button>
          <button class="secondary" onclick="toggleMockResultsRelease('${t.id}',${t.results_released?'false':'true'})">${t.results_released?'🔒 Hide Results':'✓ Approve Results'}</button>
          <button class="danger" onclick="deleteMockTest('${t.id}')">🗑 Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
async function toggleMockResultsRelease(id,release){
  const action=release?'make results visible to students':'hide results from students';
  if(!confirm(`Are you sure you want to ${action}?`))return;
  const {error}=await sb.from('mock_tests').update({results_released:!!release}).eq('id',id).eq('teacher_id',current.id);
  if(error)return notify('Could not update result approval: '+error.message);
  notify(release?'Results approved. Students can now view their results.':'Results hidden from students.');
  loadPreviousMockTests();
}
async function editMockTest(id){
  const {data:t,error}=await sb.from('mock_tests').select('id,title,language,time_limit_seconds,status').eq('id',id).eq('teacher_id',current.id).single();
  if(error)return notify(error.message);
  const title=prompt('Edit Mock Test title:',t.title||'Mock Test');
  if(title===null)return;
  const cleanTitle=title.trim();
  if(!cleanTitle)return notify('Title cannot be empty.');
  const currentMinutes=Math.round(Number(t.time_limit_seconds||7200)/60);
  const minsText=prompt('Time limit in minutes:',String(currentMinutes));
  if(minsText===null)return;
  const mins=Number(minsText);
  if(!Number.isFinite(mins)||mins<=0)return notify('Enter a valid time limit in minutes.');
  const {error:ue}=await sb.from('mock_tests').update({title:cleanTitle,time_limit_seconds:Math.round(mins*60)}).eq('id',id).eq('teacher_id',current.id);
  if(ue)return notify('Could not update Mock Test: '+ue.message);
  notify('Mock Test updated successfully.');
  loadPreviousMockTests();
}
async function deleteMockTest(id){
  const {data:t,error:te}=await sb.from('mock_tests').select('id,title').eq('id',id).eq('teacher_id',current.id).single();
  if(te)return notify(te.message);
  const {count:attemptCount}=await sb.from('mock_test_attempts').select('id',{count:'exact',head:true}).eq('mock_test_id',id);
  const {count:recipientCount}=await sb.from('mock_test_students').select('student_id',{count:'exact',head:true}).eq('mock_test_id',id);
  const warning=`Delete Mock Test "${t.title}"?\n\nThis will permanently remove the test, its ${recipientCount||0} assignment(s), ${attemptCount||0} attempt(s), answers and generated questions.\n\nThis cannot be undone.`;
  if(!confirm(warning))return;
  const {error}=await sb.from('mock_tests').delete().eq('id',id).eq('teacher_id',current.id);
  if(error)return notify('Could not delete Mock Test: '+error.message);
  notify('Mock Test deleted successfully.');
  loadPreviousMockTests();
}
function mockTestManagement(){
  sb.from('mock_question_bank').select('part_code,active').eq('teacher_id',current.id).then(({data,error})=>{
    if(error)return render(`<div class="wrap">${header("Mock Test Management")}<div class="card">${message(error.message)}</div></div>`);
    const counts={MAT:0,EVS:0,ARITHMETIC:0,LANGUAGE:0};
    (data||[]).forEach(q=>{const sec=String(q.section_code||'').toUpperCase();if(q.active!==false&&counts[sec]!==undefined)counts[sec]++});
    const parts=[
      ['MAT','🧩 Mental Ability Test (MAT)','MAT_PATTERN,MAT_SERIES,MAT_GEOMETRICAL,MAT_MIRROR,MAT_EMBEDDED','PDF + Answer Key'],
      ['EVS','🌿 Environmental Studies (EVS)','EVS_MCQ,EVS_PASSAGE','Excel'],
      ['ARITHMETIC','➗ Arithmetic','ARITHMETIC','PDF + Answer Key'],
      ['LANGUAGE','📖 Language','LANGUAGE_PASSAGE','Excel']
    ];
    render(`<div class="wrap">${header("🎯 Mock Test Management")}
      <div class="card" style="border:2px solid #7c3aed;background:#faf5ff">
        <h2 style="color:#6d28d9">Independent Mock Test Module</h2>
        <p class="muted">Mock Tests are managed separately from <b>Assignments</b>. Build your question banks here, generate the 80-question JNVST-style test, assign it directly to students/classes, and generate a printable question-paper PDF.</p>
        <div class="grid" style="margin-top:15px">${parts.map(([code,label,partsText,method])=>`<div class="card" style="margin:0;border:1px solid #ddd6fe"><div class="tag" style="background:#ede9fe;color:#6d28d9">${code}</div><h3 style="margin-top:10px">${label}</h3><div class="stat" style="font-size:24px">${counts[code]}</div><div class="small muted">Active questions in bank</div><p class="small"><b>Upload:</b> ${method}</p><button onclick="mockBulkUpload()">Manage / Upload</button></div>`).join('')}</div>
      </div>
      <div class="grid">
        <div class="card"><h2>📥 Question Banks</h2><p class="muted">Upload and maintain questions for the four Mock Test parts.</p><button onclick="mockBulkUpload()">Bulk Upload Question Banks</button></div>
        <div class="card"><h2>✏️ Manage Question Bank</h2><p class="muted">Edit, activate/deactivate, add images, or delete questions.</p><button onclick="mockBankSummary()">Manage Question Bank</button></div>
        <div class="card"><h2>🎯 Generate Mock Test</h2><p class="muted">Select sets from MAT, EVS, Arithmetic and Language to create the complete test.</p><button onclick="generateMockTestPage()">Generate & Assign Test</button></div><div class="card"><h2>🖨️ Question Paper Generator</h2><p class="muted">Create a teacher-only question paper from one or more topics, or select complete Language/EVS passage sets. Download the designed paper and matching Excel answer key.</p><button onclick="questionPaperGeneratorPage()">Generate Question Paper</button></div>
        <div class="card"><h2>📊 Mock Test Results</h2><p class="muted">View student Mock Test attempts and scores separately from Assignment Results.</p><button onclick="mockTeacherResults()">View Mock Results</button></div>
        <div class="card"><h2>📥 Import OMR Results</h2><p class="muted">Upload the OMR software Excel for a paper made with the Question Paper Generator. Mistakes are added to each student's Mistake Bank.</p><button onclick="omrImportPage()">Import OMR Excel</button></div>
      </div>
      <div class="card"><h2>🗂 Previous Mock Tests</h2><p class="muted">Edit the title/time limit or delete previously created Mock Tests. Deleting a test also removes its generated questions, student assignments and attempts.</p><div id="previousMockTests"><p class="muted">Loading…</p></div></div>
      <div class="card" style="background:#f8fafc"><h3>JNVST Mock Test Blueprint</h3><div class="grid">
        ${[['SECTION I — PART 1','Mental Ability • 20 Questions'],['SECTION I — PART 2','EVS • 15 MCQs + 1 Passage × 5 = 20 Questions'],['SECTION II','Arithmetic • 20 Questions'],['SECTION III','Language • 4 Passages × 5 = 20 Questions']].map(x=>`<div class="assignment"><b>${x[0]}</b><div class="muted small">${x[1]}</div></div>`).join('')}
      </div><p class="small muted" style="margin-top:12px">Total: <b>80 Questions • 100 Marks • 2 Hours</b>. Section I contains 20 Mental Ability + 20 EVS questions. Each question carries 1.25 marks.</p></div>
      <button class="secondary" onclick="teacherHome()">← Dashboard</button>
    </div>`);
    // render() completes asynchronously because the management page first
    // loads the question-bank counts. Load previous tests only after the
    // #previousMockTests element has actually been rendered.
    loadPreviousMockTests();
  });
}
function mockPdfPartChanged(){const p=document.getElementById('mockPdfPart')?.value;const plan=mockPlanByPart[p];const box=document.getElementById('mockPdfPreview');if(box&&plan)box.innerHTML=message(`${plan.label}: one question per PDF page. Upload any multiple of ${plan.count} pages (for example ${plan.count}, ${plan.count*2}, ${plan.count*3}…).`,true)}
async function loadMockJnvstPdfSubjectOptions(){const sel=document.getElementById('mockJnvstPdfSubject');if(!sel)return;try{const [{data:subjects,error:se},{data:lessons,error:le}]=await Promise.all([sb.from('jnvst_subjects').select('id,name').eq('teacher_id',current.id).order('name'),sb.from('jnvst_subject_lessons').select('id,subject_id,lesson_code,lesson_name').eq('teacher_id',current.id).order('lesson_code')]);if(se)throw se;if(le)throw le;window._mockJnvstPdfLessons=lessons||[];sel.innerHTML='<option value="">— Select JNVST Subject —</option>'+(subjects||[]).map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');}catch(e){sel.innerHTML='<option value="">Could not load JNVST subjects</option>';console.error(e)}}
function mockJnvstPdfSubjectChanged(){const sid=document.getElementById('mockJnvstPdfSubject')?.value||'',lesson=document.getElementById('mockJnvstPdfLesson');if(!lesson)return;if(!sid){lesson.innerHTML='<option value="">— Select Subject First —</option>';return;}const rows=(window._mockJnvstPdfLessons||[]).filter(x=>x.subject_id===sid);lesson.innerHTML='<option value="">— Select Lesson / Sub-lesson —</option>'+rows.map(x=>`<option value="${x.id}">${esc([x.lesson_code,x.lesson_name].filter(Boolean).join(' — '))}</option>`).join('')}
function readMockAnswerExcel(ev){
 const file=ev.target.files?.[0];if(!file)return;
 const r=new FileReader();r.onload=e=>{try{
   const wb=XLSX.read(e.target.result,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:''});
   if(!rows.length)throw new Error('MAT Metadata Excel contains no data rows.');
   const norm=v=>String(v??'').trim();
   const key=v=>norm(v).toLowerCase().replace(/[_\s.-]+/g,' ');
   const get=(row,names)=>{for(const n of names){const k=Object.keys(row).find(k=>key(k)===key(n));if(k!==undefined)return norm(row[k]);}return ''};
   const partNorm=v=>typeof mockNormalizePart==='function'?mockNormalizePart(v):norm(v).toUpperCase().replace(/\s+/g,'_').replace(/-+/g,'_');
   mockPdfMeta={};mockAnswerKey={};
   const errors=[];const seen=new Set();
   rows.forEach((row,i)=>{
     const excelRow=i+2;
     const pageText=get(row,['Question No','Question Number','Page No','Page Number','No','Number']);
     const page=Number(pageText);
     const correct=get(row,['Correct Option','Correct Answer','Answer']).toUpperCase();
     const part=partNorm(get(row,['Part','Part Code','MAT Part']));
     const topic=get(row,['Topic','Lesson / Topic','Lesson Topic']);
     const marksText=get(row,['Marks','Mark']);
     const marks=Number(marksText);
     const cognitive=get(row,['Cognitive Level','Cognitive_Level']);
     const difficulty=get(row,['Difficulty']);
     const explanation=get(row,['Explanation','Answer / Explanation']);
     if(!Number.isInteger(page)||page<1)errors.push(`Row ${excelRow}: Question No must be a positive integer.`);
     else if(seen.has(page))errors.push(`Row ${excelRow}: duplicate Question No ${page}.`);
     else seen.add(page);
     if(!['A','B','C','D'].includes(correct))errors.push(`Row ${excelRow}: Correct Option must be A, B, C or D.`);
     if(!['MAT_PATTERN','MAT_SERIES','MAT_GEOMETRICAL','MAT_MIRROR','MAT_EMBEDDED'].includes(part))errors.push(`Row ${excelRow}: invalid MAT Part '${part}'.`);
     if(!topic)errors.push(`Row ${excelRow}: Topic is required.`);
     if(!Number.isFinite(marks)||marks<=0)errors.push(`Row ${excelRow}: Marks must be a positive number.`);
     if(cognitive&&!['Knowledge','Understanding','Application','HOTS'].includes(cognitive))errors.push(`Row ${excelRow}: Cognitive_Level must be Knowledge, Understanding, Application or HOTS.`);
     if(difficulty&&!['Easy','Medium','Hard'].includes(difficulty))errors.push(`Row ${excelRow}: Difficulty must be Easy, Medium or Hard.`);
     if(Number.isInteger(page)&&page>0){
       mockPdfMeta[page]={page,part,topic,marks,cognitiveLevel:cognitive||null,difficulty:difficulty||null,explanation:explanation||null,correctAnswer:correct};
       mockAnswerKey[page]=correct;
     }
   });
   if(errors.length)throw new Error(errors.slice(0,20).join(' | ')+(errors.length>20?` | … ${errors.length-20} more error(s)`:''));
   document.getElementById('mockPdfPreview').innerHTML=message(`Loaded ${Object.keys(mockPdfMeta).length} MAT metadata row(s): answer key + Part + Topic + Marks. Cognitive Level, Difficulty and Explanation are optional.`,true);
 }catch(err){mockPdfMeta={};mockAnswerKey={};document.getElementById('mockPdfPreview').innerHTML=message('Could not read MAT Metadata Excel: '+err.message)}};r.readAsArrayBuffer(file)
}
async function getMockPdfJs(){const mod=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');mod.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';return mod}
async function readMockQuestionPdf(ev){const file=ev.target.files?.[0];if(!file)return;const box=document.getElementById('mockPdfPreview');box.innerHTML=message('Reading PDF pages and preparing cropped previews…',true);try{const part=document.getElementById('mockPdfPart')?.value;const plan=mockPlanByPart[part];if(!plan)throw new Error('Choose a valid MAT or Arithmetic part.');const buf=await file.arrayBuffer(),pdfjs=await getMockPdfJs(),pdf=await pdfjs.getDocument({data:buf}).promise;mockPdfRows=[];for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),base=page.getViewport({scale:1}),scale=Math.min(2.2,Math.max(1.4,1600/base.width)),vp=page.getViewport({scale});const c=document.createElement('canvas'),ctx=c.getContext('2d',{alpha:false});c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:ctx,viewport:vp}).promise;const cropped=cropWhiteMargins(c);mockPdfRows.push({page:p,image_data:cropped.toDataURL('image/jpeg',0.9)});}box.innerHTML=message(`Prepared ${mockPdfRows.length} cropped question page(s) for ${plan.label}. ${Object.keys(mockAnswerKey).length} answer keys loaded.`,true)}catch(e){box.innerHTML=message('PDF processing failed: '+(e.message||e))}}
async function uploadMockImage(dataUrl,path){const blob=await (await fetch(dataUrl)).blob();const {error}=await sb.storage.from('mock-question-images').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;const {data}=sb.storage.from('mock-question-images').getPublicUrl(path);return data.publicUrl}
async function uploadMockFile(file,path){const {error}=await sb.storage.from('mock-question-images').upload(path,file,{upsert:false});if(error)throw error;const {data}=sb.storage.from('mock-question-images').getPublicUrl(path);return data.publicUrl}
function mockBankNorm(v){return String(v??'').trim().toLowerCase();}
function mockBankUnique(values){return [...new Set(values.map(v=>String(v??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));}
function mockBankDisplayLanguage(v){const x=String(v||'').toUpperCase();return x==='ASSAMESE'?'Assamese':x==='ENGLISH'?'English':x==='COMMON'?'Common (MAT)':(v||'—');}
function mockBankMediumKey(v){const x=String(v||'').toUpperCase();return x==='COMMON (MAT)'?'COMMON':x;}
function mockBankPartChoices(medium){
  const m=mockBankMediumKey(medium);
  if(m==='COMMON') return MOCK_PLAN.filter(x=>x.section==='MAT').map(x=>({value:x.part,label:x.label.replace(/^MAT\s*[—-]\s*/,'')}));
  return [
    {value:'ARITHMETIC',label:'Arithmetic'},
    {value:'EVS_MCQ',label:'EVS-MCQ'},
    {value:'EVS_PASSAGE',label:'ENS-Passage'},
    {value:'LANGUAGE_PASSAGE',label:'Language'}
  ];
}
function mockBankLanguageRows(medium){
  const m=mockBankMediumKey(medium);
  if(m==='COMMON') return mockBankCache.filter(x=>{const l=String(x.language||'').toUpperCase();return l==='COMMON'||!l||String(x.part_code||'').toUpperCase().startsWith('MAT_');});
  return mockBankCache.filter(x=>String(x.language||'').toUpperCase()===m);
}
function mockBankDynamicOptions(){
  const medium=mockBankMediumKey(mockBankFilters.medium);
  const base=medium?mockBankLanguageRows(medium):mockBankCache;
  const parts=mockBankPartChoices(medium).filter(p=>base.some(x=>String(x.part_code||'').toUpperCase()===p.value));
  const part=String(mockBankFilters.part||'').toUpperCase();
  const partRows=part?base.filter(x=>String(x.part_code||'').toUpperCase()===part):base;
  const topics=mockBankUnique(partRows.filter(x=>!['EVS_PASSAGE','LANGUAGE_PASSAGE'].includes(String(x.part_code||'').toUpperCase())).map(x=>x.topic));
  const passages=mockBankUnique(partRows.filter(x=>['EVS_PASSAGE','LANGUAGE_PASSAGE'].includes(String(x.part_code||'').toUpperCase())).map(x=>x.passage_title||x.passage_id));
  return {parts,topics,passages};
}
function mockBankFilteredRows(){
  const f=mockBankFilters; const q=mockBankNorm(f.search); const medium=mockBankMediumKey(f.medium); const part=String(f.part||'').toUpperCase();
  return mockBankCache.filter(x=>{
    const lang=String(x.language||'').toUpperCase(); const xp=String(x.part_code||'').toUpperCase();
    const topic=String(x.topic||'').trim(); const passage=String(x.passage_title||x.passage_id||'').trim();
    if(medium==='COMMON'){if(!(lang==='COMMON'||!lang||xp.startsWith('MAT_')))return false;} else if(medium){if(lang!==medium)return false;}
    if(part && xp!==part)return false;
    if(f.topic && topic!==f.topic)return false;
    if(f.passage && passage!==f.passage)return false;
    if(f.status==='active' && x.active===false)return false;
    if(f.status==='inactive' && x.active!==false)return false;
    if(q){const hay=[x.question_text,x.option_a,x.option_b,x.option_c,x.option_d,x.topic,x.passage_title,x.passage_text,x.passage_id,x.part_code,x.language].map(v=>String(v??'')).join(' ').toLowerCase();if(!hay.includes(q))return false;}
    return true;
  });
}
function applyMockBankFilters(){
  mockBankFilters={medium:document.getElementById('mbfMedium')?.value||'',part:document.getElementById('mbfPart')?.value||'',topic:document.getElementById('mbfTopic')?.value||'',passage:document.getElementById('mbfPassage')?.value||'',status:document.getElementById('mbfStatus')?.value||'active',search:document.getElementById('mbfSearch')?.value||''};
  renderMockBankManager();
}
function mockBankMediumChanged(v){
  mockBankFilters.medium=v||''; mockBankFilters.part=''; mockBankFilters.topic=''; mockBankFilters.passage=''; renderMockBankManager();
}
function mockBankPartChanged(v){
  mockBankFilters.part=v||''; mockBankFilters.topic=''; mockBankFilters.passage=''; renderMockBankManager();
}
function resetMockBankFilters(){mockBankFilters={medium:'',part:'',topic:'',passage:'',status:'active',search:''};renderMockBankManager();}
function renderMockBankManager(){
  const data=mockBankCache||[]; const rows=mockBankFilteredRows(); const counts={}; const groups={};
  data.forEach(x=>{if(x.active!==false){counts[x.part_code]=(counts[x.part_code]||0)+1;if(x.passage_id){const k=x.part_code+'::'+x.passage_id;groups[k]=(groups[k]||0)+1;}}});
  const medium=mockBankMediumKey(mockBankFilters.medium); const opts=mockBankDynamicOptions();
  const commonSelected=medium==='COMMON'; const languageSelected=medium==='ASSAMESE'||medium==='ENGLISH';
  const sel=(id,value,options,placeholder,onchange='')=>`<select id="${id}" ${onchange?`onchange="${onchange}"`:''}><option value="">${placeholder}</option>${options.map(v=>{const val=typeof v==='string'?v:v.value,label=typeof v==='string'?v:v.label;return `<option value="${esc(val)}" ${String(value)===String(val)?'selected':''}>${esc(label)}</option>`}).join('')}</select>`;
  render(`<div class="wrap">${header('Manage Mock Question Bank')}
    <div class="card">
      <div class="notice small"><b>Filter the question bank before viewing questions.</b> First select the <b>Medium</b>. The available Part choices then change automatically.</div>
      <div class="grid" style="margin-top:12px">
        <div><label>Medium</label><select id="mbfMedium" onchange="mockBankMediumChanged(this.value)"><option value="">Select Medium</option><option value="COMMON" ${medium==='COMMON'?'selected':''}>Common (MAT)</option><option value="ENGLISH" ${medium==='ENGLISH'?'selected':''}>English</option><option value="ASSAMESE" ${medium==='ASSAMESE'?'selected':''}>Assamese</option></select></div>
        <div><label>Part</label>${sel('mbfPart',mockBankFilters.part,opts.parts,'Select Part','mockBankPartChanged(this.value)')}</div>
        <div style="${commonSelected?'display:none':'display:block'}"><label>Topic</label>${sel('mbfTopic',mockBankFilters.topic,opts.topics,'All Topics')}</div>
        <div style="${commonSelected?'display:none':'display:block'}"><label>Passage</label>${sel('mbfPassage',mockBankFilters.passage,opts.passages,'All Passages')}</div>
        <div><label>Status</label><select id="mbfStatus"><option value="active" ${mockBankFilters.status==='active'?'selected':''}>Active Only</option><option value="" ${!mockBankFilters.status?'selected':''}>All Questions</option><option value="inactive" ${mockBankFilters.status==='inactive'?'selected':''}>Inactive Only</option></select></div>
        <div><label>Search</label><input id="mbfSearch" value="${esc(mockBankFilters.search)}" placeholder="Question, option, topic, passage..."></div>
      </div>
      ${!medium?'<div class="notice small" style="margin-top:12px">Please select <b>Common (MAT)</b>, <b>English</b> or <b>Assamese</b> to view the corresponding question bank.</div>':''}
      ${languageSelected?'<div class="small muted" style="margin-top:8px">English/Assamese mode: Arithmetic, EVS-MCQ, ENS-Passage and Language are available. Passage choices are restricted to the selected language.</div>':''}
      ${commonSelected?'<div class="small muted" style="margin-top:8px">Common (MAT) mode: Topic and Passage filters are hidden. Select one of the five MAT parts.</div>':''}
      <div class="actions" style="margin-top:12px"><button onclick="applyMockBankFilters()">🔎 Apply Filters</button><button class="secondary" onclick="resetMockBankFilters()">↺ Reset</button><span class="small muted" style="align-self:center">Showing <b>${rows.length}</b> of <b>${data.length}</b> question(s)</span></div>
    </div>
    <div class="card">
      <div class="small muted" style="margin-bottom:10px">Edit any question, change its answer, update the passage, add/replace an image, or deactivate/delete it. Deactivated questions are not used when generating a new test.</div>
      <div style="overflow:auto"><table><thead><tr><th>#</th><th>Medium</th><th>Part</th><th>Topic</th><th>Question</th><th>Passage</th><th>Preview</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((q,i)=>{const rawQ=String(q.question_text||'').trim();const shownQ=rawQ||'[PDF/image question]';const optionRows=['A','B','C','D'].map(o=>{const v=q['option_'+o.toLowerCase()];return v!=null&&String(v).trim()?`<div class="mock-bank-option"><span class="mock-bank-option-label">${o}.</span>${jnvstMathPreview(String(v))}</div>`:''}).filter(Boolean).join('');return `<tr><td>${i+1}</td><td>${esc(mockBankDisplayLanguage(q.language))}</td><td>${esc(mockPartLabel(q.part_code))}</td><td>${esc(q.topic||'—')}</td><td style="min-width:300px;max-width:480px"><div class="mock-bank-question-text">${jnvstMathPreview(shownQ.slice(0,300))}</div>${optionRows?`<div class="mock-bank-options">${optionRows}</div>`:''}</td><td>${esc((q.passage_title||q.passage_id||'').slice(0,40)||'—')}</td><td class="mock-question-preview-cell">${q.image_url?`<img class="mock-question-thumb" src="${esc(q.image_url)}" alt="Question ${i+1} preview" loading="lazy" onclick="openMockQuestionImage('${esc(q.image_url)}','Question ${i+1}')" title="Click to enlarge">`:'<span class="mock-question-preview-empty">No image</span>'}</td><td>${q.active===false?'Inactive':'Active'}</td><td><div class="actions"><button onclick="editMockQuestion('${q.id}')">Edit</button><button class="secondary" onclick="toggleMockQuestion('${q.id}',${q.active===false?'true':'false'})">${q.active===false?'Activate':'Deactivate'}</button><button class="danger" onclick="deleteMockQuestion('${q.id}')">Delete</button></div></td></tr>`}).join('')||'<tr><td colspan="9">No questions match the selected filters.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card" style="background:#f8fafc"><h3>Availability & Set Validation</h3>${MOCK_PLAN.map(x=>{const c=counts[x.part]||0;const complete=x.unit==='passage'?Object.entries(groups).filter(([k,g])=>k.startsWith(x.part+'::')&&g===(x.passageCount||x.count)).length:Math.floor(c/x.count);const remainder=x.unit==='passage'?c-(complete*(x.passageCount||x.count)):c%x.count;return `<div class="small" style="padding:6px 0"><b>${esc(x.label)}</b>: ${c} active · ${complete} complete set(s) of ${x.count}${remainder?' · '+remainder+' question(s) not in a complete set':' · ready'}</div>`}).join('')}</div>
    <div class="actions"><button onclick="mockBulkUpload()">Bulk Upload</button><button onclick="generateMockTestPage()">Generate Test</button><button class="secondary" onclick="mockTestManagement()">← Back</button></div>
  </div>`);
  // The table is rendered dynamically. Wait for MathJax to load/initialize, then typeset all question and option math.
  const table=document.querySelector('.mock-bank-question-text')?.closest('.card');
  if(table)jnvstTypesetWhenReady([table]);
}
function openMockQuestionImage(url,title){
  if(!url)return;
  const old=document.getElementById('mockQuestionImageLightbox'); if(old)old.remove();
  const box=document.createElement('div');
  box.id='mockQuestionImageLightbox';
  box.className='mock-image-lightbox';
  box.setAttribute('role','dialog');
  box.setAttribute('aria-label',title||'Question image preview');
  box.innerHTML=`<div class="mock-image-title">${esc(title||'Question image preview')}</div><button type="button" class="mock-image-close" aria-label="Close preview">×</button><img src="${esc(url)}" alt="${esc(title||'Question image preview')}">`;
  const close=()=>box.remove();
  box.addEventListener('click',e=>{if(e.target===box||e.target.classList.contains('mock-image-close'))close();});
  document.addEventListener('keydown',function handler(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',handler);}}, {once:true});
  document.body.appendChild(box);
}
async function mockBankSummary(){
  const {data,error}=await sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).order('created_at',{ascending:false});
  if(error)return notify(error.message); mockBankCache=(data||[]).map(x=>{const p=String(x.part_code||'').toUpperCase().replace(/[-\s]+/g,'_');const sec=String(x.section_code||'').toUpperCase();if(sec==='EVS'&&p==='EVS'&&!x.passage_id&&String(x.question_type||'').toUpperCase()!=='EVS-PASSAGE')return {...x,part_code:'EVS_MCQ'};return x;}); mockBankFilters={medium:'',part:'',topic:'',passage:'',status:'active',search:''}; renderMockBankManager();
}
function qpNorm(v){return String(v??'').trim()}
function qpSubject(){return qpNorm(document.getElementById('qpSubject')?.value||qpState.subject||'MAT').toUpperCase()}
function qpIsCommonMode(){return qpSubject()==='MAT'}
function qpCurrentLanguage(){return qpSubject()==='MAT'?'COMMON':(document.getElementById('qpLanguage')?.value||qpState.language||'ASSAMESE').toUpperCase()}
function qpSubjectId(){const name=qpSubject();return (jnvstSubjects||[]).find(s=>String(s.name||'').trim().toUpperCase()===name)?.id||''}
function qpQuestionSubjectMatches(q){
  const subject=qpSubject();
  const section=String(q?.section_code||'').trim().toUpperCase();
  const part=String(q?.part_code||'').trim().toUpperCase().replace(/[-\s]+/g,'_');
  const sid=qpSubjectId();
  const qsid=String(q?.subject_id||'').trim();
  // A question is eligible only when its subject metadata does not conflict
  // AND its JNVST part belongs to the selected subject. This prevents a bad
  // section_code or subject_id from leaking Arithmetic into EVS (or vice versa).
  if(sid && qsid && String(qsid)!==String(sid)) return false;
  if(subject==='EVS') return ['EVS','EVS_MCQ','EVS_PASSAGE'].includes(part) || (!part && section==='EVS');
  if(subject==='ARITHMETIC') return part==='ARITHMETIC' || (!part && section==='ARITHMETIC');
  if(subject==='MAT') return part.startsWith('MAT_') || (!part && section==='MAT');
  if(subject==='LANGUAGE') return part.startsWith('LANGUAGE') || (!part && section==='LANGUAGE');
  return true;
}
function qpIsEVSMCQ(q){
  if(qpIsPassage(q)||!qpLangMatches(q)||!qpQuestionSubjectMatches(q)) return false;
  const part=String(q?.part_code||'').trim().toUpperCase().replace(/[-\s]+/g,'_');
  return part==='EVS_MCQ'||part==='EVS';
}
function qpIsEVSPassageQuestion(q){
  if(!qpIsPassage(q)||!qpLangMatches(q)||!qpQuestionSubjectMatches(q)) return false;
  return String(q?.part_code||'').trim().toUpperCase().replace(/[-\s]+/g,'_')==='EVS_PASSAGE';
}
function qpLanguageValue(q){const v=String(q?.language||'').trim().toUpperCase();if(!v)return '';if(['ASSAMESE','AS','ASM','ASSAM'].includes(v))return 'ASSAMESE';if(['ENGLISH','EN','ENG'].includes(v))return 'ENGLISH';if(['COMMON','MAT','BOTH'].includes(v))return 'COMMON';return v}
function qpCommonPartRows(){return QP_COMMON_PARTS.map(x=>({...x,questions:qpState.bank.filter(q=>String(q.part_code||'').toUpperCase()===x.part)}))}
function qpCommonTotal(){return QP_COMMON_PARTS.reduce((n,x)=>n+Math.max(0,Number(qpState.commonCounts[x.part]||0)),0)}
function qpMandatoryIdsForPart(part){return [...qpState.selected].filter(id=>String(qpState.bank.find(q=>q.id===id)?.part_code||'').toUpperCase()===part)}
function qpValidateCommonCounts(showAlert=false){
  const rows=qpCommonPartRows();
  const counts=rows.map(x=>Number(qpState.commonCounts[x.part]||0));
  const badPart=counts.some(n=>n<4||n%4!==0);
  const total=counts.reduce((a,b)=>a+b,0);
  const badTotal=total<20||total%20!==0;
  const shortages=rows.filter((x,i)=>counts[i]>x.questions.length).map(x=>`${x.heading}: requested ${qpState.commonCounts[x.part]||0}, available ${x.questions.length}`);
  const mandatoryShort=rows.filter((x,i)=>qpMandatoryIdsForPart(x.part).length>counts[i]).map(x=>`${x.heading}: mandatory questions (${qpMandatoryIdsForPart(x.part).length}) exceed requested (${qpState.commonCounts[x.part]||0}).`);
  if(showAlert && (badPart||badTotal||shortages.length||mandatoryShort.length)){
    const msgs=[];
    if(badPart)msgs.push('Each MAT part must contain 4, 8, 12, 16… questions.');
    if(badTotal)msgs.push(`Total MAT questions must be 20, 40, 60… (current total: ${total}).`);
    if(shortages.length)msgs.push(shortages.join('\n'));
    if(mandatoryShort.length)msgs.push(mandatoryShort.join('\n'));
    notify(msgs.join('\n\n'));return false;
  }
  return !badPart&&!badTotal&&!shortages.length&&!mandatoryShort.length;
}
function qpRenderCommonPanel(){
  const box=document.getElementById('qpCommonPanel');if(!box)return;
  const rows=qpCommonPartRows();
  box.innerHTML=`<div class="card qpc-common-panel" style="border:2px solid #7c3aed;background:#faf5ff">
    <h2>1. Common / MAT Question Paper</h2>
    <p class="muted">For each MAT part, choose the required number of questions. You can mark specific questions as <b>Mandatory</b>; all remaining questions will be selected randomly.</p>
    <div class="qpc-part-grid">${rows.map(x=>{const current=Number(qpState.commonCounts[x.part]||4);return `<div class="qpc-part-card">
      <div class="qpc-part-heading"><b>${esc(x.heading)}</b></div>
      <div class="small muted qpc-part-meta">Available: ${x.questions.length} <span>•</span> Mandatory: <span id="qpc_mand_${x.part}">${qpMandatoryIdsForPart(x.part).length}</span></div>
      <label class="qpc-count-label">Questions</label>
      <input class="qpc-count-input" id="qpc_${x.part}" type="number" min="4" step="4" value="${current}" oninput="qpCommonCountChanged('${x.part}',this.value)">
      <button type="button" class="qpc-mandatory-btn" onclick="qpToggleCommonPart('${x.part}')">☑ Select Mandatory Questions</button>
      <div id="qpc_questions_${x.part}" class="qpc-mandatory-list" style="display:none"></div>
      <div id="qpc_msg_${x.part}" class="small muted qpc-part-message"></div>
    </div>`}).join('')}</div>
    <div id="qpCommonTotal" class="notice small" style="margin-top:14px"></div>
    <div class="actions" style="margin-top:12px"><button class="secondary" onclick="qpCommonSelectMinimum()">Set 4 Each</button><button class="secondary" onclick="qpCommonSetMaximumAvailable()">Use Maximum Valid Count</button></div>
  </div>`;
  rows.forEach(x=>qpRenderCommonQuestions(x.part));
  qpCommonRefreshSummary();
}
function qpCommonCountChanged(part,value){qpState.commonCounts[part]=Math.max(0,Number(value)||0);qpState.lastRows=null;qpState.lastSignature='';qpCommonRefreshSummary();}
function qpCommonSelectMinimum(){QP_COMMON_PARTS.forEach(x=>qpState.commonCounts[x.part]=4);qpState.lastRows=null;qpState.lastSignature='';qpRenderCommonPanel();}
function qpCommonSetMaximumAvailable(){QP_COMMON_PARTS.forEach(x=>{const n=qpState.bank.filter(q=>String(q.part_code||'').toUpperCase()===x.part).length;qpState.commonCounts[x.part]=Math.floor(n/4)*4;});if(qpCommonTotal()<20){QP_COMMON_PARTS.forEach(x=>qpState.commonCounts[x.part]=4)}qpState.lastRows=null;qpState.lastSignature='';qpRenderCommonPanel();}
function qpToggleCommonPart(part){const el=document.getElementById(`qpc_questions_${part}`);if(!el)return;el.style.display=el.style.display==='none'?'block':'none';if(el.style.display==='block')qpRenderCommonQuestions(part);}
function teacherQuestionPreview(q, options={}){
  const image=q?.image_url?String(q.image_url):'';
  const raw=q?.question_text==null?'':String(q.question_text).trim();
  const text=(raw && raw.toUpperCase()!=='[IMAGE QUESTION]' && raw.toUpperCase()!=='[PDF/IMAGE QUESTION]' && raw.toUpperCase()!=='[IMAGE QUESTION — PREVIEW UNAVAILABLE]')?raw:'';
  const imageHtml=image?`<img src="${esc(image)}" alt="Question preview" loading="lazy" onclick="event.preventDefault();event.stopPropagation();openMockQuestionImage('${esc(image)}','Question preview')" style="display:block;width:${options.width||'150px'};max-height:${options.height||'110px'};object-fit:contain;border:1px solid #cbd5e1;border-radius:6px;padding:3px;background:#fff;cursor:zoom-in;margin:${text?'0 0 7px 0':'0'}">`:'';
  const textHtml=text?`<div style="white-space:pre-wrap;line-height:1.45">${jnvstMathPreview(text)}</div>`:'';
  return imageHtml+textHtml;
}
function qpRenderCommonQuestions(part){
  const wrap=document.getElementById(`qpc_questions_${part}`);if(!wrap)return;
  const rows=qpState.bank.filter(q=>String(q.part_code||'').toUpperCase()===part);
  wrap.innerHTML=rows.length?rows.map(q=>`<label class="qpc-question-row">
    <input type="checkbox" ${qpState.selected.has(q.id)?'checked':''} onchange="qpMandatoryChanged('${q.id}',this.checked)">
    <span class="qpc-question-preview">${teacherQuestionPreview(q,{width:'170px',height:'125px'})}</span>
  </label>`).join(''):'<div class="muted" style="padding:12px">No questions available.</div>';
}
function qpCommonRefreshSummary(){
  const total=qpCommonTotal();const valid=qpValidateCommonCounts(false);const el=document.getElementById('qpCommonTotal');
  if(el)el.className=valid?'success':'notice';
  if(el)el.innerHTML=`<b>Total MAT questions: ${total}</b> ${valid?'✓ Valid':'— Required: 20, 40, 60… total and 4, 8, 12… per part.'}`;
  QP_COMMON_PARTS.forEach(x=>{const m=document.getElementById(`qpc_msg_${x.part}`);if(m){const n=Number(qpState.commonCounts[x.part]||0),avail=qpState.bank.filter(q=>String(q.part_code||'').toUpperCase()===x.part).length,mand=qpMandatoryIdsForPart(x.part).length;m.textContent=n>avail?`Not enough questions. Available: ${avail}`:(mand>n?`Too many mandatory questions (${mand}) for ${n}.`:(n>=4&&n%4===0?'✓ Valid multiple of 4':'Must be 4, 8, 12…'));}const c=document.getElementById(`qpc_mand_${x.part}`);if(c)c.textContent=qpMandatoryIdsForPart(x.part).length;});
}
function qpCommonPrepareRows(){
  if(!qpValidateCommonCounts(true))throw new Error('Invalid Common / MAT question distribution.');
  const order=document.getElementById('qpOrder')?.value||'random';let number=1;const rows=[];
  for(const part of QP_COMMON_PARTS){
    const pool=qpState.bank.filter(q=>String(q.part_code||'').toUpperCase()===part.part);
    const mandatoryIds=new Set(qpMandatoryIdsForPart(part.part));
    const mandatory=pool.filter(q=>mandatoryIds.has(q.id));
    let randomPool=pool.filter(q=>!mandatoryIds.has(q.id));
    if(order==='random')randomPool=qpShuffle(randomPool);else randomPool.sort((a,b)=>(Number(a.question_order)||0)-(Number(b.question_order)||0));
    const remaining=Number(qpState.commonCounts[part.part]||0)-mandatory.length;
    const chosen=[...mandatory,...randomPool.slice(0,remaining)];
    const final=order==='random'?qpShuffle(chosen):chosen.sort((a,b)=>(Number(a.question_order)||0)-(Number(b.question_order)||0));
    final.forEach(q=>rows.push({...q,_number:number++,_partHeading:part.heading,_commonPart:part.part,_selectionType:mandatoryIds.has(q.id)?'MANDATORY':'RANDOM'}));
  }
  return rows;
}
function qpTopicLabel(q){return qpNorm(q.topic)||mockPartLabel(q.part_code)||q.part_code}
function qpLangMatches(q){const want=qpCurrentLanguage();const lang=qpLanguageValue(q);return want==='COMMON'?lang==='COMMON'||!lang:lang===want;}
function qpSelectedLessonIds(){return qpState.selectedLessons||new Set()}
function qpAvailableLessons(){const sid=qpSubjectId();return (jnvstSubjectLessons||[]).filter(l=>!sid||String(l.subject_id)===String(sid)).sort((a,b)=>String(a.lesson_code||'').localeCompare(String(b.lesson_code||''),undefined,{numeric:true,sensitivity:'base'}));}
function qpLessonDescendants(selected){const all=qpAvailableLessons();const out=new Set([...selected].map(String));let changed=true;while(changed){changed=false;for(const l of all){if(l.parent_lesson_id&&out.has(String(l.parent_lesson_id))&&!out.has(String(l.id))){out.add(String(l.id));changed=true;}}}return out;}
function qpQuestionMatchesLesson(q){const selected=qpSelectedLessonIds();if(!selected.size)return true;return qpLessonDescendants(selected).has(String(q.lesson_id||''));}
function qpLessonName(l){return `${l.lesson_code?l.lesson_code+' ':''}${l.lesson_name||''}`.trim()}
function qpLessonIndent(l){let n=0,cur=l,parentMap=new Map(qpAvailableLessons().map(x=>[String(x.id),x]));while(cur?.parent_lesson_id&&parentMap.has(String(cur.parent_lesson_id))&&n<8){n++;cur=parentMap.get(String(cur.parent_lesson_id));}return n;}
function qpAvailableTopics(){const m=new Map();for(const q of qpState.bank){if(qpIsPassage(q)||!qpLangMatches(q)||!qpQuestionSubjectMatches(q)||!qpQuestionMatchesLesson(q))continue;const key=qpTopicLabel(q);if(!m.has(key))m.set(key,0);m.set(key,m.get(key)+1)}return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0]));}
function qpRenderTopicRows(){
  const wrap=document.getElementById('qpTopicList');if(!wrap)return;
  const search=qpNorm(document.getElementById('qpTopicSearch')?.value).toLowerCase();
  const topics=qpAvailableTopics().filter(([t])=>!search||t.toLowerCase().includes(search));
  const limits=qpState.topicLimits||{};
  wrap.innerHTML=topics.length?topics.map(([topic,count])=>{
    const lim=limits[topic]||{};
    const min=lim.min==null?'':lim.min, max=lim.max==null?'':lim.max;
    return `<div class="qp-topic-row"><label class="qp-topic-select"><input type="checkbox" value="${esc(topic)}" ${qpState.selectedTopics?.has(topic)?'checked':''} onchange="qpTopicChanged(this)"><span><b>${esc(topic)}</b></span></label><span class="muted small qp-topic-count">${count}</span><input class="qp-topic-limit" type="number" min="0" value="${min}" placeholder="—" aria-label="Minimum questions from ${esc(topic)}" onchange="qpTopicLimitChanged('${esc(topic)}','min',this.value)"><input class="qp-topic-limit" type="number" min="0" value="${max}" placeholder="—" aria-label="Maximum questions from ${esc(topic)}" onchange="qpTopicLimitChanged('${esc(topic)}','max',this.value)"></div>`;
  }).join(''):'<div class="muted" style="padding:10px">No topics found for the selected filters.</div>';
}
function qpTopicLimitChanged(topic,type,value){
  qpState.topicLimits=qpState.topicLimits||{};
  const n=String(value).trim()===''?null:Math.max(0,Math.floor(Number(value)||0));
  if(!qpState.topicLimits[topic])qpState.topicLimits[topic]={};
  if(n===null)delete qpState.topicLimits[topic][type];else qpState.topicLimits[topic][type]=n;
  const lim=qpState.topicLimits[topic];
  if(lim.min==null&&lim.max==null)delete qpState.topicLimits[topic];
  if(lim.min!=null&&lim.max!=null&&lim.min>lim.max){notify(`Minimum questions for "${topic}" cannot be greater than its maximum.`);if(type==='min')lim.min=lim.max;else lim.max=lim.min;}
  qpState.lastRows=null;qpState.lastSignature='';qpRefreshQuestionPool();qpRefreshSubjectSummary();
}
function qpRenderLessonFilter(){const wrap=document.getElementById('qpLessonList');if(!wrap)return;const search=qpNorm(document.getElementById('qpLessonSearch')?.value).toLowerCase();const lessons=qpAvailableLessons().filter(l=>!search||qpLessonName(l).toLowerCase().includes(search));const selected=qpState.selectedLessons||new Set();wrap.innerHTML=lessons.length?lessons.map(l=>{const depth=qpLessonIndent(l);const hasChildren=lessons.some(x=>String(x.parent_lesson_id||'')===String(l.id));return `<label class="qp-filter-row" style="padding-left:${10+depth*22}px"><input type="checkbox" value="${esc(l.id)}" ${selected.has(String(l.id))?'checked':''} onchange="qpLessonCheckboxChanged(this)"><span class="qp-filter-main"><span>${hasChildren?'📚':'↳'}</span><span><b>${esc(qpLessonName(l))}</b><span class="muted small">${hasChildren?' Chapter':' Sub-chapter'}</span></span></span></label>`}).join(''):'<div class="muted">No chapters/sub-chapters found.</div>';}
function qpLessonCheckboxChanged(cb){qpState.selectedLessons=qpState.selectedLessons||new Set();cb.checked?qpState.selectedLessons.add(String(cb.value)):qpState.selectedLessons.delete(String(cb.value));qpState.selectedTopics=new Set();qpState.topicLimits={};qpState.selected.clear();qpState.lastRows=null;qpState.lastSignature='';qpRenderLessonFilter();qpRenderTopicRows();qpRefreshQuestionPool();qpRefreshSubjectSummary();}
function qpLessonSearchChanged(){qpRenderLessonFilter();}
function qpTopicChanged(cb){qpState.selectedTopics=qpState.selectedTopics||new Set();cb.checked?qpState.selectedTopics.add(cb.value):qpState.selectedTopics.delete(cb.value);qpState.lastRows=null;qpState.lastSignature='';qpRefreshQuestionPool();qpRefreshSubjectSummary();}
function qpLessonChanged(){qpState.selectedLessons=new Set();qpState.selectedTopics=new Set();qpState.topicLimits={};qpState.selected.clear();qpState.lastRows=null;qpState.lastSignature='';qpRenderLessonFilter();qpRenderTopicRows();qpRefreshQuestionPool();qpRefreshSubjectSummary();}
function qpRefreshQuestionPool(){
  const chosen=qpState.selectedTopics||new Set();
  const pool=qpState.bank.filter(q=>{
    if(qpIsPassage(q)||!qpLangMatches(q)||!qpQuestionSubjectMatches(q)||!qpQuestionMatchesLesson(q)) return false;
    return chosen.size?chosen.has(qpTopicLabel(q)):true;
  });
  const search=qpNorm(document.getElementById('qpQuestionSearch')?.value).toLowerCase();const filtered=pool.filter(q=>!search||[q.question_text,q.part_code,qpTopicLabel(q)].some(v=>qpNorm(v).toLowerCase().includes(search)));
  const nEl=document.getElementById('qpQuestionCount');if(nEl){const max=Math.max(1,pool.length);nEl.max=max;}
  const allGroups=new Set(pool.map(q=>qpNorm(q.variation_group).toLowerCase()).filter(Boolean));const mandatoryCount=[...qpState.selected].filter(id=>pool.some(q=>q.id===id)).length;const usedMandatoryGroups=new Set(pool.filter(q=>qpState.selected.has(q.id)).map(q=>qpNorm(q.variation_group).toLowerCase()).filter(Boolean));const seenRandomGroups=new Set(usedMandatoryGroups);let uniqueAvailable=0;pool.filter(q=>!qpState.selected.has(q.id)).forEach(q=>{const g=qpNorm(q.variation_group).toLowerCase();if(g){if(seenRandomGroups.has(g))return;seenRandomGroups.add(g);}uniqueAvailable++;});const uniqueAfterMandatory=Math.max(0,mandatoryCount+uniqueAvailable);const a=document.getElementById('qpAvailability');if(a)a.innerHTML=`Total matching questions: <b>${pool.length}</b> · Unique Variation Groups: <b>${allGroups.size}</b> · Mandatory: <b>${mandatoryCount}</b> · Maximum generatable without repeating a variation: <b>${uniqueAfterMandatory}</b>`;
  qpRenderTopicRows();
  qpRenderQuestionRows(filtered);
}
function qpRenderQuestionRows(rows){const wrap=document.getElementById('qpQuestionList');if(!wrap)return;const chosen=qpState.selectedTopics||new Set();const scoped=(chosen.size?rows.filter(q=>chosen.has(qpTopicLabel(q))):rows);wrap.innerHTML=scoped.length?scoped.slice(0,300).map(q=>`<label class="assignment" style="display:flex;gap:10px;align-items:flex-start;margin:5px 0;padding:7px;border:1px solid #e2e8f0;border-radius:8px"><input type="checkbox" style="width:auto;margin-top:4px" ${qpState.selected.has(q.id)?'checked':''} onchange="qpMandatoryChanged('${q.id}',this.checked)"><span style="flex:1;min-width:0">${q.image_url?`<img src="${esc(q.image_url)}" alt="Question preview" loading="lazy" onclick="event.preventDefault();openMockQuestionImage('${esc(q.image_url)}','Question preview')" style="width:110px;height:75px;object-fit:contain;border:1px solid #cbd5e1;border-radius:6px;padding:2px;float:right;margin-left:8px;cursor:zoom-in;background:#fff">`:''}${teacherQuestionPreview(q,{width:'110px',height:'75px'})}<span class="muted small"> — ${esc(qpTopicLabel(q))} · ${esc(q.part_code)}</span></span></label>`).join(''):'<div class="muted">No questions found for the selected topic.</div>';}
function qpMandatoryChanged(id,checked){checked?qpState.selected.add(id):qpState.selected.delete(id);qpState.lastRows=null;qpState.lastSignature='';qpRefreshSubjectSummary();if(qpIsCommonMode())QP_COMMON_PARTS.forEach(x=>qpRenderCommonQuestions(x.part));else qpRefreshQuestionPool();}
function qpSelectVisible(){const chosen=qpState.selectedTopics||new Set();const pool=qpState.bank.filter(q=>!qpIsPassage(q)&&qpLangMatches(q)&&qpQuestionSubjectMatches(q)&&qpQuestionMatchesLesson(q)&&(chosen.size?chosen.has(qpTopicLabel(q)):true));const search=qpNorm(document.getElementById('qpQuestionSearch')?.value).toLowerCase();pool.filter(q=>!search||[q.question_text,q.part_code,qpTopicLabel(q)].some(v=>qpNorm(v).toLowerCase().includes(search))).slice(0,500).forEach(q=>qpState.selected.add(q.id));qpState.lastRows=null;qpState.lastSignature='';qpRefreshQuestionPool();qpRefreshSubjectSummary();}
function qpClearQuestions(){qpState.selected.clear();qpState.lastRows=null;qpState.lastSignature='';qpRefreshQuestionPool();qpRefreshSubjectSummary();}
function qpPassageChanged(id,checked){checked?qpState.selectedPassages.add(id):qpState.selectedPassages.delete(id);qpState.lastRows=null;qpState.lastSignature='';qpRefreshSubjectSummary();}
function qpToggleMandatoryPassage(pid,checked){const g=qpPassageGroups(qpState.bank).find(x=>x.id===pid);if(!g)return;g.questions.forEach(q=>checked?qpState.selected.add(q.id):qpState.selected.delete(q.id));qpState.lastRows=null;qpState.lastSignature='';qpRenderPassages();qpRefreshSubjectSummary();}
function qpSelectRandomPassages(){const part=document.getElementById('qpPassagePart')?.value||'ALL';const groups=qpPassageGroups(qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&(part==='ALL'||q.part_code===part))).filter(g=>g.questions.length===5);const n=Math.max(0,Math.min(groups.length,Number(document.getElementById('qpPassageCount')?.value)||0));const shuffled=qpShuffle(groups);shuffled.slice(0,n).forEach(g=>g.questions.forEach(q=>qpState.selected.add(q.id)));qpState.lastRows=null;qpState.lastSignature='';qpRenderPassages();qpRefreshSubjectSummary();}
function qpSelectVisiblePassages(){const search=qpNorm(document.getElementById('qpPassageSearch')?.value).toLowerCase();const part=document.getElementById('qpPassagePart')?.value||'ALL';const groups=qpPassageGroups(qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&(part==='ALL'||q.part_code===part))).filter(g=>g.questions.length===5).filter(g=>!search||[g.id,g.title,g.text].some(v=>qpNorm(v).toLowerCase().includes(search)));groups.forEach(g=>g.questions.forEach(q=>qpState.selected.add(q.id)));qpState.lastRows=null;qpState.lastSignature='';qpRenderPassages();qpRefreshSubjectSummary();}
function qpSetMode(mode){qpState.mode=mode;qpRenderGeneratorMode();}
function qpRenderSubjectSummary(){const el=document.getElementById('qpSubjectSummary');if(!el)return;const subject=qpSubject();const lang=qpCurrentLanguage();if(subject==='MAT'){el.textContent=`MAT: ${qpCommonTotal()} questions configured · ${qpState.selected.size} mandatory`;}else if(subject==='ARITHMETIC'){const n=Number(document.getElementById('qpQuestionCount')?.value||0);const limited=Object.keys(qpState.topicLimits||{}).length;el.textContent=`Arithmetic: ${n} questions · ${qpState.selected.size} mandatory · ${Math.max(0,n-qpState.selected.size)} random · ${limited} topic limit(s)`;}else if(subject==='EVS'){const sets=Number(document.getElementById('qpEvsSetCount')?.value||1);const direct=15*sets;const p=sets;const mandDirect=[...qpState.selected].filter(id=>{const q=qpState.bank.find(x=>x.id===id);return q&&!qpIsPassage(q)&&qpLangMatches(q)}).length;const mandPass=[...new Set([...qpState.selected].map(id=>qpState.bank.find(x=>x.id===id)?.passage_id).filter(Boolean))].length;el.textContent=`EVS ${lang}: ${sets} set(s) = ${direct} MCQs + ${p} passage(s) + ${p*5} passage questions · Mandatory MCQs: ${mandDirect} · Mandatory passages: ${mandPass}`;}else{const sets=Number(document.getElementById('qpLanguageSetCount')?.value||1);const mandPass=[...new Set([...qpState.selected].map(id=>qpState.bank.find(x=>x.id===id)?.passage_id).filter(Boolean))].length;el.textContent=`Language ${lang}: ${sets} passage set(s) = ${sets*5} questions · Mandatory passages: ${mandPass}`;}}
function qpRefreshSubjectSummary(){qpRenderSubjectSummary();if(qpSubject()==='MAT')qpCommonRefreshSummary();}
function qpRenderGeneratorMode(){
  const subject=qpSubject();qpState.subject=subject;qpState.language=qpCurrentLanguage();qpState.mode=subject==='MAT'?'mat':(subject==='ARITHMETIC'?'questions':'passages');
  const common=document.getElementById('qpCommonPanel'),questions=document.getElementById('qpQuestionsPanel'),passages=document.getElementById('qpPassagesPanel'),special=document.getElementById('qpSpecialPanel');
  if(common)common.style.display=subject==='MAT'?'block':'none';
  if(questions)questions.style.display=subject==='ARITHMETIC'?'block':'none';
  if(passages)passages.style.display=(subject==='EVS'||subject==='LANGUAGE')?'block':'none';
  if(special)special.innerHTML='';
  if(subject==='MAT'){qpRenderCommonPanel();}
  else if(subject==='ARITHMETIC'){qpRenderArithmeticPanel();}
  else if(subject==='EVS'){qpRenderEVSPanel();}
  else if(subject==='LANGUAGE'){qpRenderLanguagePanel();}
  qpRefreshSubjectSummary();
}
function qpRenderArithmeticPanel(){
  const p=document.getElementById('qpQuestionsPanel');if(!p)return;
  p.innerHTML=`<h2>1. Arithmetic</h2><p class="muted">Generate any number of questions. Select one or more chapters/sub-chapters and topics to control the source. <b>Only one question from each Variation Group</b> will be used in a paper.</p><div class="grid"><div><label>Number of Questions</label><input id="qpQuestionCount" type="number" min="1" step="1" value="20" oninput="qpArithmeticCountChanged()"></div><div><label>Search Question</label><input id="qpQuestionSearch" placeholder="Search question / topic" oninput="qpRefreshQuestionPool()"></div></div><div class="qp-filter-card"><div class="qp-filter-head"><b>Chapters / Sub-chapters</b><input id="qpLessonSearch" placeholder="Search chapter / sub-chapter" oninput="qpLessonSearchChanged()"></div><div id="qpLessonList" class="qp-filter-list"></div><div class="small muted">Select one or more chapters/sub-chapters. Selecting a chapter automatically includes all of its sub-chapters.</div></div><div class="qp-filter-card"><div class="qp-filter-head"><b>Topics / Sub-topics</b><input id="qpTopicSearch" placeholder="Search topic" oninput="qpRenderTopicRows()"></div><div class="qp-topic-rule-head"><span>Topic</span><span>Available</span><span>Min</span><span>Max</span></div><div id="qpTopicList" class="qp-filter-list qp-topic-list"></div><div class="small muted">Select one or more topics to restrict generation. Set Min/Max to control how many questions are taken from each topic. Leave Min/Max blank for no topic-specific limit.</div></div><div id="qpAvailability" class="notice small" style="margin-top:10px"></div><div class="actions"><button class="secondary" onclick="qpSelectVisible()">☑ Mark Visible as Mandatory</button><button class="secondary" onclick="qpClearQuestions()">Clear Mandatory</button></div><div id="qpQuestionList" style="max-height:420px;overflow:auto;margin-top:10px"></div>`;
  qpRenderLessonFilter();qpRenderTopicRows();qpRefreshQuestionPool();
}
function qpArithmeticCountChanged(){let n=Number(document.getElementById('qpQuestionCount')?.value||20);if(!Number.isFinite(n)||n<1)n=1;n=Math.floor(n);document.getElementById('qpQuestionCount').value=n;qpState.lastRows=null;qpState.lastSignature='';qpRefreshQuestionPool();qpRefreshSubjectSummary();}
function qpRenderEVSPanel(){
  const p=document.getElementById('qpPassagesPanel');if(!p)return;
  p.innerHTML=`<h2>1. EVS Question Paper</h2><p class="muted">Each EVS set contains <b>15 MCQs + 1 complete passage with 5 questions</b>. Only questions classified as <b>EVS_MCQ / EVS_PASSAGE</b> and belonging to the selected JNVST EVS subject are eligible. Arithmetic questions are excluded even if their section code is incorrect.</p><div class="grid"><div><label>Number of EVS Sets</label><input id="qpEvsSetCount" type="number" min="1" value="1" oninput="qpEvsCountChanged()"></div><div><label>Search</label><input id="qpQuestionSearch" placeholder="Search question or passage" oninput="qpRefreshEVSPools()"></div></div><div id="qpEvsSummary" class="notice small" style="margin-top:10px"></div><h3>Mandatory EVS MCQs</h3><div id="qpEvsQuestionList" style="max-height:300px;overflow:auto"></div><div class="actions"><button class="secondary" onclick="qpSelectVisibleEVSMCQs()">☑ Mark Visible MCQs Mandatory</button><button class="secondary" onclick="qpClearQuestions()">Clear Mandatory</button></div><h3>Mandatory Passage Sets</h3><div id="qpPassageList" style="max-height:320px;overflow:auto"></div>`;
  qpRefreshEVSPools();
}
function qpEvsCountChanged(){let n=Math.max(1,Number(document.getElementById('qpEvsSetCount')?.value||1));document.getElementById('qpEvsSetCount').value=n;qpState.lastRows=null;qpState.lastSignature='';qpRefreshEVSPools();qpRefreshSubjectSummary();}
function qpSelectVisibleEVSMCQs(){const search=qpNorm(document.getElementById('qpQuestionSearch')?.value).toLowerCase();qpState.bank.filter(q=>qpIsEVSMCQ(q)).filter(q=>!search||[q.question_text,q.topic,q.part_code].some(v=>qpNorm(v).toLowerCase().includes(search))).slice(0,400).forEach(q=>qpState.selected.add(q.id));qpState.lastRows=null;qpState.lastSignature='';qpRefreshEVSPools();qpRefreshSubjectSummary();}
function qpRenderLanguagePanel(){
  const p=document.getElementById('qpPassagesPanel');if(!p)return;
  p.innerHTML=`<h2>1. Language Question Paper</h2><p class="muted">Each Language passage set contains <b>1 passage + exactly 5 linked questions</b>. Select mandatory questions; their complete passage set is automatically included. Remaining passage sets are random.</p><div class="grid"><div><label>Number of Passage Sets</label><input id="qpLanguageSetCount" type="number" min="1" value="4" oninput="qpLanguageCountChanged()"></div><div><label>Search Question / Passage</label><input id="qpQuestionSearch" placeholder="Search" oninput="qpRefreshLanguagePool()"></div></div><div id="qpLanguageSummary" class="notice small" style="margin-top:10px"></div><div class="actions"><button class="secondary" onclick="qpSelectVisibleLanguageQuestions()">☑ Mark Visible Questions Mandatory</button><button class="secondary" onclick="qpClearQuestions()">Clear Mandatory</button></div><h3>Language Questions</h3><div id="qpLanguageQuestionList" style="max-height:430px;overflow:auto"></div>`;
  qpRefreshLanguagePool();
}
function qpLanguageCountChanged(){let n=Math.max(1,Number(document.getElementById('qpLanguageSetCount')?.value||1));document.getElementById('qpLanguageSetCount').value=n;qpState.lastRows=null;qpState.lastSignature='';qpRefreshLanguagePool();qpRefreshSubjectSummary();}
function qpSelectVisibleLanguageQuestions(){const search=qpNorm(document.getElementById('qpQuestionSearch')?.value).toLowerCase();qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&String(q.part_code||'').toUpperCase()==='LANGUAGE_PASSAGE').filter(q=>!search||[q.question_text,q.passage_title,q.passage_id].some(v=>qpNorm(v).toLowerCase().includes(search))).slice(0,600).forEach(q=>qpState.selected.add(q.id));qpState.lastRows=null;qpState.lastSignature='';qpRefreshLanguagePool();qpRefreshSubjectSummary();}
async function questionPaperGeneratorPage(){
  qpState={bank:[],subject:'MAT',language:'COMMON',mode:'mat',selected:new Set(),selectedPassages:new Set(),selectedTopics:new Set(),topicLimits:{},commonCounts:Object.fromEntries(QP_COMMON_PARTS.map(x=>[x.part,4])),lastRows:null,lastSignature:'',lastSerial:'',setCode:'A',setCount:4,savedHistoryId:null,lastSetVariants:null,multiSetSerial:''};
  const {data,error}=await sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).eq('active',true).order('created_at',{ascending:true});
  if(error)return notify('Could not load Mock Test question bank: '+error.message);
  qpState.bank=data||[];
  render(`<div class="wrap">${header('🖨️ Question Paper Generator')}
    <div class="card"><h2>Teacher-only Question Paper Generator</h2><p class="muted">Generate MAT, Arithmetic, EVS or Language papers. Mandatory questions are kept fixed; all remaining questions/passage sets are selected randomly.</p>
      <div class="grid"><div><label>Paper Title</label><input id="qpTitle" value="JNVST Practice Question Paper"></div><div><label>Question Paper Serial No.</label><div class="qp-serial-display" style="padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-weight:700;color:#17365D">Automatically generated when the paper is prepared</div></div><div><label>Subject</label><select id="qpSubject" onchange="qpSubjectChanged()"><option value="MAT">Mental Ability (MAT)</option><option value="Arithmetic">Arithmetic</option><option value="EVS">EVS</option><option value="Language">Language</option></select></div><div><label>Language</label><select id="qpLanguage" onchange="qpLanguageChanged()"><option value="ASSAMESE">Assamese</option><option value="ENGLISH">English</option></select><div class="muted small">MAT is Common and does not use a language-specific bank.</div></div></div>
    </div>
    <div id="qpSubjectSummary" class="success" style="margin-bottom:12px">Select a subject.</div>
    <div id="qpCommonPanel"></div><div id="qpQuestionsPanel" class="card" style="display:none"></div><div id="qpPassagesPanel" class="card" style="display:none"></div><div id="qpSpecialPanel"></div>
    <div class="card"><div class="actions" style="justify-content:space-between;align-items:center"><div><h2 style="margin:0">🗂 Previously Generated Question Papers</h2><p class="muted small" style="margin:6px 0 0">Generated papers and their answer keys are saved with the exact selected questions and generation date/time.</p></div><button class="secondary" onclick="loadGeneratedQuestionPaperHistory()">↻ Refresh</button></div><div id="qpGeneratedHistory" style="margin-top:12px"><p class="muted">Loading…</p></div></div>
    <div class="card"><div id="qpSummary" class="success">The generated paper will keep mandatory questions and randomly fill the remaining slots.</div><div class="grid"><div><label>Question Order</label><select id="qpOrder"><option value="random">Random</option><option value="original">Original bank order</option></select></div><div><label>Include Answers in PDF?</label><select id="qpPdfAnswers"><option value="no">No — Question Paper only</option><option value="yes">Yes — Teacher Copy</option></select></div></div><div class="actions"><button class="secondary" onclick="qpRunQualityControl()">🛡️ Paper Quality Control</button><button onclick="generateSelectedQuestionPaper()">🖨️ Generate / Print PDF</button><button onclick="downloadSelectedQuestionPaperWord()">📝 Download Word File</button><button onclick="downloadSelectedAnswerKeyExcel()">📊 Download Answer Key Excel</button><button class="secondary" onclick="qpResetAllSelections()">↻ Reset All Selections</button><button class="secondary" onclick="mockTestManagement()">← Back</button></div></div>
  </div>`);
  qpRenderGeneratorMode();
  loadGeneratedQuestionPaperHistory();
}
function qpSubjectChanged(){
  qpState.subject=qpSubject();qpState.language=qpCurrentLanguage();qpState.selected.clear();qpState.selectedPassages.clear();qpState.lastRows=null;qpState.lastSignature='';qpState.lastSerial='';qpState.savedHistoryId=null;qpState.historyMasterRows=null;qpState.lastSetVariants=null;qpState.multiSetSerial='';qpRenderGeneratorMode();
}
function qpLanguageChanged(){qpState.language=qpCurrentLanguage();qpState.selected.clear();qpState.selectedPassages.clear();qpState.lastRows=null;qpState.lastSignature='';qpState.lastSerial='';qpState.savedHistoryId=null;qpState.historyMasterRows=null;qpState.lastSetVariants=null;qpState.multiSetSerial='';qpRenderGeneratorMode();}
function qpSelectedRows(){
  const chosen=new Set(qpState.selected);return qpState.bank.filter(q=>chosen.has(q.id));
}
function qpShuffle(arr){const out=[...arr];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function qpGetSetSerial(signature){if(qpState.lastSerial&&qpState.lastSignature===signature)return qpState.lastSerial;const d=new Date(),pad=n=>String(n).padStart(2,'0');const stamp=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`,rand=Math.random().toString(36).slice(2,6).toUpperCase();return `QSET-${stamp}-${rand}`;}
function qpCurrentSetSerial(){const signature=qpState.lastSignature||JSON.stringify({subject:qpSubject(),language:qpCurrentLanguage(),mode:qpState.mode,selected:[...qpState.selected].sort(),counts:qpState.commonCounts,setCode:document.getElementById('qpSetCode')?.value||qpState.setCode||'A'});if(!qpState.lastSerial||qpState.lastSignature!==signature)qpState.lastSerial=qpGetSetSerial(signature);return qpState.lastSerial;}
function qpAssignNumbers(rows){return(rows||[]).map((q,i)=>({...q,_number:i+1}));}
function qpBuildAnswerRows(rows){return(rows||[]).map(q=>({"Q.No.":q._number,"Section":q.section_code||'',"Part":q.part_code||'',"Topic":qpTopicLabel(q),"Selection":q._selectionType||'',"Passage Set":q._passageGroup||q.passage_id||'',"Question ID":q.id||'',"Correct Option":String(q.correct_option||'').toUpperCase()}));}
function qpQualityText(v){return qpNorm(v).replace(/\s+/g,' ').trim()}
function qpQualityFingerprint(q){
  return [qpQualityText(q.question_text),qpQualityText(q.option_a),qpQualityText(q.option_b),qpQualityText(q.option_c),qpQualityText(q.option_d)].join('||').toLowerCase();
}
function qpExpectedQuestionCount(){
  const subject=qpSubject();
  if(subject==='MAT') return qpCommonTotal();
  if(subject==='ARITHMETIC') return Math.max(0,Math.floor(Number(document.getElementById('qpQuestionCount')?.value||0)));
  if(subject==='EVS'){const sets=Math.max(1,Math.floor(Number(document.getElementById('qpEvsSetCount')?.value||1)));return sets*20;}
  if(subject==='LANGUAGE'){const sets=Math.max(1,Math.floor(Number(document.getElementById('qpLanguageSetCount')?.value||1)));return sets*5;}
  return 0;
}
function qpValidatePaperQuality(rows, subjectOverride, setLabel){
  const subject=String(subjectOverride||qpSubject()).toUpperCase();
  const result={subject,setLabel:setLabel||'',errors:[],warnings:[],checks:[]};
  const add=(ok,label,detail='',level='error')=>{result.checks.push({ok,label,detail,level});if(!ok)(level==='warning'?result.warnings:result.errors).push(`${label}${detail?': '+detail:''}`);};
  const list=Array.isArray(rows)?rows:[];
  const expected=(()=>{
    if(subject==='MAT')return qpCommonTotal();
    if(subject==='ARITHMETIC')return Math.max(0,Math.floor(Number(document.getElementById('qpQuestionCount')?.value||0)));
    if(subject==='EVS'){const sets=Math.max(1,Math.floor(Number(document.getElementById('qpEvsSetCount')?.value||1)));return sets*20;}
    if(subject==='LANGUAGE'){const sets=Math.max(1,Math.floor(Number(document.getElementById('qpLanguageSetCount')?.value||1)));return sets*5;}
    return 0;
  })();
  add(list.length===expected,'Question count',`${list.length}/${expected}`,'error');
  const ids=list.map(q=>qpNorm(q.id)).filter(Boolean),idSet=new Set(ids);
  add(ids.length===list.length,'Question IDs present',ids.length===list.length?'All selected questions have IDs.':`${list.length-ids.length} question(s) have no ID.`);
  add(idSet.size===ids.length,'Duplicate question IDs',idSet.size===ids.length?'None':'Duplicate question ID(s) found.');
  const nums=list.map(q=>Number(q._number));
  add(nums.length===list.length && nums.every((n,i)=>n===i+1),'Serial numbers','Expected continuous numbering 1–'+list.length+'.');
  const badAnswers=list.filter(q=>!['A','B','C','D'].includes(String(q.correct_option||'').trim().toUpperCase()));
  add(!badAnswers.length,'Correct answers','All questions have one valid answer (A/B/C/D).'+(badAnswers.length?` Invalid: ${badAnswers.map(q=>q._number||q.id).join(', ')}.`:''));
  const missingContent=list.filter(q=>!qpQualityText(q.question_text)&&!qpNorm(q.image_url));
  add(!missingContent.length,'Question content','Every question has text or an image.'+(missingContent.length?` Missing: ${missingContent.map(q=>q._number).join(', ')}.`:''));
  const missingOptions=list.filter(q=>{
    const isMat=subject==='MAT' && !!qpNorm(q.image_url);
    return !isMat && ['option_a','option_b','option_c','option_d'].some(k=>!qpQualityText(q[k]));
  });
  add(!missingOptions.length,'Answer options','All non-image questions have A–D options.'+(missingOptions.length?` Missing options: ${missingOptions.map(q=>q._number).join(', ')}.`:''));
  const fps=new Map();list.forEach(q=>{const f=qpQualityFingerprint(q);if(f.replace(/\|/g,'').trim()){if(!fps.has(f))fps.set(f,[]);fps.get(f).push(q._number);}});
  const duplicateContent=[...fps.values()].filter(a=>a.length>1);
  add(!duplicateContent.length,'Duplicate question content',duplicateContent.length?'Duplicate groups: '+duplicateContent.map(a=>a.join(', ')).join(' | '):'None.','error');
  const lang=qpCurrentLanguage();
  const wrongLang=list.filter(q=>!qpLangMatches(q));
  add(!wrongLang.length,'Language consistency',`All questions match ${lang}.`+(wrongLang.length?` Mismatch: ${wrongLang.map(q=>q._number).join(', ')}.`:''));
  if(subject==='MAT'){
    const bad=list.filter(q=>!(String(q.part_code||'').toUpperCase().startsWith('MAT_') || String(q.section_code||'').toUpperCase()==='MAT'));
    add(!bad.length,'MAT part consistency',bad.length?`Invalid MAT question(s): ${bad.map(q=>q._number).join(', ')}.`:'All questions belong to MAT parts.');
    const counts=new Map(list.map(q=>[q._commonPart||q.part_code,0]));list.forEach(q=>counts.set(q._commonPart||q.part_code,(counts.get(q._commonPart||q.part_code)||0)+1));
    const badParts=QP_COMMON_PARTS.filter(p=>Number(qpState.commonCounts[p.part]||0)!==(counts.get(p.part)||0));
    add(!badParts.length,'MAT part distribution',badParts.length?badParts.map(p=>`${p.part}: expected ${qpState.commonCounts[p.part]||0}, got ${counts.get(p.part)||0}`).join('; '):'All five MAT parts match the requested counts.');
  }
  if(subject==='ARITHMETIC'){
    const bad=list.filter(q=>!qpQuestionSubjectMatches(q)||String(q.part_code||'').toUpperCase()!=='ARITHMETIC');
    add(!bad.length,'Arithmetic subject isolation',bad.length?`Non-Arithmetic question(s): ${bad.map(q=>q._number).join(', ')}.`:'All questions are Arithmetic.');
    const groups=new Map();list.forEach(q=>{const g=qpQualityText(q.variation_group).toLowerCase();if(g){if(!groups.has(g))groups.set(g,[]);groups.get(g).push(q._number);}});
    const dup=[...groups.values()].filter(a=>a.length>1);
    add(!dup.length,'Variation Group uniqueness',dup.length?`Repeated group(s): ${dup.map(a=>a.join(', ')).join(' | ')}.`:'No Variation Group is repeated.');
  }
  if(subject==='EVS'){
    const passageFlags=list.map(q=>qpIsPassage(q));
    let firstPass=passageFlags.indexOf(true);if(firstPass<0)firstPass=list.length;
    const lateMcq=list.slice(firstPass).filter(q=>!qpIsPassage(q));
    add(!lateMcq.length,'EVS section order','All standalone MCQs appear before Passage questions.');
    const badMCQ=list.filter(q=>!qpIsPassage(q)&&!qpIsEVSMCQ(q));
    const badPass=list.filter(q=>qpIsPassage(q)&&!qpIsEVSPassageQuestion(q));
    add(!badMCQ.length,'EVS MCQ subject isolation',badMCQ.length?`Invalid/non-EVS MCQ(s): ${badMCQ.map(q=>q._number).join(', ')}.`:'All standalone questions are valid EVS MCQs.');
    add(!badPass.length,'EVS Passage subject isolation',badPass.length?`Invalid passage question(s): ${badPass.map(q=>q._number).join(', ')}.`:'All passage questions are valid EVS passage questions.');
    const groups=qpPassageGroups(list.filter(q=>qpIsPassage(q)));
    const badGroups=groups.filter(g=>g.questions.length!==5);
    add(!badGroups.length,'EVS passage completeness',badGroups.length?badGroups.map(g=>`${g.title||g.id}: ${g.questions.length}/5 questions`).join('; '):`${groups.length} complete passage set(s), 5 questions each.`);
    const mcqCount=list.filter(q=>!qpIsPassage(q)).length;
    add(mcqCount===list.length-groups.length*5,'EVS passage placement',`MCQs: ${mcqCount}; passage questions: ${groups.length*5}.`);
    const forcedBreak=/qp-evs-passage-next/.test(qpBuildEVSHtml(list));
    add(!forcedBreak,'EVS passage page flow','No forced page break is inserted before Passage 2 or later passages.','warning');
  }
  if(subject==='LANGUAGE'){
    const bad=list.filter(q=>!qpIsPassage(q)||String(q.part_code||'').toUpperCase()!=='LANGUAGE_PASSAGE'||!qpLangMatches(q));
    add(!bad.length,'Language passage consistency',bad.length?`Invalid language passage question(s): ${bad.map(q=>q._number).join(', ')}.`:'All questions belong to the selected language passage bank.');
    const groups=qpPassageGroups(list.filter(q=>qpIsPassage(q)));const badGroups=groups.filter(g=>g.questions.length!==5);
    add(!badGroups.length,'Language passage completeness',badGroups.length?badGroups.map(g=>`${g.title||g.id}: ${g.questions.length}/5`).join('; '):`${groups.length} complete passage set(s).`);
  }
  const answerRows=qpBuildAnswerRows(list);
  const answerOk=answerRows.length===list.length && answerRows.every((r,i)=>Number(r['Q.No.'])===i+1 && ['A','B','C','D'].includes(String(r['Correct Option']).toUpperCase()));
  add(answerOk,'Answer-key alignment',answerOk?'Answer key has one matching entry for every serial number.':'Answer-key rows do not exactly match the generated serial numbers/answers.');
  const imageMissing=list.filter(q=>qpNorm(q.image_url)&&!/^https?:\/\//i.test(q.image_url));
  add(!imageMissing.length,'Image URL format',imageMissing.length?`Invalid image URL(s): ${imageMissing.map(q=>q._number).join(', ')}.`:'All image URLs have a valid HTTP/HTTPS format.','warning');
  return result;
}
function qpShowQualityControl(reports,autoBlock=false){
  const list=Array.isArray(reports)?reports:[reports];
  const errors=list.flatMap(r=>r.errors.map(x=>({text:x,set:r.setLabel||'Paper'})));
  const warnings=list.flatMap(r=>r.warnings.map(x=>({text:x,set:r.setLabel||'Paper'})));
  const checks=list.reduce((n,r)=>n+r.checks.length,0),passed=list.reduce((n,r)=>n+r.checks.filter(c=>c.ok).length,0);
  const ok=!errors.length;
  const status=ok?'✓ PAPER QUALITY CONTROL PASSED':'✕ PAPER QUALITY CONTROL FAILED';
  const statusClass=ok?'success':'notice';
  const detail=list.map(r=>`<div style="margin-top:12px"><b>${esc(r.setLabel||'Paper')} — ${r.errors.length?'✕ '+r.errors.length+' error(s)':'✓ No blocking errors'}${r.warnings.length?` · ⚠ ${r.warnings.length} warning(s)`:''}</b><ul style="margin:7px 0 0 20px">${r.checks.map(c=>`<li style="color:${c.ok?'#166534':(c.level==='warning'?'#92400e':'#b91c1c')}">${c.ok?'✓':'✕'} ${esc(c.label)}${c.detail?` — ${esc(c.detail)}`:''}</li>`).join('')}</ul></div>`).join('');
  const overlay=document.createElement('div');overlay.id='qpQualityOverlay';overlay.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML=`<div style="background:#fff;border-radius:14px;max-width:900px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:20px"><div style="display:flex;justify-content:space-between;gap:15px;align-items:center"><div><h2 style="margin:0">🛡️ Paper Quality Control</h2><div class="small muted" style="margin-top:4px">${passed}/${checks} checks passed${list.length>1?` · ${list.length} set(s) checked`:''}</div></div><button class="secondary" onclick="document.getElementById('qpQualityOverlay')?.remove()">✕ Close</button></div><div class="${statusClass}" style="margin-top:14px;font-size:16px;font-weight:800">${status}</div>${errors.length?`<div class="notice" style="margin-top:12px"><b>Blocking errors</b><ul style="margin:6px 0 0 20px">${errors.map(e=>`<li><b>${esc(e.set)}:</b> ${esc(e.text)}</li>`).join('')}</ul></div>`:''}${warnings.length?`<div style="margin-top:12px;padding:10px 12px;border:1px solid #f59e0b;background:#fffbeb;border-radius:8px;color:#92400e"><b>Warnings</b><ul style="margin:6px 0 0 20px">${warnings.map(e=>`<li><b>${esc(e.set)}:</b> ${esc(e.text)}</li>`).join('')}</ul></div>`:''}<div>${detail}</div><div class="actions" style="justify-content:flex-end;margin-top:18px"><button class="secondary" onclick="document.getElementById('qpQualityOverlay')?.remove()">Close</button>${ok?`<button onclick="document.getElementById('qpQualityOverlay')?.remove()">✓ Continue</button>`:''}</div></div>`;
  document.body.appendChild(overlay);
  return ok;
}
function qpRunQualityControl(){
  try{const rows=qpMasterRows();const report=qpValidatePaperQuality(rows,qpSubject(),'Current selection');qpShowQualityControl(report);}
  catch(e){qpShowQualityControl({subject:qpSubject(),setLabel:'Current selection',errors:[e.message||String(e)],warnings:[],checks:[{ok:false,label:'Paper preparation',detail:e.message||String(e),level:'error'}]});}
}
function qpQualityGate(rows,label){const report=qpValidatePaperQuality(rows,qpSubject(),label||'Paper');if(report.errors.length){qpShowQualityControl(report,true);return false;}return true;}
function qpPrepareRows(){
  const subject=qpSubject();
  if(subject==='MAT'){
    const signature=JSON.stringify({subject,counts:qpState.commonCounts,mandatory:[...qpState.selected].sort(),order:document.getElementById('qpOrder')?.value||'random',setCode:document.getElementById('qpSetCode')?.value||qpState.setCode||'A'});if(qpState.lastRows&&qpState.lastSignature===signature)return qpState.lastRows.map(x=>({...x}));const rows=qpCommonPrepareRows();qpState.lastSerial=qpGetSetSerial(signature);qpState.lastRows=rows.map(x=>({...x}));qpState.lastSignature=signature;return rows;
  }
  if(subject==='ARITHMETIC'){
    let wanted=Number(document.getElementById('qpQuestionCount')?.value||0);if(!Number.isFinite(wanted)||wanted<1)throw new Error('Enter at least 1 question.');wanted=Math.floor(wanted);
    const chosenTopics=qpState.selectedTopics||new Set(),limits=qpState.topicLimits||{};
    const basePool=qpState.bank.filter(q=>!qpIsPassage(q)&&qpLangMatches(q)&&qpQuestionSubjectMatches(q)&&qpQuestionMatchesLesson(q));
    const pool=basePool.filter(q=>chosenTopics.size?chosenTopics.has(qpTopicLabel(q)):true);
    const scopedTopics=chosenTopics.size?[...chosenTopics]:[...new Set(pool.map(q=>qpTopicLabel(q)))];
    const mandatory=pool.filter(q=>qpState.selected.has(q.id));
    if(mandatory.length>wanted)throw new Error(`You marked ${mandatory.length} mandatory Arithmetic questions, but only ${wanted} are required.`);
    const mandatoryGroupCounts=new Map();mandatory.forEach(q=>{const g=qpNorm(q.variation_group).toLowerCase();if(g)mandatoryGroupCounts.set(g,(mandatoryGroupCounts.get(g)||0)+1);});
    const duplicateMandatory=[...mandatoryGroupCounts.entries()].filter(([,n])=>n>1).map(([g,n])=>`${g} (${n})`);
    if(duplicateMandatory.length)throw new Error(`Only one question is allowed from each Variation Group. These mandatory selections contain duplicates: ${duplicateMandatory.join(', ')}`);
    const usedGroups=new Set(mandatoryGroupCounts.keys()),chosen=[...mandatory],chosenByTopic=new Map();mandatory.forEach(q=>chosenByTopic.set(qpTopicLabel(q),(chosenByTopic.get(qpTopicLabel(q))||0)+1));
    for(const t of scopedTopics){const lim=limits[t]||{},min=lim.min==null?0:Number(lim.min),max=lim.max==null?Infinity:Number(lim.max),m=chosenByTopic.get(t)||0;if(m>max)throw new Error(`Topic "${t}" has ${m} mandatory question(s), but its maximum is ${max}.`);}
    const candidatesByTopic=new Map();
    for(const t of scopedTopics){const candidates=qpShuffle(pool.filter(q=>qpTopicLabel(q)===t&&!qpState.selected.has(q.id)));const unique=[],seen=new Set();for(const q of candidates){const g=qpNorm(q.variation_group).toLowerCase();if(g&&(usedGroups.has(g)||seen.has(g)))continue;if(g)seen.add(g);unique.push(q);}candidatesByTopic.set(t,unique);}
    for(const t of scopedTopics){const lim=limits[t]||{},min=lim.min==null?0:Number(lim.min),candidates=candidatesByTopic.get(t)||[];while((chosenByTopic.get(t)||0)<min&&chosen.length<wanted){const q=candidates.find(x=>{const g=qpNorm(x.variation_group).toLowerCase();return !(g&&usedGroups.has(g));});if(!q)break;chosen.push(q);chosenByTopic.set(t,(chosenByTopic.get(t)||0)+1);const g=qpNorm(q.variation_group).toLowerCase();if(g)usedGroups.add(g);}
      if((chosenByTopic.get(t)||0)<min)throw new Error(`Topic "${t}" requires at least ${min} question(s), but not enough unique Variation Groups are available.`);}
    const remaining=[];for(const t of scopedTopics){const lim=limits[t]||{},max=lim.max==null?Infinity:Number(lim.max);if((chosenByTopic.get(t)||0)>=max)continue;(candidatesByTopic.get(t)||[]).forEach(q=>remaining.push(q));}
    for(const q of qpShuffle(remaining)){if(chosen.length>=wanted)break;const t=qpTopicLabel(q),lim=limits[t]||{},max=lim.max==null?Infinity:Number(lim.max);if((chosenByTopic.get(t)||0)>=max)continue;const g=qpNorm(q.variation_group).toLowerCase();if(g&&usedGroups.has(g))continue;chosen.push(q);chosenByTopic.set(t,(chosenByTopic.get(t)||0)+1);if(g)usedGroups.add(g);}
    if(chosen.length<wanted){const summary=scopedTopics.map(t=>{const lim=limits[t]||{},max=lim.max==null?'∞':lim.max;return `${t}: ${chosenByTopic.get(t)||0}/${max}`;}).join('; ');throw new Error(`Only ${chosen.length} unique question(s) can be generated under the selected topic limits and Variation Group rules. You requested ${wanted}. ${summary}`);}
    let final=document.getElementById('qpOrder')?.value==='random'?qpShuffle(chosen):[...chosen].sort((a,b)=>(Number(a.question_order)||0)-(Number(b.question_order)||0));
    final=qpAssignNumbers(final).map(q=>({...q,_selectionType:qpState.selected.has(q.id)?'MANDATORY':'RANDOM'}));
    const signature=JSON.stringify({subject,wanted,topics:[...chosenTopics].sort(),lessons:[...qpSelectedLessonIds()].sort(),topicLimits:limits,mandatory:[...qpState.selected].sort(),order:document.getElementById('qpOrder')?.value||'random'});qpState.lastSerial=qpGetSetSerial(signature);qpState.lastRows=final.map(x=>({...x}));qpState.lastSignature=signature;return final;
  }
  if(subject==='EVS'){
    const sets=Math.max(1,Number(document.getElementById('qpEvsSetCount')?.value||1)),wantedMcq=15*sets;const mcqPool=qpState.bank.filter(q=>qpIsEVSMCQ(q));const mandatoryMcq=mcqPool.filter(q=>qpState.selected.has(q.id));const groups=qpPassageGroups(qpState.bank.filter(q=>qpIsEVSPassageQuestion(q))).filter(g=>g.questions.length===5);const mandatoryPassIds=[...new Set([...qpState.selected].map(id=>qpState.bank.find(x=>x.id===id)?.passage_id).filter(Boolean))];if(mandatoryMcq.length>wantedMcq)throw new Error(`You marked ${mandatoryMcq.length} mandatory EVS MCQs, but only ${wantedMcq} are required.`);if(mandatoryPassIds.length>sets)throw new Error(`You marked ${mandatoryPassIds.length} mandatory EVS passage sets, but only ${sets} are required.`);if(mcqPool.length<wantedMcq)throw new Error(`Only ${mcqPool.length} EVS MCQs are available for ${wantedMcq} required.`);if(groups.length<sets)throw new Error(`Only ${groups.length} complete EVS passage sets are available for ${sets} required.`);let randomMcq=qpShuffle(mcqPool.filter(q=>!qpState.selected.has(q.id))).slice(0,wantedMcq-mandatoryMcq.length);let passMap=new Map(groups.map(g=>[g.id,g]));let randomGroups=qpShuffle(groups.filter(g=>!mandatoryPassIds.includes(g.id))).slice(0,sets-mandatoryPassIds.length);let finalMcq=[...mandatoryMcq,...randomMcq];if(document.getElementById('qpOrder')?.value==='random')finalMcq=qpShuffle(finalMcq);else finalMcq.sort((a,b)=>(Number(a.question_order)||0)-(Number(b.question_order)||0));let finalGroups=[...mandatoryPassIds.map(id=>passMap.get(id)).filter(Boolean),...randomGroups];if(document.getElementById('qpOrder')?.value==='random')finalGroups=qpShuffle(finalGroups);const rows=[...finalMcq.map(q=>({...q,_selectionType:qpState.selected.has(q.id)?'MANDATORY':'RANDOM'}))];finalGroups.forEach(g=>g.questions.forEach(q=>rows.push({...q,_passageGroup:g.id,_passageTitle:g.title,_passageText:g.text,_selectionType:qpState.selected.has(q.id)?'MANDATORY':'RANDOM'})));const numbered=qpAssignNumbers(rows);const signature=JSON.stringify({subject,sets,mandatory:[...qpState.selected].sort(),order:document.getElementById('qpOrder')?.value||'random',setCode:document.getElementById('qpSetCode')?.value||qpState.setCode||'A'});qpState.lastSerial=qpGetSetSerial(signature);qpState.lastRows=numbered.map(x=>({...x}));qpState.lastSignature=signature;return numbered;
  }
  if(subject==='LANGUAGE'){
    const sets=Math.max(1,Number(document.getElementById('qpLanguageSetCount')?.value||1));const groups=qpPassageGroups(qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&String(q.part_code||'').toUpperCase()==='LANGUAGE_PASSAGE')).filter(g=>g.questions.length===5);const mandatoryPassIds=[...new Set([...qpState.selected].map(id=>qpState.bank.find(x=>x.id===id)?.passage_id).filter(Boolean))];if(mandatoryPassIds.length>sets)throw new Error(`You marked ${mandatoryPassIds.length} mandatory Language passage sets, but only ${sets} are required.`);if(groups.length<sets)throw new Error(`Only ${groups.length} complete Language passage sets are available for ${sets} required.`);const passMap=new Map(groups.map(g=>[g.id,g]));let randomGroups=qpShuffle(groups.filter(g=>!mandatoryPassIds.includes(g.id))).slice(0,sets-mandatoryPassIds.length);let finalGroups=[...mandatoryPassIds.map(id=>passMap.get(id)).filter(Boolean),...randomGroups];if(document.getElementById('qpOrder')?.value==='random')finalGroups=qpShuffle(finalGroups);const rows=[];finalGroups.forEach(g=>g.questions.forEach(q=>rows.push({...q,_passageGroup:g.id,_passageTitle:g.title,_passageText:g.text,_selectionType:mandatoryPassIds.includes(g.id)?'MANDATORY':'RANDOM'})));const numbered=qpAssignNumbers(rows);const signature=JSON.stringify({subject,sets,mandatory:[...qpState.selected].sort(),order:document.getElementById('qpOrder')?.value||'random',setCode:document.getElementById('qpSetCode')?.value||qpState.setCode||'A'});qpState.lastSerial=qpGetSetSerial(signature);qpState.lastRows=numbered.map(x=>({...x}));qpState.lastSignature=signature;return numbered;
  }
  throw new Error('Unsupported subject.');
}
function qpRequestedSetCount(){
  const n=Number(qpState.setCount||4);
  return Math.max(1,Math.min(4,Number.isFinite(n)?Math.floor(n):4));
}
function qpAskSetCount(defaultCount=4){
  const answer=prompt('How many question sets do you want to prepare?\nEnter 1, 2, 3 or 4.\n\nThe same generated questions will be used in every set, with a different random order.',String(defaultCount));
  if(answer===null)return null;
  const n=Number(answer);
  if(!Number.isInteger(n)||n<1||n>4){notify('Please enter a number from 1 to 4.');return null;}
  qpState.setCount=n;
  return n;
}
function qpSetCodes(count){return ['A','B','C','D'].slice(0,Math.max(1,Math.min(4,count)));}
function qpMasterRows(){
  const rows=qpPrepareRows();
  if(!rows.length)throw new Error('Please select questions or passage sets first.');
  return rows.map(q=>({...q}));
}
function qpRandomizeMasterRows(masterRows,setIndex){
  const base=(masterRows||[]).map(q=>({...q}));
  if(base.length<2)return qpAssignNumbers(base);
  const subject=qpSubject();
  // Keep structural sections together (MAT parts and passage groups), while
  // randomizing the question order inside those structures. Arithmetic is
  // allowed to randomize globally because each row is an independent MCQ.
  if(subject==='MAT'){
    const groups=[];const map=new Map();
    base.forEach(q=>{const key=q._partHeading||q.part_code||'MAT';if(!map.has(key)){const g=[];map.set(key,g);groups.push(g);}map.get(key).push(q);});
    const out=[];groups.forEach(g=>out.push(...qpShuffle(g)));
    return qpAssignNumbers(out);
  }
  if(qpIsCommonMode())return qpAssignNumbers(qpShuffle(base));
  if(subject==='EVS'){
    // EVS paper structure is fixed: all standalone EVS MCQs first, then all
    // passage groups at the end. Randomisation may change the order of the
    // standalone MCQs, but it must never move passage questions into the MCQ
    // block. Passage question numbers are reassigned after this ordering.
    const mcqs=base.filter(q=>!qpIsPassage(q));
    const passageRows=base.filter(q=>qpIsPassage(q));
    const groupMap=new Map(),groupOrder=[];
    passageRows.forEach(q=>{
      const key=q._passageGroup||q.passage_id||`__q_${q.id}`;
      if(!groupMap.has(key)){groupMap.set(key,[]);groupOrder.push(key);}
      groupMap.get(key).push(q);
    });
    const out=[...qpShuffle(mcqs)];
    groupOrder.forEach(key=>out.push(...(groupMap.get(key)||[])));
    return qpAssignNumbers(out);
  }
  if(qpState.mode==='passages'){
    const groupMap=new Map(),order=[];
    base.forEach(q=>{const key=q._passageGroup||q.passage_id||`__q_${q.id}`;if(!groupMap.has(key)){groupMap.set(key,[]);order.push(key);}groupMap.get(key).push(q);});
    const randomizedOrder=qpShuffle(order);
    const out=[];
    randomizedOrder.forEach(key=>{const qs=groupMap.get(key)||[];if(key.startsWith('__q_'))out.push(...qpShuffle(qs));else out.push(...qs);});
    return qpAssignNumbers(out);
  }
  return qpAssignNumbers(qpShuffle(base));
}
function qpBuildSetVariants(masterRows,count){
  const codes=qpSetCodes(count);
  return codes.map((code,index)=>({setCode:code,rows:qpRandomizeMasterRows(masterRows,index).map(q=>({...q,_masterNumber:(masterRows.findIndex(m=>m.id===q.id)+1)}))}));
}
function qpBuildCommonHtml(rows){
  const out=[];let current='';
  for(const q of rows){if(q._partHeading!==current){current=q._partHeading;out.push(`<div class="jnvst-section-head" style="margin-top:16px">${esc(current)}</div>`);}out.push(qpHtmlQuestion(q));}
  return out.join('');
}
function qpHtmlQuestion(q,variant='default'){
  const hasImage=!!qpNorm(q.image_url);
  const questionText=(q.question_text && String(q.question_text).trim()!=='[IMAGE QUESTION]')?String(q.question_text).trim():'';
  // MAT image already contains the question figure and all answer figures/options.
  // Do not append database option text beneath the image.
  const isMat=String(q.section_code||'').toUpperCase()==='MAT' || String(q.part_code||'').toUpperCase().startsWith('MAT_') || variant==='mat';
  const embeddedImageOptions=hasImage && isMat;
  const longOpts=['a','b','c','d'].some(k=>qpPlainMath(q['option_'+k]||'').length>18);
  const opts=embeddedImageOptions?'':`<div class="jnvst-options${longOpts?' long':''}">${['A','B','C','D'].map(o=>jnvstPdfOption(q,o)).join('')}</div>`;
  const imageClass=variant==='arithmetic'?'jnvst-question-image arithmetic-question-image':'jnvst-question-image';
  return `<div class="jnvst-question ${variant==='arithmetic'?'arithmetic-question':variant==='evs-mcq'?'evs-mcq-question':''}"><div class="jnvst-qrow"><div class="jnvst-qnum">${q._number}.</div><div class="jnvst-qbody">${hasImage?`<img class="${imageClass}" src="${esc(q.image_url)}" alt="" loading="eager" decoding="sync">`:''}${questionText?`<div class="jnvst-qtext">${jnvstPdfEscape(questionText)}</div>`:''}${opts}</div></div></div>`;
}
function qpBuildArithmeticHtml(rows){const list=Array.isArray(rows)?rows:[];return `<div class="qp-arithmetic-page"><div class="qp-arithmetic-flow">${list.map(q=>qpHtmlQuestion(q,'arithmetic')).join('')}</div></div>`;}
function qpOrderEVSRows(rows){
  const source=(rows||[]).map(q=>({...q}));
  const mcqs=source.filter(q=>!qpIsPassage(q));
  const passageRows=source.filter(q=>qpIsPassage(q));
  const groups=qpPassageGroups(passageRows);
  const ordered=[...mcqs];
  groups.forEach(g=>ordered.push(...g.questions));
  return ordered.map((q,i)=>({...q,_number:i+1}));
}
function qpBuildEVSHtml(rows){
  // EVS has a strict printable order: standalone MCQs first, followed by the
  // complete passage groups. Older saved/generated papers may contain the
  // original bank numbers (for example 3-7 and 13-17) on passage questions.
  // Rebuild the display order and serial numbers here so the final paper is
  // always numbered continuously: 1..MCQ count, then passage questions.
  const ordered=qpOrderEVSRows(rows);
  const mcqs=ordered.filter(q=>!qpIsPassage(q));
  const passageRows=ordered.filter(q=>qpIsPassage(q));
  const groups=qpPassageGroups(passageRows);
  const orderedMcqs=mcqs;
  // EVS MCQs must remain in two columns, but the column container itself must
  // be fragmentable by the print engine. A CSS grid containing all 15 MCQs
  // was treated as one unbreakable block, so the whole EVS section moved to
  // page 2 and left page 1 with only the header. Use CSS multi-columns so
  // questions can flow from page 1 to page 2 naturally.
  const pages=[];
  if(orderedMcqs.length){
    pages.push(`<div class="qp-evs-mcq-page"><div class="qp-evs-mcq-flow">${orderedMcqs.map(q=>qpHtmlQuestion(q,'evs-mcq')).join('')}</div></div>`);
  }
  groups.forEach((g,index)=>{
    const title=qpNorm(g.title)||'Passage';
    const text=g.text||'';
    const qs=(g.questions||[]);
    const leftCount=Math.ceil(qs.length/2);
    const left=qs.slice(0,leftCount).map(q=>qpHtmlQuestion(q,'evs-mcq')).join('');
    const right=qs.slice(leftCount).map(q=>qpHtmlQuestion(q,'evs-mcq')).join('');
    const isLast=index===groups.length-1;
    pages.push(`<div class="qp-evs-passage-wrap${index>0?' qp-evs-passage-next':''}${isLast?' qp-content-no-break':''}">
      <div class="qp-evs-passage-layout">
        <div class="qp-evs-passage-text">
          <div class="qp-passage-number">Passage ${index+1}</div>
          <div class="qp-passage-title">${esc(title)}</div>
          <div>${jnvstPdfEscape(text)}</div>
        </div>
        <div class="qp-evs-passage-question-columns">
          <div class="qp-evs-passage-question-column">${left}</div>
          <div class="qp-evs-passage-question-column">${right}</div>
        </div>
      </div>
    </div>`);
  });
  return pages.join('');
}
function qpBuildPassageHtml(rows){
  const out=[];
  const seen=new Set();
  let passageNumber=0;
  for(const q of rows){
    const pid=q._passageGroup||q.passage_id;
    if(pid&&!seen.has(pid)){
      seen.add(pid);
      passageNumber++;
      const title=qpNorm(q._passageTitle||q.passage_title)||'Passage';
      const text=q._passageText||q.passage_text||'';
      out.push(`<div class="jnvst-passage"><div class="qp-passage-number">Passage ${passageNumber}</div><div class="qp-passage-title">${esc(title)}</div><div>${jnvstPdfEscape(text)}</div></div>`);
    }
    out.push(qpHtmlQuestion(q));
  }
  return out.join('');
}
function qpBuildSetHtml(rows,setCode,serial,title,includeAnswers,isLast=true){const subject=qpSubject();const answerRows=subject==='EVS'?qpOrderEVSRows(rows):rows;const answerBlock=includeAnswers?`<div class="jnvst-page qp-answer-block"><div class="jnvst-section-head">ANSWER KEY — TEACHER COPY — SET ${esc(setCode)}</div><table class="jnvst-marks-table"><thead><tr><th>Q.No.</th><th>Answer</th><th>Topic</th></tr></thead><tbody>${answerRows.map(q=>`<tr><td>${q._number}</td><td><b>${esc(q.correct_option||'')}</b></td><td>${esc(qpTopicLabel(q))}</td></tr>`).join('')}</tbody></table></div>`:'';const breakStyle=isLast?'':'break-after:page;page-break-after:always';return `<div class="qp-set-wrapper" style="${breakStyle}"><div class="qp-paper-page"><div class="jnvst-topline"><span><span class="qp-set-serial">Serial No.: ${esc(serial)}</span><span class="qp-set-serial" style="margin-left:6px">SET ${esc(setCode)}</span></span><span>Exam Date: ${new Date().toLocaleDateString('en-IN')}</span></div><div class="jnvst-header"><div class="jnvst-title">SWARUP SIR'S KNOWLEDGE HUB</div><div class="jnvst-subtitle">${esc(title)}</div></div><table class="jnvst-fields"><tr><td class="label">Name</td><td>&nbsp;</td><td class="label">Roll No.</td><td>&nbsp;</td></tr><tr><td class="label">Time</td><td>________________</td><td class="label">Marks</td><td>${rows.length}</td></tr></table><div class="jnvst-directions"><b>Instructions:</b> Read each question carefully and choose the correct option. Questions containing images already include their options where applicable.</div>${qpIsCommonMode()?qpBuildCommonHtml(rows):subject==='EVS'?qpBuildEVSHtml(rows):qpState.mode==='passages'?qpBuildPassageHtml(rows):subject==='ARITHMETIC'?qpBuildArithmeticHtml(rows):rows.map(qpHtmlQuestion).join('')}<div class="qp-paper-footer"><span>Serial No.: ${esc(serial)}</span><span>SET ${esc(setCode)}</span><span>(c)Swarup Sir, Ph: 98643-90279</span><span>Classroom OMR Exam Question Paper. Copy-wright materials.</span></div></div>${answerBlock}</div>`;}
function qpBuildAnswerWorkbook(variants,title,baseSerial){
  const wb=XLSX.utils.book_new();
  const info=[['Question Set Serial No.',baseSerial],['Paper Title',title],['Subject',qpSubject()],['Language',qpCurrentLanguage()],['Generated On',new Date().toLocaleString('en-IN')],['Number of Sets',variants.length],['Questions per Set',variants[0]?.rows?.length||0],['Selection Mode',qpIsCommonMode()?'Common / MAT — 5 Parts':qpState.mode==='passages'?'Passage Sets':'Mandatory + Random Questions']];
  const wsInfo=XLSX.utils.aoa_to_sheet(info);XLSX.utils.book_append_sheet(wb,wsInfo,'Paper Info');
  const max=variants[0]?.rows?.length||0;
  const answerMatrix=[['Q.No.',...variants.map(v=>`SET ${v.setCode}`)]];
  for(let i=0;i<max;i++)answerMatrix.push([i+1,...variants.map(v=>String(v.rows[i]?.correct_option||'').toUpperCase())]);
  const ws=XLSX.utils.aoa_to_sheet(answerMatrix);XLSX.utils.book_append_sheet(wb,ws,'Answer Key');
  variants.forEach(v=>{
    const mapping=[['Set Q.No.','Question ID','Original Question No.','Topic','Correct Option','Selection Type']];
    v.rows.forEach(q=>mapping.push([q._number,q.id||'',q._masterNumber||'',qpTopicLabel(q),String(q.correct_option||'').toUpperCase(),q._selectionType||'']));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(mapping),`SET ${v.setCode} Map`);
  });
  const credits=XLSX.utils.aoa_to_sheet([['Question Set Serial No.',baseSerial],['Sets Prepared',variants.map(v=>`SET ${v.setCode}`).join(', ')],[],['(c)Swarup Sir, Ph: 98643-90279'],['Classroom OMR Exam Question Paper. Copy-wright materials.']]);XLSX.utils.book_append_sheet(wb,credits,'Credits');
  return wb;
}
async function downloadSelectedAnswerKeyExcel(){
  try{
    let variants=qpState.lastSetVariants;
    let baseSerial=qpState.multiSetSerial||'';
    let count=variants?.length||0;
    if(!variants||!variants.length){
      const master=qpMasterRows();
      count=await qpAskSetCountModal(qpRequestedSetCount());
      if(count===null)return;
      variants=qpBuildSetVariants(master,count);
      const qcReports=variants.map(v=>qpValidatePaperQuality(v.rows,qpSubject(),`SET ${v.setCode}`));
      if(qcReports.some(r=>r.errors.length)){qpShowQualityControl(qcReports,true);return;}
      baseSerial=qpGetSetSerial(JSON.stringify({subject:qpSubject(),language:qpCurrentLanguage(),mode:qpState.mode,selected:[...qpState.selected].sort(),counts:qpState.commonCounts,sets:count}));
      qpState.lastSetVariants=variants;qpState.multiSetSerial=baseSerial;qpState.historyMasterRows=master.map(q=>({...q}));
    }
    const qcReports=variants.map(v=>qpValidatePaperQuality(v.rows,qpSubject(),`SET ${v.setCode}`));
    if(qcReports.some(r=>r.errors.length)){qpShowQualityControl(qcReports,true);return;}
    const title=document.getElementById('qpTitle')?.value||'JNVST Practice Question Paper';const wb=qpBuildAnswerWorkbook(variants,title,baseSerial);
    XLSX.writeFile(wb,`answer-key-${baseSerial}.xlsx`);
  }catch(e){notify('Could not create Answer Key Excel: '+(e.message||e));}
}
async function qpLoadDocxLibrary(){
  if(window.docx&&window.docx.Document)return window.docx;
  if(window.__qpDocxPromise)return window.__qpDocxPromise;
  window.__qpDocxPromise=new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>/docx@/i.test(s.src));
    if(existing){existing.addEventListener('load',()=>window.docx?resolve(window.docx):reject(new Error('Word document library did not load.')));existing.addEventListener('error',()=>reject(new Error('Could not load Word document library.')));return;}
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
    script.async=true;
    script.onload=()=>window.docx?resolve(window.docx):reject(new Error('Word document library did not load.'));
    script.onerror=()=>reject(new Error('Could not load Word document library. Please check your internet connection.'));
    document.head.appendChild(script);
  });
  return window.__qpDocxPromise;
}
async function qpFetchImageData(url){
  if(!url)return null;
  try{
    const r=await fetch(url,{mode:'cors'});if(!r.ok)throw new Error('image fetch failed');
    const b=await r.arrayBuffer();
    let mime='image/png';
    try{mime=r.headers.get('content-type')||mime}catch(_){ }
    let width=0,height=0;try{const bmp=await createImageBitmap(new Blob([b]));width=bmp.width;height=bmp.height;bmp.close&&bmp.close();}catch(_){}
    return {data:b,mime,width,height};
  }catch(e){return null;}
}
function qpDocxOptions(q,d){
  const {Paragraph,TextRun,Table,TableRow,TableCell,WidthType,BorderStyle}=d;
  const vals=[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]].map(([l,t])=>[l,qpPlainMath(t)]);
  const cells=vals.map(([letter,text])=>new TableCell({children:[new Paragraph({children:[new TextRun({text:`(${letter}) `,bold:true}),new TextRun({text:String(text||'')})]})],width:{size:50,type:WidthType.PERCENT}}));
  return new Table({rows:[new TableRow({children:[cells[0],cells[1]]}),new TableRow({children:[cells[2],cells[3]]})],width:{size:100,type:WidthType.PERCENT},borders:{top:{style:BorderStyle.SINGLE,size:4,color:'D9E2EC'},bottom:{style:BorderStyle.SINGLE,size:4,color:'D9E2EC'},left:{style:BorderStyle.SINGLE,size:4,color:'D9E2EC'},right:{style:BorderStyle.SINGLE,size:4,color:'D9E2EC'},insideHorizontal:{style:BorderStyle.SINGLE,size:4,color:'E5E7EB'},insideVertical:{style:BorderStyle.SINGLE,size:4,color:'E5E7EB'}}});
}
async function qpDocxQuestionBlocks(q,d){
  const {Paragraph,TextRun,ImageRun}=d;
  const blocks=[];
  blocks.push(new Paragraph({spacing:{before:120,after:60},children:[new TextRun({text:`${q._number}. `,bold:true,color:'1D4ED8'}),new TextRun({text:qpPlainMath(q.question_text)})]}));
  if(q.image_url){
    const img=await qpFetchImageData(q.image_url);
    if(img){
      const type=/jpe?g/i.test(img.mime)?'jpg':'png';
      blocks.push(new Paragraph({alignment:d.AlignmentType.CENTER,spacing:{after:100},children:[new ImageRun({data:img.data,transformation:(()=>{const mw=480,mh=300;let w=img.width||500,h=img.height||280;const k=Math.min(mw/w,mh/h,1);return{width:Math.round(w*k),height:Math.round(h*k)};})(),type})]}));
    }
  }
  if(!q.image_url)blocks.push(qpDocxOptions(q,d));
  return blocks;
}
async function downloadSelectedQuestionPaperWord(){
  try{
    const rows=qpPrepareRows();
    if(!rows.length)return notify('Please select questions or passage sets first.');
    if(!qpQualityGate(rows,'Word Export'))return;
    const d=await qpLoadDocxLibrary();
    const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,AlignmentType,BorderStyle,Footer,PageNumber}=d;
    const title=document.getElementById('qpTitle')?.value||'JNVST Practice Question Paper';
    const serial=qpCurrentSetSerial();
    const setCode=document.getElementById('qpSetCode')?.value||qpState.setCode||'A';
    const children=[];
    children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:40},children:[new TextRun({text:`Question Paper Serial No.: ${serial}`,bold:true,size:20,color:'B91C1C'})]}));
    children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:60},children:[new TextRun({text:`QUESTION PAPER SET: SET ${setCode}`,bold:true,size:18,color:'17365D'})]}));
    children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:80},children:[new TextRun({text:'SWARUP SIR\'S KNOWLEDGE HUB',bold:true,size:30,color:'17365D'})]}));
    children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:50},children:[new TextRun({text:title,bold:true,size:25,color:'1D4ED8'})]}));
    children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:160},children:[new TextRun({text:'QUESTION PAPER',bold:true,size:20,color:'FFFFFF',shading:{fill:'2563EB'}})]}));
    const fields=new Table({width:{size:100,type:WidthType.PERCENT},rows:[
      new TableRow({children:[new TableCell({children:[new Paragraph({children:[new TextRun({text:'Name: ',bold:true}),new TextRun({text:'________________________________'})]})]}),new TableCell({children:[new Paragraph({children:[new TextRun({text:'Roll No.: ',bold:true}),new TextRun({text:'________________'})]})]})]}),
      new TableRow({children:[new TableCell({children:[new Paragraph({children:[new TextRun({text:'Time: ',bold:true}),new TextRun({text:'________________'})]})]}),new TableCell({children:[new Paragraph({children:[new TextRun({text:'Marks: ',bold:true}),new TextRun({text:String(rows.length)})]})]})]})
    ],borders:{top:{style:BorderStyle.SINGLE,size:6,color:'B7C9E2'},bottom:{style:BorderStyle.SINGLE,size:6,color:'B7C9E2'},left:{style:BorderStyle.SINGLE,size:6,color:'B7C9E2'},right:{style:BorderStyle.SINGLE,size:6,color:'B7C9E2'},insideHorizontal:{style:BorderStyle.SINGLE,size:4,color:'D9E2EC'},insideVertical:{style:BorderStyle.SINGLE,size:4,color:'D9E2EC'}}});
    children.push(fields);
    children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:70,after:80},children:[new TextRun({text:``,bold:true,size:18,color:'B91C1C'})]}));
    children.push(new Paragraph({spacing:{before:160,after:160},children:[new TextRun({text:'Instructions: ',bold:true}),new TextRun({text:'Read each question carefully and choose the correct option. Questions containing images already include their options where applicable.'})]}));
    if(qpIsCommonMode()){
      let current='';
      for(const q of rows){
        if(q._partHeading!==current){current=q._partHeading;children.push(new Paragraph({pageBreakBefore:current!=='PART I — PATTERN COMPLETION',spacing:{before:180,after:80},children:[new TextRun({text:current,bold:true,size:22,color:'1D4ED8'})]}));}
        const blocks=await qpDocxQuestionBlocks(q,d);children.push(...blocks);
      }
    }else if(qpState.mode==='passages'){
      const passageRows=subject==='EVS'?qpOrderEVSRows(rows):rows;
      const seen=new Set();let passageNumber=0;
      for(const q of passageRows){
        const pid=q._passageGroup||q.passage_id;
        if(pid&&!seen.has(pid)){
          seen.add(pid);passageNumber++;
          children.push(new Paragraph({pageBreakBefore:passageNumber>1,spacing:{before:180,after:60},children:[new TextRun({text:`Passage ${passageNumber}`,bold:true,size:22,color:'1D4ED8'})]}));
          children.push(new Paragraph({spacing:{after:70},children:[new TextRun({text:qpNorm(q._passageTitle||q.passage_title)||'Passage',bold:true,size:20})]}));
          children.push(new Paragraph({spacing:{after:130},children:[new TextRun({text:qpPlainMath(q._passageText||q.passage_text||'')})]}));
        }
        const blocks=await qpDocxQuestionBlocks(q,d);children.push(...blocks);
      }
    }else{
      for(const q of rows){const blocks=await qpDocxQuestionBlocks(q,d);children.push(...blocks);}
    }
    const doc=new Document({sections:[{properties:{page:{margin:{top:454,right:680,bottom:567,left:680}}},children,footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`Serial No.: ${serial}  •  SET ${setCode}  •  (c)Swarup Sir, Ph: 98643-90279  •  Page `,size:16,color:'64748B'}),new TextRun({children:[PageNumber.CURRENT],size:16,color:'64748B'})]})]})}}]});
    const blob=await Packer.toBlob(doc);
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${serial}-${title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'question-paper'}.docx`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
  }catch(e){notify('Could not create Word file: '+(e.message||e));}
}
function qpHistoryDate(v){
  if(!v)return '—';
  try{return new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'medium'});}catch(_){return String(v);}
}
async function saveGeneratedQuestionPaper(rows){
  if(qpState.savedHistoryId)return qpState.savedHistoryId;
  const title=document.getElementById('qpTitle')?.value||'JNVST Practice Question Paper';
  const setCode=document.getElementById('qpSetCode')?.value||qpState.setCode||'A';
  const subject=qpSubject();
  const language=qpCurrentLanguage();
  const serial=qpCurrentSetSerial();
  const snapshot={
    rows: rows.map(q=>({...q})),
    subject,language,mode:qpState.mode,setCode,serial,title,
    questionOrder:document.getElementById('qpOrder')?.value||'random',
    master_rows: Array.isArray(qpState.historyMasterRows)?qpState.historyMasterRows.map(q=>({...q})):null
  };
  const payload={
    teacher_id:current.id,title,serial_no:serial,set_code:setCode,subject,language,
    mode:qpState.mode||'',question_count:rows.length,total_marks:rows.length,
    paper_snapshot:snapshot,
    answer_key_snapshot:{rows:qpBuildAnswerRows(rows),serial,title,subject,language,set_code:setCode}
  };
  const {data,error}=await sb.from('jnvst_generated_question_papers').insert(payload).select('id,generated_at').single();
  if(error)throw error;
  qpState.savedHistoryId=data.id;
  return data.id;
}
function qpSavedAnswerBlock(rows,subject){
  const answerRows=String(subject||'').toUpperCase()==='EVS'?qpOrderEVSRows(rows):rows;
  return `<div class="jnvst-page"><div class="jnvst-section-head">ANSWER KEY — TEACHER COPY</div><table class="jnvst-marks-table"><thead><tr><th>Q.No.</th><th>Answer</th><th>Topic</th></tr></thead><tbody>${answerRows.map(q=>`<tr><td>${q._number}</td><td><b>${esc(q.correct_option||'')}</b></td><td>${esc(qpTopicLabel(q))}</td></tr>`).join('')}</tbody></table></div>`;
}
function qpOpenSavedPaper(record,includeAnswers){
  const snap=record.paper_snapshot||{};
  const rows=Array.isArray(snap.rows)?snap.rows:[];
  if(!rows.length)return notify('This saved paper does not contain question data.');
  const title=record.title||snap.title||'JNVST Practice Question Paper';
  const serial=record.serial_no||snap.serial||'';
  const setCode=record.set_code||snap.setCode||'A';
  const subject=record.subject||snap.subject||'';
  const answerBlock=includeAnswers?qpSavedAnswerBlock(rows,subject):'';
  const body=`<div class="qp-paper-page"><div class="jnvst-topline"><span><span class="qp-set-serial">Serial No.: ${esc(serial)}</span><span class="qp-set-serial" style="margin-left:6px">SET ${esc(setCode)}</span></span><span>Generated: ${esc(qpHistoryDate(record.generated_at))}</span></div><div class="jnvst-header"><div class="jnvst-title">SWARUP SIR'S KNOWLEDGE HUB</div><div class="jnvst-subtitle">${esc(title)}</div></div><table class="jnvst-fields"><tr><td class="label">Subject</td><td>${esc(subject)}</td><td class="label">Language</td><td>${esc(record.language||snap.language||'')}</td></tr><tr><td class="label">Questions</td><td>${rows.length}</td><td class="label">Marks</td><td>${rows.length}</td></tr></table><div class="jnvst-directions"><b>Instructions:</b> Read each question carefully and choose the correct option.</div>${snap.mode==='mat'?qpBuildCommonHtml(rows):subject==='EVS'?qpBuildEVSHtml(rows):snap.mode==='passages'?qpBuildPassageHtml(rows):subject==='ARITHMETIC'?qpBuildArithmeticHtml(rows):rows.map(qpHtmlQuestion).join('')}<div class="qp-paper-footer"><span>Serial No.: ${esc(serial)}</span><span>SET ${esc(setCode)}</span><span>(c)Swarup Sir, Ph: 98643-90279</span></div></div>${answerBlock}`;
  const w=qpOpenPrintWindow();
  if(!w)return;
  qpWritePrintWindow(w,title,body);
}
function qpHistoryGroupKey(serial){return String(serial||'').replace(/-[ABCD]$/,'')||'UNKNOWN';}
function qpHistoryGroupDate(v){try{return new Date(v).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}catch(_){return 'Unknown Date';}}
async function qpLoadHistoryRecords(){const {data,error}=await sb.from('jnvst_generated_question_papers').select('*').eq('teacher_id',current.id).order('generated_at',{ascending:false}).limit(300);if(error)throw error;return data||[];}
function qpHistorySetCodes(records){return [...new Set(records.map(r=>r.set_code).filter(Boolean))].sort();}
async function loadGeneratedQuestionPaperHistory(){const el=document.getElementById('qpGeneratedHistory');if(!el)return;try{const data=await qpLoadHistoryRecords();if(!data.length){el.innerHTML='<p class="muted">No generated question papers have been saved yet.</p>';return;}const dates=new Map();data.forEach(r=>{const d=qpHistoryGroupDate(r.generated_at);if(!dates.has(d))dates.set(d,[]);dates.get(d).push(r);});let html='';for(const [date,rows] of dates){const groups=new Map();rows.forEach(r=>{const key=qpHistoryGroupKey(r.serial_no);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);});html+=`<div class="qp-history-date"><h3>📅 ${esc(date)}</h3>`;for(const [key,rs0] of groups){const rs=[...rs0].sort((a,b)=>String(a.set_code).localeCompare(String(b.set_code)));const first=rs[0],codes=qpHistorySetCodes(rs);const label=codes.length>1?codes.map(c=>`SET ${c}`).join(', '):`SET ${codes[0]||first.set_code||'A'}`;html+=`<div class="qp-history-group"><div class="qp-history-group-head"><div><b>${esc(first.title||'Question Paper')}</b><div class="small muted">${esc(first.subject||'')} · ${esc(first.language||'')} · ${esc(qpHistoryDate(first.generated_at))} · ${esc(label)}</div></div><div class="actions"><button class="secondary" onclick="viewGeneratedQuestionPaperGroup('${esc(key)}')">📄 All Questions</button><button class="secondary" onclick="downloadGeneratedAnswerKeyExcelGroup('${esc(key)}')">📊 All Answer Key Excel</button><button style="background:#dc2626" onclick="deleteGeneratedQuestionPaperGroup('${esc(key)}')">🗑 Delete All</button></div></div><div class="qp-history-sets">${rs.map(r=>`<div class="qp-history-set"><span><b>SET ${esc(r.set_code||'A')}</b> · ${Number(r.question_count||0)} questions · ${esc(r.serial_no||'')}</span><span class="actions"><button class="secondary" onclick="viewGeneratedQuestionPaper('${r.id}')">Paper</button><button class="secondary" onclick="viewGeneratedQuestionPaper('${r.id}',true)">Answer Key</button><button class="secondary" onclick="deleteGeneratedQuestionPaper('${r.id}')">Delete</button></span></div>`).join('')}</div></div>`;}html+='</div>';}el.innerHTML=html;}catch(e){el.innerHTML=`<div class="notice">${esc(e.message||e)}<br><span class="small">Run the JNVST generated question paper history SQL migration if the table does not exist.</span></div>`;}}
async function viewGeneratedQuestionPaper(id,answers=false){
  const {data,error}=await sb.from('jnvst_generated_question_papers').select('*').eq('id',id).eq('teacher_id',current.id).single();
  if(error)return notify('Could not load saved paper: '+error.message);
  qpOpenSavedPaper(data,answers);
}
async function deleteGeneratedQuestionPaper(id){
  if(!confirm('Delete this generated question paper and its answer key? This cannot be undone.'))return;
  const {error}=await sb.from('jnvst_generated_question_papers').delete().eq('id',id).eq('teacher_id',current.id);
  if(error)return notify('Could not delete saved paper: '+error.message);
  if(qpState.savedHistoryId===id)qpState.savedHistoryId=null;
  loadGeneratedQuestionPaperHistory();
}
function qpResetAllSelections(){if(!confirm('Reset all current Question Paper Generation selections? Previously generated papers will not be deleted.'))return;qpState.selected=new Set();qpState.selectedPassages=new Set();qpState.selectedTopics=new Set();qpState.selectedLessons=new Set();qpState.topicLimits={};qpState.commonCounts=Object.fromEntries(QP_COMMON_PARTS.map(x=>[x.part,4]));qpState.setCount=4;qpState.setCode='A';qpState.lastRows=null;qpState.lastSignature='';qpState.lastSerial='';qpState.savedHistoryId=null;qpState.lastSetVariants=null;qpState.multiSetSerial='';const title=document.getElementById('qpTitle');if(title)title.value='JNVST Practice Question Paper';const order=document.getElementById('qpOrder');if(order)order.value='random';const answers=document.getElementById('qpPdfAnswers');if(answers)answers.value='no';const subject=document.getElementById('qpSubject');if(subject)subject.value='MAT';const language=document.getElementById('qpLanguage');if(language)language.value='ASSAMESE';qpState.subject='MAT';qpState.language='COMMON';qpState.mode='mat';qpRenderGeneratorMode();qpRefreshSubjectSummary();}
async function qpGetHistoryGroupRecords(baseSerial){const {data,error}=await sb.from('jnvst_generated_question_papers').select('*').eq('teacher_id',current.id).like('serial_no',`${baseSerial}-%`).order('set_code',{ascending:true});if(error)throw error;return data||[];}
function qpBuildAllQuestionsHtml(rows,title,serial){const numbered=qpAssignNumbers(rows||[]);return `<div class="qp-set-wrapper"><div class="qp-paper-page"><div class="jnvst-topline"><span><span class="qp-set-serial">Serial No.: ${esc(serial)}</span><span class="qp-set-serial" style="margin-left:6px">ALL QUESTIONS</span></span><span>Exam Date: ${new Date().toLocaleDateString('en-IN')}</span></div><div class="jnvst-header"><div class="jnvst-title">SWARUP SIR'S KNOWLEDGE HUB</div><div class="jnvst-subtitle">${esc(title)} — ALL GENERATED QUESTIONS</div></div><table class="jnvst-fields"><tr><td class="label">Subject</td><td>${esc(qpSubject())}</td><td class="label">Questions</td><td>${numbered.length}</td></tr></table><div class="jnvst-directions"><b>Master Question Set:</b> These are the questions selected before SET A/SET B/SET C/SET D randomization.</div>${qpSubject()==='ARITHMETIC'?qpBuildArithmeticHtml(numbered):qpIsCommonMode()?qpBuildCommonHtml(numbered):qpSubject()==='EVS'?qpBuildEVSHtml(numbered):qpState.mode==='passages'?qpBuildPassageHtml(numbered):numbered.map(qpHtmlQuestion).join('')}<div class="qp-paper-footer"><span>Serial No.: ${esc(serial)}</span><span>ALL QUESTIONS</span><span>(c)Swarup Sir, Ph: 98643-90279</span></div></div></div>`;}
async function viewGeneratedQuestionPaperGroup(baseSerial){try{const records=await qpGetHistoryGroupRecords(baseSerial);if(!records.length)return notify('No saved sets were found for this generation.');const first=records[0],title=first.title||'JNVST Practice Question Paper';const master=Array.isArray(first.paper_snapshot?.master_rows)?first.paper_snapshot.master_rows:null;const variants=records.map(r=>({setCode:r.set_code||'A',rows:(r.paper_snapshot?.rows||[]).map((q,i)=>({...q,_number:i+1}))}));const css=[...document.querySelectorAll('style')].map(s=>s.textContent||'').join('\n');const body=(master&&master.length?qpBuildAllQuestionsHtml(master,title,baseSerial):'')+variants.map((v,i)=>qpBuildSetHtml(v.rows,v.setCode,`${baseSerial}-${v.setCode}`,title,false,i===variants.length-1)).join('');const w=qpOpenPrintWindow();if(!w)return;qpWritePrintWindow(w,`${title} — All Sets`,body);}catch(e){notify('Could not open all saved sets: '+(e.message||e));}}
function qpBuildSavedAnswerWorkbook(records){const wb=XLSX.utils.book_new(),first=records[0]||{},title=first.title||'JNVST Practice Question Paper',base=qpHistoryGroupKey(first.serial_no),variants=records.map(r=>({setCode:r.set_code||'A',rows:(r.paper_snapshot?.rows||[]).map((q,i)=>({...q,_number:i+1}))}));XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Question Set Serial No.',base],['Paper Title',title],['Subject',first.subject||''],['Language',first.language||''],['Generated On',first.generated_at?qpHistoryDate(first.generated_at):new Date().toLocaleString('en-IN')],['Number of Sets',records.length],['Questions per Set',Number(first.question_count||0)]]),'Paper Info');const max=Math.max(0,...variants.map(v=>v.rows.length)),matrix=[['Q.No.',...variants.map(v=>`SET ${v.setCode}`)]];for(let i=0;i<max;i++)matrix.push([i+1,...variants.map(v=>v.rows[i]?.correct_option||'')]);XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(matrix),'Answer Key');for(const v of variants)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(qpBuildAnswerRows(v.rows)),`SET ${v.setCode}`);return new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
async function downloadGeneratedAnswerKeyExcelGroup(baseSerial){try{const records=await qpGetHistoryGroupRecords(baseSerial);if(!records.length)return notify('No saved sets were found for this generation.');const blob=qpBuildSavedAnswerWorkbook(records),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${baseSerial}-All-Answer-Key.xlsx`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200);}catch(e){notify('Could not create Answer Key Excel: '+(e.message||e));}}
async function deleteGeneratedQuestionPaperGroup(baseSerial){if(!confirm(`Delete all generated sets for ${baseSerial}, including all saved question papers and answer-key data? This cannot be undone.`))return;try{const {error}=await sb.from('jnvst_generated_question_papers').delete().eq('teacher_id',current.id).like('serial_no',`${baseSerial}-%`);if(error)throw error;loadGeneratedQuestionPaperHistory();}catch(e){notify('Could not delete generated paper group: '+(e.message||e));}}
async function generateSelectedQuestionPaper(){
  let w=null;
  try{
    const master=qpMasterRows();
    const count=await qpAskSetCountModal(qpRequestedSetCount());
    if(count===null)return;
    w=qpOpenPrintWindow();
    if(!w)return;
    const variants=qpBuildSetVariants(master,count);
    const qcReports=variants.map(v=>qpValidatePaperQuality(v.rows,qpSubject(),`SET ${v.setCode}`));
    if(qcReports.some(r=>r.errors.length)){ try{w.close();}catch(_){} qpShowQualityControl(qcReports,true); return; }
    const title=document.getElementById('qpTitle')?.value||'JNVST Practice Question Paper';
    const baseSerial=qpGetSetSerial(JSON.stringify({subject:qpSubject(),language:qpCurrentLanguage(),mode:qpState.mode,selected:[...qpState.selected].sort(),counts:qpState.commonCounts,sets:count}));
    qpState.lastSetVariants=variants;qpState.multiSetSerial=baseSerial;
    const includeAnswers=document.getElementById('qpPdfAnswers')?.value==='yes';
    const saveErrors=[];
    for(const v of variants){
      const rows=v.rows.map((q,i)=>({...q,_masterNumber:master.findIndex(m=>m.id===q.id)+1,_number:i+1}));
      try{
        const oldSet=qpState.setCode;const oldSerial=qpState.lastSerial;const oldSignature=qpState.lastSignature;
        qpState.savedHistoryId=null;qpState.setCode=v.setCode;qpState.lastSerial=`${baseSerial}-${v.setCode}`;qpState.lastSignature='MULTISET';
        await saveGeneratedQuestionPaper(rows);
        qpState.savedHistoryId=null;qpState.setCode=oldSet;qpState.lastSerial=oldSerial;qpState.lastSignature=oldSignature;
      }catch(e){saveErrors.push(`SET ${v.setCode}: ${e.message||e}`);qpState.savedHistoryId=null;}
    }
    if(saveErrors.length)notify('The paper will still open, but some sets could not be saved to Generated History:\n'+saveErrors.join('\n')+'\n\nRun jnvst_generated_question_paper_history.sql in Supabase if the table does not exist.');
    loadGeneratedQuestionPaperHistory();
    const setHtml=variants.map((v,i)=>{
      const rows=v.rows.map((q,n)=>({...q,_number:n+1,_masterNumber:master.findIndex(m=>m.id===q.id)+1}));
      return qpBuildSetHtml(rows,v.setCode,`${baseSerial}-${v.setCode}`,title,includeAnswers,i===variants.length-1);
    }).join('').replace(/style="break-after:page;page-break-after:always"(?=\s*<div class="jnvst-page")/g,'style="break-after:page;page-break-after:always"');
    qpWritePrintWindow(w,`${title} — ${variants.map(v=>`SET ${v.setCode}`).join(', ')}`,setHtml);
  }catch(e){try{if(w)w.close();}catch(_){}notify('Could not generate Question Paper Sets: '+(e.message||e));}
}
async function editMockQuestion(id){
 const {data:q,error}=await sb.from('mock_question_bank').select('*').eq('id',id).eq('teacher_id',current.id).single();
 if(error)return notify(error.message);
 const partOptions=MOCK_PLAN.filter(x=>x.upload===q.source_type||x.upload==='excel'||x.upload==='pdf');
 const img=q.image_url||'';
 render(`<div class="wrap">${header('Edit Mock Question')}
  <div class="card">
   <div class="notice"><b>School-type Question Editor for Mock Tests:</b> Edit normal text and mathematical expressions in the same visual editor used by <b>Edit JNVST Question</b>. Use the Equation Editor for fractions, powers, roots, symbols, matrices and other mathematical expressions.</div>

   <div class="grid">
    <div><label>Part / Question Bank</label><select id="emqPart">${partOptions.map(x=>`<option value="${x.part}" ${x.part===q.part_code?'selected':''}>${esc(x.label)}</option>`).join('')}</select></div>
    <div><label>Topic</label><input id="emqTopic" value="${esc(q.topic||mockPartLabel(q.part_code))}" placeholder="Topic"></div>
    <div><label>Question Language</label><select id="emqLanguage"><option value="COMMON" ${String(q.language||'').toUpperCase()==='COMMON'?'selected':''}>Common (MAT)</option><option value="ASSAMESE" ${String(q.language||'').toUpperCase()==='ASSAMESE'?'selected':''}>Assamese</option><option value="ENGLISH" ${String(q.language||'').toUpperCase()==='ENGLISH'?'selected':''}>English</option></select></div>
   </div>

   <div class="jnvst-editor-section">
    <h3>1. Question Content</h3>
    <div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('emqQuestion')">∑ Equation Editor</button><span class="eq-hint">Insert fractions, powers, roots, symbols, matrices and other mathematical expressions.</span></div>
    <textarea id="emqQuestion" rows="7" placeholder="Type the question here. Use the Equation Editor for mathematical expressions." oninput="jnvstRefreshMathPreview('emqQuestionPreview',this.value)">${esc(q.question_text&&q.question_text!=='[IMAGE QUESTION]'?q.question_text:'')}</textarea>
    <div id="emqQuestionPreview" class="eq-preview">${jnvstMathPreview(q.question_text&&q.question_text!=='[IMAGE QUESTION]'?q.question_text:'')}</div>

    <label>Question Diagram / Image (optional)</label>
    <input id="emqImage" type="file" accept="image/*" onchange="mockPreviewEditImage(this)">
    <div id="emqImagePreview" style="margin-top:8px">${img?`<img class="jnvst-editor-image" src="${esc(img)}" alt="Question image"><div class="small muted" style="margin-top:5px">Current image. Select a new image to replace it.</div>`:'<div class="small muted">No question image attached. You can upload a diagram or figure here.</div>'}</div>
    ${img?`<label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input id="emqRemoveImage" type="checkbox" style="width:auto"> Remove current image</label>`:''}
   </div>

   <div class="jnvst-editor-section">
    <h3>2. Options & Correct Answer</h3>
    <div class="grid">${['A','B','C','D'].map(o=>`<div><label>Option ${o}</label><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('emq${o}')">∑ Equation Editor</button><span class="eq-hint">Visual math editor</span></div><textarea id="emq${o}" rows="3" oninput="jnvstRefreshMathPreview('emq${o}Preview',this.value)" placeholder="Option ${o}">${esc(q['option_'+o.toLowerCase()]||'')}</textarea><div id="emq${o}Preview" class="eq-preview">${jnvstMathPreview(q['option_'+o.toLowerCase()]||'')}</div></div>`).join('')}</div>
    <div class="grid"><div><label>Correct Answer</label><select id="emqAnswer"><option value="A" ${q.correct_option==='A'?'selected':''}>A</option><option value="B" ${q.correct_option==='B'?'selected':''}>B</option><option value="C" ${q.correct_option==='C'?'selected':''}>C</option><option value="D" ${q.correct_option==='D'?'selected':''}>D</option></select></div></div>
   </div>

   <div class="jnvst-editor-section">
    <h3>3. Passage (optional)</h3>
    <label>Passage Title</label><input id="emqPassageTitle" value="${esc(q.passage_title||'')}" placeholder="Optional passage title">
    <div class="eq-toolbar" style="margin-top:10px"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('emqPassage')">∑ Equation Editor</button><span class="eq-hint">You can include mathematical expressions in the passage.</span></div>
    <textarea id="emqPassage" rows="7" placeholder="Optional passage text..." oninput="jnvstRefreshMathPreview('emqPassagePreview',this.value)">${esc(q.passage_text||'')}</textarea>
    <div id="emqPassagePreview" class="eq-preview">${jnvstMathPreview(q.passage_text||'')}</div>
   </div>

   <div class="actions" style="margin-top:16px"><button onclick="saveMockQuestionEdit('${q.id}')">💾 Save Changes</button><button class="secondary" onclick="mockBankSummary()">Cancel</button></div>
  </div></div>`);
 jnvstTypesetWhenReady([document.getElementById('jnvstMathModal'),document.getElementById('jqQuestion')]);
}
function mockPreviewEditImage(input){const box=document.getElementById('emqImagePreview'),file=input.files?.[0];if(!box||!file)return;if(!file.type.startsWith('image/')){input.value='';return notify('Please select an image file.');}if(file.size>10*1024*1024){input.value='';return notify('Image size must be 10 MB or less.');}const url=URL.createObjectURL(file);box.innerHTML=`<img class="jnvst-editor-image" src="${url}" alt="New question image"><div class="small muted">New image selected.</div>`;const rm=document.getElementById('emqRemoveImage');if(rm)rm.checked=false;}
async function saveMockQuestionEdit(id){try{const {data:q,error:qe}=await sb.from('mock_question_bank').select('*').eq('id',id).eq('teacher_id',current.id).single();if(qe)throw qe;let imageUrl=q.image_url||null;const file=document.getElementById('emqImage')?.files?.[0];const removeImage=!!document.getElementById('emqRemoveImage')?.checked;if(file){imageUrl=await uploadMockFile(file,`${current.id}/edited-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`)}else if(removeImage){imageUrl=null}const newPart=document.getElementById('emqPart').value;const newPlan=mockPlanByPart[newPart];const payload={section_code:newPlan.section,part_code:newPart,topic:document.getElementById('emqTopic').value.trim()||mockPartLabel(newPart),language:newPlan.section==='MAT'?'COMMON':document.getElementById('emqLanguage').value,question_text:document.getElementById('emqQuestion').value.trim()||null,option_a:document.getElementById('emqA').value.trim()||null,option_b:document.getElementById('emqB').value.trim()||null,option_c:document.getElementById('emqC').value.trim()||null,option_d:document.getElementById('emqD').value.trim()||null,correct_option:document.getElementById('emqAnswer').value,passage_title:document.getElementById('emqPassageTitle').value.trim()||null,passage_text:document.getElementById('emqPassage').value.trim()||null,image_url:imageUrl};const {error}=await sb.from('mock_question_bank').update(payload).eq('id',id).eq('teacher_id',current.id);if(error)throw error;notify('Question updated successfully.');mockBankSummary()}catch(e){notify('Could not update question: '+(e.message||e))}}
async function toggleMockQuestion(id,active){const {error}=await sb.from('mock_question_bank').update({active}).eq('id',id).eq('teacher_id',current.id);if(error)return notify(error.message);mockBankSummary()}
async function deleteMockQuestion(id){if(!confirm('Delete this question from your question bank? It will not affect questions already copied into generated mock tests.'))return;const {error}=await sb.from('mock_question_bank').delete().eq('id',id).eq('teacher_id',current.id);if(error)return notify(error.message);mockBankSummary()}
function mockSortQuestions(a,b){
 const ad=Date.parse(a.created_at||'')||0,bd=Date.parse(b.created_at||'')||0;
 if(ad!==bd)return ad-bd;
 const ao=Number(a.question_order??a.source_question_no??999999),bo=Number(b.question_order??b.source_question_no??999999);
 if(ao!==bo)return ao-bo;
 return String(a.id||'').localeCompare(String(b.id||''));
}
async function generateMockTestPage(language){
 if(language) window.mockGeneratorLanguage=language;
 const generatorLanguage=window.mockGeneratorLanguage||'ASSAMESE';
 const {data:classes,error}=await sb.from('classes').select('id,name').eq('teacher_id',current.id).order('name');
 if(error)return notify(error.message);
 if(!classes?.length)return notify('Create a class first.');
 const {data:bank,error:be}=await sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).eq('active',true);
 if(be)return notify(be.message);
 const byPart={};(bank||[]).forEach(q=>{const lang=String(q.language||'').toUpperCase();if(q.section_code==='MAT'){if(lang==='COMMON'||!lang)(byPart[q.part_code]||=[]).push(q)}else if(lang===generatorLanguage){(byPart[q.part_code]||=[]).push(q)}});
 const setInfo={};
 const shortages=[];
 for(const plan of MOCK_PLAN){
  const sets=mockBuildSets(byPart[plan.part]||[],plan);
  setInfo[plan.part]=sets;
  if(!sets.length)shortages.push(plan);
 }
 if(shortages.length)return notify('Question bank is incomplete or has no complete set/passage group:\n\n'+shortages.map(x=>x.unit==='passage'?`${x.label}: need at least 1 complete passage group of ${x.count} questions`:`${x.label}: need at least ${x.count} usable questions for one complete set`).join('\n'));
 const sectionGroups=[
  ['MAT','Mental Ability Test (MAT)'],
  ['EVS','Environmental Studies (EVS)'],
  ['ARITHMETIC','Arithmetic'],
  ['LANGUAGE','Language']
 ];
 render(`<div class="wrap">${header('Generate Mock Test')}<div class="card">
  <label>Test Title</label><input id="mtTitle" value="Mock Test">
  <label>Time Limit</label><input value="2 Hours (120 minutes)" disabled>
  <label>Test Language</label><select id="mtLanguage" onchange="generateMockTestPage(this.value)"><option value="ASSAMESE" ${generatorLanguage==='ASSAMESE'?'selected':''}>Assamese</option><option value="ENGLISH" ${generatorLanguage==='ENGLISH'?'selected':''}>English</option></select><div class="notice small"><b>MAT is common:</b> MAT questions are shared by both languages. EVS, Arithmetic and Language will be selected only from the chosen language bank.</div><label>Question Selection</label><select id="mtMode"><option value="fixed">Fixed test — same 80 questions for all assigned students</option></select>
  <div class="card" style="background:#f8fafc;border:2px solid #2563eb;margin-top:15px">
   <h3>📚 Select Question Sets</h3>
   <p class="small muted">Choose exactly which set/group should be used from each question bank. The selected sets are copied into the generated test and will be the same for all assigned students.</p>
   <div class="actions" style="margin-bottom:10px">
    <button type="button" class="secondary" onclick="document.querySelectorAll('.mock-set-select').forEach(x=>x.selectedIndex=0)">Set 1 for all</button>
    <button type="button" class="secondary" onclick="document.querySelectorAll('.mock-set-select').forEach(x=>x.value='random')">Random available set</button>
   </div>
   ${sectionGroups.map(([code,name])=>`<div style="margin:12px 0 6px"><b>${esc(name)}</b></div>${MOCK_PLAN.filter(x=>x.section===code).map(x=>`<div class="assignment" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:6px 0;padding:9px"><div><b>${esc(x.label)}</b><div class="small muted">${x.section==='LANGUAGE'&&x.groupCount?`${x.groupCount} passages × ${x.passageCount} questions`:`${x.count} question(s) per set`}</div></div><select id="mockSet_${x.part}" class="mock-set-select" style="min-width:210px;width:auto"><option value="random">Random set</option>${setInfo[x.part].map(st=>`<option value="${st.number}" ${st.number===1?'selected':''}>${esc(st.label)}</option>`).join('')}</select></div>`).join('')}`).join('')}
  </div>
  <h3>Assign To</h3><p class="small muted">Select multiple classes. For each class choose entire class or selected students.</p>
  <div class="actions" style="margin-bottom:10px"><button type="button" class="secondary" onclick="document.querySelectorAll('.mock-class').forEach(x=>x.checked=true);loadMockAssignStudents()">Select all classes</button><button type="button" class="secondary" onclick="document.querySelectorAll('.mock-class').forEach(x=>x.checked=false);loadMockAssignStudents()">Clear all</button></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">${classes.map(c=>`<label style="padding:9px;border:1px solid #dbe3ee;border-radius:10px;background:#fff"><input class="mock-class" type="checkbox" value="${c.id}" onchange="loadMockAssignStudents()" style="width:auto;margin-right:8px"><b>${esc(c.name)}</b></label>`).join('')}</div>
  <div id="mockAssignPicker" class="card" style="background:#f8fafc;margin-top:15px"><span class="muted">Select classes above.</span></div>
  <div class="card" style="background:#f8fafc"><h3>Question Blueprint</h3>${MOCK_PLAN.map(x=>`<div class="assignment" style="margin:6px 0;padding:9px"><b>${esc(x.label)}</b> — ${x.section==='LANGUAGE'&&x.groupCount?`${x.groupCount} passages × ${x.passageCount} questions`:`${x.count} ${x.unit==='passage'?'questions from 1 complete passage group':'questions'}`} · <b>${setInfo[x.part].length} set(s) available</b></div>`).join('')}</div>
  <div class="actions"><button onclick="createMockTest()">Generate & Assign 80-Question Test</button><button class="secondary" onclick="mockTestManagement()">Cancel</button></div>
 </div></div>`)
}
async function loadMockAssignStudents(){const box=document.getElementById('mockAssignPicker');if(!box)return;const ids=[...document.querySelectorAll('.mock-class:checked')].map(x=>x.value);if(!ids.length){box.innerHTML='<span class="muted">Select classes above.</span>';return}box.innerHTML='Loading students…';const {data:m,error}=await sb.from('class_students').select('class_id,student_id').in('class_id',ids);if(error){box.innerHTML=message(error.message);return}const sids=[...new Set((m||[]).map(x=>x.student_id))];const {data:students,error:e}=await sb.from('profiles').select('id,full_name,username').in('id',sids).order('full_name');if(e){box.innerHTML=message(e.message);return}const by=new Map();(m||[]).forEach(x=>{if(!by.has(x.class_id))by.set(x.class_id,[]);by.get(x.class_id).push(x.student_id)});box.innerHTML=ids.map(cid=>{const name=document.querySelector(`.mock-class[value="${cid}"]`)?.parentElement.querySelector('b')?.textContent||cid;const list=(by.get(cid)||[]).map(id=>students.find(s=>s.id===id)).filter(Boolean);return `<div class="assignment"><h3>${esc(name)}</h3><label><input type="radio" name="mockMode_${cid}" value="class" checked onchange="document.getElementById('mockStudents_${cid}').style.display='none'" style="width:auto;margin-right:6px">Entire class</label> <label><input type="radio" name="mockMode_${cid}" value="students" onchange="document.getElementById('mockStudents_${cid}').style.display='block'" style="width:auto;margin-right:6px">Selected students</label><div id="mockStudents_${cid}" style="display:none;margin-top:8px">${list.map(s=>`<label style="display:block;padding:5px"><input class="mock-student" data-class-id="${cid}" type="checkbox" value="${s.id}" style="width:auto;margin-right:6px">${esc(s.full_name)} <span class="muted small">${esc(s.username||'')}</span></label>`).join('')||'<span class="muted">No students.</span>'}</div></div>`}).join('')}
async function createMockTest(){
 const title=document.getElementById('mtTitle').value.trim();
 if(!title)return notify('Enter a test title.');
 const selected=[...document.querySelectorAll('.mock-class:checked')].map(x=>x.value);
 if(!selected.length)return notify('Select at least one class.');
 let studentIds=[];
 for(const cid of selected){
  const mode=document.querySelector(`input[name="mockMode_${cid}"]:checked`)?.value||'class';
  if(mode==='class'){
   const {data:m,error}=await sb.from('class_students').select('student_id').eq('class_id',cid);
   if(error)throw error;studentIds.push(...(m||[]).map(x=>x.student_id));
  }else studentIds.push(...[...document.querySelectorAll(`.mock-student[data-class-id="${cid}"]:checked`)].map(x=>x.value));
 }
 studentIds=[...new Set(studentIds)];
 if(!studentIds.length)return notify('No students were selected.');
 try{
  const {data:bank,error:be}=await sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).eq('active',true);
  if(be)throw be;
  const selectedLanguage=document.getElementById('mtLanguage')?.value||'ASSAMESE';
  const byPart={};(bank||[]).forEach(q=>{const lang=String(q.language||'').toUpperCase();if(q.section_code==='MAT'){if(lang==='COMMON'||!lang)(byPart[q.part_code]||=[]).push(q)}else if(lang===selectedLanguage){(byPart[q.part_code]||=[]).push(q)}});
  const chosenSets={};
  for(const plan of MOCK_PLAN){
   const sets=mockBuildSets(byPart[plan.part]||[],plan);
   if(!sets.length)throw new Error(`${plan.label} has no complete set available.`);
   const value=document.getElementById(`mockSet_${plan.part}`)?.value||'random';
   if(plan.section==='LANGUAGE' && plan.groupCount){
    const wanted=Number(plan.groupCount);
    if(sets.length<wanted)throw new Error(`${plan.label}: need ${wanted} complete passages of ${plan.passageCount||5} questions; only ${sets.length} available.`);
    let chosen;
    if(value==='random'){
      const shuffled=[...sets].sort(()=>Math.random()-0.5);
      chosen=shuffled.slice(0,wanted);
    }else{
      const first=sets.find(x=>String(x.number)===String(value));
      if(!first)throw new Error(`${plan.label}: selected passage is no longer available.`);
      const rest=sets.filter(x=>x!==first).sort((a,b)=>String(a.set_id).localeCompare(String(b.set_id)));
      chosen=[first,...rest].slice(0,wanted);
    }
    chosenSets[plan.part]=chosen;
   }else{
    const set=value==='random'?sets[Math.floor(Math.random()*sets.length)]:sets.find(x=>String(x.number)===String(value));
    if(!set)throw new Error(`${plan.label}: selected set is no longer available.`);
    chosenSets[plan.part]=set;
   }
  }
  const {data:test,error:te}=await sb.from('mock_tests').insert({teacher_id:current.id,title,language:selectedLanguage,time_limit_seconds:7200,status:'published'}).select().single();
  if(te)throw te;
  let qrows=[];
  for(const plan of MOCK_PLAN){
   const selectedGroups=plan.section==='LANGUAGE' && plan.groupCount ? chosenSets[plan.part] : [chosenSets[plan.part]];
   const selectedQs=selectedGroups.flatMap(g=>g.questions);
   const expected=plan.count;
   if(selectedQs.length!==expected)throw new Error(`${plan.label}: selected groups must contain exactly ${expected} questions.`);
   if(plan.unit==='passage'){
    // Store the complete passage on every question in the passage group.
    // This also repairs banks where only one question row contains the passage text.
    for(const group of selectedGroups){
     const groupQuestions=group.questions||[];
     const passageText=groupQuestions.map(x=>String(x.passage_text||'').trim()).find(Boolean)||'';
     groupQuestions.forEach(q=>qrows.push({mock_test_id:test.id,bank_question_id:q.id,question_number:0,section_code:q.section_code,part_code:q.part_code,question_text:q.question_text,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,correct_option:q.correct_option,passage_id:q.passage_id||null,passage_title:q.passage_title||null,passage_text:passageText||q.passage_text||null,image_url:q.image_url,marks:1.25}));
    }
   }else{
    qrows.push(...selectedQs.map(q=>({mock_test_id:test.id,bank_question_id:q.id,question_number:0,section_code:q.section_code,part_code:q.part_code,question_text:q.question_text,option_a:q.option_a,option_b:q.option_b,option_c:q.option_c,option_d:q.option_d,correct_option:q.correct_option,passage_id:q.passage_id||null,passage_title:q.passage_title||null,passage_text:q.passage_text,image_url:q.image_url,marks:1.25})));
   }
  }
  qrows.forEach((q,i)=>q.question_number=i+1);
  const {error:qe}=await sb.from('mock_test_questions').insert(qrows);if(qe)throw qe;
  const recipients=studentIds.map(student_id=>({mock_test_id:test.id,student_id}));
  const {error:re}=await sb.from('mock_test_students').insert(recipients);if(re)throw re;
  const summary=MOCK_PLAN.map(x=>`${x.label}: ${Array.isArray(chosenSets[x.part])?chosenSets[x.part].map(g=>g.label).join(', '):chosenSets[x.part].label}`).join('\n');
  notify(`Mock Test generated successfully.\n\n80 questions\n100 marks\n2 hours\nAssigned to ${recipients.length} student(s).\n\nSelected sets:\n${summary}`);
  mockTestManagement();
 }catch(e){notify('Could not generate Mock Test: '+(e.message||e))}
}
function qpPlainMath(v,dollars=true){
  let s=String(v??'');
  s=s.replace(/<br\s*\/?\s*>/gi,'\n');
  s=s.replace(/\\\\(?=[()\[\]a-zA-Z])/g,'\\');
  if(dollars){s=s.replace(/\$\$([\s\S]*?)\$\$/g,'$1').replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g,'$1');}
  s=s.replace(/\\[()\[\]]/g,'');
  for(let n=0;n<4;n++){
    s=s.replace(/(\d)\s*\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,'$1 $2/$3');
    s=s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,(m,a,b)=>/^[\w.]+$/.test(a)&&/^[\w.]+$/.test(b)?a+'/'+b:'('+a+')/('+b+')');
    s=s.replace(/\\sqrt\s*\{([^{}]*)\}/g,'√($1)');
    s=s.replace(/\\(?:text|mathrm|mathbf|textbf|mbox)\s*\{([^{}]*)\}/g,'$1');
  }
  const sup={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
  s=s.replace(/\^\{([0-9-]+)\}|\^([0-9])/g,(m,a,b)=>[...(a||b)].map(c=>sup[c]||c).join(''));
  s=s.replace(/\^\{([^{}]*)\}/g,'^($1)').replace(/_\{([^{}]*)\}/g,'_$1');
  const map={times:'×',div:'÷',cdot:'·',pi:'π',leq:'≤',le:'≤',geq:'≥',ge:'≥',neq:'≠',ne:'≠',pm:'±',mp:'∓',circ:'°',degree:'°',angle:'∠',triangle:'△',infty:'∞',approx:'≈',therefore:'∴',quad:' ',qquad:'  ',left:'',right:''};
  s=s.replace(/\\([a-zA-Z]+)/g,(m,c)=>Object.prototype.hasOwnProperty.call(map,c)?map[c]:m);
  s=s.replace(/\\[,;!]/g,' ').replace(/\\ /g,' ');
  return s.replace(/[ \t]{2,}/g,' ');
}
function qpSanitizeMath(s){
  s=String(s??'');
  // doubled backslashes from Excel/JSON imports:  \\( -> \(   \\text -> \text
  s=s.replace(/\\\\(?=[()\[\]])/g,'\\');
  s=s.replace(/\\\\(?=(?:text|frac|dfrac|tfrac|sqrt|times|div|cdot|pi|leq|geq|neq|pm|circ|left|right)\b)/g,'\\');
  // stray single backslashes from broken imports (e.g. "\10 cm", trailing "\")
  s=s.replace(/\\(?=\d)/g,'').replace(/\\\s*$/,'');
  // keep only properly paired \( ... \) delimiters
  const toks=[],re=/\\\(|\\\)/g;let m;while((m=re.exec(s)))toks.push({i:m.index,t:m[0]});
  if(toks.length){
    const keep=new Set();let pend=null;
    for(const k of toks){if(k.t==='\\('){pend=k;}else if(pend){keep.add(pend);keep.add(k);pend=null;}}
    let out='',last=0;for(const k of toks){out+=s.slice(last,k.i);if(keep.has(k))out+=k.t;last=k.i+2;}
    s=out+s.slice(last);
  }
  // Assamese/Bengali words must never sit inside math mode (they render as garbled italic glyphs)
  s=s.replace(/\\\(([\s\S]*?)\\\)/g,(all,inner)=>{
    if(!/[\u0980-\u09FF]/.test(inner))return all;
    inner=inner.replace(/\\text\{([^{}]*[\u0980-\u09FF][^{}]*)\}/g,'$1');
    return inner.split(/([\u0980-\u09FF\u200c\u200d]+(?:[ \t.,;:।?'"()\-]*[\u0980-\u09FF\u200c\u200d]+)*)/).map((p,i)=>i%2===1?p:(p.trim()?'\\('+p+'\\)':p)).join('');
  });
  return s;
}
function qpPopupRuntime(){
  const status=document.getElementById('qpPrintStatus'),banner=document.getElementById('qpPrintBanner');
  const say=(t,warn)=>{if(status)status.textContent=t;if(banner&&warn)banner.classList.add('warn');};
  const LEFT=/\\[()\[\]]|\\(?:text|frac|dfrac|tfrac|sqrt|times|div|cdot|pi|leq|geq|neq|pm|circ|left|right|mathrm)\b|\^\{/;
  const loadScript=(src,ms)=>new Promise(res=>{let done=false;const f=ok=>{if(!done){done=true;res(ok);}};const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>f(true);s.onerror=()=>f(false);setTimeout(()=>f(false),ms);document.head.appendChild(s);});
  const waitFor=async(test,ms)=>{const t0=Date.now();while(Date.now()-t0<ms){try{if(test())return true;}catch(_){}await new Promise(r=>setTimeout(r,60));}return false;};
  const plainFallback=root=>{
    const nodes=[],w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>{const p=n.parentElement;if(!p||p.closest('mjx-container,script,style'))return NodeFilter.FILTER_REJECT;return LEFT.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;}});
    while(w.nextNode())nodes.push(w.currentNode);
    nodes.forEach(n=>{n.nodeValue=qpPlainMath(n.nodeValue,false);});
    return nodes.length;
  };
  (async()=>{
    const root=document.querySelector('.jnvst-paper');
    let mathOk=false;
    try{
      say('Loading maths engine…');
      window.MathJax={tex:{inlineMath:[['\\(','\\)']],displayMath:[['\\[','\\]']],processEscapes:true},options:{skipHtmlTags:['script','noscript','style','textarea','pre','code']},startup:{typeset:false}};
      const urls=window.__QP_MATHJAX_URLS||['https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js','https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-chtml.js','https://unpkg.com/mathjax@3.2.2/es5/tex-chtml.js'];
      let loaded=false;for(const u of urls){if(await loadScript(u,15000)&&await waitFor(()=>window.MathJax&&window.MathJax.typesetPromise,6000)){loaded=true;break;}}
      if(loaded){
        say('Typesetting maths…');
        await window.MathJax.startup.promise;
        await window.MathJax.typesetPromise([root]);
        // any expression MathJax could not parse -> readable plain text instead of an error box
        try{(window.MathJax.startup.document.math||[]).forEach(it=>{const r=it.typesetRoot;if(r&&r.querySelector&&r.querySelector('mjx-merror,[data-mjx-error]')){r.replaceWith(document.createTextNode(qpPlainMath(it.math,false)));}});}catch(_){}
        mathOk=true;
      }
    }catch(e){console.error('MathJax failed',e);}
    const leftovers=plainFallback(root);
    if(!mathOk)say('Maths engine unavailable (offline?). Simple text version used for formulas.',true);
    say(mathOk?'Waiting for images…':'Waiting for images… (formulas shown as plain text)',!mathOk);
    const imgs=[...document.images];
    imgs.forEach(i=>{i.loading='eager';});
    await Promise.all(imgs.map(img=>new Promise(res=>{if(img.complete)return res();img.onload=res;img.onerror=res;setTimeout(res,20000);})));
    const broken=imgs.filter(i=>!i.naturalWidth).length;
    try{if(document.fonts&&document.fonts.ready)await document.fonts.ready;}catch(_){}
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const extra=[];if(broken)extra.push(broken+' image(s) could not be loaded');if(leftovers&&mathOk)extra.push(leftovers+' formula(s) converted to plain text');
    say('Ready — '+imgs.length+' image(s) loaded'+(extra.length?' · '+extra.join(' · '):'')+'.',broken>0);
    window.__qpReady=true;
    setTimeout(()=>{try{window.focus();window.print();}catch(_){}} ,300);
  })();
}
function qpPrintDocHtml(title,css,body){
  return `<!doctype html><html class="qp-print-root"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style><style>@page{size:A4 portrait;margin:0}</style></head><body><div id="qpPrintBanner" class="qp-noprint qp-banner"><b id="qpPrintStatus">Preparing…</b><span>In the print dialog choose <b>Paper size: A4</b>, <b>Margins: None</b>, <b>Scale: 100%</b>, tick <b>Print backgrounds</b>.</span><button type="button" onclick="window.print()">🖨 Print / Save as PDF</button></div><div class="jnvst-paper">${body}</div><script>${qpPlainMath.toString()};(${qpPopupRuntime.toString()})();<\/script></body></html>`;
}
function qpWritePrintWindow(w,title,body){
  const css=[...document.querySelectorAll('style')].map(s=>s.textContent||'').join('\n');
  w.document.open();w.document.write(qpPrintDocHtml(title,css,body));w.document.close();
}
function qpOpenPrintWindow(){
  const w=window.open('','_blank','width=1100,height=900');
  if(!w){notify('Your browser blocked the pop-up.\n\nFirefox: click the shield/pop-up icon in the address bar and choose "Allow pop-ups for this site", then try again.');return null;}
  try{w.document.write('<!doctype html><title>Preparing…</title><body style="font-family:Arial,sans-serif;padding:30px">Preparing question paper…</body>');}catch(_){}
  return w;
}
function qpAskSetCountModal(defaultCount=4){
  return new Promise(resolve=>{
    const ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML=`<div style="background:#fff;border-radius:14px;max-width:380px;width:100%;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.3)"><h3 style="margin:0 0 6px">How many question sets?</h3><p class="muted small" style="margin:0 0 12px">The same questions are re-ordered randomly into each set (SET A–D), each with its own answer key.</p><div class="actions" style="gap:8px">${[1,2,3,4].map(n=>`<button type="button" data-n="${n}" class="${n===defaultCount?'':'secondary'}">${n}</button>`).join('')}</div><div class="actions" style="margin-top:14px"><button type="button" class="secondary" data-cancel="1">Cancel</button></div></div>`;
    const onKey=e=>{if(e.key==='Escape')done(null);};
    const done=v=>{ov.remove();document.removeEventListener('keydown',onKey);if(v!==null)qpState.setCount=v;resolve(v);};
    ov.addEventListener('click',e=>{const b=e.target.closest('button');if(b)done(b.dataset.cancel?null:Number(b.dataset.n));else if(e.target===ov)done(null);});
    document.addEventListener('keydown',onKey);document.body.appendChild(ov);
  });
}
function jnvstPdfMathHtml(v){
  let s=String(v??'');
  if(!s)return '';
  // Normalize all common teacher/Excel formats before inserting into the paper.
  // MathJax 3 does not treat single-dollar delimiters as math by default, so
  // convert $...$ / $$...$$ to the explicit \( ... \) / \[ ... \] forms.
  s=s.replace(/\$\$(.*?)\$\$/gs,'\\[$1\\]');
  s=s.replace(/(?<!\\)\$(?!\$)(.*?)(?<!\\)\$/gs,'\\($1\\)');
  s=s.replace(/\\\$/g,'$');
  // Imported bilingual School questions may contain literal HTML line-break tags.
  // Treat those tags as line breaks instead of printing the tag text (e.g. <br>).
  s=s.replace(/<br\s*\/?\s*>/gi,'\n');
  s=jnvstNormalizeMathText(s);
  s=qpSanitizeMath(s);
  const safe=esc(s).replace(/\n/g,'<br>');
  return safe.replace(/\\\((.*?)\\\)/gs,'\\($1\\)').replace(/\\\[(.*?)\\\]/gs,'\\[$1\\]');
}
function jnvstPdfEscape(v){
  return jnvstPdfMathHtml(v);
}
function jnvstPdfOption(q,o){
  const v=q?.['option_'+o.toLowerCase()];
  return `<div class="jnvst-option"><b>(${o})</b> ${jnvstPdfEscape(v||'')}</div>`;
}
function jnvstPdfQuestion(q){
  const hasImage=!!String(q?.image_url||'').trim();
  // MAT / image-based questions contain the question figure AND all four
  // answer figures inside the uploaded image. Do not print database option
  // text underneath the image, otherwise the same options appear twice.
  const part=String(q?.part_code||'').toUpperCase();
  const section=String(q?.section_code||'').toUpperCase();
  const isMAT=part.startsWith('MAT_') || section==='MAT';
  const showTextOptions=!hasImage || !isMAT;
  const opts=showTextOptions
    ? `<div class="jnvst-options">${['A','B','C','D'].map(o=>jnvstPdfOption(q,o)).join('')}</div>`
    : '';
  return `<div class="jnvst-question">
    <div class="jnvst-qrow">
      <div class="jnvst-qnum">${q.question_number}.</div>
      <div class="jnvst-qbody">
        ${q.image_url?`<img class="jnvst-question-image" src="${esc(q.image_url)}" alt="">`:''}
        ${q.question_text?`<div class="jnvst-qtext">${jnvstPdfEscape(q.question_text)}</div>`:''}
        ${opts}
      </div>
    </div>
  </div>`;
}
function jnvstPdfGroupQuestions(qs){
  return qs.map(jnvstPdfQuestion).join('');
}
function jnvstPdfPart(code,title,directions,qs){
  return `<div class="jnvst-part-head">${esc(title)}</div>
    <div class="jnvst-directions"><b>Directions :</b> ${esc(directions)}</div>
    ${jnvstPdfGroupQuestions(qs)}`;
}
function jnvstPdfPassage(passageTitle,text){
  if(!text)return '';
  return `<div class="jnvst-passage"><div class="jnvst-passage-title">${esc(passageTitle||'Passage')}</div><div>${jnvstPdfEscape(text)}</div></div>`;
}
function jnvstPdfQuestionSection(qs){
  // Keep passage together with its five associated questions. A passage is
  // printed once even though the same passage metadata is stored on all five rows.
  const out=[];
  const seen=new Set();
  for(const q of qs){
    const pid=String(q.passage_id||'');
    if(pid && !seen.has(pid)){
      seen.add(pid);
      out.push(jnvstPdfPassage(q.passage_title,q.passage_text));
    }
    out.push(jnvstPdfQuestion(q));
  }
  return out.join('');
}
function jnvstPdfGeneralInstructions(){
  return `<div class="jnvst-instructions">
    <h3>GENERAL INSTRUCTIONS FOR CANDIDATES</h3>
    <ol>
      <li>You are given a Test Booklet as well as an OMR (Optical Mark Recognition) Answer Sheet. The Test Booklet contains 80 questions serially numbered from 1 to 80. Count the pages of the Test Booklet and be sure that they are in proper order. Ensure that the Serial No. and the Code of the Test Booklet and the OMR Answer Sheet are same. In case of mismatch/defect/discrepancy in the Test Booklet and OMR Answer Sheet, report to your Invigilator and get the Test Booklet and OMR Answer Sheet replaced.</li>
      <li>Answers are to be marked only in the OMR Answer Sheet as per the example given below. Candidates are required to indicate their answers at an appropriate place on the OMR Answer Sheet. Darken only one circle for each question as per the instructions given on Side-1 of the OMR Answer Sheet.</li>
      <li>For each question, there are four probable answers, out of which only one is correct. The candidate is required to select the correct answer and darken the corresponding circle of the chosen answer.</li>
      <li>Only Blue/Black Ballpoint Pen is to be used to write on the OMR Answer Sheet. Candidates should bring their own Ballpoint Pen. Use of pencil is strictly prohibited.</li>
      <li>The test will be of two hours duration from 11:30 a.m. to 01:30 p.m. and will have three sections with objective-type questions.</li>
      <li>Additional time of 40 minutes will be allowed for “Divyang students” (differently-abled students).</li>
      <li>A single Test Booklet comprising all the three sections will be given to each candidate.</li>
      <li>There are 80 questions in all for 100 marks as per details below. 15 minutes additional time is allowed for reading the instructions from 11:15 a.m. to 11:30 a.m.</li>
    </ol>
    <table class="jnvst-marks-table">
      <thead><tr><th>Type of Test</th><th>Sections</th><th>Number of Questions</th><th>Marks</th></tr></thead>
      <tbody>
        <tr><td>Mental Ability Test + EVS</td><td>Section - I</td><td>From 1 to 40 = 40 Questions</td><td>50</td></tr>
        <tr><td>Arithmetic Test</td><td>Section - II</td><td>From 41 to 60 = 20 Questions</td><td>25</td></tr>
        <tr><td>Language Test</td><td>Section - III</td><td>From 61 to 80 = 20 Questions</td><td>25</td></tr>
        <tr><td><b>Total</b></td><td></td><td><b>80</b></td><td><b>100</b></td></tr>
      </tbody>
    </table>
    <ol start="9">
      <li>All questions are to be attempted. Every question carries equal marks.</li>
      <li>You must attempt questions of each section because you have to qualify in each Section separately.</li>
      <li><b>Section-I has two Parts.</b> Part 1 contains 20 Mental Ability questions and Part 2 contains 20 EVS questions.</li>
      <li>Overwriting, striking, cutting, applying white/correction fluid and erasing on the OMR Answer Sheet is not allowed. Such answers will not be evaluated. Do not make any stray mark on the OMR Answer Sheet.</li>
      <li>No change in the darkened circle is allowed once marked in the OMR Answer Sheet.</li>
      <li>Rough work must not be done on the OMR Answer Sheet. Use the rough-work page of the Test Booklet for rough work.</li>
      <li>A bell will be rung after every 30 minutes.</li>
      <li>No negative marking will be done.</li>
    </ol>
  </div>`;
}
function jnvstPdfBookletMeta(test){
  // Deterministic per Mock Test: the same test always gets the same booklet
  // number/code, while different tests normally receive different values.
  const raw=String(test?.id||test?.title||'JNVST');
  let h=2166136261;
  for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}
  h>>>=0;
  const bookletNo=String(100000+(h%900000));
  const codes=['A','B','C','D'];
  const code=codes[h%4];
  return {bookletNo,code};
}
async function generateMockTestPDF(testId){
  const w=window.open('','_blank','width=1000,height=900');
  if(!w){notify('The browser blocked the PDF preview window. Please allow pop-ups for this site and try again.');return;}
  w.document.write('<!doctype html><html><head><title>Preparing question paper...</title></head><body style="font-family:Arial,sans-serif;padding:30px">Preparing JNVST-style question paper…</body></html>');
  try{
    const [{data:test,error:te},{data:qs,error:qe}]=await Promise.all([
      sb.from('mock_tests').select('id,title,language,time_limit_seconds,created_at').eq('id',testId).eq('teacher_id',current.id).single(),
      sb.from('mock_test_questions').select('*').eq('mock_test_id',testId).order('question_number')
    ]);
    if(te)throw te;
    if(qe)throw qe;
    if(!qs?.length)throw new Error('No generated questions were found for this Mock Test.');
    const booklet=jnvstPdfBookletMeta(test);
    const lang=test.language==='ENGLISH'?'ENGLISH':test.language==='ASSAMESE'?'ASSAMESE':'COMMON';
    const byPart={};
    qs.forEach(q=>(byPart[q.part_code]??=[]).push(q));

    const matOrder=['MAT_PATTERN','MAT_SERIES','MAT_GEOMETRICAL','MAT_MIRROR','MAT_EMBEDDED'];
    const matQs=matOrder.flatMap(p=>byPart[p]||[]);
    const evsMcq=(byPart.EVS_MCQ||[]).sort((a,b)=>a.question_number-b.question_number);
    const evsPass=(byPart.EVS_PASSAGE||[]).sort((a,b)=>a.question_number-b.question_number);
    const arithmetic=(byPart.ARITHMETIC||[]).sort((a,b)=>a.question_number-b.question_number);
    const language=(byPart.LANGUAGE_PASSAGE||[]).sort((a,b)=>a.question_number-b.question_number);

    const partGroups=[
      ['MAT_PATTERN','Part 1 — Mental Ability (Pattern / Odd Figure)','MAT_PATTERN'],
      ['MAT_SERIES','Mental Ability — Part A','MAT_SERIES'],
      ['MAT_GEOMETRICAL','Mental Ability — Part B','MAT_GEOMETRICAL'],
      ['MAT_MIRROR','Mental Ability — Part C','MAT_MIRROR'],
      ['MAT_EMBEDDED','Mental Ability — Part D','MAT_EMBEDDED']
    ];

    const firstPage=`<div class="jnvst-page">
      <div class="jnvst-topline"><span>Test Booklet No. <b>${booklet.bookletNo}</b></span><span>Test Booklet Code <b>${booklet.code}</b></span></div>
      <div class="jnvst-header">
        <div class="jnvst-title">JAWAHAR NAVODAYA VIDYALAYA SELECTION TEST — STYLE MOCK PAPER</div>
        <div class="jnvst-subtitle">CLASS VI — MOCK TEST</div>
        <div class="jnvst-mock-badge">${esc(test.title||'MOCK TEST')}</div>
      </div>
      <table class="jnvst-fields">
        <tr><td class="label">Test Booklet No.</td><td class="jnvst-booklet-number">${booklet.bookletNo}</td><td class="label">Test Booklet Code</td><td class="jnvst-booklet-code">${booklet.code}</td></tr>
        <tr><td class="label">Roll Number</td><td colspan="3" class="jnvst-roll-box"></td></tr>
        <tr><td class="label">Name of the Candidate</td><td colspan="3">&nbsp;</td></tr>
        <tr><td class="label">Signature of the Candidate</td><td colspan="3">&nbsp;</td></tr>
        <tr><td class="label">Time</td><td>2 Hours</td><td class="label">Maximum Marks</td><td>100</td></tr>
      </table>
      ${jnvstPdfGeneralInstructions()}
      <div class="jnvst-first-page-credit"><span>Swarup Sir's Knowledge Hub</span><span>(c)Swarup Sir, Ph: 98643-90279</span></div>
      <div class="jnvst-footer"><span>${esc(test.title||'JNVST Mock Test')}</span><span>Page 1</span></div>
    </div>`;

    let pages=firstPage;
    // Section I — Part 1: all 20 MAT questions. Keep the original directions
    // for the five 4-question figure types as subheadings.
    let matHtml=`<div class="jnvst-page"><div class="jnvst-section-head">SECTION — I<br>PART — 1<br>MENTAL ABILITY TEST</div>`;
    const dirByPart=Object.fromEntries(partGroups.map(x=>[x[0],JNVST_PDF_DIRECTIONS[x[0]]]));
    const subTitles={
      MAT_PATTERN:'Sub-Part A — Questions 1 to 4',
      MAT_SERIES:'Sub-Part B — Questions 5 to 8',
      MAT_GEOMETRICAL:'Sub-Part C — Questions 9 to 12',
      MAT_MIRROR:'Sub-Part D — Questions 13 to 16',
      MAT_EMBEDDED:'Sub-Part E — Questions 17 to 20'
    };
    for(const [code] of partGroups){
      const arr=(byPart[code]||[]).sort((a,b)=>a.question_number-b.question_number);
      if(arr.length){
        matHtml+=`<div class="jnvst-part-head">${subTitles[code]}</div><div class="jnvst-directions"><b>Directions :</b> ${esc(dirByPart[code]||'')}</div>${jnvstPdfGroupQuestions(arr)}`;
      }
    }
    matHtml+=`<div class="jnvst-footer"><span>${esc(test.title||'JNVST Mock Test')}</span><span>Section I — Part 1</span></div></div>`;
    pages+=matHtml;

    // Section I — Part 2: EVS. Standalone 15 questions followed by one passage
    // and five passage-based questions.
    let evsHtml=`<div class="jnvst-page"><div class="jnvst-section-head">SECTION — I<br>PART — 2<br>ENVIRONMENTAL STUDIES (EVS)</div>`;
    evsHtml+=`<div class="jnvst-directions"><b>Directions :</b> ${esc(JNVST_PDF_DIRECTIONS.EVS)}</div>`;
    evsHtml+=jnvstPdfGroupQuestions(evsMcq);
    if(evsPass.length){
      evsHtml+=jnvstPdfPassage(evsPass[0].passage_title||'Passage',evsPass[0].passage_text||'');
      evsHtml+=jnvstPdfGroupQuestions(evsPass);
    }
    evsHtml+=`<div class="jnvst-footer"><span>${esc(test.title||'JNVST Mock Test')}</span><span>Section I — Part 2</span></div></div>`;
    pages+=evsHtml;

    // Section II — Arithmetic
    let arHtml=`<div class="jnvst-page"><div class="jnvst-section-head">SECTION — II<br>ARITHMETIC TEST</div>
      <div class="jnvst-directions"><b>Directions :</b> ${esc(JNVST_PDF_DIRECTIONS.ARITHMETIC)}</div>
      <div class="jnvst-two-col">${jnvstPdfGroupQuestions(arithmetic)}</div>
      <div class="jnvst-footer"><span>${esc(test.title||'JNVST Mock Test')}</span><span>Section II</span></div></div>`;
    pages+=arHtml;

    // Section III — Language, preserving each passage before its five questions.
    let langHtml=`<div class="jnvst-page"><div class="jnvst-section-head">SECTION — III<br>LANGUAGE TEST</div>
      <div class="jnvst-directions"><b>Directions :</b> ${esc(JNVST_PDF_DIRECTIONS.LANGUAGE)}</div>
      ${jnvstPdfQuestionSection(language)}
      <div class="jnvst-footer"><span>${esc(test.title||'JNVST Mock Test')}</span><span>Section III</span></div></div>`;
    pages+=langHtml;

    pages+=`<div class="jnvst-page"><div class="jnvst-code"><span>${esc(test.title||'JNVST Mock Test')}</span><span>ROUGH WORK</span></div><div class="jnvst-rough">SPACE FOR ROUGH WORK</div><div class="jnvst-footer"><span>Use this page for rough work only.</span><span>Last Page</span></div></div>`;

    // Reuse the application's inline styles in the print window.
    // The previous implementation referenced an undefined `css_add` variable,
    // which caused PDF generation to fail before the print preview opened.
    const css_add=[...document.querySelectorAll('style')].map(s=>s.textContent||'').join('\n');
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(test.title||'JNVST Mock Test')} - Question Paper</title><style>${css_add}</style></head><body><div class="jnvst-paper">${pages}</div></body></html>`);
    w.document.close();
    const waitForImages=async()=>{
      const images=[...w.document.images];
      await Promise.all(images.map(img=>new Promise(resolve=>{
        if(img.complete)return resolve();
        img.onload=resolve;img.onerror=resolve;
      })));
      setTimeout(()=>{w.focus();w.print();},300);
    };
    await waitForImages();
  }catch(e){
    try{w.close()}catch(_){}
    notify('Could not generate the JNVST-style Question Paper PDF: '+(e.message||e));
  }
}
async function mockTeacherResults(){
  const {data:tests,error}=await sb.from('mock_tests').select('*').eq('teacher_id',current.id).order('created_at',{ascending:false});
  if(error)return notify(error.message);
  const ids=(tests||[]).map(x=>x.id);
  const {data:ats,error:ae}=await sb.from('mock_test_attempts').select('*').in('mock_test_id',ids.length?ids:['00000000-0000-0000-0000-000000000000']).order('submitted_at',{ascending:false});
  if(ae)return notify(ae.message);
  const pids=[...new Set((ats||[]).map(x=>x.student_id))];
  const {data:ps}=pids.length?await sb.from('profiles').select('id,full_name,roll_no').in('id',pids):{data:[]};
  const pm=new Map((ps||[]).map(x=>[x.id,x]));
  render(`<div class="wrap">${header('Mock Test Results')}
    <div class="card">
      <h2>📊 Mock Test Results</h2>
      <p class="muted">View student responses and generate the printable Mock Test Result Sheet.</p>
      <div style="overflow:auto"><table><thead><tr><th>Test</th><th>Student</th><th>Roll No</th><th>Language</th><th>Score</th><th>%</th><th>Status</th><th>Submitted</th><th>Report</th></tr></thead>
      <tbody>${(ats||[]).map(a=>{const t=(tests||[]).find(x=>x.id===a.mock_test_id)||{};const p=pm.get(a.student_id)||{};return `<tr><td>${esc(t.title||'')}</td><td>${esc(p.full_name||'')}</td><td>${esc(p.roll_no||'')}</td><td>${esc(t.language==='ENGLISH'?'English':t.language==='ASSAMESE'?'Assamese':'Common')}</td><td>${Number(a.score||0).toFixed(2)}</td><td>${Number(a.percentage||0).toFixed(2)}</td><td>${esc(a.status)}</td><td>${a.submitted_at?new Date(a.submitted_at).toLocaleString():'—'}</td><td>${a.status==='submitted'?`<div class="actions"><button class="secondary" onclick="viewMockTeacherAttempt('${a.id}')">👁 View Response</button><button onclick="generateMockResultPDF('${a.id}')">📄 PDF</button></div>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="9">No attempts yet.</td></tr>'}</tbody></table></div>
      <div class="actions" style="margin-top:15px;flex-wrap:wrap">${(tests||[]).map(t=>`<button class="${t.results_released?'secondary':''}" onclick="toggleMockResultsRelease('${t.id}',${t.results_released?'false':'true'})">${t.results_released?'🔒 Hide Results: ':'✓ Approve Results: '}${esc(t.title||'Mock Test')}</button>`).join('')}<button onclick="mockTestManagement()">← Mock Test Management</button><button class="secondary" onclick="teacherHome()">Dashboard</button></div>
    </div></div>`)
}
async function loadMockTeacherAttempt(attemptId){
  const {data:a,error:ae}=await sb.from('mock_test_attempts').select('*,mock_tests(*)').eq('id',attemptId).single();
  if(ae)throw ae;
  const test=a.mock_tests;
  if(!test||test.teacher_id!==current.id)throw new Error('You are not authorized to view this Mock Test attempt.');
  const [{data:qs,error:qe},{data:ans,error:ane},{data:p,error:pe}]=await Promise.all([
    sb.from('mock_test_questions').select('*').eq('mock_test_id',a.mock_test_id).order('question_number'),
    sb.from('mock_test_answers').select('question_id,selected_option').eq('attempt_id',attemptId),
    sb.from('profiles').select('id,full_name,roll_no').eq('id',a.student_id).single()
  ]);
  if(qe)throw qe;if(ane)throw ane;if(pe)throw pe;
  const amap=new Map((ans||[]).map(x=>[x.question_id,String(x.selected_option||'').toUpperCase()]));
  const rows=(qs||[]).map(q=>{const student=amap.get(q.id)||'';const key=String(q.correct_option||'').toUpperCase();return {...q,student_answer:student,correct:key,is_answered:!!student,is_correct:!!student&&student===key}});
  const subjects={};
  rows.forEach(q=>{const k=mockSubjectLabel(q.section_code);if(!subjects[k])subjects[k]={questions:0,correct:0,wrong:0,unanswered:0,marks:0};const s=subjects[k];s.questions++;if(!q.student_answer)s.unanswered++;else if(q.is_correct){s.correct++;s.marks+=Number(q.marks||1.25)}else s.wrong++});
  return {attempt:a,test,profile:p,rows,subjects};
}
function mockTeacherResponseHtml(data){
  const {attempt:a,test,profile:p,rows,subjects}=data;
  return `<div class="wrap">${header('Mock Test Response')}
    <div class="card"><div class="result-student-head"><div><h2>${esc(test.title||'Mock Test')}</h2><p class="muted"><b>${esc(p.full_name||'')}</b> · Roll No: <b>${esc(p.roll_no||'')}</b> · ${esc(test.language==='ENGLISH'?'English':test.language==='ASSAMESE'?'Assamese':'Common')}</p></div><div class="result-score"><b>${Number(a.score||0).toFixed(2)}/100</b><span>${Number(a.percentage||0).toFixed(2)}%</span></div></div>
      <div class="result-controls"><div class="grid"><div><b>Submitted</b><br>${a.submitted_at?new Date(a.submitted_at).toLocaleString():'—'}</div><div><b>Attempted</b><br>${rows.filter(q=>q.is_answered).length}/${rows.length}</div><div><b>Correct</b><br><span class="result-correct">${rows.filter(q=>q.is_correct).length}</span></div><div><b>Wrong</b><br><span class="result-wrong">${rows.filter(q=>q.is_answered&&!q.is_correct).length}</span></div><div><b>Unanswered</b><br>${rows.filter(q=>!q.is_answered).length}</div></div></div>
      <h3>Subject-wise Performance</h3><div style="overflow:auto"><table><thead><tr><th>Subject</th><th>Questions</th><th>Correct</th><th>Wrong</th><th>Unanswered</th><th>Marks</th><th>%</th></tr></thead><tbody>${Object.entries(subjects).map(([k,s])=>`<tr><td>${esc(k)}</td><td>${s.questions}</td><td class="result-correct">${s.correct}</td><td class="result-wrong">${s.wrong}</td><td>${s.unanswered}</td><td>${s.marks.toFixed(2)}</td><td>${s.questions?((s.correct/s.questions)*100).toFixed(2):'0.00'}%</td></tr>`).join('')}</tbody></table></div>
    </div>
    <div class="card"><div class="actions" style="justify-content:space-between;align-items:center"><h2 style="margin:0">Question-wise Response</h2><div class="actions"><button onclick="generateMockResultPDF('${a.id}')">📄 Generate Result PDF</button><button class="secondary" onclick="mockTeacherResults()">← Back to Results</button></div></div>
      <p class="muted small">The PDF contains only Question No., Answer Key and Student's Answer. Wrong answers are highlighted in red.</p>
      <div class="result-questions">${rows.map(q=>`<div class="result-question"><b>Q${q.question_number}</b><div class="result-answer"><span>Key: <strong class="answer-key">${esc(q.correct||'—')}</strong></span><span>Student: <strong class="${q.student_answer?(q.is_correct?'result-correct':'result-wrong'):''}">${esc(q.student_answer||'—')}</strong></span></div><span class="${q.student_answer?(q.is_correct?'result-correct':'result-wrong'):''}">${q.student_answer?(q.is_correct?'✓':'✗'):'—'}</span></div>`).join('')}</div>
    </div></div>`;
}
async function viewMockTeacherAttempt(attemptId){try{const data=await loadMockTeacherAttempt(attemptId);render(mockTeacherResponseHtml(data))}catch(e){notify('Could not load student response: '+(e.message||e))}}
async function generateMockResultPDF(attemptId){try{const data=await loadMockTeacherAttempt(attemptId);buildMockResultPDF(data)}catch(e){notify('Could not generate PDF: '+(e.message||e))}}
function jnvstBaseKey(c){
 const n=String(c?.name||"").trim().toUpperCase().replace(/\s+/g," ");
 const course=String(c?.course||"").trim().toUpperCase();
 // Treat the fixed Class VI label consistently even when older records use
 // variants such as "JNVST-VI (Class-IV)", "JNVST-VI (Class VI)" or "JNVST-6".
 if(/^JNVST\s*[- ]?(?:VI|6)(?:\s*\([^)]*\))?$/i.test(n) || n==="CLASS VI" || n==="CLASS 6" || course==="JNVST-6" && /^JNVST\s*[- ]?(?:VI|6)(?:\s*\([^)]*\))?$/i.test(n))return "JNVST-VI";
 // Treat the fixed Class IX label consistently, including common parenthetical variants.
 if(/^JNVST\s*[- ]?(?:IX|9)(?:\s*\([^)]*\))?$/i.test(n) || n==="CLASS IX" || n==="CLASS 9" || course==="JNVST-9" && /^JNVST\s*[- ]?(?:IX|9)(?:\s*\([^)]*\))?$/i.test(n))return "JNVST-IX";
 return "";
}
function jnvstSubgroupParent(c){
 const d=String(c?.description||"");
 const m=d.match(/^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)\s*\|?/i);
 return m?m[1].toUpperCase():"";
}
function isJnvstMainGroup(c){
 return !!c && String(c.jnvst_group_type||"").toUpperCase()==="MAIN" && !jnvstSubgroupParent(c);
}
function isJnvstSubGroup(c){ return !!c && (String(c.jnvst_group_type||"").toUpperCase()==="SUB" || !!jnvstSubgroupParent(c)); }
function jnvstParentId(c){
 return c?.jnvst_parent_id || "";
}
function jnvstMainGroups(classes){
 return (classes||[]).filter(c=>isJnvstMainGroup(c) || !!jnvstBaseKey(c));
}
function jnvstSubgroupsForMain(classes,main){
 const rows=classes||[];
 const byParent=main?.id ? rows.filter(c=>jnvstParentId(c)===main.id && isJnvstSubGroup(c)) : [];
 if(byParent.length) return byParent;
 const key=jnvstBaseKey(main);
 // Legacy rows may not have jnvst_parent_id yet. Only use the textual
 // marker as a fallback when no explicit child rows exist.
 return key ? rows.filter(c=>!jnvstParentId(c) && jnvstSubgroupParent(c)===key) : [];
}
async function ensureJnvstBaseClasses(allClasses){
 const existing=Array.isArray(allClasses)?allClasses.slice():[];
 const created=[];
 const bases=[
  {key:"JNVST-VI",name:"JNVST-VI (Class-IV)",course:"JNVST-6",description:"Fixed JNVST Class VI group for Class IV students preparing for JNVST VI. Create sub-groups under this group."},
  {key:"JNVST-IX",name:"JNVST-IX (Class IX)",course:"JNVST-9",description:"Fixed JNVST Class IX group. Create sub-groups under this group."}
 ];
 for(const base of bases){
  let candidates=existing.filter(c=>jnvstBaseKey(c)===base.key);
  let found=candidates
   .filter(c=>String(c.jnvst_group_type||"").toUpperCase()==="MAIN")
   .sort((a,b)=>String(a.created_at||"").localeCompare(String(b.created_at||"")))[0]
   || candidates.slice().sort((a,b)=>String(a.created_at||"").localeCompare(String(b.created_at||"")))[0];

  if(!found){
   const {data,error}=await sb.from("classes").insert({name:base.name,description:base.description,teacher_id:current.id,course:base.course,jnvst_group_type:"MAIN",jnvst_parent_id:null}).select("*").single();
   if(error)throw error;
   found=data; created.push(data); existing.push(data);
  }else{
   const {data,error}=await sb.from("classes").update({name:base.name,description:base.description,course:base.course,jnvst_group_type:"MAIN",jnvst_parent_id:null}).eq("id",found.id).eq("teacher_id",current.id).select("*").single();
   if(error)throw error;
   found=data;
   const idx=existing.findIndex(c=>c.id===found.id);if(idx>=0)existing[idx]=found;
  }

  const duplicates=candidates.filter(c=>c.id!==found.id);
  for(const dup of duplicates){
   // Only rows explicitly attached to this duplicate are its children.
   // This prevents legacy textual parent markers from making every subgroup
   // appear under every duplicate main group.
   const {data:children,error:che}=await sb.from("classes").select("*").eq("teacher_id",current.id).eq("jnvst_parent_id",dup.id);
   if(che)throw che;
   for(const child of children||[]){
    const same=(existing||[]).find(c=>c.id!==child.id && jnvstParentId(c)===found.id && String(c.name||"").trim().toLowerCase()===String(child.name||"").trim().toLowerCase());
    if(same){
     const {data:members,error:me}=await sb.from("class_students").select("student_id").eq("class_id",child.id);if(me)throw me;
     const {data:targetMembers,error:tme}=await sb.from("class_students").select("student_id").eq("class_id",same.id);if(tme)throw tme;
     const have=new Set((targetMembers||[]).map(x=>x.student_id));
     const add=(members||[]).map(x=>x.student_id).filter(Boolean).filter(id=>!have.has(id));
     if(add.length){const {error:ie}=await sb.from("class_students").insert(add.map(student_id=>({class_id:same.id,student_id})));if(ie)throw ie;}
     const {error:ae}=await sb.from("assignments").update({class_id:same.id,main_group:base.name}).eq("class_id",child.id).eq("created_by",current.id);if(ae)throw ae;
     const {error:de}=await sb.from("class_students").delete().eq("class_id",child.id);if(de)throw de;
     const {error:ce}=await sb.from("classes").delete().eq("id",child.id).eq("teacher_id",current.id);if(ce)throw ce;
     const ix=existing.findIndex(x=>x.id===child.id);if(ix>=0)existing.splice(ix,1);
    }else{
     const clean=String(child.description||"").replace(/^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)\s*\|?\s*/i,"").trim();
     const {data:updated,error:ue}=await sb.from("classes").update({jnvst_parent_id:found.id,jnvst_group_type:"SUB",course:base.course,description:`JNVST_SUBGROUP_PARENT:${base.key}| ${clean}`.trim()}).eq("id",child.id).eq("teacher_id",current.id).select("*").single();if(ue)throw ue;
     const ix=existing.findIndex(x=>x.id===child.id);if(ix>=0)existing[ix]=updated;
    }
   }

   // Merge any students directly attached to the duplicate main.
   const {data:direct,error:dme}=await sb.from("class_students").select("student_id").eq("class_id",dup.id);if(dme)throw dme;
   const {data:mainMembers,error:fme}=await sb.from("class_students").select("student_id").eq("class_id",found.id);if(fme)throw fme;
   const have=new Set((mainMembers||[]).map(x=>x.student_id));
   const add=(direct||[]).map(x=>x.student_id).filter(Boolean).filter(id=>!have.has(id));
   if(add.length){const {error:ie}=await sb.from("class_students").insert(add.map(student_id=>({class_id:found.id,student_id})));if(ie)throw ie;}
   const {error:aae}=await sb.from("assignments").update({class_id:found.id,main_group:base.name}).eq("class_id",dup.id).eq("created_by",current.id);if(aae)throw aae;
   const {error:ade}=await sb.from("class_students").delete().eq("class_id",dup.id);if(ade)throw ade;
   const {error:ce}=await sb.from("classes").delete().eq("id",dup.id).eq("teacher_id",current.id);if(ce)throw ce;
   const ix=existing.findIndex(x=>x.id===dup.id);if(ix>=0)existing.splice(ix,1);
  }
 }
 return existing.concat(created.filter(x=>!existing.some(y=>y.id===x.id)));
}
async function migrateLegacyNavodayaGroups(allClasses){
 const classes=allClasses||[];
 const normalize=n=>String(n||"").trim().toLowerCase().replace(/\s+/g,"_");
 const sources=classes.filter(c=>{
   if(String(c.course||"").trim().toUpperCase()!=="JNVST-6")return false;
   const n=normalize(c.name);
   return (n==="navodaya_ass"||n==="navodaya_eng") && jnvstSubgroupParent(c)!=="JNVST-VI";
 });
 if(!sources.length)return {classes,studentsMoved:0,groupsMigrated:[]};
 const result=classes.slice();
 let studentsMoved=0; const groupsMigrated=[];
 for(const source of sources){
   const target=result.find(c=>String(c.name||"").trim().toLowerCase()===String(source.name||"").trim().toLowerCase() && jnvstSubgroupParent(c)==="JNVST-VI" && c.id!==source.id);
   if(!target){
     const oldDesc=String(source.description||"").trim();
     const cleanDesc=oldDesc.replace(/^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)\s*\|?\s*/i,"").trim();
     const fullDesc=`JNVST_SUBGROUP_PARENT:JNVST-VI| ${cleanDesc||"Migrated from previous Navodaya class."}`.trim();
     const {data,error}=await sb.from("classes").update({description:fullDesc,course:"JNVST-6",name:source.name}).eq("id",source.id).eq("teacher_id",current.id).select("*").single();
     if(error)throw error;
     const idx=result.findIndex(c=>c.id===source.id); if(idx>=0)result[idx]=data;
     const {count}=await sb.from("class_students").select("student_id",{count:"exact",head:true}).eq("class_id",source.id);
     studentsMoved+=Number(count||0);
     groupsMigrated.push(`${source.name} (${Number(count||0)} students)`);
   }else{
     const {data:members,error:me}=await sb.from("class_students").select("student_id").eq("class_id",source.id);
     if(me)throw me;
     const ids=(members||[]).map(x=>x.student_id).filter(Boolean);
     if(ids.length){
       const {data:targetMembers,error:te}=await sb.from("class_students").select("student_id").eq("class_id",target.id);
       if(te)throw te;
       const existingTarget=new Set((targetMembers||[]).map(x=>x.student_id));
       const newIds=ids.filter(id=>!existingTarget.has(id));
       if(newIds.length){
         const {error:ie}=await sb.from("class_students").insert(newIds.map(student_id=>({class_id:target.id,student_id})));
         if(ie)throw ie;
       }
       const {error:de}=await sb.from("class_students").delete().eq("class_id",source.id);
       if(de)throw de;
       studentsMoved+=ids.length;
     }
     const {data:sourceAssignments,error:ae}=await sb.from("assignments").select("id").eq("class_id",source.id);
     if(ae)throw ae;
     if(!(sourceAssignments||[]).length){
       const {error:ce}=await sb.from("classes").delete().eq("id",source.id).eq("teacher_id",current.id);
       if(ce)throw ce;
       const idx=result.findIndex(c=>c.id===source.id); if(idx>=0)result.splice(idx,1);
     }else{
       const oldDesc=String(source.description||"").trim();
       const fullDesc=`JNVST_LEGACY_MIGRATED: target=${target.id}| ${oldDesc}`.trim();
       const {data:errorData,error:ue}=await sb.from("classes").update({description:fullDesc}).eq("id",source.id).eq("teacher_id",current.id).select("*").single();
       if(ue)throw ue;
       const idx=result.findIndex(c=>c.id===source.id); if(idx>=0)result[idx]=errorData;
     }
     groupsMigrated.push(`${source.name} (${ids.length} students)`);
   }
 }
 return {classes:result,studentsMoved,groupsMigrated};
}
function renderJnvstClassManager(classes,students,assignments){
 const bases=["JNVST-VI","JNVST-IX"];
 const baseCards=bases.map(key=>{
  const base=classes.find(c=>jnvstBaseKey(c)===key);
  const subs=classes.filter(c=>jnvstSubgroupParent(c)===key);
  const directStudents=base?students.filter(s=>s.class_id===base.id).length:0;
  return `<div class="student-card" style="border:2px solid #dbeafe;background:#f8fbff">
   <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
    <div><h3 style="margin:0">${key==="JNVST-VI"?"📘 JNVST-VI (Class-IV)":"📗 JNVST-IX (Class IX)"}</h3><div class="muted small">Fixed class — cannot be deleted.</div></div>
    <span class="tag">${subs.length} Sub-group${subs.length===1?"":"s"}</span>
   </div>
   <div class="small" style="margin-top:7px">${directStudents} student(s) directly in this fixed class.</div>
   <div style="margin-top:10px">${subs.length?subs.map(c=>{const sc=students.filter(s=>s.class_id===c.id).length,ac=assignments.filter(a=>a.class_id===c.id).length;return `<div class="student-card" style="background:#fff"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>${esc(c.name)}</b><div class="muted small">${sc} student(s) • ${ac} assignment(s)</div>${String(c.description||"").replace(/^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)\s*\|?\s*/i,"")?`<div class="small muted">${esc(String(c.description||"").replace(/^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)\s*\|?\s*/i,""))}</div>`:""}</div><button class="danger" onclick="deleteJnvstClass('${c.id}')">Delete</button></div></div>`}).join(""):"<div class='muted small'>No sub-groups yet.</div>"}</div>
   <button style="margin-top:10px" onclick="newJnvstSubgroup('${key}')">+ Create Sub-group</button>
  </div>`;
 }).join("");
 const legacy=classes.filter(c=>!jnvstBaseKey(c)&&!jnvstSubgroupParent(c));
 return `${baseCards}${legacy.length?`<div class="student-card"><h3>Other JNVST Classes</h3><p class="muted small">Older/custom JNVST classes are kept here. They can be deleted when they have no students or assignments.</p>${legacy.map(c=>`<div class="student-card"><div style="display:flex;justify-content:space-between;gap:8px"><div><b>${esc(c.name)}</b><div class="small muted">${students.filter(s=>s.class_id===c.id).length} student(s) • ${assignments.filter(a=>a.class_id===c.id).length} assignment(s)</div></div><button class="danger" onclick="deleteJnvstClass('${c.id}')">Delete</button></div></div>`).join("")}</div>`:""}`;
}
async function normalizeJnvstAssignmentGroups(classes,assignments){
 const list=assignments||[];const cmap=new Map((classes||[]).map(c=>[c.id,c]));
 for(const a of list){
   const c=cmap.get(a.class_id);if(!c)continue;
   const parent=jnvstSubgroupParent(c);const baseKey=parent||jnvstBaseKey(c);if(!baseKey)continue;
   const base=(classes||[]).find(x=>jnvstBaseKey(x)===baseKey);if(!base)continue;
   const desiredMain=base.name;const desiredSub=parent?c.name:"";
   if(String(a.main_group||"")!==desiredMain||String(a.sub_group||"")!==desiredSub){
     const {data,error}=await sb.from("assignments").update({main_group:desiredMain,sub_group:desiredSub}).eq("id",a.id).eq("created_by",current.id).select("*").single();
     if(!error&&data)Object.assign(a,data);
   }
 }
 return list;
}
async function loadTeacherFeeData(){
  // Students Fees is a JNVST teacher feature. Do NOT load SCHOOL students here.
  // Determine the students from JNVST classes owned by the current teacher,
  // then load only their fee accounts and payments. This also prevents a School
  // student with a fee record from appearing accidentally.
  const {data:jnvstClasses,error:ce}=await sb.from("classes")
    .select("id,name,course,teacher_id")
    .eq("teacher_id",current.id)
    .in("course",["JNVST-6","JNVST-9"]);
  if(ce)throw new Error("Could not load JNVST classes: "+ce.message);

  const classIds=(jnvstClasses||[]).map(c=>c.id).filter(Boolean);
  let memberships=[];
  if(classIds.length){
    const {data:rows,error:me}=await sb.from("class_students")
      .select("student_id,class_id")
      .in("class_id",classIds);
    if(me)throw new Error("Could not load JNVST students: "+me.message);
    memberships=rows||[];
  }

  const studentIds=[...new Set(memberships.map(x=>x.student_id).filter(Boolean))];
  let students=[];
  if(studentIds.length){
    const {data:studentRows,error:se}=await sb.from("profiles")
      .select("id,full_name,roll_no,course")
      .eq("role","student")
      .in("id",studentIds)
      .in("course",["JNVST-6","JNVST-9"])
      .order("full_name");
    if(se)throw new Error("Could not load JNVST students: "+se.message);
    students=studentRows||[];
  }

  const validStudentIds=new Set(students.map(s=>s.id));
  const {data:accounts,error:ae}=await sb.from("student_fee_accounts")
    .select("*")
    .eq("teacher_id",current.id)
    .order("updated_at",{ascending:false});
  if(ae)throw new Error("Could not load fee accounts: "+ae.message);

  // Keep only fee accounts belonging to the JNVST students displayed above.
  const accountRows=(accounts||[]).filter(a=>validStudentIds.has(a.student_id));
  const accountIds=accountRows.map(a=>a.id).filter(Boolean);
  let payments=[];
  if(accountIds.length){
    const {data:paymentRows,error:pe}=await sb.from("student_fee_payments")
      .select("*")
      .in("fee_account_id",accountIds)
      .order("payment_date",{ascending:false})
      .order("created_at",{ascending:false});
    if(pe)throw new Error("Could not load fee payments: "+pe.message);
    payments=paymentRows||[];
  }

  const classMap=new Map((jnvstClasses||[]).map(c=>[String(c.id),c]));
  const membershipMap=new Map();
  memberships.forEach(m=>{
    if(validStudentIds.has(m.student_id)&&!membershipMap.has(m.student_id))membershipMap.set(m.student_id,m);
  });
  students=students.map(st=>({...st,class_id:membershipMap.get(st.id)?.class_id||"",class_name:classMap.get(String(membershipMap.get(st.id)?.class_id||""))?.name||""}));

  const am=new Map(accountRows.map(a=>[a.student_id,a]));
  const pm=new Map();
  payments.forEach(p=>{
    pm.set(p.student_id,(pm.get(p.student_id)||0)+Number(p.amount||0));
  });
  return {students,accounts:accountRows,payments,am,pm};
}
async function manageStudentFees(){
  try{
    const d=await loadTeacherFeeData();window._teacherFeeData=d;
    const totalFee=d.accounts.reduce((n,a)=>n+Number(a.total_course_fee||0),0), totalDiscount=d.accounts.reduce((n,a)=>n+Number(a.discount_amount||0),0), totalPaid=d.payments.reduce((n,p)=>n+Number(p.amount||0),0), outstanding=Math.max(0,totalFee-totalDiscount-totalPaid);
    render(`<div class="wrap">${header("Students Fees Management")}
      <div class="card" style="border:2px solid #16a34a;background:#f0fdf4"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h2 style="margin:0;color:#166534">💰 Students Fees</h2><p class="muted" style="margin:6px 0 0">Manage course fees, discounts, payments and student messages.</p></div><div class="actions"><button onclick="feeChooseStudent()">+ Add / Edit Fee</button><button onclick="bulkFeesUploadPage()">↑ Bulk Fees Upload</button><button class="secondary" onclick="downloadFeeTemplate('payments')">↓ Payment Template</button><button class="secondary" onclick="downloadFeeTemplate('setup')">↓ Fee Setup Template</button></div></div></div>
      <div class="grid"><div class="card fee-stat"><div class="muted">Fee Accounts</div><strong>${d.accounts.length}</strong></div><div class="card fee-stat"><div class="muted">Total Course Fees</div><strong>${feeMoney(totalFee)}</strong></div><div class="card fee-stat"><div class="muted">Total Paid</div><strong>${feeMoney(totalPaid)}</strong></div><div class="card fee-stat fee-balance"><div class="muted">Outstanding</div><strong>${feeMoney(outstanding)}</strong></div></div>
      <div class="card"><div class="grid"><div><label>Search Student</label><input id="feeStudentSearch" placeholder="Name or Roll No" oninput="filterFeeTable()"></div><div><label>Status</label><select id="feeStatusFilter" onchange="filterFeeTable()"><option value="all">All Status</option><option>Paid</option><option>Partially Paid</option><option>Unpaid</option><option>No Fee Setup</option></select></div></div></div>
      <div class="card"><div class="table-wrap"><table id="feeStudentsTable"><thead><tr><th>Student</th><th>Roll No</th><th>Group</th><th>Course Fee</th><th>Discount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>${d.students.map(st=>feeStudentRow(st,d.am.get(st.id),d.pm.get(st.id)||0)).join("")||'<tr><td colspan="9" class="muted">No students found.</td></tr>'}</tbody></table></div></div>
      <div class="actions"><button class="secondary" onclick="teacherHome()">← Teacher Dashboard</button></div>
    </div>`);
  }catch(e){render(`<div class="wrap">${header("Students Fees Management")}<div class="card">${message("Could not load fee data: "+(e.message||e))}</div></div>`)}
}
function feeStudentRow(st,a,paid){const bal=a?Math.max(0,feeNet(a)-paid):0;const status=feeStatus(a,paid);const cls=a?.group_id||"";return `<tr data-fee-search="${esc((st.full_name||"")+" "+(st.roll_no||"")).toLowerCase()}" data-fee-status="${esc(status)}"><td><b>${esc(st.full_name||"")}</b></td><td>${esc(st.roll_no||"")}</td><td>${esc(a?.course_name||"—")}</td><td>${a?feeMoney(a.total_course_fee):"—"}</td><td>${a&&Number(a.discount_amount)>0?feeMoney(a.discount_amount):"—"}</td><td>${feeMoney(paid)}</td><td><b>${a?feeMoney(bal):"—"}</b></td><td><span class="fee-status fee-${status.toLowerCase().replace(/\s+/g,"-")}">${esc(status)}</span></td><td><div class="actions"><button class="secondary" onclick="feeAccountForm('${st.id}')">Edit</button><button class="secondary" onclick="feePaymentForm('${st.id}')">+ Payment</button>${a?`<button class="secondary" onclick="feePaymentHistory('${st.id}')">History</button>`:""}</div></td></tr>`}
function filterFeeTable(){const q=String(document.getElementById("feeStudentSearch")?.value||"").toLowerCase().trim(),status=document.getElementById("feeStatusFilter")?.value||"all";document.querySelectorAll("#feeStudentsTable tbody tr").forEach(r=>{const okq=!q||(r.dataset.feeSearch||"").includes(q),oks=status==="all"||(r.dataset.feeStatus||"")===status;r.style.display=okq&&oks?"":"none";});}
function feeChooseStudent(){const d=window._teacherFeeData;if(!d?.students?.length)return notify("No students found.");render(`<div class="wrap">${header("Select Student — Fee Account")}<div class="card"><label>Student</label><select id="feeChooseStudent">${d.students.map(st=>`<option value="${st.id}">${esc(st.full_name)} — ${esc(st.roll_no||"")}</option>`).join("")}</select><div class="actions"><button onclick="feeAccountForm(document.getElementById('feeChooseStudent').value)">Continue</button><button class="secondary" onclick="manageStudentFees()">Cancel</button></div></div></div>`)}
function feeAccountForm(studentId=""){
 const d=window._teacherFeeData, st=(d?.students||[]).find(x=>x.id===studentId), a=d?.am?.get(studentId);
 if(!st)return notify("Please select a student.");
 render(`<div class="wrap">${header("Fee Account")}<div class="card"><h2>${esc(st.full_name)}</h2><p class="muted">Roll No: ${esc(st.roll_no||"")}</p><label>Total Course Fees</label><input id="feeTotal" type="number" min="0" step="0.01" value="${Number(a?.total_course_fee||0)}"><label>Discount</label><input id="feeDiscount" type="number" min="0" step="0.01" value="${Number(a?.discount_amount||0)}"><label>Course / Subscription Name</label><input id="feeCourse" value="${esc(a?.course_name||"")}" placeholder="e.g. JNVST VI – English Medium"><label>Message to Student</label><textarea id="feeMessage" rows="4" placeholder="Enter a message for this student">${esc(a?.message||"")}</textarea><label style="display:flex;align-items:center;gap:8px"><input id="feeMessageEnabled" type="checkbox" style="width:auto" ${a?.message_enabled?"checked":""}> Show this message in student's dashboard</label><div class="notice small">Balance is calculated automatically as Course Fee − Discount − Total Paid.</div><div class="actions"><button onclick="saveFeeAccount('${st.id}')">💾 Save Fee Details</button><button class="secondary" onclick="manageStudentFees()">Cancel</button></div></div></div>`);
}
async function saveFeeAccount(studentId){try{const total=Number(document.getElementById("feeTotal")?.value||0),discount=Number(document.getElementById("feeDiscount")?.value||0);if(total<0||discount<0||discount>total)return notify("Please enter valid fee and discount amounts.");await callTeacherFn({action:"feeSaveAccount",student_id:studentId,total_course_fee:total,discount_amount:discount,course_name:document.getElementById("feeCourse")?.value||"",message:document.getElementById("feeMessage")?.value||"",message_enabled:!!document.getElementById("feeMessageEnabled")?.checked});notify("Fee details saved successfully.");await manageStudentFees()}catch(e){notify(e.message||e)}}
function feePaymentForm(studentId){const d=window._teacherFeeData,st=(d?.students||[]).find(x=>x.id===studentId);if(!st)return notify("Student not found.");render(`<div class="wrap">${header("Add Payment")}<div class="card"><h2>${esc(st.full_name)}</h2><p class="muted">Roll No: ${esc(st.roll_no||"")}</p><label>Amount Paid</label><input id="payAmount" type="number" min="0.01" step="0.01"><label>Payment Date</label><input id="payDate" type="date" value="${new Date().toISOString().slice(0,10)}"><label>Payment Mode</label><select id="payMode"><option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank Transfer">Bank Transfer</option><option value="Cheque">Cheque</option><option value="Other">Other</option></select><label>Reference No.</label><input id="payRef" placeholder="Optional"><label>Remarks</label><input id="payRemarks" placeholder="Optional"><div class="actions"><button onclick="saveFeePayment('${studentId}')">💾 Save Payment</button><button class="secondary" onclick="manageStudentFees()">Cancel</button></div></div></div>`)}
async function saveFeePayment(studentId,allowDuplicate=false){try{const amount=Number(document.getElementById("payAmount")?.value||0);if(amount<=0)return notify("Enter a valid payment amount.");const j=await callTeacherFn({action:"feeAddPayment",student_id:studentId,amount,payment_date:document.getElementById("payDate")?.value,payment_mode:document.getElementById("payMode")?.value,reference_no:document.getElementById("payRef")?.value,remarks:document.getElementById("payRemarks")?.value,allow_duplicate:allowDuplicate});notify("Payment saved successfully.");await manageStudentFees()}catch(e){if(String(e.message||"").includes("duplicate")&&!allowDuplicate&&confirm((e.message||"")+"\n\nAdd it anyway?"))return saveFeePayment(studentId,true);notify(e.message||e)}}
async function feePaymentHistory(studentId){try{const d=window._teacherFeeData,st=d?.students.find(x=>x.id===studentId),a=d?.am.get(studentId),rows=(d?.payments||[]).filter(p=>p.student_id===studentId);render(`<div class="wrap">${header("Payment History")}<div class="card"><h2>${esc(st?.full_name||"Student")}</h2><p class="muted">Roll No: ${esc(st?.roll_no||"")}</p><div class="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Remarks</th><th>Import Batch</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${esc(feeDate(p.payment_date))}</td><td><b>${feeMoney(p.amount)}</b></td><td>${esc(p.payment_mode||"—")}</td><td>${esc(p.reference_no||"—")}</td><td>${esc(p.remarks||"—")}</td><td class="small">${esc(p.import_batch_id||"Manual")}</td></tr>`).join("")||'<tr><td colspan="6" class="muted">No payments.</td></tr>'}</tbody></table></div><p style="text-align:right"><b>Total Paid: ${feeMoney(rows.reduce((n,p)=>n+Number(p.amount||0),0))}</b></p></div><div class="actions"><button class="secondary" onclick="manageStudentFees()">← Back to Fees</button></div></div>`)}catch(e){notify(e.message||e)}}
function downloadFeeTemplate(mode){const wb=XLSX.utils.book_new();if(mode==='setup'){const ws=XLSX.utils.aoa_to_sheet([["Roll No","Total Course Fee","Discount","Course Name","Message","Show Message"],["X01",15000,2000,"JNVST VI – English Medium","Next instalment is due soon.",true]]);XLSX.utils.book_append_sheet(wb,ws,"Fee Setup");XLSX.writeFile(wb,"SwarupSir_Fee_Setup_Template.xlsx");}else{const ws=XLSX.utils.aoa_to_sheet([["Roll No","Payment Date","Amount Paid","Payment Mode","Reference No","Remarks"],["X01","2026-09-22",5000,"Cash","","Admission"]]);XLSX.utils.book_append_sheet(wb,ws,"Payments");const ins=XLSX.utils.aoa_to_sheet([["Instructions"],["Roll No must exactly match the student account."],["Payment Date: use a valid Excel date or YYYY-MM-DD."],["Amount Paid must be greater than 0."],["Payment Mode, Reference No and Remarks are optional."]]);XLSX.utils.book_append_sheet(wb,ins,"Instructions");XLSX.writeFile(wb,"SwarupSir_Fees_Payment_Template.xlsx");}}
function bulkFeesUploadPage(mode="payments"){feeBulkMode=mode;feeBulkRows=[];render(`<div class="wrap">${header("Bulk Fees Upload")}<div class="card" style="border:2px solid #2563eb;background:#eff6ff"><h2 style="margin:0;color:#1d4ed8">↑ Bulk Fees Upload</h2><p class="muted">Upload existing fee information from Excel. The system validates the file before saving anything.</p><div class="actions"><button class="${mode==='payments'?'':'secondary'}" onclick="bulkFeesUploadPage('payments')">Paid Payments</button><button class="${mode==='setup'?'':'secondary'}" onclick="bulkFeesUploadPage('setup')">Fee Setup</button><button class="secondary" onclick="downloadFeeTemplate('${mode}')">↓ Download Template</button></div></div><div class="card"><label>Excel File (.xlsx / .xls)</label><input type="file" id="feeExcelFile" accept=".xlsx,.xls" onchange="readFeeExcel(event)"><div id="feeBulkPreview" class="small muted" style="margin-top:10px">No file selected.</div></div><div class="card"><h3>Required columns</h3>${mode==='payments'?'<p><b>Roll No, Payment Date, Amount Paid</b><br>Optional: Payment Mode, Reference No, Remarks</p>':'<p><b>Roll No, Total Course Fee, Discount</b><br>Optional: Course Name, Message, Show Message</p>'}<div class="notice small">A preview will appear before import. Unknown Roll Nos and invalid rows will not be imported. Duplicate payments are skipped.</div></div><div class="actions"><button id="feeImportBtn" disabled onclick="importFeeExcel()">Validate & Preview</button><button class="secondary" onclick="manageStudentFees()">Cancel</button></div></div>`)}
function feeGet(row,names){const norm=x=>String(x??"").trim().toLowerCase().replace(/[_\s-]+/g," ");for(const n of names){const k=Object.keys(row).find(x=>norm(x)===norm(n));if(k!==undefined)return row[k]}return "";}
function readFeeExcel(ev){const file=ev.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]],raw=XLSX.utils.sheet_to_json(ws,{defval:'',raw:true});feeBulkRows=raw.map((row,i)=>({...row,__row:i+2}));const preview=document.getElementById('feeBulkPreview');const req=feeBulkMode==='payments'?['Roll No','Payment Date','Amount Paid']:['Roll No','Total Course Fee','Discount'];const missing=req.filter(x=>!Object.keys(raw[0]||{}).some(k=>String(k).trim().toLowerCase().replace(/[_\s-]+/g,' ')===x.toLowerCase().replace(/[_\s-]+/g,' ')));if(missing.length){preview.innerHTML=message('Missing required column(s): '+missing.join(', '));document.getElementById('feeImportBtn').disabled=true;return}preview.innerHTML=message(`Loaded ${feeBulkRows.length} row(s). Click Validate & Preview before saving.`,true);document.getElementById('feeImportBtn').disabled=!feeBulkRows.length}catch(err){document.getElementById('feeBulkPreview').innerHTML=message('Could not read Excel: '+err.message);document.getElementById('feeImportBtn').disabled=true}};r.readAsArrayBuffer(file)}
async function importFeeExcel(confirmImport=false){
 if(!feeBulkRows.length)return;
 const btn=document.getElementById('feeImportBtn');if(btn){btn.disabled=true;btn.textContent=confirmImport?'Importing…':'Validating…';}
 try{
  const rows=feeBulkRows.map(r=>{const out={__row:r.__row,roll_no:feeGet(r,['Roll No','Roll','Roll Number'])};if(feeBulkMode==='payments'){let d=feeGet(r,['Payment Date','Date']);if(d instanceof Date)d=d.toISOString().slice(0,10);out.payment_date=d;out.amount_paid=feeGet(r,['Amount Paid','Amount']);out.payment_mode=feeGet(r,['Payment Mode','Mode']);out.reference_no=feeGet(r,['Reference No','Reference Number','Reference']);out.remarks=feeGet(r,['Remarks','Remark']);}else{out.total_course_fee=feeGet(r,['Total Course Fee','Course Fee','Total Fee']);out.discount_amount=feeGet(r,['Discount','Discount Amount']);out.course_name=feeGet(r,['Course Name','Course']);out.message=feeGet(r,['Message']);out.message_enabled=feeGet(r,['Show Message','Message Enabled']);}return out});
  const j=await callTeacherFn({action:'feeBulkImport',mode:feeBulkMode,rows,validate_only:!confirmImport});
  const results=j.results||[],errors=results.filter(x=>x.status==='error'),dups=results.filter(x=>x.status==='duplicate'),valid=results.filter(x=>x.status==='valid');
  if(!confirmImport){
   const previewRows=results.map(x=>`<tr><td>${x.row}</td><td>${esc(x.roll_no||'')}</td><td>${x.status==='valid'?'✓ Valid':x.status==='duplicate'?'⚠ Duplicate':'❌ Error'}</td><td>${esc(x.error||x.action||'')}</td></tr>`).join('');
   render(`<div class="wrap">${header("Bulk Fees Upload — Preview")}<div class="card"><h2>Review Before Import</h2><div class="grid"><div class="card fee-stat"><div class="muted">Valid</div><strong>${valid.length}</strong></div><div class="card fee-stat"><div class="muted">Errors</div><strong>${errors.length}</strong></div><div class="card fee-stat"><div class="muted">Duplicates</div><strong>${dups.length}</strong></div></div><div class="table-wrap"><table><thead><tr><th>Excel Row</th><th>Roll No</th><th>Status</th><th>Details</th></tr></thead><tbody>${previewRows}</tbody></table></div><div class="notice small" style="margin-top:12px">Only valid rows will be imported. ${feeBulkMode==='payments'?'If a student has no fee account yet, one will be created automatically with course fee ₹0; you can edit the course fee afterward.':'Existing fee accounts will be updated with the values in this file.'}</div><div class="actions"><button onclick="importFeeExcel(true)" ${valid.length?'':'disabled'}>✓ Confirm Import (${valid.length})</button><button class="secondary" onclick="bulkFeesUploadPage('${feeBulkMode}')">Cancel / Choose Another File</button></div></div></div>`);
   return;
  }
  render(`<div class="wrap">${header("Bulk Fees Upload Result")}<div class="card"><h2>Import Completed</h2><div class="success"><b>Batch:</b> ${esc(j.batch_id||'—')}<br><b>Imported:</b> ${Number(j.imported||0)} record(s)</div>${errors.length?`<div class="notice" style="margin-top:12px"><b>Errors: ${errors.length}</b><br>${errors.map(x=>`Row ${x.row}: ${esc(x.error||'Invalid row')}`).join('<br>')}</div>`:''}${dups.length?`<div class="notice" style="margin-top:12px"><b>Skipped duplicates: ${dups.length}</b><br>${dups.map(x=>`Row ${x.row}: ${esc(x.error||'Duplicate')}`).join('<br>')}</div>`:''}<div class="actions"><button onclick="manageStudentFees()">View Students Fees</button><button class="secondary" onclick="bulkFeesUploadPage('${feeBulkMode}')">Upload Another File</button></div></div></div>`);
 }catch(e){notify(e.message||e);if(btn){btn.disabled=false;btn.textContent=confirmImport?'Import':'Validate & Preview';}}
}
async function teacherHome(){
 if(schoolTeacherMode){ location.replace("teacher-dashboard.html"); return; }
 let [{data:allClasses,error:ce},{data:allAssignments,error:ae},{data:allStudents,error:se},{data:subjectRows,error:sje},{data:lessonRows,error:lje}]=await Promise.all([
   sb.from("classes").select("*").eq("teacher_id",current.id).order("created_at",{ascending:false}),
   sb.from("assignments").select("*").eq("created_by",current.id).order("created_at",{ascending:false}),
   sb.from("profiles").select("*").eq("role","student").order("full_name"),
   sb.from("jnvst_subjects").select("*").eq("teacher_id",current.id).order("name"),
   sb.from("jnvst_subject_lessons").select("*").eq("teacher_id",current.id).order("lesson_code").order("lesson_name")
 ]);
 if(sje||lje) return render(`<div class="wrap">${header("JNVST Course Teacher Dashboard",false)}<div class="card">${message("Please run JNVST_GROUP_SUBJECT_MANAGEMENT.sql and JNVST_SUBJECT_LESSON_CATEGORY_MIGRATION.sql in Supabase first. "+(sje||lje).message)}</div></div>`);
 jnvstSubjects=subjectRows||[];
 jnvstSubjectLessons=lessonRows||[];
 if(ce||ae||se)return render(`<div class="wrap">${header("JNVST Course Teacher Dashboard")}<div class="card">${message((ce||ae||se).message)}</div></div>`);
 try{
  allClasses=await ensureJnvstBaseClasses(allClasses||[]);
  const migration=await migrateLegacyNavodayaGroups(allClasses);
  allClasses=migration.classes;
  // Preserve any older/custom JNVST classes as teacher-created main groups.
  for(const c of allClasses){
    if(!jnvstBaseKey(c)&&!jnvstSubgroupParent(c)&&String(c.jnvst_group_type||"").toUpperCase()!=="MAIN"){
      const {data:u}=await sb.from("classes").update({jnvst_group_type:"MAIN",jnvst_parent_id:null}).eq("id",c.id).eq("teacher_id",current.id).select("*").single();
      if(u){const i=allClasses.findIndex(x=>x.id===c.id);if(i>=0)allClasses[i]=u;}
    }
  }
  allAssignments=await normalizeJnvstAssignmentGroups(allClasses,allAssignments||[]);
  window._jnvstMigration=migration;
 }catch(e){return render(`<div class="wrap">${header("JNVST Course Teacher Dashboard")}<div class="card">${message("Could not prepare the fixed JNVST classes or migrate the previous Navodaya groups: "+(e.message||e))}</div></div>`)}
 const classes=(allClasses||[]).filter(c=>String(c.course||"").trim().toUpperCase()!=="SCHOOL");
 const classIds=new Set(classes.map(c=>c.id));
 // JNVST dashboard students are determined by BOTH course and membership in
 // a teacher-owned JNVST class. This prevents School students or orphaned
 // profiles from appearing on the JNVST dashboard.
 let students=[];
 if(classIds.size){
   const {data:members,error:me}=await sb.from("class_students").select("student_id,class_id").in("class_id",[...classIds]);
   if(me)return render(`<div class="wrap">${header("JNVST Course Teacher Dashboard")}<div class="card">${message(me.message)}</div></div>`);
   const cm=new Map((members||[]).map(x=>[x.student_id,x.class_id]));
   students=(allStudents||[]).filter(st=>["JNVST-6","JNVST-9"].includes(String(st.course||"").trim().toUpperCase()) && cm.has(st.id)).map(st=>({...st,class_id:cm.get(st.id)||""}));
 }
 const assignments=(allAssignments||[]).filter(a=>classIds.has(a.class_id));
 const normalAssignments=assignments.filter(a=>a.assignment_type!=="MOCK"&&a.assignment_type!=="mock");
 window._jnvstClasses=classes;window._jnvstStudents=students;window._jnvstAssignments=assignments;
 render(`<div class="wrap">${header("JNVST Course Teacher Dashboard")}
  <div class="card" style="border:2px solid #2563eb;background:#eff6ff"><h2 style="margin:0;color:#1d4ed8">📚 JNVST Course</h2><p class="muted" style="margin:6px 0 0">JNVST-VI (Class-IV) • JNVST-IX (Class IX)</p>${window._jnvstMigration?.groupsMigrated?.length?`<div class="success" style="margin-top:10px"><b>Previous Navodaya groups migrated:</b> ${esc(window._jnvstMigration.groupsMigrated.join(" • "))}. Students are now under the JNVST-VI (Class-IV) sub-groups.</div>`:""}</div>
  <div class="grid"><div class="card"><div class="muted">Fixed JNVST Classes</div><div class="stat">2</div></div><div class="card"><div class="muted">Sub-groups</div><div class="stat">${classes.filter(c=>!!jnvstSubgroupParent(c)).length}</div></div><div class="card"><div class="muted">JNVST Students</div><div class="stat">${students.length}</div></div><div class="card"><div class="muted">Assignments</div><div class="stat">${normalAssignments.length}</div></div></div>
  <div class="card"><div class="actions"><button onclick="manageJnvstClasses()">🏫 Manage Groups & Subjects</button><button onclick="jnvstQuestionBankHome()">📚 JNVST Question Bank</button><button onclick="jnvstManualAddQuestion()">➕ Add JNVST Question</button><button onclick="jnvstQuestionBulkUpload()">📥 Bulk Upload JNVST Questions</button><button onclick="addStudent()">+ Add Student</button><button onclick="bulkImportStudents()">↑ Bulk Students (Excel)</button><button onclick="newAssignment()">+ New Assignment</button><button onclick="teacherResultsDashboard()">📊 Assignment Results</button><button onclick="mockTestManagement()">🎯 Mock Test Management</button><button onclick="downloadAllResultsExcel()">⬇ All Results (Excel)</button><button onclick="manageStudentAccounts()">👥 Student Accounts</button><button onclick="manageStudentFees()">💰 Students Fees</button></div></div>
  <div class="card"><h2>JNVST Classes</h2>${renderJnvstClassManager(classes,students,assignments)}</div>
  <div class="card"><h2>Assignments</h2><div class="grid" style="margin-bottom:12px"><div><label>Main Group</label><select id="teacherAssignmentMainFilter" onchange="filterTeacherAssignments()"><option value="all">All Main Groups</option>${jnvstMainGroups(classes).map(g=>`<option value="${esc(g.name)}">${esc(g.name)}</option>`).join("")}</select></div><div><label>Sub-Group</label><select id="teacherAssignmentSubFilter" onchange="filterTeacherAssignments()"><option value="all">All Sub-Groups</option>${[...new Set(classes.filter(c=>isJnvstSubGroup(c)).map(c=>c.name))].sort().map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join("")}</select></div></div><div id="teacherAssignmentsList">${renderTeacherAssignmentCards(assignments)}</div></div>
 </div>`);
}
async function schoolAssignmentManagement(){
  schoolTeacherMode=true;
  try{await ensureSchoolSubjects();
    const [{data:assignments,error:ae},{data:classes,error:ce},{data:groups,error:ge}]=await Promise.all([
      sb.from("assignments").select("*").eq("created_by",current.id).order("created_at",{ascending:false}),
      sb.from("classes").select("id,name,description,course").eq("teacher_id",current.id).eq("course","SCHOOL").order("name"),
      sb.from("school_course_groups").select("id,name,class_id,description").eq("teacher_id",current.id).order("name")
    ]);
    if(ae)throw ae;if(ce)throw ce;if(ge)throw ge;
    const schoolClasses=classes||[], classIds=new Set(schoolClasses.map(c=>c.id));
    const list=(assignments||[]).filter(a=>classIds.has(a.class_id) && a.assignment_type!=="MOCK" && a.assignment_type!=="mock");
    window._schoolAssignmentClasses=schoolClasses;window._schoolAssignmentGroups=groups||[];window._schoolAssignments=list;
    const qCounts=new Map();
    if(list.length){
      const {data:q,error:qe}=await sb.from("questions").select("assignment_id").in("assignment_id",list.map(a=>a.id));
      if(qe)throw qe;(q||[]).forEach(x=>qCounts.set(x.assignment_id,(qCounts.get(x.assignment_id)||0)+1));
    }
    const cards=list.map(a=>{
      const c=schoolClasses.find(x=>x.id===a.class_id),g=(groups||[]).find(x=>x.id===a.school_group_id || (x.class_id===a.class_id && x.name===a.sub_group));
      const sub=a.sub_group||g?.name||"Entire class";
      return `<div class="assignment" style="border:1px solid #dbe3ee;margin:10px 0">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div><h3 style="margin:0 0 5px">${esc(a.title)}</h3><div class="muted">${esc(a.subject||"No subject")} • ${qCounts.get(a.id)||0} question(s)</div></div>
          <div class="actions"><span class="tag">${esc(c?.name||"Class")}</span><span class="tag">${esc(sub)}</span>${a.adaptive_mode?`<span class="tag" style="background:#f3e8ff;color:#6b21a8">🎯 ADAPTIVE · ≤${Number(a.adaptive_max_percent||60)}%</span>`:''}<span class="tag">${a.video_url?"MCQ + Video":"MCQ"}</span></div>
        </div>
        <div class="small muted" style="margin-top:8px">Created: ${a.created_at?new Date(a.created_at).toLocaleString():"—"}</div>
        <div class="actions" style="margin-top:10px">
          <button onclick="viewAssignment('${a.id}')">View</button>
          <button onclick="editAssignmentDetails('${a.id}')">✎ Edit Details</button>
          <button onclick="editAssignmentGroup('${a.id}')">▣ Edit Class / Subdivision</button>
          <button onclick="editAssignmentQuestions('${a.id}')">✎ Edit Questions</button>
          <button onclick="editAssignmentSupport('${a.id}','hint')">💡 Hints</button>
          <button onclick="editAssignmentSupport('${a.id}','video')">🎥 Solution Video</button>
          <button onclick="editAssignmentSupport('${a.id}','explanation')">📖 Explanation</button>
          <button onclick="reassignAssignment('${a.id}')">↻ Re-assign Missing</button>
          <button onclick="reassignFresh('${a.id}')">↻ Fresh Assign</button>
          <button class="secondary" onclick="results('${a.id}')">Results</button>
          <button class="danger" onclick="deleteAssignment('${a.id}')">Delete</button>
        </div>
      </div>`;
    }).join("");
    render(`<div class="wrap">${header("School Course — Manage Assignments")}
      <div class="card" style="border:2px solid #2563eb;background:#eff6ff">
        <h2 style="margin:0">📚 Assignment Management</h2>
        <p class="muted" style="margin:7px 0 0">Edit existing assignments, change their class/subdivision, update questions, add solutions, re-assign only to students who do not already have the assignment, or make a fresh assignment.</p>
      </div>
      <div class="card">
        <div class="grid"><div><label>Class</label><select id="schoolAssignmentClassFilter" onchange="filterSchoolAssignments()"><option value="all">All Classes</option>${schoolClasses.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></div><div><label>Sub-division</label><select id="schoolAssignmentGroupFilter" onchange="filterSchoolAssignments()"><option value="all">All Sub-divisions</option>${[...new Set((groups||[]).map(g=>g.name))].sort().map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select></div></div>
      </div>
      <div class="card"><h2>Existing Assignments</h2><div id="schoolAssignmentsList">${cards||'<p class="muted">No School Course assignments yet.</p>'}</div></div>
      <div class="actions"><button onclick="location.href='main.html?mode=teacher&portal=SCHOOL&action=newAssignment'">+ New Assignment</button><button onclick="schoolAdaptivePerformanceDashboard()">📊 Student Performance & Struggle</button><button class="secondary" onclick="location.href='teacher-dashboard.html'">← Dashboard</button></div>
    </div>`);
  }catch(e){render(`<div class="wrap">${header("School Course — Manage Assignments")}<div class="card">${message("Could not load School assignments: "+(e.message||e))}</div></div>`)}
}
async function schoolAdaptivePerformanceDashboard(){
  schoolTeacherMode=true;
  try{
    const [{data:students,error:se},{data:perf,error:pe},{data:qb,error:qe}]=await Promise.all([
      sb.from('profiles').select('id,full_name,roll_no').eq('role','student').eq('course','SCHOOL').order('full_name'),
      sb.from('school_student_question_performance').select('student_id,source_school_question_bank_id,attempt_count,wrong_count,correct_count,last_wrong_at,last_correct_at,last_attempted_at').order('wrong_count',{ascending:false}),
      sb.from('school_question_bank_questions').select('id,chapter_id,topic,subject_id,variation_group,marks').eq('teacher_id',current.id).eq('course_type','SCHOOL')
    ]);
    if(se)throw se;if(pe)throw pe;if(qe)throw qe;
    window._adaptivePerformance={students:students||[],perf:perf||[],qb:qb||[]};
    const options=(students||[]).map(st=>`<option value="${esc(st.id)}">${esc(st.full_name||'Student')} ${st.roll_no?`(${esc(st.roll_no)})`:''}</option>`).join('');
    render(`<div class="wrap">${header('Student Performance & Struggle Analysis')}<div class="card" style="border:2px solid #7c3aed;background:#faf5ff"><h2 style="margin:0">🎯 Adaptive Learning Analytics</h2><p class="muted">Question-level mistakes, repeated errors, topic weaknesses and mastery indicators used by Adaptive Assignments.</p><div class="grid"><div><label>Student</label><select id="adaptivePerfStudent" onchange="renderSchoolAdaptivePerformance(this.value)"><option value="">Select a student</option>${options}</select></div><div><label>Scope</label><div class="success">Adaptive assignments use a maximum of 60% weakness-based questions. The remainder is new/normal practice.</div></div></div></div><div id="adaptivePerfContent"><div class="card"><p class="muted">Select a student to view the performance profile.</p></div></div><div class="actions"><button class="secondary" onclick="schoolAssignmentManagement()">← Back to Assignments</button></div></div>`);
  }catch(e){render(`<div class="wrap">${header('Student Performance & Struggle Analysis')}<div class="card">${message('Could not load performance data: '+(e.message||e))}</div></div>`)}
}
function renderSchoolAdaptivePerformance(studentId){
  const box=document.getElementById('adaptivePerfContent');if(!box)return;
  if(!studentId){box.innerHTML='<div class="card"><p class="muted">Select a student to view the performance profile.</p></div>';return;}
  const d=window._adaptivePerformance||{}, rows=(d.perf||[]).filter(x=>x.student_id===studentId), qbMap=new Map((d.qb||[]).map(q=>[q.id,q]));
  const attempts=rows.reduce((n,x)=>n+Number(x.attempt_count||0),0),wrong=rows.reduce((n,x)=>n+Number(x.wrong_count||0),0),correct=rows.reduce((n,x)=>n+Number(x.correct_count||0),0),accuracy=attempts?Math.round(correct*100/attempts):0;
  const topics=new Map();rows.forEach(r=>{const q=qbMap.get(r.source_school_question_bank_id);if(!q)return;const topic=String(q.topic||'Unspecified').trim()||'Unspecified';const x=topics.get(topic)||{attempts:0,wrong:0,correct:0};x.attempts+=Number(r.attempt_count||0);x.wrong+=Number(r.wrong_count||0);x.correct+=Number(r.correct_count||0);topics.set(topic,x)});
  const topicRows=[...topics.entries()].map(([topic,x])=>({topic,...x,accuracy:x.attempts?Math.round(x.correct*100/x.attempts):0})).sort((a,b)=>a.accuracy-b.accuracy);
  const weak=rows.filter(x=>Number(x.wrong_count||0)>0).sort((a,b)=>Number(b.wrong_count||0)-Number(a.wrong_count||0)).slice(0,20);
  const student=(d.students||[]).find(x=>x.id===studentId);
  box.innerHTML=`<div class="card"><h2 style="margin-top:0">${esc(student?.full_name||'Student')}</h2><div class="grid"><div class="card" style="margin:0"><div class="muted">Overall Accuracy</div><div style="font-size:30px;font-weight:800">${accuracy}%</div></div><div class="card" style="margin:0"><div class="muted">Questions Attempted</div><div style="font-size:30px;font-weight:800">${attempts}</div></div><div class="card" style="margin:0"><div class="muted">Wrong Answers</div><div style="font-size:30px;font-weight:800">${wrong}</div></div></div></div><div class="card"><h3>📚 Topic Struggle Analysis</h3>${topicRows.length?`<div style="overflow:auto"><table><thead><tr><th>Topic</th><th>Attempts</th><th>Wrong</th><th>Accuracy</th><th>Status</th></tr></thead><tbody>${topicRows.map(x=>`<tr><td>${esc(x.topic)}</td><td>${x.attempts}</td><td>${x.wrong}</td><td>${x.accuracy}%</td><td>${x.accuracy<50?'🔴 Critical':x.accuracy<70?'🔴 Weak':x.accuracy<80?'🟡 Needs Practice':x.accuracy>=90?'🟢 Strong':'🟢 Good'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No School Course question performance has been recorded yet.</p>'}</div><div class="card"><h3>❌ Most Frequently Wrong Questions</h3>${weak.length?`<div style="overflow:auto"><table><thead><tr><th>Question</th><th>Topic</th><th>Wrong</th><th>Attempts</th><th>Last Wrong</th></tr></thead><tbody>${weak.map(r=>{const q=qbMap.get(r.source_school_question_bank_id)||{};return `<tr><td>${esc(r.source_school_question_bank_id||'')}</td><td>${esc(q.topic||'Unspecified')}</td><td><b>${Number(r.wrong_count||0)}</b></td><td>${Number(r.attempt_count||0)}</td><td>${r.last_wrong_at?new Date(r.last_wrong_at).toLocaleString():'—'}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="muted">No wrong answers recorded for this student.</p>'}</div>`;
}
function filterSchoolAssignments(){
  const cls=document.getElementById("schoolAssignmentClassFilter")?.value||"all",grp=document.getElementById("schoolAssignmentGroupFilter")?.value||"all";
  const classes=window._schoolAssignmentClasses||[],groups=window._schoolAssignmentGroups||[];
  document.querySelectorAll("#schoolAssignmentsList .assignment").forEach(row=>{
    const classTag=row.querySelector(".actions .tag")?.textContent||"";
    const tags=[...row.querySelectorAll(".actions .tag")].map(x=>x.textContent||"");
    const okClass=cls==="all" || tags.includes(classes.find(c=>c.id===cls)?.name||"");
    const okGroup=grp==="all" || tags.includes(grp);
    row.style.display=okClass&&okGroup?"block":"none";
  });
}
async function callTeacherFn(body){
 const {data:{session}}=await sb.auth.getSession();
 if(!session)throw new Error("Please log in again.");
 const res=await fetch(`${SUPABASE_URL}/functions/v1/${CREATE_STUDENT_FN}`,{
  method:"POST",
  headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`,"apikey":SUPABASE_KEY},
  body:JSON.stringify(body)
 });
 const j=await res.json().catch(()=>({}));
 if(!res.ok||j.error)throw new Error(j.error||"Request failed.");
 return j;
}
async function addStudent(){
  try{
    const {data:classes,error}=await sb.from("classes")
      .select("id,name,course,description,jnvst_group_type,jnvst_parent_id")
      .eq("teacher_id",current.id)
      .order("name");
    if(error) throw error;
    const jclasses=(classes||[]).filter(c=>String(c.course||"").toUpperCase().startsWith("JNVST"));
    if(!jclasses.length){
      return render(`<div class="wrap">${header("Add JNVST Student")}<div class="card">${message("No JNVST classes or sub-groups are available. Please create/verify the JNVST groups first.")}<div class="actions"><button class="secondary" onclick="teacherHome()">← Dashboard</button></div></div></div>`);
    }
    const mains=jnvstMainGroups(jclasses);
    const defaultMain=mains[0]?.id||jclasses[0].id;
    const subs=jnvstSubgroupsForMain(jclasses,mains[0]||jclasses[0]);
    const choices=(subs.length?subs:[mains[0]||jclasses[0]]);
    render(`<div class="wrap">${header("Add JNVST Student")}
      <div class="card" style="border:2px solid #f59e0b;background:#fffbeb">
        <h3>⚠ Student Account Creation</h3>
        <p class="small" style="margin:0">Check the student's name, Roll No., password and JNVST group carefully before creating the account. The account will be used for student login.</p>
      </div>
      <div class="card">
        <label>Student Name</label><input id="jnvstAddName" placeholder="Student name">
        <label>Roll No.</label><input id="jnvstAddRoll" type="text" inputmode="text" placeholder="e.g. X01 or 1010">
        <label>Password</label><input id="jnvstAddPass" type="text" placeholder="At least 6 characters">
        <label>JNVST Main Group</label>
        <select id="jnvstAddMain" onchange="refreshJnvstAddSubgroups()">${mains.map((m,i)=>`<option value="${esc(m.id)}" ${i===0?'selected':''}>${esc(m.name)}</option>`).join("")}</select>
        <label>JNVST Sub-Group</label><select id="jnvstAddClass">${choices.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select>
        <div id="jnvstAddMsg"></div>
        <div class="actions"><button onclick="createJnvstStudent()">Create Student</button><button class="secondary" onclick="teacherHome()">← Dashboard</button><button class="secondary" onclick="manageStudentAccounts()">Student Accounts</button></div>
      </div></div>`);
  }catch(e){render(`<div class="wrap">${header("Add JNVST Student")}<div class="card">${message(e.message||String(e))}</div></div>`)}
}
function refreshJnvstAddSubgroups(){
  const mainId=document.getElementById("jnvstAddMain")?.value||"";
  const sel=document.getElementById("jnvstAddClass"); if(!sel)return;
  const classes=(window._jnvstClasses&&window._jnvstClasses.length?window._jnvstClasses:[]);
  const main=classes.find(c=>String(c.id)===String(mainId));
  const subs=jnvstSubgroupsForMain(classes,main);
  sel.innerHTML=(subs.length?subs:[main].filter(Boolean)).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
}
async function createJnvstStudent(){
  const name=document.getElementById("jnvstAddName")?.value.trim();
  const roll=document.getElementById("jnvstAddRoll")?.value.trim();
  const pass=document.getElementById("jnvstAddPass")?.value||"";
  const classId=document.getElementById("jnvstAddClass")?.value||"";
  const box=document.getElementById("jnvstAddMsg");
  if(!name||!roll||!pass||!classId)return notify("Please fill Name, Roll No., Password and JNVST Group.");
  if(pass.length<6)return notify("Password must contain at least 6 characters.");
  if(!confirm(`Create this JNVST student account?\n\nName: ${name}\nRoll No.: ${roll}\nJNVST Group: ${document.getElementById("jnvstAddClass")?.selectedOptions?.[0]?.textContent||classId}\n\nPlease verify the details before confirming.`))return;
  try{
    const j=await callTeacherFn({action:"createStudents",students:[{name,roll_no:roll,password:pass,class_id:classId}]});
    const r=j.results?.[0];
    if(!r?.success)throw new Error(r?.error||"Could not create student.");
    box.innerHTML=message(`Student created successfully. Roll No.: ${r.roll_no||roll}`,true);
    setTimeout(()=>manageStudentAccounts(),900);
  }catch(e){box.innerHTML=message(e.message||String(e))}
}
function bulkImportStudents(){
  bulkStudents=[];
  render(`<div class="wrap">${header("Bulk JNVST Students — Excel")}
    <div class="card" style="border:2px solid #f59e0b;background:#fffbeb"><h3>⚠ Bulk Student Account Creation</h3><p class="small" style="margin:0">Check the Excel preview carefully. Each row creates a real student login account. Existing Roll Nos. cannot be duplicated.</p></div>
    <div class="card"><p><b>Required Excel columns:</b></p><div class="tag" style="font-size:15px">Name | Roll No | Class | Password</div><p class="muted small">For JNVST, <b>Class</b> should be the exact existing JNVST main group or sub-group name. No email is required.</p>
    <label>Excel file</label><input id="studentExcel" type="file" accept=".xlsx,.xls" onchange="readJnvstStudentExcel(event)"><div id="bulkPreview"></div>
    <div class="actions"><button onclick="uploadJnvstBulkStudents()">Create All Students</button><button class="secondary" onclick="teacherHome()">← Dashboard</button><button class="secondary" onclick="manageStudentAccounts()">Student Accounts</button></div></div></div>`);
}
function readJnvstStudentExcel(ev){
  const file=ev.target.files?.[0];if(!file)return;
  const r=new FileReader();r.onload=e=>{try{
    const wb=XLSX.read(e.target.result,{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]],raw=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    if(!raw.length)throw new Error("The Excel file is empty.");
    const norm=v=>String(v??"").trim();
    const headers=raw[0].map(v=>norm(v).toLowerCase().replace(/[_\s]+/g," "));
    const col=(...names)=>{for(const x of names){const i=headers.indexOf(x);if(i>=0)return i}return -1};
    const ni=col("name","student name"),ri=col("roll no","roll number"),ci=col("class","class name","group","group name"),pi=col("password");
    if([ni,ri,ci,pi].some(x=>x<0))throw new Error("Required columns: Name, Roll No, Class, Password.");
    bulkStudents=raw.slice(1).map((row,i)=>({row:i+2,name:norm(row[ni]),roll_no:norm(row[ri]),className:norm(row[ci]),password:norm(row[pi])})).filter(x=>x.name||x.roll_no||x.className||x.password);
    if(!bulkStudents.length)throw new Error("No student rows found.");
    const errors=[],seen=new Set();
    bulkStudents.forEach(x=>{const k=x.className.toLowerCase()+"|"+x.roll_no.toLowerCase();if(!x.name)errors.push(`Row ${x.row}: Name missing`);if(!x.roll_no)errors.push(`Row ${x.row}: Roll No missing`);if(!x.className)errors.push(`Row ${x.row}: Class/Group missing`);if(!x.password)errors.push(`Row ${x.row}: Password missing`);if(x.password&&x.password.length<6)errors.push(`Row ${x.row}: Password must be at least 6 characters`);if(seen.has(k))errors.push(`Row ${x.row}: duplicate Roll No ${x.roll_no} in ${x.className}`);seen.add(k)});
    if(errors.length){document.getElementById("bulkPreview").innerHTML=message(errors.join(" | "));return;}
    document.getElementById("bulkPreview").innerHTML=`<div class="success">Loaded ${bulkStudents.length} student rows. Review before creating accounts.</div><div style="overflow:auto"><table><thead><tr><th>#</th><th>Name</th><th>Roll No</th><th>JNVST Group</th><th>Password</th></tr></thead><tbody>${bulkStudents.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name)}</td><td>${esc(x.roll_no)}</td><td>${esc(x.className)}</td><td>${esc(x.password)}</td></tr>`).join("")}</tbody></table></div>`;
  }catch(err){document.getElementById("bulkPreview").innerHTML=message("Could not read Excel: "+err.message)}};r.readAsArrayBuffer(file);
}
async function uploadJnvstBulkStudents(){
  if(!bulkStudents.length)return notify("Upload an Excel file first.");
  if(!confirm(`You are about to create ${bulkStudents.length} JNVST student account(s).\n\nPlease confirm that the Excel data has been checked carefully.`))return;
  try{
    const {data:classes,error}=await sb.from("classes").select("id,name,course").eq("teacher_id",current.id);
    if(error)throw error;
    const cmap=new Map((classes||[]).filter(c=>String(c.course||"").toUpperCase().startsWith("JNVST")).map(c=>[String(c.name).trim().toLowerCase(),c.id]));
    const missing=[...new Set(bulkStudents.filter(x=>!cmap.has(x.className.toLowerCase())).map(x=>x.className))];
    if(missing.length)throw new Error("JNVST Class/Group not found: "+missing.join(", "));
    const j=await callTeacherFn({action:"createStudents",students:bulkStudents.map(x=>({name:x.name,roll_no:x.roll_no,password:x.password,class_id:cmap.get(x.className.toLowerCase())}))});
    const results=j.results||[],ok=results.filter(x=>x.success),bad=results.filter(x=>!x.success);
    render(`<div class="wrap">${header("Bulk JNVST Student Import Result")}<div class="card"><div class="success">Successfully created: ${ok.length}</div>${bad.length?`<div class="notice">Failed: ${bad.length}<br>${bad.map(x=>esc(`${x.name||""}: ${x.error||"Unknown error"}`)).join("<br>")}</div>`:""}<div class="actions"><button onclick="manageStudentAccounts()">Student Accounts</button><button class="secondary" onclick="teacherHome()">← Dashboard</button></div></div></div>`);
  }catch(e){notify(e.message||String(e))}
}
async function manageStudentAccounts(){
 try{
  const j=await callTeacherFn({action:"listCredentials"});
  const students=(j.students||[]).filter(s=>{const c=String(s.course||"").toUpperCase();return c.startsWith("JNVST")||((s.memberships||[]).some(m=>String(m.course||"").toUpperCase().startsWith("JNVST")));});
  const allGroups=(j.groups||[]).map(g=>({
    key:`${g.main_group_id||g.id||""}::${g.is_subgroup?g.id:""}`,
    mainId:g.main_group_id||g.id||"",
    mainName:g.main_group_name||g.name||"",
    subId:g.is_subgroup?g.id:"",
    subName:g.is_subgroup?g.name:""
  })).filter(g=>g.mainId);
  // Backward-compatible fallback if an older Edge Function does not yet
  // return the explicit group list.
  if(!allGroups.length){
    students.forEach(s=>(s.memberships||[]).forEach(m=>{
      const key=`${m.main_group_id||""}::${m.class_id||""}`;
      if(!allGroups.some(g=>g.key===key))allGroups.push({
        key,mainId:m.main_group_id||"",mainName:m.main_group_name||"",
        subId:m.is_subgroup?m.class_id:"",subName:m.is_subgroup?m.class_name:""
      });
    }));
  }
  allGroups.sort((a,b)=>`${a.mainName} ${a.subName}`.localeCompare(`${b.mainName} ${b.subName}`));
  window._jnvstAccountStudents=students;
  window._jnvstAccountGroups=allGroups;
  renderJnvstStudentAccounts();
 }catch(e){render(`<div class="wrap">${header("JNVST Student Accounts")}<div class="card">${message(e.message||String(e))}<div class="actions"><button class="secondary" onclick="teacherHome()">← Dashboard</button></div></div></div>`)}
}
function renderJnvstStudentAccounts(preserveSearchFocus=false){
 const searchEl=document.getElementById("jnvstStudentSearch");
 const previousSearchValue=searchEl?.value||"";
 const previousSearchStart=searchEl?.selectionStart;
 const previousSearchEnd=searchEl?.selectionEnd;
 const students=window._jnvstAccountStudents||[];
 const groups=window._jnvstAccountGroups||[];
 const q=(document.getElementById("jnvstStudentSearch")?.value||"").trim().toLowerCase();
 const main=(document.getElementById("jnvstStudentMainFilter")?.value||"all");
 const sub=(document.getElementById("jnvstStudentSubFilter")?.value||"all");
 const rows=students.filter(s=>{
   const text=`${s.full_name||""} ${s.roll_no||""} ${s.username||""}`.toLowerCase();
   if(q&&!text.includes(q))return false;
   const ms=s.memberships||[];
   const normalizedMs=ms.map(m=>{
     if(m.main_group_id)return m;
     const g=groups.find(x=>String(x.id)===String(m.class_id));
     return g?{...m,main_group_id:g.mainId,main_group_name:g.mainName,is_subgroup:g.subId===m.class_id}:m;
   });
   if(main!=="all"&&!normalizedMs.some(m=>String(m.main_group_id)===main))return false;
   if(sub!=="all"&&!normalizedMs.some(m=>String(m.class_id)===sub))return false;
   return true;
 });
 const mains=[...new Map(groups.filter(g=>g.mainId).map(g=>[g.mainId,{id:g.mainId,name:g.mainName}])).values()].sort((a,b)=>a.name.localeCompare(b.name));
 const subs=groups.filter(g=>g.subId&&(main==="all"||g.mainId===main)).sort((a,b)=>a.subName.localeCompare(b.subName));
 const groupLabel=s=>{
   const m=s.memberships||[];
   const subg=m.find(x=>x.is_subgroup && x.class_id);
   if(subg)return `${subg.main_group_name||"JNVST"} → ${subg.class_name}`;
   const mainm=m.find(x=>x.main_group_id||x.class_id);
   if(mainm)return `${mainm.main_group_name||mainm.class_name||"JNVST"} → Main group`;
   // Legacy/fallback: derive the display label from the explicit group list.
   const candidate=(window._jnvstAccountGroups||[]).find(g=>g.subId===s.class_id);
   return candidate?`${candidate.mainName} → ${candidate.subName}`:"Not grouped";
 };
 const targetOptions=s=>{
   let available=(s.available_subgroups||[]).filter(x=>x.class_id);
   if(!available.length){
     const mainIds=new Set((s.memberships||[]).map(m=>String(m.main_group_id||"")).filter(Boolean));
     available=(window._jnvstAccountGroups||[])
       .filter(g=>g.subId && mainIds.has(String(g.mainId)))
       .map(g=>({class_id:g.subId,class_name:g.subName,main_group_id:g.mainId,main_group_name:g.mainName}));
   }
   return available.length?available.map(x=>`<option value="${esc(x.class_id)}">${esc(x.class_name)}</option>`).join(""):'<option value="">No sub-groups available</option>';
 };
 document.getElementById("app").innerHTML=`${header("JNVST Student Accounts")}
  <div class="card" style="border:2px solid #f59e0b;background:#fffbeb">
   <h3 style="margin-bottom:6px">⚠ Student Account Management</h3>
   <p class="small" style="margin:0">Changes here affect the student's login and JNVST group. Check the details carefully before saving. Group changes affect future assignments; existing assignment records are not automatically recreated.</p>
  </div>
  <div class="card">
   <div class="grid">
    <div><label>Search</label><input id="jnvstStudentSearch" value="${esc(q)}" placeholder="Name / Roll No / Username" oninput="renderJnvstStudentAccounts(true)"></div>
    <div><label>Main Group</label><select id="jnvstStudentMainFilter" onchange="updateJnvstStudentSubFilter();renderJnvstStudentAccounts()"><option value="all">All Main Groups</option>${mains.map(g=>`<option value="${esc(g.id)}" ${g.id===main?'selected':''}>${esc(g.name)}</option>`).join("")}</select></div>
    <div><label>Sub-Group</label><select id="jnvstStudentSubFilter" onchange="renderJnvstStudentAccounts()"><option value="all">All Sub-Groups</option>${subs.map(g=>`<option value="${esc(g.subId)}" ${g.subId===sub?'selected':''}>${esc(g.mainName)} → ${esc(g.subName)}</option>`).join("")}</select></div>
   </div>
   <div class="small muted">Showing ${rows.length} of ${students.length} JNVST student(s).</div>
  </div>
  <div class="card"><div style="overflow:auto"><table><thead><tr><th>Student</th><th>Roll No</th><th>Password</th><th>JNVST Group</th><th>Change Group</th><th>Actions</th></tr></thead><tbody>
  ${rows.map(s=>`<tr>
   <td><b>${esc(s.full_name||"")}</b><div class="small muted">${esc(s.username||"")}</div></td>
   <td>${esc(s.roll_no||"—")}</td>
   <td><code>${esc(s.password||"—")}</code></td>
   <td>${esc(groupLabel(s))}</td>
   <td><select id="jnvstTarget_${s.id}" style="min-width:190px;margin:0">${targetOptions(s)}</select><button class="secondary" style="margin-top:5px" onclick="changeJnvstStudentGroup('${s.id}')">Change Group</button></td>
   <td><div class="actions"><button onclick="editJnvstStudent('${s.id}')">✎ Edit</button><button class="secondary" onclick="enrollJnvstPastAssignments('${s.id}')">📚 Past Assignments</button><button class="secondary" onclick="changeJnvstStudentRoll('${s.id}')">Roll No</button><button class="secondary" onclick="changeJnvstStudentPassword('${s.id}')">Password</button><button class="danger" onclick="deleteJnvstStudent('${s.id}')">Delete</button></div></td>
  </tr>`).join("")||'<tr><td colspan="6">No JNVST students match the selected filter.</td></tr>'}
  </tbody></table></div><div class="actions" style="margin-top:15px"><button class="secondary" onclick="teacherHome()">← Dashboard</button></div></div>`;
 if(preserveSearchFocus){
   const el=document.getElementById("jnvstStudentSearch");
   if(el){
     el.focus();
     const posStart=Number.isInteger(previousSearchStart)?previousSearchStart:el.value.length;
     const posEnd=Number.isInteger(previousSearchEnd)?previousSearchEnd:posStart;
     try{el.setSelectionRange(posStart,posEnd);}catch(_e){}
   }
 }
}
function updateJnvstStudentSubFilter(){
 const main=document.getElementById("jnvstStudentMainFilter")?.value||"all";
 const sel=document.getElementById("jnvstStudentSubFilter");if(!sel)return;
 const groups=window._jnvstAccountGroups||[];
 sel.innerHTML='<option value="all">All Sub-Groups</option>'+groups.filter(g=>g.subId&&(main==="all"||g.mainId===main)).sort((a,b)=>a.subName.localeCompare(b.subName)).map(g=>`<option value="${esc(g.subId)}">${esc(g.mainName)} → ${esc(g.subName)}</option>`).join("");
}
async function changeJnvstStudentGroup(studentId){
 const s=(window._jnvstAccountStudents||[]).find(x=>x.id===studentId);if(!s)return;
 const target=document.getElementById(`jnvstTarget_${studentId}`)?.value||"";
 if(!target)return notify("No target sub-group is available for this student.");
 const targetName=document.getElementById(`jnvstTarget_${studentId}`)?.selectedOptions?.[0]?.textContent||"selected group";
 const current=(s.memberships||[]).find(m=>m.is_subgroup)?.class_name||(s.memberships||[])[0]?.class_name||"Main group";
 if((s.memberships||[]).some(m=>m.class_id===target))return notify(`${s.full_name} is already in ${targetName}.`);
 if(!confirm(`WARNING: Change JNVST group for ${s.full_name}?\n\nCurrent: ${current}\nNew: ${targetName}\n\nThis changes the student's JNVST group membership. Continue?`))return;
 try{
  await callTeacherFn({action:"setStudentJnvstSubgroup",student_id:studentId,target_class_id:target});
  notify(`${s.full_name} was moved to ${targetName}.`);
  await manageStudentAccounts();
 }catch(e){notify("Could not change group: "+(e.message||e))}
}
async function changeJnvstStudentRoll(studentId){const s=(window._jnvstAccountStudents||[]).find(x=>x.id===studentId);if(!s)return;const v=prompt(`New Roll No for ${s.full_name}:`,s.roll_no||"");if(v===null)return;if(!v.trim())return notify("Roll No is required.");if(!confirm(`Change Roll No for ${s.full_name} to "${v.trim()}"?`))return;try{await callTeacherFn({action:"setStudentRollNo",student_id:studentId,roll_no:v.trim()});notify("Roll No updated.");await manageStudentAccounts()}catch(e){notify(e.message||e)}}
async function enrollJnvstPastAssignments(studentId){
  const student=(window._jnvstAccountStudents||[]).find(x=>String(x.id)===String(studentId));
  if(!student)return notify("Student not found.");

  // Read the student's actual current JNVST memberships directly. This avoids
  // depending on the credential Edge Function's display payload.
  const {data:membershipRows,error:me}=await sb.from("class_students")
    .select("class_id, classes!inner(id,name,course,jnvst_group_type,jnvst_parent_id,description)")
    .eq("student_id",studentId);
  if(me)return notify("Could not load the student's JNVST group: "+me.message);
  const memberships=(membershipRows||[]).map(x=>({
    class_id:x.class_id,
    class:x.classes
  })).filter(x=>String(x.class?.course||"").toUpperCase().startsWith("JNVST"));
  if(!memberships.length)return notify("This student is not linked to a JNVST main group/sub-group.");

  const {data:classes,error:ce}=await sb.from("classes")
    .select("id,name,course,jnvst_group_type,jnvst_parent_id,description")
    .eq("teacher_id",current.id);
  if(ce)return notify("Could not load JNVST groups: "+ce.message);
  const classMap=new Map((classes||[]).map(c=>[String(c.id),c]));
  const memberSubIds=new Set();
  const memberMainIds=new Set();
  const studentSubNames=new Set();
  const studentMainNames=new Set();
  memberships.forEach(m=>{
    const c=classMap.get(String(m.class_id))||m.class;
    if(!c)return;
    if(isJnvstSubGroup(c)){
      memberSubIds.add(String(c.id));
      studentSubNames.add(String(c.name||"").trim().toLowerCase());
      if(c.jnvst_parent_id)memberMainIds.add(String(c.jnvst_parent_id));
    }else{
      memberMainIds.add(String(c.id));
      studentMainNames.add(String(c.name||"").trim().toLowerCase());
    }
  });
  memberMainIds.forEach(id=>{
    const c=classMap.get(String(id));
    if(c)studentMainNames.add(String(c.name||"").trim().toLowerCase());
  });

  const {data:assignments,error:ae}=await sb.from("assignments")
    .select("id,title,subject,class_id,main_group,sub_group,assignment_type,created_at")
    .eq("created_by",current.id)
    .order("created_at",{ascending:false});
  if(ae)return notify("Could not load assignments: "+ae.message);

  // An assignment matches when it belongs to the student's sub-group, or to
  // the student's main group without a restrictive sub-group, or explicitly
  // names the student's sub-group among multiple sub-groups.
  const matching=(assignments||[]).filter(a=>{
    const c=classMap.get(String(a.class_id||""));
    // Only JNVST assignments are eligible here. The previous condition was
    // inverted and therefore excluded every JNVST assignment.
    if(!c || !String(c.course||"").toUpperCase().startsWith("JNVST"))return false;
    const classId=String(a.class_id||"");
    const mainId=String(c.jnvst_parent_id||classId);
    const subText=String(a.sub_group||"").trim();
    const subNames=subText?subText.split(/\s*,\s*/).map(x=>x.trim().toLowerCase()).filter(Boolean):[];
    if(memberSubIds.has(classId))return true;
    if(memberMainIds.has(classId) && !subText)return true;
    if(memberMainIds.has(mainId) && (!subText || subNames.some(n=>studentSubNames.has(n))))return true;
    // Older assignments may not have parent metadata populated; use stored
    // main_group/sub_group labels as a backward-compatible fallback.
    const aMain=String(a.main_group||"").trim().toLowerCase();
    const aSub=subNames;
    if(aMain && studentMainNames.has(aMain) && (!a.sub_group || aSub.some(n=>studentSubNames.has(n))))return true;
    return false;
  });

  const ids=matching.map(a=>a.id);
  let links=[];
  if(ids.length){
    const {data,error}=await sb.from("assignment_students")
      .select("assignment_id,current_attempt_number")
      .eq("student_id",studentId)
      .in("assignment_id",ids);
    if(error)return notify("Could not check existing assignments: "+error.message);
    links=links||[];
    links= data||[];
  }
  const linked=new Set(links.map(x=>String(x.assignment_id)));

  window._jnvstPastEnrollment={
    studentId,
    matching,
    selected:new Set(matching.filter(a=>!linked.has(String(a.id))).map(a=>String(a.id))),
    linked
  };
  renderJnvstPastAssignmentEnrollment();
}
function renderJnvstPastAssignmentEnrollment(preserveSearchFocus=false){
  const searchEl=document.getElementById("pastAssignSearch");
  const previousSearchValue=searchEl?.value||"";
  const previousSearchStart=searchEl?.selectionStart;
  const previousSearchEnd=searchEl?.selectionEnd;
  const st=window._jnvstAccountStudents?.find(x=>String(x.id)===String(window._jnvstPastEnrollment?.studentId));
  const state=window._jnvstPastEnrollment;
  if(!st||!state)return manageStudentAccounts();
  const q=(document.getElementById("pastAssignSearch")?.value||"").trim().toLowerCase();
  const type=(document.getElementById("pastAssignType")?.value||"all").toUpperCase();
  const rows=state.matching.filter(a=>{
    const text=`${a.title||""} ${a.subject||""}`.toLowerCase();
    if(q&&!text.includes(q))return false;
    if(type!=="ALL"&&String(a.assignment_type||"").toUpperCase()!==type)return false;
    return true;
  });
  const selectedCount=state.selected.size;
  const newCount=[...state.selected].filter(id=>!state.linked.has(id)).length;
  const alreadyCount=state.linked.size;

  render(`<div class="wrap">${header("Enroll Past Assignments")}
    <div class="card" style="border:2px solid #2563eb;background:#f8fbff">
      <h2 style="margin:0 0 5px">📚 ${esc(st.full_name||"Student")}</h2>
      <div class="muted">Roll No: <b>${esc(st.roll_no||"—")}</b></div>
      <div class="small muted" style="margin-top:5px">Matching past assignments: <b>${state.matching.length}</b> · Already assigned: <b>${alreadyCount}</b> · Selected: <b>${selectedCount}</b></div>
    </div>
    <div class="card">
      <div class="actions" style="margin-bottom:10px">
        <button onclick="selectAllPastAssignments()">✓ Select All Matching</button>
        <button class="secondary" onclick="clearPastAssignments()">Clear All</button>
        <button class="secondary" onclick="selectAllVisiblePastAssignments()">Select All Visible</button>
      </div>
      <div class="grid">
        <div><label>Search</label><input id="pastAssignSearch" value="${esc(q)}" placeholder="Assignment title / subject" oninput="renderJnvstPastAssignmentEnrollment(true)"></div>
        <div><label>Type</label><select id="pastAssignType" onchange="renderJnvstPastAssignmentEnrollment()"><option value="all">All Types</option><option value="MCQ">MCQ</option><option value="VIDEO">Video + MCQ</option></select></div>
      </div>
    </div>
    <div class="card">
      ${rows.length?rows.map(a=>{
        const id=String(a.id), linked=state.linked.has(id), checked=state.selected.has(id);
        const c=(window._jnvstAccountGroups||[]).find(g=>String(g.subId||g.mainId)===String(a.class_id||""));
        const groupLabel=a.sub_group?`${a.main_group||""} → ${a.sub_group}`:(a.main_group||c?.mainName||"JNVST");
        return `<label style="display:block;padding:11px 4px;border-bottom:1px solid #e5e7eb;cursor:pointer">
          <input class="past-assignment-check" type="checkbox" value="${esc(id)}" ${checked?"checked":""} ${linked?"disabled":""} onchange="togglePastAssignment('${esc(id)}',this.checked)" style="width:auto;margin-right:9px">
          <b>${esc(a.title||"Untitled")}</b>
          <span class="tag" style="margin-left:7px">${esc(a.assignment_type||"MCQ")}</span>
          <div class="small muted" style="margin:4px 0 0 25px">${esc(a.subject||"")} · ${esc(groupLabel)} · ${linked?"Already assigned":"Available for enrollment"}</div>
        </label>`;
      }).join(""):`<div class="notice">No matching past assignments were found for this student's JNVST group.</div>`}
    </div>
    <div class="card">
      <div class="success">Ready to enroll: <b>${newCount}</b> assignment${newCount===1?"":"s"}.</div>
      <div class="actions" style="margin-top:10px">
        <button onclick="savePastAssignmentEnrollment()">📚 Enroll Selected</button>
        <button class="secondary" onclick="manageStudentAccounts()">← Back to Student Accounts</button>
      </div>
    </div>
  </div>`);
  if(preserveSearchFocus){
    const el=document.getElementById("pastAssignSearch");
    if(el){
      el.focus();
      const posStart=Number.isInteger(previousSearchStart)?previousSearchStart:el.value.length;
      const posEnd=Number.isInteger(previousSearchEnd)?previousSearchEnd:posStart;
      try{el.setSelectionRange(posStart,posEnd);}catch(_e){}
    }
  }
}
function togglePastAssignment(id,checked){
  const state=window._jnvstPastEnrollment;if(!state)return;
  if(state.linked.has(String(id)))return;
  if(checked)state.selected.add(String(id));else state.selected.delete(String(id));
}
function selectAllPastAssignments(){
  const s=window._jnvstPastEnrollment;if(!s)return;
  s.matching.forEach(a=>{if(!s.linked.has(String(a.id)))s.selected.add(String(a.id));});
  renderJnvstPastAssignmentEnrollment();
}
function clearPastAssignments(){
  const s=window._jnvstPastEnrollment;if(!s)return;
  s.selected=new Set([...s.selected].filter(id=>s.linked.has(id)));
  renderJnvstPastAssignmentEnrollment();
}
function selectAllVisiblePastAssignments(){
  const s=window._jnvstPastEnrollment;if(!s)return;
  const q=(document.getElementById("pastAssignSearch")?.value||"").trim().toLowerCase();
  const type=(document.getElementById("pastAssignType")?.value||"all").toUpperCase();
  s.matching.forEach(a=>{
    const text=`${a.title||""} ${a.subject||""}`.toLowerCase();
    const ok=(!q||text.includes(q))&&(type==="ALL"||String(a.assignment_type||"").toUpperCase()===type);
    if(ok&&!s.linked.has(String(a.id)))s.selected.add(String(a.id));
  });
  renderJnvstPastAssignmentEnrollment();
}
async function savePastAssignmentEnrollment(){
  const s=window._jnvstPastEnrollment;if(!s)return;
  const ids=[...s.selected].filter(id=>!s.linked.has(id));
  if(!ids.length)return notify("No new assignments are selected.");
  const student=window._jnvstAccountStudents?.find(x=>String(x.id)===String(s.studentId));
  if(!student)return;
  if(!confirm(`Enroll ${student.full_name} in ${ids.length} past assignment${ids.length===1?"":"s"}?\n\nExisting assignments will not be duplicated.`))return;
  try{
    // Re-check existing links immediately before insert to avoid duplicates
    // when the teacher has another tab open or clicks twice.
    const {data:existing,error:ee}=await sb.from("assignment_students")
      .select("assignment_id")
      .eq("student_id",s.studentId)
      .in("assignment_id",ids);
    if(ee)throw ee;
    const existingSet=new Set((existing||[]).map(x=>String(x.assignment_id)));
    const rows=ids.filter(id=>!existingSet.has(String(id))).map(assignment_id=>({
      assignment_id,student_id:s.studentId,current_attempt_number:1
    }));
    if(rows.length){
      const {error:ie}=await sb.from("assignment_students").insert(rows);
      if(ie)throw ie;
    }
    const skipped=ids.length-rows.length;
    notify(`Enrollment completed.\n\nNew assignments: ${rows.length}\nAlready assigned: ${skipped}`);
    await manageStudentAccounts();
  }catch(e){
    notify("Could not enroll past assignments.\n\n"+(e.message||e));
  }
}
async function changeJnvstStudentPassword(studentId){const s=(window._jnvstAccountStudents||[]).find(x=>x.id===studentId);if(!s)return;const v=prompt(`New password for ${s.full_name}:`);if(v===null)return;if(v.length<6)return notify("Password must be at least 6 characters.");if(!confirm(`Change the login password for ${s.full_name}?`))return;try{await callTeacherFn({action:"setStudentPassword",student_id:studentId,password:v});notify("Password updated.");await manageStudentAccounts()}catch(e){notify(e.message||e)}}
async function editJnvstStudent(studentId){const s=(window._jnvstAccountStudents||[]).find(x=>x.id===studentId);if(!s)return;render(`<div class="wrap">${header("Edit JNVST Student")}<div class="card"><div class="notice">⚠ Check all information carefully. Saving changes modifies the student's account information.</div><label>Student Name</label><input id="jseName" value="${esc(s.full_name||"")}"><label>Roll No</label><input id="jseRoll" value="${esc(s.roll_no||"")}"><label>New Password <span class="muted small">(leave blank to keep current)</span></label><input id="jsePass" type="text"><div class="actions"><button onclick="saveJnvstStudent('${studentId}')">💾 Save Changes</button><button class="secondary" onclick="manageStudentAccounts()">Cancel</button></div></div></div>`)}
async function saveJnvstStudent(studentId){const s=(window._jnvstAccountStudents||[]).find(x=>x.id===studentId);if(!s)return;const name=document.getElementById("jseName")?.value.trim(),roll=document.getElementById("jseRoll")?.value.trim(),pass=document.getElementById("jsePass")?.value||"";if(!name||!roll)return notify("Name and Roll No are required.");if(pass&&pass.length<6)return notify("Password must be at least 6 characters.");if(!confirm(`WARNING: Save changes to ${s.full_name}?\n\nName: ${name}\nRoll No: ${roll}${pass?"\nPassword: will be changed":""}\n\nContinue?`))return;try{await callTeacherFn({action:"setStudentName",student_id:studentId,full_name:name});if(roll!==String(s.roll_no||""))await callTeacherFn({action:"setStudentRollNo",student_id:studentId,roll_no:roll});if(pass)await callTeacherFn({action:"setStudentPassword",student_id:studentId,password:pass});notify("Student details updated successfully.");await manageStudentAccounts()}catch(e){notify("Could not save changes: "+(e.message||e))}}
async function deleteJnvstStudent(studentId){const s=(window._jnvstAccountStudents||[]).find(x=>x.id===studentId);if(!s)return;if(!confirm(`WARNING: Delete the JNVST student account for ${s.full_name}?\n\nThis will permanently remove the student's login account. This action cannot be undone.\n\nClick OK only if you are certain.`))return;const typed=prompt(`Final confirmation. Type the student's name exactly:\n\n${s.full_name}`);if(typed===null||typed.trim()!==String(s.full_name||"").trim())return notify("Deletion cancelled. Student name did not match.");try{await callTeacherFn({action:"deleteStudent",student_id:studentId});notify("Student account deleted.");await manageStudentAccounts()}catch(e){notify(e.message||e)}}
function manageJnvstClasses(){
 const classes=(window._jnvstClasses||[]),students=(window._jnvstStudents||[]),assignments=(window._jnvstAssignments||[]);
 const mains=jnvstMainGroups(classes);
 const mainCards=mains.map(m=>{
   const subs=jnvstSubgroupsForMain(classes,m);
   const fixed=!!jnvstBaseKey(m);
   const mc=students.filter(x=>x.class_id===m.id).length, ma=assignments.filter(x=>x.class_id===m.id).length;
   return `<div class="student-card" style="border:2px solid #dbeafe;background:#f8fbff;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
      <div><h3 style="margin:0">${fixed?"📘":"📁"} ${esc(m.name)}</h3>
      <div class="small muted">${fixed?"Fixed main group — cannot be deleted.":"Teacher-created main group."} • ${mc} direct student(s) • ${ma} assignment(s)</div></div>
      ${fixed?"":`<button class="danger" onclick="deleteJnvstMainGroup('${m.id}')">Delete Main Group</button>`}
    </div>
    <div style="margin-top:12px">${subs.length?subs.map(c=>{
      const sc=students.filter(x=>x.class_id===c.id).length,ac=assignments.filter(x=>x.class_id===c.id).length;
      return `<div class="student-card" style="background:#fff"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><b>${esc(c.name)}</b><div class="small muted">${sc} student(s) • ${ac} assignment(s)</div></div><button class="danger" onclick="deleteJnvstClass('${c.id}')">Delete Sub-group</button></div></div>`;
    }).join(""):"<div class='muted small'>No sub-groups yet.</div>"}</div>
    <button style="margin-top:10px" onclick="newJnvstSubgroup('${esc(m.id)}')">+ Create Sub-group</button>
   </div>`;
 }).join("");
 const subjects=jnvstSubjects||[];
 return render(`<div class="wrap">${header("Manage JNVST Groups & Subjects")}
  <div class="card"><div class="notice"><b>Assignment structure:</b> Main Group → Sub-group(s) → Students. JNVST-VI and JNVST-IX are fixed main groups. You may create additional main groups, sub-groups and subjects.</div>
   <div class="actions" style="margin-top:12px"><button onclick="newJnvstMainGroup()">+ Create Main Group</button><button onclick="newJnvstSubject()">+ Create Subject</button><button onclick="jnvstLessonBulkUpload()">↑ Bulk Upload Lessons / Sub-lessons</button><button class="secondary" onclick="downloadJnvstLessonTemplate()">↓ Excel Template</button><button class="secondary" onclick="teacherHome()">← Dashboard</button></div>
  </div>
  <div class="card"><h2>📚 Main Groups & Sub-groups</h2>${mainCards||"<div class='notice'>No groups found.</div>"}</div>
  <div class="card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><h2 style="margin:0">📖 Subjects, Lessons & Sub-lessons</h2><div class="actions"><button onclick="jnvstLessonBulkUpload()">📥 Bulk Upload Lessons / Sub-lessons</button><button class="secondary" onclick="downloadJnvstLessonTemplate()">⬇ Excel Template</button><button onclick="jnvstQuestionBankHome()">📚 JNVST Question Bank</button><button onclick="jnvstManualAddQuestion()">➕ Add JNVST Question</button><button onclick="jnvstQuestionBulkUpload()">📥 Bulk Upload JNVST Questions</button><button class="secondary" onclick="downloadJnvstQuestionTemplate()">⬇ Question Template</button></div></div><div class="notice" style="margin-top:10px">Create the JNVST teaching hierarchy <b>Subject → Lesson → Sub-lesson</b>. JNVST and School Course Question Banks are separate. JNVST questions use this hierarchy; School Course questions use <b>Subject → Chapter → Subchapter → Topic</b> in the School Teacher Dashboard.</div>${subjects.length?subjects.map(x=>{const ls=(jnvstSubjectLessons||[]).filter(l=>l.subject_id===x.id);const roots=ls.filter(l=>!l.parent_lesson_id);const renderLesson=(l,depth=0)=>{const kids=ls.filter(k=>k.parent_lesson_id===l.id);return `<div class="student-card" style="margin:${depth?6:8}px 0 0 ${depth*24}px;background:${depth?'#f8fafc':'#fff'}"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><b>${esc(l.lesson_code||'')}</b> ${esc(l.lesson_name)}${l.description?`<div class="small muted">${esc(l.description)}</div>`:''}<div class="small muted">${kids.length?kids.length+' sub-lesson(s)':''}</div></div><div class="actions"><button class="secondary" onclick="editJnvstLesson('${l.id}')">✎ Edit</button><button class="secondary" onclick="newJnvstLesson('${x.id}','${l.id}')">+ Sub-lesson</button><button class="danger" onclick="deleteJnvstLesson('${l.id}')">Delete</button></div></div>${kids.map(k=>renderLesson(k,depth+1)).join('')}</div>`};return `<div class="student-card" style="background:#eff6ff;border:1px solid #bfdbfe"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><b>${esc(x.name)}</b>${x.description?`<div class="small muted">${esc(x.description)}</div>`:''}</div><div class="actions"><button onclick="newJnvstLesson('${x.id}','')">+ Create Lesson</button><button class="danger" onclick="deleteJnvstSubject('${x.id}')">Delete Subject</button></div></div><div style="margin-top:8px">${roots.length?roots.map(l=>renderLesson(l,0)).join(''):'<div class="muted small">No lessons yet. Create the first lesson.</div>'}</div></div>`}).join(""):"<div class='muted'>No subjects. Create one to use it in assignments.</div>"}</div>
 </div>`);
}
function downloadJnvstLessonTemplate(){
 try{
  if(typeof XLSX==='undefined')return notify('Excel library is not loaded. Please refresh the page and try again.');
  const wb=XLSX.utils.book_new();
  const rows=[
   ['Subject Name','Lesson Code','Lesson Name','Parent Lesson Code','Description'],
   ['Arithmetic','1','Number System','','Numbers, place value and related concepts'],
   ['Arithmetic','1.1','Place Value','1','Place value and face value'],
   ['Arithmetic','1.2','Roman Numerals','1','Roman numeral basics'],
   ['Arithmetic','2','Fractions','','Fractions and their operations'],
   ['Arithmetic','2.1','Like Fractions','2','Addition and subtraction of like fractions'],
   ['EVS','1','Family and Friends','','Sample EVS lesson'],
   ['EVS','1.1','Relationships','1','Sub-lesson example']
  ];
  const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:22},{wch:16},{wch:34},{wch:22},{wch:48}];
  XLSX.utils.book_append_sheet(wb,ws,'Lessons');
  const ins=XLSX.utils.aoa_to_sheet([
   ['JNVST Lesson / Sub-lesson Bulk Upload — Instructions'],
   ['1. Subject Name must exactly match an existing JNVST Subject in Manage JNVST Groups & Subjects.'],
   ['2. Lesson Code must be unique within the Subject. Examples: 1, 1.1, 1.2, 2, 2.1.'],
   ['3. Leave Parent Lesson Code blank for a top-level Lesson.'],
   ['4. For a Sub-lesson, enter the Lesson Code of its parent in Parent Lesson Code.'],
   ['5. The parent may be in the same Excel file and is processed before its children.'],
   ['6. Existing lesson codes are not duplicated. The preview will report conflicts before saving.'],
   ['7. This file creates JNVST Subject → Lesson → Sub-lesson only. It does not create School Course chapters.'],
   ['8. JNVST and School Course Question Banks are separate.'],
   ['9. After creating the hierarchy, assign JNVST questions to the correct Subject + Lesson/Sub-lesson.']
  ]);
  ins['!cols']=[{wch:110}];XLSX.utils.book_append_sheet(wb,ins,'Instructions');
  XLSX.writeFile(wb,'JNVST_Lesson_Sublesson_Bulk_Upload_Template.xlsx');
 }catch(e){notify('Could not create template: '+(e.message||e))}
}
function jnvstLessonBulkUpload(){
 jnvstLessonBulkRows=[];
 render(`<div class="wrap">${header('Bulk Upload JNVST Lessons / Sub-lessons')}
  <div class="card" style="border:2px solid #2563eb;background:#eff6ff">
   <h2 style="margin:0;color:#1d4ed8">↑ Bulk Upload Lessons / Sub-lessons</h2>
   <p class="muted">Upload an Excel file to create the <b>JNVST Course</b> hierarchy <b>Subject → Lesson → Sub-lesson</b>. This does not create or modify School Course Chapter/Subchapter data.</p>
   <div class="actions"><button class="secondary" onclick="downloadJnvstLessonTemplate()">↓ Download Excel Template</button><button class="secondary" onclick="manageJnvstClasses()">← Back</button></div>
  </div>
  <div class="card">
   <label>Excel File (.xlsx / .xls)</label>
   <input id="jnvstLessonExcel" type="file" accept=".xlsx,.xls" onchange="readJnvstLessonExcel(event)">
   <div id="jnvstLessonBulkPreview" class="small muted" style="margin-top:10px">No file selected.</div>
  </div>
  <div class="card"><h3>Required columns</h3><p><b>Subject Name, Lesson Code, Lesson Name</b><br>Optional: <b>Parent Lesson Code, Description</b></p>
   <div class="notice small">Top-level lessons have a blank Parent Lesson Code. Sub-lessons must use the Lesson Code of their parent. The system validates the complete file before inserting anything.</div>
  </div>
  <div class="actions"><button id="jnvstLessonImportBtn" disabled onclick="saveJnvstLessonBulk()">✓ Validate & Import</button><button class="secondary" onclick="manageJnvstClasses()">Cancel</button></div>
 </div>`);
}
function jnvstNormHeader(v){return String(v??'').trim().toLowerCase().replace(/[_\s-]+/g,' ')}
function readJnvstLessonExcel(ev){
 const file=ev.target.files?.[0];if(!file)return;const box=document.getElementById('jnvstLessonBulkPreview'),btn=document.getElementById('jnvstLessonImportBtn');
 if(!box)return;btn.disabled=true;jnvstLessonBulkRows=[];
 const r=new FileReader();r.onload=e=>{try{
  const wb=XLSX.read(e.target.result,{type:'array'});const ws=wb.Sheets[wb.SheetNames.find(n=>jnvstNormHeader(n)==='lessons')||wb.SheetNames[0]];const raw=XLSX.utils.sheet_to_json(ws,{defval:''});
  if(!raw.length){box.innerHTML=message('The Excel sheet contains no data.');return}
  jnvstLessonBulkRows=raw.map((row,i)=>({row:i+2,subject:jnvstGetCell(row,['Subject Name','Subject']),code:jnvstGetCell(row,['Lesson Code','Code']),name:jnvstGetCell(row,['Lesson Name','Lesson','Name']),parentCode:jnvstGetCell(row,['Parent Lesson Code','Parent Code','Parent Lesson']),description:jnvstGetCell(row,['Description'])}));
  const errors=[];const warnings=[];const subjectMap=new Map((jnvstSubjects||[]).map(x=>[String(x.name||'').trim().toLowerCase(),x]));const existing=new Map((jnvstSubjectLessons||[]).map(x=>[`${x.subject_id}|${String(x.lesson_code||'').trim().toLowerCase()}`,x]));const fileCodes=new Set();
  jnvstLessonBulkRows.forEach(x=>{
   if(!x.subject)errors.push(`Row ${x.row}: Subject Name is required.`);else if(!subjectMap.has(x.subject.toLowerCase()))errors.push(`Row ${x.row}: Subject "${x.subject}" does not exist. Create it first.`);
   if(!x.code)errors.push(`Row ${x.row}: Lesson Code is required.`);if(!x.name)errors.push(`Row ${x.row}: Lesson Name is required.`);
   if(x.code&&!/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/.test(x.code))errors.push(`Row ${x.row}: Invalid Lesson Code "${x.code}".`);
   const key=x.subject.toLowerCase()+'|'+x.code.toLowerCase();if(x.code&&fileCodes.has(key))errors.push(`Row ${x.row}: Duplicate Lesson Code ${x.code} in this file.`);if(x.code)fileCodes.add(key);
   if(subjectMap.has(x.subject.toLowerCase())&&x.code&&existing.has(`${subjectMap.get(x.subject.toLowerCase()).id}|${x.code.toLowerCase()}`))warnings.push(`Row ${x.row}: ${x.subject} / ${x.code} already exists and will be skipped.`);
  });
  const bySubjectCode=new Map(jnvstLessonBulkRows.filter(x=>x.subject&&x.code).map(x=>[x.subject.toLowerCase()+'|'+x.code.toLowerCase(),x]));
  jnvstLessonBulkRows.forEach(x=>{if(x.parentCode){const k=x.subject.toLowerCase()+'|'+x.parentCode.toLowerCase();if(!bySubjectCode.has(k)&&!([...existing.values()].some(l=>{const sub=(jnvstSubjects||[]).find(s=>s.id===l.subject_id);return sub&&String(sub.name).trim().toLowerCase()===x.subject.toLowerCase()&&String(l.lesson_code).trim().toLowerCase()===x.parentCode.toLowerCase()})))errors.push(`Row ${x.row}: Parent Lesson Code "${x.parentCode}" was not found for subject ${x.subject}.`)}});
  if(errors.length){box.innerHTML=message(`<b>Validation failed.</b><br>${errors.slice(0,30).map(esc).join('<br>')}${errors.length>30?`<br>…and ${errors.length-30} more.`:''}`);return}
  box.innerHTML=message(`<b>${jnvstLessonBulkRows.length} row(s) loaded.</b><br>${warnings.length?warnings.slice(0,12).map(esc).join('<br>')+'<br>':''}Ready to import. Existing lesson codes will be skipped; new lessons will be inserted parent-first.`,true);btn.disabled=!jnvstLessonBulkRows.length;
 }catch(err){box.innerHTML=message('Could not read Excel: '+(err.message||err));}}
 r.readAsArrayBuffer(file);
}
async function saveJnvstLessonBulk(){
 if(!jnvstLessonBulkRows.length)return notify('Choose an Excel file first.');
 const subjectMap=new Map((jnvstSubjects||[]).map(x=>[String(x.name||'').trim().toLowerCase(),x]));const existing=new Map((jnvstSubjectLessons||[]).map(x=>[`${x.subject_id}|${String(x.lesson_code||'').trim().toLowerCase()}`,x]));
 let pending=jnvstLessonBulkRows.map(x=>({...x,subjectObj:subjectMap.get(x.subject.toLowerCase())})).filter(x=>x.subjectObj&&!existing.has(`${x.subjectObj.id}|${x.code.toLowerCase()}`));
 const created=[];const failed=[];
 // Parent-first insertion: repeatedly insert rows whose parent is already in DB or has just been created.
 let guard=0;while(pending.length&&guard++<pending.length+5){let progress=0;for(const x of [...pending]){let parentId=null;if(x.parentCode){const parent=jnvstLessonBulkRows.find(r=>r.subject.toLowerCase()===x.subject.toLowerCase()&&r.code.toLowerCase()===x.parentCode.toLowerCase());const existingParent=parent?existing.get(`${x.subjectObj.id}|${x.parentCode.toLowerCase()}`):null;const newParent=parent?created.find(c=>c.subject_id===x.subjectObj.id&&String(c.lesson_code).toLowerCase()===x.parentCode.toLowerCase()):null;parentId=existingParent?.id||newParent?.id;if(!parentId)continue;}
   const {data,error}=await sb.from('jnvst_subject_lessons').insert({teacher_id:current.id,subject_id:x.subjectObj.id,parent_lesson_id:parentId,lesson_code:x.code,lesson_name:x.name,description:x.description||null}).select('*').single();
   if(error){failed.push(`Row ${x.row}: ${error.message}`);pending=pending.filter(y=>y!==x);progress++;continue;}
   created.push(data);existing.set(`${x.subjectObj.id}|${x.code.toLowerCase()}`,data);pending=pending.filter(y=>y!==x);progress++;
  }
  if(!progress)break;
 }
 pending.forEach(x=>failed.push(`Row ${x.row}: Could not resolve parent lesson "${x.parentCode}".`));
 if(created.length){jnvstSubjectLessons=[...(jnvstSubjectLessons||[]),...created];}
 notify(`Bulk import complete.\n\nCreated: ${created.length}\nSkipped existing: ${jnvstLessonBulkRows.length-created.length-failed.length}\nFailed: ${failed.length}${failed.length?'\n\n'+failed.slice(0,10).join('\n'):''}`);
 if(failed.length)document.getElementById('jnvstLessonBulkPreview').innerHTML=message(failed.slice(0,30).map(esc).join('<br>'));else await manageJnvstClasses();
}
function jnvstMathCellPreview(value){
 const s=jnvstNormalizeMathText(value); if(!s)return '<span class="muted">—</span>';
 return esc(s).replace(/\\\((.*?)\\\)/gs,'\\($1\\)').replace(/\\\[(.*?)\\\]/gs,'\\[$1\\]').replace(/\$\$(.*?)\$\$/gs,'\\[$1\\]');
}
function jnvstTypesetBulkPreview(){const box=document.getElementById('jnvstQbBulkMathPreview');if(!box)return; if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise([box]).catch(()=>{});}
function jnvstQbText(q){return q?.question_text||''}
function jnvstQbQuestionPreview(q){
  const image=q?.image_url?String(q.image_url):'';
  const raw=q?.question_text==null?'':String(q.question_text).trim();
  const text=(raw && !/^\[IMAGE QUESTION(?:[^]]*)\]$/i.test(raw))?raw:'';
  const imageHtml=image?`<img src="${esc(image)}" alt="Question image" loading="lazy" onclick="event.preventDefault();event.stopPropagation();openMockQuestionImage('${esc(image)}','Question image')" style="display:block;width:180px;max-height:125px;object-fit:contain;border:1px solid #cbd5e1;border-radius:6px;padding:3px;background:#fff;cursor:zoom-in;margin-bottom:${text?'7px':'0'}">`:'';
  const previewText=text.slice(0,500);
  const textHtml=text?`<div class="jnvst-qb-question-preview-text" style="white-space:pre-wrap;line-height:1.45">${jnvstMathPreview(previewText)}${text.length>500?'…':''}</div>`:'';
  return imageHtml+textHtml+(image||text?'':'<div class="muted small">Question preview unavailable</div>');
}
function jnvstQbSubjectOptions(selected=''){return `<option value="">Select Subject</option>${(jnvstSubjects||[]).map(x=>`<option value="${esc(x.id)}" ${selected===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}`}
function jnvstQbLessonOptions(subjectId,selected=''){const rows=(jnvstSubjectLessons||[]).filter(x=>x.subject_id===subjectId);const roots=rows.filter(x=>!x.parent_lesson_id);const out=[];const add=(l,d=0)=>{out.push(`<option value="${esc(l.id)}" ${selected===l.id?'selected':''}>${'— '.repeat(d)}${esc(l.lesson_code||'')} ${esc(l.lesson_name)}</option>`);rows.filter(x=>x.parent_lesson_id===l.id).sort((a,b)=>String(a.lesson_code||'').localeCompare(String(b.lesson_code||''),undefined,{numeric:true})).forEach(x=>add(x,d+1))};roots.sort((a,b)=>String(a.lesson_code||'').localeCompare(String(b.lesson_code||''),undefined,{numeric:true})).forEach(x=>add(x));return `<option value="">Select Lesson / Sub-lesson</option>${out.join('')}`}
async function jnvstQuestionBankHome(){
 const {data:q,error}=await sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).order('created_at',{ascending:false});
 if(error)return notify('Could not load JNVST Question Bank: '+error.message);
 jnvstQbCache=q||[];
 jnvstQbSelected=new Set([...jnvstQbSelected].filter(id=>jnvstQbCache.some(q=>q.id===id)));
 const subj=document.getElementById('jnvstQbSubjectFilter')?.value||'';
 render(`<div class="wrap">${header('📚 JNVST Question Bank')}
  <div class="card"><div class="notice"><b>JNVST Course Question Bank is separate from School Course.</b> Questions are stored in <b>mock_question_bank</b> and use <b>Subject → Lesson → Sub-lesson → Topic → Variation/Fixed metadata</b>.</div>
   <div class="actions"><button onclick="jnvstQuestionBulkUpload()">📥 Bulk Upload JNVST Questions</button><button class="secondary" onclick="downloadJnvstQuestionTemplate()">⬇ Excel Template</button><button class="secondary" onclick="manageJnvstClasses()">← Manage JNVST Subjects</button></div>
  </div>
  <div class="card"><div class="grid"><div><label>Subject</label><select id="jnvstQbSubjectFilter" onchange="jnvstQbSubjectChanged(this.value)">${jnvstQbSubjectOptions(subj)}</select></div><div><label>Medium</label><select id="jnvstQbMediumFilter" onchange="jnvstQbContextChanged()"><option value="">All Mediums</option><option value="COMMON">Common (MAT)</option><option value="ENGLISH">English</option><option value="ASSAMESE">Assamese</option></select></div><div><label>Lesson / Sub-lesson</label><select id="jnvstQbLessonFilter" onchange="jnvstQbContextChanged()"><option value="">All Lessons</option></select></div><div><label>Variation Group</label><select id="jnvstQbVariationFilter" onchange="jnvstQbVariationChanged(this.value)"><option value="">All Variations</option></select></div><div><label>Search / Topic / Group</label><input id="jnvstQbSearch" placeholder="Search..." oninput="jnvstQbRenderTable()"></div></div>
    <div class="actions" style="margin-top:12px;align-items:center;flex-wrap:wrap">
      <button onclick="jnvstQbDeleteSelected()" class="danger">🗑 Delete Selected (<span id="jnvstQbSelectedCount">0</span>)</button>
      <button onclick="jnvstQbDeleteFiltered()" class="danger">🗑 Delete All Visible</button>
      <button onclick="jnvstQbDeleteLesson()" class="danger">🗑 Delete Selected Lesson</button>
      <button onclick="jnvstQbDeleteSubject()" class="danger">🗑 Delete Selected Subject</button>
      <button class="secondary" onclick="jnvstQbClearSelection()">Clear Selection</button>
      <button id="jnvstQbCreateVariationBtn" onclick="jnvstQbCreateVariationFromGroup()" style="display:none;background:#16a34a;color:#fff;font-weight:700;border:0">➕ Create Variation Question</button>
      <span id="jnvstQbVariationActionHint" class="small muted"></span>
      <span class="small muted">Deletion is permanent. A confirmation is required.</span>
    </div><div id="jnvstQbTable" style="margin-top:12px"></div></div>
 </div>`);
 jnvstQbRefreshLessonFilter();jnvstQbRefreshVariationFilter();jnvstQbRenderTable();
}
function jnvstQbSubjectChanged(value){jnvstQbSelected.clear();jnvstQbRefreshLessonFilter();jnvstQbRefreshVariationFilter();jnvstQbRenderTable()}
function jnvstQbContextChanged(){jnvstQbSelected.clear();jnvstQbRefreshVariationFilter();jnvstQbRenderTable()}
function jnvstQbClearSelection(){jnvstQbSelected.clear();jnvstQbRenderTable()}
function jnvstQbToggleSelection(id,checked){checked?jnvstQbSelected.add(id):jnvstQbSelected.delete(id);jnvstQbUpdateSelectionCount()}
function jnvstQbUpdateSelectionCount(){const el=document.getElementById('jnvstQbSelectedCount');if(el)el.textContent=jnvstQbSelected.size}
function jnvstQbVariationContextRows(){const sid=document.getElementById('jnvstQbSubjectFilter')?.value||'',med=(document.getElementById('jnvstQbMediumFilter')?.value||'').toUpperCase(),lid=document.getElementById('jnvstQbLessonFilter')?.value||'';return jnvstQbCache.filter(q=>{if(sid&&q.subject_id!==sid)return false;if(med&&String(q.language||'').toUpperCase()!==med)return false;if(lid&&q.lesson_id!==lid)return false;return true})}
function jnvstQbRefreshVariationFilter(selectedId){const el=document.getElementById('jnvstQbVariationFilter');if(!el)return;const current=selectedId!==undefined?selectedId:(el.value||'');const groups=[...new Set(jnvstQbVariationContextRows().map(q=>String(q.variation_group||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));el.innerHTML='<option value="">All Variations</option>'+groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');if(current&&groups.includes(current))el.value=current;else el.value=''}
function jnvstQbUpdateVariationAction(){
 const btn=document.getElementById('jnvstQbCreateVariationBtn'),hint=document.getElementById('jnvstQbVariationActionHint'),group=document.getElementById('jnvstQbVariationFilter')?.value||'';
 if(!btn)return;
 if(group){btn.style.display='inline-flex';hint.textContent=`Create another English + Assamese variation in ${group}`;}
 else{btn.style.display='none';hint.textContent='';}
}
function jnvstQbVariationChanged(value){jnvstQbUpdateVariationAction();jnvstQbRenderTable()}
function jnvstQbCreateVariationFromGroup(){
 const group=document.getElementById('jnvstQbVariationFilter')?.value||'';
 if(!group)return notify('Please select a Variation Group first.');
 const rows=jnvstQbFilteredRows().filter(q=>String(q.variation_group||'').trim()===group && ['ENGLISH','ASSAMESE'].includes(String(q.language||'').toUpperCase()) && !q.passage_id);
 if(!rows.length)return notify(`No English/Assamese MCQ question is available in Variation Group ${group}.`);
 const preferred=rows.find(q=>String(q.language||'').toUpperCase()==='ENGLISH')||rows[0];
 jnvstQbCreateVariationQuestion(preferred.id);
}
function jnvstQbShowVariation(group){const el=document.getElementById('jnvstQbVariationFilter');if(!el)return;jnvstQbRefreshVariationFilter(group);if(el.value!==group){el.value=''}else{el.value=group}jnvstQbRenderTable()}
function jnvstQbFindCounterpart(q){
  if(!q)return null;
  const lang=String(q.language||'').toUpperCase();
  const target=lang==='ENGLISH'?'ASSAMESE':lang==='ASSAMESE'?'ENGLISH':'';
  if(!target)return null;
  const pair=String(q.language_pair_id||'').trim();
  if(pair){const linked=jnvstQbCache.find(x=>x.id!==q.id&&String(x.language_pair_id||'').trim()===pair&&String(x.language||'').toUpperCase()===target);if(linked)return linked;}
  const candidates=jnvstQbCache.filter(x=>x.id!==q.id&&String(x.language||'').toUpperCase()===target&&String(x.subject_id||'')===String(q.subject_id||'')&&String(x.lesson_id||'')===String(q.lesson_id||'')&&String(x.part_code||'').toUpperCase()===String(q.part_code||'').toUpperCase()&&String(x.variation_group||'').trim()===String(q.variation_group||'').trim());
  if(!candidates.length)return null;
  const sameOrder=candidates.find(x=>String(x.question_order||'')===String(q.question_order||''));
  if(sameOrder)return sameOrder;
  const sameTopic=candidates.find(x=>String(x.topic||'').trim().toLowerCase()===String(q.topic||'').trim().toLowerCase());
  return sameTopic||candidates[0]||null;
}
function jnvstQbCreateVariationQuestion(id){
  const q=jnvstQbCache.find(x=>x.id===id);if(!q)return notify('Question not found.');
  const lang=String(q.language||'').toUpperCase();
  if(!['ENGLISH','ASSAMESE'].includes(lang))return notify('Create Variation Question is available for English/Assamese question pairs. Common (MAT) questions use the Common language and are not duplicated as bilingual records.');
  if(String(q.question_type||'').toUpperCase().includes('PASSAGE')||q.passage_id)return notify('This is a passage question. Please create/duplicate the complete 5-question passage entity instead of a single variation question.');
  if(!String(q.variation_group||'').trim())return notify('This question has no Variation Group. Assign a Variation Group first.');
  const other=jnvstQbFindCounterpart(q), en=lang==='ENGLISH'?q:other, as=lang==='ASSAMESE'?q:other;
  const subject=(jnvstSubjects||[]).find(x=>x.id===q.subject_id), lesson=(jnvstSubjectLessons||[]).find(x=>x.id===q.lesson_id);
  const qfield=(langKey,val)=>`<div><label>Question — ${langKey==='EN'?'English':'Assamese'}</label><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jvc_${langKey}_question')">∑ Equation Editor</button></div><textarea id="jvc_${langKey}_question" rows="7" placeholder="Type the ${langKey==='EN'?'English':'Assamese'} variation question..." oninput="jnvstRefreshMathPreview('jvc_${langKey}_questionPreview',this.value)">${esc(val||'')}</textarea><div id="jvc_${langKey}_questionPreview" class="eq-preview">${jnvstMathPreview(val||'')}</div></div>`;
  const optionBlock=(langKey,obj)=>`<div class="grid">${['A','B','C','D'].map(o=>`<div><label>Option ${o} — ${langKey==='EN'?'English':'Assamese'}</label><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jvc_${langKey}_${o}')">∑ Equation</button></div><textarea id="jvc_${langKey}_${o}" rows="3" oninput="jnvstRefreshMathPreview('jvc_${langKey}_${o}Preview',this.value)" placeholder="Option ${o}">${esc(obj?.['option_'+o.toLowerCase()]||'')}</textarea><div id="jvc_${langKey}_${o}Preview" class="eq-preview">${jnvstMathPreview(obj?.['option_'+o.toLowerCase()]||'')}</div></div>`).join('')}</div>`;
  const answer=(langKey,obj)=>`<div><label>Correct Answer — ${langKey==='EN'?'English':'Assamese'}</label><select id="jvc_${langKey}_answer"><option value="A" ${obj?.correct_option==='A'?'selected':''}>A</option><option value="B" ${obj?.correct_option==='B'?'selected':''}>B</option><option value="C" ${obj?.correct_option==='C'?'selected':''}>C</option><option value="D" ${obj?.correct_option==='D'?'selected':''}>D</option></select></div>`;
  render(`<div class="wrap">${header('Create Variation Question')}
    <div class="card"><div class="notice"><b>Variation Group: ${esc(q.variation_group)}</b> <span class="muted">(locked — both new questions will remain in this group)</span><br><b>Source:</b> ${esc(subject?.name||'')} → ${esc(lesson?`${lesson.lesson_code||''} ${lesson.lesson_name}`:'')} → ${esc(q.topic||'')}<br><b>Language pair:</b> ${other?'Existing English + Assamese counterpart found and pre-filled.':'Counterpart language not found — its fields are blank for you to type.'}</div></div>
    <div class="card" style="border:2px solid #2563eb;background:#f8fbff"><h2 style="margin-top:0">🇬🇧 English Variation</h2>${qfield('EN',en?.question_text||'')}${optionBlock('EN',en)}<div class="grid">${answer('EN',en)}</div><label>Explanation — English (optional)</label><textarea id="jvc_EN_explanation" rows="4">${esc(en?.explanation||'')}</textarea></div>
    <div class="card" style="border:2px solid #16a34a;background:#f7fff9"><h2 style="margin-top:0">🇮🇳 Assamese Variation</h2>${qfield('AS',as?.question_text||'')}${optionBlock('AS',as)}<div class="grid">${answer('AS',as)}</div><label>Explanation — Assamese (optional)</label><textarea id="jvc_AS_explanation" rows="4">${esc(as?.explanation||'')}</textarea></div>
    <div class="card"><h3 style="margin-top:0">Common Metadata</h3><div class="grid"><div><label>Marks</label><input id="jvcMarks" type="number" min="0" step="0.5" value="${esc(q.marks??1)}"></div><div><label>Cognitive Level</label><select id="jvcCognitive"><option value="">— Optional —</option>${['Knowledge','Understanding','Application','HOTS'].map(v=>`<option value="${v}" ${String(q.cognitive_level||'')===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label>Difficulty</label><select id="jvcDifficulty"><option value="">— Optional —</option>${['Easy','Medium','Hard'].map(v=>`<option value="${v}" ${String(q.difficulty||'')===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label>Topic</label><input id="jvcTopic" value="${esc(q.topic||'')}" placeholder="Topic"></div></div><label style="display:flex;align-items:center;gap:8px;margin-top:10px"><input id="jvcFixed" type="checkbox" style="width:auto"> Mark the new variation questions as Fixed</label><div class="small muted" style="margin-top:5px">Off by default so multiple questions in the same Variation Group do not accidentally become mandatory.</div></div>
    <div class="actions"><button onclick="jnvstQbSaveVariationQuestion('${esc(q.id)}')">➕ Create Variation Question</button><button class="secondary" onclick="jnvstQuestionBankHome()">Cancel</button></div>
  </div>`);
  if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
}
function jnvstQbVarField(lang,key){return document.getElementById(`jvc_${lang}_${key}`)?.value.trim()||''}
async function jnvstQbSaveVariationQuestion(sourceId){
  const source=jnvstQbCache.find(x=>x.id===sourceId);if(!source)return notify('Source question not found.');
  const group=String(source.variation_group||'').trim();if(!group)return notify('The source question does not have a Variation Group.');
  const english={question_text:jnvstQbVarField('EN','question'),option_a:jnvstQbVarField('EN','A'),option_b:jnvstQbVarField('EN','B'),option_c:jnvstQbVarField('EN','C'),option_d:jnvstQbVarField('EN','D'),correct_option:document.getElementById('jvc_EN_answer')?.value||'A',explanation:document.getElementById('jvc_EN_explanation')?.value.trim()||null};
  const assamese={question_text:jnvstQbVarField('AS','question'),option_a:jnvstQbVarField('AS','A'),option_b:jnvstQbVarField('AS','B'),option_c:jnvstQbVarField('AS','C'),option_d:jnvstQbVarField('AS','D'),correct_option:document.getElementById('jvc_AS_answer')?.value||'A',explanation:document.getElementById('jvc_AS_explanation')?.value.trim()||null};
  if(!english.question_text||!assamese.question_text)return notify('Both English and Assamese question text are required. If a counterpart was missing, type it in the blank section before creating the variation.');
  const marks=Number(document.getElementById('jvcMarks')?.value||1);if(!Number.isFinite(marks)||marks<0)return notify('Marks must be 0 or greater.');
  try{
    const {data:existing,error:qe}=await sb.from('mock_question_bank').select('id,language,question_text,option_a,option_b,option_c,option_d').eq('teacher_id',current.id).eq('variation_group',group).eq('active',true);if(qe)throw qe;
    const key=x=>[x.language,x.question_text,x.option_a,x.option_b,x.option_c,x.option_d].map(v=>String(v||'').trim().toLowerCase()).join('¦');const keys=new Set((existing||[]).map(key));
    const pairId=crypto.randomUUID(),fixed=!!document.getElementById('jvcFixed')?.checked;
    const base={teacher_id:current.id,section_code:source.section_code,part_code:source.part_code,topic:document.getElementById('jvcTopic')?.value.trim()||source.topic||null,variation_group:group,is_fixed:fixed,question_type:source.question_type||'MCQ',marks,cognitive_level:document.getElementById('jvcCognitive')?.value||source.cognitive_level||null,difficulty:document.getElementById('jvcDifficulty')?.value||source.difficulty||null,subject_id:source.subject_id,lesson_id:source.lesson_id,lesson_code:source.lesson_code||null,source_type:'JNVST_VARIATION',active:true,passage_id:null,passage_title:null,passage_text:null,question_order:null,set_id:null,language_pair_id:pairId};
    const rows=[{...base,language:'ENGLISH',...english,image_url:source.image_url||null},{...base,language:'ASSAMESE',...assamese,image_url:source.image_url||null}];
    for(const row of rows)if(keys.has(key(row)))throw new Error(`A ${row.language==='ENGLISH'?'English':'Assamese'} question with the same text/options already exists in Variation Group ${group}.`);
    const {error}=await sb.from('mock_question_bank').insert(rows);if(error)throw error;
    notify(`Variation question pair created successfully.\n\nVariation Group: ${group}\nEnglish: created\nAssamese: created`);await jnvstQuestionBankHome();setTimeout(()=>jnvstQbShowVariation(group),0);
  }catch(e){notify('Could not create variation question: '+(e.message||e));}
}
async function jnvstQbInlineVariationChange(id,value){const q=jnvstQbCache.find(x=>x.id===id);if(!q)return;const next=String(value||'').trim()||null;const old=q.variation_group||null;if(next===old)return;try{const {error}=await sb.from('mock_question_bank').update({variation_group:next}).eq('id',id).eq('teacher_id',current.id);if(error)throw error;q.variation_group=next;jnvstQbRefreshVariationFilter(document.getElementById('jnvstQbVariationFilter')?.value||'');jnvstQbRenderTable();jnvstQbToast(`Variation updated${next?`: ${next}`:''}`)}catch(e){notify('Could not update Variation Group: '+(e.message||e));jnvstQbRenderTable()}}
function jnvstQbToast(message){let t=document.getElementById('jnvstQbToast');if(!t){t=document.createElement('div');t.id='jnvstQbToast';t.style.cssText='position:fixed;right:24px;bottom:24px;z-index:99999;background:#166534;color:#fff;padding:10px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);font-weight:600';document.body.appendChild(t)}t.textContent='✓ '+message;t.style.display='block';clearTimeout(window.__jnvstQbToastTimer);window.__jnvstQbToastTimer=setTimeout(()=>{t.style.display='none'},1800)}
function jnvstQbFilteredRows(){const sid=document.getElementById('jnvstQbSubjectFilter')?.value||'',med=(document.getElementById('jnvstQbMediumFilter')?.value||'').toUpperCase(),lid=document.getElementById('jnvstQbLessonFilter')?.value||'',vg=document.getElementById('jnvstQbVariationFilter')?.value||'',search=(document.getElementById('jnvstQbSearch')?.value||'').toLowerCase();return jnvstQbCache.filter(q=>{if(sid&&q.subject_id!==sid)return false;if(med&&String(q.language||'').toUpperCase()!==med)return false;if(lid&&q.lesson_id!==lid)return false;if(vg&&String(q.variation_group||'')!==vg)return false;const hay=[q.question_text,q.topic,q.variation_group,q.section_code,q.part_code].map(x=>String(x||'')).join(' ').toLowerCase();return !search||hay.includes(search)})}
async function jnvstQbDeleteIds(ids,label){const unique=[...new Set(ids)].filter(Boolean);if(!unique.length)return notify('No questions selected.');const preview=unique.slice(0,3).map(id=>{const q=jnvstQbCache.find(x=>x.id===id);return q?jnvstQbText(q).replace(/\s+/g,' ').slice(0,90):id}).join('\n');const more=unique.length>3?`\n…and ${unique.length-3} more.`:'';if(!confirm(`WARNING: Permanently delete ${unique.length} JNVST question(s)${label?` from ${label}`:''}?\n\n${preview}${more}\n\nThis cannot be undone. Continue?`))return;try{for(let i=0;i<unique.length;i+=100){const batch=unique.slice(i,i+100);const {error}=await sb.from('mock_question_bank').delete().in('id',batch).eq('teacher_id',current.id);if(error)throw error}unique.forEach(id=>jnvstQbSelected.delete(id));notify(`${unique.length} question(s) deleted successfully.`);await jnvstQuestionBankHome()}catch(e){notify('Could not delete questions: '+(e.message||e))}}
async function jnvstQbDeleteSelected(){await jnvstQbDeleteIds([...jnvstQbSelected],'your selection')}
async function jnvstQbDeleteFiltered(){const rows=jnvstQbFilteredRows();if(!rows.length)return notify('No visible questions to delete.');const sid=document.getElementById('jnvstQbSubjectFilter')?.value||'';const lid=document.getElementById('jnvstQbLessonFilter')?.value||'';const label=lid?'the selected Lesson/Sub-lesson':sid?'the selected Subject with the current filters':'the current filters';await jnvstQbDeleteIds(rows.map(q=>q.id),label)}
async function jnvstQbDeleteLesson(){
 const sid=document.getElementById('jnvstQbSubjectFilter')?.value||'',lid=document.getElementById('jnvstQbLessonFilter')?.value||'';
 if(!lid)return notify('Please select a Lesson / Sub-lesson first.');
 // If a parent Lesson is selected, include all of its Sub-lessons recursively.
 // If a Sub-lesson is selected, only that Sub-lesson is affected.
 const lessonMap=new Map((jnvstSubjectLessons||[]).map(x=>[x.id,x]));
 const lessonIds=new Set([lid]);
 let changed=true;
 while(changed){
   changed=false;
   (jnvstSubjectLessons||[]).forEach(x=>{
     if(x.parent_lesson_id&&lessonIds.has(x.parent_lesson_id)&&!lessonIds.has(x.id)){lessonIds.add(x.id);changed=true;}
   });
 }
 const rows=jnvstQbCache.filter(q=>lessonIds.has(q.lesson_id)&&(!sid||q.subject_id===sid));
 const l=lessonMap.get(lid);
 const label=`Lesson/Sub-lesson ${l?`${l.lesson_code||''} ${l.lesson_name}`.trim():'selected'}${lessonIds.size>1?` and ${lessonIds.size-1} sub-lesson(s)`:''}`;
 await jnvstQbDeleteIds(rows.map(q=>q.id),label);
}
async function jnvstQbDeleteSubject(){const sid=document.getElementById('jnvstQbSubjectFilter')?.value||'';if(!sid)return notify('Please select a Subject first.');const rows=jnvstQbCache.filter(q=>q.subject_id===sid);const s=(jnvstSubjects||[]).find(x=>x.id===sid);await jnvstQbDeleteIds(rows.map(q=>q.id),`Subject ${s?.name||'selected'}`)}
async function jnvstQbDeleteOne(id){const q=jnvstQbCache.find(x=>x.id===id);if(!q)return;const label=jnvstQbText(q).replace(/\s+/g,' ').slice(0,160)||'Image question';if(!confirm(`Delete this JNVST question?\n\n${label}\n\nThis cannot be undone.`))return;await jnvstQbDeleteIds([id],'this question')}
function jnvstQbRefreshLessonFilter(selectedId=''){const el=document.getElementById('jnvstQbLessonFilter');if(!el)return;const sid=document.getElementById('jnvstQbSubjectFilter')?.value||'';const rows=(jnvstSubjectLessons||[]).filter(x=>!sid||x.subject_id===sid);const roots=rows.filter(x=>!x.parent_lesson_id);const out=[];const add=(l,d=0)=>{out.push(`<option value="${esc(l.id)}">${'— '.repeat(d)}${esc(l.lesson_code||'')} ${esc(l.lesson_name)}</option>`);rows.filter(x=>x.parent_lesson_id===l.id).sort((a,b)=>String(a.lesson_code||'').localeCompare(String(b.lesson_code||''),undefined,{numeric:true})).forEach(x=>add(x,d+1))};roots.sort((a,b)=>String(a.lesson_code||'').localeCompare(String(b.lesson_code||''),undefined,{numeric:true})).forEach(x=>add(x));el.innerHTML='<option value="">All Lessons</option>'+out.join('');if(selectedId&&rows.some(x=>x.id===selectedId))el.value=selectedId}
function jnvstQbVariationOptions(current){const groups=[...new Set(jnvstQbVariationContextRows().map(q=>String(q.variation_group||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));if(current&& !groups.includes(current))groups.unshift(current);return '<option value="">No Variation</option>'+groups.map(g=>`<option value="${esc(g)}" ${g===current?'selected':''}>${esc(g)}</option>`).join('')}
function jnvstQbToggleVisible(checked){jnvstQbFilteredRows().forEach(q=>checked?jnvstQbSelected.add(q.id):jnvstQbSelected.delete(q.id));jnvstQbRenderTable()}
async function jnvstQbEdit(id){
 const q=jnvstQbCache.find(x=>x.id===id);
 if(!q)return notify('Question not found.');
 jnvstQbEditingId=id;
 const subj=q.subject_id||'';
 const image=q.image_url||'';
 render(`<div class="wrap">${header('Edit JNVST Question')}
  <div class="card">
   <div class="notice"><b>School-type Question Editor for JNVST:</b> You can edit normal text questions, insert mathematical expressions with the visual Equation Editor, and add/replace a diagram or question image. This is especially useful for Arithmetic questions containing fractions, powers, roots, symbols, tables or diagrams.</div>
   <div class="grid">
    <div><label>JNVST Subject</label><select id="jqSubject" onchange="document.getElementById('jqLesson').innerHTML=jnvstQbLessonOptions(this.value,'')">${jnvstQbSubjectOptions(subj)}</select></div>
    <div><label>Medium</label><select id="jqMedium"><option value="COMMON" ${String(q.language||'').toUpperCase()==='COMMON'?'selected':''}>Common (MAT)</option><option value="ENGLISH" ${String(q.language||'').toUpperCase()==='ENGLISH'?'selected':''}>English</option><option value="ASSAMESE" ${String(q.language||'').toUpperCase()==='ASSAMESE'?'selected':''}>Assamese</option></select></div>
    <div><label>Lesson / Sub-lesson</label><select id="jqLesson">${jnvstQbLessonOptions(subj,q.lesson_id||'')}</select></div>
    <div><label>Topic</label><input id="jqTopic" value="${esc(q.topic||'')}" placeholder="e.g. Fractions / Percentage"></div>
    <div><label>Marks</label><input id="jqMarks" type="number" min="0" step="0.5" value="${esc(q.marks??1)}"></div>
    <div><label>Cognitive Level</label><select id="jqCognitive"><option value="">— Optional —</option>${['Knowledge','Understanding','Application','HOTS'].map(v=>`<option value="${v}" ${String(q.cognitive_level||'')===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div><label>Difficulty</label><select id="jqDifficulty"><option value="">— Optional —</option>${['Easy','Medium','Hard'].map(v=>`<option value="${v}" ${String(q.difficulty||'')===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div><label>Variation Group</label><input id="jqGroup" value="${esc(q.variation_group||'')}" placeholder="e.g. FRA-ADD-001"></div>
   </div>

   <div class="jnvst-editor-section">
    <h3>1. Question Content</h3>
    <div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jqQuestion')">∑ Equation Editor</button><span class="eq-hint">Insert fractions, powers, roots, symbols, matrices and other mathematical expressions.</span></div>
    <textarea id="jqQuestion" rows="7" placeholder="Type the question here. Use the Equation Editor for mathematical expressions." oninput="jnvstRefreshMathPreview('jqQuestionPreview',this.value)">${esc(q.question_text&&q.question_text!=='[IMAGE QUESTION]'?q.question_text:'')}</textarea>
    <div id="jqQuestionPreview" class="eq-preview">${jnvstMathPreview(q.question_text&&q.question_text!=='[IMAGE QUESTION]'?q.question_text:'')}</div>
    <label>Question Diagram / Image (optional)</label>
    <input id="jqImage" type="file" accept="image/*" onchange="jnvstPreviewEditImage(this)">
    <div id="jqImagePreview" style="margin-top:8px">${image?`<img class="jnvst-editor-image" src="${esc(image)}" alt="Question image"><div class="small muted" style="margin-top:5px">Current image. Select a new image to replace it.</div>`:'<div class="small muted">No question image attached. You can upload a diagram or figure here.</div>'}</div>
    ${image?`<label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input id="jqRemoveImage" type="checkbox" style="width:auto"> Remove current image</label>`:''}
   </div>

   <div class="jnvst-editor-section">
    <h3>2. Options & Correct Answer</h3>
    <div class="grid">${['A','B','C','D'].map(o=>`<div><label>Option ${o}</label><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jqOpt${o}')">∑ Equation</button></div><textarea id="jqOpt${o}" rows="3" oninput="jnvstRefreshMathPreview('jqOpt${o}Preview',this.value)" placeholder="Option ${o}">${esc(q['option_'+o.toLowerCase()]||'')}</textarea><div id="jqOpt${o}Preview" class="eq-preview">${jnvstMathPreview(q['option_'+o.toLowerCase()]||'')}</div></div>`).join('')}</div>
    <div class="grid"><div><label>Correct Answer</label><select id="jqAnswer"><option value="A" ${q.correct_option==='A'?'selected':''}>A</option><option value="B" ${q.correct_option==='B'?'selected':''}>B</option><option value="C" ${q.correct_option==='C'?'selected':''}>C</option><option value="D" ${q.correct_option==='D'?'selected':''}>D</option></select></div><div><label>Fixed Question</label><label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input id="jqFixed" type="checkbox" style="width:auto" ${q.is_fixed?'checked':''}> Mark this question as fixed</label></div></div>
   </div>

   <div class="jnvst-editor-section">
    <h3>3. Explanation (optional)</h3>
    <div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jqExplanation')">∑ Equation Editor</button><span class="eq-hint">Useful for Arithmetic solutions containing mathematical notation.</span></div>
    <textarea id="jqExplanation" rows="5" placeholder="Optional explanation..." oninput="jnvstRefreshMathPreview('jqExplanationPreview',this.value)">${esc(q.explanation||'')}</textarea>
    <div id="jqExplanationPreview" class="eq-preview">${jnvstMathPreview(q.explanation||'')}</div>
   </div>

   <div class="actions" style="margin-top:16px"><button onclick="jnvstQbSaveEditRich()">💾 Save Changes</button><button class="secondary" onclick="jnvstQuestionBankHome()">Cancel</button></div>
  </div></div>`);
 if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
}
function jnvstRefreshMathPreview(id,value){const el=document.getElementById(id);if(!el)return;el.innerHTML=jnvstMathPreview(value);jnvstTypesetWhenReady([el]);}
function jnvstCloseMathEditor(){
 const m=document.getElementById('jnvstMathModal');
 if(m)m.remove();
 try{window.mathVirtualKeyboard?.hide?.()}catch(e){}
 jnvstMathEditorState={target:null,start:0,end:0};
}
function jnvstOpenMathEditor(targetId){
 const target=document.getElementById(targetId);
 if(!target)return notify('The selected question field is not available.');
 jnvstCloseMathEditor();
 const start=Number.isFinite(target.selectionStart)?target.selectionStart:target.value.length;
 const end=Number.isFinite(target.selectionEnd)?target.selectionEnd:target.value.length;
 jnvstMathEditorState={target,start,end};
 const modal=document.createElement('div');
 modal.id='jnvstMathModal';
 modal.className='jnvst-math-modal';
 modal.innerHTML=`<div class="jnvst-math-dialog" onclick="event.stopPropagation()">
   <h3 style="margin:0">∑ Mathematics Equation Editor</h3>
   <div class="small muted">Enter only the mathematical expression here. Normal Assamese/English question text stays outside the equation editor. Select an existing expression in the question before opening this editor to replace/edit it.</div>
   <math-field id="jnvstMathField" smart-mode="on" smart-superscript="on" letter-shape-style="tex" math-virtual-keyboard-policy="auto"></math-field>
   <div class="jnvst-math-presets">
    <button type="button" onclick="jnvstMathPreset('frac')">Fraction</button>
    <button type="button" onclick="jnvstMathPreset('sqrt')">Square Root</button>
    <button type="button" onclick="jnvstMathPreset('power')">Power</button>
    <button type="button" onclick="jnvstMathPreset('cube')">Cube Root</button>
    <button type="button" onclick="jnvstMathPreset('times')">×</button>
    <button type="button" onclick="jnvstMathPreset('div')">÷</button>
    <button type="button" onclick="jnvstMathPreset('pi')">π</button>
    <button type="button" onclick="jnvstMathPreset('le')">≤</button>
    <button type="button" onclick="jnvstMathPreset('ge')">≥</button>
   </div>
   <div id="jnvstMathLivePreview" class="eq-preview"></div>
   <div class="actions">
    <button type="button" onclick="jnvstInsertMath()">Insert Equation</button>
    <button type="button" class="secondary" onclick="jnvstCloseMathEditor()">Cancel</button>
   </div>
  </div>`;
 modal.onclick=()=>jnvstCloseMathEditor();
 document.body.appendChild(modal);
 const init=()=>{
   const mf=document.getElementById('jnvstMathField');
   if(!mf)return;
   const selected=target.value.slice(start,end).trim();
   // Only load an existing expression when the selected text is already a single math token.
   if(selected.startsWith('\\(')&&selected.endsWith('\\)')) mf.value=selected.slice(2,-2);
   else if(selected.startsWith('$$')&&selected.endsWith('$$')) mf.value=selected.slice(2,-2);
   else mf.value='';
   mf.addEventListener('input',()=>jnvstUpdateMathLivePreview());
   setTimeout(()=>{try{mf.focus()}catch(e){};jnvstUpdateMathLivePreview()},80);
 };
 if(customElements?.whenDefined)customElements.whenDefined('math-field').then(init).catch(init);
 else init();
}
function jnvstMathPreset(name){
 const mf=document.getElementById('jnvstMathField');if(!mf)return;
 const cmds={
  frac:'\\frac{#0}{#?}',
  sqrt:'\\sqrt{#0}',
  power:'^{#?}',
  cube:'\\sqrt[3]{#0}',
  times:'\\times ',
  div:'\\div ',
  pi:'\\pi ',
  le:'\\le ',
  ge:'\\ge '
 };
 try{mf.executeCommand(['insert',cmds[name]||'']);}catch(e){try{mf.insert(cmds[name]||'')}catch(_){}}
 try{mf.focus()}catch(e){}
 jnvstUpdateMathLivePreview();
}
function jnvstUpdateMathLivePreview(){
 const mf=document.getElementById('jnvstMathField'),p=document.getElementById('jnvstMathLivePreview');
 if(!mf||!p)return;
 p.textContent='\\('+(mf.value||'')+'\\)';
 if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise([p]).catch(()=>{});
}
function jnvstInsertMath(){
 const mf=document.getElementById('jnvstMathField');
 const state=jnvstMathEditorState||{};
 const target=state.target;
 if(!mf||!target)return;
 const latex=String(mf.value||'').trim();
 if(!latex)return notify('Enter a mathematical expression first.');
 const insertion='\\('+latex+'\\)';
 const start=Math.max(0,Math.min(Number(state.start)||0,target.value.length));
 const end=Math.max(start,Math.min(Number(state.end)||start,target.value.length));
 target.focus();
 if(typeof target.setRangeText==='function')target.setRangeText(insertion,start,end,'end');
 else target.value=target.value.slice(0,start)+insertion+target.value.slice(end);
 target.dispatchEvent(new Event('input',{bubbles:true}));
 target.dispatchEvent(new Event('change',{bubbles:true}));
 jnvstCloseMathEditor();
 target.focus();
}
function jnvstPreviewEditImage(input){const box=document.getElementById('jqImagePreview'),file=input.files?.[0];if(!box||!file)return;if(!file.type.startsWith('image/')){input.value='';return notify('Please select an image file.');}if(file.size>10*1024*1024){input.value='';return notify('Image size must be 10 MB or less.');}const url=URL.createObjectURL(file);box.innerHTML=`<img class="jnvst-editor-image" src="${url}" alt="New question image"><div class="small muted">New image selected.</div>`;const rm=document.getElementById('jqRemoveImage');if(rm)rm.checked=false;}
async function jnvstQbSaveEditRich(){
 const id=jnvstQbEditingId;if(!id)return;
 const subject=document.getElementById('jqSubject')?.value||'',lesson=document.getElementById('jqLesson')?.value||'';
 if(!subject||!lesson)return notify('Select JNVST Subject and Lesson/Sub-lesson.');
 const text=document.getElementById('jqQuestion')?.value.trim()||'';
 const file=document.getElementById('jqImage')?.files?.[0];
 const removeImage=!!document.getElementById('jqRemoveImage')?.checked;
 try{
  const {data:q,error:qe}=await sb.from('mock_question_bank').select('image_url').eq('id',id).eq('teacher_id',current.id).single();if(qe)throw qe;
  let imageUrl=q.image_url||null;
  if(removeImage)imageUrl=null;
  if(file)imageUrl=await uploadMockFile(file,`${current.id}/jnvst-edited/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`);
  const payload={subject_id:subject,lesson_id:lesson,language:document.getElementById('jqMedium').value,topic:document.getElementById('jqTopic').value.trim()||null,marks:Number(document.getElementById('jqMarks').value||1),cognitive_level:document.getElementById('jqCognitive').value||null,difficulty:document.getElementById('jqDifficulty').value||null,variation_group:document.getElementById('jqGroup').value.trim()||null,is_fixed:!!document.getElementById('jqFixed')?.checked,question_text:text||null,option_a:document.getElementById('jqOptA')?.value.trim()||null,option_b:document.getElementById('jqOptB')?.value.trim()||null,option_c:document.getElementById('jqOptC')?.value.trim()||null,option_d:document.getElementById('jqOptD')?.value.trim()||null,correct_option:document.getElementById('jqAnswer').value,explanation:document.getElementById('jqExplanation')?.value.trim()||null,image_url:imageUrl};
  if(!Number.isFinite(payload.marks)||payload.marks<0)throw new Error('Marks must be 0 or greater.');
  const {error}=await sb.from('mock_question_bank').update(payload).eq('id',id).eq('teacher_id',current.id);if(error)throw error;
  notify('JNVST question updated successfully.');jnvstQuestionBankHome();
 }catch(e){notify('Could not save JNVST question: '+(e.message||e))}
}
async function jnvstQbSaveEdit(){return jnvstQbSaveEditRich()}
function jnvstManualAddQuestion(){
  const subjects=jnvstSubjects||[];
  const escx=v=>esc(v??'');
  const subjectOptions=jnvstQbSubjectOptions('');
  render(`<div class="wrap">${header('Add JNVST Question')}
    <div class="card" style="border:2px solid #2563eb;background:#f8fbff">
      <div class="notice"><b>JNVST Manual Question Entry</b><br>Enter one logical question here. For bilingual questions, fill both English and Assamese sections. They will be stored as linked language records in the JNVST Question Bank. This form writes only to <b>mock_question_bank</b>; School Course questions are not affected.</div>
      <div class="grid">
        <div><label>JNVST Subject <span style="color:#dc2626">*</span></label><select id="jmSubject" onchange="jnvstManualSubjectChanged()">${subjectOptions}</select></div>
        <div><label>Medium / Version <span style="color:#dc2626">*</span></label><select id="jmMedium" onchange="jnvstManualMediumChanged()"><option value="BILINGUAL">English + Assamese</option><option value="ENGLISH">English only</option><option value="ASSAMESE">Assamese only</option><option value="COMMON">Common (MAT)</option></select></div>
        <div><label>Lesson / Sub-lesson <span style="color:#dc2626">*</span></label><select id="jmLesson"><option value="">— Select Subject First —</option></select></div>
        <div><label>Part <span style="color:#dc2626">*</span></label><select id="jmPart"></select></div>
        <div><label>Topic <span style="color:#dc2626">*</span></label><input id="jmTopic" placeholder="e.g. Fractions, Pattern Completion"></div>
        <div><label>Question Type</label><select id="jmType"><option value="MCQ">MCQ</option><option value="Short">Short</option><option value="Long">Long</option><option value="EVS-PASSAGE">EVS Passage Question</option><option value="LANGUAGE-PASSAGE">Language Passage Question</option></select></div>
        <div><label>Marks</label><input id="jmMarks" type="number" min="0" step="0.5" value="1"></div>
        <div><label>Cognitive Level</label><select id="jmCognitive"><option value="">— Optional —</option>${['Knowledge','Understanding','Application','HOTS'].map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div>
        <div><label>Difficulty</label><select id="jmDifficulty"><option value="">— Optional —</option>${['Easy','Medium','Hard'].map(v=>`<option value="${v}">${v}</option>`).join('')}</select></div>
        <div><label>Variation Group</label><input id="jmVariation" placeholder="Optional, e.g. FRA-001"></div>
        <div style="display:flex;align-items:center;padding-top:24px"><label style="display:flex;align-items:center;gap:8px;margin:0"><input id="jmFixed" type="checkbox" style="width:auto"> Mark as Fixed / Mandatory Question</label></div>
      </div>
      <div id="jmPassageFields" style="display:none;margin-top:14px;padding:14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff">
        <h3 style="margin:0 0 10px">Passage Information</h3>
        <div class="grid">
          <div><label>Local Passage No.</label><input id="jmPassageNo" placeholder="e.g. 1"></div>
          <div><label>Question Order</label><select id="jmQuestionOrder"><option value="">— Not a passage question —</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></div>
          <div><label>Passage Title — English</label><input id="jmPassageTitleEn"></div>
          <div><label>Passage Title — Assamese</label><input id="jmPassageTitleAs"></div>
        </div>
        <div class="grid" style="margin-top:10px">
          <div><label>Passage — English</label><textarea id="jmPassageEn" rows="6"></textarea></div>
          <div><label>Passage — Assamese</label><textarea id="jmPassageAs" rows="6"></textarea></div>
        </div>
        <div class="small muted" style="margin-top:8px">For a complete passage entity, create exactly 5 questions with the same Local Passage No. and Question Order 1–5. Existing bulk-upload passage rules are unchanged.</div>
      </div>
    </div>

    <div id="jmEnglishCard" class="card" style="border:2px solid #2563eb;background:#f8fbff">
      <h2 style="margin-top:0">🇬🇧 English Version</h2>
      <div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jmEnQ')">∑ Equation Editor</button></div>
      <textarea id="jmEnQ" rows="7" placeholder="Type the English question..." oninput="jnvstRefreshMathPreview('jmEnQPreview',this.value)"></textarea><div id="jmEnQPreview" class="eq-preview"></div>
      <div class="grid" style="margin-top:10px">${['A','B','C','D'].map(o=>`<div><label>Option ${o} — English</label><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jmEn${o}')">∑ Equation</button></div><textarea id="jmEn${o}" rows="3" oninput="jnvstRefreshMathPreview('jmEn${o}Preview',this.value)"></textarea><div id="jmEn${o}Preview" class="eq-preview"></div></div>`).join('')}</div>
      <div class="grid"><div><label>Correct Answer — English</label><select id="jmEnAns"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div><div><label>Explanation — English</label><textarea id="jmEnEx" rows="3"></textarea></div></div>
    </div>

    <div id="jmAssameseCard" class="card" style="border:2px solid #16a34a;background:#f7fff9">
      <h2 style="margin-top:0">🇮🇳 Assamese Version</h2>
      <div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jmAsQ')">∑ Equation Editor</button></div>
      <textarea id="jmAsQ" rows="7" placeholder="প্ৰশ্নটো অসমীয়াত লিখক..." oninput="jnvstRefreshMathPreview('jmAsQPreview',this.value)"></textarea><div id="jmAsQPreview" class="eq-preview"></div>
      <div class="grid" style="margin-top:10px">${['A','B','C','D'].map(o=>`<div><label>Option ${o} — Assamese</label><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('jmAs${o}')">∑ Equation</button></div><textarea id="jmAs${o}" rows="3" oninput="jnvstRefreshMathPreview('jmAs${o}Preview',this.value)"></textarea><div id="jmAs${o}Preview" class="eq-preview"></div></div>`).join('')}</div>
      <div class="grid"><div><label>Correct Answer — Assamese</label><select id="jmAsAns"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div><div><label>Explanation — Assamese</label><textarea id="jmAsEx" rows="3"></textarea></div></div>
    </div>

    <div class="card"><h3 style="margin-top:0">Question Image / Diagram</h3><input id="jmImage" type="file" accept="image/*" onchange="jnvstManualPreviewImage(this)"><div id="jmImagePreview" class="small muted" style="margin-top:8px">No image selected.</div></div>
    <div class="actions" style="margin-top:16px"><button id="jmSave" onclick="saveJnvstManualQuestion()">💾 Save Question</button><button id="jmSaveAnother" class="secondary" onclick="saveJnvstManualQuestion(true)">💾 Save & Add Another</button><button class="secondary" onclick="jnvstQuestionBankHome()">Cancel</button></div>
  </div>`);
  jnvstManualSubjectChanged();
  jnvstManualMediumChanged();
  document.getElementById('jmType')?.addEventListener('change',jnvstManualTypeChanged);
  jnvstManualTypeChanged();
  if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
}
function jnvstManualSubjectChanged(){
  const subject=document.getElementById('jmSubject')?.value||'',lesson=document.getElementById('jmLesson');
  if(lesson)lesson.innerHTML=jnvstQbLessonOptions(subject,'');
}
function jnvstManualMediumChanged(){
  const medium=document.getElementById('jmMedium')?.value||'BILINGUAL',part=document.getElementById('jmPart');
  const opts=medium==='COMMON'?[['MAT_PATTERN','Pattern Completion'],['MAT_SERIES','Series'],['MAT_GEOMETRICAL','Geometrical Figure'],['MAT_MIRROR','Mirror Image'],['MAT_EMBEDDED','Embedded Figure']]:[['ARITHMETIC','Arithmetic'],['EVS_MCQ','EVS-MCQ'],['EVS_PASSAGE','EVS-Passage'],['LANGUAGE_MCQ','Language-MCQ'],['LANGUAGE_PASSAGE','Language-Passage']];
  if(part)part.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  const en=document.getElementById('jmEnglishCard'),as=document.getElementById('jmAssameseCard');
  if(en)en.style.display=medium==='ASSAMESE'||medium==='COMMON'?'none':'block';
  if(as)as.style.display=medium==='ENGLISH'||medium==='COMMON'?'none':'block';
  jnvstManualTypeChanged();
}
function jnvstManualTypeChanged(){
  const type=document.getElementById('jmType')?.value||'MCQ',box=document.getElementById('jmPassageFields');
  const passage=type==='EVS-PASSAGE'||type==='LANGUAGE-PASSAGE';
  if(box)box.style.display=passage?'block':'none';
}
function jnvstManualPreviewImage(input){
  const box=document.getElementById('jmImagePreview'),file=input?.files?.[0];if(!box)return;
  if(!file){box.innerHTML='<span class="muted">No image selected.</span>';return;}
  if(file.size>10*1024*1024){input.value='';return notify('Image size must be 10 MB or less.');}
  box.innerHTML=`<img class="jnvst-editor-image" src="${URL.createObjectURL(file)}" alt="Question image preview"><div class="small muted">Image selected.</div>`;
}
function jnvstManualField(id){return document.getElementById(id)?.value.trim()||''}
async function saveJnvstManualQuestion(saveAnother=false){
  const subject=document.getElementById('jmSubject')?.value||'',lesson=document.getElementById('jmLesson')?.value||'',medium=document.getElementById('jmMedium')?.value||'',part=document.getElementById('jmPart')?.value||'',topic=jnvstManualField('jmTopic');
  const type=document.getElementById('jmType')?.value||'MCQ',marks=Number(document.getElementById('jmMarks')?.value||1);
  if(!subject||!lesson)return notify('Select JNVST Subject and Lesson / Sub-lesson.');
  if(!part||!topic)return notify('Part and Topic are required.');
  if(!Number.isFinite(marks)||marks<0)return notify('Marks must be 0 or greater.');
  const passage=type==='EVS-PASSAGE'||type==='LANGUAGE-PASSAGE';
  const pno=jnvstManualField('jmPassageNo'),order=Number(document.getElementById('jmQuestionOrder')?.value||0);
  if(passage&&(!pno||![1,2,3,4,5].includes(order)))return notify('For a passage question, Local Passage No. and Question Order 1–5 are required.');
  const makeVersion=(lang)=>({language:lang,question_text:jnvstManualField(lang==='ENGLISH'?'jmEnQ':'jmAsQ'),option_a:jnvstManualField(lang==='ENGLISH'?'jmEnA':'jmAsA'),option_b:jnvstManualField(lang==='ENGLISH'?'jmEnB':'jmAsB'),option_c:jnvstManualField(lang==='ENGLISH'?'jmEnC':'jmAsC'),option_d:jnvstManualField(lang==='ENGLISH'?'jmEnD':'jmAsD'),correct_option:document.getElementById(lang==='ENGLISH'?'jmEnAns':'jmAsAns')?.value||'A',explanation:jnvstManualField(lang==='ENGLISH'?'jmEnEx':'jmAsEx'),passage_title:jnvstManualField(lang==='ENGLISH'?'jmPassageTitleEn':'jmPassageTitleAs'),passage_text:jnvstManualField(lang==='ENGLISH'?'jmPassageEn':'jmPassageAs')});
  let versions=[];
  if(medium==='COMMON')versions=[makeVersion('COMMON')];
  else if(medium==='ENGLISH')versions=[makeVersion('ENGLISH')];
  else if(medium==='ASSAMESE')versions=[makeVersion('ASSAMESE')];
  else versions=[makeVersion('ENGLISH'),makeVersion('ASSAMESE')];
  if(versions.some(v=>!v.question_text))return notify('Question text is required for every selected language version.');
  if(type==='MCQ'&&versions.some(v=>!['A','B','C','D'].includes(v.correct_option)))return notify('Correct Answer must be A, B, C or D.');
  if(passage){
    for(const v of versions){if(!v.passage_title||!v.passage_text)return notify(`Passage title and passage text are required for ${v.language==='ENGLISH'?'English':v.language==='ASSAMESE'?'Assamese':'the selected language'}.`);}
  }
  const btn=document.getElementById('jmSave'),btn2=document.getElementById('jmSaveAnother');if(btn)btn.disabled=true;if(btn2)btn2.disabled=true;
  try{
    const subj=(jnvstSubjects||[]).find(s=>s.id===subject),lessonObj=(jnvstSubjectLessons||[]).find(l=>l.id===lesson);if(!subj||!lessonObj)throw new Error('Selected Subject or Lesson could not be found.');
    let imageUrl=null;const file=document.getElementById('jmImage')?.files?.[0];if(file)imageUrl=await uploadMockFile(file,`${current.id}/jnvst-manual/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`);
    const pairId=versions.length>1?crypto.randomUUID():null;
    const passageId=passage?`JNVST-${part==='EVS_PASSAGE'?'EVS':'LANG'}-${medium}-${shortId()}`:null;
    const rows=versions.map(v=>({teacher_id:current.id,section_code:sectionFor(part),part_code:part,topic,variation_group:jnvstManualField('jmVariation')||null,is_fixed:!!document.getElementById('jmFixed')?.checked,question_type:type,marks,cognitive_level:document.getElementById('jmCognitive')?.value||null,difficulty:document.getElementById('jmDifficulty')?.value||null,language:v.language,subject_id:subj.id,lesson_id:lessonObj.id,lesson_code:lessonObj.lesson_code||null,question_text:v.question_text,option_a:v.option_a||null,option_b:v.option_b||null,option_c:v.option_c||null,option_d:v.option_d||null,correct_option:v.correct_option,explanation:v.explanation||null,source_type:'JNVST_MANUAL',active:true,image_url:imageUrl,passage_id:passageId,passage_title:passage?v.passage_title:null,passage_text:passage?v.passage_text:null,question_order:passage?order:null,language_pair_id:pairId,set_id:passageId}));
    const {data:old,error:oe}=await sb.from('mock_question_bank').select('id,question_text,option_a,option_b,option_c,option_d,subject_id,lesson_id,language,passage_id,question_order').eq('teacher_id',current.id).eq('active',true);if(oe)throw oe;
    const seen=new Set((old||[]).map(q=>[q.subject_id,q.lesson_id,q.language,q.passage_id,q.question_order,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d].map(v=>String(v??'').trim().toLowerCase()).join('¦')));
    const fresh=[];for(const r of rows){const key=[r.subject_id,r.lesson_id,r.language,r.passage_id,r.question_order,r.question_text,r.option_a,r.option_b,r.option_c,r.option_d].map(v=>String(v??'').trim().toLowerCase()).join('¦');if(seen.has(key))throw new Error(`A duplicate ${r.language} question already exists in this Subject/Lesson.`);seen.add(key);fresh.push(r);}
    const {error}=await sb.from('mock_question_bank').insert(fresh);if(error)throw error;
    notify(`JNVST question saved successfully.\nAdded ${fresh.length} language record(s).${passage?'\nThis question is linked to passage '+pno+' / order '+order+'.':''}`);
    if(saveAnother){jnvstManualAddQuestion();}else{jnvstQuestionBankHome();}
  }catch(e){notify('Could not save JNVST question: '+(e.message||e));if(btn)btn.disabled=false;if(btn2)btn2.disabled=false;}
}
function jnvstQuestionBulkUpload(){jnvstQbBulkRows=[];jnvstPdfRows=[];jnvstPdfMeta={};render(`<div class="wrap">${header('Bulk Upload JNVST Question Bank')}<div class="card"><div class="notice"><b>JNVST only.</b> This uploader writes to <b>mock_question_bank</b>. School Course Question Bank is not affected.<br><b>Part is important:</b> individual EVS = <code>EVS_MCQ</code>; EVS passage = <code>EVS_PASSAGE</code>; Language passage = <code>LANGUAGE_PASSAGE</code>; Arithmetic = <code>ARITHMETIC</code>. The importer also infers Part when the column is blank.</div><div class="actions"><button class="secondary" onclick="downloadJnvstQuestionTemplate()">⬇ Download Excel Template</button><button class="secondary" onclick="downloadJnvstMatPdfTemplate()">⬇ MAT PDF + Excel Template</button><button class="secondary" onclick="jnvstQuestionBankHome()">← Back</button></div></div><div class="card" style="border:2px solid #16a34a"><span class="tag" style="background:#dcfce7;color:#166534">PDF + EXCEL</span><h3>🧩 Mental Ability (MAT) — Image Question Bulk Upload</h3><p class="small muted">Upload one PDF containing one complete MAT question per page and one Excel file containing the answer key and metadata. PDF page 1 = Question 1, page 2 = Question 2, etc. Unnecessary white margins are cropped automatically.</p><div class="grid"><div><label>JNVST Subject</label><select id="jnvstPdfSubject">${jnvstQbSubjectOptions('')}</select></div><div><label>Medium</label><select id="jnvstPdfMedium"><option value="COMMON">Common (MAT)</option></select></div><div><label>Lesson / Sub-lesson</label><select id="jnvstPdfLesson">${jnvstQbLessonOptions('','')}</select></div></div><label>Questions PDF</label><input id="jnvstPdfFile" type="file" accept=".pdf" onchange="readJnvstQuestionPdf(event)"><label>Answer Key & Metadata Excel</label><input id="jnvstPdfExcel" type="file" accept=".xlsx,.xls" onchange="readJnvstPdfMetadataExcel(event)"><div id="jnvstPdfPreview" class="small muted" style="margin-top:10px">No PDF or metadata file selected.</div><div class="actions"><button id="jnvstPdfImportBtn" disabled onclick="saveJnvstPdfBulk()">✓ Validate & Import PDF Questions</button></div></div><div class="card"><h3>📝 Text / MCQ Excel Bulk Upload</h3><div class="notice"><b>Mathematics supported:</b> You may type LaTeX-style equations directly in Excel cells, for example <code>\frac{3}{4}</code>, <code>x^2</code>, <code>\sqrt{16}</code>, <code>\times</code>, <code>\div</code>. Equations in Question, Options and Explanation are rendered as mathematics after upload.</div><label>Excel file (.xlsx / .xls)</label><input type="file" accept=".xlsx,.xls" onchange="readJnvstQuestionExcel(event)"><div id="jnvstQbBulkPreview" class="small muted" style="margin-top:10px">No file selected.</div><div id="jnvstQbBulkMathPreview" class="eq-preview" style="margin-top:10px"></div></div><div class="actions"><button id="jnvstQbImportBtn" disabled onclick="saveJnvstQuestionBulk()">✓ Validate & Import Excel Questions</button><button class="secondary" onclick="jnvstQuestionBankHome()">Cancel</button></div></div>`);document.getElementById('jnvstPdfSubject')?.addEventListener('change',e=>{const l=document.getElementById('jnvstPdfLesson');if(l)l.innerHTML=jnvstQbLessonOptions(e.target.value,'')})}
function downloadJnvstMatPdfTemplate(){if(typeof XLSX==='undefined')return notify('Excel library is not loaded.');const wb=XLSX.utils.book_new();const rows=[['Question_No','Correct_Option','Part','Topic','Marks','Cognitive_Level','Difficulty','Explanation'],[1,'A','MAT_PATTERN','Pattern Completion',1,'','','']];const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=rows[0].map((_,i)=>({wch:[14,16,18,28,10,20,16,40][i]}));XLSX.utils.book_append_sheet(wb,ws,'MAT Metadata');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['JNVST MAT PDF Bulk Upload Instructions'],['PDF: one complete image-based question per page.'],['Question_No must exactly match the PDF page number.'],['Correct_Option is required and must be A, B, C or D.'],['Part, Topic and Marks are required.'],['Cognitive_Level, Difficulty and Explanation are optional and may be blank.'],['The PDF page is cropped to remove unnecessary white margins before storage.'],['The selected JNVST Subject and Lesson/Sub-lesson are applied to all uploaded PDF questions.']]),'Instructions');XLSX.writeFile(wb,'JNVST_MAT_PDF_Metadata_Template.xlsx')}
async function readJnvstQuestionPdf(ev){const file=ev.target.files?.[0],box=document.getElementById('jnvstPdfPreview'),btn=document.getElementById('jnvstPdfImportBtn');if(!file||!box)return;btn.disabled=true;box.innerHTML=message('Reading PDF pages and cropping unnecessary white space…',true);try{const buf=await file.arrayBuffer(),pdfjs=await getMockPdfJs(),pdf=await pdfjs.getDocument({data:buf}).promise;jnvstPdfRows=[];for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),base=page.getViewport({scale:1}),scale=Math.min(2.2,Math.max(1.4,1600/base.width)),vp=page.getViewport({scale}),c=document.createElement('canvas'),ctx=c.getContext('2d',{alpha:false});c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:ctx,viewport:vp}).promise;const cropped=cropWhiteMargins(c);jnvstPdfRows.push({page:p,image_data:cropped.toDataURL('image/jpeg',0.93)});}box.innerHTML=message(`Prepared ${jnvstPdfRows.length} cropped PDF question page(s). Now upload the Answer Key & Metadata Excel.`,true)}catch(e){jnvstPdfRows=[];box.innerHTML=message('PDF processing failed: '+(e.message||e))}}
function readJnvstPdfMetadataExcel(ev){const f=ev.target.files?.[0],box=document.getElementById('jnvstPdfPreview'),btn=document.getElementById('jnvstPdfImportBtn');if(!f||!box)return;btn.disabled=true;const r=new FileReader();r.onload=e=>{try{const wb=XLSX.read(e.target.result,{type:'array'}),ws=wb.Sheets[wb.SheetNames.find(n=>String(n).toLowerCase().includes('metadata'))||wb.SheetNames[0]],raw=XLSX.utils.sheet_to_json(ws,{defval:''});jnvstPdfMeta={};const errs=[];raw.forEach((x,i)=>{const row=i+2,n=Number(jnvstGetCell(x,['Question_No','Question No','Question Number']));const ans=jnvstGetCell(x,['Correct_Option','Correct Option','Answer']).toUpperCase();const part=jnvstGetCell(x,['Part']);const topic=jnvstGetCell(x,['Topic']);const marks=jnvstGetCell(x,['Marks']);const cognitive=jnvstGetCell(x,['Cognitive_Level','Cognitive Level']);const difficulty=jnvstGetCell(x,['Difficulty']);const explanation=jnvstGetCell(x,['Explanation']);if(!Number.isInteger(n)||n<1)errs.push(`Row ${row}: Question_No must be a positive integer.`);if(!['A','B','C','D'].includes(ans))errs.push(`Row ${row}: Correct_Option must be A, B, C or D.`);if(!part)errs.push(`Row ${row}: Part is required.`);if(!topic)errs.push(`Row ${row}: Topic is required.`);if(!marks||Number(marks)<=0)errs.push(`Row ${row}: Marks is required and must be greater than 0.`);if(Number.isInteger(n))jnvstPdfMeta[n]={page:n,correct:ans,part,topic,marks:Number(marks),cognitive:cognitive||null,difficulty:difficulty||null,explanation:explanation||null}});if(!jnvstPdfRows.length)errs.push('Please upload the Questions PDF first.');const pages=jnvstPdfRows.map(x=>x.page),missing=pages.filter(n=>!jnvstPdfMeta[n]),extra=Object.keys(jnvstPdfMeta).map(Number).filter(n=>!pages.includes(n));if(missing.length)errs.push('Missing Excel record(s) for PDF page(s): '+missing.join(', '));if(extra.length)errs.push('Excel contains Question_No not present in PDF: '+extra.join(', '));if(new Set(Object.keys(jnvstPdfMeta)).size!==Object.keys(jnvstPdfMeta).length)errs.push('Duplicate Question_No found in Excel.');box.innerHTML=errs.length?message(`<b>Validation failed.</b><br>${errs.slice(0,25).map(esc).join('<br>')}`):message(`<b>Ready to import ${jnvstPdfRows.length} MAT image question(s).</b><br>PDF pages and Excel records match. Cognitive Level, Difficulty and Explanation are optional.`,true);btn.disabled=!!errs.length||!jnvstPdfRows.length}catch(err){box.innerHTML=message('Could not read MAT metadata Excel: '+err.message)}};r.readAsArrayBuffer(f)}
function jnvstGetCell(row,names){const keys=Object.keys(row||{});for(const n of names){const k=keys.find(x=>String(x).trim().toLowerCase().replace(/[_\s-]+/g,' ')===String(n).trim().toLowerCase().replace(/[_\s-]+/g,' '));if(k!==undefined)return String(row[k]??'').trim()}return ''}
function jnvstBulkUploadLock(title='Uploading JNVST questions…',detail='Please wait. Do not click Upload again or close this page while the data is being sent to the server.') {
  if(document.getElementById('jnvstBulkUploadLock')) return;
  const el=document.createElement('div');
  el.id='jnvstBulkUploadLock';
  el.className='jnvst-upload-lock';
  el.innerHTML=`<div class="jnvst-upload-lock-card" role="dialog" aria-modal="true" aria-live="polite">
    <div class="jnvst-upload-spinner" aria-hidden="true"></div>
    <h3 id="jnvstBulkUploadTitle">${esc(title)}</h3>
    <p id="jnvstBulkUploadDetail">${esc(detail)}</p>
    <div class="jnvst-upload-progress"><div id="jnvstBulkUploadBar"></div></div>
    <div class="jnvst-upload-status" id="jnvstBulkUploadStatus">Preparing upload…</div>
  </div>`;
  document.body.appendChild(el);
  document.querySelectorAll('button,input,select,textarea').forEach(x=>{ if(x!==el && !el.contains(x)){ x.dataset.jnvstUploadWasDisabled=x.disabled?'1':'0'; x.disabled=true; }});
}
function jnvstBulkUploadProgress(percent,status){
  const bar=document.getElementById('jnvstBulkUploadBar'); if(bar)bar.style.width=Math.max(5,Math.min(100,percent))+'%';
  const st=document.getElementById('jnvstBulkUploadStatus'); if(st)st.textContent=status||'';
}
function jnvstBulkUploadUnlock(){
  document.querySelectorAll('[data-jnvst-upload-was-disabled]').forEach(x=>{x.disabled=x.dataset.jnvstUploadWasDisabled==='1';delete x.dataset.jnvstUploadWasDisabled;});
  document.getElementById('jnvstBulkUploadLock')?.remove();
}
async function newJnvstMainGroup(){
 render(`<div class="wrap">${header("Create JNVST Main Group")}<div class="card"><label>Main Group Name</label><input id="jnvstMainName" placeholder="e.g. JNVST-V (Foundation)"><label>Description</label><textarea id="jnvstMainDesc" placeholder="Optional description"></textarea><div class="actions"><button onclick="saveJnvstMainGroup()">Create Main Group</button><button class="secondary" onclick="manageJnvstClasses()">Cancel</button></div></div></div>`);
}
async function saveJnvstMainGroup(){
 const name=document.getElementById("jnvstMainName")?.value.trim(),desc=document.getElementById("jnvstMainDesc")?.value.trim()||"";
 if(!name)return notify("Enter a main group name.");
 if((window._jnvstClasses||[]).some(c=>!isJnvstSubGroup(c)&&String(c.name||"").trim().toLowerCase()===name.toLowerCase()))return notify("A main group with this name already exists.");
 const {data,error}=await sb.from("classes").insert({name,description:`JNVST_MAIN_GROUP| ${desc}`.trim(),teacher_id:current.id,course:"JNVST-CUSTOM",jnvst_group_type:"MAIN",jnvst_parent_id:null}).select("*").single();
 if(error)return notify(error.message);
 await teacherHome();setTimeout(manageJnvstClasses,200);
}
async function newJnvstSubgroup(parentId){
 const parent=(window._jnvstClasses||[]).find(c=>c.id===parentId) || (window._jnvstClasses||[]).find(c=>jnvstBaseKey(c)===parentId);
 if(!parent)return notify("Main group not found.");
 render(`<div class="wrap">${header("Create JNVST Sub-group")}<div class="card"><div class="tag">Parent: ${esc(parent.name)}</div><label>Sub-group Name</label><input id="jnvstSubName" placeholder="Group A / Batch 1 / Evening Batch"><label>Description</label><textarea id="jnvstSubDesc" placeholder="Optional description"></textarea><div class="actions"><button onclick="saveJnvstSubgroup('${parent.id}')">Create Sub-group</button><button class="secondary" onclick="manageJnvstClasses()">Cancel</button></div></div></div>`);
}
async function saveJnvstSubgroup(parentId){
 const parent=(window._jnvstClasses||[]).find(c=>c.id===parentId);if(!parent)return notify("Main group not found.");
 const name=document.getElementById("jnvstSubName")?.value.trim(),desc=document.getElementById("jnvstSubDesc")?.value.trim()||"";
 if(!name)return notify("Enter a sub-group name.");
 const exists=jnvstSubgroupsForMain(window._jnvstClasses||[],parent).some(c=>String(c.name||"").trim().toLowerCase()===name.toLowerCase());
 if(exists)return notify("A sub-group with this name already exists under this main group.");
 const key=jnvstBaseKey(parent),course=key==="JNVST-VI"?"JNVST-6":key==="JNVST-IX"?"JNVST-9":"JNVST-CUSTOM";
 const fullDesc=key?`JNVST_SUBGROUP_PARENT:${key}| ${desc}`.trim():`JNVST_SUBGROUP_PARENT_ID:${parent.id}| ${desc}`.trim();
 const {error}=await sb.from("classes").insert({name,description:fullDesc,teacher_id:current.id,course,jnvst_group_type:"SUB",jnvst_parent_id:parent.id});
 if(error)return notify(error.message);
 await teacherHome();setTimeout(manageJnvstClasses,200);
}
async function newJnvstSubject(){
 render(`<div class="wrap">${header("Create JNVST Subject")}<div class="card"><label>Subject Name</label><input id="jnvstSubjectName" placeholder="e.g. Mathematics"><label>Description</label><textarea id="jnvstSubjectDesc" placeholder="Optional description"></textarea><div class="actions"><button onclick="saveJnvstSubject()">Create Subject</button><button class="secondary" onclick="manageJnvstClasses()">Cancel</button></div></div></div>`);
}
async function saveJnvstSubject(){
 const name=document.getElementById("jnvstSubjectName")?.value.trim(),description=document.getElementById("jnvstSubjectDesc")?.value.trim()||null;
 if(!name)return notify("Enter a subject name.");
 if((jnvstSubjects||[]).some(x=>String(x.name).trim().toLowerCase()===name.toLowerCase()))return notify("This subject already exists.");
 const {data,error}=await sb.from("jnvst_subjects").insert({teacher_id:current.id,name,description}).select("*").single();
 if(error)return notify(error.message);
 jnvstSubjects.push(data);await teacherHome();setTimeout(manageJnvstClasses,200);
}
async function newJnvstLesson(subjectId,parentId=''){
 const subject=(jnvstSubjects||[]).find(x=>x.id===subjectId);if(!subject)return notify('Subject not found.');
 const parent=parentId?(jnvstSubjectLessons||[]).find(x=>x.id===parentId):null;
 render(`<div class="wrap">${header(parent?'Create JNVST Sub-lesson':'Create JNVST Lesson')}<div class="card"><div class="tag">Subject: ${esc(subject.name)}${parent?` · Parent Lesson: ${esc(parent.lesson_name)}`:''}</div><label>Lesson / Sub-lesson Code</label><input id="jnvstLessonCode" placeholder="e.g. 1, 1.1, 1.2"><label>Lesson / Sub-lesson Name</label><input id="jnvstLessonName" placeholder="e.g. Addition of Fractions"><label>Description</label><textarea id="jnvstLessonDesc" placeholder="Optional description"></textarea><div class="actions"><button onclick="saveJnvstLesson('${subjectId}','${parentId||''}')">Create</button><button class="secondary" onclick="manageJnvstClasses()">Cancel</button></div></div></div>`);
}
async function saveJnvstLesson(subjectId,parentId=''){
 const code=document.getElementById('jnvstLessonCode')?.value.trim(),name=document.getElementById('jnvstLessonName')?.value.trim(),description=document.getElementById('jnvstLessonDesc')?.value.trim()||null;
 if(!code||!name)return notify('Enter both lesson code and lesson name.');
 if(!/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/.test(code))return notify('Use a simple lesson code such as 1, 1.1 or 1.2.');
 const exists=(jnvstSubjectLessons||[]).find(x=>x.subject_id===subjectId&&String(x.lesson_code||'').trim().toLowerCase()===code.toLowerCase());if(exists)return notify('This lesson code already exists under the selected subject.');
 const {data,error}=await sb.from('jnvst_subject_lessons').insert({teacher_id:current.id,subject_id:subjectId,parent_lesson_id:parentId||null,lesson_code:code,lesson_name:name,description}).select('*').single();
 if(error)return notify(error.message);jnvstSubjectLessons.push(data);await teacherHome();setTimeout(manageJnvstClasses,200);
}
async function editJnvstLesson(id){
 const l=(jnvstSubjectLessons||[]).find(x=>x.id===id);if(!l)return notify('Lesson not found.');
 render(`<div class="wrap">${header('Edit JNVST Lesson')}<div class="card"><label>Lesson / Sub-lesson Code</label><input id="jnvstLessonCode" value="${esc(l.lesson_code||'')}"><label>Lesson / Sub-lesson Name</label><input id="jnvstLessonName" value="${esc(l.lesson_name||'')}"><label>Description</label><textarea id="jnvstLessonDesc">${esc(l.description||'')}</textarea><div class="actions"><button onclick="updateJnvstLesson('${id}')">Save Changes</button><button class="secondary" onclick="manageJnvstClasses()">Cancel</button></div></div></div>`);
}
async function updateJnvstLesson(id){
 const l=(jnvstSubjectLessons||[]).find(x=>x.id===id);if(!l)return;
 const code=document.getElementById('jnvstLessonCode')?.value.trim(),name=document.getElementById('jnvstLessonName')?.value.trim(),description=document.getElementById('jnvstLessonDesc')?.value.trim()||null;
 if(!code||!name)return notify('Enter both lesson code and lesson name.');
 const dup=(jnvstSubjectLessons||[]).find(x=>x.id!==id&&x.subject_id===l.subject_id&&String(x.lesson_code||'').trim().toLowerCase()===code.toLowerCase());if(dup)return notify('This lesson code already exists under the subject.');
 const {data,error}=await sb.from('jnvst_subject_lessons').update({lesson_code:code,lesson_name:name,description}).eq('id',id).eq('teacher_id',current.id).select('*').single();if(error)return notify(error.message);jnvstSubjectLessons=jnvstSubjectLessons.map(x=>x.id===id?data:x);await teacherHome();setTimeout(manageJnvstClasses,200);
}
async function deleteJnvstLesson(id){
 const l=(jnvstSubjectLessons||[]).find(x=>x.id===id);if(!l)return;
 const children=(jnvstSubjectLessons||[]).filter(x=>x.parent_lesson_id===id);if(children.length)return notify(`Cannot delete this lesson because it has ${children.length} sub-lesson(s). Delete or move the sub-lessons first.`);
 const {data:used,error}=await sb.from('mock_question_bank').select('id').eq('teacher_id',current.id).eq('lesson_id',id).limit(1);if(error)return notify(error.message);if((used||[]).length)return notify('This lesson is assigned to one or more Question Bank questions. Re-categorize those questions first.');
 if(!confirm(`Delete lesson "${l.lesson_name}"?`))return;const {error:de}=await sb.from('jnvst_subject_lessons').delete().eq('id',id).eq('teacher_id',current.id);if(de)return notify(de.message);jnvstSubjectLessons=jnvstSubjectLessons.filter(x=>x.id!==id);await teacherHome();setTimeout(manageJnvstClasses,200);
}
async function deleteJnvstSubject(id){
 const subject=(jnvstSubjects||[]).find(x=>x.id===id);if(!subject)return;
 const {data:used,error}=await sb.from("assignments").select("id,title").eq("created_by",current.id).eq("subject",subject.name);
 if(error)return notify(error.message);
 if((used||[]).length)return notify(`Cannot delete "${subject.name}". It is used by ${used.length} assignment(s). Delete those assignments or change their subject first.`);
 const {data:bankUsed,error:bankError}=await sb.from('mock_question_bank').select('id').eq('teacher_id',current.id).eq('subject_id',id).limit(1);
 if(bankError)return notify(bankError.message);
 if((bankUsed||[]).length)return notify(`Cannot delete "${subject.name}" because JNVST Question Bank questions are assigned to this subject. Re-categorize those questions first.`);
 if(!confirm(`Delete subject "${subject.name}"?\n\nThis subject will be removed from the subject list. This cannot be undone.`))return;
 const {error:de}=await sb.from("jnvst_subjects").delete().eq("id",id).eq("teacher_id",current.id);
 if(de)return notify("Could not delete subject: "+de.message);
 await teacherHome();setTimeout(manageJnvstClasses,200);
}
async function deleteJnvstMainGroup(id){
 const c=(window._jnvstClasses||[]).find(x=>x.id===id);if(!c)return;
 if(jnvstBaseKey(c))return notify("JNVST-VI and JNVST-IX are fixed main groups and cannot be deleted.");
 const subs=jnvstSubgroupsForMain(window._jnvstClasses||[],c);
 const members=await sb.from("class_students").select("student_id").eq("class_id",id);
 const assignments=await sb.from("assignments").select("id,title").eq("class_id",id);
 if(members.error)return notify(members.error.message);if(assignments.error)return notify(assignments.error.message);
 if(subs.length)return notify(`Cannot delete "${c.name}" because it contains ${subs.length} sub-group(s). Delete the sub-groups first.`);
 if((members.data||[]).length)return notify(`Cannot delete "${c.name}" because ${members.data.length} student(s) are assigned to it. Move/remove them first.`);
 if((assignments.data||[]).length)return notify(`Cannot delete "${c.name}" because it has ${assignments.data.length} assignment(s). Delete/reassign those assignments first.`);
 if(!confirm(`WARNING: Delete main group "${c.name}"?\n\nThis removes the group from the teacher dashboard. This action cannot be undone.`))return;
 const {error}=await sb.from("classes").delete().eq("id",id).eq("teacher_id",current.id);if(error)return notify("Could not delete main group: "+error.message);
 await teacherHome();
}
async function deleteJnvstClass(id){const c=(window._jnvstClasses||[]).find(x=>x.id===id);if(!c)return;if(jnvstBaseKey(c))return notify("JNVST-VI and JNVST-IX are fixed classes and cannot be deleted.");const [{data:members,error:me},{data:assignments,error:ae}]=await Promise.all([sb.from("class_students").select("student_id").eq("class_id",id),sb.from("assignments").select("id,title").eq("class_id",id)]);if(me)return notify(me.message);if(ae)return notify(ae.message);if((members||[]).length)return notify("This class/sub-group has students assigned to it. Move or remove the students before deleting the class.");if((assignments||[]).length)return notify("This class/sub-group has assignments. Delete or reassign those assignments before deleting the class.");if(!confirm(`WARNING: Delete sub-group "${c.name}"?\n\nThis group has no students or assignments. The sub-group definition will be permanently removed. Continue?`))return;const {error}=await sb.from("classes").delete().eq("id",id).eq("teacher_id",current.id);if(error)return notify("Could not delete class: "+error.message);await teacherHome()}
function renderTeacherAssignmentCards(assignments){
 return assignments.map(a=>`<div class="assignment teacher-assignment-row" data-main-group="${esc(a.main_group||"")}" data-sub-group="${esc(a.sub_group||"")}"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><h3>${esc(a.title)}</h3><p class="muted">${esc(a.subject||"")}</p></div><div class="actions">${groupBadge(a)}${a.adaptive_mode&&a.adaptive_selection_summary?.student_name?`<span class="tag" style="background:#f3e8ff;color:#6b21a8">🎯 ${esc(a.adaptive_selection_summary.student_name)}${a.adaptive_selection_summary.roll_no?' · '+esc(a.adaptive_selection_summary.roll_no):''} · ${Number(a.adaptive_weakness_count||0)} mistakes</span>`:''}${(a.assignment_type==="MOCK"||a.assignment_type==="mock")?`<span class="mock-badge">📝 MOCK TEST</span>`:`<span class="tag">${a.video_url?"MCQ + Video":"MCQ"}</span>`}<span class="tag">${a.deadline?`Deadline: ${new Date(a.deadline).toLocaleDateString()}`:"Active"}</span></div></div><div class="actions"><button onclick="viewAssignment('${a.id}')">View</button><button onclick="editAssignmentDetails('${a.id}')">✎ Edit Details</button><button onclick="editAssignmentGroup('${a.id}')">▣ Edit Group</button><button onclick="editAssignmentQuestions('${a.id}')">✎ Edit Questions</button><button onclick="editAssignmentSupport('${a.id}','hint')">💡 Add Hints</button><button onclick="editAssignmentSupport('${a.id}','video')">🎥 Add Solution Video</button><button onclick="editAssignmentSupport('${a.id}','explanation')">📖 Add Explanation</button><button onclick="reassignAssignment('${a.id}')">Assign / Reassign</button><button onclick="reassignFresh('${a.id}')">↻ Reassign Fresh</button><button class="secondary" onclick="results('${a.id}')">Results</button><button class="danger" onclick="deleteAssignment('${a.id}')">Delete</button></div></div>`).join("")||"<p class='muted'>No assignments yet.</p>";
}
function filterTeacherAssignments(){
 const main=document.getElementById("teacherAssignmentMainFilter")?.value||"all",sub=document.getElementById("teacherAssignmentSubFilter")?.value||"all";
 document.querySelectorAll(".teacher-assignment-row").forEach(row=>{const ok=(main==="all"||row.dataset.mainGroup===main)&&(sub==="all"||row.dataset.subGroup===sub);row.style.display=ok?"block":"none";});
}
async function editAssignmentDetails(assignmentId){
 if(schoolTeacherMode)try{await ensureSchoolSubjects()}catch(e){return notify('Could not load School Subjects: '+e.message)}
 const {data:a,error}=await sb.from("assignments").select("*").eq("id",assignmentId).eq("created_by",current.id).single();
 if(error||!a)return notify(error?.message||"Assignment not found.");
 const isVideo=String(a.assignment_type||"").toUpperCase()==="VIDEO" || !!a.video_url;
 render(`<div class="wrap">${header("Edit Assignment Details")}<div class="card">
   <h2>${esc(a.title||"")}</h2>
   <label>Assignment Title</label><input id="editAtTitle" value="${esc(a.title||"")}">
   <label>Subject</label>${schoolTeacherMode?`<select id="editAtSubject">${schoolSubjects.map(x=>`<option value="${esc(x.id)}" ${String(a.school_subject_id||"")===String(x.id)||String(x.name).toLowerCase()===String(a.subject||"").toLowerCase()?"selected":""}>${esc(x.name)}</option>`).join("")}</select>`:`<input id="editAtSubject" value="${esc(a.subject||"")}">`}
   <label>Assignment Type</label><select id="editAtType"><option value="MCQ" ${!isVideo?"selected":""}>MCQ — No Video</option><option value="VIDEO" ${isVideo?"selected":""}>Video + MCQ</option></select>
   <label>YouTube Video URL</label><input id="editAtVideo" value="${esc(a.video_url||"")}" placeholder="Leave blank for MCQ-only assignment">
   <label>Description</label><textarea id="editAtDescription">${esc(a.description||"")}</textarea>
   <div class="actions"><button onclick="saveAssignmentDetails('${assignmentId}')">💾 Save Changes</button><button class="secondary" onclick="schoolTeacherMode?schoolAssignmentManagement():teacherHome()">Cancel</button></div>
 </div></div>`);
}
async function saveAssignmentDetails(assignmentId){
 const title=document.getElementById("editAtTitle")?.value.trim(),subjectId=schoolTeacherMode?(document.getElementById("editAtSubject")?.value||""):null,subject=schoolTeacherMode?(schoolSubjects.find(x=>String(x.id)===String(subjectId))?.name||""):(document.getElementById("editAtSubject")?.value.trim()||""),type=document.getElementById("editAtType")?.value||"MCQ",video=document.getElementById("editAtVideo")?.value.trim()||"",description=document.getElementById("editAtDescription")?.value.trim()||"";
 if(!title)return notify("Assignment title cannot be empty.");if(schoolTeacherMode&&!subjectId)return notify("Select Subject.");
 if(type==="VIDEO"&&!video)return notify("Enter a YouTube video URL for a Video assignment, or choose MCQ.");
 const {error}=await sb.from("assignments").update({title,subject,school_subject_id:subjectId||null,description,video_url:video||null,assignment_type:type}).eq("id",assignmentId).eq("created_by",current.id);
 if(error)return notify("Could not update assignment: "+error.message);
 notify("Assignment details updated successfully.");
 return schoolTeacherMode?schoolAssignmentManagement():teacherHome();
}
async function editAssignmentGroup(assignmentId){
 const {data:a,error}=await sb.from("assignments").select("id,title,main_group,sub_group,class_id").eq("id",assignmentId).eq("created_by",current.id).single();
 if(error||!a)return notify(error?.message||"Assignment not found.");
 const {data:classes,error:ce}=await sb.from("classes").select("*").eq("teacher_id",current.id).order("name");
 if(ce)return notify(ce.message);
 if(schoolTeacherMode){
   const schoolClasses=(classes||[]).filter(c=>String(c.course||"").toUpperCase()==="SCHOOL");
   const {data:groups,error:ge}=await sb.from("school_course_groups").select("id,name,class_id").eq("teacher_id",current.id).order("name");
   if(ge)return notify(ge.message);
   const currentClass=schoolClasses.find(c=>c.id===a.class_id)||schoolClasses[0];
   if(!currentClass)return notify("No School classes are available.");
   const names=String(a.sub_group||"").split(/\s*,\s*/).filter(Boolean);
   render(`<div class="wrap">${header("Edit Assignment Class / Sub-divisions")}<div class="card"><h2>${esc(a.title)}</h2><label>Class / Main Group</label><select id="editSchoolAssignClass" onchange="renderSchoolAssignmentEditGroups()">${schoolClasses.map(c=>`<option value="${esc(c.id)}" ${c.id===currentClass.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select><div id="editSchoolAssignGroups" style="margin-top:12px"></div><div class="actions" style="margin-top:15px"><button onclick="saveSchoolAssignmentGroupEdit('${assignmentId}')">💾 Save Group & Recipients</button><button class="secondary" onclick="schoolAssignmentManagement()">Cancel</button></div></div></div>`);
   window._editSchoolAssignmentGroups=groups||[];window._editSchoolAssignmentInitialNames=names;window._editSchoolAssignmentInitialClass=currentClass.id;renderSchoolAssignmentEditGroups();
   return;
 }
 const mains=jnvstMainGroups(classes||[]);if(!mains.length)return notify("No JNVST main groups are available.");
 const currentClass=(classes||[]).find(c=>c.id===a.class_id);const currentMain=currentClass?(jnvstParentId(currentClass)?(classes||[]).find(c=>c.id===jnvstParentId(currentClass)):currentClass):null;
 const mainChoices=mains.map((m,i)=>`${i+1}. ${m.name}`).join("\n");
 const main=prompt(`Main Group for "${a.title}":\n\n${mainChoices}\n\nEnter the exact main group name.`,currentMain?.name||a.main_group||mains[0].name);if(main===null)return;
 const base=mains.find(c=>c.name===main.trim());if(!base)return notify("Please enter an existing main group.");
 const subs=jnvstSubgroupsForMain(classes,base);const choices=subs.length?subs.map((c,i)=>`${i+1}. ${c.name}`).join("\n"):"(No sub-groups created yet)";
 const sub=prompt(`Sub-Group under ${base.name}:\n\n${choices}\n\nLeave blank to use the entire main group.`,a.sub_group||"");if(sub===null)return;
 const subTrim=sub.trim(),subClass=subs.find(c=>c.name===subTrim);if(subTrim&&!subClass)return notify("Please enter an existing sub-group under the selected main group.");
 const targetClass=subClass||base;const {error:upError}=await sb.from("assignments").update({class_id:targetClass.id,main_group:base.name,sub_group:subTrim}).eq("id",assignmentId).eq("created_by",current.id);if(upError)return notify("Could not update assignment group.\n\n"+(upError.message||upError));
 notify("Assignment group updated successfully.");await teacherHome();
}
function renderSchoolAssignmentEditGroups(){
 const box=document.getElementById("editSchoolAssignGroups"),classId=document.getElementById("editSchoolAssignClass")?.value;if(!box)return;
 const groups=(window._editSchoolAssignmentGroups||[]).filter(g=>g.class_id===classId),names=classId===((window._editSchoolAssignmentInitialClass)||classId)?(window._editSchoolAssignmentInitialNames||[]):[];
 box.innerHTML=`<div class="card" style="background:#f8fafc"><label><input id="editSchoolAssignEntire" type="checkbox" onchange="toggleEditSchoolAssignEntire()" style="width:auto;margin-right:7px"> <b>Entire class</b></label>${groups.map(g=>`<label style="display:block;padding:6px 0"><input class="edit-school-assign-group" type="checkbox" value="${esc(g.id)}" data-name="${esc(g.name)}" ${names.includes(g.name)?"checked":""} onchange="document.getElementById('editSchoolAssignEntire').checked=false" style="width:auto;margin-right:7px">${esc(g.name)}</label>`).join("")}${!groups.length?'<div class="muted">No subdivisions under this class.</div>':''}</div>`;
}
function toggleEditSchoolAssignEntire(){if(document.getElementById("editSchoolAssignEntire")?.checked)document.querySelectorAll(".edit-school-assign-group").forEach(x=>x.checked=false)}
async function saveSchoolAssignmentGroupEdit(assignmentId){
 const classId=document.getElementById("editSchoolAssignClass")?.value;if(!classId)return notify("Select a class.");
 const entire=document.getElementById("editSchoolAssignEntire")?.checked||false;
 const selected=[...document.querySelectorAll(".edit-school-assign-group:checked")].map(x=>({id:x.value,name:x.dataset.name||""}));
 if(!entire&&!selected.length)return notify("Select Entire class or at least one subdivision.");
 const {data:members,error:me}=await sb.from("class_students").select("student_id").eq("class_id",classId);if(me)return notify(me.message);
 let ids=(members||[]).map(x=>x.student_id);
 if(!entire){const gids=new Set(selected.map(g=>g.id));const {data:profiles,error:pe}=await sb.from("profiles").select("id,school_group_id").in("id",ids);if(pe)return notify(pe.message);ids=(profiles||[]).filter(p=>gids.has(p.school_group_id)).map(p=>p.id)}
 const subNames=entire?[]:selected.map(g=>g.name);
 const {error:up}=await sb.from("assignments").update({class_id:classId,main_group:(document.getElementById("editSchoolAssignClass")?.selectedOptions?.[0]?.textContent||""),sub_group:subNames.join(", ")}).eq("id",assignmentId).eq("created_by",current.id);if(up)return notify("Could not update assignment group: "+up.message);
 const {error:del}=await sb.from("assignment_students").delete().eq("assignment_id",assignmentId);if(del)return notify("Group changed, but recipients could not be refreshed: "+del.message);
 if(ids.length){const {error:ins}=await sb.from("assignment_students").insert([...new Set(ids)].map(student_id=>({assignment_id:assignmentId,student_id})));if(ins)return notify("Group updated, but recipients could not be saved: "+ins.message)}
 notify(`Assignment group updated. ${ids.length} student${ids.length===1?"":"s"} are now assigned.`);await schoolAssignmentManagement();
}
async function teacherResultsDashboard(){
  try{
    const [{data:allAssignments,error:ae},{data:allClasses,error:ce},{data:allStudents,error:se}]=await Promise.all([
      sb.from("assignments").select("id,title,subject,class_id,video_url,created_at,main_group,sub_group").eq("created_by",current.id).order("created_at",{ascending:false}),
      sb.from("classes").select("id,name,course,description,jnvst_group_type,jnvst_parent_id").eq("teacher_id",current.id).order("name"),
      sb.from("profiles").select("id,full_name,roll_no,course").eq("role","student").order("full_name")
    ]);
    if(ae)throw ae;if(ce)throw ce;if(se)throw se;

    // Keep the Results page strictly separated by teacher portal.
    // School teachers see only assignments attached to SCHOOL classes and SCHOOL students;
    // JNVST teachers see only assignments attached to JNVST classes and JNVST students.
    const classes=(allClasses||[]).filter(c=>schoolTeacherMode
      ? String(c.course||"").trim().toUpperCase()==="SCHOOL"
      : String(c.course||"").trim().toUpperCase()!=="SCHOOL");
    const classIds=new Set(classes.map(c=>c.id));
    const assignments=(allAssignments||[]).filter(a=>classIds.has(a.class_id));
    const students=(allStudents||[]).filter(s=>schoolTeacherMode
      ? String(s.course||"").trim().toUpperCase()==="SCHOOL"
      : ["JNVST-6","JNVST-9"].includes(String(s.course||"").trim().toUpperCase()));
    const aids=assignments.map(a=>a.id);
    let attempts=[],links=[],memberships=[];
    if(aids.length){
      const [{data:at,error:te},{data:ls,error:le}]=await Promise.all([
        sb.from("attempts").select("id,assignment_id,student_id,score,total_questions,video_completed,submitted_at,attempt_number").in("assignment_id",aids).order("submitted_at",{ascending:false}),
        sb.from("assignment_students").select("assignment_id,student_id").in("assignment_id",aids)
      ]);
      if(te)throw te;if(le)throw le;attempts=at||[];links=ls||[];
      const recipientIds=[...new Set(links.map(x=>x.student_id))];
      if(recipientIds.length){
        const {data:ms,error:me}=await sb.from("class_students").select("student_id,class_id").in("student_id",recipientIds);
        if(me)throw me;memberships=ms||[];
      }
    }
    window._teacherResults={assignments,classes,students,attempts,links,memberships};
    renderTeacherResultsDashboard();
  }catch(e){notify("Could not load assignment results: "+(e.message||e));}
}
function resultAssignmentGroup(a, classMap){
  const c=classMap.get(a?.class_id);
  let main=String(a?.main_group||"").trim();
  let sub=String(a?.sub_group||"").trim();
  if(c){
    const parentId=c.jnvst_parent_id||"";
    const parent=parentId?classMap.get(parentId):null;
    if(!main) main=(parent?.name||c.name||"").trim();
    if(!sub && parentId) sub=String(c.name||"").trim();
  }
  return {main:main||"Unclassified",sub:sub||"Whole Main Group"};
}
function resultRecipientGroups(d, assignmentId, studentId){
  const classMap=new Map((d.classes||[]).map(c=>[c.id,c]));
  const memberships=(d.memberships||[]).filter(m=>m.student_id===studentId);
  const a=(d.assignments||[]).find(x=>x.id===assignmentId);
  const base=resultAssignmentGroup(a,classMap);
  const groups=[];
  memberships.forEach(m=>{
    const c=classMap.get(m.class_id); if(!c)return;
    const parent=c.jnvst_parent_id?classMap.get(c.jnvst_parent_id):null;
    const main=(parent?.name|| (jnvstBaseKey(c)?c.name:"" ) || base.main).trim();
    const sub=c.jnvst_parent_id?String(c.name||"").trim():base.sub;
    if(!groups.some(g=>g.main===main&&g.sub===sub))groups.push({main:main||base.main,sub:sub||base.sub,classId:c.id});
  });
  return groups.length?groups:[base];
}
function resultAssignmentGroups(d,a){
  const links=(d.links||[]).filter(x=>x.assignment_id===a.id);
  const groups=[]; const seen=new Set();
  links.forEach(l=>resultRecipientGroups(d,a.id,l.student_id).forEach(g=>{const k=g.main+"\0"+g.sub;if(!seen.has(k)){seen.add(k);groups.push(g)}}));
  if(!groups.length)groups.push(resultAssignmentGroup(a,new Map((d.classes||[]).map(c=>[c.id,c]))));
  return groups;
}
function teacherResultsMainNames(d){
  const names=new Set();
  (d.assignments||[]).forEach(a=>resultAssignmentGroups(d,a).forEach(g=>names.add(g.main)));
  return [...names].sort((a,b)=>{const rank=x=>x==="JNVST-VI (Class-IV)"?0:x==="JNVST-IX (Class IX)"?1:2;return rank(a)-rank(b)||String(a).localeCompare(String(b))});
}
function updateTeacherResultsSubGroupOptions(){
  const d=window._teacherResults;if(!d)return;
  const main=document.getElementById("trMainGroup")?.value||"all",sub=document.getElementById("trSubGroup");if(!sub)return;
  const available=[...new Set((d.assignments||[]).flatMap(a=>resultAssignmentGroups(d,a)).filter(g=>main==="all"||g.main===main).map(g=>g.sub).filter(Boolean))];
  const current=sub.value; sub.innerHTML=`<option value="all">All Sub-Groups</option>${available.sort((a,b)=>String(a).localeCompare(String(b))).map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join("")}`;
  sub.value=available.includes(current)?current:"all"; updateTeacherResultsAssignmentOptions();
}
function updateTeacherResultsAssignmentOptions(){
  const d=window._teacherResults;if(!d)return;
  const main=document.getElementById("trMainGroup")?.value||"all",sub=document.getElementById("trSubGroup")?.value||"all",sel=document.getElementById("trAssignment");if(!sel)return;
  const filtered=(d.assignments||[]).filter(a=>resultAssignmentGroups(d,a).some(g=>(main==="all"||g.main===main)&&(sub==="all"||g.sub===sub)));
  const current=sel.value;sel.innerHTML=`<option value="all">All Assignments</option>${filtered.map(a=>`<option value="${a.id}">${esc(a.title)}</option>`).join("")}`;sel.value=filtered.some(a=>a.id===current)?current:"all";
}
function updateTeacherResultsStudentOptions(){
  const d=window._teacherResults;if(!d)return; const sel=document.getElementById("trStudent");if(!sel)return;
  const main=document.getElementById("trMainGroup")?.value||"all",sub=document.getElementById("trSubGroup")?.value||"all";
  const ids=new Set();
  (d.links||[]).forEach(l=>{const gs=resultRecipientGroups(d,l.assignment_id,l.student_id);if(gs.some(g=>(main==="all"||g.main===main)&&(sub==="all"||g.sub===sub)))ids.add(l.student_id)});
  const current=sel.value; const list=(d.students||[]).filter(s=>ids.has(s.id));
  sel.innerHTML=`<option value="all">All Students</option>${list.map(s=>`<option value="${esc(s.id)}">${esc(s.full_name)}${s.roll_no?` — Roll ${esc(s.roll_no)}`:""}</option>`).join("")}`;sel.value=list.some(s=>s.id===current)?current:"all";
}
function teacherResultsMainGroupChanged(){updateTeacherResultsSubGroupOptions();updateTeacherResultsStudentOptions();}
function teacherResultsSubGroupChanged(){updateTeacherResultsAssignmentOptions();updateTeacherResultsStudentOptions();}
function renderTeacherResultsDashboard(){
  const d=window._teacherResults;if(!d)return;
  const f=d.filters||{assignment:"all",mainGroup:"all",subGroup:"all",classId:"all",student:"all",status:"all",minScore:"",maxScore:"",sort:"submitted_desc"};d.filters=f;
  const classMap=new Map((d.classes||[]).map(c=>[c.id,c])), studentMap=new Map((d.students||[]).map(s=>[s.id,s]));
  const assignmentMap=new Map((d.assignments||[]).map(a=>[a.id,a]));
  const submittedKey=new Set((d.attempts||[]).map(x=>`${x.assignment_id}:${x.student_id}`));
  let rows=(d.attempts||[]).map(at=>({type:"submitted",at,a:assignmentMap.get(at.assignment_id),p:studentMap.get(at.student_id)||{},className:classMap.get(assignmentMap.get(at.assignment_id)?.class_id)?.name||"",groups:resultRecipientGroups(d,at.assignment_id,at.student_id)}));
  if(f.status==="pending"){
    rows=(d.links||[]).filter(x=>!submittedKey.has(`${x.assignment_id}:${x.student_id}`))
      .map(x=>({type:"pending",at:null,a:assignmentMap.get(x.assignment_id),p:studentMap.get(x.student_id)||{},className:classMap.get(assignmentMap.get(x.assignment_id)?.class_id)?.name||"",groups:resultRecipientGroups(d,x.assignment_id,x.student_id)}));
  }
  rows=rows.filter(r=>{
    if(!r.a)return false;
    const groups=r.groups||resultRecipientGroups(d,r.a.id,r.p.id);
    return (f.assignment==="all"||r.a.id===f.assignment) &&
      (f.mainGroup==="all"||groups.some(g=>g.main===f.mainGroup)) &&
      (f.subGroup==="all"||groups.some(g=>g.sub===f.subGroup)) &&
      (f.classId==="all"||r.a.class_id===f.classId) &&
      (f.student==="all"||r.p.id===f.student);
  });
  if(f.minScore!=="")rows=rows.filter(r=>r.type==="pending"||Number(r.at.score)*100/Math.max(1,Number(r.at.total_questions))>=Number(f.minScore));
  if(f.maxScore!=="")rows=rows.filter(r=>r.type==="pending"||Number(r.at.score)*100/Math.max(1,Number(r.at.total_questions))<=Number(f.maxScore));
  rows.sort((x,y)=>{
    let a,b;
    if(f.sort==="student_asc"||f.sort==="student_desc"){a=(x.p.full_name||"").toLowerCase();b=(y.p.full_name||"").toLowerCase()}
    else if(f.sort==="assignment_asc"||f.sort==="assignment_desc"){a=(x.a.title||"").toLowerCase();b=(y.a.title||"").toLowerCase()}
    else if(f.sort==="score_asc"||f.sort==="score_desc"){a=x.type==="pending"?-1:Number(x.at.score)*100/Math.max(1,Number(x.at.total_questions));b=y.type==="pending"?-1:Number(y.at.score)*100/Math.max(1,Number(y.at.total_questions))}
    else {a=x.at?.submitted_at?new Date(x.at.submitted_at).getTime():0;b=y.at?.submitted_at?new Date(y.at.submitted_at).getTime():0}
    const dir=f.sort.endsWith("_asc")?1:-1;return a===b?0:a<b?-1*dir:1*dir;
  });

  // Build hierarchy from the ACTUAL recipient membership. An assignment may be
  // assigned to multiple sub-groups, so assignment.sub_group alone is not enough.
  const tree=new Map();
  for(const r of rows){
    const groups=r.groups||resultRecipientGroups(d,r.a.id,r.p.id);
    const matching=groups.filter(g=>(f.mainGroup==="all"||g.main===f.mainGroup)&&(f.subGroup==="all"||g.sub===f.subGroup));
    const g=matching[0]||groups[0]||resultAssignmentGroup(r.a,classMap);
    if(!tree.has(g.main))tree.set(g.main,new Map());
    const sm=tree.get(g.main);
    if(!sm.has(g.sub))sm.set(g.sub,new Map());
    const am=sm.get(g.sub);
    if(!am.has(r.a.id))am.set(r.a.id,{a:r.a,rows:[]});
    am.get(r.a.id).rows.push(r);
  }

  const escAttr=v=>esc(v);
  const assignmentBlock=(item)=>{
    const a=item.a, rr=item.rows;
    const submitted=rr.filter(x=>x.type==="submitted").length;
    const avg=submitted?Math.round(rr.filter(x=>x.type==="submitted").reduce((n,x)=>n+Number(x.at.score||0)*100/Math.max(1,Number(x.at.total_questions||1)),0)/submitted):0;
    return `<details open style="margin:8px 0 12px;border:1px solid #dbeafe;border-radius:12px;background:#fff">
      <summary style="cursor:pointer;padding:12px 14px;font-weight:700;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <span>📝 ${esc(a.title||"Untitled Assignment")}</span>
        <span class="tag">${submitted} submitted</span>
        ${submitted?`<span class="small muted">Average ${avg}%</span>`:""}
      </summary>
      <div style="overflow:auto;padding:0 10px 10px"><table>
        <thead><tr><th>Student</th><th>Roll No</th><th>Class</th><th>Score</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
        <tbody>${rr.length?rr.map(r=>r.type==="pending"
          ?`<tr><td><b>${esc(r.p.full_name||"Student")}</b></td><td>${esc(r.p.roll_no||"—")}</td><td>${esc(r.className||"—")}</td><td>—</td><td><span class="tag" style="background:#fff7ed;color:#c2410c">Not Submitted</span></td><td>—</td><td><button class="secondary" onclick="viewAssignment('${escAttr(r.a.id)}')">View Assignment</button></td></tr>`
          :`<tr><td><b>${esc(r.p.full_name||"Student")}</b></td><td>${esc(r.p.roll_no||"—")}</td><td>${esc(r.className||"—")}</td><td><b>${r.at.score}/${r.at.total_questions}</b> <span class="small">(${Math.round(Number(r.at.score||0)*100/Math.max(1,Number(r.at.total_questions||1)))}%)</span></td><td><span class="tag" style="background:#ecfdf5;color:#166534">Submitted</span></td><td>${r.at.submitted_at?new Date(r.at.submitted_at).toLocaleString():"—"}</td><td><button onclick="results('${escAttr(r.a.id)}')">View Result</button></td></tr>`
        ).join(""):`<tr><td colspan="7"><div class="success"><b>No results match the selected filters.</b></div></td></tr>`}</tbody>
      </table></div>
    </details>`;
  };

  const hierarchy=[...tree.entries()].map(([main,subs])=>{
    const subHtml=[...subs.entries()].map(([sub,ams])=>{
      const assignmentHtml=[...ams.values()].map(assignmentBlock).join("");
      const total=Array.from(ams.values()).reduce((n,x)=>n+x.rows.length,0);
      return `<details open style="margin:8px 12px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc">
        <summary style="cursor:pointer;padding:11px 13px;font-weight:700;color:#1e3a8a">▸ ${esc(sub)} <span class="small muted">(${total} result${total===1?"":"s"})</span></summary>
        <div style="padding:0 10px 4px">${assignmentHtml}</div>
      </details>`;
    }).join("");
    const total=[...subs.values()].reduce((n,ams)=>n+[...ams.values()].reduce((m,x)=>m+x.rows.length,0),0);
    return `<details open style="margin:0 0 14px;border:2px solid #dbeafe;border-radius:14px;background:#eff6ff">
      <summary style="cursor:pointer;padding:14px;font-size:17px;font-weight:800;color:#1d4ed8">📚 ${esc(main)} <span class="small muted">(${total} result${total===1?"":"s"})</span></summary>
      <div style="padding:0 10px 4px">${subHtml}</div>
    </details>`;
  }).join("");

  const submitted=d.attempts?.length||0;
  const avg=submitted?Math.round(d.attempts.reduce((n,x)=>n+Number(x.score||0)*100/Math.max(1,Number(x.total_questions||1)),0)/submitted):0;
  const pendingCount=(d.links||[]).filter(x=>!submittedKey.has(`${x.assignment_id}:${x.student_id}`)).length;
  const mainNames=teacherResultsMainNames(d);

  render(`<div class="wrap">${header("Assignment Results")}
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><h2 style="margin-bottom:4px">📊 Assignment Results</h2><p class="muted">Results are organised as <b>Main Group → Sub-Group → Assignment</b>. Student-wise status and scores remain available below each assignment.</p></div>
        <div class="actions"><button onclick="downloadFilteredTeacherResultsExcel()">⬇ Download Filtered Excel</button><button class="secondary" onclick="downloadAllResultsExcel()">⬇ Download All Results</button><button class="secondary" onclick="teacherHome()">← Dashboard</button></div>
      </div>
      <div class="grid" style="margin-top:15px">
        <div><label>Main Group</label><select id="trMainGroup" onchange="teacherResultsMainGroupChanged()"><option value="all">All Main Groups</option>${mainNames.map(g=>`<option value="${esc(g)}" ${f.mainGroup===g?"selected":""}>${esc(g)}</option>`).join("")}</select></div>
        <div><label>Sub-Group</label><select id="trSubGroup" onchange="teacherResultsSubGroupChanged()"><option value="all">All Sub-Groups</option></select></div>
        <div><label>Assignment</label><select id="trAssignment"><option value="all">All Assignments</option></select></div>
        <div><label>Class</label><select id="trClass"><option value="all">All Classes</option>${d.classes.map(c=>`<option value="${esc(c.id)}" ${f.classId===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div><label>Student</label><select id="trStudent"><option value="all">All Students</option>${d.students.map(s=>`<option value="${esc(s.id)}" ${f.student===s.id?"selected":""}>${esc(s.full_name)}${s.roll_no?` — Roll ${esc(s.roll_no)}`:""}</option>`).join("")}</select></div>
        <div><label>Status</label><select id="trStatus"><option value="all" ${f.status==="all"?"selected":""}>Submitted Results</option><option value="pending" ${f.status==="pending"?"selected":""}>Not Submitted / Pending</option></select></div>
        <div><label>Minimum Score %</label><input id="trMin" type="number" min="0" max="100" placeholder="0" value="${esc(f.minScore)}"></div>
        <div><label>Maximum Score %</label><input id="trMax" type="number" min="0" max="100" placeholder="100" value="${esc(f.maxScore)}"></div>
      </div>
      <div class="result-controls actions"><b>Sort:</b><select id="trSort"><option value="submitted_desc">Latest submission</option><option value="submitted_asc">Oldest submission</option><option value="student_asc">Student A–Z</option><option value="student_desc">Student Z–A</option><option value="assignment_asc">Assignment A–Z</option><option value="assignment_desc">Assignment Z–A</option><option value="score_desc">Highest score</option><option value="score_asc">Lowest score</option></select><button onclick="applyTeacherResultsFilters()">Apply Filters</button><button class="secondary" onclick="clearTeacherResultsFilters()">Clear Filters</button></div>
      <div class="result-summary"><span>Submitted: <b>${submitted}</b></span><span>Average: <b>${avg}%</b></span><span>Pending: <b>${pendingCount}</b></span><span>Showing: <b>${rows.length}</b></span></div>
      <div style="margin-top:15px">${hierarchy||`<div class="success"><b>No results match the selected filters.</b></div>`}</div>
    </div></div>`);

  const sort=document.getElementById("trSort");if(sort)sort.value=f.sort;
  updateTeacherResultsSubGroupOptions();
  const sub=document.getElementById("trSubGroup");if(sub&&f.subGroup&&sub.querySelector(`option[value="${CSS.escape(f.subGroup)}"]`))sub.value=f.subGroup;
  updateTeacherResultsAssignmentOptions();
  const as=document.getElementById("trAssignment");if(as&&f.assignment&&as.querySelector(`option[value="${CSS.escape(f.assignment)}"]`))as.value=f.assignment;
  updateTeacherResultsStudentOptions();
  const st=document.getElementById("trStudent");if(st&&f.student&&st.querySelector(`option[value="${CSS.escape(f.student)}"]`))st.value=f.student;
}
function applyTeacherResultsFilters(){const d=window._teacherResults;if(!d)return;d.filters={assignment:document.getElementById("trAssignment")?.value||"all",mainGroup:document.getElementById("trMainGroup")?.value||"all",subGroup:document.getElementById("trSubGroup")?.value||"all",classId:document.getElementById("trClass")?.value||"all",student:document.getElementById("trStudent")?.value||"all",status:document.getElementById("trStatus")?.value||"all",minScore:document.getElementById("trMin")?.value||"",maxScore:document.getElementById("trMax")?.value||"",sort:document.getElementById("trSort")?.value||"submitted_desc"};renderTeacherResultsDashboard()}
function clearTeacherResultsFilters(){if(!window._teacherResults)return;window._teacherResults.filters={assignment:"all",mainGroup:"all",subGroup:"all",classId:"all",student:"all",status:"all",minScore:"",maxScore:"",sort:"submitted_desc"};renderTeacherResultsDashboard()}
function getFilteredTeacherResultRows(){
  const d=window._teacherResults;if(!d)return [];
  const f=d.filters||{assignment:"all",mainGroup:"all",subGroup:"all",classId:"all",student:"all",status:"all",minScore:"",maxScore:"",sort:"submitted_desc"};
  const classMap=new Map(d.classes.map(c=>[c.id,c.name]));
  const studentMap=new Map(d.students.map(s=>[s.id,s]));
  const assignmentMap=new Map(d.assignments.map(a=>[a.id,a]));
  let rows=d.attempts.map(at=>({type:"submitted",at,a:assignmentMap.get(at.assignment_id),p:studentMap.get(at.student_id)||{},className:classMap.get(assignmentMap.get(at.assignment_id)?.class_id)||"",groups:resultRecipientGroups(d,at.assignment_id,at.student_id)}));
  if(f.status==="pending"){
    const submitted=new Set(d.attempts.map(x=>`${x.assignment_id}:${x.student_id}`));
    rows=d.links.filter(x=>!submitted.has(`${x.assignment_id}:${x.student_id}`)).map(x=>({type:"pending",at:null,a:assignmentMap.get(x.assignment_id),p:studentMap.get(x.student_id)||{},className:classMap.get(assignmentMap.get(x.assignment_id)?.class_id)||"",groups:resultRecipientGroups(d,x.assignment_id,x.student_id)}));
  }
  rows=rows.filter(r=>{
    if(!r.a)return false;
    const groups=r.groups||resultRecipientGroups(d,r.a.id,r.p.id);
    return (!f.assignment||f.assignment==="all"||r.a.id===f.assignment) &&
      (!f.mainGroup||f.mainGroup==="all"||groups.some(g=>g.main===f.mainGroup)) &&
      (!f.subGroup||f.subGroup==="all"||groups.some(g=>g.sub===f.subGroup)) &&
      (!f.classId||f.classId==="all"||r.a.class_id===f.classId) &&
      (!f.student||f.student==="all"||r.p.id===f.student);
  });
  if(f.minScore!=="")rows=rows.filter(r=>r.type==="pending"||Number(r.at.score)*100/Math.max(1,Number(r.at.total_questions))>=Number(f.minScore));
  if(f.maxScore!=="")rows=rows.filter(r=>r.type==="pending"||Number(r.at.score)*100/Math.max(1,Number(r.at.total_questions))<=Number(f.maxScore));
  rows.sort((x,y)=>{
    let a,b;
    if(f.sort==="student_asc"||f.sort==="student_desc"){a=(x.p.full_name||"").toLowerCase();b=(y.p.full_name||"").toLowerCase()}
    else if(f.sort==="assignment_asc"||f.sort==="assignment_desc"){a=(x.a.title||"").toLowerCase();b=(y.a.title||"").toLowerCase()}
    else if(f.sort==="score_asc"||f.sort==="score_desc"){a=x.type==="pending"?-1:Number(x.at.score)*100/Math.max(1,Number(x.at.total_questions));b=y.type==="pending"?-1:Number(y.at.score)*100/Math.max(1,Number(y.at.total_questions))}
    else {a=x.at?.submitted_at?new Date(x.at.submitted_at).getTime():0;b=y.at?.submitted_at?new Date(y.at.submitted_at).getTime():0}
    const dir=f.sort.endsWith("_asc")?1:-1;return a===b?0:a<b?-1*dir:1*dir;
  });
  return rows;
}
async function downloadFilteredTeacherResultsExcel(){
  try{
    const d=window._teacherResults;if(!d){notify("Please open Assignment Results first.");return;}
    const rows=getFilteredTeacherResultRows();
    if(!rows.length){notify("No results match the selected filters.");return;}

    const submittedRows=rows.filter(r=>r.type==="submitted");
    const attemptIds=submittedRows.map(r=>r.at.id).filter(Boolean);
    const assignmentIds=[...new Set(submittedRows.map(r=>r.a?.id).filter(Boolean))];
    let questions=[],answers=[];
    if(assignmentIds.length){
      const {data:q,error:qe}=await sb.from("questions").select("id,assignment_id,question_order,correct_option").in("assignment_id",assignmentIds).order("question_order");
      if(qe)throw qe;questions=q||[];
    }
    if(attemptIds.length){
      const {data:a,error:ae}=await sb.from("answers").select("attempt_id,question_id,selected_option").in("attempt_id",attemptIds);
      if(ae)throw ae;answers=a||[];
    }
    const am=new Map(answers.map(x=>[`${x.attempt_id}:${x.question_id}`,x]));
    const qByAssignment=new Map();
    questions.forEach(q=>{if(!qByAssignment.has(q.assignment_id))qByAssignment.set(q.assignment_id,[]);qByAssignment.get(q.assignment_id).push(q)});

    const exportRows=rows.map(r=>{
      const p=r.p||{},a=r.a||{};
      const at=r.at;
      const pct=at?Number(at.score||0)*100/Math.max(1,Number(at.total_questions||1)):null;
      const row={
        "Student Name":p.full_name||"",
        "Roll No":p.roll_no||"",
        "Course":schoolTeacherMode?"School Course":(String(p.course||"").toUpperCase()==="JNVST-9"?"JNVST Class IX":"JNVST Class VI"),
        "Class":r.className||"",
        "Assignment Name":a.title||"",
        "Main Group":(r.groups?.[0]||resultAssignmentGroup(a,new Map((window._teacherResults.classes||[]).map(c=>[c.id,c])))).main,
        "Sub-Group":(r.groups?.[0]||resultAssignmentGroup(a,new Map((window._teacherResults.classes||[]).map(c=>[c.id,c])))).sub,
        "Status":r.type==="pending"?"Not Submitted":"Submitted",
        "Score":at?at.score:"",
        "Total Questions":at?at.total_questions:"",
        "Percentage":pct===null?"":Math.round(pct*100)/100,
        "Submitted":at?.submitted_at?new Date(at.submitted_at).toLocaleString():"",
        "Attempt No":at?.attempt_number||""
      };
      (qByAssignment.get(a.id)||[]).forEach((q,i)=>{
        const n=q.question_order||i+1;
        const ans=at?am.get(`${at.id}:${q.id}`):null;
        row[`Q${n} Option`]=ans?.selected_option||"";
        row[`Q${n} Answer Key`]=q.correct_option||"";
      });
      row["Total Marks"]=at?at.score:"";
      return row;
    });

    const ws=XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"]=Object.keys(exportRows[0]).map(k=>({wch:Math.max(12,Math.min(28,k.length+3))}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Filtered Results");
    const courseName=schoolTeacherMode?"School_Course":"JNVST";
    const stamp=new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb,`SwarupSir_${courseName}_Filtered_Assessment_Results_${stamp}.xlsx`);
  }catch(e){notify("Could not download filtered results: "+(e.message||e));}
}
async function deleteAssignment(assignmentId){
 const {data:a,error}=await sb.from("assignments").select("id,title").eq("id",assignmentId).eq("created_by",current.id).single();
 if(error||!a)return notify(error?.message||"Assignment not found.");
 if(!confirm(`Delete "${a.title}"?\\n\\nThis will permanently remove the assignment, questions, student assignments, attempts and submitted answers.`))return;
 try{
   const {data:ats,error:ae}=await sb.from("attempts").select("id").eq("assignment_id",assignmentId);if(ae)throw ae;
   const attemptIds=(ats||[]).map(x=>x.id);
   if(attemptIds.length){
     const {error:e}=await sb.from("answers").delete().in("attempt_id",attemptIds);if(e)throw e;
     const {error:e2}=await sb.from("attempts").delete().eq("assignment_id",assignmentId);if(e2)throw e2;
   }
   const {error:e3}=await sb.from("assignment_students").delete().eq("assignment_id",assignmentId);if(e3)throw e3;
   const {error:e4}=await sb.from("questions").delete().eq("assignment_id",assignmentId);if(e4)throw e4;
   const {error:e5}=await sb.from("assignments").delete().eq("id",assignmentId).eq("created_by",current.id);if(e5)throw e5;
   notify("Assignment deleted successfully.");teacherHome();
 }catch(e){notify("Could not delete assignment.\\n\\n"+(e.message||e)+"\\n\\nIf this is an RLS policy error, run teacher_management.sql in Supabase.")}
}
async function reassignFresh(assignmentId){
 const {data:a,error}=await sb.from("assignments").select("id,title").eq("id",assignmentId).eq("created_by",current.id).single();
 if(error||!a)return notify(error?.message||"Assignment not found.");
 if(!confirm(`Fresh assign "${a.title}"?\n\nAll existing student links, previous attempts and submitted answers for this assignment will be removed. The assignment and its questions will remain.`))return;
 try{
   const {data:ats,error:ae}=await sb.from("attempts").select("id").eq("assignment_id",assignmentId);if(ae)throw ae;
   const ids=(ats||[]).map(x=>x.id);
   if(ids.length){const {error:e}=await sb.from("answers").delete().in("attempt_id",ids);if(e)throw e;}
   const {error:e2}=await sb.from("attempts").delete().eq("assignment_id",assignmentId);if(e2)throw e2;
   const {error:e3}=await sb.from("assignment_students").delete().eq("assignment_id",assignmentId);if(e3)throw e3;
   return reassignAssignment(assignmentId,{fresh:true});
 }catch(e){notify("Could not prepare fresh assignment.\n\n"+(e.message||e));}
}
async function reassignAssignment(assignmentId,options={}){
 const fresh=!!options.fresh;
 const [{data:a,error:ae},{data:classes,error:ce}]=await Promise.all([
   sb.from("assignments").select("*").eq("id",assignmentId).eq("created_by",current.id).single(),
   sb.from("classes").select("id,name,course").eq("teacher_id",current.id).order("name")
 ]);
 if(ae)return notify(ae.message);if(ce)return notify(ce.message);

 const allowed=(classes||[]).filter(c=>schoolTeacherMode
   ?String(c.course||"").toUpperCase()==="SCHOOL"
   :String(c.course||"").toUpperCase()!=="SCHOOL");
 if(!allowed.length)return notify("No classes are available.");

 const {data:groups,error:ge}=schoolTeacherMode
   ?await sb.from("school_course_groups").select("id,name,class_id").eq("teacher_id",current.id).order("name")
   :({data:[],error:null});
 if(ge)return notify(ge.message);

 const initialClass=a.class_id&&allowed.some(c=>c.id===a.class_id)?a.class_id:allowed[0].id;
 const currentGroup=(groups||[]).find(g=>g.class_id===initialClass && g.name===a.sub_group);

 render(`<div class="wrap">${header(fresh?"Fresh Assign Assignment":"Re-assign Assignment")}<div class="card">
   <h2>${esc(a.title)}</h2>
   <div class="${fresh?'notice':'success'}">
     ${fresh
       ?"Fresh mode: previous recipient links and attempts have already been cleared. Choose the new recipients."
       :"Re-assign mode: students who have already submitted can be given one new attempt. Existing submitted attempts are kept in the result history. Students who have not submitted are not duplicated."}
   </div>
   <label>Class</label>
   <select id="rac" onchange="loadReassignStudents('${assignmentId}')">
     ${allowed.map(c=>`<option value="${esc(c.id)}" ${c.id===initialClass?'selected':''}>${esc(c.name)}</option>`).join("")}
   </select>
   ${schoolTeacherMode?`<label>Subdivision</label><select id="rasg" onchange="loadReassignStudents('${assignmentId}')"><option value="">Entire class</option>${(groups||[]).filter(g=>g.class_id===initialClass).map(g=>`<option value="${esc(g.id)}" ${currentGroup?.id===g.id?'selected':''}>${esc(g.name)}</option>`).join("")}</select>`:""}
   <div class="card" style="background:#f8fafc">
     <h3>Assign / Re-assign To</h3>
     <label><input type="radio" name="reassignMode" value="class" checked onchange="loadReassignStudents('${assignmentId}')" style="width:auto;margin-right:8px">Entire selected ${schoolTeacherMode?"class/subdivision":"group"}</label>
     <label><input type="radio" name="reassignMode" value="students" onchange="loadReassignStudents('${assignmentId}')" style="width:auto;margin-right:8px">Selected students</label>
     <div id="reassignStudentPicker" class="small muted">Loading students...</div>
   </div>
   <div class="actions">
     <button onclick="saveReassignment('${assignmentId}',${fresh})">💾 ${fresh?"Save Fresh Assignment":"Re-assign Selected Students"}</button>
     <button class="secondary" onclick="schoolTeacherMode?schoolAssignmentManagement():teacherHome()">Cancel</button>
   </div>
 </div></div>`);
 window._reassignFresh=fresh;
 await loadReassignStudents(assignmentId);
}
async function loadReassignStudents(assignmentId){
 const box=document.getElementById("reassignStudentPicker");if(!box)return;
 const classId=document.getElementById("rac")?.value,groupId=document.getElementById("rasg")?.value||"";
 if(!classId){box.innerHTML='<div class="notice">Select a class.</div>';return;}

 const {data:members,error}=await sb.from("class_students").select("student_id,class_id").eq("class_id",classId);
 if(error){box.innerHTML=message(error.message);return;}
 let ids=(members||[]).map(x=>x.student_id);

 if(groupId){
   const {data:grpStudents,error:ge}=await sb.from("profiles").select("id").eq("school_group_id",groupId).in("id",ids);
   if(ge){box.innerHTML=message(ge.message);return;}
   ids=(grpStudents||[]).map(x=>x.id);
 }
 if(!ids.length){box.innerHTML='<div class="notice">No students are in the selected class/subdivision.</div>';return;}

 const {data:students,error:e}=await sb.from("profiles").select("id,full_name,username,roll_no").in("id",ids).order("full_name");
 if(e){box.innerHTML=message(e.message);return;}

 if(window._reassignFresh){
   const mode=document.querySelector('input[name="reassignMode"]:checked')?.value||"class";
   box.innerHTML=`<div class="small muted" style="margin-bottom:8px">${students.length} student(s) available for the fresh assignment.</div>`+
     (mode==="class"
       ?'<div class="success">The selected class/subdivision will be assigned as a whole.</div>'
       :`<div class="actions" style="margin-bottom:8px"><button type="button" class="secondary" onclick="document.querySelectorAll('.reassign-student').forEach(x=>x.checked=true)">Select all</button><button type="button" class="secondary" onclick="document.querySelectorAll('.reassign-student').forEach(x=>x.checked=false)">Clear all</button></div>`+
         (students.length?students.map(s=>`<label style="display:block;padding:6px 0"><input class="reassign-student" type="checkbox" value="${esc(s.id)}" style="width:auto;margin-right:8px"><b>${esc(s.full_name)}</b> <span class="muted small">${esc(s.roll_no||s.username||"")}</span></label>`).join(""):'<div class="notice">No students are available.</div>'));
   return;
 }

 const [{data:links,error:le},{data:ats,error:ae}]=await Promise.all([
   sb.from("assignment_students").select("student_id,current_attempt_number").eq("assignment_id",assignmentId).in("student_id",ids),
   sb.from("attempts").select("student_id,attempt_number,submitted_at").eq("assignment_id",assignmentId).in("student_id",ids).order("submitted_at",{ascending:false})
 ]);
 if(le){box.innerHTML=message(le.message);return;}
 if(ae){box.innerHTML=message(ae.message);return;}

 const linkMap=new Map((links||[]).map(x=>[x.student_id,x]));
 const attemptMap=new Map();
 for(const at of (ats||[])){
   const key=at.student_id;
   const currentNo=Number(linkMap.get(key)?.current_attempt_number||1);
   if(Number(at.attempt_number||1)===currentNo && !attemptMap.has(key))attemptMap.set(key,at);
 }

 const mode=document.querySelector('input[name="reassignMode"]:checked')?.value||"class";
 const statusFor=(s)=>{
   const link=linkMap.get(s.id);
   if(!link)return {label:"New student — will be assigned",cls:"success"};
   const n=Number(link.current_attempt_number||1);
   if(attemptMap.has(s.id))return {label:`Submitted — Attempt ${n} → another attempt will be allowed`,cls:"notice"};
   return {label:`Assigned — not submitted yet; no duplicate will be created`,cls:"small muted"};
 };

 const eligibleForSelection=students;
 box.innerHTML=`<div class="small muted" style="margin-bottom:8px">
   ${students.length} student(s) in the selected class/subdivision.
   Re-assignment increments the attempt number only for students whose current attempt is already submitted.
 </div>`+
   (mode==="class"
     ?'<div class="success">The selected class/subdivision will be processed as a whole. Submitted students will receive a new attempt; pending students will remain pending.</div>'
     :`<div class="actions" style="margin-bottom:8px"><button type="button" class="secondary" onclick="document.querySelectorAll('.reassign-student').forEach(x=>x.checked=true)">Select all</button><button type="button" class="secondary" onclick="document.querySelectorAll('.reassign-student').forEach(x=>x.checked=false)">Clear all</button></div>`+
       (eligibleForSelection.length?eligibleForSelection.map(s=>{const st=statusFor(s);return `<label style="display:block;padding:8px 0;border-bottom:1px solid #e5e7eb"><input class="reassign-student" type="checkbox" value="${esc(s.id)}" style="width:auto;margin-right:8px"><b>${esc(s.full_name)}</b> <span class="muted small">${esc(s.roll_no||s.username||"")}</span><div class="${st.cls}" style="margin:3px 0 0 24px">${st.label}</div></label>`}).join(""):'<div class="notice">No students are available.</div>'));
}
async function saveReassignment(assignmentId,fresh=false){
 const classId=document.getElementById("rac")?.value;if(!classId)return notify("Select a class.");
 const groupId=document.getElementById("rasg")?.value||"";
 let candidateIds=[];

 const mode=document.querySelector('input[name="reassignMode"]:checked')?.value||"class";
 const {data:members,error:me}=await sb.from("class_students").select("student_id").eq("class_id",classId);
 if(me)return notify(me.message);
 candidateIds=(members||[]).map(x=>x.student_id);

 if(groupId){
   const {data:grp,error:ge}=await sb.from("profiles").select("id").eq("school_group_id",groupId).in("id",candidateIds);
   if(ge)return notify(ge.message);
   candidateIds=(grp||[]).map(x=>x.id);
 }

 if(mode==="students")candidateIds=[...document.querySelectorAll(".reassign-student:checked")].map(x=>x.value);
 candidateIds=[...new Set(candidateIds)];
 if(!candidateIds.length)return notify("No students selected or available.");

 if(fresh){
   const {data:existing,error:ee}=await sb.from("assignment_students").select("student_id").eq("assignment_id",assignmentId).in("student_id",candidateIds);
   if(ee)return notify(ee.message);
   const already=new Set((existing||[]).map(x=>x.student_id));
   const ids=[...candidateIds].filter(id=>!already.has(id));
   const rows=ids.map(student_id=>({assignment_id:assignmentId,student_id,current_attempt_number:1}));
   if(rows.length){
     const {error:ie}=await sb.from("assignment_students").insert(rows);
     if(ie)return notify("Could not assign students: "+ie.message);
   }
   notify(`Fresh assignment saved for ${candidateIds.length} student${candidateIds.length===1?"":"s"}.`);
   return schoolTeacherMode?schoolAssignmentManagement():teacherHome();
 }

 try{
   const {data,result,error}=await sb.rpc("reassign_assignment_students",{
     p_assignment_id:assignmentId,
     p_student_ids:candidateIds
   });
   if(error)throw error;
   const r=result||data||{};
   notify(`Re-assignment completed. New students: ${Number(r.new_students||0)}. New attempts allowed: ${Number(r.reassigned_students||0)}. Pending students unchanged: ${Number(r.pending_students||0)}.`);
   return schoolTeacherMode?schoolAssignmentManagement():teacherHome();
 }catch(e){
   notify("Could not re-assign students.\n\n"+(e.message||e));
 }
}
async function newAssignment(){
 let {data:allClasses,error:classError}=await sb.from("classes").select("id,name,description,course").eq("teacher_id",current.id).order("name");
 if(classError)return notify(classError.message);
 if(!schoolTeacherMode){
   try{
     allClasses=await ensureJnvstBaseClasses(allClasses||[]);
     const migration=await migrateLegacyNavodayaGroups(allClasses);
     allClasses=migration.classes;
   }catch(e){return notify("Could not prepare JNVST classes: "+(e.message||e))}
 }
 const classes=(allClasses||[]).filter(c=>schoolTeacherMode
   ?String(c.course||"").trim().toUpperCase()==="SCHOOL"
   :String(c.course||"").trim().toUpperCase()!=="SCHOOL");
 if(schoolTeacherMode){try{await ensureSchoolSubjects()}catch(se){return notify('Could not load School Subjects: '+se.message)}}
 if(!classes.length){notify(schoolTeacherMode?"Create a School Course class first.":"JNVST classes are not available.");return schoolTeacherMode?newClass():teacherHome()}

 const jnvstBases=jnvstMainGroups(classes);
 const firstBase=jnvstBases.find(c=>jnvstBaseKey(c)==="JNVST-VI")||jnvstBases[0];
 const firstBaseId=firstBase?.id||"";
 const jnvstGroupHtml=`<div class="card" style="background:#f8fafc;border:1px solid #dbeafe">
   <h3 style="margin-top:0">Assignment Group</h3>
   <div class="grid">
    <div><label>Main Group</label><select id="aMainGroup" onchange="refreshJnvstAssignmentGroups()">${jnvstBases.map(c=>`<option value="${esc(c.id)}" ${c.id===firstBaseId?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
    <div><label>Sub-Group</label><select id="aSubGroup"><option value="">All / Multiple Sub-groups</option></select></div>
   </div>
   <div class="small muted">Choose a main group, then assign to the entire main group, one or more sub-groups, or selected individual students.</div>
 </div>`;
 const schoolGroupHtml=`<div class="card" style="background:#f8fafc;border:1px solid #dbeafe"><h3 style="margin-top:0">Assignment Group</h3><div class="grid"><div><label>Class / Main Group</label><select id="aMainGroup" onchange="refreshSchoolAssignmentSubgroups()">${classes.map((c,i)=>`<option value="${c.id}" ${i===0?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div><div><label>Sub-divisions / Sub-groups</label><div id="aSubGroups" class="small" style="border:1px solid #cbd5e1;border-radius:10px;padding:8px;background:#fff;max-height:180px;overflow:auto"><span class="muted">Loading subdivisions...</span></div></div></div><div class="small muted" style="margin-top:8px">Select the whole class, one subdivision, or <b>multiple subdivisions</b> under the selected class. You can also select individual students below.</div></div>`;
 const assignmentGroupHtml=schoolTeacherMode?schoolGroupHtml:jnvstGroupHtml;

 render(`<div class="wrap">${header(schoolTeacherMode?"New School Course Assignment":"New JNVST Assignment")}<div class="card">
 <label>Assignment Type</label><div class="card" style="background:#f8fafc"><label><input type="radio" name="assignmentType" value="video" checked onchange="toggleAssignmentVideoFields()" style="width:auto;margin-right:8px">With Video — students watch the lesson first</label><label><input type="radio" name="assignmentType" value="no-video" onchange="toggleAssignmentVideoFields()" style="width:auto;margin-right:8px">Without Video — students go directly to questions</label></div>
${schoolTeacherMode?`<div class="card" style="border:2px solid #7c3aed;background:#faf5ff;margin-top:12px"><h3 style="margin:0 0 6px">🎯 Assignment Personalization</h3><label><input type="radio" name="schoolAssignmentMode" value="standard" checked onchange="toggleAdaptiveAssignmentFields()" style="width:auto;margin-right:8px">Standard Assignment — keep the existing question-selection workflow</label><label><input type="radio" name="schoolAssignmentMode" value="adaptive" onchange="toggleAdaptiveAssignmentFields()" style="width:auto;margin-right:8px">Adaptive Assignment — customize questions for each student from previous performance</label><div id="adaptiveAssignmentFields" style="display:none;margin-top:10px"><div class="grid"><div><label>Maximum Adaptive / Weakness Questions</label><input id="adaptiveMaxPercent" type="number" min="0" max="60" value="60"><div class="small muted">Maximum allowed is 60%. The system may use fewer when the student has fewer meaningful weaknesses.</div></div><div><label>Adaptive source</label><div class="success" style="margin-top:5px">Uses the selected School Question Bank chapter/range below. Previous wrong questions are preferred, with Variation Group alternatives when available.</div></div></div><div class="notice" style="margin-top:8px"><b>Important:</b> Adaptive mode creates a separate question snapshot for each student. Your existing Standard Assignment workflow is unchanged.</div></div></div>`:jnvstAdaptiveCardHtml()}
 ${assignmentGroupHtml}
 <div class="card" style="background:#f8fafc;border:1px solid #dbeafe"><h3>Assign To</h3><p class="small muted">${schoolTeacherMode?"Select the School Course class, then choose the entire class or one/multiple subdivisions.":"Select students/classes under the selected JNVST main group. The fixed main group and its teacher-created sub-groups are shown below."}</p>
  <div class="actions" style="margin-bottom:10px"><button type="button" class="secondary" onclick="document.querySelectorAll('.newassign-class').forEach(x=>x.checked=true);loadNewAssignmentClassStudents()">Select all shown</button><button type="button" class="secondary" onclick="document.querySelectorAll('.newassign-class').forEach(x=>x.checked=false);loadNewAssignmentClassStudents()">Clear all</button></div>
  <div id="newAssignmentClassList" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px"></div>
  <div id="newAssignmentStudentPicker" class="small muted" style="margin-top:12px">Select one or more classes above.</div>
 </div>
 <label>Title</label><input id="at"><label>Subject</label>${schoolTeacherMode?`<select id="asub">${schoolSubjectSelectHtml()}</select>`:`<select id="asub"><option value="">Select JNVST Subject</option>${jnvstSubjects.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("")}</select>`}<div id="assignmentVideoField"><label>YouTube video URL</label><input id="av" placeholder="https://www.youtube.com/watch?v=..."><div class="small muted">Students must watch this video before answering the questions.</div></div><label>Description</label><textarea id="adesc"></textarea>
 <div class="card" style="background:#f8fafc;border:1px solid #dbeafe;margin-top:15px"><h3 style="margin-top:0">Questions</h3>
<p class="small muted">Choose how you want to add questions. You can combine questions from the Mock Test Question Bank with uploaded or manually entered questions.</p>
<div class="grid" style="margin-top:10px">
  <div class="card" style="margin:0;border:2px solid #2563eb;background:#eff6ff">
    <h4 style="margin:0 0 6px">📚 Mock Test Question Bank</h4>
    <p class="small muted" style="min-height:38px">Reuse questions already stored in your central Mock Test Question Bank.</p>
    ${schoolTeacherMode?`<button type="button" class="secondary" onclick="openSchoolAssignmentQbBuilder()" style="width:100%">🧩 Build Assignment from School Question Bank</button>`:`<button type="button" onclick="openAssignmentQuestionBank()" style="width:100%">📚 Select From JNVST Mock Test Question Bank</button><button type="button" class="secondary" onclick="openJnvstAssignmentQbBuilder()" style="width:100%;margin-top:7px">🧩 Build Assignment from JNVST Lesson</button>`}
  </div>
  <div class="card" style="margin:0;border:2px solid #f59e0b;background:#fffaf0">
    <h4 style="margin:0 0 6px">🎯 Student Mistakes</h4>
    <p class="small muted" style="min-height:38px">Select questions previously answered wrongly by the assigned students.</p>
    <button type="button" onclick="openAssignmentMistakeBank()" style="width:100%">🎯 Select Student Mistakes</button>
  </div>
</div>
<div class="actions" style="margin-top:10px">
  <button type="button" onclick="startBulkImportFromNewAssignment()">↑ Upload Question File (PDF / Excel)</button>
  <button type="button" class="secondary" onclick="addQ()">+ Add MCQ manually</button>
</div>
<div id="assignmentBankPicker" style="display:none;margin-top:12px"></div><div id="assignmentSchoolQbBuilder" style="display:none;margin-top:12px"></div>
<div id="assignmentSelectedBankSummary" class="small muted" style="margin-top:8px">No question-bank questions selected.</div>
<div class="small muted" style="margin-top:8px">Question-bank selections are copied into this assignment as a snapshot, so later edits to the bank do not change an existing assignment.</div>
</div><h3>Manual / Uploaded Questions</h3><div id="qs"></div><div class="actions" style="margin-top:15px"><button onclick="saveAssignment()">Save & Assign</button><button class="secondary" onclick="schoolTeacherMode?location.href='teacher-dashboard.html':teacherHome()">Cancel</button></div></div></div>`);
 window._newAssignmentClasses=classes;
 if(newAssignmentDraft){
   restoreAssignmentBankSelection(newAssignmentDraft.selectedBankQuestionIds||[]);
   if(newAssignmentDraft.schoolQbSelection){assignmentSchoolQbSelected={...newAssignmentDraft.schoolQbSelection};const savedSub=newAssignmentDraft.schoolQbSelection.subject||'';const savedObj=(jnvstSubjects||[]).find(x=>x.id===savedSub)|| (jnvstSubjects||[]).find(x=>String(x.name||'').trim().toLowerCase()===String(savedSub).trim().toLowerCase());assignmentSchoolQbSubject=savedObj?.id||'';assignmentSchoolQbSubjectName=savedObj?.name||newAssignmentDraft.schoolQbSelection.subject_name||savedSub;assignmentSchoolQbMedium=newAssignmentDraft.schoolQbSelection.medium||'';}
   const d=newAssignmentDraft;
   const typeRadio=document.querySelector(`input[name="assignmentType"][value="${d.type}"]`);if(typeRadio){typeRadio.checked=true;toggleAssignmentVideoFields()}
   document.getElementById("at").value=d.title||"";if(document.getElementById("asub")){const so=schoolSubjects.find(x=>String(x.id)===String(d.subject_id||d.subject)||String(x.name).toLowerCase()===String(d.subject||"").toLowerCase());document.getElementById("asub").value=so?.id||"";}document.getElementById("av").value=d.video||"";document.getElementById("adesc").value=d.description||"";if(schoolTeacherMode&&d.schoolAssignmentMode){const ar=document.querySelector(`input[name="schoolAssignmentMode"][value="${d.schoolAssignmentMode}"]`);if(ar){ar.checked=true;toggleAdaptiveAssignmentFields();}}if(document.getElementById("adaptiveMaxPercent"))document.getElementById("adaptiveMaxPercent").value=d.adaptiveMaxPercent||"60";
   if(!schoolTeacherMode){
     const main=d.mainGroup||firstBaseId;if([...document.querySelectorAll("#aMainGroup option")].some(o=>o.value===main))document.getElementById("aMainGroup").value=main;
     await refreshJnvstAssignmentGroups(d.subGroup||"");
   }else{
     document.getElementById("aMainGroup").value=d.mainGroup||document.getElementById("aMainGroup").value;
     await refreshSchoolAssignmentSubgroups(d.subGroup||"");
   }
   document.getElementById("qs").innerHTML="";const notice=document.createElement("div");notice.className="success";notice.innerHTML=`<b>${importedQuestions.length} question(s) imported.</b> They will be added when you click <b>Save & Assign</b>.`;document.getElementById("qs").appendChild(notice);
   await loadNewAssignmentClassStudents();
   if(d.selectedStudentsByClass){Object.entries(d.selectedStudentsByClass).forEach(([cid,ids])=>ids.forEach(id=>{const cb=document.querySelector(`.newassign-student[data-class-id="${cid}"][value="${id}"]`);if(cb)cb.checked=true}))}
   else if(d.assignMode==="students"){(d.selectedStudents||[]).forEach(id=>{const cb=document.querySelector(`.newassign-student[value="${id}"]`);if(cb)cb.checked=true})}
 }else{
   assignmentBankSelected.clear();assignmentBankCache=[];assignmentBankFilters={part:'',topic:'',language:'',search:''};assignmentSchoolQbMode=schoolTeacherMode?'SCHOOL':'JNVST';assignmentSchoolQbSelected=null;assignmentSchoolQbSubject='';assignmentSchoolQbMedium='';assignmentSchoolQbQuestions=[];assignmentSchoolQbChapters=[];assignmentSchoolQbFixedQuestions.clear();assignmentSchoolQbFixedGroups.clear();assignmentMistakeSelected.clear();assignmentMistakeCache=[];assignmentMistakeFilters={minWrong:1,part:'',topic:'',search:''};
   addQ();addQ();
   await (schoolTeacherMode?refreshSchoolAssignmentSubgroups():refreshJnvstAssignmentGroups());
   if(!schoolTeacherMode)document.querySelector('.newassign-class')?.click();
 }
}
async function refreshJnvstAssignmentGroups(preferredSub){
 const main=document.getElementById("aMainGroup"),list=document.getElementById("newAssignmentClassList"),sub=document.getElementById("aSubGroup");if(!main||!list)return;
 const classes=window._newAssignmentClasses||[];const base=classes.find(c=>c.id===main.value)||classes.find(c=>jnvstBaseKey(c)===String(main.value).toUpperCase());
 const subs=jnvstSubgroupsForMain(classes,base).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
 if(sub){sub.innerHTML=`<option value="">All / Multiple Sub-groups</option>${subs.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}`;if(preferredSub&&[...sub.options].some(o=>o.value===preferredSub))sub.value=preferredSub}
 const cards=[];
 if(base)cards.push(`<label style="display:block;padding:10px;border:1px solid #bfdbfe;border-radius:10px;background:#fff"><input class="newassign-class" type="checkbox" value="${esc(base.id)}" onchange="loadNewAssignmentClassStudents()" style="width:auto;margin-right:8px"><b>Entire ${esc(base.name)}</b><div class="small muted" style="margin-left:25px">Main group</div></label>`);
 subs.forEach(c=>cards.push(`<label style="display:block;padding:10px;border:1px solid #dbe3ee;border-radius:10px;background:#fff"><input class="newassign-class" type="checkbox" value="${esc(c.id)}" onchange="loadNewAssignmentClassStudents()" style="width:auto;margin-right:8px"><b>${esc(c.name)}</b><div class="small muted" style="margin-left:25px">Sub-group under ${esc(base?.name||"")}</div></label>`));
 list.innerHTML=cards.join("")||'<div class="notice">No sub-groups have been created under this main group yet. You can still assign the main group.</div>';
}
async function refreshSchoolAssignmentSubgroups(preferredSub=""){
 const main=document.getElementById("aMainGroup"),subBox=document.getElementById("aSubGroups"),list=document.getElementById("newAssignmentClassList");
 if(!main)return;
 const classId=main.value;
 let groups=(window._schoolAssignmentGroups||[]).filter(g=>g.class_id===classId);
 if(!groups.length){
   const {data,error}=await sb.from("school_course_groups").select("id,name,class_id,description").eq("teacher_id",current.id).eq("class_id",classId).order("name");
   if(error){if(subBox)subBox.innerHTML='<span class="muted">Could not load subdivisions.</span>';return;}
   groups=data||[];
   window._schoolAssignmentGroups=[...(window._schoolAssignmentGroups||[]).filter(g=>g.class_id!==classId),...groups];
 }
 const preferred=preferredSub?String(preferredSub).split(/\s*,\s*/).filter(Boolean):[];
 if(subBox){
   subBox.innerHTML=`<label style="display:block;padding:6px 4px;border-bottom:1px solid #e2e8f0"><input id="aEntireClass" type="checkbox" value="" onchange="toggleSchoolAssignmentEntireClass()" style="width:auto;margin-right:7px"><b>Entire class</b><span class="muted small"> — all students in ${esc(main.selectedOptions[0]?.textContent||"class")}</span></label>`+
     (groups.length?groups.map(g=>`<label style="display:block;padding:6px 4px"><input class="schoolassign-subgroup" type="checkbox" value="${esc(g.id)}" data-name="${esc(g.name)}" onchange="loadNewAssignmentClassStudents()" ${preferred.includes(g.id)||preferred.includes(g.name)?"checked":""} style="width:auto;margin-right:7px">${esc(g.name)}</label>`).join(""):'<div class="muted" style="padding:6px">No subdivisions have been created under this class.</div>');
 }
 if(list){
   list.innerHTML=`<label style="display:block;padding:10px;border:1px solid #bfdbfe;border-radius:10px;background:#fff"><input class="newassign-class" type="checkbox" value="${esc(classId)}" checked onchange="loadNewAssignmentClassStudents()" style="width:auto;margin-right:8px"><b>${esc(main.selectedOptions[0]?.textContent||"class")}</b><div class="small muted" style="margin-left:25px">School main group</div></label>`;
 }
 await loadNewAssignmentClassStudents();
}
function toggleSchoolAssignmentEntireClass(){
 const all=document.getElementById("aEntireClass");
 const boxes=[...document.querySelectorAll(".schoolassign-subgroup")];
 if(all?.checked)boxes.forEach(x=>x.checked=false);
 loadNewAssignmentClassStudents();
}
function getSelectedSchoolAssignmentSubgroups(){
 return [...document.querySelectorAll(".schoolassign-subgroup:checked")].map(x=>({id:x.value,name:x.dataset.name||""}));
}
function toggleAssignmentVideoFields(){const type=document.querySelector('input[name="assignmentType"]:checked')?.value||"video";const box=document.getElementById("assignmentVideoField");if(box)box.style.display=type==="video"?"block":"none"}
function toggleAdaptiveAssignmentFields(){const mode=document.querySelector('input[name="schoolAssignmentMode"]:checked')?.value||'standard';const box=document.getElementById('adaptiveAssignmentFields');if(box)box.style.display=mode==='adaptive'?'block':'none';if(mode==='adaptive'&&schoolTeacherMode&&!assignmentSchoolQbQuestions.length){setTimeout(()=>{if(!document.getElementById('assignmentSchoolQbBuilder')?.innerHTML)openSchoolAssignmentQbBuilder();},0);}}
function isAdaptiveSchoolAssignment(){return schoolTeacherMode&&document.querySelector('input[name="schoolAssignmentMode"]:checked')?.value==='adaptive';}
async function loadNewAssignmentClassStudents(){
 const box=document.getElementById("newAssignmentStudentPicker");if(!box)return;
 const classIds=[...document.querySelectorAll('.newassign-class:checked')].map(x=>x.value);
 if(!classIds.length){box.innerHTML='<div class="notice">Select a class above.</div>';return}
 box.innerHTML='<div class="small muted">Loading students...</div>';
 const {data:members,error}=await sb.from("class_students").select("class_id,student_id").in("class_id",classIds);
 if(error){box.innerHTML=message(error.message);return}
 let ids=[...new Set((members||[]).map(x=>x.student_id))],students=[];
 if(ids.length){const {data:p,error:e}=await sb.from("profiles").select("id,full_name,username,roll_no,school_group_id").in("id",ids).order("full_name");if(e){box.innerHTML=message(e.message);return}students=p||[]}
 if(schoolTeacherMode){
   const selectedGroups=getSelectedSchoolAssignmentSubgroups();
   const entire=document.getElementById("aEntireClass")?.checked||false;
   if(selectedGroups.length&&!entire){const gid=new Set(selectedGroups.map(g=>g.id));students=students.filter(s=>gid.has(s.school_group_id));}
   ids=students.map(s=>s.id);
 }
 const byClass=new Map();(members||[]).forEach(m=>{if(!byClass.has(m.class_id))byClass.set(m.class_id,[]);byClass.get(m.class_id).push(m.student_id)});
 box.innerHTML=classIds.map(cid=>{const cname=document.querySelector(`.newassign-class[value="${cid}"]`)?.parentElement.querySelector('b')?.textContent||cid;const list=(byClass.get(cid)||[]).map(id=>students.find(x=>x.id===id)).filter(Boolean);return `<div class="assignment" style="margin:8px 0"><h3 style="margin-bottom:8px">${esc(cname)}</h3><div class="small muted" style="margin-bottom:8px">${schoolTeacherMode?((document.getElementById("aEntireClass")?.checked)?"Entire class":(getSelectedSchoolAssignmentSubgroups().length?`Selected subdivisions: ${getSelectedSchoolAssignmentSubgroups().map(g=>esc(g.name)).join(", ")}`:"Entire class")):"Choose recipients"}</div><label><input type="radio" name="newassignMode_${cid}" value="class" checked onchange="document.getElementById('newassignStudents_${cid}').style.display='none'" style="width:auto;margin-right:6px">Entire selected group</label> <label><input type="radio" name="newassignMode_${cid}" value="students" onchange="document.getElementById('newassignStudents_${cid}').style.display='block'" style="width:auto;margin-right:6px">Selected students</label><div id="newassignStudents_${cid}" style="display:none;margin-top:8px">${list.length?`<div class="actions" style="margin-bottom:6px"><button type="button" class="secondary" onclick="selectNewAssignmentStudents('${cid}',true)">Select all</button><button type="button" class="secondary" onclick="selectNewAssignmentStudents('${cid}',false)">Clear all</button></div>${list.map(st=>`<label style="display:block;padding:5px"><input class="newassign-student" data-class-id="${cid}" type="checkbox" value="${st.id}" style="width:auto;margin-right:6px">${esc(st.full_name)} <span class="muted small">${esc(st.roll_no||st.username||'')}</span></label>`).join('')}`:'<span class="muted">No students in the selected group.</span>'}</div></div>`}).join('');
}
function selectNewAssignmentStudents(classId,value){document.querySelectorAll(`.newassign-student[data-class-id="${classId}"]`).forEach(x=>x.checked=value)}
async function getNewAssignmentRecipients(){
 const classIds=[...document.querySelectorAll('.newassign-class:checked')].map(x=>x.value);if(!classIds.length)throw new Error('Select at least one class or sub-group.');
 if(schoolTeacherMode){
   const classId=document.getElementById("aMainGroup")?.value||classIds[0];
   const selectedGroups=getSelectedSchoolAssignmentSubgroups();
   const entire=document.getElementById("aEntireClass")?.checked||false;
   const {data:members,error:me}=await sb.from('class_students').select('student_id').eq('class_id',classId);if(me)throw me;
   let candidateIds=[...(members||[])].map(x=>x.student_id);
   if(selectedGroups.length&&!entire){const gids=new Set(selectedGroups.map(g=>g.id));const {data:p,error:pe}=await sb.from('profiles').select('id').in('id',candidateIds);if(pe)throw pe;candidateIds=(p||[]).filter(x=>gids.has(x.school_group_id)).map(x=>x.id)}
   const mode=document.querySelector(`input[name="newassignMode_${classId}"]:checked`)?.value||'class';
   if(mode==='students')candidateIds=[...document.querySelectorAll(`.newassign-student[data-class-id="${classId}"]:checked`)].map(x=>x.value);
   if(!candidateIds.length)throw new Error('No students are available in the selected class/subdivision(s).');
   return {classIds:[classId],recipients:candidateIds.map(student_id=>({class_id:classId,student_id})),studentIds:[...new Set(candidateIds)],schoolGroupIds:selectedGroups.map(g=>g.id),schoolGroupNames:selectedGroups.map(g=>g.name)};
 }
 const selectedMainId=document.getElementById("aMainGroup")?.value||"";
 const selectedMain=(window._newAssignmentClasses||[]).find(c=>c.id===selectedMainId);
 const valid=new Set([selectedMain?.id,...jnvstSubgroupsForMain(window._newAssignmentClasses||[],selectedMain).map(c=>c.id)].filter(Boolean));
 if(classIds.some(id=>!valid.has(id)))throw new Error('Please select groups/sub-groups only from the selected main group.');
 const recipients=[];
 for(const cid of classIds){const mode=document.querySelector(`input[name="newassignMode_${cid}"]:checked`)?.value||'class';let ids=[];if(mode==='class'){const {data,error}=await sb.from('class_students').select('student_id').eq('class_id',cid);if(error)throw error;ids=(data||[]).map(x=>x.student_id)}else ids=[...document.querySelectorAll(`.newassign-student[data-class-id="${cid}"]:checked`)].map(x=>x.value);if(!ids.length)throw new Error(`No students selected in class ${document.querySelector(`.newassign-class[value="${cid}"]`)?.parentElement.querySelector('b')?.textContent||cid}.`);ids.forEach(student_id=>recipients.push({class_id:cid,student_id}))}
 const unique=[];const seen=new Set();recipients.forEach(r=>{if(!seen.has(r.student_id)){seen.add(r.student_id);unique.push(r)}});return {classIds,recipients:unique,studentIds:unique.map(x=>x.student_id)};
}
async function loadAssignmentStudents(classId){
 const box=document.getElementById("studentPicker");if(!box)return;
 if(document.querySelector('input[name="assignMode"]:checked')?.value!=="students"){box.innerHTML='<div class="small muted">The assignment will be given to all students in the selected class.</div>';return}
 box.innerHTML='<div class="small muted">Loading students...</div>';const {data:members,error}=await sb.from("class_students").select("student_id").eq("class_id",classId);if(error){box.innerHTML=message(error.message);return}
 const ids=(members||[]).map(x=>x.student_id);if(!ids.length){box.innerHTML='<div class="notice">No students are currently in this class.</div>';return}
 const {data:students,error:e}=await sb.from("profiles").select("id,full_name,username").in("id",ids).order("full_name");if(e){box.innerHTML=message(e.message);return}
 box.innerHTML=(students||[]).map(s=>`<label style="display:block;padding:6px 0"><input class="assignment-student" type="checkbox" value="${s.id}" style="width:auto;margin-right:8px">${esc(s.full_name)} <span class="muted small">${esc(s.username||"")}</span></label>`).join("")||'<div class="notice">No student profiles found.</div>'
 if(students?.length)box.insertAdjacentHTML("afterbegin",`<div class="actions" style="margin:4px 0 8px"><button type="button" class="secondary" onclick="selectAllAssignmentStudents(true)">Select all</button><button type="button" class="secondary" onclick="selectAllAssignmentStudents(false)">Clear all</button></div><div class="small muted" style="margin-bottom:6px">${students.length} student${students.length===1?"":"s"} in this class.</div>`);
}
function selectAllAssignmentStudents(value){document.querySelectorAll(".assignment-student").forEach(x=>x.checked=value)}
function toggleAssignmentStudents(){const mode=document.querySelector('input[name="assignMode"]:checked')?.value;if(mode==="students")loadAssignmentStudents(document.getElementById("ac")?.value);else{const box=document.getElementById("studentPicker");if(box)box.innerHTML='<div class="small muted">The assignment will be given to all students in the selected class.</div>'}}
async function getStudentsForAssignment(classId){const {data:members,error}=await sb.from("class_students").select("student_id").eq("class_id",classId);if(error)throw error;if(document.querySelector('input[name="assignMode"]:checked')?.value==="students")return [...document.querySelectorAll(".assignment-student:checked")].map(x=>x.value);return (members||[]).map(x=>x.student_id)}
async function assignStudentsToAssignment(assignmentId,classId){const studentIds=await getStudentsForAssignment(classId);if(!studentIds.length)throw new Error("No students were selected or this class has no students.");const rows=[...new Set(studentIds)].map(student_id=>({assignment_id:assignmentId,student_id}));const {error}=await sb.from("assignment_students").insert(rows);if(error)throw error;return rows.length}
function assignmentBankSubjectParts(){
 const name=String(document.getElementById('asub')?.value||'').trim().toUpperCase();
 if(name.includes('MAT')||name.includes('MENTAL')) return {parts:['MAT_PATTERN','MAT_SERIES','MAT_GEOMETRICAL','MAT_MIRROR','MAT_EMBEDDED'],languages:['COMMON']};
 if(name.includes('EVS')||name.includes('ENVIRONMENT')) return {parts:['EVS_MCQ','EVS_PASSAGE'],languages:['ASSAMESE','ENGLISH']};
 if(name.includes('ARITH')) return {parts:['ARITHMETIC'],languages:['ASSAMESE','ENGLISH']};
 if(name.includes('LANG')) return {parts:['LANGUAGE_PASSAGE'],languages:['ASSAMESE','ENGLISH']};
 return {parts:[],languages:['COMMON','ASSAMESE','ENGLISH']};
}
function assignmentBankRows(){
 const f=assignmentBankFilters; const search=String(f.search||'').trim().toLowerCase(); const meta=assignmentBankSubjectParts();
 return (assignmentBankCache||[]).filter(q=>{
   if(q.active===false)return false;
   if(meta.parts.length && !meta.parts.includes(String(q.part_code||'').toUpperCase()))return false;
   if(f.part && String(q.part_code||'').toUpperCase()!==String(f.part).toUpperCase())return false;
   if(f.language && String(q.language||'').toUpperCase()!==String(f.language).toUpperCase())return false;
   if(f.topic && String(q.topic||'')!==String(f.topic))return false;
   if(search){const hay=[q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,q.topic,q.part_code,q.language,q.passage_title,q.passage_id].map(v=>String(v??'')).join(' ').toLowerCase();if(!hay.includes(search))return false;}
   return true;
 });
}
function assignmentBankSelectedSummary(){
 const box=document.getElementById('assignmentSelectedBankSummary'); if(!box)return;
 const n=assignmentBankSelected.size;
 box.innerHTML=n?`<b>${n}</b> question${n===1?'':'s'} selected from the Mock Test Question Bank. <button type="button" class="secondary" onclick="clearAssignmentBankSelection()">Clear selection</button>`:'No question-bank questions selected.';
}
function assignmentBankToggle(id,checked){if(checked)assignmentBankSelected.add(id);else assignmentBankSelected.delete(id);assignmentBankSelectedSummary();renderAssignmentBankRows();}
function assignmentBankSelectAllVisible(value){assignmentBankRows().forEach(q=>value?assignmentBankSelected.add(q.id):assignmentBankSelected.delete(q.id));assignmentBankSelectedSummary();renderAssignmentBankRows();}
function clearAssignmentBankSelection(){assignmentBankSelected.clear();assignmentBankSelectedSummary();renderAssignmentBankRows();}
function assignmentBankPartOptions(){
 const meta=assignmentBankSubjectParts();
 return meta.parts.map(x=>({value:x,label:x==='EVS_MCQ'?'EVS — MCQ':x==='EVS_PASSAGE'?'EVS — Passage':x==='LANGUAGE_PASSAGE'?'Language — Passage':x.replace(/^MAT_/,'MAT — ').replace('_',' ')}));
}
function renderAssignmentBankRows(){
 const box=document.getElementById('assignmentBankRows'); if(!box)return;
 const rows=assignmentBankRows();
 box.innerHTML=rows.length?rows.slice(0,500).map((q,i)=>`<label style="display:flex;gap:10px;align-items:flex-start;padding:8px;border:1px solid #e2e8f0;border-radius:8px;margin:5px 0;background:${assignmentBankSelected.has(q.id)?'#eff6ff':'#fff'};cursor:pointer"><input type="checkbox" style="width:auto;margin-top:4px" ${assignmentBankSelected.has(q.id)?'checked':''} onchange="assignmentBankToggle('${q.id}',this.checked)"><span style="flex:1;min-width:0"><div style="float:right;margin-left:8px;max-width:180px">${teacherQuestionPreview(q,{width:'105px',height:'70px'})}</div><div class="small muted" style="margin-top:3px">${esc(q.part_code||'')} · ${esc(q.topic||'')} · ${mockBankDisplayLanguage(q.language)}${q.passage_title?` · ${esc(q.passage_title)}`:''}</div></span></label>`).join(''):`<div class="notice">No active questions match the selected filters. Choose another subject/filter or add questions to the Mock Test Question Bank first.</div>`;
 const countNote=rows.length>500?` Showing first 500 of ${rows.length}. Use filters/search to narrow the list.`:'';
 const note=document.getElementById('assignmentBankCount');if(note)note.textContent=`${rows.length} matching question(s).${countNote}`;
}
function renderAssignmentBankPicker(){
 const box=document.getElementById('assignmentBankPicker'); if(!box)return;
 const meta=assignmentBankSubjectParts(); const parts=assignmentBankPartOptions();
 const topics=[...new Set(assignmentBankCache.filter(q=>!meta.parts.length||meta.parts.includes(String(q.part_code||'').toUpperCase())).map(q=>String(q.topic||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 box.innerHTML=`<div class="card" style="border:2px solid #2563eb;background:#f8fbff"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h3 style="margin:0">📚 Mock Test Question Bank</h3><div class="small muted">Only questions belonging to the selected assignment subject are shown.</div></div><button type="button" class="secondary" onclick="document.getElementById('assignmentBankPicker').style.display='none'">Close</button></div><div class="grid" style="margin-top:10px"><div><label>Part</label><select id="abfPart" onchange="assignmentBankFilters.part=this.value;assignmentBankFilters.topic='';renderAssignmentBankPicker()"><option value="">All parts</option>${parts.map(p=>`<option value="${esc(p.value)}" ${assignmentBankFilters.part===p.value?'selected':''}>${esc(p.label)}</option>`).join('')}</select></div><div><label>Language</label><select id="abfLang" onchange="assignmentBankFilters.language=this.value;renderAssignmentBankPicker()"><option value="">All languages</option>${meta.languages.map(l=>`<option value="${l}" ${assignmentBankFilters.language===l?'selected':''}>${mockBankDisplayLanguage(l)}</option>`).join('')}</select></div><div><label>Topic</label><select id="abfTopic" onchange="assignmentBankFilters.topic=this.value;renderAssignmentBankPicker()"><option value="">All topics</option>${topics.map(t=>`<option value="${esc(t)}" ${assignmentBankFilters.topic===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div><div><label>Search</label><input id="abfSearch" value="${esc(assignmentBankFilters.search)}" placeholder="Search question..." oninput="assignmentBankFilters.search=this.value;renderAssignmentBankRows()"></div></div><div class="actions" style="margin:8px 0"><button type="button" class="secondary" onclick="assignmentBankSelectAllVisible(true)">Select all visible</button><button type="button" class="secondary" onclick="assignmentBankSelectAllVisible(false)">Clear visible</button><span id="assignmentBankCount" class="small muted"></span></div><div id="assignmentBankRows" style="max-height:520px;overflow:auto;padding-right:3px"></div><div class="actions" style="margin-top:10px"><button type="button" onclick="confirmAssignmentBankSelection()">✓ Use Selected Questions</button></div></div>`;
 renderAssignmentBankRows();
}
async function openAssignmentQuestionBank(){
 const box=document.getElementById('assignmentBankPicker');if(!box)return;
 const subject=document.getElementById('asub')?.value||'';if(!subject){const s=document.getElementById('asub');s?.focus();return notify('Please select the assignment subject first. The Question Bank will then show the matching questions.');}
 box.style.display='block';box.innerHTML='<div class="card"><span class="muted">Loading Mock Test Question Bank…</span></div>';
 const {data,error}=await sb.from('mock_question_bank').select('id,section_code,part_code,question_text,option_a,option_b,option_c,option_d,correct_option,passage_text,image_url,passage_id,passage_title,question_order,topic,language,active,created_at').eq('teacher_id',current.id).eq('active',true).order('created_at',{ascending:false});
 if(error){box.innerHTML=`<div class="notice">Could not load the Mock Test Question Bank: ${esc(error.message)}</div>`;return;}
 assignmentBankCache=data||[];assignmentBankFilters={part:'',topic:'',language:'',search:''};renderAssignmentBankPicker();assignmentBankSelectedSummary();
}
function confirmAssignmentBankSelection(){assignmentBankSelectedSummary();const box=document.getElementById('assignmentBankPicker');if(box)box.style.display='none';}
function restoreAssignmentBankSelection(ids){assignmentBankSelected=new Set((ids||[]).filter(Boolean));assignmentBankSelectedSummary();}
async function assignmentMistakeRecipients(){
  const classIds=[...document.querySelectorAll('.newassign-class:checked')].map(x=>x.value);
  const selected=[...document.querySelectorAll('.newassign-student:checked')].map(x=>x.value);
  if(selected.length)return [...new Set(selected)];
  if(!classIds.length)return [];
  const {data,error}=await sb.from('class_students').select('student_id').in('class_id',classIds);
  if(error)throw error;
  return [...new Set((data||[]).map(x=>x.student_id).filter(Boolean))];
}
function assignmentMistakeRows(){
  const f=assignmentMistakeFilters, search=String(f.search||'').trim().toLowerCase();
  const meta=assignmentBankSubjectParts();
  return (assignmentMistakeCache||[]).filter(x=>{
    const q=x.question;if(!q||q.active===false)return false;
    if(meta.parts.length&&!meta.parts.includes(String(q.part_code||'').toUpperCase()))return false;
    if(f.part&&String(q.part_code||'').toUpperCase()!==String(f.part).toUpperCase())return false;
    if(f.topic&&String(q.topic||'')!==String(f.topic))return false;
    if(Number(x.wrong_count||0)<Number(f.minWrong||1))return false;
    if(search){const hay=[q.question_text,q.topic,q.part_code,q.passage_title,q.passage_id].map(v=>String(v??'')).join(' ').toLowerCase();if(!hay.includes(search))return false;}
    return true;
  });
}
function assignmentMistakeSelectedSummary(){const box=document.getElementById('assignmentMistakeSummary');if(!box)return;box.innerHTML=assignmentMistakeSelected.size?`<b>${assignmentMistakeSelected.size}</b> mistake question${assignmentMistakeSelected.size===1?'':'s'} selected. <button type="button" class="secondary" onclick="clearAssignmentMistakeSelection()">Clear</button>`:'No mistake questions selected.';}
function assignmentMistakeToggle(id,on){if(on){assignmentMistakeSelected.add(id);assignmentBankSelected.add(id)}else{assignmentMistakeSelected.delete(id);assignmentBankSelected.delete(id)}assignmentMistakeSelectedSummary();assignmentBankSelectedSummary();renderAssignmentMistakeRows();}
function assignmentMistakeSelectAllVisible(on){assignmentMistakeRows().forEach(x=>on?assignmentMistakeSelected.add(x.question.id):assignmentMistakeSelected.delete(x.question.id));assignmentMistakeRows().forEach(x=>on?assignmentBankSelected.add(x.question.id):assignmentBankSelected.delete(x.question.id));assignmentMistakeSelectedSummary();assignmentBankSelectedSummary();renderAssignmentMistakeRows();}
function clearAssignmentMistakeSelection(){assignmentMistakeSelected.forEach(id=>assignmentBankSelected.delete(id));assignmentMistakeSelected.clear();assignmentBankSelectedSummary();assignmentMistakeSelectedSummary();renderAssignmentMistakeRows();}
function renderAssignmentMistakeRows(){
 const box=document.getElementById('assignmentMistakeRows');if(!box)return;const rows=assignmentMistakeRows();
 box.innerHTML=rows.length?rows.slice(0,500).map(x=>{const q=x.question,id=q.id;return `<label style="display:flex;gap:10px;align-items:flex-start;padding:9px;border:1px solid #e2e8f0;border-radius:8px;margin:5px 0;background:${assignmentMistakeSelected.has(id)?'#fff7ed':'#fff'};cursor:pointer"><input type="checkbox" style="width:auto;margin-top:4px" ${assignmentMistakeSelected.has(id)?'checked':''} onchange="assignmentMistakeToggle('${id}',this.checked)"><span style="flex:1;min-width:0"><div style="float:right;margin-left:8px;max-width:180px">${teacherQuestionPreview(q,{width:'105px',height:'70px'})}</div><div class="small muted" style="margin-top:3px">${esc(q.part_code||'')} · ${esc(q.topic||'')} · Wrong <b>${Number(x.wrong_count||0)}</b> time${Number(x.wrong_count||0)===1?'':'s'} · Attempts ${Number(x.attempt_count||0)}</div></span></label>`}).join(''):'<div class="notice">No mistake questions match the selected filters. Students must have attempted questions linked to the Mock Test Question Bank.</div>';
 const note=document.getElementById('assignmentMistakeCount');if(note)note.textContent=`${rows.length} matching question(s).`;
}
async function openAssignmentMistakeBank(){
 const box=document.getElementById('assignmentBankPicker');if(!box)return;let studentIds=[];try{studentIds=await assignmentMistakeRecipients()}catch(e){return notify('Could not load assignment students: '+(e.message||e))}
 if(!studentIds.length)return notify('Select the students/classes for this assignment first, then open Student Mistakes.');
 box.style.display='block';box.innerHTML='<div class="card"><span class="muted">Loading student mistakes…</span></div>';
 let {data:perf,error}=await sb.from('student_question_performance').select('*').in('student_id',studentIds).gt('wrong_count',0).order('wrong_count',{ascending:false});if(perf)perf=perf.filter(x=>x.correct_streak===undefined||Number(x.correct_streak||0)<2); /* V14: hide mistakes fixed by two correct answers in a row */
 if(error){box.innerHTML=`<div class="notice">Could not load student mistakes: ${esc(error.message)}</div>`;return;}
 const ids=[...new Set((perf||[]).map(x=>x.mock_question_id).filter(Boolean))];if(!ids.length){box.innerHTML='<div class="card"><b>No mistake questions found.</b><p class="muted">These students have no recorded wrong answers from Mock Test Question Bank questions yet.</p></div>';return;}
 const {data:qs,error:qe}=await sb.from('mock_question_bank').select('id,part_code,topic,question_text,image_url,passage_title,active').in('id',ids).eq('teacher_id',current.id);
 if(qe){box.innerHTML=`<div class="notice">Could not load mistake questions: ${esc(qe.message)}</div>`;return;}
 const by=new Map();(perf||[]).forEach(x=>{const prev=by.get(x.mock_question_id)||{wrong_count:0,attempt_count:0,correct_count:0};prev.wrong_count+=Number(x.wrong_count||0);prev.attempt_count+=Number(x.attempt_count||0);prev.correct_count+=Number(x.correct_count||0);by.set(x.mock_question_id,prev)});
 assignmentMistakeCache=(qs||[]).map(q=>({...by.get(q.id),question:q}));assignmentMistakeFilters={minWrong:1,part:'',topic:'',search:''};assignmentMistakeSelected=new Set([...assignmentBankSelected].filter(id=>ids.includes(id)));
 const meta=assignmentBankSubjectParts();const parts=meta.parts.map(x=>({value:x,label:x==='EVS_MCQ'?'EVS — MCQ':x==='EVS_PASSAGE'?'EVS — Passage':x==='LANGUAGE_PASSAGE'?'Language — Passage':x.replace(/^MAT_/,'MAT — ').replace('_',' ')}));
 const topics=[...new Set(assignmentMistakeCache.map(x=>String(x.question.topic||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 box.innerHTML=`<div class="card" style="border:2px solid #f59e0b;background:#fffaf0"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h3 style="margin:0">🎯 Student Mistake Bank</h3><div class="small muted">Questions answered wrongly by the selected students. Selecting one adds the original Mock Question Bank question to this assignment.</div></div><button type="button" class="secondary" onclick="document.getElementById('assignmentBankPicker').style.display='none'">Close</button></div><div class="grid" style="margin-top:10px"><div><label>Minimum Wrong Count</label><select id="amfWrong" onchange="assignmentMistakeFilters.minWrong=this.value;renderAssignmentMistakeRows()"><option value="1">Wrong ≥ 1</option><option value="2">Wrong ≥ 2</option><option value="3">Wrong ≥ 3</option><option value="5">Wrong ≥ 5</option></select></div><div><label>Part</label><select id="amfPart" onchange="assignmentMistakeFilters.part=this.value;renderAssignmentMistakeRows()"><option value="">All parts</option>${parts.map(p=>`<option value="${esc(p.value)}">${esc(p.label)}</option>`).join('')}</select></div><div><label>Topic</label><select id="amfTopic" onchange="assignmentMistakeFilters.topic=this.value;renderAssignmentMistakeRows()"><option value="">All topics</option>${topics.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div><div><label>Search</label><input id="amfSearch" placeholder="Search question/topic..." oninput="assignmentMistakeFilters.search=this.value;renderAssignmentMistakeRows()"></div></div><div class="actions" style="margin:8px 0"><button type="button" class="secondary" onclick="assignmentMistakeSelectAllVisible(true)">Select all visible</button><button type="button" class="secondary" onclick="assignmentMistakeSelectAllVisible(false)">Clear visible</button><span id="assignmentMistakeCount" class="small muted"></span></div><div id="assignmentMistakeRows" style="max-height:520px;overflow:auto;padding-right:3px"></div><div id="assignmentMistakeSummary" class="small muted" style="margin-top:8px"></div><div class="actions" style="margin-top:10px"><button type="button" onclick="document.getElementById('assignmentBankPicker').style.display='none';assignmentMistakeSelectedSummary();assignmentBankSelectedSummary()">✓ Use Selected Mistakes</button></div></div>`;
 renderAssignmentMistakeRows();assignmentMistakeSelectedSummary();
}
function assignmentSchoolQbEsc(v){return esc(v==null?'':String(v))}
function assignmentSchoolQbJs(v){return JSON.stringify(String(v==null?'':v))}
function assignmentSchoolQbQuestionLessonId(q){return assignmentSchoolQbMode==='JNVST'?q.lesson_id:q.chapter_id}
function assignmentSchoolQbQuestionText(q,lang){if(assignmentSchoolQbMode==='JNVST')return q.question_text||'';if(lang==='AS')return q.question_text_as||q.question_text_en||'';if(lang==='BOTH')return [q.question_text_en,q.question_text_as].filter(Boolean).join('\n');return q.question_text_en||q.question_text_as||''}
function assignmentSchoolQbLessonLabel(id){if(assignmentSchoolQbMode==='JNVST'){const jl=(jnvstSubjectLessons||[]).find(x=>x.id===id);if(!jl)return '—';const p=(jnvstSubjectLessons||[]).find(x=>x.id===jl.parent_lesson_id);return `${jl.lesson_code||''} ${jl.lesson_name}${p?' (Sub-lesson of '+(p.lesson_code||'')+')':''}`}const c=assignmentSchoolQbChapters.find(x=>x.id===id);if(!c)return '—';const p=assignmentSchoolQbChapters.find(x=>x.id===c.parent_chapter_id);return `${c.chapter_code||c.chapter_number||''}. ${c.chapter_name}${p?' (Subchapter of '+(p.chapter_code||p.chapter_number||'')+')':''}`}
function assignmentSchoolQbSubjectMatches(q){
 if(assignmentSchoolQbMode==='SCHOOL'){
   // School Course questions now use the shared School Subject list. Legacy rows
   // without subject_id remain compatible and are matched by their subject text when present.
   if(q.course_type!=='SCHOOL')return false;
   const wanted=String(assignmentSchoolQbSubjectName||'').trim().toLowerCase();
   const stored=String(q.subject||'').trim().toLowerCase();
   if(q.subject_id && String(q.subject_id)!==String(assignmentSchoolQbSubject))return false;
   return !stored || !wanted || stored===wanted;
 }
 return !!assignmentSchoolQbSubject&&String(q.subject_id||'')===String(assignmentSchoolQbSubject)
}
function assignmentSchoolQbMediumMatches(q){const m=String(assignmentSchoolQbMode==='JNVST'?q.language:q.medium||'').trim().toUpperCase(),wanted=String(assignmentSchoolQbMedium||'').trim().toUpperCase();if(!wanted)return false;if(assignmentSchoolQbMode==='JNVST')return wanted==='BOTH'?(m==='ENGLISH'||m==='ASSAMESE'):m===wanted; if(wanted==='BOTH')return m==='BOTH'||m==='ENGLISH_ASSAMESE'||m==='BILINGUAL'||m==='ENGLISH + ASSAMESE'||m==='ENGLISH+ASSAMESE';return m===wanted}
function assignmentSchoolQbBaseFiltered(){if(!assignmentSchoolQbSubject||!assignmentSchoolQbMedium)return [];return assignmentSchoolQbQuestions.filter(q=>assignmentSchoolQbSubjectMatches(q)&&assignmentSchoolQbMediumMatches(q))}
function assignmentSchoolQbJnvstDescendantIds(rootId){const ids=new Set([rootId]);let changed=true;while(changed){changed=false;(jnvstSubjectLessons||[]).forEach(x=>{if(x.parent_lesson_id&&ids.has(x.parent_lesson_id)&&!ids.has(x.id)){ids.add(x.id);changed=true;}})}return ids}
function assignmentSchoolQbAllowed(){const base=assignmentSchoolQbBaseFiltered();if(!assignmentSchoolQbLessons.size)return base;if(assignmentSchoolQbMode==='SCHOOL'){const ids=new Set();assignmentSchoolQbLessons.forEach(id=>{const d=new Set([id]);let changed=true;while(changed){changed=false;assignmentSchoolQbChapters.forEach(x=>{if(x.parent_chapter_id&&d.has(x.parent_chapter_id)&&!d.has(x.id)){d.add(x.id);changed=true;}})}d.forEach(x=>ids.add(x))});return base.filter(q=>q.chapter_id&&ids.has(q.chapter_id))}const ids=new Set();assignmentSchoolQbLessons.forEach(id=>assignmentSchoolQbJnvstDescendantIds(id).forEach(x=>ids.add(x)));return base.filter(q=>q.lesson_id&&ids.has(q.lesson_id))}
function assignmentSchoolQbGroup(q){return String(q.variation_group||'').trim().toLowerCase()||null}
function assignmentSchoolQbPreview(q,lang){
 const text=assignmentSchoolQbQuestionText(q,lang||'EN');
 const image=q.image_url||null;
 const isImagePlaceholder=/^\[IMAGE QUESTION(?:[^]]*)\]$/i.test(String(text||'').trim());
 const textHtml=text&&!isImagePlaceholder?`<div style="white-space:pre-wrap;line-height:1.45"><b>${jnvstMathPreview(text)}</b></div>`:'';
 return `<div style="margin:7px 0 0 28px;padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">${image?`<img src="${assignmentSchoolQbEsc(image)}" alt="Question image" loading="lazy" onclick="event.preventDefault();event.stopPropagation();openMockQuestionImage('${assignmentSchoolQbEsc(image)}','Question preview')" style="display:block;width:180px;max-height:130px;object-fit:contain;border:1px solid #cbd5e1;border-radius:6px;padding:3px;background:#fff;cursor:zoom-in;margin-bottom:7px">`:''}${textHtml}${!image&&!textHtml?'<div class="muted small">Question preview unavailable</div>':''}</div>`;
}
function assignmentSchoolQbRenderBuilder(){
 const box=document.getElementById('assignmentSchoolQbBuilder');if(!box)return;
 const subjects=assignmentSchoolQbMode==='JNVST'
   ?(jnvstSubjects||[]).filter(x=>String(x.name||'').trim())
   :(schoolSubjects||[]).filter(x=>String(x.name||'').trim() && x.active!==false).map(x=>({id:x.id,name:x.name,code:x.code}));
 const subjectOptions=subjects.length?subjects.map(x=>`<option value="${assignmentSchoolQbEsc(x.id)}" ${assignmentSchoolQbSubject===x.id||assignmentSchoolQbSubjectName===x.name?'selected':''}>${assignmentSchoolQbEsc(x.name)}</option>`).join(''):`<option value="" selected>No School subjects found — add one in Teacher Dashboard</option>`;
 const jnvstLessons=(jnvstSubjectLessons||[]).filter(l=>l.subject_id===assignmentSchoolQbSubject);
 const lessons=assignmentSchoolQbMode==='JNVST'?jnvstLessons:assignmentSchoolQbChapters.filter(c=>assignmentSchoolQbBaseFiltered().some(q=>q.chapter_id===c.id)).sort((a,b)=>String(a.chapter_code||a.chapter_number||'').localeCompare(String(b.chapter_code||b.chapter_number||''),undefined,{numeric:true}));
 const lessonLabel=l=>assignmentSchoolQbMode==='JNVST'?`${l.lesson_code||''} ${l.lesson_name}`:`${l.chapter_code||l.chapter_number||''}. ${l.chapter_name}`;
 const allowed=assignmentSchoolQbAllowed();
 const groups=[...new Set(allowed.map(q=>assignmentSchoolQbGroup(q)).filter(Boolean))].sort();
 const ready=!!assignmentSchoolQbSubject&&!!assignmentSchoolQbMedium;
 const mediumOptions=assignmentSchoolQbMode==='JNVST'?`<option value="">Select Medium</option><option value="COMMON" ${assignmentSchoolQbMedium==='COMMON'?'selected':''}>Common (MAT)</option><option value="ENGLISH" ${assignmentSchoolQbMedium==='ENGLISH'?'selected':''}>English</option><option value="ASSAMESE" ${assignmentSchoolQbMedium==='ASSAMESE'?'selected':''}>Assamese</option><option value="BOTH" ${assignmentSchoolQbMedium==='BOTH'?'selected':''}>English + Assamese</option>`:`<option value="">Select Medium</option><option value="ENGLISH" ${assignmentSchoolQbMedium==='ENGLISH'?'selected':''}>English</option><option value="ASSAMESE" ${assignmentSchoolQbMedium==='ASSAMESE'?'selected':''}>Assamese</option><option value="BOTH" ${assignmentSchoolQbMedium==='BOTH'?'selected':''}>English + Assamese</option>`;
 box.innerHTML=`<div class="card" style="border:2px solid #16a34a;background:#f7fff9"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><h3 style="margin:0">🧩 ${assignmentSchoolQbMode==='JNVST'?'JNVST Assignment from JNVST Question Bank':'School Course Assignment from School Question Bank'}</h3><div class="small muted">Select Subject + Medium first. Only matching questions from this course are then displayed.</div></div><button type="button" class="secondary" onclick="document.getElementById('assignmentSchoolQbBuilder').style.display='none'">Close</button></div>
 <div class="grid" style="margin-top:12px"><div><label>Subject</label><select id="asqbSubject" onchange="assignmentSchoolQbSubject=this.value;assignmentSchoolQbSubjectName=assignmentSchoolQbMode==='JNVST'?((jnvstSubjects.find(x=>x.id===this.value)||{}).name||''):(schoolSubjects.find(x=>x.id===this.value)||{}).name||'';const a=document.getElementById('asub');if(a&&assignmentSchoolQbSubjectName)a.value=assignmentSchoolQbSubjectName;assignmentSchoolQbLessons.clear();assignmentSchoolQbFixedQuestions.clear();assignmentSchoolQbFixedGroups.clear();assignmentSchoolQbSelected=null;assignmentSchoolQbRenderBuilder()"><option value="">Select Subject</option>${subjectOptions}</select></div><div><label>Medium</label><select id="asqbMedium" onchange="assignmentSchoolQbMedium=this.value;assignmentSchoolQbLessons.clear();assignmentSchoolQbFixedQuestions.clear();assignmentSchoolQbFixedGroups.clear();assignmentSchoolQbSelected=null;assignmentSchoolQbRenderBuilder()">${mediumOptions}</select></div><div><label>Total Questions</label><input id="asqbTotal" type="number" min="1" value="${assignmentSchoolQbSelected?.total||10}" onchange="assignmentSchoolQbRenderSummary()"></div>${assignmentSchoolQbMode==='SCHOOL'?`<div><label>Question Language</label><select id="asqbLang"><option value="EN">English</option><option value="AS">Assamese</option><option value="BOTH">English + Assamese</option></select></div>`:''}</div>
 ${!ready?'<div class="notice" style="margin-top:10px"><b>Select Subject and Medium.</b> Questions will not be displayed until both are selected.</div>':`<div class="success" style="margin-top:10px"><b>${allowed.length}</b> matching question(s) available for <b>${assignmentSchoolQbEsc(assignmentSchoolQbSubjectName||((jnvstSubjects||[]).find(x=>x.id===assignmentSchoolQbSubject)||{}).name||'')}</b> / <b>${assignmentSchoolQbMedium}</b>.</div>`}
 ${ready?`<div class="card" style="margin-top:10px"><h4 style="margin:0 0 7px">1. Select Lessons / Chapters</h4><div class="small muted" style="margin-bottom:7px">${assignmentSchoolQbMode==='JNVST'?'JNVST uses Lesson → Sub-lesson. Selecting a parent includes its sub-lessons.':'School Course uses Chapter → Subchapter. Selecting a parent includes its subchapters.'}</div><div style="max-height:220px;overflow:auto">${lessons.length?lessons.map(c=>`<label style="display:block;padding:5px;border-bottom:1px solid #e5e7eb"><input type="checkbox" style="width:auto" ${assignmentSchoolQbLessons.has(c.id)?'checked':''} onchange="assignmentSchoolQbLessonToggle('${c.id}',this.checked)"> <b>${assignmentSchoolQbEsc(c.lesson_code||c.chapter_code||c.chapter_number||'')}</b> ${assignmentSchoolQbEsc(c.lesson_name||c.chapter_name)} ${c.parent_lesson_id||c.parent_chapter_id?'<span class="small muted">(Sub-lesson/Subchapter)</span>':'<span class="small muted">(Lesson/Chapter)</span>'}</label>`).join(''):'<div class="muted">No lessons contain questions for this Subject + Medium. Assign existing questions to a JNVST lesson first.</div>'}</div></div>
 <div class="grid"><div class="card" style="margin-top:10px"><h4 style="margin:0 0 7px">2. Fixed Questions</h4><div class="small muted">These selected questions must appear. Their variation group is excluded from the remaining random pool.</div><input id="asqbFixedSearch" placeholder="Search question / topic / group..." oninput="assignmentSchoolQbRenderFixed()"><div id="asqbFixedList" style="max-height:300px;overflow:auto;margin-top:7px"></div></div>
 <div class="card" style="margin-top:10px"><h4 style="margin:0 0 7px">3. Fixed Question Groups</h4><div class="small muted">Select a variation group to include exactly one random question from that group.</div><div id="asqbGroupList" style="max-height:300px;overflow:auto;margin-top:7px">${groups.length?groups.map(g=>{const gqs=allowed.filter(q=>assignmentSchoolQbGroup(q)===g);return `<div style="padding:8px;border-bottom:1px solid #e5e7eb"><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" style="width:auto;margin-top:4px" ${assignmentSchoolQbFixedGroups.has(g)?'checked':''} onchange="assignmentSchoolQbGroupToggle(${assignmentSchoolQbJs(g)},this.checked)"><span><b>${assignmentSchoolQbEsc(g)}</b> <span class="small muted">(${gqs.length} variations)</span></span></label><div style="margin-left:4px">${gqs.map(q=>assignmentSchoolQbPreview(q,'EN')).join('')}</div></div>`}).join(''):'<div class="muted">No variation groups in the selected scope.</div>'}</div></div></div>
 <div class="card" style="margin-top:10px"><h4 style="margin:0 0 7px">4. Generate Selection</h4><div id="asqbSummary" class="small muted">Set the total and constraints, then generate.</div><div class="actions"><button type="button" onclick="generateSchoolAssignmentQbSelection()">🎲 Generate Assignment Questions</button><button type="button" class="secondary" onclick="assignmentSchoolQbClearSelection()">Clear Generated Selection</button></div><div id="asqbSelectedList" style="margin-top:8px"></div></div>`:''}</div>`;
 if(ready){assignmentSchoolQbRenderFixed();assignmentSchoolQbRenderSummary();}
 if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise([box]).catch(()=>{});
}
function assignmentSchoolQbLessonToggle(id,on){if(on)assignmentSchoolQbLessons.add(id);else assignmentSchoolQbLessons.delete(id);assignmentSchoolQbFixedQuestions=new Set([...assignmentSchoolQbFixedQuestions].filter(x=>assignmentSchoolQbAllowed().some(q=>q.id===x)));assignmentSchoolQbFixedGroups=new Set([...assignmentSchoolQbFixedGroups].filter(g=>assignmentSchoolQbAllowed().some(q=>assignmentSchoolQbGroup(q)===g)));assignmentSchoolQbSelected=null;assignmentSchoolQbRenderBuilder()}
function assignmentSchoolQbFixedToggle(id,on){if(on)assignmentSchoolQbFixedQuestions.add(id);else assignmentSchoolQbFixedQuestions.delete(id);assignmentSchoolQbSelected=null;assignmentSchoolQbRenderFixed();assignmentSchoolQbRenderSummary()}
function assignmentSchoolQbGroupToggle(g,on){if(on)assignmentSchoolQbFixedGroups.add(g);else assignmentSchoolQbFixedGroups.delete(g);assignmentSchoolQbSelected=null;assignmentSchoolQbRenderBuilder()}
function assignmentSchoolQbRenderFixed(){
 const box=document.getElementById('asqbFixedList');if(!box)return;
 const s=(document.getElementById('asqbFixedSearch')?.value||'').toLowerCase();
 const lang=document.getElementById('asqbLang')?.value||'EN';
 const rows=assignmentSchoolQbAllowed().filter(q=>{const text=`${assignmentSchoolQbQuestionText(q,'EN')} ${assignmentSchoolQbQuestionText(q,'AS')} ${q.topic||''} ${q.variation_group||''}`.toLowerCase();return !s||text.includes(s)}).slice(0,500);
 box.innerHTML=rows.length?rows.map((q,i)=>{
   const lesson=assignmentSchoolQbLessonLabel(assignmentSchoolQbQuestionLessonId(q));
   const previewLang=lang==='BOTH'?'BOTH':lang;
   const title=assignmentSchoolQbQuestionText(q,previewLang)||assignmentSchoolQbQuestionText(q,'EN')||assignmentSchoolQbQuestionText(q,'AS')||'[Question text unavailable]';
   const meta=[lesson,q.topic?`Topic: ${q.topic}`:'',q.marks!=null?`Marks: ${q.marks}`:'',q.cognitive_level?`Cognitive: ${q.cognitive_level}`:'',q.variation_group?`Group: ${q.variation_group}`:''].filter(Boolean).join(' · ');
   return `<div class="asqb-fixed-item"><div class="asqb-fixed-check"><input type="checkbox" aria-label="Select fixed question ${i+1}" ${assignmentSchoolQbFixedQuestions.has(q.id)?'checked':''} onchange="assignmentSchoolQbFixedToggle('${q.id}',this.checked)"></div><div class="asqb-fixed-content"><div class="asqb-fixed-title">${assignmentSchoolQbEsc(title)}</div>${lang==='BOTH'&&q.question_text_en&&q.question_text_as?`<div class="asqb-fixed-bilingual"><div><b>English:</b> ${assignmentSchoolQbEsc(q.question_text_en)}</div><div><b>Assamese:</b> ${assignmentSchoolQbEsc(q.question_text_as)}</div></div>`:''}${q.image_url?`<img src="${assignmentSchoolQbEsc(q.image_url)}" alt="Question image" loading="lazy" class="asqb-fixed-image" onclick="event.preventDefault();event.stopPropagation();openMockQuestionImage('${assignmentSchoolQbEsc(q.image_url)}','Question preview')">`:''}<div class="asqb-fixed-preview">${assignmentSchoolQbPreview(q,previewLang)}</div></div><div class="asqb-fixed-meta"><span class="tag">${assignmentSchoolQbEsc(lang==='BOTH'?'EN + AS':lang==='AS'?'ASSAMESE':'ENGLISH')}</span><div class="small muted" style="margin-top:7px">${assignmentSchoolQbEsc(meta)}</div>${q.is_fixed?'<div class="small" style="margin-top:7px;color:#166534;font-weight:700">✓ Bank Fixed</div>':''}</div></div>`;
 }).join(''):'<div class="muted" style="padding:18px">No questions in the selected lessons.</div>';
 if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise([box]).catch(()=>{});
}
function assignmentSchoolQbRenderSummary(){const box=document.getElementById('asqbSummary');if(!box)return;const total=Number(document.getElementById('asqbTotal')?.value||0);const fixed=assignmentSchoolQbQuestions.filter(q=>assignmentSchoolQbFixedQuestions.has(q.id));const groups=new Set(fixed.map(assignmentSchoolQbGroup).filter(Boolean));box.textContent=`Total: ${total} · Fixed questions: ${fixed.length} · Fixed groups: ${assignmentSchoolQbFixedGroups.size} · Remaining random questions: ${Math.max(0,total-fixed.length-assignmentSchoolQbFixedGroups.size)}`}
function assignmentSchoolQbClearSelection(){assignmentSchoolQbSelected=null;const x=document.getElementById('asqbSelectedList');if(x)x.innerHTML='';assignmentSchoolQbRenderSummary()}
function generateSchoolAssignmentQbSelection(){
 const total=Number(document.getElementById('asqbTotal')?.value||0);if(!total||total<1)return notify('Enter a valid total number of questions.');
 const allowed=assignmentSchoolQbAllowed();if(!allowed.length)return notify('Select at least one lesson/chapter with available questions.');
 const fixed=allowed.filter(q=>assignmentSchoolQbFixedQuestions.has(q.id));const fixedGroups=[...assignmentSchoolQbFixedGroups];
 const usedIds=new Set();const usedGroups=new Set();const selected=[];
 for(const q of fixed){const g=assignmentSchoolQbGroup(q);if(g&&usedGroups.has(g))return notify(`Only one fixed question can belong to Variation Group ${q.variation_group}.`);selected.push(q);usedIds.add(q.id);if(g)usedGroups.add(g)}
 for(const g of fixedGroups){if(usedGroups.has(g))return notify(`Variation Group ${g} is already represented by a fixed question.`);const pool=allowed.filter(q=>assignmentSchoolQbGroup(q)===g&&!usedIds.has(q.id));if(!pool.length)return notify(`No usable question is available in fixed Variation Group ${g}.`);const q=pool[Math.floor(Math.random()*pool.length)];selected.push(q);usedIds.add(q.id);usedGroups.add(g)}
 if(selected.length>total)return notify(`Fixed selections already contain ${selected.length} questions, which exceeds the requested ${total}.`);
 // For JNVST, a variation group is an explicit teacher constraint, not a reason to
 // make otherwise independent bank questions mutually exclusive. This is especially
 // important for image-based MAT questions, where many imported questions may share
 // legacy/blank variation metadata. School-course generation keeps the stricter rule.
 const enforceRandomVariation = assignmentSchoolQbMode!=='JNVST';
 const pool=allowed.filter(q=>!usedIds.has(q.id)&&(!enforceRandomVariation||!assignmentSchoolQbGroup(q)||!usedGroups.has(assignmentSchoolQbGroup(q))));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 for(const q of pool){if(selected.length>=total)break;const g=assignmentSchoolQbGroup(q);if(enforceRandomVariation&&g&&usedGroups.has(g))continue;selected.push(q);usedIds.add(q.id);if(enforceRandomVariation&&g)usedGroups.add(g)}
 if(selected.length<total)return notify(`Only ${selected.length} unique questions are available in the selected lessons. Add more questions, select more lessons, or reduce the total.`);
 assignmentSchoolQbSelected={ids:selected.map(q=>q.id),total,lang:document.getElementById('asqbLang')?.value||'EN',subject:assignmentSchoolQbSubject,subject_name:assignmentSchoolQbSubjectName,medium:assignmentSchoolQbMedium,course_type:assignmentSchoolQbMode};
 const out=document.getElementById('asqbSelectedList');if(out)out.innerHTML=`<div class="success"><b>${selected.length} questions selected.</b> Fixed questions/groups are preserved; remaining questions were randomly selected without reusing a variation group.</div><div style="max-height:650px;overflow:auto;margin-top:8px">${selected.map((q,i)=>`<div style="margin:6px 0;padding:9px;border:1px solid #dbe3ee;border-radius:9px;background:#fff"><b>Question ${i+1}</b><span class="small muted"> — ${assignmentSchoolQbEsc(assignmentSchoolQbLessonLabel(assignmentSchoolQbQuestionLessonId(q)))}${q.topic?' · '+assignmentSchoolQbEsc(q.topic):''}${q.variation_group?' · '+assignmentSchoolQbEsc(q.variation_group):''}</span>${assignmentSchoolQbPreview(q,assignmentSchoolQbSelected.lang)}</div>`).join('')}</div>`;
 assignmentSchoolQbRenderSummary();
 if(window.MathJax?.typesetPromise){const out=document.getElementById('asqbSelectedList');if(out)window.MathJax.typesetPromise([out]).catch(()=>{});}
}
async function openJnvstAssignmentQbBuilder(){assignmentSchoolQbMode='JNVST';const box=document.getElementById('assignmentSchoolQbBuilder');if(!box)return;box.style.display='block';box.innerHTML='<div class="card"><span class="muted">Loading JNVST Question Bank…</span></div>';const {data:q,error}=await sb.from('mock_question_bank').select('*').eq('teacher_id',current.id).eq('active',true).order('created_at',{ascending:false});if(error){box.innerHTML=`<div class="notice">Could not load JNVST Question Bank: ${assignmentSchoolQbEsc(error.message)}</div>`;return;}assignmentSchoolQbQuestions=q||[];assignmentSchoolQbChapters=[];const initial=document.getElementById('asub')?.value||'';const so=(jnvstSubjects||[]).find(x=>String(x.name||'').trim().toLowerCase()===String(initial).trim().toLowerCase());assignmentSchoolQbSubject=so?.id||'';assignmentSchoolQbSubjectName=so?.name||initial;assignmentSchoolQbMedium='';assignmentSchoolQbLessons=new Set();assignmentSchoolQbFixedQuestions.clear();assignmentSchoolQbFixedGroups.clear();assignmentSchoolQbSelected=null;assignmentSchoolQbRenderBuilder();box.scrollIntoView({behavior:'smooth',block:'start'});}
async function openSchoolAssignmentQbBuilder(){
 assignmentSchoolQbMode='SCHOOL';
 const box=document.getElementById('assignmentSchoolQbBuilder');if(!box)return;
 box.style.display='block';box.innerHTML='<div class="card"><span class="muted">Loading School Course Question Bank…</span></div>';
 const [{data:q,error:qe},{data:c,error:ce},{data:ss,error:se}]=await Promise.all([
   sb.from('school_question_bank_questions').select('*').eq('teacher_id',current.id).eq('course_type','SCHOOL').order('created_at',{ascending:false}),
   sb.from('school_question_bank_chapters').select('*').eq('teacher_id',current.id).order('chapter_code').order('chapter_name'),
   sb.from('school_subjects').select('id,name,code').eq('teacher_id',current.id).eq('active',true).order('name')
 ]);
 if(qe||ce||se){box.innerHTML=`<div class="notice">Could not load School Course Question Bank: ${assignmentSchoolQbEsc((qe||ce||se).message)}</div>`;return;}
 schoolSubjects=ss||[];assignmentSchoolQbQuestions=q||[];assignmentSchoolQbChapters=c||[];
 const initial=String(document.getElementById('asub')?.value||'').trim();
 const selectedSubject=schoolSubjects.find(x=>String(x.id)===initial)||schoolSubjects.find(x=>String(x.name).trim().toLowerCase()===initial.toLowerCase())||schoolSubjects.find(x=>x.name==='Mathematics');
 assignmentSchoolQbSubject=selectedSubject?.id||'';assignmentSchoolQbSubjectName=selectedSubject?.name||initial;
 
 assignmentSchoolQbMedium='';assignmentSchoolQbLessons=new Set();assignmentSchoolQbFixedQuestions.clear();assignmentSchoolQbFixedGroups.clear();assignmentSchoolQbSelected=null;
 assignmentSchoolQbRenderBuilder();box.scrollIntoView({behavior:'smooth',block:'start'});
}
function addQ(){const i=document.querySelectorAll(".q").length;document.getElementById("qs").insertAdjacentHTML("beforeend",`<div class="card q" style="background:#f8fafc"><b>Question ${i+1}</b><input class="qt" placeholder="Question"><input class="oa" placeholder="Option A"><input class="ob" placeholder="Option B"><input class="oc" placeholder="Option C"><input class="od" placeholder="Option D"><select class="co"><option>A</option><option>B</option><option>C</option><option>D</option></select></div>`)}
async function loadSchoolAdaptiveSnapshots(ids,lang){
  const wanted=[...new Set((ids||[]).filter(Boolean))];
  if(!wanted.length)return new Map();
  const [{data:bankRows,error:be},{data:opts,error:oe},{data:blocks,error:ble}]=await Promise.all([
    sb.from('school_question_bank_questions').select('id,question_text_en,question_text_as,correct_answer,explanation,variation_group,chapter_id,topic,subject_id,medium,marks,cognitive_level,difficulty').eq('teacher_id',current.id).eq('course_type','SCHOOL').in('id',wanted),
    sb.from('school_question_bank_options').select('question_id,display_order,option_label,option_text_en,option_text_as,is_correct').in('question_id',wanted).order('display_order'),
    sb.from('school_question_bank_blocks').select('question_id,block_order,block_type,text_en,text_as,image_url').in('question_id',wanted).order('block_order')
  ]);
  if(be)throw be;if(oe)throw oe;if(ble)throw ble;
  const optMap=new Map(),blockMap=new Map();
  (opts||[]).forEach(o=>{if(!optMap.has(o.question_id))optMap.set(o.question_id,[]);optMap.get(o.question_id).push(o)});
  (blocks||[]).forEach(b=>{if(!blockMap.has(b.question_id))blockMap.set(b.question_id,[]);blockMap.get(b.question_id).push(b)});
  const out=new Map();
  (bankRows||[]).forEach(q=>{
    const os=optMap.get(q.id)||[], labelMap=Object.fromEntries(os.map(o=>[o.option_label,o]));
    const getOpt=l=>{const o=labelMap[l];if(!o)return '';return lang==='AS'?(o.option_text_as||o.option_text_en||''):lang==='BOTH'?[o.option_text_en,o.option_text_as].filter(Boolean).join(' / '):(o.option_text_en||o.option_text_as||'')};
    const bs=blockMap.get(q.id)||[];
    const textFromBlocks=bs.filter(b=>b.block_type==='TEXT').map(b=>lang==='AS'?(b.text_as||b.text_en||''):lang==='BOTH'?[b.text_en,b.text_as].filter(Boolean).join('\n'):(b.text_en||b.text_as||'')).filter(Boolean).join('\n').trim();
    const text=textFromBlocks||(lang==='AS'?(q.question_text_as||q.question_text_en||''):lang==='BOTH'?[q.question_text_en,q.question_text_as].filter(Boolean).join('\n'):(q.question_text_en||q.question_text_as||''));
    const image=(bs.find(b=>b.block_type==='IMAGE')||{}).image_url||null;
    out.set(q.id,{assignment_id:null,question_text:image&&!text?'[IMAGE QUESTION]':text,option_a:image?'Option A':getOpt('A'),option_b:image?'Option B':getOpt('B'),option_c:image?'Option C':getOpt('C'),option_d:image?'Option D':getOpt('D'),correct_option:q.correct_answer,question_order:0,image_url:image,explanation:q.explanation||null,source_school_question_bank_id:q.id,source_variation_group:q.variation_group||null,source_chapter_id:q.chapter_id||null,source_topic:q.topic||null,source_subject:q.subject_id||null,source_medium:q.medium||null});
  });
  return out;
}
function adaptiveShuffle(arr){const a=[...(arr||[])];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
function adaptiveRecencyScore(ts){if(!ts)return 0;const days=Math.max(0,(Date.now()-new Date(ts).getTime())/86400000);return Math.max(0,30-days);}
async function getSchoolAdaptiveScheduled(studentIds){
  const ids=[...new Set((studentIds||[]).filter(Boolean))],result=new Map();ids.forEach(id=>result.set(id,new Set()));
  if(!ids.length)return result;
  const {data:links,error:le}=await sb.from('assignment_students').select('assignment_id,student_id').in('student_id',ids);if(le)throw le;
  const aids=[...new Set((links||[]).map(x=>x.assignment_id).filter(Boolean))];if(!aids.length)return result;
  const {data:ass,error:ae}=await sb.from('assignments').select('id,created_at').in('id',aids).eq('created_by',current.id);if(ae)throw ae;
  const valid=new Set((ass||[]).map(a=>a.id));
  const {data:qs,error:qe}=await sb.from('questions').select('assignment_id,source_school_question_bank_id').in('assignment_id',[...valid]).not('source_school_question_bank_id','is',null);if(qe)throw qe;
  const studentByAssignment=new Map();(links||[]).forEach(l=>{if(!valid.has(l.assignment_id))return;if(!studentByAssignment.has(l.assignment_id))studentByAssignment.set(l.assignment_id,new Set());studentByAssignment.get(l.assignment_id).add(l.student_id)});
  (qs||[]).forEach(q=>{const students=studentByAssignment.get(q.assignment_id)||[];students.forEach(sid=>{if(q.source_school_question_bank_id)result.get(sid)?.add(q.source_school_question_bank_id)})});
  return result;
}
function adaptiveTopicScores(candidates,perfRows){
  const byTopic=new Map();
  (perfRows||[]).forEach(p=>{const q=candidates.find(x=>x.id===p.source_school_question_bank_id);if(!q)return;const t=String(q.topic||'').trim()||'__NO_TOPIC__';const x=byTopic.get(t)||{attempts:0,wrong:0};x.attempts+=Number(p.attempt_count||0);x.wrong+=Number(p.wrong_count||0);byTopic.set(t,x)});
  const out=new Map();byTopic.forEach((v,k)=>out.set(k,v.attempts?Math.min(1,v.wrong/v.attempts):0));return out;
}
function selectSchoolAdaptiveQuestions(candidates,perfRows,scheduled,total,maxPercent){
  const perf=new Map((perfRows||[]).map(x=>[x.source_school_question_bank_id,x]));
  const attempted=new Set((perfRows||[]).map(x=>x.source_school_question_bank_id));
  const topicScores=adaptiveTopicScores(candidates,perfRows);
  const groups=new Map();candidates.forEach(q=>{const g=String(q.variation_group||'').trim().toLowerCase();if(g){if(!groups.has(g))groups.set(g,[]);groups.get(g).push(q)}});
  const adaptiveCandidates=[];const usedAdaptive=new Set();
  const wrongs=candidates.filter(q=>Number(perf.get(q.id)?.wrong_count||0)>0).sort((a,b)=>{
    const pa=perf.get(a.id)||{},pb=perf.get(b.id)||{};
    const sa=Number(pa.wrong_count||0)*100+adaptiveRecencyScore(pa.last_wrong_at)*2+(topicScores.get(String(a.topic||'').trim()||'__NO_TOPIC__')||0)*40;
    const sb=Number(pb.wrong_count||0)*100+adaptiveRecencyScore(pb.last_wrong_at)*2+(topicScores.get(String(b.topic||'').trim()||'__NO_TOPIC__')||0)*40;
    return sb-sa;
  });
  for(const wrong of wrongs){
    if(usedAdaptive.has(wrong.id))continue;
    const g=String(wrong.variation_group||'').trim().toLowerCase();
    let chosen=null;
    if(g){
      const alternatives=(groups.get(g)||[]).filter(q=>q.id!==wrong.id&&!usedAdaptive.has(q.id)&&!scheduled.has(q.id)).sort((a,b)=>{
        const pa=perf.get(a.id)||{},pb=perf.get(b.id)||{};
        return (Number(pa.attempt_count||0)-Number(pb.attempt_count||0)) || (Math.random()-.5);
      });
      chosen=alternatives[0]||null;
      if(!chosen){
        const fallback=(groups.get(g)||[]).filter(q=>q.id!==wrong.id&&!usedAdaptive.has(q.id)).sort((a,b)=>Number(perf.get(a.id)?.attempt_count||0)-Number(perf.get(b.id)?.attempt_count||0));
        chosen=fallback[0]||null;
      }
    }
    if(!chosen && !scheduled.has(wrong.id))chosen=wrong;
    if(!chosen)chosen=wrong;
    if(chosen&&!usedAdaptive.has(chosen.id)){adaptiveCandidates.push({q:chosen,reason:chosen.id===wrong.id?'PREVIOUSLY_WRONG':'PREVIOUSLY_WRONG_VARIATION',wrongSourceId:wrong.id,wrongCount:Number(perf.get(wrong.id)?.wrong_count||0)});usedAdaptive.add(chosen.id)}
  }
  const maxAdaptive=Math.min(Math.floor(total*Math.min(60,Math.max(0,Number(maxPercent||60)))/100),total);
  const selectedAdaptive=adaptiveCandidates.slice(0,maxAdaptive);
  const selectedIds=new Set(selectedAdaptive.map(x=>x.q.id));
  const freshUnseen=candidates.filter(q=>!selectedIds.has(q.id)&&!scheduled.has(q.id)&&!attempted.has(q.id));
  const freshAttempted=candidates.filter(q=>!selectedIds.has(q.id)&&!scheduled.has(q.id)&&attempted.has(q.id));
  const fallback=candidates.filter(q=>!selectedIds.has(q.id)&&scheduled.has(q.id));
  const normal=adaptiveShuffle(freshUnseen);
  adaptiveShuffle(freshAttempted).forEach(q=>normal.push(q));
  adaptiveShuffle(fallback).forEach(q=>normal.push(q));
  const selectedNormal=[];const usedGroups=new Set(selectedAdaptive.map(x=>String(x.q.variation_group||'').trim().toLowerCase()).filter(Boolean));
  for(const q of normal){if(selectedNormal.length+selectedAdaptive.length>=total)break;const g=String(q.variation_group||'').trim().toLowerCase();if(g&&usedGroups.has(g))continue;selectedNormal.push({q,reason:'NEW_OR_NORMAL'});if(g)usedGroups.add(g)}
  if(selectedAdaptive.length+selectedNormal.length<total){
    const remaining=adaptiveShuffle(candidates.filter(q=>!selectedIds.has(q.id)&&!selectedNormal.some(x=>x.q.id===q.id)));
    for(const q of remaining){if(selectedAdaptive.length+selectedNormal.length>=total)break;selectedNormal.push({q,reason:'FALLBACK_NORMAL'});}
  }
  return {selected:[...selectedAdaptive,...selectedNormal].slice(0,total),adaptiveCount:Math.min(selectedAdaptive.length,maxAdaptive),normalCount:Math.max(0,Math.min(total-selectedAdaptive.length,selectedNormal.length)),maxAdaptive};
}
async function saveAdaptiveSchoolAssignment(){
  if(!schoolTeacherMode)return false;
  const maxPercent=Math.min(60,Math.max(0,Number(document.getElementById('adaptiveMaxPercent')?.value||60)));
  const total=Number(document.getElementById('asqbTotal')?.value||assignmentSchoolQbSelected?.total||0);
  if(!total||total<1)return notify('For Adaptive Assignment, open the School Question Bank builder and enter the Total Questions.');
  if(!assignmentSchoolQbQuestions.length||assignmentSchoolQbMode!=='SCHOOL')return notify('Open “Build Assignment from School Question Bank”, select Subject, Medium and the required Chapter/Range first.');
  const candidates=assignmentSchoolQbAllowed().filter(q=>q&&q.id);
  if(!candidates.length)return notify('No School Question Bank questions are available in the selected range.');
  const lang=document.getElementById('asqbLang')?.value||assignmentSchoolQbSelected?.lang||'EN';
  let recipientInfo;try{recipientInfo=await getNewAssignmentRecipients();if(!recipientInfo.studentIds.length)return notify('Select at least one student.');}catch(e){return notify(e.message)}
  if(total>candidates.length)return notify(`Only ${candidates.length} questions are available in the selected range. Reduce the assignment size or select a wider range.`);
  const studentIds=[...new Set(recipientInfo.studentIds)];
  const [{data:perf,error:pe},scheduled]=await Promise.all([
    sb.from('school_student_question_performance').select('student_id,source_school_question_bank_id,attempt_count,wrong_count,correct_count,last_wrong_at,last_correct_at,last_attempted_at').in('student_id',studentIds),
    getSchoolAdaptiveScheduled(studentIds)
  ]);
  if(pe)return notify('Could not load student performance: '+pe.message);
  const perfByStudent=new Map();studentIds.forEach(id=>perfByStudent.set(id,(perf||[]).filter(x=>x.student_id===id)));
  const sourceIds=[...new Set(candidates.map(q=>q.id))];
  const snapshotMap=await loadSchoolAdaptiveSnapshots(sourceIds,lang);
  const videoUrl=(document.querySelector('input[name="assignmentType"]:checked')?.value||'video')==='video'?(document.getElementById('av')?.value.trim()||''):null;
  const title=String(document.getElementById('at')?.value||'').trim();if(!title)return notify('Enter an assignment title.');
  if(!videoUrl&&(document.querySelector('input[name="assignmentType"]:checked')?.value||'video')==='video')return notify('Enter the YouTube video URL for this video assignment.');
  const primaryClassId=document.getElementById('aMainGroup')?.value||recipientInfo.classIds[0];
  const primaryClass=(window._newAssignmentClasses||[]).find(c=>c.id===primaryClassId);
  const primarySubGroup=recipientInfo.schoolGroupNames?.length?recipientInfo.schoolGroupNames.join(', '):'';
  const batchId=crypto.randomUUID();
  const created=[];const errors=[];
  for(const studentId of studentIds){
    const perfRows=perfByStudent.get(studentId)||[];
    const picked=selectSchoolAdaptiveQuestions(candidates,perfRows,scheduled.get(studentId)||new Set(),total,maxPercent);
    if(picked.selected.length<total){errors.push(`${studentId}: only ${picked.selected.length}/${total} usable questions`);continue;}
    const subjectId=document.getElementById('asub')?.value||'';const subjectName=schoolSubjects.find(x=>String(x.id)===String(subjectId))?.name||'';if(schoolTeacherMode&&!subjectId)return notify('Select Subject.'); const {data:a,error:ae}=await sb.from('assignments').insert({class_id:primaryClassId,title,subject:schoolTeacherMode?subjectName:(document.getElementById('asub')?.value.trim()||''),school_subject_id:schoolTeacherMode?subjectId:null,description:document.getElementById('adesc')?.value.trim()||'',video_url:videoUrl,assignment_type:(document.querySelector('input[name="assignmentType"]:checked')?.value||'video')==='video'?'VIDEO':'MCQ',time_limit:null,shuffle_questions:false,shuffle_options:false,main_group:primaryClass?.name||'School Class',sub_group:primarySubGroup,created_by:current.id,adaptive_mode:true,adaptive_max_percent:Math.round(maxPercent),adaptive_batch_id:batchId,adaptive_for_student_id:studentId,adaptive_weakness_count:picked.adaptiveCount,adaptive_normal_count:picked.normalCount,adaptive_selection_summary:{total,maximum_adaptive_percent:maxPercent,adaptive_count:picked.adaptiveCount,normal_count:picked.normalCount,selected_range:[...assignmentSchoolQbLessons],subject:assignmentSchoolQbSubjectName,medium:assignmentSchoolQbMedium}}).select().single();
    if(ae){errors.push(`${studentId}: ${ae.message}`);continue;}
    const qs=picked.selected.map((item,i)=>{const q={...(snapshotMap.get(item.q.id)||{})};return {...q,assignment_id:a.id,question_order:i+1,adaptive_selection_reason:item.reason,adaptive_source_wrong_question_id:item.wrongSourceId||null,adaptive_source_wrong_count:item.wrongCount||0};});
    const {error:qe}=await sb.from('questions').insert(qs);
    if(qe){await sb.from('assignments').delete().eq('id',a.id);errors.push(`${studentId}: could not save questions — ${qe.message}`);continue;}
    const {error:re}=await sb.from('assignment_students').insert({assignment_id:a.id,student_id:studentId});
    if(re){await sb.from('questions').delete().eq('assignment_id',a.id);await sb.from('assignments').delete().eq('id',a.id);errors.push(`${studentId}: could not assign — ${re.message}`);continue;}
    created.push({id:a.id,studentId,adaptiveCount:picked.adaptiveCount,normalCount:picked.normalCount});
  }
  if(!created.length)return notify('No adaptive assignments were created. '+errors.join('\n'));
  notify(`Adaptive assignment created for ${created.length} student${created.length===1?'':'s'}.\n\nEach student received a personalized question set. Maximum adaptive/weakness questions: ${maxPercent}%.${errors.length?'\n\nSome students could not be created:\n'+errors.join('\n'):''}`);
  importedQuestions=[];importedAnswers={};importedExplanations={};importedSingleExcel=false;importedForNewAssignment=false;newAssignmentDraft=null;importedSolutionPdfPages=[];assignmentBankSelected.clear();assignmentBankCache=[];assignmentSchoolQbSelected=null;assignmentSchoolQbSubject='';assignmentSchoolQbMedium='';assignmentSchoolQbQuestions=[];assignmentSchoolQbChapters=[];assignmentSchoolQbFixedQuestions.clear();assignmentSchoolQbFixedGroups.clear();
  schoolAssignmentManagement();
  return true;
}
async function saveAssignment(){
 if(isAdaptiveSchoolAssignment())return saveAdaptiveSchoolAssignment();
 if(isAdaptiveJnvstAssignment())return saveAdaptiveJnvstAssignment();
 const type=document.querySelector('input[name="assignmentType"]:checked')?.value||"video";
 if(assignmentSchoolQbSelected?.ids?.length && (importedQuestions.length || document.querySelectorAll('.q').length || assignmentBankSelected.size)) {
   // A lesson-based Question Bank selection is the authoritative question source.
   // Automatically discard any manually entered/imported questions and any
   // separate Mock Test Question Bank selections instead of blocking save.
   importedQuestions=[];
   importedAnswers={};
   importedExplanations={};
   importedSingleExcel=false;
   importedForNewAssignment=false;
   importedSolutionPdfPages=[];
   assignmentBankSelected.clear();
   assignmentBankCache=[];
   assignmentBankFilters={part:'',topic:'',language:'',search:''};
   const manualQuestions=document.getElementById('qs');
   if(manualQuestions) manualQuestions.innerHTML='';
 }
 const videoUrl=type==="video"?(document.getElementById("av")?.value.trim()||""):null;
 if(!at.value.trim())return notify("Enter an assignment title.");
 if(type==="video"&&!videoUrl)return notify("Enter the YouTube video URL for this video assignment.");
 let recipientInfo;try{recipientInfo=await getNewAssignmentRecipients();if(!recipientInfo.studentIds.length)return notify("Select at least one student.");}catch(e){return notify(e.message)}
 const studentCount=recipientInfo.studentIds.length;
 const mockTime=null;
 const shuffleQuestions=false;
 const shuffleOptions=false;
 const assignmentType=type==="video"?"VIDEO":"MCQ";
 const primaryClassId=schoolTeacherMode?(document.getElementById("aMainGroup")?.value||recipientInfo.classIds[0]):recipientInfo.classIds[0];
 const jnvstMainId=document.getElementById("aMainGroup")?.value||"";
 const jnvstMainClass=(window._newAssignmentClasses||[]).find(c=>c.id===jnvstMainId);
 const selectedSubId=String(document.getElementById("aSubGroup")?.value||"").trim();
 const selectedSubClass=schoolTeacherMode
   ? null
   : (window._newAssignmentClasses||[]).find(c=>c.id===selectedSubId);
 const selectedRecipientClasses=(recipientInfo.classIds||[]).map(id=>(window._newAssignmentClasses||[]).find(c=>c.id===id)).filter(Boolean);
 const recipientSubNames=[...new Set(selectedRecipientClasses.filter(c=>isJnvstSubGroup(c)).map(c=>c.name))];
 const primaryMainGroup=schoolTeacherMode?(document.getElementById("aMainGroup")?.selectedOptions?.[0]?.textContent||"School Class"):(jnvstMainClass?.name||"JNVST Main Group");
 const primarySubGroup=schoolTeacherMode
   ? (recipientInfo.schoolGroupNames?.length?recipientInfo.schoolGroupNames.join(", "):"")
   : (selectedSubClass?.name|| (recipientSubNames.length===1?recipientSubNames[0]:recipientSubNames.length>1?"Multiple Sub-groups":""));
 const standardSubjectId=schoolTeacherMode?(document.getElementById("asub")?.value||""):null;const standardSubjectName=schoolTeacherMode?(schoolSubjects.find(x=>String(x.id)===String(standardSubjectId))?.name||""):(asub.value.trim()||"");if(schoolTeacherMode&&!standardSubjectId)return notify("Select Subject.");const {data:a,error}=await sb.from("assignments").insert({class_id:primaryClassId,title:at.value.trim(),subject:standardSubjectName,school_subject_id:standardSubjectId||null,description:adesc.value.trim(),video_url:videoUrl,assignment_type:assignmentType,time_limit:mockTime,shuffle_questions:shuffleQuestions,shuffle_options:shuffleOptions,main_group:primaryMainGroup,sub_group:primarySubGroup,created_by:current.id}).select().single();if(error)return notify(error.message);
 let qs=[];
 if(importedForNewAssignment&&importedQuestions.length){
   const imageMode=importedQuestions.some(q=>q.image_mode);
   if(importedSolutionPdfPages.length && importedSolutionPdfPages.length!==importedQuestions.length){await sb.from("assignments").delete().eq("id",a.id);return notify(`Solution PDF page count (${importedSolutionPdfPages.length}) must exactly match the Questions PDF page count (${importedQuestions.length}).`)}
   qs=importedQuestions.map((q,i)=>{const n=importedSingleExcel?(q.sourceNo||i+1):(i+1);return {assignment_id:a.id,question_text:imageMode?"[IMAGE QUESTION]":q.question.trim(),option_a:imageMode?"Option A":q.A,option_b:imageMode?"Option B":q.B,option_c:imageMode?"Option C":q.C,option_d:imageMode?"Option D":q.D,correct_option:importedAnswers[n],explanation:importedExplanations[n]||null,question_order:i+1,image_url:imageMode?q.image_data:null,solution_image_url:null}});
   if(importedSolutionPdfPages.length){
     try{
       for(let i=0;i<importedSolutionPdfPages.length;i++){
         const path=`${current.id}/${a.id}/solution-${i+1}-${crypto.randomUUID()}.jpg`;
         const blob=await (await fetch(importedSolutionPdfPages[i].image_data)).blob();
         const {error:ue}=await sb.storage.from("assignment-solution-images").upload(path,blob,{contentType:"image/jpeg",upsert:false});
         if(ue)throw ue;
         qs[i].solution_image_url=sb.storage.from("assignment-solution-images").getPublicUrl(path).data.publicUrl;
       }
     }catch(solutionError){await sb.from("assignments").delete().eq("id",a.id);return notify("Could not upload solution images: "+solutionError.message)}
   }
 }else{
   qs=[...document.querySelectorAll(".q")].map((b,i)=>({assignment_id:a.id,question_text:b.querySelector(".qt").value.trim(),option_a:b.querySelector(".oa").value,option_b:b.querySelector(".ob").value,option_c:b.querySelector(".oc").value,option_d:b.querySelector(".od").value,correct_option:b.querySelector(".co").value,question_order:i+1})).filter(q=>q.question_text);
 }
 // Add generated Question Bank questions as immutable assignment snapshots.
 if(assignmentSchoolQbSelected?.ids?.length){
   const ids=assignmentSchoolQbSelected.ids;
   if((assignmentSchoolQbSelected.course_type||'')==='JNVST'){
     const {data:bankRows,error:be}=await sb.from('mock_question_bank').select('id,question_text,option_a,option_b,option_c,option_d,correct_option,passage_text,image_url,topic,language,passage_id,passage_title,question_order,variation_group,subject_id,lesson_id').eq('teacher_id',current.id).eq('active',true).in('id',ids);
     if(be){await sb.from('assignments').delete().eq('id',a.id);return notify('Could not load JNVST Question Bank questions: '+be.message)}
     const byId=new Map((bankRows||[]).map(x=>[x.id,x]));
     ids.forEach(id=>{const q=byId.get(id);if(!q)return;qs.push({assignment_id:a.id,question_text:q.image_url?'[IMAGE QUESTION]':(q.question_text||''),option_a:q.image_url?'Option A':q.option_a,option_b:q.image_url?'Option B':q.option_b,option_c:q.image_url?'Option C':q.option_c,option_d:q.image_url?'Option D':q.option_d,correct_option:q.correct_option,question_order:qs.length+1,image_url:q.image_url||null,explanation:null,source_mock_question_id:q.id,source_variation_group:q.variation_group||null,source_topic:q.topic||null});});
   }else{
     const {data:bankRows,error:be}=await sb.from('school_question_bank_questions').select('id,question_text_en,question_text_as,question_type,marks,correct_answer,explanation,variation_group,chapter_id,topic,subject_id,medium,has_images,jnvst_subject_id,jnvst_lesson_id').eq('teacher_id',current.id).eq('course_type','SCHOOL').in('id',ids);
     if(be){await sb.from('assignments').delete().eq('id',a.id);return notify('Could not load School Course Question Bank questions: '+be.message)}
     const {data:opts,error:oe}=await sb.from('school_question_bank_options').select('question_id,display_order,option_label,option_text_en,option_text_as,is_correct').in('question_id',ids).order('display_order');
     if(oe){await sb.from('assignments').delete().eq('id',a.id);return notify('Could not load School Course Question Bank options: '+oe.message)}
     const {data:blocks,error:be2}=await sb.from('school_question_bank_blocks').select('question_id,block_order,block_type,text_en,text_as,image_url').in('question_id',ids).order('block_order');
     if(be2){await sb.from('assignments').delete().eq('id',a.id);return notify('Could not load School Course Question Bank content: '+be2.message)}
     const byId=new Map((bankRows||[]).map(x=>[x.id,x])), optMap=new Map(), blockMap=new Map();
     (opts||[]).forEach(o=>{if(!optMap.has(o.question_id))optMap.set(o.question_id,[]);optMap.get(o.question_id).push(o)});
     (blocks||[]).forEach(b=>{if(!blockMap.has(b.question_id))blockMap.set(b.question_id,[]);blockMap.get(b.question_id).push(b)});
     const lang=assignmentSchoolQbSelected.lang||'EN';
     ids.forEach(id=>{const q=byId.get(id);if(!q)return;const bs=blockMap.get(id)||[];const textFromBlocks=bs.filter(b=>b.block_type==='TEXT').map(b=>lang==='AS'?(b.text_as||b.text_en||''):lang==='BOTH'?[b.text_en,b.text_as].filter(Boolean).join('\n'):(b.text_en||b.text_as||'')).filter(Boolean).join('\n').trim();const text=textFromBlocks||assignmentSchoolQbQuestionText(q,lang);const os=optMap.get(id)||[];const labelMap={};os.forEach(o=>labelMap[o.option_label]=o);const getOpt=l=>{const o=labelMap[l];if(!o)return '';return lang==='AS'?(o.option_text_as||o.option_text_en||''):lang==='BOTH'?[o.option_text_en,o.option_text_as].filter(Boolean).join(' / '):(o.option_text_en||o.option_text_as||'')};const image=(bs.find(b=>b.block_type==='IMAGE')||{}).image_url||null;qs.push({assignment_id:a.id,question_text:image&&!text?'[IMAGE QUESTION]':text,option_a:getOpt('A'),option_b:getOpt('B'),option_c:getOpt('C'),option_d:getOpt('D'),correct_option:q.correct_answer,question_order:qs.length+1,image_url:image,explanation:q.explanation||null,source_school_question_bank_id:q.id,source_variation_group:q.variation_group||null,source_chapter_id:q.chapter_id,source_topic:q.topic||null,source_subject:q.subject_id||null,source_medium:q.medium||null});});
   }
 }
 // Add selected Mock Test Question Bank questions as immutable assignment snapshots.
 if(assignmentBankSelected.size){
   const selectedIds=[...assignmentBankSelected];
   const {data:bankRows,error:be}=await sb.from('mock_question_bank').select('id,question_text,option_a,option_b,option_c,option_d,correct_option,passage_text,image_url,topic,language,passage_id,passage_title,question_order').eq('teacher_id',current.id).in('id',selectedIds);
   if(be){await sb.from('assignments').delete().eq('id',a.id);return notify('Could not load selected Question Bank questions: '+be.message)}
   const byId=new Map((bankRows||[]).map(x=>[x.id,x]));
   selectedIds.forEach(id=>{const q=byId.get(id);if(!q)return;qs.push({assignment_id:a.id,question_text:q.image_url?'[IMAGE QUESTION]':(q.question_text||''),option_a:q.image_url?'Option A':q.option_a,option_b:q.image_url?'Option B':q.option_b,option_c:q.image_url?'Option C':q.option_c,option_d:q.image_url?'Option D':q.option_d,correct_option:q.correct_option,question_order:qs.length+1,image_url:q.image_url||null,explanation:null,source_mock_question_id:q.id});});
 }
 // Ensure a stable order and do not let mixed-source questions collide on question_order.
 qs=qs.map((q,i)=>({...q,question_order:i+1}));
 if(!qs.length){await sb.from("assignments").delete().eq("id",a.id);return notify("Add at least one question.")}
 const {error:e}=await sb.from("questions").insert(qs);if(e){await sb.from("assignments").delete().eq("id",a.id);return notify(e.message)}
 try{const rows=recipientInfo.studentIds.map(student_id=>({assignment_id:a.id,student_id}));const {error:re}=await sb.from("assignment_students").insert(rows);if(re)throw re}catch(e){await sb.from("questions").delete().eq("assignment_id",a.id);await sb.from("assignments").delete().eq("id",a.id);return notify("Assignment could not be assigned: "+e.message)}
 notify(`${type==="video"?"Video":"No-video"} assignment created and assigned to ${studentCount} student${studentCount===1?"":"s"}.`);
 importedQuestions=[];importedAnswers={};importedExplanations={};importedSingleExcel=false;importedForNewAssignment=false;newAssignmentDraft=null;importedSolutionPdfPages=[];assignmentBankSelected.clear();assignmentBankCache=[];assignmentBankFilters={part:'',topic:'',language:'',search:''};assignmentSchoolQbSelected=null;assignmentSchoolQbSubject='';assignmentSchoolQbMedium='';assignmentSchoolQbQuestions=[];assignmentSchoolQbChapters=[];assignmentSchoolQbFixedQuestions.clear();assignmentSchoolQbFixedGroups.clear();
 teacherHome()
}
function startBulkImportFromNewAssignment(){
 newAssignmentDraft={
  type:document.querySelector('input[name="assignmentType"]:checked')?.value||"video",
  classIds:[...document.querySelectorAll('.newassign-class:checked')].map(x=>x.value),
  classId:document.querySelector('.newassign-class:checked')?.value||"",
  assignMode:document.querySelector('input[name="assignMode"]:checked')?.value||"class",
  selectedStudents:[...document.querySelectorAll(".newassign-student:checked")].map(x=>x.value),
  mainGroup:document.getElementById("aMainGroup")?.value||(schoolTeacherMode?"":"JNVST-VI"),
  subGroup:([...(document.querySelectorAll(".schoolassign-subgroup:checked")||[])].map(x=>x.value)).join(","),
  title:document.getElementById("at")?.value||"",
  subject:document.getElementById("asub")?.value||"",
  video:document.getElementById("av")?.value||"",
  description:document.getElementById("adesc")?.value||"",
  schoolAssignmentMode:document.querySelector('input[name="schoolAssignmentMode"]:checked')?.value||"standard",
  adaptiveMaxPercent:document.getElementById("adaptiveMaxPercent")?.value||"60",
  selectedBankQuestionIds:[...assignmentBankSelected], subject_id:document.getElementById('asub')?.value||'', schoolQbSelection:assignmentSchoolQbSelected ? {...assignmentSchoolQbSelected,subject:assignmentSchoolQbSubject,subject_name:assignmentSchoolQbSubjectName,medium:assignmentSchoolQbMedium} : null
 };
 importedForNewAssignment=true;
 bulkImportMCQs();
}
async function bulkImportMCQs(){
 importedQuestions=[];importedAnswers={};importedExplanations={};importedSingleExcel=false;importedSolutionPdfPages=[];
 render(`<div class="wrap">${header("Import MCQs")}<div class="card">
 <h2>Choose an upload method</h2>
 <p class="muted">You can use either method. Method 1 keeps the existing PDF + Excel workflow. Method 2 treats every PDF page as an image, so Assamese and other non-Latin text is displayed exactly as it appears in the PDF.</p>
 <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
  <div class="card" style="border:2px solid #2563eb;background:#f8fbff">
   <span class="tag">METHOD 1</span><h3>PDF + Excel Answer Key</h3>
   <p class="small muted">PDF: one question per page. Excel: Question No + Correct Option + Explanation (optional).</p>
   <label>Questions PDF</label><input id="qpdf" type="file" accept=".pdf" onchange="readMCQPdf(event)">
   <label>MAT Answer & Metadata Excel</label><input id="akey" type="file" accept=".xlsx,.xls" onchange="readAnswerExcel(event)"><div class="small muted">Columns: <b>Question No</b>, <b>Correct Option</b>, <b>Explanation</b> (optional)</div>
  </div>
  <div class="card" style="border:2px solid #16a34a;background:#f7fff9">
   <span class="tag" style="background:#dcfce7;color:#166534">METHOD 2 — RECOMMENDED FOR ASSAMESE</span>
   <h3>PDF — Image per Page</h3>
   <p class="small muted">Each page becomes an image. No OCR is used, so Assamese text, special symbols, fractions and mathematical notation remain visually correct.</p>
   <label>Questions PDF</label><input id="imagePdf" type="file" accept=".pdf" onchange="readImagePdf(event)">
   <label>MAT Answer & Metadata Excel (optional)</label><input id="imageAkey" type="file" accept=".xlsx,.xls" onchange="readAnswerExcel(event)">
   <label style="margin-top:12px">Solution PDF (optional — 1 solution page per question)</label><input id="imageSolutionPdf" type="file" accept=".pdf" onchange="readImageSolutionPdf(event)">
   <div class="small muted" style="margin-top:5px">Each solution PDF page becomes a cropped image. Page 1 → Question 1, Page 2 → Question 2, etc. The solution PDF must have the same number of pages as the Questions PDF.</div>
   <div id="imageSolutionPreview"></div>
   <div class="notice small">Excel is optional. If provided, use Question No + Correct Option + Explanation (optional). Otherwise choose the correct answer (A/B/C/D) on the next screen.</div>
  </div>
  <div class="card" style="border:2px solid #7c3aed;background:#faf7ff">
   <span class="tag" style="background:#ede9fe;color:#6d28d9">METHOD 3</span>
   <h3>Excel Questions + Separate Answer Key</h3>
   <p class="small muted">Questions Excel contains the question and options. A separate MAT Answer & Metadata Excel contains Correct Option + Explanation (optional).</p>
   <label>Questions Excel</label><input id="qexcel" type="file" accept=".xlsx,.xls" onchange="readQuestionExcel(event)">
   <label>MAT Answer & Metadata Excel</label><input id="qexcelKey" type="file" accept=".xlsx,.xls" onchange="readAnswerExcel(event)">
   <div class="notice small">Questions columns: <b>Question No, Question, Option A, Option B, Option C, Option D</b>. Answer Key columns: <b>Question No, Correct Option, Explanation</b>.</div>
  </div>
  <div class="card" style="border:2px solid #ea580c;background:#fffaf5">
   <span class="tag" style="background:#ffedd5;color:#c2410c">METHOD 4</span>
   <h3>Excel — Complete Question File</h3>
   <p class="small muted">One Excel file contains the question, four options, correct answer and optional explanation. No separate Answer Key file is needed.</p>
   <label>Complete Questions Excel</label><input id="completeQexcel" type="file" accept=".xlsx,.xls" onchange="readCompleteQuestionExcel(event)">
   <div class="notice small">Columns: <b>Question No, Question, Option A, Option B, Option C, Option D, Correct Option, Explanation</b>. Explanation is optional.</div>
  </div>
 </div>
 <div id="mcqPreview"></div>
 <div class="actions"><button onclick="showImportedMCQs()">Preview / Continue</button><button class="secondary" onclick="teacherHome()">← Home</button><button class="secondary" onclick="goBack()">← Back</button></div>
 </div></div>`)
}
async function getPdfJs(){
 const mod=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
 mod.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
 return mod;
}
async function readMCQPdf(ev){
 const file=ev.target.files?.[0];if(!file)return;
 const box=document.getElementById("mcqPreview");box.innerHTML=message("Reading PDF text…",true);
 try{
  const buf=await file.arrayBuffer(),pdfjs=await getPdfJs(),pdf=await pdfjs.getDocument({data:buf}).promise,arr=[];
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p),content=await page.getTextContent();
   const text=content.items.map(i=>i.str).join(" ");arr.push(parseQuestionText(text,p));
  }
  importedQuestions=arr;box.innerHTML=message(`Read ${arr.length} question pages.`,true)
 }catch(e){box.innerHTML=message("PDF reading failed: "+(e.message||e))}
}
function cropWhiteMargins(sourceCanvas){
 const ctx=sourceCanvas.getContext("2d",{willReadFrequently:true}); const w=sourceCanvas.width,h=sourceCanvas.height;
 const data=ctx.getImageData(0,0,w,h).data; const threshold=248; let minX=w,minY=h,maxX=-1,maxY=-1;
 for(let y=0;y<h;y++){ for(let x=0;x<w;x++){ const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3]; if(a>10&&(r<threshold||g<threshold||b<threshold)){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;} } }
 if(maxX<0)return sourceCanvas; const pad=Math.max(12,Math.round(Math.min(w,h)*.018)); minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(w-1,maxX+pad);maxY=Math.min(h-1,maxY+pad);
 const out=document.createElement("canvas");out.width=maxX-minX+1;out.height=maxY-minY+1;out.getContext("2d").drawImage(sourceCanvas,minX,minY,out.width,out.height,0,0,out.width,out.height);return out;
}
async function readImagePdf(ev){
 const file=ev.target.files?.[0];if(!file)return;
 const box=document.getElementById("mcqPreview");box.innerHTML=message("Converting PDF pages to images…",true);
 try{
  const buf=await file.arrayBuffer(),pdfjs=await getPdfJs(),pdf=await pdfjs.getDocument({data:buf}).promise,arr=[];
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p);
   const base=page.getViewport({scale:1});
   const maxWidth=1600;
   const scale=Math.min(2.2,Math.max(1.4,maxWidth/base.width));
   const viewport=page.getViewport({scale});
   const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{alpha:false});
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   await page.render({canvasContext:ctx,viewport}).promise;
   // Crop large white PDF margins before storing the question image.
   const cropped=cropWhiteMargins(canvas);
   const imageData=cropped.toDataURL("image/jpeg",0.92);
   arr.push({page:p,image_data:imageData,question:"",A:"",B:"",C:"",D:"",image_mode:true});
  }
  importedQuestions=arr;importedAnswers={};importedExplanations={};
  box.innerHTML=message(`Converted ${arr.length} PDF page${arr.length===1?"":"s"} to question images. Click Preview / Continue to set the answer key.`,true)
 }catch(e){box.innerHTML=message("PDF image conversion failed: "+(e.message||e))}
}
async function readImageSolutionPdf(ev){
 const file=ev.target.files?.[0];if(!file)return;
 const box=document.getElementById("imageSolutionPreview");if(!box)return;
 box.innerHTML=message("Converting solution PDF pages to cropped images…",true);
 try{
  const pdfjs=await getPdfJs(),pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise,arr=[];
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p);
   const base=page.getViewport({scale:1});
   const maxWidth=1800;
   const scale=Math.min(2.5,Math.max(1.6,maxWidth/base.width));
   const viewport=page.getViewport({scale});
   const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d",{alpha:false});
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
   await page.render({canvasContext:ctx,viewport}).promise;
   const cropped=cropWhiteMargins(canvas);
   arr.push({page:p,image_data:cropped.toDataURL("image/jpeg",0.93)});
  }
  importedSolutionPdfPages=arr;
  const qCount=importedQuestions.length;
  const mismatch=qCount>0 && qCount!==arr.length;
  box.innerHTML=`<div class="${mismatch?'notice':'success'}">Prepared <b>${arr.length}</b> solution page(s) as cropped images.${mismatch?` <b>Warning:</b> Questions PDF currently has ${qCount} page(s), so the counts do not match.`:""}</div>
   <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px">${arr.slice(0,8).map(x=>`<div style="border:1px solid #dbe3ee;border-radius:10px;padding:6px;background:#fff"><img src="${x.image_data}" style="width:100%;display:block;border-radius:7px"><div class="small muted" style="text-align:center;margin-top:4px">Solution ${x.page}</div></div>`).join("")}</div>`;
 }catch(e){importedSolutionPdfPages=[];box.innerHTML=message("Solution PDF conversion failed: "+(e.message||e));}
}
function parseQuestionText(text,pageNo){
 const clean=text.replace(/\s+/g," ").trim();
 const qmatch=clean.match(/^(?:Question\s*\d+\s*[:.)-]?\s*)?(.*?)(?=\s+A[.)]\s)/i);
 const q=qmatch?qmatch[1].trim():clean;
 const parts=clean.split(/\s+(?=[A-D][.)]\s)/i),opts={A:"",B:"",C:"",D:""};
 parts.forEach(part=>{const m=part.match(/^([A-D])[.)]\s*(.*)$/i);if(m)opts[m[1].toUpperCase()]=m[2].trim()});
 return {page:pageNo,question:q,A:opts.A,B:opts.B,C:opts.C,D:opts.D,image_mode:false}
}
function readAnswerExcel(ev){
 const file=ev.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=e=>{try{
  const wb=XLSX.read(e.target.result,{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:""});importedAnswers={};importedExplanations={};
  rows.forEach(x=>{const n=Number(x["Question No"]??x["Question Number"]??x.No),a=String(x["Correct Option"]??x.Answer??"").trim().toUpperCase(),ex=String(x["Explanation"]??x["Explanation Text"]??x["Solution Explanation"]??"").trim();if(n&&["A","B","C","D"].includes(a)){importedAnswers[n]=a;if(ex)importedExplanations[n]=ex}});
  document.getElementById("mcqPreview").innerHTML=message(`Loaded ${Object.keys(importedAnswers).length} answer keys${Object.keys(importedExplanations).length?` and ${Object.keys(importedExplanations).length} explanations`:"."}`,true)
 }catch(err){document.getElementById("mcqPreview").innerHTML=message("Could not read answer Excel: "+err.message)}};r.readAsArrayBuffer(file)
}
function readQuestionExcel(ev){
 const file=ev.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=e=>{try{
  const wb=XLSX.read(e.target.result,{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:""});
  const norm=v=>String(v??"").trim(),find=(row,names)=>{for(const n of names){if(row[n]!==undefined)return norm(row[n])}return ""};
  importedQuestions=rows.map((x,i)=>({page:i+1,question:find(x,["Question","Question Text","question_text"]),A:find(x,["Option A","A"]),B:find(x,["Option B","B"]),C:find(x,["Option C","C"]),D:find(x,["Option D","D"]),image_mode:false})).filter(q=>q.question||q.A||q.B||q.C||q.D);
  if(!importedQuestions.length)throw new Error("No question rows found.");
  document.getElementById("mcqPreview").innerHTML=message(`Loaded ${importedQuestions.length} questions from Excel. Now load the separate MAT Answer & Metadata Excel.`,true);
 }catch(err){document.getElementById("mcqPreview").innerHTML=message("Could not read Questions Excel: "+err.message)}};r.readAsArrayBuffer(file)
}
function readCompleteQuestionExcel(ev){
 const file=ev.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=e=>{try{
  const wb=XLSX.read(e.target.result,{type:"array"}),ws=wb.Sheets[wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:""});
  const norm=v=>String(v??"").trim(),find=(row,names)=>{for(const n of names){if(row[n]!==undefined)return norm(row[n])}return ""};
  importedQuestions=[];importedAnswers={};importedExplanations={};importedSingleExcel=true;
  rows.forEach((x,i)=>{const qno=Number(find(x,["Question No","Question Number","No"]))||i+1;const q={page:i+1,sourceNo:qno,question:find(x,["Question","Question Text","question_text"]),A:find(x,["Option A","A"]),B:find(x,["Option B","B"]),C:find(x,["Option C","C"]),D:find(x,["Option D","D"]),image_mode:false};if(q.question||q.A||q.B||q.C||q.D){importedQuestions.push(q);const a=find(x,["Correct Option","Correct Answer","Answer","correct_option"]).toUpperCase();const ex=find(x,["Explanation","Explanation Text","Solution Explanation","explanation"]);if(["A","B","C","D"].includes(a))importedAnswers[qno]=a;if(ex)importedExplanations[qno]=ex;}});
  if(!importedQuestions.length)throw new Error("No question rows found.");
  const missing=importedQuestions.filter(q=>!importedAnswers[q.sourceNo]).length;
  document.getElementById("mcqPreview").innerHTML=message(`Loaded ${importedQuestions.length} complete question rows from one Excel file${missing?`. ${missing} missing correct answer${missing===1?"":"s"}.`:" with answer keys and optional explanations."}`,true);
 }catch(err){document.getElementById("mcqPreview").innerHTML=message("Could not read Complete Questions Excel: "+err.message)}};r.readAsArrayBuffer(file)
}
function showImportedMCQs(){
 if(!importedQuestions.length)return notify("Upload the questions PDF or Excel file first.");
 const imageMode=importedQuestions.some(q=>q.image_mode);
 if(!Object.keys(importedAnswers).length)return notify(importedSingleExcel?"No valid Correct Option values were found in the Complete Questions Excel.":"Upload and read the separate answer-key Excel first.");
 render(`<div class="wrap">${header(imageMode?"Review Question Images":"Review Imported MCQs")}<div class="card">
  <div class="${imageMode?"success":((importedQuestions.filter((q,i)=>!importedAnswers[importedSingleExcel?(q.sourceNo||i+1):i+1]).length||importedQuestions.filter(q=>!q.question||!q.A||!q.B||!q.C||!q.D).length)?"notice":"success")}">
   ${imageMode?`${importedQuestions.length} question images ready. Select the correct answer for every question below.`:`${importedQuestions.length} questions found. ${importedQuestions.filter((q,i)=>!importedAnswers[importedSingleExcel?(q.sourceNo||i+1):i+1]).length} missing answers; ${importedQuestions.filter(q=>!q.question||!q.A||!q.B||!q.C||!q.D).length} pages need manual checking.`}
  </div>
  <div id="importReview">${importedQuestions.map((q,i)=>imageMode?`<div class="assignment">
    <h3>Question ${i+1}</h3><div class="question-image-wrap"><img class="question-image" src="${q.image_data}" alt="Question ${i+1}"></div>
    <p><b>Correct answer:</b></p><div class="actions">${["A","B","C","D"].map(o=>`<button type="button" class="answer-key-btn ${importedAnswers[importedSingleExcel?(q.sourceNo||i+1):i+1]===o?"selected-key":""}" onclick="setImportedAnswer(${importedSingleExcel?(q.sourceNo||i+1):i+1},'${o}')">${o}</button>`).join("")}</div>${importedExplanations[importedSingleExcel?(q.sourceNo||i+1):i+1]?`<div class="notice" style="margin-top:10px"><b>Explanation:</b> ${esc(importedExplanations[importedSingleExcel?(q.sourceNo||i+1):i+1])}</div>`:""}
   </div>`:`<div class="assignment"><b>${i+1}. ${esc(q.question)}</b><p>A. ${esc(q.A)}</p><p>B. ${esc(q.B)}</p><p>C. ${esc(q.C)}</p><p>D. ${esc(q.D)}</p><span class="tag">Answer: ${esc(importedAnswers[importedSingleExcel?(q.sourceNo||i+1):i+1]||"MISSING")}</span>${importedExplanations[importedSingleExcel?(q.sourceNo||i+1):i+1]?`<div class="notice" style="margin-top:10px"><b>Explanation:</b> ${esc(importedExplanations[importedSingleExcel?(q.sourceNo||i+1):i+1])}</div>`:""}</div>`).join("")}</div>
  <div class="actions"><button onclick="${importedForNewAssignment?'returnImportedToNewAssignment()':'saveImportedMCQs()'}">${importedForNewAssignment?'Use These Questions in This Assignment':'Use These MCQs in New Assignment'}</button><button class="secondary" onclick="bulkImportMCQs()">← Choose Another Method</button><button class="secondary" onclick="teacherHome()">← Home</button></div>
 </div></div>`)
}
function setImportedAnswer(n,opt){importedAnswers[n]=opt;showImportedMCQs()}
function returnImportedToNewAssignment(){
 if(!importedQuestions.length)return notify("No imported questions are available.");
 const missing=importedQuestions.map((q,i)=>importedSingleExcel?(q.sourceNo||i+1):(i+1)).filter(n=>!importedAnswers[n]);
 if(missing.length)return notify("Please select the correct answer for question(s): "+missing.join(", "));
 if(importedSolutionPdfPages.length && importedSolutionPdfPages.length!==importedQuestions.length)return notify(`Solution PDF page count (${importedSolutionPdfPages.length}) must exactly match the Questions PDF page count (${importedQuestions.length}).`);
 const imageMode=importedQuestions.some(q=>q.image_mode);
 if(!imageMode){const invalid=importedQuestions.filter(q=>!q.question||!q.A||!q.B||!q.C||!q.D);if(invalid.length)return notify("Some questions are incomplete. Please check the imported file.")}
 newAssignment();
}
async function saveImportedMCQs(){
 const imageMode=importedQuestions.some(q=>q.image_mode);
 const missing=importedQuestions.map((q,i)=>importedSingleExcel?(q.sourceNo||i+1):(i+1)).filter(n=>!importedAnswers[n]);
 if(missing.length)return notify("Please select the correct answer for question(s): "+missing.join(", "));
 if(importedSolutionPdfPages.length && importedSolutionPdfPages.length!==importedQuestions.length)return notify(`Solution PDF page count (${importedSolutionPdfPages.length}) must exactly match the Questions PDF page count (${importedQuestions.length}).`);
 if(!imageMode){const invalid=importedQuestions.filter(q=>!q.question||!q.A||!q.B||!q.C||!q.D);if(invalid.length)return notify("Some PDF pages could not be read correctly. Use the Image per Page method for those questions.")}
 const {data:classes}=await sb.from("classes").select("id,name").eq("teacher_id",current.id).order("name");if(!classes?.length){notify("Create a class first.");return newClass()}
 render(`<div class="wrap">${header("Create Assignment from Imported MCQs")}<div class="card"><label>Class</label><select id="iac" onchange="loadImportedAssignmentStudents(this.value)">${classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
 <div class="card" style="background:#f8fafc"><h3>Assign To</h3><label><input type="radio" name="importAssignMode" value="class" checked onchange="toggleImportedAssignmentStudents()" style="width:auto;margin-right:8px">Entire class</label><label><input type="radio" name="importAssignMode" value="students" onchange="toggleImportedAssignmentStudents()" style="width:auto;margin-right:8px">Selected students</label><div id="importStudentPicker" class="small muted">The assignment will be given to all students in the selected class.</div></div>
 <label>Assignment title</label><input id="iat" placeholder="Lesson title"><label>Subject</label><input id="ias"><label>YouTube video URL (optional)</label><input id="iav" placeholder="Leave blank for a no-video assignment"><div class="small muted">Leave blank for a no-video assignment. If supplied, students watch the lesson before answering.</div><label>Description</label><textarea id="iad"></textarea>
 <div class="success small">Image-based questions will be shown exactly as they appear in the PDF. Students answer using A, B, C or D.</div>
 <div class="actions"><button onclick="finishImportedAssignment()">Create & Assign Assignment</button><button class="secondary" onclick="teacherHome()">Cancel</button></div></div></div>`);loadImportedAssignmentStudents(classes[0].id)
}
async function loadImportedAssignmentStudents(classId){
 const box=document.getElementById("importStudentPicker");if(!box)return;if(document.querySelector('input[name="importAssignMode"]:checked')?.value!=="students"){box.innerHTML='<div class="small muted">The assignment will be given to all students in the selected class.</div>';return}
 box.innerHTML='<div class="small muted">Loading students...</div>';const {data:members,error}=await sb.from("class_students").select("student_id").eq("class_id",classId);if(error){box.innerHTML=message(error.message);return}
 const ids=(members||[]).map(x=>x.student_id);if(!ids.length){box.innerHTML='<div class="notice">No students are currently in this class.</div>';return}
 const {data:students,error:e}=await sb.from("profiles").select("id,full_name,username").in("id",ids).order("full_name");if(e){box.innerHTML=message(e.message);return}
 box.innerHTML=(students||[]).map(s=>`<label style="display:block;padding:6px 0"><input class="import-assignment-student" type="checkbox" value="${s.id}" style="width:auto;margin-right:8px">${esc(s.full_name)} <span class="muted small">${esc(s.username||"")}</span></label>`).join("")||'<div class="notice">No student profiles found.</div>'
}
function toggleImportedAssignmentStudents(){const mode=document.querySelector('input[name="importAssignMode"]:checked')?.value;if(mode==="students")loadImportedAssignmentStudents(document.getElementById("iac").value);else{const box=document.getElementById("importStudentPicker");if(box)box.innerHTML='<div class="small muted">The assignment will be given to all students in the selected class.</div>'}}
async function getImportedStudentIds(classId){const {data:members,error}=await sb.from("class_students").select("student_id").eq("class_id",classId);if(error)throw error;if(document.querySelector('input[name="importAssignMode"]:checked')?.value==="students")return [...document.querySelectorAll(".import-assignment-student:checked")].map(x=>x.value);return (members||[]).map(x=>x.student_id)}
async function finishImportedAssignment(){
 if(!iat.value.trim())return notify("Enter an assignment title.");let studentIds;try{studentIds=await getImportedStudentIds(iac.value);if(!studentIds.length)return notify("Select at least one student or add students to this class.")}catch(e){return notify(e.message)}
 const {data:a,error}=await sb.from("assignments").insert({class_id:iac.value,title:iat.value.trim(),subject:ias.value.trim(),description:iad.value.trim(),video_url:iav.value.trim()||null,created_by:current.id}).select().single();if(error)return notify(error.message);
 const imageMode=importedQuestions.some(q=>q.image_mode);
 const qs=importedQuestions.map((q,i)=>({assignment_id:a.id,question_text:imageMode?"[IMAGE QUESTION]":q.question,option_a:imageMode?"Option A":q.A,option_b:imageMode?"Option B":q.B,option_c:imageMode?"Option C":q.C,option_d:imageMode?"Option D":q.D,correct_option:importedAnswers[importedSingleExcel?(q.sourceNo||i+1):(i+1)],explanation:importedExplanations[importedSingleExcel?(q.sourceNo||i+1):(i+1)]||null,question_order:i+1,image_url:imageMode?q.image_data:null,solution_image_url:null}));
 if(importedSolutionPdfPages.length){
   for(let i=0;i<importedSolutionPdfPages.length;i++){
     const path=`${current.id}/${a.id}/solution-${i+1}-${crypto.randomUUID()}.jpg`;
     const blob=await (await fetch(importedSolutionPdfPages[i].image_data)).blob();
     const {error:ue}=await sb.storage.from("assignment-solution-images").upload(path,blob,{contentType:"image/jpeg",upsert:false});
     if(ue){await sb.from("assignments").delete().eq("id",a.id);return notify("Could not upload solution image "+(i+1)+": "+ue.message);}
     const {data:pu}=sb.storage.from("assignment-solution-images").getPublicUrl(path);
     qs[i].solution_image_url=pu.publicUrl;
   }
 }
 const {error:e}=await sb.from("questions").insert(qs);if(e){await sb.from("assignments").delete().eq("id",a.id);return notify("Could not save imported questions: "+e.message)}
 const rows=[...new Set(studentIds)].map(student_id=>({assignment_id:a.id,student_id}));const {error:ae}=await sb.from("assignment_students").insert(rows);if(ae){await sb.from("questions").delete().eq("assignment_id",a.id);await sb.from("assignments").delete().eq("id",a.id);return notify("Assignment created, but student assignment failed: "+ae.message)}
 notify(`Assignment created and assigned to ${rows.length} student${rows.length===1?"":"s"}${importedSolutionPdfPages.length?` with ${importedSolutionPdfPages.length} solution image(s)`:""}.`);importedSolutionPdfPages=[];teacherHome()
}
async function uploadAssignmentQuestionImage(file, assignmentId){
  if(!file) return null;
  if(!file.type.startsWith('image/')) throw new Error('Please select an image file.');
  const maxBytes=10*1024*1024;
  if(file.size>maxBytes) throw new Error('Image size must be 10 MB or less.');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${current.id}/${assignmentId}/${crypto.randomUUID()}.${ext}`;
  const {error}=await sb.storage.from('assignment-question-images').upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw error;
  const {data}=sb.storage.from('assignment-question-images').getPublicUrl(path);
  return data.publicUrl;
}
function assignmentQuestionCardHtml(q,i){
  const imageMode=!!q.image_url;
  return `<div class="edit-q-card" data-qid="${esc(q.id)}" data-order="${q.question_order||i+1}">
    <div class="edit-q-head"><h3>Question <span class="edit-q-number">${q.question_order||i+1}</span></h3><span class="save-state" id="save-state-${q.id}"></span></div>
    <div class="editor-pane editor-pane-questions">
      <label>Question Type</label>
      <select class="edit-question-type" onchange="toggleEditedQuestionType(this)">
        <option value="text" ${!imageMode?'selected':''}>Text Question</option>
        <option value="image" ${imageMode?'selected':''}>Image Question</option>
      </select>
      <div class="edit-text-question" style="display:${imageMode?'none':'block'}">
        <label>Question Text</label>
        <textarea class="edit-question-text" placeholder="Enter question text...">${esc(q.question_text&&q.question_text!=='[IMAGE QUESTION]'?q.question_text:'')}</textarea>
      </div>
      <div class="edit-image-question" style="display:${imageMode?'block':'none'}">
        <label>Question Image</label>
        <div class="question-image-editor-preview" style="margin:8px 0 10px">${q.image_url?`<img src="${esc(q.image_url)}" alt="Question ${i+1}" style="display:block;width:100%;max-height:520px;object-fit:contain;border:1px solid #dbe3ee;border-radius:10px;background:#fff">`:'<div class="notice">No image attached.</div>'}</div>
        <input class="edit-question-image" type="file" accept="image/*" onchange="previewAssignmentQuestionImage(this)">
        <div class="small muted">Choose a new image to replace the current image. Maximum 10 MB.</div>
        <label style="margin-top:10px"><input class="remove-question-image" type="checkbox" style="width:auto;margin-right:7px"> Remove current image</label>
      </div>
      <div class="option-grid">
        ${['A','B','C','D'].map(o=>`<div><label>Option ${o}</label><input class="edit-option" data-option="${o}" value="${esc(q['option_'+o.toLowerCase()]||'')}" placeholder="Option ${o}"></div>`).join('')}
      </div>
      <label>Correct Answer</label>
      <select class="edit-correct-option"><option value="A" ${q.correct_option==='A'?'selected':''}>A</option><option value="B" ${q.correct_option==='B'?'selected':''}>B</option><option value="C" ${q.correct_option==='C'?'selected':''}>C</option><option value="D" ${q.correct_option==='D'?'selected':''}>D</option></select>
    </div>
    <div class="editor-pane editor-pane-support" style="display:none">
      <label class="hint-label">Hint (optional)</label>
      <textarea class="question-hint" placeholder="Enter a helpful hint for this question...">${esc(q.hint||'')}</textarea>
      <label class="solution-video-label">Solution Video — YouTube link (optional)</label>
      <input class="question-video-url" type="url" placeholder="https://www.youtube.com/watch?v=..." value="${esc(q.solution_video_url||'')}">
      <label style="font-weight:700;color:#334155">Explanation (optional)</label>
      <textarea class="question-explanation" placeholder="Explain why the answer is correct...">${esc(q.explanation||'')}</textarea>
      <label style="font-weight:700;color:#7c3aed">Solution Image (optional)</label>
      ${q.solution_image_url ? '<div style="margin:8px 0"><img src="' + esc(q.solution_image_url) + '" alt="Solution" style="display:block;width:100%;max-height:500px;object-fit:contain;border:1px solid #ddd6fe;border-radius:10px;background:#fff"></div>' : '<div class="small muted">No solution image attached.</div>'}
      <input class="question-solution-image" type="file" accept="image/*">
      <div class="small muted">Upload a replacement solution image for this question (maximum 10 MB).</div>
    </div>
    <div class="question-save-row">
      <button type="button" onclick="saveSingleEditedQuestion('${esc(q.assignment_id||'')}','${esc(q.id)}')">💾 Save This Question</button>
      <button type="button" class="danger" onclick="deleteAssignmentQuestion('${esc(q.assignment_id||'')}','${esc(q.id)}')">🗑 Delete Question</button>
      <span class="small muted">Replace the image, convert to text, or edit the options and answer.</span>
    </div>
  </div>`;
}
async function editAssignmentQuestions(id){
  try{
    const {data:a,error:ae}=await sb.from('assignments').select('id,title,subject').eq('id',id).eq('created_by',current.id).single();
    if(ae||!a)throw new Error(ae?.message||'Assignment not found.');
    const {data:qs,error:qe}=await sb.from('questions').select('*').eq('assignment_id',id).order('question_order');
    if(qe)throw qe;
    render(`<div class="wrap">${header('Edit Assignment Questions')}
      <div class="card">
        <h2>${esc(a.title)}</h2>
        <p class="muted">You can replace question images, convert image questions to text, add new text or image questions, delete questions, edit options/answers, and add hints, explanations and solution videos.</p>
        <div class="editor-toolbar">
          <div class="actions" style="margin:0">
            <button type="button" onclick="addAssignmentQuestionEditor('${id}','text')">＋ Add Text Question</button>
            <button type="button" class="secondary" onclick="addAssignmentQuestionEditor('${id}','image')">🖼 Add Image Question</button>
          </div>
          <button type="button" onclick="saveAllEditedQuestions('${id}', event)">💾 Save All Changes</button>
        </div>
        <div class="editor-tabs" role="tablist">
          <button type="button" id="editTabQuestions" class="editor-tab active" onclick="switchQuestionEditorTab('questions')">✎ Questions</button>
          <button type="button" id="editTabSupport" class="editor-tab" onclick="switchQuestionEditorTab('support')">💡 Hints / Solutions</button>
        </div>
        <div id="editorTabHelp" class="small muted" style="padding:10px 0">Edit question text/images, options and correct answer.</div>
        <div id="editQuestionList">${(qs||[]).map((q,i)=>assignmentQuestionCardHtml(q,i)).join('')||'<div class="notice">No questions yet. Use Add Text Question or Add Image Question.</div>'}</div>
        <div class="editor-toolbar bottom"><span class="small muted">Question numbers are automatically re-ordered after adding or deleting questions.</span><button type="button" onclick="saveAllEditedQuestions('${id}', event)">💾 Save All Changes</button></div>
        <div class="actions"><button class="secondary" onclick="schoolTeacherMode?schoolAssignmentManagement():teacherHome()">← Back</button><button class="secondary" onclick="viewAssignment('${id}')">View Assignment</button></div>
      </div></div>`);
  }catch(e){notify('Could not open question editor: '+(e.message||e));}
}
function toggleEditedQuestionType(select){
  const card=select.closest('.edit-q-card');if(!card)return;
  const image=select.value==='image';
  const t=card.querySelector('.edit-text-question'),im=card.querySelector('.edit-image-question');
  if(t)t.style.display=image?'none':'block';if(im)im.style.display=image?'block':'none';
}
function previewAssignmentQuestionImage(input){
  const card=input.closest('.edit-q-card');const box=card?.querySelector('.question-image-editor-preview');const file=input.files?.[0];
  if(!box||!file)return;
  if(!file.type.startsWith('image/')){input.value='';return notify('Please select an image file.');}
  if(file.size>10*1024*1024){input.value='';return notify('Image size must be 10 MB or less.');}
  const url=URL.createObjectURL(file);box.innerHTML=`<img src="${url}" alt="New question image" style="display:block;width:100%;max-height:520px;object-fit:contain;border:1px solid #dbe3ee;border-radius:10px;background:#fff">`;
  const rm=card.querySelector('.remove-question-image');if(rm)rm.checked=false;
}
function getEditedQuestion(card){
  const type=card.querySelector('.edit-question-type')?.value||'text';
  return {
    question_text:type==='image'?'[IMAGE QUESTION]':(card.querySelector('.edit-question-text')?.value?.trim()||''),
    option_a:card.querySelector('.edit-option[data-option="A"]')?.value?.trim()||'Option A',
    option_b:card.querySelector('.edit-option[data-option="B"]')?.value?.trim()||'Option B',
    option_c:card.querySelector('.edit-option[data-option="C"]')?.value?.trim()||'Option C',
    option_d:card.querySelector('.edit-option[data-option="D"]')?.value?.trim()||'Option D',
    correct_option:card.querySelector('.edit-correct-option')?.value||'A',
    hint:card.querySelector('.question-hint')?.value?.trim()||null,
    solution_video_url:card.querySelector('.question-video-url')?.value?.trim()||null,
    explanation:card.querySelector('.question-explanation')?.value?.trim()||null,
    solution_image_file:card.querySelector('.question-solution-image')?.files?.[0]||null,
    image_mode:type==='image'
  };
}
async function persistEditedQuestion(assignmentId,questionId,card){
  const payload=getEditedQuestion(card);
  let imageUrl=null;
  const {data:old,error:oe}=await sb.from('questions').select('image_url,solution_image_url').eq('id',questionId).eq('assignment_id',assignmentId).single();
  if(oe)throw oe;
  imageUrl=old?.image_url||null;
  const type=payload.image_mode?'image':'text';
  const file=card.querySelector('.edit-question-image')?.files?.[0];
  const remove=card.querySelector('.remove-question-image')?.checked;
  if(type==='image'){
    if(file)imageUrl=await uploadAssignmentQuestionImage(file,assignmentId);
    else if(remove)imageUrl=null;
    if(!imageUrl)throw new Error('An image question must have an image. Select an image file.');
  }else{
    imageUrl=null;
    if(!payload.question_text.trim())throw new Error('Text question cannot be empty.');
  }
  delete payload.image_mode;
  const solutionFile=payload.solution_image_file;delete payload.solution_image_file;
  let solutionImageUrl=old?.solution_image_url||null;
  if(solutionFile){
    if(!solutionFile.type.startsWith("image/"))throw new Error("Solution must be an image file.");
    if(solutionFile.size>10*1024*1024)throw new Error("Solution image size must be 10 MB or less.");
    const ext=(solutionFile.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=`${current.id}/${assignmentId}/solution-${questionId}-${crypto.randomUUID()}.${ext}`;
    const {error:ue}=await sb.storage.from("assignment-solution-images").upload(path,solutionFile,{contentType:solutionFile.type,upsert:false});
    if(ue)throw ue;
    solutionImageUrl=sb.storage.from("assignment-solution-images").getPublicUrl(path).data.publicUrl;
  }
  payload.image_url=imageUrl;payload.solution_image_url=solutionImageUrl;
  const {error}=await sb.from('questions').update(payload).eq('id',questionId).eq('assignment_id',assignmentId);
  if(error)throw error;
}
async function saveSingleEditedQuestion(assignmentId,questionId){
  const card=document.querySelector(`.edit-q-card[data-qid="${questionId}"]`);if(!card)return;
  const state=document.getElementById(`save-state-${questionId}`);
  try{
    await persistEditedQuestion(assignmentId,questionId,card);
    if(state){state.textContent='✓ Saved';state.className='save-state saved';setTimeout(()=>{if(state)state.textContent=''},2500)}
  }catch(e){if(state){state.textContent='✗ Not saved';state.className='save-state error'}notify('Could not save this question.\n\n'+(e.message||e));}
}
async function saveAllEditedQuestions(assignmentId,ev){
  const cards=[...document.querySelectorAll('.edit-q-card')];if(!cards.length)return;
  const button=ev?.currentTarget;const original=button?.textContent;
  if(button){button.disabled=true;button.textContent='Saving...'}
  try{
    for(const card of cards){
      await persistEditedQuestion(assignmentId,card.dataset.qid,card);
      const state=document.getElementById(`save-state-${card.dataset.qid}`);if(state){state.textContent='✓ Saved';state.className='save-state saved'}
    }
    await renumberAssignmentQuestions(assignmentId);
    notify('All question changes have been saved successfully.');
  }catch(e){notify('Could not save all changes.\n\n'+(e.message||e));}
  finally{if(button){button.disabled=false;button.textContent=original||'💾 Save All Changes'}}
}
async function addAssignmentQuestionEditor(assignmentId,type='text'){
  try{
    const {data:qs,error:qe}=await sb.from('questions').select('id,question_order').eq('assignment_id',assignmentId).order('question_order',{ascending:false}).limit(1);
    if(qe)throw qe;
    const next=(qs?.[0]?.question_order||0)+1;
    const payload={assignment_id:assignmentId,question_text:type==='image'?'[IMAGE QUESTION]':'',option_a:'Option A',option_b:'Option B',option_c:'Option C',option_d:'Option D',correct_option:'A',question_order:next};
    if(type==='image')payload.image_url=null;
    const {data:q,error}=await sb.from('questions').insert(payload).select('*').single();
    if(error)throw error;
    const list=document.getElementById('editQuestionList');
    if(list?.querySelector('.notice'))list.innerHTML='';
    list?.insertAdjacentHTML('beforeend',assignmentQuestionCardHtml(q,list.querySelectorAll('.edit-q-card').length));
    const card=list?.lastElementChild;card?.scrollIntoView({behavior:'smooth',block:'center'});
    if(type==='image')card?.querySelector('.edit-question-type')?.dispatchEvent(new Event('change'));
  }catch(e){notify('Could not add question.\n\n'+(e.message||e));}
}
async function deleteAssignmentQuestion(assignmentId,questionId){
  if(!confirm('Delete this question? This cannot be undone.'))return;
  try{
    const {data:ats,error:ae}=await sb.from('attempts').select('id').eq('assignment_id',assignmentId).limit(1);
    if(ae)throw ae;
    if((ats||[]).length){
      if(!confirm('Students have already submitted this assignment. Deleting this question may change historical results. Continue?'))return;
    }
    const {error}=await sb.from('questions').delete().eq('id',questionId).eq('assignment_id',assignmentId);
    if(error)throw error;
    await renumberAssignmentQuestions(assignmentId);
    notify('Question deleted.');
    await editAssignmentQuestions(assignmentId);
  }catch(e){notify('Could not delete question.\n\n'+(e.message||e));}
}
async function renumberAssignmentQuestions(assignmentId){
  const {data:qs,error}=await sb.from('questions').select('id,question_order').eq('assignment_id',assignmentId).order('question_order').order('created_at',{ascending:true});
  if(error)throw error;
  for(let i=0;i<(qs||[]).length;i++){
    if(qs[i].question_order!==i+1){const {error:e}=await sb.from('questions').update({question_order:i+1}).eq('id',qs[i].id).eq('assignment_id',assignmentId);if(e)throw e;}
  }
}
function editAssignmentSupport(id,type){
  editAssignmentQuestions(id);
  setTimeout(()=>switchQuestionEditorTab('support'),80);
  setTimeout(()=>{
    let target=null;
    if(type==='hint')target=document.querySelector('.question-hint');
    if(type==='video')target=document.querySelector('.question-video-url');
    if(type==='explanation')target=document.querySelector('.question-explanation');
    if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.focus();}
  },140);
}
function switchQuestionEditorTab(tab){
  const isQuestions=tab!=='support';
  document.querySelectorAll('.editor-pane-questions').forEach(x=>x.style.display=isQuestions?'block':'none');
  document.querySelectorAll('.editor-pane-support').forEach(x=>x.style.display=isQuestions?'none':'block');
  document.getElementById('editTabQuestions')?.classList.toggle('active',isQuestions);
  document.getElementById('editTabSupport')?.classList.toggle('active',!isQuestions);
  const h=document.getElementById('editorTabHelp');
  if(h)h.textContent=isQuestions?'Edit question text/images, options and correct answer.':'Add optional hints, explanations and YouTube solution videos for selected questions.';
}
async function viewAssignment(id){
 const {data:a,error:ae}=await sb.from("assignments").select("*").eq("id",id).single();
 if(ae)return notify(ae.message);
 const {data:qs,error:qe}=await sb.from("questions").select("*").eq("assignment_id",id).order("question_order");
 if(qe)return notify(qe.message);
 render(`<div class="wrap">${header(esc(a.title))}
 <div class="card"><p class="muted">${esc(a.subject||"")}</p>${a.video_url?`<iframe class="video" src="${esc(embed(a.video_url))}" allowfullscreen></iframe>`:""}</div>
 <div class="card"><h2>Questions (${qs?.length||0})</h2>${(qs||[]).map((q,i)=>q.image_url?`<div class="assignment"><h3>Question ${i+1}</h3><img src="${esc(q.image_url)}" alt="Question ${i+1}" style="display:block;width:100%;max-height:750px;object-fit:contain;border:1px solid #dbe3ee;border-radius:10px"><span class="tag">Answer: ${esc(q.correct_option)}</span>${q.hint?`<div class="hint-box"><b>Hint:</b> ${jnvstMathPreview(q.hint)}</div>`:""}${q.explanation?`<div style="margin-top:10px;padding:10px 12px;border-left:4px solid #166534;background:#f0fdf4;border-radius:8px"><b style="color:#166534">Explanation:</b> ${esc(q.explanation)}</div>`:""}${q.solution_image_url?`<div style="margin-top:12px;padding:10px;background:#faf5ff;border:1px solid #ddd6fe;border-radius:10px"><b style="color:#6d28d9">Solution</b><img src="${esc(q.solution_image_url)}" alt="Solution" style="display:block;width:100%;max-height:700px;object-fit:contain;margin-top:8px;border-radius:8px"></div>`:""}${q.solution_video_url?`<div class="solution-video-box"><b class="solution-video-label">Solution Video</b><iframe class="solution-video" src="${esc(embed(q.solution_video_url))}" allowfullscreen></iframe></div>`:""}</div>`:`<div class="assignment"><b>${i+1}. ${esc(q.question_text)}</b><p>A. ${esc(q.option_a)}</p><p>B. ${esc(q.option_b)}</p><p>C. ${esc(q.option_c)}</p><p>D. ${esc(q.option_d)}</p><span class="tag">Answer: ${esc(q.correct_option)}</span>${q.hint?`<div class="hint-box"><b>Hint:</b> ${jnvstMathPreview(q.hint)}</div>`:""}${q.explanation?`<div style="margin-top:10px;padding:10px 12px;border-left:4px solid #166534;background:#f0fdf4;border-radius:8px"><b style="color:#166534">Explanation:</b> ${esc(q.explanation)}</div>`:""}${q.solution_image_url?`<div style="margin-top:12px;padding:10px;background:#faf5ff;border:1px solid #ddd6fe;border-radius:10px"><b style="color:#6d28d9">Solution</b><img src="${esc(q.solution_image_url)}" alt="Solution" style="display:block;width:100%;max-height:700px;object-fit:contain;margin-top:8px;border-radius:8px"></div>`:""}${q.solution_video_url?`<div class="solution-video-box"><b class="solution-video-label">Solution Video</b><iframe class="solution-video" src="${esc(embed(q.solution_video_url))}" allowfullscreen></iframe></div>`:""}</div>`).join("")}</div>
 <div class="actions"><button class="secondary" onclick="teacherHome()">← Back</button></div></div>`)
}
async function results(id){
 try{
  const {data:a,error:ae}=await sb.from("assignments").select("*").eq("id",id).eq("created_by",current.id).single();
  if(ae||!a)throw new Error(ae?.message||"Assignment not found.");
  const {data:qs,error:qe}=await sb.from("questions").select("id,question_order,question_text,option_a,option_b,option_c,option_d,correct_option,image_url").eq("assignment_id",id).order("question_order");
  if(qe)throw qe;
  const {data:ats,error:te}=await sb.from("attempts").select("id,student_id,score,total_questions,video_completed,submitted_at,attempt_number").eq("assignment_id",id).order("submitted_at",{ascending:false});
  if(te)throw te;
  const ids=[...new Set((ats||[]).map(x=>x.student_id))],attemptIds=(ats||[]).map(x=>x.id);
  let profiles=[],answerRows=[];
  if(ids.length){const {data:p,error}=await sb.from("profiles").select("id,full_name,roll_no").in("id",ids);if(error)throw error;profiles=p||[]}
  if(attemptIds.length){const {data:ar,error}=await sb.from("answers").select("attempt_id,question_id,selected_option,is_correct").in("attempt_id",attemptIds);if(error)throw error;answerRows=ar||[]}
  window._resultData={assignment:a,questions:qs||[],attempts:ats||[],profiles:new Map(profiles.map(p=>[p.id,p])),answers:new Map(answerRows.map(x=>[`${x.attempt_id}:${x.question_id}`,x])),sortBy:"submitted",sortDir:"desc"};
  renderResultsPage();
 }catch(e){notify("Could not load results: "+(e.message||e))}
}
function renderResultsPage(){
 const d=window._resultData;if(!d)return;
 const sorted=[...d.attempts].sort((x,y)=>{
  let a,b;
  if(d.sortBy==="student"){a=(d.profiles.get(x.student_id)?.full_name||"").toLowerCase();b=(d.profiles.get(y.student_id)?.full_name||"").toLowerCase()}
  else if(d.sortBy==="score"){a=Number(x.score||0)/Math.max(1,Number(x.total_questions||d.questions.length));b=Number(y.score||0)/Math.max(1,Number(y.total_questions||d.questions.length))}
  else if(d.sortBy==="attempt"){a=Number(x.attempt_number||1);b=Number(y.attempt_number||1)}
  else {a=x.submitted_at?new Date(x.submitted_at).getTime():0;b=y.submitted_at?new Date(y.submitted_at).getTime():0}
  return (a===b?0:a<b?-1:1)*(d.sortDir==="asc"?1:-1);
 });
 const avg=sorted.length?Math.round(sorted.reduce((n,x)=>n+Number(x.score||0)*100/Math.max(1,Number(x.total_questions||d.questions.length)),0)/sorted.length):0;
 render(`<div class="wrap">${header("Results")}<div class="card">
 <div style="display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap"><div><h2>${esc(d.assignment.title)}</h2><div class="muted">${esc(d.assignment.subject||"")}</div></div><div class="tag">${sorted.length} submission${sorted.length===1?"":"s"} • Average ${avg}%</div></div>
 <div class="result-controls actions"><b>Sort:</b><select id="resultSortBy"><option value="submitted" ${d.sortBy==="submitted"?"selected":""}>Submission time</option><option value="student" ${d.sortBy==="student"?"selected":""}>Student name</option><option value="score" ${d.sortBy==="score"?"selected":""}>Score</option><option value="attempt" ${d.sortBy==="attempt"?"selected":""}>Attempt number</option></select><select id="resultSortDir"><option value="desc" ${d.sortDir==="desc"?"selected":""}>Descending</option><option value="asc" ${d.sortDir==="asc"?"selected":""}>Ascending</option></select><button onclick="applyResultSort()">Apply</button><button onclick="downloadAssignmentResultsExcel('${d.assignment.id}')">⬇ Download Results Excel</button><button class="secondary" onclick="teacherHome()">← Back</button></div>
 ${sorted.length?sorted.map(at=>{const p=d.profiles.get(at.student_id)||{},total=Number(at.total_questions||d.questions.length),score=Number(at.score||0),wrong=Math.max(0,total-score),pct=total?Math.round(score*100/total):0;return `<div class="result-student">
  <div class="result-student-head"><div><h3>${esc(p.full_name||"Student")}</h3><div class="muted small">Roll No: ${esc(p.roll_no||"—")} • Attempt ${esc(at.attempt_number||1)} • ${at.submitted_at?new Date(at.submitted_at).toLocaleString():"—"}</div></div><div class="result-score"><b>${score}/${total}</b><span>${pct}%</span></div></div>
  <div class="result-summary"><span>Total: <b>${total}</b></span><span class="result-correct">✓ Correct: <b>${score}</b></span><span class="result-wrong">✗ Wrong: <b>${wrong}</b></span><span>Video: <b>${at.video_completed?"Yes":"No"}</b></span><button class="danger" onclick="deleteStudentAttempt('${at.id}','${esc(p.full_name||"Student")}')">Delete This Attempt</button></div>
  <div class="result-tabs" style="display:flex;gap:8px;margin-top:14px"><button class="secondary" onclick="toggleResultDetails('${at.id}','correct')">✓ Correct Answers (${score})</button><button class="secondary" onclick="toggleResultDetails('${at.id}','wrong')">✗ Wrong Answers (${wrong})</button></div>
  <div id="result-details-${at.id}" class="result-details" style="display:none;margin-top:12px"></div>
 </div>`}).join(""):`<div class="success"><b>No submissions yet.</b></div>`}
 </div></div>`);
}
function toggleResultDetails(attemptId,type){
 const d=window._resultData;if(!d)return;
 const box=document.getElementById(`result-details-${attemptId}`);if(!box)return;
 if(box.dataset.open===type){box.style.display="none";box.innerHTML="";box.dataset.open="";return;}
 const at=d.attempts.find(x=>x.id===attemptId);if(!at)return;
 const items=d.questions.map((q,i)=>{
  const ans=d.answers.get(`${attemptId}:${q.id}`),selected=ans?.selected_option||"—",correct=q.correct_option||"—";
  const ok=ans?.is_correct===true||(selected!=="—"&&selected===correct);
  return {q,ans,selected,correct,ok,index:i};
 }).filter(x=>type==="correct"?x.ok:!x.ok);
 box.dataset.open=type;box.style.display="block";
 if(!items.length){box.innerHTML=`<div class="success"><b>No ${type} answers.</b></div>`;return;}
 box.innerHTML=items.map(({q,selected,correct,index})=>{
  const opts=[['A',q.option_a],['B',q.option_b],['C',q.option_c],['D',q.option_d]];
  return `<div class="assignment" style="margin-top:12px;border:1px solid #dbe3ee;border-radius:14px;padding:16px">
   <h3 style="margin-top:0">Q${q.question_order||index+1} — ${type==="correct"?'✓ Correct':'✗ Wrong'}</h3>
   ${q.image_url?`<img src="${esc(q.image_url)}" alt="Question ${q.question_order||index+1}" style="display:block;width:100%;max-height:650px;object-fit:contain;border:1px solid #dbe3ee;border-radius:10px;margin-bottom:12px">`:`<div style="font-weight:700;margin-bottom:10px">${jnvstMathPreview(q.question_text||"Question unavailable")}</div>`}
   ${opts.map(o=>`<div style="padding:9px 12px;margin:6px 0;border-radius:9px;border:1px solid ${o[0]===correct?'#16a34a':o[0]===selected&&o[0]!==correct?'#dc2626':'#e5e7eb'};background:${o[0]===correct?'#f0fdf4':o[0]===selected&&o[0]!==correct?'#fef2f2':'#fff'}"><b>${o[0]}.</b> ${jnvstMathPreview(o[1]||'')}</div>`).join('')}
   <div class="result-answer" style="margin-top:12px"><span>Student Answer: <b>${esc(selected)}</b></span><span style="color:#166534"><b>Answer Key: ${esc(correct)}</b></span></div>${q?.explanation?`<div style="margin-top:10px;padding:12px 14px;border-left:4px solid #166534;background:#f0fdf4;border-radius:8px;line-height:1.5"><b style="color:#166534">Explanation:</b><div style="margin-top:4px">${jnvstMathPreview(q.explanation)}</div></div>`:""}
   <div class="${type==="correct"?'result-correct':'result-wrong'}" style="margin-top:8px"><b>${type==="correct"?'✓ Correct':'✗ Wrong'}</b></div>
  </div>`;
 }).join('');
 // Result details are inserted dynamically after the Results page is rendered.
 // Explicitly typeset this newly-created subtree so LaTeX in questions/options
 // is rendered by MathJax instead of being shown literally.
 jnvstTypesetWhenReady([box]);
}
function applyResultSort(){
 const d=window._resultData;if(!d)return;
 d.sortBy=document.getElementById("resultSortBy")?.value||"submitted";
 d.sortDir=document.getElementById("resultSortDir")?.value||"desc";
 renderResultsPage();
}
async function deleteStudentAttempt(attemptId,studentName){
 if(!confirm(`Delete ${studentName}'s attempt?\n\nThe submitted answers and this attempt will be permanently removed.`))return;
 try{
  const {error:e}=await sb.from("answers").delete().eq("attempt_id",attemptId);if(e)throw e;
  const {error:e2}=await sb.from("attempts").delete().eq("id",attemptId);if(e2)throw e2;
  notify("Attempt deleted successfully.");
  const assignmentId=window._resultData?.assignment?.id;if(assignmentId)results(assignmentId);
 }catch(e){notify("Could not delete attempt.\n\n"+(e.message||e)+"\n\nIf this is an RLS policy error, run teacher_management.sql in Supabase.")}
}
async function downloadAssignmentResultsExcel(assignmentId){
  try{
    const {data:a,error:ae}=await sb.from("assignments").select("id,title").eq("id",assignmentId).single();
    if(ae||!a) throw new Error(ae?.message||"Assignment not found.");

    const {data:qs,error:qe}=await sb.from("questions")
      .select("id,question_order,correct_option")
      .eq("assignment_id",assignmentId).order("question_order");
    if(qe) throw new Error(qe.message);

    const {data:ats,error:te}=await sb.from("attempts")
      .select("id,student_id,score,total_questions,submitted_at,attempt_number")
      .eq("assignment_id",assignmentId).order("submitted_at",{ascending:true});
    if(te) throw new Error(te.message);

    const ids=[...new Set((ats||[]).map(x=>x.student_id))];
    let profiles=[];
    if(ids.length){
      const {data:p,error:pe}=await sb.from("profiles")
        .select("id,full_name,roll_no").in("id",ids);
      if(pe) throw new Error(pe.message);
      profiles=p||[];
    }

    const attemptIds=(ats||[]).map(x=>x.id);
    let answerRows=[];
    if(attemptIds.length){
      const {data:ar,error:are}=await sb.from("answers")
        .select("attempt_id,question_id,selected_option").in("attempt_id",attemptIds);
      if(are) throw new Error(are.message);
      answerRows=ar||[];
    }

    const pm=new Map(profiles.map(p=>[p.id,p]));
    const am=new Map(answerRows.map(x=>[`${x.attempt_id}:${x.question_id}`,x]));

    const rows=(ats||[]).map(at=>{
      const p=pm.get(at.student_id)||{};
      const row={
        "Student Name":p.full_name||at.student_id,
        "Roll No":p.roll_no||"",
        "Assignment Name":a.title,
        "Score":at.score,
        "Total Questions":at.total_questions,
        "Submitted":at.submitted_at?new Date(at.submitted_at).toLocaleString():"",
        "Attempt No":at.attempt_number||1
      };
      (qs||[]).forEach((q,i)=>{
        const n=q.question_order||i+1;
        const ans=am.get(`${at.id}:${q.id}`);
        row[`Q${n} Option`]=ans?.selected_option||"";
        row[`Q${n} Answer Key`]=q.correct_option||"";
      });
      row["Total Marks"]=at.score;
      return row;
    });

    if(!rows.length){ notify("No student submissions are available for this assignment yet."); return; }

    const ws=XLSX.utils.json_to_sheet(rows);
    ws["!cols"]=Object.keys(rows[0]).map(k=>({wch:Math.max(12,Math.min(28,k.length+3))}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Results");
    const safe=(a.title||"Assignment Results").replace(/[\\/:*?"<>|]+/g,"_").slice(0,80);
    XLSX.writeFile(wb,`${safe}_Results.xlsx`);
  }catch(e){ notify("Could not download results: "+(e.message||e)); }
}
async function downloadAllResultsExcel(){
  try{
    const [{data:allAs,error:ae},{data:allCls,error:ce}]=await Promise.all([
      sb.from("assignments").select("id,title,created_by,class_id").eq("created_by",profile.id).order("created_at",{ascending:false}),
      sb.from("classes").select("id,course").eq("teacher_id",profile.id)
    ]);
    if(ae) throw new Error(ae.message);
    if(ce) throw new Error(ce.message);
    const allowedClassIds=new Set((allCls||[]).filter(c=>schoolTeacherMode
      ? String(c.course||"").trim().toUpperCase()==="SCHOOL"
      : String(c.course||"").trim().toUpperCase()!=="SCHOOL").map(c=>c.id));
    const as=(allAs||[]).filter(a=>allowedClassIds.has(a.class_id));
    if(!as.length){ notify(schoolTeacherMode?"No School Course assignments found.":"No JNVST assignments found."); return; }

    const assignmentIds=as.map(a=>a.id);
    const {data:qs,error:qe}=await sb.from("questions")
      .select("id,assignment_id,question_order,correct_option")
      .in("assignment_id",assignmentIds).order("question_order");
    if(qe) throw new Error(qe.message);

    const {data:ats,error:te}=await sb.from("attempts")
      .select("id,assignment_id,student_id,score,total_questions,submitted_at,attempt_number")
      .in("assignment_id",assignmentIds).order("submitted_at",{ascending:true});
    if(te) throw new Error(te.message);

    const studentIds=[...new Set((ats||[]).map(x=>x.student_id))];
    let profiles=[];
    if(studentIds.length){
      const {data:p,error:pe}=await sb.from("profiles")
        .select("id,full_name,roll_no").in("id",studentIds);
      if(pe) throw new Error(pe.message);
      profiles=p||[];
    }

    const attemptIds=(ats||[]).map(x=>x.id);
    let answerRows=[];
    if(attemptIds.length){
      const {data:ar,error:are}=await sb.from("answers")
        .select("attempt_id,question_id,selected_option").in("attempt_id",attemptIds);
      if(are) throw new Error(are.message);
      answerRows=ar||[];
    }

    const pm=new Map(profiles.map(p=>[p.id,p]));
    const am=new Map(answerRows.map(x=>[`${x.attempt_id}:${x.question_id}`,x]));
    const asm=new Map(as.map(a=>[a.id,a]));

    const rows=(ats||[]).map(at=>{
      const p=pm.get(at.student_id)||{}, a=asm.get(at.assignment_id)||{};
      const row={
        "Student Name":p.full_name||at.student_id,
        "Roll No":p.roll_no||"",
        "Assignment Name":a.title||"",
        "Score":at.score,
        "Total Questions":at.total_questions,
        "Submitted":at.submitted_at?new Date(at.submitted_at).toLocaleString():"",
        "Attempt No":at.attempt_number||1
      };
      (qs||[]).filter(q=>q.assignment_id===at.assignment_id).forEach((q,i)=>{
        const n=q.question_order||i+1, ans=am.get(`${at.id}:${q.id}`);
        row[`Q${n} Option`]=ans?.selected_option||"";
        row[`Q${n} Answer Key`]=q.correct_option||"";
      });
      row["Total Marks"]=at.score;
      return row;
    });

    if(!rows.length){ notify("No student submissions are available yet."); return; }

    const ws=XLSX.utils.json_to_sheet(rows);
    ws["!cols"]=Object.keys(rows[0]).map(k=>({wch:Math.max(12,Math.min(28,k.length+3))}));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"All Results");
    XLSX.writeFile(wb,"SwarupSir_All_Assignment_Results.xlsx");
  }catch(e){ notify("Could not download results: "+(e.message||e)); }
}

/* ---- add-on 1 (was inline <script> #4 in main.html) ---- */
try{

/* JNVST Mock Test bulk-upload V2 — generic Language passage bank + Arithmetic Excel + stable sets */
(function(){
  MOCK_PLAN.length=0;
  MOCK_PLAN.push(
    {section:'MAT',part:'MAT_PATTERN',label:'MAT — Pattern Completion',count:4,upload:'pdf',unit:'questions'},
    {section:'MAT',part:'MAT_SERIES',label:'MAT — Figure Series Completion',count:4,upload:'pdf',unit:'questions'},
    {section:'MAT',part:'MAT_GEOMETRICAL',label:'MAT — Geometrical Figure Completion',count:4,upload:'pdf',unit:'questions'},
    {section:'MAT',part:'MAT_MIRROR',label:'MAT — Mirror & Water Imaging',count:4,upload:'pdf',unit:'questions'},
    {section:'MAT',part:'MAT_EMBEDDED',label:'MAT — Embedded Figure',count:4,upload:'pdf',unit:'questions'},
    {section:'EVS',part:'EVS_MCQ',label:'EVS — MCQ',count:15,upload:'excel',unit:'questions'},
    {section:'EVS',part:'EVS_PASSAGE',label:'EVS — Passage Group',count:5,upload:'excel',unit:'passage'},
    {section:'ARITHMETIC',part:'ARITHMETIC',label:'Arithmetic',count:20,upload:'excel_or_pdf',unit:'questions'},
    {section:'LANGUAGE',part:'LANGUAGE_PASSAGE',label:'Language — 4 Passage Groups',count:20,passageCount:5,groupCount:4,upload:'excel',unit:'passage'}
  );
  for(const k of Object.keys(mockPlanByPart)) delete mockPlanByPart[k];
  MOCK_PLAN.forEach(x=>mockPlanByPart[x.part]=x);
  window.mockNormalizePart=function(p){return String(p||'').trim().toUpperCase().replace(/\s+/g,'_').replace(/-+/g,'_')};
  window.mockReadRows=function(file,cb){const r=new FileReader();r.onload=e=>{try{cb(XLSX.read(e.target.result,{type:'array'}))}catch(err){notify('Could not read Excel: '+err.message)}};r.readAsArrayBuffer(file)};
  window.readMockQuestionExcel=function(ev){
    const file=ev.target.files?.[0];
    if(!file)return;
    mockReadRows(file,wb=>{
      const norm=v=>String(v??'').trim();
      const key=x=>norm(x).toLowerCase().replace(/[_\s-]+/g,' ');
      const get=(row,names)=>{
        for(const n of names){
          const k=Object.keys(row).find(k=>key(k)===key(n));
          if(k!==undefined)return norm(row[k]);
        }
        return '';
      };
      const passageKey=v=>{
        const x=norm(v);
        if(!x)return '';
        return /^\d+(?:\.0+)?$/.test(x) ? String(Number(x)) : x.toLowerCase();
      };

      // Read the Passages sheet. The uploader accepts the documented
      // "Local Passage No." column as well as legacy aliases.
      const passages={};
      const passageSheetName=wb.SheetNames.find(n=>key(n)==='passages');
      const ps=passageSheetName?wb.Sheets[passageSheetName]:null;
      if(ps){
        XLSX.utils.sheet_to_json(ps,{defval:''}).forEach((row,i)=>{
          const rawId=get(row,[
            'Local Passage No.','Local Passage Number','Local Passage ID',
            'Passage ID','PassageID','Passage No','Passage Number','ID'
          ]);
          const id=rawId||String(i+1);
          const k=passageKey(id);
          if(k)passages[k]={
            id,
            title:get(row,['Passage Title','Title']),
            text:get(row,['Passage','Passage Text','Text'])
          };
        });
      }

      const ws=wb.Sheets[wb.SheetNames.find(n=>key(n)==='questions')||wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      const selectedLang=document.getElementById('mockUploadLanguage')?.value||'ASSAMESE';

      mockBankRows=rows.map((row,i)=>{
        const rawPid=get(row,[
          'Local Passage No.','Local Passage Number','Local Passage ID',
          'Passage ID','PassageID','Passage No','Passage Number'
        ]);
        const pid=norm(rawPid);
        const linked=passages[passageKey(pid)];
        const part=mockNormalizePart(get(row,['Part','Part Code']));
        return {
          row:i+2,
          section:get(row,['Section']).toUpperCase(),
          part,
          language:part.startsWith('MAT_')?'COMMON':selectedLang,
          passage_id:pid,
          question_order:Number(get(row,['Question Order','Question No','Question Number','Order']))||null,
          question:get(row,['Question','Question Text']),
          A:get(row,['A','Option A']),
          B:get(row,['B','Option B']),
          C:get(row,['C','Option C']),
          D:get(row,['D','Option D']),
          answer:get(row,['Answer','Correct Option']).toUpperCase(),
          passage:linked?.text||get(row,['Passage','Passage Text']),
          passage_title:linked?.title||get(row,['Passage Title','Title']),
          image_url:get(row,['Image URL','Question Image URL'])
        };
      }).filter(x=>x.question||x.image_url);

      const bad=mockBankRows.filter(x=>!mockPlanByPart[x.part]||!['A','B','C','D'].includes(x.answer));
      const passageRows=mockBankRows.filter(x=>x.part==='EVS_PASSAGE'||x.part==='LANGUAGE_PASSAGE');
      const missingLocal=passageRows.filter(x=>!x.passage_id);
      const missingLink=passageRows.filter(x=>x.passage_id && (!x.passage_title || !x.passage));
      const previewWarnings=[];
      if(missingLocal.length)previewWarnings.push(`${missingLocal.length} passage question(s) have no Local Passage No.`);
      if(missingLink.length)previewWarnings.push(`${missingLink.length} passage question(s) have no matching title/full passage`);
      const allBad=bad.length||previewWarnings.length;
      document.getElementById('mockExcelPreview').innerHTML=
        message(
          `Loaded ${mockBankRows.length} question(s). ${allBad?'⚠ '+(bad.length+previewWarnings.length)+' validation issue(s) found.':'✓ Questions, passage links and answer keys look valid.'}`,
          !allBad
        )+
        (previewWarnings.length?`<div class="small" style="color:#b91c1c;margin-top:6px">${previewWarnings.map(esc).join('<br>')}</div>`:'')+
        `<div class="small muted">${mockBankRows.slice(0,12).map(x=>`${x.row}. ${esc(mockPartLabel(x.part))} ${x.passage_id?`[local group ${esc(x.passage_id)}] `:(x.part==='EVS_PASSAGE'||x.part==='LANGUAGE_PASSAGE'?'[MISSING LOCAL GROUP] ':'')}${esc((x.question||'[image]').slice(0,70))} — ${esc(x.answer||'MISSING')}`).join('<br>')}${mockBankRows.length>12?'<br>…':''}</div>`;
    });
  };
  window.readMockArithmeticExcel=function(ev){const file=ev.target.files?.[0];if(!file)return;mockReadRows(file,wb=>{const ws=wb.Sheets[wb.SheetNames.find(n=>String(n).toLowerCase()==='questions')||wb.SheetNames[0]],rows=XLSX.utils.sheet_to_json(ws,{defval:''}),get=(row,names)=>{for(const n of names){const k=Object.keys(row).find(k=>String(k).trim().toLowerCase().replace(/[_\s-]+/g,' ')===String(n).trim().toLowerCase().replace(/[_\s-]+/g,' '));if(k!==undefined)return String(row[k]??'').trim()}return ''};const items=rows.map((row,i)=>({row:i+2,section:'ARITHMETIC',part:'ARITHMETIC',set_id:get(row,['Set ID','Set','Group ID']),question_order:Number(get(row,['Question Order','Question No','Question Number','Order']))||i+1,language:(document.getElementById('mockUploadLanguage')?.value||'ASSAMESE'),question:get(row,['Question','Question Text']),A:get(row,['A','Option A']),B:get(row,['B','Option B']),C:get(row,['C','Option C']),D:get(row,['D','Option D']),answer:get(row,['Answer','Correct Option']).toUpperCase(),passage:'',passage_id:'',passage_title:'',image_url:get(row,['Image URL','Question Image URL'])})).filter(x=>x.question||x.image_url);mockBankRows=mockBankRows.concat(items);const box=document.getElementById('mockExcelPreview');if(box)box.innerHTML+=message(`Loaded ${items.length} Arithmetic question(s) from Excel.`,true)})};
  window.mockBulkUpload=function(){mockBankRows=[];mockPdfRows=[];mockAnswerKey={};mockPdfMeta={};render(`<div class="wrap">${header('Bulk Upload Mock Test Questions')}<div class="card"><div class="notice"><b>JNVST bulk-upload rules:</b> MAT = 4 per set; EVS MCQ = 15 per set; EVS passage = 5 linked questions; Arithmetic = 20 per set (Excel or PDF); Language = any number of complete 5-question passage groups. PDF questions are cropped to remove unnecessary white space.</div><div class="grid"><div class="card" style="border:2px solid #2563eb"><span class="tag">EXCEL</span><h3>EVS, Language & Arithmetic</h3><p class="small muted">Use the standard Questions + Passages sheets. For EVS_PASSAGE and LANGUAGE_PASSAGE, Local Passage No. is required on every question row; the same number must be used on exactly 5 question rows. The Passages sheet must contain that number with its title and complete passage. Arithmetic can also be uploaded here.</p><label>Question Language</label><select id="mockUploadLanguage"><option value="ASSAMESE">Assamese</option><option value="ENGLISH">English</option></select><label>Question-bank Excel</label><input type="file" id="mockExcelFile" accept=".xlsx,.xls" onchange="readMockQuestionExcel(event)"><label>Arithmetic Excel (optional separate file)</label><input type="file" id="mockArithmeticExcelFile" accept=".xlsx,.xls" onchange="readMockArithmeticExcel(event)"><div id="mockExcelPreview"></div></div><div class="card" style="border:2px solid #16a34a"><span class="tag" style="background:#dcfce7;color:#166534">PDF + KEY</span><h3>MAT & Image-based Arithmetic</h3><p class="small muted">For MAT, use one question per PDF page. The MAT Metadata Excel maps each PDF page to Question No, Part, Topic, Marks and Correct Option. Cognitive Level, Difficulty and Explanation are optional. Unnecessary white space is cropped automatically.</p><label>Question Language</label><select id="mockPdfLanguage"><option value="COMMON">Common (MAT)</option><option value="ASSAMESE">Assamese (Arithmetic)</option><option value="ENGLISH">English (Arithmetic)</option></select><label>PDF Part (used for Arithmetic; MAT Part comes from the Excel)</label><select id="mockPdfPart" onchange="mockPdfPartChanged()">${MOCK_PLAN.filter(x=>x.upload==='pdf'||x.upload==='excel_or_pdf').map(x=>`<option value="${x.part}">${esc(x.label)} — ${x.count} per set</option>`).join('')}</select><label>Questions PDF</label><input id="mockPdfFile" type="file" accept=".pdf" onchange="readMockQuestionPdf(event)"><label>MAT Answer & Metadata Excel</label><input id="mockAnswerFile" type="file" accept=".xlsx,.xls" onchange="readMockAnswerExcel(event)"><div id="mockPdfPreview"></div></div></div><div class="card" style="background:#f8fafc"><h3>Templates</h3><p class="small muted">MAT PDF columns: Question No, Correct Option, Part, Topic, Marks, Cognitive_Level (optional), Difficulty (optional), Explanation (optional). Permanent Set IDs and Passage IDs are generated automatically.</p><div class="actions"><button class="secondary" onclick="downloadMockExcelTemplate()">Download Excel Template</button><button class="secondary" onclick="downloadMockAnswerTemplate()">Download MAT Metadata Template</button></div></div><div class="notice small">Before saving, the system validates counts, passage groups, Local Passage No., Question Order 1–5, passage title/text, answer keys and active duplicates. Complete passage groups are assigned stable Passage IDs so later tests can reuse them safely.</div><div class="actions"><button onclick="saveMockBulkUploads()">Validate & Save</button><button class="secondary" onclick="mockTestManagement()">← Back</button><button class="secondary" onclick="teacherHome()">Dashboard</button></div></div></div>`)};
  window.downloadMockExcelTemplate=function(){
    const wb=XLSX.utils.book_new();
    const q=[
      ['Section','Part','Local Passage No.','Question Order','Question','A','B','C','D','Answer','Image URL'],
      ['EVS','EVS_MCQ','','1','Sample MCQ','Option A','Option B','Option C','Option D','A',''],
      ['EVS','EVS_PASSAGE','1','1','EVS Passage Question 1','Option A','Option B','Option C','Option D','A',''],
      ['EVS','EVS_PASSAGE','1','2','EVS Passage Question 2','Option A','Option B','Option C','Option D','B',''],
      ['EVS','EVS_PASSAGE','1','3','EVS Passage Question 3','Option A','Option B','Option C','Option D','C',''],
      ['EVS','EVS_PASSAGE','1','4','EVS Passage Question 4','Option A','Option B','Option C','Option D','D',''],
      ['EVS','EVS_PASSAGE','1','5','EVS Passage Question 5','Option A','Option B','Option C','Option D','A',''],
      ['LANGUAGE','LANGUAGE_PASSAGE','1','1','Language Passage Question 1','Option A','Option B','Option C','Option D','B',''],
      ['LANGUAGE','LANGUAGE_PASSAGE','1','2','Language Passage Question 2','Option A','Option B','Option C','Option D','C',''],
      ['LANGUAGE','LANGUAGE_PASSAGE','1','3','Language Passage Question 3','Option A','Option B','Option C','Option D','D',''],
      ['LANGUAGE','LANGUAGE_PASSAGE','1','4','Language Passage Question 4','Option A','Option B','Option C','Option D','A',''],
      ['LANGUAGE','LANGUAGE_PASSAGE','1','5','Language Passage Question 5','Option A','Option B','Option C','Option D','B',''],
      ['ARITHMETIC','ARITHMETIC','Arithmetic','','1','Sample arithmetic question','Option A','Option B','Option C','Option D','D','']
    ];
    const p=[
      ['Local Passage No.','Passage Title','Passage'],
      ['1','EVS Sample Passage','This is the complete EVS passage. Replace this with the full passage before uploading.'],
      ['2','Language Sample Passage','This is the complete Language passage. Replace this with the full passage before uploading.']
    ];
    const qs=XLSX.utils.aoa_to_sheet(q),ps=XLSX.utils.aoa_to_sheet(p);
    XLSX.utils.book_append_sheet(wb,qs,'Questions');
    XLSX.utils.book_append_sheet(wb,ps,'Passages');
    XLSX.writeFile(wb,'mock_question_bank_template.xlsx');
  };
  window.downloadMockAnswerTemplate=function(){const ws=XLSX.utils.aoa_to_sheet([['Question No','Correct Option'],[1,'A'],[2,'B'],[3,'C'],[4,'D']]);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Answer Key');XLSX.writeFile(wb,'mock_answer_key_template.xlsx')};
  window.mockNextIds=async function(part,language,count,kind){const {data,error}=await sb.from('mock_question_bank').select('set_id,passage_id').eq('teacher_id',current.id).eq('part_code',part).eq('language',language);if(error)throw error;const prefixMap={MAT_PATTERN:'PAT',MAT_SERIES:'SER',MAT_GEOMETRICAL:'GEO',MAT_MIRROR:'MIR',MAT_EMBEDDED:'EMB',EVS_MCQ:language==='ENGLISH'?'EVS-E':'EVS-A',ARITHMETIC:language==='ENGLISH'?'AR-E':'AR-A',EVS_PASSAGE:language==='ENGLISH'?'EVS-E-P':'EVS-A-P',LANGUAGE_PASSAGE:language==='ENGLISH'?'L-E':'L-A'};const prefix=prefixMap[part]||part;const field=kind==='passage'?'passage_id':'set_id';let max=0;for(const r of(data||[])){const m=String(r[field]||'').match(/(\d+)$/);if(m)max=Math.max(max,Number(m[1]))}return Array.from({length:count},(_,i)=>`${prefix}-${String(max+i+1).padStart(3,'0')}`)};
  window.saveMockBulkUploads=async function(){
    try{
      let savedExcel=0,savedPdf=0;
      const cleanPart=mockNormalizePart;
      const excelByPart={};
      mockBankRows.forEach(x=>{
        const part=cleanPart(x.part);
        (excelByPart[part] ||= []).push(x);
      });

      for(const [part,items] of Object.entries(excelByPart)){
        const plan=mockPlanByPart[part];
        if(!plan||!['excel','excel_or_pdf'].includes(plan.upload))
          throw new Error(`${part} is not a valid Excel-upload part.`);

        if(items.some(x=>!['A','B','C','D'].includes(x.answer)))
          throw new Error(`${plan.label}: every question needs A/B/C/D answer key.`);

        if(plan.unit==='questions' && items.length%plan.count!==0)
          throw new Error(`${plan.label}: ${items.length} questions uploaded; required multiple is ${plan.count}.`);

        const lang=part.startsWith('MAT_')?'COMMON':(items[0]?.language||'ASSAMESE');
        let localGroups={};

        if(plan.unit==='passage'){
          const missing=items.filter(x=>!String(x.passage_id||'').trim());
          if(missing.length){
            throw new Error(`${plan.label}: Local Passage No. is required for every passage question (row ${missing[0].row}).`);
          }

          const groupsByKey={};
          items.forEach(x=>{
            const g=String(x.passage_id).trim();
            (groupsByKey[g] ||= []).push(x);
          });
          localGroups=groupsByKey;

          const expected=plan.passageCount||5;
          const badGroups=Object.entries(localGroups).filter(([,g])=>g.length!==expected);
          if(badGroups.length){
            throw new Error(`${plan.label}: each passage must contain exactly ${expected} questions. Problem group(s): ${badGroups.map(([id,g])=>`${id}=${g.length}`).join(', ')}`);
          }

          for(const [groupId,g] of Object.entries(localGroups)){
            const ordered=[...g].sort((a,b)=>(a.question_order||0)-(b.question_order||0));
            const orders=ordered.map(x=>x.question_order);
            if(orders.some(n=>!Number.isInteger(n)||n<1||n>expected) || new Set(orders).size!==expected){
              throw new Error(`${plan.label}: passage ${groupId} must have Question Order 1, 2, 3, 4, 5 exactly.`);
            }

            const title=ordered.map(x=>String(x.passage_title||'').trim()).find(Boolean)||'';
            const text=ordered.map(x=>String(x.passage||'').trim()).find(Boolean)||'';
            if(!title)throw new Error(`${plan.label}: passage ${groupId} is missing Passage Title.`);
            if(!text)throw new Error(`${plan.label}: passage ${groupId} is missing the complete Passage text.`);

            for(const x of ordered){
              const rowTitle=String(x.passage_title||'').trim();
              const rowText=String(x.passage||'').trim();
              if(rowTitle && rowTitle!==title)
                throw new Error(`${plan.label}: passage ${groupId} has inconsistent Passage Titles (row ${x.row}).`);
              if(rowText && rowText!==text)
                throw new Error(`${plan.label}: passage ${groupId} has inconsistent Passage text (row ${x.row}).`);
              x.passage_title=title;
              x.passage=text;
            }
          }
        }

        const groupCount=plan.unit==='passage'
          ? Object.keys(localGroups).length
          : items.length/(plan.passageCount||plan.count);
        const ids=await window.mockNextIds(part,lang,groupCount,plan.unit==='passage'?'passage':'set');
        const rows=[];

        if(plan.unit==='passage'){
          let gi=0;
          for(const [,g0] of Object.entries(localGroups)){
            const pid=ids[gi++];
            const g=[...g0].sort((a,b)=>a.question_order-b.question_order);
            g.forEach((x,j)=>rows.push({
              teacher_id:current.id,
              section_code:plan.section,
              part_code:part,
              language:lang,
              set_id:pid,
              question_text:x.question||null,
              option_a:x.A||null,
              option_b:x.B||null,
              option_c:x.C||null,
              option_d:x.D||null,
              correct_option:x.answer,
              passage_text:x.passage||null,
              passage_id:pid,
              passage_title:x.passage_title||null,
              image_url:x.image_url||null,
              source_type:'excel',
              question_order:j+1
            }));
          }
        }else{
          items.forEach((x,i)=>rows.push({
            teacher_id:current.id,
            section_code:plan.section,
            part_code:part,
            language:lang,
            set_id:ids[Math.floor(i/plan.count)],
            question_text:x.question||null,
            option_a:x.A||null,
            option_b:x.B||null,
            option_c:x.C||null,
            option_d:x.D||null,
            correct_option:x.answer,
            passage_text:x.passage||null,
            passage_id:null,
            passage_title:null,
            image_url:x.image_url||null,
            source_type:'excel',
            question_order:(i%plan.count)+1
          }));
        }

        const {data:old,error:oe}=await sb.from('mock_question_bank')
          .select('question_text,option_a,option_b,option_c,option_d,part_code,language')
          .eq('teacher_id',current.id).eq('active',true);
        if(oe)throw oe;
        const seen=new Set((old||[]).map(q=>[
          q.part_code,q.language,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d
        ].map(v=>String(v||'').trim().toLowerCase()).join('¦')));
        const fresh=rows.filter(r=>{
          const k=[r.part_code,r.language,r.question_text,r.option_a,r.option_b,r.option_c,r.option_d]
            .map(v=>String(v||'').trim().toLowerCase()).join('¦');
          if(seen.has(k))return false;
          seen.add(k);
          return true;
        });
        if(fresh.length!==rows.length)
          throw new Error(`${plan.label}: one or more questions are duplicates of active questions already in the bank. The entire upload was rejected so no incomplete set is created.`);

        const {error:ie}=await sb.from('mock_question_bank').insert(rows);
        if(ie)throw ie;
        savedExcel+=rows.length;
      }

      if(mockPdfRows.length){
        const selectedPart=cleanPart(document.getElementById('mockPdfPart')?.value),selectedPlan=mockPlanByPart[selectedPart];
        if(!selectedPlan||!['pdf','excel_or_pdf'].includes(selectedPlan.upload))throw new Error('PDF upload is available only for MAT and Arithmetic.');
        if(selectedPlan.section==='MAT'){
          if(!Object.keys(mockPdfMeta).length)throw new Error('Upload the MAT Answer & Metadata Excel first.');
          const missing=mockPdfRows.map(x=>x.page).filter(n=>!mockPdfMeta[n]);
          if(missing.length)throw new Error('Missing metadata for PDF page(s): '+missing.join(', '));
          const extra=Object.keys(mockPdfMeta).map(Number).filter(n=>n>mockPdfRows.length);
          if(extra.length)throw new Error('MAT Metadata Excel contains Question No(s) not present in this PDF: '+extra.join(', '));
          const byPart={};
          mockPdfRows.forEach(x=>{const m=mockPdfMeta[x.page];(byPart[m.part] ||= []).push(x);});
          const partNames=Object.keys(byPart);
          if(!partNames.length)throw new Error('No MAT questions found in the metadata Excel.');
          for(const [matPart,pages] of Object.entries(byPart)){
            const matPlan=mockPlanByPart[matPart];
            if(!matPlan||matPlan.section!=='MAT')throw new Error(`Invalid MAT Part in metadata: ${matPart}`);
            if(pages.length%4!==0)throw new Error(`${matPlan.label}: ${pages.length} question(s); each MAT part must contain a multiple of 4 questions.`);
            const ids=await window.mockNextIds(matPart,'COMMON',pages.length/4,'set');
            for(let i=0;i<pages.length;i++){
              const x=pages[i],m=mockPdfMeta[x.page],setId=ids[Math.floor(i/4)],path=`${current.id}/${crypto.randomUUID()}.jpg`,url=await uploadMockImage(x.image_data,path);
              const {error}=await sb.from('mock_question_bank').insert({
                teacher_id:current.id,section_code:'MAT',part_code:matPart,topic:m.topic,language:'COMMON',
                set_id:setId,question_order:(i%4)+1,correct_option:m.correctAnswer,marks:m.marks,
                cognitive_level:m.cognitiveLevel,difficulty:m.difficulty,explanation:m.explanation,
                question_text:null,option_a:null,option_b:null,option_c:null,option_d:null,
                image_url:url,source_type:'pdf',source_question_no:x.page
              });
              if(error)throw error;
              savedPdf++;
            }
          }
        }else{
          if(mockPdfRows.length%selectedPlan.count!==0)throw new Error(`${selectedPlan.label}: PDF has ${mockPdfRows.length} pages; required multiple is ${selectedPlan.count}.`);
          const missing=mockPdfRows.map(x=>x.page).filter(n=>!mockAnswerKey[n]);
          if(missing.length)throw new Error('Missing answer key for PDF page(s): '+missing.join(', '));
          const extra=Object.keys(mockAnswerKey).map(Number).filter(n=>n>mockPdfRows.length);
          if(extra.length)throw new Error('Answer key contains question/page number(s) beyond the PDF: '+extra.join(', '));
          const lang=selectedPlan.section==='MAT'?'COMMON':(document.getElementById('mockPdfLanguage')?.value||'ASSAMESE');
          const ids=await window.mockNextIds(selectedPart,lang,mockPdfRows.length/selectedPlan.count,'set');
          for(let i=0;i<mockPdfRows.length;i++){
            const x=mockPdfRows[i],path=`${current.id}/${crypto.randomUUID()}.jpg`,url=await uploadMockImage(x.image_data,path);
            const {error}=await sb.from('mock_question_bank').insert({
              teacher_id:current.id,section_code:selectedPlan.section,part_code:selectedPart,language:lang,
              set_id:ids[Math.floor(i/selectedPlan.count)],question_order:(i%selectedPlan.count)+1,
              correct_option:mockAnswerKey[x.page],image_url:url,source_type:'pdf',source_question_no:x.page
            });
            if(error)throw error;
            savedPdf++;
          }
        }
      }

      notify(`Upload complete: ${savedExcel+savedPdf} new question(s). Permanent Set/Passage IDs were generated automatically.`);
      mockTestManagement();
    }catch(e){
      notify('Upload validation failed: '+(e.message||e));
    }
  };
  window.mockBuildSets=function(qs,plan){if(plan.unit==='passage'){const groups=new Map();(qs||[]).forEach(q=>{const pid=String(q.passage_id||'').trim();if(pid){if(!groups.has(pid))groups.set(pid,[]);groups.get(pid).push(q)}});return [...groups.entries()].filter(([,g])=>g.length===(plan.passageCount||plan.count)).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(([pid,g],i)=>({number:i+1,label:`Passage ${pid}`,set_id:g[0].set_id||pid,questions:[...g].sort(mockSortQuestions)}))}const bySet=new Map();(qs||[]).forEach(q=>{const sid=String(q.set_id||'').trim();if(sid){if(!bySet.has(sid))bySet.set(sid,[]);bySet.get(sid).push(q)}});const explicit=[...bySet.entries()].filter(([,g])=>g.length===(plan.passageCount||plan.count)).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));if(explicit.length)return explicit.map(([sid,g],i)=>({number:i+1,label:`Set ${sid}`,set_id:sid,questions:[...g].sort(mockSortQuestions)}));const sorted=[...(qs||[])].sort(mockSortQuestions),sets=[];for(let i=0;i<sorted.length;i+=plan.count){const group=sorted.slice(i,i+plan.count);if(group.length===plan.count)sets.push({number:sets.length+1,label:`Set ${sets.length+1}`,set_id:`AUTO-${plan.part}-${sets.length+1}`,questions:group})}return sets};
})();

}catch(e){console.error('Teacher add-on 1 failed:',e)}

/* ---- add-on 2 (was inline <script> #5 in main.html) ---- */
try{

(function(){
  // JNVST Question Bank + Mock Test Management use the same passage entity model.
  const PASSAGE_TYPES=new Set(['EVS-PASSAGE','EVS_PASSAGE','LANGUAGE-PASSAGE','LANGUAGE_PASSAGE']);
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toUpperCase().replace(/[\s-]+/g,'_');
  const isPassageType=t=>PASSAGE_TYPES.has(norm(t));
  const cell=(row,names)=>{for(const n of names){if(Object.prototype.hasOwnProperty.call(row,n)&&clean(row[n])!=='')return clean(row[n]);}const keys=Object.keys(row);for(const n of names){const k=keys.find(x=>clean(x).toLowerCase()===clean(n).toLowerCase());if(k&&clean(row[k])!=='')return clean(row[k]);}return '';};
  const bool=v=>['YES','TRUE','1','Y'].includes(norm(v));
  const shortId=()=>crypto.randomUUID().replace(/-/g,'').slice(0,10).toUpperCase();
  const passagePart=t=>norm(t)==='LANGUAGE_PASSAGE'?'LANGUAGE_PASSAGE':'EVS_PASSAGE';
  const sectionFor=part=>part==='LANGUAGE_PASSAGE'?'LANGUAGE':'EVS';
  const escx=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  window.downloadJnvstQuestionTemplate=function(){
    if(typeof XLSX==='undefined')return notify('Excel library is not loaded.');
    const wb=XLSX.utils.book_new();
    const headers=['Subject Name','Part','Medium','Lesson Code','Topic','Variation Group','Fixed Question','Question Type','Marks','Cognitive Level','Difficulty','Local Passage No.','Question Order','Passage Title English','Passage English','Passage Title Assamese','Passage Assamese','Question English','Question Assamese','Option A English','Option B English','Option C English','Option D English','Option A Assamese','Option B Assamese','Option C Assamese','Option D Assamese','Correct Answer','Explanation'];
    const rows=[headers,
      ['EVS','EVS_MCQ','ENGLISH','EVS-1','Environment','','NO','MCQ',1,'Knowledge','Medium','','','','','','','Which gas do plants use?','','Oxygen','Carbon dioxide','Nitrogen','Hydrogen','','','','','','B',''],
      ['EVS','EVS_PASSAGE','ENGLISH','EVS-1','Environment','','NO','EVS-PASSAGE',1,'Understanding','Medium','P001',1,'Our Environment','Paste the complete English passage here.','','','What is the main idea of the passage?','','Clean air','Water','Environment','Noise','','','','','','C',''],
      ['EVS','EVS_PASSAGE','ENGLISH','EVS-1','Environment','','NO','EVS-PASSAGE',1,'Understanding','Medium','P001',2,'','','','','','Question 2 based on the same passage','','Option A','Option B','Option C','Option D','','','','','','A',''],
      ['EVS','EVS_PASSAGE','ENGLISH','EVS-1','Environment','','NO','EVS-PASSAGE',1,'Application','Medium','P001',3,'','','','','','Question 3 based on the same passage','','Option A','Option B','Option C','Option D','','','','','','D',''],
      ['EVS','EVS_PASSAGE','ENGLISH','EVS-1','Environment','','NO','EVS-PASSAGE',1,'Knowledge','Medium','P001',4,'','','','','','Question 4 based on the same passage','','Option A','Option B','Option C','Option D','','','','','','B',''],
      ['EVS','EVS_PASSAGE','ENGLISH','EVS-1','Environment','','NO','EVS-PASSAGE',1,'Understanding','Medium','P001',5,'','','','','','Question 5 based on the same passage','','Option A','Option B','Option C','Option D','','','','','','C',''],
      ['Arithmetic','ARITHMETIC','ENGLISH','AR-1','Place Value','NUM-001','NO','MCQ',1,'Knowledge','Medium','','','','','','','Find the value of \\frac{3}{4}+\\frac{1}{2}.','','1000','500','50','5','','','','','','A','']
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=headers.map((h,i)=>({wch:i>=12&&i<=15?32:i>=16?28:20}));XLSX.utils.book_append_sheet(wb,ws,'JNVST Questions');
    const ins=[['JNVST Question Bank — Bulk Upload Instructions'],['One Excel row represents one question.'],['Bilingual upload: put English and Assamese question/options in the SAME row. The importer creates linked language records automatically.'],['Normal MCQ/Short/Long: leave Local Passage No., Question Order and passage columns blank.'],['Passage questions: set Question Type to EVS-PASSAGE or LANGUAGE-PASSAGE.'],['For every passage question row, Local Passage No. is REQUIRED. Use the SAME number for exactly 5 rows.'],['Question Order must be 1, 2, 3, 4, 5 for each passage.'],['Passage Title English + Passage English are required for the first English row; they may be repeated on all five rows.'],['Passage Title Assamese + Passage Assamese are required for the first Assamese row; they may be repeated on all five rows.'],['The five questions plus their passage are stored and displayed as ONE complete passage entity.'],['English and Assamese passage versions from the same Excel row are linked using language_pair_id.'],['You may enter LaTeX-style mathematics such as \\frac{3}{4}, x^2, \\sqrt{16}, \\times and \\div.'],['Part is required for reliable paper generation. Use EVS_MCQ for individual EVS MCQs, EVS_PASSAGE for EVS passage groups, LANGUAGE_PASSAGE for Language passages, ARITHMETIC for Arithmetic, and the appropriate MAT part for MAT. If Part is blank, the importer infers it from Subject/Question Type.'],['Part is important for paper generation: EVS individual MCQ = EVS_MCQ; EVS passage = EVS_PASSAGE; Language passage = LANGUAGE_PASSAGE; Arithmetic = ARITHMETIC; MAT uses its selected MAT part. If Part is blank, the importer infers it from Subject/Question Type.'],['Subject Name and Lesson Code must exactly match existing JNVST Subject/Lesson records.'],['This upload writes to mock_question_bank only; School Course questions are not affected.']];
    XJ=XLSX.utils.aoa_to_sheet(ins);XLSX.utils.book_append_sheet(wb,XJ,'Instructions');
    XLSX.writeFile(wb,'JNVST_Question_Bank_Bulk_Upload_Template.xlsx');
  };

  window.readJnvstQuestionExcel=function(ev){
    const f=ev.target.files?.[0],box=document.getElementById('jnvstQbBulkPreview'),btn=document.getElementById('jnvstQbImportBtn');if(!f||!box)return;btn.disabled=true;
    const r=new FileReader();r.onload=e=>{try{
      const wb=XLSX.read(e.target.result,{type:'array'}),ws=wb.Sheets[wb.SheetNames.find(n=>String(n).toLowerCase().includes('question'))||wb.SheetNames[0]],raw=XLSX.utils.sheet_to_json(ws,{defval:''});
      jnvstQbBulkRows=raw.map((x,i)=>({row:i+2,subject:cell(x,['Subject Name','Subject']),part:cell(x,['Part','Part Code','Section Part']),medium:cell(x,['Medium']).toUpperCase(),lessonCode:cell(x,['Lesson Code','Lesson']),topic:cell(x,['Topic']),group:cell(x,['Variation Group','Fixed Question Group']),fixed:cell(x,['Fixed Question','Is Fixed']).toUpperCase(),type:cell(x,['Question Type'])||'MCQ',marks:Number(cell(x,['Marks']))||1,cognitive:cell(x,['Cognitive Level'])||'Knowledge',difficulty:cell(x,['Difficulty'])||'Medium',localPassageNo:cell(x,['Local Passage No.','Local Passage Number','Passage No.','Passage Number']),questionOrder:Number(cell(x,['Question Order','Passage Question Order','Question No','Question Number','Order']))||null,passageTitleEn:cell(x,['Passage Title English','English Passage Title']),passageEn:cell(x,['Passage English','English Passage','Passage Text English']),passageTitleAs:cell(x,['Passage Title Assamese','Assamese Passage Title']),passageAs:cell(x,['Passage Assamese','Assamese Passage','Passage Text Assamese']),en:jnvstNormalizeMathText(cell(x,['Question English','Question','English'])),as:jnvstNormalizeMathText(cell(x,['Question Assamese','Assamese'])),aen:jnvstNormalizeMathText(cell(x,['Option A English','A','Option A'])),ben:jnvstNormalizeMathText(cell(x,['Option B English','B','Option B'])),cen:jnvstNormalizeMathText(cell(x,['Option C English','C','Option C'])),den:jnvstNormalizeMathText(cell(x,['Option D English','D','Option D'])),aas:jnvstNormalizeMathText(cell(x,['Option A Assamese'])),bas:jnvstNormalizeMathText(cell(x,['Option B Assamese'])),cas:jnvstNormalizeMathText(cell(x,['Option C Assamese'])),das:jnvstNormalizeMathText(cell(x,['Option D Assamese'])),answer:cell(x,['Correct Answer','Answer']).toUpperCase(),explanation:jnvstNormalizeMathText(cell(x,['Explanation']))})).filter(x=>x.en||x.as);
      const subjMap=new Map((jnvstSubjects||[]).map(s=>[String(s.name).trim().toLowerCase(),s]));const errs=[];const groups=new Map();
      jnvstQbBulkRows.forEach(x=>{
        if(!subjMap.has(x.subject.toLowerCase()))errs.push(`Row ${x.row}: Subject not found: ${x.subject}`);const so=subjMap.get(x.subject.toLowerCase());
        if(so&&!jnvstSubjectLessons.some(l=>l.subject_id===so.id&&String(l.lesson_code).toLowerCase()===x.lessonCode.toLowerCase()))errs.push(`Row ${x.row}: Lesson Code ${x.lessonCode} not found under ${x.subject}`);
        if(!['COMMON','ENGLISH','ASSAMESE'].includes(x.medium))errs.push(`Row ${x.row}: Medium must be COMMON, ENGLISH or ASSAMESE.`);const partNorm=norm(x.part);if(x.part && !['EVS_MCQ','EVS_PASSAGE','LANGUAGE_MCQ','LANGUAGE_PASSAGE','ARITHMETIC','MAT_PATTERN','MAT_SERIES','MAT_GEOMETRICAL','MAT_MIRROR','MAT_EMBEDDED'].includes(partNorm))errs.push(`Row ${x.row}: Invalid Part: ${x.part}`);
        if(x.fixed&&!['YES','NO','TRUE','FALSE','1','0','Y'].includes(x.fixed))errs.push(`Row ${x.row}: Fixed Question must be YES or NO.`);
        if(!['MCQ','Short','Long',...PASSAGE_TYPES].includes(x.type)&&!PASSAGE_TYPES.has(norm(x.type)))errs.push(`Row ${x.row}: invalid Question Type.`);
        if(isPassageType(x.type)){
          if(!x.localPassageNo)errs.push(`Row ${x.row}: Local Passage No. is required for passage questions.`);
          if(![1,2,3,4,5].includes(Number(x.questionOrder)))errs.push(`Row ${x.row}: Passage Question Order must be 1–5.`);
          const key=`${norm(x.type)}::${x.localPassageNo}`;(groups.get(key)||groups.set(key,[]).get(key)).push(x);
        } else if(x.type==='MCQ'&&!['A','B','C','D'].includes(x.answer))errs.push(`Row ${x.row}: MCQ Correct Answer must be A/B/C/D.`);
      });
      for(const [key,g] of groups){const orders=g.map(x=>x.questionOrder).sort((a,b)=>a-b);if(g.length!==5)errs.push(`${key}: passage must contain exactly 5 question rows; found ${g.length}.`);if(orders.join(',')!=='1,2,3,4,5')errs.push(`${key}: Question Order must contain exactly 1,2,3,4,5.`);const langs=[...new Set(g.flatMap(x=>[x.en?'ENGLISH':null,x.as?'ASSAMESE':null]).filter(Boolean))];for(const lang of langs){const relevant=g.filter(x=>lang==='ENGLISH'?x.en:x.as);if(relevant.length!==5)errs.push(`${key}: ${lang} passage must have all 5 language questions.`);const first=relevant[0];if(lang==='ENGLISH'&&(!first.passageEn||!first.passageTitleEn))errs.push(`${key}: English Passage Title and Passage English are required.`);if(lang==='ASSAMESE'&&(!first.passageAs||!first.passageTitleAs))errs.push(`${key}: Assamese Passage Title and Passage Assamese are required.`);}}
      const passCount=groups.size;box.innerHTML=errs.length?message(`<b>Validation failed.</b><br>${errs.slice(0,40).map(escx).join('<br>')}`):message(`<b>${jnvstQbBulkRows.length} question row(s) ready.</b> ${passCount} complete passage group(s) detected. Passage = passage text + exactly 5 questions.`,true);btn.disabled=!!errs.length||!jnvstQbBulkRows.length;
    }catch(err){box.innerHTML=message('Could not read Excel: '+err.message)}};r.readAsArrayBuffer(f);
  };

  window.saveJnvstQuestionBulk=async function(){
    if(!jnvstQbBulkRows.length||document.getElementById('jnvstBulkUploadLock'))return;
    jnvstBulkUploadLock('Uploading JNVST questions…','The Excel data is being validated and uploaded to the server. Please do not click Upload again.');jnvstBulkUploadProgress(10,'Preparing upload…');
    const subjMap=new Map((jnvstSubjects||[]).map(s=>[String(s.name).trim().toLowerCase(),s]));const cleanv=v=>String(v??'').trim();let ok=0,skip=0;
    try{
      const prepared=[];const groupIds=new Map();
      for(const r of jnvstQbBulkRows){
        const subj=subjMap.get(r.subject.toLowerCase());if(!subj)throw new Error(`Row ${r.row}: Subject not found: ${r.subject}`);
        const lesson=(jnvstSubjectLessons||[]).find(l=>l.subject_id===subj.id&&String(l.lesson_code).toLowerCase()===r.lessonCode.toLowerCase());if(!lesson)throw new Error(`Row ${r.row}: Lesson Code ${r.lessonCode} not found under ${r.subject}`);
        const typeNorm=norm(r.type);const passage=isPassageType(r.type);let part=norm(r.part);if(passage)part=passagePart(r.type);else if(!part){const subjName=String(r.subject).toUpperCase();part=subjName.includes('LANGUAGE')?'LANGUAGE':subjName.includes('EVS')?'EVS_MCQ':subjName.includes('ARITHMETIC')?'ARITHMETIC':'MAT';}if(part==='EVS')part='EVS_MCQ';if(part==='LANGUAGE' && !passage)part='LANGUAGE_MCQ';
        const versions=[];if(r.en)versions.push({language:part==='MAT'?'COMMON':'ENGLISH',question:r.en,a:r.aen,b:r.ben,c:r.cen,d:r.den,pt:r.passageTitleEn,px:r.passageEn});if(r.as)versions.push({language:part==='MAT'?'COMMON':'ASSAMESE',question:r.as,a:r.aas,b:r.bas,c:r.cas,d:r.das,pt:r.passageTitleAs,px:r.passageAs});
        if(!versions.length)continue;
        const groupKey=passage?`${typeNorm}::${r.localPassageNo}`:null;
        for(const v of versions){
          let passageId=null,languagePairId=null,questionOrder=null,passageTitle=null,passageText=null;
          if(passage){const pairKey=`${groupKey}::${v.language}`;if(!groupIds.has(pairKey))groupIds.set(pairKey,{passageId:`JNVST-${passagePart(r.type)==='EVS_PASSAGE'?'EVS':'LANG'}-${v.language[0]}-${shortId()}`,pairId:crypto.randomUUID()});const g=groupIds.get(pairKey);passageId=g.passageId;languagePairId=g.pairId;questionOrder=r.questionOrder;passageTitle=v.pt||null;passageText=v.px||null;}
          prepared.push({teacher_id:current.id,section_code:sectionFor(part),part_code:part,topic:r.topic||null,variation_group:r.group||null,is_fixed:bool(r.fixed),question_type:passage?(part==='EVS_PASSAGE'?'EVS-PASSAGE':'LANGUAGE-PASSAGE'):r.type,marks:r.marks||1,cognitive_level:r.cognitive||null,difficulty:r.difficulty||null,language:v.language,subject_id:subj.id,lesson_id:lesson.id,lesson_code:r.lessonCode,question_text:v.question||null,option_a:v.a||null,option_b:v.b||null,option_c:v.c||null,option_d:v.d||null,correct_option:r.type==='MCQ'?r.answer:'A',explanation:r.explanation||null,source_type:'JNVST_BULK',active:true,passage_id:passageId,passage_title:passageTitle,passage_text:passageText,question_order:questionOrder,language_pair_id:languagePairId,set_id:passageId});
        }
      }
      const {data:old,error:oe}=await sb.from('mock_question_bank').select('id,question_text,option_a,option_b,option_c,option_d,subject_id,lesson_id,language,passage_id,question_order').eq('teacher_id',current.id).eq('active',true);if(oe)throw oe;
      const seen=new Set((old||[]).map(q=>[q.subject_id,q.lesson_id,q.language,q.passage_id,q.question_order,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d].map(v=>cleanv(v).toLowerCase()).join('¦')));const fresh=[];for(const r of prepared){const k=[r.subject_id,r.lesson_id,r.language,r.passage_id,r.question_order,r.question_text,r.option_a,r.option_b,r.option_c,r.option_d].map(v=>cleanv(v).toLowerCase()).join('¦');if(seen.has(k)){skip++;continue;}seen.add(k);fresh.push(r);}
      if(!fresh.length)throw new Error('All uploaded questions are already present. No new questions were added.');jnvstBulkUploadProgress(65,'Sending questions to the server…');const {error}=await sb.from('mock_question_bank').insert(fresh);if(error)throw error;ok=fresh.length;const logicalGroups=new Set(fresh.map(x=>x.passage_id).filter(Boolean)).size;jnvstBulkUploadProgress(100,'Upload complete.');setTimeout(()=>{jnvstBulkUploadUnlock();notify(`JNVST import complete.\nAdded: ${ok} language record(s)\nComplete passage entities: ${logicalGroups}\nSkipped duplicates: ${skip}\n\nPassage questions are stored as one entity: passage + 5 questions. English and Assamese versions are linked automatically.`);jnvstQuestionBankHome()},350);
    }catch(e){jnvstBulkUploadUnlock();notify('JNVST import stopped: '+(e.message||e));}
  };

  // Replace the upload page text so users see the same passage rules as Mock Test Management.
  const oldJ=window.jnvstQuestionBulkUpload;
  window.jnvstQuestionBulkUpload=function(){
    if(typeof oldJ!=='function')return;
    oldJ();
    setTimeout(()=>{
      const host=document.getElementById('jnvstQbBulkPreview');if(!host)return;
      const card=host.closest('.card');if(card){const n=document.createElement('div');n.className='notice';n.style.marginTop='10px';n.innerHTML='<b>Passage upload rule — same as Mock Test Management:</b> Set Question Type to <b>EVS-PASSAGE</b> or <b>LANGUAGE-PASSAGE</b>, enter the same <b>Local Passage No.</b> on exactly 5 rows, use Question Order 1–5, and provide the passage text/title. The complete passage + 5 questions is treated as one entity and displayed together.';card.insertBefore(n,host);}
    },0);
  };
})();


}catch(e){console.error('Teacher add-on 2 failed:',e)}

/* ---- add-on 3 (was inline <script> #6 in main.html) ---- */
try{

/* JNVST + Question Paper Passage Entity UI Fix v2026-10-03
   Passage is always treated as: passage + exactly 5 linked questions.
*/
(function(){
  const PTYPE=v=>{const s=String(v||'').toUpperCase().replace(/[\s-]+/g,'_');return s==='EVS_PASSAGE'||s==='LANGUAGE_PASSAGE';};
  const PKEY=q=>{
    const pid=String(q?.passage_id||'').trim(); if(pid)return `PID::${pid}`;
    const sid=String(q?.set_id||'').trim(); if(PType(q?.part_code)&&sid)return `SID::${sid}`;
    const title=String(q?.passage_title||'').trim();
    const text=String(q?.passage_text||'').trim();
    if(title||text)return `TEXT::${String(q?.part_code||'').toUpperCase()}::${String(q?.language||'').toUpperCase()}::${title}::${text}`;
    return '';
  };
  function PType(v){return PTYPE(v)}
  function groupPassages(rows){
    const map=new Map();
    (rows||[]).filter(q=>PTYPE(q.part_code)||String(q.passage_id||'').trim()).forEach(q=>{
      const key=PKEY(q); if(!key)return;
      if(!map.has(key))map.set(key,[]);map.get(key).push(q);
    });
    return [...map.entries()].map(([key,qs])=>{
      qs.sort((a,b)=>(Number(a.question_order)||999)-(Number(b.question_order)||999));
      const first=qs[0]||{};
      return {key,id:first.passage_id||first.set_id||key,title:first.passage_title||'Passage',text:qs.map(x=>String(x.passage_text||'').trim()).find(Boolean)||'',questions:qs};
    });
  }
  function completePassages(rows){return groupPassages(rows).filter(g=>g.questions.length===5 && new Set(g.questions.map(q=>Number(q.question_order)||0)).size===5);}
  function jpreview(q){
    const image=q?.image_url?`<img src="${esc(q.image_url)}" alt="Question image" loading="lazy" onclick="openMockQuestionImage('${esc(q.image_url)}','Question image')" style="display:block;max-width:220px;max-height:150px;object-fit:contain;border:1px solid #cbd5e1;border-radius:8px;padding:3px;background:#fff;cursor:zoom-in;margin:5px 0">`:'';
    const text=q?.question_text&&q.question_text!=='[IMAGE QUESTION]'?`<div style="line-height:1.5;margin:5px 0">${jnvstMathPreview(q.question_text)}</div>`:'';
    const opts=['A','B','C','D'].map(o=>{const v=q?.['option_'+o.toLowerCase()];return v?`<div style="margin:4px 0"><b>(${o})</b> ${jnvstMathPreview(v)}</div>`:''}).join('');
    return image+text+opts;
  }
  function passageCard(g,actions){
    const first=g.questions[0]||{};
    return `<div style="border:2px solid #c7d2fe;border-radius:14px;padding:14px;margin:12px 0;background:#f8fafc">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><span class="tag">COMPLETE PASSAGE ENTITY</span><h3 style="margin:7px 0 3px">${esc(g.title||'Passage')}</h3><div class="small muted">${esc(g.id)} · 5 linked questions · ${esc(first.language||'')}</div></div>${actions||''}</div>
      <div style="margin:10px 0;padding:12px;border-radius:10px;background:#fff;border:1px solid #cbd5e1"><b>PASSAGE</b><div style="margin-top:7px;line-height:1.6">${jnvstMathPreview(g.text||'')}</div></div>
      ${g.questions.map((q,i)=>`<div style="margin:8px 0;padding:11px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><div><b>Question ${i+1}</b> <span class="small muted">${esc(q.question_type||'MCQ')} · ${esc(q.question_order||i+1)}</span></div>${jpreview(q)}</div>`).join('')}
    </div>`;
  }

  /* ---------- JNVST Question Bank: group display ---------- */
  window.jnvstQbRenderTable=function(){
    const box=document.getElementById('jnvstQbTable');if(!box)return;
    const currentLesson=document.getElementById('jnvstQbLessonFilter')?.value||'';
    jnvstQbRefreshLessonFilter(currentLesson);
    const rows=jnvstQbFilteredRows();
    const matchedIds=new Set(rows.map(q=>q.id));
    // If a filter/search matches one member of a passage, expand it back to the complete 5-question entity.
    const groups=completePassages(jnvstQbCache).filter(g=>g.questions.some(q=>matchedIds.has(q.id)));
    const groupedKeys=new Set(groups.flatMap(g=>g.questions.map(q=>q.id)));
    const normal=rows.filter(q=>!groupedKeys.has(q.id));
    const allVisibleSelected=rows.length>0&&rows.every(q=>jnvstQbSelected.has(q.id));
    const groupHtml=groups.map(g=>{
      const allSel=g.questions.every(q=>jnvstQbSelected.has(q.id));
      const first=g.questions[0]||{};
      const actions=`<div class="actions"><label style="display:flex;align-items:center;gap:5px;margin:0"><input type="checkbox" style="width:auto" ${allSel?'checked':''} onchange="jnvstQbTogglePassageGroup('${esc(g.id)}',this.checked)"> Select Group</label><button onclick="jnvstQbEditPassage('${esc(first.id)}')">✎ Edit Complete Block</button><button class="danger" onclick="jnvstQbDeletePassage('${esc(first.id)}')">🗑 Delete Group</button></div>`;
      return passageCard(g,actions);
    }).join('');
    const normalHtml=normal.length?`<div style="overflow:auto"><table><thead><tr><th><input type="checkbox" ${allVisibleSelected?'checked':''} onchange="jnvstQbToggleVisible(this.checked)"></th><th>#</th><th>Question</th><th>Subject</th><th>Medium</th><th>Lesson / Sub-lesson</th><th>Topic</th><th>Variation / Fixed</th><th>Actions</th></tr></thead><tbody>${normal.map((q,i)=>{const sj=(jnvstSubjects||[]).find(x=>x.id===q.subject_id),l=(jnvstSubjectLessons||[]).find(x=>x.id===q.lesson_id);return `<tr><td><input type="checkbox" ${jnvstQbSelected.has(q.id)?'checked':''} onchange="jnvstQbToggleSelection('${esc(q.id)}',this.checked)"></td><td>${i+1}</td><td style="min-width:240px">${jnvstQbQuestionPreview(q)}</td><td>${esc(sj?.name||'—')}</td><td>${esc(q.language||'—')}</td><td>${esc(l?`${l.lesson_code||''} ${l.lesson_name}`:'—')}</td><td>${esc(q.topic||'—')}</td><td style="min-width:180px"><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start"><select title="Change Variation Group directly" style="min-width:155px" onchange="jnvstQbInlineVariationChange('${esc(q.id)}',this.value)">${jnvstQbVariationOptions(String(q.variation_group||''))}</select>${q.variation_group?`<button type="button" class="secondary" style="padding:5px 9px;font-size:12px" onclick="jnvstQbShowVariation('${esc(q.variation_group)}')" title="Show all questions in ${esc(q.variation_group)}">🔎 Show Group</button>`:''}${q.is_fixed?' <span class="tag">Fixed</span>':''}</div></td><td><div class="actions"><button onclick="jnvstQbEdit('${esc(q.id)}')">✎ Edit</button><button class="danger" onclick="jnvstQbDeleteOne('${esc(q.id)}')">🗑 Delete</button></div></td></tr>`}).join('')}</tbody></table></div>`:'';
    box.innerHTML=`<div class="small muted" style="margin-bottom:8px">${rows.length} question row(s) · <b>${groups.length}</b> complete passage group(s) · <b>${jnvstQbSelected.size}</b> selected</div>${groupHtml}${normalHtml||(!groupHtml?'<div class="muted">No questions found.</div>':'')}`;
    jnvstQbUpdateSelectionCount();if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise([box]).catch(()=>{});
  };
  window.jnvstQbTogglePassageGroup=function(groupId,checked){
    const all=completePassages(jnvstQbCache).find(g=>String(g.id)===String(groupId));if(!all)return;
    all.questions.forEach(q=>checked?jnvstQbSelected.add(q.id):jnvstQbSelected.delete(q.id));jnvstQbRenderTable();
  };
  window.jnvstQbEditPassage=async function(id){
    const anchor=jnvstQbCache.find(q=>q.id===id);if(!anchor)return notify('Passage question not found.');
    const group=completePassages(jnvstQbCache).find(g=>g.questions.some(q=>q.id===id));
    if(!group)return notify('This passage is incomplete. Expected exactly 5 linked questions.');
    const subj=(jnvstSubjects||[]).find(s=>s.id===anchor.subject_id),lesson=(jnvstSubjectLessons||[]).find(l=>l.id===anchor.lesson_id);
    const qCards=group.questions.map((q,i)=>`<div class="jnvst-editor-section" style="margin-top:14px"><h3>Question ${i+1}</h3><div class="grid"><div><label>Topic</label><input id="pgTopic_${i}" value="${esc(q.topic||'')}"></div><div><label>Marks</label><input id="pgMarks_${i}" type="number" min="0" step="0.5" value="${Number(q.marks??1)}"></div><div><label>Cognitive Level</label><select id="pgCog_${i}">${['Knowledge','Understanding','Application','HOTS'].map(v=>`<option ${q.cognitive_level===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label>Difficulty</label><select id="pgDiff_${i}">${['Easy','Medium','Hard'].map(v=>`<option ${q.difficulty===v?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('pgQ_${i}')">∑ Equation Editor</button></div><textarea id="pgQ_${i}" rows="5" oninput="jnvstRefreshMathPreview('pgQP_${i}',this.value)">${esc(q.question_text||'')}</textarea><div id="pgQP_${i}" class="eq-preview">${jnvstMathPreview(q.question_text||'')}</div><div class="grid">${['A','B','C','D'].map(o=>`<div><label>Option ${o}</label><textarea id="pg${o}_${i}" rows="2" oninput="jnvstRefreshMathPreview('pg${o}P_${i}',this.value)">${esc(q['option_'+o.toLowerCase()]||'')}</textarea><div id="pg${o}P_${i}" class="eq-preview">${jnvstMathPreview(q['option_'+o.toLowerCase()]||'')}</div></div>`).join('')}</div><div class="grid"><div><label>Correct Answer</label><select id="pgAns_${i}">${['A','B','C','D'].map(v=>`<option ${q.correct_option===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label>Variation Group</label><input id="pgVar_${i}" value="${esc(q.variation_group||'')}"></div><div><label>Fixed Question</label><label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input id="pgFixed_${i}" type="checkbox" style="width:auto" ${q.is_fixed?'checked':''}> Fixed</label></div></div><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('pgEx_${i}')">∑ Equation Editor</button></div><textarea id="pgEx_${i}" rows="3" placeholder="Explanation">${esc(q.explanation||'')}</textarea><label>Question Image</label><input id="pgImg_${i}" type="file" accept="image/*"></div>`).join('');
    render(`<div class="wrap">${header('Edit Complete JNVST Passage Entity')}<div class="card"><div class="notice"><b>Complete passage block:</b> The passage and all 5 linked questions are shown here together. Saving updates the complete entity.</div><div class="grid"><div><label>Subject</label><input value="${esc(subj?.name||'')}" disabled></div><div><label>Lesson / Sub-lesson</label><input value="${esc(`${lesson?.lesson_code||''} ${lesson?.lesson_name||''}`.trim())}" disabled></div><div><label>Medium</label><input value="${esc(anchor.language||'')}" disabled></div></div><label>Passage Title</label><input id="pgTitle" value="${esc(group.title||'')}"><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('pgPassage')">∑ Equation Editor</button></div><textarea id="pgPassage" rows="10" oninput="jnvstRefreshMathPreview('pgPassagePreview',this.value)">${esc(group.text||'')}</textarea><div id="pgPassagePreview" class="eq-preview">${jnvstMathPreview(group.text||'')}</div>${qCards}<div class="actions"><button onclick="jnvstQbSavePassage('${esc(group.id)}','${esc(anchor.part_code)}')">💾 Save Complete Passage + 5 Questions</button><button class="secondary" onclick="jnvstQuestionBankHome()">Cancel</button></div></div></div>`);if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
  };
  window.jnvstQbSavePassage=async function(groupId,part){
    const group=completePassages(jnvstQbCache).find(g=>String(g.id)===String(groupId));if(!group)return notify('Passage group not found.');
    const title=String(document.getElementById('pgTitle')?.value||'').trim(),text=String(document.getElementById('pgPassage')?.value||'').trim();if(!title||!text)return notify('Passage title and passage text are required.');
    try{
      for(let i=0;i<group.questions.length;i++){
        const q=group.questions[i];let imageUrl=q.image_url||null;const file=document.getElementById(`pgImg_${i}`)?.files?.[0];if(file)imageUrl=await uploadMockFile(file,`${current.id}/jnvst-passage-edit/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`);
        const payload={passage_title:title,passage_text:text,topic:String(document.getElementById(`pgTopic_${i}`)?.value||'').trim()||null,marks:Number(document.getElementById(`pgMarks_${i}`)?.value||1),cognitive_level:document.getElementById(`pgCog_${i}`)?.value||null,difficulty:document.getElementById(`pgDiff_${i}`)?.value||null,variation_group:String(document.getElementById(`pgVar_${i}`)?.value||'').trim()||null,is_fixed:!!document.getElementById(`pgFixed_${i}`)?.checked,question_text:String(document.getElementById(`pgQ_${i}`)?.value||'').trim()||null,option_a:String(document.getElementById(`pgA_${i}`)?.value||'').trim()||null,option_b:String(document.getElementById(`pgB_${i}`)?.value||'').trim()||null,option_c:String(document.getElementById(`pgC_${i}`)?.value||'').trim()||null,option_d:String(document.getElementById(`pgD_${i}`)?.value||'').trim()||null,correct_option:document.getElementById(`pgAns_${i}`)?.value||q.correct_option,explanation:String(document.getElementById(`pgEx_${i}`)?.value||'').trim()||null,image_url:imageUrl};
        const {error}=await sb.from('mock_question_bank').update(payload).eq('id',q.id).eq('teacher_id',current.id);if(error)throw error;
      }
      notify('Complete passage entity updated: passage + all 5 questions.');await jnvstQuestionBankHome();
    }catch(e){notify('Could not save complete passage: '+(e.message||e));}
  };
  window.jnvstQbDeletePassage=async function(id){
    const anchor=jnvstQbCache.find(q=>q.id===id);const group=anchor&&completePassages(jnvstQbCache).find(g=>g.questions.some(q=>q.id===id));if(!group)return notify('Complete passage group not found.');await jnvstQbDeleteIds(group.questions.map(q=>q.id),'this complete passage entity');
  };
  const oldEdit=window.jnvstQbEdit;
  window.jnvstQbEdit=async function(id){const q=jnvstQbCache.find(x=>x.id===id);if(q&&(PTYPE(q.part_code)||q.passage_id)){return jnvstQbEditPassage(id);}return oldEdit(id);};
  const oldDeleteOne=window.jnvstQbDeleteOne;
  window.jnvstQbDeleteOne=async function(id){const q=jnvstQbCache.find(x=>x.id===id);if(q&&(PTYPE(q.part_code)||q.passage_id)){return jnvstQbDeletePassage(id);}return oldDeleteOne(id);};

  /* ---------- Question Paper Generator: robust complete passage detection ---------- */
  window.qpIsPassage=function(q){return PTYPE(q?.part_code)||!!String(q?.passage_id||'').trim()||!!String(q?.passage_title||'').trim()||!!String(q?.passage_text||'').trim();};
  window.qpPassageGroups=function(rows){
    const groups=groupPassages(rows);
    return groups.map(g=>({id:g.id,questions:g.questions,title:g.title,text:g.text}));
  };
  function qpCompleteGroups(rows){return qpPassageGroups(rows).filter(g=>g.questions.length===5 && g.questions.map(q=>Number(q.question_order)||0).sort((a,b)=>a-b).join(',')==='1,2,3,4,5');}
  function qpPassageGroupMatches(g,search){return !search||[g.id,g.title,g.text,...g.questions.map(q=>q.question_text)].some(v=>qpNorm(v).toLowerCase().includes(search));}
  window.qpRefreshEVSPools=function(){
    const search=qpNorm(document.getElementById('qpQuestionSearch')?.value).toLowerCase();
    const mcqs=qpState.bank.filter(q=>qpIsEVSMCQ(q)).filter(q=>!search||[q.question_text,q.topic,q.part_code].some(v=>qpNorm(v).toLowerCase().includes(search)));
    const wrap=document.getElementById('qpEvsQuestionList');if(wrap)wrap.innerHTML=mcqs.slice(0,500).map(q=>`<label class="assignment" style="display:flex;gap:8px;align-items:flex-start;margin:4px 0;padding:7px"><input type="checkbox" ${qpState.selected.has(q.id)?'checked':''} onchange="qpMandatoryChanged('${esc(q.id)}',this.checked)"><span style="flex:1;min-width:0">${teacherQuestionPreview(q)} <span class="muted small">— ${esc(q.id)}</span></span></label>`).join('')||'<div class="muted">No EVS MCQs found.</div>';
    const groups=qpCompleteGroups(qpState.bank.filter(q=>qpIsEVSPassageQuestion(q))).filter(g=>qpPassageGroupMatches(g,search));
    const pp=document.getElementById('qpPassageList');if(pp)pp.innerHTML=groups.length?groups.map(g=>`${passageCard(g,`<label style="display:flex;gap:8px;align-items:center;margin-top:9px"><input type="checkbox" ${g.questions.every(q=>qpState.selected.has(q.id))?'checked':''} onchange="qpToggleMandatoryPassage('${esc(g.id)}',this.checked)"><b>Select complete 5-question passage entity</b></label>`)}`).join(''):'<div class="muted">No complete EVS passage groups found. A valid group requires the same Passage ID/Set ID and Question Order 1–5.</div>';
    const sets=Number(document.getElementById('qpEvsSetCount')?.value||1),direct=15*sets,mandDirect=[...qpState.selected].filter(id=>{const q=qpState.bank.find(x=>x.id===id);return qpIsEVSMCQ(q)}).length,mandPass=[...new Set([...qpState.selected].map(id=>qpState.bank.find(x=>x.id===id)?.passage_id||qpState.bank.find(x=>x.id===id)?.set_id).filter(Boolean))];const sum=document.getElementById('qpEvsSummary');if(sum)sum.innerHTML=`Required: <b>${direct} EVS MCQs + ${sets} passage set(s)</b>. Mandatory: <b>${mandDirect} MCQs + ${mandPass.length} passage(s)</b>. Random: <b>${Math.max(0,direct-mandDirect)} MCQs + ${Math.max(0,sets-mandPass.length)} passage(s)</b>. Available complete passages: ${groups.length}`;
    if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
  };
  window.qpRefreshLanguagePool=function(){
    const search=qpNorm(document.getElementById('qpQuestionSearch')?.value).toLowerCase();const groups=qpCompleteGroups(qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&String(q.part_code||'').toUpperCase().replace(/-/g,'_')==='LANGUAGE_PASSAGE')).filter(g=>qpPassageGroupMatches(g,search));
    const wrap=document.getElementById('qpLanguageQuestionList');if(wrap)wrap.innerHTML=groups.length?groups.map(g=>passageCard(g,`<label style="display:flex;gap:8px;align-items:center;margin-top:9px"><input type="checkbox" ${g.questions.every(q=>qpState.selected.has(q.id))?'checked':''} onchange="qpToggleMandatoryPassage('${esc(g.id)}',this.checked)"><b>Select complete 5-question passage entity</b></label>`)).join(''):'<div class="muted">No complete Language passage groups found.</div>';
    const mandPass=[...new Set([...qpState.selected].map(id=>qpState.bank.find(x=>x.id===id)?.passage_id||qpState.bank.find(x=>x.id===id)?.set_id).filter(Boolean))],sets=Number(document.getElementById('qpLanguageSetCount')?.value||1),sum=document.getElementById('qpLanguageSummary');if(sum)sum.innerHTML=`Required: <b>${sets} passage sets = ${sets*5} questions</b>. Mandatory passage sets: <b>${mandPass.length}</b>. Random passage sets: <b>${Math.max(0,sets-mandPass.length)}</b>. Available complete sets: ${groups.length}.`;if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
  };
  window.qpRenderPassages=function(){if(qpSubject()==='EVS')return qpRefreshEVSPools();const wrap=document.getElementById('qpPassageList');if(!wrap)return;const part=document.getElementById('qpPassagePart')?.value||'ALL',groups=qpCompleteGroups(qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&(part==='ALL'||String(q.part_code||'').toUpperCase().replace(/-/g,'_')===part))).filter(g=>qpPassageGroupMatches(g,qpNorm(document.getElementById('qpPassageSearch')?.value).toLowerCase()));wrap.innerHTML=groups.length?groups.map(g=>passageCard(g,`<label style="display:flex;gap:8px;align-items:center;margin-top:9px"><input type="checkbox" ${g.questions.every(q=>qpState.selected.has(q.id))?'checked':''} onchange="qpToggleMandatoryPassage('${esc(g.id)}',this.checked)"><b>Select complete 5-question passage entity</b></label>`)).join(''):'<div class="muted">No complete passage sets found.</div>';if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});};
})();

}catch(e){console.error('Teacher add-on 3 failed:',e)}

/* ---- add-on 4 (was inline <script> #7 in main.html) ---- */
try{

/* JNVST_QP_CHECKBOX_LAYOUT_FIX */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    #qpEvsQuestionList, #qpPassageList, #qpLanguageQuestionList, #qpQuestionList { overflow-x:hidden !important; overflow-y:auto !important; width:100% !important; box-sizing:border-box !important; }
    #qpEvsQuestionList label.assignment, #qpPassageList label.assignment, #qpLanguageQuestionList label.assignment, #qpQuestionList label.assignment { width:100% !important; box-sizing:border-box !important; min-width:0 !important; }
    #qpEvsQuestionList input[type="checkbox"], #qpPassageList input[type="checkbox"], #qpLanguageQuestionList input[type="checkbox"], #qpQuestionList input[type="checkbox"] { width:auto !important; min-width:16px !important; max-width:18px !important; flex:0 0 auto !important; margin:4px 0 0 0 !important; }
    #qpEvsQuestionList label.assignment > span, #qpPassageList label.assignment > span, #qpLanguageQuestionList label.assignment > span, #qpQuestionList label.assignment > span { flex:1 1 auto !important; min-width:0 !important; width:auto !important; display:block !important; overflow-wrap:anywhere !important; word-break:break-word !important; }
    #qpPassageList .assignment { padding:10px !important; }
    #qpPassageList .assignment b { white-space:normal !important; }
  `;
  document.head.appendChild(style);
  function fix(){
    ['qpEvsQuestionList','qpPassageList','qpLanguageQuestionList','qpQuestionList'].forEach(id=>{
      const box=document.getElementById(id); if(!box)return;
      box.style.overflowX='hidden'; box.style.overflowY='auto'; box.style.width='100%'; box.style.boxSizing='border-box';
      box.querySelectorAll('label.assignment').forEach(l=>{
        l.style.width='100%'; l.style.boxSizing='border-box'; l.style.minWidth='0';
        const cb=l.querySelector('input[type="checkbox"]'); if(cb){cb.style.width='auto';cb.style.minWidth='16px';cb.style.maxWidth='18px';cb.style.flex='0 0 auto';}
        const spans=l.querySelectorAll(':scope > span'); spans.forEach(s=>{s.style.flex='1 1 auto';s.style.minWidth='0';s.style.width='auto';s.style.display='block';s.style.overflowWrap='anywhere';});
      });
    });
  }
  const old=window.qpRefreshEVSPools;
  if(typeof old==='function') window.qpRefreshEVSPools=function(){const r=old.apply(this,arguments);setTimeout(fix,0);return r;};
  const oldLang=window.qpRefreshLanguagePool;
  if(typeof oldLang==='function') window.qpRefreshLanguagePool=function(){const r=oldLang.apply(this,arguments);setTimeout(fix,0);return r;};
  const oldRender=window.qpRenderGeneratorMode;
  if(typeof oldRender==='function') window.qpRenderGeneratorMode=function(){const r=oldRender.apply(this,arguments);setTimeout(fix,0);return r;};
  document.addEventListener('input',e=>{if(e.target?.id==='qpQuestionSearch')setTimeout(fix,0);});
  setTimeout(fix,300);
})();


}catch(e){console.error('Teacher add-on 4 failed:',e)}

/* ---- add-on 5 (was inline <script> #8 in main.html) ---- */
try{

/* JNVST_MAT_PDF_DUPLICATE_FIX_V2
   A PDF question number is not a unique identity. Compare the actual image
   before treating an incoming MAT PDF question as a duplicate. */
(function(){
  async function dataUrlBytes(dataUrl){
    const res=await fetch(dataUrl);
    if(!res.ok) throw new Error('Could not read uploaded question image.');
    return new Uint8Array(await res.arrayBuffer());
  }
  async function sha256(bytes){
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function imageHash(dataUrl){ return sha256(await dataUrlBytes(dataUrl)); }
  async function remoteHash(url){
    try{
      const res=await fetch(url,{cache:'no-store'});
      if(!res.ok)return null;
      return sha256(new Uint8Array(await res.arrayBuffer()));
    }catch(e){return null;}
  }
  async function hasSameImage(rows,newHash){
    for(const row of (rows||[])){
      if(!row.image_url)continue;
      const h=await remoteHash(row.image_url);
      if(h && h===newHash)return true;
    }
    return false;
  }

  window.saveJnvstPdfBulk=async function(){
    if(!jnvstPdfRows?.length || document.getElementById('jnvstBulkUploadLock'))return;
    const subject=document.getElementById('jnvstPdfSubject')?.value||'';
    const lessonId=document.getElementById('jnvstPdfLesson')?.value||'';
    const lang='COMMON';
    if(!subject||!lessonId)return notify('Select the JNVST Subject and Lesson/Sub-lesson first.');
    const subj=(jnvstSubjects||[]).find(s=>s.id===subject);
    const lesson=(jnvstSubjectLessons||[]).find(l=>l.id===lessonId);
    if(!subj||!lesson)return notify('Selected Subject or Lesson could not be found.');
    jnvstBulkUploadLock('Uploading MAT questions…','The PDF questions are being compared with existing question images. Please do not click Upload again.');
    jnvstBulkUploadProgress(5,'Preparing image comparison…');
    const btn=document.getElementById('jnvstPdfImportBtn');
    if(btn)btn.disabled=true;
    let ok=0,skip=0;
    try{
      for(let i=0;i<jnvstPdfRows.length;i++){
        const x=jnvstPdfRows[i];
        jnvstBulkUploadProgress(10+Math.round((i/Math.max(1,jnvstPdfRows.length))*80),`Checking question ${i+1} of ${jnvstPdfRows.length}…`);
        const m=jnvstPdfMeta[x.page];
        if(!m)throw new Error(`Metadata missing for PDF page ${x.page}.`);
        const newHash=await imageHash(x.image_data);
        const {data:candidates,error:de}=await sb.from('mock_question_bank')
          .select('id,image_url,source_question_no')
          .eq('teacher_id',current.id)
          .eq('subject_id',subj.id)
          .eq('lesson_id',lesson.id)
          .eq('language',lang)
          .eq('source_question_no',x.page)
          .eq('source_type','JNVST_PDF');
        if(de)throw de;
        if(await hasSameImage(candidates,newHash)){
          skip++;
          continue;
        }
        const path=`${current.id}/jnvst/${crypto.randomUUID()}.jpg`;
        const url=await uploadMockImage(x.image_data,path);
        const {error}=await sb.from('mock_question_bank').insert({
          teacher_id:current.id,
          section_code:'MAT',
          part_code:m.part||'CUSTOM',
          question_text:'[IMAGE QUESTION]',
          option_a:'Option A',option_b:'Option B',option_c:'Option C',option_d:'Option D',
          correct_option:m.correct,
          source_type:'JNVST_PDF',source_question_no:x.page,
          image_url:url,active:true,
          subject_id:subj.id,lesson_id:lesson.id,language:lang,
          topic:m.topic,marks:m.marks,cognitive_level:m.cognitive,
          difficulty:m.difficulty,explanation:m.explanation
        });
        if(error)throw error;
        ok++;
      }
      jnvstBulkUploadProgress(100,'Upload complete. Finalizing…');
      setTimeout(()=>{
        jnvstBulkUploadUnlock();
        notify(`JNVST MAT PDF import complete. Added: ${ok}\nSkipped exact image duplicates: ${skip}`);
        jnvstQuestionBankHome();
      },350);
    }catch(e){
      jnvstBulkUploadUnlock();
      notify('JNVST PDF import stopped: '+(e.message||e));
      if(btn)btn.disabled=false;
    }
  };
})();

}catch(e){console.error('Teacher add-on 5 failed:',e)}

window.__teacherAppLoaded=true;

/* =====================================================================
 * V14 — Import OMR results (Excel) into the Mistake Bank
 * ---------------------------------------------------------------------
 * Reads the OMR software Excel (Roll No, Exam Set, "Q n Options",
 * "Q n Key", "Q n Marks"), finds the matching paper in Generated Question
 * Paper history by comparing answer keys, then the database marks every
 * answer against the SAVED key (teacher_import_omr_results).
 *   • Blank and multiple marks count as mistakes.
 *   • Bonus questions (marks given although the answer ≠ key) are skipped.
 *   • Students with no Exam Set (absent) are skipped.
 * ===================================================================== */
let omrState=null;
function omrCell(v){if(v===null||v===undefined)return '';let s=String(v).trim();if(/^\d+\.0+$/.test(s))s=s.replace(/\.0+$/,'');return s;}
const OMR_QSET_RE=/QSET-\d{8}-\d{6}-[A-Z0-9]{4}(?:-[A-D])?/;
function omrParseSheet(aoa){
  let hi=-1;
  for(let i=0;i<Math.min(aoa.length,15);i++){const r=(aoa[i]||[]).map(x=>omrCell(x).toLowerCase());if(r.includes('roll no')||r.includes('roll number')||r.includes('rollno')){hi=i;break}}
  if(hi<0)throw new Error('Could not find the header row (a column named "Roll No").');
  const h=(aoa[hi]||[]).map(x=>omrCell(x));const low=h.map(x=>x.toLowerCase().replace(/\s+/g,' '));
  const col=(...names)=>{for(const n of names){const i=low.indexOf(n);if(i>=0)return i}return -1};
  const cRoll=col('roll no','roll number','rollno'),cName=col('name','student name'),cSet=col('exam set','set','paper set','booklet set','question set'),cExam=col('exam','exam name','test');
  const qcols=new Map();
  low.forEach((x,i)=>{const m=x.match(/^q\.?\s*0*(\d+)\s*(options?|answer|response|key|marks?)$/);if(!m)return;const n=Number(m[1]);if(!qcols.has(n))qcols.set(n,{});const t=m[2].startsWith('key')?'key':m[2].startsWith('mark')?'marks':'ans';qcols.get(n)[t]=i});
  const nums=[...qcols.keys()].filter(n=>qcols.get(n).ans!==undefined).sort((a,b)=>a-b);
  if(!nums.length)throw new Error('Could not find question columns such as "Q 1 Options".');
  const N=nums[nums.length-1];
  const rows=[],absent=[];
  for(let i=hi+1;i<aoa.length;i++){
    const r=aoa[i]||[];const roll=omrCell(r[cRoll]);if(!roll)continue;
    // Exam Set may be a plain letter ("A") or the full paper code ("QSET-20261009-182557-OZJX-A").
    let set=cSet>=0?omrCell(r[cSet]).toUpperCase().replace(/^SET\s*/,''):'';
    if(set&&!/^[A-D]$/.test(set)){const m=set.match(OMR_QSET_RE);set=m?((m[0].match(/-([A-D])$/)||[])[1]||''):set;}
    const name=cName>=0?omrCell(r[cName]):'';
    const answers=[],keys=[],marks=[];
    for(let n=1;n<=N;n++){const c=qcols.get(n)||{};answers.push(c.ans!==undefined?omrCell(r[c.ans]).toUpperCase():'');keys.push(c.key!==undefined?omrCell(r[c.key]).toUpperCase():'');marks.push(c.marks!==undefined?Number(omrCell(r[c.marks])||0):null)}
    if(answers.every(a=>!a)){absent.push({roll,name});continue}   // no answers marked = absent
    let rowCode='';for(const cell of r){const m=String(cell??'').toUpperCase().match(OMR_QSET_RE);if(m){rowCode=m[0];break}}
    const codeSet=(rowCode.match(/-([A-D])$/)||[])[1]||'';
    rows.push({roll,name,sheetSet:set||codeSet,answers,keys,marks,code:rowCode});
  }
  const exam=cExam>=0?omrCell((aoa[hi+1]||[])[cExam]):'';
  const codes=[...new Set([exam,...rows.map(r=>r.code)].map(x=>(String(x||'').toUpperCase().match(OMR_QSET_RE)||[])[0]).filter(Boolean).map(qpHistoryGroupKey))];
  return {N,rows,absent,exam,hasSetColumn:cSet>=0||rows.some(r=>r.code),codes};
}
function omrPaperKey(rec){const m=new Map();((rec?.answer_key_snapshot?.rows)||[]).forEach(x=>m.set(Number(x['Q.No.']),String(x['Correct Option']||'').toUpperCase()));return m;}
// Which set did this student write? 1) the sheet's own key column (exact),
// 2) otherwise the student's answers compared with each set's saved key.
function omrDetectRowSet(row,setKeys,N){
  const hasKeys=row.keys.some(k=>/^[ABCD]$/.test(k));
  const scores=Object.entries(setKeys).map(([set,key])=>{let t=0,m=0;for(let q=1;q<=N;q++){const k=key.get(q);if(!k)continue;const v=hasKeys?row.keys[q-1]:row.answers[q-1];if(hasKeys&&!/^[ABCD]$/.test(v))continue;t++;if(v===k)m++}return {set,ratio:t?m/t:0,match:m,total:t}}).sort((a,b)=>b.ratio-a.ratio);
  const best=scores[0]||{set:'',ratio:0,match:0,total:0},second=scores[1]||{ratio:0,match:0};
  const margin=best.match-second.match;
  const sure=hasKeys?(best.ratio>=0.9&&margin>=3):(best.total>0&&best.ratio>=0.4&&margin>=4);
  return {set:best.set,ratio:best.ratio,margin,method:hasKeys?'sheet key':'answers',sure};
}
function omrResolveForGroup(recs,parsed){
  const setKeys={};recs.forEach(r=>{setKeys[String(r.set_code||'A').toUpperCase()]=omrPaperKey(r)});
  let sum=0;const resolved=parsed.rows.map(r=>{
    const d=omrDetectRowSet(r,setKeys,parsed.N);sum+=d.ratio;
    let set='',source='',problem='';
    if(r.sheetSet&&setKeys[r.sheetSet]){set=r.sheetSet;source='sheet';if(d.sure&&d.set!==r.sheetSet){set=d.set;source='corrected';problem=`Sheet says Set ${r.sheetSet}, but the ${d.method} match Set ${d.set}`}}
    else if(d.sure){set=d.set;source='detected'}
    else{problem=r.sheetSet?`Set ${r.sheetSet} is not in this paper`:`Set could not be detected (best: ${d.set} ${Math.round(d.ratio*100)}%). Add the Exam Set for this student.`}
    return {...r,set,setSource:source,setMethod:d.method,setRatio:d.ratio,problem};
  });
  const sets={};
  resolved.filter(r=>r.set).forEach(r=>{if(!sets[r.set])sets[r.set]={key:Array(parsed.N).fill(''),bonus:new Set(),count:0,detected:0};const s=sets[r.set];s.count++;if(r.setSource!=='sheet')s.detected++;
    for(let q=0;q<parsed.N;q++){if(!s.key[q]&&r.keys[q])s.key[q]=r.keys[q];if(r.marks[q]!==null&&r.marks[q]>0&&r.keys[q]&&r.answers[q]!==r.keys[q])s.bonus.add(q+1)}});
  const perSet={};Object.entries(sets).forEach(([set,s])=>{const key=setKeys[set];let t=0,m=0;for(let q=1;q<=parsed.N;q++){if(s.bonus.has(q)||!s.key[q-1])continue;t++;if(key.get(q)===s.key[q-1])m++}perSet[set]={found:true,total:t,match:m,questions:key.size}});
  return {score:resolved.length?sum/resolved.length:0,rows:resolved,sets,perSet};
}
function omrScorePaperGroups(records,parsed){
  const groups=new Map();
  (records||[]).forEach(r=>{const g=qpHistoryGroupKey(r.serial_no);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r)});
  const out=[];
  groups.forEach((recs,g)=>{const res=omrResolveForGroup(recs,parsed);const first=recs[0]||{};
    out.push({base:g,title:first.title||'',subject:first.subject||'',generated_at:first.generated_at,sets:recs.map(r=>r.set_code).sort().join(', '),score:res.score,res});});
  return out.sort((a,b)=>b.score-a.score||String(b.generated_at).localeCompare(String(a.generated_at)));
}
async function omrImportPage(){
  omrState=null;
  render(`<div class="wrap">${header('Import OMR Results')}
    <div class="card"><h2>📥 Import OMR Results (Excel)</h2>
      <p class="muted">Upload the result Excel from your OMR software. Each student's answers are checked against the answer key of the matching paper from <b>Question Paper Generator</b> history, and every mistake is added to that student's <b>Mistake Bank</b>, used for 60% adaptive assignments.</p>
      <ul class="small muted"><li>Needed columns: <b>Roll No</b> and, for every question, <b>Q n Options</b>. <b>Q n Key</b>, <b>Q n Marks</b> and <b>Exam Set</b> are used when present.</li><li><b>Best:</b> put the paper code printed on the question paper (e.g. <code>QSET-20261009-182557-OZJX</code>) in the OMR software's <b>Exam name</b>, or in the file name. The paper is then picked from that code. A code with the set letter (<code>…-OZJX-A</code>) in a student's row also gives that student's set.</li><li><b>Exam Set is optional:</b> if it is missing, each student's set is found by comparing the key column (or the student's answers) with the saved key of every set.</li><li>Blank answers and multiple marks (e.g. “A, C”) count as mistakes. Bonus questions are skipped. Students with no answers marked are treated as absent.</li><li>A student can be imported only once for the same paper.</li></ul>
      <label>OMR result Excel file</label><input type="file" id="omrFile" accept=".xlsx,.xls,.csv" onchange="omrReadFile(event)">
      <div id="omrPreview" style="margin-top:14px"></div>
    </div>
    <div class="card"><h2>🗂 Previous OMR Imports</h2><div id="omrHistory"><p class="muted">Loading…</p></div></div>
    <button class="secondary" onclick="mockTestManagement()">← Mock Test Management</button>
  </div>`);
  omrLoadHistory();
}
async function omrLoadHistory(){
  const el=document.getElementById('omrHistory');if(!el)return;
  const {data,error}=await sb.from('omr_imports').select('*').eq('teacher_id',current.id).order('imported_at',{ascending:false}).limit(100);
  if(error){el.innerHTML=`<div class="notice">Could not load OMR import history: ${esc(error.message)}<br><span class="small">Run <b>V14_OMR_MISTAKES_MIGRATION.sql</b> in Supabase SQL Editor first.</span></div>`;return}
  el.innerHTML=(data||[]).length?`<div style="overflow:auto"><table><thead><tr><th>Imported</th><th>Exam</th><th>Paper Serial</th><th>Students</th><th>Questions</th><th>Skipped (bonus/key changed)</th></tr></thead><tbody>${data.map(x=>`<tr><td>${esc(qpHistoryDate(x.imported_at))}</td><td>${esc(x.exam_title||'')}</td><td><code>${esc(x.paper_base_serial)}</code></td><td>${x.student_count}</td><td>${x.question_count}</td><td>${esc((x.skipped_questions||[]).join(', ')||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No OMR results imported yet.</p>';
}
function omrReadFile(ev){
  const file=ev.target.files?.[0];if(!file)return;
  const box=document.getElementById('omrPreview');box.innerHTML='<p class="muted">Reading file…</p>';
  const fr=new FileReader();
  fr.onload=async e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];
      const aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
      const parsed=omrParseSheet(aoa);
      if(!parsed.rows.length)throw new Error('No student answers were found in this file.');
      const records=await qpLoadHistoryRecords();
      if(!records.length)throw new Error('No saved papers found in Question Paper Generator history. Generate (and save) the paper first.');
      const candidates=omrScorePaperGroups(records,parsed);
      const fileCode=(String(file.name).toUpperCase().match(OMR_QSET_RE)||[])[0];
      const codes=[...new Set([...parsed.codes,...(fileCode?[qpHistoryGroupKey(fileCode)]:[])])];
      const byCode=codes.map(c=>candidates.find(x=>x.base===c)).filter(Boolean);
      omrState={file:file.name,parsed,candidates,base:(byCode[0]||candidates[0])?.base||'',dry:null,codes,codeFound:byCode.length>0};
      omrRenderPreview();
    }catch(err){box.innerHTML=`<div class="notice"><b>Could not read this file.</b><br>${esc(err.message||err)}</div>`}
  };
  fr.readAsArrayBuffer(file);
}
function omrSelectedCandidate(){return (omrState?.candidates||[]).find(c=>c.base===omrState.base)||null}
function omrRenderPreview(){
  const box=document.getElementById('omrPreview');if(!box||!omrState)return;
  const p=omrState.parsed,c=omrSelectedCandidate();const res=c?.res;
  const pct=x=>Math.round((x||0)*100);
  const ready=res?res.rows.filter(r=>r.set):[];const problems=res?res.rows.filter(r=>r.problem):[];
  const detectedCount=ready.filter(r=>r.setSource==='detected').length;
  box.innerHTML=`<div class="card" style="background:#f8fafc">
    <h3 style="margin-top:0">${esc(p.exam||omrState.file)}</h3>
    <p class="small muted">${p.rows.length} student(s) with answers · ${p.absent.length} absent (no answers) · ${p.N} questions${p.hasSetColumn?'':' · <b>No Exam Set column — sets are detected automatically</b>'}</p>
    ${omrState.codes?.length?(omrState.codeFound?`<div class="success" style="margin:8px 0"><b>Paper code found in the sheet:</b> <code>${esc(omrState.codes.join(', '))}</code> — selected automatically.</div>`:`<div class="notice" style="margin:8px 0"><b>Paper code ${esc(omrState.codes.join(', '))} is in the sheet but was not found in your Question Paper Generator history.</b> The best-matching paper is selected instead — please check.</div>`):''}
    ${omrState.codes?.length>1?`<div class="notice" style="margin:8px 0">More than one paper code was found in this sheet. Import one paper at a time.</div>`:''}
    <label>Question paper (from Question Paper Generator history)</label>
    <select id="omrPaper" onchange="omrState.base=this.value;omrState.dry=null;omrRenderPreview()">${omrState.candidates.slice(0,40).map(x=>`<option value="${esc(x.base)}" ${x.base===omrState.base?'selected':''}>${esc(x.title||'Paper')} — ${esc(x.subject)} — ${esc(qpHistoryDate(x.generated_at))} — Sets ${esc(x.sets)} — match ${pct(x.score)}%</option>`).join('')}</select>
    ${res?`<div style="overflow:auto;margin-top:10px"><table><thead><tr><th>Set</th><th>Students</th><th>Set found automatically</th><th>Answer keys matching</th><th>Bonus questions (skipped)</th></tr></thead><tbody>${Object.keys(res.sets).sort().map(s=>{const st=res.sets[s],ps=res.perSet[s]||{};const ok=!ps.total||ps.match===ps.total;return `<tr><td><b>${esc(s)}</b></td><td>${st.count}</td><td>${st.detected}</td><td class="${ok?'result-correct':'result-wrong'}">${ps.total?`${ps.match}/${ps.total}`:'— (no key column)'}</td><td>${[...st.bonus].sort((a,b)=>a-b).map(q=>'Q'+q).join(', ')||'—'}</td></tr>`}).join('')}</tbody></table></div>
    ${detectedCount?`<p class="small muted">${detectedCount} student(s) had no Exam Set; their set was found by matching ${ready.some(r=>r.setSource==='detected'&&r.setMethod==='sheet key')?'the key column / ':''}their answers with each set's saved answer key.</p>`:''}
    ${problems.length?`<div class="notice" style="margin-top:8px"><b>${problems.length} student(s) need attention:</b><ul style="margin:6px 0 0 18px">${problems.map(r=>`<li>${esc(r.roll)} ${esc(r.name||'')} — ${esc(r.problem)}${r.set?' → will use Set '+esc(r.set):' → will NOT be imported'}</li>`).join('')}</ul></div>`:''}`:''}
    ${c&&c.score<0.6?`<div class="notice" style="margin-top:10px"><b>This paper does not match the sheet well (${pct(c.score)}%).</b> Check that you selected the correct paper.</div>`:''}
    <div class="actions" style="margin-top:12px"><button onclick="omrRun(true)">1. Check Students</button><button id="omrImportBtn" ${omrState.dry?'':'disabled'} onclick="omrRun(false)">2. Import into Mistake Bank</button></div>
    <div id="omrDry" style="margin-top:10px">${omrState.dry?omrReportHtml(omrState.dry):''}</div>
  </div>`;
}
function omrPayloadRows(){
  const res=omrSelectedCandidate()?.res;if(!res)return [];
  return res.rows.filter(r=>r.set).map(r=>({roll_no:r.roll,set_code:r.set,answers:r.answers,sheet_keys:r.keys.map((k,i)=>res.sets[r.set]?.bonus.has(i+1)?'BONUS':k)}));
}
function omrReportHtml(res){
  const rows=res.rows||[];const by=s=>rows.filter(x=>x.status===s);
  const label={student_not_found:'Roll No not found in your classes',set_not_found:'Set not found in the selected paper',already_imported:'Already imported for this paper'};
  const problems=rows.filter(x=>x.status!=='ok');
  return `<div class="${res.dry_run?'notice':'success'}"><b>${res.dry_run?'Check result':'Imported'}:</b> ${res.imported} student(s) ${res.dry_run?'ready to import':'added to the Mistake Bank'}.${(res.skipped_questions||[]).length?` Skipped questions: ${esc(res.skipped_questions.join(', '))}.`:''}${problems.length?`<br>${problems.length} row(s) will not be imported:`:''}</div>
  ${problems.length?`<div style="overflow:auto"><table><thead><tr><th>Roll No</th><th>Name</th><th>Reason</th></tr></thead><tbody>${problems.map(x=>`<tr><td>${esc(x.roll_no)}</td><td>${esc(x.name||'')}</td><td>${esc(label[x.status]||x.status)}${x.set_code?' ('+esc(x.set_code)+')':''}</td></tr>`).join('')}</tbody></table></div>`:''}
  ${by('ok').length?`<details style="margin-top:8px"><summary>Per-student summary (${by('ok').length})</summary><div style="overflow:auto"><table><thead><tr><th>Roll No</th><th>Name</th><th>Set</th><th>Correct</th><th>Mistakes</th><th>Skipped</th></tr></thead><tbody>${by('ok').map(x=>`<tr><td>${esc(x.roll_no)}</td><td>${esc(x.name||'')}</td><td>${esc(x.set_code)}</td><td class="result-correct">${x.correct}</td><td class="result-wrong">${x.mistakes}</td><td>${x.skipped}</td></tr>`).join('')}</tbody></table></div></details>`:''}`;
}
async function omrRun(dry){
  if(!omrState?.base)return notify('Select the question paper first.');
  const c=omrSelectedCandidate();
  if(!dry&&c&&c.score<0.6&&!confirm(`The sheet matches the selected paper only ${Math.round(c.score*100)}%. Import anyway?`))return;
  const btns=document.querySelectorAll('#omrPreview button');btns.forEach(b=>b.disabled=true);
  try{
    const {data,error}=await sb.rpc('teacher_import_omr_results',{p_paper_base_serial:omrState.base,p_exam_title:omrState.parsed.exam||'',p_file_name:omrState.file,p_rows:omrPayloadRows(),p_dry_run:!!dry});
    if(error)throw error;
    if(dry){omrState.dry=data;omrRenderPreview();}
    else{document.getElementById('omrPreview').innerHTML=omrReportHtml(data);notify(`OMR results imported for ${data.imported} student(s).`,'success');omrLoadHistory();}
  }catch(e){notify('OMR import failed: '+(e.message||e),'error');omrRenderPreview();}
}

/* =====================================================================
 * V14 — JNVST Adaptive Assignment: 60% of each part from the student's
 * own ACTIVE mistakes (online tests + imported OMR results).
 * Active mistake = wrong_count > 0 and correct_streak < 2
 * (fixed after two correct answers in a row; blank = mistake).
 * Each student gets a personal copy of the assignment.
 * ===================================================================== */
const JNVST_ADAPTIVE_PERCENT=60;
function isAdaptiveJnvstAssignment(){return !schoolTeacherMode&&document.querySelector('input[name="jnvstAssignmentMode"]:checked')?.value==='adaptive';}
function jnvstAdaptiveCardHtml(){return `<div class="card" style="border:2px solid #7c3aed;background:#faf5ff;margin-top:12px"><h3 style="margin:0 0 6px">🎯 Assignment Personalization</h3>
 <label><input type="radio" name="jnvstAssignmentMode" value="standard" checked style="width:auto;margin-right:8px">Standard Assignment — every student gets the same questions</label>
 <label><input type="radio" name="jnvstAssignmentMode" value="adaptive" style="width:auto;margin-right:8px">Adaptive Assignment — ${JNVST_ADAPTIVE_PERCENT}% of each part from the student's own mistakes</label>
 <div class="small muted" style="margin-top:6px">How it works: build the question set as usual (<b>Build Assignment from JNVST Lesson</b> or <b>Select From JNVST Mock Test Question Bank</b>). That set decides how many questions each part gets. For every student and every part, ${JNVST_ADAPTIVE_PERCENT}% of the questions are replaced with questions that student got wrong — in online tests, assignments or imported OMR exams — and has not yet answered correctly twice in a row. The rest are new questions from the same part (questions the student has never attempted come first). Passage questions (Language / EVS passage) are kept as selected. A student with fewer mistakes simply gets more new questions.</div></div>`;}
function jnvstAdaptiveIsPassage(q){return !!String(q?.passage_id||'').trim()||/PASSAGE/i.test(String(q?.part_code||''));}
function jnvstAdaptivePick(blueprint,pool,perfRows){
  const perf=new Map((perfRows||[]).map(x=>[x.mock_question_id,x]));
  const parts=[];const byPart=new Map();
  blueprint.forEach(q=>{const p=String(q.part_code||'OTHER');if(!byPart.has(p)){byPart.set(p,[]);parts.push(p)}byPart.get(p).push(q)});
  const used=new Set();const out=[];const summary={};
  for(const part of parts){
    const bp=byPart.get(part);const n=bp.length;
    if(bp.some(jnvstAdaptiveIsPassage)){bp.forEach(q=>{out.push({q,reason:'STANDARD_PASSAGE'});used.add(q.id)});summary[part]={total:n,mistakes:0,new:n,passage:true};continue}
    let target=Math.round(n*JNVST_ADAPTIVE_PERCENT/100);if(n>=2)target=Math.min(target,n-1);
    const mistakes=pool.filter(q=>String(q.part_code||'OTHER')===part&&!used.has(q.id)&&(()=>{const p=perf.get(q.id);return p&&Number(p.wrong_count||0)>0&&Number(p.correct_streak||0)<2})())
      .sort((a,b)=>{const pa=perf.get(a.id),pb=perf.get(b.id);return (Number(pb.wrong_count)-Number(pa.wrong_count))||String(pb.last_wrong_at||'').localeCompare(String(pa.last_wrong_at||''))});
    const chosenMistakes=mistakes.slice(0,target);
    chosenMistakes.forEach(q=>{out.push({q,reason:'PREVIOUS_MISTAKE',wrongCount:Number(perf.get(q.id)?.wrong_count||0)});used.add(q.id)});
    const need=n-chosenMistakes.length;
    const rest=pool.filter(q=>String(q.part_code||'OTHER')===part&&!used.has(q.id)&&!jnvstAdaptiveIsPassage(q));
    const unseen=adaptiveShuffle(rest.filter(q=>!perf.has(q.id))),seen=adaptiveShuffle(rest.filter(q=>perf.has(q.id)));
    const fresh=[...unseen,...seen].slice(0,need);
    fresh.forEach(q=>{out.push({q,reason:perf.has(q.id)?'NEW_ATTEMPTED_BEFORE':'NEW_UNSEEN'});used.add(q.id)});
    summary[part]={total:n,mistakes:chosenMistakes.length,new:fresh.length,short:need-fresh.length};
  }
  return {items:out,summary,short:Object.values(summary).reduce((s,x)=>s+(x.short||0),0)};
}
async function saveAdaptiveJnvstAssignment(){
  const type=document.querySelector('input[name="assignmentType"]:checked')?.value||'video';
  const title=String(document.getElementById('at')?.value||'').trim();if(!title)return notify('Enter an assignment title.');
  const videoUrl=type==='video'?(document.getElementById('av')?.value.trim()||''):null;
  if(type==='video'&&!videoUrl)return notify('Enter the YouTube video URL for this video assignment.');
  const ids=[...new Set([...(assignmentSchoolQbSelected?.course_type==='JNVST'?assignmentSchoolQbSelected.ids||[]:[]),...assignmentBankSelected])];
  if(!ids.length)return notify('For an Adaptive Assignment, first build the question set (Build Assignment from JNVST Lesson, or Select From JNVST Mock Test Question Bank). It decides how many questions each part gets.');
  if(importedQuestions.length||document.querySelectorAll('.q .qt').length&&[...document.querySelectorAll('.q .qt')].some(x=>x.value.trim()))return notify('Adaptive Assignments use Question Bank questions only. Remove uploaded/manual questions or choose Standard Assignment.');
  let recipientInfo;try{recipientInfo=await getNewAssignmentRecipients();if(!recipientInfo.studentIds.length)return notify('Select at least one student.');}catch(e){return notify(e.message)}
  const studentIds=[...new Set(recipientInfo.studentIds)];
  const btn=document.activeElement;if(btn&&btn.tagName==='BUTTON'){btn.disabled=true;btn.dataset.txt=btn.textContent;btn.textContent='Creating personal assignments…'}
  try{
    // Pool: lesson builder range if used, otherwise the whole active JNVST bank.
    let pool=(assignmentSchoolQbMode==='JNVST'&&assignmentSchoolQbSelected?.ids?.length&&assignmentSchoolQbQuestions.length)?assignmentSchoolQbAllowed():null;
    const {data:allBank,error:be}=await sb.from('mock_question_bank').select('id,question_text,option_a,option_b,option_c,option_d,correct_option,passage_text,image_url,topic,language,passage_id,passage_title,question_order,variation_group,subject_id,lesson_id,part_code,section_code,active').eq('teacher_id',current.id).eq('active',true);
    if(be)throw be;
    const bankById=new Map((allBank||[]).map(q=>[q.id,q]));
    pool=(pool||allBank||[]).map(q=>bankById.get(q.id)).filter(Boolean);
    const blueprint=ids.map(id=>bankById.get(id)).filter(Boolean);
    if(!blueprint.length)throw new Error('The selected questions were not found in the active JNVST Question Bank.');
    // Keep the selected language when the builder restricted it.
    const lang=String(assignmentSchoolQbSelected?.lang||'').toUpperCase();
    const langs=new Set(blueprint.map(q=>String(q.language||'').toUpperCase()).filter(Boolean));
    if(langs.size===1)pool=pool.filter(q=>!q.language||langs.has(String(q.language).toUpperCase()));
    const [{data:perf,error:pe},{data:profs,error:pre}]=await Promise.all([
      sb.from('student_question_performance').select('student_id,mock_question_id,wrong_count,correct_streak,last_wrong_at,attempt_count').in('student_id',studentIds),
      sb.from('profiles').select('id,full_name,roll_no').in('id',studentIds)
    ]);
    if(pe)throw new Error('Could not load student mistakes: '+pe.message+(String(pe.message).includes('correct_streak')?' — run V14_OMR_MISTAKES_MIGRATION.sql first.':''));
    if(pre)throw pre;
    const profById=new Map((profs||[]).map(p=>[p.id,p]));
    const primaryClassId=recipientInfo.classIds[0];
    const jnvstMainClass=(window._newAssignmentClasses||[]).find(c=>c.id===(document.getElementById('aMainGroup')?.value||''));
    const mainGroup=jnvstMainClass?.name||'JNVST Main Group';
    const subSel=(window._newAssignmentClasses||[]).find(c=>c.id===String(document.getElementById('aSubGroup')?.value||'').trim());
    const subNames=[...new Set((recipientInfo.classIds||[]).map(id=>(window._newAssignmentClasses||[]).find(c=>c.id===id)).filter(c=>c&&isJnvstSubGroup(c)).map(c=>c.name))];
    const subGroup=subSel?.name||(subNames.length===1?subNames[0]:subNames.length>1?'Multiple Sub-groups':'');
    const batchId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c^(crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4)).toString(16));const created=[],errors=[];let totalMistakes=0;
    for(const sid of studentIds){
      const pick=jnvstAdaptivePick(blueprint,pool,(perf||[]).filter(x=>x.student_id===sid));
      const pr=profById.get(sid)||{};
      if(pick.short>0){errors.push(`${pr.full_name||sid}: ${pick.short} question(s) short — not enough questions in the selected range`);continue}
      const mistakesUsed=pick.items.filter(x=>x.reason==='PREVIOUS_MISTAKE').length;
      const {data:a,error:ae}=await sb.from('assignments').insert({class_id:primaryClassId,title,subject:document.getElementById('asub')?.value.trim()||'',description:document.getElementById('adesc')?.value.trim()||'',video_url:videoUrl,assignment_type:type==='video'?'VIDEO':'MCQ',time_limit:null,shuffle_questions:false,shuffle_options:false,main_group:mainGroup,sub_group:subGroup,created_by:current.id,adaptive_mode:true,adaptive_max_percent:JNVST_ADAPTIVE_PERCENT,adaptive_batch_id:batchId,adaptive_for_student_id:sid,adaptive_weakness_count:mistakesUsed,adaptive_normal_count:pick.items.length-mistakesUsed,adaptive_selection_summary:{course:'JNVST',student_name:pr.full_name||'',roll_no:pr.roll_no||'',parts:pick.summary}}).select('id').single();
      if(ae){errors.push(`${pr.full_name||sid}: ${ae.message}`);continue}
      const qs=pick.items.map((it,i)=>{const q=it.q;return {assignment_id:a.id,question_text:q.image_url?'[IMAGE QUESTION]':(q.question_text||''),option_a:q.image_url?'Option A':q.option_a,option_b:q.image_url?'Option B':q.option_b,option_c:q.image_url?'Option C':q.option_c,option_d:q.image_url?'Option D':q.option_d,correct_option:q.correct_option,question_order:i+1,image_url:q.image_url||null,explanation:null,source_mock_question_id:q.id,source_variation_group:q.variation_group||null,source_topic:q.topic||null,adaptive_selection_reason:it.reason,adaptive_source_wrong_count:it.wrongCount||0}});
      const {error:qe}=await sb.from('questions').insert(qs);
      if(qe){await sb.from('assignments').delete().eq('id',a.id);errors.push(`${pr.full_name||sid}: could not save questions — ${qe.message}`);continue}
      const {error:re}=await sb.from('assignment_students').insert({assignment_id:a.id,student_id:sid});
      if(re){await sb.from('questions').delete().eq('assignment_id',a.id);await sb.from('assignments').delete().eq('id',a.id);errors.push(`${pr.full_name||sid}: could not assign — ${re.message}`);continue}
      created.push(sid);totalMistakes+=mistakesUsed;
    }
    if(!created.length)return notify('No adaptive assignments were created.\n'+errors.join('\n'),'error');
    notify(`Adaptive assignment created for ${created.length} student${created.length===1?'':'s'} (${blueprint.length} questions each). ${totalMistakes} mistake question(s) were used in total.${errors.length?'\n\nNot created:\n'+errors.join('\n'):''}`,errors.length?'info':'success');
    importedQuestions=[];importedAnswers={};importedExplanations={};importedSingleExcel=false;importedForNewAssignment=false;newAssignmentDraft=null;importedSolutionPdfPages=[];assignmentBankSelected.clear();assignmentBankCache=[];assignmentSchoolQbSelected=null;assignmentSchoolQbQuestions=[];assignmentSchoolQbChapters=[];assignmentSchoolQbFixedQuestions.clear();assignmentSchoolQbFixedGroups.clear();
    teacherHome();
  }catch(e){notify('Could not create the adaptive assignment: '+(e.message||e),'error')}
  finally{if(btn&&btn.tagName==='BUTTON'&&document.body.contains(btn)){btn.disabled=false;btn.textContent=btn.dataset.txt||btn.textContent}}
}
