
const basePricing = { currency: "INR", price: 0, originalValue: 0 };
const baseSize = { unitCount: 1, sizePerUnit: { ml: 0, flOz: 0 } };

const velvetBadge = { type: "marketing", label: "Velvet Power\u2122" };
const airBadge = { type: "marketing", label: "Air Couture\u2122" };
const glassBadge = { type: "marketing", label: "Glass Luxe\u2122" };

const benefitBadges = [
  { type: "benefit", label: "Vegan" },
  { type: "benefit", label: "Cruelty-Free" },
  { type: "benefit", label: "Paraben-Free" },
  { type: "benefit", label: "Talc-Free" },
  { type: "benefit", label: "Dermatologically Tested" },
];

const bulletActives = [
  {
    name: "Shea Butter",
    description: "Nourishes and softens lips for comfortable velvet-matte wear.",
  },
  {
    name: "Squalane",
    description: "Helps maintain moisture and a smooth, cushiony texture on the lips.",
  },
  {
    name: "Hyaluronic Acid",
    description: "Keeps lips plump-looking by attracting and holding moisture.",
  },
];

const bulletSupporting = [
  "Ricinus Communis (Castor) Seed Oil",
  "Caprylic/Capric Triglyceride",
  "Euphorbia Cerifera (Candelilla) Wax",
  "Copernicia Cerifera (Carnauba) Wax",
  "Simmondsia Chinensis (Jojoba) Seed Oil",
  "Cera Alba (Beeswax)",
  "Hydrogenated Castor Oil",
  "Ozokerite",
  "Tocopheryl Acetate",
  "Silica",
  "Phenoxyethanol",
  "Ethylhexylglycerin",
  "+/- CI Pigments",
];

const airActives = [
  {
    name: "Hyaluronic Acid",
    description: "Adds a layer of comfort and hydration in a matte formula.",
  },
  {
    name: "Squalane",
    description: "Supports a smooth, non-drying soft-matte finish.",
  },
];

const airSupporting = [
  "Isododecane",
  "Dimethicone",
  "Trimethylsiloxysilicate",
  "Acrylates/VA Copolymer",
  "Cyclopentasiloxane",
  "Bentone Gel",
  "Silica",
  "Microspheres",
  "Iron Oxides",
  "Titanium Dioxide",
  "Phenoxyethanol",
  "Ethylhexylglycerin",
];

const glassActives = [
  { name: "Jojoba Oil", description: "Cushions and smooths for a soft glide." },
  { name: "Hyaluronic Acid", description: "Helps lips look plump and hydrated." },
];

const fallbackImages = [
  "product1.png",
  "product2.png",
  "product3.png",
  "product4.png",
  "product5.png",
  "product6.png",
  "product7.png",
  "product8.png",
  "product9.png",
  "product10.png",
  "product11.png",
  "product12.png",
];

const ranges = {
  velvet: { badge: velvetBadge, ingredients: { keyActives: bulletActives, supportingIngredients: bulletSupporting } },
  air: { badge: airBadge, ingredients: { keyActives: airActives, supportingIngredients: airSupporting } },
  glass: { badge: glassBadge, ingredients: { keyActives: glassActives, supportingIngredients: [] } },
};

