// Peekaboo CLI surface — minimal type model.
//
// Mirrors the JSON shape emitted by the `peekaboo` macOS CLI
// (https://github.com/openclaw/Peekaboo) without taking a runtime
// dependency. kbot stays binary-agnostic; this adapter only ever
// speaks JSON across the process boundary.
//
// Schema is calibrated to peekaboo 3.0.0-beta4: every command wraps
// its payload in `{ success, data, error? }`, element ids look like
// `elem_19` / `elem_169`, and elements expose AX role/label/help
// fields rather than frame rectangles or named-actions arrays.
export {};
//# sourceMappingURL=types.js.map