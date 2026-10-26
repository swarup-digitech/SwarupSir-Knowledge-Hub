/* Swarup Sir's Knowledge Hub — OMR engine (V17)
 * Pure JavaScript, no libraries. Works in the browser and in Node (for tests).
 *
 *   sheetHtml(opts)      printable A4 OMR answer sheet for one student
 *   locateSheet(...)     finds the 4 corner marks in a photo/scan, straightens it, reads the sheet code
 *   readAnswers(...)     reads the A-D bubbles of a straightened sheet, with a flag for doubtful rows
 *   reportHtml(data)     printable result report (used for teachers and for students)
 *
 * Sheet geometry is fixed in millimetres on A4 (210 x 297). The 4 black corner squares let the
 * scanner undo tilt, perspective and scale, so the sheet may be photographed from a phone, held at
 * any rotation, and printed at any scale.
 */
(function(root){
'use strict';

/* ================================ geometry ================================ */
const PAGE={w:210,h:297};
const MARK_SIZE=8;                                            // corner square, mm
const MARKS=[[12,12],[198,12],[198,285],[12,285]];            // centres: TL, TR, BR, BL (clockwise)
// Two sheet formats. 'full' = one A4 sheet (up to 100 questions). 'half' = a 210 x 140 mm sheet, two on one
// A4 page (cut along the dashed line), up to 40 questions. Both carry the same code strip and corner squares.
const FORMATS={
  full:{key:'full',h:297,marks:MARKS,top:70,bottom:272,maxQ:100},
  half:{key:'half',h:140,marks:[[12,12],[198,12],[198,128],[12,128]],top:53,bottom:125,maxQ:40}
};
const HALF_SLOT=148.5;                                         // height of one half on the A4 page
const fmtOf=f=>(f&&typeof f==='object')?f:(FORMATS[f]||FORMATS.full);
const CODE={bits:48,cellW:3.4,cellH:4.4,y:22,prefix:0xA5,prefixHalf:0x5A};   // the first byte also tells the sheet format    // 8 prefix + 24 batch + 8 index + 8 crc
CODE.x0=(PAGE.w-CODE.bits*CODE.cellW)/2;
const BUB={r:2.6,inner:1.9,ring0:3.1,ring1:3.9,dx:8.2,off:13};  // bubble radius, sampling radius, background ring, spacing
const GRID={cols:4,colW:42,x0:21,top:70,bottom:272,maxPitch:9.5,maxQ:100};
const PXMM=4;                                                  // straightened image: 4 px per mm
const CW=PAGE.w*PXMM,CH=PAGE.h*PXMM;
const cwOf=f=>PAGE.w*PXMM,chOf=f=>fmtOf(f).h*PXMM;
const FILLED=0.45,FAINT=0.18;                                  // share of dark pixels inside a bubble

function layout(N,format){
  const F=fmtOf(format);
  N=Math.floor(N);
  if(!(N>=1&&N<=F.maxQ))throw new Error('An OMR sheet of this size holds 1 to '+F.maxQ+' questions.');
  const rows=Math.ceil(N/GRID.cols);
  const pitch=Math.min(GRID.maxPitch,(F.bottom-F.top)/rows);
  const out=[];
  for(let q=0;q<N;q++){
    const col=Math.floor(q/rows),r=q%rows,cx=GRID.x0+col*GRID.colW,y=F.top+(r+0.5)*pitch;
    out.push({q:q+1,col,row:r,numX:cx+9,y,x:[0,1,2,3].map(i=>cx+BUB.off+i*BUB.dx)});
  }
  return {N,rows,pitch,items:out,F};
}

/* ============================ sheet code (48 bits) ============================ */
function hash24(str){                       // FNV-1a, folded to 24 bits
  let h=0x811c9dc5;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
  return ((h>>>24)^h)&0xFFFFFF;
}
function crc8(bytes){
  let c=0;
  for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c&0x80)?((c<<1)^0x07)&0xFF:(c<<1)&0xFF;}
  return c;
}
function encodeCode(hash,idx,format){
  const b=[fmtOf(format).key==='half'?CODE.prefixHalf:CODE.prefix,(hash>>>16)&255,(hash>>>8)&255,hash&255,idx&255];
  b.push(crc8(b.slice(1)));
  const bits=[];b.forEach(v=>{for(let i=7;i>=0;i--)bits.push((v>>i)&1);});
  return bits;
}
function decodeCode(bits){
  if(!bits||bits.length!==CODE.bits)return null;
  const b=[];for(let i=0;i<6;i++){let v=0;for(let k=0;k<8;k++)v=(v<<1)|(bits[i*8+k]?1:0);b.push(v);}
  if(b[0]!==CODE.prefix&&b[0]!==CODE.prefixHalf)return null;
  if(crc8(b.slice(1,5))!==b[5])return null;
  return {hash:(b[1]<<16)|(b[2]<<8)|b[3],idx:b[4],fmt:b[0]===CODE.prefixHalf?'half':'full'};
}

/* ================================== sheet HTML ================================== */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const mm=n=>(Math.round(n*100)/100)+'mm';
const box=(x,y,w,h,style,inner)=>`<div style="position:absolute;left:${mm(x)};top:${mm(y)};width:${mm(w)};height:${mm(h)};${style||''}">${inner||''}</div>`;

