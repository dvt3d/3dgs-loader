import WorkerPool from '../WorkerPool'
import { requestData } from '../Util'

class Loader {
  constructor(options = {}) {
    this._baseUrl = new URL(options.baseUrl || './', import.meta.url)
    this._workerLimit = options.workerLimit || 0
    this._workerPool = null
    this._workerName = options.workerName
    if (this._workerLimit > 0) {
      this._workerPool = new WorkerPool({
        url: new URL(`workers/${this._workerName}`, this._baseUrl).href,
        workerLimit: this._workerLimit,
      })
    }
  }

  /**
   *
   * @param path
   * @param options
   * @returns {Promise<void>}
   */
  async loadColumns(path, options = {}) {
    const { onProgress } = options
    const data = await requestData(path, onProgress)
    return this.parseColumns(data)
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async parseColumns(data) {}
}

export default Loader
