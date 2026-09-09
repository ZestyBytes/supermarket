# Fresh Market

Approved concept: A, Fresh Market. Implement with semantic responsive controls, not a screenshot of the mockup.

- White canvas, deep green #15533d actions, #112c23 headings, #596b63 secondary copy.
- Public Sans typography, clear compact headings. No condensed serif headings or emoji imagery.
- Two columns of square food photographs on mobile, three on desktop. Visible meal names, preparation time and 44px selected/add controls.
- People and dinner count are compact native selectors. Selected meals form a horizontal photo strip with accessible removal controls.
- Fixed Review ingredients action above three-part navigation. Include safe-area padding and reserve content space so controls never obscure the final row.
- Generated photography is illustrative, not a claim about an exact recipe's appearance. Shared asset: public/images/meals.png. Reading order is defined in MealPhoto.tsx.
- Keep all retailer/session logic outside presentation components.

## September refinement
- Inset floating navigation with frosted glass, safe-area clearance, and a subtle filled selection. Heroicons outline icons throughout.
- Compact wordmark and connection control. The connection timestamp belongs in settings, not a persistent banner.
- Selected meal photos have a horizontal edge fade. Search uses a soft surface and restrained focus underline, with visible keyboard focus.
- Settings retains household portions and Tesco connection/basket handoff only. No reset-week action.
- Background matching shows actual completed ingredient counts. Basket submission uses an indeterminate indicator until verified read-back; never invent progress percentages.
