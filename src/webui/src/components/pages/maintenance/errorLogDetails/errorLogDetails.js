// Copyright (c) Microsoft. All rights reserved.

import React, { useState, useEffect } from "react";
import { DeviceLogsGrid } from "components/pages/maintenance/grids";
import {
    AjaxError,
    ComponentArray,
    ContextMenu,
    ContextMenuAlign,
    PageContent,
    PageTitle,
    RefreshBarContainer as RefreshBar,
} from "components/shared";
import { IdentityGatewayService, TelemetryService } from "services";
import { TimeIntervalDropdownContainer as TimeIntervalDropdown } from "components/shell/timeIntervalDropdown";

const classnames = require("classnames/bind");
const css = classnames.bind(require("./errorLogDetails.module.scss"));

export const ErrorLogDetails = (props) => {
    // const [openFlyoutName, setOpenFlyoutName] = useState(undefined);
    const [deviceId, setDeviceId] = useState(null);
    const [logDetails, setLogDetails] = useState(undefined);
    const [isPending, setIsPending] = useState(undefined);
    const [error, setError] = useState(undefined);
    const { lastUpdated, t } = props,
        gridProps = {
            // onGridReady: onGridReady,
            rowData: isPending ? undefined : logDetails || [],
            t: props.t,
            searchAreaLabel: props.t("users.ariaLabel"),
            searchPlaceholder: props.t("users.searchPlaceholder"),
        };
    // newUserFlyoutOpen = openFlyoutName === "device-log-details",
    // newServicePrincipalFlyoutOpen = openFlyoutName === "delete-device-log";

    useEffect(() => {
        IdentityGatewayService.VerifyAndRefreshCache();
    }, []);

    // useEffect(() => {
    //     if (props.isPending) {
    //         // If the grid data refreshes, hide the flyout and deselect soft selections
    //         this.setState(closedFlyoutState);
    //     }
    // }, [isPending]);

    useEffect(() => {
        setDeviceId(props.match.params.id);
        setIsPending(true);
        const subscription = TelemetryService.getErrorLogsByDevice(
            [props.match.params.id],
            TimeIntervalDropdown.getTimeIntervalDropdownValue()
        ).subscribe(
            (errorLogsByDevices) => {
                if (errorLogsByDevices[0]) {
                    setLogDetails(errorLogsByDevices[0].ErrorLogs);
                } else {
                    setLogDetails([]);
                }
                setIsPending(false);
            },
            (logError) => {
                setError(logError);
                setIsPending(false);
            }
        );

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [props.match.params.id]);

    const fetchDeviceLogs = () => {
        setIsPending(true);
        TelemetryService.getErrorLogsByDevice(
            [props.match.params.id],
            TimeIntervalDropdown.getTimeIntervalDropdownValue()
        ).subscribe(
            (errorLogsByDevices) => {
                if (errorLogsByDevices[0]) {
                    setLogDetails(errorLogsByDevices[0].ErrorLogs);
                } else {
                    setLogDetails([]);
                }

                setIsPending(false);
            },
            (logError) => {
                setError(logError);
                setIsPending(false);
            }
        );
    };

    const refreshData = (invervel) => {
        fetchDeviceLogs();
        props.onTimeIntervalChange(invervel);
    };

    // closeFlyout = () => setOpenFlyoutName(undefined);

    // openDeviceLogDetailsFlyout = () => {
    //     setOpenFlyoutName("device-log-details");
    //     props.logEvent(toDiagnosticsModel("DeviceLog_Click", {}));
    // };
    // openDeleteDeviceLogFlyout = () => {
    //     setOpenFlyoutName("delete-device-log");
    //     props.logEvent(toDiagnosticsModel("DeleteDeviceLog_Click", {}));
    // };

    return (
        <ComponentArray>
            <ContextMenu>
                <ContextMenuAlign>
                    {/* <Protected permission={permissions.inviteUsers}>
                        <Btn svg={svgs.plus} onClick={openNewUserFlyout}>
                            {t("users.flyouts.new.contextMenuName")}
                        </Btn>
                    </Protected> */}
                    <TimeIntervalDropdown
                        onChange={refreshData}
                        value={props.timeInterval}
                        t={t}
                    />
                    <RefreshBar
                        refresh={fetchDeviceLogs}
                        time={lastUpdated}
                        isPending={isPending}
                        t={t}
                        isShowIconOnly={true}
                    />
                </ContextMenuAlign>
            </ContextMenu>
            <PageContent className={css("users-container")}>
                <PageTitle titleValue={deviceId} />
                {!!error && <AjaxError t={t} error={error} />}
                {!error && <DeviceLogsGrid {...gridProps} />}
                {/* {newUserFlyoutOpen && (
                    <UserNewContainer onClose={this.closeFlyout} />
                )}
                {newSystemAdminFlyoutOpen && (
                    <SystemAdminNewContainer onClose={this.closeFlyout} />
                )} */}
            </PageContent>
        </ComponentArray>
    );
};
