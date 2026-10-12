'use strict';

// Portable roster text. No server or account is needed to exchange a seed.
window.TOWRosterSeed = (() => {
  const PREFIX='TOW1';
  const MAX_SEED_LENGTH=180000;
  const MAX_JSON_BYTES=262144;
  const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});

  function base64url(bytes){
    let binary='';
    for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  }
  function bytesFromBase64url(value){
    if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error('시드에 사용할 수 없는 문자가 있습니다.');
    let binary;try{binary=atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4));}catch{throw Error('시드 문자열이 손상되었습니다. 다시 복사해 주세요.');}
    return Uint8Array.from(binary,char=>char.charCodeAt(0));
  }
  async function readBounded(stream){
    const reader=stream.getReader(),chunks=[];let length=0;
    for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_JSON_BYTES){await reader.cancel();throw Error('시드의 로스터 데이터가 너무 큽니다.');}chunks.push(value);}
    const joined=new Uint8Array(length);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}return joined;
  }
  async function encode(army){
    const data=encoder.encode(JSON.stringify({version:1,game:'the-old-world',army:window.BTHTOWCore.normalize(army)}));
    if(data.length>MAX_JSON_BYTES)throw Error('로스터가 시드로 공유하기에 너무 큽니다. JSON으로 내보내세요.');
    let method='J',payload=data;
    if(typeof CompressionStream==='function'){
      try{const zipped=await readBounded(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip')));if(zipped.length<data.length){method='G';payload=zipped;}}catch{}
    }
    const seed=`${PREFIX}${method}.${base64url(payload)}`;
    if(seed.length>MAX_SEED_LENGTH)throw Error('로스터가 시드로 공유하기에 너무 큽니다. JSON으로 내보내세요.');
    return seed;
  }
  async function decode(input){
    const seed=String(input||'').trim().replace(/\s+/g,'');
    if(!seed||seed.length>MAX_SEED_LENGTH)throw Error('시드가 비어 있거나 너무 깁니다.');
    const match=seed.match(/^TOW1([GJ])\.([A-Za-z0-9_-]+)$/);
    if(!match)throw Error('올드 월드 로스터 시드 형식이 아닙니다.');
    let bytes=bytesFromBase64url(match[2]);
    if(match[1]==='G'){
      if(typeof DecompressionStream!=='function')throw Error('이 브라우저는 압축 시드를 열 수 없습니다. 브라우저를 업데이트하세요.');
      try{bytes=await readBounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));}catch(error){throw Error(error.message==='시드의 로스터 데이터가 너무 큽니다.'?error.message:'시드가 손상되어 압축을 풀 수 없습니다.');}
    }
    if(bytes.length>MAX_JSON_BYTES)throw Error('시드의 로스터 데이터가 너무 큽니다.');
    let payload;try{payload=JSON.parse(decoder.decode(bytes));}catch{throw Error('시드 내용이 손상되었습니다. 다시 복사해 주세요.');}
    if(payload?.version!==1||payload.game!=='the-old-world'||!payload.army||!Array.isArray(payload.army.units))throw Error('지원하지 않는 올드 월드 로스터 시드입니다.');
    return window.BTHTOWCore.normalize(payload.army);
  }
  return Object.freeze({encode,decode});
})();
