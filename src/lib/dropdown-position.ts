export interface DropdownPosition {
  top: number;
  left: number;
}

export function getFixedDropdownPosition(
  anchor: HTMLElement,
  width: number,
  height: number,
  gap = 6
): DropdownPosition {
  const rect = anchor.getBoundingClientRect();
  const opensLeft = rect.left + width > window.innerWidth;
  const opensUp = rect.bottom + gap + height > window.innerHeight;

  const left = opensLeft
    ? Math.max(gap, rect.right - width)
    : Math.min(rect.left, window.innerWidth - width - gap);
  const top = opensUp
    ? Math.max(gap, rect.top - height - gap)
    : Math.min(rect.bottom + gap, window.innerHeight - height - gap);

  return { top, left };
}
