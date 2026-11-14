// The three round-1 directions: every value the mockups use. Nothing here is app code.
export const DIRECTIONS = {
  forge: {
    letter: 'A', name: 'Forge', style: 0, styleName: 'Clay',
    pitch: 'Closest to chess.com. Warm charcoal, Joulz gold as the one action colour, matte clay 3D art, normal-width type, a full-width Play bar above the tabs.',
    dark: { bg: '#262320', raised: '#2F2B27', surface: '#36322D', surface2: '#45403A', line: '#4C463F', ledge2: '#1E1B18',
      text: '#F5F1EA', text2: '#D3CBBF', text3: '#ADA497', accent: '#F4B63F', ledge: '#B07A1C', onAccent: '#241708' },
    light: { bg: '#F2EEE8', raised: '#FFFFFF', surface: '#FFFFFF', surface2: '#E8E2D9', line: '#DDD5CA', ledge2: '#CFC6B9',
      text: '#221E1A', text2: '#4F483F', text3: '#6B6358', accent: '#F4B63F', ledge: '#B07A1C', onAccent: '#241708' },
    radius: { sm: 8, md: 12, lg: 16, btn: 12 }, ledgeH: 4,
    type: { display: 100, title: 100, body: 100, dispWeight: 800 },
    nav: 'bar', hero: 'card', felt: '#1E6B57',
  },
  volt: {
    letter: 'B', name: 'Volt', style: 1, styleName: 'Gloss',
    pitch: 'Sportier and louder. Ember orange as the action colour, glossy vinyl-toy 3D art, expanded heavy headings, pill buttons, a raised Play button in the middle of the tab bar.',
    dark: { bg: '#201D1B', raised: '#2A2623', surface: '#312D29', surface2: '#403A35', line: '#47413B', ledge2: '#171513',
      text: '#FAF6F0', text2: '#D6CDC1', text3: '#ACA295', accent: '#FF8F3A', ledge: '#B9531A', onAccent: '#2A1205' },
    light: { bg: '#F5F1EB', raised: '#FFFFFF', surface: '#FFFFFF', surface2: '#ECE5DC', line: '#E0D7CC', ledge2: '#D2C7B9',
      text: '#211C18', text2: '#4E463E', text3: '#6B6258', accent: '#FF8F3A', ledge: '#B9531A', onAccent: '#2A1205' },
    radius: { sm: 12, md: 18, lg: 24, btn: 999 }, ledgeH: 4,
    type: { display: 118, title: 112, body: 100, dispWeight: 900 },
    nav: 'raised', hero: 'bleed', felt: '#17607A',
  },
  studio: {
    letter: 'C', name: 'Studio', style: 2, styleName: 'Toon',
    pitch: 'Crisper and more compact. Electric teal as the action colour (gold kept for first place and the bolt), outlined toon-shaded 3D art, condensed headings, tighter corners and a deeper 6 px ledge.',
    dark: { bg: '#272523', raised: '#302E2B', surface: '#383532', surface2: '#46423E', line: '#504B46', ledge2: '#1C1A18',
      text: '#F6F3EE', text2: '#D4CDC4', text3: '#AFA69B', accent: '#33D1BE', ledge: '#17857A', onAccent: '#08221F' },
    light: { bg: '#F1EFEB', raised: '#FFFFFF', surface: '#FFFFFF', surface2: '#E6E2DC', line: '#DAD4CC', ledge2: '#CCC5BC',
      text: '#22201D', text2: '#4C4741', text3: '#69635B', accent: '#33D1BE', ledge: '#17857A', onAccent: '#08221F' },
    radius: { sm: 6, md: 10, lg: 12, btn: 10 }, ledgeH: 6,
    type: { display: 82, title: 88, body: 100, dispWeight: 800 },
    nav: 'bar', hero: 'split', felt: '#1D5F6E',
  },
};
export const SHARED = { win: '#57C76F', loss: '#EF5B53', joules: '#C6FF3D', gold: '#F4B63F' };
export const TYPE_SCALE = [
  ['Display', 32, 'Win moment, page heroes'], ['Title', 24, 'Screen titles'], ['Heading', 20, 'Card and section titles'],
  ['Body', 17, 'Buttons, rows'], ['Label', 15, 'Secondary lines'], ['Caption', 13, 'Meta, counts (never smaller)'],
];
export const SPACING = [4, 8, 12, 16, 20, 24, 32, 40];
