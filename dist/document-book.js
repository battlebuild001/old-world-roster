'use strict';
// A complete reading view of the supplied Korean rulebook. Saved armies stay separate.
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TOWDocumentBook=api;
})(typeof window==='undefined'?null:window,function(root){
  const FILE='./data/document-rulebook.json';
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const plain=value=>String(value??'').replace(/\s+/g,' ').trim();
  const key=value=>plain(value).normalize('NFKC').toLocaleLowerCase();
  const pair=value=>typeof value==='string'||typeof value==='number'?{ko:String(value),en:String(value)}:{ko:plain(value?.ko??value?.en),en:plain(value?.en??value?.ko)};
  const words=value=>Array.isArray(value)?value.map(words).join(' '):value&&typeof value==='object'?Object.values(value).map(words).join(' '):String(value??'');
  const idSafe=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]+$/.test(value);
  function safeImage(value){
    const src=String(value||'').replace(/^(?!\.\/)/,'./');
    return /^\.\/document-book-images\/[A-Za-z0-9_-]+\.(?:webp|png|jpe?g)$/i.test(src)?src:null;
  }
  function safeURL(value){
    try{const url=new URL(String(value||''),'https://tow.whfb.app/');return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
  }
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
  function phoneticName(title){return root?.TOWPhonetic?.has(title.en)?root.TOWI18n?.nameLabel(title.en,'ko')||root.TOWPhonetic.korean(title.en):title.ko;}
  function normalize(input){
    if(!input||!Array.isArray(input.chapters)||!Array.isArray(input.sections)||!input.sections.length)throw Error('Invalid document rulebook');
    const chapterIds=new Set(),sectionIds=new Set(),blockIds=new Set(),reviewIds=new Set();
    const reviews=(input.reviews||[]).map(source=>{
      if(!idSafe(source.id)||reviewIds.has(source.id))throw Error('Duplicate document review');reviewIds.add(source.id);
      return {id:source.id,status:source.status==='verified'?'verified':'review',severity:plain(source.severity),title:pair(source.title),explanation:pair(source.explanation),blocks:(source.blocks||[]).map(String),sources:(source.sources||[]).map(item=>({url:safeURL(item.url||item.path),title:plain(item.title),checkedAt:plain(item.checkedAt)})).filter(item=>item.url)};
    });
    const chapters=input.chapters.map(source=>{
      if(!idSafe(source.id)||chapterIds.has(source.id))throw Error('Duplicate document chapter');chapterIds.add(source.id);
      const chapter={id:source.id,title:pair(source.title),sectionIds:(source.sectionIds||[]).map(String)};
      if(!chapter.title.ko)throw Error('Missing document chapter title');return chapter;
    });
    const sections=input.sections.map(source=>{
      if(!idSafe(source.id)||sectionIds.has(source.id)||!chapterIds.has(source.chapterId)||!Array.isArray(source.blocks))throw Error('Invalid document section');sectionIds.add(source.id);
      const blocks=source.blocks.map(block=>{
        if(!idSafe(block.id)||blockIds.has(block.id))throw Error('Duplicate document block');blockIds.add(block.id);
        const normalized={id:block.id,type:block.type||block.kind||'paragraph',text:String(block.text??''),reviews:(block.reviews||[]).map(value=>typeof value==='string'?value:value?.id).filter(Boolean),images:(block.images||[]).map(image=>{
          const src=safeImage(image.src);if(!src)throw Error('Unsafe document image');
          return {src,width:Math.max(0,Number(image.width)||0),height:Math.max(0,Number(image.height)||0),alt:plain(image.alt),caption:pair(image.caption||'')};
        })};
        if(!['paragraph','heading','table','figure'].includes(normalized.type))throw Error('Unknown document block');
        if(block.rows){if(!Array.isArray(block.rows)||block.rows.some(row=>!Array.isArray(row)))throw Error('Invalid document table');normalized.rows=block.rows.map(row=>row.map(cell=>String(cell??'')));}
        if(Array.isArray(block.cells))normalized.cells=block.cells.map(row=>row.map(cell=>cell===null?null:{text:String(cell.text??''),colSpan:Math.min(64,Math.max(1,Number(cell.colSpan)||1)),rowSpan:Math.min(128,Math.max(1,Number(cell.rowSpan)||1)),header:Boolean(cell.header)}));
        if(block.originalText!==undefined)normalized.originalText=String(block.originalText);
        if(Array.isArray(block.originalRows))normalized.originalRows=block.originalRows.map(row=>row.map(cell=>String(cell??'')));
        for(const reviewId of normalized.reviews)if(!reviewIds.has(reviewId))throw Error('Unknown document review: '+reviewId);
        return normalized;
      });
      const section={id:source.id,chapterId:source.chapterId,title:pair(source.title),blocks};
      if(!section.title.ko)throw Error('Missing document section title');
      const alias=root?.TOWI18n?.searchNames(section.title.en)||phoneticName(section.title);
      const chapterTitle=chapters.find(chapter=>chapter.id===section.chapterId).title;
      section.searchText=key(words(section.title)+' '+words(chapterTitle)+' '+alias+' '+blocks.map(block=>block.text+' '+words(block.rows)+' '+String(block.originalText??'')+' '+words(block.originalRows)+' '+block.reviews.map(id=>{const note=reviews.find(item=>item.id===id);return note?words(note.title)+' '+words(note.explanation):'';}).join(' ')+' '+block.images.map(image=>image.alt+' '+words(image.caption)).join(' ')).join(' '));
      section.searchCompact=section.searchText.replace(/\s/g,'');
      return section;
    });
    for(const chapter of chapters){
      const actual=sections.filter(section=>section.chapterId===chapter.id).map(section=>section.id);
      if(!chapter.sectionIds.length)chapter.sectionIds=actual;
      if(chapter.sectionIds.length!==actual.length||chapter.sectionIds.some((id,index)=>id!==actual[index]))throw Error('Mismatched document contents');
    }
    return freeze({schemaVersion:1,metadata:{...(input.metadata||{}),title:pair(input.metadata?.title||{ko:'올드 월드 문서 룰북',en:'The Old World complete rulebook'}),scopeNote:pair(input.metadata?.scopeNote||''),copyrightNotice:pair(input.metadata?.copyrightNotice||'')},chapters,sections,reviews,coverage:input.coverage||{}});
  }
  function search(query='',chapterId='all',data=state.data){
    const tokens=key(query).split(/\s+/).filter(Boolean);
    return (data?.sections||[]).filter(section=>(chapterId==='all'||section.chapterId===chapterId)&&tokens.every(token=>section.searchText.includes(token)||section.searchCompact.includes(token)));
  }
  const state={data:null,status:'loading',error:'',promise:null,query:'',chapter:'all',selected:null,shown:60,tableModes:{},sourceTerms:false};
  const $=id=>root?.document?.getElementById(id);
  const language=()=>root?.TOWI18n?.language||'ko';
  const tr=(ko,en)=>language()==='en'?en:language()==='both'?ko+' / '+en:ko;
  const label=value=>{const p=pair(value);return language()==='en'?p.en:language()==='both'&&p.en!==p.ko?p.ko+' / '+p.en:p.ko;};
  const find=(id,data=state.data)=>data?.sections.find(section=>section.id===id)||null;
  function titleText(title){return language()==='en'?title.en||title.ko:phoneticName(title)||title.ko;}
  function titleHTML(title){
    const main=titleText(title),original=language()==='en'?'':title.en;
    return escape(main)+(original&&original!==main?'<small class="docBookEnglish">'+escape(original)+'</small>':'');
  }
  function bodyText(value){const raw=String(value??'');return state.sourceTerms?raw:root?.TOWI18n?.phoneticTerms(raw,raw)||raw;}
  function highlight(value,query=state.query){
    const raw=String(value??''),tokens=plain(query).split(/\s+/).filter(word=>word.length>1).slice(0,8);
    if(!tokens.length)return escape(raw);
    const expression=new RegExp(tokens.map(token=>token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'giu');
    let result='',end=0;for(const match of raw.matchAll(expression)){result+=escape(raw.slice(end,match.index))+'<mark>'+escape(match[0])+'</mark>';end=match.index+match[0].length;}
    return result+escape(raw.slice(end));
  }
  function formatBody(value){
    const raw=bodyText(value),expression=/\*\*([^*\n]{1,220})\*\*/gu;let result='',end=0;
    for(const match of raw.matchAll(expression)){result+=highlight(raw.slice(end,match.index))+'<strong>'+highlight(match[1])+'</strong>';end=match.index+match[0].length;}
    return result+highlight(raw.slice(end));
  }
  function tableInfo(block){
    const rows=block.rows||[],columns=Math.max(0,...rows.map(row=>row.length)),hasSpans=(block.cells||[]).some(row=>row.some(cell=>cell&&(cell.colSpan>1||cell.rowSpan>1)));
    const maxLength=Math.max(0,...rows.flat().map(cell=>String(cell).length));
    return {columns,hasSpans,verbose:columns>=3&&rows.length>1&&maxLength>90&&!hasSpans,numeric:columns>=7&&maxLength<80};
  }
  function tableHTML(block,{original=false}={}){
    const rows=original?block.originalRows||block.rows||[]:block.rows||[];if(!rows.length)return '';
    const info=tableInfo({...block,rows}),cells=original?null:block.cells,caption=tr('규칙 표','Rule table');
    const rowHTML=(row,index)=>'<tr>'+row.map((value,column)=>{
      const cell=cells?.[index]?.[column];if(cells&&cell===null)return '';
      const isHead=index===0||Boolean(cell?.header),tag=isHead||column===0?'th':'td',scope=isHead?'col':'row';
      return '<'+tag+(tag==='th'?' scope="'+scope+'"':'')+(cell?.colSpan>1?' colspan="'+cell.colSpan+'"':'')+(cell?.rowSpan>1?' rowspan="'+cell.rowSpan+'"':'')+'>'+(original?highlight(value):formatBody(cell?.text??value))+'</'+tag+'>';
    }).join('')+'</tr>';
    const table='<div class="docBookTableRegion'+(info.numeric?' docBookMatrix':'')+'" role="region" tabindex="0" aria-label="'+escape(caption)+'"><table class="docBookTable"><caption class="docBookVisuallyHidden">'+escape(caption)+'</caption><thead>'+rowHTML(rows[0],0)+'</thead><tbody>'+rows.slice(1).map((row,index)=>rowHTML(row,index+1)).join('')+'</tbody></table></div>';
    if(!info.verbose||original)return table;
    const mode=state.tableModes[block.id]||'auto',cards='<div class="docBookTableCards">'+rows.slice(1).map(row=>'<section class="docBookTableCard"><h5>'+formatBody(row[0])+'</h5><dl>'+row.map((value,column)=>'<div><dt>'+escape(bodyText(rows[0][column]||tr('항목 '+(column+1),'Field '+(column+1))))+'</dt><dd>'+formatBody(value)+'</dd></div>').join('')+'</dl></section>').join('')+'</div>';
    return '<div class="docBookSmartTable" data-table-mode="'+mode+'"><div class="docBookTableTools"><span>'+escape(tr('표·행별 보기','Table or row cards'))+'</span><button type="button" class="secondary" data-document-table-mode="'+escape(block.id)+'">'+escape(mode==='table'?tr('행별 카드로 보기','Show row cards'):mode==='cards'?tr('표로 보기','Show table'):tr('보기 전환','Switch view'))+'</button></div>'+table+cards+'</div>';
  }
  function imageHTML(image,index=0){
    const src=safeImage(image.src);if(!src)return '';
    const alt=image.alt||tr('룰북 도해','Rulebook diagram'),caption=label(image.caption)||alt;
    const size=(image.width?' width="'+Math.round(image.width)+'"':'')+(image.height?' height="'+Math.round(image.height)+'"':'');
    return '<figure class="docBookFigure" data-image-src="'+escape(src)+'"><img src="'+escape(src)+'" alt="'+escape(alt)+'"'+size+' loading="lazy" decoding="async"><figcaption>'+escape(caption)+'</figcaption><details class="docBookImageZoom"><summary>'+escape(tr('도해 크게 보기','View diagram at full size'))+'</summary><p>'+escape(tr('그림 안을 좌우로 움직여 원래 크기의 글자와 수치를 확인하세요.','Pan within the image to read the original labels and values.'))+'</p><div class="docBookImagePan" role="region" tabindex="0" aria-label="'+escape(tr('확대 도해: ','Enlarged diagram: ')+alt)+'"><img src="'+escape(src)+'" alt="'+escape(alt)+'"'+size+' loading="lazy" decoding="async"></div></details></figure>';
  }
  function reviewHTML(review){
    const verified=review.status==='verified';
    return '<aside class="docBookReview '+(verified?'verified':'pending')+'" data-review-id="'+escape(review.id)+'"><strong><span class="docBookReviewBadge">'+escape(verified?tr('확인된 정정','Verified correction'):tr('해석·판본 확인','Wording or edition note'))+'</span>'+escape(label(review.title))+'</strong><p>'+escape(label(review.explanation))+'</p>'+(review.sources.length?'<div class="docBookReviewSources">'+review.sources.map(source=>'<a href="'+escape(source.url)+'" target="_blank" rel="noopener noreferrer">'+escape(source.title||tr('확인 출처','Reference'))+' <span aria-hidden="true">↗</span></a>').join('')+'</div>':'')+'</aside>';
  }
  function blockHTML(block,index,seenReviews=new Set()){
    let html='';
    for(const id of block.reviews){if(seenReviews.has(id))continue;seenReviews.add(id);const review=state.data?.reviews.find(item=>item.id===id);if(review)html+=reviewHTML(review);}
    const attrs=' id="document-block-'+escape(block.id)+'" data-document-block="'+escape(block.id)+'"';
    if(block.type==='table')html+='<div class="docBookTableBlock"'+attrs+'>'+tableHTML(block)+'</div>';
    else if(block.type==='heading')html+=index===0?'<div class="docBookAnchor"'+attrs+' aria-hidden="true"></div>':'<h4 class="docBookSubheading"'+attrs+'>'+formatBody(block.text.replace(/^■\s*/,''))+'</h4>';
    else{const fragment=block.text.length<130&&!/[.!?。…]$/.test(block.text.trim())&&!/^\s*(?:[0-9]+[.)]|[-•]|참고\s*:|■)/.test(block.text);html+='<div class="docBookParagraph'+(fragment?' docBookFragment':'')+'"'+attrs+'>'+(block.text?'<p>'+formatBody(block.text)+'</p>':'')+'</div>';}
    html+=block.images.map(imageHTML).join('');
    if(block.originalText!==undefined&&block.originalText!==block.text)html+='<details class="docBookOriginal"><summary>'+escape(tr('제공 문서의 정정 전 표현','Wording in the supplied document'))+'</summary><p>'+escape(block.originalText)+'</p></details>';
    if(block.originalRows)html+='<details class="docBookOriginal"><summary>'+escape(tr('제공 문서의 정정 전 표','Table in the supplied document'))+'</summary>'+tableHTML(block,{original:true})+'</details>';
    return html;
  }
  function notify(){root?.document?.dispatchEvent(new root.CustomEvent('tow-document-book-change',{detail:{status:state.status}}));}
  async function load(){
    if(state.status==='loading'&&state.promise)return state.promise;
    state.status='loading';state.error='';render();notify();
    state.promise=root.fetch(FILE).then(response=>{if(!response.ok)throw Error('Document unavailable');return response.json();}).then(data=>{
      state.data=normalize(data);state.status='ready';if(!find(state.selected))state.selected=state.data.sections[0].id;render();notify();return state.data;
    }).catch(()=>{state.status='error';state.error=tr('문서 룰북을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.','Could not load the complete rulebook. Check your connection and try again.');render();notify();return null;});
    return state.promise;
  }
  function focusArticle(){const heading=$('documentBookTitle');if(heading){heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'auto'});}}
  async function open(id,{navigate=true,focus=true}={}){
    if(!state.data)await (state.promise||load());if(!find(id))return false;
    state.selected=id;state.query='';state.chapter='all';state.shown=60;
    if(navigate)root.showScreen?.('rules');root.TOWHandbook?.setView('document');
    render();if(root.matchMedia?.('(max-width:880px)').matches)$('documentBookContents')?.removeAttribute('open');if(focus)focusArticle();return true;
  }
  function select(id,{focus=true}={}){if(!find(id))return;state.selected=id;renderContent();if(root.matchMedia?.('(max-width:880px)').matches)$('documentBookContents')?.removeAttribute('open');if(focus)focusArticle();}
  function mount(){
    const host=$('documentBookPanel');if(!host||host.dataset.documentBookMounted)return;
    host.dataset.documentBookMounted='true';host.setAttribute('data-no-i18n','');
    host.innerHTML='<header class="viewIntro docBookIntro"><div><span class="eyebrow">THE OLD WORLD · COMPLETE RULEBOOK</span><h2 id="documentBookHeading"></h2><p id="documentBookIntro"></p></div><span id="documentBookSourceBadge" class="docBookSourceBadge"></span></header><div class="docBookTools"><div><label for="documentBookSearch" id="documentBookSearchLabel"></label><input id="documentBookSearch" type="search" autocomplete="off" spellcheck="false"></div><div><label for="documentBookChapter" id="documentBookChapterLabel"></label><select id="documentBookChapter"></select></div></div><p id="documentBookStatus" class="docBookStatus" role="status" aria-live="polite" aria-atomic="true"></p><div id="documentBookError" class="docBookError hidden"></div><div class="docBookLayout"><aside class="docBookSidebar"><details id="documentBookContents"><summary id="documentBookContentsLabel"></summary><div id="documentBookList"></div><button type="button" id="documentBookMore" class="secondary hidden"></button></details></aside><article id="documentBookArticle" class="docBookArticle" aria-labelledby="documentBookTitle"></article></div><footer id="documentBookAttribution" class="docBookAttribution"></footer>';
    if(!root.matchMedia?.('(max-width:880px)').matches)$('documentBookContents').setAttribute('open','');
    $('documentBookSearch').addEventListener('input',event=>{state.query=event.target.value;state.shown=60;if(state.query.trim())$('documentBookContents').setAttribute('open','');renderContent();});
    $('documentBookChapter').addEventListener('change',event=>{state.chapter=event.target.value;state.shown=60;$('documentBookContents').setAttribute('open','');renderContent();});
    host.addEventListener('change',event=>{if(event.target.id==='documentBookJump')select(event.target.value);});
    host.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.documentSection)select(button.dataset.documentSection);
      if(button.hasAttribute('data-document-retry'))load();
      if(button.hasAttribute('data-document-clear')){state.query='';state.chapter='all';state.shown=60;render();}
      if(button.id==='documentBookMore'){state.shown+=60;renderContent();}
      if(button.hasAttribute('data-document-terms')){state.sourceTerms=!state.sourceTerms;renderContent();}
      if(button.hasAttribute('data-document-quick'))root.showScreen?.('quicksheet');
      if(button.hasAttribute('data-document-guide'))root.TOWHandbook?.setView('handbook');
      if(button.dataset.documentTableMode){const id=button.dataset.documentTableMode,current=state.tableModes[id]||'auto',small=root.matchMedia?.('(max-width:680px)').matches;state.tableModes[id]=current==='auto'?(small?'table':'cards'):current==='table'?'cards':'table';renderContent();}
    });
  }
  function render(){
    if(!$('documentBookPanel'))return;mount();
    $('documentBookHeading').textContent=tr('올드 월드 전체 룰북','The Old World complete rulebook');
    $('documentBookIntro').textContent=tr('제공된 한국어 룰북의 본문·판정표·도해를 장별로 읽고, 규칙 이름과 본문 내용으로 찾아보세요.','Read the supplied Korean rulebook by chapter, including its full text, tables and diagrams. Search titles or the complete text.');
    const sourceYear=state.data?.metadata.year||2026;
    $('documentBookSourceBadge').textContent=tr('한국어 문서 · '+sourceYear,'Korean source · '+sourceYear);
    $('documentBookSearchLabel').textContent=tr('본문 전체 검색','Search full text');$('documentBookSearch').placeholder=tr('규칙·무장·주문·아이템 이름 검색','Search rules, weapons, spells and items');$('documentBookSearch').value=state.query;
    $('documentBookChapterLabel').textContent=tr('장 선택','Chapter');
    $('documentBookChapter').innerHTML='<option value="all">'+escape(tr('전체 장','All chapters'))+'</option>'+(state.data?.chapters||[]).map(chapter=>'<option value="'+escape(chapter.id)+'">'+escape(label(chapter.title))+'</option>').join('');$('documentBookChapter').value=state.chapter;
    $('documentBookPanel').setAttribute('aria-busy',String(state.status==='loading'));
    const error=$('documentBookError');error.classList.toggle('hidden',state.status!=='error');error.innerHTML=state.status==='error'?'<p>'+escape(state.error)+'</p><button type="button" class="secondary" data-document-retry>'+escape(tr('다시 불러오기','Try again'))+'</button>':'';
    const metadata=state.data?.metadata,scope=metadata?label(metadata.scopeNote):'';
    $('documentBookAttribution').innerHTML='<p>'+escape(tr('제공된 한국어 번역 문서(2026)를 바탕으로 구성했습니다. 영어 설명은 판정 가이드와 원문 색인에서도 확인할 수 있습니다.','Based on the supplied Korean translation (2026). English explanations are also available in the ruling guide and source index.'))+'</p>'+(scope?'<p>'+escape(scope)+'</p>':'')+(metadata?.copyrightNotice?'<p>'+escape(label(metadata.copyrightNotice))+'</p>':'');
    renderContent();
  }
  function snippet(section){
    if(!state.query.trim())return '';
    const token=key(state.query).split(/\s+/).filter(Boolean)[0],all=section.blocks.map(block=>block.text+' '+words(block.rows)).join(' '),at=key(all).indexOf(token);
    if(at<0)return '';const start=Math.max(0,at-45);return '<span class="docBookSnippet">'+(start?'…':'')+highlight(all.slice(start,start+135))+'…</span>';
  }
  function renderContent(){
    if(!$('documentBookList'))return;
    const matches=search(state.query,state.chapter),total=state.data?.sections.length||0;
    $('documentBookStatus').textContent=state.status==='loading'?tr('전체 룰북을 불러오고 있습니다…','Loading the complete rulebook…'):state.data?tr(matches.length+' / '+total+'개 세부 항목 · '+state.data.chapters.length+'개 장',matches.length+' / '+total+' sections · '+state.data.chapters.length+' chapters'):'';
    $('documentBookContentsLabel').textContent=tr('목차 · '+matches.length+'개 항목','Contents · '+matches.length+' sections');
    if(!state.data){$('documentBookList').innerHTML='';$('documentBookArticle').innerHTML='<h3 id="documentBookTitle" tabindex="-1">'+escape(tr('문서 룰북','Complete rulebook'))+'</h3><p class="docBookMuted">'+escape(state.status==='loading'?tr('본문과 도해 자료를 준비하고 있습니다.','Preparing the full text and diagrams.'):tr('다시 불러오기를 눌러 자료를 확인하세요.','Choose Try again to load the book.'))+'</p>';return;}
    const selected=matches.find(section=>section.id===state.selected)||matches[0];if(selected)state.selected=selected.id;
    let prior='';$('documentBookList').innerHTML=matches.slice(0,state.shown).map(section=>{
      const chapter=state.data.chapters.find(item=>item.id===section.chapterId),head=prior!==section.chapterId?'<h3 class="docBookListChapter">'+escape(label(chapter.title))+'</h3>':'';prior=section.chapterId;
      return head+'<button type="button" class="docBookListEntry'+(section.id===state.selected?' active':'')+'" data-document-section="'+escape(section.id)+'"'+(section.id===state.selected?' aria-current="true"':'')+'><span>'+titleHTML(section.title)+snippet(section)+'</span><span aria-hidden="true">›</span></button>';
    }).join('')||'<p class="docBookMuted">'+escape(tr('일치하는 항목이 없습니다.','No matching sections.'))+'</p>';
    $('documentBookMore').classList.toggle('hidden',matches.length<=state.shown);$('documentBookMore').textContent=tr('목차 더 보기 · '+Math.max(0,matches.length-state.shown),'Show more · '+Math.max(0,matches.length-state.shown)+' remaining');
    if(!selected){$('documentBookArticle').innerHTML='<h3 id="documentBookTitle" tabindex="-1">'+escape(tr('검색 결과가 없습니다.','No matching sections.'))+'</h3><p>'+escape(tr('검색어를 줄이거나 전체 장에서 찾아보세요.','Use fewer words or search all chapters.'))+'</p><button type="button" class="secondary" data-document-clear>'+escape(tr('검색 초기화','Clear search'))+'</button>';return;}
    const chapter=state.data.chapters.find(item=>item.id===selected.chapterId),index=matches.indexOf(selected),previous=matches[index-1],next=matches[index+1],chapterSections=state.data.sections.filter(section=>section.chapterId===selected.chapterId);
    const nav=(entry,direction)=>'<button type="button" id="documentBook'+(direction==='prev'?'Prev':'Next')+'" class="secondary docBookPageButton"'+(entry?' data-document-section="'+escape(entry.id)+'"':' disabled')+'><span>'+escape(direction==='prev'?tr('← 이전 항목','← Previous section'):tr('다음 항목 →','Next section →'))+'</span><strong>'+escape(entry?titleText(entry.title):tr('끝','End'))+'</strong></button>';
    const originalTitle=phoneticName(selected.title)!==selected.title.ko?'<p class="docBookSourceTitle">'+escape(tr('문서 제목: ','Source heading: ')+selected.title.ko)+'</p>':'';
    const seenReviews=new Set(),body=selected.blocks.map((block,at)=>blockHTML(block,at,seenReviews)).join('');
    $('documentBookArticle').innerHTML='<header class="docBookArticleHead"><div class="docBookBreadcrumb"><span>'+escape(label(chapter.title))+'</span><span>'+escape(String(index+1)+' / '+matches.length)+'</span></div><h3 id="documentBookTitle" tabindex="-1">'+titleHTML(selected.title)+'</h3>'+originalTitle+'<div class="docBookArticleActions"><button type="button" class="secondary" data-document-terms aria-pressed="'+String(state.sourceTerms)+'">'+escape(state.sourceTerms?tr('음차 용어로 보기','Show phonetic terms'):tr('문서 표기로 보기','Show source terminology'))+'</button><button type="button" class="secondary" data-document-quick>'+escape(tr('퀵시트','Quick sheet'))+'</button><button type="button" class="secondary" data-document-guide>'+escape(tr('판정 가이드','Ruling guide'))+'</button></div><label class="docBookJumpLabel" for="documentBookJump">'+escape(tr('이 장의 항목 바로가기','Jump within this chapter'))+'</label><select id="documentBookJump">'+chapterSections.map(section=>'<option value="'+escape(section.id)+'"'+(section.id===selected.id?' selected':'')+'>'+escape(titleText(section.title))+'</option>').join('')+'</select></header><div class="docBookBody">'+body+'</div><nav class="docBookPageNav" aria-label="'+escape(tr('룰북 항목 이동','Rulebook section navigation'))+'">'+nav(previous,'prev')+nav(next,'next')+'</nav>';
  }
  const api={normalize,search,find,open,load,escape,pair,safeImage,safeURL,tableHTML,imageHTML,highlight,formatBody,titleText,
    get ready(){return state.promise||(root?.document?load():Promise.resolve(null));},get status(){return state.status;},get error(){return state.error;},get data(){return state.data;},get chapters(){return state.data?.chapters||[];},get sections(){return state.data?.sections||[];}
  };
  if(root?.document){mount();root.document.addEventListener('tow-language-change',render);load();}
  return api;
});
