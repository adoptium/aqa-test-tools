import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { params } from '../utils/query';
import { Button, Tooltip, Card } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { GithubOutlined } from '@ant-design/icons';
import { getParams } from '../utils/query';
import { fetchData } from '../utils/Utils';
import renderDuration from './Duration';
import { getGitDiffLinks } from '../utils/Utils';

import './table.css';

import moment from 'moment';
const DAY_FORMAT = 'MMM DD YYYY, hh:mm a';

const GitNewissue = () => {
    const [state, setState] = useState({
        body: '',
        title: '',
    });
    const location = useLocation();

    useEffect(() => {
        async function updateData() {
            const { testId, buildId } = getParams(location.search);
            const originUrl = window.location.origin;
            // fetch build data
            const buildDataRes = fetchData(`/api/getData?_id=${buildId}`);
            // fetch test data
            const testDataRes = fetchData(`/api/getTestById?id=${testId}`);

            const [buildData, testData] = await Promise.all([
                buildDataRes,
                testDataRes,
            ]);

            const { testName, testResult } = testData;

            // fetch error in test output
            const errorInOutput = await fetchData(
                `/api/getErrorInOutput?id=${testData.testOutputId}`
            );
            const failureOutput = errorInOutput.output;

            const { buildName, buildUrl, machine, javaVersion } = buildData[0];
            let { rerunLink } = buildData[0];

            if (rerunLink) {
                rerunLink = rerunLink.replace(
                    /(\WTARGET=)([^&]*)/gi,
                    '$1' + testName
                );
            }

            const machineName = machine.split('.')[0];
            const internalRun = buildUrl.includes('hyc-runtimes')
                ? 'internal'
                : '';
            const title = `${testName} ${testResult} in ${buildName}`;
            const nl = '\n';
            const generalInfo =
                `**Failure link**${nl}` +
                `---${nl}` +
                `From ${internalRun} [${buildName}](${buildUrl}) (${machineName})${nl}${nl}`;
            const javaVersionInfo = javaVersion
                ? `\`\`\`**Java Version**${nl}${javaVersion}${nl}\`\`\`${nl}`
                : ``;
            const rerunLinkInfo = rerunLink
                ? `${nl}${nl}[Rerun in Grinder](${rerunLink}) - Change TARGET to run only the failed test targets${nl}${nl}`
                : ``;
            const optionalInfo =
                `**Optional info**${nl}` +
                `---${nl}` +
                `Failure output (captured from console output)${nl}` +
                `---${nl}`;
            const failureOutputInfo = `\`\`\`${nl}${nl}\`\`\`${nl}${nl}`;

            const GrinderLink = `[50x ${internalRun} Grinder]()${nl}`;

            const body =
                generalInfo +
                javaVersionInfo +
                rerunLinkInfo +
                optionalInfo +
                failureOutputInfo +
                GrinderLink;
            setState({
                body,
                title,
            });
        }

        updateData();
    }, [location]);

    const { body, title } = state;
    const { testId, testName, buildId } = getParams(location.search);

    const urlParams = params({ title, body });
    let issueUrl = 'https://github.com/adoptium/aqa-tests/';
    let allowedHosts = ['trssrtp1.fyre.ibm.com'];
    if (allowedHosts.includes(window.location.hostname)) {
        issueUrl = 'https://github.com/eclipse-openj9/openj9/';
    }
    return (
        <div>
            <TestBreadcrumb
                buildId={buildId}
                testId={testId}
                testName={testName}
            />
            <Card
                title={title}
                bordered={true}
                style={{ width: '100%' }}
                extra={
                    <Tooltip title={`Create new issue at ${issueUrl}`}>
                        <a
                            href={`${issueUrl}issues/new${urlParams}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button size="large">
                                <GithubOutlined />
                                Create New Git Issue
                            </Button>
                        </a>
                    </Tooltip>
                }
            >
                <pre className="card-body">{body}</pre>
            </Card>
        </div>
    );
};

export default GitNewissue;
