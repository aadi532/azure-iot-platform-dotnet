// Copyright (c) Microsoft. All rights reserved.

import React, { Component } from "react";

import { AjaxError, Indicator } from "components/shared";
import {
    Panel,
    PanelContent,
    PanelError,
    PanelHeader,
    PanelHeaderLabel,
    PanelOverlay,
} from "components/pages/dashboard/panel";
import "./grafana.scss";
const classnames = require("classnames/bind");
const css = classnames.bind(require("../telemetry/telemetryPanel.module.scss"));
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

export class GrafanaTelemetryPanel extends Component {
    constructor(props) {
        super(props);

        this.state = { deviceurl: "blank", from: "now-1h" };
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        this.prepareUrl(nextProps);
    }

    prepareUrl(props) {
        this.setState({ from: getIntervalParams(props.timeInterval) });
        const deviceIds = Object.keys(props.devices);
        if (deviceIds.length > 0) {
            var combinedUrl =
                "var-deviceid=" + deviceIds.join("&var-deviceid=");
            this.setState({ deviceurl: combinedUrl });
        } else {
            this.setState({ deviceurl: "blank" });
        }
    }

    render() {
        const { t, isPending, lastRefreshed, error } = this.props,
            { deviceurl, from } = this.state,
            showOverlay = isPending && !lastRefreshed;
        return (
            <Panel>
                <PanelHeader>
                    <PanelHeaderLabel>
                        {t("dashboard.panels.dashboard.header")}
                    </PanelHeaderLabel>
                </PanelHeader>
                <PanelContent className={css("telemetry-panel-container")}>
                    <iframe
                        title="Dashboard"
                        src={`https://acsagic-aks-dev.centralus.cloudapp.azure.com/grafana/d/Ij8AUoink/sample-dashboard?orgId=1&kiosk`}
                        width="100%"
                        height="100%"
                        frameborder="0"
                    ></iframe>
                </PanelContent>
                {showOverlay && (
                    <PanelOverlay>
                        <Indicator />
                    </PanelOverlay>
                )}
                {error && (
                    <PanelError>
                        <AjaxError t={t} error={error} />
                    </PanelError>
                )}
            </Panel>
        );
    }
}