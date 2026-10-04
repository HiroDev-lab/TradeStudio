// Extração de texto de PDF no navegador. Carregado sob demanda (import
// dinâmico) porque a biblioteca é grande e só é usada ao anexar um PDF.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Devolve o texto do PDF. Vazio quando o arquivo é só imagem (digitalizado). */
export async function extractPdfText(file: File): Promise<string> {
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
      .join("");
    if (text.trim()) pages.push(text.trim());
  }

  await loadingTask.destroy();
  return pages.join("\n\n");
}
