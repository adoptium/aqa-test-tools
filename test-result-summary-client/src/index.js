import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { Route, Routes } from 'react-router';
import { BrowserRouter } from 'react-router-dom';
import { withHighcharts } from 'react-jsx-highcharts';
import Highcharts from 'highcharts/highstock';

const WrappedApp = withHighcharts(App, Highcharts);

const root = createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/*" element={<WrappedApp />} />
    </Routes>
  </BrowserRouter>
);
