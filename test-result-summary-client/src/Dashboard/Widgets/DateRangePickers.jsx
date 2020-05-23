import React, { Component } from 'react';
import moment from 'moment';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import 'react-day-picker/lib/style.css';
import Highcharts from 'highstock-release';
import { provideAxis } from 'react-jsx-highcharts';
import './DateRangePickers.css';

const DAY_FORMAT = 'DD MMM YYYY';

class DateRangePickers extends Component {

    constructor( props ) {
        super( props );

        this.handleFromDateChange = this.handleFromDateChange.bind( this );
        this.handleToDateChange = this.handleToDateChange.bind( this );
        this.handleAfterSetExtremes = this.handleAfterSetExtremes.bind( this );

        this.state = {
            min: new Date().setDate(new Date().getDate()-7),
            max: new Date(),
        };
    }

    componentDidMount() {
        const axis = this.props.getAxis()
        Highcharts.addEvent( axis, 'afterSetExtremes', this.handleAfterSetExtremes );
    }

    handleFromDateChange( fromDate ) {
        const axis = this.props.getAxis();

        let { max } = axis.getExtremes();
        let selectedTime = fromDate.valueOf();

        let newMax = ( selectedTime >= max ) ? selectedTime + 86400000 : max;
        axis.setExtremes( selectedTime, newMax );
    }

    handleToDateChange( toDate ) {
        const axis = this.props.getAxis()

        let { min } = axis.getExtremes();
        let selectedTime = toDate.valueOf();

        let newMin = ( selectedTime <= min ) ? selectedTime - 86400000 : min;
        axis.setExtremes( newMin, selectedTime );
    }

    handleAfterSetExtremes( e ) {
        const { min, max } = e;
        this.setState( {
            min,
            max
        } );
    }

    render() {
        const axis = this.props.getAxis();
        if ( !axis ) return null;
        const { min, max } = this.state;

        const fromDate = moment( min ).format( DAY_FORMAT );
        const toDate = moment( max ).format( DAY_FORMAT );

        return (
            <div className="date-range-pickers">
                <span className="date-range-pickers__from-label">From: </span>
                <DayPickerInput
                    value={fromDate}
                    onDayChange={this.handleFromDateChange}
                    format={DAY_FORMAT} />
                <span className="date-range-pickers__to-label">To: </span>
                <DayPickerInput
                    value={toDate}
                    onDayChange={this.handleToDateChange}
                    format={DAY_FORMAT} />
            </div>
        );
    }
}

// The important bit, using the provideAxis HOC to inject Highcharts axis methods
export default provideAxis( DateRangePickers );