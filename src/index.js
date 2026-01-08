import PlyLoader from './loaders/PlyLoader'

export { PlyLoader }

if (typeof window !== 'undefined') {
  window.PlyLoader = PlyLoader
}
