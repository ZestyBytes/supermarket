import type {Ingredient, Recipe} from './types';
import {MEAL_ALIASES} from '../data/favouriteRecipes';
const normalise=(value:string)=>value.toLowerCase().replace(/[’']/g,'').replace(/\band\b|[+&]/g,' ').replace(/\s+/g,' ').trim();

/**
 * Match a meal by name, by a name people actually use for it, or by something
 * in it: "chicken" should find the curry, not just a dish called chicken.
 */
export function matchesMeal(recipe:Recipe,query:string,ingredients:Ingredient[]=[]) {
 const needle=normalise(query);
 if(!needle) return true;
 const names=[recipe.name,...(MEAL_ALIASES[recipe.id]??[]),...recipe.tags];
 if(names.some(name=>normalise(name).includes(needle))) return true;
 return recipe.ingredients.some(line=>{
  const ingredient=ingredients.find(i=>i.id===line.ingredientId);
  return ingredient!==undefined&&normalise(ingredient.name).includes(needle);
 });
}
