import { createColumns } from '../Util'

const ROW_LENGTH = 3 * 4 + 3 * 4 + 4 + 4
const SH_C0 = 0.28209479177387814

/**
 *
 * @param data
 * @returns {{numSplats: number, columns: * }}
 */
export function parseSplatToColumns(data) {
  const numSplats = data.length / ROW_LENGTH
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const columns = createColumns(numSplats)
  for (let splatIndex = 0; splatIndex < numSplats; splatIndex++) {
    const offset = splatIndex * ROW_LENGTH
    // Read position (3 × float32)
    const x = dv.getFloat32(offset + 0, true)
    const y = dv.getFloat32(offset + 4, true)
    const z = dv.getFloat32(offset + 8, true)
    // Read scale (3 × float32)
    const scaleX = dv.getFloat32(offset + 12, true)
    const scaleY = dv.getFloat32(offset + 16, true)
    const scaleZ = dv.getFloat32(offset + 20, true)

    // Read color and opacity (4 × uint8)
    const red = dv.getUint8(offset + 24)
    const green = dv.getUint8(offset + 25)
    const blue = dv.getUint8(offset + 26)
    const opacity = dv.getUint8(offset + 27)

    // Read rotation quaternion (4 × uint8)
    const rot0 = dv.getUint8(offset + 28)
    const rot1 = dv.getUint8(offset + 29)
    const rot2 = dv.getUint8(offset + 30)
    const rot3 = dv.getUint8(offset + 31)

    // Store position
    columns['x'][splatIndex] = x
    columns['y'][splatIndex] = y
    columns['z'][splatIndex] = z

    // Store scale (convert from linear in .splat to log scale for internal use)
    columns['scale_0'][splatIndex] = Math.log(scaleX)
    columns['scale_1'][splatIndex] = Math.log(scaleY)
    columns['scale_2'][splatIndex] = Math.log(scaleZ)

    // Store color (convert from uint8 back to spherical harmonics)

    columns['f_dc_0'][splatIndex] = (red / 255.0 - 0.5) / SH_C0
    columns['f_dc_1'][splatIndex] = (green / 255.0 - 0.5) / SH_C0
    columns['f_dc_2'][splatIndex] = (blue / 255.0 - 0.5) / SH_C0

    // Store opacity (convert from uint8 to float and apply inverse sigmoid)
    const epsilon = 1e-6
    const normalizedOpacity = Math.max(
      epsilon,
      Math.min(1.0 - epsilon, opacity / 255.0),
    )
    columns['opacity'][splatIndex] = Math.log(
      normalizedOpacity / (1.0 - normalizedOpacity),
    )

    // Store rotation quaternion (convert from uint8 [0,255] to float [-1,1] and normalize)
    const rot0Norm = (rot0 / 255.0) * 2.0 - 1.0
    const rot1Norm = (rot1 / 255.0) * 2.0 - 1.0
    const rot2Norm = (rot2 / 255.0) * 2.0 - 1.0
    const rot3Norm = (rot3 / 255.0) * 2.0 - 1.0

    // Normalize quaternion
    const length = Math.sqrt(
      rot0Norm * rot0Norm +
        rot1Norm * rot1Norm +
        rot2Norm * rot2Norm +
        rot3Norm * rot3Norm,
    )
    if (length > 0) {
      columns['rot_0'][splatIndex] = rot0Norm / length
      columns['rot_1'][splatIndex] = rot1Norm / length
      columns['rot_2'][splatIndex] = rot2Norm / length
      columns['rot_3'][splatIndex] = rot3Norm / length
    } else {
      // Default to identity quaternion if invalid
      columns['rot_0'][splatIndex] = 0.0
      columns['rot_1'][splatIndex] = 0.0
      columns['rot_2'][splatIndex] = 0.0
      columns['rot_3'][splatIndex] = 1.0
    }
  }
  return {
    numSplats,
    columns,
  }
}

/**
 *
 * @param data
 * @returns {{numSplats: number, positions: Float32Array<ArrayBuffer>, scales: Float32Array<ArrayBuffer>, rotations: Float32Array<ArrayBuffer>, colors: Uint8Array<ArrayBuffer>}}
 */
export function parseSplatToAttributes(data) {
  const numSplats = data.length / ROW_LENGTH
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)

  const attributes = {
    numSplats,
    positions: new Float32Array(numSplats * 3),
    scales: new Float32Array(numSplats * 3),
    rotations: new Float32Array(numSplats * 4),
    colors: new Uint8Array(numSplats * 4),
  }
  for (let i = 0; i < numSplats; i++) {
    const offset = i * ROW_LENGTH
    // position
    attributes.positions[i * 3 + 0] = dv.getFloat32(offset + 0, true)
    attributes.positions[i * 3 + 1] = dv.getFloat32(offset + 4, true)
    attributes.positions[i * 3 + 2] = dv.getFloat32(offset + 8, true)
    // scale
    attributes.scales[i * 3 + 0] = dv.getFloat32(offset + 12, true)
    attributes.scales[i * 3 + 1] = dv.getFloat32(offset + 16, true)
    attributes.scales[i * 3 + 2] = dv.getFloat32(offset + 20, true)
    // color
    attributes.colors[i * 4 + 0] = dv.getUint8(offset + 24)
    attributes.colors[i * 4 + 1] = dv.getUint8(offset + 25)
    attributes.colors[i * 4 + 2] = dv.getUint8(offset + 26)
    attributes.colors[i * 4 + 3] = dv.getUint8(offset + 27)
    // rotation
    const qx = (dv.getUint8(offset + 28) - 128) / 128
    const qy = (dv.getUint8(offset + 29) - 128) / 128
    const qz = (dv.getUint8(offset + 30) - 128) / 128
    const qw = (dv.getUint8(offset + 31) - 128) / 128
    const invLen = 1.0 / Math.hypot(qx, qy, qz, qw)
    attributes.rotations[i * 4 + 3] = qx * invLen
    attributes.rotations[i * 4 + 0] = qy * invLen
    attributes.rotations[i * 4 + 1] = qz * invLen
    attributes.rotations[i * 4 + 2] = qw * invLen
  }
  return attributes
}
