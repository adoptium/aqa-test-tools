import React, { Component } from 'react';
import { Radio } from 'antd';

export default class ServerSelector extends Component {
    render() {
        const { servers, serverSelected, onChange } = this.props;

        return <Radio.Group onChange={onChange} value={serverSelected}>
            {servers.map( server => {
                return <Radio key={server} value={server}>{server}</Radio>;
            } )}
        </Radio.Group>
    }
}