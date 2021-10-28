// Copyright (c) Microsoft. All rights reserved.

import React from "react";
import { PcsGrid } from "components/shared";
import { translateColumnDefs } from "utilities";
import {
    DownloadButtonRenderer,
    TimeRenderer,
} from "components/shared/cellRenderers";
import { checkboxColumn } from "components/shared/pcsGrid/pcsGridConfig";
import { TelemetryService } from "services";

const downloadFile = (relativePath, fileName) => {
    TelemetryService.getDeviceUploadsFileContent(relativePath).subscribe(
        (response) => {
            var blob = new Blob([response.response], {
                type: response.response.contentType,
            });
            let url = window.URL.createObjectURL(blob);
            let a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
        }
    );
};

const columnDefs = [
    checkboxColumn,
    {
        headerName: "Log Name",
        field: "Name",
    },
    {
        headerName: "Created Date",
        field: "DateCreated",
        cellRendererFramework: TimeRenderer,
    },
    {
        headerName: "Download",
        field: "Name",
        cellRendererFramework: (props) => (
            <DownloadButtonRenderer
                {...props}
                onButtonClick={() =>
                    downloadFile(props.data.BlobName, props.value)
                }
            />
        ),
    },
];

export const defaultColDef = {
    sortable: true,
    lockPinned: true,
    resizable: true,
};

export const DeviceLogsGrid = ({ t, ...props }) => {
    const gridProps = {
        columnDefs: translateColumnDefs(t, columnDefs),
        defaultColDef: defaultColDef,
        context: { t },
        sizeColumnsToFit: true,
        ...props,
    };
    return <PcsGrid {...gridProps} />;
};
