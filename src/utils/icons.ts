/**
 * SVG 
 *  DOM API  SVG  innerHTMLCSP 
 */

const SVG_NS = "http://www.w3.org/2000/svg"

export interface IconOptions {
  size?: number
  color?: string
  className?: string
}

// ===================== SVG Path  React  =====================

/**  -  */
export const COPY_ICON_RECT = { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }

/**  -  */
export const COPY_ICON_PATH = "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"

/**  -  */
export const CHECK_ICON_POINTS = "20 6 9 17 4 12"

/**  (placeholder - ) */
export const SIDEBAR_ICONS: Record<string, string> = {}

/**
 *  SVG 
 */
export function createSVGElement(tag: string, attrs: Record<string, string> = {}): SVGElement {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value)
  }
  return el
}

/**
 * 
 */
export function createCopyIcon(options: IconOptions = {}): SVGSVGElement {
  const { size = 16, color = "currentColor", className = "" } = options

  const svg = createSVGElement("svg", {
    xmlns: SVG_NS,
    width: size.toString(),
    height: size.toString(),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    ...(className ? { class: className } : {}),
  }) as SVGSVGElement

  // 
  const rect1 = createSVGElement("rect", {
    x: "9",
    y: "9",
    width: "13",
    height: "13",
    rx: "2",
    ry: "2",
  })

  // 
  const path = createSVGElement("path", {
    d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  })

  svg.appendChild(rect1)
  svg.appendChild(path)

  return svg
}

/**
 * 
 */
export function createCheckIcon(options: IconOptions = {}): SVGSVGElement {
  const { size = 16, color = "currentColor", className = "" } = options

  const svg = createSVGElement("svg", {
    xmlns: SVG_NS,
    width: size.toString(),
    height: size.toString(),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    "stroke-width": "2.5",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    ...(className ? { class: className } : {}),
  }) as SVGSVGElement

  const polyline = createSVGElement("polyline", {
    points: "20 6 9 17 4 12",
  })

  svg.appendChild(polyline)

  return svg
}

/**
 *  ->  -> 
 *  DOM API  innerHTMLCSP Trusted Types 
 */
export function showCopySuccess(button: HTMLElement, options: IconOptions = {}): void {
  //  innerHTML replaceChildren
  while (button.firstChild) {
    button.removeChild(button.firstChild)
  }

  // 
  button.appendChild(createCheckIcon({ ...options, color: "#22c55e" }))

  // 1.5 
  setTimeout(() => {
    while (button.firstChild) {
      button.removeChild(button.firstChild)
    }
    // 
    button.appendChild(createCopyIcon(options))
  }, 1500)
}

/**
 *  SVG 
 */
export function initCopyButtons(
  container: Element | Document | ShadowRoot,
  options: IconOptions = {},
): void {
  const buttons = container.querySelectorAll(".gh-code-copy-btn, .gh-table-copy-btn")
  buttons.forEach((btn) => {
    if (btn.querySelector("svg")) {
      return
    }

    while (btn.firstChild) {
      btn.removeChild(btn.firstChild)
    }

    btn.appendChild(createCopyIcon(options))
  })
}
