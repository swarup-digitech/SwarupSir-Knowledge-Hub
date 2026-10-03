
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
    const normalHtml=normal.length?`<div style="overflow:auto"><table><thead><tr><th><input type="checkbox" ${allVisibleSelected?'checked':''} onchange="jnvstQbToggleVisible(this.checked)"></th><th>#</th><th>Question</th><th>Subject</th><th>Medium</th><th>Lesson / Sub-lesson</th><th>Topic</th><th>Variation / Fixed</th><th>Actions</th></tr></thead><tbody>${normal.map((q,i)=>{const sj=(jnvstSubjects||[]).find(x=>x.id===q.subject_id),l=(jnvstSubjectLessons||[]).find(x=>x.id===q.lesson_id);return `<tr><td><input type="checkbox" ${jnvstQbSelected.has(q.id)?'checked':''} onchange="jnvstQbToggleSelection('${esc(q.id)}',this.checked)"></td><td>${i+1}</td><td style="min-width:240px">${jnvstQbQuestionPreview(q)}</td><td>${esc(sj?.name||'—')}</td><td>${esc(q.language||'—')}</td><td>${esc(l?`${l.lesson_code||''} ${l.lesson_name}`:'—')}</td><td>${esc(q.topic||'—')}</td><td>${q.variation_group?`<span class="tag">${esc(q.variation_group)}</span>`:''}${q.is_fixed?' <span class="tag">Fixed</span>':''}</td><td><div class="actions"><button onclick="jnvstQbEdit('${esc(q.id)}')">✎ Edit</button><button class="danger" onclick="jnvstQbDeleteOne('${esc(q.id)}')">🗑 Delete</button></div></td></tr>`}).join('')}</tbody></table></div>`:'';
    box.innerHTML=`<div class="small muted" style="margin-bottom:8px">${rows.length} question row(s) · <b>${groups.length}</b> complete passage group(s) · <b>${jnvstQbSelected.size}</b> selected</div>${groupHtml}${normalHtml||(!groupHtml?'<div class="muted">No questions found.</div>':'')}`;
    jnvstQbUpdateSelectionCount();if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise([box]).catch(()=>{});
  };
  window.jnvstQbTogglePassageGroup=function(groupId,checked){
    const all=completePassages(jnvstQbCache).find(g=>String(g.id)===String(groupId));if(!all)return;
    all.questions.forEach(q=>checked?jnvstQbSelected.add(q.id):jnvstQbSelected.delete(q.id));jnvstQbRenderTable();
  };
  window.jnvstQbEditPassage=async function(id){
    const anchor=jnvstQbCache.find(q=>q.id===id);if(!anchor)return alert('Passage question not found.');
    const group=completePassages(jnvstQbCache).find(g=>g.questions.some(q=>q.id===id));
    if(!group)return alert('This passage is incomplete. Expected exactly 5 linked questions.');
    const subj=(jnvstSubjects||[]).find(s=>s.id===anchor.subject_id),lesson=(jnvstSubjectLessons||[]).find(l=>l.id===anchor.lesson_id);
    const qCards=group.questions.map((q,i)=>`<div class="jnvst-editor-section" style="margin-top:14px"><h3>Question ${i+1}</h3><div class="grid"><div><label>Topic</label><input id="pgTopic_${i}" value="${esc(q.topic||'')}"></div><div><label>Marks</label><input id="pgMarks_${i}" type="number" min="0" step="0.5" value="${Number(q.marks??1)}"></div><div><label>Cognitive Level</label><select id="pgCog_${i}">${['Knowledge','Understanding','Application','HOTS'].map(v=>`<option ${q.cognitive_level===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label>Difficulty</label><select id="pgDiff_${i}">${['Easy','Medium','Hard'].map(v=>`<option ${q.difficulty===v?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('pgQ_${i}')">∑ Equation Editor</button></div><textarea id="pgQ_${i}" rows="5" oninput="jnvstRefreshMathPreview('pgQP_${i}',this.value)">${esc(q.question_text||'')}</textarea><div id="pgQP_${i}" class="eq-preview">${jnvstMathPreview(q.question_text||'')}</div><div class="grid">${['A','B','C','D'].map(o=>`<div><label>Option ${o}</label><textarea id="pg${o}_${i}" rows="2" oninput="jnvstRefreshMathPreview('pg${o}P_${i}',this.value)">${esc(q['option_'+o.toLowerCase()]||'')}</textarea><div id="pg${o}P_${i}" class="eq-preview">${jnvstMathPreview(q['option_'+o.toLowerCase()]||'')}</div></div>`).join('')}</div><div class="grid"><div><label>Correct Answer</label><select id="pgAns_${i}">${['A','B','C','D'].map(v=>`<option ${q.correct_option===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label>Variation Group</label><input id="pgVar_${i}" value="${esc(q.variation_group||'')}"></div><div><label>Fixed Question</label><label style="display:flex;align-items:center;gap:8px;margin-top:8px"><input id="pgFixed_${i}" type="checkbox" style="width:auto" ${q.is_fixed?'checked':''}> Fixed</label></div></div><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('pgEx_${i}')">∑ Equation Editor</button></div><textarea id="pgEx_${i}" rows="3" placeholder="Explanation">${esc(q.explanation||'')}</textarea><label>Question Image</label><input id="pgImg_${i}" type="file" accept="image/*"></div>`).join('');
    render(`<div class="wrap">${header('Edit Complete JNVST Passage Entity')}<div class="card"><div class="notice"><b>Complete passage block:</b> The passage and all 5 linked questions are shown here together. Saving updates the complete entity.</div><div class="grid"><div><label>Subject</label><input value="${esc(subj?.name||'')}" disabled></div><div><label>Lesson / Sub-lesson</label><input value="${esc(`${lesson?.lesson_code||''} ${lesson?.lesson_name||''}`.trim())}" disabled></div><div><label>Medium</label><input value="${esc(anchor.language||'')}" disabled></div></div><label>Passage Title</label><input id="pgTitle" value="${esc(group.title||'')}"><div class="eq-toolbar"><button type="button" class="secondary" onclick="jnvstOpenMathEditor('pgPassage')">∑ Equation Editor</button></div><textarea id="pgPassage" rows="10" oninput="jnvstRefreshMathPreview('pgPassagePreview',this.value)">${esc(group.text||'')}</textarea><div id="pgPassagePreview" class="eq-preview">${jnvstMathPreview(group.text||'')}</div>${qCards}<div class="actions"><button onclick="jnvstQbSavePassage('${esc(group.id)}','${esc(anchor.part_code)}')">💾 Save Complete Passage + 5 Questions</button><button class="secondary" onclick="jnvstQuestionBankHome()">Cancel</button></div></div></div>`);if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
  };
  window.jnvstQbSavePassage=async function(groupId,part){
    const group=completePassages(jnvstQbCache).find(g=>String(g.id)===String(groupId));if(!group)return alert('Passage group not found.');
    const title=String(document.getElementById('pgTitle')?.value||'').trim(),text=String(document.getElementById('pgPassage')?.value||'').trim();if(!title||!text)return alert('Passage title and passage text are required.');
    try{
      for(let i=0;i<group.questions.length;i++){
        const q=group.questions[i];let imageUrl=q.image_url||null;const file=document.getElementById(`pgImg_${i}`)?.files?.[0];if(file)imageUrl=await uploadMockFile(file,`${current.id}/jnvst-passage-edit/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`);
        const payload={passage_title:title,passage_text:text,topic:String(document.getElementById(`pgTopic_${i}`)?.value||'').trim()||null,marks:Number(document.getElementById(`pgMarks_${i}`)?.value||1),cognitive_level:document.getElementById(`pgCog_${i}`)?.value||null,difficulty:document.getElementById(`pgDiff_${i}`)?.value||null,variation_group:String(document.getElementById(`pgVar_${i}`)?.value||'').trim()||null,is_fixed:!!document.getElementById(`pgFixed_${i}`)?.checked,question_text:String(document.getElementById(`pgQ_${i}`)?.value||'').trim()||null,option_a:String(document.getElementById(`pgA_${i}`)?.value||'').trim()||null,option_b:String(document.getElementById(`pgB_${i}`)?.value||'').trim()||null,option_c:String(document.getElementById(`pgC_${i}`)?.value||'').trim()||null,option_d:String(document.getElementById(`pgD_${i}`)?.value||'').trim()||null,correct_option:document.getElementById(`pgAns_${i}`)?.value||q.correct_option,explanation:String(document.getElementById(`pgEx_${i}`)?.value||'').trim()||null,image_url:imageUrl};
        const {error}=await sb.from('mock_question_bank').update(payload).eq('id',q.id).eq('teacher_id',current.id);if(error)throw error;
      }
      alert('Complete passage entity updated: passage + all 5 questions.');await jnvstQuestionBankHome();
    }catch(e){alert('Could not save complete passage: '+(e.message||e));}
  };
  window.jnvstQbDeletePassage=async function(id){
    const anchor=jnvstQbCache.find(q=>q.id===id);const group=anchor&&completePassages(jnvstQbCache).find(g=>g.questions.some(q=>q.id===id));if(!group)return alert('Complete passage group not found.');await jnvstQbDeleteIds(group.questions.map(q=>q.id),'this complete passage entity');
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
    const mcqs=qpState.bank.filter(q=>!qpIsPassage(q)&&qpLangMatches(q)&&String(q.section_code||'').toUpperCase()==='EVS').filter(q=>!search||[q.question_text,q.topic,q.part_code].some(v=>qpNorm(v).toLowerCase().includes(search)));
    const wrap=document.getElementById('qpEvsQuestionList');if(wrap)wrap.innerHTML=mcqs.slice(0,500).map(q=>`<label class="assignment" style="display:flex;gap:8px;align-items:flex-start;margin:4px 0;padding:7px"><input type="checkbox" ${qpState.selected.has(q.id)?'checked':''} onchange="qpMandatoryChanged('${esc(q.id)}',this.checked)"><span style="flex:1;min-width:0">${teacherQuestionPreview(q)} <span class="muted small">— ${esc(q.id)}</span></span></label>`).join('')||'<div class="muted">No EVS MCQs found.</div>';
    const groups=qpCompleteGroups(qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&String(q.section_code||'').toUpperCase()==='EVS')).filter(g=>qpPassageGroupMatches(g,search));
    const pp=document.getElementById('qpPassageList');if(pp)pp.innerHTML=groups.length?groups.map(g=>`${passageCard(g,`<label style="display:flex;gap:8px;align-items:center;margin-top:9px"><input type="checkbox" ${g.questions.every(q=>qpState.selected.has(q.id))?'checked':''} onchange="qpToggleMandatoryPassage('${esc(g.id)}',this.checked)"><b>Select complete 5-question passage entity</b></label>`)}`).join(''):'<div class="muted">No complete EVS passage groups found. A valid group requires the same Passage ID/Set ID and Question Order 1–5.</div>';
    const sets=Number(document.getElementById('qpEvsSetCount')?.value||1),direct=15*sets,mandDirect=[...qpState.selected].filter(id=>{const q=qpState.bank.find(x=>x.id===id);return q&&!qpIsPassage(q)&&qpLangMatches(q)&&String(q.section_code||'').toUpperCase()==='EVS'}).length,mandPass=[...new Set([...qpState.selected].map(id=>qpState.bank.find(x=>x.id===id)?.passage_id||qpState.bank.find(x=>x.id===id)?.set_id).filter(Boolean))];const sum=document.getElementById('qpEvsSummary');if(sum)sum.innerHTML=`Required: <b>${direct} EVS MCQs + ${sets} passage set(s)</b>. Mandatory: <b>${mandDirect} MCQs + ${mandPass.length} passage(s)</b>. Random: <b>${Math.max(0,direct-mandDirect)} MCQs + ${Math.max(0,sets-mandPass.length)} passage(s)</b>. Available complete passages: ${groups.length}`;
    if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
  };
  window.qpRefreshLanguagePool=function(){
    const search=qpNorm(document.getElementById('qpQuestionSearch')?.value).toLowerCase();const groups=qpCompleteGroups(qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&String(q.part_code||'').toUpperCase().replace(/-/g,'_')==='LANGUAGE_PASSAGE')).filter(g=>qpPassageGroupMatches(g,search));
    const wrap=document.getElementById('qpLanguageQuestionList');if(wrap)wrap.innerHTML=groups.length?groups.map(g=>passageCard(g,`<label style="display:flex;gap:8px;align-items:center;margin-top:9px"><input type="checkbox" ${g.questions.every(q=>qpState.selected.has(q.id))?'checked':''} onchange="qpToggleMandatoryPassage('${esc(g.id)}',this.checked)"><b>Select complete 5-question passage entity</b></label>`)).join(''):'<div class="muted">No complete Language passage groups found.</div>';
    const mandPass=[...new Set([...qpState.selected].map(id=>qpState.bank.find(x=>x.id===id)?.passage_id||qpState.bank.find(x=>x.id===id)?.set_id).filter(Boolean))],sets=Number(document.getElementById('qpLanguageSetCount')?.value||1),sum=document.getElementById('qpLanguageSummary');if(sum)sum.innerHTML=`Required: <b>${sets} passage sets = ${sets*5} questions</b>. Mandatory passage sets: <b>${mandPass.length}</b>. Random passage sets: <b>${Math.max(0,sets-mandPass.length)}</b>. Available complete sets: ${groups.length}.`;if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});
  };
  window.qpRenderPassages=function(){if(qpSubject()==='EVS')return qpRefreshEVSPools();const wrap=document.getElementById('qpPassageList');if(!wrap)return;const part=document.getElementById('qpPassagePart')?.value||'ALL',groups=qpCompleteGroups(qpState.bank.filter(q=>qpIsPassage(q)&&qpLangMatches(q)&&(part==='ALL'||String(q.part_code||'').toUpperCase().replace(/-/g,'_')===part))).filter(g=>qpPassageGroupMatches(g,qpNorm(document.getElementById('qpPassageSearch')?.value).toLowerCase()));wrap.innerHTML=groups.length?groups.map(g=>passageCard(g,`<label style="display:flex;gap:8px;align-items:center;margin-top:9px"><input type="checkbox" ${g.questions.every(q=>qpState.selected.has(q.id))?'checked':''} onchange="qpToggleMandatoryPassage('${esc(g.id)}',this.checked)"><b>Select complete 5-question passage entity</b></label>`)).join(''):'<div class="muted">No complete passage sets found.</div>';if(window.MathJax?.typesetPromise)window.MathJax.typesetPromise().catch(()=>{});};
})();
