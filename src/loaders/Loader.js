import WorkerPool from '../WorkerPool'
import { requestData } from '../Util'

class Loader {
  constructor(options = {}) {
    this._workerLimit = options.workerLimit || 0
    this._workerBaseUrl = new URL(
      options.workerBaseUrl || './',
      import.meta.url,
    )
    this._workerName = options.workerName
    this._workerPool = null
    this._wasmBaseUrl = new URL(options.wasmBaseUrl || './', import.meta.url)
    if (this._workerLimit > 0) {
      this._workerPool = new WorkerPool({
        url: new URL(`workers/${this._workerName}`, this._workerBaseUrl).href,
        workerLimit: this._workerLimit,
      })
    }
    this._parseToColumnsFn = undefined
    this._parseToSplatFn = undefined
    this._parseToAttributesFn = undefined
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<Awaited<Loader>>}
   */
  async loadColumns(url, options = {}) {
    const { onProgress } = options
    const data = await requestData(url, onProgress)
    return this.parseColumns(data)
  }

  /**
   *
   * @param data
   * @returns {Promise<*>}
   */
  parseColumns(data) {
    if (this._workerLimit > 0) {
      return this._workerPool.run({
        type: 'parseColumns',
        payload: data,
        transfer: [data.buffer],
      })
    }
    if (!this._parseToColumnsFn) {
      return null
    }
    return Promise.resolve(this._parseToColumnsFn(data))
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<*>}
   */
  async loadAsSplat(url, options = {}) {
    const { onProgress } = options
    const data = await requestData(url, onProgress)
    return this.parseAsSplat(data)
  }

  /**
   *
   * @param data
   * @returns {Promise<*>}
   */
  parseAsSplat(data) {
    if (this._workerLimit > 0) {
      return this._workerPool.run({
        type: 'parseAsSplat',
        payload: data,
        transfer: [data.buffer],
      })
    }
    if (!this._parseToSplatFn) {
      return null
    }
    return Promise.resolve(this._parseToSplatFn(data))
  }

  /**
   *
   * @param url
   * @param options
   * @returns {Promise<*>}
   */
  async loadAsAttributes(url, options = {}) {
    const { onProgress } = options
    const data = await requestData(url, onProgress)
    return this.parseAsAttributes(data)
  }

  /**
   *
   * @param data
   * @returns {Promise<*>}
   */
  parseAsAttributes(data) {
    if (this._workerLimit > 0) {
      return this._workerPool.run({
        type: 'parseAsAttributes',
        payload: data,
        transfer: [data.buffer],
      })
    }
    if (!this._parseToAttributesFn) {
      return null
    }
    return Promise.resolve(this._parseToAttributesFn(data))
  }

  /**
   *
   */
  dispose() {
    if (this._workerPool) {
      this._workerPool.dispose()
      this._workerPool = null
    }
  }
}

export default Loader
