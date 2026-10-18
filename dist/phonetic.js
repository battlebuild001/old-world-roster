'use strict';
// Names are display-only. IDs, English source names and saved armies stay canonical.
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  if(root)root.TOWPhonetic=factory(root.TOWPhoneticNames||{});
})(typeof window==='undefined'?null:window,function createPhoneticNames(data){
  const normalize=value=>String(value||'').normalize('NFKC').replace(/[‘’`]/g,"'").replace(/[–—]/g,'-').replace(/[Ææ]/g,'ae').replace(/[Œœ]/g,'oe').replace(/ß/g,'ss').replace(/\s+/g,' ').trim().toLowerCase();
  const labels=new Map(Object.entries(data.labels||{}).map(([key,value])=>[normalize(key),value]));
  const nameKeys=new Set((data.nameKeys||Object.keys(data.labels||{})).map(normalize));
  const tokens=new Map(Object.entries(data.tokens||{}).map(([key,value])=>[normalize(key),value]));
  const statNames={M:'Movement',WS:'Weapon Skill',BS:'Ballistic Skill',S:'Strength',T:'Toughness',W:'Wounds',I:'Initiative',A:'Attacks',Ld:'Leadership',AP:'Armour Piercing'};
  const notation=value=>/^(?:M|WS|BS|S|T|W|I|A|Ld|AP|X|XX|\d*D\d+(?:[+−-]\d+)?|S[+−-]\d+)$/.test(String(value).trim());
  function has(value){
    const raw=String(value||'').trim();if(notation(raw))return false;
    return nameKeys.has(normalize(raw))||nameKeys.has(normalize(raw.replace(/\s*(?:\([^()]*\)|\{[^{}]*\}|\*)/g,'')));
  }
  function korean(value){
    const raw=String(value??'');if(!/[A-Za-zÀ-žÆæ]/.test(raw)||notation(raw))return raw;
    const exact=labels.get(normalize(raw));if(exact)return exact;
    // This path covers counted selections and parameterised variants of known names.
    // Unrecognised custom text stays intact instead of being machine translated.
    return raw.replace(/\d*D\d+(?:[+−-]\d+)?|S[+−-]\d+|[\p{Script=Latin}]+(?:['’‘-][\p{Script=Latin}]+)*/gu,word=>notation(word)?word:tokens.get(normalize(word))||labels.get(normalize(word))||word);
  }
  function label(value,mode='ko'){
    const raw=String(value??'');if(mode==='en')return raw;
    const translated=korean(raw);return mode==='both'&&translated!==raw?`${translated} · ${raw}`:translated;
  }
  function stat(key,mode='ko'){
    return label(statNames[key]||key,mode);
  }
  return Object.freeze({has,korean,label,stat,statNames:Object.freeze(statNames),coverage:Object.freeze(data.coverage||{})});
});
