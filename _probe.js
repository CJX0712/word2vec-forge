/* 语义探针：把内部状态 dump 到 _probe.txt 供人工检查（all-green ≠ 正确） */
const fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
const ctx={console,Math,TextEncoder,TextDecoder,Uint8Array,Int32Array,Int8Array,Float64Array,Object,Array,JSON,isFinite,Infinity,globalThis:{}};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(m[1],ctx,{filename:'engine.js'});
const W2V=ctx.W2V;

const rng=W2V.mulberry32(42);
const corpus=W2V.buildCorpus(rng,400);
const model=W2V.train(corpus,{dim:16,epochs:80,seed:42});

const L=[];
L.push('=== 语料样本（前 12 句） ===');
corpus.slice(0,12).forEach(s=>L.push(s.join(' ')));
L.push('');
L.push('=== 词表（'+model.vocab.size+'）===');
L.push(model.vocab.id2word.map((w,i)=>w+':'+model.vocab.count[i]).join('  '));
L.push('');
L.push('=== loss 曲线（每 8 epoch 采样） ===');
model.lossHist.forEach((v,i)=>{if(i%8===0||i===model.lossHist.length-1)L.push('ep'+i+'  '+v.toFixed(4));});
L.push('');
L.push('=== 类比推理 ===');
[['king','man','woman','queen'],['queen','woman','man','king'],
 ['paris','france','germany','berlin'],['berlin','germany','italy','rome'],
 ['rome','italy','spain','madrid'],['man','king','queen','woman?']].forEach(t=>{
  const r=W2V.analogy(model,t[0],t[1],t[2],5);
  L.push(t[0]+' - '+t[1]+' + '+t[2]+' = '+r.answer+'  (期望 '+t[3]+')  top5: '+
    r.top.map(x=>x.word+':'+x.sim.toFixed(3)).join(', '));
});
L.push('');
L.push('=== 最近邻 ===');
['king','queen','man','woman','crown','he','she','paris','france','seine','farm','europe'].forEach(w=>{
  L.push(w.padEnd(8)+' -> '+W2V.nearest(model,w,5).map(x=>x.word+':'+x.sim.toFixed(3)).join(', '));
});
L.push('');
L.push('=== 目标词 2D 投影坐标 ===');
W2V.pca2d(model,Object.keys(W2V.TARGET_FEATURES)).points.forEach(p=>{
  L.push(p.word.padEnd(8)+' x='+p.x.toFixed(3)+'  y='+p.y.toFixed(3));
});

fs.writeFileSync(path.join(__dirname,'_probe.txt'),L.join('\n'));
console.log('probe written');
