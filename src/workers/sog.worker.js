import { transferColumns } from './transfer'
import { parseSogToColumns, parseSogToSplat } from '../parsers/SogParser'

onmessage = async (message) => {
  const data = message.data
  let result = null
  let transfer = []
  try {
    const {
      webpUrl,
      meta,
      means_l,
      means_u,
      quats,
      scales,
      colors,
      centroids,
      labels,
    } = data.payload
    if (data.type === 'parseColumns') {
      result = await parseSogToColumns(
        webpUrl,
        meta,
        means_l,
        means_u,
        quats,
        scales,
        colors,
        centroids,
        labels,
      )
      if (result && result.columns) {
        transfer = transferColumns(result.columns)
      }
    } else if (data.type === 'parseAsSplat') {
      result = await parseSogToSplat(
        webpUrl,
        meta,
        means_l,
        means_u,
        quats,
        scales,
        colors,
      )
      if (result && result.buffer) {
        transfer = [result.buffer]
      }
    }
    postMessage(
      {
        id: data.id,
        result: result,
      },
      transfer,
    )
  } catch (e) {
    console.error(e)
    postMessage({
      id: data.id,
      result: null,
    })
  }
}
