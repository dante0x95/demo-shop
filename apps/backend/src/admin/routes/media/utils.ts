const UNITS = ["B", "KB", "MB", "GB"]

export const formatFileSize = (bytes: number) => {
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }

  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`
}
