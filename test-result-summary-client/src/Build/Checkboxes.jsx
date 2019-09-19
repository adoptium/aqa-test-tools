import React, { Component } from 'react';
import { Checkbox } from 'antd';
import { isEqual } from 'lodash';
const CheckboxGroup = Checkbox.Group;

export default class ResultGrid extends Component {
    render() {
        const { name, options = [], value = [], onChange } = this.props;
        const allChecked = isEqual(options, value);
        return <div>
            <div style={{ borderBottom: '1px solid #E9E9E9' }}>
                <Checkbox
                    indeterminate={!allChecked && value.length}
                    onChange={() => onChange(allChecked ? [] : options)}
                    checked={allChecked}
                >
                    <b>Select all {name}</b>
                </Checkbox>

                <br />
                <CheckboxGroup
                    options={options}
                    value={value}
                    onChange={onChange}
                />
            </div>
            <br />
        </div>;
    }
}