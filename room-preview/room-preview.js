(function(){
'use strict';

var fileInput=document.getElementById('room-file');
var artSelect=document.getElementById('art-select');
var gridSelect=document.getElementById('grid-select');
var gapRange=document.getElementById('gap-range');
var opacityRange=document.getElementById('opacity-range');
var gapOut=document.getElementById('gap-out');
var opacityOut=document.getElementById('opacity-out');
var resetBtn=document.getElementById('reset-wall');
var fitBtn=document.getElementById('fit-wall');
var downloadBtn=document.getElementById('download');
var canvas=document.getElementById('room-canvas');
var ctx=canvas.getContext('2d');
var empty=document.getElementById('empty-state');

var room=new Image();
var art=new Image();
var roomReady=false;
var artReady=false;
var quad=[];
var active=-1;
var handleRadius=14;

function loadArt(src){
  artReady=false;
  art.onload=function(){artReady=true;draw();};
  art.onerror=function(){artReady=false;draw();};
  art.src=src;
}

function initialQuad(){
  var w=canvas.width,h=canvas.height;
  quad=[
    {x:w*.25,y:h*.24},
    {x:w*.75,y:h*.24},
    {x:w*.75,y:h*.76},
    {x:w*.25,y:h*.76}
  ];
}

function centreQuad(){
  var w=canvas.width,h=canvas.height;
  var qw=w*.46;
  var qh=Math.min(h*.52,qw);
  var cx=w*.5,cy=h*.49;
  quad=[
    {x:cx-qw/2,y:cy-qh/2},
    {x:cx+qw/2,y:cy-qh/2},
    {x:cx+qw/2,y:cy+qh/2},
    {x:cx-qw/2,y:cy+qh/2}
  ];
  draw();
}

fileInput.addEventListener('change',function(){
  var f=this.files&&this.files[0];
  if(!f)return;
  var url=URL.createObjectURL(f);
  room.onload=function(){
    var max=1800;
    var scale=Math.min(1,max/Math.max(room.naturalWidth,room.naturalHeight));
    canvas.width=Math.max(1,Math.round(room.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(room.naturalHeight*scale));
    roomReady=true;
    empty.style.display='none';
    initialQuad();
    draw();
    URL.revokeObjectURL(url);
  };
  room.src=url;
});

artSelect.addEventListener('change',function(){loadArt(this.value);});
gridSelect.addEventListener('change',draw);
gapRange.addEventListener('input',function(){gapOut.textContent=Number(this.value).toFixed(1)+'%';draw();});
opacityRange.addEventListener('input',function(){opacityOut.textContent=this.value+'%';draw();});
resetBtn.addEventListener('click',function(){if(roomReady){initialQuad();draw();}});
fitBtn.addEventListener('click',function(){if(roomReady)centreQuad();});

function bilerp(q,u,v){
  var top={x:q[0].x+(q[1].x-q[0].x)*u,y:q[0].y+(q[1].y-q[0].y)*u};
  var bottom={x:q[3].x+(q[2].x-q[3].x)*u,y:q[3].y+(q[2].y-q[3].y)*u};
  return {x:top.x+(bottom.x-top.x)*v,y:top.y+(bottom.y-top.y)*v};
}

function cellQuad(q,u0,v0,u1,v1,inset){
  var c=[
    bilerp(q,u0,v0),
    bilerp(q,u1,v0),
    bilerp(q,u1,v1),
    bilerp(q,u0,v1)
  ];
  if(inset<=0)return c;
  var cx=(c[0].x+c[1].x+c[2].x+c[3].x)/4;
  var cy=(c[0].y+c[1].y+c[2].y+c[3].y)/4;
  var k=Math.max(0,1-inset);
  return c.map(function(p){return {x:cx+(p.x-cx)*k,y:cy+(p.y-cy)*k};});
}

function affineFromTriangles(s,d){
  var x1=s[0].x,y1=s[0].y,x2=s[1].x,y2=s[1].y,x3=s[2].x,y3=s[2].y;
  var X1=d[0].x,Y1=d[0].y,X2=d[1].x,Y2=d[1].y,X3=d[2].x,Y3=d[2].y;
  var den=x1*(y2-y3)+x2*(y3-y1)+x3*(y1-y2);
  if(Math.abs(den)<1e-8)return null;
  return {
    a:(X1*(y2-y3)+X2*(y3-y1)+X3*(y1-y2))/den,
    c:(X1*(x3-x2)+X2*(x1-x3)+X3*(x2-x1))/den,
    e:(X1*(x2*y3-x3*y2)+X2*(x3*y1-x1*y3)+X3*(x1*y2-x2*y1))/den,
    b:(Y1*(y2-y3)+Y2*(y3-y1)+Y3*(y1-y2))/den,
    d:(Y1*(x3-x2)+Y2*(x1-x3)+Y3*(x2-x1))/den,
    f:(Y1*(x2*y3-x3*y2)+Y2*(x3*y1-x1*y3)+Y3*(x1*y2-x2*y1))/den
  };
}

function drawTriangle(img,s,d){
  var m=affineFromTriangles(s,d);
  if(!m)return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d[0].x,d[0].y);
  ctx.lineTo(d[1].x,d[1].y);
  ctx.lineTo(d[2].x,d[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(m.a,m.b,m.c,m.d,m.e,m.f);
  ctx.drawImage(img,0,0);
  ctx.restore();
}

function drawWarpedCrop(img,sx,sy,sw,sh,dq,steps){
  steps=steps||4;
  for(var y=0;y<steps;y++){
    for(var x=0;x<steps;x++){
      var u0=x/steps,v0=y/steps,u1=(x+1)/steps,v1=(y+1)/steps;
      var s00={x:sx+sw*u0,y:sy+sh*v0};
      var s10={x:sx+sw*u1,y:sy+sh*v0};
      var s11={x:sx+sw*u1,y:sy+sh*v1};
      var s01={x:sx+sw*u0,y:sy+sh*v1};
      var d00=bilerp(dq,u0,v0);
      var d10=bilerp(dq,u1,v0);
      var d11=bilerp(dq,u1,v1);
      var d01=bilerp(dq,u0,v1);
      drawTriangle(img,[s00,s10,s11],[d00,d10,d11]);
      drawTriangle(img,[s00,s11,s01],[d00,d11,d01]);
    }
  }
}

function drawArtwork(){
  if(!roomReady||!artReady||quad.length!==4)return;
  var n=parseInt(gridSelect.value,10)||1;
  var gap=parseFloat(gapRange.value)||0;
  var inset=(gap/100)*1.8;
  ctx.save();
  ctx.globalAlpha=(parseFloat(opacityRange.value)||100)/100;
  for(var row=0;row<n;row++){
    for(var col=0;col<n;col++){
      var u0=col/n,v0=row/n,u1=(col+1)/n,v1=(row+1)/n;
      var q=cellQuad(quad,u0,v0,u1,v1,inset);
      var sx=art.naturalWidth*u0;
      var sy=art.naturalHeight*v0;
      var sw=art.naturalWidth/n;
      var sh=art.naturalHeight/n;
      drawWarpedCrop(art,sx,sy,sw,sh,q,n===1?10:4);
    }
  }
  ctx.restore();
}

function drawHandles(){
  if(!roomReady)return;
  ctx.save();
  ctx.lineWidth=Math.max(2,canvas.width/700);
  ctx.strokeStyle='rgba(255,79,31,.95)';
  ctx.setLineDash([12,8]);
  ctx.beginPath();
  ctx.moveTo(quad[0].x,quad[0].y);
  for(var i=1;i<4;i++)ctx.lineTo(quad[i].x,quad[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  quad.forEach(function(p,i){
    ctx.beginPath();
    ctx.arc(p.x,p.y,handleRadius*(canvas.width/900),0,Math.PI*2);
    ctx.fillStyle=i===active?'#d8ff35':'#ff4f1f';
    ctx.fill();
    ctx.lineWidth=2;
    ctx.strokeStyle='#fff';
    ctx.stroke();
  });
  ctx.restore();
}

function draw(){
  if(!roomReady){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    return;
  }
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(room,0,0,canvas.width,canvas.height);
  drawArtwork();
  drawHandles();
}

function eventPoint(e){
  var r=canvas.getBoundingClientRect();
  return {
    x:(e.clientX-r.left)*(canvas.width/r.width),
    y:(e.clientY-r.top)*(canvas.height/r.height)
  };
}

canvas.addEventListener('pointerdown',function(e){
  if(!roomReady)return;
  var p=eventPoint(e);
  var rr=handleRadius*(canvas.width/900)*2.2;
  active=-1;
  for(var i=0;i<quad.length;i++){
    var dx=p.x-quad[i].x,dy=p.y-quad[i].y;
    if(dx*dx+dy*dy<=rr*rr){active=i;break;}
  }
  if(active>=0){
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    draw();
  }
});

canvas.addEventListener('pointermove',function(e){
  if(active<0)return;
  var p=eventPoint(e);
  quad[active].x=Math.max(0,Math.min(canvas.width,p.x));
  quad[active].y=Math.max(0,Math.min(canvas.height,p.y));
  draw();
});

function endPointer(){
  if(active<0)return;
  active=-1;
  draw();
}
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);

downloadBtn.addEventListener('click',function(){
  if(!roomReady)return;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(room,0,0,canvas.width,canvas.height);
  drawArtwork();
  var a=document.createElement('a');
  a.download='emvy-room-preview.png';
  a.href=canvas.toDataURL('image/png');
  a.click();
  draw();
});

loadArt(artSelect.value);
})();