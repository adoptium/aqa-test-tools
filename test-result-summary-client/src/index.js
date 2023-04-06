import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { createBrowserHistory } from 'history';
import { Route } from 'react-router';
import { BrowserRouter } from 'react-router-dom'
import { withHighcharts } from 'react-jsx-highcharts';
import Highcharts from 'highcharts/highstock';

ReactDOM.render(
    <BrowserRouter history={createBrowserHistory()}>
        <Route path="/" component={withHighcharts(App, Highcharts)} />
    </BrowserRouter>,
    document.getElementById('root')
);
