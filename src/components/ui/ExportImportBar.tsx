import { useRef, useState, useCallback } from 'react';
import { Download, Upload, Image, FileJson } from 'lucide-react';
import { useTreeStore } from '@/hooks/useTree';
import { useI18n } from '@/lib/i18n';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FamilyTreeSchema } from '@/lib/validation';

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

  /* ── Shared export helper ── */
  // Builds a self-contained SVG clone ready for file export.
  // Resolves CSS variables, strips interactive UI elements, and removes
  // the pan/zoom transform so the viewBox positions content correctly.
  const buildExportClone = useCallback((): {
    clone: SVGSVGElement;
    width: number;
    height: number;
  } | null => {
    // Target by id so we always get the tree SVG, not a Lucide icon SVG
    const svg = document.getElementById('tree-svg') as SVGSVGElement | null;
    if (!svg) return null;

    const g = svg.querySelector('.tree-root') as SVGGElement | null;
    if (!g) return null;

    const bbox = g.getBBox();
    const pad = 40;
    const w = bbox.width + pad * 2;
    const h = bbox.height + pad * 2;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${w} ${h}`);
    // Remove pan/zoom transform — viewBox handles positioning now
    const cloneG = clone.querySelector('.tree-root') as SVGGElement | null;
    if (cloneG) cloneG.removeAttribute('transform');

    // Strip interactive buttons that shouldn't appear in exports
    clone.querySelectorAll('.add-btn, .del-btn').forEach((el) => el.remove());

    // Resolve CSS custom properties to literal values so the exported file
    // renders correctly without the app's stylesheet
    const root = getComputedStyle(document.documentElement);
    const colorCharcoal =
      root.getPropertyValue('--color-charcoal').trim() || '#1a1a2e';
    const colorCharcoalLight =
      root.getPropertyValue('--color-charcoal-light').trim() || '#2a2a3e';
    clone.querySelectorAll('*').forEach((el) => {
      const fill = el.getAttribute('fill');
      if (fill === 'var(--color-charcoal)')
        el.setAttribute('fill', colorCharcoal);
      if (fill && fill.startsWith('var(--color-charcoal-light'))
        el.setAttribute('fill', colorCharcoalLight);
    });
    // Replace font-family CSS var references in text elements
    clone.querySelectorAll('text').forEach((el) => {
      const ff = el.getAttribute('fontFamily');
      if (ff === 'var(--font-display)')
        el.setAttribute('fontFamily', "'Playfair Display', Georgia, serif");
      if (ff === 'var(--font-body)')
        el.setAttribute('fontFamily', "'DM Sans', system-ui, sans-serif");
    });

    // Inject styles for CSS classes used on link paths
    const style = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'style',
    );
    style.textContent = [
      '.tree-link-parent-child{stroke:#d4a574;stroke-width:1.5;fill:none;opacity:.6;}',
      '.tree-link-spouse{stroke:#8b4557;stroke-width:1.5;stroke-dasharray:6 4;fill:none;opacity:.6;}',
      '.tree-link-sibling{stroke:#8fa68a;stroke-width:1;stroke-dasharray:2 3;fill:none;opacity:.5;}',
    ].join('');
    clone.insertBefore(style, clone.firstChild);

    // Dark background rect
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(bbox.x - pad));
    bg.setAttribute('y', String(bbox.y - pad));
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    bg.setAttribute('fill', '#1a1a1a');
    clone.insertBefore(bg, clone.firstChild);

    return { clone, width: w, height: h };
  }, []);

  /* ── PNG Export ── */
  const handleExportPng = useCallback(() => {
    const result = buildExportClone();
    if (!result) return;
    const { clone, width, height } = result;

    const svgString = new XMLSerializer().serializeToString(clone);
    // Use a data URI instead of a blob URL to avoid tainted-canvas security
    // restrictions that block toBlob() when an image was loaded cross-origin.
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;

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
        a.download = `${tree?.name.replace(/\s+/g, '_') ?? 'family_tree'}.png`;
        a.click();
        URL.revokeObjectURL(dl);
      }, 'image/png');
    };
    img.onerror = () =>
      console.error('[FamilyTree] PNG export: SVG failed to load into <img>');
    img.src = dataUrl;
  }, [tree, buildExportClone]);

  /* ── SVG Export ── */
  const handleExportSvg = useCallback(() => {
    const result = buildExportClone();
    if (!result) return;
    const { clone } = result;

    const svgString = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tree?.name.replace(/\s+/g, '_') ?? 'family_tree'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tree, buildExportClone]);

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