// opts: {title,name,roll,className,serial,hash,idx,N,note,format:'full'|'half', fill?:[{opt,style}] (tests only)}
function sheetHtml(o){
  const F=fmtOf(o.format),half=F.key==='half';
  const L=layout(o.N,F),bits=encodeCode(o.hash>>>0,o.idx,F);
  const p=[];
  F.marks.forEach(c=>p.push(box(c[0]-MARK_SIZE/2,c[1]-MARK_SIZE/2,MARK_SIZE,MARK_SIZE,'background:#000')));
  bits.forEach((b,i)=>p.push(box(CODE.x0+i*CODE.cellW,CODE.y-CODE.cellH/2,CODE.cellW,CODE.cellH,b?'background:#000':'box-sizing:border-box;border:0.25mm solid #000')));
  if(half){
    p.push(box(20,25.2,170,4.6,'font:700 4mm Arial,sans-serif;text-align:center',"SWARUP SIR'S KNOWLEDGE HUB — OMR ANSWER SHEET"));
    p.push(box(20,30.2,170,4,'font:600 3.2mm Arial,sans-serif;text-align:center',esc(o.title||'')));
    p.push(box(20,34.8,105,5.4,'font:700 4.2mm Arial,sans-serif','Name: '+esc(o.name||'')));
    p.push(box(125,34.8,65,5.4,'font:700 4.2mm Arial,sans-serif;text-align:right','Roll No.: '+esc(o.roll||'')));
    p.push(box(20,40.6,170,3.6,'font:2.8mm Arial,sans-serif;color:#333',esc(o.className||'')+(o.className&&o.note?' · ':'')+esc(o.note||'')));
    p.push(box(20,44.2,170,3.4,'font:2.5mm Arial,sans-serif;color:#222','Use a dark pen or pencil. Fill ONE circle completely for each question. Do not write inside the black squares or on the code.'));
  }else{
    p.push(box(20,26.5,170,5,'font:600 3mm Arial,sans-serif;text-align:center;color:#444','Sheet code · '+esc(o.serial||'')));
    p.push(box(20,32,170,7,'font:700 5.2mm Arial,sans-serif;text-align:center',"SWARUP SIR'S KNOWLEDGE HUB — OMR ANSWER SHEET"));
    p.push(box(20,40,170,5,'font:600 3.6mm Arial,sans-serif;text-align:center',esc(o.title||'')));
    p.push(box(20,47.5,100,6,'font:700 4.4mm Arial,sans-serif','Name: '+esc(o.name||'')));
    p.push(box(125,47.5,65,6,'font:700 4.4mm Arial,sans-serif;text-align:right','Roll No.: '+esc(o.roll||'')));
    p.push(box(20,54,170,4.5,'font:3mm Arial,sans-serif;color:#333',esc(o.className||'')+(o.className&&o.note?' · ':'')+esc(o.note||'')));
    p.push(box(20,59,170,5,'font:2.8mm Arial,sans-serif;color:#222','Use a dark pen or pencil. Fill ONE circle completely for each question. Do not write inside the black squares or on the code. Keep the sheet flat; do not fold it.'));
  }
  for(let c=0;c<GRID.cols;c++){
    const first=L.items.find(i=>i.col===c);if(!first)continue;
    ['A','B','C','D'].forEach((ch,i)=>p.push(box(first.x[i]-2.5,F.top-4.6,5,3.4,'font:700 2.8mm Arial,sans-serif;text-align:center;line-height:3.4mm',ch)));
  }
  const fillOf=q=>(o.fill&&o.fill[q-1])||null;
  L.items.forEach(it=>{
    p.push(box(it.numX-8,it.y-2,8,4,'font:700 3.2mm Arial,sans-serif;text-align:right;line-height:4mm',String(it.q)));
    ['A','B','C','D'].forEach((ch,i)=>{
      p.push(box(it.x[i]-BUB.r,it.y-BUB.r,BUB.r*2,BUB.r*2,'box-sizing:border-box;border:0.3mm solid #000;border-radius:50%'));
    });
    const f=fillOf(it.q);
    if(f){(Array.isArray(f)?f:[f]).forEach(m=>{const i='ABCD'.indexOf(m.opt);if(i<0)return;
      const rad=m.r||({full:2.4,light:2.3,partial:1.5,tick:0.9,dot:0.8}[m.style||'full']);
      const col=m.color||({full:'#101040',light:'#8a8a8a',partial:'#101040',tick:'#101040',dot:'#202020'}[m.style||'full']);
      p.push(box(it.x[i]-rad+(m.dx||0),it.y-rad+(m.dy||0),rad*2,rad*2,`background:${col};border-radius:50%`));});}
  });
  const foot=esc(o.serial||'')+' · '+L.N+' questions';
  if(half){
    p.push(box(20,126.4,170,3.2,'font:2.4mm Arial,sans-serif;color:#666;text-align:center',foot));
    return `<div class="omr-half" style="position:relative;width:210mm;height:${HALF_SLOT}mm;overflow:hidden;background:#fff">${p.join('')}</div>`;
  }
  p.push(box(20,278,170,4,'font:2.6mm Arial,sans-serif;color:#666;text-align:center',foot));
  return `<div class="omr-sheet" style="position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page">${p.join('')}</div>`;
}
// Half-size sheets are put two to an A4 page with a cut line between them; full sheets are one per page.
function sheetDoc(title,sheets){
  const out=[];let pend=[];
  const flush=()=>{if(!pend.length)return;
    out.push(`<div class="omr-sheet" style="position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page">${pend[0]}${pend[1]?`<div style="position:absolute;left:0;top:${HALF_SLOT}mm;width:210mm;height:${HALF_SLOT}mm;overflow:hidden">${pend[1]}</div>`:''}<div style="position:absolute;left:0;right:0;top:${HALF_SLOT}mm;border-top:0.3mm dashed #777"></div><div style="position:absolute;left:0;right:0;top:${HALF_SLOT-3.2}mm;text-align:center;font:2.4mm Arial,sans-serif;color:#777;line-height:3mm">✂ cut / tear along this line</div></div>`);pend=[];};
  sheets.forEach(h=>{
    if(/class="omr-half"/.test(h)){pend.push(h);if(pend.length===2)flush();}
    else{flush();out.push(h);}
  });
  flush();
  const banner='<div class="omr-banner"><b>OMR answer sheets</b><span>Print on plain white A4 paper: <b>Scale 100%</b>, <b>Margins: None</b>, tick <b>Background graphics</b>. Use a laser/inkjet at normal quality.</span><button onclick="window.print()">🖨 Print / Save as PDF</button></div>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 portrait;margin:0}html,body{margin:0;padding:0;background:#fff}.omr-sheet:last-child{page-break-after:auto;break-after:auto}.omr-banner{font:13px/1.4 Arial,sans-serif;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.omr-banner button{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}@media print{.omr-banner{display:none!important}}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${banner}${out.join('')}</body></html>`;
}

