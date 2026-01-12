import PlyLoader from './loaders/PlyLoader'
import SogLoader from './loaders/SogLoader'
import SplatLoader from './loaders/SplatLoader'
import SpzLoader from './loaders/SpzLoader'

export { PlyLoader, SogLoader, SplatLoader, SpzLoader }

/**
 *
 */
if (typeof window !== 'undefined') {
  window.PlyLoader = PlyLoader
  window.SogLoader = SogLoader
  window.SplatLoader = SplatLoader
  window.SpzLoader = SpzLoader
}
