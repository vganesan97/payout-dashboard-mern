import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Button } from '@mui/material';  // Importing Button component from Material-UI
import ReportsDownload from './ReportsDownload';
import FileUpload from './FileUpload';

const Home = () => (
    <div>
        <h1>Loan Payout Dashboard</h1>
        <div>
            <Link to="/upload" style={{ textDecoration: 'none' }}>  {/* Removing text decoration */}
                <Button variant="contained" color="primary">
                    XML File Upload
                </Button>
            </Link>
            <Link to="/download" style={{ textDecoration: 'none' }}>  {/* Removing text decoration */}
                <Button variant="contained" color="secondary">
                    Reports CSV Download
                </Button>
            </Link>
        </div>
    </div>
);

function App() {
    return (
        <Router>
            <div className="App">
                <Link to="/" style={{ textDecoration: 'none', position: 'fixed', top: '20px', right: '20px' }}> {/* Home Button */}
                    <Button variant="contained">
                        Home
                    </Button>
                </Link>
                <Routes>
                    <Route path="/" element={<Home />} />  {/* Home Route */}
                    <Route path="/upload" element={<FileUpload />} />
                    <Route path="/download" element={<ReportsDownload />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
