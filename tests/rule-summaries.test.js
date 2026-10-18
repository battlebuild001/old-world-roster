const test=require('node:test');
const assert=require('node:assert/strict');

global.window={};
require('../dist/rule-summaries.js');
const SUMMARY=window.TOWRuleSummaries;
const text=value=>({nodeType:'text',value,marks:[]});
const rich=(nodeType,...content)=>({nodeType,content:content.map(value=>typeof value==='string'?text(value):value)});
const paragraph=(...parts)=>rich('paragraph',...parts);
const body=(...parts)=>rich('document',...parts);
const fieldsDocument=fields=>({querySelector(selector){return selector==='#__NEXT_DATA__'?{textContent:JSON.stringify({props:{pageProps:{entry:{fields}}}})}:null;},querySelectorAll(){return [];}});
const build=(fields,extra={})=>SUMMARY.build({name:'Fixture',path:'special-rules/fixture',document:fieldsDocument(fields),...extra});
const table=rows=>rich('table',...rows.map(row=>rich('table-row',...row.map(value=>rich('table-cell',paragraph(value))))));
const weapon=fields=>({nodeType:'embedded-entry-block',data:{target:{sys:{contentType:{sys:{id:'weaponProfile'}}},fields}}});

test('Armour Bane parameter comes only from the requested variant, never an assumed default',()=>{
  const overrides={'special-rules/armour-bane':{ko:['자연 6으로 운드 시 AP {x} 개선.'],en:['On a natural 6 To Wound, improve AP by {x}.']}};
  const one=SUMMARY.build({name:'Armour Bane (1)',path:'/special-rules/armour-bane?minimal=true',overrides});
  assert.equal(one.kind,'curated');assert.deepEqual(one.en,['On a natural 6 To Wound, improve AP by 1.']);
  for(const name of ['Armour Bane','Armour Bane (X)']) {
    const result=SUMMARY.build({name,path:'special-rules/armour-bane',overrides});
    assert.match(result.en[0],/by X\./);assert.doesNotMatch(result.en[0],/by 1/);
  }
  assert.deepEqual(overrides['special-rules/armour-bane'].en,['On a natural 6 To Wound, improve AP by {x}.']);
});

test('signed, dice and save parameters retain their printed values and variant path stays exact',()=>{
  assert.equal(SUMMARY.parameterOf('Magic Resistance (-2)'),'-2');
  assert.equal(SUMMARY.parameterOf('Multiple Wounds (D3)'),'D3');
  assert.equal(SUMMARY.parameterOf('Chaos Armour (Warriors of Chaos) (5+)'),'5+');
  assert.equal(SUMMARY.parameterOf('Chaos Armour {warriors of chaos}'),'X');
  assert.equal(SUMMARY.parameterOf('Extra Attacks (+1)'),'+1');
  const result=SUMMARY.build({name:'Fly (8)',path:'special-rules/fly-renegade',overrides:{'special-rules/fly':{ko:['{x} 비행.'],en:['Fly {x}.']}}});
  assert.equal(result.available,false,'a similarly named variant must not inherit another rule summary');
});

test('structured body omits plain-text description flavor and never follows linked rules',()=>{
  const linked={nodeType:'entry-hyperlink',content:[text('Armour Piercing')],data:{target:{fields:{body:body(paragraph('Other rule: automatically inflict 99 wounds.'))}}}};
  const mechanics=paragraph('If a model rolls a natural 6 To Wound, improve its ',linked,' by X.');
  const result=build({description:body(paragraph('A glorious weapon shatters the armour of all foes.')),body:body(mechanics)});
  assert.equal(result.kind,'extracted');assert.deepEqual(result.ko,[]);
  assert.deepEqual(result.en,['If a model rolls a natural 6 To Wound, improve its Armour Piercing by X.']);
  assert.doesNotMatch(result.en.join(' '),/glorious|99|automatically/);
});

test('mechanic notes keep only, nonmagical, no-mount and replacement-weapon restrictions intact',()=>{
  const main='A hand weapon carried by a model with this special rule has Magical Attacks and Armour Piercing -1.';
  const note="Note that this special rule only applies to a single, non-magical hand weapon and does not apply to a model's mount. If the model is using two hand weapons or another weapon, this special rule ceases to apply.";
  const italicNote=paragraph({nodeType:'text',value:note,marks:[{type:'italic'}]});
  const result=build({body:body(paragraph(main),italicNote)});
  assert.deepEqual(result.en,[main,note]);
  assert.match(result.en[1],/only applies/);assert.match(result.en[1],/does not apply/);assert.match(result.en[1],/ceases to apply/);
});

