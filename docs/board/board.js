'use strict';
const states=['Backlog','Ready','In progress','Review','Blocked','Done'];
let items=[];
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n};
function render(){
 const q=document.querySelector('#search').value.toLowerCase(), phase=document.querySelector('#phase').value, priority=document.querySelector('#priority').value;
 const filtered=items.filter(i=>(!phase||i.phase===phase)&&(!priority||i.priority===priority)&&JSON.stringify(i).toLowerCase().includes(q));
 const board=document.querySelector('#board');board.replaceChildren();
 for(const state of states){const col=el('section',null,'column');col.setAttribute('aria-label',state);const selected=filtered.filter(i=>i.status===state);const h=el('h2',state);h.append(el('span',String(selected.length),'count'));col.append(h);
 for(const i of selected){const card=el('details');card.id=i.id;const summary=el('summary');const meta=el('span',null,'meta');meta.append(el('span',i.id),el('span',`${i.priority} · ${i.size}`));summary.append(meta,el('span',i.title,'title'),el('span',i.phase,'tag'));card.append(summary);const d=el('div',null,'detail');d.append(el('p',`Owner: ${i.owner}`),el('p',`Dependencies: ${i.dependencies.join(', ')||'None'}`),el('h3','Acceptance criteria'));const ul=el('ul');for(const a of i.acceptance)ul.append(el('li',a));d.append(ul);if(i.notes)d.append(el('p',i.notes));card.append(d);col.append(card)}
 if(!selected.length)col.append(el('p','No items','empty'));board.append(col)}
 document.querySelector('#status').textContent=`Showing ${filtered.length} of ${items.length} items`;
}
fetch('backlog.json').then(r=>{if(!r.ok)throw Error('Could not load backlog');return r.json()}).then(data=>{items=data.items;document.querySelector('#total').textContent=items.length;document.querySelector('#done').textContent=items.filter(i=>i.status==='Done').length;for(const p of [...new Set(items.map(i=>i.phase))]){const o=el('option',p);o.value=p;document.querySelector('#phase').append(o)}render()}).catch(()=>{document.querySelector('#status').textContent='Could not load the backlog. Refresh this page or open the rollout plan above.'});
for(const id of ['search','phase','priority'])document.getElementById(id).addEventListener('input',render);
document.querySelector('#reset').onclick=()=>{for(const id of ['search','phase','priority'])document.getElementById(id).value='';render()};
