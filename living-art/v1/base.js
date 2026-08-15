(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const grid=$('#grid'), gridWrap=$('#gridWrap');
const FAMILY=['Contours','Roots','Op Art','Cells','Leaf Veins','Spirals','Orbit','Tessellation'];
const PALETTES=[
['#0b0b0c','#f1eee8','#ff4c21','#8e102a','#ffc857'],['#0b1020','#d8f1ff','#4fd1c5','#7c3aed','#ff6b9d'],['#0d1712','#e9f0d5','#658c4c','#d99b3d','#8f3d2f'],['#090909','#f4f0e8','#d7ff00','#00d9ff','#ff1f8f'],['#18110e','#f5d7a1','#a53d2a','#4c6a92','#201f45'],['#07121a','#d7f7e8','#2cc295','#087ea4','#f59e0b']];
const state={layout:9,composition:'continuous',mode:'paper',family:0,palette:0,seed:'EMVY-0001',density:58,speed:28,aspect:'square',cycle:'manual',paused:false,phase:0,audioLevel:0,lastFrame:0};
const params=new URLSearchParams(location.search), playerType=params.get('player'), panelNumber=Math.max(1,Number(params.get('panel')||1));
let canvases=[],audioCtx=null,analyser=null,audioData=null,cycleStamp='',resizeTimer=0;
function loadState(){if(!playerType){try{Object.assign(state,JSON.parse(localStorage.getItem('emvy-living-art-v1')||'{}'))}catch(e){}} const take=(k,f=v=>v)=>{if(params.has(k))state[k]=f(params.get(k))}; take('layout',v=>[1,4,9].includes(+v)?+v:9);take('composition');take('mode');take('family',v=>Math.max(0,Math.min(7,+v||0)));take('palette',v=>Math.max(0,+v||0));take('seed');take('density',v=>Math.max(20,Math.min(100,+v||58)));take('speed',v=>Math.max(5,Math.min(100,+v||28)));take('aspect');take('cycle')}
function persist(){if(playerType)return;try{localStorage.setItem('emvy-living-art-v1',JSON.stringify(state))}catch(e){}}
function hashString(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rngFrom(seed){let a=hashString(String(seed))||1;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hexToRgb(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function rgba(h,a){const[r,g,b]=hexToRgb(h);return`rgba(${r},${g},${b},${a})`}
function layoutDims(){return state.layout===1?[1,1]:state.layout===4?[2,2]:[3,3]}
function aspectValue(){return state.aspect==='wide'?16/9:state.aspect==='classic'?4/3:1}
function cycleToken(){const d=new Date();return state.cycle==='minute'?d.toISOString().slice(0,16):state.cycle==='hour'?d.toISOString().slice(0,13):state.cycle==='day'?d.toISOString().slice(0,10):''}
function effectiveSeed(){const t=cycleToken();return t?`${state.seed}|${state.cycle}|${t}`:state.seed}
function playerURL(kind,panel){const u=new URL(location.href);const q=new URLSearchParams({layout:String(state.layout),composition:state.composition,mode:state.mode,family:String(state.family),palette:String(state.palette),seed:state.seed,density:String(state.density),speed:String(state.speed),aspect:state.aspect,cycle:state.cycle,player:kind});if(kind==='panel')q.set('panel',String(panel));u.search=q.toString();u.hash='';return u.toString()}
function applyDisplayGeometry(){if(playerType==='panel'){document.body.classList.add('player-mode','player-panel');return}if(playerType==='wall'){document.body.classList.add('player-mode','player-wall');let w=innerWidth,h=w/aspectValue();if(h>innerHeight){h=innerHeight;w=h*aspectValue()}gridWrap.style.width=w+'px';gridWrap.style.height=h+'px';gridWrap.style.aspectRatio='auto';return}gridWrap.style.aspectRatio=String(aspectValue());gridWrap.style.height='auto';gridWrap.style.width='min(78vh,68vw)'}
function canvasSize(){const dpr=Math.min(devicePixelRatio||1,2),[cols,rows]=layoutDims();if(playerType==='panel')return[clamp(Math.round(innerWidth*dpr),320,1920),clamp(Math.round(innerHeight*dpr),240,1440)];const r=grid.getBoundingClientRect();return[clamp(Math.round((r.width/cols)*dpr),220,960),clamp(Math.round((r.height/rows)*dpr),220,960)]}
function rebuildGrid(){const[cols,rows]=layoutDims(),count=playerType==='panel'?1:state.layout;grid.innerHTML='';grid.style.gridTemplateColumns=playerType==='panel'?'1fr':`repeat(${cols},1fr)`;grid.style.gridTemplateRows=playerType==='panel'?'1fr':`repeat(${rows},1fr)`;canvases=[];for(let i=0;i<count;i++){const t=document.createElement('div');t.className='tile';const c=document.createElement('canvas');const n=document.createElement('span');n.className='screen-index';n.textContent=String(playerType==='panel'?panelNumber:i+1).padStart(2,'0');t.append(c,n);grid.append(t);canvases.push(c)}applyDisplayGeometry();syncUI();render()}
loadState();
