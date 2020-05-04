import React, { Component } from 'react';
import { Row, Col, Button, Checkbox } from 'antd';
import TestInfo from './TestInfo'
import $ from 'jquery';
import { parseJenkinsUrl } from '../utils/parseJenkinsUrl';

require('codemirror');
require('codemirror/lib/codemirror.css');
require('mergely');
require('mergely/lib/mergely.css');

export default class TestCompare extends Component {
    state = {
        copy: { url: true, buildName: true, buildNum: true, testName: false },
        forms: [{
            compareType: "Baseline", buildUrl: "https://ci.adoptopenjdk.net/job/Test_openjdk11_j9_sanity.openjdk_x86-64_linux/207/", testName: "jdk_lang_j9_0"
        }, {
            compareType: "Comparison", buildUrl: "https://ci.adoptopenjdk.net/job/Test_openjdk11_j9_sanity.openjdk_x86-64_linux/208/", testName: "jdk_lang_j9_0"
        }],
        tests: [{}, {}],
        removeTimestampFlag: false,
        applyDeepSmithMatchFlag: false
    }

    componentDidMount() {
        $( this.compare ).mergely( {
            cmsettings: { readOnly: true }
        } );
    }

    onChange = ( formId, field, event ) => {
        this.state.forms[formId][field] = event.target.value;
        if ( formId === 0 ) {
            this.state.forms[1][field] = this.state.forms[0][field];
        }
        this.setState( this.state );
    };

    toggleTimestamp = () => {
        this.setState({ removeTimestampFlag: !this.state.removeTimestampFlag });
    }

    toggleDeepSmith = () => {
        this.setState({ applyDeepSmithMatchFlag: !this.state.applyDeepSmithMatchFlag });
    }

    handleCompare = async () => {
        $( this.compare ).mergely( 'lhs', '' );
        $( this.compare ).mergely( 'rhs', '' );

        const { removeTimestampFlag, applyDeepSmithMatchFlag } = this.state;
        for ( var i = 0; i < this.state.forms.length; i++ ) {
            const { compareType, buildUrl, testName } = this.state.forms[i];
            const { errorMsg, serverUrl, buildName, buildNum } = parseJenkinsUrl( buildUrl, compareType );
            if (!errorMsg) {
                let queryForGetOutput = "";
                if (testName) {
                    queryForGetOutput = "/api/getOutputByTestInfo?url=" + encodeURIComponent( serverUrl ) 
                                    + "&buildName=" + encodeURIComponent( buildName ) 
                                    + "&buildNum=" + buildNum + "&testName=" + testName 
                                    + "&removeTimestampFlag=" + removeTimestampFlag
                                    + "&applyDeepSmithMatchFlag=" + applyDeepSmithMatchFlag;
                } else {
                    const initialQueryForBuildID = "/api/getTestInfoByBuildInfo?url=" + serverUrl 
                                    + "&buildName=" + buildName
                                    + "&buildNum=" + buildNum;
                    const queryIDResponse = await fetch( initialQueryForBuildID, { method: 'get' } );
                    const queryIDRes = await queryIDResponse.json();
                    if ( !(queryIDRes && queryIDRes.testInfo && queryIDRes.testInfo[0].buildOutputId)) {
                        alert( "Cannot find data with provided " + compareType + " Build URL:\n" + buildUrl );
                        return;
                    }
                    queryForGetOutput = "/api/getOutputById?id=" + queryIDRes.testInfo[0].buildOutputId
                                    + "&removeTimestampFlag=" + removeTimestampFlag
                                    + "&applyDeepSmithMatchFlag=" + applyDeepSmithMatchFlag;
                }
                const response = await fetch( queryForGetOutput, { method: 'get' } );
                const res = await response.json();
                if ( res && res.output ) {
                    this.state.tests[i] = res;
                } else {
                    const testNameAlertMsg = testName? " and Test Name": "";
                    alert( "Cannot find data with provided " + compareType + " Build URL" + testNameAlertMsg + ":\n"
                            + buildUrl + "\n" + testName );
                    return;
                }
            } else {
                alert( errorMsg );
                return;
            }
        }
        this.setState( this.state );

        $( this.compare ).mergely( 'lhs', this.state.tests[0].output );
        $( this.compare ).mergely( 'rhs', this.state.tests[1].output );
    }

    render() {
        return <div>
            <Row>
                <TestInfo data={this.state.forms[0]} onChange={this.onChange.bind( null, 0 )} />
                <TestInfo data={this.state.forms[1]} onChange={this.onChange.bind( null, 1 )} />
            </Row>
            <Row>
                <Col span={24} style={{ textAlign: 'right' }}>
                    <Checkbox onChange={this.toggleTimestamp}>Remove TimeStamp</Checkbox>
                    <Checkbox onChange={this.toggleDeepSmith}>Apply DeepSmith Match</Checkbox>
                    <Button type="primary" onClick={this.handleCompare}>Compare</Button>
                    <Button style={{ marginLeft: 8 }} onClick={this.handleReset}>Clear</Button>
                </Col>
            </Row>
            <div ref={compare => this.compare = $( compare )}></div>
        </div>
    }
}