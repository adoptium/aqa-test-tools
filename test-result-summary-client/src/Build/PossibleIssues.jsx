import React, { Component } from 'react';
import { Table } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { getParams } from '../utils/query';

import './table.css';

export default class PossibleIssues extends Component {
    state = {
        error: null,
        dataSource: {},
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
            let dataSource = {};
            const repoUrlAPIPrefix = "https://api.github.com/repos/";
            for (let index = 0; index < relatedIssues.items.length; index++) {
                const repoName = relatedIssues.items[index].repository_url.replace(repoUrlAPIPrefix, "");
                const issue = <a href={relatedIssues.items[index].html_url} target="_blank" rel="noopener noreferrer">{relatedIssues.items[index].title}</a>;
                dataSource[repoName] = dataSource[repoName] || [];
                dataSource[repoName].push({
                    key: dataSource[repoName].length,
                    issue
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
                dataIndex: 'issue',
                key: 'issue',
            }];

            return <div>
                <TestBreadcrumb buildId={buildId} testId={testId} testName={testName} />
                {
                    Object.keys(dataSource).map((repoName, index) => (
                        <Table 
                            key={index}
                            columns={columns}
                            dataSource={dataSource[repoName]}
                            bordered
                            title={() => repoName}
                        />
                    ))
                }
            </div>
        }
    }
}
