import type {Recipe} from '../domain/types';
import {INGREDIENTS} from './ingredients';
type Dinner = [id:string,name:string,minutes:number,description:string,ingredients:string];
// Quantities serve four. Prepared components are named explicitly rather than
// pretending that a ready-made food is a from-scratch recipe.
const dinners: Dinner[] = [
 ['stuffed-peppers','Stuffed Peppers',55,'Beef and rice-filled peppers with melted cheddar.','pepper:4 beef-mince:400 rice:150 chopped-tomatoes:400 onion:1 cheddar:100 olive-oil:15 oregano:2'],
 ['roast-dinner','Roast Dinner',120,'Roast chicken, potatoes, carrots, parsnips, greens and gravy.','whole-chicken:1600 potato:1000 carrot:400 parsnip:400 green-beans:300 gravy:40 olive-oil:45'],
 ['fry-up','Fry Up',35,'A full English with sausages, bacon, eggs, beans, mushrooms and toast.','sausage:8 bacon:250 egg:4 baked-beans:800 mushroom:250 tomato:300 bread:200 butter:30'],
 ['satay-chicken','Satay Chicken',35,'Chicken in a peanut and coconut sauce, with rice and cucumber.','chicken-breast:700 rice:300 peanut-butter:100 coconut-milk:400 soy:30 lime:1 cucumber:250 olive-oil:15'],
 ['stir-fry','Stir Fry',25,'Chicken, peppers and greens tossed with egg noodles.','chicken-breast:600 egg-noodle:300 pepper:2 carrot:200 pak-choi:250 soy:45 ginger:20 garlic:2 olive-oil:20'],
 ['salad','Salad',25,'Grilled chicken salad with avocado, tomatoes and lemon dressing.','chicken-breast:600 lettuce:250 cucumber:300 tomato:300 avocado:2 lemon:1 olive-oil:30'],
 ['kievs','Chicken Kievs',40,'Ready-prepared garlic butter chicken kyivs, oven chips and peas.','chicken-kiev:600 chips:800 peas:300'],
 ['jacket-potato','Jacket Potato',80,'Baked potatoes with baked beans, cheddar and side salad.','potato:1200 baked-beans:800 cheddar:160 salad-leaf:120 butter:40'],
 ['pizza','Pizza',30,'Pizza dough topped with tomato, mozzarella, mushrooms and peppers.','pizza-base:600 passata:250 mozzarella:250 mushroom:150 pepper:1 oregano:2'],
 ['enchiladas','Enchiladas',45,'Chicken and black bean tortillas baked in tomato sauce with cheese.','chicken-breast:500 tortilla:8 black-beans:400 passata:500 onion:1 fajita-mix:30 cheddar:150 olive-oil:15'],
 ['meatballs','Meatballs',45,'Homemade beef meatballs in tomato sauce with spaghetti.','beef-mince:600 breadcrumbs:50 egg:1 spaghetti:350 passata:700 onion:1 garlic:2 parmesan:40 olive-oil:15'],
 ['fish-chips','Fish & Chips',40,'Breadcrumb-coated cod with oven chips and garden peas.','white-fish:600 chips:800 peas:300 breadcrumbs:100 egg:2 flour:50 lemon:1 olive-oil:20'],
 ['thai','Thai Green Curry',35,'Thai green chicken curry with coconut milk, peppers and rice.','chicken-thigh:700 thai-paste:100 coconut-milk:400 pepper:2 green-beans:200 rice:300 fish-sauce:15 lime:1'],
 ['paella','Paella',50,'A family chicken, prawn and chorizo rice pan.','chicken-thigh:400 prawns:200 chorizo:100 paella-rice:300 pepper:1 onion:1 chopped-tomatoes:400 stock:800 paprika:5 olive-oil:20'],
 ['gnocchi','Gnocchi',25,'Potato gnocchi in tomato sauce with spinach and mozzarella.','gnocchi:800 passata:500 spinach:150 mozzarella:200 garlic:2 olive-oil:15'],
 ['med-veg','Mediterranean Veg',45,'Roasted Mediterranean vegetables with chickpeas and feta.','courgette:400 aubergine:400 pepper:2 onion:1 tomato:300 chickpeas:400 feta:200 olive-oil:40 oregano:3'],
 ['tacos','Tacos',30,'Soft beef tacos with crunchy lettuce, salsa and cheddar.','beef-mince:500 tortilla:8 lettuce:150 tomato:200 cheddar:100 salsa:150 fajita-mix:30 olive-oil:15'],
 ['hunters-chicken','Hunters Chicken',45,'Chicken wrapped in bacon, topped with barbecue sauce and cheddar; chips alongside.','chicken-breast:700 bacon:200 bbq-sauce:200 cheddar:120 chips:800 green-beans:250'],
 ['ham-egg-chips','Ham, Egg & Chips',35,'Thick-cut ham with fried eggs and oven chips.','ham:400 egg:8 chips:800 peas:300 olive-oil:15'],
 ['toad-in-hole','Toad in the Hole',55,'Sausages baked in Yorkshire pudding batter with onion gravy and peas.','sausage:8 flour:200 egg:3 milk:300 olive-oil:30 onion:2 stock:400 peas:300'],
 ['quiche','Quiche',60,'Bacon and cheddar quiche with a crisp side salad.','shortcrust:375 bacon:200 egg:4 cream:250 cheddar:100 onion:1 salad-leaf:150'],
 ['burritos','Burritos',40,'Chicken, rice and black bean burritos with salsa and cheese.','chicken-breast:500 rice:200 black-beans:400 tortilla:8 salsa:200 cheddar:100 fajita-mix:30 olive-oil:15'],
 ['pad-thai','Pad Thai',30,'Chicken and rice noodles with egg, beansprouts, peanuts and lime.','chicken-breast:500 rice-noodle:300 egg:2 beansprout:200 pad-thai-sauce:200 peanut:60 lime:1 spring-onion:80 olive-oil:20'],
 ['nasi-goreng','Nasi Goreng',35,'Indonesian-style chicken fried rice with vegetables and fried eggs.','rice:300 chicken-breast:400 egg:4 carrot:150 peas:150 spring-onion:80 kecap:60 garlic:2 olive-oil:30'],
 ['katsu-curry','Katsu Curry',40,'Crispy breaded chicken with katsu sauce, rice and shredded carrot.','chicken-breast:700 breadcrumbs:120 egg:2 flour:60 katsu-sauce:400 rice:300 carrot:200 olive-oil:30'],
 ['burgers','Burgers',30,'Beef cheeseburgers in buns with salad and oven chips.','burger:600 burger-bun:4 cheddar:80 lettuce:100 tomato:200 chips:600'],
 ['hot-dogs','Hot Dogs',25,'Frankfurters in rolls with fried onions and mustard.','hotdog:400 hotdog-roll:4 onion:2 mustard:30 chips:600 olive-oil:15'],
 ['pulled-pork','Pulled Pork',250,'Slow-roasted pork shoulder in barbecue sauce, served in buns with salad.','pork-shoulder:1000 bbq-sauce:250 burger-bun:4 onion:1 salad-leaf:150 paprika:5'],
 ['fish-cakes','Fish Cakes',30,'Ready-prepared salmon fishcakes, new potatoes and green beans.','fish-cake:600 potato:700 green-beans:300 lemon:1 butter:25'],
 ['soup','Tomato Soup',35,'Tomato and carrot soup with buttered bread.','chopped-tomatoes:800 carrot:250 onion:1 stock:600 cream:100 bread:400 butter:40 olive-oil:15'],
 ['ribs','Ribs',150,'Slow-roasted barbecue pork ribs with oven chips and salad.','pork-ribs:1500 bbq-sauce:250 chips:800 salad-leaf:150'],
 ['pork-chops','Pork Chops',40,'Pan-fried pork chops with mash, green beans and mustard sauce.','pork-chop:900 potato:1000 green-beans:300 milk:150 butter:50 cream:150 mustard:25'],
 ['beef-wellington','Beef Wellington',100,'Beef fillet wrapped in mushrooms and puff pastry, with potatoes and greens.','beef-fillet:800 mushroom:500 puff-pastry:500 mustard:30 egg:1 potato:800 green-beans:300 olive-oil:30'],
 ['chicken-parm','Chicken Parm',45,'Breaded chicken baked with tomato, mozzarella and parmesan, served with spaghetti.','chicken-breast:700 breadcrumbs:100 egg:2 flour:50 passata:500 mozzarella:200 parmesan:50 spaghetti:300 olive-oil:30'],
 ['mussels','Mussels',30,'Mussels in a garlic cream broth with crusty bread.','mussels:2000 garlic:4 cream:200 stock:300 onion:1 bread:400 butter:30'],
 ['dumplings','Dumplings',25,'Ready-prepared chicken gyoza with rice, pak choi and soy dipping sauce.','dumpling:600 rice:250 pak-choi:300 soy:40 spring-onion:60 olive-oil:15'],
 ['pie','Chicken & Mushroom Pie',65,'Chicken and mushroom filling under a puff-pastry lid, with peas.','chicken-thigh:700 mushroom:250 onion:1 stock:400 cream:150 flour:30 puff-pastry:375 egg:1 peas:300 olive-oil:15'],
 ['fish-fingers','Fish Fingers',30,'Cod fish fingers with oven chips and peas.','fish-finger:600 chips:800 peas:300'],
 ['steak','Steak',35,'Sirloin steak with oven chips, mushrooms and tomatoes.','beef-steak:800 chips:800 mushroom:250 tomato:300 butter:40 olive-oil:15'],
 ['surf-turf','Surf & Turf',40,'Sirloin steak and garlic prawns with chips and green beans.','beef-steak:700 prawns:300 chips:800 green-beans:300 garlic:3 butter:50'],
 ['lasagne','Lasagne',80,'Beef and tomato lasagne with a homemade white sauce and cheddar top.','beef-mince:600 lasagne-sheet:250 passata:700 onion:1 garlic:2 milk:600 butter:50 flour:50 cheddar:150 olive-oil:15'],
 ['satay-noodle-bowl','Satay Noodle Bowl',30,'Chicken and egg noodles with peanut sauce, crunchy vegetables and lime.','chicken-breast:500 egg-noodle:300 peanut-butter:100 coconut-milk:200 soy:30 carrot:200 cucumber:200 lime:1 olive-oil:15'],
 ['risotto','Mushroom Risotto',40,'Creamy mushroom risotto with parmesan and spinach.','risotto-rice:320 mushroom:400 onion:1 stock:1200 parmesan:80 butter:40 spinach:100'],
];
export const FAVOURITE_RECIPES: Recipe[] = dinners.map(([id,name,minutes,blurb,lines])=>({
 id,name,minutes,blurb,serves:4,emoji:'',tags:['favourites'],
 ingredients:lines.split(' ').map(item=>{
   const [ingredientId,quantity]=item.split(':');
   const ingredient=INGREDIENTS.find(i=>i.id===ingredientId);
   if(!ingredient) throw new Error(`Unknown ingredient ${ingredientId} in ${id}`);
   return {ingredientId,qty:Number(quantity),unit:ingredient.unit};
 }),
}));
export const FAVOURITE_PHOTO_IDS = dinners.map(d=>d[0]);
export const MEAL_ALIASES: Record<string,string[]> = {
 bolognese:['spag bol'], fajitas:['fajitas'], 'chicken-curry':['curry'], 'salmon-potatoes':['salmon + veg','salmon and veg'], omelette:['omelette'],
 kievs:["kiev’s","kiev's",'kievs','kyivs'], thai:['thai'], soup:['soup'], pie:['pie'], 'surf-turf':['surf and turf'], 'chicken-parm':['chicken parmesan'],
};
