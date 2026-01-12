import loader from './Loader'
import { requestData, requestJson, stripUrlParams } from '../Util'
import { unzipSync } from 'fflate/browser'
import { parseSogToColumns, parseSogToSplat } from '../parsers/SogParser'

class SogLoader extends loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'sog.worker.min.js',
    })
    this._wepbName = 'webp/wasm_webp.min.js'
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<{meta: *, sogData: Awaited<*>[]}>}
   * @private
   */
  async _loadData(url, options = {}) {
    const { onProgress, needShN } = options
    const needUnzip = stripUrlParams(url).endsWith('.sog')
    let meta = {}
    let sogData = null
    if (needUnzip) {
      const data = await requestData(url, onProgress)
      const files = unzipSync(data)
      const metaBytes = files['meta.json']
      const metaStr = new TextDecoder().decode(metaBytes)
      meta = JSON.parse(metaStr)
      sogData = [
        files[meta.means.files[0]],
        files[meta.means.files[1]],
        files[meta.quats.files[0]],
        files[meta.scales.files[0]],
        files[meta.sh0.files[0]],
      ]
      if (meta.shN && needShN) {
        sogData.push(meta.shN.files[0])
        sogData.push(meta.shN.files[1])
      }
    } else {
      const resolveUrlWithQuery = (metaUrl, url) => {
        const base = new URL(metaUrl, location.href)
        const u = new URL(url, base)
        u.search = base.search
        return u.href
      }
      meta = await requestJson(url)
      const promises = [
        requestData(resolveUrlWithQuery(url, meta.means.files[0])),
        requestData(resolveUrlWithQuery(url, meta.means.files[1]), onProgress),
        requestData(resolveUrlWithQuery(url, meta.quats.files[0])),
        requestData(resolveUrlWithQuery(url, meta.scales.files[0])),
        requestData(resolveUrlWithQuery(url, meta.sh0.files[0])),
      ]
      if (meta.shN && needShN) {
        promises.push(requestData(resolveUrlWithQuery(url, meta.shN.files[0])))
        promises.push(requestData(resolveUrlWithQuery(url, meta.shN.files[1])))
      }
      sogData = await Promise.all(promises)
    }

    return {
      meta,
      sogData,
    }
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<void>}
   */
  async loadColumns(url, options = {}) {
    const { onProgress } = options
    const data = await this._loadData(url, {
      onProgress,
      needShN: true,
    })
    return this.parseColumns(data)
  }

  /**
   *
   * @param data
   * @returns {Promise<{numSplats: *, columns: {x: Float32Array<ArrayBuffer>, y: Float32Array<ArrayBuffer>, z: Float32Array<ArrayBuffer>, scale_0: Float32Array<ArrayBuffer>, scale_1: Float32Array<ArrayBuffer>, scale_2: Float32Array<ArrayBuffer>, f_dc_0: Float32Array<ArrayBuffer>, f_dc_1: Float32Array<ArrayBuffer>, f_dc_2: Float32Array<ArrayBuffer>, opacity: Float32Array<ArrayBuffer>, rot_0: Float32Array<ArrayBuffer>, rot_1: Float32Array<ArrayBuffer>, rot_2: Float32Array<ArrayBuffer>, rot_3: Float32Array<ArrayBuffer>}}>|Promise<never>|Promise<*>|Promise<*>|*}
   */
  parseColumns(data) {
    const webpUrl = new URL(`${this._wepbName}`, this._wasmBaseUrl).href
    const means_l = data.sogData[0]
    const means_u = data.sogData[1]
    const quats = data.sogData[2]
    const scales = data.sogData[3]
    const colors = data.sogData[4]
    const centroids = data.sogData[5] || new Uint8Array(0)
    const labels = data.sogData[6] || new Uint8Array(0)
    if (this._workerLimit > 0) {
      return this._workerPool.run({
        type: 'parseColumns',
        payload: {
          webpUrl,
          meta: data.meta,
          means_l,
          means_u,
          quats,
          scales,
          colors,
          centroids,
          labels,
        },
        transfer: [
          means_l.buffer,
          means_u.buffer,
          quats.buffer,
          scales.buffer,
          colors.buffer,
          centroids.buffer,
          labels.buffer,
        ],
      })
    }
    return parseSogToColumns(
      webpUrl,
      meta,
      means_l,
      means_u,
      quats,
      scales,
      colors,
      centroids,
      labels,
    )
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<*>}
   */
  async loadAsSplat(url, options = {}) {
    const { onProgress } = options
    const data = await this._loadData(url, {
      onProgress,
      needShN: false,
    })
    return await this.parseAsSplat(data)
  }

  /**
   *
   * @param data
   * @returns {Promise<*>}
   */
  parseAsSplat(data) {
    const webpUrl = new URL(`${this._wepbName}`, this._wasmBaseUrl).href
    const means_l = data.sogData[0]
    const means_u = data.sogData[1]
    const quats = data.sogData[2]
    const scales = data.sogData[3]
    const colors = data.sogData[4]
    if (this._workerLimit > 0) {
      return this._workerPool.run({
        type: 'parseAsSplat',
        payload: {
          webpUrl,
          meta: data.meta,
          means_l,
          means_u,
          quats,
          scales,
          colors,
        },
        transfer: [
          means_l.buffer,
          means_u.buffer,
          quats.buffer,
          scales.buffer,
          colors.buffer,
        ],
      })
    }
    return parseSogToSplat(
      webpUrl,
      data.meta,
      means_l,
      means_u,
      quats,
      scales,
      colors,
    )
  }
}

export default SogLoader
