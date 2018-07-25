$(function() {

    Morris.Area({
        element: 'morris-area-chart',
        data: [{
            period: '2017-02-01',
            Machine1: 2666,
            Machine2: null,
            Machine3: 2647
        }, {
            period: '2017-02-02',
            Machine1: 2778,
            Machine2: 2294,
            Machine3: 2441
        }, {
            period: '2017-02-03',
            Machine1: 4912,
            Machine2: 1969,
            Machine3: 2501
        }, {
            period: '2017-02-04',
            Machine1: 3767,
            Machine2: 3597,
            Machine3: 5689
        }, {
            period: '2017-02-05',
            Machine1: 6810,
            Machine2: 1914,
            Machine3: 2293
        }, {
            period: '2017-02-06',
            Machine1: 5670,
            Machine2: 4293,
            Machine3: 1881
        }, {
            period: '2017-02-07',
            Machine1: 4820,
            Machine2: 3795,
            Machine3: 1588
        }, {
            period: '2017-02-08',
            Machine1: 15073,
            Machine2: 5967,
            Machine3: 5175
        }, {
            period: '2017-02-09',
            Machine1: 10687,
            Machine2: 4460,
            Machine3: 2028
        }, {
            period: '2017-02-10',
            Machine1: 8432,
            Machine2: 5713,
            Machine3: 1791
        }],
        xkey: 'period',
        ykeys: ['Machine1', 'Machine2', 'Machine3'],
        labels: ['Machine 1', 'Machine 2', 'Machine 3'],
        pointSize: 3,
        hideHover: 'auto',
        resize: true
    });

    Morris.Donut({
        element: 'morris-donut-chart',
        data: [{
            label: "Machine 1",
            value: 12
        }, {
            label: "Machine 2",
            value: 30
        }, {
            label: "Machine 3",
            value: 20
        }],
        resize: true
    });

    Morris.Bar({
        element: 'morris-bar-chart',
        data: [{
            y: '2017-02-02',
            a: 100,
            b: 90,
            c: 60
        }, {
            y: '2017-02-03',
            a: 75,
            b: 65,
            c: 35
        }, {
            y: '2017-02-04',
            a: 50,
            b: 40,
            c: 39
        }, {
            y: '2017-02-05',
            a: 75,
            b: 65,
            c: 45
        }, {
            y: '2017-02-06',
            a: 50,
            b: 40,
            c: 30
        }, {
            y: '2017-02-07',
            a: 75,
            b: 65,
            c: 40
        }, {
            y: '2017-02-08',
            a: 100,
            b: 90,
            c: 80
        }],
        xkey: 'y',
        ykeys: ['a', 'b', 'c'],
        labels: ['Machine 1', 'Machine 2', 'Machine 3' ],
        hideHover: 'auto',
        resize: true
    });
    
});
