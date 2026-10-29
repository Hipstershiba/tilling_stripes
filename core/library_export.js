// Scoped library exports. ZIP uses stored entries (no compression), per PKWARE APPNOTE.
// https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
(function () {
  const copy = value => JSON.parse(JSON.stringify(value));
  function selectGroups(library, groupIds) {
    if (!library || !Array.isArray(library.groups) || !Array.isArray(library.families)) throw new Error('Biblioteca inválida.');
    const ids = new Set(groupIds);
    if (!ids.size) throw new Error('Selecione pelo menos um conjunto.');
    if ([...ids].some(id => !library.groups.some(group => group.id === id))) throw new Error('Conjunto não encontrado. Reabra a exportação.');
    const result = copy(library);
    result.groups = result.groups.filter(group => ids.has(group.id));
    result.families = result.families.filter(family => ids.has(family.groupId));
    return result;
  }
  function safeName(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100) || 'subtile';
  }
  function svgEntries(library, options) {
    const files = [{name:'biblioteca.json', data:JSON.stringify(library, null, 2)}];
    const names = new Set(['biblioteca.json']);
    library.families.forEach(family => {
      const group = library.groups.find(item => item.id === family.groupId);
      if (!group) throw new Error('A família não pertence aos conjuntos exportados.');
      const transforms = options.includeVariants ? [...new Set(options.transforms?.(family.id) || ['id'])] : ['id'];
      transforms.forEach(transform => {
        const svg = options.render(family, {size:1000,transform,fgColor:'#000000',includeBackground:false,paddingRatio:0});
        if (typeof svg !== 'string' || !svg.includes('<svg')) throw new Error(`Não foi possível exportar ${family.name}.`);
        const base = `${safeName(group.name)}_${safeName(group.id)}/${safeName(family.name)}_${safeName(family.id)}_${safeName(transform)}`;
        let name = base + '.svg', suffix = 2;
        while (names.has(name)) name = `${base}_${suffix++}.svg`;
        names.add(name); files.push({name, data:svg});
      });
    });
    return files;
  }
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function storedZip(entries) {
    if (!entries.length || entries.length > 65535) throw new Error('Quantidade de arquivos não suportada. Exporte menos conjuntos.');
    const encoder = new TextEncoder(), local = [], directory = [], paths = new Set();
    let offset = 0, directorySize = 0;
    for (const entry of entries) {
      const path = String(entry.name).replace(/\\/g, '/');
      if (!path || path.startsWith('/') || path.includes(':') || path.split('/').some(part => part === '..') || paths.has(path)) throw new Error('Nome de arquivo inválido ou repetido.');
      paths.add(path);
      const name = encoder.encode(path), data = typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
      if (!(data instanceof Uint8Array) || name.length > 65535 || data.length >= 0xffffffff) throw new Error('Arquivo grande demais para este pacote.');
      const crc = crc32(data);
      const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
      h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(6,0x800,true);
      h.setUint16(12,33,true); h.setUint32(14,crc,true); h.setUint32(18,data.length,true); h.setUint32(22,data.length,true);
      h.setUint16(26,name.length,true); header.set(name,30);
      const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
      c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x800,true);
      c.setUint16(14,33,true); c.setUint32(16,crc,true); c.setUint32(20,data.length,true); c.setUint32(24,data.length,true);
      c.setUint16(28,name.length,true); c.setUint32(42,offset,true); central.set(name,46);
      local.push(header,data); directory.push(central); offset += header.length + data.length; directorySize += central.length;
      if (offset + directorySize + 22 >= 0xffffffff) throw new Error('Pacote grande demais. Exporte menos conjuntos.');
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0,0x06054b50,true); e.setUint16(8,entries.length,true); e.setUint16(10,entries.length,true);
    e.setUint32(12,directorySize,true); e.setUint32(16,offset,true);
    const output = new Uint8Array(offset + directorySize + end.length);
    let cursor = 0;
    for (const bytes of [...local,...directory,end]) { output.set(bytes,cursor); cursor += bytes.length; }
    return output;
  }

  const win = typeof window !== 'undefined' ? window : null;
  const doc = typeof document !== 'undefined' ? document : null;
  let snapshot = null, returnFocus = null, opened = false;
  const el = id => doc?.getElementById(id);
  const selectedIds = () => Array.from(el('libraryExportGroups').querySelectorAll('input:checked')).map(input => input.value);
  function update() {
    const ids = selectedIds(), selected = snapshot.families.filter(family => ids.includes(family.groupId));
    el('libraryExportSummary').textContent = `${ids.length} ${ids.length === 1 ? 'conjunto' : 'conjuntos'} • ${selected.length} ${selected.length === 1 ? 'família' : 'famílias'}`;
    el('btnLibraryExportSave').disabled = !selected.length;
    const zip = el('libraryExportFormat').value === 'svg';
    el('libraryExportVariantsRow').classList.toggle('hidden', !zip);
    el('libraryExportError').classList.add('hidden');
  }
  function open() {
    if (!el('libraryExportDialog') || !win.LibraryStore) return false;
    snapshot = JSON.parse(win.LibraryStore.exportLibraryJSON({customOnly:false}));
    returnFocus = doc.activeElement;
    const filter = el('tileLibraryGroupFilter')?.value;
    const current = win.TileRegistry?.getFamilyById(win.SubtileStudioUI?.state.selectedFamilyId)?.groupId;
    const initial = filter || current;
    const host = el('libraryExportGroups'); host.replaceChildren();
    snapshot.groups.forEach(group => {
      const count = snapshot.families.filter(family => family.groupId === group.id).length;
      const label = doc.createElement('label'); label.className = 'library-export-group';
      const input = doc.createElement('input'); input.type = 'checkbox'; input.value = group.id; input.checked = group.id === initial && count > 0; input.disabled = !count;
      const name = doc.createElement('span'); name.textContent = group.name;
      const counter = doc.createElement('span'); counter.className = 'library-export-count'; counter.textContent = `${count} ${count === 1 ? 'família' : 'famílias'}`;
      input.addEventListener('change',update); label.append(input,name,counter); host.appendChild(label);
    });
    opened = true; el('libraryExportDialog').classList.remove('hidden'); update();
    (host.querySelector('input:checked') || host.querySelector('input:not(:disabled)') || el('libraryExportFormat')).focus();
    return true;
  }
  function close() {
    opened = false; el('libraryExportDialog')?.classList.add('hidden');
    const target = returnFocus?.isConnected && !returnFocus.closest('[hidden], .hidden') ? returnFocus : el('menu-library');
    target?.focus();
  }
  function save() {
    try {
      const selected = selectGroups(snapshot,selectedIds());
      const format = el('libraryExportFormat').value;
      const base = selected.groups.length === 1 ? safeName(selected.groups[0].name) : `conjuntos_${selected.groups.length}`;
      let data, type, extension;
      if (format === 'svg') {
        const entries = svgEntries(selected, {includeVariants:el('libraryExportVariants').checked,
          transforms:id=>win.TileRegistry.getFamilyById(id)?.variantTransforms || ['id'],
          render:(family,options)=>win.VectorBoolean.exportFamilyToSVG(family,options)});
        data = storedZip(entries); type = 'application/zip'; extension = 'zip';
      } else { data=JSON.stringify(selected,null,2); type='application/json'; extension='json'; }
      const url = URL.createObjectURL(new Blob([data],{type}));
      const link = doc.createElement('a'); link.href=url; link.download=`tiling_stripes_${base}.${extension}`;
      doc.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      close();
    } catch (error) {
      el('libraryExportError').textContent = error.message; el('libraryExportError').classList.remove('hidden');
    }
  }
  function init() {
    if (!el('libraryExportDialog')) return;
    el('btnExportLibraryGroups')?.addEventListener('click',open);
    el('btnLibraryExportCancel').addEventListener('click',close);
    el('btnLibraryExportSave').addEventListener('click',save);
    el('libraryExportFormat').addEventListener('change',update);
    el('btnLibraryExportAll').addEventListener('click',()=>{el('libraryExportGroups').querySelectorAll('input:not(:disabled)').forEach(input=>input.checked=true);update();});
    el('btnLibraryExportNone').addEventListener('click',()=>{el('libraryExportGroups').querySelectorAll('input').forEach(input=>input.checked=false);update();});
    doc.addEventListener('keydown',event=>{
      if (!opened) return;
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {event.preventDefault();close();return;}
      if (event.key === 'Tab') {
        const list=Array.from(el('libraryExportDialog').querySelectorAll('button:not(:disabled),input:not(:disabled),select')).filter(item=>!item.closest('.hidden'));
        const first=list[0],last=list[list.length-1];
        if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
      }
    },true);
  }
  const api={selectGroups,svgEntries,storedZip,crc32,open,isOpen:()=>opened};
  if(win)win.LibraryExport=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(doc){if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})();