/* ================================ image helpers ================================ */
function toGray(rgba,w,h){
  const g=new Uint8ClampedArray(w*h);
  for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=(rgba[j]*299+rgba[j+1]*587+rgba[j+2]*114)/1000;
  return g;
}
// Box-filter shrink so the longest side is at most maxSide.
function shrink(gray,w,h,maxSide){
  const s=Math.max(w,h)/maxSide;
  if(s<=1)return {gray,w,h,scale:1};
  const nw=Math.round(w/s),nh=Math.round(h/s),out=new Uint8ClampedArray(nw*nh);
  for(let y=0;y<nh;y++){
    const y0=Math.floor(y*s),y1=Math.max(y0+1,Math.min(h,Math.floor((y+1)*s)));
    for(let x=0;x<nw;x++){
      const x0=Math.floor(x*s),x1=Math.max(x0+1,Math.min(w,Math.floor((x+1)*s)));
      let t=0,n=0;for(let yy=y0;yy<y1;yy++){const r=yy*w;for(let xx=x0;xx<x1;xx++){t+=gray[r+xx];n++;}}
      out[y*nw+x]=t/n;
    }
  }
  return {gray:out,w:nw,h:nh,scale:s};
}
function binarize(gray,w,h){
  const win=Math.max(15,(Math.round(Math.max(w,h)/10))|1),half=win>>1;
  const I=new Uint32Array((w+1)*(h+1));
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=gray[y*w+x];I[(y+1)*(w+1)+x+1]=I[y*(w+1)+x+1]+row;}}
  const dark=new Uint8Array(w*h);
  for(let y=0;y<h;y++){
    const y0=Math.max(0,y-half),y1=Math.min(h,y+half+1);
    for(let x=0;x<w;x++){
      const x0=Math.max(0,x-half),x1=Math.min(w,x+half+1);
      const sum=I[y1*(w+1)+x1]-I[y0*(w+1)+x1]-I[y1*(w+1)+x0]+I[y0*(w+1)+x0];
      const mean=sum/((x1-x0)*(y1-y0)),g=gray[y*w+x];
      dark[y*w+x]=(g<mean*0.68&&g<150)?1:0;
    }
  }
  return dark;
}
function components(dark,w,h,minA,maxA){
  const lab=new Int32Array(w*h),stack=new Int32Array(w*h),out=[];let id=0;
  for(let s=0;s<dark.length;s++){
    if(!dark[s]||lab[s])continue;
    id++;let sp=0;stack[sp++]=s;lab[s]=id;
    let area=0,sx=0,sy=0,sxx=0,syy=0,sxy=0,minx=w,maxx=0,miny=h,maxy=0;
    while(sp){
      const p=stack[--sp],x=p%w,y=(p-x)/w;
      area++;sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;
      if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;
      if(x>0&&dark[p-1]&&!lab[p-1]){lab[p-1]=id;stack[sp++]=p-1;}
      if(x<w-1&&dark[p+1]&&!lab[p+1]){lab[p+1]=id;stack[sp++]=p+1;}
      if(y>0&&dark[p-w]&&!lab[p-w]){lab[p-w]=id;stack[sp++]=p-w;}
      if(y<h-1&&dark[p+w]&&!lab[p+w]){lab[p+w]=id;stack[sp++]=p+w;}
    }
    if(area<minA||area>maxA)continue;
    const cx=sx/area,cy=sy/area,vxx=sxx/area-cx*cx,vyy=syy/area-cy*cy,vxy=sxy/area-cx*cy;
    const tr=vxx+vyy,det=vxx*vyy-vxy*vxy,d=Math.sqrt(Math.max(0,tr*tr/4-det));
    const l1=tr/2+d,l2=Math.max(1e-6,tr/2-d);
    out.push({area,cx,cy,minx,maxx,miny,maxy,ecc:Math.sqrt(l1/l2),rect:area/(12*Math.sqrt(l1*l2)),border:(minx<=1||miny<=1||maxx>=w-2||maxy>=h-2)});
  }
  return out;
}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// Find the 4 corner squares: compact, solid, similar-sized blobs forming a page-shaped quadrilateral.
function findMarks(gray,w,h){
  const dark=binarize(gray,w,h);
  const minA=Math.max(30,w*h*0.00012),maxA=w*h*0.03;
  let c=components(dark,w,h,minA,maxA).filter(b=>!b.border&&b.ecc<1.6&&b.rect>0.85&&b.rect<1.2);
  c.sort((a,b)=>b.area-a.area);c=c.slice(0,14);
  const target=(PAGE.w-24)/(PAGE.h-24);        // width/height of the mark rectangle = 186/273
  let best=null;
  for(let a=0;a<c.length;a++)for(let b=a+1;b<c.length;b++)for(let d=b+1;d<c.length;d++)for(let e=d+1;e<c.length;e++){
    const q=[c[a],c[b],c[d],c[e]];
    const amax=Math.max(...q.map(z=>z.area)),amin=Math.min(...q.map(z=>z.area));
    if(amax/amin>1.9)continue;
    const mx=q.reduce((t,z)=>t+z.cx,0)/4,my=q.reduce((t,z)=>t+z.cy,0)/4;
    q.sort((u,v)=>Math.atan2(u.cy-my,u.cx-mx)-Math.atan2(v.cy-my,v.cx-mx));
    const pts=q.map(z=>[z.cx,z.cy]);
    const s01=dist(pts[0],pts[1]),s12=dist(pts[1],pts[2]),s23=dist(pts[2],pts[3]),s30=dist(pts[3],pts[0]);
    const r=((s01+s23)/2)/((s12+s30)/2);
    const err=Math.min(Math.abs(Math.log(r/target)),Math.abs(Math.log(r*target)));
    // convex quadrilateral
    let ok=true,sign=0;
    for(let i=0;i<4;i++){const p0=pts[i],p1=pts[(i+1)%4],p2=pts[(i+2)%4];const cr=(p1[0]-p0[0])*(p2[1]-p1[1])-(p1[1]-p0[1])*(p2[0]-p1[0]);if(!sign)sign=Math.sign(cr);else if(Math.sign(cr)!==sign)ok=false;}
    if(!ok)continue;
    // the corner squares are the biggest compact blobs, so among page-shaped quadrilaterals prefer the largest
    const sc=-q.reduce((t,z)=>t+z.area,0)*(1-Math.min(0.5,err));
    if(err<0.30&&(!best||sc<best.sc))best={sc,pts};
  }
  return best?best.pts:null;
}
function solveHomography(src,dst){            // src[i] (page mm) -> dst[i] (image px)
  const A=[],b=[];
  for(let i=0;i<4;i++){
    const [x,y]=src[i],[u,v]=dst[i];
    A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);
    A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);
  }
  const n=8;
  for(let i=0;i<n;i++){
    let m=i;for(let r=i+1;r<n;r++)if(Math.abs(A[r][i])>Math.abs(A[m][i]))m=r;
    [A[i],A[m]]=[A[m],A[i]];[b[i],b[m]]=[b[m],b[i]];
    if(Math.abs(A[i][i])<1e-12)return null;
    for(let r=i+1;r<n;r++){const f=A[r][i]/A[i][i];for(let c=i;c<n;c++)A[r][c]-=f*A[i][c];b[r]-=f*b[i];}
  }
  const x=new Array(n);
  for(let i=n-1;i>=0;i--){let s=b[i];for(let c=i+1;c<n;c++)s-=A[i][c]*x[c];x[i]=s/A[i][i];}
  return x;
}
function warp(gray,w,h,H,format){
  const cw=cwOf(format),ch=chOf(format);
  const out=new Uint8ClampedArray(cw*ch);
  for(let Y=0;Y<ch;Y++){
    const y=Y/PXMM;
    for(let X=0;X<cw;X++){
      const x=X/PXMM,den=H[6]*x+H[7]*y+1;
      const u=(H[0]*x+H[1]*y+H[2])/den,v=(H[3]*x+H[4]*y+H[5])/den;
      if(u<0||v<0||u>=w-1||v>=h-1){out[Y*cw+X]=255;continue;}
      const x0=u|0,y0=v|0,fx=u-x0,fy=v-y0,i=y0*w+x0;
      out[Y*cw+X]=(gray[i]*(1-fx)+gray[i+1]*fx)*(1-fy)+(gray[i+w]*(1-fx)+gray[i+w+1]*fx)*fy;
    }
  }
  return out;
}
function discStats(img,cx,cy,r,cw,ch){          // pixel values inside a disc
  cw=cw||CW;ch=ch||CH;
  const x0=Math.max(0,Math.floor(cx-r)),x1=Math.min(cw-1,Math.ceil(cx+r)),y0=Math.max(0,Math.floor(cy-r)),y1=Math.min(ch-1,Math.ceil(cy+r));
  const vals=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(Math.hypot(x-cx,y-cy)<=r)vals.push(img[y*cw+x]);
  return vals;
}
function ringVals(img,cx,cy,r0,r1,cw,ch){
  cw=cw||CW;ch=ch||CH;
  const x0=Math.max(0,Math.floor(cx-r1)),x1=Math.min(cw-1,Math.ceil(cx+r1)),y0=Math.max(0,Math.floor(cy-r1)),y1=Math.min(ch-1,Math.ceil(cy+r1));
  const vals=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x-cx,y-cy);if(d>=r0&&d<=r1)vals.push(img[y*cw+x]);}
  return vals;
}
// Read the 48-bit code straight from the photo through a homography (no full warp needed).
function readCodeH(gray,w,h,H,fmtKey){
  const cells=[];
  for(let i=0;i<CODE.bits;i++){
    const mx=CODE.x0+(i+0.5)*CODE.cellW;let t=0,n=0;
    for(let dy=-0.8;dy<=0.81;dy+=0.4)for(let dx=-0.8;dx<=0.81;dx+=0.4){
      if(dx*dx+dy*dy>0.8)continue;
      const x=mx+dx,y=CODE.y+dy,den=H[6]*x+H[7]*y+1;
      const u=(H[0]*x+H[1]*y+H[2])/den,v=(H[3]*x+H[4]*y+H[5])/den;
      if(u<0||v<0||u>=w-1||v>=h-1)continue;
      const x0=u|0,y0=v|0,fx=u-x0,fy=v-y0,k=y0*w+x0;
      t+=(gray[k]*(1-fx)+gray[k+1]*fx)*(1-fy)+(gray[k+w]*(1-fx)+gray[k+w+1]*fx)*fy;n++;
    }
    if(!n)return null;
    cells.push(t/n);
  }
  const s=[...cells].sort((a,b)=>a-b),lo=s[Math.floor(s.length*0.1)],hi=s[Math.floor(s.length*0.9)];
  if(hi-lo<60)return null;
  const thr=(lo+hi)/2;
  const c=decodeCode(cells.map(v=>v<thr?1:0));
  return c&&(!fmtKey||c.fmt===fmtKey)?c:null;      // a half-sheet code under a full-sheet hypothesis (or the reverse) is rejected
}

