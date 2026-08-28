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
if(failed)process.exit(1);console.log("Pagina publică este verificată.");
