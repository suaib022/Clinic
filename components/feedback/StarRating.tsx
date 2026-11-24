'use client';

import { useState } from 'react';

const RATING_DESCRIPTIONS: Record<number, string> = {
    1: 'Poor (1/5)',
    2: 'Fair (2/5)',
    3: 'Average (3/5)',
    4: 'Very Good (4/5)',
    5: 'Excellent (5/5)'
};

export default function StarRating({ 
    value, 
    onChange, 
    disabled = false 
}: { 
    value: number; 
    onChange?: (val: number) => void; 
    disabled?: boolean;
}) {
    const [hover, setHover] = useState(0);

    return (
        <div className="d-flex align-items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = hover ? star <= hover : star <= value;
                return (
                    <button
                        key={star}
                        type="button"
                        className="btn p-0 border-0 bg-transparent text-warning"
                        style={{ cursor: disabled ? 'default' : 'pointer', fontSize: '1.4rem', lineHeight: 1 }}
                        disabled={disabled}
                        onMouseEnter={() => !disabled && setHover(star)}
                        onMouseLeave={() => !disabled && setHover(0)}
                        onClick={() => !disabled && onChange && onChange(star)}
                    >
                        <i className={`bi ${isFilled ? 'bi-star-fill text-warning' : 'bi-star text-secondary text-opacity-50'}`}></i>
                    </button>
                );
            })}
            <span className="ms-2 small text-muted fw-semibold">
                {RATING_DESCRIPTIONS[hover || value] || 'Select rating'}
            </span>
        </div>
    );
}