// Candidate corner-square quadrilaterals (page-shaped, for either sheet format), best first.
function quadCandidates(gray,w,h){
  const dark=binarize(gray,w,h);
  const minA=Math.max(30,w*h*0.00012),maxA=w*h*0.03;
  let c=components(dark,w,h,minA,maxA).filter(b=>!b.border&&b.ecc<1.6&&b.rect>0.85&&b.rect<1.2);
  c.sort((a,b)=>b.area-a.area);c=c.slice(0,16);
  const targets=Object.values(FORMATS).map(F=>({F,t:(PAGE.w-24)/(F.h-24)}));
  const out=[];
  for(let a=0;a<c.length;a++)for(let b=a+1;b<c.length;b++)for(let d=b+1;d<c.length;d++)for(let e=d+1;e<c.length;e++){
    const idx=[a,b,d,e],q=idx.map(i=>c[i]);
    const amax=Math.max(...q.map(z=>z.area)),amin=Math.min(...q.map(z=>z.area));
    if(amax/amin>2.8)continue;
    const mx=q.reduce((t,z)=>t+z.cx,0)/4,my=q.reduce((t,z)=>t+z.cy,0)/4;
    const order=q.map((z,i)=>({z,i:idx[i]})).sort((u,v)=>Math.atan2(u.z.cy-my,u.z.cx-mx)-Math.atan2(v.z.cy-my,v.z.cx-mx));
    const pts=order.map(o=>[o.z.cx,o.z.cy]),ids=order.map(o=>o.i);
    const s01=dist(pts[0],pts[1]),s12=dist(pts[1],pts[2]),s23=dist(pts[2],pts[3]),s30=dist(pts[3],pts[0]);
    const r=((s01+s23)/2)/((s12+s30)/2);
    let ok=true,sign=0;
    for(let i=0;i<4;i++){const p0=pts[i],p1=pts[(i+1)%4],p2=pts[(i+2)%4];const cr=(p1[0]-p0[0])*(p2[1]-p1[1])-(p1[1]-p0[1])*(p2[0]-p1[0]);if(!sign)sign=Math.sign(cr);else if(Math.sign(cr)!==sign)ok=false;}
    if(!ok)continue;
    const fm=targets.map(T=>({F:T.F,err:Math.min(Math.abs(Math.log(r/T.t)),Math.abs(Math.log(r*T.t)))})).filter(x=>x.err<0.30).sort((u,v)=>u.err-v.err);
    if(!fm.length)continue;
    const area=q.reduce((t,z)=>t+z.area,0);
    out.push({pts,ids,fm,sc:-area*(1-Math.min(0.5,fm[0].err))});
  }
  out.sort((u,v)=>u.sc-v.sc);
  return out;
}

