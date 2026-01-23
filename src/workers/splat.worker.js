import {
  parseSplatToAttributes,
  parseSplatToColumns,
} from '../parsers/SplatParser'
import { transferObject } from './transfer'

onmessage = (message) => {
  const data = message.data
  let result = null
  let transfer = []
  try {
    if (data.type === 'parseColumns') {
      result = parseSplatToColumns(data.payload)
      if (result && result.columns) {
        transfer = transferObject(result.columns)
      }
    } else if (data.type === 'parseAsAttributes') {
      result = parseSplatToAttributes(data.payload)
      if (result) {
        transfer = transferObject(result)
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
