import {
  parsePlyToAttributes,
  parsePlyToColumns,
  parsePlyToSplat,
} from '../parsers/PlyParser'
import { transferObject } from './transfer'

onmessage = (message) => {
  const data = message.data
  let result = null
  let transfer = []
  try {
    if (data.type === 'parseColumns') {
      result = parsePlyToColumns(data.payload)
      if (result && result.columns) {
        transfer = transferObject(result.columns)
      }
    } else if (data.type === 'parseAsAttributes') {
      result = parsePlyToAttributes(data.payload)
      if (result) {
        transfer = transferObject(result)
      }
    } else if (data.type === 'parseAsSplat') {
      result = parsePlyToSplat(data.payload)
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
