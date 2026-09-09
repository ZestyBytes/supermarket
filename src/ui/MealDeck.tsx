import {useState} from 'react';
import type {Ingredient, PlannedMeal,Recipe} from '../domain/types';
import {MealPhoto} from './MealPhoto';
import {Icon} from './Icon';
import {matchesMeal} from '../domain/mealSearch';
import {mealStock, type Stock} from '../domain/stock';
interface Props {
 recipes:Recipe[];plan:PlannedMeal[];ingredients:Ingredient[];
 onAdd:(id:string)=>void;onRemove:(id:string)=>void;
 /** What Tesco has said so far, filled in while you browse. */
 stock:Stock;
}
export function MealDeck({recipes,plan,ingredients,onAdd,onRemove,stock}:Props) {
 const [query,setQuery]=useState(''); const [open,setOpen]=useState<string|null>(null);
 const chosen=new Set(plan.map(m=>m.recipeId));
 const order=new Map(plan.map((m,i)=>[m.recipeId,i]));
 const filtered=recipes.filter(r=>matchesMeal(r,query,ingredients)).sort((a,b)=>{
  const inA=order.has(a.id), inB=order.has(b.id);
  if(inA&&inB) return order.get(a.id)!-order.get(b.id)!;
  if(inA!==inB) return inA?-1:1;
  return 0;
 });
 return <section id="choose-meals" className="fresh-library" aria-label="Choose dinners">
   <label className="fresh-search"><Icon name="search"/><input type="search" aria-label="Search meals" placeholder="Find a favourite" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <ul className="fresh-grid" aria-label="Meals to choose from">{filtered.map(recipe=>{
     const selected=chosen.has(recipe.id);
     const have=mealStock(recipe,stock,ingredients);
     return <li className={`fresh-card${selected?' is-selected':''}${have.state==='short'?' is-short':''}`} key={recipe.id}>
       <button className="fresh-photo-button" aria-label={`View ${recipe.name} ingredients`} aria-expanded={open===recipe.id} onClick={()=>setOpen(open===recipe.id?null:recipe.id)}><MealPhoto id={recipe.id}/>{selected&&<span className="photo-check"><Icon name="check"/></span>}
        {have.state==='short'&&<span className="photo-short" title={`Tesco has no ${have.missing.join(', ')}`}>{have.missing.length} missing</span>}
       </button>
       <div className="fresh-card-body"><h2>{recipe.name}</h2><div className="fresh-card-bottom"><span><Icon name="clock"/>{recipe.minutes} min</span><button className="meal-toggle" aria-pressed={selected} aria-label={`${selected?'Remove':'Add'} ${recipe.name}`} onClick={()=>selected?onRemove(recipe.id):onAdd(recipe.id)}><Icon name={selected?'check':'plus'}/></button></div></div>
       {open===recipe.id&&<div className="fresh-details">
        {have.state==='short'&&<p className="fresh-missing">Tesco has nothing for {have.missing.join(', ')} — the rest of this meal can still be bought.</p>}
        <p>{recipe.blurb}</p><ul>{recipe.ingredients.map(line=><li key={line.ingredientId}>{ingredients.find(i=>i.id===line.ingredientId)?.name}{line.prep&&` · ${line.prep}`}</li>)}</ul><button onClick={()=>setOpen(null)}>Close details</button></div>}
     </li>;
   })}</ul>{!filtered.length&&<p className="fresh-no-results">No meals match “{query}”. Try another name.</p>}
 </section>;
}
