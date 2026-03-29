import React, { useState, useRef } from 'react';

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
    emoji: '📅',
    gradient: ['#FB7185', '#E11D48'],
    angle: 0
  },
  {
    id: 'event',
    title: 'New Event',
    desc: 'Host a meetup',
    emoji: '🔵',
    gradient: ['#34D399', '#0D9488'],
    angle: 90
  },
  {
    id: 'lfg',
    title: 'LFG',
    desc: "I'm free now",
    emoji: '⚡',
    gradient: ['#FCD34D', '#F59E0B'],
    angle: 180
  },
  {
    id: 'coffee',
    title: 'Coffee Chat',
    desc: '1:1 meetup',
    emoji: '☕',
    gradient: ['#818CF8', '#5B5FEF'],
    angle: 270
  }
];

export default function CreateWheel({ onAction }) {
  const [hovered, setHovered] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef(null);

  const cx = 200;
  const cy = 200;
  const innerR = 86;
  const outerR = 196;
  const gapWidth = 10;
  
  // mathematically perfectly spaced wedges with parallel edges making uniform equal-width gaps
  const slicePath = getSlicePath(-45, 45, gapWidth, innerR, outerR, cx, cy);

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
    if (slice === 'CENTER') {
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    } 
  };

  const handlePointerMove = (e) => {
    const slice = getHoveredSlice(e.clientX, e.clientY);
    setHovered(slice === 'CENTER' ? null : slice);
  };

  const handlePointerUp = (e) => {
    const slice = getHoveredSlice(e.clientX, e.clientY);
    
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (slice && slice !== 'CENTER') {
        onAction(slice);
      }
      setHovered(null);
    } else {
      if (slice && slice !== 'CENTER') {
        onAction(slice);
      }
    }
  };

  const handlePointerLeave = (e) => {
    if (!isDragging) {
      setHovered(null);
    }
  };

  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        margin: '30px auto',
        touchAction: 'none',
        width: '100%',
        maxWidth: 380,
      }}
    >
      <svg 
        ref={svgRef}
        viewBox="0 0 400 400" 
        style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', overflow: 'visible', cursor: 'pointer', display: 'block' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          {SLICES.map(s => (
            <linearGradient key={s.id} id={`grad-${s.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={s.gradient[0]} />
              <stop offset="100%" stopColor={s.gradient[1]} />
            </linearGradient>
          ))}
        </defs>

        <circle cx={cx} cy={cy} r="200" fill="#1C1C1E" />

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

        {/* Center "TAP TO CREATE" Button (Glassmorphism) */}
        <g 
          style={{ 
            transform: isDragging ? 'scale(0.92)' : 'scale(1)',
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <foreignObject x={cx - 76} y={cy - 76} width="152" height="152" style={{ pointerEvents: 'none' }}>
            <div style={{
              width: '100%', height: '100%',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(0,0,0,0.2))',
              border: '1.5px solid rgba(255,255,255,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.2)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: '#FFFFFF', fontWeight: 800, fontSize: 13, letterSpacing: '0.05em', lineHeight: 1.4
            }}>
              <span>TAP TO</span>
              <span>CREATE</span>
            </div>
          </foreignObject>
        </g>
      </svg>
    </div>
  );
}
