import React, { useRef, useState} from 'react';
import { Box, Typography } from "@mui/material";
import axios from 'axios';
import { CircularProgress } from '@mui/material';
import {
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableContainer,
    TableFooter,
    TablePagination,
    TableRow
} from "@mui/material";
const uuid = require('uuid');

const FileUpload = () => {
    const fileInput = useRef(null);
    const [xmlData, setXmlData] = useState([]);
    const [showTable, setShowTable] = useState(false);
    const [showApproveDecline, setShowApproveDecline] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [approving, setApproving] = useState(false);

    const CHUNK_SIZE = 1024 * 1024; // 1MB

    const handleUpload = async () => {
        setUploading(true);  // Set uploading to true

        const file = fileInput.current.files[0];
        if (!file) {
            console.error("No file selected");
            setUploading(false);  // Set uploading to true

            return;
        }

        // Read the file content
        const fileContent = await file.text();

        // Create a new DOMParser instance
        const parser = new DOMParser();
        // Parse the XML string to a Document object
        const xmlDoc = parser.parseFromString(fileContent, "text/xml");

        // Function to safely get text content from XML nodes
        const getTextContent = (node, tagName) => {
            const element = node.getElementsByTagName(tagName)[0];
            return element ? element.textContent : '';
        };

        // Assume each row is represented as an item in xmlDoc.getElementsByTagName('row')
        const rows = Array.from(xmlDoc.getElementsByTagName('row')).map(row => {
            const employee = row.getElementsByTagName('Employee')[0];
            const payor = row.getElementsByTagName('Payor')[0];
            const payee = row.getElementsByTagName('Payee')[0];
            return {
                Employee: {
                    DunkinId: getTextContent(employee, 'DunkinId'),
                    DunkinBranch: getTextContent(employee, 'DunkinBranch'),
                    FirstName: getTextContent(employee, 'FirstName'),
                    LastName: getTextContent(employee, 'LastName'),
                    DOB: getTextContent(employee, 'DOB'),
                    PhoneNumber: getTextContent(employee, 'PhoneNumber'),
                },
                Payor: {
                    DunkinId: getTextContent(payor, 'DunkinId'),
                    ABARouting: getTextContent(payor, 'ABARouting'),
                    AccountNumber: getTextContent(payor, 'AccountNumber'),
                    Name: getTextContent(payor, 'Name'),
                    DBA: getTextContent(payor, 'DBA'),
                    EIN: getTextContent(payor, 'EIN'),
                    Address: {
                        Line1: getTextContent(payor.getElementsByTagName('Address')[0], 'Line1'),
                        City: getTextContent(payor.getElementsByTagName('Address')[0], 'City'),
                        State: getTextContent(payor.getElementsByTagName('Address')[0], 'State'),
                        Zip: getTextContent(payor.getElementsByTagName('Address')[0], 'Zip'),
                    }
                },
                Payee: {
                    PlaidId: getTextContent(payee, 'PlaidId'),
                    LoanAccountNumber: getTextContent(payee, 'LoanAccountNumber'),
                },
                Amount: getTextContent(row, 'Amount')
            };
        });

        // Set the parsed data to state
        setXmlData(rows);

        // Show the table
        setShowTable(true);
        setShowApproveDecline(true);
        setUploading(false);  // Set uploading to true

    };

    const handleApprove = async () => {
        setApproving(true);  // Set approving to true
        // Send xmlData to backend on approval
        const CHUNK_SIZE = 2;  // Set chunk size to 1850 messages
        const totalMessages = xmlData.length;
        const totalChunks = Math.ceil(totalMessages / CHUNK_SIZE);  // Calculate the total number of chunks
        const fileId = uuid.v4();
        const fileName = fileInput.current.files[0].name;

        xmlData.map((row, index) =>
            row.fileInfo = {
                id: fileId,
                name: fileName,
                numOfPayments: xmlData.length,
                fileNum: index + 1
            }
        )

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min((i + 1) * CHUNK_SIZE, totalMessages);
            const chunkData = xmlData.slice(start, end);  // Get a chunk of 1850 messages from xmlData
            const chunkJson = JSON.stringify(chunkData);  // Convert chunk to JSON
            try{
                await axios.post('http://localhost:5000/upload', chunkJson, {
                    headers: {'Content-Type': 'application/json'}
                })
            } catch (e) {
                setApproving(false)
            }
        }
        setApproving(false);  // Set approving to false
    };


    const handleDecline = () => {
        // Reset xmlData and hide table on decline
        setXmlData([]);
        setShowTable(false);
    };

    return (
        <>
            <div>
                <input type="file" ref={fileInput} />
                {uploading ? (
                    <CircularProgress size={24} />
                ) : (
                    <Button variant="contained" color="primary" onClick={handleUpload}>
                        Upload
                    </Button>
                )}
            </div>


            {showTable && (
                <div>
                    <CustomPaginationActionsTable data={xmlData}/>
                    {showApproveDecline && (
                        <div>
                            {approving ? (
                                <CircularProgress size={24} />
                            ) : (
                                <Button variant="contained" color="primary" onClick={handleApprove}>
                                    Approve
                                </Button>
                            )}
                            <Button variant="contained" color="secondary" onClick={handleDecline}>
                                Decline
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

const CustomPaginationActionsTable = ({ data }) => {
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(5);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    return (
        <Box sx={{ width: '100%', overflowX: 'auto', mt: 2 }}>
            <TableContainer component={Paper} sx={{ maxWidth: '100%', maxHeight: '70vh' }}>
                <Table sx={{ minWidth: 500 }} aria-label="custom pagination table">
                    <TableHead>
                        <TableRow>
                            {['Employee', 'Payor', 'Payee', 'Transaction'].map((header, index) => (
                                <TableCell colSpan={index === 0 ? 6 : index === 1 ? 10 : index === 2 ? 2 : 1}
                                           sx={{
                                               backgroundColor: '#f0f0f0',
                                               textAlign: 'center',
                                               borderBottom: '2px solid #d0d0d0'
                                           }}
                                >
                                    <Typography variant="subtitle1">{header}</Typography>
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            {[
                                'DunkinId', 'DunkinBranch', 'First Name', 'Last Name', 'DOB', 'Phone Number',
                                'DunkinId', 'ABARouting', 'Account Number', 'Name', 'DBA', 'EIN', 'Address Line1',
                                'Address City', 'Address State', 'Address Zip', 'PlaidId', 'Loan Account Number', 'Amount'
                            ].map((header, index) => (
                                <TableCell
                                    key={index}
                                    sx={{
                                        fontWeight: 'bold',
                                        padding: '12px',
                                        borderBottom: '4px solid #d0d0d0',
                                        borderRight: index === 5 || index === 15 || index === 17 ?
                                            '5px solid #d0d0d0' : '1px solid #e0e0e0'
                                    }}
                                >
                                    <Typography variant="subtitle3">{header}</Typography>
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {(rowsPerPage > 0
                                ? data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                : data
                        ).map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                {[
                                    row.Employee.DunkinId, row.Employee.DunkinBranch, row.Employee.FirstName,
                                    row.Employee.LastName, row.Employee.DOB, row.Employee.PhoneNumber, row.Payor.DunkinId,
                                    row.Payor.ABARouting, row.Payor.AccountNumber, row.Payor.Name, row.Payor.DBA,
                                    row.Payor.EIN, row.Payor.Address.Line1, row.Payor.Address.City, row.Payor.Address.State,
                                    row.Payor.Address.Zip, row.Payee.PlaidId, row.Payee.LoanAccountNumber, row.Amount
                                ].map((cell, cellIndex) => (
                                    <TableCell
                                        key={cellIndex}
                                        sx={{
                                            padding: '12px',
                                            borderBottom: '1px solid #d0d0d0',
                                            borderRight: cellIndex === 5 || cellIndex === 15 || cellIndex === 17 ?
                                                '5px solid #d0d0d0' : '1px solid #e0e0e0'
                                        }}
                                    >
                                        {cell}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TablePagination
                                rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                                colSpan={20}
                                count={data.length}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                SelectProps={{
                                    inputProps: { 'aria-label': 'rows per page' },
                                    native: true,
                                }}
                                onPageChange={handleChangePage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                            />
                        </TableRow>
                    </TableFooter>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default FileUpload;
