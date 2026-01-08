import WorkerPool from '../WorkerPool'
import { parsePlyToColumns, parsePlyToSplat } from '../parsers/PlyParser'
import { requestBuffer } from '../Request'

class PlyLoader {
  constructor(options = {}) {
    this._baseUrl = new URL(options.baseUrl || './', import.meta.url)
    this._workerLimit = options.workerLimit || 0
    this._workerPool = null
    if (this._workerLimit > 0) {
      this._workerPool = new WorkerPool({
        url: new URL('workers/ply.worker.min.js', this._baseUrl).href,
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
    const buffer = await requestBuffer(path, onProgress)
    return this.parseColumns(buffer)
  }

  /**
   *
   * @param data
   * @returns {Promise<void>}
   */
  async parseColumns(data) {
    if (this._workerLimit > 0) {
      return await this._workerPool.run({
        type: 'parseColumns',
        payload: data,
        transfer: [data.buffer],
      })
    }
    return Promise.resolve(parsePlyToColumns(data))
  }

  /**
   *
   * @param path
   * @returns {Promise<void>}
   */
  async loadAsSplat(path, options = {}) {
    const { onProgress } = options
    const buffer = await requestBuffer(path, onProgress)
    return await this.parseAsSplat(buffer)
  }

  /**
   *
   * @param data
   * @returns {Promise<*>}
   */
  async parseAsSplat(data) {
    if (this._workerLimit > 0) {
      return await this._workerPool.run({
        type: 'parseAsSplat',
        payload: data,
        transfer: [data.buffer],
      })
    }
    return Promise.resolve(parsePlyToSplat(data))
  }
}

export default PlyLoader
