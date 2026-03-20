import { useCanvasStore } from "../canvas-store";

describe("canvas-store", () => {
  beforeEach(() => {
    // Reset store between tests
    useCanvasStore.setState({
      isOpen: false,
      contentType: null,
      contentData: null,
      sourceBlockId: null,
    });
  });

  it("starts with isOpen=false and contentType=null", () => {
    const state = useCanvasStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.contentType).toBeNull();
    expect(state.contentData).toBeNull();
    expect(state.sourceBlockId).toBeNull();
  });

  it("open() sets all fields correctly", () => {
    const data = { nodes: [], edges: [] };
    useCanvasStore.getState().open("lineage", data, "block-123");

    const state = useCanvasStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.contentType).toBe("lineage");
    expect(state.contentData).toEqual(data);
    expect(state.sourceBlockId).toBe("block-123");
  });

  it("close() clears all fields", () => {
    useCanvasStore.getState().open("table", { rows: [] }, "block-456");
    useCanvasStore.getState().close();

    const state = useCanvasStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.contentType).toBeNull();
    expect(state.contentData).toBeNull();
    expect(state.sourceBlockId).toBeNull();
  });

  it("opening with different content replaces previous", () => {
    useCanvasStore.getState().open("lineage", { nodes: [] }, "block-1");
    useCanvasStore.getState().open("code", { code: "SELECT 1", language: "sql" }, "block-2");

    const state = useCanvasStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.contentType).toBe("code");
    expect(state.contentData).toEqual({ code: "SELECT 1", language: "sql" });
    expect(state.sourceBlockId).toBe("block-2");
  });
});
