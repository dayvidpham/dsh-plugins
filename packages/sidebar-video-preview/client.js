window.__ModuleLoader__.load({
  id: '@dsh-plugins/sidebar-video-preview',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Renderer identity shared by the preview definition and the keyed document body. */
    const VIDEO_BODY_ID = '@dsh-plugins/sidebar-video-preview/video';

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

    /** Shared empty/failed state, matching the document preview's status lines. */
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
     * Hold one live Blob URL for the current bytes, revoking it on replacement or unmount.
     * @param data - complete file bytes supplied by the document owner.
     * @param mediaType - media type for the Blob.
     * @returns the URL entry built from exactly these bytes, or null while none exists.
     */
    function useVideoUrl(data, mediaType) {
      const [entry, setEntry] = React.useState(null);
      React.useEffect(() => {
        if (data === undefined || mediaType === undefined) {
          setEntry(null);
          return undefined;
        }
        let url;
        try {
          url = URL.createObjectURL(new Blob([data], { type: mediaType }));
        } catch {
          setEntry({ data, mediaType, url: null });
          return undefined;
        }
        setEntry({ data, mediaType, url });
        return () => URL.revokeObjectURL(url);
      }, [data, mediaType]);
      return entry;
    }

    /**
     * Present complete video bytes with the browser's native controls.
     * @param props - document bytes, resource identity, and locale.
     * @returns a player sized inside the preview pane.
     */
    function VideoBody(props) {
      const { content, resourceAddress, t } = props;
      const data = content !== undefined && content.kind === 'bytes' ? content.data : undefined;
      const mediaType = mediaTypeOf(resourceAddress);
      const entry = useVideoUrl(data, mediaType);
      const [failedUrl, setFailedUrl] = React.useState(null);

      if (data === undefined || mediaType === undefined) {
        return h('p', { style: statusStyle, role: 'alert' }, t('unsupported'));
      }
      if (entry === null || entry.data !== data || entry.mediaType !== mediaType) {
        return h('p', { style: statusStyle }, t('loading'));
      }
      if (entry.url === null || failedUrl === entry.url) {
        return h('p', { style: statusStyle, role: 'alert' }, t('failed'));
      }

      const name = fileNameOf(resourceAddress);
      return h(
        'div',
        { style: frameStyle },
        h('video', {
          key: entry.url,
          src: entry.url,
          style: videoStyle,
          controls: true,
          playsInline: true,
          preload: 'metadata',
          'aria-label': t('videoLabel', { name }),
          onError: () => setFailedUrl(entry.url),
        }),
      );
    }

    return {
      inject: ['slots', 'locale', 'documentPreviews'],
      apply(ctx) {
        const t = ctx.locale.bind('sidebarVideoPreview');

        ctx.effect(
          () =>
            ctx.locale.register('sidebarVideoPreview', {
              en: {
                title: 'Video',
                loading: 'Rendering document...',
                unsupported: 'Video preview requires the complete file contents.',
                failed: 'This video could not be played.',
                videoLabel: 'Video preview: {name}',
              },
              zh: {
                title: '视频',
                loading: '文档渲染中...',
                unsupported: '视频预览需要完整文件内容',
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
              loading: 'bytes-complete',
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
