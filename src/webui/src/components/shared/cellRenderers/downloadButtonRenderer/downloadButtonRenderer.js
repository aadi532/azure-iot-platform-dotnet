// Copyright (c) Microsoft. All rights reserved.

import React from "react";
import { Btn } from "components/shared";

const classnames = require("classnames/bind");
const css = classnames.bind(require("../cellRenderer.module.scss"));

export const DownloadButtonRenderer = ({ onButtonClick }) => {
    return (
        <div className={css("pcs-renderer-cell")}>
            <Btn
                icon={"download"}
                className={css("download-deviceupload")}
                onClick={onButtonClick}
            ></Btn>
        </div>
    );
};
