'use strict';
// Concise, authored bilingual play aid. Source: tow.whfb.app/quick-reference (Rulebook p.344).
(() => {
  const sections = [
    {id:'turn',ko:'턴 순서',en:'Turn sequence',path:'/the-turn-sequence/the-turn-sequence',page:'p. 116',items:[
      ['한 플레이어의 턴은 전략 → 이동 → 사격 → 전투 순서입니다.','A player turn runs Strategy → Movement → Shooting → Combat.'],
      ['각 단계의 하위 순서를 마친 뒤 다음 단계로 넘어갑니다.','Complete each phase’s substeps before moving to the next phase.']
    ]},
    {id:'magic',ko:'마법',en:'Magic',path:'/magic/casting-spells',page:'p. 108',items:[
      ['시전: 2D6 + ⌈마법사 레벨 ÷ 2⌉. 결과가 시전값 이상이면 성공합니다.','Cast: 2D6 + ⌈Wizard Level ÷ 2⌉. Meet or exceed the casting value.'],
      ['저지: 2D6 + ⌈저지하는 마법사 레벨 ÷ 2⌉. 시전 결과보다 높아야 합니다.','Dispel: 2D6 + ⌈dispelling Wizard Level ÷ 2⌉. Exceed the casting result.'],
      ['시전 더블 6은 자동 성공·저지 불가, 더블 1은 오시전입니다. 저지 더블 6은 자동 성공, 더블 1은 실패합니다.','Casting double 6 succeeds and cannot be dispelled; double 1 miscasts. Dispelling double 6 succeeds; double 1 fails.'],
      ['마법사 저지 범위: 레벨 1–2는 18″, 레벨 3–4는 24″. 운명 저지는 턴당 한 번, 거리 제한이 없습니다.','Wizardly dispel range: Level 1–2: 18″; Level 3–4: 24″. One Fated dispel per turn has no range limit.']
    ]},
    {id:'strategy',ko:'전략 단계',en:'Strategy phase',path:'/the-strategy-phase/the-strategy-phase-sequence',page:'p. 116',items:[
      ['① 턴 시작 행동·판정 → ② 지휘 능력 → ③ 강화·저주 주문 → ④ 패주 중인 유닛 집결 판정','① Start of turn → ② Command → ③ Enchantment/Hex spells → ④ Rally fleeing units']
    ]},
    {id:'movement',ko:'이동 단계',en:'Movement phase',path:'/the-movement-phase/the-movement-phase-sequence',page:'p. 118',items:[
      ['① 돌격 및 반응 선언 → ② 돌격 이동 → ③ 강제 이동 → ④ 남은 이동·이동 주문','① Declare charges and reactions → ② Charge moves → ③ Compulsory moves → ④ Remaining moves and Conveyance spells'],
      ['돌격 거리: 이동력 M + 2D6 중 높은 눈. 실패한 돌격은 목표 쪽으로 돌격 주사위 눈만큼 이동합니다.','Charge range: M + the higher of 2D6. A failed charge moves toward the target by the charge roll.'],
      ['돌격 반응: 유지, 정지 후 사격, 도주. 적이 돌격 유닛의 이동력보다 가까우면 정지 후 사격를 선언할 수 없습니다.','Charge reactions: Hold, Stand & Shoot, or Flee. Stand & Shoot is unavailable if the enemy is closer than its M.'],
      ['행군은 보통 M×2, 행군 종대는 M×3. 적 8″ 이내에서 행군하려면 통솔력 판정이 필요합니다.','March up to 2×M, or 3×M in Marching Column. Within 8″ of an enemy, pass a Leadership test to march.']
    ]},
    {id:'shooting',ko:'사격 단계',en:'Shooting phase',path:'/the-shooting-phase/the-shooting-phase-sequence',page:'p. 136',items:[
      ['유닛마다 목표 선언 → 명중 → 피해·방어 → 피해 적용·패닉 판정까지 마친 뒤 다음 유닛으로 갑니다.','For each unit: choose target → hit → wound/saves → casualties/Panic, then move to the next unit.'],
      ['BS 1/2/3/4/5의 명중값은 각각 6+/5+/4+/3+/2+입니다.','BS 1/2/3/4/5 hits on 6+/5+/4+/3+/2+.'],
      ['명중 보정: 이동 후 사격 −1, 장거리 −1, 정지 후 사격 −1, 부분 엄폐 −1, 완전 엄폐 −2.','To Hit modifiers: move and shoot −1, long range −1, Stand & Shoot −1, partial cover −1, full cover −2.'],
      ['사격 단계 시작 모델 수의 25%를 초과해 잃었다면 패닉 판정을 합니다.','If a unit loses more than 25% of its starting models in the Shooting phase, it takes a Panic test.']
    ]},
    {id:'combat',ko:'전투 단계',en:'Combat phase',path:'/the-combat-phase/the-combat-phase-sequence',page:'p. 144',items:[
      ['전투 하나씩: 교전 및 공격 → 전투 결과 계산 → 패배 측 이탈 판정 → 추격·후속 이동.','Resolve one combat at a time: fight → combat result → Break tests → follow up/pursuit.'],
      ['높은 주도권부터 공격합니다. 돌격 이동 1″당 주도권 +1(정면 최대 +3, 측후면 최대 +4).','Fight in Initiative order. Charge bonus: +1 Initiative per full 1″ moved (front max +3; flank/rear max +4).'],
      ['전투 결과: 방어 못 한 피해 1점씩, 깃발 +1, 군기 +1, 측면 +1, 후면 +2, 고지 +1. 대열 등은 원문을 확인하세요.','Combat result: +1 per unsaved wound, standard +1, battle standard +1, flank +1, rear +2, high ground +1. Check rank and other bonuses in the source.'],
      ['패배 측은 전투 결과 차이를 음수 보정해 2D6 통솔력 판정. 원래 눈이 통솔력 초과면 패주, 보정 후만 초과면 질서 있게 후퇴, 이하면 밀려납니다. 더블 1은 밀려납니다.','Losing units test Leadership on 2D6 with the combat result difference as a penalty. Natural roll over Ld: flee; only modified result over Ld: Fall Back in Good Order; otherwise Give Ground. Double 1 gives ground.']
    ]}
  ];
  const woundRows = [
    ['4+','5+','6+','6+','6+','6+','–','–','–','–'],
    ['3+','4+','5+','6+','6+','6+','6+','–','–','–'],
    ['2+','3+','4+','5+','6+','6+','6+','6+','–','–'],
    ['2+','2+','3+','4+','5+','6+','6+','6+','6+','–'],
    ['2+','2+','2+','3+','4+','5+','6+','6+','6+','6+'],
    ['2+','2+','2+','2+','3+','4+','5+','6+','6+','6+'],
    ['2+','2+','2+','2+','2+','3+','4+','5+','6+','6+'],
    ['2+','2+','2+','2+','2+','2+','3+','4+','5+','6+'],
    ['2+','2+','2+','2+','2+','2+','2+','3+','4+','5+'],
    ['2+','2+','2+','2+','2+','2+','2+','2+','3+','4+']
  ];
  const hitRows = [
    ['4+','4+','5+','5+','5+','5+','5+','5+','5+','5+'],
    ['3+','4+','4+','4+','5+','5+','5+','5+','5+','5+'],
    ['2+','3+','4+','4+','4+','4+','5+','5+','5+','5+'],
    ['2+','3+','3+','4+','4+','4+','4+','4+','5+','5+'],
    ['2+','2+','3+','3+','4+','4+','4+','4+','4+','4+'],
    ['2+','2+','3+','3+','3+','4+','4+','4+','4+','4+'],
    ['2+','2+','2+','3+','3+','3+','4+','4+','4+','4+'],
    ['2+','2+','2+','3+','3+','3+','3+','4+','4+','4+'],
    ['2+','2+','2+','2+','3+','3+','3+','3+','4+','4+'],
    ['2+','2+','2+','2+','3+','3+','3+','3+','3+','4+']
  ];
  const $ = id => document.getElementById(id);
  const lang = () => window.TOWI18n?.language || 'ko';
  // Replace characteristic names, while retaining readable Korean rule instructions.
  const statNames={'이동력':['Movement','무브먼트'],'주도권':['Initiative','이니셔티브'],'통솔력':['Leadership','리더십']};
  const statTerms = value => String(value).replace(/이동력|주도권|통솔력/g,term=>window.TOWI18n?.phonetic(statNames[term][0])||statNames[term][1]);
  const label = (ko,en) => lang()==='both' ? `${statTerms(ko)} / ${en}` : lang()==='en' ? en : statTerms(ko);
  const esc = value => String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const table = (rows,axis) => `<div class="quickTableScroll" role="region" tabindex="0" aria-label="${esc(axis)}"><table class="quickTable"><thead><tr><th scope="col">${esc(axis)}</th>${Array.from({length:10},(_,i)=>`<th scope="col">${i+1}</th>`).join('')}</tr></thead><tbody>${rows.map((row,i)=>`<tr><th scope="row">${i+1}</th>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  let active = 'all';
  function render(){
    const l=lang();
    $('quickSheetTitle').textContent=label('올드 월드 퀵시트','The Old World quick sheet');
    $('quickSheetIntro').textContent=label('전투 중 자주 쓰는 순서와 판정을 빠르게 확인하세요. 항목의 원문 버튼으로 세부 규칙을 볼 수 있습니다.','Look up common phase sequences and rolls during play. Open each source for the full rule.');
    $('quickSearch').placeholder=label('규칙 검색','Search rules');
    document.querySelector('#sectionNav button[data-screen="quicksheet"]').textContent=label('퀵시트','Quick');
    const tabs=[['all','전체','All'],...sections.map(({id,ko,en})=>[id,ko,en]),['charts','판정표','Charts']];
    $('quickTabs').innerHTML=tabs.map(([id,ko,en])=>`<button type="button" data-quick-tab="${id}" class="${active===id?'active':''}" aria-pressed="${active===id}">${esc(label(ko,en))}</button>`).join('');
    const query=$('quickSearch').value.trim().toLocaleLowerCase();
    let cards=sections.filter(s=>{const text=[s.ko,s.en,...s.items.flat()].join(' ');return (active==='all'||active===s.id)&&(!query||(text+' '+statTerms(text)).toLocaleLowerCase().includes(query));}).map(s=>`<article class="quickCard"><div class="quickCardHead"><div><span class="quickPage">${s.page}</span><h3>${esc(label(s.ko,s.en))}</h3></div><button type="button" data-quick-source="${s.id}">${esc(label('원문 보기 ↗','Full rule ↗'))}</button></div><ol class="quickPoints">${s.items.map(([ko,en])=>`<li>${esc(label(ko,en))}</li>`).join('')}</ol></article>`).join('');
    const chartTerms=['Weapon Skill','Strength','Toughness'].map(term=>window.TOWI18n?.phonetic(term)||term).join(' ');
    const showCharts=(active==='all'||active==='charts') && (!query||('판정표 charts 명중 피해 wound hit 무기 숙련 weapon skill 힘 강인함 strength toughness ws '+chartTerms).toLowerCase().includes(query)||query.includes('표'));
    if(showCharts)cards+=`<article class="quickCard"><div class="quickCardHead"><div><span class="quickPage">${label('룰북 p. 344','Rulebook p. 344')}</span><h3>${esc(label('핵심 판정표','Core roll charts'))}</h3></div><button type="button" data-quick-source="charts">${esc(label('원문 보기 ↗','Full rule ↗'))}</button></div><h4>${esc(label('근접 명중: 공격 WS → 방어 WS','Melee hit: attacker WS → defender WS'))}</h4>${table(hitRows,'WS')}<h4>${esc(label('피해: 공격 S → 방어 T','Wound: attacking S → defending T'))}</h4>${table(woundRows,'S / T')}</article>`;
    $('quickSheetContent').innerHTML=cards||`<p class="quickEmpty">${esc(label('검색 결과가 없습니다.','No matching rules.'))}</p>`;
    $('quickSheetSource').innerHTML=`${esc(label('요약 출처: 온라인 룰 색인 Quick Reference (룰북 p. 344). 문구는 간추려 옮겼습니다. 정확한 적용 조건은 원문과 최신 정오표를 확인하세요.','Summary source: Online Rules Index Quick Reference (Rulebook p. 344). Wording is condensed; check the full rule and current errata for exact conditions.'))} <a href="https://tow.whfb.app/quick-reference" target="_blank" rel="noopener">${esc(label('원본 퀵 레퍼런스 ↗','Original quick reference ↗'))}</a> · <a href="https://tow.whfb.app/errata" target="_blank" rel="noopener">${esc(label('정오표 ↗','Errata ↗'))}</a>`;
  }
  $('quickTabs').addEventListener('click',e=>{const b=e.target.closest('[data-quick-tab]');if(!b)return;active=b.dataset.quickTab;render();});
  $('quickSearch').addEventListener('input',render);
  $('quickSheetContent').addEventListener('click',e=>{const b=e.target.closest('[data-quick-source]');if(!b)return;const s=sections.find(item=>item.id===b.dataset.quickSource);if(s)window.openRule?.(s.en,s.path);else window.openRule?.('Quick Reference','/quick-reference');});
  document.addEventListener('tow-language-change',render);
  render();
})();
