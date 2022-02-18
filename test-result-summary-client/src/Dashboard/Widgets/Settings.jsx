import React, { Component } from 'react';
import { Radio, Divider } from 'antd';

export default class Settings extends Component {
    async componentDidUpdate(prevProps) {
        if (prevProps.buildSelected !== this.props.buildSelected) {
            this.setState({
                buildSelected: this.props.buildSelected,
            });
        }
        if (prevProps.serverSelected !== this.props.serverSelected) {
            this.setState({
                serverSelected: this.props.serverSelected,
            });
        }
    }
    onChange = (obj) => {
        this.props.onChange({ buildSelected: obj.target.value });
    };

    onServerChange = (obj) => {
        this.props.onChange({ serverSelected: obj.target.value });
    };

    render() {
        const { servers, builds, buildSelected, serverSelected } = this.props;
        return (
            <div style={{ maxWidth: 400 }}>
                <Radio.Group
                    onChange={this.onServerChange}
                    value={serverSelected}
                    defaultValue={servers[0]}
                >
                    {servers.map((server) => {
                        return (
                            <Radio key={server} value={server}>
                                {server}
                            </Radio>
                        );
                    })}
                </Radio.Group>
                <Divider />
                <Radio.Group
                    onChange={this.onChange}
                    values={buildSelected}
                    defaultValue={builds[0]}
                >
                    {builds.map((build) => {
                        return (
                            <Radio key={build} value={build}>
                                {build}
                            </Radio>
                        );
                    })}
                </Radio.Group>
            </div>
        );
    }
}
