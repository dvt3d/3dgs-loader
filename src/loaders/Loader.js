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
   * @returns {Promise<Awaited<Loader>>}
   */
  parseColumns(data) {
    return Promise.resolve(this)
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
