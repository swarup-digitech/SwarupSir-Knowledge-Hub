
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

