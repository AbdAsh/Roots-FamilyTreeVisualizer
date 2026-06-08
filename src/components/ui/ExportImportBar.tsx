import { useRef, useState, useCallback } from 'react';
import { Download, Upload, Image, FileJson } from 'lucide-react';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n } from '@/lib/i18n';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { MenuRow } from '@/components/ui/Menu';
import { FamilyTreeSchema } from '@/lib/validation';
import { computeTieredLayout } from '@/lib/tree-utils';
import { renderTreeSvg, type ExportTheme } from '@/lib/tree-export';

interface ExportImportBarProps {
  /** `'bar'` = inline chip toolbar (desktop header); `'menu'` = full-width rows (mobile burger). */
  variant?: 'bar' | 'menu';
  /** Called after an export action so a containing menu can close itself. */
  onAction?: () => void;
}

export function ExportImportBar({
  variant = 'bar',
  onAction,
}: ExportImportBarProps = {}) {
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
      bg: v('--color-charcoal', '#041107'),
      ink: v('--color-cream', '#e1ebe2'),
      inkDim: v('--color-cream-dark', '#b7c1b8'),
      surface: v('--tree-surface', '#0c1b0f'),
      hairline: v('--color-charcoal-lighter', '#233226'),
      accent: v('--color-amber', '#6fa170'),
      link: v('--tree-link', '#7e8a80'),
      linkRef: v('--tree-link-ref', '#616c63'),
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
    'h-8 px-2.5 rounded-lg bg-charcoal-light/80 border border-charcoal-lighter text-cream-dark hover:text-cream hover:border-amber/30 flex items-center gap-1.5 text-[11px] font-medium transition-all cursor-pointer';

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept=".json"
      onChange={handleFileChange}
      className="hidden"
    />
  );

  const importConfirmModal = (
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
  );

  // Menu variant: full-width rows for the mobile burger. Import deliberately
  // does NOT call onAction — the menu must stay mounted so the file picker and
  // the import-confirm dialog survive until the user resolves them.
  if (variant === 'menu') {
    return (
      <>
        <MenuRow
          icon={FileJson}
          label={strings.exportImport.exportJson}
          onClick={() => {
            handleExportJson();
            onAction?.();
          }}
        />
        <MenuRow
          icon={Upload}
          label={strings.exportImport.importJson}
          onClick={handleImportClick}
        />
        <MenuRow
          icon={Image}
          label={strings.exportImport.exportPng}
          onClick={() => {
            handleExportPng();
            onAction?.();
          }}
        />
        <MenuRow
          icon={Download}
          label={strings.exportImport.exportSvg}
          onClick={() => {
            handleExportSvg();
            onAction?.();
          }}
        />
        {fileInput}
        {importConfirmModal}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={handleExportJson}
          className={btnCls}
          title={strings.exportImport.exportJson}
        >
          <FileJson size={13} />
          <span>
            {strings.exportImport.exportJson}
          </span>
        </button>
        <button
          onClick={handleImportClick}
          className={btnCls}
          title={strings.exportImport.importJson}
        >
          <Upload size={13} />
          <span>
            {strings.exportImport.importJson}
          </span>
        </button>
        <button
          onClick={handleExportPng}
          className={btnCls}
          title={strings.exportImport.exportPng}
        >
          <Image size={13} />
          <span>PNG</span>
        </button>
        <button
          onClick={handleExportSvg}
          className={btnCls}
          title={strings.exportImport.exportSvg}
        >
          <Download size={13} />
          <span>SVG</span>
        </button>
        {fileInput}
      </div>
      {importConfirmModal}
    </>
  );
}
