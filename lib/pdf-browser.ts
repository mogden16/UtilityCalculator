import { MAX_PDF_FILE_BYTES, MAX_PDF_PAGES, type PdfTextLine } from "@/lib/utility-bill-pdf";

type PositionedText = {
  text: string;
  x: number;
  y: number;
  width: number;
};

export type BrowserPdfExtraction = {
  pageCount: number;
  lines: PdfTextLine[];
  warnings: string[];
};

function joinText(items: PositionedText[]) {
  const sorted = [...items].sort((first, second) => first.x - second.x);
  let text = "";
  let previousEnd: number | undefined;
  for (const item of sorted) {
    const gap = previousEnd === undefined ? 0 : item.x - previousEnd;
    if (text && gap > 1.5 && !text.endsWith(" ")) text += " ";
    text += item.text;
    previousEnd = item.x + item.width;
  }
  return text.replace(/\s+/g, " ").trim();
}

export async function extractPdfTextInBrowser(file: File): Promise<BrowserPdfExtraction> {
  if (file.size <= 0) throw new Error("The selected PDF is empty.");
  if (file.size > MAX_PDF_FILE_BYTES) throw new Error(`PDF files are limited to ${Math.round(MAX_PDF_FILE_BYTES / 1024 / 1024)} MB for browser processing.`);
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Select a PDF utility bill.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-") throw new Error("The selected file does not have a valid PDF header.");

  const pdfjs = await import("pdfjs-dist/webpack.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    stopAtErrors: false,
  });

  try {
    const document = await loadingTask.promise;
    const pageCount = document.numPages;
    if (pageCount > MAX_PDF_PAGES) {
      await document.destroy();
      throw new Error(`PDF files are limited to ${MAX_PDF_PAGES} pages for browser processing.`);
    }

    const lines: PdfTextLine[] = [];
    const warnings: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: false });
      const positioned: PositionedText[] = content.items
        .filter((item): item is typeof item & { str: string; transform: number[]; width: number } => "str" in item && typeof item.str === "string")
        .map((item) => ({ text: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, width: item.width ?? 0 }))
        .filter((item) => item.text.trim().length > 0);

      const groups: Array<{ y: number; items: PositionedText[] }> = [];
      for (const item of [...positioned].sort((first, second) => second.y - first.y || first.x - second.x)) {
        const group = groups.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
        if (group) group.items.push(item);
        else groups.push({ y: item.y, items: [item] });
      }
      const pageLines = groups
        .sort((first, second) => second.y - first.y)
        .map((group) => ({ text: joinText(group.items), x: Math.min(...group.items.map((item) => item.x)), y: group.y }))
        .filter((line) => line.text.length > 0);

      let pageCharacters = 0;
      for (const [lineIndex, line] of pageLines.entries()) {
        pageCharacters += line.text.length;
        if (pageCharacters > 100_000) {
          warnings.push(`Page ${pageNumber} text was truncated at 100,000 characters.`);
          break;
        }
        lines.push({ page: pageNumber, line: lineIndex + 1, text: line.text, x: line.x, y: line.y });
      }
      page.cleanup();
    }
    await document.destroy();
    if (!lines.length) warnings.push("No searchable PDF text layer was found. OCR is not enabled.");
    return { pageCount, lines, warnings };
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    if (error instanceof Error && /password/i.test(`${error.name} ${error.message}`)) throw new Error("Password-protected PDFs are not supported. Remove the password locally or enter the bill manually.");
    if (error instanceof Error) throw error;
    throw new Error("The PDF could not be read in this browser.");
  }
}
