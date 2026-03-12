# GroceryHack — Style Guide

Based on the v3 HTML mockup (`grocery-hack-v3.html`). This is the visual direction — implementation details may evolve.

---

## Brand Personality

Clean, calm, trustworthy. The app feels like a well-organized friend who saves you money without making it feel like work. Light backgrounds, muted teal accents, generous whitespace. Nothing screams — the savings speak for themselves.

---

## Colors

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| `primary` | `#3D7B7B` | `--primary` | Muted teal — buttons, links, prices, savings values, store links |
| `primaryLight` | `rgba(61, 123, 123, 0.08)` | `--primary-light` | Button hover backgrounds, subtle tints |
| `primaryShadow` | `rgba(61, 123, 123, 0.15)` | `--primary-shadow` | Card shadows, button shadows |
| `accent` | `#C9A84C` | `--accent` | Gold — Feeling Lucky, special highlights |
| `accentLight` | `rgba(201, 168, 76, 0.12)` | `--accent-light` | Gold tinted backgrounds |
| `bg` | `#FAF9F6` | `--bg` | Page background (warm off-white) |
| `white` | `#FFFFFF` | `--white` | Card backgrounds, input backgrounds |
| `text` | `#2D2D2D` | `--text` | Primary text — headings, meal names, ingredient names |
| `textMuted` | `#5A5A5A` | `--text-muted` | Secondary text — labels, hints, metadata, swipe hints |
| `border` | `rgba(61, 123, 123, 0.12)` | `--border` | Card internal dividers, header border, ingredient row separators |
| `greenBadgeBg` | `#E6F4EA` | `--green-badge-bg` | Discount badge background |
| `greenBadgeText` | `#1A7F37` | `--green-badge-text` | Discount badge text |
| `danger` | `#DC2626` | — | Errors, NOPE swipe stamp, delete actions, absurd deal alerts |
| `dangerLight` | `rgba(220, 38, 38, 0.08)` | — | Danger tinted backgrounds |
| `success` | `#1A7F37` | — | YUM swipe stamp, confirmations (same family as discount badge) |

### Usage Rules

- Background is always `bg` (off-white). Cards are always `white`. No dark mode for MVP.
- Sale prices render in `primary`. Discount percentages use the green badge.
- Non-sale / pantry items show price in `textMuted` with no badge.
- Savings values always `primary`, heading font, bold.
- Borders are extremely subtle — `rgba(61, 123, 123, 0.06)` for ingredient rows, `0.12` for section dividers.

---

## Typography

### Font Families

| Font | Role | Google Fonts Import |
|------|------|---------------------|
| **Sora** | Headings, logo, section titles, prices, badges | `Sora:wght@400;600;700` |
| **Inter** | Body text, labels, buttons, inputs, metadata | `Inter:wght@400;500;600` |

### Type Scale

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Logo "GroceryHack" | Sora | 1.65rem (~26px) | 700 | `primary` |
| Section heading | Sora | 1.4rem (~22px) | 700 | `text` |
| Meal name (card) | Sora | 1.25rem (~20px) | 700 | `text` |
| Meal name (list) | Sora | 1.1rem (~18px) | 700 | `text` |
| Price per serving | Sora | 1.1rem (~18px) | 600 | `primary` |
| Savings value | Sora | 1.15rem (~18px) | 700 | `primary` |
| Ingredient price | Sora | 1.02rem (~16px) | 600 | `primary` |
| Discount badge | Sora | 0.75rem (~12px) | 600 | `greenBadgeText` |
| Button text | Inter | 0.9rem (~14px) | 600 | `white` or `primary` |
| Body / ingredient name | Inter | 0.95rem (~15px) | 500 | `text` |
| Savings label | Inter | 0.85rem (~14px) | 500 | `textMuted` |
| Swipe hints | Inter | 0.82rem (~13px) | 500 | `textMuted` |
| Tap hint | Inter | 0.78rem (~12px) | 400 | `textMuted` at 50% opacity, italic |

### Rules

- Sora is for impact — headings, prices, numbers, the logo, badges. Inter is for readability — body, buttons, labels, inputs.
- Line height: 1.65 for body (generous for readability), tighter for headings.
- Letter spacing: -0.5px on logo, -0.3px on section titles, 0 elsewhere.
- Logo: "Grocery" + "Hack" with tighter kerning on the "ck" junction (`letter-spacing: -2.5px` on the "Hack" span, with ligature features enabled).
- Use rem units for font sizes. Base: 16px desktop, 15px mobile.

---

## Spacing

| Context | Value |
|---------|-------|
| Container max-width | 720px |
| Container horizontal padding | 24px (desktop), 20px (tablet), 16px (mobile) |
| Header padding | 28px top, 20px bottom |
| Section padding | 32px vertical |
| Action bar gap | 12px |
| Card padding | 28-40px (varies: swipe card 40px 48px, meal group 28px 32px) |
| Card margin-bottom | 20px |
| Meal group header margin-bottom | 18px |
| Ingredient row padding | 10px vertical |
| Savings group gap | 24px (desktop), 16px (tablet) |
| Touch target minimum | 44x44px |

