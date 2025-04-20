export const VENICE_CHARACTERS = {
  Archon: {
    character_slug: 'archon-01v',
    description: 'A research-oriented AI model designed for advanced exploration and analytical tasks.'
  },
  Metacore: {
    character_slug: 'metacore',
    description: 'A metadata-centric AI system specialized in organizing and interpreting structural data.'
  }
};

export function isValidCharacter(character) {
  return Object.prototype.hasOwnProperty.call(VENICE_CHARACTERS, character);
}