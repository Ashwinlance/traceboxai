import React from 'react';
import ReactDOM from 'react-dom/client';
import { ParcelProvider } from './store/parcelContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ParcelProvider><App/></ParcelProvider></React.StrictMode>);