---

## Radii

| Element | Radius |
|---------|--------|
| Cards (meal groups, swipe card) | 16px (`--radius-card`) |
| Buttons | 99px / full pill (`--radius-pill`) |
| Discount badges | 99px / full pill |
| Status badges | 99px / full pill |
| Modals (top corners) | 20px |
| Input fields | 10-12px |

---

## Shadows

| Usage | Value |
|-------|-------|
| Card shadow | `0 4px 20px var(--primary-shadow), 0 1px 4px rgba(0, 0, 0, 0.04)` |
| Card hover shadow | `0 8px 32px var(--primary-shadow), 0 2px 8px rgba(0, 0, 0, 0.06)` |
| Button shadow | `0 2px 8px var(--primary-shadow)` |
| Button hover shadow | `0 4px 14px var(--primary-shadow)` |

All shadows use the teal-tinted `primaryShadow` — never pure black shadows. The double-shadow technique (colored + subtle dark) adds depth without heaviness.

---

## Buttons

### Primary

```css
background: var(--primary);
color: var(--white);
font: Inter 0.9rem / weight 600;
border: none;
border-radius: 99px;
padding: 14px 32px;
box-shadow: 0 2px 8px var(--primary-shadow);
transition: all 0.2s ease;
```

Hover: background darkens to `#356c6c`, shadow intensifies, `translateY(-1px)`.

### Secondary / Ghost

```css
background: var(--white);
color: var(--primary);
font: Inter 0.9rem / weight 600;
border: 2px solid var(--primary);
border-radius: 99px;
padding: 14px 32px;
```

Hover: background shifts to `primaryLight`, `translateY(-1px)`.

### Gold (Feeling Lucky)

```css
background: var(--accent);
color: var(--white);
```

Same sizing and radius as primary.

### Danger

```css
background: var(--danger);
color: var(--white);
```

Used for delete confirmations only.

### Responsive

- Desktop: buttons sit side-by-side in the action bar with `gap: 12px`.
- Mobile (< 480px): buttons stack vertically, `width: 100%`, padding `14px 24px`.
- Tablet (< 768px): buttons flex with `min-width: 180px`, centered.

---

## Cards

### Swipe Card (Meal Matching)

```css
background: var(--white);
border-radius: 16px;
box-shadow: var(--shadow-card);
padding: 40px 48px;
text-align: center;
max-width: 340px;
cursor: grab;
```

- Emoji at top (3.2rem), meal name below (Sora 700), price per serving in `primary` (Sora 600).
- Gentle sway animation at rest (see Animations).
- Hover: shadow intensifies, sway pauses.
- Mobile: full width, padding reduces to 28px 24px.

### Meal Group Card (Important Items)

```css
background: var(--white);
border-radius: 16px;
box-shadow: var(--shadow-card);
padding: 28px 32px;
margin-bottom: 20px;
```

- Header: meal name (Sora 700) left, price/serving (Sora 600 `primary`) right, separated by a `border` bottom line.
- Ingredient rows below: name left (Inter 500), price + optional discount badge right.
- Ingredient row separator: `rgba(61, 123, 123, 0.06)` — barely visible.
- Mobile: padding reduces to 20px 18px, header stacks vertically.

### Discount Badge

```css
background: var(--green-badge-bg);   /* #E6F4EA */
color: var(--green-badge-text);       /* #1A7F37 */
font: Sora 0.75rem / weight 600;
padding: 3px 10px;
border-radius: 99px;
white-space: nowrap;
```

Shows percentage off (e.g., "-30%"). Only appears on ingredients that are on sale. Non-sale items show price with no badge.

---

## Store Links

```css
color: var(--primary);
text-decoration: underline;
text-decoration-color: rgba(61, 123, 123, 0.3);
text-underline-offset: 3px;
font-weight: 600;
```

Hover: underline color transitions to full `primary`. Links to Google Maps via `https://www.google.com/maps/search/?api=1&query={encoded_address}`.

---

## Animations

### Swipe Card Sway (at rest)

```css
@keyframes gentleSway {
  0%   { transform: rotate(0deg) translateX(0); }
  15%  { transform: rotate(1.2deg) translateX(4px); }
  30%  { transform: rotate(0deg) translateX(0); }
  45%  { transform: rotate(-1.2deg) translateX(-4px); }
  60%  { transform: rotate(0deg) translateX(0); }
  100% { transform: rotate(0deg) translateX(0); }
}
animation: gentleSway 4s ease-in-out infinite;
```

Pauses on hover. Signals interactivity without being distracting.

### Swipe Gesture (active)

```
timing: cubic-bezier(.175, .885, .32, 1.275) — spring overshoot
```

Card rotates ±15deg at full swipe distance. YUM/NOPE stamp fades in at ~30% threshold. Released card flies off if past threshold, snaps back if not.

### Swipe Stamps

