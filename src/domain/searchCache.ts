/** Short-lived, in-memory product results. Never stores supermarket authentication. */
export function createSearchCache<T extends {query:string;error?:unknown}>(fetchBatch:(queries:string[])=>Promise<T[]>,ttl=120000) {
 const cache=new Map<string,{answer:T;until:number}>();
 const pending=new Map<string,Promise<T>>();
 let generation=0;
 return {
  clear(){generation++;cache.clear();pending.clear();},
  async search(queries:string[]):Promise<T[]> {
   const missing=[...new Set(queries)].filter(q=>!pending.has(q)&&(cache.get(q)?.until??0)<=Date.now());
   if(missing.length){
    const current=generation;
    const batch=fetchBatch(missing);
    for(const query of missing){
     const promise=batch.then(answers=>{
      const answer=answers.find(a=>a.query===query);
      if(!answer)throw new Error('Product search returned an incomplete answer.');
      if(!answer.error&&current===generation)cache.set(query,{answer,until:Date.now()+ttl});
      return answer;
     });
     pending.set(query,promise);
     void promise.then(()=>{if(pending.get(query)===promise)pending.delete(query);},()=>{if(pending.get(query)===promise)pending.delete(query);});
    }
   }
   return Promise.all(queries.map(query=>pending.get(query)??Promise.resolve(cache.get(query)!.answer)));
  },
 };
}
