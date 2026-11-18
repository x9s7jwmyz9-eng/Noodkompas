/* Lokaal adminpaneel. Gebruikerscontent gaat uitsluitend via textContent/value. */
const element = (tag, text, parent) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (parent) parent.append(node);
  return node;
};
const categories = {powerbank: "Powerbank", ups: "UPS", powerstation: "Powerstation", home_battery: "Thuisaccu", ev: "EV"};
const standardKit = ["Zaklamp", "Batterijen", "Radio", "EHBO", "Dekens", "Hygiëne", "Contant geld"];

class NoodkompasPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: "open"});
    this.loading = false;
    this.busy = false;
    this.dirty = false;
    this.activeTab = "overview";
  }

  set narrow(value) {
    this._narrow = value;
    const menu = this.shadowRoot.querySelector("ha-menu-button");
    if (menu) menu.narrow = value;
  }

  set hass(hass) {
    this._hass = hass;
    this.toggleAttribute("dark", Boolean(hass.themes?.darkMode));
    if (!hass.user?.is_admin) {
      this.data = null;
      this.summary = null;
      this.dashboard = null;
      this.form = null;
      this.status = null;
      this.entities = null;
      this.revision = null;
      this.shadowRoot.replaceChildren();
      element("p", "Alleen administrators hebben toegang tot Noodkompas.", this.shadowRoot);
      return;
    }
    if (!this.data && !this.loading) this.load();
    // Bij entityupdates alleen totalen verversen; onopgeslagen formulieren behouden.
    if (this.data && this.dashboard) this.updateDashboard();
  }

  async load() {
    if (!this._hass?.user?.is_admin || this.loading) return;
    this.loading = true;
    try {
      const result = await this._hass.callWS({type: "noodkompas/get"});
      if (!this._hass.user?.is_admin) return;
      this.data = result.snapshot;
      this.revision = result.revision;
      this.summary = result.summary;
      this.entities = result.entities;
      this.dirty = false;
      this.render();
    } catch {
      if (!this._hass.user?.is_admin) return;
      if (!this.status) {
        this.shadowRoot.replaceChildren();
        this.status = element("p", "", this.shadowRoot);
        this.button(this.shadowRoot, "Opnieuw proberen", () => this.load());
      }
      this.status.textContent = "Laden mislukt. Controleer of de integratie geladen is en je administrator bent.";
    } finally { this.loading = false; }
  }

  button(parent, label, action) {
    const button = element("button", label, parent);
    button.type = "button";
    button.addEventListener("click", () => { if (!this.busy) action(); });
    return button;
  }

  field(parent, label, object, key, type = "text", limits = {}) {
    const wrapper = element("label", label, parent);
    wrapper.className = type === "checkbox" ? "field checkbox-field" : type === "textarea" ? "field wide" : "field";
    const input = element(type === "textarea" ? "textarea" : "input", undefined, wrapper);
    if (type !== "textarea") input.type = type;
    if (type === "checkbox") input.checked = object[key];
    else input.value = object[key];
    Object.assign(input, limits);
    if (type === "text" || type === "textarea") input.maxLength = limits.maxLength ?? 200;
    if (type === "number") { input.min = limits.min ?? 0; input.max = limits.max ?? 1000000; input.step = limits.step ?? "any"; input.required = true; }
    input.addEventListener("input", () => {
      object[key] = type === "checkbox" ? input.checked : type === "number" ? input.valueAsNumber : input.value;
      this.markDirty();
    });
    return input;
  }

  section(title, help) {
    const section = element("section", undefined, this.form);
    section.dataset.tab = {Huishouden:"household",Water:"water",Voedsel:"food",Energie:"energy",Noodpakket:"kit",Noodplan:"plan"}[title];
    section.id = `nk-section-${section.dataset.tab}`;
    section.setAttribute("role", "tabpanel");
    section.setAttribute("aria-labelledby", `nk-tab-${section.dataset.tab}`);
    const heading = element("div", undefined, section); heading.className="section-heading";
    this.icon(heading, {Huishouden:"account-group-outline",Water:"water-outline",Voedsel:"food-apple-outline",Energie:"lightning-bolt-outline",Noodpakket:"bag-personal-outline",Noodplan:"map-marker-path"}[title]);
    element("h2", title, heading);
    if (help) element("p", help, section).className="section-help";
    return section;
  }

  rows(section, key, renderRow, newItem, max, canDelete = () => true) {
    const container = element("div", undefined, section);
    container.className = key === "kit" ? "item-list checklist" : "item-list";
    const draw = () => {
      container.replaceChildren();
      if (!this.data[key].length) {
        const empty = element("div", undefined, container); empty.className="empty-state";
        this.icon(empty, key === "food" ? "food-apple-outline" : "battery-outline");
        element("h3", key === "food" ? "Je voorraad begint hier" : "Breng je noodenergie in kaart", empty);
        element("p", key === "food" ? "Voeg je eerste product toe en houd de houdbaarheid bij." : "Voeg een powerbank, accu of andere energiebron toe.", empty);
      }
      this.data[key].forEach((item, index) => {
        const row = element("fieldset", undefined, container);
        element("legend", `${key === "food" ? "Product" : key === "energy" ? "Energiebron" : "Item"} ${index + 1}`, row);
        renderRow(row, item);
        if (canDelete(item, index)) this.button(row, "Verwijderen", () => {this.data[key].splice(index, 1); this.markDirty(); draw();});
      });
    };
    draw();
    this.button(section, key === "food" ? "+ Product toevoegen" : key === "energy" ? "+ Energiebron toevoegen" : "+ Eigen item toevoegen", () => {
      if (this.data[key].length >= max) {this.status.textContent = `Maximaal ${max} items toegestaan.`; return;}
      this.data[key].push(newItem()); this.markDirty(); draw();
      container.lastElementChild?.querySelector("input")?.focus();
    });
  }

  render() {
    this.shadowRoot.replaceChildren();
    const style = element("style", undefined, this.shadowRoot);
    style.textContent = `:host{--nk-accent:#187563;--nk-accent-soft:#eaf5f0;--nk-amber:#946117;--nk-amber-soft:#fff4dc;--nk-blue:#276ca5;--nk-red:#b83d3d;display:block;min-height:100%;font-family:var(--paper-font-body1_-_font-family,system-ui,sans-serif);color:var(--primary-text-color,#233a35);background:var(--primary-background-color,#f5f7f7);color-scheme:light}
:host([dark]){--nk-accent:#79d7bc;--nk-accent-soft:#203c34;--nk-amber:#f2c574;--nk-amber-soft:#3e3422;--nk-blue:#8cbff1;--nk-red:#ffacac;color-scheme:dark}
*{box-sizing:border-box}[hidden]{display:none!important}main{max-width:1200px;margin:0 auto;padding:26px 28px 30px}h1,h2,h3,p{margin:0}h1{font-size:25px;letter-spacing:-.8px;font-weight:750}h2{font-size:23px;letter-spacing:-.5px}h3{font-size:16px}p{line-height:1.65}ha-icon{display:inline-flex;flex:none;width:23px;height:23px;--mdc-icon-size:23px;vertical-align:middle}
.app-header{display:flex;align-items:center;gap:12px;margin-bottom:24px}.brand{display:flex;align-items:center;gap:12px;flex:1}.brand>ha-icon{color:var(--nk-accent);width:44px;height:44px;--mdc-icon-size:34px;align-items:center;justify-content:center;background:var(--nk-accent-soft);border-radius:14px}.brand span{display:block;font-size:12px;color:var(--secondary-text-color,#647771);margin-top:3px}.privacy-badge{display:flex;align-items:center;gap:6px;border:1px solid var(--divider-color,#dee6e2);padding:7px 11px;border-radius:30px;color:var(--secondary-text-color,#647771);font-size:12px}.privacy-badge ha-icon{--mdc-icon-size:16px;width:16px;height:16px}
button,input,textarea,select{font:inherit}button{cursor:pointer;min-height:42px;border:1px solid var(--divider-color,#dde5e1);border-radius:9px;padding:9px 14px;color:var(--primary-text-color,#233a35);background:var(--card-background-color,#fff);font-size:13px;font-weight:650;transition:background .15s,border-color .15s,transform .15s}button:hover{background:var(--nk-accent-soft);border-color:var(--nk-accent)}button:disabled{opacity:.5;cursor:wait}button.primary{background:var(--nk-accent);color:var(--card-background-color,#fff);border-color:var(--nk-accent);padding-inline:25px}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--nk-accent);outline-offset:3px}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--divider-color,#dde5e1);margin-bottom:25px;overflow-x:auto;padding:0 0 9px;scrollbar-width:thin}.tabs button{display:flex;align-items:center;justify-content:center;gap:7px;border:0;white-space:nowrap;background:transparent;font-weight:500;flex:1;padding:11px 13px;color:var(--secondary-text-color,#647771);border-radius:8px}.tabs button[aria-selected=true]{background:var(--nk-accent-soft);color:var(--nk-accent);font-weight:750}.tabs ha-icon{width:19px;height:19px;--mdc-icon-size:19px}
.hero{display:grid;grid-template-columns:1fr auto;gap:22px;padding:30px 36px;border:1px solid color-mix(in srgb,var(--nk-accent) 18%,transparent);border-radius:20px;background:linear-gradient(120deg,var(--nk-accent-soft),var(--card-background-color,#fff));align-items:center}.eyebrow{text-transform:uppercase;font-size:10px;letter-spacing:1.5px;font-weight:750;color:var(--nk-accent);margin-bottom:10px}.hero h2{font-size:31px;letter-spacing:-1px;line-height:1.2;margin-bottom:10px}.hero p{max-width:540px;color:var(--secondary-text-color,#647771);font-size:14px}.hero-state{display:inline-flex;align-items:center;gap:6px;background:var(--nk-amber-soft);color:var(--nk-amber);font-size:12px;font-weight:650;padding:7px 11px;border-radius:24px;margin-top:18px}.hero-state.ready{background:var(--nk-accent-soft);color:var(--nk-accent)}.hero-state ha-icon{width:16px;height:16px;--mdc-icon-size:16px}
.score-ring{width:152px;height:152px;border-radius:50%;background:conic-gradient(var(--nk-accent) calc(var(--score)*1%),color-mix(in srgb,var(--nk-accent) 12%,transparent) 0);display:grid;place-items:center;position:relative}.score-ring>div{width:128px;height:128px;border-radius:50%;background:var(--card-background-color,#fff);display:flex;align-items:center;justify-content:center;flex-direction:column}.score-ring strong{font-size:35px;font-weight:750;letter-spacing:-1.5px}.score-ring span{font-size:11px;color:var(--secondary-text-color,#647771);margin-top:3px}
.quick-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0 28px}.quick-stat{background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#e0e7e4);border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:13px}.quick-stat>ha-icon{background:var(--nk-accent-soft);color:var(--nk-accent);width:42px;height:42px;--mdc-icon-size:22px;align-items:center;justify-content:center;border-radius:12px}.quick-stat span{display:block;font-size:12px;color:var(--secondary-text-color,#647771)}.quick-stat strong{display:block;font-size:23px;letter-spacing:-.6px;margin-top:3px}.quick-stat small{font-size:11px;color:var(--secondary-text-color,#647771)}
.overview-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.overview-heading h2{font-size:19px}.overview-heading span{font-size:12px;color:var(--secondary-text-color,#647771)}.category-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.category-card{text-align:left;display:flex;flex-direction:column;align-items:stretch;padding:18px;border-radius:14px;min-width:0}.category-card .category-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.category-card ha-icon{color:var(--tone,var(--nk-accent))}.category-card .category-percent{font-size:12px;color:var(--secondary-text-color,#647771);font-weight:500}.category-card h3{font-size:15px;margin-bottom:7px}.category-card strong{font-size:18px;letter-spacing:-.3px}.category-card small{font-size:11px;font-weight:400;color:var(--secondary-text-color,#647771);margin-top:5px;line-height:1.5;min-height:34px}.category-card .edit-hint{color:var(--nk-accent);font-size:11px;margin-top:12px}.progress-track{height:5px;border-radius:10px;overflow:hidden;background:var(--divider-color,#e3eae7);margin-top:15px}.progress-fill{height:100%;border-radius:10px;background:var(--tone,var(--nk-accent));width:var(--fill,0%)}
.overview-bottom{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;margin:24px 0}.attention-card,.guide-card{border:1px solid var(--divider-color,#e0e7e4);background:var(--card-background-color,#fff);border-radius:14px;padding:22px}.card-title{display:flex;align-items:center;gap:9px;margin-bottom:13px}.card-title ha-icon{color:var(--nk-accent)}.attention-row{display:flex;gap:11px;align-items:center;padding:12px 0;border-top:1px solid var(--divider-color,#e9eeec)}.attention-row>div{flex:1}.attention-row strong{display:block;font-size:13px;font-weight:650}.attention-row p{font-size:12px;color:var(--secondary-text-color,#647771)}.attention-row button{font-size:12px;min-height:34px;padding:5px 10px}.attention-row>ha-icon{color:var(--nk-amber);width:19px;height:19px;--mdc-icon-size:19px}.guide-card p{font-size:13px;color:var(--secondary-text-color,#647771)}.guide-card ol{padding-left:20px;line-height:1.7;color:var(--secondary-text-color,#647771);font-size:13px}.guide-card li{padding-left:4px;margin:7px 0}.subtle-note{font-size:11px;color:var(--secondary-text-color,#647771);line-height:1.6;margin:10px 0 20px}
form>section{background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#e0e7e4);border-radius:16px;padding:28px;margin-bottom:22px}.section-heading{display:flex;align-items:center;gap:11px;margin-bottom:10px}.section-heading ha-icon{color:var(--nk-accent);width:29px;height:29px;--mdc-icon-size:29px}.section-help{color:var(--secondary-text-color,#647771);font-size:13px;max-width:790px;margin-bottom:19px}.field{display:inline-flex;flex-direction:column;gap:8px;vertical-align:top;width:calc(50% - 12px);margin:10px 20px 12px 0;max-width:100%;font-size:12px;font-weight:650;line-height:1.4}.field:nth-of-type(even){margin-right:0}.field.wide{width:calc(100% - 20px)}input,textarea,select{width:100%;min-width:0;background:var(--primary-background-color,#f7f9f8);border:1px solid var(--divider-color,#dbe4df);border-radius:8px;padding:11px 12px;color:var(--primary-text-color,#233a35);font-size:15px;font-weight:400;min-height:44px}textarea{min-height:120px;resize:vertical}input[type=checkbox]{width:24px;height:24px;min-height:0;accent-color:var(--nk-accent)}input[readonly]{background:transparent;border-color:transparent;padding-left:0;font-weight:650}.checkbox-field{flex-direction:row;align-items:center;gap:12px}.checkbox-field input{order:-1}.item-list{margin:12px 0}.item-list fieldset{position:relative;border:1px solid var(--divider-color,#dfe7e2);padding:15px 20px 20px;border-radius:13px;margin:16px 0;background:var(--card-background-color,#fff)}fieldset legend{font-size:11px;font-weight:700;color:var(--secondary-text-color,#647771);padding:0 8px;text-transform:uppercase;letter-spacing:1px}.item-list fieldset>button{color:var(--nk-red);display:block;margin-top:6px;background:transparent}.item-list fieldset>p{font-size:12px;color:var(--nk-amber);background:var(--nk-amber-soft);border-radius:8px;padding:8px 12px}.checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.checklist fieldset{margin:0;padding:12px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}.checklist legend{display:none}.checklist .field{margin:0;width:auto;flex:1}.checklist .checkbox-field{flex:0;white-space:nowrap;font-size:11px}.checklist fieldset:has(input:checked){border-color:var(--nk-accent);background:var(--nk-accent-soft)}.checklist .field:has(input[readonly]){font-size:0}.checklist .field input[readonly]{font-size:14px}.checklist fieldset>button{font-size:11px;min-height:32px;margin:0}.advanced{margin-top:12px;font-size:12px;color:var(--secondary-text-color,#647771)}.advanced summary{cursor:pointer;padding:10px 0}.empty-state{text-align:center;padding:35px 20px;margin:15px 0;border:1px dashed var(--divider-color,#ccdcd3);border-radius:12px;background:var(--primary-background-color,#f7faf8)}.empty-state ha-icon{color:var(--nk-accent);--mdc-icon-size:34px;width:34px;height:34px;margin-bottom:10px}.empty-state h3{margin-bottom:5px}.empty-state p{font-size:13px;color:var(--secondary-text-color,#647771)}
.toolbar{position:sticky;bottom:12px;z-index:2;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:13px 17px;border:1px solid var(--divider-color,#dfe7e2);border-radius:13px;background:var(--card-background-color,#fff);box-shadow:0 4px 24px #0000000b}.toolbar p{font-size:12px;color:var(--secondary-text-color,#647771);flex:1;min-width:180px}.toolbar.dirty{border-color:var(--nk-amber)}.toolbar.dirty p{color:var(--nk-amber)}.toolbar-actions{display:flex;gap:8px}.discard-prompt{width:100%;display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:12px;padding-top:10px;border-top:1px solid var(--divider-color,#dde5e1)}.discard-prompt span{flex:1}.privacy-note{text-align:center;font-size:11px;color:var(--secondary-text-color,#647771);margin-top:18px}ha-menu-button{margin-left:-14px}
@media(max-width:1000px){.category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.category-card small{min-height:0}}@media(max-width:680px){main{padding:18px 14px}.app-header{gap:5px;margin-bottom:19px}.brand>ha-icon{width:37px;height:37px;--mdc-icon-size:29px}.brand{gap:9px}.brand h1{font-size:22px}.brand span{font-size:10px}.privacy-badge{display:none}.tabs{margin-bottom:18px}.tabs button{padding:10px 12px;font-size:12px}.tabs ha-icon{display:none}.hero{padding:22px;gap:14px;grid-template-columns:1fr auto;border-radius:15px}.hero h2{font-size:23px}.hero p{font-size:12px}.hero .eyebrow{font-size:9px}.score-ring{width:106px;height:106px}.score-ring>div{width:88px;height:88px}.score-ring strong{font-size:26px}.score-ring span{font-size:9px}.hero-state{font-size:10px;padding:6px 8px}.quick-stats{grid-template-columns:1fr;gap:8px;margin:12px 0 24px}.quick-stat{padding:12px 16px}.quick-stat>div{display:grid;grid-template-columns:1fr auto;flex:1;gap:0 10px;align-items:center}.quick-stat strong{grid-column:2;grid-row:1/3;font-size:21px}.quick-stat span{font-size:11px}.quick-stat small{font-size:10px}.category-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.category-card{padding:16px}.category-card:last-child{grid-column:1/-1}.category-card .category-top{margin-bottom:11px}.overview-heading{align-items:start}.overview-heading h2{font-size:17px}.overview-heading span{font-size:10px;max-width:90px;text-align:right}.overview-bottom{grid-template-columns:1fr;gap:12px}.attention-card,.guide-card{padding:18px}.field,.field.wide{width:100%;margin-right:0}form>section{padding:20px 16px}.checklist{grid-template-columns:1fr}.checklist .field{width:auto}.toolbar{bottom:8px;padding:12px;gap:9px}.toolbar p{flex-basis:100%;font-size:11px}.toolbar-actions{width:100%}.toolbar-actions button{flex:1;padding-inline:9px;font-size:12px}.privacy-note{font-size:10px}.hero-state ha-icon{display:none}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
    const main = element("main", undefined, this.shadowRoot);
    const header = element("header", undefined, main);
    header.className="app-header";
    const menu = element("ha-menu-button", undefined, header);
    menu.hass = this._hass;
    menu.narrow = this._narrow;
    const brand = element("div", undefined, header); brand.className="brand";
    this.icon(brand, "compass-outline");
    const brandText = element("div", undefined, brand);
    element("h1", "Noodkompas", brandText);
    element("span", "Voorbereid op 72 uur zelfredzaamheid", brandText);
    const privacy = element("span", undefined, header); privacy.className="privacy-badge";
    this.icon(privacy,"lock-outline");element("span","Lokaal & privé",privacy);
    this.tabs = element("nav", undefined, main); this.tabs.className="tabs";this.tabs.setAttribute("role","tablist");this.tabs.setAttribute("aria-label","Onderdelen Noodkompas");
    const tabs = [["overview","Overzicht","view-dashboard-outline"],["household","Huishouden","account-group-outline"],["water","Water","water-outline"],["food","Voedsel","food-apple-outline"],["energy","Energie","lightning-bolt-outline"],["kit","Noodpakket","bag-personal-outline"],["plan","Noodplan","map-marker-path"]];
    tabs.forEach(([key,title,iconName]) => {
      const button = this.button(this.tabs,"",()=>this.showTab(key));
      button.dataset.tab=key;button.id=`nk-tab-${key}`;button.setAttribute("role","tab");button.setAttribute("aria-controls",`nk-section-${key}`);
      this.icon(button,iconName);element("span",title,button);
      button.addEventListener("keydown",event=>{
        const keys=["ArrowLeft","ArrowRight","Home","End"];if(!keys.includes(event.key))return;
        event.preventDefault();const index=tabs.findIndex(item=>item[0]===this.activeTab);
        const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(index+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
        this.showTab(tabs[next][0]);this.tabs.children[next].focus();
      });
    });
    this.dashboard = element("div", undefined, main);
    this.dashboard.className = "dashboard";
    this.dashboard.id="nk-section-overview";this.dashboard.setAttribute("role","tabpanel");this.dashboard.setAttribute("aria-labelledby","nk-tab-overview");
    this._dashboardSignature = null;
    this.updateDashboard();
    this.form = element("form", undefined, main);
    this.form.noValidate = true;
    this.form.addEventListener("submit", event => {event.preventDefault(); this.save();});
    let section = this.section("Huishouden");
    for (const [key, label] of [["adults", "Volwassenen"], ["children", "Kinderen"], ["pets", "Huisdieren"]]) this.field(section, label, this.data.household, key, "number", {max:100, step:1});
    this.field(section, "Water per huisdier per dag (liter)", this.data.household, "pet_water_l_day", "number", {max:100});
    section = this.section("Water", "Standaard 3 liter per persoon per dag. Pas de behoefte aan je huishouden en huisdieren aan.");
    this.field(section, "Watervoorraad (liter)", this.data, "water_l", "number");
    this.field(section, "Liter per persoon per dag", this.data.settings, "water_l_person_day", "number", {min:0.1, max:100});
    section = this.section("Voedsel", "Persoonsdagen per eenheid: hoeveel dagen één persoon met één eenheid kan eten. Voer bijvoorbeeld 0,33 in voor één volledige maaltijd. Verlopen producten tellen niet mee. Laat de datum leeg voor producten die niet bederven, zoals zout of suiker. Huisdiervoer telt niet mee in deze menselijke voedselscore.");
    this.field(section, "Waarschuwen binnen aantal dagen", this.data.settings, "expiry_warning_days", "number", {max:365, step:1});
    this.rows(section, "food", (row, item) => {
      this.field(row, "Product", item, "name", "text", {required:true});
      this.field(row, "Hoeveelheid", item, "quantity", "number");
      this.field(row, "Eenheid (stuk, kg, blik)", item, "unit", "text", {maxLength:30, required:true});
      this.field(row, "Houdbaar tot (leeg = bederft niet)", item, "expires", "date");
      this.field(row, "Persoonsdagen per eenheid", item, "person_days", "number", {max:10000});
      const days = item.expires ? Math.floor((Date.parse(item.expires + "T00:00:00") - new Date().setHours(0,0,0,0)) / 86400000) : null;
      if (item.quantity > 0 && !(item.person_days > 0)) element("p", "Telt niet mee: vul de persoonsdagen per eenheid in", row);
      else if (item.quantity > 0 && days !== null && days < 0) element("p", "Verlopen — telt niet mee", row);
      else if (item.quantity > 0 && days !== null && days <= this.data.settings.expiry_warning_days) element("p", "Let op: bijna verlopen", row);
    }, () => ({name:"",quantity:1,unit:"stuk",expires:"",person_days:1}), 500);
    section = this.section("Energie", "Selecteer een sensor met Wh/kWh beschikbaar opgeslagen energie, of % laadniveau plus capaciteit. Een sensor vervangt de handmatige waarde. Gebruik geen cumulatieve verbruik-/opbrengstsensor. Vermijd dubbel tellen van dezelfde accu. Bij een onbekende sensor telt 0 Wh mee. Vul bij een thuisaccu, UPS of EV de capaciteit in; de reserve gaat dan van de beschikbare energie af. Een EV is alleen bruikbaar als je apparatuur de energie kan leveren.");
    this.field(section, "Benodigde energie per dag (Wh)", this.data.settings, "energy_wh_day", "number", {min:1});
    this.rows(section, "energy", (row, item) => {
      this.field(row, "Naam", item, "name", "text", {required:true});
      const label = element("label", "Categorie", row); label.className="field";
      const select = element("select", undefined, label);
      for (const [value, text] of Object.entries(categories)) {const option = element("option", text, select); option.value = value;}
      select.value = item.category;
      select.onchange = () => {item.category = select.value; this.markDirty();};
      const unitLabel = element("label", "Eenheid handmatige energie", row); unitLabel.className="field";
      const energyUnit = element("select", undefined, unitLabel);
      for (const unit of ["Wh", "kWh"]) {const option = element("option", unit, energyUnit); option.value = unit;}
      const storedInput = this.field(row, "Handmatig opgeslagen (gekozen eenheid)", item, "stored_wh", "number", {max:1000000000});
      energyUnit.addEventListener("change", () => {
        const factor = energyUnit.value === "kWh" ? 1000 : 1;
        storedInput.value = item.stored_wh / factor;
        storedInput.max = 1000000000 / factor;
      });
      storedInput.addEventListener("input", () => {item.stored_wh = storedInput.valueAsNumber * (energyUnit.value === "kWh" ? 1000 : 1);});
      const advanced = element("details", undefined, row); advanced.className="advanced";
      element("summary", "Geavanceerde sensorselectie", advanced);
      const pickerLabel = element("label", "Home Assistant energiesensor (optioneel)", advanced); pickerLabel.className="field wide";
      const picker = element("ha-entity-picker", undefined, pickerLabel);
      picker.hass = this._hass;
      picker.includeDomains = ["sensor"];
      picker.entityFilter = state => ["Wh", "kWh", "%"].includes(state.attributes.unit_of_measurement);
      picker.value = item.entity_id;
      // Ook bruikbaar als de HA-versie de picker nog niet heeft geladen.
      const sensorInput = this.field(advanced, "Sensor-ID (optioneel, sensor.…)", item, "entity_id", "text");
      picker.addEventListener("value-changed", event => {item.entity_id = event.detail.value || ""; sensorInput.value = item.entity_id; this.markDirty();});
      sensorInput.addEventListener("input", () => {picker.value = item.entity_id;});
      // De native keuzelijst werkt ook zonder een reeds geladen HA-picker.
      const fallbackLabel = element("label", "Beschikbare energiesensoren", row); fallbackLabel.className="field wide";
      const fallback = element("select", undefined, fallbackLabel);
      const noSensor = element("option", "Handmatige energie gebruiken", fallback); noSensor.value = "";
      const ids = new Set(Object.keys(this._hass.states).filter(id => id.startsWith("sensor.") && ["Wh", "kWh", "%"].includes(this._hass.states[id].attributes?.unit_of_measurement)));
      if (item.entity_id) ids.add(item.entity_id);
      for (const id of [...ids].sort()) {
        const state = this._hass.states[id];
        const option = element("option", `${state?.attributes?.friendly_name || id} (${id})`, fallback);option.value = id;
      }
      fallback.value = item.entity_id;
      fallback.addEventListener("change", () => {item.entity_id=fallback.value;sensorInput.value=item.entity_id;picker.value=item.entity_id;this.markDirty();});
      picker.addEventListener("value-changed", () => {fallback.value=item.entity_id;});
      sensorInput.addEventListener("input", () => {fallback.value=item.entity_id;});
      this.field(row, "Volledige capaciteit (Wh; verplicht bij % of EV)", item, "capacity_wh", "number", {max:1000000000});
      this.field(row, "Reserve die je niet gebruikt (% van capaciteit)", item, "reserve_pct", "number", {max:100});
    }, () => ({name:"",category:"powerbank",stored_wh:0,entity_id:"",capacity_wh:0,reserve_pct:0}), 100);
    section = this.section("Noodpakket", "Vink alleen items af die daadwerkelijk beschikbaar zijn. Standaarditems blijven behouden; voeg eigen items toe.");
    this.rows(section, "kit", (row, item) => {
      this.field(row, "Item", item, "name", "text", {required:true, readOnly:standardKit.includes(item.name)});
      this.field(row, "Aanwezig", item, "done", "checkbox");
    }, () => ({name:"",done:false}), 100, item => !standardKit.includes(item.name));
    section = this.section("Noodplan", "Spreek af waar je elkaar ontmoet en wie je belt. Een verzamelplaats en minimaal één contactpersoon maken je plan compleet; opmerkingen zijn optioneel. Deze gegevens zijn alleen zichtbaar voor beheerders.");
    this.field(section, "Verzamelplaats", this.data.plan, "meeting_place", "text", {maxLength:500});
    this.field(section, "Belangrijke opmerkingen", this.data.plan, "notes", "textarea", {maxLength:5000});
    const contacts = element("div", undefined, section);
    contacts.className="item-list";
    const drawContacts = () => {
      contacts.replaceChildren();
      this.data.plan.contacts.forEach((item,index) => {
        const row = element("fieldset", undefined, contacts);
        element("legend", `Contactpersoon ${index+1}`, row);
        this.field(row, "Naam", item, "name", "text", {required:true});
        this.field(row, "Telefoon / contactgegevens", item, "phone", "text", {required:true,maxLength:100});
        this.button(row,"Verwijderen",()=>{this.data.plan.contacts.splice(index,1);this.markDirty();drawContacts();});
      });
    };
    drawContacts();
    this.button(section,"Contactpersoon toevoegen",()=>{if(this.data.plan.contacts.length<50){this.data.plan.contacts.push({name:"",phone:""});this.markDirty();drawContacts();}});
    const toolbar = element("div", undefined, this.form);
    toolbar.className = "toolbar";
    this.status = element("p", "Je gegevens zijn lokaal opgeslagen.", toolbar);
    this.status.setAttribute("role", "status");
    const actions = element("div", undefined, toolbar);actions.className="toolbar-actions";
    this.button(actions,"Wijzigingen verwerpen",()=>{
      if (!this.dirty) {this.load();return;}
      if (this.discardPrompt) return;
      this.discardPrompt=element("div",undefined,toolbar);this.discardPrompt.className="discard-prompt";
      element("span","Je onopgeslagen wijzigingen worden verwijderd.",this.discardPrompt);
      this.button(this.discardPrompt,"Toch bewaren",()=>{this.discardPrompt.remove();this.discardPrompt=null;});
      this.button(this.discardPrompt,"Ja, verwerpen",()=>this.load());
    });
    this.saveButton=this.button(actions,"Opslaan",()=>this.save());this.saveButton.className="primary";
    this.discardPrompt=null;this.conflictPrompt=null;
    this.showTab(this.activeTab);
    element("p","Alleen beheerders hebben toegang. Je gegevens blijven op deze Home Assistant-installatie.",main).className="privacy-note";
  }

  icon(parent, name) {
    const icon = element("ha-icon", undefined, parent); icon.setAttribute("icon", `mdi:${name}`);icon.setAttribute("aria-hidden","true");return icon;
  }

  markDirty() {
    this.dirty = true;
    if (this.status) this.status.textContent="Je hebt onopgeslagen wijzigingen. Sla op om je overzicht bij te werken.";
    this.shadowRoot.querySelector(".toolbar")?.classList.add("dirty");
  }

  showTab(key) {
    this.activeTab = key;
    if(this.dashboard)this.dashboard.hidden=key!=="overview";
    this.form?.querySelectorAll("section[data-tab]").forEach(section=>{section.hidden=section.dataset.tab!==key;});
    this.tabs?.querySelectorAll("[role=tab]").forEach(button=>{
      const active=button.dataset.tab===key;
      button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1;
    });
  }

  updateDashboard(useSummary = false) {
    const keys=["score","72h_ready","water_score","food_score","energy_score","kit_score","plan_score","self_sufficiency_days","water_days","water_required","food_days","energy_available","expiring_items","expired_items","invalid_energy_sources"];
    const values=Object.fromEntries(keys.map(key=>{
      const state=this._hass.states[this.entities?.[key]];
      return [key,this.dirty||useSummary?this.summary[key]:state?.state??this.summary[key]];
    }));
    const signature=JSON.stringify(values);
    if(signature===this._dashboardSignature)return;
    this._dashboardSignature=signature;
    this.dashboard.replaceChildren();
    const numeric=key=>{
      const raw=values[key];
      return raw===null||raw===undefined||raw===""||typeof raw==="boolean"||!Number.isFinite(Number(raw))?null:Number(raw);
    };
    const format=(value,digits=1)=>value===null?"—":value.toLocaleString("nl-NL",{maximumFractionDigits:digits});
    const ready=values["72h_ready"]===true||values["72h_ready"]==="on";
    const score=numeric("score");
    const hero=element("div",undefined,this.dashboard);hero.className="hero";
    const heroText=element("div",undefined,hero);
    element("div","JOUW 72-UURSOVERZICHT",heroText).className="eyebrow";
    element("h2",ready?"Goed voorbereid.":"Voorbereid, stap voor stap.",heroText);
    element("p","Alles wat je nodig hebt om je huishouden drie dagen op weg te helpen, op één plek.",heroText);
    const state=element("div",undefined,heroText);state.className=`hero-state${ready?" ready":""}`;
    this.icon(state,ready?"check-circle-outline":"clock-outline");
    element("span",ready?"72 uur gereed":score===null?"Status onbekend":"Nog niet 72 uur gereed",state);
    const ring=element("div",undefined,hero);ring.className="score-ring";ring.style.setProperty("--score",String(Math.min(100,Math.max(0,score??0))));ring.setAttribute("role","img");ring.setAttribute("aria-label",`Totale gereedheid: ${score===null?"onbekend":format(score)+" procent"}`);
    const ringInside=element("div",undefined,ring);element("strong",score===null?"—":`${format(score)}%`,ringInside);element("span","gereedheid",ringInside);
    const stats=element("div",undefined,this.dashboard);stats.className="quick-stats";
    const energy=numeric("energy_available");
    for(const [icon,label,value,hint] of [
      ["shield-home-outline","Zelfredzaamheid",`${format(numeric("self_sufficiency_days"))} dagen`, "Doel: minimaal 3 dagen"],
      ["water-outline","Water voor 72 uur",`${format(numeric("water_required"))} liter`, "Benodigd voor je huishouden"],
      ["lightning-bolt-outline","Beschikbare energie",energy!==null&&energy>=1000?`${format(energy/1000,2)} kWh`:`${format(energy,0)} Wh`, "Na aftrek van de reserve"]]) {
      const card=element("div",undefined,stats);card.className="quick-stat";this.icon(card,icon);
      const content=element("div",undefined,card);element("span",label,content);element("strong",value,content);element("small",hint,content);
    }
    const heading=element("div",undefined,this.dashboard);heading.className="overview-heading";
    element("h2","Jouw voorbereiding",heading);element("span","Vijf onderdelen, één compleet plan",heading);
    const grid=element("div",undefined,this.dashboard);grid.className="category-grid";
    const categories=[
      ["water","Water","water-outline","water_score",`${format(numeric("water_days"))} / 3 dagen`,"Drinkwater en dagelijkse verzorging","var(--nk-blue)"],
      ["food","Voedsel","food-apple-outline","food_score",`${format(numeric("food_days"))} / 3 dagen`,"Houdbare voeding voor iedereen","var(--nk-accent)"],
      ["energy","Energie","lightning-bolt-outline","energy_score",energy!==null&&energy>=1000?`${format(energy/1000,2)} kWh`:`${format(energy,0)} Wh`,"Stroom voor wat echt nodig is","var(--nk-amber)"],
      ["kit","Noodpakket","bag-personal-outline","kit_score",numeric("kit_score")===100?"Compleet":"Checklist","Van zaklamp tot eerste hulp","var(--nk-accent)"],
      ["plan","Noodplan","map-marker-path","plan_score",numeric("plan_score")===100?"Compleet":"Jouw afspraken","Contacten en een verzamelplaats","var(--nk-blue)"]];
    for(const [tab,label,icon,key,detail,help,tone] of categories) {
      const card=this.button(grid,"",()=>this.showTab(tab));card.className="category-card";card.style.setProperty("--tone",tone);card.setAttribute("aria-label",`${label} bekijken en bewerken`);
      const top=element("div",undefined,card);top.className="category-top";this.icon(top,icon);
      const percent=numeric(key);element("span",percent===null?"Onbekend":`${format(percent)}%`,top).className="category-percent";
      element("h3",label,card);element("strong",detail,card);element("small",help,card);
      const track=element("div",undefined,card);track.className="progress-track";track.setAttribute("aria-hidden","true");
      const fill=element("div",undefined,track);fill.className="progress-fill";fill.style.setProperty("--fill",`${Math.min(100,Math.max(0,percent??0))}%`);
      element("span","Bekijken →",card).className="edit-hint";
    }
    const bottom=element("div",undefined,this.dashboard);bottom.className="overview-bottom";
    const attention=element("div",undefined,bottom);attention.className="attention-card";
    const title=element("div",undefined,attention);title.className="card-title";this.icon(title,"clipboard-check-outline");element("h3","Je volgende stappen",title);
    const suggestions=[];
    if((numeric("expired_items")??0)>0)suggestions.push(["food",`${format(numeric("expired_items"),0)} producten verlopen`,"Controleer en vervang je voorraad."]);
    if((numeric("expiring_items")??0)>0)suggestions.push(["food",`${format(numeric("expiring_items"),0)} producten bijna verlopen`,"Gebruik ze op tijd en vul je voorraad aan."]);
    if((numeric("invalid_energy_sources")??0)>0)suggestions.push(["energy","Controleer je energiesensoren",`${format(numeric("invalid_energy_sources"),0)} bronnen leveren geen bruikbare waarde.`]);
    if(numeric("water_score")!==null&&numeric("water_score")<100)suggestions.push(["water","Vul je watervoorraad aan",`Je doel is ${format(numeric("water_required"))} liter voor drie dagen.`]);
    if(numeric("food_score")!==null&&numeric("food_score")<100)suggestions.push(["food","Breng je voedselvoorraad op peil","Voeg houdbare producten toe voor drie dagen."]);
    if(numeric("energy_score")!==null&&numeric("energy_score")<100)suggestions.push(["energy","Controleer je noodenergie","Voeg je powerbanks en beschikbare accu's toe."]);
    if(numeric("kit_score")!==null&&numeric("kit_score")<100)suggestions.push(["kit","Loop je noodpakket na","Vink af wat je al in huis hebt."]);
    if(numeric("plan_score")!==null&&numeric("plan_score")<100)suggestions.push(["plan","Maak samen een noodplan","Leg een verzamelplaats en contactpersonen vast."]);
    if(!suggestions.length)element("p",ready?"Alle onderdelen zijn op orde. Controleer je voorraad regelmatig.":"Controleer of je gegevens en sensoren volledig beschikbaar zijn.",attention).className="section-help";
    for(const [tab,label,help] of suggestions.slice(0,3)) {
      const row=element("div",undefined,attention);row.className="attention-row";this.icon(row,"arrow-right-circle-outline");
      const content=element("div",undefined,row);element("strong",label,content);element("p",help,content);
      this.button(row,"Bekijk",()=>this.showTab(tab)).setAttribute("aria-label",label);
    }
    const guide=element("div",undefined,bottom);guide.className="guide-card";
    const guideTitle=element("div",undefined,guide);guideTitle.className="card-title";this.icon(guideTitle,"compass-outline");element("h3","Een klein begin helpt al",guideTitle);
    element("p","Je hoeft niet alles tegelijk te regelen. Werk stap voor stap aan een voorraad die bij jouw huishouden past.",guide);
    const steps=element("ol",undefined,guide);for(const label of ["Vul eerst je huishouden in.","Bekijk wat je al in huis hebt.","Vul aan en bespreek samen je plan."])element("li",label,steps);
    this.button(guide,"Huishouden instellen",()=>this.showTab("household"));
    element("p","Het overzicht toont de opgeslagen gegevens. De scores zijn een hulpmiddel, geen garantie op veiligheid.",this.dashboard).className="subtle-note";
  }

  showConflict() {
    // Een conflict is geen invoerfout: laat de gebruiker kiezen en behoud de invoer.
    this.status.textContent="Iemand anders heeft intussen opgeslagen. Je eigen invoer staat er nog.";
    if (this.conflictPrompt) return;
    const toolbar=this.shadowRoot.querySelector(".toolbar");
    this.conflictPrompt=element("div",undefined,toolbar);this.conflictPrompt.className="discard-prompt";
    element("span","Kies welke versie je wilt houden.",this.conflictPrompt);
    this.button(this.conflictPrompt,"Laatste versie laden",()=>{this.conflictPrompt=null;this.load();});
    this.button(this.conflictPrompt,"Mijn versie opslaan",async()=>{
      try {
        const latest=await this._hass.callWS({type:"noodkompas/get"});
        this.revision=latest.revision;
      } catch {
        this.status.textContent="Laden mislukt. Probeer het opnieuw.";return;
      }
      this.conflictPrompt?.remove();this.conflictPrompt=null;
      await this.save();
    });
  }

  async save() {
    if (this.busy || !this._hass.user?.is_admin) return;
    const invalid = [...this.form.querySelectorAll("input,textarea,select")].find(input=>!input.checkValidity());
    if (invalid) {
      const section=invalid.closest("section[data-tab]");if(section)this.showTab(section.dataset.tab);
      const detail=invalid.closest("details");if(detail)detail.open=true;
      invalid.reportValidity();invalid.focus();return;
    }
    if (this.data.household.adults + this.data.household.children < 1) {this.status.textContent="Vul minimaal één persoon in.";return;}
    this.busy=true;
    this.status.textContent="Je gegevens worden opgeslagen…";
    if(this.saveButton)this.saveButton.textContent="Opslaan…";
    this.form.querySelectorAll("button,input,textarea,select,ha-entity-picker").forEach(node=>node.disabled=true);
    try {
      const result = await this._hass.callWS({type:"noodkompas/save",snapshot:this.data,revision:this.revision});
      if (!this._hass.user?.is_admin) return;
      this.revision=result.revision;this.summary=result.summary;this.dirty=false;
      this.render();this.updateDashboard(true);this.status.textContent="Opgeslagen op deze Home Assistant-installatie.";
    } catch (error) {
      if (!this._hass.user?.is_admin) return;
      if (error?.code === "conflict") this.showConflict();
      else this.status.textContent="Opslaan mislukt. Controleer verplichte velden, unieke sensoren en datums.";
    } finally {
      this.busy=false;
      if(this.saveButton)this.saveButton.textContent="Opslaan";
      this.form?.querySelectorAll("button,input,textarea,select,ha-entity-picker").forEach(node=>node.disabled=false);
    }
  }
}
if (!customElements.get("noodkompas-panel")) customElements.define("noodkompas-panel",NoodkompasPanel);
