import React, { Component } from 'react';
import { Alert } from 'antd';

export default class AlertMsg extends Component {
    render() {
        const { error } = this.props;
        if (!error) return null;
        return (
            <Alert message="Error" description={error} type="error" showIcon />
        );
    }
}
