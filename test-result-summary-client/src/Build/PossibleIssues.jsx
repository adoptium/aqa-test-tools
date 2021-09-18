import React, { Component } from 'react';
import { Table, Button } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { getParams } from '../utils/query';
import { SmileOutlined, FrownOutlined } from '@ant-design/icons';
import { fetchData } from '../utils/Utils';

import './table.css';

export default class PossibleIssues extends Component {
    state = {
        error: null,
        dataSource: {},
        loading: true,
    };

    async componentDidMount() {
        await this.fetchIssues();
    }

    getUserFeedback = async(repoName, buildName, issueName, issueCreator, accuracy) => { 
        const feedback = await fetchData(`/api/getFeedbackUrl?repoName=${repoName}&buildName=${buildName}&issueName=${issueName}&issueCreator=${issueCreator}&accuracy=${accuracy}`);
        
        if (feedback.error) { 
            console.log(feedback.error);
        } else {
            console.log(feedback.output.result);  
        }
    }

    async fetchIssues() {
        const { testId, buildName, testName } = getParams( this.props.location.search );
        const generalTestName = testName.replace(/_\d+$/, '');

        // fetch test output content
        const fetchData = await fetch( `/api/getTestById?id=${testId} `, {
            method: 'get'
        } );
        const info = await fetchData.json();
        const fetchTest = await fetch( `/api/getOutputById?id=${info.testOutputId}`, {
            method: 'get'
        } );
        const result = await fetchTest.json();
        const testOutput = result.output;

        // query ML Server for possible issues
        let mlIssue = '', mlIssueRepo = '', mlIssueNum = '';
        // Currently all TRSS servers will use the same ML server deployed on the TRSS adoptopendk machine
        const mlResponse = await fetch( 'https://trssml.adoptium.net/predict', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 'console_content' : testOutput })
        }).catch((error) => {
            console.log("ML server error " + error)
        });
        if ( mlResponse && mlResponse.ok ) {
            const mlResponseJson = await mlResponse.json();
            mlIssue = mlResponseJson['result'] || '';
            mlIssueRepo = mlIssue.replace(/-\d+$/, '');
            mlIssueNum = mlIssue.match(/\d+$/)[0];
        }

        // fetch related issues with Github API
        let additionalRepo = "";
        if (buildName.includes('j9') || buildName.includes('ibm')) {
            additionalRepo = "+repo:eclipse-openj9/openj9";
        }
        const response = await fetch(`https://api.github.com/search/issues?q=${generalTestName}+state:open+repo:adoptium/aqa-tests` +
                    `+repo:AdoptOpenJDK/openjdk-infrastructure+repo:adoptium/aqa-build+repo:adoptium/aqa-systemtest+repo:adoptium/TKG${additionalRepo}`, {
            method: 'get'
        });
        if (response.ok) {
            const relatedIssues = await response.json();
            let dataSource = {};
            const repoUrlAPIPrefix = "https://api.github.com/repos/";
            for (let index = 0; index < relatedIssues.items.length; index++) {
                const repoName = relatedIssues.items[index].repository_url.replace(repoUrlAPIPrefix, "");
                const issue = <a href={relatedIssues.items[index].html_url} target="_blank" rel="noopener noreferrer">{relatedIssues.items[index].title}</a>;
                const issueCreator = <a href={relatedIssues.items[index].user.html_url} target="_blank" rel="noopener noreferrer">{relatedIssues.items[index].user.login}</a>;
                const createdAt = new Date(relatedIssues.items[index].created_at).toLocaleString();
                const issueState = relatedIssues.items[index].state;
                const issueFullName = relatedIssues.items[index].title;
                const creatorName = relatedIssues.items[index].user.login;
                const userFeedback = <>
                <Button onClick={this.getUserFeedback(repoName, buildName, issueFullName, creatorName, true)}><SmileOutlined style={{fontSize: '25px', color: 'green'}} /></Button>
                &nbsp;
                <Button onClick={this.getUserFeedback(repoName, buildName, issueFullName, creatorName, false)}><FrownOutlined style={{fontSize: '25px', color: 'red'}} /></Button>
                </>;

                let relatedDegree = 'Medium';
                if (repoName.includes(mlIssueRepo)) {
                    if (relatedIssues.items[index].number.toString() === mlIssueNum) {
                        relatedDegree = 'High';
                    }
                }

                dataSource[repoName] = dataSource[repoName] || [];
                dataSource[repoName].push({
                    key: dataSource[repoName].length,
                    issue,
                    issueCreator,
                    createdAt,
                    issueState,
                    degree: relatedDegree,
                    userFeedback,
                });
            }
            this.setState({
                dataSource,
                loading: false,
            });
        } else {
            this.setState({
                error: response.status + " "+ response.statusText
            });
        }
    };

    render() {
        const { error, dataSource, loading} = this.state;
        const { buildId, testId, testName } = getParams( this.props.location.search );

        if (error) {
            return <div>Error: {error}</div>;
        } else {
            const columns = [
                {
                    title: 'Possible Issues',
                    dataIndex: 'issue',
                    key: 'issue',
                },
                {
                    title: 'Issue Creator',
                    dataIndex: 'issueCreator',
                    key: 'issueCreator',
                },
                {
                    title: 'Created At',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    defaultSortOrder: 'descend',
                    sorter: (a, b) => {
                        return new Date(a.createdAt) - new Date(b.createdAt);
                    }
                },
                {
                    title: 'State',
                    dataIndex: 'issueState',
                    key: 'issueState',
                },
                {
                    title: 'Related Degree',
                    dataIndex: 'degree',
                    key: 'degree',
                },
                {
                    title: 'User Feedback',
                    dataIndex: 'userFeedback',
                    key: 'userFeedback',
                },
            ];

            return <div>
                <TestBreadcrumb buildId={buildId} testId={testId} testName={testName} />
                {!loading && (Object.keys(dataSource).length > 0 ? (
                    Object.keys(dataSource).map((repoName, index) => (
                        <Table
                            key={index}
                            columns={columns}
                            dataSource={dataSource[repoName]}
                            bordered
                            title={() => repoName}
                        />
                    ))
                ) : (
                    <span>No Possible Issues Found</span> 
                ))
                }
            </div>
        }
    }
}