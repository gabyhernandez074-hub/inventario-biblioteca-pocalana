import { createCanvas } from "canvas";
import JsBarcode from "jsbarcode";
import { jsPDF } from "jspdf";
import { randomInt } from "node:crypto";
import readline from "node:readline";
import {
  readFile,
  appendFile,
  writeFile,
} from "node:fs/promises";

// Exact layout from the application.
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

const CELL_WIDTH = 50;
const CELL_HEIGHT = 30;

const COLUMNS = 4;
const ROWS = 9;
const PER_PAGE = COLUMNS * ROWS;

const MARGIN_X = (PAGE_WIDTH - COLUMNS * CELL_WIDTH) / 2;
const MARGIN_Y = (PAGE_HEIGHT - ROWS * CELL_HEIGHT) / 2;

// Exact values used by PrintCodes.tsx.
const IMAGE_X_OFFSET = 5;
const IMAGE_Y_OFFSET = 5;
const IMAGE_WIDTH = 40;
const IMAGE_HEIGHT = 20;

function ask(question) {
  const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    input.question(question, (answer) => {
      input.close();
      resolve(answer);
    });
  });
}

function createUniqueCode(existing) {
  let code;

  do {
    code = `PCL${randomInt(100000000, 1000000000)}`;
  } while (existing.has(code));

  existing.add(code);
  return code;
}

function createBarcodeDataUrl(code) {
  // JsBarcode requires a canvas. node-canvas provides the same canvas
  // functionality used by the browser version of the application.
  const canvas = createCanvas(1000, 300);

  JsBarcode(canvas, code, {
    format: "CODE128",
    displayValue: true,
    font: "monospace",
    fontOptions: "",
    fontSize: 25,
    text: code,
    textAlign: "center",
    textPosition: "bottom",
    textMargin: 2,
    height: 110,
    width: 2.4,
    margin: 6,
  });

  return canvas.toDataURL("image/png");
}

function createPdf(codes, outputFile) {
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  codes.forEach((code, index) => {
    const positionOnPage = index % PER_PAGE;

    if (index > 0 && positionOnPage === 0) {
      pdf.addPage();
    }

    const column = positionOnPage % COLUMNS;
    const row = Math.floor(positionOnPage / COLUMNS);

    // Exact coordinates from the React application:
    //
    // const x = MARGIN_X + col * CELL_W + 5;
    // const y = MARGIN_Y + row * CELL_H + 5;
    const x = MARGIN_X + column * CELL_WIDTH + IMAGE_X_OFFSET;
    const y = MARGIN_Y + row * CELL_HEIGHT + IMAGE_Y_OFFSET;

    const barcodeImage = createBarcodeDataUrl(code);

    // Exact dimensions from the application:
    //
    // doc.addImage(barcodeDataUrl(code), "PNG", x, y, 40, 20);
    pdf.addImage(
      barcodeImage,
      "PNG",
      x,
      y,
      IMAGE_WIDTH,
      IMAGE_HEIGHT,
    );
  });

  pdf.save(outputFile);
}

const amountText = process.argv[2] ?? await ask(
  "How many unique barcodes do you want? ",
);

const amount = Number.parseInt(amountText, 10);

if (!Number.isInteger(amount) || amount < 1) {
  console.error("Enter a whole number greater than zero.");
  process.exit(1);
}


const usedCodesFile = "codigos_pocalana_usados.txt";

const usedCodesText = await readFile(usedCodesFile, "utf8");

const existingCodes = new Set(
  usedCodesText
    .split(/\r?\n/)
    .map((code) => code.trim())
    .filter(Boolean),
);

const codes = [];

for (let index = 0; index < amount; index += 1) {
  codes.push(createUniqueCode(existingCodes));
}

const pdfFile = process.argv[3] ?? "codigos_pocalana_exactos2.pdf";
const codesFile = process.argv[4] ?? "codigos_pocalana_exactos2.txt";

createPdf(codes, pdfFile);

await appendFile(
  usedCodesFile,
  `${codes.join("\n")}\n`,
  "utf8",
);

await writeFile(
  codesFile,
  `${codes.join("\n")}\n`,
  "utf8",
);

console.log(`Created PDF: ${pdfFile}`);
console.log(`Created codes file: ${codesFile}`);
console.log(`Generated codes: ${codes.length}`);
console.log(`Layout: ${COLUMNS} columns x ${ROWS} rows`);
console.log(`Barcodes per page: ${PER_PAGE}`);