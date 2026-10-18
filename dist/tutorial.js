(()=>{
  'use strict';
  const lessons=[
    {title:['게임의 목표와 준비','Goal and setup'],intro:['두 군대가 시나리오의 목표를 놓고 겨룹니다. 승리 조건부터 읽고 시작하세요.','Two armies compete over a scenario objective. Read its victory conditions first.'],steps:[
      ['시나리오를 고르고 전장을 준비한 뒤 합의한 포인트 한도에 맞춰 군세를 만듭니다.','Choose a scenario, set up the battlefield and build to an agreed points limit.'],
      ['유닛을 배치하며 전열, 측면, 후방을 확인합니다. 이 방향은 이동과 전투에 영향을 줍니다.','Deploy units and identify front, flanks and rear. Facing affects movement and combat.'],
      ['게임의 종료·승리 조건은 시나리오에 따릅니다. 게임 중에도 목표를 확인하세요.','The scenario determines the end and victory conditions. Recheck your objective during play.']
    ],example:['처음에는 유닛을 적게 쓰고 각 턴의 목표를 소리 내어 말해 보세요.','Use fewer units in your first game and state your objective each turn.'],quiz:['시작 전에 확인할 승리 관련 정보는?','What victory information must you check before play?','선택한 시나리오의 승리 조건과 종료 조건입니다.','The chosen scenario’s victory and end conditions.'],refs:[['Victory Points','/warhammer-battles/victory-points-warhammer-battles'],['Set up the Battlefield','/overview-of-the-game/set-up-the-battlefield']]},
    {title:['모델의 능력치','Read a model profile'],intro:['유닛 카드의 숫자가 이동·공격·방어·사기 판정의 출발점입니다.','A unit profile provides the starting numbers for movement, attacks, defence and morale.'],steps:[
      ['M은 이동력, WS는 웨폰 스킬, BS는 발리스틱 스킬, S는 스트렝스, T는 터프니스입니다.','M is Movement, WS Weapon Skill, BS Ballistic Skill, S Strength and T Toughness.'],
      ['W는 운즈, I는 주도권, A는 어택스, Ld는 지도력입니다. 장비와 특수 규칙이 결과를 바꿀 수 있습니다.','W is Wounds, I Initiative, A Attacks and Ld Leadership. Equipment and special rules can modify results.'],
      ['능력치 판정은 보통 1D6을 능력치 이하로, 지도력 판정은 2D6 합을 Ld 이하로 굴립니다. 자연 눈 예외도 확인하세요.','A characteristic test generally needs 1D6 at or below the characteristic; a Leadership test needs 2D6 at or below Ld. Check natural roll exceptions.']
    ],example:['T4 판정에서 3은 성공, 5는 실패입니다. Ld8 판정에서 3+4=7은 성공입니다.','For T4, 3 succeeds and 5 fails. For Ld8, 3+4=7 succeeds.'],quiz:['Ld8 판정에서 4와 5가 나왔다면?','What if a Ld8 test rolls 4 and 5?','합계 9이므로 실패합니다.','The total is 9, so it fails.'],refs:[['Model Profiles','/model-profiles'],['Characteristic Tests','/model-profiles/characteristic-tests'],['Leadership Tests','/model-profiles/leadership-tests']]},
    {title:['방향과 시야','Facing and line of sight'],intro:['어디에 놓고 어느 쪽을 보게 하는지가 실제 규칙입니다.','Position and facing have rules consequences.'],steps:[
      ['유닛은 전방·측면·후방을 가집니다. 목표가 어느 방향에 있는지 행동 전에 확인하세요.','A unit has a front, flanks and rear. Check the target’s position before acting.'],
      ['시야는 시야각 안에서 목표의 일부까지 가로막히지 않는 선이 있는지 확인합니다. 다른 모델·유닛도 시야를 막습니다.','Line of sight needs an unobstructed line within the vision arc to part of the target. Other models and units can block it.'],
      ['애매한 위치는 움직이기 전에 상대와 확인하고 원문 그림과 예외 규칙을 참고하세요.','Agree on ambiguous positions before moving; consult the source diagrams and exceptions.']
    ],example:['앞 유닛 뒤에 있는 적을 쏘려면 시야가 실제로 열려 있는지 먼저 확인합니다.','Before shooting an enemy behind another unit, verify that line of sight is clear.'],quiz:['사격 대상 선정 전에 확인할 두 가지는?','What two things should you check before shooting?','목표가 시야각 안에 있고 시야가 가로막히지 않았는지입니다.','The target is in the vision arc and the line is unobstructed.'],refs:[['Line of Sight','/model-and-unit-facing/line-of-sight'],['Check Line of Sight','/the-shooting-phase/check-line-of-sight']]},
    {title:['한 턴의 흐름','The turn sequence'],intro:['차례는 전략 → 이동 → 사격 → 근접전 순서로 진행합니다.','A turn follows Strategy → Movement → Shooting → Combat.'],steps:[
      ['전략 단계에서 시작 단계 행동, 명령, 해당 주문, 재집결을 해결합니다.','Resolve start of turn actions, command, eligible spells and rallying in Strategy.'],
      ['이동 단계에서 돌격을 선언·해결하고 강제 이동과 나머지 이동을 합니다.','Declare and resolve charges, then compulsory and remaining moves in Movement.'],
      ['사격 단계에서 사격과 해당 주문을 처리합니다. 근접전 단계에서는 교전과 전투 결과를 해결합니다.','Resolve shooting and eligible spells in Shooting, then fights and combat results in Combat.']
    ],example:['모든 주문을 전략 단계에 쓰는 것은 아닙니다. 주문 종류에 따라 시점이 다릅니다.','Not every spell belongs to Strategy. Its type determines when it is cast.'],quiz:['돌격 선언은 어느 단계인가요?','In which phase do you declare charges?','이동 단계입니다.','Movement.'],refs:[['The Turn Sequence','/the-turn-sequence/the-turn-sequence'],['The Movement Phase Sequence','/the-movement-phase/the-movement-phase-sequence']]},
    {title:['전략과 마법','Strategy and magic'],intro:['마법사가 있다면 주문의 종류와 시전 시점을 먼저 읽습니다.','If you have a Wizard, read each spell’s type and timing first.'],steps:[
      ['강화(Enchantment)와 저주(Hex)는 전략 단계의 주문 시전 하위 단계에 사용합니다.','Cast Enchantment and Hex spells in the Conjuration sub-phase of Strategy.'],
      ['이동 주문(Conveyance)은 나머지 이동, 마법 투사체·소용돌이는 사격, 근접 주문(Assailment)은 마법사가 싸울 때 사용합니다.','Cast Conveyance during Remaining Moves, Magic Missiles and Vortex spells during Shooting, and Assailment when the Wizard fights.'],
      ['주문별 목표·범위·시전값을 확인하고 시전과 해제를 순서대로 판정합니다.','Check the spell’s target, range and casting value, then resolve casting and dispelling in order.']
    ],example:['Hex를 이동 단계까지 미루지 말고 전략 단계에 선언합니다.','Declare a Hex in Strategy rather than waiting for Movement.'],quiz:['마법 투사체는 보통 어느 단계에 시전하나요?','When are Magic Missiles normally cast?','사격 단계에서 마법사를 선택할 때입니다.','During Shooting when the Wizard is chosen.'],refs:[['Casting Spells','/magic/casting-spells'],['The Strategy Phase Sequence','/the-strategy-phase/the-strategy-phase-sequence']]},
    {title:['이동과 돌격','Movement and charges'],intro:['돌격에는 선언, 상대 반응, 거리 판정, 실제 이동의 순서가 있습니다.','A charge involves declaration, enemy reaction, range determination and movement.'],steps:[
      ['돌격을 선언하면 상대가 가능한 반응을 고릅니다. 버티기, 서서 쏘기, 도주의 적용 조건을 확인합니다.','After declaring, the enemy chooses an eligible reaction. Check the conditions for Hold, Stand & Shoot and Flee.'],
      ['돌격 거리는 M에 2D6 중 높은 눈 하나를 더합니다. 두 눈을 합산하지 않습니다.','Charge range is M plus the higher of two D6 rolls. Do not add the two dice.'],
      ['성공 여부를 판단한 뒤 모델을 움직입니다. 회전·지형·실패한 돌격은 해당 원문 규칙을 따릅니다.','Determine success before moving models. Follow the source rules for wheeling, terrain and failed charges.']
    ],example:['M4 유닛이 2와 5를 굴리면 돌격 거리는 4+5=9인치입니다.','An M4 unit rolling 2 and 5 has a charge range of 4+5=9 inches.'],quiz:['M4, 2와 5를 굴린 돌격 거리는?','Charge range for M4 with rolls of 2 and 5?','9인치입니다.','9 inches.'],refs:[['Charge Reactions','/the-movement-phase/charge-reactions'],['Determine Charge Range','/the-movement-phase/determine-charge-range']]},
    {title:['사격 해결하기','Resolve a shot'],intro:['목표 → 명중 → 상처 → 방호 → 피해 순서로 생각합니다.','Think target → hit → wound → save → damage.'],steps:[
      ['사거리와 시야를 확인한 뒤 무장 프로필과 사격자의 BS를 봅니다.','Check range and line of sight, then the weapon profile and the shooter’s BS.'],
      ['수정치를 적용해 명중을 굴립니다. 명중한 주사위만 무기의 S와 목표의 T를 비교해 상처를 굴립니다.','Apply modifiers to hit. Only hits roll to wound using weapon S against target T.'],
      ['상처에 대해 해당 방호를 해결합니다. 관통·엄폐·특수 규칙은 해당 상황의 원문을 확인합니다.','Resolve applicable saves against wounds. Check the source for armour piercing, cover and special rules.']
    ],example:['수정치가 없다면 BS3은 4+로 명중하고 S4 대 T4는 4+로 상처를 냅니다. 방호 판정은 그 다음입니다.','Without modifiers, BS3 hits on 4+ and S4 wounds T4 on 4+. Resolve the save afterward.'],quiz:['명중에 실패한 공격도 상처 주사위를 굴리나요?','Does a failed hit roll proceed to wound?','아니요. 명중한 공격만 상처를 판정합니다.','No. Only hits roll to wound.'],refs:[['Roll to Hit (Shooting)','/the-shooting-phase/roll-to-hit-shooting'],['Roll to Wound (Shooting)','/the-shooting-phase/roll-to-wound-shooting'],['Make Armour Saves (Shooting)','/the-shooting-phase/make-armour-saves-shooting']]},
    {title:['근접전 해결하기','Resolve a combat'],intro:['싸울 순서와 공격 횟수를 확인하고 명중·상처·방호를 해결합니다.','Check fighting order and attack count, then resolve hits, wounds and saves.'],steps:[
      ['누가 싸우는지와 주도권 순서를 확인합니다. 돌격·무장·특수 규칙이 순서를 바꿀 수 있습니다.','Check who fights and in what Initiative order. Charges, weapons and special rules may affect it.'],
      ['각 모델의 A만큼 명중 주사위를 굴립니다. 공격자와 방어자의 WS를 명중표에서 교차해 찾습니다.','Roll as many To Hit dice as the model’s A. Cross-reference attacker and defender WS on the chart.'],
      ['명중한 공격만 S와 T로 상처를 판정하고 방호를 적용한 뒤 양쪽 전투 결과를 계산합니다.','Roll wounds for hits using S and T, apply saves and calculate combat results.']
    ],example:['수정치가 없다면 WS4 공격자는 WS3 방어자를 3+로 명중합니다.','With no modifiers, WS4 hits WS3 on 3+.'],quiz:['근접 명중표에서 비교하는 두 능력치는?','Which two values determine melee To Hit?','공격자와 방어자의 WS입니다.','Attacker and defender WS.'],refs:[['Roll to Hit (Combat)','/the-combat-phase/roll-to-hit-combat'],['Roll to Wound (Combat)','/the-combat-phase/roll-to-wound-combat'],['Calculate Combat Result','/the-combat-phase/calculate-combat-result']]},
    {title:['전투 결과와 패주','Combat result and Break tests'],intro:['전투에서 져도 항상 즉시 도망치지는 않습니다. 패주 판정에는 세 결과가 있습니다.','Losing a combat does not always mean fleeing. A Break test has three outcomes.'],steps:[
      ['양쪽의 피해와 해당 보너스로 전투 결과 점수를 계산합니다. 패배한 쪽은 대개 패주 판정을 합니다.','Calculate both combat result scores from wounds and applicable bonuses. The losing side generally takes Break tests.'],
      ['2D6에 패배 점수 차이를 더해 Ld와 비교합니다. 자연 주사위 합이 Ld보다 크면 패주해 도주합니다.','Add the losing margin to 2D6 and compare with Ld. If the natural dice total exceeds Ld, the unit breaks and flees.'],
      ['자연 합은 Ld 이하이나 수정 합이 넘으면 질서 있게 후퇴합니다. 수정 합도 Ld 이하이거나 자연 눈이 1·1이면 자리를 내줍니다.','If the natural total is within Ld but the modified total exceeds it, Fall Back in Good Order. If the modified total is within Ld, or the roll is natural double 1, Give Ground.']
    ],example:['Ld8, 2점 차 패배에 2D6 합 7이면 수정 합 9이므로 질서 있게 후퇴합니다. 자연 합 9라면 패주합니다.','Ld8 losing by 2 with natural 7 becomes 9: Fall Back in Good Order. A natural 9 breaks and flees.'],quiz:['Ld8, 2점 차 패배, 자연 합 7의 결과는?','Ld8 loses by 2 and rolls a natural 7. What happens?','수정 합이 9이므로 질서 있게 후퇴합니다.','The modified total is 9: Fall Back in Good Order.'],refs:[['Combat Result Score','/the-combat-phase/combat-result-score'],['Break Test','/the-combat-phase/break-test']]},
    {title:['첫 게임 완주하기','Finish your first battle'],intro:['네 단계를 따라가며 첫 전투를 끝까지 진행해 보세요.','Follow the four phases and complete a first battle.'],steps:[
      ['매 턴 목표를 확인하고 전략 → 이동 → 사격 → 근접전을 차례대로 진행합니다. 행동을 선언한 뒤 주사위를 굴립니다.','Check the objective each turn and follow Strategy → Movement → Shooting → Combat. Declare before rolling.'],
      ['모르는 무장과 특수 규칙은 눌러서 프로필·원문을 확인합니다. 구체적인 예외가 기본 절차를 바꾸면 적용합니다.','Tap an unfamiliar weapon or special rule to read its profile and source. Apply a specific exception when it changes the basic procedure.'],
      ['종료 시 시나리오의 목표와 승리 점수를 해결합니다. 헷갈린 규칙은 룰북·퀵시트에서 다시 찾으세요.','At game end, resolve scenario objectives and Victory Points. Revisit uncertain rules in the Rules Library and Quick Sheet.']
    ],example:['“행동 선언 → 거리·시야 확인 → 주사위 → 결과 적용”을 말하며 따라가면 순서를 놓치기 어렵습니다.','Say “declare → check range and sight → roll → apply result” aloud to keep the order clear.'],quiz:['특수 규칙이 기본 절차를 바꿀 때 무엇을 확인하나요?','What should you check when a special rule changes a basic procedure?','특수 규칙의 정확한 문구와 적용 조건입니다.','Its exact wording and conditions.'],refs:[['The Turn Sequence','/the-turn-sequence/the-turn-sequence'],['What are Special Rules?','/special-rules/what-are-special-rules'],['Victory Points','/warhammer-battles/victory-points-warhammer-battles']]}
  ];
  const $=id=>document.getElementById(id);
  let done=[];try{done=JSON.parse(localStorage.getItem('bth-tow-tutorial-done')||'[]').filter(Number.isInteger);}catch{}
  let current=0,answerOpen=false;
  const mode=()=>window.TOWI18n?.language||'ko';
  const statNames={'이동력':['Movement','무브먼트'],'웨폰 스킬':['Weapon Skill','웨폰 스킬'],'발리스틱 스킬':['Ballistic Skill','발리스틱 스킬'],'스트렝스':['Strength','스트렝스'],'터프니스':['Toughness','터프니스'],'운즈':['Wounds','운즈'],'주도권':['Initiative','이니셔티브'],'어택스':['Attacks','어택스'],'지도력':['Leadership','리더십']};
  const statTerms=value=>String(value).replace(/이동력|웨폰 스킬|발리스틱 스킬|스트렝스|터프니스|운즈|주도권|어택스|지도력/g,term=>window.TOWI18n?.phonetic(statNames[term][0])||statNames[term][1]);
  const label=pair=>mode()==='en'?pair[1]:mode()==='both'?statTerms(pair[0])+' / '+pair[1]:statTerms(pair[0]);
  const line=(pair,cls='')=>mode()==='both'?'<p class="'+cls+'">'+statTerms(pair[0])+'</p><p class="tutorialEnglish '+cls+'" lang="en">'+pair[1]+'</p>':'<p class="'+cls+'">'+label(pair)+'</p>';
  function render(){
    const en=mode()==='en',l=lessons[current];
    $('tutorialTitle').textContent=label(['처음 배우는 올드 월드','Learn The Old World']);
    $('tutorialIntro').textContent=label(['한 턴을 직접 따라가며 익히는 10장 입문서','A ten chapter guide to learning by playing through a turn']);
    $('tutorialProgress').textContent=label([done.length+' / '+lessons.length+'장 읽음',done.length+' / '+lessons.length+' chapters read']);
    $('tutorialProgressBar').style.width=(done.length/lessons.length*100)+'%';
    $('tutorialChapters').innerHTML=lessons.map((x,i)=>'<button type="button" data-lesson="'+i+'" class="tutorialChapter '+(i===current?'active':'')+'" aria-current="'+(i===current?'step':'false')+'"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+label(x.title)+'</strong><em>'+(done.includes(i)?'✓':'')+'</em></button>').join('');
    $('tutorialContent').innerHTML='<div class="tutorialLessonHead"><span class="eyebrow">'+(en?'Chapter':'제')+' '+(current+1)+' / '+lessons.length+'</span><h3>'+label(l.title)+'</h3>'+line(l.intro,'tutorialLead')+'</div><div class="tutorialLessonBody"><h4>'+label(['차근차근 따라가기','Follow the steps'])+'</h4><ol>'+l.steps.slice(0,1).map(s=>'<li>'+line(s)+'</li>').join('')+'</ol>'+window.TOWTutorialDiagrams.render(current,mode())+'<ol start="2" class="tutorialStepsContinue">'+l.steps.slice(1).map(s=>'<li>'+line(s)+'</li>').join('')+'</ol><div class="tutorialExample"><span>'+label(['주사위·상황 예시','Worked example'])+'</span>'+line(l.example)+'</div><div class="tutorialQuiz"><span>'+label(['스스로 확인하기','Check yourself'])+'</span>'+line(l.quiz.slice(0,2))+'<button type="button" id="tutorialAnswerToggle" class="secondary" aria-expanded="'+answerOpen+'">'+(answerOpen?label(['정답 숨기기','Hide answer']):label(['정답 보기','Show answer']))+'</button>'+(answerOpen?'<div class="tutorialAnswer">'+line(l.quiz.slice(2))+'</div>':'')+'</div><div class="tutorialSources"><span>'+label(['관련 룰북 항목','Related rules'])+'</span><div>'+l.refs.map(r=>'<button type="button" class="tutorialRuleLink" data-tutorial-rule="'+r[1]+'" data-rule-name="'+r[0]+'">'+r[0]+' ↗</button>').join('')+'</div></div></div><div class="tutorialLessonFoot"><button type="button" class="secondary" data-tutorial-nav="prev" '+(current===0?'disabled':'')+'>← '+label(['이전 장','Previous'])+'</button><button type="button" class="secondary" id="tutorialMark" aria-pressed="'+done.includes(current)+'">'+(done.includes(current)?label(['✓ 읽음','✓ Read']):label(['읽음 표시','Mark read']))+'</button><button type="button" class="primary" data-tutorial-nav="next" '+(current===lessons.length-1?'disabled':'')+'>'+label(['다음 장','Next'])+' →</button></div>';
  }
  function select(i){if(i<0||i>=lessons.length)return;current=i;answerOpen=false;render();$('tutorialPanel').scrollIntoView({block:'start'});}
  document.querySelectorAll('[data-rules-view]').forEach(b=>b.addEventListener('click',()=>{
    const tutorial=b.dataset.rulesView==='tutorial';
    $('rulesLibraryPanel').classList.toggle('hidden',tutorial);
    $('tutorialPanel').classList.toggle('hidden',!tutorial);
    document.querySelectorAll('[data-rules-view]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
  }));
  $('tutorialChapters').addEventListener('click',e=>{const b=e.target.closest('[data-lesson]');if(b)select(Number(b.dataset.lesson));});
  $('tutorialContent').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.id==='tutorialAnswerToggle'){answerOpen=!answerOpen;render();}
    if(b.id==='tutorialMark'){done=done.includes(current)?done.filter(i=>i!==current):[...done,current];localStorage.setItem('bth-tow-tutorial-done',JSON.stringify(done));render();}
    if(b.dataset.tutorialNav)select(current+(b.dataset.tutorialNav==='next'?1:-1));
    if(b.dataset.tutorialRule)window.openRule?.(b.dataset.ruleName,b.dataset.tutorialRule);
  });
  document.addEventListener('tow-language-change',render);
  render();
  if(new URLSearchParams(location.search).get('tutorial')==='1' && new URLSearchParams(location.search).get('screen')==='rules'){
    document.querySelector('#tabTutorial')?.click();
  }
})();
