import { createColumns, invLogTransform, sigmoidInv } from '../Util'
import WasmTask from '../WasmTask'
import wasmTask from '../WasmTask'

const SH_C0 = 0.28209479177387814
const ROW_LENGTH = 3 * 4 + 3 * 4 + 4 + 4

/**
 *
 * @param lo
 * @param hi
 * @param count
 * @returns {{xs: Uint16Array<ArrayBuffer>, ys: Uint16Array<ArrayBuffer>, zs: Uint16Array<ArrayBuffer>}}
 */
function _decodeMeans(lo, hi, count) {
  const xs = new Uint16Array(count)
  for (let i = 0; i < count; i++) {
    const o = i * 4
    xs[i] = lo[o + 0] | (hi[o + 0] << 8)
  }
  const ys = new Uint16Array(count)
  for (let i = 0; i < count; i++) {
    const o = i * 4
    ys[i] = lo[o + 1] | (hi[o + 1] << 8)
  }
  const zs = new Uint16Array(count)
  for (let i = 0; i < count; i++) {
    const o = i * 4
    zs[i] = lo[o + 2] | (hi[o + 2] << 8)
  }
  return { xs, ys, zs }
}

/**
 *
 * @param px
 * @param py
 * @param pz
 * @param tag
 * @returns {number[]}
 */
function _unpackQuat(px, py, pz, tag) {
  const maxComp = tag - 252
  const a = (px / 255) * 2 - 1
  const b = (py / 255) * 2 - 1
  const c = (pz / 255) * 2 - 1
  const sqrt2 = Math.sqrt(2)
  const comps = [0, 0, 0, 0]
  const idx = [
    [1, 2, 3],
    [0, 2, 3],
    [0, 1, 3],
    [0, 1, 2],
  ][maxComp]
  comps[idx[0]] = a / sqrt2
  comps[idx[1]] = b / sqrt2
  comps[idx[2]] = c / sqrt2
  // reconstruct max component to make unit length with positive sign
  const t =
    1 -
    (comps[0] * comps[0] +
      comps[1] * comps[1] +
      comps[2] * comps[2] +
      comps[3] * comps[3])
  comps[maxComp] = Math.sqrt(Math.max(0, t))
  return comps
}

/**
 *
 * @param webpUrl
 * @param meta
 * @param means_l
 * @param means_u
 * @param quats
 * @param scales
 * @param colors
 * @param centroids
 * @param labels
 * @returns {Promise<*>}
 */
export async function parseSogToColumns(
  webpUrl,
  meta,
  means_l,
  means_u,
  quats,
  scales,
  colors,
  centroids,
  labels,
) {
  const webpWasmTask = new WasmTask(webpUrl)
  await webpWasmTask.init()
  // meta.json
  const count = meta.count
  const { mins, maxs } = meta.means
  const xMin = mins[0]
  const xScale = maxs[0] - mins[0] || 1
  const yMin = mins[1]
  const yScale = maxs[1] - mins[1] || 1
  const zMin = mins[2]
  const zScale = maxs[2] - mins[2] || 1

  // Prepare output columns
  const columns = createColumns(count)
  const fnName = 'webp_decode_rgba'
  const webpData = await Promise.all([
    webpWasmTask.run(fnName, means_l),
    webpWasmTask.run(fnName, means_u),
    webpWasmTask.run(fnName, scales),
    webpWasmTask.run(fnName, colors),
    webpWasmTask.run(fnName, quats),
  ])
  const { xs, ys, zs } = _decodeMeans(webpData[0].rgba, webpData[1].rgba, count)
  const sl = webpData[2].rgba
  const c0 = webpData[3].rgba
  const qr = webpData[4].rgba
  const sCode = new Float32Array(meta.scales.codebook)
  const cCode = new Float32Array(meta.sh0.codebook)

  for (let i = 0; i < count; i++) {
    const lx = xMin + xScale * (xs[i] / 65535)
    const ly = yMin + yScale * (ys[i] / 65535)
    const lz = zMin + zScale * (zs[i] / 65535)
    //positions
    columns['x'][i] = invLogTransform(lx)
    columns['y'][i] = invLogTransform(ly)
    columns['z'][i] = invLogTransform(lz)
    const o = i * 4
    //scales
    columns['scale_0'][i] = sCode[sl[o]]
    columns['scale_1'][i] = sCode[sl[o + 1]]
    columns['scale_2'][i] = sCode[sl[o + 2]]

    //colors
    columns['f_dc_0'][i] = cCode[c0[o + 0]]
    columns['f_dc_1'][i] = cCode[c0[o + 1]]
    columns['f_dc_2'][i] = cCode[c0[o + 2]]
    columns['opacity'][i] = sigmoidInv(c0[o + 3] / 255)

    //quats
    const tag = qr[o + 3]
    if (tag < 252 || tag > 255) {
      columns['rot_0'][i] = 0
      columns['rot_1'][i] = 0
      columns['rot_2'][i] = 0
      columns['rot_3'][i] = 1
      continue
    }
    const [x, y, z, wq] = _unpackQuat(qr[o], qr[o + 1], qr[o + 2], tag)
    columns['rot_0'][i] = x
    columns['rot_1'][i] = y
    columns['rot_2'][i] = z
    columns['rot_3'][i] = wq
  }

  if (meta.shN) {
    const { bands, count: paletteCount } = meta.shN
    const shCoeffs = [0, 3, 8, 15][bands]
    if (shCoeffs > 0) {
      const codebook = new Float32Array(meta.shN.codebook)
      const {
        rgba: centroidsRGBA,
        width: cW,
        height: cH,
      } = await webpWasmTask.run(fnName, centroids)
      const { rgba: labelsRGBA } = await webpWasmTask.run(fnName, labels)
      for (let i = 0; i < shCoeffs * 3; i++) {
        columns[`f_rest_${i}`] = new Float32Array(count)
      }
      const stride = 4
      const getCentroidPixel = (centroidIndex, coeff) => {
        const cx = (centroidIndex % 64) * shCoeffs + coeff
        const cy = Math.floor(centroidIndex / 64)
        if (cx >= cW || cy >= cH) return [0, 0, 0]
        const idx = (cy * cW + cx) * stride
        return [
          centroidsRGBA[idx],
          centroidsRGBA[idx + 1],
          centroidsRGBA[idx + 2],
        ]
      }
      for (let i = 0; i < count; i++) {
        const o = i * 4
        const label = labelsRGBA[o] | (labelsRGBA[o + 1] << 8) // 16-bit palette index
        if (label >= paletteCount) continue // safety
        for (let j = 0; j < shCoeffs; j++) {
          const [lr, lg, lb] = getCentroidPixel(label, j)
          columns[`f_rest_${j + shCoeffs * 0}`][i] = codebook[lr] ?? 0
          columns[`f_rest_${j + shCoeffs * 1}`][i] = codebook[lg] ?? 0
          columns[`f_rest_${j + shCoeffs * 2}`][i] = codebook[lb] ?? 0
        }
      }
    }
  }

  webpWasmTask.dispose()

  return {
    numSplats: count,
    columns,
  }
}

