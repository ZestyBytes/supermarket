import type {RetailerProduct} from './liveMatch';
const varieties:Record<string,{core:RegExp;exclude:RegExp;exact:RegExp}>={
 mushroom:{core:/\bmushrooms?\b/i,exclude:/soup|sauce|risotto|pie|pasta|stuffed|dried|powder|tinned|canned|pickled/i,exact:/chestnut/i},
 cheddar:{core:/\bcheddar\b/i,exclude:/sauce|crisp|cracker|biscuit|spread|dip|vegan|dairy.free/i,exact:/mature|vintage/i},
};
export function suitableVarieties(id:string,products:RetailerProduct[]) {
 const rule=varieties[id];
 return rule?products.filter(p=>rule.core.test(p.title)&&!rule.exclude.test(p.title)):products;
}
export function preferredVarieties(id:string,products:RetailerProduct[]) {
 const rule=varieties[id];
 if(!rule)return products;
 const exact=products.filter(p=>rule.exact.test(p.title));
 return exact.length?exact:products;
}
export function isAlternativeVariety(id:string,title:string,widened:boolean) {
 const rule=varieties[id];
 return rule?!rule.exact.test(title):widened;
}
