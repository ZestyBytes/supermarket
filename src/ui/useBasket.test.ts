import {createElement} from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useBasket,type BasketState} from './useBasket';
import type {Requirement} from '../domain/types';
import * as client from '../domain/retailerClient';
vi.mock('../domain/retailerClient',async()=>{
 const actual=await vi.importActual<typeof client>('../domain/retailerClient');
 return {...actual,getSession:vi.fn(),readBasket:vi.fn(),searchBatch:vi.fn(),addToBasket:vi.fn(),removeFromBasket:vi.fn(),clearSearchCache:vi.fn()};
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
it('shows reconnection instructions without searching when Tesco is signed out',async()=>{
 vi.mocked(client.getSession).mockResolvedValue({mode:'live',session:{present:false}});
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 expect(state.phase).toBe('disconnected');
 expect(state.items[0].why).toContain('Reconnect Tesco');
 expect(client.searchBatch).not.toHaveBeenCalled();
});
it('does not automatically refill a basket after the user empties it',async()=>{
 vi.mocked(client.searchBatch).mockImplementation(async queries=>queries.map(query=>({query,results:[{id:'123',title:'Onions 3 pack',price:1}]})));
 vi.mocked(client.readBasket).mockResolvedValue({total:1,items:[{id:'123',title:'Onions',qty:1,price:1}]});
 vi.mocked(client.removeFromBasket).mockResolvedValue({removed:['123'],failed:[],basket:{total:0,items:[]}});
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
 await act(async()=>{await state.empty();});
 await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
 expect(client.removeFromBasket).toHaveBeenCalledTimes(1);
 expect(client.addToBasket).not.toHaveBeenCalled();
});
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
it('does nothing to the basket until it is asked to',async()=>{
 // The whole point of the button coming back: no write happens because you
 // looked at a meal, only because you pressed.
 vi.mocked(client.searchBatch).mockImplementation(async queries=>queries.map(query=>({query,results:[{id:'123',title:'Onions 3 pack',price:1}]})));
 vi.mocked(client.addToBasket).mockResolvedValue({added:[{productId:'123'}],failed:[],basket:{total:1,items:[{id:'123',title:'Onions',price:1,qty:1}]}});
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
 expect(client.addToBasket).not.toHaveBeenCalled();
 expect(state.outstanding).toEqual({adding:1,removing:0});
});
it('applies the difference when pressed, with absolute quantities',async()=>{
 vi.mocked(client.searchBatch).mockImplementation(async queries=>queries.map(query=>({query,results:[{id:'123',title:'Onions 3 pack',price:1}]})));
 vi.mocked(client.addToBasket).mockResolvedValue({added:[{productId:'123'}],failed:[],basket:{total:1,items:[{id:'123',title:'Onions',price:1,qty:1}]}});
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
 await act(async()=>{state.sendNow();});
 expect(client.addToBasket).toHaveBeenCalledTimes(1);
 // Absolute, so pressing again corrects the basket instead of doubling it.
 expect(vi.mocked(client.addToBasket).mock.calls[0][2]).toBe(true);
 expect(state.items[0].state).toBe('added');
 expect(state.outstanding).toEqual({adding:0,removing:0});
});
it('takes a line back out when it is ticked off as already in the cupboard',async()=>{
 // One press, both directions: this is why the button applies a difference
 // rather than only adding.
 vi.mocked(client.searchBatch).mockImplementation(async queries=>queries.map(query=>({query,results:[{id:'123',title:'Onions 3 pack',price:1}]})));
 vi.mocked(client.addToBasket).mockResolvedValue({added:[{productId:'123'}],failed:[],basket:{total:1,items:[{id:'123',title:'Onions',price:1,qty:1}]}});
 vi.mocked(client.removeFromBasket).mockResolvedValue({removed:[{productId:'123'}],failed:[],basket:{total:0,items:[]}});
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
 await act(async()=>{state.sendNow();});
 expect(state.items[0].state).toBe('added');
 await act(async()=>{view.update(createElement(Harness,{items:[]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
 expect(state.outstanding).toEqual({adding:0,removing:1});
 await act(async()=>{state.sendNow();});
 expect(client.removeFromBasket).toHaveBeenCalledTimes(1);
 expect(vi.mocked(client.removeFromBasket).mock.calls[0][1]).toEqual(['123']);
});
it('will not send twice while a send is still going',async()=>{
 vi.mocked(client.searchBatch).mockImplementation(async queries=>queries.map(query=>({query,results:[{id:'123',title:'Onions 3 pack',price:1}]})));
 let finish!:(v:Awaited<ReturnType<typeof client.addToBasket>>)=>void;
 vi.mocked(client.addToBasket).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await act(async()=>{view=create(createElement(Harness,{items:[req]}));});
 await act(async()=>{await vi.advanceTimersByTimeAsync(200);});
 await act(async()=>{state.sendNow();state.sendNow();});
 expect(client.addToBasket).toHaveBeenCalledTimes(1);
 await act(async()=>{finish({added:[{productId:'123'}],failed:[],basket:{total:1,items:[{id:'123',title:'Onions',price:1,qty:1}]}});});
});
