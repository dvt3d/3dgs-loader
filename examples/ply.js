import { PlyLoader } from '3dgs-loader'
const plyLoader = new PlyLoader()
const data = await plyLoader.loadColumns('http://localhost:8080/ggy.ply')
const data1 = await plyLoader.loadAsSplat('http://localhost:8080/ggy.ply')
