import React, { Component } from 'react';
import { UserOutlined } from '@ant-design/icons';
import { Form } from '@ant-design/compatible';
import '@ant-design/compatible/assets/index.css';
import { Input } from 'antd';
const FormItem = Form.Item;

export default class TestInfo extends Component {
    render() {
        const {
            data: { compareType, buildUrl, testName },
            onChange,
        } = this.props;

        return (
            <Form
                layout="vertical"
                className="ant-advanced-search-form"
                onSubmit={this.handleSearch}
            >
                <FormItem label={compareType + ' Build URL'}>
                    <Input
                        prefix={<UserOutlined style={{ fontSize: 13 }} />}
                        placeholder="Jenkins Build URL"
                        value={buildUrl}
                        onChange={onChange.bind(null, 'buildUrl')}
                    />
                </FormItem>
                <FormItem label={compareType + ' Test Name'}>
                    <Input
                        prefix={<UserOutlined style={{ fontSize: 13 }} />}
                        placeholder="Test Name"
                        value={testName}
                        onChange={onChange.bind(null, 'testName')}
                    />
                </FormItem>
            </Form>
        );
    }
}
