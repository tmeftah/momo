# VAE Manager — notes for Claude

French UI, mobile-first PWA. Client: Vue 3 + Vite in `client/`. Server: Fastify + SQLite.
See README.md for commands (`make dev`, PIN `123456` in development).

## UI rules: look professional, not AI-generated

The app follows an iOS-style design system (`client/src/styles.css`). Every UI change must keep to these rules.

### Icons
- Use Lucide icons only (`lucide-vue-next`). Never put emoji in the UI: not as icons or thumbnails, not in messages ("🎉", "✓", "📍").
- Vehicle types: use `VEHICLE_TYPES[].icon` from `constants.js` and `vehicleIcon(r)` from `store.js`.
- `ListRow` takes `:icon` (a component) and `:thumb-icon` (a component, default `Package`). It has no `emoji` prop.
- Icon sizes used in the app: 18 in tiles, 22 in list thumbs, 26 in option cards, 36 in hero tiles. Use stroke width 1.8 for large outline icons and about 2.2 for small ones.

### Color: one accent color, color only when it means something
- `--tint` (blue) is the only accent color. Decorative icon tiles use `tile="accent"` (the default). Use `tile="soft"` for neutral gray tiles.
- Use red, orange or green only for status: red for destructive actions, errors and stock under the minimum; orange for warnings and unpaid credit; green for finished, paid or ready. Use them only when the state is true (for example, apply `c-red` only when the count is above 0).
- Never give each item in a menu or grid its own color (no rainbow tiles or quick actions).
- Dashboard widget headers are neutral (`--label-2`) by default; add `c-red`, `c-orange` or `c-green` only for a meaningful, non-zero state.
- Status pills and the repair-category colors (`CATEGORY`, `REPAIR_STATUSES`, `METHOD`) are a color code, so keep them consistent across screens.
- Always use the color tokens, never hard-coded hex values, so dark and light themes both work. Check both themes.

### Surfaces and effects
- No blurred glow blobs, no decorative gradients (radial, linear or gradient text), no glassmorphism except the system bars that already use it, and no colored shadows.
- Choose one way to show an edge: flat cells on the grouped background, as in iOS. Don't combine a border with a large soft shadow.
- Motion is short and functional: press feedback and page transitions. Don't add hover zoom or rotation on images or cards.

### Hierarchy and layout
- Build hierarchy with size and weight first, then the `--label` / `--label-2` / `--label-3` text colors. Add color last.
- Group related things with spacing and grouped lists (`ListGroup` / `ListRow`) before adding dividers or cards.
- Use the existing spacing scale (multiples of 4px, with 16px page gutters). Don't use arbitrary pixel values.
- Touch targets are at least 44×44px. List rows are at least 44px tall.
- Use tabular numbers (`.num`) for money and counts.

### Copy
- Plain, specific French that a workshop owner would use. Avoid filler greetings ("Bonjour !"), slogans and exclamation marks.
- Empty states say what is missing and, if useful, the next action ("Aucun crédit en cours"). Don't add celebration emoji.
- Use realistic sample data. Don't use placeholder names like "John Doe".

### Self-check before finishing a UI change
Ask: "Could this screen be moved into any other app without anything feeling wrong?" If yes, it is too generic. Tie it to the workshop's actual data and tasks.
