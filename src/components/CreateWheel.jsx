import React, { useEffect, useState, useRef } from 'react';

// Generates an SVG path for an annular (donut) slice with parallel constant-width gaps.
function getSlicePath(logicalStart, logicalEnd, gapWidth, innerR, outerR, cx, cy) {
  const rad = Math.PI / 180;
  const dW = gapWidth / 2;
  
  // Angle offsets required to shift edge perpendicularly by dW
  const innerStartOffset = Math.asin(dW / innerR) / rad;
  const innerEndOffset = Math.asin(dW / innerR) / rad;
  const outerStartOffset = Math.asin(dW / outerR) / rad;
  const outerEndOffset = Math.asin(dW / outerR) / rad;
  
  const startInner = logicalStart + innerStartOffset;
  const endInner = logicalEnd - innerEndOffset;
  const startOuter = logicalStart + outerStartOffset;
  const endOuter = logicalEnd - outerEndOffset;
  
  // Outer points (from start to end)
  const osx = cx + outerR * Math.cos((startOuter - 90) * rad);
  const osy = cy + outerR * Math.sin((startOuter - 90) * rad);
  const oex = cx + outerR * Math.cos((endOuter - 90) * rad);
  const oey = cy + outerR * Math.sin((endOuter - 90) * rad);
  
  // Inner points (from end back to start)
  const iex = cx + innerR * Math.cos((endInner - 90) * rad);
  const iey = cy + innerR * Math.sin((endInner - 90) * rad);
  const isx = cx + innerR * Math.cos((startInner - 90) * rad);
  const isy = cy + innerR * Math.sin((startInner - 90) * rad);
  
  return `M ${osx} ${osy} A ${outerR} ${outerR} 0 0 1 ${oex} ${oey} L ${iex} ${iey} A ${innerR} ${innerR} 0 0 0 ${isx} ${isy} Z`;
}

const SLICES = [
  {
    id: 'circle',
    title: 'New Circle',
    desc: 'Start a community',
    emoji: '🔵',
    gradient: ['#FB7185', '#E11D48'], // Rose
    angle: 0
  },
  {
    id: 'event',
    title: 'New Event',
    desc: 'Host a meetup',
    emoji: '📅',
    gradient: ['#34D399', '#059669'], // Emerald
    angle: 90
  },
  {
    id: 'lfg',
    title: 'LFG',
    desc: "I'm free now",
    emoji: '⚡',
    gradient: ['#FBBF24', '#D97706'], // Amber
    angle: 180
  },
  {
    id: 'coffee',
    title: 'Coffee Chat',
    desc: '1:1 meetup',
    emoji: '☕',
    gradient: ['#818CF8', '#4F46E5'], // Indigo
    angle: 270
  }
];

