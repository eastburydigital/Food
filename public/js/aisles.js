// Rough supermarket aisle for an ingredient line, so the shopping list can be grouped.
const AISLES = [
  ['Fruit & veg', /banana|apple|pear|mango|lemon|lime|onion|leek|garlic|ginger|carrot|potato|squash|courgette|pepper(?!corn)|spinach|cauliflower|broccoli|avocado|lettuce|herb|chive|basil|mint|dill|sage|parsley|coriander leaves|spring onion/i],
  ['Dairy & eggs', /egg|milk|butter|cheese|cheddar|feta|halloumi|paneer|mozzarella|ricotta|mascarpone|cream|yoghurt|gruy[eè]re|cottage|crème|creme/i],
  ['Chilled', /tofu|hummus|gnocchi|filo|pastry/i],
  ['Bakery', /\bbread\b|sourdough|tortilla|pitta|naan|brioche|\brolls?\b|crumpet/i],
  ['Pasta, rice & grains', /pasta|spaghetti|macaroni|lasagne|noodle|udon|rice|oats|polenta|semolina|couscous/i],
  ['Tins & jars', /passata|tin|jar|chickpea|beans|lentil|coconut milk|tomato purée|peanut butter|tahini|jam|honey|maple|stock|miso|soy sauce|worcestershire|mayonnaise|mustard/i],
  ['Baking', /flour|sugar|baking powder|bicarbonate|cornflour|vanilla|chocolate|cocoa/i],
  ['Spices & oils', /cumin|paprika|turmeric|garam|curry powder|cinnamon|nutmeg|oregano|thyme|cardamom|oil|salt|pepper$/i],
];

// Checked first: phrases that would otherwise match the wrong aisle ("coconut milk", "tin butter beans").
const SPECIFIC = [
  ['Tins & jars', /\btin\b|\bjar\b|coconut milk|peanut butter|almond butter|roasted red pepper|passata/i],
  ['Chilled', /gnocchi|tofu/i],
  ['Spices & oils', /salt and pepper|^salt\b/i],
];

export function aisleFor(text) {
  const t = text.replace(/^[\d½¼¾⅓⅔.\s–×-]+/, '');
  for (const [name, re] of SPECIFIC) if (re.test(t)) return name;
  for (const [name, re] of AISLES) if (re.test(t)) return name;
  return 'Other';
}

export const AISLE_ORDER = [...AISLES.map(([n]) => n), 'Other'];
