import * as Crypto from "expo-crypto";
import { File, type FileHandle, FileMode, Paths } from "expo-file-system";
import { Inflate, strFromU8 } from "fflate";

// Bounds one inflate burst to ~16 MB: deflate expands at most ~1032x.
const CHUNK_BYTES = 16 * 1024;
const EOCD_BYTES = 22;
const MAX_COMMENT_BYTES = 0xffff;

export interface ExtractedFile {
  uri: string;
  name: string;
  size: number;
}

interface Entry {
  path: string;
  name: string;
  flags: number;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) =>
  (u16(b, i) | (u16(b, i + 2) << 16)) >>> 0;

const readAt = (handle: FileHandle, offset: number, length: number) => {
  handle.offset = offset;
  return handle.readBytes(length);
};

// Sizes come from the central directory: streaming local headers misreads
// data-descriptor entries (Finder, ditto) whose bytes contain a PK signature.
const readEntries = async (handle: FileHandle): Promise<Entry[]> => {
  const size = handle.size ?? 0;
  const tailStart = Math.max(0, size - EOCD_BYTES - MAX_COMMENT_BYTES);
  const tail = await readAt(handle, tailStart, size - tailStart);
  let eocd = tail.length - EOCD_BYTES;
  while (eocd >= 0 && u32(tail, eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("invalid zip data");

  const cd = await readAt(handle, u32(tail, eocd + 16), u32(tail, eocd + 12));
  const entries: Entry[] = [];
  for (let i = 0, p = 0; i < u16(tail, eocd + 10); i++) {
    if (u32(cd, p) !== 0x02014b50) throw new Error("invalid zip data");
    const nameEnd = p + 46 + u16(cd, p + 28);
    // ditto writes UTF-8 names without the UTF-8 flag, so always decode UTF-8.
    const path = strFromU8(cd.subarray(p + 46, nameEnd));
    const entry = {
      path,
      name: path.split(/[\\/]/).pop() ?? "",
      flags: u16(cd, p + 8),
      method: u16(cd, p + 10),
      compressedSize: u32(cd, p + 20),
      size: u32(cd, p + 24),
      offset: u32(cd, p + 42),
    };
    // ponytail: no Zip64, archives or entries over 4 GB fail as a whole.
    if ([entry.compressedSize, entry.size, entry.offset].includes(0xffffffff)) {
      throw new Error("Zip64 is unsupported");
    }
    entries.push(entry);
    p = nameEnd + u16(cd, p + 30) + u16(cd, p + 32);
  }
  return entries;
};

const copyEntry = async (source: FileHandle, entry: Entry, out: File) => {
  const header = await readAt(source, entry.offset, 30);
  if (u32(header, 0) !== 0x04034b50) throw new Error("invalid zip data");
  source.offset = entry.offset + 30 + u16(header, 26) + u16(header, 28);

  const target = out.open(FileMode.WriteOnly);
  try {
    const chunks: Uint8Array[] = [];
    const inflate =
      entry.method === 8 ? new Inflate((data) => chunks.push(data)) : null;
    let left = entry.compressedSize;
    let written = 0;
    do {
      const chunk = await source.readBytes(Math.min(left, CHUNK_BYTES));
      if (chunk.length === 0 && left > 0) throw new Error("unexpected EOF");
      left -= chunk.length;
      if (inflate) inflate.push(chunk, left === 0);
      else chunks.push(chunk);
      for (const data of chunks.splice(0)) {
        written += data.length;
        if (written > entry.size) throw new Error("invalid zip data");
        await target.writeBytes(data);
      }
    } while (left > 0);
    if (written !== entry.size) throw new Error("invalid zip data");
  } finally {
    target.close();
  }
};

/**
 * Writes every entry of the archive at `zipUri` that `keep` accepts to its own
 * `import_*` cache file (swept on launch). Folders are flattened to the base
 * name; macOS `__MACOSX/` and dotfiles (`._` resource forks) are ignored.
 * Encrypted entries and compression other than stored/deflate land in
 * `skipped`. Throws on a malformed archive or when it can't fit on disk.
 */
export const extractZip = async (
  zipUri: string,
  keep: (name: string) => boolean,
): Promise<{ files: ExtractedFile[]; skipped: string[] }> => {
  const files: ExtractedFile[] = [];
  const skipped: string[] = [];
  const source = new File(zipUri).open(FileMode.ReadOnly);
  try {
    const entries = (await readEntries(source)).filter(
      (e) =>
        !e.path.startsWith("__MACOSX/") &&
        !e.name.startsWith(".") &&
        e.name.includes(".") &&
        keep(e.name),
    );
    if (
      entries.reduce((sum, e) => sum + e.size, 0) > Paths.availableDiskSpace
    ) {
      throw new Error("Not enough disk space to extract zip");
    }
    for (const entry of entries) {
      if (entry.flags & 1 || (entry.method !== 0 && entry.method !== 8)) {
        skipped.push(entry.name);
        continue;
      }
      const out = new File(
        Paths.cache,
        `import_${Crypto.randomUUID()}.${entry.name.split(".").pop()}`,
      );
      files.push({ uri: out.uri, name: entry.name, size: entry.size });
      out.create();
      await copyEntry(source, entry, out);
    }
  } catch (error) {
    for (const file of files) {
      const out = new File(file.uri);
      if (out.exists) out.delete();
    }
    throw error;
  } finally {
    source.close();
  }
  return { files, skipped };
};
