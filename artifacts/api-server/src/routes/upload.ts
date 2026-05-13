import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function isCloudinaryConfigured(): boolean {
  return !!(
    process.env["CLOUDINARY_URL"] ||
    (process.env["CLOUDINARY_CLOUD_NAME"] && process.env["CLOUDINARY_API_KEY"] && process.env["CLOUDINARY_API_SECRET"])
  );
}

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

function saveBufferLocally(buffer: Buffer, mimeType: string): string {
  const uploadsDir = path.resolve("./uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return `/api/uploads/${filename}`;
}

router.post("/media", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const useCloudinary = isCloudinaryConfigured();

    if (req.file) {
      const url = useCloudinary
        ? await uploadBufferToCloudinary(req.file.buffer)
        : saveBufferLocally(req.file.buffer, req.file.mimetype);
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
    const mimeType = match[1]!;
    const url = useCloudinary
      ? await uploadBufferToCloudinary(buffer)
      : saveBufferLocally(buffer, mimeType);
    res.json({ url });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
