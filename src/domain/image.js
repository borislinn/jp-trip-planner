// Browser-only. Decodes an image File, downscales so the longest edge is
// <= maxPx, and returns a JPEG data URL string (small enough for offline
// storage). Kept out of the ViewModels so they stay Node-testable.
export async function fileToScaledDataURL(file, maxPx = 1600, quality = 0.8) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const image = await decodeImage(file);
  try {
    const sourceWidth = image.width || image.naturalWidth;
    const sourceHeight = image.height || image.naturalHeight;
    const scale = Math.min(1, maxPx / Math.max(sourceWidth, sourceHeight));
    const w = Math.round(sourceWidth * scale);
    const h = Math.round(sourceHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(image, 0, 0, w, h);
    return await canvasToDataURL(canvas, quality);
  } finally {
    image.close?.();
  }
}

function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" })
      .catch(() => decodeWithObjectURL(file));
  }
  return decodeWithObjectURL(file);
}

function decodeWithObjectURL(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the image."));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.src = url;
  });
}

function canvasToDataURL(canvas, quality) {
  if (typeof canvas.toBlob !== "function") {
    return Promise.resolve(canvas.toDataURL("image/jpeg", quality));
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("Could not process the photo."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not process the photo."));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    }, "image/jpeg", quality);
  });
}
