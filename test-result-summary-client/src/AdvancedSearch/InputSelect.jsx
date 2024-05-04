import React, { Component } from 'react';
import { Select } from 'antd';

export default class InoutSelect extends Component {
    render() {
        const options = this.props.options.map((value) => ({ value }));
        return (
            <Select
                mode="multiple"
                allowClear
                style={{
                    width: '100%',
                }}
                placeholder={this.props.message}
                onChange={this.props.onChange}
                options={options}
            />
        );
    }
}
