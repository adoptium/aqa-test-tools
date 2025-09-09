import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { getParams } from '../../utils/query';
import { fetchData } from '../../utils/Utils';
import { Col, Row, Switch, Tooltip, Divider } from 'antd';
import {
    DownloadOutlined,
    LinkOutlined,
    SyncOutlined,
} from '@ant-design/icons';
import TestBreadcrumb from '../TestBreadcrumb';
import classnames from 'classnames';
import AlertMsg from '../AlertMsg';
import './output.css';
import PossibleIssues from '../PossibleIssues';

const Output = () => {
    const location = useLocation();
    const matchParams = useParams();
    const [data, setData] = useState(null);
    const [terminalTheme, setTerminalTheme] = useState('white');
    const [loaded, setLoaded] = useState(false);
    const [outputType, setOutputType] = useState(matchParams.outputType);

    useEffect(() => {
        const updateData = async (outputType) => {
            let data = {};
            const { id } = getParams(location.search);

            if (outputType === 'test') {
                const info = await fetchData(`/api/getTestById?id=${id}`);
                const result = await fetchData(
                    `/api/getOutputById?id=${info.testOutputId}`
                );
                const results = await fetchData(
                    `/api/getData?_id=${info.buildId} `
                );
                const dataInfo = results[0];

                data = {
                    testId: info._id,
                    buildId: info.buildId,
                    name: info.testName,
                    artifactory: info.artifactory,
                    output: result.output,
                    result: info.testResult,
                    buildName: dataInfo.buildName,
                    buildUrl: dataInfo.buildUrl,
                    rerunLink: dataInfo.rerunLink,
                };
            } else {
                const results = await fetchData(`/api/getData?_id=${id}`);
                const info = results[0];
                if (info && info.buildOutputId) {
                    const result = await fetchData(
                        `/api/getOutputById?id=${info.buildOutputId}`
                    );

                    data = {
                        buildId: info._id,
                        name: info.buildName,
                        artifactory: null,
                        output: result.output,
                        result: info.buildResult,
                        buildUrl: info.buildUrl,
                        rerunLink: info.rerunLink,
                    };
                }
                data.error = info.error
                    ? `${info.buildUrl}: ${info.error}`
                    : '';
            }

            setData(data);
            setTimeout(() => setLoaded(true), 100);
        };
        updateData(matchParams.outputType);
    }, [location.search, matchParams.outputType]);

    const renderContent = () => {
        if (data.rerunLink) {
            data.rerunLink = data.rerunLink.replace(
                /(\WTARGET=)([^&]*)/gi,
                '$1' + data.name
            );
            data.rerunLink = data.rerunLink.replaceAll('&amp;', '&');
        }

        if (!loaded) return 'Loading...';
        if (!outputType) return null;
        return (
            <div>
                {data.testId && data.result != 'PASSED' && (
                    <PossibleIssues
                        buildId={data.buildId}
                        buildName={data.buildName}
                        testId={data.testId}
                        testName={data.name}
                    />
                )}
                <Row>
                    <Col span={16}>
                        <h2
                            style={{
                                color:
                                    data.result === 'PASSED'
                                        ? '#2cbe4e'
                                        : '#f50',
                            }}
                        >
                            {data.name}
                        </h2>
                    </Col>
                    <Col span={8}>
                        <div className="switch-wrapper">
                            <Switch
                                defaultChecked={false}
                                onChange={(val) =>
                                    setTerminalTheme({
                                        terminalTheme: val ? 'black' : 'white',
                                    })
                                }
                                checkedChildren="black"
                                unCheckedChildren="white"
                            />
                        </div>
                    </Col>
                </Row>
                <Row justify="end">
                    <Col>
                        {data.artifactory && (
                            <a
                                target="_blank"
                                href={data.artifactory}
                                rel="noopener noreferrer"
                            >
                                <Tooltip title="Artifactory Link">
                                    {' '}
                                    <DownloadOutlined />{' '}
                                </Tooltip>{' '}
                            </a>
                        )}
                        {data.buildUrl && (
                            <>
                                <Divider type="vertical" />
                                <a
                                    target="_blank"
                                    href={data.buildUrl}
                                    rel="noopener noreferrer"
                                >
                                    <Tooltip title="Jenkins Link">
                                        {' '}
                                        <LinkOutlined />{' '}
                                    </Tooltip>
                                </a>
                            </>
                        )}
                        {data.rerunLink && (
                            <>
                                <Divider type="vertical" />

                                <a
                                    target="_blank"
                                    href={data.rerunLink}
                                    rel="noopener noreferrer"
                                >
                                    <Tooltip title="Rerun Grinder">
                                        {' '}
                                        <SyncOutlined />{' '}
                                    </Tooltip>{' '}
                                </a>
                            </>
                        )}
                    </Col>
                </Row>
                <Row>
                    <div
                        className={classnames(
                            'test-output-wrapper',
                            terminalTheme
                        )}
                    >
                        <div className="test-output">{data.output}</div>
                    </div>
                </Row>
            </div>
        );
    };

    if (data) {
        if (data.error) {
            return <AlertMsg error={data.error} />;
        }
        return (
            <div className="test-wrapper">
                <TestBreadcrumb
                    buildId={data.buildId}
                    testId={data.testId}
                    testName={data.name}
                />
                {renderContent()}
            </div>
        );
    }
    return null;
};

export default Output;
