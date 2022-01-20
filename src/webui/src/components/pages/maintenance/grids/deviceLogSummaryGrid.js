// Copyright (c) Microsoft. All rights reserved.

import React from "react";
import { PcsGrid } from "components/shared";
import { translateColumnDefs } from "utilities";
import { TimeRenderer } from "components/shared/cellRenderers";

const columnDefs = [
    {
        headerName: "Device Name",
        field: "deviceId",
    },
    {
        headerName: "Log Count",
        field: "count",
    },
    {
        headerName: "Last Logged Date",
        field: "lastRecordedDate",
        cellRendererFramework: TimeRenderer,
        sort: "desc",
    },
];

export const defaultColDef = {
    sortable: true,
    lockPinned: true,
    resizable: true,
};

export const DeviceLogSummaryGrid = ({ t, ...props }) => {
    const gridProps = {
        columnDefs: translateColumnDefs(t, columnDefs),
        defaultColDef: defaultColDef,
        context: { t },
        sizeColumnsToFit: true,
        searchAreaLabel: "Device Log",
        searchPlaceholder: "Search Devices...",
        ...props,
    };
    return <PcsGrid {...gridProps} />;
};
