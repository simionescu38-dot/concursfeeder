/* Generator de coduri QR, folosit de index.html ȘI de concursuri.html.
   Stă într-un fișier separat tocmai ca să nu existe două copii care ajung
   să difere. Înainte, codurile veneau de pe api.qrserver.com și nu se
   încărcau la baltă, unde semnalul e slab — adică exact acolo unde e nevoie. */
// ---------- generator de coduri QR, local ----------
// Mod octeți, corecție de erori nivel M, versiunile 1-10 (până la 213 de caractere).
// Scris local fiindcă înainte codul venea de pe api.qrserver.com: la baltă, fără
// semnal bun, imaginea nu apărea deloc — exact când e nevoie de ea.
var QR = (function(){
  // versiune: [codewords de date, codewords de corecție pe bloc, număr de blocuri]
  var SPEC={1:[16,10,1],2:[28,16,1],3:[44,26,1],4:[64,18,2],5:[86,24,2],
            6:[108,16,4],7:[124,18,4],8:[154,22,4],9:[182,22,5],10:[216,26,5]};
  var ALIGN={2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],
             7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};

  var EXP=new Array(512), LOG=new Array(256);
  (function(){ var x=1; for(var i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11d; }
               for(var j=255;j<512;j++) EXP[j]=EXP[j-255]; })();
  function gmul(a,b){ return (a===0||b===0)?0:EXP[LOG[a]+LOG[b]]; }
  function rsPoly(n){
    var p=[1];
    for(var i=0;i<n;i++){
      var q=[]; for(var z=0;z<=p.length;z++) q.push(0);
      for(var j=0;j<p.length;j++){ q[j]^=p[j]; q[j+1]^=gmul(p[j],EXP[i]); }
      p=q;
    }
    return p;
  }
  function rsRemainder(data,n){
    var g=rsPoly(n), rem=[]; for(var z=0;z<n;z++) rem.push(0);
    for(var d=0;d<data.length;d++){
      var f=data[d]^rem[0];
      rem.shift(); rem.push(0);
      for(var i=0;i<n;i++) rem[i]^=gmul(g[i+1],f);
    }
    return rem;
  }
  function toBytes(text){
    var s=encodeURIComponent(text), out=[];
    for(var i=0;i<s.length;i++){
      if(s.charAt(i)==="%"){ out.push(parseInt(s.substr(i+1,2),16)); i+=2; }
      else out.push(s.charCodeAt(i));
    }
    return out;
  }
  function ccBits(ver){ return ver<10 ? 8 : 16; }
  function capacity(ver){ return Math.floor((SPEC[ver][0]*8 - 4 - ccBits(ver))/8); }
  function pickVersion(n){
    for(var v=1;v<=10;v++) if(capacity(v)>=n) return v;
    throw new Error("text prea lung pentru un cod QR");
  }

  function codewords(bytes,ver){
    var spec=SPEC[ver], nData=spec[0], nEc=spec[1], nBlocks=spec[2];
    var bits=[];
    function push(val,len){ for(var i=len-1;i>=0;i--) bits.push((val>>i)&1); }
    push(4,4); push(bytes.length,ccBits(ver));
    for(var i=0;i<bytes.length;i++) push(bytes[i],8);
    var cap=nData*8;
    for(var t=0;t<4 && bits.length<cap;t++) bits.push(0);
    while(bits.length%8) bits.push(0);
    var pad=[0xEC,0x11], pi=0;
    var data=[];
    for(var b=0;b<bits.length;b+=8){
      var v=0; for(var k=0;k<8;k++) v=(v<<1)|bits[b+k];
      data.push(v);
    }
    while(data.length<nData){ data.push(pad[pi]); pi^=1; }

    // împarte în blocuri: cele lungi au un codeword în plus și stau la coadă
    var shortLen=Math.floor(nData/nBlocks), nLong=nData%nBlocks, nShort=nBlocks-nLong;
    var blocks=[], ecs=[], off=0;
    for(var i2=0;i2<nBlocks;i2++){
      var len=shortLen+(i2>=nShort?1:0);
      var blk=data.slice(off,off+len); off+=len;
      blocks.push(blk); ecs.push(rsRemainder(blk,nEc));
    }
    var out=[];
    for(var c=0;c<shortLen+1;c++)
      for(var i3=0;i3<nBlocks;i3++)
        if(c<blocks[i3].length) out.push(blocks[i3][c]);
    for(var c2=0;c2<nEc;c2++)
      for(var i4=0;i4<nBlocks;i4++) out.push(ecs[i4][c2]);
    return out;
  }

  function maskBit(k,r,c){
    switch(k){
      case 0: return (r+c)%2===0?1:0;
      case 1: return r%2===0?1:0;
      case 2: return c%3===0?1:0;
      case 3: return (r+c)%3===0?1:0;
      case 4: return (Math.floor(r/2)+Math.floor(c/3))%2===0?1:0;
      case 5: return ((r*c)%2+(r*c)%3)===0?1:0;
      case 6: return (((r*c)%2+(r*c)%3)%2)===0?1:0;
      default: return (((r+c)%2+(r*c)%3)%2)===0?1:0;
    }
  }

  function build(ver,cw,mask){
    var size=17+4*ver, m=[], res=[];
    for(var i=0;i<size;i++){
      var rowM=[], rowR=[];
      for(var j=0;j<size;j++){ rowM.push(0); rowR.push(false); }
      m.push(rowM); res.push(rowR);
    }
    function setF(r,c,v){ if(r<0||c<0||r>=size||c>=size) return; m[r][c]=v; res[r][c]=true; }
    function finder(r0,c0){
      for(var r=-1;r<=7;r++) for(var c=-1;c<=7;c++){
        var on=(r>=0&&r<=6&&(c===0||c===6))||(c>=0&&c<=6&&(r===0||r===6))||(r>=2&&r<=4&&c>=2&&c<=4);
        setF(r0+r,c0+c,on?1:0);
      }
    }
    finder(0,0); finder(0,size-7); finder(size-7,0);
    for(var i5=8;i5<size-8;i5++){ var v5=i5%2===0?1:0; setF(6,i5,v5); setF(i5,6,v5); }
    var ap=ALIGN[ver]||[];
    for(var a=0;a<ap.length;a++) for(var b=0;b<ap.length;b++){
      var ar=ap[a], ac=ap[b];
      if((ar===6&&ac===6)||(ar===6&&ac===size-7)||(ar===size-7&&ac===6)) continue;
      for(var dr=-2;dr<=2;dr++) for(var dc=-2;dc<=2;dc++)
        setF(ar+dr,ac+dc,(Math.max(Math.abs(dr),Math.abs(dc))!==1)?1:0);
    }
    // rezervă zonele de format — SĂRIND indicele 6, care aparține sincronizării
    for(var i6=0;i6<9;i6++){ if(i6===6) continue; setF(8,i6,0); setF(i6,8,0); }
    for(var i7=0;i7<8;i7++){ setF(8,size-1-i7,0); setF(size-1-i7,8,0); }
    setF(size-8,8,1); // modulul întunecat obligatoriu, după rezervări
    if(ver>=7){
      var rv=ver;
      for(var i8=0;i8<12;i8++) rv=(rv<<1)^(((rv>>11)&1)*0x1F25);
      var vb=(ver<<12)|(rv&0xFFF);
      for(var i9=0;i9<18;i9++){
        var bit9=(vb>>i9)&1, q=Math.floor(i9/3), rmd=i9%3;
        setF(size-11+rmd,q,bit9); setF(q,size-11+rmd,bit9);
      }
    }
    // datele, în zigzag de la colțul din dreapta-jos
    var bits=[];
    for(var z=0;z<cw.length;z++) for(var t=7;t>=0;t--) bits.push((cw[z]>>t)&1);
    var idx=0, up=true;
    for(var col=size-1; col>0; col-=2){
      if(col===6) col--;
      for(var i10=0;i10<size;i10++){
        var row=up?size-1-i10:i10;
        for(var j2=0;j2<2;j2++){
          var cc=col-j2;
          if(res[row][cc]) continue;
          var bit=idx<bits.length?bits[idx++]:0;
          m[row][cc]=(bit^maskBit(mask,row,cc))&1;
        }
      }
      up=!up;
    }
    // informația de format (nivel M = 00) — se scrie după mascare
    var fd=(0<<3)|mask, fr=fd;
    for(var i11=0;i11<10;i11++) fr=(fr<<1)^(((fr>>9)&1)*0x537);
    var fbits=(((fd<<10)|(fr&0x3FF))^0x5412);
    for(var i12=0;i12<15;i12++){
      var fb=(fbits>>i12)&1;
      // copia 1: coloana 8 de sus în jos, apoi rândul 8 de la dreapta spre stânga
      if(i12<6) m[i12][8]=fb;
      else if(i12===6) m[7][8]=fb;
      else if(i12===7) m[8][8]=fb;
      else if(i12===8) m[8][7]=fb;
      else m[8][14-i12]=fb;
      // copia 2: capătul drept al rândului 8, apoi capătul de jos al coloanei 8
      if(i12<8) m[8][size-1-i12]=fb;
      else m[size-15+i12][8]=fb;
    }
    m[size-8][8]=1;
    return m;
  }

  function penalty(m){
    var size=m.length, p=0, dark=0, i, j;
    function run(get){
      var total=0;
      for(i=0;i<size;i++){
        var last=-1, len=0;
        for(j=0;j<size;j++){
          var v=get(i,j);
          if(v===last) len++; else { if(len>=5) total+=3+(len-5); last=v; len=1; }
        }
        if(len>=5) total+=3+(len-5);
      }
      return total;
    }
    p+=run(function(r,c){return m[r][c];});
    p+=run(function(r,c){return m[c][r];});
    for(i=0;i<size-1;i++) for(j=0;j<size-1;j++){
      var s=m[i][j]+m[i][j+1]+m[i+1][j]+m[i+1][j+1];
      if(s===0||s===4) p+=3;
    }
    var pat1=[1,0,1,1,1,0,1,0,0,0,0], pat2=[0,0,0,0,1,0,1,1,1,0,1];
    function scan(get){
      var total=0;
      for(i=0;i<size;i++) for(j=0;j+11<=size;j++){
        var ok1=true, ok2=true;
        for(var k=0;k<11;k++){
          var v=get(i,j+k);
          if(v!==pat1[k]) ok1=false;
          if(v!==pat2[k]) ok2=false;
        }
        if(ok1) total+=40;
        if(ok2) total+=40;
      }
      return total;
    }
    p+=scan(function(r,c){return m[r][c];});
    p+=scan(function(r,c){return m[c][r];});
    for(i=0;i<size;i++) for(j=0;j<size;j++) dark+=m[i][j];
    p+=10*Math.floor(Math.abs(dark*100/(size*size)-50)/5);
    return p;
  }

  function matrix(text){
    var bytes=toBytes(text), ver=pickVersion(bytes.length), cw=codewords(bytes,ver);
    var best=null, bestP=Infinity;
    for(var k=0;k<8;k++){
      var m=build(ver,cw,k), s=penalty(m);
      if(s<bestP){ bestP=s; best=m; }
    }
    return best;
  }

  // SVG, nu canvas: rămâne clar la orice mărime și se poate mări cu degetele
  function svg(text,color){
    var m=matrix(text), size=m.length, q=4, total=size+2*q, d="";
    for(var r=0;r<size;r++) for(var c=0;c<size;c++)
      if(m[r][c]) d+="M"+(c+q)+" "+(r+q)+"h1v1h-1z";
    return '<svg viewBox="0 0 '+total+' '+total+'" width="100%" xmlns="http://www.w3.org/2000/svg" '+
           'shape-rendering="crispEdges" style="display:block"><rect width="'+total+'" height="'+total+
           '" fill="#ffffff"/><path d="'+d+'" fill="'+(color||"#10263c")+'"/></svg>';
  }
  return {svg:svg, matrix:matrix, capacity:capacity};
})()
