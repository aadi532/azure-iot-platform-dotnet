// Copyright (c) Microsoft. All rights reserved.

import React, { Component } from "react";

import { isFunc, joinClasses } from "utilities";
import { GlimmerRenderer } from "components/shared/cellRenderers";

// import styles from "../cellRenderer.module.scss";

const classnames = require("classnames/bind");
const css = classnames.bind(require("../cellRenderer.module.scss"));

export class SoftSelectLinkRenderer extends Component {
    onClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const { context, data } = this.props;
        // To ensure up to date information, ALWAYS use the provided ID to
        // get the entity from the redux store. Note that the full data object
        // is passed along, but that is with the understanding that it may be
        // out of date. This is for convenience in analytics logging only.
        context.onSoftSelectChange(context.getSoftSelectId(data), data);
    };

    render() {
        const { value, context, data } = this.props;
        return (
            <div className={css("pcs-renderer-cell")}>
                <GlimmerRenderer value={data.isNew} />
                {isFunc(context.onSoftSelectChange) ? (
                    <button
                        type="button"
                        className={joinClasses(
                            "link",
                            css("pcs-renderer-link"),
                            css("soft-select-link")
                        )}
                        onClick={this.onClick}
                    >
                        {value}
                    </button>
                ) : (
                    <div
                        className={joinClasses("link", css("soft-select-link"))}
                    >
                        {value}
                    </div>
                )}
            </div>
        );
    }
}
