import type { TieredLayout, PositionedNode, PositionedLink } from '@/lib/tree-utils';

export interface ExportTheme {
  bg: string;
  ink: string;
  inkDim: string;
  surface: string;
  hairline: string;
  accent: string;
  link: string;
  linkRef: string;
  fontDisplay: string;
  fontBody: string;
}

const NODE_R = 28;

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' }[c]!),
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function linkD(l: PositionedLink): string {
  const { source: s, target: t, type } = l;
  if (type === 'parent-child') {
    const my = (s.y + t.y) / 2;
    return `M${s.x},${s.y} C${s.x},${my} ${t.x},${my} ${t.x},${t.y}`;
  }
  if (type === 'sibling') {
    const h = Math.max(30, Math.min(60, Math.abs(t.x - s.x) * 0.2));
    return `M${s.x},${s.y} Q${(s.x + t.x) / 2},${s.y - h} ${t.x},${t.y}`;
  }
  return `M${s.x},${s.y} L${t.x},${t.y}`;
}

export function renderTreeSvg(
  layout: TieredLayout,
  theme: ExportTheme,
): { svg: string; width: number; height: number } {
  const pad = 60;
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const n of layout.nodes) {
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  x0 -= NODE_R + pad;
  x1 += NODE_R + pad;
  y0 -= NODE_R + pad;
  y1 += NODE_R + pad;
  const w = x1 - x0;
  const h = y1 - y0;

  const links = layout.links
    .map((l) => {
      const dash =
        l.type === 'spouse'
          ? ' stroke-dasharray="5 4"'
          : l.type === 'sibling'
            ? ' stroke-dasharray="1.5 3"'
            : '';
      const ref = (l as PositionedLink & { kind?: string }).kind === 'reference';
      const stroke = ref ? theme.linkRef : theme.link;
      const refDash = ref ? ' stroke-dasharray="2 4"' : dash;
      return `<path d="${linkD(l)}" fill="none" stroke="${stroke}" stroke-width="${l.type === 'sibling' ? 1 : 1.4}"${refDash} opacity="0.8"/>`;
    })
    .join('');

  const nodes = layout.nodes
    .map((n: PositionedNode) => {
      const yrs =
        n.member.birthDate || n.member.deathDate
          ? `<text x="${n.x}" y="${n.y + NODE_R + 26}" text-anchor="middle" font-family="${theme.fontBody}" font-size="8" fill="${theme.inkDim}">${esc(n.member.birthDate?.slice(0, 4) ?? '?')} — ${esc(n.member.deathDate?.slice(0, 4) ?? '')}</text>`
          : '';
      return `<g>
<circle cx="${n.x}" cy="${n.y}" r="${NODE_R}" fill="${theme.surface}" stroke="${theme.hairline}" stroke-width="1.4"/>
<text x="${n.x}" y="${n.y}" text-anchor="middle" dominant-baseline="central" font-family="${theme.fontDisplay}" font-size="13" font-weight="600" fill="${theme.ink}">${esc(initials(n.member.name))}</text>
<text x="${n.x}" y="${n.y + NODE_R + 14}" text-anchor="middle" font-family="${theme.fontBody}" font-size="10" fill="${theme.ink}">${esc(n.member.name.length > 16 ? n.member.name.slice(0, 15) + '…' : n.member.name)}</text>
${yrs}
</g>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}">
<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="${theme.bg}"/>
${links}
${nodes}
</svg>`;
  return { svg, width: w, height: h };
}
