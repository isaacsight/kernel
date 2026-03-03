// ─── Search Bar ────────────────────────────────────────────────
//
// Debounced full-text search input for the explore page.

import { useState, useCallback, useRef, useEffect } from 'react'

interface SearchBarProps {
  value: string
  onSearch: (query: string) => void
  placeholder?: string
  debounceMs?: number
}

export function SearchBar({
  value,
  onSearch,
  placeholder = 'Search articles...',
  debounceMs = 400,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocalValue(v)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSearch(v.trim())
    }, debounceMs)
  }, [onSearch, debounceMs])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (localValue.trim()) onSearch(localValue.trim())
    }
  }, [localValue, onSearch])

  const handleClear = useCallback(() => {
    setLocalValue('')
    if (timerRef.current) clearTimeout(timerRef.current)
    onSearch('')
  }, [onSearch])

  return (
    <div className="ka-search-bar">
      <span className="ka-search-bar-icon">{'\u2315'}</span>
      <input
        type="text"
        className="ka-search-bar-input"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Search articles"
      />
      {localValue && (
        <button
          className="ka-search-bar-clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          {'\u2715'}
        </button>
      )}
    </div>
  )
}
