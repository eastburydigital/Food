// Personal swaps. When a recipe uses something on the person's food list, offer a
// substitute instead of hiding the recipe. Every option here already follows the
// app's rules (vegetarian, no whole nuts/seeds, no skins or raw veg, mild).
//
// Each entry:
//   names   words a person might type for this food ("dairy" covers several entries)
//   re      finds the food in an ingredient line
//   options tried in order; the first that doesn't clash with the food list wins
//     word  replaces just the matched words, keeping the quantity ("300ml milk" -> "300ml oat milk")
//     line  replaces the whole ingredient line
//     omit  drops the ingredient
//     note  tells the cook what to do differently

const DAIRY = ['dairy', 'lactose'];
const GLUTEN = ['gluten', 'wheat'];

export const SWAPS = [
  { names: ['mushroom', 'mushrooms'], re: /\bmushrooms?\b/i, options: [
    { word: 'peeled, diced courgette', has: ['courgette'], note: 'Cook it just as you would the mushrooms, until very soft.' },
    { word: 'peeled, diced butternut squash', has: ['squash','butternut squash'], note: 'Cook until very soft.' } ] },
  { names: ['onion', 'onions', 'spring onion', 'allium', 'alliums'], re: /\b(red |spring )?onions?\b(?!\s*powder)/i, options: [
    { line: 'Pinch of asafoetida (hing)', has: [], note: 'Add it to the hot oil or spices for a savoury, oniony flavour. Skip the steps for softening the onion.' },
    { line: '1 leek, white part only, very finely chopped', has: ['leek','allium'], note: 'Cook the leek until silky, wherever the method says onion.' } ] },
  { names: ['garlic', 'allium', 'alliums'], re: /\bgarlic( clove)?s?\b(?!-infused)/i, options: [
    { line: '1 tbsp garlic-infused oil', has: [], note: 'Use it instead of the garlic (and some of the oil). It gives the flavour without garlic pieces.' },
    { omit: true, has: [], note: 'Leave out the garlic.' } ] },
  { names: ['leek', 'leeks', 'allium', 'alliums'], re: /\bleeks?\b/i, options: [
    { word: 'onion', has: ['onion','allium'], note: 'Use a finely chopped onion, cooked until very soft.' },
    { line: 'Pinch of asafoetida (hing)', has: [], note: 'Add it with the butter or oil for flavour.' } ] },
  { names: ['lentil', 'lentils', 'pulses'], re: /\b(red )?lentils?\b/i, options: [
    { word: 'peeled, diced potato', has: ['potato','nightshade'], note: 'Potato gives body in place of lentils. Cook until very soft. Serve with an egg or tofu for protein.' } ] },
  { names: ['chickpea', 'chickpeas', 'pulses'], re: /\bchickpeas?\b/i, options: [
    { word: 'butter beans', has: ['beans','butter beans','pulses'], note: 'Blend well and sieve to remove any skins.' } ] },
  { names: ['beans', 'butter beans', 'pulses'], re: /\b(butter|cannellini) beans?\b/i, options: [
    { word: 'peeled, diced potato', has: ['potato','nightshade'], note: 'Simmer until very soft, then blend.' } ] },
  { names: ['milk', ...DAIRY], re: /(?<!coconut |skimmed )\bmilk\b(?! powder)/i, options: [
    { word: 'oat or soya milk', has: ['oats','oat'], note: 'Unsweetened, calcium-fortified plant milk works best.' } ] },
  { names: ['milk powder', ...DAIRY], re: /\b(skimmed )?milk powder\b/i, options: [
    { word: 'soya protein powder (unflavoured)', has: ['soy','soya'], note: 'Or leave it out.' },
    { omit: true, has: [], note: 'Leave out the milk powder.' } ] },
  { names: ['cream', ...DAIRY], re: /\b(double |single |soured )?cream\b(?! cheese)|crème fraîche/i, options: [
    { word: 'oat cream', has: ['oats','oat'], note: 'Stir it in off the heat so it doesn\'t split.' },
    { word: 'coconut cream', has: ['coconut'], note: 'Adds a gentle coconut flavour.' } ] },
  { names: ['yoghurt', 'yogurt', ...DAIRY], re: /\b(greek |natural )?yog(h)?urt\b/i, options: [
    { word: 'plain soya yoghurt', has: ['soy','soya'], note: 'Choose unsweetened.' },
    { word: 'coconut yoghurt', has: ['coconut'], note: 'Choose unsweetened.' } ] },
  { names: ['butter', ...DAIRY], re: /(?<!(peanut|almond|nut) )\bbutter\b(?! beans?)/i, options: [
    { word: 'olive oil', has: [], note: 'Use the same amount of olive oil, or a plant spread for baking.' } ] },
  { names: ['paneer', 'cheese', ...DAIRY], re: /\bpaneer\b/i, options: [
    { word: 'firm tofu', has: ['tofu','soy','soya'], note: 'Press the tofu first and fry until golden, just like the paneer.' } ] },
  { names: ['halloumi', 'cheese', ...DAIRY], re: /\bhalloumi\b/i, options: [
    { word: 'paneer', has: ['paneer','cheese','dairy','lactose'], note: 'Fry or roast it the same way.' },
    { word: 'firm tofu', has: ['tofu','soy','soya'], note: 'Press it first, then roast until golden.' } ] },
  { names: ['feta', 'cheese', ...DAIRY], re: /\bfeta\b/i, options: [
    { word: 'ricotta with a pinch of salt', has: ['ricotta','cheese','dairy','lactose'], note: 'Milder and creamier than feta.' },
    { word: 'firm tofu, crumbled, with lemon and salt', has: ['tofu','soy','soya'], note: 'Season well — tofu needs it.' } ] },
  { names: ['cheddar', 'gruyere', 'gruyère', 'mozzarella', 'parmesan', 'hard cheese', 'cheese', ...DAIRY],
    re: /\b(mature )?cheddar\b|gruy[eè]re|mozzarella|(vegetarian )?italian-style hard cheese/i, options: [
    { line: 'Nutritional yeast — 1 tbsp for every 25g of cheese in the original', has: [], note: 'Gives a cheesy flavour without dairy.' } ] },
  { names: ['ricotta', 'cottage cheese', 'cream cheese', 'mascarpone', 'cheese', ...DAIRY], re: /\bricotta\b|cottage cheese|cream cheese|mascarpone/i, options: [
    { word: 'silken tofu, blended smooth', has: ['tofu','soy','soya'], note: 'Season it with lemon and a pinch of salt.' } ] },
  { names: ['egg', 'eggs'], re: /\beggs?\b(?! yolks?)/i, options: [
    { line: 'Silken tofu, blended — 50g for every egg in the original', has: ['tofu','soy','soya'], note: 'Works for binding and baking. Bakes may be a little denser.' } ] },
  { names: ['tofu', 'soy', 'soya'], re: /\b(silken |firm |calcium-set firm )?tofu\b/i, options: [
    { word: 'paneer', has: ['paneer','cheese','dairy','lactose'], note: 'Fry the paneer until golden.' },
    { line: 'Eggs — 1 for every 60g of tofu in the original', has: ['egg','eggs'], note: 'Scramble or boil the eggs and add at the end.' } ] },
  { names: ['soy', 'soya', 'soy sauce'], re: /\bsoy sauce\b/i, options: [
    { word: 'coconut aminos', has: ['coconut'], note: 'Slightly sweeter than soy sauce.' } ] },
  { names: ['coconut'], re: /\bcoconut (milk|cream)\b/i, options: [
    { word: 'single cream', has: ['cream','dairy','lactose'], note: 'Stir it in at the end and don\'t let it boil.' },
    { word: 'oat cream', has: ['oats','oat'], note: 'Stir it in at the end.' } ] },
  { names: ['tomato', 'tomatoes', 'passata', 'nightshade', 'nightshades'], re: /\bpassata\b|tomato purée|\btomato(es)?\b/i, options: [
    { word: 'butternut squash purée (roasted and blended)', has: ['squash','butternut squash'], note: 'Makes a sweet, smooth sauce in place of tomato. Add a squeeze of lemon.' } ] },
  { names: ['pepper', 'peppers', 'red pepper', 'nightshade', 'nightshades'], re: /(?<!(salt and |black |white ))\b(roasted )?(red )?peppers?\b/i, options: [
    { word: 'roasted, peeled butternut squash', has: ['squash','butternut squash'], note: 'Roast until very soft before blending or adding.' } ] },
  { names: ['spinach'], re: /\b(baby )?spinach\b/i, options: [
    { word: 'peeled, grated courgette', has: ['courgette'], note: 'Cook until very soft.' } ] },
  { names: ['banana', 'bananas'], re: /\b(ripe )?bananas?\b/i, options: [
    { word: 'stewed pears', has: ['pear'], note: 'Use 1 pear per banana. Peel and stew until soft, then mash.' } ] },
  { names: ['peanut', 'peanuts', 'peanut butter', 'nuts'], re: /\bsmooth peanut butter\b|\bpeanut butter\b/i, options: [
    { word: 'smooth tahini', has: ['sesame','tahini'], note: 'Tahini is ground sesame — smooth, with no whole seeds.' },
    { word: 'smooth sunflower seed butter', has: ['sunflower','seeds'], note: 'Check it is completely smooth.' } ] },
  { names: ['oats', 'oat'], re: /\b(porridge |fine or instant |fine )?oats\b/i, options: [
    { word: 'rice flakes', has: ['rice'], note: 'Cook until soft, as you would oats.' } ] },
  { names: ['pasta', ...GLUTEN], re: /\b(pasta|spaghetti|macaroni|lasagne sheets|orzo)\b/i, options: [
    { word: 'gluten-free $1', has: [], note: 'Gluten-free pasta can go soft quickly, so check it early.' } ] },
  { names: ['bread', ...GLUTEN], re: /\b(white )?(sourdough|bread|brioche|pitta|tortilla|naan)\b/i, options: [
    { word: 'gluten-free bread', has: [], note: 'Toast it lightly for the best texture.' } ] },
  { names: ['flour', ...GLUTEN], re: /\b(plain|self-raising) flour\b/i, options: [
    { word: 'gluten-free $1 flour', has: [], note: 'Gluten-free flour blends work in most of these recipes.' } ] },
  { names: ['cauliflower'], re: /\bcauliflower\b/i, options: [
    { word: 'peeled potato', has: ['potato','nightshade'], note: 'Cook until very soft.' } ] },
  { names: ['carrot', 'carrots'], re: /\bcarrots?\b/i, options: [
    { word: 'peeled sweet potato', has: ['sweet potato'], note: 'Cook until very soft.' } ] },
  { names: ['sweet potato', 'sweet potatoes'], re: /\bsweet potato(es)?\b/i, options: [
    { word: 'butternut squash', has: ['squash','butternut squash'], note: 'Peel and cook until very soft.' } ] },
  { names: ['squash', 'butternut squash', 'butternut'], re: /\b(butternut )?squash\b/i, options: [
    { word: 'peeled sweet potato', has: ['sweet potato'], note: 'Cook until very soft.' } ] },
  { names: ['potato', 'potatoes', 'nightshade', 'nightshades'], re: /(?<!sweet )\bpotato(es)?\b/i, options: [
    { word: 'peeled sweet potato', has: ['sweet potato'], note: 'Cooks a little faster than potato.' } ] },
  { names: ['courgette', 'courgettes', 'zucchini'], re: /\bcourgettes?\b/i, options: [
    { word: 'peeled butternut squash', has: ['squash','butternut squash'], note: 'Grate or dice it and cook until soft.' } ] },
  { names: ['ginger'], re: /\b(fresh |ground |grated )?ginger\b/i, options: [
    { omit: true, has: [], note: 'Leave out the ginger.' } ] },
  { names: ['avocado'], re: /\bavocado\b/i, options: [
    { word: 'smooth hummus', has: ['chickpea','chickpeas','pulses','sesame','garlic'], note: 'Spread it thickly in place of avocado.' } ] },
  { names: ['honey'], re: /\bhoney\b/i, options: [
    { word: 'maple syrup', has: [], note: '' } ] },
  { names: ['apple', 'apples'], re: /\bapples?\b/i, options: [
    { word: 'pears', has: ['pear'], note: 'Peel and cook them the same way.' } ] },
  { names: ['pear', 'pears'], re: /\bpears?\b/i, options: [
    { word: 'apples', has: ['apple'], note: 'Peel and cook them the same way.' } ] },
  { names: ['mango'], re: /\bmango\b/i, options: [
    { word: 'tinned peaches in juice, drained', has: ['peach'], note: 'Tinned peaches are peeled and soft.' } ] },
  { names: ['chocolate', 'cocoa', 'caffeine'], re: /\b(dark |milk )?chocolate\b/i, options: [
    { word: 'smooth peanut butter', has: ['peanut','peanuts','nuts'], note: 'Makes a nutty mousse instead of chocolate.' } ] },
  { names: ['curry', 'curry powder', 'spice', 'spices'], re: /\bmild curry powder\b|\bgaram masala\b/i, options: [
    { omit: true, has: [], note: 'Leave out the curry spices; add a pinch of ground cinnamon and turmeric for warmth.' } ] },
];

