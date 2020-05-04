import React, { Component } from 'react';
import { Form, Row, Input, Icon } from 'antd';
const FormItem = Form.Item;


export default class TestInfo extends Component {
    render() {
        const { data: { compareType, buildUrl, testName }, onChange } = this.props;

        return <Form className="ant-advanced-search-form" onSubmit={this.handleSearch}>
            <Row>
                <FormItem label={compareType + " Build URL"}>
                    <Input prefix={<Icon type="user" style={{ fontSize: 13 }} />} placeholder="Jenkins Build URL" value={buildUrl} onChange={onChange.bind( null, 'buildUrl' )} />
                </FormItem>
                <FormItem label={compareType + " Test Name"}>
                    <Input prefix={<Icon type="user" style={{ fontSize: 13 }} />} placeholder="Test Name" value={testName} onChange={onChange.bind( null, 'testName' )} />
                </FormItem>
            </Row>
        </Form>
    }
}