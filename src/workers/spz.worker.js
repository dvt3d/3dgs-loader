import { parseSpzToColumns, parseSpzToSplat } from '../parsers/SpzParser'
import { transferColumns } from './transfer'

onmessage = async (message) => {
  const data = message.data
  let result = null
  let transfer = []
  try {
    if (data.type === 'parseColumns') {
      result = await parseSpzToColumns(data.payload)
      if (result && result.columns) {
        transfer = transferColumns(result.columns)
      }
    } else if (data.type === 'parseAsSplat') {
      result = await parseSpzToSplat(data.payload)
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
