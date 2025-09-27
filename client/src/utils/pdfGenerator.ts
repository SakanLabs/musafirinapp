import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface PDFOptions {
  filename?: string;
  quality?: number;
  scale?: number;
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

export const generatePDFFromElement = async (
  element: HTMLElement,
  options: PDFOptions = {}
): Promise<void> => {
  const {
    filename = 'invoice.pdf',
    quality = 1,
    scale = 2,
    orientation = 'portrait'
  } = options;

  try {
    // Capture the element as canvas
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
    });

    // Get canvas dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [imgWidth, imgHeight],
      compress: true,
    });

    // Convert canvas to image data
    const imgData = canvas.toDataURL('image/png', quality);

    // Add image to PDF
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};

export const generateInvoicePDF = async (
  invoiceElement: HTMLElement,
  invoiceNo: string
): Promise<void> => {
  const filename = `invoice-${invoiceNo}.pdf`;
  
  await generatePDFFromElement(invoiceElement, {
    filename,
    quality: 0.95,
    scale: 2,
    format: 'a4',
    orientation: 'portrait'
  });
};

// Hook untuk generate PDF dengan loading state
export const usePDFGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePDF = async (element: HTMLElement, options?: PDFOptions) => {
    setIsGenerating(true);
    setError(null);

    try {
      await generatePDFFromElement(element, options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generatePDF,
    isGenerating,
    error,
  };
};

// Import React untuk hook
import { useState } from 'react';