/* Find every sheet in a grayscale picture (one sheet, a torn half, or a whole page holding two halves),
 * straighten each and read its code. Returns {ok:true, sheets:[{canon,code,fmt,rotation,H}], ...first sheet's fields}
 * or {ok:false, reason, message}. */
function locateSheet(gray,w,h){
  const sm=shrink(gray,w,h,1500);
  const cands=quadCandidates(sm.gray,sm.w,sm.h);
  if(!cands.length)return {ok:false,reason:'corners',message:'The four black corner squares were not found. Photograph the whole sheet, flat and well lit, with all four corners visible.'};
  const work=shrink(gray,w,h,2400),k=sm.scale/work.scale;      // preview coordinates -> working-image coordinates
  const used=new Set(),found=[];
  for(const cd of cands.slice(0,80)){
    if(cd.ids.some(i=>used.has(i)))continue;
    const wp=cd.pts.map(p=>[p[0]*k,p[1]*k]);
    let hit=null;
    for(const f of cd.fm){
      for(let s=0;s<4&&!hit;s++){
        const dst=[0,1,2,3].map(i=>wp[(i+s)%4]);
        const H=solveHomography(f.F.marks,dst);if(!H)continue;
        const code=readCodeH(work.gray,work.w,work.h,H,f.F.key);
        if(code)hit={F:f.F,H,code,rotation:s*90};
      }
      if(hit)break;
    }
    if(hit){
      cd.ids.forEach(i=>used.add(i));
      found.push({canon:warp(work.gray,work.w,work.h,hit.H,hit.F),code:hit.code,fmt:hit.F.key,rotation:hit.rotation,H:hit.H});
    }
  }
  if(!found.length)return {ok:false,reason:'code',message:'The sheet code (the row of small black boxes under the top squares) could not be read. Check that all four black corner squares are inside the photo, the sheet is flat and the light is even, then retake it — or choose the student yourself.'};
  return Object.assign({ok:true,sheets:found},found[0]);
}
// Same as locateSheet but the code is not needed (teacher picked the student). Tries the 4 turns (and both
// sheet sizes unless one is given) and keeps the one where the answer grid looks most like a printed grid.
function straightenWithoutCode(gray,w,h,N,format){
  const sm=shrink(gray,w,h,1500);const cands=quadCandidates(sm.gray,sm.w,sm.h);if(!cands.length)return null;
  const forms=(format?[fmtOf(format)]:Object.values(FORMATS)).filter(F=>N<=F.maxQ);let best=null;
  for(const F of forms){
    const cd=cands.find(c=>c.fm.some(x=>x.F.key===F.key));if(!cd)continue;
    const wp=cd.pts.map(p=>[p[0]*sm.scale,p[1]*sm.scale]),L=layout(N,F),cw=cwOf(F),ch=chOf(F);
    for(let s=0;s<4;s++){
      const H=solveHomography(F.marks,[0,1,2,3].map(i=>wp[(i+s)%4]));if(!H)continue;
      const canon=warp(gray,w,h,H,F);let score=0,n=0;
      L.items.slice(0,40).forEach(it=>{const v=ringVals(canon,it.x[0]*PXMM,it.y*PXMM,(BUB.r-0.15)*PXMM,(BUB.r+0.15)*PXMM,cw,ch);score+=255-v.reduce((a,b)=>a+b,0)/Math.max(1,v.length);n++;});
      score/=Math.max(1,n);
      if(!best||score>best.score)best={score,canon,H,rotation:s*90,fmt:F.key};
    }
  }
  return best;
}

