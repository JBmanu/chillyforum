// Icone SVG inline (stroke = currentColor, così seguono il tema)
const s = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const icon = {
  film: s('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
  trophy: s('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4"/>'),
  people: s('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.2a5 5 0 0 1 5.5 5.3"/>'),
  user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  search: s('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  plus: s('<path d="M12 5v14M5 12h14"/>'),
  back: s('<path d="M15 5 8 12l7 7"/>'),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  edit: s('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
  trash: s('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  smile: s('<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/><path d="M19 3v4M17 5h4" stroke-width="1.8"/>'),
  logout: s('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>'),
  bookmark: s('<path d="M6 3h12v18l-6-4.5L6 21V3Z"/><path d="M12 7v6M9 10h6"/>'),
  check: s('<path d="m5 12 5 5 9-10"/>'),
};

const STAR = 'M12 2.6l2.85 5.8 6.4.93-4.63 4.5 1.1 6.37L12 17.2l-5.72 3 1.1-6.37L2.75 9.33l6.4-.93z';

/** Stella piena/mezza/vuota per la visualizzazione (fill: 0, 0.5, 1). */
export function star(fill, cls = '') {
  const id = 'h' + Math.random().toString(36).slice(2, 8);
  if (fill >= 1) return `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true"><path d="${STAR}" fill="currentColor"/></svg>`;
  if (fill <= 0) return `<svg viewBox="0 0 24 24" class="star-empty ${cls}" aria-hidden="true"><path d="${STAR}" fill="currentColor"/></svg>`;
  return `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true"><defs><linearGradient id="${id}"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="var(--line)"/></linearGradient></defs><path d="${STAR}" fill="url(#${id})"/></svg>`;
}

/** Stella grande del selettore di voto. */
export const raterStar = (on, half) => {
  const id = 'r' + Math.random().toString(36).slice(2, 8);
  const fill = half ? `url(#${id})` : 'currentColor';
  return `<svg viewBox="0 0 24 24" class="${on || half ? 'on' : 'off'}" aria-hidden="true">${half ? `<defs><linearGradient id="${id}"><stop offset="50%" stop-color="var(--sun)"/><stop offset="50%" stop-color="var(--line)"/></linearGradient></defs>` : ''}<path d="${STAR}" fill="${fill}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
};
