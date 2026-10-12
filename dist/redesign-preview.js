(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const icons={
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-7h6v7"/>',
    army:'<path d="M12 2 4 5v6c0 5 3 8.5 8 11 5-2.5 8-6 8-11V5l-8-3Z"/><path d="m8.5 12 2.3 2.3 4.8-5"/>',
    library:'<path d="M4 3h14a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V3Z"/><path d="M4 17a2 2 0 0 1 2-2h14M8 7h8M8 11h7"/>',
    saved:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>'
  };
  document.querySelectorAll('.sideNav [data-view],.mobileNav [data-view]').forEach(button=>{
    const slot=button.querySelector('.navGlyph')||button.querySelector('span');
    if(slot){slot.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[button.dataset.view]+'</svg>';slot.setAttribute('aria-hidden','true')}
  });
  const catalog=[
    {id:'paladin',ko:'팔라딘',en:'Paladin',category:'characters',points:60,min:1,options:[{ko:'방패',en:'Shield',points:2},{ko:'퀘스팅 서약',en:'The Questing Vow',points:15}]},
    {id:'knights',ko:'왕국의 기사 (기마)',en:'Mounted Knights of the Realm',category:'core',points:24,min:3,options:[{ko:'퍼스트 나이트 (챔피언)',en:'First Knight (champion)',points:7},{ko:'기수',en:'Standard bearer',points:7},{ko:'악사',en:'Musician',points:7}]},
    {id:'men',ko:'맨앳암즈',en:'Men-at-Arms',category:'core',points:4,min:10,options:[{ko:'예오맨 (챔피언)',en:'Yeoman (champion)',points:7},{ko:'기수',en:'Standard bearer',points:5},{ko:'악사',en:'Musician',points:5}]},
    {id:'bowmen',ko:'농민 궁수',en:'Peasant Bowmen',category:'core',points:5,min:10,options:[{ko:'빌랭 (챔피언)',en:'Villein (champion)',points:7},{ko:'기수',en:'Standard bearer',points:5},{ko:'악사',en:'Musician',points:5}]}
  ];
  const initial=[
    {id:'paladin',count:1,points:60},
    {id:'knights',count:6,points:144},
    {id:'men',count:20,points:80}
  ];
  let units=initial.map(x=>({...x})),view='home',pane='units',filter='all',selected=null,libraryTopic=null,language='ko';
  const tx=(ko,en)=>language==='en'?en:language==='both'?ko+' / '+en:ko;
  const fmt=n=>new Intl.NumberFormat('en-US').format(n);
  const total=()=>units.reduce((sum,x)=>sum+x.points,0);
  const viewNames={home:['홈','Home'],army:['군세','Army'],library:['규칙','Rules'],saved:['보관함','Saved']};
  const categoryName={characters:['캐릭터','Characters'],core:['코어','Core'],special:['스페셜','Special']};
  function name(item){return tx(item.ko,item.en)}
  function translateStatic(){
    document.documentElement.lang=language==='en'?'en':'ko';
    document.querySelectorAll('[data-ko][data-en]').forEach(el=>el.textContent=tx(el.dataset.ko,el.dataset.en));
    document.querySelectorAll('[data-ko-placeholder][data-en-placeholder]').forEach(el=>el.placeholder=tx(el.dataset.koPlaceholder,el.dataset.enPlaceholder));
    document.querySelectorAll('[data-lang]').forEach(el=>{el.classList.toggle('selected',el.dataset.lang===language);el.setAttribute('aria-pressed',String(el.dataset.lang===language))});
    $('topbarView').textContent=tx(...viewNames[view]);
  }
  function setView(next){
    if(!viewNames[next])return;
    view=next;
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+next));
    document.querySelectorAll('[data-view]').forEach(el=>{const active=el.dataset.view===next;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
    $('topbarView').textContent=tx(...viewNames[next]);
    window.scrollTo({top:0,behavior:'instant'});
  }
  function unitRow(entry,index,removable=false){
    const item=catalog.find(x=>x.id===entry.id);
    if(!item)return '';
    return '<div class="sampleUnit"><span class="sampleUnitIcon" aria-hidden="true">'+(item.category==='characters'?'✦':'◈')+'</span><div class="sampleUnitMain"><strong>'+name(item)+'</strong><small>'+entry.count+' '+tx('모델','models')+' · '+tx(...categoryName[item.category])+'</small></div><span class="sampleUnitPoints">'+fmt(entry.points)+' pts</span>'+(removable?'<button type="button" class="removeDemo" data-remove="'+index+'" aria-label="'+tx('예시 유닛 제거','Remove sample unit')+'">×</button>':'')+'</div>';
  }
  function renderTotals(){
    const pts=total(),pct=Math.min(100,pts/2000*100);
    $('heroPoints').textContent=fmt(pts);
    $('heroUnits').textContent=units.length+' '+tx('유닛','units');
    $('heroMeter').style.width=pct+'%';
    $('armyPoints').innerHTML=fmt(pts)+' <small>/ 2,000 pts</small>';
    $('armyMeter').style.width=pct+'%';
    $('rosterCount').textContent=units.length+' '+tx('유닛','units');
    $('savedPoints').textContent=fmt(pts)+' pts';
    $('savedUnits').textContent=units.length+' '+tx('유닛','units');
    $('homeUnits').innerHTML=units.length?units.slice(0,4).map((u,i)=>unitRow(u,i)).join(''):'<div class="rosterEmpty">'+tx('아직 예시 유닛이 없습니다. 군세에서 추가해 보세요.','No sample units yet. Add one from Army.')+'</div>';
    $('rosterUnits').innerHTML=units.length?units.map((u,i)=>unitRow(u,i,true)).join(''):'<div class="rosterEmpty">'+tx('아직 예시 유닛이 없습니다. 유닛 찾기에서 추가해 보세요.','No sample units yet. Add one from Find units.')+'</div>';
  }
  function renderCatalog(){
    const q=$('unitSearch').value.trim().toLowerCase();
    const list=catalog.filter(x=>(filter==='all'||x.category===filter)&&(!q||((x.ko+' '+x.en).toLowerCase().includes(q))));
    $('unitCatalog').innerHTML=list.length?list.map(x=>'<article class="unitCard"><div class="unitCardTop"><span>'+tx(...categoryName[x.category])+'</span><small>'+tx('최소 '+x.min+' 모델','Min '+x.min+' models')+'</small></div><h3>'+name(x)+'<small>'+x.en+'</small></h3><p>'+tx('기본 프로필과 옵션을 확인하고 예시 군세에 추가합니다.','Review the base profile and options before adding to the sample army.')+'</p><div class="unitCardBottom"><strong>'+x.points+' <small>pts / '+tx('모델','model')+'</small></strong><button type="button" data-select="'+x.id+'">'+tx('옵션 선택 →','Choose options →')+'</button></div></article>').join(''):'<div class="catalogEmpty">'+tx('검색 결과가 없습니다.','No matching units.')+'</div>';
  }
  function setPane(next){
    pane=next;
    $('armyUnitsPane').hidden=next!=='units';
    $('armyRosterPane').hidden=next!=='roster';
    document.querySelectorAll('[data-army-pane]').forEach(x=>{x.classList.toggle('active',x.dataset.armyPane===next);x.setAttribute('aria-pressed',String(x.dataset.armyPane===next))});
  }
  const libraryContent={
    rules:{title:['전체 룰북','Rules library'],body:['장별 목차와 검색으로 필요한 규칙을 찾습니다. 유닛의 키워드에서도 본문으로 이어집니다.','Browse chapters or search for a rule. Unit keywords also lead to the full text.'],url:'/?screen=rules',cta:['전체 룰북 열기 ↗','Open rules ↗']},
    quick:{title:['퀵시트','Quick sheet'],body:['게임 중 자주 확인하는 턴 순서와 판정표를 빠르게 펼칩니다.','Open the turn sequence and reference tables during play.'],url:'/?screen=quicksheet',cta:['퀵시트 열기 ↗','Open quick sheet ↗']},
    tutorial:{title:['처음 배우기','Tutorial book'],body:['도식과 예시가 들어간 10장으로 게임을 순서대로 배웁니다.','Learn the game in ten chapters with diagrams and worked examples.'],url:'/?screen=rules&tutorial=1',cta:['튜토리얼 열기 ↗','Open tutorial ↗']}
  };
  function renderLibrary(){
    document.querySelectorAll('.libraryCard').forEach(el=>el.classList.toggle('selected',el.dataset.library===libraryTopic));
    if(!libraryTopic)return;
    const item=libraryContent[libraryTopic];
    $('libraryDetail').innerHTML='<div class="detailSplash"><span>✦</span><div><span class="eyebrow">SELECTED PATH</span><strong style="display:block;margin-top:5px">'+tx(...item.title)+'</strong><p>'+tx(...item.body)+'</p><a class="btn dark libraryAction" href="'+item.url+'">'+tx(...item.cta)+'</a></div></div>';
  }
  function sheetTotal(){
    if(!selected)return;
    const count=Math.max(selected.min,Math.min(999,Math.trunc(Number($('modelCount').value)||selected.min)));
    const extra=[...$('sheetOptions').querySelectorAll('input:checked')].reduce((sum,x)=>sum+Number(x.dataset.points),0);
    $('sheetPoints').textContent=fmt(selected.points*count+extra)+' pts';
  }
  function openSheet(id){
    selected=catalog.find(x=>x.id===id);
    if(!selected)return;
    $('sheetTitle').textContent=name(selected);
    $('sheetCategory').textContent=tx(...categoryName[selected.category]);
    $('modelCount').min=String(selected.min);
    $('modelCount').value=String(selected.min);
    $('sheetOptions').innerHTML=selected.options.map((x,i)=>'<label class="sheetOption"><input type="checkbox" data-points="'+x.points+'" data-option="'+i+'"><span>'+tx(x.ko,x.en)+'<small>'+x.en+'</small></span><b>+'+x.points+' pts</b></label>').join('');
    sheetTotal();
    $('unitSheet').hidden=false;
    $('closeSheet').focus();
  }
  function closeSheet(){$('unitSheet').hidden=true;selected=null}
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-view],[data-go]');
    if(nav){setView(nav.dataset.view||nav.dataset.go);if(nav.dataset.pane)setPane(nav.dataset.pane);if(nav.dataset.library){libraryTopic=nav.dataset.library;renderLibrary()}return}
    const lang=event.target.closest('[data-lang]');
    if(lang){language=lang.dataset.lang;translateStatic();renderTotals();renderCatalog();renderLibrary();if(selected)openSheet(selected.id);return}
    const paneButton=event.target.closest('[data-army-pane]');
    if(paneButton){setPane(paneButton.dataset.armyPane);return}
    const filterButton=event.target.closest('[data-filter]');
    if(filterButton){filter=filterButton.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===filterButton));renderCatalog();return}
    const select=event.target.closest('[data-select]');
    if(select){openSheet(select.dataset.select);return}
    const library=event.target.closest('[data-library]');
    if(library){libraryTopic=library.dataset.library;renderLibrary();return}
    const remove=event.target.closest('[data-remove]');
    if(remove){units.splice(Number(remove.dataset.remove),1);renderTotals();return}
    if(event.target===$('unitSheet')||event.target.closest('#closeSheet'))closeSheet();
  });
  $('unitSearch').addEventListener('input',renderCatalog);
  $('modelCount').addEventListener('input',sheetTotal);
  $('sheetOptions').addEventListener('change',sheetTotal);
  $('countMinus').addEventListener('click',()=>{$('modelCount').value=Math.max(selected?.min||1,Number($('modelCount').value)-1);sheetTotal()});
  $('countPlus').addEventListener('click',()=>{$('modelCount').value=Math.min(999,Number($('modelCount').value)+1);sheetTotal()});
  $('addDemoUnit').addEventListener('click',()=>{
    if(!selected)return;
    const count=Math.max(selected.min,Math.min(999,Math.trunc(Number($('modelCount').value)||selected.min)));
    const extra=[...$('sheetOptions').querySelectorAll('input:checked')].reduce((sum,x)=>sum+Number(x.dataset.points),0);
    units.push({id:selected.id,count,points:selected.points*count+extra});
    closeSheet();renderTotals();setView('army');setPane('roster');
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('unitSheet').hidden)closeSheet()});
  translateStatic();renderTotals();renderCatalog();setView('home');
})();
