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
  navigator.serviceWorker.register('./sw.js').then(async registration=>{
    const ready=await navigator.serviceWorker.ready;
    const channel=new MessageChannel();
    channel.port1.onmessage=event=>{status.textContent=event.data.ready?'로스터·퀵시트 오프라인 준비 완료 · 규칙 원문은 온라인 연결이 필요합니다.':'오프라인 저장을 완료하지 못했습니다. 인터넷 연결 상태에서 새로고침하세요.';channel.port1.close();};
    ready.active.postMessage({type:'CACHE_STATUS'},[channel.port2]);
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)status.textContent='새 버전 준비 완료 · 앱을 다시 열면 적용됩니다.';});});
  }).catch(()=>{status.textContent='오프라인 저장 실패 · 연결 상태를 확인하세요.';});
})();
