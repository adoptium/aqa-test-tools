import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { createBrowserHistory } from 'history';
import { Router, Route } from 'react-router';
import { withHighcharts } from 'react-jsx-highcharts';
import Highcharts from 'highcharts/highstock';

ReactDOM.render(
    <Router history={createBrowserHistory()}>
        <Route path="/" component={withHighcharts(App, Highcharts)} />
    </Router>,
    document.getElementById('root')
);
