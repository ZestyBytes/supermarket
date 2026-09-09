import type { BasketState } from './useBasket';
import {Icon} from './Icon';
export function Connection({state,onOpenSettings}:{state:BasketState;onOpenSettings:()=>void}) {
 const bad=state.phase==='offline'||state.phase==='disconnected';
 const checking=state.phase==='connecting';
 return <button className={`connection-pill${bad?' connection-pill--bad':''}`} onClick={onOpenSettings} aria-label={bad?'Tesco needs attention. Open settings':'Tesco connection settings'}>
  <span className={`connection-dot${checking?' is-loading':''}`} aria-hidden="true"/>
  <span>{state.mode==='mock'?'Demo preview':bad?'Reconnect Tesco':checking?'Connecting':'Tesco connected'}</span><Icon name="down" size={13}/>
 </button>;
}
