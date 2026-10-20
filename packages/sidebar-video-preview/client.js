window.__ModuleLoader__.load({
  id: '@dsh-plugins/sidebar-video-preview',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Renderer identity shared by the preview definition and the keyed document body. */
    const VIDEO_BODY_ID = '@dsh-plugins/sidebar-video-preview/video';

    /** Range-read window kept below the Session file reader's byte-window cap. */
    const CHUNK_BYTES = 1024 * 1024;

    /** Browser-playable video suffixes and the media type each Blob receives. */
    const VIDEO_MEDIA_TYPES = {
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      webm: 'video/webm',
      ogv: 'video/ogg',
      mov: 'video/quicktime',
    };

    /** Every suffix this renderer claims; all of them hold bytes that are not text. */
    const VIDEO_EXTENSIONS = Object.keys(VIDEO_MEDIA_TYPES);

    /** Centered player surface that fills the preview body. */
    const frameStyle = {
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      minHeight: '100%',
      padding: 12,
      background: 'var(--dsw-alias-bg-base)',
    };

    /** The native player keeps its aspect ratio inside the pane. */
    const videoStyle = {
      display: 'block',
      width: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
      borderRadius: 'var(--dsw-radius-md)',
      background: '#000',
      outline: 'none',
    };

    /** Shared loading/failed state, matching the document preview's status lines. */
    const statusStyle = {
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: '100%',
      margin: 0,
      padding: 10,
      color: 'var(--dsw-alias-label-secondary)',
      fontFamily: 'var(--dsw-font, sans-serif)',
      fontSize: 13,
      lineHeight: 1.5,
      textAlign: 'center',
      whiteSpace: 'normal',
    };

    /**
     * Read the decoded filename from a `dsh-resource://file/...` address.
     * @param address - complete file resource address.
     * @returns the last path segment, decoded when possible.
     */
    function fileNameOf(address) {
      const end = address.search(/[?#]/);
      const path = end === -1 ? address : address.slice(0, end);
      const segment = path.slice(path.lastIndexOf('/') + 1);
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    }

    /**
     * Resolve the media type assigned to the previewed file's Blob.
     * @param address - complete file resource address.
     * @returns the video media type, or undefined for an unclaimed suffix.
     */
    function mediaTypeOf(address) {
      const name = fileNameOf(address).toLowerCase();
      return VIDEO_MEDIA_TYPES[name.slice(name.lastIndexOf('.') + 1)];
    }

    /**
     * Decode the Session and path a session-scoped file address names.
     * @param address - complete file resource address.
     * @returns the reader arguments, or undefined for another address scope.
     */
    function sessionFileOf(address) {
      const prefix = 'dsh-resource://file/session/';
      if (!address.startsWith(prefix)) return undefined;
      const end = address.search(/[?#]/);
      const body = address.slice(prefix.length, end === -1 ? undefined : end);
      const cut = body.indexOf('/');
      if (cut <= 0) return undefined;
      try {
        return {
          sessionId: decodeURIComponent(body.slice(0, cut)),
          path: body
            .slice(cut + 1)
            .split('/')
            .map(decodeURIComponent)
            .join('/'),
        };
      } catch {
        return undefined;
      }
    }

    /**
     * Summarize a failure for the preview's one-line error state.
     * @param error - thrown reader error or media error.
     * @returns a short code-and-message description.
     */
    function describeError(error) {
      if (error === undefined || error === null) return 'unknown error';
      const code = typeof error.code === 'string' ? error.code : '';
      const message = typeof error.message === 'string' ? error.message : String(error);
      return [code, message].filter(Boolean).join(': ').slice(0, 200);
    }

    /**
     * Read a file in bounded windows. Range windows are independent of the
     * complete-file cap, so a large video no longer fails before playback.
     * @param readRange - Session file-reader callback.
     * @param file - Session and path decoded from the tab address.
     * @param bytes - known file size, or undefined to read until a short window.
     * @param signal - cancels the read.
     * @param onProgress - receives bytes read and the known total.
     * @returns the chunks in file order.
     */
    async function readWholeFile(readRange, file, bytes, signal, onProgress) {
      if (signal.aborted) throw new DOMException('The video read was aborted', 'AbortError');
      const chunks = [];
      let offset = 0;
      for (;;) {
        const length = bytes === undefined ? CHUNK_BYTES : Math.min(CHUNK_BYTES, bytes - offset);
        if (length <= 0) break;
        const result = await readRange(file.sessionId, file.path, { offset, length }, signal);
        if (signal.aborted) throw new DOMException('The video read was aborted', 'AbortError');
        const data = result instanceof Uint8Array ? result : result?.data;
        if (!(data instanceof Uint8Array)) throw new Error('the file reader returned no bytes');
        if (data.byteLength === 0) break;
        chunks.push(data);
        offset += data.byteLength;
        if (onProgress !== undefined) onProgress(offset, bytes);
        if (result instanceof Uint8Array ? false : result.eof === true) break;
        if (bytes !== undefined && offset >= bytes) break;
        if (data.byteLength < length) break;
      }
      return chunks;
    }

    /**
     * Present a video through the browser's native player, loading the bytes in
     * range windows so files above the complete-read cap still play.
     * @param props - renderer request, resource identity, range reader, and locale.
     * @returns a player sized inside the preview pane.
     */
    function VideoBody(props) {
      const { content, resourceAddress, readRange, t, useResource } = props;
      const { tab } = props.useTabInfo();
      const resource = useResource(resourceAddress);
      const meta = resource !== undefined ? resource.value : undefined;
      const failure = resource !== undefined ? resource.failure : undefined;
      const request = content !== undefined && content.kind === 'renderer' ? content : undefined;
      const revision = request !== undefined ? request.revision : undefined;
      const mediaType = mediaTypeOf(resourceAddress);
      const [state, setState] = React.useState({
        revision: undefined,
        url: null,
        failed: false,
        progress: 0,
        detail: null,
      });

      React.useEffect(() => {
        if (request === undefined || mediaType === undefined || meta === undefined) return undefined;
        const file = sessionFileOf(resourceAddress);
        if (file === undefined) {
          request.failed();
          setState({
            revision,
            url: null,
            failed: 'read',
            progress: 0,
            detail: 'unsupported file address',
          });
          return undefined;
        }

        const controller = new AbortController();
        const abort = () => controller.abort();
        if (tab.signal.aborted) controller.abort();
        else tab.signal.addEventListener('abort', abort, { once: true });

        let url;
        let cancelled = false;
        setState({ revision, url: null, failed: false, progress: 0, detail: null });

        (async () => {
          try {
            const chunks = await readWholeFile(
              readRange,
              file,
              meta.bytes,
              controller.signal,
              (read, total) => {
                if (!cancelled) {
                  setState({
                    revision,
                    url: null,
                    failed: false,
                    progress: total === undefined || total === 0 ? 0 : read / total,
                    detail: null,
                  });
                }
              },
            );
            if (cancelled || controller.signal.aborted) return;
            const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
            if (total === 0) throw new Error('the file is empty');
            if (meta.bytes !== undefined && total !== meta.bytes) {
              throw new Error(`read ${total} of ${meta.bytes} bytes`);
            }
            url = URL.createObjectURL(new Blob(chunks, { type: mediaType }));
            setState({ revision, url, failed: false, progress: 1, detail: null });
            request.loaded(meta.version);
          } catch (error) {
            if (cancelled || controller.signal.aborted) return;
            console.error('[sidebar-video-preview] could not read the video', error);
            setState({
              revision,
              url: null,
              failed: 'read',
              progress: 0,
              detail: describeError(error),
            });
            request.failed();
          }
        })();

        return () => {
          cancelled = true;
          tab.signal.removeEventListener('abort', abort);
          controller.abort();
          if (url !== undefined) URL.revokeObjectURL(url);
        };
      }, [revision, resourceAddress, mediaType, meta?.bytes, meta?.version, readRange, tab.signal]);

      React.useEffect(() => {
        if (request !== undefined && failure !== undefined) {
          console.error('[sidebar-video-preview] file metadata failed', failure);
          request.failed();
          setState({
            revision,
            url: null,
            failed: 'read',
            progress: 0,
            detail: describeError(failure),
          });
        }
      }, [failure, revision]);

      if (request === undefined || mediaType === undefined) {
        return h('p', { style: statusStyle, role: 'alert' }, t('unsupported'));
      }

      const current = state.revision === revision;
      if (current && state.failed) {
        return h(
          'p',
          { style: statusStyle, role: 'alert' },
          t(state.failed === 'playback' ? 'playbackFailed' : 'readFailed', {
            detail: state.detail ?? 'unknown error',
          }),
        );
      }
      if (!current || state.url === null) {
        const percent = current && state.progress > 0 ? Math.round(state.progress * 100) : undefined;
        return h(
          'p',
          { style: statusStyle, role: 'status' },
          percent === undefined ? t('loading') : t('preparing', { percent }),
        );
      }

      const name = fileNameOf(resourceAddress);
      return h(
        'div',
        { style: frameStyle },
        h('video', {
          key: state.url,
          src: state.url,
          style: videoStyle,
          controls: true,
          playsInline: true,
          preload: 'metadata',
          'aria-label': t('videoLabel', { name }),
          onError: (event) => {
            const mediaError = event.currentTarget.error;
            console.error('[sidebar-video-preview] media element error', mediaError);
            URL.revokeObjectURL(state.url);
            setState({
              revision,
              url: null,
              failed: 'playback',
              progress: 0,
              detail: mediaError
                ? [mediaError.code, mediaError.message].filter(Boolean).join(': ')
                : 'unknown media error',
            });
            request.failed();
          },
        }),
      );
    }

    return {
      inject: ['slots', 'locale', 'documentPreviews', 'remote', 'remote.workspaceFiles'],
      apply(ctx) {
        const t = ctx.locale.bind('sidebarVideoPreview');
        const readRange = (sessionId, path, range, signal) =>
          ctx.remote.workspaceFiles.readBytes(sessionId, path, { range }, signal);

        ctx.effect(
          () =>
            ctx.locale.register('sidebarVideoPreview', {
              en: {
                title: 'Video',
                loading: 'Loading video...',
                preparing: 'Loading video... {percent}%',
                unsupported: 'This video address cannot be read.',
                readFailed: 'Could not read this video: {detail}',
                playbackFailed: 'Firefox could not play this video: {detail}',
                failed: 'This video could not be played.',
                videoLabel: 'Video preview: {name}',
              },
              zh: {
                title: '视频',
                loading: '正在加载视频...',
                preparing: '正在加载视频... {percent}%',
                unsupported: '无法读取此视频地址',
                readFailed: '无法读取此视频：{detail}',
                playbackFailed: 'Firefox 无法播放此视频：{detail}',
                failed: '无法播放此视频',
                videoLabel: '视频预览：{name}',
              },
            }),
          'video-preview: dictionaries',
        );

        ctx.effect(
          () =>
            ctx.documentPreviews.register({
              id: VIDEO_BODY_ID,
              extensions: VIDEO_EXTENSIONS,
              binaryExtensions: VIDEO_EXTENSIONS,
              title: () => t('title'),
              loading: 'renderer',
              wrap: false,
            }),
          'video-preview: metadata',
        );

        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.right.tab.document', () =>
              ctx.slots.register(
                {
                  name: 'sidebar.right.tab.document',
                  key: VIDEO_BODY_ID,
                  locale: 'sidebarVideoPreview',
                  inject: () => ({ readRange }),
                },
                VideoBody,
              ),
            ),
          'video-preview: body',
        );
      },
    };
  },
});
