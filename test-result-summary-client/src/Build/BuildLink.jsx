import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';

export default class BuildLink extends Component {
    render() {
        const { id, label, link, buildResult, testSummaryResult, buildNameRegex } = this.props;
        if (id ) {
            return <span>
                {label}<Link to={{ pathname: '/buildDetail', search: params({ parentId: id, buildResult, testSummaryResult, buildNameRegex }) }}>{link} </Link>
            </span>;
        }
        return null;
    }
}