class WorkerPool {
  constructor(options) {
    if (!options?.url) {
      throw new Error('WorkerPool requires a url.')
    }
    this.url = options.url
    this.wasmUrl = options.wasmUrl
    this.workerLimit = options.workerLimit ?? 4
    this.queueLimit = options.queueLimit ?? 1024
    this.workers = []
    this.idleWorkers = []
    this.taskQueue = []
    this.pending = new Map()
    this._taskId = 0
    this._readyCount = 0
    this._allReady = !this.wasmUrl

    for (let i = 0; i < this.workerLimit; i++) {
      const worker = new Worker(this.url, { type: 'module' })
      worker.__id = i
      worker.__busy = false
      worker.__ready = !this.wasmUrl
      worker.onmessage = (e) => {
        const { id, result, __init } = e.data
        if (__init) {
          worker.__ready = true
          this._readyCount++
          if (this._readyCount === this.workerLimit) {
            this._allReady = true
            this._schedule()
          }
          return
        }
        const record = this.pending.get(id)
        if (!record) return
        this.pending.delete(id)
        worker.__busy = false
        this.idleWorkers.push(worker)
        if (result) record.resolve(result)
        else record.reject(new Error('do failed'))
        this._schedule()
      }
      worker.onerror = (err) => {
        console.error('[WorkerPool] worker error', err)
        worker.__busy = false
        this.idleWorkers.push(worker)
      }
      this.workers.push(worker)
      if (worker.__ready) {
        this.idleWorkers.push(worker)
      }
      if (this.wasmUrl) {
        worker.postMessage({
          type: '__init__',
          wasmUrl: this.wasmUrl,
        })
      }
    }
  }

  /**
   * @private
   */
  _schedule() {
    if (!this._allReady) return
    if (this.idleWorkers.length === 0) return
    if (this.taskQueue.length === 0) return
    const worker = this.idleWorkers.pop()
    const task = this.taskQueue.shift()
    worker.__busy = true
    worker.postMessage(
      {
        id: task.id,
        type: task.type,
        payload: task.payload,
      },
      task.transfer || [],
    )
  }

  /**
   *
   * @param type
   * @param payload
   * @param transfer
   * @returns {Promise<never>|Promise<unknown>}
   */
  run({ type, payload, transfer }) {
    if (this.taskQueue.length >= this.queueLimit) {
      return Promise.reject(new Error('[WorkerPool] task queue overflow'))
    }
    const id = ++this._taskId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.taskQueue.push({
        id,
        type,
        payload,
        transfer,
      })
      this._schedule()
    })
  }

  /**
   *
   */
  dispose() {
    for (const w of this.workers) {
      w.terminate()
    }
    this.workers.length = 0
    this.idleWorkers.length = 0
    this.taskQueue.length = 0
    this.pending.clear()
  }
}

export default WorkerPool
