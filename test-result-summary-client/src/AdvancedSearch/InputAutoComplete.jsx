import React, { Component } from 'react';
import { AutoComplete } from 'antd';

export default class InputAutoComplete extends Component {
    render() {
        return (
            <AutoComplete
                value={this.props.value}
                options={this.props.options.map((value) => ({ value }))}
                style={{
                    width: 600,
                }}
                onSelect={this.props.onSelect}
                onChange={this.props.onChange}
                placeholder={this.props.message}
                filterOption={(inputValue, option) =>
                    option.value
                        .toUpperCase()
                        .includes(inputValue.toUpperCase())
                }
            />
        );
    }
}
