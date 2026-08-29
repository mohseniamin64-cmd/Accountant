import JSZip from 'jszip';
import { FileItem, FileTreeNode } from '../types';
import { getLanguageFromExtension, isBinaryExtension } from './languageHelper';

export async function extractZipFile(file: File): Promise<{
  filesMap: Record<string, FileItem>;
  tree: FileTreeNode[];
  projectName: string;
}> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const filesMap: Record<string, FileItem> = {};
  const pathsSet = new Set<string>();

  const entries = Object.keys(loadedZip.files);

  for (const relativePath of entries) {
    const zipEntry = loadedZip.files[relativePath];

    if (zipEntry.dir) {
      // It's a directory entry
      const cleanPath = relativePath.replace(/\/$/, '');
      pathsSet.add(cleanPath);
      filesMap[cleanPath] = {
        path: cleanPath,
        name: cleanPath.split('/').pop() || cleanPath,
        isFolder: true,
      };
    } else {
      // It's a file
      const cleanPath = relativePath;
      pathsSet.add(cleanPath);

      // Add all parent folders to pathsSet
      const parts = cleanPath.split('/');
      let currentParent = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentParent = currentParent ? `${currentParent}/${parts[i]}` : parts[i];
        pathsSet.add(currentParent);
        if (!filesMap[currentParent]) {
          filesMap[currentParent] = {
            path: currentParent,
            name: parts[i],
            isFolder: true,
          };
        }
      }

      const isBinary = isBinaryExtension(cleanPath);
      let content = '';
      let binaryData = '';

      if (isBinary) {
        const blob = await zipEntry.async('blob');
        binaryData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } else {
        content = await zipEntry.async('string');
      }

      const name = cleanPath.split('/').pop() || cleanPath;
      const language = getLanguageFromExtension(name);

      filesMap[cleanPath] = {
        path: cleanPath,
        name,
        isFolder: false,
        content,
        binaryData,
        isBinary,
        language,
        size: content ? content.length : (binaryData ? binaryData.length : 0),
      };
    }
  }

  const tree = buildFileTree(filesMap);
  const projectName = file.name.replace(/\.zip$/i, '') || 'MyProject';

  return { filesMap, tree, projectName };
}

export function buildFileTree(filesMap: Record<string, FileItem>): FileTreeNode[] {
  const rootNodes: Record<string, FileTreeNode> = {};

  // First pass: create nodes
  const allPaths = Object.keys(filesMap).sort();

  for (const path of allPaths) {
    const item = filesMap[path];
    const parts = path.split('/');
    const name = parts[parts.length - 1];

    if (!name) continue;

    rootNodes[path] = {
      name,
      path,
      isFolder: item.isFolder,
      item: item.isFolder ? undefined : item,
      children: item.isFolder ? [] : undefined,
    };
  }

  // Second pass: attach children to parents
  const tree: FileTreeNode[] = [];

  for (const path of allPaths) {
    const node = rootNodes[path];
    const parts = path.split('/');

    if (parts.length === 1) {
      tree.push(node);
    } else {
      const parentPath = parts.slice(0, parts.length - 1).join('/');
      const parentNode = rootNodes[parentPath];
      if (parentNode && parentNode.children) {
        parentNode.children.push(node);
      } else {
        // Fallback to root if parent missing
        tree.push(node);
      }
    }
  }

  // Sort folders first, then files alphabetically
  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => {
      if (n.children) sortNodes(n.children);
    });
  };

  sortNodes(tree);
  return tree;
}

export async function exportZipArchive(
  filesMap: Record<string, FileItem>,
  zipName: string = 'project'
): Promise<void> {
  const zip = new JSZip();

  for (const path in filesMap) {
    const item = filesMap[path];
    if (item.isFolder) {
      zip.folder(path);
    } else {
      if (item.isBinary && item.binaryData) {
        // Remove data URL prefix e.g. "data:image/png;base64,"
        const base64Content = item.binaryData.split(',')[1] || item.binaryData;
        zip.file(path, base64Content, { base64: true });
      } else {
        zip.file(path, item.content || '');
      }
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);

  const a = document.createElement('a');
  a.href = url;
  a.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function createSampleProjectFiles(): Record<string, FileItem> {
  const sampleMap: Record<string, FileItem> = {
    'src': { path: 'src', name: 'src', isFolder: true },
    'src/index.html': {
      path: 'src/index.html',
      name: 'index.html',
      isFolder: false,
      language: 'html',
      content: `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>نمونه پروژه وب</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <h1>🚀 خوش آمدید به Web IDE & Zip Explorer</h1>
    <p>این یک پروژه نمونه است که از فایل زیپ استخراج شده است.</p>
    <div class="counter-box">
      <span id="count">0</span>
      <button id="btn-increase">افزایش شمارنده</button>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
    },
    'src/style.css': {
      path: 'src/style.css',
      name: 'style.css',
      isFolder: false,
      language: 'css',
      content: `body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
}

.card {
  background: #1e293b;
  padding: 2.5rem;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  text-align: center;
  border: 1px solid #334155;
  max-width: 450px;
}

h1 {
  font-size: 1.5rem;
  color: #38bdf8;
  margin-bottom: 1rem;
}

p {
  color: #94a3b8;
  line-height: 1.6;
}

.counter-box {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

#count {
  font-size: 3rem;
  font-weight: bold;
  color: #4ade80;
}

button {
  background: #0284c7;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  background: #0369a1;
  transform: translateY(-2px);
}`,
    },
    'src/script.js': {
      path: 'src/script.js',
      name: 'script.js',
      isFolder: false,
      language: 'javascript',
      content: `let count = 0;
const countEl = document.getElementById('count');
const btn = document.getElementById('btn-increase');

btn.addEventListener('click', () => {
  count++;
  countEl.textContent = count;
  console.log('Current count:', count);
});`,
    },
    'README.md': {
      path: 'README.md',
      name: 'README.md',
      isFolder: false,
      language: 'markdown',
      content: `# 📦 پروژه نمونه زیپ (Sample Web App)

این یک پروژه نمونه است که می‌توانید آن را ویرایش کرده، پیش‌نمایش زنده آن را مشاهده کنید و دوباره به صورت زیپ دانلود نمایید.

## ویژگی‌ها:
- ویرایشگر کدهای HTML, CSS, JavaScript
- پیش‌نمایش زنده در مرورگر
- هوش مصنوعی Gemini جهت رفع اشکال و بهینه‌سازی کدها
- خروجی ZIP نهایی با یک کلیک
`,
    },
    'package.json': {
      path: 'package.json',
      name: 'package.json',
      isFolder: false,
      language: 'json',
      content: `{
  "name": "sample-zip-project",
  "version": "1.0.0",
  "description": "A sample extracted web app",
  "main": "src/index.html",
  "scripts": {
    "start": "open src/index.html"
  },
  "keywords": ["zip", "ide", "editor"]
}`,
    },
  };

  return sampleMap;
}
