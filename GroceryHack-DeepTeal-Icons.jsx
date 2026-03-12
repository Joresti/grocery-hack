import { useState, useEffect, useRef } from "react";

const FONTS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Poppins:wght@400;500;600;700&display=swap";

/* Custom SVG icons — 1.5-2px rounded strokes, matching the brand personality */
const ListIcon = ({ color = "currentColor", size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <line x1="14" y1="6" x2="21" y2="6" />
    <line x1="14" y1="17" x2="21" y2="17" />
  </svg>
);

const SparkIcon = ({ color = "currentColor", size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L9 12l-7 1 5.5 5L6 22l6-4 6 4-1.5-4 5.5-5-7-1z" fill={color} stroke="none" opacity="0.15"/>
    <path d="M12 2L9 12l-7 1 5.5 5L6 22l6-4 6 4-1.5-4 5.5-5-7-1z" />
  </svg>
);

const WandIcon = ({ color = "currentColor", size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4l5 5L8 21l-5-1 1-5L15 4z" />
    <line x1="14.5" y1="5.5" x2="18.5" y2="9.5" />
    <line x1="3" y1="3" x2="5" y2="5" />
    <line x1="3" y1="10" x2="4" y2="9" />
    <line x1="10" y1="3" x2="9" y2="4" />
  </svg>
);

const ZapIcon = ({ color = "currentColor", size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <path d="M13 2L4.5 13H12l-1 9L20.5 11H13L13 2z" />
  </svg>
);

const CartIcon = ({ color = "currentColor", size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6h15l-1.5 9H7.5L6 6z" />
    <path d="M6 6L5 2H2" />
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
  </svg>
);

const ChecklistIcon = ({ color = "currentColor", size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7l3 3 5-5" />
    <line x1="14" y1="7" x2="21" y2="7" />
    <path d="M4 17l3 3 5-5" />
    <line x1="14" y1="17" x2="21" y2="17" />
  </svg>
);

function AnimSavings({ value }) {
  const [d, setD] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const diff = value, st = Date.now();
    const a = () => {
      const p = Math.min((Date.now() - st) / 900, 1);
      setD(diff * (1 - Math.pow(1 - p, 3)));
      if (p < 1) ref.current = requestAnimationFrame(a);
    };
    ref.current = requestAnimationFrame(a);
    return () => cancelAnimationFrame(ref.current);
  }, []);
  return <span>${d.toFixed(2)}</span>;
}

const bg = "#161A19";
const teal = "#3CBBB1";
const cream = "#F2EDE6";
const warm = "#978E82";

function Variation({ icon, label, id }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, padding: '0 4px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: teal, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 600, color: '#fff' }}>{id}</span>
        <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      </div>
      <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ background: bg, padding: '24px 22px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 27, fontWeight: 800, color: cream, lineHeight: 1, letterSpacing: -0.3 }}>
                grocery<span style={{ color: teal }}>hack</span>
              </div>
              <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 10, fontWeight: 500, color: warm, marginTop: 6, letterSpacing: 0.3 }}>Mar 2 – 8, 2026</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 9, fontWeight: 600, color: warm, textTransform: 'uppercase', letterSpacing: 1.5 }}>This week</div>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 30, fontWeight: 800, color: teal, lineHeight: 1.1 }}>
                <AnimSavings value={28.10} />
              </div>
              <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 11, color: warm, marginTop: 4 }}>
                This year <span style={{ color: teal, fontWeight: 700 }}>$847</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeepTealRefined() {
  return (
    <>
      <link href={FONTS} rel="stylesheet" />
      <style>{`*{margin:0;padding:0;box-sizing:border-box}`}</style>
      <div style={{ background: '#0A0A0A', minHeight: '100vh', padding: '12px' }}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
            <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 700, color: '#fff' }}>Deep Teal — Icon Variations</div>
            <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Same header, six different icon treatments</div>
          </div>

          {/* A — Line icons, rounded strokes */}
          <Variation id="A" label="Rounded line icons" icon={<>
            <button style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1.5px solid ${warm}28`, background: `${teal}08`, fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 600, color: `${cream}66`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ChecklistIcon color={`${cream}66`} size={15} /> My List
            </button>
            <button style={{ flex: 1.2, padding: '14px', borderRadius: 14, border: 'none', background: teal, fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: `0 4px 18px ${teal}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <WandIcon color="#fff" size={15} /> Optimize My List
            </button>
          </>} />

          {/* B — Filled icons, subtle */}
          <Variation id="B" label="Filled solid icons" icon={<>
            <button style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1.5px solid ${warm}28`, background: `${teal}08`, fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 600, color: `${cream}66`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <CartIcon color={`${cream}66`} size={15} /> My List
            </button>
            <button style={{ flex: 1.2, padding: '14px', borderRadius: 14, border: 'none', background: teal, fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: `0 4px 18px ${teal}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ZapIcon color="#fff" size={14} /> Optimize My List
            </button>
          </>} />

          {/* C — No icons, just text with weight contrast */}
          <Variation id="C" label="No icons — pure typography" icon={<>
            <button style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1.5px solid ${warm}28`, background: `${teal}08`, fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600, color: `${cream}66`, cursor: 'pointer' }}>
              My List
            </button>
            <button style={{ flex: 1.2, padding: '14px', borderRadius: 14, border: 'none', background: teal, fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: `0 4px 18px ${teal}30` }}>
              Optimize My List
            </button>
          </>} />

          {/* D — Pill shaped with line icons */}
          <Variation id="D" label="Pill buttons + line icons" icon={<>
            <button style={{ flex: 1, padding: '13px', borderRadius: 50, border: `1.5px solid ${warm}28`, background: `${teal}06`, fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 600, color: `${cream}66`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ListIcon color={`${cream}66`} size={14} /> My List
            </button>
            <button style={{ flex: 1.2, padding: '13px', borderRadius: 50, border: 'none', background: teal, fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: `0 4px 18px ${teal}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <SparkIcon color="#fff" size={14} /> Optimize My List
            </button>
          </>} />

          {/* E — Icon-only accent, text dominant */}
          <Variation id="E" label="Leading icon, heavier text" icon={<>
            <button style={{ flex: 1, padding: '14px 16px', borderRadius: 14, border: `1.5px solid ${warm}28`, background: `${teal}06`, fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 14, fontWeight: 700, color: `${cream}77`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${teal}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ChecklistIcon color={teal} size={15} />
              </div>
              My List
            </button>
            <button style={{ flex: 1.2, padding: '14px 16px', borderRadius: 14, border: 'none', background: teal, fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: `0 4px 18px ${teal}30`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <WandIcon color="#fff" size={15} />
              </div>
              Optimize
            </button>
          </>} />

          {/* F — Soft filled, Bricolage in buttons */}
          <Variation id="F" label="Contained icons + Bricolage buttons" icon={<>
            <button style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1.5px solid ${warm}25`, background: `${warm}0A`, fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 700, color: `${cream}70`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <CartIcon color={`${cream}60`} size={16} /> My List
            </button>
            <button style={{ flex: 1.2, padding: '14px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${teal}, #2DA89F)`, fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', boxShadow: `0 4px 18px ${teal}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <ZapIcon color="#fff" size={14} /> Optimize
            </button>
          </>} />

        </div>
      </div>
    </>
  );
}
