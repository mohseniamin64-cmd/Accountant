export function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    md: 'markdown',
    markdown: 'markdown',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    svg: 'xml',
    env: 'plaintext',
    txt: 'plaintext',
  };

  return languageMap[ext] || 'plaintext';
}

export function isBinaryExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const binaryExts = [
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg',
    'pdf', 'zip', 'tar', 'gz', '7z', 'rar',
    'mp3', 'wav', 'ogg', 'mp4', 'webm',
    'woff', 'woff2', 'ttf', 'eot', 'otf',
    'exe', 'dll', 'so', 'dylib', 'pyc', 'class'
  ];
  return binaryExts.includes(ext);
}

export function isImageExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg'].includes(ext);
}
