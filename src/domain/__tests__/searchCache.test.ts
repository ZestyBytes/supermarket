import {it,expect,vi} from 'vitest';
import {createSearchCache} from '../searchCache';
it('shares in-flight ingredient searches and reuses successful answers',async()=>{
 let finish!:(v:{query:string}[])=>void;
 const fetch=vi.fn(()=>new Promise<{query:string}[]>(resolve=>{finish=resolve;}));
 const cache=createSearchCache(fetch);
 const first=cache.search(['chicken','rice']);
 const second=cache.search(['rice']);
 finish([{query:'chicken'},{query:'rice'}]);
 expect(await first).toHaveLength(2);
 expect(await second).toEqual([{query:'rice'}]);
 await cache.search(['chicken']);
 expect(fetch).toHaveBeenCalledTimes(1);
});
it('does not cache failed answers and invalidates on reconnection',async()=>{
 const fetch=vi.fn(async(queries:string[])=>queries.map(query=>({query,error:'expired'})));
 const cache=createSearchCache(fetch);
 await cache.search(['milk']);await cache.search(['milk']);
 expect(fetch).toHaveBeenCalledTimes(2);
 cache.clear();await cache.search(['milk']);
 expect(fetch).toHaveBeenCalledTimes(3);
});
it('only requests newly selected ingredients',async()=>{
 const fetch=vi.fn(async(queries:string[])=>queries.map(query=>({query})));
 const cache=createSearchCache(fetch);
 await cache.search(['chicken','rice']);
 await cache.search(['chicken','onion']);
 expect(fetch.mock.calls[1][0]).toEqual(['onion']);
});
it('does not retain stale pending results after reconnection',async()=>{
 let finish!:(v:{query:string}[])=>void;
 const fetch=vi.fn(()=>new Promise<{query:string}[]>(resolve=>{finish=resolve;}));
 const cache=createSearchCache(fetch);
 const first=cache.search(['milk']);cache.clear();finish([{query:'milk'}]);await first;
 const second=cache.search(['milk']);finish([{query:'milk'}]);await second;
 expect(fetch).toHaveBeenCalledTimes(2);
});
