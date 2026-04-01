import { useState, useRef } from "react";

export default function ImageUpload({ images, existingImages, onImagesChange, onExistingImagesChange }) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/")
      );
      onImagesChange([...images, ...newFiles]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).filter((file) =>
        file.type.startsWith("image/")
      );
      onImagesChange([...images, ...newFiles]);
    }
  };

  const removeImage = (index) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index) => {
    onExistingImagesChange(existingImages.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700">Product Images</label>

      {existingImages.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Existing Images:</p>
          <div className="grid grid-cols-4 gap-3">
            {existingImages.map((url, index) => (
              <div key={index} className="relative group">
                <img
                  src={url}
                  alt={`Existing ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeExistingImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
          dragActive
            ? "border-pink-500 bg-pink-50"
            : "border-gray-300 hover:border-pink-400 bg-gray-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        <div className="text-2xl mb-3">📸</div>
        <p className="text-gray-600 mb-2">
          Drag and drop images here, or{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-pink-600 hover:text-pink-700 underline font-semibold"
          >
            browse
          </button>
        </p>
        <p className="text-sm text-gray-500">Supports: JPG, PNG, WebP (Max 5MB each)</p>
      </div>

      {images.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-2">New Images to Upload:</p>
          <div className="grid grid-cols-4 gap-3">
            {images.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border-2 border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
