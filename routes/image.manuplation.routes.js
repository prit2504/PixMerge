const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const router = express.Router();

// Use in-memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ======= Image Compression =======

router.post('/compress', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

        const quality = parseInt(req.body.quality);
        if (isNaN(quality) || quality < 10 || quality > 100) {
            return res.status(400).json({ error: 'Invalid quality value (10-100)' });
        }

        const ext = req.file.originalname.split('.').pop().toLowerCase();
        let format = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';

        const buffer = await sharp(req.file.buffer)[format]({ quality }).toBuffer();

        res.set({
            'Content-Type': `image/${format}`,
            'Content-Disposition': `attachment; filename=compressed.${format}`
        });
        res.send(buffer);

    } catch (err) {
        console.error('Compression error:', err);
        res.status(500).json({ error: 'Internal server error during compression' });
    }
});

// ======= Image Format Conversion =======

router.post('/convert', upload.single('image'), async (req, res) => {
    try {
        const { format } = req.body;
        const validFormats = ['jpeg', 'jpg', 'png', 'webp'];

        if (!req.file || !validFormats.includes(format)) {
            return res.status(400).json({ error: 'Invalid file or format' });
        }

        const buffer = await sharp(req.file.buffer).toFormat(format).toBuffer();

        res.set({
            'Content-Type': `image/${format}`,
            'Content-Disposition': `attachment; filename=converted.${format}`
        });
        res.send(buffer);

    } catch (err) {
        console.error('Conversion error:', err);
        res.status(500).json({ error: 'Internal server error during conversion' });
    }
});

module.exports = router;
