import { act } from "react";
import { create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePendingUploads } from "./use-pending-uploads";

function setupHook(ticketId?: string) {
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true, configurable: true });
  let controller: ReturnType<typeof usePendingUploads> | undefined;
  function Harness() {
    controller = usePendingUploads(ticketId);
    return null;
  }
  let root: ReturnType<typeof create>;
  act(() => { root = create(<Harness />); });
  return {
    get: () => {
      if (!controller) throw new Error("Hook did not render");
      return controller;
    },
    unmount: () => act(() => root.unmount()),
  };
}

class TestFileList implements FileList {
  [index: number]: File;
  readonly length: number;
  constructor(files: readonly File[]) {
    this.length = files.length;
    for (const [index, file] of files.entries()) this[index] = file;
  }
  item(index: number): File | null { return this[index] ?? null; }
  [Symbol.iterator](): ArrayIterator<File> {
    return Array.from({ length: this.length }, (_, index) => this[index]).values();
  }
}

function fileList(files: readonly File[]): FileList { return new TestFileList(files); }
function uploadFile(name: string, type = "image/png"): File { return new File(["abc"], name, { type }); }

afterEach(() => vi.restoreAllMocks());

describe("usePendingUploads", () => {
  it("uploads a file with streaming headers and stores preview metadata", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ uploadId: "up_1", r2Key: "support/key", filename: "shot.png", contentType: "image/png", sizeBytes: 3 }), { status: 200 }));
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:shot"), revokeObjectURL: vi.fn() });
    const hook = setupHook("ticket_1");
    await act(async () => hook.get().add(fileList([uploadFile("shot.png")] )));
    expect(fetchMock).toHaveBeenCalledWith("/support/upload", expect.objectContaining({ method: "POST", headers: { "Content-Type": "image/png", "X-Support-Filename": "shot.png", "X-Support-Ticket": "ticket_1" } }));
    expect(hook.get().files[0]).toMatchObject({ uploadId: "up_1", kind: "image", previewUrl: "blob:shot" });
    expect(hook.get().busy).toBe(false);
  });

  it("maps malformed successful JSON to upload_failed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const hook = setupHook();
    await act(async () => hook.get().add(fileList([uploadFile("shot.png")] )));
    expect(hook.get().error).toBe("upload_failed");
    expect(hook.get().files).toHaveLength(0);
  });

  it("maps rejected uploads to the server error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "too_large" }), { status: 413 }));
    const hook = setupHook();
    await act(async () => hook.get().add(fileList([uploadFile("shot.png")] )));
    expect(hook.get().error).toBe("too_large");
  });

  it("rejects invalid files before fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const hook = setupHook();
    await act(async () => hook.get().add(fileList([uploadFile("script.exe", "application/x-msdownload")] )));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hook.get().error).toBe("unsupported_type");
  });

  it("keeps at most ten uploads", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const name = new Headers(init?.headers).get("X-Support-Filename") ?? "file.png";
      return new Response(JSON.stringify({ uploadId: name, r2Key: name, filename: name, contentType: "image/png", sizeBytes: 3 }), { status: 200 });
    });
    vi.stubGlobal("URL", { createObjectURL: vi.fn((file: File) => `blob:${file.name}`), revokeObjectURL: vi.fn() });
    const hook = setupHook();
    await act(async () => hook.get().add(fileList(Array.from({ length: 11 }, (_, index) => uploadFile(`file-${index}.png`)))));
    expect(hook.get().files).toHaveLength(10);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(10);
  });

  it("revokes object URLs when removing and resetting uploads", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ uploadId: "up_1", r2Key: "key", filename: "shot.png", contentType: "image/png", sizeBytes: 3 }), { status: 200 }));
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:shot"), revokeObjectURL: revoke });
    const first = setupHook();
    await act(async () => first.get().add(fileList([uploadFile("shot.png")] )));
    act(() => first.get().remove("up_1"));
    expect(revoke).toHaveBeenCalledWith("blob:shot");
    first.unmount();
    const second = setupHook();
    await act(async () => second.get().add(fileList([uploadFile("shot.png")] )));
    act(() => second.get().reset());
    expect(revoke).toHaveBeenCalledTimes(2);
    second.unmount();
  });
});
