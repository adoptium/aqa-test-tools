import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { getParams } from '../utils/query';
import { Tooltip, Card, Alert } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import TestBreadcrumb from './TestBreadcrumb';
import { fetchData } from '../utils/Utils';

export default class ReleaseSummary extends Component{
    state = {
        body: "Generating Release Summary Report...",
    }

    async componentDidMount(){
        await this.updateData();
    }

    async updateData(){
        const { parentId } = getParams(this.props.location.search);
        const originUrl = window.location.origin;
        
        //get build info
        const build = await fetchData(`/api/getParents?id=${parentId}`);
    
        //add build and test details to report
        let report = `TRSS [link](${originUrl}/buildDetail?parentId=${parentId}&testSummaryResult=failed&buildNameRegex=%5ETest) \n`;
        
        const buildUrl = build[0].buildUrl;
        const startedBy = build[0].startBy;
        report += `Build URL ${buildUrl} \nStarted by ${startedBy} \n`;

        //get build history
        const buildHistory = await fetchData(`/api/getBuildHistory?parentId=${parentId}`);

        for (let build of buildHistory) {
            if (build.buildResult !== "SUCCESS") {
                report += `### ⚠️  [${build.buildName}](${build.buildUrl}) has a build result of ${build.buildResult} ⚠️\n`;
            }
        }
        
        // get all child builds info based on buildNameRegex
        const buildNameRegex = "^Test_openjdk.*";
        const childrenBuilds = await fetchData(`/api/getAllChildBuilds?parentId=${parentId}&buildNameRegex=${buildNameRegex}`);

        for (let testGroup of childrenBuilds) {
            //Update report with test groups that have not succeeded
            if (testGroup.buildResult !== "SUCCESS") {
                const testGroupId = testGroup._id;
                const testGroupName = testGroup.buildName;
                const testGroupUrl = testGroup.buildUrl;
                report += `\n[**${testGroupName}**](${testGroupUrl}) \n`;
                if (testGroup.tests) {
                    for (let test of testGroup.tests) {
                        if (test.testResult === "FAILED") {
                            const testName = test.testName;
                            const testId = test._id;

                            //get test history
                            const history = await fetchData(`/api/getHistoryPerTest?testId=${testId}&limit=100`);

                            let totalRuns = 0;
                            let totalPasses = 0;
                            for (let testRun of history) {
                                totalRuns += 1;
                                if (testRun.tests.testResult === "PASSED") {
                                    totalPasses += 1;
                                }
                            }
                            //For failed tests, add links to the deep history and possible issues list
                            report += `${testName} => [deep history ${totalPasses}/${totalRuns} passed](${originUrl}/deepHistory?testId=${testId}) | `
                                        + `[possible issues](${originUrl}/possibleIssues?buildId=${testGroupId}&buildName=${testGroupName}&testId=${testId}&testName=${testName}) \n`;
                        }
                    }
                } else {
                    report += `⚠️ Test Job Failed ⚠️\n`
                } 
            }
        }
        this.setState({
            body: report
        });
    }

    copyCodeToClipboard(){
        const markdownText = document.getElementById('markdown-text');
        let range, selection;

        if(document.body.createTextRange){ 
            range = document.body.createTextRange();
            range.moveToElementText(markdownText);
            range.select(); 
        }
        else if(window.getSelection){
            selection = window.getSelection();
            range = document.createRange();
            range.selectNodeContents(markdownText);
            selection.removeAllRanges();
            selection.addRange(range);   
        }
        
        let alert;
        if(document.execCommand('Copy')){
            alert = <Alert message="Successfully copied to clipboard" type="success" showIcon/>;
        }
        else{
            alert = <Alert message="Failed to copy to clipboard" type="error" showIcon/>;
        }
        ReactDOM.render(alert, document.getElementById("copy-status"));
    }

    render(){
        const { body } = this.state;
        const { parentId, buildName} = getParams(this.props.location.search);
        const title = "Release Summary Report for " + buildName;
        return(
            <div>
                <TestBreadcrumb buildId={parentId} />
                <div id="copy-status"></div>
                <Card title={title} bordered={true} style={{ width: '100%' }} extra={
                    <Tooltip title="Copy markdown report to clipboard" placement="topRight">
                        <CopyOutlined id="copy-button" style={{ fontSize: '200%'}} onClick={() => this.copyCodeToClipboard()} />
                    </Tooltip>
                }>
                    <pre className="card-body" id="markdown-text">{body}</pre>
                </Card>
            </div>
        );
    }
}
