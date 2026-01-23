import {
  parseSpzToAttributes,
  parseSpzToColumns,
  parseSpzToSplat,
} from '../parsers/SpzParser'
import Loader from './Loader'

class SpzLoader extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'spz.worker.min.js',
    })
    this._parseToColumnsFn = parseSpzToColumns
    this._parseToSplatFn = parseSpzToSplat
    this._parseToAttributesFn = parseSpzToAttributes
  }
}

export default SpzLoader
