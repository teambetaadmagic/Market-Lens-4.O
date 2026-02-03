// Client-side Perceptual Block Hash (16x16)
export const computeImageHash = (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const size = 16;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve('');
        return;
      }

      // Draw image resized to 16x16
      ctx.drawImage(img, 0, 0, size, size);
      
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      const grays: number[] = [];
      let total = 0;

      // Convert to grayscale and calculate sum
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        grays.push(avg);
        total += avg;
      }

      const mean = total / grays.length;
      
      // Create binary string (1 if > mean, 0 otherwise) then convert to hex
      let binaryStr = "";
      for (let i = 0; i < grays.length; i++) {
        binaryStr += (grays[i] >= mean ? "1" : "0");
      }
      
      // Convert binary string to hex for compact storage
      let hexHash = "";
      for (let i = 0; i < binaryStr.length; i += 4) {
        const decimal = parseInt(binaryStr.substring(i, i + 4), 2);
        hexHash += decimal.toString(16);
      }

      resolve(hexHash);
    };
    img.onerror = (e) => {
      console.error("Image hash error", e);
      resolve('');
    };
    img.src = base64Image;
  });
};

// Compress image for Database Storage
// Logic: Preserve aspect ratio + Resize proportionally + Optimize quality
export const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 500; // Maximum dimension for Database efficiency

      // Preserve original aspect ratio
      const aspect = img.width / img.height;
      let canvasWidth = MAX_SIZE;
      let canvasHeight = MAX_SIZE;
      
      if (aspect > 1) { // Landscape
        canvasHeight = Math.round(canvasWidth / aspect);
      } else { // Portrait
        canvasWidth = Math.round(canvasHeight * aspect);
      }

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      // Draw full image maintaining aspect ratio
      ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvasWidth, canvasHeight);
      
      // Return optimized JPEG preserving format (0.7 quality for good balance)
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64Str); // Fail safe
  });
};
