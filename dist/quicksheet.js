'use strict';
// Every authored ruling has a compact play reference; details use the same data.
(()=>{
  const H=window.TOWHandbook;if(!H)return;
  const $=id=>document.getElementById(id),esc=H.escape;
  const lang=()=>window.TOWI18n?.language||'ko';
  const tr=(ko,en)=>lang()==='en'?en:lang()==='both'?ko+' / '+en:ko;
  const body=value=>{const p=H.pair(value);return lang()==='en'?esc(p.en):esc(p.ko)+(lang()==='both'&&p.ko!==p.en?'<span class="handbookOriginal">'+esc(p.en)+'</span>':'');};
  const woundRows=[["4+","5+","6+","6+","6+","6+","–","–","–","–"],["3+","4+","5+","6+","6+","6+","6+","–","–","–"],["2+","3+","4+","5+","6+","6+","6+","6+","–","–"],["2+","2+","3+","4+","5+","6+","6+","6+","6+","–"],["2+","2+","2+","3+","4+","5+","6+","6+","6+","6+"],["2+","2+","2+","2+","3+","4+","5+","6+","6+","6+"],["2+","2+","2+","2+","2+","3+","4+","5+","6+","6+"],["2+","2+","2+","2+","2+","2+","3+","4+","5+","6+"],["2+","2+","2+","2+","2+","2+","2+","3+","4+","5+"],["2+","2+","2+","2+","2+","2+","2+","2+","3+","4+"]],hitRows=[["4+","4+","5+","5+","5+","5+","5+","5+","5+","5+"],["3+","4+","4+","4+","5+","5+","5+","5+","5+","5+"],["2+","3+","4+","4+","4+","4+","5+","5+","5+","5+"],["2+","3+","3+","4+","4+","4+","4+","4+","5+","5+"],["2+","2+","3+","3+","4+","4+","4+","4+","4+","4+"],["2+","2+","3+","3+","3+","4+","4+","4+","4+","4+"],["2+","2+","2+","3+","3+","3+","4+","4+","4+","4+"],["2+","2+","2+","3+","3+","3+","3+","4+","4+","4+"],["2+","2+","2+","2+","3+","3+","3+","3+","4+","4+"],["2+","2+","2+","2+","3+","3+","3+","3+","3+","4+"]];
  let active=new URLSearchParams(window.location?.search||'').get('quickView')==='charts'?'charts':'all',shown=60;
  function chart(rows,axis,caption){
    return '<div class="quickTableScroll" role="region" tabindex="0" aria-label="'+esc(caption)+'"><table class="quickTable"><caption>'+esc(caption)+'</caption><thead><tr><th scope="col">'+esc(axis)+'</th>'+Array.from({length:10},(_,i)=>'<th scope="col">'+(i+1)+'</th>').join('')+'</tr></thead><tbody>'+rows.map((row,index)=>'<tr><th scope="row">'+(index+1)+'</th>'+row.map(value=>'<td>'+esc(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function matchCharts(query){
    if(!query.trim())return true;
    return query.trim().toLocaleLowerCase().split(/\s+/).every(token=>('판정표 charts 명중 운드 피해 hit wound weapon skill strength toughness ws bs 공격 방어 공격자 방어자 웨폰 스킬 스트렝스 터프니스 주사위').includes(token));
  }
  function chartCards(query){
    if(!matchCharts(query))return '';
    return '<article class="quickCard quickCharts"><div class="quickCardHead"><div><span class="quickPage">'+esc(tr('컴뱃·슈팅 판정','Combat and Shooting rolls'))+'</span><h3>'+esc(tr('핵심 판정표','Core roll charts'))+'</h3></div><button type="button" data-quick-source="charts">'+esc(tr('원문 보기','Source rules'))+'</button></div><h4>'+esc(tr('컴뱃 투 힛: 공격자 WS × 방어자 WS','Combat To Hit: attacking WS × defending WS'))+'</h4><p class="quickChartAxes">'+esc(tr('행(왼쪽): 공격자 WS · 열(위쪽): 방어자 WS. 교차 칸이 필요한 D6 값입니다.','Rows (left): attacking WS. Columns (top): defending WS. Each cell is the required D6 result.'))+'</p>'+chart(hitRows,'WS ↓ / WS →',tr('행: 공격자 WS · 열: 방어자 WS','Rows: attacking WS · Columns: defending WS'))+'<h4>'+esc(tr('투 운드: 공격 S × 방어 T','To Wound: attacking S × defending T'))+'</h4><p class="quickChartAxes">'+esc(tr('행(왼쪽): 공격 S · 열(위쪽): 방어 T. ‘–’는 이 조합에서 운드를 입힐 수 없음을 뜻합니다.','Rows (left): attacking S. Columns (top): defending T. A dash means the attack cannot wound at this combination.'))+'</p>'+chart(woundRows,'S ↓ / T →',tr('행: 공격 S · 열: 방어 T','Rows: attacking S · Columns: defending T'))+'</article>';
  }
  function row(entry){
    return '<article class="quickRule" data-quick-entry="'+esc(entry.id)+'" aria-labelledby="quick-title-'+esc(entry.id)+'"><h4 id="quick-title-'+esc(entry.id)+'">'+H.titleHTML(entry.title)+'</h4><p class="quickRuleSummary">'+body(entry.quick)+'</p>'+(entry.timing.ko?'<p class="quickRuleTiming"><strong>'+esc(tr('시점','Timing'))+'</strong> · '+body(entry.timing)+'</p>':'')+(entry.exceptions.length?'<details class="quickRuleExceptions"><summary>'+esc(tr('조건·수정치·예외 ('+entry.exceptions.length+')','Conditions, modifiers and exceptions ('+entry.exceptions.length+')'))+'</summary><ul>'+entry.exceptions.map(note=>'<li>'+body(note)+'</li>').join('')+'</ul></details>':'')+'<div class="quickRuleActions"><button type="button" class="secondary" data-quick-handbook="'+esc(entry.id)+'">'+esc(tr('설명·절차·예시','Explanation, steps and example'))+'</button>'+(entry.path?'<button type="button" class="secondary" data-quick-source="'+esc(entry.id)+'">'+esc(tr('관련 원문','Source rule'))+'</button>':'')+'</div></article>';
  }
  function render(){
    if(!$('quickSheetContent'))return;
    const focusedFilter=document.activeElement?.id==='quickChapterFilter';
    const query=$('quickSearch').value,chapter=active==='charts'?'all':active;
    $('quickSheetTitle').textContent=tr('올드 월드 전체 판정 퀵시트','The Old World complete ruling quick sheet');
    $('quickSheetIntro').textContent=tr('판정식과 적용 시점을 빠르게 찾으세요. 조건·예외는 펼쳐 보고, 설명 버튼으로 상세 절차와 예시를 읽을 수 있습니다.','Find each ruling and its timing. Expand conditions and exceptions, or open the detailed steps and worked example.');
    $('quickSearch').placeholder=tr('판정·규칙·수정치 전체 검색','Search rulings, rules and modifiers');
    $('quickSearch').setAttribute('aria-label',tr('퀵시트 전체 검색','Search the quick sheet'));
    document.querySelector('#sectionNav button[data-screen="quicksheet"]')?.replaceChildren(document.createTextNode(tr('퀵시트','Quick sheet')));
    $('quickTabs').innerHTML='<button type="button" data-quick-tab="all" class="'+(active!=='charts'?'active':'')+'" aria-pressed="'+(active!=='charts')+'">'+esc(tr('전체 판정','Rulings'))+'</button><button type="button" data-quick-tab="charts" class="'+(active==='charts'?'active':'')+'" aria-pressed="'+(active==='charts')+'">'+esc(tr('판정표','Roll charts'))+'</button><div class="quickFilterField"><label for="quickChapterFilter">'+esc(tr('분류','Category'))+'</label><select id="quickChapterFilter"><option value="all">'+esc(tr('전체 분류','All categories'))+'</option>'+H.chapters.map(item=>'<option value="'+esc(item.id)+'">'+esc(H.text(item.title))+'</option>').join('')+'</select></div>';
    $('quickChapterFilter').value=chapter;
    if(focusedFilter)$('quickChapterFilter').focus({preventScroll:true});
    let count=$('quickResultCount');if(!count){count=document.createElement('p');count.id='quickResultCount';count.className='quickCount';count.setAttribute('role','status');count.setAttribute('aria-live','polite');count.setAttribute('aria-atomic','true');$('quickSheetContent').before(count);}
    if(H.status==='loading'&&!H.entries.length){count.textContent=tr('판정 자료를 불러오고 있습니다…','Loading rulings…');$('quickSheetContent').innerHTML='<div class="quickCard"><p>'+esc(tr('잠시만 기다려 주세요.','Please wait.'))+'</p></div>';return;}
    if(H.status==='error'&&!H.entries.length){count.textContent='';$('quickSheetContent').innerHTML='<div class="handbookError"><p>'+esc(tr('퀵시트 자료를 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요.','Could not load the quick sheet. Check your connection and try again.'))+'</p><button type="button" class="secondary" data-quick-retry>'+esc(tr('다시 불러오기','Try again'))+'</button></div>';return;}
    const matches=H.search(query,chapter),display=active==='charts'?[]:matches.slice(0,shown);
    count.textContent=active==='charts'?tr('명중·상처·랭크·전투 결과·브레이크 판정표','Hit, wound, ranks, combat result and Break charts'):tr(matches.length+' / '+H.entries.length+'개 판정 · '+display.length+'개 표시',matches.length+' / '+H.entries.length+' rulings · '+display.length+' displayed');
    const groups=H.chapters.map(item=>({chapter:item,entries:display.filter(entry=>entry.chapterId===item.id)})).filter(item=>item.entries.length);
    let cards=groups.map(group=>'<section class="quickCard quickChapter"><header class="quickChapterHead"><h3>'+H.titleHTML(group.chapter.title)+'</h3><span>'+esc(String(group.entries.length))+'</span></header>'+group.entries.map(row).join('')+'</section>').join('');
    if(active!=='charts'&&matches.length>shown)cards+='<button type="button" class="secondary quickShowMore" data-quick-more>'+esc(tr('판정 더 보기 · '+(matches.length-shown)+'개 남음','Show more rulings · '+(matches.length-shown)+' remaining'))+'</button>';
    if(active==='charts')cards+=(window.TOWCombatCharts?.html(query)||'')+chartCards(query);
    $('quickSheetContent').innerHTML=cards||'<p class="quickEmpty">'+esc(tr('검색 결과가 없습니다. 검색어를 줄이거나 전체 분류를 선택하세요.','No matches. Try a shorter search or choose all categories.'))+'</p>';
    window.TOWCombatCharts?.mount($('quickSheetContent'));
    const date=H.data?.checkedAt;
    $('quickSheetSource').innerHTML=esc(tr('상세 룰북과 같은 자료로 구성한 플레이 참조표입니다.','A play reference using the same data as the detailed handbook.'))+(date?' · '+esc(tr('원문 확인 '+date,'Sources checked '+date)):'')+' <a href="https://tow.whfb.app/quick-reference" target="_blank" rel="noopener">'+esc(tr('원문 퀵 레퍼런스 ↗','Source quick reference ↗'))+'</a> · <a href="https://tow.whfb.app/errata" target="_blank" rel="noopener">'+esc(tr('정오표 ↗','Errata ↗'))+'</a>';
  }
  $('quickTabs')?.addEventListener('click',event=>{const button=event.target.closest('[data-quick-tab]');if(!button)return;active=button.dataset.quickTab;shown=60;render();});
  $('quickTabs')?.addEventListener('change',event=>{if(event.target.id!=='quickChapterFilter')return;active=event.target.value;shown=60;render();});
  $('quickSearch')?.addEventListener('input',()=>{shown=60;render();});
  $('quickSheetContent')?.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.quickHandbook){H.open(button.dataset.quickHandbook);return;}
    if(button.dataset.quickSource){const entry=H.find(button.dataset.quickSource);if(entry?.path)window.openRule?.(entry.title.en,entry.path);else if(button.dataset.quickSource==='charts')window.openRule?.('Quick Reference','/quick-reference');return;}
    if(button.hasAttribute('data-quick-more')){shown+=60;render();}
    if(button.hasAttribute('data-quick-retry'))H.load();
  });
  document.addEventListener('tow-language-change',render);
  document.addEventListener('tow-handbook-change',render);
  render();
})();
