import React, { useRef, useEffect } from 'react';

const clr = {
  bg: 'var(--bg, #F0F0F5)',
  white: 'var(--white, #FFFFFF)',
  indigo: 'var(--indigo, #5B5FEF)',
  textDark: 'var(--textDark, #0F0F1E)',
  textMid: 'var(--textMid, #6B7280)',
  border: 'var(--border, #E5E7EB)'
};

const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const periods = ['AM', 'PM'];

function Wheel({ items, value, onChange }) {
  const containerRef = useRef(null);
  const ITEM_HEIGHT = 40;
  const isScrolling = useRef(false);
  const scrollTimeout = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const idx = items.indexOf(value);
      if (idx !== -1) {
        containerRef.current.scrollTop = idx * ITEM_HEIGHT;
      }
    }
  }, []); // Only scroll initially to match default value

  const handleScroll = (e) => {
    const y = e.target.scrollTop;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_HEIGHT)));
    
    clearTimeout(scrollTimeout.current);
    isScrolling.current = true;
    
    // When scroll completely settles, we update the value
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
      if (items[idx] !== value) {
        onChange(items[idx]);
      }
      // Snap to exact pixel visually if OS didn't
      e.target.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
    }, 150);
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: ITEM_HEIGHT * 3,
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        scrollBehavior: 'smooth',
        width: 44,
        textAlign: 'center'
      }}
      className="noscrollbar"
    >
      <div style={{ height: ITEM_HEIGHT }} />
      {items.map(item => {
        const isSelected = value === item;
        return (
          <div 
            key={item} 
            style={{ 
              height: ITEM_HEIGHT, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              scrollSnapAlign: 'center',
              fontSize: isSelected ? 22 : 16,
              fontWeight: isSelected ? 800 : 500,
              color: isSelected ? clr.textDark : clr.textLight,
              opacity: isSelected ? 1 : 0.6,
              transition: 'all 0.15s ease',
              cursor: 'pointer'
            }}
            onClick={() => {
              const idx = items.indexOf(item);
              if (containerRef.current) {
                containerRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
              }
            }}
          >
            {item}
          </div>
        )
      })}
      <div style={{ height: ITEM_HEIGHT }} />
    </div>
  )
}

export default function TimePicker({ value, onChange }) {
  // Parse value strictly from 24h map (e.g. 14:30)
  const [h, m] = (value || "12:00").split(':');
  let hour24 = parseInt(h, 10);
  // Default parsing handler
  if (isNaN(hour24)) hour24 = 12;
  
  let isPm = hour24 >= 12;
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;

  const hStr = String(hour12).padStart(2, '0');
  const mStr = String(m || '00').padStart(2, '0');
  const pStr = isPm ? 'PM' : 'AM';

  const update = (newH, newM, newP) => {
    let h24 = parseInt(newH, 10);
    if (newP === 'PM' && h24 !== 12) h24 += 12;
    if (newP === 'AM' && h24 === 12) h24 = 0;
    
    onChange(`${String(h24).padStart(2,'0')}:${newM}`);
  }

  return (
    <div style={{ 
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, backgroundColor: clr.bg, border: `1.5px solid ${clr.border}`,
      borderRadius: 20, padding: '8px 24px', position: 'relative', width: '100%', boxSizing: 'border-box'
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: 16, right: 16, height: 40,
        transform: 'translateY(-50%)', backgroundColor: 'rgba(91,95,239,0.08)',
        borderRadius: 12, pointerEvents: 'none'
      }} />

      <Wheel items={hours} value={hStr} onChange={v => update(v, mStr, pStr)} />
      <span style={{ fontSize: 24, fontWeight: 800, color: clr.textDark, paddingBottom: 4 }}>:</span>
      <Wheel items={minutes} value={mStr} onChange={v => update(hStr, v, pStr)} />
      <div style={{ width: 12 }} />
      <Wheel items={periods} value={pStr} onChange={v => update(hStr, mStr, v)} />
      
      <style>{`
        .noscrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
