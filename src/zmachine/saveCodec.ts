/**
 * Workbench save blob codec.
 *
 * IWZ2 (current): compact binary — dynamic RAM + stack + PC. Story bytes are
 * NOT embedded; restore receives the library story separately.
 *
 * IWZ1 (legacy): JSON with embedded story + dynamic as number[] — still
 * readable for old saves.
 */

export const SAVE_MAGIC_IWZ1 = 'IWZ1'
export const SAVE_MAGIC_IWZ2 = 'IWZ2'

export interface StackPayload {
  data: number[]
  framePointers: number[]
}

export interface DecodedSave {
  pc: number
  staticBase: number
  dynamic: Uint8Array
  stack: StackPayload
  /** Present only for legacy IWZ1 blobs */
  storyBytes?: Uint8Array
  format: 'IWZ1' | 'IWZ2'
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  const v = n >>> 0
  b[0] = (v >>> 24) & 0xff
  b[1] = (v >>> 16) & 0xff
  b[2] = (v >>> 8) & 0xff
  b[3] = v & 0xff
  return b
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false)
}

/** Encode a UTF-8 JSON object as a precise ArrayBuffer (no trailing pad). */
export function encodeJsonArrayBuffer(value: unknown): ArrayBuffer {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  )
}

export function decodeJsonArrayBuffer(data: ArrayBuffer): unknown {
  const bytes = new Uint8Array(data)
  // Trim accidental trailing nulls from legacy .buffer misuse
  let end = bytes.byteLength
  while (end > 0 && bytes[end - 1] === 0) end--
  const json = new TextDecoder().decode(bytes.subarray(0, end))
  return JSON.parse(json)
}

/**
 * IWZ2 binary layout:
 *  magic[4] = "IWZ2"
 *  version u8 = 1
 *  pc u32 BE
 *  staticBase u32 BE
 *  dynamicLen u32 BE
 *  dynamic[dynamicLen]
 *  stackLen u32 BE
 *  stackJson[stackLen]  UTF-8 JSON of StackPayload
 */
export function encodeIwz2(args: {
  pc: number
  staticBase: number
  dynamic: Uint8Array
  stack: StackPayload
}): ArrayBuffer {
  const stackJson = new TextEncoder().encode(JSON.stringify(args.stack))
  const total =
    4 + // magic
    1 + // version
    4 + // pc
    4 + // staticBase
    4 + // dynamicLen
    args.dynamic.byteLength +
    4 + // stackLen
    stackJson.byteLength

  const out = new Uint8Array(total)
  let o = 0
  out[o++] = 0x49 // I
  out[o++] = 0x57 // W
  out[o++] = 0x5a // Z
  out[o++] = 0x32 // 2
  out[o++] = 1 // version
  out.set(u32(args.pc), o)
  o += 4
  out.set(u32(args.staticBase), o)
  o += 4
  out.set(u32(args.dynamic.byteLength), o)
  o += 4
  out.set(args.dynamic, o)
  o += args.dynamic.byteLength
  out.set(u32(stackJson.byteLength), o)
  o += 4
  out.set(stackJson, o)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
}

function decodeIwz2(data: ArrayBuffer): DecodedSave {
  const bytes = new Uint8Array(data)
  if (bytes.byteLength < 4 + 1 + 4 * 3) {
    throw new Error('IWZ2 save is truncated')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let o = 4
  const version = bytes[o++]!
  if (version !== 1) {
    throw new Error(`Unsupported IWZ2 version ${version}`)
  }
  const pc = readU32(view, o)
  o += 4
  const staticBase = readU32(view, o)
  o += 4
  const dynamicLen = readU32(view, o)
  o += 4
  if (o + dynamicLen + 4 > bytes.byteLength) {
    throw new Error('IWZ2 save is truncated (dynamic)')
  }
  const dynamic = bytes.subarray(o, o + dynamicLen)
  o += dynamicLen
  const stackLen = readU32(view, o)
  o += 4
  if (o + stackLen > bytes.byteLength) {
    throw new Error('IWZ2 save is truncated (stack)')
  }
  const stackJson = new TextDecoder().decode(bytes.subarray(o, o + stackLen))
  const stack = JSON.parse(stackJson) as StackPayload
  if (!Array.isArray(stack.data) || !Array.isArray(stack.framePointers)) {
    throw new Error('IWZ2 stack payload is invalid')
  }
  return {
    format: 'IWZ2',
    pc,
    staticBase,
    dynamic: dynamic.slice(),
    stack,
  }
}

function decodeIwz1(data: ArrayBuffer): DecodedSave {
  const parsed = decodeJsonArrayBuffer(data) as {
    magic?: string
    pc?: number
    staticBase?: number
    dynamic?: number[]
    stack?: StackPayload
    storyBytes?: number[]
  }
  if (parsed.magic !== SAVE_MAGIC_IWZ1) {
    throw new Error('Unrecognized save format')
  }
  if (
    typeof parsed.pc !== 'number' ||
    typeof parsed.staticBase !== 'number' ||
    !Array.isArray(parsed.dynamic) ||
    !parsed.stack
  ) {
    throw new Error('IWZ1 save is incomplete')
  }
  return {
    format: 'IWZ1',
    pc: parsed.pc,
    staticBase: parsed.staticBase,
    dynamic: Uint8Array.from(parsed.dynamic),
    stack: parsed.stack,
    storyBytes: parsed.storyBytes
      ? Uint8Array.from(parsed.storyBytes)
      : undefined,
  }
}

export function decodeSaveBlob(data: ArrayBuffer): DecodedSave {
  const bytes = new Uint8Array(data)
  if (bytes.byteLength < 4) {
    throw new Error('Save data is empty or truncated')
  }
  const magic = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)
  if (magic === SAVE_MAGIC_IWZ2) {
    return decodeIwz2(data)
  }
  // Legacy JSON (may start with '{' after optional BOM/nulls)
  return decodeIwz1(data)
}

export function isIwz2Magic(data: ArrayBuffer): boolean {
  const b = new Uint8Array(data)
  return (
    b.byteLength >= 4 &&
    b[0] === 0x49 &&
    b[1] === 0x57 &&
    b[2] === 0x5a &&
    b[3] === 0x32
  )
}
