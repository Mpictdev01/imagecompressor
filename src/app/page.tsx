"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, X, Film, Image as ImageIcon, FileText, Settings, Moon, Sun } from "lucide-react";
import { useFFmpeg } from "@/hooks/useFFmpeg";

import { processImage } from "@/utils/imageProcessor";

export default function Home() {
  const [activeTab, setActiveTab] = useState("image");
  const [isDark, setIsDark] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Shared State
  const [format, setFormat] = useState("original");

  // Image Settings State
  const [imageQuality, setImageQuality] = useState("medium");
  const [imageMethod, setImageMethod] = useState("lossy");
  const [imageResize, setImageResize] = useState("original");

  // Video Settings State
  const [videoBitrate, setVideoBitrate] = useState("medium");
  const [videoCodec, setVideoCodec] = useState("h264");
  const [videoResolution, setVideoResolution] = useState("original");
  const [videoFps, setVideoFps] = useState("30");

  // GIF Settings State
  const [gifOptimization, setGifOptimization] = useState("2");
  const [gifColors, setGifColors] = useState("128");
  const [gifResize, setGifResize] = useState("original");

  const [results, setResults] = useState<{name: string, url: string}[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loaded, load, isLoading, progress, progressText, processVideo } = useFFmpeg();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
    load();
  }, [load]);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", !isDark ? "dark" : "light");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...droppedFiles]);
      
      const firstType = droppedFiles[0].type;
      if (firstType.startsWith("image/gif")) setActiveTab("gif");
      else if (firstType.startsWith("video/")) setActiveTab("video");
      else if (firstType.startsWith("image/")) setActiveTab("image");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("video/")) return <Film className="text-blue-500" />;
    if (fileType.startsWith("image/gif")) return <Film className="text-purple-500" />;
    if (fileType.startsWith("image/")) return <ImageIcon className="text-green-500" />;
    return <FileText className="text-gray-500" />;
  };

  const handleProcess = async () => {
    if (!loaded && (activeTab === "video" || activeTab === "gif")) return;
    setResults([]);
    
    const newResults = [];
    for (const file of files) {
      try {
        if (activeTab === "video" || activeTab === "gif") {
           // We map the unified options to pass to useFFmpeg
           const options = { 
               type: activeTab, 
               format,
               bitrate: videoBitrate,
               codec: videoCodec,
               resolution: videoResolution,
               fps: videoFps,
               gifOptimization,
               gifColors,
               gifResize 
           };
           const result = await processVideo(file, options);
           newResults.push({ name: result.fileName, url: result.url });
        } else if (activeTab === "image") {
           const result = await processImage(file, { quality: imageQuality, format: format, resize: imageResize, method: imageMethod });
           newResults.push({ name: result.fileName, url: result.url });
        }
      } catch (err: any) {
        console.error("Processing failed for", file.name, err);
        if (err?.message?.includes('out of bounds') || String(err).includes('out of bounds')) {
            alert(`Memory limit reached while processing ${file.name}. \n\nThe video is too large to process in the browser at this resolution. Try selecting '480p' resolution or refreshing the page to clear memory.`);
        } else {
            alert(`Failed to process ${file.name}. Please try again.`);
        }
      }
    }
    setResults(newResults);
  };

  const handleDownloadAll = async () => {
    if (results.length === 0) return;
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Fetch each blob from its object URL and add to zip
      for (const res of results) {
        const response = await fetch(res.url);
        const blob = await response.blob();
        zip.file(res.name, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);

      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = `flatyfoos_compressed_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(zipUrl);
    } catch (err) {
      console.error("Failed to create ZIP archive:", err);
      alert("Terdapat error saat mencoba membuat file ZIP.");
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] text-gray-100 transition-colors duration-200">
      <header className="bg-[#1f2937] shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Flatyfoos Logo" className="w-10 h-10 md:w-12 md:h-12 object-contain" />
              <h1 className="text-xl md:text-2xl font-bold text-white">Flatyfoos Web Compressor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={toggleTheme} className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-white hidden">
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!loaded && (
           <div className="mb-8 p-4 bg-yellow-900/30 text-yellow-200 rounded-lg border border-yellow-800">
              Initializing WebAssembly Engine... Please wait.
           </div>
        )}
        
        <div className="mb-8">
          <nav className="flex space-x-1 bg-gray-800 p-1 rounded-lg w-fit">
            <button onClick={() => {setActiveTab("image"); setFormat("original");}} className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === "image" ? "bg-gray-700 shadow text-blue-400" : "hover:bg-gray-700 text-gray-400"}`}><ImageIcon size={18} /> Compress Images</button>
            <button onClick={() => {setActiveTab("video"); setFormat("original");}} className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === "video" ? "bg-gray-700 shadow text-blue-400" : "hover:bg-gray-700 text-gray-400"}`}><Film size={18} /> Videos</button>
            <button onClick={() => {setActiveTab("gif"); setFormat("original");}} className={`px-6 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === "gif" ? "bg-gray-700 shadow text-blue-400" : "hover:bg-gray-700 text-gray-400"}`}><Film size={18} /> GIFs</button> 
          </nav>
        </div>

        <div className="mb-8 relative">
          {activeTab !== "image" && (
             <div className="absolute inset-0 z-10 bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-700 flex flex-col items-center justify-center p-6 text-center">
                <Film className="h-12 w-12 text-blue-400 mb-3" />
                <h2 className="text-xl font-bold text-white mb-2">Desktop Version Only</h2>
                <p className="text-gray-300 max-w-lg mb-4">
                  Video and GIF compression features are disabled in the web version due to browser memory limits. 
                  <br/>Please download the <strong className="text-blue-400">Flatyfoos Desktop Application</strong> to compress heavy videos without limits!
                </p>
             </div>
          )}
          
          <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => activeTab === 'image' ? fileInputRef.current?.click() : null} className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors flex flex-col items-center justify-center gap-4 ${isDragging ? "border-blue-500 bg-blue-900/20" : "border-gray-600 hover:border-blue-500"} ${activeTab !== 'image' ? "opacity-30 pointer-events-none" : "cursor-pointer"}`}>
            <UploadCloud className={`h-16 w-16 ${isDragging ? "text-blue-500" : "text-gray-400"}`} />
            <div>
              <p className="text-xl font-medium text-white mb-2">Drop image files here or click to browse</p>
              <p className="text-sm text-gray-400">Support for JPG, PNG, WebP, AVIF files</p>
            </div>
            <button className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors">Browse Images</button>
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" multiple onChange={handleFileSelect}/>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-4 text-white">Selected Files ({files.length})</h3>
            <div className="space-y-2">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-sm">
                  <div className="flex items-center gap-4">
                    {getFileIcon(file.type)}
                    <div>
                      <p className="font-medium text-sm text-gray-200 truncate max-w-[200px] md:max-w-md">{file.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="text-red-500 hover:text-red-400 p-2 rounded-full hover:bg-red-900/20"><X size={20} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 ${activeTab !== 'image' ? "opacity-40 pointer-events-none grayscale" : ""}`}>
          {/* Settings Left Column */}
          <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
            <h3 className="text-lg font-medium mb-6 text-white">{activeTab === 'image' ? 'Compression' : activeTab === 'video' ? 'Video Compression' : 'GIF Optimization'} Settings</h3>
            
            {activeTab === 'image' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Quality</label>
                  <select value={imageQuality} onChange={(e) => setImageQuality(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="low">Low (30%)</option>
                    <option value="medium">Medium (60%)</option>
                    <option value="high">High (80%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Compression Method</label>
                  <select value={imageMethod} onChange={(e) => setImageMethod(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="lossy">Lossy (smaller size)</option>
                    <option value="lossless">Lossless (better quality)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Bitrate</label>
                  <select value={videoBitrate} onChange={(e) => setVideoBitrate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="low">Low (500 kbps)</option>
                    <option value="medium">Medium (1500 kbps)</option>
                    <option value="high">High (3000 kbps)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Codec</label>
                  <select value={videoCodec} onChange={(e) => setVideoCodec(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="h264">H.264</option>
                    <option value="webm">WebM (VP9)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'gif' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Optimization Level</label>
                  <select value={gifOptimization} onChange={(e) => setGifOptimization(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="1">Level 1 (Light)</option>
                    <option value="2">Level 2 (Medium)</option>
                    <option value="3">Level 3 (Aggressive)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Color Palette</label>
                  <select value={gifColors} onChange={(e) => setGifColors(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="256">256 colors</option>
                    <option value="128">128 colors</option>
                    <option value="64">64 colors</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Settings Right Column */}
          <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-6">
            <h3 className="text-lg font-medium mb-6 text-white">{activeTab === 'image' ? 'Conversion' : activeTab === 'video' ? 'Video Conversion' : 'GIF Conversion'} Settings</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Output Format</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="original">Keep Original</option>
                  {activeTab === 'image' && <><option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option><option value="avif">AVIF</option></>}
                  {activeTab === 'video' && <><option value="mp4">MP4</option><option value="webm">WebM</option><option value="mov">MOV</option><option value="mkv">MKV</option></>}
                  {activeTab === 'gif' && <><option value="gif">Keep as GIF</option><option value="webp">Convert to WebP</option></>}
                </select>
              </div>

              {activeTab === 'video' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Resolution</label>
                    <select value={videoResolution} onChange={(e) => setVideoResolution(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="original">Keep Original</option>
                      <option value="1080p">1080p</option>
                      <option value="720p">720p</option>
                      <option value="480p">480p</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Frame Rate</label>
                    <select value={videoFps} onChange={(e) => setVideoFps(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="original">Keep Original</option>
                      <option value="60">60 fps</option>
                      <option value="30">30 fps</option>
                      <option value="24">24 fps</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Resize</label>
                  <select value={activeTab === 'image' ? imageResize : gifResize} onChange={(e) => activeTab === 'image' ? setImageResize(e.target.value) : setGifResize(e.target.value)} className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="original">Keep Original Size</option>
                    {activeTab === 'image' ? (
                        <>
                            <option value="instagram">Instagram (1080x1080)</option>
                            <option value="thumbnail">Thumbnail (320x180)</option>
                        </>
                    ) : (
                        <>
                            <option value="medium">Medium (640x480)</option>
                            <option value="small">Small (320x240)</option>
                        </>
                    )}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {progress > 0 && progress < 100 && (
           <div className="mb-8 p-6 bg-blue-900/20 border border-blue-800 rounded-lg">
              <div className="flex justify-between mb-3">
                 <span className="font-medium text-blue-200">{progressText}</span>
                 <span className="text-blue-200">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                 <div className="bg-blue-500 h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
           </div>
        )}

        {results.length > 0 && (
          <div className="mb-8 p-6 bg-green-900/20 border border-green-800 rounded-lg">
             <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-medium text-green-400">Processing Results</h3>
                 {results.length > 1 && (
                    <button onClick={handleDownloadAll} className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition-colors shadow">
                        Download All (ZIP)
                    </button>
                 )}
             </div>
             <div className="space-y-3">
                {results.map((res, i) => (
                   <div key={i} className="flex justify-between items-center p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-sm">
                      <span className="text-gray-200 truncate pr-4">{res.name}</span>
                      <a href={res.url} download={res.name} className="px-5 py-2 whitespace-nowrap bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors">
                         Download
                      </a>
                   </div>
                ))}
             </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-end border-t border-gray-700 pt-8">
          <button onClick={() => { setFiles([]); setResults([]); }} disabled={files.length === 0} className="w-full sm:w-auto px-8 py-3 border border-gray-600 text-gray-300 font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
            Clear All
          </button>
          <button onClick={handleProcess} disabled={files.length === 0 || (activeTab !== "image" && !loaded) || (progress > 0 && progress < 100)} className="w-full sm:w-auto flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-12 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center gap-2">
            Process Files
          </button>
        </div>
      </main>
    </div>
  );
}
