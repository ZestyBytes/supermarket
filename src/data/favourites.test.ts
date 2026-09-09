import {describe,it,expect} from 'vitest';
import {toCanonical} from '../domain/units';
import {RECIPES} from './recipes';
import {INGREDIENTS} from './ingredients';
import {FAVOURITE_RECIPES} from './favouriteRecipes';
import {matchesMeal} from '../domain/mealSearch';
import {mealPhoto} from '../ui/MealPhoto';
describe('Favourite dinner library',()=>{
 it('adds 43 distinct dinners with valid quantities and photographs',()=>{
  expect(FAVOURITE_RECIPES).toHaveLength(43);
  expect(new Set(RECIPES.map(r=>r.id)).size).toBe(RECIPES.length);
  expect(new Set(INGREDIENTS.map(i=>i.id)).size).toBe(INGREDIENTS.length);
  for(const recipe of RECIPES){
   const photo=mealPhoto(recipe.id);
   expect(photo,recipe.name).not.toBeNull();
   expect(photo!.file).toMatch(/^(meals|favourites-[1-4])\.webp$/);
   for(const line of recipe.ingredients){
    expect(line.qty).toBeGreaterThan(0);
    expect(()=>toCanonical(line.qty,line.unit,INGREDIENTS.find(i=>i.id===line.ingredientId)!)).not.toThrow();
   }
  }
 });
 it.each([['spag bol','bolognese'],['Kiev’s','kievs'],['Fish + Chips','fish-chips'],['salmon + veg','salmon-potatoes'],['Surf and turf','surf-turf']])('finds %s', (query,id)=>{
  expect(RECIPES.filter(r=>matchesMeal(r,query)).map(r=>r.id)).toContain(id);
 });
});
