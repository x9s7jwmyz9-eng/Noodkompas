/* DOM-tests zonder draaiende Home Assistant of externe resources. */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {JSDOM} = require("jsdom");
const source = readFileSync(join(__dirname,"../custom_components/noodkompas/frontend/panel.js"),"utf8");
const snapshot = () => ({household:{adults:1,children:0,pets:0,pet_water_l_day:1},water_l:0,food:[],energy:[],kit:["Zaklamp","Batterijen","Radio","EHBO","Dekens","Hygiëne","Contant geld"].map(name=>({name,done:false})),plan:{meeting_place:"",contacts:[],notes:""},settings:{water_l_person_day:3,energy_wh_day:500,expiry_warning_days:30}});
const setup = async (admin = true, data = snapshot(), saver = async()=>({revision:1,summary:{score:10}}), states = {}) => {
  const dom = new JSDOM("<!doctype html><body></body>",{runScripts:"outside-only"});
  dom.window.eval(source);
  const panel = dom.window.document.createElement("noodkompas-panel");
  dom.window.document.body.append(panel);
  const calls=[];
  panel.hass={user:{is_admin:admin},states,callWS:async msg=>{calls.push(msg);return msg.type.endsWith("get")?{snapshot:data,revision:0,summary:{score:0},entities:{}}:saver(msg);}};
  await new Promise(resolve=>setImmediate(resolve));
  return {dom,panel,calls};
};

