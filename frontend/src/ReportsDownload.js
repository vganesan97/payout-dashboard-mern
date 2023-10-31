import React, { useState, useEffect } from "react";
import axios from "axios";

const ReportsDownload = () => {
    const [fileIds, setFileIds] = useState([]);
    const [selectedFileId, setSelectedFileId] = useState("");

    useEffect(() => {
        // Assume fetchFileIds is a function that fetches your file IDs
        fetchFileIds().then((ids) => setFileIds(ids));
    }, []);

    const handleChange = (e) => {
        setSelectedFileId(e.target.value);
    };

    return (
        <div>
            <h1>Reports Download</h1>
            <label htmlFor="fileIdSelect">Select File ID:</label>
            <select id="fileIdSelect" value={selectedFileId} onChange={handleChange}>
                <option value="" disabled>
                    Select an option
                </option>
                {fileIds.map((id, index) => (
                    <option key={index} value={id}>
                        {id}
                    </option>
                ))}
            </select>
        </div>
    );
};

async function fetchFileIds() {
    try {
        const response = await axios.get('http://localhost:5000/unique-file-ids');
        return response.data.uniqueFileIds;
    } catch (error) {
        console.error('An error occurred while fetching file IDs:', error);
        return [];
    }
}


export default ReportsDownload;
