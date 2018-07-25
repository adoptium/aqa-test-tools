import React, { Component } from 'react';
import { Input } from 'antd';
import Highlighter from 'react-highlight-words';

export default class TextFilter extends Component {
    onChange = e => {
        const filterText = e.target.value;
        const { dataIndex, dataSource, handleFilterChange } = this.props;
        const reg = new RegExp( filterText, 'gi' );
        let filteredData = dataSource.filter( element => !!element[dataIndex].match( reg ) ).map( element => {
            return {
                ...element,
                [dataIndex]: <Highlighter
                    searchWords={filterText.split( ' ' )}
                    autoEscape
                    textToHighlight={element[dataIndex]} />,
            };
        } );
        handleFilterChange( filteredData );
    }

    render() {
        return ( <div className="custom-filter-dropdown">
            <Input
                ref={e => e && e.focus()}
                placeholder="Search name"
                onChange={this.onChange}
            />
        </div> );
    }
}