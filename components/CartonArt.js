// Dessins de cartons en SVG (aucune image à télécharger = s'affiche tout de suite, même sans réseau).
// Utilisés pour le logo et comme image par défaut des produits sans photo.

const PALETTES = [
  { top: "#e8b070", left: "#c9894f", right: "#b0713a", line: "#7a4a22", tape: "#f8e2ba", bg: "#fdf1e2" }, // kraft
  { top: "#f1ece4", left: "#d9d1c4", right: "#c2b8a8", line: "#6b6153", tape: "#9fd3cc", bg: "#e7f4f2" }, // carton blanc
  { top: "#cf9a5e", left: "#ad7640", right: "#925f2f", line: "#5e3815", tape: "#f3c95c", bg: "#fbf3d9" }, // kraft foncé
];

function pts(list) {
  return list.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

// Un carton en perspective. (cx, cy) = centre du dessus, w = demi-largeur, h = hauteur.
function Box({ cx, cy, w, h, c, open = false, tape = true }) {
  const t0 = [cx, cy - w / 2];
  const r0 = [cx + w, cy];
  const b0 = [cx, cy + w / 2];
  const l0 = [cx - w, cy];
  const left = [l0, b0, [b0[0], b0[1] + h], [l0[0], l0[1] + h]];
  const right = [b0, r0, [r0[0], r0[1] + h], [b0[0], b0[1] + h]];
  const sw = Math.max(1.2, w / 26);

  // ruban : couture du dessus + bande sur la face droite
  const tw = w * 0.12;
  const m1 = [(t0[0] + l0[0]) / 2, (t0[1] + l0[1]) / 2];
  const m2 = [(b0[0] + r0[0]) / 2, (b0[1] + r0[1]) / 2];
  const L = Math.hypot(r0[0] - b0[0], r0[1] - b0[1]);
  const vx = ((r0[0] - b0[0]) / L) * tw;
  const vy = ((r0[1] - b0[1]) / L) * tw;
  const tapeTop = [[m1[0] - vx, m1[1] - vy], [m1[0] + vx, m1[1] + vy], [m2[0] + vx, m2[1] + vy], [m2[0] - vx, m2[1] - vy]];
  const tapeSide = [[m2[0] - vx, m2[1] - vy], [m2[0] + vx, m2[1] + vy], [m2[0] + vx, m2[1] + vy + h * 0.42], [m2[0] - vx, m2[1] - vy + h * 0.42]];

  // rabats ouverts (carton ouvert)
  const fl = [l0, t0, [t0[0] - w * 0.25, t0[1] - w * 0.55], [l0[0] - w * 0.25, l0[1] - w * 0.55]];
  const fr = [t0, r0, [r0[0] + w * 0.25, r0[1] - w * 0.55], [t0[0] + w * 0.25, t0[1] - w * 0.55]];

  return (
    <g strokeLinejoin="round">
      {open && <polygon points={pts(fl)} fill={c.left} stroke={c.line} strokeWidth={sw} />}
      {open && <polygon points={pts(fr)} fill={c.right} stroke={c.line} strokeWidth={sw} />}
      <polygon points={pts(left)} fill={c.left} stroke={c.line} strokeWidth={sw} />
      <polygon points={pts(right)} fill={c.right} stroke={c.line} strokeWidth={sw} />
      <polygon points={pts([t0, r0, b0, l0])} fill={open ? c.line : c.top} stroke={c.line} strokeWidth={sw} />
      {!open && tape && <polygon points={pts(tapeTop)} fill={c.tape} />}
      {!open && tape && <polygon points={pts(tapeSide)} fill={c.tape} />}
      {/* flèches « ce côté en haut » */}
      {[-0.3, 0.3].map((k) => {
        const ex = (l0[0] + b0[0]) / 2 + w * k * 0.55;
        const ey = (l0[1] + b0[1]) / 2 + h * 0.55 + w * k * 0.275;
        const a = w * 0.13;
        return (
          <path
            key={k}
            d={`M${ex} ${ey + a}V${ey - a}M${ex - a * 0.6} ${ey - a * 0.3}L${ex} ${ey - a}L${ex + a * 0.6} ${ey - a * 0.3}`}
            fill="none"
            stroke={c.line}
            strokeWidth={sw * 1.4}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

// Image par défaut d'un produit : 3 formes × 3 couleurs, choisies selon le produit
// pour que deux produits sans photo ne se ressemblent pas.
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function ProductCarton({ seed = "", size = "100%" }) {
  const n = hash(String(seed));
  const shape = n % 3;
  const c = PALETTES[Math.floor(n / 3) % 3];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" style={{ display: "block", background: c.bg }}>
      <ellipse cx="60" cy="104" rx="42" ry="7" fill="#000" opacity="0.08" />
      {shape === 0 && <Box cx={60} cy={44} w={38} h={42} c={c} />}
      {shape === 1 && <Box cx={60} cy={50} w={38} h={38} c={c} open />}
      {shape === 2 && (
        <>
          <Box cx={60} cy={58} w={40} h={30} c={c} tape={false} />
          <Box cx={58} cy={33} w={25} h={22} c={c} />
        </>
      )}
    </svg>
  );
}

// Logo de l'app : « Mon Stock » en haut, le carton au milieu, « مخزني » en bas.
export function AppLogo({ size = 132 }) {
  const c = PALETTES[0];
  return (
    <div className="app-logo" style={{ width: size, height: size }}>
      <span className="app-logo-fr">MON STOCK</span>
      <svg viewBox="0 0 120 120" width={size * 0.52} height={size * 0.52} aria-hidden="true">
        <ellipse cx="60" cy="106" rx="44" ry="7" fill="#0b5e58" />
        <Box cx={60} cy={42} w={40} h={44} c={c} />
      </svg>
      <span className="app-logo-ar" lang="ar" dir="rtl">مخزني</span>
    </div>
  );
}