- **YUM:** Green (`success`), rotated -15deg, 80% opacity, Sora bold large.
- **NOPE:** Red (`danger`), rotated 15deg, 80% opacity, Sora bold large.

### Savings Counter

```
timing: ease-out cubic — (1 - Math.pow(1 - progress, 3))
duration: ~500-900ms
trigger: on mount when data loads
```

### Button Hover

```css
transform: translateY(-1px);
transition: all 0.2s ease;
```

Subtle lift, not scale. Shadow intensifies.

### Card Hover

```css
box-shadow: 0 8px 32px var(--primary-shadow), 0 2px 8px rgba(0, 0, 0, 0.06);
transition: box-shadow 0.3s ease;
```

### Modals

```
enter: slide up from bottom, 250ms ease-out
exit: slide down, 200ms ease-in
top corners: 20px radius
```

### Toasts

```
enter: fade in + translateY(-8px → 0), 200ms
hold: 1.0s
exit: fade out, 300ms
total: ~1.5s
```

### Confetti

```
trigger: savings > $5 per meal match, or Feeling Lucky result
type: CSS keyframe particles
duration: ~1.5s
```

### Feeling Lucky Slot Machine

```
two columns scroll vertically (meals + names)
starts fast, decelerates ease-out
duration: ~2-3s
lands with slight bounce
```

---

## Pricing Patterns

### On-Sale Ingredient

```
Name: Inter 0.95rem / 500, text color
Price: Sora 1.02rem / 600, primary color
Badge: green pill showing "-XX%"
Layout: name left, price + badge right
```

### Non-Sale / Pantry Ingredient

```
Name: Inter 0.95rem / 500, text color
Price: Sora 1.02rem / 600, primary color (still shown, just no badge)
No discount badge
```

### Per-Serving Price (Meal Headers)

```
Font: Sora 1rem-1.1rem / 600, primary color
Format: "$X.XX / serving"
Position: right side of meal group header
```

---

## Cross-Store Ingredients (2-Store Mode)

When a meal appears under both stores:

**This-store ingredient:** Normal styling as above.

**Other-store ingredient:**
- Text color: `textMuted`
- Small pill badge: other store's name, Inter 0.7rem, `primaryLight` background, `primary` text, pill radius
- Row is tappable — jumps to the same meal under the other store's section
- Subtle arrow indicator (→) at row end

---

## Forms & Inputs

### Text Inputs

```css
background: var(--white);
border: 1.5px solid var(--border);
border-radius: 10px;
padding: 12px 16px;
font: Inter 0.95rem / weight 400;
color: var(--text);
```

Focus: border transitions to `primary`.

### Toggles (1 Store / 2 Stores)

```
Pill-shaped container, white background, primary border
Active segment: primary background, white text
Inactive segment: transparent, textMuted text
Transition: 150ms
```

### Checkboxes

```
Unchecked: primary border, transparent fill
Checked: primary fill, white checkmark
Size: 22px within 44px touch target
```

### Status Badges

```
Pill-shaped, Inter 0.75rem / 600
Pending: accent background at 12%, accent text
Approved: greenBadgeBg, greenBadgeText
Rejected: textMuted at 12%, textMuted
```

---

## Icons

Custom SVG React components only. No icon libraries.

| Property | Value |
|----------|-------|
| Stroke width | 2px |
| Stroke line cap | round |
| Stroke line join | round |
| Default size | 16px |
| Active color | `var(--primary)` |
| Inactive color | `var(--text-muted)` |
| On primary button | `var(--white)` |

Emoji are acceptable on meal cards for visual personality (as shown in mockup). Icons are used for UI chrome — buttons, navigation, actions.

---

## Responsive Breakpoints

| Breakpoint | Container Padding | Key Changes |
|------------|-------------------|-------------|
| Desktop (> 768px) | 24px | Side-by-side buttons, full card padding, savings inline |
| Tablet (≤ 768px) | 20px | Header centers, buttons flex with min-width, swipe card 300px max |
| Mobile (≤ 480px) | 16px | Base font 15px, buttons stack, savings stack, ingredient rows wrap, cards reduce padding |

### Mobile-Specific

- Buttons go full-width and stack vertically.
- Savings group stacks vertically with 4px gap.
- Meal group headers stack (name above price).
- Ingredient rows: name takes full width, price group floats right below.
- Swipe card: full width, padding 28px 24px.

---

## Do Not

- Use dark backgrounds. The app is light-themed.
- Use icon libraries (Ionicons, Material, FontAwesome). Custom SVGs only.
- Use `setInterval` for animations. CSS transitions/keyframes or Framer Motion.
- Use pure black (`#000`) for text. Always `#2D2D2D` or lighter.
- Use hard/opaque borders. Borders should be barely visible (`0.06`-`0.12` opacity).
- Use pure black shadows. All shadows are teal-tinted or very subtle.
- Show an empty section. If data array is empty, hide the section.
- Show strikethrough pricing. Use discount badges instead.
