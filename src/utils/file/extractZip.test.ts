import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { strFromU8, strToU8, Zip, ZipPassThrough, zipSync } from "fflate";

import { extractZip } from "./extractZip";

const disk = new Map<string, Uint8Array>();

const memoryFile = (...parts: (string | { uri: string })[]) => {
  const uri = parts.map((p) => (typeof p === "string" ? p : p.uri)).join("/");
  return {
    uri,
    get exists() {
      return disk.has(uri);
    },
    create: () => disk.set(uri, new Uint8Array()),
    delete: () => disk.delete(uri),
    open: () => ({
      offset: 0,
      size: disk.get(uri)!.length,
      async readBytes(length: number) {
        const chunk = disk.get(uri)!.slice(this.offset, this.offset + length);
        this.offset += chunk.length;
        return chunk;
      },
      async writeBytes(bytes: Uint8Array) {
        const prev = disk.get(uri)!;
        const next = new Uint8Array(prev.length + bytes.length);
        next.set(prev);
        next.set(bytes, prev.length);
        disk.set(uri, next);
      },
      close: jest.fn(),
    }),
  };
};

const keepSupported = (name: string) => /\.(mp3|wav|md)$/i.test(name);

// Rewrites a field in every local and central header of the named entry.
const patchEntry = (
  zip: Uint8Array,
  name: string,
  localField: number,
  centralField: number,
  value: number,
) => {
  const view = new DataView(zip.buffer);
  const nameBytes = strToU8(name);
  for (let i = 0; i < zip.length - 4; i++) {
    const sig = view.getUint32(i, true);
    const nameAt =
      sig === 0x04034b50 ? i + 30 : sig === 0x02014b50 ? i + 46 : -1;
    if (
      nameAt < 0 ||
      strFromU8(zip.subarray(nameAt, nameAt + nameBytes.length)) !== name
    ) {
      continue;
    }
    const field = i + (sig === 0x04034b50 ? localField : centralField);
    if (value > 0xffff) view.setUint32(field, value, true);
    else view.setUint16(field, value, true);
  }
  return zip;
};

describe("extractZip", () => {
  beforeEach(() => {
    disk.clear();
    let uuid = 0;
    (Crypto.randomUUID as jest.Mock).mockImplementation(() => `u${++uuid}`);
    (File as unknown as jest.Mock).mockImplementation(memoryFile);
    Object.assign(Paths, { availableDiskSpace: 1e9 });
  });

  it("extracts supported entries and skips everything else", async () => {
    const big = new Uint8Array(200 * 1024).fill(7);
    disk.set(
      "/picked/a.zip",
      zipSync({
        "notes.md": strToU8("# Hi"),
        "deep\\dir/clip.MP3": big,
        "take.wav": [strToU8("RIFF"), { level: 0 }],
        "photo.jpg": strToU8("jpg"),
        "__MACOSX/._clip.MP3": strToU8("fork"),
        ".hidden.md": strToU8("x"),
        "empty/": new Uint8Array(),
      }),
    );

    const { files, skipped } = await extractZip("/picked/a.zip", keepSupported);

    expect(files.map((f) => [f.name, f.uri, f.size])).toEqual([
      ["notes.md", "/mock/cache/import_u1.md", 4],
      ["clip.MP3", "/mock/cache/import_u2.MP3", big.length],
      ["take.wav", "/mock/cache/import_u3.wav", 4],
    ]);
    expect(skipped).toEqual([]);
    expect(strFromU8(disk.get(files[0].uri)!)).toBe("# Hi");
    expect(disk.get(files[1].uri)).toEqual(big);
    expect(strFromU8(disk.get(files[2].uri)!)).toBe("RIFF");
  });

  it("extracts data-descriptor entries whose bytes contain PK signatures", async () => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((_, data) => chunks.push(data));
    const entry = new ZipPassThrough("clip.mp3");
    zip.add(entry);
    const audio = strToU8("ID3PK\x07\x08PK\x01\x02PK\x03\x04tail", true);
    entry.push(audio, true);
    zip.end();
    disk.set("/picked/dd.zip", Uint8Array.from(chunks.flatMap((c) => [...c])));

    const { files } = await extractZip("/picked/dd.zip", keepSupported);

    expect(disk.get(files[0].uri)).toEqual(audio);
  });

  it("skips entries with unsupported compression but keeps the rest", async () => {
    const zip = zipSync({ "a.md": strToU8("a"), "b.wav": strToU8("RIFF") });
    disk.set("/picked/m.zip", patchEntry(zip, "b.wav", 8, 10, 9));

    const { files, skipped } = await extractZip("/picked/m.zip", keepSupported);

    expect(files.map((f) => f.name)).toEqual(["a.md"]);
    expect(skipped).toEqual(["b.wav"]);
  });

  it.each([
    [
      "is truncated",
      () => {
        const noise = Uint8Array.from(
          { length: 1e5 },
          () => Math.random() * 256,
        );
        const zip = zipSync({ "a.md": strToU8("a"), "b.wav": noise });
        return zip.slice(0, zip.length / 2);
      },
    ],
    [
      "understates an entry's size",
      () =>
        patchEntry(
          zipSync({ "a.md": strToU8("a"), "b.md": strToU8("long text") }),
          "b.md",
          22,
          24,
          2,
        ),
    ],
  ])(
    "throws and deletes partial output when the archive %s",
    async (_, make) => {
      disk.set("/picked/t.zip", make());

      await expect(
        extractZip("/picked/t.zip", keepSupported),
      ).rejects.toThrow();
      expect([...disk.keys()]).toEqual(["/picked/t.zip"]);
    },
  );

  it("throws before writing when entries exceed free disk space", async () => {
    disk.set("/picked/s.zip", zipSync({ "a.md": strToU8("abcdef") }));
    Object.assign(Paths, { availableDiskSpace: 5 });

    await expect(extractZip("/picked/s.zip", keepSupported)).rejects.toThrow(
      "disk space",
    );
    expect([...disk.keys()]).toEqual(["/picked/s.zip"]);
  });
});
