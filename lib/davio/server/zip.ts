const table = Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes: Buffer) {
  let n = 0xffffffff;
  for (const v of bytes) n = table[(n ^ v) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
}
/** Small bounded ZIP, stored entries, UTF-8 filenames. No filesystem paths from users. */
export function zip(files: { name: string; bytes: Buffer }[]) {
  const chunks: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name),
      sum = crc(f.bytes),
      head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x800, 6);
    head.writeUInt32LE(sum, 14);
    head.writeUInt32LE(f.bytes.length, 18);
    head.writeUInt32LE(f.bytes.length, 22);
    head.writeUInt16LE(name.length, 26);
    chunks.push(head, name, f.bytes);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x800, 8);
    c.writeUInt32LE(sum, 16);
    c.writeUInt32LE(f.bytes.length, 20);
    c.writeUInt32LE(f.bytes.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += head.length + name.length + f.bytes.length;
  }
  const body = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(body.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, body, end]);
}
