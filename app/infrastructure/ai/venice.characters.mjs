export const VENICE_CHARACTERS = {
    Archon: {
      character_slug: 'archon-01v',
    },
    Metacore: {
      character_slug: 'metacore',
    },
};

export function isValidCharacter(character) {
  return Object.prototype.hasOwnProperty.call(VENICE_CHARACTERS, character);
}
