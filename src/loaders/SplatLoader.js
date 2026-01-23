import { requestData } from '../Util'
import Loader from './Loader'
import {
  parseSplatToAttributes,
  parseSplatToColumns,
} from '../parsers/SplatParser'

const ROW_LENGTH = 3 * 4 + 3 * 4 + 4 + 4

class SplatLoader extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'splat.worker.min.js',
    })
    this._parseToColumnsFn = parseSplatToColumns
    this._parseToAttributesFn = parseSplatToAttributes
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<void>}
   */
  async loadAsSplat(url, options = {}) {
    throw new Error('[SplatLoader] loadAsSplat() is not implemented.')
  }

  /**
   *
   * @param data
   */
  parseAsSplat(data) {
    throw new Error('[SplatLoader] parseAsSplat() is not implemented.')
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<*>}
   */
  async load(url, options = {}) {
    const { onProgress } = options
    const data = await requestData(url, onProgress)
    const numSplats = data.length / ROW_LENGTH
    return {
      numSplats,
      buffer: data.buffer,
    }
  }
}

export default SplatLoader
