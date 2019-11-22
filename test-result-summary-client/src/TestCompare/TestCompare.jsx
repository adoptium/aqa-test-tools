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
        removeTimeStamp: false,
        applyDeepSmithMatch: false
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

    toggleTimeStamp = () => {
        this.setState({ removeTimeStamp: !this.state.removeTimeStamp });
    }

    toggleDeepSmith = () => {
        this.setState({ applyDeepSmithMatch: !this.state.applyDeepSmithMatch });
    }

    handleCompare = async () => {
        $( this.compare ).mergely( 'lhs', '' );
        $( this.compare ).mergely( 'rhs', '' );

        for ( var i = 0; i < this.state.forms.length; i++ ) {
            const { url, buildName, buildNum, testName } = this.state.forms[i];
            const response = await fetch( `/api/getOutputByTestInfo?url=${encodeURIComponent( url )}&buildName=${encodeURIComponent( buildName )}&buildNum=${buildNum}&testName=${testName}`, {
                method: 'get'
            } );
            const res = await response.json();
            if ( res && res.output ) {
                let curOutput = res.output;
                if (this.state.removeTimeStamp) {
                    curOutput = this.removeTimeStamp(curOutput);
                }
                if (this.state.applyDeepSmithMatch) {
                    curOutput = this.matchDeepSmith(curOutput);
                }     
                res.output = curOutput;
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

    removeTimeStamp = (inputText) => {
        return inputText.replace(/\[\d{4}-\d{2}-\d{2}.*?\] /g, "");
    }

    matchDeepSmith = (inputText) => {
        // remove beginning and bottom build info
        const startWords = "Running Java Driver:";
        const endWords = "deepSmith_0_";
        inputText = inputText.substring(inputText.indexOf(startWords), inputText.lastIndexOf(endWords));
        
        // split tests and store in lists
        const testStartWords = "Current TEST_NAME ";
        let testsAll = inputText.split(testStartWords);

        // process each test and attach to curOutput
        let curOutput = "";
        for (let index = 0; index < testsAll.length; index++) {
            // split test into four fields (name, content, exception, output)
            const testKey = "Current TEST_"
            const testPartsTotal = 4;
            let testParts = testsAll[index].split(testKey);
            if(testParts.length !== testPartsTotal) {
                // For abnormal situation when parts not enough, attach all to compare later
                curOutput += testStartWords + testsAll[index];
            } else {
                // Part 0 test name
                curOutput += testStartWords + testParts[0];
                // Part 1 test content
                curOutput += testKey + testParts[1];
                let ignoreResultFlag = false;
                let ignoreResultWord = "";
                const ignoreResultWordsList = ["hashCode", "Random", "random", "nanoTime", "getRuntime"];
                for(let ignoreWord of ignoreResultWordsList) {
                    if(testParts[1].indexOf(ignoreWord) > -1 ) {
                        ignoreResultFlag = true;
                        ignoreResultWord = ignoreWord;
                        break;
                    }
                }
                // Part 2 exception: find Exception name only
                let exceptionName = testParts[2].match(/\w*Exception[:\s]/g);
                if ( exceptionName === null) {
                    curOutput += testKey + "EXCEPTION is None \n";
                } else {
                    let printExceptionName = exceptionName[0].substring(0, exceptionName[0].length - 1);
                    curOutput += testKey + "EXCEPTION is: " + printExceptionName + "\n";
                }
                // Part 3 output
                if(ignoreResultFlag) {
                    curOutput += testKey + "OUTPUT is " + ignoreResultWord + "_value \n\n";                                
                } else {
                    // remove @XXXX format, e.g. object@3b995
                    testParts[3] = testParts[3].replace(/@\w+/g, "@");
                    curOutput += testKey + testParts[3];
                }
            }                        
        }
        return curOutput;
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
                    <Checkbox onChange={this.toggleTimeStamp}>Remove TimeStamp</Checkbox>
                    <Checkbox onChange={this.toggleDeepSmith}>Apply DeepSmith Match</Checkbox>
                    <Button type="primary" onClick={this.handleCompare}>Compare</Button>
                    <Button style={{ marginLeft: 8 }} onClick={this.handleReset}>Clear</Button>
                </Col>
            </Row>
            <div ref={compare => this.compare = $( compare )}></div>
        </div>
    }
}