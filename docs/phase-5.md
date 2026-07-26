# Phase 5 — Collaboration features

- Version snapshots are created from whiteboard JSON, SHA-256 hashed, deduplicated, listed, and restorable.
- Board comments support object attachment, replies through `parent_comment_id`, resolution, deletion, and owner notifications.
- Notifications can be listed, marked read, and deleted.
- Authenticated exports are available as JSON, SVG, PNG, and PDF. The frontend downloads them through the configured API client so the Bearer token is included.

MongoDB indexes are initialized for versions, comments, and notification access patterns.
