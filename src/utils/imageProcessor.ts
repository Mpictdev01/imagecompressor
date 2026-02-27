import imageCompression from 'browser-image-compression';

export async function processImage(file: File, options: { quality: string, format: string, resize?: string, method?: string }) {
    // Quality mapping based on user selection
    let maxMB = 1;
    let maxWidthOrHeight = 1920;

    switch (options.quality) {
        case 'low':
            maxMB = 0.5;
            break;
        case 'medium':
            maxMB = 2;
            break;
        case 'high':
            maxMB = 5;
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

    const outputType = options.format !== 'original' ? `image/${options.format}` : file.type;

    const compressionOptions = {
        maxSizeMB: maxMB,
        maxWidthOrHeight: maxWidthOrHeight,
        useWebWorker: true,
        fileType: outputType as any
    };

    try {
        const compressedFile = await imageCompression(file, compressionOptions);
        
        let ext = options.format;
        if (ext === 'original') {
            ext = file.name.split('.').pop() || 'jpg';
        }

        const url = URL.createObjectURL(compressedFile);
        
        return {
            url,
            fileName: file.name.replace(/\.[^/.]+$/, "") + `_compressed.${ext}`
        };
    } catch (error) {
        console.error("Image compression error:", error);
        throw error;
    }
}
