'use strict';
// Open a search chosen by the user; no images or personal data are uploaded.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TOWUnitPhotos=api;
})(typeof window==='undefined'?null:window,function(){
  const phrase=value=>String(value??'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
  function originalName(source,record){return phrase(source?.name_en||record?.name||source?.name_de||source?.id||'');}
  function imageURL({name,faction}={}){
    const unit=phrase(name);if(!unit)return null;
    const url=new URL('https://www.google.com/search');
    url.search=new URLSearchParams({tbm:'isch',q:['Warhammer The Old World',phrase(faction),unit,'miniatures'].filter(Boolean).join(' ')}).toString();
    return url.href;
  }
  return Object.freeze({originalName,imageURL});
});
