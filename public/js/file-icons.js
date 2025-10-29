/* BeamShare shared file icon resolver */
(function createFileIconResolver() {
    const DEFAULT_RULE = {
        variant: 'generic',
        icon: 'fa-file-lines',
        label: 'Tệp BeamShare'
    };

    const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'svgz', 'ico', 'tif', 'tiff', 'heic', 'heif', 'raw', 'arw', 'cr2', 'nef', 'raf', 'dng']);
    const VIDEO_EXTENSIONS = new Set(['mp4', 'm4v', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'mpeg', 'mpg', '3gp']);
    const AUDIO_EXTENSIONS = new Set(['mp3', 'aac', 'wav', 'm4a', 'flac', 'ogg', 'oga', 'opus', 'aiff', 'mid', 'midi']);
    const PDF_EXTENSIONS = new Set(['pdf']);
    const WORD_EXTENSIONS = new Set(['doc', 'docx', 'dot', 'dotx', 'odt', 'rtf', 'pages']);
    const SHEET_EXTENSIONS = new Set(['xls', 'xlsx', 'xlsm', 'xlsb', 'ods', 'csv', 'tsv', 'numbers']);
    const SLIDES_EXTENSIONS = new Set(['ppt', 'pptx', 'pptm', 'pps', 'key', 'odp']);
    const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'rst', 'nfo', 'ini', 'cfg', 'log']);
    const CODE_EXTENSIONS = new Set(['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'xml', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'c', 'cpp', 'h', 'hpp', 'java', 'kt', 'go', 'rs', 'py', 'rb', 'php', 'swift', 'sql', 'pl', 'lua', 'cs', 'dart', 'vb', 'fs', 'scala', 'sh', 'bash', 'zsh', 'ps1', 'cmd', 'bat', 'yml', 'yaml']);
    const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'tbz', 'xz', 'cab', 'iso']);
    const DATABASE_EXTENSIONS = new Set(['sql', 'db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'dbf', 'bak']);
    const DESIGN_EXTENSIONS = new Set(['psd', 'ai', 'xd', 'fig', 'sketch', 'cdr', 'indd', 'eps']);
    const FONT_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2', 'eot', 'fon', 'fnt']);
    const THREE_D_EXTENSIONS = new Set(['obj', 'fbx', 'gltf', 'glb', 'stl', '3ds', 'step', 'iges', 'dwg', 'dxf', 'blend']);
    const EXECUTABLE_EXTENSIONS = new Set(['exe', 'msi', 'app', 'apk', 'ipa', 'jar', 'sh', 'bash', 'zsh', 'ps1', 'cmd', 'bat', 'bin', 'run', 'dmg']);
    const EBOOK_EXTENSIONS = new Set(['epub', 'mobi', 'azw', 'azw3', 'ibooks']);

    const RULES = [
        { variant: 'image', icon: 'fa-image', label: 'Hình ảnh', match: (ctx) => ctx.flags.isImage },
        { variant: 'video', icon: 'fa-clapperboard', label: 'Video', match: (ctx) => ctx.flags.isVideo },
        { variant: 'audio', icon: 'fa-music', label: 'Âm thanh', match: (ctx) => ctx.flags.isAudio },
        { variant: 'pdf', icon: 'fa-file-pdf', label: 'Tài liệu PDF', match: (ctx) => hasExtension(ctx, PDF_EXTENSIONS) || ctx.mime === 'application/pdf' },
        { variant: 'word', icon: 'fa-file-word', label: 'Văn bản Word', match: (ctx) => hasExtension(ctx, WORD_EXTENSIONS) },
    { variant: 'sheet', icon: 'fa-file-excel', label: 'Bảng tính', match: (ctx) => hasExtension(ctx, SHEET_EXTENSIONS) || ctx.flags.isSheet },
        { variant: 'slides', icon: 'fa-file-powerpoint', label: 'Trình chiếu', match: (ctx) => hasExtension(ctx, SLIDES_EXTENSIONS) },
        { variant: 'database', icon: 'fa-database', label: 'Cơ sở dữ liệu', match: (ctx) => hasExtension(ctx, DATABASE_EXTENSIONS) },
        { variant: 'design', icon: 'fa-pen-ruler', label: 'Thiết kế', match: (ctx) => hasExtension(ctx, DESIGN_EXTENSIONS) },
        { variant: 'font', icon: 'fa-font', label: 'Phông chữ', match: (ctx) => hasExtension(ctx, FONT_EXTENSIONS) },
        { variant: 'three-d', icon: 'fa-cube', label: 'Mô hình 3D', match: (ctx) => hasExtension(ctx, THREE_D_EXTENSIONS) },
        { variant: 'executable', icon: 'fa-microchip', label: 'Tệp thực thi', match: (ctx) => hasExtension(ctx, EXECUTABLE_EXTENSIONS) },
        { variant: 'ebook', icon: 'fa-book-open', label: 'Sách điện tử', match: (ctx) => hasExtension(ctx, EBOOK_EXTENSIONS) },
    { variant: 'archive', icon: 'fa-box-archive', label: 'Lưu trữ', match: (ctx) => hasExtension(ctx, ARCHIVE_EXTENSIONS) },
    { variant: 'code', icon: 'fa-code', label: 'Mã nguồn', match: (ctx) => hasExtension(ctx, CODE_EXTENSIONS) || ctx.flags.isCode },
    { variant: 'text', icon: 'fa-file-lines', label: 'Văn bản thuần', match: (ctx) => hasExtension(ctx, TEXT_EXTENSIONS) }
    ];

    function normaliseExtension(value) {
        if (!value) {
            return '';
        }
        const trimmed = String(value).trim();
        if (!trimmed) {
            return '';
        }
        const withoutDot = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
        return withoutDot.toLowerCase();
    }

    function extractExtensionFromName(name) {
        if (!name) {
            return '';
        }
        const cleaned = String(name).trim();
        const lastDot = cleaned.lastIndexOf('.');
        if (lastDot <= 0 || lastDot === cleaned.length - 1) {
            return '';
        }
        return cleaned.slice(lastDot + 1);
    }

    function hasExtension(ctx, set) {
        return Boolean(ctx.extension) && set.has(ctx.extension);
    }

    function decorate(rule) {
        const variant = rule.variant || DEFAULT_RULE.variant;
        const icon = rule.icon || DEFAULT_RULE.icon;
        return {
            icon,
            variant,
            tone: `file-icon-tone--${variant}`,
            label: rule.label || DEFAULT_RULE.label
        };
    }

    function buildContext(input) {
        const file = input || {};
        const nameCandidate = typeof file === 'string'
            ? file
            : file.name || file.originalName || file.displayName || file.filename || '';

        const extensionCandidate = typeof file === 'string'
            ? extractExtensionFromName(file)
            : file.extension || file.ext || extractExtensionFromName(file.originalName || file.displayName || file.name || nameCandidate);

        const extension = normaliseExtension(extensionCandidate);
        const mime = (file.mime || file.mimeType || file.type || '').toLowerCase();

        const flags = {
            isImage: Boolean(file.isImage),
            isVideo: Boolean(file.isVideo),
            isAudio: Boolean(file.isAudio),
            isDocument: Boolean(file.isDocument),
            isSheet: Boolean(file.isSheet),
            isCode: Boolean(file.isCode)
        };

        if (!flags.isImage && extension && IMAGE_EXTENSIONS.has(extension)) {
            flags.isImage = true;
        }
        if (!flags.isVideo && extension && VIDEO_EXTENSIONS.has(extension)) {
            flags.isVideo = true;
        }
        if (!flags.isAudio && extension && AUDIO_EXTENSIONS.has(extension)) {
            flags.isAudio = true;
        }
        if (!flags.isSheet && extension && SHEET_EXTENSIONS.has(extension)) {
            flags.isSheet = true;
        }
        if (!flags.isCode && extension && CODE_EXTENSIONS.has(extension)) {
            flags.isCode = true;
        }

        if (!flags.isImage && mime.startsWith('image/')) {
            flags.isImage = true;
        }
        if (!flags.isVideo && mime.startsWith('video/')) {
            flags.isVideo = true;
        }
        if (!flags.isAudio && mime.startsWith('audio/')) {
            flags.isAudio = true;
        }

        return {
            file,
            name: nameCandidate,
            extension,
            mime,
            flags
        };
    }

    function resolve(input, options = {}) {
        let seed;
        if (typeof input === 'string') {
            seed = { name: input };
        } else {
            seed = { ...(input || {}) };
        }

        if (options && typeof options === 'object') {
            Object.assign(seed, options);
        }

        const context = buildContext(seed);

        for (let index = 0; index < RULES.length; index += 1) {
            const rule = RULES[index];
            try {
                if (rule.match(context)) {
                    return decorate(rule);
                }
            } catch (_error) {
                // Ignore faulty rule matches and continue to the next rule.
            }
        }
        return decorate(DEFAULT_RULE);
    }

    function resolveFromExtension(extension, options = {}) {
        return resolve({ extension }, options);
    }

    window.FileIcons = {
        resolve,
        resolveFromExtension
    };
})();
