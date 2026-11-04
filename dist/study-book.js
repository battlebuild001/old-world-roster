'use strict';
// Authored learning edition. Browser history, army records and saved rosters are untouched.
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TOWStudyBook=api;
})(typeof window==='undefined'?null:window,function(root){
  const FILE='./data/study-rulebook.json';
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const plain=value=>String(value??'').replace(/\s+/g,' ').trim();
  const key=value=>plain(value).normalize('NFKC').toLocaleLowerCase();
  const words=value=>typeof value==='string'||typeof value==='number'?String(value):Array.isArray(value)?value.map(words).join(' '):value&&typeof value==='object'?Object.values(value).map(words).join(' '):'';
  const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]+$/.test(value);
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
  const GROUPS=[
    {id:'foundations',title:'전투를 읽는 기본기',en:'The Foundations',intro:'모델의 숫자와 전열, 주사위가 의미하는 것부터.',start:0,end:7},
    {id:'battle',title:'한 턴을 완성하는 법',en:'The Battle Turn',intro:'전략에서 근접전까지, 실제 플레이 순서대로.',start:8,end:13},
    {id:'specials',title:'기본 규칙이 달라질 때',en:'Beyond the Basics',intro:'심리, 특수 규칙과 병종별 차이를 비교합니다.',start:14,end:17},
    {id:'army',title:'군대와 전장을 준비하기',en:'Armies & Battlefields',intro:'캐릭터와 장비부터 지형, 배치와 승리 조건까지.',start:18,end:24},
    {id:'reference',title:'마법과 게임 중 참조',en:'Magic & Reference',intro:'주문과 아이템, 작은 전투와 판정표를 찾아봅니다.',start:25,end:29}
  ];
  function normalize(input,sourceData=null){
    if(!input||!Array.isArray(input.chapters)||!input.chapters.length)throw Error('Invalid learning rulebook');
    const chapterIds=new Set(),lessonIds=new Set(),sourceSections=sourceData?.sections||[],sections=new Map(sourceSections.map(section=>[section.id,section])),chapters=[],lessons=[];
    for(const [index,original] of input.chapters.entries()){
      if(!validId(original.id)||chapterIds.has(original.id)||!Array.isArray(original.lessons)||!original.lessons.length)throw Error('Invalid study chapter');
      chapterIds.add(original.id);
      const chapter={id:original.id,number:index+1,groupId:GROUPS.find(group=>index>=group.start&&index<=group.end)?.id||'reference',title:plain(original.title),subtitle:plain(original.subtitle),intro:plain(original.intro),outcomes:(original.outcomes||[]).map(plain).filter(Boolean),lessons:[]};
      if(!chapter.title||!chapter.intro)throw Error('Missing study chapter introduction');
      for(const item of original.lessons){
        if(!validId(item.id)||lessonIds.has(item.id)||!plain(item.title)||!plain(item.lead)||!plain(item.takeaway))throw Error('Invalid study lesson');
        lessonIds.add(item.id);
        const lesson={id:item.id,chapterId:chapter.id,number:chapter.lessons.length+1,title:plain(item.title),subtitle:plain(item.subtitle),lead:String(item.lead),takeaway:String(item.takeaway),steps:(item.steps||[]).map(step=>({title:plain(step.title),body:String(step.body??'')})),exceptions:(item.exceptions||[]).map(String),example:{situation:String(item.example?.situation??''),resolution:String(item.example?.resolution??'')},sourceSectionIds:(item.sourceSectionIds||[]).filter(validId),figureIds:(item.figureIds||[]).filter(validId),tableBlockIds:(item.tableBlockIds||[]).filter(validId)};
        if(!lesson.steps.length||lesson.steps.some(step=>!step.title||!step.body))throw Error('Incomplete study steps: '+lesson.id);
        if(item.diagram?.nodes?.length){lesson.diagram={type:'flow',title:plain(item.diagram.title),nodes:item.diagram.nodes.map(plain).filter(Boolean),caption:plain(item.diagram.caption)};}
        if(sections.size&&lesson.sourceSectionIds.some(id=>!sections.has(id)))throw Error('Unknown source section: '+lesson.id);
        const sourceText=lesson.sourceSectionIds.map(id=>{const section=sections.get(id);return section?words(section.title)+' '+section.blocks.map(block=>words(block.text)+' '+words(block.rows)+' '+words(block.originalText)+' '+words(block.originalRows)).join(' '):'';}).join(' ');
        lesson.searchText=key(words(lesson)+' '+chapter.title+' '+chapter.subtitle+' '+sourceText+' '+(root?.TOWI18n?.searchNames?.(sourceText)||''));
        lesson.searchCompact=lesson.searchText.replace(/\s/g,'');
        chapter.lessons.push(lesson);lessons.push(lesson);
      }
      chapters.push(chapter);
    }
    return freeze({schemaVersion:1,metadata:{...(input.metadata||{})},chapters,lessons});
  }
  const state={data:null,source:null,status:'loading',error:'',promise:null,selected:null,query:'',chapter:'all',shown:40,tableModes:{},searchOpen:false};
  const $=id=>root?.document?.getElementById(id);
  const language=()=>root?.TOWI18n?.language||'ko';
  const tr=(ko,en)=>language()==='en'?en:language()==='both'?ko+' / '+en:ko;
  function search(query='',chapterId='all',data=state.data){const tokens=key(query).split(/\s+/).filter(Boolean);return (data?.lessons||[]).filter(lesson=>(chapterId==='all'||lesson.chapterId===chapterId)&&tokens.every(token=>lesson.searchText.includes(token)||lesson.searchCompact.includes(token)));}
  const find=(id,data=state.data)=>data?.lessons.find(lesson=>lesson.id===id)||null;
  const chapterFor=lesson=>state.data?.chapters.find(chapter=>chapter.id===lesson.chapterId);
  const title=value=>escape(value.title)+(value.subtitle?'<span class="studyOriginal">'+escape(value.subtitle)+'</span>':'');
  const icon=(name)=>{const paths={arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',book:'<path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4V4Z"/><path d="M12 6v15M7 8h2m6 0h2M7 12h2m6 0h2"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',chevron:'<path d="m9 5 7 7-7 7"/>',check:'<path d="m5 12 4 4L19 6"/>',cross:'<path d="m6 6 12 12M6 18 18 6"/>',compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>'};return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(paths[name]||paths.arrow)+'</svg>';};
  function format(value){const raw=String(value??''),regex=/\*\*([^*\n]{1,220})\*\*/gu;let html='',end=0;for(const match of raw.matchAll(regex)){html+=escape(raw.slice(end,match.index))+'<strong>'+escape(match[1])+'</strong>';end=match.index+match[0].length;}return html+escape(raw.slice(end));}
  function paragraphs(value){return String(value??'').split(/\n\s*\n/).filter(text=>text.trim()).map(text=>'<p>'+format(text)+'</p>').join('');}
  function diagramHTML(diagram){
    if(!diagram?.nodes?.length)return '';
    return '<figure class="studyDiagram"><figcaption><span class="studyMicro">'+escape(tr('판정의 흐름','Decision flow'))+'</span><strong>'+escape(diagram.title||tr('순서대로 확인하기','Follow the sequence'))+'</strong></figcaption><ol class="studyDiagramFlow">'+diagram.nodes.map((node,index)=>'<li><span class="studyNodeNumber">'+String(index+1).padStart(2,'0')+'</span><span>'+format(node)+'</span>'+(index<diagram.nodes.length-1?'<span class="studyNodeArrow">'+icon('arrow')+'</span>':'')+'</li>').join('')+'</ol>'+(diagram.caption?'<p class="studyDiagramCaption">'+format(diagram.caption)+'</p>':'')+'</figure>';
  }
  function tacticalHTML(){
    const rank=(x,y,count,side)=>Array.from({length:count},(_,i)=>'<rect x="'+(x+i*20)+'" y="'+y+'" width="15" height="20" rx="1" class="'+side+'"/>').join('');
    return '<figure class="studyTactical" aria-label="'+escape(tr('전열과 이동 경로를 표현한 올드 월드 도식','A schematic of ranked units and movement'))+'"><svg viewBox="0 0 330 230" role="img"><title>'+escape(tr('전열을 읽고, 다음 수를 결정하다','Read the formation, plan the next move'))+'</title><defs><pattern id="studyGrid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none"/></pattern><marker id="studyArrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="m0 0 6 3.5L0 7" fill="none"/></marker></defs><rect x="1" y="1" width="328" height="228" fill="url(#studyGrid)" class="studyGrid"/><path d="M25 36h32m-16-16v32M273 192h32m-16-16v32" class="studyCrosshair"/>'+rank(72,145,6,'studyFriendly')+rank(72,170,6,'studyFriendly')+rank(172,44,4,'studyOpponent')+rank(172,69,4,'studyOpponent')+'<path d="M132 133V115Q132 105 144 105H210V98" class="studyMovePath" marker-end="url(#studyArrow)"/><path d="M65 137h130M165 100h90" class="studyFrontLine"/><text x="69" y="218">FORMATION / POSITION / TIMING</text><text x="232" y="125" class="studyTacticalNumber">01—04</text></svg><figcaption>'+escape(tr('전열 · 위치 · 타이밍','Formation · Position · Timing'))+'</figcaption></figure>';
  }
  function sourceAssets(lesson,source=state.source){
    const sections=(source?.sections||[]).filter(section=>lesson.sourceSectionIds.includes(section.id)),blocks=sections.flatMap(section=>section.blocks),tables=blocks.filter(block=>block.type==='table'),images=[];
    const seen=new Set();for(const block of blocks)for(const image of block.images||[]){if(!seen.has(image.src)){seen.add(image.src);images.push(image);}}
    return {sections,tables,images,blocks};
  }
  function safeSourceURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
  function referenceHTML(lesson,source=state.source){
    const assets=sourceAssets(lesson,source),ids=new Set(assets.blocks.flatMap(block=>block.reviews||[])),reviews=(source?.reviews||[]).filter(review=>ids.has(review.id));
    const pair=value=>typeof value==='string'?value:language()==='en'?value?.en||value?.ko:value?.ko||value?.en;
    return '<details class="studySources"><summary><span>'+escape(tr('참고 문서와 정정 근거','Source text & correction notes'))+'</span><span class="studySourceCount">'+assets.sections.length+' '+escape(tr('항목','sections'))+'</span></summary><div class="studySourcesBody"><p>'+escape(tr('아래 문서 항목을 바탕으로 판정 순서와 설명을 다시 구성했습니다. 원문과 정정 전 표현은 참고 문서에서 확인할 수 있습니다.','This lesson reorganizes the following source sections into an explanatory sequence. Open the source reader for its full text and previous wording.'))+'</p>'+reviews.map(review=>'<aside class="studySourceReview"><span class="studyMicro">'+escape(review.status==='verified'?tr('확인된 정정','Verified correction'):tr('해석·판본 주의','Wording or edition note'))+'</span><strong>'+escape(pair(review.title))+'</strong><p>'+escape(pair(review.explanation))+'</p>'+(review.sources||[]).map(item=>{const url=safeSourceURL(item.url);return url?'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(item.title||tr('근거 보기','Read reference'))+' ↗</a>':'';}).join('')+'</aside>').join('')+'<div class="studySourceLinks">'+assets.sections.map(section=>'<button type="button" data-study-source="'+escape(section.id)+'"><span>'+escape(pair(section.title))+'</span>'+icon('chevron')+'</button>').join('')+'</div></div></details>';
  }
  function lessonHTML(lesson,source=state.source){
    if(!lesson)return '';
    const assets=sourceAssets(lesson,source),D=root?.TOWDocumentBook;
    const tables=assets.tables.map(block=>D?.tableHTML?'<section class="studyFactTable" data-study-table="'+escape(block.id)+'">'+D.tableHTML(block)+'</section>':'').join('');
    const images=assets.images.map(image=>D?.imageHTML?D.imageHTML(image):'').join('');
    return '<div class="studyLessonBody"><div class="studyLead">'+paragraphs(lesson.lead)+'</div><aside class="studyTakeaway"><span>'+icon('check')+'</span><div><span class="studyMicro">'+escape(tr('먼저 기억할 것','The essential idea'))+'</span><p>'+format(lesson.takeaway)+'</p></div></aside>'+diagramHTML(lesson.diagram)+'<section class="studyStepsSection"><div class="studySectionLabel"><span class="studyMicro">'+escape(tr('순서대로 이해하기','Step by step'))+'</span><span class="studyRuleLine"></span></div><ol class="studySteps">'+lesson.steps.map((step,index)=>'<li><span class="studyStepIndex">'+String(index+1).padStart(2,'0')+'</span><div><h4>'+format(step.title)+'</h4>'+paragraphs(step.body)+'</div></li>').join('')+'</ol></section>'+tables+(images?'<section class="studyIllustrations" aria-label="'+escape(tr('규칙 도해','Rule diagrams'))+'">'+images+'</section>':'')+(lesson.example?.situation||lesson.example?.resolution?'<aside class="studyWorkedExample"><div class="studyExampleHeader"><span class="studyMicro">'+escape(tr('전장에서 적용해 보기','At the table'))+'</span>'+icon('compass')+'</div><h4>'+escape(tr('이럴 때는 어떻게 판정할까?','How does this resolve?'))+'</h4><div class="studyExampleSituation"><span>'+escape(tr('상황','Situation'))+'</span>'+paragraphs(lesson.example.situation)+'</div><div class="studyExampleResolution"><span>'+escape(tr('판정','Resolution'))+'</span>'+paragraphs(lesson.example.resolution)+'</div></aside>':'')+(lesson.exceptions.length?'<section class="studyExceptions"><h4>'+escape(tr('놓치기 쉬운 조건','Conditions to keep in view'))+'</h4><ul>'+lesson.exceptions.map(item=>'<li>'+format(item)+'</li>').join('')+'</ul></section>':'')+referenceHTML(lesson,source)+'</div>';
  }
  function notify(){root?.document?.dispatchEvent(new root.CustomEvent('tow-study-book-change',{detail:{status:state.status}}));}
  async function load(){
    if(state.promise&&state.status==='loading')return state.promise;
    state.status='loading';state.error='';render();notify();
    const sourcePromise=root?.TOWDocumentBook?.data?Promise.resolve(root.TOWDocumentBook.data):root?.TOWDocumentBook?.load?root.TOWDocumentBook.load():Promise.resolve(null);
    state.promise=Promise.all([root.fetch(FILE).then(response=>{if(!response.ok)throw Error('Study book unavailable');return response.json();}),sourcePromise]).then(([input,source])=>{
      if(!source?.sections?.length)throw Error('Source reference unavailable');state.source=source;state.data=normalize(input,source);state.status='ready';state.error='';render();notify();return state.data;
    }).catch(()=>{state.status='error';state.error=tr('룰북을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.','Could not load the learning rulebook. Check the connection and try again.');render();notify();return null;});return state.promise;
  }
  function focusHeading(){const heading=$('studyReadingTitle');if(heading){heading.focus?.({preventScroll:true});heading.scrollIntoView?.({block:'start',behavior:'auto'});}}
  async function open(id,{navigate=true,focus=true}={}){
    if(!state.data)await (state.status==='loading'&&state.promise?state.promise:load());
    const chapter=state.data?.chapters.find(item=>item.id===id),lesson=find(id)||chapter?.lessons[0];if(!lesson)return false;
    state.selected=lesson.id;state.query='';state.chapter='all';state.shown=40;state.searchOpen=false;
    if(navigate)root.showScreen?.('rules');root.TOWHandbook?.setView('study');render();if(focus)focusHeading();return true;
  }
  function select(id){const chapter=state.data?.chapters.find(item=>item.id===id),lesson=find(id)||chapter?.lessons[0];if(!lesson)return;state.selected=lesson.id;state.query='';state.chapter='all';state.searchOpen=false;render();focusHeading();}
  function contents(){state.selected=null;state.query='';state.chapter='all';state.shown=40;state.searchOpen=false;render();const heading=$('studyBookTitle');heading?.focus?.({preventScroll:true});heading?.scrollIntoView?.({block:'start',behavior:'auto'});}
  function backToContents(){if(state.searchOpen){setSearchOpen(false,{focus:true});return true;}if(!state.selected&&!state.query.trim()&&state.chapter==='all')return false;contents();return true;}
  function renderSearchDisclosure(){
    const button=$('studySearchToggle'),panel=$('studySearchTools');if(!button||!panel)return;
    button.setAttribute('aria-expanded',String(state.searchOpen));panel.hidden=!state.searchOpen;
    $('studySearchToggleLabel').textContent=state.searchOpen?tr('검색 닫기','Close search'):tr('검색','Search');
  }
  function setSearchOpen(open,{focus=false}={}){
    state.searchOpen=Boolean(open);renderSearchDisclosure();
    if(focus)(state.searchOpen?$('studyBookSearch'):$('studySearchToggle'))?.focus?.({preventScroll:true});
  }
  function mount(){
    const host=$('studyBookPanel');if(!host||host.dataset.studyMounted)return;host.dataset.studyMounted='true';host.setAttribute('data-no-i18n','');
    host.innerHTML='<div class="studyBook"><div class="studyUtility"><span id="studyEdition" class="studyEdition"></span><div class="studyUtilityActions"><button type="button" id="studySearchToggle" data-study-search aria-controls="studySearchTools" aria-expanded="false">'+icon('search')+'<span id="studySearchToggleLabel"></span></button><button type="button" data-study-quick>'+icon('compass')+'<span id="studyQuickLabel"></span></button><button type="button" data-study-guide>'+icon('book')+'<span id="studyGuideLabel"></span></button></div></div><div id="studySearchTools" class="studySearchTools" hidden><div class="studySearchField"><label id="studySearchLabel" for="studyBookSearch"></label><div>'+icon('search')+'<input id="studyBookSearch" type="search" autocomplete="off" spellcheck="false"></div></div><div class="studyChapterFilter"><label id="studyChapterLabel" for="studyBookChapter"></label><select id="studyBookChapter"></select></div></div><p id="studyStatus" class="studyStatus" role="status" aria-live="polite" aria-atomic="true"></p><div id="studyError"></div><div id="studyMain"></div><footer id="studyFooter" class="studyFooter"></footer></div>';
    $('studyBookSearch').addEventListener('input',event=>{state.query=event.target.value;state.selected=null;state.shown=40;renderBody();});
    $('studyBookChapter').addEventListener('change',event=>{state.chapter=event.target.value;state.selected=null;state.shown=40;renderBody();});
    host.addEventListener('change',event=>{if(event.target.id==='studyLessonJump')select(event.target.value);});
    host.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.searchOpen&&$('studySearchTools').contains(event.target)){event.preventDefault();setSearchOpen(false,{focus:true});}});
    host.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-study-search'))setSearchOpen(!state.searchOpen,{focus:true});
      if(button.dataset.studyLesson)select(button.dataset.studyLesson);
      if(button.dataset.studyChapter)select(button.dataset.studyChapter);
      if(button.dataset.studySource)root.TOWDocumentBook?.open(button.dataset.studySource);
      if(button.hasAttribute('data-study-contents'))contents();
      if(button.hasAttribute('data-study-clear')){state.query='';state.chapter='all';state.shown=40;render();}
      if(button.hasAttribute('data-study-more')){state.shown+=40;renderBody();}
      if(button.hasAttribute('data-study-retry'))load();
      if(button.hasAttribute('data-study-quick'))root.showScreen?.('quicksheet');
      if(button.hasAttribute('data-study-guide'))root.TOWHandbook?.setView('handbook');
      if(button.dataset.documentTableMode){const table=button.closest('.docBookSmartTable');if(table){const mode=table.dataset.tableMode,small=root.matchMedia?.('(max-width:680px)').matches,next=mode==='auto'?(small?'table':'cards'):mode==='table'?'cards':'table';state.tableModes[button.dataset.documentTableMode]=next;table.dataset.tableMode=next;button.textContent=next==='table'?tr('행별 카드로 보기','Show row cards'):tr('표로 보기','Show table');}}
    });
  }
  function render(){
    if(!$('studyBookPanel'))return;mount();
    $('studyBookPanel').setAttribute('aria-busy',String(state.status==='loading'));
    renderSearchDisclosure();
    $('studyEdition').textContent='THE OLD WORLD / FIELD MANUAL';
    $('studyQuickLabel').textContent=tr('퀵시트','Quick sheet');$('studyGuideLabel').textContent=tr('판정 가이드','Ruling guide');
    $('studySearchLabel').textContent=tr('지금 필요한 규칙 찾기','Find the rule you need');$('studyBookSearch').placeholder=tr('돌격, 브레이크, 마법 시전…','Charge, Break tests, casting spells…');if($('studyBookSearch').value!==state.query)$('studyBookSearch').value=state.query;
    $('studyChapterLabel').textContent=tr('장 범위','Chapter');$('studyBookChapter').innerHTML='<option value="all">'+escape(tr('모든 장','All chapters'))+'</option>'+(state.data?.chapters||[]).map(chapter=>'<option value="'+escape(chapter.id)+'">'+String(chapter.number).padStart(2,'0')+' · '+escape(chapter.title)+'</option>').join('');$('studyBookChapter').value=state.chapter;
    $('studyError').innerHTML=state.status==='error'?'<div class="studyError"><p>'+escape(state.error)+'</p><button type="button" class="secondary" data-study-retry>'+escape(tr('다시 불러오기','Try again'))+'</button></div>':'';
    $('studyFooter').innerHTML='<p>'+escape(tr('제공된 한국어 문서를 바탕으로 다시 쓴 학습·참조용 설명입니다. 공식 한국어 룰북이 아니며, 문서의 정정 사항과 근거는 각 설명 아래에서 확인할 수 있습니다.','An authored Korean learning and reference edition based on the supplied document. This is not an official Korean rulebook. Corrections and references appear below each lesson.'))+'</p>'+(language()!=='ko'?'<p>'+escape(tr('본문은 한국어입니다. 영문 판정 설명은 판정 가이드와 원문 색인을 이용하세요.','Lesson bodies are Korean. Use the ruling guide and source index for English rule explanations.'))+'</p>':'')+(state.source?.metadata?.copyrightNotice?'<p>'+escape(typeof state.source.metadata.copyrightNotice==='string'?state.source.metadata.copyrightNotice:state.source.metadata.copyrightNotice.ko||state.source.metadata.copyrightNotice.en||'')+'</p>':'');renderBody();
  }
  function chapterCard(chapter){return '<button type="button" class="studyChapterCard" data-study-chapter="'+escape(chapter.id)+'"><span class="studyChapterNumber">'+String(chapter.number).padStart(2,'0')+'</span><span class="studyChapterCardBody"><span class="studyChapterCardTitle">'+escape(chapter.title)+'</span><span class="studyChapterCardSubtitle">'+escape(chapter.subtitle)+'</span><span class="studyChapterCardIntro">'+escape(chapter.intro)+'</span><span class="studyChapterCardMeta">'+chapter.lessons.length+' '+escape(tr('개 설명','lessons'))+'<span aria-hidden="true">/</span>'+escape(chapter.outcomes.slice(0,2).join(' · '))+'</span></span><span class="studyChapterCardArrow">'+icon('arrow')+'</span></button>';}
  function landingHTML(){
    const data=state.data,counts=data.metadata.counts||{},first=data.chapters[0],turn=data.chapters.find(chapter=>chapter.id==='doc-turn')||first;
    return '<header class="studyHero"><div class="studyHeroText"><span class="studyEyebrow">READ THE BATTLE</span><h2 id="studyBookTitle" tabindex="-1">'+escape(tr('올드 월드,','The Old World,'))+'<br><em>'+escape(tr('처음부터 정확하게.','understood from the start.'))+'</em></h2><p>'+escape(tr('무엇을 굴리는지보다, 왜 그 순서로 판정하는지. 한 번의 전투가 이어지는 흐름으로 규칙을 배워 보세요.','Understand why each roll happens in its place. Learn the rules through the connected sequence of a battle.'))+'</p><button type="button" class="studyStartButton" data-study-chapter="'+escape(first.id)+'">'+escape(tr('첫 장부터 읽기','Start with the first chapter'))+icon('arrow')+'</button><div class="studyHeroMeta"><span><strong>'+data.chapters.length+'</strong> '+escape(tr('개 장','chapters'))+'</span><span><strong>'+data.lessons.length+'</strong> '+escape(tr('개 설명','lessons'))+'</span><span><strong>'+(counts.figures||62)+'</strong> '+escape(tr('개 도해','figures'))+'</span></div></div>'+tacticalHTML()+'</header><section class="studyPaths" aria-label="'+escape(tr('읽기 길잡이','Reading paths'))+'"><button type="button" data-study-chapter="'+escape(first.id)+'"><span class="studyPathIcon">'+icon('book')+'</span><span><strong>'+escape(tr('처음 시작한다면','Your first battle'))+'</strong><small>'+escape(tr('모델 프로필부터 한 턴의 진행까지','From model profiles to the complete turn'))+'</small></span>'+icon('arrow')+'</button><button type="button" data-study-chapter="'+escape(turn.id)+'"><span class="studyPathIcon">'+icon('compass')+'</span><span><strong>'+escape(tr('게임 중 판정이 궁금하다면','A ruling at the table'))+'</strong><small>'+escape(tr('전투 단계별로 필요한 순서와 예외 찾기','Find timing, sequence and exceptions by phase'))+'</small></span>'+icon('arrow')+'</button></section><section class="studyTurnStrip" aria-labelledby="studyTurnStripTitle"><div><span class="studyMicro">ONE TURN / FOUR PHASES</span><h3 id="studyTurnStripTitle">'+escape(tr('한 턴의 흐름을 잡아보세요.','Follow the shape of a turn.'))+'</h3></div><ol>'+[['doc-strategy','전략','Strategy'],['doc-movement','이동','Movement'],['doc-shooting','사격','Shooting'],['doc-combat','전투','Combat']].map(([id,ko,en],index)=>'<li><button type="button" data-study-chapter="'+id+'"><span>'+String(index+1).padStart(2,'0')+'</span><strong>'+escape(tr(ko,en))+'</strong>'+icon('arrow')+'</button></li>').join('')+'</ol></section><div class="studyContentsHeader"><span class="studyEyebrow">THE COMPLETE READING PATH</span><h3>'+escape(tr('규칙을 이해하는 순서','A path through the rules'))+'</h3><p>'+escape(tr('기본 원리를 읽고, 연결되는 판정을 한 장씩 따라가세요.','Begin with the principles, then follow each connected ruling.'))+'</p></div><div class="studyChapterGroups">'+GROUPS.map((group,index)=>{const chapters=data.chapters.filter(chapter=>chapter.groupId===group.id);return chapters.length?'<section class="studyChapterGroup"><header><span class="studyGroupNumber">'+String(index+1).padStart(2,'0')+'</span><div><span class="studyMicro">'+escape(group.en)+'</span><h3>'+escape(language()==='en'?group.en:group.title)+'</h3><p>'+escape(group.intro)+'</p></div></header><div class="studyChapterList">'+chapters.map(chapterCard).join('')+'</div></section>':'';}).join('')+'</div>';
  }
  function resultsHTML(matches){
    const snippet=lesson=>{const text=lesson.lead;return escape(text.length>170?text.slice(0,170)+'…':text);};
    return '<header class="studyResultsHead"><span class="studyEyebrow">FIND A RULING</span><h2 id="studyBookTitle" tabindex="-1">'+escape(state.query?tr('“'+state.query+'” 검색 결과','Results for “'+state.query+'”'):tr('선택한 장의 설명','Lessons in this chapter'))+'</h2><p>'+escape(tr(matches.length+'개의 설명을 찾았습니다. 본문과 연결된 참고 문서도 함께 검색합니다.',matches.length+' lessons found. Search includes the connected source text.'))+'</p><button type="button" class="studyTextButton" data-study-clear>'+escape(tr('전체 목차로 돌아가기','Back to the complete contents'))+icon('arrow')+'</button></header><div class="studySearchResults">'+matches.slice(0,state.shown).map(lesson=>{const chapter=chapterFor(lesson);return '<button type="button" data-study-lesson="'+escape(lesson.id)+'"><span class="studyMicro">'+String(chapter.number).padStart(2,'0')+' / '+escape(chapter.title)+'</span><strong>'+escape(lesson.title)+'</strong><small>'+escape(lesson.subtitle)+'</small><p>'+snippet(lesson)+'</p><span class="studyResultArrow">'+icon('arrow')+'</span></button>';}).join('')+(matches.length?'':'<div class="studyNoResults"><h3>'+escape(tr('일치하는 설명이 없습니다.','No matching lessons.'))+'</h3><p>'+escape(tr('검색어를 줄이거나 모든 장에서 다시 찾아보세요.','Try fewer words or search all chapters.'))+'</p></div>')+'</div>'+(matches.length>state.shown?'<button type="button" class="secondary studyMore" data-study-more>'+escape(tr('설명 더 보기 · '+(matches.length-state.shown)+'개','More lessons · '+(matches.length-state.shown)+' remaining'))+'</button>':'');
  }
  function readingHTML(lesson){
    const chapter=chapterFor(lesson),index=state.data.lessons.indexOf(lesson),previous=state.data.lessons[index-1],next=state.data.lessons[index+1];
    const nav=(entry,direction)=>'<button type="button"'+(entry?' data-study-lesson="'+escape(entry.id)+'"':' disabled')+'><span>'+escape(direction==='prev'?tr('← 이전 설명','← Previous lesson'):tr('다음 설명 →','Next lesson →'))+'</span><strong>'+escape(entry?.title||tr('책의 끝','End of the book'))+'</strong></button>';
    return '<div class="studyReadingTop"><button type="button" class="studyTextButton" data-study-contents>'+icon('book')+escape(tr('전체 목차','Contents'))+'</button><span>'+String(chapter.number).padStart(2,'0')+' / '+escape(chapter.title)+'</span><button type="button" class="studyTextButton" data-study-quick>'+escape(tr('퀵시트 열기','Quick sheet'))+icon('arrow')+'</button></div><div class="studyReadingLayout"><aside class="studyReadingAside"><details id="studyChapterContents"'+(!root?.matchMedia?.('(max-width:900px)').matches?' open':'')+'><summary>'+escape(tr('이 장의 목차','In this chapter'))+'<span>'+chapter.lessons.length+'</span></summary><div class="studyChapterContext"><span class="studyMicro">CHAPTER '+String(chapter.number).padStart(2,'0')+'</span><h3>'+escape(chapter.title)+'</h3><p>'+escape(chapter.intro)+'</p></div><ol class="studyLessonToc">'+chapter.lessons.map(item=>'<li><button type="button" data-study-lesson="'+escape(item.id)+'"'+(lesson.id===item.id?' class="active" aria-current="true"':'')+'><span>'+String(item.number).padStart(2,'0')+'</span><strong>'+escape(item.title)+'</strong></button></li>').join('')+'</ol></details></aside><article class="studyReadingArticle" aria-labelledby="studyReadingTitle"><header class="studyArticleHead"><div class="studyArticleEyebrow"><span>'+escape(chapter.subtitle||'THE OLD WORLD')+'</span><span>'+String(lesson.number).padStart(2,'0')+' / '+String(chapter.lessons.length).padStart(2,'0')+'</span></div><h2 id="studyReadingTitle" tabindex="-1">'+title(lesson)+'</h2><div class="studyArticleDivider"><span></span><i aria-hidden="true"></i><span></span></div></header>'+lessonHTML(lesson)+'<nav class="studyPageNav" aria-label="'+escape(tr('학습 룰북 이동','Learning rulebook navigation'))+'">'+nav(previous,'prev')+nav(next,'next')+'</nav><div class="studyLessonJump"><label for="studyLessonJump">'+escape(tr('이 장의 다른 설명','Another lesson in this chapter'))+'</label><select id="studyLessonJump">'+chapter.lessons.map(item=>'<option value="'+escape(item.id)+'"'+(item.id===lesson.id?' selected':'')+'>'+String(item.number).padStart(2,'0')+' · '+escape(item.title)+'</option>').join('')+'</select></div></article></div>';
  }
  function renderBody(){
    if(!$('studyMain'))return;
    const matches=search(state.query,state.chapter),isSearch=Boolean(state.query.trim()||state.chapter!=='all');
    $('studyStatus').textContent=state.status==='loading'?tr('규칙의 흐름과 도해를 준비하고 있습니다…','Preparing the lessons and diagrams…'):state.status==='ready'&&isSearch?tr(matches.length+'개 설명 검색됨',matches.length+' matching lessons'):state.status==='ready'?tr('학습·참조를 위해 다시 쓴 한국어 설명 · 원문과 정정 근거 연결','Authored Korean lessons · linked source text and correction notes'):'';
    if(!state.data){$('studyMain').innerHTML=state.status==='loading'?'<div class="studyLoading" aria-hidden="true"><span></span><span></span><span></span></div>':'';return;}
    const selected=find(state.selected);$('studyMain').innerHTML=selected?readingHTML(selected):isSearch?resultsHTML(matches):landingHTML();
    for(const button of $('studyMain').querySelectorAll('[data-document-table-mode]')){const mode=state.tableModes[button.dataset.documentTableMode];if(mode){button.closest('.docBookSmartTable').dataset.tableMode=mode;button.textContent=mode==='table'?tr('행별 카드로 보기','Show row cards'):tr('표로 보기','Show table');}}
  }
  const api={normalize,search,find,open,load,render,backToContents,back:backToContents,escape,format,paragraphs,diagramHTML,tacticalHTML,lessonHTML,sourceAssets,referenceHTML,safeSourceURL,
    get isReading(){return Boolean(state.selected);},get ready(){return state.promise||(root?.document?load():Promise.resolve(null));},get status(){return state.status;},get data(){return state.data;},get source(){return state.source;},get chapters(){return state.data?.chapters||[];},get lessons(){return state.data?.lessons||[];}
  };
  if(root?.document){mount();root.document.addEventListener('tow-language-change',render);load();}
  return api;
});
