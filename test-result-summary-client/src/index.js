import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { createBrowserHistory } from 'history';
import { Route } from 'react-router';
import { BrowserRouter } from 'react-router-dom';
import { withHighcharts } from 'react-jsx-highcharts';
import Highcharts from 'highcharts/highstock';

const WrappedApp = withHighcharts(App, Highcharts);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter history={createBrowserHistory()}>
    <Route path="/" component={WrappedApp} />
  </BrowserRouter>
);
