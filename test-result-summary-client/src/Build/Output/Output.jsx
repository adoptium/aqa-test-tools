import React, { Component } from 'react';
import { getParams } from '../../utils/query';
import { fetchData } from '../../utils/Utils';
import { Col, Row, Switch, Tooltip, Divider } from 'antd';
import { DownloadOutlined, LinkOutlined } from '@ant-design/icons';
import TestBreadcrumb from '../TestBreadcrumb';
import classnames from 'classnames';
import Artifacts from './Artifacts';
import AlertMsg from '../AlertMsg';
import "./output.css";

export default class Output extends Component {
    state = {
        data: null,
        terminalTheme: 'white',
        loaded: false
    };

    async componentDidMount() {
        await this.updateData( this.props.match.params.outputType );
    }
    async componentDidUpdate( nextProps ) {
        if ( nextProps.match.params.outputType !== this.props.match.params.outputType ) {
            await this.updateData( nextProps.match.params.outputType );
        }
    }

    async updateData( outputType ) {
        let data = {};
        const { id } = getParams( this.props.location.search );
        if ( outputType === "test" ) {
            const info = await fetchData(`/api/getTestById?id=${id} `);
            const result = await fetchData(`/api/getOutputById?id=${info.testOutputId}`);
            const results = await fetchData(`/api/getData?_id=${info.buildId} `); 
            const dataInfo = results[0];

            data = {
                testId: info._id,
                buildId: info.buildId,
                name: info.testName,
                artifactory: info.artifactory,
                output: result.output,
                result: info.testResult,
                buildUrl: dataInfo.buildUrl
            };
        } else {
            const results = await fetchData(`/api/getData?_id=${id} `);
            const info = results[0];
            if ( info && info.buildOutputId ) {
                const result = await fetchData(`/api/getOutputById?id=${info.buildOutputId}`);

                data = {
                    buildId: info._id,
                    name: info.buildName,
                    artifactory: null,
                    output: result.output,
                    result: info.buildResult
                };
            }
            data.error = info.error ? `${info.buildUrl}: ${info.error}` : "";
        }

        this.setState( { data, outputType } );
        setTimeout(() => this.setState( { loaded: true } ), 100 );
    }

    renderContent() {
        const { data, outputType, loaded } = this.state;
        if ( !loaded )
            return "Loading...";
        if ( !outputType )
            return null;
        return <div>
            <Row>
                <Col span={16}>
                    <h2 style={{ color: data.result === 'PASSED' ? "#2cbe4e" : "#f50" }}>
                        {data.name}
                    </h2>
                </Col>
                <Col span={8}>
                    <div className="switch-wrapper">
                        <Switch defaultChecked={false} onChange={val => this.setState( { terminalTheme: val ? 'black' : 'white' } )} checkedChildren="black" unCheckedChildren="white" />
                    </div>
                </Col>
            </Row>
            <Row justify="end">
                <Col span={1}>
                    {data.artifactory && <a target="_blank" href={data.artifactory}><Tooltip title="Artifactory Link"> <DownloadOutlined /> </Tooltip> </a>}
                    <Divider type="vertical" />
                    {data.buildUrl && <a target="_blank" href={data.buildUrl}><Tooltip title="Jenkins Link"> <LinkOutlined /> </Tooltip></a>}
                </Col>
            </Row>
            <Row>
                <div className={classnames( "test-output-wrapper", this.state.terminalTheme )}>
                    <div className="test-output">{data.output}</div>
                </div>
            </Row>
        </div>;
    }

    render() {
        const { data } = this.state;
        if ( data ) {
            if (data.error) {
                return <AlertMsg error={data.error} />
            }
            return <div className="test-wrapper">
                <TestBreadcrumb buildId={data.buildId} testId={data.testId} testName={data.name} />
                {this.renderContent()}
            </div>
        }
        return null;
    }
}