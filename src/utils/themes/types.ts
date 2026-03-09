/**
 * 
 */

// CSS 
export interface ThemeVariables {
  // 
  "--gh-bg": string
  "--gh-bg-secondary": string
  "--gh-bg-tertiary": string

  // 
  "--gh-text": string
  "--gh-text-secondary": string
  "--gh-text-tertiary": string
  "--gh-text-on-primary": string

  // 
  "--gh-border": string
  "--gh-border-active": string

  // 
  "--gh-hover": string
  "--gh-active-bg": string

  // 
  "--gh-input-bg": string
  "--gh-input-border": string
  "--gh-input-focus-border": string
  "--gh-input-focus-shadow": string

  // 
  "--gh-shadow": string
  "--gh-shadow-sm": string
  "--gh-shadow-lg": string
  "--gh-shadow-brand": string

  // 
  "--gh-primary": string
  "--gh-secondary": string
  "--gh-danger": string

  // 
  "--gh-header-bg": string
  "--gh-tag-active-bg": string
  "--gh-checkbox-bg": string

  // 
  "--gh-badge-text": string
  "--gh-badge-bg": string
  "--gh-badge-border": string
  "--gh-badge-shadow": string

  // 
  "--gh-selected-gradient": string

  // 
  "--gh-folder-bg-default": string
  "--gh-folder-bg-expanded": string
  "--gh-folder-bg-0": string
  "--gh-folder-bg-1": string
  "--gh-folder-bg-2": string
  "--gh-folder-bg-3": string
  "--gh-folder-bg-4": string
  "--gh-folder-bg-5": string
  "--gh-folder-bg-6": string
  "--gh-folder-bg-7": string

  // 
  "--gh-outline-locate-bg": string
  "--gh-outline-locate-border": string
  "--gh-outline-locate-shadow": string
  "--gh-outline-sync-bg": string
  "--gh-outline-sync-border": string

  // 
  "--gh-user-query-bg": string
  "--gh-user-query-hover-bg": string

  // 
  "--gh-bg-danger": string
  "--gh-text-danger": string
  "--gh-bg-danger-hover": string

  // 
  "--gh-brand-gradient": string
  "--gh-brand-border": string

  // 
  "--gh-glass-bg": string
  "--gh-glass-bg-hover": string
  "--gh-glass-text": string

  // 
  "--gh-card-bg": string
  "--gh-card-border": string

  // 
  "--gh-overlay-bg": string

  // 
  "--gh-btn-shadow": string
  "--gh-btn-shadow-hover": string

  // 
  "--gh-search-highlight-bg": string

  // Emoji 
  "--gh-emoji-selected-bg": string

  // 
  "--gh-highlight-pulse": string

  // 
  "--gh-slider-dot-bg": string

  // 
  "--gh-code-bg": string

  //  ()
  "--gh-bg-image"?: string
  //  ()
  "--gh-bg-animation"?: string
  //  ()
  "--gh-footer-text"?: string
}

// 
export interface ThemePreset {
  id: string
  name: string
  description?: string
  variables: ThemeVariables
}
