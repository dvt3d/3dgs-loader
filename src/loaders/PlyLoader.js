import WorkerPool from '../WorkerPool'
import { parsePlyToColumns, parsePlyToSplat } from '../parsers/ply-parser'

class PlyLoader {
  constructor(options = {}) {
    this._baseUrl = options.baseURL || ''
    this._workerLimit = options.workerLimit || 0
    this._workerPool = null
    if (this._workerLimit > 0) {
      this._workerPool = new WorkerPool({
        url: new URL('workers/ply-worker.min.js', this._baseUrl).href,
        workerLimit: this._workerLimit,
      })
    }
  }

  /**
   *
   * @param path
   */
  async loadColumns(path) {
    const res = await fetch(path)
    if (!res.ok) {
      throw new Error(`Failed to fetch ${path}`)
    }
    return await this.parseColumns(new Uint8Array(await res.arrayBuffer()))
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
  async loadAsSplat(path) {
    const res = await fetch(path)
    if (!res.ok) {
      throw new Error(`Failed to fetch ${path}`)
    }
    return await this.parseAsSplat(new Uint8Array(await res.arrayBuffer()))
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
