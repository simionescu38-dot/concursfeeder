const fs=require("fs"),path=require("path"),vm=require("vm");
const html=fs.readFileSync(path.join(__dirname,"rezultat.html"),"utf8");
let failed=0;function t(n,v,e){if(v===e)console.log("✓ "+n);else{failed++;console.log("✗ "+n+" — primit "+v+", așteptat "+e)}}
let script=html.match(/<script>([^]*?)<\/script>/)[1].replace(/load\(\)\.catch\([^]*$/m,"");
const ctx={console,location:{search:"",href:""},document:{},navigator:{}};vm.createContext(ctx);vm.runInContext(script,ctx);
ctx.state.participants=[
 {id:"a",prenume:"Ana",stand:"1",m:{1:{stand:"1",sector:"A",catches:[10],extras:[]},2:{stand:"3",sector:"B",catches:[5],extras:[]}}},
 {id:"b",prenume:"Bogdan",stand:"2",m:{1:{stand:"2",sector:"A",catches:[8],extras:[2]},2:{stand:"4",sector:"B",catches:[7],extras:[]}}}
];
let m1=ctx.pointsMapS(1),g=ctx.pointsCombo(),clas=ctx.sortByPoints(ctx.state.participants,g,"total");
t("egalitatea din sector împarte locurile",m1.a,1.5);t("egalitatea dă aceleași puncte",m1.b,1.5);
t("generalul adună manșele",g.a,3.5);t("departajarea folosește totalul kg",clas[0].id,"b");
t("pagina acceptă arhivă API",html.includes('param("id")'),true);t("pagina acceptă fișier permanent",html.includes('param("file")'),true);
t("PIN-ul nu este afișat",/pinHash[^\n]*innerHTML/.test(html),false);
t("folosește generatorul QR local",html.includes('<script src="qr.js"></script>'),true);
t("QR-ul conține linkul concursului",/QR\.svg\(location\.href\)/.test(html),true);
t("codul QR se salvează PNG",/toBlob[\s\S]*image\/png/.test(html),true);
t("imaginea include toți participanții",/430\+list\.length\*rowH/.test(html),true);
t("imaginea folosește clasamentul general",/function imagineRezultate\(\).*pointsCombo\(\).*sortByPoints/s.test(html),true);
t("imaginea poate fi distribuită ca PNG",/rezultate-concurs\.png/.test(html),true);
t("fiecare rând deschide fișa concurentului",/onclick=\"deschideFisa\(/.test(html),true);
t("fișa arată locul general",html.includes("Loc general"),true);
t("locul din fișă este cel din clasamentul oficial",ctx.dateFisa(ctx.state.participants[1]).loc,1);
t("fișa arată fiecare manșă",/Manșa ["']?\+mi/.test(html),true);
t("rezultatul personal se distribuie PNG",html.includes("rezultatul-meu.png"),true);
t("pagina afișează campionii concursului",html.includes("Campionii concursului"),true);
t("podiumul vine din clasamentul general",/function dateCampioni\(\).*pointsCombo\(\).*sortByPoints/s.test(html),true);
t("primul de pe podium este primul oficial",ctx.dateCampioni().general[0].id,"b");
t("sunt găsiți câștigătorii sectoarelor",ctx.dateCampioni().sectoare.length,2);
t("câștigătorii sunt grupați pe sector și manșă",/sectoare\.push\(\{mi:mi,sector:s/.test(html),true);
t("imaginea campionilor este PNG",html.includes("campionii-concursului.png"),true);
if(failed)process.exit(1);console.log("Pagina publică este verificată.");
