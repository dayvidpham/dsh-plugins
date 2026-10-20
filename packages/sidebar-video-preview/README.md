# Sidebar Video Preview

Package: `@dsh-plugins/sidebar-video-preview`

A DeepSeek Harness bundle that plays video files in the right Sidebar's document preview.

## What it does

The Sidebar document preview currently reports `mp4`, `webm`, `mov`, and similar files as unviewable binaries. This bundle registers a `renderer` document preview for:

| Suffix | Media type |
|---|---|
| `.mp4`, `.m4v` | `video/mp4` |
| `.webm` | `video/webm` |
| `.ogv` | `video/ogg` |
| `.mov` | `video/quicktime` |

Open a video from the Sidebar's **Files** tab (or any file link) and it opens a tab with the browser's native video player: play/pause, seek, volume, fullscreen, and picture-in-picture. Files the browser cannot decode show a localized error instead of a broken surface.

The Files tab lists the Session workspace. A video outside it (for example under `~/.local/share/sfurs`) still opens through a file link that carries its absolute path; reads use the Session filesystem's read authority, which allows file reads outside the workspace.

## Limits

- The preview loads the file in 1 MiB range windows through the Session file reader, so the Host's complete-file `maxFileBytes` cap does not apply. The assembled file is held in browser memory, so browser memory is the practical limit.
- The player uses the browser's native `<video>` decoder; Firefox plays H.264 MP4 natively.
- Only formats the browser can decode natively play. `.avi`, `.mkv`, `.wmv`, and `.flv` are intentionally left to the unsupported-preview state.
- The preview is read-only and does not transcode.

## Composition

- Host half: `index.js` (`apply` is empty; the bundle exists to carry the Client rendering).
- Client half: `client.js` registers the renderer metadata with `ctx.documentPreviews` and the body in the keyed `sidebar.right.tab.document` slot.
- The bundle patch inserts one Loader entry, `sidebar-video-preview`.
