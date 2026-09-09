const ids = ['bolognese','fajitas','cottage-pie','chicken-curry','salmon-potatoes','chilli','sausage-mash','shepherds-pie','mac-cheese','chickpea-curry','chicken-traybake','omelette'];
/** Illustrative generated meal photography; one shared asset avoids twelve downloads. */
export function MealPhoto({ id }: { id: string }) {
  const index = Math.max(0, ids.indexOf(id));
  return <div aria-hidden="true" className="food-photo" style={{backgroundImage:`url(${import.meta.env.BASE_URL}images/meals.png)`,backgroundPosition:`${[2,50,98][index % 3]}% ${[0,30,61,93][Math.floor(index / 3)]}%`}} />;
}
