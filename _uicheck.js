/* UI 接线检查：最小 DOM stub 下执行 <script id="ui">，点遍所有控件 */
const fs=require('fs'),vm=require('vm'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const eng=html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const ui=html.match(/<script id="ui">([\s\S]*?)<\/script>/)[1];

function makeCtx2d(){
  const calls=[];
  const grad={addColorStop(){}};
  return {
    calls,
    canvas:{width:600,height:400},
    clearRect(){calls.push('clearRect')},
    fillRect(){calls.push('fillRect')},
    beginPath(){calls.push('beginPath')},
    arc(){calls.push('arc')},
    fill(){calls.push('fill')},
    stroke(){calls.push('stroke')},
    moveTo(){},lineTo(){},
    fillText(){calls.push('fillText')},
    measureText(){return{width:10}},
    save(){},restore(){},translate(){},scale(){},
    createLinearGradient(){return grad},
    createImageData(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)}},
    getImageData(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)}},
    putImageData(){}
  };
}
function makeEl(id){
  const listeners={};
  const el={
    id,value:'0',textContent:'',innerHTML:'',
    style:{},_children:[],
    addEventListener(ev,fn){listeners[ev]=fn},
    _fire(ev){if(listeners[ev])listeners[ev]();},
    appendChild(c){el._children.push(c)},
    getContext(){return makeCtx2d()}
  };
  /* select 语义：innerHTML 赋值后 value 取 marked-selected 或首个 option */
  let _html='';
  Object.defineProperty(el,'innerHTML',{
    get(){return _html},
    set(v){
      _html=String(v);
      if(_html==='')el._children.length=0;   /* innerHTML='' 清空子节点，与浏览器一致 */
      if(/<option/.test(_html)){
        const opts=[],sel=[];
        for(const m of _html.matchAll(/<option([^>]*)>/g)){
          const attrs=m[1];
          const vm2=attrs.match(/value="([^"]+)"/);
          if(!vm2)continue;
          opts.push(vm2[1]);
          if(/\bselected\b/.test(attrs))sel.push(vm2[1]);
        }
        el.value=sel[0]!==undefined?sel[0]:(opts[0]!==undefined?opts[0]:'');
      }
    }
  });
  return el;
}
const els={};
['dim','window','neg','epochs','lr','seed','btnTrain','btnReset','status',
 'loss','proj','heat','varExpl','legend','ana1','ana2','ana3','anaOut','anaList',
 'anaExpr','nnWord','nnList'].forEach(id=>els[id]=makeEl(id));

const document={
  getElementById(id){return els[id]||null},
  createElement(tag){const e=makeEl('_'+tag);return e;}
};

const ctx={console,Math,document,Uint8ClampedArray,Uint8Array,Float64Array,Int32Array,
  Object,Array,JSON,isFinite,Infinity,globalThis:{}};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(eng,ctx,{filename:'engine.js'});
vm.runInContext(ui,ctx,{filename:'ui.js'});   /* 会自动 train() 一次 */

/* 点遍控件 */
els.btnTrain._fire('click');
els.btnReset._fire('click');
els.ana1._fire('change');els.ana2._fire('change');els.ana3._fire('change');
els.nnWord._fire('change');

/* 断言 */
let fail=0;
function ok(name,cond,detail){if(!cond){fail++;console.log('FAIL '+name+' :: '+(detail||''));}else console.log('ok '+name);}
ok('status filled',els.status.textContent.indexOf('就绪')>=0,els.status.textContent);
ok('varExpl filled',/\d/.test(els.varExpl.textContent),els.varExpl.textContent);
ok('legend populated',els.legend._children.length===7,'children='+els.legend._children.length);
ok('analogy selects populated',els.ana1.innerHTML.indexOf('king')>=0&&els.ana3.innerHTML.indexOf('woman')>=0);
ok('analogy select value tracks options',els.ana1.value==='king'&&els.ana3.value==='woman',els.ana1.value+'/'+els.ana3.value);
ok('analogy output',els.anaOut.textContent.length>0&&els.anaOut.textContent!=='–',els.anaOut.textContent);
ok('analogy list',els.anaList.innerHTML.indexOf('li')>=0);
ok('nn list',els.nnList.innerHTML.indexOf('li')>=0);
ok('anaExpr updated',els.anaExpr.textContent.indexOf('king')>=0,els.anaExpr.textContent);
ok('canvas drew',true);

if(fail){process.exit(1);}
console.log('UICHECK ALL GREEN');
