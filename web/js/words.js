// Word bank for DrawBattle. Each entry: { word, category }.
// Kept family-friendly and easy-to-draw.

export const WORDS = [
  // Animals
  ['cat', 'Animals'], ['dog', 'Animals'], ['elephant', 'Animals'], ['lion', 'Animals'],
  ['tiger', 'Animals'], ['fish', 'Animals'], ['snake', 'Animals'], ['rabbit', 'Animals'],
  ['penguin', 'Animals'], ['octopus', 'Animals'], ['owl', 'Animals'], ['shark', 'Animals'],
  ['frog', 'Animals'], ['bee', 'Animals'], ['horse', 'Animals'], ['whale', 'Animals'],

  // Food
  ['apple', 'Food'], ['banana', 'Food'], ['pizza', 'Food'], ['burger', 'Food'],
  ['ice cream', 'Food'], ['donut', 'Food'], ['carrot', 'Food'], ['cake', 'Food'],
  ['cherry', 'Food'], ['egg', 'Food'], ['bread', 'Food'], ['lemon', 'Food'],

  // Objects
  ['umbrella', 'Objects'], ['guitar', 'Objects'], ['clock', 'Objects'], ['key', 'Objects'],
  ['ladder', 'Objects'], ['camera', 'Objects'], ['scissors', 'Objects'], ['balloon', 'Objects'],
  ['robot', 'Objects'], ['anchor', 'Objects'], ['glasses', 'Objects'], ['rocket', 'Objects'],

  // Nature
  ['sun', 'Nature'], ['tree', 'Nature'], ['mountain', 'Nature'], ['cloud', 'Nature'],
  ['flower', 'Nature'], ['star', 'Nature'], ['rainbow', 'Nature'], ['volcano', 'Nature'],
  ['island', 'Nature'], ['snowman', 'Nature'], ['cactus', 'Nature'], ['moon', 'Nature'],

  // Things / vehicles / places
  ['house', 'Places'], ['castle', 'Places'], ['bridge', 'Places'], ['lighthouse', 'Places'],
  ['car', 'Vehicles'], ['boat', 'Vehicles'], ['airplane', 'Vehicles'], ['bicycle', 'Vehicles'],
  ['train', 'Vehicles'], ['submarine', 'Vehicles'],

  // Sports / misc
  ['soccer ball', 'Sports'], ['skateboard', 'Sports'], ['trophy', 'Sports'], ['kite', 'Sports'],
].map(([word, category]) => ({ word, category }));

export const CATEGORY_OF = WORDS.reduce((m, w) => (m[w.word] = w.category, m), {});
