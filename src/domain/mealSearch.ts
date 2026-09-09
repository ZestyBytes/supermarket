import type {Recipe} from './types';
import {MEAL_ALIASES} from '../data/favouriteRecipes';
const normalise=(value:string)=>value.toLowerCase().replace(/[’']/g,'').replace(/\band\b|[+&]/g,' ').replace(/\s+/g,' ').trim();
export function matchesMeal(recipe:Recipe,query:string) {
 return [recipe.name,...(MEAL_ALIASES[recipe.id]??[])].some(name=>normalise(name).includes(normalise(query)));
}
