
import React, { useRef } from 'react';

interface ImageUploadProps {
  label: string;
  value: string; // The base64 data URL or a regular URL
  onChange: (value: string) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ label, value, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
          alert("File is too large. Please select an image under 2MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="mt-1 flex items-center space-x-4">
        <div className="flex-shrink-0 h-20 w-20 rounded-md bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-600">
          {value ? (
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-gray-400 px-2 text-center">No Image</span>
          )}
        </div>
        <div className="flex flex-col space-y-2">
          <input
            type="file"
            accept="image/png, image/jpeg, image/gif, image/svg+xml"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            aria-label={`Upload ${label}`}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Upload
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-2 border border-transparent rounded-md text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