const rawProducts = [
  {
    id: "velvet-power-cevonne-crush",
    slug: "velvet-power-cevonne-crush",
    name: "Cevonne Crush ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["lipstick", "bullet", "velvet matte", "mauve rose", "everyday shade", "indian undertones", "cruelty-free", "paraben-free", "talc-free"],
    description: {
      headline: "A soft mauve-rose that looks effortless, feels weightless, and adapts beautifully to Indian undertones.",
      body: "Cevonne Crush is a soft mauve-rose in the Velvet Power\u2122 bullet lipstick range ? a mauve that does not fall flat and a rose that does not turn grey. It is designed as an everyday-soft shade with quiet depth and universal charm, offering velvet-matte comfort with zero dryness while staying true on Indian skin tones.",
    },
  },
  {
    id: "velvet-power-crme-amour",
    slug: "velvet-power-crme-amour",
    name: "Cr?me Amour ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["Peachy-Pink Nude", "Velvet Power", "bullet lipstick", "cruelty-free", "dermatologically tested", "paraben-free", "recyclable", "talc-free"],
    description: {
      headline: "A peachy-pink nude that stays warm, never ashy ? the perfect everyday signature.",
      body: "Your everyday nude, refined. Soft peach meets gentle pink for a nude that flatters Indian skin without washing it out.",
    },
  },
  {
    id: "velvet-power-caramel-clair",
    slug: "velvet-power-caramel-clair",
    name: "Caramel ?clair ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["Beige-Caramel Nude", "Velvet Power", "bullet lipstick", "cruelty-free", "derm-tested", "paraben-free", "recyclable", "talc-free"],
    description: {
      headline: "A beige-caramel nude that warms the face instantly ? never dull, never flat.",
      body: "A caramel nude with quiet richness. Balanced, warm, and grounded ? the nude you trust every single day.",
    },
  },
  {
    id: "velvet-power-ros-mirage",
    slug: "velvet-power-ros-mirage",
    name: "Ros? Mirage ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["Rosy Plum", "Velvet Power", "bullet lipstick", "cruelty-free", "derm-tested", "paraben-free", "recyclable", "talc-free"],
    description: {
      headline: "A rosy plum that feels soft, looks polished, and brings quiet depth to every skin tone.",
      body: "A rose shade with a secret ? depth without heaviness. Ros? Mirage lifts the face with a natural flush that never turns purple or muddy.",
    },
  },
  {
    id: "velvet-power-mauve-memoir",
    slug: "velvet-power-mauve-memoir",
    name: "Mauve Memoir ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["Dusty Mauve", "Velvet Power", "bullet lipstick", "cruelty-free", "derm-tested", "paraben-free", "talc-free"],
    description: {
      headline: "A dusty mauve with editorial depth ? soft, moody, impossible to forget.",
      body: "A mauve with attitude. Not pastel, not grey ? just pure, modern mood in a velvet finish.",
    },
  },
  {
    id: "velvet-power-rouge-mistral",
    slug: "velvet-power-rouge-mistral",
    name: "Rouge Mistral ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["True Blue-Red", "Velvet Power", "bullet lipstick", "cruelty-free", "paraben-free", "recyclable", "talc-free"],
    description: {
      headline: "A bold true red engineered to flatter every Indian undertone ? timeless, powerful, unforgettable.",
      body: "A red that does not bleed, does not dull, and does not disappear. Rouge Mistral is your confidence, pressed into a bullet.",
    },
  },
  {
    id: "velvet-power-velvet-orchard",
    slug: "velvet-power-velvet-orchard",
    name: "Velvet Orchard ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["Fig-Berry", "Velvet Power", "bullet lipstick", "cruelty-free", "paraben-free", "talc-free"],
    description: {
      headline: "A fig-berry matte that adds depth without harshness ? smooth, lush, quietly bold.",
      body: "Berry without drama. Depth without darkness. A shade that feels like dusk wrapped in velvet.",
    },
  },
  {
    id: "velvet-power-desert-dream",
    slug: "velvet-power-desert-dream",
    name: "Desert Dream ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["Terracotta Brown", "Velvet Power", "bullet lipstick"],
    description: {
      headline: "A terracotta-brown matte with grounded depth ? bold, earthy, editorial.",
      body: "A warm brown with desert-sunset depth. Rich, steady, striking ? without being overwhelming.",
    },
  },
  {
    id: "velvet-power-whisper-nude",
    slug: "velvet-power-whisper-nude",
    name: "Whisper Nude ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["Soft Peach Nude", "Velvet Power", "bullet lipstick"],
    description: {
      headline: "A soft peach nude that adds warmth and light ? never pale, never flat.",
      body: "A nude that whispers rather than announces. Soft peach, warm depth, everyday ease.",
    },
  },
  {
    id: "velvet-power-runway-rani",
    slug: "velvet-power-runway-rani",
    name: "Runway Rani ? Velvet Power\u2122 Bullet Lipstick",
    range: "velvet",
    type: "single",
    tags: ["Deep Rose", "Velvet Power", "bullet lipstick"],
    description: {
      headline: "A deep rose matte that brings instant glamour ? bold, regal, unmistakably modern.",
      body: "A rose with authority. Rich, saturated, and designed to photograph beautifully in every light.",
    },
  },
  {
    id: "air-couture-rooh",
    slug: "air-couture-rooh",
    name: "Rooh ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Berry?Wine", "cruelty-free", "derm-tested", "liquid matte lipstick", "paraben-free", "talc-free", "vegan-friendly"],
    description: {
      headline: "A deep berry-wine matte that holds power without heaviness ? rich, smooth, and made for Indian undertones.",
      body: "Intensity with elegance. Rooh delivers bold berry depth without going patchy, purple, or grey ? a liquid matte with real grip and soft comfort.",
    },
  },
  {
    id: "air-couture-red-affaire",
    slug: "air-couture-red-affaire",
    name: "Red Affaire ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Red", "cruelty-free", "liquid matte lipstick", "paraben-free", "talc-free", "vegan-friendly"],
    description: {
      headline: "A rich, true red made for every Indian skin tone ? bold without dryness, powerful without effort.",
      body: "A red that behaves. No orange shift, no dulling, no cracking. Just pure, confident red in a breathable matte.",
    },
  },
  {
    id: "air-couture-power-play",
    slug: "air-couture-power-play",
    name: "Power Play ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Burnt Brick", "cruelty-free", "liquid matte lipstick", "paraben-free", "talc-free"],
    description: {
      headline: "A burnt brick built for bold days ? warm, earthy, modern, and incredibly flattering.",
      body: "Not orange. Not brown. Just the perfect warm brick that lights up Indian skin instantly.",
    },
  },
  {
    id: "air-couture-amber-silk",
    slug: "air-couture-amber-silk",
    name: "Amber Silk ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Terracotta?Cinnamon", "cruelty-free", "derm-tested", "liquid matte lipstick", "paraben-free", "talc-free", "vegan-friendly"],
    description: {
      headline: "A warm cinnamon-terracotta matte that softens, warms, and elevates the face instantly.",
      body: "Amber Silk feels like warmth brushed across the lips ? comforting, softly bold, and perfect for Indian undertones from light to deep.",
    },
  },
  {
    id: "air-couture-nude-moonveil",
    slug: "air-couture-nude-moonveil",
    name: "Nude Moonveil ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Nude", "cruelty-free", "liquid matte lipstick", "paraben-free", "talc-free", "vegan-friendly"],
    description: {
      headline: "A soft beige-rose nude that never turns dull, dusty, or grey ? your perfect liquid nude.",
      body: "A nude that finally understands Indian undertones. Moonveil is warm enough to avoid ashiness, rosy enough to stay fresh.",
    },
  },
  {
    id: "air-couture-peach-tantra",
    slug: "air-couture-peach-tantra",
    name: "Peach Tantra ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Peach", "cruelty-free", "liquid matte lipstick", "paraben-free", "talc-free"],
    description: {
      headline: "A coral-peach matte that brightens the face instantly ? warm, fresh, and never neon.",
      body: "A peach that does not scream. Just warm, wearable brightness designed for Indian skin.",
    },
  },
  {
    id: "air-couture-ros-blaze",
    slug: "air-couture-ros-blaze",
    name: "Ros? Blaze ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Fiery Rose", "cruelty-free", "liquid matte lipstick", "paraben-free", "talc-free", "vegan-friendly"],
    description: {
      headline: "A fiery rose-red that blends warmth and intensity ? bold but effortlessly wearable.",
      body: "A red with rose softness and fire underneath. Ros? Blaze catches attention without overpowering the face.",
    },
  },
  {
    id: "air-couture-nude-silhouette",
    slug: "air-couture-nude-silhouette",
    name: "Nude Silhouette ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Nude", "liquid matte lipstick"],
    description: {
      headline: "A peachy-neutral nude with soft depth ? clean, polished, and undertone-true.",
      body: "A nude that sculpts the face gently. Soft peach meets neutral beige for an everyday matte that never turns flat.",
    },
  },
  {
    id: "air-couture-satin-dusk",
    slug: "air-couture-satin-dusk",
    name: "Satin Dusk ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Rose-Pink", "liquid matte lipstick"],
    description: {
      headline: "A muted rose-pink that softens the face ? elegant, gentle, and always flattering.",
      body: "A rose that does not lean too cool or too bright. Just a soft, diffused pink perfect for everyday luxury.",
    },
  },
  {
    id: "air-couture-berry-clipse",
    slug: "air-couture-berry-clipse",
    name: "Berry ?clipse ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["Air Couture", "Berry Purple", "liquid matte lipstick"],
    description: {
      headline: "A deep berry-violet that commands attention with elegance ? bold yet wearable.",
      body: "A dramatic berry-violet crafted to flatter Indian undertones without going grey or black.",
    },
  },
  {
    id: "glass-luxe-glaze-drop",
    slug: "glass-luxe-glaze-drop",
    name: "Glaze Drop ? Glass Luxe\u2122 Lip Gloss",
    range: "glass",
    type: "single",
    tags: ["Clear + Soft Glow", "Glass Luxe", "cruelty-free", "dermatologically tested", "lip gloss", "non-sticky", "paraben-free", "talc-free"],
    description: {
      headline: "A clear champagne gloss with soft reflective light ? weightless, hydrating, and never sticky.",
      body: "Glassy shine with zero stickiness and a soft champagne shimmer that elevates any lip color. Clean, elegant, and extremely wearable.",
    },
  },
  {
    id: "glass-luxe-bare-silk",
    slug: "glass-luxe-bare-silk",
    name: "Bare Silk ? Glass Luxe\u2122 Lip Gloss",
    range: "glass",
    type: "single",
    tags: ["Glass Luxe", "Warm Nude", "cruelty-free", "lip gloss", "non-sticky", "paraben-free", "talc-free"],
    description: {
      headline: "A warm nude gloss with a rose-gold sheen ? soft, smooth, and naturally flattering on Indian skin.",
      body: "Bare Silk adds warm nude shine without heaviness, glitter chunks, or stickiness. Subtle, wearable, and balanced for Indian undertones.",
    },
  },
  {
    id: "glass-luxe-berry-bloom",
    slug: "glass-luxe-berry-bloom",
    name: "Berry Bloom ? Glass Luxe\u2122 Lip Gloss",
    range: "glass",
    type: "single",
    tags: ["Berry Glow", "Glass Luxe", "cruelty-free", "derm-tested", "lip gloss", "non-sticky", "paraben-free"],
    description: {
      headline: "A sheer berry gloss with pink-violet pearls ? deep, soft, and beautifully luminous.",
      body: "A berry gloss that deepens without darkening. Berry Bloom gives lips a full, plush glow with soft violet-pink light.",
    },
  },
  {
    id: "velvet-power-spiced-ember",
    slug: "velvet-power-spiced-ember",
    name: "Spiced Ember ? Velvet Power\u2122 Lipstick",
    range: "velvet",
    type: "single",
    tags: ["lipstick", "bullet", "Velvet Power", "warm terracotta", "rust nude", "soft-matte", "terracotta", "nude", "warm", "bestsellers", "Indian skintones", "longwear", "non-drying", "paraben-free", "talc-free", "transfer-minimal", "vegan", "cruelty-free", "climate-proof"],
    extraBadges: benefitBadges,
    ingredients: {
      keyActives: [
        { name: "Shea Butter", description: "Helps nourish and soften lips for comfortable soft-matte wear." },
        { name: "Jojoba Oil", description: "Supports moisture balance and smooth glide." },
        { name: "Hyaluronic Acid", description: "Attracts and retains moisture to keep lips looking plump and comfortable." },
        { name: "Vitamin E", description: "Provides antioxidant support and helps condition lips." },
      ],
      supportingIngredients: [
        "Castor Oil",
        "Candelilla Wax",
        "Carnauba Wax",
        "Hydrogenated Polyisobutene",
        "Silica",
        "Dimethicone",
        "Iron Oxides",
        "Titanium Dioxide",
        "Mica",
        "Flavor",
        "Phenoxyethanol",
        "Ethylhexylglycerin",
      ],
    },
    media: { heroImage: "spiced_ember_01" },
  },
  {
    id: "air-couture-gulnaar",
    slug: "air-couture-gulnaar",
    name: "Gulnaar ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["liquid matte lipstick", "Air Couture", "red-brown", "saffron red", "deep", "matte", "longwear", "warm undertones", "Indian skintones", "transfer-minimal", "smudge-resistant", "lightweight matte", "non-drying", "vegan", "cruelty-free"],
    extraBadges: benefitBadges,
    ingredients: {
      keyActives: [
        { name: "Squalane", description: "Supports a smooth, comfortable, non-drying matte finish." },
        { name: "Hyaluronic Acid", description: "Helps keep lips feeling hydrated even in a matte formula." },
        { name: "Tocopheryl Acetate (Vitamin E)", description: "Provides antioxidant care and conditioning." },
      ],
      supportingIngredients: [
        "Isododecane",
        "Dimethicone",
        "Trimethylsiloxysilicate",
        "Acrylates/VA Copolymer",
        "Cyclopentasiloxane",
        "Bentone Gel",
        "Silica",
        "Microspheres",
        "Iron Oxides",
        "Red 7",
        "Yellow 6",
        "Titanium Dioxide",
        "Phenoxyethanol",
        "Ethylhexylglycerin",
      ],
    },
    media: { heroImage: "gulnaar_01" },
  },
  {
    id: "air-couture-midnight-smoke",
    slug: "air-couture-midnight-smoke",
    name: "Midnight Smoke ? Air Couture\u2122 Liquid Matte Lipstick",
    range: "air",
    type: "single",
    tags: ["liquid matte lipstick", "Air Couture", "plum brown", "smoky", "deep", "cool-neutral", "matte", "bold", "longwear", "transfer-minimal", "smudge-resistant", "comfortable matte", "Indian skintones", "vegan", "cruelty-free"],
    extraBadges: benefitBadges,
    ingredients: {
      keyActives: [
        { name: "Squalane", description: "Helps keep the deep matte finish feeling comfortable, not tight." },
        { name: "Hyaluronic Acid", description: "Adds a layer of comfort and suppleness in a matte formula." },
        { name: "Tocopheryl Acetate (Vitamin E)", description: "Conditions lips and provides antioxidant care." },
      ],
      supportingIngredients: [
        "Isododecane",
        "Dimethicone",
        "Trimethylsiloxysilicate",
        "Acrylates/VA Copolymer",
        "Cyclopentasiloxane",
        "Bentone Gel",
        "Silica",
        "Microspheres",
        "Iron Oxides",
        "Titanium Dioxide",
        "Red 7",
        "Blue 1",
        "Phenoxyethanol",
        "Ethylhexylglycerin",
      ],
    },
    media: { heroImage: "midnight_smoke_01" },
  },
];

