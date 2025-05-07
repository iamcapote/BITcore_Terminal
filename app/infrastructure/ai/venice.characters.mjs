export const VENICE_CHARACTERS = {
  Archon: {
    character_slug: 'archon',
    description: 'A research-oriented AI model designed for advanced exploration and analytical tasks.'
  },
  Bitcore: {
    character_slug: 'bitcore',
    description: 'A hyper cognitive AI model focused on operational tasks.'
  },
  Metacore: {
    character_slug: 'metacore',
    description: 'A metadata-centric AI system specialized in organizing and interpreting structural data.'
  }
};

export function isValidCharacter(character) {
  return Object.prototype.hasOwnProperty.call(VENICE_CHARACTERS, character);
}

export function getDefaultChatCharacterSlug() {
  return VENICE_CHARACTERS.Bitcore.character_slug; // Default for chat
}

export function getDefaultResearchCharacterSlug() {
  return VENICE_CHARACTERS.Archon.character_slug; // Default for research
}

export function getDefaultTokenClassifierCharacterSlug() {
  return VENICE_CHARACTERS.Metacore.character_slug; // Default for token classification
}