test('lance summary includes weapon profile and the entire charge and target restriction',()=>{
  const note='Notes: Models whose troop type is cavalry or monster only. A lance can only be used during a turn in which the wielder charged, and its Strength and Armour Piercing modifiers apply only against enemy models the wielder charged that turn.';
  const result=build({body:body(weapon({range:'Combat',strength:'S+2',armourPiercing:'-2',specialRules:body(paragraph('Armour Bane (1)'))}),paragraph(note))});
  assert.match(result.en[0],/Range: Combat/);assert.match(result.en[0],/Strength: S\+2/);
  assert.match(result.en[0],/Armour Piercing: -2/);assert.match(result.en[0],/Armour Bane \(1\)/);
  assert.equal(result.en[1],note,'restrictive Notes are rules even when styled in italics');
});

test('two-profile magic item retains both profiles and when the wielder must choose',()=>{
  const note='Notes: The Sword of the Quest has two profiles. You must choose which the wielder will use at the start of each round of a combat.';
  const result=build({body:body(paragraph('Single-Handed:'),weapon({range:'Combat',strength:'S+1',armourPiercing:'-1',specialRules:body(paragraph('Magical Attacks, Strike First'))}),paragraph('Double-Handed:'),weapon({range:'Combat',strength:'S+2',armourPiercing:'-2',specialRules:body(paragraph('Magical Attacks, Requires Two Hands, Strike Last'))}),paragraph(note))});
  assert.equal(result.en.length,3);assert.match(result.en[0],/^Single-Handed:/);assert.match(result.en[1],/^Double-Handed:/);
  assert.match(result.en[0],/Strike First/);assert.match(result.en[1],/Requires Two Hands, Strike Last/);assert.equal(result.en[2],note);
});

test('spell summary preserves casting type, value, range, dice, Strength, AP and special rule',()=>{
  const effect='The target enemy unit suffers 2D6 Strength 4 hits, each with an AP of -. This spell has Flaming Attacks.';
  const result=build({type:'1',castingValue:8,range:'24"',body:body(table([['Type','Magic Missile'],['Casting Value','8+'],['Range','24"']]),paragraph(effect))});
  assert.equal(result.en[0],'Type: Magic Missile; Casting Value: 8+; Range: 24"');
  assert.equal(result.en[1],effect);assert.doesNotMatch(result.en[0],/Type: 1/);
});

test('general rules preserve a complete conditional sentence and ignore worked examples',()=>{
  const rule='When measuring distance between two units, measure between the closest points of their bases. You cannot measure from a weapon or banner.';
  const result=build({body:body(paragraph(rule),paragraph('For example, if two units are 8" apart, measure 8".'),rich('unordered-list',rich('list-item',paragraph('A roll of a natural 1 always fails, regardless of modifiers.'))))});
  assert.deepEqual(result.en,[rule,'A roll of a natural 1 always fails, regardless of modifiers.']);
  assert.doesNotMatch(result.en.join(' '),/For example/);
});

