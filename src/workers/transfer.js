export function transferColumns(columns) {
  const transfer = []
  for (const key in columns) {
    const data = columns[key]
    if (data instanceof ArrayBuffer) {
      transfer.push(data)
    } else if (ArrayBuffer.isView(data)) {
      transfer.push(data.buffer)
    }
  }
  return transfer
}
