import { parseSplatToColumns } from '../parsers/SplatParser'
import { transferColumns } from './transfer'

onmessage = (message) => {
  const data = message.data
  let result = null
  let transfer = []
  try {
    if (data.type === 'parseColumns') {
      result = parseSplatToColumns(data.payload)
      if (result && result.columns) {
        transfer = transferColumns(result.columns)
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
    postMessage({
      id: data.id,
      result: null,
    })
  }
}
