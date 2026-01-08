class WorkerPool {
  constructor(options) {
    if (options.url) {
      throw new Error('workerPool requires a url.')
    }
    this.url = options.url
    this.workerLimit = options.workerLimit ?? 4
    this.queueLimit = options.queueLimit ?? 1024
    this.workers = []
    this.idleWorkers = []
    this.taskQueue = []
    this.pending = new Map()

    this._taskId = 0

    for (let i = 0; i < this.workerLimit; i++) {
      const worker = new Worker(this.url, { type: 'module' })
      worker.__id = i
      worker.__busy = false
      worker.onmessage = (e) => {
        const { id, ok, result, error } = e.data
        const record = this.pending.get(id)
        if (!record) return
        this.pending.delete(id)
        worker.__busy = false
        this.idleWorkers.push(worker)
        if (ok) record.resolve(result)
        else record.reject(new Error(error))
        this._schedule()
      }
      worker.onerror = (err) => {
        console.error('[WorkerPool] worker error', err)
        worker.__busy = false
        this.idleWorkers.push(worker)
      }
      this.workers.push(worker)
      this.idleWorkers.push(worker)
    }
  }

  /**
   *
   * @private
   */
  _schedule() {
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
  destroy() {
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
