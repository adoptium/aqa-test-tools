import React, { Component } from 'react';
import { Table } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { getParams } from '../utils/query';

import './table.css';

export default class PossibleIssues extends Component {

    render() {
        const { buildId, buildName, testId, testName } = getParams( this.props.location.search );
        
        let issueRepos = [];
        if (buildName.includes('j9') || buildName.includes('ibm')) {
            issueRepos.push("eclipse/openj9");
        }
        issueRepos.push("AdoptOpenJDK/openjdk-tests");
        issueRepos.push("AdoptOpenJDK/openjdk-build");
        issueRepos.push("AdoptOpenJDK/openjdk-infrastructure");

        let issueUrls = [];
        for (let repo of issueRepos) {
            issueUrls.push(`https://github.com/${repo}/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+${testName}`);
        };
        
        const columns = [{
            title: 'Possible Issues',
            dataIndex: 'issues',
            key: 'issues',
        }];

        let dataSource = [];
        for (let index = 0; index < issueRepos.length; index++) {
            dataSource.push({
                key: index,
                issues: <a href={issueUrls[index]} target="_blank" rel="noopener noreferrer">{issueRepos[index]}</a> 
            }); 
        }

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
