import {FAVOURITE_PHOTO_IDS} from '../data/favouriteRecipes';
const ids = ['bolognese','fajitas','cottage-pie','chicken-curry','salmon-potatoes','chilli','sausage-mash','shepherds-pie','mac-cheese','chickpea-curry','chicken-traybake','omelette'];
export function mealPhoto(id:string) {
 const favourite=FAVOURITE_PHOTO_IDS.indexOf(id);
 if(favourite>=0) {
  const sheet=Math.floor(favourite/12)+1, index=favourite%12;
  return {file:`favourites-${sheet}.webp`,position:`${[2,50,98][index%3]}% ${(sheet===4?[2,50,98]:[1,33,66,99])[Math.floor(index/3)]}%`,size:sheet===4?'330% 330%':'330% 440%'};
 }
 const index=ids.indexOf(id);
 return index<0?null:{file:'meals.png',position:`${[2,50,98][index%3]}% ${[0,30,61,93][Math.floor(index/3)]}%`,size:'330% 440%'};
}
/** Illustrative generated meal photography; one shared asset avoids twelve downloads. */
export function MealPhoto({ id }: { id: string }) {
  const photo=mealPhoto(id);
  return <div aria-hidden="true" className="food-photo" style={photo?{backgroundImage:`url(${import.meta.env.BASE_URL}images/${photo.file})`,backgroundPosition:photo.position,backgroundSize:photo.size}:undefined} />;
}
