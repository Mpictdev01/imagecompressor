import imageCompression from 'browser-image-compression';

// Helper function to convert image format using Canvas API
async function convertFormatWithCanvas(file: File, type: string, quality: number): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }
            
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                    const newFileName = file.name.replace(/\.[^/.]+$/, "") + `.${type.split('/')[1]}`;
                    resolve(new File([blob], newFileName, { type }));
                } else {
                    reject(new Error("Canvas toBlob failed"));
                }
            }, type, quality);
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image for conversion"));
        };
        
        img.src = url;
    });
}

export async function processImage(file: File, options: { quality: string, format: string, resize?: string, method?: string }) {
    // Quality mapping based on user selection
    let maxMB = 1;
    let maxWidthOrHeight = 1920;
    let canvasQuality = 0.8;

    switch (options.quality) {
        case 'low':
            maxMB = 0.5;
            canvasQuality = 0.5;
            break;
        case 'medium':
            maxMB = 2;
            canvasQuality = 0.8;
            break;
        case 'high':
            maxMB = 5;
            canvasQuality = 1.0;
            break;
    }
    
    // Resize mapping
    if (options.resize === 'instagram') {
        maxWidthOrHeight = 1080;
    } else if (options.resize === 'thumbnail') {
        maxWidthOrHeight = 320;
    } else {
         // Keep Original, still bounded slightly upper to prevent huge memory spikes
         maxWidthOrHeight = 4096;
    }

    const targetExt = options.format === 'original' ? (file.name.split('.').pop() || 'jpg').toLowerCase() : options.format.toLowerCase();
    
    // Map extensions to mime types
    const mimeMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'avif': 'image/avif'
    };
    
    const outputType = mimeMap[targetExt] || file.type;

    const compressionOptions = {
        maxSizeMB: maxMB,
        maxWidthOrHeight: maxWidthOrHeight,
        useWebWorker: true,
        fileType: outputType as any
    };

    try {
        let compressedFile = await imageCompression(file, compressionOptions);
        
        // browser-image-compression sometimes ignores the fileType option if it doesn't support it 
        // completely in web workers (like AVIF depending on browser). 
        // Check if the output type matches what we requested
        if (compressedFile.type !== outputType && outputType !== 'image/original') {
             console.log(`Fallback conversion: expected ${outputType} but got ${compressedFile.type}`);
             try {
                // If it fails to match the type, use Canvas to force the format conversion
                compressedFile = await convertFormatWithCanvas(compressedFile, outputType, canvasQuality);
             } catch (fallbackError) {
                console.warn("Canvas fallback conversion failed:", fallbackError);
             }
        }

        const url = URL.createObjectURL(compressedFile);
        
        return {
            url,
            fileName: file.name.replace(/\.[^/.]+$/, "") + `_compressed.${targetExt}`
        };
    } catch (error) {
        console.error("Image compression error:", error);
        throw error;
    }
}
