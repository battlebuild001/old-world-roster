'use strict';
// Local, attributed unit photographs. Opening the viewer does not navigate or save rosters.
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TOWUnitPhotos=api;
})(typeof window==='undefined'?null:window,function(root){
  const FILE='./data/unit-photos.json',MAX_FILE=15*1024*1024;
  const phrase=value=>String(value??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,240);
  const nameKey=value=>phrase(value).replace(/\s*\{[^{}]*\}/g,'').replace(/[‘’`]/g,"'").replace(/[–—]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
  const validFaction=value=>typeof value==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  function originalName(source,record){return phrase(source?.name_en||record?.name||source?.name_de||source?.id||'');}
  function safeImage(value){return typeof value==='string'&&/^\.\/unit-photo-images\/[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g)$/.test(value)?value:null;}
  function safeSourceURL(value){try{const url=new URL(String(value||''));return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
  function normalizeCatalog(input){
    if(!input||!Array.isArray(input.entries))throw Error('Invalid unit photo catalogue');
    const merged=new Map();
    for(const item of input.entries){
      const name=phrase(item.name),faction=phrase(item.faction);if(!name||!validFaction(faction)||!Array.isArray(item.photos))continue;
      const key=faction+'\u0000'+nameKey(name),entry=merged.get(key)||{name,faction,aliases:[],photos:[]};
      entry.aliases=[...new Set([...entry.aliases,...(Array.isArray(item.aliases)?item.aliases:[]).map(phrase).filter(Boolean)])];
      for(const photo of item.photos){
        const src=safeImage(photo?.src),identity=photo?.identity;
        if(!src||identity?.approved!==true||identity.faction!==faction||nameKey(identity.unit)!==nameKey(name)||!['exact-unit-name','official-caption'].includes(identity.method)||entry.photos.some(existing=>existing.src===src))continue;
        entry.photos.push({src,width:Math.max(0,Math.min(30000,Math.trunc(Number(photo.width)||0))),height:Math.max(0,Math.min(30000,Math.trunc(Number(photo.height)||0))),caption:phrase(photo.caption)||name,credit:phrase(photo.credit),identity:{approved:true,unit:phrase(identity.unit),faction,method:identity.method,evidence:phrase(identity.evidence||identity.proof),proofUrl:safeSourceURL(identity.proofUrl)},sourceUrl:safeSourceURL(photo.sourceUrl),fileUrl:safeSourceURL(photo.fileUrl)});
      }
      merged.set(key,entry);
    }
    const owners=new Map();
    for(const entry of merged.values())for(const photo of entry.photos){const key=entry.faction+'\u0000'+photo.src;if(!owners.has(key))owners.set(key,new Set());owners.get(key).add(nameKey(entry.name));}
    for(const entry of merged.values())entry.photos=entry.photos.filter(photo=>owners.get(entry.faction+'\u0000'+photo.src).size===1);
    return freeze({schemaVersion:2,entries:[...merged.values()],counts:{entries:merged.size,photos:[...merged.values()].reduce((total,entry)=>total+entry.photos.length,0)}});
  }
  function findPhotos({name,factionId}={},catalog=state.catalog){
    if(!catalog?.entries||!validFaction(factionId)||!nameKey(name))return [];
    const candidates=catalog.entries.filter(entry=>entry.faction===factionId),key=nameKey(name);
    const exact=candidates.filter(entry=>nameKey(entry.name)===key),matches=exact.length?exact:candidates.filter(entry=>entry.aliases.some(alias=>nameKey(alias)===key));
    // An ambiguous alias must not display a different model as this unit.
    if(matches.length!==1)return [];
    return matches[0].photos.slice();
  }
  async function validateLocalImage(file){
    if(!file||!Number.isFinite(file.size)||file.size<=0||file.size>MAX_FILE)throw Error('file-size');
    if(file.type&&!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('file-type');
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
    const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!png&&!jpeg&&!webp)throw Error('file-type');
    return {name:phrase(file.name)||'Local photo',type:png?'image/png':jpeg?'image/jpeg':'image/webp'};
  }
  const state={catalog:null,status:'idle',promise:null,open:false,request:0,fileRequest:0,imageRequest:0,target:null,trigger:null,basePhotos:[],localPhotos:[],index:0,zoom:false,fileMessage:''};
  const $=id=>root?.document?.getElementById(id),language=()=>root?.TOWI18n?.language||'ko';
  const tr=(ko,en)=>language()==='en'?en:language()==='both'?ko+' / '+en:ko;
  const text=(tag,value,className)=>{const node=root.document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
  const pictures=()=>[...state.basePhotos,...state.localPhotos];
  const active=()=>pictures()[state.index]||null;
  function title(){const name=state.target?.name||'';return root?.TOWI18n?.nameLabel?.(name,language()==='en'?'en':'both')||name;}
  function mounted(){return Boolean($('photoBackdrop'));}
  function mount(){
    if(!root?.document||mounted())return;
    const backdrop=text('div','','sheetBackdrop photoBackdrop hidden');backdrop.id='photoBackdrop';
    backdrop.innerHTML='<section class="detailSheet photoSheet" role="dialog" aria-modal="true" aria-labelledby="photoHeading" data-no-i18n><header class="sheetHead"><div><span id="photoEyebrow" class="cardKicker"></span><h2 id="photoHeading" tabindex="-1"></h2><p id="photoFaction" class="photoFaction"></p></div><button id="closePhoto" class="sheetClose" type="button" aria-label="사진 닫기">×</button></header><div class="sheetBody photoBody"><p id="photoStatus" class="photoStatus" role="status" aria-live="polite" aria-atomic="true"></p><div id="photoEmpty" class="photoEmpty" hidden></div><section id="photoGallery" hidden><div id="photoViewport" class="photoViewport" tabindex="0"><img id="photoImage" alt="" decoding="async" draggable="false"><p id="photoImageStatus" class="photoImageStatus" role="status"></p></div><div class="photoControls"><button id="photoPrevious" type="button"></button><span id="photoCounter" aria-live="polite"></span><button id="photoNext" type="button"></button><button id="photoZoom" type="button" aria-pressed="false"></button></div><p id="photoZoomHint" class="photoZoomHint"></p><div id="photoThumbnails" class="photoThumbnails" role="group"></div><div id="photoCaption" class="photoCaption"></div></section><section class="photoLocal"><button id="photoLocalButton" type="button"></button><input id="photoLocalInput" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><p id="photoLocalHint"></p><p id="photoFileStatus" role="status" aria-live="polite"></p></section></div></section>';
    root.document.body.append(backdrop);
    $('closePhoto').addEventListener('click',close);
    backdrop.addEventListener('click',event=>{if(event.target===backdrop)close();});
    $('photoPrevious').addEventListener('click',()=>move(-1));$('photoNext').addEventListener('click',()=>move(1));
    $('photoZoom').addEventListener('click',()=>{state.zoom=!state.zoom;renderZoom();});
    $('photoLocalButton').addEventListener('click',()=>$('photoLocalInput').click());
    $('photoLocalInput').addEventListener('change',event=>addLocalFiles([...event.target.files||[]]));
    backdrop.addEventListener('click',event=>{const button=event.target.closest('[data-photo-index]');if(button){state.index=Number(button.dataset.photoIndex);state.zoom=false;renderPhoto();}});
    root.document.addEventListener('keydown',event=>{
      if(!state.open)return;const top=root.TOWUIAccessibility?.getActiveDialog?.();if(top&&top!==backdrop.querySelector('[role="dialog"]'))return;
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
      else if(!state.zoom&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();move(event.key==='ArrowLeft'?-1:1);}
    },true);
    root.document.addEventListener('tow-language-change',()=>{if(state.open)render();});
  }
  async function load(){
    if(state.catalog)return state.catalog;if(state.status==='loading'&&state.promise)return state.promise;
    state.status='loading';if(state.open)render();
    state.promise=root.fetch(FILE).then(response=>{if(!response.ok)throw Error('Photo catalogue unavailable');return response.json();}).then(data=>{state.catalog=normalizeCatalog(data);state.status='ready';return state.catalog;}).catch(()=>{state.status='error';return null;});
    return state.promise;
  }
  function revokeLocal(){for(const photo of state.localPhotos){try{root.URL.revokeObjectURL(photo.src);}catch{}}state.localPhotos=[];}
  async function open({name,factionId,faction,trigger}={}){
    if(!root?.document)return false;mount();
    revokeLocal();state.request++;state.fileRequest++;state.imageRequest++;const request=state.request;
    state.target={name:phrase(name),factionId:phrase(factionId),faction:phrase(faction)};state.trigger=trigger||root.document.activeElement;
    state.basePhotos=[];state.index=0;state.zoom=false;state.fileMessage='';state.open=true;
    $('photoBackdrop').classList.remove('hidden');render();$('photoHeading').focus?.({preventScroll:true});root.TOWUIAccessibility?.refresh?.();
    const catalog=await load();if(!state.open||request!==state.request)return false;
    state.basePhotos=findPhotos(state.target,catalog);state.index=0;render();return true;
  }
  function close(){
    if(!state.open)return false;
    state.open=false;state.request++;state.fileRequest++;state.imageRequest++;revokeLocal();
    $('photoBackdrop')?.classList.add('hidden');$('photoImage')?.removeAttribute('src');
    $('photoThumbnails')?.replaceChildren();if($('photoLocalInput'))$('photoLocalInput').value='';
    root.TOWUIAccessibility?.refresh?.();const trigger=state.trigger;state.trigger=null;
    if(trigger?.isConnected)trigger.focus?.({preventScroll:true});return true;
  }
  function move(delta){const count=pictures().length;if(count<2)return;state.index=(state.index+delta+count)%count;state.zoom=false;renderPhoto();}
  async function addLocalFiles(files){
    if(!state.open||!files.length)return false;const request=state.request,fileRequest=++state.fileRequest,valid=[];let errors=0;
    $('photoFileStatus').textContent=tr('사진을 확인하고 있습니다…','Checking the photos…');
    for(const file of files){try{const info=await validateLocalImage(file);valid.push({file,info});}catch{errors++;}}
    if(!state.open||request!==state.request||fileRequest!==state.fileRequest)return false;
    if(valid.length){revokeLocal();for(const {file,info} of valid){const src=root.URL.createObjectURL(file);state.localPhotos.push({src,width:0,height:0,caption:info.name,credit:tr('기기에서 연 사진 · 이 창에서만 표시','Local photo · shown only in this viewer'),local:true});}state.index=state.basePhotos.length;state.zoom=false;}
    state.fileMessage=errors?tr('일부 파일을 열지 못했습니다. JPG·PNG·WebP 사진만 가능하며, 한 장당 15MB 이하여야 합니다.','Some files could not be opened. Choose JPG, PNG or WebP photographs, up to 15MB each.'):tr('기기 사진은 업로드하거나 저장하지 않으며, 사진 창을 닫으면 사라집니다.','Local photos are neither uploaded nor saved and are removed when this viewer closes.');
    $('photoLocalInput').value='';render();return Boolean(valid.length);
  }
  function renderZoom(){
    const photo=active(),image=$('photoImage'),viewport=$('photoViewport');if(!image||!viewport)return;
    viewport.classList.toggle('zoomed',state.zoom);image.style.width=state.zoom?Math.max(1000,photo?.width||0)+'px':'';
    $('photoZoom').setAttribute('aria-pressed',String(state.zoom));$('photoZoom').textContent=state.zoom?tr('화면에 맞추기','Fit to screen'):tr('확대','Zoom');
    $('photoZoomHint').textContent=state.zoom?tr('사진 영역을 좌우·상하로 움직여 확대된 부분을 볼 수 있습니다.','Pan horizontally and vertically inside the photo to see its detail.'):tr('확대 버튼으로 사진의 세부 모습을 볼 수 있습니다.','Use Zoom to examine the photograph in detail.');
    viewport.setAttribute('aria-label',state.zoom?tr('확대 사진 · 스크롤하여 보기','Enlarged photo · scroll to explore'):tr('유닛 사진','Unit photograph'));
    viewport.scrollLeft=0;viewport.scrollTop=0;
  }
  function renderPhoto(){
    if(!state.open)return;const photos=pictures(),photo=active();if(!photo)return;
    const request=++state.imageRequest,image=$('photoImage'),status=$('photoImageStatus');
    image.onload=()=>{if(!state.open||request!==state.imageRequest)return;status.textContent='';$('photoViewport').classList.remove('photoLoading');};
    image.onerror=()=>{if(!state.open||request!==state.imageRequest)return;$('photoViewport').classList.remove('photoLoading');status.replaceChildren(text('span',tr('사진을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.','The photo could not load. Check your connection and try again.')));const retry=text('button',tr('사진 다시 불러오기','Reload photo'));retry.type='button';retry.addEventListener('click',renderPhoto);status.append(retry);};
    status.textContent=tr('사진을 불러오고 있습니다…','Loading the photograph…');$('photoViewport').classList.add('photoLoading');
    image.alt=photo.caption||state.target.name;image.referrerPolicy='no-referrer';
    if(photo.width)image.width=photo.width;else image.removeAttribute('width');if(photo.height)image.height=photo.height;else image.removeAttribute('height');image.src=photo.src;
    $('photoCounter').textContent=(state.index+1)+' / '+photos.length;$('photoPrevious').disabled=photos.length<2;$('photoNext').disabled=photos.length<2;
    $('photoPrevious').textContent=tr('← 이전','← Previous');$('photoNext').textContent=tr('다음 →','Next →');
    const thumbs=$('photoThumbnails');thumbs.replaceChildren();thumbs.setAttribute('aria-label',tr('사진 선택','Choose a photograph'));
    for(const [index,item] of photos.entries()){const button=text('button','','photoThumbnail');button.type='button';button.dataset.photoIndex=String(index);button.setAttribute('aria-label',tr((index+1)+'번 사진 보기','View photo '+(index+1)));button.setAttribute('aria-pressed',String(index===state.index));const thumb=root.document.createElement('img');thumb.src=item.src;thumb.alt='';thumb.width=72;thumb.height=64;thumb.loading='lazy';thumb.decoding='async';button.append(thumb);thumbs.append(button);}
    thumbs.hidden=photos.length<2;
    const caption=$('photoCaption');caption.replaceChildren(text('p',photo.caption||state.target.name));
    if(photo.credit)caption.append(text('p',photo.credit,'photoCredit'));
    if(photo.sourceUrl){const link=text('a',tr('사진 출처 ↗','Photo source ↗'));link.href=photo.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';caption.append(link);}
    renderZoom();
  }
  function render(){
    if(!mounted()||!state.open)return;
    $('photoEyebrow').textContent='THE OLD WORLD · UNIT PHOTOGRAPHS';$('photoHeading').textContent=title();$('photoFaction').textContent=state.target?.faction||'';
    $('closePhoto').setAttribute('aria-label',tr('사진 닫기','Close photographs'));
    $('photoStatus').textContent=state.status==='loading'?tr('유닛 사진을 준비하고 있습니다…','Preparing the unit photographs…'):'';
    const photos=pictures(),empty=$('photoEmpty');empty.hidden=photos.length>0||state.status==='loading';empty.replaceChildren();
    if(state.status==='error'){empty.append(text('h3',tr('사진 자료를 불러오지 못했습니다.','The photograph catalogue could not load.')),text('p',tr('인터넷 연결을 확인한 뒤 다시 불러오세요. 기기 사진도 이 창에서 열 수 있습니다.','Check your connection and retry. You can also open a local photograph in this viewer.')));const button=text('button',tr('다시 불러오기','Retry'));button.type='button';button.addEventListener('click',async()=>{const request=state.request;const catalog=await load();if(state.open&&request===state.request){state.basePhotos=findPhotos(state.target,catalog);state.index=0;render();}});empty.append(button);}
    else if(!photos.length)empty.append(text('h3',tr('이 유닛과 일치하는 사진이 아직 없습니다.','There are no matching photographs for this unit yet.')),text('p',tr('보유한 모델 사진을 기기에서 열어 볼 수 있습니다.','You can open a photograph of your model from your device.')));
    $('photoGallery').hidden=!photos.length;
    $('photoLocalButton').textContent=tr('기기에서 사진 열기','Open a photo from this device');$('photoLocalHint').textContent=tr('JPG·PNG·WebP · 한 장당 최대 15MB. 업로드·저장하지 않으며, 창을 닫으면 사라집니다.','JPG, PNG or WebP · Up to 15MB each. Never uploaded or saved; removed when this viewer closes.');$('photoFileStatus').textContent=state.fileMessage;
    if(photos.length)renderPhoto();
  }
  const thumbnailRequests=new WeakMap();
  function bindThumbnail(button,{name,factionId}={}){
    if(!root?.document||!button)return;
    const request={name:phrase(name),factionId:phrase(factionId)};thumbnailRequests.set(button,request);
    button.dataset.photoState='loading';
    // Native lazy loading defers the image itself; all thumbnails share one catalogue request.
    load().then(catalog=>{
      if(!button.isConnected||thumbnailRequests.get(button)!==request)return;
      const photo=findPhotos(request,catalog)[0];
      if(!photo){button.dataset.photoState='unavailable';return;}
      const image=root.document.createElement('img');image.alt='';image.width=photo.width||64;image.height=photo.height||76;
      image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
      image.onload=()=>{if(!button.isConnected||thumbnailRequests.get(button)!==request)return;button.dataset.photoState='ready';button.classList.add('has-unit-photo');};
      image.onerror=()=>{if(!button.isConnected||thumbnailRequests.get(button)!==request)return;image.remove();button.classList.remove('has-unit-photo');button.dataset.photoState='unavailable';};
      image.src=photo.src;button.querySelector('img')?.remove();button.append(image);
    });
  }
  return {originalName,nameKey,safeImage,safeSourceURL,normalizeCatalog,findPhotos,validateLocalImage,open,close,load,addLocalFiles,bindThumbnail,
    get ready(){return state.promise||Promise.resolve(state.catalog);},get status(){return state.status;},get catalog(){return state.catalog;},get isOpen(){return state.open;},get photos(){return pictures();}};
});
