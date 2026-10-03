
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
    if(!subject||!lessonId)return alert('Select the JNVST Subject and Lesson/Sub-lesson first.');
    const subj=(jnvstSubjects||[]).find(s=>s.id===subject);
    const lesson=(jnvstSubjectLessons||[]).find(l=>l.id===lessonId);
    if(!subj||!lesson)return alert('Selected Subject or Lesson could not be found.');
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
        alert(`JNVST MAT PDF import complete. Added: ${ok}\nSkipped exact image duplicates: ${skip}`);
        jnvstQuestionBankHome();
      },350);
    }catch(e){
      jnvstBulkUploadUnlock();
      alert('JNVST PDF import stopped: '+(e.message||e));
      if(btn)btn.disabled=false;
    }
  };
})();
