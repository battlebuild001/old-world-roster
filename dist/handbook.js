'use strict';
// Authored explanations and the quick sheet share one immutable reference dataset.
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TOWHandbook=api;
})(typeof window==='undefined'?null:window,function(root){
  const files=['./data/handbook-foundations.json','./data/handbook-battles.json','./data/handbook-specials.json'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const plain=value=>String(value??'').replace(/\s+/g,' ').trim();
  const key=value=>plain(value).normalize('NFKC').toLocaleLowerCase();
  const safePath=value=>typeof value==='string'&&/^\/(?!\/)[^<>"\\\s?#]*$/.test(value)?value:null;
  const words=value=>typeof value==='string'?value:Array.isArray(value)?value.map(words).join(' '):value&&typeof value==='object'?Object.values(value).map(words).join(' '):'';
  const pair=value=>typeof value==='string'||typeof value==='number'?{ko:String(value),en:String(value)}:{ko:plain(value?.ko||value?.en),en:plain(value?.en||value?.ko)};
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
  function normalize(packs){
    if(!Array.isArray(packs)||!packs.length)throw Error('No handbook data');
    const chapterIds=new Set(),entryIds=new Set(),chapters=[],entries=[];
    for(const pack of packs){
      if(!Array.isArray(pack?.chapters))throw Error('Invalid handbook chapters');
      for(const original of pack.chapters){
        if(!original?.id||chapterIds.has(original.id)||!Array.isArray(original.entries))throw Error('Invalid or duplicate handbook chapter');
        chapterIds.add(original.id);
        const chapter={id:String(original.id),title:pair(original.title),description:pair(original.description),entries:[]};
        if(!chapter.title.ko||!chapter.title.en)throw Error('Missing chapter title');
        for(const source of original.entries){
          if(!source?.id||entryIds.has(source.id))throw Error('Invalid or duplicate handbook entry');
          entryIds.add(source.id);
          const entry={id:String(source.id),chapterId:chapter.id,title:pair(source.title),aliases:Array.isArray(source.aliases)?source.aliases.map(plain):[],path:safePath(source.path),summary:pair(source.summary),timing:pair(source.timing),steps:(source.steps||[]).map(pair),exceptions:(source.exceptions||[]).map(pair),example:pair(source.example),quick:pair(source.quick),sources:(source.sources||[]).map(item=>({title:plain(item.title),path:safePath(item.path)})).filter(item=>item.path)};
          if(!entry.title.ko||!entry.title.en||!entry.summary.ko||!entry.quick.ko||!entry.steps.length)throw Error('Incomplete handbook entry: '+entry.id);
          if(source.table&&Array.isArray(source.table.columns)&&Array.isArray(source.table.rows)){
            const columns=source.table.columns.map(pair),rows=source.table.rows.map(row=>row.map(pair));
            if(!columns.length||rows.some(row=>row.length!==columns.length))throw Error('Invalid handbook table: '+entry.id);
            entry.table={caption:pair(source.table.caption),columns,rows};
          }
          entry.searchText=key(words(entry)+' '+words(chapter.title));
          chapter.entries.push(entry);entries.push(entry);
        }
        chapters.push(chapter);
      }
    }
    if(!entries.length)throw Error('Empty handbook');
    return freeze({version:1,checkedAt:packs.map(pack=>plain(pack.checkedAt)).sort().at(-1)||'',chapters,entries});
  }
  function search(query='',chapterId='all',data=state.data){
    const tokens=key(query).split(/\s+/).filter(Boolean);
    return (data?.entries||[]).filter(entry=>(chapterId==='all'||entry.chapterId===chapterId)&&tokens.every(token=>entry.searchText.includes(token)));
  }
  const state={data:null,status:'loading',error:'',promise:null,view:'document',chapter:'all',query:'',selected:null,shown:60};
  const language=()=>root?.TOWI18n?.language||'ko';
  const tr=(ko,en)=>language()==='en'?en:language()==='both'?ko+' / '+en:ko;
  const text=value=>{const valuePair=pair(value);return language()==='en'?valuePair.en:language()==='both'&&valuePair.ko!==valuePair.en?valuePair.ko+' / '+valuePair.en:valuePair.ko;};
  function html(value){
    const valuePair=pair(value);
    if(language()==='en')return esc(valuePair.en);
    return esc(valuePair.ko)+(language()==='both'&&valuePair.en!==valuePair.ko?'<span class="handbookOriginal">'+esc(valuePair.en)+'</span>':'');
  }
  function titleHTML(value){
    const valuePair=pair(value);
    if(language()==='en')return esc(valuePair.en);
    return esc(valuePair.ko)+(valuePair.en!==valuePair.ko?'<small class="handbookTitleOriginal">'+esc(valuePair.en)+'</small>':'');
  }
  function tableHTML(table){
    if(!table?.columns?.length)return '';
    const caption=text(table.caption);
    return '<div class="handbookTableWrap" role="region" tabindex="0" aria-label="'+esc(caption)+'"><table class="handbookTable"><caption>'+esc(caption)+'</caption><thead><tr>'+table.columns.map(column=>'<th scope="col">'+html(column)+'</th>').join('')+'</tr></thead><tbody>'+table.rows.map(row=>'<tr>'+row.map((cell,index)=>(index===0?'<th scope="row">':'<td>')+html(cell)+(index===0?'</th>':'</td>')).join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  const $=id=>root?.document?.getElementById(id);
  function notify(){if(root?.document)root.document.dispatchEvent(new root.CustomEvent('tow-handbook-change',{detail:{status:state.status}}));}
  async function load(){
    if(state.status==='loading'&&state.promise)return state.promise;
    state.status='loading';state.error='';render();notify();
    state.promise=Promise.all(files.map(async file=>{
      const response=await root.fetch(file);if(!response.ok)throw Error('Handbook file unavailable');return response.json();
    })).then(packs=>{
      state.data=normalize(packs);state.status='ready';state.error='';
      if(!state.selected)state.selected=state.data.entries[0]?.id;
      render();notify();return state.data;
    }).catch(()=>{
      state.status='error';state.error=tr('룰북 자료를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.','Could not load the handbook. Check your connection and try again.');
      render();notify();return null;
    });
    return state.promise;
  }
  function setView(view){
    if(!['document','handbook','library','tutorial'].includes(view))return;
    state.view=view;
    for(const [mode,id] of [['document','documentBookPanel'],['handbook','handbookPanel'],['library','rulesLibraryPanel'],['tutorial','tutorialPanel']])$(id)?.classList.toggle('hidden',mode!==view);
    root?.document?.querySelectorAll('[data-rules-view]').forEach(button=>{
      const active=button.dataset.rulesView===view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    refreshViewLabels();
  }
  function refreshViewLabels(){
    const labels={document:['문서 룰북','Document rulebook'],handbook:['판정 가이드','Ruling guide'],library:['원문 색인','Source index'],tutorial:['처음 배우기','Learn to play']};
    root?.document?.querySelectorAll('[data-rules-view]').forEach(button=>{const value=labels[button.dataset.rulesView];if(value)button.textContent=tr(...value);});
    $('handbookPanel')?.setAttribute('data-no-i18n','');
  }
  function focusArticle(){
    const heading=$('handbookArticleTitle');if(!heading)return;
    heading.focus({preventScroll:true});
    heading.scrollIntoView({block:'start',behavior:'auto'});
  }
  async function open(id,{focus=true,navigate=true}={}){
    if(!state.data)await (state.promise||load());
    const entry=state.data?.entries.find(item=>item.id===id);if(!entry)return false;
    state.selected=id;state.chapter='all';state.query='';state.shown=60;
    if($('handbookSearch'))$('handbookSearch').value='';
    if(navigate)root.showScreen?.('rules');
    setView('handbook');render();
    if(root.matchMedia?.('(max-width: 880px)').matches)$('handbookContents')?.removeAttribute('open');
    if(focus)focusArticle();
    return true;
  }
  function mount(){
    const host=$('handbookPanel');if(!host||host.dataset.handbookMounted)return;
    host.dataset.handbookMounted='true';host.setAttribute('data-no-i18n','');
    host.innerHTML='<div class="viewIntro handbookIntro"><span class="eyebrow">THE OLD WORLD · FIELD REFERENCE</span><h2 id="handbookTitle"></h2><p id="handbookIntro"></p></div><div class="handbookTools"><div><label for="handbookSearch" id="handbookSearchLabel"></label><input id="handbookSearch" type="search" autocomplete="off" spellcheck="false"></div><div><label for="handbookChapter" id="handbookChapterLabel"></label><select id="handbookChapter"></select></div></div><div id="handbookStatus" class="handbookStatus" role="status" aria-live="polite" aria-atomic="true"></div><div id="handbookError" class="handbookError hidden"></div><div class="handbookLayout"><aside class="handbookSidebar"><details id="handbookContents"><summary id="handbookContentsLabel"></summary><div id="handbookList"></div><button id="handbookMore" type="button" class="secondary hidden"></button></details></aside><article id="handbookArticle" class="handbookArticle" aria-labelledby="handbookArticleTitle"></article></div><p id="handbookAttribution" class="quickSource"></p>';
    if(!root.matchMedia?.('(max-width: 880px)').matches)$('handbookContents').setAttribute('open','');
    $('handbookSearch').addEventListener('input',event=>{state.query=event.target.value;state.shown=60;if(state.query.trim())$('handbookContents').setAttribute('open','');renderContent();});
    $('handbookChapter').addEventListener('change',event=>{state.chapter=event.target.value;state.shown=60;$('handbookContents').setAttribute('open','');renderContent();});
    host.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.handbookEntry){state.selected=button.dataset.handbookEntry;renderContent();if(root.matchMedia?.('(max-width: 880px)').matches)$('handbookContents').removeAttribute('open');focusArticle();}
      if(button.dataset.handbookSource){const entry=api.find(button.dataset.handbookSource),path=safePath(button.dataset.sourcePath||entry?.path);if(path)root.openRule?.(button.dataset.sourceTitle||entry?.title.en||'Rule',path);}
      if(button.hasAttribute('data-handbook-retry'))load();
      if(button.hasAttribute('data-handbook-library'))setView('library');
      if(button.id==='handbookMore'){state.shown+=60;renderContent();}
    });
  }
  function render(){
    if(!$('handbookPanel'))return;
    mount();refreshViewLabels();
    $('handbookTitle').textContent=tr('올드 월드 상세 룰북','The Old World detailed handbook');
    $('handbookIntro').textContent=tr('판정이 필요한 순간부터 결과 적용까지. 절차·수정치·예외와 예시를 한곳에서 확인하세요.','Follow a ruling from its trigger to its result, with procedures, modifiers, exceptions and worked examples.');
    $('handbookSearchLabel').textContent=tr('전체 내용 검색','Search the handbook');
    $('handbookSearch').placeholder=tr('규칙·판정·키워드 검색','Search rules, rolls and keywords');
    $('handbookChapterLabel').textContent=tr('장 선택','Chapter');
    $('handbookChapter').innerHTML='<option value="all">'+esc(tr('전체 장','All chapters'))+'</option>'+(state.data?.chapters||[]).map(chapter=>'<option value="'+esc(chapter.id)+'">'+esc(text(chapter.title))+'</option>').join('');
    $('handbookChapter').value=state.chapter;
    const error=$('handbookError');error.classList.toggle('hidden',state.status!=='error');
    error.innerHTML=state.status==='error'?'<p>'+esc(tr('룰북 자료를 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요.','Could not load the handbook. Check your connection and try again.'))+'</p><button type="button" class="secondary" data-handbook-retry>'+esc(tr('다시 불러오기','Try again'))+'</button>':'';
    $('handbookPanel').setAttribute('aria-busy',String(state.status==='loading'));
    const date=state.data?.checkedAt;
    $('handbookAttribution').innerHTML=esc(tr('이 앱에서 작성한 규칙 설명과 판정 안내입니다.','Explanations and ruling guides authored for this app.'))+(date?' · '+esc(tr('원문 확인 '+date,'Sources checked '+date)):'')+'<br>'+esc(tr('진영별 규칙·아이템·주문의 전체 항목은 원문 전체 색인에서도 찾을 수 있습니다.','Faction rules, items and spells are also available in the full source index.'))+' <a href="https://tow.whfb.app/" target="_blank" rel="noopener">'+esc(tr('The Old World Online Rules Index ↗','The Old World Online Rules Index ↗'))+'</a> · <a href="https://tow.whfb.app/errata" target="_blank" rel="noopener">'+esc(tr('정오표 ↗','Errata ↗'))+'</a>';
    renderContent();
  }
  function renderContent(){
    if(!$('handbookList'))return;
    const matches=search(state.query,state.chapter);
    $('handbookStatus').textContent=state.status==='loading'?tr('룰북 자료를 불러오고 있습니다…','Loading the handbook…'):state.data?tr(matches.length+' / '+state.data.entries.length+'개 판정·설명',matches.length+' / '+state.data.entries.length+' rulings and explanations'):'';
    $('handbookContentsLabel').textContent=tr('목차 · '+matches.length+'개 항목','Contents · '+matches.length+' entries');
    if(!state.data){$('handbookList').innerHTML='';$('handbookArticle').innerHTML='<h3 id="handbookArticleTitle" tabindex="-1">'+esc(tr('상세 룰북','Detailed handbook'))+'</h3><p class="handbookMuted">'+esc(state.status==='loading'?tr('잠시만 기다려 주세요.','Please wait.'):tr('다시 불러오기를 누르면 자료를 확인합니다.','Choose Try again to load the reference.'))+'</p>';return;}
    const selected=matches.find(entry=>entry.id===state.selected)||matches[0];
    if(selected)state.selected=selected.id;
    let lastChapter='';
    $('handbookList').innerHTML=matches.slice(0,state.shown).map(entry=>{
      const chapter=state.data.chapters.find(item=>item.id===entry.chapterId);
      const heading=entry.chapterId!==lastChapter?'<h3 class="handbookListChapter">'+esc(text(chapter.title))+'</h3>':'';
      lastChapter=entry.chapterId;
      return heading+'<button type="button" class="handbookListEntry'+(entry.id===state.selected?' active':'')+'" data-handbook-entry="'+esc(entry.id)+'"'+(entry.id===state.selected?' aria-current="true"':'')+'><span>'+titleHTML(entry.title)+'</span><span aria-hidden="true">›</span></button>';
    }).join('')||'<p class="handbookMuted">'+esc(tr('일치하는 항목이 없습니다.','No matching entries.'))+'</p>';
    $('handbookMore').classList.toggle('hidden',matches.length<=state.shown);$('handbookMore').textContent=tr('목차 더 보기 ('+Math.max(0,matches.length-state.shown)+')','Show more entries ('+Math.max(0,matches.length-state.shown)+')');
    if(!selected){$('handbookArticle').innerHTML='<h3 id="handbookArticleTitle" tabindex="-1">'+esc(tr('검색 결과가 없습니다.','No matching rules.'))+'</h3><p>'+esc(tr('검색어를 줄이거나 다른 장을 선택하세요.','Try a shorter search or choose another chapter.'))+'</p><button type="button" class="secondary" data-handbook-library>'+esc(tr('원문 전체 색인 보기','Open full source index'))+'</button>';return;}
    const chapter=state.data.chapters.find(item=>item.id===selected.chapterId),index=matches.indexOf(selected),previous=matches[index-1],next=matches[index+1];
    const sourceList=selected.sources.length?selected.sources:selected.path?[{title:selected.title.en,path:selected.path}]:[];
    const navButton=(entry,direction)=>'<button type="button" class="secondary handbookPageButton"'+(entry?' data-handbook-entry="'+esc(entry.id)+'"':' disabled')+'><span class="handbookPageDirection">'+esc(direction==='prev'?tr('← 이전 판정','← Previous ruling'):tr('다음 판정 →','Next ruling →'))+'</span><span>'+esc(entry?text(entry.title):tr('끝','End'))+'</span></button>';
    $('handbookArticle').innerHTML='<header class="handbookArticleHead"><div class="handbookBreadcrumb"><span>'+esc(text(chapter.title))+'</span><span>'+esc(String(index+1)+' / '+matches.length)+'</span></div><h3 id="handbookArticleTitle" tabindex="-1">'+titleHTML(selected.title)+'</h3><p class="handbookLead">'+html(selected.summary)+'</p></header>'+(selected.timing.ko?'<div class="handbookTiming"><strong>'+esc(tr('언제 판정하나요?','When to resolve'))+'</strong><p>'+html(selected.timing)+'</p></div>':'')+'<section class="handbookSection"><h4>'+esc(tr('판정 절차','Resolution sequence'))+'</h4><ol class="handbookFlow">'+selected.steps.map(step=>'<li><div>'+html(step)+'</div></li>').join('')+'</ol></section>'+(selected.table?tableHTML(selected.table):'')+(selected.exceptions.length?'<section class="handbookSection handbookExceptions"><h4>'+esc(tr('적용 조건·수정치·예외','Conditions, modifiers and exceptions'))+'</h4><ul>'+selected.exceptions.map(note=>'<li>'+html(note)+'</li>').join('')+'</ul></section>':'')+(selected.example.ko?'<section class="handbookExample"><h4>'+esc(tr('판정 예시','Worked example'))+'</h4><p>'+html(selected.example)+'</p></section>':'')+'<section class="handbookReferences"><h4>'+esc(tr('관련 원문','Source rules'))+'</h4><div>'+sourceList.map(source=>'<button type="button" class="secondary" data-handbook-source="'+esc(selected.id)+'" data-source-path="'+esc(source.path)+'" data-source-title="'+esc(source.title)+'">'+esc(source.title)+' <span aria-hidden="true">↗</span></button>').join('')+'</div></section><nav class="handbookPageNav" aria-label="'+esc(tr('판정 간 이동','Ruling navigation'))+'">'+navButton(previous,'prev')+navButton(next,'next')+'</nav>';
  }
  const api={
    normalize,search,find:id=>state.data?.entries.find(entry=>entry.id===id)||null,text,titleHTML,tableHTML,safePath,escape:esc,pair,open,setView,load,
    get ready(){return state.promise|| (root?.document?load():Promise.resolve(null));},
    get chapters(){return state.data?.chapters||[];},get entries(){return state.data?.entries||[];},
    get data(){return state.data;},get status(){return state.status;},get error(){return state.error;},get view(){return state.view;}
  };
  if(root?.document){
    root.document.querySelectorAll('[data-rules-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.rulesView)));
    root.document.addEventListener('tow-language-change',()=>{render();refreshViewLabels();});
    mount();setView('document');load();
  }
  return api;
});
