/* Catalogue for Ridgeway Market. Prices in GBP.
   unit  - shelf-edge unit price, the legally required "price per" line
   badge - shelf tag: offer | new | own  */
const AISLES = [
  { id: "produce",   no: 1, name: "Fruit & Veg" },
  { id: "bakery",    no: 2, name: "Bakery" },
  { id: "dairy",     no: 3, name: "Dairy & Eggs" },
  { id: "butcher",   no: 4, name: "Meat & Fish" },
  { id: "cupboard",  no: 5, name: "Cupboard" },
  { id: "frozen",    no: 6, name: "Frozen" },
  { id: "drinks",    no: 7, name: "Drinks" },
  { id: "household", no: 8, name: "Household" }
];

const PRODUCTS = [
  { id: "p01", aisle: "produce",  name: "Loose bananas",            size: "per kg",       price: 1.12, unit: "£1.12/kg",    was: null,  badge: null,    emoji: "🍌" },
  { id: "p02", aisle: "produce",  name: "Braeburn apples",          size: "6 pack",       price: 1.95, unit: "£2.44/kg",    was: null,  badge: null,    emoji: "🍎" },
  { id: "p03", aisle: "produce",  name: "Vine tomatoes",            size: "400g",         price: 1.45, unit: "£3.63/kg",    was: 1.85,  badge: "offer", emoji: "🍅" },
  { id: "p04", aisle: "produce",  name: "Maris Piper potatoes",     size: "2.5kg",        price: 2.40, unit: "96p/kg",      was: null,  badge: "own",   emoji: "🥔" },
  { id: "p05", aisle: "produce",  name: "Baby spinach",             size: "200g",         price: 1.20, unit: "£6.00/kg",    was: null,  badge: null,    emoji: "🥬" },
  { id: "p06", aisle: "produce",  name: "Avocados, ripe & ready",   size: "2 pack",       price: 1.90, unit: "95p each",    was: null,  badge: null,    emoji: "🥑" },

  { id: "p07", aisle: "bakery",   name: "Seeded sourdough",         size: "800g",         price: 2.75, unit: "34p/100g",    was: null,  badge: null,    emoji: "🍞" },
  { id: "p08", aisle: "bakery",   name: "White farmhouse loaf",     size: "800g",         price: 1.15, unit: "14p/100g",    was: null,  badge: "own",   emoji: "🥖" },
  { id: "p09", aisle: "bakery",   name: "All-butter croissants",    size: "4 pack",       price: 1.80, unit: "45p each",    was: 2.25,  badge: "offer", emoji: "🥐" },

  { id: "p10", aisle: "dairy",    name: "Semi-skimmed milk",        size: "2 pints",      price: 1.35, unit: "£1.19/litre", was: null,  badge: null,    emoji: "🥛" },
  { id: "p11", aisle: "dairy",    name: "Free range eggs, large",   size: "6 pack",       price: 2.20, unit: "37p each",    was: null,  badge: null,    emoji: "🥚" },
  { id: "p12", aisle: "dairy",    name: "Mature cheddar",           size: "350g",         price: 3.50, unit: "£1.00/100g",  was: null,  badge: "own",   emoji: "🧀" },
  { id: "p13", aisle: "dairy",    name: "Greek style yoghurt",      size: "500g",         price: 1.65, unit: "33p/100g",    was: null,  badge: null,    emoji: "🍶" },
  { id: "p14", aisle: "dairy",    name: "Salted butter block",      size: "250g",         price: 2.10, unit: "84p/100g",    was: 2.60,  badge: "offer", emoji: "🧈" },

  { id: "p15", aisle: "butcher",  name: "British chicken breasts",  size: "650g",         price: 5.25, unit: "£8.08/kg",    was: null,  badge: null,    emoji: "🍗" },
  { id: "p16", aisle: "butcher",  name: "Beef mince, 5% fat",       size: "500g",         price: 4.40, unit: "£8.80/kg",    was: null,  badge: null,    emoji: "🥩" },
  { id: "p17", aisle: "butcher",  name: "Scottish salmon fillets",  size: "2 x 120g",     price: 4.95, unit: "£20.63/kg",   was: 5.75,  badge: "offer", emoji: "🐟" },
  { id: "p18", aisle: "butcher",  name: "Cumberland sausages",      size: "6 pack",       price: 3.20, unit: "£7.11/kg",    was: null,  badge: "own",   emoji: "🌭" },

  { id: "p19", aisle: "cupboard", name: "Wholewheat fusilli",       size: "500g",         price: 0.95, unit: "19p/100g",    was: null,  badge: "own",   emoji: "🍝" },
  { id: "p20", aisle: "cupboard", name: "Chopped tomatoes",         size: "400g tin",     price: 0.55, unit: "14p/100g",    was: null,  badge: null,    emoji: "🥫" },
  { id: "p21", aisle: "cupboard", name: "Extra virgin olive oil",   size: "500ml",        price: 6.40, unit: "£1.28/100ml", was: null,  badge: "new",   emoji: "🫒" },
  { id: "p22", aisle: "cupboard", name: "Porridge oats",            size: "1kg",          price: 1.30, unit: "£1.30/kg",    was: null,  badge: null,    emoji: "🥣" },

  { id: "p23", aisle: "frozen",   name: "Garden peas",              size: "900g",         price: 1.75, unit: "£1.94/kg",    was: null,  badge: null,    emoji: "🫛" },
  { id: "p24", aisle: "frozen",   name: "Chunky oven chips",        size: "1.5kg",        price: 2.15, unit: "£1.43/kg",    was: null,  badge: "own",   emoji: "🍟" },
  { id: "p25", aisle: "frozen",   name: "Salted caramel ice cream", size: "480ml",        price: 3.25, unit: "68p/100ml",   was: 4.00,  badge: "offer", emoji: "🍨" },

  { id: "p26", aisle: "drinks",   name: "Breakfast tea bags",       size: "160 bags",     price: 2.85, unit: "1.8p/bag",    was: null,  badge: null,    emoji: "🫖" },
  { id: "p27", aisle: "drinks",   name: "Ground coffee, medium",    size: "227g",         price: 4.10, unit: "£1.81/100g",  was: null,  badge: "new",   emoji: "☕" },
  { id: "p28", aisle: "drinks",   name: "Orange juice, smooth",     size: "1 litre",      price: 1.60, unit: "£1.60/litre", was: null,  badge: null,    emoji: "🧃" },
  { id: "p29", aisle: "drinks",   name: "Sparkling water",          size: "6 x 500ml",    price: 1.45, unit: "48p/litre",   was: null,  badge: "own",   emoji: "💧" },

  { id: "p30", aisle: "household",name: "Washing-up liquid",        size: "900ml",        price: 1.90, unit: "21p/100ml",   was: null,  badge: null,    emoji: "🧴" },
  { id: "p31", aisle: "household",name: "Kitchen roll",             size: "2 rolls",      price: 2.30, unit: "£1.15/roll",  was: null,  badge: "own",   emoji: "🧻" },
  { id: "p32", aisle: "household",name: "Non-bio laundry liquid",   size: "35 washes",    price: 5.50, unit: "16p/wash",    was: 7.00,  badge: "offer", emoji: "🧺" }
];

const SLOTS = [
  { id: "s1", day: "Today",    window: "18:00 – 19:00", fee: 4.50, left: 2 },
  { id: "s2", day: "Tomorrow", window: "07:00 – 08:00", fee: 2.50, left: 6 },
  { id: "s3", day: "Tomorrow", window: "12:00 – 13:00", fee: 0.00, left: 11 },
  { id: "s4", day: "Thursday", window: "17:00 – 18:00", fee: 1.50, left: 4 }
];
