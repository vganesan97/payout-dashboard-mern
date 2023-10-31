import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from '@mui/material';  // Importing Button component from Material-UI

const ReportsDownload = () => {
    const [fileIds, setFileIds] = useState([]);
    const [selectedFileId, setSelectedFileId] = useState("");

    async function fetchFileIds() {
        try {
            const response = await axios.get('http://localhost:5000/uniqueFileIds');
            return response.data.uniqueFileIds;
        } catch (error) {
            console.error('An error occurred while fetching file IDs:', error);
            return [];
        }
    }

    useEffect(() => {
        fetchFileIds().then((ids) => setFileIds(ids));
    }, []);

    const handleChange = (e) => {
        setSelectedFileId(e.target.value);
    };

    const sourceReport = async () => {
        if (!selectedFileId) {
            console.error("No file ID selected");
            return;
        }
        try {
            const response = await axios.get(`http://localhost:5000/totalFundsPerSource/${selectedFileId}`);
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `SourceReport${selectedFileId}.csv`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(`An error occurred while generating report: ${sourceReport}`, error);
        }
    };

    const dunkinBranchReport = async () => {
        if (!selectedFileId) {
            console.error("No file ID selected");
            return;
        }
        try {
            const response = await axios.get(`http://localhost:5000/dunkinBranchReport/${selectedFileId}`);
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `DunkinBranchReport_${selectedFileId}.csv`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(`An error occurred while generating report: ${dunkinBranchReport}`, error);
        }
    };

    const paymentsReport = async () => {
        if (!selectedFileId) {
            console.error("No file ID selected");
            return;
        }
        try {
            const response = await axios.get(`http://localhost:5000/paymentsReport/${selectedFileId}`);
            console.log(response.headers)
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `PaymentsReport${selectedFileId}.csv`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error(`An error occurred while generating report: ${paymentsReport}`, error);
        }
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
            <div>
                <Button variant="contained" color="secondary" onClick={sourceReport}>
                    Source Account Report
                </Button>
                <Button variant="contained" color="secondary" onClick={dunkinBranchReport}>
                    Dunkin Branch Report
                </Button>
                <Button variant="contained" color="secondary" onClick={paymentsReport}>
                    Payments Report
                </Button>
            </div>
        </div>
    );
};

export default ReportsDownload;
