// Copyright (c) Microsoft. All rights reserved.

import React from "react";
import { PcsGrid } from "components/shared";
import { translateColumnDefs } from "utilities";
import { TimeRenderer } from "components/shared/cellRenderers";

const columnDefs = [
    {
        headerName: "Created Date",
        field: "timeStamp",
        cellRendererFramework: TimeRenderer,
        suppressSizeToFit: true,
        sort: "desc",
    },
    {
        headerName: "Log Type",
        field: "type",
        suppressSizeToFit: true,
    },
    {
        headerName: "Message",
        field: "message",
    },
    {
        headerName: "Call Stack",
        field: "stack",
        hide: true,
    },
];

export const defaultColDef = {
    sortable: true,
    lockPinned: true,
    resizable: true,
};

export const DeviceLogGrid = ({ t, ...props }) => {
    const gridProps = {
        columnDefs: translateColumnDefs(t, columnDefs),
        defaultColDef: defaultColDef,
        context: { t },
        sizeColumnsToFit: true,
        ...props,
    };
    return <PcsGrid {...gridProps} />;
};
