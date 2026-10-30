(function () {
  function init() {
    const dialog = document.createElement('dialog');
    dialog.id = 'studioColorDialog';
    dialog.setAttribute('aria-label', 'Cor');
    dialog.innerHTML = '<div class="color-picker-heading"><strong>Cor</strong><select id="colorModel" aria-label="Modelo de cor"><option>RGB</option><option>HSB</option></select></div><div id="colorPreview"></div><div id="colorChannels"></div><label>Hex <input id="colorHex" maxlength="7" aria-label="Cor hexadecimal"></label><div class="color-picker-swatches"></div><div class="color-picker-actions"><button type="button" id="colorCancel">Cancelar</button><button type="button" id="colorApply">Aplicar</button></div>';
    document.body.appendChild(dialog);
    let target, rgb = [0, 0, 0];
    const model = dialog.querySelector('#colorModel'), channels = dialog.querySelector('#colorChannels');
    const hex = () => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    function hsv() {
      const [r,g,b] = rgb.map(v=>v/255), max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
      let h=d ? (max===r ? ((g-b)/d+6)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4)*60 : 0;
      return [h, max ? d/max*100 : 0, max*100];
    }
    function fromHSV([h,s,v]) {
      s/=100; v/=100; const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
      const a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
      return a.map(n=>Math.round((n+m)*255));
    }
    function paint() {
      dialog.querySelector('#colorPreview').style.background = hex();
      dialog.querySelector('#colorHex').value = hex();
    }
    function render() {
      const hsb=model.value==='HSB', values=hsb?hsv():rgb, names=hsb?['H','S','B']:['R','G','B'];
      channels.replaceChildren();
      names.forEach((name,i)=>{
        const row=document.createElement('label'); row.className='color-channel';
        const max=hsb?(i===0?360:100):255;
        row.innerHTML='<span>'+name+'</span><input type="range" min="0" max="'+max+'" step="1" aria-label="'+name+'"><input type="number" min="0" max="'+max+'" step="1" aria-label="Valor '+name+'">';
        const inputs=row.querySelectorAll('input'); inputs.forEach(input=>{
          input.value=Math.round(values[i]);
          input.addEventListener('input',()=>{
            values[i]=Math.max(0,Math.min(max,Number(input.value)||0));
            inputs.forEach(other=>{if(other!==input)other.value=values[i];});
            rgb=hsb?fromHSV(values):values.slice(); paint();
          });
        }); channels.appendChild(row);
      }); paint();
    }
    const swatches=dialog.querySelector('.color-picker-swatches');
    ['#000000','#ffffff','#e2e0dc','#808080','#ef4444','#f59e0b','#facc15','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899'].forEach(color=>{
      const b=document.createElement('button'); b.type='button'; b.style.background=color; b.title=color; b.setAttribute('aria-label',color);
      b.addEventListener('click',()=>{rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));render();});swatches.appendChild(b);
    });
    model.addEventListener('change',render);
    dialog.querySelector('#colorHex').addEventListener('change',e=>{let value=e.target.value.trim();if(/^#?[\da-f]{6}$/i.test(value)){value=value.replace('#','');rgb=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16));render();}else paint();});
    dialog.querySelector('#colorCancel').addEventListener('click',()=>dialog.close());
    dialog.querySelector('#colorApply').addEventListener('click',()=>{target.value=hex();target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));dialog.close();target.focus();});
    ['fgColorPicker','bgColorPicker'].forEach(id=>{
      const field=document.getElementById(id); field?.addEventListener('click',e=>{e.preventDefault();target=field;rgb=[1,3,5].map(i=>parseInt(field.value.slice(i,i+2),16));render();dialog.showModal();});
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
