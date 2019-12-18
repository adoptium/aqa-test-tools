import React, { Component } from 'react';
import { Row, Col, Button, Checkbox } from 'antd';
import TestInfo from './TestInfo'
import $ from 'jquery';

require('codemirror');
require('codemirror/lib/codemirror.css');
require('mergely');
require('mergely/lib/mergely.css');

export default class TestCompare extends Component {
    state = {
        copy: { url: true, buildName: true, buildNum: true, testName: false },
        forms: [{
            url: "https://ci.eclipse.org/openj9", buildName: "Test-Sanity-JDK10-aix_ppc-64_cmprssptrs", buildNum: 36, testName: "jit_jitt_3"
        }, {
            url: "https://ci.eclipse.org/openj9", buildName: "Test-Sanity-JDK10-aix_ppc-64_cmprssptrs", buildNum: 35, testName: "jit_jitt_3"
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

        for ( var i = 0; i < this.state.forms.length; i++ ) {
            const { url, buildName, buildNum, testName } = this.state.forms[i];
            const { removeTimestampFlag, applyDeepSmithMatchFlag } = this.state;
            const queryForGetOutput = "/api/getOutputByTestInfo?url=" + encodeURIComponent( url ) 
                                + "&buildName=" + encodeURIComponent( buildName ) 
                                + "&buildNum=" + buildNum + "&testName=" + testName 
                                + "&removeTimestampFlag=" + removeTimestampFlag
                                + "&applyDeepSmithMatchFlag=" + applyDeepSmithMatchFlag;
            const response = await fetch( queryForGetOutput, { method: 'get' } );
            const res = await response.json();
            if ( res && res.output ) {
                this.state.tests[i] = res;
            } else {
                alert( "Cannot find data! Please check your input values." );
                return;
            }
        }
        this.setState( this.state );

        $( this.compare ).mergely( 'lhs', this.state.tests[0].output );
        $( this.compare ).mergely( 'rhs', this.state.tests[1].output );
    }

    render() {
        return <div>
            <Row gutter={24}>
                <Col span={12}>
                    <TestInfo data={this.state.forms[0]} onChange={this.onChange.bind( null, 0 )} />
                </Col>
                <Col span={12}>
                    <TestInfo data={this.state.forms[1]} onChange={this.onChange.bind( null, 1 )} />
                </Col>
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