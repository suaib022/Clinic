'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TableSearchForm({ placeholder = "Search..." }: { placeholder?: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get('q') || '');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (query) {
            params.set('q', query);
        } else {
            params.delete('q');
        }
        router.push(`?${params.toString()}`);
    };

    return (
        <form onSubmit={handleSearch} className="d-flex gap-2">
            <input 
                type="text" 
                className="form-control form-control-sm" 
                placeholder={placeholder} 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                style={{ width: '250px' }}
            />
            <button type="submit" className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }}>Search</button>
            {searchParams.has('q') && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setQuery(''); router.push('?'); }}>
                    Clear
                </button>
            )}
        </form>
    );
}
