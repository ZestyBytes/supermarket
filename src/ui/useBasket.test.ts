import {createElement} from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useBasket,type BasketState} from './useBasket';
import type {Requirement} from '../domain/types';
import * as client from '../domain/retailerClient';
vi.mock('../domain/retailerClient',async()=>{
 const actual=await vi.importActual<typeof client>('../domain/retailerClient');
 return {...actual,getSession:vi.fn(),readBasket:vi.fn(),searchBatch:vi.fn(),addToBasket:vi.fn(),clearSearchCache:vi.fn()};
});
const req:Requirement={ingredient:{id:'onion',name:'Onions',unit:'each',aisle:'produce'},qty:1,unit:'each',sources:[]};
let state:BasketState;
let view:ReactTestRenderer;
function Harness({items}:{items:Requirement[]}){state=useBasket(items);return null;}
beforeEach(()=>{
 vi.useFakeTimers();vi.clearAllMocks();
 vi.mocked(client.getSession).mockResolvedValue({mode:'mock',session:{present:true}});
 vi.mocked(client.readBasket).mockResolvedValue({items:[],total:0});
 vi.mocked(client.searchBatch).mockImplementation(async queries=>queries.map(query=>({query,results:[]})));
});
afterEach(()=>{if(view)act(()=>view.unmount());vi.useRealTimers();});
it('finishes matching without restarting when its phase changes',async()=>{
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
 expect(state.phase).toBe('armed');
 expect(state.progress).toEqual({done:1,total:1});
 await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
 expect(client.searchBatch).toHaveBeenCalledTimes(1);
});
it('debounces rapid selections and returns to ready when the list is empty',async()=>{
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{view.update(createElement(Harness,{items:[{...req,qty:2}]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
 expect(client.searchBatch).toHaveBeenCalledTimes(1);
 await act(async()=>{view.update(createElement(Harness,{items:[]}));});
 expect(state.phase).toBe('ready');expect(state.match).toBeNull();
});
it('does not loop on a failed search',async()=>{
 vi.mocked(client.searchBatch).mockRejectedValue(new Error('temporary failure'));
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
 expect(state.problem).toBe('temporary failure');
 expect(client.searchBatch).toHaveBeenCalledTimes(1);
});
it('submits once and uses the verified result rather than old basket quantities',async()=>{
 vi.mocked(client.searchBatch).mockImplementation(async queries=>queries.map(query=>({query,results:[{id:'123',title:'Onions 3 pack',price:1}]})));
 let finish!:(value:Awaited<ReturnType<typeof client.addToBasket>>)=>void;
 vi.mocked(client.addToBasket).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
 expect(state.match?.choices).toHaveLength(1);
 await act(async()=>{void state.add();void state.add();});
 expect(client.addToBasket).toHaveBeenCalledTimes(1);
 expect(state.phase).toBe('adding');
 await act(async()=>{finish({added:[],failed:[{productId:'123'}],basket:{total:3,items:[{id:'123',title:'Onions',price:1,qty:3}]}});});
 expect(state.items[0].state).toBe('failed');
});