test("niet-admin leest geen private gegevens",async()=>{
  const {dom,panel,calls}=await setup(false);
  assert.equal(calls.length,0);
  assert.match(panel.shadowRoot.textContent,/Alleen administrators/);
  dom.window.close();
});
test("gebruikerscontent blijft tekst en wordt geen HTML",async()=>{
  const data=snapshot();data.plan.notes='<img src=x onerror="alert(1)"><script>bad()</script>';
  data.food=[{name:'<img src=x>',quantity:1,unit:'blik',expires:'2099-01-01',person_days:1}];
  const {dom,panel}=await setup(true,data);
  assert.equal(panel.shadowRoot.querySelectorAll("img,script").length,0);
  assert.equal(panel.shadowRoot.querySelector("textarea").value,data.plan.notes);
  dom.window.close();
});
test("opslaan verstuurt revisie en toont lokale bevestiging",async()=>{
  const {dom,panel,calls}=await setup();
  await panel.save();
  assert.equal(calls[1].type,"noodkompas/save");
  assert.equal(calls[1].revision,0);
  assert.equal(panel.revision,1);
  assert.match(panel.status.textContent,/Opgeslagen/);
  assert.equal(panel.busy,false);
  dom.window.close();
});
test("fout wist onopgeslagen gegevens niet",async()=>{
  const {dom,panel}=await setup(true,snapshot(),async()=>{throw Error("Conflict");});
  panel.data.water_l=42;panel.dirty=true;
  await panel.save();
  assert.equal(panel.data.water_l,42);
  assert.equal(panel.dirty,true);
  assert.match(panel.status.textContent,/Opslaan mislukt/);
  dom.window.close();
});
test("entityupdates behouden een gewijzigd formulier",async()=>{
  const {dom,panel}=await setup();
  const input=panel.shadowRoot.querySelector('input[type="number"]');
  input.value="2";input.dispatchEvent(new dom.window.Event("input"));
  panel.hass={...panel._hass,states:{}};
  assert.equal(panel.data.household.adults,2);
  assert.equal(panel.shadowRoot.querySelector('input[type="number"]'),input);
  dom.window.close();
});
test("intrekken adminrechten wist het zichtbare formulier",async()=>{
  const {dom,panel}=await setup();
  panel.hass={...panel._hass,user:{is_admin:false}};
  assert.equal(panel.data,null);
  assert.equal(panel.shadowRoot.querySelector("form"),null);
  dom.window.close();
});
test("kWh-invoer wordt lokaal naar Wh omgerekend",async()=>{
  const data=snapshot();data.energy=[{name:"Accu",category:"powerstation",stored_wh:1000,entity_id:"",capacity_wh:0,reserve_pct:20}];
  const {dom,panel}=await setup(true,data);
  const selects=panel.shadowRoot.querySelectorAll("select");
  const unit=selects[1];unit.value="kWh";unit.dispatchEvent(new dom.window.Event("change"));
  const label=[...panel.shadowRoot.querySelectorAll("label")].find(node=>node.textContent.startsWith("Handmatig opgeslagen"));
  const input=label.querySelector("input");
  assert.equal(input.value,"1");
  input.value="2.5";input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(panel.data.energy[0].stored_wh,2500);
  dom.window.close();
});
test("late opslagrespons toont geen formulier na intrekken adminrechten",async()=>{
  let resolveSave;
  const {dom,panel}=await setup(true,snapshot(),()=>new Promise(resolve=>{resolveSave=resolve;}));
  const saving=panel.save();
  panel.hass={...panel._hass,user:{is_admin:false}};
  resolveSave({revision:1,summary:{score:10}});
  await saving;
  assert.equal(panel.data,null);
  assert.equal(panel.shadowRoot.querySelector("form"),null);
  dom.window.close();
});
test("energiesensor kan geselecteerd worden zonder HA-picker",async()=>{
  const data=snapshot();data.energy=[{name:"Accu",category:"powerstation",stored_wh:1000,entity_id:"",capacity_wh:0,reserve_pct:20}];
  const states={"sensor.accu":{state:"1.5",attributes:{unit_of_measurement:"kWh",friendly_name:"Accu"}},"sensor.lamp":{state:"50",attributes:{unit_of_measurement:"W"}}};
  const {dom,panel}=await setup(true,data,undefined,states);
  const label=[...panel.shadowRoot.querySelectorAll("label")].find(node=>node.textContent.startsWith("Beschikbare energiesensoren"));
  const select=label.querySelector("select");
  assert.equal(select.options.length,2);
  select.value="sensor.accu";select.dispatchEvent(new dom.window.Event("change"));
  assert.equal(panel.data.energy[0].entity_id,"sensor.accu");
  dom.window.close();
});
test("tabbladen behouden invoer en tonen alleen het gekozen onderdeel",async()=>{
  const {dom,panel}=await setup();
  panel.showTab("water");
  const section=panel.form.querySelector('[data-tab="water"]');
  const input=section.querySelector("input");input.value="18";input.dispatchEvent(new dom.window.Event("input"));
  panel.showTab("food");panel.showTab("water");
  assert.equal(panel.data.water_l,18);assert.equal(input.value,"18");
  assert.equal(panel.dashboard.hidden,true);
  assert.equal([...panel.form.querySelectorAll('section[data-tab]')].filter(s=>!s.hidden).length,1);
  assert.equal(panel.tabs.querySelector('[data-tab="water"]').getAttribute("aria-selected"),"true");
  dom.window.close();
});
test("onvolledig product opent het juiste tabblad vóór validatie",async()=>{
  const data=snapshot();data.food=[{name:"",quantity:1,unit:"blik",expires:"",person_days:1}];
  const {dom,panel,calls}=await setup(true,data);
  await panel.save();
  assert.equal(panel.activeTab,"food");
  assert.equal(calls.length,1);
  dom.window.close();
});
test("ontbrekende scores worden niet als nul weergegeven",async()=>{
  const {dom,panel}=await setup();
  panel.summary={score:null,"72h_ready":"unavailable"};panel.updateDashboard(true);
  assert.match(panel.dashboard.textContent,/Status onbekend/);
  assert.equal(panel.dashboard.querySelector(".score-ring strong").textContent,"—");
  dom.window.close();
});
test("ongewijzigde totalen vervangen gefocuste dashboardknoppen niet",async()=>{
  const {dom,panel}=await setup();
  const button=panel.dashboard.querySelector(".category-card");button.focus();
  panel.hass={...panel._hass,states:{}};
  assert.equal(panel.dashboard.querySelector(".category-card"),button);
  assert.equal(panel.shadowRoot.activeElement,button);
  dom.window.close();
});
test("tabnavigatie werkt met pijltjestoetsen",async()=>{
  const {dom,panel}=await setup();
  const tab=panel.tabs.querySelector('[data-tab="overview"]');
  tab.dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
  assert.equal(panel.activeTab,"household");
  assert.equal(panel.shadowRoot.activeElement,panel.tabs.querySelector('[data-tab="household"]'));
  dom.window.close();
});
test("verwerpen vereist een tweede bewuste actie",async()=>{
  const {dom,panel,calls}=await setup();
  panel.data.water_l=42;panel.markDirty();
  [...panel.form.querySelectorAll("button")].find(b=>b.textContent==="Wijzigingen verwerpen").click();
  assert.equal(calls.length,1);assert.equal(panel.data.water_l,42);
  assert.ok(panel.discardPrompt);
  [...panel.discardPrompt.querySelectorAll("button")].find(b=>b.textContent==="Toch bewaren").click();
  assert.equal(panel.discardPrompt,null);assert.equal(panel.data.water_l,42);
  dom.window.close();
});