/* Read the answers of a straightened sheet.  Each question: {q, ans, f:[A,B,C,D shares], flag} */
function readAnswers(canon,N,format){
  const L=layout(N,format),cw=cwOf(format),ch=chOf(format),res=[];let paper=[];
  L.items.forEach(it=>{
    const f=[],ps=[];
    for(let i=0;i<4;i++){
      const cx=it.x[i]*PXMM,cy=it.y*PXMM;
      const ring=ringVals(canon,cx,cy,BUB.ring0*PXMM,BUB.ring1*PXMM,cw,ch).sort((a,b)=>a-b);
      const P=ring.length?ring[Math.floor(ring.length*0.75)]:230;ps.push(P);
      const inner=discStats(canon,cx,cy,BUB.inner*PXMM,cw,ch);
      const thr=0.70*Math.max(P,60);
      f.push(inner.length?inner.filter(v=>v<thr).length/inner.length:0);
    }
    paper.push(...ps);
    const filled=[];f.forEach((v,i)=>{if(v>=FILLED)filled.push(i);});
    let ans='',flag='';
    if(filled.length===1){
      ans='ABCD'[filled[0]];
      const other=Math.max(...f.filter((v,i)=>i!==filled[0]));
      if(other>=0.30)flag='check';
    }else if(filled.length>=2){
      ans=filled.map(i=>'ABCD'[i]).join(', ');flag='multiple';
    }else{
      const mx=Math.max(...f);
      if(mx>=FAINT){ans='ABCD'[f.indexOf(mx)];flag='faint';}
    }
    res.push({q:it.q,ans,f:f.map(v=>Math.round(v*100)/100),flag});
  });
  paper.sort((a,b)=>a-b);
  return {answers:res,paperLevel:paper[Math.floor(paper.length/2)]||0};
}
// A 2nd opinion on cropped rows for the review screen: returns the sub-image of one question row.
function rowCrop(canon,N,q,format){
  const it=layout(N,format).items[q-1],cw=cwOf(format),ch=chOf(format);
  const x0=Math.max(0,Math.round((it.numX-9)*PXMM)),x1=Math.min(cw,Math.round((it.x[3]+4)*PXMM));
  const y0=Math.max(0,Math.round((it.y-4.5)*PXMM)),y1=Math.min(ch,Math.round((it.y+4.5)*PXMM));
  const w=x1-x0,h=y1-y0,out=new Uint8ClampedArray(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)out[y*w+x]=canon[(y0+y)*cw+x0+x];
  return {gray:out,w,h};
}

