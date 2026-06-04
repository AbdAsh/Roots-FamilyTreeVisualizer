import { useRef, useState, useCallback } from 'react';
import { Download, Upload, Image, FileJson } from 'lucide-react';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n } from '@/lib/i18n';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FamilyTreeSchema } from '@/lib/validation';
import { computeTieredLayout } from '@/lib/tree-utils';
import { renderTreeSvg, type ExportTheme } from '@/lib/tree-export';

export function ExportImportBar() {
  const tree = useTreeStore((s) => s.tree);
  const setTree = useTreeStore((s) => s.setTree);
  const { strings } = useI18n();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importConfirm, setImportConfirm] = useState(false);
  const pendingImport = useRef<string | null>(null);

  /* ── JSON Export ── */
  const handleExportJson = useCallback(() => {
    if (!tree) return;
    const json = JSON.stringify(tree, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tree.name.replace(/\s+/g, '_')}_family_tree.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tree]);

  /* ── JSON Import ── */
  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        pendingImport.current = reader.result as string;
        setImportConfirm(true);
      };
      reader.readAsText(file);
      // Reset so the same file can be selected again
      e.target.value = '';
    },
    [],
  );

  const confirmImport = useCallback(() => {
    if (!pendingImport.current) return;
    try {
      const parsed = JSON.parse(pendingImport.current);
      const result = FamilyTreeSchema.safeParse(parsed);
      if (!result.success) {
        alert('Invalid family tree file: ' + result.error.message);
        return;
      }
      setTree(result.data);
    } catch {
      alert('Could not parse the file as JSON.');
    } finally {
      pendingImport.current = null;
      setImportConfirm(false);
    }
  }, [setTree]);

  /* ── Theme reader ── */
  // Reads current CSS custom properties into an ExportTheme so the exported
  // SVG matches the live light/dark theme exactly.
  function readExportTheme(): ExportTheme {
    const r = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) =>
      r.getPropertyValue(name).trim() || fallback;
    return {
      bg: v('--color-charcoal', '#18181b'),
      ink: v('--color-cream', '#f5f0e8'),
      inkDim: v('--color-cream-dark', '#c8b89a'),
      surface: v('--tree-surface', '#2a2a2a'),
      hairline: v('--color-charcoal-lighter', '#3a3a3a'),
      accent: v('--color-amber', '#d4a574'),
      link: v('--tree-link', '#d4a574'),
      linkRef: v('--tree-link-ref', '#8fa68a'),
      fontDisplay: v('--font-display', 'Georgia, serif').replace(/"/g, "'"),
      fontBody: v('--font-body', 'system-ui, sans-serif').replace(/"/g, "'"),
    };
  }

  /* ── PNG Export ── */
  const handleExportPng = useCallback(() => {
    if (!tree) return;
    const layout = computeTieredLayout(tree);
    if (!layout) return;
    const theme = readExportTheme();
    const { svg, width, height } = renderTreeSvg(layout, theme);

    // Use a data URI instead of a blob URL to avoid tainted-canvas security
    // restrictions that block toBlob() when an image was loaded cross-origin.
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

    const img = new window.Image();
    img.onload = () => {
      const scale = 2; // 2× for retina sharpness
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((b) => {
        if (!b) return;
        const dl = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = dl;
        a.download = `${tree.name.replace(/\s+/g, '_') ?? 'family_tree'}.png`;
        a.click();
        URL.revokeObjectURL(dl);
      }, 'image/png');
    };
    img.onerror = () =>
      console.error('[FamilyTree] PNG export: SVG failed to load into <img>');
    img.src = dataUrl;
  }, [tree]);

  /* ── SVG Export ── */
  const handleExportSvg = useCallback(() => {
    if (!tree) return;
    const layout = computeTieredLayout(tree);
    if (!layout) return;
    const theme = readExportTheme();
    const { svg } = renderTreeSvg(layout, theme);

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tree.name.replace(/\s+/g, '_') ?? 'family_tree'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tree]);

  const btnCls =
    'h-8 px-2.5 rounded-lg bg-charcoal-light/80 border border-charcoal-lighter text-cream/50 hover:text-cream hover:border-amber/30 flex items-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer';

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleExportJson}
          className={btnCls}
          title={strings.exportImport.exportJson}
        >
          <FileJson size={13} />
          <span className="hidden sm:inline">
            {strings.exportImport.exportJson}
          </span>
        </button>
        <button
          onClick={handleImportClick}
          className={btnCls}
          title={strings.exportImport.importJson}
        >
          <Upload size={13} />
          <span className="hidden sm:inline">
            {strings.exportImport.importJson}
          </span>
        </button>
        <button
          onClick={handleExportPng}
          className={btnCls}
          title={strings.exportImport.exportPng}
        >
          <Image size={13} />
          <span className="hidden sm:inline">PNG</span>
        </button>
        <button
          onClick={handleExportSvg}
          className={btnCls}
          title={strings.exportImport.exportSvg}
        >
          <Download size={13} />
          <span className="hidden sm:inline">SVG</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <ConfirmModal
        isOpen={importConfirm}
        onClose={() => {
          setImportConfirm(false);
          pendingImport.current = null;
        }}
        onConfirm={confirmImport}
        title={strings.exportImport.importConfirmTitle}
        message={strings.exportImport.importConfirmMessage}
        variant="warning"
      />
    </>
  );
}
