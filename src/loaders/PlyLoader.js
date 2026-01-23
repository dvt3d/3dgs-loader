import {
  parsePlyToColumns,
  parsePlyToSplat,
  parsePlyToAttributes,
} from '../parsers/PlyParser'
import Loader from './Loader'

class PlyLoader extends Loader {
  constructor(options = {}) {
    super({
      ...options,
      workerName: 'ply.worker.min.js',
    })
    this._parseToColumnsFn = parsePlyToColumns
    this._parseToSplatFn = parsePlyToSplat
    this._parseToAttributesFn = parsePlyToAttributes
  }
}

export default PlyLoader