test('an adjacent fourth restriction is retained without cutting a rule sentence',()=>{
  const result=build({body:body(paragraph('A model may move during the Movement phase.'),paragraph('The unit may wheel during its move.'),paragraph('Measure the distance moved by the outside model.'),paragraph('The unit cannot move within 1" of an enemy unless it is charging.'))});
  assert.equal(result.en.length,3);assert.match(result.en[2],/outside model\. The unit cannot move within 1"/);
});

test('unit and metadata profile numbers stay exact, including unknown and symbolic characteristics',()=>{
  const stats=[{Name:'Rider',M:'-',WS:'5',BS:'3',S:'4',T:'4',W:'1',I:'4',A:'1',Ld:'8'},{Name:'Steed',M:'7',WS:'3',BS:'-',S:'4',T:'-',W:'-',I:'3',A:'1',Ld:'-'}];
  const input={stats:structuredClone(stats)};
  const result=SUMMARY.build({name:'Rider',info:input});
  assert.equal(result.kind,'metadata');assert.equal(result.available,true);assert.match(result.en[0],/^Rider: M - · WS 5/);assert.match(result.en[1],/^Steed: M 7/);
  assert.deepEqual(input.stats,stats);
  const fromArticle=build({unitProfile:stats,cost:27,unitSize:'4+',description:body(paragraph('Fabled knights win every battle.'))});
  assert.equal(fromArticle.kind,'extracted');assert.match(fromArticle.en[0],/Rider: M -.*Steed: M 7/);assert.match(fromArticle.en[1],/Cost: 27 points/);assert.doesNotMatch(fromArticle.en.join(' '),/win every/);
});

test('unknown or fiction-only entries explicitly report unavailable instead of inventing mechanics',()=>{
  for(const result of [SUMMARY.build(),build({description:body(paragraph('A mighty blade cleaves all foes.'))}),SUMMARY.build({info:{page:'RB, p. 166'}})]) {
    assert.equal(result.available,false);assert.equal(result.kind,'metadata');assert.match(result.en[0],/No verified rule text/);assert(result.ko.length);
    assert.doesNotMatch(result.en[0],/\+1|\+2|Strength|AP -/);
  }
});

test('collection returns fresh immutable projections, not references into the fetched entry',()=>{
  const fields={body:body(paragraph('A model must roll a natural 6, not a modified 6.'))};
  const before=JSON.stringify(fields),doc=fieldsDocument(fields),blocks=SUMMARY.collect(doc);
  blocks[0].text='changed';
  assert.equal(JSON.stringify(fields),before);assert.equal(SUMMARY.collect(doc)[0].text,'A model must roll a natural 6, not a modified 6.');
});

// A tiny DOM tree supplies the platform tree/query contract without requiring a
// browser package for the Node suite. The production collector walks this tree;
// this exercises its fallback independently of the structured Contentful path.
function element(tag,children=[],classes=[]) {
  const node={nodeType:1,tagName:tag.toUpperCase(),children:children.filter(child=>typeof child!=='string'),classList:{contains:value=>classes.includes(value)}};
  for(const child of node.children)child.parentElement=node;
  Object.defineProperty(node,'textContent',{get:()=>children.map(child=>typeof child==='string'?child:child.textContent).join('')});
  node.querySelectorAll=selector=>{
    const tags=selector.split(',').map(value=>value.trim().toUpperCase()),found=[];
    const visit=child=>{if(tags.includes(child.tagName))found.push(child);for(const nested of child.children)visit(nested);};
    for(const child of node.children)visit(child);return found;
  };
  node.querySelector=selector=>node.querySelectorAll(selector)[0]||null;
  node.contains=other=>node===other||node.children.some(child=>child.contains(other));
  return node;
}
const domDocument=roots=>({querySelector(){return null;},querySelectorAll(){return roots;}});

test('DOM fallback omits section-intro flavor and footer while retaining italic Notes and leaf list rules',()=>{
  const note='Notes: A lance can only be used during a turn in which the wielder charged.';
  const intro=element('article',[element('p',['A mighty lance wins glory for its bearer.'])],['article--rich-text','section-intro']);
  const main=element('article',[
    element('ul',[element('li',[element('p',['The model must roll To Hit.'])])]),
    element('p',[element('i',[note])]),element('footer',[element('p',['Report Bug: the model may click this link.'])])
  ],['article--rich-text']);
  const result=SUMMARY.build({document:domDocument([intro,main])});
  assert.deepEqual(result.en,['The model must roll To Hit.',note]);
});

test('DOM fallback reads weapon table cells once and includes the entire following restriction',()=>{
  const rows=[['Range','Strength','Armour Piercing','Special Rules'],['Combat','S+2','-2','Armour Bane (1)']];
  const sourceTable=element('table',rows.map((row,index)=>element('tr',row.map(value=>element(index?'td':'th',[element('p',[value])])))));
  const root=element('article',[sourceTable,element('p',['Notes: Only cavalry and monsters may use this weapon.'])],['article--rich-text']);
  const blocks=SUMMARY.collect(domDocument([root]));
  assert.equal(blocks.length,2,'table-cell paragraphs cannot become duplicate summary bullets');
  const result=SUMMARY.build({document:domDocument([root])});
  assert.equal(result.en[0],'Range: Combat · Strength: S+2 · Armour Piercing: -2 · Special Rules: Armour Bane (1)');
  assert.equal(result.en[1],'Notes: Only cavalry and monsters may use this weapon.');
});

test('a vertical table starting with Range is not mistaken for horizontal column headers',()=>{
  const result=build({body:body(table([['Range','18"'],['Casting Value','7+']]),paragraph('The target unit must take a Leadership test.'))});
  assert.equal(result.en[0],'Range: 18"; Casting Value: 7+');
});

test('complete timing lists stay together so later phases are not dropped from the summary',()=>{
  const phases=[
    'Enchantment and Hex spells can be cast during the Conjuration sub-phase of your Strategy phase.',
    'Conveyance spells can be cast during Remaining Moves in the Movement phase.',
    'Magic Missiles and Magical Vortex spells can be cast during the Shooting phase.',
    'Assailment spells can be cast when a Wizard fights during the Combat phase.'
  ];
  const result=build({body:body(paragraph('When a spell can be cast depends upon its type:'),rich('unordered-list',...phases.map(phase=>rich('list-item',paragraph(phase)))),paragraph('A Wizard may attempt each spell only once per turn. Wizards engaged in combat can only cast Assailment or range self spells.'))});
  assert.equal(result.en.length,2);for(const phase of phases)assert(result.en[0].includes(phase));
  assert.match(result.en[1],/only once per turn/);assert.match(result.en[1],/only cast Assailment or range self/);
});

test('loss of an ongoing rule and a late restriction are included with its benefits',()=>{
  const loss='Unlike other special rules, Frenzy can be lost during a game. Any model that loses a round of combat will immediately lose this special rule.';
  const result=build({body:body(paragraph('A model that charged has +1 Attacks this turn.'),paragraph('The unit automatically passes Fear tests.'),paragraph('The unit must declare a charge if able.'),paragraph('It cannot choose to Flee.'),paragraph(loss))});
  assert.equal(result.en.length,3);assert.match(result.en[2],/cannot choose to Flee/);assert(result.en[2].includes(loss));
});

test('unit summaries use canonical label callbacks and fixed Korean metadata, preserving all printed numbers',()=>{
  const rules=rich('document',rich('',
    {nodeType:'entry-hyperlink',content:[text('Close Order')],data:{target:{fields:{body:body(paragraph('Wrong linked rule body must never appear.'))}}}},
    {nodeType:'entry-hyperlink',content:[text('Chaos Armour (6+)')]}
  ));
  const fields={unitProfile:[{Name:'Chaos Knight',M:'-',WS:'5',BS:'3',S:'4',T:'4',W:'1',I:'4',A:'1',Ld:'8'},{Name:'Chaos Steed',M:'7',WS:'3',BS:'-',S:'4',T:'-',W:'-',I:'3',A:'1',Ld:'-'}],cost:27,unitSize:'4+',baseSize:'30 x 60 mm',specialRules:rules};
  const before=JSON.stringify(fields),names={'Chaos Knight':'카오스 나이트','Chaos Steed':'카오스 스티드'},ruleLabels={'Close Order':'클로즈 오더','Chaos Armour (6+)':'카오스 아머 (6+)'};
  const result=build(fields,{labelName:value=>names[value]||value,labelRule:value=>ruleLabels[value]||value});
  assert.equal(result.ko.length,3);assert.match(result.ko[0],/^카오스 나이트: M - · WS 5/);assert.match(result.ko[0],/카오스 스티드: M 7 · WS 3/);
  assert.equal(result.ko[1],'포인트: 27 · 유닛 규모: 4+ · 베이스: 30 x 60 mm');
  assert.equal(result.ko[2],'특수 규칙: 클로즈 오더, 카오스 아머 (6+)');
  assert.equal(result.en[2],'Special Rules: Close Order, Chaos Armour (6+)');
  assert.doesNotMatch(result.ko.join(' '),/장치 크기|주문 종료|군마|Wrong linked/);
  assert.equal(JSON.stringify(fields),before);
});

test('cached stat metadata gets deterministic Korean names without translating stat abbreviations or values',()=>{
  const result=SUMMARY.build({info:{stats:[{Name:'Chaos Steed',M:'7',WS:'3',BS:'-',S:'4',T:'-',W:'-',I:'3',A:'1',Ld:'-'}]},labelName:name=>name==='Chaos Steed'?'카오스 스티드':name});
  assert.equal(result.kind,'metadata');assert.equal(result.ko[0],'카오스 스티드: M 7 · WS 3 · BS - · S 4 · T - · W - · I 3 · A 1 · Ld -');
  assert.match(result.en[0],/^Chaos Steed: M 7/);
});
