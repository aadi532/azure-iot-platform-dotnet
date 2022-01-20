// Copyright (c) Microsoft. All rights reserved.

import React, { Component } from "react";
import { svgs, copyToClipboard, DEFAULT_TIME_FORMAT } from "utilities";
import { Btn, BtnToolbar } from "components/shared";
import Flyout from "components/shared/flyout";
import moment from "moment";

const classnames = require("classnames/bind");
const css = classnames.bind(require("./logDetails.module.scss"));

export class LogDetails extends Component {
    constructor(props) {
        super(props);
        this.state = {
            expandedValue: false,
        };
        this.expandFlyout = this.expandFlyout.bind(this);
    }

    expandFlyout() {
        if (this.state.expandedValue) {
            this.setState({
                expandedValue: false,
            });
        } else {
            this.setState({
                expandedValue: true,
            });
        }
    }

    render() {
        const { t, onClose, type, message, stack, timeStamp } = this.props;

        return (
            <Flyout.Container
                header="Log Details"
                t={t}
                onClose={onClose}
                expanded={this.state.expandedValue}
                onExpand={() => {
                    this.expandFlyout();
                }}
            >
                <Flyout.Section.Container collapsable={false}>
                    <Flyout.Section.Content>
                        <span>
                            <h4>Log Type : {type}</h4>
                        </span>
                        <span>
                            Timestamp :{" "}
                            {moment(timeStamp).format(DEFAULT_TIME_FORMAT)}
                        </span>
                    </Flyout.Section.Content>
                </Flyout.Section.Container>
                <Flyout.Section.Container collapsable={false}>
                    <Flyout.Section.Header>
                        Message
                        <Btn
                            className={"copy-icon"}
                            svg={svgs.copy}
                            onClick={() => copyToClipboard(message)}
                        ></Btn>
                    </Flyout.Section.Header>
                    <Flyout.Section.Content>{message}</Flyout.Section.Content>
                </Flyout.Section.Container>

                <Flyout.Section.Container collapsable={false}>
                    <Flyout.Section.Header>
                        Stack Trace
                        <Btn
                            className={"copy-icon"}
                            svg={svgs.copy}
                            onClick={() => copyToClipboard(stack)}
                        ></Btn>
                    </Flyout.Section.Header>
                    <Flyout.Section.Content>
                        <div
                            aria-readonly="true"
                            aria-multiline="true"
                            role="textbox"
                            className={css("log-details-text-box")}
                            contentEditable="false"
                            spellCheck="false"
                            aria-label="Call Stack"
                        >
                            {stack}
                        </div>
                    </Flyout.Section.Content>
                </Flyout.Section.Container>
                <BtnToolbar>
                    <Btn svg={svgs.cancelX} onClick={onClose}>
                        {t("devices.flyouts.details.close")}
                    </Btn>
                </BtnToolbar>
            </Flyout.Container>
        );
    }
}
