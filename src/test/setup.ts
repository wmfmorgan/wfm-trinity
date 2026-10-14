import '@testing-library/jest-dom'

// jsdom's SubtleCrypto rejects ArrayBuffers that originated in Node
// (File.arrayBuffer() in this environment). Copy into a local buffer first.
const subtle = globalThis.crypto?.subtle
if (subtle) {
  const digest = subtle.digest.bind(subtle)
  subtle.digest = ((algorithm, data) => {
    const bytes =
      typeof data === 'object' && data != null && ArrayBuffer.isView(data)
        ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        : new Uint8Array(data as ArrayBuffer)
    const local = new Uint8Array(bytes.byteLength)
    local.set(bytes)
    return digest(algorithm, local)
  }) as typeof subtle.digest
}
