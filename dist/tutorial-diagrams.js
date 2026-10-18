(()=>{
  'use strict';
  const statNames={'이동력':['Movement','무브먼트'],'지도력':['Leadership','리더십']};
  const statTerms=value=>String(value).replace(/이동력|지도력/g,term=>window.TOWI18n?.phonetic(statNames[term][0])||statNames[term][1]);
  const t=(mode,ko,en)=>mode==='en'?en:mode==='both'?statTerms(ko)+' / '+en:statTerms(ko);
  const figure=(mode,title,visual,note)=>'<figure class="tutorialDiagram"><figcaption><span class="tutorialDiagramIcon" aria-hidden="true">✦</span>'+t(mode,title[0],title[1])+'</figcaption>'+visual+'<p class="tutorialDiagramNote">'+t(mode,note[0],note[1])+'</p></figure>';
  const block=(mode,ko,en,kind='')=>'<div class="diagramBlock '+kind+'">'+t(mode,ko,en)+'</div>';
  const arrow='<span class="diagramArrow" aria-hidden="true">→</span>';
  const svgStart=(mode,ko,en)=>'<svg class="tutorialBattlefield" viewBox="0 0 420 210" role="img" aria-label="'+t(mode,ko,en)+'" xmlns="http://www.w3.org/2000/svg">';
  function render(index,mode){
    if(index===0){
      const visual=svgStart(mode,'양쪽 군대와 중앙의 시나리오 목표 위치를 위에서 본 개념도','Top down diagram of two armies and a central scenario objective')+
        '<rect width="420" height="210" rx="14" fill="#D4CEB9"/><path d="M20 105H400" stroke="#9D917D" stroke-dasharray="6 6"/>'+
        '<rect x="48" y="30" width="68" height="30" rx="5" fill="#9C5B56"/><rect x="150" y="30" width="68" height="30" rx="5" fill="#9C5B56"/><rect x="252" y="30" width="68" height="30" rx="5" fill="#9C5B56"/>'+
        '<circle cx="210" cy="106" r="20" fill="#CB9478" stroke="#866047" stroke-width="3"/><path d="M203 106l5 5 9-11" fill="none" stroke="#2A201B" stroke-width="3"/>'+
        '<rect x="48" y="150" width="68" height="30" rx="5" fill="#705648"/><rect x="150" y="150" width="68" height="30" rx="5" fill="#705648"/><rect x="252" y="150" width="68" height="30" rx="5" fill="#705648"/>'+
        '</svg><div class="diagramLegend"><span><i class="enemy"></i>'+t(mode,'상대 군세','Opposing army')+'</span><span><i class="objective"></i>'+t(mode,'시나리오 목표','Scenario objective')+'</span><span><i class="own"></i>'+t(mode,'내 군세','Your army')+'</span></div>';
      return figure(mode,['먼저 목표를 보세요','Start with the objective'],visual,['배치와 목표 위치는 설명용 예시입니다. 실제 목표는 선택한 시나리오가 정합니다.','The positions are illustrative. Your chosen scenario defines the actual objectives.']);
    }
    if(index===1){
      const stats=[['M','4'],['WS','4'],['BS','3'],['S','4'],['T','4'],['W','1'],['I','3'],['A','1'],['Ld','8']].map(x=>'<div><b>'+x[0]+'</b><strong>'+x[1]+'</strong></div>').join('');
      return figure(mode,['능력치에서 판정까지','From profile to test'],'<div class="diagramProfile"><div class="diagramProfileTitle">'+t(mode,'예시 모델 프로필','Example model profile')+'</div><div class="diagramStats">'+stats+'</div></div><div class="diagramEquation">'+block(mode,'Ld 8','Ld 8')+arrow+block(mode,'주사위 3 + 4 = 7','Dice 3 + 4 = 7')+arrow+block(mode,'7 ≤ 8 · 성공','7 ≤ 8 · Pass','success')+'</div>',['숫자는 설명을 위한 가상 프로필입니다. 실제 유닛은 해당 카드의 수치를 사용하세요.','These numbers illustrate the method. Use the actual unit profile when playing.']);
    }
    if(index===2){
      const visual=svgStart(mode,'아래쪽 내 유닛의 전방 시야에 적 유닛과 가림 유닛이 있는 개념도','Your unit facing forward with a visible target and a target obscured by another unit')+
        '<rect width="420" height="210" rx="14" fill="#D4CEB9"/><path d="M210 167L55 18H365Z" fill="#CB9478" opacity=".65" stroke="#866047" stroke-dasharray="5 4"/>'+
        '<rect x="74" y="40" width="65" height="28" rx="5" fill="#9C5B56"/><rect x="277" y="40" width="65" height="28" rx="5" fill="#9C5B56"/>'+
        '<rect x="275" y="102" width="65" height="30" rx="5" fill="#8C806B"/><rect x="174" y="163" width="72" height="30" rx="5" fill="#705648"/>'+
        '<path d="M210 163L106 68" stroke="#705648" stroke-width="3"/><path d="M210 163L294 132" stroke="#9C5B56" stroke-width="3" stroke-dasharray="6 5"/>'+
        '<text x="105" y="60" text-anchor="middle" fill="#fff" font-size="19" font-weight="800">A</text><text x="309" y="60" text-anchor="middle" fill="#fff" font-size="19" font-weight="800">B</text>'+
        '<text x="309" y="124" text-anchor="middle" fill="#fff" font-size="19" font-weight="800">C</text><text x="210" y="185" text-anchor="middle" fill="#fff" font-size="19" font-weight="800">D</text></svg>'+
        '<div class="diagramLegend"><span><i class="enemy"></i>A · '+t(mode,'보이는 적','Visible target')+'</span><span><i class="enemy"></i>B · '+t(mode,'가려진 적','Obscured target')+'</span><span><i class="blocker"></i>C · '+t(mode,'가림 유닛','Blocking unit')+'</span><span><i class="own"></i>D · '+t(mode,'시야를 확인하는 유닛','Unit checking sight')+'</span></div>';
      return figure(mode,['방향과 가림을 함께 확인','Check facing and obstruction'],visual,['음영 영역은 시야 방향을 설명하는 개념도입니다. 실제 시야각과 보이는 범위는 원문 규칙대로 확인하세요.','The shaded area only illustrates facing. Use the source rules for the actual vision arc and visibility.']);
    }
    if(index===3){
      const visual='<div class="diagramFlow">'+block(mode,'1 · 전략','1 · Strategy')+arrow+block(mode,'2 · 이동','2 · Movement')+arrow+block(mode,'3 · 사격','3 · Shooting')+arrow+block(mode,'4 · 근접전','4 · Combat')+'</div>';
      return figure(mode,['턴은 왼쪽부터 순서대로','A turn runs left to right'],visual,['단계마다 하위 순서가 있습니다. 자세한 순서는 관련 룰북 항목을 확인하세요.','Each phase has sub-steps. Use the linked rules for their exact sequence.']);
    }
    if(index===4){
      const items=[
        ['전략','Strategy','강화 · 저주','Enchantment · Hex'],
        ['이동','Movement','이동 주문','Conveyance'],
        ['사격','Shooting','마법 투사체 · 소용돌이','Magic Missile · Vortex'],
        ['근접전','Combat','근접 주문','Assailment']
      ];
      const visual='<div class="diagramTiming">'+items.map((x,i)=>'<div class="diagramTimingRow"><span class="diagramTimingNo">'+(i+1)+'</span><b>'+t(mode,x[0],x[1])+'</b><span>'+t(mode,x[2],x[3])+'</span></div>').join('')+'</div>';
      return figure(mode,['주문 종류에 따라 시점이 다릅니다','Spell type determines timing'],visual,['이 표는 종류별 시점을 요약합니다. 주문의 대상·범위·제한은 개별 규칙을 확인하세요.','This summarizes timing by type. Check each spell for target, range and restrictions.']);
    }
    if(index===5){
      const visual='<div class="diagramDice"><div class="diagramDiceTop">'+block(mode,'이동력 M 4','Movement M 4')+'<span>+</span><div class="diagramTwoDice"><span class="diagramDie">2</span><span class="diagramDie chosen">5</span><small>'+t(mode,'높은 눈','Higher die')+'</small></div></div><div class="diagramDiceResult"><span>=</span>'+block(mode,'돌격 거리 9″','Charge range 9″','success')+'</div><div class="diagramRange"><div class="diagramUnit own">'+t(mode,'돌격 유닛','Charging unit')+'</div><div class="diagramRangeLine"><span>9″</span></div><div class="diagramUnit enemy">'+t(mode,'목표 유닛','Target unit')+'</div></div></div>';
      return figure(mode,['두 주사위 중 높은 눈 하나','Use the higher die'],visual,['9″는 이 예시의 돌격 거리입니다. 실제 성공 여부와 모델 이동은 돌격 규칙에 따라 해결하세요.','9″ is the charge range in this example. Resolve success and model movement using the charge rules.']);
    }
    if(index===6){
      const visual='<div class="diagramFlow">'+block(mode,'1 · 목표·시야','1 · Target · sight')+arrow+block(mode,'2 · 명중','2 · Hit')+arrow+block(mode,'3 · 상처','3 · Wound')+arrow+block(mode,'4 · 방호','4 · Save')+arrow+block(mode,'5 · 피해','5 · Damage')+'</div><div class="diagramEquation">'+block(mode,'BS 3 → 4+ 명중','BS 3 → 4+ to hit')+arrow+block(mode,'S 4 대 T 4 → 4+ 상처','S 4 vs T 4 → 4+ to wound')+'</div>';
      return figure(mode,['명중한 주사위만 다음으로','Only hits move to the next step'],visual,['목표값은 수정치가 없는 예시입니다. 실제 무장, 상황 수정치와 방호값을 적용하세요.','The target numbers assume no modifiers. Apply the actual weapon, modifiers and saves.']);
    }
    if(index===7){
      const visual=svgStart(mode,'서로 전열이 맞닿은 두 유닛과 근접 명중 판정 개념도','Two units touching front to front with an example melee hit roll')+
        '<rect width="420" height="210" rx="14" fill="#D4CEB9"/><rect x="112" y="42" width="196" height="52" rx="7" fill="#9C5B56"/><rect x="112" y="95" width="196" height="52" rx="7" fill="#705648"/>'+
        '<path d="M112 95H308" stroke="#fff" stroke-width="4" stroke-dasharray="7 5"/>'+
        '<text x="210" y="73" text-anchor="middle" fill="white" font-size="17" font-weight="700">WS 3</text><text x="210" y="127" text-anchor="middle" fill="white" font-size="17" font-weight="700">WS 4</text>'+
        '<rect x="113" y="163" width="194" height="31" rx="15" fill="#fff" stroke="#9D917D"/><text x="210" y="184" text-anchor="middle" fill="#29201B" font-size="14" font-weight="700">WS 4 → WS 3 = 3+</text></svg>';
      return figure(mode,['서로의 WS를 교차해 명중값 찾기','Cross-reference both WS values'],visual,['전열이 맞닿은 배치는 개념도입니다. 누가 싸울 수 있는지는 실제 접촉·진형 규칙을 확인하세요.','The contact is illustrative. Check actual contact and formation rules to determine who can fight.']);
    }
    if(index===8){
      const visual='<div class="diagramBreakHeader">'+block(mode,'지도력 8','Leadership 8')+block(mode,'2점 차 패배','Lost by 2')+'</div><div class="diagramBreakGrid">'+
        '<div><span class="diagramBreakRoll">5 + 2 = 7</span><strong>'+t(mode,'자리를 내줌','Give Ground')+'</strong><small>'+t(mode,'수정 합 ≤ 8','Modified total ≤ 8')+'</small></div>'+
        '<div><span class="diagramBreakRoll">7 + 2 = 9</span><strong>'+t(mode,'질서 있게 후퇴','Fall Back in Good Order')+'</strong><small>'+t(mode,'자연 합 ≤ 8, 수정 합 > 8','Natural ≤ 8, modified > 8')+'</small></div>'+
        '<div><span class="diagramBreakRoll">9 + 2 = 11</span><strong>'+t(mode,'패주·도주','Break and Flee')+'</strong><small>'+t(mode,'자연 합 > 8','Natural total > 8')+'</small></div></div>';
      return figure(mode,['같은 패배라도 주사위에 따라 세 갈래','Three outcomes from the same loss'],visual,['5·7·9는 각각 다른 2D6 자연 합의 예시입니다. 자연 1·1의 예외는 원문을 확인하세요.','5, 7 and 9 are separate natural 2D6 totals. Check the source for the natural double 1 exception.']);
    }
    const visual='<div class="diagramChecklist">'+[
      ['목표 확인','Check objective'],['전략','Strategy'],['이동','Movement'],['사격','Shooting'],['근접전','Combat'],['결과 기록','Record result']
    ].map((x,i)=>'<div><span>'+(i+1)+'</span><strong>'+t(mode,x[0],x[1])+'</strong></div>').join('')+'</div>';
    return figure(mode,['한 턴을 따라가며 체크','Track one turn at a time'],visual,['시나리오 목표는 게임 중 계속 확인하고 종료 때 승리 조건을 판정하세요.','Keep the scenario objective in view and resolve its victory conditions at game end.']);
  }
  window.TOWTutorialDiagrams={render};
})();