export default function CreateWheel({ onAction }) {
  const [hovered, setHovered] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef(null);
  const centerButtonRef = useRef(null);
  const pointerRef = useRef(null);

  const cx = 200;
  const cy = 200;
  const innerR = 86;
  const outerR = 196;
  const gapWidth = 10;
  
  // mathematically perfectly spaced wedges with parallel edges making uniform equal-width gaps
  const slicePath = getSlicePath(-45, 45, gapWidth, innerR, outerR, cx, cy);

  useEffect(() => {
    const button = centerButtonRef.current;
    if (!button) return undefined;

    const preventScroll = (event) => {
      event.preventDefault();
    };

    // iOS Safari only reliably pauses page scroll from a non-passive
    // touchmove listener on an HTML element that started the gesture.
    button.addEventListener('touchmove', preventScroll, { passive: false });
    return () => button.removeEventListener('touchmove', preventScroll);
  }, []);

  // Math-based hovered slice detection solves all pointer/touch capturing issues!
  const getHoveredSlice = (clientX, clientY) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const svgCx = rect.left + rect.width / 2;
    const svgCy = rect.top + rect.height / 2;
    const dx = clientX - svgCx;
    const dy = clientY - svgCy;
    
    // Scale distance back to internal 400x400 viewBox logic
    const scale = rect.width / 400;
    const dist = Math.sqrt(dx*dx + dy*dy) / scale;
    
    if (dist < 76) return 'CENTER'; 
    if (dist > 200) return null;
    
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    let myAngle = (angle + 90 + 360) % 360;
    
    if (dist >= innerR && dist <= outerR) {
      if (myAngle >= 315 || myAngle < 45) return 'circle'; // Top
      if (myAngle >= 45 && myAngle < 135) return 'event'; // Right
      if (myAngle >= 135 && myAngle < 225) return 'lfg'; // Bottom
      if (myAngle >= 225 && myAngle < 315) return 'coffee'; // Left
    }
    
    return null;
  };

  const handlePointerDown = (e) => {
    const slice = getHoveredSlice(e.clientX, e.clientY);
    pointerRef.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startSlice: slice,
      isCreateGesture: slice === 'CENTER',
      moved: false,
      verticalScroll: false,
    };
    if (slice === 'CENTER') {
      setIsDragging(true);
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
    } 
  };

  const handlePointerMove = (e) => {
    const pointer = pointerRef.current;
    if (pointer?.id === e.pointerId) {
      const dx = e.clientX - pointer.startX;
      const dy = e.clientY - pointer.startY;
      const moved = Math.hypot(dx, dy) > 10;
      pointer.moved = pointer.moved || moved;
      pointer.verticalScroll = pointer.verticalScroll || (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx));

      if (pointer.verticalScroll && !pointer.isCreateGesture) {
        setHovered(null);
        return;
      }

      if (pointer.isCreateGesture) {
        e.preventDefault();
      }
    }

    const slice = getHoveredSlice(e.clientX, e.clientY);
    setHovered(slice === 'CENTER' ? null : slice);
  };

  const handlePointerUp = (e) => {
    const slice = getHoveredSlice(e.clientX, e.clientY);
    const pointer = pointerRef.current;
    const isSamePointer = pointer?.id === e.pointerId;
    const isIntentionalTap = isSamePointer && !pointer.moved;
    
    if (isDragging) {
      setIsDragging(false);
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (slice && slice !== 'CENTER') {
        onAction(slice);
      }
      setHovered(null);
    } else {
      if (slice && slice !== 'CENTER' && isIntentionalTap) {
        onAction(slice);
      }
    }
    pointerRef.current = null;
  };

  const handlePointerLeave = (e) => {
    if (!isDragging) {
      setHovered(null);
    }
  };

  const handlePointerCancel = () => {
    pointerRef.current = null;
    setIsDragging(false);
    setHovered(null);
  };

  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        margin: '30px auto',
        touchAction: 'pan-y',
        width: '100%',
        maxWidth: 380,
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      <svg 
        ref={svgRef}
        viewBox="0 0 400 400" 
        style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', overflow: 'visible', cursor: 'pointer', display: 'block', WebkitTapHighlightColor: 'transparent', touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
      >
        <defs>
          {SLICES.map(s => (
            <linearGradient key={s.id} id={`grad-${s.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={s.gradient[0]} />
              <stop offset="100%" stopColor={s.gradient[1]} />
            </linearGradient>
          ))}
          <filter id="wheel-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="12" floodOpacity="0.05" />
          </filter>
        </defs>

        <circle cx={cx} cy={cy} r="200" fill="var(--white)" filter="url(#wheel-shadow)" />

        {/* Slices Group - Expands dynamically when center ring is dragged/clicked */}
        <g 
          style={{
            transform: isDragging ? 'scale(1.05)' : 'scale(1)',
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          {SLICES.map((s) => {
            const isHovered = hovered === s.id;
            const isDimmed = (hovered || isDragging) && !isHovered;

            // Compute absolute center of wedge using standard trig
            const R = (innerR + outerR) / 2;
            const rad = (s.angle - 90) * Math.PI / 180;
            const tx = cx + R * Math.cos(rad);
            const ty = cy + R * Math.sin(rad);

            return (
              <g 
                key={s.id}
                style={{
                  transition: 'opacity 0.2s ease',
                  opacity: isDimmed ? 0.3 : 1
                }}
              >
                {/* Visual Donut Slice mapped to global rotation */}
                <g style={{
                  transform: `rotate(${s.angle}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                }}>
                  <path d={slicePath} fill={`url(#grad-${s.id})`} />
                </g>
                
                {/* Un-rotated Text securely rooted at computed geometry coordinate */}
                <g style={{ transform: `translate(${tx}px, ${ty}px)` }}>
                  <text y="-14" fill="#FFFFFF" fontSize="18" textAnchor="middle">{s.emoji}</text>
                  <text y="5" fill="#FFFFFF" fontSize="14" fontWeight="bold" textAnchor="middle" letterSpacing="0.02em">
                    {s.title}
                  </text>
                  <text y="22" fill="rgba(255,255,255,0.85)" fontSize="10.5" textAnchor="middle" letterSpacing="0.01em">
                    {s.desc}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        {/* Center "TAP TO CREATE" Button — pure SVG for pixel-perfect centering */}
        <g 
          style={{ 
            transform: isDragging ? 'scale(0.92)' : 'scale(1)',
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'none',
          }}
        >
          <circle cx={cx} cy={cy} r="76" fill="var(--bg)" stroke="var(--border)" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="74" fill="none" stroke="var(--border)" strokeWidth="1" strokeOpacity="0.5" />
          <text x={cx} y={cy - 6} fill="var(--textDark)" fontSize="13" fontWeight="800" textAnchor="middle" letterSpacing="0.05em">TAP TO</text>
          <text x={cx} y={cy + 14} fill="var(--textDark)" fontSize="13" fontWeight="800" textAnchor="middle" letterSpacing="0.05em">CREATE</text>
        </g>
      </svg>
      <button
        ref={centerButtonRef}
        type="button"
        aria-label="Tap and drag to create"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '38%',
          aspectRatio: '1 / 1',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          background: 'transparent',
          cursor: 'pointer',
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      />
    </div>
  );
}
