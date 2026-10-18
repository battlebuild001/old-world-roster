'use strict';

// Summaries are projections of the fetched rule, never changes to game data.
// Prefer the publisher's structured body: its description is background fiction,
// while italic paragraphs in the body can contain essential restrictions.
window.TOWRuleSummaries = (() => {
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const statKeys = ['M','WS','BS','S','T','W','I','A','Ld'];
  const unavailable = Object.freeze({
    ko: ['확인된 규칙 내용이 없어 요약을 표시할 수 없습니다. 아래 원문을 확인하세요.'],
    en: ['No verified rule text is available to summarize. Check the full rule below.']
  });
  const isExample = text => /^(?:for example|example\b|as an example|for instance)\b/i.test(text);
  const isRestriction = text => /\b(?:only|cannot|can not|must|does not|do not|may not|unless|except|instead|ceases|lose|loses|lost|note that|notes?:|provided that)\b/i.test(text);
  const isMechanic = text => /\b(?:must|may|can|cannot|shall|roll|rolls|rolling|dice|D[236]|phase|turn|round|attack|attacks|hit|hits|wound|wounds|save|saves|modifier|modifiers|characteristic|characteristics|cast|casting|target|targets|move|moves|movement|charge|charged|combat|unit|model|models|test|tests|range|distance|measure|measured|resolve|resolved|choose|chosen|reroll|re-roll|deploy|deployment|victory|points|formation|rank|ranks)\b/i.test(text);
  function canonicalPath(value) {
    let path = clean(value);
    if (/^https?:\/\//i.test(path)) {
      try { path = new URL(path).pathname; } catch { return ''; }
    }
    return path.split(/[?#]/,1)[0].replace(/^\/+|\/+$/g,'');
  }
  function parameterOf(name) {
    const values = [...String(name || '').matchAll(/\(([^()]*)\)/g)].map(match => clean(match[1]));
    return values.findLast(value => /^(?:[+-]?\d+(?:\+)?|[+-]?\d*D\d+(?:[+-]\d+)?|X\+?)$/i.test(value)) || 'X';
  }
  function richText(part) {
    if (!part) return '';
    if (part.nodeType === 'text') return part.value || '';
    // In particular, never follow a linked entry into that OTHER rule's body.
    const block=/^(?:document|unordered-list|ordered-list|list-item|table|table-row|table-cell)$/.test(part.nodeType || '');
    return (part.content || []).map(richText).join(part.nodeType === '' ? ', ' : block ? ' ' : '');
  }
  const listedRules=value=>clean(typeof value==='string'?value:value?.nodeType==='document'?(value.content||[]).map(richText).filter(clean).join(', '):richText(value));
  function unitRuleNames(value) {
    const names=[];
    const visit=part=>{
      if(part?.nodeType==='entry-hyperlink'){const name=clean(richText(part));if(name)names.push(name);return;}
      for(const child of part?.content||[])visit(child);
    };
    visit(value);
    return names.length?names:listedRules(value).split(/,\s*(?![^()]*\))/).map(clean).filter(Boolean);
  }
  const profileCopy=profile=>Object.fromEntries(['Name','name','name_en',...statKeys].filter(key=>profile?.[key]!==undefined).map(key=>[key,profile[key]]));
  function statLine(profile) {
    const facts = statKeys.filter(key => profile?.[key] !== undefined && clean(profile[key]) !== '')
      .map(key => `${key} ${clean(profile[key])}`);
    return facts.length ? `${clean(profile.Name || profile.name || profile.name_en) || 'Profile'}: ${facts.join(' · ')}` : '';
  }
  function weaponLine(fields, title) {
    const facts = [['Range',fields.range],['Strength',fields.strength],['Armour Piercing',fields.armourPiercing]]
      .filter(([,value]) => value !== undefined && clean(value) !== '').map(([label,value]) => `${label}: ${clean(value)}`);
    const rules = listedRules(fields.specialRules);
    if (rules) facts.push(`Special Rules: ${rules}`);
    return facts.length ? `${title ? `${title.replace(/:\s*$/,'')}: ` : ''}${facts.join(' · ')}` : '';
  }
  function tableLines(rows, title = '') {
    const data = rows.map(row => row.map(clean));
    if (!data.length) return '';
    const first = data[0];
    const knownHeaders=first.filter(value => /^(?:Range|Strength|Armour Piercing|Special Rules|M|WS|BS|S|T|W|I|A|Ld)$/i.test(value));
    const hasHeaders = knownHeaders.length > 1 || first[0] === '' && knownHeaders.length > 0;
    let lines;
    if (hasHeaders && data.length > 1) {
      lines = data.slice(1).map(row => {
        const prefix = first[0] === '' && row[0] ? `${row[0]}: ` : '';
        const values = row.map((value,index) => first[index] ? `${first[index]}: ${value}` : (prefix ? '' : value)).filter(Boolean);
        return prefix + values.join(' · ');
      });
    } else {
      lines = data.map(row => row.length === 2 ? `${row[0]}: ${row[1]}` : row.join(' · '));
    }
    return `${title ? `${title.replace(/:\s*$/,'')}: ` : ''}${lines.filter(Boolean).join('; ')}`;
  }
  function structuredBlocks(documentOfRule) {
    const script = documentOfRule?.querySelector?.('#__NEXT_DATA__');
    if (!script?.textContent) return null;
    let entry;
    try { entry = JSON.parse(script.textContent).props?.pageProps?.entry; } catch { return null; }
    const fields = entry?.fields;
    if (!fields) return null;
    const blocks = [];
    const add = (text,kind = 'paragraph',extra = {}) => { text=clean(text);if(text)blocks.push({text,kind,...extra}); };
    let heading = '';
    const visit = part => {
      if (!part) return;
      const type = part.nodeType;
      if (type === 'embedded-entry-block') {
        const embedded = part.data?.target;
        const embeddedFields = embedded?.fields;
        if (embedded?.sys?.contentType?.sys?.id === 'weaponProfile' && embeddedFields) {
          add(weaponLine(embeddedFields,heading),'table',{tableType:'weapon'});heading='';
        }
        return;
      }
      if (type === 'table') {
        const rows = (part.content || []).map(row => (row.content || []).map(cell => richText(cell)));
        add(tableLines(rows,heading),'table');heading='';return;
      }
      if (type === 'unordered-list' || type === 'ordered-list') {
        const parts=[];
        const leaves=node=>{
          if(node.nodeType==='paragraph'){const value=clean(richText(node));if(value)parts.push(value);return;}
          for(const child of node.content||[])leaves(child);
        };
        leaves(part);
        const value=parts.join(' ');
        add(`${heading?`${heading} `:''}${value}`,'list');heading='';return;
      }
      if (/^heading-/.test(type || '')) { heading=clean(richText(part));return; }
      if (type === 'paragraph' || type === 'list-item') {
        if ((part.content || []).some(child => ['paragraph','unordered-list','ordered-list','table'].includes(child.nodeType))) {
          for(const child of part.content || [])visit(child);
          return;
        }
        const text=clean(richText(part));
        if (/^[^.!?]{1,70}:$/.test(text)) { heading=text;return; }
        add(text,type==='list-item'?'list':'paragraph');return;
      }
      for (const child of part.content || []) visit(child);
    };
    visit(fields.body);
    if (!blocks.length && clean(fields.bodyIndex)) add(fields.bodyIndex);
    if (!blocks.length && Array.isArray(fields.unitProfile)) {
      add(fields.unitProfile.map(statLine).filter(Boolean).join('; '),'table',{tableType:'unit',unitProfiles:fields.unitProfile.map(profileCopy)});
      const detail=[];
      if(fields.cost!==undefined)detail.push(`Cost: ${clean(fields.cost)} points`);
      if(fields.unitSize!==undefined)detail.push(`Unit Size: ${clean(fields.unitSize)}`);
      if(fields.baseSize!==undefined)detail.push(`Base Size: ${clean(fields.baseSize)}`);
      if(detail.length)add(detail.join(' · '),'metadata',{unitDetails:Object.fromEntries(['cost','unitSize','baseSize'].filter(key=>fields[key]!==undefined).map(key=>[key,fields[key]]))});
      const rules=unitRuleNames(fields.specialRules);if(rules.length)add(`Special Rules: ${rules.join(', ')}`,'metadata',{unitRules:rules});
    }
    // A known structured entry with no body is NOT permission to summarize its
    // description, association, related links, or linked entries' mechanics.
    return blocks;
  }
  function domBlocks(documentOfRule) {
    const blocks=[];
    const roots=[...(documentOfRule?.querySelectorAll?.('article.article--rich-text, .unit-profile') || [])];
    let heading='';
    const walk = element => {
      if(element.nodeType!==1)return;
      const tag=element.tagName?.toUpperCase();
      if(['SCRIPT','STYLE','SVG','FOOTER','NAV','ASIDE','NOSCRIPT'].includes(tag))return;
      if(element.classList?.contains('section-intro') || element.classList?.contains('cross-reference'))return;
      if(tag==='TABLE') {
        const rows=[...element.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(cell=>clean(cell.textContent)));
        const text=tableLines(rows,heading);if(text)blocks.push({text,kind:'table'});heading='';return;
      }
      if(tag==='UL'||tag==='OL'){
        const paragraphs=[...element.querySelectorAll('p')].filter(part=>!part.querySelector('p'));
        const leaves=paragraphs.length?paragraphs:[...element.querySelectorAll('li')].filter(part=>!part.querySelector('li'));
        const text=leaves.map(part=>clean(part.textContent)).filter(Boolean).join(' ');
        if(text)blocks.push({text:`${heading?`${heading} `:''}${text}`,kind:'list'});heading='';return;
      }
      if(/^H[1-6]$/.test(tag)){heading=clean(element.textContent);return;}
      if(['P','LI','BLOCKQUOTE'].includes(tag) && !element.querySelector('p,li,table')) {
        const text=clean(element.textContent);if(!text)return;
        if(/^[^.!?]{1,70}:$/.test(text)){heading=text;return;}
        // Italic Notes are rules. Only omit wholly italic narrative without any
        // operative language; a first paragraph is never dropped by position.
        const italic=[...element.querySelectorAll('em,i')].map(node=>clean(node.textContent)).join(' ');
        if(italic===text&&!isMechanic(text)&&!isRestriction(text))return;
        blocks.push({text,kind:tag==='LI'?'list':'paragraph'});return;
      }
      if(element.parentElement?.classList?.contains('unit-profile__details') && !element.querySelector('p,li,table')) {
        const text=clean(element.textContent);if(text)blocks.push({text,kind:'metadata'});return;
      }
      for(const child of element.children || [])walk(child);
    };
    for(const root of roots)if(!roots.some(other=>other!==root&&other.contains(root)))walk(root);
    return blocks;
  }
  function collect(documentOfRule) {
    const blocks=structuredBlocks(documentOfRule) ?? domBlocks(documentOfRule);
    const seen=new Set();
    return blocks.filter(block=>{
      if(!block.text||seen.has(block.text))return false;
      seen.add(block.text);return true;
    }).map((block,index)=>({...block,index,restriction:isRestriction(block.text),example:isExample(block.text)}));
  }
  function selectBlocks(blocks) {
    const candidates=blocks.filter(block=>!block.example&&(block.kind==='table'||block.kind==='metadata'||isMechanic(block.text)||isRestriction(block.text)));
    if(!candidates.length)return [];
    // Keep complete rule paragraphs. Cutting text at a character limit can
    // silently discard a negation, timing clause, or the exception to a bonus.
    const selected=candidates.slice(0,3);
    const last=selected.at(-1).index;
    const restrictions=candidates.filter(block=>!selected.includes(block)&&block.restriction&&block.index<=last+2);
    const result=selected.map(block=>block.text);
    if(restrictions.length)result[result.length-1]+=' '+restrictions.map(block=>block.text).join(' ');
    return result;
  }
  function metadataBlocks(info) {
    const profiles=Array.isArray(info?.stats)?info.stats:Array.isArray(info?.profile)?info.profile:[];
    const lines=profiles.map(statLine).filter(Boolean);
    if(!lines.length&&info?.stats&&typeof info.stats==='object')lines.push(statLine(info.stats));
    if(!lines.filter(Boolean).length){
      const source=info?.profile&&!Array.isArray(info.profile)?info.profile:info;
      const line=source&&weaponLine(source,'');if(line)lines.push(line);
    }
    return lines.filter(Boolean).slice(0,3);
  }
  function koreanUnitBlock(block,labelName,labelRule) {
    if(block.unitProfiles)return block.unitProfiles.map(profile=>statLine({...profile,Name:labelName(clean(profile.Name||profile.name||profile.name_en)||'Profile')})).filter(Boolean).join('; ');
    if(block.unitDetails){
      const details=block.unitDetails;
      return [['포인트',details.cost],['유닛 규모',details.unitSize],['베이스',details.baseSize]].filter(([,value])=>value!==undefined).map(([label,value])=>`${label}: ${clean(value)}`).join(' · ');
    }
    if(block.unitRules)return `특수 규칙: ${block.unitRules.map(labelRule).join(', ')}`;
    return '';
  }
  function build({name='',path='',info=null,document:documentOfRule=null,overrides={},labelName=(value=>value),labelRule=(value=>value)}={}) {
    const key=canonicalPath(path||info?.url),parameter=parameterOf(name);
    const base={path:key,parameter};
    const override=key&&Object.prototype.hasOwnProperty.call(overrides||{},key)?overrides[key]:null;
    if(override&&Array.isArray(override.ko)&&Array.isArray(override.en)) {
      const format=values=>values.filter(value=>typeof value==='string').map(value=>clean(value.replace(/\{x\}/gi,()=>parameter))).filter(Boolean).slice(0,3);
      const ko=format(override.ko),en=format(override.en);
      if(ko.length&&en.length)return {...base,ko,en,kind:'curated',available:true};
    }
    const blocks=collect(documentOfRule),extracted=selectBlocks(blocks);
    if(extracted.length){
      const ko=blocks.some(block=>block.unitProfiles)?blocks.map(block=>koreanUnitBlock(block,labelName,labelRule)).filter(Boolean).slice(0,3):[];
      return {...base,ko,en:extracted,kind:'extracted',available:true};
    }
    const metadata=metadataBlocks(info);
    if(metadata.length){
      const profiles=Array.isArray(info?.stats)?info.stats:Array.isArray(info?.profile)?info.profile:info?.stats&&typeof info.stats==='object'?[info.stats]:[];
      const ko=profiles.map(profile=>statLine({...profile,Name:labelName(clean(profile.Name||profile.name||profile.name_en)||'Profile')})).filter(Boolean).slice(0,3);
      return {...base,ko,en:metadata,kind:'metadata',available:true};
    }
    return {...base,ko:[...unavailable.ko],en:[...unavailable.en],kind:'metadata',available:false};
  }
  return Object.freeze({build,collect,canonicalPath,parameterOf});
})();
