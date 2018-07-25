import React, { Component } from 'react';
import { Form, Row, Input, Icon } from 'antd';
const FormItem = Form.Item;


export default class TestInfo extends Component {
    render() {
        const { data: { url, buildName, buildNum, testName }, onChange } = this.props;
        return <Form className="ant-advanced-search-form" onSubmit={this.handleSearch}>
            <Row gutter={40}>
                <FormItem>
                    <Input prefix={<Icon type="user" style={{ fontSize: 13 }} />} placeholder="Jenkin Server URL" value={url} onChange={onChange.bind( null, 'url' )} />
                </FormItem>
                <FormItem>
                    <Input prefix={<Icon type="user" style={{ fontSize: 13 }} />} placeholder="Build Name" value={buildName} onChange={onChange.bind( null, 'buildName' )} />
                </FormItem>
                <FormItem>
                    <Input prefix={<Icon type="user" style={{ fontSize: 13 }} />} placeholder="Build Number" value={buildNum} onChange={onChange.bind( null, 'buildNum' )} />
                </FormItem>
                <FormItem>
                    <Input prefix={<Icon type="user" style={{ fontSize: 13 }} />} placeholder="Test Name" value={testName} onChange={onChange.bind( null, 'testName' )} />
                </FormItem>
            </Row>
        </Form>
    }
}