import PlyLoader from './loaders/PlyLoader'
import SplatLoader from './loaders/SplatLoader'
import SpzLoader from './loaders/SpzLoader'

export { PlyLoader, SplatLoader, SpzLoader }

if (typeof window !== 'undefined') {
  window.PlyLoader = PlyLoader
  window.SplatLoader = SplatLoader
  window.SpzLoader = SpzLoader
}
