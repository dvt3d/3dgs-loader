/**
 *
 * @param obj
 * @returns {*[]}
 */
export function transferObject(obj) {
  const transfer = []
  for (const key in obj) {
    const data = obj[key]
    if (data instanceof ArrayBuffer) {
      transfer.push(data)
    } else if (ArrayBuffer.isView(data)) {
      transfer.push(data.buffer)
    }
  }
  return transfer
}
