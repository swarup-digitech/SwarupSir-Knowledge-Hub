
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
    if(typeof XLSX==='undefined')return alert('Excel library is not loaded.');
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
      if(!fresh.length)throw new Error('All uploaded questions are already present. No new questions were added.');jnvstBulkUploadProgress(65,'Sending questions to the server…');const {error}=await sb.from('mock_question_bank').insert(fresh);if(error)throw error;ok=fresh.length;const logicalGroups=new Set(fresh.map(x=>x.passage_id).filter(Boolean)).size;jnvstBulkUploadProgress(100,'Upload complete.');setTimeout(()=>{jnvstBulkUploadUnlock();alert(`JNVST import complete.\nAdded: ${ok} language record(s)\nComplete passage entities: ${logicalGroups}\nSkipped duplicates: ${skip}\n\nPassage questions are stored as one entity: passage + 5 questions. English and Assamese versions are linked automatically.`);jnvstQuestionBankHome()},350);
    }catch(e){jnvstBulkUploadUnlock();alert('JNVST import stopped: '+(e.message||e));}
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

