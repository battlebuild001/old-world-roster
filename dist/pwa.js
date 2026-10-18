(() => {
  const button=document.getElementById('installTow');
  const status=document.getElementById('pwaStatus');
  const backdrop=document.getElementById('installBackdrop');
  const steps=document.getElementById('installSteps');
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
  let pending=null;

  function closeHelp(){backdrop.classList.add('hidden');}
  function openHelp(){
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent);
    steps.replaceChildren();
    const items=ios
      ? ['Safari에서 이 사이트를 엽니다.','공유 버튼을 누릅니다.','「홈 화면에 추가」를 선택합니다.']
      : ['브라우저 메뉴(⋮ 또는 공유)를 엽니다.','「앱 설치」 또는 「홈 화면에 추가」를 선택합니다.','추가된 아이콘으로 앱을 실행합니다.'];
    const list=document.createElement('ol');
    for(const item of items){const li=document.createElement('li');li.textContent=item;list.append(li);}
    steps.append(list);
    backdrop.classList.remove('hidden');document.getElementById('closeInstall').focus();
  }

  if(standalone())button.classList.add('hidden');
  addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;button.classList.remove('hidden');});
  button.addEventListener('click',async()=>{
    if(!pending){openHelp();return;}
    const prompt=pending;pending=null;
    try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome!=='accepted')openHelp();}
    catch{openHelp();}
  });
  addEventListener('appinstalled',()=>{pending=null;button.classList.add('hidden');closeHelp();});
  document.getElementById('closeInstall').addEventListener('click',closeHelp);
  backdrop.addEventListener('click',event=>{if(event.target===backdrop)closeHelp();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!backdrop.classList.contains('hidden'))closeHelp();});

  if(!('serviceWorker' in navigator)||!isSecureContext){status.textContent='오프라인 사용은 HTTPS 주소에서 지원됩니다.';return;}

  let registration=null;
  let previousController=navigator.serviceWorker.controller;
  let refreshPending=false;
  let refreshing=false;
  let refreshTimer=null;
  let lastUpdateCheck=0;
  const updateMessage='새 버전 준비 완료 · 편집을 마치면 자동 적용됩니다.';
  const editableSelector='input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled]), [contenteditable="true"]';

  function setStatus(message){if(status.textContent!==message)status.textContent=message;}
  function visible(element){
    return !element.closest('.hidden, [hidden], [inert]') && element.getClientRects().length>0 && getComputedStyle(element).visibility!=='hidden';
  }
  function hasManualDraft(){
    // Manual units are saved only by Add. Keep those values even after the
    // editor loses focus or its disclosure is closed.
    if(['unitName','unitPoints','unitLabel','unitOptions'].some(id=>document.getElementById(id)?.value.trim()))return true;
    if(document.getElementById('preset')?.value)return true;
    const count=document.getElementById('unitCount');
    return Boolean(count && count.value!=='' && Number(count.value)!==1);
  }
  function safeToRefresh(){
    if(document.visibilityState!=='visible'||hasManualDraft())return false;
    if([...document.querySelectorAll('[role="dialog"], dialog[open]')].some(visible))return false;
    if(document.getElementById('menuBtn')?.getAttribute('aria-expanded')==='true')return false;
    const active=document.activeElement;
    return !(active instanceof Element && (active.matches(editableSelector)||active.isContentEditable));
  }
  function applyWhenSafe(){
    refreshTimer=null;
    if(refreshing||!refreshPending)return;
    if(!safeToRefresh()){setStatus(updateMessage);return;}
    // A controller change updates fetches but never replaces the current page.
    // Reload once, after modal edits are saved/cancelled and normal change
    // handlers have persisted roster fields.
    refreshing=true;
    location.reload();
  }
  function scheduleRefresh(){
    if(!refreshPending||refreshing)return;
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(applyWhenSafe,750);
  }
  function acceptWaiting(){
    if(!registration?.waiting)return;
    setStatus(updateMessage);
    // The waiting worker has already completed its asset precache. Activation
    // is safe while editing; only this page's later reload must wait.
    registration.waiting.postMessage({type:'SKIP_WAITING'});
  }
  async function checkForUpdate(){
    if(!registration)return;
    acceptWaiting();
    if(!navigator.onLine||Date.now()-lastUpdateCheck<60000)return;
    lastUpdateCheck=Date.now();
    try{await registration.update();acceptWaiting();}catch{/* Keep the usable offline version. */}
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    const next=navigator.serviceWorker.controller;
    if(!next||next===previousController)return;
    const isUpdate=Boolean(previousController);
    previousController=next;
    // First installation already displays the downloaded version; reloading
    // here would interrupt onboarding and can create installation loops.
    if(!isUpdate)return;
    refreshPending=true;
    setStatus(updateMessage);
    scheduleRefresh();
  });
  for(const type of ['focusout','input','change','pointerdown','keydown'])document.addEventListener(type,scheduleRefresh,true);
  new MutationObserver(scheduleRefresh).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','aria-expanded']});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){checkForUpdate();scheduleRefresh();}
  });
  addEventListener('pageshow',()=>{checkForUpdate();scheduleRefresh();});
  addEventListener('online',checkForUpdate);
  addEventListener('focus',()=>{checkForUpdate();scheduleRefresh();});

  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(async result=>{
    registration=result;
    acceptWaiting();
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&navigator.serviceWorker.controller){setStatus(updateMessage);acceptWaiting();}
      });
    });
    checkForUpdate();
    const ready=await navigator.serviceWorker.ready;
    const channel=new MessageChannel();
    channel.port1.onmessage=event=>{
      if(!refreshPending&&!registration.waiting)setStatus(event.data.ready?'로스터·퀵시트 오프라인 준비 완료 · 규칙 원문은 온라인 연결이 필요합니다.':'오프라인 저장을 완료하지 못했습니다. 인터넷 연결 상태에서 새로고침하세요.');
      channel.port1.close();
    };
    ready.active.postMessage({type:'CACHE_STATUS'},[channel.port2]);
  }).catch(()=>{setStatus('오프라인 저장 실패 · 연결 상태를 확인하세요.');});
})();
