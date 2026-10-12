'use strict';
// Table of contents from tow.whfb.app, 2026-10-11. Full articles load from the source on demand.
(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const lang=()=>window.TOWI18n?.language||'ko';
  const tr=(ko,en)=>lang()==='en'?en:lang()==='both'?`${ko} / ${en}`:ko;
  const curated={
    'Frequently Asked Questions':'자주 묻는 질문','Errata & Amendments':'정오표·개정','Muster Your Forces!':'군세 소집','Choose Scenario':'시나리오 선택','Set up the Battlefield':'전장 설치','Deploy Armies':'군대 배치','To Battle!':'전투 시작','Aftermath':'전투 후','Dice':'주사위','D6':'6면체 주사위','Dice Rolling':'주사위 굴리기','Re-rolls':'재굴림','Natural Rolls':'자연 주사위 눈','Line of Sight':'시야','Unit Strength':'유닛 전력','Characteristic Tests':'능력치 판정','Leadership Tests':'통솔력 판정','Casting Spells':'주문 시전','Dispel':'주문 저지','Miscast':'오시전','The Turn Sequence':'턴 순서','The Strategy Phase Sequence':'전략 단계 순서','The Movement Phase Sequence':'이동 단계 순서','The Shooting Phase Sequence':'사격 단계 순서','The Combat Phase Sequence':'전투 단계 순서','Start of Turn':'턴 시작','Command':'지휘','Conjuration':'주문 시전','Rally Fleeing Units':'패주 유닛 집결','Declare Charges & Charge Reactions':'돌격 및 반응 선언','Who Can Charge?':'돌격할 수 있는 유닛','Charge Reactions':'돌격 반응','Hold':'버티기','Stand & Shoot':'정지 후 사격','Charge Moves':'돌격 이동','Determine Charge Range':'돌격 거리 결정','Failed Charge':'돌격 실패','Compulsory Moves':'강제 이동','Remaining Moves':'남은 이동','Marching':'행군','Wheel':'바퀴 돌리기','Reform':'재편','Flee!':'도주','Choose Unit & Declare Target':'유닛 및 목표 선택','Roll To Hit':'명중 판정','Roll To Wound & Make Armour Saves':'피해·장갑 방어 판정','Remove Casualties & Make Panic Tests':'사상자 제거·패닉 판정','Calculate Combat Result':'전투 결과 계산','Break Test':'이탈 판정','Follow Up & Pursuit':'후속 이동·추격','Panic':'패닉','Fear':'공포','Terror':'공포증','Great Weapon':'대형 무기','Lance':'랜스','Hand Weapon':'한손 무기','Shield':'방패','Armour Piercing':'장갑 관통','Strike Last':'마지막 공격','Armour Bane':'아머 베인','Magic Resistance':'마법 저항','Ward Saves':'와드 세이브','Open Order':'개방 대형','Close Order':'밀집 대형','Marching Column':'행군 종대','Light Cover':'가벼운 엄폐','Heavy Cover':'강한 엄폐','Difficult Terrain':'험지','Dangerous Terrain':'위험 지형','Victory Points':'승점','Army Composition':'군대 편성'
  };
  let catalog=null,entries=[],pathIndex=new Map(),chapter='overview-of-the-game',query='',shown=60;
  window.TOWRulesReader={neighbors(path){const at=pathIndex.get(path);if(at===undefined)return null;const current=entries[at];return {previous:entries[at-1]||null,next:entries[at+1]||null,chapter:current.section,position:current.position,count:current.section.items.length};}};
  function title(item){return lang()==='en'?item.en:(item.ko||curated[item.en]||item.en);}
  function chapterTitle(section){return tr(section.ko,section.en);}
  function refresh(){
    $('rulesTitle').textContent=tr('전체 룰 설명집','Complete rules library');
    $('rulesIntro').textContent=tr('장별 목차를 탐색하거나 규칙 이름을 검색하세요. 항목을 누르면 앱 안에서 본문을 읽을 수 있습니다.','Browse by chapter or search rule titles. Tap an entry to read the full article in the app.');
    $('rulesSearch').placeholder=tr('규칙 이름 검색','Search rule titles');
    document.querySelector('[data-screen="rules"]').textContent=tr('룰북','Rules');
    $('rulesAttribution').innerHTML=`${esc(tr('목차 출처: The Old World Online Rules Index (2026-10-11 확인). 본문은 원문 사이트에서 열 때 불러옵니다. 원본의 최신 정오표를 함께 확인하세요.','Contents: The Old World Online Rules Index (checked 2026-10-11). Article text loads from the source when opened. Check current errata as well.'))} <a href="https://tow.whfb.app/" target="_blank" rel="noopener">${esc(tr('원문 색인 ↗','Source index ↗'))}</a> · <a href="https://tow.whfb.app/errata" target="_blank" rel="noopener">${esc(tr('정오표 ↗','Errata ↗'))}</a>`;
    if(!catalog)return;
    const selected=catalog.chapters.find(s=>s.id===chapter)||catalog.chapters[0];
    $('rulesChapterSelect').innerHTML=catalog.chapters.map(s=>`<option value="${esc(s.id)}" ${s.id===chapter?'selected':''}>${esc(chapterTitle(s))} (${s.items.length})</option>`).join('');
    $('rulesChapters').innerHTML=catalog.chapters.map(s=>`<button type="button" class="rulesChapter ${s.id===chapter?'active':''}" data-rules-chapter="${esc(s.id)}" aria-current="${s.id===chapter?'true':'false'}"><span>${esc(chapterTitle(s))}</span><b>${s.items.length}</b></button>`).join('');
    const searching=!!query.trim(),needle=query.trim().toLocaleLowerCase();
    const candidates=searching?catalog.chapters.flatMap(s=>s.items.map(item=>({...item,section:s}))):selected.items.map(item=>({...item,section:selected}));
    const matches=searching?candidates.filter(item=>(item.en+' '+(item.ko||'')+' '+item.section.ko+' '+item.section.en).toLocaleLowerCase().includes(needle)):candidates;
    $('rulesKicker').textContent=searching?tr('전체 장 검색','Search all chapters'):tr('규칙 목차','Contents');
    $('rulesCurrentTitle').textContent=searching?tr('검색 결과','Search results'):chapterTitle(selected);
    $('rulesCount').textContent=tr(`${matches.length}개 항목`,`${matches.length} entries`);
    $('rulesChapterSource').href=`https://tow.whfb.app${searching?'/':`/${selected.id}`}`;
    $('rulesChapterSource').textContent=tr('원문 목차 ↗','Source chapter ↗');
    $('rulesList').innerHTML=matches.slice(0,shown).map((item,index)=>`<button type="button" class="rulesEntry" data-rules-path="${esc(item.path)}" data-rules-title="${esc(item.en)}" data-rules-ko="${esc(item.ko||'')}"><span class="rulesEntryNo">${index+1}</span><span class="rulesEntryTitle">${esc(title(item))}${lang()!=='en'&&item.ko&&item.ko!==item.en?`<small>${esc(item.en)}</small>`:''}${searching?`<em>${esc(chapterTitle(item.section))}</em>`:''}</span><span class="rulesEntryArrow" aria-hidden="true">›</span></button>`).join('')||`<p class="rulesEmpty">${esc(tr('일치하는 규칙이 없습니다.','No matching rules.'))}</p>`;
    $('rulesMore').classList.toggle('hidden',shown>=matches.length);
    $('rulesMore').textContent=tr(`더 보기 · ${matches.length-shown}개 남음`,`Show more · ${matches.length-shown} remaining`);
  }
  $('rulesChapters').addEventListener('click',event=>{const button=event.target.closest('[data-rules-chapter]');if(!button)return;chapter=button.dataset.rulesChapter;query='';$('rulesSearch').value='';shown=60;refresh();$('rulesCurrentTitle').scrollIntoView({block:'start',behavior:'smooth'});});
  $('rulesChapterSelect').addEventListener('change',event=>{chapter=event.target.value;query='';$('rulesSearch').value='';shown=60;refresh();});
  $('rulesSearch').addEventListener('input',event=>{query=event.target.value;shown=60;refresh();});
  $('rulesMore').addEventListener('click',()=>{shown+=60;refresh();});
  $('rulesList').addEventListener('click',event=>{const button=event.target.closest('[data-rules-path]');if(button)window.openRule?.(button.dataset.rulesTitle,button.dataset.rulesPath,button.dataset.rulesKo);});
  document.addEventListener('tow-language-change',refresh);
  fetch('./rules-catalog.json').then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(data=>{catalog=data;entries=data.chapters.flatMap(section=>section.items.map((item,index)=>({...item,section,position:index+1})));pathIndex=new Map(entries.map((item,index)=>[item.path,index]));refresh();document.dispatchEvent(new Event('tow-rules-catalog-ready')); }).catch(()=>{$('rulesList').textContent=tr('룰 목차를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.','Could not load the rules index. Check your connection.');});
  refresh();
})();
