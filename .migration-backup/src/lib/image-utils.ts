/** Convert an image File to optimized WebP (or JPEG fallback) for storage */
export const convertToWebP = (file: File, maxDim = 1200, quality = 0.8): Promise<{ blob: Blob; ext: string }> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxDim) { h = Math.round((maxDim / w) * h); w = maxDim; } }
      else { if (h > maxDim) { w = Math.round((maxDim / h) * w); h = maxDim; } }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, w, h);

      // Try WebP first, fall back to JPEG
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, ext: "webp" });
          } else {
            // WebP not supported, fallback to JPEG
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) resolve({ blob: jpegBlob, ext: "jpg" });
                else reject(new Error("Image conversion failed"));
              },
              "image/jpeg",
              quality
            );
          }
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
