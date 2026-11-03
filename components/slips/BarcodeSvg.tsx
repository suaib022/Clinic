'use client';

import React from 'react';

/**
 * Clean SVG Barcode renderer (Code 128 / Code 39 aesthetic)
 * Generates crisp vector barcode lines for any ID string.
 */
export default function BarcodeSvg({
    value = 'RX2508051758',
    height = 42,
    showText = true,
    fontSize = 10
}: {
    value?: string;
    height?: number;
    showText?: boolean;
    fontSize?: number;
}) {
    // Generate deterministic bar widths based on char codes
    const bars: { width: number; isSpace: boolean }[] = [];
    const seed = value.split('').map((c) => c.charCodeAt(0));

    // Guard patterns
    bars.push({ width: 2, isSpace: false });
    bars.push({ width: 1, isSpace: true });
    bars.push({ width: 2, isSpace: false });
    bars.push({ width: 1, isSpace: true });

    seed.forEach((code) => {
        const pattern = [
            (code % 3) + 1,
            ((code >> 1) % 2) + 1,
            ((code >> 2) % 3) + 1,
            ((code >> 3) % 2) + 1
        ];
        pattern.forEach((w, idx) => {
            bars.push({ width: w, isSpace: idx % 2 === 1 });
        });
    });

    // End guard
    bars.push({ width: 2, isSpace: false });
    bars.push({ width: 1, isSpace: true });
    bars.push({ width: 3, isSpace: false });

    let currentX = 0;
    const rects: { x: number; width: number }[] = [];
    bars.forEach((b) => {
        if (!b.isSpace) {
            rects.push({ x: currentX, width: b.width });
        }
        currentX += b.width;
    });

    const totalWidth = currentX;

    return (
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg
                width={Math.min(totalWidth * 1.5, 170)}
                height={height}
                viewBox={`0 0 ${totalWidth} ${height}`}
                preserveAspectRatio="none"
                style={{ display: 'block' }}
            >
                {rects.map((r, i) => (
                    <rect key={i} x={r.x} y={0} width={r.width} height={height} fill="#000000" />
                ))}
            </svg>
            {showText && (
                <span
                    style={{
                        fontFamily: 'monospace',
                        fontSize: `${fontSize}px`,
                        fontWeight: 700,
                        letterSpacing: '1px',
                        color: '#000000',
                        marginTop: '2px'
                    }}
                >
                    {value}
                </span>
            )}
        </div>
    );
}

