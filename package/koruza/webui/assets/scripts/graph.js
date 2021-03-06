import React from 'react';
import Avatar from 'material-ui/lib/avatar';
import {Card, CardHeader, CardTitle, CardText} from 'material-ui/lib/card';
import LinearProgress from 'material-ui/lib/linear-progress';
import ClearFix from 'material-ui/lib/clearfix';
import Highcharts from 'react-highcharts/dist/bundle/highcharts';

import colormap from 'colormap';
import _ from 'underscore';

import Bus from './bus';

export default class StatusGraph extends React.Component {
    constructor() {
        super();

        this.state = {
            haveAllReadings: false
        }

        this._chartConfig = {
            chart: {
                height: 200,
                type: 'scatter',
                options3d: {
                    enabled: true,
                    alpha: 10,
                    beta: 30,
                    depth: 250,
                    viewDistance: 5,
                    frame: {
                        bottom: { size: 1, color: 'rgba(0,0,0,0.02)' },
                        back: { size: 1, color: 'rgba(0,0,0,0.04)' },
                        side: { size: 1, color: 'rgba(0,0,0,0.06)' }
                    }
                }
            },
            title: {
                text: null
            },
            plotOptions: {
                scatter: {
                    width: 10,
                    height: 10,
                    depth: 10
                }
            },
            yAxis: {
                min: 0,
                title: null
            },
            xAxis: {
                min: 0,
                gridLineWidth: 1
            },
            zAxis: {
                showFirstLabel: false
            },
            legend: {
                enabled: false
            },
            credits: {
                enabled: false
            },
            series: [{
                name: 'RX power',
                colorByPoint: true,
                data: []
            }]
        };

        this._addReadings = this._addReadings.bind(this);
    }

    _addReadings(readings) {
        if (!this.state.haveAllReadings)
            return _.defer(this._addReadings, readings);

        let chart = this.refs.chart.getChart();
        let series = chart.series[0];

        series.addPoint({
            x: readings.positionX,
            y: readings.positionY,
            z: readings.power,
            color: {
                radialGradient: {
                    cx: 0.4,
                    cy: 0.3,
                    r: 0.5
                },
                stops: [
                    [0, readings.color],
                    [1, Highcharts.Highcharts.Color(readings.color).brighten(-0.2).get('rgb')]
                ]
            }
        });
    }

    componentDidMount() {
        let colorConfig = {
            colormap: 'jet',
            nshades: 50,
            format: 'hex'
        };
        let colors = colormap(colorConfig);
        let readings = {
            positionX: null,
            positionY: null,
            power: null,
            color: null
        }

        this._subscription = Bus.subscribe('status', ['sfp', 'motors'], _.throttle((message) => {
            if (message.type == 'sfp') {
                // TODO: What to do when we have multiple SFPs?
                let power = Math.round(_.values(message.sfp)[0].rx_power_db);
                if (power == readings.power)
                    return;

                readings.power = power;
            } else if (message.type == 'motors') {
                if (message.motor.current_x == readings.positionX &&
                    message.motor.current_y == readings.positionY)
                    return;

                readings.positionX = message.motor.current_x
                readings.positionY = message.motor.current_y
            }

            // Wait until both position and power are known.
            if (_.isNull(readings.positionX) || _.isNull(readings.power))
                return;

            readings.color = colors[
                Math.min(
                    colorConfig.nshades,
                    Math.max(
                        0,
                        Math.round(readings.power + 10)
                    )
                )
            ];

            if (!this.state.haveAllReadings) {
                this.setState({haveAllReadings: true});
            }

            this._addReadings(readings);
        }, 300));
    }

    componentWillUnmount() {
        this._subscription.stop();
    }

    render() {
        let chart;
        if (this.state.haveAllReadings)
            chart = <Highcharts ref="chart" config={this._chartConfig} isPureConfig={true} />;
        else
            chart = (
                <div>
                    Waiting for readings from the motor and SFP drivers…
                    <br/><br/>
                    <LinearProgress mode="indeterminate"  />
                </div>
            )

        return (
            <Card initiallyExpanded={true}>
                <CardHeader
                    title="Position and power display"
                    subtitle="Graphical display of current position and RX power"
                    avatar={<Avatar>G</Avatar>}
                    actAsExpander={true}
                    showExpandableButton={true}
                />

                <CardText expandable={true}>
                    {chart}
                </CardText>
            </Card>
        )
    }
}
