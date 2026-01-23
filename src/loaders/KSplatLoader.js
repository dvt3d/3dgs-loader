import Loader from './Loader'
import {
  parseKSplatToAttributes,
  parseKSplatToColumns,
  parseKSplatToSplat,
} from '../parsers/KSplatParser'

class KSplatLoader extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'k-splat.worker.min.js',
    })
    this._parseToColumnsFn = parseKSplatToColumns
    this._parseToSplatFn = parseKSplatToSplat
    this._parseToAttributesFn = parseKSplatToAttributes
  }
}

export default KSplatLoader
