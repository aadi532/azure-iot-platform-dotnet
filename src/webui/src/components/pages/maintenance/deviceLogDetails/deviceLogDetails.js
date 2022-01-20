// Copyright (c) Microsoft. All rights reserved.

import React, { useState, useEffect } from "react";
import { DeviceLogGrid } from "components/pages/maintenance/grids";
import {
    AjaxError,
    ComponentArray,
    ContextMenu,
    ContextMenuAlign,
    PageContent,
    PageTitle,
    RefreshBarContainer as RefreshBar,
    Btn,
} from "components/shared";
import { IdentityGatewayService, TelemetryService } from "services";
import { TimeIntervalDropdownContainer as TimeIntervalDropdown } from "components/shell/timeIntervalDropdown";
import { LogDetails } from "components/pages/maintenance/flyout";
import { svgs } from "utilities";

const classnames = require("classnames/bind");
const css = classnames.bind(require("./deviceLogDetails.module.scss"));

export const DeviceLogDetails = (props) => {
    const [deviceId, setDeviceId] = useState(null),
        [deviceLogs, setDeviceLogs] = useState(undefined),
        [isPending, setIsPending] = useState(undefined),
        [error, setError] = useState(undefined),
        [openFlyoutName, setOpenFlyoutName] = useState(undefined),
        [logDetails, setLogDetails] = useState(undefined),
        { lastUpdated, t } = props,
        gridProps = {
            rowData: isPending ? undefined : deviceLogs || [],
            t: props.t,
            onRowClicked: ({ data }) => {
                setLogDetails(data);
                setOpenFlyoutName("log-details");
            },
        },
        closeFlyout = () => {
            setOpenFlyoutName(undefined);
        },
        fetchDeviceLogs = (deviceId) => {
            setIsPending(true);
            setError(undefined);
            TelemetryService.getDeviceLogs(
                deviceId,
                TimeIntervalDropdown.getTimeIntervalDropdownValue()
            ).subscribe(
                (deviceLogDetails) => {
                    setDeviceLogs(deviceLogDetails);
                    setIsPending(false);
                },
                (logError) => {
                    setError(logError);
                    setIsPending(false);
                }
            );
        };

    useEffect(() => {
        IdentityGatewayService.VerifyAndRefreshCache();
        closeFlyout();
    }, []);

    useEffect(() => {
        setDeviceId(props.match.params.id);
        fetchDeviceLogs(props.match.params.id);
    }, [props.match.params.id]);

    const refreshDataIntervel = (intervel) => {
        props.onTimeIntervalChange(intervel);
        fetchDeviceLogs(deviceId);
    };

    const refreshData = () => {
        fetchDeviceLogs(deviceId);
    };

    const navigateToPreviousPage = () => {
        props.history.go(-1);
    };

    return (
        <ComponentArray>
            <ContextMenu>
                <ContextMenuAlign left={true}>
                    <Btn svg={svgs.return} onClick={navigateToPreviousPage}>
                        Back
                    </Btn>
                </ContextMenuAlign>
                <ContextMenuAlign>
                    <TimeIntervalDropdown
                        onChange={refreshDataIntervel}
                        value={props.timeInterval}
                        t={t}
                    />
                    <RefreshBar
                        refresh={refreshData}
                        time={lastUpdated}
                        isPending={isPending}
                        t={t}
                        isShowIconOnly={true}
                    />
                </ContextMenuAlign>
            </ContextMenu>
            <PageContent className={css("device-log-container")}>
                <PageTitle titleValue={deviceId} />
                {!!error && <AjaxError t={t} error={error} />}
                {!error && <DeviceLogGrid {...gridProps} />}
            </PageContent>
            {openFlyoutName === "log-details" && (
                <LogDetails
                    t={t}
                    type={logDetails.type}
                    message={logDetails.message}
                    stack={logDetails.stack}
                    timeStamp={logDetails.timeStamp}
                    onClose={closeFlyout}
                />
            )}
        </ComponentArray>
    );
};
