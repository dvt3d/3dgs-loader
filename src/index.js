import PlyLoader from './loaders/PlyLoader'
import SplatLoader from './loaders/SplatLoader'

export { PlyLoader, SplatLoader }

if (typeof window !== 'undefined') {
  window.PlyLoader = PlyLoader
  window.SplatLoader = SplatLoader
}
