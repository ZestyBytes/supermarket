import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../../browser-extension/popup.js',import.meta.url),'utf8');
async function popup(fail=false) {
 const nodes={'#keep':{checked:false},'#status':{},'#connect':{}};
 const local={keepConnected:false}; let listener;
 const chrome={storage:{local:{get:async()=>({...local}),set:async value=>{Object.assign(local,value);listener();}},session:{get:async()=>({status:'Ready.'})},onChanged:{addListener:fn=>{listener=fn;}}},runtime:{sendMessage:async()=>{if(fail)throw new Error('worker missing');return {ok:true};}}};
 runInNewContext(source,{document:{querySelector:id=>nodes[id]},chrome});
 await new Promise(resolve=>setImmediate(resolve));
 return {nodes,local};
}
it('persists the checkbox despite storage updates during its change handler',async()=>{
 const {nodes,local}=await popup();
 nodes['#keep'].checked=true;
 await nodes['#keep'].onchange();
 expect(local.keepConnected).toBe(true);
 expect(nodes['#keep'].checked).toBe(true);
 nodes['#keep'].checked=false;
 await nodes['#keep'].onchange();
 expect(local.keepConnected).toBe(false);
});
it('keeps the preference and gives reload instructions if the worker fails',async()=>{
 const {nodes,local}=await popup(true);
 nodes['#keep'].checked=true;
 await nodes['#keep'].onchange();
 expect(local.keepConnected).toBe(true);
 expect(nodes['#keep'].disabled).toBe(false);
 expect(nodes['#status'].textContent).toContain('chrome://extensions');
});
it('shows connection worker failures instead of leaving Connecting on screen',async()=>{
 const {nodes}=await popup(true);
 await nodes['#connect'].onclick();
 expect(nodes['#status'].textContent).toContain('did not respond');
});
