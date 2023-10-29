import React, { useRef } from 'react';
import axios from 'axios';

const FileUpload = () => {
    const fileInput = useRef(null);

    const CHUNK_SIZE = 1024 * 1024; // 1MB

    const handleUpload = async () => {
        const file = fileInput.current.files[0];
        if (!file) {
            return;
        }

        let start = 0;
        const totalSize = file.size;

        while (start < totalSize) {
            const end = Math.min(start + CHUNK_SIZE, totalSize);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('file', chunk);

            await axios.post('http://localhost:5000/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            start = end;
        }
    };

    return (
        <div>
            <input type="file" ref={fileInput} />
            <button onClick={handleUpload}>Upload</button>
        </div>
    );
};

export default FileUpload;
