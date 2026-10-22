function tiffOrientation(bytes, start, end) {
  if (start + 8 > end) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = bytes[start] === 73 && bytes[start + 1] === 73;
  if (!little && !(bytes[start] === 77 && bytes[start + 1] === 77)) return 1;
  if (view.getUint16(start + 2, little) !== 42) return 1;
  const directory = start + view.getUint32(start + 4, little);
  if (directory < start + 8 || directory + 2 > end) return 1;
  const count = view.getUint16(directory, little);
  if (count > 4096 || directory + 2 + count * 12 > end) return 1;
  for (let index = 0; index < count; index++) {
    const entry = directory + 2 + index * 12;
    if (view.getUint16(entry, little) !== 274) continue;
    if (view.getUint16(entry + 2, little) !== 3 || view.getUint32(entry + 4, little) !== 1) return 1;
    const value = view.getUint16(entry + 8, little);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return 1;
}

export function readImageOrientation(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] !== 255 || bytes[1] !== 216) return 1;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) return 1;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 218 || marker === 217) return 1;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (offset + 2 > bytes.length) return 1;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return 1;
    if (marker === 225 && length >= 8 && bytes.subarray(offset + 2, offset + 8).every((value, index) => value === [69, 120, 105, 102, 0, 0][index])) {
      return tiffOrientation(bytes, offset + 8, offset + length);
    }
    offset += length;
  }
  return 1;
}

export function orientImage(image, orientation) {
  if (!Number.isInteger(orientation) || orientation <= 1 || orientation > 8) return image;
  const swapped = orientation >= 5;
  const width = swapped ? image.height : image.width;
  const height = swapped ? image.width : image.height;
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < image.height; row++) for (let column = 0; column < image.width; column++) {
    let targetColumn = column, targetRow = row;
    if (orientation === 2) targetColumn = image.width - 1 - column;
    if (orientation === 3) { targetColumn = image.width - 1 - column; targetRow = image.height - 1 - row; }
    if (orientation === 4) targetRow = image.height - 1 - row;
    if (orientation === 5) { targetColumn = row; targetRow = column; }
    if (orientation === 6) { targetColumn = image.height - 1 - row; targetRow = column; }
    if (orientation === 7) { targetColumn = image.height - 1 - row; targetRow = image.width - 1 - column; }
    if (orientation === 8) { targetColumn = row; targetRow = image.width - 1 - column; }
    const source = (row * image.width + column) * 4;
    data.set(image.data.subarray(source, source + 4), (targetRow * width + targetColumn) * 4);
  }
  return {width, height, data};
}
