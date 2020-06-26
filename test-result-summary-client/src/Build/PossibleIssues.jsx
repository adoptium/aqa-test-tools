import React, { Component } from 'react';
import { Table } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { getParams } from '../utils/query';

import './table.css';

export default class PossibleIssues extends Component {
    state = {
        error: null,
        dataSource: [],
    };

    async componentDidMount() {
        await this.fetchIssues();
    }

    async fetchIssues() {
        const { buildName, testName } = getParams( this.props.location.search );

        let additionalRepo = "";
        if (buildName.includes('j9') || buildName.includes('ibm')) {
            additionalRepo = "+repo:eclipse/openj9";
        }

        const response = await fetch(`https://api.github.com/search/issues?q=${testName}+state:open+repo:AdoptOpenJDK/openjdk-tests` +
                    `+repo:AdoptOpenJDK/openjdk-infrastructure+repo:AdoptOpenJDK/openjdk-build${additionalRepo}`, {
            method: 'get'
        });
        if (response.ok) {
            const relatedIssues = await response.json();
            let dataSource = [];
            for (let index = 0; index < relatedIssues.items.length; index++) {
                dataSource.push({
                    key: index,
                    issues: <a href={relatedIssues.items[index].html_url} target="_blank" rel="noopener noreferrer">{relatedIssues.items[index].title}</a> 
                }); 
            }
            this.setState({
                dataSource
            });
        } else {
            this.setState({
                error: response.status + " "+ response.statusText
            });
        }
    };

    render() {
        const { error, dataSource} = this.state;
        const { buildId, testId, testName } = getParams( this.props.location.search );

        if (error) {
            return <div>Error: {error}</div>;
        } else {
            const columns = [{
                title: 'Possible Issues',
                dataIndex: 'issues',
                key: 'issues',
            }];
            return <div>
                <TestBreadcrumb buildId={buildId} testId={testId} testName={testName} />
                <Table
                    columns={columns}
                    dataSource={dataSource}
                    bordered
                    title={() => testName}
                />
            </div>
        }
    }
}
