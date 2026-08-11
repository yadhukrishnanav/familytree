// Family Tree — PNG / PDF export via html2canvas + jsPDF

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Capture a DOM node as a PNG data URL.
 * The element should have a solid background (transparent areas become black).
 */
export async function exportToImage(
  element: HTMLElement,
  options: { backgroundColor?: string; scale?: number } = {},
): Promise<string> {
  const canvas = await html2canvas(element, {
    backgroundColor: options.backgroundColor ?? '#f8fafc',
    scale: options.scale ?? 2,
    useCORS: true,
    logging: false,
  });
  return canvas.toDataURL('image/png');
}

/**
 * Export a DOM node as a PNG file (triggers browser download).
 */
export async function exportToPngFile(
  element: HTMLElement,
  filename = 'family-tree.png',
): Promise<void> {
  const dataUrl = await exportToImage(element);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * Export a DOM node as a multi-page PDF (triggers browser download).
 */
export async function exportToPdfFile(
  element: HTMLElement,
  filename = 'family-tree.pdf',
): Promise<void> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#f8fafc',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
