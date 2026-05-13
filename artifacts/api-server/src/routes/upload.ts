import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Readable } from "stream";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function uploadBufferToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", folder: "raperr" },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve(result.secure_url);
      },
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

router.post("/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (req.file) {
      const url = await uploadBufferToCloudinary(req.file.buffer);
      res.json({ url });
      return;
    }

    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl) {
      res.status(400).json({ error: "No file or dataUrl provided" });
      return;
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      res.json({ url: dataUrl });
      return;
    }

    const buffer = Buffer.from(match[2]!, "base64");
    const url = await uploadBufferToCloudinary(buffer);
    res.json({ url });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;