const norm = (s) => s.toLowerCase().trim().replace(/s$/, '');

/** Swap entries that a typed food-list word refers to. */
function entriesFor(word) {
  const w = norm(word);
  return SWAPS.filter((e) => e.names.some((n) => norm(n) === w));
}

/**
 * Work out how a recipe changes for this person's food list.
 * @returns {{status: 'ok'|'adapted'|'hidden', lines: string[], swaps: {from, to, note}[], blockers: string[]}}
 */
export function adapt(recipe, avoid) {
  const result = { status: 'ok', lines: recipe.ingredients.slice(), swaps: [], blockers: [] };
  if (!avoid.length) return result;
  const avoided = avoid.map((w) => ({ word: w, entries: entriesFor(w) }));
  // A swap clashes if it contains anything on the person's list.
  const avoidedNames = new Set(avoid.map(norm));
  const clashes = (option) => option.has.some((h) => avoidedNames.has(norm(h)));

  for (const { word, entries } of avoided) {
    // Foods with no swap rules: plain text match, and hide if found.
    if (!entries.length) {
      const text = (recipe.title + ' ' + recipe.ingredients.join(' ')).toLowerCase();
      if (text.includes(word.toLowerCase())) result.blockers.push(word);
      continue;
    }
    for (const entry of entries) {
      // The main ingredient (named in the title) can't be swapped out.
      if (entry.re.test(recipe.title)) { result.blockers.push(word); continue; }
      result.lines.forEach((line, i) => {
        if (line === null || !entry.re.test(line)) return;
        const option = entry.options.find((o) => !clashes(o));
        if (!option) { result.blockers.push(word); return; }
        let next;
        if (option.omit) next = null;
        else if (option.line) next = option.line;
        else next = line.replace(entry.re, (...m) => option.word.replace('$1', m[1] || ''));
        result.swaps.push({ from: line, to: next, note: option.note });
        result.lines[i] = next;
      });
    }
  }
  if (result.blockers.length) result.status = 'hidden';
  else if (result.swaps.length) result.status = 'adapted';
  return result;
}
