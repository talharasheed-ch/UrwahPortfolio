/* Native browser PDF writer. No CDN, server, print dialog or third-party PDF library required.
   Text remains selectable; original clinical JPEG photographs are embedded as PDF images. */
(function () {
  'use strict';
  const PAPER_W = 595.28, PAPER_H = 841.89;
  const C = {ink:'#16383B',dark:'#102D33',green:'#3C796D',soft:'#EDF4EF',muted:'#768B83',line:'#DCE6DE',gold:'#D1B382',white:'#FFFFFF',cream:'#F8FAF7'};
  const encoder = new TextEncoder();
  const canvasCtx = document.createElement('canvas').getContext('2d');
  const photoDetails = new Map();

  function ascii(value) {
    return String(value == null ? '' : value)
      .replace(/[\u2018\u2019\u201B]/g, "'").replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, '-').replace(/[\u00A0]/g, ' ')
      .replace(/\u2026/g, '...').replace(/[\u2022\u00B7]/g, '-')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');
  }
  function hexColor(hex) {
    const v=hex.replace('#','');return [0,2,4].map(i=>(parseInt(v.substring(i,i+2),16)/255).toFixed(3)).join(' ');
  }
  function pdfText(s){return '('+ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')+')';}
  function buf(str){return encoder.encode(str);}
  function joinBytes(parts){let length=0;parts.forEach(p=>length+=p.length);const out=new Uint8Array(length);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
  function base64Bytes(src){const encoded=src.split(',')[1];const raw=atob(encoded);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  async function dimensions(id){if(photoDetails.has(id))return photoDetails.get(id);const i=new Image();i.src=window.PHOTO_DATA[id];await i.decode();const value={width:i.naturalWidth,height:i.naturalHeight};photoDetails.set(id,value);return value;}
  function wrap(text,width,size=11,bold=false){
    canvasCtx.font=(bold?'bold ':'')+size+'px Arial'; const lines=[];
    for(const paragraph of ascii(text).split('\n')) {
      const words=paragraph.split(/\s+/).filter(Boolean);let line='';
      for(const word of words){const next=line?line+' '+word:word;if(line&&canvasCtx.measureText(next).width>width){lines.push(line);line=word;}else{line=next;}}
      if(line)lines.push(line);if(!words.length)lines.push('');
    }
    return lines;
  }
  class PDFDocument {
    constructor(title){this.objects=[null,null,null,null];this.pages=[];this.images=new Map();this.font1=3;this.font2=4;this.title=title;this.set(3,buf('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));this.set(4,buf('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));}
    reserve(){this.objects.push(null);return this.objects.length;}
    set(i,bytes){this.objects[i-1]=bytes;}
    add(bytes){const i=this.reserve();this.set(i,bytes);return i;}
    stream(data,dict=''){const bytes=typeof data==='string'?buf(data):data;return this.add(joinBytes([buf('<< '+dict+' /Length '+bytes.length+' >>\nstream\n'),bytes,buf('\nendstream')]));}
    page(){const p=new PDFPage(this,this.pages.length+1);this.pages.push(p);return p;}
    async image(id){if(this.images.has(id))return this.images.get(id);const d=await dimensions(id), bytes=base64Bytes(window.PHOTO_DATA[id]);const ref=this.stream(bytes,'/Type /XObject /Subtype /Image /Width '+d.width+' /Height '+d.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode');const r={ref,...d};this.images.set(id,r);return r;}
    build(){
      const kids=[];
      for(const p of this.pages){
        const contentRef=this.stream(p.commands.join('\n'));
        const xobjs=[...p.imageRefs.entries()].map(([n,ref])=>'/'+n+' '+ref+' 0 R').join(' ');
        const pageObj='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+PAPER_W+' '+PAPER_H+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << '+xobjs+' >> >> /Contents '+contentRef+' 0 R >>';
        kids.push(this.add(buf(pageObj)));
      }
      this.set(2,buf('<< /Type /Pages /Kids ['+kids.map(i=>i+' 0 R').join(' ')+'] /Count '+kids.length+' >>'));
      this.set(1,buf('<< /Type /Catalog /Pages 2 0 R >>'));
      const info=this.add(buf('<< /Title '+pdfText(this.title)+' /Author '+pdfText('Urwah Tahir')+' /Subject '+pdfText('Clinical Management Portfolio - Dental Technology')+' /Creator '+pdfText('Clinical Journal website')+' >>'));
      const chunks=[buf('%PDF-1.4\n%Clinical Journal\n')], offsets=[0];let bytes=chunks[0].length;
      for(let i=0;i<this.objects.length;i++){const obj=this.objects[i];if(!obj)throw Error('PDF object '+(i+1)+' was not populated');offsets.push(bytes);const part=joinBytes([buf((i+1)+' 0 obj\n'),obj,buf('\nendobj\n')]);chunks.push(part);bytes+=part.length;}
      const xref=bytes;
      let table='xref\n0 '+(this.objects.length+1)+'\n0000000000 65535 f \n';
      for(let i=1;i<offsets.length;i++)table+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
      chunks.push(buf(table+'trailer\n<< /Size '+(this.objects.length+1)+' /Root 1 0 R /Info '+info+' 0 R >>\nstartxref\n'+xref+'\n%%EOF'));
      return new Blob(chunks,{type:'application/pdf'});
    }
  }
  class PDFPage {
    constructor(doc,number){this.doc=doc;this.number=number;this.commands=[];this.imageRefs=new Map();}
    rect(x,y,w,h,fill){this.commands.push(hexColor(fill)+' rg '+x.toFixed(2)+' '+(PAPER_H-y-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re f');}
    line(x1,y1,x2,y2,color=C.line,width=1){this.commands.push(hexColor(color)+' RG '+width.toFixed(2)+' w '+x1.toFixed(2)+' '+(PAPER_H-y1).toFixed(2)+' m '+x2.toFixed(2)+' '+(PAPER_H-y2).toFixed(2)+' l S');}
    text(content,x,y,size=11,{bold=false,color=C.ink}={}){this.commands.push('BT '+hexColor(color)+' rg /F'+(bold?'2':'1')+' '+size+' Tf 1 0 0 1 '+x.toFixed(2)+' '+(PAPER_H-y).toFixed(2)+' Tm '+pdfText(content)+' Tj ET');}
    paragraph(content,x,y,width,{size=11,lineHeight=17,color=C.muted,bold=false}={}){for(const line of wrap(content,width,size,bold)){this.text(line,x,y,size,{color,bold});y+=lineHeight;}return y;}
    async photo(id,x,y,w,h){const im=await this.doc.image(id);const name='P'+id;this.imageRefs.set(name,im.ref);const ratio=Math.min(w/im.width,h/im.height);const rw=im.width*ratio,rh=im.height*ratio;const px=x+(w-rw)/2,py=y+(h-rh)/2;this.commands.push('q '+rw.toFixed(3)+' 0 0 '+rh.toFixed(3)+' '+px.toFixed(3)+' '+(PAPER_H-py-rh).toFixed(3)+' cm /'+name+' Do Q');}
  }
  function basePage(doc,section,pageTitle){
    const p=doc.page();p.rect(0,0,PAPER_W,5,C.green);
    p.text('SUPERIOR UNIVERSITY LAHORE',43,39,8.3,{bold:true,color:C.green});
    p.text('DENTAL TECHNOLOGY  /  SEMESTER 07',335,39,7.5,{bold:true,color:C.muted});
    p.line(43,51,PAPER_W-43,51,C.line,.8);
    p.line(43,793,PAPER_W-43,793,C.line,.8);
    p.text('URWAH TAHIR   /   CLINICAL MANAGEMENT',43,809,7.7,{color:C.muted});
    p.text(section+'     '+String(p.number).padStart(2,'0'),467,809,7.3,{bold:true,color:C.green});
    return p;
  }
  function label(p,text,x,y){p.text(text.toUpperCase(),x,y,8.5,{bold:true,color:C.green});}
  async function drawCover(doc){
    const p=doc.page();p.rect(0,0,PAPER_W,PAPER_H,C.cream);p.rect(0,0,PAPER_W,405,C.dark);p.rect(44,41,29,3,C.gold);
    p.text('SUPERIOR UNIVERSITY  /  LAHORE',84,46,9.5,{bold:true,color:'#D3E9DC'});
    p.text('CLINICAL',44,138,43,{bold:true,color:C.white});p.text('MANAGEMENT',44,188,43,{bold:true,color:C.white});
    p.text('P O R T F O L I O',45,237,16,{color:'#DFD1B6'});
    p.line(44,265,546,265,'#5C7875',1);
    p.text('Clinical placement and weekly learning record',45,294,12,{color:'#CDDFD7'});
    p.text('SEPTEMBER 2025   /   HEALTHY SMILE DENTAL CLINIC',45,329,9,{bold:true,color:'#B7D1C7'});
    p.rect(43,435,509,154,C.white);
    p.text('DOCUMENTED BY',61,463,8,{bold:true,color:C.green});
    p.text('Urwah Tahir',60,500,29,{color:C.ink});
    p.text('BS Dental Technology  |  7th Semester',61,525,11,{color:C.muted});
    p.line(60,544,534,544,C.line,.7);
    p.text('STUDENT ID',61,566,8,{bold:true,color:C.muted});p.text('SU91_BSDTM_F23_042',163,566,9.5,{bold:true,color:C.ink});
    p.text('CLINIC & PLACEMENT',43,640,9,{bold:true,color:C.green});
    p.text('Healthy Smile Dental Clinic  -  Shershah Link Road, Lahore',43,662,11,{color:C.ink});
    p.text('Clinic owner: M Faizan  |  Joined: 1 September 2025',43,681,10,{color:C.muted});
    p.rect(43,728,509,1,C.line);p.text('8 WEEKS',43,752,10,{bold:true,color:C.green});p.text('24 PHOTOGRAPHS',211,752,10,{bold:true,color:C.green});p.text('2023 - 2027',428,752,10,{bold:true,color:C.green});
    p.text('A DOCUMENTED RECORD OF LEARNING AND PRACTICE',43,806,8,{bold:true,color:C.muted});
  }
  function drawIntroduction(doc){
    const p=basePage(doc,'INTRODUCTION');label(p,'01 / introduction',45,112);
    p.text('Why this portfolio',44,161,31,{color:C.ink});p.line(44,177,551,177,C.line,1);
    label(p,'PURPOSE OF PORTFOLIO',45,213);
    p.paragraph(window.PORTFOLIO.purpose,45,237,490,{size:12,lineHeight:20,color:C.muted});
    p.rect(43,390,509,225,C.soft);p.rect(43,390,4,225,C.gold);
    label(p,'CAREER GOAL',65,422);
    p.paragraph(window.PORTFOLIO.goal,65,452,458,{size:13,lineHeight:22,color:C.ink});
    label(p,'STUDENT PROFILE',45,668);
    p.text('Urwah Tahir  |  SU91_BSDTM_F23_042',45,698,11,{bold:true});
    p.text('Superior University Lahore  |  BS Dental Technology',45,718,10.5,{color:C.muted});
    p.text('Batch 2023 - 2027  |  Semester 07',45,738,10.5,{color:C.muted});
  }
  function weekContents(doc,week){
    const p=basePage(doc,'WEEK '+String(week.id).padStart(2,'0'));
    label(p,'CLINICAL ROTATION  /  WEEK '+String(week.id).padStart(2,'0')+' OF 08',45,115);
    p.text(week.category,45,139,8.7,{bold:true,color:C.muted});
    let y=179;const titleLines=wrap(week.title,486,28,true);
    for(const line of titleLines){p.text(line,44,y,28,{bold:true,color:C.ink});y+=35;}
    p.rect(44,y+2,47,2,C.gold);
    y+=34;
    y=p.paragraph(week.summary,44,y,494,{size:13,lineHeight:19,color:C.green});
    y+=35;
    label(p,'CLINICAL LEARNING & OBSERVATIONS',45,y);y+=28;
    y=p.paragraph(week.description,44,y,500,{size:11.1,lineHeight:17.6,color:C.ink});
    y+=28;
    label(p,'PRACTICE FOCUS',45,y);y+=21;
    for(const t of week.focus){
      p.rect(46,y-7,5,5,C.gold);
      p.text(t,60,y,11,{color:C.muted});y+=22;
    }
    const lower=Math.max(y+17,702);
    if(lower<768){p.line(45,lower,550,lower,C.line,.8);p.text('VISUAL DOCUMENTATION',45,lower+22,8.6,{bold:true,color:C.green});p.text(week.photos.length+' PHOTOGRAPHS ON FOLLOWING PAGE'+(week.photos.length===1?'':'S'),316,lower+22,8,{bold:true,color:C.muted});}
    if(week.note){const noteY=Math.min(755,lower+41);p.text('Note: Image 08 was not included in the supplied files.',45,noteY,8.6,{color:C.muted});}
  }
  async function weekPhotos(doc,week){
    const photos=week.photos;
    for(let start=0;start<photos.length;start+=4){
      const p=basePage(doc,'WEEK '+String(week.id).padStart(2,'0')+' / PHOTOS');
      label(p,'DOCUMENTED CLINICAL PHOTOGRAPHS',45,109);
      p.text('Week '+String(week.id).padStart(2,'0')+'  /  '+week.short,44,145,21,{bold:true});
      p.text('Photographic observations from the placement',45,164,10,{color:C.muted});
      p.line(44,178,551,178,C.line,.8);
      const part=photos.slice(start,start+4),single=part.length===1;
      for(let j=0;j<part.length;j++){
        const id=part[j],globalIndex=start+j;
        const x=single?84:44+(j%2)*257,y=single?206:206+Math.floor(j/2)*280;
        const w=single?425:247,h=single?484:265;
        p.rect(x,y,w,h,C.soft);
        await p.photo(id,x+8,y+8,w-16,h-47);
        p.rect(x,y+h-35,w,35,C.white);
        p.text('PHOTO '+String(id).padStart(2,'0'),x+11,y+h-21,8.5,{bold:true,color:C.green});
        const caption=week.captions[globalIndex]||'Clinical photograph';
        const captionLines=wrap(caption,w-22,7.6);
        p.text(captionLines[0]||'',x+11,y+h-9,7.6,{color:C.muted});
      }
    }
  }
  function drawConclusion(doc){
    const p=basePage(doc,'CONCLUSION');label(p,'FINAL REFLECTION',45,126);
    p.text('Continuing to learn,',44,183,33,{color:C.ink});p.text('committed to care.',44,224,33,{color:C.green});
    p.rect(43,263,54,3,C.gold);
    p.paragraph(window.PORTFOLIO.conclusion,44,323,497,{size:12.4,lineHeight:21.5,color:C.muted});
    p.rect(43,577,509,137,C.soft);
    label(p,'PORTFOLIO PREPARED BY',62,610);
    p.text('Urwah Tahir',62,641,21,{color:C.ink});
    p.text('Superior University Lahore  |  Semester 07',62,666,10.3,{color:C.muted});
    p.text('SU91_BSDTM_F23_042',62,687,9.8,{bold:true,color:C.green});
  }
  async function makeWeekPDF(week){
    const pdf=new PDFDocument('Clinical Management Portfolio - Week '+week.id+' - '+week.title);
    weekContents(pdf,week);await weekPhotos(pdf,week);return pdf.build();
  }
  async function makeFullPDF(){
    const pdf=new PDFDocument('Urwah Tahir - Clinical Management Portfolio');
    await drawCover(pdf);drawIntroduction(pdf);
    for(const week of window.PORTFOLIO.weeks){weekContents(pdf,week);await weekPhotos(pdf,week);}
    drawConclusion(pdf);return pdf.build();
  }
  function downloadBlob(blob,fileName){
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  let busy=false;
  async function exportFile(which){
    if(busy)return;
    busy=true;const overlay=document.getElementById('exportOverlay'),progress=document.getElementById('exportProgressText');
    overlay.hidden=false;
    try{
      // Allow the UI to paint the progress overlay before PDF assembly starts.
      await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,20)));
      let blob,file;
      if(which==='full'){
        progress.textContent='Putting all eight weeks and photographs into one document...';
        blob=await makeFullPDF();file='Urwah_Tahir_Clinical_Management_Portfolio.pdf';
      }else{
        const week=window.PORTFOLIO.weeks.find(w=>w.id===Number(which));
        if(!week)throw Error('This week is not available.');
        progress.textContent='Embedding clinical photographs for week '+week.id+'...';
        blob=await makeWeekPDF(week);file='Urwah_Tahir_Week_'+String(week.id).padStart(2,'0')+'.pdf';
      }
      downloadBlob(blob,file);
      if(window.showAppToast)window.showAppToast('PDF generated','Your '+(which==='full'?'complete portfolio':'week '+which+' report')+' is ready and includes its photographs.');
    }catch(err){console.error('PDF export failed:',err);if(window.showAppToast)window.showAppToast('Export could not finish',err.message||'Please try again.',true);}
    finally{overlay.hidden=true;busy=false;}
  }
  window.ClinicalPDF={export:exportFile,makeWeekPDF,makeFullPDF};
})();
