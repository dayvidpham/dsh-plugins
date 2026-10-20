# Sidebar Video Preview

Package: `@dsh-plugins/sidebar-video-preview`

A DeepSeek Harness bundle that plays video files in the right Sidebar's document preview.

## What it does

The Sidebar document preview currently reports `mp4`, `webm`, `mov`, and similar files as unviewable binaries. This bundle registers a `bytes-complete` document renderer for:

| Suffix | Media type |
|---|---|
| `.mp4`, `.m4v` | `video/mp4` |
| `.webm` | `video/webm` |
| `.ogv` | `video/ogg` |
| `.mov` | `video/quicktime` |

Open a video from the Sidebar's **Files** tab (or any file link) and it opens a tab with the browser's native video player: play/pause, seek, volume, fullscreen, and picture-in-picture. Files the browser cannot decode show a localized error instead of a broken surface.

## Limits

- The preview reads the complete file through the existing file reader, so it is bounded by the Host's `maxFileBytes` (32 MiB by default). Larger files show the reader's existing "too large" guidance.
- Only formats the browser can decode natively play. `.avi`, `.mkv`, `.wmv`, and `.flv` are intentionally left to the unsupported-preview state.
- The preview is read-only and does not transcode.

## Composition

- Host half: `index.js` (`apply` is empty; the bundle exists to carry the Client rendering).
- Client half: `client.js` registers the renderer metadata with `ctx.documentPreviews` and the body in the keyed `sidebar.right.tab.document` slot.
- The bundle patch inserts one Loader entry, `sidebar-video-preview`.
