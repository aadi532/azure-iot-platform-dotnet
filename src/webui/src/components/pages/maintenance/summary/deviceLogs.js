// Copyright (c) Microsoft. All rights reserved.

import React from "react";
import { DeviceLogSummaryGrid } from "components/pages/maintenance/grids";
import { AjaxError } from "components/shared";
const classnames = require("classnames/bind");
const css = classnames.bind(require("./summary.module.scss"));
const maintenanceCss = classnames.bind(require("../maintenance.module.scss"));

export const DeviceLogs = ({
    isPending,
    deviceLogsSummary,
    history,
    error,
    ...props
}) => {
    const gridProps = {
        ...props,
        rowData: isPending ? undefined : deviceLogsSummary,
        onRowClicked: ({ data: { deviceId } }) =>
            history.push(`/maintenance/deviceLog/${deviceId}`),
    };
    return !error ? (
        !isPending && deviceLogsSummary.length === 0 ? (
            <div className={css("no-data-msg")}>
                {props.t("maintenance.noData")}
            </div>
        ) : (
            <DeviceLogSummaryGrid {...gridProps} />
        )
    ) : (
        <AjaxError
            t={props.t}
            error={error}
            className={maintenanceCss("padded-error")}
        />
    );
};