/* ================================== result report ================================== */
// data: {title,subject,studentName,rollNo,date,total,correct,rows:[{no,selected,correct_option,is_correct,q:{...}}],fmt?:fn, label?:fn}
// Plain-text version of simple LaTeX, used only if the maths library cannot be loaded (e.g. no internet).
function plainTeX(t){
  return String(t||'').replace(/\\text\s*\{\s*\\(?:rupee|Rupee|inr|INR)\s*\}/g,'₹').replace(/\\(?:rupee|Rupee|inr|INR)(?![A-Za-z])\s?/g,'₹').replace(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([^$]+)\$/g,(m,a,b,c,d)=>{
    let x=a||b||c||d||'';
    for(let k=0;k<4;k++)x=x.replace(/\\(?:text|mathrm|textbf|mathbf)\{([^{}]*)\}/g,'$1').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g,'($1)/($2)').replace(/\\sqrt\{([^{}]*)\}/g,'√($1)');
    const sup={0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹'};
    x=x.replace(/\^\{?(\d)\}?/g,(q,n)=>sup[n]).replace(/\^\{([^{}]*)\}/g,'^($1)').replace(/_\{([^{}]*)\}/g,'_$1')
       .replace(/\\times/g,'×').replace(/\\div/g,'÷').replace(/\\cdot/g,'·').replace(/\\pi/g,'π').replace(/\\circ/g,'°').replace(/\\degree/g,'°')
       .replace(/\\(?:le|leq)\b/g,'≤').replace(/\\(?:ge|geq)\b/g,'≥').replace(/\\neq/g,'≠').replace(/\\approx/g,'≈').replace(/\\pm/g,'±')
       .replace(/\\(?:left|right)/g,'').replace(/\\[,;: !]/g,' ').replace(/\\%/g,'%').replace(/[{}]/g,'').replace(/\\([A-Za-z]+)/g,'$1');
    return x;
  });
}
const SUBJECT_LABEL={MAT:'Mental Ability (MAT)',ARITHMETIC:'Arithmetic',EVS:'Environmental Studies (EVS)',LANGUAGE:'Language'};
// Report content for one student (no <html> wrapper).
function reportParts(d){
  const fmt=typeof d.fmt==='function'?d.fmt:esc;
  const rows=d.rows||[];
  const total=d.total||rows.length,correct=d.correct!=null?d.correct:rows.filter(r=>r.is_correct).length;
  const pct=total?Math.round(correct*100/total):0;
  const wrong=rows.filter(r=>!r.is_correct);
  const blank=rows.filter(r=>!String(r.selected||'').trim()).length;
  // Subject -> part (MAT, EVS ...) or lesson/chapter -> topics
  const paperSubject=SUBJECT_LABEL[String(d.subject||'').toUpperCase()]||String(d.subject||'').trim()||'Questions';
  const subjects=new Map();
  rows.forEach(r=>{
    const q=r.q||{};
    const sName=String(q.subject_name||'').trim()||paperSubject;
    const sub=String(q._partHeading||'').trim()||String(q.lesson_name||'').trim()||String(q.topic||'').trim()||'General';
    const topic=String(q.topic||'').trim();
    if(!subjects.has(sName))subjects.set(sName,{t:0,c:0,subs:new Map()});
    const S=subjects.get(sName);S.t++;if(r.is_correct)S.c++;
    if(!S.subs.has(sub))S.subs.set(sub,{t:0,c:0,topics:new Map()});
    const U=S.subs.get(sub);U.t++;if(r.is_correct)U.c++;
    if(topic&&topic!==sub){const T=U.topics.get(topic)||{t:0,c:0};T.t++;if(r.is_correct)T.c++;U.topics.set(topic,T);}
  });
  const pc=(c,t)=>t?Math.round(c*100/t)+'%':'–';
  const bar=(c,t)=>{const v=t?Math.round(c*100/t):0;return `<span class="bar"><i style="width:${v}%;background:${v>=75?'#16a34a':v>=50?'#f59e0b':'#dc2626'}"></i></span>`;};
  let perf='';
  subjects.forEach((S,name)=>{
    perf+=`<tr class="sj"><td>${esc(name)}</td><td>${S.c}</td><td>${S.t}</td><td>${pc(S.c,S.t)} ${bar(S.c,S.t)}</td></tr>`;
    S.subs.forEach((U,sub)=>{
      const tl=[...U.topics].map(([n,T])=>`${esc(n)} (${T.c}/${T.t})`);
      perf+=`<tr><td class="ind">${esc(sub)}${tl.length?`<div class="small">${tl.slice(0,6).join(' · ')}${tl.length>6?' · +'+(tl.length-6)+' more':''}</div>`:''}</td><td>${U.c}</td><td>${U.t}</td><td>${pc(U.c,U.t)} ${bar(U.c,U.t)}</td></tr>`;
    });
  });
  const qBlock=r=>{
    const q=r.q||{};
    // V20: Assamese questions show the Assamese explanation (English if none yet);
    // Common (MAT) questions show both, so every medium gets one.
    const en=String(q.explanation||'').trim(),as=String(q.explanation_as||'').trim(),lang=String(q.language||'').toUpperCase();
    const ex=[];
    if(lang==='ASSAMESE'){if(as)ex.push(['ব্যাখ্যা',as]);else if(en)ex.push(['Explanation',en]);}
    else if(lang==='COMMON'){if(en)ex.push(['Explanation',en]);if(as&&as!==en)ex.push(['ব্যাখ্যা',as]);}
    else if(en)ex.push(['Explanation',en]);
    const text=String(q.question_text||'').trim();
    const realText=text&&!/^\[(?:PDF\/)?IMAGE QUESTION[^\]]*\]$/i.test(text)?text:'';
    const opts=['a','b','c','d'].map((k,i)=>{const v=String(q['option_'+k]||'').trim();return v&&!/^Option [A-D]$/i.test(v)?`<span class="o ${'ABCD'[i]===String(r.correct_option||'').toUpperCase()?'ok':''} ${'ABCD'[i]===String(r.selected||'').toUpperCase()&&!r.is_correct?'bad':''}">${'ABCD'[i]}. ${fmt(v)}</span>`:'';}).join('');
    return `<div class="q"><div class="qn">Q${r.no}</div><div class="qb">${q._passageTitle?`<div class="pt">${esc(q._passageTitle)}</div>`:''}${q.image_url?`<img src="${esc(q.image_url)}" alt="">`:''}${realText?`<div>${fmt(realText)}</div>`:''}${opts?`<div class="opts">${opts}</div>`:''}
      <div class="ans">Your answer: <b class="${r.is_correct?'g':'r'}">${esc(String(r.selected||'').trim()||'— (blank)')}</b> &nbsp; Correct answer: <b class="g">${esc(r.correct_option||'')}</b></div>${ex.map(([l,t])=>`<div class="expl"><b>${l}:</b> ${fmt(t)}</div>`).join('')}</div></div>`;
  };
  const css=`.bar{display:inline-block;width:46px;height:6px;background:#e2e8f0;border-radius:3px;vertical-align:middle;margin-left:6px;overflow:hidden}.bar i{display:block;height:100%}tr.sj td{background:#eef2ff;font-weight:700}td.ind{padding-left:20px}.expl{margin-top:5px;padding:5px 8px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px;font-size:12.5px}*{box-sizing:border-box}body{font:13px/1.45 Arial,sans-serif;color:#111;margin:0}.pg{width:210mm;min-height:297mm;padding:12mm 14mm;margin:0 auto;background:#fff;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}
h1{font-size:18px;margin:0}h2{font-size:14px;margin:16px 0 6px;border-bottom:1px solid #cbd5e1;padding-bottom:3px}.top{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #17365D;padding-bottom:6px;margin-bottom:10px}
.score{display:flex;gap:10px;margin:8px 0}.box{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px;text-align:center}.box b{display:block;font-size:20px}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:4px 7px;text-align:left}th{background:#f1f5f9}
.q{display:flex;gap:8px;border:1px solid #e2e8f0;border-radius:8px;padding:7px;margin:6px 0;break-inside:avoid}.qn{font-weight:700;color:#17365D;min-width:34px}.qb{flex:1}.qb img{max-width:100%;max-height:70mm;display:block;margin:4px 0}.opts{display:flex;flex-wrap:wrap;gap:4px 16px;margin:4px 0}.o.ok{color:#166534;font-weight:700}.o.bad{color:#b91c1c;text-decoration:line-through}.pt{font-weight:700}
.g{color:#166534}.r{color:#b91c1c}.small{font-size:11px;color:#475569}.chips span{display:inline-block;border:1px solid #cbd5e1;border-radius:6px;padding:1px 6px;margin:2px;font-size:12px}.chips .w{background:#fee2e2;border-color:#fecaca}.chips .c{background:#dcfce7;border-color:#bbf7d0}`;
  const body=`<div class="pg"><div class="top"><div><h1>SWARUP SIR'S KNOWLEDGE HUB</h1><div class="small">OMR Result Report</div></div><div style="text-align:right"><b>${esc(d.studentName||'')}</b><br><span class="small">Roll No. ${esc(d.rollNo||'')}</span></div></div>
    <div><b>${esc(d.title||'')}</b> <span class="small">${esc(d.subject||'')} ${d.date?'· '+esc(d.date):''}</span></div>
    <div class="score"><div class="box"><b>${correct}/${total}</b>Score</div><div class="box"><b>${pct}%</b>Percentage</div><div class="box"><b class="r">${wrong.length}</b>Mistakes</div><div class="box"><b>${blank}</b>Not attempted</div></div>
    <h2>Performance by subject and topic</h2><table><thead><tr><th>Subject / Part or topic</th><th>Correct</th><th>Total</th><th>%</th></tr></thead><tbody>${perf}</tbody></table>
    <h2>Answer overview</h2><div class="chips">${rows.map(r=>`<span class="${r.is_correct?'c':'w'}">${r.no}. ${esc(String(r.selected||'').trim()||'–')}${r.is_correct?' ✓':' ✗ ('+esc(r.correct_option||'')+')'}</span>`).join('')}</div>
    <p class="small" style="margin-top:12px">Questions you got wrong are saved in your Mistake Bank. They come back in your next personal practice until you answer them correctly twice in a row.</p></div>
    ${wrong.length?`<div class="pg"><h2 style="margin-top:0">Questions to revise (${wrong.length})</h2>${wrong.map(qBlock).join('')}</div>`:''}`;
  return {css,body};
}
// Whole document. The maths (LaTeX) is typeset before the Print button is enabled; if the maths library cannot
// be loaded the formulas are shown as plain readable text instead of raw LaTeX.
function reportShell(title,css,body){
  const PLAIN=plainTeX.toString();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><script>window.MathJax={tex:{macros:{rupee:"\\\\text{₹}",Rupee:"\\\\text{₹}",inr:"\\\\text{₹}"},inlineMath:[["\\\\(","\\\\)"],["$","$"]],displayMath:[["\\\\[","\\\\]"],["$$","$$"]],processEscapes:true},options:{skipHtmlTags:["script","noscript","style","textarea","pre","code"]},startup:{typeset:false}};</script><script async src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js"></script><style>@page{size:A4 portrait;margin:0}${css}.bn{font:13px Arial;background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:10px 14px;display:flex;gap:12px;align-items:center}.bn button{background:#2563eb;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer}.bn button:disabled{background:#94a3b8;cursor:wait}@media print{.bn{display:none!important}}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}mjx-container{font-size:105%}.wm{position:fixed;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:-1;overflow:hidden}.wm .st{transform:rotate(-32deg);text-align:center;color:rgba(23,54,93,.085);font-family:Georgia,'Times New Roman',serif;font-weight:700;border:1.6mm double rgba(23,54,93,.085);border-radius:6mm;padding:7mm 11mm}.wm .a{font-size:17mm;line-height:1.05;letter-spacing:1mm;white-space:nowrap}.wm .b{font-size:8.5mm;line-height:1.2;letter-spacing:3.2mm;margin-top:3mm;padding-top:3mm;border-top:0.8mm solid rgba(23,54,93,.085);white-space:nowrap;font-family:Arial,sans-serif}.wm .c{font:700 8mm/1.2 Arial,sans-serif;letter-spacing:1.6mm;margin-top:3mm;white-space:nowrap}@media screen{.wm .st{zoom:.55}}.pg{background:transparent!important}</style></head><body><div class="wm"><div class="st"><div class="a">SWARUP SIR'S</div><div class="b">KNOWLEDGE HUB</div><div class="c">Ph: 98643-90279</div></div></div><div class="bn"><b>Result report</b><button id="pbtn" disabled onclick="window.print()">Preparing maths…</button></div>${body}<script>
(function(){
  var btn=document.getElementById('pbtn');
  function ready(){btn.disabled=false;btn.textContent='🖨 Print / Save as PDF';}
  var plainTeX=${PLAIN};
  function fallback(){
    var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n,list=[];
    while(n=w.nextNode()){if(n.parentNode&&/^(SCRIPT|STYLE|BUTTON)$/.test(n.parentNode.nodeName))continue;if(/\\\\\\(|\\\\\\[|\\$/.test(n.nodeValue))list.push(n);}
    list.forEach(function(t){t.nodeValue=plainTeX(t.nodeValue);});
  }
  var tries=0;
  (function wait(){
    if(window.MathJax&&MathJax.typesetPromise){
      Promise.resolve(MathJax.startup&&MathJax.startup.promise).then(function(){return MathJax.typesetPromise([document.body]);}).then(ready,function(){fallback();ready();});
    }else if(tries++<120){setTimeout(wait,100);}
    else{fallback();ready();}
  })();
})();
</script></body></html>`;
}
function reportHtml(d){
  const p=reportParts(d);
  return reportShell((d.studentName||'Student')+' — '+(d.title||'OMR Result'),p.css,p.body);
}
// Several students in one document (teacher print-all)
function reportDocMany(list){
  const parts=list.map(reportParts);
  return reportShell('OMR result reports',parts[0].css,parts.map(p=>p.body).join(''));
}

const VERSION='20.0';
const api={VERSION,quadCandidates,readCodeH,PAGE,FORMATS,HALF_SLOT,MARKS,MARK_SIZE,CODE,BUB,GRID,PXMM,CW,CH,FILLED,FAINT,layout,hash24,crc8,encodeCode,decodeCode,sheetHtml,sheetDoc,toGray,shrink,findMarks,solveHomography,locateSheet,straightenWithoutCode,readAnswers,rowCrop,reportHtml,reportDocMany,reportParts,plainTeX};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.OMR=api;
})(typeof window!=='undefined'?window:globalThis);
