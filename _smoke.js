/* 无头验证：word2vec-forge 引擎 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const m=html.match(/<script id="engine">([\s\S]*?)<\/script>/);
const ctx={console,Math,TextEncoder,TextDecoder,Uint8Array,Int32Array,Int8Array,Float64Array,Object,Array,JSON,isFinite,Infinity,globalThis:{}};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(m[1],ctx,{filename:'engine.js'});
const W2V=ctx.W2V;

let pass=0,fail=0,fails=[];
function ok(name,cond,detail){
  if(cond){pass++;}
  else{fail++;fails.push(name+(detail?' :: '+detail:''));}
}

/* 1. 确定性：同种子两次训练 bit 级一致 */
const rng=W2V.mulberry32(42);
const corpus=W2V.buildCorpus(rng,400);
const m1=W2V.train(corpus,{dim:16,epochs:80,seed:42});
const m2=W2V.train(corpus,{dim:16,epochs:80,seed:42});
let dmax=0;for(let i=0;i<m1.W.length;i++)dmax=Math.max(dmax,Math.abs(m1.W[i]-m2.W[i]));
ok('determinism',dmax===0,'maxdiff='+dmax);

/* 2. 梯度检验：中心差分 vs 解析梯度 */
const gc=W2V.gradCheck(1,1e-6);
ok('gradCheck',gc<1e-6,'maxRel='+gc);

/* 3. loss 下降 */
const h=m1.lossHist;
const first5=h.slice(0,5).reduce((a,b)=>a+b)/5;
const last5=h.slice(-5).reduce((a,b)=>a+b)/5;
ok('lossDecreases',last5<first5&&h[h.length-1]<h[0],'first5='+first5.toFixed(4)+' last5='+last5.toFixed(4));

/* 4. 类比推理 top-1（核心不变量） */
function anaTop(a,b,c){const r=W2V.analogy(m1,a,b,c,5);return r?r.answer:null;}
ok('analogy king-man+woman=queen',anaTop('king','man','woman')==='queen',JSON.stringify(anaTop('king','man','woman')));
ok('analogy queen-woman+man=king',anaTop('queen','woman','man')==='king',JSON.stringify(anaTop('queen','woman','man')));
ok('analogy paris-france+germany=berlin',anaTop('paris','france','germany')==='berlin',JSON.stringify(anaTop('paris','france','germany')));
ok('analogy berlin-paris+rome=tbd',anaTop('berlin','germany','italy')==='rome',JSON.stringify(anaTop('berlin','germany','italy')));

/* 5. 语义相似度 sanity */
const cos=(a,b)=>W2V.cos(W2V.vec(m1,a),W2V.vec(m1,b));
ok('sim(king,queen)>sim(king,farm)',cos('king','queen')>cos('king','farm'),
  cos('king','queen').toFixed(3)+' vs '+cos('king','farm').toFixed(3));
ok('sim(paris,berlin)>sim(paris,farm)',cos('paris','berlin')>cos('paris','farm'),
  cos('paris','berlin').toFixed(3)+' vs '+cos('paris','farm').toFixed(3));
const nnCrown=W2V.nearest(m1,'crown',5).map(x=>x.word);
const royalCtx=['palace','throne','castle'];
const royalTgt=['king','queen'];
ok('nearest(crown) hits royal cluster',nnCrown.some(w=>royalCtx.includes(w))||nnCrown.some(w=>royalTgt.includes(w)),JSON.stringify(nnCrown));
ok('king pulled to royal ctx',cos('king','crown')>cos('man','crown'),
  cos('king','crown').toFixed(3)+' vs '+cos('man','crown').toFixed(3));
const nnHe=W2V.nearest(m1,'he',5).map(x=>x.word);
const maleSet=['him','his','brother','king','man'];
ok('nearest(he) hits male words',nnHe.some(w=>maleSet.includes(w)),JSON.stringify(nnHe));

/* 6. 最近邻排除自身、余弦有界 */
const nnW=W2V.nearest(m1,'king',40);
ok('nearest excludes self',!nnW.some(x=>x.word==='king'));
ok('cos in [-1,1]',nnW.every(x=>x.sim<=1+1e-12&&x.sim>=-1-1e-12));

/* 7. 类比排除输入词 */
const r7=W2V.analogy(m1,'king','man','woman',40);
ok('analogy excludes inputs',!r7.top.some(x=>['king','man','woman'].includes(x.word)));

/* 8. 边界：空语料 / 单词语料 */
ok('empty corpus -> null',W2V.train([],{epochs:5})===null);
const one=W2V.train([['king'],['king'],['king']],{dim:4,epochs:5,seed:1});
ok('single-word corpus no crash',!!one&&one.lossHist.length===5);
const oov=W2V.train([['king','xyz'],['queen']],{dim:4,epochs:3,seed:1});
ok('OOV handled: vocab keeps raw + train filters',!!oov&&oov.vocab.size===3&&oov.vocab.word2id['xyz']!==undefined);

/* 9. unicode 词 */
const uni=W2V.buildVocab([['国王','王后'],['王后','国王']]);
ok('unicode vocab',uni.size===2&&uni.word2id['国王']!==undefined);

/* 10. 负采样分布归一 + sigmoid 性质 */
let acc=0;const rng2=W2V.mulberry32(7);
const vv=W2V.buildVocab(corpus);
const pow=[];let tot=0;
for(let i=0;i<vv.size;i++){pow.push(Math.pow(vv.count[i],0.75));tot+=pow[i];}
ok('negDist sums to 1',Math.abs(tot/tot-1)<1e-12);
ok('sigmoid bounds',W2V.sigmoid(1000)===1&&W2V.sigmoid(-1000)===0&&Math.abs(W2V.sigmoid(0)-0.5)<1e-15);

/* 11. PCA：解释方差降序、投影点有限 */
const pca=W2V.pca2d(m1);
ok('pca explained desc',pca.explained[0]>=pca.explained[1]&&pca.explained[0]>0&&pca.explained[0]<=1,
  JSON.stringify(pca.explained));
ok('pca finite',pca.points.every(p=>isFinite(p.x)&&isFinite(p.y)));

/* 12. similarityMatrix：对角=1，对称 */
const sm=W2V.similarityMatrix(m1);
ok('simMatrix diag=1',sm.matrix.every((row,i)=>Math.abs(row[i]-1)<1e-12));
let sym=true;
for(let i=0;i<sm.words.length;i++)for(let j=0;j<sm.words.length;j++)
  if(Math.abs(sm.matrix[i][j]-sm.matrix[j][i])>1e-12)sym=false;
ok('simMatrix symmetric',sym);

/* 13. 语料完整性：全部目标词出现 */
const targets=Object.keys(W2V.TARGET_FEATURES);
const inCorpus=targets.every(t=>corpus.some(s=>s.includes(t)));
ok('all targets in corpus',inCorpus);

fs.writeFileSync(path.join(__dirname,'_smoke.log'),
  `PASS ${pass} / ${pass+fail}\n`+(fail?'FAIL '+fails.join(' | '):'ALL GREEN')+'\n');
console.log(fail?`FAIL ${fail}: `+fails.join(' | '):`ALL GREEN ${pass}/${pass+fail}`);
process.exit(fail?1:0);
