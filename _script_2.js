
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
  window.mockReadRows=function(file,cb){const r=new FileReader();r.onload=e=>{try{cb(XLSX.read(e.target.result,{type:'array'}))}catch(err){alert('Could not read Excel: '+err.message)}};r.readAsArrayBuffer(file)};
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

      alert(`Upload complete: ${savedExcel+savedPdf} new question(s). Permanent Set/Passage IDs were generated automatically.`);
      mockTestManagement();
    }catch(e){
      alert('Upload validation failed: '+(e.message||e));
    }
  };
  window.mockBuildSets=function(qs,plan){if(plan.unit==='passage'){const groups=new Map();(qs||[]).forEach(q=>{const pid=String(q.passage_id||'').trim();if(pid){if(!groups.has(pid))groups.set(pid,[]);groups.get(pid).push(q)}});return [...groups.entries()].filter(([,g])=>g.length===(plan.passageCount||plan.count)).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))).map(([pid,g],i)=>({number:i+1,label:`Passage ${pid}`,set_id:g[0].set_id||pid,questions:[...g].sort(mockSortQuestions)}))}const bySet=new Map();(qs||[]).forEach(q=>{const sid=String(q.set_id||'').trim();if(sid){if(!bySet.has(sid))bySet.set(sid,[]);bySet.get(sid).push(q)}});const explicit=[...bySet.entries()].filter(([,g])=>g.length===(plan.passageCount||plan.count)).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));if(explicit.length)return explicit.map(([sid,g],i)=>({number:i+1,label:`Set ${sid}`,set_id:sid,questions:[...g].sort(mockSortQuestions)}));const sorted=[...(qs||[])].sort(mockSortQuestions),sets=[];for(let i=0;i<sorted.length;i+=plan.count){const group=sorted.slice(i,i+plan.count);if(group.length===plan.count)sets.push({number:sets.length+1,label:`Set ${sets.length+1}`,set_id:`AUTO-${plan.part}-${sets.length+1}`,questions:group})}return sets};
})();
