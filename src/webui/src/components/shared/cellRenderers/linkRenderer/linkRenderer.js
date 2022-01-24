// Copyright (c) Microsoft. All rights reserved.

import React from "react";
import { NavLink } from "react-router-dom";

import { Svg } from "components/shared/svg/svg";
import { svgs } from "utilities";

const classnames = require("classnames/bind");
const css = classnames.bind(require("../cellRenderer.module.scss"));

export const LinkRenderer = ({ to, svgPath, ariaLabel, onLinkClick }) => {
    return (
        <div className={css("pcs-renderer-cell")}>
            <NavLink
                to={to}
                aria-label={ariaLabel}
                className={css("pcs-renderer-link")}
            >
                <Svg src={svgPath || svgs.ellipsis} onClick={onLinkClick} />
            </NavLink>
        </div>
    );
};

export default LinkRenderer;
