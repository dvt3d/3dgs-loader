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
