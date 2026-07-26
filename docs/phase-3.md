# Phase 3 — Whiteboard module

Whiteboards are scoped to workspaces and persisted through the repository/service/API layers.

- Owners, admins, and editors can create, rename, save, and delete boards; all workspace members can view them.
- Board JSON stores objects, background, and zoom and is ready for the later version-history module.
- The browser board provides pencil, rectangle, circle, arrow, text, eraser, selection/delete, undo/redo, and zoom.
- Saves are debounced and load automatically when a board opens.

The browser implementation uses an SVG canvas with JSON-native object data rather than Fabric.js. This meets the documented allowance for a chosen canvas engine while keeping the saved document format portable.
