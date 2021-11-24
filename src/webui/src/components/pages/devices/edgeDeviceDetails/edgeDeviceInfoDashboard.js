// Copyright (c) Microsoft. All rights reserved.

import React, { Component, Fragment } from "react";
import Config from "app.config";
export const getIntervalParams = (timeInterval) => {
    switch (timeInterval) {
        case "PT15M":
            return "now-15m";
        case "P1D":
            return "now-1d";
        case "P7D":
            return "now-7d";
        case "P1M":
            return "now-1M";
        default:
            // Use PT1H as the default case
            return "now-1h";
    }
};

export class EdgeDeviceInfoDashboard extends Component {
    constructor(props) {
        super(props);
        this.state = { deviceId: props.deviceId, from: "now-1h" };
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        this.prepareUrl(nextProps);
    }

    prepareUrl(props) {
        this.setState({ from: getIntervalParams(props.timeInterval) });
        this.setState({ deviceId: (props.deviceId || {}).id });
    }

    render() {
        // const { t } = this.props;
        const { deviceId, from } = this.state;
        const { grafanaOrgId, edgeGrafanaUrl } = this.props;
        return (
            <Fragment>
                <iframe
                    title="Dashboard"
                    src={`${Config.serviceUrls.grafana}d/${edgeGrafanaUrl}?from=${from}&to=now&orgId=${grafanaOrgId}&var-deviceId=${deviceId}&theme=light&refresh=10s&kiosk`}
                    width="100%"
                    height="100%"
                    frameborder="0"
                ></iframe>
            </Fragment>
        );
    }
}
