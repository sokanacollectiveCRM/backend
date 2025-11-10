import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function PdfMapper() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [coords, setCoords] = useState<{ label: string; x: number; y: number; page: number }[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>('');

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectedLabel) {
      alert('Please enter a label before clicking.');
      return;
    }

    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = rect.height - (e.clientY - rect.top);
    const coord = {
      label: selectedLabel,
      x: Math.round(x),
      y: Math.round(y),
      page: currentPage,
    };

    setCoords(prev => [...prev, coord]);
    console.log('📍 Added:', coord);
  }

  function handleExport() {
    // Build export structure
    const exportData = coords.reduce((acc, { label, x, y, page }) => {
      acc[label] = { x, y, page };
      return acc;
    }, {} as Record<string, { x: number; y: number; page: number }>);

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `pdfCoordinates_page${currentPage}.json`;
    a.click();
  }

  function handleClear() {
    if (window.confirm('Clear all recorded coordinates?')) {
      setCoords([]);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-2">🧭 PDF Coordinate Mapper (with Field Labels)</h1>

      {!pdfFile && (
        <input
          type="file"
          accept="application/pdf"
          onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
          className="p-2 border rounded"
        />
      )}

      {pdfFile && (
        <div className="flex flex-col gap-4">
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            className="border shadow-md"
          >
            <Page
              pageNumber={currentPage}
              width={850}
              onClick={handleClick}
            />
          </Document>

          <div className="flex items-center justify-between w-full mt-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              ⬅ Prev
            </button>

            <p className="text-sm font-medium">Page {currentPage} / {numPages}</p>

            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, numPages))}
              disabled={currentPage === numPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >
              Next ➡
            </button>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <input
              type="text"
              placeholder="Enter field label (e.g. signature)"
              value={selectedLabel}
              onChange={e => setSelectedLabel(e.target.value)}
              className="border p-2 rounded w-64"
            />
            <button
              onClick={handleExport}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              💾 Export JSON
            </button>
            <button
              onClick={handleClear}
              className="bg-red-400 text-white px-4 py-2 rounded"
            >
              🗑 Clear
            </button>
          </div>

          <div className="w-full bg-white border rounded p-2 text-xs overflow-auto h-48 mt-2">
            <pre>{JSON.stringify(coords, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}





