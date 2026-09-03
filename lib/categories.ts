export interface CategoryOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  /** Фрагмент промпта, описывающий тип сцены для генерации. */
  prompt: string;
}

export interface Category {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  options: CategoryOption[];
}

export const CATEGORIES: Category[] = [
  {
    id: "clothing",
    title: "Clothing & footwear",
    subtitle: "clothes, shoes, headwear",
    icon: "🧥",
    options: [
      {
        id: "on_model",
        title: "On model",
        subtitle: "worn by a person",
        icon: "🧍",
        prompt:
          "worn by a professional model in a natural confident pose, full editorial fashion look, soft directional light",
      },
      {
        id: "flat_lay",
        title: "Flat lay",
        subtitle: "top-down on a surface",
        icon: "🗂️",
        prompt:
          "neat top-down flat lay on a clean textured surface, symmetrical composition, soft even shadows",
      },
      {
        id: "ghost_mannequin",
        title: "Ghost mannequin",
        subtitle: "invisible mannequin",
        icon: "👤",
        prompt:
          "invisible ghost mannequin presentation keeping the garment volume, pure seamless studio background",
      },
      {
        id: "on_hanger",
        title: "On hanger",
        subtitle: "hanging on a rail",
        icon: "🪝",
        prompt:
          "hanging on a minimal designer hanger against a warm neutral wall, gentle natural falloff of light",
      },
      {
        id: "fabric_detail",
        title: "Fabric detail",
        subtitle: "macro of texture & stitching",
        icon: "🔍",
        prompt:
          "extreme macro close-up of the fabric texture and stitching, shallow depth of field, tactile premium feel",
      },
    ],
  },
  {
    id: "accessories",
    title: "Accessories",
    subtitle: "bags, watches, eyewear, jewelry",
    icon: "👜",
    options: [
      {
        id: "on_pedestal",
        title: "On pedestal",
        subtitle: "studio podium",
        icon: "🏛️",
        prompt:
          "placed on a sculptural stone pedestal, dramatic single-source studio light, elegant long shadow",
      },
      {
        id: "worn",
        title: "Worn on model",
        subtitle: "in a real look",
        icon: "🧍",
        prompt:
          "worn by a model as part of a styled outfit, cropped editorial framing, soft daylight",
      },
      {
        id: "in_hand",
        title: "In hand",
        subtitle: "held, sense of scale",
        icon: "🤲",
        prompt:
          "held in well-groomed hands to convey real scale, blurred lifestyle background, warm light",
      },
      {
        id: "props_flat_lay",
        title: "Flat lay with props",
        subtitle: "styled composition",
        icon: "🗂️",
        prompt:
          "styled top-down flat lay with tasteful minimal props and negative space, magazine layout",
      },
      {
        id: "macro",
        title: "Macro detail",
        subtitle: "material & finish",
        icon: "🔍",
        prompt:
          "macro shot highlighting the material finish, engraving and hardware, crisp specular highlights",
      },
    ],
  },
  {
    id: "food_drinks",
    title: "Food & drinks",
    subtitle: "products, dishes, drinks, packaging",
    icon: "🍽️",
    options: [
      {
        id: "served",
        title: "Served on table",
        subtitle: "ready to eat or drink",
        icon: "🍽️",
        prompt:
          "beautifully served on elegant tableware on a styled table, appetizing food styling, warm inviting light",
      },
      {
        id: "packaging",
        title: "Packaging shot",
        subtitle: "hero of the package",
        icon: "📦",
        prompt:
          "clean commercial hero shot of the packaging, label perfectly readable and undistorted, crisp studio light",
      },
      {
        id: "with_ingredients",
        title: "With ingredients",
        subtitle: "fresh ingredients around",
        icon: "🌿",
        prompt:
          "surrounded by fresh raw ingredients arranged naturally, rustic surface, rich saturated colors",
      },
      {
        id: "splash",
        title: "Pour & splash",
        subtitle: "dynamic action",
        icon: "💦",
        prompt:
          "dynamic frozen pour and splash action, high-speed flash freezing every droplet, energetic commercial feel",
      },
      {
        id: "top_down",
        title: "Top-down scene",
        subtitle: "whole table from above",
        icon: "🛸",
        prompt:
          "top-down overhead scene of the full table setting, balanced props, editorial food photography",
      },
    ],
  },
  {
    id: "cosmetics",
    title: "Cosmetics & skincare",
    subtitle: "jars, bottles, tubes",
    icon: "💄",
    options: [
      {
        id: "on_pedestal",
        title: "On pedestal",
        subtitle: "minimal studio podium",
        icon: "🏛️",
        prompt:
          "standing on a smooth stone podium, minimal spa aesthetic, soft gradient background, delicate shadows",
      },
      {
        id: "wet",
        title: "Wet & fresh",
        subtitle: "water droplets",
        icon: "💧",
        prompt:
          "covered in fresh water droplets with subtle water reflections, glossy hydrating mood, cool clean light",
      },
      {
        id: "texture_swatch",
        title: "Texture swatch",
        subtitle: "cream smear beside",
        icon: "🎨",
        prompt:
          "next to an elegant swatch smear of its cream texture, macro tactile detail, soft beauty lighting",
      },
      {
        id: "bathroom_shelf",
        title: "Bathroom lifestyle",
        subtitle: "real shelf scene",
        icon: "🛁",
        prompt:
          "styled on a modern bathroom shelf with plants and linen, sunlit lifestyle scene, airy atmosphere",
      },
      {
        id: "full_set",
        title: "Full set",
        subtitle: "whole product line",
        icon: "🧴",
        prompt:
          "arranged as a full product line group shot, consistent spacing and heights, premium brand presentation",
      },
    ],
  },
  {
    id: "gadgets",
    title: "Gadgets & electronics",
    subtitle: "phones, audio, tech gadgets",
    icon: "📱",
    options: [
      {
        id: "floating",
        title: "Floating",
        subtitle: "levitating in studio",
        icon: "🛸",
        prompt:
          "levitating in mid-air in a dark studio, rim lighting outlining the silhouette, futuristic tech ad",
      },
      {
        id: "desk_setup",
        title: "Desk setup",
        subtitle: "lifestyle workspace",
        icon: "🖥️",
        prompt:
          "integrated into a stylish modern desk setup, shallow depth of field, soft window light, lifestyle mood",
      },
      {
        id: "in_use",
        title: "In use",
        subtitle: "held or being used",
        icon: "🤲",
        prompt:
          "being used in hands with the screen or controls visible, realistic scale, cinematic ambient light",
      },
      {
        id: "dark_tech",
        title: "Dark tech",
        subtitle: "neon accents",
        icon: "🌌",
        prompt:
          "dark moody tech background with subtle neon accent lighting, glossy reflective floor, flagship launch look",
      },
      {
        id: "detail_macro",
        title: "Detail macro",
        subtitle: "ports, buttons, finish",
        icon: "🔍",
        prompt:
          "macro detail of the ports, buttons and machined finish, razor sharp focus, precise specular highlights",
      },
    ],
  },
  {
    id: "home_furniture",
    title: "Home & furniture",
    subtitle: "furniture, decor, lighting, interior pieces",
    icon: "🛋️",
    options: [
      {
        id: "styled_interior",
        title: "Styled interior",
        subtitle: "in a designed room",
        icon: "🏠",
        prompt:
          "placed in a tastefully designed interior matching its style, natural window light, architectural digest look",
      },
      {
        id: "studio_isolated",
        title: "Studio isolated",
        subtitle: "clean catalog shot",
        icon: "⬜",
        prompt:
          "isolated on a seamless light studio background, even catalog lighting, true-to-life colors and proportions",
      },
      {
        id: "cozy_corner",
        title: "Cozy corner",
        subtitle: "warm vignette",
        icon: "🕯️",
        prompt:
          "styled in a cozy corner vignette with plants, textiles and warm lamp glow, inviting homely atmosphere",
      },
      {
        id: "material_detail",
        title: "Material detail",
        subtitle: "wood, fabric, metal",
        icon: "🔍",
        prompt:
          "close-up of the material and craftsmanship, wood grain or upholstery texture, soft raking light",
      },
      {
        id: "wide_room",
        title: "Wide room shot",
        subtitle: "full space, sense of scale",
        icon: "📐",
        prompt:
          "wide interior shot showing the whole room for scale, balanced symmetric composition, bright daylight",
      },
    ],
  },
  {
    id: "other",
    title: "Other",
    subtitle: "if no other category fits",
    icon: "📦",
    options: [
      {
        id: "clean_studio",
        title: "Clean studio",
        subtitle: "neutral background",
        icon: "⬜",
        prompt:
          "clean commercial studio shot on a neutral seamless background, soft balanced lighting, crisp detail",
      },
      {
        id: "lifestyle",
        title: "Lifestyle scene",
        subtitle: "real environment",
        icon: "🏠",
        prompt:
          "placed in a realistic lifestyle environment where it is actually used, natural light, authentic mood",
      },
      {
        id: "on_pedestal",
        title: "On pedestal",
        subtitle: "studio podium",
        icon: "🏛️",
        prompt:
          "presented on a minimal podium with dramatic directional light and a long elegant shadow",
      },
      {
        id: "flat_lay",
        title: "Flat lay",
        subtitle: "top-down composition",
        icon: "🗂️",
        prompt:
          "top-down flat lay composition with generous negative space, tidy arrangement, soft shadows",
      },
      {
        id: "macro",
        title: "Macro detail",
        subtitle: "texture close-up",
        icon: "🔍",
        prompt:
          "macro close-up revealing surface texture and fine details, shallow depth of field",
      },
    ],
  },
];

export const CATEGORY_IDS = CATEGORIES.map((category) => category.id);

export const DEFAULT_CATEGORY =
  CATEGORIES.find((category) => category.id === "food_drinks") ?? CATEGORIES[0];

export function findCategory(categoryId: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === categoryId);
}

export function findOption(
  category: Category,
  optionId: string
): CategoryOption | undefined {
  return category.options.find((option) => option.id === optionId);
}
