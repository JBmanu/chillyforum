// Effetti a tutto schermo per le reazioni
const UP = new Set(['🔥', '😍', '👍']); // salgono dal basso; le altre cadono dall'alto

export function emojiBlast(emoji) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const vw = innerWidth, vh = innerHeight;
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;z-index:200;pointer-events:none;overflow:hidden';
  document.body.append(layer);
  const rand = (a, b) => a + Math.random() * (b - a);
  const mk = (size) => {
    const el = document.createElement('span');
    el.textContent = emoji;
    el.style.cssText = `position:absolute;left:0;top:0;font-size:${size}px;line-height:1;will-change:transform,opacity`;
    layer.append(el);
    return el;
  };

  // Emoji gigante al centro: entra con un rimbalzo, dondola e svanisce
  const big = mk(Math.min(vw, vh) * 0.38);
  const bx = vw / 2 - Math.min(vw, vh) * 0.19, by = vh / 2 - Math.min(vw, vh) * 0.22;
  big.animate([
    { transform: `translate(${bx}px,${by}px) scale(0) rotate(-40deg)`, opacity: 0 },
    { transform: `translate(${bx}px,${by}px) scale(1.25) rotate(12deg)`, opacity: 1, offset: 0.3 },
    { transform: `translate(${bx}px,${by}px) scale(0.95) rotate(-8deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${bx}px,${by}px) scale(1.05) rotate(6deg)`, opacity: 1, offset: 0.7 },
    { transform: `translate(${bx}px,${by - 40}px) scale(1.3) rotate(0deg)`, opacity: 0 },
  ], { duration: 1500, easing: 'ease-out', fill: 'forwards' });

  // Pioggia (o fontana) di emoji
  const up = UP.has(emoji);
  for (let i = 0; i < 26; i++) {
    const size = rand(22, 54);
    const el = mk(size);
    const x = rand(-10, vw - size + 10), drift = rand(-60, 60);
    const y0 = up ? vh + 20 : -size - 20, y1 = up ? -size - 40 : vh + 40;
    const r0 = rand(-45, 45), r1 = r0 + rand(-240, 240);
    el.animate([
      { transform: `translate(${x}px,${y0}px) rotate(${r0}deg)`, opacity: 1 },
      { transform: `translate(${x + drift}px,${(y0 + y1) / 2}px) rotate(${(r0 + r1) / 2}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x - drift}px,${y1}px) rotate(${r1}deg)`, opacity: 0.9 },
    ], { duration: rand(1300, 2300), delay: rand(0, 600), easing: up ? 'cubic-bezier(.2,.6,.4,1)' : 'cubic-bezier(.5,0,.9,.6)', fill: 'both' });
  }
  navigator.vibrate?.([15, 40, 15]);
  setTimeout(() => layer.remove(), 3200);
}
