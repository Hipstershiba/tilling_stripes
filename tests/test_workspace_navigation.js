// Navigation must preserve the document and recover focus across page/menu boundaries.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
class Element {
  constructor(id, tagName='DIV') {
    this.id=id; this.tagName=tagName; this.attrs={}; this.handlers={}; this.dataset={}; this.isConnected=true;
    const values=new Set();
    this.classList={add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),toggle(v,on){if(on===undefined) on=!values.has(v);on?values.add(v):values.delete(v);return on;}};
  }
  setAttribute(k,v){this.attrs[k]=v;}
  getAttribute(k){return this.attrs[k] ?? null;}
  removeAttribute(k){delete this.attrs[k];}
  addEventListener(k,fn){this.handlers[k]=fn;}
  querySelectorAll(){return [];}
  focus(){documentStub.activeElement=this;}
  contains(target){for(let node=target;node;node=node.parentElement) if(node===this)return true;return false;}
  closest(selector){
    for(let node=this;node;node=node.parentElement){
      if(selector.startsWith('#') && node.id===selector.slice(1))return node;
      if(selector==='[hidden], .hidden' && (node.hidden||node.classList.contains('hidden')))return node;
      if(selector==='input,select,textarea' && ['INPUT','SELECT','TEXTAREA'].includes(node.tagName))return node;
    }
    return null;
  }
}
const ids=['library-page','libraryPageTitle','panel-tile-library-mgr','librarySelectionName','librarySelectionPreview','btnEditLibraryPiece','btnCloseLibrary','menu-library','app-menubar','menu-file','file-popup'];
const nodes=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const editor=new Element('editor-tool','BUTTON'), search=new Element('library-search','INPUT');
const body=new Element('body'); body.dataset={studioMode:'mosaic'};
const documentEvents={}, windowEvents={};
const documentStub={readyState:'complete',body,activeElement:editor,getElementById:id=>nodes[id]||null,
  querySelector:()=>null,querySelectorAll:selector=>selector==='.app-menu-trigger'?[nodes['menu-file']]:[],
  addEventListener:(key,fn)=>{documentEvents[key]=fn;}};
nodes['library-page'].hidden=true; nodes['library-page'].classList.add('hidden');
nodes.libraryPageTitle.parentElement=nodes['library-page']; search.parentElement=nodes['library-page'];
const group=new Element('group');group.parentElement=nodes['app-menubar'];nodes['menu-file'].parentElement=group;
nodes['menu-file'].setAttribute('aria-controls','file-popup');nodes['file-popup'].classList.add('hidden');
const originalState={selectedFamilyId:'family-A',zoom:125,tool:'paint',seed:1024,selectedShapeIds:['shape-1']};
const studioState=JSON.parse(JSON.stringify(originalState));
let prepared=0, refreshed=0, pushes=0;
const location={pathname:'/studio',search:'',hash:''};
const updateUrl=url=>{location.hash=url.includes('#')?url.slice(url.indexOf('#')):'';};
const windowStub={location,history:{pushState(_a,_b,url){pushes++;updateUrl(url);},replaceState(_a,_b,url){updateUrl(url);}},
  addEventListener:(key,fn)=>{windowEvents[key]=fn;},
  TileRegistry:{getFamilyById:id=>id==='family-A'?{name:'Família A'}:null},
  SubtileStudioUI:{state:studioState,prepareNavigation(){prepared++;},refresh(){refreshed++;}}};
const context={window:windowStub,document:documentStub,module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../core/workspace_navigation.js'),'utf8'),context);
const navigation=context.module.exports;
assert.equal(navigation.isLibraryOpen(),false);
assert.equal(navigation.openLibrary(),true);
assert.equal(nodes['library-page'].hidden,false);
assert(body.classList.contains('library-page-open'));
assert.equal(documentStub.activeElement,nodes.libraryPageTitle);
assert.equal(nodes.librarySelectionName.textContent,'Família A');
assert.equal(location.hash,'#biblioteca');
navigation.openLibrary();
assert.equal(prepared,1,'Repeated opens must not re-finalize editor gestures');
assert.equal(pushes,1,'Repeated opens must not add duplicate history entries');
navigation.closeLibrary();
assert.equal(documentStub.activeElement,editor,'Returning restores the previously focused tool');
assert.equal(nodes['library-page'].hidden,true);
assert.equal(location.hash,'');
assert.deepStrictEqual(studioState,originalState,'Library navigation must preserve document, zoom, tool and selection');
assert(refreshed>=2);
navigation.openLibrary();location.hash='';windowEvents.popstate();
assert.equal(navigation.isLibraryOpen(),false,'Browser Back returns to the editor');
location.hash='#biblioteca';windowEvents.hashchange();
assert.equal(navigation.isLibraryOpen(),true,'Library deep links open the page');
function event(key,target){return {key,target,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};}
let escape=event('Escape',search);documentEvents.keydown(escape);
assert.equal(navigation.isLibraryOpen(),true,'Escape in a search field must not leave the Library');
escape=event('Escape',nodes.libraryPageTitle);documentEvents.keydown(escape);
assert.equal(navigation.isLibraryOpen(),false);assert(escape.prevented&&escape.stopped);
const arrow=event('ArrowDown',nodes['menu-file']);documentEvents.keydown(arrow);
assert.equal(nodes['menu-file'].getAttribute('aria-expanded'),'true');
assert.equal(documentStub.activeElement,nodes['menu-file'],'Menus with no enabled actions keep focus on a visible trigger');
documentEvents.keydown(event('Escape',nodes['menu-file']));
assert.equal(nodes['menu-file'].getAttribute('aria-expanded'),'false');
assert.equal(documentStub.activeElement,nodes['menu-file']);
console.log('✓ Library page preserves editor state, browser navigation, focus and input Escape behavior.');
console.log('✓ Menu keyboard focus remains visible when every command is disabled.');
