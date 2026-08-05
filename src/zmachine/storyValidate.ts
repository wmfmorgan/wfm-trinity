/**
 * Validate raw Z-code story bytes before handing them to the interpreter.
 * Catches the common "Memory read out of bounds" failure modes early with
 * clearer messages (truncated downloads, Blorb containers, garbage files).
 */

export class StoryValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoryValidationError'
  }
}

/** Header-declared story length in bytes (Z-machine Spec §11). */
export function headerFileLengthBytes(data: Uint8Array): number | null {
  if (data.byteLength < 28) return null
  const version = data[0]!
  const word = (data[26]! << 8) | data[27]!
  if (word === 0) return null
  if (version <= 3) return word * 2
  if (version <= 5) return word * 4
  // V6–V8
  return word * 8
}

export function looksLikeBlorb(data: Uint8Array): boolean {
  if (data.byteLength < 12) return false
  // FORM....IFRS
  const form =
    data[0] === 0x46 &&
    data[1] === 0x4f &&
    data[2] === 0x52 &&
    data[3] === 0x4d
  const ifrs =
    data[8] === 0x49 &&
    data[9] === 0x46 &&
    data[10] === 0x52 &&
    data[11] === 0x53
  return form && ifrs
}

/**
 * Throws StoryValidationError if bytes are not a plausible raw Z-code story.
 * Returns a short diagnostic summary for logging.
 */
export function validateStoryBytes(data: Uint8Array): {
  version: number
  declaredLength: number | null
  actualLength: number
} {
  if (data.byteLength < 64) {
    throw new StoryValidationError(
      'File is too small to be a Z-machine story (under 64 bytes).',
    )
  }

  if (looksLikeBlorb(data)) {
    throw new StoryValidationError(
      'This looks like a Blorb package (.zblorb), not raw Z-code. ' +
        'Export or unwrap to a raw .z3–.z8 story file first.',
    )
  }

  // ZIP local header
  if (data[0] === 0x50 && data[1] === 0x4b) {
    throw new StoryValidationError(
      'This looks like a ZIP archive. Unzip it and import the .z3–.z8 story inside.',
    )
  }

  const version = data[0]!
  if (
    version < 1 ||
    version > 8 ||
    version === 6 // graphics not supported by our engine
  ) {
    throw new StoryValidationError(
      `Unsupported or invalid Z-machine version byte (${version}). ` +
        'Expected a raw Infocom/Inform story (.z3–.z5, .z7–.z8).',
    )
  }

  const declaredLength = headerFileLengthBytes(data)
  const actualLength = data.byteLength

  if (declaredLength != null && declaredLength > actualLength + 1) {
    // +1: some files omit a trailing pad byte
    throw new StoryValidationError(
      `Story file appears truncated: header claims ${declaredLength} bytes, ` +
        `but the file is only ${actualLength} bytes. ` +
        'Re-copy the story from a complete source (a partial download often causes ' +
        '"Memory read out of bounds" when the game starts).',
    )
  }

  // Static memory base must sit inside the file
  const staticBase = (data[14]! << 8) | data[15]!
  if (staticBase === 0 || staticBase >= actualLength) {
    throw new StoryValidationError(
      'Story header looks corrupt (static memory base is out of range).',
    )
  }

  const initialPC = (data[6]! << 8) | data[7]!
  if (initialPC === 0 || initialPC >= actualLength) {
    throw new StoryValidationError(
      'Story header looks corrupt (initial program counter is out of range).',
    )
  }

  return { version, declaredLength, actualLength }
}