/**
 *
 * @param webpUrl
 * @param meta
 * @param means_l
 * @param means_u
 * @param quats
 * @param scales
 * @param colors
 * @returns {Promise<*>}
 */
export async function parseSogToSplat(
  webpUrl,
  meta,
  means_l,
  means_u,
  quats,
  scales,
  colors,
) {
  const webpWasmTask = new WasmTask(webpUrl)
  await webpWasmTask.init()

  // meta.json
  const count = meta.count

  const { mins, maxs } = meta.means
  const xMin = mins[0]
  const xScale = maxs[0] - mins[0] || 1
  const yMin = mins[1]
  const yScale = maxs[1] - mins[1] || 1
  const zMin = mins[2]
  const zScale = maxs[2] - mins[2] || 1
  // Prepare output columns
  const fnName = 'webp_decode_rgba'
  const webpData = await Promise.all([
    webpWasmTask.run(fnName, means_l),
    webpWasmTask.run(fnName, means_u),
    webpWasmTask.run(fnName, scales),
    webpWasmTask.run(fnName, colors),
    webpWasmTask.run(fnName, quats),
  ])

  const sCode = new Float32Array(meta.scales.codebook)
  const cCode = new Float32Array(meta.sh0.codebook)

  const { xs, ys, zs } = _decodeMeans(webpData[0].rgba, webpData[1].rgba, count)
  const sl = webpData[2].rgba
  const c0 = webpData[3].rgba
  const qr = webpData[4].rgba

  /* ---------- output buffer ---------- */
  const outBuffer = new ArrayBuffer(ROW_LENGTH * count)
  const outF32 = new Float32Array(outBuffer)
  const outU8 = new Uint8ClampedArray(outBuffer)

  for (let i = 0; i < count; i++) {
    const baseF32 = (i * ROW_LENGTH) >> 2
    const baseU8 = i * ROW_LENGTH
    // positions
    const lx = xMin + xScale * (xs[i] / 65535)
    const ly = yMin + yScale * (ys[i] / 65535)
    const lz = zMin + zScale * (zs[i] / 65535)
    outF32[baseF32 + 0] = invLogTransform(lx)
    outF32[baseF32 + 1] = invLogTransform(ly)
    outF32[baseF32 + 2] = invLogTransform(lz)

    const offset = i * 4
    // scales
    outF32[baseF32 + 3] = Math.exp(sCode[sl[offset + 0]])
    outF32[baseF32 + 4] = Math.exp(sCode[sl[offset + 1]])
    outF32[baseF32 + 5] = Math.exp(sCode[sl[offset + 2]])

    //colors
    outU8[baseU8 + 24] = (0.5 + SH_C0 * cCode[c0[offset + 0]]) * 255
    outU8[baseU8 + 25] = (0.5 + SH_C0 * cCode[c0[offset + 1]]) * 255
    outU8[baseU8 + 26] = (0.5 + SH_C0 * cCode[c0[offset + 2]]) * 255
    outU8[baseU8 + 27] = c0[offset + 3]

    //rotations
    const tag = qr[offset + 3]
    let q0 = 0
    let q1 = 0
    let q2 = 0
    let q3 = 1
    if (tag >= 252 && tag <= 255) {
      const [x, y, z, wq] = _unpackQuat(
        qr[offset],
        qr[offset + 1],
        qr[offset + 2],
        tag,
      )
      q0 = x
      q1 = y
      q2 = z
      q3 = wq
    }
    const invLen = 1 / Math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3)
    outU8[baseU8 + 28] = q0 * invLen * 128 + 128
    outU8[baseU8 + 29] = q1 * invLen * 128 + 128
    outU8[baseU8 + 30] = q2 * invLen * 128 + 128
    outU8[baseU8 + 31] = q3 * invLen * 128 + 128
  }
  webpWasmTask.dispose()
  return {
    numSplats: count,
    buffer: outBuffer,
  }
}
