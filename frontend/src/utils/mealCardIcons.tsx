import React from 'react';

interface MealIconProps {
  size?: number;
  color?: string;
}

const SVG_DEFAULTS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function makeIcon(paths: React.ReactNode) {
  return React.memo(function MealIcon({
    size = 64,
    color = 'currentColor',
  }: MealIconProps): React.ReactElement {
    return (
      <svg
        {...SVG_DEFAULTS}
        width={size}
        height={size}
        stroke={color}
      >
        {paths}
      </svg>
    );
  });
}

const DrumstickIcon = makeIcon(
  <>
    <circle cx="9" cy="9" r="5" />
    <path d="M13 13 L18 18" />
    <circle cx="19.5" cy="19.5" r="2" />
  </>,
);

const SteakIcon = makeIcon(
  <>
    <path d="M5 8 C5 5 9 4 13 5 C17 6 20 9 19 13 C18 17 14 19 10 18 C5 17 3 13 5 8 Z" />
    <path d="M9 9 L12 12" />
    <path d="M12 8 L14 10" />
    <path d="M10 13 L13 16" />
  </>,
);

const FishIcon = makeIcon(
  <>
    <path d="M2 12 C2 9 5 7 10 7 C16 7 19 10 19 12 C19 14 16 17 10 17 C5 17 2 15 2 12 Z" />
    <path d="M19 12 L22 9 L22 15 Z" />
    <circle cx="6" cy="11" r="0.9" fill="currentColor" stroke="none" />
  </>,
);

const NoodleBowlIcon = makeIcon(
  <>
    <path d="M2 12 L22 12" />
    <path d="M3 12 C3 17 7 20 12 20 C17 20 21 17 21 12" />
    <path d="M6 10 C6 6 10 6 10 10" />
    <path d="M11 10 C11 6 15 6 15 10" />
    <path d="M8 8 C8 4 12 4 12 8" />
    <path d="M13 8 C13 4 17 4 17 8" />
  </>,
);

const RiceBowlIcon = makeIcon(
  <>
    <path d="M2 12 L22 12" />
    <path d="M3 12 C3 17 7 20 12 20 C17 20 21 17 21 12" />
    <path d="M7 9 L9 11" />
    <path d="M10 8 L12 10" />
    <path d="M13 9 L15 11" />
    <path d="M16 8 L17.5 9.5" />
    <path d="M8 10 L10 11.5" />
    <path d="M14 10 L16 11.5" />
  </>,
);

const TacoIcon = makeIcon(
  <>
    <path d="M3 18 C3 11 8 6 12 6 C16 6 21 11 21 18 Z" />
    <path d="M6 14 L8 16" />
    <path d="M10 13 L12 15" />
    <path d="M14 13 L16 15" />
    <path d="M18 14 L19 15" />
  </>,
);

const LeafIcon = makeIcon(
  <>
    <path d="M4 20 C4 12 11 5 20 4 C19 13 13 20 4 20 Z" />
    <path d="M4 20 L18 6" />
  </>,
);

const SoupBowlIcon = makeIcon(
  <>
    <path d="M2 12 L22 12" />
    <path d="M3 12 C3 17 7 20 12 20 C17 20 21 17 21 12" />
    <path d="M8 9 C8 7 10 7 10 5" />
    <path d="M12 9 C12 7 14 7 14 5" />
    <path d="M16 9 C16 7 18 7 18 5" />
  </>,
);

const PizzaSliceIcon = makeIcon(
  <>
    <path d="M12 3 L4 19 L20 19 Z" />
    <path d="M4 19 C8 18 16 18 20 19" />
    <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
  </>,
);

const BurgerIcon = makeIcon(
  <>
    <path d="M3 8 C3 5 7 3 12 3 C17 3 21 5 21 8 Z" />
    <path d="M3 11 L21 11" />
    <path d="M3 13 C5 14 8 13 10 14 C12 15 15 13 17 14 C19 15 20 13 21 13" />
    <path d="M3 16 C3 19 7 21 12 21 C17 21 21 19 21 16 Z" />
  </>,
);

const BreadIcon = makeIcon(
  <>
    <path d="M3 10 C3 7 5 5 8 5 L16 5 C19 5 21 7 21 10 L21 17 C21 18 20 19 19 19 L5 19 C4 19 3 18 3 17 Z" />
    <path d="M7 9 L7 15" />
    <path d="M11 9 L11 15" />
    <path d="M15 9 L15 15" />
  </>,
);

const CakeSliceIcon = makeIcon(
  <>
    <path d="M5 21 L5 11 C5 9 7 8 9 8 L15 8 C17 8 19 9 19 11 L19 21 Z" />
    <path d="M5 11 C8 13 16 13 19 11" />
    <path d="M9 4 L9 8" />
    <path d="M12 3 L12 8" />
    <path d="M15 4 L15 8" />
  </>,
);

const PlateIcon = makeIcon(
  <>
    <circle cx="12" cy="13" r="9" />
    <circle cx="12" cy="13" r="5" />
    <path d="M6 3 L6 9" />
    <path d="M18 3 L18 9" />
  </>,
);

type MealIconComponent = React.ComponentType<MealIconProps>;

const ICON_RULES: ReadonlyArray<{
  keywords: ReadonlyArray<string>;
  Icon: MealIconComponent;
}> = [
  { keywords: ['chicken', 'poultry', 'wing', 'thigh', 'drumstick'], Icon: DrumstickIcon },
  { keywords: ['beef', 'steak', 'brisket', 'pork', 'bacon', 'ham', 'sausage'], Icon: SteakIcon },
  { keywords: ['fish', 'shrimp', 'seafood', 'salmon', 'tuna', 'cod', 'prawn', 'tilapia'], Icon: FishIcon },
  { keywords: ['pasta', 'noodle', 'spaghetti', 'penne', 'linguine', 'fettuccine', 'macaroni', 'bolognese'], Icon: NoodleBowlIcon },
  { keywords: ['rice', 'risotto', 'biryani', 'fried rice'], Icon: RiceBowlIcon },
  { keywords: ['taco', 'burrito', 'mexican', 'enchilada', 'quesadilla', 'fajita'], Icon: TacoIcon },
  { keywords: ['salad', 'vegetable', 'veggie', 'vegan', 'greens', 'kale', 'spinach'], Icon: LeafIcon },
  { keywords: ['soup', 'stew', 'chili', 'chowder', 'bisque', 'broth', 'curry', 'indian', 'tikka', 'masala'], Icon: SoupBowlIcon },
  { keywords: ['pizza'], Icon: PizzaSliceIcon },
  { keywords: ['sandwich', 'burger', 'wrap'], Icon: BurgerIcon },
  { keywords: ['bread', 'toast', 'baguette'], Icon: BreadIcon },
  { keywords: ['cake', 'dessert', 'brownie', 'cookie', 'sweet'], Icon: CakeSliceIcon },
];

/**
 * Pick a meal-card icon component based on the meal name and filterTags.
 * Falls back to a generic plate icon when no keyword matches.
 */
export function getMealIcon(name: string, filterTags: string[]): MealIconComponent {
  const searchText = [...filterTags, name].join(' ').toLowerCase();
  for (const rule of ICON_RULES) {
    for (const keyword of rule.keywords) {
      if (searchText.includes(keyword)) {
        return rule.Icon;
      }
    }
  }
  return PlateIcon;
}