const withDefaults = (product, index) => {
  const range = product.range || "velvet";
  const rangeDefaults = ranges[range] || {};
  const fallbackImage = fallbackImages[index % fallbackImages.length];
  const media = product.media || {};

  const gallery = Array.isArray(media.gallery)
    ? media.gallery.map((item, idx) => ({
        ...item,
        role: item.role || (idx === 0 ? "hero" : "swatch"),
        url: item.url || item.id || fallbackImage,
      }))
    : [];

  if (!gallery.length) {
    gallery.push({ id: `${product.id}-hero`, alt: product.name, role: "hero", url: fallbackImage });
  }

  const badges = [
    ...(product.badges || []),
    ...(rangeDefaults.badge ? [rangeDefaults.badge] : []),
    ...(product.extraBadges || []),
  ].filter(Boolean);

  const ingredients = product.ingredients || rangeDefaults.ingredients || { keyActives: [], supportingIngredients: [] };

  return {
    ...product,
    badges,
    pricing: { ...basePricing, ...(product.pricing || {}) },
    size: { ...baseSize, ...(product.size || {}) },
    setContents: Array.isArray(product.setContents) ? product.setContents : [],
    ingredients,
    media: {
      ...media,
      heroImage: media.heroImage || gallery[0]?.url || fallbackImage,
      gallery,
    },
  };
};

const cevonneProducts = rawProducts.map(withDefaults);

export default cevonneProducts;
export const productById = Object.fromEntries(cevonneProducts.map((item) => [item.id, item]));
