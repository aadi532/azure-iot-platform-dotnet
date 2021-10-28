// Copyright (c) Microsoft. All rights reserved.

import Config from "app.config";
import { checkboxColumn } from "components/shared/pcsGrid/pcsGridConfig";

import {
    IsSimulatedRenderer,
    ConnectionStatusRenderer,
    TimeRenderer,
    SoftSelectLinkRenderer,
    LinkRenderer,
} from "components/shared/cellRenderers";
import {
    EMPTY_FIELD_VAL,
    gridValueFormatters,
} from "components/shared/pcsGrid/pcsGridConfig";

const { checkForEmpty } = gridValueFormatters;

/** A collection of column definitions for the devices grid */
export const deviceGridColumns = [
    checkboxColumn,
    {
        headerName: "devices.grid.deviceName",
        field: "id",
        cellRendererFramework: SoftSelectLinkRenderer,
        suppressSizeToFit: true,
    },
    {
        headerName: "devices.grid.simulated",
        field: "isSimulated",
        cellRendererFramework: IsSimulatedRenderer,
    },
    {
        headerName: "devices.grid.deviceType",
        field: "type",
        valueFormatter: ({ value }) => checkForEmpty(value),
    },
    {
        headerName: "devices.grid.firmware",
        field: "firmware",
        valueFormatter: ({ value }) => checkForEmpty(value),
    },
    {
        headerName: "devices.grid.telemetry",
        field: "telemetry",
        valueFormatter: ({ value }) =>
            Object.keys(value || {}).join("; ") || EMPTY_FIELD_VAL,
    },
    {
        headerName: "devices.grid.status",
        field: "connected",
        cellRendererFramework: ConnectionStatusRenderer,
    },
    {
        headerName: "devices.grid.lastConnection",
        field: "lastActivity",
        cellRendererFramework: TimeRenderer,
        suppressSizeToFit: true,
    },
    {
        headerName: "Device Modified Date",
        field: "modifiedDate",
        cellRendererFramework: TimeRenderer,
        suppressSizeToFit: true,
    },
    {
        headerName: "Device Created Date",
        field: "deviceCreatedDate",
        cellRendererFramework: TimeRenderer,
        suppressSizeToFit: true,
        sort: "desc",
    },
];

export const defaultDeviceColumns = [
    checkboxColumn,
    {
        headerName: "devices.grid.deviceName",
        field: "id",
        sort: "asc",
        cellRendererFramework: SoftSelectLinkRenderer,
        suppressSizeToFit: true,
    },
    {
        headerName: "Has Logs",
        field: "hasLogs",
        cellRendererFramework: (props) => {
            if (props.value === "Yes") {
                return (
                    <LinkRenderer
                        {...props}
                        to={`/maintenance/deviceLogs/${props.data.id}`}
                        showOnlyLink={true}
                    />
                );
            }
            return props.value;
        },
    },
];

/** Default column definitions*/
export const defaultColDef = {
    sortable: true,
    lockPinned: true,
    resizable: true,
};

/** Given a device object, extract and return the device Id */
export const getSoftSelectId = ({ Id }) => Id;

/** Shared device grid AgGrid properties */
export const defaultDeviceGridProps = {
    enableColResize: true,
    multiSelect: true,
    pagination: true,
    paginationPageSize: Config.paginationPageSize,
    rowSelection: "multiple",
};

export const defaultDownloadMappings = [
    {
        name: "Device name",
        mapping: "Id",
    },
    {
        name: "Simulated",
        mapping: "IsSimulated",
    },
    {
        name: "Device Type",
        mapping: "DeviceType",
    },
    {
        name: "Firmware",
        mapping: "Firmware",
    },
    {
        name: "Telemetry",
        mapping: "Telemetry",
    },
    {
        name: "Status",
        mapping: "Connected",
    },
    {
        name: "Last connection",
        mapping: "LastActivity",
    },
];
