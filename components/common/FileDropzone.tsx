import React, { useState, useCallback } from 'react';
import { UploadIcon } from '../icons/Icons';


interface FileDropzoneProps {
    onFileDrop: (file: File) => void;
    isLoading?: boolean;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileDrop, isLoading }) => {
    const [isDragActive, setIsDragActive] = useState(false);
    const [fileName, setFileName] = useState('');

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoading) return;
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragActive(true);
        } else if (e.type === 'dragleave') {
            setIsDragActive(false);
        }
    }, [isLoading]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        if (isLoading) return;
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFileName(e.dataTransfer.files[0].name);
            onFileDrop(e.dataTransfer.files[0]);
        }
    }, [onFileDrop, isLoading]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isLoading) return;
        if (e.target.files && e.target.files[0]) {
            setFileName(e.target.files[0].name);
            onFileDrop(e.target.files[0]);
        }
    }

    return (
        <label 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`flex justify-center items-center w-full h-32 px-4 transition bg-white border-2 ${isDragActive ? 'border-sarp-blue' : 'border-gray-300'} border-dashed rounded-md appearance-none ${isLoading ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer hover:border-gray-400'} focus:outline-none`}
        >
            {isLoading ? (
                <span className="flex items-center space-x-2 text-sarp-gray">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Procesando archivo...</span>
                </span>
            ) : (
                <span className="flex items-center space-x-2 text-center">
                    <UploadIcon/>
                    <span className="font-medium text-gray-600">
                    {fileName ? fileName : <>Arrastra un archivo CSV/XLSX o <span className="text-sarp-blue underline">búscalo aquí</span></>}
                    </span>
                </span>
            )}
            <input type="file" name="file_upload" className="hidden" accept=".csv,.xlsx" onChange={handleChange} disabled={isLoading} />
        </label>
    );
};

export default FileDropzone;