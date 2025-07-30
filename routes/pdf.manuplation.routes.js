const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Use /tmp for ephemeral safe deployment
const upload = multer({ dest: '/tmp' });

const deleteFiles = (...files) => {
    files.forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlink(file, (err) => {
                if (err) console.error(`Failed to delete ${file}:`, err);
            });
        }
    });
};

// Convert Images to PDF
router.post('/imgtopdf', upload.array("images"), async (req, res) => {
    try {
        const { paperSize = "A4", orientation = "portrait" } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No images uploaded" });
        }

        // Define paper size dimensions (in points)
        const paperSizes = {
            A4: { portrait: [595.28, 841.89], landscape: [841.89, 595.28] },
            Letter: { portrait: [612, 792], landscape: [792, 612] }
        };

        const dimensions = paperSizes[paperSize]?.[orientation];
        if (!dimensions) {
            return res.status(400).json({ error: "Invalid paper size or orientation" });
        }

        const [pageWidth, pageHeight] = dimensions;
        const pdfDoc = await PDFDocument.create();

        for (const file of req.files) {
            try {
                const imageBytes = fs.readFileSync(file.path);

                if (file.size === 0 || !imageBytes) {
                    console.warn(`Skipped invalid/empty file: ${file.originalname}`);
                    continue;
                }

                let image;
                if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
                    if (imageBytes[0] !== 0xFF || imageBytes[1] !== 0xD8) {
                        console.warn(`Invalid JPEG file: ${file.originalname}`);
                        continue;
                    }
                    image = await pdfDoc.embedJpg(imageBytes);
                } else if (file.mimetype === "image/png") {
                    image = await pdfDoc.embedPng(imageBytes);
                } else {
                    console.warn(`Unsupported format: ${file.originalname}`);
                    continue;
                }

                const imgDims = image.scale(1);
                let scale = Math.min(pageWidth / imgDims.width, pageHeight / imgDims.height);
                const scaledWidth = imgDims.width * scale;
                const scaledHeight = imgDims.height * scale;

                const x = (pageWidth - scaledWidth) / 2;
                const y = (pageHeight - scaledHeight) / 2;

                const page = pdfDoc.addPage([pageWidth, pageHeight]);
                page.drawImage(image, {
                    x,
                    y,
                    width: scaledWidth,
                    height: scaledHeight
                });
            } catch (imgErr) {
                console.error(`Failed to embed image: ${file.originalname}`, imgErr);
                continue;
            }
        }


        const pdfBytes = await pdfDoc.save();
        const pdfPath = `/tmp/converted-${uuidv4()}.pdf`;
        fs.writeFileSync(pdfPath, pdfBytes);

        res.download(pdfPath, (err) => {
            if (err) {
                console.error("Error downloading PDF:", err);
                return res.status(500).json({ error: "Failed to download PDF" });
            }

            res.on("finish", () => {
                deleteFiles(...req.files.map(f => f.path), pdfPath);
            });
        });

    } catch (err) {
        console.error("Error during PDF creation:", err);
        res.status(500).json({ error: "Server error while creating PDF" });
    }
});


// Split PDF
router.post('/split-pdf', upload.single("pdf"), async (req, res) => {
    try {
        const { pages } = req.body;
        if (!pages) return res.status(400).json({ error: "Please provide page numbers" });

        const pdfBytes = fs.readFileSync(req.file.path);
        const originalPdf = await PDFDocument.load(pdfBytes);
        const newPdf = await PDFDocument.create();

        const pageIndices = pages.split(",").flatMap(part => {
            if (part.includes("-")) {
                const [start, end] = part.split("-").map(Number);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i - 1);
            }
            return [Number(part) - 1];
        });

        const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const splitPdfBytes = await newPdf.save();
        const splitPdfPath = `/tmp/split-${uuidv4()}.pdf`;
        fs.writeFileSync(splitPdfPath, splitPdfBytes);

        res.download(splitPdfPath, (err) => {
            if (err) {
                console.error("Download error:", err);
                return res.status(500).json({ error: "Download failed" });
            }

            res.on("finish", () => {
                deleteFiles(req.file.path, splitPdfPath);
            });
        });

    } catch (err) {
        console.error("Split error:", err);
        res.status(500).json({ error: "Failed to split PDF" });
    }
});


// Merge PDFs





router.post('/merge-pdfs', upload.array("pdfs"), async (req, res) => {
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    try {
        const mergedPdf = await PDFDocument.create();

        for (const file of req.files) {
            const pdfBytes = fs.readFileSync(file.path);
            const doc = await PDFDocument.load(pdfBytes);
            const pages = await doc.getPages();

            for (const page of pages) {
                const [w, h] = page.getSize();
                const copiedPage = await mergedPdf.embedPage(page);

                const scale = Math.min(A4_WIDTH / w, A4_HEIGHT / h);
                const scaledWidth = w * scale;
                const scaledHeight = h * scale;

                const newPage = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);
                newPage.drawPage(copiedPage, {
                    x: (A4_WIDTH - scaledWidth) / 2,
                    y: (A4_HEIGHT - scaledHeight) / 2,
                    width: scaledWidth,
                    height: scaledHeight,
                });
            }
        }

        const mergedPdfBytes = await mergedPdf.save();
        const mergedPdfPath = `/tmp/merged-${uuidv4()}.pdf`;
        fs.writeFileSync(mergedPdfPath, mergedPdfBytes);

        res.download(mergedPdfPath, (err) => {
            if (err) {
                console.error("Error downloading merged PDF:", err);
                return res.status(500).json({ error: "Download failed" });
            }

            res.on("finish", () => {
                deleteFiles(...req.files.map(f => f.path), mergedPdfPath);
            });
        });

    } catch (err) {
        console.error("Merge error:", err);
        res.status(500).json({ error: "Failed to merge PDFs" });
    }
});


module.exports = router;
